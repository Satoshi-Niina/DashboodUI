# 全アプリケーション Master Data Integration 完了レポート

## 実装完了日時
2026年1月4日

## 実装概要

全4つのアプリケーションに**動的ルーティング対応のmaster_dataアクセス機能**を実装しました。

## 実装内容

### ✅ 動的ルーティング対応

**app_resource_routingテーブルを参照**して自動的にテーブルパスを解決：

```javascript
// 使用例
import { getUsers } from './master-data.js';

const users = await getUsers();
// → app_resource_routingを確認
// → master_data.usersにアクセス
```

### ✅ 管理テーブル更新への自動対応

**重要**: `app_resource_routing`テーブルを更新すると、**自動的に新しいパスを使用**します。

#### 動作フロー：
1. DBeaver等で`app_resource_routing`を更新
2. キャッシュTTL（1分）後、自動的に新しいルーティングを使用
3. 即座に反映したい場合は`clearRoutingCache()`を呼び出し

#### 例：
```sql
-- DashboardUIでusersテーブルのスキーマを変更
UPDATE public.app_resource_routing 
SET physical_schema = 'new_schema',
    physical_table = 'new_users'
WHERE app_id = 'dashboard-ui' 
  AND logical_resource_name = 'users';

-- 各アプリは最大1分後に自動的にnew_schema.new_usersを使用
```

## 実装済みアプリケーション

### 1. Emergency-Assistance (emergency-client)
- **パス**: `server/db/master-data.js`
- **APP_ID**: emergency-client
- **ルート数**: 7
- **共有マスタ**: users, managements_offices, bases, vehicles, machine_types, machines
- **専用テーブル**: emergency_records (emergency.emergency_records)

### 2. Machine Failure Analysis System (failure)
- **パス**: `master-data.js`
- **APP_ID**: failure
- **ルート数**: 7
- **共有マスタ**: users, managements_offices, bases, vehicles, machine_types, machines
- **専用テーブル**: fault_records (maintenance.fault_records)

### 3. operation-management-app (planning)
- **パス**: `master-data.js`
- **APP_ID**: planning
- **ルート数**: 8
- **共有マスタ**: users, managements_offices, bases, vehicles, machine_types, machines
- **専用テーブル**: schedules (operations.schedules), operation_records (operations.operation_records)

### 4. railway-maintenance-system (equipment)
- **パス**: `master-data.js`
- **APP_ID**: equipment
- **ルート数**: 8
- **共有マスタ**: users, managements_offices, bases, vehicles, machine_types, machines
- **専用テーブル**: inspection_records (inspections.inspection_records), inspection_types (master_data.inspection_types)

## 提供される関数

### 共有マスタアクセス
```javascript
getUsers()                  // master_data.users
getManagementOffices()      // master_data.managements_offices
getBases()                  // master_data.bases
getVehicles()               // master_data.vehicles
getMachineTypes()           // master_data.machine_types
getMachines()               // master_data.machines
```

### ユーティリティ
```javascript
getTablePath(logicalName)   // 論理名から物理パスを取得
queryTable(logicalName)     // 動的クエリ実行
clearRoutingCache()         // キャッシュクリア（即座に反映）
```

## 使用方法

### 1. 基本的な使用
```javascript
import { getUsers, getMachineTypes } from './master-data.js';

// ユーザー一覧取得
const users = await getUsers();

// 機種一覧取得
const types = await getMachineTypes();
```

### 2. API endpoint実装
```javascript
import express from 'express';
import { getUsers, getMachineTypes } from './master-data.js';

const router = express.Router();

router.get('/api/masters/users', async (req, res) => {
    const users = await getUsers();
    res.json(users);
});

router.get('/api/masters/machine-types', async (req, res) => {
    const types = await getMachineTypes();
    res.json(types);
});

export default router;
```

### 3. 動的テーブルアクセス
```javascript
import { getTablePath, client } from './master-data.js';

async function getRecordById(tableName, id) {
    const path = await getTablePath(tableName);
    return client`SELECT * FROM ${path} WHERE id = ${id}`;
}
```

## 管理テーブル更新の手順

