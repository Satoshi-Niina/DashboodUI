-- 繝・・繝悶Ν讒矩縺ｮ遒ｺ隱阪せ繧ｯ繝ｪ繝励ヨ

-- 1. 莠区･ｭ謇繝・・繝悶Ν
SELECT 
    'managements_offices' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'managements_offices'
ORDER BY ordinal_position;

-- 2. 菫晏ｮ亥渕蝨ｰ繝・・繝悶Ν
SELECT 
    'bases' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'bases'
ORDER BY ordinal_position;

-- 3. 菫晏ｮ育畑霆翫ユ繝ｼ繝悶Ν
SELECT 
    'vehicles' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- 4. 讖滓｢ｰ繝・・繝悶Ν・・aster_data schema・・
SELECT 
    'machines' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'machines'
ORDER BY ordinal_position;

-- 5. 讖滓｢ｰ繧ｿ繧､繝励ユ繝ｼ繝悶Ν・・aster_data schema・・
SELECT 
    'machine_types' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'machine_types'
ORDER BY ordinal_position;
