/**
 * Database Gateway Routing Module
 * 動的テーブルルーティング機能を提供
 * app_resource_routingテーブルを使用して論理リソース名を物理テーブルパスに変換
 */

const pool = require('./shared-db-config');

// ルーティングキャッシュ
const routingCache = new Map();
const CACHE_TTL = 60000; // 1分
const routingColumnCache = new Map();

async function getRoutingTableColumns() {
    const cacheKey = 'public.app_resource_routing';
    const now = Date.now();
    const cached = routingColumnCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.columns;
    }

    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_resource_routing'
    `;
    const result = await pool.query(columnsQuery);
    const columns = new Set(result.rows.map((row) => String(row.column_name || '').trim().toLowerCase()));
    routingColumnCache.set(cacheKey, {
        columns,
        timestamp: now
    });
    return columns;
}

function parseGatewayArgs(appIdOrOptions = 'dashboard-ui', maybeOptions = {}) {
    if (typeof appIdOrOptions === 'object' && appIdOrOptions !== null) {
        return {
            appId: String(appIdOrOptions.appId || 'dashboard-ui').trim(),
            options: appIdOrOptions
        };
    }

    return {
        appId: String(appIdOrOptions || 'dashboard-ui').trim() || 'dashboard-ui',
        options: (maybeOptions && typeof maybeOptions === 'object') ? maybeOptions : {}
    };
}

function resolveRuntimeTenantContext() {
    try {
        const runtimeResolver = global.__getActiveTenantRuntime
            || global.getActiveTenantRuntime
            || null;

        if (typeof runtimeResolver === 'function') {
            const runtime = runtimeResolver();
            if (runtime && typeof runtime === 'object') {
                return runtime;
            }
        }
    } catch (_) {
        // 実行コンテキスト解決に失敗しても後続フォールバックへ
    }

    try {
        const directRuntime = global.__tenantRuntime || global.tenantRuntime || null;
        if (directRuntime && typeof directRuntime === 'object') {
            return directRuntime;
        }
    } catch (_) {
        // noop
    }

    return null;
}

function getGatewayRoutingContext(options = {}) {
    const runtime = resolveRuntimeTenantContext();
    const runtimeTenantId = runtime
        ? (runtime.resolvedTenantId || runtime.requestedTenantId || runtime.companyId || '')
        : '';

  const tenantIdRaw = String(
        options.tenantId
        || options.req?.tenantContext?.resolvedTenantId
        || options.req?.tenantContext?.requestedTenantId
        || options.requestedTenantId
        || options.resolvedTenantId
        || runtimeTenantId
        || process.env.TENANT_ID
      || 'demo'
    ).trim().toLowerCase();
  const tenantId = tenantIdRaw === 'demo_env' ? 'demo' : tenantIdRaw;

  return { tenantId };
}

/**
 * 論理リソース名から物理テーブルパスを取得
 * @param {string} logicalResourceName - 論理リソース名 (例: 'users', 'machines')
 * @param {string|Object} appIdOrOptions - アプリケーションIDまたはオプション
 * @param {Object} maybeOptions - 追加オプション（tenantId等）
 * @returns {Promise<string>} - 物理テーブルパス (例: 'master_data.users')
 */
async function getTablePath(logicalResourceName, appIdOrOptions = 'dashboard-ui', maybeOptions = {}) {
    const { appId, options } = parseGatewayArgs(appIdOrOptions, maybeOptions);
    const routingContext = getGatewayRoutingContext(options);
    const cacheKey = `${routingContext.tenantId}:${appId}:${logicalResourceName}`;
    const cached = routingCache.get(cacheKey);
    
    // キャッシュチェック
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.path;
    }
    
    try {
        const routingQueryPool = pool;

        const columns = await getRoutingTableColumns();
        const selectColumns = ['app_id', 'physical_schema'];
        if (columns.has('id')) {
            selectColumns.push('id');
        }
        if (columns.has('tenant_id')) {
            selectColumns.push('tenant_id');
        }
        if (columns.has('physical_table_name')) {
            selectColumns.push('physical_table_name');
        }
        if (columns.has('physical_table')) {
            selectColumns.push('physical_table');
        }

        const params = [];
        const conditions = [];
        if (columns.has('tenant_id')) {
            params.push(routingContext.tenantId);
            conditions.push(`tenant_id = $${params.length}`);
        }
        params.push(appId);
        conditions.push(`app_id = $${params.length}`);
        params.push(logicalResourceName);
        conditions.push(`logical_resource_name = $${params.length}`);
        conditions.push('is_active = true');

        const query = `SELECT
                   ${selectColumns.join(', ')}
               FROM public.app_resource_routing
               WHERE ${conditions.join(' AND ')}
               LIMIT 1`;

        const result = await routingQueryPool.query(query, params);
        
        if (result.rows.length > 0) {
            const row = result.rows[0] || {};
            const physical_schema = row.physical_schema;
            const physical_table = row.physical_table || row.physical_table_name;

            if (!physical_schema || !physical_table) {
                throw new Error(`[db-gateway] Invalid routing row for ${routingContext.tenantId}:${appId}:${logicalResourceName}`);
            }

            const fullPath = `${physical_schema}.${physical_table}`;
            
            // キャッシュに保存
            routingCache.set(cacheKey, {
                path: fullPath,
                id: row.id || null,
                tenantId: row.tenant_id || routingContext.tenantId,
                appId: row.app_id || appId,
                physical_table_name: row.physical_table_name || physical_table,
                physical_table: physical_table,
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
        const suffix = `:${appId}:${logicalResourceName}`;
        for (const key of routingCache.keys()) {
            if (key.endsWith(suffix)) {
                routingCache.delete(key);
            }
        }
    } else if (appId) {
        // 特定のアプリのキャッシュをクリア
        for (const key of routingCache.keys()) {
            if (key.includes(`:${appId}:`)) {
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
