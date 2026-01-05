/**
 * Database Gateway Routing Module
 * 蜍慕噪繝・・繝悶Ν繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ讖溯・繧呈署萓・
 * app_resource_routing繝・・繝悶Ν繧剃ｽｿ逕ｨ縺励※隲也炊繝ｪ繧ｽ繝ｼ繧ｹ蜷阪ｒ迚ｩ逅・ユ繝ｼ繝悶Ν繝代せ縺ｫ螟画鋤
 */

const pool = require('./shared-db-config');

// 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧ｭ繝｣繝・す繝･
const routingCache = new Map();
const CACHE_TTL = 60000; // 1蛻・

/**
 * 隲也炊繝ｪ繧ｽ繝ｼ繧ｹ蜷阪°繧臥黄逅・ユ繝ｼ繝悶Ν繝代せ繧貞叙蠕・
 * @param {string} logicalResourceName - 隲也炊繝ｪ繧ｽ繝ｼ繧ｹ蜷・(萓・ 'users', 'machines')
 * @param {string} appId - 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳID (萓・ 'dashboard-ui')
 * @returns {Promise<string>} - 迚ｩ逅・ユ繝ｼ繝悶Ν繝代せ (萓・ 'master_data.users')
 */
async function getTablePath(logicalResourceName, appId = 'dashboard-ui') {
    const cacheKey = `${appId}:${logicalResourceName}`;
    const cached = routingCache.get(cacheKey);
    
    // 繧ｭ繝｣繝・す繝･繝√ぉ繝・け
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.path;
    }
    
    try {
        const result = await pool.query(
            `SELECT physical_schema, physical_table 
             FROM public.app_resource_routing 
             WHERE app_id = $1 
               AND logical_resource_name = $2 
               AND is_active = true
             LIMIT 1`,
            [appId, logicalResourceName]
        );
        
        if (result.rows.length > 0) {
            const { physical_schema, physical_table } = result.rows[0];
            const fullPath = `${physical_schema}.${physical_table}`;
            
            // 繧ｭ繝｣繝・す繝･縺ｫ菫晏ｭ・
            routingCache.set(cacheKey, {
                path: fullPath,
                timestamp: Date.now()
            });
            
            return fullPath;
        }
        
        // 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ縺瑚ｦ九▽縺九ｉ縺ｪ縺・ｴ蜷医・public schema 繧偵ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ
        console.warn(`No routing found for ${appId}:${logicalResourceName}, using public schema`);
        return `public.${logicalResourceName}`;
        
    } catch (error) {
        console.error('Error fetching table routing:', error);
        // 繧ｨ繝ｩ繝ｼ譎ゅ・繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
        return `public.${logicalResourceName}`;
    }
}

/**
 * 繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
 */
function clearCache() {
    routingCache.clear();
    console.log('Routing cache cleared');
}

/**
 * 迚ｹ螳壹・繝ｪ繧ｽ繝ｼ繧ｹ縺ｾ縺溘・繧｢繝励Μ縺ｮ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
 * @param {string} appId - 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳID・育怐逡･蜿ｯ・・
 * @param {string} logicalResourceName - 隲也炊繝ｪ繧ｽ繝ｼ繧ｹ蜷搾ｼ育怐逡･蜿ｯ・・
 */
function clearCacheFor(appId, logicalResourceName) {
    if (appId && logicalResourceName) {
        const cacheKey = `${appId}:${logicalResourceName}`;
        routingCache.delete(cacheKey);
    } else if (appId) {
        // 迚ｹ螳壹・繧｢繝励Μ縺ｮ繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
        for (const key of routingCache.keys()) {
            if (key.startsWith(`${appId}:`)) {
                routingCache.delete(key);
            }
        }
    }
}

/**
 * SQL繧ｯ繧ｨ繝ｪ蜀・・隲也炊繝・・繝悶Ν蜷阪ｒ迚ｩ逅・ヱ繧ｹ縺ｫ鄂ｮ謠・
 * @param {string} query - SQL繧ｯ繧ｨ繝ｪ
 * @param {Object} resourceMap - {隲也炊蜷・ 迚ｩ逅・ヱ繧ｹ}縺ｮ繝槭ャ繝・
 * @returns {string} - 鄂ｮ謠帛ｾ後・繧ｯ繧ｨ繝ｪ
 */
function replaceTableNames(query, resourceMap) {
    let result = query;
    for (const [logical, physical] of Object.entries(resourceMap)) {
        // 繝・・繝悶Ν蜷阪・鄂ｮ謠幢ｼ亥､ｧ譁・ｭ怜ｰ乗枚蟄励ｒ蛹ｺ蛻･縺励↑縺・ｼ・
        const regex = new RegExp(`\\b${logical}\\b`, 'gi');
        result = result.replace(regex, physical);
    }
    return result;
}

module.exports = {
    getTablePath,
    clearCache,
    clearCacheFor,
    replaceTableNames,
    pool
};
