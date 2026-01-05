# 繧ｲ繝ｼ繝医え繧ｧ繧､繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壽焔鬆・

## 搭 讎りｦ・

縺吶∋縺ｦ縺ｮ繧ｵ繝悶い繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ・・mergency-client, planning, equipment, failure・峨′蜈ｱ騾壹・繧ｹ繧ｿ繝・・繝悶Ν縺ｫ繧｢繧ｯ繧ｻ繧ｹ縺ｧ縺阪ｋ繧医≧縲√ご繝ｼ繝医え繧ｧ繧､繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧定ｨｭ螳壹＠縺ｾ縺吶・

## 識 逶ｮ逧・

1. **蜈ｬ髢九せ繧ｭ繝ｼ繝槭・邂｡逅・ユ繝ｼ繝悶Ν譖ｴ譁ｰ**: `public.app_resource_routing` 縺ｫ蜈ｨ繧｢繝励Μ縺ｮ險ｭ螳壹ｒ逋ｻ骭ｲ
2. **蜷・い繝励Μ縺九ｉ縺ｮ繧｢繧ｯ繧ｻ繧ｹ險ｭ螳・*: 蜷・い繝励Μ縺・`master_data` 繧ｹ繧ｭ繝ｼ繝槭・蜈ｱ騾壹・繧ｹ繧ｿ縺ｫ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ縺ｫ縺吶ｋ

---

## 投 迴ｾ蝨ｨ縺ｮ迥ｶ豕・

### 笨・螳御ｺ・ｸ医∩
- 笨・讖溽ｨｮ繝槭せ繧ｿ・・achine_types・峨ｒ `public` 竊・`master_data` 縺ｫ遘ｻ陦・
- 笨・讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ・・achines・峨ｒ `public` 竊・`master_data` 縺ｫ遘ｻ陦・
- 笨・DashboardUI 縺ｮ `app_resource_routing` 繧呈峩譁ｰ

### 笞・・蠢・ｦ√↑菴懈･ｭ
- 笞・・Emergency-Client 縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
- 笞・・Planning 縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
- 笞・・Equipment 縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
- 笞・・Failure 縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・

---

## 噫 螳溯｡梧焔鬆・

### 繧ｹ繝・ャ繝・: 蜈ｨ繧｢繝励Μ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹ｒ霑ｽ蜉

```powershell
# 繝ｭ繝ｼ繧ｫ繝ｫ迺ｰ蠅・・蝣ｴ蜷・
$env:PGPASSWORD = "Takabeni"
psql -h localhost -U postgres -d webappdb -f setup-all-apps-routing.sql
```

縺ｾ縺溘・

```powershell
# Cloud SQL縺ｮ蝣ｴ蜷・
$env:PGPASSWORD = "繝代せ繝ｯ繝ｼ繝・
psql -h <host> -U <user> -d webappdb -f setup-all-apps-routing.sql
```

縺薙・繧ｹ繧ｯ繝ｪ繝励ヨ縺ｯ莉･荳九ｒ螳溯｡後＠縺ｾ縺呻ｼ・
- emergency-client 逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
- planning 逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
- equipment 逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
- failure 逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
- 蜈ｨ繧｢繝励Μ縺ｮ險ｭ螳夂｢ｺ隱阪け繧ｨ繝ｪ

### 繧ｹ繝・ャ繝・: 蜷・い繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮ蜀崎ｵｷ蜍・

繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢縺吶ｋ縺溘ａ縲∝・繧｢繝励Μ繧貞・襍ｷ蜍輔＠縺ｦ縺上□縺輔＞・・

```powershell
# DashboardUI
pm2 restart dashboard-ui

# Emergency-Client
pm2 restart emergency-client

# 縺昴・莉悶・繧｢繝励Μ・域ｺ門ｙ縺後〒縺阪◆繧会ｼ・
pm2 restart planning
pm2 restart equipment
pm2 restart failure
```

### 繧ｹ繝・ャ繝・: 蜍穂ｽ懃｢ｺ隱・

蜷・い繝励Μ縺ｧ莉･荳九ｒ遒ｺ隱搾ｼ・

1. **繝ｭ繧ｰ繧､繝ｳ讖溯・**: `master_data.users` 繝・・繝悶Ν縺ｸ縺ｮ繧｢繧ｯ繧ｻ繧ｹ
2. **繝槭せ繧ｿ繝・・繧ｿ陦ｨ遉ｺ**: 莠区･ｭ謇縲∽ｿ晏ｮ亥渕蝨ｰ縲∬ｻ贋ｸ｡縲∵ｩ溽ｨｮ縲∵ｩ滓｢ｰ逡ｪ蜿ｷ
3. **繧ｨ繝ｩ繝ｼ繝ｭ繧ｰ**: 繧ｹ繧ｭ繝ｼ繝槫盾辣ｧ繧ｨ繝ｩ繝ｼ縺後↑縺・°遒ｺ隱・

