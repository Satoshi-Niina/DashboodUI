document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    const errorMessage = document.getElementById('error-message');

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
            ? window.TenantContext.getTenantId()
            : 'demo_env';
        const tenantPath = window.TenantContext && typeof window.TenantContext.getTenantPath === 'function'
            ? window.TenantContext.getTenantPath()
            : '/';

        try {
            // APIリクエスト送信に実コンテキストのテナントIDを明示的にのせる
            console.log(`[Login] Logging in to tenant: ${tenantId}`);
            const response = await fetch(`/api/login?tenant_id=${encodeURIComponent(tenantId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, tenant_id: tenantId, tenant_path: tenantPath })
            });

            const data = await response.json();
            console.log('[Login] Response data:', data);

            if (data.success) {
                // 認証成功
                console.log('[Login] Token:', data.token ? 'exists' : 'missing');
                console.log('[Login] User data:', data.user);
                
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('user_info', JSON.stringify(data.user));
                
                console.log('[Login] Saved to localStorage');
                console.log('[Login] Token check:', localStorage.getItem('user_token') ? 'OK' : 'FAILED');
                console.log('[Login] User info check:', localStorage.getItem('user_info'));

                // 成功アニメーションを表示してから遷移
                btnText.textContent = 'リダイレクト中...';
                setTimeout(() => {
                    const dashboardPath = window.TenantContext && typeof window.TenantContext.buildPath === 'function'
                        ? window.TenantContext.buildPath('/index.html')
                        : '/index.html';
                    window.location.href = dashboardPath;
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
