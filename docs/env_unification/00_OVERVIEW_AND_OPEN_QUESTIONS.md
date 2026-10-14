# 環境統一 作業 概要（common_user_id移行は一時凍結）

> **過去の調査記録です。現行手順・現在の実 DB 状態として使用しないでください。**
> この記録中のローカル DB 一覧、接続設定、認証経路、承認状況は本作業では再検証していません。
> 現行コードの確認には [CURRENT_DB_SCHEMA.md](../CURRENT_DB_SCHEMA.md)、
> migration の扱いには [MIGRATION_REPORT.md](../MIGRATION_REPORT.md) を参照してください。
> 実 DB 接続・変更はこの記録を根拠に行わないでください。

本タスクの最優先事項を、**本番（GCP プロジェクト `maint-vehicle-management`）とローカルの
DBスキーマ・マイグレーション・デモテナント動作の統一**に切り替える。
`common_user_id` 移行（[../user_id_migration/](../user_id_migration/)）は、
本タスクで全体構成が確認できるまで適用しない（ドキュメントは凍結のまま保持）。

## 進め方（今回合意した順序）

1. **読み取り専用の現状調査と差分表を提示する**（本ドキュメント一式、実施中）
2. ローカル・隔離DBで修正と検証を完了する（未着手）
3. 本番へ適用するSQL・対象DB・変更行・バックアップ・復旧方法を具体的に提示する（未着手）
4. 本番変更は検証結果と対象が明確になってから実施し、適用後に指定4ユーザーでログイン・権限を確認する（未着手）

## 成果物一覧

| 成果物 | ファイル | 状態 |
|---|---|---|
| 認証・接続フロー（demoテナント実行経路） | [01_AUTH_ROUTING_FLOW.md](./01_AUTH_ROUTING_FLOW.md) | 完了（コード調査ベース） |
| 環境別DB差分表 | [02_DB_DIFF_LOCAL_VS_PRODUCTION.md](./02_DB_DIFF_LOCAL_VS_PRODUCTION.md) | ローカル側完了。本番側は**未接続・要確認事項あり**（下記参照） |
| 本番接続方法の確認結果 | [02_DB_DIFF_LOCAL_VS_PRODUCTION.md](./02_DB_DIFF_LOCAL_VS_PRODUCTION.md)内 | 既存設定から確認済み（推測ではない）。実接続は未実施 |
| マイグレーション統一案・デモユーザー設定手順・検証結果 | 未作成 | 本番アクセス方針の確認後に着手 |

## 本番（GSC）が指すものの確認結果（既存設定から確認、推測ではない）

ワークスペース直下の `GSCキー_maint-vehicle-management-c8b4c314d878.json` はGCPサービスアカウント鍵で、
`project_id: "maint-vehicle-management"` を指す。これと一致する本番接続設定が複数箇所で確認できた：

- Cloud SQLインスタンス接続名: `maint-vehicle-management:asia-northeast2:free-trial-first-project`
  （[DASHBOARD_FUNCTION_SPEC_AND_OPERATION_GUIDE.md](../DASHBOARD_FUNCTION_SPEC_AND_OPERATION_GUIDE.md)、
  [02_operation-management-app/.github/workflows/deploy-gcp-cloud-run.yml:71](../../../02_operation-management-app/.github/workflows/deploy-gcp-cloud-run.yml)、
  [03_Emergency-Assistance/.github/workflows/deploy-server.yml:82](../../../03_Emergency-Assistance/.github/workflows/deploy-server.yml)、
  [04_Machine Failure Analysis System/.github/workflows/deploy-server.yml:66](../../../04_Machine%20Failure%20Analysis%20System/.github/workflows/deploy-server.yml)）
- 本番DB名は少なくとも `common_db`（02の`DB_CONNECTION_URL`に明記）と `webappdb`（04の`DB_NAME`）の2種類が確認でき、**アプリごとに本番DB名が異なる**（要: 04が指す`webappdb`と、他アプリが指す`daitetsu_db`/`demo_db`等の関係を確認。同一DBの別名か、別実体かは未確認）。
- ローカル環境には `gcloud` CLIと `cloud-sql-proxy.exe` が導入済みであることを確認した（実行検証はしていない）。

## 04アプリの`webappdb`と他アプリDBの対応関係（調査済み）

