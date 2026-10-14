-- ============================================================================
-- Stage 2 適用SQL: 承認済み対応表からの common_user_id 移行
-- ----------------------------------------------------------------------------
-- 操作方法（必読。手順書 08_RELEASE_PROCEDURE.md にも同内容を明記）:
--   1) 必ず ON_ERROR_STOP=1 を付けて psql から実行すること。
--        psql -v ON_ERROR_STOP=1 -h <host> -U <user> -d <tenant_db> -f 05_stage2_apply.sql
--      ON_ERROR_STOP を付けないと、DOブロックが例外を送出した後も後続文が
--      「current transaction is aborted」のエラーを出しながら実行され続け、
--      出力が読みにくくなる（最終結果はいずれの場合も未反映のまま変わらない）。
--   2) このスクリプトは単一トランザクション（BEGIN〜COMMIT）として実行する。
--      途中のいずれかのDOブロックが例外を送出した場合、PostgreSQLの仕様により
--      トランザクションは「中断状態」となり、末尾の COMMIT は自動的に
--      ROLLBACK として処理される。つまり「事前チェックで異常を検知
--      → 例外送出 → 中断状態 → COMMITは実質ROLLBACK」という一本の経路のみが
--      存在し、"目視してから手動でROLLBACKする" 操作は不要かつ想定していない。
--   3) 実行結果の最終行が "COMMIT" と表示された場合のみ適用成功。
--      1行でも "ERROR" が出力された場合、その回の適用は全件未反映である
--      （部分適用は発生しない）。
--   4) 適用に成功した場合、標準出力に表示される batch_id を必ず記録・保管する。
--      ロールバック（06_stage2_rollback.sql）はこの batch_id を指定して行う。
--   5) 並行更新対策: このスクリプトは REPEATABLE READ で開始し、対象となる
--      users行・対応表行を明示的にロックする。隔離DBで検証済みの実際の動作：
--      (a) ロック取得時点で対象行が既に他セッションにより変更・コミット済みだった場合、
--          本トランザクションは以降の全ての参照でその最新コミット値を見るようになり（REPEATABLE
--          READのスナップショットより優先）、1)の再検査がその変更を検知して例外で中止する
--          （隔離DBテストで実際に確認済み）。
--      (b) 対象行が他セッションで進行中のトランザクションによりロック中の場合は、そのトランザクション
--          が終了するまで本スクリプトは待機し、相手がコミットした場合は
--          "could not serialize access due to concurrent update"(SQLSTATE 40001)で
--          全件が中止される。
--      いずれの経路でも部分適用は発生しない。発生した場合は
--      04_stage2_precheck.sql からやり直すこと（自動リトライはしない）。
-- ----------------------------------------------------------------------------
-- 前提: 01_approval_table_template.md の
--       ops_audit.user_link_approved_mapping / ops_audit.user_link_migration_log
--       が対象テナントDBに作成済みであること。
-- 冪等性: 同じ対応表・同じデータに対して再実行しても結果は変わらない
--         （2回目以降は old=new のため対象行が0件となり、何も更新されない）。
-- ============================================================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

-- このトランザクション内で使う batch_id を採番する。
-- 注意: psqlの ":'var'" 変数展開は DO $$ ... $$ ブロック内部（ドル引用文字列内）
-- では行われないため、DOブロック内から参照する場合は set_config/current_setting
-- によるセッションGUC経由で受け渡す（トランザクションローカルなのでCOMMIT/ROLLBACK
-- 時に自動的に破棄される）。
SELECT gen_random_uuid() AS batch_id \gset
SELECT set_config('app.stage2_batch_id', :'batch_id', true);

-- ----------------------------------------------------------------------------
-- 0-a) 対応表・対象usersの行を明示的にロックする（並行更新対策）。
--      対象行が他セッションにより既に変更・コミット済みだった場合、この時点で
--      本トランザクションの以後の参照はその最新コミット値を見るようになる
--      （REPEATABLE READのスナップショットより優先される）ため、1)の再検査が
--      その変更を正しく検知して例外で中止する（隔離DBテストで確認済み）。
--      対象行が他セッションで進行中の未コミット変更によりロック中の場合は、
--      その完了まで待機し、コミットされていれば同様に上記の再検知が働く。
-- ----------------------------------------------------------------------------
SELECT 1
FROM ops_audit.user_link_approved_mapping m
WHERE m.tenant_db = current_database()
FOR SHARE;

SELECT 1
FROM public.users u
JOIN ops_audit.user_link_approved_mapping m ON u.id = m.tenant_user_id
WHERE m.tenant_db = current_database()
FOR UPDATE OF u;

-- ----------------------------------------------------------------------------
-- 0-b) tenant_db不一致チェック
--    対応表が誤って別DB向けに作成・インポートされていないかを確認する。
--    1件でも不一致があれば例外を送出し、全件を中止する。
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_mismatch_count int;
BEGIN
  SELECT COUNT(*) INTO v_mismatch_count
  FROM ops_audit.user_link_approved_mapping m
  WHERE m.tenant_db <> current_database();

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'Stage2 abort: % mapping row(s) have tenant_db different from current_database() (%). No rows were updated.',
      v_mismatch_count, current_database();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) 04_stage2_precheck.sql A節相当の再検査（適用直前・同一トランザクション内・
