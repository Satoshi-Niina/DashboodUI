# ゲートウェイ方式実装完了 - 確認チェックリスト

## 実装完了日
2026年1月3日

## ✅ 実装完了項目

### 1. ゲートウェイ機能（server.js）
- [x] `resolveTablePath(logicalName)` - ルーティング解決
- [x] `dynamicSelect()` - 動的SELECT
- [x] `dynamicInsert()` - 動的INSERT
- [x] `dynamicUpdate()` - 動的UPDATE
- [x] `dynamicDelete()` - 動的DELETE
- [x] `clearRoutingCache()` - キャッシュクリア
- [x] 5分間キャッシュ機構
- [x] フォールバック機能（master_data優先）

### 2. 完全移行済みAPI

#### 認証系
- [x] `POST /api/login` - ログイン
- [x] `POST /api/verify-token` - トークン検証

#### ユーザー管理
- [x] `GET /api/users` - ユーザー一覧
- [x] `GET /api/users/:id` - ユーザー詳細
- [x] `POST /api/users` - ユーザー追加
- [x] `PUT /api/users/:id` - ユーザー更新
- [x] `DELETE /api/users/:id` - ユーザー削除

#### 事業所マスタ
- [x] `GET /api/offices` - 事業所一覧
- [ ] `POST /api/offices` - 事業所追加（未移行）
- [ ] `PUT /api/offices/:id` - 事業所更新（未移行）
- [ ] `DELETE /api/offices/:id` - 事業所削除（未移行）

#### 保守用車マスタ
- [x] `GET /api/vehicles` - 保守用車一覧
- [x] `GET /api/vehicles/:id` - 保守用車詳細
- [x] `POST /api/vehicles` - 保守用車追加
- [x] `PUT /api/vehicles/:id` - 保守用車更新
- [x] `DELETE /api/vehicles/:id` - 保守用車削除

#### 機種マスタ
- [x] `GET /api/machine-types` - 機種一覧
- [x] `POST /api/machine-types` - 機種追加

#### 機械番号マスタ
- [x] `GET /api/machines` - 機械番号一覧
- [x] `POST /api/machines` - 機械番号追加
- [x] `PUT /api/machines/:id` - 機械番号更新
- [x] `DELETE /api/machines/:id` - 機械番号削除

---

## 📋 デプロイ前チェックリスト

### Step 1: データベース設定

#### 1-1. テーブル構造の修正
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f migration-fix-tables.sql
```

**確認内容:**
- `master_data.managements_offices`に必要なカラムが追加されたか
  - postal_code, phone_number, manager_name, email
- `master_data.bases`に必要なカラムが追加されたか
  - manager_name, capacity
- `master_data.vehicles`に必要なカラムが追加されたか
  - model, registration_number, notes

#### 1-2. ゲートウェイルーティング設定
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f setup-gateway-routing.sql
```

**確認内容:**
```sql
-- ルーティングテーブルの確認
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui' AND is_active = true
ORDER BY logical_resource_name;
```

**期待される結果:**
```
logical_resource_name  | full_path                       | is_active
-----------------------+---------------------------------+-----------
app_config            | master_data.app_config          | t
app_config_history    | master_data.app_config_history  | t
bases                 | master_data.bases               | t
inspection_types      | master_data.inspection_types    | t
machine_types         | public.machine_types            | t
machines              | public.machines                 | t
managements_offices   | master_data.managements_offices | t
users                 | master_data.users               | t
vehicle_types         | master_data.vehicle_types       | t
vehicles              | master_data.vehicles            | t
```

#### 1-3. テストデータ投入（オプション）
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f insert-test-data.sql
```

### Step 2: 環境変数設定

`.env`ファイルを確認・更新:

```bash
# 必須: アプリケーションID
APP_ID=dashboard-ui

# JWT認証
JWT_SECRET=your-secret-key-here

# データベース接続
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=webappdb

# または接続文字列
# DATABASE_URL=postgresql://user:password@host:5432/webappdb

# 本番環境（Cloud SQL）
# NODE_ENV=production
# CLOUD_SQL_INSTANCE=your-project:region:instance-name
```

### Step 3: ローカルテスト

```bash
# 依存関係のインストール
npm install

# サーバー起動
npm start
```

**確認ポイント:**
1. サーバーが正常に起動する
2. 以下のログが表示される:
   ```
   [Gateway] Resolved: users → master_data."users"
   [Gateway] Resolved: machine_types → public."machine_types"
   [Gateway] Resolved: machines → public."machines"
   ```

### Step 4: UI動作確認

#### 4-1. ログイン確認
1. `http://localhost:3000` にアクセス
2. ログイン画面が表示される
3. 管理者アカウントでログイン
   - デフォルト: `admin` / `adminpass`
4. ダッシュボードが表示される

**コンソールログ確認:**
```
[Login] Attempting login for username: admin
[Gateway] Cache hit: users → master_data."users"
[DynamicDB] SELECT from master_data."users"
[Login] Query result: User found
```

#### 4-2. ユーザーマスタ確認
1. 「設定管理」メニューをクリック
2. 「ユーザー管理」タブを選択
3. ユーザー一覧が表示される

**コンソールログ確認:**
```
[Gateway] Resolved: users → master_data."users"
[DynamicDB] SELECT from master_data."users"
```

**確認項目:**
- [ ] ユーザー一覧が表示される
- [ ] 「新規ユーザー追加」ボタンが機能する
- [ ] ユーザーの編集・削除が可能

#### 4-3. 機種・機械番号マスタ確認
1. 「機種・機械番号マスタ」タブを選択
2. 機種マスタセクションが表示される
3. 機械番号マスタセクションが表示される

