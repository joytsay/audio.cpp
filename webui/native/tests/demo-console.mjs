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
  let vadCalls = 0,
    noLlmModels = false;
  let greetingsCsv = 'greeting\n"您好，這裡是 GeoVision IVR。"\n';
  let promptCsv = "你是現場維修保養的語音助理。";
  const llmId = "LiquidAI_LFM2.5-1.2B-Instruct-Q4_K_M.gguf";
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
    else if (url.pathname === "/llm/models")
      json = {
        data: noLlmModels
          ? []
          : [
              { id: llmId },
              { id: "Other-local-model.gguf" },
              { id: "Qwen3-Embedding" },
            ],
      };
    else if (url.pathname === "/v1/models")
      json = {
        data: [
          {
            id: "other-vad",
            family: "silero_vad",
            task: "vad",
            mode: "offline",
            path: "/models/other-vad",
            loaded: true,
          },
          {
            id: "other-asr",
            family: "qwen3_asr",
            task: "asr",
            mode: "offline",
            path: "/models/other-asr",
            loaded: true,
          },
          {
            id: "other-tts",
            family: "kokoro",
            task: "tts",
            mode: "offline",
            path: "/models/other-tts",
            loaded: true,
          },
        ],
      };
    else if (url.pathname.endsWith("/ui/models/package-sizes"))
      json = {
        state: "complete",
        data: [
          {
            id: "zipvoice_distill_gguf",
            installed: true,
            load_target: {
              family: "zipvoice",
              model_path: "/app/models/ZipVoice-Distill-GGUF",
              load_options: {},
              session_options: {},
            },
          },
          {
            id: "qwen3_asr_0_6b_q8_0",
            installed: true,
            load_target: {
              family: "qwen3_asr",
              model_path:
                "/app/models/Qwen3-ASR-0.6B-GGUF/qwen3-asr-0.6b-q8_0.gguf",
              load_options: {},
              session_options: {},
            },
          },
        ],
      };
    else if (url.pathname.endsWith("/ui/path-status"))
      json = {
        exists:
          body.path.includes("silero_vad") ||
          body.path.endsWith("audio8-asr-0.1b-q8_0.gguf"),
        file: true,
        directory: false,
      };
    else if (url.pathname.endsWith("/ui/greetings")) {
      if (route.request().method() === "POST") greetingsCsv = body.content;
      json = { content: greetingsCsv };
    } else if (url.pathname.endsWith("/ui/prompt")) {
      if (route.request().method() === "POST") promptCsv = body.content;
      json = { content: promptCsv };
    } else if (url.pathname.endsWith("/models/load"))
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
    if (url.pathname.endsWith("/chat/completions"))
      await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json });
  });
  await page.goto(
    (process.env.UI_BASE_URL || "http://127.0.0.1:4173/").replace(/\/$/, "") +
      "/#/demo",
  );
  await page.getByRole("button", { name: "Start call" }).waitFor();
  assert.equal(await page.title(), "GeoVision · Voice Demo");
  assert.ok(await page.locator('link[rel="icon"]').getAttribute("href"));

  await page.getByLabel("LLM", { exact: true }).selectOption(llmId);
  assert.equal(
    await page
      .locator(".brand")
      .textContent()
      .then((t) => t.trim()),
    "GeoVision IVR",
  );
  assert.equal(await page.locator("a.brand").count(), 0);
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.querySelector(".demo")).backgroundColor,
    ),
    "rgb(7, 16, 31)",
  );
  assert.ok(
    (await page
      .getByLabel("VAD", { exact: true })
      .locator("option:not([disabled])")
      .count()) >= 2,
  );
  assert.ok(
    (await page
      .getByLabel("ASR", { exact: true })
      .locator("option:not([disabled])")
      .count()) >= 3,
  );
  assert.ok(
    (await page
      .getByLabel("TTS", { exact: true })
      .locator("option:not([disabled])")
      .count()) >= 2,
  );
  assert.equal(
    await page
      .getByLabel("LLM", { exact: true })
      .locator("option:not([disabled])")
      .count(),
    2,
  );
  assert.equal(
    await page.getByLabel("Reference transcript", { exact: true }).inputValue(),
    "你好我是語音助手 請問您需要什麼服務 如果需要轉接請按分機號碼",
  );
  await page.getByLabel("ASR hotwords / context").fill("X光機");
  await page.getByLabel("System prompt").fill("請簡短回覆。");
  await page.getByRole("button", { name: "Save prompt.csv" }).click();
  await page.getByText("Saved prompt.csv", { exact: true }).waitFor();
  assert.equal(promptCsv, "請簡短回覆。");
  await page.getByLabel("Call greeting").fill("您好，請說明維修項目。");
  await page.getByRole("button", { name: "Update greetings.csv" }).click();
  await page
    .getByText("Greeting ready · instant playback", { exact: true })
    .waitFor();
  assert.equal(greetingsCsv, 'greeting\n"您好，請說明維修項目。"\n');
  const greetingRequests = requests.filter(
    (r) =>
      r.path === "/v1/audio/speech" &&
      r.body.input === "您好，請說明維修項目。",
  ).length;
  await page.evaluate(() => {
    window.demoStatuses = [];
    const status = document.querySelector(".call-status");
    new MutationObserver(() =>
      window.demoStatuses.push(status.textContent),
    ).observe(status, { childList: true, subtree: true, characterData: true });
  });
  await page.getByRole("button", { name: "Start call" }).click();
  await page.getByText("CONNECTED", { exact: true }).waitFor();
  await page.getByText("GREETING_PLAYED", { exact: true }).waitFor();
  assert.equal(
    requests.filter(
      (r) =>
        r.path === "/v1/audio/speech" &&
        r.body.input === "您好，請說明維修項目。",
    ).length,
    greetingRequests,
  );
  await page
    .locator("article")
    .filter({ hasText: "語音測試" })
    .waitFor()
    .catch(async (cause) => {
      console.error(
        requests,
        await page.locator(".call-status").textContent(),
        errors,
      );
      throw cause;
    });
  await page.waitForFunction(
    () => document.querySelector(".call-status")?.textContent === "Listening",
  );
  assert.ok(
    requests.some(
      (r) => r.path === "/v1/models/load" && r.body.id === "demo-audio8-asr",
    ),
  );
  assert.equal(
    await page.evaluate(() =>
      window.demoStatuses.some((status) => /Loading.*Silero/i.test(status)),
    ),
    false,
  );
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await page.getByLabel("Message", { exact: true }).fill("我要回報工單");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.locator("article").filter({ hasText: "我要回報工單" }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".call-status")?.textContent ===
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
  assert.ok(
    requests.some(
      (r) => r.path === "/llm/v1/chat/completions" && r.body.model === llmId,
    ),
  );
  assert.ok(
    requests.some(
      (r) =>
        r.path === "/v1/audio/transcriptions/details" &&
        r.body.text.includes("X光機"),
    ),
  );
  await page
    .getByRole("columnheader", { name: "RUNTIME", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("columnheader", { name: "SESSION", exact: true })
      .count(),
    0,
  );
  const timedEvents = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("geovision.demo.events.v1")),
  );
  for (const type of [
    "VAD_COMPLETED",
    "USER_INPUT_TRANSCRIBED",
    "LLM_COMPLETED",
    "TTS_COMPLETED",
    "PLAYBACK_COMPLETED",
    "TURN_COMPLETED",
    "GREETING_PLAYED",
  ]) {
    assert.ok(
      timedEvents.some(
        (event) =>
          event.type === type &&
          Number.isFinite(event.runtimeMs) &&
          event.runtimeMs > 0,
      ),
      `Missing wall time for ${type}`,
    );
  }
  assert.ok(
    timedEvents.some(
      (event) => event.type === "LLM_COMPLETED" && event.runtimeMs >= 120,
    ),
  );
  assert.ok(
    timedEvents.some(
      (event) => event.type === "MICROPHONE" && event.runtimeMs === null,
    ),
  );
  await page.getByRole("button", { name: "Hang up" }).click();
  await page.getByRole("button", { name: "Start call" }).waitFor();
  await page
    .getByLabel("ASR", { exact: true })
    .selectOption("package:qwen3-asr:qwen3_asr_0_6b_q8_0");
  await page.getByRole("button", { name: "Record clone voice" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page
    .getByText("Transcript ready · review before calling", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Reference transcript", { exact: true }).inputValue(),
    "語音測試",
  );
  assert.ok(
    requests.some(
      (r) => r.path === "/v1/models/load" && r.body.id === "demo-qwen3-asr",
    ),
  );
  await page.reload();
  await page.getByText("SESSION_ENDED", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  noLlmModels = true;
  await page.getByRole("button", { name: "Refresh models" }).click();
  await page
    .getByText(
      "No downloaded LLM models found. Download a model in the LLM page, then refresh models.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Start call" }).isDisabled(),
    true,
  );
  for (const stage of ["VAD", "ASR", "LLM", "TTS"]) {
    await page
      .getByRole("switch", { name: `Enable ${stage}`, exact: true })
      .uncheck();
  }
  assert.equal(
    await page
      .getByRole("region", { name: "LLM settings" })
      .getByLabel("System prompt")
      .count(),
    1,
  );
  assert.equal(
    await page.getByRole("button", { name: "Start call" }).isDisabled(),
    false,
  );
  let offset = requests.length;
  await page.getByRole("button", { name: "Start call" }).click();
  await page.getByText("CONNECTED", { exact: true }).waitFor();
  await page.getByLabel("Message", { exact: true }).fill("只保留文字");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.locator("article").filter({ hasText: "只保留文字" }).waitFor();
  assert.equal(
    requests.slice(offset).length,
    0,
    "All disabled stages must make no inference requests",
  );
  await page.getByRole("button", { name: "Hang up" }).click();

  // ASR + manual voice turns only: VAD, LLM, and TTS must be bypassed.
  await page.getByRole("switch", { name: "Enable ASR", exact: true }).check();
  offset = requests.length;
  await page.getByRole("button", { name: "Start call" }).click();
  await page
    .getByRole("button", { name: "Record voice turn", exact: true })
    .click();
  await page.waitForTimeout(600);
  await page
    .getByRole("button", { name: "Send voice turn", exact: true })
    .click();
  await page.locator("article").filter({ hasText: "語音測試" }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".call-status")?.textContent ===
      "Ready · record a voice turn",
  );
  assert.ok(
    requests
      .slice(offset)
      .some((r) => r.path === "/v1/audio/transcriptions/details"),
  );
  assert.equal(
    requests
      .slice(offset)
      .some((r) => /tasks\/run|chat\/completions|audio\/speech/.test(r.path)),
    false,
  );
  await page.getByRole("button", { name: "Hang up" }).click();

  // Text directly to TTS, without ASR/VAD/LLM.
  await page.getByRole("switch", { name: "Enable ASR", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Enable TTS", exact: true }).check();
  offset = requests.length;
  await page.getByRole("button", { name: "Start call" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".call-status")?.textContent === "Ready for text",
  );
  await page.getByLabel("Message", { exact: true }).fill("直接朗讀");
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .locator("article")
    .filter({ hasText: "直接朗讀" })
    .first()
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".call-status")?.textContent === "Ready for text",
  );
  assert.ok(
    requests
      .slice(offset)
      .some(
        (r) => r.path === "/v1/audio/speech" && r.body.input === "直接朗讀",
      ),
  );
  assert.equal(
    requests
      .slice(offset)
      .some((r) => /tasks\/run|transcriptions|chat\/completions/.test(r.path)),
    false,
  );
  await page.getByRole("button", { name: "Hang up" }).click();

  noLlmModels = false;
  await page.getByRole("button", { name: "Refresh models" }).click();
  await page.getByRole("switch", { name: "Enable TTS", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Enable LLM", exact: true }).check();
  await page.getByRole("button", { name: "Start call" }).click();
  offset = requests.length;
  await page.getByLabel("Message", { exact: true }).fill("只用 LLM");
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .locator("article")
    .filter({ hasText: "您好，請問需要什麼協助？" })
    .waitFor();
  assert.ok(
    requests.slice(offset).some((r) => r.path === "/llm/v1/chat/completions"),
  );
  assert.equal(
    requests.slice(offset).some((r) => r.path === "/v1/audio/speech"),
    false,
  );
  await page.getByRole("button", { name: "Hang up" }).click();
  assert.deepEqual(errors, []);
  if (!((await page.locator(".scenario-panel").getAttribute("open")) !== null))
    await page.locator(".scenario-panel > summary").click();
  const eventBox = await page.locator(".events").boundingBox(),
    scenarioBox = await page.locator(".scenario-dock").boundingBox();
  assert.ok(scenarioBox.x >= eventBox.x + eventBox.width - 1);
  assert.ok(Math.abs(scenarioBox.y - eventBox.y) < 2);
  await page
    .getByLabel("Scenario", { exact: true })
    .selectOption("maintenance");
  await page.getByRole("switch", { name: "Enable TTS", exact: true }).check();
  let scenarioOffset = requests.length;
  await page
    .getByRole("button", { name: "Run Scenario 2", exact: true })
    .click();
  await page.getByText("Scenario 2 complete", { exact: true }).waitFor();
  let scenarioRequests = requests.slice(scenarioOffset);
  const scenarioChats = scenarioRequests.filter(
    (r) => r.path === "/llm/v1/chat/completions",
  );
  assert.equal(scenarioChats.length, 3);
  assert.deepEqual(
    scenarioChats.map(
      (r) => r.body.messages.filter((m) => m.role === "user").length,
    ),
    [1, 2, 3],
  );
  assert.ok(
    scenarioChats[0].body.messages
      .at(-1)
      .content.includes(
        "F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。",
      ),
  );
  assert.ok(
    scenarioChats[1].body.messages
      .at(-1)
      .content.includes("SN：14865412 製造日期：2010年12月15日 電容值：6780MF"),
  );
  assert.equal(
    scenarioChats[2].body.messages.at(-1).content,
    "正確，起機測試正常。",
  );
  const technicianCalls = scenarioRequests.filter(
    (r) => r.path === "/v1/audio/speech" && r.body.voice === "wangSG9s",
  );
  assert.equal(technicianCalls.length, 3);
  assert.ok(
    technicianCalls.every((r) => !r.body.voice_ref && !r.body.reference_text),
  );
  assert.ok(
    scenarioRequests.some(
      (r) =>
        r.path === "/v1/audio/speech" &&
        r.body.voice === "lingCLvocals" &&
        r.body.input === "您好，請問需要什麼協助？",
    ),
  );
  assert.equal(await page.locator("article.user").count(), 3);
  await page.getByRole("button", { name: "Hang up" }).click();

  // Changing the assistant voice reverses the technician voice automatically.
  await page
    .getByLabel("Built-in voice", { exact: true })
    .selectOption("wangSG9s");
  scenarioOffset = requests.length;
  await page.locator(".scenario-script > summary").click();
  await page
    .getByRole("button", { name: "Send technician turn 1", exact: true })
    .click();
  await page.getByText("Turn complete", { exact: true }).waitFor();
  assert.ok(
    requests
      .slice(scenarioOffset)
      .some(
        (r) =>
          r.path === "/v1/audio/speech" &&
          r.body.voice === "lingCLvocals" &&
          r.body.input.startsWith("我要回報工單"),
      ),
  );
  await page.getByRole("button", { name: "Hang up" }).click();

  await page.getByLabel("Scenario", { exact: true }).selectOption("audio");
  assert.equal(await page.locator(".example-chips button").count(), 5);
  await page.getByRole("switch", { name: "Enable ASR", exact: true }).check();
  await page
    .getByLabel("Choose scenario audio", { exact: true })
    .setInputFiles({
      name: "scenario-test.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  scenarioOffset = requests.length;
  await page.getByRole("button", { name: "Send audio", exact: true }).click();
  await page.getByText("Scenario 1 complete", { exact: true }).waitFor();
  assert.ok(
    requests
      .slice(scenarioOffset)
      .some((r) => r.path === "/v1/audio/transcriptions/details"),
  );
  await page.getByRole("button", { name: "Hang up" }).click();
  assert.deepEqual(errors, []);
  if (process.env.UI_SCREENSHOT_PATH)
    await page.screenshot({ path: process.env.UI_SCREENSHOT_PATH });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log(
    "PASS downloaded-model dropdowns, actual LLM IDs, unlinked branding, CSV saves, cached greeting, ASR hotwords, clone recording/transcript, voice/text calls, history, runtime measurements, stage switches/bypasses/manual turns, audio scenario, three-turn maintenance simulation, distinct technician/assistant voices, mobile layout",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
