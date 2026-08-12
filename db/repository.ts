import { env } from "cloudflare:workers";

const tables = [
  `CREATE TABLE IF NOT EXISTS brand_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    platform TEXT NOT NULL,
    source_country TEXT NOT NULL,
    content_country TEXT NOT NULL,
    language TEXT NOT NULL,
    location_confidence INTEGER NOT NULL DEFAULT 0,
    location_method TEXT NOT NULL DEFAULT '',
    sentiment TEXT NOT NULL,
    risk INTEGER NOT NULL DEFAULT 20,
    impact INTEGER NOT NULL DEFAULT 50,
    summary TEXT NOT NULL DEFAULT '',
    cluster_key TEXT NOT NULL,
    parent_url TEXT NOT NULL DEFAULT '',
    relation TEXT NOT NULL DEFAULT '',
    engagement INTEGER NOT NULL DEFAULT 0,
    excerpt TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    discovered_via TEXT NOT NULL DEFAULT 'global_discovery',
    content_hash TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    sentiment_score INTEGER NOT NULL DEFAULT 0,
    topics TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS media_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    domain TEXT NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT '地区待确认',
    language TEXT NOT NULL DEFAULT '语言待确认',
    homepage_url TEXT NOT NULL,
    feed_url TEXT NOT NULL DEFAULT '',
    sitemap_url TEXT NOT NULL DEFAULT '',
    robots_policy TEXT NOT NULL DEFAULT '',
    robots_checked_at TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'discovered',
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    last_discovered_at TEXT NOT NULL,
    last_crawled_at TEXT NOT NULL DEFAULT '',
    next_crawl_at TEXT NOT NULL,
    etag TEXT NOT NULL DEFAULT '',
    last_modified TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS propagation_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    cluster_key TEXT NOT NULL,
    from_mention_id INTEGER NOT NULL,
    to_mention_id INTEGER NOT NULL,
    similarity INTEGER NOT NULL,
    confidence INTEGER NOT NULL,
    method TEXT NOT NULL,
    evidence TEXT NOT NULL,
    time_gap_minutes INTEGER NOT NULL,
    cross_border INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS traffic_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    country TEXT NOT NULL,
    visitors INTEGER NOT NULL,
    views INTEGER NOT NULL,
    baseline INTEGER NOT NULL,
    landing_page TEXT NOT NULL,
    anomaly_ratio INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS tracked_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    language TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    mention_id INTEGER,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    country TEXT NOT NULL,
    reason TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    provider TEXT NOT NULL,
    query TEXT NOT NULL,
    status TEXT NOT NULL,
    found_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_locks (
    name TEXT PRIMARY KEY,
    locked_until TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS provider_health (
    provider TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'online',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    retry_after TEXT NOT NULL DEFAULT '',
    last_error TEXT NOT NULL DEFAULT '',
    last_attempt_at TEXT NOT NULL DEFAULT '',
    last_success_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS connector_credentials (
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    last_four TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'saved',
    last_test_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider)
  )`,
  `CREATE TABLE IF NOT EXISTS monid_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    terms TEXT NOT NULL DEFAULT '[]',
    cost INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS social_post_metrics (
    mention_id INTEGER PRIMARY KEY,
    brand_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL DEFAULT '',
    author_id TEXT NOT NULL DEFAULT '',
    author_username TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL DEFAULT '',
    follower_count INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    plays INTEGER NOT NULL DEFAULT 0,
    matched_terms TEXT NOT NULL DEFAULT '[]',
    metrics_updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS social_author_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    author_id TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL,
    follower_count INTEGER NOT NULL DEFAULT 0,
    following_count INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    captured_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS comment_analyses (
    mention_id INTEGER PRIMARY KEY,
    brand_id INTEGER NOT NULL,
    adapter TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unsupported',
    reported_count INTEGER NOT NULL DEFAULT 0,
    analyzed_count INTEGER NOT NULL DEFAULT 0,
    positive_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    mixed_count INTEGER NOT NULL DEFAULT 0,
    sentiment TEXT NOT NULL DEFAULT '样本不足',
    sentiment_score INTEGER NOT NULL DEFAULT 0,
    keywords TEXT NOT NULL DEFAULT '[]',
    last_error TEXT NOT NULL DEFAULT '',
    last_collected_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mention_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mention_id INTEGER NOT NULL,
    brand_id INTEGER NOT NULL,
    source_comment_id TEXT NOT NULL,
    content TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    sentiment_score INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    published_at TEXT NOT NULL DEFAULT '',
    collected_at TEXT NOT NULL
  )`,
] as const;

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_active ON brand_profiles(user_id, active)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_brand_published ON mentions(brand_id, published_at)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_brand_country_platform ON mentions(brand_id, source_country, platform)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_brand_cluster ON mentions(brand_id, cluster_key)",
  "CREATE INDEX IF NOT EXISTS idx_alerts_brand_ack_severity ON alerts(brand_id, acknowledged, severity)",
  "CREATE INDEX IF NOT EXISTS idx_traffic_brand_country_recorded ON traffic_signals(brand_id, country, recorded_at)",
  "CREATE INDEX IF NOT EXISTS idx_sync_runs_brand_started ON sync_runs(brand_id, started_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_media_sources_brand_domain ON media_sources(brand_id, domain)",
  "CREATE INDEX IF NOT EXISTS idx_media_sources_brand_next_crawl ON media_sources(brand_id, status, next_crawl_at)",
  "CREATE INDEX IF NOT EXISTS idx_media_sources_brand_country ON media_sources(brand_id, country)",
  "CREATE INDEX IF NOT EXISTS idx_propagation_edges_brand_cluster ON propagation_edges(brand_id, cluster_key)",
  "CREATE INDEX IF NOT EXISTS idx_propagation_edges_to_mention ON propagation_edges(to_mention_id)",
  "CREATE INDEX IF NOT EXISTS idx_tracked_entities_brand ON tracked_entities(brand_id, active)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_monid_jobs_run_id ON monid_jobs(run_id)",
  "CREATE INDEX IF NOT EXISTS idx_monid_jobs_brand_status ON monid_jobs(brand_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_social_metrics_brand_platform ON social_post_metrics(brand_id, platform)",
  "CREATE INDEX IF NOT EXISTS idx_social_metrics_author ON social_post_metrics(brand_id, author_username)",
  "CREATE INDEX IF NOT EXISTS idx_social_authors_brand_user_time ON social_author_snapshots(brand_id, username, captured_at)",
  "CREATE INDEX IF NOT EXISTS idx_comment_analyses_brand_collected ON comment_analyses(brand_id, last_collected_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_mention_comments_source ON mention_comments(mention_id, source_comment_id)",
  "CREATE INDEX IF NOT EXISTS idx_mention_comments_brand_mention ON mention_comments(brand_id, mention_id)",
] as const;

