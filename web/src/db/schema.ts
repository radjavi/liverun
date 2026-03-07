import {
  pgTable,
  text,
  serial,
  integer,
  real,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const cheers = pgTable("cheers", {
  id: serial("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trackingPoints = pgTable("tracking_points", {
  id: serial("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  altitude: real("altitude"),
  heartRate: integer("heart_rate"),
  pace: real("pace"),
  distanceMeters: real("distance_meters"),
  cadence: integer("cadence"),
  elevationGain: real("elevation_gain"),
  gradeAdjustedPace: real("grade_adjusted_pace"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
