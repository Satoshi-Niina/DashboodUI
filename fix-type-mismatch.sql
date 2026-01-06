-- 型の不一致を修正
-- 原因: machines.machine_type_id (TEXT) と machine_types.id (INTEGER) の型が一致せずJOIN失敗

-- オプション1: JOINでCASTを使用（SQLを修正）← システム側で対応
-- オプション2: DBの型を統一 ← こちらで対応

-- machine_typesテーブルにデータがないため、型変更は安全
-- machine_types.id を TEXT型に変更
ALTER TABLE master_data.machine_types 
ALTER COLUMN id TYPE TEXT;

-- デフォルト値がある場合は削除
ALTER TABLE master_data.machine_types 
ALTER COLUMN id DROP DEFAULT;

-- 確認クエリ
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'master_data'
  AND (
    (table_name = 'machines' AND column_name = 'machine_type_id')
    OR (table_name = 'machine_types' AND column_name = 'id')
    OR (table_name = 'vehicles' AND column_name = 'machine_id')
  )
ORDER BY table_name, column_name;
