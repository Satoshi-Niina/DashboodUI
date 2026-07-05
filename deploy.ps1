# Cloud Run デプロイスクリプト (PowerShell)
# 使い方: .\deploy.ps1

# 設定値を入力してください
$PROJECT_ID = "maint-vehicle-management"
$REGION = "asia-northeast2"
$CLOUD_SQL_INSTANCE = "maint-vehicle-management:asia-northeast2:free-trial-first-project"
$DB_NAME = "common_db"
$DB_USER = "postgres"
$DB_PASSWORD = "Takabeni"  # 本番環境では必ず変更してください
$JWT_SECRET = "I713ZkufHbpsKO81UnrwwrEhd5lyalvA5T36vuUcilNzuWhhCerkXr4EkzBSKNRU0"

# サービス名
$SERVICE_NAME = "dashboard-ui"

# キャッシュバスト用のタイムスタンプを生成
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Deploying to Cloud Run..." -ForegroundColor Green
Write-Host "Project: $PROJECT_ID"
Write-Host "Region: $REGION"
Write-Host "Cloud SQL instance: $CLOUD_SQL_INSTANCE"
Write-Host "Cache bust: $TIMESTAMP" -ForegroundColor Yellow

# Cloud BuildでDockerイメージをビルドしてArtifact Registryへプッシュ
$IMAGE_TAG = "asia-northeast2-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:$TIMESTAMP"

gcloud builds submit `
  --tag $IMAGE_TAG `
  .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Cloud Build failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

# デプロイ実行
gcloud run deploy $SERVICE_NAME `
  --image=$IMAGE_TAG `
  --project=$PROJECT_ID `
  --region=$REGION `
  --platform=managed `
  --allow-unauthenticated `
  --set-env-vars NODE_ENV=production `
  --set-env-vars CLOUD_SQL_INSTANCE=$CLOUD_SQL_INSTANCE `
  --set-env-vars DB_NAME=$DB_NAME `
  --set-env-vars DB_USER=$DB_USER `
  --set-env-vars DB_PASSWORD=$DB_PASSWORD `
  --set-env-vars JWT_SECRET=$JWT_SECRET `
  --set-env-vars CORS_ORIGIN=* `
  --set-env-vars GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage `
  --set-env-vars GCS_BUCKET_NAME=maint-vehicle-management-storage `
  --set-env-vars GOOGLE_GEMINI_API_KEY=AIzaSyCQa-KuQgbUlpJd1GHtNyf1PuOOWQIuF0M `
  --set-env-vars GEMINI_MODEL=gemini-2.0-flash-exp `
  --set-env-vars OPERATION_MANAGEMENT_CLIENT_URL=https://operation-management-client-800711608362.asia-northeast2.run.app `
  --set-env-vars OPERATION_MANAGEMENT_SERVER_URL=https://operation-management-server-800711608369.asia-northeast2.run.app `
  --set-env-vars AUTH_TRANSFER_MODE=url_param `
  --set-env-vars AUTH_TOKEN_PARAM_NAME=auth_token `
  --set-env-vars AUTH_TOKEN_PARAM_ALIASES=token,jwt,sso_token `
  --set-env-vars URL_PLANNING=https://railway-client-800711608362.asia-northeast2.run.app `
  --set-env-vars URL_EQUIPMENT=https://operation-management-client-800711608362.asia-northeast2.run.app `
  --set-env-vars URL_EMERGENCY=https://emergency-client-800711608362.asia-northeast2.run.app `
  --set-env-vars URL_FAILURE=https://machine-failure-client-800711608362.asia-northeast2.run.app `
  --set-env-vars MACHINE_FAILURE_APP_URL=https://machine-failure-client-800711608362.asia-northeast2.run.app `
  --set-env-vars URL_PLANNING_API=https://operation-management-server-800711608369.asia-northeast2.run.app `
  --add-cloudsql-instances $CLOUD_SQL_INSTANCE

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment completed." -ForegroundColor Green
} else {
    Write-Host "Deployment failed." -ForegroundColor Red
}
