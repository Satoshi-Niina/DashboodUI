const pool = require('./shared-db-config');

async function checkSchema() {
    try {
        console.log('🔍 データベース内のテーブルを確認中...\n');
        
        // master_dataスキーマのテーブル一覧
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'master_data' 
            ORDER BY table_name
        `);
        
        console.log('master_dataスキーマのテーブル一覧:');
        console.table(tables.rows);
        
        // publicスキーマのテーブル一覧
        const publicTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('\npublicスキーマのテーブル一覧:');
        console.table(publicTables.rows);
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
