# データベース正規化・統合計画

## 1. 現状分析

### 重複しているテーブル（public と master_data）

添付画像から判明した構造:

**publicスキーマ（20テーブル）:**
- 主に実運用データ（emergency_flows, fault_history, chat_exports等）

**master_dataスキーマ（10テーブル）:**
- users
- app_config, app_config_history
- bases, base_documents
- chat_history
- inspection_types
- managements_offices
- vehicle_types
- vehicles

### 問題点
1. `public`スキーマに運用データと設定データが混在
2. `machines`と`machine_types`が分離されており、UIでの統合表示が困難
3. エンドポイントがスキーマを明示的に指定していない箇所がある

## 2. 正規化・統合提案

### 2.1 スキーマ構成の整理

```
master_data (マスタデータ)
├── users (ユーザー)
├── managements_offices (事業所)
├── bases (保守基地)
├── vehicles (保守用車)
├── machine_types (機種マスタ) ← 新規
├── machines (機械番号) ← 新規
├── vehicle_types (車両タイプ)
├── inspection_types (点検タイプ)
├── app_config (システム設定)
└── app_config_history (設定変更履歴)

operations (運用データ)
├── emergency_flows (応急復旧フロー)
├── fault_history (故障履歴)
├── fault_history_images (故障画像)
├── chat_exports (チャットエクスポート)
├── support_flows (サポートフロー)
└── support_history (サポート履歴)

maintenance (保守データ)
├── inspection_records (点検記録)
├── maintenance_schedules (保守スケジュール)
└── work_orders (作業指示)
```

### 2.2 保守用車マスタの統合

**現在:**
- `machines` テーブル（機械番号）
- `machine_types` テーブル（機種）
→ 別々のテーブルで管理

**提案:**
- `vehicles` テーブルに外部キーで参照
- UIで結合して表示
- 保存時は正規化された形で各テーブルへ

**テーブル構造:**

```sql
-- 機種マスタ（新規作成）
CREATE TABLE master_data.machine_types (
    type_id SERIAL PRIMARY KEY,
    type_code VARCHAR(20) UNIQUE NOT NULL,
    type_name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    category VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 機械番号マスタ（新規作成）
CREATE TABLE master_data.machines (
    machine_id SERIAL PRIMARY KEY,
    machine_number VARCHAR(50) UNIQUE NOT NULL,
    machine_type_id INTEGER REFERENCES master_data.machine_types(type_id),
    serial_number VARCHAR(100),
    manufacture_date DATE,
    purchase_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    assigned_base_id INTEGER REFERENCES master_data.bases(base_id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 保守用車テーブル（既存を拡張）
CREATE TABLE master_data.vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    vehicle_type_id INTEGER REFERENCES master_data.vehicle_types(type_id),
    machine_id INTEGER REFERENCES master_data.machines(machine_id), -- 搭載機械
    registration_number VARCHAR(50),
    model VARCHAR(50),
    assigned_base_id INTEGER REFERENCES master_data.bases(base_id),
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 3. エンドポイント正規化

### 3.1 現在のエンドポイント

```
/api/users          - ユーザー管理
/api/vehicles       - 保守用車
/api/offices        - 事業所
/api/bases          - 保守基地
/api/config         - システム設定
```

### 3.2 提案する正規化エンドポイント

```
# マスタデータ
GET    /api/master/users
POST   /api/master/users
PUT    /api/master/users/:id
DELETE /api/master/users/:id

GET    /api/master/offices
POST   /api/master/offices
PUT    /api/master/offices/:id
DELETE /api/master/offices/:id

GET    /api/master/bases
POST   /api/master/bases
PUT    /api/master/bases/:id
DELETE /api/master/bases/:id

GET    /api/master/vehicles
POST   /api/master/vehicles
PUT    /api/master/vehicles/:id
DELETE /api/master/vehicles/:id

GET    /api/master/machine-types      # 機種マスタ
POST   /api/master/machine-types
PUT    /api/master/machine-types/:id
DELETE /api/master/machine-types/:id

GET    /api/master/machines            # 機械番号マスタ
POST   /api/master/machines
PUT    /api/master/machines/:id
DELETE /api/master/machines/:id

# 統合ビュー（UIで機種と機械を同時表示）
GET    /api/master/vehicles-full      # vehicles + machines + machine_types の結合データ
GET    /api/master/machines-full      # machines + machine_types の結合データ
```

## 4. UI実装案：機種と機械番号の統合表示

### 4.1 データ取得API

```javascript
// server.js に追加
app.get('/api/master/machines-full', requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        m.machine_id,
        m.machine_number,
        m.serial_number,
        m.manufacture_date,
        m.status,
        m.notes,
        mt.type_id,
        mt.type_code,
        mt.type_name,
        mt.manufacturer,
        mt.category,
        b.base_name,
        m.created_at,
        m.updated_at
      FROM master_data.machines m
      LEFT JOIN master_data.machine_types mt ON m.machine_type_id = mt.type_id
      LEFT JOIN master_data.bases b ON m.assigned_base_id = b.base_id
      ORDER BY m.machine_number
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get machines error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラー' });
  }
});
```

### 4.2 UI表示例

```html
<table class="data-table">
  <thead>
    <tr>
      <th>機械番号</th>
      <th>機種コード</th>
      <th>機種名</th>
      <th>メーカー</th>
      <th>カテゴリ</th>
      <th>シリアル番号</th>
      <th>ステータス</th>
      <th>操作</th>
    </tr>
  </thead>
  <tbody id="machines-table-body">
    <!-- 動的に生成 -->
  </tbody>
</table>
```

### 4.3 データ保存処理

```javascript
async function saveMachine(machineData) {
  // 1. 機種が新規の場合は machine_types に追加
  if (machineData.isNewType) {
    const typeResult = await fetch('/api/master/machine-types', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type_code: machineData.typeCode,
        type_name: machineData.typeName,
        manufacturer: machineData.manufacturer,
        category: machineData.category
      })
    });
    machineData.machine_type_id = (await typeResult.json()).data.type_id;
  }
  
  // 2. 機械番号を machines テーブルに保存
  const result = await fetch('/api/master/machines', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      machine_number: machineData.machineNumber,
      machine_type_id: machineData.machine_type_id,
      serial_number: machineData.serialNumber,
      status: machineData.status,
      notes: machineData.notes
    })
  });
  
  return result.json();
}
```

## 5. 実装ステップ

### フェーズ1: niinaユーザー作成（最優先）
```sql
INSERT INTO master_data.users (username, password, display_name, email, role)
VALUES (
  'niina', 
  '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq', 
  '新名 諭', 
  'niina@example.com', 
  'admin'
);
```

### フェーズ2: 新しいマスタテーブル作成
1. `machine_types` テーブル作成
2. `machines` テーブル作成
3. `vehicles` テーブルに `machine_id` カラム追加

### フェーズ3: エンドポイント追加
1. `/api/master/machine-types` CRUD
2. `/api/master/machines` CRUD
3. `/api/master/machines-full` 統合ビュー

### フェーズ4: UI実装
1. 保守用車マスタ画面に機種・機械番号タブ追加
2. 統合表示・編集フォーム作成
3. 保存処理の実装

### フェーズ5: データ移行
1. publicスキーマのデータを適切なスキーマに移行
2. 重複データの整理

## 6. メリット

✅ データの正規化により整合性向上
✅ UIで関連データを統合表示可能
✅ エンドポイントの命名規則統一
✅ 保守性・拡張性の向上
✅ publicスキーマの肥大化防止
