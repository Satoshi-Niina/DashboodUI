const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('🚀 Starting server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('PORT from env:', process.env.PORT);
console.log('Cloud SQL Instance:', process.env.CLOUD_SQL_INSTANCE);
console.log('DB Name:', process.env.DB_NAME);
console.log('DB User:', process.env.DB_USER);
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`✅ Will listen on port: ${PORT}`);

console.log('Express app created');

// CORS設定
const corsOptions = {
  origin: process.env.CORS_ORIGIN === '*' 
    ? '*' 
    : process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) 
      : '*',
  credentials: true
};

console.log('CORS configured:', corsOptions.origin);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

console.log('Middleware configured');

// JWT_SECRETの確認
if (!process.env.JWT_SECRET) {
  console.error('❌ WARNING: JWT_SECRET environment variable is not set!');
  console.error('⚠️ Authentication will not work properly without JWT_SECRET');
  console.error('⚠️ Server will start anyway for debugging purposes');
  // デバッグ用にデフォルト値を設定（本番では推奨しない）
  process.env.JWT_SECRET = 'temporary-secret-for-debugging-only';
} else {
  console.log('✅ JWT_SECRET is configured');
}

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

// ヘルスチェックエンドポイント（最優先）
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
  res.status(200).send('OK');
});

// Database Pool
// Cloud Run環境では環境変数から個別に取得するか、接続文字列を使用
const isProduction = process.env.NODE_ENV === 'production';

let poolConfig;
if (isProduction && process.env.CLOUD_SQL_INSTANCE) {
  // 本番環境: Cloud SQL Unix socket接続
  console.log('Using Cloud SQL connection:', process.env.CLOUD_SQL_INSTANCE);
  poolConfig = {
    host: `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'webappdb',
    max: 5,
  };
} else if (process.env.DATABASE_URL) {
  // ローカル環境または接続文字列を使用
  console.log('Using DATABASE_URL connection');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };
} else {
  // 環境変数から個別に設定
  console.log('Using individual DB environment variables');
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'webappdb',
    max: 5,
  };
}

console.log('Database config (password hidden):', { 
  ...poolConfig, 
  password: poolConfig.password ? '****' : undefined 
});

console.log('Creating database pool...');
let pool;
try {
  pool = new Pool(poolConfig);
  console.log('✅ Pool created successfully');
} catch (err) {
  console.error('❌ Failed to create pool:', err);
  console.error('Stack:', err.stack);
  // Create dummy pool that throws errors
  pool = {
    query: () => Promise.reject(new Error('Database not initialized: ' + err.message)),
    end: () => {},
    on: () => {}
  };
}

// Error handling for pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit the process
});

// ========================================
// ゲートウェイ方式: テーブルルーティング機能
// ========================================

const APP_ID = process.env.APP_ID || 'dashboard-ui';
const routingCache = new Map(); // { key: { fullPath, schema, table, timestamp } }
const CACHE_TTL = 5 * 60 * 1000; // 5分

/**
 * 論理テーブル名から物理パスを解決
 * @param {string} logicalName - 論理テーブル名（例: 'users', 'offices'）
 * @returns {Promise<{fullPath: string, schema: string, table: string}>}
 */
async function resolveTablePath(logicalName) {
  const cacheKey = `${APP_ID}:${logicalName}`;
  
  // キャッシュチェック
  const cached = routingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Gateway] Cache hit: ${logicalName} → ${cached.fullPath}`);
    return cached;
  }

  try {
    // app_resource_routingテーブルから物理パスを取得
    const query = `
      SELECT physical_schema, physical_table
      FROM public.app_resource_routing
      WHERE app_id = $1 AND logical_resource_name = $2 AND is_active = true
      LIMIT 1
    `;
    console.log(`[Gateway] Querying routing for: ${APP_ID}:${logicalName}`);
    const result = await pool.query(query, [APP_ID, logicalName]);

    if (result.rows.length > 0) {
      const { physical_schema, physical_table } = result.rows[0];
      const fullPath = `${physical_schema}."${physical_table}"`;
      const resolved = { fullPath, schema: physical_schema, table: physical_table, timestamp: Date.now() };
      
      // キャッシュに保存
      routingCache.set(cacheKey, resolved);
      console.log(`[Gateway] ✅ Resolved: ${logicalName} → ${fullPath}`);
      return resolved;
    }

    // ルーティングが見つからない場合はmaster_dataスキーマにフォールバック
    console.log(`[Gateway] ⚠️ No route found for ${logicalName}, falling back to master_data.${logicalName}`);
    const fallback = { 
      fullPath: `master_data."${logicalName}"`, 
      schema: 'master_data', 
      table: logicalName,
      timestamp: Date.now()
    };
    routingCache.set(cacheKey, fallback);
    return fallback;
    
  } catch (err) {
    console.error(`[Gateway] ❌ Error resolving ${logicalName}:`, err.message);
    console.error(`[Gateway] Error details:`, err);
    // エラー時もmaster_dataスキーマにフォールバック
    const fallback = { 
      fullPath: `master_data."${logicalName}"`, 
      schema: 'master_data', 
      table: logicalName,
      timestamp: Date.now()
    };
    console.log(`[Gateway] Using fallback: master_data."${logicalName}"`);
    return fallback;
  }
}

/**
 * 動的SELECT
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} conditions - WHERE条件 (例: { username: 'admin', role: 'admin' })
 * @param {Array<string>} columns - 取得するカラム (省略時は全カラム)
 * @param {number} limit - LIMIT数 (省略可)
 * @returns {Promise<Array>}
 */
