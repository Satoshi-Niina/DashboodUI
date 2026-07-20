# テナント別アプリ管理機能 - 実装ガイド

## 📋 概要

マルチテナント型Webアプリケーションにおいて、テナントごとに利用可能なアプリケーションを管理するデータベース構造を、従来の横持ち（カラム固定）から、柔軟な縦持ちテーブル（レコード追加型）へ移行しました。

## 🎯 主な特徴

1. **DBレコード追加だけでアプリ追加**: コード修正不要
2. **テナントごとの個別設定**: テナントごとに異なるアプリを表示可能
3. **アイコンの柔軟性**: 絵文字とBootstrap Icons両方をサポート
4. **下位互換性**: 既存のシステムに影響を与えない
5. **フォールバック機能**: APIエラー時も静的定義で動作

---

## 📊 テーブル構造

### `public.tenant_app_routings` テーブル

| カラム名 | データ型 | 説明 | 例 |
|---------|---------|------|-----|
| `id` | SERIAL | 主キー | 1 |
| `tenant_key` | VARCHAR(100) | テナント識別子 | 'demo', 'daitetsu' |
| `app_id` | VARCHAR(100) | アプリ識別子 | 'planning', 'equipment' |
| `app_name` | VARCHAR(255) | アプリ名（画面表示用） | '計画・運用管理' |
| `app_url` | TEXT | アプリのURL | 'https://app.example.com' |
| `display_order` | INTEGER | 表示順序 | 1, 2, 3... |
| `icon` | VARCHAR(50) | アイコン（絵文字） | '📅', '🚛' |
| `icon_class` | VARCHAR(100) | アイコンクラス名 | 'bi-calendar-check', 'bi-truck' |
| `description` | TEXT | アプリの説明 | '運用計画を管理します' |
| `is_active` | BOOLEAN | 有効フラグ | true / false |
| `created_at` | TIMESTAMP | 作成日時 | - |
| `updated_at` | TIMESTAMP | 更新日時 | - |

**制約**:
- `UNIQUE (tenant_key, app_id)`: 同一テナント内でアプリIDは一意

---

## 🚀 セットアップ手順

### 1. データベースのセットアップ

#### 新規テーブル作成の場合:
```bash
# common_db に接続
psql -h localhost -U postgres -d common_db

# テーブル作成とサンプルデータ投入
\i sql/create-tenant-app-routings.sql
```

#### 既存テーブルに icon_class カラムを追加する場合:
```bash
psql -h localhost -U postgres -d common_db
\i sql/alter-add-icon-class-column.sql
```

### 2. サーバーの再起動

```bash
# Node.jsサーバーを再起動
npm restart
# または
node server.js
```

### 3. 動作確認

1. ブラウザでダッシュボードにアクセス: `http://localhost:8080`
2. 開発者ツール（F12）でコンソールを開く
3. 以下のログを確認:
   ```
   [App] Loaded tenant apps: {success: true, tenant_key: "demo", apps: [...]}
   [App] Starting to generate app cards...
   ```

---

## 🔧 API仕様

### `GET /api/tenant-apps`

現在ログイン中のテナントに紐づくアプリ一覧を取得します。

#### リクエスト
- **メソッド**: GET
- **パラメータ**: なし（セッションまたはヘッダーからtenant_keyを自動取得）

#### レスポンス例
```json
{
  "success": true,
  "tenant_key": "demo",
  "apps": [
    {
      "id": "planning",
      "name": "計画・運用管理",
      "url": "https://railway-client-800711608362.asia-northeast2.run.app",
      "displayOrder": 1,
      "icon": "📅",
      "iconClass": "bi-calendar-check",
      "description": "保守用車の運用計画作成から運用の実績を管理できます。"
    },
    {
      "id": "equipment",
      "name": "保守用車管理",
      "url": "https://operation-management-client-800711608362.asia-northeast2.run.app",
      "displayOrder": 2,
      "icon": "🚛",
      "iconClass": "bi-truck",
      "description": "仕業点検簿の表示から実績を記録します。"
    }
  ]
}
```

#### エラーレスポンス
```json
{
  "success": false,
  "error": "エラーメッセージ",
  "apps": []
}
```

---

## 📝 運用方法

### 新しいアプリを追加する

```sql
-- 例: 'chat' アプリを demo テナントに追加
INSERT INTO public.tenant_app_routings 
(tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
VALUES
('demo', 'chat', 'チャットシステム', 'https://chat.example.com', 5, '💬', 'bi-chat-dots', 'リアルタイムチャット機能', true);
```

**→ ページをリロードすると、自動的に新しいアプリが表示されます！**

### アプリを非表示にする

```sql
-- アプリを無効化（削除せずに非表示）
UPDATE public.tenant_app_routings 
SET is_active = false 
WHERE tenant_key = 'demo' AND app_id = 'planning';
```

### 表示順序を変更する

```sql
-- display_order を変更
UPDATE public.tenant_app_routings 
SET display_order = 1 
WHERE tenant_key = 'demo' AND app_id = 'equipment';
```

