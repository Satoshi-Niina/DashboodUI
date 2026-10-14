const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config();

const MIGRATIONS_ROOT = path.join(__dirname, '..', 'db', 'migrations');
const SCOPES = new Set(['common', 'tenant']);
const BASELINE_VERSION = { common: '000_legacy_anchor', tenant: '000_legacy_anchor' };

function parseArgs(args) {
  const options = { scope: null, baseline: false, status: false, help: false, tenantKey: null, dbName: null, database: null, appId: null, appName: null, appUrl: null, reason: null, listPublicIds: false, rotatePublicId: false, retirePublicId: false };
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (value === '--scope' || value === '--tenant-key' || value === '--db-name' || value === '--database' || value === '--app-id' || value === '--app-name' || value === '--app-url' || value === '--reason') {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) throw new Error(`Missing value for ${value}`);
      i += 1;
      if (value === '--scope') options.scope = next;
      if (value === '--tenant-key') options.tenantKey = next;
      if (value === '--db-name') options.dbName = next;
      if (value === '--database') options.database = next;
      if (value === '--app-id') options.appId = next;
      if (value === '--app-name') options.appName = next;
      if (value === '--app-url') options.appUrl = next;
      if (value === '--reason') options.reason = next;
    } else if (value === '--baseline') options.baseline = true;
    else if (value === '--status') options.status = true;
    else if (value === '--list-public-ids') options.listPublicIds = true;
    else if (value === '--rotate-public-id') options.rotatePublicId = true;
    else if (value === '--retire-public-id') options.retirePublicId = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function getMigrationFiles(scope) {
  if (!SCOPES.has(scope)) throw new Error('Scope must be "common" or "tenant".');
  const directory = path.join(MIGRATIONS_ROOT, scope);
  return fs.readdirSync(directory)
    .filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map(name => {
      const filePath = path.join(directory, name);
      const sql = fs.readFileSync(filePath, 'utf8');
      const verifyPath = filePath.replace(/\.sql$/, '.verify.sql');
      if (!fs.existsSync(verifyPath)) throw new Error(`Missing schema verifier: ${path.relative(process.cwd(), verifyPath)}`);
      return {
        version: name.replace(/\.sql$/, ''),
        name,
        sql,
        verifySql: fs.readFileSync(verifyPath, 'utf8'),
        baselineVerifySql: fs.existsSync(filePath.replace(/\.sql$/, '.baseline.verify.sql'))
          ? fs.readFileSync(filePath.replace(/\.sql$/, '.baseline.verify.sql'), 'utf8')
          : null,
        checksum: crypto.createHash('sha256').update(sql).digest('hex')
      };
    });
}

function makePool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  }
  const host = process.env.DB_HOST || process.env.PGHOST;
  const user = process.env.DB_USER || process.env.PGUSER;
  const database = process.env.DB_NAME || process.env.PGDATABASE;
  if (!host || !user || !database) {
    throw new Error('Set DATABASE_URL or DB_HOST, DB_USER, and DB_NAME in the environment.');
  }
  return new Pool({
    host,
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    user,
    password: process.env.DB_PASSWORD || undefined,
    database,
    max: 2
  });
}

async function hasMigrationTable(client) {
  const result = await client.query("SELECT to_regclass('public.dashboard_schema_migrations') IS NOT NULL AS exists");
  return result.rows[0].exists;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dashboard_schema_migrations (
      version varchar(100) PRIMARY KEY,
      name varchar(255) NOT NULL,
      checksum char(64) NOT NULL,
      execution_type varchar(20) NOT NULL CHECK (execution_type IN ('migration', 'baseline')),
      applied_at timestamptz NOT NULL DEFAULT now(),
      applied_by varchar(255) NOT NULL DEFAULT current_user
    )
  `);
}

async function runVerifier(client, migration, verifySql = migration.verifySql) {
  const result = await client.query(verifySql);
  if (!result.rows[0] || result.rows[0].ok !== true) {
    throw new Error(`Schema verification failed for ${migration.version}. Inspect the target schema; no baseline was recorded.`);
  }
}

async function hasApplicationTables(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND c.relkind IN ('r', 'p')
        AND NOT (n.nspname = 'public' AND c.relname = 'dashboard_schema_migrations')
    ) AS exists
  `);
  return result.rows[0].exists;
}