### DBeaver上での更新
```sql
-- 例: vehiclesテーブルのスキーマを変更
UPDATE public.app_resource_routing 
SET physical_schema = 'new_master',
    physical_table = 'vehicles_v2',
    updated_at = CURRENT_TIMESTAMP
WHERE logical_resource_name = 'vehicles'
  AND app_id IN ('dashboard-ui', 'emergency-client', 'planning', 'equipment', 'failure');
```

### 即座に反映（オプション）
```javascript
// 各アプリのサーバーコードで
import { clearRoutingCache } from './master-data.js';

// ルーティング更新後に呼び出し
clearRoutingCache();
```

## データベース確認SQL

### 全アプリのルーティング状況確認
```sql
SELECT 
    app_id,
    COUNT(*) as routes,
    STRING_AGG(logical_resource_name, ', ' ORDER BY logical_resource_name) as resources
FROM public.app_resource_routing
WHERE app_id IN ('dashboard-ui', 'emergency-client', 'planning', 'equipment', 'failure')
  AND is_active = true
GROUP BY app_id
ORDER BY app_id;
```

### 共有マスタの利用状況
```sql
SELECT 
    logical_resource_name,
    physical_schema || '.' || physical_table as table_path,
    STRING_AGG(app_id, ', ' ORDER BY app_id) as used_by
FROM public.app_resource_routing
WHERE logical_resource_name IN ('users', 'managements_offices', 'bases', 'vehicles', 'machine_types', 'machines')
  AND is_active = true
GROUP BY logical_resource_name, physical_schema, physical_table
ORDER BY logical_resource_name;
```

## トラブルシューティング

### エラー: "No routing found"
```
console.warn: No routing found for emergency-client:users, using public schema
```

**原因**: app_resource_routingテーブルにルーティングが未登録

**解決方法**: `setup-all-apps-routing-utf8.sql`をDBeaver上で実行

### エラー: "relation does not exist"
```
ERROR: relation "master_data.users" does not exist
```

**原因**: master_dataスキーマまたはテーブルが存在しない

**解決方法**: `database-setup.sql`を実行してmaster_dataスキーマを作成

### キャッシュが更新されない
**解決方法**: `clearRoutingCache()`を呼び出してキャッシュをクリア

## 次のステップ

### 各アプリでの実装
1. ✅ master-data.js作成完了
2. ⏳ 既存コードでのmaster-data.js使用
3. ⏳ API endpointの追加
4. ⏳ フロントエンドの統合

### テスト
1. ⏳ 各アプリでmaster_dataテーブルへのアクセステスト
2. ⏳ ルーティング更新時の動作確認
3. ⏳ キャッシュ機能の動作確認

## ファイル一覧

### Emergency-Assistance
- `server/db/master-data.js` - メインモジュール
- `MASTER_DATA_INTEGRATION.md` - 実装ガイド
- `db-gateway.js` - 汎用ゲートウェイ
- `shared-db-config.js` - DB接続設定

### Machine Failure Analysis System
- `master-data.js` - メインモジュール (APP_ID: failure)
- `MASTER_DATA_INTEGRATION.md` - 実装ガイド
- `db-gateway.js` - 汎用ゲートウェイ
- `shared-db-config.js` - DB接続設定
- `server.js` - 既存サーバーファイル

### operation-management-app
- `master-data.js` - メインモジュール (APP_ID: planning)
- `MASTER_DATA_INTEGRATION.md` - 実装ガイド
- `db-gateway.js` - 汎用ゲートウェイ
- `shared-db-config.js` - DB接続設定

### railway-maintenance-system
- `master-data.js` - メインモジュール (APP_ID: equipment)
- `MASTER_DATA_INTEGRATION.md` - 実装ガイド
- `db-gateway.js` - 汎用ゲートウェイ
- `shared-db-config.js` - DB接続設定

## まとめ

✅ **4つ全てのアプリケーション**にゲートウェイルーティング実装完了
✅ **動的ルーティング対応**: app_resource_routingテーブル更新に自動対応
✅ **キャッシュ機能**: 高速アクセスと自動更新のバランス
✅ **フォールバック**: ルーティング未登録時も動作継続
✅ **統一インターフェース**: 全アプリで同じ関数を使用

これで、DashboardUIでmaster_dataテーブルのスキーマやテーブル名を変更しても、**全アプリケーションが自動的に追従**します。
