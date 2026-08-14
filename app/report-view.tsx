"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

type Mention = {
  id: number; title: string; url: string; source: string; platform: string; source_country: string; sentiment: string;
  emotion: string; risk: number; impact: number; engagement: number; published_at: string; cluster_key: string; keywords: string;
};
type CountryStat = { country: string; count: number; positive: number; neutral: number; negative: number; risk: number; engagement: number; latest: string };
type Analytics = {
  countries: CountryStat[];
  sentiment: { positive: number; neutral: number; negative: number; mixed: number };
  emotions: Array<{ label: string; count: number }>;
  timeline: Array<{ date: string; total: number; positive: number; negative: number }>;
  words: Array<{ word: string; count: number }>;
  sources: Array<{ source: string; country: string; count: number; impact: number }>;
  crossBorderEdges: number;
};
type StoryCluster = { key: string; items: Mention[]; title: string; risk: number; impact: number; countries: string[]; platforms: string[]; latest: string; originCountry: string; originSource: string };
type CommentRow = { id: number; content: string; sentiment: string; emotion: string; topic: string; likes: number; platform: string; author_username: string; post_title: string };
type CommentData = {
  summary: { total: number; authors: number; likes: number; replies: number; positive: number; neutral: number; negative: number; mixed: number; coverage: number };
  emotions: Array<{ label: string; count: number }>;
  topics: Array<{ topic: string; count: number; negative: number }>;
  words: Array<{ word: string; count: number }>;
  topPosts: Array<{ mention_id: number; title: string; source: string; comments: number; negative: number; likes: number }>;
  riskComments: CommentRow[];
};

type ReportViewProps = {
  brand: { name: string };
  workspaceName: string;
  mentions: Mention[];
  analytics: Analytics;
  clusters: StoryCluster[];
  countryCodes: Record<string, string>;
};

const emptyComments: CommentData = {
  summary: { total: 0, authors: 0, likes: 0, replies: 0, positive: 0, neutral: 0, negative: 0, mixed: 0, coverage: 0 },
  emotions: [], topics: [], words: [], topPosts: [], riskComments: [],
};
const platformColors: Record<string, string> = {
  "网页新闻": "#1f291c", Instagram: "#d76ea9", Facebook: "#6e93df", TikTok: "#42c8bd", X: "#8c96a0", YouTube: "#e8665c",
};
const sentimentColors: Record<string, string> = { 正面: "#6f963e", 中性: "#aeb4aa", 负面: "#d65a4a", 混合: "#d2a33f" };

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}
function fullDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
function pct(value: number, total: number) { return total ? Math.round(value / total * 100) : 0; }
function safeFileName(value: string) { return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 60) || "brand"; }
function keywordEntries(value: string) {
  try {
    const parsed = JSON.parse(value || "[]") as Array<{ word?: string; count?: number }>;
    return parsed.filter((item) => item.word && Number(item.count) > 0).map((item) => ({ word: String(item.word), count: Number(item.count) }));
  } catch { return []; }
}

function ReportHeader({ section, brand, period }: { section: string; brand: string; period: string }) {
  return <header className="report-page-header"><div><b>SIGNAL ATLAS</b><span>MEDIA INTELLIGENCE REPORT</span></div><div><strong>{section}</strong><span>{brand} · {period}</span></div></header>;
}

function ReportFooter({ page, generatedAt }: { page: number; generatedAt: string }) {
  return <footer className="report-page-footer"><span>数据口径：共享工作区已归档网页新闻、社媒帖子与已实际采集的公开评论</span><span>{generatedAt} · {String(page).padStart(2, "0")}</span></footer>;
}

