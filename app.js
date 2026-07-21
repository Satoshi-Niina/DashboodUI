/**
 * App Data Definition
 * テナントに紐づくアプリ情報をAPIから動的に取得します。
 */
let apps = [];

// アプリ情報をデフォルト画像にマッピング（後方互換性のため）
const defaultAppImages = {
    'planning': 'assets/img/Operation Planning to Performance Management.png',
    'equipment': 'assets/img/Inspection Checklist.jpeg',
    'emergency': 'assets/img/recovery.png',
    'failure': 'assets/img/Machinery Failure Management.png',
    'vehicle': 'assets/img/Inspection Checklist.jpeg' // ★ vehicle（保守用車管理システム）のデフォルト画像をセットしてリンク切れを防ぐ
};

/**
 * テナントに紐づくアプリ情報を取得
 * DB の tenant_app_routings テーブルから動的に取得し、
 * 取得できない場合はフォールバック（デフォルトアプリ一覧）を使用します。
 * 
 * @returns {Promise<boolean>} true: API取得成功、false: フォールバック使用
 */
async function loadTenantApps() {
    try {
        console.log('[App] Fetching tenant apps from /api/tenant-apps...');
        const response = await fetch('/api/tenant-apps');
        
        if (!response.ok) {
            console.warn(`[App] API request failed with status ${response.status}, using fallback`);
            return loadFallbackApps();
        }
        
        const data = await response.json();
        console.log('[App] API response:', data);
        
        // APIレスポンスの検証
        if (!data) {
            console.warn('[App] Empty API response, using fallback');
            return loadFallbackApps();
        }
        
        if (!data.success) {
            console.warn('[App] API returned success=false, using fallback. Error:', data.error);
            return loadFallbackApps();
        }
        
        if (!Array.isArray(data.apps)) {
            console.warn('[App] API response does not contain apps array, using fallback');
            return loadFallbackApps();
        }
        
        if (data.apps.length === 0) {
            console.warn('[App] API returned empty apps array (tenant may have no apps configured), using fallback');
            return loadFallbackApps();
        }
        
        // APIから取得したアプリ情報を内部形式に変換
        // DBから取得したデータ（id, name, url, icon, iconClass, description）を
        // フロントエンドの形式（id, title, url, icon, iconClass, description, image）に変換
        apps = data.apps.map(app => ({
            id: app.id,
            title: app.name,
            description: app.description || '',
            image: defaultAppImages[app.id] || 'assets/img/default-app.png',
            url: app.url,
            icon: app.icon || '📱',
            iconClass: app.iconClass || null  // Bootstrap Icons等のクラス名（例: 'bi-truck', 'bi-calendar'）
        }));
        
        console.log(`[App] Successfully loaded ${apps.length} apps from API`);
        
        // AppConfig.endpointsにも反映（後方互換性のため）
        data.apps.forEach(app => {
            AppConfig.endpoints[app.id] = app.url;
        });
        
        return true;
    } catch (error) {
        console.error('[App] Error loading tenant apps:', error);
        console.error('[App] Stack trace:', error.stack);
        return loadFallbackApps();
    }
}

/**
 * フォールバック：デフォルトアプリ一覧
 * APIからアプリ情報を取得できない場合や、DBにデータが登録されていない場合に使用されます。
 * 
 * 使用ケース：
 * - /api/tenant-apps エンドポイントがエラーを返した
 * - テナントに紐づくアプリルーティング情報がDBに存在しない
 * - ネットワークエラーでAPIにアクセスできない
 * 
 * @returns {boolean} false（フォールバックを使用したことを示す）
 */
