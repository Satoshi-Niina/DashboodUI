# common_user_id 移行 実装仕様（確定版・未実行）

本ドキュメント一式は **仕様の確定のみ** を目的とする。DB変更・アプリ変更は一切実行していない。
対象は「各テナントDB (`daitetsu_db` / `demo_db` / `kintetsu_db` / `kosei_db` 等) の `public.users`」に、
`common_db.public.users.id` を指す `common_user_id` 列を追加し、突合済みの行だけを移行する作業。

前回までのレビューで確認済みの区分定義（変更なし）：

| 区分 | 定義 | 本移行での扱い |
|---|---|---|
| A | テナントDB `users.id` と `common_db.users.id` が完全一致し、かつ `username` も一致し、所属先（テナント）にも矛盾がない行 | 移行対象（対応表への記載必須、無条件の自動書込みはしない） |
| B | `username` は一致するが `id` は不一致で、運用者が個別に「テナントDB名・ローカル`user_id`・`common_user_id`」の組を確認・承認した行 | 承認済みの組のみ移行対象 |
| C | 同一 `username` が複数DBに異なる `id` で存在する等、同名別人の疑いがある行 | 対象外。書き込まない。人手確認待ちとして記録するのみ |
| D | `common_db` 側に対応する `username` が存在しない、または対応するテナントDB自体にユーザーが存在しない行 | 対象外。書き込まない |

## 確定した実装方針（今回のレビュー反映）

1. **ログイン時の自動紐付けは廃止**。`common_user_id` の書き込みは、本ドキュメント一式のバッチ移行手順（[05_stage2_apply.sql](./05_stage2_apply.sql)）のみで行う。ログイン処理（[02_operation-management-app/server/src/auth.mjs](../../../02_operation-management-app/server/src/auth.mjs)、[03_Emergency-Assistance/server/src/services/tenant-auth.mjs](../../../03_Emergency-Assistance/server/src/services/tenant-auth.mjs) 等）は本移行が完了するまで変更しない。
2. **区分A・区分Bのみを移行対象とし、区分C・区分Dは書き込まない。** 区分Aであっても「対応表（[01_approval_table_template.md](./01_approval_table_template.md)）に記載され運用者が確認した行」だけを対象とする（無人の自動UPDATEは行わない）。
3. **本番DBはローカルとは別に、読み取り専用で突合し直す。** ローカルで得られた件数（区分A=1件、区分B=3件等）は本番の期待件数として流用しない。本番専用の対応表・期待件数は [02_production_readonly_survey.sql](./02_production_readonly_survey.sql) の実行結果から都度作成する。
4. **移行は3段階に分割する。**
   - Stage 1: 列追加のみ（[03_stage1_up.sql](./03_stage1_up.sql)）
   - Stage 2: データ移行（[04_stage2_precheck.sql](./04_stage2_precheck.sql) → [05_stage2_apply.sql](./05_stage2_apply.sql) → [06_stage2_postcheck.sql](./06_stage2_postcheck.sql)）
   - Stage 3: アプリの参照切替（[07_stage3_release_notes.md](./07_stage3_release_notes.md)）
   各段階は独立したマイグレーション／リリースとして扱い、段階間で最低1回の観測期間を置く。詳細は [08_RELEASE_PROCEDURE.md](./08_RELEASE_PROCEDURE.md) を参照。
5. **ログイン・権限の現状不備（kintetsu_dbのusers 0件、demoのrole扱い、03アプリのrole正規化未実施、04アプリがテナントDBのusersを認証に使っていない点）は、本移行と切り離した別課題として [09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md](./09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md) に記録する。** 各テナントの利用予定（当該テナントが実際に運用されるか、当該アプリを使うか）を運用者に確認するまで、これらの現状を「正常仕様」とは断定しない。

## 成果物一覧（本タスクの納品物）

| 成果物 | ファイル |
|---|---|
| 承認用対応表の様式 | [01_approval_table_template.md](./01_approval_table_template.md) |
| 本番専用の読み取り専用突合SQL | [02_production_readonly_survey.sql](./02_production_readonly_survey.sql) |
| 移行SQL案（Stage1: 列追加） | [03_stage1_up.sql](./03_stage1_up.sql) / [03_stage1_down.sql](./03_stage1_down.sql) |
| 検証SQL案（Stage1） | [03_stage1_precheck.sql](./03_stage1_precheck.sql) / [03_stage1_postcheck.sql](./03_stage1_postcheck.sql) |
| 移行SQL案（Stage2: データ移行、事前表示付き） | [04_stage2_precheck.sql](./04_stage2_precheck.sql) / [05_stage2_apply.sql](./05_stage2_apply.sql) |
| 検証SQL案（Stage2） | [06_stage2_postcheck.sql](./06_stage2_postcheck.sql) / [06_stage2_rollback.sql](./06_stage2_rollback.sql) |
| リリース手順書（Stage3含む） | [07_stage3_release_notes.md](./07_stage3_release_notes.md) / [08_RELEASE_PROCEDURE.md](./08_RELEASE_PROCEDURE.md) |
| 移行と別枠の課題表 | [09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md](./09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md) |

## 未確認事項（今回の仕様確定時点でも未確認のまま）

- 本番DBの接続方法・スキーマ・マイグレーション履歴は未確認。[02_production_readonly_survey.sql](./02_production_readonly_survey.sql) を運用者が本番で実行するまで、本番の区分別件数は一切確定しない。
- kintetsu_db・demoテナントの実際の利用予定（今後運用するか、しないか）は未確認。
- 03アプリ・04アプリの認証/権限判定の全経路は前回レビューの範囲でのみ確認済みであり、本ドキュメントでは追加調査していない。