function ReportMap({ countries, countryCodes }: { countries: CountryStat[]; countryCodes: Record<string, string> }) {
  const [markup, setMarkup] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch("/world-map-flat.svg").then((response) => response.text()).then((source) => {
      const doc = new DOMParser().parseFromString(source, "image/svg+xml");
      const smallRegionAnchors: Record<string, { x: number; y: number }> = {
        hk: { x: 680.5, y: 463.5 },
        tw: { x: 694.5, y: 458.5 },
      };
      const max = Math.max(1, ...countries.map((item) => item.count));
      for (const path of doc.querySelectorAll<SVGPathElement>("path")) {
        path.style.fill = "#d9ddd4"; path.style.stroke = "#ffffff"; path.style.strokeWidth = "0.7";
      }
      for (const item of countries) {
        const code = countryCodes[item.country]?.toLowerCase();
        const node = code ? doc.getElementById(code) as unknown as SVGGraphicsElement | null : null;
        const colors = ["#dce9bc", "#bed27f", "#91ad52", "#5f7d30", "#263c19"];
        const color = colors[Math.min(4, Math.max(0, Math.ceil(item.count / max * colors.length) - 1))];
        if (node) {
          const shapes = node.matches("path, circle, polygon") ? [node as unknown as SVGElement] : [...node.querySelectorAll<SVGElement>("path, circle, polygon")];
          for (const shape of shapes) { shape.style.fill = color; shape.style.opacity = "1"; }
        }
        const anchor = code ? smallRegionAnchors[code] : null;
        if (anchor) {
          const locator = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
          locator.setAttribute("cx", String(anchor.x)); locator.setAttribute("cy", String(anchor.y)); locator.setAttribute("r", "7");
          locator.setAttribute("fill", color); locator.setAttribute("stroke", "#ffffff"); locator.setAttribute("stroke-width", "2");
          doc.documentElement.appendChild(locator);
        }
      }
      const svg = doc.documentElement;
      svg.removeAttribute("width"); svg.removeAttribute("height"); svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      if (!cancelled) setMarkup(new XMLSerializer().serializeToString(svg));
    }).catch(() => { if (!cancelled) setMarkup(""); });
    return () => { cancelled = true; };
  }, [countries, countryCodes]);
  return <div className="report-map" aria-label="平面世界报道热力图">{markup ? <div dangerouslySetInnerHTML={{ __html: markup }} /> : <span>正在生成地区热力图…</span>}</div>;
}

function BarRows({ items, max, tone = "green" }: { items: Array<{ label: string; value: number; note?: string; color?: string }>; max: number; tone?: string }) {
  return <div className={`report-bar-rows ${tone}`}>{items.map((item) => <article key={item.label}><div><strong>{item.label}</strong><span>{item.note}</span></div><i><b style={{ width: `${Math.max(2, item.value / Math.max(1, max) * 100)}%`, background: item.color }} /></i><em>{item.value.toLocaleString()}</em></article>)}</div>;
}

