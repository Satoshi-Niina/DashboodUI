const express = require('express');
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const ejs = require('ejs');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const { randomUUID } = crypto;
const configRoutes = require('./server/routes/config');
const dbGateway = require('./server/db-gateway');
const commonAuth = require('./server/common-auth');
const securityGuard = require('./server/security-guard');
const tokenRevocation = require('./server/token-revocation');
const deviceManagement = require('./server/device-management');

// Load .env file if it exists (for local development)
// In Cloud Run, environment variables are provided by the platform
try {
  require('dotenv').config();
} catch (err) {
  // .env file not found or error loading - this is OK in production
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Warning: Could not load .env file:', err.message);
  }
}
const databaseMigrations = require('./scripts/db-migrate');

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
const PUBLIC_DIR = path.join(__dirname, 'assets');
let serverInstance;
let dbReady = false;
const tenantHealthMap = new Map();

app.set('views', path.join(__dirname, 'views'));
app.engine('jst', ejs.__express);
app.set('view engine', 'jst');

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
const logger = require('./server/logger');
app.use(express.json());
app.use(logger.requestLoggingMiddleware());

// 内部ガードミドルウェア:
// HTTPSリバースプロキシゲートウェイ（Port 8443）経由の通信のみを許可し、直接内部ポートへのアクセスを遮断する
const INTERNAL_GATEWAY_SECRET = process.env.INTERNAL_GATEWAY_SECRET;
if (!INTERNAL_GATEWAY_SECRET || INTERNAL_GATEWAY_SECRET.trim() === '') {
  throw new Error('[server] INTERNAL_GATEWAY_SECRET environment variable must be configured');
}

app.use(async (req, res, next) => {
  const isHealth = req.path === '/health' || req.path === '/_ah/health' || req.path === '/ready';
  if (isHealth) return next();

  const authHeader = req.headers['x-internal-device-auth'];
  if (authHeader) {
    try {
      const decoded = JSON.parse(Buffer.from(authHeader, 'base64').toString('utf8'));
      const expectedHmac = crypto.createHmac('sha256', INTERNAL_GATEWAY_SECRET).update(decoded.payload).digest('hex');
      if (decoded.hmac === expectedHmac) {
        req.deviceAuth = JSON.parse(decoded.payload);
        // 早期に端末証明書からテナント情報を解決して req.deviceInfo に設定
        if (req.deviceAuth && req.deviceAuth.hasCert && req.deviceAuth.fingerprint256) {
          try {
            const cpPool = getControlPlanePool();
            req.deviceInfo = await resolveDeviceTenant(req, cpPool);
          } catch (deviceErr) {
            console.warn('[DeviceAuth] Early resolution failed:', deviceErr.message);
          }
        }
        return next();
      }
    } catch (_) {}
  }

  // ゲートウェイ署名がない場合:
  // 本番環境では直接アクセスを一切許可せず遮断する（開発環境でのみ明示的な ALLOW_DIRECT_INTERNAL=true を許容）
  const allowDirect = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DIRECT_INTERNAL === 'true';
  if (allowDirect) {
    return next();
  }

  // 内部ポートへの直接アクセスを遮断
  logger.writeLog({
    severity: 'WARNING',
    eventType: 'direct_access_blocked',
    requestId: req.requestId,
    correlationId: req.correlationId,
    clientIp: logger.extractClientIp(req),
    httpRequest: {
      requestMethod: req.method,
      requestUrl: req.originalUrl || req.url,
      status: 403
    },
    message: '内部ポートへの直接アクセス遮断 (DirectAccessForbidden)',
    details: {
      error: 'DirectAccessForbidden'
    }
  });

  return res.status(403).json({
    success: false,
    error: 'DirectAccessForbidden',
    message: '内部ポートへの直接アクセスは禁止されています。HTTPSゲートウェイ（https://localhost:8443）経由でアクセスしてください。'
  });
});

function isApiRequestPath(pathLike) {
  const normalizedPath = String(pathLike || '').trim().toLowerCase();
  return normalizedPath === '/api'
    || normalizedPath.startsWith('/api/')
    || normalizedPath.includes('/api/');
}

// 公開テナントIDの対応表を最新化（TTLキャッシュ）
app.use(async (req, res, next) => {
  try {
    await refreshPublicTenantIds();
  } catch (_) { }
  next();
});

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
  throw new Error('JWT_SECRET environment variable must be configured');
} else {
  console.log('✅ JWT_SECRET is configured');
}

// SSO launch token の署名鍵。未設定のまま起動すると署名できない／不正な鍵で動くため、起動時に停止する
// （仕業点検アプリ API の SHARED_SSO_SECRET と同じ値にすること。JWT_SECRET へのフォールバックはしない）
if (!String(process.env.SHARED_SSO_SECRET || '').trim()) {
  throw new Error('SHARED_SSO_SECRET environment variable must be configured (see .env.example)');
}

// データベースから設定を取得するヘルパー関数（リファクタリング版 - ルーティング経由）
async function getConfigFromDB(key, defaultValue) {
  try {
    // db-gateway経由で動的にルーティング解決
    const result = await dbGateway.dynamicSelect(
      'app_config',                        // 論理リソース名
      { config_key: key },                 // WHERE条件
      ['config_value'],                    // 取得カラム
      1,                                   // LIMIT
      'dashboard-ui'                       // アプリID
    );
    return result.length > 0 ? result[0].config_value : (process.env[key.toUpperCase()] || defaultValue);
  } catch (err) {
    console.error(`Failed to get config ${key}:`, err);
    return process.env[key.toUpperCase()] || defaultValue;
  }
}

// すべての設定を取得（リファクタリング版 - ルーティング経由）
async function getAllConfig() {
  try {
    // db-gateway経由で動的にルーティング解決
    const result = await dbGateway.dynamicSelect(
      'app_config',                        // 論理リソース名
      {},                                  // WHERE条件なし（全件取得）
      ['config_key', 'config_value'],      // 取得カラム
      null,                                // LIMIT なし
      'dashboard-ui'                       // アプリID
    );
    const config = {};
    result.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    return config;
  } catch (err) {
    console.error('Failed to get all config:', err);
    return {};
  }
}

function normalizeDashboardAppRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id || row.app_id || row.appId || '',
    appId: row.app_id || row.appId || row.id || '',
    name: row.app_name || row.name || row.title || '',
    url: row.app_url || row.url || row.link_url || '#',
    icon: row.icon || row.icon_class || row.iconClass || '◌',
    iconClass: row.icon_class || row.iconClass || '',
    category: row.category || row.group_name || '一般',
    requiredRole: row.required_role || row.requiredRole || 'operator',
    displayOrder: Number(row.display_order || row.displayOrder || 0),
    isVisible: row.is_visible !== false && row.isVisible !== false,
    description: row.description || row.app_description || ''
  };
}

function normalizeDashboardUserRow(row) {
  if (!row) {
    return {
      id: '',
      username: 'guest',
      displayName: 'ゲスト',
      email: '',
      role: 'guest'
    };
  }

  return {
    id: row.id || row.user_id || row.userId || '',
    username: row.username || row.login_name || row.user_name || 'guest',
    displayName: row.display_name || row.displayName || row.full_name || row.username || 'ゲスト',
    email: row.email || row.mail_address || '',
    role: row.role || row.user_role || 'guest'
  };
}

function escapeJsonForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function getDashboardV2Context(req) {
  const tenantKey = normalizeTenantAliasKey(
    req.requestedTenantId
    || req.tenantContext?.resolvedTenantId
    || req.tenantContext?.companyId
    || req.query.tenant_id
    || 'demo'
  ) || 'demo';

  const dashboardPool = getControlPlanePool();
  const userName = String(
    req.user?.username
    || req.query.username
    || req.headers['x-user-name']
    || req.headers['x-username']
    || ''
  ).trim();

  let apps = [];
  try {
    const appResult = await dashboardPool.query(`
      SELECT
        a.app_key AS app_id,
        a.app_name,
        a.app_url,
        a.icon,
        a.icon AS icon_class,
        a.category,
        ta.required_role,
        a.display_order,
        ta.is_visible,
        a.description
      FROM public.tenant_applications ta
      JOIN public.applications a ON a.id = ta.application_id AND a.is_active = true
      JOIN public.tenants t ON t.id = ta.tenant_id AND t.is_active = true
      WHERE (t.tenant_key = $1 OR t.id::text = $1)
        AND ta.is_enabled = true
        AND ta.is_visible = true
      ORDER BY COALESCE(a.display_order, 9999) ASC, a.app_key ASC
    `, [tenantKey]);

    apps = appResult.rows
      .map(normalizeDashboardAppRow)
      .filter((row) => row && row.isVisible);
  } catch (err) {
    console.warn('[DashboardV2] Failed to load apps from common DB:', err.message);
  }

  let user = null;
  try {
    if (userName) {
      const runtime = await resolveTenantRuntime(tenantKey).catch(() => null);
      if (runtime && runtime.pool) {
        const userResult = await runtime.pool.query('SELECT * FROM public.users WHERE username = $1 LIMIT 1', [userName]);
        user = normalizeDashboardUserRow(userResult.rows[0] || null);
      }
    }
  } catch (err) {
    console.warn('[DashboardV2] Failed to load user info from tenant DB:', err.message);
  }
  if (!user) {
    user = normalizeDashboardUserRow(req.user || null);
  }

  const environmentLabel = tenantKey === 'demo' ? 'デモ環境' : tenantKey;

  return {
    pageTitle: 'ダッシュボード v2',
    environmentLabel,
    tenantKey,
    user,
    apps,
    appCount: apps.length,
    generatedAt: new Date().toISOString(),
    appsJson: escapeJsonForInlineScript(apps),
    userJson: escapeJsonForInlineScript(user)
  };
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

function normalizeTenantIdForUrl(rawTenantId) {
  const normalized = String(rawTenantId || '').trim().toLowerCase();
  if (!normalized || normalized === 'demo_env' || normalized === 'demo') {
    return 'demo';
  }
  return normalized;
}

function buildTenantPath(_tenantId) {
  return '/';
}

function buildTenantUrl(baseUrl, _tenantId) {
  const safeBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  return safeBaseUrl ? `${safeBaseUrl}/` : '/';
}

function getRequestBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || '';
  return host ? `${protocol}://${host}` : '';
}

function normalizeTenantPathForResponse(_rawTenantPath, _fallbackTenantId) {
  return '/';
}

// ---- Public tenant IDs ----
// URL tenants are random public IDs (public.tenant_public_ids); internal tenant keys never appear in
// production URLs. '/demo/' is a development alias that must be enabled explicitly in production.
const INVALID_TENANT_KEY = '__invalid_tenant__';
const PUBLIC_TENANT_ID_TTL_MS = 30 * 1000;
let publicTenantIdState = { loadedAt: 0, byPublicId: new Map(), byTenantKey: new Map(), isFallbackMode: false };

function readBooleanEnv(name, productionDefault, developmentDefault) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return process.env.NODE_ENV === 'production' ? productionDefault : developmentDefault;
}

function isDemoAliasEnabled() {
  return readBooleanEnv('ENABLE_DEMO_ALIAS', false, true);
}

function isPublicTenantIdRequired() {
  if (publicTenantIdState.isFallbackMode) return false;
  return readBooleanEnv('REQUIRE_PUBLIC_TENANT_ID', true, false);
}

async function refreshPublicTenantIds(force = false) {
  if (!force && Date.now() - publicTenantIdState.loadedAt < PUBLIC_TENANT_ID_TTL_MS) return;
  const next = { loadedAt: Date.now(), byPublicId: new Map(), byTenantKey: new Map(), isFallbackMode: false };
  try {
    const result = await getControlPlanePool().query(
      'SELECT public_id, tenant_key FROM public.tenant_public_ids WHERE is_active = true'
    );
    for (const row of result.rows) {
      const publicId = String(row.public_id).toLowerCase();
      const tenantKey = String(row.tenant_key).toLowerCase();
      next.byPublicId.set(publicId, tenantKey);
      next.byTenantKey.set(tenantKey, publicId);
    }
    publicTenantIdState = next;
  } catch (err) {
    console.warn('[PublicTenantId] lookup unavailable:', err.code || err.message);
    try {
      const routingRows = await getAllCompanyRoutingRows();
      for (const row of routingRows) {
        if (row && row.tenant_key) {
          const tk = String(row.tenant_key).toLowerCase();
          next.byPublicId.set(tk, tk);
          next.byTenantKey.set(tk, tk);
        }
      }
      next.isFallbackMode = true;
    } catch (_) { }
    publicTenantIdState = next;
    publicTenantIdState.loadedAt = Date.now() - PUBLIC_TENANT_ID_TTL_MS + 3000;
  }
}

function getPublicTenantIdForKey(tenantKey) {
  return publicTenantIdState.byTenantKey.get(String(tenantKey || '').trim().toLowerCase()) || null;
}

// Maps a URL/header tenant value to an internal key. With enforce=true, values that the current
// environment does not allow in URLs resolve to an unregistered key so no tenant DB is opened.
function mapTenantSegment(segment, enforce = false) {
  const value = String(segment || '').trim().toLowerCase();
  const internal = publicTenantIdState.byPublicId.get(value);
  if (internal) return internal;
  if (!enforce || !value) return value;
  if (value === 'demo' || value === 'demo_env') {
    return isDemoAliasEnabled() ? value : INVALID_TENANT_KEY;
  }
  if (publicTenantIdState.isFallbackMode && /^[a-z0-9_-]+$/.test(value)) {
    return value;
  }
  return isPublicTenantIdRequired() ? INVALID_TENANT_KEY : value;
}

function getTenantKeyFromPath(rawPath, enforce = false) {
  const normalizedPath = normalizePathForCompare(rawPath);
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return 'demo_env';
  }

  const first = String(segments[0] || '').trim().toLowerCase();
  // HTML/JS/CSS ファイル名やシステムパスをテナントIDとして扱わない
  if (!first
    || first === 'api'
    || first === 'assets'
    || first === 'health'
    || first === '_ah'
    || first === 'ready'
    || first.endsWith('.html')
    || first.endsWith('.js')
    || first.endsWith('.css')
    || first.endsWith('.json')
    || first.endsWith('.png')
    || first.endsWith('.ico')
  ) {
    return 'demo_env';
  }

  return mapTenantSegment(first, enforce);
}

function normalizeTenantAliasKey(rawKey) {
  const key = String(rawKey || '').trim().toLowerCase();
  if (!key) return '';

  // 代表的なローマ字ゆれ（例: kousei -> kosei）を吸収
  return key
    .replace(/ou/g, 'o')
    .replace(/oo/g, 'o');
}

function resolveFirstTenantKey(...candidates) {
  for (const candidate of candidates) {
    const key = getTenantKeyFromPath(candidate || '/', true);
    if (key && key !== 'demo_env') {
      return key;
    }
  }
  return 'demo_env';
}

function normalizeTenantRoutingRow(row) {
  if (!row) return null;

  const normalizedCompanyId = String(row.company_id || '').trim().toLowerCase();
  const normalizedTenantKey = getTenantKeyFromPath(row.tenant_path || '');

  return {
    ...row,
    normalizedCompanyId,
    normalizedCompanyAliasId: normalizeTenantAliasKey(normalizedCompanyId),
    normalizedTenantPath: normalizeUrlForCompare(row.tenant_path || ''),
    company_name: resolveTenantDisplayName(normalizedCompanyId, row.company_name),
    normalizedTenantPathOnly: normalizePathForCompare(row.tenant_path || ''),
    normalizedTenantKey,
    normalizedTenantAliasKey: normalizeTenantAliasKey(normalizedTenantKey)
  };
}

async function getAllCompanyRoutingRows() {
  try {
    const now = Date.now();
    const cached = tenantRouteListCache.get('all');
    if (cached && (now - cached.timestamp) < TENANT_ROUTE_CACHE_TTL) {
      return cached.rows;
    }

    const cpPool = getControlPlanePool();
    let candidateRows = [];

    // 正規ルーティングテーブル: public.tenants + public.tenant_db_routing
    try {
      const res = await cpPool.query(`
        SELECT t.tenant_key as company_id,
               t.tenant_name as company_name,
               t.tenant_key,
               NULL as database_url,
               r.database_key,
               (COALESCE(r.database_key, t.tenant_key) || '_db') as db_name,
               ('/' || t.tenant_key) as tenant_path
        FROM public.tenants t
        LEFT JOIN public.tenant_db_routing r ON r.tenant_id = t.id AND r.is_active = true
        WHERE t.is_active = true
        ORDER BY t.tenant_key
      `);
      if (res.rows && res.rows.length > 0) {
        candidateRows = res.rows;
      }
    } catch (err) {
      console.warn('[TenantRouting] Failed to query tenants and tenant_db_routing:', err.message);
    }

    const rows = candidateRows.map(row => {
      if (!row || !row.tenant_key) return null;
      return {
        company_id: row.company_id || row.tenant_key,
        company_name: resolveTenantDisplayName(row.company_id || row.tenant_key, row.company_name),
        tenant_key: row.tenant_key,
        database_url: row.database_url || null,
        database_key: row.database_key || null,
        db_name: row.db_name || (row.tenant_key ? `${row.tenant_key}_db` : null),
        tenant_path: row.tenant_path || `/${row.tenant_key}`,
        normalizedCompanyId: String(row.company_id || row.tenant_key || '').trim().toLowerCase(),
        normalizedTenantKey: String(row.tenant_key || row.company_id || '').trim().toLowerCase()
      };
    }).filter(Boolean);
    tenantRouteListCache.set('all', { rows, timestamp: now });
    return rows;
  } catch (err) {
    console.error('[TenantRouting] Failed to load routing rows:', err.message);
    return [];
  }
}

function isSuperAdminUser(input) {
  if (!input) return false;
  const user = input.user || input.session || input;
  const username = String(user.username || user.sub || user.name || input.username || '').trim().toLowerCase();
  const userId = String(user.id || user.userId || user.sub || input.id || input.userId || '').trim().toLowerCase();
  return username === 'niina' || userId === 'e996e889-4165-412f-8450-8b6e0f193256';
}

function extractTenantIdFromRequest(req) {
  // 1. セッション（CookieまたはAuthorizationヘッダー）が存在する場合
  try {
    const session = commonAuth.readSession(req);
    if (session) {
      const isSuper = isSuperAdminUser(session);
      if (isSuper) {
        // スーパー管理者 (niina) の場合、リクエストで明示されたテナントへの切り替えを許可
        const requestedTenant = (
          req.headers['x-tenant-id'] ||
          req.query?.tenantId ||
          req.query?.tenant_id ||
          req.body?.targetTenantId ||
          req.body?.tenant_id ||
          req.body?.tenantId
        );
        if (requestedTenant) {
          const rawKey = String(requestedTenant).trim().toLowerCase();
          const mapped = mapTenantSegment(rawKey, false);
          if (mapped && mapped !== INVALID_TENANT_KEY) {
            return mapped;
          }
        }
      }
      // niina 以外（各テナント管理者・一般ユーザー）または niina でテナント未指定の場合はセッションのテナントに固定
      const sessionTenant = String(session.tenant_key || session.tenant_id || '').trim().toLowerCase();
      if (sessionTenant && sessionTenant !== 'demo_env' && sessionTenant !== 'demo') {
        const mappedSession = mapTenantSegment(sessionTenant, false);
        return mappedSession;
      }
    }
  } catch (err) {
    console.warn('[extractTenantIdFromRequest] Error parsing session:', err.message);
  }

  // 2. 端末証明書による特定結果が存在する場合はそれを採用
  if (req.deviceInfo && req.deviceInfo.tenantKey) {
    const certTenant = String(req.deviceInfo.tenantKey).trim().toLowerCase();
    if (certTenant && certTenant !== 'demo_env' && certTenant !== 'demo') {
      return mapTenantSegment(certTenant, true);
    }
  }

  // 3. 認証前・未特定リクエスト: demoや共通DBへフォールバックせず null を返す
  return null;
}

async function getCompanyRoutingByTenantRequest({ tenantId = '', tenantPath = '', fullUrl = '' } = {}) {
  try {
    const normalizedTenantId = String(tenantId || '').trim().toLowerCase();
    if (normalizedTenantId === INVALID_TENANT_KEY) return null;
    const normalizedTenantAliasId = normalizeTenantAliasKey(normalizedTenantId);
    const normalizedTenantPath = normalizePathForCompare(tenantPath || fullUrl || '');
    const normalizedFullUrl = normalizeUrlForCompare(fullUrl || tenantPath || '');
    const requestTenantKey = getTenantKeyFromPath(tenantPath || fullUrl || '');
    const requestTenantAliasKey = normalizeTenantAliasKey(requestTenantKey);
    const allRows = await getAllCompanyRoutingRows();

    if (normalizedTenantId && normalizedTenantId !== 'demo_env') {
      const byCompanyId = allRows.find((row) => (
        row.normalizedCompanyId === normalizedTenantId
        || row.normalizedCompanyAliasId === normalizedTenantAliasId
        || row.normalizedTenantKey === normalizedTenantId
        || row.normalizedTenantAliasKey === normalizedTenantAliasId
      ));
      if (byCompanyId) {
        return byCompanyId;
      }
    }

    if (requestTenantKey && requestTenantKey !== 'demo_env') {
      const byTenantKey = allRows.find((row) => (
        row.normalizedTenantKey === requestTenantKey
        || row.normalizedTenantAliasKey === requestTenantAliasKey
        || row.normalizedCompanyId === requestTenantKey
        || row.normalizedCompanyAliasId === requestTenantAliasKey
      ));
      if (byTenantKey) {
        return byTenantKey;
      }
    }

    const hasUrlHint = Boolean(String(tenantPath || '').trim() || String(fullUrl || '').trim());
    const byUrl = hasUrlHint
      ? allRows.find((row) => {
        if (!row) return false;
        return row.normalizedTenantPath === normalizedFullUrl
          || row.normalizedTenantPathOnly === normalizedTenantPath;
      })
      : null;

    return byUrl || null;
  } catch (err) {
    console.error('[TenantRouting] Failed to resolve tenant by request:', err.message);
    return null;
  }
}

async function getCompanyRoutingByTenantKey(tenantKey) {
  const normalizedTenantKey = String(tenantKey || '').trim().toLowerCase();
  const normalizedTenantAliasKey = normalizeTenantAliasKey(normalizedTenantKey);
  if (!normalizedTenantKey || normalizedTenantKey === 'demo_env') {
    return null;
  }

  const allRows = await getAllCompanyRoutingRows();
  return allRows.find((row) => (
    row.normalizedCompanyId === normalizedTenantKey
    || row.normalizedCompanyAliasId === normalizedTenantAliasKey
    || row.normalizedTenantKey === normalizedTenantKey
    || row.normalizedTenantAliasKey === normalizedTenantAliasKey
  )) || null;
}

function getControlPlanePool() {
  return controlPlanePool || pool;
}

function getCompanyRoutingDbName() {
  return String(process.env.TENANT_ROUTING_DB_NAME || process.env.CONTROL_PLANE_DB_NAME || getDefaultDbName()).trim();
}

