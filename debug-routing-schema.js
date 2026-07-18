const { Pool } = require('pg');

const controlPool = new Pool({
  host: process.env.CONTROL_PLANE_HOST || '35.243.72.98',
  port: process.env.CONTROL_PLANE_PORT || 5432,
  user: process.env.CONTROL_PLANE_USER || 'postgres',
  password: process.env.CONTROL_PLANE_PASSWORD || 'DJJB9R42kKdHJqvH',
  database: process.env.CONTROL_PLANE_DB || 'common_db'
});

async function debugRoutingSchema() {
  try {
    console.log('=== Debugging app_resource_routing schema ===\n');
    
    // 1. テーブルが存在するか確認
    const tableExists = await controlPool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'app_resource_routing'
      ) as exists
    `);
    console.log(`Table exists: ${tableExists.rows[0].exists}`);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Table does not exist!');
      await controlPool.end();
      return;
    }
    
    // 2. カラル構造を取得
    const columnsRes = await controlPool.query(`
      SELECT column_name, data_type, is_nullable, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_resource_routing'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColumns:');
    columnsRes.rows.forEach(col => {
      console.log(`  [${col.ordinal_position}] ${col.column_name} (${col.data_type}, nullable=${col.is_nullable})`);
    });
    
    // 3. テーブルデータ行数
    const countRes = await controlPool.query('SELECT COUNT(*) as cnt FROM public.app_resource_routing');
    console.log(`\nRow count: ${countRes.rows[0].cnt}`);
    
    // 4. サンプルデータ
    if (countRes.rows[0].cnt > 0) {
      const sampleRes = await controlPool.query('SELECT * FROM public.app_resource_routing LIMIT 3');
      console.log('\nSample data:');
      sampleRes.rows.forEach(row => {
        console.log('  ', JSON.stringify(row, null, 2));
      });
    } else {
      console.log('\n⚠️ No data in table');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await controlPool.end();
  }
}

debugRoutingSchema();
