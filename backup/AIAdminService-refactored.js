/**
 * AI管理サービス（リファクタリング版）
 * 
 * 【変更内容】
 * - ハードコードされた master_data.ai_settings, master_data.ai_knowledge_data を
 *   db-gateway経由の動的ルーティングに変更
 * - 論理リソース名: 'ai_settings', 'ai_knowledge_data' を使用
 * - 後方互換性を保持（フォールバックにより既存環境でも動作）
 */

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs').promises;
const dbGateway = require('../db-gateway-refactored');

class AIAdminService {
  constructor(pool, appId = 'dashboard-ui') {
    this.pool = pool;
    this.storage = new Storage();
    this.appId = appId;
  }

  /**
   * AI設定を全て取得
   */
  async getAISettings() {
    try {
      // ルーティングを使用して動的にテーブルパスを解決
      const route = await dbGateway.getTablePath('ai_settings', this.appId);
      
      const query = `
        SELECT setting_key, setting_value, setting_type, description, updated_at
        FROM ${route.fullPath}
        ORDER BY setting_key
      `;
      const result = await this.pool.query(query);
      
      // 型に応じて値を変換
      const settings = {};
      result.rows.forEach(row => {
        let value = row.setting_value;
        if (row.setting_type === 'json' && value) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.error(`Failed to parse JSON for ${row.setting_key}:`, e);
          }
        } else if (row.setting_type === 'number' && value) {
          value = parseFloat(value);
        } else if (row.setting_type === 'boolean' && value) {
          value = value === 'true' || value === '1';
        }
        settings[row.setting_key] = {
          value,
          type: row.setting_type,
          description: row.description,
          updated_at: row.updated_at
        };
      });
      
