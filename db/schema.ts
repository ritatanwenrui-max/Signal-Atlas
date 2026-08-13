import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const brandProfiles = sqliteTable("brand_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().default(""),
  workspaceId: integer("workspace_id").notNull().default(0),
  name: text("name").notNull(),
  aliases: text("aliases").notNull().default(""),
  website: text("website").notNull().default(""),
  matchMode: text("match_mode").notNull().default("precise"),
  scopeTerms: text("scope_terms").notNull().default(""),
  excludeTerms: text("exclude_terms").notNull().default(""),
  officialAccounts: text("official_accounts").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_brand_profiles_user_active").on(table.userId, table.active),
  index("idx_brand_profiles_workspace_active").on(table.workspaceId, table.active),
]);

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  credentialOwnerUserId: text("credential_owner_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_workspaces_owner").on(table.ownerUserId)]);

export const workspaceMembers = sqliteTable("workspace_members", {
  workspaceId: integer("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default(""),
  role: text("role").notNull().default("editor"),
  status: text("status").notNull().default("active"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
  index("idx_workspace_members_user_active").on(table.userId, table.status, table.isActive),
  index("idx_workspace_members_email").on(table.email, table.status),
]);

export const workspaceInvites = sqliteTable("workspace_invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("editor"),
  status: text("status").notNull().default("pending"),
  invitedBy: text("invited_by").notNull(),
  acceptedBy: text("accepted_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at").notNull().default(""),
}, (table) => [
  index("idx_workspace_invites_email_status").on(table.email, table.status, table.expiresAt),
  index("idx_workspace_invites_workspace_status").on(table.workspaceId, table.status),
]);

export const mentions = sqliteTable("mentions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().default(0),
  title: text("title").notNull(),
  url: text("url").notNull(),
  source: text("source").notNull(),
  platform: text("platform").notNull(),
  sourceCountry: text("source_country").notNull(),
  contentCountry: text("content_country").notNull(),
  language: text("language").notNull(),
  locationConfidence: integer("location_confidence").notNull().default(0),
  locationMethod: text("location_method").notNull().default(""),
  sentiment: text("sentiment").notNull(),
  emotion: text("emotion").notNull().default("中性陈述"),
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
  index("idx_mentions_brand_published").on(table.brandId, table.publishedAt),
  index("idx_mentions_brand_country_platform").on(table.brandId, table.sourceCountry, table.platform),
  index("idx_mentions_brand_cluster").on(table.brandId, table.clusterKey),
]);

export const trafficSignals = sqliteTable("traffic_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().default(0),
  country: text("country").notNull(),
  visitors: integer("visitors").notNull(),
  views: integer("views").notNull(),
  baseline: integer("baseline").notNull(),
  landingPage: text("landing_page").notNull(),
  anomalyRatio: integer("anomaly_ratio").notNull(),
  recordedAt: text("recorded_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_traffic_brand_country_recorded").on(table.brandId, table.country, table.recordedAt)]);

export const trackedEntities = sqliteTable("tracked_entities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().default(0),
  type: text("type").notNull(),
  value: text("value").notNull(),
  language: text("language").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_tracked_entities_brand").on(table.brandId, table.active)]);

export const mediaSources = sqliteTable("media_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().default(0),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  country: text("country").notNull().default("地区待确认"),
  language: text("language").notNull().default("语言待确认"),
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
  uniqueIndex("idx_media_sources_brand_domain").on(table.brandId, table.domain),
  index("idx_media_sources_brand_next_crawl").on(table.brandId, table.status, table.nextCrawlAt),
  index("idx_media_sources_brand_country").on(table.brandId, table.country),
]);

