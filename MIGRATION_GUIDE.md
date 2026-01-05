# 繝槭せ繧ｿ邂｡逅・ち繝悶・菫ｮ豁｣繧ｬ繧､繝・

## 讎りｦ・
莠区･ｭ謇繝槭せ繧ｿ縲∽ｿ晏ｮ亥渕蝨ｰ繝槭せ繧ｿ縲∽ｿ晏ｮ育畑霆翫・繧ｹ繧ｿ縺ｮ繧ｿ繝悶〒繝・・繧ｿ縺瑚｡ｨ遉ｺ縺輔ｌ縺ｪ縺・撫鬘後ｒ菫ｮ豁｣縺励∪縺吶・

## 蝠城｡後・蜴溷屏
- `master_data.managements_offices`繝・・繝悶Ν縺ｫ蠢・ｦ√↑繧ｫ繝ｩ繝・・ostal_code縲｝hone_number縲［anager_name縲‘mail・峨′荳崎ｶｳ
- `master_data.bases`繝・・繝悶Ν縺ｫ蠢・ｦ√↑繧ｫ繝ｩ繝・・anager_name縲…apacity・峨′荳崎ｶｳ
- `master_data.vehicles`繝・・繝悶Ν縺ｫ蠢・ｦ√↑繧ｫ繝ｩ繝・・odel縲〉egistration_number縲］otes・峨′荳崎ｶｳ

## 菫ｮ豁｣蜀・ｮｹ
`migration-fix-tables.sql`繧呈峩譁ｰ縺励∽ｻ･荳九・繧ｫ繝ｩ繝繧定ｿｽ蜉縺励∪縺励◆・・

### managements_offices 繝・・繝悶Ν
- postal_code (VARCHAR(20))
- phone_number (VARCHAR(20))
- manager_name (VARCHAR(100))
- email (VARCHAR(100))

### bases 繝・・繝悶Ν
- manager_name (VARCHAR(100))
- capacity (INTEGER)

### vehicles 繝・・繝悶Ν
- model (VARCHAR(50))
- registration_number (VARCHAR(50))
- notes (TEXT)

## 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡梧焔鬆・

### 譁ｹ豕・: psql繧ｳ繝槭Φ繝峨〒螳溯｡鯉ｼ域耳螂ｨ・・

```bash
# Cloud SQL縺ｫ謗･邯・
psql "host=/cloudsql/YOUR_INSTANCE_CONNECTION_NAME dbname=webappdb user=YOUR_DB_USER"

# 縺ｾ縺溘・縲√Ο繝ｼ繧ｫ繝ｫ迺ｰ蠅・・蝣ｴ蜷・
psql -h localhost -U YOUR_DB_USER -d webappdb

# 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ繧貞ｮ溯｡・
\i migration-fix-tables.sql
```

### 譁ｹ豕・: PowerShell縺九ｉ螳溯｡・

```powershell
# 繝・・繧ｿ繝吶・繧ｹ謗･邯壽ュ蝣ｱ繧定ｨｭ螳・
$env:PGPASSWORD = "YOUR_DB_PASSWORD"

# 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡・
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f migration-fix-tables.sql
```

### 譁ｹ豕・: pgAdmin遲峨・GUI繝・・繝ｫ縺ｧ螳溯｡・

1. pgAdmin縺ｾ縺溘・DBeaver遲峨・繝・・繧ｿ繝吶・繧ｹ繝・・繝ｫ繧帝幕縺・
2. `webappdb`繝・・繧ｿ繝吶・繧ｹ縺ｫ謗･邯・
3. `migration-fix-tables.sql`繝輔ぃ繧､繝ｫ繧帝幕縺・
4. 蜈ｨ菴薙ｒ驕ｸ謚槭＠縺ｦ螳溯｡・

### 譁ｹ豕・: Cloud SQL Studio縺ｧ螳溯｡・

1. Google Cloud Console縺ｧCloud SQL Studio繧帝幕縺・
2. `webappdb`繝・・繧ｿ繝吶・繧ｹ繧帝∈謚・
3. `migration-fix-tables.sql`縺ｮ蜀・ｮｹ繧偵け繧ｨ繝ｪ繧ｨ繝・ぅ繧ｿ縺ｫ雋ｼ繧贋ｻ倥￠
4. 螳溯｡・

