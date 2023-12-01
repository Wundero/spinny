import { relations, sql } from "drizzle-orm";
import {
  bigint,
  char,
  index,
  int,
  mysqlTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { type AdapterAccount } from "next-auth/adapters";
import { nanoid } from "nanoid";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const mysqlTable = mysqlTableCreator((name) => `spinny_${name}`);

export const wheels = mysqlTable(
  "wheel",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().autoincrement(),
    publicId: char("publicId", { length: 16 })
      .notNull()
      .unique()
      .$default(() => nanoid(16)),
    name: varchar("name", { length: 256 }),
    ownerId: varchar("ownerId", { length: 255 }).notNull(),
  },
  (wheel) => ({
    ownerIdIdx: index("ownerId_idx").on(wheel.ownerId),
  }),
);

export const wheelRelations = relations(wheels, ({ one, many }) => ({
  owner: one(users, { fields: [wheels.ownerId], references: [users.id] }),
  selections: many(wheelSelectionHistory),
  users: many(wheelUsers),
}));

export const wheelUsers = mysqlTable(
  "wheelUser",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().autoincrement(),
    wheelId: bigint("wheelId", { mode: "bigint" }).notNull(),
    userId: varchar("userId", { length: 255 }).notNull(),
    points: int("points").notNull().default(1),
  },
  (wheelUser) => ({
    wheelIdIdx: index("wheelId_idx").on(wheelUser.wheelId),
    userIdIdx: index("userId_idx").on(wheelUser.userId),
  }),
);

export const wheelUsersRelations = relations(wheelUsers, ({ one }) => ({
  wheel: one(wheels, { fields: [wheelUsers.wheelId], references: [wheels.id] }),
  user: one(users, { fields: [wheelUsers.userId], references: [users.id] }),
}));

export const wheelSelectionHistory = mysqlTable(
  "wheelSelectionHistory",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().autoincrement(),
    publicId: char("publicId", { length: 16 })
      .notNull()
      .unique()
      .$default(() => nanoid(16)),
    wheelId: bigint("wheelId", { mode: "bigint" }).notNull(),
    userId: varchar("userId", { length: 255 }).notNull(),
    pointsWhenSelected: int("pointsWhenSelected").notNull(),
    dateSelected: timestamp("dateSelected", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (wheelSelectionHistory) => ({
    wheelIdIdx: index("wheelId_idx").on(wheelSelectionHistory.wheelId),
    userIdIdx: index("userId_idx").on(wheelSelectionHistory.userId),
  }),
);

export const wheelSelectionHistoryRelations = relations(
  wheelSelectionHistory,
  ({ one }) => ({
    wheel: one(wheels, {
      fields: [wheelSelectionHistory.wheelId],
      references: [wheels.id],
    }),
    user: one(users, {
      fields: [wheelSelectionHistory.userId],
      references: [users.id],
    }),
  }),
);

export const users = mysqlTable("user", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
    fsp: 3,
  }).default(sql`CURRENT_TIMESTAMP(3)`),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  myWheels: many(wheels),
  allWheels: many(wheelUsers),
  timesSelected: many(wheelSelectionHistory),
}));

export const accounts = mysqlTable(
  "account",
  {
    userId: varchar("userId", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
    userIdIdx: index("userId_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = mysqlTable(
  "session",
  {
    sessionToken: varchar("sessionToken", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("userId", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("userId_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = mysqlTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token),
  }),
);
