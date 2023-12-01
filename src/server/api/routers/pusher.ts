/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    createTRPCRouter,
    publicProcedure,
    protectedProcedure,
  } from "~/server/api/trpc";
  import { TRPCError } from "@trpc/server";
  import type { Session } from "next-auth";
  import { z } from "zod";
  
  type ChannelType = "public" | "private" | "presence" | "encrypted";
  
  function canUserUseChannel(channelName: string, user: Session["user"]) {
    let channelType: ChannelType = "public";
    let channel = "";
    if (channelName.startsWith("private-")) {
      channelType = "private";
      channel = channelName.substring("private-".length);
    } else if (channelName.startsWith("private-encrypted-")) {
      channelType = "encrypted";
      channel = channelName.substring("private-encrypted-".length);
    } else if (channelName.startsWith("presence-")) {
      channelType = "presence";
      channel = channelName.substring("presence-".length);
    }
    if (channel.startsWith("user-")) {
      return channel.substring("user-".length) === user.id;
    }
    return true;
  }
  
  export const pusherRouter = createTRPCRouter({
    authenticateUser: protectedProcedure
      .input(
        z.object({
          socketId: z.string(),
        }),
      )
      .mutation(({ input, ctx }) => {
        const { pusher, session } = ctx;
        if (!pusher) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Pusher not initialized",
          });
        }
        return pusher.authenticateUser(input.socketId, {
          id: session.user.id,
          user_info: session.user,
        });
      }),
    authorizeUserForRoom: protectedProcedure
      .input(z.object({ socketId: z.string(), channelName: z.string() }))
      .mutation(({ input, ctx }) => {
        const { pusher, session } = ctx;
        if (!pusher) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Pusher not initialized",
          });
        }
        if (!canUserUseChannel(input.channelName, session.user)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not allowed to use this channel",
          });
        }
        return pusher.authorizeChannel(
          input.socketId,
          input.channelName,
          input.channelName.startsWith("presence-")
            ? {
                user_id: session.user.id,
                user_info: session.user,
              }
            : undefined,
        );
      }),
  });
  