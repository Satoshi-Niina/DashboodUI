// machinesテーブルの構造を確認するスクリプト
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function checkMachinesTable() {
    try {
        console.log('🔍 machinesテーブルの構造を確認します...\n');
        
        // テーブルの列情報を取得
        const columnsResult = await pool.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'master_data' 
            AND table_name = 'machines'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 machinesテーブルの列:');
        columnsResult.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });
        
        // 制約情報を取得
        const constraintsResult = await pool.query(`
            SELECT
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'master_data'
            AND tc.table_name = 'machines'
        `);
        
        console.log('\n🔒 machinesテーブルの制約:');
        constraintsResult.rows.forEach(con => {
            console.log(`   - ${con.constraint_name} (${con.constraint_type}) on ${con.column_name || 'N/A'}`);
        });
        
        // プライマリキーを確認
        const pkResult = await pool.query(`
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'master_data'
            AND tc.table_name = 'machines'
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

checkMachinesTable();
