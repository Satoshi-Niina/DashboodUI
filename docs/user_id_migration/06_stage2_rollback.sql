-- ============================================================================
-- Stage 2 復旧手順（ロールバック、バッチ単位）
-- 方針: 05_stage2_apply.sql が ops_audit.user_link_migration_log へ記録した
--       「特定のbatch_id」（ロールバック記録ではない元の適用ログ、notes IS NULL）
--       の行だけを対象とする。対応表(mapping)の現在の内容には依存しない
--       （対応表が後で変更・削除されていてもロールバックできるようにするため）。
-- 事前表示: 対象batch_idの全行を次の4区分に分類し、件数を表示してから判断する。
--   - 復旧可能   : 現在値がnew_common_user_id（そのバッチが書き込んだ値）のまま
--   - 復旧済み   : 現在値が既にold_common_user_id（バッチ適用前の値）に戻っている
--                  （再実行時の冪等ケース。エラーではない）
--   - 変更済み   : 現在値がnew/oldのいずれとも一致しない（他経路で変更された）
--   - 復旧不能   : 対象ユーザー行自体が存在しない（削除済み等）
--   「想定外の行」= 変更済み + 復旧不能。1件でもあれば実行を中止し、
--   復旧可能な行だけの部分ロールバックは行わない（全件中止）。
-- 記録方式: 実際にUPDATEされた行だけをRETURNINGで取得し、今回の実行1回につき
--   1つの rollback_batch_id で監査ログへ記録する。復旧済み行（今回UPDATE対象外）
--   は新たな変更として記録しない。
-- 並行更新対策: 05_stage2_apply.sqlと同様、REPEATABLE READで開始し、対象となる
--   users行を明示的にロックする。ロック取得時点で対象行が他セッションにより既に
--   変更・コミット済みの場合、以後の本トランザクション内の参照はその最新値を見る
--   ため、直後の事前表示・中止判定（変更済み／復旧不能の分類）が正しくその変更を
--   検知して全件中止する（隔離DBでの並行更新シナリオで実際に確認済み）。
--   対象行が他セッションで進行中の未コミットトランザクションによりロック中の場合は、
--   その完了まで本スクリプトは待機する。
-- 操作方法（必読）:
--   1) 対象バッチIDを指定して実行する（05実行時に記録したbatch_idを使用）:
--        psql -v ON_ERROR_STOP=1 -v batch_id='<対象バッチのUUID>' \
--             -h <host> -U <user> -d <tenant_db> -f 06_stage2_rollback.sql
--   2) batch_id未指定、または該当ログが0件の場合は例外を送出し、何も変更しない。
--   3) 05_stage2_apply.sql と同様、単一トランザクションで実行され、
--      異常時はCOMMITが実質ROLLBACKとして扱われるため部分反映は発生しない。
--   4) 実行後、標準出力に表示される rollback_batch_id を記録すること
--      （このロールバック自体を追跡するため）。
-- ============================================================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

-- 操作者が指定した対象batch_idと、今回のロールバック操作自身のIDを
-- セッションGUCに設定する（DO $$ ブロック内ではpsqlの ":'var'" 変数展開が
-- 行われないため、current_setting経由で参照する）。
SELECT set_config('app.stage2_target_batch_id', :'batch_id', true);
SELECT gen_random_uuid() AS rollback_batch_id \gset
SELECT set_config('app.stage2_rollback_batch_id', :'rollback_batch_id', true);

-- ----------------------------------------------------------------------------
-- 0) 対象行の存在確認、および対象users行を明示的にロック（並行更新対策）。
--    対象batch_idの元ログ（notes IS NULL）が1件もなければ即座に中止する。
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_batch_id uuid := current_setting('app.stage2_target_batch_id')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ops_audit.user_link_migration_log
    WHERE batch_id = v_batch_id AND notes IS NULL
  ) THEN
    RAISE EXCEPTION
      'Rollback abort: no log rows found for batch_id=%. No rows were changed.',
      v_batch_id;
  END IF;
END $$;

SELECT 1
FROM public.users u
JOIN ops_audit.user_link_migration_log l
  ON l.tenant_user_id = u.id
WHERE l.batch_id = current_setting('app.stage2_target_batch_id')::uuid
  AND l.notes IS NULL
FOR UPDATE OF u;

