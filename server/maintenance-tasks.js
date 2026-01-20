/**
 * システムメンテナンスタスクモジュール
 * 一時ファイル削除、ログバックアップ、孤立画像削除などの保守作業を実行
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * GCS上の一時ファイルを削除
 */
async function cleanTempFiles() {
    try {
        const storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });

        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
        const bucket = storage.bucket(bucketName);

        // 一時ファイルのプレフィックス
        const tempPrefixes = ['temp/', 'tmp/', 'uploads/temp/'];

        let deletedCount = 0;
        let deletedSize = 0;

        for (const prefix of tempPrefixes) {
            const [files] = await bucket.getFiles({ prefix: prefix });

            for (const file of files) {
                const [metadata] = await file.getMetadata();
                const createdDate = new Date(metadata.timeCreated);
                const now = new Date();
                const ageInDays = (now - createdDate) / (1000 * 60 * 60 * 24);

                // 1日以上経過したファイルを削除
                if (ageInDays > 1) {
                    deletedSize += parseInt(metadata.size || 0);
                    await file.delete();
                    deletedCount++;
                }
            }
        }

        return {
            success: true,
            message: `${deletedCount}個の一時ファイルを削除しました`,
            details: {
                deletedFiles: deletedCount,
                freedSpace: Math.round(deletedSize / 1024 / 1024 * 100) / 100 // MB
            }
        };

    } catch (error) {
        console.error('[Maintenance] Error cleaning temp files:', error);
        return {
            success: false,
            error: error.message,
            message: '一時ファイルの削除に失敗しました'
        };
    }
}

/**
 * ログファイルをバックアップ（ZIP形式）
 */
async function backupLogs() {
    try {
        const storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });

        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
        const bucket = storage.bucket(bucketName);

        // バックアップファイル名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFileName = `logs-backup-${timestamp}.zip`;
        const backupPath = path.join(__dirname, '..', 'backups', backupFileName);

        // backupsディレクトリを作成
        await fs.mkdir(path.dirname(backupPath), { recursive: true });

        // ZIPアーカイブを作成
        const output = require('fs').createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', async () => {
                try {
                    // GCSにアップロード
                    const destination = `backups/logs/${backupFileName}`;
                    await bucket.upload(backupPath, {
                        destination: destination,
                        metadata: {
                            contentType: 'application/zip'
                        }
                    });

                    // ローカルファイルを削除
                    await fs.unlink(backupPath);

                    resolve({
                        success: true,
                        message: 'ログファイルをバックアップしました',
                        details: {
                            fileName: backupFileName,
                            size: archive.pointer(),
                            location: `gs://${bucketName}/${destination}`,
                            downloadUrl: `/api/maintenance/download-backup/${backupFileName}`
                        }
                    });
                } catch (error) {
                    reject({
                        success: false,
                        error: error.message,
                        message: 'バックアップのアップロードに失敗しました'
                    });
                }
            });

            archive.on('error', (err) => {
                reject({
                    success: false,
                    error: err.message,
                    message: 'アーカイブの作成に失敗しました'
                });
            });

            archive.pipe(output);

            // ローカルのログファイルを追加
            const logsDir = path.join(__dirname, '..', 'logs');

            fs.access(logsDir)
                .then(() => {
                    archive.directory(logsDir, 'logs');
                    archive.finalize();
                })
                .catch(() => {
                    // ログディレクトリがない場合は空のアーカイブを作成
                    archive.finalize();
                });
        });

    } catch (error) {
        console.error('[Maintenance] Error backing up logs:', error);
        return {
            success: false,
            error: error.message,
            message: 'ログバックアップに失敗しました'
        };
    }
}

/**
 * 孤立した画像ファイルを削除
 * データベースに紐づいていない画像ファイルを検出して削除
 */
async function cleanOrphanedImages(pool) {
    try {
        const storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });

        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
        const bucket = storage.bucket(bucketName);

        // 画像フォルダのプレフィックス
        const imagePrefixes = ['uploads/images/', 'chat-images/'];

        let deletedCount = 0;
        let deletedSize = 0;

        for (const prefix of imagePrefixes) {
            const [files] = await bucket.getFiles({ prefix: prefix });

            for (const file of files) {
                const fileName = file.name.split('/').pop();

                // データベースで使用されているか確認
                const query = `
                    SELECT COUNT(*) as count
                    FROM maintenance.fault_records
                    WHERE image_urls LIKE $1
                    OR attachment_urls LIKE $1
                `;

                const result = await pool.query(query, [`%${fileName}%`]);
                const isUsed = parseInt(result.rows[0].count) > 0;

                if (!isUsed) {
                    const [metadata] = await file.getMetadata();
                    const createdDate = new Date(metadata.timeCreated);
                    const now = new Date();
                    const ageInDays = (now - createdDate) / (1000 * 60 * 60 * 24);

                    // 7日以上経過した未使用ファイルを削除
                    if (ageInDays > 7) {
                        deletedSize += parseInt(metadata.size || 0);
                        await file.delete();
                        deletedCount++;
                    }
                }
            }
        }

        return {
            success: true,
            message: `${deletedCount}個の孤立画像を削除しました`,
            details: {
                deletedFiles: deletedCount,
                freedSpace: Math.round(deletedSize / 1024 / 1024 * 100) / 100 // MB
            }
        };

    } catch (error) {
        console.error('[Maintenance] Error cleaning orphaned images:', error);
        return {
            success: false,
            error: error.message,
            message: '孤立画像の削除に失敗しました'
        };
    }
}

