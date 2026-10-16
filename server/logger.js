/**
 * Dashboard UI 構造化ロガーモジュール (Phase 1)
 * Google Cloud Logging 整合 JSON ログ出力 & ローカル日次ローテーション保存
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');

const APP_NAME = 'dashboard_ui';
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const RETENTION_DAYS = 7;
const SENSITIVE_KEY_REGEX = /(password|passwd|passphrase|pwd|secret|token|authorization|cookie|credential|api[-_]?key|private[-_]?key|jwt|signature)/iu;

// Cloud Run 環境の判定（K_SERVICE または K_REVISION が存在する場合は Cloud Run）
const IS_CLOUD_RUN = Boolean(process.env.K_SERVICE || process.env.K_REVISION);

// ログディレクトリの初期化（ローカル環境のみ）
if (!IS_CLOUD_RUN) {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  } catch (_) {}
}

// 古いログファイルの自動クリーンアップ（7日保持、ローカル環境のみ）
function cleanupOldLogs() {
  if (IS_CLOUD_RUN) return;
  try {
    if (!fs.existsSync(LOGS_DIR)) return;
    const now = Date.now();
    const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOGS_DIR);
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(LOGS_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      }
    }
  } catch (_) {}
}
cleanupOldLogs();

function redactString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/gu, '[REDACTED_JWT]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s/]+@/giu, '$1[REDACTED]@')
    .replace(/((?:password|passwd|pwd|secret|token|api[-_]?key)\s*[=:]\s*)[^\s,;&"']+/giu, '$1[REDACTED]');
}

function sanitizeObject(obj, depth = 0, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactString(obj);
  if (typeof obj !== 'object') return obj;
  if (depth > 5) return '[MaxDepth]';
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map(item => sanitizeObject(item, depth + 1, seen));
  }

  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = sanitizeObject(v, depth + 1, seen);
    }
  }
  return result;
}

// クライアントIPの正規化
function extractClientIp(req) {
  try {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (forwarded) {
      const first = String(forwarded).split(',')[0].trim();
      if (first && net.isIP(first)) return first;
    }
    const remote = req?.socket?.remoteAddress || req?.ip || '';
    return remote && net.isIP(remote) ? remote : null;
  } catch {
    return null;
  }
}

// ローカルファイルへの非同期追記（Fail-Safe）
// Cloud Run 環境ではファイル追記をスキップし、標準ストリーム（Cloud Logging 自動収集）に一本化
function appendLocalLog(jsonLine) {
  if (IS_CLOUD_RUN) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOGS_DIR, `dashboard-${today}.log`);
    fs.appendFile(logFile, `${jsonLine}\n`, 'utf8', () => {});
  } catch (_) {}
}

function writeLog({
  severity = 'INFO',
  eventType = 'api_request',
  requestId = null,
  correlationId = null,
  tenantId = null,
  userId = null,
  clientIp = null,
  durationMs = null,
  httpRequest = null,
  message = '',
  details = {}
}) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      severity: severity.toUpperCase(),
      app_name: APP_NAME,
      event_type: eventType,
      request_id: requestId || null,
      correlation_id: correlationId || requestId || null,
      tenant_id: tenantId || null,
      user_id: userId || null,
      client_ip: clientIp || null,
      duration_ms: durationMs !== null ? Number(Number(durationMs).toFixed(2)) : null,
      http_request: httpRequest ? sanitizeObject(httpRequest) : null,
      message: redactString(message),
      details: sanitizeObject(details)
    };

    const jsonLine = JSON.stringify(entry);

    if (severity === 'ERROR' || severity === 'CRITICAL') {
      process.stderr.write(`${jsonLine}\n`);
    } else {
      process.stdout.write(`${jsonLine}\n`);
    }

    appendLocalLog(jsonLine);
    return entry;
  } catch (err) {
    try {
      process.stderr.write(`[Dashboard Logger Fallback Error] ${err.message}\n`);
    } catch (_) {}
    return null;
  }
}

/**
 * 重要な管理操作の監査ログ同期書き込み（Fail-Closed 専用）
 * 保存失敗時は { ok: false, error } を返し、呼び出し元でDBトランザクションをロールバック可能にする
 * @returns {{ ok: boolean, entry?: object, error?: Error }}
 */
