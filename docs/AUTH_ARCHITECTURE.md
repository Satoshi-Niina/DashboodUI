# 認証・子アプリ起動フロー

この資料は現行 `server.js` / `server/common-auth.js` / `assets/app.js` のコード経路を記録します。
テナント表の実環境への適用状況は [DB 構造資料](./CURRENT_DB_SCHEMA.md) のとおり未確認です。

## Dashboard へのログイン

1. 共通 demo ログインは `http://localhost:<PORT>/` または Cloud Run service URL の `/` です。
   demo 専用ログインは `http://localhost:<PORT>/demo/` または Cloud Run service URL の `/demo/` です。
   ローカル PORT は `.env` の値（未設定時 8080）を使います。
   prefix なしも `/demo` prefix も browser code が demo と解釈します。他 tenant は
   `/<tenant-key>/...` の最初の path segment から識別します。
2. 共通 URL は `POST /api/login`、専用 URL は `POST /demo/api/login` にユーザー名・パスワード・
   `tenantKey` を送ります。専用 URL は API request 自体にも `/demo` prefix を保ちます。
3. 最初に共通 DB の `users` / `user_tenants` / `tenants` / `user_roles` / `roles` /
   `role_permissions` / `permissions` で認証します。
4. 共通 DB で一致しない場合、旧 `tenant_app_routings` で解決したテナント DB の `users` も
   認証対象とします。パスワードが bcrypt 形式でない場合に平文比較する互換経路が残っています。
5. 成功時は `dashboard_session` JWT を HttpOnly Cookie に設定します。Cookie は production で
   `Secure`、常時 `SameSite=Lax` / `Path=/`、既定 4 時間有効です。
6. 認証済み API は Cookie の署名・issuer・audience・有効期限を検証し、session の tenant と
   request の tenant が一致すること、共通 DB の所属・tenant・role・permission または tenant user が
   現在も有効であることを確認します。

`server.js` の API middleware は明示 tenant ID / tenant path / URL path から routing row を解決し、
DB 名と接続 pool を決めてから API route へ渡します。`/demo/` の画面と tenant-context bootstrap は
`/demo` を保持し、browser API request は `X-Tenant-Id` / `X-Tenant-Path` / `X-Tenant-Full-Url` で
同じ identity を送ります。ログイン成功後の遷移先は `/demo/index.html` です。demo の common authentication とアプリ一覧・
route lookup は共通 DB、業務 API と tenant-user fallback は解決済み demo DB を使います。
tenant route が見つからない場合は 503 で停止し、他 tenant や既定 DB に切り替えません。

専用 URL 上で `tenantKey` / `tenant_id` を別 tenant に差し替えたログインは拒否されます。ログイン後も
URL prefix・tenant query・tenant header を別 tenant に差し替えた request は拒否され、membership、
role、permission を無効化・変更した場合は次の API request が 403 になります。

ローカルで実際の解決先を確認するには、起動後に
`$baseUrl = "http://localhost:$port"` を `.env` の PORT（未設定時 8080）から設定後、
`Invoke-RestMethod "$baseUrl/demo/api/tenant-context?tenant_id=demo&tenant_path=%2Fdemo"` を実行し、
`tenant.resolvedTenantId` / `tenant.dbName` と `X-Resolved-Tenant-Id` /
`X-Resolved-Db-Name` および `tenant.tenantPath=/demo` を確認します。Cloud Run hostname は固定値として推測せず、README 記載の
`gcloud run services describe` で取得します。本番の route／Secret binding と hostname は今回未照合です。

テナント DB の平文パスワード互換経路は現役コードです。適用済みデータの確認と別途承認なしに
削除・変換しません。新しいデータに平文パスワードを登録しないでください。

## 子アプリ起動

1. `POST /api/apps/:appKey/launch-token` は `dashboard_session` Cookie を必須とします。
2. API は認証済みテナントを共通 DB から解決し、現行の `tenant_app_routings` に有効なアプリ行が
   あることを確認します。
3. 発行する JWT は `appKey`、ユーザー・テナント・ロール情報を含み、5 分で期限切れになります。
   署名鍵は `SHARED_SSO_SECRET`（必須。未設定だとサーバーは起動時にエラー終了し、`JWT_SECRET` へのフォールバックはしない）、issuer / audience は環境設定です。
4. Dashboard の `assets/app.js` は `tenant_id` / `tenant_path` のみを URL に付け、短命 JWT は
   対象 origin を指定した `postMessage` handshake で子アプリへ渡します。ブラウザー上で
   トークンを扱うため、URL query に長期トークンを付ける設計とは異なりますが、子アプリが
   handshake と JWT 検証を正しく実装していることを個別に確認する必要があります。

仕業点検アプリでは `appKey=inspection`、signature、issuer／audience、tenant key/path を検証し、
tenant DB の exact user UUID・active user・membership・RBAC を確認して app-local session を発行します。
username だけの対応付け、tenant 不一致の許可、未指定 tenant の demo fallback は行いません。
ローカルでは SSO exchange、`/api/me`、`/api/integration/session`、点検一覧 API の成功と不正 claim の拒否を
確認しました。browser に認証済み Dashboard session がなく、実際のボタン click／popup handshake は
未確認です。両 app の起動方法・詳細な API 結果は
[仕業点検アプリの開発手順](../../02_operation-management-app/Docs/README.md) を参照してください。

## 制約

- 共通 authentication と旧 app routing table の両方に依存します。必要な表や route がない DB では
  全経路が成立するとは限りません。
- Dashboard での起動制御だけで子アプリ直アクセスを認可できるとは限りません。各子アプリ側でも
  署名、issuer、audience、期限、対象テナント・アプリを検証してください。
- 旧 `tenant-db-resolver.js` は server code から参照されない重複実装だったため削除しました。
  現行の接続先解決は `server.js` で `TENANT_DB_<KEY>_URL` / `_NAME` と route 設定を使います。
- 認証テーブル・所属・ロールの適用有無は実 DB の読み取り専用調査で確認してください。
