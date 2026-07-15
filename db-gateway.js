/**
 * Database Gateway Routing Module (Refactored)
 * 
 * 論理リソース名を物理テーブルパスに動的変換する共通モジュール
 * 
 * 【設計原則】
 * 1. ビジネスロジックから完全に独立
 * 2. app_resource_routingテーブルに基づく動的ルーティング
 * 3. 後方互換性を保持（フォールバック機能）
 * 4. マルチテナント対応
 * 5. キャッシュによるパフォーマンス最適化
 * 
 * 【将来対応】
 * - common_dbへのルーティングテーブル移植に対応可能な設計
 * - AI/RAG設定の集中管理への拡張対応
 */

const pool = require('./shared-db-config');

// ========================================
// キャッシュ管理
// ========================================
const routingCache = new Map();
const routingColumnCache = new Map();
const physicalTableColumnCache = new Map();
const CACHE_TTL = 60000; // 1分

/**
 * ルーティングテーブルのカラム情報を取得
 * @returns {Promise<Set<string>>} カラム名のセット
 */
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
    const columns = new Set(
        result.rows.map((row) => String(row.column_name || '').trim().toLowerCase())
    );
    
    routingColumnCache.set(cacheKey, {
        columns,
        timestamp: now
    });
    
    return columns;
}

/**
 * 物理テーブルのカラム情報を取得
 * @param {Object} route - ルート情報 { schema, table }
 * @returns {Promise<Set<string>>} カラム名のセット
 */
