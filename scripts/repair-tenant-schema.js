const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function repairTenantDb(dbName = 'demo_db') {
  const baseConn = process.env.DATABASE_URL;
  if (!baseConn) {
    throw new Error('DATABASE_URL is not set');
  }
  const url = new URL(baseConn);
  url.pathname = `/${dbName}`;

  const pool = new Pool({ connectionString: url.toString() });
  const client = await pool.connect();

  try {
    console.log(`\n[Repair] Checking schema for ${dbName}...`);
    await client.query('BEGIN');

    // 1. Check if public.deprecated_machine_types exists and public.machine_types does not
    const checkMt = await client.query(`
      SELECT 
        to_regclass('public.machine_types') IS NOT NULL AS has_mt,
        to_regclass('public.deprecated_machine_types') IS NOT NULL AS has_dep_mt
    `);
    const { has_mt, has_dep_mt } = checkMt.rows[0];

    if (!has_mt && has_dep_mt) {
      console.log('[Repair] Restoring public.machine_types from public.deprecated_machine_types...');
      await client.query('ALTER TABLE public.deprecated_machine_types RENAME TO machine_types');
      console.log('✅ Restored public.machine_types');
    } else if (has_mt) {
      console.log('ℹ️ public.machine_types already exists');
    } else {
      console.warn('⚠️ Neither public.machine_types nor public.deprecated_machine_types found');
    }

    // 2. Check if public.deprecated_machines exists and public.machines does not
    const checkM = await client.query(`
      SELECT 
        to_regclass('public.machines') IS NOT NULL AS has_m,
        to_regclass('public.deprecated_machines') IS NOT NULL AS has_dep_m
    `);
    const { has_m, has_dep_m } = checkM.rows[0];

    if (!has_m && has_dep_m) {
      console.log('[Repair] Restoring public.machines from public.deprecated_machines...');
      await client.query('ALTER TABLE public.deprecated_machines RENAME TO machines');
      console.log('✅ Restored public.machines');
    } else if (has_m) {
      console.log('ℹ️ public.machines already exists');
    } else {
      console.warn('⚠️ Neither public.machines nor public.deprecated_machines found');
    }

    // 3. Sync into master_data.machine_types if table exists
    const checkMdMt = await client.query(`
      SELECT to_regclass('master_data.machine_types') IS NOT NULL AS has_md_mt
    `);
    if (checkMdMt.rows[0].has_md_mt) {
      const syncMtRes = await client.query(`
        INSERT INTO master_data.machine_types (id, machine_type_name, created_at, updated_at)
        SELECT id, COALESCE(machine_type_name, type_name, model_name, type_code, '標準機種'), COALESCE(created_at, now()), COALESCE(updated_at, now())
        FROM public.machine_types
        ON CONFLICT (id) DO UPDATE
          SET machine_type_name = EXCLUDED.machine_type_name,
              updated_at = EXCLUDED.updated_at
      `);
      console.log(`✅ Synchronized ${syncMtRes.rowCount || 0} machine types into master_data.machine_types`);
    }

    // 4. Sync into master_data.machines if empty
    const checkMdM = await client.query(`
      SELECT to_regclass('master_data.machines') IS NOT NULL AS has_md_m
    `);
    if (checkMdM.rows[0].has_md_m) {
      const syncResult = await client.query(`
        INSERT INTO master_data.machines (id, machine_number, machine_type_id, status, notes, created_at, updated_at)
        SELECT m.id, m.machine_number, m.machine_type_id, COALESCE(m.status, 'active'), m.notes, COALESCE(m.created_at, now()), COALESCE(m.updated_at, now())
        FROM public.machines m
        ON CONFLICT (machine_number) DO UPDATE
          SET machine_type_id = EXCLUDED.machine_type_id,
              status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at
      `);
      console.log(`✅ Synchronized ${syncResult.rowCount || 0} machines into master_data.machines`);
    // 5. Ensure display_code is assigned for all machine_types
    const nullDisplayCodeRes = await client.query(`
      SELECT id FROM public.machine_types WHERE display_code IS NULL ORDER BY created_at, id
    `);
    if (nullDisplayCodeRes.rows.length > 0) {
      console.log(`[Repair] Assigning display_code to ${nullDisplayCodeRes.rows.length} machine types...`);
      const maxCodeRes = await client.query(`
        SELECT COALESCE(MAX(
          CASE 
            WHEN display_code ~ '^MT-[0-9]+$' THEN SUBSTRING(display_code FROM 4)::int
            WHEN display_code ~ '^[0-9]+$' THEN display_code::int
            ELSE 0
          END
        ), 0) AS max_code
        FROM public.machine_types
      `);
      let nextNum = (maxCodeRes.rows[0]?.max_code || 0) + 1;
      for (const row of nullDisplayCodeRes.rows) {
        let code = `MT-${String(nextNum).padStart(4, '0')}`;
        await client.query(`UPDATE public.machine_types SET display_code = $1 WHERE id = $2`, [code, row.id]);
        nextNum++;
      }
      console.log('✅ Assigned display_codes to machine types');
    }

    await client.query('COMMIT');
    console.log(`[Repair] Schema repair committed successfully for ${dbName}.`);

    // Verify
    const verRes = await client.query(`
      SELECT 
        to_regclass('public.machine_types') IS NOT NULL AS mt_ok,
        to_regclass('public.machines') IS NOT NULL AS m_ok,
        (SELECT count(*) FROM public.machine_types) AS mt_count,
        (SELECT count(*) FROM public.machines) AS m_count
    `);
    console.log('[Repair] Verification summary:', verRes.rows[0]);
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Repair] Error repairing ${dbName}:`, err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const targetDb = process.argv[2] || 'demo_db';
  repairTenantDb(targetDb)
    .then(() => {
      console.log('[Repair] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Repair] Failed:', err);
      process.exit(1);
    });
}

module.exports = { repairTenantDb };
