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
  assert.match(page, /const platformCatalog = \["网页新闻", "Instagram", "Facebook", "TikTok", "X", "YouTube", "Reddit"\]/);
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
  assert.match(page, /WorldHeatMap countries=\{data\.analytics\.countries\} uiLanguage=\{uiLanguage\}/);
  assert.match(page, /world-map-wrap" data-no-ui-translate/);
  assert.match(page, /Lower coverage/);
  assert.match(page, /Highest coverage/);
  assert.match(page, /tooltip\.count === 1 \? "article" : "articles"/);
  assert.match(page, /map-data-tooltip/);
  assert.match(page, /smallRegionAnchors/);
  assert.match(page, /HK: \{ x: 680\.5, y: 463\.5 \}/);
  assert.match(page, /中国大陆: "CN"/);
  assert.match(report, /自动舆情分析报告/);
  assert.match(report, /导出 PDF/);
  assert.match(page, /getElementById\(mapId\)/);
  assert.match(page, /高频议题词云/);
  assert.match(page, /情绪结构/);
  assert.match(page, /传播节点爆发曲线/);
  assert.match(page, /并列事件对比/);
  assert.match(page, /高度转载率/);
  assert.match(page, /同一事件扩散路径/);
  assert.match(page, /适合窗口/);
  assert.match(page, /全屏查看/);
  assert.match(page, /changeNetworkZoom/);
  assert.match(page, /networkViewportRef/);
  assert.match(page, /width="116" height="48"/);
  assert.match(page, /起点：\$\{cluster\.originSource\}/);
  assert.match(page, /Starting point: \$\{cluster\.originSource\}/);
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
  assert.match(page, /Monid.*六个平台|Monid.*Instagram/);
  assert.match(page, /60 \* 60 \* 1000/);
  assert.match(page, /<strong>Somnia Lab<\/strong><small>GLOBAL MEDIA INTELLIGENCE<\/small>/);
  assert.doesNotMatch(page, /硅姬|矽姬/);
});

