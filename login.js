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

        // UIの状態をリセット
        hideError();
        setLoading(true);

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            // APIリクエスト送信 (UIからは平文で送信)
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
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
                    window.location.href = '/index.html';
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
