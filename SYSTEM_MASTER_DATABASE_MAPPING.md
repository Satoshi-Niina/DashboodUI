# 繧ｷ繧ｹ繝・Β險ｭ螳壹・繧ｹ繧ｿ縺ｮ繝・・繧ｿ繝吶・繧ｹ繝槭ャ繝斐Φ繧ｰ荳隕ｧ

譛ｬ逡ｪ迺ｰ蠅・〒繧ｷ繧ｹ繝・Β險ｭ螳夂判髱｢縺ｮ蜷・・繧ｹ繧ｿ縺御ｽｿ逕ｨ縺励※縺・ｋCloud SQL縺ｮ繧ｹ繧ｭ繝ｼ繝槭→繝・・繝悶Ν縺ｮ荳隕ｧ縺ｧ縺吶・

## 搭 繝槭せ繧ｿ荳隕ｧ・医し繝槭Μ繝ｼ・・

| 繝槭せ繧ｿ蜷・| API繧ｨ繝ｳ繝峨・繧､繝ｳ繝・| 繧ｹ繧ｭ繝ｼ繝・| 繝・・繝悶Ν | 螳悟・菫ｮ鬟ｾ蜷・|
|---------|------------------|---------|---------|-----------|
| 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・| `/api/users` | `master_data` | `users` | `master_data."users"` |
| 莠区･ｭ謇繝槭せ繧ｿ | `/api/offices` | `master_data` | `managements_offices` | `master_data."managements_offices"` |
| 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ | `/api/bases` | `master_data` | `bases` | `master_data."bases"` |
| 菫晏ｮ育畑霆翫・繧ｹ繧ｿ | `/api/vehicles` | `master_data` | `vehicles` | `master_data."vehicles"` |
| 讖溽ｨｮ繝槭せ繧ｿ | `/api/machine-types` | `master_data` | `machine_types` | `master_data."machine_types"` |
| 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ | `/api/machines` | `master_data` | `machines` | `master_data."machines"` |

---

## 搭 繝槭せ繧ｿ隧ｳ邏ｰ

### 1. 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・
**逕ｻ髱｢繧ｿ繝・*: 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ 
**API繧ｨ繝ｳ繝峨・繧､繝ｳ繝・*: `/api/users`  
**隲也炊繝・・繝悶Ν蜷・*: `users`  
**迚ｩ逅・せ繧ｭ繝ｼ繝・*: `master_data`  
**迚ｩ逅・ユ繝ｼ繝悶Ν**: `users`  
**螳悟・菫ｮ鬟ｾ蜷・*: `master_data."users"`  

**荳ｻ隕√き繝ｩ繝**:
- `id` (SERIAL PRIMARY KEY)
- `username` (VARCHAR(50) UNIQUE)
- `password` (VARCHAR(255))
- `display_name` (VARCHAR(100))
- `email` (VARCHAR(100))
- `role` (VARCHAR(20)) - 'user', 'operation_admin', 'system_admin'
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 2. 莠区･ｭ謇繝槭せ繧ｿ
**逕ｻ髱｢繧ｿ繝・*: 莠区･ｭ謇繝槭せ繧ｿ  
**API繧ｨ繝ｳ繝峨・繧､繝ｳ繝・*: `/api/offices`  
**隲也炊繝・・繝悶Ν蜷・*: `managements_offices`  
**迚ｩ逅・せ繧ｭ繝ｼ繝・*: `master_data`  
**迚ｩ逅・ユ繝ｼ繝悶Ν**: `managements_offices`  
**螳悟・菫ｮ鬟ｾ蜷・*: `master_data."managements_offices"`  

**荳ｻ隕√き繝ｩ繝**:
- `office_id` (SERIAL PRIMARY KEY)
- `office_code` (VARCHAR(20) UNIQUE)
- `office_name` (VARCHAR(100))
- `office_type` (VARCHAR(50))
- `address` (VARCHAR(200))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 3. 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ
**逕ｻ髱｢繧ｿ繝・*: 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ  
**API繧ｨ繝ｳ繝峨・繧､繝ｳ繝・*: `/api/bases`  
**隲也炊繝・・繝悶Ν蜷・*: `bases`  
**迚ｩ逅・せ繧ｭ繝ｼ繝・*: `master_data`  
**迚ｩ逅・ユ繝ｼ繝悶Ν**: `bases`  
**螳悟・菫ｮ鬟ｾ蜷・*: `master_data."bases"`  

