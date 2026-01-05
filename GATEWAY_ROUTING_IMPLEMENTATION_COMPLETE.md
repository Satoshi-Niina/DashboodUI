# 蜈ｨ繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ Master Data Integration 螳御ｺ・Ξ繝昴・繝・

## 螳溯｣・ｮ御ｺ・律譎・
2026蟷ｴ1譛・譌･

## 螳溯｣・ｦりｦ・

蜈ｨ4縺､縺ｮ繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｫ**蜍慕噪繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ蟇ｾ蠢懊・master_data繧｢繧ｯ繧ｻ繧ｹ讖溯・**繧貞ｮ溯｣・＠縺ｾ縺励◆縲・

## 螳溯｣・・螳ｹ

### 笨・蜍慕噪繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ蟇ｾ蠢・

**app_resource_routing繝・・繝悶Ν繧貞盾辣ｧ**縺励※閾ｪ蜍慕噪縺ｫ繝・・繝悶Ν繝代せ繧定ｧ｣豎ｺ・・

```javascript
// 菴ｿ逕ｨ萓・
import { getUsers } from './master-data.js';

const users = await getUsers();
// 竊・app_resource_routing繧堤｢ｺ隱・
// 竊・master_data.users縺ｫ繧｢繧ｯ繧ｻ繧ｹ
```

### 笨・邂｡逅・ユ繝ｼ繝悶Ν譖ｴ譁ｰ縺ｸ縺ｮ閾ｪ蜍募ｯｾ蠢・

**驥崎ｦ・*: `app_resource_routing`繝・・繝悶Ν繧呈峩譁ｰ縺吶ｋ縺ｨ縲・*閾ｪ蜍慕噪縺ｫ譁ｰ縺励＞繝代せ繧剃ｽｿ逕ｨ**縺励∪縺吶・

#### 蜍穂ｽ懊ヵ繝ｭ繝ｼ・・
1. DBeaver遲峨〒`app_resource_routing`繧呈峩譁ｰ
2. 繧ｭ繝｣繝・す繝･TTL・・蛻・ｼ牙ｾ後∬・蜍慕噪縺ｫ譁ｰ縺励＞繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧剃ｽｿ逕ｨ
3. 蜊ｳ蠎ｧ縺ｫ蜿肴丐縺励◆縺・ｴ蜷医・`clearRoutingCache()`繧貞他縺ｳ蜃ｺ縺・

#### 萓具ｼ・
```sql
-- DashboardUI縺ｧusers繝・・繝悶Ν縺ｮ繧ｹ繧ｭ繝ｼ繝槭ｒ螟画峩
UPDATE public.app_resource_routing 
SET physical_schema = 'new_schema',
    physical_table = 'new_users'
WHERE app_id = 'dashboard-ui' 
  AND logical_resource_name = 'users';

-- 蜷・い繝励Μ縺ｯ譛螟ｧ1蛻・ｾ後↓閾ｪ蜍慕噪縺ｫnew_schema.new_users繧剃ｽｿ逕ｨ
```

## 螳溯｣・ｸ医∩繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ

### 1. Emergency-Assistance (emergency-client)
- **繝代せ**: `server/db/master-data.js`
- **APP_ID**: emergency-client
- **繝ｫ繝ｼ繝域焚**: 7
- **蜈ｱ譛峨・繧ｹ繧ｿ**: users, managements_offices, bases, vehicles, machine_types, machines
- **蟆ら畑繝・・繝悶Ν**: emergency_records (emergency.emergency_records)

### 2. Machine Failure Analysis System (failure)
- **繝代せ**: `master-data.js`
- **APP_ID**: failure
- **繝ｫ繝ｼ繝域焚**: 7
- **蜈ｱ譛峨・繧ｹ繧ｿ**: users, managements_offices, bases, vehicles, machine_types, machines
- **蟆ら畑繝・・繝悶Ν**: fault_records (maintenance.fault_records)

### 3. operation-management-app (planning)
- **繝代せ**: `master-data.js`
- **APP_ID**: planning
- **繝ｫ繝ｼ繝域焚**: 8
- **蜈ｱ譛峨・繧ｹ繧ｿ**: users, managements_offices, bases, vehicles, machine_types, machines
- **蟆ら畑繝・・繝悶Ν**: schedules (operations.schedules), operation_records (operations.operation_records)

### 4. railway-maintenance-system (equipment)
- **繝代せ**: `master-data.js`
- **APP_ID**: equipment
- **繝ｫ繝ｼ繝域焚**: 8
- **蜈ｱ譛峨・繧ｹ繧ｿ**: users, managements_offices, bases, vehicles, machine_types, machines
- **蟆ら畑繝・・繝悶Ν**: inspection_records (inspections.inspection_records), inspection_types (master_data.inspection_types)

## 謠蝉ｾ帙＆繧後ｋ髢｢謨ｰ