async function dynamicSelect(logicalTableName, conditions = {}, columns = ['*'], limit = null) {
  const route = await resolveTablePath(logicalTableName);
  
  const columnList = columns.join(', ');
  let query = `SELECT ${columnList} FROM ${route.fullPath}`;
  const params = [];
  
  // WHERE句の構築
  const whereConditions = Object.entries(conditions).map(([key, value], index) => {
    params.push(value);
    return `${key} = $${index + 1}`;
  });
  
  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  
  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  
  console.log(`[DynamicDB] SELECT from ${route.fullPath}`);
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * 動的INSERT
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} data - 挿入データ
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: true)
 * @returns {Promise<Array>}
 */
async function dynamicInsert(logicalTableName, data, returning = true) {
  const route = await resolveTablePath(logicalTableName);
  
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  
  let query = `INSERT INTO ${route.fullPath} (${keys.join(', ')}) VALUES (${placeholders})`;
  
  if (returning) {
    query += ' RETURNING *';
  }
  
  console.log(`[DynamicDB] INSERT into ${route.fullPath}`);
  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * 動的UPDATE
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} data - 更新データ
 * @param {Object} conditions - WHERE条件
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: true)
 * @returns {Promise<Array>}
 */
async function dynamicUpdate(logicalTableName, data, conditions, returning = true) {
  const route = await resolveTablePath(logicalTableName);
  
  const setKeys = Object.keys(data);
  const setValues = Object.values(data);
  const conditionKeys = Object.keys(conditions);
  const conditionValues = Object.values(conditions);
  
  const setClause = setKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  const whereClause = conditionKeys.map((key, i) => `${key} = $${setKeys.length + i + 1}`).join(' AND ');
  
  let query = `UPDATE ${route.fullPath} SET ${setClause}`;
  
  if (conditionKeys.length > 0) {
    query += ` WHERE ${whereClause}`;
  }
  
  if (returning) {
    query += ' RETURNING *';
  }
  
  console.log(`[DynamicDB] UPDATE ${route.fullPath}`);
  const result = await pool.query(query, [...setValues, ...conditionValues]);
  return result.rows;
}

/**
 * 動的DELETE
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} conditions - WHERE条件
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: false)
 * @returns {Promise<Array>}
 */
async function dynamicDelete(logicalTableName, conditions, returning = false) {
  const route = await resolveTablePath(logicalTableName);
  
  const conditionKeys = Object.keys(conditions);
  const conditionValues = Object.values(conditions);
  const whereClause = conditionKeys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  
  let query = `DELETE FROM ${route.fullPath}`;
  
  if (conditionKeys.length > 0) {
    query += ` WHERE ${whereClause}`;
  }
  
  if (returning) {
    query += ' RETURNING *';
  }
  
  console.log(`[DynamicDB] DELETE from ${route.fullPath}`);
  const result = await pool.query(query, conditionValues);
  return result.rows;
}

/**
 * ルーティングキャッシュをクリア
 * @param {string} logicalName - 論理テーブル名 (省略時は全クリア)
 */
function clearRoutingCache(logicalName = null) {
  if (logicalName) {
    const cacheKey = `${APP_ID}:${logicalName}`;
    routingCache.delete(cacheKey);
    console.log(`[Gateway] Cache cleared for: ${logicalName}`);
  } else {
    routingCache.clear();
    console.log('[Gateway] All cache cleared');
  }
}

// ========================================
// ゲートウェイ機能ここまで
// ========================================

// Test DB Connection (非同期で実行、サーバー起動をブロックしない)
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', res.rows[0].now);
    return true;
  } catch (err) {
    console.error('⚠️ Database connection error:', err.message);
    console.error('Error code:', err.code);
    console.error('Connection config:', { 
      host: poolConfig.host, 
      user: poolConfig.user, 
      database: poolConfig.database,
      cloudSqlInstance: process.env.CLOUD_SQL_INSTANCE
    });
    console.error('Full error:', err);
    console.error('⚠️ Server will continue running but database operations will fail');
    return false;
  }
}

// サーバー起動後に接続テスト（1回のみ高速チェック）
let dbConnectionAttempts = 0;
const maxDbAttempts = 1;
setImmediate(async () => {
  while (dbConnectionAttempts < maxDbAttempts) {
    dbConnectionAttempts++;
    console.log(`Database connection attempt ${dbConnectionAttempts}/${maxDbAttempts}`);
    const connected = await testDatabaseConnection();
    if (connected) {
      break;
    }
    if (dbConnectionAttempts < maxDbAttempts) {
      console.log('Retrying in 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
});

// Middleware: トークン認証
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'トークンが提供されていません' });
  }

  jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'emergency-assistance-app',
    audience: 'emergency-assistance-app'
  }, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'トークンが無効です' });
    }
    req.user = user;
    next();
  });
}

