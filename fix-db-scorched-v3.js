const pool = require('./shared-db-config');

async function fix() {
    try {
        console.log('--- STARTING SCORCHED EARTH DATABASE FIX v3 ---');

        // 1. 全ての外部キーを一旦全滅させる（machine_types / machines 関連）
        console.log('  Killing all FKs referencing machines/machine_types...');
        await pool.query(`
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (
              SELECT 'ALTER TABLE "' || n.nspname || '"."' || c.relname || '" DROP CONSTRAINT IF EXISTS "' || con.conname || '" CASCADE' as cmd
              FROM pg_constraint con
              JOIN pg_class c ON c.oid = con.conrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE con.confrelid IN (
                  SELECT oid FROM pg_class WHERE relname IN ('machines', 'machine_types')
              )
          ) LOOP
              EXECUTE r.cmd;
          END LOOP;
      END $$;
    `);

        const schemas = ['master_data', 'public'];

        for (const schema of schemas) {
            console.log(`\nProcessing schema: ${schema}`);

            // 2. machine_types の修正
            console.log(`  Fixing ${schema}.machine_types...`);
            // 型変更
            await pool.query(`ALTER TABLE ${schema}.machine_types ALTER COLUMN id TYPE TEXT USING id::text`);

            // ユニーク制約/インデックスの徹底削除 (PKEY以外)
            await pool.query(`
        DO $$ 
        DECLARE 
            r RECORD;
        BEGIN
            -- 制約の削除
            FOR r IN (
                SELECT conname FROM pg_constraint con 
                JOIN pg_class rel ON rel.oid = con.conrelid 
                JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
                WHERE nsp.nspname = '${schema}' AND rel.relname = 'machine_types' AND contype = 'u'
            ) LOOP
                EXECUTE 'ALTER TABLE ${schema}.machine_types DROP CONSTRAINT IF EXISTS "' || r.conname || '" CASCADE';
            END LOOP;
            
            -- インデックスの削除
            FOR r IN (
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = '${schema}' AND tablename = 'machine_types' AND indexname NOT LIKE '%_pkey'
            ) LOOP
                EXECUTE 'DROP INDEX IF EXISTS ${schema}."' || r.indexname || '" CASCADE';
            END LOOP;
        END $$;
      `);

            // 3. machines の修正
            console.log(`  Fixing ${schema}.machines...`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS type_certification TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ADD COLUMN IF NOT EXISTS office_id TEXT`);
            await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN id TYPE TEXT USING id::text`);
            await pool.query(`ALTER TABLE ${schema}.machines ALTER COLUMN machine_type_id TYPE TEXT USING machine_type_id::text`);

            // ユニーク制約/インデックスの徹底削除 (PKEY以外)
            await pool.query(`
        DO $$ 
        DECLARE 
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT conname FROM pg_constraint con 
                JOIN pg_class rel ON rel.oid = con.conrelid 
                JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
                WHERE nsp.nspname = '${schema}' AND rel.relname = 'machines' AND contype = 'u'
            ) LOOP
                EXECUTE 'ALTER TABLE ${schema}.machines DROP CONSTRAINT IF EXISTS "' || r.conname || '" CASCADE';
            END LOOP;
            
            FOR r IN (
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = '${schema}' AND tablename = 'machines' AND indexname NOT LIKE '%_pkey'
            ) LOOP
                EXECUTE 'DROP INDEX IF EXISTS ${schema}."' || r.indexname || '" CASCADE';
            END LOOP;
        END $$;
      `);
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

        console.log('\n✅ DATABASE FIX v3 COMPLETED.');

    } catch (err) {
        console.error('❌ FIX FAILED:', err);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

fix();
