const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'I713ZkufHbpsKO81UnrwwrEhd5lyalvA5T36vuUcilNzuWhhCerkXr4EkzBSKNRU0';
const INTERNAL_SECRET = process.env.INTERNAL_GATEWAY_SECRET || '7a332fc80f2f5651b414a9d4abf20bfc9d4dd96e1ceb7a5e8ccbb1fc6892baf0';

const PORT = process.env.TEST_PORT || 3000;

function generateTestToken(username, role, tenantId, userId = 'e996e889-4165-412f-8450-8b6e0f193256') {
  return jwt.sign({
    sub: userId,
    username,
    role,
    tenant_id: tenantId,
    tenant_key: tenantId,
    auth_source: 'tenant'
  }, JWT_SECRET, {
    issuer: 'dashboard-auth',
    audience: 'dashboard-apps',
    expiresIn: '1h'
  });
}

function createInternalAuthToken(deviceContext) {
  const payload = JSON.stringify({
    ...deviceContext,
    issuedAt: Date.now()
  });
  const hmac = crypto.createHmac('sha256', INTERNAL_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64');
}

const daitetsuDeviceContext = {
  hasCert: true,
  authorized: true,
  fingerprint256: '017bdb02011d8933801e14b14b3a216efe34cb9da8450d6b79448e196a67574e',
  serialNumber: '54c259fd646e03eeaf208341cf7de1a70ed1bbdd',
  subject: 'CN=iPad-Daitetsu-001, O=Daitetsu Kogyo, OU=Operations',
  validTo: '2027-10-15T00:00:00.000Z'
};

const koseiDeviceContext = {
  hasCert: true,
  authorized: true,
  fingerprint256: '78c5fe4a408b59c6c48fe430b3a247c474ff7b2d5cd5dcba2f0f616042b1cc79',
  serialNumber: '54c259fd646e03eeaf208341cf7de1a70ed1bbe1',
  subject: 'CN=iPad-Kosei-001, O=Kosei Kensetsu, OU=Operations',
  validTo: '2027-10-15T00:00:00.000Z'
};

test('Multitenant Admin API - niina can switch tenants to manage users and masters', async (t) => {
  const niinaToken = generateTestToken('niina', 'system_admin', 'daitetsu');
  const internalAuth = createInternalAuthToken(daitetsuDeviceContext);

  // 1. niinaが初期状態（大鉄）のユーザー一覧取得
  const daitetsuRes = await fetch(`http://localhost:${PORT}/api/users`, {
    headers: {
      'Authorization': `Bearer ${niinaToken}`,
      'X-Internal-Device-Auth': internalAuth
    }
  });
  const daitetsuData = await daitetsuRes.json();
  assert.equal(daitetsuRes.status, 200);
  assert.equal(daitetsuData.success, true);
  assert.equal(daitetsuData.canSwitchTenant, true);
  assert.ok(Array.isArray(daitetsuData.availableTenants));
  assert.ok(daitetsuData.availableTenants.some(t => t.tenant_key === 'daitetsu'));
  assert.ok(daitetsuData.availableTenants.some(t => t.tenant_key === 'kosei'));
  assert.ok(daitetsuData.availableTenants.some(t => t.tenant_key === 'kintetsu'));

  // 2. niinaが広成建設（kosei）に切り替えてユーザー一覧取得
  const koseiRes = await fetch(`http://localhost:${PORT}/api/users`, {
    headers: {
      'Authorization': `Bearer ${niinaToken}`,
      'X-Internal-Device-Auth': internalAuth,
      'X-Tenant-Id': 'kosei'
    }
  });
  const koseiData = await koseiRes.json();
  assert.equal(koseiRes.status, 200);
  assert.equal(koseiData.success, true);
  assert.equal(koseiData.currentTenantId, 'kosei');

  // 3. niinaが広成建設の事業所マスタ取得
  const koseiOfficesRes = await fetch(`http://localhost:${PORT}/api/offices`, {
    headers: {
      'Authorization': `Bearer ${niinaToken}`,
      'X-Internal-Device-Auth': internalAuth,
      'X-Tenant-Id': 'kosei'
    }
  });
  assert.equal(koseiOfficesRes.status, 200);
  const koseiOfficesData = await koseiOfficesRes.json();
  assert.equal(koseiOfficesData.success, true);
});

test('Multitenant Admin API - non-niina tenant admin is strictly locked to own tenant', async (t) => {
  // 広成建設の一般管理者 (niinaではない)
  const regularAdminToken = generateTestToken('Kosei1', 'system_admin', 'kosei', 'fe520e93-4dd9-4651-81d0-f1c10466ed8e');
  const koseiAuth = createInternalAuthToken(koseiDeviceContext);
  const daitetsuAuth = createInternalAuthToken(daitetsuDeviceContext);

  // 1. 他社（大鉄）の端末からアクセスしようとすると、DEVICE_MISMATCH で遮断されること
  const mismatchRes = await fetch(`http://localhost:${PORT}/api/users`, {
    headers: {
      'Authorization': `Bearer ${regularAdminToken}`,
      'X-Internal-Device-Auth': daitetsuAuth
    }
  });
  assert.equal(mismatchRes.status, 403);
  const mismatchData = await mismatchRes.json();
  assert.equal(mismatchData.code, 'DEVICE_MISMATCH');

  // 2. 自社（広成建設）の端末からアクセスすると正常にユーザー一覧が取得できること
  const res = await fetch(`http://localhost:${PORT}/api/users`, {
    headers: {
      'Authorization': `Bearer ${regularAdminToken}`,
      'X-Internal-Device-Auth': koseiAuth
    }
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  // canSwitchTenant は false でなければならない（他テナント切替不可）
  assert.equal(data.canSwitchTenant, false);
  assert.equal(data.currentTenantId, 'kosei');

  // 3. 一般管理者が他テナント（daitetsu）をリクエストヘッダーで指定しても、自テナント（kosei）に固定されること
  const tamperRes = await fetch(`http://localhost:${PORT}/api/users?tenantId=daitetsu`, {
    headers: {
      'Authorization': `Bearer ${regularAdminToken}`,
      'X-Internal-Device-Auth': koseiAuth,
      'X-Tenant-Id': 'daitetsu'
    }
  });
  const tamperData = await tamperRes.json();
  assert.equal(tamperRes.status, 200);
  // 他テナントへの切替は無視され、自テナントkoseiに固定される
  assert.equal(tamperData.currentTenantId, 'kosei');

  // 4. 一般管理者がシステム共通設定を変更しようとすると 403 Forbidden になること（システム自体は変更不可）
  const settingRes = await fetch(`http://localhost:${PORT}/api/system-settings/bulk`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${regularAdminToken}`,
      'X-Internal-Device-Auth': koseiAuth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settings: [
        { setting_key: 'test_key', setting_value: 'test_val' }
      ]
    })
  });
  assert.equal(settingRes.status, 403);

  // 5. 一般管理者が system_admin 権限のユーザーを作成しようとすると 403 Forbidden になること
  const createUserRes = await fetch(`http://localhost:${PORT}/api/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${regularAdminToken}`,
      'X-Internal-Device-Auth': koseiAuth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: 'illegal_super',
      password: 'Password123!',
      display_name: '不正スーパー管理者',
      role: 'system_admin'
    })
  });
  assert.equal(createUserRes.status, 403);
});
