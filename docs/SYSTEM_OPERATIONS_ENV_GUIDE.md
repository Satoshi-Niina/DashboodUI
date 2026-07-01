# システム運用UI - セキュリティ監視・メンテナンス機能　環境変数設定ガイド

## 概要
システム運用UIのセキュリティ監視とメンテナンス機能で使用する環境変数の設定方法を説明します。
ローカル環境と本番環境（Cloud Run）で同じ環境変数を使用します。

## 必須環境変数

### 1. Google Cloud プロジェクト設定

```bash
# GCPプロジェクトID
GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management
```

**説明**: Google Cloud Platformのプロジェクトを識別するID。セキュリティ監視（Cloud Logging）、ストレージ（Cloud Storage）、モニタリング（Cloud Monitoring）で使用されます。

**取得方法**: 
- Google Cloud Console → プロジェクト選択 → プロジェクトIDをコピー

---

### 2. Google Cloud Storage バケット設定

```bash
# GCSバケット名
GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage
```

**説明**: システムが使用するCloud Storageバケット名。一時ファイル、ログ、画像などのファイル管理に使用されます。

**取得方法**: 
- Google Cloud Console → Cloud Storage → バケット名を確認

---

### 3. 認証情報

```bash
# サービスアカウントキーファイル（絶対パス）
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/Satoshi Niina/OneDrive/Desktop/system/Emergency-Assistance-google/maint-vehicle-management-40deb3737877.json
```

**説明**: GCPサービスにアクセスするためのサービスアカウントキーファイルのパス。

**取得方法**: 
1. Google Cloud Console → IAM と管理 → サービスアカウント
2. サービスアカウントを選択（または新規作成）
3. 「キー」タブ → 「鍵を追加」→ JSON形式でダウンロード
4. ダウンロードしたJSONファイルのパスを設定

**必要な権限**: 
- Cloud Storage管理者（roles/storage.admin）
- Loggingビューア（roles/logging.viewer）
- Monitoring閲覧者（roles/monitoring.viewer）

---

## 本番環境（Cloud Run）での設定

本番環境では、環境変数はCloud Runのサービス設定で管理します。

### Cloud Runでの設定方法

#### 方法1: Google Cloud Consoleから設定

1. Google Cloud Console → Cloud Run
2. サービスを選択
3. 「新しいリビジョンを編集してデプロイ」
4. 「変数とシークレット」タブ
5. 環境変数を追加：

```
GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management
GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage
```

#### 方法2: gcloudコマンドから設定

```bash
gcloud run services update dashboard-ui \
  --update-env-vars GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management,GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage \
  --region asia-northeast2
```

### 認証について（本番環境）

Cloud Run上では、`GOOGLE_APPLICATION_CREDENTIALS`は不要です。
Cloud Runは自動的にサービスアカウントを使用します。

**デフォルトサービスアカウント**: 
```
<project-number>-compute@developer.gserviceaccount.com
```

**カスタムサービスアカウントを使用する場合**: 

```bash
gcloud run services update dashboard-ui \
  --service-account YOUR_SERVICE_ACCOUNT@maint-vehicle-management.iam.gserviceaccount.com \
  --region asia-northeast2
```

---

## ローカル環境での設定

ローカルでの開発時は、`.env`ファイルに環境変数を設定します。

### .envファイルの設定例

```bash
# ========================================
# Google Cloud Platform設定
# ========================================

# プロジェクトID
GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management

# GCSバケット名
GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage

# サービスアカウントキー（ローカル開発用）
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/Satoshi Niina/OneDrive/Desktop/system/Emergency-Assistance-google/maint-vehicle-management-40deb3737877.json
```

### ローカル環境での確認

サーバー起動時のログで環境変数が正しく読み込まれていることを確認：

```bash
node server.js
```

以下のようなログが表示されればOK：

```
🚀 Starting server...
Environment: development
Cloud SQL Instance: NOT SET
GOOGLE_CLOUD_PROJECT_ID: maint-vehicle-management
GCS Bucket: maint-vehicle-management-storage
```

