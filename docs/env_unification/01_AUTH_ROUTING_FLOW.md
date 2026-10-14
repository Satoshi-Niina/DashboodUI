# demoテナント 実行経路トレース（読み取り専用調査、コード根拠付き）

> **過去時点のコード調査記録です。現在の実装・手順として使用しないでください。**
> この調査記録に含まれる `tenant-db-resolver.js` の実装は現行コードから参照されないため削除済みです。
> 現行の認証・ルーティングは [AUTH_ARCHITECTURE.md](../AUTH_ARCHITECTURE.md) と
> [CURRENT_DB_SCHEMA.md](../CURRENT_DB_SCHEMA.md) を参照してください。

対象は「demo」テナントの実行経路。他テナント（daitetsu, kintetsu, kosei）も同一パターンだが、
個別確認はしていない。

## 1. デモ用URLからテナントDBを選ぶ処理

| 段階 | ファイル:行 | 処理 |
|---|---|---|
| パス→テナントキー抽出 | [`assets/tenant-context.js`](../../assets/tenant-context.js) `getTenantKeyFromPath()` | URLの最初のパスセグメントを抽出。空/対象外なら既定値 `"demo"` |
| ログイン画面側の同処理 | [`assets/login.js`](../../assets/login.js) `getTenantIdFromLocation()` | 同ロジック |
| APIレイヤーの抽出 | [`server.js`](../../server.js) `extractTenantIdFromRequest()` | originalUrl→クエリ→ヘッダーの順で解決 |
| テナント→DB解決 | [`server.js`](../../server.js) | 現行 `tenant_app_routings` の route を参照 |
| 接続確立 | [`server.js`](../../server.js) | 環境変数の `TENANT_DB_<KEY>_URL` / `_NAME` を優先し、旧 route の `database_url` を互換用に使う |

**demoの場合**: `database_key` は `DEMO`（例）→ `TENANT_DB_DEMO_URL` → ローカルでは`demo_db`に接続。

## 2. ログイン時のパスワード照合

**エンドポイント**: `POST /api/login`（[`server.js`](../../server.js)、画面側 [`assets/login.js`](../../assets/login.js)）

### Step 1（優先）: common_db

- [`server.js`](../../server.js): `commonAuth.getUserAccess(pool, username, tenantKey)` → `bcrypt.compare(password, access.password_hash)`
- [`server/common-auth.js`](../../server/common-auth.js): `public.users JOIN public.user_tenants JOIN public.tenants JOIN public.user_roles JOIN public.roles LEFT JOIN public.role_permissions LEFT JOIN public.permissions WHERE u.username=$1 AND t.tenant_key=$2 AND u.is_active`
- 一致すればここで成功

### Step 2（フォールバック）: テナントDB（例: demo_db）

- [`server.js`](../../server.js): common_dbで不一致なら `runtime.pool.query('SELECT * FROM public.users WHERE username=$1 AND is_active=true LIMIT 1')` をテナントDBに対して実行
- パスワード照合は **bcryptハッシュ（`$2`始まり）と平文文字列比較の両方をサポート**（[`server.js`](../../server.js)）。平文比較が残っている点は要注意（下記課題表参照）。

## 3. ダッシュボード→各アプリへの識別情報伝搬

### 3.1 ダッシュボード自身のセッション

- Cookie名 `dashboard_session`（JWT）。Claims: `sub`(userId), `tenant_id`, `role`, `permissions[]`。
  署名/検証: [`server/common-auth.js`](../../server/common-auth.js) `issueSession()`。有効期限 既定4時間。

### 3.2 アプリ起動用ランチトークン

- **エンドポイント**: `POST /api/apps/:appKey/launch-token`（[`server.js`](../../server.js)）、`dashboard_session`Cookie必須。
- アプリ利用可否確認: `commonAuth.getEnabledApps(pool, tenant.id, role)`（common_db `tenant_applications`/`applications`）。
- 発行トークン(JWT, 有効期限5分)のClaims: `id/userId, username, displayName, role, externalRole, roles[], tenantKey/tenantId/tenant_id, tenantPath, company_code, company_name`。署名鍵: `SHARED_SSO_SECRET`（必須・フォールバックなし）。

