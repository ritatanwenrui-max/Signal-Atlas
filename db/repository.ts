import { env } from "cloudflare:workers";
import { meaningfulTokens } from "./text-analysis";
import { comesFromOfficialAccount, isUnattributedSyntheticSocialPost, officialAccountHandles } from "./official-accounts";
import { getNewsProviderQuotaSnapshots } from "./news-provider-budget";

const tables = [
  `CREATE TABLE IF NOT EXISTS brand_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT '',
    workspace_id INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    match_mode TEXT NOT NULL DEFAULT 'precise',
    scope_terms TEXT NOT NULL DEFAULT '',
    exclude_terms TEXT NOT NULL DEFAULT '',
    official_accounts TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    credential_owner_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'editor',
    status TEXT NOT NULL DEFAULT 'active',
    is_active INTEGER NOT NULL DEFAULT 1,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    status TEXT NOT NULL DEFAULT 'pending',
    invited_by TEXT NOT NULL,
    accepted_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    accepted_at TEXT NOT NULL DEFAULT ''
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
    emotion TEXT NOT NULL DEFAULT '中性陈述',
    risk INTEGER NOT NULL DEFAULT 20,
    impact INTEGER NOT NULL DEFAULT 50,
    summary TEXT NOT NULL DEFAULT '',
    cluster_key TEXT NOT NULL,
    parent_url TEXT NOT NULL DEFAULT '',
    relation TEXT NOT NULL DEFAULT '',
    engagement INTEGER NOT NULL DEFAULT 0,
    excerpt TEXT NOT NULL DEFAULT '',
    translation_en TEXT NOT NULL DEFAULT '',
    translation_status TEXT NOT NULL DEFAULT 'pending',
    translation_provider TEXT NOT NULL DEFAULT '',
    translation_source_hash TEXT NOT NULL DEFAULT '',
    translation_error TEXT NOT NULL DEFAULT '',
    translation_attempts INTEGER NOT NULL DEFAULT 0,
    translation_next_retry_at TEXT NOT NULL DEFAULT '',
    translated_at TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    discovered_via TEXT NOT NULL DEFAULT 'global_discovery',
    capture_status TEXT NOT NULL DEFAULT '',
    capture_error TEXT NOT NULL DEFAULT '',
    capture_updated_at TEXT NOT NULL DEFAULT '',
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
  `CREATE TABLE IF NOT EXISTS search_demand_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    signal_date TEXT NOT NULL,
    clicks INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    ctr_micros INTEGER NOT NULL DEFAULT 0,
    position_millis INTEGER NOT NULL DEFAULT 0,
    complete INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'gsc',
    collected_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id, signal_date)
  )`,
  `CREATE TABLE IF NOT EXISTS search_event_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    event_key TEXT NOT NULL,
    peak_date TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    peak_clicks INTEGER NOT NULL DEFAULT 0,
    peak_impressions INTEGER NOT NULL DEFAULT 0,
    baseline_clicks INTEGER NOT NULL DEFAULT 0,
    spike_ratio INTEGER NOT NULL DEFAULT 0,
    trigger_source TEXT NOT NULL DEFAULT 'gsc',
    status TEXT NOT NULL DEFAULT 'confirmed',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id, event_key)
  )`,
  `CREATE TABLE IF NOT EXISTS event_origins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL DEFAULT 0,
    event_key TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'X',
    source TEXT NOT NULL,
    source_country TEXT NOT NULL DEFAULT '全球',
    published_at TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id, url)
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
  `CREATE TABLE IF NOT EXISTS collection_diagnostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    sync_run_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    providers TEXT NOT NULL DEFAULT '',
    query_count INTEGER NOT NULL DEFAULT 0,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    relevant_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    filtered_count INTEGER NOT NULL DEFAULT 0,
    invalid_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    filter_reasons TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'complete',
    error TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_locks (
    name TEXT PRIMARY KEY,
    locked_until TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_pipeline_jobs (
    id TEXT PRIMARY KEY,
    brand_id INTEGER NOT NULL,
    owner_user_id TEXT NOT NULL,
    task_type TEXT NOT NULL DEFAULT 'main',
    force INTEGER NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'maintenance',
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at TEXT NOT NULL DEFAULT '',
    lease_until TEXT NOT NULL DEFAULT '',
    last_error TEXT NOT NULL DEFAULT '',
    result_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT NOT NULL DEFAULT ''
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
  `CREATE TABLE IF NOT EXISTS provider_daily_usage (
    credential_owner_user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    usage_date TEXT NOT NULL,
    units_used INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (credential_owner_user_id, provider, usage_date)
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
    mention_id INTEGER NOT NULL DEFAULT 0,
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
    platform TEXT NOT NULL DEFAULT '网页新闻',
    source_comment_id TEXT NOT NULL,
    parent_comment_id TEXT NOT NULL DEFAULT '',
    author_id TEXT NOT NULL DEFAULT '',
    author_username TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL DEFAULT '',
    is_verified INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    translation_en TEXT NOT NULL DEFAULT '',
    translation_status TEXT NOT NULL DEFAULT 'pending',
    translation_provider TEXT NOT NULL DEFAULT '',
    translation_source_hash TEXT NOT NULL DEFAULT '',
    translation_error TEXT NOT NULL DEFAULT '',
    translation_attempts INTEGER NOT NULL DEFAULT 0,
    translation_next_retry_at TEXT NOT NULL DEFAULT '',
    translated_at TEXT NOT NULL DEFAULT '',
    sentiment TEXT NOT NULL,
    emotion TEXT NOT NULL DEFAULT '中性陈述',
    sentiment_score INTEGER NOT NULL DEFAULT 0,
    language TEXT NOT NULL DEFAULT '语言待确认',
    topic TEXT NOT NULL DEFAULT '其他讨论',
    keywords TEXT NOT NULL DEFAULT '[]',
    likes INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    comment_url TEXT NOT NULL DEFAULT '',
    fetched_via TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL DEFAULT '',
    collected_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS comment_annotations (
    comment_id INTEGER PRIMARY KEY,
    brand_id INTEGER NOT NULL,
    workspace_id INTEGER NOT NULL DEFAULT 0,
    mention_id INTEGER NOT NULL,
    annotator_user_id TEXT NOT NULL,
    model_sentiment TEXT NOT NULL,
    model_emotion TEXT NOT NULL,
    model_topic TEXT NOT NULL,
    model_score INTEGER NOT NULL DEFAULT 0,
    manual_sentiment TEXT NOT NULL,
    manual_emotion TEXT NOT NULL,
    manual_topic TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sentiment_calibration_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    emotion TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 0,
    sample_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS social_comment_targets (
    mention_id INTEGER PRIMARY KEY,
    brand_id INTEGER NOT NULL,
    platform TEXT NOT NULL DEFAULT 'Instagram',
    media_id TEXT NOT NULL,
    post_url TEXT NOT NULL,
    reported_count INTEGER NOT NULL DEFAULT 0,
    collected_count INTEGER NOT NULL DEFAULT 0,
    cursor TEXT NOT NULL DEFAULT '',
    adapter TEXT NOT NULL DEFAULT 'v2',
    v2_failures INTEGER NOT NULL DEFAULT 0,
    v1_failures INTEGER NOT NULL DEFAULT 0,
    top_level_complete INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued',
    pages_fetched INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    manual_requested INTEGER NOT NULL DEFAULT 0,
    metadata_requested INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS social_comment_reply_queue (
    mention_id INTEGER NOT NULL,
    brand_id INTEGER NOT NULL,
    media_id TEXT NOT NULL,
    parent_comment_id TEXT NOT NULL,
    reported_count INTEGER NOT NULL DEFAULT 0,
    collected_count INTEGER NOT NULL DEFAULT 0,
    cursor TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    pages_fetched INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mention_id, parent_comment_id)
  )`,
  `CREATE TABLE IF NOT EXISTS llm_analysis_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    source_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    model TEXT NOT NULL,
    trigger_reason TEXT NOT NULL DEFAULT '',
    result_json TEXT NOT NULL DEFAULT '',
    confidence INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    next_retry_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT NOT NULL DEFAULT '',
    UNIQUE (brand_id, kind, target_id)
  )`,
] as const;

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_active ON brand_profiles(user_id, active)",
  "CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id)",
  "CREATE INDEX IF NOT EXISTS idx_workspace_members_user_active ON workspace_members(user_id, status, is_active)",
  "CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON workspace_members(email, status)",
  "CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_status ON workspace_invites(email, status, expires_at)",
  "CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status ON workspace_invites(workspace_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_brand_published ON mentions(brand_id, published_at)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_brand_country_platform ON mentions(brand_id, source_country, platform)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_brand_cluster ON mentions(brand_id, cluster_key)",
  "CREATE INDEX IF NOT EXISTS idx_mentions_brand_translation ON mentions(brand_id, translation_status)",
  "CREATE INDEX IF NOT EXISTS idx_alerts_brand_ack_severity ON alerts(brand_id, acknowledged, severity)",
  "CREATE INDEX IF NOT EXISTS idx_traffic_brand_country_recorded ON traffic_signals(brand_id, country, recorded_at)",
  "CREATE INDEX IF NOT EXISTS idx_search_demand_brand_date ON search_demand_signals(brand_id, signal_date)",
  "CREATE INDEX IF NOT EXISTS idx_search_events_brand_peak ON search_event_windows(brand_id, peak_date)",
  "CREATE INDEX IF NOT EXISTS idx_event_origins_brand_event ON event_origins(brand_id, event_key, active)",
  "CREATE INDEX IF NOT EXISTS idx_sync_runs_brand_started ON sync_runs(brand_id, started_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_diagnostics_run_platform ON collection_diagnostics(sync_run_id, platform)",
  "CREATE INDEX IF NOT EXISTS idx_collection_diagnostics_brand_completed ON collection_diagnostics(brand_id, completed_at)",
  "CREATE INDEX IF NOT EXISTS idx_sync_pipeline_brand_task_status_retry ON sync_pipeline_jobs(brand_id, task_type, status, next_retry_at)",
  "CREATE INDEX IF NOT EXISTS idx_sync_pipeline_status_lease ON sync_pipeline_jobs(status, lease_until)",
  "CREATE INDEX IF NOT EXISTS idx_provider_daily_usage_date ON provider_daily_usage(usage_date, provider)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_media_sources_brand_domain ON media_sources(brand_id, domain)",
  "CREATE INDEX IF NOT EXISTS idx_media_sources_brand_next_crawl ON media_sources(brand_id, status, next_crawl_at)",
  "CREATE INDEX IF NOT EXISTS idx_media_sources_brand_country ON media_sources(brand_id, country)",
  "CREATE INDEX IF NOT EXISTS idx_propagation_edges_brand_cluster ON propagation_edges(brand_id, cluster_key)",
  "CREATE INDEX IF NOT EXISTS idx_propagation_edges_to_mention ON propagation_edges(to_mention_id)",
  "CREATE INDEX IF NOT EXISTS idx_tracked_entities_brand ON tracked_entities(brand_id, active)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_monid_jobs_run_id ON monid_jobs(run_id)",
  "CREATE INDEX IF NOT EXISTS idx_monid_jobs_brand_status ON monid_jobs(brand_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_monid_jobs_mention_stage ON monid_jobs(mention_id, stage, status)",
  "CREATE INDEX IF NOT EXISTS idx_social_metrics_brand_platform ON social_post_metrics(brand_id, platform)",
  "CREATE INDEX IF NOT EXISTS idx_social_metrics_author ON social_post_metrics(brand_id, author_username)",
  "CREATE INDEX IF NOT EXISTS idx_social_authors_brand_user_time ON social_author_snapshots(brand_id, username, captured_at)",
  "CREATE INDEX IF NOT EXISTS idx_comment_analyses_brand_collected ON comment_analyses(brand_id, last_collected_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_mention_comments_source ON mention_comments(mention_id, source_comment_id)",
  "CREATE INDEX IF NOT EXISTS idx_mention_comments_brand_mention ON mention_comments(brand_id, mention_id)",
  "CREATE INDEX IF NOT EXISTS idx_mention_comments_brand_platform_time ON mention_comments(brand_id, platform, published_at)",
  "CREATE INDEX IF NOT EXISTS idx_mention_comments_brand_sentiment ON mention_comments(brand_id, sentiment, sentiment_score)",
  "CREATE INDEX IF NOT EXISTS idx_mention_comments_brand_translation ON mention_comments(brand_id, translation_status)",
  "CREATE INDEX IF NOT EXISTS idx_comment_annotations_brand_updated ON comment_annotations(brand_id, updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_comment_annotations_workspace ON comment_annotations(workspace_id, brand_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_sentiment_calibration_brand_token ON sentiment_calibration_rules(brand_id, token)",
  "CREATE INDEX IF NOT EXISTS idx_sentiment_calibration_brand_weight ON sentiment_calibration_rules(brand_id, weight)",
  "CREATE INDEX IF NOT EXISTS idx_social_comment_targets_brand_status ON social_comment_targets(brand_id, status, updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_social_comment_replies_brand_status ON social_comment_reply_queue(brand_id, status, updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_llm_analysis_jobs_brand_status ON llm_analysis_jobs(brand_id, kind, status, updated_at)",
] as const;

export async function ensureDatabase() {
  const db = env.DB;
  await db.batch([...tables, ...indexes].map((statement) => db.prepare(statement)));
  const columns = [
    "ALTER TABLE brand_profiles ADD COLUMN match_mode TEXT NOT NULL DEFAULT 'precise'",
    "ALTER TABLE brand_profiles ADD COLUMN scope_terms TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE brand_profiles ADD COLUMN exclude_terms TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE brand_profiles ADD COLUMN official_accounts TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE brand_profiles ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE mentions ADD COLUMN emotion TEXT NOT NULL DEFAULT '中性陈述'",
    "ALTER TABLE mentions ADD COLUMN translation_en TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN translation_status TEXT NOT NULL DEFAULT 'pending'",
    "ALTER TABLE mentions ADD COLUMN translation_provider TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN translation_source_hash TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN translation_error TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN translation_attempts INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE mentions ADD COLUMN translation_next_retry_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN translated_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN capture_status TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN capture_error TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mentions ADD COLUMN capture_updated_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mention_comments ADD COLUMN emotion TEXT NOT NULL DEFAULT '中性陈述'",
    "ALTER TABLE mention_comments ADD COLUMN translation_en TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mention_comments ADD COLUMN translation_status TEXT NOT NULL DEFAULT 'pending'",
    "ALTER TABLE mention_comments ADD COLUMN translation_provider TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mention_comments ADD COLUMN translation_source_hash TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mention_comments ADD COLUMN translation_error TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mention_comments ADD COLUMN translation_attempts INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE mention_comments ADD COLUMN translation_next_retry_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE mention_comments ADD COLUMN translated_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE social_comment_reply_queue ADD COLUMN adapter TEXT NOT NULL DEFAULT 'v2'",
    "ALTER TABLE social_comment_reply_queue ADD COLUMN v2_failures INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE social_comment_reply_queue ADD COLUMN v1_failures INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE social_comment_targets ADD COLUMN adapter TEXT NOT NULL DEFAULT 'v2'",
    "ALTER TABLE social_comment_targets ADD COLUMN v2_failures INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE social_comment_targets ADD COLUMN v1_failures INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE social_comment_targets ADD COLUMN manual_requested INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE social_comment_targets ADD COLUMN metadata_requested INTEGER NOT NULL DEFAULT 0",
  ];
  for (const statement of columns) {
    try { await db.prepare(statement).run(); } catch { /* Existing deployment already has the column. */ }
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_brand_profiles_workspace_active ON brand_profiles(workspace_id, active)").run();
  await db.batch([
    db.prepare(`UPDATE mentions SET source_country = '中国大陆',
      content_country = CASE WHEN content_country = '中国' THEN '中国大陆' ELSE content_country END
      WHERE source_country = '中国'`),
    db.prepare(`UPDATE media_sources SET country = '中国大陆' WHERE country = '中国'`),
    db.prepare(`UPDATE mentions SET source_country = '中国大陆', content_country = '中国大陆', location_confidence = 99,
      location_method = '媒体域名 / 已知媒体库'
      WHERE (lower(url) LIKE '%://%.163.com/%' OR lower(url) LIKE '%://163.com/%' OR source LIKE '%网易%' OR source LIKE '%網易%')
        AND source_country IN ('地区未披露', '地区待确认', '华语地区')`),
    db.prepare(`UPDATE media_sources SET country = '中国大陆'
      WHERE (lower(domain) = '163.com' OR lower(domain) LIKE '%.163.com' OR name LIKE '%网易%' OR name LIKE '%網易%')
        AND country IN ('地区未披露', '地区待确认', '华语地区')`),
    db.prepare(`UPDATE mentions SET source_country = '俄罗斯',
      content_country = CASE WHEN lower(content_country) IN ('russia', 'russian federation', 'ru') THEN '俄罗斯' ELSE content_country END
      WHERE lower(source_country) IN ('russia', 'russian federation', 'ru')`),
    db.prepare(`UPDATE media_sources SET country = '俄罗斯' WHERE lower(country) IN ('russia', 'russian federation', 'ru')`),
  ]);
}

export async function getActiveBrandForUser(db: D1Database, userId: string) {
  if (!userId) return null;
  const shared = await db.prepare(`SELECT brand_profiles.* FROM workspace_members
    JOIN brand_profiles ON brand_profiles.workspace_id = workspace_members.workspace_id
    WHERE workspace_members.user_id = ? AND workspace_members.status = 'active' AND workspace_members.is_active = 1
      AND brand_profiles.active = 1 ORDER BY brand_profiles.id DESC LIMIT 1`)
    .bind(userId).first<Record<string, unknown>>();
  if (shared) return shared;
  return db.prepare("SELECT * FROM brand_profiles WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1")
    .bind(userId).first<Record<string, unknown>>();
}

export async function getWorkspaceAccessForUser(db: D1Database, userId: string) {
  if (!userId) return null;
  return db.prepare(`SELECT workspaces.*, workspace_members.role, workspace_members.email,
      workspace_members.display_name, workspace_members.joined_at
    FROM workspace_members JOIN workspaces ON workspaces.id = workspace_members.workspace_id
    WHERE workspace_members.user_id = ? AND workspace_members.status = 'active' AND workspace_members.is_active = 1
    ORDER BY workspace_members.joined_at DESC LIMIT 1`).bind(userId).first<Record<string, unknown>>();
}

function profileTerms(value: unknown) {
  return String(value ?? "").split(/[\n,，]/).map((item) => item.trim().normalize("NFKC").toLocaleLowerCase()).filter(Boolean);
}

function mentionContainsExcludedTerm(row: Record<string, unknown>, exclusions: string[]) {
  if (!exclusions.length) return false;
  const searchable = [row.title, row.excerpt, row.summary, row.source, row.author, row.url, row.keywords,
    row.social_author_username, row.social_author_name].map((value) => String(value ?? "")).join(" ").normalize("NFKC").toLocaleLowerCase();
  return exclusions.some((term) => searchable.includes(term));
}

export async function loadDashboardData(userId = "") {
  await ensureDatabase();
  const db = env.DB;
  const workspace = await getWorkspaceAccessForUser(db, userId);
  const brand = await getActiveBrandForUser(db, userId);
  const brandId = Number(brand?.id ?? -1);
  const workspaceId = Number(workspace?.id ?? brand?.workspace_id ?? 0);
  const credentialOwnerId = String(workspace?.credential_owner_user_id ?? userId);
  const healthPrefix = `${brandId}:%`;
  const [mentions, traffic, entities, alerts, syncRuns, collectionDiagnostics, providerHealth, mediaSources, propagationEdges, credentialRows, monidJobs, monidQueueStats, llmStats, llmBriefRow, syncPipeline, redditSyncPipeline, searchDemandSignals, searchEventWindows, eventOrigins] = await Promise.all([
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
    db.prepare("SELECT * FROM collection_diagnostics WHERE brand_id = ? ORDER BY completed_at DESC, id ASC LIMIT 60").bind(brandId).all(),
    db.prepare("SELECT * FROM provider_health WHERE provider LIKE ? ORDER BY provider").bind(healthPrefix).all<{ provider: string; status: string; retry_after: string; last_error: string; last_success_at: string }>(),
    db.prepare("SELECT * FROM media_sources WHERE brand_id = ? ORDER BY last_crawled_at DESC, id DESC").bind(brandId).all(),
    db.prepare("SELECT * FROM propagation_edges WHERE brand_id = ? ORDER BY cluster_key, time_gap_minutes ASC").bind(brandId).all(),
    db.prepare("SELECT provider, last_four, status, last_test_at, updated_at FROM connector_credentials WHERE user_id = ? ORDER BY provider")
      .bind(credentialOwnerId).all<{ provider: string; last_four: string; status: string; last_test_at: string; updated_at: string }>(),
    db.prepare("SELECT stage, status, cost, error, started_at, completed_at FROM monid_jobs WHERE brand_id = ? ORDER BY id DESC LIMIT 6")
      .bind(brandId).all<{ stage: string; status: string; cost: number; error: string; started_at: string; completed_at: string }>(),
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM monid_jobs WHERE brand_id = ? AND status IN ('CREATED','QUEUED','PENDING','READY','RUNNING')) +
      (SELECT COUNT(*) FROM social_comment_targets WHERE brand_id = ? AND (manual_requested = 1 OR metadata_requested = 1)
        AND status IN ('queued','running','collecting','retrying')) +
      (SELECT COUNT(*) FROM social_comment_reply_queue reply JOIN social_comment_targets target ON target.mention_id = reply.mention_id
        WHERE reply.brand_id = ? AND target.manual_requested = 1 AND reply.status IN ('queued','running','retrying')) AS count,
      (SELECT COUNT(*) FROM social_comment_targets WHERE brand_id = ? AND (manual_requested = 1 OR metadata_requested = 1)
        AND status IN ('queued','running','collecting')) +
      (SELECT COUNT(*) FROM social_comment_reply_queue reply JOIN social_comment_targets target ON target.mention_id = reply.mention_id
        WHERE reply.brand_id = ? AND target.manual_requested = 1 AND reply.status IN ('queued','running')) AS active_count,
      (SELECT MIN(retry_at) FROM (
        SELECT datetime(updated_at, '+30 minutes') AS retry_at FROM social_comment_targets WHERE brand_id = ?
          AND (manual_requested = 1 OR metadata_requested = 1) AND status = 'retrying'
        UNION ALL SELECT datetime(reply.updated_at, '+30 minutes') FROM social_comment_reply_queue reply
          JOIN social_comment_targets target ON target.mention_id = reply.mention_id
          WHERE reply.brand_id = ? AND target.manual_requested = 1 AND reply.status = 'retrying'
      )) AS next_retry_at`)
      .bind(brandId, brandId, brandId, brandId, brandId, brandId, brandId).first<{ count: number; active_count: number; next_retry_at: string }>(),
    db.prepare(`SELECT
      SUM(CASE WHEN kind IN ('mention','comment') AND status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN kind IN ('mention','comment') AND status IN ('queued','running') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN kind IN ('mention','comment') AND status = 'error' THEN 1 ELSE 0 END) AS errors
      FROM llm_analysis_jobs WHERE brand_id = ?`).bind(brandId).first<{ completed: number; pending: number; errors: number }>(),
    db.prepare(`SELECT result_json, model, completed_at FROM llm_analysis_jobs
      WHERE brand_id = ? AND kind = 'report' AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`)
      .bind(brandId).first<{ result_json: string; model: string; completed_at: string }>(),
    db.prepare(`SELECT id, task_type, stage, status, attempts, max_attempts, next_retry_at, last_error, created_at, updated_at, completed_at
      FROM sync_pipeline_jobs WHERE brand_id = ? AND task_type = 'main' ORDER BY created_at DESC LIMIT 1`).bind(brandId).first<Record<string, unknown>>(),
    db.prepare(`SELECT id, task_type, stage, status, attempts, max_attempts, next_retry_at, last_error, created_at, updated_at, completed_at
      FROM sync_pipeline_jobs WHERE brand_id = ? AND task_type = 'reddit' ORDER BY created_at DESC LIMIT 1`).bind(brandId).first<Record<string, unknown>>(),
    db.prepare(`SELECT signal_date, clicks, impressions, ctr_micros, position_millis, complete, source, collected_at
      FROM search_demand_signals WHERE brand_id = ? ORDER BY signal_date ASC LIMIT 180`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT id, event_key, peak_date, start_date, end_date, peak_clicks, peak_impressions, baseline_clicks,
      spike_ratio, trigger_source, status, updated_at FROM search_event_windows WHERE brand_id = ? AND status IN ('active', 'confirmed')
      ORDER BY peak_date DESC LIMIT 50`).bind(brandId).all<Record<string, unknown>>(),
    db.prepare(`SELECT id, event_key, title, url, platform, source, source_country, published_at, note, active
      FROM event_origins WHERE brand_id = ? AND active = 1 ORDER BY published_at ASC`).bind(brandId).all<Record<string, unknown>>(),
  ]);
  const healthByName = new Map(providerHealth.results.map((item) => [item.provider.replace(/^\d+:/, ""), item]));
  const gdeltHealth = healthByName.get("GDELT");
  const gdeltLimited = Boolean(gdeltHealth?.status === "limited" && gdeltHealth.retry_after && new Date(gdeltHealth.retry_after).getTime() > Date.now());
  const eventRegistryHealth = healthByName.get("NewsAPI.ai");
  const eventRegistryLimited = Boolean(eventRegistryHealth?.retry_after && new Date(eventRegistryHealth.retry_after).getTime() > Date.now());
  const storedCredentials = new Map(credentialRows.results.map((item) => [item.provider, item]));
  const newsApiConfigured = Boolean(env.NEWSAPI_AI_KEY || storedCredentials.has("NewsAPI.ai"));
  const mediaCloudConfigured = Boolean(env.MEDIACLOUD_API_KEY || storedCredentials.has("Media Cloud"));
  const newsDataConfigured = Boolean(env.NEWSDATA_API_KEY || storedCredentials.has("NewsData.io"));
  const worldNewsConfigured = Boolean(env.WORLD_NEWS_API_KEY || storedCredentials.has("World News API"));
  const scrapeCreatorsConfigured = Boolean(env.SCRAPECREATORS_API_KEY || storedCredentials.has("ScrapeCreators"));
  const braveSearchConfigured = Boolean(env.BRAVE_SEARCH_API_KEY || storedCredentials.has("Brave Search"));
  const apifyConfigured = Boolean(env.APIFY_API_TOKEN || storedCredentials.has("Apify"));
  const brightDataConfigured = Boolean(env.BRIGHTDATA_API_KEY || storedCredentials.has("Bright Data"));
  const theNewsApiConfigured = Boolean(env.THE_NEWS_API_KEY || storedCredentials.has("The News API"));
  const gnewsConfigured = Boolean(env.GNEWS_API_KEY || storedCredentials.has("GNews"));
  const newsApiOrgConfigured = Boolean(env.NEWSAPI_ORG_KEY || storedCredentials.has("NewsAPI.org"));
  const mediastackConfigured = Boolean(env.MEDIASTACK_API_KEY || storedCredentials.has("mediastack"));
  const guardianConfigured = Boolean(env.GUARDIAN_API_KEY || storedCredentials.has("Guardian Open Platform"));
  const tumblrConfigured = Boolean(env.TUMBLR_API_KEY || storedCredentials.has("Tumblr Tagged"));
  const mastodonConfigured = Boolean(env.MASTODON_INSTANCE || storedCredentials.has("Mastodon"));
  const searchConsoleConfigured = Boolean(env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS || storedCredentials.has("Google Search Console"));
  const monidConfigured = Boolean(env.MONID_API_KEY || storedCredentials.has("Monid / Instagram"));
  const xConfigured = Boolean(env.X_BEARER_TOKEN || storedCredentials.has("X"));
  const youtubeConfigured = Boolean(env.YOUTUBE_API_KEY || storedCredentials.has("YouTube"));
  const metaConfigured = storedCredentials.has("Meta / Instagram");
  const tiktokConfigured = storedCredentials.has("TikTok");
  const azureTranslatorConfigured = Boolean(env.AZURE_TRANSLATOR_KEY || storedCredentials.has("Azure Translator"));
  const deepLConfigured = Boolean(env.DEEPL_API_KEY || storedCredentials.has("DeepL API Free"));
  const libreTranslateConfigured = Boolean(env.LIBRETRANSLATE_URL || storedCredentials.has("LibreTranslate"));
  const myMemoryIdentified = Boolean(env.TRANSLATION_CONTACT_EMAIL || storedCredentials.has("MyMemory"));
  const llmConfigured = Boolean(env.OPENAI_API_KEY || storedCredentials.has("OpenAI LLM"));
  const llmHealth = healthByName.get("OpenAI LLM");
  const llmLimited = Boolean(llmHealth?.retry_after && new Date(llmHealth.retry_after).getTime() > Date.now());
  const newsQuotaSnapshots = await getNewsProviderQuotaSnapshots(db, credentialOwnerId);
  const newsQuotaByProvider = new Map(newsQuotaSnapshots.map((item) => [item.provider, item]));
  const monidHealth = healthByName.get("Monid / Instagram");
  const monidPlatforms = ["Instagram", "X", "YouTube", "TikTok", "Facebook", "Reddit"] as const;
  const monidPlatformHealth = new Map(monidPlatforms.map((platform) => [platform, healthByName.get(`Monid / ${platform}`)]));
  const limitedPlatformHealth = [...monidPlatformHealth.values()].filter((item) => item?.retry_after && new Date(item.retry_after).getTime() > Date.now());
  const monidLimited = limitedPlatformHealth.length > 0;
  const monidPending = Number(monidQueueStats?.count ?? monidJobs.results.filter((item) => ["CREATED", "QUEUED", "PENDING", "READY", "RUNNING"].includes(item.status)).length);
  const monidActive = Number(monidQueueStats?.active_count ?? 0);
  const monidRetryAt = limitedPlatformHealth.map((item) => item?.retry_after ?? "").filter(Boolean).sort()[0]
    || (!monidActive ? monidQueueStats?.next_retry_at ?? "" : "");
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
  const entityRows = entities.results as Array<Record<string, unknown>>;
  const exclusions = [...new Set([
    ...profileTerms(brand?.exclude_terms),
    ...entityRows.filter((item) => String(item.type) === "排除词" && Number(item.active ?? 1) === 1).flatMap((item) => profileTerms(item.value)),
  ])];
  const officialHandles = officialAccountHandles(brand?.official_accounts);
  const mentionRows = (mentions.results as Array<Record<string, unknown>>).filter((row) =>
    !mentionContainsExcludedTerm(row, exclusions) && !isUnattributedSyntheticSocialPost({
      platform: row.platform,
      provider: row.provider,
      source: row.source,
      author: row.author,
      url: row.url,
      socialMetrics: { authorId: row.social_author_id, authorUsername: row.social_author_username, authorName: row.social_author_name },
    }) && !comesFromOfficialAccount({
      platform: row.platform,
      provider: row.provider,
      source: row.source,
      author: row.author,
      url: row.url,
      socialMetrics: { authorId: row.social_author_id, authorUsername: row.social_author_username, authorName: row.social_author_name },
    }, officialHandles, [brand?.name]));
  const visibleMentionIds = new Set(mentionRows.map((row) => Number(row.id)));
  const visiblePropagationEdges = (propagationEdges.results as Array<Record<string, unknown>>).filter((edge) =>
    visibleMentionIds.has(Number(edge.from_mention_id)) && visibleMentionIds.has(Number(edge.to_mention_id)));
  const countryMap = new Map<string, { country: string; count: number; positive: number; neutral: number; negative: number; risk: number; engagement: number; latest: string }>();
  const sentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  const emotionMap = new Map<string, number>();
  const timelineMap = new Map<string, { date: string; total: number; positive: number; negative: number }>();
  const wordMap = new Map<string, number>();
  const commentWordMap = new Map<string, number>();
  const commentSentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  let commentsAnalyzed = 0;
  const sourceMap = new Map<string, { source: string; country: string; count: number; impact: number }>();
  const tracked = entityRows.map((item) => String(item.value ?? "").toLowerCase());
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
    const emotion = String(row.emotion ?? "中性陈述");
    emotionMap.set(emotion, (emotionMap.get(emotion) ?? 0) + 1);
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
    const text = `${String(row.title ?? "")} ${String(row.excerpt ?? "")} ${String(row.keywords ?? "")}`;
    for (const token of meaningfulTokens(text, tracked)) wordMap.set(token, (wordMap.get(token) ?? 0) + 1);
    commentsAnalyzed += Number(row.comment_analyzed_count ?? 0);
    commentSentiment.positive += Number(row.comment_positive_count ?? 0);
    commentSentiment.neutral += Number(row.comment_neutral_count ?? 0);
    commentSentiment.negative += Number(row.comment_negative_count ?? 0);
    commentSentiment.mixed += Number(row.comment_mixed_count ?? 0);
    try {
      const commentKeywords = JSON.parse(String(row.comment_keywords ?? "[]")) as Array<{ word?: string; count?: number }>;
      const cleanedRowKeywords = new Map<string, number>();
      for (const keyword of commentKeywords) {
        const word = String(keyword.word ?? "").trim();
        const count = Number(keyword.count ?? 0);
        if (!word || count <= 0) continue;
        for (const token of meaningfulTokens(word, tracked)) {
          cleanedRowKeywords.set(token, (cleanedRowKeywords.get(token) ?? 0) + count);
          commentWordMap.set(token, (commentWordMap.get(token) ?? 0) + count);
        }
      }
      row.comment_keywords = JSON.stringify([...cleanedRowKeywords.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 35));
    } catch { /* Older rows may not contain JSON yet. */ }
  }
  const sourceRows = mediaSources.results as Array<Record<string, unknown>>;
  const crawlerOnline = sourceRows.some((item) => item.status === "active" || item.status === "discovered" || item.status === "watching");
  const [workspaceMembers, workspaceInvites] = workspaceId ? await Promise.all([
    db.prepare(`SELECT user_id, email, display_name, role, status, joined_at, last_seen_at
      FROM workspace_members WHERE workspace_id = ? AND status = 'active'
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END, joined_at ASC`)
      .bind(workspaceId).all<Record<string, unknown>>(),
    db.prepare(`SELECT id, email, role, status, created_at, expires_at FROM workspace_invites
      WHERE workspace_id = ? AND status = 'pending' AND datetime(expires_at) > datetime('now') ORDER BY created_at DESC`)
      .bind(workspaceId).all<Record<string, unknown>>(),
  ]) : [{ results: [] }, { results: [] }];
  const role = String(workspace?.role ?? "owner");
  let aiBrief: Record<string, unknown> | null = null;
  if (llmBriefRow?.result_json) {
    try { aiBrief = JSON.parse(llmBriefRow.result_json) as Record<string, unknown>; } catch { aiBrief = null; }
  }
  return {
    mentions: mentionRows,
    traffic: traffic.results,
    entities: entities.results,
    alerts: alerts.results,
    syncRuns: syncRuns.results,
    collectionDiagnostics: collectionDiagnostics.results,
    searchDemandSignals: searchDemandSignals.results,
    searchEvents: searchEventWindows.results.map((event) => ({
      ...event,
      origin: eventOrigins.results.find((origin) => String(origin.event_key) === String(event.event_key)) ?? null,
    })),
    syncPipeline: syncPipeline ?? null,
    redditSyncPipeline: redditSyncPipeline ?? null,
    brand,
    providerHealth: providerHealth.results.map((item) => ({ ...item, provider: item.provider.replace(/^\d+:/, "") })),
    mediaSources: sourceRows,
    propagationEdges: visiblePropagationEdges,
    aiBrief,
    connectorCredentials: credentialRows.results,
    newsProviderQuotas: newsQuotaSnapshots,
    workspace: workspace ? {
      id: workspaceId,
      name: String(workspace.name ?? `${String(brand?.name ?? "品牌")}团队工作区`),
      role,
      canManage: role === "owner" || role === "admin",
      canEdit: role !== "viewer",
      members: workspaceMembers.results,
      invites: role === "owner" || role === "admin" ? workspaceInvites.results : [],
    } : null,
    analytics: {
      countries: [...countryMap.values()].sort((a, b) => b.count - a.count),
      sentiment,
      emotions: [...emotionMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      timeline: [...timelineMap.values()].filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      words: [...wordMap.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 45),
      commentWords: [...commentWordMap.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 45),
      commentSentiment,
      commentsAnalyzed,
      sources: [...sourceMap.values()].sort((a, b) => b.count - a.count || b.impact - a.impact).slice(0, 12),
      crossBorderEdges: visiblePropagationEdges.filter((item) => Number(item.cross_border) === 1).length,
      archivedTotal: mentionRows.length,
    },
    connectors: [
      { id: "google-search-console", provider: "Google Search Console", configurable: true, configured: searchConsoleConfigured,
        lastFour: storedCredentials.get("Google Search Console")?.last_four ?? (env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS ? "环境密钥" : ""),
        name: "Google Search Console 搜索需求", status: searchConsoleConfigured ? "online" : "credentials",
        detail: searchConsoleConfigured ? `${searchEventWindows.results.length} 个搜索攀升事件 · 每 6 小时更新点击与曝光曲线`
          : "连接官网 Search Console；搜索需求明显持续攀升时建立事件窗口" },
      { id: "news", provider: "NewsAPI.ai", configurable: true, configured: newsApiConfigured, lastFour: storedCredentials.get("NewsAPI.ai")?.last_four ?? (env.NEWSAPI_AI_KEY ? "环境密钥" : ""), name: "全球发现引擎", status: newsLimited ? "limited" : "online", detail: newsDetail, retryAt,
        quotaUsed: newsQuotaByProvider.get("NewsAPI.ai")?.used ?? 0, quotaLimit: newsQuotaByProvider.get("NewsAPI.ai")?.limit ?? 48,
        quotaRemaining: newsQuotaByProvider.get("NewsAPI.ai")?.remaining ?? 48, quotaResetAt: newsQuotaByProvider.get("NewsAPI.ai")?.resetAt ?? "",
        scheduleLabel: newsQuotaByProvider.get("NewsAPI.ai")?.scheduleLabel ?? "每 6 小时" },
      ...[
        { id: "mediacloud", provider: "Media Cloud", configured: mediaCloudConfigured, envConfigured: Boolean(env.MEDIACLOUD_API_KEY), name: "Media Cloud 全球新闻库" },
        { id: "newsdata", provider: "NewsData.io", configured: newsDataConfigured, envConfigured: Boolean(env.NEWSDATA_API_KEY), name: "NewsData.io 多语言发现" },
        { id: "worldnews", provider: "World News API", configured: worldNewsConfigured, envConfigured: Boolean(env.WORLD_NEWS_API_KEY), name: "World News API 全球补全" },
        { id: "scrapecreators", provider: "ScrapeCreators", configured: scrapeCreatorsConfigured, envConfigured: Boolean(env.SCRAPECREATORS_API_KEY), name: "ScrapeCreators 平台关键词发现" },
        { id: "brave-search", provider: "Brave Search", configured: braveSearchConfigured, envConfigured: Boolean(env.BRAVE_SEARCH_API_KEY), name: "Brave 社交网页补漏" },
        { id: "apify", provider: "Apify", configured: apifyConfigured, envConfigured: Boolean(env.APIFY_API_TOKEN), name: "Apify Google 索引补全" },
        { id: "bright-data", provider: "Bright Data", configured: brightDataConfigured, envConfigured: Boolean(env.BRIGHTDATA_API_KEY), name: "Bright Data SERP 补全" },
        { id: "the-news-api", provider: "The News API", configured: theNewsApiConfigured, envConfigured: Boolean(env.THE_NEWS_API_KEY), name: "The News API 全球新闻补全" },
        { id: "gnews", provider: "GNews", configured: gnewsConfigured, envConfigured: Boolean(env.GNEWS_API_KEY), name: "GNews 多语言新闻搜索" },
        { id: "newsapi-org", provider: "NewsAPI.org", configured: newsApiOrgConfigured, envConfigured: Boolean(env.NEWSAPI_ORG_KEY), name: "NewsAPI.org 新闻搜索" },
        { id: "mediastack", provider: "mediastack", configured: mediastackConfigured, envConfigured: Boolean(env.MEDIASTACK_API_KEY), name: "mediastack 全球新闻补档" },
        { id: "guardian", provider: "Guardian Open Platform", configured: guardianConfigured, envConfigured: Boolean(env.GUARDIAN_API_KEY), name: "Guardian Open Platform" },
        { id: "tumblr", provider: "Tumblr Tagged", configured: tumblrConfigured, envConfigured: Boolean(env.TUMBLR_API_KEY), name: "Tumblr 多语言博客标签搜索" },
        { id: "mastodon", provider: "Mastodon", configured: mastodonConfigured, envConfigured: Boolean(env.MASTODON_INSTANCE), name: "Mastodon 联邦搜索" },
      ].map((item) => {
        const quota = newsQuotaByProvider.get(item.provider)!;
        const health = healthByName.get(item.provider);
        const limited = Boolean((health?.retry_after && new Date(health.retry_after).getTime() > Date.now()) || quota.remaining <= 0);
        return {
          id: item.id, provider: item.provider, configurable: true, configured: item.configured,
          lastFour: storedCredentials.get(item.provider)?.last_four ?? (item.envConfigured ? "环境密钥" : ""), name: item.name,
          status: (!item.configured ? "credentials" : limited ? "limited" : "online") as "credentials" | "limited" | "online",
          retryAt: quota.remaining <= 0 ? quota.resetAt : health?.retry_after ?? "",
          quotaUsed: quota.used, quotaLimit: quota.limit, quotaRemaining: quota.remaining, quotaResetAt: quota.resetAt,
          scheduleLabel: quota.scheduleLabel,
          detail: !item.configured ? `${quota.scheduleLabel}自动更新 · 配置免费 API Key 后启用`
            : `${quota.scheduleLabel}自动更新 · 今日 ${quota.used}/${quota.limit} · 剩余 ${quota.remaining} · ${quota.rationale}`,
        };
      }),
      ...[
        { provider: "Bluesky Search", id: "bluesky-public", name: "Bluesky 公开帖子搜索" },
        { provider: "Hacker News", id: "hacker-news-public", name: "Hacker News 技术社区搜索" },
        { provider: "WordPress.com Reader", id: "wordpress-reader", name: "WordPress.com 全球博客标签" },
        { provider: "DEV / Forem Blogs", id: "forem-blogs", name: "DEV / Forem 公开博客关键词搜索" },
      ].map((item) => {
        const quota = newsQuotaByProvider.get(item.provider)!;
        const health = healthByName.get(item.provider);
        const limited = Boolean((health?.retry_after && new Date(health.retry_after).getTime() > Date.now()) || quota.remaining <= 0);
        return {
          id: item.id, provider: item.provider, configurable: false, configured: true, name: item.name,
          status: (limited ? "limited" : "online") as "limited" | "online", retryAt: quota.remaining <= 0 ? quota.resetAt : health?.retry_after ?? "",
          quotaUsed: quota.used, quotaLimit: quota.limit, quotaRemaining: quota.remaining, quotaResetAt: quota.resetAt, scheduleLabel: quota.scheduleLabel,
          detail: `${quota.scheduleLabel}自动更新 · 免注册、免密钥 · 今日 ${quota.used}/${quota.limit} · ${quota.rationale}`,
        };
      }),
      { id: "common-crawl", name: "Common Crawl CC-NEWS 批量档案", status: "approval", stateLabel: "批处理待部署",
        detail: "免密钥 WARC 档案源；不适合即时关键词查询。需先配置对象存储与分阶段解析作业，当前不会计入自动巡检结果。" },
      { id: "crawler", name: "免费媒体追踪", status: crawlerOnline ? "online" : "limited", detail: `${sourceRows.length} 个媒体来源 · RSS / Atom / 新闻 Sitemap · robots.txt 合规` },
      { id: "llm-openai", provider: "OpenAI LLM", configurable: true, configured: llmConfigured,
        lastFour: storedCredentials.get("OpenAI LLM")?.last_four ?? (env.OPENAI_API_KEY ? "环境密钥" : ""), name: "混合智能分析",
        status: !llmConfigured ? "credentials" : llmLimited ? "limited" : "online",
        pending: Number(llmStats?.pending ?? 0), retryAt: llmHealth?.retry_after ?? "", lastError: llmHealth?.last_error ?? "",
        detail: !llmConfigured ? "规则模型已全量运行；配置 API Key 后启用重点语义复核与报告 Agent"
          : llmLimited ? `LLM 暂缓重试：${llmHealth?.last_error || "服务暂不可用"}`
          : `规则全量分析 · ${Number(llmStats?.completed ?? 0)} 条重点内容已复核 · 人工标注优先 · 自动生成报告结论` },
      { id: "translator-azure", provider: "Azure Translator", configurable: true, configured: azureTranslatorConfigured,
        lastFour: storedCredentials.get("Azure Translator")?.last_four ?? (env.AZURE_TRANSLATOR_KEY ? "环境密钥" : ""), name: "Azure Translator F0",
        status: azureTranslatorConfigured ? "online" : "credentials", detail: azureTranslatorConfigured ? "后台自动翻译主力 · 免费层每月 200 万字符" : "可配置 F0 免费层，适合大量后台自动翻译" },
      { id: "translator-deepl", provider: "DeepL API Free", configurable: true, configured: deepLConfigured,
        lastFour: storedCredentials.get("DeepL API Free")?.last_four ?? (env.DEEPL_API_KEY ? "环境密钥" : ""), name: "DeepL API Free",
        status: deepLConfigured ? "online" : "credentials", detail: deepLConfigured ? "高质量英文翻译备用 · 免费层每月 50 万字符" : "可作为 Azure 或自托管翻译的备用服务" },
      { id: "translator-libre", provider: "LibreTranslate", configurable: true, configured: libreTranslateConfigured,
        lastFour: storedCredentials.get("LibreTranslate")?.last_four ?? (env.LIBRETRANSLATE_URL ? "环境配置" : ""), name: "LibreTranslate 自托管",
        status: libreTranslateConfigured ? "online" : "credentials", detail: libreTranslateConfigured ? "优先使用团队自有翻译实例，不消耗第三方字符额度" : "开源自托管；服务器成本自理，应用侧不设字符额度" },
      { id: "translator-mymemory", provider: "MyMemory", configurable: true, configured: myMemoryIdentified,
        lastFour: storedCredentials.get("MyMemory")?.last_four ?? (env.TRANSLATION_CONTACT_EMAIL ? "环境配置" : ""), name: "MyMemory 免费兜底",
        status: myMemoryIdentified ? "online" : "limited", detail: myMemoryIdentified ? "已添加联系邮箱，作为最后一级免费兜底" : "匿名额度很小；建议配置联系邮箱并至少再接入一个免费层" },
      { id: "monid-vault", provider: "Monid / Instagram", configurable: true, configured: monidConfigured,
        lastFour: storedCredentials.get("Monid / Instagram")?.last_four ?? (env.MONID_API_KEY ? "环境密钥" : ""), name: "Monid 多平台公共搜索",
        status: !monidConfigured ? "credentials" : monidLimited ? "limited" : "online",
        pending: monidPending, retryAt: monidRetryAt, lastError: monidHealth?.last_error ?? "",
        detail: !monidConfigured ? "一个 Monid API Key 启用 Instagram、X、YouTube、TikTok、Facebook、Reddit 搜索；评论正文仅在人工开启后采集"
          : monidLimited ? `上次调用未完成：${monidHealth?.last_error || "等待服务恢复"}${monidHealth?.retry_after ? ` · ${new Date(monidHealth.retry_after).toLocaleString("zh-CN")} 后自动重试` : ""}`
          : monidPending ? `${monidPending} 个多平台采集步骤处理中${monidRetryAt && !monidActive ? ` · ${new Date(monidRetryAt).toLocaleString("zh-CN")} 继续重试` : ""}` : "普通文字关键词搜帖 · 作者与互动 · 公开评论与回复归档" },
      ...monidPlatforms.map((platform) => {
        const platformHealth = monidPlatformHealth.get(platform);
        const platformLimited = Boolean(platformHealth?.retry_after && new Date(platformHealth.retry_after).getTime() > Date.now());
        const building = platformHealth?.status === "building";
        const lastSuccess = platformHealth?.last_success_at ? ` · 最近成功 ${new Date(platformHealth.last_success_at).toLocaleString("zh-CN")}` : " · 等待首次成功搜索";
        const retry = platformLimited ? ` · ${new Date(platformHealth!.retry_after).toLocaleString("zh-CN")} 重试` : "";
        return {
          id: `monid-${platform.toLowerCase()}`, name: `${platform} · Monid`, configured: monidConfigured,
          status: (!monidConfigured ? "credentials" : platformLimited ? "limited" : "online") as "credentials" | "limited" | "online",
          retryAt: platformHealth?.retry_after ?? "", lastError: platformHealth?.last_error ?? "",
          detail: !monidConfigured ? "共享上方 Monid API Key"
            : `${platform} 独立搜索状态与重试时钟${building ? " · 正在建库" : ""}${retry}${lastSuccess}`,
        };
      }),
      { id: "x", provider: "X", configurable: true, configured: xConfigured, lastFour: storedCredentials.get("X")?.last_four ?? (env.X_BEARER_TOKEN ? "环境密钥" : ""), name: "X", status: xConfigured ? "online" : "credentials", detail: xConfigured ? "近 7 日公开帖文、转发与引用链路" : "可在本页配置 Bearer Token" },
      { id: "youtube", provider: "YouTube", configurable: true, configured: youtubeConfigured, lastFour: storedCredentials.get("YouTube")?.last_four ?? (env.YOUTUBE_API_KEY ? "环境密钥" : ""), name: "YouTube", status: youtubeConfigured ? "online" : "credentials", detail: youtubeConfigured ? "视频、互动量与高相关评论" : "可在本页配置 API Key" },
      { id: "meta", provider: "Meta / Instagram", configurable: true, configured: metaConfigured, lastFour: storedCredentials.get("Meta / Instagram")?.last_four ?? "", name: "Meta / Instagram", status: metaConfigured ? "approval" : "credentials", detail: metaConfigured ? "凭证已保存 · 需 Business / Creator 权限和 App Review 后启用提及采集" : "可配置 Access Token 与 Instagram Business Account ID" },
      { id: "tiktok", provider: "TikTok", configurable: true, configured: tiktokConfigured, lastFour: storedCredentials.get("TikTok")?.last_four ?? "", name: "TikTok", status: tiktokConfigured ? "approval" : "credentials", detail: tiktokConfigured ? "凭证已保存 · Research API 获批后启用公开关键词监测" : "可配置 Research API Client Key 与 Client Secret" },
    ],
  };
}
