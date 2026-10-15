const assert = require('node:assert/strict');
const test = require('node:test');
const { getMigrationFiles, parseArgs } = require('../scripts/db-migrate');

test('common migrations are ordered and include executable schema verifiers', () => {
  const migrations = getMigrationFiles('common');
  assert.deepEqual(migrations.map(migration => migration.version), [
    '000_legacy_anchor',
    '001_core',
    '002_safe_routing',
    '002_z_legacy_resource_routing',
    '003_common_defaults',
    '004_public_tenant_ids', '005_public_tenant_id_lifecycle',
    '006_reorganize_common_db_control_plane',
    '007_device_certificates',
    '008_deprecate_demo_db',
    '009_minimize_common_db'
  ]);
  for (const migration of migrations) {
    assert.match(migration.checksum, /^[a-f0-9]{64}$/);
    assert.match(migration.verifySql, /AS ok/i);
  }
  assert.match(migrations[0].baselineVerifySql, /tenant_app_routings/i);
});

test('tenant migrations are ordered and only baseline after verifying an existing users table', () => {
  const migrations = getMigrationFiles('tenant');
  assert.deepEqual(migrations.map(migration => migration.version), [
    '000_legacy_anchor',
    '001_core',
    '002_business_routing',
    '003_business_timestamps',
    '004_master_codes',
    '005_machine_type_display_codes',
    '006_numeric_machine_type_codes',
    '007_inspection_machine_type_targets',
    '008_four_digit_machine_type_codes',
    '009_prefixed_machine_type_codes',
    '010_machine_specific_inspection_types',
    '011_reorganize_tenant_auth_and_masters',
    '012_restore_machines_public_schema',
    '013_ensure_machine_types_display_codes'
  ]);
  assert.match(migrations[0].baselineVerifySql, /data_type = 'uuid'/i);
  assert.match(migrations[1].verifySql, /inspection_schedules/i);
  assert.match(migrations.find(migration => migration.version === '004_master_codes').verifySql, /machine_number/i);
  assert.match(migrations.find(migration => migration.version === '006_numeric_machine_type_codes').verifySql, /display_code/i);
  assert.match(migrations.find(migration => migration.version === '007_inspection_machine_type_targets').verifySql, /machine_type_id/i);
  assert.match(migrations.find(migration => migration.version === '010_machine_specific_inspection_types').verifySql, /machine_type_id/i);
  assert.match(migrations.find(migration => migration.version === '011_reorganize_tenant_auth_and_masters').verifySql, /user_org_memberships/i);
});

test('unknown migration scopes are rejected', () => {
  assert.throws(() => getMigrationFiles('production'), /Scope must be/);
});

test('migration runner accepts an explicit target database without embedding credentials in commands', () => {
  assert.equal(parseArgs(['--scope', 'tenant', '--database', 'demo_db']).database, 'demo_db');
  assert.throws(() => parseArgs(['--scope', 'tenant', '--database']), /Missing value for --database/);
});
