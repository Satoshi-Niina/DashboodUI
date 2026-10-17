const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GATEWAY_CERTS_DIR = path.resolve(__dirname, '..', '..', 'gateway', 'certs');
const OPENSSL = 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe';

function sh(cmd) {
  console.log('[EXEC]', cmd);
  return execSync(cmd, { cwd: GATEWAY_CERTS_DIR, env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString();
}

async function main() {
  console.log('=== 1. スーパー管理者用 クライアント証明書の生成 ===');
  const baseName = 'client_superadmin_niina';
  const keyFile = `${baseName}.key`;
  const csrFile = `${baseName}.csr`;
  const crtFile = `${baseName}.crt`;
  const p12File = `${baseName}.p12`;

  const commonName = 'PC-SuperAdmin-Niina';
  const orgName = 'System Operations';
  const ouName = 'SuperAdmin';

  sh(`"${OPENSSL}" req -new -newkey rsa:2048 -nodes -keyout ${keyFile} -out ${csrFile} -subj "/CN=${commonName}/O=${orgName}/OU=${ouName}"`);
  sh(`"${OPENSSL}" x509 -req -in ${csrFile} -CA ca.crt -CAkey ca.key -CAcreateserial -out ${crtFile} -days 730`);
  sh(`"${OPENSSL}" pkcs12 -export -out ${p12File} -inkey ${keyFile} -in ${crtFile} -certfile ca.crt -passout pass:password`);

  console.log('✅ 証明書ファイルを生成しました:', p12File);

  // 情報を抽出
  const rawFingerprint = sh(`"${OPENSSL}" x509 -noout -fingerprint -sha256 -in ${crtFile}`);
  const fingerprint256 = rawFingerprint.replace(/^SHA256 Fingerprint=/i, '').replace(/:/g, '').trim().toLowerCase();

  const rawSerial = sh(`"${OPENSSL}" x509 -noout -serial -in ${crtFile}`);
  const serialNumber = rawSerial.replace(/^serial=/i, '').trim().toLowerCase();

  const rawEndDate = sh(`"${OPENSSL}" x509 -noout -enddate -in ${crtFile}`);
  const notAfterStr = rawEndDate.replace(/^notAfter=/i, '').trim();
  const validTo = new Date(notAfterStr);

  console.log('Fingerprint256:', fingerprint256);
  console.log('SerialNumber:', serialNumber);
  console.log('ValidTo:', validTo.toISOString());

  console.log('\n=== 2. データベースへの端末および証明書登録 ===');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/railway_management'
  });

  const deviceIdentifier = 'pc-superadmin-niina';
  const deviceName = '統括管理PC (niina)';
  const tenantId = 'daitetsu'; // 初期ホームテナントは大鉄
  const subjectDn = `CN=${commonName}, O=${orgName}, OU=${ouName}`;

  // 既存デバイス確認
  let deviceId;
  const devCheck = await pool.query('SELECT id FROM public.devices WHERE device_identifier = $1', [deviceIdentifier]);
  if (devCheck.rows.length > 0) {
    deviceId = devCheck.rows[0].id;
    await pool.query(
      'UPDATE public.devices SET device_name = $1, tenant_id = $2, is_active = true, updated_at = NOW() WHERE id = $3',
      [deviceName, tenantId, deviceId]
    );
    console.log('✅ 既存デバイスを更新しました: ID =', deviceId);
  } else {
    const devInsert = await pool.query(
      `INSERT INTO public.devices (id, device_identifier, tenant_id, device_name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()) RETURNING id`,
      [deviceIdentifier, tenantId, deviceName]
    );
    deviceId = devInsert.rows[0].id;
    console.log('✅ 新規デバイスを登録しました: ID =', deviceId);
  }

  // 既存証明書確認
  const certCheck = await pool.query('SELECT id FROM public.device_certificates WHERE fingerprint256 = $1', [fingerprint256]);
  if (certCheck.rows.length > 0) {
    await pool.query(
      `UPDATE public.device_certificates SET device_id = $1, serial_number = $2, subject_dn = $3, valid_to = $4, is_revoked = false WHERE fingerprint256 = $5`,
      [deviceId, serialNumber, subjectDn, validTo, fingerprint256]
    );
    console.log('✅ 既存証明書レコードを更新しました');
  } else {
    await pool.query(
      `INSERT INTO public.device_certificates (id, device_id, serial_number, fingerprint256, subject_dn, valid_to, is_revoked)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)`,
      [deviceId, serialNumber, fingerprint256, subjectDn, validTo]
    );
    console.log('✅ 新規証明書レコードを登録しました');
  }

  await pool.end();

  console.log('\n======================================================');
  console.log('🎉 スーパー管理者 (niina) 専用端末証明書の準備が完了しました！');
  console.log(`PKCS#12 ファイルのフルパス:`);
  console.log(path.join(GATEWAY_CERTS_DIR, p12File));
  console.log(`インポート時のパスワード: password`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
});
