# GitHub Actions 閾ｪ蜍輔ョ繝励Ο繧､險ｭ螳壹ぎ繧､繝・

## 讎りｦ・
縺薙・繧ｬ繧､繝峨〒縺ｯ縲；itHub縺ｫpush縺吶ｋ縺縺代〒Cloud Run縺ｸ閾ｪ蜍輔ョ繝励Ο繧､縺輔ｌ繧玖ｨｭ螳壹ｒ陦後＞縺ｾ縺吶・

## 蜑肴署譚｡莉ｶ
- GitHub繝ｪ繝昴ず繝医Μ縺御ｽ懈・貂医∩
- Google Cloud Project縺御ｽ懈・貂医∩
- Cloud SQL繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ縺御ｽ懈・貂医∩

---

## 1. Cloud SQL 繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ謗･邯壼錐縺ｮ遒ｺ隱・

```bash
gcloud sql instances describe YOUR_INSTANCE_NAME --format="value(connectionName)"
```

蜃ｺ蜉帑ｾ・ `my-project:asia-northeast1:webappdb-instance`

縺薙・蛟､繧呈而縺医※縺翫＞縺ｦ縺上□縺輔＞縲・

---

## 2. Google Cloud 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医・菴懈・

### 2.1 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・
```bash
# 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝亥錐繧定ｨｭ螳・
export SA_NAME="github-actions-deployer"
export PROJECT_ID="YOUR_PROJECT_ID"

# 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・
gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID
```

### 2.2 蠢・ｦ√↑讓ｩ髯舌ｒ莉倅ｸ・
```bash
# Cloud Run邂｡逅・・ｨｩ髯・
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Cloud SQL繧ｯ繝ｩ繧､繧｢繝ｳ繝域ｨｩ髯・
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医Θ繝ｼ繧ｶ繝ｼ讓ｩ髯・
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Storage邂｡逅・・ｨｩ髯撰ｼ医ン繝ｫ繝画凾縺ｫ蠢・ｦ・ｼ・
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### 2.3 JSON繧ｭ繝ｼ繝輔ぃ繧､繝ｫ繧剃ｽ懈・
```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com

