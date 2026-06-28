const express = require('express');
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const configRoutes = require('./server/routes/config');
require('dotenv').config();

// Multer設定（ファイルアップロード用）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Google Cloud Storage初期化
const storage = new Storage();

console.log('🚀 Starting server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('PORT from env:', process.env.PORT);
console.log('Cloud SQL Instance:', process.env.CLOUD_SQL_INSTANCE || 'NOT SET');
console.log('DB Name:', process.env.DB_NAME || 'NOT SET');
console.log('DB User:', process.env.DB_USER || 'NOT SET');
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN || '*');
console.log('APP_ID:', process.env.APP_ID || 'dashboard-ui');
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);

const app = express();
const PORT = Number(process.env.PORT) || 8080;
let serverInstance;
let dbReady = false;

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

function isApiRequestPath(pathLike) {
  const normalizedPath = String(pathLike || '').trim().toLowerCase();
  return normalizedPath === '/api'
    || normalizedPath.startsWith('/api/')
    || normalizedPath.includes('/api/');
}

// APIリクエストごとにヘッダーのテナントIDを先に抽出して保持
app.use((req, res, next) => {
  if (isApiRequestPath(req.path)) {
    req.requestedTenantId = extractTenantIdFromRequest(req);
  }
  next();
});

console.log('Middleware configured');

// DB未接続時はAPIを停止
app.use((req, res, next) => {
  const isApiRequest = isApiRequestPath(req.path) || req.path === '/config.js';
  const isHealth = req.path === '/health' || req.path === '/_ah/health' || req.path === '/ready';
  if (!dbReady && isApiRequest && !isHealth) {
    return res.status(503).json({
      success: false,
      message: 'Database is not ready. Please retry later.'
    });
  }
  next();
});

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

const requestTenantContextStorage = new AsyncLocalStorage();
const tenantDbPoolCache = new Map();
const tenantRouteCache = new Map();
const tenantRouteListCache = new Map();
const TENANT_ROUTE_CACHE_TTL = 60 * 1000;
let controlPlanePool = null;

