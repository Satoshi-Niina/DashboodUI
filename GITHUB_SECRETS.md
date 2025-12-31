# GitHub Actions 環境変数設定リスト

このドキュメントは、GitHub Actions で Cloud Run へデプロイする際に設定する必要がある環境変数(Secrets)の一覧です。

## 設定方法

1. GitHubリポジトリのページにアクセス
2. **Settings** > **Secrets and variables** > **Actions** に移動
3. **New repository secret** をクリック
4. 以下の各環境変数を設定

---

## 必須環境変数 (GitHub Secrets)

### 1. GCP_PROJECT_ID
- **説明**: GCP プロジェクト ID
- **値の例**: `free-trial-first-project`
- **取得方法**: GCP コンソール > プロジェクト選択画面で確認

### 2. GCP_SA_KEY
- **説明**: GCP サービスアカウントキー (JSON形式)
- **値の形式**: JSON 全体をそのまま貼り付け
- **取得方法**:
  ```bash
  # 1. サービスアカウントを作成
  gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions"

  # 2. 必要な権限を付与
  gcloud projects add-iam-policy-binding free-trial-first-project \
    --member="serviceAccount:github-actions@free-trial-first-project.iam.gserviceaccount.com" \
    --role="roles/run.admin"
  
  gcloud projects add-iam-policy-binding free-trial-first-project \
    --member="serviceAccount:github-actions@free-trial-first-project.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"
  
  gcloud projects add-iam-policy-binding free-trial-first-project \
    --member="serviceAccount:github-actions@free-trial-first-project.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"
  # 4. Cloud SQL Client 権限を付与（重要！）
  gcloud projects add-iam-policy-binding free-trial-first-project `
    --member="serviceAccount:github-actions@free-trial-first-project.iam.gserviceaccount.com" `
    --role="roles/cloudsql.client"
  # 3. キーを生成
  gcloud iam service-accounts keys create key.json \
    --iam-account=github-actions@free-trial-first-project.iam.gserviceaccount.com
  ```

### 3. CLOUD_SQL_INSTANCE
- **説明**: Cloud SQL インスタンスの接続名
- **値の例**: `free-trial-first-project:asia-northeast1:postgres-instance`
- **取得方法**:
  ```bash
  gcloud sql instances describe YOUR_INSTANCE_NAME --format="value(connectionName)"
  ```
- **重要**: この形式 `PROJECT_ID:REGION:INSTANCE_NAME` で設定してください

### 4. DATABASE_URL
- **説明**: PostgreSQL データベース接続文字列（**Cloud Run 用の Unix ソケット形式**）
- **値の例**: `postgresql://postgresql:Takabeni@/webappdb?host=/cloudsql/free-trial-first-project:asia-northeast1:postgres-instance`
- **重要な変更点**:
  - ❌ ローカル形式: `postgresql://postgresql:Takabeni@localhost:5432/webappdb`
  - ✅ Cloud Run 形式: `postgresql://postgresql:Takabeni@/webappdb?host=/cloudsql/PROJECT:REGION:INSTANCE`
- **フォーマット**: `postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME`
- **注意**: 
  - `localhost:5432` を削除
  - `?host=/cloudsql/接続名` を追加
  - 接続名は CLOUD_SQL_INSTANCE と同じ値
6
### 5. JWT_SECRET
- **説明**: JWT トークンの署名に使用する秘密鍵（強力なランダム文字列）
- **値の例**: `super_secret_key_change_this_in_production_xyz123`
- **生成方法**:
  ```bash
  # PowerShell の場合
  -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
  
  # または Node.js で生成
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- **重要**: 本番環境では必ず強力なランダム文字列を使用してください

### 6. CORS_ORIGIN
- **説明**: CORS で許可するオリジン（複数の場合はカンマ区切り）
- **値の例**: 
  - すべて許可: `*`
  - 特定のドメインのみ: `https://yourdomain.com,https://emergency.example.com`
