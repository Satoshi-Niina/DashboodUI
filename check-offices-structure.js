// officesテーブルの構造を確認するスクリプト
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function checkOfficesTable() {
    try {
        console.log('🔍 officesテーブルの構造を確認します...\n');
        
        // テーブルの列情報を取得
        const columnsResult = await pool.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'master_data' 
            AND table_name = 'managements_offices'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 managements_officesテーブルの列:');
        columnsResult.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });
        
        // プライマリキーを確認
        const pkResult = await pool.query(`
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'master_data'
            AND tc.table_name = 'managements_offices'
            AND tc.constraint_type = 'PRIMARY KEY'
        `);
        
        if (pkResult.rows.length > 0) {
            console.log('\n✅ プライマリキー:');
            pkResult.rows.forEach(pk => {
                console.log(`   - ${pk.column_name}`);
            });
        } else {
            console.log('\n⚠️  プライマリキーが設定されていません！');
        }
        
    } catch (err) {
        console.error('❌ エラー:', err.message);
    } finally {
        await pool.end();
    }
}

checkOfficesTable();
