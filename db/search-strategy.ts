type SearchEntity = { type: string; value: string; active: number };

function clean(value: string) { return value.trim().normalize("NFKC").replace(/\s+/g, " "); }

function compactVariant(value: string) {
  return clean(value).replace(/^@/, "").replace(/[^\p{L}\p{N}_]+/gu, "");
}

export function buildDiscoveryTerms(identityTerms: string[], entities: SearchEntity[], brand: Record<string, unknown>) {
  const identity = identityTerms.map(clean).filter(Boolean);
  const strongEntities = entities.filter((item) => item.active && ["产品", "公司", "事件指纹"].includes(item.type))
    .map((item) => clean(item.value)).filter(Boolean);
  const supportingEntities = entities.filter((item) => item.active && ["人物", "关键词"].includes(item.type))
    .map((item) => clean(item.value)).filter(Boolean);
  const website = String(brand.website ?? "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const compactIdentity = identity.map(compactVariant).filter((item) => item.length >= 3);
  const pairedQueries = identity.slice(0, 3).flatMap((name) => [...strongEntities, ...supportingEntities].slice(0, 4)
    .map((anchor) => `${name} ${anchor}`));
  return [...new Set([...identity, ...compactIdentity, ...strongEntities, ...pairedQueries, website].map(clean).filter(Boolean))].slice(0, 24);
}

export function buildHashtagTerms(identityTerms: string[], entities: SearchEntity[]) {
  const strongEntities = entities.filter((item) => item.active && ["产品", "公司", "事件指纹"].includes(item.type)).map((item) => item.value);
  return [...new Set([...identityTerms, ...strongEntities].map(compactVariant).filter((item) => item.length >= 3))].slice(0, 8);
}

export function queryCountForPlatform(platform: string, discoveryTerms: string[], hashtagTerms: string[]) {
  if (platform === "Instagram") return hashtagTerms.length;
  if (["YouTube", "TikTok"].includes(platform)) return Math.min(3, discoveryTerms.length);
  if (platform === "Reddit") return Math.min(5, discoveryTerms.length);
  return discoveryTerms.length ? 1 : 0;
}