async function getPhysicalTableColumns(route) {
    const cacheKey = `columns:${route.schema}:${route.table}`;
    const now = Date.now();
    const cached = physicalTableColumnCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.columns;
    }

    const query = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
    `;
    
    const result = await pool.query(query, [route.schema, route.table]);
    const columns = new Set(
        result.rows.map((row) => String(row.column_name || '').trim().toLowerCase())
    );
    
    physicalTableColumnCache.set(cacheKey, {
        columns,
        timestamp: now
    });
    
    return columns;
}

/**
 * データをテーブルカラムでフィルタリング
 * @param {Object} data - フィルタリング対象データ
 * @param {Set<string>} columnSet - 有効なカラム名のセット
 * @returns {Object} フィルタリング済みデータ
 */
function filterDataByColumns(data, columnSet) {
    const entries = Object.entries(data || {}).filter(([key]) =>
        columnSet.has(String(key || '').trim().toLowerCase())
    );
    return Object.fromEntries(entries);
}

// ========================================
// テナントコンテキスト解決
// ========================================

/**
 * 実行コンテキストからテナント情報を解決
 * @returns {Object|null} テナント実行コンテキスト
 */
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

/**
 * ゲートウェイルーティング用のコンテキストを取得
 * @param {Object} options - オプション（tenantId, req等）
 * @returns {Object} { tenantId, dbName }
 */
function getGatewayRoutingContext(options = {}) {
    const runtime = resolveRuntimeTenantContext();
    const runtimeTenantId = runtime
        ? (runtime.resolvedTenantId || runtime.requestedTenantId || runtime.companyId || '')
        : '';
    const runtimeDbName = runtime?.dbName || '';

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
    const dbName = options.dbName || runtimeDbName || process.env.DB_NAME || 'common_db';

    return { tenantId, dbName };
}

/**
 * 引数パース（appIdOrOptions形式に対応）
 * @param {string|Object} appIdOrOptions - アプリIDまたはオプションオブジェクト
 * @param {Object} maybeOptions - 追加オプション
 * @returns {Object} { appId, options }
 */
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

// ========================================
// コアルーティング機能
// ========================================

/**
 * 論理リソース名から物理テーブルパスを取得
 * 
 * @param {string} logicalResourceName - 論理リソース名 (例: 'users', 'machines')
 * @param {string|Object} appIdOrOptions - アプリケーションID または オプションオブジェクト
 * @param {Object} maybeOptions - 追加オプション（appIdOrOptionsが文字列の場合）
 * @returns {Promise<Object>} ルート情報 { fullPath, schema, table, ... }
 * 
 * @example
 * // 基本的な使い方
 * const route = await getTablePath('users');
 * // => { fullPath: 'public.users', schema: 'public', table: 'users' }
 * 
 * // アプリIDを指定
 * const route = await getTablePath('vehicles', 'dashboard-ui');
 * 
 * // オプション指定
 * const route = await getTablePath('machines', { appId: 'dashboard-ui', tenantId: 'demo' });
 */
async function getTablePath(logicalResourceName, appIdOrOptions = 'dashboard-ui', maybeOptions = {}) {
    const { appId, options } = parseGatewayArgs(appIdOrOptions, maybeOptions);
    const routingContext = getGatewayRoutingContext(options);
    const cacheKey = `${routingContext.tenantId}:${appId}:${logicalResourceName}`;
    
    // キャッシュチェック
    const cached = routingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[db-gateway] Cache hit: ${logicalResourceName} → ${cached.fullPath}`);
        return cached;
    }
    
    try {
        const columns = await getRoutingTableColumns();
        const appIdColumn = columns.has('app_id')
            ? 'app_id'
            : (columns.has('application_id') ? 'application_id' : null);
        const schemaColumn = columns.has('physical_schema')
            ? 'physical_schema'
            : (columns.has('schema_name') ? 'schema_name' : null);
        const tableColumn = columns.has('physical_table')
            ? 'physical_table'
            : (columns.has('physical_table_name') ? 'physical_table_name' : (columns.has('table_name') ? 'table_name' : null));
        const logicalNameColumn = columns.has('logical_resource_name')
            ? 'logical_resource_name'
            : (columns.has('logical_name') ? 'logical_name' : (columns.has('resource_name') ? 'resource_name' : null));
        const isActiveColumn = columns.has('is_active')
            ? 'is_active'
            : (columns.has('active') ? 'active' : null);

        if (!schemaColumn || !tableColumn || !logicalNameColumn) {
            throw new Error('[db-gateway] app_resource_routing columns are insufficient for route resolution');
        }

        const selectColumns = [
            `${schemaColumn} AS physical_schema`,
            `${tableColumn} AS physical_table`
        ];
        if (appIdColumn) selectColumns.push(`${appIdColumn} AS app_id`);
        
        if (columns.has('id')) selectColumns.push('id');
        if (columns.has('tenant_id')) selectColumns.push('tenant_id');
        if (columns.has('physical_table_name')) selectColumns.push('physical_table_name');
        if (columns.has('physical_table')) selectColumns.push('physical_table');

        const params = [];
        const conditions = [];
        
        if (columns.has('tenant_id')) {
            params.push(routingContext.tenantId);
            conditions.push(`tenant_id = $${params.length}`);
        }
        
        if (appIdColumn) {
            params.push(appId);
            conditions.push(`${appIdColumn} = $${params.length}`);
        }
        params.push(logicalResourceName);
        conditions.push(`${logicalNameColumn} = $${params.length}`);
        if (isActiveColumn) conditions.push(`${isActiveColumn} = true`);

        const query = `
            SELECT ${selectColumns.join(', ')}
            FROM public.app_resource_routing
            WHERE ${conditions.join(' AND ')}
            LIMIT 1
        `;

        const result = await pool.query(query, params);
        
        if (result.rows.length > 0) {
            const row = result.rows[0] || {};
            const physical_schema = row.physical_schema;
            const physical_table = row.physical_table;

            if (!physical_schema || !physical_table) {
                throw new Error(
                    `[db-gateway] Invalid routing row: missing schema/table for ${routingContext.tenantId}:${appId}:${logicalResourceName}`
                );
            }

            const fullPath = `${physical_schema}."${physical_table}"`;
            const resolved = {
                id: row.id || null,
                tenantId: row.tenant_id || routingContext.tenantId,
                appId: row.app_id || appId,
                logicalName: logicalResourceName,
                fullPath,
                schema: physical_schema,
                table: physical_table,
                physical_table_name: row.physical_table_name || physical_table,
                physical_table: physical_table,
                timestamp: Date.now()
            };

            // キャッシュに保存
            routingCache.set(cacheKey, resolved);
            console.log(`[db-gateway] ✅ Resolved: ${logicalResourceName} → ${fullPath}`);
            return resolved;
        }

        // ルーティングが見つからない場合はmaster_dataスキーマにフォールバック
        console.warn(
            `[db-gateway] ⚠️ No route found for ${routingContext.tenantId}:${appId}:${logicalResourceName}, ` +
            `falling back to public.${logicalResourceName}`
        );
        
        const fallback = {
            fullPath: `public."${logicalResourceName}"`,
            schema: 'public',
            table: logicalResourceName,
            logicalName: logicalResourceName,
            appId: appId,
            tenantId: routingContext.tenantId,
            isFallback: true,
            timestamp: Date.now()
        };
        
        routingCache.set(cacheKey, fallback);
        return fallback;

    } catch (err) {
        console.error(`[db-gateway] ❌ Error resolving ${logicalResourceName}:`, err.message);
        console.error(`[db-gateway] Stack:`, err.stack);
        
        // エラー時もpublicスキーマにフォールバック
        const fallback = {
            fullPath: `public."${logicalResourceName}"`,
            schema: 'public',
            table: logicalResourceName,
            logicalName: logicalResourceName,
            appId: appId,
            tenantId: routingContext.tenantId,
            isFallback: true,
            isError: true,
            timestamp: Date.now()
        };
        
        console.log(`[db-gateway] Using error fallback: master_data."${logicalResourceName}"`);
        return fallback;
    }
}

