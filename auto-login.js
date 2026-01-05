/**
 * 閾ｪ蜍輔Ο繧ｰ繧､繝ｳ蜃ｦ逅・せ繧ｯ繝ｪ繝励ヨ
 * 
 * 縲蝉ｽｿ逕ｨ譁ｹ豕輔・
 * 莉悶・繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮHTML繝輔ぃ繧､繝ｫ縺ｧ縲√％縺ｮ繧ｹ繧ｯ繝ｪ繝励ヨ繧定ｪｭ縺ｿ霎ｼ縺ｿ縺ｾ縺呻ｼ・
 * <script src="./auto-login.js"></script>
 * 
 * 縲先ｩ溯・縲・
 * - URL繝代Λ繝｡繝ｼ繧ｿ縺九ｉ隱崎ｨｼ繝医・繧ｯ繝ｳ繧貞叙蠕・
 * - 繝医・繧ｯ繝ｳ繧呈､懆ｨｼ縺励※繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧貞叙蠕・
 * - 閾ｪ蜍慕噪縺ｫ繝ｭ繧ｰ繧､繝ｳ繧ｻ繝・す繝ｧ繝ｳ繧堤｢ｺ遶・
 * - 繝ｭ繧ｰ繧､繝ｳ逕ｻ髱｢繧偵せ繧ｭ繝・・縺励※繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ繧定｡ｨ遉ｺ
 * 
 * 縲仙燕謠先擅莉ｶ縲・
 * - 騾∽ｿ｡蜈・い繝励Μ縺ｨ蜷後§JWT_SECRET繧剃ｽｿ逕ｨ縺励※縺・ｋ縺薙→
 * - 繧ｵ繝ｼ繝舌・蛛ｴ縺ｫ /api/verify-token 繧ｨ繝ｳ繝峨・繧､繝ｳ繝医′縺ゅｋ縺薙→
 */

