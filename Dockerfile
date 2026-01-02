# Node.js 18を使用
FROM node:18-slim

# 作業ディレクトリ
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール (本番環境のみ)
RUN npm ci --only=production

# アプリケーションファイルをコピー
COPY . .

# 非rootユーザーで実行 (セキュリティのため)
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# ポート3000を公開
EXPOSE 3000

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=3000

# ヘルスチェック（/healthエンドポイントを使用）
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 本番モードで起動
CMD ["node", "server.js"]