- **推奨**: 本番環境では `*` ではなく、具体的なドメインを指定

### 7. APP_URL_EMERGENCY
- **説明**: 応急復旧支援システムの URL
- **値の例**: `https://emergency-client-u3tejuflja-dt.a.run.app`
- **注意**: 実際にデプロイされた Cloud Run の URL を設定

### 8. APP_URL_PLANNING
- **説明**: 計画・実績管理システムの URL
- **値の例**: `https://planning.example.com`
- **注意**: 実際にデプロイされた URL を設定

### 9. APP_URL_EQUIPMENT
- **説明**: 保守用車管理システムの URL
- **値の例**: `https://equipment.example.com`
- **注意**: 実際にデプロイされた URL を設定

### 10. APP_URL_FAILURE
- **説明**: 機械故障管理システムの URL
- **値の例**: `https://failure.example.com`
- **注意**: 実際にデプロイされた URL を設定

---

## .env.production との対応表

| .env.production の変数名 | GitHub Secret 名 | 説明 |
|-------------------------|------------------|------|
| `NODE_ENV` | (固定値) | production (ワークフロー内で設定) |
| (新規) | `CLOUD_SQL_INSTANCE` | Cloud SQL 接続名 |
| `DATABASE_URL` | `DATABASE_URL` | PostgreSQL 接続文字列（Unix ソケット形式） |
| `PORT` | (固定値) | 3000 (ワークフロー内で設定) |
| `JWT_SECRET` | `JWT_SECRET` | JWT 署名用秘密鍵 |
| `CORS_ORIGIN` | `CORS_ORIGIN` | CORS 許可オリジン |
| `APP_URL_EMERGENCY` | `APP_URL_EMERGENCY` | 応急復旧支援システム URL |
| `APP_URL_PLANNING` | `APP_URL_PLANNING` | 計画・実績管理システム URL |
| `APP_URL_EQUIPMENT` | `APP_URL_EQUIPMENT` | 保守用車管理システム URL |
| `APP_URL_FAILURE` | `APP_URL_FAILURE` | 機械故障管理システム URL |

---

## Artifact Registry の事前準備

GitHub Actions で Docker イメージをプッシュするために、GCP Artifact Registry にリポジトリを作成しておく必要があります:

```bash
# Artifact Registry リポジトリを作成
gcloud artifacts repositories create dashboard-ui \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Dashboard UI Docker images"
```

---

## Cloud SQL への接続設定（推奨）

Cloud Run から Cloud SQL に接続する場合の推奨設定:

1. **Cloud SQL Proxy を使用する方法**:
   - `deploy.yml` に `--add-cloudsql-instances=PROJECT:REGION:INSTANCE` を追加
   - `DATABASE_URL` を `/cloudsql/` パスを使用した形式に変更

2. **プライベート IP を使用する方法**:
   - Cloud Run を VPC コネクタ経由で接続
   - `DATABASE_URL` にプライベート IP を指定

---

## チェックリスト

デプロイ前に以下を確認してください:

- [ ] すべての GitHub Secrets を設定した
- [ ] GCP サービスアカウントに必要な権限を付与した
- [ ] Artifact Registry リポジトリを作成した
- [ ] Cloud SQL の接続設定を確認した
- [ ] JWT_SECRET を強力なランダム文字列に変更した
- [ ] CORS_ORIGIN を本番環境に合わせて設定した
- [ ] 各アプリケーションの URL を正しく設定した

---

## トラブルシューティング

### エラー: "Permission denied"
- サービスアカウントの権限を確認
- 必要なロール: `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`

### エラー: "Repository not found"
- Artifact Registry リポジトリが作成されているか確認
- リポジトリ名とリージョンが正しいか確認

### データベース接続エラー
- `DATABASE_URL` の形式が正しいか確認
- Cloud Run から Cloud SQL への接続設定を確認
- ファイアウォール設定を確認
