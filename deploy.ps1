# GitHub Actions 経由デプロイ用トリガースクリプト
# 使い方: .\deploy.ps1

$ErrorActionPreference = 'Stop'

function Get-CurrentBranch {
  $branch = (git branch --show-current).Trim()
  if (-not $branch) {
    throw 'Current branch could not be determined.'
  }
  return $branch
}

$branchName = Get-CurrentBranch

Write-Host "Triggering deployment via Git push..." -ForegroundColor Green
Write-Host "Branch: $branchName"

git commit --allow-empty -m "chore: trigger cloud run deploy via github actions"

if ($LASTEXITCODE -ne 0) {
  throw 'Failed to create trigger commit.'
}

git push origin $branchName

if ($LASTEXITCODE -eq 0) {
  Write-Host "Push completed. GitHub Actions should deploy the latest revision." -ForegroundColor Green
} else {
  throw 'Git push failed.'
}