function normalizeUrlForCompare(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(String(rawUrl));
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.origin}${normalizedPath}`.toLowerCase();
  } catch (_) {
    return String(rawUrl).trim().replace(/\/+$/, '').toLowerCase();
  }
}

function normalizePathForCompare(rawPath) {
  if (!rawPath) return '/';
  try {
    const parsed = new URL(String(rawPath));
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return normalizedPath.toLowerCase();
  } catch (_) {
    const normalized = String(rawPath).trim();
    if (!normalized) return '/';
    const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return (withSlash.replace(/\/+$/, '') || '/').toLowerCase();
  }
}

function getTenantKeyFromPath(rawPath) {
  const normalizedPath = normalizePathForCompare(rawPath);
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return 'demo_env';
  }

  const first = String(segments[0] || '').trim().toLowerCase();
  if (!first || first === 'api' || first === 'assets' || first === 'health' || first === '_ah' || first === 'ready') {
    return 'demo_env';
  }

  return first;
}

function resolveFirstTenantKey(...candidates) {
  for (const candidate of candidates) {
    const key = getTenantKeyFromPath(candidate || '/');
    if (key && key !== 'demo_env') {
      return key;
    }
  }
  return 'demo_env';
}

function normalizeTenantRoutingRow(row) {
  if (!row) return null;

  return {
    ...row,
    normalizedCompanyId: String(row.company_id || '').trim().toLowerCase(),
    normalizedTenantPath: normalizeUrlForCompare(row.tenant_path || ''),
    normalizedTenantPathOnly: normalizePathForCompare(row.tenant_path || ''),
    normalizedTenantKey: getTenantKeyFromPath(row.tenant_path || '')
  };
}

async function getAllCompanyRoutingRows() {
  try {
    const now = Date.now();
    const cached = tenantRouteListCache.get('all');
    if (cached && (now - cached.timestamp) < TENANT_ROUTE_CACHE_TTL) {
      return cached.rows;
    }

    const query = `
      SELECT company_id, company_name, db_name, storage_bucket_name, tenant_path
      FROM public.company_db_routing
      ORDER BY company_id
    `;
    const result = await getControlPlanePool().query(query);
    const rows = result.rows.map(normalizeTenantRoutingRow).filter(Boolean);
    tenantRouteListCache.set('all', { rows, timestamp: now });
    return rows;
  } catch (err) {
    console.error('[TenantRouting] Failed to load routing rows:', err.message);
    return [];
  }
}

function extractTenantIdFromRequest(req) {
  const tenantIdHeader = String(req.headers['x-tenant-id'] || '').trim().toLowerCase();
  const tenantFullUrlHeader = String(req.headers['x-tenant-full-url'] || '').trim();
  const tenantPathHeader = String(req.headers['x-tenant-path'] || '').trim();
  const refererHeader = String(req.headers.referer || '').trim();

  if (tenantIdHeader && /^[a-z0-9_-]+$/.test(tenantIdHeader)) {
    return tenantIdHeader;
  }

  const fromFullUrl = getTenantKeyFromPath(tenantFullUrlHeader || '/');
  if (fromFullUrl !== 'demo_env') {
    return fromFullUrl;
  }

  const fromTenantPathHeader = getTenantKeyFromPath(tenantPathHeader || '/');
  if (fromTenantPathHeader !== 'demo_env') {
    return fromTenantPathHeader;
  }

  const fromOriginalUrl = getTenantKeyFromPath(req.originalUrl || req.url || req.path || '/');
  if (fromOriginalUrl !== 'demo_env') {
    return fromOriginalUrl;
  }

  const fromReferer = getTenantKeyFromPath(refererHeader || '/');
  if (fromReferer !== 'demo_env') {
    return fromReferer;
  }

  return 'demo_env';
}

async function getCompanyRoutingByTenantRequest({ tenantId = '', tenantPath = '', fullUrl = '' } = {}) {
  try {
    const normalizedTenantId = String(tenantId || '').trim().toLowerCase();
    const normalizedTenantPath = normalizePathForCompare(tenantPath || fullUrl || '');
    const normalizedFullUrl = normalizeUrlForCompare(fullUrl || tenantPath || '');
    const requestTenantKey = getTenantKeyFromPath(tenantPath || fullUrl || '');
    const allRows = await getAllCompanyRoutingRows();

    if (normalizedTenantId && normalizedTenantId !== 'demo_env') {
      const byCompanyId = allRows.find((row) => (
        row.normalizedCompanyId === normalizedTenantId
        || row.normalizedTenantKey === normalizedTenantId
      ));
      if (byCompanyId) {
        return byCompanyId;
      }
    }

    if (requestTenantKey && requestTenantKey !== 'demo_env') {
      const byTenantKey = allRows.find((row) => (
        row.normalizedTenantKey === requestTenantKey
        || row.normalizedCompanyId === requestTenantKey
      ));
      if (byTenantKey) {
        return byTenantKey;
      }
    }

    const byUrl = allRows.find((row) => {
      if (!row) return false;
      return row.normalizedTenantPath === normalizedFullUrl
        || row.normalizedTenantPathOnly === normalizedTenantPath;
    });

    return byUrl || null;
  } catch (err) {
    console.error('[TenantRouting] Failed to resolve tenant by request:', err.message);
    return null;
  }
}

async function getCompanyRoutingByTenantKey(tenantKey) {
  const normalizedTenantKey = String(tenantKey || '').trim().toLowerCase();
  if (!normalizedTenantKey || normalizedTenantKey === 'demo_env') {
    return null;
  }

  const allRows = await getAllCompanyRoutingRows();
  return allRows.find((row) => (
    row.normalizedCompanyId === normalizedTenantKey
    || row.normalizedTenantKey === normalizedTenantKey
  )) || null;
}

function getControlPlanePool() {
  return controlPlanePool || pool;
}

function getDefaultDbName() {
  if (poolConfig && poolConfig.database) {
    return poolConfig.database;
  }
  if (poolConfig && poolConfig.connectionString) {
    try {
      const parsed = new URL(poolConfig.connectionString);
      const dbName = parsed.pathname.replace(/^\//, '');
      return dbName || 'webappdb';
    } catch (_) {
      return 'webappdb';
    }
  }
  return process.env.DB_NAME || 'webappdb';
}

function getDefaultBucketName() {
  return process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'maint-vehicle-management-storage';
}

function buildPoolConfigForDb(dbName) {
  const config = {
    ...poolConfig,
    database: undefined,
    connectionString: poolConfig.connectionString || undefined
  };

  if (config.connectionString) {
    try {
      const parsed = new URL(config.connectionString);
      parsed.pathname = `/${dbName}`;
      config.connectionString = parsed.toString();
    } catch (_) {
      config.connectionString = poolConfig.connectionString;
      config.database = dbName;
    }
  } else {
    config.database = dbName;
  }

  return config;
}

function getOrCreateTenantPool(dbName) {
  if (!dbName) return getControlPlanePool();

  if (tenantDbPoolCache.has(dbName)) {
    const cached = tenantDbPoolCache.get(dbName);
    cached.lastUsedAt = Date.now();
    return cached.pool;
  }

  const tenantPoolConfig = buildPoolConfigForDb(dbName);
  const tenantPool = new Pool(tenantPoolConfig);
  tenantPool.on('error', (err) => {
    console.error(`[TenantDB] Unexpected error on tenant pool ${dbName}:`, err.message);
  });

  tenantDbPoolCache.set(dbName, {
    pool: tenantPool,
    dbName,
    lastUsedAt: Date.now()
  });

  console.log(`[TenantDB] Created pool for database: ${dbName}`);
  return tenantPool;
}

async function getCompanyRoutingByCompanyId(companyId) {
  const now = Date.now();
  const cacheKey = String(companyId || '').trim().toLowerCase();

  if (!cacheKey) {
    return null;
  }

  const cached = tenantRouteCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < TENANT_ROUTE_CACHE_TTL) {
    return cached.row;
  }

  const query = `
    SELECT company_id, company_name, db_name, storage_bucket_name, tenant_path
    FROM public.company_db_routing
    WHERE LOWER(TRIM(company_id)) = $1
    LIMIT 1
  `;
  const result = await getControlPlanePool().query(query, [cacheKey]);
  const row = normalizeTenantRoutingRow(result.rows[0] || null);
  tenantRouteCache.set(cacheKey, { row, timestamp: now });
  return row;
}

function buildTenantRuntimeFromRoutingRow(routingRow, requestedTenantId, defaultDbName, defaultBucketName, fallbackTenantKey = '') {
  const resolvedTenantId = routingRow.company_id || fallbackTenantKey || requestedTenantId || 'demo_env';
  const tenantDbName = routingRow.db_name || defaultDbName;
  const tenantPool = tenantDbName === defaultDbName
    ? getControlPlanePool()
    : getOrCreateTenantPool(tenantDbName);

  return {
    requestedTenantId,
    resolvedTenantId,
    companyId: routingRow.company_id || resolvedTenantId,
    companyName: routingRow.company_name || '',
    dbName: tenantDbName,
    storageBucketName: routingRow.storage_bucket_name || defaultBucketName,
    tenantPath: routingRow.tenant_path || '',
    pool: tenantPool,
    isFallback: false
  };
}

async function resolveTenantRuntime(tenantId, requestHint = {}) {
  const normalizedTenantId = (tenantId || 'demo_env').trim().toLowerCase() || 'demo_env';
  const defaultDbName = getDefaultDbName();
  const defaultBucketName = getDefaultBucketName();
  const requestTenantPath = requestHint.tenantPath || requestHint.fullUrl || '';
  const requestFullUrl = requestHint.fullUrl || requestHint.tenantPath || requestHint.referer || '';
  const requestOriginalUrl = requestHint.originalUrl || '';
  const expectedTenantKey = normalizedTenantId !== 'demo_env'
    ? normalizedTenantId
    : resolveFirstTenantKey(requestTenantPath, requestFullUrl, requestOriginalUrl, requestHint.referer || '');

  if (normalizedTenantId !== 'demo_env') {
    const exactHeaderRoutingRow = await getCompanyRoutingByCompanyId(normalizedTenantId);
    if (exactHeaderRoutingRow) {
      return buildTenantRuntimeFromRoutingRow(
        exactHeaderRoutingRow,
        normalizedTenantId,
        defaultDbName,
        defaultBucketName,
        expectedTenantKey
      );
    }
  }

  const matchedRoutingRow = await getCompanyRoutingByTenantRequest({
    tenantId: expectedTenantKey,
    tenantPath: requestTenantPath,
    fullUrl: requestFullUrl
  });

  const strictMatchedRoutingRow = matchedRoutingRow || await getCompanyRoutingByTenantKey(expectedTenantKey);

  if (strictMatchedRoutingRow) {
    return buildTenantRuntimeFromRoutingRow(
      strictMatchedRoutingRow,
      normalizedTenantId,
      defaultDbName,
      defaultBucketName,
      expectedTenantKey
    );
  }

  if (expectedTenantKey !== 'demo_env') {
    console.warn(`[TenantRouting] Tenant key ${expectedTenantKey} is not registered. Falling back to demo_env.`);
  }

  if (normalizedTenantId === 'demo_env') {
    return {
      requestedTenantId: normalizedTenantId,
      resolvedTenantId: 'demo_env',
      companyId: 'demo_env',
      companyName: '',
      dbName: defaultDbName,
      storageBucketName: defaultBucketName,
      pool: getControlPlanePool(),
      isFallback: false
    };
  }

  try {
    const routingRow = await getCompanyRoutingByCompanyId(normalizedTenantId);

    if (!routingRow) {
      console.warn(`[TenantRouting] Tenant not found: ${normalizedTenantId}. Falling back to demo_env.`);
      return {
        requestedTenantId: normalizedTenantId,
        resolvedTenantId: 'demo_env',
        companyId: 'demo_env',
        companyName: '',
        dbName: defaultDbName,
        storageBucketName: defaultBucketName,
        pool: getControlPlanePool(),
        isFallback: true
      };
    }

    return buildTenantRuntimeFromRoutingRow(
      routingRow,
      normalizedTenantId,
      defaultDbName,
      defaultBucketName,
      normalizedTenantId
    );
  } catch (err) {
    console.error(`[TenantRouting] Failed to resolve tenant ${normalizedTenantId}:`, err.message);
    return {
      requestedTenantId: normalizedTenantId,
      resolvedTenantId: 'demo_env',
      companyId: 'demo_env',
      companyName: '',
      dbName: defaultDbName,
      storageBucketName: defaultBucketName,
      pool: getControlPlanePool(),
      isFallback: true,
      tenantResolutionError: {
        message: err.message || String(err),
        stack: err.stack || ''
      }
    };
  }
}

function getActiveTenantRuntime() {
  return requestTenantContextStorage.getStore() || null;
}

function getActiveDbPool() {
  const runtime = getActiveTenantRuntime();
  return runtime && runtime.pool ? runtime.pool : getControlPlanePool();
}

function getRequestBucketName(req, fallbackBucketName = '') {
  const runtimeFromReq = req && req.tenantContext ? req.tenantContext : null;
  const runtime = runtimeFromReq || getActiveTenantRuntime();
  return (runtime && runtime.storageBucketName) || fallbackBucketName || getDefaultBucketName();
}

function applyTenantErrorHeaders(res, err) {
  if (!res || !err) {
    return;
  }

  const errorMessage = String(err.message || err).replace(/[\r\n]+/g, ' ').slice(0, 1024);
  const errorStack = err.stack ? String(err.stack).replace(/[\r\n]+/g, ' ').slice(0, 8192) : '';
  res.setHeader('X-Tenant-Error', errorMessage);
  res.setHeader('X-Tenant-Error-Stack', errorStack);
}

// フロントエンドが現在テナントのcompany_nameなどを取得できるように公開
app.get('/api/tenant-routing', async (req, res) => {
  const tenantId = String(req.query.tenant_id || req.requestedTenantId || '').trim().toLowerCase();
  const tenantPath = String(req.query.tenant_path || req.headers['x-tenant-path'] || '').trim();
  const fullUrl = String(req.query.full_url || req.headers['x-tenant-full-url'] || '').trim();

  try {
    let lookupSource = '';
    let row = await getCompanyRoutingByTenantRequest({ tenantId, tenantPath, fullUrl });
    if (row) {
      lookupSource = 'request_match';
    }

    if (!row && tenantId) {
      row = await getCompanyRoutingByCompanyId(tenantId);
      if (row) {
        lookupSource = 'company_id';
      }
    }

    if (!row && tenantId) {
      row = await getCompanyRoutingByTenantKey(tenantId);
      if (row) {
        lookupSource = 'tenant_key';
      }
    }

    res.json({
      success: true,
      route: row,
      routes: row ? [
        {
          company_id: row.company_id,
          company_name: row.company_name,
          db_name: row.db_name,
          storage_bucket_name: row.storage_bucket_name,
          tenant_path: row.tenant_path,
          tenant_id: row.company_id
        }
      ] : [],
      error: row
        ? null
        : `Tenant routing row not found (tenantId=${tenantId || 'empty'}, tenantPath=${tenantPath || 'empty'}, fullUrl=${fullUrl || 'empty'}, lookupSource=${lookupSource || 'none'})`
    });
  } catch (err) {
    applyTenantErrorHeaders(res, err);
    res.status(500).json({
      success: false,
      route: null,
      routes: [],
      error: err.message || String(err)
    });
  }
});

// /kosei や /daitetsu 配下でも同じ静的ファイルへ解決できるようにする
app.use((req, res, next) => {
  const excludedPrefixes = new Set(['api', 'assets', 'health', '_ah', 'ready']);
  const [pathname, searchPart] = req.url.split('?');
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 0) return next();

  const firstSegment = parts[0].toLowerCase();
  const hasFileExtension = firstSegment.includes('.');

  if (excludedPrefixes.has(firstSegment) || hasFileExtension) {
    return next();
  }

  if (!req.requestedTenantId || req.requestedTenantId === 'demo_env') {
    req.requestedTenantId = firstSegment;
  }

  const strippedPath = `/${parts.slice(1).join('/')}`;
  const rewrittenPath = strippedPath === '/' ? '/' : strippedPath;
  req.url = `${rewrittenPath}${searchPart ? `?${searchPart}` : ''}`;

  return next();
});

// Config Endpoint (データベースまたは環境変数から動的に生成)
app.get('/config.js', async (req, res) => {
  try {
    const emergencyDefault = process.env.URL_EMERGENCY || process.env.EMERGENCY_APP_URL || process.env.APP_URL_EMERGENCY || 'https://準備中';
    const planningDefault = process.env.URL_PLANNING || process.env.OPERATION_MANAGEMENT_CLIENT_URL || process.env.APP_URL_PLANNING || 'https://準備中';
    const equipmentDefault = process.env.URL_EQUIPMENT || process.env.EQUIPMENT_APP_URL || process.env.APP_URL_EQUIPMENT || 'https://準備中';
    const failureDefault = process.env.URL_FAILURE || process.env.MACHINE_FAILURE_APP_URL || process.env.APP_URL_FAILURE || 'https://準備中';

    const emergency = await getConfigFromDB('app_url_emergency', emergencyDefault);
    const planning = await getConfigFromDB('app_url_planning', planningDefault);
    const equipment = await getConfigFromDB('app_url_equipment', equipmentDefault);
    const failure = await getConfigFromDB('app_url_failure', failureDefault);
    const tokenParamName = process.env.AUTH_TOKEN_PARAM_NAME || 'auth_token';
    const authTransferMode = process.env.AUTH_TRANSFER_MODE || 'url_param';
    const tokenParamAliases = (process.env.AUTH_TOKEN_PARAM_ALIASES || 'token,jwt,sso_token')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      /**
       * アプリケーション設定ファイル (Server Generated)
       * データベースから動的に読み込まれています。
       */
      const AppConfig = {
          // トークンをURLパラメータとして渡すときのキー名
          tokenParamName: '${tokenParamName}',
          authTransferMode: '${authTransferMode}',
          tokenParamAliases: ${JSON.stringify(tokenParamAliases)},

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

// 静的ファイル配信（JSとCSSはキャッシュ無効化）
app.use(express.static(path.join(__dirname), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    // JS、CSS、HTMLファイルはキャッシュ無効化
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '-1');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// ヘルスチェックエンドポイント（最優先）
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
  res.status(200).send('OK');
});

// DB準備完了チェック
app.get('/ready', (req, res) => {
  if (dbReady) {
    return res.status(200).send('READY');
  }
  return res.status(503).send('DB NOT READY');
});

// --- サーバー起動（起動を最優先） ---
startServer().catch(err => {
  console.error('❌ Fatal error during server startup:', err);
  process.exit(1);
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
    client_encoding: 'UTF8',
  };
} else if (process.env.DATABASE_URL) {
  // ローカル環境または接続文字列を使用
  console.log('Using DATABASE_URL connection');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    client_encoding: 'UTF8',
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
    client_encoding: 'UTF8',
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
    end: () => { },
    on: () => { }
  };
}

controlPlanePool = pool;

// Error handling for pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit the process
});

// 既存コードの pool.query/pool.connect 呼び出しを、リクエストごとのテナントDBへ自動ルーティング
pool = new Proxy(controlPlanePool, {
  get(target, prop) {
    if (prop === 'query') {
      return (...args) => getActiveDbPool().query(...args);
    }
    if (prop === 'connect') {
      return (...args) => getActiveDbPool().connect(...args);
    }
    if (prop === 'end') {
      return async (...args) => {
        for (const entry of tenantDbPoolCache.values()) {
          try {
            await entry.pool.end();
          } catch (err) {
            console.warn(`[TenantDB] Failed to close tenant pool ${entry.dbName}:`, err.message);
          }
        }
        tenantDbPoolCache.clear();
        return target.end(...args);
      };
    }
    const value = Reflect.get(target, prop);
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

// APIリクエストのテナント文脈を解決し、以降のDB/GCS処理に引き継ぐ
app.use('/api', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const requestedTenantId = req.requestedTenantId || extractTenantIdFromRequest(req) || 'demo_env';
    const defaultDbName = getDefaultDbName();

    const runtime = await resolveTenantRuntime(requestedTenantId, {
      tenantPath: String(req.headers['x-tenant-path'] || req.query.tenant_path || '').trim(),
      fullUrl: String(req.headers['x-tenant-full-url'] || req.query.full_url || '').trim(),
      referer: String(req.headers.referer || '').trim(),
      originalUrl: String(req.originalUrl || req.url || '').trim()
    });
    req.tenantContext = runtime;
    res.setHeader('X-Resolved-Tenant-Id', runtime.resolvedTenantId || 'demo_env');
    res.setHeader('X-Resolved-Db-Name', runtime.dbName || defaultDbName);
    res.setHeader('X-Resolved-Company-Name', runtime.companyName || '');
    res.setHeader('X-Resolved-Bucket-Name', runtime.storageBucketName || '');
    if (runtime.tenantResolutionError) {
      applyTenantErrorHeaders(res, runtime.tenantResolutionError);
    }

    const normalizedRequestedTenantId = String(requestedTenantId || '').trim().toLowerCase();
    const normalizedResolvedTenantId = String(runtime.resolvedTenantId || 'demo_env').trim().toLowerCase();
    const normalizedResolvedDbName = String(runtime.dbName || '').trim().toLowerCase();
    const normalizedDefaultDbName = String(defaultDbName || '').trim().toLowerCase();
    const requiresIsolation = normalizedRequestedTenantId !== 'demo_env' || normalizedResolvedTenantId !== 'demo_env';

    if (requiresIsolation && (!normalizedResolvedDbName || normalizedResolvedDbName === normalizedDefaultDbName)) {
      const isolationError = new Error(`[TenantRouting] Isolation violation: requested=${normalizedRequestedTenantId || 'empty'}, resolved=${normalizedResolvedTenantId || 'empty'}, db=${runtime.dbName || 'empty'}, defaultDb=${defaultDbName}. Check public.company_db_routing.db_name and tenant_path.`);
      applyTenantErrorHeaders(res, isolationError);
      return res.status(503).json({
        success: false,
        message: 'Tenant DB isolation check failed',
        error: isolationError.message,
        requestedTenantId: normalizedRequestedTenantId || 'demo_env',
        resolvedTenantId: normalizedResolvedTenantId || 'demo_env',
        resolvedDbName: runtime.dbName || '',
        defaultDbName
      });
    }

    requestTenantContextStorage.run(runtime, () => next());
  } catch (err) {
    console.error('[TenantRouting] Middleware failed, falling back to demo_env:', err.message);
    const fallbackRuntime = {
      requestedTenantId: 'demo_env',
      resolvedTenantId: 'demo_env',
      companyId: 'demo_env',
      companyName: '',
      dbName: getDefaultDbName(),
      storageBucketName: getDefaultBucketName(),
      pool: getControlPlanePool(),
      isFallback: true,
      tenantResolutionError: {
        message: err.message || String(err),
        stack: err.stack || ''
      }
    };
    req.tenantContext = fallbackRuntime;
    res.setHeader('X-Resolved-Tenant-Id', 'demo_env');
    res.setHeader('X-Resolved-Db-Name', fallbackRuntime.dbName || getDefaultDbName());
    res.setHeader('X-Resolved-Company-Name', '');
    res.setHeader('X-Resolved-Bucket-Name', fallbackRuntime.storageBucketName || '');
    applyTenantErrorHeaders(res, err);
    requestTenantContextStorage.run(fallbackRuntime, () => next());
  }
});

// APIルート定義（テナント解決ミドルウェアの後に登録）
app.use('/api/config', configRoutes);

// データベース初期化（サーバー起動後に非同期で実行）
setImmediate(async () => {
  try {
    await initializeDatabase();
    await testDatabaseConnection();
  } catch (err) {
    console.error('❌ Post-start DB initialization failed:', err.message);
  }
});

// ========================================
// ゲートウェイ方式: テーブルルーティング機能
// ========================================

const APP_ID = process.env.APP_ID || 'dashboard-ui';
const routingCache = new Map(); // { key: { fullPath, schema, table, timestamp } }
const CACHE_TTL = 60 * 1000; // 1分（本番での即座な反映を重視）

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
    // app_id = 'dashboard-ui' の場合は小文字、'master_data' の場合は大文字
    const query = `
      SELECT physical_schema, physical_table
      FROM public.app_resource_routing
      WHERE app_id = $1 AND logical_resource_name = $2
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
    console.error(`[Gateway] Error code:`, err.code);
    console.error(`[Gateway] Error detail:`, err.detail || 'N/A');
    console.error(`[Gateway] Query that failed:`, 'SELECT FROM public.app_resource_routing');
    console.error(`[Gateway] Parameters:`, { APP_ID, logicalName });
    console.error(`[Gateway] Error stack:`, err.stack);
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
  try {
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
    console.log(`[DynamicDB] Query: ${query}`);
    console.log(`[DynamicDB] Params:`, params);
    const result = await pool.query(query, params);
    console.log(`[DynamicDB] ✅ SELECT success: ${result.rows.length} rows`);
    return result.rows;
  } catch (err) {
    console.error(`[DynamicDB] ❌ SELECT error for table ${logicalTableName}:`, err.message);
    console.error(`[DynamicDB] Error code:`, err.code);
    console.error(`[DynamicDB] Error detail:`, err.detail || 'N/A');
    console.error(`[DynamicDB] Executed Query:`, query);
    console.error(`[DynamicDB] Query Parameters:`, params);
    console.error(`[DynamicDB] Resolved Path:`, route.fullPath);
    console.error(`[DynamicDB] Error stack:`, err.stack);
    throw err;
  }
}

