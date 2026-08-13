"use client";

import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Mention = {
  id: number; title: string; url: string; source: string; platform: string; source_country: string; content_country: string;
  language: string; sentiment: string; risk: number; impact: number; summary: string; cluster_key: string; parent_url: string;
  relation: string; engagement: number; excerpt: string; author: string; provider: string; discovered_via: string;
  content_hash: string; word_count: number; sentiment_score: number; topics: string; keywords: string; first_seen_at: string;
  archived_at: string; published_at: string; location_confidence: number; location_method: string; emotion: string;
  social_post_id?: string; social_author_id?: string; social_author_username?: string; social_author_name?: string;
  social_follower_count?: number; social_likes?: number; social_comments?: number; social_shares?: number;
  social_views?: number; social_plays?: number; social_matched_terms?: string; social_metrics_updated_at?: string;
  comment_adapter?: string; comment_status?: string; comment_reported_count?: number; comment_analyzed_count?: number;
  comment_positive_count?: number; comment_neutral_count?: number; comment_negative_count?: number; comment_mixed_count?: number;
  comment_sentiment?: string; comment_sentiment_score?: number; comment_keywords?: string; comment_last_error?: string; comment_last_collected_at?: string;
};
type Entity = { id: number; type: string; value: string; language: string; active: number };
type Alert = { id: number; title: string; severity: string; country: string; reason: string; acknowledged: number; created_at: string };
type SyncRun = { id: number; provider: string; status: string; found_count: number; inserted_count: number; error: string; started_at: string; completed_at: string | null };
type BrandProfile = { id: number; name: string; aliases: string; website: string; match_mode: string; scope_terms: string; exclude_terms: string; official_accounts: string };
type Connector = { id: string; name: string; provider?: string; configurable?: boolean; configured?: boolean; lastFour?: string; status: "online" | "limited" | "credentials" | "approval"; detail: string; retryAt?: string; pending?: number; lastError?: string };
type MediaSource = { id: number; domain: string; name: string; country: string; language: string; homepage_url: string; feed_url: string; sitemap_url: string; status: string; last_crawled_at: string; next_crawl_at: string; last_error: string };
type PropagationEdge = { id: number; cluster_key: string; from_mention_id: number; to_mention_id: number; similarity: number; confidence: number; method: string; evidence: string; time_gap_minutes: number; cross_border: number };
type CountryStat = { country: string; count: number; positive: number; neutral: number; negative: number; risk: number; engagement: number; latest: string };
type Analytics = {
  countries: CountryStat[];
  sentiment: { positive: number; neutral: number; negative: number; mixed: number };
  emotions: Array<{ label: string; count: number }>;
  timeline: Array<{ date: string; total: number; positive: number; negative: number }>;
  words: Array<{ word: string; count: number }>;
  commentWords: Array<{ word: string; count: number }>;
  commentSentiment: { positive: number; neutral: number; negative: number; mixed: number };
  commentsAnalyzed: number;
  sources: Array<{ source: string; country: string; count: number; impact: number }>;
  crossBorderEdges: number;
  archivedTotal: number;
};
type WorkspaceMember = { user_id: string; email: string; display_name: string; role: string; status: string; joined_at: string; last_seen_at: string };
type WorkspaceInvite = { id: number; email: string; role: string; status: string; created_at: string; expires_at: string };
type TeamWorkspace = { id: number; name: string; role: string; canManage: boolean; canEdit: boolean; members: WorkspaceMember[]; invites: WorkspaceInvite[] };
type DashboardData = {
  mentions: Mention[]; entities: Entity[]; alerts: Alert[]; syncRuns: SyncRun[]; brand: BrandProfile | null;
  connectors: Connector[]; mediaSources: MediaSource[]; propagationEdges: PropagationEdge[]; analytics: Analytics;
  viewer: { authenticated: boolean };
  workspace: TeamWorkspace | null;
};
type SocialCommentRow = {
  id: number; mention_id: number; platform: string; source_comment_id: string; parent_comment_id: string; author_id: string;
  author_username: string; author_name: string; is_verified: number; content: string; sentiment: string; emotion: string; sentiment_score: number;
  language: string; topic: string; likes: number; replies: number; comment_url: string; published_at: string; collected_at: string;
  post_title: string; post_url: string; post_source?: string; post_author?: string; post_author_followers?: number;
};
type SocialCommentsData = {
  summary: { total: number; authors: number; likes: number; replies: number; positive: number; neutral: number; negative: number; mixed: number; average_score: number; reported: number; collected: number; coverage: number };
  sentiment: Array<{ label: string; count: number }>;
  emotions: Array<{ label: string; count: number }>;
  timeline: Array<{ date: string; total: number; negative: number; positive: number }>;
  topics: Array<{ topic: string; count: number; negative: number }>;
  words: Array<{ word: string; count: number }>;
  topPosts: Array<{ mention_id: number; title: string; url: string; source: string; comments: number; negative: number; likes: number }>;
  targets: Array<{ mention_id: number; status: string; reported_count: number; collected_count: number; pages_fetched: number; last_error: string; updated_at: string; post_title: string; post_source: string; mention_url: string }>;
  riskComments: SocialCommentRow[]; comments: SocialCommentRow[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};
type StoryCluster = { key: string; items: Mention[]; title: string; risk: number; impact: number; countries: string[]; platforms: string[]; latest: string; originCountry: string; originSource: string };

const emptyAnalytics: Analytics = { countries: [], sentiment: { positive: 0, neutral: 0, negative: 0, mixed: 0 }, emotions: [], timeline: [], words: [], commentWords: [], commentSentiment: { positive: 0, neutral: 0, negative: 0, mixed: 0 }, commentsAnalyzed: 0, sources: [], crossBorderEdges: 0, archivedTotal: 0 };
const emptyData: DashboardData = { mentions: [], entities: [], alerts: [], syncRuns: [], brand: null, connectors: [], mediaSources: [], propagationEdges: [], analytics: emptyAnalytics, viewer: { authenticated: false }, workspace: null };
const nav = [
  ["overview", "情报总览", "01"], ["archive", "新闻档案", "02"], ["propagation", "传播链路", "03"],
  ["analytics", "舆情分析", "04"], ["comments", "评论舆情", "05"], ["coverage", "来源覆盖", "06"], ["settings", "品牌与团队", "07"],
] as const;
const platformCatalog = ["网页新闻", "Instagram", "Facebook", "TikTok", "X", "YouTube"] as const;
const platformVisuals = [["网页新闻", "web"], ["Instagram", "instagram"], ["Facebook", "facebook"], ["TikTok", "tiktok"], ["X", "x"], ["YouTube", "youtube"]] as const;
function platformSlug(value: string) { return platformVisuals.find(([label]) => label === value)?.[1] ?? "other"; }

const countryCode: Record<string, string> = {
  台湾: "TW", 香港: "HK", 泰国: "TH", 美国: "US", 日本: "JP", 全球: "GL", 中国: "CN", 新加坡: "SG", 英国: "GB",
  韩国: "KR", 加拿大: "CA", 澳大利亚: "AU", 德国: "DE", 法国: "FR", 印度: "IN", 意大利: "IT", 西班牙: "ES",
  印度尼西亚: "ID", 菲律宾: "PH", 越南: "VN", 马来西亚: "MY", 华语地区: "ZH", 地区待确认: "??", 地区未披露: "??",
};
function formatDate(value?: string, full = false) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", full
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
    : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed);
}

function syncTime(value?: string | null) {
  if (!value) return "等待首次巡检";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return formatDate(value);
}

function riskClass(risk: number) { return risk >= 70 ? "danger" : risk >= 40 ? "watch" : "safe"; }
function sentimentClass(value: string) { return value === "负面" ? "negative" : value === "正面" ? "positive" : value === "混合" ? "mixed" : "neutral"; }
function gapLabel(minutes: number) { return minutes < 60 ? `${minutes} 分钟` : minutes < 1440 ? `${Math.round(minutes / 60)} 小时` : `${Math.round(minutes / 1440)} 天`; }
function parsedCommentKeywords(value?: string) {
  try { return (JSON.parse(value || "[]") as Array<{ word?: string; count?: number }>).filter((item) => item.word && Number(item.count) > 0).map((item) => ({ word: String(item.word), count: Number(item.count) })); }
  catch { return []; }
}

