# ========================================
# Cloud SQLデバッグ・修正スクリプト
# ログイン問題を解決するための手順
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloud SQL ログイン問題 診断ツール" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# プロジェクトIDを取得
Write-Host "1. プロジェクト情報の取得..." -ForegroundColor Yellow
$PROJECT_ID = gcloud config get-value project
Write-Host "   プロジェクトID: $PROJECT_ID" -ForegroundColor Green
Write-Host ""

# Cloud SQLインスタンスを検索
Write-Host "2. Cloud SQLインスタンスの検索..." -ForegroundColor Yellow
$INSTANCES = gcloud sql instances list --format="value(name)"
if ($INSTANCES) {
    Write-Host "   見つかったインスタンス:" -ForegroundColor Green
    $INSTANCES | ForEach-Object { Write-Host "   - $_" -ForegroundColor Green }
    
    # 最初のインスタンスを選択
    $INSTANCE_NAME = $INSTANCES[0]
    Write-Host ""
    Write-Host "   使用するインスタンス: $INSTANCE_NAME" -ForegroundColor Cyan
} else {
    Write-Host "   ❌ Cloud SQLインスタンスが見つかりません" -ForegroundColor Red
    exit 1
}
Write-Host ""

# インスタンスの詳細情報を取得
Write-Host "3. Cloud SQL接続情報の取得..." -ForegroundColor Yellow
$CONNECTION_NAME = gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)"
$REGION = gcloud sql instances describe $INSTANCE_NAME --format="value(region)"
$STATE = gcloud sql instances describe $INSTANCE_NAME --format="value(state)"

Write-Host "   接続名: $CONNECTION_NAME" -ForegroundColor Green
Write-Host "   リージョン: $REGION" -ForegroundColor Green
Write-Host "   状態: $STATE" -ForegroundColor Green

if ($STATE -ne "RUNNABLE") {
    Write-Host "   ⚠️ インスタンスが起動していません！" -ForegroundColor Red
    Write-Host ""
    Write-Host "   インスタンスを起動しますか? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "y") {
        Write-Host "   インスタンスを起動中..." -ForegroundColor Yellow
        gcloud sql instances patch $INSTANCE_NAME --activation-policy=ALWAYS
    }
}
Write-Host ""

# データベース一覧を取得
Write-Host "4. データベース一覧の確認..." -ForegroundColor Yellow
$DATABASES = gcloud sql databases list --instance=$INSTANCE_NAME --format="value(name)"
Write-Host "   見つかったデータベース:" -ForegroundColor Green
$DATABASES | ForEach-Object { Write-Host "   - $_" -ForegroundColor Green }

# webappdbが存在するか確認
if ($DATABASES -contains "webappdb") {
    Write-Host "   ✓ webappdb が存在します" -ForegroundColor Green
} else {
    Write-Host "   ❌ webappdb が見つかりません" -ForegroundColor Red
    Write-Host "   データベースを作成しますか? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "y") {
        Write-Host "   データベースを作成中..." -ForegroundColor Yellow
        gcloud sql databases create webappdb --instance=$INSTANCE_NAME
    }
}
Write-Host ""

