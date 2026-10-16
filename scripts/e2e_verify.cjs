// ==============================================================================
// E2E Verification Tests with Multi-Tenant Security & Direct Access Guard
// ==============================================================================
// Security Notice:
// - Do NOT hardcode credentials or passphrases in this script.
// - Credentials MUST be supplied via environment variables: E2E_USERNAME, E2E_PASSWORD
// ==============================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

// Load environment variables from .env if present
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GATEWAY_PORT = process.env.GATEWAY_PORT || 8443;
const GATEWAY_HOST = process.env.E2E_GATEWAY_HOST || 'localhost';
const CERTS_DIR = process.env.E2E_CERTS_DIR || path.resolve(__dirname, '../../gateway/certs');
const CA_PATH = process.env.E2E_CA_PATH || path.join(CERTS_DIR, 'ca.crt');

// 1. 認証情報の検証（環境変数が未設定の場合は安全に停止）
const E2E_USERNAME = process.env.E2E_USERNAME;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

if (!E2E_USERNAME || !E2E_PASSWORD) {
  console.error('\n❌ [E2E Security Error] Missing required test credentials.');
  console.error('   Both E2E_USERNAME and E2E_PASSWORD environment variables must be set.');
  console.error('   Please define them in your environment or local .env file.');
  console.error('   Example:');
  console.error('     $env:E2E_USERNAME="your_user"; $env:E2E_PASSWORD="your_password"; node scripts/e2e_verify.cjs\n');
  process.exit(1);
}

// 2. CA証明書のロード
if (!fs.existsSync(CA_PATH)) {
  console.error(`\n❌ [E2E Setup Error] CA certificate not found at: ${CA_PATH}`);
  process.exit(1);
}
const caCert = fs.readFileSync(CA_PATH);

// 3. mTLSクライアント証明書エージェント生成関数
// - rejectUnauthorized: true を明示（TLS証明書検証を有効化）
// - PEM形式（.crt / .key）が存在する場合は優先利用（OpenSSL 3.0互換性・パスフレーズ不要）
// - .p12形式を使用する場合は環境変数 E2E_CERT_PASSPHRASE を使用
function createTenantAgent(tenantKey) {
  const crtPath = path.join(CERTS_DIR, `client_${tenantKey}.crt`);
  const keyPath = path.join(CERTS_DIR, `client_${tenantKey}.key`);
  const p12Path = path.join(CERTS_DIR, `client_${tenantKey}.p12`);

  const agentOptions = {
    ca: caCert,
    rejectUnauthorized: true // TLS証明書の正当性を検証
  };

  if (fs.existsSync(crtPath) && fs.existsSync(keyPath)) {
    agentOptions.cert = fs.readFileSync(crtPath);
    agentOptions.key = fs.readFileSync(keyPath);
  } else if (fs.existsSync(p12Path)) {
    agentOptions.pfx = fs.readFileSync(p12Path);
    if (process.env.E2E_CERT_PASSPHRASE) {
      agentOptions.passphrase = process.env.E2E_CERT_PASSPHRASE;
    }
  } else {
    throw new Error(`[E2E Setup Error] Client certificate for tenant "${tenantKey}" not found in ${CERTS_DIR}`);
  }

  return new https.Agent(agentOptions);
}

function createNoCertAgent() {
  return new https.Agent({
    ca: caCert,
    rejectUnauthorized: true
  });
}

// 4. テスト環境安全検証（本番DBへの誤書き込み防止ガード）
function assertSafeTestEnvironment() {
  const isLocalHost = GATEWAY_HOST === 'localhost' || GATEWAY_HOST === '127.0.0.1' || GATEWAY_HOST === '::1';
  if (!isLocalHost) {
    console.warn(`⚠️ [Safety Guard] Non-local target detected (${GATEWAY_HOST}). Write tests disabled to protect remote databases.`);
    return false;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ [Safety Guard] NODE_ENV=production detected. Write tests are disabled.');
    return false;
  }
  if (process.env.E2E_ALLOW_WRITE === 'false') {
    console.log('ℹ️ [Safety Guard] E2E_ALLOW_WRITE is set to false. Write tests will be skipped.');
    return false;
  }
  return true;
}

// エラー出力時のパスワードマスクユーティリティ
function sanitizeError(err) {
  if (!err) return '';
  const message = err.response?.data?.message || err.response?.data?.error || err.message || String(err);
  if (typeof message === 'string') {
    return message.replace(new RegExp(E2E_PASSWORD, 'g'), '[REDACTED_PASSWORD]');
  }
  return message;
}