export default function Home() {
  const [view, setView] = useState("overview");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("全球");
  const [platform, setPlatform] = useState("全部平台");
  const [sentiment, setSentiment] = useState("全部情绪");
  const [toast, setToast] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const monidPollAttempts = useRef(0);

  async function syncNews(force = false, announce = false) {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "自动巡检失败");
      setData(result.data);
      if (announce) {
        const commentNote = result.sync.commentRefresh?.analyzedComments ? `；新增分析 ${result.sync.commentRefresh.analyzedComments} 条公开评论` : "";
        const message = result.sync.skipped ? `系统刚完成过巡检，档案已是最新状态${commentNote}`
          : `巡检完成：共发现 ${result.sync.found} 条，新增归档 ${result.sync.inserted} 条，追踪 ${result.sync.crawledSources ?? 0} 个媒体源${result.sync.socialPending ? `；${result.sync.socialPending} 个社媒任务正在后台处理` : ""}${commentNote}`;
        setToast(message); window.setTimeout(() => setToast(""), 5200);
      }
    } catch (error) {
      setToast(`${error instanceof Error ? error.message : "自动巡检失败"}，系统会按退避策略重试`);
      window.setTimeout(() => setToast(""), 4500);
    } finally { setSyncing(false); }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    async function bootstrap() {
      try {
        const response = await fetch("/api/data");
        if (!response.ok) throw new Error("数据加载失败");
        const next = await response.json() as DashboardData;
        if (!cancelled) setData(next);
        if (next.viewer.authenticated) {
          if (next.brand && next.workspace?.canEdit) void syncNews(false, false);
          if (next.workspace?.canEdit) timer = window.setInterval(() => void syncNews(false, false), 60 * 60 * 1000);
        }
      } catch { if (!cancelled) setToast("暂时无法读取情报档案，请稍后刷新"); }
      finally { if (!cancelled) setLoading(false); }
    }
    void bootstrap();
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
    // The server lease and discovery clock independently protect paid/free provider quotas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(payload: Record<string, unknown>, success: string) {
    const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "操作失败");
    setData(result); setToast(success); window.setTimeout(() => setToast(""), 3000);
    return result as DashboardData;
  }

  const filteredMentions = useMemo(() => data.mentions.filter((item) => {
    const needle = query.toLowerCase();
    return (!needle || `${item.title} ${item.source} ${item.excerpt} ${item.keywords}`.toLowerCase().includes(needle))
      && (country === "全球" || item.source_country === country)
      && (platform === "全部平台" || item.platform === platform)
      && (sentiment === "全部情绪" || item.sentiment === sentiment);
  }), [data.mentions, query, country, platform, sentiment]);

  const clusters = useMemo(() => {
    const grouped = new Map<string, Mention[]>();
    filteredMentions.forEach((mention) => grouped.set(mention.cluster_key, [...(grouped.get(mention.cluster_key) ?? []), mention]));
    return [...grouped.entries()].map(([key, items]) => {
      const ordered = [...items].sort((a, b) => a.published_at.localeCompare(b.published_at));
      return { key, items: ordered, title: ordered[0].title, risk: Math.max(...items.map((item) => item.risk)), impact: Math.max(...items.map((item) => item.impact)),
        countries: [...new Set(ordered.map((item) => item.source_country))], platforms: [...new Set(ordered.map((item) => item.platform))], latest: ordered.at(-1)?.published_at ?? "",
        originCountry: ordered[0].source_country, originSource: ordered[0].source };
    }).sort((a, b) => b.items.length - a.items.length || b.impact - a.impact);
  }, [filteredMentions]);

  const activeAlerts = data.alerts.filter((item) => !item.acknowledged);
  const countries = ["全球", ...new Set(data.mentions.map((item) => item.source_country))];
  const platformCounts = data.mentions.reduce<Record<string, number>>((counts, item) => {
    counts[item.platform] = (counts[item.platform] ?? 0) + 1;
    return counts;
  }, {});
  const uncataloguedPlatforms = [...new Set(data.mentions.map((item) => item.platform))].filter((item) => !platformCatalog.includes(item as typeof platformCatalog[number]));
  const platforms = ["全部平台", ...platformCatalog, ...uncataloguedPlatforms];
  const selected = clusters.find((item) => item.key === selectedCluster) ?? clusters.find((item) => item.items.length > 1) ?? clusters[0];
  const lastSync = data.syncRuns[0];
  const monidConnector = data.connectors.find((item) => item.provider === "Monid / Instagram");
  const initials = data.viewer.authenticated ? data.brand?.name.split(/\s+/).map((item) => item[0]).join("").slice(0, 2).toUpperCase() || "BR" : "--";

  useEffect(() => {
    if (!data.viewer.authenticated || !data.workspace?.canEdit || !data.brand || monidConnector?.status !== "online" || !monidConnector.pending) {
      monidPollAttempts.current = 0;
      return;
    }
    if (syncing || monidPollAttempts.current >= 30) return;
    const timer = window.setTimeout(() => {
      monidPollAttempts.current += 1;
      void syncNews(false, false);
    }, 12_000);
    return () => window.clearTimeout(timer);
    // Pending Monid jobs must be reclaimed independently of the regular 20-minute provider cooldown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.brand, data.viewer.authenticated, data.workspace?.canEdit, monidConnector?.pending, monidConnector?.status, syncing]);

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><div><strong>SIGNAL ATLAS</strong><small>GLOBAL MEDIA INTELLIGENCE</small></div></div>
      <nav aria-label="主要导航">{nav.map(([id, label, number]) => <button key={id} disabled={!data.viewer.authenticated} className={view === id ? "nav-item active" : "nav-item"} onClick={() => setView(id)}><span>{number}</span>{label}{id === "overview" && activeAlerts.length > 0 && <b>{activeAlerts.length}</b>}</button>)}</nav>
      {data.viewer.authenticated && <div className="system-card">
        <div className="system-title"><i /> 混合监测已运行</div>
        <div className="system-row"><span>调度巡检</span><strong>每小时 :17</strong></div>
        <div className="system-row"><span>全球发现</span><strong>6 小时 / 每日</strong></div>
        <div className="system-row"><span>五平台社媒搜索</span><strong>{monidConnector?.configured ? "每 6 小时" : "待配置"}</strong></div>
        <div className="system-row"><span>免费单源</span><strong>活跃 3h / 探测 12h</strong></div>
        <div className="system-row"><span>媒体来源库</span><strong>{data.mediaSources.length} 个</strong></div>
        <div className="system-row"><span>最后巡检</span><strong>{syncTime(lastSync?.completed_at ?? lastSync?.started_at)}</strong></div>
      </div>}
      <div className="sidebar-foot"><div className="avatar">{initials}</div><div><strong>{data.viewer.authenticated ? data.workspace?.name ?? data.brand?.name ?? "尚未配置品牌" : "尚未登录"}</strong><small>{data.workspace ? `${data.workspace.members.length} 位成员 · ${roleLabel(data.workspace.role)}` : "品牌情报工作区"}</small></div></div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div><h1>{nav.find(([id]) => id === view)?.[1]}</h1></div>
        <div className="top-actions">
          <label className="search-box"><span>⌕</span><input disabled={!data.viewer.authenticated} aria-label="搜索全部档案" placeholder="搜索标题、来源、关键词" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>全档案</kbd></label>
          {data.workspace && <span className="team-chip">共享工作区 · {data.workspace.members.length} 人</span>}
          <button className="primary-button" disabled={syncing || !data.brand || !data.workspace?.canEdit} onClick={() => void syncNews(true, true)}><span>{syncing ? "↻" : "◎"}</span>{syncing ? "巡检中…" : "立即巡检"}</button>
        </div>
      </header>

      <div className="content-area">
        {loading ? <LoadingState /> : !data.viewer.authenticated ? <PublicAccess /> : !data.brand ? <BrandOnboarding submit={async (payload) => { await post(payload, "品牌档案已创建，正在启动全球发现"); void syncNews(true, true); }} /> : <>
          {view === "overview" && <Overview data={data} brand={data.brand} clusters={clusters} alerts={activeAlerts} setView={setView} selectCluster={(key) => { setSelectedCluster(key); setView("propagation"); }} acknowledge={(id) => post({ action: "acknowledgeAlert", id }, "告警已确认")} canEdit={Boolean(data.workspace?.canEdit)} />}
          {view === "archive" && <ArchiveView mentions={filteredMentions} allCount={data.mentions.length} countries={countries} platforms={platforms} platformCounts={platformCounts} country={country} platform={platform} sentiment={sentiment} setCountry={setCountry} setPlatform={setPlatform} setSentiment={setSentiment} submit={post} canEdit={Boolean(data.workspace?.canEdit)} />}
          {view === "propagation" && <PropagationView clusters={clusters} selected={selected} edges={data.propagationEdges} onSelect={setSelectedCluster} />}
          {view === "analytics" && <AnalyticsView analytics={data.analytics} mentions={filteredMentions} />}
          {view === "comments" && <SocialCommentsView brand={data.brand} monidConfigured={Boolean(monidConnector?.configured)} />}
          {view === "coverage" && <CoverageView connectors={data.connectors} sources={data.mediaSources} submit={post} canManage={Boolean(data.workspace?.canManage)} />}
          {view === "settings" && data.workspace && <SettingsView brand={data.brand} connectors={data.connectors} entities={data.entities} workspace={data.workspace} submit={post} />}
        </>}
      </div>
    </section>
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </main>;
}

function LoadingState() { return <div className="loading-state"><span /><p>正在读取长期新闻档案与传播图谱…</p></div>; }

function PublicAccess() {
  return <section className="onboarding">
    <div className="onboarding-copy panel-dark"><h2>品牌舆情监测</h2><p>自动搜索网页新闻与已接入的社交平台内容，并按地区归档、聚类事件、分析情绪和推断传播路径。</p><div className="architecture-mini"><span>搜索与归档</span><b>→</b><span>事件与传播</span><b>→</b><span>情绪与风险</span></div></div>
    <div className="onboarding-form surface"><p className="eyebrow">ACCOUNT ACCESS</p><h3>登录后使用</h3><p>如果管理员已邀请你的邮箱，登录后会直接进入同一个团队工作区，品牌、档案、分析和连接器配置无需重新建立。</p><a className="primary-button wide" href="/signin-with-chatgpt?return_to=%2F">使用 ChatGPT 登录 →</a><small>未受邀账号会获得独立的新工作区。</small></div>
  </section>;
}

function roleLabel(role: string) { return role === "owner" ? "所有者" : role === "admin" ? "管理员" : role === "editor" ? "编辑者" : "查看者"; }

function BrandOnboarding({ submit }: { submit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { await submit({ action: "saveBrandProfile", ...Object.fromEntries(new FormData(event.currentTarget).entries()) }); } finally { setBusy(false); }
  }
  return <section className="onboarding">
    <div className="onboarding-copy panel-dark"><h2>配置监测品牌</h2><p>填写品牌名、别名和官网域名。保存后系统会自动搜索报道、更新媒体来源，并持续归档和分析新内容。</p><div className="architecture-mini"><span>发现报道</span><b>→</b><span>更新来源</span><b>→</b><span>归档分析</span></div></div>
    <form className="onboarding-form surface" onSubmit={handleSubmit}><p className="eyebrow">BRAND PROFILE</p><h3>创建品牌监测档案</h3><label className="field"><span>品牌名称 *</span><input name="brandName" required autoFocus placeholder="例如：OpenAI" /></label><label className="field"><span>品牌别名</span><textarea name="aliases" rows={3} placeholder={'每行一个，例如：\nOpen AI\n当地语言译名'} /></label><label className="field"><span>官网域名</span><input name="website" placeholder="brand.com" /></label><input type="hidden" name="matchMode" value="precise" /><label className="field"><span>身份锚点（强烈建议）</span><textarea name="scopeTerms" rows={3} placeholder={'每行一个：核心产品、创始人、独特技术或行业词'} /></label><label className="field"><span>排除词</span><textarea name="excludeTerms" rows={2} placeholder="同名公司所属行业、城市或产品" /></label><button className="primary-button wide" disabled={busy}>{busy ? "正在建立全球档案…" : "启动自动监测 →"}</button><small>精准模式要求品牌词与至少一个身份锚点同时出现，可避免收录同名公司。</small></form>
  </section>;
}

function Overview({ data, brand, clusters, alerts, setView, selectCluster, acknowledge, canEdit }: { data: DashboardData; brand: BrandProfile; clusters: StoryCluster[]; alerts: Alert[]; setView: (view: string) => void; selectCluster: (key: string) => void; acknowledge: (id: number) => Promise<unknown>; canEdit: boolean }) {
  const topCountry = data.analytics.countries[0];
  const negative = data.analytics.sentiment.negative;
  const total = data.mentions.length || 1;
  return <div className="dashboard-stack">
    <section className="intelligence-hero panel-dark">
      <div><h2>{brand.name} 监测概览</h2><p>系统按计划搜索新报道并跟踪已发现的媒体来源。归档内容用于地区识别、事件聚类、传播路径和情绪分析。</p><div className="pipeline"><span><b>01</b>全球发现</span><i>→</i><span><b>02</b>{data.mediaSources.length} 个媒体来源</span><i>→</i><span><b>03</b>{data.analytics.archivedTotal} 条归档</span></div></div>
      <div className="hero-signal"><small>TOP MARKET</small><strong>{topCountry?.country ?? "等待数据"}</strong><span>{topCountry ? `${topCountry.count} 篇报道 · 占全部 ${Math.round(topCountry.count / total * 100)}%` : "首次巡检后生成"}</span><i style={{ width: `${topCountry ? Math.max(8, topCountry.count / total * 100) : 0}%` }} /></div>
    </section>
    <section className="metric-strip">
      <Metric label="历史新闻档案" value={String(data.analytics.archivedTotal)} note="持续累积，不覆盖旧记录" />
      <Metric label="传播事件" value={String(clusters.length)} note="连续 96 小时无新增则切分事件" />
      <Metric label="国家 / 地区" value={String(data.analytics.countries.filter((item) => !["地区未披露", "地区待确认"].includes(item.country)).length)} note="由来源元数据、域名、媒体及语言推断" />
      <Metric label="跨境传播边" value={String(data.analytics.crossBorderEdges)} note="已识别的地区间复制链路" />
      <Metric label="负面内容" value={String(negative)} note={`${Math.round(negative / total * 100)}% 的已归档内容`} danger={negative > total * .2} />
      <Metric label="免费媒体来源" value={String(data.mediaSources.length)} note="自动增长的追踪来源库" />
    </section>
    <div className="overview-grid">
      <section className="surface map-panel"><div className="section-head"><div><p className="eyebrow">GLOBAL NEWS INTENSITY</p><h3>全球报道热力分布</h3></div><button className="text-button" onClick={() => setView("analytics")}>查看完整分析 →</button></div><WorldHeatMap countries={data.analytics.countries} /></section>
      <section className="surface recent-panel"><div className="section-head"><div><p className="eyebrow">LATEST ARCHIVE</p><h3>最新归档新闻</h3></div><button className="text-button" onClick={() => setView("archive")}>全部档案 →</button></div><div className="latest-list">{data.mentions.slice(0, 6).map((item) => <article key={item.id}><span className={`tone-dot ${sentimentClass(item.sentiment)}`} /><div><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small>{item.source} · {item.source_country} · {formatDate(item.published_at)}</small></div><b className={`risk-pill ${riskClass(item.risk)}`}>{item.risk}</b></article>)}</div></section>
      <section className="surface event-panel"><div className="section-head"><div><p className="eyebrow">PROPAGATION EVENTS</p><h3>正在扩散的报道链路</h3></div><span className="count-chip">{clusters.length}</span></div><div className="event-list">{clusters.slice(0, 5).map((cluster, index) => <button key={cluster.key} onClick={() => selectCluster(cluster.key)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{cluster.title}</strong><small>起点：{cluster.originCountry} · 覆盖 {cluster.countries.length} 个地区 · {cluster.items.length} 个节点</small></div><b>{cluster.items.length}</b><i>→</i></button>)}</div></section>
      <section className="surface alerts-panel"><div className="section-head"><div><p className="eyebrow">ACTION QUEUE</p><h3>舆情告警</h3></div><span className="count-chip">{alerts.length}</span></div>{alerts.length ? <div className="alert-list">{alerts.slice(0, 4).map((alert) => <article key={alert.id}><div><span className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span><small>{alert.country}</small></div><h4>{alert.title}</h4><p>{alert.reason}</p>{canEdit && <button onClick={() => void acknowledge(alert.id)}>标记已处理</button>}</article>)}</div> : <div className="empty-mini">当前没有待处理高风险信号</div>}</section>
    </div>
  </div>;
}

function Metric({ label, value, note, danger = false }: { label: string; value: string; note: string; danger?: boolean }) { return <article className={danger ? "metric danger" : "metric"}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }

function WorldHeatMap({ countries }: { countries: CountryStat[] }) {
  const max = Math.max(1, ...countries.map((item) => item.count));
  const mapRef = useRef<HTMLObjectElement>(null);
  const placed = countries.filter((item) => /^[A-Z]{2}$/.test(countryCode[item.country] ?? ""));
  function paintCountries() {
    const document = mapRef.current?.contentDocument;
    if (!document) return;
    for (const node of document.querySelectorAll<SVGElement>(".landxx")) {
      node.style.fill = "#d9ddd2";
      node.style.transition = "fill .18s ease";
    }
    const ordered = [...placed].sort((left, right) => Number(countryCode[right.country] === "CN") - Number(countryCode[left.country] === "CN"));
    for (const item of ordered) {
      const code = countryCode[item.country];
      const node = document.getElementById(code.toLowerCase()) as unknown as SVGElement | null;
      if (!node) continue;
      const heat = item.count / max;
      const palette = ["#dce7be", "#bed288", "#91ad57", "#627f34", "#2f461c"];
      const color = palette[Math.min(palette.length - 1, Math.max(0, Math.ceil(heat * palette.length) - 1))];
      node.style.fill = color;
      for (const child of node.querySelectorAll<SVGElement>(".landxx")) child.style.fill = color;
      if (code === "CN") for (const childCode of ["tw", "hk", "mo"]) {
        const childRegion = document.getElementById(childCode) as unknown as SVGElement | null;
        if (!childRegion) continue;
        childRegion.style.fill = "#d9ddd2";
        for (const child of childRegion.querySelectorAll<SVGElement>(".landxx")) child.style.fill = "#d9ddd2";
      }
      node.style.cursor = "help";
      const previous = node.querySelector("title[data-signal-atlas]");
      previous?.remove();
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.setAttribute("data-signal-atlas", "true");
      title.textContent = `${item.country}：${item.count} 篇报道`;
      node.prepend(title);
    }
  }
  useEffect(() => { paintCountries(); });
  return <div className="world-map-wrap">
    <div className="world-map" aria-label="按国家地区显示新闻量的世界热力图">
      <object ref={mapRef} className="world-map-base" data="/world-map-detailed.svg" type="image/svg+xml" aria-label="国家边界与报道强度" onLoad={paintCountries} />
    </div>
    <div className="heat-legend"><span>报道较少</span><i /><i /><i /><i /><span>报道最多</span></div>
    {countries.length > placed.length && <div className="unmapped-regions">{countries.filter((item) => !placed.includes(item)).slice(0, 6).map((item) => <span key={item.country}>{item.country} <b>{item.count}</b></span>)}</div>}
  </div>;
}

function ArchiveView({ mentions, allCount, countries, platforms, platformCounts, country, platform, sentiment, setCountry, setPlatform, setSentiment, submit, canEdit }: { mentions: Mention[]; allCount: number; countries: string[]; platforms: string[]; platformCounts: Record<string, number>; country: string; platform: string; sentiment: string; setCountry: (value: string) => void; setPlatform: (value: string) => void; setSentiment: (value: string) => void; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown>; canEdit: boolean }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest" | "risk">("newest");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPublishedAt, setManualPublishedAt] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState("");
  const pageSize = 20;
  const ordered = useMemo(() => [...mentions].sort((a, b) => sort === "oldest" ? a.published_at.localeCompare(b.published_at) : sort === "risk" ? b.risk - a.risk : b.published_at.localeCompare(a.published_at)), [mentions, sort]);
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const rows = ordered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  function exportCsv() {
    const visible = (value?: number) => value != null && value >= 0 ? value : "";
    const fields = [["发布时间", "平台", "标题", "链接", "媒体/账号", "地区", "点赞", "评论", "转发", "播放", "已分析评论", "极性", "具体情绪", "风险分", "传播事件"], ...ordered.map((item) => [item.published_at, item.platform, item.title, item.url, item.source, item.source_country, visible(item.social_likes), visible(item.social_comments), visible(item.social_shares), visible(Math.max(item.social_views ?? -1, item.social_plays ?? -1)), item.comment_analyzed_count ?? "", item.sentiment, item.emotion, item.risk, item.cluster_key])];
    const csv = fields.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); link.download = `signal-atlas-archive-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setManualBusy(true); setManualError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      if (values.publishedAt) values.publishedAt = new Date(String(values.publishedAt)).toISOString();
      await submit({ action: "createMention", ...values }, "内容已补充到历史档案");
      setManualOpen(false);
    } catch (error) { setManualError(error instanceof Error ? error.message : "保存失败"); }
    finally { setManualBusy(false); }
  }
  function interaction(item: Mention) {
    const metrics = [
      ["赞", item.social_likes], ["评", item.social_comments], ["转", item.social_shares],
      ["播", Math.max(item.social_views ?? -1, item.social_plays ?? -1)], ["粉丝", item.social_follower_count],
    ].filter((entry) => typeof entry[1] === "number" && Number(entry[1]) >= 0) as Array<[string, number]>;
    const words = parsedCommentKeywords(item.comment_keywords).slice(0, 4);
    return <div className="interaction-stack">{metrics.length > 0 && <strong>{metrics.map(([label, value]) => `${label} ${value.toLocaleString()}`).join(" · ")}</strong>}
      {Number(item.comment_analyzed_count ?? 0) > 0 && <small>已分析 {item.comment_analyzed_count} 条评论 · {item.comment_sentiment} · {words.map((entry) => entry.word).join(" / ") || "暂无高频词"}</small>}
      {!metrics.length && !Number(item.comment_analyzed_count ?? 0) && <small>暂无可公开读取的互动数据</small>}</div>;
  }
  return <div className="archive-page">
    <section className="archive-intro"><div><p className="eyebrow">LIFETIME MEDIA ARCHIVE</p><h2>品牌历史媒体档案</h2><p>新闻与社媒内容统一保留发布时间、地区、来源、账号、公开互动、情绪、风险和传播事件编号；旧记录不会被下一次搜索覆盖。</p></div><div className="archive-total"><small>ARCHIVED</small><strong>{allCount}</strong><span>有史以来全部记录</span></div></section>
    <section className="surface archive-table-card">
      <div className="archive-toolbar"><div className="filters"><select value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }}>{countries.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="按平台筛选档案" value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1); }}>{platforms.map((item) => <option key={item} value={item}>{item === "全部平台" ? `全部平台（${allCount}）` : `${item}（${platformCounts[item] ?? 0}）`}</option>)}</select><select value={sentiment} onChange={(event) => { setSentiment(event.target.value); setPage(1); }}>{["全部情绪", "正面", "中性", "负面", "混合"].map((item) => <option key={item}>{item}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">最新优先</option><option value="oldest">最早优先</option><option value="risk">风险优先</option></select></div><div className="archive-actions">{canEdit && <button className="secondary-button" onClick={() => { const date = new Date(); setManualPublishedAt(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); setManualOpen(true); }}>＋ 手动补充</button>}<button className="secondary-button" onClick={exportCsv}>↓ 导出 CSV</button></div></div>
      <div className="table-scroll"><table className="archive-table"><thead><tr><th>发布时间</th><th>平台</th><th>新闻 / 社媒原文</th><th>媒体 / 账号</th><th>互动</th><th>地区</th><th>具体情绪</th><th>风险</th><th>事件</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td className="date-cell">{formatDate(item.published_at, true)}</td><td><span className={`platform-badge platform-${item.platform.toLowerCase().replace("网页新闻", "web")}`}>{item.platform}</span></td><td className="title-cell"><a href={item.url} target="_blank" rel="noreferrer">{item.title}<span>↗</span></a><small>{item.excerpt || item.summary}</small></td><td><strong>{item.source}</strong>{item.author && item.author !== item.source && <small>{item.author}</small>}</td><td>{interaction(item)}</td><td><span className="country-tag">{countryCode[item.source_country] ?? "GL"}</span>{item.source_country}</td><td><span className="emotion-pill">{item.emotion || item.sentiment}</span><small>{item.sentiment}</small></td><td><span className={`risk-score ${riskClass(item.risk)}`}>{item.risk}</span></td><td><code>{item.cluster_key.replace("story-", "#")}</code></td></tr>)}</tbody></table></div>
      {!rows.length && <div className="empty-table">当前筛选条件下暂无档案</div>}
      <div className="pagination"><span>显示 {ordered.length} 条结果 · 第 {Math.min(page, pages)} / {pages} 页</span><div><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← 上一页</button><button disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>下一页 →</button></div></div>
    </section>
    {manualOpen && <div className="credential-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setManualOpen(false); }}><form className="credential-modal manual-mention-modal" onSubmit={createManual}><div className="section-head"><div><p className="eyebrow">MANUAL ARCHIVE</p><h3>手动补充新闻或社媒内容</h3></div><button type="button" className="modal-close" onClick={() => setManualOpen(false)}>×</button></div><p>用于补充系统尚未发现但需要进入同一档案与传播分析的公开内容。</p><div className="manual-form-grid"><label className="field full"><span>标题 / 帖子原文摘要 *</span><input name="title" required /></label><label className="field"><span>平台 *</span><select name="platform" defaultValue="网页新闻">{platformCatalog.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>发布时间 *</span><input name="publishedAt" type="datetime-local" required defaultValue={manualPublishedAt} /></label><label className="field full"><span>原文链接 *</span><input name="url" type="url" required placeholder="https://…" /></label><label className="field"><span>媒体 / 账号 *</span><input name="source" required placeholder="媒体名或 @账号" /></label><label className="field"><span>作者 / 账号 ID</span><input name="author" /></label><label className="field"><span>来源国家 / 地区</span><input name="sourceCountry" placeholder="例如：中国、台湾、美国" /></label><label className="field"><span>语言</span><input name="language" placeholder="留空自动分析" /></label><label className="field full"><span>正文摘录 / 帖子文案</span><textarea name="excerpt" rows={4} /></label>{[["likes", "点赞"], ["comments", "评论"], ["shares", "转发"], ["views", "播放/浏览"]].map(([name, label]) => <label className="field metric-input" key={name}><span>{label}（可选）</span><input name={name} type="number" min="0" /></label>)}</div>{manualError && <p className="form-error">{manualError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setManualOpen(false)}>取消</button><button className="primary-button" disabled={manualBusy}>{manualBusy ? "保存中…" : "保存并进入分析"}</button></div></form></div>}
  </div>;
}

function PropagationView({ clusters, selected, edges, onSelect }: { clusters: StoryCluster[]; selected?: StoryCluster; edges: PropagationEdge[]; onSelect: (key: string) => void }) {
  const [focusedMentionId, setFocusedMentionId] = useState<number | null>(null);
  const selectedEdges = selected ? edges.filter((item) => item.cluster_key === selected.key) : [];
  const edgeByTarget = new Map(selectedEdges.map((edge) => [edge.to_mention_id, edge]));
  const mentionById = new Map(selected?.items.map((item) => [item.id, item]) ?? []);
  const comparableClusters = clusters.filter((cluster) => cluster.items.length > 1);
  const hasPropagationSample = Boolean(selected && selected.items.length > 1);
  const eventStart = selected?.items[0] ? new Date(selected.items[0].published_at).getTime() : 0;
  const eventEnd = selected?.items.at(-1) ? new Date(selected.items.at(-1)!.published_at).getTime() : eventStart;
  const eventSpanHours = Math.max(0, Math.round((eventEnd - eventStart) / 3600_000));
  const burstBuckets = new Map<number, number>();
  for (const item of selected?.items ?? []) { const bucket = Math.max(0, Math.floor((new Date(item.published_at).getTime() - eventStart) / 3600_000)); burstBuckets.set(bucket, (burstBuckets.get(bucket) ?? 0) + 1); }
  const burstSeries = [...burstBuckets.entries()].sort((a, b) => a[0] - b[0]);
  const peak = burstSeries.sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  burstSeries.sort((a, b) => a[0] - b[0]);
  const maxBurst = Math.max(1, ...burstSeries.map((item) => item[1]));
  const reprintRatio = selected?.items.length ? Math.round(selectedEdges.filter((edge) => edge.similarity >= 45).length / Math.max(1, selected.items.length - 1) * 100) : 0;
  const avgConfidence = selectedEdges.length ? Math.round(selectedEdges.reduce((sum, edge) => sum + edge.confidence, 0) / selectedEdges.length) : 0;
  const eventCountries = selected ? [...new Set(selected.items.map((item) => item.source_country))].map((region) => ({ region, count: selected.items.filter((item) => item.source_country === region).length })).sort((a, b) => b.count - a.count) : [];
  const eventSources = selected ? [...new Set(selected.items.map((item) => item.source))].map((source) => ({ source, count: selected.items.filter((item) => item.source === source).length })).sort((a, b) => b.count - a.count).slice(0, 8) : [];
  const graphWidth = Math.max(1080, Math.min(3200, (selected?.items.length ?? 1) * 130));
  const graphHeight = Math.max(320, eventCountries.length * 100 + 80);
  const regionRanks = new Map<string, number>();
  const nodePositions = new Map((selected?.items ?? []).map((item, index, items) => {
    const rank = regionRanks.get(item.source_country) ?? 0;
    regionRanks.set(item.source_country, rank + 1);
    return [item.id, {
      x: items.length === 1 ? graphWidth / 2 : 125 + index * ((graphWidth - 250) / (items.length - 1)),
      y: 80 + Math.max(0, eventCountries.findIndex((entry) => entry.region === item.source_country)) * 100 + (rank % 2 ? 27 : -27),
    }];
  }));
  const focused = selected?.items.find((item) => item.id === focusedMentionId) ?? selected?.items[0];
  const focusedEdge = focused ? edgeByTarget.get(focused.id) : undefined;
  const focusedParent = focusedEdge ? mentionById.get(focusedEdge.from_mention_id) : undefined;
  return <div className="propagation-layout">
    <section className="surface cluster-index"><div className="section-head"><div><p className="eyebrow">STORY CLUSTERS</p><h3>传播事件</h3></div><span className="count-chip">{clusters.length}</span></div><div className="cluster-list">{clusters.map((cluster) => <button key={cluster.key} className={selected?.key === cluster.key ? "selected" : ""} onClick={() => onSelect(cluster.key)}><div><span className={`risk-pill ${riskClass(cluster.risk)}`}>RISK {cluster.risk}</span><small>{formatDate(cluster.latest)}</small></div><h4>{cluster.title}</h4><p>起点：{cluster.originSource}（{cluster.originCountry}） · 覆盖 {cluster.countries.length} 个地区</p><footer><span>{cluster.items.length} 节点</span><span>{cluster.platforms.join(" · ")}</span><b>→</b></footer></button>)}</div></section>
    <section className="surface propagation-detail">{selected ? <>
      <div className="detail-heading"><div><p className="eyebrow">EVIDENCE-BASED PROPAGATION</p><h2>{selected.title}</h2><p>同一事件由连续爆发时间、品牌实体、标题正文、关键数字和跨语言主题指纹共同判断；连续 96 小时没有新增报道会强制结束上一事件，避免跨越长空窗期误合并。</p></div><div className="chain-stat"><strong>{selected.countries.length}</strong><span>国家 / 地区</span><small>{selectedEdges.filter((item) => item.cross_border).length} 次跨境传播</small></div></div>
      <section className="event-network-card"><div className="network-heading"><div><p className="eyebrow">EVENT PROPAGATION GRAPH</p><h3>同一事件扩散路径</h3><span>从左到右按发布时间排列；方块颜色代表发布渠道，点击节点查看证据。</span></div><div className="network-legend"><span><i className="normal" />同地区</span><span><i className="cross" />跨地区</span><span><i className="origin" />最早信源</span>{platformVisuals.map(([label, slug]) => <span key={label}><i className={`channel ${slug}`} />{label}</span>)}</div></div><div className="network-scroll"><svg className="event-network" viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ minWidth: `${graphWidth}px`, height: `${graphHeight}px` }} role="img" aria-label="同一新闻事件的媒体扩散路径图"><defs><marker id="arrow-normal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker><marker id="arrow-cross" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{eventCountries.map((lane, index) => <g key={lane.region} className="network-lane"><line x1="115" y1={80 + index * 100} x2={graphWidth - 35} y2={80 + index * 100} /><text x="18" y={84 + index * 100}>{lane.region}</text></g>)}{selectedEdges.map((edge) => { const from = nodePositions.get(edge.from_mention_id); const to = nodePositions.get(edge.to_mention_id); if (!from || !to) return null; const bend = Math.max(38, Math.abs(to.x - from.x) * .34); return <g key={edge.id} className={edge.cross_border ? "network-edge cross" : "network-edge"}><path d={`M ${from.x + 96} ${from.y} C ${from.x + 96 + bend} ${from.y}, ${to.x - 96 - bend} ${to.y}, ${to.x - 96} ${to.y}`} markerEnd={`url(#arrow-${edge.cross_border ? "cross" : "normal"})`} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>{edge.similarity}%</text></g>; })}{selected.items.map((item, index) => { const point = nodePositions.get(item.id)!; const isFocused = focused?.id === item.id; return <g key={item.id} className={`network-node platform-${platformSlug(item.platform)} ${index === 0 ? "origin" : ""} ${isFocused ? "focused" : ""}`} transform={`translate(${point.x} ${point.y})`} onClick={() => setFocusedMentionId(item.id)} role="button" tabIndex={0}><rect x="-96" y="-36" width="192" height="72" rx="8" /><text className="node-index" x="-82" y="-15">{String(index + 1).padStart(2, "0")} · {item.platform}</text><text className="node-source" x="-82" y="4">{item.source.slice(0, 22)}</text><text className="node-title" x="-82" y="20">{item.title.slice(0, 26)}{item.title.length > 26 ? "…" : ""}</text><text className="node-time" x="82" y="-15" textAnchor="end">{formatDate(item.published_at)}</text></g>; })}</svg></div>{!hasPropagationSample && <div className="network-empty-note">当前事件只有 1 篇报道，尚不能形成扩散路径；系统会在发现相似后续报道后自动连边。</div>}{focused && <div className="network-evidence"><div><span className="country-tag">{countryCode[focused.source_country] ?? "GL"}</span><div><strong>{focused.source}</strong><small>{focused.source_country} · {focused.platform} · {formatDate(focused.published_at, true)}</small></div></div><div><a href={focused.url} target="_blank" rel="noreferrer">{focused.title} ↗</a><p>{focused.excerpt || focused.summary}</p></div><aside>{focusedEdge ? <><b>{focusedEdge.method}</b><span>{focusedEdge.confidence}% 置信度 · {focusedEdge.similarity}% 内容重合</span><small>推断上游：{focusedParent?.source ?? "公开信源"} · 间隔 {gapLabel(focusedEdge.time_gap_minutes)}<br />{focusedEdge.evidence}</small></> : <><b>事件起点</b><span>当前聚类中的最早公开报道</span><small>后续报道将通过箭头连接到最可能的上游来源。</small></>}</aside></div>}</section>
      <div className="event-analysis-strip"><div><span>爆发窗口</span><strong>{hasPropagationSample ? eventSpanHours < 1 ? "<1h" : eventSpanHours < 24 ? `${eventSpanHours}h` : `${Math.round(eventSpanHours / 24)}d` : "样本不足"}</strong><small>首发至最后转载</small></div><div><span>峰值时段</span><strong>{hasPropagationSample ? formatDate(new Date(eventStart + peak[0] * 3600_000).toISOString()) : "样本不足"}</strong><small>{hasPropagationSample ? `该小时新增 ${peak[1]} 篇` : "至少需要 2 篇报道"}</small></div><div><span>高度转载率</span><strong>{hasPropagationSample && selectedEdges.length ? `${reprintRatio}%` : "样本不足"}</strong><small>内容重合度 ≥ 45%</small></div><div><span>平均推断置信</span><strong>{avgConfidence ? `${avgConfidence}%` : "样本不足"}</strong><small>{avgConfidence ? "可解释证据评分" : "尚未形成传播边"}</small></div><div><span>传播速度</span><strong>{hasPropagationSample ? (selected.items.length / Math.max(1, eventSpanHours) * 24).toFixed(1) : "样本不足"}</strong><small>篇 / 24 小时</small></div></div>
      <div className="event-visuals"><section><div className="mini-title"><div><p className="eyebrow">BURST CURVE</p><h3>事件爆发曲线</h3></div><span>从首篇报道起</span></div><div className="burst-chart">{burstSeries.length ? burstSeries.map(([hour, count]) => <div key={hour} title={`首发后 ${hour} 小时：${count} 篇`}><i style={{ height: `${Math.max(8, count / maxBurst * 100)}%` }} /><span>+{hour}h</span></div>) : <small>等待更多报道</small>}</div></section><section><div className="mini-title"><div><p className="eyebrow">REGION × SOURCE</p><h3>地区与信源构成</h3></div></div><div className="composition-list">{eventCountries.map((item) => <div key={item.region}><span>{item.region}</span><i><b style={{ width: `${item.count / Math.max(1, selected.items.length) * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div><div className="source-chips">{eventSources.map((item) => <span key={item.source}>{item.source}<b>{item.count}</b></span>)}</div></section></div>
      {comparableClusters.length > 1 && <div className="event-comparison"><div className="section-head"><div><p className="eyebrow">CROSS-EVENT COMPARISON</p><h3>并列事件对比</h3></div><span className="subtle-note">仅比较已形成传播链的事件</span></div><div className="comparison-layout"><div className="event-scatter"><span className="axis-label y">高风险 ↑</span><span className="axis-label x">传播速度 →</span>{comparableClusters.slice(0, 12).map((cluster, index) => { const start = new Date(cluster.items[0].published_at).getTime(); const end = new Date(cluster.items.at(-1)!.published_at).getTime(); const hours = Math.max(1, (end - start) / 3600_000); const velocity = cluster.items.length / hours; const maxVelocity = Math.max(.01, ...comparableClusters.slice(0, 12).map((item) => { const first = new Date(item.items[0].published_at).getTime(); const last = new Date(item.items.at(-1)!.published_at).getTime(); return item.items.length / Math.max(1, (last - first) / 3600_000); })); return <button key={cluster.key} className={cluster.key === selected.key ? "active" : ""} style={{ left: `${12 + velocity / maxVelocity * 76}%`, bottom: `${10 + cluster.risk / 100 * 75}%`, width: `${18 + Math.min(34, cluster.items.length * 4)}px`, height: `${18 + Math.min(34, cluster.items.length * 4)}px` }} title={`${cluster.title} · ${cluster.items.length} 篇 · 风险 ${cluster.risk}`} onClick={() => onSelect(cluster.key)}>{index + 1}</button>; })}</div><div className="comparison-table">{comparableClusters.slice(0, 6).map((cluster, index) => <button key={cluster.key} onClick={() => onSelect(cluster.key)}><span>{index + 1}</span><div><strong>{cluster.title}</strong><small>{cluster.countries.length} 地区 · {cluster.items.length} 篇</small></div><b className={`risk-score ${riskClass(cluster.risk)}`}>{cluster.risk}</b></button>)}</div></div></div>}
    </> : <div className="empty-state">当前没有可追踪的传播事件</div>}</section>
  </div>;
}

function AnalyticsView({ analytics, mentions }: { analytics: Analytics; mentions: Mention[] }) {
  const total = analytics.sentiment.positive + analytics.sentiment.neutral + analytics.sentiment.negative + analytics.sentiment.mixed || 1;
  const positivePct = analytics.sentiment.positive / total * 100;
  const neutralPct = analytics.sentiment.neutral / total * 100;
  const negativePct = analytics.sentiment.negative / total * 100;
  const maxWord = Math.max(1, ...analytics.words.map((item) => item.count));
  const maxDay = Math.max(1, ...analytics.timeline.map((item) => item.total));
  const selectedIds = new Set(mentions.map((item) => item.id));
  const visibleSentiment = mentions.reduce((acc, item) => { const key = item.sentiment === "正面" ? "positive" : item.sentiment === "负面" ? "negative" : item.sentiment === "混合" ? "mixed" : "neutral"; acc[key] += 1; return acc; }, { positive: 0, neutral: 0, negative: 0, mixed: 0 });
  const visibleCommentSentiment = mentions.reduce((acc, item) => { acc.positive += item.comment_positive_count ?? 0; acc.neutral += item.comment_neutral_count ?? 0; acc.negative += item.comment_negative_count ?? 0; acc.mixed += item.comment_mixed_count ?? 0; return acc; }, { positive: 0, neutral: 0, negative: 0, mixed: 0 });
  const visibleComments = visibleCommentSentiment.positive + visibleCommentSentiment.neutral + visibleCommentSentiment.negative + visibleCommentSentiment.mixed;
  const commentPositivePct = visibleComments ? visibleCommentSentiment.positive / visibleComments * 100 : 0;
  const commentNeutralPct = visibleComments ? visibleCommentSentiment.neutral / visibleComments * 100 : 0;
  const commentNegativePct = visibleComments ? visibleCommentSentiment.negative / visibleComments * 100 : 0;
  const visibleCommentWords = [...mentions.reduce((map, item) => { for (const keyword of parsedCommentKeywords(item.comment_keywords)) map.set(keyword.word, (map.get(keyword.word) ?? 0) + keyword.count); return map; }, new Map<string, number>()).entries()]
    .map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 45);
  const maxCommentWord = Math.max(1, ...visibleCommentWords.map((item) => item.count));
  const visibleEmotions = [...mentions.reduce((map, item) => { const label = item.emotion || "中性陈述"; map.set(label, (map.get(label) ?? 0) + 1); return map; }, new Map<string, number>()).entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const maxEmotion = Math.max(1, ...visibleEmotions.map((item) => item.count));
  void selectedIds;
  return <div className="analysis-grid">
    <section className="surface sentiment-card"><div className="section-head"><div><p className="eyebrow">SENTIMENT DISTRIBUTION</p><h3>情绪结构</h3></div><span className="count-chip">{mentions.length}</span></div><div className="sentiment-layout"><div className="sentiment-donut" style={{ "--positive": positivePct, "--neutral": neutralPct, "--negative": negativePct } as CSSProperties}><div><strong>{Math.round((analytics.sentiment.positive - analytics.sentiment.negative) / total * 100)}</strong><span>净情绪指数</span></div></div><div className="sentiment-legend">{[["正面", visibleSentiment.positive, "positive"], ["中性", visibleSentiment.neutral, "neutral"], ["负面", visibleSentiment.negative, "negative"], ["混合", visibleSentiment.mixed, "mixed"]].map(([label, count, tone]) => <div key={String(label)}><i className={String(tone)} /><span>{label}</span><strong>{count}</strong></div>)}</div></div></section>
    <section className="surface emotion-spectrum-card"><div className="section-head"><div><p className="eyebrow">EMOTION SPECTRUM</p><h3>具体情绪与意图</h3></div><span className="subtle-note">不止正面 / 负面</span></div><div className="emotion-spectrum">{visibleEmotions.map((item) => <article key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.count / maxEmotion * 100}%` }} /></i><strong>{item.count}</strong></article>)}</div></section>
    <section className="surface wordcloud-card"><div className="section-head"><div><p className="eyebrow">KEYWORD CLOUD</p><h3>高频议题词云</h3></div><span className="subtle-note">已排除品牌名与常见停用词</span></div><div className="word-cloud">{analytics.words.map((item, index) => <span key={item.word} className={index < 6 ? "hot" : ""} style={{ fontSize: `${11 + item.count / maxWord * 25}px`, opacity: .5 + item.count / maxWord * .5 }} title={`${item.count} 次`}>{item.word}<sup>{item.count}</sup></span>)}</div></section>
    <section className="surface sentiment-card comment-sentiment-card"><div className="section-head"><div><p className="eyebrow">PUBLIC COMMENT SENTIMENT</p><h3>评论区情绪</h3></div><span className="count-chip">{visibleComments} 条实采样本</span></div>{visibleComments ? <div className="sentiment-layout"><div className="sentiment-donut" style={{ "--positive": commentPositivePct, "--neutral": commentNeutralPct, "--negative": commentNegativePct } as CSSProperties}><div><strong>{Math.round((visibleCommentSentiment.positive - visibleCommentSentiment.negative) / visibleComments * 100)}</strong><span>评论净情绪指数</span></div></div><div className="sentiment-legend">{[["正面", visibleCommentSentiment.positive, "positive"], ["中性", visibleCommentSentiment.neutral, "neutral"], ["负面", visibleCommentSentiment.negative, "negative"], ["混合", visibleCommentSentiment.mixed, "mixed"]].map(([label, count, tone]) => <div key={String(label)}><i className={String(tone)} /><span>{label}</span><strong>{count}</strong></div>)}</div></div> : <div className="comment-empty">等待取得公开评论文本后生成结论；页面显示的评论总数不会被冒充为已分析样本。</div>}</section>
    <section className="surface wordcloud-card comment-wordcloud-card"><div className="section-head"><div><p className="eyebrow">COMMENT KEYWORD CLOUD</p><h3>评论区关键词词云</h3></div><span className="subtle-note">仅基于实际取得的公开评论</span></div>{visibleCommentWords.length ? <div className="word-cloud">{visibleCommentWords.map((item, index) => <span key={item.word} className={index < 6 ? "hot" : ""} style={{ fontSize: `${11 + item.count / maxCommentWord * 25}px`, opacity: .5 + item.count / maxCommentWord * .5 }} title={`${item.count} 次`}>{item.word}<sup>{item.count}</sup></span>)}</div> : <div className="comment-empty">暂无可用于词频统计的公开评论文本</div>}</section>
    <section className="surface trend-card"><div className="section-head"><div><p className="eyebrow">30-DAY VOLUME</p><h3>报道量与负面走势</h3></div></div><div className="trend-chart">{analytics.timeline.map((day) => <div key={day.date} title={`${day.date}：${day.total} 篇，其中负面 ${day.negative} 篇`}><div className="bar-stack" style={{ height: `${Math.max(4, day.total / maxDay * 100)}%` }}><i className="negative" style={{ height: `${day.total ? day.negative / day.total * 100 : 0}%` }} /></div><span>{day.date.slice(5)}</span></div>)}</div></section>
    <section className="surface source-rank"><div className="section-head"><div><p className="eyebrow">SOURCE CONCENTRATION</p><h3>媒体来源排行</h3></div></div><div className="rank-list">{analytics.sources.map((source, index) => <article key={source.source}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{source.source}</strong><small>{source.country}</small></div><i><b style={{ width: `${source.count / Math.max(1, analytics.sources[0]?.count ?? 1) * 100}%` }} /></i><em>{source.count}</em></article>)}</div></section>
    <section className="surface country-analysis"><div className="section-head"><div><p className="eyebrow">MARKET BREAKDOWN</p><h3>国家 / 地区舆情结构</h3></div></div><div className="country-analysis-table"><div className="country-analysis-head"><span>地区</span><span>报道</span><span>正 / 中 / 负</span><span>最高风险</span><span>公开互动</span></div>{analytics.countries.map((item) => <div key={item.country}><strong><i>{countryCode[item.country] ?? "GL"}</i>{item.country}</strong><b>{item.count}</b><span><em className="positive">{item.positive}</em> / {item.neutral} / <em className="negative">{item.negative}</em></span><span className={`risk-score ${riskClass(item.risk)}`}>{item.risk}</span><span>{item.engagement.toLocaleString()}</span></div>)}</div></section>
  </div>;
}

function SocialCommentsView({ brand, monidConfigured }: { brand: BrandProfile; monidConfigured: boolean }) {
  const [data, setData] = useState<SocialCommentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("30");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("newest");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [postId, setPostId] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(draftQuery.trim()); setPage(1); }, 280);
    return () => window.clearTimeout(timer);
  }, [draftQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ range, sort, page: String(page) });
    if (tone) params.set("sentiment", tone);
    if (platform) params.set("platform", platform);
    if (query) params.set("query", query);
    if (postId) params.set("post", String(postId));
    fetch(`/api/comments?${params}`, { signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "评论数据加载失败");
      setData(payload as SocialCommentsData); setError("");
    }).catch((reason) => { if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "评论数据加载失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, platform, postId, query, range, sort, tone]);

  const summary = data?.summary ?? { total: 0, authors: 0, likes: 0, replies: 0, positive: 0, neutral: 0, negative: 0, mixed: 0, average_score: 0, reported: 0, collected: 0, coverage: 0 };
  const sentimentTotal = Math.max(1, summary.positive + summary.neutral + summary.negative + summary.mixed);
  const positivePct = summary.positive / sentimentTotal * 100;
  const neutralPct = summary.neutral / sentimentTotal * 100;
  const negativePct = summary.negative / sentimentTotal * 100;
  const maxDay = Math.max(1, ...(data?.timeline ?? []).map((item) => Number(item.total)));
  const maxWord = Math.max(1, ...(data?.words ?? []).map((item) => Number(item.count)));
  const maxTopic = Math.max(1, ...(data?.topics ?? []).map((item) => Number(item.count)));
  const netSentiment = summary.total ? Math.round((summary.positive - summary.negative) / summary.total * 100) : 0;
  const targetStatus = (value: string) => ({
    complete: "已完成", empty: "无公开评论", unavailable: "平台未开放", blocked: "权限或预算受限",
    running: "请求中", queued: "排队中", retrying: "等待重试", collecting: "抓取回复中", error: "采集失败",
  }[value] ?? "待识别");
  function resetPage(value: (next: string) => void, next: string) { value(next); setPage(1); }

  return <div className="comments-page">
    <section className="comment-hero panel-dark">
      <div><p className="eyebrow">COMMENT INTELLIGENCE</p><h2>{brand.name} 评论舆情</h2><p>社交平台帖子和网页新闻的公开评论会被统一归档，再按具体情绪、主题、时间、来源和参与者交叉分析。</p></div>
      <div className="comment-collection-state"><span className={monidConfigured ? "online" : "offline"} /><div><small>MONID COMMENT PIPELINE</small><strong>{!monidConfigured ? "尚未配置" : !data?.targets.length ? "等待建立帖子目标" : data.targets.some((item) => ["running", "queued", "retrying", "collecting"].includes(item.status)) ? "持续采集中" : data.targets.some((item) => ["blocked", "unavailable", "error"].includes(item.status)) ? "部分帖子受限" : "当前队列已完成"}</strong><em>{summary.collected.toLocaleString()} / {summary.reported.toLocaleString()} 条已归档 · {summary.coverage}%</em></div></div>
    </section>

    <section className="comment-kpis surface">
      <Metric label="已归档评论" value={summary.total.toLocaleString()} note="当前筛选范围内的真实文本" />
      <Metric label="独立参与者" value={summary.authors.toLocaleString()} note="按公开账号 ID 去重" />
      <Metric label="净情绪指数" value={`${netSentiment > 0 ? "+" : ""}${netSentiment}`} note="正面占比减负面占比" danger={netSentiment < -15} />
      <Metric label="负面占比" value={`${Math.round(summary.negative / Math.max(1, summary.total) * 100)}%`} note={`${summary.negative.toLocaleString()} 条负面评论`} danger={summary.negative > summary.total * .2} />
      <Metric label="评论互动" value={(summary.likes + summary.replies).toLocaleString()} note="评论获赞与回复合计" />
    </section>

    {!monidConfigured && <section className="comment-callout surface"><strong>社媒评论采集尚未启动</strong><p>网页新闻公开评论仍会持续检查；在“来源覆盖”配置 Monid 后，将为 Instagram、X、YouTube、TikTok、Facebook 相关帖子建立评论任务。</p></section>}
    {error && <section className="comment-callout error surface"><strong>读取评论舆情失败</strong><p>{error}</p></section>}

    <div className="comment-intelligence-grid">
      <section className="surface sentiment-card"><div className="section-head"><div><p className="eyebrow">COMMENT SENTIMENT</p><h3>评论情绪结构</h3></div><span className="count-chip">{summary.total}</span></div><div className="sentiment-layout"><div className="sentiment-donut" style={{ "--positive": positivePct, "--neutral": neutralPct, "--negative": negativePct } as CSSProperties}><div><strong>{netSentiment}</strong><span>净情绪指数</span></div></div><div className="sentiment-legend">{[["正面", summary.positive, "positive"], ["中性", summary.neutral, "neutral"], ["负面", summary.negative, "negative"], ["混合", summary.mixed, "mixed"]].map(([label, count, value]) => <div key={String(label)}><i className={String(value)} /><span>{label}</span><strong>{Number(count).toLocaleString()}</strong></div>)}</div></div></section>
      <section className="surface emotion-spectrum-card"><div className="section-head"><div><p className="eyebrow">COMMENT EMOTIONS</p><h3>具体情绪与行动意图</h3></div></div><div className="emotion-spectrum">{data?.emotions.map((item) => <article key={item.label}><span>{item.label}</span><i><b style={{ width: `${Number(item.count) / Math.max(1, ...(data?.emotions ?? []).map((entry) => Number(entry.count))) * 100}%` }} /></i><strong>{Number(item.count).toLocaleString()}</strong></article>)}{!data?.emotions.length && <div className="comment-empty compact">暂无评论样本</div>}</div></section>
      <section className="surface comment-topic-card"><div className="section-head"><div><p className="eyebrow">DISCUSSION THEMES</p><h3>核心议题</h3></div></div><div className="comment-topic-list">{data?.topics.map((item) => <article key={item.topic}><div><strong>{item.topic}</strong><span>{item.count} 条 · {item.negative ? `${Math.round(item.negative / item.count * 100)}% 负面` : "无负面"}</span></div><i><b style={{ width: `${item.count / maxTopic * 100}%` }} /></i></article>)}{!data?.topics.length && <div className="comment-empty compact">暂无评论样本</div>}</div></section>
      <section className="surface comment-trend-card"><div className="section-head"><div><p className="eyebrow">CONVERSATION VOLUME</p><h3>评论量与负面走势</h3></div><span className="subtle-note">{range === "0" ? "全部历史" : `过去 ${range} 天`}</span></div><div className="comment-trend">{data?.timeline.map((day) => <div key={day.date} title={`${day.date}：${day.total} 条，负面 ${day.negative} 条`}><span><b style={{ height: `${Math.max(4, day.total / maxDay * 100)}%` }}><i style={{ height: `${day.total ? day.negative / day.total * 100 : 0}%` }} /></b></span><small>{day.date.slice(5)}</small></div>)}</div>{!data?.timeline.length && <div className="comment-empty compact">等待形成时间序列</div>}</section>
      <section className="surface comment-cloud-card"><div className="section-head"><div><p className="eyebrow">MEANINGFUL TERMS</p><h3>评论高频词云</h3></div><span className="subtle-note">中英文分词 · 已过滤虚词</span></div>{data?.words.length ? <div className="word-cloud">{data.words.map((item, index) => <span key={item.word} className={index < 6 ? "hot" : ""} style={{ fontSize: `${11 + item.count / maxWord * 25}px`, opacity: .5 + item.count / maxWord * .5 }} title={`${item.count} 次`}>{item.word}<sup>{item.count}</sup></span>)}</div> : <div className="comment-empty">暂无可统计的有效词</div>}</section>
    </div>

    <section className="surface top-posts-card"><div className="section-head"><div><p className="eyebrow">TOP POSTS</p><h3>讨论最集中的帖子</h3></div></div><div className="comment-rank-list">{data?.topPosts.map((item, index) => <button key={item.mention_id} className={postId === item.mention_id ? "active" : ""} onClick={() => { setPostId(postId === item.mention_id ? 0 : item.mention_id); setPage(1); }}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.source} · {item.comments} 条 · {item.negative} 条负面</small></div><em>{item.likes.toLocaleString()} 赞</em></button>)}</div></section>

    <section className="surface comment-feed-card">
      <div className="comment-feed-heading"><div><p className="eyebrow">COMMENT ARCHIVE</p><h3>评论明细档案</h3></div><div className="comment-feed-filters"><input aria-label="搜索评论" placeholder="搜索评论、账号或帖子" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} /><select value={range} onChange={(event) => resetPage(setRange, event.target.value)}><option value="1">24 小时</option><option value="7">7 天</option><option value="30">30 天</option><option value="0">全部历史</option></select><select value={platform} onChange={(event) => resetPage(setPlatform, event.target.value)}><option value="">全部平台</option><option>网页新闻</option><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>X</option><option>YouTube</option></select><select value={tone} onChange={(event) => resetPage(setTone, event.target.value)}><option value="">全部极性</option><option>正面</option><option>中性</option><option>负面</option><option>混合</option></select><select value={sort} onChange={(event) => resetPage(setSort, event.target.value)}><option value="newest">最新发布</option><option value="liked">获赞最多</option><option value="risk">风险优先</option></select>{postId > 0 && <button onClick={() => { setPostId(0); setPage(1); }}>清除帖子筛选 ×</button>}</div></div>
      <div className="comment-card-grid">{loading && !data ? <div className="comment-empty">正在读取评论档案…</div> : data?.comments.map((comment) => <article className="comment-archive-card" key={comment.id}><header><div className="comment-author"><strong>{comment.author_username ? `@${comment.author_username}` : comment.author_name || "公开账号"}{comment.is_verified ? " ✓" : ""}</strong><small>{formatDate(comment.published_at, true)} · {comment.language}{comment.parent_comment_id ? " · 回复" : ""}</small></div><span className={`sentiment-pill ${sentimentClass(comment.sentiment)}`}>{comment.sentiment}</span></header><p>{comment.content}</p><div className="comment-card-analysis"><span className="emotion-pill">{comment.emotion || "中性陈述"}</span><small>{comment.topic} · 情绪分 {comment.sentiment_score > 0 ? `+${comment.sentiment_score}` : comment.sentiment_score}</small></div><footer><a href={comment.comment_url || comment.post_url} target="_blank" rel="noreferrer">{comment.post_title}</a><span>{comment.platform} · ♥ {comment.likes.toLocaleString()} · ↳ {comment.replies.toLocaleString()}</span></footer></article>)}{!loading && !data?.comments.length && <div className="comment-empty">当前筛选条件下没有评论。</div>}</div>
      <div className="comment-pagination"><span>共 {data?.pagination.total ?? 0} 条 · 第 {data?.pagination.page ?? page} / {data?.pagination.pages ?? 1} 页</span><div><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><button disabled={page >= (data?.pagination.pages ?? 1) || loading} onClick={() => setPage((value) => value + 1)}>下一页</button></div></div>
    </section>

    <section className="surface risk-queue"><div className="section-head"><div><p className="eyebrow">RISK REVIEW QUEUE</p><h3>负面与混合情绪复核</h3></div><span className="subtle-note">按情绪分与互动量排序</span></div><div>{data?.riskComments.map((comment) => <article key={comment.id}><header><span className={`sentiment-pill ${sentimentClass(comment.sentiment)}`}>{comment.sentiment}</span><strong>{comment.likes} 赞</strong></header><p>{comment.content}</p><a href={comment.post_url} target="_blank" rel="noreferrer">{comment.post_title} ↗</a></article>)}{!data?.riskComments.length && <div className="comment-empty compact">暂无需要复核的高风险评论</div>}</div></section>

    <section className="surface comment-progress-card"><div className="section-head"><div><p className="eyebrow">COLLECTION COVERAGE</p><h3>帖子评论抓取进度</h3></div><span className="count-chip">{data?.targets.length ?? 0} 个帖子</span></div><div className="comment-progress-list">{data?.targets.map((target) => { const terminal = ["complete", "empty", "unavailable"].includes(target.status); const pct = target.reported_count ? Math.min(100, Math.round(target.collected_count / target.reported_count * 100)) : terminal ? 100 : 0; return <article key={target.mention_id}><div><a href={target.mention_url} target="_blank" rel="noreferrer">{target.post_title}</a><small>{target.post_source} · 已请求 {target.pages_fetched} 页{target.last_error ? ` · ${target.last_error}` : ""}</small></div><span><i><b style={{ width: `${pct}%` }} /></i><em>{target.collected_count} / {target.reported_count || "?"}</em></span><strong className={target.status}>{targetStatus(target.status)}</strong></article>; })}{!data?.targets.length && <div className="comment-empty compact">发现带评论的相关帖子后，这里会显示逐帖采集进度。</div>}</div></section>
  </div>;
}

