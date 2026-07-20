# 本番DB緊急セットアップガイド

## 問題の原因

Cloud Runログの分析結果：
```
[TenantRouting] Failed to resolve tenant daitetsu: Tenant not registered: daitetsu
```

**根本原因**: 本番DB（`common_db`）に以下のテーブルとデータが存在しない：
1. `company_db_routing` - テナントマスタ（DB接続情報）
2. `tenant_app_routings` - アプリルーティング（アプリ一覧）

## 即座に実行すべき対応

### 方法1: Google Cloud Console（推奨・最速）

1. [Cloud SQL Query Editor](https://console.cloud.google.com/sql/instances/free-trial-first-project/query?project=maint-vehicle-management) を開く
2. Database: `common_db` を選択
3. `sql/setup-production-complete.sql` の内容をコピー＆ペースト
4. 「実行」をクリック

**所要時間**: 約2分

### 方法2: gcloud CLI

```powershell
# SQLファイルを実行（IPv6問題がある場合は失敗する可能性あり）
gcloud sql connect free-trial-first-project `
  --user=postgres `
  --project=maint-vehicle-management `
  --database=common_db
# プロンプトが表示されたら：
\i sql/setup-production-complete.sql
\q
```

### 方法3: Cloud SQL Proxy経由

```powershell
# ターミナル1: Cloud SQL Proxyを起動
cloud-sql-proxy maint-vehicle-management:asia-northeast2:free-trial-first-project

# ターミナル2: psqlで接続
$env:PGPASSWORD="Takabeni"
psql -h localhost -p 5432 -U postgres -d common_db -f sql/setup-production-complete.sql
```

## セットアップ内容

### 作成されるテーブル

1. **company_db_routing** (3レコード)
   - demo → demo_db
   - daitetsu → daitetsu_db
   - kosei → kosei_db

2. **tenant_app_routings** (9レコード)
   - demo: 4アプリ（planning, equipment, emergency, failure）
   - daitetsu: 3アプリ（planning, equipment, emergency）
   - kosei: 2アプリ（planning, equipment）

## 実行後の確認

### 1. テーブル作成の確認

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('company_db_routing', 'tenant_app_routings')
ORDER BY table_name;
```

期待される結果: 2行表示

### 2. データ投入の確認

```sql
-- テナントマスタ
SELECT company_id, company_name, db_name 
FROM public.company_db_routing 
ORDER BY company_id;

-- アプリルーティング
SELECT tenant_key, COUNT(*) as app_count 
FROM public.tenant_app_routings 
GROUP BY tenant_key 
ORDER BY tenant_key;
```

期待される結果:
- company_db_routing: 3行（demo, daitetsu, kosei）
- アプリ数: demo=4, daitetsu=3, kosei=2

## 実行後のAPI検証

DB設定完了後、以下のコマンドでAPIが正常に動作することを確認：

```powershell
# Demo環境
Invoke-WebRequest -Uri "https://dashboard-ui-u3tejuflja-dt.a.run.app/demo/api/tenant-apps" | Select-Object StatusCode, Content

# Daitetsu環境
Invoke-WebRequest -Uri "https://dashboard-ui-u3tejuflja-dt.a.run.app/daitetsu/api/tenant-apps" | Select-Object StatusCode, Content

# ログイン認証テスト
$body = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://dashboard-ui-u3tejuflja-dt.a.run.app/api/login?tenant_id=daitetsu" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

期待される結果: すべて **200 OK**（503エラーが解消される）

## トラブルシューティング

### エラー: "already exists"
→ 問題なし。`ON CONFLICT DO UPDATE` で既存データを更新します。

### エラー: "permission denied"
→ ユーザー `postgres` に権限がない。Cloud Consoleから実行してください。

### エラー: "could not connect to server"
→ Cloud SQL Proxyが起動していない、またはIPv6接続問題。方法1（Cloud Console）を使用してください。
