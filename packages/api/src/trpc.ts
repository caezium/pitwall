import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { PitwallDatabase } from "@pitwall/db";

export type Context = {
  db: PitwallDatabase;
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