-- ----------------------------------------------------------------------------
-- 1) 事前表示: 対象batch_idの全行を4区分に分類して件数を表示する。
--    「変更済み」「復旧不能」が1件でもあれば、この後のDOブロックで中止する。
-- ----------------------------------------------------------------------------
SELECT
  current_setting('app.stage2_target_batch_id')::uuid AS target_batch_id,
  COUNT(*) FILTER (
    WHERE u.id IS NOT NULL AND u.common_user_id IS NOT DISTINCT FROM l.new_common_user_id
  ) AS recoverable_count,
  COUNT(*) FILTER (
    WHERE u.id IS NOT NULL AND u.common_user_id IS NOT DISTINCT FROM l.old_common_user_id
      AND l.new_common_user_id IS DISTINCT FROM l.old_common_user_id
  ) AS already_reverted_count,
  COUNT(*) FILTER (
    WHERE u.id IS NOT NULL
      AND u.common_user_id IS DISTINCT FROM l.new_common_user_id
      AND u.common_user_id IS DISTINCT FROM l.old_common_user_id
  ) AS changed_by_other_count,
  COUNT(*) FILTER (WHERE u.id IS NULL) AS unrecoverable_missing_user_count
FROM ops_audit.user_link_migration_log l
LEFT JOIN public.users u ON u.id = l.tenant_user_id
WHERE l.batch_id = current_setting('app.stage2_target_batch_id')::uuid
  AND l.notes IS NULL;

-- ----------------------------------------------------------------------------
-- 2) 中止判定: 「変更済み」「復旧不能」（想定外の行）が1件でもあれば、
--    復旧可能な行のみの部分ロールバックはせず、全件を中止する。
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_batch_id  uuid := current_setting('app.stage2_target_batch_id')::uuid;
  v_changed   int;
  v_missing   int;
BEGIN
  SELECT
    COUNT(*) FILTER (
      WHERE u.id IS NOT NULL
        AND u.common_user_id IS DISTINCT FROM l.new_common_user_id
        AND u.common_user_id IS DISTINCT FROM l.old_common_user_id
    ),
    COUNT(*) FILTER (WHERE u.id IS NULL)
  INTO v_changed, v_missing
  FROM ops_audit.user_link_migration_log l
  LEFT JOIN public.users u ON u.id = l.tenant_user_id
  WHERE l.batch_id = v_batch_id
    AND l.notes IS NULL;

  IF v_changed > 0 OR v_missing > 0 THEN
    RAISE EXCEPTION
      'Rollback abort: unexpected rows found for batch_id=% (changed_by_other=%, missing_user=%). No rows were changed.',
      v_batch_id, v_changed, v_missing;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3) ロールバック本体。実際にUPDATEされた行だけをRETURNINGで取得し、
--    今回のrollback_batch_idで監査ログへ記録する（復旧済み行はWHERE句で
--    対象外のためUPDATEされず、ログにも記録されない＝冪等）。
-- ----------------------------------------------------------------------------
WITH reverted AS (
  UPDATE public.users u
  SET common_user_id = l.old_common_user_id
  FROM ops_audit.user_link_migration_log l
  WHERE u.id = l.tenant_user_id
    AND l.batch_id = current_setting('app.stage2_target_batch_id')::uuid
    AND l.notes IS NULL
    AND u.common_user_id IS NOT DISTINCT FROM l.new_common_user_id
  RETURNING u.id AS tenant_user_id, l.tenant_db, l.new_common_user_id, l.old_common_user_id
)
INSERT INTO ops_audit.user_link_migration_log
  (batch_id, tenant_db, tenant_user_id, old_common_user_id, new_common_user_id, applied_by, notes)
SELECT
  current_setting('app.stage2_rollback_batch_id')::uuid,
  reverted.tenant_db,
  reverted.tenant_user_id,
  reverted.new_common_user_id,
  reverted.old_common_user_id,
  current_user,
  format('rollback_of_batch:%s', current_setting('app.stage2_target_batch_id'))
FROM reverted;

-- ----------------------------------------------------------------------------
-- 4) 結果表示: 今回のrollback_batch_idで実際に記録された行数
--    （= 実際にUPDATEされた行数。復旧済み行は含まれない）
-- ----------------------------------------------------------------------------
SELECT
  current_setting('app.stage2_rollback_batch_id')::uuid AS rollback_batch_id,
  current_setting('app.stage2_target_batch_id')::uuid    AS target_batch_id,
  current_database()                                      AS tenant_db,
  COUNT(*)                                                AS rows_reverted_this_operation
FROM ops_audit.user_link_migration_log
WHERE batch_id = current_setting('app.stage2_rollback_batch_id')::uuid;

SELECT current_database() AS tenant_db, COUNT(*) AS remaining_linked_count
FROM public.users
WHERE common_user_id IS NOT NULL;

COMMIT;

