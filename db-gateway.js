/**
 * Database Gateway Routing Module
 * 動的テーブルルーティング機能を提供
 * app_resource_routingテーブルを使用して論理リソース名を物理テーブルパスに変換
 */

const pool = require('./shared-db-config');

// ルーティングキャッシュ
const routingCache = new Map();
const CACHE_TTL = 60000; // 1分

/**
 * 論理リソース名から物理テーブルパスを取得
 * @param {string} logicalResourceName - 論理リソース名 (例: 'users', 'machines')
 * @param {string} appId - アプリケーションID (例: 'dashboard-ui')
 * @returns {Promise<string>} - 物理テーブルパス (例: 'master_data.users')
 */
async function getTablePath(logicalResourceName, appId = 'dashboard-ui') {
    const cacheKey = `${appId}:${logicalResourceName}`;
    const cached = routingCache.get(cacheKey);
    
    // キャッシュチェック
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
            
            // キャッシュに保存
            routingCache.set(cacheKey, {
                path: fullPath,
                timestamp: Date.now()
            });
            
            return fullPath;
        }
        
        // ルーティングが見つからない場合はpublic schema をフォールバック
        console.warn(`No routing found for ${appId}:${logicalResourceName}, using public schema`);
        return `public.${logicalResourceName}`;
        
    } catch (error) {
        console.error('Error fetching table routing:', error);
        // エラー時はフォールバック
        return `public.${logicalResourceName}`;
    }
}

/**
 * キャッシュをクリア
 */
function clearCache() {
    routingCache.clear();
    console.log('Routing cache cleared');
}

/**
 * 特定のリソースまたはアプリのキャッシュをクリア
 * @param {string} appId - アプリケーションID（省略可）
 * @param {string} logicalResourceName - 論理リソース名（省略可）
 */
function clearCacheFor(appId, logicalResourceName) {
    if (appId && logicalResourceName) {
        const cacheKey = `${appId}:${logicalResourceName}`;
        routingCache.delete(cacheKey);
    } else if (appId) {
        // 特定のアプリのキャッシュをクリア
        for (const key of routingCache.keys()) {
            if (key.startsWith(`${appId}:`)) {
                routingCache.delete(key);
            }
        }
    }
}

/**
 * SQLクエリ内の論理テーブル名を物理パスに置換
 * @param {string} query - SQLクエリ
 * @param {Object} resourceMap - {論理名: 物理パス}のマップ
 * @returns {string} - 置換後のクエリ
 */
function replaceTableNames(query, resourceMap) {
    let result = query;
    for (const [logical, physical] of Object.entries(resourceMap)) {
        // テーブル名の置換（大文字小文字を区別しない）
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
