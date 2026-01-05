/**
 * All applications routing status checker
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkRoutingStatus() {
  console.log('='.repeat(80));
  console.log('ROUTING STATUS REPORT');
  console.log('='.repeat(80));
  console.log('');
  
  try {
    // 1. Get all routing configurations
    const allRoutingResult = await pool.query(`
      SELECT 
        app_id,
        logical_resource_name,
        physical_schema,
        physical_table,
        is_active,
        created_at
      FROM public.app_resource_routing
      ORDER BY app_id, logical_resource_name
    `);
    
    console.log('[ALL APPLICATIONS ROUTING]');
    console.log('-'.repeat(80));
    
    // Group by app
    const routingByApp = {};
    allRoutingResult.rows.forEach(row => {
      if (!routingByApp[row.app_id]) {
        routingByApp[row.app_id] = [];
      }
      routingByApp[row.app_id].push(row);
    });
    
    // Display by app
    for (const [appId, routes] of Object.entries(routingByApp)) {
      console.log(`\n[${appId}] - ${routes.length} routes`);
      console.log('-'.repeat(80));
      routes.forEach(route => {
        const status = route.is_active ? 'ACTIVE' : 'INACTIVE';
        console.log(`  ${status.padEnd(8)} ${route.logical_resource_name.padEnd(25)} => ${route.physical_schema}.${route.physical_table}`);
      });
    }
    
    // 2. Get master_data tables
    console.log('\n\n' + '='.repeat(80));
    console.log('[MASTER_DATA SCHEMA TABLES]');
    console.log('='.repeat(80) + '\n');
    
    const tablesResult = await pool.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = 'master_data' AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'master_data'
      ORDER BY table_name
    `);
    
    tablesResult.rows.forEach(table => {
      console.log(`  [TABLE] ${table.table_name.padEnd(30)} (${table.column_count} columns)`);
    });
    
    // 3. Check unrouted tables
    console.log('\n\n' + '='.repeat(80));
    console.log('[UNROUTED MASTER_DATA TABLES]');
    console.log('='.repeat(80) + '\n');
    
    const routedTables = new Set(
      allRoutingResult.rows
        .filter(r => r.physical_schema === 'master_data')
        .map(r => r.physical_table)
    );
    
    const unroutedTables = tablesResult.rows.filter(
      table => !routedTables.has(table.table_name)
    );
    
    if (unroutedTables.length > 0) {
      unroutedTables.forEach(table => {
        console.log(`  [WARNING] ${table.table_name}`);
      });
    } else {
      console.log('  [OK] All master_data tables have routing configured');
    }
    
    // 4. Check common masters routing status
    console.log('\n\n' + '='.repeat(80));
    console.log('[COMMON MASTERS ROUTING STATUS]');
    console.log('='.repeat(80) + '\n');
    
    const recommendedMasters = [
      'users',
      'managements_offices',
      'bases',
      'vehicles',
      'machine_types',
      'machines'
    ];
    
    const apps = Object.keys(routingByApp);
    
    console.log('Master Name'.padEnd(25) + ' | ' + apps.map(a => a.padEnd(20)).join(' | '));
    console.log('-'.repeat(25) + '-+-' + apps.map(() => '-'.repeat(20)).join('-+-'));
    
    recommendedMasters.forEach(master => {
      const row = master.padEnd(25) + ' | ';
      const statuses = apps.map(app => {
        const hasRouting = routingByApp[app]?.some(r => 
          r.logical_resource_name === master && r.is_active
        );
        return (hasRouting ? 'OK' : 'NOT SET').padEnd(20);
      });
      console.log(row + statuses.join(' | '));
    });
    
    // 5. Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('[SUMMARY]');
    console.log('='.repeat(80) + '\n');
    
    console.log(`  Registered Apps:        ${apps.length}`);
    console.log(`  Total Routing Records:  ${allRoutingResult.rows.length}`);
    console.log(`  Master_data Tables:     ${tablesResult.rows.length}`);
    console.log(`  Unrouted Tables:        ${unroutedTables.length}`);
    console.log('');
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkRoutingStatus();
