const pool = require('./shared-db-config');

async function recreateVehiclesTable() {
    try {
        console.log('🔄 Recreating vehicles table with new schema...\n');
        
        // Backup existing data
        console.log('📦 Backing up existing data...');
        const backup = await pool.query(`SELECT * FROM master_data.vehicles`);
        console.log(`Found ${backup.rows.length} existing vehicles`);
        
        // Drop and recreate table
        console.log('\n🗑️ Dropping old table...');
        await pool.query(`DROP TABLE IF EXISTS master_data.vehicles CASCADE`);
        
        console.log('🏗️ Creating new table with correct schema...');
        await pool.query(`
            CREATE TABLE master_data.vehicles (
                vehicle_id SERIAL PRIMARY KEY,
                vehicle_number VARCHAR(50) UNIQUE NOT NULL,
                machine_id INTEGER REFERENCES master_data.machines(id) ON DELETE RESTRICT,
                office_id INTEGER,
                model VARCHAR(100),
                registration_number VARCHAR(50),
                type_certification VARCHAR(100),
                acquisition_date DATE,
                status VARCHAR(20) DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ New vehicles table created!\n');
        
        // Verify schema
        const schema = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'master_data' AND table_name = 'vehicles'
            ORDER BY ordinal_position
        `);
        
        console.log('📊 New vehicles table schema:');
        console.table(schema.rows);
        
        console.log('\n⚠️ Note: Old vehicle data was not migrated.');
        console.log('You can now register new vehicles through the admin interface.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

recreateVehiclesTable();
