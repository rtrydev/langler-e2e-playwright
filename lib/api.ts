import {
  type APIRequestContext,
  type APIResponse,
  request as playwrightRequest,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { testConfig } from "./config";
import { fetchAccessToken } from "./cognito";
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

// The API throttle limits comfortably absorb this suite's traffic, so requests
// run unpaced; a 429 backoff remains as a safety net for incidental bursts.
class RateLimitedError extends Error {}

async function withRetry<T>(attempt: () => Promise<T>): Promise<T> {
  const delays = [500, 1200, 3000, 6000];
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

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return { authorization: `Bearer ${this.token}`, ...extra };
  }

  private throwOn429(response: APIResponse, label: string): APIResponse {
    if (response.status() === 429) {
      throw new RateLimitedError(`${label} throttled`);
    }
    return response;
  }

  private read<T>(run: () => Promise<T>): Promise<T> {
    return withRetry(run);
  }

  async vocab(
    lang: Language,
    opts: { level?: string; limit?: number } = {},
  ): Promise<VocabEntry[]> {
    const params = new URLSearchParams({ lang });
    if (opts.level) params.set("level", opts.level);
    params.set("limit", String(opts.limit ?? 20));
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.get(`${testConfig.apiUrl}/reference/vocab?${params.toString()}`, {
          headers: this.authHeaders(),
        }),
        "GET /reference/vocab",
      );
      if (!response.ok()) {
        throw new Error(`GET /reference/vocab failed (${response.status()}): ${await response.text()}`);
      }
      return ((await response.json()) as { items: VocabEntry[] }).items;
    });
  }

  async grammar(
    lang: Language,
    opts: { level?: string; limit?: number } = {},
  ): Promise<GrammarTopic[]> {
    const params = new URLSearchParams({ lang });
    if (opts.level) params.set("level", opts.level);
    params.set("limit", String(opts.limit ?? 20));
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.get(`${testConfig.apiUrl}/reference/grammar?${params.toString()}`, {
          headers: this.authHeaders(),
        }),
        "GET /reference/grammar",
      );
      if (!response.ok()) {
        throw new Error(`GET /reference/grammar failed (${response.status()}): ${await response.text()}`);
      }
      return ((await response.json()) as { items: GrammarTopic[] }).items;
    });
  }

  importLesson(doc: LessonDoc): Promise<ImportResponse> {
    return withRetry(async () => {
      const response = this.throwOn429(
        await this.request.post(`${testConfig.apiUrl}/lessons/import`, {
          headers: this.authHeaders({ "idempotency-key": `e2e-${randomUUID()}` }),
          data: doc,
        }),
        "POST /lessons/import",
      );
      if (!response.ok()) {
        throw new Error(`POST /lessons/import failed (${response.status()}): ${await response.text()}`);
      }
      return (await response.json()) as ImportResponse;
    });
  }

  listLessons(): Promise<LessonSummary[]> {
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.get(`${testConfig.apiUrl}/lessons`, { headers: this.authHeaders() }),
        "GET /lessons",
      );
      if (!response.ok()) {
        throw new Error(`GET /lessons failed (${response.status()}): ${await response.text()}`);
      }
      return ((await response.json()) as { items: LessonSummary[] }).items;
    });
  }

  deleteLesson(id: string): Promise<void> {
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.delete(`${testConfig.apiUrl}/lessons/${id}`, { headers: this.authHeaders() }),
        "DELETE /lessons",
      );
      if (!response.ok() && response.status() !== 404) {
        throw new Error(`DELETE /lessons/${id} failed (${response.status()}): ${await response.text()}`);
      }
    });
  }

  glossary(language?: Language): Promise<GlossaryLanguage[]> {
    const suffix = language ? `?language=${language}` : "";
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.get(`${testConfig.apiUrl}/glossary${suffix}`, { headers: this.authHeaders() }),
        "GET /glossary",
      );
      if (!response.ok()) {
        throw new Error(`GET /glossary failed (${response.status()}): ${await response.text()}`);
      }
      return ((await response.json()) as { languages: GlossaryLanguage[] }).languages;
    });
  }

  createToken(
    label: string,
    scopes: TokenScope[],
    expiresInDays: number,
  ): Promise<CreateTokenResponse> {
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.post(`${testConfig.apiUrl}/agent-tokens`, {
          headers: this.authHeaders(),
          data: { label, scopes, expiresAt },
        }),
        "POST /agent-tokens",
      );
      if (!response.ok()) {
        throw new Error(`POST /agent-tokens failed (${response.status()}): ${await response.text()}`);
      }
      return (await response.json()) as CreateTokenResponse;
    });
  }

  listTokens(): Promise<AgentTokenDTO[]> {
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.get(`${testConfig.apiUrl}/agent-tokens`, { headers: this.authHeaders() }),
        "GET /agent-tokens",
      );
      if (!response.ok()) {
        throw new Error(`GET /agent-tokens failed (${response.status()}): ${await response.text()}`);
      }
      return ((await response.json()) as { items: AgentTokenDTO[] }).items;
    });
  }

  deleteToken(id: string): Promise<void> {
    return this.read(async () => {
      const response = this.throwOn429(
        await this.request.delete(`${testConfig.apiUrl}/agent-tokens/${id}`, { headers: this.authHeaders() }),
        "DELETE /agent-tokens",
      );
      if (!response.ok() && response.status() !== 404) {
        throw new Error(`DELETE /agent-tokens/${id} failed (${response.status()}): ${await response.text()}`);
      }
    });
  }

  importLessonWithSecret(secret: string, doc: LessonDoc): Promise<ImportResponse> {
    return withRetry(async () => {
      const response = this.throwOn429(
        await this.request.post(`${testConfig.machineApiUrl}/lessons/import`, {
          headers: {
            authorization: `Bearer ${secret}`,
            "idempotency-key": `e2e-${randomUUID()}`,
          },
          data: doc,
        }),
        "machine POST /lessons/import",
      );
      if (!response.ok()) {
        throw new Error(
          `machine POST /lessons/import failed (${response.status()}): ${await response.text()}`,
        );
      }
      return (await response.json()) as ImportResponse;
    });
  }
}
