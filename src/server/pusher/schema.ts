import { type ZodType, z } from "zod";

// Type: Record<channel, Record<event, ZodType>>
export const pusherConfig = {
  spin: z.object({
    selectedUserId: z.string(),
  }),
  join: z.object({
    userId: z.string(),
  }),
  leave: z.object({
    userId: z.string(),
  }),
  delete: z.object({
    wheelId: z.string(),
  }),
} as const;

export type Event = keyof typeof pusherConfig;
export type Data<E extends Event> = z.infer<(typeof pusherConfig)[E]>;

export type PusherInput = {
  [T in Event]: {
    channel: string;
    event: T;
    data: Data<T>;
  };
}[Event];

export const zodConfig = z.custom<PusherInput>((input) => {
  if (!input) {
    return false;
  }
  if (typeof input !== "object") {
    return false;
  }
  if ("channel" in input && "event" in input) {
    const validatedInput = input as {
      channel: string;
      event: string;
      data: unknown;
    };
    if (validatedInput.event in pusherConfig) {
      const eventValidator = pusherConfig[
        validatedInput.event as keyof typeof pusherConfig
      ] as ZodType;
      if (
        eventValidator &&
        eventValidator.safeParse(validatedInput.data).success
      ) {
        return true;
      }
    }
  }
  return false;
});
