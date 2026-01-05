# 繝・・繧ｿ繝吶・繧ｹ讒矩縺ｮ荳肴紛蜷井ｿｮ豁｣

## 逋ｺ隕九＆繧後◆蝠城｡・

server.js縺ｨdatabase-setup.sql縺ｮ髢薙〒繧ｫ繝ｩ繝蜷阪′荳閾ｴ縺励※縺・∪縺帙ｓ縺ｧ縺励◆縲・

### 1. managements_offices 繝・・繝悶Ν

**菫ｮ豁｣縺ｪ縺・* - office_code, office_name, office_type, address 縺ｮ縺ｿ菴ｿ逕ｨ

### 2. bases 繝・・繝悶Ν

**霑ｽ蜉縺励◆繧ｫ繝ｩ繝:**
- `location` - 謇蝨ｨ蝨ｰ・育ｰ｡譏鍋沿・・
- `address` - 菴乗園・郁ｩｳ邏ｰ迚茨ｼ・
- `postal_code` - 驛ｵ萓ｿ逡ｪ蜿ｷ
- `phone_number` - 髮ｻ隧ｱ逡ｪ蜿ｷ
- `latitude` - 邱ｯ蠎ｦ
- `longitude` - 邨悟ｺｦ

### 3. vehicles 繝・・繝悶Ν

**霑ｽ蜉縺励◆繧ｫ繝ｩ繝:**
- `machine_id` - 讖滓｢ｰ逡ｪ蜿ｷ縺ｸ縺ｮ螟夜Κ繧ｭ繝ｼ
- `office_id` - 邂｡逅・ｺ区･ｭ謇縺ｸ縺ｮ螟夜Κ繧ｭ繝ｼ

## 菫ｮ豁｣蜀・ｮｹ

### 繝輔ぃ繧､繝ｫ菫ｮ豁｣
1. `database-setup.sql` - 繝・・繝悶Ν螳夂ｾｩ繧剃ｿｮ豁｣
2. `migration-fix-tables.sql` - 譌｢蟄魯B繧剃ｿｮ豁｣縺吶ｋ繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ繧ｹ繧ｯ繝ｪ繝励ヨ菴懈・

### 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ螳溯｡梧焔鬆・

```bash
# Cloud SQL縺ｫ謗･邯・
gcloud sql connect webappdb --user=postgres --quiet

# 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ繧貞ｮ溯｡・
\i migration-fix-tables.sql

# 縺ｾ縺溘・
psql -h /cloudsql/PROJECT:REGION:INSTANCE -U postgres -d webappdb -f migration-fix-tables.sql
```

### 遒ｺ隱肴焔鬆・

```bash
# 繝・・繝悶Ν讒矩繧堤｢ｺ隱・
\d master_data.managements_offices
\d master_data.bases
\d master_data.vehicles
\d public.machines
\d public.machine_types
```

## 蠖ｱ髻ｿ遽・峇

- 莠区･ｭ謇繝槭せ繧ｿ縺ｮ霑ｽ蜉繝ｻ譖ｴ譁ｰ
- 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ縺ｮ霑ｽ蜉繝ｻ譖ｴ譁ｰ
- 菫晏ｮ育畑霆翫・繧ｹ繧ｿ縺ｮ霑ｽ蜉繝ｻ譖ｴ譁ｰ

縺薙ｌ繧峨・讖溯・縺ｧ500繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｦ縺・◆蜴溷屏縺後∝ｭ伜惠縺励↑縺・き繝ｩ繝縺ｸ縺ｮINSERT/UPDATE縺ｧ縺励◆縲・

## 谺｡縺ｮ繧ｹ繝・ャ繝・

1. 繝槭う繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ繧ｹ繧ｯ繝ｪ繝励ヨ繧辰loud SQL縺ｧ螳溯｡・
2. 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ繧貞・繝・・繝ｭ繧､・医☆縺ｧ縺ｫ豁｣縺励＞繧ｫ繝ｩ繝蜷阪ｒ菴ｿ逕ｨ縺励※縺・ｋ・・
3. 蜷・・繧ｹ繧ｿ縺ｧ菫晏ｭ倥ユ繧ｹ繝医ｒ螳滓命