function getDefaultDbName() {
  if (poolConfig && poolConfig.database) {
    return poolConfig.database;
  }
  if (poolConfig && poolConfig.connectionString) {
    try {
      const parsed = new URL(poolConfig.connectionString);
      const dbName = parsed.pathname.replace(/^\//, '');
      return dbName || 'common_db';
    } catch (_) {
      return 'common_db';
    }
  }
  return process.env.DB_NAME || 'common_db';
}

function getDatabaseNameFromUrl(connectionString) {
  if (!connectionString) {
    return '';
  }

  try {
    const parsed = new URL(connectionString);
    return parsed.pathname.replace(/^\//, '').trim();
  } catch (_) {
    return '';
  }
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

function applyTenantSearchPath(poolInstance, dbName) {
  if (!poolInstance || typeof poolInstance.on !== 'function') {
    return;
  }

  const searchPathSql = 'SET search_path TO public, operations, inspection_mgmt, emergency, ai';
  poolInstance.on('connect', (client) => {
    client.query(searchPathSql).catch((err) => {
      console.error(`[TenantDB] Failed to set search_path for ${dbName}:`, err.message);
    });
  });
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
  applyTenantSearchPath(tenantPool, dbName);
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

// ★ シンプル設計: database_url から直接接続プールを作成
function getOrCreateTenantPoolFromUrl(databaseUrl) {
  if (!databaseUrl) return getControlPlanePool();

  const cacheKey = databaseUrl;
  if (tenantDbPoolCache.has(cacheKey)) {
    const cached = tenantDbPoolCache.get(cacheKey);
    cached.lastUsedAt = Date.now();
    return cached.pool;
  }

  const tenantPool = new Pool({ connectionString: databaseUrl });
  applyTenantSearchPath(tenantPool, getDatabaseNameFromUrl(databaseUrl) || 'unknown');
  tenantPool.on('error', (err) => {
    console.error(`[TenantDB] Unexpected error on tenant pool:`, err.message);
  });

  tenantDbPoolCache.set(cacheKey, {
    pool: tenantPool,
    databaseUrl,
    lastUsedAt: Date.now()
  });

  console.log(`[TenantDB] Created pool from database_url: ${maskDatabaseUrl(databaseUrl)}`);
  return tenantPool;
}

function getCompanyRoutingPool() {
  const routingDbName = getCompanyRoutingDbName();
  const defaultDbName = getDefaultDbName();
  if (!routingDbName || routingDbName.toLowerCase() === String(defaultDbName || '').toLowerCase()) {
    return getControlPlanePool();
  }
  return getOrCreateTenantPool(routingDbName);
}

function maskDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch (_) {
    return 'invalid database_url';
  }
}

async function queryCompanyRouting(query, params = []) {
  const routingPool = getCompanyRoutingPool();
  const defaultPool = getControlPlanePool();

  try {
    return await routingPool.query(query, params);
  } catch (err) {
    const message = String(err.message || '').toLowerCase();
    const isMissingRoutingTable = message.includes('tenant_app_routings') && message.includes('does not exist');

    if (routingPool !== defaultPool && isMissingRoutingTable) {
      return defaultPool.query(query, params);
    }

    if (isMissingRoutingTable) {
      return { rows: [] };
    }
    throw err;
  }
}

async function getCompanyRoutingByCompanyId(companyId) {
  const now = Date.now();
  const cacheKey = String(companyId || '').trim().toLowerCase();
  const aliasKey = normalizeTenantAliasKey(cacheKey);

  if (!cacheKey) {
    return null;
  }

  const cached = tenantRouteCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < TENANT_ROUTE_CACHE_TTL) {
    return cached.row;
  }

  const query = `
    SELECT t.tenant_key as company_id,
           t.tenant_name as company_name,
           t.tenant_key,
           NULL as database_url,
           r.database_key,
           (COALESCE(r.database_key, t.tenant_key) || '_db') as db_name,
           ('/' || t.tenant_key) as tenant_path
    FROM public.tenants t
    LEFT JOIN public.tenant_db_routing r ON r.tenant_id = t.id AND r.is_active = true
    WHERE t.is_active = true
      AND (LOWER(TRIM(t.tenant_key)) = $1 OR t.id::text = $1)
    LIMIT 1
  `;
  const result = await getControlPlanePool().query(query, [cacheKey]);
  let row = normalizeTenantRoutingRow(result.rows[0] || null);
  if (!row && aliasKey && aliasKey !== cacheKey) {
    const allRows = await getAllCompanyRoutingRows();
    row = allRows.find((candidate) => (
      candidate.normalizedCompanyAliasId === aliasKey
      || candidate.normalizedTenantAliasKey === aliasKey
    )) || null;
  }
  tenantRouteCache.set(cacheKey, { row, timestamp: now });
  return row;
}

function buildTenantRuntimeFromRoutingRow(routingRow, requestedTenantId, defaultDbName, defaultBucketName, fallbackTenantKey = '') {
  const resolvedTenantId = routingRow.company_id || fallbackTenantKey || requestedTenantId || 'demo_env';
  const tenantKey = String(routingRow.tenant_key || resolvedTenantId).trim();
  const databaseKey = String(routingRow.database_key || tenantKey).trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(databaseKey)) {
    throw new Error(`Invalid tenant database key for ${tenantKey}`);
  }
  const envKey = databaseKey.replace(/[^A-Z0-9]/g, '_');
  const configuredUrl = process.env[`TENANT_DB_${envKey}_URL`];
  const configuredName = process.env[`TENANT_DB_${envKey}_NAME`];
  const databaseUrl = configuredUrl || routingRow.database_url || '';
  let dbName = routingRow.db_name || configuredName || '';
  if (!dbName && tenantKey && tenantKey !== 'demo_env') {
    dbName = `${tenantKey}_db`;
  }
  if (databaseUrl) {
    try {
      dbName = new URL(databaseUrl).pathname.replace(/^\//, '') || dbName;
    } catch (_) {
      throw new Error(`Invalid database URL configuration for tenant ${tenantKey}`);
    }
  }
  if (!dbName || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(dbName)) {
    throw new Error(`Tenant database name is not configured for ${tenantKey}. Set TENANT_DB_${envKey}_NAME or its URL.`);
  }
  const tenantPool = databaseUrl
    ? getOrCreateTenantPoolFromUrl(databaseUrl)
    : getOrCreateTenantPool(dbName);
  if (dbName.toLowerCase() === String(defaultDbName || '').toLowerCase()) {
    throw new Error(`Tenant ${tenantKey} resolves to the common database; configure a separate tenant database.`);
  }

  return {
    requestedTenantId,
    resolvedTenantId,
    companyId: routingRow.company_id || resolvedTenantId,
    companyName: routingRow.company_name || '',
    dbName: dbName,
    databaseUrl: databaseUrl || null,
    storageBucketName: routingRow.storage_bucket_name || defaultBucketName,
    tenantPath: routingRow.tenant_path || '',
    pool: tenantPool,
    isFallback: false
  };
}

function inferTenantDbName(tenantKey, defaultDbName) {
  const normalizedTenantKey = normalizeTenantAliasKey(tenantKey);
  if (!normalizedTenantKey || normalizedTenantKey === 'demo_env' || normalizedTenantKey === 'demo') {
    return defaultDbName;
  }

  if (normalizedTenantKey.endsWith('_db')) {
    return normalizedTenantKey;
  }

  return `${normalizedTenantKey}_db`;
}

async function resolveTenantRuntime(tenantId, requestHint = {}) {
  const normalizedTenantId = String(tenantId || '').trim().toLowerCase();
  if (!normalizedTenantId || normalizedTenantId === 'demo_env' || normalizedTenantId === 'demo') {
    throw new Error('Tenant is not specified');
  }
  if (normalizedTenantId === INVALID_TENANT_KEY) {
    throw new Error('Tenant is not allowed for this URL');
  }
  const defaultDbName = getDefaultDbName();
  const defaultBucketName = getDefaultBucketName();
  const requestTenantPath = requestHint.tenantPath || requestHint.fullUrl || '';
  const requestFullUrl = requestHint.fullUrl || requestHint.tenantPath || requestHint.referer || '';
  const requestOriginalUrl = requestHint.originalUrl || '';
  const expectedTenantKey = normalizedTenantId;

  const tenantHealth = tenantHealthMap.get(expectedTenantKey) || tenantHealthMap.get(normalizedTenantId);
  if (tenantHealth && !tenantHealth.healthy) {
    throw new Error(`Tenant "${expectedTenantKey}" is temporarily unavailable: schema verification failed`);
  }

  try {
    let routingRow = await getCompanyRoutingByTenantRequest({
      tenantId: normalizedTenantId,
      tenantPath: requestTenantPath,
      fullUrl: requestFullUrl
    });

    if (!routingRow) {
      routingRow = await getCompanyRoutingByTenantKey(expectedTenantKey);
    }

    if (!routingRow && normalizedTenantId !== 'demo_env') {
      routingRow = await getCompanyRoutingByCompanyId(normalizedTenantId);
    }

    if (!routingRow) {
      // UUID形式の場合は public.tenants から tenant_key を逆引き
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedTenantKey || normalizedTenantId);
      if (isUuid) {
        try {
          const cpPool = getControlPlanePool();
          const uuidRes = await cpPool.query('SELECT tenant_key FROM public.tenants WHERE id::text = $1 LIMIT 1', [expectedTenantKey || normalizedTenantId]);
          if (uuidRes.rows[0]?.tenant_key) {
            routingRow = await getCompanyRoutingByTenantKey(uuidRes.rows[0].tenant_key);
          }
        } catch (_) {}
      }
    }

    if (routingRow) {
      return buildTenantRuntimeFromRoutingRow(
        routingRow,
        normalizedTenantId,
        defaultDbName,
        defaultBucketName,
        expectedTenantKey
      );
    }

    // ルーティング情報が見つからない場合は503エラー（DBを推測してfallbackしない）
    throw new Error(`Tenant not registered: ${expectedTenantKey}`);
  } catch (err) {
    console.error(`[TenantRouting] Failed to resolve tenant ${expectedTenantKey}:`, err.message);
    // エラーを再スローして503を返す（fallbackしない）
    throw err;
  }
}

function getActiveTenantRuntime() {
  return requestTenantContextStorage.getStore() || null;
}

function getActiveDbPool() {
  const runtime = getActiveTenantRuntime();
  return runtime && runtime.pool ? runtime.pool : getControlPlanePool();
}

function getRequestTenantContext(req) {
  return (req && req.tenantContext) || getActiveTenantRuntime() || null;
}

function getRequestDbPool(req) {
  const runtime = getRequestTenantContext(req);
  return (req && req.db) || (runtime && runtime.pool) || getActiveDbPool();
}

function getRequestBucketName(req, fallbackBucketName = '') {
  const runtimeFromReq = req && req.tenantContext ? req.tenantContext : null;
  const runtime = runtimeFromReq || getActiveTenantRuntime();
  return (runtime && runtime.storageBucketName) || fallbackBucketName || getDefaultBucketName();
}

function applyTenantErrorHeaders(res, err) {
  if (!err) return;
  const errorMessage = String(err.message || err).replace(/[\r\n]+/g, ' ').slice(0, 1024);
  console.error('[TenantError]', errorMessage);
}

function toSafeHeaderValue(rawValue) {
  const value = String(rawValue || '');
  // HTTPヘッダーはASCII前提のため、非ASCIIはURLエンコードして例外を防ぐ
  return /[^\x20-\x7E]/.test(value) ? encodeURIComponent(value) : value;
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

    if (!row && tenantId) {
      const runtime = await resolveTenantRuntime(tenantId, {
        tenantPath,
        fullUrl,
        referer: String(req.headers.referer || '').trim(),
        originalUrl: String(req.originalUrl || req.url || '').trim()
      });

      if (runtime && runtime.resolvedTenantId) {
        row = {
          company_id: runtime.companyId || runtime.resolvedTenantId,
          company_name: runtime.companyName || '',
          db_name: runtime.dbName || '',
          storage_bucket_name: runtime.storageBucketName || '',
          tenant_path: runtime.tenantPath || buildTenantPath(runtime.resolvedTenantId)
        };
        lookupSource = 'runtime_fallback';
      }
    }

    const effectiveTenantId = row
      ? (row.company_id || tenantId || 'demo')
      : (tenantId || 'demo');
    const effectiveTenantPath = normalizeTenantPathForResponse(row ? row.tenant_path : '', effectiveTenantId);
    const tenantBaseUrl = getRequestBaseUrl(req);
    const effectiveTenantUrl = buildTenantUrl(tenantBaseUrl, effectiveTenantId);

    res.json({
      success: true,
      route: row ? {
        company_id: row.company_id,
        company_name: row.company_name,
        db_name: row.db_name,
        storage_bucket_name: row.storage_bucket_name,
        tenant_path: effectiveTenantPath,
        tenant_id: row.company_id,
        tenant_url: effectiveTenantUrl
      } : null,
      routes: row ? [
        {
          company_id: row.company_id,
          company_name: row.company_name,
          db_name: row.db_name,
          storage_bucket_name: row.storage_bucket_name,
          tenant_path: effectiveTenantPath,
          tenant_id: row.company_id,
          tenant_url: effectiveTenantUrl
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

// 旧テナント付きURL（/daitetsu/..., /kosei/... 等）へのアクセスは会社切り替えに使わず、
// 共通URL（/index.html 等）へ 302 リダイレクトして正規化する
app.use((req, res, next) => {
  const excludedPrefixes = new Set(['api', 'assets', 'health', '_ah', 'ready', 'dashboard-v2']);
  const [pathname, search] = req.url.split('?');
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 0) return next();

  const firstSegment = parts[0].toLowerCase();
  const hasFileExtension = firstSegment.includes('.');

  if (excludedPrefixes.has(firstSegment) || hasFileExtension) {
    return next();
  }

  // 第1セグメントがテナント名の場合、会社名を含まない共通URLへ 302 リダイレクト
  const remainingParts = parts.slice(1);
  let targetPath = '/' + remainingParts.join('/');
  if (targetPath === '/' || targetPath === '') {
    targetPath = '/index.html';
  }
  const queryString = search ? '?' + search : '';
  return res.redirect(302, targetPath + queryString);
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

// ルートパスへのアクセス時: ログイン済みなら /index.html へ、未ログインなら login.html へ
app.get('/', (req, res) => {
  try {
    const session = commonAuth.readSession(req);
    if (session && session.sub) {
      return res.redirect(302, '/index.html');
    }
  } catch (_) {}
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/dashboard-v2', async (req, res) => {
  try {
    const dashboardContext = await getDashboardV2Context(req);
    res.render('dashboard-v2', dashboardContext);
  } catch (err) {
    console.error('[DashboardV2] Render failed:', err);
    res.status(500).send('Failed to render dashboard v2');
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// Preserve existing image URLs while serving browser files from the public asset directory only.
app.use('/assets/img', express.static(path.join(PUBLIC_DIR, 'img'), {
  dotfiles: 'deny',
  index: false
}));
app.use('/assets', express.static(PUBLIC_DIR, {
  dotfiles: 'deny',
  index: false
}));

// 静的ファイル配信（JSとCSSはキャッシュ無効化）
app.use(express.static(PUBLIC_DIR, {
  dotfiles: 'deny',
  index: false,
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
    database: getDatabaseNameFromUrl(process.env.DATABASE_URL) || process.env.DB_NAME || 'common_db',
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
    database: process.env.DB_NAME || 'common_db',
    max: 5,
    client_encoding: 'UTF8',
  };
}

console.log('Database config (password hidden):', {
  ...poolConfig,
  password: poolConfig.password ? '****' : undefined,
  connectionString: poolConfig.connectionString ? '****' : undefined
});

console.log('Creating database pool...');
let pool;
try {
  pool = new Pool(poolConfig);
  console.log('✅ Pool created successfully');

  // Test pool connection immediately to catch configuration errors early
  pool.query('SELECT 1').then(() => {
    console.log('✅ Pool connection test successful');
  }).catch(err => {
    console.error('⚠️ Pool connection test failed (will retry later):', err.message);
  });

} catch (err) {
  console.error('❌ Failed to create pool:', err);
  console.error('Stack:', err.stack);
  console.error('⚠️ Creating fallback pool - database operations will fail until DB is available');
  // Create dummy pool that throws errors
  pool = {
    query: () => Promise.reject(new Error('Database not initialized: ' + err.message)),
    end: () => Promise.resolve(),
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

// ログインAPIまたはセッション確立系リクエストであるかを包括的に判定
function isLoginApiRequest(req) {
  if (!req) return false;
  const rawTargets = [
    req.path,
    req.url,
    req.originalUrl,
    req.baseUrl ? `${req.baseUrl}${req.path}` : ''
  ];

  for (const raw of rawTargets) {
    if (!raw) continue;
    const clean = String(raw).split('?')[0].toLowerCase();
    if (
      clean === '/login' ||
      clean === '/api/login' ||
      clean.endsWith('/login') ||
      clean.includes('/api/login') ||
      clean.includes('/login')
    ) {
      return true;
    }
  }
  return false;
}

function isSessionBootstrapApiRequest(req) {
  if (isLoginApiRequest(req)) return true;
  const rawTargets = [
    req.path,
    req.url,
    req.originalUrl,
    req.baseUrl ? `${req.baseUrl}${req.path}` : ''
  ];

  for (const raw of rawTargets) {
    if (!raw) continue;
    const clean = String(raw).split('?')[0].toLowerCase();
    if (
      clean === '/logout' ||
      clean === '/api/logout' ||
      clean.endsWith('/logout') ||
      clean.includes('/api/logout') ||
      clean === '/tenant-context' ||
      clean === '/api/tenant-context' ||
      clean.endsWith('/tenant-context') ||
      clean.includes('/api/tenant-context')
    ) {
      return true;
    }
  }
  return false;
}

function isSecurityControlPlaneApiRequest(req) {
  if (!req) return false;
  const rawTargets = [
    req.path,
    req.url,
    req.originalUrl,
    req.baseUrl ? `${req.baseUrl}${req.path}` : ''
  ];
  for (const raw of rawTargets) {
    if (!raw) continue;
    const clean = String(raw).split('?')[0].toLowerCase();
    if (clean.includes('/api/security') || clean.startsWith('/security')) {
      return true;
    }
  }
  return false;
}

// APIリクエストのテナント文脈を解決し、以降のDB/GCS処理に引き継ぐ
app.use('/api', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const isLogin = isLoginApiRequest(req);
  const isSecurity = isSecurityControlPlaneApiRequest(req);
  const isBootstrap = isLogin || isSessionBootstrapApiRequest(req) || isSecurity;

  try {
    const requestedTenantId = extractTenantIdFromRequest(req) || req.requestedTenantId || null;
    const defaultDbName = getDefaultDbName();

    let runtime = null;
    if (requestedTenantId && requestedTenantId !== 'demo_env' && requestedTenantId !== 'demo') {
      try {
        runtime = await resolveTenantRuntime(requestedTenantId, {
          tenantPath: String(req.headers['x-tenant-path'] || req.query.tenant_path || '').trim(),
          fullUrl: String(req.headers['x-tenant-full-url'] || req.query.full_url || '').trim(),
          referer: String(req.headers.referer || '').trim(),
          originalUrl: String(req.originalUrl || req.url || '').trim()
        });
      } catch (routingErr) {
        if (!isBootstrap) {
          throw routingErr;
        }
      }
    }

    req.tenantContext = runtime;
    req.tenantId = runtime?.resolvedTenantId || requestedTenantId || null;
    req.db = runtime?.pool || getControlPlanePool();
    // 内部診断ヘッダーはクライアントへ漏洩させず、サーバーログのみに記録
    if (runtime?.tenantResolutionError) {
      applyTenantErrorHeaders(res, runtime.tenantResolutionError);
    }

    // ログインまたはセッションブートストラップリクエストの場合は、テナントDB分離チェックおよびセッション権限チェックを完全にスキップ
    if (!isBootstrap) {
      const normalizedRequestedTenantId = String(requestedTenantId || '').trim().toLowerCase();
      const normalizedResolvedTenantId = String(runtime?.resolvedTenantId || 'demo_env').trim().toLowerCase();
      const normalizedResolvedDbName = String(runtime?.dbName || '').trim().toLowerCase();
      const normalizedDefaultDbName = String(defaultDbName || '').trim().toLowerCase();
      const isDemoTenant = (tenantKey) => {
        const key = String(tenantKey || '').trim().toLowerCase();
        return !key || key === 'demo_env' || key === 'demo';
      };
      const requiresIsolation = !(isDemoTenant(normalizedRequestedTenantId) && isDemoTenant(normalizedResolvedTenantId));

      if (requiresIsolation && (!normalizedResolvedDbName || normalizedResolvedDbName === normalizedDefaultDbName)) {
        const isolationError = new Error(`[TenantRouting] Isolation violation: requested=${normalizedRequestedTenantId || 'empty'}, resolved=${normalizedResolvedTenantId || 'empty'}, db=${runtime?.dbName || 'empty'}, defaultDb=${defaultDbName}. Check public.tenant_app_routings (app_id='_config') for db_name and tenant_path.`);
        applyTenantErrorHeaders(res, isolationError);
        return res.status(503).json({
          success: false,
          message: 'Tenant DB isolation check failed',
          error: isolationError.message,
          requestedTenantId: normalizedRequestedTenantId || 'demo_env',
          resolvedTenantId: normalizedResolvedTenantId || 'demo_env',
          resolvedDbName: runtime?.dbName || '',
          defaultDbName
        });
      }

      let session = null;
      try {
        session = commonAuth.readSession(req);
      } catch (_) { }
      if (session) {
        const rawToken = commonAuth.extractToken(req);
        if (rawToken && await tokenRevocation.isTokenRevoked(rawToken, getControlPlanePool())) {
          return res.status(401).json({
            success: false,
            code: 'TOKEN_REVOKED',
            message: 'このセッションは失効しています。再度ログインしてください。',
            requestId: req.requestId || req.headers['x-request-id'] || null
          });
        }

        const sessionTenantKey = String(session.tenant_key || '').trim().toLowerCase();
        let resolvedSessionTenantKey = sessionTenantKey;
        if (!resolvedSessionTenantKey) {
          const sessionTenant = await resolveSessionTenant(getControlPlanePool(), session);
          resolvedSessionTenantKey = String(sessionTenant?.tenant_key || '').trim().toLowerCase();
        }

        // 端末証明書との不一致チェック (スーパー管理者 niina は統括管理のため他テナント切替を許可)
        const isSuper = isSuperAdminUser(session);
        const certTenantKey = req.deviceInfo?.tenantKey ? String(req.deviceInfo.tenantKey).trim().toLowerCase() : null;
        if (!isSuper && certTenantKey && resolvedSessionTenantKey && certTenantKey !== resolvedSessionTenantKey) {
          securityGuard.recordFailure({
            clientIp: logger.extractClientIp(req),
            tenantId: resolvedSessionTenantKey,
            identifier: session.sub || session.username,
            eventType: 'device_mismatch',
            weight: 3,
            reason: 'DEVICE_MISMATCH',
            req
          });

          logger.writeLog({
            severity: 'WARNING',
            eventType: 'authz_denied',
            requestId: req.requestId,
            correlationId: req.correlationId,
            tenantId: resolvedSessionTenantKey,
            userId: session.sub || session.username,
            clientIp: logger.extractClientIp(req),
            httpRequest: {
              requestMethod: req.method,
              requestUrl: req.originalUrl || req.url,
              status: 403
            },
            message: `証明書とセッションの所属テナント不一致によるアクセス遮断 (DEVICE_MISMATCH: cert=${certTenantKey}, session=${resolvedSessionTenantKey})`,
            details: {
              code: 'DEVICE_MISMATCH',
              certTenantKey,
              sessionTenantKey: resolvedSessionTenantKey
            }
          });

          return res.status(403).json({
            success: false,
            code: 'DEVICE_MISMATCH',
            message: '証明書とセッションの所属テナントが一致しません',
            requestId: req.requestId || req.headers['x-request-id'] || null
          });
        }

        const requestedRouteTenantKey = String(runtime?.resolvedTenantId || '').trim().toLowerCase();
        if (!isSuper && requestedRouteTenantKey && (!resolvedSessionTenantKey || resolvedSessionTenantKey !== requestedRouteTenantKey)) {
          return res.status(403).json({
            success: false,
            code: 'TENANT_MISMATCH',
            message: 'ログインユーザーの所属テナントと要求先が一致しません',
            requestedTenantId: requestedRouteTenantKey || 'unknown',
            requestId: req.requestId || req.headers['x-request-id'] || null
          });
        }
          let sessionHasCurrentAccess = null;
          try {
            if (runtime && runtime.pool) {
              sessionHasCurrentAccess = await runtime.pool.query(`
                  SELECT 1 FROM public.users
                  WHERE id::text = $1 AND is_active = true AND role = $2
                  LIMIT 1
                `, [String(session.sub || ''), String(session.role || '')]);
            }
          } catch (authErr) {
            console.warn('[TenantRouting] Session permission check error:', authErr.code || authErr.message);
          }

          if (!isSuper && sessionHasCurrentAccess) {
            const currentPermissions = (sessionHasCurrentAccess.rows[0]?.permissions || []).map(String).sort();
            const sessionPermissions = (Array.isArray(session.permissions) ? session.permissions : []).map(String).sort();
            const permissionsMatch = session.auth_source === 'tenant'
              || (currentPermissions.length === sessionPermissions.length
                && currentPermissions.every((permission, index) => permission === sessionPermissions[index]));
            if (sessionHasCurrentAccess.rowCount !== 1 || !permissionsMatch) {
              return res.status(403).json({
                success: false,
                message: 'ログインユーザーの所属または利用権限が無効です',
                requestedTenantId: requestedRouteTenantKey || 'unknown'
              });
            }
          }
        }
      }

    requestTenantContextStorage.run(runtime, () => next());
  } catch (err) {
    if (isBootstrap) {
      console.warn('[TenantRouting] Bypassing tenant resolution error for login/bootstrap request:', err.message);
      const fallbackRuntime = {
        requestedTenantId: null,
        resolvedTenantId: null,
        companyId: null,
        companyName: '',
        dbName: null,
        databaseUrl: null,
        storageBucketName: null,
        tenantPath: '/',
        pool: getControlPlanePool(),
        isFallback: false
      };
      req.tenantContext = fallbackRuntime;
      req.tenantId = null;
      req.db = getControlPlanePool();
      return requestTenantContextStorage.run(fallbackRuntime, () => next());
    }

    console.error('[TenantRouting] Middleware failed:', err.message);
    applyTenantErrorHeaders(res, err);

    // 未登録テナントまたはdb_name未設定の場合は503を返す（fallbackしない）
    return res.status(503).json({
      success: false,
      message: 'テナントが利用できません'
    });
  }
});

// APIルート定義（テナント解決ミドルウェアの後に登録）
app.use('/api/config', configRoutes);

// 現在リクエストのテナント解決結果を確認するための診断用API
app.get('/api/tenant-context', async (req, res) => {
  try {
    const cpPool = getControlPlanePool();
    // 1. セッションまたは端末証明書からテナントを特定
    let effectiveTenantKey = null;
    let companyName = '';
    let dbName = '';
    let storageBucketName = '';

    // Cookieセッションの確認
    if (req.headers && req.headers.cookie) {
      try {
        const session = commonAuth.readSession(req);
        if (session && (session.tenant_key || session.tenant_id)) {
          effectiveTenantKey = String(session.tenant_key || session.tenant_id).trim().toLowerCase();
        }
      } catch (_) {}
    }

    // セッション未確立なら端末証明書の確認
    if (!effectiveTenantKey) {
      const deviceResult = await resolveDeviceTenant(req, cpPool);
      if (deviceResult.ok && deviceResult.tenantKey) {
        effectiveTenantKey = deviceResult.tenantKey;
      }
    }

    // テナント未特定時は demo_env や common_db にフォールバックせず、null として安全に応答
    if (!effectiveTenantKey || effectiveTenantKey === 'demo_env') {
      return res.json({
        success: true,
        tenant: null,
        route: null,
        routes: [],
        message: 'テナント未特定（ログインまたは端末証明書が必要です）'
      });
    }

    // 正規テナントDB接続先の解決
    const runtime = await resolveTenantRuntime(effectiveTenantKey).catch(err => {
      console.warn(`[TenantContext] resolveTenantRuntime failed for ${effectiveTenantKey}:`, err.message);
      return null;
    });

    if (runtime) {
      companyName = runtime.companyName || '';
      dbName = runtime.dbName || '';
      storageBucketName = runtime.storageBucketName || '';
    }

    const publicTenantId = getPublicTenantIdForKey(effectiveTenantKey);
    const tenantBaseUrl = getRequestBaseUrl(req);
    const effectiveTenantUrl = tenantBaseUrl ? `${tenantBaseUrl}/` : '/';

    return res.json({
      success: true,
      tenant: {
        publicTenantId: publicTenantId || null,
        requestedTenantId: effectiveTenantKey,
        resolvedTenantId: effectiveTenantKey,
        companyId: effectiveTenantKey,
        companyName: companyName,
        dbName: dbName,
        tenantPath: '/',
        storageBucketName: storageBucketName,
        isFallback: false
      },
      route: {
        company_id: effectiveTenantKey,
        company_name: companyName,
        db_name: dbName,
        storage_bucket_name: storageBucketName,
        tenant_path: '/',
        tenant_url: effectiveTenantUrl
      },
      routes: [
        {
          company_id: effectiveTenantKey,
          company_name: companyName,
          db_name: dbName,
          storage_bucket_name: storageBucketName,
          tenant_path: '/',
          tenant_url: effectiveTenantUrl
        }
      ]
    });
  } catch (err) {
    applyTenantErrorHeaders(res, err);
    return res.status(500).json({
      success: false,
      error: 'テナント情報の取得に失敗しました'
    });
  }
});

// テナントに紐づくアプリケーション一覧を取得
app.get('/api/tenant-apps', async (req, res) => {
  try {
    const runtime = req.tenantContext || getActiveTenantRuntime() || {
      requestedTenantId: req.requestedTenantId || 'demo_env',
      resolvedTenantId: 'demo_env',
      companyId: 'demo_env',
      isFallback: true
    };

    const effectiveTenantKey = runtime.companyId || runtime.resolvedTenantId || runtime.requestedTenantId || 'demo';
    const normalizedTenantKey = effectiveTenantKey === 'demo_env' ? 'demo' : effectiveTenantKey;

    // 正規の tenant_applications + applications から取得
    const controlPlane = getControlPlanePool();
    const result = await controlPlane.query(`
      SELECT 
        a.app_key AS app_id,
        a.app_name,
        a.app_url
      FROM public.tenant_applications ta
      JOIN public.applications a ON a.id = ta.application_id AND a.is_active = true
      JOIN public.tenants t ON t.id = ta.tenant_id AND t.is_active = true
      WHERE (t.tenant_key = $1 OR t.id::text = $1)
        AND ta.is_enabled = true
        AND ta.is_visible = true
      ORDER BY COALESCE(a.display_order, 9999) ASC, a.app_key ASC
    `, [normalizedTenantKey]);

    const apps = result.rows.map(row => ({
      id: row.app_id,
      name: row.app_name,
      url: row.app_url,
      displayOrder: 0,
      icon: '📱',
      iconClass: null,
      description: ''
    }));

    return res.json({
      success: true,
      tenant_key: normalizedTenantKey,
      apps: apps
    });
  } catch (err) {
    console.error('[API /api/tenant-apps] Error:', err);
    applyTenantErrorHeaders(res, err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      apps: []
    });
  }
});

// ========================================
// ゲートウェイ方式: テーブルルーティング機能
// ========================================

const APP_ID = process.env.APP_ID || 'dashboard-ui';

// NOTE:
// dashboard-ui の主要マスタは、対象テナントDB内の public スキーマへ固定マッピングする。
// ルーティングテーブルは参照せず、現在の req.tenantContext が指す接続先DBに対して直接解決する。
// server.js 475行目付近
const DASHBOARD_TABLE_MAP = {
  users: { schema: 'public', table: 'users' },
  bases: { schema: 'public', table: 'bases' },
  maintenance_bases: { schema: 'public', table: 'bases' },
  management_offices: { schema: 'public', table: 'management_offices' },
  machines: { schema: 'public', table: 'machines' },
  machine_types: { schema: 'public', table: 'machine_types' },
  inspection_types: { schema: 'public', table: 'inspection_types' },
  inspection_schedules: { schema: 'public', table: 'inspection_schedules' },
  app_config: { schema: 'public', table: 'app_config' },
  system_settings: { schema: 'operations', table: 'system_settings' }
};

function quoteIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value || '(empty)'}`);
  }
  return `"${value.replace(/"/g, '""')}"`;
}

async function getPhysicalTableColumns(route, dbOverride = null) {
  const query = `
    SELECT column_name
    FROM information_schema.columns
    WHERE lower(table_schema) = lower($1)
      AND lower(table_name) = lower($2)
  `;
  const activePool = dbOverride || pool;
  const result = await activePool.query(query, [route.schema, route.table]);
  const columns = new Set(result.rows.map((row) => String(row.column_name || '').trim().toLowerCase()));
  return columns;
}

async function resolveCompatibleTablePath(logicalName, candidates) {
  const firstCandidate = candidates[0];
  if (!firstCandidate) {
    throw new Error(`No table candidates provided for logical resource: ${logicalName}`);
  }

  const route = {
    fullPath: `${quoteIdentifier(firstCandidate.schema)}.${quoteIdentifier(firstCandidate.table)}`,
    schema: firstCandidate.schema,
    table: firstCandidate.table,
    appId: APP_ID,
    source: firstCandidate.source || 'schema-compatible',
    timestamp: Date.now()
  };
  console.log(`[Gateway] Compatible map resolved: ${logicalName} -> ${route.fullPath}`);
  return { route, columns: await getPhysicalTableColumns(route) };
}

function filterDataByColumns(data, columnSet) {
  const entries = Object.entries(data || {}).filter(([key]) => columnSet.has(String(key || '').trim().toLowerCase()));
  return Object.fromEntries(entries);
}

async function generateNextMasterCode(client, route, columnName, prefix = null, minimumWidth = 4, maximumNumber = null) {
  if (prefix !== null && !/^[A-Z]+$/.test(prefix)) {
    throw new Error(`Invalid master code prefix: ${prefix}`);
  }

  const column = quoteIdentifier(columnName);
  const codePattern = prefix ? `^${prefix}-([0-9]+)$` : '^([0-9]+)$';
  const filterPattern = prefix ? `^${prefix}-[0-9]+$` : '^[0-9]+$';

  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    [`${route.fullPath}:${columnName}:${prefix || 'numeric'}`]
  );

  const result = await client.query(
    `SELECT COALESCE(MAX(substring(${column}::text FROM '${codePattern}')::bigint), 0) AS max_number
     FROM ${route.fullPath}
     WHERE ${column}::text ~ '${filterPattern}'`
  );
  const nextNumber = BigInt(result.rows[0]?.max_number || '0') + 1n;
  if (maximumNumber !== null && nextNumber > BigInt(maximumNumber)) {
    throw new RangeError(`機種コードが上限（${maximumNumber}件）に達しました`);
  }
  const number = nextNumber.toString().padStart(minimumWidth, '0');
  return prefix ? `${prefix}-${number}` : number;
}

async function generateNextCategorizedMachineNumber(client, route, prefix) {
  if (!/^[A-Z]{2,3}$/.test(prefix)) {
    throw new Error(`Invalid machine number prefix: ${prefix}`);
  }

  const column = quoteIdentifier('machine_number');
  const codePattern = `^${prefix}([0-9]+)$`;
  const filterPattern = `^${prefix}[0-9]+$`;
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    [`${route.fullPath}:machine_number:${prefix}`]
  );

  const result = await client.query(
    `SELECT COALESCE(MAX(substring(${column}::text FROM '${codePattern}')::bigint), 0) AS max_number
     FROM ${route.fullPath}
     WHERE ${column}::text ~ '${filterPattern}'`
  );
  const nextNumber = BigInt(result.rows[0]?.max_number || '0') + 1n;
  if (nextNumber > 999n) {
    throw new RangeError(`${prefix}の機械番号は上限の999件に達しています`);
  }
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

async function generateNextInspectionTypeCode(client, route, prefix) {
  if (!/^(?:MC|TT|HTT|HPT)$/.test(prefix)) {
    throw new Error(`Invalid inspection type code prefix: ${prefix}`);
  }

  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    [`${route.fullPath}:type_code:${prefix}`]
  );
  const result = await client.query(
    `SELECT COALESCE(MAX(substring(type_code::text FROM '^${prefix}([0-9]+)$')::integer), 0) AS max_number
     FROM ${route.fullPath}
     WHERE type_code::text ~ '^${prefix}[0-9]+$'`
  );
  const nextNumber = Number(result.rows[0]?.max_number || 0) + 1;
  if (nextNumber > 99) {
    throw new RangeError(`${prefix}の検修種別コードは上限の99件に達しています`);
  }
  return `${prefix}${String(nextNumber).padStart(2, '0')}`;
}

function getInspectionTypeCodePrefix(category) {
  const normalizedCategory = String(category || '').replace(/[\s　]/g, '');
  const prefixByCategory = {
    '軌道モータカー': 'MC',
    '軌道モーターカー': 'MC',
    '鉄トロ': 'TT',
    '箱トロ': 'HTT',
    'ホッパー車': 'HPT'
  };
  return prefixByCategory[normalizedCategory] || null;
}

async function getInspectionMachineType(machineTypeId, db) {
  const route = await resolveStrictRoutedTablePath('machine_types');
  const columns = await getPhysicalTableColumns(route, db);
  const idColumn = columns.has('id') ? 'id' : (columns.has('type_id') ? 'type_id' : null);
  const categoryColumn = columns.has('category')
    ? 'category'
    : (columns.has('machine_category') ? 'machine_category' : null);
  const nameColumn = ['model_name', 'type_name', 'machine_type_name', 'name']
    .find(column => columns.has(column));
  if (!idColumn || !categoryColumn) {
    throw new Error('機種マスタの列定義が不足しています');
  }
  const result = await db.query(
    `SELECT ${quoteIdentifier(idColumn)}::text AS id,
            ${quoteIdentifier(categoryColumn)}::text AS category,
            ${nameColumn ? `${quoteIdentifier(nameColumn)}::text` : 'NULL::text'} AS model_name
     FROM ${route.fullPath}
     WHERE ${quoteIdentifier(idColumn)}::text = $1
     LIMIT 1`,
    [machineTypeId]
  );
  return result.rows[0] || null;
}

async function previewNextInspectionTypeCode(db, route, prefix) {
  const result = await db.query(
    `SELECT COALESCE(MAX(substring(type_code::text FROM '^${prefix}([0-9]+)$')::integer), 0) AS max_number
     FROM ${route.fullPath}
     WHERE type_code::text ~ '^${prefix}[0-9]+$'`
  );
  const nextNumber = Number(result.rows[0]?.max_number || 0) + 1;
  if (nextNumber > 99) {
    throw new RangeError(`${prefix}の検修種別コードは上限の99件に達しています`);
  }
  return `${prefix}${String(nextNumber).padStart(2, '0')}`;
}

async function getInspectionTypeConfiguration(typeId, db) {
  const route = await resolveStrictRoutedTablePath('inspection_types');
  const columns = await getPhysicalTableColumns(route, db);
  const idColumn = columns.has('id') ? 'id' : (columns.has('type_id') ? 'type_id' : null);
  if (!idColumn || !columns.has('machine_type_id') || !columns.has('cycle_months') || !columns.has('duration_days')) {
    throw new Error('検修種別の機種別設定にDB更新が必要です');
  }
  const result = await db.query(
    `SELECT ${quoteIdentifier(idColumn)}::text AS id,
            machine_type_id::text AS machine_type_id,
            cycle_months,
            duration_days
     FROM ${route.fullPath}
     WHERE ${quoteIdentifier(idColumn)}::text = $1
     LIMIT 1`,
    [typeId]
  );
  return result.rows[0] || null;
}

const MACHINE_NUMBER_PREFIX_BY_CATEGORY = Object.freeze({
  '軌道モータカー': 'MC',
  '箱トロ': 'HT',
  '鉄トロ': 'TT',
  '鉄製トロ': 'TT',
  'ホッパー車': 'HPT'
});

// UUID/SERIALいずれのID列でも安全に扱うため、数値変換せず文字列のまま正規化する。
// 空文字・undefined・nullのみnullへ変換し、それ以外は文字列として保持する。
function normalizeOptionalId(value) {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? null : normalized;
}

function assertRouteWritable(route, operation) {
  if (route?.isReadonly) {
    throw new Error(`[DynamicDB] ${operation} rejected: routed resource is readonly (${route.logicalName || route.table} -> ${route.fullPath})`);
  }
}

async function resolveStrictRoutedTablePath(logicalName) {
  return resolveTablePath(logicalName);
}

/**
 * 論理テーブル名から物理パスを解決
 * @param {string} logicalName - 論理テーブル名（例: 'users', 'offices'）
 * @returns {Promise<{fullPath: string, schema: string, table: string}>}
 */
async function resolveTablePath(logicalName) {
  const mapped = DASHBOARD_TABLE_MAP[logicalName];

  if (mapped) {
    const resolved = {
      fullPath: `${mapped.schema}."${mapped.table}"`,
      schema: mapped.schema,
      table: mapped.table,
      appId: APP_ID,
      source: 'fixed-map',
      timestamp: Date.now()
    };
    console.log(`[Gateway] ✅ Fixed map resolved: ${logicalName} → ${resolved.fullPath}`);
    return resolved;
  }

  // 将来の拡張時に動的ルーティングを復活しやすくするため、
  // 未定義テーブルは従来どおり public.<logicalName> にフォールバックする。
  const fallback = {
    fullPath: `public."${logicalName}"`,
    schema: 'public',
    table: logicalName,
    appId: APP_ID,
    source: 'public-fallback',
    timestamp: Date.now()
  };
  console.log(`[Gateway] ⚠️ Fixed map not found. Fallback: ${logicalName} → ${fallback.fullPath}`);
  return fallback;
}

/**
 * 動的SELECT
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} conditions - WHERE条件 (例: { username: 'admin', role: 'admin' })
 * @param {Array<string>} columns - 取得するカラム (省略時は全カラム)
 * @param {number} limit - LIMIT数 (省略可)
 * @returns {Promise<Array>}
 */
async function dynamicSelect(logicalTableName, conditions = {}, columns = ['*'], limit = null, clientOrPool = null) {
  let query = '';
  const params = [];
  let route = null;
  try {
    route = await resolveTablePath(logicalTableName);

    const columnList = columns.join(', ');
    query = `SELECT ${columnList} FROM ${route.fullPath}`;

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
    const executor = clientOrPool || getActiveDbPool();
    const result = await executor.query(query, params);
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
async function dynamicInsert(logicalTableName, data, returning = true, clientOrPool = null) {
  let query = '';
  let route = null;
  let keys = Object.keys(data);
  let values = Object.values(data);
  try {
    route = await resolveTablePath(logicalTableName);
    assertRouteWritable(route, 'INSERT');
    const columnSet = await getPhysicalTableColumns(route);
    const filteredData = filterDataByColumns(data, columnSet);
    keys = Object.keys(filteredData);
    values = Object.values(filteredData);

    if (keys.length === 0) {
      throw new Error(`[DynamicDB] INSERT failed: no insertable columns for ${route.fullPath}`);
    }

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    query = `INSERT INTO ${route.fullPath} (${keys.join(', ')}) VALUES (${placeholders})`;

    if (returning) {
      query += ' RETURNING *';
    }

    console.log(`[DynamicDB] INSERT into ${route.fullPath}`);
    console.log(`[DynamicDB] Query: ${query}`);
    console.log(`[DynamicDB] Values:`, values);
    const executor = clientOrPool || getActiveDbPool();
    const result = await executor.query(query, values);
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
 * @param {Object} [clientOrPool=null] - トランザクションクライアントまたはプール
 * @returns {Promise<Array>}
 */
async function dynamicUpdate(logicalTableName, data, conditions, returning = true, clientOrPool = null) {
  let query = '';
  let route = null;
  let setKeys = Object.keys(data);
  let setValues = Object.values(data);
  let conditionKeys = Object.keys(conditions);
  let conditionValues = Object.values(conditions);
  try {
    route = await resolveTablePath(logicalTableName);
    assertRouteWritable(route, 'UPDATE');
    const columnSet = await getPhysicalTableColumns(route);

    const filteredSetData = filterDataByColumns(data, columnSet);
    setKeys = Object.keys(filteredSetData);
    setValues = Object.values(filteredSetData);

    const filteredConditionData = filterDataByColumns(conditions, columnSet);
    conditionKeys = Object.keys(filteredConditionData);
    conditionValues = Object.values(filteredConditionData);

    if (setKeys.length === 0) {
      throw new Error(`[DynamicDB] UPDATE failed: no updatable columns for ${route.fullPath}`);
    }
    if (conditionKeys.length === 0) {
      throw new Error(`[DynamicDB] UPDATE failed: no valid condition columns for ${route.fullPath}`);
    }

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
    const executor = clientOrPool || getActiveDbPool();
    const result = await executor.query(query, [...setValues, ...conditionValues]);
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
 * @param {Object} [req=null] - Expressリクエストオブジェクト
 * @param {Object} [clientOrPool=null] - トランザクションクライアントまたはプール
 * @returns {Promise<Array>}
 */
async function dynamicDelete(logicalTableName, conditions, returning = false, req = null, clientOrPool = null) {
  let query = '';
  let route = null;
  const conditionKeys = Object.keys(conditions);
  const conditionValues = Object.values(conditions);
  try {
    route = await resolveTablePath(logicalTableName);
    assertRouteWritable(route, 'DELETE');

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
    const db = clientOrPool || (req ? getRequestDbPool(req) : getActiveDbPool());
    const result = await db.query(query, conditionValues);
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

// ========================================
// ゲートウェイ機能ここまで
// ========================================

// スキーマ存在チェックエンドポイント（認証なし）
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



// リクエストからCookie（優先）またはAuthorizationヘッダー、あるいはクエリパラメータからトークンを抽出する
function extractTokenFromRequest(req) {
  // 1. Cookieから取得 (HttpOnly Cookie)
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        acc[key] = val;
      }
      return acc;
    }, {});

    if (cookies.dashboard_session && cookies.dashboard_session !== 'undefined' && cookies.dashboard_session !== 'null') {
      return cookies.dashboard_session;
    }
  }

  // 2. Authorizationヘッダーから取得（フォールバック）
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    let rawToken = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7);
    }
    rawToken = String(rawToken || '').trim();
    if (rawToken && rawToken !== 'undefined' && rawToken !== 'null' && rawToken !== '[object Object]') {
      return rawToken;
    }
  }

  // 3. クエリパラメータから取得（フォールバック）
  if (req.query && req.query.token) {
    const qToken = String(req.query.token).trim();
    if (qToken && qToken !== 'undefined' && qToken !== 'null') {
      return qToken;
    }
  }

  return null;
}

// Middleware: トークン認証
function authenticateToken(req, res, next) {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'トークンが提供されていません' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'トークンが無効です' });
    }
    req.user = user;
    next();
  });
}

// 外部システム（仕業点検管理UIなど）が期待するロール（'admin' | 'manager' | 'operator'）にマッピングする関数
function normalizeRoleForApp(role) {
  const raw = String(role || '').trim();
  const normalized = raw.toLowerCase();

  if (normalized === 'system_admin' || normalized === 'administrator' || normalized === 'admin') {
    return 'system_admin';
  }

  if (normalized === 'operation_admin' || normalized === 'manager' || raw === '責任者') {
    return 'operation_admin';
  }

  return 'operator';
}

function getDepartmentByRole(role) {
  const normalizedRole = normalizeRoleForApp(role);
  if (normalizedRole === 'system_admin') {
    return 'システム管理部';
  }
  if (normalizedRole === 'operation_admin') {
    return '運用管理部';
  }
  return '一般';
}

function mapRoleForExternal(role) {
  const normalizedRole = normalizeRoleForApp(role);
  console.log(`[mapRoleForExternal] Mapping role: "${role}" -> "${normalizedRole}"`);
  if (normalizedRole === 'system_admin') {
    return 'admin';
  } else if (normalizedRole === 'operation_admin') {
    return 'manager';
  }
  return 'operator';
}

function mapSsoRoles(role) {
  const normalizedRole = normalizeRoleForApp(role);
  return normalizedRole === 'system_admin' || normalizedRole === 'operation_admin'
    ? ['admin']
    : ['user'];
}

const TENANT_DISPLAY_NAME_MAP = {
  demo: 'デモ環境',
  demo_env: 'デモ環境',
  daitetsu: '大鉄工業',
  kosei: '広成建設',
  kintetsu: '近鉄'
};

function resolveTenantDisplayName(tenantId, fallbackName = '') {
  const normalizedTenantId = String(tenantId || '').trim().toLowerCase();
  if (TENANT_DISPLAY_NAME_MAP[normalizedTenantId]) {
    return TENANT_DISPLAY_NAME_MAP[normalizedTenantId];
  }

  const normalizedFallbackName = String(fallbackName || '').trim();
  if (normalizedFallbackName) {
    return normalizedFallbackName;
  }

  return normalizedTenantId;
}

function buildSsoClaims({ runtime, normalizedRole, effectiveTenantId, user }) {
  const companyCode = String((runtime && (runtime.companyId || runtime.resolvedTenantId)) || effectiveTenantId || '').trim().toLowerCase();
  const companyName = resolveTenantDisplayName(companyCode, runtime && runtime.companyName);
  const roles = mapSsoRoles(normalizedRole);

  return {
    company_code: companyCode,
    company_name: companyName,
    roles,
    companyCode,
    companyName,
    userId: user && user.id ? user.id : undefined
  };
}

function getSafeSessionUser(access) {
  return {
    id: access.user_id,
    username: access.username,
    display_name: access.display_name || access.username,
    email: access.email || '',
    tenant_id: access.tenant_id,
    tenant_key: access.tenant_key,
    tenant_name: access.tenant_name,
    role: access.role_key,
    permissions: access.permissions || []
  };
}

async function requireCookieSession(req, res, next) {
  try {
    const token = commonAuth.extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: '認証が必要です' });
    const session = commonAuth.readSession(req);
    if (!session) return res.status(401).json({ success: false, message: '認証が必要です' });

    // 失効総合判定 (Fail-Close, 未失効キャッシュ完全禁止)
    const cpPool = getControlPlanePool();
    const revocationStatus = await tokenRevocation.checkJwtRevocationStatus({
      token,
      decoded: session,
      pool: cpPool
    });

    if (revocationStatus.isRevoked) {
      console.warn(`[SessionGuard] Rejected revoked token: type=${revocationStatus.type}, reason=${revocationStatus.reason}`);
      return res.status(401).json({
        success: false,
        error: 'token_revoked',
        message: 'このセッションは失効しています。再度ログインしてください。'
      });
    }

    req.session = session;
    next();
  } catch (err) {
    if (err.status === 503 || err.code === 'DB_REVOCATION_CHECK_FAILED') {
      return res.status(503).json({ success: false, message: '失効判定サービスが一時的に利用できません' });
    }
    return res.status(401).json({ success: false, message: 'セッションが無効または期限切れです' });
  }
}

