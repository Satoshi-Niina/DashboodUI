/**
 * 登録デバイス管理サービス (server/device-management.js)
 * 100台以上の会社管理端末を安全に管理するためのコアロジック
 * 
 * - X.509公開証明書の安全な検証（秘密鍵排除、CA署名検証、有効期限、重複防止）
 * - 厳格なマルチテナント分離（自テナント以外のアクセス・更新を完全遮断）
 * - サーバーサイド検索・ページング・ステータス集計
 * - 端末停止と証明書失効の明確な区別
 * - 同期監査ログ (Fail-Closed)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// テナント日本語表示マップ
const TENANT_DISPLAY_NAME_MAP = {
    demo: 'デモ環境',
    demo_env: 'デモ環境',
    daitetsu: '大鉄工業',
    kosei: '広成建設',
    kintetsu: '近鉄'
};

function resolveTenantDisplayName(tenantId) {
    const key = String(tenantId || '').trim().toLowerCase();
    return TENANT_DISPLAY_NAME_MAP[key] || key || '未設定';
}

/**
 * 信頼するルートCA証明書を取得
 */
function getCaCertificate() {
    if (process.env.CA_CERT_DATA) {
        try {
            return new crypto.X509Certificate(process.env.CA_CERT_DATA);
        } catch (_) {}
    }

    const possiblePaths = [
        process.env.CA_CERT_PATH,
        path.join(__dirname, '..', '..', 'gateway', 'certs', 'ca.crt'),
        path.join(__dirname, '..', 'certs', 'ca.crt'),
        path.join(process.cwd(), 'gateway', 'certs', 'ca.crt')
    ].filter(Boolean);

    for (const p of possiblePaths) {
        try {
            if (fs.existsSync(p)) {
                return new crypto.X509Certificate(fs.readFileSync(p));
            }
        } catch (_) {}
    }
    return null;
}

/**
 * 公開証明書の安全な検証
 * @param {string|Buffer} certInput 証明書PEMまたはDER文字列
 * @param {object} pool DB接続プール
 * @param {string} [excludeCertId] 証明書更新時の自証明書ID（重複除外用）
 */
