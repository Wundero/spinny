"use client";
import Pusher, { type Members, type Channel } from "pusher-js";
import { useEffect, createContext, useContext, useState } from "react";
import { env } from "~/env";
import type { Event, Data } from "~/server/pusher/schema";
import { rawAPI } from "~/trpc/vanilla";
import { useSession } from "next-auth/react";
import superjson from "superjson";

let _pusher: Pusher | null = null;

type PusherChannelEvents = {
  "pusher:subscription_succeeded": void;
  "pusher:subscription_error": {
    type: string;
    error: string;
    status: number;
  };
  "pusher:cache_miss": void;
  "pusher:subscription_count": {
    subscription_count: number;
  };
};

type PresenceChannelEvents = {
  "pusher:subscription_succeeded": Members;
  "pusher:subscription_error": {
    type: string;
    error: string;
    status: number;
  };
  "pusher:member_added": {
    id: string;
    info: Record<string, unknown>;
  };
  "pusher:member_removed": {
    id: string;
    info: Record<string, unknown>;
  };
};

const pusherEventNames = [
  "pusher:subscription_succeeded",
  "pusher:subscription_error",
  "pusher:cache_miss",
  "pusher:subscription_count",
  "pusher:member_added",
  "pusher:member_removed",
];

type OverlapEvent =
  | "pusher:subscription_succeeded"
  | "pusher:subscription_error";

type AnyEvent = Event | keyof PresenceChannelEvents | keyof PusherChannelEvents;
type AnyData<E extends AnyEvent> = E extends Event
  ? Data<E>
  : E extends OverlapEvent
    ? PusherChannelEvents[E] | PresenceChannelEvents[E]
    : E extends keyof PusherChannelEvents
      ? PusherChannelEvents[E]
      : E extends keyof PresenceChannelEvents
        ? PresenceChannelEvents[E]
        : never;

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type ChannelTypePrefix = `presence-${string}` | string;

type GEvent<T extends ChannelTypePrefix> = T extends `presence-${string}`
  ? keyof PresenceChannelEvents
  : keyof PusherChannelEvents;
type GData<
  T extends ChannelTypePrefix,
  E extends GEvent<T>,
> = T extends `presence-${string}`
  ? E extends keyof PresenceChannelEvents
    ? PresenceChannelEvents[E]
    : never
  : E extends keyof PusherChannelEvents
    ? PusherChannelEvents[E]
    : never;

type CEvent<T extends ChannelTypePrefix> = Event | GEvent<T>;
type CData<T extends ChannelTypePrefix, E extends CEvent<T>> = E extends Event
  ? Data<E>
  : E extends GEvent<T>
    ? GData<T, E>
    : never;

class WrappedChannel<T extends ChannelTypePrefix> {
  constructor(private _channel: Channel) {}

  wrapCB(cb: (data: never) => void) {
    return (data: string) => {
      cb(superjson.parse(data));
    };
  }

  get channel() {
    return this._channel;
  }

  bind_global(cb: (event: CEvent<T>, data: CData<T, CEvent<T>>) => void) {
    this._channel.bind_global((event: string, data: unknown) => {
      if (pusherEventNames.includes(event)) {
        cb(event as CEvent<T>, data as CData<T, CEvent<T>>);
        return;
      }
      cb(event as Event, superjson.parse<Data<Event>>(data as string));
    });
  }

  unbind_global(cb: (event: CEvent<T>, data: CData<T, CEvent<T>>) => void) {
    this._channel.unbind_global((event: string, data: unknown) => {
      if (pusherEventNames.includes(event)) {
        cb(event as CEvent<T>, data as CData<T, CEvent<T>>);
        return;
      }
      cb(event as Event, superjson.parse<Data<Event>>(data as string));
    });
  }

  bind<E extends CEvent<T>, D extends CData<T, E>>(
    eventName: E,
    cb: (data: D) => void,
  ) {
    if (pusherEventNames.includes(eventName)) {
      this._channel.bind(eventName, cb);
      return;
    } else {
      this._channel.bind(eventName, this.wrapCB(cb));
    }
  }

  unbind<E extends CEvent<T>, D extends CData<T, E>>(
    eventName: E,
    cb: (data: D) => void,
  ) {
    if (pusherEventNames.includes(eventName)) {
      this._channel.unbind(eventName, cb);
      return;
    } else {
      this._channel.unbind(eventName, this.wrapCB(cb));
    }
  }
}

class WrappedPusher {
  constructor(private pusher: Pusher) {}

  get user() {
    return this.pusher.user;
  }

  bind_global(cb: (event: AnyEvent, data: AnyData<AnyEvent>) => void) {
    this.pusher.bind_global((event: string, data: unknown) => {
      if (pusherEventNames.includes(event)) {
        cb(event as AnyEvent, data as AnyData<OverlapEvent>);
        return;
      }
      cb(event as Event, superjson.parse<Data<Event>>(data as string));
    });
  }

