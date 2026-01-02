# Node.js 18を使用
FROM node:18-slim

# 作業ディレクトリ
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール (本番環境のみ)
RUN npm ci --only=production && \
    echo "✅ npm install completed successfully" && \
    ls -la node_modules | head -20

# アプリケーションファイルをコピー
COPY . .

# server.jsの存在確認
RUN ls -la server.js && \
    echo "✅ server.js found" && \
    node -c server.js && \
    echo "✅ server.js syntax is valid"

# 非rootユーザーで実行 (セキュリティのため)
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Cloud Runのデフォルトポート8080を公開
EXPOSE 8080

# 環境変数を設定
ENV NODE_ENV=production

# ヘルスチェック（/healthエンドポイントを使用）
# Cloud Runではstart-periodを長めに設定してDB接続を待つ
# PORT環境変数を使用して動的にポートを取得
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8080; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 起動前の確認
RUN echo "🔍 Pre-flight checks:" && \
    echo "Node version: $(node --version)" && \
    echo "NPM version: $(npm --version)" && \
    echo "Current user: $(whoami)" && \
    echo "Working directory: $(pwd)" && \
    echo "Files:" && ls -la

# 本番モードで起動
CMD echo "🚀 Starting application..." && \
    echo "PORT: ${PORT:-8080}" && \
    echo "NODE_ENV: $NODE_ENV" && \
    node server.js
