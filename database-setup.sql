-- ========================================
-- 邨ｱ荳繝・・繧ｿ繝吶・繧ｹ繧ｻ繝・ヨ繧｢繝・・繧ｹ繧ｯ繝ｪ繝励ヨ
-- 譌｢蟄倥け繝ｩ繧ｦ繝吋B讒矩蟇ｾ蠢懃沿
-- webappdb逕ｨ・域里蟄倥せ繧ｭ繝ｼ繝槭・繝・・繝悶Ν縺ｫ蜷医ｏ縺帙ｋ・・
-- ========================================

-- 繧ｹ繧ｭ繝ｼ繝樔ｽ懈・・域里縺ｫ蟄伜惠縺吶ｋ蝣ｴ蜷医・繧ｹ繧ｭ繝・・・・
CREATE SCHEMA IF NOT EXISTS master_data;
CREATE SCHEMA IF NOT EXISTS maintenance;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS inspections;
CREATE SCHEMA IF NOT EXISTS emergency;
CREATE SCHEMA IF NOT EXISTS google_vacuum_mgmt;

-- ========================================
-- master_data 繧ｹ繧ｭ繝ｼ繝橸ｼ域里蟄俶ｧ矩縺ｫ蜷医ｏ縺帙ｋ・・
-- ========================================

