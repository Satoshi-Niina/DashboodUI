# システム構成と現在の DB 構造

この資料は migration SQL と実行コードが要求する構造を説明します。実 DB の schema dump や適用履歴の
証明ではありません。実環境は照合していません。

## システム境界・更新順

```text
ブラウザー → Express (server.js) → 共通 PostgreSQL
                                  └→ tenant_app_routings に登録した各 tenant PostgreSQL
```

- 共通 DB（制御プレーン）は公開テナントID解決、接続先（database_key）管理、アプリ catalog、テナント別利用可否、全体設定、および共通マイグレーション履歴を保持します。
- 各テナント DB（業務プレーン）はユーザー認証（パスワードハッシュ）、所属、ロール・権限（RBAC）、業務マスタ（事業所、基地、機種、機械、検修項目等）、業務データ（点検記録、走行実績等）、監査ログ、およびテナントマイグレーション履歴を保持します。
- 共通 DB に `db/migrations/common/` を先に適用し、対象となる各テナント DB に
  `db/migrations/tenant/` を個別に適用します。両方を同じ DB に実行しません。
- 認証フローは「公開テナントURL → 共通DBで内部テナント・接続先・契約アプリを解決 → 対象テナントDBでログイン・所属・権限を確認 → ダッシュボードから各アプリへ短命SSOトークン発行」に統一されます。共通DBへの一般ユーザー認証フォールバックは廃止されました。不明なテナントや未登録routeは503で遮断され、別DBやdemoへ自動フォールバックしません。
- 実際の db name は `/api/tenant-context` 応答で確認できます。

## 共通 DB (`db/migrations/common/`)

| schema.table | 主な列・キー・関連 | 用途 |
|---|---|---|
| `public.organizations` | `id` PK、`code` unique、`name` | 組織 |
| `public.users` | `id` PK、`username` unique、password fields、display/email/role、active/timestamps | 共通ログイン |
| `public.user_org_memberships` | `(user_id, org_id)` PK、双方 users/organizations FK、`is_active` | 組織所属 |
| `public.user_role_assignments` | `(user_id, org_id, role_id)` PK、各 users/organizations/roles FK | 組織内権限 |
| `public.tenants` | `id` PK、`tenant_key` unique、name/code/active | tenant identity |
| `public.user_tenants` | `(user_id, tenant_id)` PK、users/tenants FK、`is_active` | tenant 所属 |
| `public.roles` | `id` PK、`role_key` 部分 unique、role/name/code | role catalog |
| `public.user_roles` | `(user_id, tenant_id, role_id)` PK、users/tenants/roles FK | tenant role 割当 |
| `public.permissions` | `id` PK、`permission_key` 部分 unique、name/code/description | permission catalog |
| `public.role_permissions` | `(role_id, permission_id)` PK、双方 FK | role と permission の関連 |
| `public.applications` | `id` PK、`app_key` unique、name/url/icon/category/order/active | アプリ catalog |
| `public.tenant_db_routing` | `id` PK、`tenant_id` unique FK、`database_key`、active | 正規化 route 情報 |
| `public.tenant_applications` | `id` PK、tenant/application FK、`(tenant_id, application_id)` unique、enabled/visible/role | tenant ごとのアプリ設定 |
| `public.tenant_app_routings` | `(tenant_key, app_id)` PK、tenant/db/app routing fields | 現行互換 route。現行コードが参照 |
| `public.tenant_public_ids` | `id` bigint identity PK、`tenant_key`、`public_id` unique（`t`＋36 hex、144 bit）、`is_active`、`retired_at`／`retired_reason`。有効 ID は tenant ごとに 1 件（部分 unique）、失効 ID は再有効化・再利用不可、33 文字未満の登録はトリガーで拒否 | URL 用の公開 ID と内部 tenant key の対応（migration 004／005。管理は `db-migrate.js --list/--rotate/--retire-public-id`） |
| `public.app_resource_routing` | `(app_id, logical_resource_name)` PK、physical schema/table、active | 論理 resource と物理表の対応 |
| `public.app_config` | `config_key` PK、`config_value` | 共通設定 |
| `master_data.app_config` | `config_key` PK、value/updated metadata | 管理設定 |
| `master_data.app_config_history` | `id` PK、key/old/new value/actor/time | 設定変更履歴 |
| `master_data.ai_settings` | `id` PK、`(app_id, setting_type)` unique、JSON settings | AI 設定 |
| `master_data.ai_knowledge_data` | `id` PK、title/content/source/metadata | AI 知識情報 |
| `master_data.ai_knowledge_chunks` | `id` PK、knowledge FK (`ON DELETE CASCADE`)、chunk/content/metadata | 分割知識情報 |
| `public.dashboard_schema_migrations` | `version` PK、name/checksum/type/applied metadata | runner の適用履歴 |

順序付き SQL が完全な型・NULL 条件・index・FK 定義です。seed は不足 role/resource route のみを
追加し、運用者が設定した値を置換しません。

