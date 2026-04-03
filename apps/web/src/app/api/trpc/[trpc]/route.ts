import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@pitwall/api";
import { getDb } from "@pitwall/db";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({ db: getDb() }),
  });

export { handler as GET, handler as POST };
