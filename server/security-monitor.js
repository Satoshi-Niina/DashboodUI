/**
 * セキュリティ監視モジュール
 * Google Cloud Platform (GCP) のログとメトリクスからセキュリティ情報を取得
 */

const fs = require('fs');
const path = require('path');
const { Logging } = require('@google-cloud/logging');
const { MonitoringServiceClient } = require('@google-cloud/monitoring').v3;

let lastAlertSuccessAt = null;
let lastBlockedSuccessAt = null;
let lastDeviceSuccessAt = null;

/**
 * セキュリティアラートを取得
 * Cloud Logging から認証失敗やセキュリティイベントを検出
 */
async function getSecurityAlerts() {
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        if (!projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT_ID is not configured');
        }

        const logging = new Logging({ projectId });

        // 24時間以内のログを取得
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const timestamp = yesterday.toISOString();

        // 認証失敗ログのフィルター
        const filter = `
            timestamp >= "${timestamp}"
            AND (
                jsonPayload.message =~ ".*authentication failed.*"
                OR jsonPayload.message =~ ".*unauthorized.*"
                OR jsonPayload.message =~ ".*login failed.*"
                OR severity >= "ERROR"
            )
        `;

        const [entries] = await logging.getEntries({
            filter: filter,
            pageSize: 100,
            orderBy: 'timestamp desc'
        });

        // IPアドレスごとに集計
        const ipStats = {};
        const alerts = [];

        entries.forEach(entry => {
            const metadata = entry.metadata;
            const data = entry.data;
            
            // IPアドレスを抽出
            let ip = 'unknown';
            if (data.httpRequest?.remoteIp) {
                ip = data.httpRequest.remoteIp;
            } else if (data.jsonPayload?.ip) {
                ip = data.jsonPayload.ip;
            }

            if (!ipStats[ip]) {
                ipStats[ip] = {
                    count: 0,
                    firstSeen: metadata.timestamp,
                    lastSeen: metadata.timestamp,
                    events: []
                };
            }

            ipStats[ip].count++;
            ipStats[ip].lastSeen = metadata.timestamp;
            ipStats[ip].events.push({
                timestamp: metadata.timestamp,
                severity: metadata.severity,
                message: data.message || data.jsonPayload?.message || '不明なイベント'
            });
        });

        // 不正アクセス試行の検出（3回以上の失敗）
        let unauthorizedAttempts = 0;
        let blockedIPs = 0;

        Object.entries(ipStats).forEach(([ip, stats]) => {
            if (stats.count >= 3) {
                blockedIPs++;
                alerts.push({
                    type: 'blocked_ip',
                    ip: ip,
                    attempts: stats.count,
                    firstSeen: stats.firstSeen,
                    lastSeen: stats.lastSeen
                });
            }
            unauthorizedAttempts += stats.count;
        });

        lastAlertSuccessAt = new Date().toISOString();

        return {
            success: true,
            status: 'AVAILABLE',
            summary: {
                totalAlerts: alerts.length,
                unauthorizedAttempts: unauthorizedAttempts,
                blockedIPs: blockedIPs,
                timestamp: lastAlertSuccessAt
            },
            alerts: alerts,
            lastSuccessAt: lastAlertSuccessAt
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting security alerts:', error.message);
        
        // 本番環境および通常時はモックデータを返さず、取得失敗状態を返す
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: error.message,
            message: '監視データ取得不可 (Cloud Logging 接続エラー)',
            summary: null,
            alerts: [],
            lastSuccessAt: lastAlertSuccessAt
        };
    }
}

/**
 * ブロックされたアクセスの詳細を取得
 */
