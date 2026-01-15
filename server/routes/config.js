const express = require('express');
const router = express.Router();

/**
 * クライアント向け設定情報を返却するAPI
 * 環境変数で設定されたURL情報をフロントエンドに提供します。
 */
router.get('/', (req, res) => {
    // 環境変数から 'URL_' で始まるものを収集、または特定のキーを指定してマッピング
    const config = {
        endpoints: {
            planning: process.env.URL_PLANNING || 'https://railway-server-800711608362.asia-northeast2.run.app',
            equipment: process.env.URL_EQUIPMENT || 'http://localhost:3003',
            emergency: process.env.URL_EMERGENCY || 'https://emergency-client-u3tejuflja-dt.a.run.app/',
            failure: process.env.URL_FAILURE || 'http://localhost:3004'
        },
        // 動的にアプリを追加するための定義（もし環境変数で定義されていれば）
        // JSON形式の文字列をパースする想定: EXTERNAL_APPS='[{"id":"test","title":"Test","url":"..."}]'
        externalApps: process.env.EXTERNAL_APPS ? JSON.parse(process.env.EXTERNAL_APPS) : []
    };

    res.json(config);
});

module.exports = router;
