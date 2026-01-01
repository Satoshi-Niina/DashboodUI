#!/bin/bash

# Cloud SQL接続情報を取得するスクリプト
# 使い方: ./get-cloudsql-info.sh

echo "=== Cloud SQL インスタンス情報取得 ==="
echo ""

# 現在のプロジェクトIDを取得
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Google Cloudプロジェクトが設定されていません。"
    echo "以下のコマンドでプロジェクトを設定してください："
    echo "gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📦 プロジェクトID: $PROJECT_ID"
echo ""

# Cloud SQLインスタンスをリスト
echo "🔍 Cloud SQLインスタンスを検索中..."
INSTANCES=$(gcloud sql instances list --format="value(name,connectionName,region,databaseVersion)" 2>/dev/null)

if [ -z "$INSTANCES" ]; then
    echo "❌ Cloud SQLインスタンスが見つかりませんでした。"
    echo ""
    echo "Cloud SQLインスタンスを作成してください："
    echo "https://console.cloud.google.com/sql/instances"
    exit 1
fi

echo "✅ 見つかったCloud SQLインスタンス:"
echo ""

# インスタンス情報を配列に格納
declare -a NAMES
declare -a CONNECTION_NAMES
declare -a REGIONS
INDEX=1

while IFS=$'\t' read -r NAME CONN_NAME REGION DB_VERSION; do
    echo "[$INDEX] インスタンス名: $NAME"
    echo "    接続名: $CONN_NAME"
    echo "    リージョン: $REGION"
    echo "    DB: $DB_VERSION"
    echo ""
    
    NAMES[$INDEX]=$NAME
    CONNECTION_NAMES[$INDEX]=$CONN_NAME
    REGIONS[$INDEX]=$REGION
    ((INDEX++))
done <<< "$INSTANCES"

# 使用するインスタンスを選択
TOTAL=$((INDEX - 1))
if [ $TOTAL -eq 1 ]; then
    SELECTED=1
    echo "✅ インスタンスが1つだけなので自動選択しました"
else
    read -p "使用するインスタンスの番号を入力してください (1-$TOTAL): " SELECTED
fi

SELECTED_NAME=${NAMES[$SELECTED]}
SELECTED_CONN=${CONNECTION_NAMES[$SELECTED]}
SELECTED_REGION=${REGIONS[$SELECTED]}

echo ""
echo "=== GitHub Secretsに設定する値 ==="
echo ""
echo "GCP_PROJECT_ID:"
echo "$PROJECT_ID"
echo ""
echo "CLOUD_SQL_INSTANCE:"
echo "$SELECTED_CONN"
echo ""
echo "DB_NAME:"
echo "webappdb"
echo ""
echo "DB_USER:"
echo "postgres"
echo ""
echo "DB_PASSWORD:"
echo "(あなたのCloud SQLのpostgresパスワード)"
echo ""
echo "JWT_SECRET:"
echo "(ランダムな秘密鍵を生成してください)"
echo ""

# JWT秘密鍵を生成
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "生成されたJWT_SECRET（推奨）:"
    echo "$JWT_SECRET"
    echo ""
fi

# デプロイコマンドを生成
echo "=== 手動デプロイコマンド ==="
echo ""
cat << EOF
gcloud run deploy dashboard-ui \\
  --source . \\
  --region=$SELECTED_REGION \\
  --platform=managed \\
  --allow-unauthenticated \\
  --set-env-vars NODE_ENV=production \\
  --set-env-vars CLOUD_SQL_INSTANCE=$SELECTED_CONN \\
  --set-env-vars DB_NAME=webappdb \\
  --set-env-vars DB_USER=postgres \\
  --set-env-vars DB_PASSWORD=YOUR_PASSWORD \\
  --set-env-vars JWT_SECRET=YOUR_SECRET \\
  --add-cloudsql-instances=$SELECTED_CONN
EOF
echo ""
echo "⚠️  YOUR_PASSWORD と YOUR_SECRET を実際の値に置き換えてください"
