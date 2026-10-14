-- ============================================================================
-- Stage 3 監視SQL（アプリ参照切替の前後で使用）
-- 目的: 「ログイン失敗率」と「フォールバック率」を別々の指標として集計する。
--   - ログイン失敗率 = 失敗したログイン試行数 ÷ 総ログイン試行数
--   - フォールバック率 = common_user_id不使用で成立した成功試行数 ÷ ログイン成功試行数
--   両者は原因が異なるため合算しない（07_stage3_release_notes.md参照）。
-- 前提: アプリ側が各ログイン試行の都度、下記テーブルへ1行INSERTする実装を
--       Stage3のアプリ変更に含める（記録処理の実装自体は本タスクでは行わない。
--       テーブル定義とINSERT/集計SQLのみ用意する）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- テーブル定義（Stage3準備。各テナントDBに作成）
-- auth_method:
--   'common_user_id'     : common_user_id一致で成立（フォールバックなし）
--   'fallback_id'        : 限定フォールバック方針でid一致により成立
--   'fallback_username'  : username一致のみで成立（切替前の旧経路。監視対象）
--   'denied_no_mapping'  : 拒否方針によりcommon_user_id未設定のため拒否
--   'failed_credentials' : common_user_idの有無に関係ない認証失敗（パスワード相違等）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_audit.login_attempt_log (
  id          bigserial PRIMARY KEY,
  tenant_db   text        NOT NULL,
  username    text        NOT NULL,
  succeeded   boolean     NOT NULL,
  auth_method text        NOT NULL CHECK (auth_method IN (
                'common_user_id', 'fallback_id', 'fallback_username',
                'denied_no_mapping', 'failed_credentials'
              )),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_log_tenant_time
  ON ops_audit.login_attempt_log (tenant_db, occurred_at);

-- ----------------------------------------------------------------------------
-- アプリ側の記録例（設計のみ。実装はStage3のアプリ変更で行う）:
--   INSERT INTO ops_audit.login_attempt_log (tenant_db, username, succeeded, auth_method)
--   VALUES (current_database(), :username, :succeeded, :auth_method);
-- ----------------------------------------------------------------------------

-- 1) common_user_id が未設定のまま存在する有効ユーザー（切替後の残課題）
SELECT current_database() AS tenant_db, id AS tenant_user_id, username
FROM public.users
WHERE is_active = true AND common_user_id IS NULL
ORDER BY username;

-- 2) ログイン失敗率（直近7日、テナント単位）。succeeded=falseの割合。
SELECT
  tenant_db,
  COUNT(*) FILTER (WHERE NOT succeeded)::numeric / NULLIF(COUNT(*), 0) AS login_failure_rate,
  COUNT(*) FILTER (WHERE NOT succeeded) AS failed_attempts,
  COUNT(*) AS total_attempts
FROM ops_audit.login_attempt_log
WHERE occurred_at >= now() - interval '7 days'
GROUP BY tenant_db
ORDER BY tenant_db;

-- 3) フォールバック率（直近7日、テナント単位）。
--    分母はログイン成功試行数、分子はcommon_user_id不使用で成立した成功試行数。
SELECT
  tenant_db,
  COUNT(*) FILTER (
    WHERE succeeded AND auth_method <> 'common_user_id'
  )::numeric / NULLIF(COUNT(*) FILTER (WHERE succeeded), 0) AS fallback_rate,
  COUNT(*) FILTER (WHERE succeeded AND auth_method <> 'common_user_id') AS fallback_count,
  COUNT(*) FILTER (WHERE succeeded) AS successful_attempts
FROM ops_audit.login_attempt_log
WHERE occurred_at >= now() - interval '7 days'
GROUP BY tenant_db
ORDER BY tenant_db;

-- 4) auth_method別の内訳（原因分析用。fallback_usernameが増えていないか等を確認）
SELECT
  tenant_db, auth_method, COUNT(*) AS attempt_count
FROM ops_audit.login_attempt_log
WHERE occurred_at >= now() - interval '7 days'
GROUP BY tenant_db, auth_method
ORDER BY tenant_db, auth_method;

