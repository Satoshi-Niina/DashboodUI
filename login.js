document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    const errorMessage = document.getElementById('error-message');

    // 繝壹・繧ｸ隱ｭ縺ｿ霎ｼ縺ｿ譎ゅ↓繝輔か繝ｼ繝繧貞ｼｷ蛻ｶ繧ｯ繝ｪ繧｢
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.setAttribute('value', '');
    passwordInput.setAttribute('value', '');
    loginForm.reset();
    
    // sessionStorage縺ｮ繝輔Λ繧ｰ繧偵メ繧ｧ繝・け
    if (sessionStorage.getItem('clearLoginForm') === 'true') {
        sessionStorage.removeItem('clearLoginForm');
    }
    
    // 繝悶Λ繧ｦ繧ｶ縺ｮ閾ｪ蜍募・蜉帙ｒ髦ｲ縺舌◆繧√↓驕・ｻｶ縺励※蜀榊ｺｦ繧ｯ繝ｪ繧｢
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

        // UI縺ｮ迥ｶ諷九ｒ繝ｪ繧ｻ繝・ヨ
        hideError();
        setLoading(true);

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            // API繝ｪ繧ｯ繧ｨ繧ｹ繝磯∽ｿ｡ (UI縺九ｉ縺ｯ蟷ｳ譁・〒騾∽ｿ｡)
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                // 隱崎ｨｼ謌仙粥
                // 譛ｬ譚･縺ｯ繝医・繧ｯ繝ｳ繧剃ｿ晏ｭ倥☆繧九′縲∽ｻ雁屓縺ｯ繝・Δ縺ｨ縺励※繝繝・す繝･繝懊・繝峨∈逶ｴ謗･驕ｷ遘ｻ
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('user_info', JSON.stringify(data.user));

                // 謌仙粥繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧定｡ｨ遉ｺ縺励※縺九ｉ驕ｷ遘ｻ
                btnText.textContent = '繝ｪ繝繧､繝ｬ繧ｯ繝井ｸｭ...';
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 800);
            } else {
                // 隱崎ｨｼ螟ｱ謨・
                showError(data.message || '繝ｭ繧ｰ繧､繝ｳ縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
                setLoading(false);
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('繝阪ャ繝医Ρ繝ｼ繧ｯ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆');
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

    // 繝ｭ繧ｰ繧｢繧ｦ繝域凾縺ｫ蜻ｼ縺ｰ繧後ｋ髢｢謨ｰ・医げ繝ｭ繝ｼ繝舌Ν縺ｫ蜈ｬ髢具ｼ・
    window.clearLoginForm = function() {
        usernameInput.value = '';
        passwordInput.value = '';
        loginForm.reset();
    };
});
