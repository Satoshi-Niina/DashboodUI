// ========================================
// デ��ント判定�者共通fetchユーデ��リデ��
// ========================================

// グローバルな token 参照エラー（Reference者rror: token is not defined）を防ぐトークン定義
let token = '';
try {
    token = localStorage.getItem('user_token') || localStorage.getItem('auth_token') || '';
} catch (e) {
    token = '';
}

function getAuthToken() {
    try {
        const val = localStorage.getItem('user_token') || localStorage.getItem('auth_token') || token || '';
        return (val && val !== 'undefined' && val !== 'null') ? val : '';
    } catch {
        return (token && token !== 'undefined') ? token : '';
    }
}

// テナント日本語表示マップ
const GLOBAL_TENANT_NAME_MAP = {
    demo: 'デモ環境',
    demo_env: 'デモ環境',
    daitetsu: '大鉄工業',
    kosei: '広成建設',
    kintetsu: '近鉄'
};

function formatTenantDisplayName(tenantId) {
    const key = String(tenantId || '').trim().toLowerCase();
    return GLOBAL_TENANT_NAME_MAP[key] || key || '未設定';
}

// 統括管理者の選択中テナント (niina用)
window.selectedAdminTenantId = null;
window.canSwitchAdminTenant = false;
window.availableAdminTenants = [];
window.isSuperAdmin = false;
window.currentAdminUsername = null;
window.adminHomeTenantId = null;

function getCurrentTenantId() {
    // 統括管理者 (niina) の選択中テナント (window またはストレージ) を最優先
    const savedTenant = window.selectedAdminTenantId 
        || sessionStorage.getItem('selected_admin_tenant_id') 
        || localStorage.getItem('selected_admin_tenant_id');

    if (savedTenant && (window.canSwitchAdminTenant || window.isSuperAdmin || savedTenant !== 'demo')) {
        return savedTenant;
    }

    if (window.adminHomeTenantId) {
        return window.adminHomeTenantId;
    }

    const pathSegments = window.location.pathname
        .split("/")
        .filter(Boolean);

    const firstSegment = String(pathSegments[0] ?? "")
        .trim()
        .toLowerCase();

    const excludedPaths = [
        "admin.html",
        "index.html",
        "login.html",
        "api",
        "assets"
    ];

    if (!firstSegment || excludedPaths.includes(firstSegment)) {
        return savedTenant || "daitetsu";
    }

    return firstSegment;
}

