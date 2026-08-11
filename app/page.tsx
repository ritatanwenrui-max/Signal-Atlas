"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Mention = {
  id: number;
  title: string;
  url: string;
  source: string;
  platform: string;
  source_country: string;
  content_country: string;
  language: string;
  sentiment: string;
  risk: number;
  impact: number;
  summary: string;
  cluster_key: string;
  parent_url: string;
  relation: string;
  engagement: number;
  published_at: string;
};

type Traffic = {
  id: number;
  country: string;
  visitors: number;
  views: number;
  baseline: number;
  landing_page: string;
  anomaly_ratio: number;
  recorded_at: string;
};

type Entity = { id: number; type: string; value: string; language: string; active: number };
type Alert = { id: number; title: string; severity: string; country: string; reason: string; acknowledged: number; created_at: string };
type SyncRun = { id: number; provider: string; status: string; found_count: number; inserted_count: number; error: string; started_at: string; completed_at: string | null };
type BrandProfile = { id: number; name: string; aliases: string; website: string };
type Connector = { id: string; name: string; status: "online" | "credentials" | "approval"; detail: string };
type DashboardData = { mentions: Mention[]; traffic: Traffic[]; entities: Entity[]; alerts: Alert[]; syncRuns: SyncRun[]; brand: BrandProfile | null; connectors: Connector[] };
type StoryCluster = { key: string; items: Mention[]; title: string; summary: string; risk: number; impact: number; countries: string[]; platforms: string[]; latest: string };

const emptyData: DashboardData = { mentions: [], traffic: [], entities: [], alerts: [], syncRuns: [], brand: null, connectors: [] };
const nav = [
  ["overview", "全球总览", "01"],
  ["events", "传播事件", "02"],
  ["ingest", "补充录入", "03"],
  ["traffic", "流量归因", "04"],
  ["coverage", "全球覆盖", "05"],
  ["settings", "监测配置", "06"],
] as const;

