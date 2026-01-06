-- 1. app_resource_routingの現在の状態
SELECT * FROM public.app_resource_routing 
WHERE physical_table IN ('machines', 'machine_types', 'managements_offices')
   OR logical_resource_name IN ('MACHINES', 'MACHINE_TYPES', 'MANAGEMENTS_OFFICES');

-- 2. machinesテーブルのデータ確認
SELECT machine_id, machine_number, machine_type_id, office_id 
FROM master_data.machines 
LIMIT 5;

-- 3. machine_typesテーブルのデータ確認
SELECT id, type_code, type_name 
FROM master_data.machine_types;

-- 4. managements_officesテーブルのデータ確認
SELECT office_id, office_name 
FROM master_data.managements_offices;
