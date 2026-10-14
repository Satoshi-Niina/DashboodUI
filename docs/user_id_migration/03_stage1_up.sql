-- ============================================================================
-- Stage 1 適用SQL: common_user_id 列追加（データ移行は含まない）
-- 対象: 各テナントDB（daitetsu_db / demo_db / kintetsu_db / kosei_db 等）
-- 冪等性: IF NOT EXISTS を使用しているため再実行しても結果は変わらない。
-- 注意: common_db と別DBのため、外部キー(FK)は設定できない。
--       参照整合性はStage2の適用SQL側のチェックで担保する。
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS common_user_id uuid NULL;

COMMENT ON COLUMN public.users.common_user_id IS
  'common_db.public.users.id への対応先ID。ローカルのuser_idと異なる場合がある。Stage2(承認済み対応表)経由でのみ更新すること。';

-- 検索用インデックス（一意制約は入れない。区分Cのような未解決重複を将来的に
-- 検知するためにも、一意性はStage2完了後・運用確定後に別途検討する）
CREATE INDEX IF NOT EXISTS idx_users_common_user_id
  ON public.users (common_user_id);

COMMIT;