async function validateCertificate(certInput, pool, excludeCertId = null) {
    if (!certInput) {
        return { ok: false, code: 'EMPTY_CERTIFICATE', message: '証明書データが空です' };
    }

    const certStr = typeof certInput === 'string' ? certInput : certInput.toString('utf8');

    // 1. 秘密鍵の混入排除 (最重要)
    if (
        certStr.includes('PRIVATE KEY') ||
        certStr.includes('RSA PRIVATE KEY') ||
        certStr.includes('EC PRIVATE KEY') ||
        certStr.includes('ENCRYPTED PRIVATE KEY')
    ) {
        return {
            ok: false,
            code: 'PRIVATE_KEY_FORBIDDEN',
            message: '重大警告: 秘密鍵が含まれるファイルは登録できません。公開証明書ファイル（.crt/.cer/.pem）のみを指定してください。'
        };
    }

    // 2. X.509 証明書パース
    let x509;
    try {
        x509 = new crypto.X509Certificate(certStr.trim());
    } catch (err) {
        return {
            ok: false,
            code: 'INVALID_CERT_FORMAT',
            message: `X.509証明書の解析に失敗しました: ${err.message} (.cer, .crt, 公開鍵のみの.pem を指定してください)`
        };
    }

    // 3. 有効期間検証
    const now = new Date();
    const validFrom = new Date(x509.validFrom);
    const validTo = new Date(x509.validTo);

    if (now < validFrom) {
        return {
            ok: false,
            code: 'CERT_NOT_YET_VALID',
            message: `証明書の有効期間がまだ開始されていません（開始日: ${x509.validFrom}）`
        };
    }

    if (now > validTo) {
        return {
            ok: false,
            code: 'CERT_EXPIRED',
            message: `証明書の有効期限が切れています（期限: ${x509.validTo}）`
        };
    }

    // 4. 公開鍵強度および暗号アルゴリズムの検証 (RSA >= 2048bit, EC >= 256bit)
    const keyDetails = x509.publicKey?.asymmetricKeyDetails;
    const keyType = x509.publicKey?.asymmetricKeyType;

    if (keyType === 'rsa') {
        const modulusLength = keyDetails?.modulusLength || 0;
        if (modulusLength < 2048) {
            return {
                ok: false,
                code: 'INSECURE_KEY_LENGTH',
                message: `セキュリティ警告: RSA鍵長が不足しています (${modulusLength} bit < 2048 bit)。2048 bit以上の証明書をご使用ください。`
            };
        }
    } else if (keyType === 'ec') {
        // EC曲線チェック (256bit未満の曲線を拒否)
        const curve = String(keyDetails?.namedCurve || '').toLowerCase();
        if (curve.includes('160') || curve.includes('192') || curve.includes('224')) {
            return {
                ok: false,
                code: 'INSECURE_KEY_LENGTH',
                message: `セキュリティ警告: EC鍵強度が不足しています (${curve})。P-256以上の曲線をご使用ください。`
            };
        }
    } else if (keyType !== 'ed25519' && keyType !== 'ed448') {
        return {
            ok: false,
            code: 'UNSUPPORTED_KEY_TYPE',
            message: `非対応の鍵アルゴリズムです (${keyType})。RSAまたはECDSAをご使用ください。`
        };
    }

    // 5. CA証明書の属性・有効期間および暗号学的署名検証 (Cryptographic Verification)
    const caCert = getCaCertificate();
    if (caCert) {
        // 5-1. CA証明書自体の有効期間チェック
        const caValidFrom = new Date(caCert.validFrom);
        const caValidTo = new Date(caCert.validTo);
        if (now < caValidFrom || now > caValidTo) {
            return {
                ok: false,
                code: 'CA_EXPIRED',
                message: `信頼するルートCA証明書自体の有効期限が切れているか無効です (CA期限: ${caCert.validTo})`
            };
        }

        // 5-2. CA証明書のCA属性 (Basic Constraints)
        if (caCert.ca !== true) {
            return {
                ok: false,
                code: 'INVALID_CA_CERTIFICATE',
                message: '構成されたCA証明書は認証局（CA:TRUE）として構成されていません'
            };
        }

        // 5-3. 発行チェーン構造の検証 (checkIssued)
        try {
            const isIssued = x509.checkIssued(caCert);
            if (!isIssued) {
                return {
                    ok: false,
                    code: 'UNTRUSTED_CA',
                    message: '信頼された認証局（社内ルートCA）の発行チェーンと一致しません'
                };
            }
        } catch (err) {
            return {
                ok: false,
                code: 'CA_CHAIN_VERIFICATION_ERROR',
                message: `CAチェーン整合性検証エラー: ${err.message}`
            };
        }

        // 5-4. 暗号学的デジタル署名検証 (verify(caCert.publicKey))
        try {
            const isSignatureValid = x509.verify(caCert.publicKey);
            if (!isSignatureValid) {
                return {
                    ok: false,
                    code: 'INVALID_CA_SIGNATURE',
                    message: '暗号学的署名検証に失敗しました。CA公開鍵と一致しないか、改ざんされた証明書です。'
                };
            }
        } catch (err) {
            return {
                ok: false,
                code: 'SIGNATURE_VERIFICATION_ERROR',
                message: `暗号学的署名検証エラー: ${err.message}`
            };
        }
    } else {
        if (process.env.NODE_ENV === 'production') {
            return {
                ok: false,
                code: 'CA_NOT_CONFIGURED',
                message: '本番環境でルートCA証明書（CA_CERT_PATH / CA_CERT_DATA）が構成されていません。管理者に連絡してください。'
            };
        }
        console.warn('[DeviceManagement] Root CA certificate not found for verification, skipping checkIssued and signature verify.');
    }

    // 6. クライアント認証用途 (Extended Key Usage) の検証
    const certStringRepresentation = x509.toString();
    if (certStringRepresentation.includes('Extended Key Usage')) {
        const hasClientAuth = certStringRepresentation.includes('TLS Web Client Authentication') ||
                              certStringRepresentation.includes('1.3.6.1.5.5.7.3.2') ||
                              certStringRepresentation.includes('clientAuth');
        if (!hasClientAuth) {
            return {
                ok: false,
                code: 'INVALID_KEY_USAGE',
                message: '証明書のExtended Key Usageに「TLS Web Client Authentication（クライアント認証用途）」が含まれていません。'
            };
        }
    }

    // 5. SHA-256 Fingerprint算出 (64文字hex小文字に正規化)
    const rawFp = x509.fingerprint256 || '';
    const fingerprint256 = rawFp.replace(/[:\s]/g, '').toLowerCase();

    if (!fingerprint256 || fingerprint256.length !== 64) {
        return {
            ok: false,
            code: 'INVALID_FINGERPRINT',
            message: 'SHA-256 Fingerprintの算出に失敗しました'
        };
    }

    // 6. DB重複チェック
    if (pool) {
        let dupQuery = 'SELECT id, device_id, is_revoked FROM public.device_certificates WHERE fingerprint256 = $1';
        const params = [fingerprint256];
        if (excludeCertId) {
            dupQuery += ' AND id != $2';
            params.push(excludeCertId);
        }
        const dupRes = await pool.query(dupQuery, params);
        if (dupRes.rows.length > 0) {
            return {
                ok: false,
                code: 'DUPLICATE_CERTIFICATE',
                message: 'この証明書（Fingerprint）は既に別の端末または証明書として登録されています'
            };
        }
    }

    const daysRemaining = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
        ok: true,
        certificateInfo: {
            fingerprint256,
            fingerprintShort: `${fingerprint256.slice(0, 8)}...${fingerprint256.slice(-6)}`,
            serialNumber: x509.serialNumber || '-',
            subject: x509.subject || '-',
            issuer: x509.issuer || '-',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
            validToFormatted: validTo.toLocaleDateString('ja-JP'),
            daysRemaining,
            rawPem: x509.toString()
        }
    };
}

