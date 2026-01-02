# ログイン情報の他アプリへの引き継ぎ機能

## 概要
このシステムでは、ダッシュボードからログイン済みのユーザー情報を他のアプリケーションに引き継ぐことができます。  
ユーザーは各アプリで再度ログインする必要がなく、シームレスにアクセスできます。

## 技術仕様

### 送信内容
- **ログインユーザー名** (username)
- **ユーザーID** (id)
- **権限** (role: admin/user)
- **表示名** (displayName)

これらの情報はJWT（JSON Web Token）として暗号化され、URLパラメータ経由で送信されます。

## 実装方法

### 1. 送信側（このアプリ）
既に実装済みです。[app.js](app.js)でアプリ起動時に自動的にトークンが付与されます。

```javascript
// app.js (既存コード - 変更不要)
const token = localStorage.getItem('user_token');
const separator = baseUrl.includes('?') ? '&' : '?';
const tokenParam = AppConfig.tokenParamName || 'auth_token';
finalUrl = `${baseUrl}${separator}${tokenParam}=${encodeURIComponent(token)}`;
window.open(finalUrl, '_blank');
```

### 2. 受信側（他のアプリ）

#### ステップ1: auto-login.jsをコピー
[auto-login.js](auto-login.js) を他のアプリケーションのディレクトリにコピーします。

#### ステップ2: HTMLファイルで読み込み
各アプリのHTMLファイルの`<head>`セクションまたは`<body>`の最後で読み込みます：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>アプリケーション</title>
</head>
<body>
    <!-- アプリのコンテンツ -->
    
    <!-- 自動ログイン機能を追加 -->
    <script src="./auto-login.js"></script>
</body>
</html>
```

#### ステップ3: 自動ログインの動作確認
スクリプトを読み込むだけで、以下の処理が自動的に実行されます：

1. URLパラメータから`auth_token`を取得
2. トークンを検証エンドポイント（`/api/verify-token`）に送信
3. 検証成功時、ユーザー情報をlocalStorageに保存
4. セッションを確立

### 3. サーバー側の設定

#### 必須条件
- **JWT_SECRET**: 全アプリで同じ秘密鍵を使用する必要があります
- **CORS設定**: 他のアプリからのAPIリクエストを許可

#### .envファイルの設定例
```env
# 認証シークレット（全アプリで同じ値を使用）
JWT_SECRET=your-secret-key-here

# CORS設定（複数ドメインをカンマ区切りで指定）
CORS_ORIGIN=http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004
```

#### server.jsの実装（既に実装済み）
トークン検証エンドポイント `/api/verify-token` が他のアプリからも利用可能です。

## カスタマイズ

### 自動実行を無効化する場合
[auto-login.js](auto-login.js) の最後の部分をコメントアウトし、手動で呼び出します：

```javascript
// DOMContentLoaded時の自動実行を無効化する場合
// if (document.readyState === 'loading') { ... } をコメントアウト

// 手動で実行
document.addEventListener('DOMContentLoaded', async () => {
    const success = await window.AutoLogin.execute({
        apiBaseUrl: 'http://localhost:3000', // 認証サーバーのURL
        redirectOnSuccess: '/dashboard', // ログイン成功後のリダイレクト先
        redirectOnFailure: '/login.html', // 失敗時のリダイレクト先
        showConsoleLog: true
    });
    
    if (success) {
        console.log('自動ログイン成功');
    }
});
```

### 成功時・失敗時のコールバック
```javascript
window.AutoLogin.execute({
    apiBaseUrl: 'http://localhost:3000',
    onSuccess: (userInfo) => {
        console.log('ようこそ、' + userInfo.username + 'さん');
        // カスタム処理
    },
    onFailure: () => {
        console.error('自動ログインに失敗しました');
        // カスタム処理
    }
});
```

## セキュリティ対策

### 1. HTTPS通信の使用
本番環境では必ずHTTPSを使用してください。

### 2. トークンの有効期限
JWTトークンは1時間で期限切れになります（変更可能）。

### 3. URLからトークンを削除
[auto-login.js](auto-login.js) は自動的にURLからトークンパラメータを削除します（履歴に残らない）。

### 4. セキュアなストレージ
トークンはlocalStorageに保存されます。より高いセキュリティが必要な場合は、HttpOnly Cookieの使用を検討してください。

## トラブルシューティング

### トークン検証が失敗する
- **原因**: JWT_SECRETが異なる
- **解決策**: 全アプリで同じJWT_SECRETを使用

### CORSエラーが発生する
- **原因**: CORS設定が不足
- **解決策**: server.jsのCORS設定に受信側アプリのオリジンを追加

```javascript
// server.js
const corsOptions = {
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true
};
app.use(cors(corsOptions));
```

### 自動ログインが動作しない
1. ブラウザのコンソールでエラーを確認
2. URLパラメータに`auth_token`が含まれているか確認
3. `/api/verify-token` エンドポイントが正常に動作しているか確認

## 使用例

### ダッシュボードからアプリを起動
1. ダッシュボードにログイン
2. アプリカードをクリック
3. 「アプリ起動」ボタンをクリック
4. 新しいタブで他のアプリが自動的にログインされた状態で開きます

### URLの例
```
http://localhost:3001/?auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

トークンが検証された後、URLは以下のように変更されます：
```
http://localhost:3001/
```

## API仕様

### POST /api/verify-token

#### リクエスト
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### レスポンス（成功時）
```json
{
  "valid": true,
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "displayName": "管理者",
    "role": "admin"
  }
}
```

#### レスポンス（失敗時）
```json
{
  "valid": false,
  "success": false,
  "message": "トークンが無効または期限切れです"
}
```

## まとめ

✅ **送信側**: 既に実装済み（app.js）  
✅ **受信側**: auto-login.jsを読み込むだけ  
✅ **サーバー側**: JWT_SECRETとCORSを設定  
✅ **セキュリティ**: HTTPSと適切なトークン管理を推奨

これで、複数のアプリ間でシームレスなログイン体験を提供できます。
