# 他のアプリからのトークン検証ガイド

このダッシュボードシステムは、JWT トークンベースのシングルサインオン（SSO）を実装しています。他のアプリケーションは、ダッシュボードから渡されたトークンを検証することで、ユーザー認証を行うことができます。

## 📋 概要

1. **ダッシュボード側**: ログイン後、JWT トークンを発行してローカルストレージに保存
2. **アプリ起動時**: トークンを URL パラメータ `auth_token` として渡す
3. **他のアプリ側**: トークンを受け取り、ダッシュボードの検証 API で検証

---

## 🔐 トークンの受け渡し方法

### ダッシュボード側（自動実装済み）

ユーザーがアプリカードをクリックすると、以下の形式で URL が生成されます:

```
https://your-app.com?auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

パラメータ名は `config.js` の `AppConfig.tokenParamName` で定義（デフォルト: `auth_token`）

---

## 🛠️ 他のアプリでの実装方法

### ステップ 1: トークンの取得

#### フロントエンド（JavaScript）

```javascript
// URLパラメータからトークンを取得
function getTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('auth_token');
}

// トークンを取得してローカルストレージに保存
const token = getTokenFromUrl();
if (token) {
    localStorage.setItem('auth_token', token);
    
    // URLからトークンパラメータを削除（セキュリティのため）
    const url = new URL(window.location);
    url.searchParams.delete('auth_token');
    window.history.replaceState({}, '', url);
}
```

#### バックエンド（Node.js/Express）

```javascript
app.get('/app', (req, res) => {
    const token = req.query.auth_token;
    
    if (token) {
        // トークンをセッションまたはCookieに保存
        req.session.token = token;
        // またはCookie
        res.cookie('auth_token', token, { httpOnly: true, secure: true });
        
        // リダイレクトしてURLからトークンを削除
        return res.redirect('/app');
    }
    
    res.render('app');
});
```

---

### ステップ 2: トークンの検証

#### フロントエンドから直接検証

```javascript
async function verifyToken(token) {
    try {
        const response = await fetch('https://your-dashboard.com/api/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('認証成功:', data.user);
            return data.user;  // { id, username, displayName }
        } else {
            console.error('認証失敗:', data.message);
            return null;
        }
    } catch (error) {
        console.error('検証エラー:', error);
        return null;
    }
}

// 使用例
const token = localStorage.getItem('auth_token');
if (token) {
    const user = await verifyToken(token);
    if (user) {
        // ユーザー情報を表示
        document.getElementById('username').textContent = user.displayName;
    } else {
        // ログイン画面にリダイレクト
        window.location.href = 'https://your-dashboard.com';
    }
}
```

#### バックエンドで検証（Node.js）

```javascript
const axios = require('axios');

