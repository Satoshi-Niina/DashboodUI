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
        addMachineTypeBtn.addEventListener('click', () => openMachineTypeModal());
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
            await saveMachineType();
        });
    }

    // 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ霑ｽ蜉繝懊ち繝ｳ
    const addMachineBtn = document.getElementById('add-new-machine-btn');
    if (addMachineBtn) {
        addMachineBtn.addEventListener('click', () => openMachineModal());
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
            await saveMachine();
        });
    }

    // 繝・・繝悶Ν縺ｮ邱ｨ髮・・蜑企勁繝懊ち繝ｳ縺ｮ繧､繝吶Φ繝亥ｧ碑ｭｲ
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // 讖溽ｨｮ縺ｮ邱ｨ髮・・繧ｿ繝ｳ
        if (target.classList.contains('btn-edit') && target.dataset.action === 'edit-type') {
            e.preventDefault();
            const typeId = target.dataset.id;
            console.log('[Event] Edit machine type clicked:', typeId);
            window.editMachineType(typeId);
        }
        
        // 讖溽ｨｮ縺ｮ蜑企勁繝懊ち繝ｳ
        if (target.classList.contains('btn-delete') && target.dataset.action === 'delete-type') {
            e.preventDefault();
            const typeId = target.dataset.id;
            const typeCode = target.dataset.code;
            console.log('[Event] Delete machine type clicked:', { id: typeId, code: typeCode });
            window.deleteMachineType(typeId, typeCode);
        }
        
        // 菫晏ｮ育畑霆翫・邱ｨ髮・・繧ｿ繝ｳ
        if (target.classList.contains('btn-edit') && target.dataset.action === 'edit-machine') {
            e.preventDefault();
            const machineId = target.dataset.id;
            console.log('[Event] Edit machine clicked:', machineId);
            window.editMachine(machineId);
        }
        
        // 菫晏ｮ育畑霆翫・蜑企勁繝懊ち繝ｳ
        if (target.classList.contains('btn-delete') && target.dataset.action === 'delete-machine') {
            e.preventDefault();
            const machineId = target.dataset.id;
            const machineNumber = target.dataset.number;
            console.log('[Event] Delete machine clicked:', { id: machineId, number: machineNumber });
            window.deleteMachine(machineId, machineNumber);
        }
    });
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
            usersList.innerHTML = data.users.map(user => {
                // 蠖ｹ蜑ｲ縺ｮ陦ｨ遉ｺ蜷阪ｒ蜿門ｾ・
                let roleDisplayName = '繝ｦ繝ｼ繧ｶ繝ｼ';
                if (user.role === 'system_admin') {
                    roleDisplayName = '繧ｷ繧ｹ繝・Β邂｡逅・・;
                } else if (user.role === 'operation_admin') {
                    roleDisplayName = '驕狗畑邂｡逅・・;
                } else if (user.role === 'admin') {
                    roleDisplayName = '邂｡逅・・;
                } else if (user.role === 'user') {
                    roleDisplayName = '繝ｦ繝ｼ繧ｶ繝ｼ';
                }
                
                return `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="username">${escapeHtml(user.username)}</div>
                            <div class="display-name">${escapeHtml(user.display_name || '')}</div>
                            <span class="role-badge role-${user.role}">${roleDisplayName}</span>
                        </div>
                        <div class="user-actions-buttons">
                            <button class="btn-edit" onclick="editUser(${user.id})">笨擾ｸ・邱ｨ髮・/button>
                            <button class="btn-delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">卵・・蜑企勁</button>
                        </div>
                    </div>
                `;
            }).join('');
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
            showToast(userId ? '繝ｦ繝ｼ繧ｶ繝ｼ繧呈峩譁ｰ縺励∪縺励◆' : '繝ｦ繝ｼ繧ｶ繝ｼ繧定ｿｽ蜉縺励∪縺励◆', 'success');
            document.getElementById('user-modal').style.display = 'none';
            loadUsers();
        } else {
            console.error('[saveUser] Save failed:', data.message);
            showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('[saveUser] Failed to save user:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: ' + error.message, 'error');
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

// ========== 讖溽ｨｮ繝槭せ繧ｿ邂｡逅・==========
async function loadMachineTypes() {
    const list = document.getElementById('machine-types-list');
    list.innerHTML = '<p class="loading">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

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
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>讖溽ｨｮ繧ｳ繝ｼ繝・/th>
                            <th>讖溽ｨｮ蜷・/th>
                            <th>繝｡繝ｼ繧ｫ繝ｼ</th>
                            <th>繧ｫ繝・ざ繝ｪ</th>
                            <th>謫堺ｽ・/th>
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
                            <button class="btn-sm btn-edit" data-id="${typeId}" data-action="edit-type">邱ｨ髮・/button>
                            <button class="btn-sm btn-delete" data-id="${typeId}" data-code="${escapeHtml(typeCode)}" data-action="delete-type">蜑企勁</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;
        } else {
            list.innerHTML = '<p class="loading">讖溽ｨｮ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>';
        }
    } catch (error) {
        console.error('[loadMachineTypes] Error:', error);
        list.innerHTML = `<p class="loading" style="color: red;">笞・・讖溽ｨｮ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆</p>`;
    }
}

