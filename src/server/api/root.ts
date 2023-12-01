import { wheelRouter } from "~/server/api/routers/wheel";
import { createTRPCRouter } from "~/server/api/trpc";
import { pusherRouter } from "./routers/pusher";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  wheel: wheelRouter,
  pusher: pusherRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
