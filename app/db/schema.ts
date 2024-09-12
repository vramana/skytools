import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const session = pgTable("session", {
  key: text("key").primaryKey(),
  session: jsonb("session"),
});

export const state = pgTable("state", {
  key: text("key").primaryKey(),
  state: jsonb("state"),
});
