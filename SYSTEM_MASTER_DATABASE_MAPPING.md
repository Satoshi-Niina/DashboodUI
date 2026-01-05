# システム設定マスタのデータベースマッピング一覧

本番環境でシステム設定画面の各マスタが使用しているCloud SQLのスキーマとテーブルの一覧です。

## 📋 マスタ一覧（サマリー）

| マスタ名 | APIエンドポイント | スキーマ | テーブル | 完全修飾名 |
|---------|------------------|---------|---------|-----------|
| ユーザー管理 | `/api/users` | `master_data` | `users` | `master_data."users"` |
| 事業所マスタ | `/api/offices` | `master_data` | `managements_offices` | `master_data."managements_offices"` |
| 保守基地マスタ | `/api/bases` | `master_data` | `bases` | `master_data."bases"` |
| 保守用車マスタ | `/api/vehicles` | `master_data` | `vehicles` | `master_data."vehicles"` |
| 機種マスタ | `/api/machine-types` | `master_data` | `machine_types` | `master_data."machine_types"` |
| 機械番号マスタ | `/api/machines` | `master_data` | `machines` | `master_data."machines"` |

---

## 📋 マスタ詳細

### 1. ユーザー管理
**画面タブ**: ユーザー管理  
**APIエンドポイント**: `/api/users`  
**論理テーブル名**: `users`  
**物理スキーマ**: `master_data`  
**物理テーブル**: `users`  
**完全修飾名**: `master_data."users"`  

**主要カラム**:
- `id` (SERIAL PRIMARY KEY)
- `username` (VARCHAR(50) UNIQUE)
- `password` (VARCHAR(255))
- `display_name` (VARCHAR(100))
- `email` (VARCHAR(100))
- `role` (VARCHAR(20)) - 'user', 'operation_admin', 'system_admin'
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 2. 事業所マスタ
**画面タブ**: 事業所マスタ  
**APIエンドポイント**: `/api/offices`  
**論理テーブル名**: `managements_offices`  
**物理スキーマ**: `master_data`  
**物理テーブル**: `managements_offices`  
**完全修飾名**: `master_data."managements_offices"`  

**主要カラム**:
- `office_id` (SERIAL PRIMARY KEY)
- `office_code` (VARCHAR(20) UNIQUE)
- `office_name` (VARCHAR(100))
- `office_type` (VARCHAR(50))
- `address` (VARCHAR(200))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 3. 保守基地マスタ
**画面タブ**: 保守基地マスタ  
**APIエンドポイント**: `/api/bases`  
**論理テーブル名**: `bases`  
**物理スキーマ**: `master_data`  
**物理テーブル**: `bases`  
**完全修飾名**: `master_data."bases"`  

**主要カラム**:
- `base_id` (SERIAL PRIMARY KEY)
- `base_code` (VARCHAR(20) UNIQUE)
- `base_name` (VARCHAR(100))
- `office_id` (INTEGER) - FK to managements_offices
- `location` (VARCHAR(200))
- `address` (VARCHAR(200))
- `postal_code` (VARCHAR(20))
- `phone_number` (VARCHAR(20))
- `latitude` (DECIMAL(10, 8))
- `longitude` (DECIMAL(11, 8))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 4. 保守用車マスタ
**画面タブ**: 保守用車マスタ  
**APIエンドポイント**: `/api/vehicles`  
**論理テーブル名**: `vehicles`  
**物理スキーマ**: `master_data`  
**物理テーブル**: `vehicles`  
**完全修飾名**: `master_data."vehicles"`  

**主要カラム**:
- `vehicle_id` (SERIAL PRIMARY KEY)
- `vehicle_number` (VARCHAR(50) UNIQUE)
- `machine_id` (INTEGER) - FK to public.machines
- `office_id` (INTEGER) - FK to managements_offices
- `model` (VARCHAR(50)) - 型式
- `registration_number` (VARCHAR(50)) - 車両登録番号
- `status` (VARCHAR(20)) - 'active', 'maintenance', 'inactive'
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**関連テーブル**:
- `master_data.machines` (機械番号マスタ)
- `master_data.machine_types` (機種マスタ)
- `master_data.managements_offices` (事業所マスタ)

---

### 5. 機種マスタ
**画面表示**: 保守用車マスタ内で登録可能  
**APIエンドポイント**: `/api/machine-types`  
**論理テーブル名**: `machine_types`  
**物理スキーマ**: `master_data`  
**物理テーブル**: `machine_types`  
**完全修飾名**: `master_data."machine_types"`  

