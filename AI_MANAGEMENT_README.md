# AI管理機能 セットアップガイド

## 概要

このガイドでは、ダッシュボードシステムにAI管理機能（Gemini AI、RAG設定、ナレッジデータ管理）を統合する手順を説明します。

## 実装された機能

### 1. データインポート
- **機械故障情報インポート**: チャット履歴から保存されたJSONファイルをインポート
- **基礎マニュアルファイルインポート**: PDF、TXT、XLSX、DOCX、MD形式のファイルをアップロード
- **GCSストレージからインポート**: Google Cloud Storage上の既存ファイルを直接インポート

### 2. ナレッジ管理
- ストレージ統計情報の表示（総ファイル数、総容量、アクティブファイル数等）
- ナレッジデータ一覧の表示と管理
- データの削除機能

### 3. AI支援調整
- 初期対話メッセージの設定
- 会話スタイルの選択（フランク、ビジネス、技術的）
- 質問フロー（ヒアリングステップ）のカスタマイズ

### 4. RAG詳細設定
- チャンクサイズの調整（200〜2000文字）
- 類似度閾値の設定（0〜1）
- 最大検索結果数の設定
- システムプロンプトのカスタマイズ

## セットアップ手順

### ステップ1: 依存関係のインストール

```powershell
npm install
```

これにより、以下のパッケージがインストールされます：
- `multer`: ファイルアップロード処理
- `@google-cloud/storage`: Google Cloud Storage連携

### ステップ2: データベースのセットアップ

AI管理用のテーブルを作成します：

```powershell
node setup-ai-tables.js
```

このスクリプトは以下のテーブルを作成します：
- `master_data.ai_settings`: AI設定を保存
- `master_data.ai_knowledge_data`: ナレッジデータのメタ情報を管理

### ステップ3: 環境変数の設定

`.env`ファイルに以下の変数を追加してください：

```env
# Google Cloud Storage設定（オプション）
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

### ステップ4: サーバーの起動

```powershell
npm start
```

### ステップ5: 管理画面にアクセス

1. ブラウザで `http://localhost:3000/admin` にアクセス
2. 管理者権限でログイン
3. 「🤖 AI管理」タブをクリック

## UI調整内容

### 画面サイズの変更
- **横幅**: 1620px → 1944px（20%拡大）
- **テキストサイズ**: 全体的に1.2倍に拡大

### レスポンシブ対応
- タブレットやモバイルでも適切に表示されるよう調整済み

## API エンドポイント

### AI設定関連
- `GET /api/ai/settings` - AI設定を取得
- `POST /api/ai/settings` - AI設定を保存

### ナレッジデータ関連
- `GET /api/ai/knowledge` - ナレッジデータ一覧を取得
- `POST /api/ai/knowledge/upload` - ファイルをアップロード
- `DELETE /api/ai/knowledge/:id` - ナレッジデータを削除
- `GET /api/ai/storage-stats` - ストレージ統計を取得

## データベーススキーマ

### ai_settings テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL | 主キー |
| app_id | VARCHAR(50) | アプリケーションID |
| setting_type | VARCHAR(50) | 設定タイプ（model, rag, assist, storage） |
| settings_json | JSONB | 設定値（JSON形式） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

### ai_knowledge_data テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL | 主キー |
| file_name | VARCHAR(255) | ファイル名 |
| file_path | TEXT | GCS上のパス |
| file_size_bytes | BIGINT | ファイルサイズ |
| file_type | VARCHAR(50) | ファイルタイプ |
| upload_source | VARCHAR(50) | アップロード元（local/gcs） |
| description | TEXT | 説明 |
| tags | TEXT[] | タグ |
| is_active | BOOLEAN | 有効フラグ |
| uploaded_by | VARCHAR(100) | アップロードユーザー |
| uploaded_at | TIMESTAMP | アップロード日時 |
| last_used_at | TIMESTAMP | 最終使用日時 |
| usage_count | INTEGER | 使用回数 |

## トラブルシューティング

### ファイルアップロードが失敗する

1. GCSバケット名が正しく設定されているか確認
2. サービスアカウントキーが正しく配置されているか確認
3. バケットへの書き込み権限があるか確認

### AI設定が保存できない

1. データベース接続が正常か確認
2. `master_data.ai_settings`テーブルが存在するか確認
3. ブラウザのコンソールでエラーメッセージを確認

### タブが表示されない

1. キャッシュをクリア（Ctrl + Shift + R）
2. 管理者権限でログインしているか確認
3. ブラウザのコンソールでJavaScriptエラーを確認

## 今後の拡張

- [ ] 実際のGemini API連携
- [ ] RAGベクトル検索の実装
- [ ] ファイル内容の自動解析と埋め込み生成
- [ ] AIチャット機能の統合
- [ ] パフォーマンステスト機能の実装

## サポート

問題が発生した場合は、以下を確認してください：
1. サーバーのログ（コンソール出力）
2. ブラウザの開発者ツール（コンソール、ネットワークタブ）
3. データベースのログ

## 変更履歴

### 2026-01-12
- 初回リリース
- AI管理タブの追加
- データインポート機能の実装
- ナレッジ管理機能の実装
- AI支援調整機能の実装
- RAG詳細設定機能の実装
- UI調整（横幅20%拡大、テキスト1.2倍）