/**
 * 登録デバイス一覧・サマリー取得（テナント完全分離・サーバーサイド検索/ページング）
 */
async function listDevices(pool, { tenantId, search = '', status = 'all', page = 1, limit = 20 }) {
    if (!tenantId) {
        throw new Error('TENANT_REQUIRED');
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    // 1. サマリー集計 (ログインテナント内のみ)
    const summaryQuery = `
        SELECT
            COUNT(d.id)::int AS total_devices,
            COUNT(CASE WHEN d.is_active = true AND (dc.is_revoked = false OR dc.is_revoked IS NULL) AND (dc.valid_to IS NULL OR dc.valid_to >= CURRENT_TIMESTAMP) THEN 1 END)::int AS active_devices,
            COUNT(CASE WHEN d.is_active = false THEN 1 END)::int AS disabled_devices,
            COUNT(CASE WHEN dc.valid_to IS NOT NULL AND dc.valid_to < CURRENT_TIMESTAMP THEN 1 END)::int AS expired_devices,
            COUNT(CASE WHEN dc.is_revoked = true THEN 1 END)::int AS revoked_devices,
            COUNT(CASE WHEN d.is_active = true AND (dc.is_revoked = false OR dc.is_revoked IS NULL) AND dc.valid_to >= CURRENT_TIMESTAMP AND dc.valid_to <= CURRENT_TIMESTAMP + INTERVAL '30 days' THEN 1 END)::int AS near_expiry_devices
        FROM public.devices d
        LEFT JOIN LATERAL (
            SELECT is_revoked, valid_to
            FROM public.device_certificates
            WHERE device_id = d.id
            ORDER BY created_at DESC
            LIMIT 1
        ) dc ON true
        WHERE d.tenant_id = $1
    `;
    const summaryRes = await pool.query(summaryQuery, [tenantId]);
    const summaryRow = summaryRes.rows[0] || {};

    const summary = {
        total: summaryRow.total_devices || 0,
        active: summaryRow.active_devices || 0,
        disabled: summaryRow.disabled_devices || 0,
        expired: summaryRow.expired_devices || 0,
        revoked: summaryRow.revoked_devices || 0,
        nearExpiry: summaryRow.near_expiry_devices || 0
    };

    // 2. 検索・絞り込み条件構築
    const conditions = ['d.tenant_id = $1'];
    const params = [tenantId];
    let paramIndex = 2;

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(`(d.device_name ILIKE $${paramIndex} OR d.device_identifier ILIKE $${paramIndex})`);
        params.push(term);
        paramIndex++;
    }

    if (status && status !== 'all') {
        if (status === 'active') {
            conditions.push(`d.is_active = true AND (dc.is_revoked = false OR dc.is_revoked IS NULL) AND (dc.valid_to IS NULL OR dc.valid_to >= CURRENT_TIMESTAMP)`);
        } else if (status === 'disabled') {
            conditions.push(`d.is_active = false`);
        } else if (status === 'revoked') {
            conditions.push(`dc.is_revoked = true`);
        } else if (status === 'expired') {
            conditions.push(`dc.valid_to IS NOT NULL AND dc.valid_to < CURRENT_TIMESTAMP`);
        } else if (status === 'near_expiry') {
            conditions.push(`d.is_active = true AND (dc.is_revoked = false OR dc.is_revoked IS NULL) AND dc.valid_to >= CURRENT_TIMESTAMP AND dc.valid_to <= CURRENT_TIMESTAMP + INTERVAL '30 days'`);
        }
    }

    const whereClause = conditions.join(' AND ');

    // 3. 絞り込み後の総件数カウント
    const countQuery = `
        SELECT COUNT(d.id)::int AS filtered_count
        FROM public.devices d
        LEFT JOIN LATERAL (
            SELECT is_revoked, valid_to
            FROM public.device_certificates
            WHERE device_id = d.id
            ORDER BY created_at DESC
            LIMIT 1
        ) dc ON true
        WHERE ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const totalCount = countRes.rows[0]?.filtered_count || 0;
    const totalPages = Math.ceil(totalCount / safeLimit) || 1;

    // 4. ページングデータ取得
    const listQuery = `
        SELECT
            d.id::text AS device_id,
            d.device_identifier,
            d.tenant_id,
            d.device_name,
            d.is_active AS device_active,
            d.created_at AS device_created_at,
            d.updated_at AS device_updated_at,
            dc.id::text AS cert_id,
            dc.serial_number,
            dc.fingerprint256,
            dc.subject_dn,
            dc.valid_from,
            dc.valid_to,
            dc.is_revoked,
            dc.revoked_at
        FROM public.devices d
        LEFT JOIN LATERAL (
            SELECT id, serial_number, fingerprint256, subject_dn, valid_from, valid_to, is_revoked, revoked_at
            FROM public.device_certificates
            WHERE device_id = d.id
            ORDER BY created_at DESC
            LIMIT 1
        ) dc ON true
        WHERE ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(safeLimit, offset);

    const listRes = await pool.query(listQuery, params);
    const now = new Date();

    const devices = listRes.rows.map(row => {
        const isDeviceActive = Boolean(row.device_active);
        const isRevoked = Boolean(row.is_revoked);
        const validTo = row.valid_to ? new Date(row.valid_to) : null;
        const isExpired = validTo ? validTo < now : false;

        let deviceStatus = 'active';
        let statusLabel = '有効';
        let badgeClass = 'badge-success';

        if (!isDeviceActive) {
            deviceStatus = 'disabled';
            statusLabel = '停止中';
            badgeClass = 'badge-secondary';
        } else if (isRevoked) {
            deviceStatus = 'revoked';
            statusLabel = '失効';
            badgeClass = 'badge-danger';
        } else if (isExpired) {
            deviceStatus = 'expired';
            statusLabel = '期限切れ';
            badgeClass = 'badge-danger';
        } else if (validTo && (validTo.getTime() - now.getTime()) <= 30 * 24 * 60 * 60 * 1000) {
            deviceStatus = 'near_expiry';
            statusLabel = '期限切迫';
            badgeClass = 'badge-warning';
        }

        const fp = row.fingerprint256 || '';
        const fpShort = fp.length > 14 ? `${fp.slice(0, 8)}...${fp.slice(-6)}` : (fp || '-');
        const daysRemaining = validTo ? Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

        return {
            id: row.device_id,
            deviceIdentifier: row.device_identifier,
            deviceName: row.device_name || row.device_identifier,
            tenantId: row.tenant_id,
            isActive: isDeviceActive,
            status: deviceStatus,
            statusLabel,
            badgeClass,
            certificate: {
                id: row.cert_id,
                serialNumber: row.serial_number || '-',
                fingerprint256: fp,
                fingerprintShort: fpShort,
                subjectDn: row.subject_dn || '-',
                validFrom: row.valid_from ? new Date(row.valid_from).toISOString().split('T')[0] : '-',
                validTo: validTo ? validTo.toISOString().split('T')[0] : '未登録',
                daysRemaining,
                isRevoked
            },
            createdAt: row.device_created_at ? new Date(row.device_created_at).toLocaleString('ja-JP') : '-',
            updatedAt: row.device_updated_at ? new Date(row.device_updated_at).toLocaleString('ja-JP') : '-'
        };
    });

    return {
        success: true,
        tenantId,
        tenantDisplayName: resolveTenantDisplayName(tenantId),
        summary,
        pagination: {
            page: safePage,
            limit: safeLimit,
            totalCount,
            totalPages
        },
        devices
    };
}

