document.addEventListener('DOMContentLoaded', () => {
    // 認証チェック
    const token = localStorage.getItem('user_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // ユーザー情報の表示とロールチェック
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    document.getElementById('admin-user').textContent = userInfo.displayName || userInfo.username;

    // システム管理者以外はアクセス拒否
    if (userInfo.role !== 'admin') {
        alert('アクセス権限がありません。システム管理者のみアクセス可能です。');
        window.location.href = '/dashboard';
        return;
    }

    // メイン画面に戻る
    document.getElementById('back-to-main-btn').addEventListener('click', () => {
        window.location.href = '/dashboard';
    });

    // タブ機能の初期化
    initializeTabs();

    // 初期ロード
    loadUsers();
    loadOffices();
    loadBases();
    loadVehicles();
    loadDatabaseStats();

    // イベントリスナーの初期化
    initializeEventListeners();
    initializeMachineEventListeners();
    initializeCorsSettings();
});

// タブ機能
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // 最初のタブをアクティブにする
    tabButtons[0].classList.add('active');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // すべてのタブボタンとコンテンツを非アクティブにする
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');

            // クリックされたタブをアクティブにする
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).style.display = 'block';

            // タブに応じてデータを読み込み
            if (tabName === 'user-management') {
                loadUsers();
            } else if (tabName === 'office-master') {
                loadOffices();
            } else if (tabName === 'base-master') {
                loadBases();
            } else if (tabName === 'vehicle-master') {
                loadVehicles();
            } else if (tabName === 'machine-master') {
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

    // 保守用車追加ボタン
    const addVehicleBtn = document.getElementById('add-new-vehicle-btn');
    if (addVehicleBtn) {
        addVehicleBtn.addEventListener('click', () => openVehicleModal());
    }

    // 保守用車モーダルのイベントリスナー
    const vehicleModal = document.getElementById('vehicle-modal');
    const vehicleCloseModal = document.getElementById('vehicle-modal-close');
    const vehicleCancelBtn = document.getElementById('cancel-vehicle-btn');
    const vehicleForm = document.getElementById('vehicle-form');

    if (vehicleCloseModal) {
        vehicleCloseModal.addEventListener('click', () => {
            vehicleModal.style.display = 'none';
        });
    }

    if (vehicleCancelBtn) {
        vehicleCancelBtn.addEventListener('click', () => {
            vehicleModal.style.display = 'none';
        });
    }

    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveVehicle();
        });
    }
}

// ========== ユーザー管理 ==========
async function loadUsers() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.users.length > 0) {
            usersList.innerHTML = data.users.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <div class="username">${escapeHtml(user.username)}</div>
                        <div class="display-name">${escapeHtml(user.display_name || '')}</div>
                        <span class="role-badge role-${user.role}">${user.role === 'admin' ? '管理者' : 'ユーザー'}</span>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" onclick="editUser(${user.id})">✏️ 編集</button>
                        <button class="btn-delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">🗑️ 削除</button>
                    </div>
                </div>
            `).join('');
        } else {
            usersList.innerHTML = '<p class="loading">ユーザーが登録されていません</p>';
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        usersList.innerHTML = '<p class="loading">ユーザーの読み込みに失敗しました</p>';
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

    try {
        const token = localStorage.getItem('user_token');
        const url = userId ? `/api/users/${userId}` : '/api/users';
        const method = userId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(userId ? 'ユーザーを更新しました' : 'ユーザーを追加しました', 'success');
            document.getElementById('user-modal').style.display = 'none';
            loadUsers();
        } else {
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save user:', error);
        showToast('保存中にエラーが発生しました', 'error');
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

// ========== 保守用車マスタ ==========
async function loadVehicles() {
    const vehiclesList = document.getElementById('vehicles-list');
    vehiclesList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/vehicles', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.vehicles.length > 0) {
            let html = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>車両番号</th>
                            <th>機種</th>
                            <th>機械番号</th>
                            <th>管理事業所</th>
                            <th>車両登録番号</th>
                            <th>備考</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.vehicles.forEach(vehicle => {
                html += `
                    <tr>
                        <td>${escapeHtml(vehicle.vehicle_number || '-')}</td>
                        <td>${escapeHtml(vehicle.machine_type_name || '-')}</td>
                        <td>${escapeHtml(vehicle.machine_number || '-')}</td>
                        <td>${escapeHtml(vehicle.office_name || '-')}</td>
                        <td>${escapeHtml(vehicle.registration_number || '-')}</td>
                        <td>${escapeHtml(vehicle.notes || '-')}</td>
                        <td>
                            <button class="btn-sm btn-edit" onclick="editVehicle(${vehicle.vehicle_id})">編集</button>
                            <button class="btn-sm btn-delete" onclick="deleteVehicle(${vehicle.vehicle_id}, '${escapeHtml(vehicle.vehicle_number || vehicle.machine_number)}')">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            vehiclesList.innerHTML = html;
        } else {
            vehiclesList.innerHTML = '<p class="loading">保守用車が登録されていません</p>';
        }
    } catch (error) {
        console.error('Failed to load vehicles:', error);
        vehiclesList.innerHTML = '<p class="loading">保守用車の読み込みに失敗しました</p>';
    }
}

