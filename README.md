# 保守用車運用管理ダッシュボード

Node.js / Express 5 と PostgreSQL を使うマルチテナント Dashboard です。画面・API は
`server.js` を起点に動作し、共通 DB とテナント別業務 DB を別々に接続します。

## フォルダ構成

| 場所 | 役割 |
|---|---|
| `server.js` | Express の起動入口。Docker・npm・CI がルートのパスで起動します |
| `server/` | 認証・DB gateway 等のサーバー共通モジュールと API route |
| `assets/` | 公開する HTML / JavaScript / CSS と画像。管理画面のタブ切替・イベント登録も `admin.js` が初期化します。静的配信元はこのフォルダだけです |
| `views/` | Express が描画するテンプレート |
| `db/migrations/common/`, `db/migrations/tenant/` | scope ごとの SQL、checksum 対象の履歴、schema verifier |
| `scripts/` | DB migration runner と使い捨て DB workflow 検証 |
| `test/` | Node.js unit tests |
| `docs/` | システム・DB・運用資料と実行しない旧移行案 |

ルート直下には `package.json` / `package-lock.json`、`.env` / `.env.example`、
`README.md`、`Dockerfile`、`.dockerignore`、`.gcloudignore`、`cloudbuild.yaml` と
`deploy.ps1` / `deploy.sh` などのデプロイ用ファイルを残しています。これらは npm、
Docker / Cloud Build、dotenv、GitHub Actions、VS Code task がプロジェクトルートを前提に読むため
移動しません。`.version` はリポジトリ内での参照が見つからない cache-busting 用マーカーですが、
外部のデプロイ手順が読む可能性を排除できないため保持します。`.env.production` もローカル環境設定の
可能性があり、資格情報を含む可能性があるため読み取り・削除せず、ignore 対象として保持します。

## 他の PC でのローカル構築

### 前提

- Node.js 18 以上（推奨: Node.js 20 LTS）
- PostgreSQL 14 以上。共通 DB と各テナント DB は**別々のデータベース**にします。
- PostgreSQL に対し、開発 DB の作成権限と、対象 DB で extension/schema/table/index を作成する権限が必要
- 本番 DB ではなく、ローカルまたは隔離された開発用 PostgreSQL を使用

### 1. 依存関係と環境設定

PowerShell でプロジェクトルートから実行します。

```powershell
npm ci
Copy-Item .env.example .env
notepad .env
```

`.env` の `DATABASE_URL` に共通 DB の接続文字列、`JWT_SECRET` に環境固有の十分に長いランダム値を
設定します。実値は Git 管理・資料記載しません。ローカル PostgreSQL の既定例:

```env
DATABASE_URL=postgresql://<local-user>:<local-password>@127.0.0.1:5432/common_db
TENANT_DB_DEMO_NAME=demo_db
JWT_SECRET=<generate-a-local-random-secret>
```

PowerShell でローカル用シークレットを作る例（出力を `.env` に手動設定し、共有しない）:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

代わりに `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` を設定しても構いません。
`TENANT_ROUTING_DB_NAME` は、ルーティング DB が `DATABASE_URL` と別 DB の場合だけ指定します。

### 2. 新規 DB の作成と migration

まだ DB がなければ、権限のあるローカル PostgreSQL にだけ実行します。

```powershell
createdb common_db
createdb demo_db
```

```powershell
# DATABASE_URL が common_db を指すことを確認
node scripts/db-migrate.js --scope common

# .env の DATABASE_URL と同じ接続先で、demo DB 名だけを選択して実行
node scripts/db-migrate.js --scope tenant --database demo_db
```

共通 DB は先に一度、テナント DB は**テナントごとにそれぞれ** `--scope tenant` を実行します。
起動時の schema 作成・初期データ投入はありません。マイグレーションは各 DB 内の
`public.dashboard_schema_migrations` にバージョン・SHA-256・実行種別を記録します。

### 3. テナント DB とアプリ URL の登録

共通 DB への接続に戻した状態で、接続シークレットではなく DB 名／識別子とアプリ情報を登録します。

```powershell
$portLine = Get-Content .env | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1
$port = if ($portLine -match '^\s*PORT\s*=\s*(\d+)') { $Matches[1] } else { '8080' }
node scripts/db-migrate.js --tenant-key demo --db-name demo_db --app-id dashboard-ui --app-name Dashboard --app-url "http://localhost:$port"
```