export const propagationEdges = sqliteTable("propagation_edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().default(0),
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
  index("idx_propagation_edges_brand_cluster").on(table.brandId, table.clusterKey),
  index("idx_propagation_edges_to_mention").on(table.toMentionId),
]);

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().default(0),
  mentionId: integer("mention_id"),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  country: text("country").notNull(),
  reason: text("reason").notNull(),
  acknowledged: integer("acknowledged", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_alerts_brand_ack_severity").on(table.brandId, table.acknowledged, table.severity)]);

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull().default(0),
  provider: text("provider").notNull(),
  query: text("query").notNull(),
  status: text("status").notNull(),
  foundCount: integer("found_count").notNull().default(0),
  insertedCount: integer("inserted_count").notNull().default(0),
  error: text("error").notNull().default(""),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [index("idx_sync_runs_brand_started").on(table.brandId, table.startedAt)]);

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

export const monidJobs = sqliteTable("monid_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull(),
  mentionId: integer("mention_id").notNull().default(0),
  runId: text("run_id").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull().default("RUNNING"),
  terms: text("terms").notNull().default("[]"),
  cost: integer("cost").notNull().default(0),
  error: text("error").notNull().default(""),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_monid_jobs_run_id").on(table.runId),
  index("idx_monid_jobs_brand_status").on(table.brandId, table.status),
  index("idx_monid_jobs_mention_stage").on(table.mentionId, table.stage, table.status),
]);

