# 本番環境接続確認ガイド（確実性優先版）

**作成日**: 2026年1月6日  
**優先順位**: 接続確認 > セキュリティ  
**方針**: まず動かす、後で綺麗にする

---

## 🎯 なぜ本番だけ接続・参照できなかったか（結論3点）

### 1. **search_path が設定されていない**
- **詳細**: ローカルPostgreSQLでは `public` がデフォルトで検索されるが、Cloud SQLでは明示的な設定が必要
- **影響**: `SELECT * FROM managements_offices` が失敗（`master_data.managements_offices` が見つからない）
- **対策**: 全接続で `SET search_path TO master_data, public` を自動実行

### 2. **環境変数の設定状態が見えない**
- **詳細**: 本番環境で `CLOUD_SQL_INSTANCE`, `DB_NAME`, `DB_USER` が正しく設定されているか確認できなかった
- **影響**: 接続失敗の原因特定に時間がかかる
- **対策**: 起動時に環境変数の状態を全てログ出力

### 3. **実行されるSQLが不明**
- **詳細**: エラーが出ても、どのSQLが実行されたか、どのテーブルにアクセスしようとしたかが分からない
- **影響**: 「routing解決は成功しているか」「完全修飾名が使われているか」が追跡不可
- **対策**: 全SQL実行時にクエリ全文とパラメータをログ出力

---

## ✅ 本番起動ログの正解例（これが出ればOK）

```
🚀 Starting server...
Node version: v18.x.x
Environment: production
PORT from env: 8080
Cloud SQL Instance: your-project:region:instance
DB Name: webappdb
DB User: postgres
JWT_SECRET set: true
CORS_ORIGIN: *
APP_ID: dashboard-ui
DATABASE_URL set: false

📊 Database Pool Configuration:
  - Environment: PRODUCTION
  - Connection: Cloud SQL Unix Socket
  - Socket Path: /cloudsql/your-project:region:instance
  - Database: webappdb
  - User: postgres

✅ search_path set to: master_data, public

🔍 Testing database connection...
✅ Database connected successfully at: 2026-01-06T12:34:56.789Z

Server running on port: 8080
```

---

## 📋 接続確認完了チェックリスト（3項目）

### ✅ チェック1: 起動ログで環境確認
```bash
# Cloud Runログで以下を確認
grep "Environment: production" logs
grep "CLOUD_SQL_INSTANCE:" logs
grep "DB Name:" logs
grep "DB User:" logs
```

**期待値**:
- `Environment: production` が表示される
- `CLOUD_SQL_INSTANCE: your-project:region:instance` が表示される
- `DB Name: webappdb` が表示される
- `DB User: postgres` （または設定したユーザー名）が表示される

**NG判定**: 
- `NOT SET` が表示される → GitHub Secrets 未設定
- `undefined` が表示される → 環境変数が反映されていない

---

### ✅ チェック2: DB接続とsearch_path確認
```bash
# Cloud Runログで以下を確認
grep "search_path set to:" logs
grep "Database connected successfully" logs
```

**期待値**:
- `✅ search_path set to: master_data, public` が表示される
- `✅ Database connected successfully at: 2026-01-06T...` が表示される

**NG判定**:
- `Failed to set search_path` が表示される → DB接続に問題
- `Database connection error` が表示される → 環境変数または権限の問題

---

### ✅ チェック3: ルーティング・テーブル確認
```bash
# ブラウザまたはcurlで以下にアクセス（認証不要）
curl https://your-app.run.app/api/debug/routing
curl https://your-app.run.app/api/debug/schema-check?table=managements_offices
curl https://your-app.run.app/api/debug/env
```

**期待値**:

#### /api/debug/routing
```json
{
  "success": true,
  "count": 6,
  "routing": [
    {
      "app_id": "dashboard-ui",
      "logical_resource_name": "users",
      "physical_schema": "master_data",
      "physical_table": "users",
      "is_active": true
    },
    ...（全6件）
  ]
}
```

#### /api/debug/schema-check?table=managements_offices
```json
{
  "success": true,
  "exists": true,
  "schema": "master_data",
  "table": "managements_offices",
  "columns": [
    {"column_name": "office_id", "data_type": "integer", ...},
    {"column_name": "office_name", "data_type": "text", ...},
    ...
  ],
  "record_count": 5
}
```

#### /api/debug/env
```json
{
  "success": true,
  "environment": {
    "NODE_ENV": "production",
    "CLOUD_SQL_INSTANCE": "your-project:region:instance",
    "DB_NAME": "webappdb",
    "DB_USER": "postgres",
    "DATABASE_URL": "NOT SET",
    "JWT_SECRET": "SET",
    "CORS_ORIGIN": "*",
    "APP_ID": "dashboard-ui"
  }
}
```

**NG判定**:
- `/api/debug/routing` が空配列 → ルーティングテーブルが未設定
- `/api/debug/schema-check` で `exists: false` → テーブルが存在しないor権限不足
- `/api/debug/env` で `NOT SET` が多数 → 環境変数未設定

---

## 🔧 切り分け優先順位（この順で確認）

### ① Database connected が出ない
**原因**: 環境変数または接続方式の問題

**確認**:
```bash
# /api/debug/env で確認
curl https://your-app.run.app/api/debug/env
```

**対処**:
- `CLOUD_SQL_INSTANCE` が `NOT SET` → GitHub Secrets に設定
- `DB_NAME` や `DB_USER` が `NOT SET` → GitHub Secrets に設定
- 設定済みなのに接続失敗 → Cloud Run のサービスアカウント権限確認

---

### ② connected だが schema-check NG
**原因**: search_path または権限の問題