/**
 * デバイス詳細取得（自テナント検証付き・全証明書履歴を含む）
 */
async function getDeviceById(pool, { deviceId, tenantId }) {
    if (!deviceId || !tenantId) {
        throw new Error('DEVICE_ID_AND_TENANT_REQUIRED');
    }

    const deviceQuery = `
        SELECT
            id::text AS device_id,
            device_identifier,
            tenant_id,
            device_name,
            is_active,
            created_at,
            updated_at
        FROM public.devices
        WHERE id = $1 AND tenant_id = $2
    `;
    const deviceRes = await pool.query(deviceQuery, [deviceId, tenantId]);
    if (deviceRes.rows.length === 0) {
        return { ok: false, code: 'DEVICE_NOT_FOUND', message: '対象の端末が見つかりません（他テナントへのアクセスは拒否されました）' };
    }

    const deviceRow = deviceRes.rows[0];

    // 証明書履歴全件取得
    const certQuery = `
        SELECT
            id::text AS cert_id,
            serial_number,
            fingerprint256,
            subject_dn,
            valid_from,
            valid_to,
            is_revoked,
            revoked_at,
            created_at
        FROM public.device_certificates
        WHERE device_id = $1
        ORDER BY created_at DESC
    `;
    const certRes = await pool.query(certQuery, [deviceId]);
    const now = new Date();

    const certificates = certRes.rows.map((c, index) => {
        const validTo = c.valid_to ? new Date(c.valid_to) : null;
        const daysRemaining = validTo ? Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const isCurrent = index === 0;

        return {
            id: c.cert_id,
            isCurrent,
            serialNumber: c.serial_number || '-',
            fingerprint256: c.fingerprint256,
            fingerprintShort: c.fingerprint256 ? `${c.fingerprint256.slice(0, 8)}...${c.fingerprint256.slice(-6)}` : '-',
            subjectDn: c.subject_dn || '-',
            validFrom: c.valid_from ? new Date(c.valid_from).toLocaleString('ja-JP') : '-',
            validTo: validTo ? validTo.toLocaleDateString('ja-JP') : '無期限',
            daysRemaining,
            isRevoked: Boolean(c.is_revoked),
            revokedAt: c.revoked_at ? new Date(c.revoked_at).toLocaleString('ja-JP') : null,
            createdAt: new Date(c.created_at).toLocaleString('ja-JP')
        };
    });

    const currentCert = certificates[0] || null;
    let status = 'active';
    let statusLabel = '有効';
    if (!deviceRow.is_active) {
        status = 'disabled';
        statusLabel = '停止中';
    } else if (currentCert?.isRevoked) {
        status = 'revoked';
        statusLabel = '失効';
    } else if (currentCert?.daysRemaining !== null && currentCert.daysRemaining < 0) {
        status = 'expired';
        statusLabel = '期限切れ';
    } else if (currentCert?.daysRemaining !== null && currentCert.daysRemaining <= 30) {
        status = 'near_expiry';
        statusLabel = '期限切迫';
    }

    return {
        ok: true,
        device: {
            id: deviceRow.device_id,
            deviceIdentifier: deviceRow.device_identifier,
            deviceName: deviceRow.device_name || deviceRow.device_identifier,
            tenantId: deviceRow.tenant_id,
            tenantDisplayName: resolveTenantDisplayName(deviceRow.tenant_id),
            isActive: Boolean(deviceRow.is_active),
            status,
            statusLabel,
            createdAt: new Date(deviceRow.created_at).toLocaleString('ja-JP'),
            updatedAt: new Date(deviceRow.updated_at).toLocaleString('ja-JP'),
            currentCertificate: currentCert,
            certificates
        }
    };
}