/**
 * 動的INSERT
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} data - 挿入データ
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: true)
 * @returns {Promise<Array>}
 */
async function dynamicInsert(logicalTableName, data, returning = true) {
  let query = '';
  let route = null;
  const keys = Object.keys(data);
  const values = Object.values(data);
  try {
    route = await resolveTablePath(logicalTableName);

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    query = `INSERT INTO ${route.fullPath} (${keys.join(', ')}) VALUES (${placeholders})`;

    if (returning) {
      query += ' RETURNING *';
    }

    console.log(`[DynamicDB] INSERT into ${route.fullPath}`);
    console.log(`[DynamicDB] Query: ${query}`);
    console.log(`[DynamicDB] Values:`, values);
    const result = await pool.query(query, values);
    console.log(`[DynamicDB] ✅ INSERT success:`, result.rows[0]);
    return result.rows;
  } catch (err) {
    console.error(`[DynamicDB] ❌ INSERT error for table ${logicalTableName}:`, err.message);
    console.error(`[DynamicDB] Error code:`, err.code);
    console.error(`[DynamicDB] Error detail:`, err.detail || 'N/A');
    console.error(`[DynamicDB] Executed Query:`, query || 'N/A');
    console.error(`[DynamicDB] Query Values:`, values);
    console.error(`[DynamicDB] Resolved Path:`, route ? route.fullPath : 'N/A');
    console.error(`[DynamicDB] Error stack:`, err.stack);
    throw err;
  }
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
  let query = '';
  let route = null;
  const setKeys = Object.keys(data);
  const setValues = Object.values(data);
  const conditionKeys = Object.keys(conditions);
  const conditionValues = Object.values(conditions);
  try {
    route = await resolveTablePath(logicalTableName);

    const setClause = setKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const whereClause = conditionKeys.map((key, i) => `${key} = $${setKeys.length + i + 1}`).join(' AND ');

    query = `UPDATE ${route.fullPath} SET ${setClause}`;

    if (conditionKeys.length > 0) {
      query += ` WHERE ${whereClause}`;
    }

    if (returning) {
      query += ' RETURNING *';
    }

    console.log(`[DynamicDB] UPDATE ${route.fullPath}`);
    console.log(`[DynamicDB] Query: ${query}`);
    console.log(`[DynamicDB] Params:`, [...setValues, ...conditionValues]);
    const result = await pool.query(query, [...setValues, ...conditionValues]);
    console.log(`[DynamicDB] ✅ UPDATE success: ${result.rows.length} rows`);
    return result.rows;
  } catch (err) {
    console.error(`[DynamicDB] ❌ UPDATE error for table ${logicalTableName}:`, err.message);
    console.error(`[DynamicDB] Error code:`, err.code);
    console.error(`[DynamicDB] Error detail:`, err.detail || 'N/A');
    console.error(`[DynamicDB] Executed Query:`, query || 'N/A');
    console.error(`[DynamicDB] Query Parameters:`, [...setValues, ...conditionValues]);
    console.error(`[DynamicDB] Resolved Path:`, route ? route.fullPath : 'N/A');
    console.error(`[DynamicDB] Error stack:`, err.stack);
    throw err;
  }
}

/**
 * 動的DELETE
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} conditions - WHERE条件
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: false)
 * @returns {Promise<Array>}
 */
async function dynamicDelete(logicalTableName, conditions, returning = false) {
  let query = '';
  let route = null;
  const conditionKeys = Object.keys(conditions);
  const conditionValues = Object.values(conditions);
  try {
    route = await resolveTablePath(logicalTableName);

    const whereClause = conditionKeys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');

    query = `DELETE FROM ${route.fullPath}`;

    if (conditionKeys.length > 0) {
      query += ` WHERE ${whereClause}`;
    }

    if (returning) {
      query += ' RETURNING *';
    }

    console.log(`[DynamicDB] DELETE from ${route.fullPath}`);
    console.log(`[DynamicDB] Query: ${query}`);
    const result = await pool.query(query, conditionValues);
    return result.rows;
  } catch (err) {
    console.error(`[DynamicDB] ❌ DELETE error for table ${logicalTableName}:`, err.message);
    console.error(`[DynamicDB] Error code:`, err.code);
    console.error(`[DynamicDB] Error detail:`, err.detail || 'N/A');
    console.error(`[DynamicDB] Executed Query:`, query || 'N/A');
    console.error(`[DynamicDB] Query Parameters:`, conditionValues);
    console.error(`[DynamicDB] Resolved Path:`, route ? route.fullPath : 'N/A');
    console.error(`[DynamicDB] Error stack:`, err.stack);
    throw err;
  }
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

// ========================================
// デバッグ用エンドポイント
// 注意：接続確認優先のため、一時的に認証なしで公開
// 本番環境で接続確認が完了したら認証を強化すること
// ========================================

// ルーティング情報確認エンドポイント（認証なし）
app.get('/api/debug/routing', async (req, res) => {
  try {
    console.log('[DEBUG] Fetching routing table...');
    const query = `
      SELECT 
        routing_id,
        app_id,
        logical_resource_name,
        physical_schema,
        physical_table,
        is_active
      FROM public.app_resource_routing 
      WHERE is_active = true
      ORDER BY app_id, logical_resource_name
    `;
    const result = await pool.query(query);

    res.json({
      success: true,
      count: result.rows.length,
      routing: result.rows,
      cache_size: routingCache.size
    });
  } catch (err) {
    console.error('[DEBUG] Routing fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'ルーティング情報の取得に失敗しました',
      error: err.message
    });
  }
});

// スキーマ存在チェックエンドポイント（認証なし）
app.get('/api/debug/schema-check', async (req, res) => {
  const { table, schema = 'master_data' } = req.query;

  if (!table) {
    return res.status(400).json({
      success: false,
      message: 'tableパラメータが必要です'
    });
  }

  try {
    console.log(`[DEBUG] Checking table: ${schema}.${table}`);

    // to_regclassを使用してテーブル存在確認
    const existsQuery = `SELECT to_regclass($1) IS NOT NULL as exists`;
    const existsResult = await pool.query(existsQuery, [`${schema}.${table}`]);
    const exists = existsResult.rows[0].exists;

    if (!exists) {
      return res.json({
        success: true,
        exists: false,
        message: `テーブル ${schema}.${table} は存在しません`
      });
    }

    // カラム情報を取得
    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;
    const columnsResult = await pool.query(columnsQuery, [schema, table]);

    // レコード数を取得
    const countQuery = `SELECT COUNT(*) as count FROM ${schema}."${table}"`;
    const countResult = await pool.query(countQuery);

    res.json({
      success: true,
      exists: true,
      schema: schema,
      table: table,
      columns: columnsResult.rows,
      record_count: parseInt(countResult.rows[0].count)
    });
  } catch (err) {
    console.error('[DEBUG] Schema check error:', err);
    res.status(500).json({
      success: false,
      message: 'スキーマチェックに失敗しました',
      error: err.message,
      code: err.code
    });
  }
});

// 環境変数確認エンドポイント（認証なし - 接続確認優先）
app.get('/api/debug/env', async (req, res) => {
  res.json({
    success: true,
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '3000',
      CLOUD_SQL_INSTANCE: process.env.CLOUD_SQL_INSTANCE || 'NOT SET',
      DB_NAME: process.env.DB_NAME || 'NOT SET',
      DB_USER: process.env.DB_USER || 'NOT SET',
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
      APP_ID: process.env.APP_ID || 'dashboard-ui'
    }
  });
});

// ========================================
// デバッグ用エンドポイントここまで
// ========================================

// Test DB Connection (非同期で実行、サーバー起動をブロックしない)
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', res.rows[0].now);
    dbReady = true;
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

    // system_admin、operation_admin、または admin のみアクセス可能
    if (user.role !== 'system_admin' && user.role !== 'operation_admin' && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'アクセス権限がありません。管理者権限が必要です。' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ success: false, message: 'トークンが無効または期限切れです' });
  }
}

