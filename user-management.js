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

    // システム設定に戻る
    document.getElementById('back-to-admin-btn').addEventListener('click', () => {
        window.location.href = '/admin';
    });

    // 初回ユーザー一覧読み込み
    loadUsers();

    // 新規追加ボタン
    document.getElementById('add-new-user-btn').addEventListener('click', () => {
        openUserModal();
    });

    document.getElementById('modal-close').addEventListener('click', closeUserModal);
    document.getElementById('cancel-btn').addEventListener('click', closeUserModal);
    
    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });
});

// ユーザー管理機能
async function loadUsers() {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();

        const usersList = document.getElementById('users-list');

        if (data.success && data.users.length > 0) {
            usersList.innerHTML = `
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>ユーザー名</th>
                            <th>表示名</th>
                            <th>権限</th>
                            <th>登録日</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.users.map(user => `
                            <tr>
                                <td>${user.id}</td>
                                <td><strong>${escapeHtml(user.username)}</strong></td>
                                <td>${escapeHtml(user.display_name || '-')}</td>
                                <td><span class="role-badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}">${user.role === 'admin' ? '管理者' : '一般'}</span></td>
                                <td>${new Date(user.created_at).toLocaleDateString('ja-JP')}</td>
                                <td class="action-buttons">
                                    <button class="btn-edit" onclick="editUser(${user.id})">✏️ 編集</button>
                                    <button class="btn-delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">🗑️ 削除</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
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
    document.getElementById('user-role').value = 'user';
    
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
        const token = localStorage.getItem('user_token');
        const response = await fetch(`/api/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('user-id').value = data.user.id;
            document.getElementById('user-username').value = data.user.username;
            document.getElementById('user-display-name').value = data.user.display_name || '';
            document.getElementById('user-role').value = data.user.role || 'user';
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
    const role = document.getElementById('user-role').value;
    const password = document.getElementById('user-password').value;
    const passwordConfirm = document.getElementById('user-password-confirm').value;

    // バリデーション
    if (!username) {
        showToast('ユーザー名を入力してください', 'error');
        return;
    }

    if (!role) {
        showToast('権限を選択してください', 'error');
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
    const userData = { username, display_name: displayName, role };
    
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

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
