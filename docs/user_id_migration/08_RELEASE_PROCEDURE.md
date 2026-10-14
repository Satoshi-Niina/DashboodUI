# common_user_id 移行 リリース手順書（未実行・承認確認用）

対象は各テナントDB（`daitetsu_db` / `demo_db` / `kintetsu_db` / `kosei_db` 等、本番は本番の実DB名）。
common_dbは変更しない（`common_user_id` の書き込み先は各テナントDBの `public.users`）。

3段階に分割し、各段階は独立したマイグレーション／デプロイとして扱う。段階間に最低1回の観測期間を置く。

---

## Stage 1: 列追加（スキーマ変更のみ）

| 項目 | 内容 |
|---|---|
| 事前確認SQL | [03_stage1_precheck.sql](./03_stage1_precheck.sql) |
| 適用SQL | [03_stage1_up.sql](./03_stage1_up.sql) |
| 適用後確認SQL | [03_stage1_postcheck.sql](./03_stage1_postcheck.sql) |
| 中止条件 | 事前確認で `common_user_id` 列が既に存在する（想定外の先行適用の疑い）。対象テナントDBへの接続情報・権限が確認できない。 |
| 復旧手順 | [03_stage1_down.sql](./03_stage1_down.sql) を実行し列を削除する（データ未投入のため安全）。 |
| 合格条件 | 適用後確認SQLで、列が存在し全行NULL、行数が事前確認時と一致すること。 |

## Stage 2: データ移行（承認済み対応表からの反映）

事前準備として、[01_approval_table_template.md](./01_approval_table_template.md) の様式で対応表を作成し、
`ops_audit.user_link_approved_mapping` へインポートしておく。ローカル環境と本番環境で対応表は別物（本番は
[02_production_readonly_survey.sql](./02_production_readonly_survey.sql) の結果に基づき別途作成）。

| 項目 | 内容 |
|---|---|
| 事前確認SQL（更新対象の事前表示・エラー検知） | [04_stage2_precheck.sql](./04_stage2_precheck.sql)（目視確認用。安全性の担保はこれ単独に依存しない） |
| 適用SQL（冪等・トランザクション内で再検査・並行更新対策） | [05_stage2_apply.sql](./05_stage2_apply.sql)。**必ず `psql -v ON_ERROR_STOP=1 -f 05_stage2_apply.sql` で実行する。** REPEATABLE READで開始し対象users行・対応表行を明示的にロックしたうえで、tenant_db不一致・対応表の欠損矛盾・既存値競合・common_user_id重複のいずれかが1件でもあれば、適用直前の再検査で例外を送出し、トランザクション全体が中断状態となって最終行のCOMMITはPostgreSQLの仕様によりROLLBACKとして扱われる。他セッションが対象行を並行更新・コミット済みの場合はロック取得によりその最新値が以後の検査に反映され、既存値競合として検知・中止する（進行中の並行トランザクションと衝突した場合は待機後、40001エラーになることもある）。手動での「目視してから止める」操作は不要かつ想定しない。実行結果に1行でも `ERROR` が出た場合、その回の適用は全件未反映である |
| 適用後確認SQL | [06_stage2_postcheck.sql](./06_stage2_postcheck.sql)。04の事前確認A節を実SQLとして再実行する節を含む |
| 中止条件 | 04の事前確認、05適用直前の再検査、または並行更新の検知（既存値競合または40001）でエラーが1件でも検出された場合（適用SQLが自動的に全件中止する）。 |
| 復旧手順 | [06_stage2_rollback.sql](./06_stage2_rollback.sql) を、05実行時に記録・保管した `batch_id` を指定して実行する（`psql -v batch_id='<UUID>' -v ON_ERROR_STOP=1 -f 06_stage2_rollback.sql`）。対象batch_idの全行を「復旧可能／復旧済み／変更済み／復旧不能」に分類して事前表示し、「変更済み」「復旧不能」（想定外の行）が1件でもあれば部分ロールバックせず全件中止する。実際にUPDATEした行だけをRETURNINGで取得し、今回の実行1回につき1つの`rollback_batch_id`で監査記録する（復旧済み行は再記録しない）。対応表(mapping)の現在の内容には依存しない |
| 合格条件 | 適用後確認SQLで、(1) 対応表と実テーブルの値に差分が0件、(2) 04の事前確認A節相当のSQLを再実行して0件、(3) 監視ログとテーブルの反映が一致、(4) 再実行しても更新0件（＝冪等性が成立）であること。 |