// ========================================
// 動的CRUD操作
// ========================================

/**
 * 動的SELECT
 * 
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} conditions - WHERE条件 (例: { username: 'admin', role: 'admin' })
 * @param {Array<string>} columns - 取得するカラム (省略時は全カラム)
 * @param {number} limit - LIMIT数 (省略可)
 * @param {string|Object} appIdOrOptions - アプリID または オプション
 * @returns {Promise<Array>} クエリ結果の行配列
 */
async function dynamicSelect(logicalTableName, conditions = {}, columns = ['*'], limit = null, appIdOrOptions = 'dashboard-ui') {
    const { appId, options } = parseGatewayArgs(appIdOrOptions);
    let query = '';
    let params = [];
    let route = null;
    
    try {
        route = await getTablePath(logicalTableName, appId, options);
        const columnList = columns.join(', ');
        query = `SELECT ${columnList} FROM ${route.fullPath}`;

        // WHERE句の構築
        const whereConditions = Object.entries(conditions).map(([key, value], index) => {
            params.push(value);
            return `${key} = $${index + 1}`;
        });

        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        if (limit) {
            query += ` LIMIT ${limit}`;
        }

        console.log(`[db-gateway] SELECT from ${route.fullPath}`);
        const result = await pool.query(query, params);
        console.log(`[db-gateway] ✅ SELECT success: ${result.rows.length} rows`);
        return result.rows;
        
    } catch (err) {
        console.error(`[db-gateway] ❌ SELECT error for table ${logicalTableName}:`, err.message);
        console.error(`[db-gateway] Query:`, query || 'N/A');
        console.error(`[db-gateway] Params:`, params);
        console.error(`[db-gateway] Path:`, route?.fullPath || 'N/A');
        throw err;
    }
}

/**
 * 動的INSERT
 * 
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} data - 挿入データ
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: true)
 * @param {string|Object} appIdOrOptions - アプリID または オプション
 * @returns {Promise<Array>} 挿入された行
 */
async function dynamicInsert(logicalTableName, data, returning = true, appIdOrOptions = 'dashboard-ui') {
    const { appId, options } = parseGatewayArgs(appIdOrOptions);
    let query = '';
    let route = null;
    let keys = Object.keys(data);
    let values = Object.values(data);
    
    try {
        route = await getTablePath(logicalTableName, appId, options);
        const columnSet = await getPhysicalTableColumns(route);
        const filteredData = filterDataByColumns(data, columnSet);
        keys = Object.keys(filteredData);
        values = Object.values(filteredData);

        if (keys.length === 0) {
            throw new Error(`[db-gateway] INSERT failed: no insertable columns for ${route.fullPath}`);
        }

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        query = `INSERT INTO ${route.fullPath} (${keys.join(', ')}) VALUES (${placeholders})`;

        if (returning) {
            query += ' RETURNING *';
        }

        console.log(`[db-gateway] INSERT into ${route.fullPath}`);
        const result = await pool.query(query, values);
        console.log(`[db-gateway] ✅ INSERT success`);
        return result.rows;
        
    } catch (err) {
        console.error(`[db-gateway] ❌ INSERT error for table ${logicalTableName}:`, err.message);
        console.error(`[db-gateway] Query:`, query || 'N/A');
        console.error(`[db-gateway] Values:`, values);
        console.error(`[db-gateway] Path:`, route?.fullPath || 'N/A');
        throw err;
    }
}

/**
 * 動的UPDATE
 * 
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} data - 更新データ
 * @param {Object} conditions - WHERE条件
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: true)
 * @param {string|Object} appIdOrOptions - アプリID または オプション
 * @returns {Promise<Array>} 更新された行
 */
