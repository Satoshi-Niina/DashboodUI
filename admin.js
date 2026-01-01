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

    // 現在の設定を読み込む（初回自動読み込み）
    loadCurrentConfig();
    loadHistory();

    // ページ読み込み時にもconfig.jsをリロードして最新の設定を反映
    const scriptTag = document.createElement('script');
    scriptTag.src = '/config.js?t=' + Date.now();
    document.head.appendChild(scriptTag);

    // フォーム送信
    document.getElementById('config-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveConfig();
    });

    // CORS設定保存
    document.getElementById('save-cors-btn').addEventListener('click', async () => {
        const corsOrigin = document.getElementById('cors_origin').value.trim();
        await saveConfig({ cors_origin: corsOrigin });
    });
});

async function loadCurrentConfig() {
    try {
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/config', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
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
            showToast('設定を保存しました！システムに反映されました', 'success');
            loadHistory();
            // config.jsを再読み込みして設定を反映
            const scriptTag = document.createElement('script');
            scriptTag.src = '/config.js?t=' + Date.now();
            document.head.appendChild(scriptTag);
            // 保存後に現在の設定を再読み込み
            setTimeout(() => loadCurrentConfig(), 500);
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
        const token = localStorage.getItem('user_token');
        const response = await fetch('/api/config/history', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
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
        console.error('Failed to load history:', error);
        showToast('履歴の読み込みに失敗しました', 'error');
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
