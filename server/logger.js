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

// ログディレクトリの初期化
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (_) {}

// 古いログファイルの自動クリーンアップ（7日保持）
function cleanupOldLogs() {
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
function appendLocalLog(jsonLine) {
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
 * 重要な管理操作の監査ログ（Audit Record）
 * 保存失敗時でも二次障害を防ぐフェイルセーフを維持しつつ、stderrへ緊急同期書き込みを行う
 */
function writeAuditRecord(options) {
  try {
    const auditOptions = {
      ...options,
      severity: options.severity || 'INFO',
      eventType: options.eventType || 'admin_audit',
      details: {
        ...options.details,
        is_audit_record: true
      }
    };
    return writeLog(auditOptions);
  } catch (err) {
    try {
      process.stderr.write(`[CRITICAL AUDIT FAILURE] Failed to write audit record: ${err.message}\n`);
    } catch (_) {}
    return null;
  }
}

/**
 * Express 用リクエストロギング & 相関IDミドルウェア
 */
function requestLoggingMiddleware() {
  return (req, res, next) => {
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
  requestLoggingMiddleware,
  redactString,
  sanitizeObject,
  extractClientIp
};
