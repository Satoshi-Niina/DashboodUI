-- ORDER BY type_code エラーを防ぐため、NULLSを最後にする

-- type_code に NOT NULL 制約を追加する前に、NULL値を修正
UPDATE master_data.machine_types 
SET type_code = 'MT' || LPAD(id::TEXT, 4, '0')
WHERE type_code IS NULL;

-- 確認
SELECT id, type_code, type_name 
FROM master_data.machine_types 
ORDER BY type_code NULLS LAST;
