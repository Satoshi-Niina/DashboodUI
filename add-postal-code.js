const { Pool } = require('pg');

const pool = new Pool({
  host: '/cloudsql/free-trial-first-project:us-west1:free-trial-instance',
  user: 'postgres',
  password: 'postgres',
  database: 'webappdb',
  max: 5
});

async function addPostalCode() {
  try {
    console.log('managements_officesテーブルにpostal_codeカラムを追加中...');
    await pool.query(`
      ALTER TABLE master_data.managements_offices 
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)
    `);
    console.log('✓ managements_officesにpostal_codeを追加しました');

    console.log('basesテーブルにpostal_codeカラムを追加中...');
    await pool.query(`
      ALTER TABLE master_data.bases 
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)
    `);
    console.log('✓ basesにpostal_codeを追加しました');

    // 確認
    console.log('\n確認: managements_officesのカラム一覧');
    const officesResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'master_data' 
      AND table_name = 'managements_offices'
      ORDER BY ordinal_position
    `);
    officesResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n確認: basesのカラム一覧');
    const basesResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'master_data' 
      AND table_name = 'bases'
      ORDER BY ordinal_position
    `);
    basesResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    await pool.end();
    console.log('\n完了しました');
  } catch (err) {
    console.error('エラー:', err);
    await pool.end();
    process.exit(1);
  }
}

addPostalCode();
