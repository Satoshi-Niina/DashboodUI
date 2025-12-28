# Node.js 18を使用
FROM node:18-slim

# 作業ディレクトリ
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションファイルをコピー
COPY . .

# ポート3000を公開
EXPOSE 3000

# 本番モードで起動
CMD ["node", "server.js"]
