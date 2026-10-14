-- ============================================================================
-- Stage 1 ロールバックSQL: common_user_id 列を削除する
-- 前提: Stage2（データ移行）・Stage3（アプリ参照切替）が未着手であること。
--       Stage2実行後にこのロールバックを行うと、書き込んだ対応情報は失われる。
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_users_common_user_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS common_user_id;

COMMIT;