  unbind_global(cb: (event: AnyEvent, data: AnyData<AnyEvent>) => void) {
    this.pusher.unbind_global((event: string, data: unknown) => {
      if (pusherEventNames.includes(event)) {
        cb(event as AnyEvent, data as AnyData<OverlapEvent>);
        return;
      }
      cb(event as Event, superjson.parse<Data<Event>>(data as string));
    });
  }

  subscribe<T extends ChannelTypePrefix>(channelName: T): WrappedChannel<T> {
    return new WrappedChannel(this.pusher.subscribe(channelName));
  }

  unsubscribe<T extends ChannelTypePrefix>(channelName: T) {
    this.pusher.unsubscribe(channelName);
  }
}

let pusher: WrappedPusher | null = null;

if (
  env.NEXT_PUBLIC_PUSHER_KEY &&
  env.NEXT_PUBLIC_PUSHER_HOST &&
  typeof window !== "undefined"
) {
  _pusher = new Pusher(env.NEXT_PUBLIC_PUSHER_KEY, {
    userAuthentication: {
      // These two are mandatory in TS but not used
      endpoint: "/api/pusher/auth",
      transport: "ajax",
      customHandler(info, callback) {
        rawAPI.pusher.authenticateUser
          .mutate({
            socketId: info.socketId,
          })
          .then((data) => {
            callback(null, data);
          })
          .catch((err: Error) => {
            callback(err, null);
          });
      },
    },
    channelAuthorization: {
      // These two are mandatory in TS but not used
      endpoint: "/api/pusher/auth",
      transport: "ajax",
      customHandler(info, callback) {
        rawAPI.pusher.authorizeUserForRoom
          .mutate({
            socketId: info.socketId,
            channelName: info.channelName,
          })
          .then((data) => {
            callback(null, data);
          })
          .catch((err: Error) => {
            callback(err, null);
          });
      },
    },
    wsHost: env.NEXT_PUBLIC_PUSHER_HOST,
    wsPort: 443,
    wssPort: 443,
    forceTLS: true,
    disableStats: true,
    enabledTransports: ["ws", "wss"],
    cluster: "",
  });
  pusher = new WrappedPusher(_pusher);
}

class ChannelRef<T extends ChannelTypePrefix> {
  channel: WrappedChannel<T>;
  rc: number;

  constructor(channel: WrappedChannel<T>) {
    this.channel = channel;
    this.rc = 0;
  }

  getChannel() {
    return this.channel;
  }

  getRC() {
    return this.rc;
  }

  incrementRC() {
    this.rc++;
  }

  decrementRC() {
    this.rc--;
  }
}

export type PusherContextState = {
  pusher: WrappedPusher | null;
  channels: Map<string, ChannelRef<never>>;
};

const channels = new Map<string, ChannelRef<never>>();

export const PusherContext = createContext<PusherContextState>({
  pusher,
  channels,
});

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const sess = useSession();

  useEffect(() => {
    if (!pusher || !sess.data) {
      return;
    }
    if (!pusher.user.user_data) {
      pusher.user.signin();
    }
  }, [sess]);

  useEffect(() => {
    // TODO bind only in non-prod
    // TODO prettier logging
    if (!pusher) {
      return;
    }
    pusher.bind_global((event, data) => {
      console.log("global pusher event", event, data);
    });
    return () => {
      pusher?.unbind_global((event, data) => {
        console.log("global pusher event", event, data);
      });
    };
  }, []);

  return (
    <PusherContext.Provider value={{ pusher, channels }}>
      {children}
    </PusherContext.Provider>
  );
}

export function usePusherChannel<T extends ChannelTypePrefix>(channelName: T) {
  const { pusher, channels } = useContext(PusherContext);
  const [channel, setChannel] = useState<WrappedChannel<T> | null>(null);
  useEffect(() => {
    if (!pusher) return;
    const channelRef =
      (channels.get(channelName) as unknown as ChannelRef<T>) ??
      new ChannelRef<T>(pusher.subscribe(channelName));
    channelRef.incrementRC();
    channels.set(channelName, channelRef as unknown as ChannelRef<never>);
    setChannel(channelRef.channel);
    return () => {
      const channelRC = channelRef.getRC();
      if (channelRC <= 1) {
        channels.delete(channelName);
        pusher.unsubscribe(channelName);
      } else {
        channelRef.decrementRC();
      }
      setChannel(null);
    };
  }, [channelName, pusher, channels]);
  return channel;
}

export function usePusherEvent<
  C extends ChannelTypePrefix,
  E extends CEvent<C>,
  D extends CData<C, E>,
>(channelName: C, eventName: E, onEvent: (data: D) => void) {
  const channel = usePusherChannel(channelName);
  useEffect(() => {
    if (!channel) return;
    channel.bind(eventName, onEvent);
    return () => {
      channel.unbind(eventName, onEvent);
    };
  }, [channelName, eventName, onEvent, channel]);
}
