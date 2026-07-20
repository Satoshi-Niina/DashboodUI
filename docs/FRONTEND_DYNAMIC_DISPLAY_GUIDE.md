# フロントエンド動的表示対応 - 動作確認ガイド

## 実装内容

### 1. 修正ファイル

- **[app.js](../app.js)** - ダッシュボードのメイン処理

### 2. 実装した機能

#### ✅ APIレスポンスの処理変更

- `/api/tenant-apps` エンドポイントから `tenant_app_routings` テーブルのデータを取得
- レスポンス形式：
  ```json
  {
    "success": true,
    "tenant_key": "demo",
    "apps": [
      {
        "id": "planning",
        "name": "計画・運用管理",
        "url": "https://...",
        "displayOrder": 1,
        "icon": "📅",
        "iconClass": "bi-calendar-check",
        "description": "保守用車の運用計画作成から運用の実績を管理できます。"
      }
    ]
  }
  ```

#### ✅ 動的レンダリングの実装

**アプリカード生成処理（app.js の該当箇所）:**

1. **データ取得**: `loadTenantApps()` 関数が `/api/tenant-apps` を呼び出し
2. **データ変換**: APIレスポンスを内部形式に変換
3. **カード生成**: `apps.forEach()` でループし、各アプリのカードを動的に生成
4. **アイコン表示**: 
   - `iconClass` が指定されている場合 → Bootstrap Icons（`<i class="bi-truck"></i>`）
   - `iconClass` がない場合 → 絵文字（`📅`, `🚛` など）

**生成されるHTMLの例:**
```html
<div class="app-card">
  <div class="app-card-header">
    <h3>計画・運用管理</h3>
  </div>
  <div class="app-image-container">
    <img src="assets/img/..." alt="計画・運用管理" class="app-image">
    <div class="app-icon-floating">
      <i class="bi-calendar-check" style="font-size: 2.5rem; color: var(--primary-color);"></i>
    </div>
  </div>
  <div class="app-card-info">
    <p class="app-sub-desc">保守用車の運用計画作成から運用の実績を管理できます。</p>
    <button class="launch-btn-small">アプリ起動</button>
  </div>
</div>
```

#### ✅ フォールバック処理の組み込み

**フォールバックが発動する条件:**
1. `/api/tenant-apps` がエラーを返した（500エラーなど）
2. レスポンスの `success` が `false`
3. `apps` 配列が空または存在しない
4. ネットワークエラー

**フォールバック時の動作:**
- `loadFallbackApps()` 関数が実行される
- 4つのデフォルトアプリ（planning, equipment, emergency, failure）が表示される
- コンソールに警告メッセージが表示される

**ログの例:**
```
[App] ⚠️  Loading fallback apps (static default list)
[App] This usually means:
[App]   - tenant_app_routings table is empty or missing
[App]   - API endpoint /api/tenant-apps returned an error
[App]   - Network error occurred
[App] Loaded 4 fallback apps
```

### 3. 改善点

#### コードの改善

1. **エラーハンドリングの強化**
   - APIレスポンスの詳細な検証
   - 各エラーケースで適切なログ出力
   - スタックトレースの記録

2. **ログの充実**
   - どのアプリがレンダリングされたか追跡可能
   - APIレスポンスの内容をログに記録
   - フォールバック使用時に理由を明確に表示

3. **画像のフォールバック**
   - 画像読み込み失敗時に `default-app.png` を表示
   - `onerror` ハンドラで自動フォールバック

4. **説明文のフォールバック**
   - `description` が空の場合、「アプリケーションの説明がありません。」を表示

5. **アプリ0件時の対応**
   - アプリが1つも登録されていない場合、メッセージを表示

## 動作確認手順

### 前提条件

1. ✅ 本番DBの `tenant_app_routings` テーブルにデータが登録されている
2. ✅ Cloud Runサービスがデプロイされている
3. ✅ フロントエンドの修正がデプロイされている

### 手順1: デプロイ

```powershell
# 現在のディレクトリ確認
pwd  # D:\sysbuckup\DashboodUI にいることを確認

# デプロイ実行
.\deploy.ps1
```

または、手動でビルド・デプロイ：

```powershell
# Cloud Buildをトリガー
gcloud builds submit --config=cloudbuild.yaml --project=maint-vehicle-management
```

### 手順2: アクセス

ブラウザで以下のURLにアクセス：

- **Demo環境**: https://dashboard-ui-800711608362.asia-northeast2.run.app/demo
- **Daitetsu環境**: https://dashboard-ui-800711608362.asia-northeast2.run.app/daitetsu

### 手順3: 確認ポイント

#### ✅ 正常動作の確認

1. **ログイン後、ダッシュボードが表示される**
   - 各テナントに登録されたアプリカードが表示される
   - DBに登録されているアプリ数と一致する

2. **アイコンが正しく表示される**
   - Bootstrap Iconsのクラスが指定されている場合 → アイコンフォント表示
   - 絵文字が指定されている場合 → 絵文字表示

