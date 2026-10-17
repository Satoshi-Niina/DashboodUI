-- ========================================================
-- 010_token_revocation_and_security_guard.sql
-- Phase 2 第2段階修正版: JWT多層失効管理およびPostgreSQL分散ログイン失敗管理
-- 対象DB: common_db (コントロールプレーンDB)
-- ========================================================

-- 1. 個別トークン即時失効テーブル (ログアウト・特定トークン漏洩用)
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,              -- SHA-256ダイジェスト (平文トークンは保持しない)
    jti VARCHAR(128),                                -- JWT jtiクレーム (存在する場合)
    tenant_id VARCHAR(64),                           -- テナント識別子
    user_id VARCHAR(128),                            -- ユーザー識別子
    app_key VARCHAR(64),                             -- 失効元アプリ ('dashboard' | 'inspection' 等)
    reason VARCHAR(255) DEFAULT 'logout',            -- 失効理由
    revoked_by VARCHAR(128) DEFAULT 'self',          -- 失効実行者 ('self' | 'admin' | 'system')
    expires_at TIMESTAMPTZ NOT NULL,                 -- トークン本来の有効期限 (これ以降は自然失効)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 既存テーブルが存在する場合の安全な列追加 (冪等性・下位互換性確保)
ALTER TABLE public.revoked_tokens ADD COLUMN IF NOT EXISTS jti VARCHAR(128);
ALTER TABLE public.revoked_tokens ADD COLUMN IF NOT EXISTS app_key VARCHAR(64);
ALTER TABLE public.revoked_tokens ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
ALTER TABLE public.revoked_tokens ADD COLUMN IF NOT EXISTS user_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at 
    ON public.revoked_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti 
    ON public.revoked_tokens (jti) 
    WHERE jti IS NOT NULL;


-- 2. 範囲失効基準日時管理テーブル (ユーザー全セッション失効・テナント失効用)
CREATE TABLE IF NOT EXISTS public.revocation_rules (
    target_type VARCHAR(32) NOT NULL,                -- 'user' | 'tenant'
    target_id VARCHAR(128) NOT NULL,                 -- user: '{tenant_id}:{user_id}', tenant: '{tenant_id}'
    invalid_before TIMESTAMPTZ NOT NULL,             -- 下位互換用: この基準日時以前(<=)に発行(iat)されたJWTは無効
    generation BIGINT NOT NULL DEFAULT 1,            -- 失効世代番号 (時計差フリー失効判定用, 初期値1)
    reason VARCHAR(255) NOT NULL,                    -- 失効理由 ('admin_force_logout', 'password_change', 等)
    revoked_by VARCHAR(128) NOT NULL DEFAULT 'admin',-- 実行者
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (target_type, target_id),
    CONSTRAINT chk_revocation_rules_type CHECK (target_type IN ('user', 'tenant'))
);

ALTER TABLE public.revocation_rules ADD COLUMN IF NOT EXISTS generation BIGINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_revocation_rules_invalid_before 
    ON public.revocation_rules (invalid_before);


-- 3. 分散ログイン失敗管理テーブル (Cloud Run複数インスタンス対応・複合キー方式)
CREATE TABLE IF NOT EXISTS public.login_attempt_counters (
    tenant_id VARCHAR(64) NOT NULL,                  -- 正規化小文字テナントID
    username VARCHAR(64) NOT NULL,                   -- 正規化小文字ユーザー名
    failure_count INTEGER NOT NULL DEFAULT 1,        -- 連続失敗回数
    score INTEGER NOT NULL DEFAULT 1,                -- ペナルティスコア (3で遅延, 5で一時制限)
    blocked_until TIMESTAMPTZ,                       -- 一時制限解除日時 (NULL = 制限なし)
    reset_generation INTEGER NOT NULL DEFAULT 0,     -- 成功リセット世代番号 (遅延失敗による状態汚染防止用)
    last_failure_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_client_ip VARCHAR(64),                      -- 最終試行元IP (監査・ログ用)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, username),
    CONSTRAINT chk_login_attempts_score CHECK (score >= 0),
    CONSTRAINT chk_login_attempts_count CHECK (failure_count >= 0)
);

ALTER TABLE public.login_attempt_counters ADD COLUMN IF NOT EXISTS reset_generation INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked_until 
    ON public.login_attempt_counters (blocked_until) 
    WHERE blocked_until IS NOT NULL;


-- 3.5 最新世代番号取得用ファンクション (JWT発行時に高速照会)
CREATE OR REPLACE FUNCTION public.get_current_token_generations(
    p_tenant_id VARCHAR(64),
    p_user_id VARCHAR(128)
)
RETURNS TABLE (
    tenant_gen BIGINT,
    user_gen BIGINT
) AS $$
DECLARE
    v_tenant_gen BIGINT := 1;
    v_user_gen BIGINT := 1;