test("automatic events preserve every rise while propagation keeps news-similarity evidence", async () => {
  const [page, searchConsole, eventDetection, newsSync, repository, route, migration] = await Promise.all([
    source("app/page.tsx"), source("db/search-console.ts"), source("db/event-detection.ts"),
    source("db/news-sync.ts"), source("db/repository.ts"), source("app/api/data/route.ts"), source("drizzle/0023_curly_skreet.sql"),
  ]);
  assert.match(searchConsole, /const obviousRise/);
  assert.match(searchConsole, /const statisticalThreshold = baseline \+ Math\.max\(8, deviation \* 3\)/);
  assert.match(searchConsole, /current\.clicks >= Math\.max\(previous \* 1\.3, baseline \* relativeThreshold\)/);
  assert.match(searchConsole, /startDate: ordered\[startCandidate\.index\]\.date/);
  assert.match(searchConsole, /peakDate: peak\.date/);
  assert.match(searchConsole, /status: stillElevated \? "active" : "confirmed"/);
  assert.match(searchConsole, /www\.googleapis\.com\/webmasters\/v3\/sites/);
  assert.match(searchConsole, /webmasters\.readonly/);
  assert.doesNotMatch(searchConsole, /DELETE FROM search_event_windows WHERE brand_id = \? AND trigger_source = 'gsc'/);
  assert.match(eventDetection, /detectMediaEventWindows/);
  assert.match(eventDetection, /trigger_source, status, updated_at/);
  assert.match(eventDetection, /'social_spike'/);
  assert.match(newsSync, /captureViralSocialEvents/);
  assert.match(newsSync, /syncMediaEventWindows/);
  assert.match(repository, /status IN \('active', 'confirmed'\)/);
  assert.match(page, /明显攀升的第一天建立新事件/);
  assert.match(page, /已确认事件只追加，不会被后来的峰值覆盖/);
  assert.match(page, /existing text-similarity cluster decides which coverage belongs to it/);
  assert.match(page, /data\.propagationEdges\.filter/);
  assert.match(page, /inferredEdges = selectedEdges\.filter\(\(edge\) => edge\.id > 0\)/);
  assert.match(route, /action === "createEventOrigin"/);
  assert.match(migration, /CREATE TABLE `search_demand_signals`/);
  assert.match(migration, /CREATE TABLE `search_event_windows`/);
  assert.match(migration, /CREATE TABLE `event_origins`/);
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

test("archive discovery expands queries and explains every candidate disposition", async () => {
  const [strategy, monid, sync, providers, schema, repository, page, migration, dataRoute] = await Promise.all([
    source("db/search-strategy.ts"), source("db/monid.ts"), source("db/news-sync.ts"), source("db/providers.ts"),
    source("db/schema.ts"), source("db/repository.ts"), source("app/page.tsx"), source("drizzle/0021_typical_longshot.sql"), source("app/api/data/route.ts"),
  ]);
  assert.match(strategy, /buildDiscoveryTerms/);
  assert.match(strategy, /compactVariant/);
  assert.match(strategy, /pairedQueries/);
  assert.match(strategy, /buildHashtagTerms/);
  assert.match(monid, /hashtags: hashtagTerms/);
  assert.match(monid, /terms\.slice\(0, 3\).*keyword/s);
  assert.match(sync, /brandScopeDecision/);
  assert.match(sync, /命中排除词/);
  assert.match(sync, /品牌官方账号内容/);
  assert.match(sync, /缺少身份锚点/);
  assert.match(sync, /INSERT INTO collection_diagnostics/);
  assert.match(providers, /fetchPage\(2\), fetchPage\(3\)/);
  assert.match(schema, /collectionDiagnostics/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS collection_diagnostics/);
  assert.match(migration, /CREATE TABLE `collection_diagnostics`/);
  assert.match(dataRoute, /DELETE FROM collection_diagnostics WHERE brand_id = \?/);
  assert.match(page, /采集完整度与漏收诊断/);
  assert.match(page, /接口返回候选/);
  assert.match(page, /没有被规则过滤的候选/);
});

test("archive location inference is reviewable and Russia maps to the flat SVG", async () => {
  const [page, providers, sync, route, repository, map] = await Promise.all([
    source("app/page.tsx"), source("db/providers.ts"), source("db/news-sync.ts"), source("app/api/data/route.ts"), source("db/repository.ts"), source("public/world-map-flat.svg"),
  ]);
  assert.match(providers, /德语: \{ country: "德国"/);
  assert.match(providers, /法语: \{ country: "法国"/);
  assert.match(providers, /俄语: \{ country: "俄罗斯"/);
  assert.match(providers, /语言主要使用国推断（可人工校正）/);
  assert.match(sync, /inferredLanguage\.language/);
  assert.match(route, /action === "updateMentionLocation"/);
  assert.match(route, /location_method = '人工校正'/);
  assert.match(page, /校正来源地区与语言/);
  assert.match(page, /人工保存后优先级最高/);
  assert.match(page, /俄罗斯: "RU"/);
  assert.match(repository, /source_country = '俄罗斯'/);
  assert.match(map, /id="ru"/);
});

test("Monid Reddit connector uses Apify discovery, TikHub details, and paginated comments", async () => {
  const [monid, page, comments, repository, newsSync, pipeline] = await Promise.all([
    source("db/monid.ts"), source("app/page.tsx"), source("app/api/comments/route.ts"), source("db/repository.ts"), source("db/news-sync.ts"), source("db/sync-pipeline.ts"),
  ]);
  assert.match(monid, /\/trudax\/reddit-scraper-lite/);
  assert.match(monid, /\/api\/v1\/reddit\/app\/fetch_post_details/);
  assert.match(monid, /\/api\/v1\/reddit\/app\/fetch_post_comments/);
  assert.match(monid, /\/api\/v1\/reddit\/app\/fetch_comment_replies/);
  assert.match(monid, /searches: terms\.slice\(0, 5\)/);
  assert.match(monid, /searchPosts: true/);
  assert.match(monid, /time: "month"/);
  assert.match(monid, /includeNSFW: true/);
  assert.match(monid, /sort: "relevance"/);
  assert.match(monid, /includeMediaLinks: true/);
  assert.match(monid, /providerResponse\?\.data \?\? run\.output/);
  assert.match(monid, /const output = runOutput\(run\)/);
  assert.match(monid, /REDDIT_SEARCH_CONTRACT_VERSION = 2/);
  assert.match(monid, /!redditContractCurrent/);
  assert.match(monid, /stage = "reddit_details"/);
  assert.match(monid, /processRedditDetails/);
  assert.match(monid, /UPDATE monid_jobs SET status = 'FAILED'/);
  assert.match(monid, /post_id: target\.media_id/);
  assert.match(monid, /queryParams\.after = target\.cursor/);
  assert.match(monid, /replyAdapter === "reddit"/);
  assert.match(monid, /redditCommentPage/);
  assert.match(page, /<option>Reddit<\/option>/);
  assert.doesNotMatch(page, /reddit-archive-status/);
  assert.match(page, /关键词发现 · 详情补全 · 评论跟踪/);
  assert.match(comments, /platform: "Reddit"/);
  assert.match(repository, /"Reddit"\] as const/);
  assert.match(newsSync, /"Facebook", "Reddit"/);
  assert.match(monid, /platformHealthKey/);
  assert.match(monid, /Monid \/ \$\{platform\}/);
  assert.match(monid, /markPlatformFailed/);
  assert.match(pipeline, /MAIN_STAGES.*"maintenance", "discovery", "audience"/);
  assert.match(pipeline, /SyncPipelineTaskType = "main" \| "reddit"/);
  assert.match(pipeline, /enqueuePipelineTask\(userId, "main"/);
  assert.match(pipeline, /enqueuePipelineTask\(userId, "reddit"/);
  assert.match(pipeline, /job\.task_type === "reddit"/);
  assert.match(pipeline, /lease_until/);
  assert.match(pipeline, /phaseRetryAt/);
  assert.ok(pipeline.indexOf("result?.phaseRetryAt") < pipeline.indexOf("result?.phasePending"));
  assert.match(monid, /countPendingMonidSearchJobs/);
  assert.match(newsSync, /searchPending/);
  assert.match(pipeline, /job\.stage === "discovery"/);
  assert.match(pipeline, /archiveDiscoveryPending/);
  assert.match(pipeline, /archiveChanged/);
  assert.match(pipeline, /hasRunnableRedditDiscovery/);
  assert.match(pipeline, /force = 0/);
  assert.match(page, /新闻档案优先采集/);
  assert.match(page, /受众舆情采集/);
  assert.match(page, /Reddit 独立任务/);
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

test("Monid searches six social platforms and archives public comments and replies", async () => {
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
  assert.match(translation, /MAX_CONFIGURED_ITEMS_PER_CYCLE = 24/);
  assert.match(translation, /target_lang: "EN-US"/);
  assert.match(translation, /translateTextToAmericanEnglish/);
  assert.match(translation, /language LIKE '%中文%'/);
  assert.match(translation, /hasDedicatedTranslator\(credentials\)/);
  assert.match(translation, /!hasDedicatedTranslator\(credentials\) && isDailyQuotaError/);
  assert.match(translation, /USED ALL AVAILABLE FREE TRANSLATIONS/);
  assert.match(translation, /24 \* 60 \* 60_000/);
  assert.match(translation, /\.\.\.mentions\.results[\s\S]*\.\.\.comments\.results/);
  assert.match(translation, /Promise\.all\(remote\.map/);
  assert.match(sync, /runTranslationCycle/);
  assert.match(sync, /inserted > 0 && mode === "full" \? await runTranslationCycle/);
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
  assert.match(page, /function translatedMentionCopy/);
  assert.match(page, /function translatedCommentCopy/);
  assert.match(page, /uiLanguage === "en"/);
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

test("configured official social accounts are excluded from archive, audience analysis, and future ingestion", async () => {
  const [officialAccounts, repository, comments, sync, page] = await Promise.all([
    source("db/official-accounts.ts"), source("db/repository.ts"), source("app/api/comments/route.ts"),
    source("db/news-sync.ts"), source("app/page.tsx"),
  ]);
  assert.match(officialAccounts, /officialAccountHandles/);
  assert.match(officialAccounts, /socialMetrics\?\.authorUsername/);
  assert.match(officialAccounts, /socialMetrics\?\.authorId/);
  assert.match(officialAccounts, /officialDisplayNames/);
  assert.match(officialAccounts, /isUnattributedSyntheticSocialPost/);
  assert.match(officialAccounts, /official\.has\(handle\)/);
  assert.match(repository, /!comesFromOfficialAccount/);
  assert.match(comments, /NOT EXISTS \(SELECT 1 FROM social_post_metrics official_metrics/);
  assert.match(comments, /official_name_metrics\.author_name/);
  assert.match(comments, /tiktok\.com\/@user\/video/);
  assert.match(sync, /if \(comesFromOfficialAccount\(candidate, brand\.official_accounts/);
  assert.match(page, /官方社媒账号内容会从外部舆情档案与分析中排除/);
});

test("TikTok parsing rejects nested sound objects and captures stable author identity paths", async () => {
  const monid = await source("db/monid.ts");
  assert.match(monid, /platform === "TikTok" && !postId\) continue/);
  assert.match(monid, /aweme_info\.author\.uniqueId/);
  assert.match(monid, /aweme_info\.author\.uid/);
  assert.match(monid, /aweme_info\.share_info\.share_url/);
  assert.doesNotMatch(monid, /platform === "TikTok" \? \["aweme_info\.aweme_id", "aweme_id", "id"\]/);
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

test("worker resumes the staged monitor in the background", async () => {
  const [worker, vite] = await Promise.all([source("worker/index.ts"), source("vite.config.ts")]);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /runScheduledSyncPipelines\(\)/);
  assert.match(worker, /ctx\.waitUntil\(processSyncPipeline\(pipelineId\)\)/);
  assert.match(vite, /crons: \["\*\/5 \* \* \* \*"\]/);
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

test("the complete interface offers a persistent Chinese and English language switch", async () => {
  const [page, language, styles, report] = await Promise.all([
    source("app/page.tsx"), source("app/ui-language.ts"), source("app/globals.css"), source("app/report-view.tsx"),
  ]);
  assert.match(page, /useInterfaceLanguage/);
  assert.match(page, /className="language-button"/);
  assert.match(page, /role="menuitemradio"/);
  assert.match(page, /English interface/);
  assert.match(language, /somnia-media-ui-language/);
  assert.match(language, /MutationObserver/);
  assert.match(language, /document\.documentElement\.lang/);
  assert.match(language, /"新闻档案": "Media Archive"/);
  assert.match(language, /"受众舆情": "Audience Intelligence"/);
  assert.match(language, /"数据采集": "Data Collection"/);
  assert.match(language, /"产品使用说明": "Product Guide"/);
  assert.match(styles, /\.language-options/);
  assert.match(report, /getUiLocale/);
});

test("English mode contains no Chinese fallback and translates workspace content into American English", async () => {
  const [page, uiLanguage, route, translation, report, commentsRoute] = await Promise.all([
    source("app/page.tsx"), source("app/ui-language.ts"), source("app/api/ui-translate/route.ts"),
    source("db/translation.ts"), source("app/report-view.tsx"), source("app/api/comments/route.ts"),
  ]);
  assert.match(uiLanguage, /translated = usableAmericanEnglish\(cached\) \? cached! : ""/);
  assert.match(uiLanguage, /Translation is temporarily unavailable/);
  assert.match(uiLanguage, /fetch\("\/api\/ui-translate"/);
  assert.match(uiLanguage, /useAmericanEnglishBatch/);
  assert.match(uiLanguage, /data-no-ui-translate container/);
  assert.doesNotMatch(uiLanguage, /closest\("\[data-no-ui-translate\], \.english-translation/);
  assert.match(route, /translateTextToAmericanEnglish/);
  assert.match(route, /locale: "en-US"/);
  assert.match(translation, /target_lang: "EN-US"/);
  assert.match(page, /useMentionCopies/);
  assert.match(page, /mentionCopy\(cluster\.items\[0\]\)\.title/);
  assert.match(page, /commentCopy\(comment\)/);
  assert.doesNotMatch(page, /Translation into American English is pending/);
  assert.match(page, /word-cloud" data-no-ui-translate/);
  assert.match(page, /Translating analysis terms/);
  assert.match(report, /translatedReportCommentText/);
  assert.doesNotMatch(report, /Translation into American English is pending/);
  assert.match(report, /report-inline-conclusion" data-no-ui-translate/);
  assert.match(report, /localizedReportWords/);
  assert.match(commentsRoute, /m\.translation_en/);
});

test("independent social discovery APIs share the brand scope, exclusion, archive, and comment pipeline", async () => {
  const [providers, sync, credentials, budgets, repository, page] = await Promise.all([
    source("db/providers.ts"), source("db/news-sync.ts"), source("db/credentials.ts"),
    source("db/news-provider-budget.ts"), source("db/repository.ts"), source("app/page.tsx"),
  ]);
  for (const provider of ["ScrapeCreators", "Brave Search", "Apify", "Bright Data"]) {
    assert.match(credentials, new RegExp(provider));
    assert.match(budgets, new RegExp(provider));
    assert.match(repository, new RegExp(provider));
    assert.match(page, new RegExp(provider));
  }
  assert.match(providers, /fetchScrapeCreators/);
  assert.match(providers, /fetchBraveSocialSearch/);
  assert.match(providers, /fetchApifySocialSearch/);
  assert.match(providers, /fetchBrightDataSocialSearch/);
  assert.match(providers, /third_party_social_search/);
  assert.match(sync, /brandScopeDecision/);
  assert.match(sync, /命中排除词/);
  assert.match(sync, /upsertSocialMetrics/);
  assert.match(sync, /queueSocialCommentTarget/);
});

test("additional global news connectors are replaceable, quota-aware, and honest about batch-only sources", async () => {
  const [providers, sync, credentials, budgets, repository, page] = await Promise.all([
    source("db/providers.ts"), source("db/news-sync.ts"), source("db/credentials.ts"),
    source("db/news-provider-budget.ts"), source("db/repository.ts"), source("app/page.tsx"),
  ]);
  for (const provider of ["The News API", "GNews", "NewsAPI.org", "mediastack", "Guardian Open Platform", "Mastodon"]) {
    assert.match(credentials, new RegExp(provider.replace(".", "\\.")));
    assert.match(budgets, new RegExp(provider.replace(".", "\\.")));
    assert.match(repository, new RegExp(provider.replace(".", "\\.")));
    assert.match(page, new RegExp(provider.replace(".", "\\.")));
  }
  for (const fetcher of ["fetchTheNewsApi", "fetchGNews", "fetchNewsApiOrg", "fetchMediastack", "fetchGuardian", "fetchMastodon", "fetchBlueskySearch", "fetchHackerNews"]) {
    assert.match(providers, new RegExp(fetcher));
    assert.match(sync, new RegExp(fetcher));
  }
  assert.match(repository, /Common Crawl CC-NEWS/);
  assert.match(repository, /当前不会计入自动巡检结果/);
  assert.match(page, /免费层有发布时间延迟且禁止商业使用/);
});
