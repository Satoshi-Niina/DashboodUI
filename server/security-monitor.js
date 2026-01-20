/**
 * セキュリティ監視モジュール
 * Google Cloud Platform (GCP) のログとメトリクスからセキュリティ情報を取得
 */

const { Logging } = require('@google-cloud/logging');
const { MonitoringServiceClient } = require('@google-cloud/monitoring').v3;

/**
 * セキュリティアラートを取得
 * Cloud Logging から認証失敗やセキュリティイベントを検出
 */
async function getSecurityAlerts() {
    try {
        const logging = new Logging({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });

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

        return {
            success: true,
            summary: {
                totalAlerts: alerts.length,
                unauthorizedAttempts: unauthorizedAttempts,
                blockedIPs: blockedIPs,
                timestamp: new Date().toISOString()
            },
            alerts: alerts
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting security alerts:', error);
        
        // エラー時はモックデータを返す
        return {
            success: false,
            error: error.message,
            summary: {
                totalAlerts: 3,
                unauthorizedAttempts: 2,
                blockedIPs: 1,
                timestamp: new Date().toISOString()
            },
            alerts: [
                {
                    type: 'blocked_ip',
                    ip: '192.168.1.100',
                    attempts: 5,
                    country: '中国',
                    firstSeen: new Date(Date.now() - 7200000).toISOString(),
                    lastSeen: new Date(Date.now() - 3600000).toISOString()
                }
            ],
            mockData: true
        };
    }
}

/**
 * ブロックされたアクセスの詳細を取得
 */
async function getBlockedAccess() {
    try {
        const logging = new Logging({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });

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

        return {
            success: true,
            data: Object.values(ipSummary)
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting blocked access:', error);
        return {
            success: false,
            error: error.message,
            data: [
                { ip: '192.168.1.100', attempts: 5, lastAttempt: new Date().toISOString(), country: '中国' },
                { ip: '203.0.113.50', attempts: 2, lastAttempt: new Date().toISOString(), country: '未登録' }
            ],
            mockData: true
        };
    }
}

/**
 * 登録デバイスの一覧を取得
 * JWTトークン発行ログから取得
 */
async function getRegisteredDevices(pool) {
    try {
        // データベースから最近のログイン情報を取得
        const query = `
            SELECT DISTINCT
                username,
                display_name,
                created_at as last_login
            FROM master_data.users
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

        return {
            success: true,
            data: devices
        };

    } catch (error) {
        console.error('[Security Monitor] Error getting registered devices:', error);
        return {
            success: false,
            error: error.message,
            data: [
                { id: 1, name: 'iPad-001', user: '山田太郎', lastAccess: '2時間前', status: 'active' },
                { id: 2, name: 'Tablet-002', user: '佐藤花子', lastAccess: '5分前', status: 'active' }
            ],
            mockData: true
        };
    }
}

module.exports = {
    getSecurityAlerts,
    getBlockedAccess,
    getRegisteredDevices
};
