# 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑丞ｮ溯｣・ｮ御ｺ・- 遒ｺ隱阪メ繧ｧ繝・け繝ｪ繧ｹ繝・

## 螳溯｣・ｮ御ｺ・律
2026蟷ｴ1譛・譌･

## 笨・螳溯｣・ｮ御ｺ・・岼

### 1. 繧ｲ繝ｼ繝医え繧ｧ繧､讖溯・・・erver.js・・
- [x] `resolveTablePath(logicalName)` - 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ隗｣豎ｺ
- [x] `dynamicSelect()` - 蜍慕噪SELECT
- [x] `dynamicInsert()` - 蜍慕噪INSERT
- [x] `dynamicUpdate()` - 蜍慕噪UPDATE
- [x] `dynamicDelete()` - 蜍慕噪DELETE
- [x] `clearRoutingCache()` - 繧ｭ繝｣繝・す繝･繧ｯ繝ｪ繧｢
- [x] 5蛻・俣繧ｭ繝｣繝・す繝･讖滓ｧ・
- [x] 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ讖溯・・・aster_data蜆ｪ蜈茨ｼ・

### 2. 螳悟・遘ｻ陦梧ｸ医∩API

#### 隱崎ｨｼ邉ｻ
- [x] `POST /api/login` - 繝ｭ繧ｰ繧､繝ｳ
- [x] `POST /api/verify-token` - 繝医・繧ｯ繝ｳ讀懆ｨｼ

#### 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・
- [x] `GET /api/users` - 繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ
- [x] `GET /api/users/:id` - 繝ｦ繝ｼ繧ｶ繝ｼ隧ｳ邏ｰ
- [x] `POST /api/users` - 繝ｦ繝ｼ繧ｶ繝ｼ霑ｽ蜉
- [x] `PUT /api/users/:id` - 繝ｦ繝ｼ繧ｶ繝ｼ譖ｴ譁ｰ
- [x] `DELETE /api/users/:id` - 繝ｦ繝ｼ繧ｶ繝ｼ蜑企勁

#### 莠区･ｭ謇繝槭せ繧ｿ
- [x] `GET /api/offices` - 莠区･ｭ謇荳隕ｧ
- [ ] `POST /api/offices` - 莠区･ｭ謇霑ｽ蜉・域悴遘ｻ陦鯉ｼ・
- [ ] `PUT /api/offices/:id` - 莠区･ｭ謇譖ｴ譁ｰ・域悴遘ｻ陦鯉ｼ・
- [ ] `DELETE /api/offices/:id` - 莠区･ｭ謇蜑企勁・域悴遘ｻ陦鯉ｼ・

#### 菫晏ｮ育畑霆翫・繧ｹ繧ｿ
- [x] `GET /api/vehicles` - 菫晏ｮ育畑霆贋ｸ隕ｧ
- [x] `GET /api/vehicles/:id` - 菫晏ｮ育畑霆願ｩｳ邏ｰ
- [x] `POST /api/vehicles` - 菫晏ｮ育畑霆願ｿｽ蜉
- [x] `PUT /api/vehicles/:id` - 菫晏ｮ育畑霆頑峩譁ｰ
- [x] `DELETE /api/vehicles/:id` - 菫晏ｮ育畑霆雁炎髯､

#### 讖溽ｨｮ繝槭せ繧ｿ
- [x] `GET /api/machine-types` - 讖溽ｨｮ荳隕ｧ
- [x] `POST /api/machine-types` - 讖溽ｨｮ霑ｽ蜉

#### 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ
- [x] `GET /api/machines` - 讖滓｢ｰ逡ｪ蜿ｷ荳隕ｧ
- [x] `POST /api/machines` - 讖滓｢ｰ逡ｪ蜿ｷ霑ｽ蜉
- [x] `PUT /api/machines/:id` - 讖滓｢ｰ逡ｪ蜿ｷ譖ｴ譁ｰ
- [x] `DELETE /api/machines/:id` - 讖滓｢ｰ逡ｪ蜿ｷ蜑企勁

---

## 搭 繝・・繝ｭ繧､蜑阪メ繧ｧ繝・け繝ｪ繧ｹ繝・

### Step 1: 繝・・繧ｿ繝吶・繧ｹ險ｭ螳・

