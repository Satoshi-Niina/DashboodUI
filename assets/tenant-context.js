(function () {
    'use strict';

    const STORAGE_KEY = 'tenant_context';
    const LOGIN_STORAGE_KEY = 'login_tenant_context';
    const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
    const nativeFetch = window.fetch.bind(window);
    let initPromise = null;
    let tenantContext = null;
    let lastTokenRefreshAt = 0;
    let refreshInFlightPromise = null;
    const axiosClient = window.axios && typeof window.axios.create === 'function'
        ? window.axios.create({ withCredentials: true })
        : null;

    function getCurrentFullUrl() {
        return window.location.href;
    }

    function normalizeUrl(rawUrl) {
        if (!rawUrl) return '';
        try {
            const url = new URL(String(rawUrl));
            const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
            return `${url.origin}${normalizedPath}`.toLowerCase();
        } catch (_) {
            return String(rawUrl).trim().replace(/\/+$/, '').toLowerCase();
        }
    }

    function normalizePath(rawPath) {
        if (!rawPath) return '/';
        try {
            const url = new URL(String(rawPath));
            return (url.pathname.replace(/\/+$/, '') || '/').toLowerCase();
        } catch (_) {
            const raw = String(rawPath).trim();
            if (!raw) return '/';
            const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
            return (withSlash.replace(/\/+$/, '') || '/').toLowerCase();
        }
    }

    function getTenantKeyFromPath(pathname) {
        const normalizedPath = normalizePath(pathname);
        const segments = normalizedPath.split('/').filter(Boolean);

        if (segments.length === 0) {
            return 'demo';
        }

        const first = String(segments[0] || '').trim().toLowerCase();
        const excludedPaths = new Set([
            'api',
            'assets',
            'admin.html',
            'index.html',
            'login',
            'login.html'
        ]);

        // HTMLファイル名や予約パスはテナント名として扱わず demo にフォールバック
        if (!first || excludedPaths.has(first) || first.endsWith('.html')) {
            return 'demo';
        }

        return first;
    }

    function getTenantKeyFromSearchParams(search) {
        try {
            const params = new URLSearchParams(search || window.location.search || '');
            const rawTenantId = params.get('tenant_id')
                || params.get('tenantId')
                || params.get('tenant')
                || params.get('company_id')
                || '';
            const normalized = normalizeTenantId(rawTenantId);
            if (!normalized || normalized === 'demo_env') {
                return 'demo';
            }
            return normalized;
        } catch (_) {
            return 'demo';
        }
    }

    function tenantIdFromPath(pathname) {
        return getTenantKeyFromPath(pathname);
    }

    function tenantPathFromUrl(fullUrl) {
        const tenantId = tenantIdFromPath(fullUrl);
        const pathname = normalizePath(fullUrl);
        const firstSegment = pathname.split('/').filter(Boolean)[0] || '';
        if (tenantId === 'demo' && firstSegment === 'demo') {
            return '/demo';
        }
        return tenantId === 'demo' ? '/' : `/${tenantId}`;
    }

    function normalizeTenantId(rawTenantId) {
        const normalized = String(rawTenantId || '').trim().toLowerCase();
        if (!normalized || normalized === 'demo_env') {
            return 'demo';
        }
        return normalized;
    }

    function tenantPathFromTenantId(rawTenantId) {
        const tenantId = normalizeTenantId(rawTenantId);
        return tenantId === 'demo' ? '/' : `/${tenantId}`;
    }

    function normalizeTenantContext(rawContext) {
        if (!rawContext) {
            return null;
        }

        const tenantId = normalizeTenantId(rawContext.tenant_id || rawContext.tenantId || rawContext.companyId);
        const rawTenantPath = rawContext.tenant_path || rawContext.tenantPath || tenantPathFromTenantId(tenantId);
        const tenantPath = normalizePath(rawTenantPath || tenantPathFromTenantId(tenantId));
        const companyName = String(rawContext.company_name || rawContext.companyName || rawContext.tenant_name || rawContext.tenantName || '').trim();
        const companyCode = String(rawContext.company_code || rawContext.companyCode || tenantId).trim().toLowerCase();
        const roles = Array.isArray(rawContext.roles) ? rawContext.roles : [];

        return {
            tenantId,
            tenant_id: tenantId,
            tenantPath,
            tenant_path: tenantPath,
            role: rawContext.role || '',
            companyName,
            company_name: companyName,
            tenantName: companyName,
            tenant_name: companyName,
            companyCode,
            company_code: companyCode,
            roles,
            savedAt: new Date().toISOString()
        };
    }

    function getRequestTenantContext() {
        const currentUrlContext = getCurrentUrlTenantContext();
        const storedContext = getLoginTenantContext();
        const activeTenantId = normalizeTenantId(
            (tenantContext && tenantContext.tenantId)
            || (storedContext && storedContext.tenant_id)
            || currentUrlContext.tenantId
        );
        const activeTenantPath = normalizePath(
            (tenantContext && tenantContext.tenantPath)
            || (storedContext && storedContext.tenant_path)
            || currentUrlContext.tenantPath
        );

        return {
            tenantId: activeTenantId,
            tenantPath: activeTenantPath,
            fullUrl: getCurrentFullUrl()
        };
    }

    function buildRequestHeaders(existingHeaders) {
        const headers = new Headers(existingHeaders || {});
        const requestTenantContext = getRequestTenantContext();
        headers.delete('authorization');
        headers.set('X-Tenant-Id', requestTenantContext.tenantId);
        headers.set('X-Tenant-Path', requestTenantContext.tenantPath);
        headers.set('X-Tenant-Full-Url', requestTenantContext.fullUrl);

        return headers;
    }

    function headersToPlainObject(headers) {
        const plainObject = {};
        const normalizedHeaders = headers instanceof Headers ? headers : new Headers(headers || {});
        normalizedHeaders.forEach((value, key) => {
            plainObject[key] = value;
        });
        return plainObject;
    }

    function responseFromAxios(axiosResponse) {
        const responseHeaders = new Headers();
        Object.entries(axiosResponse.headers || {}).forEach(([key, value]) => {
            if (typeof value !== 'undefined' && value !== null) {
                responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value));
            }
        });

        let responseBody = axiosResponse.data;
        if (responseBody == null) {
            responseBody = '';
        } else if (typeof responseBody === 'object' && !(responseBody instanceof Blob) && !(responseBody instanceof ArrayBuffer) && !(responseBody instanceof FormData)) {
            responseBody = JSON.stringify(responseBody);
            if (!responseHeaders.has('content-type')) {
                responseHeaders.set('content-type', 'application/json; charset=utf-8');
            }
        } else if (typeof responseBody !== 'string') {
            responseBody = String(responseBody);
        }

        return new Response(responseBody, {
            status: axiosResponse.status,
            statusText: axiosResponse.statusText || '',
            headers: responseHeaders
        });
    }

    function readJsonStorage(key) {
        try {
            const rawValue = localStorage.getItem(key);
            return rawValue ? JSON.parse(rawValue) : null;
        } catch (_) {
            return null;
        }
    }

    function getLoginTenantContext() {
        return normalizeTenantContext(readJsonStorage(LOGIN_STORAGE_KEY))
            || normalizeTenantContext(readJsonStorage(STORAGE_KEY));
    }

    function persistLoginTenant(rawContext) {
        const normalized = normalizeTenantContext(rawContext);
        if (!normalized) {
            return null;
        }
        localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function clearTenantAuthState() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LOGIN_STORAGE_KEY);
    }

    function getStoredUserTenantId() {
        try {
            const rawValue = localStorage.getItem('user_info');
            if (!rawValue) {
                return '';
            }

            const userInfo = JSON.parse(rawValue);
            return normalizeTenantId(userInfo && (userInfo.tenant_id || userInfo.tenantId || userInfo.companyId));
        } catch (_) {
            return '';
        }
    }

    function getCurrentUrlTenantContext() {
        const tenantIdFromParams = getTenantKeyFromSearchParams(window.location.search);
        const tenantId = tenantIdFromParams !== 'demo'
            ? tenantIdFromParams
            : tenantIdFromPath(window.location.pathname);

        const tenantPathParam = (() => {
            try {
                const params = new URLSearchParams(window.location.search || '');
                return normalizePath(params.get('tenant_path') || '');
            } catch (_) {
                return '/';
            }
        })();

        return {
            tenantId,
            tenantPath: tenantPathParam && tenantPathParam !== '/'
                ? tenantPathParam
                : tenantPathFromUrl(window.location.href)
        };
    }

    function shouldClearStoredTenantState(currentTenantId) {
        const storedTenantIds = [];

        const loginTenantContext = getLoginTenantContext();
        if (loginTenantContext && loginTenantContext.tenant_id) {
            storedTenantIds.push(normalizeTenantId(loginTenantContext.tenant_id));
        }

        const storedTenantContext = normalizeTenantContext(readJsonStorage(STORAGE_KEY));
        if (storedTenantContext && storedTenantContext.tenant_id) {
            storedTenantIds.push(normalizeTenantId(storedTenantContext.tenant_id));
        }

        const storedUserTenantId = getStoredUserTenantId();
        if (storedUserTenantId) {
            storedTenantIds.push(normalizeTenantId(storedUserTenantId));
        }

        if (storedTenantIds.length === 0) {
            return false;
        }

        return storedTenantIds.some(storedTenantId => storedTenantId !== currentTenantId);
    }

    function buildPathForTenant(targetPath, rawTenantPath) {
        const raw = String(targetPath || '/');
        const normalized = raw.startsWith('/') ? raw : `/${raw}`;
        const tenantPath = normalizePath(rawTenantPath || '/');
        if (!tenantPath || tenantPath === '/') return normalized;
        return `${tenantPath}${normalized}`.replace(/\/\/+/g, '/');
    }

    function getBasePath() {
        if (!tenantContext || !tenantContext.tenantPath || tenantContext.tenantPath === '/') {
            return '';
        }
        return tenantContext.tenantPath;
    }

    function buildPath(targetPath) {
        const base = getBasePath();
        return buildPathForTenant(targetPath, base || '/');
    }

    function toAbsoluteUrl(targetPath) {
        return `${window.location.origin}${buildPath(targetPath)}`;
    }

    function resolveTenant(fullUrl) {
        const tenantId = tenantIdFromPath(fullUrl);
        const tenantPath = tenantPathFromUrl(fullUrl);
        return {
            tenantId,
            tenantPath,
            isDemo: tenantId === 'demo' || tenantId === 'demo_env'
        };
    }

    function toTenantLabel(ctx) {
        if (!ctx) {
            return 'デモ環境';
        }

        const companyName = (ctx.companyName || '').trim();
        if (companyName) {
            return ctx.isDemo ? companyName : `${companyName} 様環境`;
        }

        if (ctx.isDemo) {
            return 'デモ環境';
        }

        return 'テナント専用環境';
    }

    async function fetchTenantRoutes() {
        try {
            const currentUrlContext = getCurrentUrlTenantContext();
            const currentTenantId = currentUrlContext.tenantId;
            const currentTenantPath = currentUrlContext.tenantPath;
            const cacheBuster = Date.now();
            const response = await nativeFetch(`/api/tenant-context?tenant_id=${encodeURIComponent(currentTenantId)}&tenant_path=${encodeURIComponent(currentTenantPath)}&full_url=${encodeURIComponent(window.location.href)}&_ts=${cacheBuster}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, max-age=0',
                    Pragma: 'no-cache',
                    Expires: '0'
                }
            });
            if (!response.ok) {
                return null;
            }
            const payload = await response.json();
            if (payload && payload.route) {
                return payload.route;
            }
            if (Array.isArray(payload.routes) && payload.routes.length > 0) {
                return payload.routes[0];
            }
            return null;
        } catch (error) {
            console.warn('[TenantContext] failed to fetch tenant routes:', error);
            return null;
        }
    }

    async function initializeTenantContext() {
        if (tenantContext) {
            return tenantContext;
        }

        const fullUrl = getCurrentFullUrl();
        const resolved = resolveTenant(fullUrl);
        const currentUrlTenant = getCurrentUrlTenantContext();

        if (shouldClearStoredTenantState(currentUrlTenant.tenantId)) {
            clearTenantAuthState();
        }

        const routeRow = await fetchTenantRoutes();
        const routeTenantId = routeRow ? String(routeRow.company_id || '').trim().toLowerCase() : '';
        const companyId = routeRow ? (routeRow.company_id || resolved.tenantId) : resolved.tenantId;
        const companyName = routeRow ? (routeRow.company_name || '') : '';
        const matchedTenantPath = routeRow ? (routeRow.tenant_path || '') : '';
        const dbName = routeRow ? (routeRow.db_name || '') : '';
        const storageBucketName = routeRow ? (routeRow.storage_bucket_name || '') : '';
        const resolvedTenantPath = currentUrlTenant.tenantId === 'demo'
            ? (currentUrlTenant.tenantPath === '/demo'
                ? '/demo'
                : (matchedTenantPath ? normalizePath(matchedTenantPath) : resolved.tenantPath))
            : currentUrlTenant.tenantPath;
        const effectiveTenantId = currentUrlTenant.tenantId === 'demo'
            ? (routeTenantId || resolved.tenantId)
            : currentUrlTenant.tenantId;
        const isDemoTenant = effectiveTenantId === 'demo' || effectiveTenantId === 'demo_env';

        tenantContext = {
            fullUrl,
            tenantId: effectiveTenantId,
            companyId,
            companyName,
            dbName,
            storageBucketName,
            tenantPath: resolvedTenantPath,
            matchedTenantPath,
            isDemo: isDemoTenant,
            routes: routeRow ? [routeRow] : [],
            resolvedAt: new Date().toISOString()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(tenantContext));
        window.__TENANT_CONTEXT__ = tenantContext;

        return tenantContext;
    }

    async function ensureInitialized() {
        if (!initPromise) {
            initPromise = initializeTenantContext();
        }
        return initPromise;
    }

    function getApiPath(urlLike) {
        try {
            const parsed = new URL(urlLike, window.location.origin);
            if (parsed.origin !== window.location.origin) {
                return '';
            }
            if (parsed.pathname === '/api') {
                return '/api';
            }
            const apiPathIndex = parsed.pathname.indexOf('/api/');
            return apiPathIndex >= 0 ? parsed.pathname.slice(apiPathIndex) : '';
        } catch (_) {
            return '';
        }
    }

    function isApiRequest(urlLike) {
        return Boolean(getApiPath(urlLike));
    }

    function isTenantBootstrapApi(urlLike) {
        const apiPath = getApiPath(urlLike);
        return apiPath === '/api/tenant-routing' || apiPath === '/api/tenant-context';
    }

    function isRefreshExcludedApi(urlLike) {
        const apiPath = getApiPath(urlLike);
        if (!apiPath) {
            return true;
        }

        return ['/api/login', '/api/logout', '/api/refresh-token', '/api/verify-token'].includes(apiPath);
    }

    function shouldAttemptAutoRefresh() {
        return false;
    }

    function scheduleSessionRefresh() {
        if (!shouldAttemptAutoRefresh()) {
            return;
        }

        if (refreshInFlightPromise) {
            return;
        }

        refreshInFlightPromise = (async () => {
            try {
                return;
            } catch (_) {
                // ユーザー操作の本体リクエストを妨げないため、リフレッシュ失敗は握りつぶす
            } finally {
                refreshInFlightPromise = null;
            }
        })();
    }

    if (axiosClient) {
        axiosClient.interceptors.request.use((config) => {
            const requestUrl = new URL(config.url || '', window.location.href);
            if (requestUrl.origin !== window.location.origin || !isApiRequest(requestUrl.toString()) || isTenantBootstrapApi(requestUrl.toString())) {
                return config;
            }

            config.headers = headersToPlainObject(buildRequestHeaders(config.headers));
            return config;
        });
    }

    window.fetch = async function (input, init) {
        const requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        if (!isApiRequest(requestUrl) || isTenantBootstrapApi(requestUrl)) {
            return nativeFetch(input, init);
        }

        if (!isRefreshExcludedApi(requestUrl)) {
            scheduleSessionRefresh();
        }

        const requestInit = init ? { ...init } : {};
        const headers = buildRequestHeaders(requestInit.headers || (input instanceof Request ? input.headers : {}));

        requestInit.headers = headers;
        if (!requestInit.credentials) {
            requestInit.credentials = 'same-origin';
        }

        if (!axiosClient) {
            return nativeFetch(input, requestInit);
        }

        const axiosRequestConfig = {
            url: requestUrl,
            method: String(requestInit.method || (input instanceof Request ? input.method : 'GET')).toLowerCase(),
            headers: headersToPlainObject(headers),
            data: requestInit.body,
            validateStatus: () => true
        };

        try {
            const axiosResponse = await axiosClient.request(axiosRequestConfig);
            return responseFromAxios(axiosResponse);
        } catch (error) {
            if (error && error.response) {
                return responseFromAxios(error.response);
            }
            throw error;
        }
    };

    window.TenantContext = {
        init: ensureInitialized,
        getContext: () => tenantContext,
        getTenantId: () => {
            if (tenantContext) {
                return tenantContext.tenantId;
            }
            // フォールバック: 現在のURLパスから動的に取得
            return getCurrentUrlTenantContext().tenantId;
        },
        getTenantPath: () => {
            if (tenantContext) {
                return tenantContext.tenantPath;
            }
            // フォールバック: 現在のURLパスから動的に取得
            return getCurrentUrlTenantContext().tenantPath;
        },
        getCompanyName: () => (tenantContext ? (tenantContext.companyName || tenantContext.tenantName || '') : ''),
        getTenantName: () => (tenantContext ? (tenantContext.tenantName || tenantContext.companyName || '') : ''),
        getDbName: () => (tenantContext ? (tenantContext.dbName || '') : ''),
        getStorageBucketName: () => (tenantContext ? (tenantContext.storageBucketName || '') : ''),
        getTenantLabel: () => toTenantLabel(tenantContext),
        getCurrentFullUrl,
        buildPath,
        buildPathForTenant,
        persistLoginTenant,
        getLoginTenantContext,
        toAbsoluteUrl
    };

    ensureInitialized();
})();
