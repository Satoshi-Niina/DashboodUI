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

##  本番デプロイ（Cloud Run）

\\\ash
gcloud run deploy dashboard-ui --source . --allow-unauthenticated
\\\

##  ライセンス

All Rights Reserved  2026
