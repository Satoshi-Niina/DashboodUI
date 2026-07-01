# server.js リファクタリング手順書

## 概要

このドキュメントは、`server.js`のハードコードされたDB参照を`db-gateway-refactored.js`経由の動的ルーティングに変更する手順を説明します。

---

## 必要な変更

### 1. db-gatewayのインポート追加

**ファイル位置**: server.js 冒頭（require文のセクション）

**変更前**:
```javascript
const express = require('express');
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const configRoutes = require('./server/routes/config');
require('dotenv').config();
```

**変更後**:
```javascript
const express = require('express');
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const configRoutes = require('./server/routes/config');
const dbGateway = require('./db-gateway-refactored');  // ← 追加
require('dotenv').config();
```

---

### 2. getConfigFromDB関数の修正

**ファイル位置**: server.js 102行目付近

**変更前**:
```javascript
async function getConfigFromDB(key, defaultValue) {
  try {
    const query = 'SELECT config_value FROM master_data.app_config WHERE config_key = $1';
    const result = await pool.query(query, [key]);
    return result.rows.length > 0 ? result.rows[0].config_value : (process.env[key.toUpperCase()] || defaultValue);
  } catch (err) {
    console.error(`Failed to get config ${key}:`, err);
    return process.env[key.toUpperCase()] || defaultValue;
  }
}
```

**変更後**:
```javascript
async function getConfigFromDB(key, defaultValue) {
  try {
    // db-gateway経由で動的にルーティング解決
    const result = await dbGateway.dynamicSelect(
      'app_config',                        // 論理リソース名
      { config_key: key },                 // WHERE条件
      ['config_value'],                    // 取得カラム
      1,                                   // LIMIT
      'dashboard-ui'                       // アプリID
    );
    return result.length > 0 ? result[0].config_value : (process.env[key.toUpperCase()] || defaultValue);
  } catch (err) {
    console.error(`Failed to get config ${key}:`, err);
    return process.env[key.toUpperCase()] || defaultValue;
  }
}
```

---

### 3. getAllConfig関数の修正

**ファイル位置**: server.js 114行目付近

**変更前**:
```javascript
async function getAllConfig() {
  try {
    const query = 'SELECT config_key, config_value FROM master_data.app_config';
    const result = await pool.query(query);
    const config = {};
    result.rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    return config;
  } catch (err) {
    console.error('Failed to get all config:', err);
    return {};
  }
}
```

**変更後**:
```javascript
async function getAllConfig() {
  try {
    // db-gateway経由で動的にルーティング解決
    const result = await dbGateway.dynamicSelect(
      'app_config',                        // 論理リソース名
      {},                                  // WHERE条件なし（全件取得）
      ['config_key', 'config_value'],      // 取得カラム
      null,                                // LIMIT なし
      'dashboard-ui'                       // アプリID
    );
    const config = {};
    result.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    return config;
  } catch (err) {
    console.error('Failed to get all config:', err);
    return {};
  }
}
```

---

### 4. 重複実装の削除

**ファイル位置**: server.js 1050-1450行目付近

以下の関数は`db-gateway-refactored.js`に実装済みのため**削除**します：

```javascript
// ❌ 削除対象
async function getRoutingTableColumns() { ... }
async function getPhysicalTableColumns(route) { ... }
function filterDataByColumns(data, columnSet) { ... }
async function resolveTablePath(logicalName) { ... }
async function dynamicSelect(logicalTableName, ...) { ... }
async function dynamicInsert(logicalTableName, ...) { ... }
async function dynamicUpdate(logicalTableName, ...) { ... }
async function dynamicDelete(logicalTableName, ...) { ... }
function clearRoutingCache(logicalName = null) { ... }
```

**削除後**: これらの関数を使用している箇所はすべて`dbGateway.xxx()`に置き換え

---

### 5. dynamicSelect/Insert/Update/Delete呼び出しの置き換え

**パターン1: dynamicSelect**

変更前:
```javascript
const users = await dynamicSelect('users', { role: 'admin' });
```

変更後:
```javascript
const users = await dbGateway.dynamicSelect('users', { role: 'admin' }, ['*'], null, 'dashboard-ui');
```

**パターン2: dynamicInsert**

変更前:
```javascript
const result = await dynamicInsert('users', { username: 'test', email: 'test@example.com' });
```

