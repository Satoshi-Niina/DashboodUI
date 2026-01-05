-- ========================================
-- テストデータ挿入スクリプト
-- マスタ管理タブ動作確認用
-- ========================================

-- 事業所マスタのテストデータ
INSERT INTO master_data.managements_offices (office_code, office_name, office_type, address, postal_code, phone_number, manager_name, email)
VALUES 
  ('OFF001', '本社', '本社', '東京都千代田区丸の内1-1-1', '100-0005', '03-1234-5678', '山田太郎', 'yamada@example.com'),
  ('OFF002', '大阪支店', '支店', '大阪府大阪市北区梅田1-1-1', '530-0001', '06-1234-5678', '佐藤花子', 'sato@example.com'),
  ('OFF003', '名古屋営業所', '営業所', '愛知県名古屋市中村区名駅1-1-1', '450-0002', '052-123-4567', '鈴木一郎', 'suzuki@example.com')
ON CONFLICT (office_code) DO NOTHING;

-- 保守基地マスタのテストデータ
INSERT INTO master_data.bases (base_code, base_name, office_id, location, address, postal_code, phone_number, latitude, longitude, capacity, manager_name)
VALUES 
  ('BASE001', '東京保守基地', (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), '東京都江東区', '東京都江東区豊洲1-1-1', '135-0061', '03-9876-5432', 35.6544, 139.7963, 50, '高橋次郎'),
  ('BASE002', '大阪保守基地', (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF002'), '大阪府大阪市', '大阪府大阪市西区立売堀1-1-1', '550-0012', '06-9876-5432', 34.6877, 135.4959, 30, '田中三郎'),
  ('BASE003', '名古屋保守基地', (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF003'), '愛知県名古屋市', '愛知県名古屋市港区港明1-1-1', '455-0037', '052-987-6543', 35.1007, 136.8849, 40, '伊藤四郎')
ON CONFLICT (base_code) DO NOTHING;

-- 機種マスタのテストデータ（public schema）
INSERT INTO public.machine_types (type_code, type_name, manufacturer, category, description)
VALUES 
  ('MT001', '小型掘削機', 'コマツ', '建設機械', '小型の油圧ショベル'),
  ('MT002', 'ダンプトラック', '日野', '運搬車両', '10トンダンプトラック'),
  ('MT003', 'クレーン車', 'タダノ', '建設機械', '25トンラフタークレーン'),
  ('MT004', '高所作業車', 'アイチ', '特殊車両', '15m高所作業車')
ON CONFLICT (type_code) DO NOTHING;

-- 機械番号マスタのテストデータ（public schema）
INSERT INTO public.machines (machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, status, assigned_base_id, notes)
VALUES 
  ('M001', (SELECT id FROM public.machine_types WHERE type_code = 'MT001'), 'SN-001-2023', '2023-01-15', '2023-02-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE001'), '定期点検済'),
  ('M002', (SELECT id FROM public.machine_types WHERE type_code = 'MT001'), 'SN-002-2023', '2023-02-20', '2023-03-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE001'), '定期点検済'),
  ('M003', (SELECT id FROM public.machine_types WHERE type_code = 'MT002'), 'SN-003-2022', '2022-06-10', '2022-07-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE002'), '良好'),
  ('M004', (SELECT id FROM public.machine_types WHERE type_code = 'MT003'), 'SN-004-2021', '2021-11-05', '2021-12-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE003'), '定期点検済'),
  ('M005', (SELECT id FROM public.machine_types WHERE type_code = 'MT004'), 'SN-005-2023', '2023-04-12', '2023-05-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE001'), '新規導入')
ON CONFLICT (machine_number) DO NOTHING;

-- 保守用車マスタのテストデータ
INSERT INTO master_data.vehicles (vehicle_number, machine_id, office_id, model, registration_number, notes)
VALUES 
  ('V001', (SELECT id FROM master_data.machines WHERE machine_number = 'M001'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), 'PC30MR-5', '品川 123 あ 4567', '東京基地配置'),
  ('V002', (SELECT id FROM master_data.machines WHERE machine_number = 'M002'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), 'PC30MR-5', '品川 123 い 8901', '東京基地配置'),
  ('V003', (SELECT id FROM master_data.machines WHERE machine_number = 'M003'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF002'), 'DT-10T', '大阪 456 う 2345', '大阪基地配置'),
  ('V004', (SELECT id FROM master_data.machines WHERE machine_number = 'M004'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF003'), 'GR-250N', '名古屋 789 え 6789', '名古屋基地配置'),
  ('V005', (SELECT id FROM master_data.machines WHERE machine_number = 'M005'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), 'AT-151', '品川 321 お 1234', '東京基地配置')
ON CONFLICT (vehicle_number) DO NOTHING;

-- 挿入結果の確認
SELECT '事業所マスタ' as table_name, COUNT(*) as record_count FROM master_data.managements_offices
UNION ALL
SELECT '保守基地マスタ', COUNT(*) FROM master_data.bases
UNION ALL
SELECT '機種マスタ', COUNT(*) FROM master_data.machine_types
UNION ALL
SELECT '機械番号マスタ', COUNT(*) FROM master_data.machines
UNION ALL
SELECT '保守用車マスタ', COUNT(*) FROM master_data.vehicles;

-- データ表示の確認
SELECT 
    '=== 事業所一覧 ===' as info,
    office_code,
    office_name,
    office_type,
    manager_name
FROM master_data.managements_offices
ORDER BY office_id;

SELECT 
    '=== 保守基地一覧 ===' as info,
    b.base_code,
    b.base_name,
    o.office_name,
    b.manager_name,
    b.capacity
FROM master_data.bases b
LEFT JOIN master_data.managements_offices o ON b.office_id = o.office_id
ORDER BY b.base_id;

SELECT 
    '=== 保守用車一覧 ===' as info,
    v.vehicle_number,
    mt.type_name as machine_type,
    m.machine_number,
    o.office_name,
    v.registration_number
FROM master_data.vehicles v
LEFT JOIN master_data.machines m ON v.machine_id = m.id
LEFT JOIN master_data.machine_types mt ON m.machine_type_id = mt.id
LEFT JOIN master_data.managements_offices o ON v.office_id = o.office_id
ORDER BY v.vehicle_id;
