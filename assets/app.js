/**
 * App Data Definition
 * テナントに紐づくアプリ情報をAPIから動的に取得します。
 */
let apps = [];

function getTenantApiPath(targetPath) {
    return targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
}

// アプリ情報をデフォルト画像にマッピング（後方互換性のため）
// キーは DB (public.applications) の app_key と一致させる
const defaultAppImages = {
    'planning': '/assets/img/Operation Planning to Performance Management.png',
    'inspection': '/assets/img/Inspection Checklist.jpeg',
    'emergency': '/assets/img/recovery.png',
    'failure': '/assets/img/Machinery Failure Management.png'
};

// 画像読み込み失敗時のフォールバック処理。
// default-app.png も読めない場合（未配置・削除等）は404を繰り返さず、画像自体を非表示にして
// 隣接する app-icon-floating の絵文字/アイコン表示のみでカードを成立させる。
function handleAppImageError(imgEl) {
    if (imgEl.dataset.fallbackApplied === 'true') {
        imgEl.onerror = null;
        imgEl.style.display = 'none';
        return;
    }
    imgEl.dataset.fallbackApplied = 'true';
    imgEl.src = 'assets/img/default-app.png';
}

/**
 * テナントに紐づくアプリ情報を取得
 * DB の tenant_app_routings テーブルから動的に取得し、
 * 取得できない場合はフォールバック（デフォルトアプリ一覧）を使用します。
 * 
 * @returns {Promise<boolean>} true: API取得成功、false: フォールバック使用
 */
