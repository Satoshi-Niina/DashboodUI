-- Migration: 011_super_admin_common_auth
-- Description: スーパー管理者（niina）のcommon_db一元認証基盤および専用端末管理の確立

-- 1. スーパー管理者テーブルの作成
CREATE TABLE IF NOT EXISTS public.super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'system_admin',
    display_name VARCHAR(100) NOT NULL DEFAULT '新名 敏（システム管理者）',
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. スーパー管理者 (niina) の初期レコード登録（既存パスワード 0077）
INSERT INTO public.super_admins (id, username, password_hash, role, display_name, is_active)
VALUES (
    'e996e889-4165-412f-8450-8b6e0f193256',
    'niina',
    '$2a$10$pbt2EjNudBzJc8yzDmMg..vvXTk8MzG4XcV53TXuwkFFZBujNkNz.',
    'system_admin',
    '新名 敏（システム管理者）',
    true
)
ON CONFLICT (username) DO UPDATE
SET 
    password_hash = EXCLUDED.password_hash,
    role = 'system_admin',
    display_name = EXCLUDED.display_name,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

-- 3. devices テーブルへのスーパー管理者専用端末フラグの追加
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 4. pc-superadmin-niina の専用端末設定
UPDATE public.devices 
SET 
    tenant_id = 'common',
    is_super_admin = true,
    updated_at = CURRENT_TIMESTAMP
WHERE device_identifier = 'pc-superadmin-niina';
