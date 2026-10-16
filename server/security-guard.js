/**
 * 段階的セキュリティ短期制限マネージャー (SecurityGuard - Phase 2 第1段階)
 * 
 * 【前提条件と制約遵守】
 * 1. 共有IP（NAT環境）誤遮断の完全防止:
 *    共有IPだけを根拠にした自動遮断は一切行わない。
 *    制限対象は必ず特定テナントの特定アカウント (ctx:tenantId:username) に限定する。
 * 2. 他テナントへの波及禁止:
 *    テナント分離を維持し、あるテナントでの失敗が他テナントのアカウントに影響しない。
 * 3. 段階的制限 (Tiered Throttling):
 *    - 連続失敗 1〜2回: 通常のエラー応答 (401)
 *    - 連続失敗 3〜4回: 短期遅延ペナルティ (1,500ms) による自動化ブルートフォースの低速化
 *    - 連続失敗 5回以上: 対象アカウントの一時試行制限 (5分間、429 Too Many Requests)
 * 4. 誤遮断防止・解除条件:
 *    - 正しい認証の成功時に即時カウンタクリア
 *    - 有効期限 (5分TTL) 経過による自動解除
 * 5. Cloud Run複数インスタンス前提:
 *    本メモリ管理は単一インスタンス内で自己完結する短期緩和措置であり、
 *    インスタンス間では共有されないことを前提とする（分散同期はPhase 3で検討）。
 */

const logger = require('./logger');

// 追跡エントリの保持 (key -> { score: number, lastFailure: number, blockedUntil: number, failures: number, reasons: string[] })
const failureTracker = new Map();

// 手動遮断リスト (targetKey -> { blockedUntil: number, reason: string, blockedBy: string, blockedAt: string })
const manualBlocks = new Map();

// 設定値 (第1段階制約: IP15分遮断は採用せず、アカウント単位の5分短期制限とする)
const SCORE_DELAY_THRESHOLD = 3;   // スコア3以上で遅延ペナルティ (1500ms)
const SCORE_BLOCK_THRESHOLD = 5;   // スコア5以上でアカウント一時制限 (5分)
const DELAY_MS = 1500;             // 遅延ペナルティ: 1.5秒
const BLOCK_DURATION_MS = 5 * 60 * 1000;  // 短期制限: 5分 (300秒)
const ENTRY_TTL_MS = 10 * 60 * 1000;      // 追跡保持期間: 10分

function buildKeys(clientIp, tenantId, identifier) {
  const cleanIp = String(clientIp || '127.0.0.1').trim();
  const cleanTenant = String(tenantId || 'global').trim().toLowerCase();
  const cleanId = String(identifier || 'anonymous').trim().toLowerCase();

  // アカウントキー (同一テナント内の特定ユーザーに厳格に限定)
  const contextKey = `ctx:${cleanTenant}:${cleanId}`;

  return { contextKey, cleanIp, cleanTenant, cleanId };
}

/**
 * 現在のアクセスが遮断・制限対象か判定
 */
function checkAccess({ clientIp, tenantId, identifier }) {
  const now = Date.now();
  const { contextKey, ipTenantKey, cleanIp } = buildKeys(clientIp, tenantId, identifier);

  // 1. 手動遮断チェック (IP、またはコンテキストキー)
  for (const k of [cleanIp, contextKey, ipTenantKey]) {
    const manual = manualBlocks.get(k);
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
        manualBlocks.delete(k);
      }
    }
  }

  // 2. 自動段階的制限チェック (コンテキスト優先、次にIP+テナント)
  const entry = failureTracker.get(contextKey) || failureTracker.get(ipTenantKey);
  if (entry) {
    // 遮断中か？
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      return {
        allowed: false,
        status: 429,
        code: 'TEMPORARILY_BLOCKED',
        message: '連続したセキュリティ違反または認証失敗を検知したため、一時的にアクセスを制限しています。時間をおいて再試行してください。',
        retryAfterSeconds: retryAfter
      };
    }

    // 遅延ペナルティ対象か？
    if (entry.score >= SCORE_DELAY_THRESHOLD) {
      return {
        allowed: true,
        shouldThrottle: true,
        delayMs: DELAY_MS
      };
    }
  }

  return { allowed: true, shouldThrottle: false, delayMs: 0 };
}