子アプリを Dashboard に表示するには、アプリごとに同じ `--tenant-key` / `--db-name` で
`--app-id`・`--app-name`・`--app-url` を変えて追加登録します。登録は不足行だけを追加し、同じ設定での
再実行は何も変更しません。既存行と引数が異なる場合は停止し、DB の値を勝手に上書きしません。
テナント接続は実行環境の `TENANT_DB_DEMO_URL` または `TENANT_DB_DEMO_NAME` と共通の接続資格情報で
解決します。接続 URL は新しいルーティング行に書き込みません。

### 4. 状態確認と起動

```powershell
# .env の DATABASE_URL で common DB を確認
node scripts/db-migrate.js --status --scope common
# 同じ接続設定を使い、demo DB を指定して tenant scope を確認
node scripts/db-migrate.js --status --scope tenant --database demo_db

# .env の PORT（未設定時 8080）を使って起動
$portLine = Get-Content .env | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1
$port = if ($portLine -match '^\s*PORT\s*=\s*(\d+)') { $Matches[1] } else { '8080' }
$baseUrl = "http://localhost:$port"
npm start
```

起動後の HTTP 確認は別の PowerShell terminal で行います:

```powershell
$portLine = Get-Content .env | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1
$port = if ($portLine -match '^\s*PORT\s*=\s*(\d+)') { $Matches[1] } else { '8080' }
$baseUrl = "http://localhost:$port"
Invoke-RestMethod "$baseUrl/health"
Invoke-RestMethod "$baseUrl/ready"
```

`.env` の `PORT`（未設定時は `8080`）にアクセスします。たとえば `PORT=3000` なら
`http://localhost:3000` です。`/health` は HTTP 応答、`/ready` は common DB と登録済み
各テナント DB の適用履歴・構造の確認です。必須 migration が未適用ならアプリは DDL を実行せず、
ログに scope と `npm run db:migrate -- --scope ...` を表示して `/ready` と API を未準備として扱います。
ログイン画面は `/` または `/login.html`、Dashboard は `/dashboard`、管理画面は `/admin` です。
画面 URL と既存の静的パス（例: `/admin.js`）は維持していますが、サーバーコード・SQL・資料・
環境ファイルは静的配信しません。

### demo テナントの URL と接続確認

共通ログイン経路は従来どおり `/` を使えます。demo 専用 URL ではログイン画面を開いた時点から
`/demo` prefix を使用し、成功後も同じ prefix の dashboard と API に引き継ぎます。

| 用途 | ローカル URL |
|---|---|
| 共通 demo ログイン | `http://localhost:<PORT>/` |
| demo 専用ログイン | `http://localhost:<PORT>/demo/` |
| demo 専用 dashboard | `http://localhost:<PORT>/demo/index.html` |

この作業環境の `.env` は `PORT=3000` のため、demo 専用ログイン URL は
`http://localhost:3000/demo/` です。他の PC ではそれぞれの `.env` の `PORT` に置き換えます。

browser code は `/demo` を tenant key `demo` および tenant path `/demo` として識別し、
tenant context bootstrap と API request に `X-Tenant-Id` / `X-Tenant-Path` / `X-Tenant-Full-Url`
を付けます。認証先は共通 DB の user・active membership・tenant・role で確認し、業務 API は routing
で解決した demo tenant DB を使います。URL prefix、query、tenant header を別 tenant に書き換えた
session request は拒否されます。また API ごとに所属・role・permission の現在の有効状態を確認します。

```powershell
$portLine = Get-Content .env | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1
$port = if ($portLine -match '^\s*PORT\s*=\s*(\d+)') { $Matches[1] } else { '8080' }
$baseUrl = "http://localhost:$port"
Invoke-RestMethod "$baseUrl/health"
Invoke-RestMethod "$baseUrl/ready"
Invoke-RestMethod "$baseUrl/api/tenant-context?tenant_id=demo&tenant_path=%2F" |
  ConvertTo-Json -Depth 5
Invoke-RestMethod "$baseUrl/demo/api/tenant-context?tenant_id=demo&tenant_path=%2Fdemo" |
  ConvertTo-Json -Depth 5
```

`/api/tenant-context` の `tenant.resolvedTenantId` / `tenant.dbName` と応答 header
`X-Resolved-Tenant-Id` / `X-Resolved-Db-Name` で route の結果を確認できます。
demo 専用 URL の確認では `tenant.tenantPath` が `/demo` であることも確認してください。
`tenant_app_routings` の demo 行と、その `database_key` / `db_name` に対応する
`TENANT_DB_DEMO_URL` または `TENANT_DB_DEMO_NAME` を整合させます。明示 URL がなければ、
旧 route の `database_url` が接続先として使われ、なければ `db_name` / `TENANT_DB_DEMO_NAME`
と共通の DB host/user/password で接続します。接続文字列は資料やコマンド履歴へ貼らず、環境の
secret 管理に置いてください。

