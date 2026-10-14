# 環境別DB差分表（ローカル確定・本番は未接続のため保留）

> **過去の読み取り専用調査スナップショットです。現在の DB 状態や更新手順として使用しないでください。**
> DB 名・テーブル数・列・本番接続可否を本作業では再確認していません。現在のコード上の契約は
> [CURRENT_DB_SCHEMA.md](../CURRENT_DB_SCHEMA.md)、適用状況と検証結果は
> [MIGRATION_REPORT.md](../MIGRATION_REPORT.md) を参照してください。

## 前提・確認方法

- ローカル: `localhost:5432` の PostgreSQL 17（`\dt`, `\d`, `information_schema` で読み取り専用取得）。
- 本番: GCPプロジェクト `maint-vehicle-management`、Cloud SQLインスタンス
  `maint-vehicle-management:asia-northeast2:free-trial-first-project`（**既存のデプロイ設定から確認、推測ではない**。
  根拠は [00_OVERVIEW_AND_OPEN_QUESTIONS.md](./00_OVERVIEW_AND_OPEN_QUESTIONS.md) 参照）。
  **読み取り専用接続をユーザー承認のもと試行したが、既存のサービスアカウント鍵（Cloud Runデプロイ専用）に
  Cloud SQL Admin API権限がなく失敗した。詳細は [00_OVERVIEW_AND_OPEN_QUESTIONS.md](./00_OVERVIEW_AND_OPEN_QUESTIONS.md) を参照。本番へは未接続のまま。**
- 本番未接続のため、本表の「本番」列は現時点ではすべて **「未確認」** と明記する。埋める場合も本番の実行結果のみを根拠とし、ローカルの値を流用しない。

## 1. データベース一覧

| 環境 | DB名 | 用途（判明分） | 状態 |
|---|---|---|---|
| ローカル | common_db | 制御プレーン（テナント/ルーティング/00の認証） | 確認済み |
| ローカル | daitetsu_db | daitetsuテナント業務データ | 前回調査で存在確認済み（今回は未再調査） |
| ローカル | demo_db | demoテナント業務データ | 確認済み |
| ローカル | kintetsu_db | kintetsuテナント業務データ | 前回調査で存在確認済み（`public.users`が0件だった過去の調査結果あり、今回は未再確認） |
| ローカル | kosei_db | koseiテナント業務データ（孤立疑い） | 前回調査で存在確認済み |
| 本番 | （不明。`common_db`、`webappdb`等、アプリごとに異なる名称が設定ファイルに出現） | 未確認 | **未接続** |

## 2. common_db: テーブル一覧（ローカル、`\dt public.*` 実行結果）

18テーブル: `app_resource_routing, applications, company_db_routing, organizations, permissions,
role_permissions, roles, schema_migrations, sites, tenant_app_routings, tenant_applications,
tenant_db_routing, tenants, user_org_memberships, user_role_assignments, user_roles, user_tenants, users`

本番: **未確認**（接続後に同一コマンドで取得予定）

## 3. demo_db: テーブル一覧（ローカル、`\dt public.*` 実行結果）

10テーブル: `app_resource_routing, organizations, permissions, role_permissions, roles,
schema_migrations, sites, user_org_memberships, user_role_assignments, users`

本番: **未確認**

## 4. users テーブル定義比較（ローカルのみ確定）

### common_db.public.users（ローカル）

| 列 | 型 | NULL | デフォルト |
|---|---|---|---|
| id | uuid | not null | gen_random_uuid() |
| username | text | not null | |
| display_name | text | | |
| password_hash | text | not null | |
| is_active | boolean | not null | true |
| created_at | timestamptz | not null | now() |
| role | text | | |
| email | varchar(320) | | |
| updated_at | timestamptz | not null | now() |

制約: `users_pkey`(id), `users_username_key` UNIQUE(username)。
参照元FK: `user_org_memberships`, `user_role_assignments`, `user_roles`, `user_tenants`。

### demo_db.public.users（ローカル）

| 列 | 型 | NULL | デフォルト |
|---|---|---|---|
| id | uuid | not null | gen_random_uuid() |
| username | text | not null | |
| display_name | text | | |
| password_hash | text | not null | |
| is_active | boolean | not null | true |
| created_at | timestamptz | not null | now() |
| role | text | not null | 'operator'::text |

制約: `users_pkey`(id), `users_username_key` UNIQUE(username)。
参照元FK: `operations.audit_logs`, `operations.inspection_records`, `user_org_memberships`, `user_role_assignments`。

**ローカル内での差分（common_db vs demo_db）**:
- common_dbのみ: `email`, `updated_at` 列。
- `role`列のNULL許容: common_dbは許容、demo_dbは`NOT NULL DEFAULT 'operator'`（不一致）。
- demo_db側のみ`operations`スキーマからのFK参照あり（テナント業務データが直接usersを参照）。

本番との差分: **未確認**（本番の同一クエリ結果が必要）。

## 5. 本番接続後に実行する予定の読み取り専用調査SQL（未実行・案）

本番アクセスの承認が得られ次第、以下を各DB（common_db相当・demo_db相当）に対して実行する。

```sql
-- テーブル一覧
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2;

-- 列定義
SELECT table_schema, table_name, column_name, ordinal_position, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 制約・インデックス
SELECT tc.table_name, tc.constraint_type, tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY 1,2;

-- マイグレーション履歴（テーブル名が環境で異なる可能性があるため両方試す）
SELECT * FROM public.schema_migrations ORDER BY 1;
-- SELECT * FROM public.migrations ORDER BY 1;
```

## 6. 未確認・要判断事項

1. 本番DBの実名（`common_db`固定か、`webappdb`等アプリ別か）を先に確定する必要がある。
2. 本番への読み取り専用接続方法（`cloud-sql-proxy.exe` + サービスアカウント鍵）を実際に使ってよいかの承認待ち。
3. daitetsu_db/kintetsu_db/kosei_dbのローカル最新状態は前回調査時点のものであり、今回は再取得していない（必要なら再取得する）。