---

## 機能ごとの環境変数の使用

### セキュリティ監視機能

使用する環境変数：
- `GOOGLE_CLOUD_PROJECT_ID` - Cloud Loggingへのアクセスに使用
- `GOOGLE_APPLICATION_CREDENTIALS` - 認証に使用（ローカルのみ）

取得するデータ：
- 認証失敗ログ
- 不正アクセス試行
- ブロックされたIPアドレス

### メンテナンス機能

#### 一時ファイル削除

使用する環境変数：
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_STORAGE_BUCKET`
- `GOOGLE_APPLICATION_CREDENTIALS` （ローカルのみ）

対象ファイル：
- `gs://maint-vehicle-management-storage/temp/`
- `gs://maint-vehicle-management-storage/tmp/`
- `gs://maint-vehicle-management-storage/uploads/temp/`

#### ログバックアップ

使用する環境変数：
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_STORAGE_BUCKET`
- `GOOGLE_APPLICATION_CREDENTIALS` （ローカルのみ）

バックアップ先：
- `gs://maint-vehicle-management-storage/backups/logs/`

#### 孤立画像削除

使用する環境変数：
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_STORAGE_BUCKET`
- `GOOGLE_APPLICATION_CREDENTIALS` （ローカルのみ）

対象ファイル：
- `gs://maint-vehicle-management-storage/uploads/images/`
- `gs://maint-vehicle-management-storage/chat-images/`

#### ストレージ使用状況

使用する環境変数：
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_STORAGE_BUCKET`
- `GOOGLE_APPLICATION_CREDENTIALS` （ローカルのみ）

---

## トラブルシューティング

### エラー: "GOOGLE_APPLICATION_CREDENTIALS is not set"

**原因**: 環境変数が設定されていない、またはファイルパスが間違っている

**解決方法**:
1. `.env`ファイルに`GOOGLE_APPLICATION_CREDENTIALS`を設定
2. ファイルパスが正しいか確認（絶対パスを使用）
3. JSONファイルが存在するか確認

### エラー: "Permission denied"

**原因**: サービスアカウントに必要な権限がない

**解決方法**:
1. Google Cloud Console → IAM
2. サービスアカウントに以下の権限を付与：
   - Cloud Storage管理者
   - Loggingビューア
   - Monitoring閲覧者

### エラー: "Bucket not found"

**原因**: バケット名が間違っている、またはバケットが存在しない

**解決方法**:
1. Google Cloud Console → Cloud Storageでバケット名を確認
2. `.env`ファイルの`GOOGLE_CLOUD_STORAGE_BUCKET`を修正
3. バケットが存在しない場合は作成：

```bash
gsutil mb -p maint-vehicle-management -c STANDARD -l asia-northeast2 gs://maint-vehicle-management-storage
```

---

## セキュリティのベストプラクティス

1. **サービスアカウントキーの管理**
   - JSONファイルは`.gitignore`に追加
   - 本番環境ではCloud Runのデフォルト認証を使用
   - キーファイルは定期的にローテーション

2. **最小権限の原則**
   - サービスアカウントには必要最小限の権限のみ付与
   - 読み取り専用の操作には読み取り権限のみ

3. **環境変数の暗号化**
   - Cloud Runでは環境変数はSecret Managerの使用を推奨
   - 機密情報は平文で保存しない

---

## まとめ

### ローカル環境に必要な環境変数

```bash
GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management
GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage
GOOGLE_APPLICATION_CREDENTIALS=<JSONファイルの絶対パス>
```

### Cloud Run環境に必要な環境変数

```bash
GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management
GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage
# GOOGLE_APPLICATION_CREDENTIALSは不要（自動認証）
```

### 確認方法

システム運用タブにアクセスして、データが正しく表示されることを確認：
1. 管理画面 → システム運用タブ
2. セキュリティアラートが表示されるか確認
3. ストレージ使用状況が表示されるか確認
4. メンテナンスボタンが動作するか確認
