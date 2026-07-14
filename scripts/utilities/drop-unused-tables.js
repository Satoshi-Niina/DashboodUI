const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function dropUnusedTables() {
  try {
    await client.connect();
    console.log('✅ Connected to common_db to drop tables');

    // Due to foreign key relationships, we drop dependent tables first or use CASCADE.
    // Order:
    // 1. public.user_role_assignments (references users, roles)
    // 2. public.user_org_memberships (references users, organizations, sites)
    // 3. public.role_permissions (references roles, permissions)
    // 4. public.sites (references organizations)
    // 5. public.roles
    // 6. public.permissions
    // 7. public.users
    // 8. master_data.users
    
    const dropQueries = [
      'DROP TABLE IF EXISTS public.user_role_assignments CASCADE',
      'DROP TABLE IF EXISTS public.user_org_memberships CASCADE',
      'DROP TABLE IF EXISTS public.role_permissions CASCADE',
      'DROP TABLE IF EXISTS public.sites CASCADE',
      'DROP TABLE IF EXISTS public.roles CASCADE',
      'DROP TABLE IF EXISTS public.permissions CASCADE',
      'DROP TABLE IF EXISTS public.users CASCADE',
      'DROP TABLE IF EXISTS master_data.users CASCADE'
    ];

    for (const sql of dropQueries) {
      console.log(`Executing: ${sql}`);
      await client.query(sql);
    }

    console.log('🎉 Successfully dropped all unused TABLES in common_db');

  } catch (err) {
    console.error('❌ Drop tables failed:', err.message);
  } finally {
    await client.end();
  }
}

dropUnusedTables();
