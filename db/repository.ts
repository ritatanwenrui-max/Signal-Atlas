import { env } from "cloudflare:workers";

const tables = [
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

  const count = await db.prepare("SELECT COUNT(*) AS count FROM mentions").first<{ count: number }>();
  if ((count?.count ?? 0) === 0) await seedDatabase();
}

async function seedDatabase() {
  const db = env.DB;
  const mentionRows = [
    ["AI性爱机器人问世！狂塞165种火辣体位", "https://tw.news.yahoo.com/demo", "Yahoo新闻", "网页新闻", "台湾", "台湾", "繁体中文", "中性", 44, 91, "台湾综合媒体改写香港采访，强调产品姿势数量与AI互动能力。", "silicon-companion-launch", "2026-08-09T10:20:00Z"],
    ["『AI性爱机器人』真的要来了！165种姿势售价曝", "https://www.ettoday.net/demo", "ETtoday新闻云", "网页新闻", "台湾", "台湾", "繁体中文", "中性", 37, 88, "报道聚焦 Somnia Lab 硅姬的外观、价格与互动能力。", "silicon-companion-launch", "2026-08-08T07:40:00Z"],
    ["AI『成人伴侣』机器人真的来了", "https://news.ebc.net.tw/demo", "东森新闻", "网页新闻", "台湾", "台湾", "繁体中文", "中性", 41, 84, "东森新闻对产品功能和公司背景进行了编辑改写。", "silicon-companion-launch", "2026-08-09T02:15:00Z"],
    ["成人机器人硅姬解锁165种姿势", "https://www.taiwanhot.net/demo", "台湾好新闻", "网页新闻", "台湾", "台湾", "繁体中文", "中性", 34, 69, "地方媒体转载并延伸解释 AI 记忆和长期互动机制。", "silicon-companion-launch", "2026-08-10T11:05:00Z"],
    ["Hong Kong robotics startup unveils AI companion", "https://hkstartup.example/demo", "HK Startup Beat", "网页新闻", "香港", "香港", "英文", "正面", 23, 76, "原始采访介绍产品定位、团队和上市计划。", "silicon-companion-launch", "2026-08-07T04:30:00Z"],
    ["หุ่นยนต์คู่หู AI จากฮ่องกงกำลังได้รับความสนใจ", "https://thaitech.example/demo", "Thai Tech Daily", "网页新闻", "泰国", "泰国", "泰语", "正面", 29, 72, "泰国科技媒体转载香港报道，讨论产品在东南亚市场的关注度。", "silicon-companion-launch", "2026-08-10T06:10:00Z"],
    ["What intimate AI devices mean for personal data", "https://futureprivacy.example/demo", "Future Privacy Review", "网页新闻", "美国", "全球", "英文", "负面", 82, 93, "行业评论质疑亲密 AI 设备的数据留存与隐私边界。", "privacy-risk-discussion", "2026-08-11T00:25:00Z"],
    ["AI companion demo draws crowds at Tokyo Future Expo", "https://youtube.com/watch?v=demo", "Future Lab Japan", "YouTube", "日本", "日本", "日语", "正面", 18, 78, "展会视频展示产品互动和现场观众反应。", "tokyo-expo-demo", "2026-08-10T09:00:00Z"],
    ["AI companion clip crosses 1M views in Thailand", "https://instagram.com/p/demo", "NextGen Thailand", "Instagram", "泰国", "泰国", "泰语", "正面", 21, 96, "新闻账号将媒体报道剪辑为短视频，互动速度快速增长。", "silicon-companion-launch", "2026-08-11T01:05:00Z"],
  ];

  const entityRows = [
    ["公司", "Somnia Lab", "英文"],
    ["公司", "SomniaLab", "英文"],
    ["产品", "硅姬", "简体中文"],
    ["产品", "矽姬", "繁体中文"],
    ["事件指纹", "165种姿势", "简体中文"],
    ["域名", "somnialab.com", "通用"],
  ];

  const trafficRows = [
    ["台湾", 4433, 23925, 860, "/products/silicon-companion", 515, "2026-08-10T12:00:00Z"],
    ["香港", 1165, 6999, 730, "/products/silicon-companion", 160, "2026-08-10T12:00:00Z"],
    ["泰国", 881, 4824, 190, "/products/silicon-companion", 464, "2026-08-10T12:00:00Z"],
    ["美国", 701, 4994, 650, "/products/silicon-companion", 108, "2026-08-10T12:00:00Z"],
  ];

  await db.batch([
    ...mentionRows.map((row) => db.prepare(`INSERT INTO mentions
      (title, url, source, platform, source_country, content_country, language, sentiment, risk, impact, summary, cluster_key, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(...row)),
    ...entityRows.map((row) => db.prepare("INSERT INTO tracked_entities (type, value, language) VALUES (?, ?, ?)").bind(...row)),
    ...trafficRows.map((row) => db.prepare(`INSERT INTO traffic_signals
      (country, visitors, views, baseline, landing_page, anomaly_ratio, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(...row)),
    db.prepare("INSERT INTO alerts (title, severity, country, reason) VALUES (?, ?, ?, ?)")
      .bind("美国隐私评论进入高风险区间", "Critical", "美国", "风险分 82，媒体影响力 93，涉及个人数据留存"),
    db.prepare("INSERT INTO alerts (title, severity, country, reason) VALUES (?, ?, ?, ?)")
      .bind("台湾官网访问量高于基线 5.1 倍", "High", "台湾", "流量异常与新闻转载时间高度重合"),
    db.prepare("INSERT INTO alerts (title, severity, country, reason) VALUES (?, ?, ?, ?)")
      .bind("事件首次进入泰国市场", "High", "泰国", "网页新闻与 Instagram 新闻账号同步扩散"),
  ]);
}

export async function loadDashboardData() {
  await ensureDatabase();
  const db = env.DB;
  const [mentions, traffic, entities, alerts, syncRuns] = await Promise.all([
    db.prepare("SELECT * FROM mentions ORDER BY published_at DESC").all(),
    db.prepare("SELECT * FROM traffic_signals ORDER BY recorded_at DESC").all(),
    db.prepare("SELECT * FROM tracked_entities ORDER BY id DESC").all(),
    db.prepare("SELECT * FROM alerts ORDER BY acknowledged ASC, id DESC").all(),
    db.prepare("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 20").all(),
  ]);
  return {
    mentions: mentions.results,
    traffic: traffic.results,
    entities: entities.results,
    alerts: alerts.results,
    syncRuns: syncRuns.results,
  };
}
