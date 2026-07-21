// Local visual check for the reading-exercise layout rework. No real backend:
// Cognito and the lessons API are stubbed via route interception.
// Run: node shots-reading.mjs <outdir>
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "shots-reading";

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fakeJwt = b64url({ alg: "none" }) + "." + b64url({ exp: 9999999999, sub: "shot-user", email: "shot@local" }) + ".sig";

const lesson = {
  schemaVersion: "1.0",
  lessonId: "shot-burmese-story",
  language: "my",
  level: "A1",
  title: "အိမ်မှာ မိသားစုနဲ့",
  readingStage: "connected",
  createdAt: "2026-07-21T00:00:00Z",
  exercises: [
    {
      exerciseId: "ex-1",
      type: "reading",
      prompt: "Read the story and answer the questions.",
      points: 6,
      payload: {
        genre: "short_story",
        title: "အိမ်မှာ မိသားစုနဲ့",
        passage:
          "ကျွန်မတို့က အိမ်မှာ အတူ နေတယ်။ ကျွန်မရဲ့ ကွီးက ကိုခင်ပါ။ ကိုခင်က ကျွန်မထက် ကြီးတယ်။ ကျွန်မရဲ့ ညီက မောင်ချစ်ပါ။ မောင်ချစ်က ငယ်တယ်။ ညနေမှာ မိသားစုက အတူ ထမင်း စားတယ်။ အမေက ဟင်း ချက်တယ်။ အဖေက ရေ ယူတယ်။ ကျွန်မက ပန်းကန် ဆေးတယ်။",
        annotations: [
          { surface: "မိသားစု", reading: "mi-tha-zu", gloss: "family" },
          { surface: "ထမင်း", reading: "hta-min", gloss: "cooked rice; meal" },
          { surface: "ပန်းကန်", reading: "ban-gan", gloss: "plate; dish" },
        ],
        questions: [
          { question: "ကျွန်မရဲ့ ကွီးက ဘယ်သူလဲ။", kind: "multiple_choice", options: ["ကိုခင်", "မောင်ချစ်", "ကောင်မလေး", "ကလေး"], answer: "ကိုခင်" },
          { question: "မောင်ချစ်က ဘယ်သူလဲ။", kind: "multiple_choice", options: ["ကိုခင်ရဲ့ ဇနီး", "ကျွန်မရဲ့ ညီ", "ကျွန်မရဲ့ ကွီး", "ကလေး"], answer: "ကျွန်မရဲ့ ညီ" },
          { question: "အမေက ဘာ လုပ်လဲ။", kind: "multiple_choice", options: ["ဟင်း ချက်တယ်", "ရေ ယူတယ်", "ပန်းကန် ဆေးတယ်", "ထမင်း စားတယ်"], answer: "ဟင်း ချက်တယ်" },
        ],
      },
    },
    {
      exerciseId: "ex-2",
      type: "multiple_choice",
      prompt: "Choose the word that matches the meaning.",
      points: 2,
      payload: {
        questions: [
          { question: "family", options: ["မိသားစု", "ထမင်း", "ပန်းကန်"], answer: "မိသားစု" },
          { question: "plate", options: ["ဟင်း", "ပန်းကန်", "ရေ"], answer: "ပန်းကန်" },
        ],
      },
    },
    {
      exerciseId: "ex-3",
      type: "matching",
      prompt: "Match each word with its meaning.",
      points: 3,
      payload: {
        pairs: [
          { left: "မိသားစု", right: "family" },
          { left: "ထမင်း", right: "meal" },
          { left: "ပန်းကန်", right: "plate" },
        ],
      },
    },
  ],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.route("https://cognito-idp.**", (route) =>
  route.fulfill({
    contentType: "application/x-amz-json-1.1",
    body: JSON.stringify({
      AuthenticationResult: { AccessToken: fakeJwt, IdToken: fakeJwt, RefreshToken: "fake-refresh" },
    }),
  }),
);
await page.route("**/lessons/shot-burmese-story", (route) =>
  route.fulfill({ contentType: "application/json", body: JSON.stringify(lesson) }),
);
// Everything else on the API (results save, reference lookups) returns empty.
await page.route("**/execute-api.**", (route) =>
  route.fulfill({ contentType: "application/json", body: "{}" }),
);

await page.goto(BASE + "/");
await page.evaluate(() => localStorage.setItem("langler-theme", "dark"));
await page.reload();
const emailField = page.getByLabel("Email");
await emailField.waitFor({ state: "visible", timeout: 15000 });
await emailField.fill("shot@local");
await page.getByLabel("Password").fill("stubbed-password-1!");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForTimeout(2500);

await page.goto(BASE + "/lessons/play/?id=shot-burmese-story");
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/dark-play-reading.png` });

// Answer the story questions, advance to exercise 2 to confirm the type
// overline still shows for non-reading exercises.
const questionRegion = page.getByRole("region", { name: "Comprehension questions" });
for (const answer of ["ကိုခင်", "ကျွန်မရဲ့ ညီ", "ဟင်း ချက်တယ်"]) {
  await questionRegion.getByText(answer, { exact: true }).first().click();
}
await page.getByRole("button", { name: "Check" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/dark-play-reading-checked.png` });
await page.getByRole("button", { name: "Next →" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/dark-play-mc.png` });

// Light theme pass on the reading layout.
await page.evaluate(() => localStorage.setItem("langler-theme", "light"));
await page.goto(BASE + "/lessons/play/?id=shot-burmese-story");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/light-play-reading.png` });

// Printable worksheet: type headings must be gone.
await page.goto(BASE + "/lessons/print/?id=shot-burmese-story");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/light-print-worksheet.png`, fullPage: true });

await ctx.close();
await browser.close();
console.log("done");
