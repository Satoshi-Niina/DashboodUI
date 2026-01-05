# 🚨 クラウドDB接続問題 - 緊急対応手順

## 問題の特定

ログインは成功しているが、`/api/users`、`/api/vehicles`などのAPIで401エラーが発生。
これは**ゲートウェイ方式のルーティングテーブルが存在しない**ことが原因です。

## 必須対応（順番に実行）

### Step 1: Cloud SQLに接続

```bash
# Google Cloud SDKがインストールされている場合
gcloud sql connect [YOUR_INSTANCE_NAME] --user=postgres --database=webappdb

# または、Cloud Consoleの「Cloud SQL Studio」を使用
```

### Step 2: ルーティングテーブルの存在確認

```sql
-- app_resource_routingテーブルが存在するか確認
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'app_resource_routing';
```

**期待される結果:**
```
tablename           
--------------------
app_resource_routing
```

**結果が空の場合:** テーブルが存在しません → Step 3へ

### Step 3: ゲートウェイルーティングテーブルの作成とデータ投入

**このSQLファイルを実行してください:**

`setup-gateway-routing.sql`の内容を**Cloud SQL Studio**または**psql**で実行：

```sql
-- app_resource_routingテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS public.app_resource_routing (
    routing_id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    logical_resource_name VARCHAR(100) NOT NULL,
    physical_schema VARCHAR(50) NOT NULL,
    physical_table VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(app_id, logical_resource_name)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_app_resource_routing_lookup 
ON public.app_resource_routing(app_id, logical_resource_name, is_active);

-- DashboodUI用のルーティング設定
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'users', 'master_data', 'users', 'ユーザー管理テーブル'),
  ('dashboard-ui', 'managements_offices', 'master_data', 'managements_offices', '事業所マスタテーブル'),
  ('dashboard-ui', 'bases', 'master_data', 'bases', '保守基地マスタテーブル'),
  ('dashboard-ui', 'vehicles', 'master_data', 'vehicles', '保守用車マスタテーブル'),
  ('dashboard-ui', 'machine_types', 'public', 'machine_types', '機種マスタテーブル'),
  ('dashboard-ui', 'machines', 'public', 'machines', '機械番号マスタテーブル'),
  ('dashboard-ui', 'app_config', 'master_data', 'app_config', 'アプリケーション設定テーブル'),
  ('dashboard-ui', 'app_config_history', 'master_data', 'app_config_history', 'アプリケーション設定変更履歴テーブル'),
  ('dashboard-ui', 'vehicle_types', 'master_data', 'vehicle_types', '車両タイプマスタテーブル'),
  ('dashboard-ui', 'inspection_types', 'master_data', 'inspection_types', '点検タイプマスタテーブル')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
```

### Step 4: ルーティングデータの確認

```sql
-- ルーティングが正しく登録されたか確認
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active,
    created_at
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
```

**期待される結果:**
```
logical_resource_name | full_path                       | is_active | created_at
----------------------+---------------------------------+-----------+-------------------
app_config            | master_data.app_config          | t         | 2026-01-03 ...
bases                 | master_data.bases               | t         | 2026-01-03 ...
machines              | public.machines                 | t         | 2026-01-03 ...
machine_types         | public.machine_types            | t         | 2026-01-03 ...
managements_offices   | master_data.managements_offices | t         | 2026-01-03 ...
users                 | master_data.users               | t         | 2026-01-03 ...
vehicles              | master_data.vehicles            | t         | 2026-01-03 ...
...
```

### Step 5: テーブル構造の確認（必要に応じて）

```sql
-- 必要なカラムが存在するか確認
\d master_data.managements_offices
\d master_data.bases
\d master_data.vehicles
```

カラムが不足している場合は`migration-fix-tables.sql`も実行してください。

### Step 6: Cloud Runサービスの再起動

ルーティングテーブルを作成後、Cloud Runサービスを再起動してキャッシュをクリア：

```bash
# Google Cloud Consoleで、または
gcloud run services update dashboard-ui --region=asia-northeast2
```

または、GitHub Actionsで再デプロイ：

```bash
git commit --allow-empty -m "trigger: Redeploy after DB setup"
git push origin main
```

---

## トラブルシューティング

### Q: テーブルは作成されたが、まだ401エラーが出る

**A:** サーバーログを確認してください：

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=dashboard-ui" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

以下のログを探してください：
- `[Gateway] Resolved: users → master_data."users"` （成功）
- `[Gateway] No route found for users` （失敗 - ルーティングが見つからない）
- `Error resolving users` （失敗 - DB接続エラー）

### Q: `app_resource_routing`テーブルが既に存在する

**A:** データが正しく投入されているか確認：

```sql
SELECT COUNT(*) FROM public.app_resource_routing WHERE app_id = 'dashboard-ui';
```

結果が0の場合、INSERTクエリのみ実行してください。

### Q: 他のアプリ（emergency、planning等）も影響を受ける？

**A:** いいえ。各アプリは異なる`app_id`を持っているため、独立しています：
- `dashboard-ui` → DashboodUI用
- `emergency-assistance` → Emergency用
- `planning` → Planning用

---

## 確認完了チェックリスト

- [ ] `public.app_resource_routing`テーブルが存在する
- [ ] `dashboard-ui`のルーティングデータが10件登録されている
- [ ] Cloud Runサービスを再起動した
- [ ] ログインできる
- [ ] `/api/users`で401エラーが出ない
- [ ] システム設定画面でユーザー一覧が表示される

すべて✅なら完了です！

---

**作成日:** 2026年1月3日  
**優先度:** 🚨 緊急（必須対応）
