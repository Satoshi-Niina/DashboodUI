# AI検索のデータソース - 重要事項

## 質問: AIから検索するナレッジデータは、GCSのデータ？それともDB？

**回答: GCSのデータ（chunksフォルダのJSON）を検索します**

---

## 詳細説明

### 1. データの保存場所と役割

| 保存場所 | 内容 | 用途 |
|---------|------|------|
| **GCS: ai-knowledge/chunks/** | テキストをチャンク化したJSONファイル | **AIが実際に検索・参照するデータ** |
| **GCS: ai-knowledge/metadata/** | RAGメタデータ（ベクトル化用） | 将来の高度な検索用 |
| **GCS: ai-knowledge/manuals/** | 元の文書ファイル（PDF/TXT等） | バックアップ・ダウンロード用 |
| **DB: master_data.ai_knowledge_data** | ファイル情報とGCSパス | 管理・検索インデックス |

### 2. AI検索の仕組み

```
ユーザー質問
    ↓
server.js (AI API)
    ↓
GCSから chunks/*.json を読み込み
    ↓
類似度計算・キーワードマッチング
    ↓
関連チャンクを抽出
    ↓
Gemini AIに文脈として渡す
    ↓
回答生成
```

**重要**: データベースはファイル管理のみで、AI検索時は直接GCSのchunksファイルを参照します。

### 3. 現在の設定（2026年1月19日更新後）

**保存先フォルダ**: `ai-knowledge/` （統一完了）

```
gs://maint-vehicle-management-storage/
└── ai-knowledge/
    ├── images/       # 画像ファイル（png, jpg等）
    ├── manuals/      # 文書ファイル（pdf, txt等）
    ├── originals/    # その他のファイル
    ├── chunks/       # ★AIが検索するチャンクデータ（JSON）
    └── metadata/     # RAGメタデータ（JSON）
```

### 4. データベースの役割

**PostgreSQL (master_data.ai_knowledge_data)** には以下を記録：
- ファイル名、サイズ、タイプ
- **GCSパス（chunks/metadata/original）** ← これが重要！
- アップロード日時、ユーザー、チャンク数
- 処理ステータス（completed/processing）
- 論理削除フラグ（is_active）

**データベースはインデックスとして機能し、実際のテキストデータはGCSに保存**

### 5. 新規ファイルインポート時の処理フロー

1. ファイルアップロード → server.js受信
2. テキスト抽出 → チャンク化（1000文字/200文字オーバーラップ）
3. **GCS: chunks/にJSON保存** ← AIが読むファイル
4. **GCS: metadata/にRAGメタデータ保存**
5. 元ファイルをGCS: manuals/等に保存（オプション）
6. **DB: パス情報を記録**

### 6. まとめ

✅ **AI検索時**: GCSの `chunks/*.json` を直接読み込み  
✅ **データベース**: ファイル管理・パス情報の保存のみ  
✅ **元ファイル**: バックアップ・人間用（AIは使わない）  

**結論**: AIが参照するのは **GCSのchunksフォルダ内のJSONファイル** です。データベースは管理用のメタデータのみ保持します。
