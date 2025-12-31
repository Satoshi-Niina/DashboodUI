# Dashboard UI - 統合認証システム

GCP Cloud Run にデプロイ可能な認証ダッシュボードシステム

## 機能

- PostgreSQL データベースを使用したユーザー認証
- JWT トークンベースの認証システム
- 他のアプリケーションへのシングルサインオン (SSO)
- トークン検証・リフレッシュ API
- **管理画面からの設定変更**（再デプロイ不要）
- **ユーザー管理機能**（追加・編集・削除）

## 管理画面

`/admin` にアクセスすると、以下の機能を持つ管理画面が表示されます：

### 設定管理
- アプリケーション URL の変更（再デプロイ不要）
- CORS 設定の変更
- 設定変更履歴の閲覧

### ユーザー管理
- ログインユーザーの一覧表示
- 新規ユーザーの追加
- ユーザー情報の編集（ユーザー名、表示名、パスワード）
- ユーザーの削除

**アクセス方法**: ログイン後、ダッシュボード下部の「⚙️ システム設定」リンクから

## データベースセットアップ

初回セットアップ時に `database-setup.sql` を実行してください：

```bash
# PostgreSQL に接続
psql postgresql://postgresql:Takabeni@localhost:5432/webappdb

# SQLファイルを実行（管理画面からも変更可能）
- `APP_URL_EMERGENCY`: 応急復旧支援システム URL（管理画面からも変更可能）
- `APP_URL_PLANNING`: 計画・実績管理システム URL（管理画面からも変更可能）
- `APP_URL_EQUIPMENT`: 保守用車管理システム URL（管理画面からも変更可能）
- `APP_URL_FAILURE`: 機械故障管理システム URL（管理画面からも変更可能）

**注意**: アプリケーション URL は管理画面から動的に変更可能です。データベースの設定が優先され、環境変数はフォールバックとして使用されます。
- `app_config` テーブル（設定管理用）
- `app_config_history` テーブル（設定変更履歴用）
- `users` テーブルの更新（タイムスタンプカラム追加）

## 環境変数

以下の環境変数が必要です:

- `NODE_ENV`: 実行環境 (production/development)
- `DATABASE_URL`: PostgreSQL 接続文字列
- `PORT`: サーバーポート (デフォルト: 3000)
- `JWT_SECRET`: JWT トークンの署名に使用する秘密鍵
- `CORS_ORIGIN`: CORS 許可オリジン
- `APP_URL_EMERGENCY`: 応急復旧支援システム URL
- `APP_URL_PLANNING`: 計画・実績管理システム URL
- `APP_URL_EQUIPMENT`: 保守用車管理システム URL
- `APP_URL_FAILURE`: 機械故障管理システム URL

## ローカル開発

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm start
```

## 本番環境へのデプロイ

GitHub Actions を使用して自動的に GCP Cloud Run にデプロイされます。

### 必要な GitHub Secrets

- `GCP_PROJECT_ID`: GCP プロジェクト ID
- `GCP_SA_KEY`: GCP サービスアカウントキー (JSON)
- `DATABASE_URL`: PostgreSQL 接続文字列
- `JWT_SECRET`: JWT 署名用秘密鍵
- `CORS_ORIGIN`: CORS 許可オリジン
- `APP_URL_EMERGENCY`: 応急復旧支援システム URL
- `APP_URL_PLANNING`: 計画・実績管理システム URL
- `APP_URL_EQUIPMENT`: 保守用車管理システム URL
- `APP_URL_FAILURE`: 機械故障管理システム URL

## API エンドポイント

### POST /api/login
ユーザーログイン

**リクエスト:**
```json
{
  "username": "user",
  "password": "password"
}
```

**レスポンス:**
```json
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "username": "user",
    "displayName": "User Name"
  }
}
```

### POST /api/verify-token
トークン検証 (他のアプリから使用)

**リクエスト:**
```json
{
  "token": "jwt-token"
}
```

**レスポンス:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "user",
    "displayName": "User Name"
  }
}
```

### POST /api/refresh-token
トークンリフレッシュ

**リクエスト:**
```json
{
  "token": "jwt-token"
}
```

**レスポンス:**
```json
{
  "success": true,
  "

## 管理画面 API

### GET /api/config
すべての設定を取得

**レスポンス:**
```json
{
  "success": true,
  "config": {
    "app_url_emergency": "https://...",
    "app_url_planning": "https://...",
    "app_url_equipment": "https://...",
    "app_url_failure": "https://...",
    "cors_origin": "*"
  }
}
```

### POST /api/config
設定を更新（要認証）

**ヘッダー:** `Authorization: Bearer {token}`

**リクエスト:**
```json
{
  "app_url_emergency": "https://new-url.com",
  "cors_origin": "*"
}
```

### GET /api/users
ユーザー一覧を取得

**レスポンス:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "admin",
      "display_name": "管理者",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/users
ユーザーを追加（要認証）

**ヘッダー:** `Authorization: Bearer {token}`

**リクエスト:**
```json
{
  "username": "newuser",
  "display_name": "新しいユーザー",
  "password": "password123"
}
```

### PUT /api/users/:id
ユーザーを更新（要認証）

### DELETE /api/users/:id
ユーザーを削除（要認証）token": "new-jwt-token"
}
```

## データベーススキーマ

```sql
CREATE TABLE master_data.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- bcrypt ハッシュ化されたパスワード
  display_name VARCHAR(255)
);
```

## ライセンス

ISC