async function getBlockedAccess() {
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        if (!projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT_ID is not configured');
        }

        const logging = new Logging({ projectId });

        // 過去7日間のログを取得
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const timestamp = weekAgo.toISOString();

        const filter = `
            timestamp >= "${timestamp}"
            AND (
                httpRequest.status >= 400
                OR jsonPayload.blocked = true
                OR jsonPayload.status = "blocked"
            )
        `;

        const [entries] = await logging.getEntries({
            filter: filter,
            pageSize: 50,
            orderBy: 'timestamp desc'
        });

        const blockedList = entries.map(entry => {
            const data = entry.data;
            const ip = data.httpRequest?.remoteIp || data.jsonPayload?.ip || 'unknown';
            
            return {
                ip: ip,
                timestamp: entry.metadata.timestamp,
                reason: data.message || '不正アクセス試行',
                status: data.httpRequest?.status || 403,
                userAgent: data.httpRequest?.userAgent || ''
            };
        });

        // IPごとに集計
        const ipSummary = {};
        blockedList.forEach(item => {
            if (!ipSummary[item.ip]) {
                ipSummary[item.ip] = {
                    ip: item.ip,
                    attempts: 0,
                    lastAttempt: item.timestamp
                };
            }
            ipSummary[item.ip].attempts++;
            if (new Date(item.timestamp) > new Date(ipSummary[item.ip].lastAttempt)) {
                ipSummary[item.ip].lastAttempt = item.timestamp;
            }
        });

        lastBlockedSuccessAt = new Date().toISOString();

        return {
            success: true,
            status: 'AVAILABLE',
            data: Object.values(ipSummary),
            lastSuccessAt: lastBlockedSuccessAt
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting blocked access:', error.message);
        return {
            success: false,
            status: 'UNAVAILABLE',
            error: error.message,
            message: '監視データ取得不可 (Cloud Logging 接続エラー)',
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
 * システムエラーログおよび自動解析結果の取得
 */
async function getErrorLogsAndAnalysis({ limit = 50 } = {}) {
    const logsDir = path.join(__dirname, '..', 'logs');
    const errorLogs = [];

    // 1. ローカルログファイルからの抽出
    try {
        if (fs.existsSync(logsDir)) {
            const files = fs.readdirSync(logsDir)
                .filter(f => f.endsWith('.log'))
                .sort()
                .reverse(); // 新しい日付順

            for (const file of files.slice(0, 3)) { // 直近3日分
                const filePath = path.join(logsDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');

                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    try {
                        const parsed = JSON.parse(line);
                        const severity = (parsed.severity || '').toUpperCase();
                        const status = parsed.http_request?.status || 0;

                        // 警告・エラー・重大・または400以上のHTTPステータスを対象とする
                        if (severity === 'ERROR' || severity === 'WARNING' || severity === 'CRITICAL' || status >= 400) {
                            const analysis = analyzeLogEntry(parsed);
                            errorLogs.push({
                                id: parsed.request_id || `log-${Date.parse(parsed.timestamp || Date.now())}-${Math.random().toString(36).slice(2, 7)}`,
                                timestamp: parsed.timestamp || new Date().toISOString(),
                                severity: analysis.severity || severity,
                                eventType: parsed.event_type || 'system_event',
                                clientIp: parsed.client_ip || '-',
                                tenantId: parsed.tenant_id || '-',
                                message: parsed.message || 'エラー詳細なし',
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

                            if (errorLogs.length >= limit) break;
                        }
                    } catch (_) {}
                }
                if (errorLogs.length >= limit) break;
            }
        }
    } catch (fsErr) {
        console.warn('[Security Monitor] Error reading local log files:', fsErr.message);
    }

    // 2. Cloud Logging が利用可能な場合は補完取得を試行
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        if (projectId && errorLogs.length < limit) {
            const logging = new Logging({ projectId });
            const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
            const filter = `timestamp >= "${yesterday}" AND severity >= "WARNING"`;
            const [entries] = await logging.getEntries({
                filter,
                pageSize: limit - errorLogs.length,
                orderBy: 'timestamp desc'
            });

            for (const entry of entries) {
                const data = entry.data || {};
                const parsed = {
                    timestamp: entry.metadata?.timestamp || new Date().toISOString(),
                    severity: entry.metadata?.severity || 'WARNING',
                    message: data.message || data.jsonPayload?.message || 'Cloud Logging Event',
                    client_ip: data.httpRequest?.remoteIp || data.jsonPayload?.ip || null,
                    http_request: data.httpRequest || null,
                    details: data.jsonPayload || {}
                };
                const analysis = analyzeLogEntry(parsed);
                errorLogs.push({
                    id: entry.metadata?.insertId || `cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    timestamp: parsed.timestamp,
                    severity: analysis.severity,
                    eventType: 'cloud_logging_event',
                    clientIp: parsed.client_ip || '-',
                    tenantId: '-',
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
        }
    } catch (_) {
        // Cloud Logging が失敗してもローカルログで安全に継続 (Fail-Safe)
    }

    // タイムスタンプ降順でソート
    errorLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        success: true,
        total: errorLogs.length,
        analyzedCount: errorLogs.length,
        data: errorLogs.slice(0, limit),
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    getSecurityAlerts,
    getBlockedAccess,
    getRegisteredDevices,
    getErrorLogsAndAnalysis
};

