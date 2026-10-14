const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const MIGRATION_RUNNER = path.join(ROOT, 'scripts', 'db-migrate.js');
const LEGACY_FOUNDATION = path.join(ROOT, 'docs', 'migrations', '20260903_common_db_foundation_up.sql');
const dbSuffix = `${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
const databaseNames = [
  `dashboard_new_common_${dbSuffix}`,
  `dashboard_new_tenant_${dbSuffix}`,
  `dashboard_old_common_${dbSuffix}`,
  `dashboard_old_tenant_${dbSuffix}`
];
const createdDatabases = new Set();

function localAdminConnection() {
  const connectionString = process.env.TEST_DATABASE_ADMIN_URL;
  if (!connectionString) {
    throw new Error('Set TEST_DATABASE_ADMIN_URL to a disposable local PostgreSQL administrative connection to run this test.');
  }
  const parsed = new URL(connectionString);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())
    || !['/postgres', '/template1'].includes(parsed.pathname)) {
    throw new Error('TEST_DATABASE_ADMIN_URL must point to localhost and the postgres or template1 maintenance database.');
  }
  return connectionString;
}

function connectionForDatabase(adminUrl, databaseName) {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function runCli(args, databaseUrl) {
  const result = spawnSync(process.execPath, [MIGRATION_RUNNER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: 120000
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`db-migrate ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return `${result.stdout}\n${result.stderr}`;
}

function runCliExpectFailure(args, databaseUrl, expectedMessage) {
  const result = spawnSync(process.execPath, [MIGRATION_RUNNER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: 120000
  });
  if (result.error) throw result.error;
  assert.notEqual(result.status, 0, `Expected command failure: ${args.join(' ')}`);
  assert.match(`${result.stdout}\n${result.stderr}`, expectedMessage);
}

async function createDatabase(adminPool, databaseName) {
  if (!/^dashboard_(new|old)_(common|tenant)_\d+_[a-f0-9]+$/.test(databaseName)) {
    throw new Error(`Refusing to create unexpected database name: ${databaseName}`);
  }
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  createdDatabases.add(databaseName);
}

async function createLegacyCommonFixture(pool) {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
    CREATE TABLE public.organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(100) NOT NULL UNIQUE,
      name varchar(255)
    );
    CREATE TABLE public.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username varchar(255) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      display_name varchar(255),
      role varchar(100),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(100),
      name varchar(255),
      role_key varchar(100),
      role_name varchar(255)
    );
    CREATE TABLE public.permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(100),
      description text,
      permission_key varchar(100),
      permission_name varchar(255)
    );
    CREATE TABLE public.user_org_memberships (
      user_id uuid NOT NULL REFERENCES public.users(id),
      org_id uuid NOT NULL REFERENCES public.organizations(id),
      is_active boolean NOT NULL DEFAULT true,
      PRIMARY KEY (user_id, org_id)
    );
    CREATE TABLE public.user_role_assignments (
      user_id uuid NOT NULL REFERENCES public.users(id),
      org_id uuid NOT NULL REFERENCES public.organizations(id),
      role_id uuid NOT NULL REFERENCES public.roles(id),
      PRIMARY KEY (user_id, org_id, role_id)
    );
    CREATE TABLE public.app_resource_routing (
      tenant_key text PRIMARY KEY,
      tenant_name text NOT NULL,
      org_id uuid NOT NULL,
      database_url text NOT NULL
    );
    CREATE TABLE public.tenant_app_routings (
      tenant_key varchar(100) NOT NULL,
      app_id varchar(100) NOT NULL,
      tenant_id varchar(100),
      tenant_name varchar(255),
      database_url text,
      db_name varchar(100),
      tenant_path varchar(255),
      app_name varchar(255),
      app_url varchar(1024),
      icon varchar(100),
      category varchar(100),
      required_role varchar(100),
      display_order integer DEFAULT 0,
      is_visible boolean DEFAULT true,
      is_active boolean DEFAULT true,
      description text,
      PRIMARY KEY (tenant_key, app_id)
    );
    INSERT INTO public.organizations (id, code, name)
    VALUES ('10000000-0000-0000-0000-000000000001', 'fixture', 'Fixture tenant');
    INSERT INTO public.users (id, username, password_hash, display_name, role)
    VALUES ('10000000-0000-0000-0000-000000000002', 'fixture-user', 'not-a-login-hash', 'Fixture User', 'operator');
    INSERT INTO public.roles (id, code, name, role_key, role_name)
    VALUES ('10000000-0000-0000-0000-000000000003', 'operator', 'Operator', 'operator', 'Operator');
    INSERT INTO public.user_org_memberships (user_id, org_id)
    VALUES ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');
    INSERT INTO public.user_role_assignments (user_id, org_id, role_id)
    VALUES ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');
    INSERT INTO public.tenant_app_routings
      (tenant_key, app_id, tenant_id, tenant_name, db_name, tenant_path, app_name, app_url)
    VALUES
      ('fixture', 'dashboard-ui', 'fixture', 'Fixture tenant', 'dashboard_fixture', '/fixture', 'Dashboard', 'http://localhost:8080'),
      ('fixture', 'fixture-app', 'fixture', 'Fixture tenant', 'dashboard_fixture', '/fixture', 'Original name', 'https://original.invalid/app');
    INSERT INTO public.app_resource_routing (tenant_key, tenant_name, org_id, database_url)
    VALUES ('legacy-resource-config', 'Preserved legacy routing metadata',
      '10000000-0000-0000-0000-000000000001', 'postgresql://localhost/preserved_route');
  `);
  await pool.query(fs.readFileSync(LEGACY_FOUNDATION, 'utf8'));
}

async function createLegacyTenantFixture(pool) {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
    CREATE TABLE public.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username varchar(255) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      display_name varchar(255),
      password varchar(255),
      role varchar(100) NOT NULL DEFAULT 'operator',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.machine_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      model_name varchar(255),
      category varchar(255)
    );
    CREATE TABLE public.machines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      machine_type_id uuid REFERENCES public.machine_types(id),
      serial_number varchar(255)
    );
    CREATE TABLE public.management_offices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      office_name varchar(255)
    );
    CREATE TABLE public.bases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id uuid REFERENCES public.management_offices(id),
      base_name varchar(255)
    );
    CREATE TABLE public.inspection_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      inspection_type_name varchar(255)
    );
    CREATE TABLE public.inspection_schedules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      machine_id uuid REFERENCES public.machines(id),
      inspection_type_id uuid REFERENCES public.inspection_types(id),
      scheduled_date date,
      completed_date date
    );
    INSERT INTO public.users (id, username, password_hash, display_name, role)
    VALUES ('20000000-0000-0000-0000-000000000001', 'legacy-tenant-user', 'preserve-this-hash', 'Legacy User', 'operator');
    INSERT INTO public.machine_types (id, model_name, category)
    VALUES ('20000000-0000-4000-8000-000000000002', 'Legacy Model', '軌道モータカー');
    INSERT INTO public.machines (id, machine_type_id, serial_number)
    VALUES ('20000000-0000-0000-0000-000000000003', '20000000-0000-4000-8000-000000000002', 'LEGACY-1');
    INSERT INTO public.management_offices (id, office_name)
    VALUES ('20000000-0000-0000-0000-000000000004', 'Legacy Office');
    INSERT INTO public.bases (id, office_id, base_name)
    VALUES ('20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'Legacy Base');
    INSERT INTO public.inspection_types (id, inspection_type_name)
    VALUES ('20000000-0000-0000-0000-000000000006', 'Legacy inspection');
    INSERT INTO public.inspection_schedules (id, machine_id, inspection_type_id, scheduled_date)
    VALUES ('20000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000006', '2026-01-01');
  `);
}

