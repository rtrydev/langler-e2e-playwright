// Reproduce the reported mobile screen-view overflow on the print page.
// Tests webkit and chromium at iPhone 16 Pro Max logical size.
import { chromium, webkit } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "shots-print-mobile";

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fakeJwt = b64url({ alg: "none" }) + "." + b64url({ exp: 9999999999, sub: "shot-user", email: "shot@local" }) + ".sig";

const lesson = {
  schemaVersion: "1.0",
  lessonId: "shot-print",
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
        passage: "ကျွန်မတို့က အိမ်မှာ အတူ နေတယ်။ ကျွန်မရဲ့ ကွီးက ကိုခင်ပါ။ ကိုခင်က ကျွန်မထက် ကြီးတယ်။",
        annotations: [{ surface: "မိသားစု", reading: "mi-tha-zu", gloss: "family" }],
        questions: [
          { question: "ကျွန်မရဲ့ ကွီးက ဘယ်သူလဲ။", kind: "multiple_choice", options: ["ကိုခင်", "မောင်ချစ်", "ကလေး"], answer: "ကိုခင်" },
        ],
      },
    },
    {
      exerciseId: "ex-2",
      type: "matching",
      points: 3,
      payload: { pairs: [{ left: "မိသားစု", right: "family" }, { left: "ထမင်း", right: "meal" }] },
    },
  ],
};

for (const [engineName, engine] of [["webkit", webkit], ["chromium", chromium]]) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route("https://cognito-idp.**", (route) =>
    route.fulfill({
      contentType: "application/x-amz-json-1.1",
      body: JSON.stringify({ AuthenticationResult: { AccessToken: fakeJwt, IdToken: fakeJwt, RefreshToken: "fake" } }),
    }),
  );
  await page.route("**/lessons/shot-print", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(lesson) }),
  );
  await page.route("**/execute-api.**", (route) => route.fulfill({ contentType: "application/json", body: "{}" }));
  await page.goto(BASE + "/");
  const emailField = page.getByLabel("Email");
  await emailField.waitFor({ state: "visible", timeout: 15000 });
  await emailField.fill("shot@local");
  await page.getByLabel("Password").fill("stubbed-password-1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(2000);
  await page.goto(BASE + "/lessons/print/?id=shot-print");
  await page.waitForTimeout(2500);
  const metrics = await page.evaluate(() => {
    const sheet = document.querySelector(".worksheet-page");
    const main = document.querySelector("main");
    const overflowers = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > window.innerWidth + 1 || r.right > window.innerWidth + 1) {
        overflowers.push(`${el.tagName}.${String(el.className).slice(0, 60)} w=${Math.round(r.width)} right=${Math.round(r.right)}`);
      }
    }
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: document.scrollingElement.scrollWidth,
      mainScrollWidth: main ? main.scrollWidth : null,
      sheetWidth: sheet ? Math.round(sheet.getBoundingClientRect().width) : null,
      overflowers: overflowers.slice(0, 8),
    };
  });
  console.log(engineName, JSON.stringify(metrics, null, 1));
  await page.screenshot({ path: `${OUT}/${engineName}-screen.png`, fullPage: false });
  await browser.close();
}
console.log("done");
