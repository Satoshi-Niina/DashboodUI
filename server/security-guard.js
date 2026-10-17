/**
 * 段階的セキュリティ短期制限マネージャー (SecurityGuard - Phase 2 第2段階修正版)
 * PostgreSQL分散ログイン失敗管理 (Cloud Run複数インスタンス対応)
 */

const logger = require('./logger');

const SCORE_DELAY_THRESHOLD = 3;   // スコア3以上で遅延ペナルティ (1500ms)
const SCORE_BLOCK_THRESHOLD = 5;   // スコア5以上でアカウント一時制限 (5分)
const DELAY_MS = 1500;             // 遅延ペナルティ: 1.5秒
const BLOCK_DURATION_MS = 5 * 60 * 1000;  // 短期制限: 5分 (300秒)

// 手動遮断リスト (インメモリキャッシュ)
const manualBlocks = new Map();

function normalizeKeys(tenantId, identifier) {
  const cleanTenant = String(tenantId || 'global').trim().toLowerCase();
  const cleanUser = String(identifier || 'anonymous').normalize('NFKC').trim().toLowerCase();
  return { cleanTenant, cleanUser };
}

/**
 * アクセス制限判定 (PostgreSQL分散照会 + Fail-Close)
 */
async function checkAccess({ clientIp, tenantId, identifier, pool = null }) {
  const now = Date.now();
  const { cleanTenant, cleanUser } = normalizeKeys(tenantId, identifier);
  const contextKey = `ctx:${cleanTenant}:${cleanUser}`;

  // 1. 手動遮断チェック
  const manual = manualBlocks.get(contextKey);
  if (manual) {
    if (manual.blockedUntil > now) {
      const retryAfter = Math.ceil((manual.blockedUntil - now) / 1000);
      return {
        allowed: false,
        status: 429,
        code: 'ACCESS_BLOCKED_MANUAL',
        message: `管理操作により一時的にアクセスが制限されています (理由: ${manual.reason})`,
        retryAfterSeconds: retryAfter
      };
    } else {
      manualBlocks.delete(contextKey);
    }
  }

  // 2. DBを用いた分散判定
  if (pool && identifier) {
    try {
      const res = await pool.query(`
        SELECT failure_count, score, blocked_until, reset_generation,
               (blocked_until > CURRENT_TIMESTAMP) AS is_blocked,
               COALESCE(EXTRACT(EPOCH FROM (blocked_until - CURRENT_TIMESTAMP))::INTEGER, 0) AS retry_after_seconds
        FROM public.login_attempt_counters
        WHERE tenant_id = $1 AND username = $2
        LIMIT 1
      `, [cleanTenant, cleanUser]);

      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        const resetGen = Number(row.reset_generation) || 0;
        if (row.is_blocked) {
          return {
            allowed: false,
            status: 429,
            code: 'TEMPORARILY_BLOCKED',
            message: '連続した認証失敗を検知したため、一時的にアクセスを制限しています。時間をおいて再試行してください。',
            retryAfterSeconds: Math.max(1, row.retry_after_seconds),
            resetGeneration: resetGen
          };
        }

        if (row.score >= SCORE_DELAY_THRESHOLD) {
          return {
            allowed: true,
            shouldThrottle: true,
            delayMs: DELAY_MS,
            resetGeneration: resetGen
          };
        }
        return { allowed: true, shouldThrottle: false, delayMs: 0, resetGeneration: resetGen };
      }
      return { allowed: true, shouldThrottle: false, delayMs: 0, resetGeneration: 0 };
    } catch (err) {
      console.error('[SecurityGuard] DB checkAccess failed (Fail-Close):', err.message);
      // DB障害時はFail-Close
      const error = new Error('Security check DB failure');
      error.status = 503;
      error.code = 'DB_ERROR';
      throw error;
    }
  }

  return { allowed: true, shouldThrottle: false, delayMs: 0, resetGeneration: 0 };
}