認証はまず共通 DB の `users` / membership / role を照合します。そこで認証されない場合に限り、
解決済み demo DB の `users` を互換 fallback として照合します。アプリ一覧・tenant route は共通 DB、
テナント業務 API は解決済み demo DB を使います。リクエストに tenant ID / route がなく、または
未知の tenant を指定した場合に別テナント／demo DBへ推測 fallback せず、API は 503 を返します。

## 開発方針とテナント公開 ID

- **demo はローカル開発専用**です。Dashboard → demo 認証 → 各アプリ → `demo_db` の一連の動作をまず
  仕業点検（マスタ読込・点検登録・保存・再表示）で完成させ、他アプリは 1 つずつ続けます。
  各社 DB への開発用データ投入や本番接続は行いません。
- URL に出すテナントは、内部 tenant key（`demo` など）ではなく**ランダムな公開 ID**です。
  `public.tenant_public_ids`（`tenant_key` と `public_id` は 1 対 1、更新はトリガーで拒否）が正本で、
  Dashboard と仕業点検の両サーバーが公開 ID → 内部 tenant → routing（許可アプリ・業務 DB）をサーバー側で
  解決します。公開 ID は migration `005_public_tenant_id_lifecycle` 以降 128 bit 以上（`t` + 36 hex = 144 bit）の乱数で、`db:register-tenant` も
  未登録の tenant にだけ追加します。再 migration・再デプロイでは再生成・上書きされません。
- SSO の launch token は内部 tenant key で署名され、子アプリへは公開 ID で渡します。子アプリは公開 ID を
  内部 key に戻した上で、token の tenant／path／所属／role を照合します。URL だけを書き換えても
  他テナントには届きません（確認では `403 Tenant mismatch`）。
- `/demo/` は開発用の別名で、`ENABLE_DEMO_ALIAS` で制御します（既定: `NODE_ENV=production` では無効、
  それ以外は有効）。`REQUIRE_PUBLIC_TENANT_ID` が有効（本番既定）の環境では、公開 ID 以外の tenant
  指定（内部 key を含む）は 404 になります。未知の tenant は別テナント DB へ fallback しません。

ローカル demo の公開 ID は、起動前に次で確認します（接続情報は表示しません）。

```powershell
@'
require('dotenv').config({quiet:true});
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query("SELECT tenant_key, public_id FROM public.tenant_public_ids WHERE tenant_key='demo'")
 .then(r=>{console.table(r.rows);return p.end()});
'@ | node -
```

この環境の demo は `http://localhost:3000/tbf20b2f4d91ec39dafecd2f27f28ae43549a/`（公開 ID の URL、2026-10-04 に 005 で再発行）と
`http://localhost:3000/demo/`（開発用別名）の両方で同じ動作です。公開 ID は環境ごとに異なるため、
他の PC では上記コマンドの値を使ってください。

### 公開 ID の強度と管理手順

- **強度の確認結果:** 当初の migration `004` は `substr(replace(gen_random_uuid()::text,'-',''),1,24)` で、先頭 24 hex に
  UUIDv4 の固定 version nibble が含まれるため約 92 bit しかなく、128 bit 未満でした（DB の実値も長さ 25、
  14 文字目が固定 `4` で一致）。適用済みの 004 は変更せず、migration `005_public_tenant_id_lifecycle` で
  次を行いました。
  - `public.generate_tenant_public_id()`: UUIDv4 を 2 つ使い version/variant の固定 nibble を除いた 36 hex
    （144 bit）。CLI の `generatePublicTenantId()` は `crypto.randomBytes(18)`（144 bit、Node CSPRNG）。
  - 33 文字未満（128 bit 未満）の公開 ID の登録をトリガーで拒否し、既存の弱い ID を失効して再発行。
  - `retired_at`／`retired_reason` を追加。失効した ID は再有効化・再利用できず、tenant ごとの有効 ID は 1 件。
- 実値の確認（2026-10-04）: 有効 ID は 3 tenant とも長さ 37（`t`＋36 hex）。生成関数 4000 回で重複 0、36 桁すべてで
  16 種の文字が出現（固定桁なし）。Node 側の生成も同様。
