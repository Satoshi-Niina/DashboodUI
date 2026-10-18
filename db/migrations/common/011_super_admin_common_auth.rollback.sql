-- Rollback: 011_super_admin_common_auth

-- 1. pc-superadmin-niina を以前のテナント（daitetsu）に戻す
UPDATE public.devices 
SET 
    tenant_id = 'daitetsu',
    is_super_admin = false,
    updated_at = CURRENT_TIMESTAMP
WHERE device_identifier = 'pc-superadmin-niina';

-- 2. devices から is_super_admin カラムを削除
ALTER TABLE public.devices DROP COLUMN IF EXISTS is_super_admin;

-- 3. super_admins テーブルを削除
DROP TABLE IF EXISTS public.super_admins;
