# ========================================
# ゲートウェイ方式実装ガイド
# DashboodUI独自のゲートウェイ方式によるDB接続
# ========================================

## 概要

Emergency-Assistantのゲートウェイ方式を参考に、DashboodUIに独自のゲートウェイ機能を実装しました。これにより、テーブルの物理配置を論理名で抽象化し、柔軟なDB管理が可能になります。

## 実装内容

### 1. ゲートウェイ機能（server.js）

以下の関数を追加しました：

- **resolveTablePath(logicalName)** - 論理テーブル名から物理パスを解決
- **dynamicSelect(logicalTableName, conditions, columns, limit)** - 動的SELECT
- **dynamicInsert(logicalTableName, data, returning)** - 動的INSERT
- **dynamicUpdate(logicalTableName, data, conditions, returning)** - 動的UPDATE
- **dynamicDelete(logicalTableName, conditions, returning)** - 動的DELETE
- **clearRoutingCache(logicalName)** - キャッシュクリア

### 2. 主な特徴

#### キャッシュ機構
- **TTL**: 5分間
- **キーフォーマット**: `{appId}:{logicalName}`
- パフォーマンス向上のため、ルーティング情報をメモリキャッシュ

#### フォールバック機能
- ルーティングが見つからない場合、自動的に`master_data`スキーマにフォールバック
- 段階的な移行が可能

#### エラーハンドリング
- DB接続エラー時も安全にフォールバック
- 詳細なログ出力で問題追跡が容易

## 環境設定

### 1. APP_IDの設定

`.env`ファイルに以下を追加：

```bash
APP_ID=dashboard-ui
```

このAPP_IDは`public.app_resource_routing`テーブルで使用されます。

### 2. 完全な.env設定例

```bash
# アプリケーション設定
APP_ID=dashboard-ui
NODE_ENV=development
PORT=3000

# JWT認証
JWT_SECRET=your-secret-key-here

# CORS設定
CORS_ORIGIN=*

# データベース接続（ローカル開発環境）
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password-here
DB_NAME=webappdb

# または接続文字列を使用
# DATABASE_URL=postgresql://user:password@localhost:5432/webappdb

# 本番環境（Cloud SQL）の場合
# NODE_ENV=production
# CLOUD_SQL_INSTANCE=your-project:region:instance-name
# DB_USER=your-db-user
# DB_PASSWORD=your-db-password
# DB_NAME=webappdb
```

## セットアップ手順

### Step 1: マイグレーション実行

まず、テーブル構造を修正します：

```bash
psql -h localhost -U postgres -d webappdb -f migration-fix-tables.sql
```

### Step 2: ゲートウェイルーティング設定

app_resource_routingテーブルにルーティング情報を投入：

```bash
psql -h localhost -U postgres -d webappdb -f setup-gateway-routing.sql
```

このスクリプトは以下を行います：
- `public.app_resource_routing`テーブルの作成（存在しない場合）
- DashboodUI用のルーティング設定を投入
- 設定結果の確認

### Step 3: テストデータ投入（オプション）

動作確認用のサンプルデータを投入：

```bash
psql -h localhost -U postgres -d webappdb -f insert-test-data.sql
```

### Step 4: サーバー起動

```bash
npm install
npm start
```

## ログ出力例

### 起動時

```
🚀 Starting server...
✅ Pool created successfully
🔍 Testing database connection...
✅ Database connected successfully at: 2026-01-03T...
[Gateway] Resolved: users → master_data."users"
Server is running on http://localhost:3000
```

### ログイン時

```
[Login] Attempting login for username: admin
[Gateway] Cache hit: users → master_data."users"
[DynamicDB] SELECT from master_data."users"
[Login] Query result: User found
```

### キャッシュミス時

```
[Gateway] Resolved: managements_offices → master_data."managements_offices"
[DynamicDB] SELECT from master_data."managements_offices"
```

### フォールバック時

```
[Gateway] No route found for some_table, falling back to master_data.some_table
```

## 移行済みAPI

### ✅ 完全移行済み

1. **認証系API**
   - `/api/login` - ログイン
   - `/api/verify-token` - トークン検証

2. **ユーザー管理API**
   - `GET /api/users` - ユーザー一覧
   - `GET /api/users/:id` - ユーザー詳細
   - `POST /api/users` - ユーザー追加
   - `PUT /api/users/:id` - ユーザー更新
   - `DELETE /api/users/:id` - ユーザー削除

3. **マスタ管理API（一部）**
   - `GET /api/offices` - 事業所一覧
   - `DELETE /api/vehicles/:id` - 保守用車削除

### 🔄 今後の移行対象

以下のAPIは従来の直接クエリを使用しています：

1. **優先度: 高**
   - offices（追加・更新）
   - bases（全CRUD）
   - vehicles（追加・更新・一覧）
   - machine_types（全CRUD）
   - machines（全CRUD）

2. **優先度: 中**
   - app_config（設定管理）
   - app_config_history（履歴）

## ルーティングテーブル管理

### ルーティング情報の確認

```sql
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as full_path,
    is_active,
    notes
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui' AND is_active = true
ORDER BY logical_resource_name;
```

### 新しいテーブルのルーティング追加