async function resolveSessionTenant(pool, session) {
  const tenantId = String(session.tenant_id || session.tenant_key || '').trim();
  try {
    const result = await pool.query(`
      SELECT id::text AS id, tenant_key, tenant_name
      FROM public.tenants
      WHERE id::text = $1 OR tenant_key = $1
      LIMIT 1
    `, [tenantId]);
    if (result.rows[0]) return result.rows[0];
  } catch (_) { }

  try {
    const routingRows = await getAllCompanyRoutingRows();
    const matched = routingRows.find(r => r.tenant_key === tenantId || r.company_id === tenantId);
    if (matched) {
      return {
        id: matched.company_id || matched.tenant_key,
        tenant_key: matched.tenant_key,
        tenant_name: matched.company_name
      };
    }
  } catch (_) { }

  // テナントが特定できない場合は別会社・デモへフォールバックせず null を返す
  return null;
}

// 認証済みセッションのテナントと、提示された端末証明書の所属テナントの一致を検証するミドルウェア
async function verifyDeviceSessionTenantMatch(req, res, next) {
  if (!req.session) return next();

  // ゲートウェイ内部認証情報（mTLS終端）の存在確認
  const deviceAuth = req.deviceAuth;
  if (!deviceAuth || !deviceAuth.hasCert || !deviceAuth.fingerprint256) {
    console.warn('[SessionGuard] Request has session but missing verified device certificate');
    logger.writeLog({
      severity: 'WARNING',
      eventType: 'authz_denied',
      requestId: req.requestId,
      correlationId: req.correlationId,
      tenantId: req.session?.tenant_key || null,
      userId: req.session?.username || null,
      clientIp: logger.extractClientIp(req),
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl || req.url,
        status: 403
      },
      message: '認証済みセッションの端末証明書未提示によるアクセス拒否',
      details: { code: 'DEVICE_UNVERIFIED', reason: 'missing_device_certificate' }
    });
    return res.status(403).json({
      success: false,
      code: 'DEVICE_UNVERIFIED',
      message: '端末の登録を確認してください'
    });
  }

  const cpPool = getControlPlanePool();
  const deviceResult = await resolveDeviceTenant(req, cpPool);
  if (!deviceResult.ok) {
    console.warn(`[SessionGuard] Device rejected: ${deviceResult.error}`);
    logger.writeLog({
      severity: 'WARNING',
      eventType: 'authz_denied',
      requestId: req.requestId,
      correlationId: req.correlationId,
      tenantId: req.session?.tenant_key || null,
      userId: req.session?.username || null,
      clientIp: logger.extractClientIp(req),
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl || req.url,
        status: 403
      },
      message: `端末証明書拒否によるアクセス遮断: ${deviceResult.error}`,
      details: { code: 'DEVICE_UNVERIFIED', reason: deviceResult.error }
    });
    return res.status(403).json({
      success: false,
      code: 'DEVICE_UNVERIFIED',
      message: '端末の登録を確認してください'
    });
  }

  const sessionTenant = String(req.session.tenant_key || req.session.tenant_id || '').trim().toLowerCase();
  const certTenant = String(deviceResult.tenantKey || '').trim().toLowerCase();

  // セッションのテナントと端末証明書の所属テナントの厳格な一致確認 (スーパー管理者 niina は統括管理のため他テナント端末からも許可)
  if (!isSuperAdminUser(req.session) && sessionTenant && certTenant && sessionTenant !== certTenant) {
    console.warn(`[SessionGuard] Tenant mismatch: sessionTenant=${sessionTenant}, certTenant=${certTenant}`);
    logger.writeLog({
      severity: 'WARNING',
      eventType: 'authz_denied',
      requestId: req.requestId,
      correlationId: req.correlationId,
      tenantId: sessionTenant,
      userId: req.session?.username || null,
      clientIp: logger.extractClientIp(req),
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl || req.url,
        status: 403
      },
      message: `セッションテナントと証明書テナントの不一致 (DEVICE_MISMATCH: session=${sessionTenant}, cert=${certTenant})`,
      details: { code: 'TENANT_MISMATCH', sessionTenant, certTenant }
    });
    res.clearCookie('token', { path: '/' });
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    return res.status(403).json({
      success: false,
      code: 'TENANT_MISMATCH',
      message: '端末の所属会社とログインセッションが一致しません。対象会社で再認証してください。'
    });
  }

  req.deviceInfo = deviceResult;
  next();
}

async function resolveDeviceTenant(req, cpPool) {
  if (req.deviceInfo) {
    return req.deviceInfo;
  }
  const deviceAuth = req.deviceAuth;

  // 1. ゲートウェイ経由（mTLSプロキシ終端情報あり）
  if (deviceAuth) {
    if (!deviceAuth.hasCert || !deviceAuth.fingerprint256) {
      console.warn('[DeviceAuth] No client certificate provided via gateway');
      return { ok: false, error: 'no_certificate' };
    }

    if (!deviceAuth.authorized) {
      console.warn('[DeviceAuth] Client certificate is unauthorized by Root CA (TLS level):', deviceAuth.authError);
      securityGuard.recordFailure({
        clientIp: logger.extractClientIp(req),
        identifier: deviceAuth.fingerprint256 || 'unauthorized_cert',
        eventType: 'tls_cert_unauthorized',
        weight: 3,
        reason: 'TLS_CERTIFICATE_UNAUTHORIZED',
        req
      });
      return { ok: false, error: 'TLS_CERTIFICATE_UNAUTHORIZED', message: 'クライアント証明書がRoot CAによって検証できませんでした', detail: deviceAuth.authError, level: 'tls' };
    }

    try {
      const certRes = await cpPool.query(`
        SELECT
          d.id::text AS device_id,
          d.device_identifier,
          d.tenant_id,
          d.device_name,
          d.is_active AS device_active,
          dc.id::text AS cert_id,
          dc.serial_number,
          dc.is_revoked,
          dc.valid_to
        FROM public.device_certificates dc
        JOIN public.devices d ON d.id = dc.device_id
        WHERE dc.fingerprint256 = $1
        LIMIT 1
      `, [deviceAuth.fingerprint256]);

      const certRow = certRes.rows[0];
      if (!certRow) {
        console.warn(`[DeviceAuth] Certificate fingerprint not registered in DB: ${deviceAuth.fingerprint256}`);
        securityGuard.recordFailure({
          clientIp: logger.extractClientIp(req),
          identifier: deviceAuth.fingerprint256,
          eventType: 'device_not_registered',
          weight: 2,
          reason: 'DEVICE_NOT_REGISTERED',
          req
        });
        return { ok: false, error: 'DEVICE_NOT_REGISTERED', message: '提示された証明書は会社管理端末として登録されていません', level: 'db' };
      }

      if (certRow.is_revoked) {
        console.warn(`[DeviceAuth] Certificate is revoked in DB: serial=${certRow.serial_number}`);
        securityGuard.recordFailure({
          clientIp: logger.extractClientIp(req),
          tenantId: certRow.tenant_id,
          identifier: deviceAuth.fingerprint256,
          eventType: 'cert_revoked_in_db',
          weight: 3,
          reason: 'CERTIFICATE_REVOKED_IN_DB',
          req
        });
        return { ok: false, error: 'CERTIFICATE_REVOKED_IN_DB', message: 'クライアント証明書が管理DB上で停止されています', serialNumber: certRow.serial_number, level: 'db' };
      }

      if (!certRow.device_active) {
        console.warn(`[DeviceAuth] Device is inactive in DB: ${certRow.device_identifier}`);
        securityGuard.recordFailure({
          clientIp: logger.extractClientIp(req),
          tenantId: certRow.tenant_id,
          identifier: deviceAuth.fingerprint256,
          eventType: 'device_inactive_in_db',
          weight: 3,
          reason: 'DEVICE_INACTIVE_IN_DB',
          req
        });
        return { ok: false, error: 'DEVICE_INACTIVE_IN_DB', message: '会社管理端末が管理DB上で停止されています', deviceIdentifier: certRow.device_identifier, level: 'db' };
      }

      if (certRow.valid_to && new Date(certRow.valid_to) < new Date()) {
        console.warn(`[DeviceAuth] Certificate is expired in DB: valid_to=${certRow.valid_to}`);
        securityGuard.recordFailure({
          clientIp: logger.extractClientIp(req),
          tenantId: certRow.tenant_id,
          identifier: deviceAuth.fingerprint256,
          eventType: 'cert_expired',
          weight: 2,
          reason: 'CERTIFICATE_EXPIRED',
          req
        });
        return { ok: false, error: 'CERTIFICATE_EXPIRED', message: 'クライアント証明書の有効期限が切れています', validTo: certRow.valid_to, level: 'db' };
      }

      return {
        ok: true,
        tenantKey: certRow.tenant_id,
        deviceId: certRow.device_id,
        deviceIdentifier: certRow.device_identifier,
        deviceName: certRow.device_name,
        fingerprint256: deviceAuth.fingerprint256
      };
    } catch (err) {
      console.error('[DeviceAuth] Database lookup error:', err.message);
      return { ok: false, error: 'database_error' };
    }
  }

  // 端末証明書未提示（または直接アクセス）の場合は即座に拒否（暗黙フォールバック・モックバイパス禁止）
  return { ok: false, error: 'no_certificate' };
}

app.post('/api/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const clientIp = logger.extractClientIp(req);
  const requestId = req.requestId || req.headers['x-request-id'] || null;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'ユーザー名とパスワードを入力してください', requestId });
  }

  const attemptStartedAt = new Date();
  const cpPool = getControlPlanePool();

  // 段階的制限・遮断チェック (IP / テナント / ユーザー複合キー)
  const tenantKey = req.deviceInfo?.tenantKey || null;
  const guard = await securityGuard.checkAccess({
    clientIp,
    tenantId: tenantKey,
    identifier: username,
    pool: cpPool
  });

  if (!guard.allowed) {
    res.setHeader('Retry-After', guard.retryAfterSeconds);
    return res.status(guard.status).json({
      success: false,
      code: guard.code,
      message: guard.message,
      retryAfterSeconds: guard.retryAfterSeconds,
      requestId
    });
  }

  // レベル2: 遅延ペナルティ (総当たり攻撃の低速化)
  if (guard.shouldThrottle && guard.delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, guard.delayMs));
  }

  try {
    // 1. テナント特定（端末認証方針）:
    let tenantInfo = null;
    const deviceResult = await resolveDeviceTenant(req, cpPool);
    if (!deviceResult.ok) {
      console.warn(`[TenantAuth] Device verification rejected: ${deviceResult.error}`);
      return res.status(403).json({
        success: false,
        message: deviceResult.message || '端末の登録を確認してください',
        code: deviceResult.error || 'DEVICE_UNVERIFIED',
        requestId
      });
    }

    const effectiveTenantKey = deviceResult.tenantKey;
    req.deviceInfo = deviceResult;
    console.log(`[LoginTrace:1] Device verified: tenantKey=${effectiveTenantKey}, deviceId=${deviceResult.deviceId || 'none'}, certFingerprint=${deviceResult.fingerprint256 ? deviceResult.fingerprint256.slice(0, 12) + '...' : 'none'}`);

    // 2. 共通DBで接続先を解決
    const runtime = await resolveTenantRuntime(effectiveTenantKey).catch(err => {
      console.warn(`[LoginTrace:Error] resolveTenantRuntime failed for ${effectiveTenantKey}:`, err.message);
      return null;
    });

    if (!runtime || !runtime.pool) {
      console.warn(`[LoginTrace:503] Database pool unavailable for tenant: ${effectiveTenantKey}`);
      return res.status(503).json({
        success: false,
        message: `テナント(${effectiveTenantKey})のデータベースに接続できません`
      });
    }

    console.log(`[LoginTrace:2] Target DB resolved: tenantKey=${effectiveTenantKey}, dbName=${runtime.dbName}`);

    // 3. 対象テナントDBでユーザー認証（パスワード照合）
    const tenantUserResult = await runtime.pool.query(`
      SELECT id, username, COALESCE(display_name, username) AS display_name, password_hash, password, role, is_active
      FROM public.users
      WHERE username = $1 AND is_active = true
      LIMIT 1
    `, [username]);
    const tenantUser = tenantUserResult.rows[0];

    console.log(`[LoginTrace:3] Querying user in ${runtime.dbName}: attemptedUsername='${username}', userFound=${Boolean(tenantUser)}, role=${tenantUser?.role || 'none'}, isActive=${tenantUser?.is_active ?? 'none'}`);

    if (!tenantUser) {
      logger.writeLog({
        severity: 'WARNING',
        eventType: 'auth_failure',
        requestId: req.requestId,
        correlationId: req.correlationId,
        tenantId: effectiveTenantKey,
        userId: username,
        clientIp: logger.extractClientIp(req),
        message: `ログイン認証失敗: ユーザーが存在しないか無効です (username='${username}', tenant='${effectiveTenantKey}')`,
        details: { reason: 'user_not_found_or_inactive' }
      });
      const failRes = await securityGuard.recordFailure({
        clientIp: logger.extractClientIp(req),
        tenantId: effectiveTenantKey,
        identifier: username,
        eventType: 'auth_failure',
        weight: 1,
        reason: 'user_not_found_or_inactive',
        pool: cpPool,
        req,
        attemptStartedAt,
        expectedResetGeneration: guard.resetGeneration
      });
      if (failRes.isBlocked) {
        res.setHeader('Retry-After', failRes.retryAfterSeconds || 300);
        return res.status(429).json({
          success: false,
          code: 'TEMPORARILY_BLOCKED',
          message: '連続した認証失敗を検知したため、一時的にアクセスを制限しています。時間をおいて再試行してください。',
          retryAfterSeconds: failRes.retryAfterSeconds || 300,
          requestId
        });
      }
      return res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません', requestId });
    }

    const candidateHashes = [tenantUser.password_hash, tenantUser.password].filter(Boolean);
    if (candidateHashes.length === 0) {
      logger.writeLog({
        severity: 'WARNING',
        eventType: 'auth_failure',
        requestId: req.requestId,
        correlationId: req.correlationId,
        tenantId: effectiveTenantKey,
        userId: username,
        clientIp: logger.extractClientIp(req),
        message: `ログイン認証失敗: パスワードハッシュ未設定 (username='${username}', tenant='${effectiveTenantKey}')`,
        details: { reason: 'no_password_hash' }
      });
      const failRes = await securityGuard.recordFailure({
        clientIp: logger.extractClientIp(req),
        tenantId: effectiveTenantKey,
        identifier: username,
        eventType: 'auth_failure',
        weight: 1,
        reason: 'no_password_hash',
        pool: cpPool,
        req,
        attemptStartedAt,
        expectedResetGeneration: guard.resetGeneration
      });
      if (failRes.isBlocked) {
        res.setHeader('Retry-After', failRes.retryAfterSeconds || 300);
        return res.status(429).json({
          success: false,
          code: 'TEMPORARILY_BLOCKED',
          message: '連続した認証失敗を検知したため、一時的にアクセスを制限しています。時間をおいて再試行してください。',
          retryAfterSeconds: failRes.retryAfterSeconds || 300,
          requestId
        });
      }
      return res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません', requestId });
    }

    let passwordMatches = false;
    for (const h of candidateHashes) {
      if (String(h).startsWith('$2')) {
        if (await bcrypt.compare(password, h)) {
          passwordMatches = true;
          break;
        }
      } else if (String(password) === String(h)) {
        passwordMatches = true;
        break;
      }
    }

    if (!passwordMatches) {
      logger.writeLog({
        severity: 'WARNING',
        eventType: 'auth_failure',
        requestId: req.requestId,
        correlationId: req.correlationId,
        tenantId: effectiveTenantKey,
        userId: username,
        clientIp: logger.extractClientIp(req),
        message: `ログイン認証失敗: パスワード不一致 (username='${username}', tenant='${effectiveTenantKey}')`,
        details: { reason: 'password_mismatch' }
      });
      const failRes = await securityGuard.recordFailure({
        clientIp: logger.extractClientIp(req),
        tenantId: effectiveTenantKey,
        identifier: username,
        eventType: 'auth_failure',
        weight: 1,
        reason: 'password_mismatch',
        pool: cpPool,
        req,
        attemptStartedAt,
        expectedResetGeneration: guard.resetGeneration
      });
      if (failRes.isBlocked) {
        res.setHeader('Retry-After', failRes.retryAfterSeconds || 300);
        return res.status(429).json({
          success: false,
          code: 'TEMPORARILY_BLOCKED',
          message: '連続した認証失敗を検知したため、一時的にアクセスを制限しています。時間をおいて再試行してください。',
          retryAfterSeconds: failRes.retryAfterSeconds || 300,
          requestId
        });
      }
      return res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが正しくありません', requestId });
    }

    // 4. 認証成功: テナント情報取得とセッション発行
    if (!tenantInfo) {
      const tenantInfoRes = await cpPool.query(
        `SELECT id::text AS tenant_id, tenant_key, tenant_name FROM public.tenants WHERE tenant_key = $1 OR id::text = $1 LIMIT 1`,
        [effectiveTenantKey]
      ).catch(() => ({ rows: [] }));
      tenantInfo = tenantInfoRes.rows[0];
    }

    const officialTenantKey = effectiveTenantKey || (tenantInfo ? tenantInfo.tenant_key : null);
    if (!officialTenantKey) {
      return res.status(403).json({ success: false, message: '有効なテナントが特定できません' });
    }
    const officialTenantUuid = tenantInfo ? tenantInfo.tenant_id : null;
    const companyName = tenantInfo?.tenant_name || runtime.companyName || officialTenantKey;

    const tokenGens = await tokenRevocation.getCurrentTokenGenerations(cpPool, officialTenantKey, tenantUser.id);

    const isSuperUser = String(tenantUser.username || '').toLowerCase() === 'niina' || tenantUser.id === 'e996e889-4165-412f-8450-8b6e0f193256';
    const finalRole = isSuperUser ? 'system_admin' : (tenantUser.role || 'operator');

    const token = commonAuth.issueSession(res, {
      userId: tenantUser.id,
      username: tenantUser.username,
      tenantId: officialTenantKey,
      tenantKey: officialTenantKey,
      authSource: 'tenant',
      role: finalRole,
      permissions: [],
      userGen: tokenGens.userGen,
      tenantGen: tokenGens.tenantGen
    });

    logger.writeLog({
      severity: 'INFO',
      eventType: 'auth_success',
      requestId: req.requestId,
      correlationId: req.correlationId,
      tenantId: officialTenantKey,
      userId: tenantUser.username,
      clientIp: logger.extractClientIp(req),
      message: `ログイン認証成功: user='${tenantUser.username}', tenant='${officialTenantKey}', role='${finalRole}'`,
      details: {
        role: finalRole,
        authMethod: 'password'
      }
    });

    await securityGuard.recordSuccess({
      clientIp: logger.extractClientIp(req),
      tenantId: officialTenantKey,
      identifier: tenantUser.username,
      pool: cpPool
    });

    return res.json({
      success: true,
      token,
      user: {
        id: tenantUser.id,
        username: tenantUser.username,
        display_name: tenantUser.display_name || tenantUser.username,
        displayName: tenantUser.display_name || tenantUser.username,
        full_name: tenantUser.display_name || tenantUser.username,
        role: finalRole,
        is_super_admin: isSuperUser,
        can_switch_tenant: isSuperUser,
        tenant_id: officialTenantKey,
        tenant_key: officialTenantKey,
        tenant_uuid: officialTenantUuid,
        tenant_path: '/',
        company_name: companyName
      }
    });
  } catch (err) {
    console.error('[TenantAuth] Login failed:', err.message);
    return res.status(500).json({ success: false, message: 'ログイン処理に失敗しました' });
  }
});

