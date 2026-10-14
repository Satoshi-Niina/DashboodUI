# 共通 DB 正規化アーキテクチャ案

> **状態: 設計・移行案。実 DB の現行構造や適用状況を表すものではありません。**
> 現行実装との相違は [CURRENT_DB_SCHEMA.md](./CURRENT_DB_SCHEMA.md) を参照してください。

## 目的と DB の境界

想定する `common_db` はテナント識別、認証、アプリ一覧・契約・権限を担う制御プレーンです。
各テナント DB は業務データを保持し、共通 DB の認証・ルーティング処理を業務 DB の初期化や
業務データ上書きに使いません。

この設計では `tenant_db_routing.database_key` だけを共通 DB に保持し、接続情報は
実行環境の秘密設定から解決します。現行 `server.js` は旧 `tenant_app_routings` 互換表を参照し、
`TENANT_DB_<KEY>_URL` / `_NAME` を優先して接続します。旧 `tenant-db-resolver.js` は現行コードから
参照されない重複実装だったため削除しました。この資料の正規化ルーティング表設計は現行 route
table へ完全移行済みという意味ではありません。

## 正規化案の表・キー・用途

この一覧は [20260903_common_db_foundation_up.sql](./migrations/20260903_common_db_foundation_up.sql)
で定義される案を整理したものです。実 DB の列・制約は読み取り専用のスキーマ調査で確認してください。

| 表 | 主な列 | キー・関連 | 用途 |
|---|---|---|---|
| `public.tenants` | `id`, `tenant_key`, `tenant_name`, `tenant_code`, `is_active`, timestamps | PK `id`; `tenant_key` UNIQUE | テナント識別 |
| `public.tenant_db_routing` | `id`, `tenant_id`, `database_key`, `is_active`, timestamps | PK `id`; `tenant_id` FK→tenants, UNIQUE | テナントと DB 識別子の対応 |
| `public.applications` | `id`, `app_key`, `app_name`, `app_url`, `icon`, `category`, `display_order`, `description`, `is_active`, timestamps | PK `id`; `app_key` UNIQUE | アプリカタログ |
| `public.tenant_applications` | `id`, `tenant_id`, `application_id`, `is_enabled`, `is_visible`, `required_role`, timestamps | PK `id`; FK→tenants/applications; `(tenant_id, application_id)` UNIQUE | テナントごとの利用・表示設定 |
| `public.users` | `id`, `username`, `password_hash`, `display_name`, `email`, `is_active`, timestamps | PK `id`; `username` UNIQUE | 共通認証ユーザー |
| `public.user_tenants` | `user_id`, `tenant_id`, `is_active` | 複合 PK `(user_id, tenant_id)`; FK→users/tenants | ユーザーのテナント所属 |
| `public.roles` | `id`, `role_key`, `role_name` | PK `id`; `role_key` UNIQUE（案） | ロール定義 |
| `public.user_roles` | `user_id`, `tenant_id`, `role_id` | 複合 PK `(user_id, tenant_id, role_id)`; FK→users/tenants/roles | テナント単位のロール割当 |
| `public.permissions` | `id`, `permission_key`, `permission_name` | PK `id`; `permission_key` UNIQUE（案） | 権限定義 |
| `public.role_permissions` | `role_id`, `permission_id` | 複合 PK `(role_id, permission_id)`; FK→roles/permissions | ロールと権限の対応 |

概念上の関係:

```text
tenants 1—1 tenant_db_routing
tenants 1—* tenant_applications *—1 applications
users *—* tenants (user_tenants)
users *—* roles (user_roles; tenant_id でスコープ)
roles *—* permissions (role_permissions)
```

## 適用前提

- この SQL に対応する自動ランナーや適用履歴表はありません。
- up SQL は旧 `tenant_app_routings`、`organizations`、
  `user_org_memberships`、`user_role_assignments` 等の存在・列を前提とする部分があります。
- down SQL は正規化案の表を削除します。旧表の状態を戻すロールバックではありません。
- 既存の利用者・所属・ロール・アプリ設定を上書きしないこと、適用済み環境で再実行しないことを
  隔離 DB で確認するまで、新規／既存環境へ適用しないでください。
