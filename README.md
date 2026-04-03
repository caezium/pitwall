# Pitwall

Personal finance command center. Tracks competitive karting expenses, AI API token costs, and IBKR investment portfolio in one self-hosted app.

## What it does

| Domain | Features |
|--------|----------|
| **Karting** | Expense tracking by category (entry fees, tires, fuel, parts, travel, gear), event/track tagging, cost-per-race stats, season overview |
| **AI Costs** | Auto-sync from Anthropic & OpenAI billing APIs, per-model breakdown, daily trend, manual entry + CSV import |
| **Investments** | IBKR portfolio positions, P&L, allocation, trade history, daily snapshots via IB Gateway or Flex Query import |
| **Budgets** | Category budgets with monthly/quarterly/yearly periods, progress tracking, 3-month rolling average forecast |

## Stack

- **Web**: Next.js 15 (App Router)
- **Mobile**: Expo Router (iOS/Android)
- **API**: tRPC — end-to-end type safety, shared between web & mobile
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Monorepo**: Turborepo + pnpm

## Quick start

### Docker (recommended)

```bash
docker compose up -d
# → http://localhost:3000
```

Data persists in a Docker volume. DB is auto-initialized and seeded on first run.

### Local development

```bash
pnpm install
DATABASE_PATH=$PWD/pitwall.db pnpm --filter @pitwall/db push
DATABASE_PATH=$PWD/pitwall.db pnpm --filter @pitwall/web dev
# → http://localhost:3000
```

### Mobile

```bash
# Web app must be running (serves the API)
pnpm --filter @pitwall/mobile dev
# Scan QR with Expo Go
```

## Project structure

```
pitwall/
├── apps/
│   ├── web/                 # Next.js 15 — dashboard UI
│   └── mobile/              # Expo — iOS/Android app
├── packages/
│   ├── db/                  # Drizzle schema, migrations, DB client
│   ├── api/                 # tRPC routers + integration services
│   ├── shared/              # Utilities (formatCurrency, formatDate)
│   └── ui/                  # Shared components (placeholder)
├── docker-compose.yml
├── Dockerfile
└── pitwall.db               # SQLite database (gitignored)
```

## Pages

| Route | Type | Description |
|-------|------|-------------|
| `/` | Server | Dashboard overview — burn rate, AI costs, portfolio, domain breakdown |
| `/expenses` | Client | Full CRUD — add/edit/delete with category, event name, track |
| `/karting` | Client | Season stats, cost per race, category bars, event tracker |
| `/ai-costs` | Client | Provider/model breakdown, daily trend, sync button |
| `/investments` | Client | Positions table, allocation chart, P&L, recent trades |
| `/budgets` | Client | Budget cards with progress bars, forecast |
| `/settings` | Client | API keys (Anthropic, OpenAI), IBKR gateway config |

## Configuration

Set API keys in the Settings page (`/settings`), or directly in the DB:

| Setting | Purpose |
|---------|---------|
| `anthropic_admin_api_key` | Sync Anthropic usage (Admin API key, starts with `sk-ant-admin`) |
| `openai_api_key` | Sync OpenAI usage |
| `ibkr_gateway_host` | IB Gateway hostname (default: `127.0.0.1`) |
| `ibkr_gateway_port` | IB Gateway port (`7497` = live, `7496` = paper) |

## Data import

### CSV

All domains support CSV import via the tRPC `import.parseCSV` and `import.execute` endpoints. Headers are fuzzy-matched to target fields.

### IBKR Flex Query

Export an Activity Statement XML from IBKR Client Portal → import via the IBKR connector's `importFlexTrades()` method.

### AI billing sync

Configure API keys in Settings → click "Sync Now" on the AI Costs page. Polls Anthropic Admin API and OpenAI Usage API. Runs incrementally from last sync date.

## Database

SQLite with WAL mode. Schema managed by Drizzle ORM.

```bash
# Push schema changes
pnpm --filter @pitwall/db push

# Open Drizzle Studio (visual DB browser)
pnpm --filter @pitwall/db studio

# Seed default categories
cd packages/db && npx tsx src/seed.ts
```

### Default categories

**Karting**: Entry Fees, Tires, Fuel, Parts & Maintenance, Travel, Gear
**AI**: OpenAI, Anthropic, Google AI, Other AI
**General**: Uncategorized

## Docker

```bash
docker compose up -d        # Start
docker compose down          # Stop
docker compose up --build -d # Rebuild after code changes
docker logs pitwall          # View logs
```

Data lives in the `pitwall_data` volume. To back up:

```bash
docker cp pitwall:/data/pitwall.db ./pitwall-backup.db
```

## License

Private — personal use.