function CoverageView({ connectors, sources, submit, canManage }: { connectors: Connector[]; sources: MediaSource[]; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown>; canManage: boolean }) {
  const active = sources.filter((item) => item.status === "active").length;
  const [editing, setEditing] = useState<string | null>(null);
  const [credential, setCredential] = useState("");
  const [secondaryCredential, setSecondaryCredential] = useState("");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const configurable = connectors.filter((item) => item.configurable && item.provider);
  function openCredential(provider: string) { if (!canManage) return; setEditing(provider); setCredential(""); setSecondaryCredential(""); setAccountId(""); }
  async function saveCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing || !credential.trim()) return; setBusy(true);
    const value = editing === "Meta / Instagram" ? JSON.stringify({ accessToken: credential.trim(), accountId: accountId.trim() })
      : editing === "TikTok" ? JSON.stringify({ clientKey: credential.trim(), clientSecret: secondaryCredential.trim() }) : credential.trim();
    const lastFour = editing === "TikTok" ? secondaryCredential.slice(-4) : credential.slice(-4);
    try { await submit({ action: "saveConnectorCredential", provider: editing, credential: value, lastFour }, `${editing} API 配置已加密保存`); setCredential(""); setSecondaryCredential(""); setAccountId(""); setEditing(null); }
    finally { setBusy(false); }
  }
  async function removeCredential(provider: string) { setBusy(true); try { await submit({ action: "deleteConnectorCredential", provider }, `${provider} 的团队 API 配置已删除`); } finally { setBusy(false); } }
  return <div className="coverage-page">
    <section className="coverage-architecture panel-dark"><div><h2>采集计划</h2><p>新闻与免费来源持续归档；一个 Monid 凭证连接 Instagram、X、YouTube、TikTok、Facebook，并采集可公开取得的帖子评论与回复。网页新闻评论区也进入同一分析页。</p></div><div className="architecture-flow"><article><b>01</b><strong>全球与社媒发现</strong><span>NewsAPI.ai / GDELT / Monid</span><small>每 6 小时 / 每日</small></article><i>→</i><article><b>02</b><strong>来源库</strong><span>{sources.length} 个媒体域名</span><small>自动更新</small></article><i>→</i><article><b>03</b><strong>持续追踪</strong><span>新闻 / 帖子 / 评论回复</span><small>后台异步归档</small></article></div></section>
    <section className="surface connector-section"><div className="section-head"><div><p className="eyebrow">CONNECTOR STATUS</p><h3>采集连接器</h3></div></div><div className="connector-grid">{connectors.map((connector) => <article key={connector.id}><div><i className={connector.status} /><strong>{connector.name}</strong><span className={`connector-state ${connector.status}`}>{connector.status === "limited" ? "暂缓重试" : connector.status === "online" && connector.pending ? "采集中" : connector.status === "online" ? "运行中" : connector.status === "credentials" ? "待凭证" : connector.configured ? "凭证已存 / 待权限" : "需授权"}</span></div><p>{connector.detail}</p>{connector.configurable && connector.provider && <button className="connector-config-button" disabled={!canManage} onClick={() => openCredential(connector.provider!)}>{connector.configured ? `已配置 · ${connector.lastFour === "环境密钥" ? "站点默认密钥" : `•••• ${connector.lastFour}`}` : canManage ? "＋ 配置团队 API" : "管理员可配置"}</button>}</article>)}</div></section>
    <section className="surface credential-vault"><div className="vault-copy"><p className="eyebrow">TEAM API VAULT</p><h3>团队数据连接器</h3><p>管理员只需配置一次 NewsAPI.ai、Monid、X、YouTube、Meta / Instagram 与 TikTok 凭证，所有成员查看同一批采集结果。凭证由服务端加密，完整值不会返回任何成员的浏览器。</p><div className="vault-security"><span>✓ 团队共用采集结果</span><span>✓ 服务端加密</span><span>✓ 仅管理员可更换</span></div></div><div className="credential-list">{configurable.map((connector) => <article key={connector.id}><div><i className={connector.configured ? "configured" : ""} /><div><strong>{connector.name}</strong><small>{connector.configured ? connector.lastFour === "环境密钥" ? "当前使用站点默认密钥" : `团队密钥 •••• ${connector.lastFour}` : "尚未配置团队密钥"}</small></div></div><div><button disabled={!canManage} onClick={() => openCredential(connector.provider!)}>{connector.configured ? "更换" : "配置"}</button>{canManage && connector.configured && connector.lastFour !== "环境密钥" && <button className="danger-link" disabled={busy} onClick={() => void removeCredential(connector.provider!)}>删除</button>}</div></article>)}</div></section>
    {editing && canManage && <div className="credential-modal-backdrop" onMouseDown={() => setEditing(null)}><form className="credential-modal" onSubmit={saveCredential} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-head"><div><p className="eyebrow">SECURE CONNECTOR SETUP</p><h3>配置 {editing}</h3></div><button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button></div>
      <p>{editing === "Monid / Instagram" ? "一个密钥启用 Instagram、X、YouTube、TikTok、Facebook 的普通文字关键词搜索，以及各平台可公开取得的帖子评论与回复采集。保存时会先验证密钥。" : editing === "Meta / Instagram" ? "用于采集 Business / Creator 账号的标签与 @提及；启用仍取决于 Meta 权限和 App Review。" : editing === "TikTok" ? "用于 TikTok Research API 的公开内容查询；启用仍取决于 Research API 审批。" : `输入你自己的 ${editing === "X" ? "Bearer Token" : "API Key"}。`} 保存后仅服务端可以解密使用。</p>
      {editing === "Monid / Instagram" && <a className="credential-help-link" href="https://app.monid.ai/access/api-keys" target="_blank" rel="noreferrer">前往 Monid 创建 API Key ↗</a>}
      {editing === "Meta / Instagram" && <label className="field"><span>Instagram Business / Creator Account ID</span><input autoComplete="off" autoFocus required value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="Instagram Account ID" /></label>}
      <label className="field"><span>{editing === "Monid / Instagram" ? "Monid API Key" : editing === "Meta / Instagram" ? "Long-lived Access Token" : editing === "TikTok" ? "Client Key" : editing === "X" ? "Bearer Token" : "API Key"}</span><input type="password" autoComplete="off" autoFocus={editing !== "Meta / Instagram"} required value={credential} onChange={(event) => setCredential(event.target.value)} placeholder={editing === "Monid / Instagram" ? "monid_live_…" : "粘贴凭证"} /></label>
      {editing === "TikTok" && <label className="field"><span>Client Secret</span><input type="password" autoComplete="off" required value={secondaryCredential} onChange={(event) => setSecondaryCredential(event.target.value)} placeholder="粘贴 Client Secret" /></label>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>取消</button><button className="primary-button" disabled={busy || !credential.trim() || (editing === "Meta / Instagram" && !accountId.trim()) || (editing === "TikTok" && !secondaryCredential.trim())}>{busy ? "验证并保存中…" : "验证并安全保存"}</button></div>
    </form></div>}
    <section className="surface sources-section"><div className="section-head"><div><p className="eyebrow">OWNED MEDIA SOURCE LIBRARY</p><h3>免费媒体来源库</h3></div><div className="source-summary"><strong>{active}</strong> 活跃 / {sources.length} 已发现</div></div><div className="table-scroll"><table className="source-table"><thead><tr><th>媒体 / 域名</th><th>地区</th><th>语言</th><th>追踪协议</th><th>状态</th><th>最后抓取</th><th>下次计划</th></tr></thead><tbody>{sources.map((source) => <tr key={source.id}><td><strong>{source.name}</strong><a href={source.homepage_url} target="_blank" rel="noreferrer">{source.domain} ↗</a></td><td>{source.country}</td><td>{source.language}</td><td>{source.feed_url ? "RSS / Atom" : source.sitemap_url ? "News Sitemap" : "自动探测"}</td><td><span className={`source-status ${source.status}`}>{source.status === "active" ? "活跃" : source.status === "watching" ? "监看" : source.status === "error" ? "重试" : "已发现"}</span></td><td>{formatDate(source.last_crawled_at)}</td><td>{formatDate(source.next_crawl_at)}</td></tr>)}</tbody></table></div>{!sources.length && <div className="empty-table">首次全球发现完成后，媒体来源会自动进入这里，无需手动添加。</div>}</section>
  </div>;
}

