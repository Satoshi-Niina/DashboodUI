-- 既存テーブル構造の確認
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'machines'
ORDER BY ordinal_position;

SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'machine_types'
ORDER BY ordinal_position;

-- データの確認
SELECT * FROM public.machines LIMIT 5;
SELECT * FROM public.machine_types LIMIT 5;

-- 統合ビューのテスト
SELECT 
    m.id as machine_id,
    m.machine_number,
    m.serial_number,
    m.status,
    m.notes,
    mt.id as type_id,
    mt.type_code,
    mt.type_name,
    mt.manufacturer,
    mt.category,
    m.created_at,
    m.updated_at
FROM public.machines m
LEFT JOIN public.machine_types mt ON m.machine_type_id = mt.id
ORDER BY m.machine_number;