#### 1-1. 繝・・繝悶Ν讒矩縺ｮ菫ｮ豁｣
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f migration-fix-tables.sql
```

**遒ｺ隱榊・螳ｹ:**
- `master_data.managements_offices`縺ｫ蠢・ｦ√↑繧ｫ繝ｩ繝縺瑚ｿｽ蜉縺輔ｌ縺溘°
  - postal_code, phone_number, manager_name, email
- `master_data.bases`縺ｫ蠢・ｦ√↑繧ｫ繝ｩ繝縺瑚ｿｽ蜉縺輔ｌ縺溘°
  - manager_name, capacity
- `master_data.vehicles`縺ｫ蠢・ｦ√↑繧ｫ繝ｩ繝縺瑚ｿｽ蜉縺輔ｌ縺溘°
  - model, registration_number, notes

#### 1-2. 繧ｲ繝ｼ繝医え繧ｧ繧､繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f setup-gateway-routing.sql
```

**遒ｺ隱榊・螳ｹ:**
```sql
-- 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν縺ｮ遒ｺ隱・
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui' AND is_active = true
ORDER BY logical_resource_name;
```

**譛溷ｾ・＆繧後ｋ邨先棡:**
```
logical_resource_name  | full_path                       | is_active
-----------------------+---------------------------------+-----------
app_config            | master_data.app_config          | t
app_config_history    | master_data.app_config_history  | t
bases                 | master_data.bases               | t
inspection_types      | master_data.inspection_types    | t
machine_types         | public.machine_types            | t
machines              | public.machines                 | t
managements_offices   | master_data.managements_offices | t
users                 | master_data.users               | t
vehicle_types         | master_data.vehicle_types       | t
vehicles              | master_data.vehicles            | t
```

#### 1-3. 繝・せ繝医ョ繝ｼ繧ｿ謚募・・医が繝励す繝ｧ繝ｳ・・
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f insert-test-data.sql
```

### Step 2: 迺ｰ蠅・､画焚險ｭ螳・

`.env`繝輔ぃ繧､繝ｫ繧堤｢ｺ隱阪・譖ｴ譁ｰ:

```bash
# 蠢・・ 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳID
APP_ID=dashboard-ui

# JWT隱崎ｨｼ
JWT_SECRET=your-secret-key-here

# 繝・・繧ｿ繝吶・繧ｹ謗･邯・
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=webappdb

# 縺ｾ縺溘・謗･邯壽枚蟄怜・
# DATABASE_URL=postgresql://user:password@host:5432/webappdb

# 譛ｬ逡ｪ迺ｰ蠅・ｼ・loud SQL・・
# NODE_ENV=production
# CLOUD_SQL_INSTANCE=your-project:region:instance-name
```

### Step 3: 繝ｭ繝ｼ繧ｫ繝ｫ繝・せ繝・

```bash
# 萓晏ｭ倬未菫ゅ・繧､繝ｳ繧ｹ繝医・繝ｫ
npm install

# 繧ｵ繝ｼ繝舌・襍ｷ蜍・
npm start
```

**遒ｺ隱阪・繧､繝ｳ繝・**
1. 繧ｵ繝ｼ繝舌・縺梧ｭ｣蟶ｸ縺ｫ襍ｷ蜍輔☆繧・
2. 莉･荳九・繝ｭ繧ｰ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
   ```
   [Gateway] Resolved: users 竊・master_data."users"
   [Gateway] Resolved: machine_types 竊・public."machine_types"
   [Gateway] Resolved: machines 竊・public."machines"
   ```

### Step 4: UI蜍穂ｽ懃｢ｺ隱・

#### 4-1. 繝ｭ繧ｰ繧､繝ｳ遒ｺ隱・
1. `http://localhost:3000` 縺ｫ繧｢繧ｯ繧ｻ繧ｹ
2. 繝ｭ繧ｰ繧､繝ｳ逕ｻ髱｢縺瑚｡ｨ遉ｺ縺輔ｌ繧・
3. 邂｡逅・・い繧ｫ繧ｦ繝ｳ繝医〒繝ｭ繧ｰ繧､繝ｳ
   - 繝・ヵ繧ｩ繝ｫ繝・ `admin` / `adminpass`
4. 繝繝・す繝･繝懊・繝峨′陦ｨ遉ｺ縺輔ｌ繧・

**繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ繝ｭ繧ｰ遒ｺ隱・**
```
[Login] Attempting login for username: admin
[Gateway] Cache hit: users 竊・master_data."users"
[DynamicDB] SELECT from master_data."users"
[Login] Query result: User found
```

