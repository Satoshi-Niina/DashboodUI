/**
 * システムメンテナンスタスクモジュール
 * 一時ファイル削除、ログバックアップ、孤立画像削除などの保守作業を実行
 */

const { Storage } = require('@google-cloud/storage');
const { MetricServiceClient } = require('@google-cloud/monitoring');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// キャッシュストレージ（5分TTL）
let storageCache = {
    timestamp: 0,
    tenantKey: null,
    data: null
};

/**
 * GCP認証および共通設定ヘルパー
 * Cloud Run本番環境ではサービスアカウントとADCを優先利用
 */
function getGcpConfig() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || null;
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GCS_BUCKET_NAME || null;
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const options = {};
    if (projectId) {
        options.projectId = projectId;
    }

    // Windows固有の存在しないパスが設定されている場合、SDKがENOENTでクラッシュするのを防ぐため安全に無効化
    if (credPath && typeof credPath === 'string') {
        try {
            if (!fs.existsSync(credPath)) {
                console.warn(`[Maintenance] GOOGLE_APPLICATION_CREDENTIALS file not found: "${credPath}". Disabling to fallback to ADC.`);
                delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
            }
        } catch (_) {
            delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }
    }

    return { projectId, bucketName, options };
}

function getStorageClient() {
    const { projectId, options } = getGcpConfig();
    if (!projectId) return null;
    try {
        return new Storage(options);
    } catch (err) {
        console.warn('[Maintenance] Failed to initialize Storage client:', err.message);
        return null;
    }
}

function getMonitoringClient() {
    const { projectId, options } = getGcpConfig();
    if (!projectId) return null;
    try {
        return new MetricServiceClient(options);
    } catch (err) {
        console.warn('[Maintenance] Failed to initialize Monitoring client:', err.message);
        return null;
    }
}

/**
 * 一時ファイル検出サマリー（Dry Run 事前確認用）
 */
async function getTempFilesSummary({ tenantId = null } = {}) {
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

        if (!projectId || !bucketName) {
            return {
                success: false,
                error: 'GCP設定未構成',
                message: 'GCPストレージ設定（プロジェクトID/バケット名）が未構成です',
                count: 0,
                totalSizeBytes: 0,
                totalSizeMB: 0,
                files: []
            };
        }

        const storage = new Storage({ projectId });
        const bucket = storage.bucket(bucketName);

        // プレフィックス制限（テナント指定時はプレフィックスを制限）
        const tempPrefixes = tenantId 
            ? [`tenants/${tenantId}/temp/`, `tenants/${tenantId}/tmp/`]
            : ['temp/', 'tmp/', 'uploads/temp/'];

        let candidateCount = 0;
        let totalSize = 0;
        const filesList = [];
        const now = new Date();

        for (const prefix of tempPrefixes) {
            const [files] = await bucket.getFiles({ prefix });

            for (const file of files) {
                const [metadata] = await file.getMetadata();
                const createdDate = new Date(metadata.timeCreated || metadata.updated);
                const ageInDays = Math.round((now - createdDate) / (1000 * 60 * 60 * 24));

                // 1日以上経過した一時ファイルを対象とする
                if (ageInDays >= 1) {
                    const size = parseInt(metadata.size || 0);
                    totalSize += size;
                    candidateCount++;
                    if (filesList.length < 50) {
                        filesList.push({
                            name: file.name,
                            sizeBytes: size,
                            sizeKB: Math.round(size / 1024),
                            ageInDays,
                            updatedAt: metadata.updated || metadata.timeCreated
                        });
                    }
                }
            }
        }

        return {
            success: true,
            mode: 'DRY_RUN_PREVIEW',
            count: candidateCount,
            totalSizeBytes: totalSize,
            totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
            retentionThresholdDays: 1,
            files: filesList,
            message: `1日以上経過した一時ファイル: ${candidateCount}件 (約 ${Math.round((totalSize / 1024 / 1024) * 100) / 100} MB)`
        };

    } catch (error) {
        console.error('[Maintenance] Error getting temp files summary:', error);
        return {
            success: false,
            error: error.message,
            message: `一時ファイル集計に失敗しました: ${error.message}`,
            count: 0,
            totalSizeBytes: 0,
            totalSizeMB: 0,
            files: []
        };
    }
}