-- 繝ｦ繝ｼ繧ｶ繝ｼ繝・・繝悶Ν・域里蟄假ｼ・
-- role: 'user' (荳闊ｬ繝ｦ繝ｼ繧ｶ繝ｼ), 'operation_admin' (驕狗畑邂｡逅・・, 'system_admin' (繧ｷ繧ｹ繝・Β邂｡逅・・
CREATE TABLE IF NOT EXISTS master_data.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 莠区･ｭ謇繝槭せ繧ｿ・域里蟄・ managements_offices・・
CREATE TABLE IF NOT EXISTS master_data.managements_offices (
    office_id SERIAL PRIMARY KEY,
    office_code VARCHAR(20) UNIQUE NOT NULL,
    office_name VARCHAR(100) NOT NULL,
    office_type VARCHAR(50),
    address VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 菫晏ｮ亥渕蝨ｰ繝槭せ繧ｿ・域里蟄・ bases・・
CREATE TABLE IF NOT EXISTS master_data.bases (
    base_id SERIAL PRIMARY KEY,
    base_code VARCHAR(20) UNIQUE NOT NULL,
    base_name VARCHAR(100) NOT NULL,
    office_id INTEGER,
    location VARCHAR(200),
    address VARCHAR(200),
    postal_code VARCHAR(20),
    phone_number VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id)
);

-- 菫晏ｮ育畑霆翫・繧ｹ繧ｿ・域里蟄・ vehicles・・
CREATE TABLE IF NOT EXISTS master_data.vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    machine_id INTEGER,
    office_id INTEGER,
    model VARCHAR(50),
    registration_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 讖溽ｨｮ繝槭せ繧ｿ
CREATE TABLE IF NOT EXISTS master_data.machine_types (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(20) UNIQUE NOT NULL,
    type_name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ
CREATE TABLE IF NOT EXISTS master_data.machines (
    id SERIAL PRIMARY KEY,
    machine_number VARCHAR(50) UNIQUE NOT NULL,
    machine_type_id INTEGER,
    serial_number VARCHAR(100),
    manufacture_date DATE,
    purchase_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    assigned_base_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_type_id) REFERENCES master_data.machine_types(id),
    FOREIGN KEY (assigned_base_id) REFERENCES master_data.bases(base_id)
);

-- 螟夜Κ繧ｭ繝ｼ蛻ｶ邏・ｒ霑ｽ蜉
ALTER TABLE master_data.vehicles 
    DROP CONSTRAINT IF EXISTS fk_vehicles_machine_id;
ALTER TABLE master_data.vehicles 
    ADD CONSTRAINT fk_vehicles_machine_id 
    FOREIGN KEY (machine_id) REFERENCES master_data.machines(id) ON DELETE SET NULL;

ALTER TABLE master_data.vehicles 
    DROP CONSTRAINT IF EXISTS fk_vehicles_office_id;
ALTER TABLE master_data.vehicles 
    ADD CONSTRAINT fk_vehicles_office_id 
    FOREIGN KEY (office_id) REFERENCES master_data.managements_offices(office_id) ON DELETE SET NULL;

-- 霆贋ｸ｡繧ｿ繧､繝励・繧ｹ繧ｿ・域里蟄假ｼ・
CREATE TABLE IF NOT EXISTS master_data.vehicle_types (
    type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 轤ｹ讀懊ち繧､繝励・繧ｹ繧ｿ・域里蟄假ｼ・
CREATE TABLE IF NOT EXISTS master_data.inspection_types (
    type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 繝吶・繧ｹ譁・嶌・域里蟄假ｼ・
CREATE TABLE IF NOT EXISTS master_data.base_documents (
    document_id SERIAL PRIMARY KEY,
    base_id INTEGER,
    document_name VARCHAR(200),
    file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 繝√Ε繝・ヨ螻･豁ｴ・域里蟄假ｼ・
CREATE TABLE IF NOT EXISTS master_data.chat_history (
    chat_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ險ｭ螳夲ｼ医ム繝・す繝･繝懊・繝臥畑縺ｫ霑ｽ蜉・・
CREATE TABLE IF NOT EXISTS master_data.app_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER
);

-- 險ｭ螳壼､画峩螻･豁ｴ・医ム繝・す繝･繝懊・繝臥畑縺ｫ霑ｽ蜉・・
CREATE TABLE IF NOT EXISTS master_data.app_config_history (
    history_id SERIAL PRIMARY KEY,
    config_key VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- operations 繧ｹ繧ｭ繝ｼ繝橸ｼ域里蟄俶ｧ矩縺ｫ蜷医ｏ縺帙ｋ・・
-- ========================================

-- 驕玖ｻ｢險育判・域里蟄俶ｧ矩繧呈Φ螳夲ｼ・
CREATE TABLE IF NOT EXISTS operations.schedules (
    schedule_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER,
    schedule_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 驕狗畑螳溽ｸｾ
CREATE TABLE IF NOT EXISTS operations.operation_records (
    record_id SERIAL PRIMARY KEY,
    schedule_id INTEGER,
    vehicle_id INTEGER,
    operation_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- maintenance 繧ｹ繧ｭ繝ｼ繝橸ｼ域里蟄俶ｧ矩縺ｫ蜷医ｏ縺帙ｋ・・
-- ========================================

-- 謨・囿險倬鹸
CREATE TABLE IF NOT EXISTS maintenance.fault_records (
    fault_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER,
    fault_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- inspections 繧ｹ繧ｭ繝ｼ繝・
-- ========================================

-- 轤ｹ讀懆ｨ倬鹸
CREATE TABLE IF NOT EXISTS inspections.inspection_records (
    inspection_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER,
    inspection_date DATE NOT NULL,
    inspector VARCHAR(100),
    inspection_type_id INTEGER,
    result VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- emergency 繧ｹ繧ｭ繝ｼ繝・
-- ========================================

-- 蠢懈･蠕ｩ譌ｧ險倬鹸
CREATE TABLE IF NOT EXISTS emergency.emergency_records (
    emergency_id SERIAL PRIMARY KEY,
    incident_date TIMESTAMP NOT NULL,
    location VARCHAR(200),
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    assigned_to INTEGER,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 蛻晄悄繝・・繧ｿ謚募・
-- ========================================

-- 繝・ヵ繧ｩ繝ｫ繝育ｮ｡逅・・Θ繝ｼ繧ｶ繝ｼ
-- admin: 繝代せ繝ｯ繝ｼ繝・admin123 (繧ｷ繧ｹ繝・Β邂｡逅・・
-- niina: 繝代せ繝ｯ繝ｼ繝・G&896845 (繧ｷ繧ｹ繝・Β邂｡逅・・
INSERT INTO master_data.users (username, password, display_name, email, role)
VALUES 
    ('admin', '$2b$10$Wvq4AxAkP52kudPSW2.A0.J7j2VPbdCigM0EyoiePhn1Wvvg9Mtpe', '邂｡逅・・, 'admin@example.com', 'system_admin'),
    ('niina', '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq', '邂｡逅・・, 'niina@example.com', 'system_admin')
ON CONFLICT (username) DO NOTHING;

-- 繝・ヵ繧ｩ繝ｫ繝・ORS險ｭ螳・
INSERT INTO master_data.app_config (config_key, config_value, description)
VALUES 
    ('cors_origin', '*', 'CORS險ｱ蜿ｯ繧ｪ繝ｪ繧ｸ繝ｳ險ｭ螳夲ｼ磯幕逋ｺ迺ｰ蠅・畑・・),
    ('app_url_emergency', 'https://emergency-client-u3tejuflja-dt.a.run.app/', '蠢懈･蠕ｩ譌ｧ謾ｯ謠ｴ繧ｷ繧ｹ繝・ΒURL'),
    ('app_url_planning', 'https://貅門ｙ荳ｭ', '險育判繝ｻ螳溽ｸｾ邂｡逅・す繧ｹ繝・ΒURL・域ｺ門ｙ荳ｭ・・),
    ('app_url_equipment', 'https://貅門ｙ荳ｭ', '菫晏ｮ育畑霆顔ｮ｡逅・す繧ｹ繝・ΒURL・域ｺ門ｙ荳ｭ・・),
    ('app_url_failure', 'https://貅門ｙ荳ｭ', '讖滓｢ｰ謨・囿邂｡逅・す繧ｹ繝・ΒURL・域ｺ門ｙ荳ｭ・・)
ON CONFLICT (config_key) DO NOTHING;

-- ========================================
-- 繧､繝ｳ繝・ャ繧ｯ繧ｹ菴懈・・医ヱ繝輔か繝ｼ繝槭Φ繧ｹ譛驕ｩ蛹厄ｼ・
-- ========================================

-- master_data 繧ｹ繧ｭ繝ｼ繝・
CREATE INDEX IF NOT EXISTS idx_users_username ON master_data.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON master_data.users(role);
CREATE INDEX IF NOT EXISTS idx_offices_code ON master_data.managements_offices(office_code);
CREATE INDEX IF NOT EXISTS idx_bases_code ON master_data.bases(base_code);
CREATE INDEX IF NOT EXISTS idx_bases_office ON master_data.bases(office_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON master_data.vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON master_data.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_machines_number ON master_data.machines(machine_number);
CREATE INDEX IF NOT EXISTS idx_machines_type ON master_data.machines(machine_type_id);
CREATE INDEX IF NOT EXISTS idx_machines_base ON master_data.machines(assigned_base_id);
CREATE INDEX IF NOT EXISTS idx_machine_types_code ON master_data.machine_types(type_code);

-- operations 繧ｹ繧ｭ繝ｼ繝・
CREATE INDEX IF NOT EXISTS idx_schedules_vehicle ON operations.schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON operations.schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON operations.schedules(status);

-- maintenance 繧ｹ繧ｭ繝ｼ繝・
CREATE INDEX IF NOT EXISTS idx_fault_records_vehicle ON maintenance.fault_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fault_records_date ON maintenance.fault_records(fault_date);
CREATE INDEX IF NOT EXISTS idx_fault_records_status ON maintenance.fault_records(status);

-- inspections 繧ｹ繧ｭ繝ｼ繝・
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle ON inspections.inspection_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections.inspection_records(inspection_date);

-- ========================================
-- 螳御ｺ・Γ繝・そ繝ｼ繧ｸ
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '繝・・繧ｿ繝吶・繧ｹ繧ｻ繝・ヨ繧｢繝・・螳御ｺ・ｼ・;
    RAISE NOTICE '========================================';
    RAISE NOTICE '譌｢蟄倥け繝ｩ繧ｦ繝吋B讒矩縺ｫ蟇ｾ蠢・;
    RAISE NOTICE '繧ｹ繧ｭ繝ｼ繝・ master_data, maintenance, operations, inspections, emergency';
    RAISE NOTICE '荳ｻ隕√ユ繝ｼ繝悶Ν:';
    RAISE NOTICE '  - master_data.managements_offices (莠区･ｭ謇)';
    RAISE NOTICE '  - master_data.bases (菫晏ｮ亥渕蝨ｰ)';
    RAISE NOTICE '  - master_data.vehicles (菫晏ｮ育畑霆・';
    RAISE NOTICE '  - master_data.machine_types (讖溽ｨｮ繝槭せ繧ｿ)';
    RAISE NOTICE '  - master_data.machines (讖滓｢ｰ逡ｪ蜿ｷ繝槭せ繧ｿ)';
    RAISE NOTICE '  - master_data.users (繝ｦ繝ｼ繧ｶ繝ｼ)';
    RAISE NOTICE '========================================';
END $$;

