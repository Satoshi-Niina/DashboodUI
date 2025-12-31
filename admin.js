document.addEventListener('DOMContentLoaded', () => {
    // 認証チェック
    const token = localStorage.getItem('user_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // ユーザー情報の表示
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    document.getElementById('admin-user').textContent = userInfo.displayName || userInfo.username;

    // ログアウト
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_info');
        window.location.href = '/';
    });

    // 現在の設定を読み込む
    loadCurrentConfig();
    loadHistory();
    loadUsers();

    // フォーム送信
    document.getElementById('config-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveConfig();
    });

    // 読み込みボタン
    document.getElementById('load-btn').addEventListener('click', loadCurrentConfig);

    // CORS設定保存
    document.getElementById('save-cors-btn').addEventListener('click', async () => {
        const corsOrigin = document.getElementById('cors_origin').value.trim();
        await saveConfig({ cors_origin: corsOrigin });
    });

    // ユーザー管理
    document.getElementById('add-user-btn').addEventListener('click', () => {
        openUserModal();
    });

    document.getElementById('modal-close').addEventListener('click', closeUserModal);
    document.getElementById('cancel-btn').addEventListener('click', closeUserModal);
    
    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });
});

async function loadCurrentConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success) {
            // フォームに値を設定
            document.getElementById('app_url_emergency').value = data.config.app_url_emergency || '';
            document.getElementById('app_url_planning').value = data.config.app_url_planning || '';
            document.getElementById('app_url_equipment').value = data.config.app_url_equipment || '';
            document.getElementById('app_url_failure').value = data.config.app_url_failure || '';
            document.getElementById('cors_origin').value = data.config.cors_origin || '*';

            showToast('設定を読み込みました', 'success');
        }
    } catch (error) {
        console.error('Failed to load config:', error);
        showToast('設定の読み込みに失敗しました', 'error');
    }
}

async function saveConfig(customData = null) {
    const token = localStorage.getItem('user_token');
    
    const configData = customData || {
        app_url_emergency: document.getElementById('app_url_emergency').value.trim(),
        app_url_planning: document.getElementById('app_url_planning').value.trim(),
        app_url_equipment: document.getElementById('app_url_equipment').value.trim(),
        app_url_failure: document.getElementById('app_url_failure').value.trim(),
        cors_origin: document.getElementById('cors_origin').value.trim()
    };

    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(configData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('設定を保存しました！', 'success');
            loadHistory();
        } else {
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save config:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

async function loadHistory() {
    try {
        const response = await fetch('/api/config/history');
        const data = await response.json();

        const historyList = document.getElementById('history-list');

        if (data.success && data.history.length > 0) {
            historyList.innerHTML = data.history.map(item => `
                <div class="history-item">
                    <div class="time">${new Date(item.updated_at).toLocaleString('ja-JP')}</div>
                    <div class="change">
                        ${item.updated_by ? `更新者: ${item.updated_by}` : '自動更新'}
                    </div>
                </div>
            `).join('');
        } else {
            historyList.innerHTML = '<p class="loading">変更履歴はありません</p>';
        }
    } catch (error) {

// ユーザー管理機能
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();

        const usersList = document.getElementById('users-list');

        if (data.success && data.users.length > 0) {
            usersList.innerHTML = data.users.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <div class="username">${escapeHtml(user.username)}</div>
                        <div class="display-name">${escapeHtml(user.display_name || '-')}</div>
                    </div>
                    <div class="user-actions-buttons">
                        <button class="btn-edit" onclick="editUser(${user.id})">編集</button>
                        <button class="btn-delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">削除</button>
                    </div>
                </div>
            `).join('');
        } else {
            usersList.innerHTML = '<p class="loading">ユーザーが登録されていません</p>';
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        showToast('ユーザー一覧の読み込みに失敗しました', 'error');
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
        document.getElementById('password-required').textContent = '';
        document.getElementById('password-hint').textContent = '変更する場合のみ入力してください';
        loadUserForEdit(userId);
    } else {
        modalTitle.textContent = 'ユーザーを追加';
        document.getElementById('password-required').textContent = '*';
        document.getElementById('password-hint').textContent = '新規追加時は必須です';
    }
    
    modal.classList.add('show');
}

function closeUserModal() {
    const modal = document.getElementById('user-modal');
    modal.classList.remove('show');
}

async function loadUserForEdit(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('user-id').value = data.user.id;
            document.getElementById('user-username').value = data.user.username;
            document.getElementById('user-display-name').value = data.user.display_name || '';
        } else {
            showToast('ユーザー情報の取得に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to load user:', error);
        showToast('ユーザー情報の読み込みエラー', 'error');
    }
}

async function saveUser() {
    const userId = document.getElementById('user-id').value;
    const username = document.getElementById('user-username').value.trim();
    const displayName = document.getElementById('user-display-name').value.trim();
    const password = document.getElementById('user-password').value;
    const passwordConfirm = document.getElementById('user-password-confirm').value;

    // バリデーション
    if (!username) {
        showToast('ユーザー名を入力してください', 'error');
        return;
    }

    if (!userId && !password) {
        showToast('新規追加時はパスワードが必須です', 'error');
        return;
    }

    if (password && password.length < 8) {
        showToast('パスワードは8文字以上で入力してください', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showToast('パスワードが一致しません', 'error');
        return;
    }

    const token = localStorage.getItem('user_token');
    const userData = { username, display_name: displayName };
    
    if (password) {
        userData.password = password;
    }

    try {
        const url = userId ? `/api/users/${userId}` : '/api/users';
        const method = userId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(userId ? 'ユーザーを更新しました' : 'ユーザーを追加しました', 'success');
            closeUserModal();
            loadUsers();
        } else {
            showToast(data.message || '保存に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to save user:', error);
        showToast('保存中にエラーが発生しました', 'error');
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`本当に「${username}」を削除しますか？\nこの操作は取り消せません。`)) {
        return;
    }

    const token = localStorage.getItem('user_token');

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
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

// グローバル関数として公開
window.editUser = (userId) => openUserModal(userId);
window.deleteUser = deleteUser;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
        console.error('Failed to load history:', error);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