/**
 * 失敗記録 (PostgreSQL原子的UPSERT + 成功リセット世代汚染防止)
 */
async function recordFailure({
  clientIp,
  tenantId = null,
  identifier = null,
  weight = 1,
  pool = null,
  requestId = null,
  req = null,
  attemptStartedAt = null,
  expectedResetGeneration = null
}) {
  const { cleanTenant, cleanUser } = normalizeKeys(tenantId, identifier);
  const cleanIp = String(clientIp || '127.0.0.1').trim();
  const finalReqId = requestId || req?.requestId || req?.headers?.['x-request-id'] || null;
  const startedAt = attemptStartedAt instanceof Date ? attemptStartedAt : new Date();
  const expResetGen = expectedResetGeneration != null ? Number(expectedResetGeneration) : null;

  if (pool && identifier) {
    try {
      const res = await pool.query(`
        INSERT INTO public.login_attempt_counters (
            tenant_id, username, failure_count, score, 
            blocked_until, reset_generation, last_failure_at, last_client_ip, created_at, updated_at
        )
        VALUES (
            $1, $2, 1, $3, 
            CASE WHEN $3 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '5 minutes' ELSE NULL END,
            COALESCE($6, 0),
            CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (tenant_id, username) DO UPDATE
        SET failure_count = CASE 
                -- 直近に成功リセット（世代番号進捗またはscore=0かつ更新時刻進捗）されている古い遅延失敗試行は加算しない
                WHEN ($6::INTEGER IS NOT NULL AND public.login_attempt_counters.reset_generation > $6::INTEGER)
                     OR (public.login_attempt_counters.score = 0 AND public.login_attempt_counters.updated_at > $5)
                    THEN 0
                WHEN public.login_attempt_counters.blocked_until IS NOT NULL 
                     AND public.login_attempt_counters.blocked_until <= CURRENT_TIMESTAMP 
                    THEN 1
                WHEN public.login_attempt_counters.last_failure_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
                    THEN 1
                ELSE public.login_attempt_counters.failure_count + 1
            END,
            score = CASE 
                WHEN ($6::INTEGER IS NOT NULL AND public.login_attempt_counters.reset_generation > $6::INTEGER)
                     OR (public.login_attempt_counters.score = 0 AND public.login_attempt_counters.updated_at > $5)
                    THEN 0
                WHEN public.login_attempt_counters.blocked_until IS NOT NULL 
                     AND public.login_attempt_counters.blocked_until <= CURRENT_TIMESTAMP 
                    THEN EXCLUDED.score
                WHEN public.login_attempt_counters.last_failure_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
                    THEN EXCLUDED.score
                ELSE public.login_attempt_counters.score + EXCLUDED.score
            END,
            blocked_until = CASE 
                WHEN ($6::INTEGER IS NOT NULL AND public.login_attempt_counters.reset_generation > $6::INTEGER)
                     OR (public.login_attempt_counters.score = 0 AND public.login_attempt_counters.updated_at > $5)
                    THEN NULL
                WHEN (public.login_attempt_counters.blocked_until IS NOT NULL AND public.login_attempt_counters.blocked_until <= CURRENT_TIMESTAMP)
                     OR (public.login_attempt_counters.last_failure_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
                    THEN (CASE WHEN EXCLUDED.score >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '5 minutes' ELSE NULL END)
                WHEN public.login_attempt_counters.blocked_until > CURRENT_TIMESTAMP 
                    THEN public.login_attempt_counters.blocked_until
                WHEN public.login_attempt_counters.score + EXCLUDED.score >= 5 
                    THEN CURRENT_TIMESTAMP + INTERVAL '5 minutes'
                ELSE NULL 
            END,
            last_failure_at = CASE 
                WHEN ($6::INTEGER IS NOT NULL AND public.login_attempt_counters.reset_generation > $6::INTEGER)
                     OR (public.login_attempt_counters.score = 0 AND public.login_attempt_counters.updated_at > $5)
                    THEN public.login_attempt_counters.last_failure_at
                ELSE CURRENT_TIMESTAMP
            END,
            last_client_ip = EXCLUDED.last_client_ip,
            updated_at = CASE 
                WHEN ($6::INTEGER IS NOT NULL AND public.login_attempt_counters.reset_generation > $6::INTEGER)
                     OR (public.login_attempt_counters.score = 0 AND public.login_attempt_counters.updated_at > $5)
                    THEN public.login_attempt_counters.updated_at
                ELSE CURRENT_TIMESTAMP
            END
        RETURNING failure_count, score, blocked_until, reset_generation,
                  (blocked_until > CURRENT_TIMESTAMP) AS is_blocked,
                  COALESCE(EXTRACT(EPOCH FROM (blocked_until - CURRENT_TIMESTAMP))::INTEGER, 0) AS retry_after_seconds;
      `, [cleanTenant, cleanUser, weight, cleanIp, startedAt, expResetGen]);

      const row = res.rows[0];
      if (row && row.is_blocked) {
        logger.writeLog({
          severity: 'WARNING',
          eventType: 'security_blocked',
          requestId: finalReqId,
          tenantId: cleanTenant,
          userId: cleanUser,
          clientIp: cleanIp,
          message: `[SecurityGuard] 不正試行閾値超過により一時遮断を適用しました (target='${cleanTenant}:${cleanUser}', score=${row.score})`,
          details: { score: row.score, failures: row.failure_count, blockedUntil: row.blocked_until }
        });
      }

      return {
        failureCount: row.failure_count,
        score: row.score,
        isBlocked: row.is_blocked,
        shouldThrottle: row.score >= SCORE_DELAY_THRESHOLD,
        blockedUntil: row.blocked_until,
        resetGeneration: Number(row.reset_generation) || 0,
        retryAfterSeconds: Math.max(1, row.retry_after_seconds)
      };
    } catch (err) {
      console.error('[SecurityGuard] DB recordFailure failed (Fail-Close):', err.message);
      const error = new Error('Security record DB failure');
      error.status = 503;
      error.code = 'DB_ERROR';
      throw error;
    }
  }

  return { failureCount: 1, score: 1, isBlocked: false, shouldThrottle: false, blockedUntil: null, resetGeneration: 0, retryAfterSeconds: 0 };
}

