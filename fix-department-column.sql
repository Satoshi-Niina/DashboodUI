-- ========================================
-- usersテーブルにdepartmentカラムを追加
-- トークン検証でdepartmentが参照されるため必要
-- ========================================

-- departmentカラムを追加
ALTER TABLE master_data.users 
  ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- 既存ユーザーにデフォルトのdepartmentを設定
UPDATE master_data.users 
SET department = CASE 
  WHEN role = 'system_admin' THEN 'システム管理部'
  WHEN role = 'operation_admin' THEN '運用管理部'
  ELSE '一般'
END
WHERE department IS NULL;

-- 確認クエリ
SELECT id, username, role, department, created_at 
FROM master_data.users 
ORDER BY id;