// システム管理者専用認証ミドルウェア
async function requireSystemAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '認証が必要です' });
  }

  try {
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

    // system_admin のみアクセス可能
    if (user.role !== 'system_admin') {
      return res.status(403).json({ success: false, message: 'アクセス権限がありません。システム管理者権限が必要です。' });
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
    console.log('[POST /api/users] Request body:', req.body);
    const { username, password, display_name, role, email } = req.body;

    // バリデーション
    if (!username || !password) {
      console.log('[POST /api/users] Validation failed: missing username or password');
      return res.status(400).json({ success: false, message: 'ユーザー名とパスワードは必須です' });
    }

    if (password.length < 8) {
      console.log('[POST /api/users] Validation failed: password too short');
      return res.status(400).json({ success: false, message: 'パスワードは8文字以上で入力してください' });
    }

    // ユーザー名の重複チェック（ゲートウェイ方式）
    console.log('[POST /api/users] Checking for existing user:', username);
    const existingUsers = await dynamicSelect('users', { username }, ['id'], 1);
    const checkResult = { rows: existingUsers };

    if (checkResult.rows.length > 0) {
      console.log('[POST /api/users] User already exists:', username);
      return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています' });
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーを追加（ゲートウェイ方式）
    const userData = {
      username,
      password: hashedPassword,
      display_name: display_name || null,
      role: role || 'user'
    };

    // emailフィールドが存在する場合のみ追加
    if (email) {
      userData.email = email;
    }

    console.log('[POST /api/users] Inserting user:', { username, display_name, role, email });
    const users = await dynamicInsert('users', userData);

    console.log('[POST /api/users] User created successfully:', users[0]);
    res.json({ success: true, user: users[0], message: 'ユーザーを追加しました' });
  } catch (err) {
    console.error('[POST /api/users] User create error:', err);
    console.error('[POST /api/users] Error stack:', err.stack);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
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

    console.log('[PUT /api/users/:id] Request body:', req.body);
    const { username, display_name, password, role, email } = req.body;

    // バリデーション
    if (!username) {
      console.log('[PUT /api/users/:id] Validation failed: missing username');
      return res.status(400).json({ success: false, message: 'ユーザー名は必須です' });
    }

    // ユーザー名の重複チェック（自分以外）
    const route = await resolveTablePath('users');
    const checkQuery = `SELECT id FROM ${route.fullPath} WHERE username = $1 AND id != $2`;
    const checkResult = await pool.query(checkQuery, [username, userId]);

    if (checkResult.rows.length > 0) {
      console.log('[PUT /api/users/:id] User already exists:', username);
      return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています' });
    }

    // パスワードが指定されている場合
    if (password) {
      if (password.length < 8) {
        console.log('[PUT /api/users/:id] Validation failed: password too short');
        return res.status(400).json({ success: false, message: 'パスワードは8文字以上で入力してください' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const updateData = {
        username,
        display_name: display_name || null,
        password: hashedPassword,
        role: role || 'user',
        updated_at: new Date()
      };

      // emailフィールドが存在する場合のみ追加
      if (email !== undefined) {
        updateData.email = email || null;
      }

      console.log('[PUT /api/users/:id] Updating user with password');
      const users = await dynamicUpdate('users', updateData, { id: userId });

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
      }

      res.json({ success: true, user: users[0], message: 'ユーザーを更新しました' });
    } else {
      // パスワードを変更しない場合
      const updateData = {
        username,
        display_name: display_name || null,
        role: role || 'user',
        updated_at: new Date()
      };

      // emailフィールドが存在する場合のみ追加
      if (email !== undefined) {
        updateData.email = email || null;
      }

      console.log('[PUT /api/users/:id] Updating user without password');
      const users = await dynamicUpdate('users', updateData,
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

// ユーザー一括インポートエンドポイント
app.post('/api/users/import', requireAdmin, async (req, res) => {
  try {
    console.log('[POST /api/users/import] Starting import...');
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーデータが不正です'
      });
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    // 既存ユーザー名を事前に取得
    const route = await resolveTablePath('users');
    const existingUsersQuery = `SELECT username FROM ${route.fullPath}`;
    const existingResult = await pool.query(existingUsersQuery);
    const existingUsernames = new Set(existingResult.rows.map(u => u.username));

    // 各ユーザーを処理
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNum = i + 2; // +2 for header and 0-index

      try {
        // バリデーション
        if (!user.username || !user.display_name || !user.password) {
          errorDetails.push(`行${rowNum}: 必須項目が不足しています`);
          errors++;
          continue;
        }

        // パスワード長チェック
        if (user.password.length < 6) {
          errorDetails.push(`行${rowNum}: パスワードは6文字以上必要です`);
          errors++;
          continue;
        }

        // 重複チェック
        if (existingUsernames.has(user.username)) {
          console.log(`[Import] Skipping existing user: ${user.username}`);
          skipped++;
          continue;
        }

        // パスワードハッシュ化
        const hashedPassword = await bcrypt.hash(user.password, 10);

        // ユーザー挿入
        const userData = {
          username: user.username,
          password: hashedPassword,
          display_name: user.display_name,
          role: user.role || 'user'
        };

        // emailがある場合追加
        if (user.email) {
          userData.email = user.email;
        }

        await dynamicInsert('users', userData);

        // 追加成功したら既存リストに追加
        existingUsernames.add(user.username);
        imported++;
        console.log(`[Import] User imported: ${user.username}`);

      } catch (err) {
        console.error(`[Import] Error processing user at row ${rowNum}:`, err);
        errorDetails.push(`行${rowNum}: ${err.message}`);
        errors++;
      }
    }

    console.log(`[Import] Complete - Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`);

    // 結果を返す
    res.json({
      success: true,
      imported,
      skipped,
      errors,
      errorDetails,
      message: `インポート完了: 成功${imported}件、スキップ${skipped}件、エラー${errors}件`
    });

  } catch (err) {
    console.error('[POST /api/users/import] Error:', err);
    res.status(500).json({
      success: false,
      message: 'インポート処理中にサーバーエラーが発生しました: ' + err.message
    });
  }
});



// ========================================
// 事業所マスタ API
// ========================================

// 事業所一覧取得
app.get('/api/offices', authenticateToken, async (req, res) => {
  try {
    const route = await resolveTablePath('management_offices');
    const query = `SELECT * FROM ${route.fullPath} ORDER BY office_id DESC`;
    const result = await pool.query(query);
    res.json({ success: true, offices: result.rows });
  } catch (err) {
    console.error('Offices list error:', err);
    console.error('Offices list error stack:', err.stack);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
  }
});

// 事業所追加
app.post('/api/offices', requireAdmin, async (req, res) => {
  let { office_code, office_name, office_type, address, postal_code, phone_number } = req.body;

  if (!office_name) {
    return res.status(400).json({ success: false, message: '事業所名は必須です' });
  }

  try {
    // 事業所コードが指定されていない場合は自動採番
    if (!office_code) {
      const route = await resolveTablePath('management_offices');
      const maxCodeQuery = `SELECT MAX(CAST(office_code AS INTEGER)) as max_code FROM ${route.fullPath} WHERE office_code ~ '^[0-9]+$'`;
      const maxCodeResult = await pool.query(maxCodeQuery);
      const maxCode = maxCodeResult.rows[0].max_code || 0;
      office_code = String(maxCode + 1).padStart(4, '0');
    }

    const offices = await dynamicInsert('management_offices', {
      office_code,
      office_name,
      office_type: office_type || null,
      address: address || null,
      postal_code: postal_code || null,
      phone_number: phone_number || null
    });

    res.json({ success: true, office: offices[0], message: '事業所を追加しました' });
  } catch (err) {
    console.error('Office insert error:', err);
    console.error('Office insert error stack:', err.stack);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'この事業所コードは既に登録されています' });
    } else {
      res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
    }
  }
});

// 事業所更新
app.put('/api/offices/:id', requireAdmin, async (req, res) => {
  const officeId = req.params.id;
  const { office_code, office_name, office_type, address, postal_code, phone_number } = req.body;

  if (!office_name) {
    return res.status(400).json({ success: false, message: '事業所名は必須です' });
  }

  try {
    const offices = await dynamicUpdate('management_offices',
      {
        office_code: office_code || null,
        office_name,
        office_type: office_type || null,
        address: address || null,
        postal_code: postal_code || null,
        phone_number: phone_number || null,
        updated_at: new Date()
      },
      { id: officeId }
    );

    if (offices.length === 0) {
      return res.status(404).json({ success: false, message: '事業所が見つかりません' });
    }

    res.json({ success: true, office: offices[0], message: '事業所を更新しました' });
  } catch (err) {
    console.error('Office update error:', err);
    console.error('Office update error stack:', err.stack);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
  }
});

// 事業所削除
app.delete('/api/offices/:id', requireAdmin, async (req, res) => {
  const officeId = req.params.id;

  try {
    const offices = await dynamicDelete('management_offices', { id: officeId }, true);

    if (offices.length === 0) {
      return res.status(404).json({ success: false, message: '事業所が見つかりません' });
    }

    res.json({ success: true, message: '事業所を削除しました' });
  } catch (err) {
    console.error('Office delete error:', err);
    console.error('Office delete error stack:', err.stack);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
  }
});

// ========================================
// 保守基地マスタ API
// ========================================

// 保守基地一覧取得
app.get('/api/bases', authenticateToken, async (req, res) => {
  try {
    const basesRoute = await resolveTablePath('bases');
    const officesRoute = await resolveTablePath('management_offices');

    const query = `
      SELECT b.*, o.office_name 
      FROM ${basesRoute.fullPath} b
      LEFT JOIN ${officesRoute.fullPath} o ON b.office_id = o.office_id
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
  let { base_code, base_name, management_office_id, location, address, postal_code } = req.body;

  // 互換性のためoffice_idも受け入れる
  if (req.body.office_id && !management_office_id) {
    management_office_id = req.body.office_id;
  }

  if (!base_name) {
    return res.status(400).json({ success: false, message: '基地名は必須です' });
  }

  try {
    const basesRoute = await resolveTablePath('bases');

    // 基地コードが指定されていない場合は自動採番
    if (!base_code) {
      const maxCodeQuery = `SELECT MAX(CAST(base_code AS INTEGER)) as max_code FROM ${basesRoute.fullPath} WHERE base_code ~ '^[0-9]+$'`;
      const maxCodeResult = await pool.query(maxCodeQuery);
      const maxCode = maxCodeResult.rows[0].max_code || 0;
      base_code = String(maxCode + 1).padStart(4, '0');
    }

    const insertQuery = `
      INSERT INTO ${basesRoute.fullPath} 
      (base_code, base_name, location, office_id, address, postal_code)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      base_code,
      base_name,
      location || null,
      management_office_id || null,
      address || null,
      postal_code || null
    ]);

    res.json({ success: true, base: result.rows[0], message: '保守基地を追加しました' });
  } catch (err) {
    console.error('Base insert error:', err);
    console.error('Base insert error stack:', err.stack);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'この基地コードは既に登録されています' });
    } else {
      res.status(500).json({ success: false, message: 'サーバーエラーが発生しました: ' + err.message });
    }
  }
});

// 保守基地更新
app.put('/api/bases/:id', requireAdmin, async (req, res) => {
  const baseId = req.params.id;
  let { base_code, base_name, management_office_id, location, address, postal_code } = req.body;

  // 互換性のためoffice_idも受け入れる
  if (req.body.office_id && !management_office_id) {
    management_office_id = req.body.office_id;
  }

  try {
    const basesRoute = await resolveTablePath('bases');

    const updateQuery = `
      UPDATE ${basesRoute.fullPath} 
      SET base_name = $1, location = $2, office_id = $3, address = $4, postal_code = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE base_id = $6
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      base_name,
      location || null,
      management_office_id || null,
      address || null,
      postal_code || null,
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
    const basesRoute = await resolveTablePath('bases');
    const deleteQuery = `DELETE FROM ${basesRoute.fullPath} WHERE base_id = $1 RETURNING base_name`;
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

// ========================================
// AI管理API
// ========================================

// AI設定取得
app.get('/api/ai/settings', requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT app_id, setting_type, settings_json, updated_at
      FROM master_data.ai_settings
      WHERE app_id = 'common'
      ORDER BY setting_type
    `;
    const result = await pool.query(query);

    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_type] = {
        data: row.settings_json,
        updated_at: row.updated_at
      };
    });

    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error getting AI settings:', err);
    res.status(500).json({ success: false, message: 'AI設定の取得に失敗しました' });
  }
});

// AI設定保存
app.post('/api/ai/settings', requireAdmin, async (req, res) => {
  try {
    const { settingType, settings } = req.body;

    console.log('[AI Settings] Saving - Type:', settingType, 'Settings:', settings);

    if (!settingType || !settings) {
      return res.status(400).json({ success: false, message: '必須パラメータが不足しています' });
    }

    // 設定データのバリデーション
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({ success: false, message: '設定データの形式が不正です' });
    }

    const query = `
      INSERT INTO master_data.ai_settings (app_id, setting_type, settings_json)
      VALUES ('common', $1, $2)
      ON CONFLICT (app_id, setting_type)
      DO UPDATE SET settings_json = $2, updated_at = CURRENT_TIMESTAMP
      RETURNING id, setting_type, updated_at
    `;

    const result = await pool.query(query, [settingType, JSON.stringify(settings)]);

    console.log('[AI Settings] Saved successfully:', result.rows[0]);
    res.json({ success: true, message: 'AI設定を保存しました', data: result.rows[0] });
  } catch (err) {
    console.error('[AI Settings] Save error:', err);
    console.error('[AI Settings] Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail
    });
    res.status(500).json({
      success: false,
      message: 'AI設定の保存に失敗しました',
      error: err.message
    });
  }
});

