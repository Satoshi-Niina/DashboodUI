# ========================================
# 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑丞ｮ溯｣・ぎ繧､繝・
# DashboodUI迢ｬ閾ｪ縺ｮ繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上↓繧医ｋDB謗･邯・
# ========================================

## 讎りｦ・

Emergency-Assistant縺ｮ繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上ｒ蜿り・↓縲．ashboodUI縺ｫ迢ｬ閾ｪ縺ｮ繧ｲ繝ｼ繝医え繧ｧ繧､讖溯・繧貞ｮ溯｣・＠縺ｾ縺励◆縲ゅ％繧後↓繧医ｊ縲√ユ繝ｼ繝悶Ν縺ｮ迚ｩ逅・・鄂ｮ繧定ｫ也炊蜷阪〒謚ｽ雎｡蛹悶＠縲∵沐霆溘↑DB邂｡逅・′蜿ｯ閭ｽ縺ｫ縺ｪ繧翫∪縺吶・

## 螳溯｣・・螳ｹ

### 1. 繧ｲ繝ｼ繝医え繧ｧ繧､讖溯・・・erver.js・・

莉･荳九・髢｢謨ｰ繧定ｿｽ蜉縺励∪縺励◆・・

- **resolveTablePath(logicalName)** - 隲也炊繝・・繝悶Ν蜷阪°繧臥黄逅・ヱ繧ｹ繧定ｧ｣豎ｺ
- **dynamicSelect(logicalTableName, conditions, columns, limit)** - 蜍慕噪SELECT
- **dynamicInsert(logicalTableName, data, returning)** - 蜍慕噪INSERT
- **dynamicUpdate(logicalTableName, data, conditions, returning)** - 蜍慕噪UPDATE
- **dynamicDelete(logicalTableName, conditions, returning)** - 蜍慕噪DELETE
- **clearRoutingCache(logicalName)** - 繧ｭ繝｣繝・す繝･繧ｯ繝ｪ繧｢

### 2. 荳ｻ縺ｪ迚ｹ蠕ｴ

#### 繧ｭ繝｣繝・す繝･讖滓ｧ・
- **TTL**: 5蛻・俣
- **繧ｭ繝ｼ繝輔か繝ｼ繝槭ャ繝・*: `{appId}:{logicalName}`
- 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ蜷台ｸ翫・縺溘ａ縲√Ν繝ｼ繝・ぅ繝ｳ繧ｰ諠・ｱ繧偵Γ繝｢繝ｪ繧ｭ繝｣繝・す繝･

#### 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ讖溯・
- 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺瑚ｦ九▽縺九ｉ縺ｪ縺・ｴ蜷医∬・蜍慕噪縺ｫ`master_data`繧ｹ繧ｭ繝ｼ繝槭↓繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
- 谿ｵ髫守噪縺ｪ遘ｻ陦後′蜿ｯ閭ｽ

#### 繧ｨ繝ｩ繝ｼ繝上Φ繝峨Μ繝ｳ繧ｰ
- DB謗･邯壹お繝ｩ繝ｼ譎ゅｂ螳牙・縺ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
- 隧ｳ邏ｰ縺ｪ繝ｭ繧ｰ蜃ｺ蜉帙〒蝠城｡瑚ｿｽ霍｡縺悟ｮｹ譏・

## 迺ｰ蠅・ｨｭ螳・

### 1. APP_ID縺ｮ險ｭ螳・

`.env`繝輔ぃ繧､繝ｫ縺ｫ莉･荳九ｒ霑ｽ蜉・・

```bash
APP_ID=dashboard-ui
```

縺薙・APP_ID縺ｯ`public.app_resource_routing`繝・・繝悶Ν縺ｧ菴ｿ逕ｨ縺輔ｌ縺ｾ縺吶・

### 2. 螳悟・縺ｪ.env險ｭ螳壻ｾ・

