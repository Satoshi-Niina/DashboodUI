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

// データベースから設定を取得するヘルパー関数
async function getConfigFromDB(key, defaultValue) {
  try {
    const query = 'SELECT config_value FROM master_data.app_config WHERE config_key = $1';
    const result = await pool.query(query, [key]);
    return result.rows.length > 0 ? result.rows[0].config_value : (process.env[key.toUpperCase()] || defaultValue);
  } catch (err) {
    console.error(`Failed to get config ${key}:`, err);
    return process.env[key.toUpperCase()] || defaultValue;
  }
}

// すべての設定を取得
async function getAllConfig() {
  try {
    const query = 'SELECT config_key, config_value FROM master_data.app_config';
    const result = await pool.query(query);
    const config = {};
    result.rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    return config;
  } catch (err) {
    console.error('Failed to get all config:', err);
    return {};
  }
}

// Config Endpoint (データベースまたは環境変数から動的に生成)
app.get('/config.js', async (req, res) => {
  try {
    const emergency = await getConfigFromDB('app_url_emergency', 'http://localhost:3001');
    const planning = await getConfigFromDB('app_url_planning', 'http://localhost:3002');
    const equipment = await getConfigFromDB('app_url_equipment', 'http://localhost:3003');
    const failure = await getConfigFromDB('app_url_failure', 'http://localhost:3004');

    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      /**
       * アプリケーション設定ファイル (Server Generated)
       * データベースから動的に読み込まれています。
       */
      const AppConfig = {
          // トークンをURLパラメータとして渡すときのキー名
          tokenParamName: 'auth_token',

          // 各アプリケーションのエンドポイント設定
          endpoints: {
              // 応急復旧支援システム
              emergency: '${emergency}',
              
              // 計画・実績管理システム
              planning: '${planning}',
              
              // 保守用車管理システム
              equipment: '${equipment}',
              
              // 機械故障管理システム
              failure: '${failure}'
          }
      };
    `);
  } catch (err) {
    console.error('Failed to generate config:', err);
    res.status(500).send('// Failed to load configuration');
  }
});

// ルートパスへのアクセス時はログイン画面を表示
// express.staticより先に記述することでindex.htmlの自動配信を防ぐ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.use(express.static(path.join(__dirname)));

// Database Pool
// Cloud Run環境では環境変数から個別に取得するか、接続文字列を使用
const isProduction = process.env.NODE_ENV === 'production';
const pool = isProduction && process.env.CLOUD_SQL_CONNECTION_NAME ? new Pool({
  host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`,
  user: process.env.DB_USER || 'postgresql',
  password: process.env.DB_PASSWORD || 'Takabeni',
  database: process.env.DB_NAME || 'webappdb',
  max: 5,
}) : new Pool({
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



// トークン検証エンドポイント (他のアプリがトークンを検証するために使用)
app.post('/api/verify-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'トークンが提供されていません' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ユーザー情報を取得
    const query = 'SELECT id, username, display_name FROM master_data.users WHERE id = $1';
    const result = await pool.query(query, [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    const user = result.rows[0];
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        displayName: user.display_name 
      } 
    });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ success: false, message: 'トークンが無効または期限切れです' });
  }
});

// トークンリフレッシュエンドポイント (有効期限を延長)
app.post('/api/refresh-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'トークンが提供されていません' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 新しいトークンを発行
    const newToken = jwt.sign(
      { id: decoded.id, username: decoded.username }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    res.json({ success: true, token: newToken });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(401).json({ success: false, message: 'トークンが無効または期限切れです' });
  }
});