// NOTE: このエンドポイントは以前重複定義されており、旧ハンドラは
// UUID型カラムに対して厳格な JOIN (t.id = $2 など) を行っていたため、
// session.tenant_id が文字列の場合に例外を起こしていた。
// 現在は下記の安全な実装（id::text = $1 OR tenant_key = $1）を残し、
// 端末証明書とのテナント整合性（verifyDeviceSessionTenantMatch）を必須とする。
app.get('/api/auth/me', requireCookieSession, verifyDeviceSessionTenantMatch, async (req, res) => {
  try {
    const pool = getControlPlanePool();
    // 1. テナント情報の取得（UUIDでもtenant_keyでも安全に引く）
    const tenantRes = await pool.query(`
      SELECT id::text AS tenant_id, tenant_key, tenant_name
      FROM public.tenants
      WHERE (id::text = $1 OR tenant_key = $1)
        AND is_active = true
      LIMIT 1
    `, [String(req.session.tenant_id || '').trim()]);

    const tenant = tenantRes.rows[0];
    if (!tenant) {
      return res.status(403).json({ success: false, message: '有効なテナント情報が特定できません' });
    }

    // 2. ユーザー情報を取得（テナントDBから取得）
    let user = null;
    try {
      const runtime = await resolveTenantRuntime(tenant.tenant_key);
      const userRes = await runtime.pool.query(`
        SELECT id, username, display_name, role
        FROM public.users
        WHERE (id::text = $1 OR username = $1) AND is_active = true
        LIMIT 1
      `, [String(req.session.sub || '').trim()]);
      user = userRes.rows[0];
    } catch (_) { }

    if (!user) {
      return res.status(401).json({ success: false, message: 'テナント内に認証情報が見つかりません' });
    }

    const isSuperUser = String(user.username || req.session.username || '').toLowerCase() === 'niina' || String(user.id || req.session.sub) === 'e996e889-4165-412f-8450-8b6e0f193256';
    const finalRole = isSuperUser ? 'system_admin' : (user.role || req.session.role || 'operator');

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name || user.username,
        displayName: user.display_name || user.username,
        full_name: user.display_name || user.username,
        tenant_id: tenant.tenant_key || tenant.tenant_id,
        tenant_key: tenant.tenant_key,
        tenant_uuid: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        role: finalRole,
        is_super_admin: isSuperUser,
        can_switch_tenant: isSuperUser,
        permissions: req.session.permissions || []
      }
    });
  } catch (err) {
    console.error('[/api/auth/me] Error:', err.message);
    return res.status(500).json({ success: false, message: 'セッション取得エラー' });
  }
});

// GET /api/apps
// テナントに紐づく有効なアプリ一覧を public.tenant_app_routings から安全に取得する。
// 端末証明書のテナント一致を検証し、未承認アクセスや他社へのすり替えを遮断する。
app.get('/api/apps', requireCookieSession, verifyDeviceSessionTenantMatch, async (req, res) => {
  let tenantKey = '';
  try {
    const pool = getControlPlanePool();
    const tenant = await resolveSessionTenant(pool, req.session).catch(() => null);
    tenantKey = tenant?.tenant_key || String(req.session.tenant_key || req.session.tenant_id || '').trim().toLowerCase();

    if (!tenantKey) {
      return res.status(403).json({ success: false, message: 'テナントを確認できません' });
    }

    const isSuper = isSuperAdminUser(req.session);
    let targetTenant = tenant;
    if (isSuper) {
      const requestedTenantKey = extractTenantIdFromRequest(req) || req.tenantId;
      if (requestedTenantKey && requestedTenantKey !== tenantKey) {
        const switchRes = await pool.query(`
          SELECT id::text AS id, tenant_key, tenant_name
          FROM public.tenants
          WHERE tenant_key = $1 OR id::text = $1
          LIMIT 1
        `, [requestedTenantKey]);
        if (switchRes.rows[0]) {
          targetTenant = switchRes.rows[0];
          tenantKey = targetTenant.tenant_key;
        }
      }
    }

    const result = await pool.query(`
      SELECT a.app_key AS app_id, a.app_name, a.app_url, a.icon, a.icon AS icon_class, a.category, ta.required_role, a.display_order, a.description
      FROM public.tenant_applications ta
      JOIN public.applications a ON a.id = ta.application_id AND a.is_active = true
      WHERE ta.tenant_id = $1
        AND ta.is_enabled = true
        AND ta.is_visible = true
      ORDER BY COALESCE(a.display_order, 9999) ASC, a.app_key ASC
    `, [targetTenant.id]);

    const APP_IMAGES = {
      planning: '/assets/img/Operation Planning to Performance Management.png',
      inspection: '/assets/img/Inspection Checklist.jpeg',
      emergency: '/assets/img/recovery.png',
      failure: '/assets/img/Machinery Failure Management.png'
    };

    const appsList = result.rows
      .filter((row) => row.app_url)
      .map((row) => ({
        app_key: row.app_id,
        app_name: row.app_name,
        app_url: row.app_id === 'inspection' ? '/inspection/' : row.app_url,
        image_url: APP_IMAGES[row.app_id] || '/assets/img/default-app.png',
        icon: row.icon || '📱',
        iconClass: row.icon_class || null,
        category: row.category || '',
        description: row.description || ''
      }));

    return res.json({ success: true, apps: appsList });
  } catch (err) {
    console.error(`[/api/apps] Failed to load apps for tenant "${tenantKey}":`, err.message);
    return res.json({ success: true, apps: [] });
  }
});

const handleLaunchToken = async (req, res) => {
  try {
    const pool = getControlPlanePool();
    const appKey = String(req.params.appKey || '').trim();
    const tenant = await resolveSessionTenant(pool, req.session);
    if (!tenant) return res.status(403).json({ success: false, message: 'テナントを確認できません' });

    // アプリ一覧(/api/apps)と同じ public.tenant_applications を正本として権限判定する
    const routeCheck = await pool.query(`
      SELECT 1
      FROM public.tenant_applications ta
      JOIN public.applications a ON a.id = ta.application_id AND a.is_active = true
      WHERE ta.tenant_id = $1 AND a.app_key = $2 AND ta.is_enabled = true
      LIMIT 1
    `, [tenant.id, appKey]);
    if (routeCheck.rowCount === 0) {
      return res.status(403).json({ success: false, message: 'このアプリを起動する権限がありません' });
    }

    let user = null;
    const runtime = await resolveTenantRuntime(tenant.tenant_key).catch(() => null);
    if (runtime && runtime.pool) {
      const tenantUserResult = await runtime.pool.query(`
        SELECT id::text AS user_id, username, COALESCE(display_name, username) AS display_name, role AS role_key
        FROM public.users
        WHERE (id::text = $1 OR username = $2) AND is_active = true
        LIMIT 1
      `, [String(req.session.sub || ''), String(req.session.username || '')]);
      if (tenantUserResult.rows[0]) {
        user = { ...tenantUserResult.rows[0], tenant_key: tenant.tenant_key, tenant_name: tenant.tenant_name };
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'テナント内のログインユーザーを確認できません' });
    }

    const tenantKey = String(user.tenant_key || '').trim().toLowerCase();
    const normalizedRole = normalizeRoleForApp(user.role_key || req.session.role);
    const ssoClaims = buildSsoClaims({
      runtime: { companyId: tenantKey, companyName: user.tenant_name },
      normalizedRole,
      effectiveTenantId: tenantKey,
      user
    });
    const launchJti = crypto.randomUUID ? crypto.randomUUID() : `launch-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const token = jwt.sign({
      jti: launchJti,
      id: user.user_id,
      userId: user.user_id,
      username: user.username,
      displayName: user.display_name,
      role: normalizedRole,
      externalRole: mapRoleForExternal(normalizedRole),
      roles: ssoClaims.roles,
      appKey, // 起動先アプリを限定し、別アプリ向けの使い回しを拒否できるようにする
      tenantKey,
      tenantId: tenantKey,
      tenant_id: tenantKey,
      tenantPath: '/',
      tenant_path: '/',
      company_code: ssoClaims.company_code,
      company_name: ssoClaims.company_name
    }, process.env.SHARED_SSO_SECRET, {
      expiresIn: '60s',
      issuer: process.env.JWT_ISSUER || 'dashboard-auth',
      audience: process.env.JWT_AUDIENCE || 'dashboard-apps'
    });

    return res.json({
      success: true,
      token,
      launchCode: token,
      tenantKey,
      publicTenantId: getPublicTenantIdForKey(tenantKey),
      role: normalizedRole
    });
  } catch (err) {
    console.error('[CommonAuth] Launch token creation failed:', err.message);
    return res.status(500).json({ success: false, message: 'アプリ起動用の認証情報を発行できませんでした' });
  }
};

app.post('/api/apps/:appKey/launch-token', requireCookieSession, verifyDeviceSessionTenantMatch, handleLaunchToken);

app.post('/api/logout', async (req, res) => {
  const token = commonAuth.extractToken(req);

  if (token) {
    try {
      const cpPool = getControlPlanePool();
      let decoded = null;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (_) {
        decoded = jwt.decode(token);
      }
      const expDate = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 3600 * 1000);
      const revRes = await tokenRevocation.revokeToken({
        token,
        jti: decoded?.jti || null,
        userId: decoded?.sub || decoded?.userId,
        tenantId: decoded?.tenant_key || decoded?.tenantId,
        appKey: 'dashboard',
        reason: 'user_logout',
        revokedBy: decoded?.sub || decoded?.username || 'user',
        expiresAt: expDate,
        pool: cpPool
      });

      if (!revRes.ok) {
        console.error('[Logout] Failed to revoke token in DB:', revRes.error?.message);
        return res.status(500).json({ success: false, message: 'ログアウト処理中の失効登録に失敗しました' });
      }
    } catch (err) {
      console.error('[Logout] Revocation error (Fail-Close):', err.message);
      return res.status(503).json({ success: false, message: '失効管理DB障害によりログアウトを完了できませんでした' });
    }
  }

  commonAuth.clearSession(res);
  return res.json({ success: true });
});

// 旧認証API（廃止済み）
app.post('/api/retired-tenant-login', (req, res) => {
  return res.status(410).json({ success: false, message: 'この認証方式は廃止されました' });
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

    if (!decoded.tenantId) {
      return res.status(401).json({
        valid: false,
        success: false,
        message: 'テナントが特定できません'
      });
    }

    const runtime = await resolveTenantRuntime(decoded.tenantId);

    return requestTenantContextStorage.run(runtime, async () => {
      req.tenantContext = runtime;
      req.tenantId = runtime.resolvedTenantId || decoded.tenantId;
      req.db = runtime.pool || getControlPlanePool();

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
      const normalizedRole = normalizeRoleForApp(user.role);
      const department = getDepartmentByRole(normalizedRole);

      res.json({
        valid: true,
        success: true,
        tenant_id: runtime.resolvedTenantId || decoded.tenantId,
        tenant_path: '/',
        company_code: decoded.company_code || decoded.companyCode || runtime.companyId || runtime.resolvedTenantId,
        company_name: decoded.company_name || decoded.companyName || runtime.companyName || '',
        tenant_name: decoded.company_name || decoded.companyName || runtime.companyName || '',
        roles: Array.isArray(decoded.roles) && decoded.roles.length > 0 ? decoded.roles : [mapRoleForExternal(normalizedRole)],
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: mapRoleForExternal(normalizedRole),
          externalRole: mapRoleForExternal(normalizedRole),
          department: department,
          tenant_id: runtime.resolvedTenantId || decoded.tenantId,
          tenant_path: '/',
          company_code: decoded.company_code || decoded.companyCode || runtime.companyId || runtime.resolvedTenantId,
          company_name: decoded.company_name || decoded.companyName || runtime.companyName || '',
          tenant_name: decoded.company_name || decoded.companyName || runtime.companyName || '',
          roles: Array.isArray(decoded.roles) && decoded.roles.length > 0 ? decoded.roles : [mapRoleForExternal(normalizedRole)]
        }
      });
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

// 外部認証エンドポイント (postMessage/Body連携用)
app.post('/api/auth/external', async (req, res) => {
  // デバッグ用: リクエストボディとヘッダーのロギング
  console.log('[ExternalAuth] Incoming Request Headers:', JSON.stringify(req.headers));
  console.log('[ExternalAuth] Incoming Request Body Type:', typeof req.body);
  console.log('[ExternalAuth] Incoming Request Body:', JSON.stringify(req.body));

  // 1. req.body が文字列として届いている場合（JSON未パース時）のパース処理
  let body = req.body || {};
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body);
      console.log('[ExternalAuth] Parsed raw string body:', JSON.stringify(body));
    } catch (e) {
      console.warn('[ExternalAuth] Failed to parse raw string body, continuing...', e.message);
    }
  }

  // 2. 表記揺れを吸収する堅牢なトークン抽出 (全キー曖昧検索含む)
  let token = body.token || body.external_token || body.externalToken || body.jwt;
  if (!token) {
    // ボディオブジェクト内のキーを走査し、部分一致でトークンっぽいやつを探す
    for (const key of Object.keys(body)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('token') || lowerKey === 'jwt') {
        token = body[key];
        console.log(`[ExternalAuth] Fuzzy matched token from body key "${key}":`, token);
        break;
      }
    }
  }

  // クエリ、ヘッダーからもフォールバック抽出
  if (!token && req.query?.token) {
    token = req.query.token;
  }
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader.trim();
      }
    }
  }

  // 3. テナントIDの抽出 (表記揺れ吸収 & 全キー曖昧検索)
  let tenantId = body.tenantId || body.tenant_id || body.tenant || req.query?.tenant_id || req.query?.tenantId || req.query?.tenant;
  if (!tenantId) {
    for (const key of Object.keys(body)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('tenant') || lowerKey.includes('company')) {
        tenantId = body[key];
        console.log(`[ExternalAuth] Fuzzy matched tenant ID from body key "${key}":`, tenantId);
        break;
      }
    }
  }

  // 4. トークンが正しく検証（jwt.verify）された場合のJWTデコードと、テナント情報のフォールバック解決
  let decoded = null;
  if (token) {
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'emergency-assistance-app',
        audience: 'emergency-assistance-app'
      });

      // JWT内部のテナントIDをフォールバック採用
      if (!tenantId && decoded) {
        tenantId = decoded.tenantId || decoded.tenant_id;
        console.log('[ExternalAuth] Resolved tenant ID fallbacked from decoded JWT:', tenantId);
      }
    } catch (err) {
      console.error('[ExternalAuth] Pre-verification / JWT decode failed:', err.message);
      return res.status(401).json({
        success: false,
        message: '検証に失敗したか、トークンの有効期限が切れています。',
        details: err.message
      });
    }
  }

  console.log('[ExternalAuth] Final Resolved Parameters:', {
    hasToken: !!token,
    tenantId: tenantId || 'not provided',
    decodedUserId: decoded ? decoded.id : 'none'
  });

  if (!token || !tenantId) {
    return res.status(400).json({
      success: false,
      error: '不適切なリクエストです。トークンおよびテナントIDが必要です。',
      message: '不適切なリクエストです。トークンおよびテナントIDが必要です。',
      details: `Parameter missing. hasToken: ${!!token}, tenantId: ${tenantId ? 'specified (' + tenantId + ')' : 'missing'}`,
      receivedBody: req.body,
      parsedBody: body,
      receivedHeaders: req.headers
    });
  }

  try {
    const resolvedTenantId = tenantId || decoded.tenantId;
    if (!resolvedTenantId) {
      return res.status(401).json({
        success: false,
        message: 'テナントが特定できません'
      });
    }
    const runtime = await resolveTenantRuntime(resolvedTenantId);

    return requestTenantContextStorage.run(runtime, async () => {
      req.tenantContext = runtime;
      req.tenantId = runtime.resolvedTenantId || resolvedTenantId;
      req.db = runtime.pool || getControlPlanePool();

      // ゲートウェイ方式でユーザー情報を取得（departmentカラムは取得しない）
      const users = await dynamicSelect('users',
        { id: decoded.id },
        ['id', 'username', 'display_name', 'role'],
        1
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません',
          details: `User ID ${decoded.id} not found in database ${runtime.dbName}`,
          receivedBody: req.body
        });
      }

      const user = users[0];
      const normalizedRole = normalizeRoleForApp(user.role);
      const department = getDepartmentByRole(normalizedRole);

      res.json({
        success: true,
        token: token,
        tenant_id: runtime.resolvedTenantId || resolvedTenantId,
        tenant_path: '/',
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: mapRoleForExternal(normalizedRole),
          externalRole: mapRoleForExternal(normalizedRole),
          department: department,
          tenant_id: runtime.resolvedTenantId || resolvedTenantId,
          tenant_path: '/'
        }
      });
    });
  } catch (err) {
    console.error('[ExternalAuth] Process execution failed:', err);
    res.status(401).json({
      success: false,
      message: '検証に失敗したか、トークンの有効期限が切れています。',
      details: err.message
    });
  }
});

// トークンリフレッシュエンドポイント (有効期限を延長)
app.post('/api/refresh-token', async (req, res) => {
  const bodyToken = req.body && req.body.token ? String(req.body.token).trim() : '';
  const token = bodyToken || extractTokenFromRequest(req);

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
    const normalizedRole = normalizeRoleForApp(decoded.role);
    const department = decoded.department || getDepartmentByRole(normalizedRole);
    const effectiveTenantId = decoded.tenantId || decoded.tenant_id || 'demo';
    const effectiveTenantPath = normalizeTenantPathForResponse(
      decoded.tenantPath || decoded.tenant_path || '',
      effectiveTenantId
    );
    const ssoClaims = buildSsoClaims({
      runtime: {
        companyId: decoded.company_code || decoded.companyCode || effectiveTenantId,
        companyName: decoded.company_name || decoded.companyName || ''
      },
      normalizedRole,
      effectiveTenantId,
      user: decoded
    });

    const payload = {
      id: decoded.id,
      userId: decoded.id,  // 外部アプリ連携用
      username: decoded.username,
      displayName: decoded.displayName,
      role: normalizedRole,
      externalRole: mapRoleForExternal(normalizedRole),
      department: department,
      roles: Array.isArray(decoded.roles) && decoded.roles.length > 0 ? decoded.roles : ssoClaims.roles,
      tenantId: effectiveTenantId,
      tenant_id: effectiveTenantId,
      tenantPath: effectiveTenantPath,
      tenant_path: effectiveTenantPath,
      company_code: decoded.company_code || decoded.companyCode || ssoClaims.company_code,
      company_name: decoded.company_name || decoded.companyName || ssoClaims.company_name,
      dbName: decoded.dbName || '',
      iat: Math.floor(Date.now() / 1000)
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '4h',
      issuer: 'emergency-assistance-app',
      audience: 'emergency-assistance-app'
    });

    console.log('[TokenRefresh] 🔄 Token refreshed for user:', decoded.username);

    // ログイン時と同様に HttpOnly Cookie も更新
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 4 * 60 * 60 * 1000
    });

    res.json({ success: true, token: newToken });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(401).json({ success: false, message: 'トークンが無効または期限切れです' });
  }
});

// ========================================
// RBAC (権限管理) Repository & Service (tenant DB移設版)
// ========================================

const UserRbacRepository = {
  /**
   * テナントDBからユーザーのロールコード一覧を取得
   */
  async getRolesByUsername(username) {
    const query = `
      SELECT r.code 
      FROM public.users u
      JOIN public.user_role_assignments ura ON u.id = ura.user_id
      JOIN public.roles r ON ura.role_id = r.id
      WHERE u.username = $1 AND u.is_active = true
    `;
    try {
      const result = await pool.query(query, [username]);
      return result.rows.map(row => String(row.code).trim().toLowerCase());
    } catch (err) {
      console.warn(`[UserRbacRepository] Failed to get roles for ${username} from public schema (falling back):`, err.message);
      return [];
    }
  },

  /**
   * テナントDBからユーザーの権限コード一覧を取得
   */
  async getPermissionsByUsername(username) {
    const query = `
      SELECT DISTINCT p.code 
      FROM public.users u
      JOIN public.user_role_assignments ura ON u.id = ura.user_id
      JOIN public.roles r ON ura.role_id = r.id
      JOIN public.role_permissions rp ON r.id = rp.role_id
      JOIN public.permissions p ON rp.permission_id = p.id
      WHERE u.username = $1 AND u.is_active = true
    `;
    try {
      const result = await pool.query(query, [username]);
      return result.rows.map(row => String(row.code).trim().toLowerCase());
    } catch (err) {
      console.warn(`[UserRbacRepository] Failed to get permissions for ${username} from public schema (falling back):`, err.message);
      return [];
    }
  }
};

const UserRbacService = {
  /**
   * ユーザーが特定のロールを保持しているか
   */
  async hasRole(username, roleCode) {
    const roles = await UserRbacRepository.getRolesByUsername(username);
    return roles.includes(String(roleCode).trim().toLowerCase());
  },

  /**
   * ユーザーが特定の権限を保持しているか(認可処理部)
   */
  async hasPermission(username, permissionCode) {
    const permissions = await UserRbacRepository.getPermissionsByUsername(username);
    return permissions.includes(String(permissionCode).trim().toLowerCase());
  }
};

// 管理者認証ミドルウェア
async function requireAdmin(req, res, next) {
  let decoded;
  try {
    decoded = commonAuth.readSession(req);
    if (!decoded) throw new Error('missing session');
  } catch (err) {
    return res.status(401).json({ success: false, message: 'トークンが無効または期限切れです', requestId: req.requestId || req.headers['x-request-id'] || null });
  }

  const rawToken = commonAuth.extractToken(req);
  if (rawToken && await tokenRevocation.isTokenRevoked(rawToken, getControlPlanePool())) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_REVOKED',
      message: 'このセッションは失効しています。再度ログインしてください。',
      requestId: req.requestId || req.headers['x-request-id'] || null
    });
  }

  if (['system_admin', 'tenant_admin', 'manager', 'operation_admin', 'user', 'admin'].includes(decoded.role) || isSuperAdminUser(decoded)) {
    req.user = {
      id: decoded.sub || decoded.userId || decoded.id,
      username: decoded.username || decoded.sub || '',
      role: decoded.role || (isSuperAdminUser(decoded) ? 'system_admin' : 'operator'),
      tenant_id: decoded.tenant_id || decoded.tenantId || decoded.tenant_key || '',
      tenant_key: decoded.tenant_key || decoded.tenant_id || decoded.tenantId || '',
      permissions: decoded.permissions || []
    };
    return next();
  }
  return res.status(403).json({ success: false, message: 'アクセス権限がありません。管理者権限が必要です。' });

  // JWT の tenantId でテナントコンテキストを再確定（URL パス解析の誤検知を防ぐ）
  if (decoded.tenantId && decoded.tenantId !== 'demo_env') {
    try {
      const jwtRuntime = await resolveTenantRuntime(decoded.tenantId);
      req.tenantContext = jwtRuntime;
      req.tenantId = jwtRuntime.resolvedTenantId || decoded.tenantId;
      req.db = jwtRuntime.pool || getControlPlanePool();
      // JWT tenantId で AsyncLocalStorage を上書きして後続処理を実行
      return requestTenantContextStorage.run(jwtRuntime, async () => {
        await requireAdminCore(req, res, next, decoded);
      });
    } catch (e) {
      console.warn('[requireAdmin] JWT tenant resolve failed, using existing context:', e.message);
    }
  }
  return requireAdminCore(req, res, next, decoded);
}

async function requireAdminCore(req, res, next, decoded) {
  try {
    const users = await dynamicSelect('users', { id: decoded.id }, ['id', 'username', 'role'], 1);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    const user = users[0];
    const normalizedRole = normalizeRoleForApp(user.role);

    // テナントDBの権限マッピングを動的にチェックする
    const tenantRoles = await UserRbacRepository.getRolesByUsername(user.username);
    console.log(`[RbacMiddleware] Roles for ${user.username} from tenant DB:`, tenantRoles);

    // テナントDBの roles で 'admin' または 'manager' であるか、もしくはマスタ上の管理者ロール
    const normalizedTenantRoles = tenantRoles.map((r) => normalizeRoleForApp(r));
    const isAuthorized = normalizedTenantRoles.includes('system_admin')
      || normalizedTenantRoles.includes('operation_admin')
      || normalizedRole === 'system_admin'
      || normalizedRole === 'operation_admin'
      || isSuperAdminUser(decoded);

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'アクセス権限がありません。管理者権限が必要です。' });
    }

    req.user = {
      ...user,
      role: normalizedRole
    };
    next();
  } catch (err) {
    console.error('Auth middleware user lookup error:', err);
    return res.status(500).json({ success: false, message: '認証ユーザー情報の取得に失敗しました' });
  }
}

// システム管理者専用認証ミドルウェア (niina 専用)
async function requireSystemAdmin(req, res, next) {
  let decoded;
  try {
    decoded = commonAuth.readSession(req);
    if (!decoded) throw new Error('missing session');
  } catch (err) {
    return res.status(401).json({ success: false, message: 'トークンが無効または期限切れです', requestId: req.requestId || req.headers['x-request-id'] || null });
  }

  const rawToken = commonAuth.extractToken(req);
  if (rawToken && await tokenRevocation.isTokenRevoked(rawToken, getControlPlanePool())) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_REVOKED',
      message: 'このセッションは失効しています。再度ログインしてください。',
      requestId: req.requestId || req.headers['x-request-id'] || null
    });
  }

  if (isSuperAdminUser(decoded)) {
    req.user = {
      id: decoded.sub || decoded.userId || decoded.id,
      username: decoded.username || decoded.sub || 'niina',
      role: decoded.role || 'system_admin',
      tenant_id: decoded.tenant_id || decoded.tenantId || decoded.tenant_key || '',
      tenant_key: decoded.tenant_key || decoded.tenant_id || decoded.tenantId || '',
      permissions: decoded.permissions || []
    };
    return next();
  }
  return res.status(403).json({ success: false, message: 'アクセス権限がありません。システム管理者（niina）権限が必要です。' });

  try {
    const users = await dynamicSelect('users', { id: decoded.id }, ['id', 'username', 'role'], 1);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }

    const user = users[0];
    const normalizedRole = normalizeRoleForApp(user.role);

    // system_admin のみアクセス可能
    if (normalizedRole !== 'system_admin') {
      return res.status(403).json({ success: false, message: 'アクセス権限がありません。システム管理者権限が必要です。' });
    }

    req.user = {
      ...user,
      role: normalizedRole
    };
    next();
  } catch (err) {
    console.error('System admin middleware user lookup error:', err);
    return res.status(500).json({ success: false, message: '認証ユーザー情報の取得に失敗しました' });
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
    const result = await getRequestDbPool(req).query(query);
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error('History get error:', err);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

// ========================================
// システム共通設定（テナントDB operations.system_settings）
// ========================================

// 許可された設定キーのホワイトリストおよびバリデーション定義
const SYSTEM_SETTINGS_WHITELIST = {
  'company_name': { type: 'string', minLen: 1, maxLen: 100, label: '会社名' },
  'system_title': { type: 'string', minLen: 1, maxLen: 100, label: 'システムタイトル' },
  'logo_url': { type: 'string', minLen: 0, maxLen: 500, label: 'ロゴURL' },
  'timezone': { type: 'string', minLen: 1, maxLen: 50, label: 'タイムゾーン' },
  'enable_email': { type: 'boolean', label: 'メール通知有効化' },
  'admin_email': { type: 'email', maxLen: 200, label: '管理者メール' },
  'default_search_days': { type: 'number', min: 1, max: 365, label: 'デフォルト検索期間（日）' },
  'max_display_records': { type: 'number', min: 10, max: 5000, label: '最大表示件数' },
  'trend_analysis_count': { type: 'number', min: 2, max: 20, label: '推移分析回数' }
};

function validateSettingKeyValue(key, value) {
  const rule = SYSTEM_SETTINGS_WHITELIST[key];
  if (!rule) {
    return { valid: false, error: `許可されていない未知の設定キーです: ${key}` };
  }

  const strVal = String(value ?? '').trim();

  if (rule.type === 'string') {
    if (rule.minLen && strVal.length < rule.minLen) {
      return { valid: false, error: `${rule.label}は${rule.minLen}文字以上で入力してください` };
    }
    if (rule.maxLen && strVal.length > rule.maxLen) {
      return { valid: false, error: `${rule.label}は${rule.maxLen}文字以内で入力してください` };
    }
    return { valid: true, sanitized: strVal };
  }

  if (rule.type === 'boolean') {
    if (strVal !== 'true' && strVal !== 'false') {
      return { valid: false, error: `${rule.label}は true または false を指定してください` };
    }
    return { valid: true, sanitized: strVal };
  }

  if (rule.type === 'email') {
    if (strVal.length > 0) {
      if (rule.maxLen && strVal.length > rule.maxLen) {
        return { valid: false, error: `${rule.label}は${rule.maxLen}文字以内で入力してください` };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(strVal)) {
        return { valid: false, error: `${rule.label}に正しいメールアドレス形式を入力してください` };
      }
    }
    return { valid: true, sanitized: strVal };
  }

  if (rule.type === 'number') {
    const num = Number(strVal);
    if (isNaN(num) || !Number.isInteger(num)) {
      return { valid: false, error: `${rule.label}は整数値を入力してください` };
    }
    if (rule.min !== undefined && num < rule.min) {
      return { valid: false, error: `${rule.label}は${rule.min}以上の値を入力してください` };
    }
    if (rule.max !== undefined && num > rule.max) {
      return { valid: false, error: `${rule.label}は${rule.max}以下の値を入力してください` };
    }
    return { valid: true, sanitized: String(num) };
  }

  return { valid: true, sanitized: strVal };
}

// 全システム共通設定取得（管理者以上が閲覧可能）
app.get('/api/system-settings', requireAdmin, async (req, res) => {
  try {
    const route = await resolveStrictRoutedTablePath('system_settings');
    const { category } = req.query;
    const activePool = getRequestDbPool(req);
    
    let query = `
      SELECT 
        id,
        category,
        setting_key,
        setting_value,
        value_type,
        display_name,
        description,
        is_editable,
        display_order,
        created_at,
        updated_at
      FROM ${route.fullPath}
    `;
    const params = [];
    if (category) {
      query += ` WHERE category = $1`;
      params.push(category);
    }
    query += ` ORDER BY category, display_order, setting_key`;

    const result = await activePool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/system-settings] Error:', err.message);
    res.status(500).json({ error: 'システム設定の取得に失敗しました', details: err.message });
  }
});

// システム共通設定の更新（ID指定：システム管理者のみ許可）
app.put('/api/system-settings/:id', requireSystemAdmin, async (req, res) => {
  const activePool = getRequestDbPool(req);
  let client;
  try {
    const { id } = req.params;
    const { setting_value, display_name, description } = req.body;
    const route = await resolveStrictRoutedTablePath('system_settings');

    client = await activePool.connect();
    await client.query('BEGIN');

    // 存在および編集可能チェック
    const check = await client.query(
      `SELECT id, setting_key, is_editable FROM ${route.fullPath} WHERE id = $1`,
      [id]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '指定された設定が見つかりません' });
    }
    const current = check.rows[0];
    if (!current.is_editable) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'この設定項目は変更禁止です' });
    }

    // ホワイトリスト・バリデーションチェック
    if (SYSTEM_SETTINGS_WHITELIST[current.setting_key]) {
      const valCheck = validateSettingKeyValue(current.setting_key, setting_value);
      if (!valCheck.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: valCheck.error });
      }
    }

    const updater = req.user?.username || 'system_admin';
    console.log(`[PUT /api/system-settings/:id] Updating setting ${current.setting_key} by ${updater}`);

    const result = await client.query(
      `UPDATE ${route.fullPath}
       SET setting_value = COALESCE($1, setting_value),
           display_name = COALESCE($2, display_name),
           description = COALESCE($3, description),
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [setting_value, display_name, description, id]
    );

    // 監査ログの同期保存（Fail-Closed 検証）
    const auditResult = logger.writeAuditLogSync({
      req,
      severity: 'INFO',
      eventType: 'admin_audit',
      message: `管理者によるシステム設定変更: key='${current.setting_key}' by ${updater}`,
      details: {
        action: 'update_system_setting',
        setting_id: id,
        setting_key: current.setting_key,
        updater
      }
    });

    if (!auditResult.ok) {
      await client.query('ROLLBACK');
      console.error(`[Fail-Closed] Audit log failed for setting update (${current.setting_key}). Transaction rolled back.`);
      return res.status(500).json({
        success: false,
        code: 'AUDIT_LOG_FAILED',
        error: '監査ログの保存に失敗したため、安全確保のため設定更新を取り消しました'
      });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[PUT /api/system-settings/:id] Error:', err.message);
    res.status(500).json({ error: 'システム設定の更新に失敗しました', details: err.message });
  } finally {
    if (client) client.release();
  }
});