function ReportKpi({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <article className={accent ? "report-kpi accent" : "report-kpi"}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export default function ReportView({ brand, workspaceName, mentions, analytics, clusters, countryCodes }: ReportViewProps) {
  const [range, setRange] = useState("30");
  const [title, setTitle] = useState("品牌舆情数据分析报告");
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [includeAppendix, setIncludeAppendix] = useState(true);
  const [comments, setComments] = useState<CommentData>(emptyComments);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const [reportEpoch] = useState(() => Date.now());
  const generatedAt = useMemo(() => fullDate(new Date(reportEpoch).toISOString()), [reportEpoch]);
  const rangeDays = range === "all" ? 0 : Number(range);
  const cutoff = rangeDays ? reportEpoch - rangeDays * 86400_000 : 0;
  const scopedMentions = useMemo(() => mentions.filter((item) => !cutoff || new Date(item.published_at).getTime() >= cutoff), [cutoff, mentions]);
  const period = range === "all" ? "全部历史" : `过去 ${range} 天`;

  useEffect(() => {
    if (!includeComments) return;
    const controller = new AbortController();
    const loadingTimer = window.setTimeout(() => setCommentsLoading(true), 0);
    const apiRange = range === "all" ? "0" : range;
    fetch(`/api/comments?range=${apiRange}&sort=risk&page=1`, { signal: controller.signal }).then(async (response) => {
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "评论数据读取失败"); return payload as CommentData;
    }).then(setComments).catch((error) => { if (error?.name !== "AbortError") setComments(emptyComments); })
      .finally(() => { if (!controller.signal.aborted) setCommentsLoading(false); });
    return () => { window.clearTimeout(loadingTimer); controller.abort(); };
  }, [includeComments, range]);

  const report = useMemo(() => {
    const total = scopedMentions.length;
    const byPlatform = new Map<string, number>(); const byCountry = new Map<string, CountryStat>(); const bySource = new Map<string, { source: string; country: string; count: number; impact: number }>();
    const sentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    const emotion = new Map<string, number>(); const timeline = new Map<string, { total: number; negative: number }>(); const words = new Map<string, number>();
    for (const item of scopedMentions) {
      byPlatform.set(item.platform, (byPlatform.get(item.platform) ?? 0) + 1);
      const country = byCountry.get(item.source_country) ?? { country: item.source_country, count: 0, positive: 0, neutral: 0, negative: 0, risk: 0, engagement: 0, latest: "" };
      country.count += 1; country.risk = Math.max(country.risk, item.risk); country.engagement += Number(item.engagement || 0); country.latest = country.latest > item.published_at ? country.latest : item.published_at;
      if (item.sentiment === "正面") { sentiment.positive += 1; country.positive += 1; }
      else if (item.sentiment === "负面") { sentiment.negative += 1; country.negative += 1; }
      else if (item.sentiment === "混合") sentiment.mixed += 1;
      else { sentiment.neutral += 1; country.neutral += 1; }
      byCountry.set(item.source_country, country);
      const source = bySource.get(item.source) ?? { source: item.source, country: item.source_country, count: 0, impact: 0 };
      source.count += 1; source.impact = Math.max(source.impact, item.impact); bySource.set(item.source, source);
      emotion.set(item.emotion || "中性陈述", (emotion.get(item.emotion || "中性陈述") ?? 0) + 1);
      const day = item.published_at.slice(0, 10); const daily = timeline.get(day) ?? { total: 0, negative: 0 }; daily.total += 1; if (item.sentiment === "负面") daily.negative += 1; timeline.set(day, daily);
      for (const word of keywordEntries(item.keywords)) words.set(word.word, (words.get(word.word) ?? 0) + word.count);
    }
    const ids = new Set(scopedMentions.map((item) => item.id));
    const scopedClusters = clusters.map((cluster) => ({ ...cluster, items: cluster.items.filter((item) => ids.has(item.id)) })).filter((cluster) => cluster.items.length > 0).sort((a, b) => b.items.length - a.items.length || b.risk - a.risk);
    return {
      total, sentiment,
      platforms: [...byPlatform].map(([label, value]) => ({ label, value, color: platformColors[label] ?? "#aab0a4" })).sort((a, b) => b.value - a.value),
      countries: [...byCountry.values()].sort((a, b) => b.count - a.count),
      sources: [...bySource.values()].sort((a, b) => b.count - a.count || b.impact - a.impact),
      emotions: [...emotion].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      timeline: [...timeline].map(([date, value]) => ({ date, ...value })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      words: [...words].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 24),
      clusters: scopedClusters,
      highRisk: scopedMentions.filter((item) => item.risk >= 70).sort((a, b) => b.risk - a.risk),
    };
  }, [clusters, scopedMentions]);

  const maxPlatform = Math.max(1, ...report.platforms.map((item) => item.value));
  const maxCountry = Math.max(1, ...report.countries.map((item) => item.count));
  const maxSource = Math.max(1, ...report.sources.map((item) => item.count));
  const maxEmotion = Math.max(1, ...report.emotions.map((item) => item.value));
  const maxDay = Math.max(1, ...report.timeline.map((item) => item.total));
  const topCountry = report.countries[0]; const topPlatform = report.platforms[0]; const topEvent = report.clusters[0];
  const netSentiment = pct(report.sentiment.positive - report.sentiment.negative, Math.max(1, report.total));
  const commentTotal = comments.summary.total;
  const commentNet = pct(comments.summary.positive - comments.summary.negative, Math.max(1, commentTotal));
  const reportWords = report.words.length ? report.words : analytics.words.slice(0, 24);
  const reportPages = 5 + Number(includeEvents) + Number(includeComments) + Number(includeAppendix);

  const insights = [
    report.total ? `${period}共归档 ${report.total} 条品牌相关内容，覆盖 ${report.countries.length} 个国家或地区、${report.platforms.length} 类渠道。` : `${period}尚未归档到符合条件的品牌相关内容。`,
    topCountry ? `${topCountry.country}是报道最集中的市场，共 ${topCountry.count} 条，占本期 ${pct(topCountry.count, report.total)}%。` : "地区样本不足，暂不能判断核心传播市场。",
    topEvent ? `传播规模最大的事件包含 ${topEvent.items.length} 个节点，从${topEvent.originCountry}的${topEvent.originSource}开始，覆盖 ${topEvent.countries.length} 个地区。` : "本期尚未形成可比较的传播事件。",
    report.highRisk.length ? `发现 ${report.highRisk.length} 条风险分不低于 70 的内容，建议优先复核${report.highRisk[0].source}发布的相关信息。` : "本期未发现风险分不低于 70 的高风险内容。",
  ];

  async function exportPdf() {
    const root = reportRef.current; if (!root || exporting) return;
    setExporting(true); setExportError("");
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const pages = [...root.querySelectorAll<HTMLElement>(".report-sheet")];
      if (!pages.length) throw new Error("报告页面尚未生成");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      for (let index = 0; index < pages.length; index += 1) {
        const canvas = await html2canvas(pages[index], { scale: 1.7, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 1122, height: 793 });
        if (index > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", .93), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      }
      pdf.save(`${safeFileName(brand.name)}-${safeFileName(title)}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) { setExportError(error instanceof Error ? error.message : "PDF 生成失败"); }
    finally { setExporting(false); }
  }

  return <div className="report-center">
    <section className="surface report-builder">
      <div><p className="eyebrow">AUTOMATED REPORTING</p><h2>自动舆情分析报告</h2><p>系统按当前共享工作区的真实档案自动生成管理摘要、渠道、地区、情绪、事件传播、受众舆情与证据附录。</p></div>
      <div className="report-controls">
        <label><span>报告名称</span><input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 50))} /></label>
        <label><span>统计周期</span><select value={range} onChange={(event) => setRange(event.target.value)}><option value="7">过去 7 天</option><option value="30">过去 30 天</option><option value="all">全部历史</option></select></label>
        <div className="report-options"><label><input type="checkbox" checked={includeEvents} onChange={(event) => setIncludeEvents(event.target.checked)} /> 事件与传播</label><label><input type="checkbox" checked={includeComments} onChange={(event) => setIncludeComments(event.target.checked)} /> 受众舆情</label><label><input type="checkbox" checked={includeAppendix} onChange={(event) => setIncludeAppendix(event.target.checked)} /> 证据附录</label></div>
        <button className="primary-button" disabled={exporting || commentsLoading} onClick={() => void exportPdf()}>{exporting ? "正在生成 PDF…" : commentsLoading ? "正在汇总评论…" : `导出 PDF · ${reportPages} 页`}</button>
      </div>
      {exportError && <p className="report-export-error">{exportError}</p>}
    </section>

    <div className="report-preview-heading"><div><p className="eyebrow">LIVE PREVIEW</p><h3>报告实时预览</h3></div><span>横向 A4 · {reportPages} 页 · 数据生成于 {generatedAt}</span></div>
    <div className="report-preview-scroll"><div className="report-document" ref={reportRef}>
      <section className="report-sheet report-cover">
        <div className="report-cover-mark"><span /><span /><span /></div><div className="report-cover-copy"><p>SIGNAL ATLAS / MEDIA INTELLIGENCE</p><h1>{title || "品牌舆情数据分析报告"}</h1><h2>{brand.name}</h2><div className="report-cover-period"><span>{period}</span><b>{scopedMentions.length ? `${shortDate(scopedMentions.at(-1)?.published_at ?? "")} — ${shortDate(scopedMentions[0]?.published_at ?? "")}` : "等待数据"}</b></div><div className="report-cover-scope">{Object.keys(platformColors).map((item) => <span key={item}><i style={{ background: platformColors[item] }} />{item}</span>)}</div></div>
        <div className="report-cover-meta"><div><span>WORKSPACE</span><strong>{workspaceName}</strong></div><div><span>GENERATED</span><strong>{generatedAt}</strong></div><div><span>DATA POLICY</span><strong>仅使用已归档与已实际采集数据</strong></div></div>
      </section>

      <section className="report-sheet">
        <ReportHeader section="01 / 管理摘要" brand={brand.name} period={period} />
        <div className="report-page-body"><div className="report-title-row"><div><p>EXECUTIVE SUMMARY</p><h2>本期舆情概览</h2></div><span>先结论，后证据</span></div>
          <div className="report-kpi-grid"><ReportKpi label="归档内容" value={report.total.toLocaleString()} note={`${report.platforms.length} 类渠道`} /><ReportKpi label="国家 / 地区" value={String(report.countries.length)} note={topCountry ? `${topCountry.country}最多` : "等待样本"} /><ReportKpi label="传播事件" value={String(report.clusters.length)} note={topEvent ? `最大 ${topEvent.items.length} 个节点` : "尚未形成"} /><ReportKpi label="净情绪指数" value={`${netSentiment > 0 ? "+" : ""}${netSentiment}`} note="正面占比减负面占比" accent={netSentiment < -15} /><ReportKpi label="高风险内容" value={String(report.highRisk.length)} note="风险分 ≥ 70" accent={report.highRisk.length > 0} /></div>
          <div className="report-summary-layout"><section><h3>自动研判</h3><ol>{insights.map((item, index) => <li key={item}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></li>)}</ol></section><aside><h3>风险雷达</h3><div className="report-risk-score"><strong>{report.highRisk[0]?.risk ?? 0}</strong><span>本期最高风险分</span></div><div className="report-risk-list">{report.highRisk.slice(0, 3).map((item) => <article key={item.id}><span>{item.source_country} · {item.source}</span><strong>{item.title}</strong><small>{item.emotion || item.sentiment} · {shortDate(item.published_at)}</small></article>)}{!report.highRisk.length && <p>未发现需要立即复核的高风险内容。</p>}</div></aside></div>
        </div><ReportFooter page={2} generatedAt={generatedAt} />
      </section>

      <section className="report-sheet">
        <ReportHeader section="02 / 声量与渠道" brand={brand.name} period={period} />
        <div className="report-page-body"><div className="report-title-row"><div><p>VOLUME & CHANNELS</p><h2>报道声量、平台与媒体来源</h2></div><span>{report.total} 条有效归档</span></div>
          <div className="report-volume-grid"><section><h3>每日内容量 / 负面占比</h3><div className="report-timeline">{report.timeline.map((day) => <div key={day.date}><span><b style={{ height: `${Math.max(4, day.total / maxDay * 100)}%` }}><i style={{ height: `${pct(day.negative, day.total)}%` }} /></b></span><small>{day.date.slice(5)}</small></div>)}{!report.timeline.length && <p>本期暂无趋势数据</p>}</div><div className="report-chart-legend"><span><i />全部内容</span><span><i className="negative" />负面内容</span></div></section><section><h3>渠道构成</h3><BarRows items={report.platforms.slice(0, 8)} max={maxPlatform} /></section></div>
          <div className="report-ranking-table"><header><span>排名</span><span>媒体 / 账号</span><span>地区</span><span>内容量</span><span>最高影响力</span><span>集中度</span></header>{report.sources.slice(0, 8).map((item, index) => <article key={item.source}><b>{String(index + 1).padStart(2, "0")}</b><strong>{item.source}</strong><span>{item.country}</span><em>{item.count}</em><span>{item.impact}</span><i><b style={{ width: `${item.count / maxSource * 100}%` }} /></i></article>)}</div>
        </div><ReportFooter page={3} generatedAt={generatedAt} />
      </section>

      <section className="report-sheet">
        <ReportHeader section="03 / 地区分布" brand={brand.name} period={period} />
        <div className="report-page-body"><div className="report-title-row"><div><p>GEOGRAPHIC INTELLIGENCE</p><h2>全球报道热力与市场结构</h2></div><span>媒体发布地区，不等同于内容提及地区</span></div>
          <div className="report-geo-layout"><section><ReportMap countries={report.countries} countryCodes={countryCodes} /><div className="report-map-legend"><span>报道较少</span><i /><i /><i /><i /><i /><span>报道最多</span></div></section><aside><h3>主要市场</h3><BarRows items={report.countries.slice(0, 9).map((item) => ({ label: item.country, value: item.count, note: `${pct(item.count, report.total)}% · 风险 ${item.risk}` }))} max={maxCountry} /></aside></div>
          <div className="report-geo-kpis"><ReportKpi label="首要市场" value={topCountry?.country ?? "—"} note={topCountry ? `${topCountry.count} 条报道` : "等待样本"} /><ReportKpi label="跨境传播边" value={String(analytics.crossBorderEdges)} note="已识别的地区间复制链路" /><ReportKpi label="地区覆盖" value={String(report.countries.length)} note="含已可信推断地区" /><ReportKpi label="首要渠道" value={topPlatform?.label ?? "—"} note={topPlatform ? `${topPlatform.value} 条内容` : "等待样本"} /></div>
        </div><ReportFooter page={4} generatedAt={generatedAt} />
      </section>

      <section className="report-sheet">
        <ReportHeader section="04 / 情绪与议题" brand={brand.name} period={period} />
        <div className="report-page-body"><div className="report-title-row"><div><p>SENTIMENT & THEMES</p><h2>报道情绪、具体意图与高频议题</h2></div><span>机器研判需结合原文复核</span></div>
          <div className="report-sentiment-grid"><section><h3>情绪结构</h3><div className="report-donut" style={{ "--positive": pct(report.sentiment.positive, report.total), "--neutral": pct(report.sentiment.neutral, report.total), "--negative": pct(report.sentiment.negative, report.total) } as CSSProperties}><div><strong>{netSentiment > 0 ? `+${netSentiment}` : netSentiment}</strong><span>净情绪指数</span></div></div><div className="report-sentiment-legend">{[["正面", report.sentiment.positive], ["中性", report.sentiment.neutral], ["负面", report.sentiment.negative], ["混合", report.sentiment.mixed]].map(([label, value]) => <article key={String(label)}><i style={{ background: sentimentColors[String(label)] }} /><span>{label}</span><strong>{Number(value)} · {pct(Number(value), report.total)}%</strong></article>)}</div></section><section><h3>具体情绪与行动意图</h3><BarRows items={report.emotions.slice(0, 9)} max={maxEmotion} tone="emotion" /></section><section><h3>高频议题</h3><div className="report-word-cloud">{reportWords.map((item, index) => <span key={item.word} className={index < 5 ? "hot" : ""} style={{ fontSize: `${13 + item.count / Math.max(1, reportWords[0]?.count ?? 1) * 20}px` }}>{item.word}<sup>{item.count}</sup></span>)}{!reportWords.length && <p>本期暂无可统计的有效议题词</p>}</div></section></div>
          <div className="report-method-note"><strong>判读口径</strong><span>极性用于快速筛查；“担忧、质疑、期待、好奇、购买意向、嘲讽”等具体情绪和行动意图更适合支持公关决策。词频已过滤中英文常见虚词与品牌名。</span></div>
        </div><ReportFooter page={5} generatedAt={generatedAt} />
      </section>

      {includeEvents && <section className="report-sheet">
        <ReportHeader section="05 / 事件与传播" brand={brand.name} period={period} />
        <div className="report-page-body"><div className="report-title-row"><div><p>EVENT PROPAGATION</p><h2>同一事件识别与跨地区扩散</h2></div><span>时间顺序 + 标题正文重合 + 实体主题指纹</span></div>
          {topEvent ? <><div className="report-event-focus"><div><span>本期最大传播事件</span><h3>{topEvent.title}</h3><p>首发：{topEvent.originSource}（{topEvent.originCountry}） · {topEvent.items.length} 个节点 · {topEvent.countries.length} 个地区 · 风险 {topEvent.risk}</p></div><strong>{topEvent.items.length}</strong></div><div className="report-route">{topEvent.items.slice(0, 6).map((item, index) => <div key={item.id}><article style={{ borderTopColor: platformColors[item.platform] ?? "#aab0a4" }}><span>{String(index + 1).padStart(2, "0")} · {item.platform}</span><strong>{item.source}</strong><small>{item.source_country} · {fullDate(item.published_at)}</small></article>{index < Math.min(5, topEvent.items.length - 1) && <b>→</b>}</div>)}</div></> : <div className="report-empty">本期尚未形成可视化传播事件。</div>}
          <div className="report-event-table"><header><span>事件</span><span>首发来源</span><span>地区</span><span>节点</span><span>平台</span><span>风险</span></header>{report.clusters.slice(0, 7).map((cluster) => <article key={cluster.key}><strong>{cluster.title}</strong><span>{cluster.originSource}</span><span>{cluster.countries.length}</span><em>{cluster.items.length}</em><span>{cluster.platforms.join(" / ")}</span><b>{cluster.risk}</b></article>)}</div>
        </div><ReportFooter page={6} generatedAt={generatedAt} />
      </section>}

      {includeComments && <section className="report-sheet">
        <ReportHeader section="06 / 受众舆情" brand={brand.name} period={period} />
        <div className="report-page-body"><div className="report-title-row"><div><p>COMMENT INTELLIGENCE</p><h2>受众反馈、核心议题与风险评论</h2></div><span>仅统计实际取得的公开评论文本</span></div>
          <div className="report-kpi-grid comments"><ReportKpi label="已分析评论" value={commentTotal.toLocaleString()} note={`${comments.summary.authors} 位公开参与者`} /><ReportKpi label="净情绪指数" value={`${commentNet > 0 ? "+" : ""}${commentNet}`} note="正面占比减负面占比" accent={commentNet < -15} /><ReportKpi label="负面评论" value={`${pct(comments.summary.negative, commentTotal)}%`} note={`${comments.summary.negative} 条`} accent={comments.summary.negative > commentTotal * .2} /><ReportKpi label="评论互动" value={(comments.summary.likes + comments.summary.replies).toLocaleString()} note="获赞与回复合计" /><ReportKpi label="采集覆盖" value={`${comments.summary.coverage}%`} note="已归档 / 平台披露" /></div>
          {commentTotal ? <div className="report-comments-layout"><section><h3>核心讨论议题</h3><BarRows items={comments.topics.slice(0, 8).map((item) => ({ label: item.topic, value: item.count, note: `${item.negative ? pct(item.negative, item.count) : 0}% 负面` }))} max={Math.max(1, ...comments.topics.map((item) => item.count))} /></section><section><h3>评论高频词</h3><div className="report-word-cloud compact">{comments.words.slice(0, 25).map((item, index) => <span key={item.word} className={index < 5 ? "hot" : ""} style={{ fontSize: `${12 + item.count / Math.max(1, comments.words[0]?.count ?? 1) * 18}px` }}>{item.word}<sup>{item.count}</sup></span>)}</div></section><section className="report-risk-comments"><h3>优先复核评论</h3>{comments.riskComments.slice(0, 4).map((item) => <article key={item.id}><header><span>{item.sentiment} · {item.emotion}</span><b>{item.platform} · {item.likes} 赞</b></header><p>{item.content}</p><small>{item.author_username ? `@${item.author_username}` : "公开账号"} · {item.post_title}</small></article>)}</section></div> : <div className="report-empty"><strong>本期没有可用于分析的公开评论文本</strong><span>平台显示的评论总数不会被冒充为已分析样本；连接器取得正文后，报告会自动补充情绪、议题、词频和风险评论。</span></div>}
        </div><ReportFooter page={includeEvents ? 7 : 6} generatedAt={generatedAt} />
      </section>}

      {includeAppendix && <section className="report-sheet">
        <ReportHeader section="附录 / 核心证据" brand={brand.name} period={period} />
        <div className="report-page-body"><div className="report-title-row"><div><p>EVIDENCE APPENDIX</p><h2>重点新闻与社媒原文索引</h2></div><span>按风险与发布时间排序</span></div>
          <div className="report-appendix-table"><header><span>发布时间</span><span>平台</span><span>标题 / 原文</span><span>媒体 / 账号</span><span>地区</span><span>情绪</span><span>风险</span></header>{[...scopedMentions].sort((a, b) => b.risk - a.risk || b.published_at.localeCompare(a.published_at)).slice(0, 12).map((item) => <article key={item.id}><span>{fullDate(item.published_at)}</span><b style={{ color: platformColors[item.platform] ?? "#596156" }}>{item.platform}</b><strong>{item.title}</strong><span>{item.source}</span><span>{item.source_country}</span><span>{item.emotion || item.sentiment}</span><em>{item.risk}</em></article>)}</div>
          <div className="report-method-note"><strong>方法与限制</strong><span>传播边是基于时间、文本相似度、实体和来源证据的可解释推断，不代表媒体确认转载关系；情绪结论用于舆情筛查，不替代人工定性；互动量仅在平台公开或连接器实际取得时统计。</span></div>
        </div><ReportFooter page={reportPages} generatedAt={generatedAt} />
      </section>}
    </div></div>
  </div>;
}
