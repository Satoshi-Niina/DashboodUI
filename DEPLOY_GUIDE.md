# Cloud Run 繝・・繝ｭ繧､謇矩・

## 繝・・繝ｭ繧､蠕後↓繝ｭ繧ｰ繧､繝ｳ縺ｧ縺阪↑縺・撫鬘後・隗｣豎ｺ譁ｹ豕・

### 蝠城｡後・蜴溷屏
繝・・繧ｿ繝吶・繧ｹ謗･邯壹・迺ｰ蠅・､画焚縺梧ｭ｣縺励￥險ｭ螳壹＆繧後※縺・↑縺・

### 隗｣豎ｺ謇矩・

#### 1. Cloud SQL繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ謗･邯壼錐繧堤｢ｺ隱・
```bash
gcloud sql instances describe [繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ蜷江 --format="value(connectionName)"
```

萓・ `my-project:asia-northeast1:webappdb-instance`

#### 2. 迺ｰ蠅・､画焚繧定ｨｭ螳壹＠縺ｦ蜀阪ョ繝励Ο繧､

**PowerShell (Windows):**
```powershell
gcloud run deploy dashboard-ui `
  --source . `
  --region=asia-northeast1 `
  --platform=managed `
  --allow-unauthenticated `
  --set-env-vars NODE_ENV=production `
  --set-env-vars CLOUD_SQL_INSTANCE=YOUR_PROJECT:REGION:INSTANCE `
  --set-env-vars DB_NAME=webappdb `
  --set-env-vars DB_USER=postgres `
  --set-env-vars DB_PASSWORD=YOUR_PASSWORD `
  --set-env-vars JWT_SECRET=YOUR_SECRET `
  --set-env-vars CORS_ORIGIN=* `
  --add-cloudsql-instances YOUR_PROJECT:REGION:INSTANCE
```

**Bash (Mac/Linux):**
```bash
gcloud run deploy dashboard-ui \
  --source . \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars CLOUD_SQL_INSTANCE=YOUR_PROJECT:REGION:INSTANCE \
  --set-env-vars DB_NAME=webappdb \
  --set-env-vars DB_USER=postgres \
  --set-env-vars DB_PASSWORD=YOUR_PASSWORD \
  --set-env-vars JWT_SECRET=YOUR_SECRET \
  --set-env-vars CORS_ORIGIN=* \
  --add-cloudsql-instances YOUR_PROJECT:REGION:INSTANCE
```

#### 3. 繝・・繝ｭ繧､蠕後・遒ｺ隱・

**繝倥Ν繧ｹ繝√ぉ繝・け:**
```bash
curl https://YOUR_SERVICE_URL/health
```

豁｣蟶ｸ縺ｪ蠢懃ｭ・
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

**迺ｰ蠅・､画焚縺ｮ遒ｺ隱搾ｼ医ョ繝舌ャ繧ｰ逕ｨ・・**
```bash
curl https://YOUR_SERVICE_URL/debug/env
```

#### 4. 繝ｭ繧ｰ縺ｮ遒ｺ隱・

```bash
# 譛譁ｰ50莉ｶ縺ｮ繝ｭ繧ｰ繧堤｢ｺ隱・
gcloud run services logs read dashboard-ui --limit=50

# 繝・・繧ｿ繝吶・繧ｹ髢｢騾｣縺ｮ繧ｨ繝ｩ繝ｼ縺縺醍｢ｺ隱・
gcloud run services logs read dashboard-ui --limit=100 | grep -i "database\|connection\|error"
```

#### 5. 繧医￥縺ゅｋ繧ｨ繝ｩ繝ｼ縺ｨ蟇ｾ蜃ｦ豕・

**繧ｨ繝ｩ繝ｼ: "Database connection error"**
- CLOUD_SQL_INSTANCE 縺梧ｭ｣縺励￥險ｭ螳壹＆繧後※縺・ｋ縺狗｢ｺ隱・
- --add-cloudsql-instances 繝輔Λ繧ｰ繧剃ｻ倥￠縺ｦ繝・・繝ｭ繧､縺励◆縺狗｢ｺ隱・

**繧ｨ繝ｩ繝ｼ: "password authentication failed"**
- DB_USER 縺ｨ DB_PASSWORD 縺梧ｭ｣縺励＞縺狗｢ｺ隱・
- Cloud SQL縺ｮ繝ｦ繝ｼ繧ｶ繝ｼ讓ｩ髯舌ｒ遒ｺ隱・

**繧ｨ繝ｩ繝ｼ: "could not connect to server"**
- Cloud SQL繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ縺瑚ｵｷ蜍輔＠縺ｦ縺・ｋ縺狗｢ｺ隱・
- 繝阪ャ繝医Ρ繝ｼ繧ｯ險ｭ螳壹ｒ遒ｺ隱・

#### 6. 迺ｰ蠅・､画焚縺ｮ譖ｴ譁ｰ縺ｮ縺ｿ・亥・繝薙Ν繝峨↑縺暦ｼ・

縺吶〒縺ｫ繝・・繝ｭ繧､貂医∩縺ｧ迺ｰ蠅・､画焚縺縺大､画峩縺励◆縺・ｴ蜷・

```bash
gcloud run services update dashboard-ui \
  --region=asia-northeast1 \
  --update-env-vars DB_PASSWORD=NEW_PASSWORD
```

## 邁｡譏薙ョ繝励Ο繧､繧ｹ繧ｯ繝ｪ繝励ヨ

`deploy.ps1` (Windows) 縺ｾ縺溘・ `deploy.sh` (Mac/Linux) 繧堤ｷｨ髮・＠縺ｦ菴ｿ逕ｨ縺励※縺上□縺輔＞縲・

### 菴ｿ縺・婿

1. 繝輔ぃ繧､繝ｫ繧帝幕縺・
2. PROJECT_ID縲，LOUD_SQL_INSTANCE縲√ヱ繧ｹ繝ｯ繝ｼ繝峨↑縺ｩ繧定ｨｭ螳・
3. 螳溯｡・
   - Windows: `.\deploy.ps1`
   - Mac/Linux: `./deploy.sh`

## 繧ｻ繧ｭ繝･繝ｪ繝・ぅ豕ｨ諢丈ｺ矩・

- JWT_SECRET 縺ｯ蠢・★螟画峩縺励※縺上□縺輔＞
- DB_PASSWORD 縺ｯ蠑ｷ蜉帙↑繝代せ繝ｯ繝ｼ繝峨ｒ險ｭ螳壹＠縺ｦ縺上□縺輔＞
- 譛ｬ逡ｪ迺ｰ蠅・〒縺ｯ `/debug/env` 繧ｨ繝ｳ繝峨・繧､繝ｳ繝医ｒ蜑企勁縺吶ｋ縺薙→繧呈耳螂ｨ
- deploy.ps1 縺ｨ deploy.sh 縺ｫ縺ｯ讖溷ｯ・ュ蝣ｱ縺悟性縺ｾ繧後ｋ縺溘ａ縲・gitignore縺ｫ霑ｽ蜉貂医∩
