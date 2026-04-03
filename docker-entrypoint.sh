#!/bin/sh
set -e

# Initialize DB and push schema if needed
if [ ! -f "$DATABASE_PATH" ]; then
  echo "Initializing database at $DATABASE_PATH..."
  cd /app/packages/db
  npx drizzle-kit push 2>&1
  echo "Database schema pushed."

  # Seed default categories
  npx tsx src/seed.ts 2>&1
  echo "Default categories seeded."
  cd /app
fi

# Start the server
echo "Starting Pitwall on port ${PORT:-3000}..."
exec node apps/web/.next/standalone/apps/web/server.js
