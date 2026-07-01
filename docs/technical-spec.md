# 技術仕様書 - マルチテナントルーティングシステム

**システム名**: 保守用車運用管理ダッシュボード  
**バージョン**: 2.0  
**最終更新**: 2026-07-01

---

## 目次

1. [システム概要](#システム概要)
2. [データベース設計](#データベース設計)
3. [ルーティング機構](#ルーティング機構)
4. [新規テナント追加手順](#新規テナント追加手順)
5. [キャッシュ機構](#キャッシュ機構)
6. [セキュリティ考察](#セキュリティ考察)
7. [トラブルシューティング](#トラブルシューティング)

---

## システム概要

### アーキテクチャ概念図

```
┌─────────────────────────────────────────────────────────┐
│                     Webブラウザ                          │
│    ユーザー: https://example.com/kintetsu にアクセス    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP Request
                     ↓
┌─────────────────────────────────────────────────────────┐
│               Node.js Express Server                     │
│   ┌──────────────────────────────────────────────┐     │
│   │  テナント識別ミドルウェア                     │     │
│   │  - URLパス解析: /kintetsu → 'kintetsu'      │     │
│   │  - common_db.company_db_routing を検索       │     │
│   │  - キャッシュ確認（TTL: 60秒）                │     │
│   └──────────────────────────────────────────────┘     │
│                      ↓                                   │
│   ┌──────────────────────────────────────────────┐     │
│   │  データベース接続プール管理                   │     │
│   │  - テナント専用プールを動的生成               │     │
│   │  - 接続情報: db_name, storage_bucket_name    │     │
│   └──────────────────────────────────────────────┘     │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────┐
        ↓                         ↓              ↓
┌───────────────┐       ┌───────────────┐  ┌───────────────┐
│   common_db   │       │  kintetsu_db  │  │  daitetsu_db  │
│  （司令塔）   │       │  （近鉄用）   │  │  （大鉄用）   │
│               │       │               │  │               │
│ ルーティング   │       │ 業務データ    │  │ 業務データ    │
│ 管理テーブル   │       │               │  │               │
└───────────────┘       └───────────────┘  └───────────────┘
```

### 主要技術スタック

- **フロントエンド**: Vanilla JavaScript, HTML5, CSS3
- **バックエンド**: Node.js (Express 4.x)
- **データベース**: PostgreSQL 14+
- **クラウドインフラ**: Google Cloud Run, Cloud SQL, Cloud Storage
- **認証**: JWT (JSON Web Token)

---

## データベース設計

### 1. common_db（司令塔データベース）

#### 1.1 company_db_routing テーブル

**目的**: テナントごとのデータベース接続先とストレージバケット情報を管理

```sql
CREATE TABLE IF NOT EXISTS public.company_db_routing (
    company_id VARCHAR(100) PRIMARY KEY,           -- テナント識別子（例: 'kintetsu', 'daitetsu'）
    company_name VARCHAR(200),                     -- 表示名（例: '近鉄グループ'）
    db_name VARCHAR(100) NOT NULL,                 -- 接続先データベース名（例: 'kintetsu_db'）
    storage_bucket_name VARCHAR(200),              -- GCSバケット名（例: 'gcs-bucket-kintetsu'）
    tenant_path VARCHAR(100),                      -- URLパス（例: '/kintetsu', '/daitetsu'）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_company_db_routing_tenant_path 
ON public.company_db_routing(tenant_path);

CREATE INDEX idx_company_db_routing_db_name 
ON public.company_db_routing(db_name);
```

**カラム詳細**:

| カラム名 | データ型 | 説明 | 例 |
|---------|---------|------|---|
| `company_id` | VARCHAR(100) | テナント識別子（一意キー） | `kintetsu` |
| `company_name` | VARCHAR(200) | 会社名・表示名 | `近畿日本鉄道株式会社` |
| `db_name` | VARCHAR(100) | 接続先DB名 | `kintetsu_db` |
| `storage_bucket_name` | VARCHAR(200) | GCSバケット名 | `gcs-bucket-kintetsu` |
| `tenant_path` | VARCHAR(100) | URLパス | `/kintetsu` |

**サンプルデータ**:

```sql
INSERT INTO public.company_db_routing 
(company_id, company_name, db_name, storage_bucket_name, tenant_path) 
VALUES 
('kintetsu', '近畿日本鉄道株式会社', 'kintetsu_db', 'gcs-bucket-kintetsu', '/kintetsu'),
('daitetsu', '大井川鐵道株式会社', 'daitetsu_db', 'gcs-bucket-daitetsu', '/daitetsu');
```

#### 1.2 app_resource_routing テーブル

**目的**: 論理リソース名と物理テーブルのマッピングを管理（アプリケーション層の抽象化）

```sql
CREATE TABLE IF NOT EXISTS public.app_resource_routing (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) DEFAULT 'demo',           -- テナントID（company_idと対応）
    app_id VARCHAR(50) NOT NULL,                    -- アプリケーションID（例: 'dashboard-ui'）
    logical_resource_name VARCHAR(100) NOT NULL,    -- 論理リソース名（例: 'users', 'vehicles'）
    physical_schema VARCHAR(100) NOT NULL,          -- 物理スキーマ名（例: 'master_data'）
    physical_table_name VARCHAR(100) NOT NULL,      -- 物理テーブル名（例: 'users'）
    is_active BOOLEAN DEFAULT true,                 -- 有効フラグ
    description TEXT,                               -- 説明
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, app_id, logical_resource_name)
);

-- インデックス
CREATE INDEX idx_app_resource_routing_lookup 
ON public.app_resource_routing(tenant_id, app_id, logical_resource_name)
WHERE is_active = true;
```

**カラム詳細**:

| カラム名 | データ型 | 説明 | 例 |
|---------|---------|------|---|
| `tenant_id` | VARCHAR(50) | テナントID | `kintetsu` |
| `app_id` | VARCHAR(50) | アプリケーションID | `dashboard-ui` |
| `logical_resource_name` | VARCHAR(100) | コード内で使用する論理名 | `users` |
| `physical_schema` | VARCHAR(100) | 実際のスキーマ名 | `master_data` |
| `physical_table_name` | VARCHAR(100) | 実際のテーブル名 | `users` |
| `is_active` | BOOLEAN | 有効/無効フラグ | `true` |

**サンプルデータ**:

```sql
INSERT INTO public.app_resource_routing 
(tenant_id, app_id, logical_resource_name, physical_schema, physical_table_name, is_active, description)
VALUES 
('kintetsu', 'dashboard-ui', 'users', 'master_data', 'users', true, 'ユーザーマスタ'),
('kintetsu', 'dashboard-ui', 'vehicles', 'master_data', 'vehicles', true, '保守用車マスタ'),
('kintetsu', 'dashboard-ui', 'ai_settings', 'master_data', 'ai_settings', true, 'AI設定'),
('kintetsu', 'dashboard-ui', 'ai_knowledge_data', 'master_data', 'ai_knowledge_data', true, 'AIナレッジデータ');
```

---

## ルーティング機構

### テナント識別フロー

```javascript
// server.js 内の処理フロー

// 1. URLパスからテナントキーを抽出
const tenantKey = req.path.split('/')[1]; // '/kintetsu/api/...' → 'kintetsu'

// 2. common_db.company_db_routing テーブルを検索
const routingRow = await pool.query(`
    SELECT company_id, db_name, storage_bucket_name, tenant_path
    FROM public.company_db_routing
    WHERE company_id = $1 OR tenant_path = $2
`, [tenantKey, `/${tenantKey}`]);

// 3. テナント専用の接続プールを取得または生成
const tenantPool = getOrCreateTenantPool(routingRow.db_name);

// 4. リクエストコンテキストにテナント情報を保存
req.tenantContext = {
    resolvedTenantId: routingRow.company_id,
    dbName: routingRow.db_name,
    storageBucketName: routingRow.storage_bucket_name,
    pool: tenantPool
};
```

### 論理リソース名の解決

```javascript
// db-gateway.js 内の処理

// 1. 論理名から物理パスを解決
const route = await pool.query(`
    SELECT physical_schema, physical_table_name
    FROM public.app_resource_routing
    WHERE tenant_id = $1 
      AND app_id = $2 
      AND logical_resource_name = $3
      AND is_active = true
`, [tenantId, 'dashboard-ui', logicalName]);

// 2. 物理テーブルパスを構築
const fullPath = `${route.physical_schema}."${route.physical_table_name}"`;
// 例: master_data."users"

// 3. SQLクエリを生成
const query = `SELECT * FROM ${fullPath} WHERE id = $1`;
```

---

## 新規テナント追加手順

### 概要

新規テナントを追加する場合、**アプリケーションコードの変更やデプロイは不要**です。
データベースへの登録のみで完結します。

### 手順

#### ステップ1: インフラ準備

1. **PostgreSQLデータベースの作成**

```sql
-- 既存テナントのDBをベースに新規DBを作成（Cloud SQL Consoleで実行）
CREATE DATABASE new_tenant_db WITH TEMPLATE kintetsu_db OWNER postgres;
```

2. **GCSバケットの作成**

```bash
# Google Cloud Console または gcloud コマンドで実行
gcloud storage buckets create gs://gcs-bucket-new-tenant \
    --location=asia-northeast1 \
    --uniform-bucket-level-access
```

#### ステップ2: ルーティング情報の登録

**方法A: SQLを直接実行**

```sql
-- common_db に接続
BEGIN;

-- 1. company_db_routing への登録
INSERT INTO public.company_db_routing 
(company_id, company_name, db_name, storage_bucket_name, tenant_path)
VALUES 
('new_tenant', '新規テナント株式会社', 'new_tenant_db', 'gcs-bucket-new-tenant', '/new_tenant')
ON CONFLICT (company_id) DO UPDATE 
SET 
    db_name = EXCLUDED.db_name,
    storage_bucket_name = EXCLUDED.storage_bucket_name,
    tenant_path = EXCLUDED.tenant_path,
    updated_at = CURRENT_TIMESTAMP;

-- 2. app_resource_routing への登録（アプリケーションリソース定義）
INSERT INTO public.app_resource_routing 
(tenant_id, app_id, logical_resource_name, physical_schema, physical_table_name, is_active)
VALUES 
('new_tenant', 'dashboard-ui', 'users', 'master_data', 'users', true),
('new_tenant', 'dashboard-ui', 'vehicles', 'master_data', 'vehicles', true),
('new_tenant', 'dashboard-ui', 'ai_settings', 'master_data', 'ai_settings', true),
('new_tenant', 'dashboard-ui', 'ai_knowledge_data', 'master_data', 'ai_knowledge_data', true)
ON CONFLICT (tenant_id, app_id, logical_resource_name) DO UPDATE 
SET 
    physical_schema = EXCLUDED.physical_schema,
    physical_table_name = EXCLUDED.physical_table_name,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;
```

**方法B: Node.jsスクリプトを使用**

```javascript
// scripts/tenant-management/add-tenant.js

const { Client } = require('pg');

const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'common_db',
    port: process.env.DB_PORT || 5432,
});

async function addTenant(tenantId, companyName, dbName, bucketName) {
    await client.connect();
    
    try {
        await client.query('BEGIN');
        
        // company_db_routing への登録
        await client.query(`
            INSERT INTO public.company_db_routing 
            (company_id, company_name, db_name, storage_bucket_name, tenant_path)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (company_id) DO UPDATE 
            SET db_name = EXCLUDED.db_name, 
                storage_bucket_name = EXCLUDED.storage_bucket_name,
                updated_at = CURRENT_TIMESTAMP
        `, [tenantId, companyName, dbName, bucketName, `/${tenantId}`]);
        
        // app_resource_routing への登録
        const resources = ['users', 'vehicles', 'ai_settings', 'ai_knowledge_data'];
        for (const resource of resources) {
            await client.query(`
                INSERT INTO public.app_resource_routing 
                (tenant_id, app_id, logical_resource_name, physical_schema, physical_table_name, is_active)
                VALUES ($1, 'dashboard-ui', $2, 'master_data', $2, true)
                ON CONFLICT (tenant_id, app_id, logical_resource_name) DO NOTHING
            `, [tenantId, resource]);
        }
        
        await client.query('COMMIT');
        console.log(`✅ テナント ${tenantId} が正常に登録されました。`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ エラー:', err.message);
    } finally {
        await client.end();
    }
}

// 実行例
addTenant('new_tenant', '新規テナント株式会社', 'new_tenant_db', 'gcs-bucket-new-tenant');
```

#### ステップ3: 反映確認

キャッシュTTL（60秒）経過後、以下のURLでアクセス可能になります：

```
https://your-app.run.app/new_tenant/
```

**確認方法**:

```bash
# ブラウザで以下のエンドポイントにアクセス
https://your-app.run.app/new_tenant/api/tenant-routing

# 期待されるレスポンス
{
  "success": true,
  "route": {
    "company_id": "new_tenant",
    "company_name": "新規テナント株式会社",
    "db_name": "new_tenant_db",
    "storage_bucket_name": "gcs-bucket-new-tenant",
    "tenant_path": "/new_tenant"
  }
}
```

---

## キャッシュ機構

### キャッシュ仕様

| 項目 | 詳細 |
|-----|------|
| **キャッシュ対象** | `company_db_routing` および `app_resource_routing` の検索結果 |
| **TTL（有効期限）** | 60秒 |
| **キャッシュストア** | Node.js プロセス内メモリ（Map オブジェクト） |
| **キャッシュキー** | `tenantId:appId:logicalResourceName` |

### キャッシュクリア

システム再起動なしでルーティング情報を即座に反映させる場合：

```javascript
// server.js または db-gateway.js 内
routingCache.clear();
```

または、以下のAPIエンドポイントを呼び出す（実装されている場合）：

```bash
curl -X POST https://your-app.run.app/api/admin/clear-cache
```

---

## セキュリティ考察

### データ分離

- **テナント間の完全分離**: 各テナントは専用データベースを持ち、SQLレベルで完全に分離
- **誤アクセス防止**: URLパスとルーティングテーブルの二重チェック

### 接続プール管理

- **プールの動的生成**: テナントごとに独立した接続プールを生成し、クロステナントのコネクション汚染を防止
- **最大接続数制限**: デフォルト 10 接続/テナント

### 環境変数の保護

```env
# 本番環境では Google Secret Manager を使用
DB_PASSWORD=<Secret Manager経由で取得>
JWT_SECRET=<Secret Manager経由で取得>
```

---

## トラブルシューティング

### よくある問題

#### 1. テナントが認識されない

**症状**: `/new_tenant` にアクセスしても 404 エラー

**原因**:
- `company_db_routing` テーブルに未登録
- キャッシュが古い（登録直後）

**解決策**:
```sql
-- 登録確認
SELECT * FROM public.company_db_routing WHERE company_id = 'new_tenant';

-- 60秒待機してから再試行
-- または、サーバー再起動でキャッシュクリア
```

#### 2. データベース接続エラー

**症状**: `ECONNREFUSED` または `role "postgres" does not exist`

**原因**:
- `db_name` が存在しない
- 接続認証情報が不正

**解決策**:
```bash
# Cloud SQL インスタンスでDBを確認
gcloud sql databases list --instance=INSTANCE_NAME

# 存在しない場合は作成
gcloud sql databases create new_tenant_db --instance=INSTANCE_NAME
```

#### 3. 論理リソース名が解決できない

**症状**: `Table "master_data.unknown_table" does not exist`

**原因**: `app_resource_routing` に未登録

**解決策**:
```sql
INSERT INTO public.app_resource_routing 
(tenant_id, app_id, logical_resource_name, physical_schema, physical_table_name, is_active)
VALUES 
('tenant_id', 'dashboard-ui', 'unknown_table', 'master_data', 'unknown_table', true);
```

---

## 付録

### 関連ドキュメント

- [README.md](../README.md) - プロジェクト概要
- [ROUTING_OPERATIONS_MANUAL.md](../ROUTING_OPERATIONS_MANUAL.md) - テーブル追加手順
- [init-common-routing.sql](init-common-routing.sql) - common_db 初期化スクリプト

### 用語集

| 用語 | 説明 |
|-----|------|
| **テナント** | システムを利用する各鉄道会社・組織 |
| **司令塔DB** | common_db（ルーティング情報を管理する中央データベース） |
| **論理リソース名** | コード内で使用する抽象的なテーブル名（例: `users`） |
| **物理テーブル名** | 実際のデータベーステーブル名（例: `master_data.users`） |
| **キャッシュTTL** | キャッシュの有効期限（Time To Live） |

---

**文書管理情報**

- 作成日: 2026-07-01
- 作成者: 開発チーム
- レビュー: 技術リーダー
- 次回レビュー予定: 2026-10-01
