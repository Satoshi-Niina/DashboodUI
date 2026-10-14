# 承認用対応表の様式（common_user_id 移行）

対応表は **テナントDBごと・環境ごと（ローカル／本番）** に作成する。ローカルの対応表を本番に流用しない。

## 1. 記入様式（CSV／スプレッドシート）

| 列名 | 型 | 必須 | 説明 |
|---|---|---|---|
| `tenant_db` | text | ○ | 対象テナントDB名（例: `daitetsu_db`, `demo_db`, `kintetsu_db`, `kosei_db`）。本番はDB名が異なる場合があるため、本番の実DB名をそのまま記載する |
| `tenant_user_id` | uuid | ○ | テナントDB `public.users.id`（ローカルのuser_id） |
| `tenant_username` | text | ○ | 突合時点の `username`（監査用の参考情報。移行キーとしては使わない） |
| `common_user_id` | uuid | ○ | 移行先となる `common_db.public.users.id` |
| `category` | text | ○ | `A_id_match`（区分A） または `B_operator_approved`（区分B）のいずれか。区分C・区分Dの行はこの対応表に含めない |
| `evidence` | text | ○ | 区分Aの場合は突合SQLの実行日時・結果ファイル名。区分Bの場合は承認根拠（例: 「本人確認済み、2026-09-28 運用者Xが所属先台帳と突合」） |
| `approved_by` | text | ○ | 承認した運用者名（区分Aも含め、対応表に載せる全行に承認者を記載する。無人の自動採用はしない） |
| `approved_at` | timestamptz | ○ | 承認日時 |
| `notes` | text | 任意 | 補足 |

### 記入ルール

- 区分C（同名別人の疑い）・区分D（対応先なし）の行は **この対応表に含めない**。含めた場合、後述の適用SQLは無条件でエラー扱いとし、書き込みを行わない。
- 同一 `tenant_db` 内で同じ `tenant_user_id` が複数行に現れてはならない（1ユーザー1行）。
- 同一 `tenant_db` 内で同じ `common_user_id` が複数行に現れてはならない（1つの共通IDに対し複数のローカルユーザーを紐付けない）。違反行は適用SQLがエラー報告し、更新しない。

## 2. 対応表を読み込むステージングテーブル（各テナントDBに作成、Stage2の一部）

対応表（CSV）は、各テナントDB内に作成する以下のステージングテーブルへ運用者がインポートしてから Stage2 を実行する。このテーブル自体はデータ移行の「入力」であり、既存の `users` テーブルには一切影響しない。

```sql
-- 各テナントDBで実行（Stage2の準備。列追加(Stage1)完了後に実施）
CREATE SCHEMA IF NOT EXISTS ops_audit;

CREATE TABLE IF NOT EXISTS ops_audit.user_link_approved_mapping (
  id               bigserial PRIMARY KEY,
  tenant_db        text        NOT NULL,
  tenant_user_id   uuid        NOT NULL,
  tenant_username  text        NOT NULL,
  common_user_id   uuid        NOT NULL,
  category         text        NOT NULL CHECK (category IN ('A_id_match', 'B_operator_approved')),
  evidence         text        NOT NULL,
  approved_by      text        NOT NULL,
  approved_at      timestamptz NOT NULL,
  notes            text,
  imported_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_db, tenant_user_id),
  UNIQUE (tenant_db, common_user_id)
);
```

`UNIQUE (tenant_db, tenant_user_id)` と `UNIQUE (tenant_db, common_user_id)` により、対応表自体に重複（1ユーザーに複数の紐付け候補、1共通IDに複数ユーザー）があれば **インポートの時点で** 弾かれる。それでも通過してしまうケース（大文字小文字違いの重複UUID等）は [04_stage2_precheck.sql](./04_stage2_precheck.sql) および [05_stage2_apply.sql](./05_stage2_apply.sql) 冒頭の再検査で再検出する。

## 2.1 適用結果を記録する監査ログテーブル（Stage2の一部、apply前に作成）

[05_stage2_apply.sql](./05_stage2_apply.sql) が実際に変更した行の「変更前値・変更後値・適用バッチID」を記録するテーブル。
ロールバック（[06_stage2_rollback.sql](./06_stage2_rollback.sql)）はこのログに記録された行だけを対象とする。

```sql
-- 各テナントDBで実行（Stage2の準備。ops_audit.user_link_approved_mapping と同時に作成）
CREATE TABLE IF NOT EXISTS ops_audit.user_link_migration_log (
  id                  bigserial PRIMARY KEY,
  batch_id            uuid        NOT NULL,
  tenant_db           text        NOT NULL,
  tenant_user_id      uuid        NOT NULL,
  old_common_user_id  uuid,
  new_common_user_id  uuid,        -- ロールバック時にNULLへ戻す場合があるためNOT NULLにしない
  applied_at          timestamptz NOT NULL DEFAULT now(),
  applied_by          text        NOT NULL,
  notes               text
);

CREATE INDEX IF NOT EXISTS idx_user_link_migration_log_batch
  ON ops_audit.user_link_migration_log (batch_id);
```

## 3. ローカルと本番の分離

- ローカル対応表：本レビューの過去調査（区分A=1件、区分B=3件）を記入したもの。**ローカル環境の検証・リハーサル専用**。
- 本番対応表：[02_production_readonly_survey.sql](./02_production_readonly_survey.sql) を本番で実行して得られた結果のみを根拠に、運用者が改めて区分A・区分Bを判定し作成する。ローカルの件数・対応表を本番にコピーしない。
