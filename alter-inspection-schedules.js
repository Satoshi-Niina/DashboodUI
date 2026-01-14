
const pool = require('./shared-db-config');

async function alterTable() {
    const client = await pool.connect();
    try {
        console.log('🔄 inspection_schedules テーブルを変更します...');
        await client.query('BEGIN');

        // 1. target_category カラムを追加 (まだ無ければ)
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'master_data' AND table_name = 'inspection_schedules' AND column_name = 'target_category') THEN 
                    ALTER TABLE master_data.inspection_schedules ADD COLUMN target_category VARCHAR(100); 
                END IF; 
            END $$;
        `);

        // 2. machine_id カラムの NOT NULL 制約を解除
        await client.query(`
            ALTER TABLE master_data.inspection_schedules ALTER COLUMN machine_id DROP NOT NULL;
        `);

        await client.query('COMMIT');
        console.log('✅ テーブル変更完了');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ エラー:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

alterTable();
