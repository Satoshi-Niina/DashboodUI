# DB マイグレーション方式と確認状況

## 現行の管理方式

`db/migrations/common/` と `db/migrations/tenant/` を `scripts/db-migrate.js` が別々に実行します。
各 DB の `public.dashboard_schema_migrations` に適用 version、SQL ファイル名、SHA-256 checksum、
実行種別（`migration` / `baseline`）、日時、実行 DB ユーザーを記録します。SQL 適用と検証と履歴記録は
DB transaction 内で行います。適用済み SQL の checksum が変わっていた場合は停止します。
適用済み SQL を編集せず、修正は新しい migration として追加します。

| 操作 | コマンド | 接続先 |
|---|---|---|
| 共通 DB の構築／更新 | `npm run db:migrate -- --scope common` | `DATABASE_URL` の DB |
| テナント DB の構築／更新 | `npm run db:migrate -- --scope tenant` | `DATABASE_URL` の DB。tenant ごとに実行 |
| 適用履歴・checksum 状態 | `node scripts/db-migrate.js --status --scope common` または `--scope tenant --database <DB名>` | `.env` の DB または指定した DB |
| 既存構造の確認済み baseline | `node scripts/db-migrate.js --baseline --scope common` または `--scope tenant --database <DB名>` | verifier 合格後の対象 DB のみ |
| テナント／アプリの route 登録 | `npm run db:register-tenant -- ...` | 共通 DB。詳細は [README](../README.md) |

## 新規 DB と既存 DB

- **新規 DB:** 空の共通 DB に `--scope common`、続いて各空テナント DB に `--scope tenant`。
  空 DB のみ migration runner が履歴表を作成し、version 順に構造変更・検証・記録します。
- **既存 DB:** 履歴があれば通常の `db:migrate`。履歴がない既存 schema は runner が拒否します。
  baseline verifier が要求する core schema を実 DB で確認し、`node scripts/db-migrate.js --baseline --scope ...`
  を明示実行後、通常 migration で残りの差分を適用します。baseline は構造を確認せずに実行済み扱いしません。
- common と tenant の scope は DB ごとに独立し、同じ DB に混在させません。common DB を先に更新し、
  対象となる各 tenant DB を個別に更新します。
- アプリ起動時に DDL／seed は実行しません。起動時の read-only readiness 検査が未適用・checksum
  不一致・構造不足を見つけると未準備として、実行する scope 別コマンドをログに表示します。
- 本番 repository 設定は GitHub Actions の main/master push → `gcloud builds submit --tag` による
  Cloud Build Dockerfile build → Cloud Run `dashboard-ui` (`asia-northeast2`) です。
  exact Cloud Run URL は動的 service metadata で取得します。別途 Cloud Build Git trigger があるかは未確認です。

## SQL の分類とデータ保護

- `db/migrations/{common,tenant}/` は現行ランナー専用の順序付き migration と verifier です。
- tenant scope の `003_business_timestamps` は、legacy business table に不足する
  `created_at` / `updated_at` を `ADD COLUMN IF NOT EXISTS` で補い、read API が要求する列を揃えます。
  既存行の business fields は変更せず、新しく補う timestamp のみに DB default が適用されます。
- runner は migration transaction 内で `search_path` を `public, master_data` に限定し、空 DB における
  extension の配置やロール固有の default `search_path` に依存せず migration を実行します。SQL version/checksum
  は変更しません。
- legacy common schema が tenant routing 用の旧 `app_resource_routing`（`tenant_key` 主キー）を持つ場合、
  `002_z_legacy_resource_routing` が既存表を `app_resource_routing_legacy` に rename して保持し、
  現行 app/resource 複合キーの表を用意します。削除や行の移し替えはしません。legacy 表に行がある場合も
  rename 後に全行が残ることを検証します。
- `docs/migrations/20260903_common_db_foundation_up.sql` / `_down.sql` は旧来の手動 migration 案であり、
  実適用状況が不明なため保持しています。現行ランナーは読み込まず、標準手順として実行しません。
- `docs/local-dev-migration.sql` と `docs/user_id_migration/` は別用途の過去資料として保持します。
- migration seed は role や resource route の**不足分のみ**を追加し、既存値を更新しません。
  アプリ設定・無効化済み所属・業務データの初期化／上書きはしません。
- `db:register-tenant` は接続情報を route table に書きません。同一 route の同値登録は no-op、
  異なる値での既存 route 上書きは拒否します。接続先 URL は `TENANT_DB_<KEY>_URL` または
  `TENANT_DB_<KEY>_NAME` 環境変数で設定します。

