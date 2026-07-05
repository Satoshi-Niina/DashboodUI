# リソースルーティング 運用マニュアル

## 概要

このマニュアルでは、ダッシュボードUIにおけるリソースルーティングシステムの運用方法を説明します。

## 目次

1. [システム概要](#システム概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [新しいテーブルの追加手順](#新しいテーブルの追加手順)
4. [既存テーブルの移動手順](#既存テーブルの移動手順)
5. [トラブルシューティング](#トラブルシューティング)
6. [ベストプラクティス](#ベストプラクティス)

---

## システム概要

### 設計原則

1. **論理名による抽象化**: コード内では物理的なテーブル名（`master_data.users`）を直接記述せず、論理名（`users`）を使用
2. **動的ルーティング**: `app_resource_routing`テーブルに基づいて、実行時に物理テーブルパスを解決
3. **後方互換性**: ルーティングが見つからない場合は`master_data`スキーマにフォールバック
4. **マルチテナント対応**: テナントIDに基づいて異なるルーティングを適用可能
5. **キャッシュ最適化**: 1分間のTTLでルーティング情報をキャッシュ

### 主要コンポーネント

```
db-gateway-refactored.js    - 共通ルーティングモジュール
  ├─ getTablePath()         - 論理名→物理パス解決
  ├─ dynamicSelect()        - 動的SELECT
  ├─ dynamicInsert()        - 動的INSERT
  ├─ dynamicUpdate()        - 動的UPDATE
  ├─ dynamicDelete()        - 動的DELETE
  └─ clearCache()           - キャッシュクリア

app_resource_routing        - ルーティング定義テーブル
  ├─ app_id                 - アプリケーションID
  ├─ logical_resource_name  - 論理リソース名
  ├─ physical_schema        - 物理スキーマ名
  ├─ physical_table         - 物理テーブル名
  └─ is_active              - 有効フラグ
```

---

## アーキテクチャ

### データフロー

```
アプリケーション層
    ↓
    ① 論理リソース名を指定（例: 'users'）
    ↓
db-gateway-refactored.js
    ↓
    ② app_resource_routingテーブルを検索
    ↓
    ③ 物理パスを解決（例: 'master_data.users'）
    ↓
    ④ SQLクエリを生成・実行
    ↓
PostgreSQL データベース
```

### ルーティングテーブル構造

```sql
CREATE TABLE IF NOT EXISTS public.app_resource_routing (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) DEFAULT 'demo',
    app_id VARCHAR(50) NOT NULL,
    logical_resource_name VARCHAR(100) NOT NULL,
    physical_schema VARCHAR(100) NOT NULL,
    physical_table VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, app_id, logical_resource_name)
);
```

---

## 新しいテーブルの追加手順

### ステップ1: データベース側の準備

#### 1.1 物理テーブルの作成

```sql
-- 例: 新しい「通知設定」テーブルを追加
CREATE TABLE IF NOT EXISTS master_data.notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES master_data.users(id),
    notification_type VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.2 ルーティング設定の追加

```sql
-- app_resource_routingテーブルに登録
INSERT INTO public.app_resource_routing (
    app_id, 
    logical_resource_name, 
    physical_schema, 
    physical_table, 
    is_active,
    description
) VALUES (
    'dashboard-ui',                    -- アプリID
    'notification_settings',           -- 論理リソース名（コードで使用）
    'master_data',                     -- 物理スキーマ
    'notification_settings',           -- 物理テーブル名
    true,                              -- 有効フラグ
    '通知設定マスタ'                   -- 説明（オプション）
);
```

#### 1.3 登録確認

```sql
-- ルーティングが正しく登録されたか確認
SELECT 
    app_id,
    logical_resource_name,
    physical_schema,
    physical_table,
    is_active,
    description
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
  AND logical_resource_name = 'notification_settings';
```

### ステップ2: アプリケーション側の実装

#### 2.1 db-gatewayを使用したアクセス

```javascript
const dbGateway = require('./db-gateway-refactored');

// SELECT例
async function getNotificationSettings(userId) {
    const results = await dbGateway.dynamicSelect(
        'notification_settings',           // 論理リソース名
        { user_id: userId },               // WHERE条件
        ['*'],                             // 取得カラム
        null,                              // LIMIT
        'dashboard-ui'                     // アプリID（省略可）
    );
    return results;
}

// INSERT例
async function createNotificationSetting(data) {
    const results = await dbGateway.dynamicInsert(
        'notification_settings',           // 論理リソース名
        {
            user_id: data.userId,
            notification_type: data.type,
            is_enabled: data.enabled
        },
        true,                              // RETURNING句
        'dashboard-ui'                     // アプリID
    );
    return results[0];
}

// UPDATE例
async function updateNotificationSetting(id, data) {
    const results = await dbGateway.dynamicUpdate(
        'notification_settings',           // 論理リソース名
        { is_enabled: data.enabled },      // 更新データ
        { id: id },                        // WHERE条件
        true,                              // RETURNING句
        'dashboard-ui'                     // アプリID
    );
    return results[0];
}

// DELETE例
async function deleteNotificationSetting(id) {
    const results = await dbGateway.dynamicDelete(
        'notification_settings',           // 論理リソース名
        { id: id },                        // WHERE条件
        true,                              // RETURNING句
        'dashboard-ui'                     // アプリID
    );
    return results[0];
}
```

#### 2.2 APIエンドポイントの実装

```javascript
// GET: 通知設定一覧取得
app.get('/api/notification-settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await dbGateway.dynamicSelect(
            'notification_settings',
            { user_id: userId },
            ['*'],
            null,
            'dashboard-ui'
        );
        res.json({ success: true, data: settings });
    } catch (err) {
        console.error('Error fetching notification settings:', err);
        res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
});

// POST: 通知設定作成
app.post('/api/notification-settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { notification_type, is_enabled } = req.body;
        
        const result = await dbGateway.dynamicInsert(
            'notification_settings',
            {
                user_id: userId,
                notification_type,
                is_enabled
            },
            true,
            'dashboard-ui'
        );
        
        res.json({ success: true, data: result[0] });
    } catch (err) {
        console.error('Error creating notification setting:', err);
        res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
});
```

### ステップ3: 動作確認

#### 3.1 ルーティング確認

```bash
# ルーティング情報の確認エンドポイント
curl http://localhost:8080/api/debug/routing
```

#### 3.2 機能テスト

```bash
# 一覧取得テスト
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8080/api/notification-settings

# 作成テスト
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"notification_type":"email","is_enabled":true}' \
     http://localhost:8080/api/notification-settings