# 繧ｭ繝ｼ繝輔ぃ繧､繝ｫ縺ｮ蜀・ｮｹ繧定｡ｨ遉ｺ・医％繧後ｒGitHub Secrets縺ｫ逋ｻ骭ｲ縺励∪縺呻ｼ・
cat key.json
```

**笞・・驥崎ｦ・ 縺薙・JSON繝輔ぃ繧､繝ｫ縺ｯ讖溷ｯ・ュ蝣ｱ縺ｧ縺吶ょｮ牙・縺ｫ菫晉ｮ｡縺励※縺上□縺輔＞縲・*

---

## 3. GitHub Secrets 縺ｮ險ｭ螳・

GitHub繝ｪ繝昴ず繝医Μ縺ｧ莉･荳九・Secrets繧定ｨｭ螳壹＠縺ｾ縺呻ｼ・

1. GitHub繝ｪ繝昴ず繝医Μ繝壹・繧ｸ繧帝幕縺・
2. **Settings** 竊・**Secrets and variables** 竊・**Actions** 繧帝∈謚・
3. **New repository secret** 繧偵け繝ｪ繝・け縺励※縲∽ｻ･荳九ｒ鬆・分縺ｫ霑ｽ蜉・・

### 蠢・・ecrets荳隕ｧ

| Secret蜷・| 蛟､縺ｮ萓・| 隱ｬ譏・|
|---------|-------|------|
| `GCP_PROJECT_ID` | `my-project-123` | Google Cloud縺ｮ繝励Ο繧ｸ繧ｧ繧ｯ繝・D |
| `GCP_SA_KEY` | `{"type":"service_account",...}` | 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医・JSON繧ｭ繝ｼ蜈ｨ菴・|
| `CLOUD_SQL_INSTANCE` | `my-project:asia-northeast1:webappdb` | Cloud SQL繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ謗･邯壼錐 |
| `DB_NAME` | `webappdb` | 繝・・繧ｿ繝吶・繧ｹ蜷・|
| `DB_USER` | `postgres` | 繝・・繧ｿ繝吶・繧ｹ繝ｦ繝ｼ繧ｶ繝ｼ蜷・|
| `DB_PASSWORD` | `your-secure-password` | 繝・・繧ｿ繝吶・繧ｹ繝代せ繝ｯ繝ｼ繝・|
| `JWT_SECRET` | `your-super-secret-jwt-key` | JWT鄂ｲ蜷咲畑縺ｮ遘伜ｯ・嵯・医Λ繝ｳ繝繝縺ｪ髟ｷ縺・枚蟄怜・・・|

### Secrets縺ｮ霑ｽ蜉謇矩・

#### GCP_SA_KEY 縺ｮ險ｭ螳・
1. 蜈医⊇縺ｩ菴懈・縺励◆ `key.json` 縺ｮ蜀・ｮｹ繧・*蜈ｨ縺ｦ繧ｳ繝斐・**
2. GitHub Secrets 縺ｮ Name 縺ｫ `GCP_SA_KEY` 繧貞・蜉・
3. Value 縺ｫ JSON縺ｮ蜀・ｮｹ繧・*縺昴・縺ｾ縺ｾ雋ｼ繧贋ｻ倥￠**
4. **Add secret** 繧偵け繝ｪ繝・け

#### CLOUD_SQL_INSTANCE 縺ｮ險ｭ螳・
1. Name: `CLOUD_SQL_INSTANCE`
2. Value: `PROJECT_ID:REGION:INSTANCE_NAME` 縺ｮ蠖｢蠑・
   - 萓・ `my-project:asia-northeast1:webappdb-instance`
3. **Add secret** 繧偵け繝ｪ繝・け

莉悶・Secrets繧ょ酔讒倥↓霑ｽ蜉縺励※縺上□縺輔＞縲・

---

## 4. 繝・・繝ｭ繧､縺ｮ繝・せ繝・

### 4.1 謇句虚螳溯｡後〒繝・せ繝・

1. GitHub繝ｪ繝昴ず繝医Μ縺ｮ **Actions** 繧ｿ繝悶ｒ髢九￥
2. 蟾ｦ蛛ｴ縺九ｉ **Deploy to Cloud Run** 繧帝∈謚・
3. 蜿ｳ荳翫・ **Run workflow** 繧偵け繝ｪ繝・け
4. **Run workflow** 繝懊ち繝ｳ繧偵け繝ｪ繝・け縺励※螳溯｡・

### 4.2 閾ｪ蜍輔ョ繝励Ο繧､縺ｮ繝・せ繝・

```bash
# 繝ｭ繝ｼ繧ｫ繝ｫ縺ｧ螟画峩繧偵さ繝溘ャ繝・
git add .
git commit -m "Test GitHub Actions deployment"
git push origin main
```

GitHub縺ｮ **Actions** 繧ｿ繝悶〒繝・・繝ｭ繧､縺ｮ騾ｲ陦檎憾豕√ｒ遒ｺ隱阪〒縺阪∪縺吶・

---

## 5. 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### 繧ｨ繝ｩ繝ｼ: "Invalid cloud sql instance names"

**蜴溷屏**: CLOUD_SQL_INSTANCE縺ｮ蠖｢蠑上′豁｣縺励￥縺ｪ縺・

**隗｣豎ｺ遲・*:
```bash
# 豁｣縺励＞謗･邯壼錐繧堤｢ｺ隱・
gcloud sql instances list --format="value(connectionName)"

# GitHub Secrets繧呈峩譁ｰ
```

### 繧ｨ繝ｩ繝ｼ: "Permission denied"

**蜴溷屏**: 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医↓蠢・ｦ√↑讓ｩ髯舌′縺ｪ縺・

**隗｣豎ｺ遲・*: 讓ｩ髯舌ｒ蜀榊ｺｦ莉倅ｸ・
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```

### 繧ｨ繝ｩ繝ｼ: "Database connection error"

**蜴溷屏**: DB_PASSWORD 繧・CLOUD_SQL_INSTANCE 縺碁俣驕輔▲縺ｦ縺・ｋ

**隗｣豎ｺ遲・*:
1. GitHub Secrets縺ｮ蛟､繧堤｢ｺ隱・
2. Cloud SQL繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ縺瑚ｵｷ蜍輔＠縺ｦ縺・ｋ縺狗｢ｺ隱・
3. 繝・・繝ｭ繧､蠕後↓ `/health` 繧ｨ繝ｳ繝峨・繧､繝ｳ繝医ｒ遒ｺ隱・

```bash
# 繝・・繝ｭ繧､縺輔ｌ縺溘し繝ｼ繝薙せ縺ｮURL繧貞叙蠕・
gcloud run services describe dashboard-ui \
  --region=asia-northeast1 \
  --format='value(status.url)'

# 繝倥Ν繧ｹ繝√ぉ繝・け
curl https://YOUR_SERVICE_URL/health
```

### 繝ｭ繧ｰ縺ｮ遒ｺ隱肴婿豕・

