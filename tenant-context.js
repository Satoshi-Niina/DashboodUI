(function () {
    'use strict';

    const STORAGE_KEY = 'tenant_context';
    const LOGIN_STORAGE_KEY = 'login_tenant_context';
    const nativeFetch = window.fetch.bind(window);
    let initPromise = null;
    let tenantContext = null;
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

    function tenantIdFromPath(pathname) {
        return getTenantKeyFromPath(pathname);
    }

    function tenantPathFromUrl(fullUrl) {
        const tenantId = tenantIdFromPath(fullUrl);
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

        return {
            tenantId,
            tenant_id: tenantId,
            tenantPath,
            tenant_path: tenantPath,
            role: rawContext.role || '',
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
        const token = localStorage.getItem('user_token');

        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        headers.set('X-Tenant-ID', requestTenantContext.tenantId);
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
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_info');
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
        const tenantId = tenantIdFromPath(window.location.pathname);
        return {
            tenantId,
            tenantPath: tenantId === 'demo' ? '/' : `/${tenantId}`
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
            const currentTenantId = tenantIdFromPath(window.location.pathname);
            const currentTenantPath = tenantPathFromUrl(window.location.href);
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
            ? (matchedTenantPath ? normalizePath(matchedTenantPath) : resolved.tenantPath)
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

    function isApiRequest(urlLike) {
        try {
            const parsed = new URL(urlLike, window.location.origin);
            return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api');
        } catch (_) {
            return false;
        }
    }

    function isTenantBootstrapApi(urlLike) {
        try {
            const parsed = new URL(urlLike, window.location.origin);
            if (parsed.origin !== window.location.origin) {
                return false;
            }
            return parsed.pathname === '/api/tenant-routing' || parsed.pathname === '/api/tenant-context';
        } catch (_) {
            return false;
        }
    }

    if (axiosClient) {
        axiosClient.interceptors.request.use((config) => {
            const requestUrl = new URL(config.url || '', window.location.href);
            if (requestUrl.origin !== window.location.origin || !requestUrl.pathname.startsWith('/api') || isTenantBootstrapApi(requestUrl.toString())) {
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

        const requestInit = init ? { ...init } : {};
        const headers = buildRequestHeaders(requestInit.headers || (input instanceof Request ? input.headers : {}));

        requestInit.headers = headers;

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
            const tenantId = getCurrentUrlTenantContext().tenantId;
            return tenantId === 'demo' ? '/' : `/${tenantId}`;
        },
        getCompanyName: () => (tenantContext ? (tenantContext.companyName || '') : ''),
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
