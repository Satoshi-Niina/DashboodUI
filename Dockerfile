# Node.js 18を使用
FROM node:18-slim

# 作業ディレクトリ
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール (本番環境のみ)
RUN npm ci --only=production

# アプリケーションファイルをコピー
# キャッシュバスティング: ビルド時に必ず最新ファイルを使用
ARG CACHEBUST=1
COPY . .

# 非rootユーザーで実行 (セキュリティのため)
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Cloud Runのデフォルトポート8080を公開
EXPOSE 8080

# 環境変数を設定
ENV NODE_ENV=production

# 本番モードで起動
CMD ["node", "server.js"]
