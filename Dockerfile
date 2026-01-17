# Node.js 18を使用
FROM node:18-slim

# 作業ディレクトリ
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール (本番環境のみ)
RUN npm install --production

# アプリケーションファイルをコピー
# キャッシュバスティング: ビルド時に必ず最新ファイルを使用
ARG CACHEBUST=20260117-1035
ARG BUILDTIME=unknown
ENV BUILD_TIMESTAMP=${CACHEBUST}
ENV BUILD_TIME=${BUILDTIME}

COPY . .

# ビルド情報を出力
RUN echo "🔨 Build Info:" && \
    echo "  Timestamp: ${CACHEBUST}" && \
    echo "  Build Time: ${BUILDTIME}" && \
    echo "  Node Version: $(node --version)"

# コンテナ起動時に実行するコマンド
CMD ["npm", "start"]

# バージョン番号を自動更新
RUN node update-version.js || true

# 非rootユーザーで実行 (セキュリティのため)
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Cloud Runのデフォルトポート8080を公開
EXPOSE 8080

# 環境変数を設定
ENV NODE_ENV=production

# 本番モードで起動
CMD ["node", "server.js"]
