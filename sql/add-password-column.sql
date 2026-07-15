-- テナント DB の users テーブルに password カラムを追加するスクリプト
-- 各テナント DB (kosei_db, demo_db, daitetsu_db) に対して実行

-- kosei_db
\c kosei_db

-- password カラムが存在しない場合のみ追加
ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT NULL;

-- demo_db
\c demo_db

ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT NULL;

-- daitetsu_db
\c daitetsu_db

ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT NULL;

-- 確認
\c kosei_db
\d+ public.users

\c demo_db
\d+ public.users

\c daitetsu_db
\d+ public.users
