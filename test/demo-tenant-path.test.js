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

test('login form submits credentials only without client-side tenant specification and redirects to /index.html', async () => {
  const requestCalls = [];
  const localStorage = createStorage();
  const location = {
    href: 'http://localhost:8080/login.html',
    origin: 'http://localhost:8080',
    pathname: '/login.html',
    search: ''
  };
  const window = {
    location,
    fetch: async (url, init = {}) => {
      requestCalls.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: 'mock-token',
          user: {
            id: 'mock-user-1',
            username: 'demo-user',
            tenant_key: 'demo'
          }
        })
      };
    }
  };

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
    localStorage,
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

  const loginRequest = requestCalls.find(call => call.url === '/api/login');
  assert.ok(loginRequest, 'Login request must target /api/login');
  const loginBody = JSON.parse(loginRequest.init.body);
  assert.equal(loginBody.username, 'demo-user');
  assert.equal(loginBody.password, 'demo-password');
  assert.equal(loginBody.tenant_id, undefined, 'tenant_id must not be sent in body');
  assert.equal(location.href, '/index.html');
});

test('integrated login (mode C) does not include tenant in URL and redirects to /index.html', async () => {
  const assetPath = path.resolve(__dirname, '..', 'assets');
  const requestCalls = [];
  const location = {
    pathname: '/login.html',
    origin: 'http://localhost:3000',
    search: '',
    href: 'http://localhost:3000/login.html'
  };
  const window = {
    location,
    fetch: async (url, init = {}) => {
      requestCalls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          success: true,
          token: 'mock-jwt-token',
          user: {
            id: 'mock-user-id',
            username: 'niina',
            role: 'admin',
            tenant_id: 'daitetsu',
            tenant_key: 'daitetsu',
            company_name: '大鉄工業'
          }
        })
      };
    }
  };
  let submitHandler = null;
  const loginForm = {
    addEventListener(eventName, handler) {
      if (eventName === 'submit') submitHandler = handler;
    },
    reset() {}
  };
  const usernameInput = { value: '', setAttribute() {} };
  const passwordInput = { value: '', setAttribute() {} };
  const loginButton = {
    querySelector(selector) {
      return { textContent: '', classList: { add() {}, remove() {} } };
    },
    disabled: false
  };
  const errorMessage = { textContent: '', classList: { add() {}, remove() {} } };
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
  const storage = {};
  const sessionStorage = {
    getItem(key) { return storage[key] || null; },
    setItem(key, value) { storage[key] = String(value); },
    removeItem(key) { delete storage[key]; }
  };
  const localStorage = { ...sessionStorage };
  const loginContext = {
    window,
    document,
    sessionStorage,
    localStorage,
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
  usernameInput.value = 'niina';
  passwordInput.value = 'password';
  await submitHandler({ preventDefault() {} });

  const loginRequest = requestCalls.find(call => call.url === '/api/login');
  assert.ok(loginRequest, 'Integrated login request must not contain tenant prefix in URL');
  const loginBody = JSON.parse(loginRequest.init.body);
  assert.equal(loginBody.tenantKey, undefined, 'Tenant key should not be sent for integrated login');
  assert.equal(location.href, '/index.html', 'Integrated login should redirect to /index.html');
});