/**
 * 失敗・脅威イベントの記録とスコア加算
 */
function recordFailure({
  clientIp,
  tenantId = null,
  identifier = null,
  eventType = 'auth_failure',
  weight = 1,
  reason = '',
  requestId = null,
  req = null
}) {
  const now = Date.now();
  const { contextKey, ipTenantKey, cleanIp } = buildKeys(clientIp, tenantId, identifier);

  // コンテキストキー（特定ユーザー/端末）を優先更新
  const targetKey = identifier ? contextKey : ipTenantKey;
  let entry = failureTracker.get(targetKey);
  if (!entry || (now - entry.lastFailure > ENTRY_TTL_MS)) {
    entry = { score: 0, failures: 0, lastFailure: now, blockedUntil: 0, reasons: [] };
  }

  entry.score += weight;
  entry.failures += 1;
  entry.lastFailure = now;
  if (reason && !entry.reasons.includes(reason)) {
    entry.reasons.push(reason);
  }

  // スコアが閾値を超えた場合は一時遮断フラグ設定
  let newlyBlocked = false;
  if (entry.score >= SCORE_BLOCK_THRESHOLD && (!entry.blockedUntil || entry.blockedUntil <= now)) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    newlyBlocked = true;
  }

  failureTracker.set(targetKey, entry);

  const finalReqId = requestId || req?.requestId || req?.headers?.['x-request-id'] || null;

  if (newlyBlocked) {
    logger.writeLog({
      severity: 'WARNING',
      eventType: 'security_blocked',
      requestId: finalReqId,
      tenantId: tenantId || null,
      userId: identifier || null,
      clientIp: cleanIp,
      durationMs: null,
      message: `[SecurityGuard] 不正試行の閾値超過により一時遮断を適用しました (target='${targetKey}', score=${entry.score}, duration=5分)`,
      details: {
        targetKey,
        score: entry.score,
        failures: entry.failures,
        blockedUntil: new Date(entry.blockedUntil).toISOString(),
        reasons: entry.reasons
      }
    });
  } else if (entry.score >= SCORE_DELAY_THRESHOLD) {
    logger.writeLog({
      severity: 'WARNING',
      eventType: 'throttling_activated',
      requestId: finalReqId,
      tenantId: tenantId || null,
      userId: identifier || null,
      clientIp: cleanIp,
      durationMs: null,
      message: `[SecurityGuard] 連続失敗検知により遅延ペナルティ (${DELAY_MS}ms) を有効化しました (target='${targetKey}', score=${entry.score})`,
      details: { targetKey, score: entry.score, failures: entry.failures }
    });
  }

  return {
    score: entry.score,
    isBlocked: newlyBlocked || (entry.blockedUntil > now),
    shouldThrottle: entry.score >= SCORE_DELAY_THRESHOLD,
    blockedUntil: entry.blockedUntil || null
  };
}

/**
 * 認証成功時のスコア減衰またはリセット
 */
function recordSuccess({ clientIp, tenantId = null, identifier = null }) {
  const { contextKey, ipTenantKey } = buildKeys(clientIp, tenantId, identifier);
  failureTracker.delete(contextKey);
  // IPキー側のスコアを半減（他ユーザーによる連続失敗の残留スコアを減衰）
  const ipEntry = failureTracker.get(ipTenantKey);
  if (ipEntry) {
    ipEntry.score = Math.max(0, Math.floor(ipEntry.score / 2));
    if (ipEntry.score === 0) failureTracker.delete(ipTenantKey);
  }
}

