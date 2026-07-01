-- ========================================
-- ダッシュボードUI 初期ルーティング設定（冪等版）
-- ========================================
-- 
-- 【目的】
-- app_resource_routingテーブルにダッシュボードUIの初期マッピングを登録
-- 
-- 【特徴】
-- - 冪等性保証: 何度実行しても同じ結果（ON CONFLICT DO UPDATE使用）
-- - 既存データを上書きせず、新規データのみ追加
-- - is_active = trueで有効化
--
-- 【実行方法】
-- psql -h localhost -U postgres -d webappdb -f init-dashboard-routing.sql
--
-- ========================================

INSERT INTO public.app_resource_routing (
    tenant_key, 
    tenant_name, 
    org_id, 
    database_url, 
    storage_provider, 
    is_default, 
    is_active
) VALUES 
('users', 'ユーザー管理', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true),
('managements_offices', '事業所マスタ', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true),
('bases', '保守基地マスタ', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true),
('vehicles', '保守用車マスタ', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true),
('machines', '機械番号マスタ', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true),
('machine_types', '機種マスタ', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true),
('ai_settings', 'AI設定マスタ', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true),
('ai_knowledge_data', 'AIナレッジデータ', '1f26ebe0-e390-49ee-a81a-9d7e980fe7c2', 'postgresql://localhost:5432/webappdb', 'local', false, true)
ON CONFLICT (tenant_key) 
DO UPDATE SET 
    tenant_name = EXCLUDED.tenant_name,
    org_id = EXCLUDED.org_id,
    database_url = EXCLUDED.database_url,
    is_active = EXCLUDED.is_active,
    updated_at = now();