function loadFallbackApps() {
    console.warn('[App] ⚠️  Loading fallback apps (static default list)');
    console.warn('[App] This usually means:');
    console.warn('[App]   - tenant_app_routings table is empty or missing');
    console.warn('[App]   - API endpoint /api/tenant-apps returned an error');
    console.warn('[App]   - Network error occurred');
    
    apps = [
        {
            id: 'planning',
            title: '計画・運用管理',
            description: '保守用車の運用計画作成から運用の実績を管理できます。',
            image: 'assets/img/Operation Planning to Performance Management.png',
            url: '#planning',
            icon: '📅',
            iconClass: 'bi-calendar-check'
        },
        {
            id: 'equipment',
            title: '保守用車管理',
            description: '仕業点検簿の表示から実績を記録します。',
            image: 'assets/img/Inspection Checklist.jpeg',
            url: '#equipment',
            icon: '🚛',
            iconClass: 'bi-truck'
        },
        {
            id: 'emergency',
            title: '応急復旧支援',
            description: '機械故障等の技術支援します。',
            image: 'assets/img/recovery.png',
            url: '#emergency',
            icon: '🛠️',
            iconClass: 'bi-tools'
        },
        {
            id: 'failure',
            title: '機械故障管理',
            description: '機械故障の原因分析と対策策定、発生状況と対応履歴を管理します。',
            image: 'assets/img/Machinery Failure Management.png',
            url: '#failure',
            icon: '⚠️',
            iconClass: 'bi-exclamation-triangle'
        }
    ];
    
    console.log(`[App] Loaded ${apps.length} fallback apps`);
    return false;
}

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
    
    // テナントに紐づくアプリ情報を取得
    await loadTenantApps();

    const tenantEnvironmentLabel = document.getElementById('tenant-environment-label');
    if (tenantEnvironmentLabel) {
        const userInfo = readStoredUserInfo() || {};
        const pathTenantId = window.location.pathname.split('/').filter(Boolean)[0] || '';
        const tenantId = normalizeExternalTenantId(
            pathTenantId || userInfo.tenant_id || userInfo.tenantId
                || (window.TenantContext && typeof window.TenantContext.getTenantId === 'function'
                    ? window.TenantContext.getTenantId()
                    : '')
        );
        const contextCompanyName = window.TenantContext && typeof window.TenantContext.getCompanyName === 'function'
            ? String(window.TenantContext.getCompanyName() || '').trim()
            : '';
        const storedCompanyName = String(userInfo.company_name || userInfo.companyName || userInfo.tenant_name || userInfo.tenantName || '').trim();
        const routeCompanyName = String(userInfo.route_company_name || userInfo.routeCompanyName || '').trim();
        const tenantName = window.TenantContext && typeof window.TenantContext.getTenantName === 'function'
            ? String(window.TenantContext.getTenantName() || '').trim()
            : '';
        const companyName = contextCompanyName || tenantName || storedCompanyName || routeCompanyName;
        const tenantLabel = companyName
            ? `${companyName} 様環境`
            : (tenantId === 'demo' ? 'デモ環境' : 'テナント専用環境');
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

    let currentApp = null;

    // ========================================
    // アプリカードの動的生成
    // ========================================
    // DBから取得した tenant_app_routings のデータを元に、
    // 各アプリのカードを動的に生成して画面に表示します。
    console.log('[App] ========================================');
    console.log('[App] Generating app cards dynamically...');
    console.log(`[App] Total apps to render: ${apps.length}`);
    console.log('[App] ========================================');
    
    if (apps.length === 0) {
        console.warn('[App] ⚠️  No apps to render! Check if tenant_app_routings table has data.');
        appGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <p style="font-size: 1.2rem; color: #666;">アプリケーションが登録されていません。</p>
                <p style="font-size: 0.9rem; color: #999;">システム管理者に連絡してください。</p>
            </div>
        `;
    }
    
    apps.forEach((app, index) => {
        console.log(`[App] [${index + 1}/${apps.length}] Rendering card:`, {
            id: app.id,
            title: app.title,
            icon: app.icon,
            iconClass: app.iconClass,
            hasDescription: !!app.description
        });
        
        const card = document.createElement('div');
        card.className = 'app-card';
        
        // アイコン表示の決定ロジック:
        // 1. icon_class（Bootstrap Icons等）が指定されている場合 → <i>タグでアイコンフォントを表示
        // 2. icon_class がない場合 → 絵文字（icon）を表示
        // これにより、DBでアイコンの種類を柔軟に管理できます
        const iconDisplay = app.iconClass 
            ? `<i class="${app.iconClass}" style="font-size: 2.5rem; color: var(--primary-color);"></i>`
            : `<span style="font-size: 2.5rem;">${app.icon || '📱'}</span>`;
        
        card.innerHTML = `
            <div class="app-card-header">
                <h3>${app.title}</h3>
            </div>
            <div class="app-image-container">
                <img src="${app.image}" alt="${app.title}" class="app-image" onerror="this.src='assets/img/default-app.png'; this.onerror=null;">
                <div class="app-icon-floating">${iconDisplay}</div>
            </div>
            <div class="app-card-info">
                <p class="app-sub-desc">${app.description || 'アプリケーションの説明がありません。'}</p>
                <button class="launch-btn-small">アプリ起動</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            showTooltip(e, app);
        });

        appGrid.appendChild(card);
        console.log(`[App] ✅ Card rendered: ${app.title}`);
    });
    
    console.log('[App] ========================================');
    console.log('[App] All app cards rendered successfully!');
    console.log('[App] ========================================');

    /**
     * 吹き出しを表示する関数
     */
    function showTooltip(event, app) {
        currentApp = app;
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

        urlObj.searchParams.set('tenant_id', tenantId);
    }

    function getExternalAppPathId(appId) {
        const normalizedAppId = String(appId || '').trim().toLowerCase();
        return normalizedAppId === 'equipment' ? 'vehicle' : normalizedAppId;
    }

    function applyTenantPathToExternalUrl(urlObj, tenantContext, appId) {
        // urlObjが有効でなければ何もしない
        if (!urlObj || !urlObj.pathname) return;

        const tenantId = normalizeExternalTenantId(tenantContext.tenantId);
        const externalAppId = getExternalAppPathId(appId);

        if (!externalAppId) return;
        urlObj.pathname = `/${tenantId}/${externalAppId}`;
    }


    launchBtn.addEventListener('click', () => {
        const currentAppId = currentApp && currentApp.id;
        const externalAppId = getExternalAppPathId(currentAppId);
        console.log('currentAppId:', currentAppId);
        console.log('AppConfig.endpoints:', AppConfig.endpoints);

        const selectedAppUrl = currentApp && currentApp.url && !String(currentApp.url).startsWith('#')
            ? currentApp.url
            : '';
        const baseUrl = selectedAppUrl
            || AppConfig.endpoints[currentAppId]
            || AppConfig.endpoints[externalAppId];
        console.log('baseUrl:', baseUrl);

        if (!baseUrl || !externalAppId) {
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
        const shouldUseExternalAuthBridge = true; // ★ すべてのアプリで共通ブリッジ及びパス組立を行う
        let popupOrigin = '';
        let authContext = null;

        const urlObj = new URL(baseUrl, window.location.origin);
        const confirmedTenantContext = {
            tenantId: authPayload.tenantId,
            tenantPath: authPayload.tenantPath,
            role: authPayload.role,
            externalRole: authPayload.externalRole
        };
        const externalTenantId = normalizeExternalTenantId(confirmedTenantContext.tenantId);

        if (shouldUseExternalAuthBridge) {
            applyTenantPathToExternalUrl(urlObj, confirmedTenantContext, externalAppId);
        }

        // 外部アプリが必要とする認証情報だけを新たに組み立てる。
        urlObj.search = '';
        if (token) {
            urlObj.searchParams.set('token', token);
        }
        appendTenantLaunchParams(urlObj, { tenantId: externalTenantId });

        if (shouldUseExternalAuthBridge && token) {
            authContext = {
                token,
                tenantId: externalTenantId,
                tenantPath: confirmedTenantContext.tenantPath,
                role: confirmedTenantContext.role,
                externalRole: confirmedTenantContext.externalRole
            };
        }

        popupOrigin = urlObj.origin;
        const finalUrl = urlObj.toString();

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
