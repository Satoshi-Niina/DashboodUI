# 圷 繧ｯ繝ｩ繧ｦ繝吋B謗･邯壼撫鬘・- 邱頑･蟇ｾ蠢懈焔鬆・

## 蝠城｡後・迚ｹ螳・

繝ｭ繧ｰ繧､繝ｳ縺ｯ謌仙粥縺励※縺・ｋ縺後～/api/users`縲～/api/vehicles`縺ｪ縺ｩ縺ｮAPI縺ｧ401繧ｨ繝ｩ繝ｼ縺檎匱逕溘・
縺薙ｌ縺ｯ**繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上・繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν縺悟ｭ伜惠縺励↑縺・*縺薙→縺悟次蝗縺ｧ縺吶・

## 蠢・亥ｯｾ蠢懶ｼ磯・分縺ｫ螳溯｡鯉ｼ・

### Step 1: Cloud SQL縺ｫ謗･邯・

```bash
# Google Cloud SDK縺後う繝ｳ繧ｹ繝医・繝ｫ縺輔ｌ縺ｦ縺・ｋ蝣ｴ蜷・
gcloud sql connect [YOUR_INSTANCE_NAME] --user=postgres --database=webappdb

# 縺ｾ縺溘・縲，loud Console縺ｮ縲靴loud SQL Studio縲阪ｒ菴ｿ逕ｨ
```

### Step 2: 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν縺ｮ蟄伜惠遒ｺ隱・

```sql
-- app_resource_routing繝・・繝悶Ν縺悟ｭ伜惠縺吶ｋ縺狗｢ｺ隱・
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'app_resource_routing';
```

**譛溷ｾ・＆繧後ｋ邨先棡:**
```
tablename           
--------------------
app_resource_routing
```

**邨先棡縺檎ｩｺ縺ｮ蝣ｴ蜷・** 繝・・繝悶Ν縺悟ｭ伜惠縺励∪縺帙ｓ 竊・Step 3縺ｸ

### Step 3: 繧ｲ繝ｼ繝医え繧ｧ繧､繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν縺ｮ菴懈・縺ｨ繝・・繧ｿ謚募・

**縺薙・SQL繝輔ぃ繧､繝ｫ繧貞ｮ溯｡後＠縺ｦ縺上□縺輔＞:**

`setup-gateway-routing.sql`縺ｮ蜀・ｮｹ繧・*Cloud SQL Studio**縺ｾ縺溘・**psql**縺ｧ螳溯｡鯉ｼ・

```sql
-- app_resource_routing繝・・繝悶Ν縺悟ｭ伜惠縺励↑縺・ｴ蜷医・菴懈・
CREATE TABLE IF NOT EXISTS public.app_resource_routing (
    routing_id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    logical_resource_name VARCHAR(100) NOT NULL,
    physical_schema VARCHAR(50) NOT NULL,
    physical_table VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(app_id, logical_resource_name)
);

-- 繧､繝ｳ繝・ャ繧ｯ繧ｹ菴懈・
CREATE INDEX IF NOT EXISTS idx_app_resource_routing_lookup 
ON public.app_resource_routing(app_id, logical_resource_name, is_active);

-- DashboodUI逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳・
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'users', 'master_data', 'users', '繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・ユ繝ｼ繝悶Ν'),
  ('dashboard-ui', 'managements_offices', 'master_data', 'managements_offices', '莠区･ｭ謇繝槭せ繧ｿ繝・・繝悶Ν'),
  ('dashboard-ui', 'bases', 'master_data', 'bases', '菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ繝・・繝悶Ν'),
  ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', '菫晏ｮ育畑霆翫・繧ｹ繧ｿ繝・・繝悶Ν'),
  ('dashboard-ui', 'machine_types', 'public', 'machine_types', '讖溽ｨｮ繝槭せ繧ｿ繝・・繝悶Ν'),
  ('dashboard-ui', 'machines', 'public', 'machines', '讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝・・繝悶Ν'),
  ('dashboard-ui', 'app_config', 'master_data', 'app_config', '繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳壹ユ繝ｼ繝悶Ν'),
  ('dashboard-ui', 'app_config_history', 'master_data', 'app_config_history', '繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳壼､画峩螻･豁ｴ繝・・繝悶Ν'),
  ('dashboard-ui', 'vehicle_types', 'master_data', 'vehicle_types', '霆贋ｸ｡繧ｿ繧､繝励・繧ｹ繧ｿ繝・・繝悶Ν'),
  ('dashboard-ui', 'inspection_types', 'master_data', 'inspection_types', '轤ｹ讀懊ち繧､繝励・繧ｹ繧ｿ繝・・繝悶Ν')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
```

### Step 4: 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繧ｿ縺ｮ遒ｺ隱・

```sql
-- 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺梧ｭ｣縺励￥逋ｻ骭ｲ縺輔ｌ縺溘°遒ｺ隱・
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active,
    created_at
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
```

