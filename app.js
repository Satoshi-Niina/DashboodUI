/**
 * App Data Definition
 * 蠕後〒譁ｰ縺励＞繧｢繝励Μ繧定ｿｽ蜉縺吶ｋ蝣ｴ蜷医・縲√％縺ｮ驟榊・縺ｫ繧ｪ繝悶ず繧ｧ繧ｯ繝医ｒ霑ｽ蜉縺吶ｋ縺縺代〒縺吶・
 */
const apps = [
    {
        id: 'planning',
        title: '險育判繝ｻ螳溽ｸｾ邂｡逅・,
        description: '菫晏ｮ育畑霆翫・驕狗畑險育判菴懈・縺九ｉ驕狗畑縺ｮ螳溽ｸｾ繧堤ｮ｡逅・〒縺阪∪縺吶・,
        image: 'assets/img/Operation Planning to Performance Management.png',
        url: '#planning',
        icon: '套'
    },
    {
        id: 'equipment',
        title: '菫晏ｮ育畑霆顔ｮ｡逅・,
        description: '莉墓･ｭ轤ｹ讀懃ｰｿ縺ｮ陦ｨ遉ｺ縺九ｉ螳溽ｸｾ繧定ｨ倬鹸縺励∪縺吶・,
        image: 'assets/img/Inspection Checklist.jpeg',
        url: '#equipment',
        icon: '圀'
    },
    {
        id: 'emergency',
        title: '蠢懈･蠕ｩ譌ｧ謾ｯ謠ｴ',
        description: '讖滓｢ｰ謨・囿遲峨・謚陦捺髪謠ｴ縺励∪縺吶・,
        image: 'assets/img/recovery.png',
        url: '#emergency',
        icon: '屏・・
    },
    {
        id: 'failure',
        title: '讖滓｢ｰ謨・囿邂｡逅・,
        description: '讖滓｢ｰ謨・囿縺ｮ逋ｺ逕溽憾豕√→蟇ｾ蠢懷ｱ･豁ｴ繧堤ｮ｡逅・＠縺ｾ縺吶・,
        image: 'assets/img/Machinery Failure Management.png',
        url: '#failure',
        icon: '笞・・
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const appGrid = document.getElementById('app-grid');
    const tooltip = document.getElementById('app-tooltip');
    const tooltipTitle = document.getElementById('tooltip-title');
    const tooltipDesc = document.getElementById('tooltip-desc');
    const launchBtn = document.getElementById('launch-btn');
    const overlay = document.getElementById('overlay');
    const closeBtn = document.getElementById('close-tooltip');

    // 繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ縺ｮ蜿肴丐
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        const headerUserName = document.getElementById('header-user-name');
        const headerAvatar = document.getElementById('header-avatar');

        // 繧ｷ繧ｹ繝・Β邂｡逅・・ｻ･螟悶・繧ｷ繧ｹ繝・Β險ｭ螳壹Μ繝ｳ繧ｯ繧帝撼陦ｨ遉ｺ
        const footerNav = document.querySelector('.footer-nav');
        if (footerNav && userInfo.role !== 'admin') {
            const adminLink = footerNav.querySelector('a[href="/admin"]');
            if (adminLink) {
                adminLink.style.display = 'none';
            }
        }

        if (headerUserName) {
            // 譎る俣縺ｫ蠢懊§縺滓肩諡ｶ縺ｮ豎ｺ螳・
            // 6:00-10:00: 縺翫・繧医≧縺斐＊縺・∪縺・
            // 10:00-18:00: 縺薙ｓ縺ｫ縺｡縺ｯ
            // 18:00-鄙・:00: 縺薙ｓ縺ｰ繧薙・
            const hour = new Date().getHours();
            let greeting = '縺薙ｓ縺ｫ縺｡縺ｯ';
            if (hour >= 6 && hour < 10) {
                greeting = '縺翫・繧医≧縺斐＊縺・∪縺・;
            } else if (hour >= 10 && hour < 18) {
                greeting = '縺薙ｓ縺ｫ縺｡縺ｯ';
            } else {
                greeting = '縺薙ｓ縺ｰ繧薙・';
            }

            // 繝・ぅ繧ｹ繝励Ξ繧､陦ｨ遉ｺ縺ｧ縺ｯ縺ｪ縺上∝ｮ滄圀縺ｮ繝ｦ繝ｼ繧ｶ繝ｼ蜷搾ｼ・sername・峨ｒ陦ｨ遉ｺ
            headerUserName.textContent = `${greeting}縲・{userInfo.username}縺輔ｓ`;
        }
        if (headerAvatar) {
            headerAvatar.src = `https://ui-avatars.com/api/?name=${userInfo.username}&background=random`;
        }
    }

    let currentAppId = '';

    // 繧｢繝励Μ繧ｫ繝ｼ繝峨・蜍慕噪逕滓・
    apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.innerHTML = `
            <div class="app-card-header">
                <h3>${app.title}</h3>
            </div>
            <div class="app-image-container">
                <img src="${app.image}" alt="${app.title}" class="app-image">
                <div class="app-icon-floating">${app.icon}</div>
            </div>
            <div class="app-card-info">
                <p class="app-sub-desc">${app.description}</p>
                <button class="launch-btn-small">繧｢繝励Μ襍ｷ蜍・/button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            showTooltip(e, app);
        });

        appGrid.appendChild(card);
    });

    /**
     * 蜷ｹ縺榊・縺励ｒ陦ｨ遉ｺ縺吶ｋ髢｢謨ｰ
     */
    function showTooltip(event, app) {
        currentAppId = app.id;
        tooltipTitle.textContent = app.title;
        tooltipDesc.textContent = app.description;

        // 菴咲ｽｮ縺ｮ險育ｮ・
        const rect = event.currentTarget.getBoundingClientRect();
        const tooltipX = rect.left + (rect.width / 2) - 160; // 320px縺ｮ蜊雁・繧貞ｼ輔￥
        const tooltipY = rect.top + window.scrollY - 180; // 繧ｫ繝ｼ繝峨・荳企Κ縺ｫ陦ｨ遉ｺ

        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;

        tooltip.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    /**
     * 髢峨§繧九→縺阪・蜃ｦ逅・
     */
    function hideTooltip() {
        tooltip.classList.add('hidden');
        overlay.classList.add('hidden');
    }

    launchBtn.addEventListener('click', () => {
        console.log('currentAppId:', currentAppId);
        console.log('AppConfig.endpoints:', AppConfig.endpoints);
        
        const baseUrl = AppConfig.endpoints[currentAppId];
        console.log('baseUrl:', baseUrl);

        if (!baseUrl) {
            alert('謗･邯壼・URL縺瑚ｨｭ螳壹＆繧後※縺・∪縺帙ｓ縲らｮ｡逅・・↓縺雁撫縺・粋繧上○縺上□縺輔＞縲・);
            return;
        }

        // 貅門ｙ荳ｭ縺ｾ縺溘・繝ｭ繝ｼ繧ｫ繝ｫ繝帙せ繝医・蝣ｴ蜷医・隴ｦ蜻・
        if (baseUrl.includes('貅門ｙ荳ｭ') || baseUrl === 'https://貅門ｙ荳ｭ') {
            alert('縺薙・繧ｷ繧ｹ繝・Β縺ｯ貅門ｙ荳ｭ縺ｧ縺吶・n縺ｾ繧ゅ↑縺丞・髢倶ｺ亥ｮ壹〒縺吶・);
            hideTooltip();
            return;
        }

        // 繝ｭ繝ｼ繧ｫ繝ｫURL縺ｸ縺ｮ繧｢繧ｯ繧ｻ繧ｹ縺ｯ繝悶Ο繝・け
        if (baseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
            alert('縺薙・繧ｷ繧ｹ繝・Β縺ｯ迴ｾ蝨ｨ蛻ｩ逕ｨ縺ｧ縺阪∪縺帙ｓ縲・n邂｡逅・・↓縺雁撫縺・粋繧上○縺上□縺輔＞縲・);
            hideTooltip();
            return;
        }

        // 繝ｭ繝ｼ繧ｫ繝ｫ繧ｹ繝医Ξ繝ｼ繧ｸ縺九ｉ繝医・繧ｯ繝ｳ繧貞叙蠕・
        const token = localStorage.getItem('user_token');
        
        // URL縺ｫ繝医・繧ｯ繝ｳ繧偵け繧ｨ繝ｪ繝代Λ繝｡繝ｼ繧ｿ縺ｨ縺励※霑ｽ蜉
        let finalUrl = baseUrl;
        if (token) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const tokenParam = AppConfig.tokenParamName || 'auth_token';
            finalUrl = `${baseUrl}${separator}${tokenParam}=${encodeURIComponent(token)}`;
        }

        // 譁ｰ縺励＞繧ｿ繝悶〒髢九￥
        console.log('Opening URL with token:', finalUrl);
        window.open(finalUrl, '_blank');

        hideTooltip();
    });

    closeBtn.addEventListener('click', hideTooltip);
    overlay.addEventListener('click', hideTooltip);

    // 繝ｭ繧ｰ繧｢繧ｦ繝医・繧ｿ繝ｳ・医Ο繧ｰ繧､繝ｳ逕ｻ髱｢縺ｫ謌ｻ繧具ｼ・
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('繝ｭ繧ｰ繧｢繧ｦ繝医＠縺ｾ縺吶°・・)) {
                // 繝ｭ繝ｼ繧ｫ繝ｫ繧ｹ繝医Ξ繝ｼ繧ｸ繧偵け繝ｪ繧｢
                localStorage.removeItem('user_token');
                localStorage.removeItem('user_info');
                // 繝ｭ繧ｰ繧､繝ｳ繝輔か繝ｼ繝繧偵け繝ｪ繧｢縺吶ｋ繝輔Λ繧ｰ繧定ｨｭ螳・
                sessionStorage.setItem('clearLoginForm', 'true');
                window.location.href = '/login.html';
            }
        });
    }

    // 邨ゆｺ・・繧ｿ繝ｳ・医ム繝・す繝･繝懊・繝臥判髱｢繧帝哩縺倥ｋ・・
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            if (confirm('繝繝・す繝･繝懊・繝臥判髱｢繧帝哩縺倥∪縺吶°・・)) {
                // 繧ｦ繧｣繝ｳ繝峨え繧帝哩縺倥ｋ・医ヶ繝ｩ繧ｦ繧ｶ縺ｫ繧医▲縺ｦ縺ｯ讖溯・縺励↑縺・ｴ蜷医′縺ゅｋ・・
                window.close();
                
                // window.close()縺梧ｩ溯・縺励↑縺・ｴ蜷医・莉｣譖ｿ蜃ｦ逅・
                // 500ms蠕後↓遒ｺ隱阪＠縺ｦ縺ｾ縺髢九＞縺ｦ縺・ｋ蝣ｴ蜷医・繝｡繝・そ繝ｼ繧ｸ繧定｡ｨ遉ｺ
                setTimeout(() => {
                    alert('繝悶Λ繧ｦ繧ｶ縺ｮ繧ｿ繝悶ｒ謇句虚縺ｧ髢峨§縺ｦ縺上□縺輔＞縲・n縺ｾ縺溘・繝ｭ繧ｰ繧｢繧ｦ繝医・繧ｿ繝ｳ縺ｧ繝ｭ繧ｰ繧､繝ｳ逕ｻ髱｢縺ｫ謌ｻ繧九％縺ｨ縺後〒縺阪∪縺吶・);
                }, 500);
            }
        });
    }
});
