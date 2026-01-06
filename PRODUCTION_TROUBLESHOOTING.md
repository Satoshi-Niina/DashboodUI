# 本番環境トラブルシューティングガイド

## 修正内容サマリー

### なぜ本番だけ失敗していたか

1. **search_pathの未設定**
   - ローカル環境では PostgreSQL のデフォルト設定で `public` スキーマが優先
   - 本番環境（Cloud SQL）では search_path が明示的に設定されていない
   - `master_data` スキーマのテーブルへのアクセスが失敗

2. **エラーログの不足**
   - 実行されたSQL文の詳細が不明
   - ルーティング解決のプロセスが追跡できない
   - 環境変数の設定状態が確認できない

3. **デバッグ手段の不足**
   - ルーティングテーブルの状態確認方法がない
   - テーブル存在確認が手動SQLのみ
   - 環境変数の反映状態が不明

## 実施した修正

### 1. データベース接続の改善（shared-db-config.js）

✅ **search_path の自動設定**
```javascript
pool.on('connect', (client) => {
  client.query('SET search_path TO master_data, public', ...);
});
```
- すべての接続で `master_data` スキーマを優先
- 完全修飾名を使用しつつ、フォールバックを確保

✅ **接続情報の詳細ログ出力**
- 本番/ローカルの判定結果
- Cloud SQL インスタンスパス
- データベース名・ユーザー名

### 2. エラーログの強化（server.js）

✅ **環境変数の詳細表示**
```javascript
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('CLOUD_SQL_INSTANCE:', process.env.CLOUD_SQL_INSTANCE || 'NOT SET');
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
```

✅ **SQL実行エラーの詳細化**
- 実行されたクエリ全文
- パラメータ値
- 解決された物理パス（schema.table）
- PostgreSQLエラーコードと詳細

### 3. デバッグエンドポイントの追加

✅ **`GET /api/debug/routing`**
- `app_resource_routing` テーブルの全内容を表示
- キャッシュサイズも確認可能
- 認証不要（本番環境では注意）

✅ **`GET /api/debug/schema-check?table=xxx&schema=master_data`**
- テーブルの存在確認
- カラム情報の表示
- レコード数の確認

✅ **`GET /api/debug/env`（管理者のみ）**
- 環境変数の設定状態確認
- パスワードは非表示

### 4. 既存の完全修飾名実装の維持

- `resolveTablePath()` が返す `fullPath` は既に完全修飾形式
- 動的SQL生成関数は全て `fullPath` を使用
- 変更なし（既存実装が正しい）

## デプロイ後の確認手順

### ステップ1: 環境変数の確認

Cloud Runのログで以下が表示されることを確認：
```
🚀 Starting server...
Environment: production
CLOUD_SQL_INSTANCE: your-project:region:instance
DB Name: webappdb
DB User: your-user
DATABASE_URL set: false
```

### ステップ2: データベース接続の確認

ログに以下が表示されることを確認：
```
📊 Database Pool Configuration:
  - Environment: PRODUCTION
  - Connection: Cloud SQL Unix Socket
  - Socket Path: /cloudsql/your-project:region:instance
  - Database: webappdb
  - User: your-user
✅ search_path set to: master_data, public
✅ Database connected successfully at: 2026-01-06T...
```

### ステップ3: ルーティング確認

ブラウザまたはcurlで以下にアクセス：
```bash
curl https://your-app.run.app/api/debug/routing
```

期待される結果：
```json
{
  "success": true,
  "count": 6,
  "routing": [
    {
      "app_id": "dashboard-ui",
      "logical_resource_name": "users",
      "physical_schema": "master_data",
      "physical_table": "users",
      "is_active": true
    },
    ...
  ]
}
```

### ステップ4: 各テーブルの確認

```bash
curl "https://your-app.run.app/api/debug/schema-check?table=managements_offices"
curl "https://your-app.run.app/api/debug/schema-check?table=bases"
curl "https://your-app.run.app/api/debug/schema-check?table=vehicles"
```

すべて `"exists": true` が返ることを確認

### ステップ5: 実際の機能テスト

管理画面で以下をテスト：
1. ログイン
2. 事業所マスタの表示・登録
3. 保守基地マスタの表示・登録
4. 保守用車マスタの表示・登録

## エラー発生時の診断フロー

### エラー: "pq: relation does not exist"

**原因**
- テーブルが存在しない
- スキーマ名が間違っている
- search_path が設定されていない

