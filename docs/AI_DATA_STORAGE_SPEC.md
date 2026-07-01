# AI管理機能 - データ保存とバックアップ仕様

## データ保存先の説明

### 1. AI設定データ（RAG設定、AI支援設定等）

**保存先**: データベース（PostgreSQL）
- テーブル: `master_data.ai_settings`
- 形式: JSONB形式で設定値を保存
- バックアップ: データベースのバックアップに含まれる

#### 保存される設定項目
- **model**: Gemini APIキー、モデル名、温度、最大トークン数
- **rag**: チャンクサイズ、類似度閾値、検索結果数、カスタム指示
- **assist**: 初期プロンプト、会話スタイル、質問フロー
- **storage**: GCSバケット名、フォルダパス、許可ファイルタイプ

```sql
-- 設定データの構造例
{
  "app_id": "common",
  "setting_type": "rag",
  "settings_json": {
    "chunkSize": 500,
    "similarityThreshold": 0.7,
    "maxResults": 5,
    "customInstructions": "..."
  }
}
```

---

### 2. ナレッジデータ（アップロードされたファイル）

#### ファイル本体
**保存先**: Google Cloud Storage (GCS)
- バケット: 環境変数 `GCS_BUCKET_NAME` で指定
- パス: `{gcsKnowledgeFolder}/{timestamp}_{filename}`
- 例: `knowledge-data/1705123456789_manual.pdf`

#### メタデータ
**保存先**: データベース（PostgreSQL）
- テーブル: `master_data.ai_knowledge_data`
- 保存内容:
  - ファイル名、ファイルパス（GCS上の位置）
  - ファイルサイズ、ファイルタイプ
  - アップロード元（local/gcs）
  - 説明、タグ
  - アップロード者、アップロード日時
  - 最終使用日時、使用回数

```sql
-- ナレッジデータのメタデータ構造
CREATE TABLE master_data.ai_knowledge_data (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,              -- GCS上のパス
    file_size_bytes BIGINT,
    file_type VARCHAR(50),
    upload_source VARCHAR(50),            -- 'local' or 'gcs'
    description TEXT,
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0
);
```

---

## 現在の実装状況

### ✅ 実装済み機能

1. **GCSへのファイルアップロード**
   - ローカルファイルをGCSにアップロード
   - メタデータをDBに記録

2. **GCSからのファイルインポート**
   - 既存GCSファイルをメタデータとしてDB登録

3. **データベースへのメタデータ保存**
   - すべてのナレッジデータのメタ情報をDB管理
   - 検索・フィルタリングが可能

4. **統計情報の取得**
   - 総ファイル数、総容量、アクティブファイル数
   - データベースから集計

---

## バックアップ戦略

### 現在の実装

#### データベースバックアップ
データベースに保存されるもの：
- ✅ AI設定（RAG、Assist、Model、Storage）
- ✅ ナレッジデータのメタ情報
- ✅ ファイルの使用履歴、統計情報

**バックアップ方法**:
- PostgreSQLの通常のバックアップ機能を使用
- `pg_dump` または自動バックアップ機能

#### GCSファイルバックアップ
ファイル本体は以下で保護：
- ✅ GCSのバージョニング機能（設定により有効化可能）
- ✅ GCSの自動バックアップ（Google管理）
- ✅ オブジェクトライフサイクル管理（設定により有効化可能）

### 推奨バックアップ設定

```bash
# 1. GCSバケットのバージョニングを有効化
gsutil versioning set on gs://{バケット名}

# 2. PostgreSQLの定期バックアップ
# crontabまたはCloud Schedulerで定期実行
pg_dump -h localhost -U postgres -d webappdb > backup_$(date +%Y%m%d).sql

# 3. GCSオブジェクトのライフサイクル設定（オプション）
# 古いファイルを自動アーカイブ/削除
```

---

## データフロー図