async function loadTenantApps() {
    try {
        console.log('[App] Fetching authorized apps from /api/apps...');
        const response = await fetch(getTenantApiPath('/api/apps'), { credentials: 'same-origin' });
        
        if (!response.ok) {
            throw new Error(`App API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[App] API response:', data);
        
        // APIレスポンスの検証
        if (!data || !Array.isArray(data.apps)) throw new Error('App API response is invalid');
        
        // APIから取得したアプリ情報を内部形式に変換
        // DBから取得したデータ（id, name, url, icon, iconClass, description）を
        // フロントエンドの形式（id, title, url, icon, iconClass, description, image）に変換
        apps = data.apps.map(app => ({
            id: app.app_key,
            title: app.app_name,
            description: app.description || '',
            image: app.image_url || defaultAppImages[app.app_key] || '/assets/img/default-app.png',
            url: app.app_url,
            icon: app.icon || '📱',
            iconClass: app.iconClass || null  // Bootstrap Icons等のクラス名（例: 'bi-truck', 'bi-calendar'）
        }));
        
        console.log(`[App] Successfully loaded ${apps.length} apps from API`);
        
        // AppConfig.endpointsにも反映（後方互換性のため）
        data.apps.forEach(app => {
            AppConfig.endpoints[app.app_key] = app.app_url;
        });
        
        return true;
    } catch (error) {
        console.error('[App] Error loading tenant apps:', error);
        console.error('[App] Stack trace:', error.stack);
        apps = [];
        return false;
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
    console.warn('[App]   - applications/tenant_applications tables are empty or missing');
    console.warn('[App]   - API endpoint /api/apps returned an error');
    console.warn('[App]   - Network error occurred');
    
    apps = [
        {
            id: 'planning',
            title: '運用計画実績管理',
            description: '保守用車の運用計画・実績を管理します',
            image: '/assets/img/Operation Planning to Performance Management.png',
            url: '#planning',
            icon: '📅',
            iconClass: 'bi-calendar-check'
        },
        {
            id: 'inspection',
            title: '仕業点検管理',
            description: '保守用車の仕業点検・点検記録を管理します',
            image: '/assets/img/Inspection Checklist.jpeg',
            url: '#inspection',
            icon: '🚛',
            iconClass: 'bi-truck'
        },
        {
            id: 'emergency',
            title: '応急処置支援',
            description: '機械故障等の技術支援を行います',
            image: '/assets/img/recovery.png',
            url: '#emergency',
            icon: '🛠️',
            iconClass: 'bi-tools'
        },
        {
            id: 'failure',
            title: '機械故障管理',
            description: '機械故障の原因分析と対策、発生状況を管理します',
            image: '/assets/img/Machinery Failure Management.png',
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
        const response = await fetch(getTenantApiPath('/api/config'));
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

    const authResponse = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!authResponse.ok) {
        window.location.replace('/login.html');
        return;
    }
    const authData = await authResponse.json();
    const userInfo = authData.user;

    // 設定をサーバーから読み込む
    await loadDynamicConfig();
    
    // テナントに紐づくアプリ情報を取得
    await loadTenantApps();

    const tenantEnvironmentLabel = document.getElementById('tenant-environment-label');
    if (tenantEnvironmentLabel) {
        const tenantId = userInfo.tenant_key || userInfo.tenant_id || 'demo';
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
    if (userInfo) {
        console.log('[App] Authenticated user:', userInfo.username);
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
                <img src="${app.image}" alt="${app.title}" class="app-image" data-fallback-applied="false" onerror="handleAppImageError(this)">
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

    launchBtn.addEventListener('click', async () => {
        const currentAppId = currentApp && currentApp.id;
        // ダッシュボード配下の4アプリ（01運用計画/02仕業点検/03応急処置/04機械故障）は
        // いずれもポップアップでSSOトークンをpostMessage経由で引き継ぐ必要がある。
        const SSO_HANDSHAKE_APP_KEYS = new Set(['equipment', 'vehicle', 'inspection', 'planning', 'emergency', 'failure']);
        const usesSsoHandshake = SSO_HANDSHAKE_APP_KEYS.has(currentAppId);
        console.log('currentAppId:', currentAppId);
        console.log('AppConfig.endpoints:', AppConfig.endpoints);

        const selectedAppUrl = currentApp && currentApp.url && !String(currentApp.url).startsWith('#')
            ? currentApp.url
            : '';
        const baseUrl = selectedAppUrl
            || AppConfig.endpoints[currentAppId];
        console.log('baseUrl:', baseUrl);

        if (!baseUrl || !currentAppId) {
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

        if (!usesSsoHandshake) {
            const urlObj = new URL(baseUrl, window.location.origin);
            urlObj.search = '';
            window.open(urlObj.toString(), '_blank');
            hideTooltip();
            return;
        }

        const appTitle = (currentApp && currentApp.title) || 'アプリ';
        const launchTab = window.open('about:blank', '_blank');
        if (!launchTab) {
            alert(`${appTitle}を開けませんでした。ブラウザーのポップアップ設定をご確認ください。`);
            return;
        }

        try {
            const response = await fetch(getTenantApiPath(`/api/apps/${encodeURIComponent(currentAppId)}/launch-token`), {
                method: 'POST',
                credentials: 'same-origin'
            });
            const launchContext = await response.json();
            if (!response.ok || !launchContext.success || !launchContext.token) {
                throw new Error(launchContext.message || '起動用の認証情報を取得できませんでした');
            }

            // 起動先URLは public.tenant_app_routings に登録された実際の待受先を使用する
            // HTTPSゲートウェイ（8443）経由の場合は、内部ポートではなく統一パス /inspection/ を使用する
            let targetUrl = baseUrl;
            if (window.location.protocol === 'https:' && (currentAppId === 'inspection' || baseUrl.includes(':5173'))) {
                targetUrl = `${window.location.origin}/inspection/`;
            }
            const urlObj = new URL(targetUrl, window.location.origin);
            const launchTenantId = launchContext.publicTenantId || launchContext.tenantKey;
            // URLクエリおよびフラグメントに機微情報やトークンを含めない（postMessageで安全にハンドシェイク）
            urlObj.search = '';
            urlObj.hash = '';

            const externalContext = {
                type: 'EXTERNAL_AUTH_CONTEXT',
                token: launchContext.token,
                tenantId: launchTenantId,
                tenantPath: '/',
                role: launchContext.role
            };
            const contextAcknowledged = new Promise((resolve, reject) => {
                let contextSent = false;
                const checkClosedInterval = window.setInterval(() => {
                    if (launchTab.closed) {
                        cleanup();
                        reject(new Error(`${appTitle}の起動画面が閉じられました。\n再試行方法: 「${appTitle}」ボタンをもう一度押してアプリを起動してください。`));
                    }
                }, 400);

                const timeoutId = window.setTimeout(() => {
                    cleanup();
                    reject(new Error(`${appTitle}との認証連携がタイムアウトしました。\n原因: アプリ画面（${urlObj.origin}）の応答がないか仕業点検API(3001)が停止しています。\n再試行方法: 画面を更新のうえ仕業点検ボタンを再押下してください。`));
                }, 15000);

                const cleanup = () => {
                    window.clearInterval(checkClosedInterval);
                    window.clearTimeout(timeoutId);
                    window.removeEventListener('message', handleAuthMessage);
                };

                const handleAuthMessage = (event) => {
                    if (event.source !== launchTab || event.origin !== urlObj.origin) return;

                    const messageType = String(event.data && event.data.type || '');
                    if (messageType === 'EXTERNAL_AUTH_READY' && !contextSent) {
                        contextSent = true;
                        launchTab.postMessage(externalContext, urlObj.origin);
                    } else if (messageType === 'EXTERNAL_AUTH_ACK' && contextSent) {
                        cleanup();
                        resolve(true);
                    } else if (messageType === 'EXTERNAL_AUTH_FAILED' && contextSent) {
                        cleanup();
                        reject(new Error(`${appTitle}で認証またはテナントDB確認に失敗しました。\n再試行方法: ダッシュボードから再ログインし、もう一度お試しください。`));
                    }
                };

                window.addEventListener('message', handleAuthMessage);
                launchTab.location.replace(urlObj.toString());
            });

            console.log('[App] Launching application:', urlObj.origin, currentAppId);
            await contextAcknowledged;
            hideTooltip();
        } catch (error) {
            if (!launchTab.closed) {
                launchTab.close();
            }
            console.error('[App] Application launch failed:', error);
            alert(error instanceof Error ? error.message : 'アプリを起動できませんでした');
        }
    });

    closeBtn.addEventListener('click', hideTooltip);
    overlay.addEventListener('click', hideTooltip);

    // ログアウトボタン（ログイン画面に戻る）
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('ログアウトしますか？')) {
                fetch(getTenantApiPath('/api/logout'), { method: 'POST', credentials: 'same-origin' })
                    .finally(() => { window.location.href = '/login.html'; });
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
