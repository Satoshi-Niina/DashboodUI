-- ============================================================================
-- Stage 2 事前確認SQL（更新対象の事前表示・エラー検知。書き込みなし）
-- 前提: 01_approval_table_template.md の ops_audit.user_link_approved_mapping
--       に、承認済みの対応（区分A・区分Bのみ）がインポート済みであること。
-- 実行方式: SELECT のみ。
-- 使い方: このSQLの出力を運用者が確認し、error_reason が1件でもあれば
--         Stage2適用SQL(05_stage2_apply.sql)は実行しない。
-- 注意: このSQLは「事前の目視確認」用であり、実際の安全性は
--       05_stage2_apply.sql が適用直前に同じ検査を再実行することで担保する
--       （事前確認から適用までの間にデータが変化した場合でも、適用SQL側で
--       検知して全件中止する。事前確認の結果だけに依存しない）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. エラー行の検出（更新せず報告のみ）
-- ----------------------------------------------------------------------------

-- A-1. 対応表(mapping)が参照する tenant_user_id が実テーブルに存在しない行
--      （「対応表にない行」＝対応表の内容が実データと整合しない行）
SELECT
  m.tenant_db, m.tenant_user_id, m.tenant_username, m.common_user_id,
  'mapping_references_nonexistent_user' AS error_reason
FROM ops_audit.user_link_approved_mapping m
LEFT JOIN public.users u ON u.id = m.tenant_user_id
WHERE u.id IS NULL;

-- A-2. 既に別のcommon_user_idへ紐付いている行（上書きしない）
SELECT
  m.tenant_db, m.tenant_user_id, m.tenant_username,
  u.common_user_id AS current_common_user_id,
  m.common_user_id AS mapping_common_user_id,
  'already_linked_to_different_id' AS error_reason
FROM ops_audit.user_link_approved_mapping m
JOIN public.users u ON u.id = m.tenant_user_id
WHERE u.common_user_id IS NOT NULL
  AND u.common_user_id <> m.common_user_id;

-- A-3. 対応表内で同一common_user_idに複数のtenant_user_idが対応している行
--      （ステージングテーブルのUNIQUE制約を回避して入った場合の再検知）
SELECT
  m.tenant_db, m.common_user_id,
  COUNT(*)                         AS mapping_row_count,
  array_agg(m.tenant_user_id)      AS tenant_user_ids
FROM ops_audit.user_link_approved_mapping m
GROUP BY m.tenant_db, m.common_user_id
HAVING COUNT(*) > 1;

-- A-4. 対応表内で同一tenant_user_idが複数のcommon_user_idに対応している行
SELECT
  m.tenant_db, m.tenant_user_id,
  COUNT(*)                    AS mapping_row_count,
  array_agg(m.common_user_id) AS common_user_ids
FROM ops_audit.user_link_approved_mapping m
GROUP BY m.tenant_db, m.tenant_user_id
HAVING COUNT(*) > 1;

-- A-5. usernameが対応表と実テーブルで一致しない行（対応表作成後にusernameが
--      変更された等、対応表の前提条件が崩れている疑い。エラーとして報告）
SELECT
  m.tenant_db, m.tenant_user_id, m.tenant_username AS mapping_username,
  u.username AS current_username,
  'username_mismatch_since_approval' AS error_reason
FROM ops_audit.user_link_approved_mapping m
JOIN public.users u ON u.id = m.tenant_user_id
WHERE u.username <> m.tenant_username;

-- ----------------------------------------------------------------------------
-- B. 更新対象の事前表示（クリーンな行のみ。上記A-1〜A-5に該当しない行）
-- ----------------------------------------------------------------------------
WITH clean_mapping AS (
  SELECT m.*
  FROM ops_audit.user_link_approved_mapping m
  JOIN public.users u ON u.id = m.tenant_user_id
  WHERE u.username = m.tenant_username
    AND (u.common_user_id IS NULL OR u.common_user_id = m.common_user_id)
    AND m.tenant_user_id NOT IN (
      SELECT tenant_user_id FROM ops_audit.user_link_approved_mapping
      GROUP BY tenant_db, tenant_user_id HAVING COUNT(*) > 1
    )
    AND m.common_user_id NOT IN (
      SELECT common_user_id FROM ops_audit.user_link_approved_mapping
      GROUP BY tenant_db, common_user_id HAVING COUNT(*) > 1
    )
)
SELECT
  cm.tenant_db, cm.tenant_user_id, cm.tenant_username, cm.common_user_id, cm.category,
  CASE WHEN u.common_user_id IS NULL THEN 'will_update'
       ELSE 'already_up_to_date_noop' END AS action
FROM clean_mapping cm
JOIN public.users u ON u.id = cm.tenant_user_id
ORDER BY cm.category, cm.tenant_username;

-- ----------------------------------------------------------------------------
-- C. 参考: 対応表に含まれない既存ユーザー（区分C/D、または未承認の区分B）
--    これはエラーではなく「今回は移行しない」対象として報告するのみ。
-- ----------------------------------------------------------------------------
SELECT
  current_database() AS tenant_db, u.id AS tenant_user_id, u.username,
  u.common_user_id, 'not_in_approved_mapping_no_action' AS info
FROM public.users u
LEFT JOIN ops_audit.user_link_approved_mapping m ON m.tenant_user_id = u.id
WHERE m.tenant_user_id IS NULL;
