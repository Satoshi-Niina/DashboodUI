(function () {
    'use strict';

    const STORAGE_KEY = 'tenant_context';
    const nativeFetch = window.fetch.bind(window);
    let initPromise = null;
    let tenantContext = null;

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

    function tenantIdFromPath(pathname) {
        const normalizedPath = normalizePath(pathname);
        if (normalizedPath === '/kosei' || normalizedPath.startsWith('/kosei/')) {
            return 'kosei';
        }
        if (normalizedPath === '/daitetsu' || normalizedPath.startsWith('/daitetsu/')) {
            return 'daitetsu';
        }
        return 'demo_env';
    }

    function tenantPathFromUrl(fullUrl) {
        const tenantId = tenantIdFromPath(fullUrl);
        if (tenantId === 'kosei') return '/kosei';
        if (tenantId === 'daitetsu') return '/daitetsu';
        return '/';
    }

    function getBasePath() {
        if (!tenantContext || !tenantContext.tenantPath || tenantContext.tenantPath === '/') {
            return '';
        }
        return tenantContext.tenantPath;
    }

    function buildPath(targetPath) {
        const raw = String(targetPath || '/');
        const normalized = raw.startsWith('/') ? raw : `/${raw}`;
        const base = getBasePath();
        if (!base) return normalized;
        return `${base}${normalized}`.replace(/\/\/+/, '/');
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
            isDemo: tenantId === 'demo_env'
        };
    }

    function toTenantLabel(ctx) {
        if (!ctx) {
            return 'デモ環境';
        }

        const companyName = (ctx.companyName || '').trim();
        if (ctx.isDemo) {
            return 'デモ環境';
        }

        if (!companyName) {
            const fallbackTenantId = (ctx.tenantId || '').trim();
            return fallbackTenantId ? `${fallbackTenantId} 専用環境` : 'テナント環境';
        }

        return `${companyName} 様環境`;
    }

    async function fetchTenantRoutes() {
        try {
            const currentTenantId = tenantIdFromPath(window.location.pathname);
            const response = await nativeFetch(`/api/tenant-routing?tenant_id=${encodeURIComponent(currentTenantId)}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
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
        const routeRow = await fetchTenantRoutes();
        const companyId = routeRow ? (routeRow.company_id || resolved.tenantId) : resolved.tenantId;
        const companyName = routeRow ? (routeRow.company_name || '') : '';
        const matchedTenantPath = routeRow ? (routeRow.tenant_path || '') : '';

        tenantContext = {
            fullUrl,
            tenantId: resolved.tenantId,
            companyId,
            companyName,
            tenantPath: resolved.tenantPath,
            matchedTenantPath,
            isDemo: resolved.isDemo,
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

    function isTenantRoutingApi(urlLike) {
        try {
            const parsed = new URL(urlLike, window.location.origin);
            return parsed.origin === window.location.origin && parsed.pathname === '/api/tenant-routing';
        } catch (_) {
            return false;
        }
    }

    window.fetch = async function (input, init) {
        const requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        if (!isApiRequest(requestUrl) || isTenantRoutingApi(requestUrl)) {
            return nativeFetch(input, init);
        }

        const ctx = await ensureInitialized();
        const requestInit = init ? { ...init } : {};
        const headers = new Headers(requestInit.headers || (input instanceof Request ? input.headers : {}));

        headers.set('X-Tenant-Id', ctx.tenantId);
        headers.set('X-Tenant-Path', ctx.tenantPath);
        headers.set('X-Tenant-Full-Url', ctx.fullUrl);

        requestInit.headers = headers;
        return nativeFetch(input, requestInit);
    };

    window.TenantContext = {
        init: ensureInitialized,
        getContext: () => tenantContext,
        getTenantId: () => (tenantContext ? tenantContext.tenantId : 'demo_env'),
        getTenantPath: () => (tenantContext ? tenantContext.tenantPath : '/'),
        getCompanyName: () => (tenantContext ? (tenantContext.companyName || '') : ''),
        getTenantLabel: () => toTenantLabel(tenantContext),
        getCurrentFullUrl,
        buildPath,
        toAbsoluteUrl
    };

    ensureInitialized();
})();