      return settings;
    } catch (err) {
      console.error('Error getting AI settings:', err);
      throw err;
    }
  }

  /**
   * AI設定を保存
   */
  async saveAISettings(settings) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // ルーティング解決
      const route = await dbGateway.getTablePath('ai_settings', this.appId);
      
      for (const [key, data] of Object.entries(settings)) {
        let value = data.value;
        
        // 型に応じて文字列に変換
        if (data.type === 'json' && typeof value === 'object') {
          value = JSON.stringify(value);
        } else if (data.type === 'boolean') {
          value = value ? 'true' : 'false';
        } else if (data.type === 'number') {
          value = String(value);
        }
        
        const query = `
          UPDATE ${route.fullPath}
          SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
          WHERE setting_key = $2
        `;
        await client.query(query, [value, key]);
      }
      
      await client.query('COMMIT');
      return { success: true, message: 'AI設定を保存しました' };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error saving AI settings:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * ナレッジデータ一覧を取得
   */
  async getKnowledgeData(filters = {}) {
    try {
      // ルーティング解決
      const route = await dbGateway.getTablePath('ai_knowledge_data', this.appId);
      
      let query = `
        SELECT id, file_name, file_path, file_size_bytes, file_type,
               upload_source, description, tags, is_active, uploaded_by,
               uploaded_at, last_used_at, usage_count
        FROM ${route.fullPath}
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (filters.isActive !== undefined) {
        query += ` AND is_active = $${paramCount}`;
        params.push(filters.isActive);
        paramCount++;
      }

      if (filters.fileType) {
        query += ` AND file_type = $${paramCount}`;
        params.push(filters.fileType);
        paramCount++;
      }

      if (filters.search) {
        query += ` AND (file_name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
        paramCount++;
      }

      query += ` ORDER BY uploaded_at DESC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('Error getting knowledge data:', err);
      throw err;
    }
  }

  /**
   * ナレッジデータを追加（ローカルファイルアップロード）
   */
  async uploadKnowledgeData(fileData, metadata) {
    try {
      // GCS設定を取得
      const settings = await this.getAISettings();
      const bucketName = settings.gcs_bucket_name?.value;
      const folderPath = settings.gcs_knowledge_folder?.value || 'ai-knowledge';

      if (!bucketName) {
        throw new Error('GCSバケット名が設定されていません');
      }

      // GCSにアップロード
      const bucket = this.storage.bucket(bucketName);
      const fileName = `${folderPath}/${Date.now()}_${metadata.fileName}`;
      const file = bucket.file(fileName);

      await file.save(fileData, {
        metadata: {
          contentType: metadata.contentType,
          metadata: {
            uploadedBy: metadata.uploadedBy,
            description: metadata.description || ''
          }
        }
      });

      // db-gatewayのdynamicInsertを使用
      const insertData = {
        file_name: metadata.fileName,
        file_path: fileName,
        file_size_bytes: fileData.length,
        file_type: metadata.fileType,
        upload_source: 'local',
        description: metadata.description,
        tags: metadata.tags || [],
        uploaded_by: metadata.uploadedBy
      };

      const result = await dbGateway.dynamicInsert(
        'ai_knowledge_data',
        insertData,
        true,
        this.appId
      );

      return {
        success: true,
        id: result[0].id,
        message: 'ファイルをアップロードしました'
      };
    } catch (err) {
      console.error('Error uploading knowledge data:', err);
      throw err;
    }
  }

  /**
   * GCSから既存ファイルをインポート
   */
  async importFromGCS(gcsPath, metadata) {
    try {
      const settings = await this.getAISettings();
      const bucketName = settings.gcs_bucket_name?.value;

      if (!bucketName) {
        throw new Error('GCSバケット名が設定されていません');
      }

      // GCSファイルの存在確認
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(gcsPath);
      const [exists] = await file.exists();

      if (!exists) {
        throw new Error(`GCSファイルが見つかりません: ${gcsPath}`);
      }

      // メタデータ取得
      const [fileMetadata] = await file.getMetadata();

      // db-gatewayのdynamicInsertを使用
      const insertData = {
        file_name: path.basename(gcsPath),
        file_path: gcsPath,
        file_size_bytes: parseInt(fileMetadata.size),
        file_type: metadata.fileType || path.extname(gcsPath).slice(1),
        upload_source: 'gcs',
        description: metadata.description,
        tags: metadata.tags || [],
        uploaded_by: metadata.uploadedBy
      };

      const result = await dbGateway.dynamicInsert(
        'ai_knowledge_data',
        insertData,
        true,
        this.appId
      );

      return {
        success: true,
        id: result[0].id,
        message: 'GCSファイルをインポートしました'
      };
    } catch (err) {
      console.error('Error importing from GCS:', err);
      throw err;
    }
  }

  /**
   * ナレッジデータを削除
   */
  async deleteKnowledgeData(id, deleteFromGCS = true) {
    try {
      // データ取得
      const dataResult = await dbGateway.dynamicSelect(
        'ai_knowledge_data',
        { id },
        ['*'],
        1,
        this.appId
      );

      if (dataResult.length === 0) {
        throw new Error('データが見つかりません');
      }

      const data = dataResult[0];

      // GCSから削除（オプション）
      if (deleteFromGCS) {
        const settings = await this.getAISettings();
        const bucketName = settings.gcs_bucket_name?.value;
        
        if (bucketName && data.upload_source === 'local') {
          try {
            const bucket = this.storage.bucket(bucketName);
            const file = bucket.file(data.file_path);
            await file.delete();
          } catch (err) {
            console.warn('Failed to delete from GCS:', err);
          }
        }
      }

      // db-gatewayのdynamicDeleteを使用
      await dbGateway.dynamicDelete(
        'ai_knowledge_data',
        { id },
        false,
        this.appId
      );

      return { success: true, message: 'データを削除しました' };
    } catch (err) {
      console.error('Error deleting knowledge data:', err);
      throw err;
    }
  }

  /**
   * ストレージ統計情報を取得
   */
  async getStorageStats() {
    try {
      // ルーティング解決
      const route = await dbGateway.getTablePath('ai_knowledge_data', this.appId);
      
      const query = `
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size_bytes) as total_size_bytes,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_files,
          COUNT(CASE WHEN upload_source = 'local' THEN 1 END) as local_uploads,
          COUNT(CASE WHEN upload_source = 'gcs' THEN 1 END) as gcs_imports
        FROM ${route.fullPath}
      `;
      const result = await this.pool.query(query);
      
      const stats = result.rows[0];
      stats.total_size_mb = (parseInt(stats.total_size_bytes) / (1024 * 1024)).toFixed(2);
      
      return stats;
    } catch (err) {
      console.error('Error getting storage stats:', err);
      throw err;
    }
  }

  /**
   * ナレッジデータの使用記録を更新
   */
  async recordUsage(id) {
    try {
      // db-gatewayのdynamicUpdateを使用
      await dbGateway.dynamicUpdate(
        'ai_knowledge_data',
        {
          usage_count: 'usage_count + 1', // SQL式として扱うため文字列
          last_used_at: 'CURRENT_TIMESTAMP' // SQL式
        },
        { id },
        false,
        this.appId
      );
    } catch (err) {
      console.error('Error recording usage:', err);
      // SQL式の場合は直接クエリが必要
      try {
        const route = await dbGateway.getTablePath('ai_knowledge_data', this.appId);
        const query = `
          UPDATE ${route.fullPath}
          SET usage_count = usage_count + 1,
              last_used_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `;
        await this.pool.query(query, [id]);
      } catch (innerErr) {
        console.error('Error recording usage (fallback):', innerErr);
      }
    }
  }
}

module.exports = AIAdminService;
