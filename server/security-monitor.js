/**
 * セキュリティ監視モジュール
 * Google Cloud Platform (GCP) のログとメトリクスからセキュリティ情報を取得
 */

const fs = require('fs');
const path = require('path');
const { Logging } = require('@google-cloud/logging');
const { MetricServiceClient } = require('@google-cloud/monitoring');

let lastAlertSuccessAt = null;
let lastBlockedSuccessAt = null;
let lastDeviceSuccessAt = null;

/**
 * GCP認証および共通設定ヘルパー
 * Cloud Run本番環境ではサービスアカウントとApplication Default Credentials (ADC) を優先利用
 * ローカル開発環境でキーファイルが存在する場合のみ keyFilename を適用
 */
function getGcpProjectConfig() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || null;
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    // Windows固有の存在しないパスが設定されている場合、SDKがENOENTでクラッシュするのを防ぐため安全に無効化
    if (credPath && typeof credPath === 'string') {
        try {
            if (!fs.existsSync(credPath)) {
                console.warn(`[Security Monitor] GOOGLE_APPLICATION_CREDENTIALS file not found: "${credPath}". Disabling to fallback to ADC.`);
                delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
            }
        } catch (_) {
            delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }
    }
    
    const options = {};
    if (projectId) {
        options.projectId = projectId;
    }
    return { projectId, options };
}

function getLoggingClient() {
    const { projectId, options } = getGcpProjectConfig();
    if (!projectId) return null;
    try {
        return new Logging(options);
    } catch (err) {
        console.warn('[Security Monitor] Failed to initialize Logging client:', err.message);
        return null;
    }
}

function getMonitoringClient() {
    const { projectId, options } = getGcpProjectConfig();
    if (!projectId) return null;
    try {
        return new MetricServiceClient(options);
    } catch (err) {
        console.warn('[Security Monitor] Failed to initialize Monitoring client:', err.message);
        return null;
    }
}

/**
 * セキュリティアラートを取得
 * Cloud Logging から認証失敗・権限違反・不審アクセスイベントを検出
 * 通常のシステムERROR（DB障害や一般バグ）は除外し、セキュリティイベントを厳密に分類
 */
