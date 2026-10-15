/**
 * 運用管理ログイン画面スクリプト
 * 
 * 【認証方針】
 * - 利用者の入力はユーザーID・パスワードのみ。
 * - 端末（本番はmTLSクライアント証明書、ローカル復旧時はサーバー開発設定）に基づいてサーバー側でテナントを特定する。
 * - URL、要求本文、localStorageのテナント指定は送信せず、接続先決定の根拠にしない。
 * - 端末が確認できない場合、サーバーは「端末の登録を確認してください」を返し、画面に表示する。
 */

function getRedirectTargetFromLocation() {
    try {
        const params = new URLSearchParams(window.location.search);
        const redirectTarget = params.get('redirect') || '';
        return redirectTarget.trim();
    } catch (_) {
        return '';
    }
}

function buildIndexPathForTenant(tenantId) {
    if (!tenantId || tenantId === 'demo') {
        return '/index.html';
    }
    return `/${encodeURIComponent(tenantId)}/index.html`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn ? loginBtn.querySelector('.btn-text') : null;
    const btnLoader = loginBtn ? loginBtn.querySelector('.btn-loader') : null;
    const errorMessage = document.getElementById('error-message');
    const redirectTarget = getRedirectTargetFromLocation();

    // ページ読み込み時にフォームをクリア
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (loginForm) loginForm.reset();

    if (sessionStorage.getItem('clearLoginForm') === 'true') {
        sessionStorage.removeItem('clearLoginForm');
    }

    setTimeout(() => {
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
    }, 100);

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            hideError();
            setLoading(true);

            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            if (!username || !password) {
                showError('ユーザーIDとパスワードを入力してください');
                setLoading(false);
                return;
            }

            console.log('[Login] Submitting credentials (tenant is determined by server/device)...');

            try {
                // テナント指定は送らず、認証情報のみを送信
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json().catch(() => null);

                if (!data) {
                    showError('サーバーからの応答が無効です (ステータス: ' + response.status + ')');
                    setLoading(false);
                    return;
                }

                if (response.ok && data.success) {
                    console.log('[Login] Success! User:', data.user);

                    const resolvedTenantId = data.user?.tenant_key || data.user?.tenant_id || '';

                    // セッション情報更新
                    if (data.token) {
                        try {
                            localStorage.setItem('auth_token', data.token);
                            sessionStorage.setItem('auth_token', data.token);
                            localStorage.setItem('dashboard_token', data.token);
                        } catch (_) {}
                    }
                    if (resolvedTenantId) {
                        try {
                            localStorage.setItem('tenant_id', resolvedTenantId);
                            localStorage.setItem('tenant_key', resolvedTenantId);
                        } catch (_) {}
                    }

                    if (window.TenantContext && typeof window.TenantContext.persistLoginTenant === 'function') {
                        window.TenantContext.persistLoginTenant({
                            tenantId: resolvedTenantId,
                            companyName: data.user?.tenant_name || data.user?.company_name || '',
                            role: data.user?.role || ''
                        });
                    }

                    if (btnText) btnText.textContent = 'リダイレクト中...';
                    setTimeout(() => {
                        const targetPath = redirectTarget || buildIndexPathForTenant(resolvedTenantId);
                        window.location.href = targetPath;
                    }, 500);
                } else {
                    showError(data.message || 'ログインに失敗しました');
                    setLoading(false);
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('ネットワークエラーが発生しました');
                setLoading(false);
            }
        });
    }

    function setLoading(isLoading) {
        if (!loginBtn || !btnText || !btnLoader) return;
        if (isLoading) {
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
            loginBtn.disabled = true;
        } else {
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            loginBtn.disabled = false;
        }
    }

    function showError(message) {
        if (!errorMessage) return;
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        if (!errorMessage) return;
        errorMessage.classList.add('hidden');
    }

    window.clearLoginForm = function() {
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (loginForm) loginForm.reset();
    };
});
