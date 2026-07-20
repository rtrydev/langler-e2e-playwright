import { test as base } from "@playwright/test";
import { LanglerApi } from "../lib/api";
import { LessonFactory } from "../lib/factory";
import { TestData } from "../lib/data";

interface WorkerFixtures {
  api: LanglerApi;
}

interface TestFixtures {
  factory: LessonFactory;
  data: TestData;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  api: [
    async ({}, use) => {
      const api = await LanglerApi.create();
      await use(api);
      await api.dispose();
    },
    { scope: "worker" },
  ],
  factory: async ({ api }, use) => {
    await use(new LessonFactory(api));
  },
  data: async ({ api }, use) => {
    const data = new TestData(api);
    await use(data);
    await data.cleanup();
  },
});

export { expect } from "@playwright/test";
