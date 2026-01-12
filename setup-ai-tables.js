/**
 * AI管理用テーブルのセットアップスクリプト
 * 
 * 使用方法:
 * node setup-ai-tables.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupAITables() {
    console.log('🚀 AI管理テーブルのセットアップを開始します...');

    // データベース接続設定
    const pool = new Pool({
        host: process.env.DB_HOST || '/cloudsql/' + process.env.CLOUD_SQL_INSTANCE,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432
    });

    try {
        // SQLファイルを読み込む
        const sqlPath = path.join(__dirname, 'sql', '0001_ai_settings_master.sql');
        console.log('📄 SQLファイルを読み込んでいます:', sqlPath);
        
        if (!fs.existsSync(sqlPath)) {
            throw new Error('SQLファイルが見つかりません: ' + sqlPath);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // SQLを実行
        console.log('⚙️ SQLを実行しています...');
        await pool.query(sql);
        
        console.log('✅ AI管理テーブルのセットアップが完了しました！');
        console.log('');
        console.log('作成されたテーブル:');
        console.log('  - master_data.ai_settings');
        console.log('  - master_data.ai_knowledge_data');
        console.log('');
        console.log('次のステップ:');
        console.log('  1. npm install を実行して新しい依存関係をインストール');
        console.log('  2. サーバーを再起動');
        console.log('  3. 管理画面から AI管理 タブにアクセス');

    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

setupAITables();
