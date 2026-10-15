-- Migration: 009_minimize_common_db
-- Description: common_db を共通管理基盤（コントロールプレーン）として最小化
-- 認証・所属・RBACおよび重複ルーティングテーブルを依存関係順に削除し、業務・認証データをテナントDBへ完全移行する。

-- 1. 旧リソースルーティング・旧アプリルーティング（organizationsへのFKを持つ子テーブル含む）を削除
DROP TRIGGER IF EXISTS trg_app_resource_routing_updated_at ON public.app_resource_routing;
DROP TABLE IF EXISTS public.app_resource_routing;
DROP TABLE IF EXISTS public.tenant_app_routings;
DROP TABLE IF EXISTS public.company_db_routing;

-- 2. RBAC / ユーザー所属関連の参照テーブル（子）を削除
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.user_role_assignments;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.deprecated_user_roles;
DROP TABLE IF EXISTS public.user_org_memberships;
DROP TABLE IF EXISTS public.user_tenants;
DROP TABLE IF EXISTS public.sites;

-- 3. 権限・ロール・ユーザー・組織マスタ（親）を削除
DROP TABLE IF EXISTS public.permissions;
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.organizations;

-- 4. master_data 内の旧重複マスタ・旧設定テーブルを削除
DROP TRIGGER IF EXISTS trg_master_company_db_routing_updated_at ON master_data.company_db_routing;
DROP TABLE IF EXISTS master_data.company_db_routing;
DROP TABLE IF EXISTS master_data.users;
DROP TABLE IF EXISTS master_data.app_config_history;
DROP TABLE IF EXISTS master_data.app_config;