---

## 投 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壻ｸ隕ｧ

### 蜈ｱ騾壹・繧ｹ繧ｿ・亥・繧｢繝励Μ縺ｧ蜈ｱ譛会ｼ・

| 隲也炊繝ｪ繧ｽ繝ｼ繧ｹ蜷・| 迚ｩ逅・ヱ繧ｹ | 隱ｬ譏・| 菴ｿ逕ｨ繧｢繝励Μ |
|---|---|---|---|
| `users` | `master_data.users` | 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・| 蜈ｨ繧｢繝励Μ |
| `managements_offices` | `master_data.managements_offices` | 莠区･ｭ謇繝槭せ繧ｿ | 蜈ｨ繧｢繝励Μ |
| `bases` | `master_data.bases` | 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ | 蜈ｨ繧｢繝励Μ |
| `vehicles` | `master_data.vehicles` | 菫晏ｮ育畑霆翫・繧ｹ繧ｿ | 蜈ｨ繧｢繝励Μ |
| `machine_types` | `master_data.machine_types` | 讖溽ｨｮ繝槭せ繧ｿ | 蜈ｨ繧｢繝励Μ |
| `machines` | `master_data.machines` | 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ | 蜈ｨ繧｢繝励Μ |

### 繧｢繝励Μ蟆ら畑繝・・繝悶Ν

#### Emergency-Client
- `emergency_records` 竊・`emergency.emergency_records`

#### Planning
- `schedules` 竊・`operations.schedules`
- `operation_records` 竊・`operations.operation_records`

#### Equipment
- `inspection_records` 竊・`inspections.inspection_records`
- `inspection_types` 竊・`master_data.inspection_types`

#### Failure
- `fault_records` 竊・`maintenance.fault_records`

---

## 肌 蜷・い繝励Μ蛛ｴ縺ｮ螳溯｣・ｦ∽ｻｶ

### 蠢・ｦ√↑險ｭ螳夲ｼ亥推繧｢繝励Μ縺ｮserver.js・・

蜷・し繝悶い繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｧ莉･荳九・螳溯｣・′蠢・ｦ√〒縺呻ｼ・

```javascript
// 1. APP_ID縺ｮ螳夂ｾｩ
const APP_ID = 'emergency-client'; // 繧｢繝励Μ縺斐→縺ｫ螟画峩

// 2. resolveTablePath髢｢謨ｰ縺ｮ螳溯｣・ｼ・ashboardUI縺ｨ蜷後§・・
async function resolveTablePath(logicalName) {
  const cacheKey = `${APP_ID}:${logicalName}`;
  
  // 繧ｭ繝｣繝・す繝･繝√ぉ繝・け
  const cached = routingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached;
  }

  try {
    // app_resource_routing繝・・繝悶Ν縺九ｉ迚ｩ逅・ヱ繧ｹ繧貞叙蠕・
    const query = `
      SELECT physical_schema, physical_table
      FROM public.app_resource_routing
      WHERE app_id = $1 AND logical_resource_name = $2 AND is_active = true
      LIMIT 1
    `;
    const result = await pool.query(query, [APP_ID, logicalName]);

    if (result.rows.length > 0) {
      const { physical_schema, physical_table } = result.rows[0];
      const fullPath = `${physical_schema}."${physical_table}"`;
      const resolved = { fullPath, schema: physical_schema, table: physical_table, timestamp: Date.now() };
      
      routingCache.set(cacheKey, resolved);
      return resolved;
    }

    // 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
    const fallback = { 
      fullPath: `master_data."${logicalName}"`, 
      schema: 'master_data', 
      table: logicalName,
      timestamp: Date.now()
    };
    routingCache.set(cacheKey, fallback);
    return fallback;
    
  } catch (err) {
    console.error(`[Gateway] Error resolving ${logicalName}:`, err.message);
    const fallback = { 
      fullPath: `master_data."${logicalName}"`, 
      schema: 'master_data', 
      table: logicalName,
      timestamp: Date.now()
    };
    return fallback;
  }
}

// 3. 蜍慕噪SELECT/INSERT/UPDATE髢｢謨ｰ縺ｮ螳溯｣・
async function dynamicSelect(logicalTableName, conditions = {}, columns = ['*'], limit = null) {
  const route = await resolveTablePath(logicalTableName);
  // ... (DashboardUI縺ｨ蜷後§螳溯｣・
}
```

---

## 剥 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### 蝠城｡・: 繧｢繝励Μ縺後ユ繝ｼ繝悶Ν繧定ｦ九▽縺代ｉ繧後↑縺・

**逞・憾**: `relation "public.machines" does not exist` 繧ｨ繝ｩ繝ｼ

