-- ============================================================================
-- Stage 1 適用後確認SQL
-- 合格条件:
--   1) 列が存在し、型 uuid・NULL許容であること
--   2) 全行が NULL であること（Stage1では書き込みを行わないため）
--   3) 行数が事前確認時と一致すること（列追加以外のデータ変化が無いこと）
-- ============================================================================

-- 1) 列定義の確認
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'common_user_id';

-- 2) 全行NULLであることの確認（0件が合格）
SELECT COUNT(*) AS non_null_count
FROM public.users
WHERE common_user_id IS NOT NULL;

-- 3) 行数の確認（事前確認時のuser_countと一致すること）
SELECT current_database() AS tenant_db, COUNT(*) AS user_count FROM public.users;