function SettingsView({ brand, connectors, entities, workspace, submit }: { brand: BrandProfile; connectors: Connector[]; entities: Entity[]; workspace: TeamWorkspace; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const monidConfigured = connectors.some((item) => item.provider === "Monid / Instagram" && item.configured);
  const officialSocialConfigured = connectors.some((item) => ["Meta / Instagram", "TikTok"].includes(item.provider ?? "") && item.configured);
  async function handleEntitySubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; await submit({ action: "addEntity", ...Object.fromEntries(new FormData(form).entries()) }, "监测词已加入团队词典"); form.reset(); }
  async function removeEntity(item: Entity) { if (!window.confirm(`确认删除词条“${item.value}”？`)) return; await submit({ action: "deleteEntity", id: item.id }, "词条已从团队词典删除"); }
  async function handleBrandSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await submit({ action: "saveBrandProfile", ...Object.fromEntries(new FormData(event.currentTarget).entries()) }, "团队品牌监测档案已更新"); }
  return <div className="settings-page">
    <TeamWorkspacePanel workspace={workspace} submit={submit} />
    <div className="settings-grid">
      <section className="surface settings-main"><div className="section-head"><div><p className="eyebrow">BRAND PROFILE</p><h3>团队品牌监测档案与同名消歧</h3></div><span className="permission-chip">{workspace.canManage ? "管理员可编辑" : "仅管理员可修改"}</span></div><form className="brand-settings-form" onSubmit={handleBrandSubmit}><label className="field"><span>品牌名称</span><input disabled={!workspace.canManage} name="brandName" required defaultValue={brand.name} /></label><label className="field"><span>官网域名</span><input disabled={!workspace.canManage} name="website" defaultValue={brand.website} placeholder="brand.com" /></label><label className="field full"><span>品牌别名（每行一个）</span><textarea disabled={!workspace.canManage} name="aliases" rows={3} defaultValue={brand.aliases} /></label><label className="field"><span>匹配模式</span><select disabled={!workspace.canManage} name="matchMode" defaultValue={brand.match_mode || "precise"}><option value="precise">精准：品牌词 + 身份锚点</option><option value="balanced">平衡：长品牌名可单独命中</option><option value="broad">宽泛：仅品牌词即可</option></select></label><label className="field"><span>官方社媒账号</span><textarea disabled={!workspace.canManage} name="officialAccounts" rows={3} defaultValue={brand.official_accounts} placeholder={'每行一个，例如：@brand_official'} /></label><label className="field full"><span>身份锚点</span><textarea disabled={!workspace.canManage} name="scopeTerms" rows={4} defaultValue={brand.scope_terms} placeholder={'每行一个：产品名、创始人、核心技术、独特口号、行业定位'} /><small>精准模式下，候选内容必须同时出现品牌名/别名和至少一个锚点；官网或官方账号内容直接通过。</small></label><label className="field full"><span>排除词</span><textarea disabled={!workspace.canManage} name="excludeTerms" rows={3} defaultValue={brand.exclude_terms} placeholder={'每行一个：同名公司的行业、产品、城市或人名'} /></label>{workspace.canManage && <button className="secondary-button">保存定位规则</button>}</form><p className="form-warning">这套定位规则、历史档案、事件、传播链路和分析结果由整个团队共同使用。</p>
        <div className="section-head entity-heading"><div><p className="eyebrow">ENTITY DICTIONARY</p><h3>团队扩展监测词典</h3></div><span className="count-chip">{entities.length}</span></div>{workspace.canEdit && <form className="inline-form" onSubmit={handleEntitySubmit}><select name="type" defaultValue="关键词"><option>公司</option><option>产品</option><option>人物</option><option>关键词</option><option>事件指纹</option><option>排除词</option></select><input name="value" required placeholder="输入产品、人物、别名或排除词" /><select name="language" defaultValue="通用"><option>通用</option><option>英文</option><option>简体中文</option><option>繁体中文</option><option>泰语</option><option>日语</option></select><button className="primary-button">添加</button></form>}<div className="entity-list">{entities.map((item) => { const core = ["品牌", "别名", "官网域名"].includes(item.type); return <div key={item.id}><span>{item.type}</span><strong>{item.value}</strong><small>{item.language}</small><i>启用</i>{workspace.canEdit && (core ? <em title="请在上方品牌档案中修改">档案管理</em> : <button type="button" onClick={() => void removeEntity(item)} aria-label={`删除词条 ${item.value}`}>删除</button>)}</div>; })}</div>
      </section>
      <aside className="surface automation-card"><div className="section-head"><div><p className="eyebrow">AUTOMATION POLICY</p><h3>团队自动运行策略</h3></div></div>{[["共享数据", `${workspace.members.length} 位成员读取同一品牌、档案、事件与分析`, true], ["调度巡检", "Cloudflare 每小时第 17 分钟触发", true], ["全球发现", "NewsAPI.ai 每 6 小时；GDELT 每日兜底", true], ["多平台公开搜索", monidConfigured ? "Monid 每 6 小时搜索五个平台" : "由管理员在来源覆盖页配置 Monid", monidConfigured], ["评论与回复", monidConfigured ? "社媒与网页新闻公开评论统一归档" : "网页评论持续运行；社媒评论待配置", true], ["精准品牌匹配", "同一套身份锚点在入库前过滤", true], ["传播链路", "团队共享同一事件图谱", true], ["Meta / TikTok 官方接口", officialSocialConfigured ? "团队凭证已保存" : "可选配置", officialSocialConfigured]].map(([title, note, on]) => <div className="policy-row" key={String(title)}><div><strong>{title}</strong><small>{note}</small></div><span className={on ? "toggle on" : "toggle"}><i /></span></div>)}<div className="connector-mini">{connectors.map((item) => <div key={item.id}><span>{item.name}</span><strong>{item.status === "limited" ? "暂缓重试" : item.pending ? "采集中" : item.status === "online" ? "运行中" : item.configured ? "凭证已存" : "待接入"}</strong></div>)}</div></aside>
    </div>
  </div>;
}

