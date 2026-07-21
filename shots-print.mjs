// Verifies the print worksheet lays out identically on desktop- and
// phone-shaped viewports under emulated print media. Reuses the stubbed
// Cognito/API approach from shots-reading.mjs.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "shots-print";

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
        passage:
          "ကျွန်မတို့က အိမ်မှာ အတူ နေတယ်။ ကျွန်မရဲ့ ကွီးက ကိုခင်ပါ။ ကိုခင်က ကျွန်မထက် ကြီးတယ်။ ကျွန်မရဲ့ ညီက မောင်ချစ်ပါ။",
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

async function setup(ctx) {
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
  return page;
}

const browser = await chromium.launch();
for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 950 }],
  ["iphone", { width: 430, height: 932 }],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await setup(ctx);
  await page.screenshot({ path: `${OUT}/${name}-screen.png`, fullPage: name === "iphone" });
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  const metrics = await page.evaluate(() => {
    const sheet = document.querySelector(".worksheet-page");
    const h2 = sheet.querySelector("h2");
    const passage = sheet.querySelector(".worksheet-passage p");
    return {
      sheetWidth: sheet.getBoundingClientRect().width,
      sheetLeft: sheet.getBoundingClientRect().left,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      h2Text: h2.textContent,
      h2FontPx: getComputedStyle(h2).fontSize,
      passageFontPx: passage ? getComputedStyle(passage).fontSize : null,
    };
  });
  console.log(name, JSON.stringify(metrics));
  await page.screenshot({ path: `${OUT}/${name}-print.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
console.log("done");