// システム共通設定の一括更新（システム管理者のみ許可・トランザクション処理・バリデーション付き）
app.post('/api/system-settings/bulk', requireSystemAdmin, async (req, res) => {
  const activePool = getRequestDbPool(req);
  let client;

  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settingsオブジェクトが指定されていません' });
    }

    const route = await resolveStrictRoutedTablePath('system_settings');

    // 1. キーリストの正規化とバリデーション
    const entries = [];
    const seenKeys = new Set();

    if (Array.isArray(settings)) {
      for (const item of settings) {
        const key = item.setting_key;
        if (!key) {
          return res.status(400).json({ error: '各要素に setting_key が必要です' });
        }
        if (seenKeys.has(key)) {
          return res.status(400).json({ error: `重複した設定キーが指定されています: ${key}` });
        }
        seenKeys.add(key);

        const valCheck = validateSettingKeyValue(key, item.setting_value);
        if (!valCheck.valid) {
          return res.status(400).json({ error: valCheck.error });
        }
        entries.push({ key, value: valCheck.sanitized });
      }
    } else {
      for (const [key, value] of Object.entries(settings)) {
        if (seenKeys.has(key)) {
          return res.status(400).json({ error: `重複した設定キーが指定されています: ${key}` });
        }
        seenKeys.add(key);

        const valCheck = validateSettingKeyValue(key, value);
        if (!valCheck.valid) {
          return res.status(400).json({ error: valCheck.error });
        }
        entries.push({ key, value: valCheck.sanitized });
      }
    }

    if (entries.length === 0) {
      return res.status(400).json({ error: '更新対象の設定項目がありません' });
    }

    // 2. トランザクション処理の開始
    client = await activePool.connect();
    await client.query('BEGIN');

    const updater = req.user?.username || 'system_admin';
    console.log(`[POST /api/system-settings/bulk] Starting transaction for ${entries.length} items by ${updater}`);

    for (const { key, value } of entries) {
      // 存在かつ編集可能かチェック
      const checkRes = await client.query(
        `SELECT id, is_editable FROM ${route.fullPath} WHERE setting_key = $1`,
        [key]
      );

      if (checkRes.rows.length === 0) {
        throw new Error(`設定項目が存在しません: ${key}`);
      }
      if (!checkRes.rows[0].is_editable) {
        throw new Error(`設定項目「${key}」は変更が禁止されています`);
      }

      await client.query(
        `UPDATE ${route.fullPath} 
         SET setting_value = $1, updated_at = now() 
         WHERE setting_key = $2 AND is_editable = true`,
        [value, key]
      );
    }

    // 監査ログの同期保存（Fail-Closed 検証）
    const auditResult = logger.writeAuditLogSync({
      req,
      severity: 'INFO',
      eventType: 'admin_audit',
      message: `管理者によるシステム設定一括変更: ${entries.length}件 by ${updater}`,
      details: {
        action: 'bulk_update_system_settings',
        count: entries.length,
        keys: entries.map(e => e.key),
        updater
      }
    });

    if (!auditResult.ok) {
      throw new Error(`[Fail-Closed] 監査ログの保存に失敗したため、システム設定の更新を取り消しました: ${auditResult.error?.message || 'audit write failure'}`);
    }

    await client.query('COMMIT');
    console.log(`[POST /api/system-settings/bulk] Transaction committed successfully`);

    res.json({ success: true, message: 'システム共通設定を更新しました', count: entries.length });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log(`[POST /api/system-settings/bulk] Transaction rolled back due to error`);
      } catch (rbErr) {
        console.error('Rollback error:', rbErr.message);
      }
    }
    console.error('[POST /api/system-settings/bulk] Error:', err.message);
    res.status(err.message.includes('存在しません') || err.message.includes('禁止') ? 400 : 500).json({
      error: 'システム共通設定の一括更新に失敗しました',
      details: err.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// ========================================
// テナント別アプリ公開設定（デモ用に起動できるアプリを制御）
// ========================================

// テナント一覧（tenant_app_routings に登録済みのテナントキー）
app.get('/api/admin/app-tenants', requireAdmin, async (req, res) => {
  try {
    const result = await getControlPlanePool().query(`
      SELECT tenant_key
      FROM public.tenants
      WHERE is_active = true
      ORDER BY tenant_key ASC
    `);
    res.json({ success: true, tenants: result.rows.map(r => r.tenant_key) });
  } catch (err) {
    console.error('[API /api/admin/app-tenants] Error:', err);
    res.status(500).json({ success: false, message: err.message || 'サーバーエラーが発生しました' });
  }
});

// アプリカタログ（4大業務アプリを標準業務フロー順で集約）
async function getAppCatalog() {
  const CORE_APP_ORDER = {
    planning: 1,
    inspection: 2,
    emergency: 3,
    failure: 4
  };

  const result = await getControlPlanePool().query(`
    SELECT app_key AS app_id, app_name, app_url, icon, icon AS icon_class, category, display_order
    FROM public.applications
    WHERE is_active = true
    ORDER BY display_order ASC, app_key ASC
  `);

  return result.rows.sort((a, b) => {
    const orderA = CORE_APP_ORDER[a.app_id] || a.display_order || 99;
    const orderB = CORE_APP_ORDER[b.app_id] || b.display_order || 99;
    return orderA - orderB;
  });
}

// 指定テナントのアプリ公開状況（カタログとテナント設定をマージ）
app.get('/api/admin/tenant-apps/:tenantKey', requireAdmin, async (req, res) => {
  try {
    const tenantKey = String(req.params.tenantKey || '').trim().toLowerCase();
    if (!tenantKey) {
      return res.status(400).json({ success: false, message: 'tenantKeyが必要です' });
    }

    const pool = getControlPlanePool();
    const tenantRes = await pool.query('SELECT id, tenant_key FROM public.tenants WHERE tenant_key = $1 LIMIT 1', [tenantKey]);
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'テナントが見つかりません' });
    }

    const [catalog, tenantAppsResult] = await Promise.all([
      getAppCatalog(),
      pool.query(`
        SELECT a.app_key AS app_id, a.app_name, a.app_url, a.icon, a.category, ta.is_enabled, ta.is_visible
        FROM public.tenant_applications ta
        JOIN public.applications a ON a.id = ta.application_id
        WHERE ta.tenant_id = $1
      `, [tenant.id])
    ]);

    const tenantAppsMap = new Map(tenantAppsResult.rows.map(row => [row.app_id, row]));

    const apps = catalog.map(catalogRow => {
      const tenantRow = tenantAppsMap.get(catalogRow.app_id);
      return {
        appId: catalogRow.app_id,
        appName: catalogRow.app_name,
        appUrl: catalogRow.app_url,
        icon: catalogRow.icon,
        iconClass: catalogRow.icon_class,
        category: catalogRow.category,
        isActive: tenantRow ? tenantRow.is_enabled === true : false,
        isProvisioned: !!tenantRow
      };
    });

    res.json({ success: true, tenantKey, apps });
  } catch (err) {
    console.error('[API /api/admin/tenant-apps/:tenantKey GET] Error:', err);
    res.status(500).json({ success: false, message: err.message || 'サーバーエラーが発生しました' });
  }
});

// 指定テナントのアプリ公開状況を更新（必要なアプリだけ有効化）
app.post('/api/admin/tenant-apps/:tenantKey', requireAdmin, async (req, res) => {
  const tenantKey = String(req.params.tenantKey || '').trim().toLowerCase();
  const updates = Array.isArray(req.body?.apps) ? req.body.apps : [];

  if (!tenantKey) {
    return res.status(400).json({ success: false, message: 'tenantKeyが必要です' });
  }
  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: '更新するアプリがありません' });
  }

  const controlPlane = getControlPlanePool();
  try {
    const tenantRes = await controlPlane.query('SELECT id FROM public.tenants WHERE tenant_key = $1 LIMIT 1', [tenantKey]);
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'テナントが見つかりません' });
    }

    for (const update of updates) {
      const appId = String(update.appId || '').trim();
      if (!appId) continue;
      const isActive = update.isActive === true;

      const appRes = await controlPlane.query('SELECT id FROM public.applications WHERE app_key = $1 LIMIT 1', [appId]);
      const appRow = appRes.rows[0];
      if (!appRow) continue;

      await controlPlane.query(`
        INSERT INTO public.tenant_applications (tenant_id, application_id, is_enabled, is_visible)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (tenant_id, application_id)
        DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = now()
      `, [tenant.id, appRow.id, isActive]);
    }

    res.json({ success: true, message: 'アプリ公開設定を更新しました' });
  } catch (err) {
    console.error('[API /api/admin/tenant-apps/:tenantKey POST] Error:', err);
    res.status(500).json({ success: false, message: err.message || 'サーバーエラーが発生しました' });
  }
});

// ユーザー一覧取得エンドポイント
app.get('/api/users', requireAdmin, async (req, res) => {
  console.log(`[GET /api/users] ENTER: req.tenantId=${req.tenantId}, req.headers.x-tenant-id=${req.headers['x-tenant-id']}, req.tenantContext=${req.tenantContext?.resolvedTenantId}`);
  let query = '';
  const params = [];
  let route = null;
  try {
    const compatible = await resolveCompatibleTablePath('users', [
      { schema: 'public', table: 'users' },
      { schema: 'master_data', table: 'users', source: 'legacy-fallback' }
    ], ['id', 'username', 'display_name', 'role', 'created_at']);
    route = compatible.route;
    query = `SELECT id, username, display_name, role, created_at FROM ${route.fullPath} ORDER BY id ASC`;
    const result = await getRequestDbPool(req).query(query);
    const isSuper = isSuperAdminUser(req);
    let availableTenants = [];
    if (isSuper) {
      availableTenants = await getAvailableTenantsList();
    }
    const normalizedUsers = result.rows.map((row) => ({
      ...row,
      role: normalizeRoleForApp(row.role)
    }));
    const currentTenantId = req.tenantId || req.tenantContext?.resolvedTenantId || 'daitetsu';
    res.json({
      success: true,
      users: normalizedUsers,
      canSwitchTenant: isSuper,
      availableTenants,
      currentTenantId
    });
  } catch (err) {
    console.error('[API DB Error]', {
      path: req.path,
      tenantId: req.tenantContext?.resolvedTenantId,
      dbName: req.tenantContext?.dbName,
      message: err.message,
      code: err.code,
      detail: err.detail,
      sql: query,
      params,
      route: route?.fullPath,
      schema: err.schema,
      table: err.table
    });
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
  }
});

app.get('/api/users/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'ユーザーIDが指定されていません' });
  }

  try {
    const db = getRequestDbPool(req);
    const compatible = await resolveCompatibleTablePath('users', [
      { schema: 'public', table: 'users' },
      { schema: 'master_data', table: 'users', source: 'legacy-fallback' }
    ], ['id', 'username', 'display_name', 'role']);
    const route = compatible.route;

    const query = `SELECT * FROM ${route.fullPath} WHERE id::text = $1 LIMIT 1`;
    const result = await db.query(query, [String(userId)]);

    if (!result || !result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '指定されたユーザーが見つかりません' });
    }

    const rawUser = result.rows[0];
    const { password, password_hash, token, secret, api_token, ...safeUser } = rawUser;

    const user = {
      id: safeUser.id,
      username: safeUser.username || '',
      display_name: safeUser.display_name || safeUser.username || '',
      email: safeUser.email || '',
      role: normalizeRoleForApp(safeUser.role || 'user'),
      department: safeUser.department || safeUser.office_name || safeUser.org_name || null,
      roles: [normalizeRoleForApp(safeUser.role || 'user')]
    };

    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('[GET /api/users/:id Error]', {
      userId,
      path: req.path,
      message: err.message,
      code: err.code
    });
    res.status(500).json({ success: false, message: 'ユーザー情報の取得中にエラーが発生しました' });
  }
});

// ユーザー追加エンドポイント
app.post('/api/users', requireAdmin, async (req, res) => {
  const isSuper = isSuperAdminUser(req);
  let db = getRequestDbPool(req);
  let client;
  try {
    const { username, password, display_name, role, email, targetTenantId } = req.body;
    // スーパー管理者 (niina) のみ targetTenantId による登録先テナント明示指定を許可
    if (isSuper && targetTenantId) {
      const targetRuntime = await resolveTenantRuntime(String(targetTenantId).trim().toLowerCase());
      if (targetRuntime && targetRuntime.pool) {
        db = targetRuntime.pool;
      }
    }
    const normalizedRole = normalizeRoleForApp(role || 'user');

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'ユーザー名とパスワードは必須です' });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'パスワードは英大文字・英小文字または数字・記号をそれぞれ1文字以上含む8文字以上で設定してください'
      });
    }

    // niina 以外は system_admin ロールを付与できない
    if (!isSuper && normalizedRole === 'system_admin') {
      return res.status(403).json({ success: false, message: 'システム管理者権限（niina権限）を付与することはできません' });
    }

    const compatible = await resolveCompatibleTablePath('users', [
      { schema: 'public', table: 'users' },
      { schema: 'master_data', table: 'users', source: 'legacy-fallback' }
    ], ['id', 'username', 'display_name', 'role']);
    const route = compatible.route;

    client = await db.connect();
    await client.query('BEGIN');

    const checkResult = await client.query(`SELECT id FROM ${route.fullPath} WHERE username = $1 LIMIT 1`, [username]);
    if (checkResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = {
      username,
      password: hashedPassword,
      password_hash: hashedPassword,
      display_name: display_name || null,
      role: normalizedRole
    };
    if (email) {
      userData.email = email;
    }

    const users = await dynamicInsert('users', userData, true, client);
    const created = users[0] || {};
    const { password: _p, password_hash: _ph, token: _t, ...safeCreated } = created;

    // 監査ログの同期保存（Fail-Closed 検証）
    const auditResult = logger.writeAuditLogSync({
      req,
      severity: 'INFO',
      eventType: 'admin_audit',
      message: `管理者によるユーザー新規作成: username='${username}', role='${normalizedRole}'`,
      details: {
        action: 'create_user',
        created_user_id: created.id,
        created_username: username,
        role: normalizedRole
      }
    });

    if (!auditResult.ok) {
      await client.query('ROLLBACK');
      console.error(`[Fail-Closed] Audit log failed for user creation (${username}). Transaction rolled back.`);
      return res.status(500).json({
        success: false,
        code: 'AUDIT_LOG_FAILED',
        message: '監査ログの保存に失敗したため、安全確保のためユーザー作成を取り消しました'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      user: { ...safeCreated, role: normalizeRoleForApp(safeCreated.role || normalizedRole) },
      message: 'ユーザーを追加しました'
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[POST /api/users Error]', {
      message: err.message,
      code: err.code
    });
    res.status(500).json({ success: false, message: 'ユーザー登録処理でエラーが発生しました' });
  } finally {
    if (client) client.release();
  }
});

// ユーザー更新エンドポイント
app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'ユーザーIDが指定されていません' });
  }

  const db = getRequestDbPool(req);
  let client;
  try {
    const { username, display_name, password, role, email } = req.body;
    const normalizedRole = normalizeRoleForApp(role || 'user');

    if (!username) {
      return res.status(400).json({ success: false, message: 'ユーザー名は必須です' });
    }

    const requesterRole = normalizeRoleForApp(req.user?.role || 'user');
    if (requesterRole !== 'system_admin' && normalizedRole === 'system_admin') {
      return res.status(403).json({ success: false, message: '自分の権限を超える管理者権限を付与することはできません' });
    }

    const compatible = await resolveCompatibleTablePath('users', [
      { schema: 'public', table: 'users' },
      { schema: 'master_data', table: 'users', source: 'legacy-fallback' }
    ], ['id', 'username', 'display_name', 'role']);
    const route = compatible.route;

    client = await db.connect();
    await client.query('BEGIN');

    const checkResult = await client.query(
      `SELECT id FROM ${route.fullPath} WHERE username = $1 AND id::text != $2 LIMIT 1`,
      [username, String(userId)]
    );
    if (checkResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています' });
    }

    const updateData = {
      username,
      display_name: display_name || null,
      role: normalizedRole,
      updated_at: new Date()
    };

    if (email !== undefined) {
      updateData.email = email || null;
    }

    if (password) {
      const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
      if (!passwordRegex.test(password)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'パスワードは英大文字・英小文字または数字・記号をそれぞれ1文字以上含む8文字以上で設定してください'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
      updateData.password_hash = hashedPassword;
    }

    const users = await dynamicUpdate('users', updateData, { id: userId }, true, client);
    if (!users || users.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '指定されたユーザーが見つかりません' });
    }

    const updated = users[0];
    const { password: _p, password_hash: _ph, token: _t, ...safeUpdated } = updated;

    // 監査ログの同期保存（Fail-Closed 検証）
    const auditResult = logger.writeAuditLogSync({
      req,
      severity: 'INFO',
      eventType: 'admin_audit',
      message: `管理者によるユーザー情報更新: target_user='${username}', role='${normalizedRole}'`,
      details: {
        action: 'update_user',
        target_user_id: userId,
        target_username: username,
        role: normalizedRole,
        password_changed: Boolean(password)
      }
    });

    if (!auditResult.ok) {
      await client.query('ROLLBACK');
      console.error(`[Fail-Closed] Audit log failed for user update (${username}, id=${userId}). Transaction rolled back.`);
      return res.status(500).json({
        success: false,
        code: 'AUDIT_LOG_FAILED',
        message: '監査ログの保存に失敗したため、安全確保のためユーザー更新を取り消しました'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      user: {
        ...safeUpdated,
        role: normalizeRoleForApp(safeUpdated.role || normalizedRole)
      },
      message: 'ユーザーを更新しました'
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[PUT /api/users/:id Error]', {
      userId,
      message: err.message,
      code: err.code
    });
    res.status(500).json({ success: false, message: 'ユーザー情報の更新中にエラーが発生しました' });
  } finally {
    if (client) client.release();
  }
});

