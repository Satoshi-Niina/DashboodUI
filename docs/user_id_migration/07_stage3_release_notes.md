# Stage 3: アプリ参照切替 リリースノート（設計のみ・未実装）

Stage3はスキーマ変更・データ移行を含まない。**アプリのログイン／権限判定コードが
`common_user_id` を参照するように切り替える** リリースであり、Stage2完了かつ
観測期間終了後にのみ着手する。

## 対象アプリ・箇所（前回レビューで確認済みの参照箇所）

| アプリ | 変更対象 | 現状の照合ロジック |
|---|---|---|
| 02_operation-management-app | [server/src/auth.mjs](../../../02_operation-management-app/server/src/auth.mjs) `findTenantMasterUser()`、呼び出し元 [server/src/legacyApplication.mjs](../../../02_operation-management-app/server/src/legacyApplication.mjs) | `id::text = $1 OR username = $2` のOR方式 |
| 03_Emergency-Assistance | [server/src/services/tenant-auth.mjs](../../../03_Emergency-Assistance/server/src/services/tenant-auth.mjs) | usernameのみで照合（idチェックなし） |
| 04_Machine Failure Analysis System | [server/src/services/tenantPoolManager.ts](../../../04_Machine%20Failure%20Analysis%20System/server/src/services/tenantPoolManager.ts) 系 | テナントDBのusersを認証に使っていない（要再確認） |
| 00_DashboodUI | [server.js](../../server.js)（Gen2: `user_tenants`, `user_roles`） | common_db側テーブルのみで完結、テナントDB usersは参照していない（現状のまま） |

## 切替方針（案・改訂）

1. 各アプリに `common_user_id` を優先照合させる。ただし **`common_user_id` がNULLの行を
   username一致だけで無条件通過させることはしない**（旧方針を撤回）。NULL行の扱いは
   下記「テナント単位のフォールバック方針」に従う。
2. フォールバックが発生した場合（common_user_id不使用でログインが成立した場合）は
   監視ログ（[07_stage3_monitoring.sql](./07_stage3_monitoring.sql) 参照）に必ず記録する。
3. 切替は機能フラグ（環境変数等）で個別テナント・個別アプリ単位にON/OFFできるようにし、
   一括切替はしない。
4. 03アプリのrole正規化、04アプリの所属判定の見直しは、本Stage3のスコープに **含めない**。これらは [09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md](./09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md) の別課題として扱う。

## テナント単位のフォールバック方針（NULL行＝未承認・未移行ユーザーの扱い）

`common_user_id` がNULLの既存ユーザーについて、以下3方針のいずれかをテナントごとに
事前に選定し、[08_RELEASE_PROCEDURE.md](./08_RELEASE_PROCEDURE.md) の承認欄で記録する。
**username一致のみによる無条件フォールバックは、いずれの方針でも採用しない。**

| 方針 | 適用条件 | 内容 | 既存利用者への影響 |
|---|---|---|---|
| **拒否**（deny） | 当該テナントで区分C（同名別人の疑い）が過去に1件でも検出されている場合。または[09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md](./09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md)に未解決の所属判定不備がある場合 | `common_user_id` がNULLのユーザーはログイン不可としてエラーを返す（誤って別人に紐付くリスクを排除するため、フォールバック自体を許可しない） | 対応表未収載（区分B未承認・区分D）のユーザーは、承認が完了するまでログインできなくなる。事前に対象ユーザー一覧を運用者へ通知し、承認を急ぐ運用とする |
| **限定フォールバック**（limited） | 区分Cの実績がなく、未対応行がすべて「対応表への収載待ち（承認プロセス中）」であると確認できているテナントに限る | `id` 完全一致でのみフォールバックを許可する（`username`のみでの照合は禁止）。フォールバック発生を都度ログへ記録し、[07_stage3_monitoring.sql](./07_stage3_monitoring.sql) で監視する | 対応表未収載でも `id` が一致する既存ユーザーはログイン継続可能。ID不一致の同名ユーザーはログイン不可 |
| **切替延期**（postpone） | 対象テナントの利用予定が[09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md](./09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md)で未確認の場合（kintetsu等）。または対応表のカバレッジ（有効ユーザーのうち`common_user_id`設定済みの割合）が閾値（案: 80%）未満の場合 | 当該テナントの機能フラグをOFFのまま維持し、Stage3自体を実施しない（既存ロジックを継続使用） | 影響なし（現状維持） |

