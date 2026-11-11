import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// Um usuário pertence a uma única equipe (user_id é a PK).
export const memberships = pgTable("memberships", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // admin | member
});

// id = sha256 do token entregue no cookie; o token em si nunca é gravado.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  // null = ainda não reivindicado por nenhuma equipe.
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  name: text("name"),
  online: boolean("online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

// Convertida em hypertable do TimescaleDB na migration (veja drizzle/0001_hypertable.sql).
export const readings = pgTable(
  "readings",
  {
    time: timestamp("time", { withTimezone: true }).notNull().defaultNow(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id),
    tempC: doublePrecision("temp_c").notNull(),
    deviceUptimeMs: integer("device_uptime_ms"),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.time] }), index("readings_time_idx").on(t.time)],
);

export const faults = pgTable("faults", {
  id: serial("id").primaryKey(),
  time: timestamp("time", { withTimezone: true }).notNull().defaultNow(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id),
  code: text("code").notNull(),
});

export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  deviceId: text("device_id").notNull(),
  kind: text("kind").notNull(),
  threshold: doublePrecision("threshold"),
  cooldownMin: integer("cooldown_min").notNull().default(30),
  email: text("email").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
});

export const alertEvents = pgTable("alert_events", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => alertRules.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