/**
 * 成功時カウンタリセット (世代管理・成功リセット番号インクリメント方式)
 */
async function recordSuccess({ clientIp, tenantId = null, identifier = null, pool = null }) {
  const { cleanTenant, cleanUser } = normalizeKeys(tenantId, identifier);
  if (pool && identifier) {
    try {
      await pool.query(`
        INSERT INTO public.login_attempt_counters (
            tenant_id, username, failure_count, score, blocked_until, reset_generation, last_failure_at, created_at, updated_at
        )
        VALUES ($1, $2, 0, 0, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, username) DO UPDATE
        SET failure_count = 0,
            score = 0,
            blocked_until = NULL,
            reset_generation = public.login_attempt_counters.reset_generation + 1,
            updated_at = CURRENT_TIMESTAMP
      `, [cleanTenant, cleanUser]);
    } catch (err) {
      console.warn('[SecurityGuard] Failed to reset login counter on success:', err.message);
    }
  }
}

function manualBlock({ target, durationMinutes = 60, reason = '管理者手動遮断' }) {
  const cleanTarget = String(target || '').trim();
  const durationMs = Math.max(1, Number(durationMinutes) || 60) * 60 * 1000;
  const blockedUntil = Date.now() + durationMs;
  manualBlocks.set(cleanTarget, { blockedUntil, reason });
  return { ok: true, target: cleanTarget };
}

function manualUnblock({ target }) {
  const cleanTarget = String(target || '').trim();
  const deleted = manualBlocks.delete(cleanTarget);
  return { ok: true, unblocked: deleted };
}

module.exports = {
  checkAccess,
  recordFailure,
  recordSuccess,
  manualBlock,
  manualUnblock
};