変更後:
```javascript
const result = await dbGateway.dynamicInsert('users', { username: 'test', email: 'test@example.com' }, true, 'dashboard-ui');
```

**パターン3: dynamicUpdate**

変更前:
```javascript
const result = await dynamicUpdate('users', { email: 'new@example.com' }, { id: 1 });
```

変更後:
```javascript
const result = await dbGateway.dynamicUpdate('users', { email: 'new@example.com' }, { id: 1 }, true, 'dashboard-ui');
```

**パターン4: dynamicDelete**

変更前:
```javascript
const result = await dynamicDelete('users', { id: 1 });
```

変更後:
```javascript
const result = await dbGateway.dynamicDelete('users', { id: 1 }, false, 'dashboard-ui');
```

---

### 6. ハードコードされたテーブル参照の置き換え

#### 6.1 公開リソースルーティング（company_db_routing）

**ファイル位置**: server.js 223行目、458行目など

**注意**: `public.company_db_routing`は**テナントルーティング専用テーブル**のため、
リソースルーティング対象外です。これはそのままにします。

```javascript
// ✅ このままでOK（テナント管理用）
FROM public.company_db_routing
```

#### 6.2 AI設定テーブル

**ファイル位置**: server.js 2911行目、2941行目など

**変更前**:
```javascript
const query = `
  SELECT app_id, setting_type, settings_json, updated_at
  FROM master_data.ai_settings
  WHERE app_id = 'common'
  ORDER BY setting_type
`;
```

**変更後**:
```javascript
const route = await dbGateway.getTablePath('ai_settings', 'dashboard-ui');
const query = `
  SELECT app_id, setting_type, settings_json, updated_at
  FROM ${route.fullPath}
  WHERE app_id = 'common'
  ORDER BY setting_type
`;
```

または、dynamicSelectを使用:
```javascript
const result = await dbGateway.dynamicSelect(
  'ai_settings',
  { app_id: 'common' },
  ['app_id', 'setting_type', 'settings_json', 'updated_at'],
  null,
  'dashboard-ui'
);
```

#### 6.3 設定更新エンドポイント

**ファイル位置**: server.js 1859行目付近（/api/config POST）

**変更前**:
```javascript
const upsertQuery = `
  INSERT INTO master_data.app_config (config_key, config_value, updated_by, updated_at)
  VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
  ON CONFLICT (config_key) 
  DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP
`;
await pool.query(upsertQuery, [key, value, username]);
```

**変更後**:
```javascript
const route = await dbGateway.getTablePath('app_config', 'dashboard-ui');
const upsertQuery = `
  INSERT INTO ${route.fullPath} (config_key, config_value, updated_by, updated_at)
  VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
  ON CONFLICT (config_key) 
  DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP
`;
await pool.query(upsertQuery, [key, value, username]);
```

#### 6.4 設定履歴テーブル

**ファイル位置**: server.js 1901行目付近（/api/config/history GET）

**変更前**:
```javascript
const query = `
  SELECT config_key, old_value, new_value, updated_by, updated_at
  FROM master_data.app_config_history
  ORDER BY updated_at DESC
  LIMIT 20
`;
```

**変更後**:
```javascript
const route = await dbGateway.getTablePath('app_config_history', 'dashboard-ui');
const query = `
  SELECT config_key, old_value, new_value, updated_by, updated_at
  FROM ${route.fullPath}
  ORDER BY updated_at DESC
  LIMIT 20
`;
```

---

### 7. AIAdminServiceの置き換え

**ファイル位置**: server.jsでAIAdminServiceを使用している箇所

**変更前**:
```javascript
const AIAdminService = require('./server/AIAdminService');
```

**変更後**:
```javascript
const AIAdminService = require('./server/AIAdminService-refactored');
```

---

## 一括置換の推奨パターン

### VSCodeで一括置換する場合

1. **Ctrl + Shift + H** で置換ダイアログを開く
2. 正規表現を有効化
3. 以下のパターンで順次置換

#### パターン1: master_data.ai_settings

**検索**:
```
master_data\.ai_settings
```

**置換**:
```
${(await dbGateway.getTablePath('ai_settings', 'dashboard-ui')).fullPath}
```

または、コンテキストに応じて手動で修正

#### パターン2: master_data.ai_knowledge_data

**検索**:
```
master_data\.ai_knowledge_data
```