async function tenantFetch(url, options = {}) {
    const tenantId = getCurrentTenantId();

    const headers = new Headers(options.headers || {});
    headers.set("X-Tenant-Id", tenantId);
    headers.set(
        "X-Tenant-Path",
        tenantId === "demo" ? "/" : `/${tenantId}`
    );
    headers.set("X-Tenant-Full-Url", window.location.href);

    // URL にも query parameter (tenantId) を付与してプロキシ等のヘッダー脱落時にも確実に届くように多重化
    let targetUrl = url;
    try {
        const urlObj = new URL(url, window.location.origin);
        if (!urlObj.searchParams.has('tenantId') && !urlObj.searchParams.has('tenant_id')) {
            urlObj.searchParams.set('tenantId', tenantId);
        }
        targetUrl = urlObj.pathname + urlObj.search + urlObj.hash;
    } catch (_) {
        const sep = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${sep}tenantId=${encodeURIComponent(tenantId)}`;
    }

    return fetch(targetUrl, {
        ...options,
        headers
    });
}

// ========================================
// 設定: 機種マスタ関連の定数
// ========================================
const MACHIN者_CAT者GORI者S = [
    '軌道モータカー',
    '箱トロ',
    '鉄トロ',
    'ホッパー車',
    'レールカッター',
    '油圧ショベル',
    'クレーン',
    'その他'
];

function unwrapApiArray(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (!payload || typeof payload !== 'object') {
        return [];
    }

    if (Array.isArray(payload.data)) {
        return payload.data;
    }

    if (Array.isArray(payload.offices)) {
        return payload.offices;
    }

    if (Array.isArray(payload.bases)) {
        return payload.bases;
    }

    if (Array.isArray(payload.rows)) {
        return payload.rows;
    }

    return [];
}

function getApiMessage(payload, fallbackMessage) {
    if (payload && typeof payload === 'object') {
        return payload.message || payload.error || fallbackMessage;
    }
    return fallbackMessage;
}

// UUID/S者RIALぁ者��れ�者ID列でも安�者に扱ぁ者��め、数値変換せず文���者のまま正規化する、者
// 空文���者みnullに変換し、それ以外�者文���者として保持する、者
function normalizeOptionalId(value) {
    const normalized = String(value ?? '').trim();
    return normalized === '' ? null : normalized;
}

function normalizeUserRole(role) {
    const raw = String(role || '').trim();
    const normalized = raw.toLowerCase();

    if (normalized === 'system_admin' || normalized === 'administrator' || normalized === 'admin') {
        return 'system_admin';
    }

    if (normalized === 'operation_admin' || normalized === 'manager' || raw === '責任者') {
        return 'operation_admin';
    }

    if (!raw || normalized === 'user' || normalized === 'general_user' || normalized === 'operator') {
        return 'user';
    }

    return null;
}

function getRoleDisplayName(role) {
    const normalizedRole = normalizeUserRole(role) || 'user';
    if (normalizedRole === 'system_admin') {
        return 'システム管理者';
    }
    if (normalizedRole === 'operation_admin') {
        return '運用管理者';
    }
    return '一般ユーザー';
}

// ========================================
// 共通ユーティリティ関数 (XSS防止 & 通知)
// ========================================
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.log(`[Toast ${type}]`, message);
        return;
    }
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
window.showToast = showToast;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Admin] Initializing admin page (fault-tolerant)...');

    // 1. テナントコンテキスト初期化
    try {
        if (window.TenantContext && typeof window.TenantContext.init === 'function') {
            await window.TenantContext.init();
        }
    } catch (e) {
        console.warn('[Admin Init] TenantContext.init warning:', e);
    }

    // 2. 認証・セッション確認
    let normalizedRole = 'user';
    try {
        const authResponse = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!authResponse.ok) {
            console.error('[Admin] No active session, redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        const authData = await authResponse.json();
        const userInfo = authData.user || {};
        console.log('[Admin] User info:', userInfo);
        const adminDisplayName = userInfo.display_name || userInfo.displayName || userInfo.full_name || userInfo.username;
        const adminUserEl = document.getElementById('admin-user');
        if (adminUserEl) adminUserEl.textContent = adminDisplayName;

        normalizedRole = normalizeUserRole(userInfo.role);
        window.currentAdminUserRole = normalizedRole;
        window.currentAdminUsername = String(userInfo.username || '').trim().toLowerCase();
        window.currentAdminUserInfo = userInfo;

        // niina または system_admin をスーパー管理者として判定
        window.isSuperAdmin = Boolean(
            window.currentAdminUsername === 'niina' ||
            userInfo.is_super_admin ||
            userInfo.id === 'e996e889-4165-412f-8450-8b6e0f193256'
        );
        window.canSwitchAdminTenant = window.isSuperAdmin;
        const rawHomeTenant = userInfo.tenant_key || userInfo.tenantId || (String(userInfo.tenant_id).length > 20 ? 'daitetsu' : userInfo.tenant_id) || 'daitetsu';
        window.adminHomeTenantId = String(rawHomeTenant).trim().toLowerCase();

        // セッションストレージ等から以前選択したテナントを復元
        const savedSelectedTenant = sessionStorage.getItem('selected_admin_tenant_id') || localStorage.getItem('selected_admin_tenant_id');
        if (window.isSuperAdmin && savedSelectedTenant) {
            window.selectedAdminTenantId = savedSelectedTenant;
        } else if (!window.selectedAdminTenantId) {
            window.selectedAdminTenantId = window.adminHomeTenantId;
        }

        // グローバルテナント切替セレクタ初期化
        setupGlobalTenantSelector();

        const isAllowed = normalizedRole === 'system_admin' || normalizedRole === 'operation_admin' || window.isSuperAdmin;

        if (!isAllowed) {
            console.error('[Admin] Access denied - role:', userInfo.role);
            alert('アクセス権限がありません。管理者権限が必要です。');
            window.location.href = '/index.html';
            return;
        }
        console.log('[Admin] Access granted for role:', normalizedRole, 'isSuperAdmin:', window.isSuperAdmin);
    } catch (e) {
        console.error('[Admin Init] Auth verification failed:', e);
    }

    // 3. ロールに基づくタブ表示制御
    try {
        applyRoleBasedTabVisibility(normalizedRole || 'user');
    } catch (e) {
        console.error('[Admin Init] applyRoleBasedTabVisibility error:', e);
    }

    // 4. メイン画面に戻るボタン
    try {
        const backBtn = document.getElementById('back-to-main-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/index.html';
            });
        }
    } catch (e) {
        console.error('[Admin Init] back-to-main-btn error:', e);
    }

    // 5. 汎用テーブルフィルター関数
    window.applyTableFilter = function (table) {
        try {
            const filters = Array.from(table.querySelectorAll('.column-filter'));
            const activeFilters = filters.map(f => ({
                index: parseInt(f.dataset.col),
                value: f.value
            })).filter(f => f.value !== "");

            const rows = Array.from(table.querySelector('tbody').rows);
            let visibleCount = 0;

            rows.forEach(row => {
                const isMatch = activeFilters.every(f => {
                    const cellText = row.cells[f.index].textContent.trim();
                    return cellText === f.value;
                });
                row.style.display = isMatch ? "" : "none";
                if (isMatch) visibleCount++;
            });
            console.log('[applyTableFilter] Visible rows:', visibleCount, '/', rows.length);
        } catch (e) {
            console.error('[applyTableFilter] error:', e);
        }
    };

    // 6. フィルタの選択肢を自動生成する関数 (XSS防止 escapeHtml 適用)
    window.updateFilterOptions = function (table) {
        try {
            const filters = Array.from(table.querySelectorAll('.column-filter'));
            const rows = Array.from(table.querySelector('tbody').rows);

            filters.forEach(select => {
                const colIndex = parseInt(select.dataset.col);
                const activeFilters = filters.map((f, idx) => {
                    if (idx === filters.indexOf(select)) return null;
                    return {
                        index: parseInt(f.dataset.col),
                        value: f.value
                    };
                }).filter(f => f && f.value !== "");

                const filteredRows = rows.filter(row => {
                    return activeFilters.every(f => {
                        const cellText = row.cells[f.index].textContent.trim();
                        return cellText === f.value;
                    });
                });

                const values = new Set();
                filteredRows.forEach(row => {
                    const text = row.cells[colIndex].textContent.trim();
                    if (text) values.add(text);
                });

                const currentVal = select.value;
                let optionsHtml = '<option value="">(全て)</option>';
                Array.from(values).sort().forEach(val => {
                    optionsHtml += `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`;
                });
                select.innerHTML = optionsHtml;
                select.value = currentVal;
            });
        } catch (e) {
            console.error('[updateFilterOptions] error:', e);
        }
    };

    // 7. タブ機能の初期化
    try {
        initializeTabs();
    } catch (e) {
        console.error('[Admin Init] initializeTabs error:', e);
    }

    // 8. 共通イベントリスナーの初期化
    try {
        initializeEventListeners();
    } catch (e) {
        console.error('[Admin Init] initializeEventListeners error:', e);
    }

    // 9. 登録デバイス管理の初期化
    try {
        initializeDeviceManagement();
    } catch (e) {
        console.error('[Admin Init] initializeDeviceManagement error:', e);
    }

    // 10. システム操作（メンテナンス・ガバナンス）の初期化
    try {
        initializeSystemOperations();
    } catch (e) {
        console.error('[Admin Init] initializeSystemOperations error:', e);
    }

    // 11. 初期データロード (最初のタブ: ユーザー管理)
    try {
        loadUsers();
    } catch (e) {
        console.error('[Admin Init] loadUsers error:', e);
    }
});

function applyRoleBasedTabVisibility(role) {
    console.log('[applyRoleBasedTabVisibility] Applying visibility for role:', role);
    const normalizedRole = normalizeUserRole(role) || 'user';

    // シスデ��管理��者��用のタデ
    const isSuper = Boolean(window.isSuperAdmin || window.currentAdminUsername === 'niina');

    // システム自体に関する設定タブ（スーパー管理者 niina 専用）
    const systemAdminOnlyTabs = [
        'app-management',
        'database-management',
        'ai-management',
        'system-settings',
        'system-operations'
    ];

    systemAdminOnlyTabs.forEach(tabName => {
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);

        if (isSuper) {
            // シスデ��管理��者��は表示
            if (tabButton) {
                tabButton.style.display = '';
                console.log(`[applyRoleBasedTabVisibility] Showing tab: ${tabName}`);
            }
            if (tabContent) {
                tabContent.style.display = '';
            }
        } else {
            // 運用管理��者��は非表示
            if (tabButton) {
                tabButton.style.display = 'none';
                console.log(`[applyRoleBasedTabVisibility] Hiding tab: ${tabName}`);
            }
            if (tabContent) {
                tabContent.style.display = 'none';
            }
        }
    });
}

// タブ機�者
/**
 * 統括テナント切替セレクタの初期化 & 連動 (niina専用)
 */
function setupGlobalTenantSelector(availableTenants = []) {
    const badge = document.getElementById('admin-current-tenant-badge');
    const selectorWrap = document.getElementById('admin-global-tenant-selector-wrap');
    const selectElem = document.getElementById('admin-global-tenant-select');

    const homeTenant = window.adminHomeTenantId || 'daitetsu';
    const currentSelected = window.selectedAdminTenantId || homeTenant;

    function updateTenantBadge(targetTenant) {
        if (!badge) return;
        const tenantName = formatTenantDisplayName(targetTenant);
        if (window.canSwitchAdminTenant || window.isSuperAdmin) {
            badge.textContent = `${tenantName} 様環境 (統括中)`;
        } else {
            badge.textContent = `所属: ${tenantName}`;
        }
    }

    updateTenantBadge(currentSelected);

    if (window.canSwitchAdminTenant && selectorWrap && selectElem) {
        selectorWrap.style.display = 'inline-flex';

        if (Array.isArray(availableTenants) && availableTenants.length > 0) {
            window.availableAdminTenants = availableTenants;
        } else if (window.availableAdminTenants.length === 0) {
            window.availableAdminTenants = [
                { tenant_key: 'daitetsu', tenant_name: '大鉄工業' },
                { tenant_key: 'kosei', tenant_name: '広成建設' },
                { tenant_key: 'kintetsu', tenant_name: '近鉄' }
            ];
        }

        selectElem.innerHTML = window.availableAdminTenants.map(t =>
            `<option value="${t.tenant_key}" ${t.tenant_key === currentSelected ? 'selected' : ''}>${t.tenant_name} (${t.tenant_key})</option>`
        ).join('');
        selectElem.value = currentSelected;

        if (!selectElem.dataset.listenerAttached) {
            selectElem.dataset.listenerAttached = 'true';
            selectElem.addEventListener('change', () => {
                const newTenant = selectElem.value;
                console.log(`[Admin] Switching global tenant to: ${newTenant}`);
                window.selectedAdminTenantId = newTenant;
                sessionStorage.setItem('selected_admin_tenant_id', newTenant);
                localStorage.setItem('selected_admin_tenant_id', newTenant);

                // 左側のテナントバッジ表示を即時更新
                updateTenantBadge(newTenant);

                // 端末登録タブ側のテナントセレクタとも同期
                if (typeof selectedDeviceTenantId !== 'undefined') {
                    selectedDeviceTenantId = newTenant;
                    const devSelect = document.getElementById('device-tenant-select');
                    if (devSelect) devSelect.value = newTenant;
                }

                // 現在アクティブなタブのデータを即時再読み込み
                reloadCurrentActiveTab();
            });
        }
    } else if (selectorWrap) {
        selectorWrap.style.display = 'none';
    }
}

/**
 * 現在アクティブなタブのデータを再読み込み
 */
function reloadCurrentActiveTab() {
    const activeBtn = document.querySelector('.tab-button.active');
    const tabName = activeBtn ? activeBtn.getAttribute('data-tab') : 'user-management';
    console.log(`[Admin] Reloading active tab: ${tabName} for tenant: ${getCurrentTenantId()}`);

    if (tabName === 'user-management') {
        loadUsers();
    } else if (tabName === 'office-master') {
        loadOffices();
    } else if (tabName === 'base-master') {
        loadBases();
    } else if (tabName === 'vehicle-master') {
        loadMachineTypes();
        loadMachines();
    } else if (tabName === 'inspection-master') {
        loadInspectionTypes();
        loadInspectionSchedules();
    } else if (tabName === 'database-management') {
        if (typeof loadDatabaseStats === 'function') loadDatabaseStats();
    } else if (tabName === 'app-management') {
        if (typeof loadAppManagementTenants === 'function') loadAppManagementTenants();
    } else if (tabName === 'system-settings') {
        if (typeof loadSystemSettings === 'function') loadSystemSettings();
    } else if (tabName === 'system-operations') {
        if (typeof loadRegisteredDevices === 'function') loadRegisteredDevices();
        if (typeof loadStorageUsage === 'function') loadStorageUsage();
        if (typeof loadCertificateStatus === 'function') loadCertificateStatus();
        if (typeof loadNpmAudit === 'function') loadNpmAudit();
    }
}

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    console.log('[initializeTabs] Found tab buttons:', tabButtons.length);
    console.log('[initializeTabs] Found tab contents:', tabContents.length);

    // 最初�者タブをアクデ��ブにする
    if (tabButtons.length > 0) {
        tabButtons[0].classList.add('active');
        const firstTabName = tabButtons[0].getAttribute('data-tab');
        console.log('[initializeTabs] First tab name:', firstTabName);
        const firstTabContent = document.getElementById(`${firstTabName}-tab`);
        if (firstTabContent) {
            firstTabContent.style.display = 'block';
            console.log('[initializeTabs] First tab activated');
        } else {
            console.error('[initializeTabs] First tab content not found:', `${firstTabName}-tab`);
        }
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            console.log('[Tab Click] Clicked tab:', tabName);

            // すべてのタブ�者タンとコンデ��デ��非アクデ��ブにする
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');

            // クリデ��されたタブをアクデ��ブにする
            button.classList.add('active');
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) {
                targetTab.style.display = 'block';
                console.log('[Tab Click] Tab activated:', tabName);
            } else {
                console.error('[Tab Click] Tab content not found:', `${tabName}-tab`);
            }

            // タブに応じてデ�者タを読み込み
            if (tabName === 'user-management') {
                loadUsers();
            } else if (tabName === 'office-master') {
                loadOffices();
            } else if (tabName === 'base-master') {
                loadBases();
            } else if (tabName === 'vehicle-master') {
                loadMachineTypes();
                loadMachines();
            } else if (tabName === 'inspection-master') {
                loadInspectionTypes();
                loadInspectionSchedules();
            } else if (tabName === 'database-management') {
                loadDatabaseStats();
            } else if (tabName === 'app-management') {
                loadAppManagementTenants();
            } else if (tabName === 'system-settings') {
                loadSystemSettings();
            } else if (tabName === 'system-operations') {
                // システム管理タブ表示時のデータロード
                console.log('[System Operations] Tab activated, loading data...');
                loadRegisteredDevices();
                loadStorageUsage();
                loadCertificateStatus();
                loadNpmAudit();
            }
        });
    });
}

// イベントリスナ�者の初期匁者
function initializeEventListeners() {
    // システム共通設定ボタン
    const saveSysSettingsBtn = document.getElementById('save-system-settings-btn');
    if (saveSysSettingsBtn) {
        saveSysSettingsBtn.addEventListener('click', saveSystemSettings);
    }
    const refreshSysSettingsBtn = document.getElementById('refresh-system-settings-btn');
    if (refreshSysSettingsBtn) {
        refreshSysSettingsBtn.addEventListener('click', loadSystemSettings);
    }

    // ユーザー追加ボタン
    const addUserBtn = document.getElementById('add-new-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserModal());
    }

    // ユーザーインポ�者ト�者タン
    const importUsersBtn = document.getElementById('import-users-btn');
    const userImportFile = document.getElementById('user-import-file');
    if (importUsersBtn && userImportFile) {
        importUsersBtn.addEventListener('click', () => {
            userImportFile.click();
        });
        userImportFile.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importUsers(e.target.files[0]);
                e.target.value = ''; // ファイル選択をリセット��
            }
        });
    }

    // デ��プレートダウンロード�者タン
    const download者xcelBtn = document.getElementById('download-excel-template-btn');
    if (download者xcelBtn) {
        download者xcelBtn.addEventListener('click', () => downloadUserTemplate());
    }

    // フィルターイベンデ
    const filterDisplayName = document.getElementById('filter-display-name');
    const filterUsername = document.getElementById('filter-username');
    const filterRole = document.getElementById('filter-role');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    if (filterDisplayName) {
        filterDisplayName.addEventListener('change', applyUserFilters);
    }
    if (filterUsername) {
        filterUsername.addEventListener('change', applyUserFilters);
    }
    if (filterRole) {
        filterRole.addEventListener('change', applyUserFilters);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterDisplayName) filterDisplayName.value = '';
            if (filterUsername) filterUsername.value = '';
            if (filterRole) filterRole.value = '';
            applyUserFilters();
        });
    }

    // ユーザーモーダルのイベントリスナ�者
    const userModal = document.getElementById('user-modal');
    const userCloseModal = document.getElementById('modal-close');
    const userCancelBtn = document.getElementById('cancel-user-btn');
    const userForm = document.getElementById('user-form');

    if (userCloseModal) {
        userCloseModal.addEventListener('click', () => {
            userModal.style.display = 'none';
        });
    }

    if (userCancelBtn) {
        userCancelBtn.addEventListener('click', () => {
            userModal.style.display = 'none';
        });
    }

    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveUser();
        });
    }

    // 事業所追加ボタン
    const addOfficeBtn = document.getElementById('add-new-office-btn');
    if (addOfficeBtn) {
        addOfficeBtn.addEventListener('click', () => showOfficeModal('add', null));
    }

    // 事業所インポ�者ト�者タン
    const importOfficesBtn = document.getElementById('import-offices-btn');
    const officesImportFile = document.getElementById('offices-import-file');
    if (importOfficesBtn && officesImportFile) {
        importOfficesBtn.addEventListener('click', () => {
            officesImportFile.click();
        });
        officesImportFile.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importMasterData('offices', e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // 事業所デ��プレート�者タン
    const downloadOfficesTemplateBtn = document.getElementById('download-offices-template-btn');
    if (downloadOfficesTemplateBtn) {
        downloadOfficesTemplateBtn.addEventListener('click', () => downloadMasterTemplate('offices'));
    }

    // 保守基地追加ボタン
    const addBaseBtn = document.getElementById('add-new-base-btn');
    if (addBaseBtn) {
        addBaseBtn.addEventListener('click', () => showBaseModal('add', null));
    }

    // 保守基地インポ�者ト�者タン
    const importBasesBtn = document.getElementById('import-bases-btn');
    const basesImportFile = document.getElementById('bases-import-file');
    if (importBasesBtn && basesImportFile) {
        importBasesBtn.addEventListener('click', () => {
            basesImportFile.click();
        });
        basesImportFile.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importMasterData('bases', e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // 保守基地デ��プレート�者タン
    const downloadBasesTemplateBtn = document.getElementById('download-bases-template-btn');
    if (downloadBasesTemplateBtn) {
        downloadBasesTemplateBtn.addEventListener('click', () => downloadMasterTemplate('bases'));
    }

    // 機種マスタ追加ボタン
    const addMachineTypeBtn = document.getElementById('add-new-machine-type-btn');
    if (addMachineTypeBtn) {
        addMachineTypeBtn.addEventListener('click', () => {
            // カデ��リ選択肢を�者期化
            const categorySelect = document.getElementById('machine-type-category');
            if (categorySelect && categorySelect.options.length === 1) {
                MACHIN者_CAT者GORI者S.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    categorySelect.appendChild(option);
                });
            }
            openMachineTypeModal();
        });
    }

    // 機種マスタインポ�者ト�者タン
    const importMachineTypesBtn = document.getElementById('import-machine-types-btn');
    const machineTypesImportFile = document.getElementById('machine-types-import-file');
    if (importMachineTypesBtn && machineTypesImportFile) {
        importMachineTypesBtn.addEventListener('click', () => {
            machineTypesImportFile.click();
        });
        machineTypesImportFile.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importMasterData('machine-types', e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // 機種マスタデ��プレート�者タン
    const downloadMachineTypesTemplateBtn = document.getElementById('download-machine-types-template-btn');
    if (downloadMachineTypesTemplateBtn) {
        downloadMachineTypesTemplateBtn.addEventListener('click', () => downloadMasterTemplate('machine-types'));
    }

    // 機種マスタモーダルのイベントリスナ�者
    const machineTypeModal = document.getElementById('machine-type-modal');
    const machineTypeCloseModal = document.getElementById('machine-type-modal-close');
    const machineTypeCancelBtn = document.getElementById('cancel-machine-type-btn');
    const machineTypeForm = document.getElementById('machine-type-form');

    if (machineTypeCloseModal) {
        machineTypeCloseModal.addEventListener('click', () => {
            machineTypeModal.style.display = 'none';
        });
    }

    if (machineTypeCancelBtn) {
        machineTypeCancelBtn.addEventListener('click', () => {
            machineTypeModal.style.display = 'none';
        });
    }

    if (machineTypeForm) {
        machineTypeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveMachineType();
        });
    }

    // 機械番号マスタ追加ボタン
    const addMachineBtn = document.getElementById('add-new-machine-btn');
    if (addMachineBtn) {
        addMachineBtn.addEventListener('click', () => openMachineModal());
    }

    // 保守用車インポ�者ト�者タン
    const importMachinesBtn = document.getElementById('import-machines-btn');
    const machinesImportFile = document.getElementById('machines-import-file');
    if (importMachinesBtn && machinesImportFile) {
        importMachinesBtn.addEventListener('click', () => {
            machinesImportFile.click();
        });
        machinesImportFile.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importMasterData('machines', e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // 保守用車テンプレート�者タン
    const downloadMachinesTemplateBtn = document.getElementById('download-machines-template-btn');
    if (downloadMachinesTemplateBtn) {
        downloadMachinesTemplateBtn.addEventListener('click', () => downloadMasterTemplate('machines'));
    }

    // 機械番号マスタモーダルのイベントリスナ�者
    const machineModal = document.getElementById('machine-modal');
    const machineCloseModal = document.getElementById('machine-modal-close');
    const machineCancelBtn = document.getElementById('cancel-machine-btn');
    const machineForm = document.getElementById('machine-form');

    if (machineCloseModal) {
        machineCloseModal.addEventListener('click', () => {
            machineModal.style.display = 'none';
        });
    }

    if (machineCancelBtn) {
        machineCancelBtn.addEventListener('click', () => {
            machineModal.style.display = 'none';
        });
    }

    if (machineForm) {
        machineForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveMachine();
        });
    }

    // 検修種別追加ボタン
    const addInspectionTypeBtn = document.getElementById('add-new-inspection-type-btn');
    if (addInspectionTypeBtn) {
        addInspectionTypeBtn.addEventListener('click', () => openInspectionTypeModal());
    }

    // 検修種別モーダルのイベントリスナ�者
    const inspectionTypeModal = document.getElementById('inspection-type-modal');
    const inspectionTypeCloseModal = document.getElementById('inspection-type-modal-close');
    const inspectionTypeCancelBtn = document.getElementById('cancel-inspection-type-btn');
    const inspectionTypeForm = document.getElementById('inspection-type-form');

    if (inspectionTypeCloseModal) {
        inspectionTypeCloseModal.addEventListener('click', () => {
            inspectionTypeModal.style.display = 'none';
        });
    }

    if (inspectionTypeCancelBtn) {
        inspectionTypeCancelBtn.addEventListener('click', () => {
            inspectionTypeModal.style.display = 'none';
        });
    }

    if (inspectionTypeForm) {
        inspectionTypeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveInspectionType();
        });
    }

    // 検修設定追加ボタン
    const addInspectionScheduleBtn = document.getElementById('add-new-inspection-schedule-btn');
    if (addInspectionScheduleBtn) {
        addInspectionScheduleBtn.addEventListener('click', () => openInspectionScheduleModal());
    }

    // 検修設定モーダルのイベントリスナ�者
    const inspectionScheduleModal = document.getElementById('inspection-schedule-modal');
    const inspectionScheduleCloseModal = document.getElementById('inspection-schedule-modal-close');
    const inspectionScheduleCancelBtn = document.getElementById('cancel-inspection-schedule-btn');
    const inspectionScheduleForm = document.getElementById('inspection-schedule-form');

    if (inspectionScheduleCloseModal) {
        inspectionScheduleCloseModal.addEventListener('click', () => {
            inspectionScheduleModal.style.display = 'none';
        });
    }

    if (inspectionScheduleCancelBtn) {
        inspectionScheduleCancelBtn.addEventListener('click', () => {
            inspectionScheduleModal.style.display = 'none';
        });
    }

    if (inspectionScheduleForm) {
        inspectionScheduleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveInspectionSchedule();
        });
    }

    // 全デ�者ブルの編集�者削除ボタンをイベント委譲で一允者��理
    const appManagementTenantSelect = document.getElementById('app-management-tenant-select');
    if (appManagementTenantSelect) {
        appManagementTenantSelect.addEventListener('change', () => {
            loadAppManagementApps(appManagementTenantSelect.value);
        });
    }

    const appManagementRefreshBtn = document.getElementById('app-management-refresh-btn');
    if (appManagementRefreshBtn) {
        appManagementRefreshBtn.addEventListener('click', () => {
            loadAppManagementTenants();
        });
    }

    const appManagementSaveBtn = document.getElementById('app-management-save-btn');
    if (appManagementSaveBtn) {
        appManagementSaveBtn.addEventListener('click', () => {
            saveAppManagementApps();
        });
    }

    document.addEventListener('click', event => {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        event.preventDefault();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const name = btn.dataset.name || '';

        switch (action) {
            // ユーザー管理
            case 'edit-user':
                editUser(id);
                break;
            case 'delete-user':
                deleteUser(id, name);
                break;
            // 事業所マスタ
            case 'edit-office':
                window.editOffice(id);
                break;
            case 'delete-office':
                window.deleteOffice(id, name);
                break;
            // 保守基地マスタ
            case 'edit-base':
                window.editBase(id);
                break;
            case 'delete-base':
                window.deleteBase(id, name);
                break;
            // 機種マスタ
            case 'edit-type':
                window.editMachineType(id);
                break;
            case 'delete-type':
                window.deleteMachineType(id, name);
                break;
            // 保守用車�者スタ
            case 'edit-machine':
                window.editMachine(id);
                break;
            case 'delete-machine':
                window.deleteMachine(id, btn.dataset.number || name);
                break;
            // 検修種別マスタ
            case 'edit-inspection-type':
                editInspectionType(id);
                break;
            case 'delete-inspection-type':
                deleteInspectionType(id, name);
                break;
            // 検修設定
            case 'edit-inspection-schedule':
                editInspectionSchedule(id);
                break;
            case 'delete-inspection-schedule':
                deleteInspectionSchedule(id, name);
                break;
            default:
                console.warn('[者vent] Unknown action:', action);
        }
    });
}

// ========== ユーザー管理==========
// グローバル変数としてユーザーデ�者タを保持
let allUsers = [];

// ========================================
// アプリ公開設定（テナント別デ��用アプリ起動制御�者�者
// ========================================

async function loadAppManagementTenants() {
    const select = document.getElementById('app-management-tenant-select');
    const list者l = document.getElementById('app-management-list');
    if (!select) return;

    try {
        const response = await tenantFetch('/api/admin/app-tenants', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(getApiMessage(data, 'テナント一覧の取得に失敗しました'));
        }

        const currentTenantId = getCurrentTenantId();
        const tenants = data.tenants && data.tenants.length > 0 ? data.tenants : [currentTenantId];
        const previousValue = select.value;

        select.innerHTML = tenants.map(t => `<option value="${t}">${t}</option>`).join('');
        select.value = tenants.includes(previousValue) ? previousValue : (tenants.includes(currentTenantId) ? currentTenantId : tenants[0]);

        await loadAppManagementApps(select.value);
    } catch (error) {
        console.error('[loadAppManagementTenants] 者rror:', error);
        if (list者l) {
            list者l.innerHTML = `<p class="loading" style="color: red;">⚠️ <br>エラー: ${error.message}</p>`;
        }
    }
}

async function loadAppManagementApps(tenantKey) {
    const list者l = document.getElementById('app-management-list');
    if (!list者l || !tenantKey) return;

    list者l.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const response = await tenantFetch(`/api/admin/tenant-apps/${encodeURIComponent(tenantKey)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(getApiMessage(data, 'アプリ一覧の取得に失敗しました'));
        }

        if (!data.apps || data.apps.length === 0) {
            list者l.innerHTML = '<p class="loading">公開可能なアプリが登録されていません</p>';
            return;
        }

        list者l.innerHTML = `
            <table class="simple-table" style="width:100%;">
                <thead>
                    <tr>
                        <th style="text-align:left;">公開</th>
                        <th style="text-align:left;">アプリ名</th>
                        <th style="text-align:left;">カテゴリ</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.apps.map(app => `
                        <tr>
                            <td>
                                <input type="checkbox" class="app-management-toggle" data-app-id="${app.appId}" ${app.isActive ? 'checked' : ''}>
                            </td>
                            <td>${app.appName || app.appId}</td>
                            <td>${app.category || '一般'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('[loadAppManagementApps] 者rror:', error);
        list者l.innerHTML = `<p class="loading" style="color: red;">⚠️ <br>エラー: ${error.message}</p>`;
    }
}

async function saveAppManagementApps() {
    const select = document.getElementById('app-management-tenant-select');
    const tenantKey = select ? select.value : '';
    if (!tenantKey) return;

    const toggles = document.querySelectorAll('.app-management-toggle');
    const apps = Array.from(toggles).map(toggle => ({
        appId: toggle.getAttribute('data-app-id'),
        isActive: toggle.checked
    }));

    if (apps.length === 0) return;

    try {
        const response = await tenantFetch(`/api/admin/tenant-apps/${encodeURIComponent(tenantKey)}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apps })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(getApiMessage(data, '公開設定の保存に失敗しました'));
        }

        alert(`テナント「${tenantKey}」のアプリ公開設定を保存しました`);
        await loadAppManagementApps(tenantKey);
    } catch (error) {
        console.error('[saveAppManagementApps] Error:', error);
        alert(`公開設定の保存に失敗しました: ${error.message}`);
    }
}

async function loadUsers() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        console.log('[loadUsers] Fetching users...');
        const response = await tenantFetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[loadUsers] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadUsers] Data received:', data);

        if (data.canSwitchTenant !== undefined) {
            window.canSwitchAdminTenant = Boolean(data.canSwitchTenant);
            if (Array.isArray(data.availableTenants) && data.availableTenants.length > 0) {
                window.availableAdminTenants = data.availableTenants;
            }
            setupGlobalTenantSelector(data.availableTenants);
        }

        if (data.success && data.users.length > 0) {
            // 全ユーザーデ�者タをグローバル変数に保存
            allUsers = data.users.map(user => ({
                ...user,
                role: normalizeUserRole(user.role) || 'user'
            }));
            // フィルター選択肢を更新
            updateUserFilterOptions();
            // フィルター適用して表示
            applyUserFilters();
        } else {
            allUsers = [];
            usersList.innerHTML = '<p class="loading">ユーザーが登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadUsers] 者rror:', error);
        allUsers = [];
        usersList.innerHTML = `<p class="loading" style="color: red;">⚠️ <br>エラー: ${error.message}<br>データベース接続を確認してください</p>`;
    }
}

// ユーザーフィルターの選択肢を更新する関数
function updateUserFilterOptions() {
    const filterDisplayName = document.getElementById('filter-display-name');
    const filterUsername = document.getElementById('filter-username');

    if (!filterDisplayName || !filterUsername) return;

    // 表示名�者一覧を取得（重複��去・ソート！者
    const displayNames = [...new Set(allUsers.map(u => u.display_name).filter(Boolean))].sort();
    const currentDisplayName = filterDisplayName.value;
    filterDisplayName.innerHTML = '<option value="">すべて</option>' +
        displayNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    filterDisplayName.value = currentDisplayName;

    // ユーザー名�者一覧を取得（重複��去・ソート！者
    const usernames = [...new Set(allUsers.map(u => u.username))].sort();
    const currentUsername = filterUsername.value;
    filterUsername.innerHTML = '<option value="">すべて</option>' +
        usernames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    filterUsername.value = currentUsername;
}

// ユーザーフィルター適用関数
function applyUserFilters() {
    const filterDisplayName = document.getElementById('filter-display-name').value.trim();
    const filterUsername = document.getElementById('filter-username').value.trim();
    const filterRole = document.getElementById('filter-role').value;

    // フィルター条件に基づい��ユーザーを絞り込み
    const filteredUsers = allUsers.filter(user => {
        const matchDisplayName = !filterDisplayName || user.display_name === filterDisplayName;
        const matchUsername = !filterUsername || user.username === filterUsername;
        const matchRole = !filterRole || (normalizeUserRole(user.role) || 'user') === filterRole;

        return matchDisplayName && matchUsername && matchRole;
    });

    // 表示を更新
    displayUsers(filteredUsers);
}

// ユーザー表示関数
function displayUsers(users) {
    const usersList = document.getElementById('users-list');

    if (users.length === 0) {
        usersList.innerHTML = '<p class="loading">条件に一致するユーザーが見つかりません</p>';
        return;
    }

    usersList.innerHTML = users.map(user => {
        const normalizedRole = normalizeUserRole(user.role) || 'user';
        const roleDisplayName = getRoleDisplayName(normalizedRole);

        return `
            <div class="user-item" data-username="${escapeHtml(user.username)}" data-displayname="${escapeHtml(user.display_name || '')}" data-role="${normalizedRole}">
                <div class="user-info">
                    <div class="username">${escapeHtml(user.username)}</div>
                    <div class="display-name">${escapeHtml(user.display_name || '')}</div>
                    <span class="role-badge role-${normalizedRole}">${roleDisplayName}</span>
                </div>
                <div class="user-actions-buttons">
                    <button class="btn-edit" data-action="edit-user" data-id="${user.id}">編集</button>
                    <button class="btn-delete" data-action="delete-user" data-id="${user.id}" data-name="${escapeHtml(user.username)}">削除</button>
                </div>
            </div>
        `;
    }).join('');
}

function openUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('user-form');
    const tenantSelect = document.getElementById('user-tenant-select');
    const tenantNameInput = document.getElementById('user-tenant-name');
    const roleSelect = document.getElementById('user-role');

    form.reset();
    document.getElementById('user-id').value = '';

    const currentTenant = getCurrentTenantId();

    // 所属テナント表示・選択の制御
    if (window.canSwitchAdminTenant && tenantSelect && tenantNameInput) {
        tenantNameInput.style.display = 'none';
        tenantSelect.style.display = 'block';
        const tenants = (window.availableAdminTenants && window.availableAdminTenants.length > 0)
            ? window.availableAdminTenants
            : [
                { tenant_key: 'daitetsu', tenant_name: '大鉄工業' },
                { tenant_key: 'kosei', tenant_name: '広成建設' },
                { tenant_key: 'kintetsu', tenant_name: '近鉄' }
            ];
        tenantSelect.innerHTML = tenants.map(t =>
            `<option value="${t.tenant_key}" ${t.tenant_key === currentTenant ? 'selected' : ''}>${t.tenant_name} (${t.tenant_key})</option>`
        ).join('');
    } else if (tenantNameInput) {
        tenantNameInput.style.display = 'block';
        if (tenantSelect) tenantSelect.style.display = 'none';
        tenantNameInput.value = formatTenantDisplayName(currentTenant);
    }

    // 役割選択の制御: niina 以外は system_admin を選択不可にする
    if (roleSelect) {
        const sysAdminOpt = roleSelect.querySelector('option[value="system_admin"]');
        if (sysAdminOpt) {
            sysAdminOpt.disabled = !window.canSwitchAdminTenant;
            sysAdminOpt.hidden = !window.canSwitchAdminTenant;
        }
    }

    if (userId) {
        modalTitle.textContent = 'ユーザーを編集';
        loadUserData(userId);
    } else {
        modalTitle.textContent = 'ユーザーを追加';
    }

    modal.style.display = 'flex';
}

async function loadUserData(userId) {
    try {
        const response = await tenantFetch(`/api/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        let data = null;

        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (!response.ok || !data || !data.success || !data.user) {
            throw new Error((data && data.message) || `HTTP ${response.status}`);
        }

        const user = data.user;
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-username').value = user.username || '';
        document.getElementById('user-full-name').value = user.display_name || '';
        document.getElementById('user-email').value = user.email || '';
        document.getElementById('user-role').value = normalizeUserRole(user.role) || 'user';
    } catch (error) {
        console.error('Failed to load user data:', error);
        // 詳細APIが失敗した場合でも、一覧で取得済みの最低限の情報を表示する
        const fallbackUser = allUsers.find(u => String(u.id) === String(userId));
        if (fallbackUser) {
            document.getElementById('user-id').value = fallbackUser.id;
            document.getElementById('user-username').value = fallbackUser.username || '';
            document.getElementById('user-full-name').value = fallbackUser.display_name || '';
            document.getElementById('user-role').value = normalizeUserRole(fallbackUser.role) || 'user';
        }
        showToast('ユーザー情報の読み込みに失敗しました', 'error');
    }
}

async function saveUser() {
    const userId = document.getElementById('user-id').value;
    const tenantSelect = document.getElementById('user-tenant-select');
    const targetTenantId = (window.canSwitchAdminTenant && tenantSelect && tenantSelect.value)
        ? tenantSelect.value
        : getCurrentTenantId();

    const userData = {
        username: document.getElementById('user-username').value,
        display_name: document.getElementById('user-full-name').value,
        email: document.getElementById('user-email').value,
        password: document.getElementById('user-password').value,
        role: normalizeUserRole(document.getElementById('user-role').value) || 'user',
        targetTenantId: targetTenantId
    };

    console.log('[saveUser] Saving user:', { userId, userData: { ...userData, password: '***' } });

    try {
        const url = userId ? `/api/users/${userId}` : '/api/users';
        const method = userId ? 'PUT' : 'POST';

        console.log('[saveUser] Request:', { url, method });

        const response = await tenantFetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        console.log('[saveUser] Response status:', response.status);

        const data = await response.json();
        console.log('[saveUser] Response data:', data);

        if (data.success) {
            showToast(userId ? 'ユーザーを更新しました' : 'ユーザーを追加しました', 'success');
            document.getElementById('user-modal').style.display = 'none';

            // niinaが選択したテナントと表示を連動
            if (window.canSwitchAdminTenant && targetTenantId && targetTenantId !== window.selectedAdminTenantId) {
                window.selectedAdminTenantId = targetTenantId;
                const globalSelect = document.getElementById('admin-global-tenant-select');
                if (globalSelect) globalSelect.value = targetTenantId;
            }
            loadUsers();
        } else {
            console.error('[saveUser] Save failed:', data.message);
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('[saveUser] Failed to save user:', error);
        showToast('保存中にエラーが発生しました: ' + error.message, 'error');
    }
}

function editUser(userId) {
    openUserModal(userId);
}
window.editUser = editUser;

async function deleteUser(userId, username) {
    if (!confirm(`ユーザー「${username}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const response = await tenantFetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('ユーザーを削除しました', 'success');
            loadUsers();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete user:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}
window.deleteUser = deleteUser;

// ========== 機種マスタ管理==========
async function loadMachineTypes() {
    const list = document.getElementById('machine-types-list');
    list.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const response = await tenantFetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const machineTypes = unwrapApiArray(data);

        if (data.success && machineTypes.length > 0) {
            let html = `
                <table class="data-table" id="machine-types-table">
                    <thead>
                        <tr>
                            <th>機種コード</th>
                            <th>メーカー</th>
                            <th>型式</th>
                            <th>機種</th>
                            <th>操作</th>
                        </tr>
                        <tr class="filter-row">
                            <th><select class="column-filter" data-col="0"></select></th>
                            <th><select class="column-filter" data-col="1"></select></th>
                            <th><select class="column-filter" data-col="2"></select></th>
                            <th><select class="column-filter" data-col="3"></select></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            machineTypes.forEach((type, index) => {
                const typeId = String(type.id);
                const displayCode = type.display_code || `MT-${String(index + 1).padStart(4, '0')}`;
                const categoryLabel = type.category ? String(type.category).replace('軌道モータカー', '軌道モーターカー') : '-';
                console.log('[loadMachineTypes] Rendering type:', { id: typeId });
                html += `
                    <tr>
                        <td>${escapeHtml(displayCode)}</td>
                        <td>${escapeHtml(type.manufacturer || '-')}</td>
                        <td>${escapeHtml(type.model_name || '-')}</td>
                        <td>${escapeHtml(categoryLabel)}</td>
                        <td>
                            <button class="btn-sm btn-edit" data-id="${typeId}" data-action="edit-type">編集</button>
                            <button class="btn-sm btn-delete" data-id="${typeId}" data-name="${escapeHtml(type.model_name || String(type.id))}" data-action="delete-type">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;

            // フィルターイベントと選択肢の初期匁者
            const table = document.getElementById('machine-types-table');
            if (table) {
                updateFilterOptions(table);
                const filters = table.querySelectorAll('.column-filter');
                filters.forEach(filter => {
                    filter.addEventListener('change', () => window.applyTableFilter(table));
                });
            }
        } else {
            list.innerHTML = '<p class="loading">機種が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadMachineTypes] 者rror:', error);
        list.innerHTML = `<p class="loading" style="color: red;">⚠️ 機種の読み込みに失敗しました</p>`;
    }
}

function openMachineTypeModal(machineTypeId = null) {
    const modal = document.getElementById('machine-type-modal');
    const modalTitle = document.getElementById('machine-type-modal-title');
    const form = document.getElementById('machine-type-form');

    form.reset();
    document.getElementById('machine-type-id').value = '';

    if (machineTypeId) {
        modalTitle.textContent = '編集';
        loadMachineTypeData(machineTypeId);
    } else {
        modalTitle.textContent = '新規追加';
    }

    modal.style.display = 'flex';
}

async function loadMachineTypeData(machineTypeId) {
    try {
        console.log('[loadMachineTypeData] Loading machine type:', machineTypeId, 'Type:', typeof machineTypeId);
        const response = await tenantFetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            // IDの型を柔軟に比輁者��数値と文���者の両方に対応！者
            const machineType = data.data.find(mt => String(mt.id) === String(machineTypeId));
            console.log('[loadMachineTypeData] Found machine type:', machineType);
            if (machineType) {
                document.getElementById('machine-type-id').value = machineType.id;
                document.getElementById('machine-type-model-name').value = machineType.model_name || '';
                document.getElementById('machine-type-manufacturer').value = machineType.manufacturer || '';
                document.getElementById('machine-type-category').value = machineType.category || '';
                document.getElementById('machine-type-description').value = machineType.description || '';
            } else {
                console.error('[loadMachineTypeData] Machine type not found:', machineTypeId);
                showToast('機種が見つかりません', 'error');
            }
        }
    } catch (error) {
        console.error('Failed to load machine type data:', error);
        showToast('機種情報の読み込みに失敗しました', 'error');
    }
}

async function saveMachineType() {
    const machineTypeId = document.getElementById('machine-type-id').value;
    const machineTypeData = {
        model_name: document.getElementById('machine-type-model-name').value,
        manufacturer: document.getElementById('machine-type-manufacturer').value,
        category: document.getElementById('machine-type-category').value
    };

    try {
        const url = machineTypeId ? `/api/machine-types/${machineTypeId}` : '/api/machine-types';
        const method = machineTypeId ? 'PUT' : 'POST';

        const response = await tenantFetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(machineTypeData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(machineTypeId ? '機種を更新しました' : '機種を追加しました', 'success');
            document.getElementById('machine-type-modal').style.display = 'none';
            loadMachineTypes();
        } else {
            // サーバ�者からのエラー詳細をアラートで表示�者�診断用�者�者
            const errorMsg = data.detail ? `${data.message}\n詳細: ${data.detail}` : (data.message || '保存に失敗しました');
            alert('🚨 サーバーエラーが発生しました:\n' + errorMsg);
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save machine type:', error);
        alert('リクエスト全体が失敗しました:\n' + error.message);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

function editMachineType(machineTypeId) {
    console.log('[editMachineType] Called with ID:', machineTypeId);
    try {
        openMachineTypeModal(machineTypeId);
    } catch (error) {
        console.error('[editMachineType] 者rror:', error);
        alert('編集モーダルを開く際にエラーが発生しました: ' + error.message);
    }
}

async function loadInspectionTypeCodePreview(machineTypeId) {
    const codeInput = document.getElementById('inspection-type-code');
    codeInput.value = '';
    if (!machineTypeId) return;
    try {
        const response = await tenantFetch(`/api/inspection-types/next-code?machine_type_id=${encodeURIComponent(machineTypeId)}`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || `検修種別コードの取得に失敗しました (HTTP ${response.status})`);
        }
        codeInput.value = data.data.type_code;
    } catch (error) {
        console.error('Failed to load inspection type code preview:', error);
        showToast(error.message || '検修種別コードの取得に失敗しました', 'error');
    }
}

// グローバルに公閁者
window.editMachineType = editMachineType;
console.log('[Global] editMachineType function registered:', typeof window.editMachineType);

async function deleteMachineType(machineTypeId, typeCode) {
    console.log('[deleteMachineType] Called with ID:', machineTypeId);
    if (!confirm(`機種「${typeCode}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const response = await tenantFetch(`/api/machine-types/${machineTypeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('機種を削除しました', 'success');
            loadMachineTypes();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete machine type:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

// グローバルに公閁者
window.deleteMachineType = deleteMachineType;

// ========== 機械番号マスタ管理==========
async function loadMachines() {
    const list = document.getElementById('machines-list');
    list.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const response = await tenantFetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errorMsg = `HTTP ${response.status}: ${errData.message || response.statusText}`;
            if (errData.detail) alert(`🚨 サーバーエラー詳細:\n${errData.detail}`);
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const machines = unwrapApiArray(data);

        if (data.success && machines.length > 0) {
            let html = `
                <table class="data-table" id="machines-table">
                    <thead>
                        <tr>
                            <th>管理事業所</th>
                            <th>機種</th>
                            <th>型式</th>
                            <th>機械番号</th>
                            <th>製造年月日</th>
                            <th>型式認定年月日</th>
                            <th>操作</th>
                        </tr>
                        <tr class="filter-row">
                            <th><select class="column-filter" data-col="0"></select></th>
                            <th><select class="column-filter" data-col="1"></select></th>
                            <th><select class="column-filter" data-col="2"></select></th>
                            <th><select class="column-filter" data-col="3"></select></th>
                            <th></th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            machines.forEach(machine => {
                const machineId = String(machine.machine_id || machine.id);
                const machineNumber = machine.machine_number || '-';
                const categoryLabel = machine.category
                    ? String(machine.category).replace('軌道モータカー', '軌道モーターカー')
                    : (machine.machine_category || '-');
                const modelLabel = [machine.manufacturer, machine.model_name].filter(Boolean).join(' ')
                    || machine.model_name
                    || '-';

                console.log('[loadMachines] Rendering machine:', { id: machineId, number: machineNumber });
                html += `
                    <tr>
                        <td>${escapeHtml(machine.office_name || '-')}</td>
                        <td><strong>${escapeHtml(categoryLabel)}</strong></td>
                        <td>${escapeHtml(modelLabel)}</td>
                        <td>${escapeHtml(machineNumber)}</td>
                        <td>${machine.manufacture_date ? new Date(machine.manufacture_date).toLocaleDateString('ja-JP') : '-'}</td>
                        <td>${machine.model_certification_date ? new Date(machine.model_certification_date).toLocaleDateString('ja-JP') : '-'}</td>
                        <td>
                            <button class="btn-sm btn-edit" data-id="${machineId}" data-action="edit-machine">編集</button>
                            <button class="btn-sm btn-delete" data-id="${machineId}" data-number="${escapeHtml(machineNumber)}" data-action="delete-machine">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;

            // デ��デ��: デ�者タ確認
            console.log('[loadMachines] Sample data:', machines.slice(0, 3));
            console.log('[loadMachines] Office names:', machines.map(m => m.office_name).filter((v, i, a) => a.indexOf(v) === i));
            console.log('[loadMachines] Sample with office_id:');
            machines.slice(0, 3).forEach(m => {
                console.log(`  - ${m.machine_number}: office_id=${m.office_id}, office_name=${m.office_name}`);
            });

            // フィルターイベントと選択肢の初期匁者
            const table = document.getElementById('machines-table');
            if (table) {
                console.log('[loadMachines] Calling updateFilterOptions');
                updateFilterOptions(table);
                const filters = table.querySelectorAll('.column-filter');
                console.log('[loadMachines] Found filters:', filters.length);
                filters.forEach(filter => {
                    filter.addEventListener('change', () => {
                        console.log('[filter change] Applying filter');
                        window.applyTableFilter(table);
                        console.log('[filter change] Updating other filter options');
                        updateFilterOptions(table);
                    });
                });
            }
        } else {
            list.innerHTML = '<p class="loading">機械番号が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadMachines] 者rror:', error);
        list.innerHTML = `<p class="loading" style="color: red;">⚠️ </p>`;
    }
}


// テキストエリアの自動高さ拡張
function initAutoExpandTextareas() {
    document.querySelectorAll('textarea.auto-expand-textarea').forEach(textarea => {
        const adjust = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(72, textarea.scrollHeight) + 'px';
        };
        if (!textarea._hasAutoExpand) {
            textarea._hasAutoExpand = true;
            textarea.addEventListener('input', adjust);
        }
        adjust();
    });
}

let allMachineTypesCache = [];
let allOfficesCache = [];
let machineCategoryModelInitialized = false;

function initMachineModalControls() {
    if (machineCategoryModelInitialized) return;
    const catSelect = document.getElementById('machine-category-select');
    const modelSelect = document.getElementById('machine-model-select');
    const mfgInput = document.getElementById('machine-manufacturer-input');
    const typeIdInput = document.getElementById('machine-type-id');

    if (catSelect && modelSelect) {
        catSelect.addEventListener('change', () => {
            const selectedCat = catSelect.value;
            populateMachineModelsForCategory(selectedCat);
            if (mfgInput) mfgInput.value = '';
            if (typeIdInput) typeIdInput.value = '';
        });

        modelSelect.addEventListener('change', () => {
            const selectedTypeId = modelSelect.value;
            if (typeIdInput) typeIdInput.value = selectedTypeId;
            const found = allMachineTypesCache.find(mt => String(mt.id) === String(selectedTypeId));
            if (mfgInput) {
                mfgInput.value = found ? (found.manufacturer || '') : '';
            }
        });
        machineCategoryModelInitialized = true;
    }
}

function populateMachineCategories(selectedCategory = '') {
    const catSelect = document.getElementById('machine-category-select');
    if (!catSelect) return;

    const normalizeCat = (cat) => String(cat || 'その他').replace('軌道モータカー', '軌道モーターカー').trim();
    const categories = [];
    allMachineTypesCache.forEach(mt => {
        const cat = normalizeCat(mt.category);
        if (cat && !categories.includes(cat)) {
            categories.push(cat);
        }
    });

    const categoryPriority = ['軌道モーターカー', '箱トロ', '鉄トロ', 'ホッパー車', 'レールカッター', '油圧ショベル', 'クレーン', 'その他'];
    categories.sort((a, b) => {
        const idxA = categoryPriority.indexOf(a) !== -1 ? categoryPriority.indexOf(a) : 999;
        const idxB = categoryPriority.indexOf(b) !== -1 ? categoryPriority.indexOf(b) : 999;
        if (idxA !== idxB) return idxA - idxB;
        return a.localeCompare(b, 'ja');
    });

    catSelect.innerHTML = '<option value="">-- 機種を選択 --</option>' +
        categories.map(cat => `<option value="${escapeHtml(cat)}"${cat === selectedCategory ? ' selected' : ''}>${escapeHtml(cat)}</option>`).join('');
}

function populateMachineModelsForCategory(category, selectedTypeId = null) {
    const modelSelect = document.getElementById('machine-model-select');
    const mfgInput = document.getElementById('machine-manufacturer-input');
    const typeIdInput = document.getElementById('machine-type-id');
    if (!modelSelect) return;

    if (!category) {
        modelSelect.innerHTML = '<option value="">-- 先に機種を選択してください --</option>';
        if (mfgInput) mfgInput.value = '';
        if (typeIdInput) typeIdInput.value = '';
        return;
    }

    const normalizeCat = (cat) => String(cat || 'その他').replace('軌道モータカー', '軌道モーターカー').trim();
    const filteredTypes = allMachineTypesCache.filter(mt => normalizeCat(mt.category) === category);

    let options = ['<option value="">-- 型式を選択 --</option>'];
    filteredTypes.forEach(mt => {
        const isSelected = selectedTypeId && String(mt.id) === String(selectedTypeId);
        const label = [mt.manufacturer, mt.model_name].filter(Boolean).join(' ') || mt.model_name || '型式不明';
        options.push(`<option value="${mt.id}"${isSelected ? ' selected' : ''}>${escapeHtml(label)}</option>`);
    });

    modelSelect.innerHTML = options.join('');

    if (selectedTypeId) {
        const found = allMachineTypesCache.find(mt => String(mt.id) === String(selectedTypeId));
        if (found) {
            modelSelect.value = String(selectedTypeId);
            if (mfgInput) mfgInput.value = found.manufacturer || '';
            if (typeIdInput) typeIdInput.value = String(selectedTypeId);
        }
    }
}

async function openMachineModal(machineId = null) {
    console.log('[openMachineModal] ===== START =====, machineId:', machineId);
    const modal = document.getElementById('machine-modal');
    const modalTitle = document.getElementById('machine-modal-title');
    const form = document.getElementById('machine-form');
    if (!modal) {
        console.error('[openMachineModal] Modal element not found!');
        alert('エラー: モーダルが見つかりません');
        return;
    }

    form.reset();
    document.getElementById('machine-id').value = '';
    const typeIdHidden = document.getElementById('machine-type-id');
    if (typeIdHidden) typeIdHidden.value = '';
    const mfgInput = document.getElementById('machine-manufacturer-input');
    if (mfgInput) mfgInput.value = '';

    initMachineModalControls();

    // モーダルを表示
    modal.style.display = 'flex';

    // 機種・型式リストおよび事業所リストを取得
    try {
        const [typesRes, officesRes] = await Promise.all([
            tenantFetch('/api/machine-types', { headers: { 'Authorization': `Bearer ${token}` } }),
            tenantFetch('/api/offices', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (typesRes.ok) {
            const typesData = await typesRes.json();
            allMachineTypesCache = unwrapApiArray(typesData);
        }

        if (officesRes.ok) {
            const officesData = await officesRes.json();
            allOfficesCache = unwrapApiArray(officesData);
            const officeSelect = document.getElementById('machine-office-select');
            if (officeSelect) {
                const options = ['<option value="">-- 事業所を選択 --</option>'];
                allOfficesCache.forEach(office => {
                    const oId = office.office_id || office.id;
                    const oName = office.office_name || office.name || '名前なし';
                    options.push(`<option value="${oId}">${escapeHtml(oName)}</option>`);
                });
                officeSelect.innerHTML = options.join('');
            }
        }
    } catch (error) {
        console.error('[openMachineModal] Error fetching options:', error);
        showToast('マスタデータの取得に失敗しました: ' + error.message, 'error');
    }

    if (machineId) {
        modalTitle.textContent = '保守用車を編集';
        await loadMachineData(machineId);
    } else {
        modalTitle.textContent = '保守用車を追加';
        populateMachineCategories('');
        populateMachineModelsForCategory('');
    }

    initAutoExpandTextareas();
    console.log('[openMachineModal] ===== END =====');
}

async function loadMachineData(machineId) {
    try {
        console.log('[loadMachineData] Loading machine:', machineId);
        const response = await tenantFetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const machines = unwrapApiArray(data);
            const machine = machines.find(m => {
                const mId = m.machine_id || m.id;
                return String(mId) === String(machineId);
            });
            console.log('[loadMachineData] Found machine:', machine);
            if (machine) {
                document.getElementById('machine-id').value = machine.machine_id || machine.id || '';
                document.getElementById('machine-office-select').value = machine.office_id || '';
                document.getElementById('machine-number').value = machine.machine_number || '';
                document.getElementById('machine-type-certification').value = machine.type_certification || '';
                document.getElementById('machine-manufacture-date').value = machine.manufacture_date ? machine.manufacture_date.split('T')[0] : '';
                document.getElementById('machine-certification-date').value = machine.model_certification_date ? machine.model_certification_date.split('T')[0] : '';
                const purchaseDateInput = document.getElementById('machine-purchase-date');
                if (purchaseDateInput) {
                    purchaseDateInput.value = machine.purchase_date ? machine.purchase_date.split('T')[0] : '';
                }
                const notesArea = document.getElementById('machine-notes');
                if (notesArea) {
                    notesArea.value = machine.notes || '';
                }

                // 機種・型式・メーカーの連動復元
                const targetTypeId = machine.machine_type_id;
                const foundType = allMachineTypesCache.find(mt => String(mt.id) === String(targetTypeId));
                if (foundType) {
                    const normCat = String(foundType.category || 'その他').replace('軌道モータカー', '軌道モーターカー').trim();
                    populateMachineCategories(normCat);
                    populateMachineModelsForCategory(normCat, targetTypeId);
                } else {
                    populateMachineCategories('');
                    populateMachineModelsForCategory('');
                }
            } else {
                console.error('[loadMachineData] Machine not found:', machineId);
                showToast('保守用車が見つかりません', 'error');
            }
        }
    } catch (error) {
        console.error('Failed to load machine data:', error);
        showToast('保守用車情報の読み込みに失敗しました', 'error');
    }
}

async function saveMachine() {
    const machineId = document.getElementById('machine-id').value;
    const machineTypeId = document.getElementById('machine-type-id')?.value || document.getElementById('machine-model-select')?.value;
    const officeId = document.getElementById('machine-office-select')?.value;

    if (!officeId) {
        showToast('管理事業所を選択してください', 'error');
        return;
    }
    if (!machineTypeId) {
        showToast('機種および型式を選択してください', 'error');
        return;
    }

    const machineData = {
        office_id: officeId,
        machine_type_id: machineTypeId,
        machine_number: document.getElementById('machine-number').value,
        type_certification: document.getElementById('machine-type-certification').value,
        manufacture_date: document.getElementById('machine-manufacture-date').value || null,
        model_certification_date: document.getElementById('machine-certification-date').value || null,
        purchase_date: document.getElementById('machine-purchase-date')?.value || null,
        notes: document.getElementById('machine-notes')?.value || ''
    };

    try {
        const url = machineId ? `/api/machines/${machineId}` : '/api/machines';
        const method = machineId ? 'PUT' : 'POST';

        const response = await tenantFetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(machineData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(machineId ? '保守用車を更新しました' : '保守用車を追加しました', 'success');
            document.getElementById('machine-modal').style.display = 'none';
            loadMachines();
        } else {
            const errorMsg = data.detail ? `${data.message}\n詳細: ${data.detail}` : (data.message || '保存に失敗しました');
            alert('🚨 サーバーエラーが発生しました:\n' + errorMsg);
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save machine:', error);
        alert('リクエスト全体が失敗しました:\n' + error.message);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

function editMachine(machineId) {
    console.log('[editMachine] Called with ID:', machineId);
    try {
        openMachineModal(machineId);
    } catch (error) {
        console.error('[editMachine] Error:', error);
        alert('編集モーダルを開く際にエラーが発生しました: ' + error.message);
    }
}

window.editMachine = editMachine;
console.log('[Global] editMachine function registered:', typeof window.editMachine);

async function deleteMachine(machineId, machineNumber) {
    console.log('[deleteMachine] Called with ID:', machineId);
    if (!confirm(`保守用車「${machineNumber}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const response = await tenantFetch(`/api/machines/${machineId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('保守用車を削除しました', 'success');
            loadMachines();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete machine:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

window.deleteMachine = deleteMachine;

// ========== 検修マスタ管理 ==========
let currentInspectionTypeEditing = null;

async function loadInspectionTypes() {
    const list = document.getElementById('inspection-types-list');
    if (!list) {
        console.warn('[loadInspectionTypes] inspection-types-list element not found');
        return;
    }

    list.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const response = await tenantFetch('/api/inspection-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const inspectionTypes = unwrapApiArray(data);
        console.log('[loadInspectionTypes] Response:', data);

        if (data.success && inspectionTypes.length > 0) {
            // 自動ソート: 業務優先順位（機種優先度 ➔ 型式 ➔ 検修種別名）
            const categoryPriority = ['軌道モーターカー', '軌道モータカー', '箱トロ', '鉄トロ', 'ホッパー車', 'レールカッター', '油圧ショベル', 'クレーン', 'その他'];
            inspectionTypes.sort((a, b) => {
                const catA = String(a.machine_category || '').replace('軌道モータカー', '軌道モーターカー');
                const catB = String(b.machine_category || '').replace('軌道モータカー', '軌道モーターカー');
                const pA = categoryPriority.indexOf(catA) !== -1 ? categoryPriority.indexOf(catA) : 999;
                const pB = categoryPriority.indexOf(catB) !== -1 ? categoryPriority.indexOf(catB) : 999;
                if (pA !== pB) return pA - pB;
                const modelA = String(a.machine_type_name || '');
                const modelB = String(b.machine_type_name || '');
                if (modelA !== modelB) return modelA.localeCompare(modelB, 'ja');
                const nameA = String(a.type_name || '');
                const nameB = String(b.type_name || '');
                return nameA.localeCompare(nameB, 'ja');
            });

            let html = `
                <table class="data-table" id="inspection-types-table">
                    <thead>
                        <tr>
                            <th>機種</th>
                            <th>型式</th>
                            <th>検修種別コード</th>
                            <th>検修種別名</th>
                            <th>検修周期</th>
                            <th>検修期間</th>
                            <th>説明</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            inspectionTypes.forEach(type => {
                const categoryLabel = type.machine_category
                    ? String(type.machine_category).replace('軌道モータカー', '軌道モーターカー')
                    : '-';
                const modelLabel = [type.manufacturer, type.machine_type_name].filter(Boolean).join(' ')
                    || type.machine_type_name
                    || '-';

                html += `
                    <tr>
                        <td><strong>${escapeHtml(categoryLabel)}</strong></td>
                        <td>${escapeHtml(modelLabel)}</td>
                        <td>${escapeHtml(type.type_code || '-')}</td>
                        <td>${escapeHtml(type.type_name || '-')}</td>
                        <td>${type.cycle_months ? `${type.cycle_months}か月` : '-'}</td>
                        <td>${type.duration_days ? `${type.duration_days}日` : '-'}</td>
                        <td>${escapeHtml(type.description || '-')}</td>
                        <td>
                            <button class="btn-sm btn-edit" data-action="edit-inspection-type" data-id="${type.id}">編集</button>
                            <button class="btn-sm btn-delete" data-action="delete-inspection-type" data-id="${type.id}" data-name="${escapeHtml(type.type_name)}">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;
        } else {
            list.innerHTML = '<p class="loading">検修種別が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadInspectionTypes] Error:', error);
        list.innerHTML = `<p class="loading" style="color: red;">⚠️ <br>エラー: ${error.message}</p>`;
    }
}

async function loadInspectionSchedules() {
    // 検修周期・期間設定は検修種別マスタに統合されたため不要
}

let allInspectionMachineTypes = [];

async function initInspectionTypeHierarchy() {
    const categorySelect = document.getElementById('inspection-type-category');
    const modelSelect = document.getElementById('inspection-type-machine-type');
    const codeInput = document.getElementById('inspection-type-code');
    if (!categorySelect || !modelSelect) return;

    categorySelect.innerHTML = '<option value="">-- 機種を選択 --</option>';
    modelSelect.innerHTML = '<option value="">-- 先に機種を選択してください --</option>';
    if (codeInput) codeInput.value = '';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('user_token');
        const res = await tenantFetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        allInspectionMachineTypes = unwrapApiArray(data);

        const normalizeCategory = (cat) => String(cat || '').replace('軌道モータカー', '軌道モーターカー').trim();
        const categoryMap = new Map();

        allInspectionMachineTypes.forEach(mt => {
            const rawCat = mt.category || 'その他';
            const displayCat = normalizeCategory(rawCat);
            if (!categoryMap.has(displayCat)) {
                categoryMap.set(displayCat, []);
            }
            categoryMap.get(displayCat).push(mt);
        });

        const preferredOrder = ['軌道モーターカー', '鉄トロ', '箱トロ', 'ホッパー車'];
        const sortedDisplayCats = Array.from(categoryMap.keys()).sort((a, b) => {
            const indexA = preferredOrder.indexOf(a);
            const indexB = preferredOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b, 'ja');
        });

        sortedDisplayCats.forEach(displayCat => {
            const opt = document.createElement('option');
            opt.value = displayCat;
            opt.textContent = displayCat;
            categorySelect.appendChild(opt);
        });

        categorySelect.onchange = () => {
            onInspectionCategoryChange(categorySelect.value);
        };

        modelSelect.onchange = () => {
            loadInspectionTypeCodePreview(modelSelect.value);
        };
    } catch (err) {
        console.error('[initInspectionTypeHierarchy] Error:', err);
    }
}

function onInspectionCategoryChange(selectedCategory, selectedModelId = null) {
    const modelSelect = document.getElementById('inspection-type-machine-type');
    const codeInput = document.getElementById('inspection-type-code');
    if (!modelSelect) return;

    if (!selectedCategory) {
        modelSelect.innerHTML = '<option value="">-- 先に機種を選択してください --</option>';
        if (codeInput) codeInput.value = '';
        return;
    }

    const normalizeCategory = (cat) => String(cat || '').replace('軌道モータカー', '軌道モーターカー').trim();
    const filteredModels = allInspectionMachineTypes.filter(mt => {
        return normalizeCategory(mt.category || 'その他') === selectedCategory;
    });

    modelSelect.innerHTML = '<option value="">-- 型式を選択 --</option>';
    filteredModels.forEach(mt => {
        const opt = document.createElement('option');
        opt.value = mt.id;
        const modelName = mt.model_name || mt.machine_type_name || mt.type_name || '-';
        const manufacturer = mt.manufacturer ? `${mt.manufacturer} ` : '';
        opt.textContent = [manufacturer, modelName].filter(Boolean).join('') || modelName;
        modelSelect.appendChild(opt);
    });

    if (selectedModelId) {
        modelSelect.value = selectedModelId;
        loadInspectionTypeCodePreview(selectedModelId);
    } else if (filteredModels.length === 1) {
        modelSelect.value = filteredModels[0].id;
        loadInspectionTypeCodePreview(filteredModels[0].id);
    } else {
        if (codeInput) codeInput.value = '';
    }
}

// 検修種別の編集・削除
function editInspectionType(id) {
    console.log('[editInspectionType] Opening modal for ID:', id);
    openInspectionTypeModal(id);
}

async function openInspectionTypeModal(id = null) {
    const modal = document.getElementById('inspection-type-modal');
    const modalTitle = document.getElementById('inspection-type-modal-title');
    const form = document.getElementById('inspection-type-form');

    form.reset();
    document.getElementById('inspection-type-id').value = '';
    const codeInput = document.getElementById('inspection-type-code');
    if (codeInput) codeInput.value = '';

    currentInspectionTypeEditing = null;
    await initInspectionTypeHierarchy();

    if (id) {
        modalTitle.textContent = '検修種別を編集';
        await loadInspectionTypeData(id);
    } else {
        modalTitle.textContent = '検修種別を追加';
    }

    modal.style.display = 'flex';
    initAutoExpandTextareas();
}

async function loadInspectionTypeData(id) {
    try {
        const response = await tenantFetch(`/api/inspection-types/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        console.log('[loadInspectionTypeData] Response:', data);

        if (data.success) {
            const type = data.data || data;
            currentInspectionTypeEditing = type;
            console.log('[loadInspectionTypeData] Type object:', type);

            document.getElementById('inspection-type-id').value = type.id;

            const normalizeCategory = (cat) => String(cat || '').replace('軌道モータカー', '軌道モーターカー').trim();
            const matchingMt = allInspectionMachineTypes.find(mt => String(mt.id) === String(type.machine_type_id));
            const categorySelect = document.getElementById('inspection-type-category');
            if (categorySelect && matchingMt) {
                const displayCat = normalizeCategory(matchingMt.category || 'その他');
                categorySelect.value = displayCat;
                onInspectionCategoryChange(displayCat, type.machine_type_id);
            } else {
                onInspectionCategoryChange(categorySelect ? categorySelect.value : '', type.machine_type_id);
            }

            const codeInput = document.getElementById('inspection-type-code');
            if (codeInput) codeInput.value = type.type_code || '';
            document.getElementById('inspection-type-name').value = type.type_name || '';
            document.getElementById('inspection-type-cycle').value = type.cycle_months || '';
            document.getElementById('inspection-type-duration').value = type.duration_days || '';
            const descArea = document.getElementById('inspection-type-description');
            if (descArea) descArea.value = type.description || '';

            const orderInput = document.getElementById('inspection-type-order');
            if (orderInput) orderInput.value = type.display_order || 0;
            const activeCheckbox = document.getElementById('inspection-type-active');
            if (activeCheckbox) activeCheckbox.checked = type.is_active !== false;

            initAutoExpandTextareas();
        }
    } catch (error) {
        console.error('Failed to load inspection type data:', error);
        showToast('検修種別情報の読み込みに失敗しました', 'error');
    }
}

async function deleteInspectionType(id, name) {
    if (!confirm(`検修種別「${name}」を削除します。よろしいですか？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('user_token');
        const response = await tenantFetch(`/api/inspection-types/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(data.message || '検修種別を削除しました', 'success');
            loadInspectionTypes();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete inspection type:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

// 検修設定の編集・削除
function editInspectionSchedule(id) {
    console.log('[editInspectionSchedule] Opening modal for ID:', id);
    openInspectionScheduleModal(id);
}

async function openInspectionScheduleModal(id = null) {
    const modal = document.getElementById('inspection-schedule-modal');
    const modalTitle = document.getElementById('inspection-schedule-modal-title');
    const form = document.getElementById('inspection-schedule-form');

    form.reset();
    document.getElementById('inspection-schedule-id').value = '';
    clearInspectionScheduleValues();

    await loadMachineTypeSelectOptions('inspection-schedule-machine-type');

    if (id) {
        modalTitle.textContent = '検修設定を編集';
        await loadInspectionScheduleData(id);
    } else {
        modalTitle.textContent = '検修設定を追加';
        const activeCheck = document.getElementById('inspection-schedule-active');
        if (activeCheck) activeCheck.checked = true;
    }

    modal.style.display = 'flex';
}

async function loadInspectionScheduleData(id) {
    try {
        const response = await tenantFetch(`/api/inspection-schedules/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        console.log('[loadInspectionScheduleData] Response:', data);

        if (data.success) {
            const schedule = data.data || data;
            console.log('[loadInspectionScheduleData] Schedule object:', schedule);

            document.getElementById('inspection-schedule-id').value = schedule.id;

            const machineTypeSelect = document.getElementById('inspection-schedule-machine-type');
            if (machineTypeSelect) machineTypeSelect.value = schedule.machine_type_id || '';

            document.getElementById('inspection-schedule-cycle').value = schedule.cycle_months || '';
            document.getElementById('inspection-schedule-duration').value = schedule.duration_days || '';
            const activeCheck = document.getElementById('inspection-schedule-active');
            if (activeCheck) activeCheck.checked = schedule.is_active !== false;

            console.log('[loadInspectionScheduleData] Set values:', {
                machineType: machineTypeSelect ? machineTypeSelect.value : '',
                cycle: schedule.cycle_months,
                duration: schedule.duration_days
            });
        }
    } catch (error) {
        console.error('Failed to load inspection schedule data:', error);
        showToast('検修設定情報の読み込みに失敗しました', 'error');
    }
}

async function deleteInspectionSchedule(id, targetName) {
    if (!confirm(`${targetName}の検修設定を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const response = await tenantFetch(`/api/inspection-schedules/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('検修設定を削除しました', 'success');
            loadInspectionSchedules();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete inspection schedule:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

// 検修種別の保存
async function saveInspectionType() {
    const id = document.getElementById('inspection-type-id').value;
    const category = document.getElementById('inspection-type-category')?.value;
    const machineTypeId = normalizeOptionalId(document.getElementById('inspection-type-machine-type')?.value);
    const typeName = (document.getElementById('inspection-type-name')?.value || '').trim();
    const cycleMonths = document.getElementById('inspection-type-cycle')?.value;
    const durationDays = document.getElementById('inspection-type-duration')?.value;
    const description = document.getElementById('inspection-type-description')?.value || '';

    // 表示順序・有効チェックボックスは画面から削除されたため、編集時は既存値、新規時はデフォルト値
    const displayOrderInput = document.getElementById('inspection-type-order');
    const activeCheckbox = document.getElementById('inspection-type-active');
    const displayOrder = displayOrderInput ? parseInt(displayOrderInput.value, 10) : (currentInspectionTypeEditing?.display_order ?? 0);
    const isActive = activeCheckbox ? activeCheckbox.checked : (currentInspectionTypeEditing?.is_active ?? true);

    if (!category) {
        showToast('機種を選択してください', 'error');
        return;
    }
    if (!machineTypeId) {
        showToast('型式を選択してください', 'error');
        return;
    }
    if (!typeName) {
        showToast('検修種別名を入力してください', 'error');
        return;
    }
    const cycleNum = parseInt(cycleMonths, 10);
    const durationNum = parseInt(durationDays, 10);
    if (!cycleNum || cycleNum < 1) {
        showToast('有効な検修周期（月単位）を入力してください', 'error');
        return;
    }
    if (!durationNum || durationNum < 1) {
        showToast('有効な検修期間（日数）を入力してください', 'error');
        return;
    }

    const typeData = {
        machine_type_id: machineTypeId,
        cycle_months: cycleNum,
        duration_days: durationNum,
        type_name: typeName,
        description: description,
        display_order: parseInt(displayOrder, 10) || 0,
        is_active: isActive
    };

    try {
        const url = id ? `/api/inspection-types/${id}` : '/api/inspection-types';
        const method = id ? 'PUT' : 'POST';
        const token = localStorage.getItem('token') || localStorage.getItem('user_token');

        const response = await tenantFetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(typeData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(id ? '検修種別を更新しました' : '検修種別を追加しました', 'success');
            document.getElementById('inspection-type-modal').style.display = 'none';
            loadInspectionTypes();
        } else {
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save inspection type:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

// 検修設定の保存
async function saveInspectionSchedule() {
    const id = document.getElementById('inspection-schedule-id').value;
    const machineTypeId = normalizeOptionalId(document.getElementById('inspection-schedule-machine-type').value);
    const cycleMonths = document.getElementById('inspection-schedule-cycle').value;
    const durationDays = document.getElementById('inspection-schedule-duration').value;
    const isActive = document.getElementById('inspection-schedule-active').checked;

    if (!machineTypeId) {
        showToast('機種を選択してください', 'error');
        return;
    }
    const cycleNum = parseInt(cycleMonths, 10);
    const durationNum = parseInt(durationDays, 10);
    if (!cycleNum || cycleNum < 1) {
        showToast('有効な検修周期（月単位）を入力してください', 'error');
        return;
    }
    if (!durationNum || durationNum < 1) {
        showToast('有効な検修期間（日数）を入力してください', 'error');
        return;
    }

    const scheduleData = {
        machine_type_id: machineTypeId,
        cycle_months: cycleNum,
        duration_days: durationNum,
        is_active: isActive
    };

    try {
        const url = id ? `/api/inspection-schedules/${id}` : '/api/inspection-schedules';
        const method = id ? 'PUT' : 'POST';

        const response = await tenantFetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(scheduleData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(id ? '検修設定を更新しました' : '検修設定を追加しました', 'success');
            document.getElementById('inspection-schedule-modal').style.display = 'none';
            loadInspectionSchedules();
        } else {
            const errorMsg = data.detail ? `${getApiMessage(data, '保存に失敗しました')}\n詳細: ${data.detail}` : getApiMessage(data, '保存に失敗しました');
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Failed to save inspection schedule:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

function clearInspectionScheduleValues() {
    const cycleInput = document.getElementById('inspection-schedule-cycle');
    const durationInput = document.getElementById('inspection-schedule-duration');
    if (cycleInput) {
        cycleInput.value = '';
        cycleInput.readOnly = false;
    }
    if (durationInput) {
        durationInput.value = '';
        durationInput.readOnly = false;
    }
}

function setInspectionScheduleDefaults(preserveEmptySelection = false) {
    if (!preserveEmptySelection) {
        clearInspectionScheduleValues();
    }
}

// ヘルパー関数
async function loadMachineTypeSelectOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- 機種を選択 --</option>';

    try {
        const response = await tenantFetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || `機種一覧の取得に失敗しました (HTTP ${response.status})`);
        }
        const machineTypes = unwrapApiArray(data);

        if (machineTypes.length === 0) {
            select.options[0].textContent = '機種が登録されていません';
            return;
        }

        machineTypes.forEach(machineType => {
            const option = document.createElement('option');
            option.value = machineType.id;
            const manufacturer = machineType.manufacturer || '';
            const modelName = machineType.model_name || machineType.machine_type_name || machineType.type_name || '';
            option.textContent = [manufacturer, modelName].filter(Boolean).join(' ') || modelName || machineType.display_code || '-';
            option.dataset.category = String(machineType.category || '')
                .replace('軌道モーターカー', '軌道モータカー');
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load machine type options:', error);
        select.innerHTML = '<option value="">機種一覧を読み込めませんでした</option>';
        showToast('機種一覧の読み込みに失敗しました', 'error');
    }
}

async function loadInspectionTypeSelectOptions(selectId, machineTypeId = null, selectedTypeId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">${machineTypeId ? '-- 検修種別を選択 --' : '-- 先に機種を選択 --'}</option>`;
    if (!machineTypeId) return;

    try {
        const response = await tenantFetch(`/api/inspection-types?machine_type_id=${encodeURIComponent(machineTypeId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || `検修種別一覧の取得に失敗しました (HTTP ${response.status})`);
        }
        const types = unwrapApiArray(data);

        if (types.length === 0 && !selectedTypeId) {
            select.options[0].textContent = '検修種別が登録されていません';
            return;
        }

        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = [type.type_code, type.type_name].filter(Boolean).join(' - ') || '-';
            option.dataset.cycleMonths = type.cycle_months ?? '';
            option.dataset.durationDays = type.duration_days ?? '';
            select.appendChild(option);
        });
        if (selectedTypeId && !types.some(type => String(type.id) === String(selectedTypeId))) {
            const legacyType = document.createElement('option');
            legacyType.value = selectedTypeId;
            legacyType.textContent = '既存の検修種別';
            select.appendChild(legacyType);
        }
        if (selectedTypeId) select.value = selectedTypeId;
    } catch (error) {
        console.error('Failed to load inspection type options:', error);
        select.innerHTML = '<option value="">検修種別一覧を読み込めませんでした</option>';
        showToast('検修種別一覧の読み込みに失敗しました', 'error');
    }
}

// グローバルに公開
window.editInspectionType = editInspectionType;
window.deleteInspectionType = deleteInspectionType;
window.editInspectionSchedule = editInspectionSchedule;
window.deleteInspectionSchedule = deleteInspectionSchedule;
window.openInspectionTypeModal = openInspectionTypeModal;
window.openInspectionScheduleModal = openInspectionScheduleModal;

// ========== 事業所マスタ ==========
async function loadOffices() {
    const officesList = document.getElementById('offices-list');
    officesList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        console.log('[loadOffices] Fetching offices...');
        const response = await tenantFetch('/api/offices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[loadOffices] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadOffices] Data received:', data);

        if (data.success && data.offices.length > 0) {
            officesList.innerHTML = data.offices.map(office => `
                <div class="vehicle-item">
                    <div class="vehicle-info">
                        <div class="vehicle-type">🏢 ${escapeHtml(office.office_name)}</div>
                        <div class="vehicle-number">コード ${escapeHtml(office.office_code)} | ${escapeHtml(office.office_type || '-')}</div>
                        <div class="vehicle-number" style="font-size: 12px; color: #666;">
                            ${escapeHtml(office.address || '-')} | 責任者 ${escapeHtml(office.manager_name || '-')}
                        </div>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" data-action="edit-office" data-id="${office.office_id}">✏️ 編集</button>
                        <button class="btn-delete" data-action="delete-office" data-id="${office.office_id}" data-name="${escapeHtml(office.office_name)}">🗑️ 削除</button>
                    </div>
                </div>
            `).join('');
        } else {
            officesList.innerHTML = '<p class="loading">事業所が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadOffices] 者rror:', error);
        officesList.innerHTML = `<p class="loading" style="color: red;">⚠️ <br>エラー: ${error.message}<br>データベース接続を確認してください</p>`;
    }
}

function showOfficeModal(mode, officeId) {
    const offices = [];
    if (mode === 'edit') {
        // 既存データを取得
        tenantFetch(`/api/offices`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('user_token')}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const office = data.offices.find(o => String(o.office_id) === String(officeId));
                    createOfficeModal(mode, office);
                }
            });
    } else {
        createOfficeModal(mode, null);
    }
}

function createOfficeModal(mode, office) {
    const modalHtml = `
        <div id="office-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${mode === 'add' ? '新規事業所追加' : '事業所編集'}</h2>
                    <button class="modal-close" onclick="closeOfficeModal()">&times;</button>
                </div>
                <form id="office-form" class="modal-form">
                    <div class="form-group">
                        <label for="office_code">事業所コード</label>
                        <input type="text" id="office_code" name="office_code" value="${office ? escapeHtml(office.office_code) : ''}" ${mode === 'edit' ? 'readonly' : ''} placeholder="空欄の場合は自動採番されます">
                        ${mode === 'add' ? '<small>空欄の場合は自動的に採番されます</small>' : ''}
                    </div>
                    <div class="form-group">
                        <label for="office_name">事業所名 *</label>
                        <input type="text" id="office_name" name="office_name" value="${office ? escapeHtml(office.office_name) : ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="office_type">事業所区分</label>
                        <select id="office_type" name="office_type">
                            <option value="">-- 選択 --</option>
                            <option value="本社" ${office && office.office_type === '本社' ? 'selected' : ''}>本社</option>
                            <option value="支社" ${office && office.office_type === '支社' ? 'selected' : ''}>支社</option>
                            <option value="営業所" ${office && office.office_type === '営業所' ? 'selected' : ''}>営業所</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="address">住所</label>
                        <input type="text" id="address" name="address" value="${office ? escapeHtml(office.address || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="postal_code">郵便番号</label>
                        <input type="text" id="postal_code" name="postal_code" value="${office ? escapeHtml(office.postal_code || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="phone_number">電話番号</label>
                        <input type="text" id="phone_number" name="phone_number" value="${office ? escapeHtml(office.phone_number || '') : ''}">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeOfficeModal()">キャンセル</button>
                        <button type="submit" class="btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('office-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveOffice(mode, office ? office.office_id : null);
    });
}

async function saveOffice(mode, officeId) {
    const formData = new FormData(document.getElementById('office-form'));
    const data = Object.fromEntries(formData.entries());

    try {
        const url = mode === 'add' ? '/api/offices' : `/api/offices/${officeId}`;
        const method = mode === 'add' ? 'POST' : 'PUT';

        const response = await tenantFetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showToast(mode === 'add' ? '事業所を追加しました' : '事業所を更新しました', 'success');
            closeOfficeModal();
            loadOffices();
        } else {
            showToast(result.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Save office error:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

window.editOffice = function (officeId) {
    showOfficeModal('edit', officeId);
}

window.deleteOffice = async function (officeId, officeName) {
    if (!confirm(`事業所「${officeName}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const response = await tenantFetch(`/api/offices/${officeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('事業所を削除しました', 'success');
            loadOffices();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete office:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

window.closeOfficeModal = function () {
    const modal = document.getElementById('office-modal');
    if (modal) modal.remove();
}

// ========== 保守基地マスタ ==========
async function loadBases() {
    const basesList = document.getElementById('bases-list');
    basesList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        console.log('[loadBases] Fetching bases...');
        const response = await tenantFetch('/api/bases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[loadBases] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadBases] Data received:', data);

        if (data.success && data.bases.length > 0) {
            basesList.innerHTML = data.bases.map(base => `
                <div class="vehicle-item">
                    <div class="vehicle-info">
                        <div class="vehicle-type">🏗️ ${escapeHtml(base.base_name)}</div>
                        <div class="vehicle-number">コード ${escapeHtml(base.base_code)} | 事業所: ${escapeHtml(base.office_name || '-')}</div>
                        <div class="vehicle-number" style="font-size: 12px; color: #666;">
                            ${escapeHtml(base.location || '-')} | 収容数: ${base.capacity || '-'} | 責任者 ${escapeHtml(base.manager_name || '-')}
                        </div>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" data-action="edit-base" data-id="${base.base_id}">✏️ 編集</button>
                        <button class="btn-delete" data-action="delete-base" data-id="${base.base_id}" data-name="${escapeHtml(base.base_name)}">🗑️ 削除</button>
                    </div>
                </div>
            `).join('');
        } else {
            basesList.innerHTML = '<p class="loading">保守基地が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadBases] 者rror:', error);
        basesList.innerHTML = `<p class="loading" style="color: red;">⚠️ <br>エラー: ${error.message}<br>データベース接続を確認してください</p>`;
    }
}

async function showBaseModal(mode, baseId) {
    // 事業所リストを取征者
    const officesRes = await tenantFetch('/api/offices', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const officesData = await officesRes.json();
    const offices = officesData.success ? unwrapApiArray(officesData) : [];

    if (mode === 'edit') {
        const basesRes = await tenantFetch('/api/bases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const basesData = await basesRes.json();
        if (basesData.success) {
            const base = basesData.bases.find(b => String(b.base_id) === String(baseId));
            createBaseModal(mode, base, offices);
        }
    } else {
        createBaseModal(mode, null, offices);
    }
}

function createBaseModal(mode, base, offices) {
    const officeOptions = offices.map(o =>
        `<option value="${o.office_id}" ${base && base.office_id === o.office_id ? 'selected' : ''}>${escapeHtml(o.office_name)}</option>`
    ).join('');

    const modalHtml = `
        <div id="base-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${mode === 'add' ? '新規保守基地追加' : '保守基地編集'}</h2>
                    <button class="modal-close" onclick="closeBaseModal()">&times;</button>
                </div>
                <form id="base-form" class="modal-form">
                    <div class="form-group">
                        <label for="base_code">基地コード</label>
                        <input type="text" id="base_code" name="base_code" value="${base ? escapeHtml(base.base_code) : ''}" ${mode === 'edit' ? 'readonly' : ''} placeholder="空欄の場合は自動採番されます">
                        ${mode === 'add' ? '<small>空欄の場合は自動的に採番されます</small>' : ''}
                    </div>
                    <div class="form-group">
                        <label for="base_name">基地名 *</label>
                        <input type="text" id="base_name" name="base_name" value="${base ? escapeHtml(base.base_name) : ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="office_id">所属事業所</label>
                        <select id="office_id" name="office_id">
                            <option value="">-- 選択 --</option>
                            ${officeOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="location">所在地</label>
                        <input type="text" id="location" name="location" value="${base ? escapeHtml(base.location || '') : ''}">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeBaseModal()">キャンセル</button>
                        <button type="submit" class="btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('base-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBase(mode, base ? base.base_id : null);
    });
}

async function saveBase(mode, baseId) {
    const formData = new FormData(document.getElementById('base-form'));
    const data = Object.fromEntries(formData.entries());

    try {
        const url = mode === 'add' ? '/api/bases' : `/api/bases/${baseId}`;
        const method = mode === 'add' ? 'POST' : 'PUT';

        const response = await tenantFetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showToast(mode === 'add' ? '保守基地を追加しました' : '保守基地を更新しました', 'success');
            closeBaseModal();
            loadBases();
        } else {
            showToast(result.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Save base error:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

window.editBase = function (baseId) {
    showBaseModal('edit', baseId);
}

window.deleteBase = async function (baseId, baseName) {
    if (!confirm(`保守基地「${baseName}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const response = await tenantFetch(`/api/bases/${baseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('保守基地を削除しました', 'success');
            loadBases();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete base:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

window.closeBaseModal = function () {
    const modal = document.getElementById('base-modal');
    if (modal) modal.remove();
}

function getStatusLabel(status) {
    const labels = {
        'active': '稼働中',
        'maintenance': '整備中',
        'inactive': '停止中'
    };
    return labels[status] || status;
}

// ========== マスタデ�者タのインポ�者ト�者デ��プレート�者通機�者 ==========

// ========================================
// 登録デバイス管理 UI ロジック (マルチテナント・証明書検証・ページング)
// ========================================

let currentDevicePage = 1;
let currentDeviceLimit = 20;
let currentDeviceSearch = '';
let currentDeviceStatus = 'all';
let currentTenantDisplayName = '';
let selectedDeviceTenantId = '';
let canSwitchDeviceTenant = false;
let availableDeviceTenants = [];
let verifiedCreateCertPem = '';
let verifiedRotateCertPem = '';
let currentDetailDevice = null;
let devSearchTimer = null;

/**
 * デバイス管理イベントリスナー初期化
 */

/**
 * システム操作（メンテナンス・ガバナンス・ログ）イベントリスナー初期化
 */
function initializeSystemOperations() {
    console.log('[System Operations] Initializing event listeners...');

    // 一時ファイル事前確認
    const previewTempBtn = document.getElementById('btn-preview-tmp');
    if (previewTempBtn) {
        previewTempBtn.addEventListener('click', handlePreviewTempFiles);
    }

    // 一時ファイル削除
    const cleanTempBtn = document.getElementById('btn-clean-tmp');
    if (cleanTempBtn) {
        cleanTempBtn.addEventListener('click', handleCleanTempFiles);
    }

    // ログバックアップ情報
    const backupLogBtn = document.getElementById('btn-backup-log');
    if (backupLogBtn) {
        backupLogBtn.addEventListener('click', handleBackupLogs);
    }

    // 孤立画像検出 (Dry Run専用)
    const cleanImagesBtn = document.getElementById('btn-clean-images');
    if (cleanImagesBtn) {
        cleanImagesBtn.addEventListener('click', handleCleanOrphanedImages);
    }

    // モジュール稼働情報確認
    const checkModuleBtn = document.getElementById('btn-check-module-version');
    if (checkModuleBtn) {
        checkModuleBtn.addEventListener('click', () => loadNpmAudit(getAuthToken()));
    }

    // ストレージ再取得
    const storageDetailBtn = document.getElementById('btn-storage-detail');
    if (storageDetailBtn) {
        storageDetailBtn.addEventListener('click', () => loadStorageUsage(getAuthToken()));
    }
}

function initializeDeviceManagement() {
    // 検索入力 (デバウンス)
    const searchInput = document.getElementById('dev-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(devSearchTimer);
            devSearchTimer = setTimeout(() => {
                currentDeviceSearch = e.target.value.trim();
                currentDevicePage = 1;
                loadRegisteredDevices();
            }, 300);
        });
    }

    // ステータス絞り込み
    const statusFilter = document.getElementById('dev-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentDeviceStatus = e.target.value;
            currentDevicePage = 1;
            loadRegisteredDevices();
        });
    }

    // 表示件数
    const limitSelect = document.getElementById('dev-limit-select');
    if (limitSelect) {
        limitSelect.addEventListener('change', (e) => {
            currentDeviceLimit = Number(e.target.value) || 20;
            currentDevicePage = 1;
            loadRegisteredDevices();
        });
    }

    // 更新ボタン
    const refreshBtn = document.getElementById('btn-refresh-devices');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadRegisteredDevices());
    }

    // ページング
    const prevBtn = document.getElementById('dev-prev-page');
    const nextBtn = document.getElementById('dev-next-page');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentDevicePage > 1) {
                currentDevicePage--;
                loadRegisteredDevices();
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentDevicePage++;
            loadRegisteredDevices();
        });
    }

    // 新規登録モーダル開く
    const openCreateBtn = document.getElementById('btn-open-create-device');
    if (openCreateBtn) {
        openCreateBtn.addEventListener('click', () => {
            openCreateDeviceModal();
        });
    }

    // 新規登録モーダル閉じる
    ['btn-close-create-device-x', 'btn-cancel-create-device'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => closeModal('device-create-modal'));
    });

    // 詳細モーダル閉じる
    ['btn-close-device-detail-x', 'btn-close-device-detail'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => closeModal('device-detail-modal'));
    });

    // 編集モーダル閉じる
    ['btn-close-edit-device-x', 'btn-cancel-edit-device'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => closeModal('device-edit-modal'));
    });

    // 証明書更新モーダル閉じる
    ['btn-close-rotate-cert-x', 'btn-cancel-rotate-cert'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => closeModal('device-cert-rotate-modal'));
    });

    // 停止確認モーダル閉じる
    ['btn-close-disable-device-x', 'btn-cancel-disable-device'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => closeModal('device-disable-modal'));
    });

    // 新規登録: 証明書ファイル選択時
    const createCertFileInput = document.getElementById('dev-create-cert-file');
    if (createCertFileInput) {
        createCertFileInput.addEventListener('change', () => {
            handleCertFileSelect('dev-create-cert-file', 'dev-create-cert-preview', 'btn-submit-create-device', false);
        });
    }

    // 新規登録: 「別ファイルを手動指定」トグル
    const toggleCustomCertBtn = document.getElementById('btn-toggle-custom-cert');
    const customFileWrap = document.getElementById('dev-create-custom-file-wrap');
    if (toggleCustomCertBtn && customFileWrap) {
        toggleCustomCertBtn.addEventListener('click', () => {
            const isHidden = customFileWrap.style.display === 'none';
            customFileWrap.style.display = isHidden ? 'block' : 'none';
            toggleCustomCertBtn.textContent = isHidden ? '固定証明書に戻す' : '別ファイルを手動指定';
            if (!isHidden) {
                const fileInput = document.getElementById('dev-create-cert-file');
                if (fileInput) fileInput.value = '';
                verifiedCreateCertPem = '';
                const previewBox = document.getElementById('dev-create-cert-preview');
                if (previewBox) {
                    previewBox.style.display = 'none';
                    previewBox.innerHTML = '';
                }
            }
        });
    }

    // 新規登録: 所属テナント選択変更時
    const createTenantSelect = document.getElementById('dev-create-tenant-select');
    if (createTenantSelect) {
        createTenantSelect.addEventListener('change', () => {
            updateCreateDeviceTenantInfo();
        });
    }

    // 新規登録フォーム送信
    const createForm = document.getElementById('device-create-form');
    if (createForm) {
        createForm.addEventListener('submit', handleSubmitCreateDevice);
    }

    // 詳細モーダル内: 「編集」ボタン
    const openEditFromDetailBtn = document.getElementById('btn-open-edit-from-detail');
    if (openEditFromDetailBtn) {
        openEditFromDetailBtn.addEventListener('click', () => {
            if (!currentDetailDevice) return;
            closeModal('device-detail-modal');
            openEditDeviceModal(currentDetailDevice.id);
        });
    }

    // 詳細モーダル内: 「証明書更新」ボタン
    const openRotateFromDetailBtn = document.getElementById('btn-open-rotate-from-detail');
    if (openRotateFromDetailBtn) {
        openRotateFromDetailBtn.addEventListener('click', () => {
            if (!currentDetailDevice) return;
            closeModal('device-detail-modal');
            openRotateCertModal(currentDetailDevice.id);
        });
    }

    // 詳細モーダル内: 「端末停止 / 再開」ボタン
    const toggleStatusBtn = document.getElementById('btn-toggle-status-from-detail');
    if (toggleStatusBtn) {
        toggleStatusBtn.addEventListener('click', () => {
            if (!currentDetailDevice) return;
            if (currentDetailDevice.isActive) {
                // 有効 -> 停止確認モーダルへ
                closeModal('device-detail-modal');
                openDisableDeviceModal(currentDetailDevice.id, `${currentDetailDevice.deviceName} (${currentDetailDevice.deviceIdentifier})`);
            } else {
                // 停止中 -> 再有効化
                handleEnableDevice(currentDetailDevice.id, `${currentDetailDevice.deviceName} (${currentDetailDevice.deviceIdentifier})`);
            }
        });
    }

    // 編集フォーム送信
    const editForm = document.getElementById('device-edit-form');
    if (editForm) {
        editForm.addEventListener('submit', handleSubmitEditDevice);
    }

    // 証明書更新: ファイル選択 & 検証
    const rotateCertFileInput = document.getElementById('dev-rotate-cert-file');
    if (rotateCertFileInput) {
        rotateCertFileInput.addEventListener('change', () => {
            handleCertFileSelect('dev-rotate-cert-file', 'dev-rotate-cert-preview', 'btn-submit-rotate-cert', true);
        });
    }
    const verifyRotateCertBtn = document.getElementById('btn-verify-rotate-cert');
    if (verifyRotateCertBtn) {
        verifyRotateCertBtn.addEventListener('click', () => {
            verifySelectedCert('dev-rotate-cert-file', 'dev-rotate-cert-preview', 'btn-submit-rotate-cert', true);
        });
    }

    // 証明書更新フォーム送信
    const rotateForm = document.getElementById('device-cert-rotate-form');
    if (rotateForm) {
        rotateForm.addEventListener('submit', handleSubmitRotateCert);
    }

    // 停止確認フォーム送信
    const disableForm = document.getElementById('device-disable-form');
    if (disableForm) {
        disableForm.addEventListener('submit', handleSubmitDisableDevice);
    }

    // 一覧テーブル内の操作ボタン・行クリック委譲
    const tableBody = document.getElementById('device-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            // ボタンがクリックされた場合
            const targetBtn = e.target.closest('button[data-action]');
            if (targetBtn) {
                const action = targetBtn.getAttribute('data-action');
                const deviceId = targetBtn.getAttribute('data-id');

                if (action === 'detail') {
                    openDeviceDetailModal(deviceId);
                } else if (action === 'edit') {
                    openEditDeviceModal(deviceId);
                }
                return;
            }

            // 行全体がクリックされた場合も詳細を開く
            const targetRow = e.target.closest('tr[data-device-id]');
            if (targetRow) {
                const deviceId = targetRow.getAttribute('data-device-id');
                if (deviceId) {
                    openDeviceDetailModal(deviceId);
                }
            }
        });
    }
}

/**
 * 登録デバイス一覧・サマリー読み込み (サーバーサイド検索・ページング)
 */
async function loadRegisteredDevices(token) {
    const tableBody = document.getElementById('device-table-body');
    const tenantBadge = document.getElementById('device-tenant-badge');
    const selectorWrap = document.getElementById('device-tenant-selector-wrap');
    const tenantSelect = document.getElementById('device-tenant-select');
    const paginationInfo = document.getElementById('dev-pagination-info');
    const currentPageElem = document.getElementById('dev-current-page');
    const totalPagesElem = document.getElementById('dev-total-pages');
    const prevBtn = document.getElementById('dev-prev-page');
    const nextBtn = document.getElementById('dev-next-page');

    try {
        const authToken = token || getAuthToken();
        const queryParams = new URLSearchParams({
            search: currentDeviceSearch,
            status: currentDeviceStatus,
            page: String(currentDevicePage),
            limit: String(currentDeviceLimit)
        });
        if (selectedDeviceTenantId) {
            queryParams.set('tenantId', selectedDeviceTenantId);
        }

        const response = await tenantFetch(`/api/security/devices?${queryParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();

        if (result.success) {
            canSwitchDeviceTenant = Boolean(result.canSwitchTenant);
            availableDeviceTenants = Array.isArray(result.availableTenants) ? result.availableTenants : [];

            // 所属テナント表示
            currentTenantDisplayName = result.tenantDisplayName || 'デモ環境';
            if (tenantBadge) {
                tenantBadge.textContent = `所属: ${currentTenantDisplayName}`;
            }

            // niina専用: テナント切替セレクタの表示・設定
            if (canSwitchDeviceTenant && availableDeviceTenants.length > 0 && selectorWrap && tenantSelect) {
                selectorWrap.style.display = 'inline-flex';
                if (!selectedDeviceTenantId) {
                    selectedDeviceTenantId = result.currentTenantId || result.tenantId;
                }
                tenantSelect.innerHTML = availableDeviceTenants.map(t =>
                    `<option value="${t.tenant_key}" ${t.tenant_key === selectedDeviceTenantId ? 'selected' : ''}>${t.tenant_name} (${t.tenant_key})</option>`
                ).join('');

                if (!tenantSelect.dataset.listenerAttached) {
                    tenantSelect.dataset.listenerAttached = 'true';
                    tenantSelect.addEventListener('change', () => {
                        selectedDeviceTenantId = tenantSelect.value;
                        currentDevicePage = 1;
                        loadRegisteredDevices();
                    });
                }
            } else if (selectorWrap) {
                selectorWrap.style.display = 'none';
            }

            // サマリー更新
            const summary = result.summary || {};
            const setNum = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val ?? 0;
            };
            setNum('dev-summary-total', summary.total);
            setNum('dev-summary-active', summary.active);
            setNum('dev-summary-disabled', summary.disabled);
            setNum('dev-summary-near-expiry', summary.nearExpiry);
            setNum('dev-summary-expired', summary.expired);

            // テーブル描画
            const devices = result.devices || [];
            if (tableBody) {
                if (devices.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="5" style="padding: 32px; text-align: center; color: #64748b;">
                                条件に合致する登録デバイスはありません
                            </td>
                        </tr>
                    `;
                } else {
                    tableBody.innerHTML = devices.map(dev => {
                        let badgeStyle = 'background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';
                        if (dev.status === 'active') {
                            badgeStyle = 'background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';
                        } else if (dev.status === 'near_expiry') {
                            badgeStyle = 'background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';
                        } else if (dev.status === 'expired' || dev.status === 'revoked') {
                            badgeStyle = 'background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';
                        }

                        let expiryText = dev.certificate?.validTo || '-';
                        if (dev.certificate?.daysRemaining !== null) {
                            if (dev.certificate.daysRemaining < 0) {
                                expiryText += ` <span style="color: #dc2626; font-size: 0.72rem;">(期限切れ)</span>`;
                            } else if (dev.certificate.daysRemaining <= 30) {
                                expiryText += ` <span style="color: #b45309; font-size: 0.72rem;">(残${dev.certificate.daysRemaining}日)</span>`;
                            }
                        }

                        return `
                            <tr data-device-id="${escapeHtml(dev.id)}" class="device-table-row" style="border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                                <td style="padding: 10px; font-weight: 500; color: #0f172a;">
                                    ${escapeHtml(dev.deviceName)}
                                </td>
                                <td style="padding: 10px; font-family: monospace; color: #334155;">
                                    ${escapeHtml(dev.deviceIdentifier)}
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    <span style="${badgeStyle}">${dev.statusLabel}</span>
                                </td>
                                <td style="padding: 10px; color: #475569;">
                                    ${expiryText}
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    <button type="button" class="btn-sm-outline" data-action="detail" data-id="${dev.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">詳細</button>
                                    <button type="button" class="btn-sm-outline" data-action="edit" data-id="${dev.id}" style="padding: 3px 8px; font-size: 0.75rem;">編集</button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // ページング更新
            const pag = result.pagination || {};
            if (paginationInfo) {
                const fromCount = pag.totalCount === 0 ? 0 : (pag.page - 1) * pag.limit + 1;
                const toCount = Math.min(pag.page * pag.limit, pag.totalCount);
                paginationInfo.textContent = `全 ${pag.totalCount} 件中 ${fromCount}〜${toCount} 件を表示`;
            }
            if (currentPageElem) currentPageElem.textContent = pag.page || 1;
            if (totalPagesElem) totalPagesElem.textContent = pag.totalPages || 1;
            if (prevBtn) prevBtn.disabled = (pag.page <= 1);
            if (nextBtn) nextBtn.disabled = (pag.page >= pag.totalPages);

        } else {
            console.error('[DeviceManagement] Error response:', result.message);
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #dc2626;">${result.message || 'データ取得エラー'}</td></tr>`;
            }
        }
    } catch (err) {
        console.error('[DeviceManagement] Load error:', err);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #dc2626;">通信エラーが発生しました: ${err.message}</td></tr>`;
        }
    }
}

/**
 * ファイル選択処理 & FileReader でテキスト抽出
 */
function handleCertFileSelect(fileInputId, previewBoxId, submitBtnId, isRotate = false) {
    const input = document.getElementById(fileInputId);
    const submitBtn = document.getElementById(submitBtnId);
    const previewBox = document.getElementById(previewBoxId);

    if (!input || !input.files || input.files.length === 0) {
        return;
    }

    const file = input.files[0];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.p12') || fileName.endsWith('.pfx') || fileName.endsWith('.key')) {
        showPreviewError(previewBoxId, '⚠️ 秘密鍵やPKCS#12形式 (.p12, .pfx, .key) は選択できません。公開証明書 (.cer, .crt, 公開.pem) を指定してください。');
        input.value = '';
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        if (isRotate) {
            verifiedRotateCertPem = content;
            if (previewBox) {
                previewBox.style.display = 'block';
                previewBox.style.background = '#f0f9ff';
                previewBox.style.border = '1px solid #bae6fd';
                previewBox.style.color = '#0369a1';
                previewBox.innerHTML = `📎 新証明書ファイル: <strong>${file.name}</strong> を選択しました。<br><span style="font-size: 0.75rem; color: #64748b;">「新証明書を登録・更新」を押すと更新が保存され、自動で閉じます。</span>`;
            }
            if (submitBtn) submitBtn.disabled = false;
        } else {
            verifiedCreateCertPem = content;
            // 新規登録モーダル: 誤解を生む「合格/完了」バナーは出さず、選択したファイル名のみシンプルに表示
            if (previewBox) {
                previewBox.style.display = 'block';
                previewBox.style.background = '#f0f9ff';
                previewBox.style.border = '1px solid #bae6fd';
                previewBox.style.color = '#0369a1';
                previewBox.innerHTML = `📎 選択中ファイル: <strong>${file.name}</strong> (読み込み完了)<br><span style="font-size: 0.75rem; color: #64748b;">下の「💾 保存して登録する」を押すと、自動で検証・DB保存され、画面が閉じて一覧に反映されます。</span>`;
            }

            // デバイス名や管理番号が未入力なら、テナント名から推測して親切に自動入力
            const nameInput = document.getElementById('dev-create-name');
            const idInput = document.getElementById('dev-create-identifier');
            const tenantSelect = document.getElementById('dev-create-tenant-select');
            const selectedTenant = (canSwitchDeviceTenant && tenantSelect && tenantSelect.value) ? tenantSelect.value : (currentTenant || 'kintetsu');

            const tenantPrefixMap = {
                'daitetsu': { prefix: 'DT', name: '大鉄工業' },
                'kosei': { prefix: 'KS', name: '広成建設' },
                'kintetsu': { prefix: 'KT', name: '近鉄' }
            };
            const tInfo = tenantPrefixMap[selectedTenant] || { prefix: selectedTenant.toUpperCase().slice(0, 3), name: selectedTenant };

            if (idInput && !idInput.value.trim()) {
                const randNum = String(Math.floor(Math.random() * 900) + 100);
                idInput.value = `${tInfo.prefix}-TB-${randNum}`;
            }
            if (nameInput && !nameInput.value.trim()) {
                nameInput.value = `${tInfo.name} 保守点検端末`;
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 保存して登録する';
            }
        }
    };
    reader.readAsText(file);
}

/**
 * 証明書の事前検証 API 呼び出し
 */
async function verifySelectedCert(fileInputId, previewBoxId, submitBtnId, isRotate = false) {
    const previewBox = document.getElementById(previewBoxId);
    const submitBtn = document.getElementById(submitBtnId);
    const certData = isRotate ? verifiedRotateCertPem : verifiedCreateCertPem;

    if (!certData) {
        showPreviewError(previewBoxId, '証明書ファイルを選択してください。');
        return;
    }

    if (previewBox) {
        previewBox.style.display = 'block';
        previewBox.style.background = '#f8fafc';
        previewBox.style.border = '1px solid #cbd5e1';
        previewBox.innerHTML = '<span style="color: #0369a1;">🔄 サーバー側で証明書を検証中...</span>';
    }

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch('/api/security/devices/verify-cert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ certificate: certData })
        });

        const result = await response.json();

        if (result.ok) {
            const info = result.certificateInfo || {};
            if (previewBox) {
                previewBox.style.display = 'block';
                previewBox.style.background = '#f0fdf4';
                previewBox.style.border = '1px solid #86efac';
                previewBox.innerHTML = `
                    <div style="color: #166534; font-weight: 700; margin-bottom: 4px;">✅ 証明書検証に合格しました</div>
                    <div style="font-size: 0.78rem; line-height: 1.5; color: #1e293b;">
                        <div>・Fingerprint: <code style="font-family: monospace; background: #dcfce7; padding: 2px 4px; border-radius: 3px;">${info.fingerprintShort}</code></div>
                        <div>・有効期限: <strong>${info.validToFormatted}</strong> (${info.daysRemaining}日後まで有効)</div>
                    </div>
                `;
            }
            if (submitBtn) submitBtn.disabled = false;
        } else {
            showPreviewError(previewBoxId, `❌ 検証失敗: ${result.message || '証明書が不正です'}`);
            if (submitBtn) submitBtn.disabled = true;
        }
    } catch (err) {
        showPreviewError(previewBoxId, `通信エラー: ${err.message}`);
        if (submitBtn) submitBtn.disabled = true;
    }
}

function showPreviewError(boxId, msg) {
    const box = document.getElementById(boxId);
    if (box) {
        box.style.display = 'block';
        box.style.background = '#fef2f2';
        box.style.border = '1px solid #fecaca';
        box.style.color = '#991b1b';
        box.textContent = msg;
    }
}

/**
 * 新規登録モーダル内のテナント証明書表示を更新
 */
function updateCreateDeviceTenantInfo() {
    const tenantSelect = document.getElementById('dev-create-tenant-select');
    const autoCertName = document.getElementById('dev-create-auto-cert-name');
    const selectedTenant = (canSwitchDeviceTenant && tenantSelect && tenantSelect.value) ? tenantSelect.value : (currentTenant || 'kintetsu');
    if (autoCertName) {
        autoCertName.textContent = `client_${selectedTenant}.crt`;
    }
}

/**
 * 新規登録モーダルを開く
 */
function openCreateDeviceModal() {
    const modal = document.getElementById('device-create-modal');
    const tenantInput = document.getElementById('dev-create-tenant-name');
    const tenantSelect = document.getElementById('dev-create-tenant-select');
    const tenantLabel = document.getElementById('lbl-dev-create-tenant');
    const nameInput = document.getElementById('dev-create-name');
    const idInput = document.getElementById('dev-create-identifier');
    const fileInput = document.getElementById('dev-create-cert-file');
    const customFileWrap = document.getElementById('dev-create-custom-file-wrap');
    const toggleCustomCertBtn = document.getElementById('btn-toggle-custom-cert');
    const previewBox = document.getElementById('dev-create-cert-preview');
    const submitBtn = document.getElementById('btn-submit-create-device');

    if (canSwitchDeviceTenant && availableDeviceTenants.length > 0) {
        if (tenantInput) tenantInput.style.display = 'none';
        if (tenantSelect) {
            tenantSelect.style.display = 'block';
            tenantSelect.innerHTML = availableDeviceTenants.map(t =>
                `<option value="${t.tenant_key}" ${t.tenant_key === selectedDeviceTenantId ? 'selected' : ''}>${t.tenant_name} (${t.tenant_key})</option>`
            ).join('');
        }
        if (tenantLabel) tenantLabel.innerHTML = '所属テナント <span style="font-size: 0.75rem; color: #0284c7; font-weight: bold;">(管理者選択)</span>';
    } else {
        if (tenantSelect) tenantSelect.style.display = 'none';
        if (tenantInput) {
            tenantInput.style.display = 'block';
            tenantInput.value = currentTenantDisplayName || 'デモ環境';
        }
        if (tenantLabel) tenantLabel.innerHTML = '所属テナント <span style="font-size: 0.75rem; color: #64748b;">(ログイン証明書から自動判定)</span>';
    }

    updateCreateDeviceTenantInfo();

    if (customFileWrap) customFileWrap.style.display = 'none';
    if (toggleCustomCertBtn) toggleCustomCertBtn.textContent = '別ファイルを手動指定';

    if (nameInput) nameInput.value = '';
    if (idInput) idInput.value = '';
    if (fileInput) fileInput.value = '';
    if (previewBox) {
        previewBox.style.display = 'none';
        previewBox.innerHTML = '';
    }
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 保存して登録する';
    }
    verifiedCreateCertPem = '';

    if (modal) modal.style.display = 'flex';
}

/**
 * 新規デバイス登録 送信処理 (ワンクリック自動読み込み・検証・DB保存・自動モーダル消去・一覧即時反映)
 */
async function handleSubmitCreateDevice(e) {
    e.preventDefault();
    const nameInput = document.getElementById('dev-create-name');
    const idInput = document.getElementById('dev-create-identifier');
    const fileInput = document.getElementById('dev-create-cert-file');
    const customFileWrap = document.getElementById('dev-create-custom-file-wrap');
    const previewBox = document.getElementById('dev-create-cert-preview');
    const submitBtn = document.getElementById('btn-submit-create-device');

    const devName = nameInput ? nameInput.value.trim() : '';
    const devIdent = idInput ? idInput.value.trim() : '';

    if (!devName) {
        showToast('デバイス名を入力してください', 'warning');
        if (nameInput) nameInput.focus();
        return;
    }
    if (!devIdent) {
        showToast('管理番号を入力してください', 'warning');
        if (idInput) idInput.focus();
        return;
    }

    // 別ファイル手動指定枠が表示されており、ファイルが選択されている場合はファイル読み込み
    const isCustomFileMode = customFileWrap && customFileWrap.style.display !== 'none';
    if (isCustomFileMode && fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.p12') || fileName.endsWith('.pfx') || fileName.endsWith('.key')) {
            showToast('秘密鍵や.p12形式は指定できません。公開証明書（.crt）を指定してください', 'error');
            return;
        }

        try {
            verifiedCreateCertPem = await file.text();
        } catch (err) {
            showToast('ファイルの読み込みに失敗しました: ' + err.message, 'error');
            return;
        }
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ 保存・登録中...';
    }

    try {
        const authToken = getAuthToken();
        const tenantSelect = document.getElementById('dev-create-tenant-select');
        const targetTenantId = (tenantSelect && tenantSelect.value && tenantSelect.style.display !== 'none')
            ? tenantSelect.value
            : ((canSwitchDeviceTenant && tenantSelect && tenantSelect.value) ? tenantSelect.value : undefined);

        const certToSend = (verifiedCreateCertPem && verifiedCreateCertPem.trim())
            ? verifiedCreateCertPem
            : ''; // 未選択時はサーバー側で社内CAから自動発行または固定証明書を適用

        const response = await tenantFetch('/api/security/devices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                deviceName: devName,
                deviceIdentifier: devIdent,
                certificate: certToSend,
                targetTenantId
            })
        });

        const result = await response.json();

        if (result.ok) {
            // 登録・保存完了: モーダルを直ちに閉じる（UIが完全に消える）
            closeModal('device-create-modal');
            showToast(result.message || 'デバイスを正常に登録・保存しました', 'success');

            // niinaが選択したテナントと一覧表示を連動
            if (canSwitchDeviceTenant && targetTenantId) {
                selectedDeviceTenantId = targetTenantId;
                const filterSelect = document.getElementById('dev-filter-tenant');
                if (filterSelect) {
                    filterSelect.value = targetTenantId;
                }
            }

            // 元の一覧テーブルを即時更新し、登録結果・検証済み証明書情報を一覧で確認できるようにする
            loadRegisteredDevices();
        } else {
            showToast(result.message || '登録に失敗しました', 'error');
            if (previewBox) {
                previewBox.style.display = 'block';
                previewBox.style.background = '#fef2f2';
                previewBox.style.border = '1px solid #fecaca';
                previewBox.style.color = '#991b1b';
                previewBox.textContent = `❌ ${result.message || '登録に失敗しました'}`;
            }
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 保存して登録する';
        }
    }
}

/**
 * デバイス詳細モーダルを開く
 */
async function openDeviceDetailModal(deviceId) {
    const modal = document.getElementById('device-detail-modal');
    const contentBox = document.getElementById('dev-detail-content');
    const toggleStatusBtn = document.getElementById('btn-toggle-status-from-detail');

    if (modal) modal.style.display = 'flex';
    if (contentBox) contentBox.innerHTML = '<div style="text-align: center; color: #64748b; padding: 24px;">読み込み中...</div>';

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${deviceId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const result = await response.json();

        if (result.ok && result.device) {
            const dev = result.device;
            currentDetailDevice = dev;

            let badgeStyle = 'background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';
            if (dev.status === 'disabled') badgeStyle = 'background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';
            if (dev.status === 'near_expiry') badgeStyle = 'background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';
            if (dev.status === 'expired' || dev.status === 'revoked') badgeStyle = 'background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;';

            if (toggleStatusBtn) {
                if (dev.isActive) {
                    toggleStatusBtn.textContent = '⛔ 端末を停止';
                    toggleStatusBtn.className = 'btn-danger-outline';
                } else {
                    toggleStatusBtn.textContent = '✅ 停止を解除 (再開)';
                    toggleStatusBtn.className = 'btn-sm-outline';
                }
            }

            const currentCert = dev.currentCertificate;

            let certsHtml = '';
            if (dev.certificates && dev.certificates.length > 0) {
                certsHtml = `
                    <div style="margin-top: 14px;">
                        <h4 style="margin: 0 0 6px 0; font-size: 0.85rem; color: #334155;">📜 証明書履歴 (${dev.certificates.length}件)</h4>
                        <div style="max-height: 140px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 4px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
                                <thead style="background: #f8fafc; text-align: left;">
                                    <tr>
                                        <th style="padding: 4px 8px;">状態</th>
                                        <th style="padding: 4px 8px;">Fingerprint (SHA-256)</th>
                                        <th style="padding: 4px 8px;">有効期限</th>
                                        <th style="padding: 4px 8px;">登録日</th>
                                        <th style="padding: 4px 8px; text-align: center;">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${dev.certificates.map(c => `
                                        <tr style="border-top: 1px solid #f1f5f9;">
                                            <td style="padding: 4px 8px;">
                                                ${c.isCurrent ? '<strong style="color: #15803d;">現行</strong>' : '<span style="color: #64748b;">旧証明書</span>'}
                                                ${c.isRevoked ? ' <span style="color: #dc2626; font-weight: 600;">(失効)</span>' : ''}
                                            </td>
                                            <td style="padding: 4px 8px; font-family: monospace;">${escapeHtml(c.fingerprintShort)}</td>
                                            <td style="padding: 4px 8px;">${escapeHtml(c.validTo)}</td>
                                            <td style="padding: 4px 8px; color: #64748b;">${escapeHtml(c.createdAt)}</td>
                                            <td style="padding: 4px 8px; text-align: center;">
                                                ${!c.isRevoked ? `
                                                    <button type="button" class="btn-sm btn-danger-outline" style="padding: 2px 6px; font-size: 0.72rem;" onclick="handleRevokeCert('${escapeHtml(dev.id)}', '${escapeHtml(c.id)}', '${escapeHtml(c.fingerprintShort)}')">失効</button>
                                                ` : '<span style="color: #94a3b8; font-size: 0.72rem;">失効済</span>'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            if (contentBox) {
                contentBox.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                        <div>
                            <span style="color: #64748b; font-size: 0.78rem;">デバイス名:</span><br>
                            <strong style="font-size: 1rem; color: #0f172a;">${dev.deviceName}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 0.78rem;">管理番号:</span><br>
                            <code style="font-family: monospace; font-size: 0.95rem; color: #0369a1; font-weight: 600;">${dev.deviceIdentifier}</code>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 0.78rem;">所属テナント:</span><br>
                            <strong>${dev.tenantDisplayName}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 0.78rem;">端末状態:</span><br>
                            <span style="${badgeStyle}">${dev.statusLabel}</span>
                        </div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px;">
                        <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 4px; color: #334155;">現行証明書情報</div>
                        <div style="font-size: 0.78rem; line-height: 1.6;">
                            <div>・Fingerprint (SHA-256): <code style="font-family: monospace; background: #fff; padding: 1px 4px; border: 1px solid #cbd5e1; border-radius: 3px; word-break: break-all;">${currentCert?.fingerprint256 || '-'}</code></div>
                            <div>・シリアル番号: ${currentCert?.serialNumber || '-'}</div>
                            <div>・Subject: ${currentCert?.subjectDn || '-'}</div>
                            <div>・有効期間: ${currentCert?.validFrom || '-'} 〜 <strong>${currentCert?.validTo || '-'}</strong></div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                        <span>登録日時: ${dev.createdAt}</span>
                        <span>最終更新: ${dev.updatedAt}</span>
                    </div>

                    ${certsHtml}
                `;
            }
        } else {
            if (contentBox) contentBox.innerHTML = `<div style="color: #dc2626; padding: 20px;">${result.message || '端末情報の取得に失敗しました'}</div>`;
        }
    } catch (err) {
        if (contentBox) contentBox.innerHTML = `<div style="color: #dc2626; padding: 20px;">通信エラー: ${err.message}</div>`;
    }
}

/**
 * 編集モーダルを開く
 */
async function openEditDeviceModal(deviceId) {
    const modal = document.getElementById('device-edit-modal');
    const idInput = document.getElementById('dev-edit-id');
    const tenantInput = document.getElementById('dev-edit-tenant-name');
    const identInput = document.getElementById('dev-edit-identifier');
    const nameInput = document.getElementById('dev-edit-name');
    const fpDisplay = document.getElementById('dev-edit-fp-display');

    // 前回データの残留を防止するため開く直前に完全クリア
    if (idInput) idInput.value = '';
    if (tenantInput) tenantInput.value = '';
    if (identInput) identInput.value = '';
    if (nameInput) nameInput.value = '';
    if (fpDisplay) fpDisplay.textContent = '読み込み中...';
    if (modal) modal.style.display = 'flex';

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${deviceId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const result = await response.json();

        if (result.ok && result.device) {
            const dev = result.device;
            if (idInput) idInput.value = dev.id;
            if (tenantInput) tenantInput.value = dev.tenantDisplayName || 'デモ環境';
            if (identInput) identInput.value = dev.deviceIdentifier;
            if (nameInput) nameInput.value = dev.deviceName;
            if (fpDisplay) fpDisplay.textContent = dev.currentCertificate?.fingerprint256 || '-';

            if (modal) modal.style.display = 'flex';
        } else {
            showToast(result.message || '端末情報の取得に失敗しました', 'error');
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    }
}

/**
 * デバイス編集 送信処理
 */
async function handleSubmitEditDevice(e) {
    e.preventDefault();
    const idInput = document.getElementById('dev-edit-id');
    const nameInput = document.getElementById('dev-edit-name');

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${idInput.value}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                deviceName: nameInput.value.trim()
            })
        });

        const result = await response.json();

        if (result.ok) {
            showToast(result.message || '端末名を更新しました', 'success');
            closeModal('device-edit-modal');
            loadRegisteredDevices();
        } else {
            showToast(result.message || '更新に失敗しました', 'error');
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    }
}

/**
 * 証明書更新モーダルを開く
 */
async function openRotateCertModal(deviceId) {
    const modal = document.getElementById('device-cert-rotate-modal');
    const idInput = document.getElementById('dev-rotate-id');
    const titleElem = document.getElementById('dev-rotate-device-title');
    const expiryElem = document.getElementById('dev-rotate-current-expiry');
    const fileInput = document.getElementById('dev-rotate-cert-file');
    const previewBox = document.getElementById('dev-rotate-cert-preview');
    const submitBtn = document.getElementById('btn-submit-rotate-cert');

    verifiedRotateCertPem = '';
    if (fileInput) fileInput.value = '';
    if (previewBox) previewBox.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${deviceId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const result = await response.json();

        if (result.ok && result.device) {
            const dev = result.device;
            if (idInput) idInput.value = dev.id;
            if (titleElem) titleElem.textContent = `${dev.deviceName} (${dev.deviceIdentifier})`;
            if (expiryElem) expiryElem.textContent = dev.currentCertificate?.validTo || '未登録';

            if (modal) modal.style.display = 'flex';
        } else {
            showToast(result.message || '端末情報の取得に失敗しました', 'error');
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    }
}

/**
 * 証明書更新 送信処理
 */
async function handleSubmitRotateCert(e) {
    e.preventDefault();
    const idInput = document.getElementById('dev-rotate-id');
    const submitBtn = document.getElementById('btn-submit-rotate-cert');

    if (!verifiedRotateCertPem) {
        showToast('新証明書ファイルを選択し、検証を完了させてください', 'warning');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '更新中...';
    }

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${idInput.value}/certificates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                certificate: verifiedRotateCertPem
            })
        });

        const result = await response.json();

        if (result.ok) {
            showToast(result.message || '証明書を更新しました', 'success');
            closeModal('device-cert-rotate-modal');
            loadRegisteredDevices();
        } else {
            showToast(result.message || '証明書更新に失敗しました', 'error');
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '新証明書を登録・更新';
        }
    }
}

/**
 * 端末停止モーダルを開く
 */
function openDisableDeviceModal(deviceId, deviceLabel) {
    const modal = document.getElementById('device-disable-modal');
    const idInput = document.getElementById('dev-disable-id');
    const labelElem = document.getElementById('dev-disable-device-label');
    const reasonInput = document.getElementById('dev-disable-reason');

    if (idInput) idInput.value = deviceId;
    if (labelElem) labelElem.textContent = deviceLabel;
    if (reasonInput) reasonInput.value = '';

    if (modal) modal.style.display = 'flex';
}

/**
 * 端末停止 送信処理
 */
async function handleSubmitDisableDevice(e) {
    e.preventDefault();
    const idInput = document.getElementById('dev-disable-id');
    const reasonInput = document.getElementById('dev-disable-reason');
    const submitBtn = document.getElementById('btn-confirm-disable-device');

    const reason = reasonInput.value.trim();
    if (!reason) {
        showToast('停止理由を入力してください', 'warning');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '停止処理中...';
    }

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${idInput.value}/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason })
        });

        const result = await response.json();

        if (result.ok) {
            showToast(result.message || '端末を停止しました', 'success');
            closeModal('device-disable-modal');
            loadRegisteredDevices();
        } else {
            showToast(result.message || '停止処理に失敗しました', 'error');
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '端末を停止する';
        }
    }
}

/**
 * 端末再開 (停止解除)
 */
async function handleEnableDevice(deviceId, deviceLabel) {
    if (!confirm(`端末 '${deviceLabel}' の停止を解除し、通常稼働を再開しますか？`)) {
        return;
    }

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${deviceId}/enable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason: '管理者による停止解除' })
        });

        const result = await response.json();

        if (result.ok) {
            showToast(result.message || '端末の停止を解除しました', 'success');
            closeModal('device-detail-modal');
            loadRegisteredDevices();
        } else {
            showToast(result.message || '再開処理に失敗しました', 'error');
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    }
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';

    // モーダルを閉じた際に前回選択・入力した情報が誤って残らないよう完全に初期化
    if (modalId === 'device-create-modal') {
        const nameInput = document.getElementById('dev-create-name');
        const idInput = document.getElementById('dev-create-identifier');
        const fileInput = document.getElementById('dev-create-cert-file');
        const previewBox = document.getElementById('dev-create-cert-preview');
        const submitBtn = document.getElementById('btn-submit-create-device');
        if (nameInput) nameInput.value = '';
        if (idInput) idInput.value = '';
        if (fileInput) fileInput.value = '';
        if (previewBox) {
            previewBox.style.display = 'none';
            previewBox.innerHTML = '';
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 保存して登録する';
        }
        verifiedCreateCertPem = '';
    } else if (modalId === 'device-edit-modal') {
        const idInput = document.getElementById('dev-edit-id');
        const nameInput = document.getElementById('dev-edit-name');
        const identInput = document.getElementById('dev-edit-identifier');
        const tenantInput = document.getElementById('dev-edit-tenant-name');
        const fpDisplay = document.getElementById('dev-edit-fp-display');
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (identInput) identInput.value = '';
        if (tenantInput) tenantInput.value = '';
        if (fpDisplay) fpDisplay.textContent = '-';
    } else if (modalId === 'device-cert-rotate-modal') {
        const idInput = document.getElementById('dev-rotate-id');
        const fileInput = document.getElementById('dev-rotate-cert-file');
        const previewBox = document.getElementById('dev-rotate-cert-preview');
        const submitBtn = document.getElementById('btn-submit-rotate-cert');
        if (idInput) idInput.value = '';
        if (fileInput) fileInput.value = '';
        if (previewBox) {
            previewBox.style.display = 'none';
            previewBox.innerHTML = '';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '証明書を更新する';
        }
        verifiedRotateCertPem = '';
    } else if (modalId === 'device-disable-modal') {
        const reasonInput = document.getElementById('dev-disable-reason');
        if (reasonInput) reasonInput.value = '';
    }
}

/**
 * npm audit結果を読み込み
 */
/**
 * モジュール稼働情報・バージョン確認
 */
async function loadNpmAudit(token) {
    try {
        const authToken = token || getAuthToken();
        const response = await tenantFetch('/api/maintenance/npm-audit', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();

        if (result.success) {
            const versionElem = document.getElementById('app-version-text');
            const buildElem = document.getElementById('build-timestamp-text');
            if (versionElem) versionElem.textContent = `v${result.version || '1.0.0'}`;
            if (buildElem) buildElem.textContent = result.build_time || result.checked_at || '稼働中';

            const govWarnings = document.querySelector('.gov-warnings');
            if (govWarnings) {
                govWarnings.innerHTML = `
                    <div style="font-size: 0.85rem; line-height: 1.5;">
                        <span>📦 バージョン: <strong>v${result.version || '1.0.0'}</strong> (${result.environment || 'production'})</span><br>
                        <span style="color: #64748b;">🕒 確認日時: ${result.checked_at || '-'}</span><br>
                        <span style="color: #0369a1; font-size: 0.8rem; display: inline-block; margin-top: 4px;">
                            🛡️ セキュリティポリシー: 管理画面からのGit push / Cloud Run自動更新は安全のため無効化されています。リリースはGitHub Actions/Cloud Buildを経由してください。
                        </span>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('[System Operations] Error loading module version:', error);
    }
}

/**
 * ストレージ使用状況を読み込み (実測値連携)
 */
async function loadStorageUsage(token) {
    const badge = document.getElementById('storage-status-badge');
    const totalElem = document.getElementById('storage-total-text');
    const pctElem = document.getElementById('storage-percentage-text');
    const detailsList = document.getElementById('storage-details-list');
    const progressBar = document.querySelector('.storage-stats .progress-bar-fill');

    try {
        const authToken = token || getAuthToken();
        const response = await tenantFetch('/api/maintenance/storage-usage', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();

        if (result.success) {
            if (badge) {
                badge.className = 'badge-active';
                badge.textContent = result.is_realtime ? 'GCS実測' : (result.source || 'GCS連携');
                badge.style.background = '#e0f2fe';
                badge.style.color = '#0369a1';
            }

            const totalFormatted = result.total_formatted || `${result.total || 0} GB`;
            if (totalElem) totalElem.textContent = totalFormatted;

            const limit = result.limit || 5;
            const totalGb = result.total || 0;
            const percentage = Math.min(100, Math.round((totalGb / limit) * 100));

            if (pctElem) pctElem.textContent = `${percentage}% (${limit}GB 上限)`;

            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
                progressBar.className = `progress-bar-fill ${percentage > 80 ? 'danger' : percentage > 60 ? 'warning' : 'success'}`;
            }

            if (detailsList && result.breakdown) {
                detailsList.innerHTML = `
                    <li>・対象バケット: <strong>${result.bucket || 'Cloud Storage'}</strong></li>
                    <li>・アップロード: ${result.breakdown.uploads || '0 GB'}</li>
                    <li>・ログファイル: ${result.breakdown.logs || '0 GB'}</li>
                    <li>・一時ファイル: ${result.breakdown.temp || '0 GB'}</li>
                    <li style="color: #64748b; font-size: 0.78rem; margin-top: 4px;">※集計日時: ${result.measured_at || '-'} (Cloud Monitoringメトリクスには遅延が含まれる場合があります)</li>
                `;
            }
        } else {
            if (badge) {
                badge.className = 'badge-alert';
                badge.textContent = '未構成';
                badge.style.background = '#fee2e2';
                badge.style.color = '#991b1b';
            }
            if (totalElem) totalElem.textContent = '未取得 (GCS未構成)';
            if (pctElem) pctElem.textContent = '-';
            if (detailsList) {
                detailsList.innerHTML = `
                    <li style="color: #dc2626;">⚠️ ${result.message || 'GCSバケット設定が未構成です'}</li>
                    <li style="color: #64748b; font-size: 0.78rem;">固定のモック表示(3.4GB/5GB)は廃止されました。環境変数 GOOGLE_CLOUD_STORAGE_BUCKET の設定を確認してください。</li>
                `;
            }
        }
    } catch (error) {
        console.error('[System Operations] Error loading storage usage:', error);
        if (badge) {
            badge.className = 'badge-alert';
            badge.textContent = 'エラー';
        }
        if (totalElem) totalElem.textContent = '取得エラー';
    }
}

/**
 * 証明書ステータスを読み込み (実DB連携・30日/7日警告)
 */
async function loadCertificateStatus(token) {
    try {
        const authToken = token || getAuthToken();
        const response = await tenantFetch('/api/maintenance/certificate-status', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();

        if (result.success && result.certificates) {
            const expiryList = document.querySelector('.expiry-list');
            if (expiryList) {
                expiryList.innerHTML = result.certificates.map(cert => {
                    let badgeClass = 'badge-success';
                    let badgeStyle = 'background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.78rem;';
                    let label = '正常';

                    if (cert.status === 'danger' || (cert.daysRemaining !== null && cert.daysRemaining < 7)) {
                        badgeClass = 'badge-danger';
                        badgeStyle = 'background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.78rem;';
                        label = cert.daysRemaining !== null ? `危険: 残り${cert.daysRemaining}日` : '期限切迫';
                    } else if (cert.status === 'warning' || (cert.daysRemaining !== null && cert.daysRemaining < 30)) {
                        badgeClass = 'badge-warning';
                        badgeStyle = 'background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.78rem;';
                        label = cert.daysRemaining !== null ? `警告: 残り${cert.daysRemaining}日` : '要更新';
                    } else if (cert.daysRemaining !== null) {
                        label = `残り${cert.daysRemaining}日`;
                    } else {
                        badgeStyle = 'background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;';
                        label = '外部管理 (Cloud Run LB)';
                    }

                    return `
                        <div class="expiry-row" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                            <div>
                                <span class="expiry-label" style="font-size: 0.85rem; font-weight: 500;">${cert.name}</span>
                                ${cert.valid_to ? `<br><span style="font-size: 0.75rem; color: #64748b;">有効期限: ${new Date(cert.valid_to).toLocaleDateString('ja-JP')}</span>` : ''}
                            </div>
                            <span class="${badgeClass}" style="${badgeStyle}">${label}</span>
                        </div>
                    `;
                }).join('') + `
                    <div style="margin-top: 8px; font-size: 0.75rem; color: #64748b; line-height: 1.4;">
                        ※注意: 証明書有効期限はDB直接書き換えによる延長は行えません。期限切れ前にGCP Certificate Managerまたは端末証明書の再発行を行ってください。
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('[System Operations] Error loading certificate status:', error);
    }
}

/**
 * 一時ファイル事前確認 (Dry Run)
 */
async function handlePreviewTempFiles() {
    const summaryBox = document.getElementById('clean-tmp-summary');
    const button = document.getElementById('btn-preview-tmp');
    if (button) button.disabled = true;

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch('/api/maintenance/temp-files-summary', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const result = await response.json();

        if (summaryBox) {
            summaryBox.style.display = 'block';
            if (result.success) {
                summaryBox.innerHTML = `
                    <div style="color: #0369a1; font-weight: 600; margin-bottom: 4px;">🔍 一時ファイル走査結果 (Dry Run)</div>
                    <div>・対象件数: <strong>${result.totalFiles} 件</strong></div>
                    <div>・合計容量: <strong>${result.totalSizeFormatted}</strong> (${result.totalSizeBytes} bytes)</div>
                    <div>・保持期限: ${result.retentionPolicy}</div>
                    <div style="color: #64748b; font-size: 0.75rem; margin-top: 4px;">※安全制限: server/uploads/temp および システムtmpディレクトリのみが対象です。DB・業務ファイルは除外されます。</div>
                `;
            } else {
                summaryBox.innerHTML = `<div style="color: #dc2626;">事前確認に失敗しました: ${result.message || 'エラー'}</div>`;
            }
        }
    } catch (error) {
        console.error('[Maintenance] Error previewing temp files:', error);
        if (summaryBox) {
            summaryBox.style.display = 'block';
            summaryBox.innerHTML = `<div style="color: #dc2626;">通信エラー: ${error.message}</div>`;
        }
    } finally {
        if (button) button.disabled = false;
    }
}

/**
 * 一時ファイル実削除処理 (確認・監査ログ記録付き)
 */
async function handleCleanTempFiles() {
    if (!confirm('⚠️ 【確認】一時ファイルを削除しますか？\n・対象: 1日以上経過した一時アップロードファイル\n・制限: 対象ディレクトリ配下に限定（DB・業務ファイルは保護）\n・監査ログ: 実行者・日時・対象件数が記録されます。')) {
        return;
    }

    const button = document.getElementById('btn-clean-tmp');
    const summaryBox = document.getElementById('clean-tmp-summary');
    button.disabled = true;
    button.textContent = '🔄 削除中...';

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch('/api/maintenance/clean-temp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ confirmExecution: true })
        });

        const result = await response.json();

        if (summaryBox) {
            summaryBox.style.display = 'block';
            if (result.success) {
                summaryBox.innerHTML = `
                    <div style="color: #166534; font-weight: 600; margin-bottom: 4px;">✅ 削除完了</div>
                    <div>${result.message}</div>
                    <div style="font-size: 0.75rem; color: #475569; margin-top: 4px;">削除件数: ${result.deletedFiles || 0} 件 / 容量: ${result.reclaimedBytes || 0} bytes</div>
                    <div style="font-size: 0.75rem; color: #166534; margin-top: 2px;">🛡️ 監査ログ ID: ${result.audit_log_id || '記録済'} に操作ログを保存しました。</div>
                `;
                showToast(result.message || '一時ファイルを削除しました', 'success');
                loadStorageUsage(authToken);
            } else {
                summaryBox.innerHTML = `<div style="color: #dc2626;">削除失敗: ${result.message}</div>`;
                showToast(result.message || '削除に失敗しました', 'error');
            }
        }
    } catch (error) {
        console.error('[Maintenance] Error cleaning temp files:', error);
        showToast('エラーが発生しました: ' + error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = '🗑️ 一時ファイルを削除';
    }
}

/**
 * ログバックアップ情報表示 (Cloud Loggingシンク案内)
 */
async function handleBackupLogs() {
    const button = document.getElementById('btn-backup-log');
    const resultBox = document.getElementById('backup-log-result');
    button.disabled = true;
    button.textContent = '🔄 確認中...';

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch('/api/maintenance/backup-logs', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();

        if (resultBox) {
            resultBox.style.display = 'block';
            if (result.success) {
                const guide = result.cloud_logging_sink_guide || {};
                resultBox.innerHTML = `
                    <div style="color: #0369a1; font-weight: 600; margin-bottom: 4px;">📦 ログ保管アーキテクチャ情報</div>
                    <div style="font-size: 0.8rem; line-height: 1.5;">
                        <p style="margin: 0 0 6px 0;">${result.message}</p>
                        <div>・保存先バケット: <code>${guide.destination_bucket || '未設定'}</code></div>
                        <div>・保存期間: ${guide.retention_period || '365日'}</div>
                        <div>・必要IAM権限: ${guide.required_iam || 'roles/storage.objectCreator'}</div>
                        <div>・ログ復元・検索: ${guide.restore_and_search || 'Cloud Logging / BigQuery'}</div>
                        <div style="margin-top: 6px; padding: 6px; background: #fff; border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 0.75rem; color: #475569;">
                            ℹ️ Cloud Run環境ではローカルディスクへのzip保存は行いません（コンテナ再起動で消失するため）。ログはCloud LoggingシンクによりGCSバケットへ恒久保管されます。
                        </div>
                    </div>
                `;
                showToast('ログ保管設定情報を取得しました', 'info');
            } else {
                resultBox.innerHTML = `<div style="color: #dc2626;">取得失敗: ${result.message}</div>`;
            }
        }
    } catch (error) {
        console.error('[Maintenance] Error backing up logs:', error);
        showToast('エラーが発生しました: ' + error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = '📦 ログバックアップ情報';
    }
}

/**
 * 孤立画像ファイル検出 (Dry Run専用・実削除不可)
 */
async function handleCleanOrphanedImages() {
    const button = document.getElementById('btn-clean-images');
    const resultBox = document.getElementById('orphaned-images-result');
    button.disabled = true;
    button.textContent = '🔄 孤立画像走査中 (Dry Run)...';

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch('/api/maintenance/clean-orphaned-images', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();

        if (resultBox) {
            resultBox.style.display = 'block';
            if (result.success) {
                const candidates = result.candidates || [];
                let candidatesHtml = '';
                if (candidates.length > 0) {
                    candidatesHtml = `
                        <div style="max-height: 150px; overflow-y: auto; margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 4px; background: #fff;">
                            <table style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f1f5f9; text-align: left;">
                                        <th style="padding: 4px 6px;">ファイル名</th>
                                        <th style="padding: 4px 6px;">サイズ</th>
                                        <th style="padding: 4px 6px;">更新日時</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${candidates.map(c => `
                                        <tr style="border-top: 1px solid #f1f5f9;">
                                            <td style="padding: 4px 6px; font-family: monospace;">${c.name}</td>
                                            <td style="padding: 4px 6px;">${c.size_kb} KB</td>
                                            <td style="padding: 4px 6px;">${new Date(c.updated).toLocaleString('ja-JP')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                resultBox.innerHTML = `
                    <div style="color: #991b1b; font-weight: 600; margin-bottom: 4px;">🔍 孤立画像検出結果 (Dry Run専用)</div>
                    <div style="font-size: 0.8rem; line-height: 1.5;">
                        <div>・検出候補数: <strong>${result.orphaned_count || 0} 件</strong> (合計容量: ${result.total_size_mb || 0} MB)</div>
                        <div style="color: #b91c1c; font-weight: 500; margin-top: 4px;">⚠️ ${result.deletion_blocked_reason || '実削除は安全のため無効化されています'}</div>
                        <div style="color: #64748b; font-size: 0.75rem; margin-top: 2px;">${result.cross_system_risk_notice || ''}</div>
                        ${candidatesHtml}
                    </div>
                `;
                showToast(`孤立画像候補を ${result.orphaned_count || 0} 件検出しました (Dry Run)`, 'info');
            } else {
                resultBox.innerHTML = `<div style="color: #dc2626;">検出失敗: ${result.message}</div>`;
                showToast(result.message || '走査に失敗しました', 'error');
            }
        }
    } catch (error) {
        console.error('[Maintenance] Error scanning orphaned images:', error);
        showToast('エラーが発生しました: ' + error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = '🔍 孤立画像候補を検出 (Dry Run)';
    }
}

// ========================================
// ユーザーインポ�者ト�者デ��プレート機�者
// ========================================

/**
 * デ��プレートダウンローデ
 */
/**
 * ユーザー管理��デ��プレーデのダウンローデ(CSV形弁者
 */
async function downloadUserTemplate() {
    const headers = ['ログインユーザー名', '表示名', 'メールアドレス', '権限(system_admin/operation_admin/user)', '初期パスワード'];
    const filename = 'ユーザー管理_テンプレート.csv';

    const csvContent = "\uFEFF" + headers.join(',') + '\n';
    await triggerFileDownload(csvContent, filename);
}

/**
 * 名前を付けて保存ダイアログを表示してファイルをダウンローデ
 * @param {string} content ファイル冁者��
 * @param {string} suggestedName 推奨ファイル吁者
 */
async function triggerFileDownload(content, suggestedName) {
    // 1. File System Access API が利用可能な場吁者(モダンブラウザ)
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'CSV File',
                    accept: { 'text/csv': ['.csv'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            showToast('ファイルを保存しました', 'success');
            return;
        } catch (err) {
            // ユーザーがキャンセルした場合�者何もしなぁ者
            if (err.name === 'AbortError') return;
            console.error('File sync save error:', err);
            // エラーの場合�者フォールバックへ
        }
    }

    // 2. フォールバック: 従来のダウンロード方法(保存場所はブラウザ設定に依存
    console.log('[Download] Falling back to traditional download method');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", suggestedName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('テンプレートをダウンロードしました', 'success');
}

// 既存�者 download者xcelTemplate は不要になったため削除

// 旧デ��プレートダウンロード�者理�者残骸を削除しました、者

/**
 * ユーザーインポ�者ト�者理
 */
async function importUsers(file) {
    if (!file) {
        showToast('ファイルが選択されていません', 'error');
        return;
    }

    // ファイルサイズチェック (1MB)
    if (file.size > 1024 * 1024) {
        showToast('ファイルサイズが大きすぎます（最大1MB）', 'error');
        return;
    }

    const fileName = file.name.toLowerCase();
    let users = [];

    try {
        showToast('インポート処理中...', 'info');

        if (fileName.endsWith('.csv')) {
            users = await parseCSVFile(file);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            users = await parse者xcelFile(file);
        } else {
            showToast('対応していないファイル形式です（.csv, .xlsx, .xlsのみ）', 'error');
            return;
        }

        console.log('[importUsers] Parsed users:', users);

        if (users.length === 0) {
            showToast('インポートするユーザーがありません', 'warning');
            return;
        }

        // バリデ�者ション
        const validation = validateUsers(users);
        if (!validation.valid) {
            showToast(`データエラー:\n${validation.errors.join('\n')}`, 'error');
            return;
        }

        // サーバ�者に送信
        await sendUsersToServer(users);

    } catch (error) {
        console.error('[importUsers] 者rror:', error);
        showToast('インポート処理中にエラーが発生しました: ' + error.message, 'error');
    }
}

/**
 * CSVファイルパ�者ス
 */
async function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n').filter(line => line.trim());

                if (lines.length < 2) {
                    reject(new Error('データが空です'));
                    return;
                }

                // ヘッダー行をスキップ�者
                const dataLines = lines.slice(1);
                const users = dataLines.map((line, index) => {
                    // CSV parsing (simple version - handles quoted fields)
                    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

                    if (values.length < 5) {
                        console.warn(`行${index + 2}: カラム数が不足してぁ者��す`);
                        return null;
                    }

                    return {
                        username: values[0],
                        display_name: values[1],
                        email: values[2],
                        role: values[3],
                        password: values[4]
                    };
                }).filter(u => u !== null);

                resolve(users);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
        reader.readAsText(file, 'UTF-8');
    });
}

/**
 * 者xcelファイルパ�者ス�者�者TML形式�者簡易版�者�者
 */
async function parse者xcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;

                // Simple HTML table parsing
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const rows = doc.querySelectorAll('tr');

                if (rows.length < 2) {
                    reject(new Error('データが空です'));
                    return;
                }

                const users = [];
                // Skip header row (index 0)
                for (let i = 1; i < rows.length; i++) {
                    const cells = rows[i].querySelectorAll('td, th');
                    if (cells.length >= 5) {
                        users.push({
                            username: cells[0].textContent.trim(),
                            display_name: cells[1].textContent.trim(),
                            email: cells[2].textContent.trim(),
                            role: cells[3].textContent.trim(),
                            password: cells[4].textContent.trim()
                        });
                    }
                }

                resolve(users);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
        reader.readAsText(file, 'UTF-8');
    });
}

/**
 * ユーザーデ�者タのバリデ�者ション
 */
function validateUsers(users) {
    const errors = [];
    const usernames = new Set();
    const validRoles = ['system_admin', 'operation_admin', 'user'];

    users.forEach((user, index) => {
        const rowNum = index + 2; // +2 for header and 0-index

        // ログインユーザー名チェック��
        if (!user.username || user.username.trim() === '') {
            errors.push(`行{rowNum}: ログインユーザー名が空です`);
        } else if (usernames.has(user.username)) {
            errors.push(`行{rowNum}: ログインユーザー名が重複��てぁ者��ぁ者(${user.username})`);
        } else {
            usernames.add(user.username);
        }

        // 表示名チェック��
        if (!user.display_name || user.display_name.trim() === '') {
            errors.push(`行{rowNum}: 表示名が空です`);
        }

        // 権限チェック���者�旧ロールは3種へ正規化�者�者
        const normalizedRole = normalizeUserRole(user.role);
        if (!normalizedRole || !validRoles.includes(normalizedRole)) {
            errors.push(`行{rowNum}: 権限が不正です(${user.role})`);
        } else {
            user.role = normalizedRole;
        }

        // パスワードチェック��
        if (!user.password || user.password.length < 6) {
            errors.push(`行{rowNum}: パスワード�者6文��以上必要��です`);
        }
    });

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * サーバ�者にユーザーデ�者タを送信
 */
async function sendUsersToServer(users) {
    try {
        const response = await tenantFetch('/api/users/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ users })
        });

        const result = await response.json();

        if (result.success) {
            const message = `インポ�者ト完了n成功: ${result.imported}件\nスキップ�者: ${result.skipped}件\nエラー: ${result.errors}件`;
            showToast(message, 'success');

            // ユーザーリストを再読み込み
            await loadUsers();
        } else {
            showToast('インポートに失敗しました: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('[sendUsersToServer] 者rror:', error);
        showToast('サーバーエラー: ' + error.message, 'error');
    }
}

// ========================================
// システム共通設定（テナントDB operations.system_settings）
// ========================================
let currentSystemSettings = [];

async function loadSystemSettings() {
    const tbody = document.getElementById('system-settings-tbody');
    const statusSpan = document.getElementById('system-settings-status');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; padding: 20px;">読み込み中...</td></tr>';
    }
    if (statusSpan) {
        statusSpan.textContent = '';
    }

    try {
        console.log('[loadSystemSettings] Fetching system settings...');
        const response = await tenantFetch('/api/system-settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentSystemSettings = Array.isArray(data) ? data : (data.settings || []);
        console.log('[loadSystemSettings] Settings received:', currentSystemSettings.length);

        const isSysAdmin = (window.currentAdminUserRole === 'system_admin');
        const saveBtn = document.getElementById('save-system-settings-btn');
        if (saveBtn) {
            if (isSysAdmin) {
                saveBtn.disabled = false;
                saveBtn.title = '設定を保存します';
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            } else {
                saveBtn.disabled = true;
                saveBtn.title = 'システム管理者のみ保存できます';
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
            }
        }

        // フォーム入力枠に値をバインド（システム管理者以外は入力不可）
        currentSystemSettings.forEach(setting => {
            const el = document.querySelector(`[data-key="${setting.setting_key}"]`);
            if (el) {
                if (el.tagName === 'SELECT') {
                    el.value = String(setting.setting_value);
                    el.disabled = !isSysAdmin;
                } else {
                    el.value = setting.setting_value ?? '';
                    el.readOnly = !isSysAdmin;
                }
            }
        });

        // テーブル一覧を生成
        if (tbody) {
            if (currentSystemSettings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 20px;">設定データがありません</td></tr>';
            } else {
                tbody.innerHTML = currentSystemSettings.map(s => `
                    <tr id="setting-row-${escapeHtml(s.id)}" style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 14px; font-weight: 500;">${escapeHtml(s.display_name || s.setting_key)}</td>
                        <td style="padding: 10px 14px; font-family: monospace; color: #64748b; font-size: 13px;">${escapeHtml(s.setting_key)}</td>
                        <td style="padding: 10px 14px;"><span class="badge-gray" style="font-size: 11px;">${escapeHtml(s.category)}</span></td>
                        <td style="padding: 10px 14px;" id="setting-val-cell-${escapeHtml(s.id)}">
                            <span class="setting-val-text">${escapeHtml(s.setting_value ?? '')}</span>
                        </td>
                        <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">${escapeHtml(s.description || '-')}</td>
                        <td style="padding: 10px 14px; text-align: center;">
                            ${(s.is_editable && isSysAdmin) ? `
                                <button type="button" class="btn-edit" style="padding: 4px 10px; font-size: 12px;" onclick="inlineEditSystemSetting('${escapeHtml(s.id)}')">✏️ 編集</button>
                            ` : (s.is_editable ? '<span style="color: #64748b; font-size: 12px;">閲覧のみ</span>' : '<span style="color: #94a3b8; font-size: 12px;">固定</span>')}
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('[loadSystemSettings] Error:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">設定の取得に失敗しました: ${escapeHtml(err.message)}</td></tr>`;
        }
        showToast('システム設定の読み込みに失敗しました: ' + err.message, 'error');
    }
}

async function saveSystemSettings() {
    const statusSpan = document.getElementById('system-settings-status');
    const saveBtn = document.getElementById('save-system-settings-btn');
    if (saveBtn) saveBtn.disabled = true;
    if (statusSpan) {
        statusSpan.style.color = '#3b82f6';
        statusSpan.textContent = '保存中...';
    }

    try {
        const inputs = document.querySelectorAll('#system-settings-tab [data-key]');
        const settings = {};
        inputs.forEach(input => {
            const key = input.getAttribute('data-key');
            if (key) {
                settings[key] = input.value;
            }
        });

        console.log('[saveSystemSettings] Saving settings:', settings);
        const response = await tenantFetch('/api/system-settings/bulk', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }

        if (statusSpan) {
            statusSpan.style.color = '#10b981';
            statusSpan.textContent = '✓ 正常に保存されました';
            setTimeout(() => { if (statusSpan.textContent.includes('保存されました')) statusSpan.textContent = ''; }, 4000);
        }
        showToast('システム共通設定を保存しました', 'success');
        await loadSystemSettings();
    } catch (err) {
        console.error('[saveSystemSettings] Error:', err);
        if (statusSpan) {
            statusSpan.style.color = '#ef4444';
            statusSpan.textContent = '✕ 保存失敗: ' + err.message;
        }
        showToast('保存に失敗しました: ' + err.message, 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

// 行個別インライン編集
window.inlineEditSystemSetting = function (id) {
    const setting = currentSystemSettings.find(s => String(s.id) === String(id));
    if (!setting) return;

    const cell = document.getElementById(`setting-val-cell-${id}`);
    if (!cell) return;

    const currentVal = setting.setting_value ?? '';
    cell.innerHTML = `
        <div style="display: flex; gap: 4px; align-items: center;">
            <input type="text" id="inline-input-${escapeHtml(id)}" value="${escapeHtml(currentVal)}" style="padding: 4px 8px; font-size: 13px; border: 1px solid #3b82f6; border-radius: 4px; width: 100%;">
            <button type="button" class="btn-primary" style="padding: 3px 8px; font-size: 11px; white-space: nowrap;" onclick="saveInlineSystemSetting('${escapeHtml(id)}')">保存</button>
            <button type="button" class="btn-secondary" style="padding: 3px 8px; font-size: 11px; white-space: nowrap;" onclick="cancelInlineSystemSetting('${escapeHtml(id)}')">取消</button>
        </div>
    `;
};

window.cancelInlineSystemSetting = function (id) {
    const setting = currentSystemSettings.find(s => String(s.id) === String(id));
    const cell = document.getElementById(`setting-val-cell-${id}`);
    if (setting && cell) {
        cell.innerHTML = `<span class="setting-val-text">${escapeHtml(setting.setting_value ?? '')}</span>`;
    }
};

window.saveInlineSystemSetting = async function (id) {
    const input = document.getElementById(`inline-input-${id}`);
    if (!input) return;
    const newVal = input.value;

    try {
        const response = await tenantFetch(`/api/system-settings/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ setting_value: newVal })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        showToast('設定を更新しました', 'success');
        await loadSystemSettings();
    } catch (err) {
        console.error('[saveInlineSystemSetting] Error:', err);
        showToast('更新失敗: ' + err.message, 'error');
    }
};


// ========================================
// データベース管理 (復元)
// ========================================
async function loadDatabaseStats() {
    try {
        const token = localStorage.getItem('user_token') || getAuthToken();
        console.log('[loadDatabaseStats] Fetching database stats...');
        const response = await tenantFetch('/api/database/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.stats) {
            const statusBadge = document.getElementById('db-connection-status');
            if (statusBadge) {
                statusBadge.innerHTML = data.stats.connected
                    ? '<span class="status-badge status-connected">✓ 接続中</span>'
                    : '<span class="status-badge status-error">✕ エラー</span>';
            }
            const setElem = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val || '--';
            };
            setElem('db-version', data.stats.version);
            setElem('db-connections', data.stats.connections);
            setElem('connection-count', data.stats.connections);
            setElem('db-size', data.stats.database_size);
            setElem('uptime', data.stats.uptime);

            const diskUsage = data.stats.disk_usage || 0;
            const diskElem = document.getElementById('disk-usage');
            const diskProgress = document.getElementById('disk-progress');
            if (diskElem) diskElem.textContent = diskUsage + '%';
            if (diskProgress) diskProgress.style.width = diskUsage + '%';
        }
    } catch (error) {
        console.error('[loadDatabaseStats] Error:', error);
        showToast('データベース状態の読み込みに失敗しました: ' + error.message, 'error');
    }
}

// ========================================
// マスタデータ一括インポート・テンプレート (復元)
// ========================================
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));
        return values;
    });
}

async function fetchOfficeMap() {
    try {
        const token = localStorage.getItem('user_token') || getAuthToken();
        const res = await tenantFetch('/api/offices', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const map = {};
        const offices = unwrapApiArray(data);
        offices.forEach(o => { map[o.office_name] = o.office_id || o.id; });
        return map;
    } catch (e) {
        return {};
    }
}

async function fetchMachineTypeMap() {
    try {
        const token = localStorage.getItem('user_token') || getAuthToken();
        const res = await tenantFetch('/api/machine-types', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const map = {};
        const types = unwrapApiArray(data);
        types.forEach(t => { map[t.model_name] = t.id; });
        return map;
    } catch (e) {
        return {};
    }
}

function importMasterData(type, file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const rows = parseCSV(text);
            if (rows.length < 2) {
                showToast('CSVデータが見つかりません', 'error');
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1);
            showToast(`${dataRows.length}件の処理を開始します...`, 'info');

            let idMaps = {};
            if (type === 'bases' || type === 'machines') {
                idMaps.offices = await fetchOfficeMap();
            }
            if (type === 'machines') {
                idMaps.machineTypes = await fetchMachineTypeMap();
            }

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                if (row.length < headers.length) continue;

                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index] ? row[index].trim() : '';
                });

                try {
                    let apiData = {};
                    let apiUrl = '';

                    switch (type) {
                        case 'offices':
                            apiData = {
                                office_code: rowData['事業所コード'] || null,
                                office_name: rowData['事業所名*'],
                                office_type: rowData['事業所区分'],
                                address: rowData['住所'],
                                postal_code: rowData['郵便番号'],
                                phone_number: rowData['電話番号']
                            };
                            if (!apiData.office_name) throw new Error('事業所名は必須です');
                            apiUrl = '/api/offices';
                            break;
                        case 'bases':
                            const officeId = idMaps.offices ? idMaps.offices[rowData['所属事業所名']] : null;
                            apiData = {
                                base_code: rowData['基地コード'] || null,
                                base_name: rowData['基地名*'],
                                office_id: officeId || null,
                                location: rowData['所在地']
                            };
                            if (!apiData.base_name) throw new Error('基地名は必須です');
                            apiUrl = '/api/bases';
                            break;
                        default:
                            throw new Error('未対応の種別: ' + type);
                    }

                    const token = localStorage.getItem('user_token') || getAuthToken();
                    const res = await tenantFetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(apiData)
                    });

                    if (res.ok) successCount++;
                    else errorCount++;
                } catch (err) {
                    errorCount++;
                }
            }

            showToast(`インポート完了: 成功 ${successCount}件, 失敗 ${errorCount}件`, successCount > 0 ? 'success' : 'error');

            if (type === 'offices') loadOffices();
            if (type === 'bases') loadBases();
        } catch (err) {
            showToast('インポート処理エラー: ' + err.message, 'error');
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function downloadMasterTemplate(type) {
    let headers = [];
    let filename = '';

    switch (type) {
        case 'offices':
            headers = ['事業所コード', '事業所名*', '事業所区分', '住所', '郵便番号', '電話番号'];
            filename = '事業所マスタ_テンプレート.csv';
            break;
        case 'bases':
            headers = ['基地コード', '基地名*', '所属事業所名', '所在地'];
            filename = '保守基地マスタ_テンプレート.csv';
            break;
        default:
            showToast('未対応の種別です', 'error');
            return;
    }

    const csvContent = "\uFEFF" + headers.join(',') + '\n';
    triggerFileDownload(csvContent, filename);
}


/**
 * 証明書個別失効処理
 */
async function handleRevokeCert(deviceId, certId, certLabel) {
    const reason = prompt(`証明書 (${certLabel}) を失効させますか？\n失効した証明書は元に戻せません。失効理由を入力してください:`, '管理者による手動失効');
    if (!reason || !reason.trim()) {
        return;
    }

    try {
        const authToken = getAuthToken();
        const response = await tenantFetch(`/api/security/devices/${deviceId}/revoke-cert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ certId, reason: reason.trim() })
        });

        const result = await response.json();
        if (result.ok) {
            showToast(result.message || '証明書を失効させました', 'success');
            openDeviceDetailModal(deviceId);
            loadRegisteredDevices();
        } else {
            showToast(result.message || '失効処理に失敗しました', 'error');
        }
    } catch (err) {
        showToast('通信エラー: ' + err.message, 'error');
    }
}
window.handleRevokeCert = handleRevokeCert;