// ユーザー削除エンドポイント
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'ユーザーIDが指定されていません' });
  }

  const db = getRequestDbPool(req);
  let client;
  try {
    if (String(req.user?.id) === String(userId)) {
      return res.status(400).json({ success: false, message: '自分自身のユーザーアカウントは削除できません' });
    }

    client = await db.connect();
    await client.query('BEGIN');

    const users = await dynamicDelete('users', { id: userId }, true, req, client);
    if (!users || users.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '指定されたユーザーが見つかりません' });
    }

    const deletedUser = users[0];

    // 監査ログの同期保存（Fail-Closed 検証）
    const auditResult = logger.writeAuditLogSync({
      req,
      severity: 'WARNING',
      eventType: 'admin_audit',
      message: `管理者によるユーザー削除: id=${userId}, username='${deletedUser.username || 'unknown'}'`,
      details: {
        action: 'delete_user',
        deleted_user_id: userId,
        deleted_username: deletedUser.username || null
      }
    });

    if (!auditResult.ok) {
      await client.query('ROLLBACK');
      console.error(`[Fail-Closed] Audit log failed for user deletion (id=${userId}). Transaction rolled back.`);
      return res.status(500).json({
        success: false,
        code: 'AUDIT_LOG_FAILED',
        message: '監査ログの保存に失敗したため、安全確保のためユーザー削除を取り消しました'
      });
    }

    await client.query('COMMIT');

    res.json({ success: true, message: 'ユーザーを削除しました' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[DELETE /api/users/:id Error]', {
      userId,
      message: err.message,
      code: err.code
    });
    res.status(500).json({ success: false, message: 'ユーザーの削除処理中にエラーが発生しました' });
  } finally {
    if (client) client.release();
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
        const normalizedRole = normalizeRoleForApp(user.role || 'user');

        const userData = {
          username: user.username,
          password: hashedPassword,
          display_name: user.display_name,
          role: normalizedRole
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
  let query = '';
  let params = [];
  try {
    const route = await resolveStrictRoutedTablePath('management_offices');
    query = `
      SELECT 
        id as office_id,
        office_name,
        office_code,
        NULL as office_type,
        address,
        NULL as postal_code,
        phone as phone_number,
        NULL as manager_namene_number,
        NULL as manager_name,
        created_at,
        updated_at
      FROM ${route.fullPath} 
      ORDER BY id DESC
    `;
    const activePool = getRequestDbPool(req);
    const result = await activePool.query(query, params);
    res.json({ success: true, offices: result.rows });
  } catch (err) {
    console.error('OFFICES API ERROR', err);
    console.error('SQL:', query);
    console.error('PARAMS:', params);
    console.error('err.message:', err.message);
    console.error('err.code:', err.code);
    console.error('err.detail:', err.detail);
    console.error('err.schema:', err.schema);
    console.error('err.table:', err.table);
    console.error('[API DB Error]', {
      path: req.path,
      tenantId: req.tenantContext?.resolvedTenantId,
      dbName: req.tenantContext?.dbName,
      message: err.message,
      code: err.code,
      schema: err.schema,
      table: err.table
    });
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました' });
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
      const route = await resolveStrictRoutedTablePath('management_offices');
      const activePool = getRequestDbPool(req);
      const maxCodeQuery = `SELECT MAX(CAST(office_code AS INTEGER)) as max_code FROM ${route.fullPath} WHERE office_code ~ '^[0-9]+$'`;
      const maxCodeResult = await activePool.query(maxCodeQuery);
      const maxCode = maxCodeResult.rows[0].max_code || 0;
      office_code = String(maxCode + 1).padStart(4, '0');
    }

    const offices = await dynamicInsert('management_offices', {
      office_code,
      office_name,
      address: address || null,
      phone: phone_number || null
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
        address: address || null,
        phone: phone_number || null,
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
    const offices = await dynamicDelete('management_offices', { id: officeId }, true, req);

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
  let query = '';
  let params = [];
  let basesRoute = null;
  let officesRoute = null;
  try {
    const basesCompatible = await resolveCompatibleTablePath('bases', [
      { schema: 'public', table: 'bases' },
      { schema: 'public', table: 'maintenance_bases', source: 'legacy-fallback' },
      { schema: 'master_data', table: 'bases', source: 'legacy-fallback' }
    ], ['base_name']);
    basesRoute = basesCompatible.route;
    const basesColumns = basesCompatible.columns;
    officesRoute = await resolveStrictRoutedTablePath('management_offices');
    const officeColumns = await getPhysicalTableColumns(officesRoute);

    const baseColumnExpr = (candidateColumns, aliasName, castType = null) => {
      for (const columnName of candidateColumns) {
        if (basesColumns.has(columnName)) {
          return `b.${columnName} AS ${aliasName}`;
        }
      }

      return castType ? `NULL::${castType} AS ${aliasName}` : `NULL AS ${aliasName}`;
    };

    const officeJoinCondition = basesColumns.has('office_id') && officeColumns.has('id')
      ? 'b.office_id::text = o.id::text'
      : (basesColumns.has('management_office_id') && officeColumns.has('id')
        ? 'b.management_office_id::text = o.id::text'
        : '1 = 0');

    const orderByExpr = basesColumns.has('id')
      ? 'b.id DESC'
      : (basesColumns.has('created_at')
        ? 'b.created_at DESC'
        : (basesColumns.has('base_code') ? 'b.base_code ASC' : '1'));

    query = `
      SELECT 
        ${baseColumnExpr(['id'], 'base_id', 'text')},
        ${baseColumnExpr(['base_code', 'code'], 'base_code', 'text')},
        ${baseColumnExpr(['base_name', 'name'], 'base_name', 'text')},
        ${baseColumnExpr(['location', 'address'], 'location', 'text')},
        ${baseColumnExpr(['office_id', 'management_office_id'], 'office_id', 'text')},
        ${baseColumnExpr(['capacity', 'capacity_count'], 'capacity', 'text')},
        ${baseColumnExpr(['manager_name', 'manager'], 'manager_name', 'text')},
        ${baseColumnExpr(['created_at', 'created_on'], 'created_at')},
        ${baseColumnExpr(['updated_at', 'modified_at'], 'updated_at')},
        COALESCE(o.office_name, '配置未設定') AS office_name 
      FROM ${basesRoute.fullPath} b
      LEFT JOIN ${officesRoute.fullPath} o ON ${officeJoinCondition}
      ORDER BY ${orderByExpr}
    `;
    console.log('[GET /api/bases] Resolved tables:', { bases: basesRoute.fullPath, offices: officesRoute.fullPath });
    console.log('[GET /api/bases] SQL:', query);
    console.log('[GET /api/bases] PARAMS:', params);
    const activePool = getRequestDbPool(req);
    const result = await activePool.query(query, params);
    res.json({ success: true, bases: result.rows });
  } catch (err) {
    console.error('BASES API ERROR', err);
    console.error('SQL:', query);
    console.error('PARAMS:', params);
    console.error('err.message:', err.message);
    console.error('err.code:', err.code);
    console.error('err.detail:', err.detail);
    console.error('err.schema:', err.schema);
    console.error('err.table:', err.table);
    console.error('[API DB Error]', {
      path: req.path,
      tenantId: req.tenantContext?.resolvedTenantId,
      dbName: req.tenantContext?.dbName,
      message: err.message,
      code: err.code,
      detail: err.detail,
      sql: query,
      params,
      route: { bases: basesRoute?.fullPath, offices: officesRoute?.fullPath },
      schema: err.schema,
      table: err.table
    });
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

  if (!String(base_name || '').trim()) {
    return res.status(400).json({ success: false, message: '基地名は必須です' });
  }

  try {
    const basesRoute = await resolveStrictRoutedTablePath('bases');
    const activePool = getRequestDbPool(req);
    const columns = await getPhysicalTableColumns(basesRoute, activePool);
    const nameColumn = ['base_name', 'name'].find(column => columns.has(column));
    const codeColumn = ['base_code', 'code'].find(column => columns.has(column));
    const officeIdColumn = ['office_id', 'management_office_id'].find(column => columns.has(column));
    const locationColumn = ['location', 'address'].find(column => columns.has(column));

    if (!nameColumn) {
      return res.status(500).json({ success: false, message: '保守基地テーブルに基地名の列がありません' });
    }
    if (management_office_id && !officeIdColumn) {
      return res.status(500).json({ success: false, message: '保守基地テーブルに所属事業所の列がありません' });
    }

    const client = await activePool.connect();
    let createdRow;
    try {
      await client.query('BEGIN');

      if (!base_code && codeColumn) {
        base_code = await generateNextMasterCode(client, basesRoute, codeColumn);
      }

      const insertData = { [nameColumn]: String(base_name).trim() };
      if (codeColumn && base_code) insertData[codeColumn] = base_code;
      if (locationColumn) insertData[locationColumn] = location || address || null;
      if (officeIdColumn) insertData[officeIdColumn] = management_office_id || null;

      const insertColumns = Object.keys(insertData);
      const insertValues = Object.values(insertData);
      const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
      const result = await client.query(
        `INSERT INTO ${basesRoute.fullPath} (${insertColumns.map(quoteIdentifier).join(', ')})
         VALUES (${placeholders}) RETURNING *`,
        insertValues
      );
      createdRow = result.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => {
        console.error('Base insert rollback error:', rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }

    if (createdRow) createdRow.base_id = createdRow.id || createdRow.base_id;
    res.json({ success: true, base: createdRow, message: '保守基地を追加しました' });
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
    const activePool = getRequestDbPool(req);

    const updateQuery = `
      UPDATE ${basesRoute.fullPath} 
      SET base_name = $1, location = $2, office_id = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const result = await activePool.query(updateQuery, [
      base_name,
      location || null,
      management_office_id || null,
      baseId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '保守基地が見つかりません' });
    }

    // フロントエンドとの互換性のために base_id プロパティを付加
    const updatedRow = result.rows[0];
    if (updatedRow) {
      updatedRow.base_id = updatedRow.id;
    }

    res.json({ success: true, base: updatedRow, message: '保守基地を更新しました' });
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
    const activePool = getRequestDbPool(req);
    const deleteQuery = `DELETE FROM ${basesRoute.fullPath} WHERE id = $1 RETURNING base_name`;
    const result = await activePool.query(deleteQuery, [baseId]);

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
      database: pool.options.database || 'common_db',
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
      res.download(backupFile, `common_db_backup_${timestamp}.sql`, (err) => {
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
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/user-management', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'user-management.html'));
});

// ========================================
// AI管理API
// ========================================

// AI設定取得
app.get('/api/ai/settings', requireSystemAdmin, async (req, res) => {
  try {
    const query = `
      SELECT app_id, setting_type, settings_json, updated_at
      FROM master_data.ai_settings
      WHERE app_id = 'common'
      ORDER BY setting_type
    `;
    const result = await getRequestDbPool(req).query(query);

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
app.post('/api/ai/settings', requireSystemAdmin, async (req, res) => {
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
app.get('/api/ai/knowledge', requireSystemAdmin, async (req, res) => {
  try {
    const query = `
      SELECT id, file_name, file_path, file_size_bytes, file_type,
             upload_source, description, tags, is_active, uploaded_by,
             uploaded_at, last_used_at, usage_count
      FROM master_data.ai_knowledge_data
      WHERE is_active = true
      ORDER BY uploaded_at DESC
    `;
    const result = await getRequestDbPool(req).query(query);

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
app.post('/api/ai/knowledge/upload', requireSystemAdmin, upload.single('file'), async (req, res) => {
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
app.delete('/api/ai/knowledge/:id', requireSystemAdmin, async (req, res) => {
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
app.get('/api/ai/storage-stats', requireSystemAdmin, async (req, res) => {
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
    const result = await getRequestDbPool(req).query(query);

    const stats = result.rows[0];
    stats.total_size_mb = (parseFloat(stats.total_size_bytes || 0) / (1024 * 1024)).toFixed(2);

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error getting storage stats:', err);
    res.status(500).json({ success: false, message: '統計情報の取得に失敗しました' });
  }
});

// GCS接続診断
app.get('/api/ai/diagnose-gcs', requireSystemAdmin, async (req, res) => {
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
    const result = await getRequestDbPool(req).query(query);
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

// 詳細なヘルスチェックエンドポイント（DB接続確認付き）
// Cloud Runのヘルスチェックには使わない（/healthを使う）
app.get('/health/db', async (req, res) => {
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



// ========================================
// 機種マスタ・機械番号マスタ API (統合表示用)
// ========================================

// 機種マスタ一覧取得
app.get('/api/machine-types', requireAdmin, async (req, res) => {
  try {
    const activePool = getRequestDbPool(req);
    const route = await resolveStrictRoutedTablePath('machine_types');
    const typeColumns = await getPhysicalTableColumns(route, activePool);
    console.log(`[GET /api/machine-types] Resolved Route: ${route.fullPath}`);

    const typeNameExpr = (() => {
      const candidates = ['model_name', 'type_name', 'machine_type_name', 'name'];
      const available = candidates
        .filter((columnName) => typeColumns.has(columnName))
        .map((columnName) => `NULLIF(mt.${columnName}::text, '')`);
      return available.length > 0
        ? `COALESCE(${available.join(', ')})`
        : 'NULL::text';
    })();

    const manufacturerExpr = typeColumns.has('manufacturer')
      ? 'mt.manufacturer::text'
      : (typeColumns.has('maker') ? 'mt.maker::text' : 'NULL::text');

    const categoryExpr = typeColumns.has('category')
      ? 'mt.category::text'
      : (typeColumns.has('machine_category') ? 'mt.machine_category::text' : 'NULL::text');

    const typeCodeExpr = typeColumns.has('type_code')
      ? 'mt.type_code::text'
      : 'NULL::text';

    const displayCodeExpr = typeColumns.has('display_code')
      ? 'mt.display_code::text'
      : 'NULL::text';

    const descriptionExpr = typeColumns.has('description')
      ? 'mt.description::text'
      : (typeColumns.has('remarks') ? 'mt.remarks::text' : (typeColumns.has('note') ? 'mt.note::text' : 'NULL::text'));

    const createdAtExpr = typeColumns.has('created_at')
      ? 'mt.created_at'
      : 'NULL::timestamp';

    const updatedAtExpr = typeColumns.has('updated_at')
      ? 'mt.updated_at'
      : 'NULL::timestamp';

    const query = `
      SELECT
        mt.id::text AS id,
        ${typeNameExpr} AS model_name,
        ${typeNameExpr} AS machine_type_name,
        ${typeNameExpr} AS type_name,
        ${manufacturerExpr} AS manufacturer,
        ${categoryExpr} AS category,
        ${descriptionExpr} AS description,
        ${typeCodeExpr} AS type_code,
        ${displayCodeExpr} AS display_code,
        ${createdAtExpr} AS created_at,
        ${updatedAtExpr} AS updated_at
      FROM ${route.fullPath} mt
      ORDER BY mt.id
    `;
    console.log(`[GET /api/machine-types] Executing: ${query}`);
    const result = await activePool.query(query);
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

    let { type_name, manufacturer, category, description, model_name, model, machine_type_name } = cleaned;
    const final_model_name = model_name || model || machine_type_name || type_name || null;
    const final_type_name = type_name || model_name || model || machine_type_name || null;
    const final_manufacturer = manufacturer || null;

    if (!final_type_name) return res.status(400).json({ success: false, message: 'メーカー型式は必須です' });

    const activePool = getRequestDbPool(req);
    const route = await resolveStrictRoutedTablePath('machine_types');
    const typeColumns = await getPhysicalTableColumns(route, activePool);
    if (!typeColumns.has('display_code')) {
      return res.status(500).json({
        success: false,
        message: '機種コード列がありません。Tenant migration 005 を適用してください。'
      });
    }
    const nameColumns = ['type_name', 'model_name', 'machine_type_name', 'name'].filter((columnName) => typeColumns.has(columnName));
    const manufacturerColumn = ['manufacturer', 'maker'].find((columnName) => typeColumns.has(columnName)) || null;
    const categoryColumn = ['category', 'machine_category'].find((columnName) => typeColumns.has(columnName)) || null;
    const descriptionColumn = ['description', 'remarks', 'note'].find((columnName) => typeColumns.has(columnName)) || null;
    const primaryNameColumn = nameColumns[0] || null;
    const secondaryNameColumn = nameColumns.find((columnName) => columnName !== primaryNameColumn) || null;

    if (!primaryNameColumn) {
      return res.status(500).json({ success: false, message: '機種マスタの列定義が不足しています(type_name/model_name/machine_type_name/name)' });
    }

    // 【厳格判定】 機種名・型式・メーカーの3つが完全に一致するものがあるか？
    const matchParams = [final_type_name];
    const matchConditions = [`${primaryNameColumn} = $1`];

    if (secondaryNameColumn) {
      matchParams.push(final_model_name);
      matchConditions.push(`${secondaryNameColumn} IS NOT DISTINCT FROM $${matchParams.length}`);
    }

    if (manufacturerColumn) {
      matchParams.push(final_manufacturer);
      matchConditions.push(`${manufacturerColumn} IS NOT DISTINCT FROM $${matchParams.length}`);
    }

    const matchQuery = `
      SELECT id FROM ${route.fullPath}
      WHERE ${matchConditions.join(' AND ')}
      LIMIT 1
    `;
    const matchResult = await activePool.query(matchQuery, matchParams);

    if (matchResult.rows.length > 0) {
      // 完全に一致する場合のみ「上書き」
      const existingId = matchResult.rows[0].id;
      console.log(`[MachineTypes] Exact match found (${existingId}). Updating existing record...`);
      const updateData = { updated_at: new Date() };
      if (categoryColumn) updateData[categoryColumn] = category;
      if (descriptionColumn) updateData[descriptionColumn] = description;
      const result = await dynamicUpdate('machine_types', updateData, { id: existingId });
      return res.json({ success: true, data: result[0], message: '既存の同一機種を特定し、情報を更新しました' });
    }

    // 1つでも違う場合は「新規追加」
    console.log(`[MachineTypes] New combination detected. Creating new record...`);

    const idTypeResult = await activePool.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE lower(table_schema) = lower($1)
        AND lower(table_name) = lower($2)
        AND lower(column_name) = 'id'
      LIMIT 1
    `, [route.schema, route.table]);
    const idDataType = String(idTypeResult.rows[0]?.data_type || '').toLowerCase();

    const client = await activePool.connect();
    let createdType;
    try {
      await client.query('BEGIN');
      const displayCode = await generateNextMasterCode(client, route, 'display_code', 'MT', 4, 9999);
      const saveData = {
        display_code: displayCode
      };
      if (!['smallint', 'integer', 'bigint'].includes(idDataType)) {
        saveData.id = idDataType === 'uuid' ? randomUUID() : displayCode;
      }
      if (typeColumns.has('type_code')) {
        saveData.type_code = `MT-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
      }
      if (typeColumns.has('type_name')) saveData.type_name = final_type_name;
      if (typeColumns.has('model_name')) saveData.model_name = final_model_name;
      if (typeColumns.has('machine_type_name')) saveData.machine_type_name = final_model_name;
      if (typeColumns.has('name')) saveData.name = final_model_name;
      if (manufacturerColumn) saveData[manufacturerColumn] = final_manufacturer;
      if (categoryColumn) saveData[categoryColumn] = category;
      if (descriptionColumn) saveData[descriptionColumn] = description;

      const insertData = filterDataByColumns(saveData, typeColumns);
      const insertColumns = Object.keys(insertData);
      const insertValues = Object.values(insertData);
      const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
      const result = await client.query(
        `INSERT INTO ${route.fullPath} (${insertColumns.map(quoteIdentifier).join(', ')})
         VALUES (${placeholders}) RETURNING *`,
        insertValues
      );
      createdType = result.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.json({ success: true, data: createdType, message: '新しい機種（別レコード）として登録しました' });

  } catch (err) {
    console.error('[POST /api/machine-types] Fatal Error:', err.message);
    if (err instanceof RangeError) {
      return res.status(409).json({ success: false, message: err.message });
    }
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

    const { type_name, manufacturer, category, description, model_name, model, machine_type_name } = cleaned;
    const final_type_name = type_name || model_name || model || machine_type_name || null;
    const final_model_name = model_name || model || machine_type_name || type_name || null;

    if (!final_type_name) {
      return res.status(400).json({ success: false, message: 'メーカー型式は必須です' });
    }

    const route = await resolveStrictRoutedTablePath('machine_types');
    const typeColumns = await getPhysicalTableColumns(route);
    const manufacturerColumn = ['manufacturer', 'maker'].find((columnName) => typeColumns.has(columnName)) || null;
    const categoryColumn = ['category', 'machine_category'].find((columnName) => typeColumns.has(columnName)) || null;
    const descriptionColumn = ['description', 'remarks', 'note'].find((columnName) => typeColumns.has(columnName)) || null;

    const updateData = {
      updated_at: new Date()
    };

    if (typeColumns.has('type_name')) updateData.type_name = final_type_name;
    if (typeColumns.has('model_name')) updateData.model_name = final_model_name;
    if (typeColumns.has('machine_type_name')) updateData.machine_type_name = final_model_name;
    if (typeColumns.has('name')) updateData.name = final_model_name;
    if (manufacturerColumn) updateData[manufacturerColumn] = manufacturer;
    if (categoryColumn) updateData[categoryColumn] = category;
    if (descriptionColumn) updateData[descriptionColumn] = description;

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
    const typesRoute = await resolveStrictRoutedTablePath('machine_types');
    const machinesRoute = await resolveStrictRoutedTablePath('machines');
    const typeColumns = await getPhysicalTableColumns(typesRoute);
    const machineColumns = await getPhysicalTableColumns(machinesRoute);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const resolveTypeIdForMachineTable = async (rawId) => {
      if (!rawId) return null;
      if (!(machineColumns.has('machine_type_id') && typeColumns.has('id'))) {
        return rawId;
      }

      const machineTypeIdTypeResult = await pool.query(
        `
          SELECT data_type
          FROM information_schema.columns
          WHERE lower(table_schema) = lower($1)
            AND lower(table_name) = lower($2)
            AND lower(column_name) = 'machine_type_id'
          LIMIT 1
        `,
        [machinesRoute.schema, machinesRoute.table]
      );
      const machineTypeIdDataType = String(machineTypeIdTypeResult.rows[0]?.data_type || '').toLowerCase();
      if (machineTypeIdDataType === 'uuid' && !uuidPattern.test(String(rawId)) && typeColumns.has('type_code')) {
        const converted = await getRequestDbPool(req).query(
          `SELECT id FROM ${typesRoute.fullPath} WHERE type_code = $1 LIMIT 1`,
          [rawId]
        );
        if (converted.rows.length > 0) {
          return converted.rows[0].id;
        }
      }
      return rawId;
    };

    const normalizedDeleteId = await resolveTypeIdForMachineTable(machineTypeId);
    const types = await dynamicDelete('machine_types', { id: normalizedDeleteId }, true, req);

    if (types.length === 0) {
      return res.status(404).json({ success: false, message: '機種が見つかりません' });
    }

    res.json({ success: true, message: '機種を削除しました' });
  } catch (err) {
    console.error('Machine type delete error:', err);
    if (err.code === '23503') {
      try {
        const machineTypeId = req.params.id;
        const typesRoute = await resolveStrictRoutedTablePath('machine_types');
        const machinesRoute = await resolveStrictRoutedTablePath('machines');
        const typeColumns = await getPhysicalTableColumns(typesRoute);
        const machineColumns = await getPhysicalTableColumns(machinesRoute);
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        const findUnspecifiedQueryCandidates = [];
        if (typeColumns.has('type_code')) findUnspecifiedQueryCandidates.push(`NULLIF(type_code::text, '')`);
        if (typeColumns.has('model_name')) findUnspecifiedQueryCandidates.push(`NULLIF(model_name::text, '')`);
        if (typeColumns.has('type_name')) findUnspecifiedQueryCandidates.push(`NULLIF(type_name::text, '')`);
        if (typeColumns.has('machine_type_name')) findUnspecifiedQueryCandidates.push(`NULLIF(machine_type_name::text, '')`);
        if (typeColumns.has('name')) findUnspecifiedQueryCandidates.push(`NULLIF(name::text, '')`);

        if (findUnspecifiedQueryCandidates.length > 0 && machineColumns.has('machine_type_id')) {
          const unspecified = await pool.query(
            `
              SELECT id
              FROM ${typesRoute.fullPath}
              WHERE UPPER(COALESCE(${findUnspecifiedQueryCandidates.join(', ')}, '')) = 'UNSPECIFIED'
              LIMIT 1
            `
          );

          if (unspecified.rows.length > 0) {
            const fallbackTypeId = unspecified.rows[0].id;
            let normalizedDeleteId = machineTypeId;
            const machineTypeIdTypeResult = await pool.query(
              `
                SELECT data_type
                FROM information_schema.columns
                WHERE lower(table_schema) = lower($1)
                  AND lower(table_name) = lower($2)
                  AND lower(column_name) = 'machine_type_id'
                LIMIT 1
              `,
              [machinesRoute.schema, machinesRoute.table]
            );
            const machineTypeIdDataType = String(machineTypeIdTypeResult.rows[0]?.data_type || '').toLowerCase();
            if (machineTypeIdDataType === 'uuid' && !uuidPattern.test(String(machineTypeId)) && typeColumns.has('type_code')) {
              const converted = await pool.query(
                `SELECT id FROM ${typesRoute.fullPath} WHERE type_code = $1 LIMIT 1`,
                [machineTypeId]
              );
              if (converted.rows.length > 0) {
                normalizedDeleteId = converted.rows[0].id;
              }
            }

            if (String(fallbackTypeId) !== String(normalizedDeleteId)) {
              await pool.query(
                `UPDATE ${machinesRoute.fullPath} SET machine_type_id = $1 WHERE machine_type_id = $2`,
                [fallbackTypeId, normalizedDeleteId]
              );

              const retryDelete = await dynamicDelete('machine_types', { id: normalizedDeleteId }, true, req);
              if (retryDelete.length > 0) {
                return res.json({
                  success: true,
                  message: '機種を削除しました（参照中の機械はUNSPECIFIEDへ付け替えました）'
                });
              }
            }
          }
        }
      } catch (fkRecoveryErr) {
        console.error('[Machine type delete] FK recovery failed:', fkRecoveryErr);
      }

      return res.status(409).json({
        success: false,
        message: '使用中の機種のため削除できません。関連する機械番号の機種を変更してから削除してください。',
        code: err.code,
        detail: err.detail || null
      });
    }

    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      code: err.code || null,
      detail: err.detail || null
    });
  }
});

// 機械番号マスタ一覧取得（機種情報も含む統合ビュー）
app.get('/api/machines', requireAdmin, async (req, res) => {
  try {
    const machinesRoute = await resolveStrictRoutedTablePath('machines');
    const machineTypesRoute = await resolveStrictRoutedTablePath('machine_types');
    const officesRoute = await resolveStrictRoutedTablePath('management_offices');
    const machineColumns = await getPhysicalTableColumns(machinesRoute);
    const machineTypeColumns = await getPhysicalTableColumns(machineTypesRoute);
    const officeColumns = await getPhysicalTableColumns(officesRoute);

    console.log(`[GET /api/machines] Resolving tables:`, {
      machines: machinesRoute.fullPath,
      types: machineTypesRoute.fullPath,
      offices: officesRoute.fullPath
    });

    const machineColumnExpr = (columnName, castType = null) => {
      if (machineColumns.has(columnName)) {
        return `m.${columnName} AS ${columnName}`;
      }
      return castType ? `NULL::${castType} AS ${columnName}` : `NULL AS ${columnName}`;
    };

    const machineTypeColumnExpr = (columnName, castType = null) => {
      if (machineTypeColumns.has(columnName)) {
        return `mt.${columnName} AS ${columnName}`;
      }
      return castType ? `NULL::${castType} AS ${columnName}` : `NULL AS ${columnName}`;
    };

    const machineTypeNameExpr = (() => {
      const candidates = ['model_name', 'type_name', 'machine_type_name', 'name'];
      const available = candidates
        .filter((columnName) => machineTypeColumns.has(columnName))
        .map((columnName) => `NULLIF(mt.${columnName}::text, '')`);
      return available.length > 0
        ? `COALESCE(${available.join(', ')})`
        : 'NULL::text';
    })();

    const officeNameExpr = officeColumns.has('office_name')
      ? `COALESCE(mo.office_name, '配置未設定') AS office_name`
      : `'配置未設定' AS office_name`;

    const machineTypeJoinCondition = machineColumns.has('machine_type_id') && machineTypeColumns.has('id')
      ? (machineTypeColumns.has('type_code')
        ? '(m.machine_type_id::text = mt.id::text OR m.machine_type_id::text = mt.type_code::text)'
        : 'm.machine_type_id::text = mt.id::text')
      : '1 = 0';

    const officeJoinCondition = machineColumns.has('office_id') && officeColumns.has('id')
      ? 'm.office_id::text = mo.id::text'
      : '1 = 0';

    const orderByExpr = machineColumns.has('machine_number')
      ? 'm.machine_number'
      : (machineColumns.has('id') ? 'm.id' : '1');

    const query = `
      SELECT 
        ${machineColumnExpr('id', 'text')},
        ${machineColumnExpr('machine_number', 'text')},
        ${machineColumnExpr('serial_number', 'text')},
        ${machineColumnExpr('manufacture_date', 'date')},
        ${machineColumnExpr('model_certification_date', 'date')},
        ${machineColumnExpr('purchase_date', 'date')},
        ${machineColumnExpr('assigned_base_id', 'text')},
        ${machineColumnExpr('office_id', 'text')},
        ${machineColumnExpr('notes', 'text')},
        ${machineColumnExpr('type_certification', 'text')},
        ${machineColumnExpr('machine_type_id', 'text')},
        ${machineTypeNameExpr} AS model_name,
        ${machineTypeNameExpr} AS machine_type_name,
        ${machineTypeNameExpr} AS machine_type,
        ${machineTypeNameExpr} AS vehicle_type,
        ${machineTypeColumnExpr('type_name', 'text')},
        ${machineTypeColumnExpr('manufacturer', 'text')},
        ${machineTypeColumnExpr('category', 'text')},
        ${officeNameExpr},
        ${machineColumnExpr('created_at')},
        ${machineColumnExpr('updated_at')}
      FROM ${machinesRoute.fullPath} m
      LEFT JOIN ${machineTypesRoute.fullPath} mt ON ${machineTypeJoinCondition}
      LEFT JOIN ${officesRoute.fullPath} mo ON ${officeJoinCondition}
      ORDER BY ${orderByExpr}
    `;
    console.log(`[GET /api/machines] Executing SQL...`);
    const result = await getRequestDbPool(req).query(query);
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

    let {
      machine_number,
      machine_type_id,
      serial_number,
      manufacture_date,
      model_certification_date,
      purchase_date,
      notes,
      type_certification,
      office_id
    } = cleaned;

    if (!machine_type_id) {
      return res.status(400).json({ success: false, message: '機種は必須です' });
    }

    // 実テーブル型に合わせてIDを採番/正規化
    const activePool = getRequestDbPool(req);
    const route = await resolveStrictRoutedTablePath('machines');
    const machineColumns = await getPhysicalTableColumns(route, activePool);

    // 接続先テーブルに必須列が存在しない場合、無言で保存を続行せず明確なエラーを返す
    const requiredMachineColumns = ['machine_number', 'machine_type_id', 'office_id'];
    const missingMachineColumns = requiredMachineColumns.filter((columnName) => !machineColumns.has(columnName));
    if (missingMachineColumns.length > 0) {
      console.error(`[POST /api/machines] Missing required columns on ${route.fullPath}:`, missingMachineColumns);
      return res.status(500).json({
        success: false,
        message: '保守用車テーブルの列定義が不足しています',
        detail: `不足列: ${missingMachineColumns.join(', ')} / 接続先: ${route.fullPath}`
      });
    }

    const idTypeResult = await activePool.query(
      `
        SELECT data_type
        FROM information_schema.columns
        WHERE lower(table_schema) = lower($1)
          AND lower(table_name) = lower($2)
          AND lower(column_name) = 'id'
        LIMIT 1
      `,
      [route.schema, route.table]
    );
    const machineTypeIdTypeResult = await activePool.query(
      `
        SELECT data_type
        FROM information_schema.columns
        WHERE lower(table_schema) = lower($1)
          AND lower(table_name) = lower($2)
          AND lower(column_name) = 'machine_type_id'
        LIMIT 1
      `,
      [route.schema, route.table]
    );

    const idDataType = String(idTypeResult.rows[0]?.data_type || '').toLowerCase();
    const machineTypeIdDataType = String(machineTypeIdTypeResult.rows[0]?.data_type || '').toLowerCase();
    const isIdUuid = idDataType === 'uuid';
    const isMachineTypeIdUuid = machineTypeIdDataType === 'uuid';
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    let machine_id;
    if (isIdUuid) {
      machine_id = randomUUID();
    } else {
      try {
        const maxIdResult = await activePool.query(`SELECT id::text FROM ${route.fullPath} WHERE id::text LIKE 'M%' ORDER BY id DESC LIMIT 1`);
        let nextNumber = 1;
        if (maxIdResult.rows.length > 0) {
          const lastId = maxIdResult.rows[0].id;
          const numericPart = parseInt(String(lastId || '').replace('M', ''), 10);
          if (!isNaN(numericPart)) {
            nextNumber = numericPart + 1;
          }
        }
        machine_id = `M${String(nextNumber).padStart(4, '0')}`;
      } catch (e) {
        machine_id = `M${Date.now().toString().slice(-6)}`;
      }
    }

    let normalizedMachineTypeId = machine_type_id;
    if (isMachineTypeIdUuid && normalizedMachineTypeId && !uuidPattern.test(String(normalizedMachineTypeId))) {
      const machineTypeRoute = await resolveStrictRoutedTablePath('machine_types');
      const mtColumns = await getPhysicalTableColumns(machineTypeRoute, activePool);
      if (mtColumns.has('type_code')) {
        const mtResult = await activePool.query(
          `SELECT id FROM ${machineTypeRoute.fullPath} WHERE type_code = $1 LIMIT 1`,
          [normalizedMachineTypeId]
        );
        if (mtResult.rows.length > 0) {
          normalizedMachineTypeId = mtResult.rows[0].id;
        }
      }
    }

    if (isMachineTypeIdUuid && (!normalizedMachineTypeId || !uuidPattern.test(String(normalizedMachineTypeId)))) {
      return res.status(400).json({
        success: false,
        message: '機種IDの形式が不正です。機種マスタを再読み込みして選択し直してください。'
      });
    }

    let machineTypesRoute = null;
    let machineTypeCategoryColumn = null;
    if (!machine_number) {
      machineTypesRoute = await resolveStrictRoutedTablePath('machine_types');
      const machineTypeColumns = await getPhysicalTableColumns(machineTypesRoute, activePool);
      machineTypeCategoryColumn = ['category', 'machine_category']
        .find((columnName) => machineTypeColumns.has(columnName)) || null;
    }

    const now = new Date();
    const machineInsertData = {
      machine_number,
      machine_type_id: normalizedMachineTypeId,
      serial_number,
      manufacture_date,
      model_certification_date,
      purchase_date,
      notes,
      type_certification,
      office_id,
      created_at: now,
      updated_at: now
    };
    if (machineColumns.has('id')) {
      machineInsertData.id = machine_id;
    }

    const client = await activePool.connect();
    let createdMachine;
    try {
      await client.query('BEGIN');
      if (!machine_number) {
        let categoryPrefix = null;
        if (machineTypesRoute && machineTypeCategoryColumn) {
          const machineTypeResult = await client.query(
            `SELECT ${quoteIdentifier(machineTypeCategoryColumn)}::text AS category
             FROM ${machineTypesRoute.fullPath}
             WHERE id::text = $1
             FOR SHARE`,
            [String(normalizedMachineTypeId)]
          );
          const category = String(machineTypeResult.rows[0]?.category || '').trim();
          categoryPrefix = MACHINE_NUMBER_PREFIX_BY_CATEGORY[category] || null;
        }
        machine_number = categoryPrefix
          ? await generateNextCategorizedMachineNumber(client, route, categoryPrefix)
          : await generateNextMasterCode(client, route, 'machine_number', 'M');
        machineInsertData.machine_number = machine_number;
      }

      const insertData = filterDataByColumns(machineInsertData, machineColumns);
      const insertColumns = Object.keys(insertData);
      const insertValues = Object.values(insertData);
      const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
      const result = await client.query(
        `INSERT INTO ${route.fullPath} (${insertColumns.map(quoteIdentifier).join(', ')})
         VALUES (${placeholders}) RETURNING *`,
        insertValues
      );
      createdMachine = result.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => {
        console.error('Machine insert rollback error:', rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, data: createdMachine, message: '機械を追加しました' });
  } catch (err) {
    console.error('[POST /api/machines] Machine create error:', err.message);
    if (err instanceof RangeError) {
      res.status(409).json({ success: false, message: err.message });
    } else if (err.code === '23505') {
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
      model_certification_date,
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
      model_certification_date,
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
    const machines = await dynamicDelete('machines', { id: machineId }, true, req);

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

app.get('/api/inspection-types/next-code', requireAdmin, async (req, res) => {
  try {
    const machineTypeId = normalizeOptionalId(req.query.machine_type_id);
    if (!machineTypeId) {
      return res.status(400).json({ success: false, message: '機種を選択してください', error: '機種を選択してください' });
    }

    const db = getRequestDbPool(req);
    const machineType = await getInspectionMachineType(machineTypeId, db);
    if (!machineType) {
      return res.status(404).json({ success: false, message: '選択した機種が見つかりません', error: '選択した機種が見つかりません' });
    }
    const prefix = getInspectionTypeCodePrefix(machineType.category);
    if (!prefix) {
      return res.status(400).json({ success: false, message: 'このカテゴリーの検修種別コードは自動採番できません', error: 'このカテゴリーの検修種別コードは自動採番できません' });
    }

    const route = await resolveStrictRoutedTablePath('inspection_types');
    const columns = await getPhysicalTableColumns(route, db);
    if (!columns.has('type_code')) {
      return res.status(503).json({ success: false, message: '検修種別コードのDB更新が必要です', error: '検修種別コードのDB更新が必要です' });
    }
    const typeCode = await previewNextInspectionTypeCode(db, route, prefix);
    res.json({ success: true, data: { type_code: typeCode }, message: '検修種別コードを取得しました' });
  } catch (err) {
    console.error('Inspection type code preview error:', err.message);
    if (err instanceof RangeError) {
      return res.status(409).json({ success: false, message: err.message, error: err.message });
    }
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別一覧取得
app.get('/api/inspection-types', requireAdmin, async (req, res) => {
  try {
    console.log('[GET /api/inspection-types] Fetching inspection types...');
    const db = getRequestDbPool(req);
    const route = await resolveStrictRoutedTablePath('inspection_types');
    const columns = await getPhysicalTableColumns(route, db);
    const idColumn = columns.has('id') ? 'id' : (columns.has('type_id') ? 'type_id' : null);
    const typeCodeColumn = columns.has('type_code') ? 'type_code' : null;
    const typeNameColumn = columns.has('type_name') ? 'type_name' : (columns.has('inspection_type_name') ? 'inspection_type_name' : (columns.has('name') ? 'name' : null));
    const descriptionColumn = columns.has('description') ? 'description' : null;
    const displayOrderColumn = columns.has('display_order') ? 'display_order' : null;
    const activeColumn = columns.has('is_active') ? 'is_active' : null;
    const machineTypeIdColumn = columns.has('machine_type_id') ? 'machine_type_id' : null;
    const cycleMonthsColumn = columns.has('cycle_months') ? 'cycle_months' : null;
    const durationDaysColumn = columns.has('duration_days') ? 'duration_days' : null;

    if (!idColumn || !typeNameColumn) {
      return res.status(500).json({ success: false, message: '検修種別テーブルの列定義が不足しています', error: '検修種別テーブルの列定義が不足しています' });
    }

    const machineTypesRoute = await resolveStrictRoutedTablePath('machine_types');
    const machineTypeColumns = await getPhysicalTableColumns(machineTypesRoute, db);
    const machineTypeId = machineTypeColumns.has('id') ? 'id' : null;
    const machineNameColumn = ['model_name', 'type_name', 'machine_type_name', 'name']
      .find(column => machineTypeColumns.has(column));
    const machineCategoryColumn = machineTypeColumns.has('category')
      ? 'category'
      : (machineTypeColumns.has('machine_category') ? 'machine_category' : null);
    const machineNameExpr = machineNameColumn
      ? `NULLIF(mt.${quoteIdentifier(machineNameColumn)}::text, '')`
      : 'NULL::text';
    const machineCategoryExpr = machineCategoryColumn
      ? `mt.${quoteIdentifier(machineCategoryColumn)}::text`
      : 'NULL::text';
    const machineManufacturerExpr = machineTypeColumns.has('manufacturer')
      ? 'mt.manufacturer::text'
      : 'NULL::text';
    const machineJoin = machineTypeIdColumn && machineTypeId
      ? `LEFT JOIN ${machineTypesRoute.fullPath} mt
           ON it.${quoteIdentifier(machineTypeIdColumn)}::text = mt.${quoteIdentifier(machineTypeId)}::text`
      : '';
    const filterMachineTypeId = normalizeOptionalId(req.query.machine_type_id);
    if (filterMachineTypeId && !machineTypeIdColumn) {
      return res.status(503).json({ success: false, message: '検修種別の機種設定にDB更新が必要です', error: '検修種別の機種設定にDB更新が必要です' });
    }
    const whereClause = filterMachineTypeId
      ? `WHERE it.${quoteIdentifier(machineTypeIdColumn)}::text = $1`
      : '';

    const query = `
      SELECT
        it.${quoteIdentifier(idColumn)}::text AS id,
        ${typeCodeColumn ? `it.${quoteIdentifier(typeCodeColumn)}::text` : 'NULL::text'} AS type_code,
        it.${quoteIdentifier(typeNameColumn)}::text AS type_name,
        ${descriptionColumn ? `it.${quoteIdentifier(descriptionColumn)}::text` : 'NULL::text'} AS description,
        ${displayOrderColumn ? `it.${quoteIdentifier(displayOrderColumn)}` : '0'} AS display_order,
        ${activeColumn ? `it.${quoteIdentifier(activeColumn)}` : 'true'} AS is_active,
        ${machineTypeIdColumn ? `it.${quoteIdentifier(machineTypeIdColumn)}::text` : 'NULL::text'} AS machine_type_id,
        ${cycleMonthsColumn ? `it.${quoteIdentifier(cycleMonthsColumn)}` : 'NULL::integer'} AS cycle_months,
        ${durationDaysColumn ? `it.${quoteIdentifier(durationDaysColumn)}` : 'NULL::integer'} AS duration_days,
        ${machineNameExpr} AS machine_type_name,
        ${machineCategoryExpr} AS machine_category,
        ${machineManufacturerExpr} AS manufacturer
      FROM ${route.fullPath} it
      ${machineJoin}
      ${whereClause}
      ORDER BY ${displayOrderColumn ? `it.${quoteIdentifier(displayOrderColumn)}` : `it.${quoteIdentifier(idColumn)}`}, it.${quoteIdentifier(idColumn)}
    `;
    const result = await db.query(query, filterMachineTypeId ? [filterMachineTypeId] : []);
    console.log('[GET /api/inspection-types] Success:', result.rows.length);
    res.json({ success: true, data: result.rows, message: '検修種別一覧を取得しました' });
  } catch (err) {
    console.error('❌ Inspection types get error:', err.message);
    console.error('❌ Inspection types get error code:', err.code || 'N/A');
    console.error('❌ Inspection types get error detail:', err.detail || 'N/A');
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別詳細取得
app.get('/api/inspection-types/:id', requireAdmin, async (req, res) => {
  try {
    const typeId = req.params.id;
    const route = await resolveStrictRoutedTablePath('inspection_types');
    const db = getRequestDbPool(req);
    const columns = await getPhysicalTableColumns(route, db);
    const idColumn = columns.has('id') ? 'id' : (columns.has('type_id') ? 'type_id' : null);
    const typeCodeColumn = columns.has('type_code') ? 'type_code' : null;
    const typeNameColumn = columns.has('type_name') ? 'type_name' : (columns.has('inspection_type_name') ? 'inspection_type_name' : (columns.has('name') ? 'name' : null));
    const descriptionColumn = columns.has('description') ? 'description' : null;
    const displayOrderColumn = columns.has('display_order') ? 'display_order' : null;
    const activeColumn = columns.has('is_active') ? 'is_active' : null;

    if (!idColumn || !typeNameColumn) {
      return res.status(500).json({ success: false, message: '検修種別テーブルの列定義が不足しています', error: '検修種別テーブルの列定義が不足しています' });
    }

    const query = `
      SELECT
        ${idColumn}::text AS id,
        ${typeCodeColumn ? `${typeCodeColumn}::text` : 'NULL::text'} AS type_code,
        ${typeNameColumn}::text AS type_name,
        ${descriptionColumn ? `${descriptionColumn}::text` : 'NULL::text'} AS description,
        ${displayOrderColumn ? `${displayOrderColumn}` : '0'} AS display_order,
        ${activeColumn ? `${activeColumn}` : 'true'} AS is_active,
        ${columns.has('machine_type_id') ? 'machine_type_id::text' : 'NULL::text'} AS machine_type_id,
        ${columns.has('cycle_months') ? 'cycle_months' : 'NULL::integer'} AS cycle_months,
        ${columns.has('duration_days') ? 'duration_days' : 'NULL::integer'} AS duration_days
      FROM ${route.fullPath}
      WHERE ${idColumn}::text = $1
      LIMIT 1
    `;
    const result = await db.query(query, [typeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '検修種別が見つかりません', error: '検修種別が見つかりません' });
    }

    res.json({ success: true, data: result.rows[0], message: '検修種別を取得しました' });
  } catch (err) {
    console.error('❌ Inspection type get error:', err.message);
    console.error('❌ Inspection type get error code:', err.code || 'N/A');
    console.error('❌ Inspection type get error detail:', err.detail || 'N/A');
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別追加
app.post('/api/inspection-types', requireAdmin, async (req, res) => {
  try {
    const { machine_type_id, cycle_months, duration_days, type_name, description, display_order, is_active } = req.body;
    const normalizedMachineTypeId = normalizeOptionalId(machine_type_id);
    const normalizedCycleMonths = Number.parseInt(cycle_months, 10);
    const normalizedDurationDays = Number.parseInt(duration_days, 10);

    if (!normalizedMachineTypeId || !type_name
      || !Number.isInteger(normalizedCycleMonths) || normalizedCycleMonths < 1
      || !Number.isInteger(normalizedDurationDays) || normalizedDurationDays < 1) {
      return res.status(400).json({ success: false, message: '機種、種別名、検修周期、検修期間は必須です', error: '機種、種別名、検修周期、検修期間は必須です' });
    }

    const activePool = getRequestDbPool(req);
    const machineType = await getInspectionMachineType(normalizedMachineTypeId, activePool);
    if (!machineType) {
      return res.status(400).json({ success: false, message: '選択した機種が見つかりません', error: '選択した機種が見つかりません' });
    }
    const prefix = getInspectionTypeCodePrefix(machineType.category);
    if (!prefix) {
      return res.status(400).json({ success: false, message: 'カテゴリーは軌道モーターカー、鉄トロ、箱トロ、ホッパー車のいずれかを選択してください', error: 'カテゴリーは軌道モーターカー、鉄トロ、箱トロ、ホッパー車のいずれかを選択してください' });
    }

    const route = await resolveStrictRoutedTablePath('inspection_types');
    const columns = await getPhysicalTableColumns(route, activePool);
    if (!columns.has('machine_type_id') || !columns.has('cycle_months') || !columns.has('duration_days')) {
      return res.status(503).json({ success: false, message: '検修種別の機種別設定にDB更新が必要です', error: '検修種別の機種別設定にDB更新が必要です' });
    }
    const client = await activePool.connect();
    let createdType;
    try {
      await client.query('BEGIN');

      const finalTypeCode = columns.has('type_code')
        ? await generateNextInspectionTypeCode(client, route, prefix)
        : null;

      if (finalTypeCode) {
        const duplicateCheck = await client.query(
          `SELECT 1 FROM ${route.fullPath} WHERE type_code::text = $1 LIMIT 1`,
          [finalTypeCode]
        );
        if (duplicateCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'この種別コードは既に登録されています', error: 'この種別コードは既に登録されています' });
        }
      }

      const insertData = {};
      if (columns.has('type_code')) insertData.type_code = finalTypeCode;
      if (columns.has('machine_type_id')) insertData.machine_type_id = normalizedMachineTypeId;
      if (columns.has('cycle_months')) insertData.cycle_months = normalizedCycleMonths;
      if (columns.has('duration_days')) insertData.duration_days = normalizedDurationDays;
      if (columns.has('type_name')) insertData.type_name = type_name;
      if (columns.has('inspection_type_name')) insertData.inspection_type_name = type_name;
      if (columns.has('name')) insertData.name = type_name;
      if (columns.has('description')) insertData.description = description || null;
      if (columns.has('display_order')) insertData.display_order = display_order ?? 0;
      if (columns.has('is_active')) insertData.is_active = is_active !== undefined ? is_active : true;

      const filteredData = filterDataByColumns(insertData, columns);
      const insertColumns = Object.keys(filteredData);
      const insertValues = Object.values(filteredData);
      const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
      const result = await client.query(
        `INSERT INTO ${route.fullPath} (${insertColumns.map(quoteIdentifier).join(', ')})
         VALUES (${placeholders}) RETURNING *`,
        insertValues
      );
      createdType = result.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => {
        console.error('Inspection type insert rollback error:', rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }
    console.log('[POST /api/inspection-types] Created:', createdType);

    res.status(201).json({ success: true, data: createdType, message: '検修種別を登録しました' });
  } catch (err) {
    console.error('❌ Inspection type create error:', err.message);
    console.error('❌ Inspection type create error code:', err.code || 'N/A');
    console.error('❌ Inspection type create error detail:', err.detail || 'N/A');
    if (err instanceof RangeError) {
      return res.status(409).json({ success: false, message: err.message, error: err.message });
    }
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, message: 'この種別コードは既に登録されています', error: 'この種別コードは既に登録されています' });
    }
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修種別更新
app.put('/api/inspection-types/:id', requireAdmin, async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const typeId = req.params.id;
    const { machine_type_id, cycle_months, duration_days, type_name, description, display_order, is_active } = req.body;
    const normalizedMachineTypeId = normalizeOptionalId(machine_type_id);
    const normalizedCycleMonths = Number.parseInt(cycle_months, 10);
    const normalizedDurationDays = Number.parseInt(duration_days, 10);
    if (!normalizedMachineTypeId || !type_name
      || !Number.isInteger(normalizedCycleMonths) || normalizedCycleMonths < 1
      || !Number.isInteger(normalizedDurationDays) || normalizedDurationDays < 1) {
      return res.status(400).json({ success: false, message: '機種、種別名、検修周期、検修期間は必須です', error: '機種、種別名、検修周期、検修期間は必須です' });
    }

    const db = getRequestDbPool(req);
    const machineType = await getInspectionMachineType(normalizedMachineTypeId, db);
    if (!machineType) {
      return res.status(400).json({ success: false, message: '選択した機種が見つかりません', error: '選択した機種が見つかりません' });
    }
    const prefix = getInspectionTypeCodePrefix(machineType.category);
    if (!prefix) {
      return res.status(400).json({ success: false, message: 'カテゴリーは軌道モーターカー、鉄トロ、箱トロ、ホッパー車のいずれかを選択してください', error: 'カテゴリーは軌道モーターカー、鉄トロ、箱トロ、ホッパー車のいずれかを選択してください' });
    }

    const route = await resolveStrictRoutedTablePath('inspection_types');
    const columns = await getPhysicalTableColumns(route, db);
    const idColumn = columns.has('id') ? 'id' : (columns.has('type_id') ? 'type_id' : null);
    if (!idColumn || !columns.has('machine_type_id') || !columns.has('cycle_months') || !columns.has('duration_days')) {
      return res.status(503).json({ success: false, message: '検修種別の機種別設定にDB更新が必要です', error: '検修種別の機種別設定にDB更新が必要です' });
    }

    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const currentResult = await client.query(
      `SELECT ${quoteIdentifier(idColumn)}::text AS id,
              machine_type_id::text AS machine_type_id,
              ${columns.has('type_code') ? 'type_code::text' : 'NULL::text'} AS type_code
       FROM ${route.fullPath}
       WHERE ${quoteIdentifier(idColumn)}::text = $1
       LIMIT 1`,
      [typeId]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, message: '検修種別が見つかりません', error: '検修種別が見つかりません' });
    }

    const currentMachineTypeId = currentResult.rows[0].machine_type_id;
    const machineTypeChanged = currentMachineTypeId !== normalizedMachineTypeId;
    if (machineTypeChanged) {
      const schedulesRoute = await resolveStrictRoutedTablePath('inspection_schedules');
      const scheduleColumns = await getPhysicalTableColumns(schedulesRoute, db);
      if (scheduleColumns.has('inspection_type_id')) {
        const linkedSchedules = await client.query(
          `SELECT ${scheduleColumns.has('machine_type_id') ? 'machine_type_id::text' : 'NULL::text'} AS machine_type_id,
                  ${scheduleColumns.has('target_category') ? 'target_category::text' : 'NULL::text'} AS target_category
           FROM ${schedulesRoute.fullPath}
           WHERE inspection_type_id::text = $1`,
          [typeId]
        );
        const matchesSelectedMachine = linkedSchedules.rows.every(schedule =>
          schedule.machine_type_id === normalizedMachineTypeId && !schedule.target_category
        );
        if (currentMachineTypeId || !matchesSelectedMachine) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(409).json({
            success: false,
            message: '使用中の検修種別は機種を変更できません。既存設定を削除してから変更してください。',
            error: '使用中の検修種別は機種を変更できません。'
          });
        }
      }
    }

    const finalTypeCode = columns.has('type_code')
      ? (machineTypeChanged
        ? await generateNextInspectionTypeCode(client, route, prefix)
        : currentResult.rows[0].type_code)
      : null;
    const updateData = {};
    if (columns.has('type_code')) updateData.type_code = finalTypeCode;
    updateData.machine_type_id = normalizedMachineTypeId;
    updateData.cycle_months = normalizedCycleMonths;
    updateData.duration_days = normalizedDurationDays;
    if (columns.has('type_name')) updateData.type_name = type_name;
    if (columns.has('inspection_type_name')) updateData.inspection_type_name = type_name;
    if (columns.has('name')) updateData.name = type_name;
    if (columns.has('description')) updateData.description = description || null;
    if (columns.has('display_order')) updateData.display_order = display_order ?? 0;
    if (columns.has('is_active')) updateData.is_active = is_active !== undefined ? is_active : true;

    const filteredData = filterDataByColumns(updateData, columns);
    const updateEntries = Object.entries(filteredData);
    const setClause = updateEntries
      .map(([column], index) => `${quoteIdentifier(column)} = $${index + 1}`)
      .join(', ');
    const result = await client.query(
      `UPDATE ${route.fullPath}
       SET ${setClause}
       WHERE ${quoteIdentifier(idColumn)}::text = $${updateEntries.length + 1}
       RETURNING *`,
      [...updateEntries.map(([, value]) => value), typeId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, message: '検修種別が見つかりません', error: '検修種別が見つかりません' });
    }

    const schedulesRoute = await resolveStrictRoutedTablePath('inspection_schedules');
    const scheduleColumns = await getPhysicalTableColumns(schedulesRoute, db);
    const scheduleUpdates = {};
    if (scheduleColumns.has('cycle_months')) scheduleUpdates.cycle_months = normalizedCycleMonths;
    if (scheduleColumns.has('duration_days')) scheduleUpdates.duration_days = normalizedDurationDays;
    if (scheduleColumns.has('inspection_type_id') && Object.keys(scheduleUpdates).length > 0) {
      const entries = Object.entries(scheduleUpdates);
      await client.query(
        `UPDATE ${schedulesRoute.fullPath}
         SET ${entries.map(([column], index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ')}
         WHERE inspection_type_id::text = $${entries.length + 1}`,
        [...entries.map(([, value]) => value), typeId]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log('[PUT /api/inspection-types] Updated:', result.rows[0]);
    res.json({ success: true, data: result.rows[0], message: '検修種別を更新しました' });
  } catch (err) {
    if (client && transactionStarted) {
      await client.query('ROLLBACK').catch(rollbackError => {
        console.error('Inspection type update rollback error:', rollbackError);
      });
    }
    console.error('❌ Inspection type update error:', err.message);
    console.error('❌ Inspection type update error code:', err.code || 'N/A');
    console.error('❌ Inspection type update error detail:', err.detail || 'N/A');
    if (err instanceof RangeError) {
      return res.status(409).json({ success: false, message: err.message, error: err.message });
    }
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, message: 'この種別コードは既に登録されています', error: 'この種別コードは既に登録されています' });
    }
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  } finally {
    if (client) client.release();
  }
});

// 検修種別削除
app.delete('/api/inspection-types/:id', requireAdmin, async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const typeId = req.params.id;
    const db = getRequestDbPool(req);
    const route = await resolveStrictRoutedTablePath('inspection_types');
    const columns = await getPhysicalTableColumns(route, db);
    const idColumn = columns.has('id') ? 'id' : (columns.has('type_id') ? 'type_id' : null);
    if (!idColumn) {
      return res.status(500).json({ success: false, message: '検修種別テーブルの列定義が不足しています', error: '検修種別テーブルの列定義が不足しています' });
    }

    const schedulesRoute = await resolveStrictRoutedTablePath('inspection_schedules');
    const scheduleColumns = await getPhysicalTableColumns(schedulesRoute, db);

    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    let unlinkedScheduleCount = 0;
    if (scheduleColumns.has('inspection_type_id')) {
      const unlinked = await client.query(
        `UPDATE ${schedulesRoute.fullPath}
         SET inspection_type_id = NULL
         WHERE inspection_type_id::text = $1`,
        [typeId]
      );
      unlinkedScheduleCount = unlinked.rowCount;
    }

    const result = await client.query(
      `DELETE FROM ${route.fullPath}
       WHERE ${quoteIdentifier(idColumn)}::text = $1
       RETURNING ${quoteIdentifier(idColumn)}`,
      [typeId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, message: '検修種別が見つかりません', error: '検修種別が見つかりません' });
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log('[DELETE /api/inspection-types] Deleted:', typeId);
    res.json({
      success: true,
      unlinked_schedule_count: unlinkedScheduleCount,
      message: `検修種別を削除しました。検修周期・期間設定${unlinkedScheduleCount}件は残し、関連付けを解除しました。`
    });
  } catch (err) {
    if (client && transactionStarted) {
      await client.query('ROLLBACK').catch(rollbackError => {
        console.error('Inspection type delete rollback error:', rollbackError);
      });
    }
    console.error('❌ Inspection type delete error:', err.message);
    console.error('❌ Inspection type delete error code:', err.code || 'N/A');
    console.error('❌ Inspection type delete error detail:', err.detail || 'N/A');
    if (err.code === '23503') {
      const message = 'この検修種別は他の業務データで使用中のため削除できません。';
      return res.status(409).json({ success: false, message, error: message });
    }
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  } finally {
    if (client) client.release();
  }
});

// 検修周期・期間設定一覧取得
app.get('/api/inspection-schedules', requireAdmin, async (req, res) => {
  let query = '';
  const params = [];
  let routes = {};
  try {
    console.log('[GET /api/inspection-schedules] Fetching inspection schedules...');
    const db = getRequestDbPool(req);

    const machinesRoute = await resolveStrictRoutedTablePath('machines');
    const machineTypesRoute = await resolveStrictRoutedTablePath('machine_types');
    const officesRoute = await resolveStrictRoutedTablePath('management_offices');
    const inspectionTypesRoute = await resolveStrictRoutedTablePath('inspection_types');
    const inspectionSchedulesRoute = await resolveStrictRoutedTablePath('inspection_schedules');
    const machineTypeColumns = await getPhysicalTableColumns(machineTypesRoute, db);
    const inspectionTypeColumns = await getPhysicalTableColumns(inspectionTypesRoute, db);
    const scheduleColumns = await getPhysicalTableColumns(inspectionSchedulesRoute, db);
    const machineColumns = await getPhysicalTableColumns(machinesRoute, db);
    const hasTargetCategory = scheduleColumns.has('target_category');
    const hasScheduleMachineTypeId = scheduleColumns.has('machine_type_id');
    const hasScheduleMachineId = scheduleColumns.has('machine_id');
    const machineNumberExpr = machineColumns.has('machine_number') ? 'm.machine_number' : 'NULL::text';
    const scheduleMachineIdExpr = hasScheduleMachineId ? 's.machine_id::text' : 'NULL::text';
    const scheduleMachineTypeIdExpr = hasScheduleMachineTypeId ? 's.machine_type_id::text' : 'NULL::text';
    const machineTypeDisplayCodeExpr = machineTypeColumns.has('display_code') ? 'mt.display_code::text' : 'NULL::text';
    const machineOfficeIdExpr = machineColumns.has('office_id')
      ? 'm.office_id::text'
      : (machineColumns.has('management_office_id') ? 'm.management_office_id::text' : 'NULL::text');
    const displayOrderExpr = inspectionTypeColumns.has('display_order') ? 'it.display_order' : null;
    const machineManufacturerExpr = machineTypeColumns.has('manufacturer') ? 'mt.manufacturer::text' : 'NULL::text';
    const machineTypeNameExpr = (() => {
      const candidates = ['model_name', 'machine_type_name', 'type_name', 'name'];
      const available = candidates
        .filter((columnName) => machineTypeColumns.has(columnName))
        .map((columnName) => `NULLIF(mt.${columnName}::text, '')`);

      if (available.length === 0) {
        return 'NULL::text';
      }

      return `COALESCE(${available.join(', ')})`;
    })();

    const machineTypeJoinConditions = [];
    if (hasScheduleMachineTypeId && machineTypeColumns.has('id')) {
      machineTypeJoinConditions.push('s.machine_type_id::text = mt.id::text');
    }
    if (hasScheduleMachineTypeId && hasScheduleMachineId && machineColumns.has('machine_type_id') && machineTypeColumns.has('id')) {
      machineTypeJoinConditions.push('(s.machine_type_id IS NULL AND m.machine_type_id::text = mt.id::text)');
    }
    const machineTypeJoinCondition = machineTypeJoinConditions.length > 0
      ? `(${machineTypeJoinConditions.join(' OR ')})`
      : '1=0';

    query = `
      SELECT 
        s.id,
        ${scheduleMachineIdExpr} AS machine_id,
        ${scheduleMachineTypeIdExpr} AS machine_type_id,
        ${hasTargetCategory ? 's.target_category' : 'NULL::text'} AS target_category,
        s.inspection_type_id::text AS inspection_type_id,
        s.cycle_months,
        s.duration_days,
        s.remarks,
        s.is_active,
        s.created_at,
        s.updated_at,
        ${machineNumberExpr} AS machine_number,
        ${machineTypeDisplayCodeExpr} AS machine_type_display_code,
        ${machineTypeNameExpr} AS model_name,
        ${machineManufacturerExpr} AS manufacturer,
        o.office_name,
        it.type_name,
        it.type_code
      FROM ${inspectionSchedulesRoute.fullPath} s
      LEFT JOIN ${machinesRoute.fullPath} m ON ${hasScheduleMachineId ? 's.machine_id::text = m.id::text' : '1=0'}
      LEFT JOIN ${machineTypesRoute.fullPath} mt ON ${machineTypeJoinCondition}
      LEFT JOIN ${officesRoute.fullPath} o ON ${machineOfficeIdExpr} = o.id::text
      LEFT JOIN ${inspectionTypesRoute.fullPath} it ON s.inspection_type_id::text = it.id::text
      ORDER BY ${hasTargetCategory ? 's.target_category,' : ''} machine_type_display_code, o.office_name, model_name, machine_number${displayOrderExpr ? `, ${displayOrderExpr}` : ''}
    `;

    console.log('[GET /api/inspection-schedules] Executing SQL...');
    routes = {
      machines: machinesRoute.fullPath,
      machineTypes: machineTypesRoute.fullPath,
      offices: officesRoute.fullPath,
      inspectionTypes: inspectionTypesRoute.fullPath,
      inspectionSchedules: inspectionSchedulesRoute.fullPath
    };
    console.log('[GET /api/inspection-schedules] Resolved tables:', routes);
    console.log('[GET /api/inspection-schedules] SQL:', query);
    console.log('[GET /api/inspection-schedules] PARAMS:', params);
    const result = await getRequestDbPool(req).query(query);
    console.log('[GET /api/inspection-schedules] Success:', result.rows.length);

    res.json({ success: true, data: result.rows, message: '検修周期・期間設定一覧を取得しました' });
  } catch (err) {
    console.error('❌ Inspection schedules get error:', err.message);
    console.error('❌ Inspection schedules get error code:', err.code || 'N/A');
    console.error('❌ Inspection schedules get error detail:', err.detail || 'N/A');
    console.error('❌ Inspection schedules SQL:', query);
    console.error('❌ Inspection schedules PARAMS:', params);
    console.error('❌ Inspection schedules tables:', routes);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定詳細取得
app.get('/api/inspection-schedules/:id', requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const schedules = await dynamicSelect('inspection_schedules', { id: scheduleId });

    if (schedules.length === 0) {
      return res.status(404).json({ success: false, message: '検修設定が見つかりません', error: '検修設定が見つかりません' });
    }

    res.json({ success: true, data: schedules[0], message: '検修設定を取得しました' });
  } catch (err) {
    console.error('❌ Inspection schedule get error:', err.message);
    console.error('❌ Inspection schedule get error code:', err.code || 'N/A');
    console.error('❌ Inspection schedule get error detail:', err.detail || 'N/A');
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定追加
app.post('/api/inspection-schedules', requireAdmin, async (req, res) => {
  try {
    const db = getRequestDbPool(req);
    const { machine_type_id, target_category, inspection_type_id, cycle_months, duration_days, remarks, is_active } = req.body;
    const inspectionSchedulesRoute = await resolveStrictRoutedTablePath('inspection_schedules');
    const scheduleColumns = await getPhysicalTableColumns(inspectionSchedulesRoute, db);
    if (!scheduleColumns.has('machine_type_id')) {
      return res.status(503).json({ success: false, message: '検修設定のDB更新が必要です', error: '検修設定のDB更新が必要です' });
    }
    const normalizedMachineTypeId = normalizeOptionalId(machine_type_id);
    const normalizedCycleMonths = Number.parseInt(cycle_months, 10);
    const normalizedDurationDays = Number.parseInt(duration_days, 10);

    if (!normalizedMachineTypeId || !Number.isInteger(normalizedCycleMonths) || normalizedCycleMonths < 1
      || !Number.isInteger(normalizedDurationDays) || normalizedDurationDays < 1) {
      return res.status(400).json({ success: false, message: '機種、検修周期、検修期間を入力してください', error: '機種、検修周期、検修期間を入力してください' });
    }

    const machineType = await getInspectionMachineType(normalizedMachineTypeId, db);
    if (!machineType) {
      return res.status(400).json({ success: false, message: '選択した機種が見つかりません', error: '選択した機種が見つかりません' });
    }

    const duplicateCheck = await db.query(
      `SELECT id FROM ${inspectionSchedulesRoute.fullPath} WHERE machine_type_id::text = $1 LIMIT 1`,
      [normalizedMachineTypeId]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'この機種の検修設定は既に登録されています',
        error: 'この機種の検修設定は既に登録されています'
      });
    }

    const insertData = {
      machine_id: null,
      machine_type_id: normalizedMachineTypeId,
      target_category: null,
      inspection_type_id: normalizeOptionalId(inspection_type_id),
      cycle_months: normalizedCycleMonths,
      duration_days: normalizedDurationDays,
      remarks: remarks || null,
      is_active: is_active !== undefined ? is_active : true
    };

    const result = await dynamicInsert('inspection_schedules', insertData);
    console.log('[POST /api/inspection-schedules] Created:', result);

    res.status(201).json({ success: true, data: result[0], message: '検修設定を登録しました' });
  } catch (err) {
    console.error('❌ Inspection schedule create error:', err.message);
    console.error('❌ Inspection schedule create error code:', err.code || 'N/A');
    console.error('❌ Inspection schedule create error detail:', err.detail || 'N/A');
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, message: 'この機種の検修設定は既に登録されています', error: 'この機種の検修設定は既に登録されています' });
    }
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定更新
app.put('/api/inspection-schedules/:id', requireAdmin, async (req, res) => {
  try {
    const db = getRequestDbPool(req);
    const scheduleId = req.params.id;
    const { machine_type_id, target_category, inspection_type_id, cycle_months, duration_days, remarks, is_active } = req.body;
    const inspectionSchedulesRoute = await resolveStrictRoutedTablePath('inspection_schedules');
    const scheduleColumns = await getPhysicalTableColumns(inspectionSchedulesRoute, db);
    if (!scheduleColumns.has('machine_type_id')) {
      return res.status(503).json({ success: false, message: '検修設定のDB更新が必要です', error: '検修設定のDB更新が必要です' });
    }
    const normalizedMachineTypeId = normalizeOptionalId(machine_type_id);
    const normalizedCycleMonths = Number.parseInt(cycle_months, 10);
    const normalizedDurationDays = Number.parseInt(duration_days, 10);

    if (!normalizedMachineTypeId || !Number.isInteger(normalizedCycleMonths) || normalizedCycleMonths < 1
      || !Number.isInteger(normalizedDurationDays) || normalizedDurationDays < 1) {
      return res.status(400).json({ success: false, message: '機種、検修周期、検修期間を入力してください', error: '機種、検修周期、検修期間を入力してください' });
    }

    const machineType = await getInspectionMachineType(normalizedMachineTypeId, db);
    if (!machineType) {
      return res.status(400).json({ success: false, message: '選択した機種が見つかりません', error: '選択した機種が見つかりません' });
    }

    const duplicateCheck = await db.query(
      `SELECT id FROM ${inspectionSchedulesRoute.fullPath} WHERE machine_type_id::text = $1 AND id::text <> $2 LIMIT 1`,
      [normalizedMachineTypeId, scheduleId]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'この機種の検修設定は既に登録されています',
        error: 'この機種の検修設定は既に登録されています'
      });
    }

    const updateData = {
      machine_type_id: normalizedMachineTypeId,
      target_category: null,
      cycle_months: normalizedCycleMonths,
      duration_days: normalizedDurationDays,
      is_active: is_active !== undefined ? is_active : true
    };
    if (inspection_type_id !== undefined) {
      updateData.inspection_type_id = normalizeOptionalId(inspection_type_id);
    }
    if (remarks !== undefined) {
      updateData.remarks = remarks || null;
    }

    const result = await dynamicUpdate('inspection_schedules', updateData, { id: scheduleId }, true);

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: '検修設定が見つかりません', error: '検修設定が見つかりません' });
    }

    console.log('[PUT /api/inspection-schedules] Updated:', result[0]);
    res.json({ success: true, data: result[0], message: '検修設定を更新しました' });
  } catch (err) {
    console.error('❌ Inspection schedule update error:', err.message);
    console.error('❌ Inspection schedule update error code:', err.code || 'N/A');
    console.error('❌ Inspection schedule update error detail:', err.detail || 'N/A');
    if (err.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, message: 'この機種の検修設定は既に登録されています', error: 'この機種の検修設定は既に登録されています' });
    }
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
  }
});

// 検修周期・期間設定削除
app.delete('/api/inspection-schedules/:id', requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const result = await dynamicDelete('inspection_schedules', { id: scheduleId }, true, req);

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: '検修設定が見つかりません', error: '検修設定が見つかりません' });
    }

    console.log('[DELETE /api/inspection-schedules] Deleted:', scheduleId);
    res.json({ success: true, message: '検修設定を削除しました' });
  } catch (err) {
    console.error('❌ Inspection schedule delete error:', err.message);
    console.error('❌ Inspection schedule delete error code:', err.code || 'N/A');
    console.error('❌ Inspection schedule delete error detail:', err.detail || 'N/A');
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました', error: 'サーバーエラーが発生しました' });
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

// ========================================
// 登録デバイス管理 API (マルチテナント分離・証明書検証・監査ログ)
// ========================================

function getRequestTenantId(req) {
  const t = req.user?.tenant_id || req.user?.tenantId || req.tenantId || req.session?.tenant_id || req.session?.tenant_key || '';
  return String(t).trim().toLowerCase() || 'demo';
}

async function getAvailableTenantsList() {
  try {
    const cpPool = getControlPlanePool();
    const res = await cpPool.query(`
      SELECT id::text AS id, tenant_key, tenant_name
      FROM public.tenants
      WHERE is_active = true
      ORDER BY CASE tenant_key WHEN 'daitetsu' THEN 1 WHEN 'kosei' THEN 2 WHEN 'kintetsu' THEN 3 ELSE 4 END
    `);
    return res.rows;
  } catch (err) {
    console.error('[Security API] Failed to fetch available tenants:', err.message);
    return [];
  }
}

async function resolveDeviceTenantForAdmin(req, deviceId) {
  let tenantId = getRequestTenantId(req);
  if (isSuperAdminUser(req)) {
    try {
      const devRes = await getControlPlanePool().query(
        'SELECT tenant_id FROM public.devices WHERE id = $1 LIMIT 1',
        [deviceId]
      );
      if (devRes.rows[0]?.tenant_id) {
        tenantId = devRes.rows[0].tenant_id;
      }
    } catch (_) {}
  }
  return tenantId;
}

// 登録デバイス一覧・サマリー取得 (自テナント限定・サーバー側ページング/検索、niinaのみ全テナント切替可)
app.get('/api/security/devices', requireAdmin, async (req, res) => {
  try {
    const isSuper = isSuperAdminUser(req);
    let tenantId = getRequestTenantId(req);
    let availableTenants = [];
    if (isSuper) {
      availableTenants = await getAvailableTenantsList();
      if (req.query.tenantId) {
        const requestedTenant = String(req.query.tenantId).trim().toLowerCase();
        if (availableTenants.some(t => t.tenant_key === requestedTenant)) {
          tenantId = requestedTenant;
        }
      }
    }

    const { search, status, page, limit } = req.query;
    const result = await deviceManagement.listDevices(getControlPlanePool(), {
      tenantId,
      search,
      status,
      page,
      limit
    });

    result.canSwitchTenant = isSuper;
    result.availableTenants = availableTenants;
    result.currentTenantId = tenantId;

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

// 証明書の事前安全検証 (公開証明書のみ・CA署名・有効期限・Fingerprint算出)
app.post('/api/security/devices/verify-cert', requireAdmin, async (req, res) => {
  try {
    const { certificate, excludeCertId } = req.body;
    const result = await deviceManagement.validateCertificate(certificate, getControlPlanePool(), excludeCertId);
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error verifying cert:', error);
    res.status(500).json({ ok: false, error: error.message, message: '証明書検証処理でエラーが発生しました' });
  }
});

// デバイス詳細取得 (自テナント検証・証明書全履歴付き、niinaは他テナントも可)
app.get('/api/security/devices/:id', requireAdmin, async (req, res) => {
  try {
    const tenantId = await resolveDeviceTenantForAdmin(req, req.params.id);
    const result = await deviceManagement.getDeviceById(getControlPlanePool(), {
      deviceId: req.params.id,
      tenantId
    });
    if (!result.ok) {
      return res.status(result.code === 'DEVICE_NOT_FOUND' ? 404 : 400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error getting device detail:', error);
    res.status(500).json({ ok: false, error: error.message, message: 'デバイス詳細の取得に失敗しました' });
  }
});

// 新規デバイス登録 (niinaは対象テナント指定可)
app.post('/api/security/devices', requireAdmin, async (req, res) => {
  try {
    const isSuper = isSuperAdminUser(req);
    let tenantId = getRequestTenantId(req);
    const { deviceName, deviceIdentifier, certificate, targetTenantId } = req.body;
    if (isSuper && targetTenantId) {
      tenantId = String(targetTenantId).trim().toLowerCase();
    }
    const adminUser = req.user?.username || req.session?.username || 'admin';

    // 証明書ファイルが未指定の場合、プロジェクト内のテナント固定証明書を自動適用
    let certToUse = certificate;
    if (!certToUse || !String(certToUse).trim()) {
      const fs = require('fs');
      const candidatePaths = [
        path.join(__dirname, '..', 'gateway', 'certs', `client_${tenantId}.crt`),
        path.join(__dirname, '..', 'gateway', 'certs', 'client_daitetsu.crt')
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          certToUse = fs.readFileSync(p, 'utf8');
          console.log(`[Security API] Automatically applied tenant cert for "${tenantId}" from: ${p}`);
          break;
        }
      }
    }

    const result = await deviceManagement.createDevice(getControlPlanePool(), {
      tenantId,
      deviceName,
      deviceIdentifier,
      certInput: certToUse,
      adminUser,
      req
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    console.error('[Security API] Error creating device:', error);
    res.status(500).json({ ok: false, error: error.message, message: '新規デバイス登録に失敗しました' });
  }
});

// デバイス編集 (デバイス名のみ変更可能)
app.patch('/api/security/devices/:id', requireAdmin, async (req, res) => {
  try {
    const tenantId = await resolveDeviceTenantForAdmin(req, req.params.id);
    const { deviceName } = req.body;
    const adminUser = req.user?.username || req.session?.username || 'admin';

    const result = await deviceManagement.updateDevice(getControlPlanePool(), {
      deviceId: req.params.id,
      tenantId,
      deviceName,
      adminUser,
      req
    });

    if (!result.ok) {
      return res.status(result.code === 'DEVICE_NOT_FOUND' ? 404 : 400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error updating device:', error);
    res.status(500).json({ ok: false, error: error.message, message: 'デバイス情報の更新に失敗しました' });
  }
});

// 証明書更新
app.post('/api/security/devices/:id/certificates', requireAdmin, async (req, res) => {
  try {
    const tenantId = await resolveDeviceTenantForAdmin(req, req.params.id);
    const { certificate } = req.body;
    const adminUser = req.user?.username || req.session?.username || 'admin';

    const result = await deviceManagement.rotateCertificate(getControlPlanePool(), {
      deviceId: req.params.id,
      tenantId,
      newCertInput: certificate,
      adminUser,
      req
    });

    if (!result.ok) {
      return res.status(result.code === 'DEVICE_NOT_FOUND' ? 404 : 400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error rotating certificate:', error);
    res.status(500).json({ ok: false, error: error.message, message: '証明書更新に失敗しました' });
  }
});

// デバイス停止 (一時停止・二重確認・理由必須)
app.post('/api/security/devices/:id/disable', requireAdmin, async (req, res) => {
  try {
    const tenantId = await resolveDeviceTenantForAdmin(req, req.params.id);
    const { reason } = req.body;
    const adminUser = req.user?.username || req.session?.username || 'admin';

    const result = await deviceManagement.disableDevice(getControlPlanePool(), {
      deviceId: req.params.id,
      tenantId,
      reason,
      adminUser,
      req
    });

    if (!result.ok) {
      return res.status(result.code === 'DEVICE_NOT_FOUND' ? 404 : 400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error disabling device:', error);
    res.status(500).json({ ok: false, error: error.message, message: '端末の停止に失敗しました' });
  }
});

// デバイス再有効化 (停止解除)
app.post('/api/security/devices/:id/enable', requireAdmin, async (req, res) => {
  try {
    const tenantId = await resolveDeviceTenantForAdmin(req, req.params.id);
    const { reason } = req.body;
    const adminUser = req.user?.username || req.session?.username || 'admin';

    const result = await deviceManagement.enableDevice(getControlPlanePool(), {
      deviceId: req.params.id,
      tenantId,
      reason,
      adminUser,
      req
    });

    if (!result.ok) {
      return res.status(result.code === 'DEVICE_NOT_FOUND' ? 404 : 400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error enabling device:', error);
    res.status(500).json({ ok: false, error: error.message, message: '端末の再有効化に失敗しました' });
  }
});

// 証明書失効
app.post('/api/security/devices/:id/revoke-cert', requireAdmin, async (req, res) => {
  try {
    const tenantId = await resolveDeviceTenantForAdmin(req, req.params.id);
    const { certId, reason } = req.body;
    const adminUser = req.user?.username || req.session?.username || 'admin';

    const result = await deviceManagement.revokeDeviceCertificate(getControlPlanePool(), {
      deviceId: req.params.id,
      tenantId,
      certId,
      reason,
      adminUser,
      req
    });

    if (!result.ok) {
      return res.status(result.code === 'CERT_NOT_FOUND' ? 404 : 400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error revoking certificate:', error);
    res.status(500).json({ ok: false, error: error.message, message: '証明書失効処理に失敗しました' });
  }
});

// システムエラーログ・自動解析一覧取得
app.get('/api/system/error-logs', requireSystemAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const result = await securityMonitor.getErrorLogsAndAnalysis({ limit });
    res.json(result);
  } catch (error) {
    console.error('[Security API] Error getting error logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'エラーログおよび自動解析結果の取得に失敗しました'
    });
  }
});

// 現在のアクティブな遮断一覧取得
app.get('/api/security/blocks', requireAdmin, (req, res) => {
  const blocks = securityGuard.getActiveBlocks();
  res.json({ success: true, data: blocks, requestId: req.requestId || req.headers['x-request-id'] || null });
});

// 手動遮断
app.post('/api/security/block', requireAdmin, async (req, res) => {
  const { target, durationMinutes, reason } = req.body;
  const requestId = req.requestId || req.headers['x-request-id'] || null;
  const blockedBy = req.user?.username || 'admin';

  if (!target) {
    return res.status(400).json({ success: false, message: '遮断対象を指定してください', requestId });
  }

  const result = securityGuard.manualBlock({
    target,
    durationMinutes: Number(durationMinutes) || 60,
    reason: reason || '管理者による手動遮断',
    blockedBy,
    requestId
  });

  res.json({ success: true, ...result, requestId });
});

// 手動解除
app.post('/api/security/unblock', requireAdmin, async (req, res) => {
  const { target, reason } = req.body;
  const requestId = req.requestId || req.headers['x-request-id'] || null;
  const unblockedBy = req.user?.username || 'admin';

  if (!target) {
    return res.status(400).json({ success: false, message: '解除対象を指定してください', requestId });
  }

  const result = securityGuard.manualUnblock({
    target,
    unblockedBy,
    reason: reason || '管理者による手動解除',
    requestId
  });

  res.json({ success: true, ...result, requestId });
});

// 端末証明書の停止（失効）
app.post('/api/security/revoke-certificate', requireAdmin, async (req, res) => {
  const { fingerprint256, serialNumber, reason } = req.body;
  const requestId = req.requestId || req.headers['x-request-id'] || null;
  const adminUser = req.user?.username || 'admin';

  if (!fingerprint256 && !serialNumber) {
    return res.status(400).json({ success: false, message: 'fingerprint256 または serialNumber を指定してください', requestId });
  }

  const cpPool = getControlPlanePool();
  let client;
  try {
    client = await cpPool.connect();
    await client.query('BEGIN');

    const updateRes = await client.query(`
      UPDATE public.device_certificates
      SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE (fingerprint256 = $1 OR serial_number = $2) AND is_revoked = false
      RETURNING id, serial_number, fingerprint256
    `, [fingerprint256 || null, serialNumber || null]);

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '対象の有効な証明書が見つかりませんでした', requestId });
    }

    const row = updateRes.rows[0];

    // 同期監査ログ (Fail-Closed)
    const auditRes = logger.writeAuditLogSync({
      req,
      severity: 'WARNING',
      eventType: 'cert_revoked_by_admin',
      message: `管理者(${adminUser})が端末証明書を停止しました: serial='${row.serial_number}', reason='${reason || 'none'}'`,
      details: {
        action: 'revoke_certificate',
        serialNumber: row.serial_number,
        fingerprint256: row.fingerprint256,
        reason: reason || '管理者による手動失効'
      }
    });

    if (!auditRes.ok) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, code: 'AUDIT_LOG_FAILED', message: '監査ログの保存に失敗したため証明書停止を取り消しました', requestId });
    }

    try {
      await client.query('COMMIT');
    } catch (commitErr) {
      logger.writeLog({
        severity: 'CRITICAL',
        eventType: 'transaction_commit_unknown',
        requestId,
        message: `DB COMMIT実行時にエラーが発生しました。状態はUNKNOWN（不明）です。DBの照合確認が必要です: ${commitErr.message}`,
        details: {
          action: 'revoke_certificate',
          transactionStatus: 'UNKNOWN',
          requiresManualCheck: true,
          serialNumber: row.serial_number,
          error: commitErr.message
        }
      });
      return res.status(500).json({
        success: false,
        code: 'TRANSACTION_COMMIT_UNKNOWN',
        message: 'コミット結果の確定に失敗しました。状態確認が必要です。',
        requestId
      });
    }

    res.json({ success: true, message: '証明書を停止しました', certificate: row, requestId });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    res.status(500).json({ success: false, error: err.message, requestId });
  } finally {
    if (client) client.release();
  }
});

// 端末証明書の停止解除（再有効化）
app.post('/api/security/unrevoke-certificate', requireAdmin, async (req, res) => {
  const { fingerprint256, serialNumber, reason } = req.body;
  const requestId = req.requestId || req.headers['x-request-id'] || null;
  const adminUser = req.user?.username || 'admin';

  if (!fingerprint256 && !serialNumber) {
    return res.status(400).json({ success: false, message: 'fingerprint256 または serialNumber を指定してください', requestId });
  }

  const cpPool = getControlPlanePool();
  let client;
  try {
    client = await cpPool.connect();
    await client.query('BEGIN');

    const updateRes = await client.query(`
      UPDATE public.device_certificates
      SET is_revoked = false, revoked_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE (fingerprint256 = $1 OR serial_number = $2) AND is_revoked = true
      RETURNING id, serial_number, fingerprint256
    `, [fingerprint256 || null, serialNumber || null]);

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '対象の停止中証明書が見つかりませんでした', requestId });
    }

    const row = updateRes.rows[0];

    // 同期監査ログ (Fail-Closed)
    const auditRes = logger.writeAuditLogSync({
      req,
      severity: 'INFO',
      eventType: 'cert_unrevoked_by_admin',
      message: `管理者(${adminUser})が端末証明書の停止を解除しました: serial='${row.serial_number}', reason='${reason || 'none'}'`,
      details: {
        action: 'unrevoke_certificate',
        serialNumber: row.serial_number,
        fingerprint256: row.fingerprint256,
        reason: reason || '管理者による停止解除'
      }
    });

    if (!auditRes.ok) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, code: 'AUDIT_LOG_FAILED', message: '監査ログの保存に失敗したため停止解除を取り消しました', requestId });
    }

    try {
      await client.query('COMMIT');
    } catch (commitErr) {
      logger.writeLog({
        severity: 'CRITICAL',
        eventType: 'transaction_commit_unknown',
        requestId,
        message: `DB COMMIT実行時にエラーが発生しました。状態はUNKNOWN（不明）です。DBの照合確認が必要です: ${commitErr.message}`,
        details: {
          action: 'unrevoke_certificate',
          transactionStatus: 'UNKNOWN',
          requiresManualCheck: true,
          serialNumber: row.serial_number,
          error: commitErr.message
        }
      });
      return res.status(500).json({
        success: false,
        code: 'TRANSACTION_COMMIT_UNKNOWN',
        message: 'コミット結果の確定に失敗しました。状態確認が必要です。',
        requestId
      });
    }

    res.json({ success: true, message: '証明書の停止を解除しました', certificate: row, requestId });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    res.status(500).json({ success: false, error: err.message, requestId });
  } finally {
    if (client) client.release();
  }
});

// JWTトークンの即時失効
app.post('/api/security/revoke-token', requireAdmin, async (req, res) => {
  const { token, reason, userId, tenantId } = req.body;
  const requestId = req.requestId || req.headers['x-request-id'] || null;
  const targetToken = token || commonAuth.extractToken(req);

  if (!targetToken) {
    return res.status(400).json({ success: false, message: '失効対象のトークンが指定されていません', requestId });
  }

  const cpPool = getControlPlanePool();
  const result = await tokenRevocation.revokeToken({
    token: targetToken,
    userId: userId || null,
    tenantId: tenantId || null,
    reason: reason || '管理者によるトークン失効',
    revokedBy: req.user?.username || 'admin',
    pool: cpPool
  });

  if (!result.ok) {
    return res.status(500).json({ success: false, message: 'トークンの失効処理に失敗しました', error: result.error?.message, requestId });
  }

  logger.writeAuditRecord({
    severity: 'WARNING',
    eventType: 'token_revoked_by_admin',
    requestId,
    userId: req.user?.username || 'admin',
    message: `管理者(${req.user?.username || 'admin'})がトークンを即時失効させました (reason='${reason || 'none'}')`,
    details: { reason: reason || '管理者によるトークン失効', targetUserId: userId }
  });

  res.json({ success: true, message: 'トークンを即時失効させました', requestId });
});

// 一時ファイル事前サマリー取得（Dry Run）
app.get('/api/maintenance/temp-files-summary', requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    const result = await maintenanceTasks.getTempFilesSummary({ tenantId });
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error getting temp files summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '一時ファイルサマリーの取得に失敗しました'
    });
  }
});

// 一時ファイル安全削除（要二重確認・監査ログ記録）
app.post('/api/maintenance/clean-temp', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Cleaning temp files with safe guards...');
    const confirmExecution = req.body?.confirmExecution === true;
    const result = await maintenanceTasks.cleanTempFiles({
      pool: getControlPlanePool(),
      user: req.user,
      tenantId: req.user?.tenantId || null,
      confirmExecution
    });
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

// 孤立画像候補検出（Dry Run 専用）
app.post('/api/maintenance/clean-orphaned-images', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Scanning orphaned images (Dry Run)...');
    const result = await maintenanceTasks.cleanOrphanedImages(getControlPlanePool());
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error scanning orphaned images:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '孤立画像候補の検出に失敗しました'
    });
  }
});

// モジュール更新ステータス取得
app.get('/api/maintenance/npm-audit', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Checking version & update status...');
    const result = await maintenanceTasks.checkNpmAudit();
    res.json(result);
  } catch (error) {
    console.error('[Maintenance API] Error checking update status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '更新ステータスの取得に失敗しました'
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

// 証明書・期限ステータス取得
app.get('/api/maintenance/certificate-status', requireSystemAdmin, async (req, res) => {
  try {
    console.log('[Maintenance API] Getting certificate status from DB...');
    const result = await maintenanceTasks.getCertificateStatus(getControlPlanePool());
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
  console.log('✅ JWT_SECRET is configured');
} else {
  console.error('⚠️ JWT_SECRET is NOT set!');
}

// --- データベース自動修正機能 (廃止: 共通DBの最小化に伴い自動修復処理を除去) ---
async function runEmergencyDbFix() {
  // Deprecated: No-op. Minimal common_db does not self-heal or alter business tables.
}

/**
 * テナント DB のスキーマ初期化（password カラムが存在するか確認・追加）
 */
async function initializeTenantSchemas() {
  console.log('[Schema] Initializing tenant DB schemas...');

  // 共通DBの tenant_app_routings からアクティブなテナント情報を動的にクエリして初期化
  let tenants = [];
  try {
    const routingRows = await getAllCompanyRoutingRows();
    tenants = routingRows.map(row => ({
      id: row.tenant_key || row.company_id,
      dbName: row.dbName || 'unknown'
    })).filter(t => t.id && t.id !== 'demo_env');
  } catch (err) {
    console.warn('[Schema] Failed to query dynamic tenants:', err.message);
    tenants = [];
  }

  for (const tenant of tenants) {
    try {
      const runtime = await resolveTenantRuntime(tenant.id);

      // tenantContext 内で password カラム確認 → 追加
      await requestTenantContextStorage.run(runtime, async () => {
        const checkRes = await pool.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password'
        `);

        if (checkRes.rows.length === 0) {
          console.log(`[Schema] Adding password column to ${tenant.dbName || tenant.id}.users...`);
          await pool.query(`
            ALTER TABLE public.users 
            ADD COLUMN password VARCHAR(255) DEFAULT NULL
          `);
          console.log(`[Schema] ✅ password column added to ${tenant.dbName || tenant.id}.users`);
        } else {
          console.log(`[Schema] ✅ password column already exists in ${tenant.dbName || tenant.id}.users`);
        }
      });
    } catch (err) {
      console.error(`[Schema] ⚠️ Failed to initialize ${tenant.dbName || tenant.id}: ${err.message}`);
    }
  }

  console.log('[Schema] Tenant schema initialization completed.');
}

// Express グローバルエラーハンドラ
// 利用者向けには内部スタックトレースやDB情報を隠蔽し、一般化メッセージと問い合わせ用エラーIDを返却する。
// 管理者ログには原因を記録するが、パスワード・トークン・秘密鍵・接続文字列はマスキングする。
app.use((err, req, res, next) => {
  const errorId = crypto.randomUUID ? crypto.randomUUID() : `err-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const sanitizedMsg = String(err && err.message ? err.message : err)
    .replace(/(password|token|secret|key)=[^&]+/gi, '$1=***')
    .replace(/postgres(ql)?:\/\/[^@]+@/gi, 'postgresql://***:***@');
  console.error(`[AppError][${errorId}]`, sanitizedMsg);

  if (res.headersSent) {
    return next(err);
  }

  const status = Number(err.status || err.statusCode) || 500;
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'システムエラーが発生しました。システム管理者にお問い合わせください。' : (err.message || 'エラーが発生しました'),
    error_id: errorId
  });
});



/**
 * 全テナントのユーザーデータ初期化
 * （安全のため、既存DBのユーザーやパスワードを一切上書き・復元しない）
 */
async function initializeAllTenantUsers() {
  console.log('[TenantInit] Checking user tables for existing tenants...');

  let tenantDefaults = [];
  try {
    const routingRows = await getAllCompanyRoutingRows();
    tenantDefaults = routingRows.map(row => ({
      id: row.tenant_key || row.company_id,
      dbName: row.dbName || `${row.tenant_key || row.company_id}_db`
    })).filter(t => t.id && t.id !== 'demo_env');
  } catch (err) {
    console.warn('[TenantInit] Failed to query dynamic tenants:', err.message);
    return;
  }

  for (const tenant of tenantDefaults) {
    try {
      const runtime = await resolveTenantRuntime(tenant.id);
      await requestTenantContextStorage.run(runtime, async () => {
        const activePool = getActiveDbPool();

        // パスワード未設定のユーザーが存在する場合のみログで警告する（上書き・初期化は行わない）
        const nullUsers = await activePool.query(
          `SELECT username FROM public.users WHERE password IS NULL AND password_hash IS NULL`
        );
        if (nullUsers.rows.length > 0) {
          console.warn(`[TenantInit] ⚠️ Warning: Found users with NULL passwords in ${tenant.dbName}:`, nullUsers.rows.map(u => u.username));
        } else {
          console.log(`[TenantInit] ✅ User authentication data verified for ${tenant.dbName}`);
        }
      });
    } catch (err) {
      console.error(`[TenantInit] ⚠️ Verification skipped for ${tenant.dbName}: ${err.message}`);
    }
  }
}

// --- サーバー起動 ---
async function startServer() {
  if (serverInstance) {
    console.log('⚠️ Server already running');
    return;
  }

  console.log(`📡 Starting server on port ${PORT}...`);
  console.log(`📡 Binding to 0.0.0.0:${PORT} to accept external connections`);

  // Verify common and active tenant migration state before accepting API traffic.
  try {
    await initializeDatabase();
    await testDatabaseConnection();
  } catch (err) {
    console.error('❌ Database pre-initialization failed (fatal):', err.message);
    process.exit(1);
  }

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
    console.log(`🔍 Ready check: http://0.0.0.0:${PORT}/ready`);
    console.log(`🏠 Home page: http://0.0.0.0:${PORT}/`);
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

  server.on('listening', () => {
    const addr = server.address();
    console.log(`✅ Server is now listening on ${addr.address}:${addr.port}`);
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
    
    // 1. 共通DBのマイグレーション検証（必須基盤）
    await databaseMigrations.assertApplied(pool, 'common');
    
    const routes = await pool.query(`
      SELECT t.tenant_key,
             t.tenant_name,
             r.database_key,
             (COALESCE(r.database_key, t.tenant_key) || '_db') as db_name,
             NULL as database_url,
             NULL as storage_bucket_name,
             ('/' || t.tenant_key) as tenant_path,
             t.tenant_name as app_name
      FROM public.tenants t
      JOIN public.tenant_db_routing r ON r.tenant_id = t.id AND r.is_active = true
      WHERE t.is_active = true
      ORDER BY t.tenant_key
    `);
    if (routes.rowCount === 0) {
      throw new Error('No active tenant database routes are configured. Register a tenant with "npm run db:register-tenant".');
    }

    // 2. 各テナントDBの検証（個別テナントの障害で正常な他社テナントを一律停止させない）
    let healthyCount = 0;
    for (const route of routes.rows) {
      try {
        const runtime = buildTenantRuntimeFromRoutingRow(
          { ...route, company_id: route.tenant_key, company_name: route.tenant_name || route.app_name },
          route.tenant_key,
          getDefaultDbName(),
          getDefaultBucketName(),
          route.tenant_key
        );
        await databaseMigrations.assertApplied(runtime.pool, 'tenant');
        tenantHealthMap.set(route.tenant_key, { healthy: true });
        healthyCount++;
        console.log(`✅ Tenant database verified for "${route.tenant_key}".`);
      } catch (tErr) {
        tenantHealthMap.set(route.tenant_key, { healthy: false, error: tErr.message });
        console.warn(`⚠️ Tenant database verification failed for "${route.tenant_key}": ${tErr.message}`);
      }
    }

    if (healthyCount > 0) {
      dbReady = true;
      console.log(`✅ Database ready. Common DB verified and ${healthyCount}/${routes.rowCount} tenant route(s) healthy.`);
      return true;
    } else {
      throw new Error('All configured tenant databases failed verification.');
    }
  } catch (err) {
    dbReady = false;
    console.error('❌ Database initialization failed:', err.message);
    console.error('⚠️ Database writes are disabled until the required migrations are applied and verified.');
    return false;
  }
}

// --- サーバー起動 ---
// すべてのルート定義とpoolの初期化が完了した後にサーバーを起動
console.log('🔧 All routes and middleware configured. Starting server...');
startServer().catch(err => {
  console.error('❌ Fatal error during server startup:', err);
  process.exit(1);
});