// ナレッジデータ一覧取得（自動文字化け修正機能付き）
app.get('/api/ai/knowledge', requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT id, file_name, file_path, file_size_bytes, file_type,
             upload_source, description, tags, is_active, uploaded_by,
             uploaded_at, last_used_at, usage_count
      FROM master_data.ai_knowledge_data
      WHERE is_active = true
      ORDER BY uploaded_at DESC
    `;
    const result = await pool.query(query);

    // ファイル名の自動デコード処理
    const processedData = result.rows.map(row => {
      let displayFileName = row.file_name;

      // 1. descriptionから正しいファイル名を取得できる場合
      if (row.description && row.description.startsWith('Manual: ')) {
        displayFileName = row.description.replace('Manual: ', '');
      }
      // 2. file_nameに文字化け記号(�)が含まれる場合
      else if (row.file_name && (row.file_name.includes('�') || row.file_name.includes('�'))) {
        // descriptionから抽出を試みる
        if (row.description) {
          const match = row.description.match(/Manual:\s*(.+)/);
          if (match) {
            displayFileName = match[1];
          }
        }
      }
      // 3. UTF-8デコードを試みる（バイナリが保存されている可能性）
      else if (row.file_name) {
        try {
          // 既にUTF-8として正しく保存されているはずだが、念のため確認
          const buffer = Buffer.from(row.file_name, 'utf8');
          displayFileName = buffer.toString('utf8');
        } catch (e) {
          // エラーの場合は元の値を使用
          console.log(`[Knowledge] Unable to decode: ${row.file_name}`);
        }
      }

      return {
        ...row,
        file_name: displayFileName
      };
    });

    res.json({ success: true, data: processedData });
  } catch (err) {
    console.error('Error getting knowledge data:', err);
    res.status(500).json({ success: false, message: 'ナレッジデータの取得に失敗しました' });
  }
});

// ファイルアップロード
app.post('/api/ai/knowledge/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ファイルが選択されていません' });
    }

    const { description, tags, uploadedBy, saveOriginalFile } = req.body;
    const file = req.file;

    console.log('[AI Upload] Starting file upload:', file.originalname);
    console.log('[AI Upload] saveOriginalFile:', saveOriginalFile);

    // GCS設定を取得
    const settingsQuery = `
      SELECT settings_json FROM master_data.ai_settings
      WHERE app_id = 'common' AND setting_type = 'storage'
    `;
    const settingsResult = await pool.query(settingsQuery);
    const storageSettings = settingsResult.rows[0]?.settings_json || {};

    const configuredBucketName = (storageSettings.gcsBucketName && storageSettings.gcsBucketName.trim())
      ? storageSettings.gcsBucketName.trim()
      : (process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'maint-vehicle-management-storage');
    const bucketName = getRequestBucketName(req, configuredBucketName);

    const folderPath = (storageSettings.gcsKnowledgeFolder && storageSettings.gcsKnowledgeFolder.trim())
      ? storageSettings.gcsKnowledgeFolder.trim()
      : (process.env.GCS_KNOWLEDGE_FOLDER || 'ai-knowledge');

    console.log('[AI Upload] GCS Bucket:', bucketName);
    console.log('[AI Upload] GCS Folder:', folderPath);

    if (!bucketName) {
      return res.status(400).json({
        success: false,
        message: 'GCSバケット名が設定されていません。.envファイルでGCS_BUCKET_NAMEまたはGOOGLE_CLOUD_STORAGE_BUCKETを設定してください。'
      });
    }

    // ファイル名生成（日本語対応・安全な形式）
    const timestamp = Date.now();
    const fileSize = file.buffer.length;
    const fileType = path.extname(file.originalname).slice(1);

    // 日本語ファイル名を安全にエンコード
    const safeFileName = Buffer.from(file.originalname, 'utf-8').toString('utf-8');
    const fileNameWithoutExt = path.basename(safeFileName, path.extname(safeFileName));
    const extension = path.extname(safeFileName);

    // GCS用のファイル名（タイムスタンプ_元のファイル名）
    const gcsFileName = `${timestamp}_${safeFileName}`;

    console.log('[AI Upload] Original filename:', file.originalname);
    console.log('[AI Upload] Safe filename:', safeFileName);
    console.log('[AI Upload] GCS filename:', gcsFileName);

    let originalFilePath = null;
    let chunksPath = null;
    let ragMetadataPath = null;
    let chunks = [];

    // ファイルタイプを判定
    const isImageFile = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'].includes(extension.toLowerCase());
    const isJsonFile = extension.toLowerCase() === '.json';
    const isManualFile = ['.pdf', '.txt', '.xlsx', '.docx', '.md'].includes(extension.toLowerCase());

    // 1. 元ファイルをGCSに保存（ファイルタイプに応じて適切なフォルダに振り分け）
    if (isImageFile || isJsonFile || isManualFile || saveOriginalFile === 'true') {
      // ファイルタイプに応じて保存先フォルダを決定
      let targetFolder = 'originals'; // デフォルト
      if (isImageFile) {
        targetFolder = 'images';
      } else if (isManualFile) {
        targetFolder = 'manuals';
      }

      originalFilePath = `${folderPath}/${targetFolder}/${gcsFileName}`;
      const originalFile = storage.bucket(bucketName).file(originalFilePath);
      await originalFile.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          cacheControl: 'public, max-age=31536000',
          metadata: {
            originalName: safeFileName,
            uploadedBy: uploadedBy || 'admin',
            uploadedAt: new Date().toISOString(),
            isImageFile: isImageFile,
            isJsonFile: isJsonFile,
            isManualFile: isManualFile,
            targetFolder: targetFolder
          }
        }
      });
      console.log(`[GCS] ✅ Original file saved to ${targetFolder}/: ${originalFilePath}`);
    }

    // 2. ファイル内容をテキスト化・チャンク処理
    const textContent = await extractTextFromFile(file);
    chunks = chunkText(textContent, 1000, 200); // 1000文字、200文字オーバーラップ
    console.log(`[AI Upload] ✅ Text extracted and chunked: ${chunks.length} chunks`);

    // 3. チャンクをGCSに保存
    chunksPath = `${folderPath}/chunks/${timestamp}_${fileNameWithoutExt}.json`;
    const chunksFile = storage.bucket(bucketName).file(chunksPath);
    const chunksData = JSON.stringify({
      originalFile: safeFileName,
      totalChunks: chunks.length,
      chunks: chunks.map((text, index) => ({
        index,
        text,
        length: text.length
      })),
      processedAt: new Date().toISOString()
    }, null, 2);

    await chunksFile.save(Buffer.from(chunksData, 'utf-8'), {
      contentType: 'application/json; charset=utf-8',
      metadata: {
        metadata: {
          type: 'chunks',
          originalFile: safeFileName
        }
      }
    });
    console.log(`[GCS] ✅ Chunks saved: ${chunksPath} (${chunks.length} chunks)`);

    // 4. RAG用ベクトル化メタデータを生成・保存
    const ragMetadata = {
      fileId: timestamp,
      fileName: safeFileName,
      fileType,
      fileSize,
      totalChunks: chunks.length,
      chunkSize: 1000,
      overlap: 200,
      processedAt: new Date().toISOString(),
      vectorizationReady: true,
      chunkSummaries: chunks.map((chunk, index) => ({
        chunkIndex: index,
        preview: chunk.substring(0, 100) + '...',
        length: chunk.length
      }))
    };

    ragMetadataPath = `${folderPath}/metadata/${timestamp}_${fileNameWithoutExt}.json`;
    const ragMetadataFile = storage.bucket(bucketName).file(ragMetadataPath);
    const metadataData = JSON.stringify(ragMetadata, null, 2);

    await ragMetadataFile.save(Buffer.from(metadataData, 'utf-8'), {
      contentType: 'application/json; charset=utf-8',
      metadata: {
        metadata: {
          type: 'rag-metadata',
          originalFile: file.originalname
        }
      }
    });
    console.log(`[GCS] ✅ RAG metadata saved: ${ragMetadataPath}`);

    // 5. CloudDB（PostgreSQL）にバックアップ・記録
    const insertQuery = `
      INSERT INTO master_data.ai_knowledge_data
      (file_name, file_path, file_size_bytes, file_type, upload_source, description, tags, uploaded_by,
       gcs_original_path, gcs_chunks_path, gcs_rag_metadata_path, total_chunks, processing_status)
      VALUES ($1, $2, $3, $4, 'gcs', $5, $6, $7, $8, $9, $10, $11, 'completed')
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [
      file.originalname,
      chunksPath, // メインのパスはチャンクデータ
      fileSize,
      fileType,
      description || `${file.originalname}のナレッジデータ`,
      tags ? tags.split(',').map(t => t.trim()) : [],
      uploadedBy || 'admin',
      originalFilePath,
      chunksPath,
      ragMetadataPath,
      chunks.length
    ]);

    console.log(`[DB] ✅ Knowledge data record created: ID=${result.rows[0].id}`);

    res.json({
      success: true,
      message: 'ファイルをGCSにアップロードし、処理しました',
      id: result.rows[0].id,
      details: {
        bucket: bucketName,
        folder: folderPath,
        originalSaved: !!originalFilePath,
        chunksCreated: chunks.length,
        chunksPath: chunksPath,
        metadataPath: ragMetadataPath
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ success: false, message: 'ファイルのアップロードに失敗しました: ' + err.message });
  }
});

// テキスト抽出ヘルパー関数
async function extractTextFromFile(file) {
  const fileType = path.extname(file.originalname).toLowerCase();

  // 画像ファイルの場合はメタデータのみ返す（実際の画像は元ファイルとして保存される）
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'].includes(fileType)) {
    return JSON.stringify({
      type: 'image',
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      description: `画像ファイル: ${file.originalname}`,
      metadata: {
        uploadedAt: new Date().toISOString(),
        fileType: fileType,
        isImageFile: true
      }
    }, null, 2);
  }

  // JSONファイルの場合はそのまま内容を返す
  if (fileType === '.json') {
    try {
      const content = file.buffer.toString('utf-8');
      // JSONが正しいかバリデーション
      JSON.parse(content);
      return content;
    } catch (e) {
      console.error('Invalid JSON file:', e);
      return `{"error": "Invalid JSON format", "fileName": "${file.originalname}"}`;
    }
  }

  // テキストファイルの場合
  const content = file.buffer.toString('utf-8');

  // 簡易実装：TXT, MD等はそのまま、PDF/DOCXは後で実装
  if (['.txt', '.md', '.js', '.py', '.java', '.cpp', '.c', '.h'].includes(fileType)) {
    return content;
  } else if (fileType === '.pdf') {
    // TODO: PDF-parseライブラリを使用
    return `[PDF Content] ${file.originalname} - PDF解析は今後実装予定`;
  } else if (['.docx', '.doc'].includes(fileType)) {
    // TODO: mammothライブラリを使用
    return `[DOCX Content] ${file.originalname} - DOCX解析は今後実装予定`;
  } else if (['.xlsx', '.xls'].includes(fileType)) {
    // TODO: xlsx パッケージを使用
    return `[XLSX Content] ${file.originalname} - Excel解析は今後実装予定`;
  }

  return content;
}

// テキストチャンク化ヘルパー関数
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text || text.length === 0) return [];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));

    // オーバーラップを考慮して次のスタート位置を設定
    start += chunkSize - overlap;

    // 最後のチャンクの場合は終了
    if (end === text.length) break;
  }

  return chunks;
}

