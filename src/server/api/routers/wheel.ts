import { and, eq, not, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { wheelSelectionHistory, wheelUsers, wheels } from "~/server/db/schema";

export const wheelRouter = createTRPCRouter({
  createWheel: protectedProcedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const id = nanoid(16);
      await db.insert(wheels).values({
        ownerId: ctx.session.user.id,
        name: input.name,
        publicId: id,
      });
      const wheel = await db.query.wheels.findFirst({
        where: eq(wheels.publicId, id),
      });
      await db.insert(wheelUsers).values({
        userId: ctx.session.user.id,
        wheelId: wheel!.id,
      });
      return wheel;
    }),
  deleteWheel: protectedProcedure
    .input(z.object({ publicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, pusher } = ctx;
      const wheel = await db.query.wheels.findFirst({
        where: and(
          eq(wheels.publicId, input.publicId),
          eq(wheels.ownerId, ctx.session.user.id),
        ),
      });
      if (!wheel) {
        throw new Error("Wheel not found");
      }
      await db
        .delete(wheelSelectionHistory)
        .where(eq(wheelSelectionHistory.wheelId, wheel.id));
      await db.delete(wheelUsers).where(eq(wheelUsers.wheelId, wheel.id));
      await db.delete(wheels).where(eq(wheels.id, wheel.id));
      await pusher?.trigger({
        channel: `private-wheel-${wheel.publicId}`,
        event: "delete",
        data: {
          wheelId: wheel.publicId,
        },
      });
      return wheel;
    }),
  joinWheel: protectedProcedure
    .input(z.object({ publicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, pusher } = ctx;
      const wheel = await db.query.wheels.findFirst({
        where: eq(wheels.publicId, input.publicId),
      });
      if (!wheel) {
        throw new Error("Wheel not found");
      }
      await db.insert(wheelUsers).values({
        userId: ctx.session.user.id,
        wheelId: wheel.id,
      });
      await pusher?.trigger({
        channel: `private-wheel-${wheel.publicId}`,
        event: "join",
        data: {
          userId: ctx.session.user.id,
        },
      });
      return wheel;
    }),
  leaveWheel: protectedProcedure
    .input(z.object({ publicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, pusher } = ctx;
      const wheel = await db.query.wheels.findFirst({
        where: eq(wheels.publicId, input.publicId),
      });
      if (!wheel) {
        throw new Error("Wheel not found");
      }
      await db
        .delete(wheelUsers)
        .where(
          and(
            eq(wheelUsers.wheelId, wheel.id),
            eq(wheelUsers.userId, ctx.session.user.id),
          ),
        );
      await pusher?.trigger({
        channel: `private-wheel-${wheel.publicId}`,
        event: "leave",
        data: {
          userId: ctx.session.user.id,
        },
      });
      return wheel;
    }),
  myWheels: protectedProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    const myWheels = await db.query.wheels.findMany({
      where: eq(wheels.ownerId, ctx.session.user.id),
      with: {
        users: true,
      },
    });
    return myWheels;
  }),
  myParticipatingWheels: protectedProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    const myWheels = await db.query.wheelUsers.findMany({
      where: eq(wheelUsers.userId, ctx.session.user.id),
      with: {
        wheel: true,
      },
    });
    return myWheels.map((w) => w.wheel);
  }),
  getWheel: publicProcedure
    .input(z.object({ publicId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const wheel = await db.query.wheels.findFirst({
        where: eq(wheels.publicId, input.publicId),
        with: {
          users: {
            with: {
              user: true,
            },
          },
          selections: true,
        },
      });
      return wheel;
    }),
  spinWheel: protectedProcedure
    .input(z.object({ publicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db, pusher } = ctx;
      const wheel = await db.query.wheels.findFirst({
        where: and(
          eq(wheels.publicId, input.publicId),
          eq(wheels.ownerId, ctx.session.user.id),
        ),
        with: {
          users: true,
        },
      });
      if (!wheel || wheel.users.length === 0) {
        throw new Error("Wheel not found");
      }
      if (wheel.users.length === 1) {
        const user = wheel.users[0]!;
        await db.insert(wheelSelectionHistory).values({
          userId: user.userId,
          wheelId: wheel.id,
          pointsWhenSelected: user.points,
          dateSelected: new Date(),
        });
        await db
          .update(wheelUsers)
          .set({
            points: 1,
          })
          .where(
            and(
              eq(wheelUsers.wheelId, wheel.id),
              eq(wheelUsers.userId, user.userId),
            ),
          );
        await pusher?.trigger({
          channel: `private-wheel-${wheel.publicId}`,
          event: "spin",
          data: {
            selectedUserId: user.userId,
          },
        });
        return user;
      }
      const totalPoints = wheel.users
        .map((u) => u.points)
        .reduce((a, b) => a + b, 0);
      const pmf = wheel.users.map((u) => {
        return {
          user: u,
          probability: u.points / totalPoints,
        };
      });
      const cdf: typeof pmf = [];
      for (const p of pmf) {
        const last = cdf[cdf.length - 1];
        cdf.push({
          user: p.user,
          probability: last ? last.probability + p.probability : p.probability,
        });
      }
      const rand = Math.random();
      const user = cdf.find((p) => p.probability >= rand)!.user;

      await db.insert(wheelSelectionHistory).values({
        userId: user.userId,
        wheelId: wheel.id,
        pointsWhenSelected: user.points,
        dateSelected: new Date(),
      });
      await db
        .update(wheelUsers)
        .set({
          points: 1,
        })
        .where(
          and(
            eq(wheelUsers.wheelId, wheel.id),
            eq(wheelUsers.userId, user.userId),
          ),
        );
      await db
        .update(wheelUsers)
        .set({
          points: sql`${wheelUsers.points} + 1`,
        })
        .where(
          and(
            eq(wheelUsers.wheelId, wheel.id),
            not(eq(wheelUsers.userId, user.userId)),
          ),
        );
      await pusher?.trigger({
        channel: `private-wheel-${wheel.publicId}`,
        event: "spin",
        data: {
          selectedUserId: user.userId,
        },
      });
      return user;
    }),
});