/**
 * GCS上の一時ファイルを安全に削除（監査ログ記録付き）
 * 注意: confirmExecution === true が指定されない限り、実削除は実行されず Dry Run となります。
 */
async function cleanTempFiles({ pool = null, user = null, tenantId = null, confirmExecution = false } = {}) {
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

        if (!projectId || !bucketName) {
            return {
                success: false,
                error: 'GCP設定未構成',
                message: 'GCPストレージ設定が未設定のため一時ファイル削除を中止しました'
            };
        }

        // 実行前サマリー取得（Dry Run）
        const summary = await getTempFilesSummary({ tenantId });
        if (!summary.success) {
            return summary;
        }

        const username = user?.username || 'system_admin';
        const operatorTenant = tenantId || user?.tenantId || 'system';

        // 安全保護ポリシー: 安全性が確認されるまでファイルの実削除は強制無効化
        // 誤削除や参照整合性破損による業務停止を完全に防止
        return {
            success: false,
            status: 'DELETION_DISABLED_SAFETY_GUARD',
            isExecuted: false,
            message: '【安全保護ガード】ファイル削除機能は安全性が確認されるまでシステム管理者ポリシーにより実削除が無効化されています。データの消失を防止するため、削除処理は実行されませんでした（Dry Run による対象確認のみ利用可能）。',
            summary
        };

        // 操作監査ログの記録（DBまたは構造化ログ）
        const auditLog = {
            action: 'MAINTENANCE_CLEAN_TEMP_FILES',
            operator: username,
            tenantId: operatorTenant,
            deletedCount,
            freedSpaceMB: Math.round((deletedSize / 1024 / 1024) * 100) / 100,
            timestamp: new Date().toISOString()
        };
        console.log('[Maintenance Audit Log]', JSON.stringify(auditLog));

        if (pool) {
            try {
                await pool.query(
                    `INSERT INTO operations.audit_logs (action, username, tenant_id, details, created_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    ['clean_temp_files', username, operatorTenant, JSON.stringify(auditLog)]
                );
            } catch (auditErr) {
                console.warn('[Maintenance] Audit log DB insertion skipped:', auditErr.message);
            }
        }

        return {
            success: true,
            mode: 'EXECUTED',
            isExecuted: true,
            message: `${deletedCount}個の一時ファイルを削除しました (解放容量: ${Math.round((deletedSize / 1024 / 1024) * 100) / 100} MB)`,
            details: {
                deletedFiles: deletedCount,
                freedSpaceMB: Math.round((deletedSize / 1024 / 1024) * 100) / 100,
                operator: username,
                executedAt: auditLog.timestamp
            }
        };

    } catch (error) {
        console.error('[Maintenance] Error cleaning temp files:', error);
        return {
            success: false,
            error: error.message,
            message: `一時ファイルの削除に失敗しました: ${error.message}`
        };
    }
}

/**
 * ログバックアップ処理
 * Cloud Run アーキテクチャではローカルログファイルは保持されず、
 * 標準ストリーム（Cloud Logging）へ集約されます。
 * ログの恒久保存には Cloud Logging ログシンク（Log Sink）を使用します。
 */
async function backupLogs() {
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

        // Cloud Run 環境判定
        const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION);

        if (isCloudRun) {
            return {
                success: false,
                mode: 'CLOUD_LOGGING_ARCHITECTURE',
                message: 'Cloud Run稼働中のためローカルログは保持されません。Cloud Loggingのログシンク（Log Sink）経由でGCS自動アーカイブをご利用ください。',
                guide: {
                    recommendation: 'Cloud Logging -> GCS エクスポートシンク設定',
                    recommendedSinkName: 'dashboard-ui-log-sink',
                    recommendedDestination: `storage.googleapis.com/${bucketName || '<logs-archive-bucket>'}`,
                    logFilter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="dashboard-ui"'
                }
            };
        }

        // ローカル開発環境の場合のみローカル logs/ ディレクトリを確認
        const logsDir = path.join(__dirname, '..', 'logs');
        let logFiles = [];
        try {
            if (await fs.stat(logsDir)) {
                const files = await fs.readdir(logsDir);
                logFiles = files.filter(f => f.endsWith('.log'));
            }
        } catch (_) {}

        if (logFiles.length === 0) {
            return {
                success: false,
                message: 'バックアップ対象のローカルログファイルが存在しません（0件）'
            };
        }

        if (!projectId || !bucketName) {
            return {
                success: false,
                message: 'GCP設定（GOOGLE_CLOUD_PROJECT_ID / GOOGLE_CLOUD_STORAGE_BUCKET）が未構成のためGCSへの保存をスキップしました'
            };
        }

        const storage = new Storage({ projectId });
        const bucket = storage.bucket(bucketName);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFileName = `logs-backup-${timestamp}.zip`;
        const backupPath = path.join(__dirname, '..', 'backups', backupFileName);

        await fs.mkdir(path.dirname(backupPath), { recursive: true });

        const output = require('fs').createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', async () => {
                try {
                    const destination = `backups/logs/${backupFileName}`;
                    await bucket.upload(backupPath, {
                        destination,
                        metadata: { contentType: 'application/zip' }
                    });
                    await fs.unlink(backupPath);

                    resolve({
                        success: true,
                        message: 'ローカルログファイルをGCSにバックアップしました',
                        details: {
                            fileName: backupFileName,
                            size: archive.pointer(),
                            location: `gs://${bucketName}/${destination}`
                        }
                    });
                } catch (err) {
                    reject({
                        success: false,
                        error: err.message,
                        message: `バックアップのアップロードに失敗しました: ${err.message}`
                    });
                }
            });

            archive.on('error', (err) => {
                reject({
                    success: false,
                    error: err.message,
                    message: `アーカイブ作成に失敗しました: ${err.message}`
                });
            });

            archive.pipe(output);
            archive.directory(logsDir, 'logs');
            archive.finalize();
        });

    } catch (error) {
        console.error('[Maintenance] Error backing up logs:', error);
        return {
            success: false,
            error: error.message,
            message: `ログバックアップに失敗しました: ${error.message}`
        };
    }
}