3. **説明文が表示される**
   - 各アプリカードに `description` の内容が表示される

4. **アプリ起動ボタンが動作する**
   - クリックすると詳細ポップアップが表示される
   - 「アプリ起動」ボタンで外部アプリに遷移できる

#### ✅ ブラウザコンソールでのログ確認

**正常時のログ:**
```
[App] Fetching tenant apps from /api/tenant-apps...
[App] API response: {success: true, tenant_key: "demo", apps: Array(4)}
[App] Successfully loaded 4 apps from API
[App] ========================================
[App] Generating app cards dynamically...
[App] Total apps to render: 4
[App] ========================================
[App] [1/4] Rendering card: {id: "planning", title: "計画・運用管理", ...}
[App] ✅ Card rendered: 計画・運用管理
[App] [2/4] Rendering card: {id: "equipment", title: "保守用車管理", ...}
[App] ✅ Card rendered: 保守用車管理
...
[App] ========================================
[App] All app cards rendered successfully!
[App] ========================================
```

**フォールバック時のログ:**
```
[App] API returned empty apps array (tenant may have no apps configured), using fallback
[App] ⚠️  Loading fallback apps (static default list)
[App] This usually means:
[App]   - tenant_app_routings table is empty or missing
[App]   - API endpoint /api/tenant-apps returned an error
[App]   - Network error occurred
[App] Loaded 4 fallback apps
```

### 手順4: DBデータの確認

もしアプリが表示されない場合、DBを確認：

```powershell
# Cloud SQL Proxyを起動
cloud-sql-proxy maint-vehicle-management:asia-northeast2-a:free-trial-first-project

# 別のターミナルで
node check-tenant-routings.js
```

または、[PRODUCTION_DB_FIX_GUIDE.md](PRODUCTION_DB_FIX_GUIDE.md) の手順に従ってDBを確認してください。

## トラブルシューティング

### アプリが表示されない

**症状**: ダッシュボードにアプリカードが1つも表示されない

**確認事項**:
1. ブラウザのコンソールを開く（F12）
2. ログを確認する

**パターン1: フォールバックログが出ている**
```
[App] ⚠️  Loading fallback apps (static default list)
```

→ DBの `tenant_app_routings` テーブルにデータがない可能性
→ [PRODUCTION_DB_FIX_GUIDE.md](PRODUCTION_DB_FIX_GUIDE.md) に従ってDBにデータを投入

**パターン2: 503エラーが出ている**
```
[App] API request failed with status 503
```

→ バックエンドのエラー（Tenant not registered）
→ DBにテナント情報が登録されていない
→ `sql/setup-tenant-routings-production.sql` を実行

**パターン3: ネットワークエラー**
```
[App] Error loading tenant apps: TypeError: Failed to fetch
```

→ APIエンドポイントに到達できない
→ Cloud Runサービスが起動しているか確認
→ URLが正しいか確認

### アイコンが表示されない

**症状**: アイコンの部分が空白または □ になる

**原因**: Bootstrap Iconsが読み込まれていない

**確認**:
1. index.html で Bootstrap Icons のCDNが読み込まれているか確認
   ```html
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
   ```

2. ネットワークタブでCSSが正常に読み込まれているか確認

### 説明文が表示されない

**症状**: アプリカードに説明文が表示されない

**原因**: DBの `description` カラムが空

**確認**:
```sql
SELECT tenant_key, app_id, description 
FROM tenant_app_routings 
WHERE description IS NULL OR description = '';
```

**修正**:
```sql
UPDATE tenant_app_routings 
SET description = '適切な説明文' 
WHERE tenant_key = 'demo' AND app_id = 'planning';
```

### 画像が表示されない

**症状**: アプリカードの背景画像が表示されない（デフォルト画像も表示されない）

**原因**: 画像ファイルが存在しない

**確認**:
1. `assets/img/` フォルダに画像ファイルが存在するか
2. `default-app.png` が存在するか

## 次のステップ

1. **アプリの追加**
   - 新しいアプリを追加する場合、DBに INSERT するだけでOK
   - フロントエンドの修正は不要

2. **アイコンの変更**
   - `icon_class` カラムを更新するだけでOK
   - Bootstrap Icons のクラス名を使用: https://icons.getbootstrap.com/

3. **表示順序の変更**
   - `display_order` カラムを更新するだけでOK
   - 数値が小さいほど先に表示される

4. **アプリの無効化**
   - `is_active` カラムを `false` にするだけでOK
   - フロントエンドから非表示になる

**例: 新しいアプリを追加**
```sql
INSERT INTO tenant_app_routings 
  (tenant_key, app_id, app_name, app_url, display_order, icon, icon_class, description, is_active)
VALUES
  ('demo', 'reports', 'レポート管理', 'https://reports.example.com', 5, '📊', 'bi-bar-chart', 'レポートを作成・管理します。', true);
```

→ ページをリロードするだけで新しいアプリが表示されます！