(function() {
    'use strict';

    /**
     * URL繝代Λ繝｡繝ｼ繧ｿ縺九ｉ繝医・繧ｯ繝ｳ繧貞叙蠕・
     */
    function getTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        // 'auth_token' 縺ｾ縺溘・ 'token' 繝代Λ繝｡繝ｼ繧ｿ繧堤｢ｺ隱・
        return urlParams.get('auth_token') || urlParams.get('token');
    }

    /**
     * 繝医・繧ｯ繝ｳ繧呈､懆ｨｼ縺励※繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧貞叙蠕・
     */
    async function verifyToken(token, apiBaseUrl) {
        try {
            // 繝・ヰ繝・げ: 繝医・繧ｯ繝ｳ縺ｮ繝壹う繝ｭ繝ｼ繝峨ｒ遒ｺ隱搾ｼ育ｽｲ蜷肴､懆ｨｼ縺ｪ縺暦ｼ・
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    console.log('剥 Token Payload Preview:', payload);
                }
            } catch (e) {
                console.warn('Failed to parse token payload:', e);
            }

            const response = await fetch(`${apiBaseUrl}/api/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                throw new Error('繝医・繧ｯ繝ｳ讀懆ｨｼ縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Token verification error:', error);
            return null;
        }
    }

    /**
     * 繝ｭ繝ｼ繧ｫ繝ｫ繧ｹ繝医Ξ繝ｼ繧ｸ縺ｫ繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧剃ｿ晏ｭ・
     */
    function saveUserSession(token, userInfo) {
        localStorage.setItem('user_token', token);
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        console.log('笨・繧ｻ繝・す繝ｧ繝ｳ諠・ｱ繧剃ｿ晏ｭ倥＠縺ｾ縺励◆:', userInfo);
    }

    /**
     * URL縺九ｉ繝医・繧ｯ繝ｳ繝代Λ繝｡繝ｼ繧ｿ繧貞炎髯､・医そ繧ｭ繝･繝ｪ繝・ぅ蜷台ｸ奇ｼ・
     */
    function removeTokenFromUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete('auth_token');
        url.searchParams.delete('token');
        window.history.replaceState({}, document.title, url.toString());
    }

    /**
     * 閾ｪ蜍輔Ο繧ｰ繧､繝ｳ蜃ｦ逅・・繝｡繧､繝ｳ髢｢謨ｰ
     */
    async function autoLogin(config = {}) {
        // 險ｭ螳壹・繝・ヵ繧ｩ繝ｫ繝亥､
        const defaultConfig = {
            apiBaseUrl: window.location.origin, // 迴ｾ蝨ｨ縺ｮ繧ｪ繝ｪ繧ｸ繝ｳ
            redirectOnSuccess: null, // 繝ｭ繧ｰ繧､繝ｳ謌仙粥蠕後・繝ｪ繝繧､繝ｬ繧ｯ繝亥・・・ull = 繝ｪ繝繧､繝ｬ繧ｯ繝医↑縺暦ｼ・
            redirectOnFailure: '/login.html', // 繝医・繧ｯ繝ｳ讀懆ｨｼ螟ｱ謨玲凾縺ｮ繝ｪ繝繧､繝ｬ繧ｯ繝亥・
            onSuccess: null, // 謌仙粥譎ゅ・繧ｳ繝ｼ繝ｫ繝舌ャ繧ｯ髢｢謨ｰ
            onFailure: null, // 螟ｱ謨玲凾縺ｮ繧ｳ繝ｼ繝ｫ繝舌ャ繧ｯ髢｢謨ｰ
            showConsoleLog: true // 繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ繝ｭ繧ｰ繧定｡ｨ遉ｺ縺吶ｋ縺・
        };

        const cfg = { ...defaultConfig, ...config };

        // 譌｢縺ｫ繝ｭ繧ｰ繧､繝ｳ貂医∩縺九メ繧ｧ繝・け
        const existingToken = localStorage.getItem('user_token');
        if (existingToken) {
            if (cfg.showConsoleLog) {
                console.log('邃ｹ・・譌｢縺ｫ繝ｭ繧ｰ繧､繝ｳ繧ｻ繝・す繝ｧ繝ｳ縺悟ｭ伜惠縺励∪縺・);
            }
            return true;
        }

        // URL縺九ｉ繝医・繧ｯ繝ｳ繧貞叙蠕・
        const token = getTokenFromUrl();
        if (!token) {
            if (cfg.showConsoleLog) {
                console.log('邃ｹ・・URL縺ｫ繝医・繧ｯ繝ｳ縺悟性縺ｾ繧後※縺・∪縺帙ｓ');
            }
            return false;
        }

        if (cfg.showConsoleLog) {
            console.log('柏 繝医・繧ｯ繝ｳ繧呈､懷・縺励∪縺励◆縲よ､懆ｨｼ荳ｭ...');
        }

        // 繝医・繧ｯ繝ｳ繧呈､懆ｨｼ
        const result = await verifyToken(token, cfg.apiBaseUrl);

        if (result && result.valid && result.user) {
            // 讀懆ｨｼ謌仙粥
            saveUserSession(token, result.user);
            removeTokenFromUrl();

            if (cfg.showConsoleLog) {
                console.log('笨・閾ｪ蜍輔Ο繧ｰ繧､繝ｳ縺ｫ謌仙粥縺励∪縺励◆');
            }

            // 謌仙粥譎ゅ・繧ｳ繝ｼ繝ｫ繝舌ャ繧ｯ螳溯｡・
            if (typeof cfg.onSuccess === 'function') {
                cfg.onSuccess(result.user);
            }

            // 繝ｪ繝繧､繝ｬ繧ｯ繝亥・逅・
            if (cfg.redirectOnSuccess) {
                setTimeout(() => {
                    window.location.href = cfg.redirectOnSuccess;
                }, 100);
            }

            return true;
        } else {
            // 讀懆ｨｼ螟ｱ謨・
            if (cfg.showConsoleLog) {
                console.error('笶・繝医・繧ｯ繝ｳ讀懆ｨｼ縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
            }

            removeTokenFromUrl();

            // 螟ｱ謨玲凾縺ｮ繧ｳ繝ｼ繝ｫ繝舌ャ繧ｯ螳溯｡・
            if (typeof cfg.onFailure === 'function') {
                cfg.onFailure();
            }

            // 繝ｪ繝繧､繝ｬ繧ｯ繝亥・逅・
            if (cfg.redirectOnFailure) {
                setTimeout(() => {
                    window.location.href = cfg.redirectOnFailure;
                }, 100);
            }

            return false;
        }
    }

    /**
     * 繧ｰ繝ｭ繝ｼ繝舌Ν縺ｫ蜈ｬ髢・
     */
    window.AutoLogin = {
        execute: autoLogin,
        getTokenFromUrl: getTokenFromUrl,
        verifyToken: verifyToken
    };

    /**
     * DOMContentLoaded譎ゅ↓閾ｪ蜍募ｮ溯｡鯉ｼ医が繝励す繝ｧ繝ｳ・・
     * 閾ｪ蜍募ｮ溯｡後＠縺溘￥縺ｪ縺・ｴ蜷医・縲『indow.AutoLogin.execute() 繧呈焔蜍輔〒蜻ｼ縺ｳ蜃ｺ縺励※縺上□縺輔＞
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // 繝・ヵ繧ｩ繝ｫ繝郁ｨｭ螳壹〒閾ｪ蜍募ｮ溯｡・
            // 蠢・ｦ√↓蠢懊§縺ｦ繧ｫ繧ｹ繧ｿ繝槭う繧ｺ縺励※縺上□縺輔＞
            autoLogin({
                showConsoleLog: true,
                // redirectOnSuccess: '/dashboard', // 蠢・ｦ√↓蠢懊§縺ｦ險ｭ螳・
                // redirectOnFailure: '/login.html' // 蠢・ｦ√↓蠢懊§縺ｦ險ｭ螳・
            });
        });
    } else {
        // DOM縺梧里縺ｫ隱ｭ縺ｿ霎ｼ縺ｾ繧後※縺・ｋ蝣ｴ蜷医・蜊ｳ螳溯｡・
        autoLogin({
            showConsoleLog: true
        });
    }
})();