/**
 * 孤立画像ファイルの検出（Dry Run 専用・実削除無効化）
 * 注意: 全サブシステム（計画・復旧・車両・共通）の参照関係が検証されるまで
 * 安全のため実削除 (file.delete) は完全に無効化されています。
 */
async function cleanOrphanedImages(pool) {
    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

        if (!projectId || !bucketName) {
            return {
                success: false,
                mode: 'DRY_RUN_ONLY',
                isDeletionEnabled: false,
                error: 'GCP設定（GOOGLE_CLOUD_PROJECT_ID または GOOGLE_CLOUD_STORAGE_BUCKET）が未構成です',
                message: 'GCPストレージ設定が未設定のため孤立画像の検出をスキップしました',
                candidatesCount: 0,
                totalCandidateSizeMB: 0,
                candidates: []
            };
        }

        const storage = new Storage({ projectId });
        const bucket = storage.bucket(bucketName);

        // 画像フォルダのプレフィックス
        const imagePrefixes = ['uploads/images/', 'chat-images/'];

        const candidates = [];
        let totalSize = 0;

        for (const prefix of imagePrefixes) {
            const [files] = await bucket.getFiles({ prefix });

            for (const file of files) {
                const fileName = file.name.split('/').pop();
                if (!fileName) continue;

                // データベースで使用されているか確認（注意: 現状は fault_records のみ）
                let isUsed = false;
                if (pool) {
                    try {
                        const query = `
                            SELECT COUNT(*) as count
                            FROM maintenance.fault_records
                            WHERE image_urls LIKE $1
                            OR attachment_urls LIKE $1
                        `;
                        const result = await pool.query(query, [`%${fileName}%`]);
                        isUsed = parseInt(result.rows[0]?.count || 0) > 0;
                    } catch (dbErr) {
                        console.warn(`[Maintenance] DB check skipped for ${fileName}:`, dbErr.message);
                        // DBチェックエラー時は安全のため使用中扱いとして候補から外す（フェイルセーフ）
                        isUsed = true;
                    }
                }

                if (!isUsed) {
                    const [metadata] = await file.getMetadata();
                    const createdDate = new Date(metadata.timeCreated || metadata.updated);
                    const now = new Date();
                    const ageInDays = Math.round((now - createdDate) / (1000 * 60 * 60 * 24));

                    // 7日以上経過した候補
                    if (ageInDays > 7) {
                        const size = parseInt(metadata.size || 0);
                        totalSize += size;
                        candidates.push({
                            name: file.name,
                            fileName: fileName,
                            sizeBytes: size,
                            sizeKB: Math.round(size / 1024),
                            updatedAt: metadata.updated || metadata.timeCreated,
                            ageInDays: ageInDays,
                            prefix: prefix,
                            caution: '他サブシステム（計画・復旧・車両・ユーザーマスタ）で参照されている可能性があります'
                        });
                    }
                }
            }
        }

        // 重要: GCSの file.delete() は絶対に実行しない（Dry Run専用）
        return {
            success: true,
            mode: 'DRY_RUN_ONLY',
            isDeletionEnabled: false,
            message: `孤立画像候補 ${candidates.length}件を検出しました（Dry Run専用・実削除不可）`,
            notice: '【安全保護】本番データ保護のため実削除機能は無効化されています。他サブシステムでの参照関係が完全検証されるまで実削除は実行できません。',
            candidatesCount: candidates.length,
            totalCandidateSizeBytes: totalSize,
            totalCandidateSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
            candidates: candidates.slice(0, 100) // 最大100件返却
        };

    } catch (error) {
        console.error('[Maintenance] Error scanning orphaned images (Dry Run):', error);
        return {
            success: false,
            mode: 'DRY_RUN_ONLY',
            isDeletionEnabled: false,
            error: error.message,
            message: `孤立画像候補の検出に失敗しました: ${error.message}`,
            candidatesCount: 0,
            totalCandidateSizeMB: 0,
            candidates: []
        };
    }
}

