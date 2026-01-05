/**
 * Dashboard UI逕ｨ縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹ｒ繝・・繧ｿ繝吶・繧ｹ縺ｫ逋ｻ骭ｲ縺吶ｋ繧ｹ繧ｯ繝ｪ繝励ヨ
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function setupRouting() {
  console.log('肌 Dashboard UI縺ｮ繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹ｒ髢句ｧ九＠縺ｾ縺・..');
  
  const sqlFile = path.join(__dirname, 'setup-dashboard-ui-routing.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  try {
    await pool.query(sql);
    console.log('笨・繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ險ｭ螳壹′螳御ｺ・＠縺ｾ縺励◆・・);
    
    // 遒ｺ隱阪け繧ｨ繝ｪ
    const result = await pool.query(`
      SELECT 
        app_id,
        logical_resource_name,
        physical_schema,
        physical_table,
        is_active
      FROM public.app_resource_routing
      WHERE app_id = 'dashboard-ui'
      ORDER BY logical_resource_name
    `);
    
    console.log('\n搭 逋ｻ骭ｲ縺輔ｌ縺溘Ν繝ｼ繝・ぅ繝ｳ繧ｰ:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('笶・繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

setupRouting();
