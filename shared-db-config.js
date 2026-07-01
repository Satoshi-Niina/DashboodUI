/**
 * 統一データベース接続設定
 * 各アプリケーションから使用する共通のDB接続設定
 * ローカル環境と本番環境（Cloud Run + Cloud SQL）の両方に対応
 */

const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// 本番環境（Cloud SQL）とローカル環境で接続設定を切り替え
const dbConfig = isProduction && process.env.CLOUD_SQL_INSTANCE ? {
  // 本番環境: Cloud SQL Unix socket接続
  host: `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'webappdb',
  max: 5,
} : {
  // ローカル環境: 接続文字列を使用
  connectionString: process.env.DATABASE_URL,
};

const pool = new Pool(dbConfig);

// 接続エラーハンドリング
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// 接続確立時にsearch_pathを設定（本番環境対応）
pool.on('connect', (client) => {
  client.query('SET search_path TO master_data, public', (err) => {
    if (err) {
      console.error('Failed to set search_path:', err);
    } else {
      console.log('✅ search_path set to: master_data, public');
    }
  });
});

console.log('📊 Database Pool Configuration:');
console.log('  - Environment:', isProduction ? 'PRODUCTION' : 'LOCAL');
console.log('  - Connection:', isProduction ? 'Cloud SQL Unix Socket' : 'TCP Connection');
if (isProduction) {
  console.log('  - Socket Path:', `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`);
  console.log('  - Database:', process.env.DB_NAME || 'webappdb');
  console.log('  - User:', process.env.DB_USER);
} else {
  console.log('  - Connection String:', dbConfig.connectionString ? 'Configured' : 'Not Set');
}

// ============================================================
// 動的ルーティング機構 - 共通CRUDモジュール
// ============================================================
// 作成日: 2026-07-01
// 対象: dashboard-ui
// ============================================================

// ルーティング解決キャッシュ（TTL: 1分）
const routingCache = new Map();
const ROUTING_CACHE_TTL = 60 * 1000; // 1分

/**
 * ルーティングテーブルから物理スキーマとテーブル名を解決
 * フォールバック機能: ルーティングが見つからない場合は master_data を使用
 * 
 * @param {string} tenantId - テナントID（デフォルト: 'demo'）
 * @param {string} appId - アプリケーションID（デフォルト: 'dashboard-ui'）
 * @param {string} logicalName - 論理リソース名（例: 'users', 'vehicles'）
 * @returns {Promise<{schema: string, table: string, fullPath: string, isFallback: boolean}>}
 */
async function resolveRouting(tenantId = 'demo', appId = 'dashboard-ui', logicalName) {
  const cacheKey = `${tenantId}:${appId}:${logicalName}`;
  const now = Date.now();
  
  // キャッシュチェック
  if (routingCache.has(cacheKey)) {
    const cached = routingCache.get(cacheKey);
    if (now - cached.timestamp < ROUTING_CACHE_TTL) {
      console.log(`[shared-db-config] ✅ Cache hit for ${cacheKey}`);
      return cached.data;
    }
    // 期限切れのキャッシュを削除
    routingCache.delete(cacheKey);
  }
  
  try {
    // ルーティングテーブルから解決
    const query = `
      SELECT physical_schema, physical_table 
      FROM public.app_resource_routing
      WHERE tenant_id = $1 
        AND app_id = $2 
        AND logical_resource_name = $3
        AND is_active = true
      LIMIT 1
    `;
    
    const result = await pool.query(query, [tenantId, appId, logicalName]);
    
    if (result.rows.length > 0) {
      const { physical_schema, physical_table } = result.rows[0];
      const resolved = {
        schema: physical_schema,
        table: physical_table,
        fullPath: `${physical_schema}."${physical_table}"`,
        isFallback: false
      };
      
      // キャッシュに保存
      routingCache.set(cacheKey, { data: resolved, timestamp: now });
      console.log(`[shared-db-config] ✅ Resolved: ${logicalName} -> ${resolved.fullPath}`);
      return resolved;
    }
    
    // ルーティングが見つからない場合はフォールバック
    console.warn(`[shared-db-config] ⚠️ No routing found for ${cacheKey}, falling back to master_data`);
    const fallback = {
      schema: 'master_data',
      table: logicalName,
      fullPath: `master_data."${logicalName}"`,
      isFallback: true
    };
    
    // フォールバックもキャッシュ（ただし短時間のみ）
    routingCache.set(cacheKey, { data: fallback, timestamp: now });
    return fallback;
    
  } catch (error) {
    // DB接続エラーなどの場合もフォールバック
    console.error(`[shared-db-config] ❌ Routing resolution error for ${cacheKey}:`, error.message);
    console.warn(`[shared-db-config] ⚠️ Falling back to master_data due to error`);
    
    return {
      schema: 'master_data',
      table: logicalName,
      fullPath: `master_data."${logicalName}"`,
      isFallback: true
    };
  }
}

/**
 * 動的SELECT - 論理リソース名から自動的に物理テーブルを解決してクエリ実行
 * 
 * @param {string} tenantId - テナントID
 * @param {string} logicalName - 論理リソース名
 * @param {Object} conditions - WHERE条件（例: {id: 1, status: 'active'}）
 * @param {string[]} columns - 取得カラム（デフォルト: ['*']）
 * @param {number|null} limit - LIMIT値（デフォルト: null = 制限なし）
 * @param {string} appId - アプリケーションID（デフォルト: 'dashboard-ui'）
 * @returns {Promise<Array>} - クエリ結果の行配列
 */
async function dynamicSelect(tenantId = 'demo', logicalName, conditions = {}, columns = ['*'], limit = null, appId = 'dashboard-ui') {
  const route = await resolveRouting(tenantId, appId, logicalName);
  
  // WHERE句の構築
  const whereClauses = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(conditions)) {
    whereClauses.push(`"${key}" = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const limitClause = limit ? `LIMIT ${parseInt(limit)}` : '';
  const selectColumns = columns.join(', ');
  
  const query = `SELECT ${selectColumns} FROM ${route.fullPath} ${whereClause} ${limitClause}`.trim();
  
  console.log(`[shared-db-config] 📖 SELECT: ${query}`);
  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * 動的INSERT - 論理リソース名から自動的に物理テーブルを解決してINSERT実行
 * 
 * @param {string} tenantId - テナントID
 * @param {string} logicalName - 論理リソース名
 * @param {Object} data - 挿入データ（例: {name: 'Test', email: 'test@example.com'}）
 * @param {boolean} returning - RETURNING句を使用するか（デフォルト: true）
 * @param {string} appId - アプリケーションID（デフォルト: 'dashboard-ui'）
 * @returns {Promise<Array>} - 挿入された行（returningがtrueの場合）
 */
async function dynamicInsert(tenantId = 'demo', logicalName, data, returning = true, appId = 'dashboard-ui') {
  const route = await resolveRouting(tenantId, appId, logicalName);
  
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  const returningClause = returning ? 'RETURNING *' : '';
  const query = `
    INSERT INTO ${route.fullPath} (${columns.map(c => `"${c}"`).join(', ')})
    VALUES (${placeholders})
    ${returningClause}
  `.trim();
  
  console.log(`[shared-db-config] ➕ INSERT: ${query}`);
  const result = await pool.query(query, values);
  return returning ? result.rows : [];
}

/**
 * 動的UPDATE - 論理リソース名から自動的に物理テーブルを解決してUPDATE実行
 * 
 * @param {string} tenantId - テナントID
 * @param {string} logicalName - 論理リソース名
 * @param {Object} data - 更新データ（例: {name: 'Updated', status: 'inactive'}）
 * @param {Object} conditions - WHERE条件（例: {id: 1}）
 * @param {boolean} returning - RETURNING句を使用するか（デフォルト: true）
 * @param {string} appId - アプリケーションID（デフォルト: 'dashboard-ui'）
 * @returns {Promise<Array>} - 更新された行（returningがtrueの場合）
 */
async function dynamicUpdate(tenantId = 'demo', logicalName, data, conditions, returning = true, appId = 'dashboard-ui') {
  const route = await resolveRouting(tenantId, appId, logicalName);
  
  // SET句の構築
  const setClauses = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(data)) {
    setClauses.push(`"${key}" = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }
  
  // WHERE句の構築
  const whereClauses = [];
  for (const [key, value] of Object.entries(conditions)) {
    whereClauses.push(`"${key}" = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const returningClause = returning ? 'RETURNING *' : '';
  
  const query = `
    UPDATE ${route.fullPath}
    SET ${setClauses.join(', ')}
    ${whereClause}
    ${returningClause}
  `.trim();
  
  console.log(`[shared-db-config] 🔄 UPDATE: ${query}`);
  const result = await pool.query(query, values);
  return returning ? result.rows : [];
}

/**
 * 動的DELETE - 論理リソース名から自動的に物理テーブルを解決してDELETE実行
 * 
 * @param {string} tenantId - テナントID
 * @param {string} logicalName - 論理リソース名
 * @param {Object} conditions - WHERE条件（例: {id: 1}）
 * @param {boolean} returning - RETURNING句を使用するか（デフォルト: true）
 * @param {string} appId - アプリケーションID（デフォルト: 'dashboard-ui'）
 * @returns {Promise<Array>} - 削除された行（returningがtrueの場合）
 */
async function dynamicDelete(tenantId = 'demo', logicalName, conditions, returning = true, appId = 'dashboard-ui') {
  const route = await resolveRouting(tenantId, appId, logicalName);
  
  // WHERE句の構築
  const whereClauses = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(conditions)) {
    whereClauses.push(`"${key}" = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const returningClause = returning ? 'RETURNING *' : '';
  
  const query = `
    DELETE FROM ${route.fullPath}
    ${whereClause}
    ${returningClause}
  `.trim();
  
  console.log(`[shared-db-config] 🗑️ DELETE: ${query}`);
  const result = await pool.query(query, values);
  return returning ? result.rows : [];
}

/**
 * ルーティングキャッシュをクリア
 * サーバー再起動せずにルーティング変更を反映させる場合に使用
 */
function clearRoutingCache() {
  const size = routingCache.size;
  routingCache.clear();
  console.log(`[shared-db-config] 🧹 Routing cache cleared (${size} entries)`);
}

// ============================================================
// エクスポート
// ============================================================

module.exports = pool;
module.exports.pool = pool;
module.exports.resolveRouting = resolveRouting;
module.exports.dynamicSelect = dynamicSelect;
module.exports.dynamicInsert = dynamicInsert;
module.exports.dynamicUpdate = dynamicUpdate;
module.exports.dynamicDelete = dynamicDelete;
module.exports.clearRoutingCache = clearRoutingCache;