```

#### 3.3 ログ確認

```bash
# サーバーログでルーティング解決を確認
# 正常な場合:
[db-gateway] ✅ Resolved: notification_settings → master_data."notification_settings"
[db-gateway] SELECT from master_data."notification_settings"
[db-gateway] ✅ SELECT success: 5 rows

# フォールバック発生時（ルーティング未登録）:
[db-gateway] ⚠️ No route found for demo:dashboard-ui:notification_settings, falling back to master_data.notification_settings
```

---

## 既存テーブルの移動手順

### シナリオ: `master_data.users` を `tenant_data.users` に移動

#### ステップ1: 事前準備

```sql
-- 1. バックアップ取得
pg_dump -h localhost -U postgres -d common_db -t master_data.users > users_backup.sql

-- 2. 新スキーマの作成（存在しない場合）
CREATE SCHEMA IF NOT EXISTS tenant_data;

-- 3. テーブルのコピー
CREATE TABLE tenant_data.users (LIKE master_data.users INCLUDING ALL);
INSERT INTO tenant_data.users SELECT * FROM master_data.users;

-- 4. データ整合性確認
SELECT COUNT(*) FROM master_data.users;
SELECT COUNT(*) FROM tenant_data.users;
-- 両方の件数が一致することを確認
```

#### ステップ2: ルーティング更新

```sql
-- ルーティング設定を更新（物理パスのみ変更）
UPDATE public.app_resource_routing
SET physical_schema = 'tenant_data',
    physical_table = 'users',
    updated_at = CURRENT_TIMESTAMP
