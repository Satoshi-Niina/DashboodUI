const pool = require('./shared-db-config');

async function testOfficesAPI() {
    try {
        console.log('🧪 事業所マスタAPIをテスト中...\n');
        
        console.log('1️⃣ managements_officesテーブルのルーティング解決:');
        const result = await pool.query(`
            SELECT * FROM public.app_resource_routing 
            WHERE logical_resource_name = 'managements_offices'
            AND app_id = 'dashboard-ui';
        `);
        console.log('ルーティング結果:', result.rows);
        
        if (result.rows.length > 0) {
            const route = result.rows[0];
            const fullPath = `${route.physical_schema}.${route.physical_table}`;
            console.log('\n2️⃣ 解決されたパス:', fullPath);
            
            // データ取得テスト
            console.log('\n3️⃣ データ取得テスト:');
            const dataResult = await pool.query(`SELECT * FROM ${fullPath} ORDER BY office_id DESC LIMIT 5;`);
            console.log('取得データ:', dataResult.rows);
            console.log('\n✅ テスト完了！データ数:', dataResult.rowCount);
        } else {
            console.log('❌ ルーティングが見つかりません');
        }
        
    } catch (err) {
        console.error('❌ エラー:', err.message);
        console.error('詳細:', err.stack);
    } finally {
        await pool.end();
    }
}

testOfficesAPI();
