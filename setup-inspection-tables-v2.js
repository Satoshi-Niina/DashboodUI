// 検修マスタテーブルの確認と作成スクリプト
const { Pool } = require('pg');
require('dotenv').config();

// データベース接続設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Takabeni@localhost:55432/webappdb'
});

async function setupInspectionTables() {
    console.log('📋 検修マスタテーブルのセットアップを開始します...\n');
    
    try {
        // 既存テーブルの確認
        const existingTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'master_data' 
            AND table_name IN ('inspection_types', 'inspection_schedules')
        `);
        
        console.log('🔍 既存テーブルの確認:');
        if (existingTables.rows.length > 0) {
            existingTables.rows.forEach(row => {
                console.log(`   ⚠️  master_data.${row.table_name} は既に存在します`);
            });
            
            // 既存テーブルを削除するか確認
            console.log('\n既存のテーブルを削除して再作成します...');
            
            await pool.query('DROP TABLE IF EXISTS master_data.inspection_schedules CASCADE');
            await pool.query('DROP TABLE IF EXISTS master_data.inspection_types CASCADE');
            console.log('✅ 既存テーブルを削除しました\n');
        } else {
            console.log('   ✓ 新規作成します\n');
        }
        
        console.log('⏳ テーブルを作成中...\n');
        
        // machinesテーブルにプライマリキーがあるか確認し、なければ追加
        const pkCheck = await pool.query(`
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'master_data'
            AND tc.table_name = 'machines'
            AND tc.constraint_type = 'PRIMARY KEY'
        `);
        
        if (pkCheck.rows.length === 0) {
            console.log('⚠️  machinesテーブルにプライマリキーがありません。追加します...');
            await pool.query('ALTER TABLE master_data.machines ADD PRIMARY KEY (id)');
            console.log('✅ machinesテーブルにプライマリキーを追加しました\n');
        } else {
            console.log('✅ machinesテーブルのプライマリキーを確認しました\n');
        }
        
        // 検修種別マスタテーブルの作成
        await pool.query(`
            CREATE TABLE master_data.inspection_types (
                id SERIAL PRIMARY KEY,
                type_code VARCHAR(50) NOT NULL UNIQUE,
                type_name VARCHAR(100) NOT NULL,
                description TEXT,
                display_order INT DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ inspection_types テーブルを作成しました');
        
        // 検修周期・期間設定テーブルの作成
        await pool.query(`
            CREATE TABLE master_data.inspection_schedules (
                id SERIAL PRIMARY KEY,
                machine_id TEXT NOT NULL,
                inspection_type_id INT NOT NULL,
                cycle_months INT NOT NULL,
                duration_days INT NOT NULL,
                remarks TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (machine_id) REFERENCES master_data.machines(id) ON DELETE CASCADE,
                FOREIGN KEY (inspection_type_id) REFERENCES master_data.inspection_types(id) ON DELETE CASCADE,
                UNIQUE(machine_id, inspection_type_id)
            )
        `);
        console.log('✅ inspection_schedules テーブルを作成しました');
        
        // インデックスの作成
        await pool.query('CREATE INDEX idx_inspection_schedules_machine_id ON master_data.inspection_schedules(machine_id)');
        await pool.query('CREATE INDEX idx_inspection_schedules_inspection_type_id ON master_data.inspection_schedules(inspection_type_id)');
        await pool.query('CREATE INDEX idx_inspection_schedules_is_active ON master_data.inspection_schedules(is_active)');
        console.log('✅ インデックスを作成しました');
        
        // トリガー関数の作成
        await pool.query(`
            CREATE OR REPLACE FUNCTION master_data.update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);
        console.log('✅ トリガー関数を作成しました');
        
        // トリガーの作成
        await pool.query(`
            DROP TRIGGER IF EXISTS update_inspection_types_updated_at ON master_data.inspection_types
        `);
        await pool.query(`
            CREATE TRIGGER update_inspection_types_updated_at
                BEFORE UPDATE ON master_data.inspection_types
                FOR EACH ROW
                EXECUTE FUNCTION master_data.update_updated_at_column()
        `);
        
        await pool.query(`
            DROP TRIGGER IF EXISTS update_inspection_schedules_updated_at ON master_data.inspection_schedules
        `);
        await pool.query(`
            CREATE TRIGGER update_inspection_schedules_updated_at
                BEFORE UPDATE ON master_data.inspection_schedules
                FOR EACH ROW
                EXECUTE FUNCTION master_data.update_updated_at_column()
        `);
        console.log('✅ トリガーを作成しました');
        
        // サンプルデータの挿入
        await pool.query(`
            INSERT INTO master_data.inspection_types (type_code, type_name, description, display_order) VALUES
                ('A_INSPECTION', 'A検修', '日常点検と小規模な整備', 1),
                ('B_INSPECTION', 'B検修', '定期的な点検と部品交換', 2),
                ('C_INSPECTION', 'C検修', '大規模な点検と整備', 3),
                ('GENERAL_INSPECTION', '全般検査', '法定検査に準じた総合検査', 4),
                ('SPECIAL_INSPECTION', '特別検査', '臨時または特定部品の検査', 5)
        `);
        console.log('✅ サンプルデータを挿入しました\n');
        
        // 作成結果の確認
        const typesResult = await pool.query('SELECT COUNT(*) as count FROM master_data.inspection_types');
        console.log(`📊 検修種別マスタ: ${typesResult.rows[0].count}件のレコード`);
        
        const typesData = await pool.query('SELECT type_code, type_name FROM master_data.inspection_types ORDER BY display_order');
        console.log('\n登録された検修種別:');
        typesData.rows.forEach(type => {
            console.log(`   - ${type.type_code}: ${type.type_name}`);
        });
        
        console.log('\n✅ セットアップが正常に完了しました！');
        console.log('\n次のステップ:');
        console.log('1. サーバーを再起動してください: npm run dev');
        console.log('2. 管理画面の「検修マスタ」タブで設定を確認してください');
        
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