**蜴溷屏**: 
- 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹′譛ｪ逋ｻ骭ｲ
- 繧ｭ繝｣繝・す繝･縺悟商縺・

**蟇ｾ蜃ｦ**:
```sql
-- 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ遒ｺ隱・
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'emergency-client' AND logical_resource_name = 'machines';

-- 縺ｪ縺代ｌ縺ｰ setup-all-apps-routing.sql 繧貞ｮ溯｡・
```

繧｢繝励Μ繧貞・襍ｷ蜍輔＠縺ｦ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢縲・

### 蝠城｡・: Emergency-Client縺後ご繝ｼ繝医え繧ｧ繧､譁ｹ蠑上↓蟇ｾ蠢懊＠縺ｦ縺・↑縺・

**逞・憾**: 逶ｴ謗･ `public.machines` 繧貞盾辣ｧ縺励※縺・ｋ

**蟇ｾ蜃ｦ**:
1. Emergency-Client縺ｮserver.js繧堤｢ｺ隱・
2. `resolveTablePath` 髢｢謨ｰ繧貞ｮ溯｣・
3. 逶ｴ謗･縺ｮ繝・・繝悶Ν蜿ら・繧貞虚逧・未謨ｰ縺ｫ鄂ｮ縺肴鋤縺・

### 蝠城｡・: 螟夜Κ繧ｭ繝ｼ蛻ｶ邏・お繝ｩ繝ｼ

**逞・憾**: `foreign key violation` 繧ｨ繝ｩ繝ｼ

**蜴溷屏**: vehicles 繝・・繝悶Ν縺悟商縺・public.machines 繧貞盾辣ｧ縺励※縺・ｋ

**蟇ｾ蜃ｦ**:
```sql
-- 螟夜Κ繧ｭ繝ｼ蛻ｶ邏・ｒ遒ｺ隱・
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint 
WHERE conname LIKE '%vehicle%machine%';

-- migrate-machine-tables-to-master-data.sql 繧貞・螳溯｡・
```

---

## 統 繝√ぉ繝・け繝ｪ繧ｹ繝・

- [ ] `setup-all-apps-routing.sql` 繧貞ｮ溯｡・
- [ ] 蜈ｨ繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ繧貞・襍ｷ蜍・
- [ ] DashboardUI 縺ｧ讖溽ｨｮ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縺梧ｭ｣蟶ｸ縺ｫ蜍穂ｽ・
- [ ] Emergency-Client 縺ｧ繝ｭ繧ｰ繧､繝ｳ蜿ｯ閭ｽ
- [ ] Emergency-Client 縺ｧ繝槭せ繧ｿ繝・・繧ｿ蜿門ｾ怜庄閭ｽ
- [ ] Planning・域ｺ門ｙ縺ｧ縺阪◆繧会ｼ峨〒繝槭せ繧ｿ繝・・繧ｿ蜿門ｾ怜庄閭ｽ
- [ ] Equipment・域ｺ門ｙ縺ｧ縺阪◆繧会ｼ峨〒繝槭せ繧ｿ繝・・繧ｿ蜿門ｾ怜庄閭ｽ
- [ ] Failure・域ｺ門ｙ縺ｧ縺阪◆繧会ｼ峨〒繝槭せ繧ｿ繝・・繧ｿ蜿門ｾ怜庄閭ｽ
- [ ] 繧ｨ繝ｩ繝ｼ繝ｭ繧ｰ縺ｫ schema 蜿ら・繧ｨ繝ｩ繝ｼ縺後↑縺・％縺ｨ繧堤｢ｺ隱・

---

## 套 谺｡縺ｮ繧ｹ繝・ャ繝・

1. **Emergency-Client縺ｮ蟇ｾ蠢懃｢ｺ隱・*
   - 譌｢縺ｫ繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上ｒ菴ｿ逕ｨ縺励※縺・ｋ縺狗｢ｺ隱・
   - 蠢・ｦ√↓蠢懊§縺ｦ繧ｳ繝ｼ繝我ｿｮ豁｣

2. **莉悶・繧｢繝励Μ縺ｮ貅門ｙ**
   - Planning, Equipment, Failure 縺ｮ髢狗匱迥ｶ豕∫｢ｺ隱・
   - 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上・螳溯｣・

3. **繝｢繝九ち繝ｪ繝ｳ繧ｰ**
   - 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧ｭ繝｣繝・す繝･縺ｮ繝偵ャ繝育紫遒ｺ隱・
   - 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ貂ｬ螳・

---

**譖ｴ譁ｰ譌･**: 2026蟷ｴ1譛・譌･  
**蟇ｾ雎｡迺ｰ蠅・*: 譛ｬ逡ｪ迺ｰ蠅・(Cloud SQL)  
**繝・・繧ｿ繝吶・繧ｹ**: webappdb
