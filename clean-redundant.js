const pool = require('./shared-db-config');

async function clean() {
    try {
        console.log('--- CLEANING REDUNDANT PUBLIC TABLES ---');
        // public スキーマにある重複したテーブルを削除して混乱を防ぐ
        await pool.query('DROP TABLE IF EXISTS public.machines CASCADE');
        await pool.query('DROP TABLE IF EXISTS public.machine_types CASCADE');
        console.log('✅ Redundant tables in public schema dropped.');
    } catch (err) {
        console.error('Clean failed:', err);
    } finally {
        await pool.end();
    }
}

clean();
