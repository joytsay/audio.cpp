import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(
  process.env.UI_BROWSER_TOOLS
    ? path.resolve(process.env.UI_BROWSER_TOOLS, "package.json")
    : import.meta.url,
);
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    ...(process.env.UI_BROWSER_EXECUTABLE
      ? { executablePath: process.env.UI_BROWSER_EXECUTABLE }
      : {}),
    headless: true,
    args: [
      "--no-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    permissions: ["microphone"],
    viewport: { width: 1584, height: 920 },
  });
  const page = await context.newPage(),
    errors = [],
    requests = [];
  let vadCalls = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page.route(/\/(v1|llm)\//, async (route) => {
    const url = new URL(route.request().url());
    const body =
      route.request().method() === "POST" &&
      route.request().headers()["content-type"]?.includes("json")
        ? route.request().postDataJSON()
        : {};
    requests.push({ path: url.pathname, body });
    let json = {};
    if (url.pathname.endsWith("models-root"))
      json = { models_root: "/app/models" };
    else if (url.pathname.endsWith("/models")) json = { data: [] };
    else if (url.pathname.endsWith("/models/load"))
      json = { id: body.id, loaded: true };
    else if (url.pathname.endsWith("/ui/upload"))
      json = { path: "/tmp/demo.wav" };
    else if (url.pathname.endsWith("/tasks/run"))
      json = {
        segments:
          ++vadCalls === 1 ? [{ start_sample: 0, end_sample: 8000 }] : [],
      };
    else if (url.pathname.endsWith("/audio/transcriptions/details"))
      json = { text: "語音測試" };
    else if (url.pathname.endsWith("/chat/completions"))
      json = {
        choices: [{ message: { content: "您好，請問需要什麼協助？" } }],
      };
    else if (url.pathname.endsWith("/audio/speech"))
      return route.fulfill({ contentType: "audio/wav", body: wav });
    await route.fulfill({ json });
  });
  await page.goto(
    (process.env.UI_BASE_URL || "http://127.0.0.1:4173/").replace(/\/$/, "") +
      "/#/demo",
  );
  await page.getByRole("button", { name: "Start call" }).waitFor();
  assert.equal(await page.title(), "GeoVision · Voice Demo");
  assert.ok(await page.locator('link[rel="icon"]').getAttribute("href"));

  await page.getByRole("button", { name: "Start call" }).click();
  await page.getByText("CONNECTED", { exact: true }).waitFor();
  await page
    .locator("article")
    .filter({ hasText: "語音測試" })
    .waitFor()
    .catch(async (cause) => {
      console.error(
        requests,
        await page.locator("[role=status]").textContent(),
        errors,
      );
      throw cause;
    });
  await page.waitForFunction(
    () => document.querySelector("[role=status]")?.textContent === "Listening",
  );
  assert.ok(
    requests.some(
      (r) => r.path === "/v1/models/load" && r.body.id === "demo-audio8-asr",
    ),
  );
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await page.getByLabel("Message", { exact: true }).fill("我要回報工單");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.locator("article").filter({ hasText: "我要回報工單" }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector("[role=status]")?.textContent ===
      "Microphone muted",
  );
  assert.ok(
    requests.some(
      (r) => r.path === "/v1/models/load" && r.body.id === "demo-zipvoice",
    ),
  );
  assert.ok(requests.some((r) => r.path === "/llm/v1/chat/completions"));
  assert.ok(
    requests.some(
      (r) => r.path === "/v1/audio/speech" && r.body.voice === "lingCLvocals",
    ),
  );
  await page.getByRole("button", { name: "Hang up" }).click();
  await page.getByRole("button", { name: "Start call" }).waitFor();
  await page.reload();
  await page.getByText("SESSION_ENDED", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log(
    "PASS demo route, favicon, microphone, VAD/ASR/LLM/TTS, typed message, voice reference, hangup, persisted events, mobile layout",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