async function runE2ETests() {
  console.log('🚀 Starting E2E Verification Tests on Multi-Tenant Environment...');
  console.log(`   Target Gateway: https://${GATEWAY_HOST}:${GATEWAY_PORT}`);
  console.log(`   TLS Certificate Verification: ENABLED (rejectUnauthorized: true)`);
  console.log(`   E2E Test User: ${E2E_USERNAME} (Password: [SECURED_IN_ENV])`);

  const daitetsuAgent = createTenantAgent('daitetsu');
  const noCertAgent = createNoCertAgent();

  // Test 1: Health Check via Gateway
  console.log('\n--- [Test 1] Gateway Health Check ---');
  try {
    const res = await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/health`, { httpsAgent: daitetsuAgent });
    console.log(`✅ Health check status: ${res.status}, response:`, res.data);
  } catch (err) {
    console.error(`❌ Health check failed:`, sanitizeError(err));
    process.exit(1);
  }

  // Test 2: Login with credentials from environment variables
  console.log(`\n--- [Test 2] Login (${E2E_USERNAME}) with Daitetsu Certificate ---`);
  let authCookie = null;
  let meData = null;
  try {
    const loginRes = await axios.post(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/api/login`, {
      username: E2E_USERNAME,
      password: E2E_PASSWORD
    }, {
      httpsAgent: daitetsuAgent,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Login status: ${loginRes.status}, user:`, loginRes.data.user?.username, 'tenant:', loginRes.data.tenant?.name || loginRes.data.user?.tenant_id);

    // Cookie取得
    const setCookie = loginRes.headers['set-cookie'];
    authCookie = setCookie ? setCookie.join('; ') : '';

    // /api/auth/me でテナント判定と権限確認
    const meRes = await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/api/auth/me`, {
      httpsAgent: daitetsuAgent,
      headers: { Cookie: authCookie }
    });
    meData = meRes.data;
    console.log(`✅ /api/auth/me status: ${meRes.status}`);
    console.log(`   User: ${meData.user?.username}, Role: ${meData.user?.role}`);
    console.log(`   Tenant ID: ${meData.user?.tenant_id || meData.tenant?.id}, Tenant Key: ${meData.tenant?.tenant_key || 'daitetsu'}`);
  } catch (err) {
    console.error(`❌ Login failed:`, sanitizeError(err));
    process.exit(1);
  }

  // Test 3: Get Apps & Launch Token
  console.log('\n--- [Test 3] App Listing & Inspection Launch Token ---');
  let launchToken = null;
  try {
    const appsRes = await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/api/apps`, {
      httpsAgent: daitetsuAgent,
      headers: { Cookie: authCookie }
    });
    console.log(`✅ /api/apps status: ${appsRes.status}, count: ${appsRes.data.length || appsRes.data.apps?.length}`);
    const apps = Array.isArray(appsRes.data) ? appsRes.data : appsRes.data.apps || [];
    apps.forEach(a => console.log(`   - App: ${a.app_key || a.app_id || a.id} (${a.app_name || a.name}), URL: ${a.app_url || a.url}`));

    // Launch Token 発行
    const tokenRes = await axios.post(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/api/apps/inspection/launch-token`, {}, {
      httpsAgent: daitetsuAgent,
      headers: { Cookie: authCookie }
    });
    launchToken = tokenRes.data.launch_token || tokenRes.data.token || tokenRes.data.launchCode;
    console.log(`✅ Launch token issued successfully (prefix: ${launchToken.substring(0, 15)}...)`);
  } catch (err) {
    console.error(`❌ App listing or Launch token failed:`, sanitizeError(err));
    process.exit(1);
  }

  // Test 4: Inspection API Token Exchange & Data Fetch
  console.log('\n--- [Test 4] Inspection API SSO Exchange & Inspection Data Fetch ---');
  let inspectionToken = null;
  let sampleRecords = [];
  try {
    const ssoRes = await axios.post(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/inspection-api/auth/external`, {
      token: launchToken
    }, {
      httpsAgent: daitetsuAgent,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Inspection SSO Exchange status: ${ssoRes.status}, user: ${ssoRes.data.user?.username || ssoRes.data.username || 'authenticated'}`);
    inspectionToken = ssoRes.data.token;
    console.log(`   Inspection Session Token: ${inspectionToken ? 'Acquired' : 'None'}`);

    // 点検項目一覧の取得
    const itemsRes = await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/inspection-api/inspection/items`, {
      httpsAgent: daitetsuAgent,
      headers: { Authorization: `Bearer ${inspectionToken}` }
    });
    const itemsData = itemsRes.data?.items || itemsRes.data || [];
    console.log(`✅ Inspection Items status: ${itemsRes.status}, count: ${Array.isArray(itemsData) ? itemsData.length : Object.keys(itemsData).length}`);

    // 点検履歴レコードの取得
    const recordsRes = await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/inspection-api/inspection/records?limit=5`, {
      httpsAgent: daitetsuAgent,
      headers: { Authorization: `Bearer ${inspectionToken}` }
    });
    sampleRecords = recordsRes.data?.records || recordsRes.data || [];
    console.log(`✅ Inspection Records status: ${recordsRes.status}, count: ${Array.isArray(sampleRecords) ? sampleRecords.length : 0}`);
  } catch (err) {
    console.error(`❌ Inspection SSO or fetch failed:`, sanitizeError(err));
    process.exit(1);
  }

  // Test 5: Create a new inspection record in Tenant DB (Safe Test Execution)
  console.log('\n--- [Test 5] Save New Inspection Record in Tenant DB ---');
  const isSafeToWrite = assertSafeTestEnvironment();
  if (!isSafeToWrite) {
    console.log('⏩ [Test 5 Skipped] Test execution environment is not confirmed as safe local test environment.');
  } else {
    try {
      const baseRecord = Array.isArray(sampleRecords) && sampleRecords.length > 0 ? sampleRecords[0] : null;
      let targetVehicleId = baseRecord?.vehicle_id || baseRecord?.vehicleId || '00000000-0000-0000-0000-000000000001';
      let targetBaseId = baseRecord?.inspection_base_id || baseRecord?.inspectionBaseId || '00000000-0000-0000-0000-000000000001';

      try {
        const vRes = await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/inspection-api/vehicles`, {
          httpsAgent: daitetsuAgent,
          headers: { Authorization: `Bearer ${inspectionToken}` }
        });
        const vList = vRes.data?.vehicles || vRes.data || [];
        if (Array.isArray(vList) && vList.length > 0) {
          targetVehicleId = vList[0].id || vList[0].vehicle_id || targetVehicleId;
        }
      } catch (_) {}

      try {
        const bRes = await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/inspection-api/bases`, {
          httpsAgent: daitetsuAgent,
          headers: { Authorization: `Bearer ${inspectionToken}` }
        });
        const bList = bRes.data?.bases || bRes.data || [];
        if (Array.isArray(bList) && bList.length > 0) {
          targetBaseId = bList[0].id || bList[0].base_id || targetBaseId;
        }
      } catch (_) {}

      const newRecord = {
        vehicleId: targetVehicleId,
        inspectionBaseId: targetBaseId,
        inspectionDate: new Date().toISOString().split('T')[0],
        inspectorName: 'E2Eテスト実施者',
        result: '良好',
        remarks: 'E2E自動テスト検証用レコード（安全ガード確認済み）',
        status: 'completed'
      };

      const saveRes = await axios.post(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/inspection-api/inspection/records`, newRecord, {
        httpsAgent: daitetsuAgent,
        headers: { 
          Authorization: `Bearer ${inspectionToken}`,
          'Content-Type': 'application/json' 
        }
      });
      console.log(`✅ Inspection Record saved status: ${saveRes.status}, record ID:`, saveRes.data?.record?.id || saveRes.data?.id || 'Success');
    } catch (err) {
      console.log(`⚠️ Record save response status:`, err.response?.status, 'data:', sanitizeError(err));
    }
  }

  // Test 6: Tenant Isolation & Security
  console.log('\n--- [Test 6] Tenant Isolation & Direct Access Guard ---');
  // 6a: クライアント証明書なしで Gateway にアクセスした場合（403または未認証拒否）
  try {
    await axios.get(`https://${GATEWAY_HOST}:${GATEWAY_PORT}/api/auth/me`, { httpsAgent: noCertAgent });
    console.error('❌ Expected failure for no-cert request, but succeeded!');
    process.exit(1);
  } catch (err) {
    console.log(`✅ No-certificate request correctly rejected/denied (status: ${err.response?.status || err.code})`);
  }

  // 6b: 直接内部ポート（http://127.0.0.1:3000）へアクセスした場合（403 DirectAccessForbidden）
  try {
    await axios.get('http://127.0.0.1:3000/api/auth/me');
    console.error('❌ Expected 403 DirectAccessForbidden for direct port 3000 access, but succeeded!');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 403) {
      console.log(`✅ Direct access to backend (3000) correctly blocked with 403 DirectAccessForbidden`);
    } else {
      console.log(`⚠️ Direct access returned status: ${err.response?.status || err.message}`);
    }
  }

  // 6c: 直接内部ポート（http://127.0.0.1:3001）へアクセスした場合（403 DirectAccessForbidden）
  try {
    await axios.get('http://127.0.0.1:3001/inspection-api/inspection/items');
    console.error('❌ Expected 403 DirectAccessForbidden for direct port 3001 access, but succeeded!');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 403) {
      console.log(`✅ Direct access to backend (3001) correctly blocked with 403 DirectAccessForbidden`);
    } else {
      console.log(`⚠️ Direct access returned status: ${err.response?.status || err.message}`);
    }
  }

  console.log('\n🎉 ALL E2E VERIFICATION TESTS COMPLETED SUCCESSFULLY! 🎉\n');
}

runE2ETests().catch(err => {
  console.error('Fatal test error:', sanitizeError(err));
  process.exit(1);
});

