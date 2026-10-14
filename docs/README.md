# 資料一覧とファイル分類

現行手順の入口はリポジトリ直下の [README](../README.md) です。

## 現行資料

- [システム構成・現在の DB 構造](./CURRENT_DB_SCHEMA.md): scope ごとの表・キー・用途と DB 境界
- [マイグレーション方式・検証結果](./MIGRATION_REPORT.md): 新規／既存更新、baseline、検証状況
- [共通 DB アーキテクチャ](./COMMON_DB_ARCHITECTURE.md): 正規化案の設計背景。現行 route と区別して参照
- [認証アーキテクチャ](./AUTH_ARCHITECTURE.md): 認証コードと DB 前提
- [ダッシュボード機能・運用メモ](./DASHBOARD_FUNCTION_SPEC_AND_OPERATION_GUIDE.md): 機能・運用

## 過去資料と分類

| 区分 | 対象 | 根拠・扱い |
|---|---|---|
| 現役コード | `server.js`、`server/`、`assets/`、`views/` | `server.js` が起動入口、`server/` が backend module、`assets/` のみ静的公開 |
| 現行開発・DB処理 | `db/`、`scripts/`、`test/` | migrations／runner／workflow test。静的公開しない |
| 現行 DB 履歴 | `db/migrations/common/`、`db/migrations/tenant/` | checksum / verifier 付き migration runner の対象 |
| 旧・適用状態不明 | `docs/migrations/20260903_common_db_foundation_{up,down}.sql` | 適用履歴が不明なため変更・削除・標準実行せず保持 |
| 旧補助 SQL | `docs/local-dev-migration.sql` | 旧 routing table 向け。標準構築・更新では使用しない |
| 凍結した別移行案 | `docs/user_id_migration/` | 本作業の scope 外。承認と独立検証なしに実行しない |
| 調査記録 | `docs/env_unification/` | 手順ではなく環境差分調査として保持 |
| ルート必須ファイル | `package.json`、`package-lock.json`、`README.md`、`.env.example`、`Dockerfile`、`cloudbuild.yaml`、ignore／deploy 設定 | npm・Docker・Cloud Build・dotenv・CI が root 前提で読むため保持 |
| 用途確認できず保持 | `.version` | リポジトリ内の参照なし。cache-busting 用 marker と記載され外部 deployment tooling の参照を排除できないため保留 |
| 環境生成物 | `.env`、`.env.production`、`node_modules/`、DB dump/backup、一時検証 DB | ignore 対象。資格情報・利用者データを含む可能性があり削除しない |

DB 構造は migration SQL を基準とし、実環境の適用状態とは区別してください。詳しくは
[検証済み／未検証の一覧](./MIGRATION_REPORT.md#検証結果)を参照してください。
