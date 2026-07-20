import type { LanglerApi } from "./api";
import type { ImportResponse, LessonDoc } from "./types";

export class TestData {
  private readonly lessonIds = new Set<string>();
  private readonly tokenIds = new Set<string>();
  private readonly tokenLabels = new Set<string>();

  constructor(private readonly api: LanglerApi) {}

  async importLesson(doc: LessonDoc): Promise<ImportResponse> {
    const result = await this.api.importLesson(doc);
    this.lessonIds.add(result.lessonId);
    return result;
  }

  trackLesson(lessonId: string): void {
    this.lessonIds.add(lessonId);
  }

  trackToken(tokenId: string): void {
    this.tokenIds.add(tokenId);
  }

  trackTokenLabel(label: string): void {
    this.tokenLabels.add(label);
  }

  async forgetLesson(lessonId: string): Promise<void> {
    this.lessonIds.delete(lessonId);
    await this.api.deleteLesson(lessonId);
  }

  async cleanup(): Promise<void> {
    const errors: unknown[] = [];

    for (const lessonId of this.lessonIds) {
      await this.api.deleteLesson(lessonId).catch((error) => errors.push(error));
    }

    if (this.tokenLabels.size > 0) {
      const tokens = await this.api.listTokens().catch((error) => {
        errors.push(error);
        return [];
      });
      for (const token of tokens) {
        if (this.tokenLabels.has(token.label)) {
          this.tokenIds.add(token.id);
        }
      }
    }
    for (const tokenId of this.tokenIds) {
      await this.api.deleteToken(tokenId).catch((error) => errors.push(error));
    }

    if (errors.length > 0) {
      throw new Error(`Cleanup failed for ${errors.length} entit(ies): ${String(errors[0])}`);
    }
  }
}
