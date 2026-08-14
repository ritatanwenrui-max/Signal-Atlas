import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("dashboard provides lifetime archive, event analytics, maps, and shared team setup", async () => {
  const page = await source("app/page.tsx");
  const report = await source("app/report-view.tsx");
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
  assert.match(page, /\/signin-with-chatgpt\?return_to=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(page, /登录后会直接进入同一个团队工作区/);
  assert.match(page, /全球报道热力分布/);
  assert.match(page, /world-map-flat\.svg/);
  assert.doesNotMatch(page, /world-map-detailed\.svg/);
  assert.match(page, /map-zoom-controls/);
  assert.match(page, /map-data-tooltip/);
  assert.match(page, /smallRegionAnchors/);
  assert.match(page, /HK: \{ x: 680\.5, y: 463\.5 \}/);
  assert.match(page, /中国大陆: "CN"/);
  assert.match(report, /自动舆情分析报告/);
  assert.match(report, /导出 PDF/);
  assert.match(page, /getElementById\(mapId\)/);
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
  assert.match(page, /TEAM API VAULT/);
  assert.match(page, /团队共用采集结果/);
  assert.match(page, /SHARED TEAM WORKSPACE/);
  assert.match(page, /添加到团队/);
  assert.match(page, /Instagram Business \/ Creator Account ID/);
  assert.match(page, /Client Secret/);
  assert.match(page, /Instagram 公共搜索（Monid）|Monid \/ Instagram/);
  assert.match(page, /monid_live_/);
  assert.match(page, /social_follower_count/);
  assert.match(page, /Monid.*五个平台|Monid.*Instagram/);
  assert.match(page, /60 \* 60 \* 1000/);
  assert.doesNotMatch(page, /Somnia|硅姬|矽姬/);
});

test("every sidebar feature has a durable URL with refresh and browser history support", async () => {
  const page = await source("app/page.tsx");
  const routeFiles = await Promise.all(["overview", "archive", "propagation", "analytics", "comments", "coverage", "reports", "settings", "guide"]
    .map((route) => source(`app/${route}/page.tsx`)));
  assert.match(page, /overview: "\/overview"/);
  assert.match(page, /archive: "\/archive"/);
  assert.match(page, /propagation: "\/propagation"/);
  assert.match(page, /comments: "\/comments"/);
  assert.match(page, /guide: "\/guide"/);
  assert.match(page, /settings: "\/settings"/);
  assert.match(page, /window\.history\[replace \? "replaceState" : "pushState"\]/);
  assert.match(page, /window\.addEventListener\("popstate", syncRoute\)/);
  assert.match(page, /viewFromPath\(window\.location\.pathname\)/);
  assert.match(page, /href=\{routeByView\[id\]\}/);
  assert.match(page, /aria-current=\{view === id \? "page"/);
  assert.match(page, /<PublicAccess returnTo=\{routeByView\[view\]\}/);
  for (const routeFile of routeFiles) assert.match(routeFile, /export \{ default \} from "\.\.\/page"/);
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

test("connector credentials are workspace-shared and encrypted server-side", async () => {
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
  assert.match(route, /credential_owner_user_id/);
  assert.match(route, /inviteWorkspaceMembers/);
  assert.match(schema, /connectorCredentials/);
  assert.match(schema, /primaryKey\(\{ columns: \[table\.userId, table\.provider\] \}\)/);
  assert.doesNotMatch(repository, /SELECT \* FROM brand_profiles WHERE user_id = ''/);
});

test("invited users automatically enter the same workspace with role-based access", async () => {
  const [workspaces, repository, schema, dataRoute] = await Promise.all([
    source("db/workspaces.ts"), source("db/repository.ts"), source("db/schema.ts"), source("app/api/data/route.ts"),
  ]);
  assert.match(workspaces, /lower\(workspace_invites\.email\) = \?/);
  assert.match(workspaces, /status = 'accepted'/);
  assert.match(workspaces, /UPDATE workspace_members SET is_active = 0/);
  assert.match(workspaces, /permission: "read" \| "edit" \| "manage"/);
  assert.match(repository, /JOIN brand_profiles ON brand_profiles\.workspace_id = workspace_members\.workspace_id/);
  assert.match(repository, /credentialOwnerId/);
  assert.match(schema, /workspaceMembers/);
  assert.match(schema, /workspaceInvites/);
  assert.match(dataRoute, /removeWorkspaceMember/);
});

test("Monid searches five social platforms and archives public comments and replies", async () => {
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
  assert.match(monid, /fetch_post_by_url/);
  assert.match(monid, /resolve_post/);
  assert.match(monid, /next_min_id/);
  assert.match(monid, /next_min_child_cursor/);
  assert.match(monid, /queueInstagramCommentTarget/);
  assert.doesNotMatch(monid, /reportedCount === 0/);
  assert.match(monid, /COMMENT_JOBS_PER_CYCLE = 2/);
  assert.match(monid, /status = shouldRetry \? "retrying" : "not_returned"/);
  assert.match(monid, /datetime\('now', '-30 minutes'\)/);
  assert.match(monid, /"retrying" \| "blocked" \| "unavailable" \| "error"/);
  assert.match(sync, /collectMonidSocial/);
  assert.match(sync, /upsertSocialMetrics/);
  assert.match(sync, /queueSocialCommentTarget/);
  assert.match(schema, /socialPostMetrics/);
  assert.match(schema, /socialAuthorSnapshots/);
  assert.match(schema, /monidJobs/);
  assert.match(schema, /socialCommentTargets/);
  assert.match(schema, /socialCommentReplyQueue/);
  assert.match(repository, /Monid 多平台公共搜索/);
  assert.match(monid, /CREATED.*QUEUED.*PENDING.*READY.*RUNNING/);
  assert.match(sync, /earlyMonidPending/);
  assert.match(repository, /公开评论与回复归档/);
  assert.match(commentsRoute, /COMMENT ARCHIVE|mention_comments/);
  assert.match(commentsRoute, /collectPost/);
  assert.match(commentsRoute, /topPosts/);
  assert.match(commentsRoute, /riskComments/);
  assert.match(page, /评论舆情/);
  assert.match(page, /评论明细档案/);
  assert.match(page, /帖子评论采集状态/);
  assert.match(page, /comment-card-grid/);
  assert.match(page, /关键词搜帖/);
  assert.match(page, /归档帖子 URL/);
  assert.match(page, /逐帖采集评论/);
  assert.match(page, /内部语义分析/);
  assert.doesNotMatch(page, /empty: "无公开评论"|unavailable: "平台未开放"/);
  assert.doesNotMatch(page, /ACTIVE AUTHORS|高活跃参与者/);
  assert.match(page, /内容舆情/);
  assert.match(page, /受众舆情/);
  assert.match(page, /数据采集/);
  assert.match(page, /产品使用说明/);
  assert.match(page, /互动共鸣/);
  assert.match(page, /国家 \/ 地区接受情况/);
  assert.match(monid, /MAX_COMMENT_FAILURES = 5/);
  assert.match(monid, /status = 'review'/);
  assert.match(commentsRoute, /resonance_weight/);
  assert.match(commentsRoute, /audience_region/);
});

test("collected posts and comments receive persisted English translations", async () => {
  const [monid, translation, sync, schema, repository, page, comments, dataRoute] = await Promise.all([
    source("db/monid.ts"), source("db/translation.ts"), source("db/news-sync.ts"), source("db/schema.ts"),
    source("db/repository.ts"), source("app/page.tsx"), source("db/comments.ts"), source("app/api/data/route.ts"),
  ]);
  assert.doesNotMatch(monid, /api\.strale\.io|x402\/translate|startTranslationJobs|Monid · Strale/);
  assert.match(translation, /api\.mymemory\.translated\.net\/get/);
  assert.match(translation, /api\.cognitive\.microsofttranslator\.com/);
  assert.match(translation, /api-free\.deepl\.com\/v2\/translate/);
  assert.match(translation, /translateWithLibreTranslate/);
  assert.match(translation, /loadConnectorCredential/);
  assert.match(translation, /function translationNotNeeded/);
  assert.match(translation, /"英文", "英语", "en", "en-us", "en-gb", "english"/);
  assert.match(translation, /translation_status = 'translated'/);
  assert.match(translation, /translation_status = 'skipped'/);
  assert.match(translation, /translation_error/);
  assert.match(translation, /translation_next_retry_at/);
  assert.match(translation, /翻译已迁移到独立队列/);
  assert.match(translation, /MAX_ANONYMOUS_ITEMS_PER_CYCLE = 2/);
  assert.match(translation, /MAX_CONFIGURED_ITEMS_PER_CYCLE = 12/);
  assert.match(translation, /hasDedicatedTranslator\(credentials\)/);
  assert.match(translation, /!hasDedicatedTranslator\(credentials\) && isDailyQuotaError/);
  assert.match(translation, /USED ALL AVAILABLE FREE TRANSLATIONS/);
  assert.match(translation, /24 \* 60 \* 60_000/);
  assert.match(translation, /\.\.\.mentions\.results[\s\S]*\.\.\.comments\.results/);
  assert.match(translation, /Promise\.all\(remote\.map/);
  assert.match(sync, /runTranslationCycle/);
  assert.match(sync, /inserted > 0 \? await runTranslationCycle/);
  assert.match(schema, /translationEn: text\("translation_en"\)/);
  assert.match(schema, /translationError: text\("translation_error"\)/);
  assert.match(schema, /idx_mentions_brand_translation/);
  assert.match(schema, /idx_mention_comments_brand_translation/);
  assert.match(repository, /ALTER TABLE mentions ADD COLUMN translation_en/);
  assert.match(repository, /ALTER TABLE mentions ADD COLUMN translation_error/);
  assert.match(repository, /ALTER TABLE mention_comments ADD COLUMN translation_en/);
  assert.match(repository, /Azure Translator F0/);
  assert.match(repository, /DeepL API Free/);
  assert.match(repository, /LibreTranslate 自托管/);
  assert.match(comments, /translation_status = CASE WHEN mention_comments\.content != excluded\.content THEN 'pending'/);
  assert.match(page, /function EnglishTranslation/);
  assert.match(page, /function translationNotNeeded/);
  assert.match(page, /status === "skipped" \|\| translationNotNeeded\(language\)/);
  assert.match(page, /等待英文翻译/);
  assert.match(page, /翻译失败/);
  assert.match(page, /系统将在额度恢复后自动重试/);
  assert.match(dataRoute, /await runTranslationCycle\(db, Number\(existingBrand\.id\)/);
  assert.doesNotMatch(page, /Translation will retry automatically|check Monid balance/);
  assert.match(page, /<EnglishTranslation value=\{item\.translation_en\}/);
  assert.match(page, /<EnglishTranslation value=\{comment\.translation_en\}/);
  assert.doesNotMatch(page, /<small>\{provider\}<\/small>|provider=\{item\.translation_provider\}|provider=\{comment\.translation_provider\}/);
  assert.match(page, /"英文翻译"/);
});

test("team entity dictionary supports protected deletion", async () => {
  const [page, dataRoute] = await Promise.all([source("app/page.tsx"), source("app/api/data/route.ts")]);
  assert.match(page, /action: "deleteEntity"/);
  assert.match(page, /确认删除词条/);
  assert.match(dataRoute, /DELETE FROM tracked_entities WHERE id = \? AND brand_id = \?/);
  assert.match(dataRoute, /品牌、别名和官网域名请在品牌档案中修改/);
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

test("workspace exclusion terms immediately hide archived mentions and their comments", async () => {
  const repository = await source("db/repository.ts");
  const comments = await source("app/api/comments/route.ts");
  const sync = await source("db/news-sync.ts");
  assert.match(repository, /mentionContainsExcludedTerm/);
  assert.match(repository, /visiblePropagationEdges/);
  assert.match(comments, /mentionOnlyWhere/);
  assert.match(comments, /COALESCE\(c\.content, ''\)/);
  assert.match(sync, /exclusions\.some\(\(term\) => body\.includes/);
});

test("human comment labels override model output and retrain a workspace calibration layer", async () => {
  const [page, route, calibration, commentsRoute, schema] = await Promise.all([
    source("app/page.tsx"), source("app/api/comment-labels/route.ts"), source("db/comment-calibration.ts"),
    source("app/api/comments/route.ts"), source("db/schema.ts"),
  ]);
  assert.match(page, /人工标注与模型校准/);
  assert.match(page, /仅未标注/);
  assert.match(page, /人机有分歧/);
  assert.match(page, /无实意/);
  assert.match(route, /model_sentiment/);
  assert.match(route, /manual_sentiment/);
  assert.match(route, /ManualCommentTone/);
  assert.match(route, /rebuildCommentCalibration/);
  assert.match(calibration, /state\.samples < 2/);
  assert.match(calibration, /sample\.manual_sentiment === "无实意"/);
  assert.match(calibration, /applyCalibrationRules/);
  assert.match(commentsRoute, /getCommentCalibrationStats/);
  assert.match(commentsRoute, /c\.sentiment != '无实意'/);
  assert.match(schema, /commentAnnotations/);
  assert.match(schema, /sentimentCalibrationRules/);
});

test("Instagram comments and replies use TikHub V2 with V1 fallback and independent pagination cursors", async () => {
  const [monid, schema, page] = await Promise.all([source("db/monid.ts"), source("db/schema.ts"), source("app/page.tsx")]);
  assert.match(monid, /\/api\/v1\/instagram\/v2\/fetch_post_comments/);
  assert.match(monid, /\/api\/v1\/instagram\/v1\/fetch_post_comments_v2/);
  assert.match(monid, /\/api\/v1\/instagram\/v2\/fetch_comment_replies/);
  assert.match(monid, /\/api\/v1\/instagram\/v1\/fetch_comment_replies/);
  assert.match(monid, /code_or_url/);
  assert.match(monid, /pagination_token/);
  assert.match(monid, /next_min_child_cursor/);
  assert.match(monid, /adapter = 'v1'/);
  assert.match(schema, /v2Failures/);
  assert.match(schema, /v1Failures/);
  assert.match(page, /失败 \{target\.failure_count/);
});

test("worker runs the hybrid monitor hourly", async () => {
  const [worker, vite] = await Promise.all([source("worker/index.ts"), source("vite.config.ts")]);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /runAllBrandSyncs\(\)/);
  assert.match(vite, /crons: \["17 \* \* \* \*"\]/);
});

test("hybrid analysis uses rules for all data and LLMs only for priority review and reports", async () => {
  const [analysis, credentials, repository, schema, sync, page, report] = await Promise.all([
    source("db/llm-analysis.ts"), source("db/credentials.ts"), source("db/repository.ts"), source("db/schema.ts"),
    source("db/news-sync.ts"), source("app/page.tsx"), source("app/report-view.tsx"),
  ]);
  assert.match(analysis, /ANALYSIS_MODEL = "gpt-5\.6-luna"/);
  assert.match(analysis, /REPORT_MODEL = "gpt-5\.6-sol"/);
  assert.match(analysis, /risk >= 55 OR impact >= 80 OR engagement >= 50/);
  assert.match(analysis, /NOT EXISTS \(SELECT 1 FROM comment_annotations/);
  assert.match(analysis, /if \(queued >= 8\) break/);
  assert.match(analysis, /source_hash/);
  assert.match(analysis, /status = 'completed'/);
  assert.match(analysis, /runReportAgent/);
  assert.match(credentials, /OpenAI LLM/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS llm_analysis_jobs/);
  assert.match(repository, /混合智能分析/);
  assert.match(schema, /llmAnalysisJobs/);
  assert.match(sync, /runHybridAnalysisCycle/);
  assert.match(page, /规则全量分析/);
  assert.match(page, /人工标注优先/);
  assert.match(page, /前往 OpenAI 创建 API Key/);
  assert.match(report, /LLM 辅助研判/);
});
