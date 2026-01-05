# Cloud SQL修正手順

## 方法1: Google Cloud Consoleから実行（推奨）

1. Google Cloud Console → SQL → free-trial-first-project を開く
2. 「Cloud SQL Studio」をクリック
3. データベース `webappdb` に接続
4. `fix-clouddb-routing.sql` の内容をコピー＆ペーストして実行

## 方法2: gcloud beta コマンド（Cloud SQL Proxy経由）

```powershell
# 1. Cloud SQL Proxyをダウンロード（初回のみ）
# https://cloud.google.com/sql/docs/mysql/sql-proxy

# 2. Proxyを起動
./cloud-sql-proxy maint-vehicle-management:asia-northeast2:free-trial-first-project

# 3. 別のターミナルで psql 接続
$env:PGPASSWORD='Takabeni'
psql -h 127.0.0.1 -U postgres -d webappdb -f fix-clouddb-routing.sql
```

## 実行後

Cloud Runサービスを再起動：
```powershell
gcloud run services update dashboard-ui --region asia-northeast2 --no-traffic
gcloud run services update dashboard-ui --region asia-northeast2 --traffic latest=100
```

または強制的に新しいリビジョンをデプロイ：
```powershell
gcloud run services update dashboard-ui --region asia-northeast2 --update-env-vars FORCE_REDEPLOY=$(Get-Date -Format "yyyyMMddHHmmss")
```
