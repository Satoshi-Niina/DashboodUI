document.addEventListener('DOMContentLoaded', () => {
    // 隱崎ｨｼ繝√ぉ繝・け
    const token = localStorage.getItem('user_token');
    console.log('[Admin] Token check:', token ? 'Token exists' : 'No token found');
    console.log('[Admin] Initializing admin page...');
    
    if (!token) {
        console.error('[Admin] No token, redirecting to login');
        window.location.href = '/';
        return;
    }

    // 繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ縺ｮ陦ｨ遉ｺ縺ｨ繝ｭ繝ｼ繝ｫ繝√ぉ繝・け
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    console.log('[Admin] User info:', userInfo);
    console.log('[Admin] User role:', userInfo.role);
    document.getElementById('admin-user').textContent = userInfo.displayName || userInfo.username;

    // 繧ｷ繧ｹ繝・Β邂｡逅・・∪縺溘・驕狗畑邂｡逅・・・縺ｿ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ
    if (userInfo.role !== 'system_admin' && userInfo.role !== 'operation_admin') {
        console.error('[Admin] Access denied - role:', userInfo.role);
        alert('繧｢繧ｯ繧ｻ繧ｹ讓ｩ髯舌′縺ゅｊ縺ｾ縺帙ｓ縲らｮ｡逅・・ｨｩ髯舌′蠢・ｦ√〒縺吶・);
        window.location.href = '/index.html';
        return;
    }
    
    console.log('[Admin] Access granted for admin user');

    // 繝｡繧､繝ｳ逕ｻ髱｢縺ｫ謌ｻ繧・
    document.getElementById('back-to-main-btn').addEventListener('click', () => {
        window.location.href = '/index.html';
    });

    // 繧ｿ繝匁ｩ溯・縺ｮ蛻晄悄蛹・
    initializeTabs();

    // 蛻晄悄繝ｭ繝ｼ繝・
    loadUsers();
    loadOffices();
    loadBases();
    loadMachineTypes();
    loadMachines();
    loadVehicles();
    loadDatabaseStats();

    // 繧､繝吶Φ繝医Μ繧ｹ繝翫・縺ｮ蛻晄悄蛹・
    initializeEventListeners();
    initializeCorsSettings();
});

// 繧ｿ繝匁ｩ溯・
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    console.log('[initializeTabs] Found tab buttons:', tabButtons.length);
    console.log('[initializeTabs] Found tab contents:', tabContents.length);

    // 譛蛻昴・繧ｿ繝悶ｒ繧｢繧ｯ繝・ぅ繝悶↓縺吶ｋ
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

            // 縺吶∋縺ｦ縺ｮ繧ｿ繝悶・繧ｿ繝ｳ縺ｨ繧ｳ繝ｳ繝・Φ繝・ｒ髱槭い繧ｯ繝・ぅ繝悶↓縺吶ｋ
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');

            // 繧ｯ繝ｪ繝・け縺輔ｌ縺溘ち繝悶ｒ繧｢繧ｯ繝・ぅ繝悶↓縺吶ｋ
            button.classList.add('active');
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) {
                targetTab.style.display = 'block';
                console.log('[Tab Click] Tab activated:', tabName);
            } else {
                console.error('[Tab Click] Tab content not found:', `${tabName}-tab`);
            }

            // 繧ｿ繝悶↓蠢懊§縺ｦ繝・・繧ｿ繧定ｪｭ縺ｿ霎ｼ縺ｿ
            if (tabName === 'user-management') {
                loadUsers();
            } else if (tabName === 'office-master') {
                loadOffices();
            } else if (tabName === 'base-master') {
                loadBases();
            } else if (tabName === 'machine-type-master') {
                loadMachineTypes();
            } else if (tabName === 'machine-master') {
                loadMachines();
            } else if (tabName === 'vehicle-master') {
                loadVehicles();
            } else if (tabName === 'database-management') {
                loadDatabaseStats();
            } else if (tabName === 'cors-settings') {
                loadCorsSettings();
            }
        });
    });
}

// 繧､繝吶Φ繝医Μ繧ｹ繝翫・縺ｮ蛻晄悄蛹・
function initializeEventListeners() {
    // 繝ｦ繝ｼ繧ｶ繝ｼ霑ｽ蜉繝懊ち繝ｳ
    const addUserBtn = document.getElementById('add-new-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserModal());
    }

    // 繝ｦ繝ｼ繧ｶ繝ｼ繝｢繝ｼ繝繝ｫ縺ｮ繧､繝吶Φ繝医Μ繧ｹ繝翫・
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

    // 莠区･ｭ謇霑ｽ蜉繝懊ち繝ｳ
    const addOfficeBtn = document.getElementById('add-new-office-btn');
    if (addOfficeBtn) {
        addOfficeBtn.addEventListener('click', () => showOfficeModal('add', null));
    }

    // 菫晏ｮ亥渕蝨ｰ霑ｽ蜉繝懊ち繝ｳ
    const addBaseBtn = document.getElementById('add-new-base-btn');
    if (addBaseBtn) {
        addBaseBtn.addEventListener('click', () => showBaseModal('add', null));
    }

    // 讖溽ｨｮ繝槭せ繧ｿ霑ｽ蜉繝懊ち繝ｳ
    const addMachineTypeBtn = document.getElementById('add-new-machine-type-btn');
    if (addMachineTypeBtn) {
        addMachineTypeBtn.addEventListener('click', () => showMachineTypeModal('add', null));
    }

    // 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ霑ｽ蜉繝懊ち繝ｳ
    const addMachineBtn = document.getElementById('add-new-machine-btn');
    if (addMachineBtn) {
        addMachineBtn.addEventListener('click', () => showMachineModal('add', null));
    }

    // 菫晏ｮ育畑霆願ｿｽ蜉繝懊ち繝ｳ
    const addVehicleBtn = document.getElementById('add-new-vehicle-btn');
    if (addVehicleBtn) {
        addVehicleBtn.addEventListener('click', () => openVehicleModal());
    }

    // 讖溽ｨｮ繝槭せ繧ｿ繝｢繝ｼ繝繝ｫ縺ｮ繧､繝吶Φ繝医Μ繧ｹ繝翫・
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
            await handleMachineTypeSubmit(e);
        });
    }

    // 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ繝｢繝ｼ繝繝ｫ縺ｮ繧､繝吶Φ繝医Μ繧ｹ繝翫・
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
            await handleMachineSubmit(e);
        });
    }

    // 菫晏ｮ育畑霆翫Δ繝ｼ繝繝ｫ縺ｮ繧､繝吶Φ繝医Μ繧ｹ繝翫・
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