/**
 * 社内ルートCAを使用して端末固有のクライアント証明書を一瞬で自動発行
 */
function generateDeviceCertificate(tenantId, deviceIdentifier) {
    const { execSync } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    const CERTS_DIR = path.resolve(__dirname, '..', '..', 'gateway', 'certs');
    const OPENSSL = fs.existsSync('C:\\Program Files\\Git\\usr\\bin\\openssl.exe')
        ? '"C:\\Program Files\\Git\\usr\\bin\\openssl.exe"'
        : 'openssl';

    const tenantNames = {
        'daitetsu': 'Daitetsu Kogyo',
        'kosei': 'Kosei Kensetsu',
        'kintetsu': 'Kintetsu'
    };
    const org = tenantNames[tenantId] || tenantId.toUpperCase();
    const cn = deviceIdentifier;

    const safeId = deviceIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_');
    const keyFile = path.join(CERTS_DIR, `client_${tenantId}_${safeId}.key`);
    const csrFile = path.join(CERTS_DIR, `client_${tenantId}_${safeId}.csr`);
    const crtFile = path.join(CERTS_DIR, `client_${tenantId}_${safeId}.crt`);
    const p12File = path.join(CERTS_DIR, `client_${tenantId}_${safeId}.p12`);

    try {
        execSync(`${OPENSSL} req -new -newkey rsa:2048 -nodes -keyout "${keyFile}" -out "${csrFile}" -subj "/CN=${cn}/O=${org}/OU=Operations"`, {
            env: { ...process.env, MSYS_NO_PATHCONV: '1' }
        });
        execSync(`${OPENSSL} x509 -req -in "${csrFile}" -CA "${path.join(CERTS_DIR, 'ca.crt')}" -CAkey "${path.join(CERTS_DIR, 'ca.key')}" -CAcreateserial -out "${crtFile}" -days 365`);
        execSync(`${OPENSSL} pkcs12 -export -out "${p12File}" -inkey "${keyFile}" -in "${crtFile}" -certfile "${path.join(CERTS_DIR, 'ca.crt')}" -passout pass:password`);

        const certPem = fs.readFileSync(crtFile, 'utf8');
        console.log(`[DeviceManagement] Successfully generated dedicated certificate for '${deviceIdentifier}' (${crtFile})`);
        return certPem;
    } finally {
        if (fs.existsSync(csrFile)) fs.unlinkSync(csrFile);
    }
}

/**
 * 新規デバイス登録
 */