### 特定のテナントだけに表示する

```sql
-- 'daitetsu' テナントには2つだけ表示
INSERT INTO public.tenant_app_routings 
(tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description)
VALUES
('daitetsu', 'equipment', '保守用車管理', 'https://...', 1, '🚛', 'bi-truck', '説明'),
('daitetsu', 'planning', '計画・運用管理', 'https://...', 2, '📅', 'bi-calendar-check', '説明');
```

---

## 🎨 アイコンの使用方法

### Bootstrap Iconsを使用する場合

```sql
UPDATE public.tenant_app_routings 
SET icon_class = 'bi-truck'  -- Bootstrap Iconsのクラス名
WHERE app_id = 'equipment';
```

**利用可能なアイコン**: [Bootstrap Icons 公式サイト](https://icons.getbootstrap.com/)

よく使うアイコン例:
- `bi-truck`: トラック
- `bi-calendar-check`: カレンダー（チェック付き）
- `bi-tools`: ツール
- `bi-exclamation-triangle`: 警告
- `bi-chat-dots`: チャット
- `bi-gear`: 設定
- `bi-person`: ユーザー

### 絵文字を使用する場合

```sql
UPDATE public.tenant_app_routings 
SET icon = '🚛'  -- 絵文字
WHERE app_id = 'equipment';
```

**優先順位**:
- `icon_class` が設定されている場合 → Bootstrap Iconsを表示
- `icon_class` がNULLの場合 → 絵文字を表示

---

## 🧪 テストシナリオ

### 1. 正常系テスト

#### テストケース1: アプリ一覧の取得
1. ブラウザでダッシュボードにアクセス
2. 開発者ツールのコンソールを確認
3. `[App] Loaded tenant apps:` のログを確認
4. アプリカードが表示されることを確認

#### テストケース2: アプリの起動
1. アプリカードをクリック
2. 吹き出しが表示されることを確認
3. 「アプリ起動」ボタンをクリック
4. 新しいタブでアプリが開くことを確認

#### テストケース3: 動的追加
1. SQLで新しいアプリを追加
2. ブラウザをリロード
3. 新しいアプリが表示されることを確認

### 2. 異常系テスト

#### テストケース4: APIエラー時のフォールバック
1. サーバーを停止
2. ブラウザをリロード
3. コンソールに `[App] Loading fallback apps` が表示される
4. デフォルトの4つのアプリが表示されることを確認

#### テストケース5: データが空の場合
1. SQLで全てのアプリを無効化
   ```sql
   UPDATE public.tenant_app_routings SET is_active = false WHERE tenant_key = 'demo';
   ```
2. ブラウザをリロード
3. フォールバックアプリが表示されることを確認

---

## 🔍 トラブルシューティング

### アプリが表示されない

**原因1**: テーブルが存在しない
```sql
-- テーブルの存在確認
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'tenant_app_routings'
);
```

**原因2**: データが登録されていない
```sql
-- データの確認
SELECT * FROM public.tenant_app_routings WHERE tenant_key = 'demo' AND is_active = true;
```

**原因3**: tenant_keyが一致していない
```sql
-- 登録されているテナント一覧を確認
SELECT DISTINCT tenant_key FROM public.tenant_app_routings;
```

### アイコンが表示されない

**原因1**: Bootstrap Iconsが読み込まれていない
- index.htmlに以下が含まれているか確認:
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  ```

**原因2**: icon_classのクラス名が間違っている
```sql
-- 正しいクラス名を確認（'bi-' プレフィックスが必要）
UPDATE public.tenant_app_routings 
SET icon_class = 'bi-truck'  -- ✅ 正しい
-- SET icon_class = 'truck'  -- ❌ 間違い
WHERE app_id = 'equipment';
```

### APIエラーが発生する

**原因1**: データベース接続エラー
- サーバーログを確認:
  ```
  [API /api/tenant-apps] Error: ...
  ```

**原因2**: テーブルスキーマの不一致
```sql
-- テーブル構造を確認
\d public.tenant_app_routings
```

---

## 📚 関連ファイル

| ファイル | 説明 |
|---------|------|
| `server.js` | バックエンドAPI（`/api/tenant-apps` エンドポイント） |
| `app.js` | フロントエンド（動的アプリカード生成） |
| `index.html` | ダッシュボード画面（Bootstrap Icons読み込み） |
| `sql/create-tenant-app-routings.sql` | テーブル作成とサンプルデータ |
| `sql/alter-add-icon-class-column.sql` | icon_classカラム追加スクリプト |

---

## 🎉 まとめ

この実装により、以下が実現されました：

✅ **コード修正不要**: DBレコード追加だけで新しいアプリを表示
✅ **テナント別設定**: テナントごとに異なるアプリを表示可能
✅ **柔軟なアイコン**: 絵文字とBootstrap Icons両方をサポート
✅ **高い保守性**: 縦持ちテーブルで拡張が容易
✅ **下位互換性**: 既存システムへの影響なし

新しいアプリを追加したい場合は、SQLでレコードを1行追加するだけです！
