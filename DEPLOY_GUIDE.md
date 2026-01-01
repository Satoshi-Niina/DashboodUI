# Cloud Run デプロイ手順

## デプロイ後にログインできない問題の解決方法

### 問題の原因
データベース接続の環境変数が正しく設定されていない

### 解決手順

#### 1. Cloud SQLインスタンス接続名を確認
```bash
gcloud sql instances describe [インスタンス名] --format="value(connectionName)"
```

例: `my-project:asia-northeast1:webappdb-instance`

#### 2. 環境変数を設定して再デプロイ

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

#### 3. デプロイ後の確認

**ヘルスチェック:**
```bash
curl https://YOUR_SERVICE_URL/health
```

正常な応答:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

**環境変数の確認（デバッグ用）:**
```bash
curl https://YOUR_SERVICE_URL/debug/env
```

#### 4. ログの確認

```bash
# 最新50件のログを確認
gcloud run services logs read dashboard-ui --limit=50

# データベース関連のエラーだけ確認
gcloud run services logs read dashboard-ui --limit=100 | grep -i "database\|connection\|error"
```

#### 5. よくあるエラーと対処法

**エラー: "Database connection error"**
- CLOUD_SQL_INSTANCE が正しく設定されているか確認
- --add-cloudsql-instances フラグを付けてデプロイしたか確認

**エラー: "password authentication failed"**
- DB_USER と DB_PASSWORD が正しいか確認
- Cloud SQLのユーザー権限を確認

**エラー: "could not connect to server"**
- Cloud SQLインスタンスが起動しているか確認
- ネットワーク設定を確認

#### 6. 環境変数の更新のみ（再ビルドなし）

すでにデプロイ済みで環境変数だけ変更したい場合:

```bash
gcloud run services update dashboard-ui \
  --region=asia-northeast1 \
  --update-env-vars DB_PASSWORD=NEW_PASSWORD
```

## 簡易デプロイスクリプト

`deploy.ps1` (Windows) または `deploy.sh` (Mac/Linux) を編集して使用してください。

### 使い方

1. ファイルを開く
2. PROJECT_ID、CLOUD_SQL_INSTANCE、パスワードなどを設定
3. 実行:
   - Windows: `.\deploy.ps1`
   - Mac/Linux: `./deploy.sh`

## セキュリティ注意事項

- JWT_SECRET は必ず変更してください
- DB_PASSWORD は強力なパスワードを設定してください
- 本番環境では `/debug/env` エンドポイントを削除することを推奨
- deploy.ps1 と deploy.sh には機密情報が含まれるため、.gitignoreに追加済み
