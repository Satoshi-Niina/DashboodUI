# データベース構造の不整合修正

## 発見された問題

server.jsとdatabase-setup.sqlの間でカラム名が一致していませんでした。

### 1. managements_offices テーブル

**不足していたカラム:**
- `postal_code` - 郵便番号
- `phone_number` - 電話番号（database-setup.sqlでは`phone`だった）
- `manager_name` - 管理者名
- `email` - メールアドレス

### 2. bases テーブル

**不足していたカラム:**
- `location` - 所在地（簡易版）
- `address` - 住所（詳細版）
- `postal_code` - 郵便番号
- `phone_number` - 電話番号（database-setup.sqlでは`contact_info`だった）
- `manager_name` - 管理者名
- `email` - メールアドレス
- `capacity` - 収容台数

### 3. vehicles テーブル

**不足していたカラム:**
- `machine_id` - 機械番号への外部キー
- `office_id` - 管理事業所への外部キー

**不要なカラム:**
- `vehicle_type` - NOT NULL制約が問題（実際は使われていない）

## 修正内容

### ファイル修正
1. `database-setup.sql` - テーブル定義を修正
2. `migration-fix-tables.sql` - 既存DBを修正するマイグレーションスクリプト作成

### マイグレーション実行手順

```bash
# Cloud SQLに接続
gcloud sql connect webappdb --user=postgres --quiet

# マイグレーションを実行
\i migration-fix-tables.sql

# または
psql -h /cloudsql/PROJECT:REGION:INSTANCE -U postgres -d webappdb -f migration-fix-tables.sql
```

### 確認手順

```bash
# テーブル構造を確認
\d master_data.managements_offices
\d master_data.bases
\d master_data.vehicles
\d public.machines
\d public.machine_types
```

## 影響範囲

- 事業所マスタの追加・更新
- 保守基地マスタの追加・更新
- 保守用車マスタの追加・更新

これらの機能で500エラーが発生していた原因が、存在しないカラムへのINSERT/UPDATEでした。

## 次のステップ

1. マイグレーションスクリプトをCloud SQLで実行
2. アプリケーションを再デプロイ（すでに正しいカラム名を使用している）
3. 各マスタで保存テストを実施