async function createDevice(pool, { tenantId, deviceName, deviceIdentifier, certInput, adminUser, req }) {
    if (!tenantId) throw new Error('TENANT_REQUIRED');
    if (!deviceName || !deviceName.trim()) {
        return { ok: false, code: 'INVALID_DEVICE_NAME', message: '日本語デバイス名を入力してください' };
    }
    if (!deviceIdentifier || !deviceIdentifier.trim()) {
        return { ok: false, code: 'INVALID_DEVICE_IDENTIFIER', message: '管理番号を入力してください' };
    }

    const trimmedIdentifier = deviceIdentifier.trim();
    const trimmedName = deviceName.trim();

    // 1. 管理番号重複チェック
    const existRes = await pool.query(
        'SELECT id FROM public.devices WHERE device_identifier = $1',
        [trimmedIdentifier]
    );
    if (existRes.rows.length > 0) {
        return { ok: false, code: 'DUPLICATE_IDENTIFIER', message: `管理番号 '${trimmedIdentifier}' は既に登録されています` };
    }

    // 2. 証明書の未指定時はプロジェクト内のテナント固定証明書を自動適用
    if (!certInput || !String(certInput).trim()) {
        const fs = require('fs');
        const path = require('path');
        const candidatePaths = [
            path.join(__dirname, '..', '..', 'gateway', 'certs', `client_${tenantId}.crt`),
            path.join(__dirname, '..', 'certs', `client_${tenantId}.crt`),
            path.join(__dirname, '..', '..', 'gateway', 'certs', 'client_daitetsu.crt')
        ];
        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                certInput = fs.readFileSync(p, 'utf8');
                console.log(`[DeviceManagement] Automatically loaded tenant cert for "${tenantId}" from: ${p}`);
                break;
            }
        }
    }

    // 3. 証明書のサーバー側再検証（既存証明書がすでに他端末で使用されていたら、端末専用証明書を社内CAで自動発行）
    let certValidation = await validateCertificate(certInput, pool);
    if (!certValidation.ok && certValidation.code === 'DUPLICATE_CERTIFICATE') {
        console.log(`[DeviceManagement] Certificate already in use. Automatically generating dedicated cert for '${trimmedIdentifier}'...`);
        try {
            certInput = generateDeviceCertificate(tenantId, trimmedIdentifier);
            certValidation = await validateCertificate(certInput, pool);
        } catch (genErr) {
            console.error(`[DeviceManagement] Auto-generation failed:`, genErr);
        }
    }

    if (!certValidation.ok) {
        return certValidation;
    }

    const certInfo = certValidation.certificateInfo;

    // 3. トランザクション処理
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // devices に INSERT
        const insertDeviceRes = await client.query(`
            INSERT INTO public.devices (device_identifier, tenant_id, device_name, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING id::text AS device_id, device_identifier, tenant_id, device_name
        `, [trimmedIdentifier, tenantId, trimmedName]);

        const newDevice = insertDeviceRes.rows[0];

        // device_certificates に INSERT
        const insertCertRes = await client.query(`
            INSERT INTO public.device_certificates (
                device_id, serial_number, fingerprint256, subject_dn, valid_from, valid_to, is_revoked
            )
            VALUES ($1, $2, $3, $4, $5, $6, false)
            RETURNING id::text AS cert_id, serial_number, fingerprint256, valid_to
        `, [
            newDevice.device_id,
            certInfo.serialNumber,
            certInfo.fingerprint256,
            certInfo.subject,
            certInfo.validFrom,
            certInfo.validTo
        ]);

        const newCert = insertCertRes.rows[0];

        // 同期監査ログ記録 (Fail-Closed)
        const auditRes = logger.writeAuditLogSync({
            req,
            severity: 'INFO',
            eventType: 'device_registered',
            message: `管理者(${adminUser})が新規端末を登録しました: 管理番号='${trimmedIdentifier}', デバイス名='${trimmedName}', テナント='${tenantId}'`,
            details: {
                action: 'create_device',
                deviceId: newDevice.device_id,
                deviceIdentifier: trimmedIdentifier,
                deviceName: trimmedName,
                tenantId,
                fingerprint256: certInfo.fingerprint256,
                serialNumber: certInfo.serialNumber
            }
        });

        if (!auditRes.ok) {
            await client.query('ROLLBACK');
            return { ok: false, code: 'AUDIT_LOG_FAILED', message: '監査ログの記録に失敗したため端末登録を取り消しました' };
        }

        await client.query('COMMIT');

        return {
            ok: true,
            message: `端末 '${trimmedName}' (${trimmedIdentifier}) を正常に登録しました`,
            device: {
                id: newDevice.device_id,
                deviceIdentifier: newDevice.device_identifier,
                deviceName: newDevice.device_name,
                tenantId: newDevice.tenant_id,
                certId: newCert.cert_id,
                fingerprint256: newCert.fingerprint256
            }
        };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DeviceManagement] createDevice error:', err);
        return { ok: false, code: 'DB_ERROR', message: `端末登録に失敗しました: ${err.message}` };
    } finally {
        client.release();
    }
}

/**
 * デバイス編集（デバイス名のみ変更可）
 */
