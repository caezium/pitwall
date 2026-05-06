import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, startAutoBackup } from "@pitwall/api";
import { getDb } from "@pitwall/db";

// Eager-init the DB and start the auto-backup loop.
// `startAutoBackup` is idempotent, so re-evaluation under Next.js HMR is safe.
getDb();
startAutoBackup();

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({ db: getDb() }),
  });

export { handler as GET, handler as POST };
