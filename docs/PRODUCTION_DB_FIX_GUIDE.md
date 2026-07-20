# 本番DB修正手順書

## 問題の概要

- **現象**: `/api/tenant-context` および `/api/login` が503エラー（Service Unavailable）を返している
- **原因**: `tenant_app_routings` テーブルが存在しないか、データが入っていない
- **エラーログ**: "Tenant not registered: demo" / "Tenant not registered: daitetsu"

## 修正手順

### 方法1: pgAdmin または DBeaver を使用（推奨）

1. **Cloud SQL Proxyをダウンロード**（まだの場合）
   ```powershell
   # Windows用
   curl -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.x64.exe
   ```

2. **Cloud SQL Proxyを起動**
   ```powershell
   # 新しいPowerShellウィンドウで実行（このウィンドウは開いたままにする）
   .\cloud-sql-proxy.exe maint-vehicle-management:asia-northeast2-a:free-trial-first-project
   ```
   
   成功すると以下のようなメッセージが表示されます：
   ```
   Listening on 127.0.0.1:5432
   The proxy has started successfully and is ready for new connections!
   ```

3. **pgAdminまたはDBeaverで接続**
   - Host: `localhost`
   - Port: `5432`
   - Database: `common_db`
   - Username: `postgres`
   - Password: `Takabeni`

4. **SQLを実行**
   - ファイル `sql/setup-tenant-routings-production.sql` を開く
   - すべてのSQLを選択してクエリを実行

5. **確認クエリを実行**
   ```sql
   SELECT tenant_key, app_id, app_name, icon_class, description, is_active
   FROM public.tenant_app_routings
   ORDER BY tenant_key, display_order;
   ```
   
   期待される結果：demo、daitetsu、koseiの各テナントに対して複数のアプリエントリが表示される

### 方法2: psqlコマンドを使用

1. **Cloud SQL Proxyを起動**（方法1の手順2と同じ）

2. **psqlで接続**
   ```powershell
   psql -h localhost -p 5432 -U postgres -d common_db
   # パスワード入力: Takabeni
   ```

3. **SQLファイルを実行**
   ```sql
   \i sql/setup-tenant-routings-production.sql
   ```

4. **確認**
   ```sql
   \dt tenant_app_routings
   SELECT * FROM tenant_app_routings;
   ```

### 方法3: Node.jsスクリプトを使用

1. **Cloud SQL Proxyを起動**（方法1の手順2と同じ）

2. **スクリプトを実行**
   ```powershell
   node setup-production-db.js
   ```

3. **出力を確認**
   - ✅ マークが表示されれば成功
   - ❌ マークが表示された場合は、エラーメッセージを確認

### 方法4: gcloud CLIで直接接続（IPv6問題がある場合は使用不可）

```powershell
# 注意: IPv6環境では接続できない可能性があります
gcloud sql connect free-trial-first-project --user=postgres --project=maint-vehicle-management --database=common_db
```

## デプロイ後の確認

1. **Cloud Runサービスを再デプロイ**（必須ではないが推奨）
   ```powershell
   # 既存のデプロイをトリガー
   .\deploy.ps1
   ```
   
   または
   
   ```powershell
   # 手動でCloud Runを再起動
   gcloud run services update dashboodui --region=asia-northeast1 --project=maint-vehicle-management
   ```

2. **アプリケーションにアクセス**
   - URL: https://dashboard-ui-800711608362.asia-northeast2.run.app/demo
   - または: https://dashboard-ui-800711608362.asia-northeast2.run.app/daitetsu

3. **Cloud Runのログを確認**
   ```powershell
   gcloud run services logs read dashboodui --project=maint-vehicle-management --region=asia-northeast1 --limit=50
   ```
   
   期待される結果：
   - ❌ "Tenant not registered" エラーが **表示されない**
   - ✅ 正常にテナント情報が取得されている

## トラブルシューティング

