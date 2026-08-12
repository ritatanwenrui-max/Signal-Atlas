import { env } from "cloudflare:workers";

const tables = [
  `CREATE TABLE IF NOT EXISTS brand_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    platform TEXT NOT NULL,
    source_country TEXT NOT NULL,
    content_country TEXT NOT NULL,
    language TEXT NOT NULL,
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
    domain TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT '地区未披露',
    language TEXT NOT NULL DEFAULT '自动识别',
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
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    language TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
] as const;

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_mentions_published_at ON mentions(published_at)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_country_platform ON mentions(source_country, platform)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_cluster_key ON mentions(cluster_key)",
  "CREATE INDEX IF NOT EXISTS idx_alerts_ack_severity ON alerts(acknowledged, severity)",
  "CREATE INDEX IF NOT EXISTS idx_traffic_country_recorded ON traffic_signals(country, recorded_at)",
  "CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at)",
  "CREATE INDEX IF NOT EXISTS idx_media_sources_next_crawl ON media_sources(status, next_crawl_at)",
  "CREATE INDEX IF NOT EXISTS idx_media_sources_country ON media_sources(country)",
  "CREATE INDEX IF NOT EXISTS idx_propagation_edges_cluster ON propagation_edges(cluster_key)",
  "CREATE INDEX IF NOT EXISTS idx_propagation_edges_to_mention ON propagation_edges(to_mention_id)",
] as const;

export async function ensureDatabase() {
  const db = env.DB;
  await db.batch([...tables, ...indexes].map((statement) => db.prepare(statement)));
}

export async function loadDashboardData(userId = "") {
  await ensureDatabase();
  const db = env.DB;
  const [mentions, traffic, entities, alerts, syncRuns, brand, providerHealth, mediaSources, propagationEdges, credentialRows] = await Promise.all([
    db.prepare("SELECT * FROM mentions ORDER BY published_at DESC").all(),
    db.prepare("SELECT * FROM traffic_signals ORDER BY recorded_at DESC").all(),
    db.prepare("SELECT * FROM tracked_entities ORDER BY id DESC").all(),
    db.prepare("SELECT * FROM alerts ORDER BY acknowledged ASC, id DESC").all(),
    db.prepare("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 20").all(),
    db.prepare("SELECT * FROM brand_profiles WHERE active = 1 ORDER BY id DESC LIMIT 1").first(),
    db.prepare("SELECT * FROM provider_health ORDER BY provider").all<{ provider: string; status: string; retry_after: string; last_error: string; last_success_at: string }>(),
    db.prepare("SELECT * FROM media_sources ORDER BY last_crawled_at DESC, id DESC").all(),
    db.prepare("SELECT * FROM propagation_edges ORDER BY cluster_key, time_gap_minutes ASC").all(),
    db.prepare("SELECT provider, last_four, status, last_test_at, updated_at FROM connector_credentials WHERE user_id = ? ORDER BY provider")
      .bind(userId).all<{ provider: string; last_four: string; status: string; last_test_at: string; updated_at: string }>(),
  ]);
  const gdeltHealth = providerHealth.results.find((item) => item.provider === "GDELT");
  const gdeltLimited = Boolean(gdeltHealth?.status === "limited" && gdeltHealth.retry_after && new Date(gdeltHealth.retry_after).getTime() > Date.now());
  const eventRegistryHealth = providerHealth.results.find((item) => item.provider === "NewsAPI.ai");
  const eventRegistryLimited = Boolean(eventRegistryHealth?.retry_after && new Date(eventRegistryHealth.retry_after).getTime() > Date.now());
  const storedCredentials = new Map(credentialRows.results.map((item) => [item.provider, item]));
  const newsApiConfigured = Boolean(env.NEWSAPI_AI_KEY || storedCredentials.has("NewsAPI.ai"));
  const xConfigured = Boolean(env.X_BEARER_TOKEN || storedCredentials.has("X"));
  const youtubeConfigured = Boolean(env.YOUTUBE_API_KEY || storedCredentials.has("YouTube"));
  const newsApiAvailable = Boolean(newsApiConfigured && !eventRegistryLimited);
  const newsLimited = !newsApiAvailable && gdeltLimited;
  const newsDetail = newsApiConfigured
    ? eventRegistryLimited && gdeltLimited ? "NewsAPI.ai 与 GDELT 均在退避重试"
      : eventRegistryLimited ? "GDELT 正常采集 · NewsAPI.ai 暂时退避"
      : gdeltLimited ? "NewsAPI.ai 正常采集 · GDELT 限流保护中"
      : "NewsAPI.ai 每 6 小时发现 · 免费媒体源每小时追踪"
    : gdeltLimited ? "GDELT 限流保护中 · 免费媒体源持续追踪" : "GDELT 每日发现 · 免费媒体源每小时追踪";
  const retryAt = newsLimited
    ? [eventRegistryHealth?.retry_after, gdeltHealth?.retry_after].filter(Boolean).sort()[0] ?? ""
    : "";
  const mentionRows = mentions.results as Array<Record<string, unknown>>;
  const countryMap = new Map<string, { country: string; count: number; positive: number; neutral: number; negative: number; risk: number; engagement: number; latest: string }>();
  const sentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  const timelineMap = new Map<string, { date: string; total: number; positive: number; negative: number }>();
  const wordMap = new Map<string, number>();
  const sourceMap = new Map<string, { source: string; country: string; count: number; impact: number }>();
  const stopwords = new Set(["the", "and", "for", "with", "from", "that", "this", "have", "will", "news", "brand", "company", "their", "about", "into", "after", "more", "latest", "报道", "新闻", "媒体", "公司", "品牌", "一个", "以及", "进行", "表示", "相关", "发布", "今日", "目前", "可以"]);
  const tracked = (entities.results as Array<Record<string, unknown>>).map((item) => String(item.value ?? "").toLowerCase());
  for (const row of mentionRows) {
    const country = String(row.source_country ?? "地区未披露");
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
    providerHealth: providerHealth.results,
    mediaSources: sourceRows,
    propagationEdges: propagationEdges.results,
    connectorCredentials: credentialRows.results,
    analytics: {
      countries: [...countryMap.values()].sort((a, b) => b.count - a.count),
      sentiment,
      timeline: [...timelineMap.values()].filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      words: [...wordMap.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 45),
      sources: [...sourceMap.values()].sort((a, b) => b.count - a.count || b.impact - a.impact).slice(0, 12),
      crossBorderEdges: (propagationEdges.results as Array<Record<string, unknown>>).filter((item) => Number(item.cross_border) === 1).length,
      archivedTotal: mentionRows.length,
    },
    connectors: [
      { id: "news", provider: "NewsAPI.ai", configurable: true, configured: newsApiConfigured, lastFour: storedCredentials.get("NewsAPI.ai")?.last_four ?? (env.NEWSAPI_AI_KEY ? "环境密钥" : ""), name: "全球发现引擎", status: newsLimited ? "limited" : "online", detail: newsDetail, retryAt },
      { id: "crawler", name: "免费媒体追踪", status: crawlerOnline ? "online" : "limited", detail: `${sourceRows.length} 个媒体来源 · RSS / Atom / 新闻 Sitemap · robots.txt 合规` },
      { id: "x", provider: "X", configurable: true, configured: xConfigured, lastFour: storedCredentials.get("X")?.last_four ?? (env.X_BEARER_TOKEN ? "环境密钥" : ""), name: "X", status: xConfigured ? "online" : "credentials", detail: xConfigured ? "近 7 日公开帖文、转发与引用链路" : "可在本页配置 Bearer Token" },
      { id: "youtube", provider: "YouTube", configurable: true, configured: youtubeConfigured, lastFour: storedCredentials.get("YouTube")?.last_four ?? (env.YOUTUBE_API_KEY ? "环境密钥" : ""), name: "YouTube", status: youtubeConfigured ? "online" : "credentials", detail: youtubeConfigured ? "视频、互动量与高相关评论" : "可在本页配置 API Key" },
      { id: "meta", name: "Meta / Instagram", status: "approval", detail: "需企业账号授权或数据供应商" },
      { id: "tiktok", name: "TikTok", status: "approval", detail: "商业监测需合规数据供应商" },
    ],
  };
}