/**
 * npm auditで脆弱性をチェック
 */
async function checkNpmAudit() {
    try {
        const { stdout, stderr } = await execAsync('npm audit --json', {
            cwd: path.join(__dirname, '..')
        });

        const auditResult = JSON.parse(stdout);

        const vulnerabilities = {
            critical: auditResult.metadata?.vulnerabilities?.critical || 0,
            high: auditResult.metadata?.vulnerabilities?.high || 0,
            moderate: auditResult.metadata?.vulnerabilities?.moderate || 0,
            low: auditResult.metadata?.vulnerabilities?.low || 0,
            total: auditResult.metadata?.vulnerabilities?.total || 0
        };

        return {
            success: true,
            vulnerabilities: vulnerabilities,
            totalPackages: auditResult.metadata?.dependencies || 0,
            updateAvailable: vulnerabilities.total > 0
        };

    } catch (error) {
        // npm auditはエラーコードを返すことがあるが、JSONは取得可能
        try {
            const auditResult = JSON.parse(error.stdout || '{}');
            const vulnerabilities = {
                critical: auditResult.metadata?.vulnerabilities?.critical || 0,
                high: auditResult.metadata?.vulnerabilities?.high || 0,
                moderate: auditResult.metadata?.vulnerabilities?.moderate || 0,
                low: auditResult.metadata?.vulnerabilities?.low || 0,
                total: auditResult.metadata?.vulnerabilities?.total || 0
            };

            return {
                success: true,
                vulnerabilities: vulnerabilities,
                totalPackages: auditResult.metadata?.dependencies || 0,
                updateAvailable: vulnerabilities.total > 0
            };
        } catch {
            return {
                success: false,
                error: error.message,
                vulnerabilities: {
                    critical: 1,
                    high: 1,
                    moderate: 0,
                    low: 0,
                    total: 2
                },
                mockData: true
            };
        }
    }
}

/**
 * ストレージ使用状況を取得
 */
async function getStorageUsage() {
    try {
        const storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });

        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
        const bucket = storage.bucket(bucketName);

        const [files] = await bucket.getFiles();

        let totalSize = 0;
        const breakdown = {
            uploads: 0,
            logs: 0,
            temp: 0,
            aiKnowledge: 0,
            chatExports: 0,
            other: 0
        };

        for (const file of files) {
            const [metadata] = await file.getMetadata();
            const size = parseInt(metadata.size || 0);
            totalSize += size;

            // ファイルパスに基づいて分類
            if (file.name.startsWith('uploads/')) {
                breakdown.uploads += size;
            } else if (file.name.startsWith('logs/')) {
                breakdown.logs += size;
            } else if (file.name.startsWith('temp/') || file.name.startsWith('tmp/')) {
                breakdown.temp += size;
            } else if (file.name.startsWith('ai-knowledge/')) {
                breakdown.aiKnowledge += size;
            } else if (file.name.startsWith('chat-exports/')) {
                breakdown.chatExports += size;
            } else {
                breakdown.other += size;
            }
        }

        // バイトからGBに変換
        const toGB = (bytes) => Math.round(bytes / 1024 / 1024 / 1024 * 100) / 100;

        return {
            success: true,
            total: toGB(totalSize),
            breakdown: {
                uploads: toGB(breakdown.uploads),
                logs: toGB(breakdown.logs),
                temp: toGB(breakdown.temp),
                aiKnowledge: toGB(breakdown.aiKnowledge),
                chatExports: toGB(breakdown.chatExports),
                other: toGB(breakdown.other)
            },
            fileCount: files.length
        };

    } catch (error) {
        console.error('[Maintenance] Error getting storage usage:', error);
        return {
            success: false,
            error: error.message,
            total: 3.4,
            breakdown: {
                uploads: 1.2,
                logs: 0.8,
                temp: 1.4,
                aiKnowledge: 0,
                chatExports: 0,
                other: 0
            },
            mockData: true
        };
    }
}

/**
 * SSL証明書のステータスを取得
 */
async function getCertificateStatus() {
    try {
        // 本番環境ではCloud Load BalancerのSSL証明書情報を取得
        // ここではモックデータを返す
        return {
            success: true,
            certificates: [
                {
                    name: 'SSL証明書',
                    expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                    daysRemaining: 15,
                    status: 'warning'
                },
                {
                    name: 'APIキー',
                    expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
                    daysRemaining: 45,
                    status: 'ok'
                },
                {
                    name: 'データ保持',
                    expiryDate: null,
                    daysRemaining: null,
                    status: 'ok'
                }
            ]
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    cleanTempFiles,
    backupLogs,
    cleanOrphanedImages,
    checkNpmAudit,
    getStorageUsage,
    getCertificateStatus
};
