-- ============================================================================
-- Stage 2 適用後確認SQL
-- 合格条件（全件ゼロを合格条件としない。以下を別々に集計し判断する）
--   1) 監査ログ(ops_audit.user_link_migration_log)に記録された行数 =
--      common_user_id が非NULLの実績行数のうち対応表由来の行数（一致必須）
--   2) 対応表に含まれない未対応行（容認）件数を記録する（区分C/Dと未承認の区分B）
--   3) 下記A節（04_stage2_precheck.sqlのA-1〜A-5相当）を実SQLとして再実行し、
--      0件であることを確認する（コメントのみで済ませない）
--   4) 中止条件：3)のいずれかが1件でもあれば Stage3に進めない。
-- ============================================================================

-- 1) 更新件数の確認（対応表のクリーン行数と一致すること）
SELECT current_database() AS tenant_db, COUNT(*) AS linked_count
FROM public.users
WHERE common_user_id IS NOT NULL;

-- 2) 未対応行（容認。区分C/Dや未承認の区分B）
SELECT current_database() AS tenant_db, COUNT(*) AS unmapped_count
FROM public.users u
LEFT JOIN ops_audit.user_link_approved_mapping m ON m.tenant_user_id = u.id
WHERE m.tenant_user_id IS NULL AND u.common_user_id IS NULL;

-- ----------------------------------------------------------------------------
-- 3) 04_stage2_precheck.sql A節の再検査（実SQL。コメントで済ませない）
--    いずれか1件でも結果行があれば、Stage3へ進めず調査する。
-- ----------------------------------------------------------------------------

-- 3-A1) 対応表が参照するtenant_user_idが実テーブルに存在しない行
SELECT
  m.tenant_db, m.tenant_user_id, m.tenant_username, m.common_user_id,
  'mapping_references_nonexistent_user' AS error_reason
FROM ops_audit.user_link_approved_mapping m
LEFT JOIN public.users u ON u.id = m.tenant_user_id
WHERE u.id IS NULL;

-- 3-A2) 既に別のcommon_user_idへ紐付いている行
SELECT
  m.tenant_db, m.tenant_user_id, m.tenant_username,
  u.common_user_id AS current_common_user_id,
  m.common_user_id AS mapping_common_user_id,
  'already_linked_to_different_id' AS error_reason
FROM ops_audit.user_link_approved_mapping m
JOIN public.users u ON u.id = m.tenant_user_id
WHERE u.common_user_id IS NOT NULL
  AND u.common_user_id <> m.common_user_id;

-- 3-A3) 対応表内で同一common_user_idに複数のtenant_user_idが対応
SELECT
  m.tenant_db, m.common_user_id,
  COUNT(*)                    AS mapping_row_count,
  array_agg(m.tenant_user_id) AS tenant_user_ids
FROM ops_audit.user_link_approved_mapping m
GROUP BY m.tenant_db, m.common_user_id
HAVING COUNT(*) > 1;

-- 3-A4) 対応表内で同一tenant_user_idが複数のcommon_user_idに対応
SELECT
  m.tenant_db, m.tenant_user_id,
  COUNT(*)                    AS mapping_row_count,
  array_agg(m.common_user_id) AS common_user_ids
FROM ops_audit.user_link_approved_mapping m
GROUP BY m.tenant_db, m.tenant_user_id
HAVING COUNT(*) > 1;

-- 3-A5) usernameが対応表と実テーブルで一致しない行
SELECT
  m.tenant_db, m.tenant_user_id, m.tenant_username AS mapping_username,
  u.username AS current_username,
  'username_mismatch_since_approval' AS error_reason
FROM ops_audit.user_link_approved_mapping m
JOIN public.users u ON u.id = m.tenant_user_id
WHERE u.username <> m.tenant_username;

-- 4) 対応表の内容と実テーブルの一致確認（差分があれば0件のはず）
SELECT m.tenant_db, m.tenant_user_id, m.common_user_id AS mapping_value,
       u.common_user_id AS actual_value
FROM ops_audit.user_link_approved_mapping m
JOIN public.users u ON u.id = m.tenant_user_id
WHERE u.common_user_id IS DISTINCT FROM m.common_user_id;

-- 5) 監査ログとの整合確認（このバッチで記録した行が全て反映されていること）
SELECT l.batch_id, COUNT(*) AS logged_rows,
       COUNT(*) FILTER (
         WHERE u.common_user_id IS NOT DISTINCT FROM l.new_common_user_id
       ) AS reflected_rows
FROM ops_audit.user_link_migration_log l
JOIN public.users u ON u.id = l.tenant_user_id
WHERE l.notes IS NULL -- ロールバック記録(notesあり)を除く、適用ログのみ集計
GROUP BY l.batch_id
ORDER BY l.batch_id;

