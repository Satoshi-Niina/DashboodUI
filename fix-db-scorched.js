const pool = require('./shared-db-config');

async function fix() {
    try {
        console.log('--- STARTING SCORCHED EARTH DATABASE FIX ---');

        const schemas = ['master_data', 'public'];

        for (const schema of schemas) {
            console.log(`\nProcessing schema: ${schema}`);

            // 1. machine_types
            console.log(`  Fixing ${schema}.machine_types...`);
            // id を TEXT に変更 (既存データがある場合は CAST)
            await pool.query(`ALTER TABLE ${schema}.machine_types ALTER COLUMN id TYPE TEXT`);
            // 不要なユニーク制約を全部消す
            const constraints = await pool.query(`
        SELECT conname FROM pg_constraint con 
        JOIN pg_class rel ON rel.oid = con.conrelid 
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
        WHERE nsp.nspname = $1 AND rel.relname = 'machine_types' AND contype = 'u'
      `, [schema]);
            for (const row of constraints.rows) {
                await pool.query(`ALTER TABLE ${schema}.machine_types DROP CONSTRAINT IF EXISTS "${row.conname}" CASCADE`);
                console.log(`    Dropped constraint: ${row.conname}`);
            }
            // ユニークインデックスも消す
            await pool.query(`DROP INDEX IF EXISTS ${schema}.idx_machine_types_name`);
            await pool.query(`DROP INDEX IF EXISTS ${schema}.machine_types_type_name_idx`);

            // 2. machines
            console.log(`  Fixing ${schema}.machines...`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS type_certification TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS office_id TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS id TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN id TYPE TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN machine_type_id TYPE TEXT`);

            const mConstraints = await pool.query(`
        SELECT conname FROM pg_constraint con 
        JOIN pg_class rel ON rel.oid = con.conrelid 
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
        WHERE nsp.nspname = $1 AND rel.relname = 'machines' AND contype = 'u'
      `, [schema]);
            for (const row of mConstraints.rows) {
                await pool.query(`ALTER TABLE ${schema}.machines DROP CONSTRAINT IF EXISTS "${row.conname}" CASCADE`);
                console.log(`    Dropped constraint: ${row.conname}`);
            }
        }

        console.log('\n--- ROUTING RE-SYNC ---');
        // ルーティングを master_data に強制
        await pool.query(`
      INSERT INTO public.app_resource_routing (app_id, logical_resource_name, physical_schema, physical_table, resource_type, is_active)
      VALUES 
        ('dashboard-ui', 'machines', 'master_data', 'machines', 'table', true),
        ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', 'table', true)
      ON CONFLICT (app_id, logical_resource_name) 
      DO UPDATE SET physical_schema = EXCLUDED.physical_schema, physical_table = EXCLUDED.physical_table;
    `);
        console.log('✅ Routing synchronized to master_data');

        console.log('\n✅ DATABASE FIX COMPLETED.');

    } catch (err) {
        console.error('❌ FIX FAILED:', err);
    } finally {
        await pool.end();
    }
}

fix();
