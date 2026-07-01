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
ARG CACHEBUST=20260120-1500
ARG BUILDTIME=unknown
ENV BUILD_TIMESTAMP=${CACHEBUST}
ENV BUILD_TIME=${BUILDTIME}

COPY . .

# ビルド情報を出力
RUN echo "🔨 Build Info:" && \
    echo "  Timestamp: ${CACHEBUST}" && \
    echo "  Build Time: ${BUILDTIME}" && \
    echo "  Node Version: $(node --version)"

# Cloud Runでは非rootユーザーで実行することが推奨されますが、
# Cloud SQL Proxyとの接続でパーミッション問題が発生する可能性があるため、
# 本番環境ではrootで実行します（Cloud Runのセキュリティモデルで保護されます）
# RUN useradd -m appuser && chown -R appuser:appuser /app
# USER appuser

# Cloud Runのデフォルトポート8080を公開
EXPOSE 8080

# 環境変数を設定
ENV NODE_ENV=production

# 本番モードで起動
CMD ["node", "server.js"]
