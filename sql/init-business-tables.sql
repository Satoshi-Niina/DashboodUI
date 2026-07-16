-- machine_types と machines テーブルをdemoDB(public schema)に作成
-- ビジネスデータはテナント DB の public schema に配置

-- machine_types テーブル
CREATE TABLE IF NOT EXISTS public.machine_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_type_name VARCHAR(255) NOT NULL,
    model_name VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    manufacturer VARCHAR(255),
    type_code VARCHAR(50),
    type_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machine_types_name ON public.machine_types(machine_type_name);

-- machines テーブル
CREATE TABLE IF NOT EXISTS public.machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_type_id UUID REFERENCES public.machine_types(id),
    serial_number VARCHAR(255) UNIQUE,
    status VARCHAR(50),
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machines_serial ON public.machines(serial_number);
CREATE INDEX IF NOT EXISTS idx_machines_type ON public.machines(machine_type_id);

-- management_offices テーブル
CREATE TABLE IF NOT EXISTS public.management_offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_name VARCHAR(255) NOT NULL,
    office_code VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_management_offices_name ON public.management_offices(office_name);

-- bases テーブル
CREATE TABLE IF NOT EXISTS public.bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_name VARCHAR(255) NOT NULL,
    base_code VARCHAR(100),
    location VARCHAR(255),
    office_id UUID REFERENCES public.management_offices(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bases_name ON public.bases(base_name);

-- inspection_types テーブル
CREATE TABLE IF NOT EXISTS public.inspection_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_type_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_types_name ON public.inspection_types(inspection_type_name);

-- inspection_schedules テーブル
CREATE TABLE IF NOT EXISTS public.inspection_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID REFERENCES public.machines(id),
    inspection_type_id UUID REFERENCES public.inspection_types(id),
    scheduled_date DATE,
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_schedules_machine ON public.inspection_schedules(machine_id);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_date ON public.inspection_schedules(scheduled_date);

-- サンプルデータ（開発用）
INSERT INTO public.machine_types (machine_type_name, model_name, category, manufacturer)
VALUES 
  ('軌道モータカー', '型1', '軌道系', 'Manufacturer A'),
  ('箱トロ', '型2', 'トロ系', 'Manufacturer B'),
  ('鉄トロ', '型3', 'トロ系', 'Manufacturer C')
ON CONFLICT DO NOTHING;

INSERT INTO public.management_offices (office_name, office_code)
VALUES
  ('営業所A', 'OFFICE001'),
  ('営業所B', 'OFFICE002')
ON CONFLICT (office_code) DO NOTHING;
