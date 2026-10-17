const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'dashboard_session';
const JWT_ISSUER = process.env.JWT_ISSUER || 'dashboard-auth';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'dashboard-apps';
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS) || 4 * 60 * 60 * 1000;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured');
  }
  return process.env.JWT_SECRET;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS
  };
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, value) => {
    const separator = value.indexOf('=');
    if (separator > 0) {
      cookies[value.slice(0, separator).trim()] = decodeURIComponent(value.slice(separator + 1).trim());
    }
    return cookies;
  }, {});
}

function issueSession(res, session) {
  const sessionJti = crypto.randomUUID ? crypto.randomUUID() : `dash-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  const claims = {
    sub: String(session.userId),
    username: session.username ? String(session.username) : undefined,
    tenant_id: String(session.tenantId),
    tenant_key: String(session.tenantKey || session.tenantId || ''),
    auth_source: String(session.authSource || 'common'),
    role: String(session.role),
    permissions: Array.isArray(session.permissions) ? session.permissions : [],
    iat_ms: Date.now()
  };
  if (session.user_gen != null || session.userGen != null) {
    claims.user_gen = Number(session.user_gen ?? session.userGen);
  }
  if (session.tenant_gen != null || session.tenantGen != null) {
    claims.tenant_gen = Number(session.tenant_gen ?? session.tenantGen);
  }

  const token = jwt.sign(claims, getJwtSecret(), {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: Math.floor(SESSION_MAX_AGE_MS / 1000),
    jwtid: sessionJti
  });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return token;
}

function extractToken(req) {
  let token = parseCookies(req.headers?.cookie)[COOKIE_NAME];
  if (!token && req.headers?.authorization && /^Bearer\s+/i.test(req.headers.authorization)) {
    token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
  }
  return token || null;
}

function readSession(req) {
  const token = extractToken(req);
  if (!token) return null;
  return jwt.verify(token, getJwtSecret(), { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

async function getTenantUserAccess(tenantPool, username) {
  const result = await tenantPool.query(`
    SELECT
      u.id AS user_id,
      u.username,
      u.password_hash,
      u.display_name,
      COALESCE(r.code, u.role, 'operator') AS role_key,
      o.id AS org_id,
      o.code AS org_code,
      o.name AS org_name,
      s.id AS site_id,
      s.name AS site_name,
      COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.id IS NOT NULL), '{}') AS permissions
    FROM public.users u
    LEFT JOIN public.user_org_memberships uom ON uom.user_id = u.id
    LEFT JOIN public.organizations o ON o.id = uom.org_id
    LEFT JOIN public.sites s ON s.id = uom.site_id
    LEFT JOIN public.user_role_assignments ura ON ura.user_id = u.id
    LEFT JOIN public.roles r ON r.id = ura.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    WHERE u.username = $1 AND u.is_active = true
    GROUP BY u.id, r.id, o.id, s.id
    LIMIT 1
  `, [username]);
  return result.rows[0] || null;
}

// 非推奨（下位互換用、新規コードでは使用しない）
async function getUserAccess(pool, username, tenantKey) {
  const result = await pool.query(`
    SELECT
      u.id AS user_id,
      u.username,
      u.password_hash,
      u.display_name,
      u.email,
      t.id AS tenant_id,
      t.tenant_key,
      t.tenant_name,
      r.role_key,
      COALESCE(array_agg(DISTINCT p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
    FROM public.users u
    JOIN public.user_tenants ut ON ut.user_id = u.id AND ut.is_active = true
    JOIN public.tenants t ON t.id = ut.tenant_id AND t.is_active = true
    JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = t.id
    JOIN public.roles r ON r.id = ur.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    WHERE u.username = $1 AND t.tenant_key = $2 AND u.is_active = true
    GROUP BY u.id, t.id, r.id
    ORDER BY r.role_key
    LIMIT 1
  `, [username, tenantKey]);
  return result.rows[0] || null;
}

async function getEnabledApps(pool, tenantId, role) {
  const result = await pool.query(`
    SELECT a.app_key, a.app_name, a.app_url, a.icon, a.category, a.display_order, a.description
    FROM public.tenant_applications ta
    JOIN public.applications a ON a.id = ta.application_id AND a.is_active = true
    WHERE ta.tenant_id = $1
      AND ta.is_enabled = true
      AND ta.is_visible = true
      AND (ta.required_role IS NULL OR ta.required_role = '' OR ta.required_role = $2)
    ORDER BY a.display_order, a.app_key
  `, [tenantId, role]);
  return result.rows;
}

async function canTenantUseApp(pool, tenantId, appKey, role) {
  const result = await pool.query(`
    SELECT 1
    FROM public.tenant_applications tenant_application
    JOIN public.applications application ON application.id = tenant_application.application_id AND application.is_active = true
    WHERE tenant_application.tenant_id = $1
      AND application.app_key = $2
      AND tenant_application.is_enabled = true
      AND (tenant_application.required_role IS NULL OR tenant_application.required_role = '' OR tenant_application.required_role = $3)
    LIMIT 1
  `, [tenantId, appKey, role]);
  return result.rowCount === 1;
}

module.exports = {
  COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  clearSession,
  canTenantUseApp,
  getEnabledApps,
  getUserAccess,
  getTenantUserAccess,
  issueSession,
  readSession,
  extractToken
};