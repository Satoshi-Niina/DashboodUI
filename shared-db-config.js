/**
 * 邨ｱ荳繝・・繧ｿ繝吶・繧ｹ謗･邯夊ｨｭ螳・
 * 蜷・い繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺九ｉ菴ｿ逕ｨ縺吶ｋ蜈ｱ騾壹・DB謗･邯夊ｨｭ螳・
 * 繝ｭ繝ｼ繧ｫ繝ｫ迺ｰ蠅・→譛ｬ逡ｪ迺ｰ蠅・ｼ・loud Run + Cloud SQL・峨・荳｡譁ｹ縺ｫ蟇ｾ蠢・
 */

const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// 譛ｬ逡ｪ迺ｰ蠅・ｼ・loud SQL・峨→繝ｭ繝ｼ繧ｫ繝ｫ迺ｰ蠅・〒謗･邯夊ｨｭ螳壹ｒ蛻・ｊ譖ｿ縺・
const dbConfig = isProduction && process.env.CLOUD_SQL_INSTANCE ? {
  // 譛ｬ逡ｪ迺ｰ蠅・ Cloud SQL Unix socket謗･邯・
  host: `/cloudsql/${process.env.CLOUD_SQL_INSTANCE}`,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'webappdb',
  max: 5,
} : {
  // 繝ｭ繝ｼ繧ｫ繝ｫ迺ｰ蠅・ 謗･邯壽枚蟄怜・繧剃ｽｿ逕ｨ
  connectionString: process.env.DATABASE_URL,
};

const pool = new Pool(dbConfig);

// 謗･邯壹お繝ｩ繝ｼ繝上Φ繝峨Μ繝ｳ繧ｰ
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
