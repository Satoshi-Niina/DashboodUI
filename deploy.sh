#!/bin/bash

# Cloud Run デプロイスクリプト
# 使い方: ./deploy.sh

# 設定値を入力してください
PROJECT_ID="your-project-id"
REGION="asia-northeast1"
CLOUD_SQL_INSTANCE="your-project:asia-northeast1:your-instance"
DB_NAME="common_db"
DB_USER="postgres"
DB_PASSWORD="YOUR_DB_PASSWORD"  # 本番環境では必ず変更してください
JWT_SECRET="YOUR_SECURE_JWT_SECRET"  # 本番環境では必ず変更してください

# サービス名
SERVICE_NAME="dashboard-ui"

echo "🚀 Cloud Runにデプロイします..."
echo "プロジェクト: $PROJECT_ID"
echo "リージョン: $REGION"
echo "Cloud SQLインスタンス: $CLOUD_SQL_INSTANCE"

# デプロイ実行
gcloud run deploy $SERVICE_NAME \
  --source . \
  --project=$PROJECT_ID \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars CLOUD_SQL_INSTANCE=$CLOUD_SQL_INSTANCE \
  --set-env-vars DB_NAME=$DB_NAME \
  --set-env-vars DB_USER=$DB_USER \
  --set-env-vars DB_PASSWORD=$DB_PASSWORD \
  --set-env-vars JWT_SECRET=$JWT_SECRET \
  --set-env-vars CORS_ORIGIN=* \
  --add-cloudsql-instances $CLOUD_SQL_INSTANCE

echo "✅ デプロイが完了しました！"
