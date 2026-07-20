import { randomUUID } from "node:crypto";

const RUN_ID = process.env.LANGLER_E2E_RUN_ID?.trim() || randomUUID().slice(0, 8);

export const RUN_PREFIX = "e2e";

export function runTag(kind: string): string {
  return `${RUN_PREFIX}-${RUN_ID}-${kind}-${randomUUID().slice(0, 6)}`;
}

export function newLessonId(): string {
  return randomUUID();
}
