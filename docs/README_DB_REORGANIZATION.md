# マルチテナントシステム データベース整理・運用ガイド

本ドキュメントは、マルチテナントシステムのデータベース構成整理（`common_db` 制御プレーンと各テナント業務DBプレーンの完全分離）および認証・ルーティング一本化の設計と運用方法を説明する公式ガイドです。

---

## 1. 整理方針と基本設計

### 1.1 common_db（共通制御プレーン）の責務
- **公開テナントID ⇔ 内部テナント解決**: `public.tenant_public_ids` および `public.tenants`
- **テナントDB接続先管理**: `public.tenant_db_routing`（`database_key` による環境変数・シークレット分離）
- **アプリカタログ・契約管理**: `public.applications`（アプリ一覧・URL）、`public.tenant_applications`（テナント別有効化・表示制御）
- **システム全体設定**: `public.app_config`（全体スコープの設定キー・バリュー）
- **マイグレーション履歴**: `public.dashboard_schema_migrations`
- **【重要変更】**: `common_db` 側の一般ユーザー認証への依存を完全に解消しました。一般ユーザーのパスワード照合や組織所属判定を `common_db` では行いません。

### 1.2 各テナントDB（業務・テナントプレーン）の責務
- **ユーザー認証・所属・RBAC**: `public.users`（ユーザー・パスワードハッシュ）、`organizations`（組織）、`sites`（拠点）、`user_org_memberships`（所属）、`roles`, `permissions`, `user_role_assignments`（権限割当）
- **複数アプリ共有業務マスタ**: `master_data.management_offices`（事業所）、`bases`（基地）、`machine_types`（機種）、`machines`（保守用車）、`operations.inspection_items`（点検項目）、`work_content_master`（作業内容）
- **業務データ・監査ログ**: `operations.inspection_records`（点検記録ヘッダ）、`inspection_runs`（走行明細）、`inspection_record_items`（定性判定）、`inspection_measurement_results`（定量測定）、`audit_logs`（監査ログ）、`system_settings`（テナント設定）
- **マイグレーション履歴**: `public.dashboard_schema_migrations`

---

## 2. 認証・ルーティング・SSO フロー

```text
1. 公開テナントURL (/demo または /t615f9...) にアクセス
   ↓
2. common_db で公開IDから内部テナント (demo) と 接続先 database_key (demo) を解決
   ↓
3. 対象テナントDB (demo_db) に接続し、ユーザー名・パスワードハッシュを照合
   ↓
4. 対象テナントDB で所属組織・拠点・ロールを確認し、dashboard_session JWT Cookieを発行
   ↓
5. common_db で契約・有効アプリ一覧を取得してダッシュボードに表示
   ↓
6. アプリ起動時、短命SSOトークン (JWT: 5分, issuer, audience, appKey, tenantKey) を発行
   ↓
7. 子アプリ (01/02/03/04) がSSOトークンを検証し、対象テナントDBの業務マスタ・データへアクセス
```

### セキュリティ制約
- 不明なテナントへのアクセス、別テナントへの切り替え、および既定 `demo` への自動フォールバックは禁止されています（503/404エラーで停止）。
- 子アプリ側でも発行元（`dashboard-auth`）、宛先（`dashboard-apps`）、`appKey`、`tenantKey`、および有効期限を厳格に検証します。

---

## 3. マイグレーション管理

共通DB用とテナントDB用のマイグレーションは完全に分離されています。両方を同じDBに実行してはなりません。

### 3.1 common_db（共通マイグレーション）
- ディレクトリ: `db/migrations/common/`
- 最新マイグレーション: `006_reorganize_common_db_control_plane.sql`
- 実行コマンド:
  ```bash
  npm run db:migrate -- --scope common
  ```

### 3.2 テナントDB（テナントマイグレーション）
- ディレクトリ: `db/migrations/tenant/`
- 最新マイグレーション: `011_reorganize_tenant_auth_and_masters.sql`
- 実行コマンド（対象テナントDBを指定）:
  ```bash
  DATABASE_URL="postgresql://.../demo_db" npm run db:migrate -- --scope tenant
  ```

---

## 4. 既存DBの安全な適用とロールバック

本番・開発DBへの適用時は、必ず事前のcustom形式バックアップ（`-Fc`）を取得し、
[migration_and_recovery_guide.md](../../migration_and_recovery_guide.md) の手順に従って段階的に適用してください。
変更作業はトランザクション内で実行され、既存テーブルの削除や `DROP CASCADE` は行いません。
