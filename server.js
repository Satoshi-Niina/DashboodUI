const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('噫 Starting server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('PORT from env:', process.env.PORT);
console.log('Cloud SQL Instance:', process.env.CLOUD_SQL_INSTANCE);
console.log('DB Name:', process.env.DB_NAME);
console.log('DB User:', process.env.DB_USER);
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`笨・Will listen on port: ${PORT}`);

console.log('Express app created');

// CORS險ｭ螳・
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

// JWT_SECRET縺ｮ遒ｺ隱・
if (!process.env.JWT_SECRET) {
  console.error('笶・WARNING: JWT_SECRET environment variable is not set!');
  console.error('笞・・Authentication will not work properly without JWT_SECRET');
  console.error('笞・・Server will start anyway for debugging purposes');
  // 繝・ヰ繝・げ逕ｨ縺ｫ繝・ヵ繧ｩ繝ｫ繝亥､繧定ｨｭ螳夲ｼ域悽逡ｪ縺ｧ縺ｯ謗ｨ螂ｨ縺励↑縺・ｼ・
  process.env.JWT_SECRET = 'temporary-secret-for-debugging-only';
} else {
  console.log('笨・JWT_SECRET is configured');
}

// 繝・・繧ｿ繝吶・繧ｹ縺九ｉ險ｭ螳壹ｒ蜿門ｾ励☆繧九・繝ｫ繝代・髢｢謨ｰ
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

// 縺吶∋縺ｦ縺ｮ險ｭ螳壹ｒ蜿門ｾ・
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