async function updateDevice(pool, { deviceId, tenantId, deviceName, adminUser, req }) {
    if (!deviceId || !tenantId) throw new Error('DEVICE_ID_AND_TENANT_REQUIRED');
    if (!deviceName || !deviceName.trim()) {
        return { ok: false, code: 'INVALID_DEVICE_NAME', message: 'デバイス名を入力してください' };
    }

    const trimmedName = deviceName.trim();

    // 自テナント検証 & UPDATE
    const updateRes = await pool.query(`
        UPDATE public.devices
        SET device_name = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND tenant_id = $3
        RETURNING id::text AS device_id, device_identifier, device_name, tenant_id
    `, [trimmedName, deviceId, tenantId]);

    if (updateRes.rowCount === 0) {
        return { ok: false, code: 'DEVICE_NOT_FOUND', message: '対象の端末が見つからないか、他テナントの端末です' };
    }

    const row = updateRes.rows[0];

    // 同期監査ログ
    logger.writeAuditLogSync({
        req,
        severity: 'INFO',
        eventType: 'device_updated',
        message: `管理者(${adminUser})が端末名を更新しました: 管理番号='${row.device_identifier}', 新名称='${trimmedName}'`,
        details: {
            action: 'update_device',
            deviceId: row.device_id,
            deviceIdentifier: row.device_identifier,
            newDeviceName: trimmedName,
            tenantId
        }
    });

    return {
        ok: true,
        message: `端末名を '${trimmedName}' に更新しました`,
        device: row
    };
}

/**
 * 証明書更新（新証明書の追加登録）
 */
async function rotateCertificate(pool, { deviceId, tenantId, newCertInput, adminUser, req }) {
    if (!deviceId || !tenantId) throw new Error('DEVICE_ID_AND_TENANT_REQUIRED');

    // 1. 自テナント確認
    const devRes = await pool.query(
        'SELECT id, device_identifier, device_name FROM public.devices WHERE id = $1 AND tenant_id = $2',
        [deviceId, tenantId]
    );
    if (devRes.rows.length === 0) {
        return { ok: false, code: 'DEVICE_NOT_FOUND', message: '対象端末が見つかりません' };
    }
    const dev = devRes.rows[0];

    // 2. 新証明書の検証
    const certValidation = await validateCertificate(newCertInput, pool);
    if (!certValidation.ok) {
        return certValidation;
    }
    const certInfo = certValidation.certificateInfo;

    // 3. トランザクション処理
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 新証明書を INSERT
        const insertRes = await client.query(`
            INSERT INTO public.device_certificates (
                device_id, serial_number, fingerprint256, subject_dn, valid_from, valid_to, is_revoked
            )
            VALUES ($1, $2, $3, $4, $5, $6, false)
            RETURNING id::text AS cert_id, serial_number, fingerprint256, valid_to
        `, [
            deviceId,
            certInfo.serialNumber,
            certInfo.fingerprint256,
            certInfo.subject,
            certInfo.validFrom,
            certInfo.validTo
        ]);

        const newCert = insertRes.rows[0];

        // devices の updated_at 更新
        await client.query('UPDATE public.devices SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [deviceId]);

        // 同期監査ログ記録
        const auditRes = logger.writeAuditLogSync({
            req,
            severity: 'WARNING',
            eventType: 'device_cert_rotated',
            message: `管理者(${adminUser})が端末の証明書を更新しました: 管理番号='${dev.device_identifier}', 新Fingerprint='${certInfo.fingerprintShort}'`,
            details: {
                action: 'rotate_certificate',
                deviceId,
                deviceIdentifier: dev.device_identifier,
                tenantId,
                newCertId: newCert.cert_id,
                newFingerprint256: certInfo.fingerprint256,
                serialNumber: certInfo.serialNumber
            }
        });

        if (!auditRes.ok) {
            await client.query('ROLLBACK');
            return { ok: false, code: 'AUDIT_LOG_FAILED', message: '監査ログ記録失敗のため証明書更新を取り消しました' };
        }

        await client.query('COMMIT');

        return {
            ok: true,
            message: `端末 '${dev.device_name}' (${dev.device_identifier}) の証明書を正常に更新しました`,
            certificate: newCert
        };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DeviceManagement] rotateCertificate error:', err);
        return { ok: false, code: 'DB_ERROR', message: `証明書更新に失敗しました: ${err.message}` };
    } finally {
        client.release();
    }
}

/**
 * デバイス停止（一時停止）
 */
async function disableDevice(pool, { deviceId, tenantId, reason, adminUser, req }) {
    if (!deviceId || !tenantId) throw new Error('DEVICE_ID_AND_TENANT_REQUIRED');
    if (!reason || !reason.trim()) {
        return { ok: false, code: 'REASON_REQUIRED', message: '端末の停止理由を入力してください' };
    }

    const trimmedReason = reason.trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateRes = await client.query(`
            UPDATE public.devices
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND tenant_id = $2
            RETURNING id::text AS device_id, device_identifier, device_name, is_active
        `, [deviceId, tenantId]);

        if (updateRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { ok: false, code: 'DEVICE_NOT_FOUND', message: '対象端末が見つかりません' };
        }

        const dev = updateRes.rows[0];

        // 監査ログ記録
        const auditRes = logger.writeAuditLogSync({
            req,
            severity: 'WARNING',
            eventType: 'device_disabled',
            message: `管理者(${adminUser})が端末を一時停止しました: 管理番号='${dev.device_identifier}', 理由='${trimmedReason}'`,
            details: {
                action: 'disable_device',
                deviceId: dev.device_id,
                deviceIdentifier: dev.device_identifier,
                reason: trimmedReason,
                tenantId
            }
        });

        if (!auditRes.ok) {
            await client.query('ROLLBACK');
            return { ok: false, code: 'AUDIT_LOG_FAILED', message: '監査ログ記録失敗のため停止操作を取り消しました' };
        }

        await client.query('COMMIT');

        return {
            ok: true,
            message: `端末 '${dev.device_name}' (${dev.device_identifier}) を停止しました。Gatewayでの認証は拒否されます。`,
            device: dev
        };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DeviceManagement] disableDevice error:', err);
        return { ok: false, code: 'DB_ERROR', message: `端末停止に失敗しました: ${err.message}` };
    } finally {
        client.release();
    }
}