## 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡悟ｾ後・遒ｺ隱・

繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡悟ｾ後∽ｻ･荳九・繧ｯ繧ｨ繝ｪ縺ｧ繝・・繝悶Ν讒矩繧堤｢ｺ隱阪〒縺阪∪縺呻ｼ・

```sql
-- managements_offices 繝・・繝悶Ν縺ｮ遒ｺ隱・
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'managements_offices'
ORDER BY ordinal_position;

-- bases 繝・・繝悶Ν縺ｮ遒ｺ隱・
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'bases'
ORDER BY ordinal_position;

-- vehicles 繝・・繝悶Ν縺ｮ遒ｺ隱・
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'vehicles'
ORDER BY ordinal_position;
```

## 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮ蜀崎ｵｷ蜍・

繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡悟ｾ後√い繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ繧貞・襍ｷ蜍輔＠縺ｦ縺上□縺輔＞・・

```bash
# 繧ｵ繝ｼ繝舌・繧貞・襍ｷ蜍・
npm start
```

縺ｾ縺溘・縲∵里縺ｫ襍ｷ蜍穂ｸｭ縺ｮ蝣ｴ蜷医・Ctrl+C縺ｧ蛛懈ｭ｢縺励※縺九ｉ蜀榊ｺｦ襍ｷ蜍輔＠縺ｦ縺上□縺輔＞縲・

## 蜍穂ｽ懃｢ｺ隱・

1. 繝悶Λ繧ｦ繧ｶ縺ｧ邂｡逅・判髱｢縺ｫ繧｢繧ｯ繧ｻ繧ｹ・・ttp://localhost:3000/admin.html・・
2. 縲御ｺ区･ｭ謇繝槭せ繧ｿ縲阪ち繝悶ｒ繧ｯ繝ｪ繝・け
   - 莠区･ｭ謇縺ｮ繝ｪ繧ｹ繝医′陦ｨ遉ｺ縺輔ｌ繧九％縺ｨ繧堤｢ｺ隱・
   - 縲梧眠隕丈ｺ区･ｭ謇霑ｽ蜉縲阪・繧ｿ繝ｳ縺ｧ霑ｽ蜉縺ｧ縺阪ｋ縺薙→繧堤｢ｺ隱・
3. 縲御ｿ晏ｮ亥渕蝨ｰ繝槭せ繧ｿ縲阪ち繝悶ｒ繧ｯ繝ｪ繝・け
   - 菫晏ｮ亥渕蝨ｰ縺ｮ繝ｪ繧ｹ繝医′陦ｨ遉ｺ縺輔ｌ繧九％縺ｨ繧堤｢ｺ隱・
   - 縲梧眠隕丈ｿ晏ｮ亥渕蝨ｰ霑ｽ蜉縲阪・繧ｿ繝ｳ縺ｧ霑ｽ蜉縺ｧ縺阪ｋ縺薙→繧堤｢ｺ隱・
4. 縲御ｿ晏ｮ育畑霆翫・繧ｹ繧ｿ縲阪ち繝悶ｒ繧ｯ繝ｪ繝・け
   - 菫晏ｮ育畑霆翫・繝ｪ繧ｹ繝医′陦ｨ遉ｺ縺輔ｌ繧九％縺ｨ繧堤｢ｺ隱・
   - 縲梧眠隕剰ｻ贋ｸ｡霑ｽ蜉縲阪・繧ｿ繝ｳ縺ｧ霑ｽ蜉縺ｧ縺阪ｋ縺薙→繧堤｢ｺ隱・

## 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### 繝・・繧ｿ縺瑚｡ｨ遉ｺ縺輔ｌ縺ｪ縺・ｴ蜷・

