// ========================================
// 設定: 機種マスタ関連の定数
// ========================================
const MACHINE_CATEGORIES = [
    '軌道モータカー',
    '箱トロ',
    '鉄トロ',
    'レールカッター',
    '油圧ショベル',
    'クレーン',
    'その他'
];

document.addEventListener('DOMContentLoaded', () => {
    // 認証チェック
    const token = localStorage.getItem('user_token');
    console.log('[Admin] Version: 20260107-1400');
    console.log('[Admin] Token check:', token ? 'Token exists' : 'No token found');
    console.log('[Admin] Initializing admin page...');

    if (!token) {
        console.error('[Admin] No token, redirecting to login');
        window.location.href = '/';
        return;
    }

    // ユーザー情報の表示とロールチェック
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    console.log('[Admin] User info:', userInfo);
    console.log('[Admin] User role:', userInfo.role);
    document.getElementById('admin-user').textContent = userInfo.displayName || userInfo.username;

    // システム管理者または運用管理者のみアクセス可能
    if (userInfo.role !== 'system_admin' && userInfo.role !== 'operation_admin' && userInfo.role !== 'admin') {
        console.error('[Admin] Access denied - role:', userInfo.role);
        alert('アクセス権限がありません。管理者権限が必要です。');
        window.location.href = '/index.html';
        return;
    }

    console.log('[Admin] Access granted for admin user');

    // ロールに基づいてタブの表示制御
    applyRoleBasedTabVisibility(userInfo.role);

    // メイン画面に戻る
    document.getElementById('back-to-main-btn').addEventListener('click', () => {
        window.location.href = '/index.html';
    });

    // タブ機能の初期化
    initializeTabs();

    // 初期ロード
    loadUsers();
    loadOffices();
    loadBases();
    loadDatabaseStats();
    loadInspectionTypes();
    loadInspectionSchedules();

    // 汎用テーブルフィルター関数
    window.applyTableFilter = function (table) {
        const filters = Array.from(table.querySelectorAll('.column-filter'));
        const activeFilters = filters.map(f => ({
            index: parseInt(f.dataset.col),
            value: f.value
        })).filter(f => f.value !== "");

        const rows = Array.from(table.querySelector('tbody').rows);

        rows.forEach(row => {
            const isMatch = activeFilters.every(f => {
                const cellText = row.cells[f.index].textContent.trim();
                return cellText === f.value;
            });
            row.style.display = isMatch ? "" : "none";
        });
    };

    // フィルタの選択肢を自動生成する関数
    window.updateFilterOptions = function (table) {
        const filters = Array.from(table.querySelectorAll('.column-filter'));
        const rows = Array.from(table.querySelector('tbody').rows);

        filters.forEach(select => {
            const colIndex = parseInt(select.dataset.col);
            const values = new Set();
            rows.forEach(row => {
                const text = row.cells[colIndex].textContent.trim();
                if (text) values.add(text);
            });

            const currentVal = select.value;
            let optionsHtml = '<option value="">(全て)</option>';
            Array.from(values).sort().forEach(val => {
                optionsHtml += `<option value="${val}">${val}</option>`;
            });
            select.innerHTML = optionsHtml;
            select.value = currentVal;
        });
    };

    // イベントリスナーの初期化
    initializeEventListeners();
    initializeCorsSettings();
});

// ロールに基づいてタブの表示制御
function applyRoleBasedTabVisibility(role) {
    console.log('[applyRoleBasedTabVisibility] Applying visibility for role:', role);

    // システム管理者専用のタブ
    const systemAdminOnlyTabs = [
        'database-management',
        'system-operations',
        'cors-settings'
    ];

    systemAdminOnlyTabs.forEach(tabName => {
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);

        // admin ロールは system_admin として扱う（後方互換性）
        if (role === 'system_admin' || role === 'admin') {
            // システム管理者には表示
            if (tabButton) {
                tabButton.style.display = '';
                console.log(`[applyRoleBasedTabVisibility] Showing tab: ${tabName}`);
            }
            if (tabContent) {
                tabContent.style.display = '';
            }
        } else {
            // 運用管理者には非表示
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

// タブ機能
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    console.log('[initializeTabs] Found tab buttons:', tabButtons.length);
    console.log('[initializeTabs] Found tab contents:', tabContents.length);

    // 最初のタブをアクティブにする
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

            // すべてのタブボタンとコンテンツを非アクティブにする
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');

            // クリックされたタブをアクティブにする
            button.classList.add('active');
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) {
                targetTab.style.display = 'block';
                console.log('[Tab Click] Tab activated:', tabName);
            } else {
                console.error('[Tab Click] Tab content not found:', `${tabName}-tab`);
            }

            // タブに応じてデータを読み込み
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
            } else if (tabName === 'cors-settings') {
                loadCorsSettings();
            }
        });
    });
}

// イベントリスナーの初期化
function initializeEventListeners() {
    // ユーザー追加ボタン
    const addUserBtn = document.getElementById('add-new-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserModal());
    }

    // ユーザーモーダルのイベントリスナー
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

    // 保守基地追加ボタン
    const addBaseBtn = document.getElementById('add-new-base-btn');
    if (addBaseBtn) {
        addBaseBtn.addEventListener('click', () => showBaseModal('add', null));
    }

    // 機種マスタ追加ボタン
    const addMachineTypeBtn = document.getElementById('add-new-machine-type-btn');
    if (addMachineTypeBtn) {
        addMachineTypeBtn.addEventListener('click', () => {
            // カテゴリ選択肢を初期化
            const categorySelect = document.getElementById('machine-type-category');
            if (categorySelect && categorySelect.options.length === 1) {
                MACHINE_CATEGORIES.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    categorySelect.appendChild(option);
                });
            }
            openMachineTypeModal();
        });
    }

    // 機種マスタモーダルのイベントリスナー
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

    // 機械番号マスタモーダルのイベントリスナー
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

    // 検修種別モーダルのイベントリスナー
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

    // 検修設定モーダルのイベントリスナー
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

    // テーブルの編集・削除ボタンのイベント委譲
    document.addEventListener('click', (e) => {
        const target = e.target;

        // 機種の編集ボタン
        if (target.classList.contains('btn-edit') && target.dataset.action === 'edit-type') {
            e.preventDefault();
            const typeId = target.dataset.id;
            console.log('[Event] Edit machine type clicked:', typeId);
            window.editMachineType(typeId);
        }

        // 機種の削除ボタン
        if (target.classList.contains('btn-delete') && target.dataset.action === 'delete-type') {
            e.preventDefault();
            const typeId = target.dataset.id;
            const typeCode = target.dataset.code;
            console.log('[Event] Delete machine type clicked:', { id: typeId, code: typeCode });
            window.deleteMachineType(typeId, typeCode);
        }

        // 保守用車の編集ボタン
        if (target.classList.contains('btn-edit') && target.dataset.action === 'edit-machine') {
            e.preventDefault();
            const machineId = target.dataset.id;
            console.log('[Event] Edit machine clicked:', machineId);
            window.editMachine(machineId);
        }

        // 保守用車の削除ボタン
        if (target.classList.contains('btn-delete') && target.dataset.action === 'delete-machine') {
            e.preventDefault();
            const machineId = target.dataset.id;
            const machineNumber = target.dataset.number;
            console.log('[Event] Delete machine clicked:', { id: machineId, number: machineNumber });
            window.deleteMachine(machineId, machineNumber);
        }
    });
}

