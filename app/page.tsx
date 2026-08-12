"use client";

import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from "react";

type Mention = {
  id: number; title: string; url: string; source: string; platform: string; source_country: string; content_country: string;
  language: string; sentiment: string; risk: number; impact: number; summary: string; cluster_key: string; parent_url: string;
  relation: string; engagement: number; excerpt: string; author: string; provider: string; discovered_via: string;
  content_hash: string; word_count: number; sentiment_score: number; topics: string; keywords: string; first_seen_at: string;
  archived_at: string; published_at: string; location_confidence: number; location_method: string;
};
type Entity = { id: number; type: string; value: string; language: string; active: number };
type Alert = { id: number; title: string; severity: string; country: string; reason: string; acknowledged: number; created_at: string };
type SyncRun = { id: number; provider: string; status: string; found_count: number; inserted_count: number; error: string; started_at: string; completed_at: string | null };
type BrandProfile = { id: number; name: string; aliases: string; website: string };
type Connector = { id: string; name: string; provider?: string; configurable?: boolean; configured?: boolean; lastFour?: string; status: "online" | "limited" | "credentials" | "approval"; detail: string; retryAt?: string };
type MediaSource = { id: number; domain: string; name: string; country: string; language: string; homepage_url: string; feed_url: string; sitemap_url: string; status: string; last_crawled_at: string; next_crawl_at: string; last_error: string };
type PropagationEdge = { id: number; cluster_key: string; from_mention_id: number; to_mention_id: number; similarity: number; confidence: number; method: string; evidence: string; time_gap_minutes: number; cross_border: number };
type CountryStat = { country: string; count: number; positive: number; neutral: number; negative: number; risk: number; engagement: number; latest: string };
type Analytics = {
  countries: CountryStat[];
  sentiment: { positive: number; neutral: number; negative: number; mixed: number };
  timeline: Array<{ date: string; total: number; positive: number; negative: number }>;
  words: Array<{ word: string; count: number }>;
  sources: Array<{ source: string; country: string; count: number; impact: number }>;
  crossBorderEdges: number;
  archivedTotal: number;
};
type DashboardData = {
  mentions: Mention[]; entities: Entity[]; alerts: Alert[]; syncRuns: SyncRun[]; brand: BrandProfile | null;
  connectors: Connector[]; mediaSources: MediaSource[]; propagationEdges: PropagationEdge[]; analytics: Analytics;
};
type StoryCluster = { key: string; items: Mention[]; title: string; risk: number; impact: number; countries: string[]; platforms: string[]; latest: string };

const emptyAnalytics: Analytics = { countries: [], sentiment: { positive: 0, neutral: 0, negative: 0, mixed: 0 }, timeline: [], words: [], sources: [], crossBorderEdges: 0, archivedTotal: 0 };
const emptyData: DashboardData = { mentions: [], entities: [], alerts: [], syncRuns: [], brand: null, connectors: [], mediaSources: [], propagationEdges: [], analytics: emptyAnalytics };
const nav = [
  ["overview", "情报总览", "01"], ["archive", "新闻档案", "02"], ["propagation", "传播链路", "03"],
  ["analytics", "舆情分析", "04"], ["coverage", "来源覆盖", "05"], ["settings", "品牌配置", "06"],
] as const;

