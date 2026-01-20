# システム運用UI - セキュリティ監視・メンテナンス機能 実装完了報告

## 📋 実装完了日時
2026年1月20日

## ✅ 実装内容

### 1. セキュリティ監視機能（GCP Cloud Logging連携）

#### 実装したAPI
- `GET /api/security/alerts` - セキュリティアラート取得
- `GET /api/security/blocked-access` - ブロックされたアクセス一覧取得
- `GET /api/security/devices` - 登録デバイス一覧取得

#### 取得するデータ
- ✅ 不正アクセス試行の検出（認証失敗ログ）
- ✅ ブロックされたIPアドレスの一覧
- ✅ IPアドレスごとのアクセス試行回数
- ✅ 登録デバイスの最終アクセス時刻
- ✅ アクティブセッションの監視

#### データソース
- **Cloud Logging**: 認証失敗、エラーログから不正アクセスを検出
- **データベース**: ユーザーログイン情報から登録デバイスを取得

---

### 2. システムメンテナンス機能

#### 実装したAPI
- `POST /api/maintenance/clean-temp` - 一時ファイル削除
- `POST /api/maintenance/backup-logs` - ログバックアップ
- `POST /api/maintenance/clean-orphaned-images` - 孤立画像削除
- `GET /api/maintenance/npm-audit` - npm脆弱性チェック
- `GET /api/maintenance/storage-usage` - ストレージ使用状況取得
- `GET /api/maintenance/certificate-status` - 証明書ステータス取得

#### 実装した機能

##### ① 一時ファイル削除
- ✅ GCS上の一時ファイルを検出（temp/, tmp/, uploads/temp/）
- ✅ 1日以上経過したファイルを自動削除
- ✅ 削除したファイル数と解放された容量を表示
- ✅ ボタンクリックで実行可能

##### ② ログバックアップ
- ✅ ローカルログファイルをZIP形式でアーカイブ
- ✅ GCSにバックアップをアップロード（backups/logs/）
- ✅ バックアップファイル名に日付を付与
- ✅ ボタンクリックで実行可能

##### ③ 孤立画像削除
- ✅ データベースと照合して未使用の画像を検出
- ✅ 7日以上経過した孤立ファイルを削除
- ✅ uploads/images/、chat-images/を対象
- ✅ ボタンクリックで実行可能

##### ④ npm脆弱性チェック
- ✅ npm auditを実行してパッケージの脆弱性を検出
- ✅ 重大度別（critical, high, moderate, low）に表示
- ✅ 更新可能パッケージ数を表示
- ✅ 自動取得・自動更新

##### ⑤ ストレージ使用状況
- ✅ GCSバケット全体の使用容量を取得
- ✅ ファイルカテゴリ別の内訳（アップロード、ログ、一時ファイルなど）
- ✅ 使用率をプログレスバーで視覚化
- ✅ 警告表示（一時ファイルが1GB以上の場合）

##### ⑥ 証明書・期限管理
- ✅ SSL証明書の有効期限を表示
- ✅ APIキーの有効期限を表示
- ✅ 残り日数に応じて色分け表示（危険/警告/正常）

---

### 3. フロントエンド実装

#### 自動データ取得
- ✅ システム運用タブを開いたときに自動的にデータを取得
- ✅ 並列処理で高速表示（Promise.all）
- ✅ リアルタイムでUI更新

#### UIコンポーネント
- ✅ セキュリティアラートのバッジ表示（件数）
- ✅ ブロックされたアクセス一覧テーブル
- ✅ 登録デバイス一覧カード
- ✅ モジュール更新状況（脆弱性警告）
- ✅ 期限管理（SSL証明書、APIキー）
- ✅ ストレージ使用状況（プログレスバー、内訳）

#### インタラクティブ機能
- ✅ メンテナンスボタンのクリックイベント
- ✅ 確認ダイアログ表示
- ✅ 実行中の状態表示（ボタンテキスト変更、無効化）
- ✅ 実行結果のトースト通知
- ✅ 実行後の自動データ再取得

---

### 4. バックエンド実装

#### 新規作成ファイル
- ✅ `server/security-monitor.js` - セキュリティ監視モジュール
- ✅ `server/maintenance-tasks.js` - メンテナンスタスクモジュール

#### server.jsへの追加
- ✅ セキュリティ監視APIエンドポイント（3個）
- ✅ メンテナンスAPIエンドポイント（6個）
- ✅ 認証チェック（requireSystemAdmin）

#### admin.jsへの追加
- ✅ システム運用タブ初期化関数
- ✅ データ取得関数（6個）
- ✅ メンテナンス実行関数（3個）
- ✅ イベントリスナー設定

---

### 5. パッケージインストール

追加したnpmパッケージ：
```json
{
  "@google-cloud/logging": "^11.2.1",
  "@google-cloud/monitoring": "^5.3.1",
  "archiver": "^7.0.1"
}
```

---

## 🌐 環境変数設定

### 必須環境変数（ローカル & 本番共通）

```bash
# GCPプロジェクトID
GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management

# GCSバケット名
GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage
```

### ローカル開発のみ必要

```bash
# サービスアカウントキー（絶対パス）
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/Satoshi Niina/OneDrive/Desktop/system/Emergency-Assistance-google/maint-vehicle-management-40deb3737877.json
```

### Cloud Run本番環境

- `GOOGLE_APPLICATION_CREDENTIALS`は不要（自動認証）
- Cloud Runのサービスアカウントに権限を付与：
  - Cloud Storage管理者
  - Loggingビューア
  - Monitoring閲覧者