#### 4-2. 繝ｦ繝ｼ繧ｶ繝ｼ繝槭せ繧ｿ遒ｺ隱・
1. 縲瑚ｨｭ螳夂ｮ｡逅・阪Γ繝九Η繝ｼ繧偵け繝ｪ繝・け
2. 縲後Θ繝ｼ繧ｶ繝ｼ邂｡逅・阪ち繝悶ｒ驕ｸ謚・
3. 繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

**繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ繝ｭ繧ｰ遒ｺ隱・**
```
[Gateway] Resolved: users 竊・master_data."users"
[DynamicDB] SELECT from master_data."users"
```

**遒ｺ隱埼・岼:**
- [ ] 繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 縲梧眠隕上Θ繝ｼ繧ｶ繝ｼ霑ｽ蜉縲阪・繧ｿ繝ｳ縺梧ｩ溯・縺吶ｋ
- [ ] 繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ邱ｨ髮・・蜑企勁縺悟庄閭ｽ

#### 4-3. 讖溽ｨｮ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ遒ｺ隱・
1. 縲梧ｩ溽ｨｮ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縲阪ち繝悶ｒ驕ｸ謚・
2. 讖溽ｨｮ繝槭せ繧ｿ繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
3. 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

**繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ繝ｭ繧ｰ遒ｺ隱・**
```
[Gateway] Resolved: machine_types 竊・public."machine_types"
[DynamicDB] SELECT from public."machine_types"
[Gateway] Resolved: machines 竊・public."machines"
[DynamicDB] SELECT from public."machines"
```

**遒ｺ隱埼・岼:**
- [ ] 讖溽ｨｮ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 縲梧眠隕乗ｩ溽ｨｮ霑ｽ蜉縲阪・繧ｿ繝ｳ縺梧ｩ溯・縺吶ｋ
- [ ] 讖滓｢ｰ逡ｪ蜿ｷ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 讖溽ｨｮ諠・ｱ・・ype_code, type_name・峨′讖滓｢ｰ逡ｪ蜿ｷ縺ｫ邏舌▼縺・※陦ｨ遉ｺ縺輔ｌ繧・
- [ ] 縲梧眠隕乗ｩ滓｢ｰ逡ｪ蜿ｷ霑ｽ蜉縲阪・繧ｿ繝ｳ縺梧ｩ溯・縺吶ｋ

#### 4-4. 莠区･ｭ謇繝槭せ繧ｿ遒ｺ隱・
1. 縲御ｺ区･ｭ謇繝槭せ繧ｿ縲阪ち繝悶ｒ驕ｸ謚・
2. 莠区･ｭ謇荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

**繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ繝ｭ繧ｰ遒ｺ隱・**
```
[Gateway] Resolved: managements_offices 竊・master_data."managements_offices"
[DynamicDB] SELECT from master_data."managements_offices"
```

**遒ｺ隱埼・岼:**
- [ ] 莠区･ｭ謇荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 莠区･ｭ謇繧ｳ繝ｼ繝峨∽ｺ区･ｭ謇蜷阪∝玄蛻・∽ｽ乗園縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 縲梧眠隕丈ｺ区･ｭ謇霑ｽ蜉縲阪・繧ｿ繝ｳ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

#### 4-5. 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ遒ｺ隱・
1. 縲御ｿ晏ｮ亥渕蝨ｰ繝槭せ繧ｿ縲阪ち繝悶ｒ驕ｸ謚・
2. 菫晏ｮ亥渕蝨ｰ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

**繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ繝ｭ繧ｰ遒ｺ隱・**
```
[Gateway] Resolved: bases 竊・master_data."bases"
[DynamicDB] SELECT from master_data."bases"
```

**遒ｺ隱埼・岼:**
- [ ] 菫晏ｮ亥渕蝨ｰ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 蝓ｺ蝨ｰ繧ｳ繝ｼ繝峨∝渕蝨ｰ蜷阪∵園螻樔ｺ区･ｭ謇縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 縲梧眠隕丈ｿ晏ｮ亥渕蝨ｰ霑ｽ蜉縲阪・繧ｿ繝ｳ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

#### 4-6. 菫晏ｮ育畑霆翫・繧ｹ繧ｿ遒ｺ隱・
1. 縲御ｿ晏ｮ育畑霆翫・繧ｹ繧ｿ縲阪ち繝悶ｒ驕ｸ謚・
2. 菫晏ｮ育畑霆贋ｸ隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

**繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ繝ｭ繧ｰ遒ｺ隱・**
```
[Gateway] Resolved: vehicles 竊・master_data."vehicles"
[Gateway] Resolved: machines 竊・public."machines"
[Gateway] Resolved: machine_types 竊・public."machine_types"
[Gateway] Resolved: managements_offices 竊・master_data."managements_offices"
[DynamicDB] SELECT from master_data."vehicles"
```

**遒ｺ隱埼・岼:**
- [ ] 菫晏ｮ育畑霆贋ｸ隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 霆贋ｸ｡逡ｪ蜿ｷ縲∵ｩ溽ｨｮ縲∵ｩ滓｢ｰ逡ｪ蜿ｷ縲∫ｮ｡逅・ｺ区･ｭ謇縲∬ｻ贋ｸ｡逋ｻ骭ｲ逡ｪ蜿ｷ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 縲梧眠隕剰ｻ贋ｸ｡霑ｽ蜉縲阪・繧ｿ繝ｳ縺梧ｩ溯・縺吶ｋ
- [ ] 霆贋ｸ｡縺ｮ邱ｨ髮・・蜑企勁縺悟庄閭ｽ

---

## 剥 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### 繧ｨ繝ｩ繝ｼ: "No route found for XXX"

**蜴溷屏:** `app_resource_routing`繝・・繝悶Ν縺ｫ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ諠・ｱ縺後↑縺・

**隗｣豎ｺ譁ｹ豕・**
```sql
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'XXX';
```

繧ｨ繝ｳ繝医Μ縺後↑縺・ｴ蜷医・`setup-gateway-routing.sql`繧貞ｮ溯｡後・

### 繧ｨ繝ｩ繝ｼ: "relation does not exist"

**蜴溷屏:** 繝・・繝悶Ν縺悟ｭ伜惠縺励↑縺・°縲√せ繧ｭ繝ｼ繝槫錐縺碁俣驕輔▲縺ｦ縺・ｋ

**隗｣豎ｺ譁ｹ豕・**
```sql
-- 繝・・繝悶Ν縺ｮ蟄伜惠遒ｺ隱・
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename IN ('users', 'vehicles', 'machines', 'machine_types', 'managements_offices', 'bases')
ORDER BY schemaname, tablename;
```

### 繧ｨ繝ｩ繝ｼ: "column does not exist"

**蜴溷屏:** 繧ｫ繝ｩ繝縺御ｸ崎ｶｳ縺励※縺・ｋ

**隗｣豎ｺ譁ｹ豕・**
`migration-fix-tables.sql`繧貞ｮ溯｡後＠縺ｦ縲∝ｿ・ｦ√↑繧ｫ繝ｩ繝繧定ｿｽ蜉縲・

### 繝・・繧ｿ縺瑚｡ｨ遉ｺ縺輔ｌ縺ｪ縺・

**蜴溷屏:** 繝・・繧ｿ縺悟ｭ伜惠縺励↑縺・√∪縺溘・JOIN縺梧ｭ｣縺励￥縺ｪ縺・

**隗｣豎ｺ譁ｹ豕・**
1. 蜷・ユ繝ｼ繝悶Ν縺ｫ繝・・繧ｿ縺悟ｭ伜惠縺吶ｋ縺狗｢ｺ隱・
```sql
SELECT COUNT(*) FROM master_data.users;
SELECT COUNT(*) FROM master_data.vehicles;
SELECT COUNT(*) FROM public.machines;
SELECT COUNT(*) FROM public.machine_types;
```

2. 繝・せ繝医ョ繝ｼ繧ｿ繧呈兜蜈･:
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f insert-test-data.sql
```

---

## 識 譛溷ｾ・＆繧後ｋ蜍穂ｽ・

### 繝・・繝ｭ繧､螳御ｺ・ｾ・

1. **繝ｦ繝ｼ繧ｶ繝ｼ繝槭せ繧ｿ**
   - `master_data.users`繝・・繝悶Ν縺九ｉ繝・・繧ｿ繧貞叙蠕・
   - 繧ｲ繝ｼ繝医え繧ｧ繧､邨檎罰縺ｧ`resolveTablePath('users')`縺形master_data.users`繧定ｧ｣豎ｺ
   - 荳隕ｧ陦ｨ遉ｺ縲∬ｿｽ蜉縲∫ｷｨ髮・∝炎髯､縺梧ｭ｣蟶ｸ縺ｫ蜍穂ｽ・

