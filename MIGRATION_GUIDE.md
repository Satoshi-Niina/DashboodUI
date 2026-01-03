# マスタ管理タブの修正ガイド

## 概要
事業所マスタ、保守基地マスタ、保守用車マスタのタブでデータが表示されない問題を修正します。

## 問題の原因
- `master_data.managements_offices`テーブルに必要なカラム（postal_code、phone_number、manager_name、email）が不足
- `master_data.bases`テーブルに必要なカラム（manager_name、capacity）が不足
- `master_data.vehicles`テーブルに必要なカラム（model、registration_number、notes）が不足

## 修正内容
`migration-fix-tables.sql`を更新し、以下のカラムを追加しました：

### managements_offices テーブル
- postal_code (VARCHAR(20))
- phone_number (VARCHAR(20))
- manager_name (VARCHAR(100))
- email (VARCHAR(100))

### bases テーブル
- manager_name (VARCHAR(100))
- capacity (INTEGER)

### vehicles テーブル
- model (VARCHAR(50))
- registration_number (VARCHAR(50))
- notes (TEXT)

## マイグレーション実行手順

### 方法1: psqlコマンドで実行（推奨）

```bash
# Cloud SQLに接続
psql "host=/cloudsql/YOUR_INSTANCE_CONNECTION_NAME dbname=webappdb user=YOUR_DB_USER"

# または、ローカル環境の場合
psql -h localhost -U YOUR_DB_USER -d webappdb

# マイグレーションを実行
\i migration-fix-tables.sql
```

### 方法2: PowerShellから実行

```powershell
# データベース接続情報を設定
$env:PGPASSWORD = "YOUR_DB_PASSWORD"

# マイグレーション実行
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f migration-fix-tables.sql
```

### 方法3: pgAdmin等のGUIツールで実行

1. pgAdminまたはDBeaver等のデータベースツールを開く
2. `webappdb`データベースに接続
3. `migration-fix-tables.sql`ファイルを開く
4. 全体を選択して実行

### 方法4: Cloud SQL Studioで実行

1. Google Cloud ConsoleでCloud SQL Studioを開く
2. `webappdb`データベースを選択
3. `migration-fix-tables.sql`の内容をクエリエディタに貼り付け
4. 実行

## マイグレーション実行後の確認

マイグレーション実行後、以下のクエリでテーブル構造を確認できます：

```sql
-- managements_offices テーブルの確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'managements_offices'
ORDER BY ordinal_position;

-- bases テーブルの確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'bases'
ORDER BY ordinal_position;

-- vehicles テーブルの確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'master_data' 
  AND table_name = 'vehicles'
ORDER BY ordinal_position;
```

## アプリケーションの再起動

マイグレーション実行後、アプリケーションを再起動してください：

```bash
# サーバーを再起動
npm start
```

または、既に起動中の場合はCtrl+Cで停止してから再度起動してください。

## 動作確認

1. ブラウザで管理画面にアクセス（http://localhost:3000/admin.html）
2. 「事業所マスタ」タブをクリック
   - 事業所のリストが表示されることを確認
   - 「新規事業所追加」ボタンで追加できることを確認
3. 「保守基地マスタ」タブをクリック
   - 保守基地のリストが表示されることを確認
   - 「新規保守基地追加」ボタンで追加できることを確認
4. 「保守用車マスタ」タブをクリック
   - 保守用車のリストが表示されることを確認
   - 「新規車両追加」ボタンで追加できることを確認

## トラブルシューティング

### データが表示されない場合

1. ブラウザの開発者ツール（F12）を開く
2. Consoleタブでエラーメッセージを確認
3. Networkタブで `/api/offices`、`/api/bases`、`/api/vehicles` のレスポンスを確認

### サーバーエラーが発生する場合

1. サーバーログを確認（ターミナルに表示される）
2. データベース接続情報が正しいか確認（`.env`ファイル）
3. マイグレーションが正しく実行されたか確認

### 外部キー制約エラーが発生する場合

既存データに不整合がある場合、以下のクエリでチェック：

```sql
-- vehiclesテーブルで無効なmachine_idをチェック
SELECT v.vehicle_id, v.machine_id
FROM master_data.vehicles v
LEFT JOIN public.machines m ON v.machine_id = m.id
WHERE v.machine_id IS NOT NULL AND m.id IS NULL;

-- vehiclesテーブルで無効なoffice_idをチェック
SELECT v.vehicle_id, v.office_id
FROM master_data.vehicles v
LEFT JOIN master_data.managements_offices o ON v.office_id = o.office_id
WHERE v.office_id IS NOT NULL AND o.office_id IS NULL;

-- basesテーブルで無効なoffice_idをチェック
SELECT b.base_id, b.office_id
FROM master_data.bases b
LEFT JOIN master_data.managements_offices o ON b.office_id = o.office_id
WHERE b.office_id IS NOT NULL AND o.office_id IS NULL;
```

不整合が見つかった場合、以下のクエリで修正：

```sql
-- 無効な参照をNULLに設定
UPDATE master_data.vehicles
SET machine_id = NULL
WHERE machine_id NOT IN (SELECT id FROM public.machines);

UPDATE master_data.vehicles
SET office_id = NULL
WHERE office_id NOT IN (SELECT office_id FROM master_data.managements_offices);

UPDATE master_data.bases
SET office_id = NULL
WHERE office_id NOT IN (SELECT office_id FROM master_data.managements_offices);
```

## サポート

問題が解決しない場合は、以下の情報を提供してください：
- ブラウザの開発者ツールのエラーメッセージ
- サーバーログのエラーメッセージ
- 実行したマイグレーションSQLの結果
