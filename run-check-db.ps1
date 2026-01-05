# Cloud SQLに接続してDB構造を確認するガイド

$INSTANCE_NAME = "free-trial-first-project"
$DATABASE = "webappdb"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloud SQL データベース構造確認" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "以下のコマンドを実行してCloud SQLに接続してください：" -ForegroundColor Green
Write-Host ""
Write-Host "gcloud sql connect $INSTANCE_NAME --user=postgres --database=$DATABASE" -ForegroundColor Yellow
Write-Host ""
Write-Host "接続後、psqlプロンプトで以下を実行：" -ForegroundColor Green
Write-Host ""
Write-Host "\i check-current-db-structure.sql" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