WHERE app_id = 'dashboard-ui'
  AND logical_resource_name = 'users';

-- 更新確認
SELECT * FROM public.app_resource_routing
WHERE logical_resource_name = 'users';
```

#### ステップ3: キャッシュクリア

```javascript
// サーバー側でキャッシュクリア
const dbGateway = require('./db-gateway-refactored');
dbGateway.clearCacheFor('dashboard-ui', 'users');

// または全キャッシュクリア
dbGateway.clearCache();

// または サーバー再起動
```

#### ステップ4: 動作確認

```sql
-- テスト用クエリ
SELECT * FROM public.app_resource_routing
WHERE logical_resource_name = 'users';

-- アプリケーションからアクセステスト
-- ログで "tenant_data.users" が使用されていることを確認
```

#### ステップ5: 旧テーブルの削除（慎重に）

```sql
-- ⚠️ 十分な動作確認後のみ実行！

-- 1週間程度の移行期間を経てから実行推奨
-- まずはリネームして退避
ALTER TABLE master_data.users RENAME TO users_old_backup;

-- さらに1ヶ月程度問題がなければ削除
-- DROP TABLE master_data.users_old_backup;
```

---

## トラブルシューティング

### 問題1: ルーティングが見つからない

**症状:**
```
[db-gateway] ⚠️ No route found for demo:dashboard-ui:users, falling back to master_data.users
```

**原因:**
- `app_resource_routing`テーブルにルーティングが登録されていない
- `is_active`フラグが`false`になっている
- `tenant_id`、`app_id`、`logical_resource_name`の組み合わせが一致しない

**対処法:**
```sql
-- ルーティング登録状況を確認
SELECT * FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
  AND logical_resource_name = 'users';

-- 登録されていない場合は追加
INSERT INTO public.app_resource_routing (
    app_id, logical_resource_name, physical_schema, physical_table, is_active
) VALUES (
    'dashboard-ui', 'users', 'master_data', 'users', true
);

-- is_activeがfalseの場合は有効化
UPDATE public.app_resource_routing
SET is_active = true
WHERE app_id = 'dashboard-ui'
  AND logical_resource_name = 'users';
```

### 問題2: カラムが存在しないエラー

**症状:**
```
[db-gateway] ❌ INSERT error: column "new_column" of relation "users" does not exist
```

**原因:**
- コードで指定したカラムが物理テーブルに存在しない
- カラムフィルタリングが正しく動作していない

**対処法:**
```sql
-- 物理テーブルのカラム一覧を確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'master_data'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 不足しているカラムを追加（必要な場合）
ALTER TABLE master_data.users
ADD COLUMN new_column VARCHAR(255) DEFAULT NULL;
```

### 問題3: キャッシュが残っている

**症状:**
- ルーティング設定を更新したのに古いテーブルが参照される

**原因:**
- ルーティングキャッシュ（TTL: 1分）が残っている

**対処法:**
```javascript
// 方法1: 特定リソースのキャッシュクリア
const dbGateway = require('./db-gateway-refactored');
dbGateway.clearCacheFor('dashboard-ui', 'users');

// 方法2: すべてのキャッシュクリア
dbGateway.clearCache();

// 方法3: サーバー再起動（確実）
// Ctrl+C でサーバー停止 → 再起動
```

### 問題4: テナントIDの不一致

**症状:**
```
[db-gateway] ❌ Error resolving users: No route found
```

**原因:**
- リクエストのテナントIDとルーティングテーブルの`tenant_id`が一致しない

**対処法:**
```sql
-- ルーティングテーブルのテナントID確認
SELECT tenant_id, app_id, logical_resource_name
FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui';

-- 必要に応じてテナントIDを更新
UPDATE public.app_resource_routing
SET tenant_id = 'demo'
WHERE app_id = 'dashboard-ui'
  AND tenant_id IS NULL;