- **管理コマンド**（`.env` の `DATABASE_URL` が対象の common DB であることを確認し、変更前にバックアップを取得）:

```powershell
node scripts/db-migrate.js --list-public-ids
node scripts/db-migrate.js --rotate-public-id --tenant-key demo --reason "URL leaked"
node scripts/db-migrate.js --retire-public-id --tenant-key demo --reason "tenant suspended"
```

  `--rotate-public-id` は有効 ID を失効して新 ID を発行し、`--retire-public-id` は失効のみ（その tenant の
  公開 URL は使えなくなります）。どちらも 1 トランザクションで、理由が必須です。サーバーのキャッシュ
  （30 秒）が更新されると旧 URL は 503 になります。既存 session・内部 tenant key・DB は変わらないため、
  漏えい時は JWT secret のローテーションも検討します。新しい URL は利用者へ別途連絡してください。
  本番では再 deploy だけで ID は変わらず、上記コマンドを明示的に実行した場合のみ変わります。
## 仕業点検アプリとのローカル連携

仕業点検アプリは別プロセスです。Dashboard を `npm start` で起動した後、別の PowerShell terminal で
同じ親フォルダーにある `02_operation-management-app` を起動します。

```powershell
Set-Location 'D:\sysbuckup\Single system group\02_operation-management-app'
npm run dev
```

この環境では client が `http://localhost:5173/`、API が `http://localhost:3001/` で待ち受けます。
Dashboard の `http://localhost:3000/demo/` でログインし、「仕業点検」をクリックすると、
common DB の demo／`inspection` route が返す client URL を popup で開きます。handoff URL の tenant
情報は公開 ID（`tenant_id=<公開ID>`、`tenant_path=/<公開ID>`）で、ローカルでは
`http://localhost:5173/?tenant_id=<公開ID>&tenant_path=%2F<公開ID>` です。token は URL に含めません。

Dashboard と子アプリは別 origin／port のため Cookie や browser storage を共有しません。
Dashboard は短命 launch token を URL に入れず、許可 origin を確認した `postMessage` handshake で渡します。
子アプリは token の signature／issuer／audience、app key、tenant key/path、demo DB の exact user UUID・
所属・role を別途検証します。username だけでは DB 間ユーザーを対応付けません。

Dashboard の login・アプリ起動許可・`tenant_app_routings` は `common_db`、仕業点検の user／RBAC／
点検業務 API は route で解決した `demo_db` を使います。起動順序、環境変数と検証内容は
[仕業点検アプリの開発手順](../02_operation-management-app/Docs/README.md) を参照してください。

## 本番 Git 連携ビルド・Cloud Run

確認できたリポジトリ設定では、[GitHub Actions の deploy workflow](.github/workflows/deploy.yml) が
`main` または `master` への push と `workflow_dispatch` を契機に実行されます。workflow は
GitHub-hosted Ubuntu runner で認証後、`gcloud builds submit --tag ... .` を実行し、リポジトリ直下の
[Dockerfile](Dockerfile) を使ったリモート Cloud Build で image を作成します。作成した image を
Cloud Run service `dashboard-ui` に deploy し、region は `asia-northeast2` です。手順は概ね次の通りです。

```text
GitHub push (main/master)
  -> GitHub Actions (.github/workflows/deploy.yml)
  -> gcloud builds submit --tag gcr.io/<GCP_PROJECT_ID>/dashboard-ui:<timestamp>-<commit> .
  -> Cloud Build が Dockerfile をビルド
  -> Cloud Run dashboard-ui (asia-northeast2)
```

この経路は GitHub Actions から Cloud Build へリモート build を依頼する構成です。workflow の
`gcloud builds submit --tag` は `cloudbuild.yaml` を指定していないため、この Actions 経路で
`cloudbuild.yaml` の別 build/deploy 設定は使われません。Cloud Build に独立した Git trigger が
追加設定されていないかは GCP 権限が必要なため、このリポジトリだけでは確認できません。
本番 deploy は今回行っていません。

Cloud Run の hostname は service metadata から動的に取得します。URL を固定・推測せず、GitHub Actions
が利用する project ID と同じ値、認証済み gcloud account で取得してください。demo 専用 URL は取得した
service URL に `/demo/` または `/demo/index.html` を追加します。

```powershell
$projectId = Read-Host 'GitHub Actions の GCP_PROJECT_ID'
$serviceUrl = (gcloud run services describe dashboard-ui `
  --project $projectId `
  --region asia-northeast2 `
  --format='value(status.url)').Trim()
