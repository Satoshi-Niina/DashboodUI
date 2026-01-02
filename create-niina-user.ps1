# ========================================
# Cloud SQL 直接アクセス・ユーザー作成スクリプト
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloud SQL niinaユーザー作成ツール" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# プロジェクトIDを取得
Write-Host "[1/5] プロジェクト情報の確認..." -ForegroundColor Yellow
$PROJECT_ID = gcloud config get-value project
if (-not $PROJECT_ID) {
    Write-Host "❌ プロジェクトが設定されていません" -ForegroundColor Red
    Write-Host "gcloud config set project YOUR_PROJECT_ID を実行してください" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ プロジェクトID: $PROJECT_ID" -ForegroundColor Green
Write-Host ""

# Cloud SQLインスタンスを取得
Write-Host "[2/5] Cloud SQLインスタンスの検索..." -ForegroundColor Yellow
$INSTANCES = gcloud sql instances list --format="value(name)" 2>$null
if (-not $INSTANCES) {
    Write-Host "❌ Cloud SQLインスタンスが見つかりません" -ForegroundColor Red
    exit 1
}

if ($INSTANCES -is [array]) {
    Write-Host "複数のインスタンスが見つかりました:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $INSTANCES.Count; $i++) {
        Write-Host "  [$i] $($INSTANCES[$i])" -ForegroundColor Cyan
    }
    $selection = Read-Host "使用するインスタンス番号を入力 (0-$($INSTANCES.Count - 1))"
    $INSTANCE_NAME = $INSTANCES[[int]$selection]
} else {
    $INSTANCE_NAME = $INSTANCES
}

Write-Host "✓ 使用するインスタンス: $INSTANCE_NAME" -ForegroundColor Green
Write-Host ""

# インスタンスの状態を確認
Write-Host "[3/5] インスタンスの状態確認..." -ForegroundColor Yellow
$STATE = gcloud sql instances describe $INSTANCE_NAME --format="value(state)"
Write-Host "✓ 状態: $STATE" -ForegroundColor Green

if ($STATE -ne "RUNNABLE") {
    Write-Host "⚠️ インスタンスが停止しています" -ForegroundColor Yellow
    Write-Host "起動するには数分かかる場合があります" -ForegroundColor Yellow
    Write-Host ""
}
Write-Host ""

# データベース名を確認
Write-Host "[4/5] データベースの確認..." -ForegroundColor Yellow
$DATABASES = gcloud sql databases list --instance=$INSTANCE_NAME --format="value(name)"
if ($DATABASES -contains "webappdb") {
    Write-Host "✓ webappdb データベースが見つかりました" -ForegroundColor Green
    $DB_NAME = "webappdb"
} else {
    Write-Host "⚠️ webappdb が見つかりません。利用可能なデータベース:" -ForegroundColor Yellow
    $DATABASES | ForEach-Object { Write-Host "  - $_" -ForegroundColor Cyan }
    Write-Host ""
    $DB_NAME = Read-Host "使用するデータベース名を入力"
}
Write-Host ""

# SQLクエリの準備
Write-Host "[5/5] niinaユーザーの作成・更新..." -ForegroundColor Yellow
Write-Host ""

$SQL_QUERIES = @"
-- niinaユーザーの確認
SELECT id, username, display_name, role, LEFT(password, 20) as password_preview
FROM master_data.users 
WHERE username = 'niina';

-- niinaユーザーの作成または更新
INSERT INTO master_data.users (username, password, display_name, email, role)
VALUES (
  'niina', 
  '\$2b\$10\$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq', 
  '新名 諭', 
  'niina@example.com', 
  'admin'
)
ON CONFLICT (username) 
DO UPDATE SET 
    password = '\$2b\$10\$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq',
    role = 'admin',
    updated_at = CURRENT_TIMESTAMP;

-- 確認
SELECT id, username, display_name, role, created_at, updated_at
FROM master_data.users 
WHERE username = 'niina';
"@

# 一時ファイルに保存
$TEMP_SQL = "temp_create_niina.sql"
$SQL_QUERIES | Out-File -FilePath $TEMP_SQL -Encoding utf8

Write-Host "SQLクエリを実行します:" -ForegroundColor Cyan
Write-Host $SQL_QUERIES -ForegroundColor White
Write-Host ""

Write-Host "実行方法を選択してください:" -ForegroundColor Yellow
Write-Host "  [1] Cloud Consoleで手動実行（推奨）" -ForegroundColor Cyan
Write-Host "  [2] gcloud sqlコマンドで実行" -ForegroundColor Cyan
Write-Host ""
$choice = Read-Host "選択 (1 or 2)"

if ($choice -eq "1") {
    # Cloud Consoleを開く
    $CONSOLE_URL = "https://console.cloud.google.com/sql/instances/$INSTANCE_NAME/query?project=$PROJECT_ID"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "手順:" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "1. ブラウザでCloud SQLコンソールが開きます" -ForegroundColor White
    Write-Host "2. 以下のSQLをコピーして、クエリエディタに貼り付けてください:" -ForegroundColor White
    Write-Host ""
    Write-Host $SQL_QUERIES -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. [実行] ボタンをクリック" -ForegroundColor White
    Write-Host ""
    Write-Host "SQLは $TEMP_SQL に保存されています" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Enterキーを押すとブラウザを開きます"
    Start-Process $CONSOLE_URL
    
} elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "gcloud sql connectで接続します..." -ForegroundColor Yellow
    Write-Host "postgresユーザーのパスワードを入力してください" -ForegroundColor Yellow
    Write-Host ""
    
    # psqlコマンドを生成
    Write-Host "以下のコマンドを実行します:" -ForegroundColor Cyan
    $command = "gcloud sql connect $INSTANCE_NAME --user=postgres --database=$DB_NAME"
    Write-Host $command -ForegroundColor White
    Write-Host ""
    Write-Host "接続後、以下を貼り付けて実行してください:" -ForegroundColor Yellow
    Write-Host $SQL_QUERIES -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Enterキーを押すと接続します"
    
    # 実行
    & cmd /c $command
    
} else {
    Write-Host "無効な選択です" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "完了" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ログイン情報:" -ForegroundColor Yellow
Write-Host "  ユーザー名: niina" -ForegroundColor Cyan
Write-Host "  パスワード: G&896845" -ForegroundColor Cyan
Write-Host "  ロール: admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "1. Cloud Runサービスが正しくデプロイされているか確認" -ForegroundColor White
Write-Host "2. サービスURLでログインを試行" -ForegroundColor White
Write-Host ""
Write-Host "サービスURLの取得:" -ForegroundColor Yellow
Write-Host '  $URL = gcloud run services describe dashboard-ui --region=asia-northeast1 --format="value(status.url)"' -ForegroundColor Cyan
Write-Host '  Start-Process $URL' -ForegroundColor Cyan
Write-Host ""

# 一時ファイルの削除を確認
Write-Host "一時ファイル $TEMP_SQL を削除しますか? (y/n)" -ForegroundColor Yellow
$delete = Read-Host
if ($delete -eq "y") {
    Remove-Item $TEMP_SQL -ErrorAction SilentlyContinue
    Write-Host "✓ 削除しました" -ForegroundColor Green
} else {
    Write-Host "✓ ファイルは保持されます: $TEMP_SQL" -ForegroundColor Green
}