### 蜈ｱ譛峨・繧ｹ繧ｿ繧｢繧ｯ繧ｻ繧ｹ
```javascript
getUsers()                  // master_data.users
getManagementOffices()      // master_data.managements_offices
getBases()                  // master_data.bases
getVehicles()               // master_data.vehicles
getMachineTypes()           // master_data.machine_types
getMachines()               // master_data.machines
```

### 繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ
```javascript
getTablePath(logicalName)   // 隲也炊蜷阪°繧臥黄逅・ヱ繧ｹ繧貞叙蠕・
queryTable(logicalName)     // 蜍慕噪繧ｯ繧ｨ繝ｪ螳溯｡・
clearRoutingCache()         // 繧ｭ繝｣繝・す繝･繧ｯ繝ｪ繧｢・亥叉蠎ｧ縺ｫ蜿肴丐・・
```

## 菴ｿ逕ｨ譁ｹ豕・

### 1. 蝓ｺ譛ｬ逧・↑菴ｿ逕ｨ
```javascript
import { getUsers, getMachineTypes } from './master-data.js';

// 繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ蜿門ｾ・
const users = await getUsers();

// 讖溽ｨｮ荳隕ｧ蜿門ｾ・
const types = await getMachineTypes();
```

### 2. API endpoint螳溯｣・
```javascript
import express from 'express';
import { getUsers, getMachineTypes } from './master-data.js';

const router = express.Router();

router.get('/api/masters/users', async (req, res) => {
    const users = await getUsers();
    res.json(users);
});

router.get('/api/masters/machine-types', async (req, res) => {
    const types = await getMachineTypes();
    res.json(types);
});

export default router;
```

### 3. 蜍慕噪繝・・繝悶Ν繧｢繧ｯ繧ｻ繧ｹ
```javascript
import { getTablePath, client } from './master-data.js';

async function getRecordById(tableName, id) {
    const path = await getTablePath(tableName);
    return client`SELECT * FROM ${path} WHERE id = ${id}`;
}
```

## 邂｡逅・ユ繝ｼ繝悶Ν譖ｴ譁ｰ縺ｮ謇矩・

### DBeaver荳翫〒縺ｮ譖ｴ譁ｰ
```sql
-- 萓・ vehicles繝・・繝悶Ν縺ｮ繧ｹ繧ｭ繝ｼ繝槭ｒ螟画峩
UPDATE public.app_resource_routing 
SET physical_schema = 'new_master',
    physical_table = 'vehicles_v2',
    updated_at = CURRENT_TIMESTAMP
WHERE logical_resource_name = 'vehicles'
  AND app_id IN ('dashboard-ui', 'emergency-client', 'planning', 'equipment', 'failure');
```

### 蜊ｳ蠎ｧ縺ｫ蜿肴丐・医が繝励す繝ｧ繝ｳ・・
```javascript
// 蜷・い繝励Μ縺ｮ繧ｵ繝ｼ繝舌・繧ｳ繝ｼ繝峨〒
import { clearRoutingCache } from './master-data.js';

// 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ譖ｴ譁ｰ蠕後↓蜻ｼ縺ｳ蜃ｺ縺・
clearRoutingCache();
```

## 繝・・繧ｿ繝吶・繧ｹ遒ｺ隱拘QL

### 蜈ｨ繧｢繝励Μ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ迥ｶ豕∫｢ｺ隱・
```sql
SELECT 
    app_id,
    COUNT(*) as routes,
    STRING_AGG(logical_resource_name, ', ' ORDER BY logical_resource_name) as resources
FROM public.app_resource_routing
WHERE app_id IN ('dashboard-ui', 'emergency-client', 'planning', 'equipment', 'failure')
  AND is_active = true
GROUP BY app_id
ORDER BY app_id;
```

### 蜈ｱ譛峨・繧ｹ繧ｿ縺ｮ蛻ｩ逕ｨ迥ｶ豕・
```sql
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as table_path,
    STRING_AGG(app_id, ', ' ORDER BY app_id) as used_by
FROM public.app_resource_routing
WHERE logical_resource_name IN ('users', 'managements_offices', 'bases', 'vehicles', 'machine_types', 'machines')
  AND is_active = true
GROUP BY logical_resource_name, physical_schema, physical_table
ORDER BY logical_resource_name;
```

## 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### 繧ｨ繝ｩ繝ｼ: "No routing found"
```
console.warn: No routing found for emergency-client:users, using public schema
```

**蜴溷屏**: app_resource_routing繝・・繝悶Ν縺ｫ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺梧悴逋ｻ骭ｲ

**隗｣豎ｺ譁ｹ豕・*: `setup-all-apps-routing-utf8.sql`繧奪Beaver荳翫〒螳溯｡・

### 繧ｨ繝ｩ繝ｼ: "relation does not exist"
```
ERROR: relation "master_data.users" does not exist
```

**蜴溷屏**: master_data繧ｹ繧ｭ繝ｼ繝槭∪縺溘・繝・・繝悶Ν縺悟ｭ伜惠縺励↑縺・

**隗｣豎ｺ譁ｹ豕・*: `database-setup.sql`繧貞ｮ溯｡後＠縺ｦmaster_data繧ｹ繧ｭ繝ｼ繝槭ｒ菴懈・

