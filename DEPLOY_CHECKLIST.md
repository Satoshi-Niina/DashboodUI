# Cloud Run デプロイ前の準備

## 1. Cloud SQL インスタンスの確認

```powershell
# Cloud SQL インスタンス一覧を取得
gcloud sql instances list

# インスタンスの接続名を確認
gcloud sql instances describe YOUR_INSTANCE_NAME --format="value(connectionName)"
# 出力例: free-trial-first-project:asia-northeast1:your-instance-name
```

## 2. Cloud SQL の DATABASE_URL 形式

Cloud Run から Cloud SQL に接続する場合、Unix ソケット形式を使用します：

```
postgresql://USERNAME:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME
```

**例:**
```
postgresql://postgresql:Takabeni@/webappdb?host=/cloudsql/free-trial-first-project:asia-northeast1:postgres-instance
```

**重要**: `localhost:5432` は使用しません。

## 3. GitHub Secrets の設定

以下の Secrets を GitHub リポジトリに追加してください：

### 必須 Secrets

| Secret 名 | 値の例 | 説明 |
|-----------|--------|------|
| `GCP_PROJECT_ID` | `free-trial-first-project` | GCP プロジェクト ID |
| `GCP_SA_KEY` | `{...JSON...}` | サービスアカウントの JSON キー |
| `CLOUD_SQL_INSTANCE` | `free-trial-first-project:asia-northeast1:instance-name` | Cloud SQL 接続名 |
| `DATABASE_URL` | `postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE` | DB 接続文字列（Unix ソケット形式） |
| `JWT_SECRET` | `your-strong-secret-key-here` | JWT 署名用秘密鍵（64文字以上推奨） |
| `CORS_ORIGIN` | `*` | CORS 許可オリジン |
| `APP_URL_EMERGENCY` | `https://emergency-xxx.run.app` | 応急復旧システム URL |
| `APP_URL_PLANNING` | `https://planning-xxx.run.app` | 計画管理システム URL |
| `APP_URL_EQUIPMENT` | `https://equipment-xxx.run.app` | 保守用車管理システム URL |
| `APP_URL_FAILURE` | `https://failure-xxx.run.app` | 故障管理システム URL |

## 4. サービスアカウントの権限確認

Cloud Run から Cloud SQL に接続するには、サービスアカウントに適切な権限が必要です：

```powershell
# サービスアカウントに Cloud SQL Client 権限を付与
gcloud projects add-iam-policy-binding free-trial-first-project `
  --member="serviceAccount:github-actions@free-trial-first-project.iam.gserviceaccount.com" `
  --role="roles/cloudsql.client"

# Cloud Run に使用されるデフォルトのサービスアカウントにも権限を付与
$projectNumber = gcloud projects describe free-trial-first-project --format="value(projectNumber)"
gcloud projects add-iam-policy-binding free-trial-first-project `
  --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
  --role="roles/cloudsql.client"
```

## 5. Cloud SQL のパブリック IP を有効化（オプション）

開発中は、ローカルから Cloud SQL に接続できるようにパブリック IP を有効化することをお勧めします：

```powershell
# パブリック IP を確認
gcloud sql instances describe YOUR_INSTANCE_NAME --format="value(ipAddresses[0].ipAddress)"

# 承認されたネットワークに自分の IP を追加
gcloud sql instances patch YOUR_INSTANCE_NAME `
  --authorized-networks=YOUR_IP_ADDRESS
```

## 6. データベースのセットアップ

ローカルまたは Cloud Shell から SQL を実行：

```powershell
# Cloud SQL Proxy を使用して接続
gcloud sql connect YOUR_INSTANCE_NAME --user=postgresql --database=webappdb

# または直接 psql で接続
psql "postgresql://postgresql:Takabeni@PUBLIC_IP:5432/webappdb"
```

SQL を実行：
```sql
\i database-setup.sql
```

## 7. デプロイの実行

### 方法1: GitHub から自動デプロイ

```powershell
git add .
git commit -m "Configure Cloud SQL connection"
git push origin main
```

### 方法2: 手動デプロイ（GitHub Actions）

1. GitHub リポジトリの **Actions** タブへ
2. **Deploy to Cloud Run** を選択
3. **Run workflow** をクリック

### 方法3: ローカルから直接デプロイ

```powershell
# 認証
gcloud auth login
gcloud config set project free-trial-first-project

# デプロイ
gcloud run deploy dashboard-ui `
  --source . `
  --region asia-northeast1 `
  --platform managed `
  --allow-unauthenticated `
  --add-cloudsql-instances free-trial-first-project:asia-northeast1:YOUR_INSTANCE `
  --set-env-vars "NODE_ENV=production" `
  --set-env-vars "DATABASE_URL=postgresql://postgresql:Takabeni@/webappdb?host=/cloudsql/free-trial-first-project:asia-northeast1:YOUR_INSTANCE" `
  --set-env-vars "JWT_SECRET=your-secret-key" `
  --set-env-vars "CORS_ORIGIN=*" `
  --memory 512Mi `
  --cpu 1 `
  --port 3000
```

## 8. デプロイ後の確認

```powershell
# サービス URL を取得
gcloud run services describe dashboard-ui --region asia-northeast1 --format="value(status.url)"

# ログを確認
gcloud run services logs read dashboard-ui --region asia-northeast1 --limit=50
```

## トラブルシューティング

### エラー: "Connection refused" または "ECONNREFUSED"

**原因**: DATABASE_URL が localhost を指している

**解決策**: DATABASE_URL を Unix ソケット形式に変更
```
postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE
```

### エラー: "Cloud SQL socket does not exist"

**原因**: Cloud SQL インスタンスが接続されていない

**解決策**: `--add-cloudsql-instances` が正しく設定されているか確認

### エラー: "Permission denied"

**原因**: サービスアカウントに Cloud SQL Client 権限がない

**解決策**: 上記のステップ4を実行

### エラー: "Database does not exist"

**原因**: データベースまたはテーブルが作成されていない

**解決策**: database-setup.sql を実行

### データベースに接続できない

```powershell
# Cloud SQL Proxy を使用してローカルでテスト
cloud_sql_proxy -instances=free-trial-first-project:asia-northeast1:YOUR_INSTANCE=tcp:5432

# 別のターミナルで接続
psql postgresql://postgresql:Takabeni@localhost:5432/webappdb
```

## 完了チェックリスト

- [ ] Cloud SQL インスタンスの接続名を確認
- [ ] DATABASE_URL を Unix ソケット形式に変更
- [ ] すべての GitHub Secrets を設定
- [ ] サービスアカウントに Cloud SQL Client 権限を付与
- [ ] database-setup.sql を実行
- [ ] デプロイを実行
- [ ] デプロイされた URL でログインをテスト
- [ ] 管理画面でアプリ URL を設定
- [ ] 各アプリへの遷移をテスト
