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
type DashboardData = { mentions: Mention[]; traffic: Traffic[]; entities: Entity[]; alerts: Alert[] };

const emptyData: DashboardData = { mentions: [], traffic: [], entities: [], alerts: [] };
const nav = [
  ["overview", "全球总览", "01"],
  ["events", "传播事件", "02"],
  ["ingest", "内容录入", "03"],
  ["traffic", "流量归因", "04"],
  ["coverage", "全球覆盖", "05"],
  ["settings", "监测配置", "06"],
] as const;

const countryCode: Record<string, string> = {
  台湾: "TW", 香港: "HK", 泰国: "TH", 美国: "US", 日本: "JP", 全球: "GL", 中国: "CN", 新加坡: "SG",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
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

  async function refresh() {
    const response = await fetch("/api/data");
    if (!response.ok) throw new Error("数据加载失败");
    setData(await response.json());
  }

  useEffect(() => {
    refresh().catch(() => setToast("暂时无法读取数据，请稍后刷新")).finally(() => setLoading(false));
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
  }

  const filteredMentions = useMemo(() => data.mentions.filter((item) => {
    const matchesQuery = !query || `${item.title} ${item.source} ${item.summary}`.toLowerCase().includes(query.toLowerCase());
    const matchesCountry = country === "全球" || item.source_country === country;
    return matchesQuery && matchesCountry;
  }), [data.mentions, query, country]);

  const clusters = useMemo(() => {
    const grouped = new Map<string, Mention[]>();
    filteredMentions.forEach((mention) => grouped.set(mention.cluster_key, [...(grouped.get(mention.cluster_key) ?? []), mention]));
    return [...grouped.entries()].map(([key, items]) => ({
      key,
      items,
      title: items[0].title,
      summary: items[0].summary,
      risk: Math.max(...items.map((item) => item.risk)),
      impact: Math.max(...items.map((item) => item.impact)),
      countries: [...new Set(items.map((item) => item.source_country))],
      platforms: [...new Set(items.map((item) => item.platform))],
      latest: items.map((item) => item.published_at).sort().at(-1) ?? "",
    })).sort((a, b) => b.impact - a.impact);
  }, [filteredMentions]);

  const activeAlerts = data.alerts.filter((item) => !item.acknowledged);
  const countries = ["全球", ...new Set(data.mentions.map((item) => item.source_country))];
  const selected = clusters.find((item) => item.key === selectedCluster) ?? clusters[0];

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
          <div className="system-title"><i /> 数据网络在线</div>
          <div className="system-row"><span>新闻与网页</span><strong>99.4%</strong></div>
          <div className="system-row"><span>社交数据</span><strong>92.8%</strong></div>
          <div className="system-row"><span>最后同步</span><strong>2 分钟前</strong></div>
        </div>

        <div className="sidebar-foot">
          <div className="avatar">SL</div>
          <div><strong>Somnia Lab</strong><small>品牌情报中心</small></div>
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
            <button className="primary-button" onClick={() => setShowAdd(true)}><span>＋</span> 录入舆情</button>
          </div>
        </header>

        <div className="content-area">
          {loading ? <LoadingState /> : (
            <>
              {view === "overview" && <Overview data={data} clusters={clusters} alerts={activeAlerts} country={country} countries={countries} setCountry={setCountry} setView={setView} selectCluster={(key) => { setSelectedCluster(key); setView("events"); }} acknowledge={(id) => post({ action: "acknowledgeAlert", id }, "告警已确认")} />}
              {view === "events" && <EventsView clusters={clusters} selected={selected} onSelect={setSelectedCluster} />}
              {view === "ingest" && <IngestView mentions={filteredMentions} submit={post} />}
              {view === "traffic" && <TrafficView traffic={data.traffic} submit={post} />}
              {view === "coverage" && <CoverageView />}
              {view === "settings" && <SettingsView entities={data.entities} submit={post} />}
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

function Overview({ data, clusters, alerts, country, countries, setCountry, setView, selectCluster, acknowledge }: {
  data: DashboardData;
  clusters: any[];
  alerts: Alert[];
  country: string;
  countries: string[];
  setCountry: (value: string) => void;
  setView: (value: string) => void;
  selectCluster: (value: string) => void;
  acknowledge: (id: number) => void;
}) {
  const globalCountries = new Set(data.mentions.map((item) => item.source_country)).size;
  const highRisk = data.mentions.filter((item) => item.risk >= 70).length;
  const socialCount = data.mentions.filter((item) => item.platform !== "网页新闻").length;

  return <div className="overview-grid">
    <section className="signal-hero panel-dark">
      <div className="hero-copy">
        <div className="live-chip"><i /> LIVE BRIEFING · 过去 24 小时</div>
        <h2>跨境声量正在<br /><em>加速扩散</em></h2>
        <p>Somnia Lab 产品报道从香港进入台湾与泰国，台湾媒体转载密度最高；美国隐私议题出现高风险讨论。</p>
        <div className="hero-actions">
          <button onClick={() => setView("events")}>查看传播事件 <span>↗</span></button>
          <small>系统置信度 <strong>92%</strong></small>
        </div>
      </div>
      <div className="signal-map" aria-label="重点国家信号分布">
        <div className="map-header"><span>GLOBAL SIGNAL DENSITY</span><strong>27 市场</strong></div>
        <div className="node-grid">
          {[["美国", "82", "critical"], ["台湾", "91", "hot"], ["香港", "76", "warm"], ["泰国", "88", "hot"], ["日本", "68", "warm"], ["新加坡", "42", "cool"]].map(([name, score, tone]) => (
            <button key={name} className={`country-node ${tone}`} onClick={() => setCountry(name)}>
              <span>{countryCode[name]}</span><strong>{score}</strong><small>{name}</small>
            </button>
          ))}
        </div>
        <div className="map-legend"><span><i className="dot-critical" />风险</span><span><i className="dot-hot" />高声量</span><span><i className="dot-cool" />常态</span></div>
      </div>
    </section>

    <section className="metric-strip">
      <Metric label="已发现提及" value={String(data.mentions.length).padStart(2, "0")} delta="+38%" note="当前演示数据" />
      <Metric label="独立传播事件" value={String(clusters.length).padStart(2, "0")} delta="+2" note="已自动去重" />
      <Metric label="覆盖国家" value={String(globalCountries).padStart(2, "0")} delta="全球" note="无需逐国配置" />
      <Metric label="高风险信号" value={String(highRisk).padStart(2, "0")} delta="需处理" note="含隐私议题" danger />
      <Metric label="社交内容" value={String(socialCount).padStart(2, "0")} delta="+1" note="跨平台聚合" />
    </section>

    <section className="events-panel surface">
      <div className="section-head">
        <div><p className="eyebrow">STORY CLUSTERS</p><h3>正在传播的事件</h3></div>
        <div className="filter-tabs">
          {countries.slice(0, 4).map((item) => <button key={item} className={country === item ? "active" : ""} onClick={() => setCountry(item)}>{item}</button>)}
        </div>
      </div>
      <div className="event-list">
        {clusters.slice(0, 4).map((cluster: any, index: number) => (
          <button className="event-row" key={cluster.key} onClick={() => selectCluster(cluster.key)}>
            <span className="event-rank">0{index + 1}</span>
            <span className={`risk-pill ${riskClass(cluster.risk)}`}>{riskLabel(cluster.risk)}</span>
            <span className="event-main"><strong>{cluster.title}</strong><small>{cluster.summary}</small></span>
            <span className="event-meta"><strong>{cluster.items.length}</strong><small>条提及</small></span>
            <span className="event-meta"><strong>{cluster.countries.length}</strong><small>个地区</small></span>
            <span className="arrow">↗</span>
          </button>
        ))}
      </div>
      <button className="text-link" onClick={() => setView("events")}>查看全部传播事件 →</button>
    </section>

    <aside className="alerts-panel surface">
      <div className="section-head compact"><div><p className="eyebrow">ACTION QUEUE</p><h3>待处理告警</h3></div><span className="count-chip">{alerts.length}</span></div>
      <div className="alert-list">
        {alerts.slice(0, 3).map((alert) => <article className="alert-card" key={alert.id}>
          <div className="alert-top"><span className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span><small>{alert.country}</small></div>
          <h4>{alert.title}</h4>
          <p>{alert.reason}</p>
          <button onClick={() => acknowledge(alert.id)}>确认处理</button>
        </article>)}
        {alerts.length === 0 && <div className="empty-mini">暂无待处理告警</div>}
      </div>
    </aside>

    <section className="traffic-panel surface">
      <div className="section-head compact"><div><p className="eyebrow">TRAFFIC CORRELATION</p><h3>官网访问异常</h3></div><button className="text-link" onClick={() => setView("traffic")}>查看归因 →</button></div>
      <div className="traffic-bars">
        {data.traffic.slice(0, 4).map((item) => <div className="traffic-row" key={item.id}>
          <div className="traffic-country"><span>{countryCode[item.country] ?? "GL"}</span><strong>{item.country}</strong></div>
          <div className="bar-track"><i style={{ width: `${Math.min(100, item.anomaly_ratio / 6)}%` }} /></div>
          <div className="traffic-value"><strong>{item.visitors.toLocaleString()}</strong><small>{(item.anomaly_ratio / 100).toFixed(1)}× 基线</small></div>
        </div>)}
      </div>
    </section>

    <section className="coverage-mini surface">
      <div className="section-head compact"><div><p className="eyebrow">DATA COVERAGE</p><h3>数据网络</h3></div><button className="text-link" onClick={() => setView("coverage")}>覆盖矩阵 →</button></div>
      <div className="source-health">
        {["全球网页新闻", "X / YouTube", "Instagram / TikTok", "地区性媒体"].map((label, index) => <div key={label}><span><i className={index === 2 ? "partial" : "online"} />{label}</span><strong>{["在线", "在线", "部分覆盖", "在线"][index]}</strong></div>)}
      </div>
    </section>
  </div>;
}

function Metric({ label, value, delta, note, danger = false }: { label: string; value: string; delta: string; note: string; danger?: boolean }) {
  return <article className={danger ? "metric-card danger-card" : "metric-card"}><div><span>{label}</span><b>{delta}</b></div><strong>{value}</strong><small>{note}</small></article>;
}

function EventsView({ clusters, selected, onSelect }: { clusters: any[]; selected: any; onSelect: (key: string) => void }) {
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
        <div className="detail-kicker"><span className={`risk-pill ${riskClass(selected.risk)}`}>{riskLabel(selected.risk)}</span><small>事件 ID · {selected.key.toUpperCase()}</small></div>
        <h2>{selected.title}</h2>
        <p className="detail-summary">{selected.summary}</p>
        <div className="score-board">
          <div><span>影响力</span><strong>{selected.impact}</strong><i style={{ width: `${selected.impact}%` }} /></div>
          <div><span>风险度</span><strong>{selected.risk}</strong><i className="risk-bar" style={{ width: `${selected.risk}%` }} /></div>
          <div><span>归因置信</span><strong>82</strong><i style={{ width: "82%" }} /></div>
        </div>
        <div className="detail-section"><p className="eyebrow">PROPAGATION TIMELINE</p><h3>传播时间线</h3>
          <div className="timeline">{[...selected.items].sort((a: Mention, b: Mention) => a.published_at.localeCompare(b.published_at)).map((item: Mention, index: number) => <article key={item.id}>
            <span className={index === 0 ? "origin" : ""}>{index === 0 ? "首" : index + 1}</span>
            <div><small>{formatDate(item.published_at)} · {item.source_country} · {item.platform}</small><h4>{item.source}</h4><p>{item.title}</p></div>
            <a href={item.url} target="_blank" rel="noreferrer">原文 ↗</a>
          </article>)}</div>
        </div>
      </> : <div className="empty-state">没有符合条件的传播事件</div>}
    </section>
  </div>;
}

function IngestView({ mentions, submit }: { mentions: Mention[]; submit: (payload: Record<string, unknown>, success: string) => Promise<void> }) {
  return <div className="form-layout">
    <DataEntryForm submit={submit} />
    <section className="surface recent-imports">
      <div className="section-head"><div><p className="eyebrow">RECENT INGEST</p><h3>最近进入系统</h3></div><span className="count-chip">{mentions.length}</span></div>
      <div className="import-list">{mentions.slice(0, 8).map((item) => <article key={item.id}><div className="source-avatar">{(countryCode[item.source_country] ?? item.source.slice(0, 2)).toUpperCase()}</div><div><strong>{item.title}</strong><small>{item.source} · {item.platform} · {formatDate(item.published_at)}</small></div><span className={`risk-pill ${riskClass(item.risk)}`}>{item.risk}</span></article>)}</div>
    </section>
  </div>;
}

function DataEntryForm({ submit }: { submit: (payload: Record<string, unknown>, success: string) => Promise<void> }) {
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
    <div className="section-head"><div><p className="eyebrow">MANUAL INGEST</p><h3>录入一条舆情</h3></div><span className="status-note"><i /> 自动分析已开启</span></div>
    <p className="form-intro">粘贴搜索或供应商尚未覆盖的媒体内容，系统会将其纳入国家识别、事件聚类和风险告警。</p>
    <form onSubmit={handleSubmit}>
      <label className="field full"><span>新闻或帖文标题 *</span><input name="title" required placeholder="例如：台湾媒体报道 Somnia Lab 新产品" /></label>
      <label className="field full"><span>原文链接</span><input name="url" type="url" placeholder="https://" /></label>
      <div className="field-row">
        <label className="field"><span>媒体 / 账号 *</span><input name="source" required placeholder="媒体或账号名称" /></label>
        <label className="field"><span>平台</span><select name="platform" defaultValue="网页新闻"><option>网页新闻</option><option>Instagram</option><option>TikTok</option><option>X</option><option>YouTube</option><option>Reddit</option><option>其他</option></select></label>
      </div>
      <div className="field-row thirds">
        <label className="field"><span>来源国家</span><select name="sourceCountry" defaultValue="台湾"><option>台湾</option><option>香港</option><option>泰国</option><option>美国</option><option>日本</option><option>新加坡</option><option>全球</option></select></label>
        <label className="field"><span>内容国家</span><select name="contentCountry" defaultValue="台湾"><option>台湾</option><option>香港</option><option>泰国</option><option>美国</option><option>日本</option><option>全球</option></select></label>
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

function TrafficView({ traffic, submit }: { traffic: Traffic[]; submit: (payload: Record<string, unknown>, success: string) => Promise<void> }) {
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
        <label className="field full"><span>国家/地区</span><select name="country" defaultValue="台湾"><option>台湾</option><option>香港</option><option>泰国</option><option>美国</option><option>日本</option><option>新加坡</option></select></label>
        <div className="field-row thirds"><label className="field"><span>访客数</span><input name="visitors" required type="number" min="0" placeholder="4433" /></label><label className="field"><span>浏览量</span><input name="views" required type="number" min="0" placeholder="23925" /></label><label className="field"><span>历史基线</span><input name="baseline" required type="number" min="1" placeholder="860" /></label></div>
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

function CoverageView() {
  const rows = [
    ["全球网页新闻", "210+", "100+", "< 15 min", "完整", "online"],
    ["X / Twitter", "全球", "40+", "< 10 min", "授权 API", "online"],
    ["YouTube", "全球", "80+", "< 30 min", "公开搜索", "online"],
    ["Instagram", "主要市场", "30+", "供应商延迟", "部分覆盖", "partial"],
    ["TikTok", "主要市场", "25+", "最长 48 h", "部分覆盖", "partial"],
    ["微博 / 微信 / 小红书", "中国大陆", "中文", "供应商延迟", "待授权", "pending"],
    ["LINE / Naver / Kakao", "亚太", "8+", "供应商延迟", "部分覆盖", "partial"],
  ];
  return <div className="coverage-page">
    <section className="coverage-hero panel-dark"><div><p className="eyebrow">GLOBAL COVERAGE MATRIX</p><h2>国家无需逐个添加。<br /><em>覆盖缺口必须透明。</em></h2><p>系统对所有国家使用统一数据模型；实际可见内容取决于公开权限、供应商授权和平台政策。</p></div><div className="coverage-score"><span>GLOBAL READINESS</span><strong>87<small>%</small></strong><i><b style={{ width: "87%" }} /></i><p>5 个连接器在线 · 2 个待授权</p></div></section>
    <section className="surface coverage-table-wrap"><div className="section-head"><div><p className="eyebrow">SOURCE × REGION × LATENCY</p><h3>数据源覆盖矩阵</h3></div><button className="secondary-button">导出矩阵</button></div><div className="coverage-table"><div className="coverage-row header"><span>数据网络</span><span>覆盖地区</span><span>语言</span><span>典型延迟</span><span>状态</span></div>{rows.map((row) => <div className="coverage-row" key={row[0]}><strong><i className={row[5]} />{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><b className={`coverage-state ${row[5]}`}>{row[4]}</b></div>)}</div></section>
    <section className="coverage-notes"><article><span>01</span><h4>全球统一模型</h4><p>国家、语言和平台都是内容属性，新国家自动进入处理流程。</p></article><article><span>02</span><h4>多供应商底座</h4><p>授权数据源为主，官方 API 与公开网页连接器用于交叉验证。</p></article><article><span>03</span><h4>证据优先</h4><p>无法合法获取的数据明确标记，不用推测填补覆盖缺口。</p></article></section>
  </div>;
}

function SettingsView({ entities, submit }: { entities: Entity[]; submit: (payload: Record<string, unknown>, success: string) => Promise<void> }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await submit({ action: "addEntity", ...values }, "监测词已加入全球查询词典");
    event.currentTarget.reset();
  }
  return <div className="settings-grid">
    <section className="surface entity-panel"><div className="section-head"><div><p className="eyebrow">ENTITY DICTIONARY</p><h3>全球监测词典</h3></div><span className="count-chip">{entities.length}</span></div><p className="form-intro">公司名、产品、人物、域名和事件指纹会自动扩展为各语言查询。</p><form className="inline-form" onSubmit={handleSubmit}><select name="type" defaultValue="关键词"><option>公司</option><option>产品</option><option>人物</option><option>域名</option><option>事件指纹</option><option>排除词</option></select><input name="value" required placeholder="输入新的监测词" /><select name="language" defaultValue="通用"><option>通用</option><option>英文</option><option>简体中文</option><option>繁体中文</option><option>泰语</option><option>日语</option></select><button className="primary-button">添加</button></form><div className="entity-list">{entities.map((item) => <div key={item.id}><span className="entity-type">{item.type}</span><strong>{item.value}</strong><small>{item.language}</small><i>启用</i></div>)}</div></section>
    <aside className="surface rule-panel"><div className="section-head compact"><div><p className="eyebrow">AUTOMATION</p><h3>自动化规则</h3></div></div>{[
      ["跨国传播告警", "首次进入新国家时立即通知", true], ["负面风险升级", "风险分 ≥ 70 时通知负责人", true], ["流量异常反查", "访问量 ≥ 3× 基线时搜索当地媒体", true], ["普通转载静默", "重复转载只更新事件，不重复通知", true], ["自动对外回复", "需要人工审批", false],
    ].map(([title, desc, active]) => <div className="rule-row" key={String(title)}><div><strong>{title}</strong><small>{desc}</small></div><button className={active ? "toggle on" : "toggle"} aria-label={`${title}开关`}><i /></button></div>)}</aside>
  </div>;
}

function QuickAdd({ close, submit }: { close: () => void; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await submit({ action: "createMention", ...values, risk: 35, impact: 60, sentiment: "中性", language: "自动识别", contentCountry: values.sourceCountry, publishedAt: new Date().toISOString(), clusterKey: `quick-${Date.now()}` }); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={close}><section className="quick-modal" role="dialog" aria-modal="true" aria-label="快速录入舆情" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">QUICK CAPTURE</p><h3>快速录入舆情</h3></div><button onClick={close} aria-label="关闭">×</button></div><form onSubmit={handleSubmit}><label className="field full"><span>标题 *</span><input name="title" autoFocus required placeholder="粘贴新闻或帖子标题" /></label><label className="field full"><span>原文链接</span><input name="url" type="url" placeholder="https://" /></label><div className="field-row"><label className="field"><span>媒体 / 账号 *</span><input name="source" required placeholder="来源名称" /></label><label className="field"><span>平台</span><select name="platform"><option>网页新闻</option><option>Instagram</option><option>TikTok</option><option>X</option><option>YouTube</option></select></label></div><label className="field full"><span>来源国家</span><select name="sourceCountry"><option>台湾</option><option>香港</option><option>泰国</option><option>美国</option><option>日本</option><option>全球</option></select></label><label className="field full"><span>简要内容</span><textarea name="summary" rows={3} placeholder="可选；系统将据此辅助分类" /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={close}>取消</button><button className="primary-button" disabled={busy}>{busy ? "分析中…" : "保存并分析"}</button></div></form></section></div>;
}
