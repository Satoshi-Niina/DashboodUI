/**
 * Database Gateway Routing Module
 * 動的テーブルルーティング機能を提供
 * app_resource_routingテーブルを使用して論理リソース名を物理テーブルパスに変換
 */

const pool = require('./shared-db-config');
const { Pool } = require('pg');

// ルーティングキャッシュ
const routingCache = new Map();
const CACHE_TTL = 60000; // 1分
const gatewayTenantPoolCache = new Map();
const tenantDbNameCache = new Map();
const TENANT_DB_NAME_CACHE_TTL = 60000;

function getTenantRoutingDbName() {
    return (process.env.TENANT_ROUTING_DB_NAME || process.env.CONTROL_PLANE_DB_NAME || 'common_db').trim();
}

function buildGatewayDbPoolConfig(dbName) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (process.env.DATABASE_URL) {
        try {
            const parsed = new URL(process.env.DATABASE_URL);
            parsed.pathname = `/${dbName}`;
            return { connectionString: parsed.toString() };
        } catch (_) {
            return { connectionString: process.env.DATABASE_URL };
        }
    }

    if (isProduction && process.env.CLOUD_SQL_INSTANCE) {
        return {
            host: `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: dbName,
            max: 5
        };
    }

    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: dbName,
        max: 5
    };
}

function getOrCreateGatewayDbPool(dbName) {
    if (!dbName) {
        return pool;
    }

    if (gatewayTenantPoolCache.has(dbName)) {
        return gatewayTenantPoolCache.get(dbName);
    }

    const createdPool = new Pool(buildGatewayDbPoolConfig(dbName));
    createdPool.on('error', (err) => {
        console.error(`[db-gateway] Unexpected error on pool ${dbName}:`, err.message);
    });
    gatewayTenantPoolCache.set(dbName, createdPool);
    return createdPool;
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

    const tenantId = String(
        options.tenantId
        || options.req?.tenantContext?.resolvedTenantId
        || options.req?.tenantContext?.requestedTenantId
        || options.requestedTenantId
        || options.resolvedTenantId
        || runtimeTenantId
        || process.env.TENANT_ID
        || 'demo_env'
    ).trim().toLowerCase();
    const useCommonRouting = tenantId === 'daitetsu';

    return { tenantId, useCommonRouting };
}

async function resolveTenantDbNameFromCommonRouting(tenantId, appId) {
    const normalizedTenantId = String(tenantId || '').trim().toLowerCase();
    if (!normalizedTenantId || normalizedTenantId === 'demo_env') {
        return null;
    }

    const normalizedAppId = String(appId || 'dashboard-ui').trim() || 'dashboard-ui';
    const cacheKey = `${normalizedTenantId}:${normalizedAppId}`;
    const cached = tenantDbNameCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TENANT_DB_NAME_CACHE_TTL) {
        return cached.dbName;
    }

    const routingPool = getOrCreateGatewayDbPool(getTenantRoutingDbName());
    const result = await routingPool.query(
        `SELECT physical_schema
         FROM public.app_resource_routing
         WHERE tenant_id = $1
           AND app_id = $2
           AND is_active = true
         ORDER BY id
         LIMIT 1`,
        [normalizedTenantId, normalizedAppId]
    );

    const dbName = String(result.rows[0]?.physical_schema || '').trim();
    if (dbName) {
        tenantDbNameCache.set(cacheKey, {
            dbName,
            timestamp: Date.now()
        });
        return dbName;
    }

    return null;
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
        let routingQueryPool = pool;

        if (routingContext.tenantId && routingContext.tenantId !== 'demo_env') {
            const tenantDbName = await resolveTenantDbNameFromCommonRouting(routingContext.tenantId, appId);
            if (tenantDbName) {
                routingQueryPool = getOrCreateGatewayDbPool(tenantDbName);
            }
        }

        const query = `SELECT physical_schema, physical_table
               FROM public.app_resource_routing
               WHERE app_id = $1
                 AND logical_resource_name = $2
                 AND is_active = true
               LIMIT 1`;

        const result = await routingQueryPool.query(query, [appId, logicalResourceName]);
        
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
    tenantDbNameCache.clear();
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
