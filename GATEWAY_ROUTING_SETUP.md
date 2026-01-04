# ゲートウェイルーティング設定手順

## 📋 概要

すべてのサブアプリケーション（emergency-client, planning, equipment, failure）が共通マスタテーブルにアクセスできるよう、ゲートウェイルーティングを設定します。

## 🎯 目的

1. **公開スキーマの管理テーブル更新**: `public.app_resource_routing` に全アプリの設定を登録
2. **各アプリからのアクセス設定**: 各アプリが `master_data` スキーマの共通マスタにアクセス可能にする

---

## 📊 現在の状況

### ✅ 完了済み
- ✅ 機種マスタ（machine_types）を `public` → `master_data` に移行
- ✅ 機械番号マスタ（machines）を `public` → `master_data` に移行
- ✅ DashboardUI の `app_resource_routing` を更新

### ⚠️ 必要な作業
- ⚠️ Emergency-Client のルーティング設定
- ⚠️ Planning のルーティング設定
- ⚠️ Equipment のルーティング設定
- ⚠️ Failure のルーティング設定

---

## 🚀 実行手順

### ステップ1: 全アプリのルーティング設定を追加

```powershell
# ローカル環境の場合
$env:PGPASSWORD = "Takabeni"
psql -h localhost -U postgres -d webappdb -f setup-all-apps-routing.sql
```

または

```powershell
# Cloud SQLの場合
$env:PGPASSWORD = "パスワード"
psql -h <host> -U <user> -d webappdb -f setup-all-apps-routing.sql
```

このスクリプトは以下を実行します：
- emergency-client 用のルーティング設定
- planning 用のルーティング設定
- equipment 用のルーティング設定
- failure 用のルーティング設定
- 全アプリの設定確認クエリ

### ステップ2: 各アプリケーションの再起動

ルーティングキャッシュをクリアするため、全アプリを再起動してください：

```powershell
# DashboardUI
pm2 restart dashboard-ui

# Emergency-Client
pm2 restart emergency-client

# その他のアプリ（準備ができたら）
pm2 restart planning
pm2 restart equipment
pm2 restart failure
```

### ステップ3: 動作確認

各アプリで以下を確認：

1. **ログイン機能**: `master_data.users` テーブルへのアクセス
2. **マスタデータ表示**: 事業所、保守基地、車両、機種、機械番号
3. **エラーログ**: スキーマ参照エラーがないか確認

---

## 📊 ルーティング設定一覧

### 共通マスタ（全アプリで共有）

| 論理リソース名 | 物理パス | 説明 | 使用アプリ |
|---|---|---|---|
| `users` | `master_data.users` | ユーザー管理 | 全アプリ |
| `managements_offices` | `master_data.managements_offices` | 事業所マスタ | 全アプリ |
| `bases` | `master_data.bases` | 保守基地マスタ | 全アプリ |
| `vehicles` | `master_data.vehicles` | 保守用車マスタ | 全アプリ |
| `machine_types` | `master_data.machine_types` | 機種マスタ | 全アプリ |
| `machines` | `master_data.machines` | 機械番号マスタ | 全アプリ |

### アプリ専用テーブル

#### Emergency-Client
- `emergency_records` → `emergency.emergency_records`

#### Planning
- `schedules` → `operations.schedules`
- `operation_records` → `operations.operation_records`

#### Equipment
- `inspection_records` → `inspections.inspection_records`
- `inspection_types` → `master_data.inspection_types`

#### Failure
- `fault_records` → `maintenance.fault_records`

---

## 🔧 各アプリ側の実装要件

### 必要な設定（各アプリのserver.js）

各サブアプリケーションで以下の実装が必要です：

