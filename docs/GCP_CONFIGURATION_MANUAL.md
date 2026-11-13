# GCP側 設定手順書・本番運用マニュアル

本書は、「00_DashboodUI」のシステム管理画面（セキュリティ監視・ログ管理・ストレージ管理）を Google Cloud Platform (GCP) 本番環境と正式に連携させるにあたり、GCP コンソールおよび gcloud CLI で実施すべき設定手順をまとめたマニュアルです。

---

## 1. 有効化が必要な GCP API

以下の API を GCP プロジェクト（`maint-vehicle-management`）で有効化してください。

| API 名 | サービス名 | 用途 |
| :--- | :--- | :--- |
| **Cloud Logging API** | `logging.googleapis.com` | アプリケーションログの収集・エラーログおよびセキュリティイベントの検索・解析 |
| **Cloud Monitoring API** | `monitoring.googleapis.com` | バケットストレージ容量メトリクス・各種システムメトリクスの取得 |
| **Cloud Storage API** | `storage.googleapis.com` | 添付ファイル・AIナレッジ・一時ファイルの保管・メタデータ取得 |
| **Cloud Run Admin API** | `run.googleapis.com` | Dashboard UI コンテナサービスのホスティング・実行管理 |
| **Cloud SQL Admin API** | `sqladmin.googleapis.com` | Cloud SQL データベースへの接続（Cloud SQL Auth Proxy 連携） |
| **Secret Manager API** | `secretmanager.googleapis.com` | JWT シークレット、HMAC 共有鍵、DB パスワードの安全な注入 |

### コマンドでの有効化手順
```bash
gcloud services enable \
  logging.googleapis.com \
  monitoring.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  --project=maint-vehicle-management
```

---

## 2. サービスアカウント名と用途

Cloud Run 本番環境では、サービスアカウント秘密鍵 JSON ファイルをコンテナ内に配置せず、Cloud Run に割り当てる**実行サービスアカウント（Runtime Service Account）**と Application Default Credentials (ADC) を使用します。

| サービスアカウント ID | 用途 |
| :--- | :--- |
| `sa-dashboard-ui@maint-vehicle-management.iam.gserviceaccount.com`<br>*(※名称は組織命名規則に合わせて作成)* | 00_DashboodUI (Cloud Run) が Logging / Monitoring / Storage / Cloud SQL にアクセスするための専用実行 ID |

### 作成コマンド例
```bash
gcloud iam service-accounts create sa-dashboard-ui \
  --display-name="Dashboard UI Cloud Run Runtime Service Account" \
  --project=maint-vehicle-management
```

---

## 3. IAMロール・必要権限一覧（最小特権設計）

上記サービスアカウントに対し、必要最小限のロールを付与します。管理者権限（Owner/Editor）は絶対に付与しないでください。

| サービス | ロール名 | ロール ID | 付与目的 |
| :--- | :--- | :--- | :--- |
| **Cloud Logging** | ログ閲覧者 | `roles/logging.viewer` | ログ管理画面でのエラーログ検索、セキュリティ監視での認証失敗イベント集計 |
| **Cloud Logging** | ログ書き込み | `roles/logging.logWriter` | コンテナ標準出力/標準エラー出力からの構造化ログ自動取り込み |
| **Cloud Monitoring** | 閲覧者 | `roles/monitoring.viewer` | ストレージ使用量メトリクス（`total_bytes`, `object_count`）の取得 |
| **Cloud Storage** | ストレージ オブジェクト閲覧者 | `roles/storage.objectViewer`<br>*(またはバケット指定付与)* | バケットメタデータの取得、ファイル一覧走査（削除権限は含まない） |
| **Cloud SQL** | Cloud SQL クライアント | `roles/cloudsql.client` | Cloud SQL インスタンスへのセキュア接続プロキシ権限 |
| **Secret Manager** | シークレット アクセサー | `roles/secretmanager.secretAccessor` | 起動時の認証鍵・DBパスワード取得（※Secret Manager 利用時） |

