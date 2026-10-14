const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const assetPath = path.join(__dirname, '..', 'assets');

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('demo URL context keeps /demo through bootstrap, API headers, and login redirect', async () => {
  const requestCalls = [];
  const localStorage = createStorage();
  const location = {
    href: 'http://localhost:8080/demo/',
    origin: 'http://localhost:8080',
    pathname: '/demo/',
    search: ''
  };
  const window = {
    location,
    fetch: async (url, init = {}) => {
      requestCalls.push({ url: String(url), init });
      if (String(url).startsWith('/api/tenant-context')) {
        return {
          ok: true,
          json: async () => ({
            route: {
              company_id: 'demo',
              company_name: 'Demo',
              tenant_path: '/demo',
              db_name: 'demo_db'
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
  };
  const context = {
    window,
    localStorage,
    URL,
    URLSearchParams,
    Headers,
    Request,
    console,
    Date,
    setTimeout,
    clearTimeout,
    Promise,
    encodeURIComponent,
    decodeURIComponent
  };
  vm.runInNewContext(fs.readFileSync(path.join(assetPath, 'tenant-context.js'), 'utf8'), context);

  await window.TenantContext.init();
  assert.equal(window.TenantContext.getTenantId(), 'demo');
  assert.equal(window.TenantContext.getTenantPath(), '/demo');
  assert.equal(window.TenantContext.buildPath('/index.html'), '/demo/index.html');

  await window.fetch('/api/apps');
  const bootstrapUrl = new URL(requestCalls[0].url, location.origin);
  assert.equal(bootstrapUrl.searchParams.get('tenant_id'), 'demo');
  assert.equal(bootstrapUrl.searchParams.get('tenant_path'), '/demo');
  const apiHeaders = new Headers(requestCalls[1].init.headers);
  assert.equal(apiHeaders.get('x-tenant-id'), 'demo');
  assert.equal(apiHeaders.get('x-tenant-path'), '/demo');
  assert.equal(apiHeaders.get('x-tenant-full-url'), location.href);

  let submitHandler;
  const textClassList = { add() {}, remove() {} };
  const loaderClassList = { add() {}, remove() {} };
  const buttonText = { textContent: '', classList: textClassList };
  const buttonLoader = { classList: loaderClassList };
  const usernameInput = { value: '', setAttribute() {} };
  const passwordInput = { value: '', setAttribute() {} };
  const loginButton = {
    disabled: false,
    querySelector(selector) {
      return selector === '.btn-text' ? buttonText : buttonLoader;
    }
  };
  const errorMessage = { textContent: '', classList: { add() {}, remove() {} } };
  const loginForm = {
    addEventListener(eventName, handler) {
      if (eventName === 'submit') submitHandler = handler;
    },
    reset() {}
  };
  const elements = {
    'login-form': loginForm,
    username: usernameInput,
    password: passwordInput,
    'login-btn': loginButton,
    'error-message': errorMessage
  };
  const document = {
    addEventListener(eventName, handler) {
      if (eventName === 'DOMContentLoaded') handler();
    },
    getElementById(id) {
      return elements[id];
    }
  };
  const sessionStorage = createStorage();
  const loginContext = {
    window,
    document,
    sessionStorage,
    URL,
    URLSearchParams,
    console,
    setTimeout(callback) {
      callback();
      return 0;
    },
    fetch: window.fetch
  };
  vm.runInNewContext(fs.readFileSync(path.join(assetPath, 'login.js'), 'utf8'), loginContext);
  usernameInput.value = 'demo-user';
  passwordInput.value = 'demo-password';
  await submitHandler({ preventDefault() {} });

  const loginRequest = requestCalls.find(call => call.url.startsWith('/demo/api/login'));
  assert.ok(loginRequest, 'Demo login request must retain the dedicated URL prefix.');
  assert.equal(loginRequest.url, '/demo/api/login?tenant_id=demo');
  const loginBody = JSON.parse(loginRequest.init.body);
  assert.equal(loginBody.tenant_id, 'demo');
  assert.equal(loginBody.tenant_path, '/demo');
  const loginHeaders = new Headers(loginRequest.init.headers);
  assert.equal(loginHeaders.get('x-tenant-key'), 'demo');
  assert.equal(loginHeaders.get('x-tenant-id'), 'demo');
  assert.equal(loginHeaders.get('x-tenant-path'), '/demo');
  assert.equal(location.href, '/demo/index.html');
});
