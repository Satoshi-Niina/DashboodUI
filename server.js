const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS設定
const corsOptions = {
  origin: process.env.CORS_ORIGIN === '*' 
    ? '*' 
    : process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) 
      : '*',
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Config Endpoint (環境変数をクライアントに渡すため動的に生成)
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    /**
     * アプリケーション設定ファイル (Server Generated)
     * 環境変数から値を読み込んで生成されています。
     */
    const AppConfig = {
        // トークンをURLパラメータとして渡すときのキー名
        tokenParamName: 'auth_token',

        // 各アプリケーションのエンドポイント設定
        endpoints: {
            // 応急復旧支援システム
            emergency: '${process.env.APP_URL_EMERGENCY || "http://localhost:3001"}',
            
            // 計画・実績管理システム
            planning: '${process.env.APP_URL_PLANNING || "http://localhost:3002"}',
            
            // 保守用車管理システム
            equipment: '${process.env.APP_URL_EQUIPMENT || "http://localhost:3003"}'
        }
    };
  `);
});

// ルートパスへのアクセス時はログイン画面を表示
// express.staticより先に記述することでindex.htmlの自動配信を防ぐ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.use(express.static(path.join(__dirname)));

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test DB Connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Login API Endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // ユーザー名で検索
    // image.pngに、usersテーブルにusername, passwordカラムがあることが確認できる
    const query = 'SELECT * FROM master_data.users WHERE username = $1';
    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません' });
    }

    const user = result.rows[0];

    // パスワード比較 (Server側でハッシュ化して比較)
    // DB内が平文の場合でも bcrypt.compare は失敗するため、
    // 実運用では初回登録時にハッシュ化して保存しておく必要があります。
    // ここでは安全のため bcrypt.compare を使用します。
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      // 認証成功
      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ success: true, token, user: { username: user.username, displayName: user.display_name } });
    } else {
      // パスワード不一致
      res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});



app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
