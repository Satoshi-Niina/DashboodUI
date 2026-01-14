# Cloud Run デプロイスクリプト (PowerShell)
# 使い方: .\deploy.ps1

# 設定値を入力してください
$PROJECT_ID = "maint-vehicle-management"
$REGION = "asia-northeast2"
$CLOUD_SQL_INSTANCE = "maint-vehicle-management:asia-northeast2:free-trial-first-project"
$DB_NAME = "webappdb"
$DB_USER = "postgres"
$DB_PASSWORD = "Takabeni"  # 本番環境では必ず変更してください
$JWT_SECRET = "supersecretkey123"  # 本番環境では必ず変更してください

# サービス名
$SERVICE_NAME = "dashboard-ui"

Write-Host "🚀 Cloud Runにデプロイします..." -ForegroundColor Green
Write-Host "プロジェクト: $PROJECT_ID"
Write-Host "リージョン: $REGION"
Write-Host "Cloud SQLインスタンス: $CLOUD_SQL_INSTANCE"

# デプロイ実行
gcloud run deploy $SERVICE_NAME `
  --source . `
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
  --add-cloudsql-instances $CLOUD_SQL_INSTANCE

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ デプロイが完了しました！" -ForegroundColor Green
} else {
    Write-Host "❌ デプロイに失敗しました。" -ForegroundColor Red
}
