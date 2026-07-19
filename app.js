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
    if (window.TenantContext && typeof window.TenantContext.init === 'function') {
        await window.TenantContext.init();
    }

    const token = localStorage.getItem('user_token');
    if (!token) {
        sessionStorage.setItem('clearLoginForm', 'true');
        const redirectTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const loginTarget = `/login?redirect=${encodeURIComponent(redirectTarget)}`;
        const loginPath = window.TenantContext && typeof window.TenantContext.buildPathForTenant === 'function'
            ? window.TenantContext.buildPathForTenant(loginTarget, window.TenantContext.getTenantPath ? window.TenantContext.getTenantPath() : '/')
            : loginTarget;
        window.location.replace(loginPath);
        return;
    }

    // 設定をサーバーから読み込む
    await loadDynamicConfig();

    const tenantEnvironmentLabel = document.getElementById('tenant-environment-label');
    if (tenantEnvironmentLabel) {
        const tenantLabel = window.TenantContext && typeof window.TenantContext.getTenantLabel === 'function'
            ? window.TenantContext.getTenantLabel()
            : 'デモ環境';
        tenantEnvironmentLabel.textContent = tenantLabel;
    }
    
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

        const adminLink = footerNav
            ? (footerNav.querySelector('a[href="admin.html"]') || footerNav.querySelector('a[href="/admin.html"]'))
            : null;
        console.log('[App] Admin link found:', !!adminLink);
        console.log('[App] Admin link element:', adminLink);

        if (adminLink) {
            const currentDisplay = window.getComputedStyle(adminLink).display;
            console.log('[App] Current computed display style:', currentDisplay);
            console.log('[App] Current inline display style:', adminLink.style.display);

            // 旧ロールを3種類へ正規化して権限判定
            const normalizeRole = (role) => {
                const raw = String(role || '').trim();
                const normalized = raw.toLowerCase();

                if (normalized === 'system_admin' || normalized === 'administrator' || normalized === 'admin') {
                    return 'system_admin';
                }

                if (normalized === 'operation_admin' || normalized === 'manager' || raw === '責任者') {
                    return 'operation_admin';
                }

                return 'user';
            };

            const normalizedRole = normalizeRole(userInfo.role);
            const isAllowed = normalizedRole === 'system_admin' || normalizedRole === 'operation_admin';

            console.log('[App] Checking role via fuzzy check... role check result:', isAllowed);

            // admin, system_admin, operation_admin, manager, 責任者 のいずれかであれば表示
            if (isAllowed) {
                // システム管理者・運用管理者、適切な権限を持つ役職に表示
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

    function dispatchExternalAuthContext(targetWindow, targetOrigin, authContext) {
        if (!targetWindow || targetWindow.closed || !targetOrigin || !authContext) {
            return;
        }

        const payload = {
            type: 'EXTERNAL_AUTH_CONTEXT',
            token: authContext.token,
            external_token: authContext.token,
            tenantId: authContext.tenantId,
            tenant: authContext.tenantId,
            company_id: authContext.tenantId,
            tenant_id: authContext.tenantId,
            tenant_path: authContext.tenantPath,
            role: authContext.role,
            external_role: authContext.externalRole
        };

        const payloadToken = {
            type: 'EXTERNAL_AUTH_TOKEN',
            token: authContext.token,
            external_token: authContext.token,
            tenantId: authContext.tenantId,
            tenant: authContext.tenantId,
            company_id: authContext.tenantId,
            tenant_id: authContext.tenantId,
            tenant_path: authContext.tenantPath,
            role: authContext.role,
            external_role: authContext.externalRole
        };

        let attempts = 0;
        const maxAttempts = 5;
        const sendPayload = () => {
            if (!targetWindow || targetWindow.closed) {
                return;
            }

            // 互換性のため両方のイベントタイプを送信する
            targetWindow.postMessage(payload, targetOrigin);
            targetWindow.postMessage(payloadToken, targetOrigin);
            attempts += 1;

            if (attempts < maxAttempts) {
                window.setTimeout(sendPayload, 300);
            }
        };

        sendPayload();
    }

    function normalizeExternalTenantId(tenantId) {
        const normalized = String(tenantId || '').trim().toLowerCase();
        if (!normalized || normalized === 'demo_env') {
            return 'demo';
        }
        return normalized;
    }

    function readStoredUserInfo() {
        try {
            const rawUserInfo = localStorage.getItem('user_info');
            return rawUserInfo ? JSON.parse(rawUserInfo) : null;
        } catch (error) {
            console.warn('[App] Failed to parse stored user info:', error);
            return null;
        }
    }

    function getConfirmedTenantContext() {
        const userInfo = readStoredUserInfo() || {};
        const loginContext = window.TenantContext && typeof window.TenantContext.getLoginTenantContext === 'function'
            ? window.TenantContext.getLoginTenantContext()
            : null;
        const currentContext = window.TenantContext && typeof window.TenantContext.getContext === 'function'
            ? window.TenantContext.getContext()
            : null;

        let tenantId = userInfo.tenant_id || userInfo.tenantId
            || (loginContext && (loginContext.tenant_id || loginContext.tenantId))
            || (currentContext && currentContext.tenantId)
            || 'demo';
        tenantId = normalizeExternalTenantId(tenantId);

        const storedTenantPath = userInfo.tenant_path || userInfo.tenantPath
            || (loginContext && (loginContext.tenant_path || loginContext.tenantPath))
            || (currentContext && currentContext.tenantPath)
            || '/';
        const dashboardTenantPath = tenantId === 'demo'
            ? '/'
            : (storedTenantPath && storedTenantPath !== '/' ? storedTenantPath : `/${tenantId}`);
        const tenantPath = tenantId === 'demo' ? '/demo' : dashboardTenantPath;
        const role = userInfo.role || (loginContext && loginContext.role) || '';
        const externalRole = userInfo.externalRole || userInfo.external_role || role;

        return { tenantId, tenantPath, dashboardTenantPath, role, externalRole };
    }

    function buildExternalAuthPayload() {
        const token = localStorage.getItem('user_token') || '';
        const tenantContext = getConfirmedTenantContext();
        const userInfo = readStoredUserInfo() || {};

        return {
            token,
            jwt: token,
            tenantId: tenantContext.tenantId,
            tenantPath: tenantContext.tenantPath,
            role: tenantContext.role || userInfo.role || '',
            externalRole: tenantContext.externalRole || userInfo.externalRole || userInfo.external_role || tenantContext.role || userInfo.role || '',
            userInfo
        };
    }

    function appendTenantLaunchParams(urlObj, tenantContext) {
        const tenantId = normalizeExternalTenantId(tenantContext.tenantId);
        const tenantPath = tenantContext.tenantPath || (tenantId === 'demo' ? '/' : `/${tenantId}`);

        // 受け側の実装差を吸収するため、canonical な tenant_id を先頭に置きつつ互換キーも併送する。
        urlObj.searchParams.set('tenant_id', tenantId);
        urlObj.searchParams.set('tenantId', tenantId);
        urlObj.searchParams.set('company_id', tenantId);
        urlObj.searchParams.set('tenant', tenantId);
        urlObj.searchParams.set('tenant_path', tenantPath);
    }

    function applyTenantPathToExternalUrl(urlObj, tenantContext) {
        const tenantId = normalizeExternalTenantId(tenantContext.tenantId);
        const rawSegments = urlObj.pathname.split('/').filter(Boolean);
        const firstSegment = String(rawSegments[0] || '').trim().toLowerCase();
        const knownTenantSegments = new Set(['demo', 'demo_env', 'kosei', 'daitetsu', tenantId]);
        const suffixSegments = knownTenantSegments.has(firstSegment)
            ? rawSegments.slice(1)
            : rawSegments;
        const effectiveSuffixSegments = suffixSegments.length > 0 ? suffixSegments : ['daily-info'];
        urlObj.pathname = `/${[tenantId, ...effectiveSuffixSegments].join('/')}`;
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

        // ローカルストレージから認証情報を取得
        const authPayload = buildExternalAuthPayload();
        const token = authPayload.token;
        const shouldUseExternalAuthBridge = currentAppId === 'equipment';
        let popupOrigin = '';
        let authContext = null;

        // URLにトークンをクエリパラメータとして追加（認証連携）
        let finalUrl = baseUrl;
        if (token && (AppConfig.authTransferMode || 'url_param') === 'url_param') {
            const urlObj = new URL(baseUrl, window.location.origin);
            const tokenParam = AppConfig.tokenParamName || 'auth_token';
            const tokenAliases = Array.isArray(AppConfig.tokenParamAliases)
                ? AppConfig.tokenParamAliases
                : [];
            const confirmedTenantContext = {
                tenantId: authPayload.tenantId,
                tenantPath: authPayload.tenantPath,
                role: authPayload.role,
                externalRole: authPayload.externalRole
            };
            const externalTenantId = normalizeExternalTenantId(confirmedTenantContext.tenantId);

            if (shouldUseExternalAuthBridge) {
                applyTenantPathToExternalUrl(urlObj, confirmedTenantContext);
            }

            // 受け側が token / jwt / auth_token のどれでも受け取れるように明示的に付与する
            urlObj.searchParams.set('token', token);
            urlObj.searchParams.set('jwt', token);
            urlObj.searchParams.set(tokenParam, token);
            urlObj.searchParams.set('external_token', token);
            tokenAliases.forEach(alias => {
                if (alias && alias !== tokenParam) {
                    urlObj.searchParams.set(alias, token);
                }
            });
            appendTenantLaunchParams(urlObj, {
                tenantId: externalTenantId,
                tenantPath: confirmedTenantContext.tenantPath
            });
            urlObj.searchParams.set('role', confirmedTenantContext.role);
            urlObj.searchParams.set('external_role', confirmedTenantContext.externalRole);

            if (shouldUseExternalAuthBridge) {
                authContext = {
                    token,
                    tenantId: externalTenantId,
                    tenantPath: confirmedTenantContext.tenantPath,
                    role: confirmedTenantContext.role,
                    externalRole: confirmedTenantContext.externalRole
                };
            }

            popupOrigin = urlObj.origin;
            finalUrl = urlObj.toString();
        }

        // 新しいタブで開く
        console.log('[App] Launch auth payload:', {
            url: finalUrl,
            tenantId: authPayload.tenantId,
            tenantPath: authPayload.tenantPath,
            role: authPayload.role,
            externalRole: authPayload.externalRole,
            hasJwt: !!authPayload.token,
            includesJwtParam: finalUrl.includes('jwt=') || finalUrl.includes('auth_token=') || finalUrl.includes('token=')
        });
        const openedWindow = window.open(finalUrl, '_blank');

        if (shouldUseExternalAuthBridge && openedWindow && authContext && popupOrigin) {
            dispatchExternalAuthContext(openedWindow, popupOrigin, authContext);
        }

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
                const confirmedTenantContext = getConfirmedTenantContext();
                const loginPath = window.TenantContext && typeof window.TenantContext.buildPathForTenant === 'function'
                    ? window.TenantContext.buildPathForTenant('/login.html', confirmedTenantContext.dashboardTenantPath)
                    : '/login.html';
                window.location.href = loginPath;
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