### ロール付与コマンド例
```bash
PROJECT_ID="maint-vehicle-management"
SA_EMAIL="sa-dashboard-ui@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in \
  roles/logging.viewer \
  roles/logging.logWriter \
  roles/monitoring.viewer \
  roles/storage.objectViewer \
  roles/cloudsql.client \
  roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}"
done
```

---

## 4. Cloud Run に設定する環境変数一覧

Cloud Run サービスの設定（`cloudbuild.yaml` またはコンソール）で注入する環境変数です。秘密情報はプレーンテキストではなく Secret Manager 参照を使用してください。

| 環境変数名 | 推奨値 / 設定例 | 必須区分 | 説明 |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | `production` | 必須 | 本番モード指定（ローカルログ出力抑制、ADC 優先） |
| `PORT` | `8080` | 必須 | Cloud Run コンテナ受信ポート |
| `GOOGLE_CLOUD_PROJECT_ID` | `maint-vehicle-management` | 必須 | GCP プロジェクト ID |
| `GOOGLE_CLOUD_PROJECT` | `maint-vehicle-management` | 必須 | プロジェクト ID 互換名 |
| `GOOGLE_CLOUD_STORAGE_BUCKET`| `maint-vehicle-management-storage` | 必須 | 対象 GCS バケット名 |
| `GCS_BUCKET_NAME` | `maint-vehicle-management-storage` | 必須 | バケット名互換名 |
| `STORAGE_MODE` | `gcs` | 必須 | ストレージモード（GCS 優先） |
| `GCS_KNOWLEDGE_FOLDER` | `ai-knowledge` | 必須 | ナレッジ格納先フォルダプレフィックス |
| `CLOUD_SQL_INSTANCE` | `maint-vehicle-management:asia-northeast2:free-trial-first-project` | 必須 | Cloud SQL 接続インスタンス名（※GCP側で確認が必要） |
| `DATABASE_URL` | *(Secret Manager 参照)* | 必須 | 共通DB接続文字列 |
| `JWT_SECRET` | *(Secret Manager 参照)* | 必須 | セッショントークン検証シークレット |
| `SHARED_SSO_SECRET` | *(Secret Manager 参照)* | 必須 | サブシステムSSO共有シークレット |
| `INTERNAL_GATEWAY_SECRET`| *(Secret Manager 参照)* | 必須 | Gateway内部通信HMAC検証共有鍵 |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(空・未設定)* | **禁止** | 本番では配置せず未設定（ADC が自動認識） |

---

## 5. Cloud Storage バケット名と必要権限

| 項目 | 設定値 / 推奨値 | 備考 |
| :--- | :--- | :--- |
| **バケット名** | `maint-vehicle-management-storage` | GCP側で既存バケット名と一致しているか確認が必要 |
| **ロケーション** | `asia-northeast1` (東京) または `asia-northeast2` (大阪) | アプリケーション実行リージョンと近接させる |
| **デフォルト ストレージ クラス** | `Standard` | 高頻度アクセス用 |
| **アクセス制御** | 均一 (Uniform bucket-level access) | 推奨 |
| **公開アクセス防止** | 有効 (Enforce public access prevention) | 全オブジェクト非公開保護 |
| **ライフサイクル ルール** | `tenants/*/temp/` プレフィックス: 7日経過後に自動削除 | 一時ファイルの長期残留防止（※必要に応じて設定） |

---

## 6. Cloud Logging のログ保持・転送設定

1. **ログバケット保持期間**:
   - デフォルトの `_Default` ログバケット保持期間は 30 日間です。
   - コンプライアンス・監査ログとして長期保管（例: 1年〜数年間）が必要な場合は、GCS バケットへのログシンク（Log Router）を作成してください。
2. **監査ログシンク作成手順（例: GCS への長期アーカイブ）**:
   ```bash
   gcloud logging sinks create sink-dashboard-audit-logs \
     storage.googleapis.com/maint-vehicle-management-storage/audit-logs-archive/ \
     --log-filter='resource.type="cloud_run_revision" AND jsonPayload.event_type="admin_audit"' \
     --project=maint-vehicle-management
   ```

