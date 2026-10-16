const crypto = require('crypto');

// インメモリキャッシュ (hash -> { revoked: boolean, expiresAt: number, cachedUntil: number })
const revocationCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60秒キャッシュ

function hashToken(token) {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * トークンが失効しているか判定（キャッシュ優先 + DB照合）
 * @param {string} token 判定対象JWT
 * @param {import('pg').Pool} pool 共通DBプール (control plane DB)
 * @returns {Promise<boolean>} 失効していれば true
 */
async function isTokenRevoked(token, pool) {
  const tokenHash = hashToken(token);
  if (!tokenHash) return false;

  const now = Date.now();
  const cached = revocationCache.get(tokenHash);
  if (cached && cached.cachedUntil > now) {
    return cached.revoked;
  }

  if (!pool) return false;

  try {
    const res = await pool.query(
      `SELECT 1 FROM public.revoked_tokens WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP LIMIT 1`,
      [tokenHash]
    );
    const isRevoked = res.rowCount > 0;
    revocationCache.set(tokenHash, {
      revoked: isRevoked,
      cachedUntil: now + CACHE_TTL_MS
    });
    return isRevoked;
  } catch (err) {
    console.warn('[TokenRevocation] Database lookup error (failing open for resilience):', err.message);
    return false;
  }
}

/**
 * トークンを即時失効登録
 * @param {object} params
 * @param {string} params.token 失効させるJWT
 * @param {string} [params.userId]
 * @param {string} [params.tenantId]
 * @param {string} [params.reason]
 * @param {string} [params.revokedBy]
 * @param {Date|number} [params.expiresAt] トークンの本来の有効期限
 * @param {import('pg').Pool} params.pool
 * @returns {Promise<{ ok: boolean, error?: Error }>}
 */
async function revokeToken({ token, userId = null, tenantId = null, reason = 'manual_revocation', revokedBy = 'system', expiresAt = null, pool }) {
  const tokenHash = hashToken(token);
  if (!tokenHash) return { ok: false, error: new Error('Invalid token') };

  const expDate = expiresAt instanceof Date ? expiresAt : (typeof expiresAt === 'number' ? new Date(expiresAt * 1000) : new Date(Date.now() + 24 * 3600 * 1000));

  // 即時インメモリ反映
  revocationCache.set(tokenHash, {
    revoked: true,
    cachedUntil: expDate.getTime()
  });

  if (!pool) return { ok: true };

  try {
    await pool.query(
      `INSERT INTO public.revoked_tokens (token_hash, user_id, tenant_id, reason, revoked_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (token_hash) DO NOTHING`,
      [tokenHash, userId, tenantId, reason, revokedBy, expDate]
    );
    return { ok: true };
  } catch (err) {
    console.error('[TokenRevocation] Failed to insert revoked token into DB:', err.message);
    return { ok: false, error: err };
  }
}

// 古いキャッシュエントリの定期クリーンアップ（5分ごと）
setInterval(() => {
  const now = Date.now();
  for (const [hash, item] of revocationCache.entries()) {
    if (item.cachedUntil <= now) {
      revocationCache.delete(hash);
    }
  }
}, 5 * 60 * 1000).unref();

module.exports = {
  hashToken,
  isTokenRevoked,
  revokeToken
};
