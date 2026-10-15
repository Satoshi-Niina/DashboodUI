-- ========================================================
-- 007_device_certificates.sql
-- 会社管理端末（iPad等）の登録およびクライアント証明書管理テーブル
-- ========================================================

CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_identifier VARCHAR(100) NOT NULL UNIQUE,
    tenant_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.device_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    fingerprint256 VARCHAR(128) NOT NULL UNIQUE,
    subject_dn TEXT,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_certs_fingerprint ON public.device_certificates(fingerprint256);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_id ON public.devices(tenant_id);

-- 初期端末シードデータ (ローカル検証用)
-- 1. 大鉄工業 会社管理iPad
INSERT INTO public.devices (id, device_identifier, tenant_id, device_name, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'ipad-daitetsu-001',
    'daitetsu',
    '大鉄工業 保守管理iPad #1',
    true
)
ON CONFLICT (device_identifier) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id, is_active = EXCLUDED.is_active;

INSERT INTO public.device_certificates (device_id, serial_number, fingerprint256, subject_dn, is_revoked)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    '54c259fd646e03eeaf208341cf7de1a70ed1bbdd',
    '017bdb02011d8933801e14b14b3a216efe34cb9da8450d6b79448e196a67574e',
    'CN=iPad-Daitetsu-001, O=Daitetsu Kogyo, OU=Operations',
    false
)
ON CONFLICT (fingerprint256) DO UPDATE
SET is_revoked = false;

-- 2. デモ 会社管理iPad
INSERT INTO public.devices (id, device_identifier, tenant_id, device_name, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'ipad-demo-001',
    'demo',
    'デモ環境 保守管理iPad #1',
    true
)
ON CONFLICT (device_identifier) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id, is_active = EXCLUDED.is_active;

INSERT INTO public.device_certificates (device_id, serial_number, fingerprint256, subject_dn, is_revoked)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    '54c259fd646e03eeaf208341cf7de1a70ed1bbde',
    '492f9904dd1d38ff30be00171e78b20c55dc0c8cadfbd552776d54bd7a954aed',
    'CN=iPad-Demo-001, O=Demo Corp, OU=Operations',
    false
)
ON CONFLICT (fingerprint256) DO UPDATE
SET is_revoked = false;

-- 3. 失効済み端末 (テスト用)
INSERT INTO public.devices (id, device_identifier, tenant_id, device_name, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'ipad-daitetsu-revoked',
    'daitetsu',
    '大鉄工業 失効iPad (紛失端末)',
    false
)
ON CONFLICT (device_identifier) DO UPDATE
SET is_active = false;

INSERT INTO public.device_certificates (device_id, serial_number, fingerprint256, subject_dn, is_revoked, revoked_at)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    '9999999999999999999999999999999999999999',
    'revoked-test-fingerprint-0000000000000000000000000000000000000000',
    'CN=iPad-Daitetsu-Revoked, O=Daitetsu Kogyo',
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT (fingerprint256) DO UPDATE
SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP;
