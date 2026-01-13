# GCS バケット構造ガイド

## 📦 バケット名
`maint-vehicle-management-storage`

---

## 📁 フォルダ構造

### 1. ai-knowledge/ 
**用途**: AIナレッジデータの統合管理  
**新規アップロード先**: ✅ このフォルダを使用

```
ai-knowledge/
├── originals/     元ファイル（チェックON時のみ保存）
├── chunks/        チャンク化されたJSONデータ
├── metadata/      RAGメタデータ（検索・ベクトル化用）
├── vectors/       ベクトルデータ（将来の拡張用）
├── images/        抽出画像（将来の拡張用）
└── manuals/       マニュアルファイル（統合済み）
    ├── images/    マニュアル内の画像
    └── processed/ 処理済みマニュアル
```

**アップロード方法**:
- 管理画面 → AI管理 → データインポート
- 自動的にチャンク化、メタデータ生成、GCS保存

**統合完了**:
- ✅ 既存の `manuals/` フォルダから268ファイルを移行完了

---

### 2. chat-exports/
**用途**: チャット履歴のエクスポートデータ  
**状態**: 既存データ（保持）

```
chat-exports/
├── json/          JSONエクスポートファイル
└── images/        チャット内の画像
```

**特記事項**:
- 12ファイル存在
- トラブルシューティングの履歴として保持

---

### 3. troubleshooting/
**用途**: トラブルシューティングフローデータ  
**状態**: 既存データ（保持）

```
troubleshooting/
├── flows/         診断フローJSON
└── images/        フロー図・画像
```

**特記事項**:
- 8ファイル存在
- AI診断システムで使用される可能性あり

---

## 🔄 データフロー

### 新規ナレッジデータのアップロード

```
ユーザーアップロード
    ↓
[サーバー処理]
    ├─ テキスト抽出
    ├─ チャンク化（1000文字単位）
    └─ メタデータ生成
    ↓
[GCS保存]
    ├─ ai-knowledge/originals/   (オプション)
    ├─ ai-knowledge/chunks/      (必須)
    └─ ai-knowledge/metadata/    (必須)
    ↓
[CloudDB記録]
    └─ master_data.ai_knowledge_data
```

---

## 🗑️ クリーンアップ済み

以下のフォルダは削除・統合されました：
- ❌ `knowledge/` - 重複フォルダ（ほぼ空）→ 削除
- ❌ `temp/` - 一時フォルダ（空）→ 削除
- ✅ `manuals/` - マニュアルフォルダ → `ai-knowledge/manuals/` に統合完了

---

## 📊 統計情報（整理後）

| フォルダ | ファイル数 | 用途 | 状態 |
|---------|----------|------|------|
| ai-knowledge/ | 273 | 統合AIナレッジ | アクティブ ✅ |
| ├─ originals/ | - | 元ファイル | - |
| ├─ chunks/ | - | チャンク化データ | - |
| ├─ metadata/ | - | RAGメタデータ | - |
| ├─ vectors/ | - | ベクトルデータ | - |
| ├─ images/ | - | 抽出画像 | - |
| └─ manuals/ | 268 | マニュアル統合 | 移行完了 ✅ |
| chat-exports/ | 12 | チャット履歴 | 保持 💬 |
| troubleshooting/ | 8 | 診断フロー | 保持 🔧 |

**統合完了**: `manuals/` → `ai-knowledge/manuals/` (268ファイル移行)

---

## ⚙️ 環境設定

`.env` ファイル:
```env
GCS_BUCKET_NAME=maint-vehicle-management-storage
GCS_KNOWLEDGE_FOLDER=ai-knowledge
```

---

## 🚀 使用方法

### ナレッジデータのアップロード

1. 管理画面にログイン
2. **設定管理** → **AI管理** → **データインポート**
3. ファイルを選択（PDF, TXT, XLSX, DOCX, MD対応）
4. （オプション）元ファイル保存をチェック
5. **インポート実行**

### アップロード後の確認

**GCSで確認:**
```
ai-knowledge/
├── chunks/[timestamp]_[filename].json
└── metadata/[timestamp]_[filename].json
```

**データベースで確認:**
```sql
SELECT * FROM master_data.ai_knowledge_data 
ORDER BY uploaded_at DESC;
```

---

## 📝 今後の運用

### 推奨事項
1. **新規データは ai-knowledge/ に統一**
2. **既存データ（manuals/, troubleshooting/）は必要に応じて移行**
3. **定期的に未使用データをアーカイブ**

### 移行が必要な場合
既存の `manuals/` データを `ai-knowledge/` に移行する場合：
1. 管理画面から再アップロード
2. または移行スクリプトを実行

---

**最終更新**: 2026年1月12日  
**バージョン**: v2.0 - Unified Structure