**置換**:
動的ルーティングコードに手動で置換

#### パターン3: master_data.app_config

**検索**:
```
FROM master_data\.app_config
```

**置換**:
```
FROM ${(await dbGateway.getTablePath('app_config', 'dashboard-ui')).fullPath}
```

---

## 段階的な移行戦略

### フェーズ1: 準備（破壊的変更なし）

1. `db-gateway-refactored.js`を配置
2. `AIAdminService-refactored.js`を配置
3. `setup-dashboard-routing-complete.sql`を実行してルーティング登録
4. テスト環境で動作確認

### フェーズ2: 部分的な移行

1. `getConfigFromDB`と`getAllConfig`のみ修正
2. サーバー再起動
3. 設定関連機能の動作確認
4. 問題なければ次へ

### フェーズ3: CRUD関数の置き換え

1. `dynamicSelect/Insert/Update/Delete`の呼び出しを`dbGateway.xxx()`に置き換え
2. 元の実装は一時的にコメントアウト（削除しない）
3. 動作確認
4. 問題なければ元の実装を削除

### フェーズ4: AI機能の移行

1. `AIAdminService`を`AIAdminService-refactored`に置き換え
2. AI関連APIの動作確認
3. ナレッジデータアップロード/削除のテスト

### フェーズ5: 完全移行

1. すべてのハードコード箇所を修正
2. 旧実装コードを削除
3. 本番環境へのデプロイ

---

## テスト手順

### 1. ルーティング確認

```bash
curl http://localhost:8080/api/debug/routing | jq
```

期待する出力:
```json
[
  {
    "app_id": "dashboard-ui",
    "logical_resource_name": "users",
    "physical_schema": "master_data",
    "physical_table": "users",
    "is_active": true
  },
  {
    "app_id": "dashboard-ui",
    "logical_resource_name": "app_config",
    "physical_schema": "master_data",
    "physical_table": "app_config",
    "is_active": true
  }
  ...
]
```

### 2. 設定取得テスト

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8080/api/config | jq
```

### 3. AI設定取得テスト

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     http://localhost:8080/api/ai/settings | jq
```

### 4. CRUD操作テスト

```bash
# ユーザー一覧
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     http://localhost:8080/api/users | jq

# ユーザー作成
curl -X POST \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","email":"test@example.com","password":"password123"}' \
     http://localhost:8080/api/users | jq
```

---

## ロールバック手順

### 問題が発生した場合

1. **即座のロールバック**: Gitで前のコミットに戻す
   ```bash
   git checkout HEAD~1 server.js
   git checkout HEAD~1 server/AIAdminService.js
   ```

2. **部分的なロールバック**: 問題のある関数だけ元に戻す
   - コメントアウトしておいた旧実装を復活
   - 新実装をコメントアウト

3. **ルーティング無効化**: 一時的にフォールバックに頼る
   ```sql
   UPDATE public.app_resource_routing
   SET is_active = false
   WHERE app_id = 'dashboard-ui';
   ```

---

## チェックリスト

移行完了前に以下を確認:

- [ ] `db-gateway-refactored.js`が配置されている
- [ ] `AIAdminService-refactored.js`が配置されている
- [ ] `setup-dashboard-routing-complete.sql`を実行済み
- [ ] ルーティング情報が正しく登録されている（/api/debug/routingで確認）
- [ ] `getConfigFromDB`が動的ルーティング経由になっている
- [ ] `getAllConfig`が動的ルーティング経由になっている
- [ ] `dynamicSelect/Insert/Update/Delete`が`dbGateway.xxx()`に置き換えられている
- [ ] 重複実装が削除されている
- [ ] `AIAdminService`のimportが`-refactored`版になっている
- [ ] すべてのAPI エンドポイントが動作する
- [ ] ログに`[db-gateway] ✅ Resolved:`が出力されている
- [ ] エラーログに異常がない
- [ ] フォールバック（⚠️警告）が必要最小限である

---

## まとめ

この手順に従うことで、ハードコードされたDB参照を動的ルーティングに安全に移行できます。

**重要ポイント**:
- 一度にすべて変更しない（段階的移行）
- 各フェーズで動作確認を徹底
- 旧実装は即座に削除せず、コメントアウトで残す
- ロールバック手順を事前に確認

---

**作成日**: 2026-07-01  
**バージョン**: 1.0  
**対象ファイル**: server.js