既存 DB に旧 tenant routing 形式の `public.app_resource_routing`（`tenant_key` 主キー）が存在する場合、
`002_z_legacy_resource_routing` は元の表を `public.app_resource_routing_legacy` に保持したうえで、
現行の resource mapping 表を作成します。旧表のデータは削除しません。

## Tenant DB (`db/migrations/tenant/`)

| schema.table | 主な列・キー・関連 | 用途 |
|---|---|---|
| `public.users` | `id` UUID PK、username、password fields、role、active、timestamps | tenant 内ユーザー互換 |
| `public.management_offices` | `id` UUID PK、office name/code/address/postal/phone | 管理事業所 |
| `public.machine_types` | `id` UUID PK、`display_code`（`MT-0001`形式の画面表示コード）、type/model/category/manufacturer/description | 機種 |
| `public.machines` | `id` UUID PK、`machine_number`、office/type IDs、serial/certification/dates/notes | 保守用車両 |
| `public.bases` | `id` UUID PK、`office_id`、name/code/location/postal | 車両基地 |
| `public.inspection_types` | `id` UUID PK、name/type/code/description/order/active | 検修種別 |
| `public.inspection_schedules` | `id` UUID PK、`machine_type_id` 機種FKまたは `target_category`、検修種別FK、dates/cycle/duration/remarks/active/notes。旧 `machine_id` は移行互換用 | 検修周期・期間設定と検修予定・実績 |
| `master_data.app_config` | `config_key` PK、value/updated metadata | tenant 管理設定 |
| `master_data.app_config_history` | `id` PK、key/old/new value/actor/time | tenant 設定変更履歴 |
| `master_data.ai_settings` | `id` PK、`(app_id, setting_type)` unique、JSON settings | AI 設定 |
| `master_data.ai_knowledge_data` | `id` PK、title/content/source/metadata | AI 知識情報 |
| `master_data.ai_knowledge_chunks` | `id` PK、knowledge FK、chunk/content/metadata | 分割知識情報 |
| `public.dashboard_schema_migrations` | `version` PK、name/checksum/type/applied metadata | runner の適用履歴 |

## DB 操作

構築・更新・baseline のコマンド、環境設定、既存 DB の安全な手順は
[README の DB 構築・更新](../README.md#既存-db-の更新commontenant-db-で個別に実施)を参照してください。
baseline は既存構造を verifier で確認した上でのみ履歴へ記録します。実 DB が verifier の前提を満たすか
未確認のまま baseline を実行しないでください。

Tenant migration `003_business_timestamps` は `management_offices`、`machine_types`、`machines`、
`bases`、`inspection_types`、`inspection_schedules` の `created_at` / `updated_at` が不足する
legacy schema に列を補います。既存の業務列・既存 timestamp は更新しません。

Tenant migration `004_master_codes` は保守用車・基地・検修マスタで必要な業務列を補います。
保守用車の自動機械番号はカテゴリーに応じて `MC001`、`HT001`、`TT001`、`HPT001` の形式で採番し、
それ以外のカテゴリーは既存の `M-0001` 形式を維持します。
関連付けに使う UUID の主キーは変更しません。

Tenant migration `005_machine_type_display_codes` は既存の機種に表示コード列を追加し、
`006_numeric_machine_type_codes`、`008_four_digit_machine_type_codes`、`009_prefixed_machine_type_codes` が表示コードを
`MT-0001`, `MT-0002`, ... の形式にします。新規採番は `MT-9999` を上限とし、機種のUUID主キーは内部の関連付け用として維持します。

Tenant migration `007_inspection_machine_type_targets` は検修設定に機種IDとカテゴリーを追加し、
移行可能な既存の個別車両設定を機種単位へ変換します。検修周期・期間設定画面ではカテゴリーまたは
機種コードを選択し、個別車両は選択しません。旧 `machine_id` 列は変換できない履歴との互換性のため残します。

Tenant migration `010_machine_specific_inspection_types` は検修種別に機種ID・検修周期・検修期間を追加します。
検修種別コードは機種カテゴリーごとに軌道モーターカー `MC01`、鉄トロ `TT01`、箱トロ `HTT01`、
ホッパー車 `HPT01` から2桁連番で採番します。検修周期・期間設定は機種と検修種別を関連付け、
検修種別に登録した周期・期間を設定値として使用します。

Common migration `006_reorganize_common_db_control_plane` は制御プレーンを整理・強化します。
`public.app_config`（全体設定）を確保し、`tenant_db_routing` と `tenant_applications` の
検索用インデックスを強化します。`tenant_app_routings` の二重管理を解消し、
`tenant_db_routing`＋`tenant_applications`＋`applications` の正規テーブルへの集約を推進します。

Tenant migration `011_reorganize_tenant_auth_and_masters` はテナント業務DB側の認証・所属・RBACおよび
業務マスタを整理・強化します。空DBからのゼロベース構築にも対応できるよう、
`organizations`, `sites`, `roles`, `permissions`, `user_org_memberships`, `user_role_assignments`、
および業務データ（`inspection_records`, `inspection_runs`等）のテーブル・インデックスを完全担保します。