/**
 * モジュールバージョンおよび更新ステータスの取得
 * （管理画面からの自動デプロイ・Git操作は行わず、正確なバージョン情報を返却）
 */
async function checkNpmAudit() {
    try {
        let appVersion = '1.0.0';
        let buildTimestamp = process.env.BUILD_TIMESTAMP || 'local-dev';
        let nodeVersion = process.version;

        try {
            const pkgPath = path.join(__dirname, '..', 'package.json');
            const pkgData = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
            appVersion = pkgData.version || appVersion;
        } catch (_) {}

        try {
            const verPath = path.join(__dirname, '..', '.version');
            const verData = (await fs.readFile(verPath, 'utf8')).trim();
            if (verData) buildTimestamp = verData;
        } catch (_) {}

        return {
            success: true,
            versionInfo: {
                appVersion,
                buildTimestamp,
                nodeVersion,
                environment: process.env.NODE_ENV || 'development'
            },
            notice: 'モジュール更新および本番デプロイは GitHub Actions / Cloud Build 経由の承認プロセスで実施されます。'
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            versionInfo: {
                appVersion: '1.0.0',
                nodeVersion: process.version
            }
        };
    }
}

/**
 * ストレージ使用状況を取得
 * Cloud Storage バケット情報および Cloud Monitoring メトリクス / GCS走査を併用
 * テナント別集計、キャッシュ（5分TTL）、フロントエンド互換レスポンスを提供
 */