2. **讖溽ｨｮ繝槭せ繧ｿ**
   - `public.machine_types`繝・・繝悶Ν縺九ｉ繝・・繧ｿ繧貞叙蠕・
   - 繧ｲ繝ｼ繝医え繧ｧ繧､邨檎罰縺ｧ`resolveTablePath('machine_types')`縺形public.machine_types`繧定ｧ｣豎ｺ
   - 讖溽ｨｮ繧ｳ繝ｼ繝峨∵ｩ溽ｨｮ蜷阪√Γ繝ｼ繧ｫ繝ｼ縲√き繝・ざ繝ｪ繝ｼ縺瑚｡ｨ遉ｺ

3. **讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ**
   - `public.machines`繝・・繝悶Ν縺ｨ`public.machine_types`繧谷OIN
   - 繧ｲ繝ｼ繝医え繧ｧ繧､邨檎罰縺ｧ荳｡繝・・繝悶Ν縺ｮ繝代せ繧定ｧ｣豎ｺ
   - 讖滓｢ｰ逡ｪ蜿ｷ縺ｨ邏舌▼縺乗ｩ溽ｨｮ諠・ｱ縺瑚｡ｨ遉ｺ

4. **菫晏ｮ育畑霆翫・繧ｹ繧ｿ**
   - `master_data.vehicles`縲～public.machines`縲～public.machine_types`縲～master_data.managements_offices`繧谷OIN
   - 繧ｲ繝ｼ繝医え繧ｧ繧､邨檎罰縺ｧ蜈ｨ繝・・繝悶Ν縺ｮ繝代せ繧定ｧ｣豎ｺ
   - 霆贋ｸ｡諠・ｱ縲∵ｩ溽ｨｮ諠・ｱ縲∽ｺ区･ｭ謇諠・ｱ縺檎ｵｱ蜷郁｡ｨ遉ｺ

---

## 投 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ遒ｺ隱・

### 繧ｭ繝｣繝・す繝･蜉ｹ譫懊・遒ｺ隱・

蜷後§繝・・繝悶Ν縺ｫ2蝗槭い繧ｯ繧ｻ繧ｹ縺励◆蝣ｴ蜷・

**1蝗樒岼:**
```
[Gateway] Resolved: users 竊・master_data."users"
```

**2蝗樒岼・・蛻・ｻ･蜀・ｼ・**
```
[Gateway] Cache hit: users 竊・master_data."users"
```

繧ｭ繝｣繝・す繝･繝偵ャ繝域凾縺ｯ縲．B縺ｸ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ辣ｧ莨壹′荳崎ｦ√↑縺溘ａ鬮倬溘・

---

## 笨・譛邨ら｢ｺ隱阪メ繧ｧ繝・け繝ｪ繧ｹ繝・

繝・・繝ｭ繧､蜑阪↓莉･荳九ｒ遒ｺ隱・

- [ ] `migration-fix-tables.sql`繧貞ｮ溯｡梧ｸ医∩
- [ ] `setup-gateway-routing.sql`繧貞ｮ溯｡梧ｸ医∩
- [ ] `.env`縺ｫ`APP_ID=dashboard-ui`繧定ｨｭ螳壽ｸ医∩
- [ ] 繝ｭ繝ｼ繧ｫ繝ｫ縺ｧ繧ｵ繝ｼ繝舌・縺瑚ｵｷ蜍輔☆繧・
- [ ] 繝ｭ繧ｰ繧､繝ｳ縺ｧ縺阪ｋ
- [ ] 繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 讖溽ｨｮ繝槭せ繧ｿ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 菫晏ｮ育畑霆翫・繧ｹ繧ｿ縺瑚｡ｨ遉ｺ縺輔ｌ繧・
- [ ] 繝悶Λ繧ｦ繧ｶ繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ縺ｫ繧ｨ繝ｩ繝ｼ縺後↑縺・
- [ ] 繧ｵ繝ｼ繝舌・繝ｭ繧ｰ縺ｫ`[Gateway] Resolved:`縺瑚｡ｨ遉ｺ縺輔ｌ繧・

縺吶∋縺ｦ笨・↑繧峨√ョ繝励Ο繧､貅門ｙ螳御ｺ・〒縺呻ｼ・

---

**菴懈・譌･:** 2026蟷ｴ1譛・譌･  
**繝舌・繧ｸ繝ｧ繝ｳ:** 1.0.0  
**繧ｹ繝・・繧ｿ繧ｹ:** 螳溯｣・ｮ御ｺ・√ユ繧ｹ繝域ｺ門ｙ螳御ｺ・