const countryCode: Record<string, string> = {
  台湾: "TW", 香港: "HK", 泰国: "TH", 美国: "US", 日本: "JP", 全球: "GL", 中国: "CN", 新加坡: "SG", 英国: "GB",
  韩国: "KR", 加拿大: "CA", 澳大利亚: "AU", 德国: "DE", 法国: "FR", 印度: "IN", 意大利: "IT", 西班牙: "ES",
  印度尼西亚: "ID", 菲律宾: "PH", 越南: "VN", 马来西亚: "MY", 华语地区: "ZH", 地区待确认: "??", 地区未披露: "??",
};
const mapPosition: Record<string, [number, number]> = {
  美国: [17, 40], 加拿大: [15, 25], 英国: [44, 31], 法国: [46, 39], 德国: [49, 34], 西班牙: [43, 45], 意大利: [50, 43],
  中国: [76, 43], 香港: [80, 53], 台湾: [84, 48], 日本: [90, 39], 韩国: [84, 39], 泰国: [77, 61], 新加坡: [78, 71],
  马来西亚: [78, 68], 印度: [68, 56], 印度尼西亚: [81, 76], 菲律宾: [86, 63], 越南: [80, 59], 澳大利亚: [88, 82],
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
function discoveryLabel(value: string) { return value === "free_crawler" ? "免费追踪" : value === "official_api" ? "官方 API" : value === "manual" ? "人工证据" : "全球发现"; }
function gapLabel(minutes: number) { return minutes < 60 ? `${minutes} 分钟` : minutes < 1440 ? `${Math.round(minutes / 60)} 小时` : `${Math.round(minutes / 1440)} 天`; }

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

  async function syncNews(force = false, announce = false) {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "自动巡检失败");
      setData(result.data);
      if (announce) {
        const message = result.sync.skipped ? "系统刚完成过巡检，档案已是最新状态"
          : `巡检完成：全球发现与免费来源共发现 ${result.sync.found} 条，新增归档 ${result.sync.inserted} 条，追踪 ${result.sync.crawledSources ?? 0} 个媒体源`;
        setToast(message); window.setTimeout(() => setToast(""), 5200);
      }
    } catch (error) {
      setToast(`${error instanceof Error ? error.message : "自动巡检失败"}，系统会按退避策略重试`);
      window.setTimeout(() => setToast(""), 4500);
    } finally { setSyncing(false); }
  }

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const response = await fetch("/api/data");
        if (!response.ok) throw new Error("数据加载失败");
        const next = await response.json() as DashboardData;
        if (!cancelled) setData(next);
        if (next.brand) void syncNews(false, false);
      } catch { if (!cancelled) setToast("暂时无法读取情报档案，请稍后刷新"); }
      finally { if (!cancelled) setLoading(false); }
    }
    void bootstrap();
    const timer = window.setInterval(() => void syncNews(false, false), 60 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
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
        countries: [...new Set(items.map((item) => item.source_country))], platforms: [...new Set(items.map((item) => item.platform))], latest: ordered.at(-1)?.published_at ?? "" };
    }).sort((a, b) => b.items.length - a.items.length || b.impact - a.impact);
  }, [filteredMentions]);

  const activeAlerts = data.alerts.filter((item) => !item.acknowledged);
  const countries = ["全球", ...new Set(data.mentions.map((item) => item.source_country))];
  const platforms = ["全部平台", ...new Set(data.mentions.map((item) => item.platform))];
  const selected = clusters.find((item) => item.key === selectedCluster) ?? clusters.find((item) => item.items.length > 1) ?? clusters[0];
  const lastSync = data.syncRuns[0];
  const initials = data.brand?.name.split(/\s+/).map((item) => item[0]).join("").slice(0, 2).toUpperCase() || "BR";

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><div><strong>SIGNAL ATLAS</strong><small>GLOBAL MEDIA INTELLIGENCE</small></div></div>
      <nav aria-label="主要导航">{nav.map(([id, label, number]) => <button key={id} className={view === id ? "nav-item active" : "nav-item"} onClick={() => setView(id)}><span>{number}</span>{label}{id === "overview" && activeAlerts.length > 0 && <b>{activeAlerts.length}</b>}</button>)}</nav>
      <div className="system-card">
        <div className="system-title"><i /> 混合监测已运行</div>
        <div className="system-row"><span>调度巡检</span><strong>每小时 :17</strong></div>
        <div className="system-row"><span>全球发现</span><strong>6 小时 / 每日</strong></div>
        <div className="system-row"><span>免费单源</span><strong>活跃 3h / 探测 12h</strong></div>
        <div className="system-row"><span>媒体来源库</span><strong>{data.mediaSources.length} 个</strong></div>
        <div className="system-row"><span>最后巡检</span><strong>{syncTime(lastSync?.completed_at ?? lastSync?.started_at)}</strong></div>
      </div>
      <div className="sidebar-foot"><div className="avatar">{initials}</div><div><strong>{data.brand?.name ?? "尚未配置品牌"}</strong><small>品牌情报工作区</small></div></div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div><p className="eyebrow">ARCHIVE / TRACE / ANALYZE</p><h1>{nav.find(([id]) => id === view)?.[1]}</h1></div>
        <div className="top-actions">
          <label className="search-box"><span>⌕</span><input aria-label="搜索全部档案" placeholder="搜索标题、来源、关键词" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>全档案</kbd></label>
          <button className="primary-button" disabled={syncing || !data.brand} onClick={() => void syncNews(true, true)}><span>{syncing ? "↻" : "◎"}</span>{syncing ? "巡检中…" : "立即巡检"}</button>
        </div>
      </header>

      <div className="content-area">
        {loading ? <LoadingState /> : !data.brand ? <BrandOnboarding submit={async (payload) => { await post(payload, "品牌档案已创建，正在启动全球发现"); void syncNews(true, true); }} /> : <>
          {view === "overview" && <Overview data={data} brand={data.brand} clusters={clusters} alerts={activeAlerts} setView={setView} selectCluster={(key) => { setSelectedCluster(key); setView("propagation"); }} acknowledge={(id) => post({ action: "acknowledgeAlert", id }, "告警已确认")} />}
          {view === "archive" && <ArchiveView mentions={filteredMentions} allCount={data.mentions.length} countries={countries} platforms={platforms} country={country} platform={platform} sentiment={sentiment} setCountry={setCountry} setPlatform={setPlatform} setSentiment={setSentiment} />}
          {view === "propagation" && <PropagationView clusters={clusters} selected={selected} edges={data.propagationEdges} onSelect={setSelectedCluster} />}
          {view === "analytics" && <AnalyticsView analytics={data.analytics} mentions={filteredMentions} />}
          {view === "coverage" && <CoverageView connectors={data.connectors} sources={data.mediaSources} submit={post} />}
          {view === "settings" && <SettingsView brand={data.brand} connectors={data.connectors} entities={data.entities} submit={post} />}
        </>}
      </div>
    </section>
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </main>;
}

function LoadingState() { return <div className="loading-state"><span /><p>正在读取长期新闻档案与传播图谱…</p></div>; }