```bash
# 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳・
APP_ID=dashboard-ui
NODE_ENV=development
PORT=3000

# JWT隱崎ｨｼ
JWT_SECRET=your-secret-key-here

# CORS險ｭ螳・
CORS_ORIGIN=*

# 繝・・繧ｿ繝吶・繧ｹ謗･邯夲ｼ医Ο繝ｼ繧ｫ繝ｫ髢狗匱迺ｰ蠅・ｼ・
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password-here
DB_NAME=webappdb

# 縺ｾ縺溘・謗･邯壽枚蟄怜・繧剃ｽｿ逕ｨ
# DATABASE_URL=postgresql://user:password@localhost:5432/webappdb

# 譛ｬ逡ｪ迺ｰ蠅・ｼ・loud SQL・峨・蝣ｴ蜷・
# NODE_ENV=production
# CLOUD_SQL_INSTANCE=your-project:region:instance-name
# DB_USER=your-db-user
# DB_PASSWORD=your-db-password
# DB_NAME=webappdb
```

## 繧ｻ繝・ヨ繧｢繝・・謇矩・

### Step 1: 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡・

縺ｾ縺壹√ユ繝ｼ繝悶Ν讒矩繧剃ｿｮ豁｣縺励∪縺呻ｼ・

```bash
psql -h localhost -U postgres -d webappdb -f migration-fix-tables.sql
```

### Step 2: 繧ｲ繝ｼ繝医え繧ｧ繧､繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・

app_resource_routing繝・・繝悶Ν縺ｫ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ諠・ｱ繧呈兜蜈･・・

```bash
psql -h localhost -U postgres -d webappdb -f setup-gateway-routing.sql
```

縺薙・繧ｹ繧ｯ繝ｪ繝励ヨ縺ｯ莉･荳九ｒ陦後＞縺ｾ縺呻ｼ・
- `public.app_resource_routing`繝・・繝悶Ν縺ｮ菴懈・・亥ｭ伜惠縺励↑縺・ｴ蜷茨ｼ・
- DashboodUI逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹ｒ謚募・
- 險ｭ螳夂ｵ先棡縺ｮ遒ｺ隱・

### Step 3: 繝・せ繝医ョ繝ｼ繧ｿ謚募・・医が繝励す繝ｧ繝ｳ・・

蜍穂ｽ懃｢ｺ隱咲畑縺ｮ繧ｵ繝ｳ繝励Ν繝・・繧ｿ繧呈兜蜈･・・

```bash
psql -h localhost -U postgres -d webappdb -f insert-test-data.sql
```

### Step 4: 繧ｵ繝ｼ繝舌・襍ｷ蜍・

```bash
npm install
npm start
```

## 繝ｭ繧ｰ蜃ｺ蜉帑ｾ・

### 襍ｷ蜍墓凾

```
噫 Starting server...
笨・Pool created successfully
剥 Testing database connection...
笨・Database connected successfully at: 2026-01-03T...
[Gateway] Resolved: users 竊・master_data."users"
Server is running on http://localhost:3000
```

### 繝ｭ繧ｰ繧､繝ｳ譎・

```
[Login] Attempting login for username: admin
[Gateway] Cache hit: users 竊・master_data."users"
[DynamicDB] SELECT from master_data."users"
[Login] Query result: User found
```

### 繧ｭ繝｣繝・す繝･繝溘せ譎・

```
[Gateway] Resolved: managements_offices 竊・master_data."managements_offices"
[DynamicDB] SELECT from master_data."managements_offices"
```

### 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ譎・

```
[Gateway] No route found for some_table, falling back to master_data.some_table
```

## 遘ｻ陦梧ｸ医∩API

### 笨・螳悟・遘ｻ陦梧ｸ医∩

1. **隱崎ｨｼ邉ｻAPI**
   - `/api/login` - 繝ｭ繧ｰ繧､繝ｳ
   - `/api/verify-token` - 繝医・繧ｯ繝ｳ讀懆ｨｼ

2. **繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・PI**
   - `GET /api/users` - 繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ
   - `GET /api/users/:id` - 繝ｦ繝ｼ繧ｶ繝ｼ隧ｳ邏ｰ
   - `POST /api/users` - 繝ｦ繝ｼ繧ｶ繝ｼ霑ｽ蜉
   - `PUT /api/users/:id` - 繝ｦ繝ｼ繧ｶ繝ｼ譖ｴ譁ｰ
   - `DELETE /api/users/:id` - 繝ｦ繝ｼ繧ｶ繝ｼ蜑企勁

3. **繝槭せ繧ｿ邂｡逅・PI・井ｸ驛ｨ・・*
   - `GET /api/offices` - 莠区･ｭ謇荳隕ｧ
   - `DELETE /api/vehicles/:id` - 菫晏ｮ育畑霆雁炎髯､