```javascript
// 1. APP_IDの定義
const APP_ID = 'emergency-client'; // アプリごとに変更

// 2. resolveTablePath関数の実装（DashboardUIと同じ）
async function resolveTablePath(logicalName) {
  const cacheKey = `${APP_ID}:${logicalName}`;
  
  // キャッシュチェック
  const cached = routingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached;
  }

  try {
    // app_resource_routingテーブルから物理パスを取得
    const query = `
      SELECT physical_schema, physical_table
      FROM public.app_resource_routing
      WHERE app_id = $1 AND logical_resource_name = $2 AND is_active = true
      LIMIT 1
    `;
    const result = await pool.query(query, [APP_ID, logicalName]);

    if (result.rows.length > 0) {
      const { physical_schema, physical_table } = result.rows[0];
      const fullPath = `${physical_schema}."${physical_table}"`;
      const resolved = { fullPath, schema: physical_schema, table: physical_table, timestamp: Date.now() };
      
      routingCache.set(cacheKey, resolved);
      return resolved;
    }

    // フォールバック
    const fallback = { 
      fullPath: `master_data."${logicalName}"`, 
      schema: 'master_data', 
      table: logicalName,
      timestamp: Date.now()
    };
    routingCache.set(cacheKey, fallback);
    return fallback;
    
  } catch (err) {
    console.error(`[Gateway] Error resolving ${logicalName}:`, err.message);
    const fallback = { 
      fullPath: `master_data."${logicalName}"`, 
      schema: 'master_data', 
      table: logicalName,
      timestamp: Date.now()
    };
    return fallback;
  }
}

// 3. 動的SELECT/INSERT/UPDATE関数の実装
async function dynamicSelect(logicalTableName, conditions = {}, columns = ['*'], limit = null) {
  const route = await resolveTablePath(logicalTableName);
  // ... (DashboardUIと同じ実装)
}
```

---

## 🔍 トラブルシューティング

### 問題1: アプリがテーブルを見つけられない

**症状**: `relation "public.machines" does not exist` エラー

**原因**: 
- ルーティング設定が未登録
- キャッシュが古い

**対処**:
```sql
-- ルーティング確認
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'emergency-client' AND logical_resource_name = 'machines';

-- なければ setup-all-apps-routing.sql を実行
```

アプリを再起動してキャッシュをクリア。

### 問題2: Emergency-Clientがゲートウェイ方式に対応していない

**症状**: 直接 `public.machines` を参照している

**対処**:
1. Emergency-Clientのserver.jsを確認
2. `resolveTablePath` 関数を実装
3. 直接のテーブル参照を動的関数に置き換え

### 問題3: 外部キー制約エラー

**症状**: `foreign key violation` エラー

**原因**: vehicles テーブルが古い public.machines を参照している

**対処**:
```sql
-- 外部キー制約を確認
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint 
WHERE conname LIKE '%vehicle%machine%';

-- migrate-machine-tables-to-master-data.sql を再実行
```

---

## 📝 チェックリスト

- [ ] `setup-all-apps-routing.sql` を実行
- [ ] 全アプリケーションを再起動
- [ ] DashboardUI で機種・機械番号マスタが正常に動作
- [ ] Emergency-Client でログイン可能
- [ ] Emergency-Client でマスタデータ取得可能
- [ ] Planning（準備できたら）でマスタデータ取得可能
- [ ] Equipment（準備できたら）でマスタデータ取得可能
- [ ] Failure（準備できたら）でマスタデータ取得可能
- [ ] エラーログに schema 参照エラーがないことを確認

---

## 📅 次のステップ

1. **Emergency-Clientの対応確認**
   - 既にゲートウェイ方式を使用しているか確認
   - 必要に応じてコード修正

2. **他のアプリの準備**
   - Planning, Equipment, Failure の開発状況確認
   - ゲートウェイ方式の実装

3. **モニタリング**
   - ルーティングキャッシュのヒット率確認
   - パフォーマンス測定

---

**更新日**: 2026年1月4日  
**対象環境**: 本番環境 (Cloud SQL)  
**データベース**: webappdb
