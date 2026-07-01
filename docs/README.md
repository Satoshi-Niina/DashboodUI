# 保守用車運用管理ダッシュボード

統合管理システムのメインダッシュボードアプリケーション

---

## 🎯 プロジェクト概要

このシステムは、複数の鉄道会社（テナント）が共通のプラットフォームで保守用車両を管理できる**マルチテナント対応ダッシュボードUI**です。

### 主要機能

- 🚂 **保守用車両管理**: 車両情報、検修スケジュール、基地情報の統合管理
- 👥 **ユーザー管理**: 事業所ごとの権限制御とアクセス管理
- 🤖 **AI検索機能**: ナレッジベースを活用したインテリジェント検索
- 📊 **ダッシュボード**: リアルタイムでの車両運用状況の可視化

### マルチテナント対応

各テナント（鉄道会社）は以下を独立して保有します：
- **専用データベース**: テナントごとの完全データ分離
- **専用ストレージ**: Google Cloud Storage バケット
- **独自URL**: /テナント名 パスでアクセス（例: /kintetsu, /daitetsu）

**特徴**: アプリケーションの再デプロイなしで、データ登録のみで新規テナントを追加できます。

---

## 🏗️ システムアーキテクチャ

### データ駆動型ルーティング

```
┌─────────────────────────────────────────┐
│     common_db（司令塔データベース）       │
│  ┌─────────────────────────────────┐   │
│  │  company_db_routing テーブル    │   │
│  │  - テナント別DB接続情報         │   │
│  │  - ストレージバケット情報       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓ ルーティング情報を参照
┌─────────────────────────────────────────┐
│   アプリケーションサーバー (Node.js)     │
│   - URLパスからテナントを自動識別       │
│   - 動的にDB接続を切り替え               │
│   - キャッシュ機構（TTL: 1分）           │
└─────────────────────────────────────────┘
              ↓ テナント専用DBへ接続
┌──────────┬──────────┬──────────┐
│kintetsu_db│daitetsu_db│ ...     │
│（近鉄）   │（大鉄）   │（他社）  │
└──────────┴──────────┴──────────┘
```

---

## 🚀 クイックスタート

### 前提条件

- Node.js (v16以上推奨)
- PostgreSQL (v14以上)
- Google Cloud SDK（本番環境のみ）

### ローカル開発環境

#### 1. 環境変数の設定

```bash
cp .env.example .env
```

.env ファイルに以下の環境変数を設定：

```env
# データベース接続（司令塔DB）
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=common_db

# セキュリティ
JWT_SECRET=your_secure_random_string

# テナントルーティング（オプション）
TENANT_ROUTING_DB_NAME=common_db
```

#### 2. 依存関係のインストール

```bash
npm install
```

#### 3. アプリケーション起動

```bash
npm start
```

ブラウザで http://localhost:3000 にアクセス

**デフォルトログイン情報**:
- ユーザー名: dmin
- パスワード: dmin123

---

## 📚 詳細ドキュメント

- **[技術仕様書](docs/technical-spec.md)** - システムの心臓部の詳細設計
- **[ルーティング運用マニュアル](ROUTING_OPERATIONS_MANUAL.md)** - テーブル追加・移動手順
- **[テナント管理ガイド](SYSTEM_OPERATIONS_ENV_GUIDE.md)** - 新規テナント追加方法

---

## 🔧 主要ファイル構成

```
├── server.js                   # メインサーバー（マルチテナントルーティング実装）
├── db-gateway.js               # 動的テーブルルーティングモジュール
├── tenant-context.js           # フロントエンド：テナント検出ロジック
├── shared-db-config.js         # 統一DB接続管理
├── index.html                  # メインダッシュボード
├── login.html                  # ログイン画面
├── admin.html                  # 管理者画面（AI設定等）
├── docs/                       # 技術ドキュメント・SQLバックアップ
│   ├── technical-spec.md       # 技術仕様書
│   └── init-common-routing.sql # common_db 初期化スクリプト
└── scripts/                    # 運用スクリプト
    └── tenant-management/      # テナント管理用スクリプト
```

---

## 🌐 本番環境デプロイ

### Cloud Run へのデプロイ

```bash
# Google Cloud プロジェクトの設定
gcloud config set project YOUR_PROJECT_ID

# デプロイ実行
gcloud run deploy dashboard-ui \
  --source . \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE \
  --set-env-vars DB_NAME=common_db \
  --add-cloudsql-instances PROJECT:REGION:INSTANCE
```

詳細は [SYSTEM_OPERATIONS_ENV_GUIDE.md](SYSTEM_OPERATIONS_ENV_GUIDE.md) を参照してください。

---

## 🛠️ 開発ガイドライン

### 新しいテーブルを追加する場合

1. 物理テーブルをDBに作成
2. pp_resource_routing テーブルに論理リソース名を登録
3. コード内では論理名でアクセス（例: users, ehicles）

詳細: [ROUTING_OPERATIONS_MANUAL.md](ROUTING_OPERATIONS_MANUAL.md)

### 新しいテナントを追加する場合

1. テナント専用のDBとGCSバケットを作成
2. common_db.company_db_routing にルーティング情報を登録
3. 1分後に自動反映（キャッシュTTL）

詳細: [docs/technical-spec.md](docs/technical-spec.md) の「新規テナント追加手順」を参照

---

## 📝 ライセンス

社内システム - 無断転載禁止

---

## 📞 サポート

技術的な質問や問題が発生した場合は、開発チームまでお問い合わせください。
