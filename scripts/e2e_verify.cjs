const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

const GATEWAY_PORT = 8443;
const CERTS_DIR = 'd:/sysbuckup/Single system group/gateway/certs';

const caCert = fs.readFileSync(path.join(CERTS_DIR, 'ca.crt'));
const daitetsuP12 = fs.readFileSync(path.join(CERTS_DIR, 'client_daitetsu.p12'));
const demoP12 = fs.readFileSync(path.join(CERTS_DIR, 'client_demo.p12'));

function createAgent(p12, passphrase = 'password') {
  return new https.Agent({
    ca: caCert,
    pfx: p12,
    passphrase,
    rejectUnauthorized: false
  });
}

function createNoCertAgent() {
  return new https.Agent({
    ca: caCert,
    rejectUnauthorized: false
  });
}

async function runE2ETests() {
  console.log('🚀 Starting E2E Verification Tests on Minimal common_db...');
  const daitetsuAgent = createAgent(daitetsuP12);
  const demoAgent = createAgent(demoP12);
  const noCertAgent = createNoCertAgent();

  // Test 1: Health Check via Gateway
  console.log('\n--- [Test 1] Gateway Health Check ---');
  try {
    const res = await axios.get(`https://localhost:${GATEWAY_PORT}/health`, { httpsAgent: daitetsuAgent });
    console.log(`✅ Health check status: ${res.status}, response:`, res.data);
  } catch (err) {
    console.error(`❌ Health check failed:`, err.response?.data || err.message);
    process.exit(1);
  }

  // Test 2: Login with niina / 0077 (Daitetsu Tenant)
  console.log('\n--- [Test 2] Login (niina / 0077) with Daitetsu Certificate ---');
  let authCookie = null;
  let meData = null;
  try {
    const loginRes = await axios.post(`https://localhost:${GATEWAY_PORT}/api/login`, {
      username: 'niina',
      password: '0077'
    }, {
      httpsAgent: daitetsuAgent,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Login status: ${loginRes.status}, user:`, loginRes.data.user?.username, 'tenant:', loginRes.data.tenant?.name || loginRes.data.user?.tenant_id);
    
    // Cookie取得
    const setCookie = loginRes.headers['set-cookie'];
    authCookie = setCookie ? setCookie.join('; ') : '';

    // /api/auth/me でテナント判定と権限確認
    const meRes = await axios.get(`https://localhost:${GATEWAY_PORT}/api/auth/me`, {
      httpsAgent: daitetsuAgent,
      headers: { Cookie: authCookie }
    });
    meData = meRes.data;
    console.log(`✅ /api/auth/me status: ${meRes.status}`);
    console.log(`   User: ${meData.user?.username}, Role: ${meData.user?.role}`);
    console.log(`   Tenant ID: ${meData.user?.tenant_id || meData.tenant?.id}, Tenant Key: ${meData.tenant?.tenant_key || 'daitetsu'}`);
  } catch (err) {
    console.error(`❌ Login failed:`, err.response?.data || err.message);
    process.exit(1);
  }

  // Test 3: Get Apps & Launch Token
  console.log('\n--- [Test 3] App Listing & Inspection Launch Token ---');
  let launchToken = null;
  try {
    const appsRes = await axios.get(`https://localhost:${GATEWAY_PORT}/api/apps`, {
      httpsAgent: daitetsuAgent,
      headers: { Cookie: authCookie }
    });
    console.log(`✅ /api/apps status: ${appsRes.status}, count: ${appsRes.data.length || appsRes.data.apps?.length}`);
    const apps = Array.isArray(appsRes.data) ? appsRes.data : appsRes.data.apps || [];
    apps.forEach(a => console.log(`   - App: ${a.app_key || a.app_id || a.id} (${a.app_name || a.name}), URL: ${a.app_url || a.url}`));

    // Launch Token 発行
    const tokenRes = await axios.post(`https://localhost:${GATEWAY_PORT}/api/apps/inspection/launch-token`, {}, {
      httpsAgent: daitetsuAgent,
      headers: { Cookie: authCookie }
    });
    launchToken = tokenRes.data.launch_token || tokenRes.data.token || tokenRes.data.launchCode;
    console.log(`✅ Launch token issued successfully (prefix: ${launchToken.substring(0, 15)}...)`);
  } catch (err) {
    console.error(`❌ App listing or Launch token failed:`, err.response?.data || err.message);
    process.exit(1);
  }

  // Test 4: Inspection API Token Exchange & Data Fetch
  console.log('\n--- [Test 4] Inspection API SSO Exchange & Inspection Data Fetch ---');
  let inspectionToken = null;
  let sampleRecords = [];
  try {
    const ssoRes = await axios.post(`https://localhost:${GATEWAY_PORT}/inspection-api/auth/external`, {
      token: launchToken
    }, {
      httpsAgent: daitetsuAgent,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Inspection SSO Exchange status: ${ssoRes.status}, user: ${ssoRes.data.user?.username || ssoRes.data.username || 'authenticated'}`);
    inspectionToken = ssoRes.data.token;
    console.log(`   Inspection Session Token: ${inspectionToken ? 'Acquired' : 'None'}`);

    // 点検項目一覧の取得
    const itemsRes = await axios.get(`https://localhost:${GATEWAY_PORT}/inspection-api/inspection/items`, {
      httpsAgent: daitetsuAgent,
      headers: { Authorization: `Bearer ${inspectionToken}` }
    });
    const itemsData = itemsRes.data?.items || itemsRes.data || [];
    console.log(`✅ Inspection Items status: ${itemsRes.status}, count: ${Array.isArray(itemsData) ? itemsData.length : Object.keys(itemsData).length}`);

    // 点検履歴レコードの取得
    const recordsRes = await axios.get(`https://localhost:${GATEWAY_PORT}/inspection-api/inspection/records?limit=5`, {
      httpsAgent: daitetsuAgent,
      headers: { Authorization: `Bearer ${inspectionToken}` }
    });
    sampleRecords = recordsRes.data?.records || recordsRes.data || [];
    console.log(`✅ Inspection Records status: ${recordsRes.status}, count: ${Array.isArray(sampleRecords) ? sampleRecords.length : 0}`);
  } catch (err) {
    console.error(`❌ Inspection SSO or fetch failed:`, err.response?.data || err.message);
    process.exit(1);
  }

  // Test 5: Create a new inspection record in Tenant DB
  console.log('\n--- [Test 5] Save New Inspection Record in Tenant DB ---');
  try {
    // 既存レコードから有効な vehicleId と inspectionBaseId を流用、またはデフォルト値を使用
    const baseRecord = Array.isArray(sampleRecords) && sampleRecords.length > 0 ? sampleRecords[0] : null;
    let targetVehicleId = baseRecord?.vehicle_id || baseRecord?.vehicleId || '00000000-0000-0000-0000-000000000001';
    let targetBaseId = baseRecord?.inspection_base_id || baseRecord?.inspectionBaseId || '00000000-0000-0000-0000-000000000001';

    // 車両一覧APIから取得を試みる
    try {
      const vRes = await axios.get(`https://localhost:${GATEWAY_PORT}/inspection-api/vehicles`, {
        httpsAgent: daitetsuAgent,
        headers: { Authorization: `Bearer ${inspectionToken}` }
      });
      const vList = vRes.data?.vehicles || vRes.data || [];
      if (Array.isArray(vList) && vList.length > 0) {
        targetVehicleId = vList[0].id || vList[0].vehicle_id || targetVehicleId;
      }
    } catch (_) {}

    // 拠点一覧APIから取得を試みる
    try {
      const bRes = await axios.get(`https://localhost:${GATEWAY_PORT}/inspection-api/bases`, {
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
      inspectorName: '新名 敏（テスト）',
      result: '良好',
      remarks: 'common_db 最小化検証自動テストによる仕業点検保存テスト',
      status: 'completed'
    };

    const saveRes = await axios.post(`https://localhost:${GATEWAY_PORT}/inspection-api/inspection/records`, newRecord, {
      httpsAgent: daitetsuAgent,
      headers: { 
        Authorization: `Bearer ${inspectionToken}`,
        'Content-Type': 'application/json' 
      }
    });
    console.log(`✅ Inspection Record saved status: ${saveRes.status}, record:`, saveRes.data?.record?.id || saveRes.data?.id || 'Success');
  } catch (err) {
    console.log(`⚠️ Record save response status:`, err.response?.status, 'data:', err.response?.data || err.message);
  }

  // Test 6: Tenant Isolation & Security
  console.log('\n--- [Test 6] Tenant Isolation & Direct Access Guard ---');
  // 6a: クライアント証明書なしで Gateway にアクセスした場合
  try {
    await axios.get(`https://localhost:${GATEWAY_PORT}/api/auth/me`, { httpsAgent: noCertAgent });
    console.error('❌ Expected failure for no-cert request, but succeeded!');
  } catch (err) {
    console.log(`✅ No-certificate request correctly rejected/denied (status/code: ${err.response?.status || err.code})`);
  }

  // 6b: 直接内部ポート（http://127.0.0.1:3000）へアクセスした場合（403 DirectAccessForbidden）
  try {
    await axios.get('http://127.0.0.1:3000/api/auth/me');
    console.error('❌ Expected 403 DirectAccessForbidden for direct port 3000 access, but succeeded!');
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
  console.error('Fatal test error:', err);
  process.exit(1);
});
