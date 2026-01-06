-- vehicles テーブルに欠落しているカラムを追加
-- 原因: machine_id と office_id が存在せず、JOINに失敗して500エラー

-- 1. machine_id カラムを追加（TEXT型に変更 - machinesテーブルのid型に合わせる）
ALTER TABLE master_data.vehicles 
ADD COLUMN IF NOT EXISTS machine_id TEXT;

-- 2. office_id カラムを追加
ALTER TABLE master_data.vehicles 
ADD COLUMN IF NOT EXISTS office_id INTEGER;

-- 注意: 外部キー制約は machinesテーブルにPRIMARY KEY制約がないため追加しない
-- JOINは機能するが、参照整合性はアプリケーション側で管理する必要がある

-- 3. インデックスを追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_vehicles_machine_id ON master_data.vehicles(machine_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_office_id ON master_data.vehicles(office_id);

-- 確認用クエリ
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'master_data' 
  AND table_name = 'vehicles'
ORDER BY ordinal_position;
