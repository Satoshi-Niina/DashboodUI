# ========================================
# Cloud Run ログ診断スクリプト
# ログインエラーの原因を特定します
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloud Run ログイン問題診断" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# プロジェクトとリージョン
$PROJECT_ID = gcloud config get-value project
$REGION = "asia-northeast1"
$SERVICE_NAME = "dashboard-ui"

Write-Host "プロジェクト: $PROJECT_ID" -ForegroundColor Gray
Write-Host "サービス: $SERVICE_NAME" -ForegroundColor Gray
Write-Host ""

# サービスURLを取得
Write-Host "[1/4] サービスURLの取得..." -ForegroundColor Yellow
try {
    $SERVICE_URL = gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>$null
    if ($SERVICE_URL) {
        Write-Host "✓ URL: $SERVICE_URL" -ForegroundColor Green
    } else {
        Write-Host "❌ dashboard-uiサービスが見つかりません" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ サービスの取得に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 最新のログを取得
Write-Host "[2/4] 最新のログを取得中..." -ForegroundColor Yellow
$logs = gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=100 2>$null

if (-not $logs) {
    Write-Host "⚠️ ログが取得できませんでした" -ForegroundColor Yellow
} else {
    Write-Host "✓ ログを取得しました（最新100件）" -ForegroundColor Green
}
Write-Host ""

# ログをフィルタリング
Write-Host "[3/4] エラーの分析..." -ForegroundColor Yellow
Write-Host ""

# データベース接続エラー
$dbErrors = $logs | Select-String -Pattern "Database|database|connection|Connection|ECONNREFUSED" -CaseSensitive:$false
if ($dbErrors) {
    Write-Host "🔴 データベース接続エラーが検出されました:" -ForegroundColor Red
    $dbErrors | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host ""
}

# ログイン関連エラー
$loginErrors = $logs | Select-String -Pattern "Login error|login|authentication|password" -CaseSensitive:$false
if ($loginErrors) {
    Write-Host "🔴 ログイン関連のログ:" -ForegroundColor Yellow
    $loginErrors | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
    Write-Host ""
}

# 環境変数エラー
$envErrors = $logs | Select-String -Pattern "JWT_SECRET|CLOUD_SQL|DB_PASSWORD|undefined" -CaseSensitive:$false
if ($envErrors) {
    Write-Host "🔴 環境変数関連のエラー:" -ForegroundColor Red
    $envErrors | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host ""
}

Write-Host "[4/4] 実際のログインテスト..." -ForegroundColor Yellow
Write-Host ""

# ログインAPIをテスト
$loginData = @{
    username = "niina"
    password = "G&896845"
} | ConvertTo-Json

Write-Host "POST $SERVICE_URL/api/login" -ForegroundColor Cyan
Write-Host "Body: $loginData" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "$SERVICE_URL/api/login" -Method POST -Body $loginData -ContentType "application/json" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "✅ ログイン成功！" -ForegroundColor Green
        Write-Host ""
        Write-Host "レスポンス:" -ForegroundColor Cyan
        Write-Host "  ユーザー名: $($result.user.username)" -ForegroundColor White
        Write-Host "  表示名: $($result.user.displayName)" -ForegroundColor White
        Write-Host "  ロール: $($result.user.role)" -ForegroundColor White
        Write-Host "  トークン: $($result.token.Substring(0, 20))..." -ForegroundColor White
        Write-Host ""
        Write-Host "問題は解決しています！ブラウザでログインしてください。" -ForegroundColor Green
    } else {
        Write-Host "❌ ログイン失敗" -ForegroundColor Red
        Write-Host "メッセージ: $($result.message)" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ ログインAPIエラー (HTTP $statusCode)" -ForegroundColor Red
    
    try {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "エラーメッセージ: $($errorResponse.message)" -ForegroundColor Yellow
    } catch {
        Write-Host "エラー詳細: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "考えられる原因:" -ForegroundColor Yellow
    
    if ($statusCode -eq 500) {
        Write-Host "  ・データベース接続エラー" -ForegroundColor White
        Write-Host "  ・環境変数の設定ミス（CLOUD_SQL_INSTANCE, DB_PASSWORD等）" -ForegroundColor White
        Write-Host "  ・Cloud SQLインスタンスが停止している" -ForegroundColor White
    } elseif ($statusCode -eq 401) {
        Write-Host "  ・パスワードハッシュが正しくない" -ForegroundColor White
        Write-Host "  ・niinaユーザーが存在しない" -ForegroundColor White
    } elseif ($statusCode -eq 404) {
        Write-Host "  ・APIエンドポイントが存在しない" -ForegroundColor White
        Write-Host "  ・デプロイに失敗している可能性" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "詳細なログ分析" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 最新10件のログを表示
Write-Host "最新10件のログ:" -ForegroundColor Yellow
$logs | Select-Object -First 10 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "次のステップ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Cloud SQLでパスワードハッシュを確認:" -ForegroundColor Yellow
Write-Host "   Cloud Console → SQL → クエリ タブ" -ForegroundColor White
Write-Host ""
Write-Host "   SELECT username, LEFT(password, 30) as hash_preview, role" -ForegroundColor Cyan
Write-Host "   FROM master_data.users WHERE username = 'niina';" -ForegroundColor Cyan
Write-Host ""
Write-Host "   期待されるハッシュ（最初の30文字）:" -ForegroundColor White
Write-Host "   $2b$10$BiKD0cFkIZfpxPlfwu6wTe" -ForegroundColor Green
Write-Host ""

Write-Host "2. パスワードハッシュが違う場合、更新:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   UPDATE master_data.users" -ForegroundColor Cyan
Write-Host "   SET password = '\$2b\$10\$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq'" -ForegroundColor Cyan
Write-Host "   WHERE username = 'niina';" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. GitHubシークレットを確認:" -ForegroundColor Yellow
Write-Host "   https://github.com/YOUR_REPO/settings/secrets/actions" -ForegroundColor Cyan
Write-Host "   - CLOUD_SQL_INSTANCE" -ForegroundColor White
Write-Host "   - DB_PASSWORD" -ForegroundColor White
Write-Host "   - JWT_SECRET" -ForegroundColor White
Write-Host ""

Write-Host "4. 全ログを確認する場合:" -ForegroundColor Yellow
Write-Host "   gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=200" -ForegroundColor Cyan
Write-Host ""

Write-Host "5. ブラウザでログインページを開く:" -ForegroundColor Yellow
Write-Host "   Start-Process '$SERVICE_URL'" -ForegroundColor Cyan
Write-Host ""