function openMachineTypeModal(machineTypeId = null) {
    const modal = document.getElementById('machine-type-modal');
    const modalTitle = document.getElementById('machine-type-modal-title');
    const form = document.getElementById('machine-type-form');
    
    form.reset();
    document.getElementById('machine-type-id').value = '';
    
    if (machineTypeId) {
        modalTitle.textContent = '邱ｨ髮・;
        loadMachineTypeData(machineTypeId);
    } else {
        modalTitle.textContent = '譁ｰ隕剰ｿｽ蜉';
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
            // ID縺ｮ蝙九ｒ譟碑ｻ溘↓豈碑ｼ・ｼ域焚蛟､縺ｨ譁・ｭ怜・縺ｮ荳｡譁ｹ縺ｫ蟇ｾ蠢懶ｼ・
            const machineType = data.data.find(mt => String(mt.id) === String(machineTypeId));
            console.log('[loadMachineTypeData] Found machine type:', machineType);
            if (machineType) {
                document.getElementById('machine-type-id').value = machineType.id;
                document.getElementById('machine-type-name').value = machineType.type_name || '';
                document.getElementById('machine-type-manufacturer').value = machineType.manufacturer || '';
                document.getElementById('machine-type-category').value = machineType.category || '';
                document.getElementById('machine-type-description').value = machineType.description || '';
            } else {
                console.error('[loadMachineTypeData] Machine type not found:', machineTypeId);
                showToast('讖溽ｨｮ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ', 'error');
            }
        }
    } catch (error) {
        console.error('Failed to load machine type data:', error);
        showToast('讖溽ｨｮ諠・ｱ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
    }
}

