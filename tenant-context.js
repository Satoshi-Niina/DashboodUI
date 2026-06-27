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
        if (normalizedPath === '/') return 'demo';
        const parts = normalizedPath.split('/').filter(Boolean);
        return parts[0] || 'demo';
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

    function isExactOrPrefixMatch(current, candidate) {
        if (!current || !candidate) return false;
        return current === candidate || current.startsWith(`${candidate}/`);
    }

    function resolveTenant(fullUrl, routes) {
        const currentUrl = normalizeUrl(fullUrl);
        const currentPath = normalizePath(fullUrl);

        let bestMatch = null;
        for (const route of routes) {
            const routeUrl = normalizeUrl(route.tenant_path);
            const routePath = normalizePath(route.tenant_path);

            const urlMatched = isExactOrPrefixMatch(currentUrl, routeUrl);
            const pathMatched = isExactOrPrefixMatch(currentPath, routePath);

            if (!urlMatched && !pathMatched) {
                continue;
            }

            const matchScore = Math.max(routeUrl.length, routePath.length);
            if (!bestMatch || matchScore > bestMatch.matchScore) {
                bestMatch = {
                    route,
                    tenantPath: routePath,
                    tenantId: route.tenant_id || tenantIdFromPath(routePath),
                    companyName: route.company_name || '',
                    companyId: route.company_id || '',
                    matchScore
                };
            }
        }

        if (bestMatch) {
            return {
                tenantId: bestMatch.tenantId,
                companyId: bestMatch.companyId,
                companyName: bestMatch.companyName,
                tenantPath: bestMatch.tenantPath,
                matchedTenantPath: bestMatch.route.tenant_path,
                isDemo: bestMatch.tenantPath === '/'
            };
        }

        return {
            tenantId: 'demo',
            companyId: 'demo',
            companyName: 'デモ環境',
            tenantPath: '/',
            matchedTenantPath: '',
            isDemo: true
        };
    }

    function toTenantLabel(ctx) {
        if (!ctx) {
            return 'デモ環境';
        }

        const companyName = (ctx.companyName || '').trim();
        if (ctx.isDemo || !companyName) {
            return 'デモ環境';
        }

        return `${companyName} 様環境`;
    }

    async function fetchTenantRoutes() {
        try {
            const response = await nativeFetch('/api/tenant-routing', {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            if (!response.ok) {
                return [];
            }
            const payload = await response.json();
            return Array.isArray(payload.routes) ? payload.routes : [];
        } catch (error) {
            console.warn('[TenantContext] failed to fetch tenant routes:', error);
            return [];
        }
    }

    async function initializeTenantContext() {
        if (tenantContext) {
            return tenantContext;
        }

        const fullUrl = getCurrentFullUrl();
        const routes = await fetchTenantRoutes();
        const resolved = resolveTenant(fullUrl, routes);

        tenantContext = {
            fullUrl,
            tenantId: resolved.tenantId,
            companyId: resolved.companyId,
            companyName: resolved.companyName,
            tenantPath: resolved.tenantPath,
            matchedTenantPath: resolved.matchedTenantPath,
            isDemo: resolved.isDemo,
            routes,
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
        getTenantId: () => (tenantContext ? tenantContext.tenantId : 'demo'),
        getTenantPath: () => (tenantContext ? tenantContext.tenantPath : '/'),
        getCompanyName: () => (tenantContext ? (tenantContext.companyName || '') : ''),
        getTenantLabel: () => toTenantLabel(tenantContext),
        getCurrentFullUrl,
        buildPath,
        toAbsoluteUrl
    };

    ensureInitialized();
})();
