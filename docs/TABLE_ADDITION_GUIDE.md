# 🔧 新しいテーブル追加手順（クイックガイド）

## 概要

このガイドでは、**アプリケーションコードを一切変更せず**、新しいテーブルを追加してダッシュボードUIから利用する方法を説明します。

---

## ✅ 前提条件

- `app_resource_routing`テーブルが作成済み
- `init-dashboard-routing.sql`を実行済み
- db-gateway.jsが実装済み

---

## 📋 手順（5分で完了）

### ステップ1: 物理テーブルの作成

まず、通常通りデータベースにテーブルを作成します。

```sql
-- 例: 運行計画テーブルを追加
CREATE TABLE IF NOT EXISTS master_data.operation_plans (
    id SERIAL PRIMARY KEY,
    plan_date DATE NOT NULL,
    vehicle_id INTEGER REFERENCES master_data.vehicles(id),
    route_name VARCHAR(200),
    start_time TIME,
    end_time TIME,
    status VARCHAR(50) DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックスも追加（任意）
CREATE INDEX idx_operation_plans_date ON master_data.operation_plans(plan_date);
CREATE INDEX idx_operation_plans_vehicle ON master_data.operation_plans(vehicle_id);
```

### ステップ2: ルーティング設定の登録

**重要**: これだけでアプリ側から使用可能になります！

```sql
-- ルーティングテーブルに登録（冪等性あり）
INSERT INTO public.app_resource_routing (
    tenant_id,              -- テナントID（通常は'demo'）
    app_id,                 -- アプリID（'dashboard-ui'）
    logical_resource_name,  -- 論理名（コードで使う名前）
    physical_schema,        -- 実際のスキーマ名
    physical_table,         -- 実際のテーブル名
    physical_table_name,    -- 互換性のため（同じ値）
    is_active,              -- 有効フラグ
    description             -- 説明（任意）
) VALUES (
    'demo',
    'dashboard-ui',
    'operation_plans',      -- ← この名前でコードから参照可能
    'master_data',
    'operation_plans',
    'operation_plans',
    true,
    '運行計画マスタ'
)
ON CONFLICT (tenant_id, app_id, logical_resource_name) 
DO UPDATE SET 
    physical_schema = EXCLUDED.physical_schema,
    physical_table = EXCLUDED.physical_table,
    physical_table_name = EXCLUDED.physical_table_name,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
```

### ステップ3: サーバー再起動（キャッシュクリア）

```bash
# Node.jsサーバーを再起動
# Ctrl+C で停止 → 再起動
node server.js
```

または、キャッシュのみクリア（コード内）:
```javascript
const dbGateway = require('./db-gateway');
dbGateway.clearCache();
```

### ステップ4: 動作確認

ブラウザでルーティング状態を確認:
```
http://localhost:8080/debug/routing-status
```

新しい`operation_plans`が表示されていればOK！

---

## 💻 アプリケーションコード例

### 一覧取得

```javascript
const dbGateway = require('./db-gateway');

// GET /api/operation-plans
app.get('/api/operation-plans', requireAuth, async (req, res) => {
    try {
        const plans = await dbGateway.dynamicSelect(
            'operation_plans',          // 論理リソース名
            {},                         // WHERE条件なし（全件取得）
            ['*'],                      // すべてのカラム
            null,                       // LIMITなし
            'dashboard-ui'              // アプリID
        );
        res.json({ success: true, data: plans });
    } catch (err) {
        console.error('Error fetching operation plans:', err);
        res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
});
```

### 条件付き検索

```javascript
// GET /api/operation-plans?date=2026-07-01
app.get('/api/operation-plans', requireAuth, async (req, res) => {
    try {
        const { date } = req.query;
        const conditions = date ? { plan_date: date } : {};
        
        const plans = await dbGateway.dynamicSelect(
            'operation_plans',
            conditions,
            ['*'],
            null,
            'dashboard-ui'
        );
        
        res.json({ success: true, data: plans });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
});
```

### 新規作成

```javascript
// POST /api/operation-plans
app.post('/api/operation-plans', requireAuth, async (req, res) => {
    try {
        const { plan_date, vehicle_id, route_name, start_time, end_time } = req.body;
        
        const result = await dbGateway.dynamicInsert(
            'operation_plans',
            {
                plan_date,
                vehicle_id,
                route_name,
                start_time,
                end_time,
                status: 'planned'
            },
            true,                       // RETURNING句（作成されたデータを返す）
            'dashboard-ui'
        );
        
        res.json({ success: true, data: result[0] });
    } catch (err) {
        console.error('Error creating plan:', err);
        res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
});
```