// 設定取得エンドポイント（管理画面用）
app.get('/api/config', async (req, res) => {
  try {
    const config = await getAllConfig();
    res.json({ success: true, config });
  } catch (err) {
    console.error('Config get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 設定更新エンドポイント（管理画面用）
app.post('/api/config', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
    // トークンを検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ユーザー情報を取得
    const userQuery = 'SELECT username FROM master_data.users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    const username = userResult.rows[0].username;
    const configData = req.body;

    // 設定を更新
    for (const [key, value] of Object.entries(configData)) {
      if (value !== undefined && value !== null) {
        // 既存の値を取得（履歴用）
        const oldValueQuery = 'SELECT config_value FROM master_data.app_config WHERE config_key = $1';
        const oldValueResult = await pool.query(oldValueQuery, [key]);
        const oldValue = oldValueResult.rows.length > 0 ? oldValueResult.rows[0].config_value : null;

        // 設定を更新または挿入
        const upsertQuery = `
          INSERT INTO master_data.app_config (config_key, config_value, updated_by, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (config_key) 
          DO UPDATE SET 
            config_value = EXCLUDED.config_value,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP
        `;
        await pool.query(upsertQuery, [key, value, username]);

        // 履歴を記録
        const historyQuery = `
          INSERT INTO master_data.app_config_history (config_key, old_value, new_value, updated_by)
          VALUES ($1, $2, $3, $4)
        `;
        await pool.query(historyQuery, [key, oldValue, value, username]);
      }
    }

    res.json({ success: true, message: '設定を更新しました' });
  } catch (err) {
    console.error('Config update error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 設定変更履歴取得エンドポイント
app.get('/api/config/history', async (req, res) => {
  try {
    const query = `
      SELECT config_key, old_value, new_value, updated_by, updated_at
      FROM master_data.app_config_history
      ORDER BY updated_at DESC
      LIMIT 20
    `;
    const result = await pool.query(query);
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error('History get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});



// ユーザー一覧取得エンドポイント
app.get('/api/users', async (req, res) => {
  try {
    const query = 'SELECT id, username, display_name, created_at FROM master_data.users ORDER BY id ASC';
    const result = await pool.query(query);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Users get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー詳細取得エンドポイント
app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const query = 'SELECT id, username, display_name FROM master_data.users WHERE id = $1';
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('User get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー追加エンドポイント
app.post('/api/users', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
    // トークンを検証
    jwt.verify(token, process.env.JWT_SECRET);
    
    const { username, display_name, password } = req.body;

    // バリデーション
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'ユーザー名とパスワードは必須です' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'パスワードは8文字以上で入力してください' });
    }

    // ユーザー名の重複チェック
    const checkQuery = 'SELECT id FROM master_data.users WHERE username = $1';
    const checkResult = await pool.query(checkQuery, [username]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています' });
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーを追加
    const insertQuery = `
      INSERT INTO master_data.users (username, password, display_name)
      VALUES ($1, $2, $3)
      RETURNING id, username, display_name
    `;
    const result = await pool.query(insertQuery, [username, hashedPassword, display_name || null]);

    res.json({ success: true, user: result.rows[0], message: 'ユーザーを追加しました' });
  } catch (err) {
    console.error('User create error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー更新エンドポイント
app.put('/api/users/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.params.id;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
    // トークンを検証
    jwt.verify(token, process.env.JWT_SECRET);
    
    const { username, display_name, password } = req.body;

    // バリデーション
    if (!username) {
      return res.status(400).json({ success: false, message: 'ユーザー名は必須です' });
    }

    // ユーザー名の重複チェック（自分以外）
    const checkQuery = 'SELECT id FROM master_data.users WHERE username = $1 AND id != $2';
    const checkResult = await pool.query(checkQuery, [username, userId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています' });
    }

    // パスワードが指定されている場合
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'パスワードは8文字以上で入力してください' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const updateQuery = `
        UPDATE master_data.users 
        SET username = $1, display_name = $2, password = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, username, display_name
      `;
      const result = await pool.query(updateQuery, [username, display_name || null, hashedPassword, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
      }

      res.json({ success: true, user: result.rows[0], message: 'ユーザーを更新しました' });
    } else {
      // パスワードを変更しない場合
      const updateQuery = `
        UPDATE master_data.users 
        SET username = $1, display_name = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, username, display_name
      `;
      const result = await pool.query(updateQuery, [username, display_name || null, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
      }

      res.json({ success: true, user: result.rows[0], message: 'ユーザーを更新しました' });
    }
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー削除エンドポイント
app.delete('/api/users/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.params.id;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
    // トークンを検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 自分自身を削除しようとしていないかチェック
    if (decoded.id === parseInt(userId)) {
      return res.status(400).json({ success: false, message: '自分自身は削除できません' });
    }

    // ユーザーを削除
    const deleteQuery = 'DELETE FROM master_data.users WHERE id = $1 RETURNING username';
    const result = await pool.query(deleteQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    res.json({ success: true, message: 'ユーザーを削除しました' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});



app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
