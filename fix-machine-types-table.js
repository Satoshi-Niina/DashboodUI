const pool = require('./shared-db-config');

async function fixMachineTypesTable() {
    try {
        console.log('🔧 machine_typesテーブルを修正中...\n');
        
        // 既存のデータをバックアップ
        const existing = await pool.query('SELECT * FROM master_data.machine_types');
        console.log(`既存データ: ${existing.rows.length}件`);
        
        // 必要なカラムを追加
        console.log('\n📝 カラムを追加中...');
        
        await pool.query(`
            ALTER TABLE master_data.machine_types
            ADD COLUMN IF NOT EXISTS type_code VARCHAR(50) UNIQUE,
            ADD COLUMN IF NOT EXISTS type_name VARCHAR(200),
            ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100),
            ADD COLUMN IF NOT EXISTS category VARCHAR(100),
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        
        console.log('✅ カラム追加完了');
        
        // 既存のmachine_type_nameをtype_nameにコピー
        if (existing.rows.length > 0) {
            console.log('\n📋 既存データを移行中...');
            await pool.query(`
                UPDATE master_data.machine_types
                SET type_name = machine_type_name
                WHERE type_name IS NULL;
            `);
            console.log('✅ データ移行完了');
        }
        
        // 新しいスキーマを確認
        const newSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'machine_types'
            ORDER BY ordinal_position
        `);
        
        console.log('\n📊 更新後のスキーマ:');
        console.table(newSchema.rows);
        
        console.log('\n✅ machine_typesテーブルの修正完了！');
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

fixMachineTypesTable();