### 3.3 各アプリ側の検証

| アプリ | 受け口 | 検証方法 | DB再照会の有無 |
|---|---|---|---|
| 02_operation-management-app | `POST /api/auth/external`（[legacyApplication.mjs:379-462](../../../02_operation-management-app/server/src/legacyApplication.mjs)） | `verifySharedSSOToken()`（[auth.mjs:160-190](../../../02_operation-management-app/server/src/auth.mjs)）で署名検証のみ。テナント不一致は403 | **なし**。ダッシュボード発行JWTのrole/externalRoleを「そのまま信頼」（コード内コメントで明記、[legacyApplication.mjs:420-428](../../../02_operation-management-app/server/src/legacyApplication.mjs)：「旧ロジック（DBからユーザーを再取得してロールを上書きする処理）は完全に廃止」） |
| 03_Emergency-Assistance | ダッシュボードのランチトークンを使わず、**独自ログイン**（`POST /login`、[routes/auth.mjs:14-50](../../../03_Emergency-Assistance/server/src/routes/auth.mjs)） | `authenticateTenantLogin()`（[tenant-auth.mjs:140-290](../../../03_Emergency-Assistance/server/src/services/tenant-auth.mjs)）: common_dbの`tenant_app_routings`でルーティングのみ取得→テナントDBの`public.users`に対し`bcrypt.compare` | テナントDBに対して行う（common_dbはルーティングのみ） |
| 04_Machine Failure Analysis System | `POST /exchange/token`（`ENABLE_LEGACY_URL_TOKEN=true`時のみ有効、[authRoutes.ts:70-95](../../../04_Machine%20Failure%20Analysis%20System/server/src/routes/authRoutes.ts)） | `verifyDashboardToken()`（[middleware/auth.ts:1-120](../../../04_Machine%20Failure%20Analysis%20System/server/src/middleware/auth.ts)）で署名・issuer・audience検証のみ | なし（トークンの中身をそのまま使用） |

## 4. common_dbの役割：設計文書と実装の相違

**設計文書の主張**（[COMMON_DB_ARCHITECTURE.md](../COMMON_DB_ARCHITECTURE.md)）:
> common_db is the control plane... owns tenant identity, central authentication, application catalog, subscriptions, **and authorization**.

**実装の実態**:

| アプリ | common_dbの実際の用途 | 認証・権限判定の実処理場所 |
|---|---|---|
| 00_DashboodUI | ✅ ログイン認証・権限（tenant_applications等）に**実際に使用** | common_db |
| 02_operation-management-app | ルーティング（`tenant_app_routings`）のみ。認証はJWT署名検証のみ、権限はJWTペイロードをそのまま信頼 | JWT + テナントDB（ユーザーコンテキスト読込時） |
| 03_Emergency-Assistance | ルーティング（`tenant_app_routings`）のみ | テナントDB（`public.users`、bcrypt照合） |
| 04_Machine Failure Analysis System | 未使用（トークン検証のみ、DB照会なし） | トークンペイロードのみ |

**結論（相違の明記）**: common_dbが「中央認証・認可を担う」という設計意図は **00_DashboodUIのみで実現**しており、
02/03/04では common_db は実質的に**ルーティング専用**であり、認証・権限判定はテナントDBまたはJWTペイロードの信頼に委ねられている。
設計文書は現状のコードと一致していない。

## 5. 未解決・要確認事項

1. common_db.public.users とテナントDB.public.users が同期される仕組みがコード上に見当たらない（独立管理されている疑い）。
2. common_db.role_permissions/permissions を実行時に参照しているアプリはコード調査の範囲では見つからなかった（00のみ使用、02/03/04は未使用）。誰がいつこれらを書き込むかは未確認。
3. 03アプリがダッシュボードのランチトークンを受け付ける経路があるかは中確度（未確認）。
4. 04の`exchange/token`は`ENABLE_LEGACY_URL_TOKEN`フラグ次第で、本番での有効/無効設定は未確認。