1. 繝悶Λ繧ｦ繧ｶ縺ｮ髢狗匱閠・ヤ繝ｼ繝ｫ・・12・峨ｒ髢九￥
2. Console繧ｿ繝悶〒繧ｨ繝ｩ繝ｼ繝｡繝・そ繝ｼ繧ｸ繧堤｢ｺ隱・
3. Network繧ｿ繝悶〒 `/api/offices`縲～/api/bases`縲～/api/vehicles` 縺ｮ繝ｬ繧ｹ繝昴Φ繧ｹ繧堤｢ｺ隱・

### 繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘☆繧句ｴ蜷・

1. 繧ｵ繝ｼ繝舌・繝ｭ繧ｰ繧堤｢ｺ隱搾ｼ医ち繝ｼ繝溘リ繝ｫ縺ｫ陦ｨ遉ｺ縺輔ｌ繧具ｼ・
2. 繝・・繧ｿ繝吶・繧ｹ謗･邯壽ュ蝣ｱ縺梧ｭ｣縺励＞縺狗｢ｺ隱搾ｼ・.env`繝輔ぃ繧､繝ｫ・・
3. 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ縺梧ｭ｣縺励￥螳溯｡後＆繧後◆縺狗｢ｺ隱・

### 螟夜Κ繧ｭ繝ｼ蛻ｶ邏・お繝ｩ繝ｼ縺檎匱逕溘☆繧句ｴ蜷・

譌｢蟄倥ョ繝ｼ繧ｿ縺ｫ荳肴紛蜷医′縺ゅｋ蝣ｴ蜷医∽ｻ･荳九・繧ｯ繧ｨ繝ｪ縺ｧ繝√ぉ繝・け・・

```sql
-- vehicles繝・・繝悶Ν縺ｧ辟｡蜉ｹ縺ｪmachine_id繧偵メ繧ｧ繝・け
SELECT v.vehicle_id, v.machine_id
FROM master_data.vehicles v
LEFT JOIN public.machines m ON v.machine_id = m.id
WHERE v.machine_id IS NOT NULL AND m.id IS NULL;

-- vehicles繝・・繝悶Ν縺ｧ辟｡蜉ｹ縺ｪoffice_id繧偵メ繧ｧ繝・け
SELECT v.vehicle_id, v.office_id
FROM master_data.vehicles v
LEFT JOIN master_data.managements_offices o ON v.office_id = o.office_id
WHERE v.office_id IS NOT NULL AND o.office_id IS NULL;

-- bases繝・・繝悶Ν縺ｧ辟｡蜉ｹ縺ｪoffice_id繧偵メ繧ｧ繝・け
SELECT b.base_id, b.office_id
FROM master_data.bases b
LEFT JOIN master_data.managements_offices o ON b.office_id = o.office_id
WHERE b.office_id IS NOT NULL AND o.office_id IS NULL;
```

荳肴紛蜷医′隕九▽縺九▲縺溷ｴ蜷医∽ｻ･荳九・繧ｯ繧ｨ繝ｪ縺ｧ菫ｮ豁｣・・

```sql
-- 辟｡蜉ｹ縺ｪ蜿ら・繧誰ULL縺ｫ險ｭ螳・
UPDATE master_data.vehicles
SET machine_id = NULL
WHERE machine_id NOT IN (SELECT id FROM public.machines);

UPDATE master_data.vehicles
SET office_id = NULL
WHERE office_id NOT IN (SELECT office_id FROM master_data.managements_offices);

UPDATE master_data.bases
SET office_id = NULL
WHERE office_id NOT IN (SELECT office_id FROM master_data.managements_offices);
```

## 繧ｵ繝昴・繝・

蝠城｡後′隗｣豎ｺ縺励↑縺・ｴ蜷医・縲∽ｻ･荳九・諠・ｱ繧呈署萓帙＠縺ｦ縺上□縺輔＞・・
- 繝悶Λ繧ｦ繧ｶ縺ｮ髢狗匱閠・ヤ繝ｼ繝ｫ縺ｮ繧ｨ繝ｩ繝ｼ繝｡繝・そ繝ｼ繧ｸ
- 繧ｵ繝ｼ繝舌・繝ｭ繧ｰ縺ｮ繧ｨ繝ｩ繝ｼ繝｡繝・そ繝ｼ繧ｸ
- 螳溯｡後＠縺溘・繧､繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳSQL縺ｮ邨先棡