## コード配置と静的配信

- migration SQL は従来どおり `db/migrations/common/` と `db/migrations/tenant/` に配置しています。
  ファイルを移動・編集していないため、履歴 version と checksum の識別は変わりません。
- runner は `scripts/db-migrate.js`、E2E workflow は `scripts/db-workflow-check.js`、
  unit test は `test/` に配置します。
- ブラウザー向け HTML / JavaScript / CSS / 画像は既存の `assets/` にまとめ、同ディレクトリだけを
  Express 静的配信元にしました。既存 URL と tenant-prefix 付き URL は維持しています。
  サーバーコード、SQL、環境設定、資料、package manifest は静的配信しません。
- 認証・DB 共通モジュールは既存の `server/` に配置します。`server.js` はルート起動入口のままです。

## 検証結果

### 検証済み

PostgreSQL 17.5 のローカル検証インスタンスに、このテスト用に作成した使い捨て DB を使う
`npm run test:db-workflow` で次を確認します:

- 空 common／tenant DB からの構築、schema verifier、同一 runner の再実行。
- 合成した旧 foundation common DB と旧 tenant DB で、未確認 baseline の拒否、構造確認後の baseline、
  additive migration と再実行。
- 運用者変更済みアプリ名／URL、有効無効設定を migration 後も保持。
- fresh DB route 登録の同値再実行、異なる値での更新拒否、URL credential を DB に保存しないこと。
- common／tenant を接続したアプリ起動、fixture ログイン、認証 API、アプリ route。
- 共通 root URL と `/demo/` URL の両方での demo common DB ログイン、demo tenant context による demo DB
  解決、未登録 tenant の 503 fail-closed。
- demo 専用 `/demo/` URL の tenant context bootstrap、login identity、`/demo/index.html` への redirect、
  demo DB API routing、tenant-prefix 付き JS/CSS/画像配信、別 tenant URL/query/header への session 再利用拒否、
  無効化後の membership／permission の拒否。
- 旧 `app_resource_routing` の必須 legacy 列・`tenant_key` 主キーを持つ fixture を更新し、
  旧データを archive table に保持したまま current mapping seed を適用できること。
- 合成 legacy tenant schema で業務 API が使う metadata 列を migration 後に利用できること。
- demo ルートに対応する `/` ログイン・`/index.html` Dashboard と `/demo/` ログイン・
  `/demo/index.html` Dashboard、および tenant-prefix 画面・asset 配信。
- root／tenant-prefix の画面と JS / CSS / 画像の HTTP 配信、および server code・SQL・docs・`.env` の
  静的配信が拒否されること。
- `npm test` の unit test と Node 構文検査。
- ローカル PostgreSQL `common_db`、`demo_db`、readiness 対象の `daitetsu_db` / `kintetsu_db` は、
  各 DB の構造を調べ baseline verifier が true であることを確認。4 DB それぞれの検証済み custom-format
  backup を取得してから baseline / migration を実行し、全 migration history/checksum が一致。
- サーバー再起動後 `/ready` は `READY`、`/demo/` と `/demo/index.html` は HTTP 200、
  tenant-context は `demo` / `/demo` / `demo_db`、`/demo/api/offices` は HTTP 200 で demo DB へ解決。
  demo offices API の返却件数は 0。実ユーザーの正しい認証情報を使用したログイン成功は本作業では試して
  おらず、専用 URL のログインフォーム配信と、テスト用 disposable DB での成功ログインを確認。

検証スクリプトは名前を限定した4つの使い捨て DB を成功・失敗にかかわらず終了時に削除します。
専用のローカル検証 PostgreSQL のみを指定してください。

### 未検証

- 実環境・本番 DB の現行 schema、migration 適用履歴、各環境独自の列／制約／データ差分。
- 合成 fixture と異なる旧 schema 形状での baseline。verifier が拒否したときは個別調査が必要です。
- 本番 Cloud SQL / Secret Manager / Cloud Run への migration と配備。
- Cloud Run が割り当てた production hostname と production demo route / DB 接続先。gcloud は利用可能ですが
  active account がなく service metadata を read-only query できませんでした。
- Google-hosted Cloud Build の remote image build と、本番 Git push 後の deploy workflow。
- 実ユーザー・実業務データを使った全画面・全機能の受け入れ試験。

本作業では本番・既存 DB に接続せず、初期化や業務データ削除を行っていません。
実環境適用前にバックアップ、read-only schema/history 照合、承認、隔離複製での事前検証が必要です。