// ナレッジデータ削除（論理削除+関連データクリーンアップ）
app.delete('/api/ai/knowledge/:id', requireAdmin, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { id } = req.params;

    console.log('[Knowledge Delete] Step 3: Starting transaction...');
    await client.query('BEGIN');
    console.log('[Knowledge Delete] Step 3: ✅ Transaction started');

    // 1. ファイル情報を取得（3つのGCSパスを含む）
    console.log('[Knowledge Delete] Step 4: Querying file info...');
    const fileQuery = `
      SELECT file_name, file_path, gcs_original_path, gcs_chunks_path, gcs_rag_metadata_path 
      FROM master_data.ai_knowledge_data 
      WHERE id = $1
    `;
    const fileResult = await client.query(fileQuery, [id]);

    if (fileResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'データが見つかりません' });
    }

    const fileInfo = fileResult.rows[0];

    // 2. 論理削除（is_active = false）
    const deleteQuery = `
      UPDATE master_data.ai_knowledge_data 
      SET is_active = false
      WHERE id = $1
      RETURNING id, file_name, is_active
    `;
    const deleteResult = await client.query(deleteQuery, [id]);

    // 3. 関連するチャンクデータがあれば削除（テーブルが存在する場合のみ）
    try {
      // テーブルの存在確認（エラーにならない方法）
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'master_data' 
          AND table_name = 'ai_knowledge_chunks'
        ) as table_exists
      `;
      const tableCheckResult = await client.query(tableCheckQuery);

      if (tableCheckResult.rows[0].table_exists) {
        const chunkDeleteQuery = `
          DELETE FROM master_data.ai_knowledge_chunks 
          WHERE knowledge_id = $1
        `;
        await client.query(chunkDeleteQuery, [id]);
      }
    } catch (chunkErr) {
      console.warn('Chunks table error (non-critical):', chunkErr.message);
    }

    // 4. GCSファイルの削除（3つのファイルすべて - エラーでもロールバックしない）
    try {
      const bucketName = getRequestBucketName(req, process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET);

      if (bucketName && storage) {
        const bucket = storage.bucket(bucketName);

        // 4-1. オリジナルファイルの削除
        if (fileInfo.gcs_original_path) {
          try {
            await bucket.file(fileInfo.gcs_original_path).delete();
          } catch (gcsErr) {
            console.warn('Original file deletion failed (non-critical):', gcsErr.message);
          }
        }

        // 4-2. チャンクファイルの削除
        if (fileInfo.gcs_chunks_path) {
          try {
            await bucket.file(fileInfo.gcs_chunks_path).delete();
          } catch (gcsErr) {
            console.warn('Chunks file deletion failed (non-critical):', gcsErr.message);
          }
        }

        // 4-3. RAGメタデータファイルの削除
        if (fileInfo.gcs_rag_metadata_path) {
          try {
            await bucket.file(fileInfo.gcs_rag_metadata_path).delete();
          } catch (gcsErr) {
            console.warn('Metadata file deletion failed (non-critical):', gcsErr.message);
          }
        }
      }
    } catch (gcsErr) {
      console.warn('GCS deletion error (non-critical):', gcsErr.message);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `「${fileInfo.file_name}」を削除しました（関連データも含む）`
    });

  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }
    console.error('Error deleting knowledge data:', err);
    res.status(500).json({
      success: false,
      message: 'データの削除に失敗しました: ' + err.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});



// ストレージ統計情報取得
app.get('/api/ai/storage-stats', requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size_bytes) as total_size_bytes,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_files,
        COUNT(CASE WHEN upload_source = 'local' THEN 1 END) as local_uploads,
        COUNT(CASE WHEN upload_source = 'gcs' THEN 1 END) as gcs_imports
      FROM master_data.ai_knowledge_data
    `;
    const result = await pool.query(query);

    const stats = result.rows[0];
    stats.total_size_mb = (parseFloat(stats.total_size_bytes || 0) / (1024 * 1024)).toFixed(2);

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error getting storage stats:', err);
    res.status(500).json({ success: false, message: '統計情報の取得に失敗しました' });
  }
});

// GCS接続診断
app.get('/api/ai/diagnose-gcs', requireAdmin, async (req, res) => {
  try {
    console.log('[GCS Diagnosis] Starting diagnosis...');

    // GCS設定の確認
    const bucketName = getRequestBucketName(req, process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'vehicle-management-storage');

    if (!bucketName) {
      return res.status(500).json({
        success: false,
        error: 'GCSバケット名が設定されていません'
      });
    }

    // 認証キーファイルの存在チェック
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const fs = require('fs');
      if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        return res.status(500).json({
          success: false,
          error: `認証キーファイルが見つかりません: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`
        });
      }
    }

    // Storage clientの初期化確認
    const { Storage } = require('@google-cloud/storage');
    let storage;
    try {
      storage = new Storage();
    } catch (initError) {
      return res.status(500).json({
        success: false,
        error: `GCSクライアントの初期化に失敗しました: ${initError.message}`
      });
    }

    const bucket = storage.bucket(bucketName);

    // バケット存在確認
    let exists = false;
    try {
      [exists] = await bucket.exists();
    } catch (bucketError) {
      return res.status(500).json({
        success: false,
        error: `バケットへのアクセスに失敗しました: ${bucketError.message}`
      });
    }

    if (!exists) {
      return res.status(500).json({
        success: false,
        error: `バケット "${bucketName}" が見つかりません`
      });
    }

    // フォルダ構造の確認
    const [files] = await bucket.getFiles({ prefix: '', maxResults: 100 });
    const folders = new Set();

    files.forEach(file => {
      const parts = file.name.split('/');
      if (parts.length > 1) {
        folders.add(parts[0]);
      }
    });

    // ファイル数とサイズの集計
    const query = `
      SELECT 
        COUNT(*) as file_count,
        SUM(file_size_bytes) as total_size_bytes
      FROM master_data.ai_knowledge_data
      WHERE is_active = true
    `;
    const result = await pool.query(query);
    const stats = result.rows[0];

    const totalSizeMB = (parseFloat(stats.total_size_bytes || 0) / (1024 * 1024)).toFixed(2);

    console.log('[GCS Diagnosis] Success:', {
      bucket: bucketName,
      folders: Array.from(folders),
      fileCount: stats.file_count
    });

    res.json({
      success: true,
      bucket: bucketName,
      folders: Array.from(folders),
      fileCount: parseInt(stats.file_count || 0),
      totalSize: `${totalSizeMB} MB`
    });

  } catch (err) {
    console.error('[GCS Diagnosis] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'GCS接続診断中にエラーが発生しました'
    });
  }
});

// ========================================
// END: AI管理API
// ========================================

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