**主要カラム**:
- `id` (SERIAL PRIMARY KEY)
- `type_code` (VARCHAR(20) UNIQUE)
- `type_name` (VARCHAR(100))
- `manufacturer` (VARCHAR(100)) - メーカー
- `category` (VARCHAR(50)) - カテゴリ
- `description` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 6. 機械番号マスタ
**画面表示**: 保守用車マスタ内で登録可能  
**APIエンドポイント**: `/api/machines`  
**論理テーブル名**: `machines`  
**物理スキーマ**: `master_data`  
**物理テーブル**: `machines`  
**完全修飾名**: `master_data."machines"`  

**主要カラム**:
- `id` (SERIAL PRIMARY KEY)
- `machine_number` (VARCHAR(50) UNIQUE)
- `machine_type_id` (INTEGER) - FK to public.machine_types
- `serial_number` (VARCHAR(100))
- `manufacture_date` (DATE)
- `purchase_date` (DATE)
- `status` (VARCHAR(20)) - 'active', 'maintenance', 'retired'
- `assigned_base_id` (INTEGER) - FK to master_data.bases
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**関連テーブル**:
- `master_data.machine_types` (機種マスタ)
- `master_data.bases` (保守基地マスタ)

---

## 🔄 ゲートウェイ方式とルーティング

本システムは**ゲートウェイ方式**を採用しており、`public.app_resource_routing` テーブルで論理名と物理パスをマッピングしています。

### ルーティングテーブル
**テーブル名**: `public.app_resource_routing`  
**APP_ID**: `dashboard-ui`

| 論理リソース名 | 物理スキーマ | 物理テーブル | 説明 |
|---|---|---|---|
| users | master_data | users | ユーザー管理 |
| managements_offices | master_data | managements_offices | 事業所マスタ |
| bases | master_data | bases | 保守基地マスタ |
| vehicles | master_data | vehicles | 保守用車マスタ |
| machine_types | master_data | machine_types | 機種マスタ |
| machines | master_data | machines | 機械番号マスタ |

---

## 📊 テーブル関係図

```
master_data.managements_offices (事業所)
    ↓ (office_id)
master_data.bases (保守基地)
    ↓ (base_id)                ↓ (office_id)
master_data.machines (機械番号)   master_data.vehicles (保守用車)
    ↑ (machine_type_id)         ↑ (machine_id)
master_data.machine_types (機種)
```

### 外部キー制約
- `master_data.bases.office_id` → `master_data.managements_offices.office_id`
- `master_data.vehicles.office_id` → `master_data.managements_offices.office_id`
- `master_data.vehicles.machine_id` → `master_data.machines.id`
- `master_data.machines.machine_type_id` → `master_data.machine_types.id`
- `master_data.machines.assigned_base_id` → `master_data.bases.base_id`

---

## 🔧 システム設定関連テーブル

### アプリケーション設定
**テーブル名**: `master_data.app_config`  
**用途**: アプリケーションURLやCORS設定などの動的設定

**主要カラム**:
- `config_key` (VARCHAR(100) PRIMARY KEY)
- `config_value` (TEXT)
- `description` (TEXT)
- `updated_at` (TIMESTAMP)
- `updated_by` (INTEGER)

### 設定変更履歴
**テーブル名**: `master_data.app_config_history`  
**用途**: 設定変更の監査ログ

**主要カラム**:
- `history_id` (SERIAL PRIMARY KEY)
- `config_key` (VARCHAR(100))
- `old_value` (TEXT)
- `new_value` (TEXT)
- `changed_by` (INTEGER)
- `changed_at` (TIMESTAMP)

---

## 📝 注意事項

1. **スキーマの使い分け**
   - `master_data`: すべてのマスタデータを統一管理
   - 機種・機械番号マスタも`master_data`スキーマに統合されています

2. **ゲートウェイ方式のフォールバック**
   - ルーティングが見つからない場合、`master_data` スキーマにフォールバック
   - キャッシュTTL: 5分

3. **セキュリティ**
   - すべてのマスタ管理APIは `requireAdmin` または `authenticateToken` で保護
   - ユーザー管理は `system_admin` または `operation_admin` のみアクセス可能

---

**作成日**: 2026年1月4日  
**対象環境**: 本番環境 (Cloud SQL)  
**データベース**: webappdb