function BrandOnboarding({ submit }: { submit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { await submit({ action: "saveBrandProfile", ...Object.fromEntries(new FormData(event.currentTarget).entries()) }); } finally { setBusy(false); }
  }
  return <section className="onboarding">
    <div className="onboarding-copy panel-dark"><p className="eyebrow">ONE BRAND · ALL MARKETS</p><h2>输入一次品牌名，<br /><em>全球自动建立档案。</em></h2><p>系统每天少量使用全球发现引擎寻找新报道和新媒体，随后由免费 RSS、Atom 与新闻 Sitemap 持续追踪；无需逐个添加国家或新闻。</p><div className="architecture-mini"><span>全球发现</span><b>→</b><span>媒体源库</span><b>→</b><span>自动归档与分析</span></div></div>
    <form className="onboarding-form surface" onSubmit={handleSubmit}><p className="eyebrow">BRAND PROFILE</p><h3>创建品牌监测档案</h3><label className="field"><span>品牌名称 *</span><input name="brandName" required autoFocus placeholder="例如：OpenAI" /></label><label className="field"><span>品牌别名</span><textarea name="aliases" rows={4} placeholder={'每行一个，例如：\nOpen AI\n产品名\n当地语言译名'} /></label><label className="field"><span>官网域名</span><input name="website" placeholder="brand.com" /></label><button className="primary-button wide" disabled={busy}>{busy ? "正在建立全球档案…" : "启动自动监测 →"}</button><small>新国家、新语言、新媒体均由系统自动识别。</small></form>
  </section>;
}

