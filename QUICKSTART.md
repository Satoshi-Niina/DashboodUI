# 繧ｯ繧､繝・け繧ｹ繧ｿ繝ｼ繝・ GitHub Actions縺ｧ繝・・繝ｭ繧､

## 5蛻・〒螳御ｺ・☆繧玖ｨｭ螳壽焔鬆・

### 繧ｹ繝・ャ繝・: Cloud SQL諠・ｱ繧貞叙蠕・(1蛻・

```powershell
# Windows
.\get-cloudsql-info.ps1
```

縺ｾ縺溘・

```bash
# Mac/Linux
chmod +x get-cloudsql-info.sh
./get-cloudsql-info.sh
```

縺薙ｌ縺ｧ蠢・ｦ√↑諠・ｱ縺悟・縺ｦ陦ｨ遉ｺ縺輔ｌ縺ｾ縺吶ゅΓ繝｢縺励※縺上□縺輔＞縲・

---

### 繧ｹ繝・ャ繝・: 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医ｒ菴懈・ (2蛻・

```bash
# 繝励Ο繧ｸ繧ｧ繧ｯ繝・D繧定ｨｭ螳・
export PROJECT_ID="YOUR_PROJECT_ID"

# 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID

# 讓ｩ髯蝉ｻ倅ｸ趣ｼ・縺､縺ｮ繧ｳ繝槭Φ繝峨〒螳溯｡鯉ｼ・
for role in roles/run.admin roles/cloudsql.client roles/iam.serviceAccountUser roles/storage.admin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="$role"
done

# JSON繧ｭ繝ｼ菴懈・
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com

# 繧ｭ繝ｼ縺ｮ蜀・ｮｹ繧定｡ｨ遉ｺ・医％繧後ｒ繧ｳ繝斐・・・
cat key.json
```

**Windows PowerShell縺ｮ蝣ｴ蜷・**
```powershell
$PROJECT_ID = "YOUR_PROJECT_ID"

gcloud iam service-accounts create github-actions-deployer `
  --display-name="GitHub Actions Deployer" `
  --project=$PROJECT_ID

$roles = @("roles/run.admin", "roles/cloudsql.client", "roles/iam.serviceAccountUser", "roles/storage.admin")
foreach ($role in $roles) {
  gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" `
    --role="$role"
}

gcloud iam service-accounts keys create key.json `
  --iam-account=github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com

Get-Content key.json
```

---

### 繧ｹ繝・ャ繝・: GitHub Secrets繧定ｨｭ螳・(2蛻・

1. GitHub繝ｪ繝昴ず繝医Μ繧帝幕縺・
2. **Settings** 竊・**Secrets and variables** 竊・**Actions**
3. **New repository secret** 縺ｧ莉･荳九ｒ霑ｽ蜉・・

| Secret蜷・| 蛟､ |
|---------|---|
| GCP_PROJECT_ID | 繧ｹ繝・ャ繝・縺ｧ蜿門ｾ・|
| GCP_SA_KEY | key.json縺ｮ蜀・ｮｹ繧・*蜈ｨ縺ｦ繧ｳ繝斐・** |
| CLOUD_SQL_INSTANCE | 繧ｹ繝・ャ繝・縺ｧ蜿門ｾ・|
| DB_NAME | webappdb |
| DB_USER | postgres |
| DB_PASSWORD | Cloud SQL縺ｮ繝代せ繝ｯ繝ｼ繝・|
| JWT_SECRET | 繝ｩ繝ｳ繝繝縺ｪ髟ｷ縺・枚蟄怜・ |

**JWT_SECRET縺ｮ逕滓・:**
```bash
# Mac/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

### 繧ｹ繝・ャ繝・: 繝・・繝ｭ繧､螳溯｡鯉ｼ・(蜊ｳ蠎ｧ縺ｫ)

```bash
git add .
git commit -m "Setup GitHub Actions deployment"
git push origin main
```

GitHub縺ｮ **Actions** 繧ｿ繝悶〒繝・・繝ｭ繧､縺ｮ騾ｲ陦檎憾豕√ｒ遒ｺ隱阪〒縺阪∪縺吶・

---

## 遒ｺ隱・

繝・・繝ｭ繧､螳御ｺ・ｾ後；itHub Actions縺ｮ繝ｭ繧ｰ縺ｫ陦ｨ遉ｺ縺輔ｌ繧偽RL縺ｫ繧｢繧ｯ繧ｻ繧ｹ・・

```
倹 Service URL: https://dashboard-ui-xxxxx-an.a.run.app
```

繝ｭ繧ｰ繧､繝ｳ逕ｻ髱｢縺瑚｡ｨ遉ｺ縺輔ｌ繧後・OK・・

---

## 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### 繧ｨ繝ｩ繝ｼ縺悟・縺溷ｴ蜷・

1. **GitHub Actions縺ｮ繝ｭ繧ｰ繧堤｢ｺ隱・*
   - GitHub縺ｮ **Actions** 繧ｿ繝・竊・螟ｱ謨励＠縺溘Ρ繝ｼ繧ｯ繝輔Ο繝ｼ繧偵け繝ｪ繝・け

2. **繧医￥縺ゅｋ繧ｨ繝ｩ繝ｼ**
   - "Invalid cloud sql instance" 竊・CLOUD_SQL_INSTANCE縺ｮ蠖｢蠑上ｒ遒ｺ隱・
   - "Permission denied" 竊・繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医・讓ｩ髯舌ｒ蜀咲｢ｺ隱・
   - "Database connection error" 竊・DB_PASSWORD縺梧ｭ｣縺励＞縺狗｢ｺ隱・

3. **繝ｭ繧ｰ縺ｧ隧ｳ邏ｰ遒ｺ隱・*
   ```bash
   gcloud run services logs read dashboard-ui --limit=50
   ```

---

## 隧ｳ邏ｰ繝峨く繝･繝｡繝ｳ繝・

- **隧ｳ縺励＞險ｭ螳壽焔鬆・*: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)
- **繝・・繝ｭ繧､繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ**: [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)
