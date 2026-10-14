# ログイン・権限まわりの現状不備 課題表（common_user_id移行とは別管理）

本表の項目は、common_user_id移行の合否判定には含めない。各テナントの利用予定
（当該テナント・当該アプリを実際に運用するか）を運用者に確認するまで、
現状の挙動を「正常仕様」と断定しない。

| # | 対象 | 現状の事実（確認済み） | 疑われる問題 | 対応方針（未確定） | 確認待ち事項 |
|---|---|---|---|---|---|
| 1 | kintetsu_db | `public.users` が0件（前回調査時点） | kintetsuテナントでログインできるユーザーが存在しない可能性 | 未定。kintetsuを実運用するかで対応要否が変わる | kintetsuテナントを今後運用する予定があるか、運用者に確認 |
| 2 | demo_db / demoテナント | roleの扱いが他テナントと異なる可能性（前回調査で詳細未確定） | RBAC判定がdemo特有の想定と食い違う可能性 | 未定 | demoテナントの位置づけ（検証専用か、実運用テナントか）を確認 |
| 3 | 03_Emergency-Assistance | ログイン照合が `username` のみで `id` 照合を行っていない（[tenant-auth.mjs](../../../03_Emergency-Assistance/server/src/services/tenant-auth.mjs)、前回調査） | roleの正規化が02アプリと揃っていない（前回レビューで指摘、詳細未再調査） | 未定。02アプリのrole正規化（[015_user_auth_normalization.sql](../../../02_operation-management-app/server/sql/015_user_auth_normalization.sql)）に合わせるかは要検討 | 03アプリが今後どのテナントで使われる想定かを確認してから是正要否を判断 |
| 4 | 04_Machine Failure Analysis System | テナントDBの `users` テーブル自体を認証に使っていない（前回調査、要再確認） | 所属判定（テナント／組織の紐付け）の実装がテナントDB usersに依存していない可能性 | 未定 | 04アプリの認証・所属判定の実装経路を再調査した上で、common_user_id移行と関係するか判断 |

## 運用ルール

- 上記項目はcommon_user_id移行のStage1〜3のいずれの合格条件にも使わない。
- 各項目は、対象テナントの利用予定が確認でき次第、個別の調査・改修タスクとして切り出す（本ドキュメントでは着手しない）。
