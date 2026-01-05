--- Cloud SQL Fix Script
-- Update routing and schema for master_data

-- STEP 1: Update routing table
UPDATE public.app_resource_routing 
SET physical_schema = 'master_data'
WHERE app_id = 'dashboard-ui' 
  AND logical_resource_name IN ('machines', 'machine_types', 'vehicles', 'managements_offices');

-- STEP 2: Extend machine_types table
ALTER TABLE master_data.machine_types
ADD COLUMN IF NOT EXISTS type_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS type_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE master_data.machine_types
SET type_name = machine_type_name
WHERE type_name IS NULL AND machine_type_name IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'machine_types_type_code_key'
    ) THEN
        ALTER TABLE master_data.machine_types 
        ADD CONSTRAINT machine_types_type_code_key UNIQUE (type_code);
    END IF;
END $$;

-- STEP 3: Extend machines table
ALTER TABLE master_data.machines
ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS manufacture_date DATE,
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- STEP 4: Add machine_id and office_id to vehicles table
ALTER TABLE master_data.vehicles
ADD COLUMN IF NOT EXISTS machine_id INTEGER,
ADD COLUMN IF NOT EXISTS office_id INTEGER;

-- STEP 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_machine_id ON master_data.vehicles(machine_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_office_id ON master_data.vehicles(office_id);
CREATE INDEX IF NOT EXISTS idx_machines_machine_type_id ON master_data.machines(machine_type_id);
CREATE INDEX IF NOT EXISTS idx_machine_types_type_code ON master_data.machine_types(type_code);

-- STEP 6: Add foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_vehicles_machine_id' 
        AND table_name = 'vehicles'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.vehicles 
        ADD CONSTRAINT fk_vehicles_machine_id 
        FOREIGN KEY (machine_id) REFERENCES master_data.machines(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_vehicles_office_id' 
        AND table_name = 'vehicles'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.vehicles 
        ADD CONSTRAINT fk_vehicles_office_id 
        FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id) 
        ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_machines_machine_type_id' 
        AND table_name = 'machines'
        AND table_schema = 'master_data'
    ) THEN
        ALTER TABLE master_data.machines 
        ADD CONSTRAINT fk_machines_machine_type_id 
        FOREIGN KEY (machine_type_id) REFERENCES master_data.machine_types(id) 
        ON DELETE RESTRICT;
    END IF;
END $$;

-- Verification queries
SELECT logical_resource_name, physical_schema, physical_table 
FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui'
ORDER BY logical_resource_name;
