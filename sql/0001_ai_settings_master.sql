-- AI設定管理テーブル（マスターデータ）
-- 全てのアプリで共通参照するための設定値マスター

CREATE SCHEMA IF NOT EXISTS master_data;

CREATE TABLE IF NOT EXISTS master_data.ai_settings (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    setting_type VARCHAR(50) NOT NULL, -- 'rag', 'assist', 'model', 'storage'
    settings_json JSONB NOT NULL,       -- 設定値本体
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, setting_type)
);

-- 初期データの投入
INSERT INTO master_data.ai_settings (app_id, setting_type, settings_json)
VALUES 
('common', 'model', '{
    "apiKey": "",
    "modelName": "gemini-1.5-pro",
    "temperature": 0.7,
    "maxTokens": 2048,
    "responseLanguage": "ja"
}'),
('common', 'rag', '{
    "enabled": true,
    "chunkSize": 500,
    "chunkOverlap": 200,
    "similarityThreshold": 0.7,
    "maxResults": 5,
    "enableSemantic": true,
    "enableKeyword": true,
    "customInstructions": "",
    "preprocessing": {
        "removeStopWords": true,
        "normalizeCasing": true,
        "removeSpecialChars": false
    }
}'),
('common', 'assist', '{
    "initialPrompt": "何か問題がありましたか？お困りの事象を教えてください！",
    "conversationStyle": "frank",
    "questionFlow": {
        "step1": "具体的な症状を教えてください",
        "step2": "いつ頃から発生していますか？",
        "step3": "作業環境や状況を教えてください",
        "step4": "他に気になることはありますか？",
        "step5": "緊急度を教えてください"
    },
    "branchingConditions": {
        "timeCheck": true,
        "detailsCheck": true,
        "toolsCheck": true,
        "safetyCheck": true
    },
    "responsePattern": "step_by_step",
    "escalationTime": 20,
    "customInstructions": "",
    "enableEmergencyContact": true
}'),
('common', 'storage', '{
    "gcsBucketName": "",
    "gcsKnowledgeFolder": "knowledge-data",
    "maxUploadSizeMB": 100,
    "allowedFileTypes": ["pdf", "txt", "md", "docx", "json", "xlsx"]
}')
ON CONFLICT (app_id, setting_type) DO NOTHING;

-- ナレッジデータ管理テーブル
CREATE TABLE IF NOT EXISTS master_data.ai_knowledge_data (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- GCS上のパス
    file_size_bytes BIGINT,
    file_type VARCHAR(50),
    upload_source VARCHAR(50), -- 'local' or 'gcs'
    description TEXT,
    tags TEXT[], -- 検索用タグ
    is_active BOOLEAN DEFAULT true,
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_tags ON master_data.ai_knowledge_data USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_active ON master_data.ai_knowledge_data(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_type ON master_data.ai_knowledge_data(file_type);

-- 更新トリガー
CREATE OR REPLACE FUNCTION update_ai_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_settings_update_timestamp
    BEFORE UPDATE ON master_data.ai_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_settings_timestamp();

COMMENT ON TABLE master_data.ai_settings IS 'AI（Gemini）の共通設定を管理するマスターテーブル';
COMMENT ON TABLE master_data.ai_knowledge_data IS 'AIナレッジデータの管理テーブル';