function Overview({ data, brand, clusters, alerts, setView, selectCluster, acknowledge }: { data: DashboardData; brand: BrandProfile; clusters: StoryCluster[]; alerts: Alert[]; setView: (view: string) => void; selectCluster: (key: string) => void; acknowledge: (id: number) => Promise<unknown> }) {
  const topCountry = data.analytics.countries[0];
  const negative = data.analytics.sentiment.negative;
  const total = data.mentions.length || 1;
  return <div className="dashboard-stack">
    <section className="intelligence-hero panel-dark">
      <div><p className="eyebrow">LIVE BRAND INTELLIGENCE</p><h2>{brand.name} 的全球新闻，<br /><em>正在被归档和溯源。</em></h2><p>全球发现引擎负责寻找新媒体，免费来源库负责持续跟踪。每条报道都进入长期档案，并自动比较发布时间、标题和正文相似度。</p><div className="pipeline"><span><b>01</b>少量全球发现</span><i>→</i><span><b>02</b>{data.mediaSources.length} 个免费来源</span><i>→</i><span><b>03</b>{data.analytics.archivedTotal} 条永久档案</span></div></div>
      <div className="hero-signal"><small>TOP MARKET</small><strong>{topCountry?.country ?? "等待数据"}</strong><span>{topCountry ? `${topCountry.count} 篇报道 · 占全部 ${Math.round(topCountry.count / total * 100)}%` : "首次巡检后生成"}</span><i style={{ width: `${topCountry ? Math.max(8, topCountry.count / total * 100) : 0}%` }} /></div>
    </section>
    <section className="metric-strip">
      <Metric label="历史新闻档案" value={String(data.analytics.archivedTotal)} note="持续累积，不覆盖旧记录" />
      <Metric label="传播事件" value={String(clusters.length)} note="按爆发窗口与跨语言事件指纹聚类" />
      <Metric label="国家 / 地区" value={String(data.analytics.countries.filter((item) => !["地区未披露", "地区待确认"].includes(item.country)).length)} note="由来源元数据、域名、媒体及语言推断" />
      <Metric label="跨境传播边" value={String(data.analytics.crossBorderEdges)} note="已识别的地区间复制链路" />
      <Metric label="负面内容" value={String(negative)} note={`${Math.round(negative / total * 100)}% 的已归档内容`} danger={negative > total * .2} />
      <Metric label="免费媒体来源" value={String(data.mediaSources.length)} note="自动增长的追踪来源库" />
    </section>
    <div className="overview-grid">
      <section className="surface map-panel"><div className="section-head"><div><p className="eyebrow">GLOBAL NEWS INTENSITY</p><h3>全球报道热力分布</h3></div><button className="text-button" onClick={() => setView("analytics")}>查看完整分析 →</button></div><WorldHeatMap countries={data.analytics.countries} /></section>
      <section className="surface recent-panel"><div className="section-head"><div><p className="eyebrow">LATEST ARCHIVE</p><h3>最新归档新闻</h3></div><button className="text-button" onClick={() => setView("archive")}>全部档案 →</button></div><div className="latest-list">{data.mentions.slice(0, 6).map((item) => <article key={item.id}><span className={`tone-dot ${sentimentClass(item.sentiment)}`} /><div><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small>{item.source} · {item.source_country} · {formatDate(item.published_at)}</small></div><b className={`risk-pill ${riskClass(item.risk)}`}>{item.risk}</b></article>)}</div></section>
      <section className="surface event-panel"><div className="section-head"><div><p className="eyebrow">PROPAGATION EVENTS</p><h3>正在扩散的报道链路</h3></div><span className="count-chip">{clusters.length}</span></div><div className="event-list">{clusters.slice(0, 5).map((cluster, index) => <button key={cluster.key} onClick={() => selectCluster(cluster.key)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{cluster.title}</strong><small>{cluster.countries.join(" → ")} · {cluster.items.length} 个节点</small></div><b>{cluster.items.length}</b><i>→</i></button>)}</div></section>
      <section className="surface alerts-panel"><div className="section-head"><div><p className="eyebrow">ACTION QUEUE</p><h3>舆情告警</h3></div><span className="count-chip">{alerts.length}</span></div>{alerts.length ? <div className="alert-list">{alerts.slice(0, 4).map((alert) => <article key={alert.id}><div><span className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span><small>{alert.country}</small></div><h4>{alert.title}</h4><p>{alert.reason}</p><button onClick={() => void acknowledge(alert.id)}>标记已处理</button></article>)}</div> : <div className="empty-mini">当前没有待处理高风险信号</div>}</section>
    </div>
  </div>;
}

function Metric({ label, value, note, danger = false }: { label: string; value: string; note: string; danger?: boolean }) { return <article className={danger ? "metric danger" : "metric"}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }

function WorldHeatMap({ countries }: { countries: CountryStat[] }) {
  const max = Math.max(1, ...countries.map((item) => item.count));
  const placed = countries.filter((item) => mapPosition[item.country]);
  return <div className="world-map-wrap">
    <div className="world-map" aria-label="按国家地区显示新闻量的世界热力图">
      <div className="continent north-america" /><div className="continent south-america" /><div className="continent europe" /><div className="continent africa" /><div className="continent asia" /><div className="continent oceania" />
      {placed.map((item) => { const [left, top] = mapPosition[item.country]; const heat = item.count / max; return <div key={item.country} className="map-marker" style={{ left: `${left}%`, top: `${top}%`, "--heat": heat } as CSSProperties} title={`${item.country}：${item.count} 篇`}><i /><span>{item.country}<b>{item.count}</b></span></div>; })}
    </div>
    <div className="heat-legend"><span>报道较少</span><i /><i /><i /><i /><span>报道最多</span></div>
    {countries.length > placed.length && <div className="unmapped-regions">{countries.filter((item) => !mapPosition[item.country]).slice(0, 6).map((item) => <span key={item.country}>{item.country} <b>{item.count}</b></span>)}</div>}
  </div>;
}

function ArchiveView({ mentions, allCount, countries, platforms, country, platform, sentiment, setCountry, setPlatform, setSentiment }: { mentions: Mention[]; allCount: number; countries: string[]; platforms: string[]; country: string; platform: string; sentiment: string; setCountry: (value: string) => void; setPlatform: (value: string) => void; setSentiment: (value: string) => void }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest" | "risk">("newest");
  const pageSize = 20;
  const ordered = useMemo(() => [...mentions].sort((a, b) => sort === "oldest" ? a.published_at.localeCompare(b.published_at) : sort === "risk" ? b.risk - a.risk : b.published_at.localeCompare(a.published_at)), [mentions, sort]);
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const rows = ordered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  function exportCsv() {
    const fields = [["发布时间", "标题", "链接", "媒体", "地区", "平台", "语言", "情绪", "风险分", "发现方式", "传播事件"], ...ordered.map((item) => [item.published_at, item.title, item.url, item.source, item.source_country, item.platform, item.language, item.sentiment, item.risk, discoveryLabel(item.discovered_via), item.cluster_key])];
    const csv = fields.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); link.download = `signal-atlas-archive-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  return <div className="archive-page">
    <section className="archive-intro"><div><p className="eyebrow">LIFETIME NEWS ARCHIVE</p><h2>品牌历史新闻档案</h2><p>每条自动发现的报道都会保留发布时间、来源地区、媒体、情绪、风险、发现方式与传播事件编号。旧记录不会被下一次搜索覆盖。</p></div><div className="archive-total"><small>ARCHIVED</small><strong>{allCount}</strong><span>有史以来全部记录</span></div></section>
    <section className="surface archive-table-card">
      <div className="archive-toolbar"><div className="filters"><select value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }}>{countries.map((item) => <option key={item}>{item}</option>)}</select><select value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1); }}>{platforms.map((item) => <option key={item}>{item}</option>)}</select><select value={sentiment} onChange={(event) => { setSentiment(event.target.value); setPage(1); }}>{["全部情绪", "正面", "中性", "负面", "混合"].map((item) => <option key={item}>{item}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">最新优先</option><option value="oldest">最早优先</option><option value="risk">风险优先</option></select></div><button className="secondary-button" onClick={exportCsv}>↓ 导出 CSV</button></div>
      <div className="table-scroll"><table className="archive-table"><thead><tr><th>发布时间</th><th>新闻标题 / 原文</th><th>媒体</th><th>地区</th><th>平台</th><th>语言</th><th>情绪</th><th>风险</th><th>发现方式</th><th>事件</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td className="date-cell">{formatDate(item.published_at, true)}</td><td className="title-cell"><a href={item.url} target="_blank" rel="noreferrer">{item.title}<span>↗</span></a><small>{item.excerpt || item.summary}</small></td><td><strong>{item.source}</strong>{item.author && item.author !== item.source && <small>{item.author}</small>}</td><td><span className="country-tag">{countryCode[item.source_country] ?? "GL"}</span>{item.source_country}<small title={item.location_method || "来源字段"}>{item.location_confidence ? `${item.location_method} · ${item.location_confidence}%` : "来源字段"}</small></td><td>{item.platform}</td><td>{item.language}</td><td><span className={`sentiment-pill ${sentimentClass(item.sentiment)}`}>{item.sentiment}</span></td><td><span className={`risk-score ${riskClass(item.risk)}`}>{item.risk}</span></td><td><span className="discovery-badge">{discoveryLabel(item.discovered_via)}</span></td><td><code>{item.cluster_key.replace("story-", "#")}</code></td></tr>)}</tbody></table></div>
      {!rows.length && <div className="empty-table">当前筛选条件下暂无档案</div>}
      <div className="pagination"><span>显示 {ordered.length} 条结果 · 第 {Math.min(page, pages)} / {pages} 页</span><div><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← 上一页</button><button disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>下一页 →</button></div></div>
    </section>
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
    <section className="surface cluster-index"><div className="section-head"><div><p className="eyebrow">STORY CLUSTERS</p><h3>传播事件</h3></div><span className="count-chip">{clusters.length}</span></div><div className="cluster-list">{clusters.map((cluster) => <button key={cluster.key} className={selected?.key === cluster.key ? "selected" : ""} onClick={() => onSelect(cluster.key)}><div><span className={`risk-pill ${riskClass(cluster.risk)}`}>RISK {cluster.risk}</span><small>{formatDate(cluster.latest)}</small></div><h4>{cluster.title}</h4><p>{cluster.countries.join(" → ")}</p><footer><span>{cluster.items.length} 节点</span><span>{cluster.platforms.join(" · ")}</span><b>→</b></footer></button>)}</div></section>
    <section className="surface propagation-detail">{selected ? <>
      <div className="detail-heading"><div><p className="eyebrow">EVIDENCE-BASED PROPAGATION</p><h2>{selected.title}</h2><p>同一事件先由集中爆发时间、品牌实体、标题正文、关键数字和跨语言主题指纹共同聚类；事件内部再按发布时间与内容重合度推断最可能的扩散路径。</p></div><div className="chain-stat"><strong>{selected.countries.length}</strong><span>国家 / 地区</span><small>{selectedEdges.filter((item) => item.cross_border).length} 次跨境传播</small></div></div>
      <section className="event-network-card"><div className="network-heading"><div><p className="eyebrow">EVENT PROPAGATION GRAPH</p><h3>同一事件扩散路径</h3><span>从左到右按发布时间排列；点击节点查看推断证据和原文。</span></div><div className="network-legend"><span><i className="normal" />同地区传播</span><span><i className="cross" />跨地区传播</span><span><i className="origin" />最早信源</span></div></div><div className="network-scroll"><svg className="event-network" viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ minWidth: `${graphWidth}px`, height: `${graphHeight}px` }} role="img" aria-label="同一新闻事件的媒体扩散路径图"><defs><marker id="arrow-normal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker><marker id="arrow-cross" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{eventCountries.map((lane, index) => <g key={lane.region} className="network-lane"><line x1="115" y1={80 + index * 100} x2={graphWidth - 35} y2={80 + index * 100} /><text x="18" y={84 + index * 100}>{lane.region}</text></g>)}{selectedEdges.map((edge) => { const from = nodePositions.get(edge.from_mention_id); const to = nodePositions.get(edge.to_mention_id); if (!from || !to) return null; const bend = Math.max(38, Math.abs(to.x - from.x) * .34); return <g key={edge.id} className={edge.cross_border ? "network-edge cross" : "network-edge"}><path d={`M ${from.x + 96} ${from.y} C ${from.x + 96 + bend} ${from.y}, ${to.x - 96 - bend} ${to.y}, ${to.x - 96} ${to.y}`} markerEnd={`url(#arrow-${edge.cross_border ? "cross" : "normal"})`} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>{edge.similarity}%</text></g>; })}{selected.items.map((item, index) => { const point = nodePositions.get(item.id)!; const isFocused = focused?.id === item.id; return <g key={item.id} className={`network-node ${index === 0 ? "origin" : ""} ${isFocused ? "focused" : ""}`} transform={`translate(${point.x} ${point.y})`} onClick={() => setFocusedMentionId(item.id)} role="button" tabIndex={0}><rect x="-96" y="-36" width="192" height="72" rx="8" /><text className="node-index" x="-82" y="-15">{String(index + 1).padStart(2, "0")}</text><text className="node-source" x="-82" y="4">{item.source.slice(0, 22)}</text><text className="node-title" x="-82" y="20">{item.title.slice(0, 26)}{item.title.length > 26 ? "…" : ""}</text><text className="node-time" x="82" y="-15" textAnchor="end">{formatDate(item.published_at)}</text></g>; })}</svg></div>{!hasPropagationSample && <div className="network-empty-note">当前事件只有 1 篇报道，尚不能形成扩散路径；系统会在发现相似后续报道后自动连边。</div>}{focused && <div className="network-evidence"><div><span className="country-tag">{countryCode[focused.source_country] ?? "GL"}</span><div><strong>{focused.source}</strong><small>{focused.source_country} · {formatDate(focused.published_at, true)}</small></div></div><div><a href={focused.url} target="_blank" rel="noreferrer">{focused.title} ↗</a><p>{focused.excerpt || focused.summary}</p></div><aside>{focusedEdge ? <><b>{focusedEdge.method}</b><span>{focusedEdge.confidence}% 置信度 · {focusedEdge.similarity}% 内容重合</span><small>推断上游：{focusedParent?.source ?? "公开信源"} · 间隔 {gapLabel(focusedEdge.time_gap_minutes)}<br />{focusedEdge.evidence}</small></> : <><b>事件起点</b><span>当前聚类中的最早公开报道</span><small>后续报道将通过箭头连接到最可能的上游来源。</small></>}</aside></div>}</section>
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
  void selectedIds;
  return <div className="analysis-grid">
    <section className="surface sentiment-card"><div className="section-head"><div><p className="eyebrow">SENTIMENT DISTRIBUTION</p><h3>情绪结构</h3></div><span className="count-chip">{mentions.length}</span></div><div className="sentiment-layout"><div className="sentiment-donut" style={{ "--positive": positivePct, "--neutral": neutralPct, "--negative": negativePct } as CSSProperties}><div><strong>{Math.round((analytics.sentiment.positive - analytics.sentiment.negative) / total * 100)}</strong><span>净情绪指数</span></div></div><div className="sentiment-legend">{[["正面", visibleSentiment.positive, "positive"], ["中性", visibleSentiment.neutral, "neutral"], ["负面", visibleSentiment.negative, "negative"], ["混合", visibleSentiment.mixed, "mixed"]].map(([label, count, tone]) => <div key={String(label)}><i className={String(tone)} /><span>{label}</span><strong>{count}</strong></div>)}</div></div></section>
    <section className="surface wordcloud-card"><div className="section-head"><div><p className="eyebrow">KEYWORD CLOUD</p><h3>高频议题词云</h3></div><span className="subtle-note">已排除品牌名与常见停用词</span></div><div className="word-cloud">{analytics.words.map((item, index) => <span key={item.word} className={index < 6 ? "hot" : ""} style={{ fontSize: `${11 + item.count / maxWord * 25}px`, opacity: .5 + item.count / maxWord * .5 }} title={`${item.count} 次`}>{item.word}<sup>{item.count}</sup></span>)}</div></section>
    <section className="surface trend-card"><div className="section-head"><div><p className="eyebrow">30-DAY VOLUME</p><h3>报道量与负面走势</h3></div></div><div className="trend-chart">{analytics.timeline.map((day) => <div key={day.date} title={`${day.date}：${day.total} 篇，其中负面 ${day.negative} 篇`}><div className="bar-stack" style={{ height: `${Math.max(4, day.total / maxDay * 100)}%` }}><i className="negative" style={{ height: `${day.total ? day.negative / day.total * 100 : 0}%` }} /></div><span>{day.date.slice(5)}</span></div>)}</div></section>
    <section className="surface source-rank"><div className="section-head"><div><p className="eyebrow">SOURCE CONCENTRATION</p><h3>媒体来源排行</h3></div></div><div className="rank-list">{analytics.sources.map((source, index) => <article key={source.source}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{source.source}</strong><small>{source.country}</small></div><i><b style={{ width: `${source.count / Math.max(1, analytics.sources[0]?.count ?? 1) * 100}%` }} /></i><em>{source.count}</em></article>)}</div></section>
    <section className="surface country-analysis"><div className="section-head"><div><p className="eyebrow">MARKET BREAKDOWN</p><h3>国家 / 地区舆情结构</h3></div></div><div className="country-analysis-table"><div className="country-analysis-head"><span>地区</span><span>报道</span><span>正 / 中 / 负</span><span>最高风险</span><span>公开互动</span></div>{analytics.countries.map((item) => <div key={item.country}><strong><i>{countryCode[item.country] ?? "GL"}</i>{item.country}</strong><b>{item.count}</b><span><em className="positive">{item.positive}</em> / {item.neutral} / <em className="negative">{item.negative}</em></span><span className={`risk-score ${riskClass(item.risk)}`}>{item.risk}</span><span>{item.engagement.toLocaleString()}</span></div>)}</div></section>
  </div>;
}

function CoverageView({ connectors, sources, submit }: { connectors: Connector[]; sources: MediaSource[]; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const active = sources.filter((item) => item.status === "active").length;
  const [editing, setEditing] = useState<string | null>(null);
  const [credential, setCredential] = useState("");
  const [secondaryCredential, setSecondaryCredential] = useState("");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const configurable = connectors.filter((item) => item.configurable && item.provider);
  function openCredential(provider: string) { setEditing(provider); setCredential(""); setSecondaryCredential(""); setAccountId(""); }
  async function saveCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing || !credential.trim()) return; setBusy(true);
    const value = editing === "Meta / Instagram" ? JSON.stringify({ accessToken: credential.trim(), accountId: accountId.trim() })
      : editing === "TikTok" ? JSON.stringify({ clientKey: credential.trim(), clientSecret: secondaryCredential.trim() }) : credential.trim();
    const lastFour = editing === "TikTok" ? secondaryCredential.slice(-4) : credential.slice(-4);
    try { await submit({ action: "saveConnectorCredential", provider: editing, credential: value, lastFour }, `${editing} API 配置已加密保存`); setCredential(""); setSecondaryCredential(""); setAccountId(""); setEditing(null); }
    finally { setBusy(false); }
  }
  async function removeCredential(provider: string) { setBusy(true); try { await submit({ action: "deleteConnectorCredential", provider }, `${provider} 的个人 API 配置已删除`); } finally { setBusy(false); } }
  return <div className="coverage-page">
    <section className="coverage-architecture panel-dark"><div><p className="eyebrow">HYBRID COLLECTION ARCHITECTURE</p><h2>少量付费发现，<br /><em>大部分追踪免费完成。</em></h2><p>NewsAPI.ai 每 6 小时、GDELT 每日寻找新报道和新媒体；系统每小时调度一次到期任务，已验证的活跃来源每 3 小时抓取，仍在探测的来源每 12 小时重试。</p></div><div className="architecture-flow"><article><b>01</b><strong>全球发现</strong><span>NewsAPI.ai / GDELT</span><small>每 6 小时 / 每日</small></article><i>→</i><article><b>02</b><strong>来源库</strong><span>{sources.length} 个媒体域名</span><small>自动增长</small></article><i>→</i><article><b>03</b><strong>免费追踪</strong><span>RSS / Atom / Sitemap</span><small>活跃 3h / 探测 12h</small></article></div></section>
    <section className="surface connector-section"><div className="section-head"><div><p className="eyebrow">CONNECTOR STATUS</p><h3>采集连接器</h3></div></div><div className="connector-grid">{connectors.map((connector) => <article key={connector.id}><div><i className={connector.status} /><strong>{connector.name}</strong><span className={`connector-state ${connector.status}`}>{connector.status === "online" ? "运行中" : connector.status === "limited" ? "退避 / 建库中" : connector.status === "credentials" ? "待凭证" : connector.configured ? "凭证已存 / 待权限" : "需授权"}</span></div><p>{connector.detail}</p>{connector.configurable && connector.provider && <button className="connector-config-button" onClick={() => openCredential(connector.provider!)}>{connector.configured ? `已配置 · ${connector.lastFour === "环境密钥" ? "站点默认密钥" : `•••• ${connector.lastFour}`}` : "＋ 配置我的 API"}</button>}</article>)}</div></section>
    <section className="surface credential-vault"><div className="vault-copy"><p className="eyebrow">PERSONAL API VAULT</p><h3>我的数据连接器</h3><p>每位登录用户都可以保存自己的 NewsAPI.ai、X、YouTube、Meta / Instagram 与 TikTok 凭证。凭证在服务端使用 AES-GCM 加密，完整值不会返回浏览器；手动和定时巡检均按当前品牌工作区隔离。</p><div className="vault-security"><span>✓ 按登录用户隔离</span><span>✓ 服务端加密</span><span>✓ 前端仅显示末四位</span></div></div><div className="credential-list">{configurable.map((connector) => <article key={connector.id}><div><i className={connector.configured ? "configured" : ""} /><div><strong>{connector.name}</strong><small>{connector.configured ? connector.lastFour === "环境密钥" ? "当前使用站点默认密钥" : `个人密钥 •••• ${connector.lastFour}` : "尚未配置个人密钥"}</small></div></div><div><button onClick={() => openCredential(connector.provider!)}>{connector.configured ? "更换" : "配置"}</button>{connector.configured && connector.lastFour !== "环境密钥" && <button className="danger-link" disabled={busy} onClick={() => void removeCredential(connector.provider!)}>删除</button>}</div></article>)}</div></section>
    {editing && <div className="credential-modal-backdrop" onMouseDown={() => setEditing(null)}><form className="credential-modal" onSubmit={saveCredential} onMouseDown={(event) => event.stopPropagation()}><div className="section-head"><div><p className="eyebrow">SECURE CONNECTOR SETUP</p><h3>配置 {editing}</h3></div><button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button></div><p>{editing === "Meta / Instagram" ? "用于采集 Business / Creator 账号的标签与 @提及；启用仍取决于 Meta 权限和 App Review。" : editing === "TikTok" ? "用于 TikTok Research API 的公开内容查询；启用仍取决于 Research API 审批。" : `输入你自己的 ${editing === "X" ? "Bearer Token" : "API Key"}。`} 保存后仅服务端可以解密使用。</p>{editing === "Meta / Instagram" && <label className="field"><span>Instagram Business / Creator Account ID</span><input autoComplete="off" autoFocus required value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="Instagram Account ID" /></label>}<label className="field"><span>{editing === "Meta / Instagram" ? "Long-lived Access Token" : editing === "TikTok" ? "Client Key" : editing === "X" ? "Bearer Token" : "API Key"}</span><input type="password" autoComplete="off" autoFocus={editing !== "Meta / Instagram"} required value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="粘贴凭证" /></label>{editing === "TikTok" && <label className="field"><span>Client Secret</span><input type="password" autoComplete="off" required value={secondaryCredential} onChange={(event) => setSecondaryCredential(event.target.value)} placeholder="粘贴 Client Secret" /></label>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>取消</button><button className="primary-button" disabled={busy || !credential.trim() || (editing === "Meta / Instagram" && !accountId.trim()) || (editing === "TikTok" && !secondaryCredential.trim())}>{busy ? "加密保存中…" : "安全保存"}</button></div></form></div>}
    <section className="surface sources-section"><div className="section-head"><div><p className="eyebrow">OWNED MEDIA SOURCE LIBRARY</p><h3>免费媒体来源库</h3></div><div className="source-summary"><strong>{active}</strong> 活跃 / {sources.length} 已发现</div></div><div className="table-scroll"><table className="source-table"><thead><tr><th>媒体 / 域名</th><th>地区</th><th>语言</th><th>追踪协议</th><th>状态</th><th>最后抓取</th><th>下次计划</th></tr></thead><tbody>{sources.map((source) => <tr key={source.id}><td><strong>{source.name}</strong><a href={source.homepage_url} target="_blank" rel="noreferrer">{source.domain} ↗</a></td><td>{source.country}</td><td>{source.language}</td><td>{source.feed_url ? "RSS / Atom" : source.sitemap_url ? "News Sitemap" : "自动探测"}</td><td><span className={`source-status ${source.status}`}>{source.status === "active" ? "活跃" : source.status === "watching" ? "监看" : source.status === "error" ? "重试" : "已发现"}</span></td><td>{formatDate(source.last_crawled_at)}</td><td>{formatDate(source.next_crawl_at)}</td></tr>)}</tbody></table></div>{!sources.length && <div className="empty-table">首次全球发现完成后，媒体来源会自动进入这里，无需手动添加。</div>}</section>
  </div>;
}

function SettingsView({ brand, connectors, entities, submit }: { brand: BrandProfile; connectors: Connector[]; entities: Entity[]; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const socialConfigured = connectors.some((item) => ["Meta / Instagram", "TikTok"].includes(item.provider ?? "") && item.configured);
  async function handleEntitySubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; await submit({ action: "addEntity", ...Object.fromEntries(new FormData(form).entries()) }, "监测词已加入全球词典"); form.reset(); }
  async function handleBrandSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await submit({ action: "saveBrandProfile", ...Object.fromEntries(new FormData(event.currentTarget).entries()) }, "品牌监测档案已更新"); }
  return <div className="settings-grid">
    <section className="surface settings-main"><div className="section-head"><div><p className="eyebrow">BRAND PROFILE</p><h3>品牌监测档案</h3></div></div><form className="brand-settings-form" onSubmit={handleBrandSubmit}><label className="field"><span>品牌名称</span><input name="brandName" required defaultValue={brand.name} /></label><label className="field"><span>官网域名</span><input name="website" defaultValue={brand.website} placeholder="brand.com" /></label><label className="field full"><span>品牌别名（每行一个）</span><textarea name="aliases" rows={4} defaultValue={brand.aliases} /></label><button className="secondary-button">更新品牌档案</button></form><p className="form-warning">更换品牌名称会建立新的独立工作区数据，避免不同品牌的新闻与传播链路混在一起。</p>
      <div className="section-head entity-heading"><div><p className="eyebrow">ENTITY DICTIONARY</p><h3>扩展监测词典</h3></div><span className="count-chip">{entities.length}</span></div><form className="inline-form" onSubmit={handleEntitySubmit}><select name="type" defaultValue="关键词"><option>公司</option><option>产品</option><option>人物</option><option>关键词</option><option>事件指纹</option><option>排除词</option></select><input name="value" required placeholder="输入产品、人物、别名或排除词" /><select name="language" defaultValue="通用"><option>通用</option><option>英文</option><option>简体中文</option><option>繁体中文</option><option>泰语</option><option>日语</option></select><button className="primary-button">添加</button></form><div className="entity-list">{entities.map((item) => <div key={item.id}><span>{item.type}</span><strong>{item.value}</strong><small>{item.language}</small><i>启用</i></div>)}</div>
    </section>
    <aside className="surface automation-card"><div className="section-head"><div><p className="eyebrow">AUTOMATION POLICY</p><h3>自动运行策略</h3></div></div>{[["调度巡检", "Cloudflare 每小时第 17 分钟触发", true], ["全球发现", "NewsAPI.ai 每 6 小时；GDELT 每日兜底", true], ["免费媒体追踪", "活跃源 3 小时、待探测源 12 小时，按到期批次抓取", true], ["robots.txt", "不抓取禁止路径，不绕过验证码与付费墙", true], ["传播链路", "先按时间与文本聚为同一事件，再重建有向传播图", true], ["Meta / TikTok", socialConfigured ? "凭证已保存，等待平台权限审核后启用采集" : "可在来源覆盖页配置官方 API 凭证", socialConfigured]].map(([title, note, on]) => <div className="policy-row" key={String(title)}><div><strong>{title}</strong><small>{note}</small></div><span className={on ? "toggle on" : "toggle"}><i /></span></div>)}<div className="connector-mini">{connectors.map((item) => <div key={item.id}><span>{item.name}</span><strong>{item.status === "online" ? "运行中" : item.status === "limited" ? "自动退避" : item.configured ? "凭证已存" : "待接入"}</strong></div>)}</div></aside>
  </div>;
}