### 繧ｭ繝｣繝・す繝･縺梧峩譁ｰ縺輔ｌ縺ｪ縺・
**隗｣豎ｺ譁ｹ豕・*: `clearRoutingCache()`繧貞他縺ｳ蜃ｺ縺励※繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢

## 谺｡縺ｮ繧ｹ繝・ャ繝・

### 蜷・い繝励Μ縺ｧ縺ｮ螳溯｣・
1. 笨・master-data.js菴懈・螳御ｺ・
2. 竢ｳ 譌｢蟄倥さ繝ｼ繝峨〒縺ｮmaster-data.js菴ｿ逕ｨ
3. 竢ｳ API endpoint縺ｮ霑ｽ蜉
4. 竢ｳ 繝輔Ο繝ｳ繝医お繝ｳ繝峨・邨ｱ蜷・

### 繝・せ繝・
1. 竢ｳ 蜷・い繝励Μ縺ｧmaster_data繝・・繝悶Ν縺ｸ縺ｮ繧｢繧ｯ繧ｻ繧ｹ繝・せ繝・
2. 竢ｳ 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ譖ｴ譁ｰ譎ゅ・蜍穂ｽ懃｢ｺ隱・
3. 竢ｳ 繧ｭ繝｣繝・す繝･讖溯・縺ｮ蜍穂ｽ懃｢ｺ隱・

## 繝輔ぃ繧､繝ｫ荳隕ｧ

### Emergency-Assistance
- `server/db/master-data.js` - 繝｡繧､繝ｳ繝｢繧ｸ繝･繝ｼ繝ｫ
- `MASTER_DATA_INTEGRATION.md` - 螳溯｣・ぎ繧､繝・
- `db-gateway.js` - 豎守畑繧ｲ繝ｼ繝医え繧ｧ繧､
- `shared-db-config.js` - DB謗･邯夊ｨｭ螳・

### Machine Failure Analysis System
- `master-data.js` - 繝｡繧､繝ｳ繝｢繧ｸ繝･繝ｼ繝ｫ (APP_ID: failure)
- `MASTER_DATA_INTEGRATION.md` - 螳溯｣・ぎ繧､繝・
- `db-gateway.js` - 豎守畑繧ｲ繝ｼ繝医え繧ｧ繧､
- `shared-db-config.js` - DB謗･邯夊ｨｭ螳・
- `server.js` - 譌｢蟄倥し繝ｼ繝舌・繝輔ぃ繧､繝ｫ

### operation-management-app
- `master-data.js` - 繝｡繧､繝ｳ繝｢繧ｸ繝･繝ｼ繝ｫ (APP_ID: planning)
- `MASTER_DATA_INTEGRATION.md` - 螳溯｣・ぎ繧､繝・
- `db-gateway.js` - 豎守畑繧ｲ繝ｼ繝医え繧ｧ繧､
- `shared-db-config.js` - DB謗･邯夊ｨｭ螳・

### railway-maintenance-system
- `master-data.js` - 繝｡繧､繝ｳ繝｢繧ｸ繝･繝ｼ繝ｫ (APP_ID: equipment)
- `MASTER_DATA_INTEGRATION.md` - 螳溯｣・ぎ繧､繝・
- `db-gateway.js` - 豎守畑繧ｲ繝ｼ繝医え繧ｧ繧､
- `shared-db-config.js` - DB謗･邯夊ｨｭ螳・

## 縺ｾ縺ｨ繧・

笨・**4縺､蜈ｨ縺ｦ縺ｮ繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ**縺ｫ繧ｲ繝ｼ繝医え繧ｧ繧､繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ螳溯｣・ｮ御ｺ・
笨・**蜍慕噪繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ蟇ｾ蠢・*: app_resource_routing繝・・繝悶Ν譖ｴ譁ｰ縺ｫ閾ｪ蜍募ｯｾ蠢・
笨・**繧ｭ繝｣繝・す繝･讖溯・**: 鬮倬溘い繧ｯ繧ｻ繧ｹ縺ｨ閾ｪ蜍墓峩譁ｰ縺ｮ繝舌Λ繝ｳ繧ｹ
笨・**繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ**: 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ譛ｪ逋ｻ骭ｲ譎ゅｂ蜍穂ｽ懃ｶ咏ｶ・
笨・**邨ｱ荳繧､繝ｳ繧ｿ繝ｼ繝輔ぉ繝ｼ繧ｹ**: 蜈ｨ繧｢繝励Μ縺ｧ蜷後§髢｢謨ｰ繧剃ｽｿ逕ｨ

縺薙ｌ縺ｧ縲．ashboardUI縺ｧmaster_data繝・・繝悶Ν縺ｮ繧ｹ繧ｭ繝ｼ繝槭ｄ繝・・繝悶Ν蜷阪ｒ螟画峩縺励※繧ゅ・*蜈ｨ繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺瑚・蜍慕噪縺ｫ霑ｽ蠕・*縺励∪縺吶・
