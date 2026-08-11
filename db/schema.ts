import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mentions = sqliteTable("mentions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  source: text("source").notNull(),
  platform: text("platform").notNull(),
  sourceCountry: text("source_country").notNull(),
  contentCountry: text("content_country").notNull(),
  language: text("language").notNull(),
  sentiment: text("sentiment").notNull(),
  risk: integer("risk").notNull().default(20),
  impact: integer("impact").notNull().default(50),
  summary: text("summary").notNull().default(""),
  clusterKey: text("cluster_key").notNull(),
  publishedAt: text("published_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_mentions_published_at").on(table.publishedAt),
  index("idx_mentions_country_platform").on(table.sourceCountry, table.platform),
  index("idx_mentions_cluster_key").on(table.clusterKey),
]);

export const trafficSignals = sqliteTable("traffic_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  country: text("country").notNull(),
  visitors: integer("visitors").notNull(),
  views: integer("views").notNull(),
  baseline: integer("baseline").notNull(),
  landingPage: text("landing_page").notNull(),
  anomalyRatio: integer("anomaly_ratio").notNull(),
  recordedAt: text("recorded_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_traffic_country_recorded").on(table.country, table.recordedAt)]);

export const trackedEntities = sqliteTable("tracked_entities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  value: text("value").notNull(),
  language: text("language").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mentionId: integer("mention_id"),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  country: text("country").notNull(),
  reason: text("reason").notNull(),
  acknowledged: integer("acknowledged", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_alerts_ack_severity").on(table.acknowledged, table.severity)]);