async function verifyToken(token) {
    try {
        const response = await axios.post(
            'https://your-dashboard.com/api/verify-token',
            { token }
        );
        
        if (response.data.success) {
            return response.data.user;
        }
        return null;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

// ミドルウェアとして使用
async function authMiddleware(req, res, next) {
    const token = req.session.token || req.cookies.auth_token;
    
    if (!token) {
        return res.redirect('https://your-dashboard.com');
    }
    
    const user = await verifyToken(token);
    
    if (!user) {
        return res.redirect('https://your-dashboard.com');
    }
    
    req.user = user;
    next();
}

// 使用例
app.get('/protected-page', authMiddleware, (req, res) => {
    res.render('protected', { user: req.user });
});
```

#### Python (Flask) での検証

```python
import requests
from flask import session, redirect, request

DASHBOARD_URL = 'https://your-dashboard.com'

def verify_token(token):
    try:
        response = requests.post(
            f'{DASHBOARD_URL}/api/verify-token',
            json={'token': token}
        )
        data = response.json()
        
        if data.get('success'):
            return data.get('user')
        return None
    except Exception as e:
        print(f'Token verification failed: {e}')
        return None

@app.route('/app')
def app_page():
    # URLパラメータからトークンを取得
    token = request.args.get('auth_token')
    
    if token:
        session['token'] = token
        return redirect('/app')  # URLからトークンを削除
    
    # セッションからトークンを取得
    token = session.get('token')
    
    if not token:
        return redirect(DASHBOARD_URL)
    
    # トークンを検証
    user = verify_token(token)
    
    if not user:
        return redirect(DASHBOARD_URL)
    
    return render_template('app.html', user=user)
```

---

### ステップ 3: トークンのリフレッシュ

トークンの有効期限は1時間です。有効期限が近づいたらリフレッシュすることができます。

```javascript
async function refreshToken(oldToken) {
    try {
        const response = await fetch('https://your-dashboard.com/api/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: oldToken })
        });

        const data = await response.json();
        
        if (data.success) {
            // 新しいトークンを保存
            localStorage.setItem('auth_token', data.token);
            return data.token;
        }
        return null;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
    }
}

// 定期的にリフレッシュ（例: 50分ごと）
setInterval(async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        const newToken = await refreshToken(token);
        if (!newToken) {
            // リフレッシュ失敗 - ログイン画面に戻る
            window.location.href = 'https://your-dashboard.com';
        }
    }
}, 50 * 60 * 1000);  // 50分
```

---

## 🔒 セキュリティのベストプラクティス

### 1. HTTPS を使用

```javascript
// 本番環境では必ず HTTPS を使用
if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    window.location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
}
```

### 2. トークンをURLから削除

```javascript
// トークンを取得後、URLから削除
if (token) {
    const url = new URL(window.location);
    url.searchParams.delete('auth_token');
    window.history.replaceState({}, '', url);
}
```

### 3. httpOnly Cookie を使用（バックエンド）

```javascript
// トークンを httpOnly Cookie に保存
res.cookie('auth_token', token, {
    httpOnly: true,
    secure: true,      // HTTPS のみ
    sameSite: 'strict',
    maxAge: 3600000    // 1時間
});
```

### 4. CORS 設定

```javascript
// バックエンドで適切な CORS 設定
app.use(cors({
    origin: [
        'https://your-dashboard.com',
        'https://your-app.com'
    ],
    credentials: true
}));
```

### 5. トークンの検証を必ずサーバー側で実行

```javascript
// ❌ ダメな例：フロントエンドのみで検証
// const isValid = jwt.verify(token, secret);  // クライアントで検証しない

// ✅ 良い例：サーバーAPIを呼び出して検証
const user = await verifyToken(token);
```

---

## 📊 API エンドポイント仕様

### POST /api/verify-token

トークンを検証し、ユーザー情報を返します。

**リクエスト:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**レスポンス（成功）:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "displayName": "管理者"
  }
}
```

**レスポンス（失敗）:**
```json
{
  "success": false,
  "message": "トークンが無効または期限切れです"
}
```

### POST /api/refresh-token

トークンをリフレッシュし、新しいトークンを発行します。

**リクエスト:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**レスポンス（成功）:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🧪 テスト例

### ローカルテスト用 HTML

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>Token Test</title>
</head>
<body>
    <h1>トークンテスト</h1>
    <div id="result"></div>

    <script>
        // URLからトークンを取得
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('auth_token');

        const resultDiv = document.getElementById('result');

        if (!token) {
            resultDiv.innerHTML = '<p style="color: red;">トークンが見つかりません</p>';
        } else {
            resultDiv.innerHTML = '<p>トークンを検証中...</p>';

            // トークンを検証
            fetch('https://your-dashboard.com/api/verify-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    resultDiv.innerHTML = `
                        <p style="color: green;">認証成功！</p>
                        <p>ユーザーID: ${data.user.id}</p>
                        <p>ユーザー名: ${data.user.username}</p>
                        <p>表示名: ${data.user.displayName}</p>
                    `;
                } else {
                    resultDiv.innerHTML = `<p style="color: red;">認証失敗: ${data.message}</p>`;
                }
            })
            .catch(error => {
                resultDiv.innerHTML = `<p style="color: red;">エラー: ${error.message}</p>`;
            });
        }
    </script>
</body>
</html>
```

---

## 📝 まとめ

1. **トークンの受け取り**: URL パラメータ `auth_token` から取得
2. **トークンの保存**: ローカルストレージまたは httpOnly Cookie に保存
3. **トークンの検証**: ダッシュボードの `/api/verify-token` で検証
4. **トークンのリフレッシュ**: 有効期限前に `/api/refresh-token` でリフレッシュ
5. **セキュリティ**: HTTPS 使用、URL からトークン削除、サーバー側で検証

これで、すべてのアプリでシングルサインオン（SSO）が実現できます！
