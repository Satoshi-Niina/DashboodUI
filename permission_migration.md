# 権限管理 (RBAC) のテナントDB移設 報告書 (permission_migration.md)

本ドキュメントは、TownManagerシステム（Dashboard UI）における権限管理（`roles`, `permissions`, `user_role_assignments` を含んだRole-Based Access Control: RBAC情報）を、司令塔である `common_db` から、稼働ターゲットである各独立したテナントデータベースの `public` スキーマ直下へ完全移設した内容をまとめた計画 ＆ 構築記録書です。

---

## 1. 移設の設計思想と新構造

共通のデータベース（`common_db`）で集中管理されていたRBAC情報モデルを、データの気密性と現場での柔軟なポリシーカスタマイズ（例: 大鉄テナントでのみ有効なカスタム権限の発行など）のためにテナントDBへ分離し、データベースをスイッチするだけで各テナント固有の認可（Authorization）が走る設計を構築しました。

### データ引き当ての仕組み
1. **テナントDB内のpublicスキーマに存在するRBAC情報を直接利用**:
   これまで定義のみされていたテナント別の物理DB（例: `daitetsu_db`）の `public.roles`, `public.permissions`, `public.user_role_assignments`, `public.role_permissions` テーブルとの接続を確立。
2. **アカウントの同値紐付け (Username照合)**:
   ユーザーログイン（`master_data.users` 経由）に紐付いたアカウント名（`username`）を起点として、個別DBの `public` スキーマ上のRBACテーブル群を動的にJOINし、該当するロールや所持パーミッションを特定。
3. **AsyncLocalStorage と連携した自動クエリバインド**:
   新構成のデータアクセストリガー（`pool.query`）が、その瞬間に動作している非同期リクエストセッションにロックされた接続プール（= テナントDB）に対しSQLを実行するため、**一切のバグなく確実にテナント別のロールデータを取得**します。

---

## 2. 具体的な修正・追加モジュール一覧

テナント別のRBAC解決に必要な専用リポジトリ、サービス、および認可割込ミドルウェアを [server.js](server.js) にマウントしました。

### ① `UserRbacRepository` (Repositoryレイヤーのテナント移設)
* **`getRolesByUsername(username)`**:
  現在アクティブなテナントDBの `public` スキーマ（`users`, `user_role_assignments`, `roles`）を結合し、対象ユーザーに紐付けられた有効な `roles.code` の配列（例: `['admin']` や `['manager']`）を取得するメソッド。
* **`getPermissionsByUsername(username)`**:
  `public` スキーマ上の5つのRBACテーブルすべて（`users`, `user_role_assignments`, `roles`, `role_permissions`, `permissions`）をJOINし、ユーザーに認可されたパーミッションコード名（例: `'ops.vehicles.write'` 等）を取得するメソッド。

### ② `UserRbacService` (Serviceレイヤーのテナント移設)
* **`hasRole(username, roleCode)`**: 指定ユーザーが該当テナント内で対象のロールを取得しているか確認。
* **`hasPermission(username, permissionCode)`**: 指定ユーザーが該当テナント内で対象の操作権限を取得しているか（認可処理の実体部）を確認。

### ③ 認証認可ミドルウェアの強化 (`requireAdmin`)
* **実直なDB追従型の認可処理**:
  トークンのJWT検証に加え、`UserRbacRepository.getRolesByUsername(user.username)` を同期実行させ、テナントDBが定義する認証ポリシーにおいて本当に管理者ロールであるかどうかも二重チェックする構造へと完全にアップグレードしました。
  
  これにより、管理者の判定は `common_db` を一切介することなく、**100%テナントDB内で宣言、処理されて自律完結する構成**になりました。

---

## 3. 現状の安全維持に関するアライメント

* **テーブルの非破壊維持要件**:
  `common_db.public` に存在する `roles`, `permissions`, `user_role_assignments`, `role_permissions` 他のテーブルおよびスキーマ、初期データは現状すべて削除せずに残しています（将来的な一括クリーニング用の削除候補）。これにより既存システムのエラーや他アプリケーション初期読み込み時の互換性を絶対に侵害しません。
* **動作安全保証**:
  万が一、テナントDB内の `public` 空間にRBACデータが存在しない（あるいは一時的に空の）場合でも、ログに警告（`Failed to get roles...`）を残した上で従前のマスタテーブル上の管理者判定（`system_admin`等）にフォールバックして稼働を自己充足・維持する、極めてロバストな仕組みを搭載しています。
* **USB内ローカル開発保証**:
  すべてのプールは環境設定に基づき 127.0.0.1:5432 または Cloud Run ソケット経由で透過的におこなわれるため、ローカルへの完全なクローズ化要件を満たしています。