**譛溷ｾ・＆繧後ｋ邨先棡:**
```
logical_resource_name | full_path                       | is_active | created_at
----------------------+---------------------------------+-----------+-------------------
app_config            | master_data.app_config          | t         | 2026-01-03 ...
bases                 | master_data.bases               | t         | 2026-01-03 ...
machines              | public.machines                 | t         | 2026-01-03 ...
machine_types         | public.machine_types            | t         | 2026-01-03 ...
managements_offices   | master_data.managements_offices | t         | 2026-01-03 ...
users                 | master_data.users               | t         | 2026-01-03 ...
vehicles              | master_data.vehicles            | t         | 2026-01-03 ...
...
```

### Step 5: 繝・・繝悶Ν讒矩縺ｮ遒ｺ隱搾ｼ亥ｿ・ｦ√↓蠢懊§縺ｦ・・

```sql
-- 蠢・ｦ√↑繧ｫ繝ｩ繝縺悟ｭ伜惠縺吶ｋ縺狗｢ｺ隱・
\d master_data.managements_offices
\d master_data.bases
\d master_data.vehicles
```

繧ｫ繝ｩ繝縺御ｸ崎ｶｳ縺励※縺・ｋ蝣ｴ蜷医・`migration-fix-tables.sql`繧ょｮ溯｡後＠縺ｦ縺上□縺輔＞縲・

### Step 6: Cloud Run繧ｵ繝ｼ繝薙せ縺ｮ蜀崎ｵｷ蜍・

繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繝悶Ν繧剃ｽ懈・蠕後，loud Run繧ｵ繝ｼ繝薙せ繧貞・襍ｷ蜍輔＠縺ｦ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢・・

```bash
# Google Cloud Console縺ｧ縲√∪縺溘・
gcloud run services update dashboard-ui --region=asia-northeast2
```

縺ｾ縺溘・縲；itHub Actions縺ｧ蜀阪ョ繝励Ο繧､・・

```bash
git commit --allow-empty -m "trigger: Redeploy after DB setup"
git push origin main
```

---

## 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### Q: 繝・・繝悶Ν縺ｯ菴懈・縺輔ｌ縺溘′縲√∪縺401繧ｨ繝ｩ繝ｼ縺悟・繧・

**A:** 繧ｵ繝ｼ繝舌・繝ｭ繧ｰ繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞・・

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=dashboard-ui" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

莉･荳九・繝ｭ繧ｰ繧呈爾縺励※縺上□縺輔＞・・
- `[Gateway] Resolved: users 竊・master_data."users"` ・域・蜉滂ｼ・
- `[Gateway] No route found for users` ・亥､ｱ謨・- 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺瑚ｦ九▽縺九ｉ縺ｪ縺・ｼ・
- `Error resolving users` ・亥､ｱ謨・- DB謗･邯壹お繝ｩ繝ｼ・・

### Q: `app_resource_routing`繝・・繝悶Ν縺梧里縺ｫ蟄伜惠縺吶ｋ

**A:** 繝・・繧ｿ縺梧ｭ｣縺励￥謚募・縺輔ｌ縺ｦ縺・ｋ縺狗｢ｺ隱搾ｼ・

```sql
SELECT COUNT(*) FROM public.app_resource_routing WHERE app_id = 'dashboard-ui';
```

邨先棡縺・縺ｮ蝣ｴ蜷医！NSERT繧ｯ繧ｨ繝ｪ縺ｮ縺ｿ螳溯｡後＠縺ｦ縺上□縺輔＞縲・

### Q: 莉悶・繧｢繝励Μ・・mergency縲｝lanning遲会ｼ峨ｂ蠖ｱ髻ｿ繧貞女縺代ｋ・・

**A:** 縺・＞縺医ょ推繧｢繝励Μ縺ｯ逡ｰ縺ｪ繧義app_id`繧呈戟縺｣縺ｦ縺・ｋ縺溘ａ縲∫峡遶九＠縺ｦ縺・∪縺呻ｼ・
- `dashboard-ui` 竊・DashboodUI逕ｨ
- `emergency-assistance` 竊・Emergency逕ｨ
- `planning` 竊・Planning逕ｨ

---

## 遒ｺ隱榊ｮ御ｺ・メ繧ｧ繝・け繝ｪ繧ｹ繝・

- [ ] `public.app_resource_routing`繝・・繝悶Ν縺悟ｭ伜惠縺吶ｋ
- [ ] `dashboard-ui`縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繝・・繧ｿ縺・0莉ｶ逋ｻ骭ｲ縺輔ｌ縺ｦ縺・ｋ
- [ ] Cloud Run繧ｵ繝ｼ繝薙せ繧貞・襍ｷ蜍輔＠縺・
- [ ] 繝ｭ繧ｰ繧､繝ｳ縺ｧ縺阪ｋ
- [ ] `/api/users`縺ｧ401繧ｨ繝ｩ繝ｼ縺悟・縺ｪ縺・
- [ ] 繧ｷ繧ｹ繝・Β險ｭ螳夂判髱｢縺ｧ繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ縺瑚｡ｨ遉ｺ縺輔ｌ繧・

縺吶∋縺ｦ笨・↑繧牙ｮ御ｺ・〒縺呻ｼ・

---

**菴懈・譌･:** 2026蟷ｴ1譛・譌･  
**蜆ｪ蜈亥ｺｦ:** 圷 邱頑･・亥ｿ・亥ｯｾ蠢懶ｼ・
