/**
 * セキュリティ監視モジュール
 * Google Cloud Platform (GCP) のログとメトリクスからセキュリティ情報を取得
 */

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
 */
async function getRegisteredDevices(pool) {
    try {
        if (!pool) {
            throw new Error('Database pool not available');
        }

        // データベースから最近のログイン情報を取得
        const query = `
            SELECT DISTINCT
                username,
                display_name,
                created_at as last_login
            FROM public.users
            WHERE last_login_at IS NOT NULL
            ORDER BY last_login_at DESC
            LIMIT 10
        `;

        const result = await pool.query(query);

        const devices = result.rows.map((row, index) => {
            const lastLogin = new Date(row.last_login);
            const now = new Date();
            const diffMs = now - lastLogin;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);

            let timeAgo;
            if (diffMins < 60) {
                timeAgo = `${diffMins}分前`;
            } else if (diffHours < 24) {
                timeAgo = `${diffHours}時間前`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                timeAgo = `${diffDays}日前`;
            }

            return {
                id: index + 1,
                name: `Device-${String(index + 1).padStart(3, '0')}`,
                user: row.display_name || row.username,
                lastAccess: timeAgo,
                status: diffHours < 24 ? 'active' : 'inactive'
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
            message: '登録デバイス取得不可 (DB接続エラー)',
            data: [],
            lastSuccessAt: lastDeviceSuccessAt
        };
    }
}

module.exports = {
    getSecurityAlerts,
    getBlockedAccess,
    getRegisteredDevices
};

