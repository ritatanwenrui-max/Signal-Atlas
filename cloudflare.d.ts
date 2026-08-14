interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: {
    last_row_id?: number;
    changes?: number;
    [key: string]: unknown;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    X_BEARER_TOKEN?: string;
    YOUTUBE_API_KEY?: string;
    NEWSAPI_AI_KEY?: string;
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
  };
}
