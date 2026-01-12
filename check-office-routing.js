const pool = require('./shared-db-config');

async function checkOfficeRouting() {
    try {
        console.log('🔍 事業所マスタのルーティング設定を確認中...\n');
        
        // 1. app_resource_routingテーブルの構造を確認
        console.log('1️⃣ ルーティングテーブルの構造:');
        const structureResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'app_resource_routing'
            ORDER BY ordinal_position;
        `);
        console.log('テーブル構造:', structureResult.rows);
        
        // 2. app_resource_routingテーブルの全データ確認
        console.log('\n2️⃣ ルーティングテーブルの全データ:');
        const routingResult = await pool.query(`
            SELECT * FROM public.app_resource_routing 
            ORDER BY routing_id;
        `);
        console.log('ルーティング設定:', routingResult.rows);
        
        // 3. managements_officesテーブルの存在確認
        console.log('\n3️⃣ テーブルの存在確認:');
        const tablesResult = await pool.query(`
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE tablename LIKE '%office%'
            ORDER BY schemaname, tablename;
        `);
        console.log('事業所関連テーブル:', tablesResult.rows);
        
        // 4. managements_officesのデータ確認
        console.log('\n4️⃣ master_data.managements_officesのデータ:');
        const dataResult = await pool.query(`
            SELECT * FROM master_data.managements_offices 
            ORDER BY office_id 
            LIMIT 5;
        `);
        console.log('データ:', dataResult.rows);
        
        console.log('\n✅ 確認完了');
        
    } catch (err) {
        console.error('❌ エラー:', err.message);
        console.error('詳細:', err.stack);
    } finally {
        await pool.end();
    }
}

checkOfficeRouting();
