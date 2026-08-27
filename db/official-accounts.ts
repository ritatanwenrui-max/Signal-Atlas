type OfficialAccountCandidate = {
  platform?: unknown;
  provider?: unknown;
  source?: unknown;
  author?: unknown;
  url?: unknown;
  socialMetrics?: { authorId?: unknown; authorUsername?: unknown; authorName?: unknown } | null;
};

function decoded(value: string) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

export function normalizeSocialHandle(value: unknown) {
  const raw = decoded(String(value ?? "").trim()).normalize("NFKC");
  if (!raw) return "";
  const atHandle = raw.match(/(?:^|[\s:/(])@([a-z0-9._-]+)/i)?.[1];
  if (atHandle) return atHandle.toLocaleLowerCase();
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const host = parsed.hostname.replace(/^www\./, "").toLocaleLowerCase();
    if (["x.com", "twitter.com", "instagram.com", "tiktok.com", "facebook.com"].some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      const segment = segments[0] === "@" ? segments[1] : segments[0];
      if (segment && !["p", "reel", "tv", "video", "status", "watch"].includes(segment.toLocaleLowerCase())) return segment.replace(/^@/, "").toLocaleLowerCase();
    }
    if ((host === "youtube.com" || host.endsWith(".youtube.com")) && segments[0]?.startsWith("@")) return segments[0].slice(1).toLocaleLowerCase();
  } catch { /* A plain handle is expected most of the time. */ }
  const plain = raw.replace(/^@/, "").trim();
  return /^[a-z0-9._-]+$/i.test(plain) ? plain.toLocaleLowerCase() : "";
}

export function officialAccountHandles(value: unknown) {
  return [...new Set(String(value ?? "").split(/[\n,，]/).map(normalizeSocialHandle).filter(Boolean))];
}

function identityHandles(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const handles = new Set<string>();
  const normalized = normalizeSocialHandle(raw);
  if (normalized) handles.add(normalized);
  for (const match of raw.matchAll(/@([a-z0-9._-]+)/gi)) handles.add(match[1].toLocaleLowerCase());
  return [...handles];
}

function normalizedDisplayName(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function isUnattributedSyntheticSocialPost(candidate: OfficialAccountCandidate) {
  if (String(candidate.platform ?? "") !== "TikTok") return false;
  const url = String(candidate.url ?? "").toLocaleLowerCase();
  const provider = String(candidate.provider ?? "").toLocaleLowerCase();
  const username = normalizeSocialHandle(candidate.socialMetrics?.authorUsername);
  const authorId = String(candidate.socialMetrics?.authorId ?? "").trim();
  const author = String(candidate.author ?? "").trim();
  return provider.includes("tikhub") && url.includes("tiktok.com/@user/video/") && !username && !authorId && !author;
}

export function comesFromOfficialAccount(candidate: OfficialAccountCandidate, configuredAccounts: unknown, officialDisplayNames: unknown[] = []) {
  const official = new Set(Array.isArray(configuredAccounts)
    ? configuredAccounts.map(normalizeSocialHandle).filter(Boolean)
    : officialAccountHandles(configuredAccounts));
  const identities = [candidate.socialMetrics?.authorUsername, candidate.author, candidate.source, candidate.url]
    .flatMap(identityHandles);
  if (identities.some((handle) => official.has(handle))) return true;
  const names = new Set(officialDisplayNames.map(normalizedDisplayName).filter(Boolean));
  const candidateName = normalizedDisplayName(candidate.socialMetrics?.authorName || candidate.author);
  const stableAccountIdentity = Boolean(String(candidate.socialMetrics?.authorId ?? "").trim() || normalizeSocialHandle(candidate.socialMetrics?.authorUsername));
  return stableAccountIdentity && candidateName !== "" && names.has(candidateName);
}