function writeAuditLogSync({
  req = null,
  severity = 'INFO',
  eventType = 'admin_audit',
  requestId = null,
  correlationId = null,
  tenantId = null,
  userId = null,
  clientIp = null,
  message = '',
  details = {}
}) {
  try {
    const allowTestHooks = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_BENCHMARK_HOOKS === 'true';
    if (allowTestHooks && (process.env.SIMULATE_AUDIT_FAILURE === 'true' || req?.headers?.['x-simulate-audit-failure'] === 'true')) {
      throw new Error('Simulated audit logging disk/stream failure for Fail-Closed verification');
    }

    const finalRequestId = requestId || req?.requestId || req?.headers?.['x-request-id'] || null;
    const finalCorrelationId = correlationId || req?.correlationId || req?.headers?.['x-correlation-id'] || finalRequestId;
    const finalTenantId = tenantId || req?.tenantId || req?.deviceInfo?.tenantKey || req?.session?.tenant_key || null;
    const finalUserId = userId || req?.user?.username || req?.user?.userId || req?.user?.id || req?.session?.username || null;
    const finalClientIp = clientIp || extractClientIp(req);

    const entry = {
      timestamp: new Date().toISOString(),
      severity: severity.toUpperCase(),
      app_name: APP_NAME,
      event_type: eventType,
      request_id: finalRequestId,
      correlation_id: finalCorrelationId,
      tenant_id: finalTenantId,
      user_id: finalUserId,
      client_ip: finalClientIp,
      duration_ms: null,
      http_request: req ? {
        requestMethod: req.method,
        requestUrl: req.originalUrl || req.url,
        status: 200
      } : null,
      message: redactString(message),
      details: {
        ...sanitizeObject(details),
        is_audit_record: true
      }
    };

    const jsonLine = JSON.stringify(entry);

    // 1. 標準出力へ同期書き込み（Cloud Run では Cloud Logging に自動永続化）
    process.stdout.write(`${jsonLine}\n`);

    // 2. ローカル環境の場合はファイルへ同期追記（Fail-Closed 保証）
    if (!IS_CLOUD_RUN) {
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      }
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(LOGS_DIR, `dashboard-${today}.log`);
      fs.appendFileSync(logFile, `${jsonLine}\n`, 'utf8');
    }

    return { ok: true, entry };
  } catch (err) {
    try {
      process.stderr.write(`[CRITICAL_AUDIT_FAILURE] Failed to synchronously write audit log: ${err.message}\n`);
    } catch (_) {}
    return { ok: false, error: err };
  }
}

function writeAuditRecord(options) {
  const result = writeAuditLogSync(options);
  return result.ok ? result.entry : null;
}

/**
 * Express 用リクエストロギング & 相関IDミドルウェア
 */
function requestLoggingMiddleware() {
  return (req, res, next) => {
    // ベンチマーク比較用：ロギングバイパスモード（非本番かつ明示的に許可された場合のみ）
    const allowTestHooks = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_BENCHMARK_HOOKS === 'true';
    if (allowTestHooks && req.headers['x-bypass-logging'] === 'true') {
      return next();
    }

    const startNs = process.hrtime.bigint();

    // 1. Gatewayから伝播された Request ID / Correlation ID を取得（なければフォールバック生成）
    const requestId = req.headers['x-request-id'] || `req_${crypto.randomBytes(8).toString('hex')}`;
    const correlationId = req.headers['x-correlation-id'] || requestId;

    req.requestId = requestId;
    req.correlationId = correlationId;

    // レスポンスヘッダーに返却
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Correlation-Id', correlationId);

    // ヘルスチェックはノイズ防止のためログを抑制
    const isHealth = req.path === '/health' || req.path === '/_ah/health' || req.path === '/ready';

    res.on('finish', () => {
      if (isHealth && res.statusCode < 400) return;

      const durationNs = process.hrtime.bigint() - startNs;
      const durationMs = Number(durationNs) / 1e6;
      const statusCode = res.statusCode;
      const severity = statusCode >= 500 ? 'ERROR' : (statusCode >= 400 ? 'WARNING' : 'INFO');
      const eventType = statusCode >= 500 ? 'server_error' : (statusCode >= 400 ? 'client_error' : 'api_request');

      const tenantId = req.requestedTenantId || req.deviceInfo?.tenantKey || req.tenant?.tenant_key || null;
      const userId = req.user?.username || req.user?.userId || req.user?.id || null;

      writeLog({
        severity,
        eventType,
        requestId,
        correlationId,
        tenantId,
        userId,
        clientIp: extractClientIp(req),
        durationMs,
        httpRequest: {
          requestMethod: req.method,
          requestUrl: req.originalUrl || req.url,
          status: statusCode
        },
        message: `${req.method} ${req.originalUrl || req.url} - ${statusCode} (${durationMs.toFixed(1)}ms)`,
        details: {
          deviceFingerprint: req.deviceAuth?.fingerprint256 ? req.deviceAuth.fingerprint256.slice(0, 12) + '...[MASKED]' : null
        }
      });
    });

    next();
  };
}

module.exports = {
  writeLog,
  writeAuditRecord,
  writeAuditLogSync,
  requestLoggingMiddleware,
  redactString,
  sanitizeObject,
  extractClientIp,
  IS_CLOUD_RUN
};
