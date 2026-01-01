/**
 * App Data Definition
 * 後で新しいアプリを追加する場合は、この配列にオブジェクトを追加するだけです。
 */
const apps = [
    {
        id: 'planning',
        title: '計画・実績管理',
        description: '保守用車の運用計画作成から運用の実績を管理できます。',
        image: 'assets/img/plan_management.png',
        url: '#planning',
        icon: '📅'
    },
    {
        id: 'equipment',
        title: '保守用車管理',
        description: '仕業点検簿の表示から実績を記録します。',
        image: 'assets/img/vehicle_management.png',
        url: '#equipment',
        icon: '🚛'
    },
    {
        id: 'emergency',
        title: '応急復旧支援',
        description: '機械故障等の技術支援します。',
        image: 'assets/img/recovery.png',
        url: '#emergency',
        icon: '🛠️'
    },
    {
        id: 'failure',
        title: '機械故障管理',
        description: '機械故障の発生状況と対応履歴を管理します。',
        image: 'assets/img/recovery.png',
        url: '#failure',
        icon: '⚠️'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const appGrid = document.getElementById('app-grid');
    const tooltip = document.getElementById('app-tooltip');
    const tooltipTitle = document.getElementById('tooltip-title');
    const tooltipDesc = document.getElementById('tooltip-desc');
    const launchBtn = document.getElementById('launch-btn');
    const overlay = document.getElementById('overlay');
    const closeBtn = document.getElementById('close-tooltip');

    // ユーザー情報の反映
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        const headerUserName = document.getElementById('header-user-name');
        const headerAvatar = document.getElementById('header-avatar');

        // システム管理者以外はシステム設定リンクを非表示
        const footerNav = document.querySelector('.footer-nav');
        if (footerNav && userInfo.role !== 'admin') {
            const adminLink = footerNav.querySelector('a[href="/admin"]');
            if (adminLink) {
                adminLink.style.display = 'none';
            }
        }

        if (headerUserName) {
            // 時間に応じた挨拶の決定
            // 6:00-10:00: おはようございます
            // 10:00-18:00: こんにちは
            // 18:00-翌6:00: こんばんは
            const hour = new Date().getHours();
            let greeting = 'こんにちは';
            if (hour >= 6 && hour < 10) {
                greeting = 'おはようございます';
            } else if (hour >= 10 && hour < 18) {
                greeting = 'こんにちは';
            } else {
                greeting = 'こんばんは';
            }

            // ディスプレイ表示ではなく、実際のユーザー名（username）を表示
            headerUserName.textContent = `${greeting}、${userInfo.username}さん`;
        }
        if (headerAvatar) {
            headerAvatar.src = `https://ui-avatars.com/api/?name=${userInfo.username}&background=random`;
        }
    }

    let currentAppId = '';

    // アプリカードの動的生成
    apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.innerHTML = `
            <div class="app-card-header">
                <h3>${app.title}</h3>
            </div>
            <div class="app-image-container">
                <img src="${app.image}" alt="${app.title}" class="app-image">
                <div class="app-icon-floating">${app.icon}</div>
            </div>
            <div class="app-card-info">
                <p class="app-sub-desc">${app.description}</p>
                <button class="launch-btn-small">アプリ起動</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            showTooltip(e, app);
        });

        appGrid.appendChild(card);
    });

    /**
     * 吹き出しを表示する関数
     */
    function showTooltip(event, app) {
        currentAppId = app.id;
        tooltipTitle.textContent = app.title;
        tooltipDesc.textContent = app.description;

        // 位置の計算
        const rect = event.currentTarget.getBoundingClientRect();
        const tooltipX = rect.left + (rect.width / 2) - 160; // 320pxの半分を引く
        const tooltipY = rect.top + window.scrollY - 180; // カードの上部に表示

        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;

        tooltip.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    /**
     * 閉じるときの処理
     */
    function hideTooltip() {
        tooltip.classList.add('hidden');
        overlay.classList.add('hidden');
    }

    launchBtn.addEventListener('click', () => {
        console.log('currentAppId:', currentAppId);
        console.log('AppConfig.endpoints:', AppConfig.endpoints);
        
        const baseUrl = AppConfig.endpoints[currentAppId];
        console.log('baseUrl:', baseUrl);

        if (!baseUrl) {
            alert('接続先URLが設定されていません。管理者にお問い合わせください。');
            return;
        }

        // ローカルストレージからトークンを取得
        const token = localStorage.getItem('user_token');
        
        // URLにトークンをクエリパラメータとして追加
        let finalUrl = baseUrl;
        if (token) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const tokenParam = AppConfig.tokenParamName || 'auth_token';
            finalUrl = `${baseUrl}${separator}${tokenParam}=${encodeURIComponent(token)}`;
        }

        // 新しいタブで開く
        console.log('Opening URL with token:', finalUrl);
        window.open(finalUrl, '_blank');

        hideTooltip();
    });

    closeBtn.addEventListener('click', hideTooltip);
    overlay.addEventListener('click', hideTooltip);

    // ログアウトボタン
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('ログアウトしますか？')) {
                localStorage.removeItem('user_token');
                localStorage.removeItem('user_info');
                window.location.href = '/login.html';
            }
        });
    }

    // 終了ボタン（ログアウトと同じ動作）
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            if (confirm('ログアウトしますか？')) {
                localStorage.removeItem('user_token');
                localStorage.removeItem('user_info');
                window.location.href = '/login.html';
            }
        });
    }
});
