#!/bin/bash
# PostgreSQL dump ファイルを復元するスクリプト
# 使用方法: bash restore-db.sh <dump_file> <target_db>

DUMP_FILE=$1
TARGET_DB=$2
DB_HOST="34.97.56.82"
DB_USER="postgres"
DB_PASSWORD="Takabeni"
DB_PORT="55432"

if [ -z "$DUMP_FILE" ] || [ -z "$TARGET_DB" ]; then
  echo "Usage: bash restore-db.sh <dump_file> <target_db>"
  echo "Example: bash restore-db.sh dump-demo_db.dump demo_db"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: Dump file not found: $DUMP_FILE"
  exit 1
fi

echo "Restoring $DUMP_FILE to $TARGET_DB..."

# PostgreSQL 環境変数でパスワード指定
export PGPASSWORD="$DB_PASSWORD"

# pg_restore を実行（またはpsql で復元）
pg_restore -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" \
  -d "$TARGET_DB" \
  --single-transaction \
  "$DUMP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Restore completed successfully"
else
  echo "❌ Restore failed"
  exit 1
fi
