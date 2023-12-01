import Pusher from "pusher";
import { env } from "~/env";
import superjson from "superjson";
import type { PusherInput, Data, Event } from "./schema";

let _pusher: Pusher | null = null;

if (
  env.PUSHER_APP_ID &&
  env.NEXT_PUBLIC_PUSHER_KEY &&
  env.PUSHER_SECRET &&
  env.NEXT_PUBLIC_PUSHER_HOST
) {
  _pusher = new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.NEXT_PUBLIC_PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    useTLS: true,
    host: env.NEXT_PUBLIC_PUSHER_HOST,
    port: "443",
  });
}

class TypedPusher {
  private innerPusher: Pusher;

  constructor(pusher: Pusher) {
    this.innerPusher = pusher;
  }

  // WARN: untested
  terminateUserConnections(userId: string) {
    return this.innerPusher.terminateUserConnections(userId);
  }

  // WARN: untested
  webhook(request: Pusher.WebHookRequest) {
    return this.innerPusher.webhook(request);
  }

  // WARN: This doesn't seem to work with Soketi
  /**
   * @deprecated Use `trigger` since this doesn't always work with Soketi
   */
  sendToUser<E extends Event>(userId: string, event: E, data: Data<E>) {
    return this.innerPusher.sendToUser(
      userId,
      event,
      superjson.stringify(data),
    );
  }

  // WARN: untested
  createSignedQueryString(options: Pusher.SignedQueryStringOptions) {
    return this.innerPusher.createSignedQueryString(options);
  }

  authenticateUser(socketId: string, userData: Pusher.UserChannelData) {
    return this.innerPusher.authenticateUser(socketId, userData);
  }

  authorizeChannel(
    socketId: string,
    channel: string,
    data?: Pusher.PresenceChannelData,
  ) {
    return this.innerPusher.authorizeChannel(socketId, channel, data);
  }

  trigger(input: PusherInput) {
    return this.innerPusher.trigger(
      input.channel,
      input.event,
      superjson.stringify(input.data),
    );
  }
}

export const pusher = _pusher ? new TypedPusher(_pusher) : null;
