# GitHub Actions 自動デプロイ設定ガイド

## 概要
このガイドでは、GitHubにpushするだけでCloud Runへ自動デプロイされる設定を行います。

## 前提条件
- GitHubリポジトリが作成済み
- Google Cloud Projectが作成済み
- Cloud SQLインスタンスが作成済み

---

## 1. Cloud SQL インスタンス接続名の確認

```bash
gcloud sql instances describe YOUR_INSTANCE_NAME --format="value(connectionName)"
```

出力例: `my-project:asia-northeast1:webappdb-instance`

この値を控えておいてください。

---

## 2. Google Cloud サービスアカウントの作成

### 2.1 サービスアカウント作成
```bash
# サービスアカウント名を設定
export SA_NAME="github-actions-deployer"
export PROJECT_ID="YOUR_PROJECT_ID"

# サービスアカウント作成
gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID
```

### 2.2 必要な権限を付与
```bash
# Cloud Run管理者権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Cloud SQLクライアント権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# サービスアカウントユーザー権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Storage管理者権限（ビルド時に必要）
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### 2.3 JSONキーファイルを作成
```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com

# キーファイルの内容を表示（これをGitHub Secretsに登録します）
cat key.json
```

**⚠️ 重要: このJSONファイルは機密情報です。安全に保管してください。**

---

## 3. GitHub Secrets の設定

GitHubリポジトリで以下のSecretsを設定します：

1. GitHubリポジトリページを開く
2. **Settings** → **Secrets and variables** → **Actions** を選択
3. **New repository secret** をクリックして、以下を順番に追加：

### 必須Secrets一覧

| Secret名 | 値の例 | 説明 |
|---------|-------|------|
| `GCP_PROJECT_ID` | `my-project-123` | Google CloudのプロジェクトID |
| `GCP_SA_KEY` | `{"type":"service_account",...}` | サービスアカウントのJSONキー全体 |
| `CLOUD_SQL_INSTANCE` | `my-project:asia-northeast1:webappdb` | Cloud SQLインスタンス接続名 |
| `DB_NAME` | `webappdb` | データベース名 |
| `DB_USER` | `postgres` | データベースユーザー名 |
| `DB_PASSWORD` | `your-secure-password` | データベースパスワード |
| `JWT_SECRET` | `your-super-secret-jwt-key` | JWT署名用の秘密鍵（ランダムな長い文字列） |

### Secretsの追加手順

#### GCP_SA_KEY の設定
1. 先ほど作成した `key.json` の内容を**全てコピー**
2. GitHub Secrets の Name に `GCP_SA_KEY` を入力
3. Value に JSONの内容を**そのまま貼り付け**
4. **Add secret** をクリック

#### CLOUD_SQL_INSTANCE の設定
1. Name: `CLOUD_SQL_INSTANCE`
2. Value: `PROJECT_ID:REGION:INSTANCE_NAME` の形式
   - 例: `my-project:asia-northeast1:webappdb-instance`
3. **Add secret** をクリック

他のSecretsも同様に追加してください。

---

## 4. デプロイのテスト

### 4.1 手動実行でテスト

1. GitHubリポジトリの **Actions** タブを開く
2. 左側から **Deploy to Cloud Run** を選択
3. 右上の **Run workflow** をクリック
4. **Run workflow** ボタンをクリックして実行

### 4.2 自動デプロイのテスト

```bash
# ローカルで変更をコミット
git add .
git commit -m "Test GitHub Actions deployment"
git push origin main
```

GitHubの **Actions** タブでデプロイの進行状況を確認できます。

---

## 5. トラブルシューティング

### エラー: "Invalid cloud sql instance names"

**原因**: CLOUD_SQL_INSTANCEの形式が正しくない

**解決策**:
```bash
# 正しい接続名を確認
gcloud sql instances list --format="value(connectionName)"

# GitHub Secretsを更新
```

### エラー: "Permission denied"

**原因**: サービスアカウントに必要な権限がない

**解決策**: 権限を再度付与
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```

### エラー: "Database connection error"

**原因**: DB_PASSWORD や CLOUD_SQL_INSTANCE が間違っている

**解決策**:
1. GitHub Secretsの値を確認
2. Cloud SQLインスタンスが起動しているか確認
3. デプロイ後に `/health` エンドポイントを確認

```bash
# デプロイされたサービスのURLを取得
gcloud run services describe dashboard-ui \
  --region=asia-northeast1 \
  --format='value(status.url)'

# ヘルスチェック
curl https://YOUR_SERVICE_URL/health
```

### ログの確認方法

```bash
# 最新のログを確認
gcloud run services logs read dashboard-ui \
  --region=asia-northeast1 \
  --limit=50

# エラーだけフィルタ
gcloud run services logs read dashboard-ui \
  --region=asia-northeast1 \
  --limit=100 | grep -i error
```

---

## 6. セキュリティのベストプラクティス

### 本番環境では必ず実施すること

1. **JWT_SECRETの変更**
   ```bash
   # ランダムな秘密鍵を生成
   openssl rand -base64 32
   ```

2. **DB_PASSWORDの強化**
   - 最低16文字以上
   - 英数字＋記号を含む

3. **デバッグエンドポイントの削除**
   - server.jsの `/debug/env` エンドポイントを削除
   
4. **サービスアカウントキーの定期ローテーション**
   ```bash
   # 古いキーを削除
   gcloud iam service-accounts keys list \
     --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com
   
   gcloud iam service-accounts keys delete KEY_ID \
     --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com
   ```

---

## 7. デプロイワークフローの説明

現在の設定では以下のタイミングでデプロイが実行されます：

1. **自動デプロイ**: `main` または `master` ブランチにpushした時
2. **手動デプロイ**: GitHub Actionsページから手動実行

デプロイの流れ：
1. ソースコードをチェックアウト
2. Google Cloud認証
3. Cloud SQL接続名の検証
4. Cloud Runへデプロイ
5. ヘルスチェック実行
6. デプロイ結果表示

---

## 8. 成功の確認

デプロイが成功すると、GitHub Actionsのログに以下が表示されます：

```
✅ Deployment completed successfully!
🌐 Service URL: https://dashboard-ui-xxxxx-an.a.run.app
🔍 Health Check: https://dashboard-ui-xxxxx-an.a.run.app/health
🐛 Debug Info: https://dashboard-ui-xxxxx-an.a.run.app/debug/env
```

表示されたURLにアクセスして、ログイン画面が表示されることを確認してください。

---

## 参考リンク

- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
- [Cloud Run デプロイガイド](https://cloud.google.com/run/docs/deploying)
- [Cloud SQL 接続ガイド](https://cloud.google.com/sql/docs/postgres/connect-run)
