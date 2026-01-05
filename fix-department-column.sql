-- ========================================
-- users繝・・繝悶Ν縺ｫdepartment繧ｫ繝ｩ繝繧定ｿｽ蜉
-- 繝医・繧ｯ繝ｳ讀懆ｨｼ縺ｧdepartment縺悟盾辣ｧ縺輔ｌ繧九◆繧∝ｿ・ｦ・
-- ========================================

-- department繧ｫ繝ｩ繝繧定ｿｽ蜉
ALTER TABLE master_data.users 
  ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- 譌｢蟄倥Θ繝ｼ繧ｶ繝ｼ縺ｫ繝・ヵ繧ｩ繝ｫ繝医・department繧定ｨｭ螳・
UPDATE master_data.users 
SET department = CASE 
  WHEN role = 'system_admin' THEN '繧ｷ繧ｹ繝・Β邂｡逅・Κ'
  WHEN role = 'operation_admin' THEN '驕狗畑邂｡逅・Κ'
  ELSE '荳闊ｬ'
END
WHERE department IS NULL;

-- 遒ｺ隱阪け繧ｨ繝ｪ
SELECT id, username, role, department, created_at 
FROM master_data.users 
ORDER BY id;