// Config Endpoint (繝・・繧ｿ繝吶・繧ｹ縺ｾ縺溘・迺ｰ蠅・､画焚縺九ｉ蜍慕噪縺ｫ逕滓・)
app.get('/config.js', async (req, res) => {
  try {
    const emergency = await getConfigFromDB('app_url_emergency', 'http://localhost:3001');
    const planning = await getConfigFromDB('app_url_planning', 'http://localhost:3002');
    const equipment = await getConfigFromDB('app_url_equipment', 'http://localhost:3003');
    const failure = await getConfigFromDB('app_url_failure', 'http://localhost:3004');

    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      /**
       * 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳壹ヵ繧｡繧､繝ｫ (Server Generated)
       * 繝・・繧ｿ繝吶・繧ｹ縺九ｉ蜍慕噪縺ｫ隱ｭ縺ｿ霎ｼ縺ｾ繧後※縺・∪縺吶・
       */
      const AppConfig = {
          // 繝医・繧ｯ繝ｳ繧旦RL繝代Λ繝｡繝ｼ繧ｿ縺ｨ縺励※貂｡縺吶→縺阪・繧ｭ繝ｼ蜷・
          tokenParamName: 'auth_token',

          // 蜷・い繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮ繧ｨ繝ｳ繝峨・繧､繝ｳ繝郁ｨｭ螳・
          endpoints: {
              // 蠢懈･蠕ｩ譌ｧ謾ｯ謠ｴ繧ｷ繧ｹ繝・Β
              emergency: '${emergency}',
              
              // 險育判繝ｻ螳溽ｸｾ邂｡逅・す繧ｹ繝・Β
              planning: '${planning}',
              
              // 菫晏ｮ育畑霆顔ｮ｡逅・す繧ｹ繝・Β
              equipment: '${equipment}',
              
              // 讖滓｢ｰ謨・囿邂｡逅・す繧ｹ繝・Β
              failure: '${failure}'
          }
      };
    `);
  } catch (err) {
    console.error('Failed to generate config:', err);
    res.status(500).send('// Failed to load configuration');
  }
});

// 繝ｫ繝ｼ繝医ヱ繧ｹ縺ｸ縺ｮ繧｢繧ｯ繧ｻ繧ｹ譎ゅ・繝ｭ繧ｰ繧､繝ｳ逕ｻ髱｢繧定｡ｨ遉ｺ
// express.static繧医ｊ蜈医↓險倩ｿｰ縺吶ｋ縺薙→縺ｧindex.html縺ｮ閾ｪ蜍暮・菫｡繧帝亟縺・
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.use(express.static(path.join(__dirname)));

// 繝倥Ν繧ｹ繝√ぉ繝・け繧ｨ繝ｳ繝峨・繧､繝ｳ繝茨ｼ域怙蜆ｪ蜈茨ｼ・
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
  res.status(200).send('OK');
});

// Database Pool
// Cloud Run迺ｰ蠅・〒縺ｯ迺ｰ蠅・､画焚縺九ｉ蛟句挨縺ｫ蜿門ｾ励☆繧九°縲∵磁邯壽枚蟄怜・繧剃ｽｿ逕ｨ
const isProduction = process.env.NODE_ENV === 'production';

let poolConfig;
if (isProduction && process.env.CLOUD_SQL_INSTANCE) {
  // 譛ｬ逡ｪ迺ｰ蠅・ Cloud SQL Unix socket謗･邯・
  console.log('Using Cloud SQL connection:', process.env.CLOUD_SQL_INSTANCE);
  poolConfig = {
    host: `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'webappdb',
    max: 5,
  };
} else if (process.env.DATABASE_URL) {
  // 繝ｭ繝ｼ繧ｫ繝ｫ迺ｰ蠅・∪縺溘・謗･邯壽枚蟄怜・繧剃ｽｿ逕ｨ
  console.log('Using DATABASE_URL connection');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };
} else {
  // 迺ｰ蠅・､画焚縺九ｉ蛟句挨縺ｫ險ｭ螳・
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
  console.log('笨・Pool created successfully');
} catch (err) {
  console.error('笶・Failed to create pool:', err);
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
// 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑・ 繝・・繝悶Ν繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ讖溯・
// ========================================

const APP_ID = process.env.APP_ID || 'dashboard-ui';
const routingCache = new Map(); // { key: { fullPath, schema, table, timestamp } }
const CACHE_TTL = 5 * 60 * 1000; // 5蛻・

/**
 * 隲也炊繝・・繝悶Ν蜷阪°繧臥黄逅・ヱ繧ｹ繧定ｧ｣豎ｺ
 * @param {string} logicalName - 隲也炊繝・・繝悶Ν蜷搾ｼ井ｾ・ 'users', 'offices'・・
 * @returns {Promise<{fullPath: string, schema: string, table: string}>}
 */
async function resolveTablePath(logicalName) {
  const cacheKey = `${APP_ID}:${logicalName}`;
  
  // 繧ｭ繝｣繝・す繝･繝√ぉ繝・け
  const cached = routingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Gateway] Cache hit: ${logicalName} 竊・${cached.fullPath}`);
    return cached;
  }

  try {
    // app_resource_routing繝・・繝悶Ν縺九ｉ迚ｩ逅・ヱ繧ｹ繧貞叙蠕・
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
      
      // 繧ｭ繝｣繝・す繝･縺ｫ菫晏ｭ・
      routingCache.set(cacheKey, resolved);
      console.log(`[Gateway] 笨・Resolved: ${logicalName} 竊・${fullPath}`);
      return resolved;
    }

    // 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺瑚ｦ九▽縺九ｉ縺ｪ縺・ｴ蜷医・master_data繧ｹ繧ｭ繝ｼ繝槭↓繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
    console.log(`[Gateway] 笞・・No route found for ${logicalName}, falling back to master_data.${logicalName}`);
    const fallback = { 
      fullPath: `master_data."${logicalName}"`, 
      schema: 'master_data', 
      table: logicalName,
      timestamp: Date.now()
    };
    routingCache.set(cacheKey, fallback);
    return fallback;
    
  } catch (err) {
    console.error(`[Gateway] 笶・Error resolving ${logicalName}:`, err.message);
    console.error(`[Gateway] Error details:`, err);
    // 繧ｨ繝ｩ繝ｼ譎ゅｂmaster_data繧ｹ繧ｭ繝ｼ繝槭↓繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
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
 * 蜍慕噪SELECT
 * @param {string} logicalTableName - 隲也炊繝・・繝悶Ν蜷・
 * @param {Object} conditions - WHERE譚｡莉ｶ (萓・ { username: 'admin', role: 'admin' })
 * @param {Array<string>} columns - 蜿門ｾ励☆繧九き繝ｩ繝 (逵∫払譎ゅ・蜈ｨ繧ｫ繝ｩ繝)
 * @param {number} limit - LIMIT謨ｰ (逵∫払蜿ｯ)
 * @returns {Promise<Array>}
 */
async function dynamicSelect(logicalTableName, conditions = {}, columns = ['*'], limit = null) {
  const route = await resolveTablePath(logicalTableName);
  
  const columnList = columns.join(', ');
  let query = `SELECT ${columnList} FROM ${route.fullPath}`;
  const params = [];
  
  // WHERE蜿･縺ｮ讒狗ｯ・
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
 * 蜍慕噪INSERT
 * @param {string} logicalTableName - 隲也炊繝・・繝悶Ν蜷・
 * @param {Object} data - 謖ｿ蜈･繝・・繧ｿ
 * @param {boolean} returning - RETURNING蜿･繧剃ｽｿ縺・° (繝・ヵ繧ｩ繝ｫ繝・ true)
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
 * 蜍慕噪UPDATE
 * @param {string} logicalTableName - 隲也炊繝・・繝悶Ν蜷・
 * @param {Object} data - 譖ｴ譁ｰ繝・・繧ｿ
 * @param {Object} conditions - WHERE譚｡莉ｶ
 * @param {boolean} returning - RETURNING蜿･繧剃ｽｿ縺・° (繝・ヵ繧ｩ繝ｫ繝・ true)
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
 * 蜍慕噪DELETE
 * @param {string} logicalTableName - 隲也炊繝・・繝悶Ν蜷・
 * @param {Object} conditions - WHERE譚｡莉ｶ
 * @param {boolean} returning - RETURNING蜿･繧剃ｽｿ縺・° (繝・ヵ繧ｩ繝ｫ繝・ false)
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
 * 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
 * @param {string} logicalName - 隲也炊繝・・繝悶Ν蜷・(逵∫払譎ゅ・蜈ｨ繧ｯ繝ｪ繧｢)
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
// 繧ｲ繝ｼ繝医え繧ｧ繧､讖溯・縺薙％縺ｾ縺ｧ
// ========================================

// Test DB Connection (髱槫酔譛溘〒螳溯｡後√し繝ｼ繝舌・襍ｷ蜍輔ｒ繝悶Ο繝・け縺励↑縺・
async function testDatabaseConnection() {
  console.log('剥 Testing database connection...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('笨・Database connected successfully at:', res.rows[0].now);
    return true;
  } catch (err) {
    console.error('笞・・Database connection error:', err.message);
    console.error('Error code:', err.code);
    console.error('Connection config:', { 
      host: poolConfig.host, 
      user: poolConfig.user, 
      database: poolConfig.database,
      cloudSqlInstance: process.env.CLOUD_SQL_INSTANCE
    });
    console.error('Full error:', err);
    console.error('笞・・Server will continue running but database operations will fail');
    return false;
  }
}

// 繧ｵ繝ｼ繝舌・襍ｷ蜍募ｾ後↓謗･邯壹ユ繧ｹ繝茨ｼ・蝗槭・縺ｿ鬮倬溘メ繧ｧ繝・け・・
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

// Middleware: 繝医・繧ｯ繝ｳ隱崎ｨｼ
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '繝医・繧ｯ繝ｳ縺梧署萓帙＆繧後※縺・∪縺帙ｓ' });
  }

  jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'emergency-assistance-app',
    audience: 'emergency-assistance-app'
  }, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: '繝医・繧ｯ繝ｳ縺檎┌蜉ｹ縺ｧ縺・ });
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
    // 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上〒繝ｦ繝ｼ繧ｶ繝ｼ讀懃ｴ｢
    const users = await dynamicSelect('users', 
      { username }, 
      ['id', 'username', 'password', 'display_name', 'role'], 
      1
    );
    
    console.log('[Login] Query result:', users.length > 0 ? 'User found' : 'User not found');

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ蜷阪∪縺溘・繝代せ繝ｯ繝ｼ繝峨′豁｣縺励￥縺ゅｊ縺ｾ縺帙ｓ' });
    }

    const user = users[0];

    // 繝代せ繝ｯ繝ｼ繝画ｯ碑ｼ・
    // DB縺ｮ繝代せ繝ｯ繝ｼ繝峨′bcrypt繝上ャ繧ｷ繝･($2縺ｧ蟋九∪繧・縺九←縺・°繧貞愛螳・
    let match = false;
    
    if (user.password && user.password.startsWith('$2')) {
      // 繝上ャ繧ｷ繝･蛹悶＆繧後◆繝代せ繝ｯ繝ｼ繝・
      match = await bcrypt.compare(password, user.password);
    } else {
      // 蟷ｳ譁・ヱ繧ｹ繝ｯ繝ｼ繝会ｼ亥ｾ梧婿莠呈鋤諤ｧ縺ｮ縺溘ａ・・
      match = (password === user.password);
      
      // 繧ｻ繧ｭ繝･繝ｪ繝・ぅ蜷台ｸ翫・縺溘ａ縲∝ｹｳ譁・ヱ繧ｹ繝ｯ繝ｼ繝峨ｒ繝上ャ繧ｷ繝･蛹悶＠縺ｦ譖ｴ譁ｰ
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
      
      // 隱崎ｨｼ謌仙粥 - Emergency-Assistance縺ｨ莠呈鋤諤ｧ縺ｮ縺ゅｋ繝医・繧ｯ繝ｳ繧堤函謌・
      // department諠・ｱ繧定ｨｭ螳夲ｼ・B繧ｫ繝ｩ繝縺後↑縺上※繧ゅお繝ｩ繝ｼ縺ｫ縺ｪ繧峨↑縺・ｈ縺・ｯｾ蠢懶ｼ・
      let department = '繧ｷ繧ｹ繝・Β邂｡逅・Κ';  // 繝・ヵ繧ｩ繝ｫ繝亥､
      
      // role縺ｫ蝓ｺ縺･縺・※department繧定ｨｭ螳・
      if (user.role === 'system_admin') {
        department = '繧ｷ繧ｹ繝・Β邂｡逅・Κ';
      } else if (user.role === 'operation_admin') {
        department = '驕狗畑邂｡逅・Κ';
      } else {
        department = '荳闊ｬ';
      }

      const payload = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,  // Emergency-Assistance縺ｧ蠢・ｦ・
        role: user.role,
        department: department,  // Emergency-Assistance縺ｧ蠢・ｦ・
        iat: Math.floor(Date.now() / 1000)  // 逋ｺ陦梧凾蛻ｻ繧呈・遉ｺ
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '4h',  // Emergency-Assistance縺ｨ蜷後§
        issuer: 'emergency-assistance-app',  // Emergency-Assistance縺ｨ蜷後§
        audience: 'emergency-assistance-app'  // Emergency-Assistance縺ｨ蜷後§
      });

      console.log('[Login] 辞 JWT Token generated:', {
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
      // 繝代せ繝ｯ繝ｼ繝我ｸ堺ｸ閾ｴ
      console.log('[Login] Password mismatch for user:', username);
      res.status(401).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ蜷阪∪縺溘・繝代せ繝ｯ繝ｼ繝峨′豁｣縺励￥縺ゅｊ縺ｾ縺帙ｓ' });
    }
  } catch (err) {
    console.error('[Login] ERROR:', err);
    console.error('[Login] Error stack:', err.stack);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', error: err.message });
  }
});



// 繝医・繧ｯ繝ｳ讀懆ｨｼ繧ｨ繝ｳ繝峨・繧､繝ｳ繝・(莉悶・繧｢繝励Μ縺後ヨ繝ｼ繧ｯ繝ｳ繧呈､懆ｨｼ縺吶ｋ縺溘ａ縺ｫ菴ｿ逕ｨ)
app.post('/api/verify-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ 
      valid: false, 
      success: false, 
      message: '繝医・繧ｯ繝ｳ縺梧署萓帙＆繧後※縺・∪縺帙ｓ' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    // 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑上〒繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧貞叙蠕暦ｼ・epartment繧ｫ繝ｩ繝縺ｯ蜿門ｾ励＠縺ｪ縺・ｼ・
    const users = await dynamicSelect('users', 
      { id: decoded.id }, 
      ['id', 'username', 'display_name', 'role'], 
      1
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        valid: false, 
        success: false, 
        message: '繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' 
      });
    }

    const user = users[0];
    
    // department繧池ole縺九ｉ蜍慕噪縺ｫ逕滓・
    let department = '荳闊ｬ';
    if (user.role === 'system_admin') {
      department = '繧ｷ繧ｹ繝・Β邂｡逅・Κ';
    } else if (user.role === 'operation_admin') {
      department = '驕狗畑邂｡逅・Κ';
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
    
    // 繝・ヰ繝・げ逕ｨ・壽､懆ｨｼ螟ｱ謨玲凾縺ｮ隧ｳ邏ｰ諠・ｱ
    if (err.message === 'invalid signature') {
        console.error('笞・・Invalid signature detected. Check JWT_SECRET mismatch.');
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
      message: '繝医・繧ｯ繝ｳ縺檎┌蜉ｹ縺ｾ縺溘・譛滄剞蛻・ｌ縺ｧ縺・,
      details: err.message
    });
  }
});

// 繝医・繧ｯ繝ｳ繝ｪ繝輔Ξ繝・す繝･繧ｨ繝ｳ繝峨・繧､繝ｳ繝・(譛牙柑譛滄剞繧貞ｻｶ髟ｷ)
app.post('/api/refresh-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: '繝医・繧ｯ繝ｳ縺梧署萓帙＆繧後※縺・∪縺帙ｓ' });
  }

  try {
    // Emergency-Assistance縺ｨ蜷後§讀懆ｨｼ繧ｪ繝励す繝ｧ繝ｳ繧剃ｽｿ逕ｨ
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    // 譁ｰ縺励＞繝医・繧ｯ繝ｳ繧堤匱陦鯉ｼ・mergency-Assistance縺ｨ莠呈鋤諤ｧ縺ｮ縺ゅｋ蠖｢蠑擾ｼ・
    // department縺悟ｭ伜惠縺励↑縺・ｴ蜷医・繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ蜃ｦ逅・
    let department = decoded.department;
    if (!department) {
      if (decoded.role === 'system_admin') {
        department = '繧ｷ繧ｹ繝・Β邂｡逅・Κ';
      } else if (decoded.role === 'operation_admin') {
        department = '驕狗畑邂｡逅・Κ';
      } else {
        department = '譛ｪ險ｭ螳・;
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

    console.log('[TokenRefresh] 売 Token refreshed for user:', decoded.username);

    res.json({ success: true, token: newToken });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(401).json({ success: false, message: '繝医・繧ｯ繝ｳ縺檎┌蜉ｹ縺ｾ縺溘・譛滄剞蛻・ｌ縺ｧ縺・ });
  }
});

// 邂｡逅・・ｪ崎ｨｼ繝溘ラ繝ｫ繧ｦ繧ｧ繧｢
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: '隱崎ｨｼ縺悟ｿ・ｦ√〒縺・ });
  }

  try {
    // Emergency-Assistance縺ｨ蜷後§讀懆ｨｼ繧ｪ繝励す繝ｧ繝ｳ繧剃ｽｿ逕ｨ
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    const query = 'SELECT id, username, role FROM master_data.users WHERE id = $1';
    const result = await pool.query(query, [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    const user = result.rows[0];
    
    // system_admin 縺ｾ縺溘・ operation_admin 縺ｮ縺ｿ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ
    if (user.role !== 'system_admin' && user.role !== 'operation_admin') {
      return res.status(403).json({ success: false, message: '繧｢繧ｯ繧ｻ繧ｹ讓ｩ髯舌′縺ゅｊ縺ｾ縺帙ｓ縲らｮ｡逅・・ｨｩ髯舌′蠢・ｦ√〒縺吶・ });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ success: false, message: '繝医・繧ｯ繝ｳ縺檎┌蜉ｹ縺ｾ縺溘・譛滄剞蛻・ｌ縺ｧ縺・ });
  }
}

// 險ｭ螳壼叙蠕励お繝ｳ繝峨・繧､繝ｳ繝茨ｼ育ｮ｡逅・判髱｢逕ｨ・・
app.get('/api/config', requireAdmin, async (req, res) => {
  try {
    const config = await getAllConfig();
    res.json({ success: true, config });
  } catch (err) {
    console.error('Config get error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 險ｭ螳壽峩譁ｰ繧ｨ繝ｳ繝峨・繧､繝ｳ繝茨ｼ育ｮ｡逅・判髱｢逕ｨ・・
app.post('/api/config', requireAdmin, async (req, res) => {
  try {
    const username = req.user.username;
    const configData = req.body;

    // 險ｭ螳壹ｒ譖ｴ譁ｰ
    for (const [key, value] of Object.entries(configData)) {
      if (value !== undefined && value !== null) {
        // 譌｢蟄倥・蛟､繧貞叙蠕暦ｼ亥ｱ･豁ｴ逕ｨ・・
        const oldValueQuery = 'SELECT config_value FROM master_data.app_config WHERE config_key = $1';
        const oldValueResult = await pool.query(oldValueQuery, [key]);
        const oldValue = oldValueResult.rows.length > 0 ? oldValueResult.rows[0].config_value : null;

        // 險ｭ螳壹ｒ譖ｴ譁ｰ縺ｾ縺溘・謖ｿ蜈･
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

        // 螻･豁ｴ繧定ｨ倬鹸
        const historyQuery = `
          INSERT INTO master_data.app_config_history (config_key, old_value, new_value, updated_by)
          VALUES ($1, $2, $3, $4)
        `;
        await pool.query(historyQuery, [key, oldValue, value, username]);
      }
    }

    res.json({ success: true, message: '險ｭ螳壹ｒ譖ｴ譁ｰ縺励∪縺励◆' });
  } catch (err) {
    console.error('Config update error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 險ｭ螳壼､画峩螻･豁ｴ蜿門ｾ励お繝ｳ繝峨・繧､繝ｳ繝・
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
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});



// 繝ｦ繝ｼ繧ｶ繝ｼ荳隕ｧ蜿門ｾ励お繝ｳ繝峨・繧､繝ｳ繝・
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    // 繧ｲ繝ｼ繝医え繧ｧ繧､譁ｹ蠑・+ ORDER BY蟇ｾ蠢懊・縺溘ａ荳驛ｨ逶ｴ謗･繧ｯ繧ｨ繝ｪ
    const route = await resolveTablePath('users');
    const query = `SELECT id, username, display_name, role, created_at FROM ${route.fullPath} ORDER BY id ASC`;
    const result = await pool.query(query);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Users get error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 繝ｦ繝ｼ繧ｶ繝ｼ隧ｳ邏ｰ蜿門ｾ励お繝ｳ繝峨・繧､繝ｳ繝・
app.get('/api/users/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;

  try {
    const users = await dynamicSelect('users', 
      { id: userId }, 
      ['id', 'username', 'display_name', 'role'], 
      1
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, user: users[0] });
  } catch (err) {
    console.error('User get error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 繝ｦ繝ｼ繧ｶ繝ｼ霑ｽ蜉繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body;

    // 繝舌Μ繝・・繧ｷ繝ｧ繝ｳ
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ蜷阪→繝代せ繝ｯ繝ｼ繝峨・蠢・医〒縺・ });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: '繝代せ繝ｯ繝ｼ繝峨・8譁・ｭ嶺ｻ･荳翫〒蜈･蜉帙＠縺ｦ縺上□縺輔＞' });
    }

    // 繝ｦ繝ｼ繧ｶ繝ｼ蜷阪・驥崎､・メ繧ｧ繝・け・医ご繝ｼ繝医え繧ｧ繧､譁ｹ蠑擾ｼ・
    const existingUsers = await dynamicSelect('users', { username }, ['id'], 1);
    const checkResult = { rows: existingUsers };

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: '縺薙・繝ｦ繝ｼ繧ｶ繝ｼ蜷阪・譌｢縺ｫ菴ｿ逕ｨ縺輔ｌ縺ｦ縺・∪縺・ });
    }

    // 繝代せ繝ｯ繝ｼ繝峨ｒ繝上ャ繧ｷ繝･蛹・
    const hashedPassword = await bcrypt.hash(password, 10);

    // 繝ｦ繝ｼ繧ｶ繝ｼ繧定ｿｽ蜉・医ご繝ｼ繝医え繧ｧ繧､譁ｹ蠑擾ｼ・
    const users = await dynamicInsert('users', {
      username,
      password: hashedPassword,
      display_name: display_name || null,
      role: role || 'user'
    });

    res.json({ success: true, user: users[0], message: '繝ｦ繝ｼ繧ｶ繝ｼ繧定ｿｽ蜉縺励∪縺励◆' });
  } catch (err) {
    console.error('User create error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 繝ｦ繝ｼ繧ｶ繝ｼ譖ｴ譁ｰ繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.params.id;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '隱崎ｨｼ縺悟ｿ・ｦ√〒縺・ });
  }

  try {
    // 繝医・繧ｯ繝ｳ繧呈､懆ｨｼ
    jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    const { username, display_name, password, role } = req.body;

    // 繝舌Μ繝・・繧ｷ繝ｧ繝ｳ
    if (!username) {
      return res.status(400).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ蜷阪・蠢・医〒縺・ });
    }

    // 繝ｦ繝ｼ繧ｶ繝ｼ蜷阪・驥崎､・メ繧ｧ繝・け・郁・蛻・ｻ･螟厄ｼ・
    const route = await resolveTablePath('users');
    const checkQuery = `SELECT id FROM ${route.fullPath} WHERE username = $1 AND id != $2`;
    const checkResult = await pool.query(checkQuery, [username, userId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: '縺薙・繝ｦ繝ｼ繧ｶ繝ｼ蜷阪・譌｢縺ｫ菴ｿ逕ｨ縺輔ｌ縺ｦ縺・∪縺・ });
    }

    // 繝代せ繝ｯ繝ｼ繝峨′謖・ｮ壹＆繧後※縺・ｋ蝣ｴ蜷・
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: '繝代せ繝ｯ繝ｼ繝峨・8譁・ｭ嶺ｻ･荳翫〒蜈･蜉帙＠縺ｦ縺上□縺輔＞' });
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
        return res.status(404).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
      }

      res.json({ success: true, user: users[0], message: '繝ｦ繝ｼ繧ｶ繝ｼ繧呈峩譁ｰ縺励∪縺励◆' });
    } else {
      // 繝代せ繝ｯ繝ｼ繝峨ｒ螟画峩縺励↑縺・ｴ蜷・
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
        return res.status(404).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
      }

      res.json({ success: true, user: users[0], message: '繝ｦ繝ｼ繧ｶ繝ｼ繧呈峩譁ｰ縺励∪縺励◆' });
    }
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 繝ｦ繝ｼ繧ｶ繝ｼ蜑企勁繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.params.id;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '隱崎ｨｼ縺悟ｿ・ｦ√〒縺・ });
  }

  try {
    // 繝医・繧ｯ繝ｳ繧呈､懆ｨｼ
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });
    
    // 閾ｪ蛻・・霄ｫ繧貞炎髯､縺励ｈ縺・→縺励※縺・↑縺・°繝√ぉ繝・け
    if (decoded.id === parseInt(userId)) {
      return res.status(400).json({ success: false, message: '閾ｪ蛻・・霄ｫ縺ｯ蜑企勁縺ｧ縺阪∪縺帙ｓ' });
    }

    // 繝ｦ繝ｼ繧ｶ繝ｼ繧貞炎髯､・医ご繝ｼ繝医え繧ｧ繧､譁ｹ蠑擾ｼ・
    const users = await dynamicDelete('users', { id: userId }, true);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, message: '繝ｦ繝ｼ繧ｶ繝ｼ繧貞炎髯､縺励∪縺励◆' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});



// ========== 菫晏ｮ育畑霆翫・繧ｹ繧ｿ API ==========

// 菫晏ｮ育畑霆贋ｸ隕ｧ蜿門ｾ励お繝ｳ繝峨・繧､繝ｳ繝茨ｼ域ｩ溽ｨｮ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝ｻ邂｡逅・ｺ区･ｭ謇繧堤ｵ仙粋・・
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
        v.model,
        v.registration_number,
        v.status,
        m.id as machine_id,
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
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 菫晏ｮ育畑霆願ｩｳ邏ｰ蜿門ｾ励お繝ｳ繝峨・繧､繝ｳ繝・
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
      return res.status(404).json({ success: false, message: '霆贋ｸ｡縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    console.error('Vehicle get error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 菫晏ｮ育畑霆願ｿｽ蜉繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.post('/api/vehicles', requireAdmin, async (req, res) => {
  const username = req.user.username;
  const { vehicle_number, machine_id, office_id, model, registration_number, notes } = req.body;

  try {
    // 繝舌Μ繝・・繧ｷ繝ｧ繝ｳ
    if (!vehicle_number) {
      return res.status(400).json({ success: false, message: '霆贋ｸ｡逡ｪ蜿ｷ縺ｯ蠢・医〒縺・ });
    }

    if (!machine_id) {
      return res.status(400).json({ success: false, message: '讖滓｢ｰ逡ｪ蜿ｷ縺ｯ蠢・医〒縺・ });
    }

    // 霆贋ｸ｡逡ｪ蜿ｷ縺ｮ驥崎､・メ繧ｧ繝・け
    const route = await resolveTablePath('vehicles');
    const checkQuery = `SELECT vehicle_id FROM ${route.fullPath} WHERE vehicle_number = $1`;
    const checkResult = await pool.query(checkQuery, [vehicle_number]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: '縺薙・霆贋ｸ｡逡ｪ蜿ｷ縺ｯ譌｢縺ｫ菴ｿ逕ｨ縺輔ｌ縺ｦ縺・∪縺・ });
    }

    // 霆贋ｸ｡繧定ｿｽ蜉・医ご繝ｼ繝医え繧ｧ繧､譁ｹ蠑擾ｼ・
    const vehicles = await dynamicInsert('vehicles', {
      vehicle_number,
      machine_id,
      office_id: office_id || null,
      model: model || null,
      registration_number: registration_number || null,
      notes: notes || null
    });

    res.json({ success: true, vehicle: vehicles[0], message: '霆贋ｸ｡繧定ｿｽ蜉縺励∪縺励◆' });
  } catch (err) {
    console.error('Vehicle create error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: ' + err.message });
  }
});

// 菫晏ｮ育畑霆頑峩譁ｰ繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.put('/api/vehicles/:id', requireAdmin, async (req, res) => {
  const vehicleId = req.params.id;
  const username = req.user.username;
  
  try {
    const { vehicle_number, machine_id, office_id, model, registration_number, notes } = req.body;

    // 繝舌Μ繝・・繧ｷ繝ｧ繝ｳ
    if (!vehicle_number) {
      return res.status(400).json({ success: false, message: '霆贋ｸ｡逡ｪ蜿ｷ縺ｯ蠢・医〒縺・ });
    }

    if (!machine_id) {
      return res.status(400).json({ success: false, message: '讖滓｢ｰ逡ｪ蜿ｷ縺ｯ蠢・医〒縺・ });
    }

    // 霆贋ｸ｡逡ｪ蜿ｷ縺ｮ驥崎､・メ繧ｧ繝・け・郁・蛻・ｻ･螟厄ｼ・
    const route = await resolveTablePath('vehicles');
    const checkQuery = `SELECT vehicle_id FROM ${route.fullPath} WHERE vehicle_number = $1 AND vehicle_id != $2`;
    const checkResult = await pool.query(checkQuery, [vehicle_number, vehicleId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: '縺薙・霆贋ｸ｡逡ｪ蜿ｷ縺ｯ譌｢縺ｫ菴ｿ逕ｨ縺輔ｌ縺ｦ縺・∪縺・ });
    }

    // 霆贋ｸ｡繧呈峩譁ｰ・医ご繝ｼ繝医え繧ｧ繧､譁ｹ蠑擾ｼ・
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
      return res.status(404).json({ success: false, message: '霆贋ｸ｡縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, vehicle: vehicles[0], message: '霆贋ｸ｡繧呈峩譁ｰ縺励∪縺励◆' });
  } catch (err) {
    console.error('Vehicle update error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: ' + err.message });
  }
});

// 菫晏ｮ育畑霆雁炎髯､繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.delete('/api/vehicles/:id', requireAdmin, async (req, res) => {
  const vehicleId = req.params.id;
  
  try {
    // 霆贋ｸ｡繧貞炎髯､・医ご繝ｼ繝医え繧ｧ繧､譁ｹ蠑擾ｼ・
    const vehicles = await dynamicDelete('vehicles', { vehicle_id: vehicleId }, true);

    if (vehicles.length === 0) {
      return res.status(404).json({ success: false, message: '霆贋ｸ｡縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, message: '霆贋ｸ｡繧貞炎髯､縺励∪縺励◆' });
  } catch (err) {
    console.error('Vehicle delete error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// ========================================
// 莠区･ｭ謇繝槭せ繧ｿ API
// ========================================

// 莠区･ｭ謇荳隕ｧ蜿門ｾ・
app.get('/api/offices', authenticateToken, async (req, res) => {
  try {
    const route = await resolveTablePath('managements_offices');
    const query = `SELECT * FROM ${route.fullPath} ORDER BY office_id DESC`;
    const result = await pool.query(query);
    res.json({ success: true, offices: result.rows });
  } catch (err) {
    console.error('Offices list error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 莠区･ｭ謇霑ｽ蜉
app.post('/api/offices', requireAdmin, async (req, res) => {
  const { office_code, office_name, office_type, address } = req.body;

  if (!office_code || !office_name) {
    return res.status(400).json({ success: false, message: '莠区･ｭ謇繧ｳ繝ｼ繝峨→莠区･ｭ謇蜷阪・蠢・医〒縺・ });
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

    res.json({ success: true, office: result.rows[0], message: '莠区･ｭ謇繧定ｿｽ蜉縺励∪縺励◆' });
  } catch (err) {
    console.error('Office insert error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: '縺薙・莠区･ｭ謇繧ｳ繝ｼ繝峨・譌｢縺ｫ逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺・ });
    } else {
      res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
    }
  }
});

// 莠区･ｭ謇譖ｴ譁ｰ
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
      return res.status(404).json({ success: false, message: '莠区･ｭ謇縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, office: result.rows[0], message: '莠区･ｭ謇繧呈峩譁ｰ縺励∪縺励◆' });
  } catch (err) {
    console.error('Office update error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 莠区･ｭ謇蜑企勁
app.delete('/api/offices/:id', requireAdmin, async (req, res) => {
  const officeId = req.params.id;
  
  try {
    const deleteQuery = 'DELETE FROM master_data.managements_offices WHERE office_id = $1 RETURNING office_name';
    const result = await pool.query(deleteQuery, [officeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '莠区･ｭ謇縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, message: '莠区･ｭ謇繧貞炎髯､縺励∪縺励◆' });
  } catch (err) {
    console.error('Office delete error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// ========================================
// 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ API
// ========================================

// 菫晏ｮ亥渕蝨ｰ荳隕ｧ蜿門ｾ・
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
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 菫晏ｮ亥渕蝨ｰ霑ｽ蜉
app.post('/api/bases', requireAdmin, async (req, res) => {
  const { base_code, base_name, office_id, location, address, postal_code, phone_number, latitude, longitude } = req.body;

  if (!base_code || !base_name) {
    return res.status(400).json({ success: false, message: '蝓ｺ蝨ｰ繧ｳ繝ｼ繝峨→蝓ｺ蝨ｰ蜷阪・蠢・医〒縺・ });
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

    res.json({ success: true, base: result.rows[0], message: '菫晏ｮ亥渕蝨ｰ繧定ｿｽ蜉縺励∪縺励◆' });
  } catch (err) {
    console.error('Base insert error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: '縺薙・蝓ｺ蝨ｰ繧ｳ繝ｼ繝峨・譌｢縺ｫ逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺・ });
    } else {
      res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
    }
  }
});

// 菫晏ｮ亥渕蝨ｰ譖ｴ譁ｰ
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
      return res.status(404).json({ success: false, message: '菫晏ｮ亥渕蝨ｰ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, base: result.rows[0], message: '菫晏ｮ亥渕蝨ｰ繧呈峩譁ｰ縺励∪縺励◆' });
  } catch (err) {
    console.error('Base update error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 菫晏ｮ亥渕蝨ｰ蜑企勁
app.delete('/api/bases/:id', requireAdmin, async (req, res) => {
  const baseId = req.params.id;
  
  try {
    const deleteQuery = 'DELETE FROM master_data.bases WHERE base_id = $1 RETURNING base_name';
    const result = await pool.query(deleteQuery, [baseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '菫晏ｮ亥渕蝨ｰ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }

    res.json({ success: true, message: '菫晏ｮ亥渕蝨ｰ繧貞炎髯､縺励∪縺励◆' });
  } catch (err) {
    console.error('Base delete error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});



// ========== 繝・・繧ｿ繝吶・繧ｹ邂｡逅・API ==========

// 繝・・繧ｿ繝吶・繧ｹ邨ｱ險域ュ蝣ｱ蜿門ｾ励お繝ｳ繝峨・繧､繝ｳ繝・
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

    // PostgreSQL繝舌・繧ｸ繝ｧ繝ｳ蜿門ｾ・
    try {
      const versionResult = await pool.query('SELECT version()');
      const versionString = versionResult.rows[0].version;
      const match = versionString.match(/PostgreSQL ([\d.]+)/);
      stats.version = match ? `PostgreSQL ${match[1]}` : 'PostgreSQL';
    } catch (err) {
      console.error('Failed to get version:', err);
    }

    // 謗･邯壽焚蜿門ｾ・
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

    // 繝・・繧ｿ繝吶・繧ｹ繧ｵ繧､繧ｺ蜿門ｾ・
    try {
      const sizeResult = await pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
      `);
      stats.database_size = sizeResult.rows[0].db_size;
    } catch (err) {
      console.error('Failed to get database size:', err);
    }

    // 遞ｼ蜒肴凾髢灘叙蠕・
    try {
      const uptimeResult = await pool.query(`
        SELECT 
          EXTRACT(DAY FROM (now() - pg_postmaster_start_time())) || '譌･' ||
          EXTRACT(HOUR FROM (now() - pg_postmaster_start_time())) || '譎る俣' ||
          ROUND(EXTRACT(MINUTE FROM (now() - pg_postmaster_start_time()))) || '蛻・ as uptime
      `);
      stats.uptime = uptimeResult.rows[0].uptime;
    } catch (err) {
      console.error('Failed to get uptime:', err);
    }

    // 繝・・繝悶Ν繧ｵ繧､繧ｺ蜿門ｾ暦ｼ井ｸ贋ｽ・0莉ｶ・・
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

    // 繝・ぅ繧ｹ繧ｯ菴ｿ逕ｨ邇・ｼ育ｰ｡譏楢ｨ育ｮ励∝ｮ滄圀縺ｫ縺ｯOS萓晏ｭ假ｼ・
    try {
      const diskResult = await pool.query(`
        SELECT 
          ROUND((pg_database_size(current_database())::float / (1024*1024*1024)) * 100 / 10) as disk_usage_percent
      `);
      stats.disk_usage = Math.min(100, diskResult.rows[0].disk_usage_percent || 0);
    } catch (err) {
      console.error('Failed to calculate disk usage:', err);
      stats.disk_usage = 7.2; // 繝・ヵ繧ｩ繝ｫ繝亥､・育判蜒上→蜷後§・・
    }

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Database stats error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', stats: { connected: false } });
  }
});



