# データベース更新手順書

## 概要
機械番号マスタから「配属基地」と「ステータス」フィールドを削除し、保守用車マスタとの整合性を確保します。

## 削除されるフィールド

### 1. 機械番号マスタ（master_data.machines）
- `assigned_base_id` - 配属基地ID
- `status` - ステータス（稼働中/整備中/廃車）

### 2. その他のテーブル（既存変更）
- 事業所マスタ: manager_name, email
- 保守基地マスタ: latitude, longitude, capacity, manager_name, phone_number

## 実行前の準備

### 1. データベースのバックアップ
```bash
# Cloud SQLインスタンスのバックアップを作成
gcloud sql backups create --instance=YOUR_INSTANCE_NAME
```

### 2. 現在のデータ確認
```sql
-- 機械番号マスタの配属基地とステータスを使用しているデータ確認
SELECT 
    COUNT(*) as total_machines,
    COUNT(assigned_base_id) as machines_with_base,
    COUNT(status) as machines_with_status
FROM master_data.machines;

-- ステータス別の集計
SELECT status, COUNT(*) 
FROM master_data.machines 
GROUP BY status;
```

## 実行手順

### 方法1: Cloud SQL コンソールから実行

1. Google Cloud Console にアクセス
2. Cloud SQL インスタンス `webappdb` を選択
3. 「Cloud SQL Studio」を開く
4. データベース `webappdb` に接続
5. `database-complete-update.sql` の内容を貼り付けて実行

### 方法2: gcloud コマンドで実行

```bash
# Cloud SQLに接続
gcloud sql connect YOUR_INSTANCE_NAME --user=postgres --database=webappdb

# SQLファイルを実行
\i database-complete-update.sql
```

### 方法3: psql で直接実行

```bash
# ローカルからCloud SQLプロキシ経由で接続
cloud_sql_proxy -instances=PROJECT_ID:REGION:INSTANCE_NAME=tcp:5432 &

# psqlで接続してSQLファイル実行
psql -h 127.0.0.1 -U postgres -d webappdb -f database-complete-update.sql
```

## 実行後の確認

### 1. カラムが削除されたことを確認
```sql
-- 機械番号マスタのカラム一覧
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'master_data' AND table_name = 'machines'
ORDER BY ordinal_position;
```

期待される結果: `assigned_base_id` と `status` が存在しないこと

### 2. ルーティング設定の確認
```sql
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui' 
ORDER BY logical_resource_name;
```

期待される結果: 6つのテーブル（users, managements_offices, bases, machine_types, machines, vehicles）のルーティングが登録されていること

### 3. アプリケーションの動作確認
1. アプリケーションを再起動
2. 管理画面 > 保守用車マスタ にアクセス
3. 機械番号マスタの登録/編集モーダルを開く
4. 配属基地とステータスのフィールドが表示されないことを確認
5. 機械番号の新規登録が正常に動作することを確認

## トラブルシューティング

### エラー: column "assigned_base_id" does not exist

すでにカラムが削除されている場合は無視してOKです。`DROP COLUMN IF EXISTS` を使用しているため、エラーにはなりません。

### エラー: table "app_resource_routing" does not exist

STEP 2 で自動的に作成されます。手動で作成する場合:
```sql
CREATE TABLE public.app_resource_routing (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    logical_resource_name VARCHAR(100) NOT NULL,
    physical_schema VARCHAR(50) NOT NULL,
    physical_table VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, logical_resource_name)
);
```

### DBエラー: Connection refused

1. Cloud SQL インスタンスが起動していることを確認
2. ネットワーク設定でアクセスが許可されていることを確認
3. 環境変数 `CLOUD_SQL_INSTANCE` が正しく設定されていることを確認

```bash
# Cloud Run環境変数を確認
gcloud run services describe dashboard-ui --region=asia-northeast1 --format="value(spec.template.spec.containers[0].env)"
```

## ロールバック手順

万が一問題が発生した場合、以下のSQLで元に戻せます：

```sql
-- 機械番号マスタにカラムを戻す
ALTER TABLE master_data.machines
    ADD COLUMN assigned_base_id INTEGER,
    ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- 外部キーを復元
ALTER TABLE master_data.machines
    ADD CONSTRAINT fk_machines_assigned_base_id
    FOREIGN KEY (assigned_base_id) REFERENCES master_data.bases(base_id)
    ON DELETE SET NULL;
```

## 更新完了後の作業

1. ✅ データベース更新完了
2. ✅ アプリケーション再起動（Cloud Runは自動的に最新コードをデプロイ）
3. ✅ 管理画面の動作確認
4. ✅ 本番データでのテスト

---

**作成日**: 2026年1月5日  
**バージョン**: 1.0  
**対象環境**: Cloud SQL (webappdb)
