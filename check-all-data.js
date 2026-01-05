const pool = require('./shared-db-config');

async function checkAllData() {
    try {
        console.log('📊 データベース内のデータを確認中...\n');
        
        // 事業所データ
        const offices = await pool.query('SELECT * FROM master_data.management_offices ORDER BY office_id');
        console.log(`\n事業所マスタ: ${offices.rows.length}件`);
        if (offices.rows.length > 0) {
            console.table(offices.rows);
        }
        
        // 保守基地データ
        const bases = await pool.query('SELECT * FROM master_data.bases ORDER BY base_id');
        console.log(`\n保守基地マスタ: ${bases.rows.length}件`);
        if (bases.rows.length > 0) {
            console.table(bases.rows);
        }
        
        // 機種マスタ
        const machineTypes = await pool.query('SELECT * FROM master_data.machine_types ORDER BY id');
        console.log(`\n機種マスタ: ${machineTypes.rows.length}件`);
        if (machineTypes.rows.length > 0) {
            console.table(machineTypes.rows);
        }
        
        // 機械番号マスタ
        const machines = await pool.query('SELECT * FROM master_data.machines ORDER BY id');
        console.log(`\n機械番号マスタ: ${machines.rows.length}件`);
        if (machines.rows.length > 0) {
            console.table(machines.rows);
        }
        
        // 保守用車
        const vehicles = await pool.query('SELECT * FROM master_data.vehicles ORDER BY vehicle_id');
        console.log(`\n保守用車マスタ: ${vehicles.rows.length}件`);
        if (vehicles.rows.length > 0) {
            console.table(vehicles.rows);
        }
        
        console.log('\n✅ データ確認完了');
        
        if (offices.rows.length === 0 && bases.rows.length === 0) {
            console.log('\n⚠️ 警告: 事業所と保守基地のデータが存在しません');
            console.log('初期データを登録する必要があります。');
        }
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

checkAllData();