-- またはデフォルト'demo'で登録
INSERT INTO public.app_resource_routing (
    tenant_id, app_id, logical_resource_name, physical_schema, physical_table, is_active
) VALUES (
    'demo', 'dashboard-ui', 'users', 'master_data', 'users', true
);
```

---

## ベストプラクティス

### 1. 論理名の命名規則

- **単数形を使用**: `user` ではなく `users`（テーブル名に合わせる）
- **スネークケース**: `notification_settings` (推奨)
- **わかりやすい名前**: `users`, `vehicles`, `machines`
- **プレフィックスは不要**: `tbl_users` ではなく `users`

### 2. 物理スキーマの使い分け

```
master_data    - マスタデータ（ユーザー、事業所、車両など）
public         - 共通設定（ルーティング、テナント情報など）
tenant_data    - テナント固有データ（将来的に分離が必要な場合）
ai_data        - AI/RAG専用データ（大容量・高頻度アクセス）
```

### 3. ルーティング登録時の注意点

```sql
-- ✅ 良い例: descriptionを付与
INSERT INTO public.app_resource_routing (
    app_id, logical_resource_name, physical_schema, physical_table, 
    is_active, description
) VALUES (
    'dashboard-ui', 'users', 'master_data', 'users', 
    true, 'ユーザーマスタ - 認証・権限管理'
);

-- ❌ 悪い例: descriptionなし、コメントなし
INSERT INTO public.app_resource_routing
VALUES (1, 'demo', 'dashboard-ui', 'users', 'master_data', 'users', true, NULL, NOW(), NOW());
```

### 4. バージョン管理

```sql
-- ルーティング変更履歴テーブル（オプション）
CREATE TABLE IF NOT EXISTS public.app_resource_routing_history (
    id SERIAL PRIMARY KEY,
    routing_id INTEGER REFERENCES public.app_resource_routing(id),
    old_physical_schema VARCHAR(100),
    old_physical_table VARCHAR(100),
    new_physical_schema VARCHAR(100),
    new_physical_table VARCHAR(100),
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- 変更時にトリガーで自動記録
CREATE OR REPLACE FUNCTION record_routing_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.physical_schema != NEW.physical_schema 
       OR OLD.physical_table != NEW.physical_table THEN
        INSERT INTO public.app_resource_routing_history (
            routing_id, old_physical_schema, old_physical_table,
            new_physical_schema, new_physical_table
        ) VALUES (
            NEW.id, OLD.physical_schema, OLD.physical_table,
            NEW.physical_schema, NEW.physical_table
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER routing_change_trigger
AFTER UPDATE ON public.app_resource_routing
FOR EACH ROW
EXECUTE FUNCTION record_routing_change();
```

### 5. パフォーマンス最適化

```sql
-- ルーティングテーブルにインデックスを作成
CREATE INDEX IF NOT EXISTS idx_app_resource_routing_lookup
ON public.app_resource_routing(tenant_id, app_id, logical_resource_name)
WHERE is_active = true;

-- 統計情報の更新
ANALYZE public.app_resource_routing;
```

### 6. セキュリティ

```sql
-- ルーティングテーブルへのアクセス制限
REVOKE ALL ON public.app_resource_routing FROM PUBLIC;
GRANT SELECT ON public.app_resource_routing TO app_user;
GRANT INSERT, UPDATE, DELETE ON public.app_resource_routing TO app_admin;
```

---

## まとめ

### このシステムの利点

1. **柔軟性**: テーブル構成の変更がコード修正不要
2. **保守性**: 物理構造とビジネスロジックの分離
3. **拡張性**: 新しいテーブル追加が容易
4. **マルチテナント対応**: テナントごとに異なるDB構成が可能
5. **後方互換性**: 既存システムへの影響を最小化

### 今後の拡張

1. **common_dbへの移植**: ルーティングテーブルを共通DBに配置
2. **動的スキーマ切り替え**: テナントごとに完全に異なるスキーマを使用
3. **読み書き分離**: リードレプリカへのルーティング
4. **監視・アラート**: ルーティング変更の通知機能

---

**作成日**: 2026-07-01  
**バージョン**: 1.0  
**対象システム**: ダッシュボードUI (dashboard-ui)