export async function ensureDatabase() {
  const db = env.DB;
  await db.batch([...tables, ...indexes].map((statement) => db.prepare(statement)));
  await db.batch([
    db.prepare(`UPDATE mentions SET source_country = '中国', content_country = '中国', location_confidence = 99,
      location_method = '媒体域名 / 已知媒体库'
      WHERE (lower(url) LIKE '%://%.163.com/%' OR lower(url) LIKE '%://163.com/%' OR source LIKE '%网易%' OR source LIKE '%網易%')
        AND source_country IN ('地区未披露', '地区待确认', '华语地区')`),
    db.prepare(`UPDATE media_sources SET country = '中国'
      WHERE (lower(domain) = '163.com' OR lower(domain) LIKE '%.163.com' OR name LIKE '%网易%' OR name LIKE '%網易%')
        AND country IN ('地区未披露', '地区待确认', '华语地区')`),
  ]);
}

export async function getActiveBrandForUser(db: D1Database, userId: string) {
  if (!userId) return null;
  return db.prepare("SELECT * FROM brand_profiles WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1")
    .bind(userId).first<Record<string, unknown>>();
}

export async function loadDashboardData(userId = "") {
  await ensureDatabase();
  const db = env.DB;
  const brand = await getActiveBrandForUser(db, userId);
  const brandId = Number(brand?.id ?? -1);
  const healthPrefix = `${brandId}:%`;
  const [mentions, traffic, entities, alerts, syncRuns, providerHealth, mediaSources, propagationEdges, credentialRows, monidJobs] = await Promise.all([
    db.prepare(`SELECT mentions.*, social_post_metrics.post_id AS social_post_id,
      social_post_metrics.author_id AS social_author_id, social_post_metrics.author_username AS social_author_username,
      social_post_metrics.author_name AS social_author_name, social_post_metrics.follower_count AS social_follower_count,
      social_post_metrics.likes AS social_likes, social_post_metrics.comments AS social_comments,
      social_post_metrics.shares AS social_shares, social_post_metrics.views AS social_views,
      social_post_metrics.plays AS social_plays, social_post_metrics.matched_terms AS social_matched_terms,
      social_post_metrics.metrics_updated_at AS social_metrics_updated_at,
      comment_analyses.adapter AS comment_adapter, comment_analyses.status AS comment_status,
      comment_analyses.reported_count AS comment_reported_count, comment_analyses.analyzed_count AS comment_analyzed_count,
      comment_analyses.positive_count AS comment_positive_count, comment_analyses.neutral_count AS comment_neutral_count,
      comment_analyses.negative_count AS comment_negative_count, comment_analyses.mixed_count AS comment_mixed_count,
      comment_analyses.sentiment AS comment_sentiment, comment_analyses.sentiment_score AS comment_sentiment_score,
      comment_analyses.keywords AS comment_keywords, comment_analyses.last_error AS comment_last_error,
      comment_analyses.last_collected_at AS comment_last_collected_at
      FROM mentions LEFT JOIN social_post_metrics ON social_post_metrics.mention_id = mentions.id
      LEFT JOIN comment_analyses ON comment_analyses.mention_id = mentions.id
      WHERE mentions.brand_id = ? ORDER BY mentions.published_at DESC`).bind(brandId).all(),
    db.prepare("SELECT * FROM traffic_signals WHERE brand_id = ? ORDER BY recorded_at DESC").bind(brandId).all(),
    db.prepare("SELECT * FROM tracked_entities WHERE brand_id = ? ORDER BY id DESC").bind(brandId).all(),
    db.prepare("SELECT * FROM alerts WHERE brand_id = ? ORDER BY acknowledged ASC, id DESC").bind(brandId).all(),
    db.prepare("SELECT * FROM sync_runs WHERE brand_id = ? ORDER BY id DESC LIMIT 20").bind(brandId).all(),
    db.prepare("SELECT * FROM provider_health WHERE provider LIKE ? ORDER BY provider").bind(healthPrefix).all<{ provider: string; status: string; retry_after: string; last_error: string; last_success_at: string }>(),
    db.prepare("SELECT * FROM media_sources WHERE brand_id = ? ORDER BY last_crawled_at DESC, id DESC").bind(brandId).all(),
    db.prepare("SELECT * FROM propagation_edges WHERE brand_id = ? ORDER BY cluster_key, time_gap_minutes ASC").bind(brandId).all(),
    db.prepare("SELECT provider, last_four, status, last_test_at, updated_at FROM connector_credentials WHERE user_id = ? ORDER BY provider")
      .bind(userId).all<{ provider: string; last_four: string; status: string; last_test_at: string; updated_at: string }>(),
    db.prepare("SELECT stage, status, cost, error, started_at, completed_at FROM monid_jobs WHERE brand_id = ? ORDER BY id DESC LIMIT 6")
      .bind(brandId).all<{ stage: string; status: string; cost: number; error: string; started_at: string; completed_at: string }>(),
  ]);
  const healthByName = new Map(providerHealth.results.map((item) => [item.provider.replace(/^\d+:/, ""), item]));
  const gdeltHealth = healthByName.get("GDELT");
  const gdeltLimited = Boolean(gdeltHealth?.status === "limited" && gdeltHealth.retry_after && new Date(gdeltHealth.retry_after).getTime() > Date.now());
  const eventRegistryHealth = healthByName.get("NewsAPI.ai");
  const eventRegistryLimited = Boolean(eventRegistryHealth?.retry_after && new Date(eventRegistryHealth.retry_after).getTime() > Date.now());
  const storedCredentials = new Map(credentialRows.results.map((item) => [item.provider, item]));
  const newsApiConfigured = Boolean(env.NEWSAPI_AI_KEY || storedCredentials.has("NewsAPI.ai"));
  const monidConfigured = Boolean(env.MONID_API_KEY || storedCredentials.has("Monid / Instagram"));
  const xConfigured = Boolean(env.X_BEARER_TOKEN || storedCredentials.has("X"));
  const youtubeConfigured = Boolean(env.YOUTUBE_API_KEY || storedCredentials.has("YouTube"));
  const metaConfigured = storedCredentials.has("Meta / Instagram");
  const tiktokConfigured = storedCredentials.has("TikTok");
  const monidHealth = healthByName.get("Monid / Instagram");
  const monidLimited = Boolean(monidHealth?.retry_after && new Date(monidHealth.retry_after).getTime() > Date.now());
  const monidPending = monidJobs.results.filter((item) => ["CREATED", "QUEUED", "PENDING", "READY", "RUNNING"].includes(item.status)).length;
  const newsApiAvailable = Boolean(newsApiConfigured && !eventRegistryLimited);
  const newsLimited = !newsApiAvailable && gdeltLimited;
  const newsDetail = newsApiConfigured
    ? eventRegistryLimited && gdeltLimited ? "NewsAPI.ai 与 GDELT 均在退避重试"
      : eventRegistryLimited ? "GDELT 正常采集 · NewsAPI.ai 暂时退避"
      : gdeltLimited ? "NewsAPI.ai 正常采集 · GDELT 限流保护中"
      : "NewsAPI.ai 每 6 小时发现 · 免费源按到期批次追踪"
    : gdeltLimited ? "GDELT 限流保护中 · 免费媒体源持续追踪" : "GDELT 每日发现 · 免费源按到期批次追踪";
  const retryAt = newsLimited
    ? [eventRegistryHealth?.retry_after, gdeltHealth?.retry_after].filter(Boolean).sort()[0] ?? ""
    : "";
  const mentionRows = mentions.results as Array<Record<string, unknown>>;
  const countryMap = new Map<string, { country: string; count: number; positive: number; neutral: number; negative: number; risk: number; engagement: number; latest: string }>();
  const sentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  const timelineMap = new Map<string, { date: string; total: number; positive: number; negative: number }>();
  const wordMap = new Map<string, number>();
  const commentWordMap = new Map<string, number>();
  const commentSentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  let commentsAnalyzed = 0;
  const sourceMap = new Map<string, { source: string; country: string; count: number; impact: number }>();
  const stopwords = new Set(["the", "and", "for", "with", "from", "that", "this", "have", "will", "news", "brand", "company", "their", "about", "into", "after", "more", "latest", "报道", "新闻", "媒体", "公司", "品牌", "一个", "以及", "进行", "表示", "相关", "发布", "今日", "目前", "可以"]);
  const tracked = (entities.results as Array<Record<string, unknown>>).map((item) => String(item.value ?? "").toLowerCase());
  for (const row of mentionRows) {
    const country = String(row.source_country ?? "地区待确认");
    const tone = String(row.sentiment ?? "中性");
    const current = countryMap.get(country) ?? { country, count: 0, positive: 0, neutral: 0, negative: 0, risk: 0, engagement: 0, latest: "" };
    current.count += 1;
    if (tone === "正面") current.positive += 1;
    else if (tone === "负面") current.negative += 1;
    else current.neutral += 1;
    current.risk = Math.max(current.risk, Number(row.risk ?? 0));
    current.engagement += Number(row.engagement ?? 0);
    current.latest = [current.latest, String(row.published_at ?? "")].sort().at(-1) ?? "";
    countryMap.set(country, current);
    if (tone === "正面") sentiment.positive += 1;
    else if (tone === "负面") sentiment.negative += 1;
    else if (tone === "混合") sentiment.mixed += 1;
    else sentiment.neutral += 1;
    const day = String(row.published_at ?? "").slice(0, 10);
    const daily = timelineMap.get(day) ?? { date: day, total: 0, positive: 0, negative: 0 };
    daily.total += 1;
    if (tone === "正面") daily.positive += 1;
    if (tone === "负面") daily.negative += 1;
    timelineMap.set(day, daily);
    const source = String(row.source ?? "未知来源");
    const sourceStat = sourceMap.get(source) ?? { source, country, count: 0, impact: 0 };
    sourceStat.count += 1;
    sourceStat.impact = Math.max(sourceStat.impact, Number(row.impact ?? 0));
    sourceMap.set(source, sourceStat);
    const text = `${String(row.title ?? "")} ${String(row.excerpt ?? "")} ${String(row.keywords ?? "")}`.toLowerCase();
    for (const token of text.match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []) {
      if (!stopwords.has(token) && !tracked.some((term) => term === token)) wordMap.set(token, (wordMap.get(token) ?? 0) + 1);
    }
    for (const sequence of text.match(/\p{Script=Han}{2,}/gu) ?? []) {
      for (let index = 0; index < sequence.length - 1; index += 1) {
        const token = sequence.slice(index, index + 2);
        if (!stopwords.has(token) && !tracked.some((term) => term.includes(token))) wordMap.set(token, (wordMap.get(token) ?? 0) + 1);
      }
    }
    commentsAnalyzed += Number(row.comment_analyzed_count ?? 0);
    commentSentiment.positive += Number(row.comment_positive_count ?? 0);
    commentSentiment.neutral += Number(row.comment_neutral_count ?? 0);
    commentSentiment.negative += Number(row.comment_negative_count ?? 0);
    commentSentiment.mixed += Number(row.comment_mixed_count ?? 0);
    try {
      const commentKeywords = JSON.parse(String(row.comment_keywords ?? "[]")) as Array<{ word?: string; count?: number }>;
      for (const keyword of commentKeywords) {
        const word = String(keyword.word ?? "").trim();
        const count = Number(keyword.count ?? 0);
        if (word && count > 0) commentWordMap.set(word, (commentWordMap.get(word) ?? 0) + count);
      }
    } catch { /* Older rows may not contain JSON yet. */ }
  }
  const sourceRows = mediaSources.results as Array<Record<string, unknown>>;
  const crawlerOnline = sourceRows.some((item) => item.status === "active" || item.status === "discovered" || item.status === "watching");
  return {
    mentions: mentionRows,
    traffic: traffic.results,
    entities: entities.results,
    alerts: alerts.results,
    syncRuns: syncRuns.results,
    brand,
    providerHealth: providerHealth.results.map((item) => ({ ...item, provider: item.provider.replace(/^\d+:/, "") })),
    mediaSources: sourceRows,
    propagationEdges: propagationEdges.results,
    connectorCredentials: credentialRows.results,
    analytics: {
      countries: [...countryMap.values()].sort((a, b) => b.count - a.count),
      sentiment,
      timeline: [...timelineMap.values()].filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      words: [...wordMap.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 45),
      commentWords: [...commentWordMap.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 45),
      commentSentiment,
      commentsAnalyzed,
      sources: [...sourceMap.values()].sort((a, b) => b.count - a.count || b.impact - a.impact).slice(0, 12),
      crossBorderEdges: (propagationEdges.results as Array<Record<string, unknown>>).filter((item) => Number(item.cross_border) === 1).length,
      archivedTotal: mentionRows.length,
    },
    connectors: [
      { id: "news", provider: "NewsAPI.ai", configurable: true, configured: newsApiConfigured, lastFour: storedCredentials.get("NewsAPI.ai")?.last_four ?? (env.NEWSAPI_AI_KEY ? "环境密钥" : ""), name: "全球发现引擎", status: newsLimited ? "limited" : "online", detail: newsDetail, retryAt },
      { id: "crawler", name: "免费媒体追踪", status: crawlerOnline ? "online" : "limited", detail: `${sourceRows.length} 个媒体来源 · RSS / Atom / 新闻 Sitemap · robots.txt 合规` },
      { id: "monid-instagram", provider: "Monid / Instagram", configurable: true, configured: monidConfigured,
        lastFour: storedCredentials.get("Monid / Instagram")?.last_four ?? (env.MONID_API_KEY ? "环境密钥" : ""), name: "Instagram 公共搜索（Monid）",
        status: !monidConfigured ? "credentials" : monidLimited ? "limited" : "online",
        pending: monidPending, retryAt: monidHealth?.retry_after ?? "", lastError: monidHealth?.last_error ?? "",
        detail: !monidConfigured ? "配置 Monid API Key 后，按品牌词搜索公开帖子并补全作者与互动数据"
          : monidLimited ? `上次调用未完成：${monidHealth?.last_error || "等待服务恢复"}${monidHealth?.retry_after ? ` · ${new Date(monidHealth.retry_after).toLocaleString("zh-CN")} 后自动重试` : ""}`
          : monidPending ? `${monidPending} 个任务采集中，页面会自动回收结果` : "普通文字关键词搜帖 · 作者粉丝数 · 点赞、评论、转发与播放量" },
      { id: "x", provider: "X", configurable: true, configured: xConfigured, lastFour: storedCredentials.get("X")?.last_four ?? (env.X_BEARER_TOKEN ? "环境密钥" : ""), name: "X", status: xConfigured ? "online" : "credentials", detail: xConfigured ? "近 7 日公开帖文、转发与引用链路" : "可在本页配置 Bearer Token" },
      { id: "youtube", provider: "YouTube", configurable: true, configured: youtubeConfigured, lastFour: storedCredentials.get("YouTube")?.last_four ?? (env.YOUTUBE_API_KEY ? "环境密钥" : ""), name: "YouTube", status: youtubeConfigured ? "online" : "credentials", detail: youtubeConfigured ? "视频、互动量与高相关评论" : "可在本页配置 API Key" },
      { id: "meta", provider: "Meta / Instagram", configurable: true, configured: metaConfigured, lastFour: storedCredentials.get("Meta / Instagram")?.last_four ?? "", name: "Meta / Instagram", status: metaConfigured ? "approval" : "credentials", detail: metaConfigured ? "凭证已保存 · 需 Business / Creator 权限和 App Review 后启用提及采集" : "可配置 Access Token 与 Instagram Business Account ID" },
      { id: "tiktok", provider: "TikTok", configurable: true, configured: tiktokConfigured, lastFour: storedCredentials.get("TikTok")?.last_four ?? "", name: "TikTok", status: tiktokConfigured ? "approval" : "credentials", detail: tiktokConfigured ? "凭证已保存 · Research API 获批后启用公开关键词监测" : "可配置 Research API Client Key 与 Client Secret" },
    ],
  };
}