### Cloud SQL Proxyが起動しない

**問題**: `cloud-sql-proxy` コマンドが見つからない

**解決策**:
```powershell
# cloud-sql-proxyをダウンロード
curl -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.x64.exe

# パスを通すか、フルパスで実行
.\cloud-sql-proxy.exe maint-vehicle-management:asia-northeast2-a:free-trial-first-project
```

### 接続が拒否される（ECONNREFUSED）

**原因**: Cloud SQL Proxyが起動していない、またはポートが競合している

**解決策**:
1. Cloud SQL Proxyが正常に起動しているか確認
   ```powershell
   Get-Process -Name "cloud-sql-proxy" -ErrorAction SilentlyContinue
   ```

2. ポート5432が使用中でないか確認
   ```powershell
   netstat -ano | findstr :5432
   ```

3. 別のポートを使用する場合
   ```powershell
   .\cloud-sql-proxy.exe maint-vehicle-management:asia-northeast2-a:free-trial-first-project --port=15432
   ```
   
   その場合、接続設定もポートを変更：
   - Port: `15432`

### テーブルは作成されたが、データが空

**原因**: INSERTクエリが失敗している

**確認**:
```sql
SELECT COUNT(*) FROM tenant_app_routings;
```

**解決策**:
SQLファイルの INSERT 部分だけを再度実行する

```sql
-- デモテナントのアプリ設定
INSERT INTO public.tenant_app_routings (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
VALUES
    ('demo', 'planning', '計画・運用管理', 'https://railway-client-800711608362.asia-northeast2.run.app', 1, '📅', 'bi-calendar-check', '保守用車の運用計画作成から運用の実績を管理できます。', true),
    ('demo', 'equipment', '保守用車管理', 'https://operation-management-client-800711608362.asia-northeast2.run.app', 2, '🚛', 'bi-truck', '仕業点検簿の表示から実績を記録します。', true),
    ('demo', 'emergency', '応急復旧支援', 'https://emergency-client-800711608362.asia-northeast2.run.app', 3, '🛠️', 'bi-tools', '機械故障等の技術支援します。', true),
    ('demo', 'failure', '機械故障管理', 'https://machine-failure-client-800711608362.asia-northeast2.run.app', 4, '⚠️', 'bi-exclamation-triangle', '機械故障の原因分析と対策策定、発生状況と対応履歴を管理します。', true)
ON CONFLICT (tenant_key, app_id) DO UPDATE SET
    app_name = EXCLUDED.app_name,
    app_url = EXCLUDED.app_url,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    icon_class = EXCLUDED.icon_class,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;
```

### それでも503エラーが解消されない

1. **サービス名の確認**
   ```powershell
   gcloud run services list --project=maint-vehicle-management --region=asia-northeast2
   ```

2. **正しいリージョンの確認**
   - ログに表示されたURL: `https://dashboard-ui-800711608362.asia-northeast2.run.app`
   - リージョン: `asia-northeast2` (ログから判断)
   - cloudbuild.yamlのリージョン: `asia-northeast1` (不一致の可能性)

3. **環境変数の確認**
   ```powershell
   gcloud run services describe dashboard-ui --project=maint-vehicle-management --region=asia-northeast2 --format="value(spec.template.spec.containers[0].env)"
   ```

## チェックリスト

- [ ] Cloud SQL Proxyをダウンロード・起動した
- [ ] `common_db` データベースに接続できた
- [ ] `sql/setup-tenant-routings-production.sql` を実行した
- [ ] `tenant_app_routings` テーブルにデータが入っていることを確認した
- [ ] demo、daitetsu、koseiのテナントエントリが存在することを確認した
- [ ] `icon_class` と `description` カラムが存在することを確認した
- [ ] アプリケーションにアクセスして503エラーが解消されたことを確認した
- [ ] Cloud Runのログで "Tenant not registered" エラーが出ていないことを確認した