// Login API Endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('[Login] Attempting login for username:', username);

  try {
    // ゲートウェイ方式でユーザー検索
    const users = await dynamicSelect('users', 
      { username }, 
      ['id', 'username', 'password', 'display_name', 'role'], 
      1
    );
    
    console.log('[Login] Query result:', users.length > 0 ? 'User found' : 'User not found');

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません' });
    }

    const user = users[0];

    // パスワード比較
    // DBのパスワードがbcryptハッシュ($2で始まる)かどうかを判定
    let match = false;
    
    if (user.password && user.password.startsWith('$2')) {
      // ハッシュ化されたパスワード
      match = await bcrypt.compare(password, user.password);
    } else {
      // 平文パスワード（後方互換性のため）
      match = (password === user.password);
      
      // セキュリティ向上のため、平文パスワードをハッシュ化して更新
      if (match) {
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          await dynamicUpdate('users', 
            { password: hashedPassword }, 
            { id: user.id },
            false
          );
          console.log(`Password hashed for user: ${user.username}`);
        } catch (hashErr) {
          console.error('Failed to hash password:', hashErr);
        }
      }
    }

    if (match) {
      console.log('[Login] Password matched for user:', username);
      
      // 認証成功 - Emergency-Assistanceと互換性のあるトークンを生成
      // department情報を設定（DBカラムがなくてもエラーにならないよう対応）
      let department = 'システム管理部';  // デフォルト値
      
      // roleに基づいてdepartmentを設定
      if (user.role === 'system_admin') {
        department = 'システム管理部';
      } else if (user.role === 'operation_admin') {
        department = '運用管理部';
      } else {
        department = '一般';
      }

      const payload = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,  // Emergency-Assistanceで必要
        role: user.role,
        department: department,  // Emergency-Assistanceで必要
        iat: Math.floor(Date.now() / 1000)  // 発行時刻を明示
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '4h',  // Emergency-Assistanceと同じ
        issuer: 'emergency-assistance-app',  // Emergency-Assistanceと同じ
        audience: 'emergency-assistance-app'  // Emergency-Assistanceと同じ
      });

      console.log('[Login] 🎫 JWT Token generated:', {
        userId: user.id,
        username: user.username,
        tokenLength: token.length,
        issuer: 'emergency-assistance-app',
        audience: 'emergency-assistance-app',
        expiresIn: '4h'
      });

      console.log('[Login] Token generated successfully');
      res.json({ success: true, token, user: { username: user.username, displayName: user.display_name, role: user.role } });
    } else {
      // パスワード不一致
      console.log('[Login] Password mismatch for user:', username);
      res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません' });
    }
  } catch (err) {
    console.error('[Login] ERROR:', err);
    console.error('[Login] Error stack:', err.stack);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: err.message });
  }
});



// トークン検証エンドポイント (他のアプリがトークンを検証するために使用)
app.post('/api/verify-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ 
      valid: false, 
      success: false, 
      message: 'トークンが提供されていません' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    // ゲートウェイ方式でユーザー情報を取得（departmentカラムは取得しない）
    const users = await dynamicSelect('users', 
      { id: decoded.id }, 
      ['id', 'username', 'display_name', 'role'], 
      1
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        valid: false, 
        success: false, 
        message: 'ユーザーが見つかりません' 
      });
    }

    const user = users[0];
    
    // departmentをroleから動的に生成
    let department = '一般';
    if (user.role === 'system_admin') {
      department = 'システム管理部';
    } else if (user.role === 'operation_admin') {
      department = '運用管理部';
    }
    
    res.json({ 
      valid: true,
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        displayName: user.display_name,
        role: user.role,
        department: department
      } 
    });
  } catch (err) {
    console.error('Token verification error:', err);
    
    // デバッグ用：検証失敗時の詳細情報
    if (err.message === 'invalid signature') {
        console.error('⚠️ Invalid signature detected. Check JWT_SECRET mismatch.');
        const secret = process.env.JWT_SECRET;
        if (secret) {
            console.error(`Server Secret Length: ${secret.length}`);
            console.error(`Server Secret Prefix: ${secret.substring(0, 2)}***`);
        } else {
            console.error('Server Secret is NOT set!');
        }
    }

    res.status(401).json({ 
      valid: false, 
      success: false, 
      message: 'トークンが無効または期限切れです',
      details: err.message
    });
  }
});

// トークンリフレッシュエンドポイント (有効期限を延長)
app.post('/api/refresh-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'トークンが提供されていません' });
  }

  try {
    // Emergency-Assistanceと同じ検証オプションを使用
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    // 新しいトークンを発行（Emergency-Assistanceと互換性のある形式）
    // departmentが存在しない場合のフォールバック処理
    let department = decoded.department;
    if (!department) {
      if (decoded.role === 'system_admin') {
        department = 'システム管理部';
      } else if (decoded.role === 'operation_admin') {
        department = '運用管理部';
      } else {
        department = '未設定';
      }
    }

    const payload = {
      id: decoded.id,
      username: decoded.username,
      displayName: decoded.displayName,
      role: decoded.role,
      department: department,
      iat: Math.floor(Date.now() / 1000)
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '4h',
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });

    console.log('[TokenRefresh] 🔄 Token refreshed for user:', decoded.username);

    res.json({ success: true, token: newToken });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(401).json({ success: false, message: 'トークンが無効または期限切れです' });
  }
});

