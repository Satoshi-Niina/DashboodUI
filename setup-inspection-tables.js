// 検修マスタテーブルの作成スクリプト
const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// データベース接続設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function setupInspectionTables() {
    console.log('📋 検修マスタテーブルのセットアップを開始します...\n');
    
    try {
        // SQLファイルを読み込む
        const sqlFilePath = path.join(__dirname, 'setup-inspection-master.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log('📄 SQLファイルを読み込みました: setup-inspection-master.sql');
        console.log('⏳ テーブルを作成中...\n');
        
        // SQLを実行
        await pool.query(sql);
        
        console.log('✅ テーブルの作成が完了しました！\n');
        console.log('📋 作成されたテーブル:');
        console.log('   - master_data.inspection_types (検修種別マスタ)');
        console.log('   - master_data.inspection_schedules (検修周期・期間設定)\n');
        
        // 作成されたテーブルを確認
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'master_data' 
            AND table_name IN ('inspection_types', 'inspection_schedules')
            ORDER BY table_name
        `);
        
        console.log('🔍 テーブル確認結果:');
        result.rows.forEach(row => {
            console.log(`   ✓ master_data.${row.table_name}`);
        });
        
        // サンプルデータの確認
        const typesResult = await pool.query('SELECT COUNT(*) as count FROM master_data.inspection_types');
        console.log(`\n📊 検修種別マスタ: ${typesResult.rows[0].count}件のレコードが挿入されました`);
        
        const typesData = await pool.query('SELECT type_code, type_name FROM master_data.inspection_types ORDER BY display_order');
        console.log('\n登録された検修種別:');
        typesData.rows.forEach(type => {
            console.log(`   - ${type.type_code}: ${type.type_name}`);
        });
        
        console.log('\n✅ セットアップが正常に完了しました！');
        
    } catch (err) {
        console.error('\n❌ エラーが発生しました:', err.message);
        console.error('詳細:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// スクリプト実行
setupInspectionTables();