[04_Machine Failure Analysis System/.env.development:69-75](../../../04_Machine%20Failure%20Analysis%20System/.env.development)、
[server/.env.production.example:28-36](../../../04_Machine%20Failure%20Analysis%20System/server/.env.production.example)、
[server/src/config/database.ts:26](../../../04_Machine%20Failure%20Analysis%20System/server/src/config/database.ts)、
[server/src/config/commonDatabase.ts:13-31](../../../04_Machine%20Failure%20Analysis%20System/server/src/config/commonDatabase.ts) より：

- 04アプリは **2本のDB接続を独立に持つ**：`COMMON_DB_*`（`common_db`、他アプリと同じ制御プレーン）と、
  `DB_*`（`webappdb`、04アプリ専用の業務データDB）。
- `webappdb`は00/02/03が使う`daitetsu_db`/`demo_db`等の**テナント別DBとは別物**であり、04アプリが単独で持つ非マルチテナントのDB（またはテナント分離をアプリ内部の列で行うDB）と判断できる。
- 本番デプロイ設定（[.github/workflows/deploy-server.yml:63](../../../04_Machine%20Failure%20Analysis%20System/.github/workflows/deploy-server.yml)）では
  `DB_HOST=/cloudsql/maint-vehicle-management:asia-northeast2:free-trial-first-project` かつ `DB_NAME=webappdb` であり、
  **本番では`webappdb`も`common_db`と同じCloud SQLインスタンス内の別データベース**として運用されている。
- 一方、`.env.development`のコメント（69行目）には `cloud-sql-proxy maint-vehicle-management:asia-northeast1:webappdb-instance` という**別リージョン・別インスタンス名**の記述が残っており、過去に別インスタンスを使っていた可能性がある（現在の本番構成とは不一致。使われていない古い記述と推測されるが未確認）。

## 本番アクセスの試行結果（承認済み・実施済み・未接続で終了）

ユーザー承認のもと、既存の `GSCキー_maint-vehicle-management-c8b4c314d878.json` で
`gcloud auth activate-service-account` を実行したところ、
`github-actions-deployer@maint-vehicle-management.iam.gserviceaccount.com` として認証された。
しかし、このサービスアカウントには **Cloud SQL Admin API への権限がない**ことを確認した：

- `gcloud sql instances list` → "does not have permission to access projects instance" で失敗
- `gcloud sql instances describe free-trial-first-project` → "There was no instance found ... or you are not authorized" で失敗
- `gcloud projects get-iam-policy` → 権限不足で失敗（自身のIAMロール一覧も取得不可）

**結論**: この鍵はCI/CDのCloud Runデプロイ専用に絞られたサービスアカウントであり、
Cloud SQLへの読み取り専用接続（`cloud-sql-proxy`経由）には使用できない。
2回の失敗時点でこれ以上の試行（総当たり的なインスタンス名探索等）は行わず、停止した。
認証情報はローカルの`gcloud`設定から`gcloud auth revoke`で解除済み（鍵ファイル自体は変更していない）。

**次に必要な対応（ユーザー判断待ち）**:
1. このサービスアカウントに `roles/cloudsql.client` と `roles/cloudsql.viewer`（またはIAM DB認証用のCloud SQLユーザー）を付与する、または
2. 読み取り専用権限を持つ別の認証情報（鍵ファイルやIAM DB認証用ユーザー）を用意する、または
3. [02_DB_DIFF_LOCAL_VS_PRODUCTION.md](./02_DB_DIFF_LOCAL_VS_PRODUCTION.md) の調査SQLを、本番へアクセスできる運用者に実行してもらい、結果を共有してもらう。

## 未確認・要判断事項（クラリファイいただきたい点は別途質問する）

1. 本番Cloud SQLへの読み取り専用接続を、既存の `GSCキー_maint-vehicle-management-c8b4c314d878.json` と
   `cloud-sql-proxy.exe` を使って実際に確立してよいか（実施前に承認が必要と判断し、まだ接続していない）。
2. 04アプリの本番DB名 `webappdb` が他アプリの `daitetsu_db` 等とどう対応するのか。
3. デモ4ユーザー（demo00, niina, demo01, demo02）のパスワード実値。
4. 既存の `niina`（daitetsu_db・common_db・kosei_dbに別IDで存在）と、デモテナントで新規/更新対象とする `niina` が同一人物か別人物か。