export const socialPostMetrics = sqliteTable("social_post_metrics", {
  mentionId: integer("mention_id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  platform: text("platform").notNull(),
  postId: text("post_id").notNull().default(""),
  authorId: text("author_id").notNull().default(""),
  authorUsername: text("author_username").notNull().default(""),
  authorName: text("author_name").notNull().default(""),
  followerCount: integer("follower_count").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  views: integer("views").notNull().default(0),
  plays: integer("plays").notNull().default(0),
  matchedTerms: text("matched_terms").notNull().default("[]"),
  metricsUpdatedAt: text("metrics_updated_at").notNull(),
}, (table) => [
  index("idx_social_metrics_brand_platform").on(table.brandId, table.platform),
  index("idx_social_metrics_author").on(table.brandId, table.authorUsername),
]);

export const socialAuthorSnapshots = sqliteTable("social_author_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull(),
  platform: text("platform").notNull(),
  authorId: text("author_id").notNull().default(""),
  username: text("username").notNull(),
  followerCount: integer("follower_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  capturedAt: text("captured_at").notNull(),
}, (table) => [index("idx_social_authors_brand_user_time").on(table.brandId, table.username, table.capturedAt)]);

export const commentAnalyses = sqliteTable("comment_analyses", {
  mentionId: integer("mention_id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  adapter: text("adapter").notNull().default(""),
  status: text("status").notNull().default("unsupported"),
  reportedCount: integer("reported_count").notNull().default(0),
  analyzedCount: integer("analyzed_count").notNull().default(0),
  positiveCount: integer("positive_count").notNull().default(0),
  neutralCount: integer("neutral_count").notNull().default(0),
  negativeCount: integer("negative_count").notNull().default(0),
  mixedCount: integer("mixed_count").notNull().default(0),
  sentiment: text("sentiment").notNull().default("样本不足"),
  sentimentScore: integer("sentiment_score").notNull().default(0),
  keywords: text("keywords").notNull().default("[]"),
  lastError: text("last_error").notNull().default(""),
  lastCollectedAt: text("last_collected_at").notNull(),
}, (table) => [index("idx_comment_analyses_brand_collected").on(table.brandId, table.lastCollectedAt)]);

export const mentionComments = sqliteTable("mention_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mentionId: integer("mention_id").notNull(),
  brandId: integer("brand_id").notNull(),
  platform: text("platform").notNull().default("网页新闻"),
  sourceCommentId: text("source_comment_id").notNull(),
  parentCommentId: text("parent_comment_id").notNull().default(""),
  authorId: text("author_id").notNull().default(""),
  authorUsername: text("author_username").notNull().default(""),
  authorName: text("author_name").notNull().default(""),
  isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
  content: text("content").notNull(),
  sentiment: text("sentiment").notNull(),
  emotion: text("emotion").notNull().default("中性陈述"),
  sentimentScore: integer("sentiment_score").notNull().default(0),
  language: text("language").notNull().default("语言待确认"),
  topic: text("topic").notNull().default("其他讨论"),
  keywords: text("keywords").notNull().default("[]"),
  likes: integer("likes").notNull().default(0),
  replies: integer("replies").notNull().default(0),
  commentUrl: text("comment_url").notNull().default(""),
  fetchedVia: text("fetched_via").notNull().default(""),
  publishedAt: text("published_at").notNull().default(""),
  collectedAt: text("collected_at").notNull(),
}, (table) => [
  uniqueIndex("idx_mention_comments_source").on(table.mentionId, table.sourceCommentId),
  index("idx_mention_comments_brand_mention").on(table.brandId, table.mentionId),
  index("idx_mention_comments_brand_platform_time").on(table.brandId, table.platform, table.publishedAt),
  index("idx_mention_comments_brand_sentiment").on(table.brandId, table.sentiment, table.sentimentScore),
]);

export const commentAnnotations = sqliteTable("comment_annotations", {
  commentId: integer("comment_id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  workspaceId: integer("workspace_id").notNull().default(0),
  mentionId: integer("mention_id").notNull(),
  annotatorUserId: text("annotator_user_id").notNull(),
  modelSentiment: text("model_sentiment").notNull(),
  modelEmotion: text("model_emotion").notNull(),
  modelTopic: text("model_topic").notNull(),
  modelScore: integer("model_score").notNull().default(0),
  manualSentiment: text("manual_sentiment").notNull(),
  manualEmotion: text("manual_emotion").notNull(),
  manualTopic: text("manual_topic").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_comment_annotations_brand_updated").on(table.brandId, table.updatedAt),
  index("idx_comment_annotations_workspace").on(table.workspaceId, table.brandId),
]);

export const sentimentCalibrationRules = sqliteTable("sentiment_calibration_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brandId: integer("brand_id").notNull(),
  token: text("token").notNull(),
  sentiment: text("sentiment").notNull(),
  emotion: text("emotion").notNull(),
  weight: integer("weight").notNull().default(0),
  sampleCount: integer("sample_count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_sentiment_calibration_brand_token").on(table.brandId, table.token),
  index("idx_sentiment_calibration_brand_weight").on(table.brandId, table.weight),
]);

export const socialCommentTargets = sqliteTable("social_comment_targets", {
  mentionId: integer("mention_id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  platform: text("platform").notNull().default("Instagram"),
  mediaId: text("media_id").notNull(),
  postUrl: text("post_url").notNull(),
  reportedCount: integer("reported_count").notNull().default(0),
  collectedCount: integer("collected_count").notNull().default(0),
  cursor: text("cursor").notNull().default(""),
  adapter: text("adapter").notNull().default("v2"),
  v2Failures: integer("v2_failures").notNull().default(0),
  v1Failures: integer("v1_failures").notNull().default(0),
  topLevelComplete: integer("top_level_complete", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("queued"),
  pagesFetched: integer("pages_fetched").notNull().default(0),
  lastError: text("last_error").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_social_comment_targets_brand_status").on(table.brandId, table.status, table.updatedAt)]);

export const socialCommentReplyQueue = sqliteTable("social_comment_reply_queue", {
  mentionId: integer("mention_id").notNull(),
  brandId: integer("brand_id").notNull(),
  mediaId: text("media_id").notNull(),
  parentCommentId: text("parent_comment_id").notNull(),
  reportedCount: integer("reported_count").notNull().default(0),
  collectedCount: integer("collected_count").notNull().default(0),
  cursor: text("cursor").notNull().default(""),
  adapter: text("adapter").notNull().default("v2"),
  v2Failures: integer("v2_failures").notNull().default(0),
  v1Failures: integer("v1_failures").notNull().default(0),
  status: text("status").notNull().default("queued"),
  pagesFetched: integer("pages_fetched").notNull().default(0),
  lastError: text("last_error").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.mentionId, table.parentCommentId] }),
  index("idx_social_comment_replies_brand_status").on(table.brandId, table.status, table.updatedAt),
]);