async function saveMachineType() {
    const machineTypeId = document.getElementById('machine-type-id').value;
    const token = localStorage.getItem('user_token');
    
    const machineTypeData = {
        type_name: document.getElementById('machine-type-name').value,
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
            showToast(machineTypeId ? '讖溽ｨｮ繧呈峩譁ｰ縺励∪縺励◆' : '讖溽ｨｮ繧定ｿｽ蜉縺励∪縺励◆', 'success');
            document.getElementById('machine-type-modal').style.display = 'none';
            loadMachineTypes();
        } else {
            showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to save machine type:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

function editMachineType(machineTypeId) {
    console.log('[editMachineType] Called with ID:', machineTypeId);
    try {
        openMachineTypeModal(machineTypeId);
    } catch (error) {
        console.error('[editMachineType] Error:', error);
        alert('邱ｨ髮・Δ繝ｼ繝繝ｫ繧帝幕縺城圀縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: ' + error.message);
    }
}

// 繧ｰ繝ｭ繝ｼ繝舌Ν縺ｫ蜈ｬ髢・
window.editMachineType = editMachineType;
console.log('[Global] editMachineType function registered:', typeof window.editMachineType);

async function deleteMachineType(machineTypeId, typeCode) {
    console.log('[deleteMachineType] Called with ID:', machineTypeId);
    if (!confirm(`讖溽ｨｮ縲・{typeCode}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歔)) {
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
            showToast('讖溽ｨｮ繧貞炎髯､縺励∪縺励◆', 'success');
            loadMachineTypes();
        } else {
            showToast(data.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to delete machine type:', error);
        showToast('蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

// 繧ｰ繝ｭ繝ｼ繝舌Ν縺ｫ蜈ｬ髢・
window.deleteMachineType = deleteMachineType;

// ========== 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ邂｡逅・==========
async function loadMachines() {
    const list = document.getElementById('machines-list');
    list.innerHTML = '<p class="loading">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p>';

    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/machines', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data.length > 0) {
            let html = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>讖滓｢ｰ逡ｪ蜿ｷ</th>
                            <th>讖溽ｨｮ</th>
                            <th>繧ｷ繝ｪ繧｢繝ｫ逡ｪ蜿ｷ</th>
                            <th>陬ｽ騾蟷ｴ譛域律</th>
                            <th>驟榊ｱ槫渕蝨ｰ</th>
                            <th>繧ｹ繝・・繧ｿ繧ｹ</th>
                            <th>謫堺ｽ・/th>
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
                        <td>${machine.status === 'active' ? '遞ｼ蜒堺ｸｭ' : machine.status === 'maintenance' ? '謨ｴ蛯吩ｸｭ' : '蟒・ｻ・}</td>
                        <td>
                            <button class="btn-sm btn-edit" data-id="${machineId}" data-action="edit-machine">邱ｨ髮・/button>
                            <button class="btn-sm btn-delete" data-id="${machineId}" data-number="${escapeHtml(machineNumber)}" data-action="delete-machine">蜑企勁</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            list.innerHTML = html;
        } else {
            list.innerHTML = '<p class="loading">讖滓｢ｰ逡ｪ蜿ｷ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>';
        }
    } catch (error) {
        console.error('[loadMachines] Error:', error);
        list.innerHTML = `<p class="loading" style="color: red;">笞・・讖滓｢ｰ逡ｪ蜿ｷ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆</p>`;
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
        console.error('[openMachineModal] 笶・Modal element not found!');
        alert('繧ｨ繝ｩ繝ｼ: 繝｢繝ｼ繝繝ｫ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ');
        return;
    }
    
    form.reset();
    document.getElementById('machine-id').value = '';
    
    // 繝｢繝ｼ繝繝ｫ繧貞・縺ｫ陦ｨ遉ｺ
    modal.style.display = 'flex';
    console.log('[openMachineModal] 笨・Modal displayed');
    
    // 讖溽ｨｮ繝ｪ繧ｹ繝医ｒ隱ｭ縺ｿ霎ｼ繧
    try {
        console.log('[openMachineModal] 藤 Fetching machine types from /api/machine-types...');
        const machineTypesResponse = await fetch('/api/machine-types', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('[openMachineModal] Machine types response status:', machineTypesResponse.status);
        
        if (!machineTypesResponse.ok) {
            throw new Error(`HTTP ${machineTypesResponse.status}: ${machineTypesResponse.statusText}`);
        }
        
        const machineTypesData = await machineTypesResponse.json();
        console.log('[openMachineModal] 逃 Machine types data received:', machineTypesData);
        console.log('[openMachineModal] Success:', machineTypesData.success);
        console.log('[openMachineModal] Data array:', machineTypesData.data);
        console.log('[openMachineModal] Data count:', machineTypesData.data ? machineTypesData.data.length : 0);

        if (machineTypesData.success && machineTypesData.data && Array.isArray(machineTypesData.data)) {
            const machineTypeSelect = document.getElementById('machine-type-select');
            if (!machineTypeSelect) {
                console.error('[openMachineModal] 笶・machine-type-select element not found!');
                showToast('讖溽ｨｮ驕ｸ謚樊ｬ・′隕九▽縺九ｊ縺ｾ縺帙ｓ', 'error');
                return;
            }
            
            console.log('[openMachineModal] 笨・machine-type-select found:', machineTypeSelect);
            
            const options = ['<option value="">-- 讖溽ｨｮ繧帝∈謚・--</option>'];
            console.log('[openMachineModal] Processing machine types...');
            
            machineTypesData.data.forEach((type, index) => {
                const typeId = type.id;
                const typeCode = type.type_code || '';
                const typeName = type.type_name || '蜷榊燕縺ｪ縺・;
                options.push(`<option value="${typeId}">${escapeHtml(typeCode)} - ${escapeHtml(typeName)}</option>`);
                console.log(`[openMachineModal] Type ${index + 1}/${machineTypesData.data.length}:`, { 
                    id: typeId, 
                    code: typeCode, 
                    name: typeName 
                });
            });
            
            machineTypeSelect.innerHTML = options.join('');
            console.log('[openMachineModal] 笨・Machine types loaded:', machineTypesData.data.length, 'items');
            console.log('[openMachineModal] Select HTML length:', machineTypeSelect.innerHTML.length);
            console.log('[openMachineModal] Option elements:', machineTypeSelect.children.length);
        } else {
            console.error('[openMachineModal] 笶・Invalid machine types response:', {
                success: machineTypesData.success,
                hasData: !!machineTypesData.data,
                isArray: Array.isArray(machineTypesData.data),
                message: machineTypesData.message
            });
            showToast('讖溽ｨｮ繝・・繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }

        // 邂｡逅・ｺ区･ｭ謇繧定ｪｭ縺ｿ霎ｼ繧
        console.log('[openMachineModal] 藤 Fetching offices from /api/offices...');
        const officesResponse = await fetch('/api/offices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('[openMachineModal] Offices response status:', officesResponse.status);
        
        if (!officesResponse.ok) {
            throw new Error(`HTTP ${officesResponse.status}: ${officesResponse.statusText}`);
        }
        
        const officesData = await officesResponse.json();
        console.log('[openMachineModal] 逃 Offices data received:', officesData);
        console.log('[openMachineModal] Success:', officesData.success);
        console.log('[openMachineModal] Offices array:', officesData.offices);
        console.log('[openMachineModal] Offices count:', officesData.offices ? officesData.offices.length : 0);

        if (officesData.success && officesData.offices && Array.isArray(officesData.offices)) {
            const officeSelect = document.getElementById('machine-office-select');
            if (!officeSelect) {
                console.error('[openMachineModal] 笶・machine-office-select element not found!');
                showToast('莠区･ｭ謇驕ｸ謚樊ｬ・′隕九▽縺九ｊ縺ｾ縺帙ｓ', 'error');
                return;
            }
            
            console.log('[openMachineModal] 笨・machine-office-select found:', officeSelect);
            
            const options = ['<option value="">-- 莠区･ｭ謇繧帝∈謚・--</option>'];
            console.log('[openMachineModal] Processing offices...');
            
            officesData.offices.forEach((office, index) => {
                const officeId = office.office_id;
                const officeName = office.office_name || '蜷榊燕縺ｪ縺・;
                options.push(`<option value="${officeId}">${escapeHtml(officeName)}</option>`);
                console.log(`[openMachineModal] Office ${index + 1}/${officesData.offices.length}:`, { 
                    id: officeId, 
                    name: officeName 
                });
            });
            
            officeSelect.innerHTML = options.join('');
            console.log('[openMachineModal] 笨・Offices loaded:', officesData.offices.length, 'items');
            console.log('[openMachineModal] Select HTML length:', officeSelect.innerHTML.length);
            console.log('[openMachineModal] Option elements:', officeSelect.children.length);
        } else {
            console.error('[openMachineModal] 笶・Invalid offices response:', {
                success: officesData.success,
                hasOffices: !!officesData.offices,
                isArray: Array.isArray(officesData.offices),
                message: officesData.message
            });
            showToast('莠区･ｭ謇繝・・繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
        
        console.log('[openMachineModal] 笨・All data loaded successfully');
    } catch (error) {
        console.error('[openMachineModal] 笶・CRITICAL ERROR:', error);
        console.error('[openMachineModal] Error stack:', error.stack);
        showToast('繝・・繧ｿ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: ' + error.message, 'error');
    }
    
    if (machineId) {
        modalTitle.textContent = '邱ｨ髮・;
        await loadMachineData(machineId);
    } else {
        modalTitle.textContent = '譁ｰ隕剰ｿｽ蜉';
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
            // ID縺ｮ蝙九ｒ譟碑ｻ溘↓豈碑ｼ・ｼ域焚蛟､縺ｨ譁・ｭ怜・縺ｮ荳｡譁ｹ縺ｫ蟇ｾ蠢懶ｼ・
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
                showToast('菫晏ｮ育畑霆翫′隕九▽縺九ｊ縺ｾ縺帙ｓ', 'error');
            }
        }
    } catch (error) {
        console.error('Failed to load machine data:', error);
        showToast('菫晏ｮ育畑霆頑ュ蝣ｱ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
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
            showToast(machineId ? '菫晏ｮ育畑霆翫ｒ譖ｴ譁ｰ縺励∪縺励◆' : '菫晏ｮ育畑霆翫ｒ霑ｽ蜉縺励∪縺励◆', 'success');
            document.getElementById('machine-modal').style.display = 'none';
            loadMachines();
        } else {
            showToast(data.message || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to save machine:', error);
        showToast('菫晏ｭ倅ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

function editMachine(machineId) {
    console.log('[editMachine] Called with ID:', machineId);
    try {
        openMachineModal(machineId);
    } catch (error) {
        console.error('[editMachine] Error:', error);
        alert('邱ｨ髮・Δ繝ｼ繝繝ｫ繧帝幕縺城圀縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: ' + error.message);
    }
}

// 繧ｰ繝ｭ繝ｼ繝舌Ν縺ｫ蜈ｬ髢・
window.editMachine = editMachine;
console.log('[Global] editMachine function registered:', typeof window.editMachine);

async function deleteMachine(machineId, machineNumber) {
    console.log('[deleteMachine] Called with ID:', machineId);
    if (!confirm(`菫晏ｮ育畑霆翫・{machineNumber}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歔)) {
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
            showToast('菫晏ｮ育畑霆翫ｒ蜑企勁縺励∪縺励◆', 'success');
            loadMachines();
        } else {
            showToast(data.message || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
        }
    } catch (error) {
        console.error('Failed to delete machine:', error);
        showToast('蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆', 'error');
    }
}

// 繧ｰ繝ｭ繝ｼ繝舌Ν縺ｫ蜈ｬ髢・
window.deleteMachine = deleteMachine;

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
                    <div class="form-group">
                        <label for="office_code">莠区･ｭ謇繧ｳ繝ｼ繝・/label>
                        <input type="text" id="office_code" name="office_code" value="${office ? escapeHtml(office.office_code) : ''}" ${mode === 'edit' ? 'readonly' : ''} placeholder="遨ｺ谺・・蝣ｴ蜷医・閾ｪ蜍墓治逡ｪ縺輔ｌ縺ｾ縺・>
                        ${mode === 'add' ? '<small>遨ｺ谺・・蝣ｴ蜷医・閾ｪ蜍慕噪縺ｫ謗｡逡ｪ縺輔ｌ縺ｾ縺・/small>' : ''}
                    </div>
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
                    <div class="form-group">
                        <label for="base_code">蝓ｺ蝨ｰ繧ｳ繝ｼ繝・/label>
                        <input type="text" id="base_code" name="base_code" value="${base ? escapeHtml(base.base_code) : ''}" ${mode === 'edit' ? 'readonly' : ''} placeholder="遨ｺ谺・・蝣ｴ蜷医・閾ｪ蜍墓治逡ｪ縺輔ｌ縺ｾ縺・>
                        ${mode === 'add' ? '<small>遨ｺ谺・・蝣ｴ蜷医・閾ｪ蜍慕噪縺ｫ謗｡逡ｪ縺輔ｌ縺ｾ縺・/small>' : ''}
                    </div>
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