**コンソールログ確認:**
```
[Gateway] Resolved: machine_types → public."machine_types"
[DynamicDB] SELECT from public."machine_types"
[Gateway] Resolved: machines → public."machines"
[DynamicDB] SELECT from public."machines"
```

**確認項目:**
- [ ] 機種一覧が表示される
- [ ] 「新規機種追加」ボタンが機能する
- [ ] 機械番号一覧が表示される
- [ ] 機種情報（type_code, type_name）が機械番号に紐づいて表示される
- [ ] 「新規機械番号追加」ボタンが機能する

#### 4-4. 事業所マスタ確認
1. 「事業所マスタ」タブを選択
2. 事業所一覧が表示される

**コンソールログ確認:**
```
[Gateway] Resolved: managements_offices → master_data."managements_offices"
[DynamicDB] SELECT from master_data."managements_offices"
```

**確認項目:**
- [ ] 事業所一覧が表示される
- [ ] 事業所コード、事業所名、区分、住所が表示される
- [ ] 「新規事業所追加」ボタンが表示される

#### 4-5. 保守基地マスタ確認
1. 「保守基地マスタ」タブを選択
2. 保守基地一覧が表示される

**コンソールログ確認:**
```
[Gateway] Resolved: bases → master_data."bases"
[DynamicDB] SELECT from master_data."bases"
```

**確認項目:**
- [ ] 保守基地一覧が表示される
- [ ] 基地コード、基地名、所属事業所が表示される
- [ ] 「新規保守基地追加」ボタンが表示される

#### 4-6. 保守用車マスタ確認
1. 「保守用車マスタ」タブを選択
2. 保守用車一覧が表示される

**コンソールログ確認:**
```
[Gateway] Resolved: vehicles → master_data."vehicles"
[Gateway] Resolved: machines → public."machines"
[Gateway] Resolved: machine_types → public."machine_types"
[Gateway] Resolved: managements_offices → master_data."managements_offices"
[DynamicDB] SELECT from master_data."vehicles"
```

**確認項目:**
- [ ] 保守用車一覧が表示される
- [ ] 車両番号、機種、機械番号、管理事業所、車両登録番号が表示される
- [ ] 「新規車両追加」ボタンが機能する
- [ ] 車両の編集・削除が可能

---

## 🔍 トラブルシューティング

### エラー: "No route found for XXX"

**原因:** `app_resource_routing`テーブルにルーティング情報がない

**解決方法:**
```sql
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'XXX';
```

エントリがない場合は`setup-gateway-routing.sql`を実行。

### エラー: "relation does not exist"

**原因:** テーブルが存在しないか、スキーマ名が間違っている

**解決方法:**
```sql
-- テーブルの存在確認
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename IN ('users', 'vehicles', 'machines', 'machine_types', 'managements_offices', 'bases')
ORDER BY schemaname, tablename;
```

### エラー: "column does not exist"

**原因:** カラムが不足している

**解決方法:**
`migration-fix-tables.sql`を実行して、必要なカラムを追加。

### データが表示されない

**原因:** データが存在しない、またはJOINが正しくない

**解決方法:**
1. 各テーブルにデータが存在するか確認:
```sql
SELECT COUNT(*) FROM master_data.users;
SELECT COUNT(*) FROM master_data.vehicles;
SELECT COUNT(*) FROM public.machines;
SELECT COUNT(*) FROM public.machine_types;
```

2. テストデータを投入:
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d webappdb -f insert-test-data.sql
```

---

## 🎯 期待される動作

### デプロイ完了後

1. **ユーザーマスタ**
   - `master_data.users`テーブルからデータを取得
   - ゲートウェイ経由で`resolveTablePath('users')`が`master_data.users`を解決
   - 一覧表示、追加、編集、削除が正常に動作

2. **機種マスタ**
   - `public.machine_types`テーブルからデータを取得
   - ゲートウェイ経由で`resolveTablePath('machine_types')`が`public.machine_types`を解決
   - 機種コード、機種名、メーカー、カテゴリーが表示

3. **機械番号マスタ**
   - `public.machines`テーブルと`public.machine_types`をJOIN
   - ゲートウェイ経由で両テーブルのパスを解決
   - 機械番号と紐づく機種情報が表示

4. **保守用車マスタ**
   - `master_data.vehicles`、`public.machines`、`public.machine_types`、`master_data.managements_offices`をJOIN
   - ゲートウェイ経由で全テーブルのパスを解決
   - 車両情報、機種情報、事業所情報が統合表示

---

## 📊 パフォーマンス確認

### キャッシュ効果の確認

同じテーブルに2回アクセスした場合:

**1回目:**
```
[Gateway] Resolved: users → master_data."users"
```

**2回目（5分以内）:**
```
[Gateway] Cache hit: users → master_data."users"
```

キャッシュヒット時は、DBへのルーティング照会が不要なため高速。

---

## ✅ 最終確認チェックリスト

デプロイ前に以下を確認:

- [ ] `migration-fix-tables.sql`を実行済み
- [ ] `setup-gateway-routing.sql`を実行済み
- [ ] `.env`に`APP_ID=dashboard-ui`を設定済み
- [ ] ローカルでサーバーが起動する
- [ ] ログインできる
- [ ] ユーザー一覧が表示される
- [ ] 機種マスタが表示される
- [ ] 機械番号マスタが表示される
- [ ] 保守用車マスタが表示される
- [ ] ブラウザコンソールにエラーがない
- [ ] サーバーログに`[Gateway] Resolved:`が表示される

すべて✅なら、デプロイ準備完了です！

---

**作成日:** 2026年1月3日  
**バージョン:** 1.0.0  
**ステータス:** 実装完了、テスト準備完了
