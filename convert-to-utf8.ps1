# ====================================
# すべてのテキストファイルをUTF-8（BOMなし）に変換
# ====================================

Write-Host "🔄 ファイルエンコーディングをUTF-8（BOMなし）に統一します..." -ForegroundColor Cyan
Write-Host ""

# 対象ファイルの拡張子
$targetExtensions = @('*.js', '*.html', '*.css', '*.sql', '*.md', '*.json', '*.txt', '*.env')

# 除外するディレクトリ
$excludeDirs = @('node_modules', '.git', '.vscode')

# 処理したファイル数
$processedCount = 0
$errorCount = 0

# UTF-8エンコーディング（BOMなし）
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($extension in $targetExtensions) {
    Write-Host "📁 処理中: $extension" -ForegroundColor Yellow
    
    $files = Get-ChildItem -Path . -Filter $extension -Recurse -File | Where-Object {
        $path = $_.FullName
        $exclude = $false
        foreach ($dir in $excludeDirs) {
            if ($path -like "*\$dir\*") {
                $exclude = $true
                break
            }
        }
        -not $exclude
    }
    
    foreach ($file in $files) {
        try {
            # ファイルの内容を読み込み
            $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
            
            # UTF-8（BOMなし）で書き込み
            [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
            
            Write-Host "  ✅ $($file.Name)" -ForegroundColor Green
            $processedCount++
        }
        catch {
            Write-Host "  ❌ $($file.Name) - エラー: $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📊 処理結果" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ 処理成功: $processedCount ファイル" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "❌ 処理失敗: $errorCount ファイル" -ForegroundColor Red
}
Write-Host ""
Write-Host "✨ エンコーディングの統一が完了しました！" -ForegroundColor Green
