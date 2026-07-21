function getTenantIdFromLocation() {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const firstSegment = String(pathSegments[0] ?? '').trim().toLowerCase();
    const excludedPaths = new Set(['api', 'assets', 'admin.html', 'index.html', 'login', 'login.html']);

    if (!firstSegment || excludedPaths.has(firstSegment) || firstSegment.endsWith('.html')) {
        return 'demo';
    }

    return firstSegment;
}

function getTenantPathFromLocation() {
    const tenantId = getTenantIdFromLocation();
    return tenantId === 'demo' ? '/' : `/${tenantId}`;
}

function getTenantKeyFromCurrentPath() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const firstSegment = String(segments[0] ?? '').trim().toLowerCase();
    const excludedPaths = new Set(['api', 'assets', 'admin.html', 'index.html', 'login', 'login.html']);

    if (!firstSegment || excludedPaths.has(firstSegment) || firstSegment.endsWith('.html')) {
        return '';
    }

    return firstSegment;
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
        const loginTenantContext = window.TenantContext && typeof window.TenantContext.persistLoginTenant === 'function'
            ? window.TenantContext.persistLoginTenant({ tenant_id: tenantId, tenant_path: tenantPath })
            : { tenant_id: tenantId, tenant_path: tenantPath };

        try {
            // APIリクエスト送信に実コンテキストのテナントIDを明示的にのせる
            console.log(`[Login] Logging in to tenant: ${tenantId}`);
            const response = await fetch(`/api/login?tenant_id=${encodeURIComponent(tenantId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-ID': tenantKey
                },
                body: JSON.stringify({ username, password, tenantKey: tenantKey, tenant_id: tenantId, tenant_path: tenantPath })
            });

            const data = await response.json();
            console.log('[Login] Response:', {
                success: !!data.success,
                hasToken: !!data.token,
                tenant_id: data.tenant_id || (data.user && data.user.tenant_id),
                tenant_path: data.tenant_path || (data.user && data.user.tenant_path),
                role: data.role || (data.user && data.user.role)
            });

            if (data.success) {
                // 認証成功
                console.log('[Login] Token:', data.token ? 'exists' : 'missing');
                console.log('[Login] User data:', data.user);
                
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('user_info', JSON.stringify(data.user));
                const confirmedTenantContext = window.TenantContext && typeof window.TenantContext.persistLoginTenant === 'function'
                    ? window.TenantContext.persistLoginTenant({
                        tenant_id: data.tenant_id || (data.user && data.user.tenant_id) || loginTenantContext.tenant_id,
                        tenant_path: data.tenant_path || (data.user && data.user.tenant_path) || loginTenantContext.tenant_path,
                        role: data.role || (data.user && data.user.role)
                    })
                    : loginTenantContext;
                
                console.log('[Login] Saved to localStorage');
                console.log('[Login] Token check:', localStorage.getItem('user_token') ? 'OK' : 'FAILED');
                console.log('[Login] User info check:', localStorage.getItem('user_info') ? 'OK' : 'FAILED');

                // 成功アニメーションを表示してから遷移
                btnText.textContent = 'リダイレクト中...';
                setTimeout(() => {
                    const targetPath = redirectTarget || (window.TenantContext && typeof window.TenantContext.buildPathForTenant === 'function'
                        ? window.TenantContext.buildPathForTenant('/index.html', confirmedTenantContext.tenant_path)
                        : buildIndexPathForTenant(confirmedTenantContext.tenant_path));
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