async function getStorageUsage({ tenantId = null, forceRefresh = false } = {}) {
    const { projectId, bucketName } = getGcpConfig();

    if (!projectId || !bucketName) {
        return {
            success: false,
            isConfigured: false,
            error: 'GCPストレージ設定が未構成です',
            message: 'GOOGLE_CLOUD_PROJECT_ID または GOOGLE_CLOUD_STORAGE_BUCKET が未設定のためストレージ使用量を取得できません',
            bucket: bucketName || '未設定',
            total: 0,
            fileCount: 0,
            limit: 100,
            percentage: 0
        };
    }

    // キャッシュチェック（5分間有効、forceRefresh でバイパス可）
    const now = Date.now();
    const cacheKey = `${tenantId || 'ALL'}_${bucketName}`;
    if (!forceRefresh && storageCache.data && storageCache.tenantKey === cacheKey && (now - storageCache.timestamp < 5 * 60 * 1000)) {
        return {
            ...storageCache.data,
            isCached: true
        };
    }

    const storage = getStorageClient();
    if (!storage) {
        return {
            success: false,
            isConfigured: false,
            error: 'GCSクライアント初期化エラー',
            message: 'Cloud Storage クライアントの初期化に失敗しました'
        };
    }

    try {
        const bucket = storage.bucket(bucketName);

        // 1. バケットメタデータの取得（ロケーション、ストレージクラス、作成日）
        let bucketMeta = {};
        try {
            const [meta] = await bucket.getMetadata();
            bucketMeta = {
                name: bucketName,
                location: meta.location || 'asia-northeast1',
                storageClass: meta.storageClass || 'STANDARD',
                timeCreated: meta.timeCreated ? new Date(meta.timeCreated).toISOString().split('T')[0] : null,
                updated: meta.updated || null
            };
        } catch (metaErr) {
            console.warn('[Maintenance] Bucket metadata fetch error:', metaErr.message);
            bucketMeta = { name: bucketName, location: 'GCP', storageClass: 'STANDARD' };
        }

        // 2. Cloud Monitoring メトリクスの取得試行（容量・オブジェクト数）
        let monitoringTotalBytes = null;
        let monitoringObjectCount = null;
        let metricsSource = 'GCS_OBJECT_SCAN';

        const monitoringClient = getMonitoringClient();
        if (monitoringClient) {
            try {
                const startTime = new Date(Date.now() - 24 * 3600 * 1000);
                const endTime = new Date();

                // 容量メトリクスリクエスト
                const request = {
                    name: `projects/${projectId}`,
                    filter: `metric.type = "storage.googleapis.com/storage/total_bytes" AND resource.labels.bucket_name = "${bucketName}"`,
                    interval: {
                        startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                        endTime: { seconds: Math.floor(endTime.getTime() / 1000) }
                    },
                    view: 'FULL'
                };

                const [timeSeries] = await monitoringClient.listTimeSeries(request);
                if (timeSeries && timeSeries.length > 0 && timeSeries[0].points && timeSeries[0].points.length > 0) {
                    const latestPoint = timeSeries[0].points[0];
                    monitoringTotalBytes = parseInt(latestPoint.value.int64Value || latestPoint.value.doubleValue || 0, 10);
                    metricsSource = 'CLOUD_MONITORING_METRICS';
                }
            } catch (monErr) {
                // Cloud Monitoring API が未有効または権限不足の場合は GCS走査でフォールバック
                console.warn('[Maintenance] Cloud Monitoring metrics not available, using GCS scan:', monErr.message);
            }
        }

        // 3. GCS オブジェクト走査（テナント別およびフォルダ別集計）
        // テナント指定時はそのプレフィックスに限定して高速化
        const scanOptions = { autoPaginate: true, maxResults: 1000 };
        if (tenantId) {
            scanOptions.prefix = `tenants/${tenantId}/`;
        }

        const [files] = await bucket.getFiles(scanOptions);

        let totalSize = 0;
        let totalFiles = files.length;
        const breakdown = {
            uploads: 0,
            logs: 0,
            temp: 0,
            aiKnowledge: 0,
            chatExports: 0,
            tenants: 0,
            other: 0
        };

        const tenantBreakdown = {};

        for (const file of files) {
            const size = parseInt(file.metadata?.size || 0, 10);
            totalSize += size;
            const name = file.name || '';

            // フォルダ別集計
            if (name.startsWith('uploads/')) {
                breakdown.uploads += size;
            } else if (name.startsWith('logs/')) {
                breakdown.logs += size;
            } else if (name.startsWith('temp/') || name.startsWith('tmp/')) {
                breakdown.temp += size;
            } else if (name.startsWith('ai-knowledge/') || name.startsWith('ai-context/')) {
                breakdown.aiKnowledge += size;
            } else if (name.startsWith('chat-exports/')) {
                breakdown.chatExports += size;
            } else if (name.startsWith('tenants/')) {
                breakdown.tenants += size;
            } else {
                breakdown.other += size;
            }

            // テナント別プレフィックス（tenants/{tenantId}/...）の解析
            if (name.startsWith('tenants/')) {
                const parts = name.split('/');
                const tKey = parts[1] || 'unknown';
                if (!tenantBreakdown[tKey]) {
                    tenantBreakdown[tKey] = { bytes: 0, files: 0 };
                }
                tenantBreakdown[tKey].bytes += size;
                tenantBreakdown[tKey].files++;
            }
        }

        // Monitoringメトリクスが有効かつ全体集計（tenantId指定なし）の場合、全体容量を同期
        const finalTotalBytes = (monitoringTotalBytes !== null && !tenantId) ? monitoringTotalBytes : totalSize;

        const toMB = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;
        const toGB = (bytes) => Math.round((bytes / 1024 / 1024 / 1024) * 100) / 100;

        const totalGB = toGB(finalTotalBytes);
        const totalMB = toMB(finalTotalBytes);

        // テナント内訳のGB変換
        const formattedTenantBreakdown = {};
        Object.entries(tenantBreakdown).forEach(([k, v]) => {
            formattedTenantBreakdown[k] = {
                bytes: v.bytes,
                sizeMB: toMB(v.bytes),
                sizeGB: toGB(v.bytes),
                files: v.files,
                label: `${toMB(v.bytes)} MB (${v.files}件)`
            };
        });

        // 契約上限・目安（100GB）
        const storageLimitGB = 100;
        const percentage = Math.min(100, Math.round((totalGB / storageLimitGB) * 100));

        const resultData = {
            success: true,
            isConfigured: true,
            source: metricsSource,
            collectedAt: new Date().toISOString(),
            measured_at: new Date().toLocaleString('ja-JP'),
            bucket: bucketName,
            bucketInfo: bucketMeta,
            total: totalGB,
            totalMB: totalMB,
            total_formatted: `${totalGB} GB (${totalMB} MB)`,
            totalBytes: finalTotalBytes,
            fileCount: totalFiles,
            limit: storageLimitGB,
            percentage,
            filterTenantId: tenantId || 'ALL',
            breakdown: {
                uploads: `${toGB(breakdown.uploads)} GB`,
                logs: `${toGB(breakdown.logs)} GB`,
                temp: `${toGB(breakdown.temp)} GB`,
                aiKnowledge: `${toGB(breakdown.aiKnowledge)} GB`,
                chatExports: `${toGB(breakdown.chatExports)} GB`,
                tenants: `${toGB(breakdown.tenants)} GB`,
                other: `${toGB(breakdown.other)} GB`
            },
            breakdownBytes: breakdown,
            tenantBreakdown: formattedTenantBreakdown
        };

        // キャッシュ保存
        storageCache = {
            timestamp: Date.now(),
            tenantKey: cacheKey,
            data: resultData
        };

        return resultData;

    } catch (error) {
        console.error('[Maintenance] Error getting storage usage:', error.message);
        return {
            success: false,
            isConfigured: false,
            error: error.message,
            message: `ストレージ使用量の取得に失敗しました (GCS: ${error.message})`,
            bucket: bucketName,
            total: 0,
            fileCount: 0,
            limit: 100,
            percentage: 0
        };
    }
}