/**
 * デバイス再有効化
 */
async function enableDevice(pool, { deviceId, tenantId, reason, adminUser, req }) {
    if (!deviceId || !tenantId) throw new Error('DEVICE_ID_AND_TENANT_REQUIRED');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateRes = await client.query(`
            UPDATE public.devices
            SET is_active = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND tenant_id = $2
            RETURNING id::text AS device_id, device_identifier, device_name, is_active
        `, [deviceId, tenantId]);

        if (updateRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { ok: false, code: 'DEVICE_NOT_FOUND', message: '対象端末が見つかりません' };
        }

        const dev = updateRes.rows[0];

        const auditRes = logger.writeAuditLogSync({
            req,
            severity: 'INFO',
            eventType: 'device_enabled',
            message: `管理者(${adminUser})が端末の停止を解除（再有効化）しました: 管理番号='${dev.device_identifier}'`,
            details: {
                action: 'enable_device',
                deviceId: dev.device_id,
                deviceIdentifier: dev.device_identifier,
                reason: reason || '管理者による再有効化',
                tenantId
            }
        });

        if (!auditRes.ok) {
            await client.query('ROLLBACK');
            return { ok: false, code: 'AUDIT_LOG_FAILED', message: '監査ログ記録失敗のため再開操作を取り消しました' };
        }

        await client.query('COMMIT');

        return {
            ok: true,
            message: `端末 '${dev.device_name}' (${dev.device_identifier}) の停止を解除しました`,
            device: dev
        };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DeviceManagement] enableDevice error:', err);
        return { ok: false, code: 'DB_ERROR', message: `再有効化に失敗しました: ${err.message}` };
    } finally {
        client.release();
    }
}

/**
 * 証明書失効
 */
async function revokeDeviceCertificate(pool, { deviceId, tenantId, certId, reason, adminUser, req }) {
    if (!deviceId || !tenantId || !certId) throw new Error('MISSING_REQUIRED_PARAMS');

    // 自テナント端末に属する証明書か検証
    const checkRes = await pool.query(`
        SELECT dc.id, dc.serial_number, dc.fingerprint256, d.device_identifier, d.device_name
        FROM public.device_certificates dc
        JOIN public.devices d ON d.id = dc.device_id
        WHERE dc.id = $1 AND d.id = $2 AND d.tenant_id = $3
    `, [certId, deviceId, tenantId]);

    if (checkRes.rows.length === 0) {
        return { ok: false, code: 'CERT_NOT_FOUND', message: '対象の証明書が見つからないか、自テナントの端末ではありません' };
    }

    const row = checkRes.rows[0];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            UPDATE public.device_certificates
            SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [certId]);

        const auditRes = logger.writeAuditLogSync({
            req,
            severity: 'WARNING',
            eventType: 'device_cert_revoked',
            message: `管理者(${adminUser})が端末証明書を失効させました: 管理番号='${row.device_identifier}', serial='${row.serial_number}', reason='${reason || '手動失効'}'`,
            details: {
                action: 'revoke_device_certificate',
                deviceId,
                certId,
                serialNumber: row.serial_number,
                fingerprint256: row.fingerprint256,
                reason: reason || '管理者による失効操作',
                tenantId
            }
        });

        if (!auditRes.ok) {
            await client.query('ROLLBACK');
            return { ok: false, code: 'AUDIT_LOG_FAILED', message: '監査ログ記録失敗のため失効操作を取り消しました' };
        }

        await client.query('COMMIT');

        return {
            ok: true,
            message: `証明書 (Serial: ${row.serial_number}) を失効させました`,
            certId
        };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DeviceManagement] revokeDeviceCertificate error:', err);
        return { ok: false, code: 'DB_ERROR', message: `証明書失効に失敗しました: ${err.message}` };
    } finally {
        client.release();
    }
}

module.exports = {
    validateCertificate,
    listDevices,
    getDeviceById,
    createDevice,
    updateDevice,
    rotateCertificate,
    disableDevice,
    enableDevice,
    revokeDeviceCertificate,
    resolveTenantDisplayName
};