/**
 * 管理者による手動遮断
 */
function manualBlock({ target, durationMinutes = 60, reason = '管理者による手動遮断', blockedBy = 'admin', requestId = null }) {
  const cleanTarget = String(target || '').trim();
  if (!cleanTarget) return { ok: false, message: '遮断対象が指定されていません' };

  const durationMs = Math.max(1, Number(durationMinutes) || 60) * 60 * 1000;
  const now = Date.now();
  const blockedUntil = now + durationMs;

  manualBlocks.set(cleanTarget, {
    target: cleanTarget,
    blockedUntil,
    reason,
    blockedBy,
    blockedAt: new Date(now).toISOString()
  });

  logger.writeAuditRecord({
    severity: 'WARNING',
    eventType: 'admin_manual_block',
    requestId,
    userId: blockedBy,
    message: `管理者(${blockedBy})が手動遮断を実行しました: target='${cleanTarget}', 期間=${durationMinutes}分, 理由='${reason}'`,
    details: { target: cleanTarget, durationMinutes, blockedUntil: new Date(blockedUntil).toISOString(), reason }
  });

  return { ok: true, target: cleanTarget, blockedUntil: new Date(blockedUntil).toISOString() };
}

/**
 * 管理者による遮断解除
 */
function manualUnblock({ target, unblockedBy = 'admin', reason = '管理者による手動解除', requestId = null }) {
  const cleanTarget = String(target || '').trim();
  if (!cleanTarget) return { ok: false, message: '解除対象が指定されていません' };

  const wasManual = manualBlocks.delete(cleanTarget);
  const wasAuto = failureTracker.delete(cleanTarget);

  logger.writeAuditRecord({
    severity: 'INFO',
    eventType: 'admin_manual_unblock',
    requestId,
    userId: unblockedBy,
    message: `管理者(${unblockedBy})が手動解除を実行しました: target='${cleanTarget}', 理由='${reason}'`,
    details: { target: cleanTarget, wasManual, wasAuto, reason }
  });

  return { ok: true, target: cleanTarget, unblocked: wasManual || wasAuto };
}

/**
 * 現在の遮断一覧を取得（管理者参照用）
 */
function getActiveBlocks() {
  const now = Date.now();
  const list = [];

  for (const [key, v] of manualBlocks.entries()) {
    if (v.blockedUntil > now) {
      list.push({
        target: key,
        type: 'MANUAL',
        blockedUntil: new Date(v.blockedUntil).toISOString(),
        reason: v.reason,
        blockedBy: v.blockedBy,
        remainingSeconds: Math.ceil((v.blockedUntil - now) / 1000)
      });
    } else {
      manualBlocks.delete(key);
    }
  }

  for (const [key, v] of failureTracker.entries()) {
    if (v.blockedUntil && v.blockedUntil > now) {
      list.push({
        target: key,
        type: 'AUTO_RATE_LIMIT',
        blockedUntil: new Date(v.blockedUntil).toISOString(),
        score: v.score,
        failures: v.failures,
        reasons: v.reasons,
        remainingSeconds: Math.ceil((v.blockedUntil - now) / 1000)
      });
    }
  }

  return list;
}

// 追跡エントリの定期クリーンアップ（10分ごと）
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of failureTracker.entries()) {
    if (now - v.lastFailure > ENTRY_TTL_MS && (!v.blockedUntil || v.blockedUntil <= now)) {
      failureTracker.delete(k);
    }
  }
  for (const [k, v] of manualBlocks.entries()) {
    if (v.blockedUntil <= now) {
      manualBlocks.delete(k);
    }
  }
}, 10 * 60 * 1000).unref();

module.exports = {
  checkAccess,
  recordFailure,
  recordSuccess,
  manualBlock,
  manualUnblock,
  getActiveBlocks,
  DELAY_MS
};
