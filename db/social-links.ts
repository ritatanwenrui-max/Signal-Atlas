export type SocialPostDescriptor = { platform: "Instagram" | "X" | "YouTube" | "TikTok" | "Facebook" | "Reddit"; postId: string };

export function socialPostDescriptor(value: string): SocialPostDescriptor | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "instagram.com") {
    const code = url.pathname.match(/^\/(?:p|reel|tv)\/([^/?#]+)/i)?.[1];
    return code ? { platform: "Instagram", postId: value } : null;
  }
  if (host === "x.com" || host === "twitter.com") {
    const id = url.pathname.match(/\/status\/(\d+)/i)?.[1];
    return id ? { platform: "X", postId: id } : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|live)\/([^/?#]+)/i)?.[1];
    return id ? { platform: "YouTube", postId: id } : null;
  }
  if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    const id = url.pathname.match(/\/video\/(\d+)/i)?.[1] || value;
    return { platform: "TikTok", postId: id };
  }
  if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch") {
    return { platform: "Facebook", postId: value };
  }
  if (host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it") {
    const rawId = host === "redd.it" ? url.pathname.split("/").filter(Boolean)[0] : url.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1];
    return rawId ? { platform: "Reddit", postId: rawId.startsWith("t3_") ? rawId : `t3_${rawId}` } : null;
  }
  return null;
}