// デバッグ用: テーブル存在確認
app.get('/debug/tables', async (req, res) => {
  try {
    const tables = ['management_offices', 'vehicles', 'machines', 'machine_types', 'bases', 'users', 'inspection_types', 'inspection_schedules'];
    const results = {};

    for (const tableName of tables) {
      try {
        const checkQuery = `
          SELECT EXISTS(
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'master_data' 
            AND table_name = $1
          ) as exists
        `;
        const checkResult = await pool.query(checkQuery, [tableName]);
        results[tableName] = {
          exists: checkResult.rows[0].exists,
          error: null
        };

        // テーブルが存在する場合、カラム情報も取得
        if (checkResult.rows[0].exists) {
          const columnsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'master_data' 
            AND table_name = $1
            ORDER BY ordinal_position
          `;
          const columnsResult = await pool.query(columnsQuery, [tableName]);
          results[tableName].columns = columnsResult.rows;
        }
      } catch (err) {
        results[tableName] = {
          exists: false,
          error: err.message
        };
      }
    }

    // ルーティングテーブルの確認
    try {
      const routingQuery = `
        SELECT logical_resource_name, physical_schema, physical_table, is_active
        FROM public.app_resource_routing
        WHERE app_id = 'dashboard-ui'
        ORDER BY logical_resource_name
      `;
      const routingResult = await pool.query(routingQuery);
      results._routing = routingResult.rows;
    } catch (err) {
      results._routing = { error: err.message };
    }

    res.json({ success: true, tables: results });
  } catch (err) {
    console.error('Debug tables error:', err);
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});

// デバッグエンドポイント: postal_codeカラム追加
app.post('/debug/add-postal-code', async (req, res) => {
  try {
    console.log('managements_officesにpostal_codeカラムを追加...');
    await pool.query(`
      ALTER TABLE master_data.managements_offices 
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)
    `);

    console.log('basesにpostal_codeカラムを追加...');
    await pool.query(`
      ALTER TABLE master_data.bases 
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)
    `);

    res.json({ success: true, message: 'postal_codeカラムを追加しました' });
  } catch (err) {
    console.error('Add postal_code error:', err);
    res.status(500).json({ success: false, message: 'エラーが発生しました: ' + err.message });
  }
});

// ========================================
// 機種マスタ・機械番号マスタ API (統合表示用)
// ========================================

// 機種マスタ一覧取得
app.get('/api/machine-types', requireAdmin, async (req, res) => {
  try {
    const route = await resolveTablePath('machine_types');
    console.log(`[GET /api/machine-types] Resolved Route: ${route.fullPath}`);
    const query = `SELECT * FROM ${route.fullPath} ORDER BY id`;
    console.log(`[GET /api/machine-types] Executing: ${query}`);
    const result = await pool.query(query);
    console.log(`[GET /api/machine-types] Success, Rows: ${result.rows.length}`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('❌ Machine types get error:', err.message);
    console.error('❌ Error Stack:', err.stack);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました(機種一覧)',
      detail: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
  }
});

// 機種マスタ追加
app.post('/api/machine-types', requireAdmin, async (req, res) => {
  try {
    console.log('[POST /api/machine-types] Ultra-Strict Smart Save...');

    const cleaned = {};
    Object.keys(req.body).forEach(key => {
      cleaned[key] = (req.body[key] === '' ? null : req.body[key]);
    });

    let { type_name, manufacturer, category, description, model_name, model } = cleaned;
    const final_model_name = model_name || model || null;
    const final_manufacturer = manufacturer || null;

    if (!type_name) return res.status(400).json({ success: false, message: '機種名は必須です' });

    const route = await resolveTablePath('machine_types');

    // 【厳格判定】 機種名・型式・メーカーの3つが完全に一致するものがあるか？
    const matchQuery = `
      SELECT id FROM ${route.fullPath}
      WHERE type_name = $1
        AND (model_name IS NOT DISTINCT FROM $2)
        AND (manufacturer IS NOT DISTINCT FROM $3)
      LIMIT 1
    `;
    const matchResult = await pool.query(matchQuery, [type_name, final_model_name, final_manufacturer]);

    if (matchResult.rows.length > 0) {
      // 完全に一致する場合のみ「上書き」
      const existingId = matchResult.rows[0].id;
      console.log(`[MachineTypes] Exact match found (${existingId}). Updating existing record...`);
      const updateData = { category, description, updated_at: new Date() };
      const result = await dynamicUpdate('machine_types', updateData, { id: existingId });
      return res.json({ success: true, data: result[0], message: '既存の同一機種を特定し、情報を更新しました' });
    }

    // 1つでも違う場合は「新規追加」
    console.log(`[MachineTypes] New combination detected. Creating new record...`);

    // 確実にユニークなIDを生成 (MT + タイムスタンプの下6桁 + ランダム)
    const uniqueSuffix = Date.now().toString().slice(-6) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const new_type_code = `MT-${uniqueSuffix}`;

    const saveData = {
      id: new_type_code,
      type_code: new_type_code,
      type_name,
      manufacturer: final_manufacturer,
      category,
      description,
      model_name: final_model_name
    };

    const result = await dynamicInsert('machine_types', saveData);
    res.json({ success: true, data: result[0], message: '新しい機種（別レコード）として登録しました' });

  } catch (err) {
    console.error('[POST /api/machine-types] Fatal Error:', err.message);
    res.status(500).json({ success: false, message: '保存に失敗しました: ' + err.message, detail: err.detail });
  }
});

// 機種マスタ個別取得
app.get('/api/machine-types/:id', requireAdmin, async (req, res) => {
  try {
    const machineTypeId = req.params.id;
    const types = await dynamicSelect('machine_types', { id: machineTypeId });

    if (types.length === 0) {
      return res.status(404).json({ success: false, message: '機種が見つかりません' });
    }

    res.json({ success: true, data: types[0] });
  } catch (err) {
    console.error('Machine type get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 機種マスタ更新
app.put('/api/machine-types/:id', requireAdmin, async (req, res) => {
  try {
    const machineTypeId = req.params.id;
    // データクリーニング (空文字をnullに変換)
    const cleaned = {};
    Object.keys(req.body).forEach(key => {
      cleaned[key] = (req.body[key] === '' ? null : req.body[key]);
    });

    const { type_name, manufacturer, category, description, model_name, model } = cleaned;

    if (!type_name) {
      return res.status(400).json({ success: false, message: '機種名は必須です' });
    }

    const updateData = {
      type_name,
      manufacturer,
      category,
      description,
      model_name: model_name || model || null,
      updated_at: new Date()
    };

    const types = await dynamicUpdate('machine_types', updateData, { id: machineTypeId }, true);

    if (types.length === 0) {
      return res.status(404).json({ success: false, message: '機種が見つかりません' });
    }

    res.json({ success: true, data: types[0], message: '機種を更新しました' });
  } catch (err) {
    console.error('[PUT /api/machine-types/:id] Machine type update error:', err.message);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました(更新): ' + err.message,
      stack: err.stack
    });
  }
});

// 機種マスタ削除
app.delete('/api/machine-types/:id', requireAdmin, async (req, res) => {
  try {
    const machineTypeId = req.params.id;
    const types = await dynamicDelete('machine_types', { id: machineTypeId }, true);

    if (types.length === 0) {
      return res.status(404).json({ success: false, message: '機種が見つかりません' });
    }

    res.json({ success: true, message: '機種を削除しました' });
  } catch (err) {
    console.error('Machine type delete error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// 機械番号マスタ一覧取得（機種情報も含む統合ビュー）
app.get('/api/machines', requireAdmin, async (req, res) => {
  try {
    const machinesRoute = await resolveTablePath('machines');
    const machineTypesRoute = await resolveTablePath('machine_types');
    const officesRoute = await resolveTablePath('management_offices');

    console.log(`[GET /api/machines] Resolving tables:`, { 
      machines: machinesRoute.fullPath, 
      types: machineTypesRoute.fullPath,
      offices: officesRoute.fullPath 
    });

    const query = `
      SELECT 
        m.id,
        m.machine_number,
        m.serial_number,
        m.manufacture_date,
        m.purchase_date,
        m.assigned_base_id,
        m.office_id,
        m.notes,
        m.machine_type_id,
        mt.model_name,
        mt.manufacturer,
        mt.category,
        COALESCE(mo.office_name, '配置未設定') as office_name,
        m.created_at,
        m.updated_at
      FROM ${machinesRoute.fullPath} m
      LEFT JOIN ${machineTypesRoute.fullPath} mt ON m.machine_type_id::text = mt.id::text
      LEFT JOIN ${officesRoute.fullPath} mo ON m.office_id = mo.office_id
      ORDER BY m.machine_number
    `;
    console.log(`[GET /api/machines] Executing SQL...`);
    const result = await pool.query(query);
    console.log(`[GET /api/machines] Success, result count: ${result.rows.length}`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('❌ Machines get error:', err.message);
    console.error('❌ Stack:', err.stack);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました(保守用車一覧)',
      detail: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
  }
});

// 機械番号マスタ追加
app.post('/api/machines', requireAdmin, async (req, res) => {
  try {
    // データクリーニング (空文字をnullに変換)
    const cleaned = {};
    Object.keys(req.body).forEach(key => {
      cleaned[key] = (req.body[key] === '' ? null : req.body[key]);
    });

    const {
      machine_number,
      machine_type_id,
      serial_number,
      manufacture_date,
      purchase_date,
      notes,
      type_certification,
      office_id
    } = cleaned;

    if (!machine_number || !machine_type_id) {
      return res.status(400).json({ success: false, message: '機械番号と機種は必須です' });
    }

    // 自動採番ID (M0001...)
    const route = await resolveTablePath('machines');
    let machine_id;
    try {
      const maxIdResult = await pool.query(`SELECT id::text FROM ${route.fullPath} WHERE id::text LIKE 'M%' ORDER BY id DESC LIMIT 1`);
      let nextNumber = 1;
      if (maxIdResult.rows.length > 0) {
        const lastId = maxIdResult.rows[0].id;
        const numericPart = parseInt(lastId.replace('M', ''));
        if (!isNaN(numericPart)) {
          nextNumber = numericPart + 1;
        }
      }
      machine_id = `M${String(nextNumber).padStart(4, '0')}`;
    } catch (e) {
      machine_id = `M${Date.now().toString().slice(-6)}`;
    }

    const now = new Date();
    const machines = await dynamicInsert('machines', {
      id: machine_id,
      machine_number,
      machine_type_id,
      serial_number,
      manufacture_date,
      purchase_date,
      notes,
      type_certification,
      office_id,
      created_at: now,
      updated_at: now
    });
    res.json({ success: true, data: machines[0], message: '機械を追加しました' });
  } catch (err) {
    console.error('[POST /api/machines] Machine create error:', err.message);
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'この機械番号は既に登録されています' });
    } else {
      res.status(500).json({
        success: false,
        message: 'サーバーエラーが発生しました(追加): ' + err.message,
        stack: err.stack
      });
    }
  }
});

// 機械番号マスタ更新
app.put('/api/machines/:id', requireAdmin, async (req, res) => {
  try {
    const machineId = req.params.id;
    // データクリーニング (空文字をnullに変換)
    const cleaned = {};
    Object.keys(req.body).forEach(key => {
      cleaned[key] = (req.body[key] === '' ? null : req.body[key]);
    });

    const {
      machine_number,
      machine_type_id,
      serial_number,
      manufacture_date,
      purchase_date,
      notes,
      type_certification,
      office_id
    } = cleaned;

    console.log(`[Machines] Updating machine ID: ${machineId}`, cleaned);

    const updateData = {
      machine_number,
      machine_type_id,
      serial_number,
      manufacture_date,
      purchase_date,
      notes,
      type_certification,
      office_id,
      updated_at: new Date()
    };

    const machines = await dynamicUpdate('machines', updateData, { id: machineId });

    if (machines.length === 0) {
      return res.status(404).json({ success: false, message: '機械が見つかりません' });
    }

    res.json({ success: true, data: machines[0], message: '機械を更新しました' });
  } catch (err) {
    console.error('[PUT /api/machines/:id] Machine update error:', err.message);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました(更新): ' + err.message,
      stack: err.stack
    });
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

// ========================================
// 検修マスタ API エンドポイント
// ========================================

// 検修種別一覧取得
app.get('/api/inspection-types', requireAdmin, async (req, res) => {
  try {
    console.log('[GET /api/inspection-types] Fetching inspection types...');
    const route = await resolveTablePath('inspection_types');
    const query = `SELECT * FROM ${route.fullPath} ORDER BY display_order, id`;
    const result = await pool.query(query);
    console.log('[GET /api/inspection-types] Success:', result.rows.length);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('❌ Inspection types get error:', err.message);
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別詳細取得
app.get('/api/inspection-types/:id', requireAdmin, async (req, res) => {
  try {
    const typeId = req.params.id;
    const types = await dynamicSelect('inspection_types', { id: typeId });

    if (types.length === 0) {
      return res.status(404).json({ success: false, error: '検修種別が見つかりません' });
    }

    res.json({ success: true, data: types[0] });
  } catch (err) {
    console.error('❌ Inspection type get error:', err.message);
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別追加
app.post('/api/inspection-types', requireAdmin, async (req, res) => {
  try {
    const { type_code, type_name, description, display_order, is_active } = req.body;

    if (!type_name) {
      return res.status(400).json({ success: false, error: '種別名は必須です' });
    }

    // type_codeが提供されない場合は自動生成（type_nameから）
    let finalTypeCode = type_code;
    if (!finalTypeCode) {
      // type_nameから自動生成（例: "A検修" -> "A_KENSHU"）
      finalTypeCode = type_name
        .replace(/[ぁ-ん]/g, match => {
          // ひらがなをカタカナに変換
          return String.fromCharCode(match.charCodeAt(0) + 0x60);
        })
        .replace(/[ァ-ヶー]/g, match => {
          // カタカナをローマ字に変換（簡易版）
          const kanaMap = {
            'ア': 'A', 'イ': 'I', 'ウ': 'U', 'エ': 'E', 'オ': 'O',
            'カ': 'KA', 'キ': 'KI', 'ク': 'KU', 'ケ': 'KE', 'コ': 'KO',
            'サ': 'SA', 'シ': 'SHI', 'ス': 'SU', 'セ': 'SE', 'ソ': 'SO',
            'タ': 'TA', 'チ': 'CHI', 'ツ': 'TSU', 'テ': 'TE', 'ト': 'TO',
            'ナ': 'NA', 'ニ': 'NI', 'ヌ': 'NU', 'ネ': 'NE', 'ノ': 'NO',
            'ハ': 'HA', 'ヒ': 'HI', 'フ': 'FU', 'ヘ': 'HE', 'ホ': 'HO',
            'マ': 'MA', 'ミ': 'MI', 'ム': 'MU', 'メ': 'ME', 'モ': 'MO',
            'ヤ': 'YA', 'ユ': 'YU', 'ヨ': 'YO',
            'ラ': 'RA', 'リ': 'RI', 'ル': 'RU', 'レ': 'RE', 'ロ': 'RO',
            'ワ': 'WA', 'ヲ': 'WO', 'ン': 'N',
            'ガ': 'GA', 'ギ': 'GI', 'グ': 'GU', 'ゲ': 'GE', 'ゴ': 'GO',
            'ザ': 'ZA', 'ジ': 'JI', 'ズ': 'ZU', 'ゼ': 'ZE', 'ゾ': 'ZO',
            'ダ': 'DA', 'ヂ': 'DI', 'ヅ': 'DU', 'デ': 'DE', 'ド': 'DO',
            'バ': 'BA', 'ビ': 'BI', 'ブ': 'BU', 'ベ': 'BE', 'ボ': 'BO',
            'パ': 'PA', 'ピ': 'PI', 'プ': 'PU', 'ペ': 'PE', 'ポ': 'PO',
            'ー': ''
          };
          return kanaMap[match] || match;
        })
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toUpperCase();

      // 空の場合はタイムスタンプを使用
      if (!finalTypeCode) {
        finalTypeCode = `TYPE_${Date.now()}`;
      }
    }

    const insertData = {
      type_code: finalTypeCode,
      type_name,
      description: description || null,
      display_order: display_order || 0,
      is_active: is_active !== undefined ? is_active : true
    };

    const result = await dynamicInsert('inspection_types', insertData);
    console.log('[POST /api/inspection-types] Created:', result);

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('❌ Inspection type create error:', err.message);
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, error: 'この種別コードは既に登録されています' });
    }
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別更新
app.put('/api/inspection-types/:id', requireAdmin, async (req, res) => {
  try {
    const typeId = req.params.id;
    const { type_code, type_name, description, display_order, is_active } = req.body;

    if (!type_name) {
      return res.status(400).json({ success: false, error: '種別名は必須です' });
    }

    // type_codeが提供されていない場合は既存の値を保持（必要に応じて取得）
    let finalTypeCode = type_code;
    if (!finalTypeCode) {
      const existingTypes = await dynamicSelect('inspection_types', { id: typeId });
      if (existingTypes.length > 0) {
        finalTypeCode = existingTypes[0].type_code;
      }
    }

    const updateData = {
      type_code: finalTypeCode,
      type_name,
      description: description || null,
      display_order: display_order || 0,
      is_active: is_active !== undefined ? is_active : true
    };

    const result = await dynamicUpdate('inspection_types', updateData, { id: typeId }, true);

    if (result.length === 0) {
      return res.status(404).json({ error: '検修種別が見つかりません' });
    }

    console.log('[PUT /api/inspection-types] Updated:', result[0]);
    res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error('❌ Inspection type update error:', err.message);
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'この種別コードは既に登録されています' });
    }
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別削除
app.delete('/api/inspection-types/:id', requireAdmin, async (req, res) => {
  try {
    const typeId = req.params.id;
    const result = await dynamicDelete('inspection_types', { id: typeId }, true);

    if (result.length === 0) {
      return res.status(404).json({ error: '検修種別が見つかりません' });
    }

    console.log('[DELETE /api/inspection-types] Deleted:', typeId);
    res.json({ success: true, message: '検修種別を削除しました' });
  } catch (err) {
    console.error('❌ Inspection type delete error:', err.message);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定一覧取得
app.get('/api/inspection-schedules', requireAdmin, async (req, res) => {
  try {
    console.log('[GET /api/inspection-schedules] Fetching inspection schedules...');

    const machinesRoute = await resolveTablePath('machines');
    const machineTypesRoute = await resolveTablePath('machine_types');
    const officesRoute = await resolveTablePath('management_offices');
    const inspectionTypesRoute = await resolveTablePath('inspection_types');
    const inspectionSchedulesRoute = await resolveTablePath('inspection_schedules');

    const query = `
      SELECT 
        s.id,
        s.machine_id,
        s.target_category,
        s.inspection_type_id,
        s.cycle_months,
        s.duration_days,
        s.remarks,
        s.is_active,
        s.created_at,
        s.updated_at,
        m.machine_number,
        mt.model_name,
        o.office_name,
        it.type_name,
        it.type_code
      FROM ${inspectionSchedulesRoute.fullPath} s
      LEFT JOIN ${machinesRoute.fullPath} m ON s.machine_id = m.id::text
      LEFT JOIN ${machineTypesRoute.fullPath} mt ON m.machine_type_id = mt.id
      LEFT JOIN ${officesRoute.fullPath} o ON m.office_id::integer = o.office_id
      LEFT JOIN ${inspectionTypesRoute.fullPath} it ON s.inspection_type_id = it.id
      ORDER BY s.target_category, o.office_name, mt.model_name, m.machine_number, it.display_order
    `;

    console.log('[GET /api/inspection-schedules] Executing SQL...');
    const result = await pool.query(query);
    console.log('[GET /api/inspection-schedules] Success:', result.rows.length);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('❌ Inspection schedules get error:', err.message);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定詳細取得
app.get('/api/inspection-schedules/:id', requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const schedules = await dynamicSelect('inspection_schedules', { id: scheduleId });

    if (schedules.length === 0) {
      return res.status(404).json({ success: false, error: '検修設定が見つかりません' });
    }

    res.json({ success: true, data: schedules[0] });
  } catch (err) {
    console.error('❌ Inspection schedule get error:', err.message);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定追加
app.post('/api/inspection-schedules', requireAdmin, async (req, res) => {
  try {
    const { machine_id, target_category, inspection_type_id, cycle_months, duration_days, remarks, is_active } = req.body;

    // machine_id または target_category のどちらかは必須
    if ((!machine_id && !target_category) || !inspection_type_id || !cycle_months || !duration_days) {
      return res.status(400).json({ success: false, error: '必須項目が入力されていません' });
    }

    const insertData = {
      machine_id: machine_id ? String(machine_id) : null,
      target_category: target_category || null,
      inspection_type_id: parseInt(inspection_type_id),
      cycle_months: parseInt(cycle_months),
      duration_days: parseInt(duration_days),
      remarks: remarks || null,
      is_active: is_active !== undefined ? is_active : true
    };

    const result = await dynamicInsert('inspection_schedules', insertData);
    console.log('[POST /api/inspection-schedules] Created:', result);

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('❌ Inspection schedule create error:', err.message);
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, error: 'この組み合わせは既に登録されています' });
    }
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定更新
app.put('/api/inspection-schedules/:id', requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { machine_id, target_category, inspection_type_id, cycle_months, duration_days, remarks, is_active } = req.body;

    if ((!machine_id && !target_category) || !inspection_type_id || !cycle_months || !duration_days) {
      return res.status(400).json({ success: false, error: '必須項目が入力されていません' });
    }

    const updateData = {
      machine_id: machine_id ? String(machine_id) : null,
      target_category: target_category || null,
      inspection_type_id: parseInt(inspection_type_id),
      cycle_months: parseInt(cycle_months),
      duration_days: parseInt(duration_days),
      remarks: remarks || null,
      is_active: is_active !== undefined ? is_active : true
    };

    const result = await dynamicUpdate('inspection_schedules', updateData, { id: scheduleId }, true);

    if (result.length === 0) {
      return res.status(404).json({ error: '検修設定が見つかりません' });
    }

    console.log('[PUT /api/inspection-schedules] Updated:', result[0]);
    res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error('❌ Inspection schedule update error:', err.message);
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, error: 'この機械と検修種別の組み合わせは既に登録されています' });
    }
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定削除
app.delete('/api/inspection-schedules/:id', requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const result = await dynamicDelete('inspection_schedules', { id: scheduleId }, true);

    if (result.length === 0) {
      return res.status(404).json({ error: '検修設定が見つかりません' });
    }

    console.log('[DELETE /api/inspection-schedules] Deleted:', scheduleId);
    res.json({ success: true, message: '検修設定を削除しました' });
  } catch (err) {
    console.error('❌ Inspection schedule delete error:', err.message);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ========================================
// セキュリティ監視・メンテナンスAPI
// ========================================

// セキュリティ監視・メンテナンスモジュールの読み込み
const securityMonitor = require('./server/security-monitor');
const maintenanceTasks = require('./server/maintenance-tasks');

// セキュリティアラート取得
app.get('/api/security/alerts', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Security API] Getting security alerts...');
    const result = await securityMonitor.getSecurityAlerts();
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'セキュリティアラートの取得に失敗しました'
    });
  }
});

// ブロックされたアクセス一覧取得
app.get('/api/security/blocked-access', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Security API] Getting blocked access...');
    const result = await securityMonitor.getBlockedAccess();
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error getting blocked access:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'ブロックされたアクセスの取得に失敗しました'
    });
  }
});

// 登録デバイス一覧取得
app.get('/api/security/devices', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Security API] Getting registered devices...');
    const result = await securityMonitor.getRegisteredDevices(pool);
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error getting devices:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '登録デバイスの取得に失敗しました'
    });
  }
});

// 一時ファイル削除
app.post('/api/maintenance/clean-temp', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Cleaning temp files...');
    const result = await maintenanceTasks.cleanTempFiles();
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error cleaning temp files:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '一時ファイルの削除に失敗しました'
    });
  }
});

// ログバックアップ
app.post('/api/maintenance/backup-logs', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Backing up logs...');
    const result = await maintenanceTasks.backupLogs();
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error backing up logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'ログバックアップに失敗しました'
    });
  }
});

// 孤立画像削除
app.post('/api/maintenance/clean-orphaned-images', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Cleaning orphaned images...');
    const result = await maintenanceTasks.cleanOrphanedImages(pool);
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error cleaning orphaned images:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '孤立画像の削除に失敗しました'
    });
  }
});

// npm audit（脆弱性チェック）
app.get('/api/maintenance/npm-audit', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Running npm audit...');
    const result = await maintenanceTasks.checkNpmAudit();
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error running npm audit:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'npm auditの実行に失敗しました'
    });
  }
});

// ストレージ使用状況取得
app.get('/api/maintenance/storage-usage', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Getting storage usage...');
    const result = await maintenanceTasks.getStorageUsage();
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error getting storage usage:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'ストレージ使用状況の取得に失敗しました'
    });
  }
});

// 証明書ステータス取得
app.get('/api/maintenance/certificate-status', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Getting certificate status...');
    const result = await maintenanceTasks.getCertificateStatus();
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error getting certificate status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '証明書ステータスの取得に失敗しました'
    });
  }
});

// ========================================
// 以下、既存のエンドポイント
// ========================================

// サーバーバージョン取得エンドポイント
app.get('/api/version', (req, res) => {
  res.json({
    version: 'VER-20260107-1715-RM-STATUS',
    app_id: process.env.APP_ID || 'dashboard-ui',
    instance: process.env.CLOUD_SQL_INSTANCE || 'local',
    description: 'Removed Status column from machines table'
  });
});

// サーバー起動
console.log('='.repeat(60));
console.log(`🚀 ATTEMPTING TO START SERVER ON PORT ${PORT}...`);
console.log('='.repeat(60));

// JWT_SECRETのデバッグ情報（セキュリティのため一部のみ表示）
const secret = process.env.JWT_SECRET;
if (secret) {
  console.log(`✅ JWT_SECRET is set. Length: ${secret.length}`);
  console.log(`JWT_SECRET prefix: ${secret.substring(0, 2)}***`);
  console.log(`JWT_SECRET suffix: ***${secret.substring(secret.length - 2)}`);
} else {
  console.error('⚠️ JWT_SECRET is NOT set!');
}

// --- データベース自動修正機能 (起動時に実行) ---
async function runEmergencyDbFix() {
  console.log('👷 Running Emergency DB Fix (Self-Healing)...');
  try {
    // 1. 全ての関連外部キーを一旦削除 (型変更を阻害しないため)
    await pool.query(`
        DO $$ 
        DECLARE r RECORD;
        BEGIN
            FOR r IN (
                SELECT 'ALTER TABLE "' || n.nspname || '"."' || c.relname || '" DROP CONSTRAINT IF EXISTS "' || con.conname || '" CASCADE' as cmd
                FROM pg_constraint con
                JOIN pg_class c ON c.oid = con.conrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE con.confrelid IN (SELECT oid FROM pg_class WHERE relname IN ('machines', 'machine_types'))
            ) LOOP EXECUTE r.cmd; END LOOP;
        END $$;
      `);
    const schemas = ['master_data'];
    for (const schema of schemas) {
      console.log(`[Self-Healing] Checking schema: ${schema}`);

      // テーブルの存在確認
      const mtCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'machine_types'
        )
      `, [schema]);
      const machinesCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'machines'
        )
      `, [schema]);

      console.log(`[Self-Healing] machine_types exists in ${schema}:`, mtCheck.rows[0].exists);
      console.log(`[Self-Healing] machines exists in ${schema}:`, machinesCheck.rows[0].exists);

      if (!mtCheck.rows[0].exists) {
        console.log(`[Self-Healing] Skipping ${schema}.machine_types - table does not exist`);
        continue;
      }

      // machine_types 必要なカラムを全て確実に作成
      await pool.query(`ALTER TABLE ${schema}.machine_types ADD COLUMN IF NOT EXISTS type_code TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machine_types ADD COLUMN IF NOT EXISTS type_name TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machine_types ADD COLUMN IF NOT EXISTS manufacturer TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machine_types ADD COLUMN IF NOT EXISTS category TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machine_types ADD COLUMN IF NOT EXISTS description TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machine_types ADD COLUMN IF NOT EXISTS model_name TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machine_types ALTER COLUMN id TYPE TEXT USING id::text`);

      await pool.query(`
          DO $$ DECLARE r RECORD; BEGIN
            -- ユニーク制約の削除
            FOR r IN (SELECT conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace WHERE nsp.nspname = '${schema}' AND rel.relname = 'machine_types' AND contype = 'u')
            LOOP EXECUTE 'ALTER TABLE ${schema}.machine_types DROP CONSTRAINT IF EXISTS "' || r.conname || '" CASCADE'; END LOOP;
            -- インデックスの削除 (PKEY以外)
            FOR r IN (SELECT indexname FROM pg_indexes WHERE schemaname = '${schema}' AND tablename = 'machine_types' AND indexname NOT LIKE '%_pkey')
            LOOP EXECUTE 'DROP INDEX IF EXISTS ${schema}."' || r.indexname || '" CASCADE'; END LOOP;
          END $$;
        `);

      // machines 必要なカラムを全て確実に作成
      if (!machinesCheck.rows[0].exists) {
        console.log(`[Self-Healing] Skipping ${schema}.machines - table does not exist`);
        continue;
      }

      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS id TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS machine_number TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS machine_type_id TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS serial_number TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS type_certification TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS office_id TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS manufacture_date TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS purchase_date TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS notes TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS assigned_base_id TEXT`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()`);
      await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()`);

      // 型変更
      await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN id TYPE TEXT USING id::text`);
      await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN machine_type_id TYPE TEXT USING machine_type_id::text`);

      await pool.query(`
          DO $$ DECLARE r RECORD; BEGIN
            FOR r IN (SELECT conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace WHERE nsp.nspname = '${schema}' AND rel.relname = 'machines' AND contype = 'u')
            LOOP EXECUTE 'ALTER TABLE ${schema}.machines DROP CONSTRAINT IF EXISTS "' || r.conname || '" CASCADE'; END LOOP;
            FOR r IN (SELECT indexname FROM pg_indexes WHERE schemaname = '${schema}' AND tablename = 'machines' AND indexname NOT LIKE '%_pkey')
            LOOP EXECUTE 'DROP INDEX IF EXISTS ${schema}."' || r.indexname || '" CASCADE'; END LOOP;
          END $$;
        `);
    }

    // ルーティング再設定
    await pool.query(`
        INSERT INTO public.app_resource_routing (app_id, logical_resource_name, physical_schema, physical_table, is_active)
        VALUES ('dashboard-ui', 'machines', 'master_data', 'machines', true),
               ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', true)
        ON CONFLICT (app_id, logical_resource_name) DO UPDATE SET physical_schema = EXCLUDED.physical_schema, physical_table = EXCLUDED.physical_table;
      `);
    console.log('✅ Self-healing completed successfully.');
  } catch (e) {
    console.error('❌ Self-healing failed:', e.message);
  }
}

// --- サーバー起動 ---
async function startServer() {
  if (serverInstance) {
    return;
  }
  console.log(`📡 Starting server on port ${PORT}...`);

  // まずサーバーをリッスン開始（Cloud Runのヘルスチェック対策）
  const server = app.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
      console.error('❌ Failed to start server:', err);
      console.error('Stack trace:', err.stack);
      process.exit(1);
    }
    console.log('='.repeat(60));
    console.log(`✅✅✅ SERVER STARTED SUCCESSFULLY ✅✅✅`);
    console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`❤️ Health check: http://0.0.0.0:${PORT}/health`);
    console.log('='.repeat(60));

  });

  serverInstance = server;

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
      if (pool && typeof pool.end === 'function') {
        pool.end();
      }
      process.exit(0);
    });
  });
}

// データベース初期化（非同期）
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database connection...');
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', testQuery.rows[0].current_time);
    dbReady = true;

    // 起動時にDB修正を実行
    console.log('🔄 Running emergency DB fix...');
    await runEmergencyDbFix();
    console.log('✅ Database initialization complete');

  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    console.error('Stack:', err.stack);
    console.error('⚠️ Server is running, but database operations may fail');
  }
}


// Start the server: moved to early startup section
