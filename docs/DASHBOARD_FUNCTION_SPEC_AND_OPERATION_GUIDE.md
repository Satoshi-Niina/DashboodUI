# ダッシュボード機能・運用メモ

## 現行システム

- `server.js`: Express 起動入口、認証 API、設定 API、テナント DB 解決と read-only readiness 検査
- `assets/app.js` / `assets/index.html`: ダッシュボード画面とアプリ起動
- `assets/login.js` / `assets/login.html`: ログイン画面
- `assets/admin.js` / `assets/admin.html`: 管理画面。`admin.js` が各タブの表示切替と画面イベントを初期化
- `server/common-auth.js`: 共通ユーザー認証、セッション Cookie、認証済みテナントのアプリ可否判定
- `server/db-gateway.js` / `server/shared-db-config.js`: 旧リソースルーティングと DB アクセス
- `assets/`: HTML / JavaScript / CSS / 画像の公開用配信元。サーバーはこのディレクトリだけを静的配信
- `.github/workflows/deploy.yml`: Cloud Build を使った Cloud Run デプロイ

## DB とテナントの扱い

共通 DB と各テナント DB は別の役割です。現行サーバーは旧
`public.tenant_app_routings` を参照してテナントの DB 接続を解決します。共通認証側は
`tenants`、`user_tenants`、`user_roles` 等の正規化表も参照しますが、これらの表が各環境に
適用済みかは未確認です。

起動時に DDL や初期データ更新は行いません。構造一覧と migration の制限は
[CURRENT_DB_SCHEMA.md](./CURRENT_DB_SCHEMA.md) を参照し、実データを持つ DB を検証先にしないでください。

## 起動・デプロイ

ローカルはリポジトリ直下の [README](../README.md) の手順を使います。
現行 repository workflow は `main` / `master` への Git push（または workflow_dispatch）で GitHub Actions
を起動し、`gcloud builds submit --tag ... .` によりルートの Dockerfile を使って Cloud Build 上で
image を作成後、`dashboard-ui` Cloud Run service（`asia-northeast2`）へ deploy します。
`cloudbuild.yaml` を参照する command は workflow にありません。実際の環境変数・Secret binding と
service URL の確認コマンドは [README の本番 build 手順](../README.md#本番-git-連携ビルドcloud-run)を参照。
GCP native Git trigger の追加有無と production service metadata は権限不足で今回未確認です。
認証情報、接続文字列、トークン、固定ユーザーの初期パスワードをこの資料やソースへ記録しません。

demo は既存の共通ログイン `/` を引き続き利用できます。`.env` の PORT（未設定時 8080）を使う専用 URL は
`http://localhost:<PORT>/demo/`（ログイン）と `http://localhost:<PORT>/demo/index.html`（Dashboard）です。
専用 URL の `/demo` identity は browser bootstrap、login request、以後の API header に保持されます。
認証は common DB の所属・role を照合し、業務 API は demo route が解決する tenant DB を使います。
別 tenant に URL/query/header を書き換えた request は session tenant 不一致で拒否し、所属または role が
無効化されると後続 API も拒否します。

本番専用 URL は Cloud Run service URL に `/demo/`（ログイン）または `/demo/index.html`（Dashboard）を
追加します。hostname は README の gcloud コマンドで取得してください。実 hostname と実 demo DB route は
GCP authenticated context がなく未確認です。検証環境での専用 prefix の画面・bootstrap・login redirect・
auth/API tenant isolation は `npm test` と `npm run test:db-workflow` で確認します。

旧資料にあった localStorage への長期トークン保存や URL query での認証情報引渡しは、
現行実装の説明として使用しないでください。現行のアプリ起動では
`POST /api/apps/:appKey/launch-token` が 5 分有効の JWT を発行し、Dashboard の
`assets/app.js` が対象 origin を指定した `postMessage` handshake で子アプリへ渡します。
子アプリ側の受け入れ方式・JWT 検証は個別リポジトリで確認してください。
