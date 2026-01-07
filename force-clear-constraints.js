const pool = require('./shared-db-config');

async function clearConstraints() {
    try {
        console.log('Force clearing unique constraints on machine_types...');

        // 現在の制約リストを取得
        const res = await pool.query(`
      SELECT conname 
      FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid 
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace 
      WHERE nsp.nspname = 'master_data' 
        AND rel.relname = 'machine_types' 
        AND contype = 'u'
    `);

        for (const row of res.rows) {
            console.log(`Dropping constraint: ${row.conname}`);
            await pool.query(`ALTER TABLE master_data.machine_types DROP CONSTRAINT IF EXISTS "${row.conname}" CASCADE`);
        }

        // さらにインデックス自体も削除を試みる
        await pool.query(`DROP INDEX IF EXISTS master_data.machine_types_type_name_key CASCADE`);
        await pool.query(`DROP INDEX IF EXISTS master_data.idx_machine_types_name CASCADE`);

        console.log('✅ Constraints cleared.');
    } catch (err) {
        console.error('Failed to clear constraints:', err);
    } finally {
        await pool.end();
    }
}

clearConstraints();