## Stage 3: アプリの参照切替

Stage3着手前に、対象テナントごとに [07_stage3_release_notes.md](./07_stage3_release_notes.md) の
「拒否／限定フォールバック／切替延期」のいずれかを選定し、下表に記録する。
未選定のテナントは自動的に「切替延期」として扱う。**username一致のみによる無条件フォールバックは採用しない。**

| テナント | 選定方針 | 選定理由 | 選定日 | 承認者 |
|---|---|---|---|---|
| daitetsu | | | | |
| demo | | | | |
| kintetsu | | | | |
| kosei | | | | |

| 項目 | 内容 |
|---|---|
| 事前確認 | Stage2の合格条件（上記）を満たしていること。全対象テナントの方針が選定済みであること。対象テナントの運用者へ切替時間帯の周知が完了していること。 |
| 適用 | [07_stage3_release_notes.md](./07_stage3_release_notes.md) の機能フラグ方式でテナント単位・段階的に有効化する。 |
| 適用後確認 | [07_stage3_monitoring.sql](./07_stage3_monitoring.sql) により「ログイン失敗率」と「フォールバック率」を別々に監視する。 |
| 中止条件 | カナリア対象でログイン失敗率が切替前より悪化した場合。または限定フォールバック方針のテナントでフォールバック率が想定を上回り続ける場合。 |
| 復旧手順 | 機能フラグをOFFに戻す（コードロールバック不要）。 |
| 合格条件 | 対象テナントで一定期間（案: 2週間）ログイン失敗率が悪化せず、限定フォールバック方針のテナントではフォールバック率が継続的に低下していること。 |

---

## 段階をまたぐ共通ルール

1. 各段階は個別にコミット・個別にデプロイする。3段階を1回のリリースにまとめない。
2. Stage2の適用前に、必ずローカル（または検証環境）で同一SQLを使ったリハーサルを行い、[04_stage2_precheck.sql](./04_stage2_precheck.sql) の出力が期待通りであることを確認する。
3. 本番での対応表・期待件数は、ローカルの件数（区分A=1件、区分B=3件等）を流用せず、[02_production_readonly_survey.sql](./02_production_readonly_survey.sql) の本番実行結果から都度作成する。
4. ログイン・権限に関する既存の不備（kintetsu_dbのusers0件、demoのrole扱い、03のrole正規化、04の所属判定）は、本手順の合否条件に含めない。[09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md](./09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md) で別途管理する。
5. すべての適用SQLは事前にバックアップ（`pg_dump` 等）を取得してから実行する。バックアップ取得手順は各アプリの既存運用（例: [02_operation-management-app/server/scripts/backup-local-databases.ps1](../../../02_operation-management-app/server/scripts/backup-local-databases.ps1)）に準ずる。
6. Stage2の適用SQL・ロールバックSQLは、必ず `psql -v ON_ERROR_STOP=1 -f <ファイル>` で実行する。実行結果の最終行が `COMMIT` と表示された場合のみ適用（またはロールバック）が成立している。1行でも `ERROR` が出力された場合、その回の操作は全件未反映であり、追加の手動ROLLBACK操作は不要（PostgreSQLの仕様上、中断状態のトランザクションに対するCOMMITは自動的にROLLBACKとして扱われる）。
7. Stage2適用SQL実行時に標準出力へ表示される `batch_id` は、実行者がその場でコピーし、本手順書の承認欄またはリリース記録に残す。ロールバックは必ずこの `batch_id` を指定して行い、対応表(mapping)の現在内容には依存しない。
8. Stage2の適用SQL・ロールバックSQLは、対象テナントDBに対して同時に1つのプロセスのみが実行する運用とする（REPEATABLE READ + 明示ロックにより、並行実行時は自動的に40001エラーで安全側に倒れるが、通常運用では並行実行自体を避ける）。40001エラーが発生した場合は、他の実行が完了してから最初から（04の事前確認から）やり直す。
9. ロールバック実行時に表示される `rollback_batch_id`（ロールバック操作自体のID）も記録する。同じ`batch_id`に対してロールバックを複数回実行しても、2回目以降は「復旧済み」と判定され追加の変更・追加のログ記録は発生しない（冪等）。

## 承認欄

| 段階 | 承認者 | 承認日 | 備考（batch_id / rollback_batch_id等） |
|---|---|---|---|
| Stage1 | | | |
| Stage2（対応表） | | | |
| Stage2（適用） | | | |
| Stage3 | | | |
