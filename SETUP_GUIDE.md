# セットアップガイド - GitHubリポジトリ作成からデプロイまで

このガイドでは、ローカルのプロジェクトを GitHub にアップロードし、Cloud Run にデプロイするまでの手順を説明します。

## 📋 前提条件

- Git がインストールされていること
- GitHub アカウントを持っていること
- GCP プロジェクト `free-trial-first-project` へのアクセス権があること
- PostgreSQL データベース (`webappdb`) が設定されていること

---

## 🚀 ステップ 1: GitHubリポジトリの作成

### 1.1 GitHub でリポジトリを作成

1. [GitHub](https://github.com) にログイン
2. 右上の `+` ボタンをクリック → **New repository** を選択
3. リポジトリ設定:
   - **Repository name**: `dashboard-ui` (任意の名前)
   - **Description**: `統合認証ダッシュボードシステム`
   - **Visibility**: Private または Public
   - **Initialize this repository with**: 何もチェックしない（空のリポジトリを作成）
4. **Create repository** をクリック

### 1.2 ローカルリポジトリの初期化とプッシュ

PowerShell を開き、プロジェクトディレクトリに移動:

```powershell
cd "C:\Users\Satoshi Niina\OneDrive\Desktop\system\DashboodUI"

# Gitリポジトリを初期化
git init

# すべてのファイルを追加
git add .

# 初回コミット
git commit -m "Initial commit: Dashboard UI with authentication"

# メインブランチの名前を設定
git branch -M main

# リモートリポジトリを追加（YOUR_USERNAMEを自分のGitHubユーザー名に変更）
git remote add origin https://github.com/YOUR_USERNAME/dashboard-ui.git

# GitHubにプッシュ
git push -u origin main
```

**注意**: `YOUR_USERNAME` を実際のGitHubユーザー名に置き換えてください。

---

## 🔐 ステップ 2: GCP サービスアカウントの作成

### 2.1 サービスアカウントの作成と権限付与

```powershell
# GCPにログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project free-trial-first-project

# サービスアカウントを作成
gcloud iam service-accounts create github-actions `
  --display-name="GitHub Actions Deployer" `
  --description="Service account for GitHub Actions to deploy to Cloud Run"

# 必要な権限を付与
$serviceAccount = "github-actions@free-trial-first-project.iam.gserviceaccount.com"

# Cloud Run管理者権限
gcloud projects add-iam-policy-binding free-trial-first-project `
  --member="serviceAccount:$serviceAccount" `
  --role="roles/run.admin"

# Artifact Registry書き込み権限
gcloud projects add-iam-policy-binding free-trial-first-project `
  --member="serviceAccount:$serviceAccount" `
  --role="roles/artifactregistry.writer"

# サービスアカウントユーザー権限
gcloud projects add-iam-policy-binding free-trial-first-project `
  --member="serviceAccount:$serviceAccount" `
  --role="roles/iam.serviceAccountUser"

# Cloud Storage管理権限（必要に応じて）
gcloud projects add-iam-policy-binding free-trial-first-project `
  --member="serviceAccount:$serviceAccount" `
  --role="roles/storage.admin"
```

### 2.2 サービスアカウントキーの生成

```powershell
# キーをJSON形式で生成
gcloud iam service-accounts keys create github-actions-key.json `
  --iam-account=github-actions@free-trial-first-project.iam.gserviceaccount.com

# キーの内容を表示（GitHub Secretsに設定するため）
Get-Content github-actions-key.json
```

**重要**: このJSONファイルの内容をコピーしてください。後で GitHub Secrets に設定します。

---

## 📦 ステップ 3: Artifact Registry の準備

```powershell
# Artifact Registryリポジトリを作成
gcloud artifacts repositories create dashboard-ui `
  --repository-format=docker `
  --location=asia-northeast1 `
  --description="Dashboard UI Docker images for Cloud Run"

# リポジトリが作成されたか確認
gcloud artifacts repositories list --location=asia-northeast1
```

---

## 🗄️ ステップ 4: Cloud SQL の準備（必要に応じて）

現在のデータベース接続文字列が `localhost` を指しているため、Cloud Run から接続できるように設定します。

### オプション A: Cloud SQL Proxy を使用

```powershell
# Cloud SQL接続名を確認
gcloud sql instances describe YOUR_INSTANCE_NAME --format="value(connectionName)"

# 出力例: free-trial-first-project:asia-northeast1:postgres-instance
```

この接続名を使用して、環境変数 `DATABASE_URL` を以下の形式に変更:
```
postgresql://postgresql:Takabeni@/webappdb?host=/cloudsql/free-trial-first-project:asia-northeast1:postgres-instance
```

### オプション B: パブリック IP を使用（開発用のみ推奨）

Cloud SQL インスタンスのパブリック IP を使用:
```
postgresql://postgresql:Takabeni@PUBLIC_IP:5432/webappdb
```

**セキュリティ上の注意**: 本番環境では Cloud SQL Proxy またはプライベート IP の使用を推奨します。

---

## 🔑 ステップ 5: GitHub Secrets の設定

1. GitHub リポジトリのページにアクセス
2. **Settings** タブをクリック
3. 左メニューの **Secrets and variables** > **Actions** をクリック
4. **New repository secret** をクリックして、以下の Secrets を追加:

### 必須 Secrets

| Secret 名 | 値 | 説明 |
|-----------|------|------|
| `GCP_PROJECT_ID` | `free-trial-first-project` | GCPプロジェクトID |
| `GCP_SA_KEY` | (生成したJSON全体) | サービスアカウントキー |
| `DATABASE_URL` | `postgresql://postgresql:Takabeni@HOST:5432/webappdb` | DB接続文字列 |
| `JWT_SECRET` | (ランダムな64文字以上の文字列) | JWT署名用秘密鍵 |
| `CORS_ORIGIN` | `*` または `https://yourdomain.com` | CORS許可オリジン |
| `APP_URL_EMERGENCY` | `https://emergency-client-u3tejuflja-dt.a.run.app` | 応急復旧URL |
| `APP_URL_PLANNING` | `https://planning.example.com` | 計画管理URL |
| `APP_URL_EQUIPMENT` | `https://equipment.example.com` | 保守用車URL |
| `APP_URL_FAILURE` | `https://failure.example.com` | 故障管理URL |

### JWT_SECRET の生成

```powershell
# 強力なランダム文字列を生成
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

---

## 🚢 ステップ 6: デプロイの実行

### 6.1 自動デプロイ（GitHub Actions）

`main` ブランチにプッシュすると自動的にデプロイされます:

```powershell
# 変更をコミット
git add .
git commit -m "Configure deployment"
git push origin main
```

### 6.2 デプロイの進行状況を確認

1. GitHub リポジトリのページで **Actions** タブをクリック
2. 実行中のワークフローをクリックして進行状況を確認
3. デプロイが完了すると、Cloud Run の URL が表示されます

### 6.3 手動デプロイ（必要な場合）

GitHub の **Actions** タブから:
1. **Deploy to Cloud Run** ワークフローを選択
2. **Run workflow** ボタンをクリック
3. ブランチ（main）を選択して **Run workflow**

---

## ✅ ステップ 7: デプロイ後の確認

### 7.1 Cloud Run サービスの確認

```powershell
# デプロイされたサービスを確認
gcloud run services list --region=asia-northeast1

# サービスの詳細とURLを確認
gcloud run services describe dashboard-ui --region=asia-northeast1
```

### 7.2 動作確認

1. 表示されたURLにアクセス
2. ログイン画面が表示されることを確認
3. テストユーザーでログインを試行
4. ダッシュボードが表示されることを確認

### 7.3 ログの確認

```powershell
# Cloud Runのログを確認
gcloud run services logs read dashboard-ui --region=asia-northeast1 --limit=50
```

---

## 🛠️ トラブルシューティング

### エラー: "Permission denied"

**原因**: サービスアカウントの権限が不足

**解決策**:
```powershell
# 権限を再確認
gcloud projects get-iam-policy free-trial-first-project --flatten="bindings[].members" --filter="bindings.members:serviceAccount:github-actions@*"
```

### エラー: "Repository not found"

**原因**: Artifact Registry リポジトリが作成されていない

**解決策**:
```powershell
gcloud artifacts repositories create dashboard-ui --repository-format=docker --location=asia-northeast1
```

### データベース接続エラー

**原因**: Cloud Run から Cloud SQL に接続できない

**解決策**:
1. Cloud SQL Proxy を使用するように設定
2. または Cloud Run を VPC コネクタ経由で接続
3. ファイアウォール設定を確認

### デプロイは成功するがアプリが動作しない

**原因**: 環境変数の設定ミス

**確認方法**:
```powershell
# 環境変数を確認
gcloud run services describe dashboard-ui --region=asia-northeast1 --format="value(spec.template.spec.containers[0].env)"
```

---

## 📝 補足情報

### データベーステーブルの準備

usersテーブルが存在しない場合は、以下のSQLで作成:

```sql
-- スキーマの作成（存在しない場合）
CREATE SCHEMA IF NOT EXISTS master_data;

-- usersテーブルの作成
CREATE TABLE IF NOT EXISTS master_data.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- bcryptハッシュ化されたパスワード
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- テストユーザーの挿入（パスワードは 'password123' のbcryptハッシュ）
INSERT INTO master_data.users (username, password, display_name)
VALUES ('admin', '$2b$10$EXAMPLE_BCRYPT_HASH', '管理者');
```

### bcryptハッシュの生成

```javascript
// Node.jsでbcryptハッシュを生成
const bcrypt = require('bcrypt');
bcrypt.hash('your_password', 10).then(hash => console.log(hash));
```

### Cloud Run の設定変更

必要に応じて、Cloud Run の設定を変更:

```powershell
# メモリを増やす
gcloud run services update dashboard-ui --region=asia-northeast1 --memory=1Gi

# 最大インスタンス数を変更
gcloud run services update dashboard-ui --region=asia-northeast1 --max-instances=20

# タイムアウトを変更
gcloud run services update dashboard-ui --region=asia-northeast1 --timeout=300
```

---

## 🎉 完了！

これで、ダッシュボードシステムが GitHub から Cloud Run に自動デプロイされる環境が整いました。

### 次のステップ

1. カスタムドメインの設定（必要な場合）
2. Cloud CDN の有効化（パフォーマンス向上）
3. Cloud Armor の設定（セキュリティ強化）
4. モニタリングとアラートの設定

質問や問題が発生した場合は、GitHub Issues または GITHUB_SECRETS.md を参照してください。