const countryCode: Record<string, string> = {
  台湾: "TW", 香港: "HK", 泰国: "TH", 美国: "US", 日本: "JP", 全球: "GL", 中国: "CN", 新加坡: "SG",
  英国: "GB", 韩国: "KR", 加拿大: "CA", 澳大利亚: "AU", 德国: "DE", 法国: "FR", 印度: "IN", 地区未披露: "--",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function syncTime(value?: string | null) {
  if (!value) return "等待首次搜索";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return formatDate(value);
}

function riskLabel(risk: number) {
  if (risk >= 70) return "高风险";
  if (risk >= 40) return "观察";
  return "低风险";
}

function riskClass(risk: number) {
  if (risk >= 70) return "danger";
  if (risk >= 40) return "watch";
  return "safe";
}

export default function Home() {
  const [view, setView] = useState("overview");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("全球");
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function syncNews(force = false, announce = false) {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "新闻自动搜索失败");
      setData(result.data);
      if (announce) {
        const message = result.sync.skipped ? "刚刚已经完成过搜索" : `搜索完成：发现 ${result.sync.found} 条，新增 ${result.sync.inserted} 条`;
        setToast(message);
        window.setTimeout(() => setToast(""), 3200);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "新闻自动搜索失败";
      setToast(`${message}，系统会自动重试`);
      window.setTimeout(() => setToast(""), 4200);
    } finally {
      setSyncing(false);
    }
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
      } catch {
        if (!cancelled) setToast("暂时无法读取数据，请稍后刷新");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    const timer = window.setInterval(() => void syncNews(false, false), 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // syncNews is intentionally scheduled once; the server-side lease prevents overlap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(payload: Record<string, unknown>, success: string) {
    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "操作失败");
    setData(result);
    setToast(success);
    window.setTimeout(() => setToast(""), 2800);
    return result as DashboardData;
  }

  const filteredMentions = useMemo(() => data.mentions.filter((item) => {
    const matchesQuery = !query || `${item.title} ${item.source} ${item.summary}`.toLowerCase().includes(query.toLowerCase());
    const matchesCountry = country === "全球" || item.source_country === country;
    return matchesQuery && matchesCountry;
  }), [data.mentions, query, country]);

  const clusters = useMemo(() => {
    const grouped = new Map<string, Mention[]>();
    filteredMentions.forEach((mention) => grouped.set(mention.cluster_key, [...(grouped.get(mention.cluster_key) ?? []), mention]));
    return [...grouped.entries()].map(([key, items]) => {
      const ordered = [...items].sort((a, b) => a.published_at.localeCompare(b.published_at));
      return ({
      key,
      items: ordered,
      title: ordered[0].title,
      summary: ordered[0].summary,
      risk: Math.max(...items.map((item) => item.risk)),
      impact: Math.max(...items.map((item) => item.impact)),
      countries: [...new Set(items.map((item) => item.source_country))],
      platforms: [...new Set(items.map((item) => item.platform))],
      latest: items.map((item) => item.published_at).sort().at(-1) ?? "",
    })}).sort((a, b) => b.impact - a.impact);
  }, [filteredMentions]);

  const activeAlerts = data.alerts.filter((item) => !item.acknowledged);
  const countries = ["全球", ...new Set(data.mentions.map((item) => item.source_country))];
  const selected = clusters.find((item) => item.key === selectedCluster) ?? clusters[0];
  const lastSync = data.syncRuns[0];
  const connectedSources = data.connectors.filter((item) => item.status === "online").map((item) => item.name).join(" · ") || "等待连接";
  const initials = data.brand?.name.split(/\s+/).map((item) => item[0]).join("").slice(0, 2).toUpperCase() || "BR";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>SIGNAL ATLAS</strong><small>全球舆情雷达</small></div>
        </div>

        <nav aria-label="主要导航">
          {nav.map(([id, label, number]) => (
            <button key={id} className={view === id ? "nav-item active" : "nav-item"} onClick={() => setView(id)}>
              <span>{number}</span>{label}
              {id === "overview" && activeAlerts.length > 0 && <b>{activeAlerts.length}</b>}
            </button>
          ))}
        </nav>

        <div className="system-card">
          <div className="system-title"><i /> {data.brand ? "自动监测已开启" : "等待品牌配置"}</div>
          <div className="system-row"><span>全球新闻</span><strong>每 10 分钟</strong></div>
          <div className="system-row"><span>已连接</span><strong>{connectedSources}</strong></div>
          <div className="system-row"><span>最后同步</span><strong>{syncTime(lastSync?.completed_at ?? lastSync?.started_at)}</strong></div>
        </div>

        <div className="sidebar-foot">
          <div className="avatar">{initials}</div>
          <div><strong>{data.brand?.name ?? "尚未配置品牌"}</strong><small>品牌情报工作区</small></div>
          <button aria-label="打开账户菜单">•••</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">GLOBAL INTELLIGENCE / LIVE</p>
            <h1>{nav.find(([id]) => id === view)?.[1]}</h1>
          </div>
          <div className="top-actions">
            <label className="search-box">
              <span>⌕</span>
              <input aria-label="搜索舆情" placeholder="搜索事件、媒体或国家" value={query} onChange={(event) => setQuery(event.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" aria-label="查看告警" onClick={() => setView("overview")}>◉<b>{activeAlerts.length}</b></button>
            <button className="secondary-button quick-add-button" onClick={() => setShowAdd(true)}>＋ 补充录入</button>
            <button className="primary-button sync-button" disabled={syncing || !data.brand} onClick={() => void syncNews(true, true)}><span>{syncing ? "↻" : "◎"}</span> {syncing ? "正在搜索…" : "立即搜索"}</button>
          </div>
        </header>

        <div className="content-area">
          {loading ? <LoadingState /> : !data.brand ? <BrandOnboarding submit={async (payload) => { await post(payload, "品牌已保存，正在启动首次搜索"); void syncNews(true, true); }} /> : (
            <>
              {view === "overview" && <Overview data={data} brand={data.brand} clusters={clusters} alerts={activeAlerts} country={country} countries={countries} setCountry={setCountry} setView={setView} selectCluster={(key) => { setSelectedCluster(key); setView("events"); }} acknowledge={(id) => post({ action: "acknowledgeAlert", id }, "告警已确认")} />}
              {view === "events" && <EventsView clusters={clusters} selected={selected} onSelect={setSelectedCluster} />}
              {view === "ingest" && <IngestView mentions={filteredMentions} submit={post} />}
              {view === "traffic" && <TrafficView traffic={data.traffic} submit={post} />}
              {view === "coverage" && <CoverageView connectors={data.connectors} />}
              {view === "settings" && <SettingsView brand={data.brand} connectors={data.connectors} entities={data.entities} submit={post} />}
            </>
          )}
        </div>
      </section>

      {showAdd && <QuickAdd close={() => setShowAdd(false)} submit={async (payload) => { await post(payload, "舆情已录入并完成初步分析"); setShowAdd(false); }} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function LoadingState() {
  return <div className="loading-state"><span /><p>正在建立全球信号视图…</p></div>;
}

function BrandOnboarding({ submit }: { submit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await submit({ action: "saveBrandProfile", ...values }); } finally { setBusy(false); }
  }
  return <section className="onboarding panel-dark">
    <div className="onboarding-copy"><p className="eyebrow">START MONITORING</p><h2>输入一个品牌，<br /><em>开始全球监听。</em></h2><p>只配置品牌名、常用别名和官网域名。国家、语言、媒体和传播路径由系统从内容中自动识别。</p><div className="onboarding-points"><span>01 全球新闻自动搜索</span><span>02 社交连接器按权限接入</span><span>03 传播顺序与情绪风险分析</span></div></div>
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <div><p className="eyebrow">BRAND PROFILE</p><h3>创建品牌监测档案</h3></div>
      <label className="field full"><span>品牌名称 *</span><input name="brandName" required autoFocus placeholder="例如：Nike" /></label>
      <label className="field full"><span>品牌别名</span><textarea name="aliases" rows={4} placeholder={"每行一个，例如：\n耐克\nNike, Inc."} /></label>
      <label className="field full"><span>官网域名</span><input name="website" placeholder="nike.com" /></label>
      <p className="privacy-note">保存后立即启动首次公开搜索。更换品牌会清空上一品牌的数据，防止信息串线。</p>
      <button className="primary-button" disabled={busy}>{busy ? "正在创建…" : "保存并开始监测 →"}</button>
    </form>
  </section>;
}

function Overview({ data, brand, clusters, alerts, country, countries, setCountry, setView, selectCluster, acknowledge }: {
  data: DashboardData; brand: BrandProfile; clusters: StoryCluster[]; alerts: Alert[]; country: string; countries: string[];
  setCountry: (value: string) => void; setView: (value: string) => void; selectCluster: (value: string) => void; acknowledge: (id: number) => void;
}) {
  const globalCountries = new Set(data.mentions.map((item) => item.source_country).filter((item) => item !== "地区未披露")).size;
  const highRisk = data.mentions.filter((item) => item.risk >= 70).length;
  const socialCount = data.mentions.filter((item) => item.platform !== "网页新闻").length;
  const negativeCount = data.mentions.filter((item) => item.sentiment === "负面").length;
  const marketSignals = [...data.mentions.reduce((map, item) => {
    const current = map.get(item.source_country) ?? { name: item.source_country, count: 0, score: 0 };
    current.count += 1; current.score = Math.max(current.score, item.impact, item.risk); map.set(item.source_country, current); return map;
  }, new Map<string, { name: string; count: number; score: number }>()).values()].sort((a, b) => b.score - a.score).slice(0, 6);

  return <div className="overview-grid">
    <section className="signal-hero panel-dark"><div className="hero-copy"><div className="live-chip"><i /> AUTO SEARCH · 每 10 分钟</div>
      <h2>{data.mentions.length ? "品牌信号正在" : "全球监听已经"}<br /><em>{data.mentions.length ? "进入传播图谱" : "开始运行"}</em></h2>
      <p>正在监测「{brand.name}」及其 {brand.aliases ? brand.aliases.split("\n").filter(Boolean).length : 0} 个别名。系统自动发现新闻和已授权社交内容，再按时间与标题相似度还原传播顺序。</p>
      <div className="hero-actions"><button onClick={() => setView("events")}>查看传播事件 <span>↗</span></button><small>监测对象 <strong>{brand.name}</strong></small></div></div>
      <div className="signal-map" aria-label="重点国家信号分布"><div className="map-header"><span>GLOBAL SIGNAL DENSITY</span><strong>{globalCountries} 个地区</strong></div><div className="node-grid">
        {marketSignals.map((item) => <button key={item.name} className={`country-node ${item.score >= 70 ? "critical" : item.score >= 50 ? "hot" : "cool"}`} onClick={() => setCountry(item.name)}><span>{countryCode[item.name] ?? item.name.slice(0, 2).toUpperCase()}</span><strong>{item.score}</strong><small>{item.name} · {item.count}</small></button>)}
        {marketSignals.length === 0 && <div className="map-empty"><strong>正在等待第一批公开信号</strong><small>结果会自动按来源国家落在这里</small></div>}
      </div><div className="map-legend"><span><i className="dot-critical" />风险</span><span><i className="dot-hot" />高声量</span><span><i className="dot-cool" />常态</span></div></div>
    </section>
    <section className="metric-strip"><Metric label="已发现提及" value={String(data.mentions.length).padStart(2, "0")} delta="自动" note="搜索累计入库" /><Metric label="独立传播事件" value={String(clusters.length).padStart(2, "0")} delta="聚类" note="按标题相似度去重" /><Metric label="覆盖国家" value={String(globalCountries).padStart(2, "0")} delta="自动" note="无需逐国配置" /><Metric label="高风险信号" value={String(highRisk).padStart(2, "0")} delta="需复核" note={`${negativeCount} 条负面内容`} danger /><Metric label="社交内容" value={String(socialCount).padStart(2, "0")} delta="授权后" note="X / YouTube 等" /></section>
    <section className="events-panel surface"><div className="section-head"><div><p className="eyebrow">STORY CLUSTERS</p><h3>正在传播的事件</h3></div><div className="filter-tabs">{countries.slice(0, 4).map((item) => <button key={item} className={country === item ? "active" : ""} onClick={() => setCountry(item)}>{item}</button>)}</div></div><div className="event-list">
      {clusters.slice(0, 4).map((cluster, index) => <button className="event-row" key={cluster.key} onClick={() => selectCluster(cluster.key)}><span className="event-rank">{String(index + 1).padStart(2, "0")}</span><span className={`risk-pill ${riskClass(cluster.risk)}`}>{riskLabel(cluster.risk)}</span><span className="event-main"><strong>{cluster.title}</strong><small>{cluster.summary}</small></span><span className="event-meta"><strong>{cluster.items.length}</strong><small>条提及</small></span><span className="event-meta"><strong>{cluster.countries.length}</strong><small>个地区</small></span><span className="arrow">↗</span></button>)}
      {clusters.length === 0 && <div className="empty-mini">尚未发现相关内容；系统会继续自动搜索</div>}</div><button className="text-link" onClick={() => setView("events")}>查看全部传播事件 →</button></section>
    <aside className="alerts-panel surface"><div className="section-head compact"><div><p className="eyebrow">ACTION QUEUE</p><h3>待处理告警</h3></div><span className="count-chip">{alerts.length}</span></div><div className="alert-list">{alerts.slice(0, 3).map((alert) => <article className="alert-card" key={alert.id}><div className="alert-top"><span className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span><small>{alert.country}</small></div><h4>{alert.title}</h4><p>{alert.reason}</p><button onClick={() => acknowledge(alert.id)}>确认处理</button></article>)}{alerts.length === 0 && <div className="empty-mini">暂无待处理告警</div>}</div></aside>
    <section className="traffic-panel surface"><div className="section-head compact"><div><p className="eyebrow">TRAFFIC CORRELATION</p><h3>官网访问异常</h3></div><button className="text-link" onClick={() => setView("traffic")}>查看归因 →</button></div><div className="traffic-bars">{data.traffic.slice(0, 4).map((item) => <div className="traffic-row" key={item.id}><div className="traffic-country"><span>{countryCode[item.country] ?? item.country.slice(0, 2).toUpperCase()}</span><strong>{item.country}</strong></div><div className="bar-track"><i style={{ width: `${Math.min(100, item.anomaly_ratio / 6)}%` }} /></div><div className="traffic-value"><strong>{item.visitors.toLocaleString()}</strong><small>{(item.anomaly_ratio / 100).toFixed(1)}× 基线</small></div></div>)}{data.traffic.length === 0 && <div className="empty-mini">可选：接入网站分析或补充异常流量，用于反向归因</div>}</div></section>
    <section className="coverage-mini surface"><div className="section-head compact"><div><p className="eyebrow">DATA COVERAGE</p><h3>数据网络</h3></div><button className="text-link" onClick={() => setView("coverage")}>覆盖矩阵 →</button></div><div className="source-health">{data.connectors.map((connector) => <div key={connector.id}><span><i className={connector.status === "online" ? "online" : "partial"} />{connector.name}</span><strong>{connector.status === "online" ? "在线" : "待授权"}</strong></div>)}</div></section>
  </div>;
}

function Metric({ label, value, delta, note, danger = false }: { label: string; value: string; delta: string; note: string; danger?: boolean }) {
  return <article className={danger ? "metric-card danger-card" : "metric-card"}><div><span>{label}</span><b>{delta}</b></div><strong>{value}</strong><small>{note}</small></article>;
}

function EventsView({ clusters, selected, onSelect }: { clusters: StoryCluster[]; selected: StoryCluster | undefined; onSelect: (key: string) => void }) {
  const directEvidence = selected?.items.filter((item) => item.parent_url && item.relation).length ?? 0;
  const chainConfidence = selected ? Math.min(95, 48 + selected.items.length * 5 + selected.countries.length * 4 + directEvidence * 15) : 0;
  return <div className="split-view">
    <section className="surface cluster-browser">
      <div className="section-head"><div><p className="eyebrow">GLOBAL STORY GRAPH</p><h3>传播事件</h3></div><span className="count-chip">{clusters.length}</span></div>
      <div className="cluster-list">
        {clusters.map((cluster) => <button key={cluster.key} className={selected?.key === cluster.key ? "cluster-card selected" : "cluster-card"} onClick={() => onSelect(cluster.key)}>
          <div className="cluster-card-head"><span className={`risk-pill ${riskClass(cluster.risk)}`}>{riskLabel(cluster.risk)}</span><small>{formatDate(cluster.latest)}</small></div>
          <h4>{cluster.title}</h4><p>{cluster.summary}</p>
          <div className="cluster-foot"><span>{cluster.items.length} 条提及</span><span>{cluster.countries.join(" · ")}</span><strong>{cluster.impact}</strong></div>
        </button>)}
      </div>
    </section>
    <section className="surface event-detail">
      {selected ? <>
        <div className="detail-kicker"><span className={`risk-pill ${riskClass(selected.risk)}`}>{riskLabel(selected.risk)}</span><small>事件 ID · {selected.key.toUpperCase()} · {directEvidence} 条直接链路证据</small></div>
        <h2>{selected.title}</h2>
        <p className="detail-summary">{selected.summary}</p>
        <div className="score-board">
          <div><span>影响力</span><strong>{selected.impact}</strong><i style={{ width: `${selected.impact}%` }} /></div>
          <div><span>风险度</span><strong>{selected.risk}</strong><i className="risk-bar" style={{ width: `${selected.risk}%` }} /></div>
          <div><span>链路推断置信</span><strong>{chainConfidence}</strong><i style={{ width: `${chainConfidence}%` }} /></div>
        </div>
        <div className="detail-section"><p className="eyebrow">PROPAGATION TIMELINE</p><h3>传播时间线</h3>
          <div className="timeline">{[...selected.items].sort((a: Mention, b: Mention) => a.published_at.localeCompare(b.published_at)).map((item: Mention, index: number) => <article key={item.id}>
            <span className={index === 0 ? "origin" : ""}>{index === 0 ? "源" : index + 1}</span>
            <div><small>{formatDate(item.published_at)} · {item.source_country} · {item.platform}{item.relation ? ` · ${item.relation}` : ""}</small><h4>{item.source}</h4><p>{item.title}</p>{item.engagement > 0 && <small>{item.engagement.toLocaleString()} 次公开互动</small>}</div>
            <div className="evidence-links">{item.parent_url && <a href={item.parent_url} target="_blank" rel="noreferrer">上游证据 ↗</a>}<a href={item.url} target="_blank" rel="noreferrer">原文 ↗</a></div>
          </article>)}</div>
          <p className="inference-note">链路按发布时间、标题语义相似度和跨平台出现顺序推断；只有平台明确提供转发或引用关系时，才视为直接传播证据。</p>
        </div>
      </> : <div className="empty-state">没有符合条件的传播事件</div>}
    </section>
  </div>;
}

function IngestView({ mentions, submit }: { mentions: Mention[]; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  return <div className="form-layout">
    <DataEntryForm submit={submit} />
    <section className="surface recent-imports">
      <div className="section-head"><div><p className="eyebrow">RECENT INGEST</p><h3>最近进入系统</h3></div><span className="count-chip">{mentions.length}</span></div>
      <div className="import-list">{mentions.slice(0, 8).map((item) => <article key={item.id}><div className="source-avatar">{(countryCode[item.source_country] ?? item.source.slice(0, 2)).toUpperCase()}</div><div><strong>{item.title}</strong><small>{item.source} · {item.platform} · {formatDate(item.published_at)}</small></div><span className={`risk-pill ${riskClass(item.risk)}`}>{item.risk}</span></article>)}</div>
    </section>
  </div>;
}

function DataEntryForm({ submit }: { submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await submit({ action: "createMention", ...values, risk: Number(values.risk), impact: Number(values.impact), clusterKey: `manual-${Date.now()}`, publishedAt: new Date().toISOString() }, "舆情已录入并完成初步分析");
      event.currentTarget.reset();
    } finally { setBusy(false); }
  }
  return <section className="surface data-form">
    <div className="section-head"><div><p className="eyebrow">FALLBACK CAPTURE</p><h3>补充漏报内容</h3></div><span className="status-note"><i /> 自动搜索为主</span></div>
    <p className="form-intro">这里不是日常工作入口，只用于补充付费墙、私域社群或供应商暂时无法访问的内容。</p>
    <form onSubmit={handleSubmit}>
      <label className="field full"><span>新闻或帖文标题 *</span><input name="title" required placeholder="例如：某媒体报道品牌发布新产品" /></label>
      <label className="field full"><span>原文链接</span><input name="url" type="url" placeholder="https://" /></label>
      <div className="field-row">
        <label className="field"><span>媒体 / 账号 *</span><input name="source" required placeholder="媒体或账号名称" /></label>
        <label className="field"><span>平台</span><select name="platform" defaultValue="网页新闻"><option>网页新闻</option><option>Instagram</option><option>TikTok</option><option>X</option><option>YouTube</option><option>Reddit</option><option>其他</option></select></label>
      </div>
      <div className="field-row thirds">
        <label className="field"><span>来源国家/地区</span><input name="sourceCountry" placeholder="自动识别或输入任意地区" /></label>
        <label className="field"><span>内容涉及地区</span><input name="contentCountry" placeholder="例如：英国" /></label>
        <label className="field"><span>语言</span><select name="language" defaultValue="繁体中文"><option>繁体中文</option><option>简体中文</option><option>英文</option><option>泰语</option><option>日语</option><option>自动识别</option></select></label>
      </div>
      <label className="field full"><span>内容摘要</span><textarea name="summary" rows={4} placeholder="粘贴摘要或关键信息；系统将保留原始证据。" /></label>
      <div className="field-row thirds">
        <label className="field"><span>情绪</span><select name="sentiment" defaultValue="中性"><option>正面</option><option>中性</option><option>负面</option><option>混合</option></select></label>
        <label className="field"><span>风险分</span><input name="risk" type="number" min="0" max="100" defaultValue="35" /></label>
        <label className="field"><span>影响力</span><input name="impact" type="number" min="0" max="100" defaultValue="60" /></label>
      </div>
      <div className="form-actions"><button type="reset" className="secondary-button">清空</button><button disabled={busy} className="primary-button" type="submit">{busy ? "正在分析…" : "录入并分析 →"}</button></div>
    </form>
  </section>;
}

function TrafficView({ traffic, submit }: { traffic: Traffic[]; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await submit({ action: "createTraffic", ...values }, "流量信号已保存并启动反向搜索");
    event.currentTarget.reset();
  }
  return <div className="form-layout traffic-view">
    <section className="surface data-form">
      <div className="section-head"><div><p className="eyebrow">TRAFFIC SIGNAL</p><h3>输入官网流量</h3></div><span className="status-note"><i /> 自动反查</span></div>
      <p className="form-intro">录入某国家的异常访问，达到 3 倍基线时自动创建告警并触发当地语言搜索。</p>
      <form onSubmit={handleSubmit}>
        <label className="field full"><span>国家/地区</span><input name="country" required placeholder="输入任意国家或地区" /></label>
        <div className="field-row thirds"><label className="field"><span>访客数</span><input name="visitors" required type="number" min="0" placeholder="当前周期访客" /></label><label className="field"><span>浏览量</span><input name="views" required type="number" min="0" placeholder="当前周期浏览量" /></label><label className="field"><span>历史基线</span><input name="baseline" required type="number" min="1" placeholder="同周期平均访客" /></label></div>
        <label className="field full"><span>主要落地页</span><input name="landingPage" placeholder="/products/..." /></label>
        <div className="form-actions"><button className="primary-button" type="submit">保存并启动归因 →</button></div>
      </form>
    </section>
    <section className="surface signal-history">
      <div className="section-head"><div><p className="eyebrow">ANOMALY HISTORY</p><h3>流量信号记录</h3></div><span className="count-chip">{traffic.length}</span></div>
      {traffic.map((item) => <article key={item.id}><div className="country-badge">{countryCode[item.country] ?? "GL"}</div><div><strong>{item.country}</strong><small>{item.landing_page}</small></div><div className="signal-numbers"><strong>{item.visitors.toLocaleString()}</strong><small>{item.views.toLocaleString()} views</small></div><span className={item.anomaly_ratio >= 300 ? "anomaly high" : "anomaly"}>{(item.anomaly_ratio / 100).toFixed(1)}×</span></article>)}
    </section>
  </div>;
}

function CoverageView({ connectors }: { connectors: Connector[] }) {
  const onlineCount = connectors.filter((item) => item.status === "online").length;
  return <div className="coverage-page">
    <section className="coverage-hero panel-dark"><div><p className="eyebrow">GLOBAL COVERAGE MATRIX</p><h2>品牌词只配置一次。<br /><em>国家无需逐个添加。</em></h2><p>系统按品牌名、别名和域名持续搜索全球公开内容。不同社交网络的数据权限各不相同，因此每个连接器都会公开显示真实可用状态。</p></div><div className="coverage-score"><span>ACTIVE CONNECTORS</span><strong>{onlineCount}<small>/{connectors.length}</small></strong><i><b style={{ width: `${connectors.length ? onlineCount / connectors.length * 100 : 0}%` }} /></i><p>网页新闻开箱即用 · 社交数据按官方权限接入</p></div></section>
    <section className="surface coverage-table-wrap"><div className="section-head"><div><p className="eyebrow">SOURCE × ACCESS × STATUS</p><h3>数据连接器</h3></div></div><div className="connector-grid">{connectors.map((connector) => <article className="connector-card" key={connector.id}><div><i className={connector.status === "online" ? "online" : connector.status === "credentials" ? "partial" : "pending"} /><strong>{connector.name}</strong><b className={`coverage-state ${connector.status === "online" ? "online" : connector.status === "credentials" ? "partial" : "pending"}`}>{connector.status === "online" ? "正在采集" : connector.status === "credentials" ? "待配置凭证" : "需审批/供应商"}</b></div><p>{connector.detail}</p></article>)}</div></section>
    <section className="coverage-notes"><article><span>01</span><h4>全球统一模型</h4><p>国家、语言和平台都是内容属性，新国家自动进入处理流程。</p></article><article><span>02</span><h4>多供应商底座</h4><p>授权数据源为主，官方 API 与公开网页连接器用于交叉验证。</p></article><article><span>03</span><h4>证据优先</h4><p>无法合法获取的数据明确标记，不用推测填补覆盖缺口。</p></article></section>
  </div>;
}

function SettingsView({ brand, connectors, entities, submit }: { brand: BrandProfile; connectors: Connector[]; entities: Entity[]; submit: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  async function handleEntitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await submit({ action: "addEntity", ...values }, "监测词已加入全球查询词典");
    event.currentTarget.reset();
  }
  async function handleBrandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await submit({ action: "saveBrandProfile", ...values }, "品牌监测档案已更新");
  }
  return <div className="settings-grid">
    <section className="surface entity-panel"><div className="section-head"><div><p className="eyebrow">BRAND PROFILE</p><h3>品牌监测档案</h3></div><span className="count-chip">{entities.length} 词</span></div><form className="brand-settings-form" onSubmit={handleBrandSubmit}><label className="field"><span>品牌名称</span><input name="brandName" required defaultValue={brand.name} /></label><label className="field"><span>官网域名</span><input name="website" defaultValue={brand.website} placeholder="brand.com" /></label><label className="field full"><span>品牌别名（每行一个）</span><textarea name="aliases" rows={3} defaultValue={brand.aliases} /></label><button className="secondary-button">更新品牌档案</button></form><p className="form-intro">更换品牌名称会清空旧品牌的提及与告警，避免不同品牌数据混在一起。</p><div className="section-head entity-subhead"><div><p className="eyebrow">ENTITY DICTIONARY</p><h3>扩展监测词典</h3></div></div><form className="inline-form" onSubmit={handleEntitySubmit}><select name="type" defaultValue="关键词"><option>公司</option><option>产品</option><option>人物</option><option>域名</option><option>事件指纹</option><option>排除词</option></select><input name="value" required placeholder="输入新的监测词" /><select name="language" defaultValue="通用"><option>通用</option><option>英文</option><option>简体中文</option><option>繁体中文</option><option>泰语</option><option>日语</option></select><button className="primary-button">添加</button></form><div className="entity-list">{entities.map((item) => <div key={item.id}><span className="entity-type">{item.type}</span><strong>{item.value}</strong><small>{item.language}</small><i>启用</i></div>)}</div></section>
    <aside className="surface rule-panel"><div className="section-head compact"><div><p className="eyebrow">AUTOMATION</p><h3>自动化规则</h3></div></div>{[
      ["跨国传播告警", "首次进入新国家时立即通知", true], ["负面风险升级", "风险分 ≥ 70 时通知负责人", true], ["流量异常反查", "访问量 ≥ 3× 基线时搜索当地媒体", true], ["普通转载静默", "重复转载只更新事件，不重复通知", true], ["自动对外回复", "需要人工审批", false],
    ].map(([title, desc, active]) => <div className="rule-row" key={String(title)}><div><strong>{title}</strong><small>{desc}</small></div><span className={active ? "toggle on" : "toggle"} aria-label={`${title}状态`}><i /></span></div>)}<div className="connector-status-list"><p className="eyebrow">CONNECTOR STATUS</p>{connectors.map((connector) => <div key={connector.id}><span>{connector.name}</span><strong>{connector.status === "online" ? "在线" : connector.status === "credentials" ? "待凭证" : "待审批"}</strong></div>)}</div></aside>
  </div>;
}

function QuickAdd({ close, submit }: { close: () => void; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await submit({ action: "createMention", ...values, risk: 35, impact: 60, sentiment: "中性", language: "自动识别", contentCountry: values.sourceCountry, publishedAt: new Date().toISOString(), clusterKey: `quick-${Date.now()}` }); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={close}><section className="quick-modal" role="dialog" aria-modal="true" aria-label="快速录入舆情" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">QUICK CAPTURE</p><h3>快速录入舆情</h3></div><button onClick={close} aria-label="关闭">×</button></div><form onSubmit={handleSubmit}><label className="field full"><span>标题 *</span><input name="title" autoFocus required placeholder="粘贴新闻或帖子标题" /></label><label className="field full"><span>原文链接</span><input name="url" type="url" placeholder="https://" /></label><div className="field-row"><label className="field"><span>媒体 / 账号 *</span><input name="source" required placeholder="来源名称" /></label><label className="field"><span>平台</span><select name="platform"><option>网页新闻</option><option>Instagram</option><option>TikTok</option><option>X</option><option>YouTube</option></select></label></div><label className="field full"><span>来源国家/地区</span><input name="sourceCountry" placeholder="输入任意国家或地区" /></label><label className="field full"><span>简要内容</span><textarea name="summary" rows={3} placeholder="可选；系统将据此辅助分类" /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={close}>取消</button><button className="primary-button" disabled={busy}>{busy ? "分析中…" : "保存并分析"}</button></div></form></section></div>;
}
