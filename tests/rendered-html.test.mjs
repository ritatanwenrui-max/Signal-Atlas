import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("dashboard provides lifetime archive, event analytics, maps, and personal API setup", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /新闻档案/);
  assert.match(page, /有史以来全部记录/);
  assert.match(page, /导出 CSV/);
  assert.match(page, /const platformCatalog = \["网页新闻", "Instagram", "Facebook", "TikTok", "X", "YouTube"\]/);
  assert.match(page, /platformCounts\[item\] \?\? 0/);
  assert.match(page, /配置监测品牌/);
  assert.match(page, /监测概览/);
  assert.match(page, /采集计划/);
  assert.doesNotMatch(page, /少量付费发现|大部分追踪免费完成|正在被归档和溯源|输入一次品牌名/);
  assert.match(page, /!data\.viewer\.authenticated \? <PublicAccess/);
  assert.match(page, /\/signin-with-chatgpt\?return_to=%2F/);
  assert.match(page, /每个账号拥有独立的品牌档案、新闻数据和 API 凭证/);
  assert.match(page, /全球报道热力分布/);
  assert.match(page, /高频议题词云/);
  assert.match(page, /情绪结构/);
  assert.match(page, /事件爆发曲线/);
  assert.match(page, /并列事件对比/);
  assert.match(page, /高度转载率/);
  assert.match(page, /同一事件扩散路径/);
  assert.match(page, /起点：\{cluster\.originSource\}/);
  assert.doesNotMatch(page, /cluster\.countries\.join\(" → "\)/);
  assert.match(page, /network-edge cross/);
  assert.match(page, /样本不足/);
  assert.match(page, /saveConnectorCredential/);
  assert.match(page, /PERSONAL API VAULT/);
  assert.match(page, /按登录用户隔离/);
  assert.match(page, /Instagram Business \/ Creator Account ID/);
  assert.match(page, /Client Secret/);
  assert.match(page, /Instagram 公共搜索（Monid）|Monid \/ Instagram/);
  assert.match(page, /monid_live_/);
  assert.match(page, /social_follower_count/);
  assert.match(page, /Monid 公开搜索/);
  assert.match(page, /60 \* 60 \* 1000/);
  assert.doesNotMatch(page, /Somnia|硅姬|矽姬/);
});

test("hybrid collection discovers globally and continuously follows free media sources", async () => {
  const [sync, providers, crawler, repository] = await Promise.all([
    source("db/news-sync.ts"), source("db/providers.ts"), source("db/free-crawler.ts"), source("db/repository.ts"),
  ]);
  assert.match(providers, /eventregistry\.org\/api\/v1\/article\/getArticles/);
  assert.match(providers, /api\.gdeltproject\.org\/api\/v2\/doc\/doc/);
  assert.match(providers, /forceMaxDataTimeWindow: 31/);
  assert.match(sync, /const SIX_HOURS/);
  assert.match(sync, /const gdeltDue/);
  assert.match(sync, /EVENT_INACTIVITY_GAP = 96 \* 3600_000/);
  assert.match(sync, /gap > EVENT_INACTIVITY_GAP/);
  assert.match(sync, /BURST_CONTINUATION = 48 \* 3600_000/);
  assert.match(sync, /translatedReprint/);
  assert.match(sync, /eventAnchors/);
  assert.match(sync, /sharedNumericAnchor/);
  assert.match(sync, /originScore >= score - 0\.12/);
  assert.match(sync, /rebuildPropagationEdges/);
  assert.match(sync, /rebuildStoryClusters/);
  assert.match(sync, /enrichHistoricalMentions/);
  assert.match(sync, /brand_id = \?/);
  assert.match(sync, /propagation_edges/);
  assert.match(providers, /inferSourceCountry/);
  assert.match(providers, /媒体域名 \/ 国家顶级域/);
  assert.match(crawler, /robotsAllows/);
  assert.match(crawler, /parseFeed/);
  assert.match(crawler, /parseSitemap/);
  assert.match(crawler, /If-None-Match/);
  assert.match(crawler, /LIMIT 10/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS media_sources/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS propagation_edges/);
  assert.match(repository, /每 6 小时发现/);
});

test("connector credentials are user-scoped and encrypted server-side", async () => {
  const [credentials, route, schema, repository] = await Promise.all([
    source("db/credentials.ts"), source("app/api/data/route.ts"), source("db/schema.ts"), source("db/repository.ts"),
  ]);
  assert.match(credentials, /AES-GCM/);
  assert.match(credentials, /additionalData/);
  assert.match(credentials, /user_id = \? AND provider = \?/);
  assert.match(credentials, /Meta \/ Instagram/);
  assert.match(credentials, /TikTok/);
  assert.match(credentials, /Monid \/ Instagram/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /请先登录/);
  assert.match(route, /viewer: \{ authenticated: Boolean\(user\) \}/);
  assert.match(schema, /connectorCredentials/);
  assert.match(schema, /primaryKey\(\{ columns: \[table\.userId, table\.provider\] \}\)/);
  assert.doesNotMatch(repository, /SELECT \* FROM brand_profiles WHERE user_id = ''/);
});