**確認**:
```bash
# ログで search_path 設定を確認
grep "search_path set to:" logs

# テーブル存在確認
curl "https://your-app.run.app/api/debug/schema-check?table=managements_offices"
```

**対処**:
- `search_path set to:` が出ない → shared-db-config.js の実装確認
- `exists: false` → テーブルが存在しない、または権限不足
  - Cloud SQLで直接確認: `SELECT * FROM master_data.managements_offices LIMIT 1;`

---

### ③ schema OK だが select NG
**原因**: SQL生成またはルーティングの問題

**確認**:
```bash
# ログで実行SQLを確認
grep "[DynamicDB]" logs
```

**期待されるログ**:
```
[DynamicDB] SELECT from master_data."managements_offices"
[DynamicDB] Query: SELECT * FROM master_data."managements_offices" ...
[DynamicDB] Params: []
[DynamicDB] ✅ SELECT success: 5 rows
```

**対処**:
- `FROM public.managements_offices` になっている → routing解決が失敗
  - `/api/debug/routing` でルーティング確認
  - ルーティングが空 → `setup-dashboard-routing.sql` を実行

---

### ④ select OK だが insert/update NG
**原因**: カラム不一致の問題

**確認**:
```bash
# エラーログで column name を確認
grep "column.*does not exist" logs
```

**対処**:
```bash
# テーブル定義確認
curl "https://your-app.run.app/api/debug/schema-check?table=managements_offices"
```

- フロントエンドが送信するカラム名と、DBのカラム名を照合
- 不一致があれば、フロントエンドまたはDB定義を修正

---

## 🚀 デプロイ手順（簡略版）

### 1. コミット
```bash
git add .
git commit -m "fix: 本番接続確認優先の修正（認証緩和・ログ強化）"
git push origin main
```

### 2. デプロイ後即座に確認（5分以内）
```bash
# 1. 起動ログ確認
# Cloud Run > ログ で以下を検索:
# - "Environment: production"
# - "Database connected successfully"
# - "search_path set to:"

# 2. デバッグAPI確認（認証不要）
curl https://your-app.run.app/api/debug/env
curl https://your-app.run.app/api/debug/routing
curl https://your-app.run.app/api/debug/schema-check?table=managements_offices

# 3. 管理画面で動作確認
# - ログイン
# - 事業所マスタ表示
# - 保守基地マスタ表示
# - 保守用車マスタ表示
```

### 3. 問題があればロールバック
```bash
# 前のバージョンに戻す
gcloud run services update dashboard-ui --revision=前のリビジョン名
```

---

## 📝 実装済み対応（v1.2 確実性優先版）

### 1. DB接続の確実化
✅ `shared-db-config.js`
- 接続時に `SET search_path TO master_data, public` を自動実行
- 接続情報の詳細ログ出力（環境、接続方式、接続先）

### 2. SQL実行の可視化
✅ `server.js` - 動的SQL関数
- 全SQL実行時に以下をログ出力:
  - 実行SQL全文（`[DynamicDB] Query: ...`）
  - バインドパラメータ（`[DynamicDB] Params: ...`）
  - routing解決結果（`[DynamicDB] SELECT from master_data."managements_offices"`）
- **パラメータマスキングなし**（デバッグ優先）

### 3. デバッグAPIの公開
✅ `server.js` - デバッグエンドポイント
- `/api/debug/routing` - **認証不要**（一時的）
- `/api/debug/schema-check` - **認証不要**（一時的）
- `/api/debug/env` - **認証不要**（一時的）

### 4. 環境変数の可視化
✅ `server.js` - 起動時ログ
- 全環境変数の状態を表示
- **マスキングなし**（確認優先）

---

## ⚠️ 注意事項（重要）

### セキュリティ上の暫定対応
以下は**接続確認が完了するまでの一時的な対応**です:

1. **デバッグAPIが認証なしで公開される**
   - テーブル構造、環境変数が外部から見える
   - **接続確認完了後、必ず認証を追加すること**

2. **SQLパラメータにパスワード等が平文で出力される**
   - ユーザー作成時のパスワードがログに記録される
   - **接続確認完了後、マスキングを追加すること**

3. **環境変数が完全に表示される**
   - `DB_USER`, `CLOUD_SQL_INSTANCE` が丸見え
   - **接続確認完了後、部分マスキングを追加すること**

### 接続確認完了の判断基準
以下の3つがすべて成功したら「接続確認完了」とみなす:

- [ ] `/api/debug/routing` で6件のルーティングが取得できる
- [ ] `/api/debug/schema-check` で全テーブルが `exists: true`
- [ ] 管理画面で全マスタ（事業所・保守基地・保守用車）が表示・登録できる

完了後、以下を実施:
1. デバッグAPIに認証を追加（`requireAdmin`）
2. SQLパラメータのマスキング実装
3. 環境変数の部分マスキング実装

---

## 🔍 トラブルシューティング簡易版

| 症状 | 原因 | 対処 |
|-----|-----|-----|
| `Database connection error` | 環境変数未設定 | `/api/debug/env` で確認 |
| `search_path set` が出ない | 接続失敗 | Cloud SQLの権限確認 |
| `routing` が空配列 | ルーティング未設定 | `setup-dashboard-routing.sql` 実行 |
| `exists: false` | テーブル不存在 | `database-setup.sql` 実行 |
| `column does not exist` | カラム不一致 | `/api/debug/schema-check` で確認 |

---

**作成者**: GitHub Copilot  
**バージョン**: v1.2 (確実性優先)  
**次のステップ**: 接続確認完了後、セキュリティ強化版（v1.3）に移行
