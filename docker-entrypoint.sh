#!/bin/sh
set -e

# Initialize DB and push schema if needed
if [ ! -f "$DATABASE_PATH" ]; then
  echo "Initializing database at $DATABASE_PATH..."
  cd /app/packages/db
  npx drizzle-kit push 2>&1
  echo "Database schema pushed."

  # Seed default categories using Node directly (no tsx dependency)
  node -e "
    const Database = require('better-sqlite3');
    const { randomUUID } = require('crypto');
    const db = new Database(process.env.DATABASE_PATH);
    db.pragma('journal_mode = WAL');
    const cats = [
      { name: 'Entry Fees', domain: 'karting', icon: 'flag', color: '#ef4444' },
      { name: 'Tires', domain: 'karting', icon: 'circle', color: '#f97316' },
      { name: 'Fuel', domain: 'karting', icon: 'fuel', color: '#eab308' },
      { name: 'Parts & Maintenance', domain: 'karting', icon: 'wrench', color: '#a855f7' },
      { name: 'Travel', domain: 'karting', icon: 'car', color: '#3b82f6' },
      { name: 'Gear', domain: 'karting', icon: 'shield', color: '#6366f1' },
      { name: 'OpenAI', domain: 'ai', icon: 'brain', color: '#10b981' },
      { name: 'Anthropic', domain: 'ai', icon: 'cpu', color: '#f59e0b' },
      { name: 'Google AI', domain: 'ai', icon: 'search', color: '#3b82f6' },
      { name: 'Other AI', domain: 'ai', icon: 'zap', color: '#8b5cf6' },
      { name: 'Uncategorized', domain: 'general', icon: 'box', color: '#71717a' },
    ];
    const stmt = db.prepare('INSERT OR IGNORE INTO categories (id, name, domain, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const c of cats) {
      stmt.run(randomUUID(), c.name, c.domain, c.icon, c.color, new Date().toISOString());
    }
    db.close();
    console.log('Seeded ' + cats.length + ' categories.');
  "
  cd /app
fi

# Start the server
echo "Starting Pitwall on port ${PORT:-3000}..."
cd /app/apps/web
exec npx next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