async function verifyFreshSchemas(commonPool, tenantPool) {
  const common = await commonPool.query(`
    SELECT
      (SELECT count(*) FROM public.roles WHERE role_key IN ('system_admin', 'tenant_admin', 'manager', 'operator', 'viewer')) AS roles,
      (SELECT count(*) FROM public.dashboard_schema_migrations WHERE execution_type = 'migration') AS migration_count,
      (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'dashboard_tenant_routes_active_idx') AS route_index
  `);
  assert.equal(Number(common.rows[0].roles), 5);
  assert.equal(Number(common.rows[0].migration_count), 7);
  assert.equal(Number(common.rows[0].route_index), 1);
  const tenant = await tenantPool.query(`
    SELECT
      (SELECT count(*) FROM public.dashboard_schema_migrations WHERE execution_type = 'migration') AS migration_count,
      (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'dashboard_inspection_machine_idx') AS inspection_index,
      (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inspection_schedules' AND column_name IN ('cycle_months', 'duration_days', 'remarks', 'is_active')) AS inspection_columns,
      (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inspection_schedules' AND column_name IN ('machine_type_id', 'target_category')) AS inspection_target_columns
  `);
  assert.equal(Number(tenant.rows[0].migration_count), 11);
  assert.equal(Number(tenant.rows[0].inspection_index), 1);
  assert.equal(Number(tenant.rows[0].inspection_columns), 4);
  assert.equal(Number(tenant.rows[0].inspection_target_columns), 2);
  const masterColumns = await tenantPool.query(`
    SELECT count(*) AS column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'machines' AND column_name IN ('machine_number', 'office_id', 'type_certification', 'manufacture_date', 'purchase_date', 'notes'))
        OR (table_name = 'machine_types' AND column_name = 'display_code')
        OR (table_name = 'inspection_schedules' AND column_name IN ('machine_type_id', 'target_category'))
        OR (table_name = 'bases' AND column_name = 'location')
        OR (table_name = 'inspection_types' AND column_name IN ('display_order', 'is_active', 'machine_type_id', 'cycle_months', 'duration_days'))
      )
  `);
  assert.equal(Number(masterColumns.rows[0].column_count), 15);
}

async function verifyLegacyPreservation(commonPool, tenantPool) {
  const common = await commonPool.query(`
    SELECT
      (SELECT app_name FROM public.applications WHERE app_key = 'fixture-app') AS app_name,
      (SELECT app_url FROM public.applications WHERE app_key = 'fixture-app') AS app_url,
      (SELECT is_enabled
       FROM public.tenant_applications
       WHERE tenant_id = (SELECT id FROM public.tenants WHERE tenant_key = 'fixture')
         AND application_id = (SELECT id FROM public.applications WHERE app_key = 'fixture-app')) AS app_enabled,
      (SELECT is_active FROM public.user_tenants WHERE user_id = '10000000-0000-0000-0000-000000000002') AS membership_active,
      (SELECT count(*) FROM public.user_org_memberships WHERE user_id = '10000000-0000-0000-0000-000000000002') AS old_membership_count,
      (SELECT count(*) FROM public.user_role_assignments WHERE user_id = '10000000-0000-0000-0000-000000000002') AS old_role_count
      , (SELECT count(*) FROM public.app_resource_routing_legacy
         WHERE tenant_key = 'legacy-resource-config'
           AND tenant_name = 'Preserved legacy routing metadata') AS archived_legacy_resource_count
  `);
  assert.equal(common.rows[0].app_name, 'Operator-owned app name');
  assert.equal(common.rows[0].app_url, 'https://operator.invalid/app');
  assert.equal(common.rows[0].app_enabled, false);
  assert.equal(common.rows[0].membership_active, false);
  assert.equal(Number(common.rows[0].old_membership_count), 1);
  assert.equal(Number(common.rows[0].old_role_count), 1);
  assert.equal(Number(common.rows[0].archived_legacy_resource_count), 1);

  const tenant = await tenantPool.query(`
    SELECT
      (SELECT password_hash FROM public.users WHERE username = 'legacy-tenant-user') AS password_hash,
      (SELECT display_code FROM public.machine_types WHERE id = '20000000-0000-4000-8000-000000000002') AS machine_type_display_code,
      (SELECT serial_number FROM public.machines WHERE id = '20000000-0000-0000-0000-000000000003') AS serial_number,
      (SELECT count(*) FROM public.inspection_schedules) AS schedule_count,
      (SELECT machine_type_id::text FROM public.inspection_schedules WHERE id = '20000000-0000-0000-0000-000000000007') AS schedule_machine_type_id,
      (SELECT machine_id FROM public.inspection_schedules WHERE id = '20000000-0000-0000-0000-000000000007') AS schedule_machine_id
  `);
  assert.equal(tenant.rows[0].password_hash, 'preserve-this-hash');
  assert.equal(tenant.rows[0].machine_type_display_code, 'MT-0001');
  assert.equal(tenant.rows[0].serial_number, 'LEGACY-1');
  assert.equal(Number(tenant.rows[0].schedule_count), 1);
  assert.equal(tenant.rows[0].schedule_machine_type_id, '20000000-0000-4000-8000-000000000002');
  assert.equal(tenant.rows[0].schedule_machine_id, null);
}

