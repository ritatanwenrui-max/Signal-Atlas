import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const brandProfiles = sqliteTable("brand_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  aliases: text("aliases").notNull().default(""),
  website: text("website").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

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
  parentUrl: text("parent_url").notNull().default(""),
  relation: text("relation").notNull().default(""),
  engagement: integer("engagement").notNull().default(0),
  excerpt: text("excerpt").notNull().default(""),
  author: text("author").notNull().default(""),
  provider: text("provider").notNull().default(""),
  discoveredVia: text("discovered_via").notNull().default("global_discovery"),
  contentHash: text("content_hash").notNull().default(""),
  wordCount: integer("word_count").notNull().default(0),
  sentimentScore: integer("sentiment_score").notNull().default(0),
  topics: text("topics").notNull().default(""),
  keywords: text("keywords").notNull().default(""),
  firstSeenAt: text("first_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  archivedAt: text("archived_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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

export const mediaSources = sqliteTable("media_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull().default("地区未披露"),
  language: text("language").notNull().default("自动识别"),
  homepageUrl: text("homepage_url").notNull(),
  feedUrl: text("feed_url").notNull().default(""),
  sitemapUrl: text("sitemap_url").notNull().default(""),
  robotsPolicy: text("robots_policy").notNull().default(""),
  robotsCheckedAt: text("robots_checked_at").notNull().default(""),
  status: text("status").notNull().default("discovered"),
  errorCount: integer("error_count").notNull().default(0),
  lastError: text("last_error").notNull().default(""),
  lastDiscoveredAt: text("last_discovered_at").notNull(),
  lastCrawledAt: text("last_crawled_at").notNull().default(""),
  nextCrawlAt: text("next_crawl_at").notNull(),
  etag: text("etag").notNull().default(""),
  lastModified: text("last_modified").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_media_sources_next_crawl").on(table.status, table.nextCrawlAt),
  index("idx_media_sources_country").on(table.country),
]);

export const propagationEdges = sqliteTable("propagation_edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clusterKey: text("cluster_key").notNull(),
  fromMentionId: integer("from_mention_id").notNull(),
  toMentionId: integer("to_mention_id").notNull(),
  similarity: integer("similarity").notNull(),
  confidence: integer("confidence").notNull(),
  method: text("method").notNull(),
  evidence: text("evidence").notNull(),
  timeGapMinutes: integer("time_gap_minutes").notNull(),
  crossBorder: integer("cross_border", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_propagation_edges_cluster").on(table.clusterKey),
  index("idx_propagation_edges_to_mention").on(table.toMentionId),
]);

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

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  query: text("query").notNull(),
  status: text("status").notNull(),
  foundCount: integer("found_count").notNull().default(0),
  insertedCount: integer("inserted_count").notNull().default(0),
  error: text("error").notNull().default(""),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [index("idx_sync_runs_started_at").on(table.startedAt)]);

export const syncLocks = sqliteTable("sync_locks", {
  name: text("name").primaryKey(),
  lockedUntil: text("locked_until").notNull(),
});

export const providerHealth = sqliteTable("provider_health", {
  provider: text("provider").primaryKey(),
  status: text("status").notNull().default("online"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  retryAfter: text("retry_after").notNull().default(""),
  lastError: text("last_error").notNull().default(""),
  lastAttemptAt: text("last_attempt_at").notNull().default(""),
  lastSuccessAt: text("last_success_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const connectorCredentials = sqliteTable("connector_credentials", {
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  iv: text("iv").notNull(),
  lastFour: text("last_four").notNull(),
  status: text("status").notNull().default("saved"),
  lastTestAt: text("last_test_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.userId, table.provider] })]);