**荳ｻ隕√き繝ｩ繝**:
- `base_id` (SERIAL PRIMARY KEY)
- `base_code` (VARCHAR(20) UNIQUE)
- `base_name` (VARCHAR(100))
- `office_id` (INTEGER) - FK to managements_offices
- `location` (VARCHAR(200))
- `address` (VARCHAR(200))
- `postal_code` (VARCHAR(20))
- `phone_number` (VARCHAR(20))
- `latitude` (DECIMAL(10, 8))
- `longitude` (DECIMAL(11, 8))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 4. 菫晏ｮ育畑霆翫・繧ｹ繧ｿ
**逕ｻ髱｢繧ｿ繝・*: 菫晏ｮ育畑霆翫・繧ｹ繧ｿ  
**API繧ｨ繝ｳ繝峨・繧､繝ｳ繝・*: `/api/vehicles`  
**隲也炊繝・・繝悶Ν蜷・*: `vehicles`  
**迚ｩ逅・せ繧ｭ繝ｼ繝・*: `master_data`  
**迚ｩ逅・ユ繝ｼ繝悶Ν**: `vehicles`  
**螳悟・菫ｮ鬟ｾ蜷・*: `master_data."vehicles"`  

**荳ｻ隕√き繝ｩ繝**:
- `vehicle_id` (SERIAL PRIMARY KEY)
- `vehicle_number` (VARCHAR(50) UNIQUE)
- `machine_id` (INTEGER) - FK to public.machines
- `office_id` (INTEGER) - FK to managements_offices
- `model` (VARCHAR(50)) - 蝙句ｼ・
- `registration_number` (VARCHAR(50)) - 霆贋ｸ｡逋ｻ骭ｲ逡ｪ蜿ｷ
- `status` (VARCHAR(20)) - 'active', 'maintenance', 'inactive'
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**髢｢騾｣繝・・繝悶Ν**:
- `master_data.machines` (讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ)
- `master_data.machine_types` (讖溽ｨｮ繝槭せ繧ｿ)
- `master_data.managements_offices` (莠区･ｭ謇繝槭せ繧ｿ)

---

### 5. 讖溽ｨｮ繝槭せ繧ｿ
**逕ｻ髱｢陦ｨ遉ｺ**: 菫晏ｮ育畑霆翫・繧ｹ繧ｿ蜀・〒逋ｻ骭ｲ蜿ｯ閭ｽ  
**API繧ｨ繝ｳ繝峨・繧､繝ｳ繝・*: `/api/machine-types`  
**隲也炊繝・・繝悶Ν蜷・*: `machine_types`  
**迚ｩ逅・せ繧ｭ繝ｼ繝・*: `master_data`  
**迚ｩ逅・ユ繝ｼ繝悶Ν**: `machine_types`  
**螳悟・菫ｮ鬟ｾ蜷・*: `master_data."machine_types"`  

**荳ｻ隕√き繝ｩ繝**:
- `id` (SERIAL PRIMARY KEY)
- `type_code` (VARCHAR(20) UNIQUE)
- `type_name` (VARCHAR(100))
- `manufacturer` (VARCHAR(100)) - 繝｡繝ｼ繧ｫ繝ｼ
- `category` (VARCHAR(50)) - 繧ｫ繝・ざ繝ｪ
- `description` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 6. 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ
**逕ｻ髱｢陦ｨ遉ｺ**: 菫晏ｮ育畑霆翫・繧ｹ繧ｿ蜀・〒逋ｻ骭ｲ蜿ｯ閭ｽ  
**API繧ｨ繝ｳ繝峨・繧､繝ｳ繝・*: `/api/machines`  
**隲也炊繝・・繝悶Ν蜷・*: `machines`  
**迚ｩ逅・せ繧ｭ繝ｼ繝・*: `master_data`  
**迚ｩ逅・ユ繝ｼ繝悶Ν**: `machines`  
**螳悟・菫ｮ鬟ｾ蜷・*: `master_data."machines"`  

**荳ｻ隕√き繝ｩ繝**:
- `id` (SERIAL PRIMARY KEY)
- `machine_number` (VARCHAR(50) UNIQUE)
- `machine_type_id` (INTEGER) - FK to public.machine_types
- `serial_number` (VARCHAR(100))
- `manufacture_date` (DATE)
- `purchase_date` (DATE)
- `status` (VARCHAR(20)) - 'active', 'maintenance', 'retired'
- `assigned_base_id` (INTEGER) - FK to master_data.bases
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**髢｢騾｣繝・・繝悶Ν**:
- `master_data.machine_types` (讖溽ｨｮ繝槭せ繧ｿ)
- `master_data.bases` (菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ)

---

## 売 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上→繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ

譛ｬ繧ｷ繧ｹ繝・Β縺ｯ**繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑・*繧呈治逕ｨ縺励※縺翫ｊ縲～public.app_resource_routing` 繝・・繝悶Ν縺ｧ隲也炊蜷阪→迚ｩ逅・ヱ繧ｹ繧偵・繝・ヴ繝ｳ繧ｰ縺励※縺・∪縺吶・

### 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν
**繝・・繝悶Ν蜷・*: `public.app_resource_routing`  
**APP_ID**: `dashboard-ui`

| 隲也炊繝ｪ繧ｽ繝ｼ繧ｹ蜷・| 迚ｩ逅・せ繧ｭ繝ｼ繝・| 迚ｩ逅・ユ繝ｼ繝悶Ν | 隱ｬ譏・|
|---|---|---|---|
| users | master_data | users | 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・|
| managements_offices | master_data | managements_offices | 莠区･ｭ謇繝槭せ繧ｿ |
| bases | master_data | bases | 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ |
| vehicles | master_data | vehicles | 菫晏ｮ育畑霆翫・繧ｹ繧ｿ |
| machine_types | master_data | machine_types | 讖溽ｨｮ繝槭せ繧ｿ |
| machines | master_data | machines | 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ |

---

## 投 繝・・繝悶Ν髢｢菫ょ峙

```
master_data.managements_offices (莠区･ｭ謇)
    竊・(office_id)
master_data.bases (菫晏ｮ亥渕蝨ｰ)
    竊・(base_id)                竊・(office_id)
master_data.machines (讖滓｢ｰ逡ｪ蜿ｷ)   master_data.vehicles (菫晏ｮ育畑霆・
    竊・(machine_type_id)         竊・(machine_id)
master_data.machine_types (讖溽ｨｮ)
```

### 螟夜Κ繧ｭ繝ｼ蛻ｶ邏・
- `master_data.bases.office_id` 竊・`master_data.managements_offices.office_id`
- `master_data.vehicles.office_id` 竊・`master_data.managements_offices.office_id`
- `master_data.vehicles.machine_id` 竊・`master_data.machines.id`
- `master_data.machines.machine_type_id` 竊・`master_data.machine_types.id`
- `master_data.machines.assigned_base_id` 竊・`master_data.bases.base_id`

---

## 肌 繧ｷ繧ｹ繝・Β險ｭ螳夐未騾｣繝・・繝悶Ν

### 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳・
**繝・・繝悶Ν蜷・*: `master_data.app_config`  
**逕ｨ騾・*: 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳURL繧ГORS險ｭ螳壹↑縺ｩ縺ｮ蜍慕噪險ｭ螳・

**荳ｻ隕√き繝ｩ繝**:
- `config_key` (VARCHAR(100) PRIMARY KEY)
- `config_value` (TEXT)
- `description` (TEXT)
- `updated_at` (TIMESTAMP)
- `updated_by` (INTEGER)

### 險ｭ螳壼､画峩螻･豁ｴ
**繝・・繝悶Ν蜷・*: `master_data.app_config_history`  
**逕ｨ騾・*: 險ｭ螳壼､画峩縺ｮ逶｣譟ｻ繝ｭ繧ｰ

**荳ｻ隕√き繝ｩ繝**:
- `history_id` (SERIAL PRIMARY KEY)
- `config_key` (VARCHAR(100))
- `old_value` (TEXT)
- `new_value` (TEXT)
- `changed_by` (INTEGER)
- `changed_at` (TIMESTAMP)

---

## 統 豕ｨ諢丈ｺ矩・

1. **繧ｹ繧ｭ繝ｼ繝槭・菴ｿ縺・・縺・*
   - `master_data`: 縺吶∋縺ｦ縺ｮ繝槭せ繧ｿ繝・・繧ｿ繧堤ｵｱ荳邂｡逅・
   - 讖溽ｨｮ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繧Ａmaster_data`繧ｹ繧ｭ繝ｼ繝槭↓邨ｱ蜷医＆繧後※縺・∪縺・

2. **繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上・繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ**
   - 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺瑚ｦ九▽縺九ｉ縺ｪ縺・ｴ蜷医～master_data` 繧ｹ繧ｭ繝ｼ繝槭↓繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
   - 繧ｭ繝｣繝・す繝･TTL: 5蛻・

3. **繧ｻ繧ｭ繝･繝ｪ繝・ぅ**
   - 縺吶∋縺ｦ縺ｮ繝槭せ繧ｿ邂｡逅・PI縺ｯ `requireAdmin` 縺ｾ縺溘・ `authenticateToken` 縺ｧ菫晁ｭｷ
   - 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・・ `system_admin` 縺ｾ縺溘・ `operation_admin` 縺ｮ縺ｿ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ

---

**菴懈・譌･**: 2026蟷ｴ1譛・譌･  
**蟇ｾ雎｡迺ｰ蠅・*: 譛ｬ逡ｪ迺ｰ蠅・(Cloud SQL)  
**繝・・繧ｿ繝吶・繧ｹ**: webappdb
