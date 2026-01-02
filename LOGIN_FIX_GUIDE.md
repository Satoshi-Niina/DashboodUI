# ログイン問題の診断と解決手順（本番環境）

## 問題の概要
デプロイ後、`niina` / `G&896845` でログインできない

## 診断ステップ

### ステップ1: GitHubシークレットの確認

GitHubリポジトリで以下のシークレットが設定されているか確認:

1. リポジトリページ → **Settings** → **Secrets and variables** → **Actions**
2. 以下のシークレットが存在することを確認:
   - ✅ `GCP_PROJECT_ID`
   - ✅ `GCP_SA_KEY`
   - ✅ `CLOUD_SQL_INSTANCE` (形式: `project-id:region:instance-name`)
   - ✅ `DB_NAME` (webappdb)
   - ✅ `DB_USER` (postgres)
   - ✅ `DB_PASSWORD`
   - ✅ `JWT_SECRET`

### ステップ2: Cloud SQLに直接接続してユーザーを確認

#### 方法1: Cloud Consoleから実行（推奨）

1. [Cloud SQL Console](https://console.cloud.google.com/sql/instances) を開く
2. インスタンスを選択
3. 左メニューの **「クエリ」** タブをクリック
4. 以下のSQLを実行:

```sql
-- niinaユーザーが存在するか確認
SELECT id, username, display_name, role, 
       LEFT(password, 20) as password_hash_preview
FROM master_data.users 
WHERE username = 'niina';
```

**結果が空の場合 → ユーザーが存在しない**
以下のSQLで作成:

```sql
-- niinaユーザーを作成
INSERT INTO master_data.users (username, password, display_name, email, role)
VALUES (
  'niina', 
  '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq', 
  '新名 諭', 
  'niina@example.com', 
  'admin'
)
ON CONFLICT (username) DO NOTHING;
```

**結果がある場合 → パスワードハッシュを更新**

```sql
-- パスワードハッシュを正しい値に更新
UPDATE master_data.users 
SET 
    password = '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq',
    role = 'admin',
    updated_at = CURRENT_TIMESTAMP
WHERE username = 'niina';
```

#### 方法2: gcloudコマンドで接続

```powershell
# PowerShell
# インスタンス名を取得
$INSTANCES = gcloud sql instances list --format="value(name)"
$INSTANCE_NAME = $INSTANCES[0]

# Cloud SQL Proxyを使って接続
gcloud sql connect $INSTANCE_NAME --user=postgres --database=webappdb
```

接続後、上記のSQLを実行

### ステップ3: アプリケーションログの確認

```powershell
# 最新のログを確認
gcloud run services logs read dashboard-ui --region=asia-northeast1 --limit=50

# エラーだけ抽出
gcloud run services logs read dashboard-ui --region=asia-northeast1 --limit=100 | Select-String -Pattern "error|Error|ERROR|database|Database"
```

**よくあるエラー:**

1. **"Database connection error"**
   - Cloud SQL接続の設定ミス
   - `CLOUD_SQL_INSTANCE` が正しくない
   - Cloud Runに `--add-cloudsql-instances` が設定されていない

2. **"password authentication failed"**
   - `DB_PASSWORD` が間違っている
   - Cloud SQLのpostgresパスワードを確認

3. **"relation master_data.users does not exist"**
   - データベースにテーブルが作成されていない
   - `database-setup.sql` を実行する必要がある

### ステップ4: データベーステーブルの確認

Cloud SQLコンソールで以下を実行:

```sql
-- スキーマとテーブルの存在確認
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema = 'master_data' 
  AND table_name = 'users';
```

**結果が空の場合:**
- データベースセットアップが必要
- `database-setup.sql` を実行してください

### ステップ5: データベースセットアップの実行

#### Cloud Consoleから実行（推奨）

1. Cloud SQL Console → インスタンス → **クエリ** タブ
2. [database-setup.sql](./database-setup.sql) の内容をコピー＆ペースト
3. 実行

#### または、ローカルから実行

```powershell
# Cloud SQL Proxyを起動
./cloud-sql-proxy YOUR_PROJECT:REGION:INSTANCE_NAME &

# PostgreSQLクライアントで接続
$env:PGPASSWORD="YOUR_PASSWORD"
psql -h localhost -U postgres -d webappdb -f database-setup.sql
```

### ステップ6: 環境変数の再確認

現在デプロイされているサービスの環境変数を確認:

```powershell
gcloud run services describe dashboard-ui --region=asia-northeast1 --format=json | ConvertFrom-Json | Select-Object -ExpandProperty spec | Select-Object -ExpandProperty template | Select-Object -ExpandProperty spec | Select-Object -ExpandProperty containers | Select-Object -ExpandProperty env
```

### ステップ7: 再デプロイ（必要に応じて）

GitHubシークレットを修正した後:

1. **手動でワークフローを実行:**
   - リポジトリページ → **Actions** タブ
   - **Deploy to Cloud Run** ワークフローを選択
   - **Run workflow** → **Run workflow**

2. **またはコードをpush:**
   ```powershell
   git commit --allow-empty -m "Trigger redeploy"
   git push
   ```

## クイックチェックリスト

- [ ] GitHubシークレット `CLOUD_SQL_INSTANCE` が正しい（`project:region:instance` 形式）
- [ ] GitHubシークレット `DB_PASSWORD` がCloud SQLのpostgresパスワードと一致
- [ ] GitHubシークレット `JWT_SECRET` が設定されている（ランダムな長い文字列）
- [ ] Cloud SQLに `webappdb` データベースが存在
- [ ] `master_data.users` テーブルが存在
- [ ] `niina` ユーザーが正しいパスワードハッシュで登録されている
- [ ] Cloud Runサービスに `--add-cloudsql-instances` が設定されている

## ログインテスト

修正後、以下でテスト:

```powershell
# サービスURLを取得
$SERVICE_URL = gcloud run services describe dashboard-ui --region=asia-northeast1 --format='value(status.url)'

# ブラウザで開く
Start-Process $SERVICE_URL

# またはcurlでログインAPIをテスト
$body = @{
    username = "niina"
    password = "G&896845"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$SERVICE_URL/api/login" -Method POST -Body $body -ContentType "application/json"
```

成功時のレスポンス:
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": {
    "username": "niina",
    "displayName": "新名 諭",
    "role": "admin"
  }
}
```

## トラブルシューティング

### ログインAPIが404エラー
- サーバーが起動していない
- ルーティング設定を確認

### ログインAPIが500エラー
- データベース接続エラー
- ログを確認: `gcloud run services logs read dashboard-ui --limit=50`

### ログインAPIが401エラー
- ユーザー名またはパスワードが間違っている
- Cloud SQLでユーザーとパスワードハッシュを確認

## サポート情報

パスワード `G&896845` の正しいbcryptハッシュ:
```
$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq
```

このハッシュは `fix-login.js` で検証済みです。