// ========== 繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・==========
async function loadUsers() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<p class="loading">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

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
            usersList.innerHTML = data.users.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <div class="username">${escapeHtml(user.username)}</div>
                        <div class="display-name">${escapeHtml(user.display_name || '')}</div>
                        <span class="role-badge role-${user.role}">${user.role === 'admin' ? '邂｡逅・・ : '繝ｦ繝ｼ繧ｶ繝ｼ'}</span>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" onclick="editUser(${user.id})">笨擾ｸ・邱ｨ髮・/button>
                        <button class="btn-delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">卵・・蜑企勁</button>
                    </div>
                </div>
            `).join('');
        } else {
            usersList.innerHTML = '<p class="loading">繝ｦ繝ｼ繧ｶ繝ｼ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>';
        }
    } catch (error) {
        console.error('[loadUsers] Error:', error);
        usersList.innerHTML = `<p class="loading" style="color: red;">笞・・繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆<br>繧ｨ繝ｩ繝ｼ: ${error.message}<br>繝・・繧ｿ繝吶・繧ｹ謗･邯壹ｒ遒ｺ隱阪＠縺ｦ縺上□縺輔＞</p>`;
    }
}

function openUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('user-form');
    
    form.reset();
    document.getElementById('user-id').value = '';
    
    if (userId) {
        modalTitle.textContent = '繝ｦ繝ｼ繧ｶ繝ｼ繧堤ｷｨ髮・;
        loadUserData(userId);
    } else {
        modalTitle.textContent = '繝ｦ繝ｼ繧ｶ繝ｼ繧定ｿｽ蜉';
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
        showToast('繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
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
            showToast(userId ? '繝ｦ繝ｼ繧ｶ繝ｼ繧呈峩譁ｰ縺励∪縺励◆' : '繝ｦ繝ｼ繧ｶ繝ｼ繧定ｿｽ蜉縺励∪縺励◆', 'success');
            document.getElementById('user-modal').style.display = 'none';
            loadUsers();
        } else {
            showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to save user:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

function editUser(userId) {
    openUserModal(userId);
}

async function deleteUser(userId, username) {
    if (!confirm(`繝ｦ繝ｼ繧ｶ繝ｼ縲・{username}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歔)) {
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
            showToast('繝ｦ繝ｼ繧ｶ繝ｼ繧貞炎髯､縺励∪縺励◆', 'success');
            loadUsers();
        } else {
            showToast(data.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to delete user:', error);
        showToast('蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

// ========== 菫晏ｮ育畑霆翫・繧ｹ繧ｿ ==========
async function loadVehicles() {
    const vehiclesList = document.getElementById('vehicles-list');
    vehiclesList.innerHTML = '<p class="loading">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

    try {
        const token = localStorage.getItem('user_token');
        console.log('[loadVehicles] Fetching vehicles...');
        const response = await fetch('/api/vehicles', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[loadVehicles] Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[loadVehicles] Data received:', data);

        if (data.success && data.vehicles.length > 0) {
            let html = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>霆贋ｸ｡逡ｪ蜿ｷ</th>
                            <th>讖溽ｨｮ</th>
                            <th>讖滓｢ｰ逡ｪ蜿ｷ</th>
                            <th>邂｡逅・ｺ区･ｭ謇</th>
                            <th>霆贋ｸ｡逋ｻ骭ｲ逡ｪ蜿ｷ</th>
                            <th>蛯呵・/th>
                            <th>謫堺ｽ・/th>
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
                            <button class="btn-sm btn-edit" onclick="editVehicle(${vehicle.vehicle_id})">邱ｨ髮・/button>
                            <button class="btn-sm btn-delete" onclick="deleteVehicle(${vehicle.vehicle_id}, '${escapeHtml(vehicle.vehicle_number || vehicle.machine_number)}')">蜑企勁</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            vehiclesList.innerHTML = html;
        } else {
            vehiclesList.innerHTML = '<p class="loading">菫晏ｮ育畑霆翫′逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>';
        }
    } catch (error) {
        console.error('[loadVehicles] Error:', error);
        vehiclesList.innerHTML = `<p class="loading" style="color: red;">笞・・菫晏ｮ育畑霆翫・隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆<br>繧ｨ繝ｩ繝ｼ: ${error.message}<br>繝・・繧ｿ繝吶・繧ｹ謗･邯壹ｒ遒ｺ隱阪＠縺ｦ縺上□縺輔＞</p>`;
    }
}

async function openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('vehicle-modal');
    const modalTitle = document.getElementById('vehicle-modal-title');
    const form = document.getElementById('vehicle-form');
    const token = localStorage.getItem('user_token');
    
    form.reset();
    document.getElementById('vehicle-id').value = '';
    
    // 譁ｰ隕冗匳骭ｲ繝輔ぅ繝ｼ繝ｫ繝峨ｒ髱櫁｡ｨ遉ｺ縺ｫ縺吶ｋ
    document.getElementById('new-machine-type-fields').style.display = 'none';
    document.getElementById('new-machine-fields').style.display = 'none';
    
    // 讖溽ｨｮ繝槭せ繧ｿ繧定ｪｭ縺ｿ霎ｼ繧
    try {
        const machineTypesResponse = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const machineTypesData = await machineTypesResponse.json();

        if (machineTypesData.success) {
            const machineTypeSelect = document.getElementById('vehicle-machine-type');
            machineTypeSelect.innerHTML = '<option value="">-- 讖溽ｨｮ繧帝∈謚・--</option>';
            machineTypeSelect.innerHTML += '<option value="__new__">筐・譁ｰ縺励＞讖溽ｨｮ繧堤匳骭ｲ</option>';
            machineTypesData.data.forEach(type => {
                machineTypeSelect.innerHTML += `<option value="${type.id}">${type.type_code} - ${type.type_name}</option>`;
            });

            // 讖溽ｨｮ驕ｸ謚樊凾縺ｮ繧､繝吶Φ繝・
            machineTypeSelect.onchange = async () => {
                const typeId = machineTypeSelect.value;
                if (typeId === '__new__') {
                    document.getElementById('new-machine-type-fields').style.display = 'block';
                    // 譁ｰ隕乗ｩ溽ｨｮ縺ｮ蝣ｴ蜷医∵ｩ滓｢ｰ逡ｪ蜿ｷ繧よ眠隕上↓縺吶ｋ
                    document.getElementById('vehicle-machine').value = '__new__';
                    document.getElementById('new-machine-fields').style.display = 'block';
                } else {
                    document.getElementById('new-machine-type-fields').style.display = 'none';
                    await loadMachinesForType(typeId);
                }
            };
        }

        // 蜈ｨ讖滓｢ｰ逡ｪ蜿ｷ繧定ｪｭ縺ｿ霎ｼ繧
        await loadMachinesForType(null);

        // 讖滓｢ｰ逡ｪ蜿ｷ驕ｸ謚樊凾縺ｮ繧､繝吶Φ繝・
        const machineSelect = document.getElementById('vehicle-machine');
        machineSelect.onchange = () => {
            const machineId = machineSelect.value;
            if (machineId === '__new__') {
                document.getElementById('new-machine-fields').style.display = 'block';
            } else {
                document.getElementById('new-machine-fields').style.display = 'none';
            }
        };

        // 驟榊ｱ槫渕蝨ｰ繧定ｪｭ縺ｿ霎ｼ繧・域眠隕乗ｩ滓｢ｰ逕ｨ・・
        const basesResponse = await fetch('/api/bases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const basesData = await basesResponse.json();

        if (basesData.success) {
            const newBaseSelect = document.getElementById('new-assigned-base');
            newBaseSelect.innerHTML = '<option value="">-- 驟榊ｱ槫渕蝨ｰ繧帝∈謚・--</option>';
            basesData.bases.forEach(base => {
                newBaseSelect.innerHTML += `<option value="${base.base_id}">${base.base_name}</option>`;
            });
        }

        // 莠区･ｭ謇繧定ｪｭ縺ｿ霎ｼ繧
        const officesResponse = await fetch('/api/offices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const officesData = await officesResponse.json();

        if (officesData.success) {
            const officeSelect = document.getElementById('vehicle-office');
            officeSelect.innerHTML = '<option value="">-- 莠区･ｭ謇繧帝∈謚・--</option>';
            officesData.offices.forEach(office => {
                officeSelect.innerHTML += `<option value="${office.office_id}">${office.office_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load options:', error);
    }
    
    if (vehicleId) {
        modalTitle.textContent = '菫晏ｮ育畑霆翫ｒ邱ｨ髮・;
        await loadVehicleData(vehicleId);
    } else {
        modalTitle.textContent = '菫晏ｮ育畑霆翫ｒ霑ｽ蜉';
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
            machineSelect.innerHTML = '<option value="">-- 讖滓｢ｰ逡ｪ蜿ｷ繧帝∈謚・--</option>';
            machineSelect.innerHTML += '<option value="__new__">筐・譁ｰ縺励＞讖滓｢ｰ逡ｪ蜿ｷ繧堤匳骭ｲ</option>';
            const filteredMachines = typeId 
                ? data.data.filter(m => m.machine_type_id == typeId)
                : data.data;
                
            filteredMachines.forEach(machine => {
                machineSelect.innerHTML += `<option value="${machine.machine_id}">${machine.machine_number} (${machine.type_name || '讖溽ｨｮ譛ｪ險ｭ螳・})</option>`;
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
        showToast('菫晏ｮ育畑霆頑ュ蝣ｱ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
    }
}

async function saveVehicle() {
    const vehicleId = document.getElementById('vehicle-id').value;
    const token = localStorage.getItem('user_token');
    let machineId = document.getElementById('vehicle-machine').value;
    const machineTypeId = document.getElementById('vehicle-machine-type').value;
    
    if (!machineId) {
        showToast('讖滓｢ｰ逡ｪ蜿ｷ繧帝∈謚槭＠縺ｦ縺上□縺輔＞', 'error');
        return;
    }

    try {
        // 譁ｰ隕乗ｩ溽ｨｮ繧堤匳骭ｲ縺吶ｋ蝣ｴ蜷・
        if (machineTypeId === '__new__') {
            const newTypeCode = document.getElementById('new-type-code').value;
            const newTypeName = document.getElementById('new-type-name').value;
            
            if (!newTypeCode || !newTypeName) {
                showToast('讖溽ｨｮ繧ｳ繝ｼ繝峨→讖溽ｨｮ蜷阪ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞', 'error');
                return;
            }

            const typeData = {
                type_code: newTypeCode,
                type_name: newTypeName,
                manufacturer: document.getElementById('new-manufacturer').value,
                category: document.getElementById('new-category').value
            };

            const typeResponse = await fetch('/api/machine-types', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(typeData)
            });

            const typeResult = await typeResponse.json();
            
            if (!typeResult.success) {
                showToast(typeResult.message || '讖溽ｨｮ縺ｮ逋ｻ骭ｲ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
                return;
            }

            // 逋ｻ骭ｲ縺励◆讖溽ｨｮ縺ｮID繧貞叙蠕・
            const newMachineTypeId = typeResult.data.id;

            // 譁ｰ隕乗ｩ滓｢ｰ逡ｪ蜿ｷ繧堤匳骭ｲ・域眠隕乗ｩ溽ｨｮ縺ｮ蝣ｴ蜷医・蠢・★譁ｰ隕乗ｩ滓｢ｰ・・
            const newMachineNumber = document.getElementById('new-machine-number').value;
            
            if (!newMachineNumber) {
                showToast('讖滓｢ｰ逡ｪ蜿ｷ繧貞・蜉帙＠縺ｦ縺上□縺輔＞', 'error');
                return;
            }

            const machineData = {
                machine_number: newMachineNumber,
                machine_type_id: newMachineTypeId,
                serial_number: document.getElementById('new-serial-number').value,
                manufacture_date: document.getElementById('new-manufacture-date').value,
                assigned_base_id: document.getElementById('new-assigned-base').value || null,
                status: 'active'
            };

            const machineResponse = await fetch('/api/machines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(machineData)
            });

            const machineResult = await machineResponse.json();
            
            if (!machineResult.success) {
                showToast(machineResult.message || '讖滓｢ｰ逡ｪ蜿ｷ縺ｮ逋ｻ骭ｲ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
                return;
            }

            machineId = machineResult.data.id;
        }
        // 譁ｰ隕乗ｩ滓｢ｰ逡ｪ蜿ｷ縺ｮ縺ｿ繧堤匳骭ｲ縺吶ｋ蝣ｴ蜷・
        else if (machineId === '__new__') {
            if (!machineTypeId) {
                showToast('讖溽ｨｮ繧帝∈謚槭＠縺ｦ縺上□縺輔＞', 'error');
                return;
            }

            const newMachineNumber = document.getElementById('new-machine-number').value;
            
            if (!newMachineNumber) {
                showToast('讖滓｢ｰ逡ｪ蜿ｷ繧貞・蜉帙＠縺ｦ縺上□縺輔＞', 'error');
                return;
            }

            const machineData = {
                machine_number: newMachineNumber,
                machine_type_id: machineTypeId,
                serial_number: document.getElementById('new-serial-number').value,
                manufacture_date: document.getElementById('new-manufacture-date').value,
                assigned_base_id: document.getElementById('new-assigned-base').value || null,
                status: 'active'
            };

            const machineResponse = await fetch('/api/machines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(machineData)
            });

            const machineResult = await machineResponse.json();
            
            if (!machineResult.success) {
                showToast(machineResult.message || '讖滓｢ｰ逡ｪ蜿ｷ縺ｮ逋ｻ骭ｲ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
                return;
            }

            machineId = machineResult.data.id;
        }

        // 菫晏ｮ育畑霆翫ョ繝ｼ繧ｿ繧剃ｿ晏ｭ・
        const vehicleData = {
            machine_id: machineId,
            vehicle_number: document.getElementById('vehicle-number').value,
            model: document.getElementById('vehicle-type-text').value, // 蝙句ｼ・
            registration_number: document.getElementById('vehicle-registration').value,
            office_id: document.getElementById('vehicle-office').value || null,
            notes: document.getElementById('vehicle-notes').value
        };

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
            showToast(vehicleId ? '菫晏ｮ育畑霆翫ｒ譖ｴ譁ｰ縺励∪縺励◆' : '菫晏ｮ育畑霆翫ｒ霑ｽ蜉縺励∪縺励◆', 'success');
            document.getElementById('vehicle-modal').style.display = 'none';
            loadVehicles();
        } else {
            showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to save vehicle:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

function editVehicle(vehicleId) {
    openVehicleModal(vehicleId);
}

async function deleteVehicle(vehicleId, vehicleNumber) {
    if (!confirm(`菫晏ｮ育畑霆翫・{vehicleNumber}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歔)) {
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
            showToast('菫晏ｮ育畑霆翫ｒ蜑企勁縺励∪縺励◆', 'success');
            loadVehicles();
        } else {
            showToast(data.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to delete vehicle:', error);
        showToast('蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

function getStatusLabel(status) {
    const labels = {
        'active': '遞ｼ蜒堺ｸｭ',
        'maintenance': '謨ｴ蛯吩ｸｭ',
        'inactive': '蛛懈ｭ｢荳ｭ'
    };
    return labels[status] || status;
}

// ========== 莠区･ｭ謇繝槭せ繧ｿ ==========
async function loadOffices() {
    const officesList = document.getElementById('offices-list');
    officesList.innerHTML = '<p class="loading">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

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
                        <div class="vehicle-type">召 ${escapeHtml(office.office_name)}</div>
                        <div class="vehicle-number">繧ｳ繝ｼ繝・ ${escapeHtml(office.office_code)} | ${escapeHtml(office.office_type || '-')}</div>
                        <div class="vehicle-number" style="font-size: 12px; color: #666;">
                            ${escapeHtml(office.address || '-')} | 雋ｬ莉ｻ閠・ ${escapeHtml(office.manager_name || '-')}
                        </div>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" onclick="editOffice(${office.office_id})">笨擾ｸ・邱ｨ髮・/button>
                        <button class="btn-delete" onclick="deleteOffice(${office.office_id}, '${escapeHtml(office.office_name)}')">卵・・蜑企勁</button>
                    </div>
                </div>
            `).join('');
        } else {
            officesList.innerHTML = '<p class="loading">莠区･ｭ謇縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>';
        }
    } catch (error) {
        console.error('[loadOffices] Error:', error);
        officesList.innerHTML = `<p class="loading" style="color: red;">笞・・莠区･ｭ謇縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆<br>繧ｨ繝ｩ繝ｼ: ${error.message}<br>繝・・繧ｿ繝吶・繧ｹ謗･邯壹ｒ遒ｺ隱阪＠縺ｦ縺上□縺輔＞</p>`;
    }
}

function showOfficeModal(mode, officeId) {
    const offices = [];
    if (mode === 'edit') {
        // 譌｢蟄倥ョ繝ｼ繧ｿ繧貞叙蠕・
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
                    <h2>${mode === 'add' ? '譁ｰ隕丈ｺ区･ｭ謇霑ｽ蜉' : '莠区･ｭ謇邱ｨ髮・}</h2>
                    <button class="modal-close" onclick="closeOfficeModal()">&times;</button>
                </div>
                <form id="office-form" class="modal-form">
                    ${mode === 'edit' ? `
                    <div class="form-group">
                        <label for="office_code">莠区･ｭ謇繧ｳ繝ｼ繝・/label>
                        <input type="text" id="office_code" name="office_code" value="${escapeHtml(office.office_code)}" readonly>
                    </div>
                    ` : ''}
                    <div class="form-group">
                        <label for="office_name">莠区･ｭ謇蜷・*</label>
                        <input type="text" id="office_name" name="office_name" value="${office ? escapeHtml(office.office_name) : ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="office_type">莠区･ｭ謇蛹ｺ蛻・/label>
                        <select id="office_type" name="office_type">
                            <option value="">-- 驕ｸ謚・--</option>
                            <option value="譛ｬ遉ｾ" ${office && office.office_type === '譛ｬ遉ｾ' ? 'selected' : ''}>譛ｬ遉ｾ</option>
                            <option value="謾ｯ蠎・ ${office && office.office_type === '謾ｯ蠎・ ? 'selected' : ''}>謾ｯ蠎・/option>
                            <option value="蝟ｶ讌ｭ謇" ${office && office.office_type === '蝟ｶ讌ｭ謇' ? 'selected' : ''}>蝟ｶ讌ｭ謇</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="address">菴乗園</label>
                        <input type="text" id="address" name="address" value="${office ? escapeHtml(office.address || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="postal_code">驛ｵ萓ｿ逡ｪ蜿ｷ</label>
                        <input type="text" id="postal_code" name="postal_code" value="${office ? escapeHtml(office.postal_code || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="phone_number">髮ｻ隧ｱ逡ｪ蜿ｷ</label>
                        <input type="text" id="phone_number" name="phone_number" value="${office ? escapeHtml(office.phone_number || '') : ''}">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeOfficeModal()">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
                        <button type="submit" class="btn-primary">菫晏ｭ・/button>
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
            showToast(mode === 'add' ? '莠区･ｭ謇繧定ｿｽ蜉縺励∪縺励◆' : '莠区･ｭ謇繧呈峩譁ｰ縺励∪縺励◆', 'success');
            closeOfficeModal();
            loadOffices();
        } else {
            showToast(result.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Save office error:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

window.editOffice = function(officeId) {
    showOfficeModal('edit', officeId);
}

window.deleteOffice = async function(officeId, officeName) {
    if (!confirm(`莠区･ｭ謇縲・{officeName}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歔)) {
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
            showToast('莠区･ｭ謇繧貞炎髯､縺励∪縺励◆', 'success');
            loadOffices();
        } else {
            showToast(data.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to delete office:', error);
        showToast('蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

window.closeOfficeModal = function() {
    const modal = document.getElementById('office-modal');
    if (modal) modal.remove();
}

// ========== 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ ==========
async function loadBases() {
    const basesList = document.getElementById('bases-list');
    basesList.innerHTML = '<p class="loading">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

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
                        <div class="vehicle-type">女・・${escapeHtml(base.base_name)}</div>
                        <div class="vehicle-number">繧ｳ繝ｼ繝・ ${escapeHtml(base.base_code)} | 莠区･ｭ謇: ${escapeHtml(base.office_name || '-')}</div>
                        <div class="vehicle-number" style="font-size: 12px; color: #666;">
                            ${escapeHtml(base.location || '-')} | 蜿主ｮｹ謨ｰ: ${base.capacity || '-'} | 雋ｬ莉ｻ閠・ ${escapeHtml(base.manager_name || '-')}
                        </div>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" onclick="editBase(${base.base_id})">笨擾ｸ・邱ｨ髮・/button>
                        <button class="btn-delete" onclick="deleteBase(${base.base_id}, '${escapeHtml(base.base_name)}')">卵・・蜑企勁</button>
                    </div>
                </div>
            `).join('');
        } else {
            basesList.innerHTML = '<p class="loading">菫晏ｮ亥渕蝨ｰ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>';
        }
    } catch (error) {
        console.error('[loadBases] Error:', error);
        basesList.innerHTML = `<p class="loading" style="color: red;">笞・・菫晏ｮ亥渕蝨ｰ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆<br>繧ｨ繝ｩ繝ｼ: ${error.message}<br>繝・・繧ｿ繝吶・繧ｹ謗･邯壹ｒ遒ｺ隱阪＠縺ｦ縺上□縺輔＞</p>`;
    }
}

async function showBaseModal(mode, baseId) {
    // 莠区･ｭ謇繝ｪ繧ｹ繝医ｒ蜿門ｾ・
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
                    <h2>${mode === 'add' ? '譁ｰ隕丈ｿ晏ｮ亥渕蝨ｰ霑ｽ蜉' : '菫晏ｮ亥渕蝨ｰ邱ｨ髮・}</h2>
                    <button class="modal-close" onclick="closeBaseModal()">&times;</button>
                </div>
                <form id="base-form" class="modal-form">
                    ${mode === 'edit' ? `
                    <div class="form-group">
                        <label for="base_code">蝓ｺ蝨ｰ繧ｳ繝ｼ繝・/label>
                        <input type="text" id="base_code" name="base_code" value="${escapeHtml(base.base_code)}" readonly>
                    </div>
                    ` : ''}
                    <div class="form-group">
                        <label for="base_name">蝓ｺ蝨ｰ蜷・*</label>
                        <input type="text" id="base_name" name="base_name" value="${base ? escapeHtml(base.base_name) : ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="office_id">謇螻樔ｺ区･ｭ謇</label>
                        <select id="office_id" name="office_id">
                            <option value="">-- 驕ｸ謚・--</option>
                            ${officeOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="location">謇蝨ｨ蝨ｰ</label>
                        <input type="text" id="location" name="location" value="${base ? escapeHtml(base.location || '') : ''}">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeBaseModal()">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
                        <button type="submit" class="btn-primary">菫晏ｭ・/button>
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
            showToast(mode === 'add' ? '菫晏ｮ亥渕蝨ｰ繧定ｿｽ蜉縺励∪縺励◆' : '菫晏ｮ亥渕蝨ｰ繧呈峩譁ｰ縺励∪縺励◆', 'success');
            closeBaseModal();
            loadBases();
        } else {
            showToast(result.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Save base error:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

window.editBase = function(baseId) {
    showBaseModal('edit', baseId);
}

window.deleteBase = async function(baseId, baseName) {
    if (!confirm(`菫晏ｮ亥渕蝨ｰ縲・{baseName}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歔)) {
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
            showToast('菫晏ｮ亥渕蝨ｰ繧貞炎髯､縺励∪縺励◆', 'success');
            loadBases();
        } else {
            showToast(data.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to delete base:', error);
        showToast('蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

window.closeBaseModal = function() {
    const modal = document.getElementById('base-modal');
    if (modal) modal.remove();
}

function getStatusLabel(status) {
    const labels = {
        'active': '遞ｼ蜒堺ｸｭ',
        'maintenance': '謨ｴ蛯吩ｸｭ',
        'inactive': '蛛懈ｭ｢荳ｭ'
    };
    return labels[status] || status;
}

// ========== 繝・・繧ｿ繝吶・繧ｹ邂｡逅・==========
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
            // 謗･邯夂憾諷・
            const statusBadge = document.getElementById('db-connection-status');
            if (data.stats.connected) {
                statusBadge.innerHTML = '<span class="status-badge status-connected">笨・謗･邯壻ｸｭ</span>';
            } else {
                statusBadge.innerHTML = '<span class="status-badge status-error">笨・繧ｨ繝ｩ繝ｼ</span>';
            }

            // 繝舌・繧ｸ繝ｧ繝ｳ
            document.getElementById('db-version').textContent = data.stats.version || '--';

            // 謗･邯壽焚
            const connections = data.stats.connections || '--';
            document.getElementById('db-connections').textContent = connections;
            document.getElementById('connection-count').textContent = connections;

            // 繝・ぅ繧ｹ繧ｯ菴ｿ逕ｨ邇・
            const diskUsage = data.stats.disk_usage || 0;
            document.getElementById('disk-usage').textContent = diskUsage + '%';
            document.getElementById('disk-progress').style.width = diskUsage + '%';

            // 繝・・繧ｿ繝吶・繧ｹ繧ｵ繧､繧ｺ
            document.getElementById('db-size').textContent = data.stats.database_size || '--';

            // 遞ｼ蜒肴凾髢・
            document.getElementById('uptime').textContent = data.stats.uptime || '--';

            // 繝・・繝悶Ν繧ｵ繧､繧ｺ
            const tableSizes = document.getElementById('table-sizes');
            if (data.stats.table_sizes && data.stats.table_sizes.length > 0) {
                tableSizes.innerHTML = data.stats.table_sizes.map(table => `
                    <div class="table-size-item">
                        <span class="table-name">${escapeHtml(table.table_name)}</span>
                        <span class="table-size">${table.size}</span>
                    </div>
                `).join('');
            } else {
                tableSizes.innerHTML = '<p class="loading">繝・・繝悶Ν諠・ｱ縺後≠繧翫∪縺帙ｓ</p>';
            }
        } else {
            console.error('[loadDatabaseStats] Response not successful:', data);
        }
    } catch (error) {
        console.error('[loadDatabaseStats] Error:', error);
        const statusBadge = document.getElementById('db-connection-status');
        if (statusBadge) {
            statusBadge.innerHTML = `<span class="status-badge status-error">笨・繧ｨ繝ｩ繝ｼ: ${error.message}</span>`;
        }
        showToast('繝・・繧ｿ繝吶・繧ｹ諠・ｱ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
    }

    // 繝・・繝悶Ν邂｡逅・ｩ溯・縺ｮ蛻晄悄蛹・
    initializeTableManagement();
}

// 繝・・繝悶Ν邂｡逅・ｩ溯・
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

    // 繝・・繝悶Ν隱ｭ縺ｿ霎ｼ縺ｿ
    loadTableBtn.addEventListener('click', async () => {
        const selectedTable = tableSelect.value;
        if (!selectedTable) {
            showToast('繝・・繝悶Ν繧帝∈謚槭＠縺ｦ縺上□縺輔＞', 'error');
            return;
        }
        currentTable = selectedTable;
        await loadTableData(selectedTable);
        exportCsvBtn.disabled = false;
        importCsvBtn.disabled = false;
    });

    // 譁ｰ隕上Ξ繧ｳ繝ｼ繝芽ｿｽ蜉
    addRecordBtn.addEventListener('click', () => {
        if (!currentTable) {
            showToast('蜈医↓繝・・繝悶Ν繧帝∈謚槭＠縺ｦ縺上□縺輔＞', 'error');
            return;
        }
        showRecordModal('add', null);
    });

    // CSV繧ｨ繧ｯ繧ｹ繝昴・繝・
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
                showToast('CSV繧ｨ繧ｯ繧ｹ繝昴・繝域・蜉・, 'success');
            } else {
                showToast('繧ｨ繧ｯ繧ｹ繝昴・繝医↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
            }
        } catch (error) {
            console.error('Export error:', error);
            showToast('繧ｨ繧ｯ繧ｹ繝昴・繝井ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
        }
    });

    // CSV繧､繝ｳ繝昴・繝・
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
                    showToast(data.message || '繧､繝ｳ繝昴・繝医↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
                }
            } catch (error) {
                console.error('Import error:', error);
                showToast('繧､繝ｳ繝昴・繝井ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // 繝ｪ繧ｻ繝・ヨ
    });

    // 繝・・繧ｿ繝吶・繧ｹ繝舌ャ繧ｯ繧｢繝・・
    backupDbBtn.addEventListener('click', async () => {
        if (!confirm('繝・・繧ｿ繝吶・繧ｹ蜈ｨ菴薙・繝舌ャ繧ｯ繧｢繝・・繧剃ｽ懈・縺励∪縺吶°・・)) return;

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
                showToast('繝舌ャ繧ｯ繧｢繝・・謌仙粥', 'success');
            } else {
                showToast('繝舌ャ繧ｯ繧｢繝・・縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
            }
        } catch (error) {
            console.error('Backup error:', error);
            showToast('繝舌ャ繧ｯ繧｢繝・・荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
        }
    });

    // 繝・・繧ｿ繝吶・繧ｹ蠕ｩ蜈・
    restoreDbBtn.addEventListener('click', () => {
        if (!confirm('笞・・隴ｦ蜻・ 迴ｾ蝨ｨ縺ｮ繝・・繧ｿ繝吶・繧ｹ縺御ｸ頑嶌縺阪＆繧後∪縺吶よ悽蠖薙↓蠕ｩ蜈・＠縺ｾ縺吶°・・)) return;
        restoreFileInput.click();
    });

    restoreFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast('蠕ｩ蜈・ｩ溯・縺ｯ謇句虚縺ｧ螳溯｡後＠縺ｦ縺上□縺輔＞・・sql 繧ｳ繝槭Φ繝我ｽｿ逕ｨ・・, 'error');
        e.target.value = '';
    });
}

async function loadTableData(schemaTable) {
    const container = document.getElementById('table-data-container');
    container.innerHTML = '<p class="info-text">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

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
            const primaryKey = columns[0]; // 莉ｮ縺ｫ譛蛻昴・繧ｫ繝ｩ繝繧剃ｸｻ繧ｭ繝ｼ縺ｨ縺吶ｋ

            let tableHtml = '<table class="data-table"><thead><tr>';
            columns.forEach(col => {
                tableHtml += `<th>${escapeHtml(col)}</th>`;
            });
            tableHtml += '<th>謫堺ｽ・/th></tr></thead><tbody>';

            result.data.forEach(row => {
                tableHtml += '<tr>';
                columns.forEach(col => {
                    const value = row[col];
                    tableHtml += `<td>${escapeHtml(String(value !== null ? value : ''))}</td>`;
                });
                tableHtml += `<td class="action-buttons">
                    <button class="btn-edit" onclick="editRecord('${escapeHtml(row[primaryKey])}')">笨擾ｸ・/button>
                    <button class="btn-delete" onclick="deleteRecord('${escapeHtml(row[primaryKey])}')">卵・・/button>
                </td></tr>`;
            });

            tableHtml += '</tbody></table>';
            container.innerHTML = tableHtml;
        } else {
            container.innerHTML = '<p class="info-text">繝・・繧ｿ縺後≠繧翫∪縺帙ｓ</p>';
        }
    } catch (error) {
        console.error('Load table data error:', error);
        container.innerHTML = '<p class="info-text">繝・・繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆</p>';
    }
}

function showRecordModal(mode, recordId) {
    // 繝｢繝ｼ繝繝ｫHTML逕滓・
    const modalHtml = `
        <div id="record-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${mode === 'add' ? '譁ｰ隕上Ξ繧ｳ繝ｼ繝芽ｿｽ蜉' : '繝ｬ繧ｳ繝ｼ繝臥ｷｨ髮・}</h2>
                    <button class="modal-close" onclick="closeRecordModal()">&times;</button>
                </div>
                <form id="record-form" class="modal-form">
                    ${generateFormFields(mode, recordId)}
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeRecordModal()">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
                        <button type="submit" class="btn-primary">菫晏ｭ・/button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 繝輔か繝ｼ繝騾∽ｿ｡
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
            showToast(mode === 'add' ? '霑ｽ蜉縺励∪縺励◆' : '譖ｴ譁ｰ縺励∪縺励◆', 'success');
            closeRecordModal();
            await loadTableData(currentTable);
        } else {
            showToast(result.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Save record error:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

async function editRecord(recordId) {
    showRecordModal('edit', recordId);
}

async function deleteRecord(recordId) {
    if (!confirm('縺薙・繝ｬ繧ｳ繝ｼ繝峨ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・・)) return;

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/database/table/${currentTable}/${recordId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.success) {
            showToast('蜑企勁縺励∪縺励◆', 'success');
            await loadTableData(currentTable);
        } else {
            showToast(result.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Delete record error:', error);
        showToast('蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

window.closeRecordModal = function() {
    const modal = document.getElementById('record-modal');
    if (modal) modal.remove();
}

window.editRecord = editRecord;
window.deleteRecord = deleteRecord;

// ========== CORS險ｭ螳夂ｮ｡逅・==========
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
        showToast('CORS險ｭ螳壹・隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
    }
}

// CORS險ｭ螳壹・蛻晄悄蛹・
function initializeCorsSettings() {
    const saveCorsBtn = document.getElementById('save-cors-btn');
    if (saveCorsBtn) {
        saveCorsBtn.addEventListener('click', async () => {
            const corsOrigin = document.getElementById('cors_origin').value.trim();
            
            if (!corsOrigin) {
                showToast('CORS險ｭ螳壹ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞', 'error');
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
                    showToast('CORS險ｭ螳壹ｒ菫晏ｭ倥＠縺ｾ縺励◆', 'success');
                } else {
                    showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
                }
            } catch (error) {
                console.error('Failed to save CORS settings:', error);
                showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
            }
        });
    }
}

// ========================================
// 讖溽ｨｮ繝ｻ讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ邂｡逅・
// ========================================

// 讖溽ｨｮ繝槭せ繧ｿ縺ｮ繧､繝吶Φ繝医Μ繧ｹ繝翫・蛻晄悄蛹・
function initializeMachineEventListeners() {
    // 讖溽ｨｮ霑ｽ蜉繝懊ち繝ｳ
    const addMachineTypeBtn = document.getElementById('add-new-machine-type-btn');
    if (addMachineTypeBtn) {
        addMachineTypeBtn.addEventListener('click', () => openMachineTypeModal());
    }

    // 讖滓｢ｰ霑ｽ蜉繝懊ち繝ｳ
    const addMachineBtn = document.getElementById('add-new-machine-btn');
    if (addMachineBtn) {
        addMachineBtn.addEventListener('click', () => openMachineModal());
    }

    // 讖溽ｨｮ繝｢繝ｼ繝繝ｫ縺ｮ繧､繝吶Φ繝・
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

    // 讖滓｢ｰ繝｢繝ｼ繝繝ｫ縺ｮ繧､繝吶Φ繝・
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

// 讖溽ｨｮ繝槭せ繧ｿ荳隕ｧ隱ｭ縺ｿ霎ｼ縺ｿ
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
                            <th>讖溽ｨｮ繧ｳ繝ｼ繝・/th>
                            <th>讖溽ｨｮ蜷・/th>
                            <th>繝｡繝ｼ繧ｫ繝ｼ</th>
                            <th>繧ｫ繝・ざ繝ｪ</th>
                            <th>隱ｬ譏・/th>
                            <th>謫堺ｽ・/th>
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
                            <button class="btn-sm btn-edit" onclick="editMachineType(${type.id})">邱ｨ髮・/button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="error">讖溽ｨｮ繝槭せ繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆</p>';
        }
    } catch (error) {
        console.error('Load machine types error:', error);
        container.innerHTML = '<p class="error">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆</p>';
    }
}

// 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ荳隕ｧ隱ｭ縺ｿ霎ｼ縺ｿ・域ｩ溽ｨｮ諠・ｱ莉倥″・・
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
                            <th>讖滓｢ｰ逡ｪ蜿ｷ</th>
                            <th>讖溽ｨｮ繧ｳ繝ｼ繝・/th>
                            <th>讖溽ｨｮ蜷・/th>
                            <th>繝｡繝ｼ繧ｫ繝ｼ</th>
                            <th>繧ｷ繝ｪ繧｢繝ｫ逡ｪ蜿ｷ</th>
                            <th>驟榊ｱ槫渕蝨ｰ</th>
                            <th>繧ｹ繝・・繧ｿ繧ｹ</th>
                            <th>謫堺ｽ・/th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.data.forEach(machine => {
                const statusBadge = machine.status === 'active' ? 'status-active' : 'status-inactive';
                const statusText = machine.status === 'active' ? '遞ｼ蜒堺ｸｭ' : machine.status === 'maintenance' ? '菫晏ｮ井ｸｭ' : '蟒・｣・;
                
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
                            <button class="btn-sm btn-edit" onclick="editMachine(${machine.machine_id})">邱ｨ髮・/button>
                            <button class="btn-sm btn-delete" onclick="deleteMachine(${machine.machine_id}, '${escapeHtml(machine.machine_number)}')">蜑企勁</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="error">讖滓｢ｰ繝槭せ繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆</p>';
        }
    } catch (error) {
        console.error('Load machines error:', error);
        container.innerHTML = '<p class="error">繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆</p>';
    }
}

// 讖溽ｨｮ繝槭せ繧ｿ繝｢繝ｼ繝繝ｫ繧帝幕縺・
async function openMachineTypeModal(typeId = null) {
    const modal = document.getElementById('machine-type-modal');
    const modalTitle = document.getElementById('machine-type-modal-title');
    const form = document.getElementById('machine-type-form');

    form.reset();
    document.getElementById('machine-type-id').value = '';

    if (typeId) {
        modalTitle.textContent = '讖溽ｨｮ繧堤ｷｨ髮・;
        // TODO: 讖溽ｨｮ繝・・繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ
    } else {
        modalTitle.textContent = '讖溽ｨｮ繧定ｿｽ蜉';
    }

    modal.style.display = 'block';
}

// 讖滓｢ｰ繝槭せ繧ｿ繝｢繝ｼ繝繝ｫ繧帝幕縺・
async function openMachineModal(machineId = null) {
    const modal = document.getElementById('machine-modal');
    const modalTitle = document.getElementById('machine-modal-title');
    const form = document.getElementById('machine-form');
    const token = localStorage.getItem('user_token');

    form.reset();
    document.getElementById('machine-id').value = '';

    // 讖溽ｨｮ繝槭せ繧ｿ繧定ｪｭ縺ｿ霎ｼ繧薙〒繧ｻ繝ｬ繧ｯ繝医・繝・け繧ｹ縺ｫ險ｭ螳・
    try {
        const response = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('machine-type-select');
            select.innerHTML = '<option value="">-- 讖溽ｨｮ繧帝∈謚・--</option>';
            data.data.forEach(type => {
                select.innerHTML += `<option value="${type.id}">${type.type_code} - ${type.type_name}</option>`;
            });
        }

        // 驟榊ｱ槫渕蝨ｰ繧定ｪｭ縺ｿ霎ｼ繧
        const basesResponse = await fetch('/api/bases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const basesData = await basesResponse.json();

        if (basesData.success) {
            const baseSelect = document.getElementById('assigned-base');
            baseSelect.innerHTML = '<option value="">-- 驟榊ｱ槫渕蝨ｰ繧帝∈謚・--</option>';
            basesData.bases.forEach(base => {
                baseSelect.innerHTML += `<option value="${base.base_id}">${base.base_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load options:', error);
    }

    if (machineId) {
        modalTitle.textContent = '讖滓｢ｰ繧堤ｷｨ髮・;
        // TODO: 讖滓｢ｰ繝・・繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ
    } else {
        modalTitle.textContent = '讖滓｢ｰ繧定ｿｽ蜉';
    }

    modal.style.display = 'block';
}

// 讖溽ｨｮ繝槭せ繧ｿ騾∽ｿ｡蜃ｦ逅・
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
            showToast(data.message || '讖溽ｨｮ繧剃ｿ晏ｭ倥＠縺ｾ縺励◆', 'success');
            document.getElementById('machine-type-modal').style.display = 'none';
            loadMachineTypes();
        } else {
            showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Machine type submit error:', error);
        showToast('繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

// 讖滓｢ｰ繝槭せ繧ｿ騾∽ｿ｡蜃ｦ逅・
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
            showToast(data.message || '讖滓｢ｰ繧剃ｿ晏ｭ倥＠縺ｾ縺励◆', 'success');
            document.getElementById('machine-modal').style.display = 'none';
            loadMachines();
        } else {
            showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Machine submit error:', error);
        showToast('繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

// 讖滓｢ｰ蜑企勁
async function deleteMachine(machineId, machineNumber) {
    if (!confirm(`讖滓｢ｰ逡ｪ蜿ｷ ${machineNumber} 繧貞炎髯､縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歔)) {
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
            showToast(data.message || '讖滓｢ｰ繧貞炎髯､縺励∪縺励◆', 'success');
            loadMachines();
        } else {
            showToast(data.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Machine delete error:', error);
        showToast('繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

// 讖溽ｨｮ繝槭せ繧ｿ縺ｮ繝｢繝ｼ繝繝ｫ陦ｨ遉ｺ
function showMachineTypeModal(mode, typeId) {
    if (mode === 'add') {
        openMachineTypeModal(null);
    } else {
        openMachineTypeModal(typeId);
    }
}

// 讖溽ｨｮ繝槭せ繧ｿ邱ｨ髮・
window.editMachineType = function(typeId) {
    showMachineTypeModal('edit', typeId);
};

// 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ縺ｮ繝｢繝ｼ繝繝ｫ陦ｨ遉ｺ
function showMachineModal(mode, machineId) {
    if (mode === 'add') {
        openMachineModal(null);
    } else {
        openMachineModal(machineId);
    }
}

// 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ邱ｨ髮・
window.editMachine = function(machineId) {
    showMachineModal('edit', machineId);
};

// ========== 繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ髢｢謨ｰ ==========
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
