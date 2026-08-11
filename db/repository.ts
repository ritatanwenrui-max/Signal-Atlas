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
    published_at TEXT NOT NULL,
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
] as const;

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_mentions_published_at ON mentions(published_at)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_country_platform ON mentions(source_country, platform)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_cluster_key ON mentions(cluster_key)",
  "CREATE INDEX IF NOT EXISTS idx_alerts_ack_severity ON alerts(acknowledged, severity)",
  "CREATE INDEX IF NOT EXISTS idx_traffic_country_recorded ON traffic_signals(country, recorded_at)",
  "CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at)",
] as const;

export async function ensureDatabase() {
  const db = env.DB;
  await db.batch([...tables, ...indexes].map((statement) => db.prepare(statement)));
}

export async function loadDashboardData() {
  await ensureDatabase();
  const db = env.DB;
  const [mentions, traffic, entities, alerts, syncRuns, brand] = await Promise.all([
    db.prepare("SELECT * FROM mentions ORDER BY published_at DESC").all(),
    db.prepare("SELECT * FROM traffic_signals ORDER BY recorded_at DESC").all(),
    db.prepare("SELECT * FROM tracked_entities ORDER BY id DESC").all(),
    db.prepare("SELECT * FROM alerts ORDER BY acknowledged ASC, id DESC").all(),
    db.prepare("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 20").all(),
    db.prepare("SELECT * FROM brand_profiles WHERE active = 1 ORDER BY id DESC LIMIT 1").first(),
  ]);
  return {
    mentions: mentions.results,
    traffic: traffic.results,
    entities: entities.results,
    alerts: alerts.results,
    syncRuns: syncRuns.results,
    brand,
    connectors: [
      { id: "news", name: "全球网页新闻", status: "online", detail: "GDELT · 每 10 分钟" },
      { id: "x", name: "X", status: env.X_BEARER_TOKEN ? "online" : "credentials", detail: env.X_BEARER_TOKEN ? "近 7 日公开帖文" : "需要 Bearer Token" },
      { id: "youtube", name: "YouTube", status: env.YOUTUBE_API_KEY ? "online" : "credentials", detail: env.YOUTUBE_API_KEY ? "关键词视频搜索" : "需要 API Key" },
      { id: "meta", name: "Meta / Instagram", status: "approval", detail: "需企业账号授权或数据供应商" },
      { id: "tiktok", name: "TikTok", status: "approval", detail: "商业监测需合规数据供应商" },
    ],
  };
}
