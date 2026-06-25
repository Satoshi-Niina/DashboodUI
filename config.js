/**
 * アプリケーション設定ファイル
 * 各サブシステムの接続先URLを一元管理します。
 */
const AppConfig = {
    // トークンをURLパラメータとして渡すときのキー名
    tokenParamName: 'auth_token',
    authTransferMode: 'url_param',
    tokenParamAliases: ['token', 'jwt', 'sso_token'],

    // 各アプリケーションのエンドポイント設定
    endpoints: {
        // 応急復旧支援システム
        emergency: 'https://準備中',

        // 計画・実績管理システム
        planning: 'https://準備中',

        // 保守用車管理システム
        equipment: 'https://準備中',

        // 機械故障管理システム
        failure: 'https://準備中'
    }
};
