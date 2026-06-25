const express = require('express');
const router = express.Router();

/**
 * クライアント向け設定情報を返却するAPI
 * 環境変数で設定されたURL情報をフロントエンドに提供します。
 */
router.get('/', (req, res) => {
    // キャッシュを無効化するヘッダーを設定
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    const tokenParamAliases = (process.env.AUTH_TOKEN_PARAM_ALIASES || 'token,jwt,sso_token')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);

    // 環境変数を優先してマッピング
    const config = {
        endpoints: {
            planning: process.env.URL_PLANNING || process.env.OPERATION_MANAGEMENT_CLIENT_URL || process.env.APP_URL_PLANNING || 'https://準備中',
            equipment: process.env.URL_EQUIPMENT || process.env.EQUIPMENT_APP_URL || process.env.APP_URL_EQUIPMENT || 'https://準備中',
            emergency: process.env.URL_EMERGENCY || process.env.EMERGENCY_APP_URL || process.env.APP_URL_EMERGENCY || 'https://準備中',
            failure: process.env.URL_FAILURE || process.env.MACHINE_FAILURE_APP_URL || process.env.APP_URL_FAILURE || 'https://準備中'
        },
        planningApiUrl: process.env.OPERATION_MANAGEMENT_SERVER_URL || process.env.URL_PLANNING_API || '',
        authTransferMode: process.env.AUTH_TRANSFER_MODE || 'url_param',
        tokenParamName: process.env.AUTH_TOKEN_PARAM_NAME || 'auth_token',
        tokenParamAliases,
        // 動的にアプリを追加するための定義（もし環境変数で定義されていれば）
        // JSON形式の文字列をパースする想定: EXTERNAL_APPS='[{"id":"test","title":"Test","url":"..."}]'
        externalApps: process.env.EXTERNAL_APPS ? JSON.parse(process.env.EXTERNAL_APPS) : []
    };

    res.json(config);
});

module.exports = router;
