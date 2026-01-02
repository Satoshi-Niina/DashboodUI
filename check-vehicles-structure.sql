-- 保守用車テーブルの構造確認
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- 現在のデータ確認
SELECT * FROM master_data.vehicles LIMIT 3;

-- もし machine_id や office_id カラムがない場合、追加する
-- ALTER TABLE master_data.vehicles ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES public.machines(id);
-- ALTER TABLE master_data.vehicles ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES master_data.managements_offices(office_id);

-- 統合表示のテスト
SELECT 
    v.vehicle_id,
    v.vehicle_number,
    v.vehicle_type,
    v.model,
    v.registration_number,
    m.machine_number,
    mt.type_name as machine_type_name,
    o.office_name,
    v.notes,
    v.created_at
FROM master_data.vehicles v
LEFT JOIN public.machines m ON v.machine_id = m.id
LEFT JOIN public.machine_types mt ON m.machine_type_id = mt.id
LEFT JOIN master_data.managements_offices o ON v.office_id = o.office_id
LIMIT 5;