### 売 莉雁ｾ後・遘ｻ陦悟ｯｾ雎｡

莉･荳九・API縺ｯ蠕捺擂縺ｮ逶ｴ謗･繧ｯ繧ｨ繝ｪ繧剃ｽｿ逕ｨ縺励※縺・∪縺呻ｼ・

1. **蜆ｪ蜈亥ｺｦ: 鬮・*
   - offices・郁ｿｽ蜉繝ｻ譖ｴ譁ｰ・・
   - bases・亥・CRUD・・
   - vehicles・郁ｿｽ蜉繝ｻ譖ｴ譁ｰ繝ｻ荳隕ｧ・・
   - machine_types・亥・CRUD・・
   - machines・亥・CRUD・・

2. **蜆ｪ蜈亥ｺｦ: 荳ｭ**
   - app_config・郁ｨｭ螳夂ｮ｡逅・ｼ・
   - app_config_history・亥ｱ･豁ｴ・・

## 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν邂｡逅・

### 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ諠・ｱ縺ｮ遒ｺ隱・

```sql
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active,
    notes
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui' AND is_active = true
ORDER BY logical_resource_name;
```

### 譁ｰ縺励＞繝・・繝悶Ν縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ霑ｽ蜉

```sql
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'new_table', 'master_data', 'new_table', '譁ｰ縺励＞繝・・繝悶Ν縺ｮ隱ｬ譏・)
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
```

### 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺ｮ辟｡蜉ｹ蛹厄ｼ亥炎髯､縺帙★縺ｫ辟｡蜉ｹ蛹厄ｼ・

```sql
UPDATE public.app_resource_routing
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'old_table';
```

### 繧ｭ繝｣繝・す繝･縺ｮ繧ｯ繝ｪ繧｢

繧ｵ繝ｼ繝舌・蛛ｴ縺ｧ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢縺吶ｋ蠢・ｦ√′縺ゅｋ蝣ｴ蜷茨ｼ・

```javascript
// 迚ｹ螳壹・繝・・繝悶Ν縺ｮ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
clearRoutingCache('users');

// 蜈ｨ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
clearRoutingCache();
```

縺ｾ縺溘・縲√し繝ｼ繝舌・繧貞・襍ｷ蜍輔☆繧後・蜈ｨ繧ｭ繝｣繝・す繝･縺後け繝ｪ繧｢縺輔ｌ縺ｾ縺吶・

## 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### Q: "No route found" 隴ｦ蜻翫′蜃ｺ繧・

**A**: `public.app_resource_routing`繝・・繝悶Ν繧堤｢ｺ隱搾ｼ・

```sql
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui' AND logical_resource_name = '繝・・繝悶Ν蜷・;
```

繧ｨ繝ｳ繝医Μ縺後↑縺・ｴ蜷医・霑ｽ蜉縺励※縺上□縺輔＞縲・

### Q: 蜿､縺・せ繧ｭ繝ｼ繝槫錐縺ｧ繧｢繧ｯ繧ｻ繧ｹ縺輔ｌ繧・

**A**: 繧ｭ繝｣繝・す繝･縺梧ｮ九▲縺ｦ縺・ｋ蜿ｯ閭ｽ諤ｧ縺後≠繧翫∪縺吶ゅし繝ｼ繝舌・繧貞・襍ｷ蜍輔＠縺ｦ縺上□縺輔＞縲・

### Q: 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ縺碁≦縺・

**A**: 莉･荳九ｒ遒ｺ隱搾ｼ・
1. 繧ｭ繝｣繝・す繝･縺梧怏蜉ｹ縺具ｼ・蛻・ｻ･蜀・↑繧・蝗樒岼莉･髯阪・繧ｭ繝｣繝・す繝･繝偵ャ繝茨ｼ・
2. `app_resource_routing`繝・・繝悶Ν縺ｫ繧､繝ｳ繝・ャ繧ｯ繧ｹ縺御ｽ懈・縺輔ｌ縺ｦ縺・ｋ縺・
3. 繝ｭ繧ｰ縺ｧ`[Gateway] Cache hit:`縺瑚｡ｨ遉ｺ縺輔ｌ縺ｦ縺・ｋ縺・