--    上記でロック済みの行に対して実施）
--    事前確認の実行後にデータが変化していた場合でも、ここで再検知して
--    全件を中止する。1件でも異常があれば以降のUPDATEには到達しない。
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing_user      int; -- 対応表にあるがusersに存在しない行
  v_conflict_existing int; -- 既に別のcommon_user_idへ紐付いている行
  v_dup_common_id     int; -- 対応表内でcommon_user_idが重複
  v_dup_tenant_user   int; -- 対応表内でtenant_user_idが重複
  v_username_mismatch int; -- 承認時から username が変化している行
BEGIN
  SELECT COUNT(*) INTO v_missing_user
  FROM ops_audit.user_link_approved_mapping m
  LEFT JOIN public.users u ON u.id = m.tenant_user_id
  WHERE u.id IS NULL;

  SELECT COUNT(*) INTO v_conflict_existing
  FROM ops_audit.user_link_approved_mapping m
  JOIN public.users u ON u.id = m.tenant_user_id
  WHERE u.common_user_id IS NOT NULL
    AND u.common_user_id <> m.common_user_id;

  SELECT COUNT(*) INTO v_dup_common_id
  FROM (
    SELECT tenant_db, common_user_id
    FROM ops_audit.user_link_approved_mapping
    GROUP BY tenant_db, common_user_id
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO v_dup_tenant_user
  FROM (
    SELECT tenant_db, tenant_user_id
    FROM ops_audit.user_link_approved_mapping
    GROUP BY tenant_db, tenant_user_id
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO v_username_mismatch
  FROM ops_audit.user_link_approved_mapping m
  JOIN public.users u ON u.id = m.tenant_user_id
  WHERE u.username <> m.tenant_username;

  IF v_missing_user > 0 OR v_conflict_existing > 0 OR v_dup_common_id > 0
     OR v_dup_tenant_user > 0 OR v_username_mismatch > 0 THEN
    RAISE EXCEPTION
      'Stage2 abort: precheck errors found at apply time (missing_user=%, conflict_existing=%, dup_common_id=%, dup_tenant_user=%, username_mismatch=%). No rows were updated. Re-run 04_stage2_precheck.sql for details.',
      v_missing_user, v_conflict_existing, v_dup_common_id, v_dup_tenant_user, v_username_mismatch;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2) 変更前の値を先に監査ログへ記録する（UPDATEより前に必ず記録する）
--    対象は「対応表の値と現在値が異なる行」のみ（既に一致する行は冪等のため対象外）。
-- ----------------------------------------------------------------------------
INSERT INTO ops_audit.user_link_migration_log
  (batch_id, tenant_db, tenant_user_id, old_common_user_id, new_common_user_id, applied_by)
SELECT
  current_setting('app.stage2_batch_id')::uuid,
  m.tenant_db,
  m.tenant_user_id,
  u.common_user_id,
  m.common_user_id,
  current_user
FROM ops_audit.user_link_approved_mapping m
JOIN public.users u ON u.id = m.tenant_user_id
WHERE m.tenant_db = current_database()
  AND u.common_user_id IS DISTINCT FROM m.common_user_id;

-- ----------------------------------------------------------------------------
-- 3) 更新（0)・1)の検査を通過した場合のみ到達する。対象は上記ログと同じ行）
-- ----------------------------------------------------------------------------
UPDATE public.users u
SET common_user_id = l.new_common_user_id
FROM ops_audit.user_link_migration_log l
WHERE u.id = l.tenant_user_id
  AND l.batch_id = current_setting('app.stage2_batch_id')::uuid;

-- ----------------------------------------------------------------------------
-- 4) 適用結果の自己検証。ログ件数と実テーブルの反映件数が一致しない場合は
--    例外を送出して全件を中止する（部分反映を検知するための最終ガード）。
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_expected int;
  v_actual   int;
  v_batch_id uuid := current_setting('app.stage2_batch_id')::uuid;
BEGIN
  SELECT COUNT(*) INTO v_expected
  FROM ops_audit.user_link_migration_log
  WHERE batch_id = v_batch_id;

  SELECT COUNT(*) INTO v_actual
  FROM public.users u
  JOIN ops_audit.user_link_migration_log l
    ON l.tenant_user_id = u.id AND l.batch_id = v_batch_id
  WHERE u.common_user_id IS NOT DISTINCT FROM l.new_common_user_id;

  IF v_expected <> v_actual THEN
    RAISE EXCEPTION
      'Stage2 abort: logged row count (%) does not match actually updated row count (%). No rows were committed.',
      v_expected, v_actual;
  END IF;
END $$;

-- このSELECTの出力にある batch_id を必ず記録すること（ロールバック時に必要）
SELECT current_setting('app.stage2_batch_id')::uuid AS batch_id,
       current_database() AS tenant_db,
       COUNT(*) AS rows_updated_this_batch
FROM ops_audit.user_link_migration_log
WHERE batch_id = current_setting('app.stage2_batch_id')::uuid;

COMMIT;
-- 適用成功(COMMIT)後に誤りが判明した場合は、上記batch_idを指定して
-- 06_stage2_rollback.sql を実行する（本ファイルへの手動ROLLBACKは行わない）。