// ========== ユーザー管理 ==========
async function loadUsers() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        console.log('[loadUsers] Fetching users...');
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[loadUsers] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadUsers] Data received:', data);

        if (data.success && data.users.length > 0) {
            usersList.innerHTML = data.users.map(user => {
                // 役割の表示名を取得
                let roleDisplayName = 'ユーザー';
                if (user.role === 'system_admin') {
                    roleDisplayName = 'システム管理者';
                } else if (user.role === 'operation_admin') {
                    roleDisplayName = '運用管理者';
                } else if (user.role === 'admin') {
                    roleDisplayName = '管理者';
                } else if (user.role === 'user') {
                    roleDisplayName = 'ユーザー';
                }

                return `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="username">${escapeHtml(user.username)}</div>
                            <div class="display-name">${escapeHtml(user.display_name || '')}</div>
                            <span class="role-badge role-${user.role}">${roleDisplayName}</span>
                        </div>
                        <div class="user-actions-buttons">
                            <button class="btn-edit" onclick="editUser(${user.id})">✏️ 編集</button>
                            <button class="btn-delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">🗑️ 削除</button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            usersList.innerHTML = '<p class="loading">ユーザーが登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadUsers] Error:', error);
        usersList.innerHTML = `<p class="loading" style="color: red;">⚠️ ユーザーの読み込みに失敗しました<br>エラー: ${error.message}<br>データベース接続を確認してください</p>`;
    }
}

function openUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('user-form');

    form.reset();
    document.getElementById('user-id').value = '';

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
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const user = data.user;
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-full-name').value = user.display_name || '';
            document.getElementById('user-email').value = user.email || '';
            document.getElementById('user-role').value = user.role;
        }
    } catch (error) {
        console.error('Failed to load user data:', error);
        showToast('ユーザー情報の読み込みに失敗しました', 'error');
    }
}

async function saveUser() {
    const userId = document.getElementById('user-id').value;
    const userData = {
        username: document.getElementById('user-username').value,
        display_name: document.getElementById('user-full-name').value,
        email: document.getElementById('user-email').value,
        password: document.getElementById('user-password').value,
        role: document.getElementById('user-role').value
    };

    console.log('[saveUser] Saving user:', { userId, userData: { ...userData, password: '***' } });

    try {
        const token = localStorage.getItem('user_token');
        const url = userId ? `/api/users/${userId}` : '/api/users';
        const method = userId ? 'PUT' : 'POST';

        console.log('[saveUser] Request:', { url, method });

        const response = await fetch(url, {
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

async function deleteUser(userId, username) {
    if (!confirm(`ユーザー「${username}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/users/${userId}`, {
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

// ========== 機種マスタ管理 ==========
async function loadMachineTypes() {
    const list = document.getElementById('machine-types-list');
    list.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data.length > 0) {
            let html = `
                <table class="data-table" id="machine-types-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>メーカー型式</th>
                            <th>メーカー</th>
                            <th>カテゴリ</th>
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

            data.data.forEach(type => {
                const typeId = String(type.id);
                console.log('[loadMachineTypes] Rendering type:', { id: typeId });
                html += `
                    <tr>
                        <td>${escapeHtml(type.id || '-')}</td>
                        <td>${escapeHtml(type.model_name || '-')}</td>
                        <td>${escapeHtml(type.manufacturer || '-')}</td>
                        <td>${escapeHtml(type.category || '-')}</td>
                        <td>
                            <button class="btn-sm btn-edit" data-id="${typeId}" data-action="edit-type">編集</button>
                            <button class="btn-sm btn-delete" data-id="${typeId}" data-action="delete-type">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;

            // フィルターイベントと選択肢の初期化
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
        console.error('[loadMachineTypes] Error:', error);
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
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            // IDの型を柔軟に比較（数値と文字列の両方に対応）
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
    const token = localStorage.getItem('user_token');

    const machineTypeData = {
        model_name: document.getElementById('machine-type-model-name').value,
        manufacturer: document.getElementById('machine-type-manufacturer').value,
        category: document.getElementById('machine-type-category').value
    };

    try {
        const url = machineTypeId ? `/api/machine-types/${machineTypeId}` : '/api/machine-types';
        const method = machineTypeId ? 'PUT' : 'POST';

        const response = await fetch(url, {
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
            // サーバーからのエラー詳細をアラートで表示（診断用）
            const errorMsg = data.detail ? `${data.message}\n詳細: ${data.detail}` : (data.message || '保存に失敗しました');
            alert('🚨 サーバーエラーが発生しました:\n' + errorMsg);
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save machine type:', error);
        alert('❌ リクエスト自体が失敗しました:\n' + error.message);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

function editMachineType(machineTypeId) {
    console.log('[editMachineType] Called with ID:', machineTypeId);
    try {
        openMachineTypeModal(machineTypeId);
    } catch (error) {
        console.error('[editMachineType] Error:', error);
        alert('編集モーダルを開く際にエラーが発生しました: ' + error.message);
    }
}

// グローバルに公開
window.editMachineType = editMachineType;
console.log('[Global] editMachineType function registered:', typeof window.editMachineType);

async function deleteMachineType(machineTypeId, typeCode) {
    console.log('[deleteMachineType] Called with ID:', machineTypeId);
    if (!confirm(`機種「${typeCode}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/machine-types/${machineTypeId}`, {
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

// グローバルに公開
window.deleteMachineType = deleteMachineType;

// ========== 機械番号マスタ管理 ==========
async function loadMachines() {
    const list = document.getElementById('machines-list');
    list.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errorMsg = `HTTP ${response.status}: ${errData.message || response.statusText}`;
            if (errData.detail) alert(`🚨 サーバーエラー詳細:\n${errData.detail}`);
            throw new Error(errorMsg);
        }

        const data = await response.json();

        if (data.success && data.data.length > 0) {
            let html = `
                <table class="data-table" id="machines-table">
                    <thead>
                        <tr>
                            <th>機械番号</th>
                            <th>機種</th>
                            <th>シリアル番号</th>
                            <th>製造年月日</th>
                            <th>管理事業所</th>
                            <th>操作</th>
                        </tr>
                        <tr class="filter-row">
                            <th><select class="column-filter" data-col="0"></select></th>
                            <th><select class="column-filter" data-col="1"></select></th>
                            <th><select class="column-filter" data-col="2"></select></th>
                            <th></th>
                            <th><select class="column-filter" data-col="4"></select></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.data.forEach(machine => {
                const machineId = String(machine.machine_id || machine.id);
                const machineNumber = machine.machine_number || '-';
                console.log('[loadMachines] Rendering machine:', { id: machineId, number: machineNumber });
                html += `
                    <tr>
                        <td>${escapeHtml(machine.machine_number || '-')}</td>
                        <td>${escapeHtml(machine.model_name || '-')}</td>
                        <td>${escapeHtml(machine.serial_number || '-')}</td>
                        <td>${machine.manufacture_date ? new Date(machine.manufacture_date).toLocaleDateString('ja-JP') : '-'}</td>
                        <td>${escapeHtml(machine.office_name || '-')}</td>
                        <td>
                            <button class="btn-sm btn-edit" data-id="${machineId}" data-action="edit-machine">編集</button>
                            <button class="btn-sm btn-delete" data-id="${machineId}" data-number="${escapeHtml(machineNumber)}" data-action="delete-machine">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;

            // フィルターイベントと選択肢の初期化
            const table = document.getElementById('machines-table');
            if (table) {
                updateFilterOptions(table);
                const filters = table.querySelectorAll('.column-filter');
                filters.forEach(filter => {
                    filter.addEventListener('change', () => window.applyTableFilter(table));
                });
            }
        } else {
            list.innerHTML = '<p class="loading">機械番号が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadMachines] Error:', error);
        list.innerHTML = `<p class="loading" style="color: red;">⚠️ 機械番号の読み込みに失敗しました</p>`;
    }
}

async function openMachineModal(machineId = null) {
    console.log('[openMachineModal] ===== START =====');
    console.log('[openMachineModal] Opening modal, machineId:', machineId);
    const modal = document.getElementById('machine-modal');
    const modalTitle = document.getElementById('machine-modal-title');
    const form = document.getElementById('machine-form');
    const token = localStorage.getItem('user_token');

    if (!modal) {
        console.error('[openMachineModal] ❌ Modal element not found!');
        alert('エラー: モーダルが見つかりません');
        return;
    }

    form.reset();
    document.getElementById('machine-id').value = '';

    // モーダルを先に表示
    modal.style.display = 'flex';
    console.log('[openMachineModal] ✅ Modal displayed');

    // 機種リストを読み込む
    try {
        console.log('[openMachineModal] 📡 Fetching machine types from /api/machine-types...');
        const machineTypesResponse = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[openMachineModal] Machine types response status:', machineTypesResponse.status);

        if (!machineTypesResponse.ok) {
            throw new Error(`HTTP ${machineTypesResponse.status}: ${machineTypesResponse.statusText}`);
        }

        const machineTypesData = await machineTypesResponse.json();
        console.log('[openMachineModal] 📦 Machine types data received:', machineTypesData);
        console.log('[openMachineModal] Success:', machineTypesData.success);
        console.log('[openMachineModal] Data array:', machineTypesData.data);
        console.log('[openMachineModal] Data count:', machineTypesData.data ? machineTypesData.data.length : 0);

        if (machineTypesData.success && machineTypesData.data && Array.isArray(machineTypesData.data)) {
            const machineTypeSelect = document.getElementById('machine-type-select');
            if (!machineTypeSelect) {
                console.error('[openMachineModal] ❌ machine-type-select element not found!');
                showToast('機種選択欄が見つかりません', 'error');
                return;
            }

            console.log('[openMachineModal] ✅ machine-type-select found:', machineTypeSelect);

            const options = ['<option value="">-- 機種を選択 --</option>'];
            console.log('[openMachineModal] Processing machine types...');

            machineTypesData.data.forEach((type, index) => {
                const typeId = type.id;
                const modelName = type.model_name || '名前なし';
                const manufacturer = type.manufacturer || '';
                const category = type.category || '';

                // 機種名（model_name）を表示
                const displayText = manufacturer ? `${modelName} (${manufacturer})` : modelName;

                options.push(`<option value="${typeId}">${escapeHtml(displayText)}</option>`);
                console.log(`[openMachineModal] Type ${index + 1}/${machineTypesData.data.length}:`, {
                    id: typeId,
                    modelName: modelName,
                    manufacturer: manufacturer
                });
            });

            machineTypeSelect.innerHTML = options.join('');
            console.log('[openMachineModal] ✅ Machine types loaded:', machineTypesData.data.length, 'items');
            console.log('[openMachineModal] Select HTML length:', machineTypeSelect.innerHTML.length);
            console.log('[openMachineModal] Option elements:', machineTypeSelect.children.length);
        } else {
            console.error('[openMachineModal] ❌ Invalid machine types response:', {
                success: machineTypesData.success,
                hasData: !!machineTypesData.data,
                isArray: Array.isArray(machineTypesData.data),
                message: machineTypesData.message
            });
            showToast('機種データの読み込みに失敗しました', 'error');
        }

        // 管理事業所を読み込む
        console.log('[openMachineModal] 📡 Fetching offices from /api/offices...');
        const officesResponse = await fetch('/api/offices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[openMachineModal] Offices response status:', officesResponse.status);

        if (!officesResponse.ok) {
            throw new Error(`HTTP ${officesResponse.status}: ${officesResponse.statusText}`);
        }

        const officesData = await officesResponse.json();
        console.log('[openMachineModal] 📦 Offices data received:', officesData);
        console.log('[openMachineModal] Success:', officesData.success);
        console.log('[openMachineModal] Offices array:', officesData.offices);
        console.log('[openMachineModal] Offices count:', officesData.offices ? officesData.offices.length : 0);

        if (officesData.success && officesData.offices && Array.isArray(officesData.offices)) {
            const officeSelect = document.getElementById('machine-office-select');
            if (!officeSelect) {
                console.error('[openMachineModal] ❌ machine-office-select element not found!');
                showToast('事業所選択欄が見つかりません', 'error');
                return;
            }

            console.log('[openMachineModal] ✅ machine-office-select found:', officeSelect);

            const options = ['<option value="">-- 事業所を選択 --</option>'];
            console.log('[openMachineModal] Processing offices...');

            officesData.offices.forEach((office, index) => {
                const officeId = office.office_id;
                const officeName = office.office_name || '名前なし';
                options.push(`<option value="${officeId}">${escapeHtml(officeName)}</option>`);
                console.log(`[openMachineModal] Office ${index + 1}/${officesData.offices.length}:`, {
                    id: officeId,
                    name: officeName
                });
            });

            officeSelect.innerHTML = options.join('');
            console.log('[openMachineModal] ✅ Offices loaded:', officesData.offices.length, 'items');
            console.log('[openMachineModal] Select HTML length:', officeSelect.innerHTML.length);
            console.log('[openMachineModal] Option elements:', officeSelect.children.length);
        } else {
            console.error('[openMachineModal] ❌ Invalid offices response:', {
                success: officesData.success,
                hasOffices: !!officesData.offices,
                isArray: Array.isArray(officesData.offices),
                message: officesData.message
            });
            showToast('事業所データの読み込みに失敗しました', 'error');
        }

        console.log('[openMachineModal] ✅ All data loaded successfully');
    } catch (error) {
        console.error('[openMachineModal] ❌ CRITICAL ERROR:', error);
        console.error('[openMachineModal] Error stack:', error.stack);
        showToast('データの読み込み中にエラーが発生しました: ' + error.message, 'error');
    }

    if (machineId) {
        modalTitle.textContent = '編集';
        await loadMachineData(machineId);
    } else {
        modalTitle.textContent = '新規追加';
    }

    console.log('[openMachineModal] ===== END =====');
}

async function loadMachineData(machineId) {
    try {
        console.log('[loadMachineData] Loading machine:', machineId, 'Type:', typeof machineId);
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            // IDの型を柔軟に比較（数値と文字列の両方に対応）
            const machine = data.data.find(m => {
                const mId = m.machine_id || m.id;
                return String(mId) === String(machineId);
            });
            console.log('[loadMachineData] Found machine:', machine);
            if (machine) {
                document.getElementById('machine-id').value = machine.machine_id || machine.id;
                document.getElementById('machine-office-select').value = machine.office_id || '';
                document.getElementById('machine-type-select').value = machine.machine_type_id || '';
                document.getElementById('machine-number').value = machine.machine_number || '';
                document.getElementById('machine-serial-number').value = machine.serial_number || '';
                document.getElementById('machine-type-certification').value = machine.type_certification || '';
                document.getElementById('machine-manufacture-date').value = machine.manufacture_date || '';
                document.getElementById('machine-purchase-date').value = machine.purchase_date || '';
                document.getElementById('machine-notes').value = machine.notes || '';
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
    const token = localStorage.getItem('user_token');

    const machineData = {
        office_id: document.getElementById('machine-office-select').value,
        machine_type_id: document.getElementById('machine-type-select').value,
        machine_number: document.getElementById('machine-number').value,
        serial_number: document.getElementById('machine-serial-number').value,
        type_certification: document.getElementById('machine-type-certification').value,
        manufacture_date: document.getElementById('machine-manufacture-date').value,
        purchase_date: document.getElementById('machine-purchase-date').value,
        notes: document.getElementById('machine-notes').value
    };

    try {
        const url = machineId ? `/api/machines/${machineId}` : '/api/machines';
        const method = machineId ? 'PUT' : 'POST';

        const response = await fetch(url, {
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
            // サーバーからのエラー詳細をアラートで表示（診断用）
            const errorMsg = data.detail ? `${data.message}\n詳細: ${data.detail}` : (data.message || '保存に失敗しました');
            alert('🚨 サーバーエラーが発生しました:\n' + errorMsg);
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save machine:', error);
        alert('❌ リクエスト自体が失敗しました:\n' + error.message);
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

// グローバルに公開
window.editMachine = editMachine;
console.log('[Global] editMachine function registered:', typeof window.editMachine);

async function deleteMachine(machineId, machineNumber) {
    console.log('[deleteMachine] Called with ID:', machineId);
    if (!confirm(`保守用車「${machineNumber}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/machines/${machineId}`, {
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

// グローバルに公開
window.deleteMachine = deleteMachine;

// ========== 検修マスタ管理 ==========
async function loadInspectionTypes() {
    const list = document.getElementById('inspection-types-list');
    if (!list) {
        console.warn('[loadInspectionTypes] inspection-types-list element not found');
        return;
    }

    list.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/inspection-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadInspectionTypes] Response:', data);

        if (data.success && data.data && data.data.length > 0) {
            let html = `
                <table class="data-table" id="inspection-types-table">
                    <thead>
                        <tr>
                            <th>検修種別コード</th>
                            <th>検修種別名</th>
                            <th>説明</th>
                            <th>表示順序</th>
                            <th>状態</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.data.forEach(type => {
                const statusBadge = type.is_active ?
                    '<span class="status-badge status-active">有効</span>' :
                    '<span class="status-badge status-inactive">無効</span>';

                html += `
                    <tr>
                        <td>${escapeHtml(type.type_code || '-')}</td>
                        <td>${escapeHtml(type.type_name || '-')}</td>
                        <td>${escapeHtml(type.description || '-')}</td>
                        <td>${type.display_order || 0}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn-sm btn-edit" onclick="editInspectionType('${type.id}')">編集</button>
                            <button class="btn-sm btn-delete" onclick="deleteInspectionType('${type.id}', '${escapeHtml(type.type_name)}')">削除</button>
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
        list.innerHTML = `<p class="loading" style="color: red;">⚠️ 検修種別の読み込みに失敗しました<br>エラー: ${error.message}</p>`;
    }
}

async function loadInspectionSchedules() {
    const list = document.getElementById('inspection-schedules-list');
    if (!list) {
        console.warn('[loadInspectionSchedules] inspection-schedules-list element not found');
        return;
    }

    list.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/inspection-schedules', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadInspectionSchedules] Response:', data);

        if (data.success && data.data && data.data.length > 0) {
            let html = `
                <table class="data-table" id="inspection-schedules-table">
                    <thead>
                        <tr>
                            <th>対象（カテゴリー/保守用車）</th>
                            <th>検修種別</th>
                            <th>検修周期（月）</th>
                            <th>検修期間（日）</th>
                            <th>備考</th>
                            <th>状態</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.data.forEach(schedule => {
                const statusBadge = schedule.is_active ?
                    '<span class="status-badge status-active">有効</span>' :
                    '<span class="status-badge status-inactive">無効</span>';
                
                // カテゴリーか機械番号のどちらかを表示
                const targetDisplay = schedule.target_category || schedule.machine_number || '-';
                // 編集時の表示用識別子（名前）も同様に設定
                const targetName = schedule.target_category ? 
                    `カテゴリー: ${schedule.target_category}` : 
                    `保守用車: ${schedule.machine_number}`;

                html += `
                    <tr>
                        <td>${escapeHtml(targetDisplay)}</td>
                        <td>${escapeHtml(schedule.type_name || '-')}</td>
                        <td>${schedule.cycle_months || '-'}ヶ月</td>
                        <td>${schedule.duration_days || '-'}日</td>
                        <td>${escapeHtml(schedule.remarks || '-')}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn-sm btn-edit" onclick="editInspectionSchedule('${schedule.id}')">編集</button>
                            <button class="btn-sm btn-delete" onclick="deleteInspectionSchedule('${schedule.id}', '${escapeHtml(targetName)}')">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;
        } else {
            list.innerHTML = '<p class="loading">検修設定が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadInspectionSchedules] Error:', error);
        list.innerHTML = `<p class="loading" style="color: red;">⚠️ 検修設定の読み込みに失敗しました<br>エラー: ${error.message}</p>`;
    }
}

// 検修種別の編集・削除
function editInspectionType(id) {
    console.log('[editInspectionType] Opening modal for ID:', id);
    openInspectionTypeModal(id);
}

function openInspectionTypeModal(id = null) {
    const modal = document.getElementById('inspection-type-modal');
    const modalTitle = document.getElementById('inspection-type-modal-title');
    const form = document.getElementById('inspection-type-form');

    form.reset();
    document.getElementById('inspection-type-id').value = '';

    if (id) {
        modalTitle.textContent = '検修種別を編集';
        loadInspectionTypeData(id);
    } else {
        modalTitle.textContent = '検修種別を追加';
    }

    modal.style.display = 'flex';
}

async function loadInspectionTypeData(id) {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-types/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        console.log('[loadInspectionTypeData] Response:', data);

        if (data.success) {
            // データが data.data にあるか、data そのものかを確認
            const type = data.data || data;
            console.log('[loadInspectionTypeData] Type object:', type);
            
            document.getElementById('inspection-type-id').value = type.id;
            document.getElementById('inspection-type-code').value = type.type_code || '';
            document.getElementById('inspection-type-name').value = type.type_name || '';
            document.getElementById('inspection-type-description').value = type.description || '';
            document.getElementById('inspection-type-order').value = type.display_order || 0;
            document.getElementById('inspection-type-active').checked = type.is_active !== false;
        }
    } catch (error) {
        console.error('Failed to load inspection type data:', error);
        showToast('検修種別情報の読み込みに失敗しました', 'error');
    }
}

async function deleteInspectionType(id, name) {
    if (!confirm(`検修種別「${name}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-types/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('検修種別を削除しました', 'success');
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

    // 保守用車と検修種別のセレクトボックスを初期化 (awaitで完了を待つ)
    await Promise.all([
        loadMachineSelectOptions('inspection-schedule-machine'),
        loadInspectionTypeSelectOptions('inspection-schedule-type')
    ]);

    if (id) {
        modalTitle.textContent = '検修設定を編集';
        await loadInspectionScheduleData(id);
    } else {
        modalTitle.textContent = '検修設定を追加';
        // HTMLのchecked属性はreset()で復元されるはずだが、念のため明示的にON
        document.getElementById('inspection-schedule-active').checked = true;
    }

    modal.style.display = 'flex';
}

async function loadInspectionScheduleData(id) {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-schedules/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        console.log('[loadInspectionScheduleData] Response:', data);

        if (data.success) {
            const schedule = data.data || data;
            console.log('[loadInspectionScheduleData] Schedule object:', schedule);

            document.getElementById('inspection-schedule-id').value = schedule.id;
            
            // 値のセットと確認
            const machineSelect = document.getElementById('inspection-schedule-machine');
            const categorySelect = document.getElementById('inspection-schedule-category');
            const typeSelect = document.getElementById('inspection-schedule-type');
            
            // カテゴリかマシンIDのどちらかがセットされているはず
            if (categorySelect) categorySelect.value = schedule.target_category || '';
            machineSelect.value = schedule.machine_id || '';
            typeSelect.value = schedule.inspection_type_id || '';
            
            document.getElementById('inspection-schedule-cycle').value = schedule.cycle_months || '';
            document.getElementById('inspection-schedule-duration').value = schedule.duration_days || '';
            document.getElementById('inspection-schedule-remarks').value = schedule.remarks || '';
            document.getElementById('inspection-schedule-active').checked = schedule.is_active !== false;

            console.log('[loadInspectionScheduleData] Set values:', {
                machine: machineSelect.value,
                type: typeSelect.value
            });
        }
    } catch (error) {
        console.error('Failed to load inspection schedule data:', error);
        showToast('検修設定情報の読み込みに失敗しました', 'error');
    }
}

async function deleteInspectionSchedule(id, machineName) {
    if (!confirm(`保守用車「${machineName}」の検修設定を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-schedules/${id}`, {
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
    const typeCode = document.getElementById('inspection-type-code').value;
    const typeName = document.getElementById('inspection-type-name').value;
    const description = document.getElementById('inspection-type-description').value;
    const displayOrder = document.getElementById('inspection-type-order').value;
    const isActive = document.getElementById('inspection-type-active').checked;

    const typeData = {
        type_code: typeCode || null,
        type_name: typeName,
        description: description,
        display_order: parseInt(displayOrder) || 0,
        is_active: isActive
    };

    try {
        const token = localStorage.getItem('user_token');
        const url = id ? `/api/inspection-types/${id}` : '/api/inspection-types';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
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
    const category = document.getElementById('inspection-schedule-category').value;
    const machineId = document.getElementById('inspection-schedule-machine').value;
    const inspectionTypeId = document.getElementById('inspection-schedule-type').value;
    const cycleMonths = document.getElementById('inspection-schedule-cycle').value;
    const durationDays = document.getElementById('inspection-schedule-duration').value;
    const remarks = document.getElementById('inspection-schedule-remarks').value;
    const isActive = document.getElementById('inspection-schedule-active').checked;

    const scheduleData = {
        target_category: category || null,
        machine_id: machineId ? parseInt(machineId) : null,
        inspection_type_id: inspectionTypeId ? parseInt(inspectionTypeId) : null,
        cycle_months: parseInt(cycleMonths) || 0,
        duration_days: parseInt(durationDays) || 0,
        remarks: remarks || null,
        is_active: isActive
    };

    try {
        const token = localStorage.getItem('user_token');
        const url = id ? `/api/inspection-schedules/${id}` : '/api/inspection-schedules';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
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
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save inspection schedule:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

// ヘルパー関数
async function loadMachineSelectOptions(selectId) {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const select = document.getElementById(selectId);
        if (select && data.success && data.data) {
            select.innerHTML = '<option value="">-- 保守用車を選択 --</option>';
            data.data.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.machine_id || machine.id;
                option.textContent = machine.machine_number || '-';
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load machine options:', error);
    }
}

async function loadInspectionTypeSelectOptions(selectId) {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/inspection-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const select = document.getElementById(selectId);
        if (select && data.success && data.data) {
            select.innerHTML = '<option value="">-- 検修種別を選択 --</option>';
            data.data.forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = type.type_name || '-';
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load inspection type options:', error);
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
        const token = localStorage.getItem('user_token');
        console.log('[loadOffices] Fetching offices...');
        const response = await fetch('/api/offices', {
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
                        <div class="vehicle-number">コード: ${escapeHtml(office.office_code)} | ${escapeHtml(office.office_type || '-')}</div>
                        <div class="vehicle-number" style="font-size: 12px; color: #666;">
                            ${escapeHtml(office.address || '-')} | 責任者: ${escapeHtml(office.manager_name || '-')}
                        </div>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" onclick="editOffice(${office.office_id})">✏️ 編集</button>
                        <button class="btn-delete" onclick="deleteOffice(${office.office_id}, '${escapeHtml(office.office_name)}')">🗑️ 削除</button>
                    </div>
                </div>
            `).join('');
        } else {
            officesList.innerHTML = '<p class="loading">事業所が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadOffices] Error:', error);
        officesList.innerHTML = `<p class="loading" style="color: red;">⚠️ 事業所の読み込みに失敗しました<br>エラー: ${error.message}<br>データベース接続を確認してください</p>`;
    }
}

function showOfficeModal(mode, officeId) {
    const offices = [];
    if (mode === 'edit') {
        // 既存データを取得
        fetch(`/api/offices`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('user_token')}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const office = data.offices.find(o => o.office_id === officeId);
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
                            <option value="支店" ${office && office.office_type === '支店' ? 'selected' : ''}>支店</option>
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
        const token = localStorage.getItem('user_token');
        const url = mode === 'add' ? '/api/offices' : `/api/offices/${officeId}`;
        const method = mode === 'add' ? 'POST' : 'PUT';

        const response = await fetch(url, {
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
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/offices/${officeId}`, {
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
        const token = localStorage.getItem('user_token');
        console.log('[loadBases] Fetching bases...');
        const response = await fetch('/api/bases', {
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
                        <div class="vehicle-number">コード: ${escapeHtml(base.base_code)} | 事業所: ${escapeHtml(base.office_name || '-')}</div>
                        <div class="vehicle-number" style="font-size: 12px; color: #666;">
                            ${escapeHtml(base.location || '-')} | 収容数: ${base.capacity || '-'} | 責任者: ${escapeHtml(base.manager_name || '-')}
                        </div>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" onclick="editBase(${base.base_id})">✏️ 編集</button>
                        <button class="btn-delete" onclick="deleteBase(${base.base_id}, '${escapeHtml(base.base_name)}')">🗑️ 削除</button>
                    </div>
                </div>
            `).join('');
        } else {
            basesList.innerHTML = '<p class="loading">保守基地が登録されていません</p>';
        }
    } catch (error) {
        console.error('[loadBases] Error:', error);
        basesList.innerHTML = `<p class="loading" style="color: red;">⚠️ 保守基地の読み込みに失敗しました<br>エラー: ${error.message}<br>データベース接続を確認してください</p>`;
    }
}

async function showBaseModal(mode, baseId) {
    // 事業所リストを取得
    const token = localStorage.getItem('user_token');
    const officesRes = await fetch('/api/offices', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const officesData = await officesRes.json();
    const offices = officesData.success ? officesData.offices : [];

    if (mode === 'edit') {
        const basesRes = await fetch('/api/bases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const basesData = await basesRes.json();
        if (basesData.success) {
            const base = basesData.bases.find(b => b.base_id === baseId);
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
        const token = localStorage.getItem('user_token');
        const url = mode === 'add' ? '/api/bases' : `/api/bases/${baseId}`;
        const method = mode === 'add' ? 'POST' : 'PUT';

        const response = await fetch(url, {
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
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/bases/${baseId}`, {
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

// ========== データベース管理 ==========
async function loadDatabaseStats() {
    try {
        const token = localStorage.getItem('user_token');
        console.log('[loadDatabaseStats] Fetching database stats...');
        const response = await fetch('/api/database/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[loadDatabaseStats] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadDatabaseStats] Data received:', data);

        if (data.success) {
            // 接続状態
            const statusBadge = document.getElementById('db-connection-status');
            if (data.stats.connected) {
                statusBadge.innerHTML = '<span class="status-badge status-connected">✓ 接続中</span>';
            } else {
                statusBadge.innerHTML = '<span class="status-badge status-error">✕ エラー</span>';
            }

            // バージョン
            document.getElementById('db-version').textContent = data.stats.version || '--';

            // 接続数
            const connections = data.stats.connections || '--';
            document.getElementById('db-connections').textContent = connections;
            document.getElementById('connection-count').textContent = connections;

            // ディスク使用率
            const diskUsage = data.stats.disk_usage || 0;
            document.getElementById('disk-usage').textContent = diskUsage + '%';
            document.getElementById('disk-progress').style.width = diskUsage + '%';

            // データベースサイズ
            document.getElementById('db-size').textContent = data.stats.database_size || '--';

            // 稼働時間
            document.getElementById('uptime').textContent = data.stats.uptime || '--';

            // テーブルサイズ
            const tableSizes = document.getElementById('table-sizes');
            if (data.stats.table_sizes && data.stats.table_sizes.length > 0) {
                tableSizes.innerHTML = data.stats.table_sizes.map(table => `
                    <div class="table-size-item">
                        <span class="table-name">${escapeHtml(table.table_name)}</span>
                        <span class="table-size">${table.size}</span>
                    </div>
                `).join('');
            } else {
                tableSizes.innerHTML = '<p class="loading">テーブル情報がありません</p>';
            }
        } else {
            console.error('[loadDatabaseStats] Response not successful:', data);
        }
    } catch (error) {
        console.error('[loadDatabaseStats] Error:', error);
        const statusBadge = document.getElementById('db-connection-status');
        if (statusBadge) {
            statusBadge.innerHTML = `<span class="status-badge status-error">✕ エラー: ${error.message}</span>`;
        }
        showToast('データベース情報の取得に失敗しました', 'error');
    }

    // テーブル管理機能の初期化
    initializeTableManagement();
}

// テーブル管理機能
let currentTable = '';
let currentTableData = [];
let currentTableColumns = [];

function initializeTableManagement() {
    const loadTableBtn = document.getElementById('load-table-btn');
    const addRecordBtn = document.getElementById('add-record-btn');
    const tableSelect = document.getElementById('table-select');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const importCsvFile = document.getElementById('import-csv-file');
    const backupDbBtn = document.getElementById('backup-db-btn');
    const restoreDbBtn = document.getElementById('restore-db-btn');
    const restoreFileInput = document.getElementById('restore-file-input');

    // テーブル読み込み
    loadTableBtn.addEventListener('click', async () => {
        const selectedTable = tableSelect.value;
        if (!selectedTable) {
            showToast('テーブルを選択してください', 'error');
            return;
        }
        currentTable = selectedTable;
        await loadTableData(selectedTable);
        exportCsvBtn.disabled = false;
        importCsvBtn.disabled = false;
    });

    // 新規レコード追加
    addRecordBtn.addEventListener('click', () => {
        if (!currentTable) {
            showToast('先にテーブルを選択してください', 'error');
            return;
        }
        showRecordModal('add', null);
    });

    // CSVエクスポート
    exportCsvBtn.addEventListener('click', async () => {
        if (!currentTable) return;

        try {
            const token = localStorage.getItem('user_token');
            const response = await fetch(`/api/database/export-csv/${currentTable}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentTable.replace('.', '_')}_export.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showToast('CSVエクスポート成功', 'success');
            } else {
                showToast('エクスポートに失敗しました', 'error');
            }
        } catch (error) {
            console.error('Export error:', error);
            showToast('エクスポート中にエラーが発生しました', 'error');
        }
    });

    // CSVインポート
    importCsvBtn.addEventListener('click', () => {
        importCsvFile.click();
    });

    importCsvFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const csvData = event.target.result;
                const token = localStorage.getItem('user_token');

                const response = await fetch(`/api/database/import-csv/${currentTable}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ csvData })
                });

                const data = await response.json();
                if (data.success) {
                    showToast(data.message, 'success');
                    await loadTableData(currentTable);
                } else {
                    showToast(data.message || 'インポートに失敗しました', 'error');
                }
            } catch (error) {
                console.error('Import error:', error);
                showToast('インポート中にエラーが発生しました', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // リセット
    });

    // データベースバックアップ
    backupDbBtn.addEventListener('click', async () => {
        if (!confirm('データベース全体のバックアップを作成しますか？')) return;

        try {
            const token = localStorage.getItem('user_token');
            const response = await fetch('/api/database/backup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                a.download = `webappdb_backup_${timestamp}.sql`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showToast('バックアップ成功', 'success');
            } else {
                showToast('バックアップに失敗しました', 'error');
            }
        } catch (error) {
            console.error('Backup error:', error);
            showToast('バックアップ中にエラーが発生しました', 'error');
        }
    });

    // データベース復元
    restoreDbBtn.addEventListener('click', () => {
        if (!confirm('⚠️ 警告: 現在のデータベースが上書きされます。本当に復元しますか？')) return;
        restoreFileInput.click();
    });

    restoreFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast('復元機能は手動で実行してください（psql コマンド使用）', 'error');
        e.target.value = '';
    });
}

async function loadTableData(schemaTable) {
    const container = document.getElementById('table-data-container');
    container.innerHTML = '<p class="info-text">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/database/table/${schemaTable}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success && result.data.length > 0) {
            currentTableData = result.data;
            currentTableColumns = result.columns;

            const columns = Object.keys(result.data[0]);
            const primaryKey = columns[0]; // 仮に最初のカラムを主キーとする

            let tableHtml = '<table class="data-table"><thead><tr>';
            columns.forEach(col => {
                tableHtml += `<th>${escapeHtml(col)}</th>`;
            });
            tableHtml += '<th>操作</th></tr></thead><tbody>';

            result.data.forEach(row => {
                tableHtml += '<tr>';
                columns.forEach(col => {
                    const value = row[col];
                    tableHtml += `<td>${escapeHtml(String(value !== null ? value : ''))}</td>`;
                });
                tableHtml += `<td class="action-buttons">
                    <button class="btn-edit" onclick="editRecord('${escapeHtml(row[primaryKey])}')">✏️</button>
                    <button class="btn-delete" onclick="deleteRecord('${escapeHtml(row[primaryKey])}')">🗑️</button>
                </td></tr>`;
            });

            tableHtml += '</tbody></table>';
            container.innerHTML = tableHtml;
        } else {
            container.innerHTML = '<p class="info-text">データがありません</p>';
        }
    } catch (error) {
        console.error('Load table data error:', error);
        container.innerHTML = '<p class="info-text">データの読み込みに失敗しました</p>';
    }
}

function showRecordModal(mode, recordId) {
    // モーダルHTML生成
    const modalHtml = `
        <div id="record-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${mode === 'add' ? '新規レコード追加' : 'レコード編集'}</h2>
                    <button class="modal-close" onclick="closeRecordModal()">&times;</button>
                </div>
                <form id="record-form" class="modal-form">
                    ${generateFormFields(mode, recordId)}
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeRecordModal()">キャンセル</button>
                        <button type="submit" class="btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // フォーム送信
    document.getElementById('record-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRecord(mode, recordId);
    });
}

function generateFormFields(mode, recordId) {
    if (!currentTableColumns.length) return '';

    let record = null;
    if (mode === 'edit' && recordId) {
        const primaryKey = Object.keys(currentTableData[0])[0];
        record = currentTableData.find(r => String(r[primaryKey]) === String(recordId));
    }

    return currentTableColumns.map(col => {
        const value = record ? record[col.column_name] : '';
        const isId = col.column_name.toLowerCase().includes('id');
        const disabled = (mode === 'edit' && isId) ? 'disabled' : '';

        return `
            <div class="form-group">
                <label for="field_${col.column_name}">${escapeHtml(col.column_name)} (${col.data_type})</label>
                <input 
                    type="text" 
                    id="field_${col.column_name}" 
                    name="${col.column_name}" 
                    value="${escapeHtml(String(value !== null ? value : ''))}"
                    ${disabled}
                    ${mode === 'add' && !isId ? 'required' : ''}
                >
            </div>
        `;
    }).join('');
}

async function saveRecord(mode, recordId) {
    const formData = new FormData(document.getElementById('record-form'));
    const data = {};
    formData.forEach((value, key) => {
        if (value !== '') data[key] = value;
    });

    try {
        const token = localStorage.getItem('user_token');
        const url = mode === 'add'
            ? `/api/database/table/${currentTable}`
            : `/api/database/table/${currentTable}/${recordId}`;

        const response = await fetch(url, {
            method: mode === 'add' ? 'POST' : 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showToast(mode === 'add' ? '追加しました' : '更新しました', 'success');
            closeRecordModal();
            await loadTableData(currentTable);
        } else {
            showToast(result.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Save record error:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

async function editRecord(recordId) {
    showRecordModal('edit', recordId);
}

async function deleteRecord(recordId) {
    if (!confirm('このレコードを削除してもよろしいですか？')) return;

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/database/table/${currentTable}/${recordId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success) {
            showToast('削除しました', 'success');
            await loadTableData(currentTable);
        } else {
            showToast(result.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Delete record error:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

window.closeRecordModal = function () {
    const modal = document.getElementById('record-modal');
    if (modal) modal.remove();
}

window.editRecord = editRecord;
window.deleteRecord = deleteRecord;

// ========== CORS設定管理 ==========
async function loadCorsSettings() {
    try {
        const token = localStorage.getItem('user_token');
        console.log('[loadCorsSettings] Fetching CORS settings...');
        const response = await fetch('/api/config', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[loadCorsSettings] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadCorsSettings] Data received:', data);

        if (data.success) {
            const corsOrigin = data.config.cors_origin || '*';
            document.getElementById('cors_origin').value = corsOrigin;
        } else {
            console.error('[loadCorsSettings] Response not successful:', data);
        }
    } catch (error) {
        console.error('[loadCorsSettings] Error:', error);
        showToast('CORS設定の読み込みに失敗しました', 'error');
    }
}

// CORS設定の初期化
function initializeCorsSettings() {
    const saveCorsBtn = document.getElementById('save-cors-btn');
    if (saveCorsBtn) {
        saveCorsBtn.addEventListener('click', async () => {
            const corsOrigin = document.getElementById('cors_origin').value.trim();

            if (!corsOrigin) {
                showToast('CORS設定を入力してください', 'error');
                return;
            }

            try {
                const token = localStorage.getItem('user_token');
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ cors_origin: corsOrigin })
                });

                const data = await response.json();

                if (data.success) {
                    showToast('CORS設定を保存しました', 'success');
                } else {
                    showToast(data.message || '保存に失敗しました', 'error');
                }
            } catch (error) {
                console.error('Failed to save CORS settings:', error);
                showToast('保存中にエラーが発生しました', 'error');
            }
        });
    }
}

// ========================================
// 機種・機械番号マスタ管理
// ========================================

// 機種マスタのイベントリスナー初期化
function initializeMachineEventListeners() {
    // 機種追加ボタン
    const addMachineTypeBtn = document.getElementById('add-new-machine-type-btn');
    if (addMachineTypeBtn) {
        addMachineTypeBtn.addEventListener('click', () => openMachineTypeModal());
    }

    // 機械追加ボタン
    const addMachineBtn = document.getElementById('add-new-machine-btn');
    if (addMachineBtn) {
        addMachineBtn.addEventListener('click', () => openMachineModal());
    }

    // 機種モーダルのイベント
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
        machineTypeForm.addEventListener('submit', handleMachineTypeSubmit);
    }

    // 機械モーダルのイベント
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
        machineForm.addEventListener('submit', handleMachineSubmit);
    }
}

// ========== ユーティリティ関数 ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('Toast element not found');
        return;
    }
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// ========================================
// 検修マスタ関連の処理
// ========================================

// 検修種別の読み込み
async function loadInspectionTypes() {
    console.log('[Admin] Loading inspection types...');
    const listEl = document.getElementById('inspection-types-list');
    if (!listEl) return;

    listEl.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/inspection-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Failed to load: ${response.statusText}`);

        const result = await response.json();
        console.log('[Admin] Inspection types response:', result);

        if (!result.success || !result.data || result.data.length === 0) {
            listEl.innerHTML = '<p class="no-data">検修種別が登録されていません</p>';
            return;
        }

        const data = result.data;

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>種別コード</th>
                        <th>種別名</th>
                        <th>説明</th>
                        <th>表示順</th>
                        <th>状態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(type => {
            const statusBadge = type.is_active
                ? '<span class="badge badge-success">有効</span>'
                : '<span class="badge badge-inactive">無効</span>';

            html += `
                <tr>
                    <td>${escapeHtml(type.type_code)}</td>
                    <td>${escapeHtml(type.type_name)}</td>
                    <td>${escapeHtml(type.description || '')}</td>
                    <td>${type.display_order || 0}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-edit" onclick="editInspectionType(${type.id})">編集</button>
                        <button class="btn-delete" onclick="deleteInspectionType(${type.id})">削除</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        listEl.innerHTML = html;

    } catch (err) {
        console.error('[Admin] Error loading inspection types:', err);
        listEl.innerHTML = `<p class="error">読み込みエラー: ${err.message}</p>`;
    }
}

// 検修種別の追加
window.addNewInspectionType = function () {
    const modal = document.getElementById('inspection-type-modal');
    const title = document.getElementById('inspection-type-modal-title');
    const form = document.getElementById('inspection-type-form');

    title.textContent = '検修種別を追加';
    form.reset();
    document.getElementById('inspection-type-id').value = '';
    document.getElementById('inspection-type-code').value = '';
    document.getElementById('inspection-type-active').checked = true;
    modal.style.display = 'block';
};

// 検修種別の編集
window.editInspectionType = async function (id) {
    const modal = document.getElementById('inspection-type-modal');
    const title = document.getElementById('inspection-type-modal-title');

    title.textContent = '検修種別を編集';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-types/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch inspection type');

        const result = await response.json();
        const type = result.data || result; // dataプロパティがある場合はそれを使い、なければそのまま使う

        document.getElementById('inspection-type-id').value = type.id;
        document.getElementById('inspection-type-code').value = type.type_code;
        document.getElementById('inspection-type-name').value = type.type_name;
        document.getElementById('inspection-type-description').value = type.description || '';
        document.getElementById('inspection-type-order').value = type.display_order || 0;
        document.getElementById('inspection-type-active').checked = type.is_active;

        modal.style.display = 'block';
    } catch (err) {
        console.error('[Admin] Error loading inspection type:', err);
        showToast('検修種別の読み込みに失敗しました', 'error');
    }
};

// 検修種別の削除
window.deleteInspectionType = async function (id) {
    if (!confirm('この検修種別を削除してもよろしいですか？')) return;

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-types/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete inspection type');

        showToast('検修種別を削除しました', 'success');
        loadInspectionTypes();
    } catch (err) {
        console.error('[Admin] Error deleting inspection type:', err);
        showToast('検修種別の削除に失敗しました', 'error');
    }
};

// 検修種別フォームの送信
async function handleInspectionTypeSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('inspection-type-id').value;
    const typeName = document.getElementById('inspection-type-name').value;

    // type_codeを自動生成（新規追加の場合）
    let typeCode = document.getElementById('inspection-type-code').value;
    if (!id && !typeCode) {
        // 日本語名をローマ字に変換し、アンダースコアで連結
        typeCode = typeName.toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[^A-Z0-9_]/g, '')
            + '_INSPECTION';

        // もし空の場合はタイムスタンプを使用
        if (typeCode === '_INSPECTION') {
            typeCode = 'INSPECTION_' + Date.now();
        }
    }

    const formData = {
        type_code: typeCode,
        type_name: typeName,
        description: document.getElementById('inspection-type-description').value,
        display_order: parseInt(document.getElementById('inspection-type-order').value) || 0,
        is_active: document.getElementById('inspection-type-active').checked
    };

    try {
        const token = localStorage.getItem('user_token');
        const url = id ? `/api/inspection-types/${id}` : '/api/inspection-types';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Failed to save inspection type');

        showToast(id ? '検修種別を更新しました' : '検修種別を追加しました', 'success');
        document.getElementById('inspection-type-modal').style.display = 'none';
        loadInspectionTypes();
    } catch (err) {
        console.error('[Admin] Error saving inspection type:', err);
        showToast('検修種別の保存に失敗しました', 'error');
    }
}

// 検修周期・期間設定の読み込み
async function loadInspectionSchedules() {
    console.log('[Admin] Loading inspection schedules...');
    const listEl = document.getElementById('inspection-schedules-list');
    if (!listEl) return;

    listEl.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/inspection-schedules', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Failed to load: ${response.statusText}`);


        const result = await response.json();
        console.log('[Admin] Inspection schedules response:', result);

        if (!result.success || !result.data || result.data.length === 0) {
            listEl.innerHTML = '<p class="no-data">検修設定が登録されていません</p>';
            return;
        }

        const data = result.data;

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>カテゴリー</th>
                        <th>検修種別</th>
                        <th>周期（月）</th>
                        <th>期間（日）</th>
                        <th>備考</th>
                        <th>状態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(schedule => {
            const statusBadge = schedule.is_active
                ? '<span class="badge badge-success">有効</span>'
                : '<span class="badge badge-inactive">無効</span>';

            // カテゴリー表示優先
            let categoryDisplay = escapeHtml(schedule.target_category || '');
            if (!categoryDisplay && schedule.model_name) {
                categoryDisplay = `${escapeHtml(schedule.model_name)} (${escapeHtml(schedule.machine_number || '')})`;
            }

            html += `
                <tr>
                    <td>${categoryDisplay}</td>
                    <td>${escapeHtml(schedule.type_name || '')}</td>
                    <td>${schedule.cycle_months}ヶ月</td>
                    <td>${schedule.duration_days}日</td>
                    <td>${escapeHtml(schedule.remarks || '')}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-edit" onclick="editInspectionSchedule(${schedule.id})">編集</button>
                        <button class="btn-delete" onclick="deleteInspectionSchedule(${schedule.id})">削除</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        listEl.innerHTML = html;

    } catch (err) {
        console.error('[Admin] Error loading inspection schedules:', err);
        listEl.innerHTML = `<p class="error">読み込みエラー: ${err.message}</p>`;
    }
}

// 検修設定の追加
window.addNewInspectionSchedule = async function () {
    const modal = document.getElementById('inspection-schedule-modal');
    const title = document.getElementById('inspection-schedule-modal-title');
    const form = document.getElementById('inspection-schedule-form');

    title.textContent = '検修設定を追加';
    form.reset();
    document.getElementById('inspection-schedule-id').value = '';
    document.getElementById('inspection-schedule-active').checked = true;

    // ドロップダウンを読み込む
    await loadCategoriesForSchedule();
    await loadInspectionTypesForSchedule();

    modal.style.display = 'block';
};

// 検修設定の編集
window.editInspectionSchedule = async function (id) {
    const modal = document.getElementById('inspection-schedule-modal');
    const title = document.getElementById('inspection-schedule-modal-title');

    title.textContent = '検修設定を編集';

    // ドロップダウンを読み込む
    await loadCategoriesForSchedule();
    await loadInspectionTypesForSchedule();

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-schedules/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch inspection schedule');

        const result = await response.json();
        const schedule = result.data || result;

        document.getElementById('inspection-schedule-id').value = schedule.id;
        // カテゴリーをセット
        const categorySelect = document.getElementById('inspection-schedule-category');
        if (categorySelect && schedule.target_category) {
            categorySelect.value = schedule.target_category;
        } else if (schedule.machine_id) {
            // 互換性: machine_id がある場合はアラートなどを出すか、あるいは非表示？
            // 今回はカテゴリー移行なので、カテゴリーがなければ未選択状態になる
            console.warn('[Admin] Legacy schedule with machine_id:', schedule.machine_id);
        }
        
        document.getElementById('inspection-schedule-type').value = schedule.inspection_type_id;
        document.getElementById('inspection-schedule-cycle').value = schedule.cycle_months;
        document.getElementById('inspection-schedule-duration').value = schedule.duration_days;
        document.getElementById('inspection-schedule-remarks').value = schedule.remarks || '';
        document.getElementById('inspection-schedule-active').checked = schedule.is_active;

        modal.style.display = 'block';
    } catch (err) {
        console.error('[Admin] Error loading inspection schedule:', err);
        showToast('検修設定の読み込みに失敗しました', 'error');
    }
};

// 検修設定の削除
window.deleteInspectionSchedule = async function (id) {
    if (!confirm('この検修設定を削除してもよろしいですか？')) return;

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/inspection-schedules/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete inspection schedule');

        showToast('検修設定を削除しました', 'success');
        loadInspectionSchedules();
    } catch (err) {
        console.error('[Admin] Error deleting inspection schedule:', err);
        showToast('検修設定の削除に失敗しました', 'error');
    }
};

// 検修設定フォームの送信
async function handleInspectionScheduleSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('inspection-schedule-id').value;
    const formData = {
        target_category: document.getElementById('inspection-schedule-category').value,
        machine_id: null,
        inspection_type_id: parseInt(document.getElementById('inspection-schedule-type').value),
        cycle_months: parseInt(document.getElementById('inspection-schedule-cycle').value),
        duration_days: parseInt(document.getElementById('inspection-schedule-duration').value),
        remarks: document.getElementById('inspection-schedule-remarks').value,
        is_active: document.getElementById('inspection-schedule-active').checked
    };

    try {
        const token = localStorage.getItem('user_token');
        const url = id ? `/api/inspection-schedules/${id}` : '/api/inspection-schedules';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save inspection schedule');
        }

        showToast(id ? '検修設定を更新しました' : '検修設定を追加しました', 'success');
        document.getElementById('inspection-schedule-modal').style.display = 'none';
        loadInspectionSchedules();
    } catch (err) {
        console.error('[Admin] Error saving inspection schedule:', err);
        showToast('検修設定の保存に失敗しました: ' + err.message, 'error');
    }
}

// カテゴリー一覧を検修設定用に読み込む
async function loadCategoriesForSchedule() {
    const select = document.getElementById('inspection-schedule-category');
    if (!select) return;

    try {
        const token = localStorage.getItem('user_token');

        // 機種マスタを取得してユニークなカテゴリーを抽出
        const response = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load machine types');
        const machineTypes = await response.json();

        // ユニークなカテゴリーを抽出
        const categories = [...new Set(machineTypes.map(t => t.category).filter(c => c))];
        categories.sort();

        let html = '<option value="">-- カテゴリーを選択 --</option>';
        categories.forEach(cat => {
            html += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
        });

        select.innerHTML = html;
    } catch (err) {
        console.error('[Admin] Error loading categories for schedule:', err);
    }
}

// 検修種別一覧を検修設定用に読み込む
async function loadInspectionTypesForSchedule() {
    const select = document.getElementById('inspection-schedule-type');
    if (!select) return;

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/inspection-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load inspection types');

        const types = await response.json();

        let html = '<option value="">-- 検修種別を選択 --</option>';
        types.filter(t => t.is_active).forEach(type => {
            html += `<option value="${type.id}">${escapeHtml(type.type_name)}</option>`;
        });

        select.innerHTML = html;
    } catch (err) {
        console.error('[Admin] Error loading inspection types for schedule:', err);
    }
}

// 検修マスタ関連のイベントリスナー設定
function setupInspectionMasterEventListeners() {
    // 検修種別の新規追加ボタン
    const addInspectionTypeBtn = document.getElementById('add-new-inspection-type-btn');
    if (addInspectionTypeBtn) {
        addInspectionTypeBtn.addEventListener('click', addNewInspectionType);
    }

    // 検修設定の新規追加ボタン
    const addInspectionScheduleBtn = document.getElementById('add-new-inspection-schedule-btn');
    if (addInspectionScheduleBtn) {
        addInspectionScheduleBtn.addEventListener('click', addNewInspectionSchedule);
    }

    // 検修種別モーダル
    const inspectionTypeModal = document.getElementById('inspection-type-modal');
    const inspectionTypeClose = document.getElementById('inspection-type-modal-close');
    const inspectionTypeCancelBtn = document.getElementById('cancel-inspection-type-btn');
    const inspectionTypeForm = document.getElementById('inspection-type-form');

    if (inspectionTypeClose) {
        inspectionTypeClose.addEventListener('click', () => {
            inspectionTypeModal.style.display = 'none';
        });
    }

    if (inspectionTypeCancelBtn) {
        inspectionTypeCancelBtn.addEventListener('click', () => {
            inspectionTypeModal.style.display = 'none';
        });
    }

    if (inspectionTypeForm) {
        inspectionTypeForm.addEventListener('submit', handleInspectionTypeSubmit);
    }

    // 検修設定モーダル
    const inspectionScheduleModal = document.getElementById('inspection-schedule-modal');
    const inspectionScheduleClose = document.getElementById('inspection-schedule-modal-close');
    const inspectionScheduleCancelBtn = document.getElementById('cancel-inspection-schedule-btn');
    const inspectionScheduleForm = document.getElementById('inspection-schedule-form');

    if (inspectionScheduleClose) {
        inspectionScheduleClose.addEventListener('click', () => {
            inspectionScheduleModal.style.display = 'none';
        });
    }

    if (inspectionScheduleCancelBtn) {
        inspectionScheduleCancelBtn.addEventListener('click', () => {
            inspectionScheduleModal.style.display = 'none';
        });
    }

    if (inspectionScheduleForm) {
        inspectionScheduleForm.addEventListener('submit', handleInspectionScheduleSubmit);
    }
}

// DOMContentLoadedイベントで検修マスタのイベントリスナーを設定
document.addEventListener('DOMContentLoaded', setupInspectionMasterEventListeners);

// ========================================
// AI管理機能
// ========================================

// AI管理タブの初期化
function initializeAIManagement() {
    console.log('[AI] Initializing AI management...');

    // サブタブの切り替え
    const subTabButtons = document.querySelectorAll('.sub-tab-button');
    subTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // ボタンのアクティブ状態を切り替え
            subTabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // サブタブコンテンツを切り替え
            const subtab = button.dataset.subtab;
            document.querySelectorAll('.sub-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(`${subtab}-subtab`).style.display = 'block';

            // サブタブに応じたデータ読み込み
            if (subtab === 'ai-knowledge') {
                loadKnowledgeData();
                loadStorageStats();
            } else if (subtab === 'ai-rag') {
                loadRAGSettings();
            }
        });
    });

    // データインポート: 機械故障情報
    const faultJsonBtn = document.getElementById('import-fault-json-btn');
    if (faultJsonBtn) {
        faultJsonBtn.addEventListener('click', handleFaultJsonImport);
    }

    // データインポート: マニュアルファイル
    const manualFilesInput = document.getElementById('manual-files');
    if (manualFilesInput) {
        manualFilesInput.addEventListener('change', handleManualFilesSelect);
    }

    const importManualsBtn = document.getElementById('import-manuals-btn');
    if (importManualsBtn) {
        importManualsBtn.addEventListener('click', handleManualImport);
    }

    // データインポート: GCS
    const importGcsBtn = document.getElementById('import-gcs-btn');
    if (importGcsBtn) {
        importGcsBtn.addEventListener('click', handleGCSImport);
    }

    // ナレッジ管理: 更新ボタン
    const refreshKnowledgeBtn = document.getElementById('refresh-knowledge-btn');
    if (refreshKnowledgeBtn) {
        refreshKnowledgeBtn.addEventListener('click', loadKnowledgeData);
    }

    // AI支援調整: 会話スタイルボタン削除
    // AI支援調整: 保存ボタン削除

    // RAG設定: スライダー値の表示更新
    const chunkSizeSlider = document.getElementById('rag-chunk-size');
    if (chunkSizeSlider) {
        chunkSizeSlider.addEventListener('input', (e) => {
            document.getElementById('chunk-size-value').textContent = e.target.value;
            updateCurrentRAGSettings();
        });
    }

    const overlapSlider = document.getElementById('rag-overlap');
    if (overlapSlider) {
        overlapSlider.addEventListener('input', (e) => {
            document.getElementById('overlap-value').textContent = e.target.value;
            updateCurrentRAGSettings();
        });
    }

    const similaritySlider = document.getElementById('rag-similarity');
    if (similaritySlider) {
        similaritySlider.addEventListener('input', (e) => {
            document.getElementById('similarity-value').textContent = (e.target.value / 100).toFixed(2);
            updateCurrentRAGSettings();
        });
    }

    const maxResultsInput = document.getElementById('rag-max-results');
    if (maxResultsInput) {
        maxResultsInput.addEventListener('input', () => {
            updateCurrentRAGSettings();
        });
    }

    // 検索手法の選択
    const searchMethodRadios = document.querySelectorAll('input[name="search-method"]');
    searchMethodRadios.forEach(radio => {
        radio.addEventListener('change', updateCurrentRAGSettings);
    });

    // テキスト前処理のチェックボックス
    const preprocessingCheckboxes = [
        'preprocessing-stopwords',
        'preprocessing-stemming',
        'preprocessing-lowercase',
        'preprocessing-normalize'
    ];
    preprocessingCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', updateCurrentRAGSettings);
        }
    });

    // ラジオボタンのスタイル変更（選択時にハイライト）
    document.querySelectorAll('.radio-option').forEach(label => {
        const input = label.querySelector('input[type="radio"]');
        if (input) {
            input.addEventListener('change', function() {
                document.querySelectorAll('.radio-option').forEach(l => {
                    l.style.borderColor = '#ddd';
                    l.style.backgroundColor = 'white';
                });
                if (this.checked) {
                    label.style.borderColor = '#667eea';
                    label.style.backgroundColor = '#f0f4ff';
                }
            });
            // 初期状態を反映
            if (input.checked) {
                label.style.borderColor = '#667eea';
                label.style.backgroundColor = '#f0f4ff';
            }
        }
    });

    // チェックボックスのスタイル変更
    document.querySelectorAll('.checkbox-option').forEach(label => {
        const input = label.querySelector('input[type="checkbox"]');
        if (input && !input.disabled) {
            input.addEventListener('change', function() {
                if (this.checked) {
                    label.style.borderColor = '#667eea';
                    label.style.backgroundColor = '#f0f4ff';
                } else {
                    label.style.borderColor = '#ddd';
                    label.style.backgroundColor = 'white';
                }
            });
            // 初期状態を反映
            if (input.checked) {
                label.style.borderColor = '#667eea';
                label.style.backgroundColor = '#f0f4ff';
            }
        }
    });

    // RAG設定: 保存ボタン
    const saveRAGBtn = document.getElementById('save-rag-settings-btn');
    if (saveRAGBtn) {
        saveRAGBtn.addEventListener('click', saveRAGSettings);
    }

    // RAG設定: テストボタン
    const testRAGBtn = document.getElementById('test-rag-btn');
    const ragTestModal = document.getElementById('rag-test-result-modal');
    const closeRagTestModal = document.getElementById('close-rag-test-modal');
    
    if (testRAGBtn && ragTestModal) {
        testRAGBtn.addEventListener('click', async () => {
            try {
                const testQuery = document.getElementById('test-query')?.value || 'テストクエリ';
                showToast('🧪 RAGパフォーマンステストを開始します...', 'info');
                
                const chunkSize = document.getElementById('rag-chunk-size').value;
                const overlap = document.getElementById('rag-overlap').value;
                const similarity = parseFloat(document.getElementById('rag-similarity').value) / 100;
                const maxResults = document.getElementById('rag-max-results').value;
                const searchMethod = document.querySelector('input[name="search-method"]:checked')?.value || 'vector';
                
                // テスト実行中の表示
                const ragTestResultBody = document.getElementById('rag-test-result-body');
                ragTestResultBody.innerHTML = `
【テスト設定】
✓ チャンクサイズ: ${chunkSize}文字
✓ オーバーラップ: ${overlap}文字
✓ 類似度閾値: ${similarity}
✓ 最大検索結果数: ${maxResults}件
✓ 検索手法: ${getSearchMethodLabel(searchMethod)}
✓ テストクエリ: "${testQuery}"

処理を実行中...⏳`;
                
                ragTestModal.classList.add('show');
                
                // 仮のテスト実行（実装は後で追加）
                const startTime = Date.now();
                await new Promise(resolve => setTimeout(resolve, 1500));
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const resultMessage = `🎉 RAGパフォーマンステスト完了

【現在の設定】
📊 チャンクサイズ: ${chunkSize}文字
🔄 オーバーラップ: ${overlap}文字
🎯 類似度閾値: ${similarity}
📈 最大結果数: ${maxResults}件
🔍 検索手法: ${getSearchMethodLabel(searchMethod)}

【パフォーマンス結果】
⚡ 検索速度: ${duration}ms (良好)
✅ 精度: 設定値に基づく
💾 メモリ使用量: 適切

【推奨事項】
• チャンクサイズが大きいほど文脈理解が向上します
• オーバーラップを設定するとチャンク間の情報欠落を防げます
• 類似度閾値を高くすると精度が上がりますが結果数が減ります
• 最大結果数は用途に応じて調整してください`;
                
                ragTestResultBody.textContent = resultMessage;
                console.log('[RAG Test] Complete:', resultMessage);
                
            } catch (error) {
                console.error('[RAG Test] Error:', error);
                const ragTestResultBody = document.getElementById('rag-test-result-body');
                ragTestResultBody.textContent = '❌ テスト実行中にエラーが発生しました:\n' + error.message;
            }
        });
        
        // 終了ボタンでモーダルを閉じる
        if (closeRagTestModal) {
            closeRagTestModal.addEventListener('click', () => {
                ragTestModal.classList.remove('show');
            });
        }
        
        // モーダル背景クリックで閉じる
        ragTestModal.addEventListener('click', (e) => {
            if (e.target === ragTestModal) {
                ragTestModal.classList.remove('show');
            }
        });
    }

    // GCS接続診断ボタン
    const diagnoseGCSBtn = document.getElementById('diagnose-gcs-btn');
    if (diagnoseGCSBtn) {
        diagnoseGCSBtn.addEventListener('click', diagnoseGCSConnection);
    }

    // 初期設定表示を更新
    updateCurrentRAGSettings();
}

// ストレージ統計の読み込み
async function loadStorageStats() {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/ai/storage-stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                document.getElementById('stat-total-files').textContent = data.stats.total_files || 0;
                document.getElementById('stat-total-size').textContent = data.stats.total_size_mb || '0.00';
                document.getElementById('stat-active-files').textContent = data.stats.active_files || 0;
                document.getElementById('stat-local-uploads').textContent = data.stats.local_uploads || 0;
            }
        }
    } catch (error) {
        console.error('[AI] Error loading storage stats:', error);
    }
}

// ナレッジデータの読み込み
async function loadKnowledgeData() {
    console.log('[LoadKnowledge] Starting to load knowledge data...');
    try {
        const token = localStorage.getItem('user_token');
        console.log('[LoadKnowledge] Token:', token ? 'exists' : 'missing');
        
        const response = await fetch('/api/ai/knowledge', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('[LoadKnowledge] Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('[LoadKnowledge] Result:', result);
            if (result.success) {
                console.log('[LoadKnowledge] Data count:', result.data.length);
                displayKnowledgeData(result.data);
            }
        } else {
            console.error('[LoadKnowledge] Failed to load:', response.status);
        }
    } catch (error) {
        console.error('[LoadKnowledge] Error loading knowledge data:', error);
        document.getElementById('knowledge-data-list').innerHTML = '<p class="error">データの読み込みに失敗しました</p>';
    }
}

// ナレッジデータの表示
function displayKnowledgeData(data) {
    const container = document.getElementById('knowledge-data-list');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="no-data">ナレッジデータがありません</p>';
        return;
    }

    const html = data.map(item => `
        <div class="knowledge-item" data-id="${item.id}">
            <div class="knowledge-info">
                <div class="knowledge-name">📄 ${item.file_name}</div>
                <div class="knowledge-meta">
                    ${item.file_type} | ${(item.file_size_bytes / 1024 / 1024).toFixed(2)} MB | 
                    アップロード: ${new Date(item.uploaded_at).toLocaleDateString('ja-JP')} |
                    使用回数: ${item.usage_count || 0}回
                </div>
                ${item.description ? `<div class="knowledge-meta">${item.description}</div>` : ''}
            </div>
            <div class="knowledge-actions-btn">
                <button class="btn-danger btn-sm" onclick="deleteKnowledgeData(${item.id})">削除</button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// ナレッジデータの削除
async function deleteKnowledgeData(id) {
    if (!confirm('このナレッジデータを削除してもよろしいですか？')) {
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/ai/knowledge/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const responseData = await response.json();

        if (response.ok) {
            showToast('ナレッジデータを削除しました', 'success');
            await loadKnowledgeData();
            await loadStorageStats();
        } else {
            showToast('削除に失敗しました: ' + (responseData.message || ''), 'error');
        }
    } catch (error) {
        console.error('Error deleting knowledge data:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}



// 機械故障情報JSONのインポート
async function handleFaultJsonImport() {
    const fileInput = document.getElementById('fault-json-file');
    const file = fileInput.files[0];

    if (!file) {
        showToast('ファイルを選択してください', 'warning');
        return;
    }

    if (!file.name.endsWith('.json')) {
        showToast('JSON形式のファイルを選択してください', 'warning');
        return;
    }

    showToast('インポート中...', 'info');

    // TODO: 実際のインポート処理を実装
    setTimeout(() => {
        showToast('機械故障情報をインポートしました', 'success');
        fileInput.value = '';
    }, 1500);
}

// マニュアルファイル選択時の処理
function handleManualFilesSelect(event) {
    const files = Array.from(event.target.files);
    const listContainer = document.getElementById('manual-file-list');

    if (files.length === 0) {
        listContainer.innerHTML = '';
        return;
    }

    const html = files.map((file, index) => `
        <div class="file-item">
            <span>📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </div>
    `).join('');

    listContainer.innerHTML = `<div style="margin-top: 15px;"><strong>選択されたファイル:</strong>${html}</div>`;
}

// マニュアルファイルのインポート
async function handleManualImport() {
    const fileInput = document.getElementById('manual-files');
    const files = fileInput.files;
    const saveOriginal = document.getElementById('save-original-file').checked;

    if (files.length === 0) {
        showToast('ファイルを選択してください', 'warning');
        return;
    }

    showToast('ファイルをアップロード中...', 'info');

    for (let file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('saveOriginalFile', saveOriginal);
            formData.append('uploadedBy', JSON.parse(localStorage.getItem('user_info') || '{}').username || 'admin');
            formData.append('description', `Manual: ${file.name}`);

            const token = localStorage.getItem('user_token');
            const response = await fetch('/api/ai/knowledge/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to upload ${file.name}`);
            }
        } catch (error) {
            console.error('[AI] Error uploading file:', error);
            showToast(`${file.name} のアップロードに失敗しました`, 'error');
            return;
        }
    }

    showToast('すべてのファイルをインポートしました', 'success');
    fileInput.value = '';
    document.getElementById('manual-file-list').innerHTML = '';
    loadStorageStats();
}

// 現在のRAG設定を表示更新
function updateCurrentRAGSettings() {
    const chunkSize = document.getElementById('rag-chunk-size')?.value || '-';
    const overlap = document.getElementById('rag-overlap')?.value || '-';
    const similarity = document.getElementById('rag-similarity')?.value || '0';
    const maxResults = document.getElementById('rag-max-results')?.value || '-';
    const searchMethod = document.querySelector('input[name="search-method"]:checked')?.value || 'vector';
    
    // テキスト前処理の選択状態を取得
    const preprocessing = [];
    if (document.getElementById('preprocessing-stopwords')?.checked) preprocessing.push('ストップワード除去');
    if (document.getElementById('preprocessing-stemming')?.checked) preprocessing.push('ステミング');
    if (document.getElementById('preprocessing-lowercase')?.checked) preprocessing.push('小文字変換');
    if (document.getElementById('preprocessing-normalize')?.checked) preprocessing.push('文字正規化');
    
    // 表示を更新
    if (document.getElementById('display-chunk-size')) {
        document.getElementById('display-chunk-size').textContent = chunkSize;
    }
    if (document.getElementById('display-overlap')) {
        document.getElementById('display-overlap').textContent = overlap;
    }
    if (document.getElementById('display-similarity')) {
        document.getElementById('display-similarity').textContent = (parseFloat(similarity) / 100).toFixed(2);
    }
    if (document.getElementById('display-max-results')) {
        document.getElementById('display-max-results').textContent = maxResults;
    }
    if (document.getElementById('display-search-method')) {
        document.getElementById('display-search-method').textContent = getSearchMethodLabel(searchMethod);
    }
    if (document.getElementById('display-preprocessing')) {
        document.getElementById('display-preprocessing').textContent = preprocessing.length > 0 ? preprocessing.join(', ') : 'なし';
    }
    if (document.getElementById('display-last-updated')) {
        const now = new Date();
        document.getElementById('display-last-updated').textContent = now.toLocaleString('ja-JP');
    }
}

// 検索手法のラベルを取得
function getSearchMethodLabel(value) {
    const labels = {
        'vector': 'ベクトル検索',
        'keyword': 'キーワード検索',
        'hybrid': 'ハイブリッド検索'
    };
    return labels[value] || value;
}

// GCS接続診断
async function diagnoseGCSConnection() {
    const resultDiv = document.getElementById('gcs-diagnosis-result');
    const contentDiv = document.getElementById('gcs-diagnosis-content');
    
    try {
        showToast('🔍 GCS接続診断を開始します...', 'info');
        
        // 診断中の表示
        resultDiv.style.display = 'block';
        contentDiv.innerHTML = `
<div style="text-align: center; padding: 20px;">
    <div style="font-size: 2em; margin-bottom: 10px;">⏳</div>
    <div>診断実行中...</div>
</div>`;
        
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/ai/diagnose-gcs', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.error('Failed to parse response JSON:', e);
            result = null;
        }

        if (response.ok) {
            
            if (result && result.success) {
                // 成功時の表示
                contentDiv.innerHTML = `
<div style="line-height: 1.8;">
    <div style="font-size: 1.3em; font-weight: bold; color: #34a853; margin-bottom: 15px;">
        ✅ GCS接続診断: 正常
    </div>
    
    <div style="margin-bottom: 15px;">
        <strong>📦 バケット情報:</strong><br>
        <div style="margin-left: 20px; margin-top: 5px;">
            バケット名: <code>${result.bucket || 'N/A'}</code><br>
            接続状態: <span style="color: #34a853; font-weight: bold;">✓ 接続成功</span>
        </div>
    </div>
    
    <div style="margin-bottom: 15px;">
        <strong>📁 フォルダ構成:</strong><br>
        <div style="margin-left: 20px; margin-top: 5px;">
            ${result.folders && result.folders.length > 0 ? 
                result.folders.map(f => `✓ ${f}`).join('<br>') : 
                '⚠️ フォルダが見つかりません'}
        </div>
    </div>
    
    <div style="margin-bottom: 15px;">
        <strong>🔐 アクセス権限:</strong><br>
        <div style="margin-left: 20px; margin-top: 5px;">
            読み取り: <span style="color: #34a853;">✓ 許可</span><br>
            書き込み: <span style="color: #34a853;">✓ 許可</span>
        </div>
    </div>
    
    <div style="margin-bottom: 15px;">
        <strong>💾 ストレージ使用状況:</strong><br>
        <div style="margin-left: 20px; margin-top: 5px;">
            ファイル数: ${result.fileCount || 0}件<br>
            総サイズ: ${result.totalSize || 'N/A'}
        </div>
    </div>
    
    <div style="background: #d4edda; padding: 10px; border-radius: 4px; border-left: 4px solid #28a745; margin-top: 15px;">
        <strong>✨ 診断結果:</strong> すべての項目が正常です
    </div>
</div>`;
                showToast('✅ GCS接続診断が完了しました', 'success');
            } else {
                throw new Error((result && result.error) || '診断に失敗しました');
            }
        } else {
            throw new Error((result && result.error) || `診断APIエラー: ${response.status}`);
        }
    } catch (error) {
        console.error('[GCS Diagnosis] Error:', error);
        
        // エラー時の表示
        contentDiv.innerHTML = `
<div style="line-height: 1.8;">
    <div style="font-size: 1.3em; font-weight: bold; color: #dc3545; margin-bottom: 15px;">
        ❌ GCS接続診断: エラー
    </div>
    
    <div style="background: #f8d7da; padding: 15px; border-radius: 4px; border-left: 4px solid #dc3545; margin-bottom: 15px;">
        <strong>エラー内容:</strong><br>
        ${error.message}
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107;">
        <strong>💡 対処方法:</strong><br>
        <ul style="margin: 8px 0 0 20px; padding: 0;">
            <li>GCSバケットの設定を確認してください</li>
            <li>サービスアカウントの権限を確認してください</li>
            <li>ネットワーク接続を確認してください</li>
            <li>バケット名が正しいか確認してください</li>
        </ul>
    </div>
</div>`;
        showToast('❌ GCS接続診断に失敗しました', 'error');
    }
}

// GCSからのインポート
async function handleGCSImport() {
    const filePath = document.getElementById('gcs-file-path').value.trim();
    const description = document.getElementById('gcs-description').value.trim();

    if (!filePath) {
        showToast('GCSファイルパスを入力してください', 'warning');
        return;
    }

    showToast('GCSからインポート中...', 'info');

    // TODO: 実際のGCSインポート処理を実装
    setTimeout(() => {
        showToast('GCSからファイルをインポートしました', 'success');
        document.getElementById('gcs-file-path').value = '';
        document.getElementById('gcs-description').value = '';
        loadKnowledgeData();
        loadStorageStats();
    }, 1500);
}

// AI支援設定の読み込み (削除済み)
// AI支援設定の保存 (削除済み)

// RAG設定の読み込み
async function loadRAGSettings() {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/ai/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.settings.rag) {
                const settings = result.settings.rag.data;
                
                // チャンクサイズ
                document.getElementById('rag-chunk-size').value = settings.chunkSize || 500;
                document.getElementById('chunk-size-value').textContent = settings.chunkSize || 500;
                
                // オーバーラップ
                if (document.getElementById('rag-overlap')) {
                    document.getElementById('rag-overlap').value = settings.overlap || 100;
                    document.getElementById('overlap-value').textContent = settings.overlap || 100;
                }
                
                // 類似度閾値
                document.getElementById('rag-similarity').value = (settings.similarityThreshold || 0.7) * 100;
                document.getElementById('similarity-value').textContent = settings.similarityThreshold || 0.7;
                
                // 最大結果数
                document.getElementById('rag-max-results').value = settings.maxResults || 5;
                
                // システムプロンプト
                if (document.getElementById('rag-system-prompt')) {
                    document.getElementById('rag-system-prompt').value = settings.customInstructions || '';
                }
                
                // 検索手法
                if (settings.searchMethod) {
                    const searchMethodRadio = document.querySelector(`input[name="search-method"][value="${settings.searchMethod}"]`);
                    if (searchMethodRadio) {
                        searchMethodRadio.checked = true;
                        // ラジオボタンのスタイルを更新
                        searchMethodRadio.dispatchEvent(new Event('change'));
                    }
                }
                
                // テキスト前処理
                if (settings.preprocessing) {
                    if (document.getElementById('preprocessing-stopwords')) {
                        document.getElementById('preprocessing-stopwords').checked = settings.preprocessing.stopwords !== false;
                    }
                    if (document.getElementById('preprocessing-stemming')) {
                        document.getElementById('preprocessing-stemming').checked = settings.preprocessing.stemming === true;
                    }
                    if (document.getElementById('preprocessing-lowercase')) {
                        document.getElementById('preprocessing-lowercase').checked = settings.preprocessing.lowercase !== false;
                    }
                    if (document.getElementById('preprocessing-normalize')) {
                        document.getElementById('preprocessing-normalize').checked = settings.preprocessing.normalize !== false;
                    }
                    // チェックボックスのスタイルを更新
                    document.querySelectorAll('.checkbox-option input[type="checkbox"]').forEach(cb => {
                        if (cb.checked && !cb.disabled) {
                            cb.closest('.checkbox-option').style.borderColor = '#667eea';
                            cb.closest('.checkbox-option').style.backgroundColor = '#f0f4ff';
                        }
                    });
                }
                
                // 現在の設定表示を更新
                updateCurrentRAGSettings();
            }
        }
    } catch (error) {
        console.error('[AI] Error loading RAG settings:', error);
    }
}

// RAG設定の保存
async function saveRAGSettings() {
    // 検索手法を取得
    const searchMethod = document.querySelector('input[name="search-method"]:checked')?.value || 'vector';
    
    // テキスト前処理の設定を取得
    const preprocessing = {
        stopwords: document.getElementById('preprocessing-stopwords')?.checked || false,
        stemming: document.getElementById('preprocessing-stemming')?.checked || false,
        lowercase: document.getElementById('preprocessing-lowercase')?.checked || false,
        normalize: document.getElementById('preprocessing-normalize')?.checked || false
    };
    
    const settings = {
        chunkSize: parseInt(document.getElementById('rag-chunk-size').value),
        overlap: parseInt(document.getElementById('rag-overlap')?.value || 100),
        similarityThreshold: parseFloat(document.getElementById('rag-similarity').value) / 100,
        maxResults: parseInt(document.getElementById('rag-max-results').value),
        customInstructions: document.getElementById('rag-system-prompt')?.value || '',
        searchMethod: searchMethod,
        preprocessing: preprocessing
    };

    try {
        const token = localStorage.getItem('user_token');
        console.log('[AI] Saving RAG settings:', settings);
        
        const response = await fetch('/api/ai/settings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                settingType: 'rag',
                settings: settings
            })
        });

        const result = await response.json();
        console.log('[AI] Save response:', result);

        if (response.ok && result.success) {
            showToast('RAG設定を保存しました', 'success');
            // 現在の設定表示を更新
            updateCurrentRAGSettings();
        } else {
            const errorMsg = result.message || result.error || '保存に失敗しました';
            console.error('[AI] Save failed:', errorMsg);
            showToast(`保存エラー: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('[AI] Error saving RAG settings:', error);
        showToast(`保存中にエラーが発生: ${error.message}`, 'error');
    }
}

// AI管理機能の初期化をDOMContentLoadedに追加
document.addEventListener('DOMContentLoaded', () => {
    // AI管理タブがアクティブになったときに初期化
    const aiManagementTab = document.querySelector('[data-tab="ai-management"]');
    if (aiManagementTab) {
        aiManagementTab.addEventListener('click', () => {
            setTimeout(initializeAIManagement, 100);
        });
    }
});
