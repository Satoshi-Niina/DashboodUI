const crypto = require('crypto');

function hashToken(token) {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * トークンの失効総合判定 (Fail-Close, 未失効キャッシュ完全禁止)
 * @param {object} params
 * @param {string} params.token 判定対象JWT
 * @param {object} params.decoded 検証済みJWTペイロード
 * @param {import('pg').Pool} params.pool common_dbプール
 * @returns {Promise<{ isRevoked: boolean, type?: string, reason?: string }>}
 */
async function checkJwtRevocationStatus({ token, decoded, pool }) {
  const tokenHash = hashToken(token);
  if (!tokenHash) {
    const err = new Error('Invalid token for revocation check');
    err.status = 401;
    throw err;
  }

  if (!pool) {
    const err = new Error('Database pool required for revocation check');
    err.status = 503;
    throw err;
  }

  const tenantId = String(decoded?.tenant_key || decoded?.tenant_id || decoded?.tenantId || '').trim().toLowerCase();
  const userId = String(decoded?.sub || decoded?.userId || decoded?.user_id || '').trim();
  const iatSec = Number(decoded?.iat) || 0;
  const iatMs = decoded?.iat_ms ? Number(decoded.iat_ms) : null;
  const userGen = decoded?.user_gen != null ? Number(decoded.user_gen) : (decoded?.userGen != null ? Number(decoded.userGen) : null);
  const tenantGen = decoded?.tenant_gen != null ? Number(decoded.tenant_gen) : (decoded?.tenantGen != null ? Number(decoded.tenantGen) : null);

  try {
    const res = await pool.query(
      `SELECT is_revoked, revocation_type, revocation_reason 
         FROM public.check_jwt_revocation($1, $2, $3, $4, $5, $6, $7)`,
      [tokenHash, tenantId, userId, iatSec, iatMs, userGen, tenantGen]
    );

    if (res.rows && res.rows.length > 0 && res.rows[0].is_revoked) {
      return {
        isRevoked: true,
        type: res.rows[0].revocation_type,
        reason: res.rows[0].revocation_reason
      };
    }

    return { isRevoked: false };
  } catch (err) {
    console.error('[TokenRevocation] Database lookup failed (Fail-Close):', err.message);
    const dbErr = new Error('Token revocation verification failed due to DB error');
    dbErr.code = 'DB_REVOCATION_CHECK_FAILED';
    dbErr.status = 503;
    throw dbErr;
  }
}

/**
 * 最新世代番号取得 (JWT発行時に埋め込む世代番号)
 */
async function getCurrentTokenGenerations(pool, tenantId, userId) {
  if (!pool) return { tenantGen: 1, userGen: 1 };
  const cleanTenant = String(tenantId || '').trim().toLowerCase();
  const cleanUser = String(userId || '').trim();
  try {
    const res = await pool.query(
      `SELECT tenant_gen, user_gen FROM public.get_current_token_generations($1, $2)`,
      [cleanTenant, cleanUser]
    );
    if (res.rows && res.rows.length > 0) {
      return {
        tenantGen: Number(res.rows[0].tenant_gen) || 1,
        userGen: Number(res.rows[0].user_gen) || 1
      };
    }
    return { tenantGen: 1, userGen: 1 };
  } catch (err) {
    console.warn('[TokenRevocation] getCurrentTokenGenerations query failed:', err.message);
    return { tenantGen: 1, userGen: 1 };
  }
}

/**
 * 互換ラッパー
 */
async function isTokenRevoked(token, pool, decoded = null) {
  if (!decoded) {
    const tokenHash = hashToken(token);
    if (!tokenHash) return false;
    if (!pool) return false;
    const res = await pool.query(
      `SELECT 1 FROM public.revoked_tokens WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP LIMIT 1`,
      [tokenHash]
    );
    return res.rowCount > 0;
  }
  const result = await checkJwtRevocationStatus({ token, decoded, pool });
  return result.isRevoked;
}

/**
 * 個別トークン即時失効登録
 */
async function revokeToken({ token, jti = null, userId = null, tenantId = null, appKey = 'dashboard', reason = 'manual_revocation', revokedBy = 'system', expiresAt = null, pool }) {
  const tokenHash = hashToken(token);
  if (!tokenHash) return { ok: false, error: new Error('Invalid token') };

  const expDate = expiresAt instanceof Date 
    ? expiresAt 
    : (typeof expiresAt === 'number' ? new Date(expiresAt * 1000) : new Date(Date.now() + 24 * 3600 * 1000));

  if (!pool) return { ok: false, error: new Error('Pool required') };

  try {
    await pool.query(
      `INSERT INTO public.revoked_tokens (token_hash, jti, user_id, tenant_id, app_key, reason, revoked_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (token_hash) DO NOTHING`,
      [tokenHash, jti, String(userId || ''), String(tenantId || ''), appKey, reason, revokedBy, expDate]
    );
    return { ok: true };
  } catch (err) {
    console.error('[TokenRevocation] Failed to insert revoked token into DB:', err.message);
    return { ok: false, error: err };
  }
}

/**
 * ユーザー全セッション強制失効登録 (世代番号インクリメント + invalid_before更新)
 */
async function revokeUserAll({ tenantId, userId, reason = 'admin_force_logout', revokedBy = 'admin', pool }) {
  const cleanTenant = String(tenantId || '').trim().toLowerCase();
  const cleanUser = String(userId || '').trim();
  if (!cleanTenant || !cleanUser) return { ok: false, error: new Error('Tenant and User are required') };
  if (!pool) return { ok: false, error: new Error('Pool required') };

  const targetId = `${cleanTenant}:${cleanUser}`;
  try {
    const res = await pool.query(
      `INSERT INTO public.revocation_rules (target_type, target_id, invalid_before, generation, reason, revoked_by)
       VALUES ('user', $1, CURRENT_TIMESTAMP, 2, $2, $3)
       ON CONFLICT (target_type, target_id) DO UPDATE
       SET generation = public.revocation_rules.generation + 1,
           invalid_before = GREATEST(public.revocation_rules.invalid_before, EXCLUDED.invalid_before),
           reason = EXCLUDED.reason,
           revoked_by = EXCLUDED.revoked_by,
           updated_at = CURRENT_TIMESTAMP
       RETURNING generation`,
      [targetId, reason, revokedBy]
    );
    return { ok: true, generation: res.rows[0]?.generation };
  } catch (err) {
    console.error('[TokenRevocation] Failed to revoke user sessions:', err.message);
    return { ok: false, error: err };
  }
}

/**
 * テナント全セッション強制失効登録 (世代番号インクリメント + invalid_before更新)
 */
async function revokeTenantAll({ tenantId, reason = 'tenant_force_logout', revokedBy = 'admin', pool }) {
  const cleanTenant = String(tenantId || '').trim().toLowerCase();
  if (!cleanTenant) return { ok: false, error: new Error('Tenant is required') };
  if (!pool) return { ok: false, error: new Error('Pool required') };

  try {
    const res = await pool.query(
      `INSERT INTO public.revocation_rules (target_type, target_id, invalid_before, generation, reason, revoked_by)
       VALUES ('tenant', $1, CURRENT_TIMESTAMP, 2, $2, $3)
       ON CONFLICT (target_type, target_id) DO UPDATE
       SET generation = public.revocation_rules.generation + 1,
           invalid_before = GREATEST(public.revocation_rules.invalid_before, EXCLUDED.invalid_before),
           reason = EXCLUDED.reason,
           revoked_by = EXCLUDED.revoked_by,
           updated_at = CURRENT_TIMESTAMP
       RETURNING generation`,
      [cleanTenant, reason, revokedBy]
    );
    return { ok: true, generation: res.rows[0]?.generation };
  } catch (err) {
    console.error('[TokenRevocation] Failed to revoke tenant sessions:', err.message);
    return { ok: false, error: err };
  }
}

module.exports = {
  hashToken,
  isTokenRevoked,
  checkJwtRevocationStatus,
  getCurrentTokenGenerations,
  revokeToken,
  revokeUserAll,
  revokeTenantAll
};
