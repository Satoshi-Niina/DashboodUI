-- ========================================
-- 繝・せ繝医ョ繝ｼ繧ｿ謖ｿ蜈･繧ｹ繧ｯ繝ｪ繝励ヨ
-- 繝槭せ繧ｿ邂｡逅・ち繝門虚菴懃｢ｺ隱咲畑
-- ========================================

-- 莠区･ｭ謇繝槭せ繧ｿ縺ｮ繝・せ繝医ョ繝ｼ繧ｿ
INSERT INTO master_data.managements_offices (office_code, office_name, office_type, address, postal_code, phone_number, manager_name, email)
VALUES 
  ('OFF001', '譛ｬ遉ｾ', '譛ｬ遉ｾ', '譚ｱ莠ｬ驛ｽ蜊・ｻ｣逕ｰ蛹ｺ荳ｸ縺ｮ蜀・-1-1', '100-0005', '03-1234-5678', '螻ｱ逕ｰ螟ｪ驛・, 'yamada@example.com'),
  ('OFF002', '螟ｧ髦ｪ謾ｯ蠎・, '謾ｯ蠎・, '螟ｧ髦ｪ蠎懷､ｧ髦ｪ蟶ょ圏蛹ｺ譴・伐1-1-1', '530-0001', '06-1234-5678', '菴占陸闃ｱ蟄・, 'sato@example.com'),
  ('OFF003', '蜷榊商螻句霧讌ｭ謇', '蝟ｶ讌ｭ謇', '諢帷衍逵悟錐蜿､螻句ｸゆｸｭ譚大玄蜷埼ｧ・-1-1', '450-0002', '052-123-4567', '驤ｴ譛ｨ荳驛・, 'suzuki@example.com')
ON CONFLICT (office_code) DO NOTHING;

-- 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ縺ｮ繝・せ繝医ョ繝ｼ繧ｿ
INSERT INTO master_data.bases (base_code, base_name, office_id, location, address, postal_code, phone_number, latitude, longitude, capacity, manager_name)
VALUES 
  ('BASE001', '譚ｱ莠ｬ菫晏ｮ亥渕蝨ｰ', (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), '譚ｱ莠ｬ驛ｽ豎滓擲蛹ｺ', '譚ｱ莠ｬ驛ｽ豎滓擲蛹ｺ雎頑ｴｲ1-1-1', '135-0061', '03-9876-5432', 35.6544, 139.7963, 50, '鬮俶ｩ区ｬ｡驛・),
  ('BASE002', '螟ｧ髦ｪ菫晏ｮ亥渕蝨ｰ', (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF002'), '螟ｧ髦ｪ蠎懷､ｧ髦ｪ蟶・, '螟ｧ髦ｪ蠎懷､ｧ髦ｪ蟶り･ｿ蛹ｺ遶句｣ｲ蝣1-1-1', '550-0012', '06-9876-5432', 34.6877, 135.4959, 30, '逕ｰ荳ｭ荳蛾ヮ'),
  ('BASE003', '蜷榊商螻倶ｿ晏ｮ亥渕蝨ｰ', (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF003'), '諢帷衍逵悟錐蜿､螻句ｸ・, '諢帷衍逵悟錐蜿､螻句ｸよｸｯ蛹ｺ貂ｯ譏・-1-1', '455-0037', '052-987-6543', 35.1007, 136.8849, 40, '莨願陸蝗幃ヮ')
ON CONFLICT (base_code) DO NOTHING;

-- 讖溽ｨｮ繝槭せ繧ｿ縺ｮ繝・せ繝医ョ繝ｼ繧ｿ・・ublic schema・・
INSERT INTO public.machine_types (type_code, type_name, manufacturer, category, description)
VALUES 
  ('MT001', '蟆丞梛謗伜炎讖・, '繧ｳ繝槭ヤ', '蟒ｺ險ｭ讖滓｢ｰ', '蟆丞梛縺ｮ豐ｹ蝨ｧ繧ｷ繝ｧ繝吶Ν'),
  ('MT002', '繝繝ｳ繝励ヨ繝ｩ繝・け', '譌･驥・, '驕区成霆贋ｸ｡', '10繝医Φ繝繝ｳ繝励ヨ繝ｩ繝・け'),
  ('MT003', '繧ｯ繝ｬ繝ｼ繝ｳ霆・, '繧ｿ繝繝・, '蟒ｺ險ｭ讖滓｢ｰ', '25繝医Φ繝ｩ繝輔ち繝ｼ繧ｯ繝ｬ繝ｼ繝ｳ'),
  ('MT004', '鬮俶園菴懈･ｭ霆・, '繧｢繧､繝・, '迚ｹ谿願ｻ贋ｸ｡', '15m鬮俶園菴懈･ｭ霆・)
ON CONFLICT (type_code) DO NOTHING;

-- 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縺ｮ繝・せ繝医ョ繝ｼ繧ｿ・・ublic schema・・
INSERT INTO public.machines (machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, status, assigned_base_id, notes)
VALUES 
  ('M001', (SELECT id FROM public.machine_types WHERE type_code = 'MT001'), 'SN-001-2023', '2023-01-15', '2023-02-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE001'), '螳壽悄轤ｹ讀懈ｸ・),
  ('M002', (SELECT id FROM public.machine_types WHERE type_code = 'MT001'), 'SN-002-2023', '2023-02-20', '2023-03-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE001'), '螳壽悄轤ｹ讀懈ｸ・),
  ('M003', (SELECT id FROM public.machine_types WHERE type_code = 'MT002'), 'SN-003-2022', '2022-06-10', '2022-07-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE002'), '濶ｯ螂ｽ'),
  ('M004', (SELECT id FROM public.machine_types WHERE type_code = 'MT003'), 'SN-004-2021', '2021-11-05', '2021-12-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE003'), '螳壽悄轤ｹ讀懈ｸ・),
  ('M005', (SELECT id FROM public.machine_types WHERE type_code = 'MT004'), 'SN-005-2023', '2023-04-12', '2023-05-01', 'active', (SELECT base_id FROM master_data.bases WHERE base_code = 'BASE001'), '譁ｰ隕丞ｰ主・')
ON CONFLICT (machine_number) DO NOTHING;

-- 菫晏ｮ育畑霆翫・繧ｹ繧ｿ縺ｮ繝・せ繝医ョ繝ｼ繧ｿ
INSERT INTO master_data.vehicles (vehicle_number, machine_id, office_id, model, registration_number, notes)
VALUES 
  ('V001', (SELECT id FROM master_data.machines WHERE machine_number = 'M001'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), 'PC30MR-5', '蜩∝ｷ・123 縺・4567', '譚ｱ莠ｬ蝓ｺ蝨ｰ驟咲ｽｮ'),
  ('V002', (SELECT id FROM master_data.machines WHERE machine_number = 'M002'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), 'PC30MR-5', '蜩∝ｷ・123 縺・8901', '譚ｱ莠ｬ蝓ｺ蝨ｰ驟咲ｽｮ'),
  ('V003', (SELECT id FROM master_data.machines WHERE machine_number = 'M003'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF002'), 'DT-10T', '螟ｧ髦ｪ 456 縺・2345', '螟ｧ髦ｪ蝓ｺ蝨ｰ驟咲ｽｮ'),
  ('V004', (SELECT id FROM master_data.machines WHERE machine_number = 'M004'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF003'), 'GR-250N', '蜷榊商螻・789 縺・6789', '蜷榊商螻句渕蝨ｰ驟咲ｽｮ'),
  ('V005', (SELECT id FROM master_data.machines WHERE machine_number = 'M005'), (SELECT office_id FROM master_data.managements_offices WHERE office_code = 'OFF001'), 'AT-151', '蜩∝ｷ・321 縺・1234', '譚ｱ莠ｬ蝓ｺ蝨ｰ驟咲ｽｮ')
ON CONFLICT (vehicle_number) DO NOTHING;

-- 謖ｿ蜈･邨先棡縺ｮ遒ｺ隱・
SELECT '莠区･ｭ謇繝槭せ繧ｿ' as table_name, COUNT(*) as record_count FROM master_data.managements_offices
UNION ALL
SELECT '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ', COUNT(*) FROM master_data.bases
UNION ALL
SELECT '讖溽ｨｮ繝槭せ繧ｿ', COUNT(*) FROM master_data.machine_types
UNION ALL
SELECT '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ', COUNT(*) FROM master_data.machines
UNION ALL
SELECT '菫晏ｮ育畑霆翫・繧ｹ繧ｿ', COUNT(*) FROM master_data.vehicles;

-- 繝・・繧ｿ陦ｨ遉ｺ縺ｮ遒ｺ隱・
SELECT 
    '=== 莠区･ｭ謇荳隕ｧ ===' as info,
    office_code,
    office_name,
    office_type,
    manager_name
FROM master_data.managements_offices
ORDER BY office_id;

SELECT 
    '=== 菫晏ｮ亥渕蝨ｰ荳隕ｧ ===' as info,
    b.base_code,
    b.base_name,
    o.office_name,
    b.manager_name,
    b.capacity
FROM master_data.bases b
LEFT JOIN master_data.managements_offices o ON b.office_id = o.office_id
ORDER BY b.base_id;

SELECT 
    '=== 菫晏ｮ育畑霆贋ｸ隕ｧ ===' as info,
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