```
┌─────────────────────┐
│  ユーザー           │
└──────┬──────────────┘
       │
       │ ファイルアップロード
       ▼
┌─────────────────────┐
│  Webサーバー        │
│  (server.js)        │
└──────┬──────────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │ Google Cloud     │
│  (メタデータ)│  │ Storage          │
│              │  │ (ファイル本体)   │
└──────────────┘  └──────────────────┘
       │                 │
       │                 │
   DBバックアップ    GCSバージョニング
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ バックアップ │  │ GCSバックアップ  │
│ ストレージ   │  │ (Google管理)     │
└──────────────┘  └──────────────────┘
```

---

## 質問への回答

### ①説明入力枠のサイズ
✅ **対応済み**: すべてのAI管理UI内のtextareaを `cols="40" rows="6"` に変更しました。
- GCS説明欄
- AI初期プロンプト
- RAGシステムプロンプト

手動の拡大機能（ユーザーがドラッグでサイズ変更）はそのまま利用可能です。

---

### ②各項目の保存先

| データ種別 | 保存先 | 詳細 |
|-----------|--------|------|
| **AI設定** | **DB** | JSONB形式で保存 |
| **ナレッジファイル本体** | **GCS** | 指定フォルダに保存 |
| **ナレッジメタデータ** | **DB** | ファイル情報を記録 |

**GCS保存パス**: `gs://{バケット名}/{gcsKnowledgeFolder}/{timestamp}_{filename}`

設定で変更可能：
- バケット名: `master_data.ai_settings` の `storage.gcsBucketName`
- フォルダ: `storage.gcsKnowledgeFolder`（デフォルト: `knowledge-data`）

---

### ③ストレージとDBのバックアップ関係

**現在の実装**:
- ✅ ファイル本体: GCS（プライマリストレージ）
- ✅ メタデータ: DB（検索・管理用）
- ✅ 設定値: DB（JSONB形式）

**バックアップ構成**:
1. **GCS**: ファイル本体は自動的にGoogle管理のバックアップで保護
2. **DB**: メタデータと設定値を定期バックアップ

**データ復元時の動作**:
- DBバックアップから復元 → メタデータと設定が復元
- GCSは常にアクセス可能（Google管理）
- 両方の情報で完全なデータセットを再構築可能

---

## 今後の拡張提案

### 完全バックアップ機能の実装

以下の機能を追加することで、より堅牢なバックアップ体制を構築できます：

#### 1. 定期自動バックアップ
```javascript
// server.jsに追加
app.post('/api/ai/backup/create', requireAdmin, async (req, res) => {
  // 1. DBメタデータをJSON形式でエクスポート
  // 2. GCSファイルリストを取得
  // 3. バックアップマニフェストを作成
  // 4. 別のGCSバケットまたはローカルに保存
});
```

#### 2. バックアップからの復元
```javascript
app.post('/api/ai/backup/restore', requireAdmin, async (req, res) => {
  // 1. バックアップマニフェストを読み込み
  // 2. DBにメタデータを復元
  // 3. GCSファイルの整合性チェック
});
```

#### 3. 差分バックアップ
- 最終バックアップ以降の変更のみをバックアップ
- ストレージ効率の向上

---

## セキュリティ考慮事項

1. **アクセス制御**
   - GCSバケットへのアクセスはサービスアカウント経由
   - 管理者権限が必要（`requireAdmin` ミドルウェア）

2. **データ暗号化**
   - GCSは保存時に自動暗号化
   - DBのJSONBデータも暗号化可能（PostgreSQL設定）

3. **監査ログ**
   - `uploaded_by`, `uploaded_at` で記録
   - `usage_count`, `last_used_at` で追跡

---

## まとめ

現在の実装では：
- ✅ **ファイル本体**: GCSに保存（プライマリ）
- ✅ **メタデータ**: DBに保存（検索・管理用）
- ✅ **設定値**: DBに保存（JSONB形式）
- ✅ GCSとDBの両方がバックアップ対象
- ✅ データ復元時は両方の情報から再構築可能

この構成により、ファイルの実体はGCSで管理し、検索・フィルタリング等の管理機能はDBで実現する、ベストプラクティスに準拠した設計になっています。