if (-not $serviceUrl) { throw 'Cloud Run service URL was not returned.' }
$demoLoginUrl = "$serviceUrl/demo/"
$demoDashboardUrl = "$serviceUrl/demo/index.html"
Write-Output "demo login: $demoLoginUrl"
Write-Output "demo dashboard after login: $demoDashboardUrl"
```

本番の共通ログイン経路 `/` は維持されます。demo 専用 URL はサービス URL の `/demo/`
（ログイン）および `/demo/index.html`（ログイン後 Dashboard）です。prefix を付けた画面からの
bootstrap/API request は tenant identity を明示し、ログイン後の session tenant と所属・role の
有効性を API ごとに照合します。業務処理の DB 解決先は common DB ではなく、common route に登録した
demo 専用 tenant DB です。
この環境には認証済み gcloud account がなく、実際に割り当て済みの Cloud Run hostname と本番の demo
route／DB 接続先は照会できていません。**上記のパスはコードで確認済み、production hostname と
production demo 接続先は未確認**です。実値の credentials は README に記載しません。

workflow が Cloud Run に渡す共通側の設定は `CLOUD_SQL_INSTANCE`、`DATABASE_URL`、`DB_USER`、
`DB_PASSWORD`、`DB_NAME=common_db`、`JWT_SECRET` です。tenant route の `database_url` を使わない
場合、demo の分離された DB 名（`TENANT_DB_DEMO_NAME` または route の `db_name`）と共通 host/user/
password、もしくは `TENANT_DB_DEMO_URL` を実行環境で別途構成する必要があります。現在の workflow
ファイルでは demo 専用 tenant env 値を設定していないため、production の実際の route 値・Secret
binding を GCP 側で確認してください。

### 本番へ移行するための設定（公開 ID URL）

本番の起動 URL は「Cloud Run の service URL＋公開 ID のパス」（`<serviceUrl>/<公開ID>/`）です。上記の
`/demo/` は開発用別名のため、本番では `ENABLE_DEMO_ALIAS` を未設定または `false` にし、
`REQUIRE_PUBLIC_TENANT_ID` は既定（本番で有効）のままにします。ローカル・本番とも同じコードで、次を環境設定だけで
切り替えます: 接続方式（`DATABASE_URL` または `CLOUD_SQL_INSTANCE`＋`DB_*`）、secret（`JWT_SECRET` ほか）、
各アプリの起動先（`tenant_app_routings.app_url`）。routing の `localhost` 値は各ローカル DB の登録データで、
migration の初期データには含めていません。本番 DB には、バックアップ後に `node scripts/db-migrate.js --scope common`
を適用してから `db:register-tenant` で tenant を登録します（公開 ID は不足分だけ生成され、既存値は変わりません）。

## 既存 DB の更新（common／各 tenant DB で個別に実施）

1. 変更承認を確保し、対象が意図した DB であることを確認してから、復元可能なバックアップを取得・検証します。
   local `DATABASE_URL` が共通 DB、demo tenant DB が `demo_db` の構成では、状態確認により共通 DB と demo DB を個別に選択します。
2. 履歴を確認します:

```powershell
node scripts/db-migrate.js --status --scope common
node scripts/db-migrate.js --status --scope tenant --database demo_db
```

3. 履歴が存在しない既存 DB は、runner の `000_legacy_anchor.baseline.verify.sql` が実構造を検証し、
   成功した場合のみ baseline を記録します。確認済み backup の後に scope ごとに実行します:

```powershell
node scripts/db-migrate.js --baseline --scope common
node scripts/db-migrate.js --baseline --scope tenant --database demo_db
```

verifier が失敗した DB は baseline せず、差分を確認して互換 migration を用意します。既存 DB に対して
`--baseline` を無条件に実行しないでください。

4. baseline または既存履歴確認後、未適用 migration を scope ごとに実行します:

```powershell
node scripts/db-migrate.js --scope common
node scripts/db-migrate.js --scope tenant --database demo_db
```

適用済み version は再実行されず、適用済みファイルの checksum が異なる場合は停止します。
`--database` は `.env` の `DATABASE_URL` の接続先情報を保ち、DB 名だけを指定値へ切り替えます。
tenant DB が別の host／credential を使う場合は、明示的にその DB 接続設定を使用して更新してください。
共通 DB の完了後、各 tenant DB を個別に処理します。
`docs/migrations/20260903_common_db_foundation_up.sql` は過去の手動 SQL のまま保持し、このランナーでは
実行しません。同一 DB への common／tenant migration の混在は禁止です。

## DB 構築・更新の確認テスト

ローカルの使い捨て PostgreSQL で空 DB・合成旧 DB・再実行・運用値の保持・ログイン/API ルーティングを
確認するコマンドです。専用のローカル PostgreSQL 管理 URL を指定します。このテストは
`dashboard_new_*_<pid>_<random>` / `dashboard_old_*_<pid>_<random>` という名前の DB を一時作成し、
終了時にその DB だけ削除します。専用検証用 PostgreSQL に対してのみ実行してください。

```powershell
$env:TEST_DATABASE_ADMIN_URL = 'postgresql://<local-admin>:<local-password>@127.0.0.1:5432/postgres'
npm test
npm run test:db-workflow
Remove-Item Env:TEST_DATABASE_ADMIN_URL
```

### 検証結果（2026-10-04、ローカル）

検証済み（ローカル `common_db`／`demo_db`、バックアップ取得後に common migration `004`／`005` を適用）:

- `npm test`（Dashboard 5 件）、`npm run test:db-workflow`（7 migration の新規構築・公開 ID の rotate／再利用拒否／弱い ID 拒否・旧スキーマ更新・再実行・
  未知 tenant 分離）、仕業点検 server `npm test`（23 件）、client `tsc --noEmit`。
- 公開 ID／`/demo/` の両 URL で `GET .../api/tenant-context` が `demo_db` に解決、未登録 tenant は 503、
  `kintetsu` 宛ての demo token は `403 Tenant mismatch`。
- 仕業点検 API（SSO token 交換 → `/api/integration/session` → マスタ全件 → 点検登録 201 → 再表示）が
  公開 ID／`demo` の両方で成功（`demo_db`。各 1 件の検証用点検記録 `e2e-*` が残っています）。
  無トークン・署名不正は 401。この確認では token を API で生成しており、ブラウザー操作ではありません。
- **ユーザー管理 API・画面修正（2026-10-04）**:
  - `GET /api/users/:id` 呼び出し時の 500 エラーを修正。アクティブな DB プール (`getRequestDbPool(req)`) 経由で取得し、`email` 等の任意カラム不在時でも安全に動作。
  - パスワードハッシュ・トークン・DB 接続情報をレスポンスから完全除去。
  - 存在しないユーザー指定時は `404`、自分の権限を超える `system_admin` 付与要求等は `403` として適切に処理。
  - ユーザー一覧の編集・削除ボタンから絵文字・文字化けを除去し「編集」「削除」表記へ統一。スクリプトキャッシュ版数を `v=20261004-user-fix` に更新。
  - API検証: `demo` 環境にて `GET /api/users` (200), `GET /api/users/:id` (200), 存在しない ID (404), `PUT /api/users/:id` (200, 保存・再表示確認) をパス。

利用者が確認済み: 実ブラウザーで `http://localhost:3000/demo/` から Dashboard にログインし、「仕業点検」ボタンで
再ログインなしに起動（この確認は私の自動操作ではなく利用者の実操作）。

