# データベース構造の不整合修正

## 発見された問題

server.jsとdatabase-setup.sqlの間でカラム名が一致していませんでした。

### 1. managements_offices テーブル

**修正なし** - office_code, office_name, office_type, address のみ使用

### 2. bases テーブル

**追加したカラム:**
- `location` - 所在地（簡易版）
- `address` - 住所（詳細版）
- `postal_code` - 郵便番号
- `phone_number` - 電話番号
- `latitude` - 緯度
- `longitude` - 経度

### 3. vehicles テーブル

**追加したカラム:**
- `machine_id` - 機械番号への外部キー
- `office_id` - 管理事業所への外部キー

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