BEGIN
    SELECT COALESCE(generation, 1) INTO v_tenant_gen
    FROM public.revocation_rules
    WHERE target_type = 'tenant' AND target_id = p_tenant_id;
    IF v_tenant_gen IS NULL THEN v_tenant_gen := 1; END IF;

    SELECT COALESCE(generation, 1) INTO v_user_gen
    FROM public.revocation_rules
    WHERE target_type = 'user' AND target_id = (p_tenant_id || ':' || p_user_id);
    IF v_user_gen IS NULL THEN v_user_gen := 1; END IF;

    RETURN QUERY SELECT v_tenant_gen, v_user_gen;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.get_current_token_generations(VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_token_generations(VARCHAR, VARCHAR) TO postgres;


-- 4. 失効総合判定用ストアドファンクション (世代番号優先・時計差フリー・ハイブリッド判定版)
-- 旧5引数シグネチャの安全な置換
DROP FUNCTION IF EXISTS public.check_jwt_revocation(VARCHAR, VARCHAR, VARCHAR, BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION public.check_jwt_revocation(
    p_token_hash VARCHAR(64),
    p_tenant_id VARCHAR(64),
    p_user_id VARCHAR(128),
    p_jwt_iat_sec BIGINT,
    p_jwt_iat_ms BIGINT DEFAULT NULL,
    p_user_gen BIGINT DEFAULT NULL,
    p_tenant_gen BIGINT DEFAULT NULL
)
RETURNS TABLE (
    is_revoked BOOLEAN,
    revocation_type VARCHAR(32),
    revocation_reason VARCHAR(255)
) AS $$
BEGIN
    -- 1. 個別トークン失効判定 (ハッシュ完全一致・即時失効)
    IF EXISTS (
        SELECT 1 FROM public.revoked_tokens 
        WHERE token_hash = p_token_hash AND expires_at > CURRENT_TIMESTAMP
    ) THEN
        RETURN QUERY SELECT true, 'token'::VARCHAR(32), 'Token individually revoked'::VARCHAR(255);
        RETURN;
    END IF;

    -- 2. テナント単位失効判定 (世代番号優先, 未指定時は物理時刻下位互換)
    IF EXISTS (
        SELECT 1 FROM public.revocation_rules 
        WHERE target_type = 'tenant' 
          AND target_id = p_tenant_id 
          AND (
            CASE 
              WHEN p_tenant_gen IS NOT NULL 
                THEN generation > p_tenant_gen
              WHEN p_jwt_iat_ms IS NOT NULL 
                THEN (EXTRACT(EPOCH FROM invalid_before) * 1000)::BIGINT >= p_jwt_iat_ms
              ELSE EXTRACT(EPOCH FROM invalid_before)::BIGINT >= p_jwt_iat_sec
            END
          )
    ) THEN
        RETURN QUERY SELECT true, 'tenant'::VARCHAR(32), 'Tenant sessions force revoked'::VARCHAR(255);
        RETURN;
    END IF;

    -- 3. ユーザー単位全セッション失効判定 (世代番号優先, 未指定時は物理時刻下位互換)
    IF EXISTS (
        SELECT 1 FROM public.revocation_rules 
        WHERE target_type = 'user' 
          AND target_id = (p_tenant_id || ':' || p_user_id)
          AND (
            CASE 
              WHEN p_user_gen IS NOT NULL 
                THEN generation > p_user_gen
              WHEN p_jwt_iat_ms IS NOT NULL 
                THEN (EXTRACT(EPOCH FROM invalid_before) * 1000)::BIGINT >= p_jwt_iat_ms
              ELSE EXTRACT(EPOCH FROM invalid_before)::BIGINT >= p_jwt_iat_sec
            END
          )
    ) THEN
        RETURN QUERY SELECT true, 'user_all'::VARCHAR(32), 'User sessions force revoked'::VARCHAR(255);
        RETURN;
    END IF;

    -- 未失効
    RETURN QUERY SELECT false, NULL::VARCHAR(32), NULL::VARCHAR(255);
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

-- 実行権限の明示
REVOKE ALL ON FUNCTION public.check_jwt_revocation(VARCHAR, VARCHAR, VARCHAR, BIGINT, BIGINT, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_jwt_revocation(VARCHAR, VARCHAR, VARCHAR, BIGINT, BIGINT, BIGINT, BIGINT) TO postgres;


-- 5. 保守用定期クリーンアップファンクション
CREATE OR REPLACE FUNCTION public.cleanup_expired_security_data()
RETURNS void AS $$
BEGIN
    -- 自然期限切れの個別失効トークン削除
    DELETE FROM public.revoked_tokens
    WHERE expires_at < CURRENT_TIMESTAMP;

    -- 最大JWT有効期間(24時間)を超過したユーザー失効ルールの安全な削除 (テナント停止は保持)
    DELETE FROM public.revocation_rules
    WHERE target_type = 'user' 
      AND invalid_before < CURRENT_TIMESTAMP - INTERVAL '2 days';

    -- 一時制限解除後1日以上経過した失敗カウンタの削除
    DELETE FROM public.login_attempt_counters
    WHERE (blocked_until IS NULL OR blocked_until < CURRENT_TIMESTAMP)
      AND last_failure_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.cleanup_expired_security_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_security_data() TO postgres;