// ========================================
// 繝・・繧ｿ繝吶・繧ｹ邂｡逅・PI
// ========================================

// 繝・・繝悶Ν繝・・繧ｿ蜿門ｾ暦ｼ域ｱ守畑・・
app.get('/api/database/table/:schemaTable', authenticateToken, async (req, res) => {
  try {
    const { schemaTable } = req.params;
    const [schema, table] = schemaTable.split('.');
    
    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // SQL繧､繝ｳ繧ｸ繧ｧ繧ｯ繧ｷ繝ｧ繝ｳ蟇ｾ遲厄ｼ壹せ繧ｭ繝ｼ繝槭→繝・・繝悶Ν蜷阪ｒ讀懆ｨｼ
    const validTableQuery = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [schema, table]
    );

    if (validTableQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const result = await pool.query(`SELECT * FROM ${schema}.${table} ORDER BY 1 DESC LIMIT 100`);
    
    // 繧ｫ繝ｩ繝諠・ｱ繧ょ叙蠕・
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

// 繝ｬ繧ｳ繝ｼ繝芽ｿｽ蜉・域ｱ守畑・・
app.post('/api/database/table/:schemaTable', authenticateToken, async (req, res) => {
  try {
    const { schemaTable } = req.params;
    const [schema, table] = schemaTable.split('.');
    const data = req.body;

    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // 繝・・繝悶Ν蟄伜惠遒ｺ隱・
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

// 繝ｬ繧ｳ繝ｼ繝画峩譁ｰ・域ｱ守畑・・
app.put('/api/database/table/:schemaTable/:id', authenticateToken, async (req, res) => {
  try {
    const { schemaTable, id } = req.params;
    const [schema, table] = schemaTable.split('.');
    const data = req.body;

    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // 荳ｻ繧ｭ繝ｼ繧ｫ繝ｩ繝蜷阪ｒ蜿門ｾ・
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

// 繝ｬ繧ｳ繝ｼ繝牙炎髯､・域ｱ守畑・・
app.delete('/api/database/table/:schemaTable/:id', authenticateToken, async (req, res) => {
  try {
    const { schemaTable, id } = req.params;
    const [schema, table] = schemaTable.split('.');

    if (!schema || !table) {
      return res.status(400).json({ success: false, message: 'Invalid table name format' });
    }

    // 荳ｻ繧ｭ繝ｼ繧ｫ繝ｩ繝蜷阪ｒ蜿門ｾ・
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

// 繝・・繧ｿ繝吶・繧ｹ繝舌ャ繧ｯ繧｢繝・・
app.post('/api/database/backup', authenticateToken, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const fs = require('fs');
    const backupDir = path.join(__dirname, 'backups');
    
    // 繝舌ャ繧ｯ繧｢繝・・繝・ぅ繝ｬ繧ｯ繝医Μ菴懈・
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

      // 繝舌ャ繧ｯ繧｢繝・・繝輔ぃ繧､繝ｫ繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝・
      res.download(backupFile, `webappdb_backup_${timestamp}.sql`, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // 繝繧ｦ繝ｳ繝ｭ繝ｼ繝牙ｾ後√ヵ繧｡繧､繝ｫ繧貞炎髯､・医が繝励す繝ｧ繝ｳ・・
        // fs.unlinkSync(backupFile);
      });
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: 'Backup failed' });
  }
});

// CSV繧ｨ繧ｯ繧ｹ繝昴・繝・
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

    // CSV逕滓・
    const columns = Object.keys(result.rows[0]);
    const csvHeader = columns.join(',') + '\n';
    const csvRows = result.rows.map(row => 
      columns.map(col => {
        const value = row[col];
        // 蛟､縺ｫ繧ｫ繝ｳ繝槭ｄ謾ｹ陦後′蜷ｫ縺ｾ繧後ｋ蝣ｴ蜷医・繝繝悶Ν繧ｯ繧ｩ繝ｼ繝医〒蝗ｲ繧
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

// CSV繧､繝ｳ繝昴・繝・
app.post('/api/database/import-csv/:schemaTable', authenticateToken, async (req, res) => {
  try {
    const { schemaTable } = req.params;
    const { csvData } = req.body;
    const [schema, table] = schemaTable.split('.');
    
    if (!schema || !table || !csvData) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    // CSV隗｣譫・
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

// 繝倥Ν繧ｹ繝√ぉ繝・け繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
app.get('/health', async (req, res) => {
  try {
    // 繝・・繧ｿ繝吶・繧ｹ謗･邯夂｢ｺ隱・
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

// 繝・ヰ繝・げ逕ｨ繧ｨ繝ｳ繝峨・繧､繝ｳ繝茨ｼ域悽逡ｪ迺ｰ蠅・〒縺ｯ蜑企勁謗ｨ螂ｨ・・
app.get('/debug/env', (req, res) => {
  // 繝代せ繝ｯ繝ｼ繝峨↑縺ｩ縺ｮ讖溷ｯ・ュ蝣ｱ縺ｯ髫縺・
  const safeEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    CLOUD_SQL_INSTANCE: process.env.CLOUD_SQL_INSTANCE,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD ? '***險ｭ螳壽ｸ医∩***' : '譛ｪ險ｭ螳・,
    DATABASE_URL: process.env.DATABASE_URL ? '***險ｭ螳壽ｸ医∩***' : '譛ｪ險ｭ螳・,
    JWT_SECRET: process.env.JWT_SECRET ? '***險ｭ螳壽ｸ医∩***' : '譛ｪ險ｭ螳・,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };
  res.json(safeEnv);
});

// 繝・ヰ繝・げ逕ｨ: users繝・・繝悶Ν縺ｮ遒ｺ隱搾ｼ域悽逡ｪ迺ｰ蠅・〒縺ｯ蜑企勁蠢・茨ｼ・
app.get('/debug/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        username, 
        display_name,
        role,
        CASE 
          WHEN password LIKE '$2%' THEN '繝上ャ繧ｷ繝･蛹匁ｸ医∩'
          ELSE '蟷ｳ譁・
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
      hint: 'master_data.users繝・・繝悶Ν縺悟ｭ伜惠縺励↑縺・庄閭ｽ諤ｧ縺後≠繧翫∪縺・
    });
  }
});

// 繝・ヰ繝・げ逕ｨ: 繝ｭ繧ｰ繧､繝ｳ繝・せ繝・
app.post('/debug/test-login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const query = 'SELECT id, username, password FROM master_data.users WHERE username = $1';
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: '繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ',
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
      passwordType: isHashed ? '繝上ャ繧ｷ繝･蛹・ : '蟷ｳ譁・,
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
// 讖溽ｨｮ繝槭せ繧ｿ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ API (邨ｱ蜷郁｡ｨ遉ｺ逕ｨ)
// ========================================

// 讖溽ｨｮ繝槭せ繧ｿ荳隕ｧ蜿門ｾ・
app.get('/api/machine-types', requireAdmin, async (req, res) => {
  try {
    const route = await resolveTablePath('machine_types');
    const query = `SELECT * FROM ${route.fullPath} ORDER BY type_code`;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Machine types get error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 讖溽ｨｮ繝槭せ繧ｿ霑ｽ蜉
app.post('/api/machine-types', requireAdmin, async (req, res) => {
  try {
    const { type_code, type_name, manufacturer, category, description } = req.body;
    
    if (!type_code || !type_name) {
      return res.status(400).json({ success: false, message: '讖溽ｨｮ繧ｳ繝ｼ繝峨→讖溽ｨｮ蜷阪・蠢・医〒縺・ });
    }
    
    const types = await dynamicInsert('machine_types', {
      type_code,
      type_name,
      manufacturer,
      category,
      description
    });
    res.json({ success: true, data: types[0], message: '讖溽ｨｮ繧定ｿｽ蜉縺励∪縺励◆' });
  } catch (err) {
    console.error('Machine type create error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: '縺薙・讖溽ｨｮ繧ｳ繝ｼ繝峨・譌｢縺ｫ逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺・ });
    } else {
      res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
    }
  }
});

// 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ荳隕ｧ蜿門ｾ暦ｼ域ｩ溽ｨｮ諠・ｱ繧ょ性繧邨ｱ蜷医ン繝･繝ｼ・・
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
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ霑ｽ蜉
app.post('/api/machines', requireAdmin, async (req, res) => {
  try {
    const { machine_number, machine_type_id, serial_number, manufacture_date, purchase_date, status, assigned_base_id, notes } = req.body;
    
    if (!machine_number || !machine_type_id) {
      return res.status(400).json({ success: false, message: '讖滓｢ｰ逡ｪ蜿ｷ縺ｨ讖溽ｨｮ縺ｯ蠢・医〒縺・ });
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
    res.json({ success: true, data: machines[0], message: '讖滓｢ｰ繧定ｿｽ蜉縺励∪縺励◆' });
  } catch (err) {
    console.error('Machine create error:', err);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: '縺薙・讖滓｢ｰ逡ｪ蜿ｷ縺ｯ譌｢縺ｫ逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺・ });
    } else {
      res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
    }
  }
});

// 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ譖ｴ譁ｰ
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
      return res.status(404).json({ success: false, message: '讖滓｢ｰ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }
    
    res.json({ success: true, data: machines[0], message: '讖滓｢ｰ繧呈峩譁ｰ縺励∪縺励◆' });
  } catch (err) {
    console.error('Machine update error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ蜑企勁
app.delete('/api/machines/:id', requireAdmin, async (req, res) => {
  try {
    const machineId = req.params.id;
    const machines = await dynamicDelete('machines', { id: machineId }, true);
    
    if (machines.length === 0) {
      return res.status(404).json({ success: false, message: '讖滓｢ｰ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' });
    }
    
    res.json({ success: true, message: '讖滓｢ｰ繧貞炎髯､縺励∪縺励◆' });
  } catch (err) {
    console.error('Machine delete error:', err);
    res.status(500).json({ success: false, message: '繧ｵ繝ｼ繝舌・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆' });
  }
});

// 繧ｵ繝ｼ繝舌・襍ｷ蜍・
console.log('=' .repeat(60));
console.log(`噫 ATTEMPTING TO START SERVER ON PORT ${PORT}...`);
console.log('=' .repeat(60));

// JWT_SECRET縺ｮ繝・ヰ繝・げ諠・ｱ・医そ繧ｭ繝･繝ｪ繝・ぅ縺ｮ縺溘ａ荳驛ｨ縺ｮ縺ｿ陦ｨ遉ｺ・・
const secret = process.env.JWT_SECRET;
if (secret) {
  console.log(`笨・JWT_SECRET is set. Length: ${secret.length}`);
  console.log(`JWT_SECRET prefix: ${secret.substring(0, 2)}***`);
  console.log(`JWT_SECRET suffix: ***${secret.substring(secret.length - 2)}`);
} else {
  console.error('笞・・JWT_SECRET is NOT set!');
}

console.log(`藤 About to call app.listen(${PORT}, '0.0.0.0')...`);

const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('笶・Failed to start server:', err);
    console.error('Stack trace:', err.stack);
    process.exit(1);
  }
  console.log('=' .repeat(60));
  console.log(`笨・怛笨・SERVER STARTED SUCCESSFULLY 笨・怛笨・);
  console.log(`倹 Listening on 0.0.0.0:${PORT}`);
  console.log(`逃 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`笶､・・Health check: http://0.0.0.0:${PORT}/health`);
  console.log('=' .repeat(60));
});

server.on('error', (err) => {
  console.error('笶・Server error:', err);
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
