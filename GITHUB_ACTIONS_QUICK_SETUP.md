# GitHub Actions 自動デプロイ クイックセットアップ

## ✅ 現在のステータス
- デプロイスクリプト: 準備完了
- GitHubワークフローファイル: `.github/workflows/deploy.yml` 存在
- Cloud Run サービス: `dashboard-ui` (デプロイ済み)
- サービスURL: https://dashboard-ui-u3tejuflja-dt.a.run.app

## 📋 必要なGitHub Secretsの設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下のSecretsを設定してください：

### 1. GCP_PROJECT_ID
```
maint-vehicle-management
```

### 2. CLOUD_SQL_INSTANCE
```
maint-vehicle-management:asia-northeast2:free-trial-first-project
```
⚠️ **重要**: ゾーン（`-a`など）は含めないこと！

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
サービスアカウントの認証JSONキーが必要です。以下のコマンドで作成：

```powershell
# サービスアカウントを作成（まだない場合）
$SA_NAME = "github-actions-deployer"
$PROJECT_ID = "maint-vehicle-management"

gcloud iam service-accounts create $SA_NAME `
  --display-name="GitHub Actions Deployer" `
  --project=$PROJECT_ID

# 必要な権限を付与
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

# JSONキーを作成
gcloud iam service-accounts keys create github-sa-key.json `
  --iam-account="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# JSONファイルの内容をGitHub Secretに設定
Get-Content github-sa-key.json
```

作成されたJSONファイルの内容全体をコピーして、GitHub Secretの `GCP_SA_KEY` に設定してください。

## 🚀 使用方法

### 自動デプロイ
`main` または `master` ブランチに push すると自動的にデプロイされます：

```bash
git add .
git commit -m "Update application"
git push origin main
```

### 手動デプロイ
GitHubのリポジトリページで：
1. `Actions` タブを開く
2. `Deploy to Cloud Run` ワークフローを選択
3. `Run workflow` ボタンをクリック

## 🔍 デプロイ状況の確認

GitHubの Actions タブでデプロイの進行状況とログを確認できます。

## ⚠️ トラブルシューティング

### Cloud SQL接続エラー
エラー例:
```
config error: provided region was mismatched
```

**原因**: CLOUD_SQL_INSTANCE にゾーン（`-a`など）が含まれている

**解決**: Secretを以下の形式に修正
```
PROJECT:REGION:INSTANCE
例: maint-vehicle-management:asia-northeast2:free-trial-first-project
```

### 認証エラー
- `GCP_SA_KEY` が正しく設定されているか確認
- サービスアカウントに必要な権限が付与されているか確認

### デプロイは成功するが500エラー
- Cloud Runのログを確認: `gcloud logging read ...`
- 環境変数が正しく設定されているか確認
- データベース接続情報が正しいか確認

## 📝 現在のデプロイスクリプト設定

ローカルデプロイ用の `deploy.ps1` は以下の設定で動作します：

- プロジェクト: `maint-vehicle-management`
- リージョン: `asia-northeast2`
- Cloud SQL: `maint-vehicle-management:asia-northeast2:free-trial-first-project`
- サービス名: `dashboard-ui`

GitHubアクションでも同じ設定が使用されます（Secretsから取得）。
