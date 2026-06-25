/**
 * App Data Definition
 * 後で新しいアプリを追加する場合は、この配列にオブジェクトを追加するだけです。
 */
const apps = [
    {
        id: 'planning',
        title: '計画・運用管理',
        description: '保守用車の運用計画作成から運用の実績を管理できます。',
        image: 'assets/img/Operation Planning to Performance Management.png',
        url: '#planning',
        icon: '📅'
    },
    {
        id: 'equipment',
        title: '保守用車管理',
        description: '仕業点検簿の表示から実績を記録します。',
        image: 'assets/img/Inspection Checklist.jpeg',
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
        description: '機械故障の原因分析と対策策定、発生状況と対応履歴を管理します。',
        image: 'assets/img/Machinery Failure Management.png',
        url: '#failure',
        icon: '⚠️'
    }
];

// 動的設定の読み込み
async function loadDynamicConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load config');
        const config = await response.json();
        
        console.log('[App] Loaded dynamic config:', config);
        
        // エンドポイント情報を上書き
        if (config.endpoints) {
            Object.keys(config.endpoints).forEach(key => {
                if (config.endpoints[key]) {
                    AppConfig.endpoints[key] = config.endpoints[key];
                }
            });
        }

        if (config.tokenParamName) {
            AppConfig.tokenParamName = config.tokenParamName;
        }

        if (config.authTransferMode) {
            AppConfig.authTransferMode = config.authTransferMode;
        }

        if (Array.isArray(config.tokenParamAliases)) {
            AppConfig.tokenParamAliases = config.tokenParamAliases;
        }
        
       // 外部アプリ定義があれば追加（オプション）
       if (config.externalApps && Array.isArray(config.externalApps)) {
           config.externalApps.forEach(extApp => {
               // 既存のIDと重複しない場合のみ追加
               if (!apps.find(a => a.id === extApp.id)) {
                   apps.push(extApp);
               }
           });
       }

    } catch (error) {
        console.warn('[App] Failed to load dynamic config, using default:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 設定をサーバーから読み込む
    await loadDynamicConfig();
    
    const appGrid = document.getElementById('app-grid');
    const tooltip = document.getElementById('app-tooltip');
    const tooltipTitle = document.getElementById('tooltip-title');
    const tooltipDesc = document.getElementById('tooltip-desc');
    const launchBtn = document.getElementById('launch-btn');
    const overlay = document.getElementById('overlay');
    const closeBtn = document.getElementById('close-tooltip');

    // ユーザー情報の反映
    const userInfoStr = localStorage.getItem('user_info');
    console.log('[App] Raw user_info from localStorage:', userInfoStr);

    if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        console.log('[App] Parsed user info:', userInfo);
        console.log('[App] User role:', userInfo.role);
        console.log('[App] Role type:', typeof userInfo.role);

        const headerUserName = document.getElementById('header-user-name');
        const headerAvatar = document.getElementById('header-avatar');

        // システム管理者と運用管理者にのみシステム設定リンクを表示
        const footerNav = document.querySelector('.footer-nav');
        console.log('[App] Footer nav found:', !!footerNav);
        console.log('[App] Footer nav element:', footerNav);

        const adminLink = footerNav ? footerNav.querySelector('a[href="/admin.html"]') : null;
        console.log('[App] Admin link found:', !!adminLink);
        console.log('[App] Admin link element:', adminLink);

        if (adminLink) {
            const currentDisplay = window.getComputedStyle(adminLink).display;
            console.log('[App] Current computed display style:', currentDisplay);
            console.log('[App] Current inline display style:', adminLink.style.display);

            console.log('[App] Checking role... system_admin?', userInfo.role === 'system_admin');
            console.log('[App] Checking role... operation_admin?', userInfo.role === 'operation_admin');
            console.log('[App] Checking role... admin?', userInfo.role === 'admin');

            // admin, system_admin, operation_admin のいずれかであれば表示
            if (userInfo.role === 'system_admin' || userInfo.role === 'operation_admin' || userInfo.role === 'admin') {
                // システム管理者・運用管理者には表示
                adminLink.style.display = 'inline';
                adminLink.style.visibility = 'visible';
                adminLink.style.opacity = '1';
                console.log('[App] ✅ System settings link SHOWN for role:', userInfo.role);
                console.log('[App] After setting - display:', adminLink.style.display);
            } else {
                // 一般ユーザーには非表示
                adminLink.style.display = 'none';
                console.log('[App] ❌ System settings link HIDDEN for role:', userInfo.role);
            }
        } else {
            console.error('[App] ⚠️ Admin link not found in footer!');
            if (footerNav) {
                console.error('[App] Footer nav HTML:', footerNav.innerHTML);
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
    } else {
        console.warn('[App] No user_info found in localStorage');
    }

    let currentAppId = '';

    // アプリカードの動的生成
    console.log('[App] Starting to generate app cards...');
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

        // 位置の計算（画面中央に表示）
        const tooltipWidth = 320;
        const tooltipHeight = 200;

        // ビューポートの中央に配置
        const tooltipX = (window.innerWidth - tooltipWidth) / 2;
        const tooltipY = (window.innerHeight - tooltipHeight) / 2;

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

        // 準備中またはローカルホストの場合は警告
        if (baseUrl.includes('準備中') || baseUrl === 'https://準備中') {
            alert('このシステムは準備中です。\nまもなく公開予定です。');
            hideTooltip();
            return;
        }

        // ローカルURLへのアクセスはブロック
        if (baseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
            alert('このシステムは現在利用できません。\n管理者にお問い合わせください。');
            hideTooltip();
            return;
        }

        // ローカルストレージからトークンを取得
        const token = localStorage.getItem('user_token');

        // URLにトークンをクエリパラメータとして追加（認証連携）
        let finalUrl = baseUrl;
        if (token && (AppConfig.authTransferMode || 'url_param') === 'url_param') {
            const urlObj = new URL(baseUrl, window.location.origin);
            const tokenParam = AppConfig.tokenParamName || 'auth_token';
            const tokenAliases = Array.isArray(AppConfig.tokenParamAliases)
                ? AppConfig.tokenParamAliases
                : [];

            urlObj.searchParams.set(tokenParam, token);
            tokenAliases.forEach(alias => {
                if (alias && alias !== tokenParam) {
                    urlObj.searchParams.set(alias, token);
                }
            });

            finalUrl = urlObj.toString();
        }

        // 新しいタブで開く
        console.log('Opening URL with token:', finalUrl);
        window.open(finalUrl, '_blank');

        hideTooltip();
    });

    closeBtn.addEventListener('click', hideTooltip);
    overlay.addEventListener('click', hideTooltip);

    // ログアウトボタン（ログイン画面に戻る）
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('ログアウトしますか？')) {
                // ローカルストレージをクリア
                localStorage.removeItem('user_token');
                localStorage.removeItem('user_info');
                // ログインフォームをクリアするフラグを設定
                sessionStorage.setItem('clearLoginForm', 'true');
                window.location.href = '/login.html';
            }
        });
    }

    // 終了ボタン（ダッシュボード画面を閉じる）
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            if (confirm('ダッシュボード画面を閉じますか？')) {
                // ウィンドウを閉じる（ブラウザによっては機能しない場合がある）
                window.close();

                // window.close()が機能しない場合の代替処理
                // 500ms後に確認してまだ開いている場合はメッセージを表示
                setTimeout(() => {
                    alert('ブラウザのタブを手動で閉じてください。\nまたはログアウトボタンでログイン画面に戻ることができます。');
                }, 500);
            }
        });
    }
});