function TeamWorkspacePanel({ workspace, submit }: { workspace: TeamWorkspace; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true);
    try { await submit({ action: "inviteWorkspaceMembers", ...Object.fromEntries(new FormData(form).entries()) }, "邀请名单已保存；同事用对应邮箱登录后会自动进入此工作区"); form.reset(); }
    finally { setBusy(false); }
  }
  return <section className="surface team-workspace-card">
    <div className="team-workspace-head"><div><p className="eyebrow">SHARED TEAM WORKSPACE</p><h2>{workspace.name}</h2><p>成员登录后直接读取同一品牌配置、历史档案、事件聚类、传播链路、评论分析和连接器采集结果，无需重新配置或重新跑流程。</p></div><div className="team-workspace-stat"><strong>{workspace.members.length}</strong><span>已加入成员</span><small>你的权限：{roleLabel(workspace.role)}</small></div></div>
    {workspace.canManage && <form className="team-invite-form" onSubmit={invite}><label className="field"><span>邀请同事邮箱</span><textarea name="emails" rows={3} required placeholder={'每行一个邮箱。必须与同事登录 ChatGPT 时使用的邮箱一致。'} /></label><label className="field"><span>加入后的权限</span><select name="role" defaultValue="editor"><option value="editor">编辑者：可巡检、补录和维护词典</option><option value="viewer">查看者：只读全部档案与分析</option></select></label><button className="primary-button" disabled={busy}>{busy ? "保存邀请中…" : "添加到团队"}</button></form>}
    <div className="team-member-list"><div className="team-member-head"><span>成员</span><span>权限</span><span>状态</span><span /></div>{workspace.members.map((member) => <article key={member.user_id}><div className="member-identity"><b>{(member.display_name || member.email).slice(0, 1).toUpperCase()}</b><div><strong>{member.display_name || member.email}</strong><small>{member.email}</small></div></div><span className="role-pill">{roleLabel(member.role)}</span><span className="member-status"><i /> 已加入</span><div>{workspace.canManage && member.role !== "owner" && <button disabled={busy} onClick={() => void submit({ action: "removeWorkspaceMember", userId: member.user_id }, "成员已移出工作区")}>移除</button>}</div></article>)}</div>
    {workspace.canManage && workspace.invites.length > 0 && <div className="pending-invites"><div className="section-head"><div><p className="eyebrow">PENDING</p><h3>等待首次登录</h3></div><span className="count-chip">{workspace.invites.length}</span></div>{workspace.invites.map((inviteRow) => <article key={inviteRow.id}><div><strong>{inviteRow.email}</strong><small>{roleLabel(inviteRow.role)} · 有效至 {formatDate(inviteRow.expires_at, true)}</small></div><button disabled={busy} onClick={() => void submit({ action: "revokeWorkspaceInvite", id: inviteRow.id }, "邀请已撤销")}>撤销</button></article>)}</div>}
  </section>;
}
