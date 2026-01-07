const pool = require('./shared-db-config');

const APP_ID = 'dashboard-ui';

async function resolveTablePath(logicalName) {
    try {
        const query = `
      SELECT physical_schema, physical_table
      FROM public.app_resource_routing
      WHERE app_id = $1 AND logical_resource_name = $2
      LIMIT 1
    `;
        const result = await pool.query(query, [APP_ID, logicalName]);

        if (result.rows.length > 0) {
            const { physical_schema, physical_table } = result.rows[0];
            return { fullPath: `${physical_schema}."${physical_table}"`, schema: physical_schema, table: physical_table };
        }
        return { fullPath: `master_data."${logicalName}"`, schema: 'master_data', table: logicalName };
    } catch (err) {
        return { fullPath: `master_data."${logicalName}"`, schema: 'master_data', table: logicalName };
    }
}

async function diagnose() {
    try {
        console.log('=== ROUTING DIAGNOSIS ===');
        const machinesRoute = await resolveTablePath('machines');
        const typesRoute = await resolveTablePath('machine_types');
        console.log('Machines resolves to:', machinesRoute.fullPath);
        console.log('Machine Types resolves to:', typesRoute.fullPath);

        console.log('\n=== TABLES IN DB ===');
        const tables = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('machines', 'machine_types')");
        console.table(tables.rows);

        console.log('\n=== COLUMNS IN RESOLVED MACHINES TABLE ===');
        const mCols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`, [machinesRoute.schema, machinesRoute.table]);
        console.table(mCols.rows);

        console.log('\n=== CONSTRAINTS IN RESOLVED MACHINE_TYPES TABLE ===');
        const tCons = await pool.query(`
      SELECT conname, contype 
      FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid 
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
      WHERE nsp.nspname = $1 AND rel.relname = $2
    `, [typesRoute.schema, typesRoute.table]);
        console.table(tCons.rows);

        console.log('\n=== ROUTING TABLE CONTENT ===');
        const routing = await pool.query("SELECT * FROM public.app_resource_routing WHERE app_id = $1", [APP_ID]);
        console.table(routing.rows);

    } catch (err) {
        console.error('Diagnosis failed:', err);
    } finally {
        await pool.end();
    }
}

diagnose();