### Q: 繧ｹ繧ｭ繝ｼ繝樒ｧｻ陦後＠縺溘＞

**A**: 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν繧呈峩譁ｰ縺吶ｋ縺縺代〒縺呻ｼ・

```sql
-- 萓・ users繝・・繝悶Ν繧恥ublic繧ｹ繧ｭ繝ｼ繝槭↓遘ｻ陦・
UPDATE public.app_resource_routing
SET physical_schema = 'public', 
    updated_at = CURRENT_TIMESTAMP,
    notes = 'public繧ｹ繧ｭ繝ｼ繝槭↓遘ｻ陦・
WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'users';
```

繧ｵ繝ｼ繝舌・繧貞・襍ｷ蜍輔☆繧九°縲√く繝｣繝・す繝･TTL・・蛻・ｼ臥ｵ碁℃蠕後↓譁ｰ縺励＞繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺碁←逕ｨ縺輔ｌ縺ｾ縺吶・

## 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ

### 繝吶Φ繝√・繝ｼ繧ｯ・域耳螳夲ｼ・

- **蛻晏屓隗｣豎ｺ**: +5-10ms・・B蠕蠕ｩ縺ｧ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ蜿門ｾ暦ｼ・
- **繧ｭ繝｣繝・す繝･繝偵ャ繝・*: +0.1ms譛ｪ貅・医Γ繝｢繝ｪ蜿ら・縺ｮ縺ｿ・・
- **繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ**: +0ms・医く繝｣繝・す繝･縺輔ｌ縺溽ｵ先棡繧剃ｽｿ逕ｨ・・

### 譛驕ｩ蛹悶・繝昴う繝ｳ繝・

1. **繧ｭ繝｣繝・す繝･譛滄俣**: 繝・ヵ繧ｩ繝ｫ繝・蛻・るｻ郢√↓螟画峩縺吶ｋ蝣ｴ蜷医・遏ｭ邵ｮ縲∝ｮ牙ｮ壹＠縺ｦ縺・ｋ蝣ｴ蜷医・蟒ｶ髟ｷ蜿ｯ閭ｽ
2. **繧､繝ｳ繝・ャ繧ｯ繧ｹ**: `app_resource_routing`繝・・繝悶Ν縺ｮ讀懃ｴ｢繧､繝ｳ繝・ャ繧ｯ繧ｹ縺碁㍾隕・
3. **繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ**: 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹ｒ豁｣縺励￥陦後∴縺ｰ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縺ｯ荳崎ｦ・

## 莉雁ｾ後・諡｡蠑ｵ

### 隍・焚繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ蟇ｾ蠢・

縺薙・繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上・縲∽ｻ悶・繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ・・mergency縲｝lanning縲‘quipment縲’ailure・峨〒繧ゆｽｿ逕ｨ縺ｧ縺阪∪縺呻ｼ・

```javascript
// 蜷・い繝励Μ縺ｮAPP_ID繧定ｨｭ螳・
const APP_ID = process.env.APP_ID || 'emergency-assistance'; // 縺ｾ縺溘・ 'planning', 'equipment' 縺ｪ縺ｩ
```

### 繧ｹ繧ｭ繝ｼ繝樊ｨｩ髯千ｮ｡逅・

迚ｹ螳壹・繧｢繝励Μ縺ｫ迚ｹ螳壹・繧ｹ繧ｭ繝ｼ繝槭∈縺ｮ繧｢繧ｯ繧ｻ繧ｹ縺ｮ縺ｿ險ｱ蜿ｯ縺吶ｋ蝣ｴ蜷茨ｼ・

```sql
-- dashboard-ui縺ｯmaster_data縺ｨpublic縺ｮ縺ｿ
-- emergency-assistance縺ｯemergency繧ｹ繧ｭ繝ｼ繝槭ｂ菴ｿ逕ｨ蜿ｯ閭ｽ
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('emergency-assistance', 'emergency_cases', 'emergency', 'cases');
```

### 蜍慕噪讓ｩ髯舌メ繧ｧ繝・け

蟆・擂逧・↓縺ｯ縲√Ν繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν縺ｫ讓ｩ髯先ュ蝣ｱ繧定ｿｽ蜉縺励√Ο繝ｼ繝ｫ繝吶・繧ｹ縺ｮ繧｢繧ｯ繧ｻ繧ｹ蛻ｶ蠕｡繧ょ庄閭ｽ・・

