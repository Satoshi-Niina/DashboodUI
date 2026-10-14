-- ============================================================================
-- Stage 1 事前確認SQL（列追加前）
-- 対象: 各テナントDB（daitetsu_db / demo_db / kintetsu_db / kosei_db 等）
-- 目的: 列がまだ存在しないこと、想定外の同名列・制約が無いことを確認する。
-- 実行方式: SELECT のみ。
-- 合格条件: 1) が0件（列が未追加）であること。
-- ============================================================================

-- 1) common_user_id 列がまだ存在しないことの確認（0件が合格）
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'common_user_id';

-- 2) 現状の users テーブル構造の記録（適用後との差分比較用に控えておく）
SELECT table_schema, table_name, column_name, ordinal_position, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 3) 現状の行数の記録（適用後との比較用。列追加のみなので変化しない想定）
SELECT current_database() AS tenant_db, COUNT(*) AS user_count FROM public.users;
