# Cloud SQL接続情報を取得するスクリプト
# 使い方: .\get-cloudsql-info.ps1

Write-Host "=== Cloud SQL インスタンス情報取得 ===" -ForegroundColor Cyan
Write-Host ""

# 現在のプロジェクトIDを取得
$PROJECT_ID = gcloud config get-value project 2>$null

if (-not $PROJECT_ID) {
    Write-Host "❌ Google Cloudプロジェクトが設定されていません。" -ForegroundColor Red
    Write-Host "以下のコマンドでプロジェクトを設定してください：" -ForegroundColor Yellow
    Write-Host "gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 プロジェクトID: $PROJECT_ID" -ForegroundColor Green
Write-Host ""

# Cloud SQLインスタンスをリスト
Write-Host "🔍 Cloud SQLインスタンスを検索中..." -ForegroundColor Cyan
$instances = gcloud sql instances list --format="value(name,connectionName,region,databaseVersion)" 2>$null

if (-not $instances) {
    Write-Host "❌ Cloud SQLインスタンスが見つかりませんでした。" -ForegroundColor Red
    Write-Host ""
    Write-Host "Cloud SQLインスタンスを作成してください：" -ForegroundColor Yellow
    Write-Host "https://console.cloud.google.com/sql/instances" -ForegroundColor Blue
    exit 1
}

Write-Host "✅ 見つかったCloud SQLインスタンス:" -ForegroundColor Green
Write-Host ""

# インスタンス情報を表示
$instanceArray = @()
$index = 1
foreach ($line in $instances -split "`n") {
    if ($line.Trim()) {
        $parts = $line -split "`t"
        $name = $parts[0]
        $connectionName = $parts[1]
        $region = $parts[2]
        $dbVersion = $parts[3]
        
        Write-Host "[$index] インスタンス名: $name" -ForegroundColor Yellow
        Write-Host "    接続名: $connectionName" -ForegroundColor White
        Write-Host "    リージョン: $region" -ForegroundColor White
        Write-Host "    DB: $dbVersion" -ForegroundColor White
        Write-Host ""
        
        $instanceArray += @{
            Index = $index
            Name = $name
            ConnectionName = $connectionName
            Region = $region
        }
        $index++
    }
}

# 使用するインスタンスを選択
if ($instanceArray.Count -eq 1) {
    $selected = $instanceArray[0]
    Write-Host "✅ インスタンスが1つだけなので自動選択しました" -ForegroundColor Green
} else {
    $selection = Read-Host "使用するインスタンスの番号を入力してください (1-$($instanceArray.Count))"
    $selected = $instanceArray[$selection - 1]
}

Write-Host ""
Write-Host "=== GitHub Secretsに設定する値 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "GCP_PROJECT_ID:" -ForegroundColor Yellow
Write-Host $PROJECT_ID -ForegroundColor White
Write-Host ""
Write-Host "CLOUD_SQL_INSTANCE:" -ForegroundColor Yellow
Write-Host $selected.ConnectionName -ForegroundColor White
Write-Host ""
Write-Host "DB_NAME:" -ForegroundColor Yellow
Write-Host "common_db" -ForegroundColor White
Write-Host ""
Write-Host "DB_USER:" -ForegroundColor Yellow
Write-Host "postgres" -ForegroundColor White
Write-Host ""
Write-Host "DB_PASSWORD:" -ForegroundColor Yellow
Write-Host "(あなたのCloud SQLのpostgresパスワード)" -ForegroundColor Gray
Write-Host ""
Write-Host "JWT_SECRET:" -ForegroundColor Yellow
Write-Host "(ランダムな秘密鍵を生成してください)" -ForegroundColor Gray
Write-Host ""

# デプロイコマンドを生成
Write-Host "=== 手動デプロイコマンド ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "gcloud run deploy dashboard-ui ``" -ForegroundColor White
Write-Host "  --source . ``" -ForegroundColor White
Write-Host "  --region=$($selected.Region) ``" -ForegroundColor White
Write-Host "  --platform=managed ``" -ForegroundColor White
Write-Host "  --allow-unauthenticated ``" -ForegroundColor White
Write-Host "  --set-env-vars NODE_ENV=production ``" -ForegroundColor White
Write-Host "  --set-env-vars CLOUD_SQL_INSTANCE=$($selected.ConnectionName) ``" -ForegroundColor White
Write-Host "  --set-env-vars DB_NAME=common_db ``" -ForegroundColor White
Write-Host "  --set-env-vars DB_USER=postgres ``" -ForegroundColor White
Write-Host "  --set-env-vars DB_PASSWORD=YOUR_PASSWORD ``" -ForegroundColor White
Write-Host "  --set-env-vars JWT_SECRET=YOUR_SECRET ``" -ForegroundColor White
Write-Host "  --add-cloudsql-instances=$($selected.ConnectionName)" -ForegroundColor White
Write-Host ""

Write-Host "⚠️  YOUR_PASSWORD と YOUR_SECRET を実際の値に置き換えてください" -ForegroundColor Yellow
