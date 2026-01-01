# クイックスタート: GitHub Actionsでデプロイ

## 5分で完了する設定手順

### ステップ1: Cloud SQL情報を取得 (1分)

```powershell
# Windows
.\get-cloudsql-info.ps1
```

または

```bash
# Mac/Linux
chmod +x get-cloudsql-info.sh
./get-cloudsql-info.sh
```

これで必要な情報が全て表示されます。メモしてください。

---

### ステップ2: サービスアカウントを作成 (2分)

```bash
# プロジェクトIDを設定
export PROJECT_ID="YOUR_PROJECT_ID"

# サービスアカウント作成
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID

# 権限付与（1つのコマンドで実行）
for role in roles/run.admin roles/cloudsql.client roles/iam.serviceAccountUser roles/storage.admin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="$role"
done

# JSONキー作成
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com

# キーの内容を表示（これをコピー）
cat key.json
```

**Windows PowerShellの場合:**
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

### ステップ3: GitHub Secretsを設定 (2分)

1. GitHubリポジトリを開く
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** で以下を追加：

| Secret名 | 値 |
|---------|---|
| GCP_PROJECT_ID | ステップ1で取得 |
| GCP_SA_KEY | key.jsonの内容を**全てコピー** |
| CLOUD_SQL_INSTANCE | ステップ1で取得 |
| DB_NAME | webappdb |
| DB_USER | postgres |
| DB_PASSWORD | Cloud SQLのパスワード |
| JWT_SECRET | ランダムな長い文字列 |

**JWT_SECRETの生成:**
```bash
# Mac/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

### ステップ4: デプロイ実行！ (即座に)

```bash
git add .
git commit -m "Setup GitHub Actions deployment"
git push origin main
```

GitHubの **Actions** タブでデプロイの進行状況を確認できます。

---

## 確認

デプロイ完了後、GitHub Actionsのログに表示されるURLにアクセス：

```
🌐 Service URL: https://dashboard-ui-xxxxx-an.a.run.app
```

ログイン画面が表示されればOK！

---

## トラブルシューティング

### エラーが出た場合

1. **GitHub Actionsのログを確認**
   - GitHubの **Actions** タブ → 失敗したワークフローをクリック

2. **よくあるエラー**
   - "Invalid cloud sql instance" → CLOUD_SQL_INSTANCEの形式を確認
   - "Permission denied" → サービスアカウントの権限を再確認
   - "Database connection error" → DB_PASSWORDが正しいか確認

3. **ログで詳細確認**
   ```bash
   gcloud run services logs read dashboard-ui --limit=50
   ```

---

## 詳細ドキュメント

- **詳しい設定手順**: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)
- **デプロイトラブルシューティング**: [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)