/**
 * 証明書・各種期限ステータスを取得（実DBデータ反映＆モック偽装廃止）
 */
async function getCertificateStatus(pool = null) {
    try {
        const certificates = [];

        // 1. 端末証明書 (mTLS): DB public.device_certificates から取得
        let nearestCertExpiryDays = null;
        let warningDeviceCount = 0;
        let criticalDeviceCount = 0;

        if (pool) {
            try {
                const query = `
                    SELECT dc.valid_to, d.device_name, d.device_identifier
                    FROM public.device_certificates dc
                    JOIN public.devices d ON d.id = dc.device_id
                    WHERE dc.is_revoked = false AND d.is_active = true
                    ORDER BY dc.valid_to ASC
                    LIMIT 20
                `;
                const res = await pool.query(query);
                const now = new Date();

                for (const row of res.rows) {
                    if (row.valid_to) {
                        const validToDate = new Date(row.valid_to);
                        const daysRemaining = Math.round((validToDate - now) / (1000 * 60 * 60 * 24));
                        if (nearestCertExpiryDays === null || daysRemaining < nearestCertExpiryDays) {
                            nearestCertExpiryDays = daysRemaining;
                        }
                        if (daysRemaining <= 7) criticalDeviceCount++;
                        else if (daysRemaining <= 30) warningDeviceCount++;
                    }
                }
            } catch (dbErr) {
                console.warn('[Maintenance] Certificate status DB fetch error:', dbErr.message);
            }
        }

        if (nearestCertExpiryDays !== null) {
            let certStatus = 'ok';
            let certLabel = `${nearestCertExpiryDays}日後`;
            if (nearestCertExpiryDays <= 7) {
                certStatus = 'danger';
                certLabel = `${nearestCertExpiryDays}日後 (至急更新)`;
            } else if (nearestCertExpiryDays <= 30) {
                certStatus = 'warning';
                certLabel = `${nearestCertExpiryDays}日後 (警告)`;
            }

            certificates.push({
                name: '端末証明書 (mTLS 最短)',
                daysRemaining: nearestCertExpiryDays,
                status: certStatus,
                statusLabel: certLabel,
                source: 'DATABASE_DEVICE_CERTIFICATES',
                warningCount: warningDeviceCount,
                criticalCount: criticalDeviceCount
            });
        } else {
            certificates.push({
                name: '端末証明書 (mTLS)',
                daysRemaining: null,
                status: 'info',
                statusLabel: '無期限 / 未登録',
                source: 'DATABASE_DEVICE_CERTIFICATES'
            });
        }

        // 2. 外部SSL/TLS証明書（Cloud Load Balancer管理のためアプリ直接管理外であることを正直に明記）
        certificates.push({
            name: 'Web SSL証明書',
            daysRemaining: null,
            status: 'managed',
            statusLabel: 'GCP LB自動管理 (Google管理証明書)',
            source: 'GCP_MANAGED_CERTIFICATE'
        });

        // 3. データ保持期限
        certificates.push({
            name: 'データ保持ポリシー',
            daysRemaining: null,
            status: 'ok',
            statusLabel: '無期限保管 (現行設定)',
            source: 'SYSTEM_CONFIG'
        });

        return {
            success: true,
            certificates,
            collectedAt: new Date().toISOString()
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            certificates: []
        };
    }
}

module.exports = {
    getTempFilesSummary,
    cleanTempFiles,
    backupLogs,
    cleanOrphanedImages,
    checkNpmAudit,
    getStorageUsage,
    getCertificateStatus
};
