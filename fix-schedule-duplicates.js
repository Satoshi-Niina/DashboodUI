// 重複した検修設定を削除し、ユニーク制約を強化するスクリプト
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function fixDuplicates() {
    console.log('🔄 検修設定の重複チェックと修正を開始します...\n');
    
    try {
        // 1. 重複データの確認と削除（カテゴリー設定の重複）
        console.log('🧹 カテゴリー設定の重複を削除します...');
        const deleteDupCategorySQL = `
            DELETE FROM master_data.inspection_schedules a
            USING master_data.inspection_schedules b
            WHERE a.id > b.id
            AND a.machine_id IS NULL
            AND b.machine_id IS NULL
            AND a.target_category = b.target_category
            AND a.inspection_type_id = b.inspection_type_id;
        `;
        const resCat = await pool.query(deleteDupCategorySQL);
        console.log(`   └─ 削除された重複レコード数: ${resCat.rowCount}`);

        // 2. 重複データの確認と削除（個別マシン設定の重複）
        // 既存のUNIQUE制約があるはずですが、念のため確認
        console.log('🧹 個別マシン設定の重複を削除します...');
        const deleteDupMachineSQL = `
            DELETE FROM master_data.inspection_schedules a
            USING master_data.inspection_schedules b
            WHERE a.id > b.id
            AND a.machine_id IS NOT NULL
            AND b.machine_id IS NOT NULL
            AND a.machine_id = b.machine_id
            AND a.inspection_type_id = b.inspection_type_id;
        `;
        const resMach = await pool.query(deleteDupMachineSQL);
        console.log(`   └─ 削除された重複レコード数: ${resMach.rowCount}`);

        // 3. 既存の制約を確認
        // セットアップ時に UNIQUE(machine_id, inspection_type_id) が作られているが、machine_idがNULLの場合は重複を許してしまう
        
        console.log('\n🔒 ユニーク制約を強化します...');

        // 既存の制約を削除（もしあれば）
        try {
            await pool.query('ALTER TABLE master_data.inspection_schedules DROP CONSTRAINT IF EXISTS inspection_schedules_machine_id_inspection_type_id_key');
            console.log('   ✓ 古い制約を削除しました (if exists)');
        } catch (e) {
            console.log('   ! 制約削除スキップ:', e.message);
        }

        // 部分インデックスを作成して、NULLの場合とそうでない場合の両方でユニーク性を担保する
        
        // ケース1: machine_idがある場合 (machine_id + inspection_type_id でユニーク)
        await pool.query(`
            DROP INDEX IF EXISTS idx_unique_machine_schedule;
            CREATE UNIQUE INDEX idx_unique_machine_schedule 
            ON master_data.inspection_schedules (machine_id, inspection_type_id) 
            WHERE machine_id IS NOT NULL;
        `);
        console.log('   ✓ 個別マシン設定のユニークインデックスを作成しました');

        // ケース2: machine_idがなく、target_categoryがある場合 (target_category + inspection_type_id でユニーク)
        await pool.query(`
            DROP INDEX IF EXISTS idx_unique_category_schedule;
            CREATE UNIQUE INDEX idx_unique_category_schedule 
            ON master_data.inspection_schedules (target_category, inspection_type_id) 
            WHERE machine_id IS NULL;
        `);
        console.log('   ✓ カテゴリー設定のユニークインデックスを作成しました');

        console.log('\n✅ 修正が完了しました！');
        
    } catch (err) {
        console.error('\n❌ エラーが発生しました:', err.message);
        console.error(err);
    } finally {
        await pool.end();
    }
}

fixDuplicates();
