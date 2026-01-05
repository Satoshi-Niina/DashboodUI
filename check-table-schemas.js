const pool = require('./shared-db-config');

async function checkTableSchemas() {
    try {
        console.log('📊 実際のテーブルスキーマを確認中...\n');
        
        // 事業所テーブルのスキーマ
        const officesSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'master_data' AND table_name = 'management_offices'
            ORDER BY ordinal_position
        `);
        console.log('management_offices テーブル:');
        console.table(officesSchema.rows);
        
        // 保守基地テーブルのスキーマ
        const basesSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'master_data' AND table_name = 'bases'
            ORDER BY ordinal_position
        `);
        console.log('\nbases テーブル:');
        console.table(basesSchema.rows);
        
        // サンプルデータ
        const offices = await pool.query('SELECT * FROM master_data.management_offices LIMIT 5');
        console.log(`\n事業所データ: ${offices.rows.length}件`);
        if (offices.rows.length > 0) {
            console.table(offices.rows);
        }
        
        const bases = await pool.query('SELECT * FROM master_data.bases LIMIT 5');
        console.log(`\n基地データ: ${bases.rows.length}件`);
        if (bases.rows.length > 0) {
            console.table(bases.rows);
        }
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
    } finally {
        await pool.end();
    }
}

checkTableSchemas();