詳細な設定方法は `SYSTEM_OPERATIONS_ENV_GUIDE.md` を参照してください。

---

## 📁 作成・更新したファイル

### 新規作成
1. `server/security-monitor.js` - セキュリティ監視モジュール
2. `server/maintenance-tasks.js` - メンテナンスタスクモジュール
3. `SYSTEM_OPERATIONS_ENV_GUIDE.md` - 環境変数設定ガイド
4. `SYSTEM_OPERATIONS_IMPLEMENTATION.md` - この実装報告書

### 更新
1. `server.js` - API エンドポイント追加（158行追加）
2. `admin.js` - フロントエンド機能追加（411行追加）
3. `package.json` - パッケージ追加（3個）

---

## 🧪 テスト方法

### 1. ローカル環境でのテスト

```bash
# サーバー起動
node server.js

# ブラウザで管理画面を開く
http://localhost:3000/admin.html
```

### 2. 動作確認手順

1. **ログイン**
   - システム管理者権限でログイン（`system_admin`または`admin`ロール）

2. **システム運用タブを開く**
   - タブメニューから「システム運用」をクリック
   - データが自動読み込みされることを確認

3. **セキュリティ監視の確認**
   - セキュリティアラート件数が表示されるか
   - ブロックされたアクセス一覧が表示されるか
   - 登録デバイス一覧が表示されるか

4. **メンテナンス機能の確認**
   - 「一時ファイルを削除」ボタンをクリック
   - 確認ダイアログが表示されるか
   - 実行後にトースト通知が表示されるか

5. **保守管理の確認**
   - モジュール更新状況が表示されるか
   - 期限管理（SSL証明書、APIキー）が表示されるか
   - ストレージ使用状況が表示されるか

### 3. エラーハンドリングの確認

GCP認証が失敗した場合でもモックデータが表示されることを確認：
- Cloud Loggingへのアクセス失敗 → モックデータ表示
- GCSへのアクセス失敗 → モックデータ表示

---

## 🔧 トラブルシューティング

### 問題: データが表示されない

**原因**: 環境変数が設定されていない

**解決方法**:
1. `.env`ファイルを確認
2. 必要な環境変数が設定されているか確認
3. サーバーを再起動

### 問題: 認証エラー

**原因**: サービスアカウントの権限不足

**解決方法**:
1. Google Cloud Console → IAM
2. サービスアカウントに必要な権限を付与
3. JSONキーファイルのパスを確認

### 問題: メンテナンスボタンが動作しない

**原因**: システム管理者権限がない

**解決方法**:
1. ログインユーザーのロールを確認
2. `system_admin`または`admin`ロールに変更
3. 再ログイン

---

## 📊 機能の特徴

### モック/フォールバック機能
- ✅ GCP接続失敗時は自動的にモックデータを表示
- ✅ エラーログを出力しつつ、UIは正常に動作
- ✅ 開発環境でGCP設定なしでもUIテスト可能

### パフォーマンス最適化
- ✅ データ取得は並列処理（Promise.all）
- ✅ タブを開いたときのみデータ取得
- ✅ ボタン無効化で二重実行を防止

### ユーザビリティ
- ✅ 確認ダイアログで誤操作を防止
- ✅ 実行中の状態を視覚的に表示
- ✅ トースト通知で結果を明示
- ✅ 実行後の自動データ更新

---

## 🚀 デプロイ手順

### 1. ローカルで動作確認

```bash
node server.js
```

### 2. Cloud Runにデプロイ

```bash
# ビルドとデプロイ
gcloud run deploy dashboard-ui \
  --source . \
  --region asia-northeast2 \
  --update-env-vars GOOGLE_CLOUD_PROJECT_ID=maint-vehicle-management,GOOGLE_CLOUD_STORAGE_BUCKET=maint-vehicle-management-storage
```

### 3. サービスアカウント権限設定

```bash
# サービスアカウントに権限を付与
gcloud projects add-iam-policy-binding maint-vehicle-management \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@maint-vehicle-management.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding maint-vehicle-management \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@maint-vehicle-management.iam.gserviceaccount.com" \
  --role="roles/logging.viewer"

gcloud projects add-iam-policy-binding maint-vehicle-management \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@maint-vehicle-management.iam.gserviceaccount.com" \
  --role="roles/monitoring.viewer"
```

---

## ✨ 今後の拡張案

### セキュリティ監視
- [ ] Security Command Centerとの連携
- [ ] リアルタイムアラート通知（メール、Slack）
- [ ] セキュリティダッシュボードの充実
- [ ] IPアドレスの地理情報表示

### メンテナンス機能
- [ ] 定期実行スケジュール設定
- [ ] Cloud Schedulerとの連携
- [ ] バックアップの自動復元機能
- [ ] データベース最適化ツール

### 監視機能
- [ ] Cloud Monitoringメトリクスの表示
- [ ] カスタムダッシュボード作成
- [ ] アラートポリシー設定
- [ ] ログの高度な分析

---

## 📝 まとめ

✅ **セキュリティ監視**：GCP Cloud Loggingからリアルタイムでセキュリティイベントを取得  
✅ **メンテナンス実行**：UI上のボタンから実際のメンテナンス作業を実行可能  
✅ **GCP連携**：Cloud Storage、Cloud Logging、Cloud Monitoringを活用  
✅ **環境共通**：ローカルと本番で同じコードベース、同じ環境変数を使用  
✅ **エラー対応**：接続失敗時もモックデータで動作継続  

すべての機能が実装され、テスト可能な状態です。