# Cloud Runサービスの確認
Write-Host "5. Cloud Runサービスの確認..." -ForegroundColor Yellow
$SERVICES = gcloud run services list --format="value(metadata.name)"
if ($SERVICES -contains "dashboard-ui") {
    Write-Host "   ✓ dashboard-ui サービスが見つかりました" -ForegroundColor Green
    
    # 環境変数の確認
    Write-Host ""
    Write-Host "6. 環境変数の確認..." -ForegroundColor Yellow
    $SERVICE_INFO = gcloud run services describe dashboard-ui --region=$REGION --format=json | ConvertFrom-Json
    
    $env_vars = @{}
    foreach ($env in $SERVICE_INFO.spec.template.spec.containers[0].env) {
        $env_vars[$env.name] = $env.value
    }
    
    # 重要な環境変数をチェック
    $required_vars = @("NODE_ENV", "CLOUD_SQL_INSTANCE", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET")
    foreach ($var in $required_vars) {
        if ($env_vars.ContainsKey($var)) {
            if ($var -eq "DB_PASSWORD" -or $var -eq "JWT_SECRET") {
                Write-Host "   ✓ $var : ****" -ForegroundColor Green
            } else {
                Write-Host "   ✓ $var : $($env_vars[$var])" -ForegroundColor Green
            }
        } else {
            Write-Host "   ❌ $var : 未設定" -ForegroundColor Red
        }
    }
    
    # Cloud SQL接続の確認
    Write-Host ""
    $cloudsql_instances = $SERVICE_INFO.spec.template.metadata.annotations.'run.googleapis.com/cloudsql-instances'
    if ($cloudsql_instances) {
        Write-Host "   ✓ Cloud SQL接続: $cloudsql_instances" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Cloud SQL接続が設定されていません" -ForegroundColor Red
    }
    
} else {
    Write-Host "   ❌ dashboard-ui サービスが見つかりません" -ForegroundColor Red
}
Write-Host ""

# 修正手順の提示
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "修正手順" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "【ステップ1】Cloud SQLでniinaユーザーを作成/更新" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Cloud SQLコンソールを開く:" -ForegroundColor White
Write-Host "   https://console.cloud.google.com/sql/instances/$INSTANCE_NAME/databases?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. 'クエリ' タブを開く" -ForegroundColor White
Write-Host ""
Write-Host "3. fix-niina-user.sql の内容を実行" -ForegroundColor White
Write-Host "   または以下のコマンドで実行:" -ForegroundColor White
Write-Host "   Get-Content fix-niina-user.sql | gcloud sql connect $INSTANCE_NAME --user=postgres --database=webappdb" -ForegroundColor Cyan
Write-Host ""

Write-Host "【ステップ2】環境変数を設定して再デプロイ" -ForegroundColor Yellow
Write-Host ""
Write-Host "以下のコマンドをコピーして実行してください:" -ForegroundColor White
Write-Host ""
Write-Host "gcloud run deploy dashboard-ui ``" -ForegroundColor Cyan
Write-Host "  --source . ``" -ForegroundColor Cyan
Write-Host "  --region=$REGION ``" -ForegroundColor Cyan
Write-Host "  --platform=managed ``" -ForegroundColor Cyan
Write-Host "  --allow-unauthenticated ``" -ForegroundColor Cyan
Write-Host "  --set-env-vars NODE_ENV=production ``" -ForegroundColor Cyan
Write-Host "  --set-env-vars CLOUD_SQL_INSTANCE=$CONNECTION_NAME ``" -ForegroundColor Cyan
Write-Host "  --set-env-vars DB_NAME=webappdb ``" -ForegroundColor Cyan
Write-Host "  --set-env-vars DB_USER=postgres ``" -ForegroundColor Cyan
Write-Host "  --set-env-vars DB_PASSWORD=YOUR_DB_PASSWORD ``" -ForegroundColor Cyan
Write-Host "  --set-env-vars JWT_SECRET=YOUR_JWT_SECRET ``" -ForegroundColor Cyan
Write-Host "  --set-env-vars CORS_ORIGIN=* ``" -ForegroundColor Cyan
Write-Host "  --add-cloudsql-instances $CONNECTION_NAME" -ForegroundColor Cyan
Write-Host ""
Write-Host "※ YOUR_DB_PASSWORD と YOUR_JWT_SECRET を実際の値に置き換えてください" -ForegroundColor Red
Write-Host ""

Write-Host "【ステップ3】デプロイ後の確認" -ForegroundColor Yellow
Write-Host ""
Write-Host "デプロイが完了したら、以下で動作確認:" -ForegroundColor White
Write-Host ""
Write-Host "# サービスURLを取得" -ForegroundColor White
Write-Host "`$SERVICE_URL = gcloud run services describe dashboard-ui --region=$REGION --format='value(status.url)'" -ForegroundColor Cyan
Write-Host ""
Write-Host "# アクセス確認" -ForegroundColor White
Write-Host "Write-Host `"`$SERVICE_URL`"" -ForegroundColor Cyan
Write-Host "Start-Process `"`$SERVICE_URL`"" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "診断完了" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