async function getSecurityAlerts({ tenantId = null } = {}) {
    const { projectId } = getGcpProjectConfig();
    if (!projectId) {
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: 'GOOGLE_CLOUD_PROJECT_ID is not configured',
            message: 'GCPプロジェクトIDが未設定のためセキュリティ監視データは利用できません',
            summary: null,
            alerts: [],
            lastSuccessAt: lastAlertSuccessAt
        };
    }

    const logging = getLoggingClient();
    if (!logging) {
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: 'Failed to initialize Cloud Logging client',
            message: 'Cloud Logging クライアントの初期化に失敗しました (ADCまたは権限を確認してください)',
            summary: null,
            alerts: [],
            lastSuccessAt: lastAlertSuccessAt
        };
    }

    try {
        // 直近24時間のログを対象
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // 通常のERRORを除外し、セキュリティ関連イベント（認証失敗、権限違反、遮断）に限定するフィルタ
        let filterParts = [
            `timestamp >= "${yesterday}"`,
            `(
                httpRequest.status = 401
                OR httpRequest.status = 403
                OR jsonPayload.event_type = "auth_failure"
                OR jsonPayload.event_type = "login_failure"
                OR jsonPayload.event_type = "forbidden"
                OR jsonPayload.event_type = "security_guard_blocked"
                OR jsonPayload.event_type = "cert_revoked_by_admin"
                OR jsonPayload.message =~ ".*(?:authentication failed|unauthorized|login failed|DirectAccessForbidden|ACCESS_DENIED|Token revocation verification failed).*"
            )`
        ];

        // テナント分離: 一般管理者の場合は指定テナントのみに絞り込み
        if (tenantId) {
            filterParts.push(`jsonPayload.tenant_id = "${tenantId}"`);
        }

        const filter = filterParts.join(' AND ');

        const [entries] = await logging.getEntries({
            filter,
            pageSize: 150,
            orderBy: 'timestamp desc'
        });

        // 集計カウンター
        let authFailures = 0;
        let permissionViolations = 0;
        let blockedEvents = 0;
        const ipStats = {};
        const alertEvents = [];

        entries.forEach(entry => {
            const metadata = entry.metadata || {};
            const data = entry.data || {};
            const payload = data.jsonPayload || {};
            const http = data.httpRequest || {};
            const msg = (data.message || payload.message || '').toString();
            const status = http.status || 0;
            const logTenantId = payload.tenant_id || data.tenant_id || null;

            // 一般テナント管理者の場合、他テナントのログは絶対に混入させない
            if (tenantId && logTenantId && logTenantId !== tenantId) {
                return;
            }

            // IPアドレス抽出
            let ip = http.remoteIp || payload.client_ip || payload.ip || 'unknown';

            // イベント分類
            let eventType = 'unknown';
            let category = 'SECURITY';
            let severity = metadata.severity || 'WARNING';

            if (status === 401 || /auth.*fail|login.*fail|unauthorized/i.test(msg)) {
                eventType = 'AUTH_FAILURE';
                category = '認証失敗';
                authFailures++;
            } else if (status === 403 || /forbidden|ACCESS_DENIED|DirectAccessForbidden/i.test(msg)) {
                eventType = 'PERMISSION_VIOLATION';
                category = '権限違反・直接アクセス拒否';
                permissionViolations++;
            } else if (payload.event_type === 'security_guard_blocked' || payload.blocked === true) {
                eventType = 'ACCESS_BLOCKED';
                category = '手動/レート制限遮断';
                blockedEvents++;
            } else {
                eventType = 'SUSPICIOUS_REQUEST';
                category = '不審リクエスト';
            }

            if (!ipStats[ip]) {
                ipStats[ip] = {
                    count: 0,
                    authFailures: 0,
                    permissionViolations: 0,
                    firstSeen: metadata.timestamp,
                    lastSeen: metadata.timestamp,
                    tenantId: logTenantId
                };
            }
            ipStats[ip].count++;
            if (eventType === 'AUTH_FAILURE') ipStats[ip].authFailures++;
            if (eventType === 'PERMISSION_VIOLATION') ipStats[ip].permissionViolations++;
            ipStats[ip].lastSeen = metadata.timestamp;

            if (alertEvents.length < 50) {
                alertEvents.push({
                    id: metadata.insertId || `sec-${Date.parse(metadata.timestamp || Date.now())}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: metadata.timestamp,
                    category,
                    eventType,
                    severity,
                    clientIp: ip,
                    tenantId: logTenantId || '共通/未判定',
                    message: msg || 'セキュリティ関連イベント',
                    httpStatus: status || '-'
                });
            }
        });

        // 3回以上失敗のIPを検出
        const suspiciousIPs = [];
        Object.entries(ipStats).forEach(([ip, stats]) => {
            if (stats.count >= 3 && ip !== 'unknown') {
                suspiciousIPs.push({
                    ip,
                    totalAttempts: stats.count,
                    authFailures: stats.authFailures,
                    permissionViolations: stats.permissionViolations,
                    lastSeen: stats.lastSeen,
                    tenantId: stats.tenantId
                });
            }
        });

        lastAlertSuccessAt = new Date().toISOString();

        return {
            success: true,
            status: 'AVAILABLE',
            summary: {
                totalSecurityAlerts: authFailures + permissionViolations + blockedEvents,
                authFailures,
                permissionViolations,
                blockedAccessCount: blockedEvents,
                suspiciousIpCount: suspiciousIPs.length,
                wafStatus: 'NOT_CONFIGURED',
                wafStatusLabel: 'Cloud Armor (WAF) 未設定（推測集計除外）',
                timestamp: lastAlertSuccessAt,
                filterTenantId: tenantId || 'ALL'
            },
            suspiciousIPs,
            recentEvents: alertEvents,
            autoBlockDesign: {
                status: 'DESIGN_PROPOSAL_ONLY',
                policy: '短時間（5分以内）に同一IPから5回以上の認証失敗が発生した場合、一時的なレートリミット（5分間）またはCloud Armor動的遮断ルールへの追加を推奨（業務影響防止のため自動実行は行わず、手動遮断または設定連携を想定）'
            },
            lastSuccessAt: lastAlertSuccessAt
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting security alerts:', error.message);
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: error.message,
            message: `セキュリティ監視データ取得不可 (Cloud Logging: ${error.message})`,
            summary: null,
            alerts: [],
            lastSuccessAt: lastAlertSuccessAt
        };
    }
}

/**
 * ブロックされたアクセスの詳細を取得
 * 実際にブロックされたログ（SecurityGuard手動遮断等）のみを抽出し、推測による集計は行わない
 */
async function getBlockedAccess({ tenantId = null } = {}) {
    const { projectId } = getGcpProjectConfig();
    if (!projectId) {
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: 'GOOGLE_CLOUD_PROJECT_ID is not configured',
            message: 'GCPプロジェクトIDが未設定のためブロック情報取得不可',
            data: [],
            lastSuccessAt: lastBlockedSuccessAt
        };
    }

    const logging = getLoggingClient();
    if (!logging) {
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: 'Cloud Logging not initialized',
            message: 'Cloud Logging 接続エラー',
            data: [],
            lastSuccessAt: lastBlockedSuccessAt
        };
    }

    try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // 実際にブロックされたイベントのみを対象（Cloud Armor遮断ログまたはSecurityGuard遮断ログ）
        let filterParts = [
            `timestamp >= "${weekAgo}"`,
            `(
                jsonPayload.event_type = "security_guard_blocked"
                OR jsonPayload.status = "blocked"
                OR jsonPayload.enforcedAction = "DENY"
            )`
        ];

        if (tenantId) {
            filterParts.push(`jsonPayload.tenant_id = "${tenantId}"`);
        }

        const filter = filterParts.join(' AND ');

        const [entries] = await logging.getEntries({
            filter,
            pageSize: 50,
            orderBy: 'timestamp desc'
        });

        const blockedList = entries.map(entry => {
            const data = entry.data || {};
            const payload = data.jsonPayload || {};
            const http = data.httpRequest || {};
            const ip = http.remoteIp || payload.client_ip || payload.ip || 'unknown';

            return {
                ip,
                timestamp: entry.metadata?.timestamp,
                reason: payload.reason || data.message || 'ポリシーによるアクセス遮断',
                status: http.status || 403,
                tenantId: payload.tenant_id || '-'
            };
        });

        lastBlockedSuccessAt = new Date().toISOString();

        // Cloud Armorが未設定の場合は推測表示を廃止し、明示的なメッセージを返す
        const isArmorConfigured = false; // 現行構成ではCloud Armor未導入

        return {
            success: true,
            status: 'AVAILABLE',
            wafStatus: isArmorConfigured ? 'ENABLED' : 'NOT_CONFIGURED',
            wafMessage: isArmorConfigured 
                ? 'Cloud Armor (WAF) 稼働中' 
                : 'Cloud Armor 等のエッジWAFによる遮断は現在未設定です。推測でのブロック件数は表示していません。',
            data: blockedList,
            lastSuccessAt: lastBlockedSuccessAt
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting blocked access:', error.message);
        return {
            success: false,
            status: 'UNAVAILABLE',
            wafStatus: 'UNAVAILABLE',
            wafMessage: `ブロックログ取得不可 (Cloud Logging: ${error.message})`,
            error: error.message,
            message: `ブロックログ取得不可 (Cloud Logging: ${error.message})`,
            data: [],
            lastSuccessAt: lastBlockedSuccessAt
        };
    }
}

/**
 * 登録デバイスの一覧を取得
 * public.device_certificates と public.devices から会社管理端末・証明書情報を取得
 */
async function getRegisteredDevices(pool) {
    try {
        if (!pool) {
            throw new Error('Database pool not available');
        }

        const query = `
            SELECT 
                d.id::text AS device_id,
                d.device_identifier,
                d.tenant_id,
                d.device_name,
                d.is_active AS device_active,
                dc.id::text AS cert_id,
                dc.serial_number,
                dc.fingerprint256,
                dc.subject_dn,
                dc.is_revoked,
                dc.revoked_at,
                dc.valid_from,
                dc.valid_to,
                dc.created_at AS cert_created_at
            FROM public.device_certificates dc
            JOIN public.devices d ON d.id = dc.device_id
            ORDER BY dc.created_at DESC
            LIMIT 50
        `;

        const result = await pool.query(query);

        const now = new Date();
        const devices = result.rows.map((row) => {
            const isRevoked = Boolean(row.is_revoked);
            const isDeviceActive = Boolean(row.device_active);
            const isExpired = row.valid_to ? new Date(row.valid_to) < now : false;

            let status = 'active';
            let statusLabel = '稼働中';
            if (isRevoked) {
                status = 'revoked';
                statusLabel = '失効';
            } else if (!isDeviceActive) {
                status = 'disabled';
                statusLabel = '停止中';
            } else if (isExpired) {
                status = 'expired';
                statusLabel = '期限切れ';
            }

            const fp = row.fingerprint256 || '';
            const fpShort = fp.length > 14 ? `${fp.slice(0, 8)}...${fp.slice(-6)}` : fp;

            return {
                id: row.cert_id,
                deviceId: row.device_id,
                name: row.device_name || row.device_identifier,
                identifier: row.device_identifier,
                tenantId: row.tenant_id,
                serialNumber: row.serial_number || '-',
                fingerprintShort: fpShort,
                fingerprint256: fp,
                subjectDn: row.subject_dn || '-',
                validTo: row.valid_to ? new Date(row.valid_to).toISOString().split('T')[0] : '無期限',
                status,
                statusLabel,
                isRevoked
            };
        });

        lastDeviceSuccessAt = new Date().toISOString();

        return {
            success: true,
            status: 'AVAILABLE',
            data: devices,
            lastSuccessAt: lastDeviceSuccessAt
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting registered devices:', error.message);
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: error.message,
            message: `登録デバイス取得不可 (${error.message})`,
            data: [],
            lastSuccessAt: lastDeviceSuccessAt
        };
    }
}

/**
 * ルールベース エラーログ自動解析エンジン
 * 外部AIサービスへは送信せず、定義済みのルールパターンに基づいて安全に原因と推奨対応を導出
 */
const ERROR_ANALYSIS_RULES = [
    {
        id: 'direct_access_blocked',
        name: '内部ポート直接アクセス検知',
        pattern: /DirectAccessForbidden|内部ポートへの直接アクセス遮断/i,
        category: 'SECURITY',
        severity: 'WARNING',
        estimatedCause: 'HTTPSリバースプロキシゲートウェイ（Port 8443）を経由せず、内部ポート（:3000 / :3001）への直接通信が発生しました。',
        recommendedAction: 'クライアントのアクセスURLが https://<ホスト>:8443 に向けられているか確認してください。内部通信はDirectAccessForbidden仕様により安全に遮断されています。'
    },
    {
        id: 'device_not_registered',
        name: '未登録端末証明書アクセス',
        pattern: /DEVICE_NOT_REGISTERED|Certificate fingerprint not registered/i,
        category: 'DEVICE_AUTH',
        severity: 'WARNING',
        estimatedCause: '提示された端末証明書のFingerprintが共通DB（public.device_certificates）に登録されていません。',
        recommendedAction: 'システム管理画面またはDBマイグレーションにて、対象端末のクライアント証明書Fingerprint（SHA-256）を登録してください。'
    },
    {
        id: 'device_revoked',
        name: '失効証明書による接続試行',
        pattern: /DEVICE_REVOKED|CERTIFICATE_REVOKED_IN_DB|is revoked in DB/i,
        category: 'SECURITY_ALERT',
        severity: 'CRITICAL',
        estimatedCause: '失効フラグ（is_revoked=true）が設定されている停止済み端末証明書からのアクセスを検知しました。',
        recommendedAction: '当該端末の利用再開が必要な場合は管理画面から失効解除を行ってください。不正端末の場合はそのまま維持し、接続元IPを調査してください。'
    },
    {
        id: 'jwt_revoked_generation',
        name: '失効トークン利用（世代更新）',
        pattern: /JWT_REVOKED|REVOKED_GENERATION|Token revocation verification failed|401.*revoked/i,
        category: 'AUTH',
        severity: 'WARNING',
        estimatedCause: 'トークン失効世代番号の更新、テナント一括失効、または個別トークン即時失効により、無効化されたセッションでのアクセスが遮断されました。',
        recommendedAction: '正常なログアウトまたは管理者による強制失効に伴う動作です。利用者に再ログインを案内してください。'
    },
    {
        id: 'db_connection_refused',
        name: 'データベース接続拒否',
        pattern: /ECONNREFUSED|connect ECONNREFUSED 127\.0\.0\.1:5432|connect ECONNREFUSED 127\.0\.0\.1:5433/i,
        category: 'INFRASTRUCTURE',
        severity: 'CRITICAL',
        estimatedCause: 'PostgreSQL DBまたは Cloud SQL Auth Proxy プロセスへのTCP接続が拒否されました。',
        recommendedAction: 'Cloud SQL Auth Proxy プロセス、またはローカルPostgreSQLサービスが正常稼働しているか、接続ポート設定を確認してください。'
    },
    {
        id: 'db_relation_not_found',
        name: 'DBスキーマ・テーブル未検出',
        pattern: /relation ".*" does not exist|42P01/i,
        category: 'DATABASE',
        severity: 'ERROR',
        estimatedCause: 'クエリ対象のテーブルまたはスキーマが存在しません。マイグレーションが未適用の可能性があります。',
        recommendedAction: 'npm run db:migrate を実行し、共通DB（common）および対象テナントDBのマイグレーションが最新状態であることを確認してください。'
    },
    {
        id: 'rate_limit_blocked',
        name: 'ブルートフォース保護・連続失敗遮断',
        pattern: /TEMPORARILY_BLOCKED|ACCESS_BLOCKED_MANUAL|連続した認証失敗/i,
        category: 'SECURITY',
        severity: 'WARNING',
        estimatedCause: '連続認証失敗検知（SecurityGuard）により、アカウントまたはIPへの短期アクセス制限（5分間）が発動しました。',
        recommendedAction: '5分間の制限経過を待つか、システム管理画面のアクティブ遮断一覧より手動解除を実施してください。'
    },
    {
        id: 'cloud_logging_auth_error',
        name: 'Cloud Logging 接続エラー',
        pattern: /GOOGLE_CLOUD_PROJECT_ID is not configured|ENOENT.*json.*service-account|Permission denied.*logging/i,
        category: 'GCP_CONFIG',
        severity: 'WARNING',
        estimatedCause: 'Cloud Logging サービスアカウントキーファイルの未配置、またはIAM権限（roles/logging.viewer）が不足しています。',
        recommendedAction: 'GCPコンソールで実行サービスアカウントに roles/logging.viewer 権限を付与するか、有効なサービスアカウントキーを配置してください。'
    }
];

/**
 * ログエントリをルールベースで解析
 */
function analyzeLogEntry(entry) {
    const rawText = `${entry.message || ''} ${JSON.stringify(entry.details || {})} ${entry.http_request ? JSON.stringify(entry.http_request) : ''}`;
    
    for (const rule of ERROR_ANALYSIS_RULES) {
        if (rule.pattern.test(rawText)) {
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                category: rule.category,
                severity: rule.severity,
                estimatedCause: rule.estimatedCause,
                recommendedAction: rule.recommendedAction
            };
        }
    }

    const statusCode = entry.http_request?.status || 0;
    return {
        ruleId: 'general_error',
        ruleName: statusCode >= 500 ? 'サーバー内部エラー' : (statusCode >= 400 ? 'クライアントリクエストエラー' : '一般システム警告'),
        category: statusCode >= 500 ? 'SYSTEM_ERROR' : 'HTTP_ERROR',
        severity: entry.severity || (statusCode >= 500 ? 'ERROR' : 'WARNING'),
        estimatedCause: entry.message || 'システム処理中にエラーまたは警告が発生しました。',
        recommendedAction: 'ログ詳細およびスタックトレースを確認し、該当エンドポイントのパラメータおよびDB整合性を確認してください。'
    };
}

/**
 * ログ内の機密情報をマスキング
 */
function maskSensitiveLog(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [REDACTED]')
        .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/gu, '[REDACTED_JWT]')
        .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s/]+@/giu, '$1[REDACTED]@')
        .replace(/((?:password|passwd|pwd|secret|token|api[-_]?key|authorization)\s*[=:]\s*)[^\s,;&"']+/giu, '$1[REDACTED]');
}

/**
 * システムエラーログおよび自動解析結果の取得
 * Cloud Logging API を第一優先とし、日時範囲、テナント別、重大度での検索とページングに対応
 * クラウド未接続時はローカルログファイルに安全にフォールバック (Fail-Safe)
 */
async function getErrorLogsAndAnalysis({
    limit = 50,
    page = 1,
    tenantId = null,
    startDate = null,
    endDate = null,
    severity = null,
    keyword = null
} = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const errorLogs = [];
    let source = 'NONE';
    let gcpError = null;

    // 1. Cloud Logging API からの取得試行
    const logging = getLoggingClient();
    if (logging) {
        try {
            const filterParts = [];

            // 重大度
            const targetSeverity = severity && ['WARNING', 'ERROR', 'CRITICAL'].includes(severity.toUpperCase())
                ? severity.toUpperCase()
                : 'WARNING';
            filterParts.push(`severity >= "${targetSeverity}"`);

            // 日時範囲 (デフォルト: 直近3日間)
            const fromDate = startDate ? new Date(startDate).toISOString() : new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
            filterParts.push(`timestamp >= "${fromDate}"`);
            if (endDate) {
                const toDate = new Date(endDate).toISOString();
                filterParts.push(`timestamp <= "${toDate}"`);
            }

            // テナント分離
            if (tenantId) {
                filterParts.push(`jsonPayload.tenant_id = "${tenantId}"`);
            }

            // キーワード検索
            if (keyword && String(keyword).trim()) {
                const cleanKw = String(keyword).trim().replace(/"/g, '\\"');
                filterParts.push(`(jsonPayload.message =~ ".*${cleanKw}.*" OR textPayload =~ ".*${cleanKw}.*")`);
            }

            const filter = filterParts.join(' AND ');

            // ページング考慮: offset + limitNum 分を取得
            const maxFetch = Math.min(500, offset + limitNum * 2);
            const [entries] = await logging.getEntries({
                filter,
                pageSize: maxFetch,
                orderBy: 'timestamp desc'
            });

            for (const entry of entries) {
                const metadata = entry.metadata || {};
                const data = entry.data || {};
                const payload = data.jsonPayload || {};
                const http = data.httpRequest || {};
                const logTenant = payload.tenant_id || data.tenant_id || null;

                // テナントチェック
                if (tenantId && logTenant && logTenant !== tenantId) {
                    continue;
                }

                const rawMsg = data.message || payload.message || entry.textPayload || 'Cloud Logging Event';
                const maskedMsg = maskSensitiveLog(rawMsg);

                const parsed = {
                    timestamp: metadata.timestamp || new Date().toISOString(),
                    severity: metadata.severity || 'WARNING',
                    service: payload.service || payload.app_name || 'dashboard_ui',
                    event_type: payload.event_type || 'cloud_logging_event',
                    request_id: payload.request_id || metadata.insertId || null,
                    tenant_id: logTenant || '-',
                    client_ip: http.remoteIp || payload.client_ip || payload.ip || '-',
                    message: maskedMsg,
                    http_request: http.requestMethod ? {
                        method: http.requestMethod,
                        url: http.requestUrl,
                        status: http.status
                    } : null,
                    details: payload
                };

                const analysis = analyzeLogEntry(parsed);

                errorLogs.push({
                    id: metadata.insertId || `cl-${Date.parse(parsed.timestamp)}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: parsed.timestamp,
                    severity: analysis.severity || parsed.severity,
                    service: parsed.service,
                    eventType: parsed.event_type,
                    clientIp: parsed.client_ip,
                    tenantId: parsed.tenant_id,
                    requestId: parsed.request_id,
                    message: parsed.message,
                    httpRequest: parsed.http_request,
                    analysis: {
                        ruleId: analysis.ruleId,
                        ruleName: analysis.ruleName,
                        category: analysis.category,
                        estimatedCause: analysis.estimatedCause,
                        recommendedAction: analysis.recommendedAction
                    },
                    rawLog: parsed
                });
            }

            source = 'CLOUD_LOGGING';
        } catch (err) {
            gcpError = err.message;
            console.warn('[Security Monitor] Cloud Logging fetch failed, falling back to local files:', err.message);
        }
    }

    // 2. Cloud Logging が未設定またはエラーの場合、ローカルログファイルからフォールバック取得 (Fail-Safe)
    if (errorLogs.length === 0) {
        const logsDir = path.join(__dirname, '..', 'logs');
        try {
            if (fs.existsSync(logsDir)) {
                const files = fs.readdirSync(logsDir)
                    .filter(f => f.endsWith('.log'))
                    .sort()
                    .reverse();

                for (const file of files.slice(0, 5)) {
                    const filePath = path.join(logsDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.split('\n');

                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (!line) continue;

                        try {
                            const parsed = JSON.parse(line);
                            const parsedSeverity = (parsed.severity || '').toUpperCase();
                            const status = parsed.http_request?.status || 0;
                            const logTenant = parsed.tenant_id || null;

                            // テナント分離
                            if (tenantId && logTenant && logTenant !== tenantId) {
                                continue;
                            }

                            // 重大度判定
                            const isErrorLevel = parsedSeverity === 'ERROR' || parsedSeverity === 'CRITICAL' || parsedSeverity === 'WARNING' || status >= 400;
                            if (!isErrorLevel) continue;

                            if (severity && parsedSeverity !== severity.toUpperCase()) {
                                continue;
                            }

                            // 日時判定
                            if (startDate && new Date(parsed.timestamp) < new Date(startDate)) {
                                continue;
                            }
                            if (endDate && new Date(parsed.timestamp) > new Date(endDate)) {
                                continue;
                            }

                            // キーワード判定
                            if (keyword && !JSON.stringify(parsed).toLowerCase().includes(keyword.toLowerCase())) {
                                continue;
                            }

                            const maskedMsg = maskSensitiveLog(parsed.message || 'エラー詳細なし');
                            const analysis = analyzeLogEntry(parsed);

                            errorLogs.push({
                                id: parsed.request_id || `log-${Date.parse(parsed.timestamp || Date.now())}-${Math.random().toString(36).slice(2, 7)}`,
                                timestamp: parsed.timestamp || new Date().toISOString(),
                                severity: analysis.severity || parsedSeverity,
                                service: parsed.service || parsed.app_name || 'dashboard_ui',
                                eventType: parsed.event_type || 'system_event',
                                clientIp: parsed.client_ip || '-',
                                tenantId: logTenant || '-',
                                requestId: parsed.request_id || null,
                                message: maskedMsg,
                                httpRequest: parsed.http_request || null,
                                analysis: {
                                    ruleId: analysis.ruleId,
                                    ruleName: analysis.ruleName,
                                    category: analysis.category,
                                    estimatedCause: analysis.estimatedCause,
                                    recommendedAction: analysis.recommendedAction
                                },
                                rawLog: parsed
                            });

                            if (errorLogs.length >= 200) break;
                        } catch (_) {}
                    }
                    if (errorLogs.length >= 200) break;
                }
                source = 'LOCAL_LOG_FALLBACK';
            }
        } catch (fsErr) {
            console.warn('[Security Monitor] Error reading local log files:', fsErr.message);
        }
    }

    // タイムスタンプ降順でソート
    errorLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // ページング適用
    const totalCount = errorLogs.length;
    const paginatedData = errorLogs.slice(offset, offset + limitNum);
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    return {
        success: true,
        source,
        total: totalCount,
        analyzedCount: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasPrev: pageNum > 1,
        hasNext: pageNum < totalPages,
        filterTenantId: tenantId || 'ALL',
        gcpNotice: gcpError ? `Cloud Logging 取得失敗 (${gcpError}) のためローカルログを表示中` : null,
        data: paginatedData,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    getSecurityAlerts,
    getBlockedAccess,
    getRegisteredDevices,
    getErrorLogsAndAnalysis,
    getGcpProjectConfig,
    getLoggingClient,
    getMonitoringClient
};

