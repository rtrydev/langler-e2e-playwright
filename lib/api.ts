import { type APIRequestContext, request as playwrightRequest } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { testConfig } from "./config";
import { fetchAccessToken } from "./cognito";
import { PacedQueue } from "./pacing";
import type {
  AgentTokenDTO,
  CreateTokenResponse,
  GlossaryLanguage,
  GrammarTopic,
  ImportResponse,
  Language,
  LessonDoc,
  LessonSummary,
  TokenScope,
  VocabEntry,
} from "./types";

// POST /lessons/import throttles at burst 5 / rate 2 req/s and the Lambda holds
// reserved concurrency 5. One shared limiter paces every import in this worker so
// parallel specs cannot 429 each other; a 429 backoff below covers cross-worker bursts.
const importQueue = new PacedQueue(1200);

async function withImportRetry<T>(attempt: () => Promise<T>): Promise<T> {
  const delays = [500, 1500, 4000];
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (error) {
      if (i >= delays.length || !(error instanceof RateLimitedError)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }
}

class RateLimitedError extends Error {}

export class LanglerApi {
  private constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  static async create(): Promise<LanglerApi> {
    const context = await playwrightRequest.newContext();
    const token = await fetchAccessToken(context);
    return new LanglerApi(context, token);
  }

  async dispose(): Promise<void> {
    await this.request.dispose();
  }

  private authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.token}` };
  }

  async vocab(
    lang: Language,
    opts: { level?: string; limit?: number } = {},
  ): Promise<VocabEntry[]> {
    const params = new URLSearchParams({ lang });
    if (opts.level) params.set("level", opts.level);
    params.set("limit", String(opts.limit ?? 20));
    const response = await this.request.get(
      `${testConfig.apiUrl}/reference/vocab?${params.toString()}`,
      { headers: this.authHeaders() },
    );
    if (!response.ok()) {
      throw new Error(`GET /reference/vocab failed (${response.status()}): ${await response.text()}`);
    }
    return ((await response.json()) as { items: VocabEntry[] }).items;
  }

  async grammar(
    lang: Language,
    opts: { level?: string; limit?: number } = {},
  ): Promise<GrammarTopic[]> {
    const params = new URLSearchParams({ lang });
    if (opts.level) params.set("level", opts.level);
    params.set("limit", String(opts.limit ?? 20));
    const response = await this.request.get(
      `${testConfig.apiUrl}/reference/grammar?${params.toString()}`,
      { headers: this.authHeaders() },
    );
    if (!response.ok()) {
      throw new Error(`GET /reference/grammar failed (${response.status()}): ${await response.text()}`);
    }
    return ((await response.json()) as { items: GrammarTopic[] }).items;
  }

  importLesson(doc: LessonDoc): Promise<ImportResponse> {
    return importQueue.run(() =>
      withImportRetry(async () => {
        const response = await this.request.post(`${testConfig.apiUrl}/lessons/import`, {
          headers: { ...this.authHeaders(), "idempotency-key": `e2e-${randomUUID()}` },
          data: doc,
        });
        if (response.status() === 429) {
          throw new RateLimitedError("import throttled");
        }
        if (!response.ok()) {
          throw new Error(`POST /lessons/import failed (${response.status()}): ${await response.text()}`);
        }
        return (await response.json()) as ImportResponse;
      }),
    );
  }

  async listLessons(): Promise<LessonSummary[]> {
    const response = await this.request.get(`${testConfig.apiUrl}/lessons`, {
      headers: this.authHeaders(),
    });
    if (!response.ok()) {
      throw new Error(`GET /lessons failed (${response.status()}): ${await response.text()}`);
    }
    return ((await response.json()) as { items: LessonSummary[] }).items;
  }

  async deleteLesson(id: string): Promise<void> {
    const response = await this.request.delete(`${testConfig.apiUrl}/lessons/${id}`, {
      headers: this.authHeaders(),
    });
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`DELETE /lessons/${id} failed (${response.status()}): ${await response.text()}`);
    }
  }

  async glossary(language?: Language): Promise<GlossaryLanguage[]> {
    const suffix = language ? `?language=${language}` : "";
    const response = await this.request.get(`${testConfig.apiUrl}/glossary${suffix}`, {
      headers: this.authHeaders(),
    });
    if (!response.ok()) {
      throw new Error(`GET /glossary failed (${response.status()}): ${await response.text()}`);
    }
    return ((await response.json()) as { languages: GlossaryLanguage[] }).languages;
  }

  async createToken(
    label: string,
    scopes: TokenScope[],
    expiresInDays: number,
  ): Promise<CreateTokenResponse> {
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const response = await this.request.post(`${testConfig.apiUrl}/agent-tokens`, {
      headers: this.authHeaders(),
      data: { label, scopes, expiresAt },
    });
    if (!response.ok()) {
      throw new Error(`POST /agent-tokens failed (${response.status()}): ${await response.text()}`);
    }
    return (await response.json()) as CreateTokenResponse;
  }

  async listTokens(): Promise<AgentTokenDTO[]> {
    const response = await this.request.get(`${testConfig.apiUrl}/agent-tokens`, {
      headers: this.authHeaders(),
    });
    if (!response.ok()) {
      throw new Error(`GET /agent-tokens failed (${response.status()}): ${await response.text()}`);
    }
    return ((await response.json()) as { items: AgentTokenDTO[] }).items;
  }

  async deleteToken(id: string): Promise<void> {
    const response = await this.request.delete(`${testConfig.apiUrl}/agent-tokens/${id}`, {
      headers: this.authHeaders(),
    });
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`DELETE /agent-tokens/${id} failed (${response.status()}): ${await response.text()}`);
    }
  }

  importLessonWithSecret(secret: string, doc: LessonDoc): Promise<ImportResponse> {
    return importQueue.run(() =>
      withImportRetry(async () => {
        const response = await this.request.post(`${testConfig.machineApiUrl}/lessons/import`, {
          headers: {
            authorization: `Bearer ${secret}`,
            "idempotency-key": `e2e-${randomUUID()}`,
          },
          data: doc,
        });
        if (response.status() === 429) {
          throw new RateLimitedError("machine import throttled");
        }
        if (!response.ok()) {
          throw new Error(
            `machine POST /lessons/import failed (${response.status()}): ${await response.text()}`,
          );
        }
        return (await response.json()) as ImportResponse;
      }),
    );
  }
}