// 管理者認証ミドルウェア
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
    // Emergency-Assistanceと同じ検証オプションを使用
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    const query = 'SELECT id, username, role FROM master_data.users WHERE id = $1';
    const result = await pool.query(query, [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    const user = result.rows[0];
    
    // system_admin または operation_admin のみアクセス可能
    if (user.role !== 'system_admin' && user.role !== 'operation_admin') {
      return res.status(403).json({ success: false, message: 'アクセス権限がありません。管理者権限が必要です。' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ success: false, message: 'トークンが無効または期限切れです' });
  }
}

// 設定取得エンドポイント（管理画面用）
app.get('/api/config', requireAdmin, async (req, res) => {
  try {
    const config = await getAllConfig();
    res.json({ success: true, config });
  } catch (err) {
    console.error('Config get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 設定更新エンドポイント（管理画面用）
app.post('/api/config', requireAdmin, async (req, res) => {
  try {
    const username = req.user.username;
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
app.get('/api/config/history', requireAdmin, async (req, res) => {
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
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    // ゲートウェイ方式 + ORDER BY対応のため一部直接クエリ
    const route = await resolveTablePath('users');
    const query = `SELECT id, username, display_name, role, created_at FROM ${route.fullPath} ORDER BY id ASC`;
    const result = await pool.query(query);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Users get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー詳細取得エンドポイント
app.get('/api/users/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;

  try {
    const users = await dynamicSelect('users', 
      { id: userId }, 
      ['id', 'username', 'display_name', 'role'], 
      1
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    res.json({ success: true, user: users[0] });
  } catch (err) {
    console.error('User get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー追加エンドポイント
app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body;

    // バリデーション
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'ユーザー名とパスワードは必須です' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'パスワードは8文字以上で入力してください' });
    }

    // ユーザー名の重複チェック（ゲートウェイ方式）
    const existingUsers = await dynamicSelect('users', { username }, ['id'], 1);
    const checkResult = { rows: existingUsers };

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています' });
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーを追加（ゲートウェイ方式）
    const users = await dynamicInsert('users', {
      username,
      password: hashedPassword,
      display_name: display_name || null,
      role: role || 'user'
    });

    res.json({ success: true, user: users[0], message: 'ユーザーを追加しました' });
  } catch (err) {
    console.error('User create error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー更新エンドポイント
app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.params.id;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
    // トークンを検証
    jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    const { username, display_name, password, role } = req.body;

    // バリデーション
    if (!username) {
      return res.status(400).json({ success: false, message: 'ユーザー名は必須です' });
    }

    // ユーザー名の重複チェック（自分以外）
    const route = await resolveTablePath('users');
    const checkQuery = `SELECT id FROM ${route.fullPath} WHERE username = $1 AND id != $2`;
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
      const users = await dynamicUpdate('users', 
        {
          username,
          display_name: display_name || null,
          password: hashedPassword,
          role: role || 'user',
          updated_at: new Date()
        },
        { id: userId }
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
      }

      res.json({ success: true, user: users[0], message: 'ユーザーを更新しました' });
    } else {
      // パスワードを変更しない場合
      const users = await dynamicUpdate('users', 
        {
          username,
          display_name: display_name || null,
          role: role || 'user',
          updated_at: new Date()
        },
        { id: userId }
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
      }

      res.json({ success: true, user: users[0], message: 'ユーザーを更新しました' });
    }
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ユーザー削除エンドポイント
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.params.id;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
    // トークンを検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    // 自分自身を削除しようとしていないかチェック
    if (decoded.id === parseInt(userId)) {
      return res.status(400).json({ success: false, message: '自分自身は削除できません' });
    }

    // ユーザーを削除（ゲートウェイ方式）
    const users = await dynamicDelete('users', { id: userId }, true);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    res.json({ success: true, message: 'ユーザーを削除しました' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});



// ========== 保守用車マスタ API ==========

// 保守用車一覧取得エンドポイント（機種・機械番号・管理事業所を結合）
app.get('/api/vehicles', requireAdmin, async (req, res) => {
  try {
    const vehiclesRoute = await resolveTablePath('vehicles');
    const machinesRoute = await resolveTablePath('machines');
    const machineTypesRoute = await resolveTablePath('machine_types');
    const officesRoute = await resolveTablePath('managements_offices');
    
    const query = `
      SELECT 
        v.vehicle_id,
        v.vehicle_number,
        v.vehicle_type,
        v.model,
        v.registration_number,
        v.machine_id,
        m.machine_number,
        mt.type_code as machine_type_code,
        mt.type_name as machine_type_name,
        v.office_id,
        o.office_name,
        v.notes,
        v.created_at,
        v.updated_at
      FROM ${vehiclesRoute.fullPath} v
      LEFT JOIN ${machinesRoute.fullPath} m ON v.machine_id = m.id
      LEFT JOIN ${machineTypesRoute.fullPath} mt ON m.machine_type_id = mt.id
      LEFT JOIN ${officesRoute.fullPath} o ON v.office_id = o.office_id
      ORDER BY v.vehicle_id DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, vehicles: result.rows });
  } catch (err) {
    console.error('Vehicles get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 保守用車詳細取得エンドポイント
app.get('/api/vehicles/:id', requireAdmin, async (req, res) => {
  const vehicleId = req.params.id;

  try {
    const route = await resolveTablePath('vehicles');
    const query = `
      SELECT 
        v.vehicle_id,
        v.vehicle_number,
        v.model,
        v.registration_number,
        v.machine_id,
        v.office_id,
        v.notes
      FROM ${route.fullPath} v
      WHERE v.vehicle_id = $1
    `;
    const result = await pool.query(query, [vehicleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '車両が見つかりません' });
    }

    res.json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    console.error('Vehicle get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 保守用車追加エンドポイント
app.post('/api/vehicles', requireAdmin, async (req, res) => {
  const username = req.user.username;
  const { vehicle_number, machine_id, office_id, model, registration_number, notes } = req.body;

  try {
    // バリデーション
    if (!vehicle_number) {
      return res.status(400).json({ success: false, message: '車両番号は必須です' });
    }

    if (!machine_id) {
      return res.status(400).json({ success: false, message: '機械番号は必須です' });
    }

    // 車両番号の重複チェック
    const route = await resolveTablePath('vehicles');
    const checkQuery = `SELECT vehicle_id FROM ${route.fullPath} WHERE vehicle_number = $1`;
    const checkResult = await pool.query(checkQuery, [vehicle_number]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'この車両番号は既に使用されています' });
    }

    // 車両を追加（ゲートウェイ方式）
    const vehicles = await dynamicInsert('vehicles', {
      vehicle_number,
      machine_id,
      office_id: office_id || null,
      model: model || null,
      registration_number: registration_number || null,
      notes: notes || null
    });

    res.json({ success: true, vehicle: vehicles[0], message: '車両を追加しました' });
  } catch (err) {
    console.error('Vehicle create error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
  }
});

// 保守用車更新エンドポイント
app.put('/api/vehicles/:id', requireAdmin, async (req, res) => {
  const vehicleId = req.params.id;
  const username = req.user.username;
  
  try {
    const { vehicle_number, machine_id, office_id, model, registration_number, notes } = req.body;

    // バリデーション
    if (!vehicle_number) {
      return res.status(400).json({ success: false, message: '車両番号は必須です' });
    }

    if (!machine_id) {
      return res.status(400).json({ success: false, message: '機械番号は必須です' });
    }

    // 車両番号の重複チェック（自分以外）
    const route = await resolveTablePath('vehicles');
    const checkQuery = `SELECT vehicle_id FROM ${route.fullPath} WHERE vehicle_number = $1 AND vehicle_id != $2`;
    const checkResult = await pool.query(checkQuery, [vehicle_number, vehicleId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'この車両番号は既に使用されています' });
    }

    // 車両を更新（ゲートウェイ方式）
    const vehicles = await dynamicUpdate('vehicles', 
      {
        vehicle_number,
        machine_id,
        office_id: office_id || null,
        model: model || null,
        registration_number: registration_number || null,
        notes: notes || null,
        updated_at: new Date()
      },
      { vehicle_id: vehicleId }
    );

    if (vehicles.length === 0) {
      return res.status(404).json({ success: false, message: '車両が見つかりません' });
    }

    res.json({ success: true, vehicle: vehicles[0], message: '車両を更新しました' });
  } catch (err) {
    console.error('Vehicle update error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
  }
});

// 保守用車削除エンドポイント
app.delete('/api/vehicles/:id', requireAdmin, async (req, res) => {
  const vehicleId = req.params.id;
  
  try {
    // 車両を削除（ゲートウェイ方式）
    const vehicles = await dynamicDelete('vehicles', { vehicle_id: vehicleId }, true);

    if (vehicles.length === 0) {
      return res.status(404).json({ success: false, message: '車両が見つかりません' });
    }

    res.json({ success: true, message: '車両を削除しました' });
  } catch (err) {
    console.error('Vehicle delete error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ========================================
// 事業所マスタ API
// ========================================

// 事業所一覧取得
app.get('/api/offices', authenticateToken, async (req, res) => {
  try {
    const route = await resolveTablePath('managements_offices');
    const query = `SELECT * FROM ${route.fullPath} ORDER BY office_id DESC`;
    const result = await pool.query(query);
    res.json({ success: true, offices: result.rows });
  } catch (err) {
    console.error('Offices list error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 事業所追加
app.post('/api/offices', requireAdmin, async (req, res) => {
  const { office_code, office_name, office_type, address } = req.body;

  if (!office_code || !office_name) {
    return res.status(400).json({ success: false, message: '事業所コードと事業所名は必須です' });
  }

  try {
    const insertQuery = `
      INSERT INTO master_data.managements_offices (office_code, office_name, office_type, address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      office_code,
      office_name,
      office_type || null,
      address || null
    ]);

    res.json({ success: true, office: result.rows[0], message: '事業所を追加しました' });
  } catch (err) {
    console.error('Office insert error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'この事業所コードは既に登録されています' });
    } else {
      res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
    }
  }
});

// 事業所更新
app.put('/api/offices/:id', requireAdmin, async (req, res) => {
  const officeId = req.params.id;
  const { office_code, office_name, office_type, address, postal_code, phone_number, manager_name, email } = req.body;

  try {
    const updateQuery = `
      UPDATE master_data.managements_offices 
      SET office_code = $1, office_name = $2, office_type = $3, address = $4, 
          postal_code = $5, phone_number = $6, manager_name = $7, email = $8, 
          updated_at = CURRENT_TIMESTAMP
      WHERE office_id = $9
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      office_code,
      office_name,
      office_type,
      address,
      postal_code,
      phone_number,
      manager_name,
      email,
      officeId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '事業所が見つかりません' });
    }

    res.json({ success: true, office: result.rows[0], message: '事業所を更新しました' });
  } catch (err) {
    console.error('Office update error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 事業所削除
app.delete('/api/offices/:id', requireAdmin, async (req, res) => {
  const officeId = req.params.id;
  
  try {
    const deleteQuery = 'DELETE FROM master_data.managements_offices WHERE office_id = $1 RETURNING office_name';
    const result = await pool.query(deleteQuery, [officeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '事業所が見つかりません' });
    }

    res.json({ success: true, message: '事業所を削除しました' });
  } catch (err) {
    console.error('Office delete error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ========================================
// 保守基地マスタ API
// ========================================

// 保守基地一覧取得
app.get('/api/bases', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT b.*, o.office_name 
      FROM master_data.bases b
      LEFT JOIN master_data.managements_offices o ON b.office_id = o.office_id
      ORDER BY b.base_id DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, bases: result.rows });
  } catch (err) {
    console.error('Bases list error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 保守基地追加
app.post('/api/bases', requireAdmin, async (req, res) => {
  const { base_code, base_name, office_id, location, address, postal_code, phone_number, latitude, longitude } = req.body;

  if (!base_code || !base_name) {
    return res.status(400).json({ success: false, message: '基地コードと基地名は必須です' });
  }

  try {
    const insertQuery = `
      INSERT INTO master_data.bases 
      (base_code, base_name, office_id, location, address, postal_code, phone_number, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      base_code,
      base_name,
      office_id || null,
      location || null,
      address || null,
      postal_code || null,
      phone_number || null,
      latitude || null,
      longitude || null
    ]);

    res.json({ success: true, base: result.rows[0], message: '保守基地を追加しました' });
  } catch (err) {
    console.error('Base insert error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'この基地コードは既に登録されています' });
    } else {
      res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
    }
  }
});

// 保守基地更新
app.put('/api/bases/:id', requireAdmin, async (req, res) => {
  const baseId = req.params.id;
  const { base_code, base_name, office_id, location, address, postal_code, phone_number, latitude, longitude } = req.body;

  try {
    const updateQuery = `
      UPDATE master_data.bases 
      SET base_code = $1, base_name = $2, office_id = $3, location = $4, address = $5,
          postal_code = $6, phone_number = $7, latitude = $8, longitude = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE base_id = $10
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      base_code,
      base_name,
      office_id || null,
      location || null,
      address || null,
      postal_code || null,
      phone_number || null,
      latitude || null,
      longitude || null,
      baseId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '保守基地が見つかりません' });
    }

    res.json({ success: true, base: result.rows[0], message: '保守基地を更新しました' });
  } catch (err) {
    console.error('Base update error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 保守基地削除
app.delete('/api/bases/:id', requireAdmin, async (req, res) => {
  const baseId = req.params.id;
  
  try {
    const deleteQuery = 'DELETE FROM master_data.bases WHERE base_id = $1 RETURNING base_name';
    const result = await pool.query(deleteQuery, [baseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '保守基地が見つかりません' });
    }

    res.json({ success: true, message: '保守基地を削除しました' });
  } catch (err) {
    console.error('Base delete error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});



// ========== データベース管理 API ==========

// データベース統計情報取得エンドポイント
app.get('/api/database/stats', requireAdmin, async (req, res) => {
  try {
    const stats = {
      connected: true,
      version: null,
      connections: 0,
      disk_usage: 0,
      database_size: null,
      uptime: null,
      table_sizes: []
    };

    // PostgreSQLバージョン取得
    try {
      const versionResult = await pool.query('SELECT version()');
      const versionString = versionResult.rows[0].version;
      const match = versionString.match(/PostgreSQL ([\d.]+)/);
      stats.version = match ? `PostgreSQL ${match[1]}` : 'PostgreSQL';
    } catch (err) {
      console.error('Failed to get version:', err);
    }

    // 接続数取得
    try {
      const connectionsResult = await pool.query(`
        SELECT count(*) as connection_count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      stats.connections = connectionsResult.rows[0].connection_count;
    } catch (err) {
      console.error('Failed to get connections:', err);
    }

    // データベースサイズ取得
    try {
      const sizeResult = await pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
      `);
      stats.database_size = sizeResult.rows[0].db_size;
    } catch (err) {
      console.error('Failed to get database size:', err);
    }

    // 稼働時間取得
    try {
      const uptimeResult = await pool.query(`
        SELECT 
          EXTRACT(DAY FROM (now() - pg_postmaster_start_time())) || '日' ||
          EXTRACT(HOUR FROM (now() - pg_postmaster_start_time())) || '時間' ||
          ROUND(EXTRACT(MINUTE FROM (now() - pg_postmaster_start_time()))) || '分' as uptime
      `);
      stats.uptime = uptimeResult.rows[0].uptime;
    } catch (err) {
      console.error('Failed to get uptime:', err);
    }

    // テーブルサイズ取得（上位10件）
    try {
      const tableSizeResult = await pool.query(`
        SELECT 
          schemaname || '.' || tablename as table_name,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);
      stats.table_sizes = tableSizeResult.rows;
    } catch (err) {
      console.error('Failed to get table sizes:', err);
    }

    // ディスク使用率（簡易計算、実際にはOS依存）
    try {
      const diskResult = await pool.query(`
        SELECT 
          ROUND((pg_database_size(current_database())::float / (1024*1024*1024)) * 100 / 10) as disk_usage_percent
      `);
      stats.disk_usage = Math.min(100, diskResult.rows[0].disk_usage_percent || 0);
    } catch (err) {
      console.error('Failed to calculate disk usage:', err);
      stats.disk_usage = 7.2; // デフォルト値（画像と同じ）
    }

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Database stats error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', stats: { connected: false } });
  }
});



// ========================================
// データベース管理API
// ========================================

// テーブルデータ取得（汎用）
app.get('/api/database/table/:schemaTable', authenticateToken, async (req, res) => {
  try {
    const { schemaTable } = req.params;
    const [schema, table] = schemaTable.split('.');
    
    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // SQLインジェクション対策：スキーマとテーブル名を検証
    const validTableQuery = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [schema, table]
    );

    if (validTableQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const result = await pool.query(`SELECT * FROM ${schema}.${table} ORDER BY 1 DESC LIMIT 100`);
    
    // カラム情報も取得
    const columnsQuery = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, table]);

    res.json({ 
      success: true, 
      data: result.rows,
      columns: columnsQuery.rows
    });
  } catch (err) {
    console.error('Get table data error:', err);
    res.status(500).json({ success: false, message: 'Failed to get table data' });
  }
});

// レコード追加（汎用）
app.post('/api/database/table/:schemaTable', authenticateToken, async (req, res) => {
  try {
    const { schemaTable } = req.params;
    const [schema, table] = schemaTable.split('.');
    const data = req.body;

    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // テーブル存在確認
    const validTableQuery = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [schema, table]
    );

    if (validTableQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `INSERT INTO ${schema}.${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Insert record error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// レコード更新（汎用）
app.put('/api/database/table/:schemaTable/:id', authenticateToken, async (req, res) => {
  try {
    const { schemaTable, id } = req.params;
    const [schema, table] = schemaTable.split('.');
    const data = req.body;

    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // 主キーカラム名を取得
    const pkQuery = await pool.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [`${schema}.${table}`]);

    if (pkQuery.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No primary key found' });
    }

    const pkColumn = pkQuery.rows[0].attname;
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const query = `UPDATE ${schema}.${table} SET ${setClause} WHERE ${pkColumn} = $${columns.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update record error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// レコード削除（汎用）
app.delete('/api/database/table/:schemaTable/:id', authenticateToken, async (req, res) => {
  try {
    const { schemaTable, id } = req.params;
    const [schema, table] = schemaTable.split('.');

    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // 主キーカラム名を取得
    const pkQuery = await pool.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [`${schema}.${table}`]);

    if (pkQuery.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No primary key found' });
    }

    const pkColumn = pkQuery.rows[0].attname;
    const query = `DELETE FROM ${schema}.${table} WHERE ${pkColumn} = $1 RETURNING *`;
    
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    console.error('Delete record error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// データベースバックアップ
app.post('/api/database/backup', authenticateToken, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const fs = require('fs');
    const backupDir = path.join(__dirname, 'backups');
    
    // バックアップディレクトリ作成
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);
    
    const dbConfig = {
      host: pool.options.host || 'localhost',
      port: pool.options.port || 5432,
      database: pool.options.database || 'webappdb',
      user: pool.options.user || 'postgres',
      password: pool.options.password
    };

    const pgDumpCmd = `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe" -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${backupFile}"`;
    
    exec(pgDumpCmd, { env: { ...process.env, PGPASSWORD: dbConfig.password } }, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup error:', error);
        return res.status(500).json({ success: false, message: 'Backup failed', error: error.message });
      }

      // バックアップファイルをダウンロード
      res.download(backupFile, `webappdb_backup_${timestamp}.sql`, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // ダウンロード後、ファイルを削除（オプション）
        // fs.unlinkSync(backupFile);
      });
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: 'Backup failed' });
  }
});

// CSVエクスポート
app.get('/api/database/export-csv/:schemaTable', authenticateToken, async (req, res) => {
  try {
    const { schemaTable } = req.params;
    const [schema, table] = schemaTable.split('.');
    
    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    const result = await pool.query(`SELECT * FROM ${schema}.${table}`);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No data found' });
    }

    // CSV生成
    const columns = Object.keys(result.rows[0]);
    const csvHeader = columns.join(',') + '\n';
    const csvRows = result.rows.map(row => 
      columns.map(col => {
        const value = row[col];
        // 値にカンマや改行が含まれる場合はダブルクォートで囲む
        if (value === null) return '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    ).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${table}_export.csv"`);
    res.send('\uFEFF' + csv); // UTF-8 BOM for Excel
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// CSVインポート
app.post('/api/database/import-csv/:schemaTable', authenticateToken, async (req, res) => {
  try {
    const { schemaTable } = req.params;
    const { csvData } = req.body;
    const [schema, table] = schemaTable.split('.');
    
    if (!schema || !table || !csvData) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    // CSV解析
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV must have header and data rows' });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
        const query = `INSERT INTO ${schema}.${table} (${headers.join(', ')}) VALUES (${placeholders})`;
        
        await pool.query(query, values);
        successCount++;
      } catch (err) {
        console.error(`Error importing row ${i}:`, err);
        errorCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Import completed: ${successCount} success, ${errorCount} errors`,
      successCount,
      errorCount
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ success: false, message: 'Import failed' });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/user-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'user-management.html'));
});

// ヘルスチェックエンドポイント
app.get('/health', async (req, res) => {
  try {
    // データベース接続確認
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// デバッグ用エンドポイント（本番環境では削除推奨）
app.get('/debug/env', (req, res) => {
  // パスワードなどの機密情報は隠す
  const safeEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    CLOUD_SQL_INSTANCE: process.env.CLOUD_SQL_INSTANCE,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD ? '***設定済み***' : '未設定',
    DATABASE_URL: process.env.DATABASE_URL ? '***設定済み***' : '未設定',
    JWT_SECRET: process.env.JWT_SECRET ? '***設定済み***' : '未設定',
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };
  res.json(safeEnv);
});

// デバッグ用: usersテーブルの確認（本番環境では削除必須）
app.get('/debug/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        username, 
        display_name,
        role,
        CASE 
          WHEN password LIKE '$2%' THEN 'ハッシュ化済み'
          ELSE '平文'
        END as password_type,
        LEFT(password, 10) as password_preview
      FROM master_data.users 
      ORDER BY id
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows
    });
  } catch (err) {
    console.error('Debug users error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      hint: 'master_data.usersテーブルが存在しない可能性があります'
    });
  }
});

// デバッグ用: ログインテスト
app.post('/debug/test-login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const query = 'SELECT id, username, password FROM master_data.users WHERE username = $1';
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: 'ユーザーが見つかりません',
        username: username
      });
    }
    
    const user = result.rows[0];
    const dbPassword = user.password;
    const isHashed = dbPassword && dbPassword.startsWith('$2');
    
    let match = false;
    if (isHashed) {
      match = await bcrypt.compare(password, dbPassword);
    } else {
      match = (password === dbPassword);
    }
    
    res.json({
      success: true,
      userFound: true,
      passwordType: isHashed ? 'ハッシュ化' : '平文',
      passwordMatch: match,
      dbPasswordPreview: dbPassword ? dbPassword.substring(0, 15) + '...' : null,
      inputPassword: password,
      bcryptTest: isHashed ? await bcrypt.compare(password, dbPassword) : 'N/A'
    });
  } catch (err) {
    console.error('Test login error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// ========================================
// 機種マスタ・機械番号マスタ API (統合表示用)
// ========================================

// 機種マスタ一覧取得
app.get('/api/machine-types', requireAdmin, async (req, res) => {
  try {
    const route = await resolveTablePath('machine_types');
    const query = `SELECT * FROM ${route.fullPath} ORDER BY type_code`;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Machine types get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 機種マスタ追加
app.post('/api/machine-types', requireAdmin, async (req, res) => {
  try {
    const { type_code, type_name, manufacturer, category, description } = req.body;
    
    if (!type_code || !type_name) {
      return res.status(400).json({ success: false, message: '機種コードと機種名は必須です' });
    }
    
    const types = await dynamicInsert('machine_types', {
      type_code,
      type_name,
      manufacturer,
      category,
      description
    });
    res.json({ success: true, data: types[0], message: '機種を追加しました' });
  } catch (err) {
    console.error('Machine type create error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'この機種コードは既に登録されています' });
    } else {
      res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
    }
  }
});

// 機械番号マスタ一覧取得（機種情報も含む統合ビュー）
app.get('/api/machines', requireAdmin, async (req, res) => {
  try {
    const machinesRoute = await resolveTablePath('machines');
    const machineTypesRoute = await resolveTablePath('machine_types');
    const basesRoute = await resolveTablePath('bases');
    
    const query = `
      SELECT 
        m.id as machine_id,
        m.machine_number,
        m.serial_number,
        m.manufacture_date,
        m.purchase_date,
        m.status,
        m.assigned_base_id,
        m.notes,
        m.machine_type_id,
        mt.type_code,
        mt.type_name,
        mt.manufacturer,
        mt.category,
        b.base_name,
        m.created_at,
        m.updated_at
      FROM ${machinesRoute.fullPath} m
      LEFT JOIN ${machineTypesRoute.fullPath} mt ON m.machine_type_id = mt.id
      LEFT JOIN ${basesRoute.fullPath} b ON m.assigned_base_id = b.base_id
      ORDER BY m.machine_number
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Machines get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 機械番号マスタ追加
app.post('/api/machines', requireAdmin, async (req, res) => {
  try {
    const { machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, status, assigned_base_id, notes } = req.body;
    
    if (!machine_number || !machine_type_id) {
      return res.status(400).json({ success: false, message: '機械番号と機種は必須です' });
    }
    
    const machines = await dynamicInsert('machines', {
      machine_number,
      machine_type_id,
      serial_number,
      manufacture_date,
      purchase_date,
      status: status || 'active',
      assigned_base_id,
      notes
    });
    res.json({ success: true, data: machines[0], message: '機械を追加しました' });
  } catch (err) {
    console.error('Machine create error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'この機械番号は既に登録されています' });
    } else {
      res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
    }
  }
});

// 機械番号マスタ更新
app.put('/api/machines/:id', requireAdmin, async (req, res) => {
  try {
    const machineId = req.params.id;
    const { machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, status, assigned_base_id, notes } = req.body;
    
    const machines = await dynamicUpdate('machines', 
      {
        machine_number,
        machine_type_id,
        serial_number,
        manufacture_date,
        purchase_date,
        status,
        assigned_base_id,
        notes,
        updated_at: new Date()
      },
      { id: machineId }
    );
    
    if (machines.length === 0) {
      return res.status(404).json({ success: false, message: '機械が見つかりません' });
    }
    
    res.json({ success: true, data: machines[0], message: '機械を更新しました' });
  } catch (err) {
    console.error('Machine update error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 機械番号マスタ削除
app.delete('/api/machines/:id', requireAdmin, async (req, res) => {
  try {
    const machineId = req.params.id;
    const machines = await dynamicDelete('machines', { id: machineId }, true);
    
    if (machines.length === 0) {
      return res.status(404).json({ success: false, message: '機械が見つかりません' });
    }
    
    res.json({ success: true, message: '機械を削除しました' });
  } catch (err) {
    console.error('Machine delete error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// サーバー起動
console.log('=' .repeat(60));
console.log(`🚀 ATTEMPTING TO START SERVER ON PORT ${PORT}...`);
console.log('=' .repeat(60));

// JWT_SECRETのデバッグ情報（セキュリティのため一部のみ表示）
const secret = process.env.JWT_SECRET;
if (secret) {
  console.log(`✅ JWT_SECRET is set. Length: ${secret.length}`);
  console.log(`JWT_SECRET prefix: ${secret.substring(0, 2)}***`);
  console.log(`JWT_SECRET suffix: ***${secret.substring(secret.length - 2)}`);
} else {
  console.error('⚠️ JWT_SECRET is NOT set!');
}

console.log(`📡 About to call app.listen(${PORT}, '0.0.0.0')...`);

const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    console.error('Stack trace:', err.stack);
    process.exit(1);
  }
  console.log('=' .repeat(60));
  console.log(`✅✅✅ SERVER STARTED SUCCESSFULLY ✅✅✅`);
  console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`❤️ Health check: http://0.0.0.0:${PORT}/health`);
  console.log('=' .repeat(60));
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully');
  server.close(() => {
    console.log('Server closed');
    pool.end();
    process.exit(0);
  });
});