**確認方法**
```bash
# 1. ルーティング確認
curl https://your-app.run.app/api/debug/routing

# 2. テーブル存在確認
curl "https://your-app.run.app/api/debug/schema-check?table=XXX"

# 3. Cloud Runログで search_path 設定を確認
# "✅ search_path set to: master_data, public" が表示されるか
```

**対処方法**
- ルーティングテーブルを再設定: `setup-dashboard-routing.sql` を実行
- テーブルが存在しない場合: `database-setup.sql` を実行

### エラー: "pq: column does not exist"

**原因**
- フロントエンドが送信するカラム名とDBのカラム名が不一致
- テーブルスキーマが古い

**確認方法**
```bash
# カラム一覧を確認
curl "https://your-app.run.app/api/debug/schema-check?table=XXX"
```

**対処方法**
- Cloud Runログで送信されたデータを確認
- テーブル定義を最新化

### エラー: "Cannot read property 'fullPath' of undefined"

**原因**
- `resolveTablePath()` が null を返している
- ルーティングテーブルにエントリがない

**確認方法**
```bash
curl https://your-app.run.app/api/debug/routing
```

**対処方法**
- `setup-dashboard-routing.sql` を実行
- キャッシュをクリア（サーバー再起動）

## 再発防止チェックリスト

### デプロイ前

- [ ] `.env` に本番環境変数が設定されているか（ローカルテスト用）
- [ ] GitHub Secrets に以下が設定されているか
  - `NODE_ENV=production`
  - `CLOUD_SQL_INSTANCE`
  - `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `JWT_SECRET`
- [ ] `app_resource_routing` テーブルに必要なルーティングが登録されているか
- [ ] `master_data` スキーマに必要なテーブルが存在するか

### デプロイ後（本番環境）

- [ ] Cloud Runログで環境変数が正しく設定されているか確認
- [ ] `✅ search_path set to: master_data, public` が表示されるか
- [ ] `✅ Database connected successfully` が表示されるか
- [ ] `/api/debug/routing` で6つのルーティングが表示されるか
- [ ] 管理画面で各マスタが正常に表示されるか

### コード変更時

- [ ] 新しいテーブルを追加した場合、`setup-dashboard-routing.sql` を更新したか
- [ ] 動的SQL生成時に `resolveTablePath()` を使用しているか
- [ ] エラー時に実行されたSQLをログ出力しているか
- [ ] 新しいAPIエンドポイントは `/api/` で始まるか

### トラブル発生時

- [ ] Cloud Runログを確認（直近30分）
- [ ] `/api/debug/routing` でルーティング状態を確認
- [ ] `/api/debug/schema-check` でテーブル存在を確認
- [ ] ローカル環境で再現するか確認
- [ ] `check-production-routing.sql` を本番DBで実行

## よくある質問

**Q: ローカルでは動くのに本番で動かない**

A: 以下を確認してください：
1. 環境変数が Cloud Run に正しく反映されているか
2. Cloud SQL への接続権限があるか（Cloud Run サービスアカウント）
3. ルーティングテーブルが本番DBに存在するか

**Q: デバッグエンドポイントは本番で公開しても大丈夫？**

A: 
- `/api/debug/routing` と `/api/debug/schema-check` は認証不要です
- 機密情報（パスワード等）は含まれませんが、テーブル構造が見えます
- 本番運用時は削除またはIP制限を推奨

**Q: search_path を設定すると何が変わる？**

A: 
- `SELECT * FROM users` が `master_data.users` を参照するようになります
- 完全修飾名（`master_data.users`）を使用すれば search_path は不要です
- 本修正では両方を併用（二重の安全策）

**Q: ルーティングキャッシュはいつクリアされる？**

A: 
- 5分間（300秒）で自動的に期限切れ
- サーバー再起動でクリア
- `clearRoutingCache()` 関数で手動クリア可能

## 関連ファイル

- `shared-db-config.js` - DB接続設定と search_path 設定
- `server.js` - ルーティング解決、動的SQL生成、デバッグエンドポイント
- `setup-dashboard-routing.sql` - ルーティングテーブル初期設定
- `check-production-routing.sql` - 本番環境診断スクリプト
- `db-gateway.js` - ルーティングゲートウェイモジュール（未使用）

## 緊急時の連絡先

- システム管理者: [連絡先を記入]
- データベース管理者: [連絡先を記入]
- GCPプロジェクト管理者: [連絡先を記入]
