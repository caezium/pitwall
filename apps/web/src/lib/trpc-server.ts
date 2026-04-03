import { createCallerFactory } from "@pitwall/api";
import { appRouter } from "@pitwall/api";
import { db } from "@pitwall/db";

const createCaller = createCallerFactory(appRouter);

export const serverApi = createCaller({ db });