async function startAndCheckApplication(commonUrl, tenantUrl) {
  const port = 19000 + (process.pid % 10000);
  const commonPool = new Pool({ connectionString: commonUrl });
  const fixtureTenantPool = new Pool({ connectionString: tenantUrl });
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: commonUrl,
      TENANT_ROUTING_DB_NAME: new URL(commonUrl).pathname.replace(/^\//, ''),
      TENANT_DB_DEMO_URL: tenantUrl,
      TENANT_DB_FIXTURE_URL: tenantUrl,
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      GCS_BUCKET_NAME: 'fixture-only'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const serverExit = once(server, 'exit');
  server.stdout.on('data', chunk => { output += chunk.toString(); });
  server.stderr.on('data', chunk => { output += chunk.toString(); });
  server.on('exit', (code, signal) => console.log(`Test server exited with code ${code} (signal ${signal}).`));
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Application exited early (code ${server.exitCode}):\n${output}`);
      try {
        const response = await fetch(`${baseUrl}/ready`);
        if (attempt === 0) console.log(`Application probe returned HTTP ${response.status}.`);
        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch (_) {
        await delay(250);
      }
      if (!ready) await delay(250);
    }
    assert.equal(ready, true, `Application did not become ready:\n${output}`);

    const login = await fetch(`${baseUrl}/api/login?tenant_id=fixture&tenant_path=%2Ffixture`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'integration-user', password: 'fixture-password', tenantKey: 'fixture', tenant_id: 'fixture', tenant_path: '/fixture' })
    });
    console.log(`Fixture login returned HTTP ${login.status}.`);
    const loginBody = await login.json();
    assert.equal(login.status, 200, `Login failed: ${JSON.stringify(loginBody)}\n${output}`);
    assert.equal(loginBody.success, true);
    assert.equal(loginBody.user.tenant_key, 'fixture');
    const tenantUser = await fixtureTenantPool.query(
      'SELECT 1 FROM public.users WHERE username = $1',
      ['integration-user']
    );
    assert.equal(tenantUser.rowCount, 0, 'The fixture account must exist only in the common DB.');
    const cookieHeader = login.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('dashboard_session='), 'Login did not issue the session cookie.');
    const cookie = cookieHeader.split(';', 1)[0];

    const rootDemoLogin = await fetch(`${baseUrl}/api/login?tenant_id=demo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-key': 'demo' },
      body: JSON.stringify({
        username: 'integration-user',
        password: 'fixture-password',
        tenantKey: 'demo',
        tenant_id: 'demo',
        tenant_path: '/'
      })
    });
    const rootDemoLoginBody = await rootDemoLogin.json();
    assert.equal(rootDemoLogin.status, 200, `Common URL demo login failed: ${JSON.stringify(rootDemoLoginBody)}\n${output}`);
    assert.equal(rootDemoLoginBody.user.tenant_key, 'demo');
    const rootDemoCookie = rootDemoLogin.headers.get('set-cookie').split(';', 1)[0];
    const rootDemoApps = await fetch(`${baseUrl}/api/apps?tenant_id=demo`, { headers: { cookie: rootDemoCookie } });
    const rootDemoAppsBody = await rootDemoApps.json();
    assert.equal(rootDemoApps.status, 200);
    assert.ok(rootDemoAppsBody.apps.some(app => app.app_key === 'dashboard-ui'));

    const mismatchedDemoLogin = await fetch(`${baseUrl}/demo/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-key': 'fixture' },
      body: JSON.stringify({
        username: 'integration-user',
        password: 'fixture-password',
        tenantKey: 'fixture',
        tenant_id: 'fixture',
        tenant_path: '/fixture'
      })
    });
    assert.equal(mismatchedDemoLogin.status, 403, 'A demo URL must not authenticate into another tenant.');

    const demoLogin = await fetch(`${baseUrl}/demo/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-key': 'demo' },
      body: JSON.stringify({
        username: 'integration-user',
        password: 'fixture-password',
        tenantKey: 'demo',
        tenant_id: 'demo',
        tenant_path: '/demo'
      })
    });
    const demoLoginBody = await demoLogin.json();
    assert.equal(demoLogin.status, 200, `Demo login failed: ${JSON.stringify(demoLoginBody)}\n${output}`);
    assert.equal(demoLoginBody.user.tenant_key, 'demo');
    const demoCookie = demoLogin.headers.get('set-cookie').split(';', 1)[0];
    const demoMe = await fetch(`${baseUrl}/demo/api/auth/me`, { headers: { cookie: demoCookie } });
    const demoMeBody = await demoMe.json();
    assert.equal(demoMe.status, 200);
    assert.equal(demoMeBody.user.tenant_key, 'demo');
    const demoApps = await fetch(`${baseUrl}/demo/api/apps`, { headers: { cookie: demoCookie } });
    const demoAppsBody = await demoApps.json();
    assert.equal(demoApps.status, 200);
    assert.ok(demoAppsBody.apps.some(app => app.app_key === 'dashboard-ui'));
    const demoOffices = await fetch(`${baseUrl}/demo/api/offices`, { headers: { cookie: demoCookie } });
    const demoOfficesBody = await demoOffices.json();
    assert.equal(demoOffices.status, 200, `Demo business API failed: ${JSON.stringify(demoOfficesBody)}\n${output}`);
    assert.ok(demoOfficesBody.offices.some(office => office.office_name === 'Legacy Office'));
    const demoOffice = demoOfficesBody.offices.find(office => office.office_name === 'Legacy Office');

    const createdBase = await fetch(`${baseUrl}/demo/api/bases`, {
      method: 'POST',
      headers: { cookie: demoCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ base_name: `Workflow Base ${Date.now()}`, office_id: demoOffice.office_id })
    });
    const createdBaseBody = await createdBase.json();
    assert.equal(createdBase.status, 200, `Demo base creation failed: ${JSON.stringify(createdBaseBody)}\n${output}`);
    assert.match(createdBaseBody.base.base_code, /^\d{4}$/);

    const createMachine = async machineTypeId => {
      const response = await fetch(`${baseUrl}/demo/api/machines`, {
        method: 'POST',
        headers: { cookie: demoCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ machine_type_id: machineTypeId, office_id: demoOffice.office_id })
      });
      const body = await response.json();
      assert.equal(response.status, 200, `Demo machine creation failed: ${JSON.stringify(body)}\n${output}`);
      return body.data;
    };
    const createdMachine = await createMachine('20000000-0000-4000-8000-000000000002');
    assert.equal(createdMachine.machine_number, 'MC001');
    assert.equal((await createMachine('20000000-0000-4000-8000-000000000002')).machine_number, 'MC002');

    const workflowModelName = `Workflow Model ${Date.now()}`;
    const createdMachineType = await fetch(`${baseUrl}/demo/api/machine-types`, {
      method: 'POST',
      headers: { cookie: demoCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        type_name: workflowModelName,
        model_name: workflowModelName,
        manufacturer: 'Workflow test',
        category: '箱トロ'
      })
    });
    const createdMachineTypeBody = await createdMachineType.json();
    assert.equal(createdMachineType.status, 200, `Demo machine type creation failed: ${JSON.stringify(createdMachineTypeBody)}\n${output}`);
    assert.match(createdMachineTypeBody.data.display_code, /^MT-\d{4}$/);
    assert.equal((await createMachine(createdMachineTypeBody.data.id)).machine_number, 'HT001');

    const inspectionPrefixModels = [
      ['MC', '20000000-0000-4000-8000-000000000002'],
      ['HTT', createdMachineTypeBody.data.id]
    ];
    for (const [category, machineNumberPrefix, inspectionTypePrefix] of [
      ['鉄トロ', 'TT', 'TT'],
      ['ホッパー車', 'HPT', 'HPT']
    ]) {
      const modelName = `Workflow ${category} ${Date.now()}`;
      const typeResponse = await fetch(`${baseUrl}/demo/api/machine-types`, {
        method: 'POST',
        headers: { cookie: demoCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ type_name: modelName, model_name: modelName, category })
      });
      const typeBody = await typeResponse.json();
      assert.equal(typeResponse.status, 200, `Demo ${category} type creation failed: ${JSON.stringify(typeBody)}\n${output}`);
      assert.equal((await createMachine(typeBody.data.id)).machine_number, `${machineNumberPrefix}001`);
      inspectionPrefixModels.push([inspectionTypePrefix, typeBody.data.id]);
    }

    const createInspectionType = async (machineTypeId, typeName, cycleMonths, durationDays) => fetch(
      `${baseUrl}/demo/api/inspection-types`,
      {
        method: 'POST',
        headers: { cookie: demoCookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          machine_type_id: machineTypeId,
          type_name: typeName,
          cycle_months: cycleMonths,
          duration_days: durationDays
        })
      }
    );
    const createdInspectionType = await fetch(`${baseUrl}/demo/api/inspection-types`, {
      method: 'POST',
      headers: { cookie: demoCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        machine_type_id: '20000000-0000-4000-8000-000000000002',
        type_name: `Workflow Inspection ${Date.now()}`,
        cycle_months: 12,
        duration_days: 7
      })
    });
    const createdInspectionTypeBody = await createdInspectionType.json();
    assert.equal(createdInspectionType.status, 201, `Demo inspection type creation failed: ${JSON.stringify(createdInspectionTypeBody)}\n${output}`);
    assert.equal(createdInspectionTypeBody.data.type_code, 'MC01');
    assert.equal(createdInspectionTypeBody.data.cycle_months, 12);
    assert.equal(createdInspectionTypeBody.data.duration_days, 7);

    for (const [prefix, machineTypeId] of inspectionPrefixModels.slice(1)) {
      const response = await createInspectionType(machineTypeId, `Inspection ${prefix}`, 6, 3);
      const body = await response.json();
      assert.equal(response.status, 201, `${prefix} inspection type creation failed: ${JSON.stringify(body)}\n${output}`);
      assert.equal(body.data.type_code, `${prefix}01`);
    }

    const inspectionTypePreview = await fetch(
      `${baseUrl}/demo/api/inspection-types/next-code?machine_type_id=20000000-0000-4000-8000-000000000002`,
      { headers: { cookie: demoCookie } }
    );
    const inspectionTypePreviewBody = await inspectionTypePreview.json();
    assert.equal(inspectionTypePreview.status, 200);
    assert.equal(inspectionTypePreviewBody.data.type_code, 'MC02');

    const machineInspectionTypes = await fetch(
      `${baseUrl}/demo/api/inspection-types?machine_type_id=20000000-0000-4000-8000-000000000002`,
      { headers: { cookie: demoCookie } }
    );
    const machineInspectionTypesBody = await machineInspectionTypes.json();
    assert.equal(machineInspectionTypes.status, 200);
    assert.ok(machineInspectionTypesBody.data.some(type => type.id === createdInspectionTypeBody.data.id));
    assert.ok(machineInspectionTypesBody.data.every(type => type.machine_type_id === '20000000-0000-4000-8000-000000000002'));

    const createdInspectionSchedule = await fetch(`${baseUrl}/demo/api/inspection-schedules`, {
      method: 'POST',
      headers: { cookie: demoCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        machine_type_id: '20000000-0000-4000-8000-000000000002',
        target_category: null,
        inspection_type_id: createdInspectionTypeBody.data.id,
        cycle_months: 99,
        duration_days: 99
      })
    });
    const createdInspectionScheduleBody = await createdInspectionSchedule.json();
    assert.equal(createdInspectionSchedule.status, 201, `Demo inspection schedule creation failed: ${JSON.stringify(createdInspectionScheduleBody)}\n${output}`);
    assert.equal(createdInspectionScheduleBody.data.machine_type_id, '20000000-0000-4000-8000-000000000002');
    assert.equal(createdInspectionScheduleBody.data.machine_id, null);
    assert.equal(createdInspectionScheduleBody.data.cycle_months, 12);
    assert.equal(createdInspectionScheduleBody.data.duration_days, 7);

    const updatedInspectionType = await fetch(
      `${baseUrl}/demo/api/inspection-types/${createdInspectionTypeBody.data.id}`,
      {
        method: 'PUT',
        headers: { cookie: demoCookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          machine_type_id: '20000000-0000-4000-8000-000000000002',
          type_name: createdInspectionTypeBody.data.type_name,
          cycle_months: 18,
          duration_days: 9,
          description: null,
          display_order: 0,
          is_active: true
        })
      }
    );
    const updatedInspectionTypeBody = await updatedInspectionType.json();
    assert.equal(updatedInspectionType.status, 200, `Inspection type update failed: ${JSON.stringify(updatedInspectionTypeBody)}\n${output}`);
    assert.equal(updatedInspectionTypeBody.data.type_code, 'MC01');

    const synchronizedScheduleResponse = await fetch(
      `${baseUrl}/demo/api/inspection-schedules/${createdInspectionScheduleBody.data.id}`,
      { headers: { cookie: demoCookie } }
    );
    const synchronizedScheduleBody = await synchronizedScheduleResponse.json();
    assert.equal(synchronizedScheduleResponse.status, 200);
    assert.equal(synchronizedScheduleBody.data.cycle_months, 18);
    assert.equal(synchronizedScheduleBody.data.duration_days, 9);

    const inspectionSchedules = await fetch(`${baseUrl}/demo/api/inspection-schedules`, {
      headers: { cookie: demoCookie }
    });
    const inspectionSchedulesBody = await inspectionSchedules.json();
    assert.equal(inspectionSchedules.status, 200, `Demo inspection schedule listing failed: ${JSON.stringify(inspectionSchedulesBody)}\n${output}`);
    assert.ok(inspectionSchedulesBody.data.some(schedule =>
      schedule.id === createdInspectionScheduleBody.data.id
      && schedule.machine_type_display_code === 'MT-0001'
    ));

    const deletedReferencedInspectionType = await fetch(
      `${baseUrl}/demo/api/inspection-types/${createdInspectionTypeBody.data.id}`,
      { method: 'DELETE', headers: { cookie: demoCookie } }
    );
    const deletedReferencedInspectionTypeBody = await deletedReferencedInspectionType.json();
    assert.equal(deletedReferencedInspectionType.status, 200, `Referenced inspection type deletion failed: ${JSON.stringify(deletedReferencedInspectionTypeBody)}\n${output}`);
    assert.equal(deletedReferencedInspectionTypeBody.unlinked_schedule_count, 1);

    const unlinkedScheduleResponse = await fetch(
      `${baseUrl}/demo/api/inspection-schedules/${createdInspectionScheduleBody.data.id}`,
      { headers: { cookie: demoCookie } }
    );
    const unlinkedScheduleBody = await unlinkedScheduleResponse.json();
    assert.equal(unlinkedScheduleResponse.status, 200, `Unlinked inspection schedule was not retained: ${JSON.stringify(unlinkedScheduleBody)}\n${output}`);
    assert.equal(unlinkedScheduleBody.data.inspection_type_id, null);

    const updatedUnlinkedSchedule = await fetch(
      `${baseUrl}/demo/api/inspection-schedules/${createdInspectionScheduleBody.data.id}`,
      {
        method: 'PUT',
        headers: { cookie: demoCookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          machine_type_id: createdInspectionScheduleBody.data.machine_type_id,
          target_category: null,
          inspection_type_id: null,
          cycle_months: 18,
          duration_days: 9,
          remarks: 'Updated without inspection type',
          is_active: true
        })
      }
    );
    const updatedUnlinkedScheduleBody = await updatedUnlinkedSchedule.json();
    assert.equal(updatedUnlinkedSchedule.status, 200, `Unlinked inspection schedule update failed: ${JSON.stringify(updatedUnlinkedScheduleBody)}\n${output}`);
    assert.equal(updatedUnlinkedScheduleBody.data.inspection_type_id, null);
    assert.equal(updatedUnlinkedScheduleBody.data.cycle_months, 18);

    const deletedUnlinkedSchedule = await fetch(
      `${baseUrl}/demo/api/inspection-schedules/${createdInspectionScheduleBody.data.id}`,
      { method: 'DELETE', headers: { cookie: demoCookie } }
    );
    const deletedUnlinkedScheduleBody = await deletedUnlinkedSchedule.json();
    assert.equal(deletedUnlinkedSchedule.status, 200, `Unlinked inspection schedule deletion failed: ${JSON.stringify(deletedUnlinkedScheduleBody)}\n${output}`);

    const unusedInspectionType = await fetch(`${baseUrl}/demo/api/inspection-types`, {
      method: 'POST',
      headers: { cookie: demoCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type_name: 'Delete test inspection' })
    });
    const unusedInspectionTypeBody = await unusedInspectionType.json();
    assert.equal(unusedInspectionType.status, 201);
    const deletedInspectionType = await fetch(
      `${baseUrl}/demo/api/inspection-types/${unusedInspectionTypeBody.data.id}`,
      { method: 'DELETE', headers: { cookie: demoCookie } }
    );
    const deletedInspectionTypeBody = await deletedInspectionType.json();
    assert.equal(deletedInspectionType.status, 200, `Unused inspection type deletion failed: ${JSON.stringify(deletedInspectionTypeBody)}\n${output}`);
    assert.equal(deletedInspectionTypeBody.success, true);

    const crossTenantWithDemoSession = await fetch(`${baseUrl}/fixture/api/apps`, { headers: { cookie: demoCookie } });
    assert.equal(crossTenantWithDemoSession.status, 403, 'A demo session must not access another tenant by changing the URL prefix.');
    const crossTenantWithDemoQuery = await fetch(`${baseUrl}/api/apps?tenant_id=fixture`, { headers: { cookie: demoCookie } });
    assert.equal(crossTenantWithDemoQuery.status, 403, 'A demo session must not access another tenant by changing the tenant query.');
    const crossTenantWithDemoHeader = await fetch(`${baseUrl}/api/apps`, {
      headers: { cookie: demoCookie, 'x-tenant-id': 'fixture' }
    });
    assert.equal(crossTenantWithDemoHeader.status, 403, 'A demo session must not access another tenant by changing the tenant header.');

    await commonPool.query(`
      DELETE FROM public.role_permissions
      WHERE permission_id = '50000000-0000-0000-0000-000000000001'
    `);
    const revokedDemoPermission = await fetch(`${baseUrl}/demo/api/apps`, { headers: { cookie: demoCookie } });
    assert.equal(revokedDemoPermission.status, 403, 'A session must stop working after its permission set changes.');
    await commonPool.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (
        (SELECT id FROM public.roles WHERE role_key = 'tenant_admin' LIMIT 1),
        '50000000-0000-0000-0000-000000000001'
      )
    `);

    await commonPool.query(`
      UPDATE public.user_tenants
      SET is_active = false
      WHERE user_id = (SELECT id FROM public.users WHERE username = 'integration-user')
        AND tenant_id = (SELECT id FROM public.tenants WHERE tenant_key = 'demo')
    `);
    const revokedDemoMembership = await fetch(`${baseUrl}/demo/api/apps`, { headers: { cookie: demoCookie } });
    assert.equal(revokedDemoMembership.status, 403, 'A session must stop working after its demo membership is disabled.');

    const me = await fetch(`${baseUrl}/api/auth/me?tenant_id=fixture`, { headers: { cookie } });
    const meBody = await me.json();
    assert.equal(me.status, 200, `Authenticated user lookup failed: ${JSON.stringify(meBody)}`);
    assert.equal(meBody.user.username, 'integration-user');

    const apps = await fetch(`${baseUrl}/api/apps?tenant_id=fixture`, { headers: { cookie } });
    const appsBody = await apps.json();
    assert.equal(apps.status, 200, `Tenant application routing failed: ${JSON.stringify(appsBody)}`);
    assert.equal(appsBody.success, true);
    assert.ok(appsBody.apps.some(app => app.app_key === 'fixture-app'));

    const tenantContext = await fetch(
      `${baseUrl}/api/tenant-context?tenant_id=fixture&tenant_path=%2Ffixture`
    );
    const tenantContextBody = await tenantContext.json();
    assert.equal(tenantContext.status, 200);
    assert.equal(tenantContextBody.tenant.resolvedTenantId, 'fixture');
    assert.equal(tenantContextBody.tenant.dbName, new URL(tenantUrl).pathname.replace(/^\//, ''));
    assert.equal(tenantContext.headers.get('x-resolved-tenant-id'), 'fixture');
    assert.equal(tenantContext.headers.get('x-resolved-db-name'), new URL(tenantUrl).pathname.replace(/^\//, ''));

    const demoTenantContext = await fetch(`${baseUrl}/demo/api/tenant-context?tenant_id=demo&tenant_path=%2Fdemo`);
    const demoTenantContextBody = await demoTenantContext.json();
    assert.equal(demoTenantContext.status, 200);
    assert.equal(demoTenantContextBody.tenant.resolvedTenantId, 'demo');
    assert.equal(demoTenantContextBody.tenant.dbName, new URL(tenantUrl).pathname.replace(/^\//, ''));
    assert.equal(demoTenantContext.headers.get('x-resolved-tenant-id'), 'demo');
    assert.equal(demoTenantContext.headers.get('x-resolved-db-name'), new URL(tenantUrl).pathname.replace(/^\//, ''));
    assert.equal(demoTenantContextBody.tenant.tenantPath, '/demo');

    const unknownTenant = await fetch(`${baseUrl}/api/tenant-context?tenant_id=not-registered`);
    const unknownTenantBody = await unknownTenant.json();
    assert.equal(unknownTenant.status, 503);
    assert.match(unknownTenantBody.error, /Tenant not registered: not-registered/);
    assert.equal(unknownTenant.headers.get('x-resolved-tenant-id'), null);

    const dedicatedDemoLoginPage = await fetch(`${baseUrl}/demo/`);
    const dedicatedDemoLoginHtml = await dedicatedDemoLoginPage.text();
    assert.match(dedicatedDemoLoginHtml, /id="login-form"/, 'The dedicated demo URL must render the login form.');
    assert.match(dedicatedDemoLoginHtml, /tenant-context\.js/, 'The dedicated login page must load tenant context.');
    const dedicatedDemoDashboardPage = await fetch(`${baseUrl}/demo/index.html`);
    const dedicatedDemoDashboardHtml = await dedicatedDemoDashboardPage.text();
    assert.match(dedicatedDemoDashboardHtml, /app\.js/, 'The dedicated dashboard URL must render the app entrypoint.');

    const staticPaths = [
      '/',
      '/index.html',
      '/demo/',
      '/demo/index.html',
      '/demo/login.html',
      '/demo/login.css',
      '/demo/login.js',
      '/demo/tenant-context.js',
      '/demo/style.css',
      '/demo/app.js',
      '/demo/assets/img/recovery.png',
      '/fixture/index.html',
      '/login.html',
      '/login.css',
      '/login.js',
      '/index.html',
      '/style.css',
      '/app.js',
      '/tenant-context.js',
      '/admin.html',
      '/admin.css',
      '/admin.js',
      '/assets/img/recovery.png',
      '/fixture/assets/img/recovery.png',
      '/fixture/login.html',
      '/fixture/login.css',
      '/fixture/app.js',
      '/fixture/admin.js'
    ];
    for (const staticPath of staticPaths) {
      const response = await fetch(`${baseUrl}${staticPath}`);
      assert.equal(response.status, 200, `Expected public asset ${staticPath} to load.`);
    }

    for (const privatePath of [
      '/server.js',
      '/package.json',
      '/README.md',
      '/db/migrations/common/001_core.sql',
      '/docs/MIGRATION_REPORT.md',
      '/.env'
    ]) {
      const response = await fetch(`${baseUrl}${privatePath}`);
      assert.equal(response.status, 404, `Private project file ${privatePath} must not be publicly served.`);
    }
  } finally {
    server.kill('SIGTERM');
    const exited = await Promise.race([serverExit.then(([code, signal]) => ({ code, signal })), delay(10000).then(() => null)]);
    if (!exited) {
      server.kill('SIGKILL');
      await serverExit;
    }
    await commonPool.end();
    await fixtureTenantPool.end();
    if (exited && exited.code !== 0 && exited.signal !== 'SIGTERM') {
      throw new Error(`Application shutdown failed (${exited.code}; ${exited.signal}):\n${output}`);
    }
  }
}

async function main() {
  const adminUrl = localAdminConnection();
  const adminPool = new Pool({ connectionString: adminUrl, max: 1 });
  const pools = [];
  try {
    console.log('Creating four disposable PostgreSQL databases.');
    for (const databaseName of databaseNames) await createDatabase(adminPool, databaseName);
    const urls = Object.fromEntries(databaseNames.map(name => [name, connectionForDatabase(adminUrl, name)]));
    const [newCommon, newTenant, oldCommon, oldTenant] = databaseNames.map(name => {
      const pool = new Pool({ connectionString: urls[name], max: 2 });
      pools.push(pool);
      return pool;
    });

    console.log('Migrating and rerunning empty common and tenant databases.');
    runCli(['--scope', 'common'], urls[databaseNames[0]]);
    runCli(['--scope', 'tenant', '--database', databaseNames[1]], urls[databaseNames[0]]);
    runCli(['--scope', 'common'], urls[databaseNames[0]]);
    runCli(['--scope', 'tenant', '--database', databaseNames[1]], urls[databaseNames[0]]);
    await verifyFreshSchemas(newCommon, newTenant);
    runCli([
      '--tenant-key', 'fresh-fixture',
      '--db-name', 'fresh_fixture_db',
      '--app-id', 'dashboard-ui',
      '--app-name', 'Dashboard',
      '--app-url', 'http://localhost:8080'
    ], urls[databaseNames[0]]);
    runCli([
      '--tenant-key', 'fresh-fixture',
      '--db-name', 'fresh_fixture_db',
      '--app-id', 'dashboard-ui',
      '--app-name', 'Dashboard',
      '--app-url', 'http://localhost:8080'
    ], urls[databaseNames[0]]);
    runCliExpectFailure([
      '--tenant-key', 'fresh-fixture',
      '--db-name', 'fresh_fixture_db',
      '--app-id', 'dashboard-ui',
      '--app-name', 'Changed Dashboard',
      '--app-url', 'http://localhost:8080'
    ], urls[databaseNames[0]], /already exists with different settings/);
    const registeredRoute = await newCommon.query(`
      SELECT database_url, database_key, db_name, app_name, app_url
      FROM public.tenant_app_routings
      WHERE tenant_key = 'fresh-fixture' AND app_id = 'dashboard-ui'
    `);
    assert.equal(registeredRoute.rowCount, 1);
    assert.equal(registeredRoute.rows[0].database_url, null);
    assert.equal(registeredRoute.rows[0].database_key, 'FRESH-FIXTURE');
    assert.equal(registeredRoute.rows[0].app_name, 'Dashboard');

    // Public ID lifecycle: strong, stable across reruns, rotation retires without reuse, retired IDs cannot be revived.
    const issued = await newCommon.query("SELECT public_id FROM public.tenant_public_ids WHERE tenant_key = 'fresh-fixture' AND is_active");
    assert.equal(issued.rowCount, 1);
    assert.match(issued.rows[0].public_id, /^t[0-9a-f]{36}$/);
    runCli(['--rotate-public-id', '--tenant-key', 'fresh-fixture', '--reason', 'workflow check'], urls[databaseNames[0]]);
    const rotated = await newCommon.query("SELECT public_id, is_active FROM public.tenant_public_ids WHERE tenant_key = 'fresh-fixture' ORDER BY id");
    assert.equal(rotated.rowCount, 2);
    assert.equal(rotated.rows[0].is_active, false);
    assert.equal(rotated.rows[1].is_active, true);
    assert.notEqual(rotated.rows[0].public_id, rotated.rows[1].public_id);
    await assert.rejects(newCommon.query("UPDATE public.tenant_public_ids SET is_active = true WHERE public_id = $1", [rotated.rows[0].public_id]), /cannot be reactivated/);
    await assert.rejects(newCommon.query("INSERT INTO public.tenant_public_ids (tenant_key, public_id) VALUES ('fresh-fixture', 'tweakweakweakweakweak')"), /128 random bits/);
    runCli(['--scope', 'common'], urls[databaseNames[0]]);
    const afterRerun = await newCommon.query("SELECT count(*) AS n FROM public.tenant_public_ids WHERE tenant_key = 'fresh-fixture'");
    assert.equal(Number(afterRerun.rows[0].n), 2);

    console.log('Preparing a legacy common schema and verifying a structural baseline.');
    await createLegacyCommonFixture(oldCommon);
    runCliExpectFailure(['--scope', 'common'], urls[databaseNames[2]], /has no dashboard migration history/);
    const refusedHistory = await oldCommon.query("SELECT to_regclass('public.dashboard_schema_migrations') AS history");
    assert.equal(refusedHistory.rows[0].history, null);
    await oldCommon.query(`
      UPDATE public.applications
      SET app_name = 'Operator-owned app name', app_url = 'https://operator.invalid/app'
      WHERE app_key = 'fixture-app';
      UPDATE public.tenant_applications
      SET is_enabled = false
      WHERE tenant_id = (SELECT id FROM public.tenants WHERE tenant_key = 'fixture');
      UPDATE public.user_tenants
      SET is_active = false
      WHERE user_id = '10000000-0000-0000-0000-000000000002';
    `);
    runCli(['--scope', 'common', '--baseline'], urls[databaseNames[2]]);
    runCli(['--scope', 'common'], urls[databaseNames[2]]);
    runCli(['--scope', 'common'], urls[databaseNames[2]]);

    console.log('Preparing a legacy tenant schema and verifying its baseline.');
    await createLegacyTenantFixture(oldTenant);
    runCli(['--scope', 'tenant', '--baseline'], urls[databaseNames[3]]);
    runCli(['--scope', 'tenant'], urls[databaseNames[3]]);
    runCli(['--scope', 'tenant'], urls[databaseNames[3]]);
    await verifyLegacyPreservation(oldCommon, oldTenant);

    console.log('Checking retained data and preparing application login fixtures.');
    const passwordHash = await bcrypt.hash('fixture-password', 4);
    await oldCommon.query(`
      INSERT INTO public.users (id, username, password_hash, display_name, role)
      VALUES ('30000000-0000-0000-0000-000000000001', 'integration-user', $1, 'Integration User', 'tenant_admin')
    `, [passwordHash]);
    await oldCommon.query(`
      INSERT INTO public.user_tenants (user_id, tenant_id, is_active)
      VALUES ('30000000-0000-0000-0000-000000000001',
        (SELECT id FROM public.tenants WHERE tenant_key = 'fixture'), true)
    `);
    await oldCommon.query(`
      INSERT INTO public.user_roles (user_id, tenant_id, role_id)
      VALUES ('30000000-0000-0000-0000-000000000001',
        (SELECT id FROM public.tenants WHERE tenant_key = 'fixture'),
        (SELECT id FROM public.roles WHERE role_key = 'tenant_admin' LIMIT 1))
    `);
    await oldCommon.query(`
      UPDATE public.tenant_app_routings
      SET database_key = 'FIXTURE', db_name = $1
      WHERE tenant_key = 'fixture'
    `, [databaseNames[3]]);
    await oldCommon.query(`
      INSERT INTO public.tenants (id, tenant_key, tenant_name)
      VALUES ('40000000-0000-0000-0000-000000000001', 'demo', 'Demo tenant')
    `);
    await oldCommon.query(`
      INSERT INTO public.user_tenants (user_id, tenant_id, is_active)
      VALUES (
        '30000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        true
      )
    `);
    await oldCommon.query(`
      INSERT INTO public.user_roles (user_id, tenant_id, role_id)
      VALUES (
        '30000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        (SELECT id FROM public.roles WHERE role_key = 'tenant_admin' LIMIT 1)
      )
    `);
    await oldCommon.query(`
      INSERT INTO public.tenant_app_routings
        (tenant_key, app_id, tenant_id, tenant_name, database_key, db_name,
         tenant_path, app_name, app_url, is_active, is_visible)
      VALUES ('demo', 'dashboard-ui', 'demo', 'Demo tenant', 'DEMO', $1,
        '/', 'Dashboard', 'http://localhost:8080', true, true)
    `, [databaseNames[3]]);
    await oldCommon.query(`
      INSERT INTO public.permissions (id, permission_key, permission_name, code, description)
      VALUES ('50000000-0000-0000-0000-000000000001',
        'workflow-demo-session', 'Workflow demo session permission',
        'workflow-demo-session', 'Disposable workflow authorization check')
    `);
    await oldCommon.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (
        (SELECT id FROM public.roles WHERE role_key = 'tenant_admin' LIMIT 1),
        '50000000-0000-0000-0000-000000000001'
      )
    `);
    runCli(['--status', '--scope', 'common'], urls[databaseNames[2]]);
    console.log('Starting the application against the disposable common and tenant DBs.');
    await startAndCheckApplication(urls[databaseNames[2]], urls[databaseNames[3]]);
    console.log('PASS: fresh build, verified legacy baselines, additive upgrades, reruns, data preservation, root/dedicated demo URL auth/routing, membership/permission isolation, unknown-tenant isolation, and public assets.');
  } finally {
    await Promise.all(pools.map(pool => pool.end().catch(() => undefined)));
    for (const databaseName of [...createdDatabases]) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(error => {
        console.error(`Failed to drop disposable database ${databaseName}: ${error.message}`);
        process.exitCode = 1;
      });
    }
    await adminPool.end();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
