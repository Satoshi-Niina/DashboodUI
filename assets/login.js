function getTenantIdFromLocation() {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const firstSegment = String(pathSegments[0] ?? '').trim().toLowerCase();
    const excludedPaths = new Set(['api', 'assets', 'admin.html', 'index.html', 'login', 'login.html']);

    if (!firstSegment || excludedPaths.has(firstSegment) || firstSegment.endsWith('.html')) {
        return '';
    }

    return firstSegment;
}

function getTenantPathFromLocation() {
    const tenantId = getTenantIdFromLocation();
    return tenantId ? `/${tenantId}` : '';
}

function getTenantKeyFromCurrentPath() {
    return getTenantIdFromLocation();
}

function getRedirectTargetFromLocation() {
    try {
        const params = new URLSearchParams(window.location.search);
        const redirectTarget = params.get('redirect') || '';
        return redirectTarget.trim();
    } catch (_) {
        return '';
    }
}

function getTenantInfoFromRedirectTarget(redirectTarget) {
    if (!redirectTarget) {
        return null;
    }

    try {
        const url = new URL(redirectTarget, window.location.origin);
        if (url.origin !== window.location.origin) {
            return null;
        }
        const pathSegments = url.pathname.split('/').filter(Boolean);
        const firstSegment = String(pathSegments[0] ?? '').trim().toLowerCase();
        const excludedPaths = new Set(['api', 'assets', 'admin.html', 'index.html', 'login', 'login.html']);

        if (!firstSegment || excludedPaths.has(firstSegment) || firstSegment.endsWith('.html')) {
            return null;
        }

        return {
            tenantId: firstSegment,
            tenantPath: `/${firstSegment}`
        };
    } catch (_) {
        return null;
    }
}

function buildIndexPathForTenant(tenantPath) {
    return tenantPath === '/' ? '/index.html' : `${tenantPath}/index.html`;
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    const errorMessage = document.getElementById('error-message');
    const redirectTarget = getRedirectTargetFromLocation();
    const redirectTenantInfo = getTenantInfoFromRedirectTarget(redirectTarget);

    // ページ読み込み時にフォームを強制クリア
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.setAttribute('value', '');
    passwordInput.setAttribute('value', '');
    loginForm.reset();
    
    // sessionStorageのフラグをチェック
    if (sessionStorage.getItem('clearLoginForm') === 'true') {
        sessionStorage.removeItem('clearLoginForm');
    }
    
    // ブラウザの自動入力を防ぐために遅延して再度クリア
    setTimeout(() => {
        usernameInput.value = '';
        passwordInput.value = '';
        usernameInput.setAttribute('value', '');
        passwordInput.setAttribute('value', '');
    }, 100);
    
    setTimeout(() => {
        usernameInput.value = '';
        passwordInput.value = '';
    }, 300);

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (window.TenantContext && typeof window.TenantContext.init === 'function') {
            await window.TenantContext.init();
        }

        // UIの状態をリセット
        hideError();
        setLoading(true);

        const username = usernameInput.value;
        const password = passwordInput.value;

        const tenantId = window.TenantContext && typeof window.TenantContext.getTenantId === 'function'
            ? (redirectTenantInfo && redirectTenantInfo.tenantId) || window.TenantContext.getTenantId()
            : getTenantIdFromLocation();
        const tenantPath = window.TenantContext && typeof window.TenantContext.getTenantPath === 'function'
            ? (redirectTenantInfo && redirectTenantInfo.tenantPath) || window.TenantContext.getTenantPath()
            : getTenantPathFromLocation();
        const tenantKey = getTenantKeyFromCurrentPath();
        try {
            const explicitTenant = tenantId || tenantKey;
            console.log(`[Login] Logging in... (explicitTenant: ${explicitTenant || 'none (integrated)'})`);
            const loginApiPath = (tenantPath && window.TenantContext && typeof window.TenantContext.buildPathForTenant === 'function')
                ? window.TenantContext.buildPathForTenant('/api/login', tenantPath)
                : '/api/login';
            const queryString = explicitTenant ? `?tenant_id=${encodeURIComponent(explicitTenant)}` : '';

            const headers = { 'Content-Type': 'application/json' };
            if (explicitTenant) {
                headers['X-Tenant-Key'] = explicitTenant;
                headers['X-Tenant-Id'] = explicitTenant;
            }
            if (tenantPath) {
                headers['X-Tenant-Path'] = tenantPath;
            }

            const bodyPayload = { username, password };
            if (explicitTenant) {
                bodyPayload.tenantKey = explicitTenant;
                bodyPayload.tenant_id = explicitTenant;
            }
            if (tenantPath) {
                bodyPayload.tenant_path = tenantPath;
            }

            const response = await fetch(`${loginApiPath}${queryString}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyPayload)
            });

            const data = await response.json();
            console.log('[Login] Response:', {
                success: !!data.success,
                tenant_id: data.user && data.user.tenant_id,
                role: data.user && data.user.role
            });

            if (data.success) {
                // 認証成功
                console.log('[Login] User data:', data.user);

                // レスポンスの JWT トークンや所属情報をブラウザストレージに保存
                if (data.token) {
                    try {
                        localStorage.setItem('auth_token', data.token);
                        sessionStorage.setItem('auth_token', data.token);
                        localStorage.setItem('dashboard_token', data.token);
                    } catch (_) {}
                }
                if (data.user?.tenant_id) {
                    try {
                        localStorage.setItem('tenant_id', data.user.tenant_id);
                        if (data.user.tenant_key) localStorage.setItem('tenant_key', data.user.tenant_key);
                    } catch (_) {}
                }

                // 成功アニメーションを表示してから遷移
                btnText.textContent = 'リダイレクト中...';
                setTimeout(() => {
                    const targetPath = redirectTarget
                        || (tenantPath
                            ? (window.TenantContext && typeof window.TenantContext.buildPathForTenant === 'function'
                                ? window.TenantContext.buildPathForTenant('/index.html', tenantPath)
                                : buildIndexPathForTenant(tenantPath))
                            : '/index.html');
                    window.location.href = targetPath;
                }, 800);
            } else {
                // 認証失敗
                showError(data.message || 'ログインに失敗しました');
                setLoading(false);
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('ネットワークエラーが発生しました');
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
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
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }

    // ログアウト時に呼ばれる関数（グローバルに公開）
    window.clearLoginForm = function() {
        usernameInput.value = '';
        passwordInput.value = '';
        loginForm.reset();
    };
});
