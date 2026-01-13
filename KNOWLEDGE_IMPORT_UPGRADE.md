# ナレッジデータインポート機能 アップグレード完了

## 📋 実装内容

### 1. UIの改善
#### チェックボックスの大型化 ✅
- **変更前**: 小さくて見づらいチェックボックス
- **変更後**: 3倍サイズ（36px × 36px）の視認性の高いチェックボックス
- **実装場所**: 
  - [admin.html](admin.html#L456-L462) - HTML構造の更新
  - [admin.css](admin.css#L1627-L1667) - 大型チェックボックススタイル追加

**特徴**:
- カスタムデザインで美しい外観
- ホバー時の視覚的フィードバック
- チェック時の明確なアイコン表示（✓マーク）
- テキストも18pxの読みやすいサイズ

---

### 2. GCSへのデータ保存機能 ☁️

#### 処理フロー
ファイルアップロード時に以下の処理を自動実行：

```
アップロード
    ↓
1. 元ファイル保存（オプション）
    → GCS: knowledge-data/original/[timestamp]_[filename]
    ↓
2. テキスト抽出
    → 対応形式: .txt, .md, .json, .js, .py, .java等
    → PDF/DOCX/XLSX: 今後実装予定
    ↓
3. チャンク化処理
    → サイズ: 1000文字/チャンク
    → オーバーラップ: 200文字
    → GCS保存: knowledge-data/chunks/[timestamp]_[filename].json
    ↓
4. RAGメタデータ生成
    → ベクトル化準備データ
    → GCS保存: knowledge-data/rag-metadata/[timestamp]_[filename].json
    ↓
5. CloudDB バックアップ
    → PostgreSQL: master_data.ai_knowledge_data
```

#### GCSフォルダ構造
```
knowledge-data/
├── original/           # 元ファイル（保存オプションON時のみ）
│   └── [timestamp]_[filename]
├── chunks/            # チャンク化データ（JSON）
│   └── [timestamp]_[filename].json
└── rag-metadata/      # RAGメタデータ（JSON）
    └── [timestamp]_[filename].json
```

---

### 3. チャンク化・RAG処理 🔧

#### チャンク化仕様
- **チャンクサイズ**: 1000文字
- **オーバーラップ**: 200文字（文脈を保持するため）
- **出力形式**: JSON
  ```json
  {
    "originalFile": "manual.txt",
    "totalChunks": 15,
    "chunks": [
      {
        "index": 0,
        "text": "チャンク内容...",
        "length": 1000
      }
    ],
    "processedAt": "2026-01-12T10:30:00.000Z"
  }
  ```

#### RAGメタデータ
ベクトル検索やAI処理に使用するメタデータを生成：
```json
{
  "fileId": 1736673000000,
  "fileName": "manual.txt",
  "fileType": "txt",
  "fileSize": 50000,
  "totalChunks": 15,
  "chunkSize": 1000,
  "overlap": 200,
  "vectorizationReady": true,
  "chunkSummaries": [
    {
      "chunkIndex": 0,
      "preview": "最初の100文字...",
      "length": 1000
    }
  ]
}
```

---

### 4. CloudDBバックアップ 💾

#### 新規追加カラム
`master_data.ai_knowledge_data`テーブルに以下のカラムを追加：

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `gcs_original_path` | TEXT | 元ファイルのGCSパス |
| `gcs_chunks_path` | TEXT | チャンクデータのGCSパス |
| `gcs_rag_metadata_path` | TEXT | RAGメタデータのGCSパス |
| `total_chunks` | INTEGER | 生成されたチャンク数 |
| `processing_status` | VARCHAR(50) | 処理状態 |

#### 処理状態
- `pending`: 処理待ち
- `processing`: 処理中
- `completed`: 完了
- `failed`: 失敗

---

## 🚀 セットアップ手順

### 1. データベース更新
```bash
# PostgreSQLに接続してSQLを実行
psql -h [HOST] -U [USER] -d [DATABASE] -f sql/update-ai-knowledge-table.sql
```

または、Node.jsスクリプトで実行：
```bash
node execute-sql.js sql/update-ai-knowledge-table.sql
```

### 2. GCS設定確認
以下の環境変数を`.env`に設定：
```env
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

または、管理画面から設定：
1. 管理画面 → AI管理 → RAG詳細設定
2. GCSバケット名を入力
3. ナレッジフォルダパス: `knowledge-data`（デフォルト）

### 3. サーバー再起動
```bash
npm start
```

---

## 📖 使用方法

### ナレッジデータのインポート

1. **管理画面にアクセス**
   - 設定管理 → AI管理 → データインポート

2. **ファイルを選択**
   - クリックまたはドラッグ&ドロップ
   - 対応形式: PDF, TXT, XLSX, DOCX, MD
   - 最大サイズ: 100MB
   - 複数選択可能

3. **保存オプション**
   - ✅ **元のファイルをアーカイブ保存する**
     - チェック: 元ファイルもGCSに保存
     - 未チェック（推奨）: チャンクとメタデータのみ保存

4. **インポート実行**
   - 📤 ボタンをクリック
   - 自動的に以下を実行：
     - GCSアップロード
     - チャンク化
     - RAGメタデータ生成
     - CloudDBバックアップ

---

## 🔍 確認方法

### GCSの確認
```bash
# GCS Consoleで確認
https://console.cloud.google.com/storage/browser/[YOUR-BUCKET]/knowledge-data

# gcloud CLIで確認
gsutil ls -r gs://[YOUR-BUCKET]/knowledge-data/
```

### データベースの確認
```sql
-- 最新のアップロードを確認
SELECT 
  id, 
  file_name, 
  total_chunks, 
  processing_status,
  gcs_chunks_path,
  uploaded_at
FROM master_data.ai_knowledge_data
ORDER BY uploaded_at DESC
LIMIT 10;
```

### ナレッジ管理画面で確認
1. AI管理 → ナレッジ管理
2. 📊 ストレージ統計 で全体を確認
3. 📚 ナレッジデータ一覧 で詳細を確認

---

## 🎯 今後の拡張予定

### PDF解析
```bash
npm install pdf-parse
```
実装場所: `extractTextFromFile()` 関数

### DOCX解析
```bash
npm install mammoth
```

### XLSX解析
```bash
npm install xlsx
```

### ベクトル化
- Gemini Embedding APIと連携
- ベクトルデータベース統合（Pinecone、Weaviate等）

---

## ⚠️ 注意事項

1. **GCS認証情報**
   - サービスアカウントキーが必要
   - 適切な権限（Storage Object Creator/Viewer）

2. **コスト管理**
   - GCSストレージ料金が発生
   - 元ファイル保存は必要な場合のみ使用

3. **処理時間**
   - 大きなファイルはチャンク化に時間がかかる
   - 100MB制限に注意

4. **データベース容量**
   - メタデータのみをDBに保存
   - 実データはGCSに保存

---

## 📞 トラブルシューティング

### GCSアップロードエラー
```
Error: GCSバケット名が設定されていません
```
→ 環境変数またはAI設定でGCS_BUCKET_NAMEを設定

### 認証エラー
```
Error: Could not load the default credentials
```
→ GOOGLE_APPLICATION_CREDENTIALS環境変数を設定

### データベースエラー
```
Error: column "gcs_chunks_path" does not exist
```
→ `sql/update-ai-knowledge-table.sql` を実行

---

## 📝 変更ファイル一覧

- ✅ [admin.html](admin.html) - チェックボックスUI改善
- ✅ [admin.css](admin.css) - 大型チェックボックススタイル
- ✅ [server.js](server.js) - GCSアップロード、チャンク化、RAG処理
- ✅ [sql/update-ai-knowledge-table.sql](sql/update-ai-knowledge-table.sql) - DB拡張

---

**実装完了日**: 2026年1月12日
**バージョン**: v2.0.0 - Knowledge Import Enhanced
