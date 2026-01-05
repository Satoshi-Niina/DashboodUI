# GitHub Actions 閾ｪ蜍輔ョ繝励Ο繧､ 繧ｯ繧､繝・け繧ｻ繝・ヨ繧｢繝・・

## 笨・迴ｾ蝨ｨ縺ｮ繧ｹ繝・・繧ｿ繧ｹ
- 繝・・繝ｭ繧､繧ｹ繧ｯ繝ｪ繝励ヨ: 貅門ｙ螳御ｺ・
- GitHub繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ繝輔ぃ繧､繝ｫ: `.github/workflows/deploy.yml` 蟄伜惠
- Cloud Run 繧ｵ繝ｼ繝薙せ: `dashboard-ui` (繝・・繝ｭ繧､貂医∩)
- 繧ｵ繝ｼ繝薙せURL: https://dashboard-ui-u3tejuflja-dt.a.run.app

## 搭 蠢・ｦ√↑GitHub Secrets縺ｮ險ｭ螳・

GitHub繝ｪ繝昴ず繝医Μ縺ｮ Settings > Secrets and variables > Actions 縺ｧ莉･荳九・Secrets繧定ｨｭ螳壹＠縺ｦ縺上□縺輔＞・・

### 1. GCP_PROJECT_ID
```
maint-vehicle-management
```

### 2. CLOUD_SQL_INSTANCE
```
maint-vehicle-management:asia-northeast2:free-trial-first-project
```
笞・・**驥崎ｦ・*: 繧ｾ繝ｼ繝ｳ・・-a`縺ｪ縺ｩ・峨・蜷ｫ繧√↑縺・％縺ｨ・・

### 3. DB_NAME
```
webappdb
```

### 4. DB_USER
```
postgres
```

### 5. DB_PASSWORD
```
Takabeni
```

### 6. JWT_SECRET
```
supersecretkey123
```

### 7. GCP_SA_KEY
繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医・隱崎ｨｼJSON繧ｭ繝ｼ縺悟ｿ・ｦ√〒縺吶ゆｻ･荳九・繧ｳ繝槭Φ繝峨〒菴懈・・・

```powershell
# 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医ｒ菴懈・・医∪縺縺ｪ縺・ｴ蜷茨ｼ・
$SA_NAME = "github-actions-deployer"
$PROJECT_ID = "maint-vehicle-management"

gcloud iam service-accounts create $SA_NAME `
  --display-name="GitHub Actions Deployer" `
  --project=$PROJECT_ID

# 蠢・ｦ√↑讓ｩ髯舌ｒ莉倅ｸ・
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/iam.serviceAccountUser"

# JSON繧ｭ繝ｼ繧剃ｽ懈・
gcloud iam service-accounts keys create github-sa-key.json `
  --iam-account="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# JSON繝輔ぃ繧､繝ｫ縺ｮ蜀・ｮｹ繧竪itHub Secret縺ｫ險ｭ螳・
Get-Content github-sa-key.json
```

菴懈・縺輔ｌ縺櫟SON繝輔ぃ繧､繝ｫ縺ｮ蜀・ｮｹ蜈ｨ菴薙ｒ繧ｳ繝斐・縺励※縲；itHub Secret縺ｮ `GCP_SA_KEY` 縺ｫ險ｭ螳壹＠縺ｦ縺上□縺輔＞縲・

## 噫 菴ｿ逕ｨ譁ｹ豕・

### 閾ｪ蜍輔ョ繝励Ο繧､
`main` 縺ｾ縺溘・ `master` 繝悶Λ繝ｳ繝√↓ push 縺吶ｋ縺ｨ閾ｪ蜍慕噪縺ｫ繝・・繝ｭ繧､縺輔ｌ縺ｾ縺呻ｼ・

```bash
git add .
git commit -m "Update application"
git push origin main
```

### 謇句虚繝・・繝ｭ繧､
GitHub縺ｮ繝ｪ繝昴ず繝医Μ繝壹・繧ｸ縺ｧ・・
1. `Actions` 繧ｿ繝悶ｒ髢九￥
2. `Deploy to Cloud Run` 繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ繧帝∈謚・
3. `Run workflow` 繝懊ち繝ｳ繧偵け繝ｪ繝・け

## 剥 繝・・繝ｭ繧､迥ｶ豕√・遒ｺ隱・

GitHub縺ｮ Actions 繧ｿ繝悶〒繝・・繝ｭ繧､縺ｮ騾ｲ陦檎憾豕√→繝ｭ繧ｰ繧堤｢ｺ隱阪〒縺阪∪縺吶・

## 笞・・繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### Cloud SQL謗･邯壹お繝ｩ繝ｼ
繧ｨ繝ｩ繝ｼ萓・
```
config error: provided region was mismatched
```

**蜴溷屏**: CLOUD_SQL_INSTANCE 縺ｫ繧ｾ繝ｼ繝ｳ・・-a`縺ｪ縺ｩ・峨′蜷ｫ縺ｾ繧後※縺・ｋ

**隗｣豎ｺ**: Secret繧剃ｻ･荳九・蠖｢蠑上↓菫ｮ豁｣
```
PROJECT:REGION:INSTANCE
萓・ maint-vehicle-management:asia-northeast2:free-trial-first-project
```

### 隱崎ｨｼ繧ｨ繝ｩ繝ｼ
- `GCP_SA_KEY` 縺梧ｭ｣縺励￥險ｭ螳壹＆繧後※縺・ｋ縺狗｢ｺ隱・
- 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医↓蠢・ｦ√↑讓ｩ髯舌′莉倅ｸ弱＆繧後※縺・ｋ縺狗｢ｺ隱・

### 繝・・繝ｭ繧､縺ｯ謌仙粥縺吶ｋ縺・00繧ｨ繝ｩ繝ｼ
- Cloud Run縺ｮ繝ｭ繧ｰ繧堤｢ｺ隱・ `gcloud logging read ...`
- 迺ｰ蠅・､画焚縺梧ｭ｣縺励￥險ｭ螳壹＆繧後※縺・ｋ縺狗｢ｺ隱・
- 繝・・繧ｿ繝吶・繧ｹ謗･邯壽ュ蝣ｱ縺梧ｭ｣縺励＞縺狗｢ｺ隱・

## 統 迴ｾ蝨ｨ縺ｮ繝・・繝ｭ繧､繧ｹ繧ｯ繝ｪ繝励ヨ險ｭ螳・

繝ｭ繝ｼ繧ｫ繝ｫ繝・・繝ｭ繧､逕ｨ縺ｮ `deploy.ps1` 縺ｯ莉･荳九・險ｭ螳壹〒蜍穂ｽ懊＠縺ｾ縺呻ｼ・

- 繝励Ο繧ｸ繧ｧ繧ｯ繝・ `maint-vehicle-management`
- 繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ: `asia-northeast2`
- Cloud SQL: `maint-vehicle-management:asia-northeast2:free-trial-first-project`
- 繧ｵ繝ｼ繝薙せ蜷・ `dashboard-ui`

GitHub繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺ｧ繧ょ酔縺倩ｨｭ螳壹′菴ｿ逕ｨ縺輔ｌ縺ｾ縺呻ｼ・ecrets縺九ｉ蜿門ｾ暦ｼ峨・
