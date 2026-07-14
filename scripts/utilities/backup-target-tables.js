const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function backup() {
  try {
    await client.connect();
    console.log('✅ Connected to common_db for backup');

    const tables = [
      { schema: 'public', name: 'users' },
      { schema: 'public', name: 'roles' },
      { schema: 'public', name: 'permissions' },
      { schema: 'public', name: 'role_permissions' },
      { schema: 'public', name: 'user_role_assignments' },
      { schema: 'public', name: 'user_org_memberships' },
      { schema: 'public', name: 'sites' },
      { schema: 'master_data', name: 'users' }
    ];

    let sqlOutput = `-- ======================================================\n`;
    sqlOutput += `-- COMMON_DB BACKUP OF DELETED/UNUSED TABLES\n`;
    sqlOutput += `-- Generated on: ${new Date().toISOString()}\n`;
    sqlOutput += `-- ======================================================\n\n`;

    for (const table of tables) {
      const fullTableName = `"${table.schema}"."${table.name}"`;
      console.log(`Backing up ${fullTableName}...`);

      // Check if table exists
      const existsResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = $2
        )
      `, [table.schema, table.name]);

      if (!existsResult.rows[0].exists) {
        console.log(`⚠️ Table ${fullTableName} does not exist. Skipping.`);
        continue;
      }

      // Get columns
      const colsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [table.schema, table.name]);
      const columns = colsResult.rows.map(r => r.column_name);

      // Get rows
      const rowsResult = await client.query(`SELECT * FROM ${fullTableName}`);
      
      sqlOutput += `-- Table: ${fullTableName}\n`;
      sqlOutput += `-- Columns: ${columns.join(', ')}\n`;
      sqlOutput += `-- Row count: ${rowsResult.rows.length}\n`;

      if (rowsResult.rows.length === 0) {
        sqlOutput += `-- (No data)\n\n`;
        continue;
      }

      for (const row of rowsResult.rows) {
        const colNames = columns.join(', ');
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return val;
        });
        sqlOutput += `INSERT INTO ${fullTableName} (${colNames}) VALUES (${values.join(', ')});\n`;
      }
      sqlOutput += `\n`;
    }

    const backupPath = path.join(__dirname, '../../backup_common_db_unused.sql');
    fs.writeFileSync(backupPath, sqlOutput, 'utf8');
    console.log(`🎉 Backup written successfully to: ${backupPath}`);

  } catch (err) {
    console.error('❌ Backup failed:', err.message);
  } finally {
    await client.end();
  }
}

backup();
