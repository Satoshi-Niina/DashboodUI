const pool = require('./shared-db-config');

async function fix() {
    try {
        console.log('--- STARTING SCORCHED EARTH DATABASE FIX v2 ---');

        const schemas = ['master_data', 'public'];

        for (const schema of schemas) {
            console.log(`\nProcessing schema: ${schema}`);

            // 0. 外部キーを削除して型変更を可能にする
            console.log(`  Dropping potential FKs in ${schema}...`);
            await pool.query(`ALTER TABLE ${schema}.machines DROP CONSTRAINT IF EXISTS machines_machine_type_id_fkey CASCADE`);
            await pool.query(`ALTER TABLE ${schema}.machines DROP CONSTRAINT IF EXISTS machines_machine_type_fkey CASCADE`);

            // 1. machine_types
            console.log(`  Fixing ${schema}.machine_types...`);
            // id を TEXT に変更 (既存データがある場合は CAST)
            await pool.query(`ALTER TABLE ${schema}.machine_types ALTER COLUMN id TYPE TEXT USING id::text`);

            // 不要なユニーク制約を全部消す
            const constraints = await pool.query(`
        SELECT conname FROM pg_constraint con 
        JOIN pg_class rel ON rel.oid = con.conrelid 
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
        WHERE nsp.nspname = $1 AND rel.relname = 'machine_types' AND contype IN ('u', 'p')
      `, [schema]);
            for (const row of constraints.rows) {
                // PKEYも一回消してTEXT属性で作り直す必要があるかもしれないが、まずはUNIQUEのみ消す
                if (row.conname.includes('_key')) {
                    await pool.query(`ALTER TABLE ${schema}.machine_types DROP CONSTRAINT IF EXISTS "${row.conname}" CASCADE`);
                    console.log(`    Dropped constraint: ${row.conname}`);
                }
            }
            // インデックスも徹底的に消す
            await pool.query(`DROP INDEX IF EXISTS ${schema}.idx_machine_types_name`);
            await pool.query(`DROP INDEX IF EXISTS ${schema}.machine_types_type_name_idx`);
            await pool.query(`DROP INDEX IF EXISTS ${schema}.machine_types_machine_type_name_key`);

            // 2. machines
            console.log(`  Fixing ${schema}.machines...`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS type_certification TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS office_id TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS id TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN id TYPE TEXT USING id::text`);
            await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN machine_type_id TYPE TEXT USING machine_type_id::text`);

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
            await pool.query(`DROP INDEX IF EXISTS ${schema}.machines_machine_number_key`);
        }

        console.log('\n--- ROUTING RE-SYNC ---');
        await pool.query(`
      INSERT INTO public.app_resource_routing (app_id, logical_resource_name, physical_schema, physical_table, resource_type, is_active)
      VALUES 
        ('dashboard-ui', 'machines', 'master_data', 'machines', 'table', true),
        ('dashboard-ui', 'machine_types', 'master_data', 'machine_types', 'table', true)
      ON CONFLICT (app_id, logical_resource_name) 
      DO UPDATE SET physical_schema = EXCLUDED.physical_schema, physical_table = EXCLUDED.physical_table;
    `);

        console.log('\n✅ DATABASE FIX v2 COMPLETED.');

    } catch (err) {
        console.error('❌ FIX FAILED:', err);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

fix();