### 更新

```javascript
// PUT /api/operation-plans/:id
app.put('/api/operation-plans/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, route_name } = req.body;
        
        const result = await dbGateway.dynamicUpdate(
            'operation_plans',
            { status, route_name },     // 更新データ
            { id },                     // WHERE条件
            true,                       // RETURNING句
            'dashboard-ui'
        );
        
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: '計画が見つかりません' });
        }
        
        res.json({ success: true, data: result[0] });
    } catch (err) {
        console.error('Error updating plan:', err);
        res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
});
```

### 削除

```javascript
// DELETE /api/operation-plans/:id
app.delete('/api/operation-plans/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await dbGateway.dynamicDelete(
            'operation_plans',
            { id },
            true,                       // RETURNING句
            'dashboard-ui'
        );
        
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: '計画が見つかりません' });
        }
        
        res.json({ success: true, message: '削除しました', data: result[0] });
    } catch (err) {
        console.error('Error deleting plan:', err);
        res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
});
```

---

## 🔄 既存テーブルの移動（スキーマ変更）

物理的なテーブル配置を変更する場合も、**コード修正不要**です。

### 例: `master_data.vehicles` を `operations.vehicles` に移動

```sql
-- 1. 新しいスキーマとテーブルを作成
CREATE SCHEMA IF NOT EXISTS operations;
CREATE TABLE operations.vehicles AS SELECT * FROM master_data.vehicles;

-- 2. ルーティング設定を更新（これだけ！）
UPDATE public.app_resource_routing
SET physical_schema = 'operations',
    physical_table = 'vehicles',
    physical_table_name = 'vehicles',
    updated_at = CURRENT_TIMESTAMP
WHERE app_id = 'dashboard-ui'
  AND logical_resource_name = 'vehicles';

-- 3. サーバー再起動 → 完了
```

---

## ⚠️ 注意事項

### DO（推奨）

✅ 論理リソース名はわかりやすく、一貫性のある命名  
✅ descriptionフィールドに日本語説明を記載  
✅ 新規追加は`ON CONFLICT DO UPDATE`で冪等性を保つ  
✅ テーブル作成後すぐにルーティング登録  
✅ `/debug/routing-status`で必ず動作確認  

### DON'T（非推奨）

❌ 論理リソース名と物理テーブル名を大きく変えすぎない  
❌ 本番環境でis_active=falseにしたまま放置  
❌ ルーティング登録せずにコードで直接使用  
❌ tenant_idを間違える（通常は'demo'）  
❌ サーバー再起動を忘れる  

---

## 🐛 トラブルシューティング

### 問題: 新しいテーブルが使えない

**症状**:
```
[db-gateway] ⚠️ No route found for demo:dashboard-ui:operation_plans
```

**確認**:
```sql
-- ルーティング登録を確認
SELECT * FROM public.app_resource_routing
WHERE app_id = 'dashboard-ui'
  AND logical_resource_name = 'operation_plans';
```

**対処**:
- 登録されていない → ステップ2を再実行
- `is_active = false` → `UPDATE ... SET is_active = true`
- `tenant_id`が違う → 正しい値に修正

### 問題: カラムが存在しないエラー

**症状**:
```
column "new_column" does not exist
```

**原因**: 物理テーブルにカラムが存在しない

**対処**:
```sql
ALTER TABLE master_data.operation_plans
ADD COLUMN new_column VARCHAR(255);
```

---

## 📚 詳細情報

より詳しい情報は以下を参照:

- **[ROUTING_OPERATIONS_MANUAL.md](./ROUTING_OPERATIONS_MANUAL.md)** - 完全版運用マニュアル
- **[SERVER_REFACTORING_GUIDE.md](./SERVER_REFACTORING_GUIDE.md)** - server.js詳細修正手順
- **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** - リファクタリング全体像

---

## ✨ まとめ

新しいテーブルを追加する際の手順：

1. ✅ 物理テーブル作成（通常のCREATE TABLE）
2. ✅ ルーティング登録（1つのINSERT文）
3. ✅ サーバー再起動（キャッシュクリア）
4. ✅ 動作確認（/debug/routing-status）

**所要時間**: 約5分  
**コード修正**: 不要  
**DB操作のみ**: ✅

---

**作成日**: 2026-07-01  
**対象**: ダッシュボードUI (dashboard-ui)  
**前提**: db-gateway.js実装済み