async function openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('vehicle-modal');
    const modalTitle = document.getElementById('vehicle-modal-title');
    const form = document.getElementById('vehicle-form');
    const token = localStorage.getItem('user_token');
    
    form.reset();
    document.getElementById('vehicle-id').value = '';
    
    // 機種マスタを読み込む
    try {
        const machineTypesResponse = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const machineTypesData = await machineTypesResponse.json();

        if (machineTypesData.success) {
            const machineTypeSelect = document.getElementById('vehicle-machine-type');
            machineTypeSelect.innerHTML = '<option value="">-- 機種を選択 --</option>';
            machineTypesData.data.forEach(type => {
                machineTypeSelect.innerHTML += `<option value="${type.id}">${type.type_code} - ${type.type_name}</option>`;
            });

            // 機種選択時に機械番号をフィルタリング
            machineTypeSelect.onchange = async () => {
                const typeId = machineTypeSelect.value;
                await loadMachinesForType(typeId);
            };
        }

        // 全機械番号を読み込む
        await loadMachinesForType(null);

        // 事業所を読み込む
        const officesResponse = await fetch('/api/offices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const officesData = await officesResponse.json();

        if (officesData.success) {
            const officeSelect = document.getElementById('vehicle-office');
            officeSelect.innerHTML = '<option value="">-- 事業所を選択 --</option>';
            officesData.offices.forEach(office => {
                officeSelect.innerHTML += `<option value="${office.office_id}">${office.office_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load options:', error);
    }
    
    if (vehicleId) {
        modalTitle.textContent = '保守用車を編集';
        await loadVehicleData(vehicleId);
    } else {
        modalTitle.textContent = '保守用車を追加';
    }
    
    modal.style.display = 'flex';
}

async function loadMachinesForType(typeId) {
    const token = localStorage.getItem('user_token');
    const machineSelect = document.getElementById('vehicle-machine');
    
    try {
        const response = await fetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            machineSelect.innerHTML = '<option value="">-- 機械番号を選択 --</option>';
            const filteredMachines = typeId 
                ? data.data.filter(m => m.machine_type_id == typeId)
                : data.data;
                
            filteredMachines.forEach(machine => {
                machineSelect.innerHTML += `<option value="${machine.machine_id}">${machine.machine_number} (${machine.type_name || '機種未設定'})</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load machines:', error);
    }
}

async function loadVehicleData(vehicleId) {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/vehicles/${vehicleId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const vehicle = data.vehicle;
            document.getElementById('vehicle-id').value = vehicle.vehicle_id;
            document.getElementById('vehicle-machine').value = vehicle.machine_id || '';
            document.getElementById('vehicle-number').value = vehicle.vehicle_number || '';
            document.getElementById('vehicle-type-text').value = vehicle.vehicle_type || '';
            document.getElementById('vehicle-registration').value = vehicle.registration_number || '';
            document.getElementById('vehicle-office').value = vehicle.office_id || '';
            document.getElementById('vehicle-notes').value = vehicle.notes || '';
        }
    } catch (error) {
        console.error('Failed to load vehicle data:', error);
        showToast('保守用車情報の読み込みに失敗しました', 'error');
    }
}

async function saveVehicle() {
    const vehicleId = document.getElementById('vehicle-id').value;
    const machineId = document.getElementById('vehicle-machine').value;
    
    if (!machineId) {
        showToast('機械番号を選択してください', 'error');
        return;
    }
    
    const vehicleData = {
        machine_id: machineId,
        vehicle_number: document.getElementById('vehicle-number').value,
        vehicle_type: document.getElementById('vehicle-type-text').value,
        registration_number: document.getElementById('vehicle-registration').value,
        office_id: document.getElementById('vehicle-office').value || null,
        notes: document.getElementById('vehicle-notes').value
    };

    try {
        const token = localStorage.getItem('user_token');
        const url = vehicleId ? `/api/vehicles/${vehicleId}` : '/api/vehicles';
        const method = vehicleId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vehicleData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(vehicleId ? '保守用車を更新しました' : '保守用車を追加しました', 'success');
            document.getElementById('vehicle-modal').style.display = 'none';
            loadVehicles();
        } else {
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save vehicle:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

function editVehicle(vehicleId) {
    openVehicleModal(vehicleId);
}

async function deleteVehicle(vehicleId, vehicleNumber) {
    if (!confirm(`保守用車「${vehicleNumber}」を削除してもよろしいですか？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/vehicles/${vehicleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('保守用車を削除しました', 'success');
            loadVehicles();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete vehicle:', error);
        showToast('削除中にエラーが発生しました', 'error');
    }
}

function getStatusLabel(status) {
    const labels = {
        'active': '稼働中',
        'maintenance': '整備中',
        'inactive': '停止中'
    };
    return labels[status] || status;
}

// ========== 事業所マスタ ==========
async function loadOffices() {
    const officesList = document.getElementById('offices-list');
    officesList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/offices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

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
        console.error('Failed to load offices:', error);
        officesList.innerHTML = '<p class="loading">事業所の読み込みに失敗しました</p>';
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
                        <label for="office_code">事業所コード *</label>
                        <input type="text" id="office_code" name="office_code" value="${office ? escapeHtml(office.office_code) : ''}" required ${mode === 'edit' ? 'readonly' : ''}>
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
                    <div class="form-group">
                        <label for="manager_name">責任者名</label>
                        <input type="text" id="manager_name" name="manager_name" value="${office ? escapeHtml(office.manager_name || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="email">メールアドレス</label>
                        <input type="email" id="email" name="email" value="${office ? escapeHtml(office.email || '') : ''}">
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

window.editOffice = function(officeId) {
    showOfficeModal('edit', officeId);
}

window.deleteOffice = async function(officeId, officeName) {
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

window.closeOfficeModal = function() {
    const modal = document.getElementById('office-modal');
    if (modal) modal.remove();
}

// ========== 保守基地マスタ ==========
async function loadBases() {
    const basesList = document.getElementById('bases-list');
    basesList.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/bases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

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
        console.error('Failed to load bases:', error);
        basesList.innerHTML = '<p class="loading">保守基地の読み込みに失敗しました</p>';
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
                        <label for="base_code">基地コード *</label>
                        <input type="text" id="base_code" name="base_code" value="${base ? escapeHtml(base.base_code) : ''}" required ${mode === 'edit' ? 'readonly' : ''}>
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
                    <div class="form-group">
                        <label for="latitude">緯度</label>
                        <input type="number" step="0.000001" id="latitude" name="latitude" value="${base ? (base.latitude || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="longitude">経度</label>
                        <input type="number" step="0.000001" id="longitude" name="longitude" value="${base ? (base.longitude || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="capacity">収容台数</label>
                        <input type="number" id="capacity" name="capacity" value="${base ? (base.capacity || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="manager_name">責任者名</label>
                        <input type="text" id="manager_name" name="manager_name" value="${base ? escapeHtml(base.manager_name || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="phone_number">電話番号</label>
                        <input type="text" id="phone_number" name="phone_number" value="${base ? escapeHtml(base.phone_number || '') : ''}">
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

window.editBase = function(baseId) {
    showBaseModal('edit', baseId);
}

window.deleteBase = async function(baseId, baseName) {
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

window.closeBaseModal = function() {
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
        const response = await fetch('/api/database/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

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
        }
    } catch (error) {
        console.error('Failed to load database stats:', error);
        document.getElementById('db-connection-status').innerHTML = 
            '<span class="status-badge status-error">✕ エラー</span>';
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

window.closeRecordModal = function() {
    const modal = document.getElementById('record-modal');
    if (modal) modal.remove();
}

window.editRecord = editRecord;
window.deleteRecord = deleteRecord;

// ========== CORS設定管理 ==========
async function loadCorsSettings() {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/config', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const corsOrigin = data.config.cors_origin || '*';
            document.getElementById('cors_origin').value = corsOrigin;
        }
    } catch (error) {
        console.error('Failed to load CORS settings:', error);
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

// 機種マスタ一覧読み込み
async function loadMachineTypes() {
    const token = localStorage.getItem('user_token');
    const container = document.getElementById('machine-types-list');

    try {
        const response = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.data) {
            let html = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>機種コード</th>
                            <th>機種名</th>
                            <th>メーカー</th>
                            <th>カテゴリ</th>
                            <th>説明</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.data.forEach(type => {
                html += `
                    <tr>
                        <td>${escapeHtml(type.type_code)}</td>
                        <td>${escapeHtml(type.type_name)}</td>
                        <td>${escapeHtml(type.manufacturer || '-')}</td>
                        <td>${escapeHtml(type.category || '-')}</td>
                        <td>${escapeHtml(type.description || '-')}</td>
                        <td>
                            <button class="btn-sm btn-edit" onclick="editMachineType(${type.id})">編集</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="error">機種マスタの読み込みに失敗しました</p>';
        }
    } catch (error) {
        console.error('Load machine types error:', error);
        container.innerHTML = '<p class="error">エラーが発生しました</p>';
    }
}

// 機械番号マスタ一覧読み込み（機種情報付き）
async function loadMachines() {
    const token = localStorage.getItem('user_token');
    const container = document.getElementById('machines-list');

    try {
        const response = await fetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.data) {
            let html = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>機械番号</th>
                            <th>機種コード</th>
                            <th>機種名</th>
                            <th>メーカー</th>
                            <th>シリアル番号</th>
                            <th>配属基地</th>
                            <th>ステータス</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.data.forEach(machine => {
                const statusBadge = machine.status === 'active' ? 'status-active' : 'status-inactive';
                const statusText = machine.status === 'active' ? '稼働中' : machine.status === 'maintenance' ? '保守中' : '廃棄';
                
                html += `
                    <tr>
                        <td><strong>${escapeHtml(machine.machine_number)}</strong></td>
                        <td>${escapeHtml(machine.type_code || '-')}</td>
                        <td>${escapeHtml(machine.type_name || '-')}</td>
                        <td>${escapeHtml(machine.manufacturer || '-')}</td>
                        <td>${escapeHtml(machine.serial_number || '-')}</td>
                        <td>${escapeHtml(machine.base_name || '-')}</td>
                        <td><span class="status-badge ${statusBadge}">${statusText}</span></td>
                        <td>
                            <button class="btn-sm btn-edit" onclick="editMachine(${machine.machine_id})">編集</button>
                            <button class="btn-sm btn-delete" onclick="deleteMachine(${machine.machine_id}, '${escapeHtml(machine.machine_number)}')">削除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="error">機械マスタの読み込みに失敗しました</p>';
        }
    } catch (error) {
        console.error('Load machines error:', error);
        container.innerHTML = '<p class="error">エラーが発生しました</p>';
    }
}

// 機種マスタモーダルを開く
async function openMachineTypeModal(typeId = null) {
    const modal = document.getElementById('machine-type-modal');
    const modalTitle = document.getElementById('machine-type-modal-title');
    const form = document.getElementById('machine-type-form');

    form.reset();
    document.getElementById('machine-type-id').value = '';

    if (typeId) {
        modalTitle.textContent = '機種を編集';
        // TODO: 機種データの読み込み
    } else {
        modalTitle.textContent = '機種を追加';
    }

    modal.style.display = 'block';
}

// 機械マスタモーダルを開く
async function openMachineModal(machineId = null) {
    const modal = document.getElementById('machine-modal');
    const modalTitle = document.getElementById('machine-modal-title');
    const form = document.getElementById('machine-form');
    const token = localStorage.getItem('user_token');

    form.reset();
    document.getElementById('machine-id').value = '';

    // 機種マスタを読み込んでセレクトボックスに設定
    try {
        const response = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('machine-type-select');
            select.innerHTML = '<option value="">-- 機種を選択 --</option>';
            data.data.forEach(type => {
                select.innerHTML += `<option value="${type.id}">${type.type_code} - ${type.type_name}</option>`;
            });
        }

        // 配属基地を読み込む
        const basesResponse = await fetch('/api/bases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const basesData = await basesResponse.json();

        if (basesData.success) {
            const baseSelect = document.getElementById('assigned-base');
            baseSelect.innerHTML = '<option value="">-- 配属基地を選択 --</option>';
            basesData.bases.forEach(base => {
                baseSelect.innerHTML += `<option value="${base.base_id}">${base.base_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load options:', error);
    }

    if (machineId) {
        modalTitle.textContent = '機械を編集';
        // TODO: 機械データの読み込み
    } else {
        modalTitle.textContent = '機械を追加';
    }

    modal.style.display = 'block';
}

// 機種マスタ送信処理
async function handleMachineTypeSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem('user_token');
    const typeId = document.getElementById('machine-type-id').value;
    const formData = {
        type_code: document.getElementById('type-code').value,
        type_name: document.getElementById('type-name').value,
        manufacturer: document.getElementById('manufacturer').value,
        category: document.getElementById('category').value,
        description: document.getElementById('type-description').value
    };

    try {
        const url = typeId ? `/api/machine-types/${typeId}` : '/api/machine-types';
        const method = typeId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message || '機種を保存しました', 'success');
            document.getElementById('machine-type-modal').style.display = 'none';
            loadMachineTypes();
        } else {
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Machine type submit error:', error);
        showToast('エラーが発生しました', 'error');
    }
}

// 機械マスタ送信処理
async function handleMachineSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem('user_token');
    const machineId = document.getElementById('machine-id').value;
    const formData = {
        machine_number: document.getElementById('machine-number').value,
        machine_type_id: document.getElementById('machine-type-select').value,
        serial_number: document.getElementById('serial-number').value,
        manufacture_date: document.getElementById('manufacture-date').value || null,
        purchase_date: document.getElementById('purchase-date').value || null,
        status: document.getElementById('machine-status').value,
        assigned_base_id: document.getElementById('assigned-base').value || null,
        notes: document.getElementById('machine-notes').value
    };

    try {
        const url = machineId ? `/api/machines/${machineId}` : '/api/machines';
        const method = machineId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message || '機械を保存しました', 'success');
            document.getElementById('machine-modal').style.display = 'none';
            loadMachines();
        } else {
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Machine submit error:', error);
        showToast('エラーが発生しました', 'error');
    }
}

// 機械削除
async function deleteMachine(machineId, machineNumber) {
    if (!confirm(`機械番号 ${machineNumber} を削除してもよろしいですか？`)) {
        return;
    }

    const token = localStorage.getItem('user_token');

    try {
        const response = await fetch(`/api/machines/${machineId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message || '機械を削除しました', 'success');
            loadMachines();
        } else {
            showToast(data.message || '削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Machine delete error:', error);
        showToast('エラーが発生しました', 'error');
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
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
