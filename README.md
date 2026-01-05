# 保守用車運用管理センター（ダッシュボードUI）

統合管理システムのメインダッシュボードアプリケーション

##  ローカル起動

### 1. 環境設定
\\\ash
# .envファイルを作成（.env.exampleを参考に）
cp .env.example .env
\\\

### 2. データベースセットアップ
\\\ash
# PostgreSQLに接続してスキーマを作成
psql -U postgres -d webappdb -f database-setup.sql
\\\

### 3. 依存関係インストール
\\\ash
npm install
\\\

### 4. アプリ起動
\\\ash
npm start
\\\

ブラウザが自動で開いて http://localhost:3000 にアクセスします。

**デフォルトログイン情報:**
- ユーザー名: \dmin\
- パスワード: \dmin123\

##  必須ファイル

- \server.js\ - バックエンドサーバー
- \index.html\, \login.html\, \dmin.html\ - UI
- \pp.js\, \login.js\, \dmin.js\ - フロントエンドJS
- \package.json\ - 依存関係
- \.env\ - 環境変数
- \database-setup.sql\ - DB初期化
- \shared-db-config.js\ - 統一DB接続

##  本番デプロイ

### 🚀 推奨: GitHub Actions 自動デプロイ

GitHubにpushするだけで自動的にCloud Runへデプロイされます。

**設定手順**: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) を参照

**特徴**:
- ✅ mainブランチへのpushで自動デプロイ
- ✅ 環境変数をGitHub Secretsで安全に管理
- ✅ Cloud SQL接続名の検証機能
- ✅ デプロイ後のヘルスチェック自動実行
- ✅ 手動実行にも対応

### 手動デプロイ（Cloud Run CLI）

#### Cloud SQL接続の設定

1. **Cloud SQLインスタンスの接続名を確認**
```bash
gcloud sql instances describe [INSTANCE_NAME] --format="value(connectionName)"
# 例: my-project:asia-northeast1:webappdb-instance
```

2. **環境変数を設定してデプロイ**
```bash
gcloud run deploy dashboard-ui \
  --source . \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars CLOUD_SQL_INSTANCE=YOUR_PROJECT:REGION:INSTANCE_NAME \
  --set-env-vars DB_NAME=webappdb \
  --set-env-vars DB_USER=postgres \
  --set-env-vars DB_PASSWORD=YOUR_DB_PASSWORD \
  --set-env-vars JWT_SECRET=YOUR_SECURE_JWT_SECRET \
  --set-env-vars CORS_ORIGIN=* \
  --add-cloudsql-instances YOUR_PROJECT:REGION:INSTANCE_NAME
```

3. **または、シークレットを使用する場合**
```bash
# シークレットを作成
gcloud secrets create db-password --data-file=- <<EOF
YOUR_DB_PASSWORD
EOF

# シークレットを使ってデプロイ
gcloud run deploy dashboard-ui \
  --source . \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars CLOUD_SQL_INSTANCE=YOUR_PROJECT:REGION:INSTANCE_NAME \
  --set-env-vars DB_NAME=webappdb \
  --set-env-vars DB_USER=postgres \
  --set-env-vars JWT_SECRET=YOUR_SECURE_JWT_SECRET \
  --set-secrets DB_PASSWORD=db-password:latest \
  --add-cloudsql-instances YOUR_PROJECT:REGION:INSTANCE_NAME
```

### トラブルシューティング

**ログインできない場合:**
```bash
# ログを確認
gcloud run services logs read dashboard-ui --limit=50

# データベース接続エラーを確認
gcloud run services logs read dashboard-ui --limit=50 | grep -i "database\|connection"
```

**よくある問題:**
- `CLOUD_SQL_INSTANCE`環境変数が設定されていない
- `--add-cloudsql-instances`フラグが抜けている
- DB_USER、DB_PASSWORD、DB_NAMEが正しくない
- Cloud SQLインスタンスが起動していない

### 簡易デプロイ（開発環境）
```bash
gcloud run deploy dashboard-ui --source . --allow-unauthenticated
```

### 詳細ガイド

- **GitHub Actions設定**: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)
- **デプロイ手順詳細**: [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)

##  ライセンス

All Rights Reserved  2026
