/**
 * 自動ログイン処理スクリプト
 * 
 * 【使用方法】
 * 他のアプリケーションのHTMLファイルで、このスクリプトを読み込みます：
 * <script src="./auto-login.js"></script>
 * 
 * 【機能】
 * - URLパラメータから認証トークンを取得
 * - トークンを検証してユーザー情報を取得
 * - 自動的にログインセッションを確立
 * - ログイン画面をスキップしてアプリケーションを表示
 * 
 * 【前提条件】
 * - 送信元アプリと同じJWT_SECRETを使用していること
 * - サーバー側に /api/verify-token エンドポイントがあること
 */

(function() {
    'use strict';

    /**
     * URLパラメータからトークンを取得
     */
    function getTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        // 'auth_token' または 'token' パラメータを確認
        return urlParams.get('auth_token') || urlParams.get('token');
    }

    function getAuthContextFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const tenantId = urlParams.get('tenant_id') || urlParams.get('tenantId') || urlParams.get('tenant') || urlParams.get('company_id') || '';
        const tenantPath = urlParams.get('tenant_path') || '';
        const role = urlParams.get('role') || '';
        const externalRole = urlParams.get('external_role') || role;

        return {
            tenant_id: tenantId,
            tenantId,
            tenant_path: tenantPath,
            tenantPath,
            role,
            external_role: externalRole,
            externalRole
        };
    }

    /**
     * トークンを検証してユーザー情報を取得
     */
    async function verifyToken(token, apiBaseUrl) {
        try {
            // デバッグ: トークンのペイロードを確認（署名検証なし）
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    console.log('🔍 Token Payload Preview:', payload);
                }
            } catch (e) {
                console.warn('Failed to parse token payload:', e);
            }

            const response = await fetch(`${apiBaseUrl}/api/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                throw new Error('トークン検証に失敗しました');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Token verification error:', error);
            return null;
        }
    }

    /**
     * ローカルストレージにユーザー情報を保存
     */
    function saveUserSession(token, userInfo, authContext = {}) {
        const mergedUserInfo = {
            ...userInfo,
            ...authContext,
            tenant_id: authContext.tenant_id || authContext.tenantId || userInfo.tenant_id || userInfo.tenantId || '',
            tenant_path: authContext.tenant_path || authContext.tenantPath || userInfo.tenant_path || userInfo.tenantPath || '',
            role: authContext.role || userInfo.role || '',
            external_role: authContext.external_role || authContext.externalRole || userInfo.external_role || userInfo.externalRole || userInfo.role || ''
        };
        localStorage.setItem('user_token', token);
        localStorage.setItem('user_info', JSON.stringify(mergedUserInfo));
        localStorage.setItem('login_tenant_context', JSON.stringify({
            tenant_id: mergedUserInfo.tenant_id,
            tenant_path: mergedUserInfo.tenant_path,
            role: mergedUserInfo.role,
            external_role: mergedUserInfo.external_role,
            savedAt: new Date().toISOString()
        }));
        console.log('✅ セッション情報を保存しました:', mergedUserInfo);
    }

    /**
     * URLからトークンパラメータを削除（セキュリティ向上）
     */
    function removeTokenFromUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete('auth_token');
        url.searchParams.delete('token');
        window.history.replaceState({}, document.title, url.toString());
    }

    /**
     * 自動ログイン処理のメイン関数
     */
    async function autoLogin(config = {}) {
        // 設定のデフォルト値
        const defaultConfig = {
            apiBaseUrl: window.location.origin, // 現在のオリジン
            redirectOnSuccess: null, // ログイン成功後のリダイレクト先（null = リダイレクトなし）
            redirectOnFailure: '/login.html', // トークン検証失敗時のリダイレクト先
            onSuccess: null, // 成功時のコールバック関数
            onFailure: null, // 失敗時のコールバック関数
            showConsoleLog: true // コンソールログを表示するか
        };

        const cfg = { ...defaultConfig, ...config };

        // 既にログイン済みかチェック
        const existingToken = localStorage.getItem('user_token');
        if (existingToken) {
            if (cfg.showConsoleLog) {
                console.log('ℹ️ 既にログインセッションが存在します');
            }
            return true;
        }

        // URLからトークンを取得
        const token = getTokenFromUrl();
        if (!token) {
            if (cfg.showConsoleLog) {
                console.log('ℹ️ URLにトークンが含まれていません');
            }
            return false;
        }

        if (cfg.showConsoleLog) {
            console.log('🔐 トークンを検出しました。検証中...');
        }

        // トークンを検証
        const result = await verifyToken(token, cfg.apiBaseUrl);

        if (result && result.valid && result.user) {
            // 検証成功
            const authContext = getAuthContextFromUrl();
            saveUserSession(token, result.user, authContext);
            removeTokenFromUrl();

            if (cfg.showConsoleLog) {
                console.log('✅ 自動ログインに成功しました');
            }

            // 成功時のコールバック実行
            if (typeof cfg.onSuccess === 'function') {
                cfg.onSuccess(result.user);
            }

            // リダイレクト処理
            if (cfg.redirectOnSuccess) {
                setTimeout(() => {
                    window.location.href = cfg.redirectOnSuccess;
                }, 100);
            }

            return true;
        } else {
            // 検証失敗
            if (cfg.showConsoleLog) {
                console.error('❌ トークン検証に失敗しました');
            }

            removeTokenFromUrl();

            // 失敗時のコールバック実行
            if (typeof cfg.onFailure === 'function') {
                cfg.onFailure();
            }

            // リダイレクト処理
            if (cfg.redirectOnFailure) {
                setTimeout(() => {
                    window.location.href = cfg.redirectOnFailure;
                }, 100);
            }

            return false;
        }
    }

    /**
     * グローバルに公開
     */
    window.AutoLogin = {
        execute: autoLogin,
        getTokenFromUrl: getTokenFromUrl,
        verifyToken: verifyToken
    };

    /**
     * DOMContentLoaded時に自動実行（オプション）
     * 自動実行したくない場合は、window.AutoLogin.execute() を手動で呼び出してください
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // デフォルト設定で自動実行
            // 必要に応じてカスタマイズしてください
            autoLogin({
                showConsoleLog: true,
                // redirectOnSuccess: '/dashboard', // 必要に応じて設定
                // redirectOnFailure: '/login.html' // 必要に応じて設定
            });
        });
    } else {
        // DOMが既に読み込まれている場合は即実行
        autoLogin({
            showConsoleLog: true
        });
    }
})();