---

## 7. Cloud Monitoring のアラート設定

システムの安定稼働と不正アクセス検知のため、以下のメトリクスアラートを作成することを推奨します。

| アラート名 | 監視対象メトリクス / ログ条件 | 閾値目安 | 対応アクション |
| :--- | :--- | :--- | :--- |
| **連続認証失敗アラート** | ログベースメトリクス: `jsonPayload.event_type = "auth_failure"` | 5分間に 10回 以上 | 総当たり攻撃の疑い調査、手動遮断検討 |
| **HTTP 5xx サーバーエラー急増** | `run.googleapis.com/request_count` (response_code_class = 5xx) | 5分間に 5回 以上 | Cloud SQL 接続・メモリ逼迫調査 |
| **ストレージ容量逼迫警告** | `storage.googleapis.com/storage/total_bytes` | 80 GB 超過 (上限100GB基準) | 不要ファイル整理・クォータ増枠検討 |

通知先（Notification Channel）には、運用担当者のメールアドレスまたは Slack 連携チャンネルを登録してください。

---

## 8. Cloud Run デプロイ設定

`cloudbuild.yaml` に基づく Cloud Run サービス設定の標準値です。

```bash
gcloud run deploy dashboodui \
  --image=gcr.io/maint-vehicle-management/dashboodui:latest \
  --region=asia-northeast1 \
  --platform=managed \
  --service-account=sa-dashboard-ui@maint-vehicle-management.iam.gserviceaccount.com \
  --set-env-vars="NODE_ENV=production,STORAGE_MODE=gcs,GCS_KNOWLEDGE_FOLDER=ai-knowledge,GCS_BUCKET_NAME=maint-vehicle-management-storage,GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage,GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management,GOOGLE_CLOUD_PROJECT=maint-vehicle-management" \
  --memory=2Gi \
  --cpu=1 \
  --timeout=300s \
  --min-instances=1 \
  --max-instances=10 \
  --allow-unauthenticated \
  --project=maint-vehicle-management
```
*(※実際のデプロイは CI/CD または承認プロセスを経て実施してください)*

---

## 9. 接続テストの手順

本番 Cloud Run デプロイ後、管理画面の連携が正常に動作しているか確認する手順です。

### ① サービスアカウント・権限疎通確認
Cloud Run ログに以下のエラーが出力されていないことを確認します。
- `Permission denied` / `403 Forbidden`（Cloud Logging / Monitoring / Storage）
- `ENOENT: no such file or directory`（ローカル秘密鍵ファイル参照エラー）

### ② 管理画面「セキュリティ監視」の確認
1. 管理者アカウントでログイン後、「システム管理」タブを開く。
2. 「🔐 セキュリティ監視」セクションを確認：
   - バッジが「**監視中 (Cloud Logging)**」になっていること。
   - 「今日のアラート」に集計件数が表示され、WAFステータスに「Cloud Armor (WAF) 未設定（推測集計除外）」と明記されていること。
   - 「🔄 更新」ボタンを押してデータが再取得されること。

### ③ 管理画面「ログ管理」の確認
1. 「📜 ログ管理」セクションを確認：
   - バッジに「**XX 件 (Cloud Logging)**」と表示されること。
   - エラーログカードに、発生日時・重大度・サービス名（`dashboard_ui`）・テナント・送信元IP・ルールベース推定原因が表示されていること。
   - 機密情報（パスワード・JWT・トークン）が `[REDACTED]` / `[REDACTED_JWT]` にマスキングされていること。
   - フィルター（重大度・キーワード）およびページング（次へ・前へ）が動作すること。

### ④ 管理画面「ストレージ使用状況」の確認
1. 「💾 ストレージ使用状況」セクションを確認：
   - バッジが「**Monitoring実測**」または「**GCS走査集計**」になっていること。
   - 対象バケット名（`maint-vehicle-management-storage`）と総使用容量・オブジェクト数が正しく表示されていること。
   - 「ストレージ再取得」ボタンを押して、スピナー表示後に正常に完了すること。