未検証: 再発行後の公開 ID URL での実ブラウザー起動、
他アプリ（故障・緊急・計画）、各社 DB、本番環境。

## 環境変数と資料

- [.env.example](.env.example): 環境変数名のみのテンプレート
- [資料一覧](docs/README.md)
- [システム構成・現在の DB 構造](docs/CURRENT_DB_SCHEMA.md)
- [マイグレーション方式・検証結果](docs/MIGRATION_REPORT.md)
- [共通 DB の表・関係](docs/COMMON_DB_ARCHITECTURE.md)
- [認証・子アプリ連携](docs/AUTH_ARCHITECTURE.md)
- [運用メモ](docs/DASHBOARD_FUNCTION_SPEC_AND_OPERATION_GUIDE.md)

今後コード・設定・配置を変更した場合は、変更の最終段階でこの README と影響する既存資料を更新し、
記載したパス・コマンド・環境設定を実装に一致させてください。新規の報告用資料は追加せず、既存資料へ
統合します。プロジェクト内の作業規約は [AGENTS.md](AGENTS.md) に記載しています。

本番 Cloud SQL は Cloud Run 実行環境の `CLOUD_SQL_INSTANCE`、`DB_USER`、`DB_PASSWORD`、
`DB_NAME` とテナント別 Secret Manager／環境変数で構成してください。本番 DB には検証コマンドを
設定せず実行しないでください。