## 監視指標の定義（ログイン失敗率とフォールバック率は別指標として扱う）

両者は原因が異なるため、同一指標として混在させない。ログはテナントDBの
`ops_audit.login_attempt_log`（[07_stage3_monitoring.sql](./07_stage3_monitoring.sql) で定義）に記録する。

| 指標 | 定義 | 意味 |
|---|---|---|
| **ログイン失敗率** | 失敗したログイン試行数 ÷ 総ログイン試行数（認証情報相違・アカウント無効化等、`common_user_id`の有無に関係なく発生する失敗を含む） | 認証そのものが成立しているかを表す指標。切替前後で悪化していないかを見る |
| **フォールバック率** | `common_user_id`不使用（id一致または旧ロジック）でログインが成立した試行数 ÷ ログインに成功した試行数 | 移行未完了データにどれだけ依存しているかを表す指標。ログイン成否とは独立に集計する |

フォールバック率が上昇してもログイン失敗率が悪化していない場合、これは「認証障害」ではなく
「対応表のカバレッジ不足」を示す。両指標を混同して単一の合否判定をしない。

## アプリによる記録処理（設計のみ・実装はStage3のアプリ変更で行う）

各アプリのログイン処理の判定結果確定後（成功・失敗が確定した直後）に、
対象テナントDBへ以下の1行を追加する。トランザクション本体（ログイン自体の処理）
とは別のベストエフォート書き込みとし、ログ記録の失敗でログイン自体を失敗させない。

```sql
INSERT INTO ops_audit.login_attempt_log (tenant_db, username, succeeded, auth_method)
VALUES ($1, $2, $3, $4);
-- $1: current_database() 相当（接続先テナントDB名）
-- $2: ログイン試行時に入力されたusername
-- $3: 認証成立ならtrue、失敗・拒否ならfalse
-- $4: 'common_user_id' | 'fallback_id' | 'fallback_username' | 'denied_no_mapping' | 'failed_credentials'
```

| アプリ | 記録を追加する箇所（案） |
|---|---|
| 02_operation-management-app | [server/src/auth.mjs](../../../02_operation-management-app/server/src/auth.mjs) `findTenantMasterUser()` の戻り値確定直後 |
| 03_Emergency-Assistance | [server/src/services/tenant-auth.mjs](../../../03_Emergency-Assistance/server/src/services/tenant-auth.mjs) の認証成立・失敗確定直後 |
| 04_Machine Failure Analysis System | 04アプリがテナントDBのusersを認証に使っていない現状を踏まえ、Stage3では対象外とし、[09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md](./09_ISSUE_TRACKER_LOGIN_PERMISSIONS.md) の課題解消後に改めて検討する |

## 中止条件（改訂）

- Stage2の [06_stage2_postcheck.sql](./06_stage2_postcheck.sql) でエラー行が0件であることが確認できていない場合、着手しない。
- 対象テナントの方針が「拒否」または「限定フォールバック」に確定していない場合、着手しない（方針未選定のテナントは自動的に「切替延期」として扱う）。
- カナリア対象テナントで、**ログイン失敗率**が切替前より悪化した場合、直ちに機能フラグをOFFに戻す（原因の種類を問わない）。
- カナリア対象テナントで、**フォールバック率**が想定（限定フォールバック方針採用テナントでは0%に近い値を想定）を上回り続ける場合、対応表のカバレッジ不足とみなし、機能フラグをOFFに戻した上で対応表の追加承認を先に進める。

## 復旧手順

- 機能フラグをOFFに戻すことで即時復旧する（コードのロールバックは不要な設計とする）。
- 機能フラグ自体の削除・恒久化は、全テナントで一定期間（案: 2週間）フォールバック発生がゼロであることを確認した後に、別リリースとして実施する。