```bash
# 譛譁ｰ縺ｮ繝ｭ繧ｰ繧堤｢ｺ隱・
gcloud run services logs read dashboard-ui \
  --region=asia-northeast1 \
  --limit=50

# 繧ｨ繝ｩ繝ｼ縺縺代ヵ繧｣繝ｫ繧ｿ
gcloud run services logs read dashboard-ui \
  --region=asia-northeast1 \
  --limit=100 | grep -i error
```

---

## 6. 繧ｻ繧ｭ繝･繝ｪ繝・ぅ縺ｮ繝吶せ繝医・繝ｩ繧ｯ繝・ぅ繧ｹ

### 譛ｬ逡ｪ迺ｰ蠅・〒縺ｯ蠢・★螳滓命縺吶ｋ縺薙→

1. **JWT_SECRET縺ｮ螟画峩**
   ```bash
   # 繝ｩ繝ｳ繝繝縺ｪ遘伜ｯ・嵯繧堤函謌・
   openssl rand -base64 32
   ```

2. **DB_PASSWORD縺ｮ蠑ｷ蛹・*
   - 譛菴・6譁・ｭ嶺ｻ･荳・
   - 闍ｱ謨ｰ蟄暦ｼ玖ｨ伜捷繧貞性繧

3. **繝・ヰ繝・げ繧ｨ繝ｳ繝峨・繧､繝ｳ繝医・蜑企勁**
   - server.js縺ｮ `/debug/env` 繧ｨ繝ｳ繝峨・繧､繝ｳ繝医ｒ蜑企勁
   
4. **繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医く繝ｼ縺ｮ螳壽悄繝ｭ繝ｼ繝・・繧ｷ繝ｧ繝ｳ**
   ```bash
   # 蜿､縺・く繝ｼ繧貞炎髯､
   gcloud iam service-accounts keys list \
     --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com
   
   gcloud iam service-accounts keys delete KEY_ID \
     --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com
   ```

---

## 7. 繝・・繝ｭ繧､繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ縺ｮ隱ｬ譏・

迴ｾ蝨ｨ縺ｮ險ｭ螳壹〒縺ｯ莉･荳九・繧ｿ繧､繝溘Φ繧ｰ縺ｧ繝・・繝ｭ繧､縺悟ｮ溯｡後＆繧後∪縺呻ｼ・

1. **閾ｪ蜍輔ョ繝励Ο繧､**: `main` 縺ｾ縺溘・ `master` 繝悶Λ繝ｳ繝√↓push縺励◆譎・
2. **謇句虚繝・・繝ｭ繧､**: GitHub Actions繝壹・繧ｸ縺九ｉ謇句虚螳溯｡・

繝・・繝ｭ繧､縺ｮ豬√ｌ・・
1. 繧ｽ繝ｼ繧ｹ繧ｳ繝ｼ繝峨ｒ繝√ぉ繝・け繧｢繧ｦ繝・
2. Google Cloud隱崎ｨｼ
3. Cloud SQL謗･邯壼錐縺ｮ讀懆ｨｼ
4. Cloud Run縺ｸ繝・・繝ｭ繧､
5. 繝倥Ν繧ｹ繝√ぉ繝・け螳溯｡・
6. 繝・・繝ｭ繧､邨先棡陦ｨ遉ｺ

---

## 8. 謌仙粥縺ｮ遒ｺ隱・

繝・・繝ｭ繧､縺梧・蜉溘☆繧九→縲；itHub Actions縺ｮ繝ｭ繧ｰ縺ｫ莉･荳九′陦ｨ遉ｺ縺輔ｌ縺ｾ縺呻ｼ・

```
笨・Deployment completed successfully!
倹 Service URL: https://dashboard-ui-xxxxx-an.a.run.app
剥 Health Check: https://dashboard-ui-xxxxx-an.a.run.app/health
菅 Debug Info: https://dashboard-ui-xxxxx-an.a.run.app/debug/env
```

陦ｨ遉ｺ縺輔ｌ縺欟RL縺ｫ繧｢繧ｯ繧ｻ繧ｹ縺励※縲√Ο繧ｰ繧､繝ｳ逕ｻ髱｢縺瑚｡ｨ遉ｺ縺輔ｌ繧九％縺ｨ繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・

---

## 蜿り・Μ繝ｳ繧ｯ

- [GitHub Actions 繝峨く繝･繝｡繝ｳ繝・(https://docs.github.com/ja/actions)
- [Cloud Run 繝・・繝ｭ繧､繧ｬ繧､繝云(https://cloud.google.com/run/docs/deploying)
- [Cloud SQL 謗･邯壹ぎ繧､繝云(https://cloud.google.com/sql/docs/postgres/connect-run)