async function readHistory(client) {
  if (!await hasMigrationTable(client)) return new Map();
  const result = await client.query(`
    SELECT version, name, checksum, execution_type
    FROM public.dashboard_schema_migrations
    ORDER BY version
  `);
  return new Map(result.rows.map(row => [row.version, row]));
}

async function migrationStatus(client, scope) {
  const migrations = getMigrationFiles(scope);
  const exists = await hasMigrationTable(client);
  const history = await readHistory(client);
  return {
    historyExists: exists,
    hasApplicationTables: await hasApplicationTables(client),
    migrations: migrations.map(migration => {
      const applied = history.get(migration.version);
      return {
        version: migration.version,
        applied: Boolean(applied),
        executionType: applied && applied.execution_type,
        checksumMatches: Boolean(applied && applied.checksum.trim() === migration.checksum)
      };
    })
  };
}

async function baseline(client, scope) {
  const migrations = getMigrationFiles(scope);
  const baseline = migrations.find(migration => migration.version === BASELINE_VERSION[scope]);
  if (!baseline) throw new Error(`Baseline migration is not defined for ${scope}.`);
  if (await hasMigrationTable(client)) {
    const history = await readHistory(client);
    if (history.size > 0) throw new Error('Baseline refused: migration history already contains entries.');
  }
  if (!baseline.baselineVerifySql) throw new Error(`Missing baseline verifier for ${scope}; no baseline was recorded.`);
  await runVerifier(client, baseline, baseline.baselineVerifySql);

  await client.query('BEGIN');
  try {
    await ensureMigrationTable(client);
    await client.query(`
      INSERT INTO public.dashboard_schema_migrations (version, name, checksum, execution_type)
      VALUES ($1, $2, $3, 'baseline')
    `, [baseline.version, baseline.name, baseline.checksum]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  console.log(`Baselined ${scope} schema at ${baseline.version} after structural verification.`);
  console.log('The remaining migrations, if any, still require the normal migrate command.');
}

async function migrate(client, scope) {
  const migrations = getMigrationFiles(scope);
  const historyExists = await hasMigrationTable(client);
  const history = await readHistory(client);
  if (!historyExists && await hasApplicationTables(client)) {
    throw new Error(`Existing ${scope} schema has no dashboard migration history. Inspect it, run "npm run db:baseline -- --scope ${scope}" to verify and register the core baseline, then rerun db:migrate. No migration was applied.`);
  }
  if (historyExists && history.size === 0 && await hasApplicationTables(client)) {
    throw new Error(`Existing ${scope} schema has an empty dashboard migration history. Verify its structure and use "npm run db:baseline -- --scope ${scope}". No migration was applied.`);
  }

  await ensureMigrationTable(client);
  for (const migration of migrations) {
    const applied = history.get(migration.version);
    if (applied) {
      if (applied.checksum.trim() !== migration.checksum) {
        throw new Error(`Checksum mismatch for applied migration ${migration.version}. Restore the original file or add a new migration; do not edit applied history.`);
      }
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL search_path TO public, master_data');
      await client.query(migration.sql);
      await runVerifier(client, migration);
      await client.query(`
        INSERT INTO public.dashboard_schema_migrations (version, name, checksum, execution_type)
        VALUES ($1, $2, $3, 'migration')
      `, [migration.version, migration.name, migration.checksum]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${migration.version} failed and was rolled back: ${error.message}`);
    }
    history.set(migration.version, migration);
    console.log(`Applied ${scope} migration ${migration.version}.`);
  }
}

async function assertApplied(client, scope) {
  const migrations = getMigrationFiles(scope);
  const status = await migrationStatus(client, scope);
  const missing = status.migrations.filter(migration => !migration.applied);
  const changed = status.migrations.filter(migration => migration.applied && !migration.checksumMatches);
  if (!status.historyExists || missing.length || changed.length) {
    const existingSchema = status.hasApplicationTables;
    const command = existingSchema
      ? `npm run db:baseline -- --scope ${scope}, then npm run db:migrate -- --scope ${scope}`
      : `npm run db:migrate -- --scope ${scope}`;
    const reason = !status.historyExists || status.migrations.every(migration => !migration.applied)
      ? `No verified ${scope} migration history exists.`
      : `The ${scope} database has unapplied or changed migrations.`;
    throw new Error(`${reason} Verify this database and run "${command}".`);
  }
  for (const migration of migrations) await runVerifier(client, migration);
}

function printStatus(status, scope) {
  console.log(`${scope} schema: ${status.historyExists ? 'history present' : 'no history'}; ${status.hasApplicationTables ? 'non-empty schema' : 'empty schema'}`);
  if (status.migrations.length === 0) console.log('No migration files found.');
  for (const migration of status.migrations) {
    const state = !migration.applied ? 'pending' : migration.checksumMatches ? migration.executionType : 'CHECKSUM MISMATCH';
    console.log(`  ${migration.version}: ${state}`);
  }
}

function requiredOption(value, flag) {
  if (!value) throw new Error(`Missing required option ${flag}`);
  return value;
}

// 144-bit URL identifier from the OS CSPRNG (the SQL generator in migration 005 yields the same strength).
function generatePublicTenantId() {
  return `t${crypto.randomBytes(18).toString('hex')}`;
}

async function ensurePublicTenantId(client, tenantKey) {
  await client.query(`
    INSERT INTO public.tenant_public_ids (tenant_key, public_id)
    VALUES ($1, $2)
    ON CONFLICT (tenant_key) WHERE is_active DO NOTHING
  `, [tenantKey, generatePublicTenantId()]);
  const result = await client.query('SELECT public_id FROM public.tenant_public_ids WHERE tenant_key = $1 AND is_active', [tenantKey]);
  console.log(`Public tenant ID for ${tenantKey}: ${result.rows[0].public_id}`);
}

async function listPublicIds(client) {
  await assertApplied(client, 'common');
  const result = await client.query(`
    SELECT tenant_key, public_id, is_active, retired_at, retired_reason
    FROM public.tenant_public_ids ORDER BY tenant_key, id
  `);
  for (const row of result.rows) {
    const state = row.is_active ? 'active' : `retired ${row.retired_at ? row.retired_at.toISOString() : ''} (${row.retired_reason || 'no reason'})`;
    console.log(`${row.tenant_key}: ${row.public_id} [${state}]`);
  }
}

// Retires the active public ID (old URLs stop resolving) and optionally issues a replacement.
async function changePublicId(client, options, issueReplacement) {
  const tenantKey = requiredOption(options.tenantKey, '--tenant-key').trim().toLowerCase();
  const reason = requiredOption(options.reason, '--reason').trim();
  await assertApplied(client, 'common');
  await client.query('BEGIN');
  try {
    const retired = await client.query(`
      UPDATE public.tenant_public_ids
         SET is_active = false, retired_at = now(), retired_reason = $2
       WHERE tenant_key = $1 AND is_active
      RETURNING public_id
    `, [tenantKey, reason]);
    if (!retired.rowCount) throw new Error(`No active public ID exists for tenant ${tenantKey}.`);
    console.log(`Retired public tenant ID for ${tenantKey}: ${retired.rows[0].public_id}`);
    if (issueReplacement) {
      await ensurePublicTenantId(client, tenantKey);
    } else {
      console.log('No replacement was issued; this tenant is unreachable by public URL until one is issued.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
async function registerTenant(client, options) {
  const tenantKey = requiredOption(options.tenantKey, '--tenant-key').trim().toLowerCase();
  const dbName = requiredOption(options.dbName, '--db-name').trim();
  const appId = requiredOption(options.appId, '--app-id').trim().toLowerCase();
  const appName = requiredOption(options.appName, '--app-name').trim();
  const appUrl = requiredOption(options.appUrl, '--app-url').trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(tenantKey)) throw new Error('Tenant key must contain only lowercase letters, digits, "_" or "-".');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(dbName)) throw new Error('Database name contains unsupported characters.');
  if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(appId)) throw new Error('App id must contain only lowercase letters, digits, "_" or "-".');
  let parsedUrl;
  try {
    parsedUrl = new URL(appUrl);
  } catch (_) {
    throw new Error('--app-url must be an absolute HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error('--app-url must be an HTTP(S) URL without credentials, query, or fragment.');
  }
  await assertApplied(client, 'common');
  const existing = await client.query(`
    SELECT db_name, database_key, database_url, app_name, app_url
    FROM public.tenant_app_routings
    WHERE lower(tenant_key) = $1 AND lower(app_id) = $2
    LIMIT 1
  `, [tenantKey, appId]);
  if (existing.rowCount) {
    const route = existing.rows[0];
    if (route.db_name === dbName
      && route.database_key === tenantKey.toUpperCase()
      && route.app_name === appName
      && route.app_url === parsedUrl.toString()) {
      console.log(`Route ${tenantKey}/${appId} already exists; no values were changed.`);
            await ensurePublicTenantId(client, tenantKey);
            return;
    }
    throw new Error(`Route ${tenantKey}/${appId} already exists with different settings. Review it manually; no values were changed.`);
  }
  await client.query(`
    INSERT INTO public.tenant_app_routings
      (tenant_key, app_id, tenant_id, tenant_name, database_key, db_name,
       tenant_path, app_name, app_url, is_active, is_visible)
    VALUES ($1, $2, $1, $1, $3, $4, $5, $6, $7, true, true)
  `, [tenantKey, appId, tenantKey.toUpperCase(), dbName, `/${tenantKey}`, appName, parsedUrl.toString()]);
  console.log(`Registered ${tenantKey}/${appId} -> ${dbName}.`);
  await ensurePublicTenantId(client, tenantKey);
  console.log(`Configure TENANT_DB_${tenantKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_URL or TENANT_DB_${tenantKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_NAME in the app environment.`);
}

function printHelp() {
  console.log([
    'Usage:',
    '  npm run db:migrate -- --scope common|tenant',
    '  npm run db:baseline -- --scope common|tenant',
    '  npm run db:status -- --scope common|tenant',
    '  node scripts/db-migrate.js --scope tenant --database DATABASE_NAME',
    '  node scripts/db-migrate.js --list-public-ids',
    '  node scripts/db-migrate.js --rotate-public-id --tenant-key KEY --reason TEXT',
    '  node scripts/db-migrate.js --retire-public-id --tenant-key KEY --reason TEXT',
    '  npm run db:register-tenant -- --tenant-key KEY --db-name NAME --app-id ID --app-name NAME --app-url URL',
    '',
    'The target database is selected by DATABASE_URL (or DB_HOST/DB_USER/DB_NAME).',
    'Baseline verifies the scope core schema before recording it; it never marks a missing schema as applied.'
  ].join('\n'));
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) return printHelp();
    if (options.database && (options.appId || options.appName || options.appUrl || options.tenantKey || options.dbName)) {
      throw new Error('--database cannot be combined with tenant route registration options.');
    }
    if (options.database) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(options.database)) {
        throw new Error('--database must be a valid PostgreSQL database name.');
      }
      if (process.env.DATABASE_URL) {
        const targetUrl = new URL(process.env.DATABASE_URL);
        targetUrl.pathname = `/${options.database}`;
        process.env.DATABASE_URL = targetUrl.toString();
      } else {
        process.env.DB_NAME = options.database;
      }
    }
    if (options.listPublicIds || options.rotatePublicId || options.retirePublicId) {
      if (options.baseline || options.status || options.scope || options.appId || options.appName || options.appUrl || options.dbName) {
        throw new Error('Public ID commands cannot be combined with scope, baseline, status, or route registration options.');
      }
      const pool = makePool();
      try {
        if (options.listPublicIds) await listPublicIds(pool);
        else {
          const client = await pool.connect();
          try {
            await changePublicId(client, options, options.rotatePublicId);
          } finally {
            client.release();
          }
        }
      } finally {
        await pool.end();
      }
      return;
    }
    if (options.appId || options.appName || options.appUrl || options.tenantKey || options.dbName) {
      if (options.baseline || options.status || options.scope) throw new Error('db:register-tenant cannot be combined with --scope, --baseline, or --status.');
      const pool = makePool();
      try {
        await registerTenant(pool, options);
      } finally {
        await pool.end();
      }
      return;
    }
    const scope = requiredOption(options.scope, '--scope');
    if (!SCOPES.has(scope)) throw new Error('--scope must be "common" or "tenant".');
    const pool = makePool();
    try {
      const client = await pool.connect();
      try {
        if (options.status) printStatus(await migrationStatus(client, scope), scope);
        else if (options.baseline) await baseline(client, scope);
        else await migrate(client, scope);
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error(`Database command failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { assertApplied, getMigrationFiles, migrationStatus, migrate, baseline, registerTenant, parseArgs };
