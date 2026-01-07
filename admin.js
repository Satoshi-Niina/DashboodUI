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
    if (userInfo.role !== 'system_admin' && userInfo.role !== 'operation_admin') {
        console.error('[Admin] Access denied - role:', userInfo.role);
        alert('アクセス権限がありません。管理者権限が必要です。');
        window.location.href = '/index.html';
        return;
    }

    console.log('[Admin] Access granted for admin user');

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
        addMachineTypeBtn.addEventListener('click', () => openMachineTypeModal());
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
                            <th>機種コード</th>
                            <th>機種名</th>
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
                const typeCode = type.type_code || '-';
                console.log('[loadMachineTypes] Rendering type:', { id: typeId, code: typeCode });
                html += `
                    <tr>
                        <td>${escapeHtml(type.type_code || '-')}</td>
                        <td>${escapeHtml(type.type_name || '-')}</td>
                        <td>${escapeHtml(type.manufacturer || '-')}</td>
                        <td>${escapeHtml(type.category || '-')}</td>
                        <td>
                            <button class="btn-sm btn-edit" data-id="${typeId}" data-action="edit-type">編集</button>
                            <button class="btn-sm btn-delete" data-id="${typeId}" data-code="${escapeHtml(typeCode)}" data-action="delete-type">削除</button>
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
                document.getElementById('machine-type-name').value = machineType.type_name || '';
                document.getElementById('machine-type-model-name').value = machineType.model_name || machineType.model || '';
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
        type_name: document.getElementById('machine-type-name').value,
        model_name: document.getElementById('machine-type-model-name').value,
        manufacturer: document.getElementById('machine-type-manufacturer').value,
        category: document.getElementById('machine-type-category').value,
        description: document.getElementById('machine-type-description').value
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
                            <th>配属基地</th>
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
                        <td>${escapeHtml(machine.type_name || '-')}</td>
                        <td>${escapeHtml(machine.serial_number || '-')}</td>
                        <td>${machine.manufacture_date ? new Date(machine.manufacture_date).toLocaleDateString('ja-JP') : '-'}</td>
                        <td>${escapeHtml(machine.base_name || '-')}</td>
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
                const typeCode = type.type_code || '';
                const typeName = type.type_name || '名前なし';
                const modelName = type.model_name || '';

                // 機種名にメーカー型式を並べて表示する
                const displayText = modelName ? `${typeName} (${modelName})` : typeName;

                options.push(`<option value="${typeId}">${escapeHtml(displayText)}</option>`);
                console.log(`[openMachineModal] Type ${index + 1}/${machineTypesData.data.length}:`, {
                    id: typeId,
                    code: typeCode,
                    name: typeName
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