```sql
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table, notes)
VALUES 
  ('dashboard-ui', 'new_table', 'master_data', 'new_table', '新しいテーブルの説明')
ON CONFLICT (app_id, logical_resource_name) 
DO UPDATE SET 
  physical_schema = EXCLUDED.physical_schema,
  physical_table = EXCLUDED.physical_table,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
```

### ルーティングの無効化（削除せずに無効化）

```sql
UPDATE public.app_resource_routing
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'old_table';
```

### キャッシュのクリア

サーバー側でキャッシュをクリアする必要がある場合：

```javascript
// 特定のテーブルのキャッシュをクリア
clearRoutingCache('users');

// 全キャッシュをクリア
clearRoutingCache();
```

または、サーバーを再起動すれば全キャッシュがクリアされます。

## トラブルシューティング

### Q: "No route found" 警告が出る

**A**: `public.app_resource_routing`テーブルを確認：

```sql
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'テーブル名';
```

エントリがない場合は追加してください。

### Q: 古いスキーマ名でアクセスされる

**A**: キャッシュが残っている可能性があります。サーバーを再起動してください。

### Q: パフォーマンスが遅い

**A**: 以下を確認：
1. キャッシュが有効か（5分以内なら2回目以降はキャッシュヒット）
2. `app_resource_routing`テーブルにインデックスが作成されているか
3. ログで`[Gateway] Cache hit:`が表示されているか

### Q: スキーマ移行したい

**A**: ルーティングテーブルを更新するだけです：

```sql
-- 例: usersテーブルをpublicスキーマに移行
UPDATE public.app_resource_routing
SET physical_schema = 'public', 
    updated_at = CURRENT_TIMESTAMP,
    notes = 'publicスキーマに移行'
WHERE app_id = 'dashboard-ui' AND logical_resource_name = 'users';
```

サーバーを再起動するか、キャッシュTTL（5分）経過後に新しいルーティングが適用されます。

## パフォーマンス

### ベンチマーク（推定）

- **初回解決**: +5-10ms（DB往復でルーティング取得）
- **キャッシュヒット**: +0.1ms未満（メモリ参照のみ）
- **フォールバック**: +0ms（キャッシュされた結果を使用）

### 最適化のポイント

1. **キャッシュ期間**: デフォルト5分。頻繁に変更する場合は短縮、安定している場合は延長可能
2. **インデックス**: `app_resource_routing`テーブルの検索インデックスが重要
3. **フォールバック**: ルーティング設定を正しく行えばフォールバックは不要

## 今後の拡張

### 複数アプリケーション対応

このゲートウェイ方式は、他のアプリケーション（emergency、planning、equipment、failure）でも使用できます：

```javascript
// 各アプリのAPP_IDを設定
const APP_ID = process.env.APP_ID || 'emergency-assistance'; // または 'planning', 'equipment' など
```

### スキーマ権限管理

特定のアプリに特定のスキーマへのアクセスのみ許可する場合：

```sql
-- dashboard-uiはmaster_dataとpublicのみ
-- emergency-assistanceはemergencyスキーマも使用可能
INSERT INTO public.app_resource_routing 
  (app_id, logical_resource_name, physical_schema, physical_table)
VALUES 
  ('emergency-assistance', 'emergency_cases', 'emergency', 'cases');
```

### 動的権限チェック

将来的には、ルーティングテーブルに権限情報を追加し、ロールベースのアクセス制御も可能：

```sql
ALTER TABLE public.app_resource_routing 
ADD COLUMN required_role VARCHAR(20);

-- 管理者のみアクセス可能なテーブル
UPDATE public.app_resource_routing
SET required_role = 'admin'
WHERE logical_resource_name IN ('users', 'app_config');
```

## 参考資料

- [Emergency-Assistance DB_GATEWAY_MIGRATION_STATUS.md](../Emergency-Assistance-google/docs/DB_GATEWAY_MIGRATION_STATUS.md) - 参考にしたゲートウェイ方式の実装報告
- [migration-fix-tables.sql](migration-fix-tables.sql) - テーブル構造修正スクリプト
- [setup-gateway-routing.sql](setup-gateway-routing.sql) - ルーティング設定スクリプト
- [insert-test-data.sql](insert-test-data.sql) - テストデータ投入スクリプト

## まとめ

### ✅ 実装完了

- ゲートウェイ機能の実装（resolveTablePath、dynamicSelect/Insert/Update/Delete）
- 認証系APIの移行
- ユーザー管理APIの移行
- 一部マスタ管理APIの移行
- キャッシュ機構の実装
- フォールバック機能の実装

### 🎯 期待される効果

- **保守性向上**: テーブルの物理配置変更がコードに影響しない
- **柔軟性**: スキーマ移行が容易（ルーティングテーブルのみ更新）
- **セキュリティ**: スキーマ名のハードコードを排除
- **運用性**: 論理名ベースでアクセス制御が可能
- **パフォーマンス**: キャッシュにより高速なルーティング解決

### 📋 今後の課題

- 残りのAPI（offices、bases、vehiclesのCRUD）の段階的移行
- 複雑なJOINクエリのゲートウェイ対応
- パフォーマンス監視とチューニング
- 本番環境での長期運用検証

---

**実装日**: 2026年1月3日  
**バージョン**: 1.0.0  
**ステータス**: Phase 1完了、Phase 2移行中