test("Monid searches Instagram and paginates every discovered post's public comments and replies", async () => {
  const [monid, sync, schema, repository, commentsRoute, page] = await Promise.all([
    source("db/monid.ts"), source("db/news-sync.ts"), source("db/schema.ts"), source("db/repository.ts"), source("app/api/comments/route.ts"), source("app/page.tsx"),
  ]);
  assert.match(monid, /api\.monid\.ai/);
  assert.match(monid, /instagram-hashtag-scraper/);
  assert.match(monid, /keywordSearch: true/);
  assert.match(monid, /instagram-profile-scraper/);
  assert.match(monid, /GET|\/v1\/runs\//);
  assert.match(monid, /resultsLimit: 50/);
  assert.match(monid, /matchedTerms/);
  assert.match(monid, /fetch_post_comments_v2/);
  assert.match(monid, /fetch_comment_replies/);
  assert.match(monid, /next_min_id/);
  assert.match(monid, /next_min_child_cursor/);
  assert.match(monid, /queueInstagramCommentTarget/);
  assert.doesNotMatch(monid, /reportedCount === 0/);
  assert.match(monid, /COMMENT_JOBS_PER_CYCLE = 4/);
  assert.match(monid, /"queued" \| "error"/);
  assert.match(sync, /collectMonidInstagram/);
  assert.match(sync, /upsertSocialMetrics/);
  assert.match(sync, /queueInstagramCommentTarget/);
  assert.match(schema, /socialPostMetrics/);
  assert.match(schema, /socialAuthorSnapshots/);
  assert.match(schema, /monidJobs/);
  assert.match(schema, /socialCommentTargets/);
  assert.match(schema, /socialCommentReplyQueue/);
  assert.match(repository, /Instagram 公共搜索（Monid）/);
  assert.match(monid, /CREATED.*QUEUED.*PENDING.*READY.*RUNNING/);
  assert.match(sync, /earlyMonidPending/);
  assert.match(repository, /全量公开评论及回复归档/);
  assert.match(commentsRoute, /COMMENT ARCHIVE|mention_comments/);
  assert.match(commentsRoute, /topPosts/);
  assert.match(commentsRoute, /riskComments/);
  assert.match(page, /社媒评论/);
  assert.match(page, /评论明细档案/);
  assert.match(page, /帖子评论抓取进度/);
});

test("word clouds use multilingual segmentation and remove Chinese and English filler words", async () => {
  const [analysis, repository, comments] = await Promise.all([
    source("db/text-analysis.ts"), source("db/repository.ts"), source("db/comments.ts"),
  ]);
  assert.match(analysis, /Intl\.Segmenter/);
  assert.match(analysis, /chineseStopwords/);
  assert.match(analysis, /englishStopwords/);
  assert.match(analysis, /"的"/);
  assert.match(analysis, /"the"/);
  assert.match(analysis, /meaningfulTokens/);
  assert.match(repository, /meaningfulTokens/);
  assert.match(comments, /keywordCounts/);
});

test("public news comments are collected, archived, and analyzed without inventing samples", async () => {
  const [comments, providers, sync, schema, repository, page] = await Promise.all([
    source("db/comments.ts"), source("db/providers.ts"), source("db/news-sync.ts"), source("db/schema.ts"), source("db/repository.ts"), source("app/page.tsx"),
  ]);
  assert.match(providers, /163\\\.com.*中国/);
  assert.match(providers, /网易.*netease/);
  assert.match(comments, /comment\.tie\.163\.com\/api\/v1\/products/);
  assert.match(comments, /网页结构化评论/);
  assert.match(comments, /MAX_COMMENTS_PER_ARTICLE = 100/);
  assert.match(comments, /positive_count/);
  assert.match(comments, /keywordCounts/);
  assert.match(sync, /refreshPublicCommentAnalyses/);
  assert.match(schema, /commentAnalyses/);
  assert.match(schema, /mentionComments/);
  assert.match(repository, /comment_analyses\.reported_count AS comment_reported_count/);
  assert.match(page, /评论区情绪/);
  assert.match(page, /评论区关键词词云/);
  assert.match(page, /页面显示的评论总数不会被冒充为已分析样本/);
});

test("worker runs the hybrid monitor hourly", async () => {
  const [worker, vite] = await Promise.all([source("worker/index.ts"), source("vite.config.ts")]);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /runAllBrandSyncs\(\)/);
  assert.match(vite, /crons: \["17 \* \* \* \*"\]/);
});
