/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { processSyncPipeline, runScheduledSyncPipelines } from "../db/sync-pipeline";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  X_BEARER_TOKEN?: string;
  YOUTUBE_API_KEY?: string;
  NEWSAPI_AI_KEY?: string;
  MEDIACLOUD_API_KEY?: string;
  NEWSDATA_API_KEY?: string;
  WORLD_NEWS_API_KEY?: string;
  SCRAPECREATORS_API_KEY?: string;
  BRAVE_SEARCH_API_KEY?: string;
  APIFY_API_TOKEN?: string;
  BRIGHTDATA_API_KEY?: string;
  BRIGHTDATA_SERP_ZONE?: string;
  MONID_API_KEY?: string;
  CREDENTIALS_ENCRYPTION_KEY?: string;
  AZURE_TRANSLATOR_KEY?: string;
  AZURE_TRANSLATOR_REGION?: string;
  AZURE_TRANSLATOR_ENDPOINT?: string;
  DEEPL_API_KEY?: string;
  TRANSLATION_CONTACT_EMAIL?: string;
  LIBRETRANSLATE_URL?: string;
  LIBRETRANSLATE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const pipelineIds = response.headers.get("x-sync-pipeline-ids")?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
    for (const pipelineId of pipelineIds) ctx.waitUntil(processSyncPipeline(pipelineId));
    return response;
  },
  async scheduled(_controller: unknown, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledSyncPipelines());
  },
};

export default worker;