```sql
ALTER TABLE public.app_resource_routing 
ADD COLUMN required_role VARCHAR(20);

-- 邂｡逅・・・縺ｿ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ縺ｪ繝・・繝悶Ν
UPDATE public.app_resource_routing
SET required_role = 'admin'
WHERE logical_resource_name IN ('users', 'app_config');
```

## 蜿り・ｳ・侭

- [Emergency-Assistance DB_GATEWAY_MIGRATION_STATUS.md](../Emergency-Assistance-google/docs/DB_GATEWAY_MIGRATION_STATUS.md) - 蜿り・↓縺励◆繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上・螳溯｣・ｱ蜻・
- [migration-fix-tables.sql](migration-fix-tables.sql) - 繝・・繝悶Ν讒矩菫ｮ豁｣繧ｹ繧ｯ繝ｪ繝励ヨ
- [setup-gateway-routing.sql](setup-gateway-routing.sql) - 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹せ繧ｯ繝ｪ繝励ヨ
- [insert-test-data.sql](insert-test-data.sql) - 繝・せ繝医ョ繝ｼ繧ｿ謚募・繧ｹ繧ｯ繝ｪ繝励ヨ

## 縺ｾ縺ｨ繧・

### 笨・螳溯｣・ｮ御ｺ・

- 繧ｲ繝ｼ繝医え繧ｧ繧､讖溯・縺ｮ螳溯｣・ｼ・esolveTablePath縲‥ynamicSelect/Insert/Update/Delete・・
- 隱崎ｨｼ邉ｻAPI縺ｮ遘ｻ陦・
- 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・PI縺ｮ遘ｻ陦・
- 荳驛ｨ繝槭せ繧ｿ邂｡逅・PI縺ｮ遘ｻ陦・
- 繧ｭ繝｣繝・す繝･讖滓ｧ九・螳溯｣・
- 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ讖溯・縺ｮ螳溯｣・

### 識 譛溷ｾ・＆繧後ｋ蜉ｹ譫・

- **菫晏ｮ域ｧ蜷台ｸ・*: 繝・・繝悶Ν縺ｮ迚ｩ逅・・鄂ｮ螟画峩縺後さ繝ｼ繝峨↓蠖ｱ髻ｿ縺励↑縺・
- **譟碑ｻ滓ｧ**: 繧ｹ繧ｭ繝ｼ繝樒ｧｻ陦後′螳ｹ譏難ｼ医Ν繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν縺ｮ縺ｿ譖ｴ譁ｰ・・
- **繧ｻ繧ｭ繝･繝ｪ繝・ぅ**: 繧ｹ繧ｭ繝ｼ繝槫錐縺ｮ繝上・繝峨さ繝ｼ繝峨ｒ謗帝勁
- **驕狗畑諤ｧ**: 隲也炊蜷阪・繝ｼ繧ｹ縺ｧ繧｢繧ｯ繧ｻ繧ｹ蛻ｶ蠕｡縺悟庄閭ｽ
- **繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ**: 繧ｭ繝｣繝・す繝･縺ｫ繧医ｊ鬮倬溘↑繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ隗｣豎ｺ

### 搭 莉雁ｾ後・隱ｲ鬘・

- 谿九ｊ縺ｮAPI・・ffices縲｜ases縲」ehicles縺ｮCRUD・峨・谿ｵ髫守噪遘ｻ陦・
- 隍・尅縺ｪJOIN繧ｯ繧ｨ繝ｪ縺ｮ繧ｲ繝ｼ繝医え繧ｧ繧､蟇ｾ蠢・
- 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ逶｣隕悶→繝√Η繝ｼ繝九Φ繧ｰ
- 譛ｬ逡ｪ迺ｰ蠅・〒縺ｮ髟ｷ譛滄°逕ｨ讀懆ｨｼ

---

**螳溯｣・律**: 2026蟷ｴ1譛・譌･  
**繝舌・繧ｸ繝ｧ繝ｳ**: 1.0.0  
**繧ｹ繝・・繧ｿ繧ｹ**: Phase 1螳御ｺ・￣hase 2遘ｻ陦御ｸｭ
