import { comesFromOfficialAccount } from "./official-accounts";
import type { MonitoringCandidate } from "./providers";

type MediaRow = {
  id: number;
  title: string;
  url: string;
  source: string;
  platform: string;
  source_country: string;
  published_at: string;
  engagement: number;
};

type EventWindow = {
  eventKey: string;
  peakDate: string;
  startDate: string;
  endDate: string;
  peakCount: number;
  baselineCount: number;
  spikeRatio: number;
};

const ONE_DAY = 24 * 3600_000;

function dateOnly(value: string | Date) {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function addDays(date: string, offset: number) {
  return dateOnly(new Date(new Date(`${date}T12:00:00Z`).getTime() + offset * ONE_DAY));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function findOverlappingEventKey(db: D1Database, brandId: number, startDate: string, endDate: string) {
  const existing = await db.prepare(`SELECT event_key FROM search_event_windows
    WHERE brand_id = ? AND status IN ('active','confirmed')
      AND date(start_date) <= date(?) AND date(end_date) >= date(?)
    ORDER BY CASE trigger_source WHEN 'gsc' THEN 0 WHEN 'social_spike' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      ABS(julianday(start_date) - julianday(?)) ASC LIMIT 1`)
    .bind(brandId, endDate, startDate, startDate).first<{ event_key: string }>();
  return existing?.event_key ?? "";
}

export function detectMediaEventWindows(rows: Array<Pick<MediaRow, "published_at">>, today = dateOnly(new Date())) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = dateOnly(row.published_at);
    if (validDate(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const observedDays = [...counts.keys()].sort();
  if (!observedDays.length) return [] as EventWindow[];
  const firstDay = observedDays[0];
  const lastObservedDay = observedDays.at(-1) ?? firstDay;
  const lastDay = lastObservedDay > today ? lastObservedDay : today;
  const series: Array<{ date: string; count: number }> = [];
  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) series.push({ date: day, count: counts.get(day) ?? 0 });

  const windows: EventWindow[] = [];
  let index = 7;
  while (index < series.length) {
    const history = series.slice(Math.max(0, index - 21), index).map((item) => item.count);
    const baseline = median(history);
    const previous = series[index - 1]?.count ?? baseline;
    const current = series[index].count;
    const threshold = Math.max(3, Math.ceil(baseline * 2), Math.ceil(baseline + 2));
    const obviousRise = current >= threshold && current >= previous + 1;
    if (!obviousRise) { index += 1; continue; }

    const start = index;
    const continuationFloor = Math.max(2, Math.ceil(baseline + 1));
    let end = start;
    let quietDays = 0;
    for (let cursor = start + 1; cursor < series.length; cursor += 1) {
      if (series[cursor].count >= continuationFloor) { end = cursor; quietDays = 0; }
      else quietDays += 1;
      if (quietDays >= 2) break;
    }
    const segment = series.slice(start, end + 1);
    const total = segment.reduce((sum, item) => sum + item.count, 0);
    const peak = segment.reduce((best, item) => item.count > best.count ? item : best, segment[0]);
    if (total >= 4) {
      windows.push({ eventKey: `media-event-${series[start].date}`, peakDate: peak.date, startDate: series[start].date,
        endDate: series[end].date, peakCount: peak.count, baselineCount: Math.round(baseline),
        spikeRatio: Math.round(peak.count / Math.max(1, baseline) * 100) });
    }
    index = Math.max(index + 1, end + 2);
  }
  return windows;
}

export async function syncMediaEventWindows(db: D1Database, brandId: number) {
  const mentions = await db.prepare(`SELECT id, title, url, source, platform, source_country, published_at, engagement
    FROM mentions WHERE brand_id = ? AND published_at != '' AND datetime(published_at) >= datetime('now', '-180 days')
    ORDER BY published_at ASC`).bind(brandId).all<MediaRow>();
  const windows = detectMediaEventWindows(mentions.results);
  const now = new Date().toISOString();
  let created = 0;
  for (const window of windows) {
    const overlappingKey = await findOverlappingEventKey(db, brandId, window.startDate, window.endDate);
    if (overlappingKey) continue;
    await db.prepare(`INSERT INTO search_event_windows
      (brand_id, event_key, peak_date, start_date, end_date, peak_clicks, peak_impressions, baseline_clicks,
       spike_ratio, trigger_source, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'media', 'confirmed', ?)
      ON CONFLICT(brand_id, event_key) DO UPDATE SET peak_date = excluded.peak_date, start_date = excluded.start_date,
        end_date = excluded.end_date, peak_clicks = excluded.peak_clicks, baseline_clicks = excluded.baseline_clicks,
        spike_ratio = excluded.spike_ratio, status = 'confirmed', updated_at = excluded.updated_at`)
      .bind(brandId, window.eventKey, window.peakDate, window.startDate, window.endDate, window.peakCount,
        mentions.results.filter((item) => dateOnly(item.published_at) >= window.startDate && dateOnly(item.published_at) <= window.endDate).length,
        window.baselineCount, window.spikeRatio, now).run();
    created += 1;
  }
  return { detected: windows.length, created };
}

function isViralSocialCandidate(candidate: MonitoringCandidate) {
  const metrics = candidate.socialMetrics;
  if (!metrics || candidate.platform === "网页新闻") return false;
  return Math.max(metrics.views, metrics.plays) >= 10_000 || metrics.likes >= 500 || metrics.comments >= 50
    || metrics.shares >= 200 || candidate.engagement >= 1_000;
}

export async function captureViralSocialEvents(db: D1Database, brandId: number, candidates: MonitoringCandidate[], brand: Record<string, unknown>) {
  const now = new Date().toISOString();
  let captured = 0;
  for (const candidate of candidates) {
    if (!isViralSocialCandidate(candidate)) continue;
    const eventDate = dateOnly(candidate.publishedAt);
    if (!validDate(eventDate)) continue;
    const eventEnd = addDays(eventDate, 7);
    const existingKey = await findOverlappingEventKey(db, brandId, eventDate, eventEnd);
    const eventKey = existingKey || `social-event-${eventDate}-${stableHash(candidate.url)}`;
    const metrics = candidate.socialMetrics!;
    const interaction = Math.max(0, metrics.likes) + Math.max(0, metrics.comments) + Math.max(0, metrics.shares);
    const reach = Math.max(0, metrics.views, metrics.plays);
    if (!existingKey) {
      await db.prepare(`INSERT INTO search_event_windows
        (brand_id, event_key, peak_date, start_date, end_date, peak_clicks, peak_impressions, baseline_clicks,
         spike_ratio, trigger_source, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'social_spike', 'confirmed', ?)
        ON CONFLICT(brand_id, event_key) DO UPDATE SET peak_clicks = MAX(search_event_windows.peak_clicks, excluded.peak_clicks),
          peak_impressions = MAX(search_event_windows.peak_impressions, excluded.peak_impressions), updated_at = excluded.updated_at`)
        .bind(brandId, eventKey, eventDate, eventDate, eventEnd, interaction, reach,
          Math.min(9999, Math.round(Math.log10(Math.max(10, interaction + reach)) * 100)), now).run();
    } else {
      await db.prepare(`UPDATE search_event_windows SET peak_clicks = MAX(peak_clicks, ?),
        peak_impressions = MAX(peak_impressions, ?), trigger_source = CASE WHEN trigger_source = 'manual' THEN 'social_spike' ELSE trigger_source END,
        updated_at = ? WHERE brand_id = ? AND event_key = ?`)
        .bind(interaction, reach, now, brandId, eventKey).run();
    }
    const official = comesFromOfficialAccount(candidate, brand.official_accounts, [brand.name]);
    const source = candidate.socialMetrics?.authorUsername ? `@${candidate.socialMetrics.authorUsername}` : candidate.source;
    const existingOrigin = await db.prepare("SELECT id, published_at FROM event_origins WHERE brand_id = ? AND event_key = ? AND active = 1 ORDER BY published_at ASC LIMIT 1")
      .bind(brandId, eventKey).first<{ id: number; published_at: string }>();
    if (!existingOrigin || candidate.publishedAt < existingOrigin.published_at) {
      await db.prepare(`INSERT INTO event_origins
        (brand_id, event_key, title, url, platform, source, source_country, published_at, note, active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(brand_id, url) DO UPDATE SET event_key = excluded.event_key, title = excluded.title,
          platform = excluded.platform, source = excluded.source, source_country = excluded.source_country,
          published_at = excluded.published_at, note = excluded.note, active = 1, updated_at = excluded.updated_at`)
        .bind(brandId, eventKey, candidate.title, candidate.url, candidate.platform, source,
          candidate.sourceCountry || "地区待确认", candidate.publishedAt,
          `${official ? "品牌官方账号" : "外部高影响账号"}首先触发明显互动增长；公开数据为 ${Math.max(0, metrics.likes)} 赞、${Math.max(0, metrics.comments)} 评论、${reach} 播放或浏览。`, now).run();
    }
    captured += 1;
  }
  return { captured };
}
