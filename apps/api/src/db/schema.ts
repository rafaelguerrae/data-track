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
} from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
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