async function dynamicUpdate(logicalTableName, data, conditions, returning = true, appIdOrOptions = 'dashboard-ui') {
    const { appId, options } = parseGatewayArgs(appIdOrOptions);
    let query = '';
    let route = null;
    let setKeys = Object.keys(data);
    let setValues = Object.values(data);
    let conditionKeys = Object.keys(conditions);
    let conditionValues = Object.values(conditions);
    
    try {
        route = await getTablePath(logicalTableName, appId, options);
        const columnSet = await getPhysicalTableColumns(route);

        const filteredSetData = filterDataByColumns(data, columnSet);
        setKeys = Object.keys(filteredSetData);
        setValues = Object.values(filteredSetData);

        const filteredConditionData = filterDataByColumns(conditions, columnSet);
        conditionKeys = Object.keys(filteredConditionData);
        conditionValues = Object.values(filteredConditionData);

        if (setKeys.length === 0) {
            throw new Error(`[db-gateway] UPDATE failed: no updatable columns for ${route.fullPath}`);
        }
        if (conditionKeys.length === 0) {
            throw new Error(`[db-gateway] UPDATE failed: no valid condition columns for ${route.fullPath}`);
        }

        const setClause = setKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        const whereClause = conditionKeys.map((key, i) => `${key} = $${setKeys.length + i + 1}`).join(' AND ');

        query = `UPDATE ${route.fullPath} SET ${setClause} WHERE ${whereClause}`;

        if (returning) {
            query += ' RETURNING *';
        }

        console.log(`[db-gateway] UPDATE ${route.fullPath}`);
        const result = await pool.query(query, [...setValues, ...conditionValues]);
        console.log(`[db-gateway] ✅ UPDATE success: ${result.rows.length} rows`);
        return result.rows;
        
    } catch (err) {
        console.error(`[db-gateway] ❌ UPDATE error for table ${logicalTableName}:`, err.message);
        console.error(`[db-gateway] Query:`, query || 'N/A');
        console.error(`[db-gateway] Params:`, [...setValues, ...conditionValues]);
        console.error(`[db-gateway] Path:`, route?.fullPath || 'N/A');
        throw err;
    }
}

/**
 * 動的DELETE
 * 
 * @param {string} logicalTableName - 論理テーブル名
 * @param {Object} conditions - WHERE条件
 * @param {boolean} returning - RETURNING句を使うか (デフォルト: false)
 * @param {string|Object} appIdOrOptions - アプリID または オプション
 * @returns {Promise<Array>} 削除された行
 */
async function dynamicDelete(logicalTableName, conditions, returning = false, appIdOrOptions = 'dashboard-ui') {
    const { appId, options } = parseGatewayArgs(appIdOrOptions);
    let query = '';
    let route = null;
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);
    
    try {
        route = await getTablePath(logicalTableName, appId, options);

        const whereClause = conditionKeys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        query = `DELETE FROM ${route.fullPath}`;

        if (conditionKeys.length > 0) {
            query += ` WHERE ${whereClause}`;
        }

        if (returning) {
            query += ' RETURNING *';
        }

        console.log(`[db-gateway] DELETE from ${route.fullPath}`);
        const result = await pool.query(query, conditionValues);
        console.log(`[db-gateway] ✅ DELETE success: ${result.rows.length} rows`);
        return result.rows;
        
    } catch (err) {
        console.error(`[db-gateway] ❌ DELETE error for table ${logicalTableName}:`, err.message);
        console.error(`[db-gateway] Query:`, query || 'N/A');
        console.error(`[db-gateway] Params:`, conditionValues);
        console.error(`[db-gateway] Path:`, route?.fullPath || 'N/A');
        throw err;
    }
}

/**
 * 生SQLクエリ内のテーブル名を置換
 * 
 * @param {string} query - SQL クエリ
 * @param {Object} resourceMap - { 論理名: 物理パス } のマッピング
 * @returns {string} 置換後のクエリ
 * 
 * @example
 * const query = "SELECT * FROM users WHERE id = 1";
 * const mapped = replaceTableNames(query, { users: 'master_data.users' });
 * // => "SELECT * FROM master_data.users WHERE id = 1"
 */
function replaceTableNames(query, resourceMap) {
    let result = query;
    for (const [logical, physical] of Object.entries(resourceMap)) {
        const regex = new RegExp(`\\b${logical}\\b`, 'gi');
        result = result.replace(regex, physical);
    }
    return result;
}

// ========================================
// キャッシュ管理
// ========================================

/**
 * すべてのキャッシュをクリア
 */
function clearCache() {
    routingCache.clear();
    routingColumnCache.clear();
    physicalTableColumnCache.clear();
    console.log('[db-gateway] All caches cleared');
}

/**
 * 特定のリソースまたはアプリのキャッシュをクリア
 * 
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
        console.log(`[db-gateway] Cache cleared for: ${appId}:${logicalResourceName}`);
    } else if (appId) {
        for (const key of routingCache.keys()) {
            if (key.includes(`:${appId}:`)) {
                routingCache.delete(key);
            }
        }
        console.log(`[db-gateway] Cache cleared for app: ${appId}`);
    }
}

// ========================================
// エクスポート
// ========================================

module.exports = {
    // コアルーティング
    getTablePath,
    
    // CRUD操作
    dynamicSelect,
    dynamicInsert,
    dynamicUpdate,
    dynamicDelete,
    
    // ユーティリティ
    replaceTableNames,
    clearCache,
    clearCacheFor,
    
    // DBプール（互換性のため）
    pool,
    
    // ヘルパー関数（必要に応じて公開）
    getPhysicalTableColumns,
    filterDataByColumns,
};
