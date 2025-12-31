/**
 * アプリケーション設定ファイル
 * 各サブシステムの接続先URLを一元管理します。
 */
const AppConfig = {
    // トークンをURLパラメータとして渡すときのキー名
    tokenParamName: 'auth_token',

    // 各アプリケーションのエンドポイント設定
    endpoints: {
        // 応急復旧支援システム
        emergency: 'https://emergency-client-u3tejuflja-dt.a.run.app/',

        // 計画・実績管理システム
        planning: 'http://localhost:3002',

        // 保守用車管理システム
        equipment: 'http://localhost:3003',

        // 機械故障管理システム
        failure: 'http://localhost:3004'
    }
};
