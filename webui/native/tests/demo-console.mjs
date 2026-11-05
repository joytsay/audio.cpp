import assert from "node:assert/strict";
import fs from "node:fs";
import { installMcpFixture } from "./mcp-browser-fixture.mjs";
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
      "--mute-audio",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
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
  let sharedSettings = null,
    voxAvailable = false;
  let transcriptionText = "語音測試",
    replyText = "您好，請問需要什麼協助？";
  let longStreamAudio = false;
  let vadCalls = 0,
    noLlmModels = false;
  let llmState = "unloaded",
    llmLoadPolls = 0;
  let llmReportsRtf = false,
    checkingAudioHighlights = false;
  const highlightedTurns = [];
  let greetingsCsv = 'greeting\n"您好，這裡是 GeoVision IVR。"\n';
  let hotwordsCsv = 'context\n"Technical terms: 台積電, X光機"\n';
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
  const sharedVoices = new Map([
    [
      "preset-lingCLvocals",
      {
        id: "preset-lingCLvocals",
        name: "lingCLvocals",
        transcript: "Ling reference transcript",
        audio: wav.toString("base64"),
        createdAt: 0,
      },
    ],
    [
      "preset-wangSG9s",
      {
        id: "preset-wangSG9s",
        name: "wangSG9s",
        transcript: "Wang reference transcript",
        audio: wav.toString("base64"),
        createdAt: 0,
      },
    ],
  ]);
  const apiRoute = async (route) => {
    const url = new URL(route.request().url());
    const body =
      route.request().method() === "POST" &&
      route.request().headers()["content-type"]?.includes("json")
        ? route.request().postDataJSON()
        : {};
    requests.push({ path: url.pathname, body });
    if (
      checkingAudioHighlights &&
      url.pathname.endsWith("/audio/transcriptions/details")
    ) {
      const current = page.locator(".example-chips button.processing");
      assert.equal(await current.count(), 1);
      assert.equal(await current.getAttribute("aria-current"), "step");
      highlightedTurns.push(await current.textContent());
    }
    if (
      checkingAudioHighlights &&
      (url.pathname.endsWith("/chat/completions") ||
        (url.pathname.endsWith("/audio/speech") &&
          body.input === "您好，請問需要什麼協助？"))
    )
      assert.equal(
        await page.locator(".example-chips button.processing").textContent(),
        highlightedTurns.at(-1),
      );
    if (url.pathname === "/llm/v1/chat/completions") {
      assert.equal(
        llmState,
        "loaded",
        "The demo must wait for the worker to be ready before chat",
      );
      assert.equal(url.searchParams.get("autoload"), "true");
    }
    if (url.pathname === "/v1/ui/demo-settings") {
      if (route.request().method() === "POST") sharedSettings = body.settings;
      return route.fulfill({
        json: { settings: sharedSettings, exists: !!sharedSettings },
      });
    }
    if (url.pathname === "/v1/audio/speech" && body.stream) {
      assert.equal(body.stream_format, "sse");
      assert.equal(body.response_format, "pcm");
      assert.ok(body.model.endsWith("-streaming"));
      const pcm = longStreamAudio ? Buffer.alloc(32000 * 4) : wav.subarray(44);
      const delta = {
        type: "speech.audio.delta",
        audio: pcm.toString("base64"),
        sample_rate: 16000,
        channels: 1,
        format: "pcm_s16le",
      };
      return route.fulfill({
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify({ type: "speech.audio.done", timing: { ttft_ms: 12 } })}\n\ndata: [DONE]\n\n`,
      });
    }
    if (url.pathname === "/v1/ui/voice-preview")
      return route.fulfill({ contentType: "audio/wav", body: wav });
    if (url.pathname === "/v1/ui/voices") {
      if (route.request().method() === "POST") sharedVoices.set(body.id, body);
      if (route.request().method() === "DELETE")
        sharedVoices.delete(url.searchParams.get("id"));
      return route.fulfill({ json: { voices: [...sharedVoices.values()] } });
    }
    let json = {};
    if (url.pathname.endsWith("models-root"))
      json = { models_root: "/app/models" };
    else if (
      url.pathname === "/llm/models" &&
      route.request().method() === "POST"
    ) {
      assert.equal(
        body.model,
        "bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M",
      );
      noLlmModels = false;
      llmState = "unloaded";
      llmLoadPolls = 0;
      json = { success: true };
    } else if (url.pathname === "/llm/models/load") {
      assert.equal(body.model, llmId);
      llmState = "loading";
      llmLoadPolls = 0;
      json = { success: true };
    } else if (url.pathname === "/llm/models") {
      if (llmState === "loading" && ++llmLoadPolls >= 2) llmState = "loaded";
      json = {
        data: noLlmModels
          ? [
              {
                id: "bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M",
                status: { value: "incomplete" },
              },
            ]
          : [
              { id: llmId, status: { value: llmState } },
              { id: "Other-local-model.gguf", status: { value: "loaded" } },
              { id: "Qwen3-Embedding" },
            ],
      };
    } else if (url.pathname === "/v1/models")
      json = {
        data: [
          ...(voxAvailable
            ? [
                {
                  id: "voxcpm-test",
                  family: "voxcpm1",
                  task: "tts",
                  mode: "offline",
                  path: "/models/voxcpm.gguf",
                  loaded: true,
                },
              ]
            : []),
          {
            id: "configured-silero",
            family: "silero_vad",
            task: "vad",
            path: "/app/assets/framework/models/silero_vad/",
            loaded: true,
          },
          {
            id: "demo-silero-vad",
            family: "silero_vad",
            task: "vad",
            mode: "offline",
            path: "assets/framework/models/silero_vad",
            loaded: true,
          },
          {
            id: "configured-zipvoice",
            family: "zipvoice",
            task: "tts",
            path: "/app/models/ZipVoice-Distill-GGUF/",
            loaded: true,
          },
          {
            id: "demo-zipvoice",
            family: "zipvoice",
            task: "clon",
            mode: "offline",
            path: "/app/models/ZipVoice-Distill-GGUF/zipvoice-distill-orig.gguf",
            loaded: true,
          },
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
          body.path.endsWith("audio8-asr-0.1b-q8_0.gguf") ||
          body.path.endsWith("custom-saved-model.gguf"),
        file: true,
        directory: false,
      };
    else if (url.pathname.endsWith("/ui/hotwords")) {
      if (route.request().method() === "POST") hotwordsCsv = body.content;
      json = { content: hotwordsCsv };
    } else if (url.pathname.endsWith("/ui/greetings")) {
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
        timing: { rtf: 0 },
        segments:
          ++vadCalls === 1 ? [{ start_sample: 0, end_sample: 8000 }] : [],
      };
    else if (url.pathname.endsWith("/audio/transcriptions/details"))
      json = { text: transcriptionText, timing: { rtf: 0.024241 } };
    else if (url.pathname.endsWith("/chat/completions"))
      json = {
        choices: [{ message: { content: (() => {
          const grounding = body.messages?.find(message => message.role === "system" && message.content.includes("維修依據JSON："));
          if (!grounding) return replyText;
          const facts = JSON.parse(grounding.content.split("維修依據JSON：")[1]);
          assert.equal(facts.current, body.messages.filter(message => message.role === "user").at(-1).content);
          assert.ok(facts.transcripts.includes(facts.current));
          // Deliberately return unrelated model prose to verify the UI uses
          // the transcript-derived readback for structured maintenance turns.
          if (replyText.startsWith('SN：99999999')) return replyText;
          if (body.messages[0].content.includes('第一輪逐台複誦')) {
            assert.ok(body.messages[0].content.includes('以上是否正確。'));
            return facts.readback;
          }
          return facts.readback;
        })() } }],
        timings: llmReportsRtf ? { rtf: 0.75 } : { predicted_per_second: 45 },
      };
    else if (url.pathname.endsWith("/audio/speech")) {
      assert.equal(body.response_format, "json");
      return route.fulfill({
        json: {
          audio: wav.toString("base64"),
          format: "wav",
          timing: { rtf: 0.5 },
        },
      });
    }
    if (url.pathname.endsWith("/chat/completions"))
      await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json });
  };
  await page.route(/\/(v1|llm)\//, apiRoute);
  await page.addInitScript(() => {
    if (!localStorage.getItem("geovision.demo.events.v1"))
      localStorage.setItem(
        "geovision.demo.events.v1",
        JSON.stringify([
          {
            time: new Date().toISOString(),
            run: "legacy",
            type: "USER_INPUT_TRANSCRIBED",
            summary: "legacy transcript",
            runtimeMs: 12,
          },
        ]),
      );
    window.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.cspViolations.push(event.violatedDirective),
    );
    // Accelerate long source clips in the test; the assistant WAV fixture stays unchanged.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.playbackRate = 16;
      return play.call(this);
    };
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "Content-Security-Policy":
          "default-src 'self' 'unsafe-inline' blob: data:; connect-src 'self'; media-src 'self' blob: data:",
      },
    });
  });
  await page.goto(
    (process.env.UI_BASE_URL || "http://127.0.0.1:4173/").replace(/\/$/, "") +
      "/#/demo",
  );
  await page.getByRole("button", { name: "Start call" }).waitFor();
  assert.equal(await page.title(), "GeoVision · IVR");
  assert.ok(await page.locator('link[rel="icon"]').getAttribute("href"));

  await page.getByLabel("LLM", { exact: true }).selectOption(llmId);
  if (process.env.UI_MCP_ONLY === "1") {
    const fixture = await installMcpFixture(page);
    await page.getByRole('switch', {name:'Enable ASR',exact:true}).uncheck();
    await page.getByLabel('Scenario',{exact:true}).selectOption('maintenance-audio');
    await page.getByLabel('Dialogue source',{exact:true}).selectOption('n8n');
    await page.getByRole('button',{name:'Start call',exact:true}).click();
    const turns=JSON.parse(fs.readFileSync(new URL('../../../examples/docker/agx-one-container/n8n/scenario-1-turns.json',import.meta.url)));
    for (const [turnIndex, turn] of turns.entries()) {
      await page.getByLabel('Message',{exact:true}).fill(turn.text);
      await page.getByRole('button',{name:'Send message',exact:true}).click();
      await page.waitForFunction(expected=>document.querySelector('.transcript article:not(.user):last-child p')?.textContent===expected, turn.expected.replace('有兩個','有2個'));
      await page.waitForFunction(expected=>[...document.querySelectorAll('.event-scroll td')].filter(cell=>cell.textContent==='TURN_COMPLETED').length>=expected, turnIndex+1);
    }
    assert.equal(fixture.calls.length,6);
    assert.equal(fixture.completions.length,9);
    assert.ok(requests.some(r=>r.path==='/v1/audio/speech'&&r.body.input.includes('已輸入完成')));
    assert.ok(await page.getByText('MCP_TOOL_COMPLETED',{exact:true}).count());
    assert.deepEqual(errors,[]);
    await browser.close();
    console.log('PASS browser voice assistant: local LLM → MCP discovery/tools → three maintenance replies → TTS and tool events');
    return;
  }

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
    "Ling reference transcript",
  );
  assert.equal(
    await page
      .getByLabel("VAD", { exact: true })
      .locator("option:not([disabled])")
      .count(),
    2,
    "Registered Silero aliases must be deduplicated",
  );
  assert.equal(
    await page
      .getByLabel("TTS", { exact: true })
      .locator("option:not([disabled])")
      .count(),
    2,
    "Registered ZipVoice aliases must be deduplicated",
  );
  const greetingBox = await page
    .getByRole("region", { name: "Call greeting settings", exact: true })
    .boundingBox();
  const vadBox = await page
    .getByRole("region", { name: "VAD settings", exact: true })
    .boundingBox();
  assert.ok(
    greetingBox.y < vadBox.y,
    "Call greeting must precede model settings",
  );
  assert.equal(
    await page.getByLabel("ASR hotwords / context").inputValue(),
    "Technical terms: 台積電, X光機",
  );
  await page.getByLabel("ASR hotwords / context").fill("X光機");
  await page
    .getByRole("button", { name: "Save hotwords.csv", exact: true })
    .click();
  await page.getByText("Saved hotwords.csv", { exact: true }).waitFor();
  assert.equal(hotwordsCsv, 'context\n"X光機"\n');
  await page.getByLabel("System prompt").fill("請簡短回覆。");
  await page.getByRole("button", { name: "Save prompt.csv" }).click();
  await page.getByText("Saved prompt.csv", { exact: true }).waitFor();
  assert.equal(promptCsv, "請簡短回覆。");
  await page
    .getByLabel("Call greeting", { exact: true })
    .fill("您好，請說明維修項目。");
  await page.getByRole("button", { name: "Update greetings.csv" }).click();
  await page
    .getByText("Greeting ready · instant playback", { exact: true })
    .waitFor();
  assert.equal(greetingsCsv, 'greeting\n"您好，請說明維修項目。"\n');
  const greetingRequest = requests.find(
    (r) =>
      r.path === "/v1/audio/speech" &&
      r.body.input === "您好，請說明維修項目。",
  );
  assert.equal(
    greetingRequest.body.reference_text,
    undefined,
    "Built-in greeting must not override its reference transcript",
  );
  assert.equal(greetingRequest.body.voice_ref, undefined);
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
  await page.getByRole("columnheader", { name: "RTF", exact: true }).waitFor();
  assert.equal(
    await page.getByText("USER_INPUT_TRANSCRIBED", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .locator(".events tbody tr")
      .filter({ hasText: "legacy transcript" })
      .locator("td.rtf")
      .textContent(),
    "—",
  );
  assert.equal(
    await page
      .locator(".events tbody tr")
      .filter({ hasText: "VAD_COMPLETED" })
      .first()
      .locator("td.rtf")
      .textContent(),
    "0.0000",
  );
  assert.equal(
    await page
      .locator(".events tbody tr")
      .filter({ hasText: "ASR_COMPLETED" })
      .first()
      .locator("td.rtf")
      .textContent(),
    "0.0242",
  );
  assert.equal(
    await page
      .locator(".events tbody tr")
      .filter({ hasText: "TTS_COMPLETED" })
      .first()
      .locator("td.rtf")
      .textContent(),
    "0.5000",
  );
  assert.equal(
    await page
      .locator(".events tbody tr")
      .filter({ hasText: "LLM_COMPLETED" })
      .first()
      .locator("td.rtf")
      .textContent(),
    "—",
  );
  const timedEvents = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("geovision.demo.events.v1")),
  );
  for (const type of [
    "VAD_COMPLETED",
    "ASR_COMPLETED",
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
      (event) => event.type === "ASR_COMPLETED" && event.rtf === 0.024241,
    ),
  );
  assert.ok(
    timedEvents.some(
      (event) => event.type === "TTS_COMPLETED" && event.rtf === 0.5,
    ),
  );
  assert.ok(
    timedEvents.some(
      (event) => event.type === "LLM_COMPLETED" && event.rtf === null,
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
  assert.match(
    await page.getByLabel("Clone Custom Voice", { exact: true }).inputValue(),
    /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-mic$/,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Record clone voice" })
      .textContent(),
    "",
  );
  await page
    .getByLabel("Clone Custom Voice", { exact: true })
    .fill("Shared test voice");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByText("Voice saved on the server for all clients.", { exact: true })
    .waitFor();
  assert.equal(sharedVoices.size, 3);
  const savedId = [...sharedVoices.keys()].find(
    (id) => !id.startsWith("preset-"),
  );
  await page.reload();
  await page.getByLabel("Saved voices", { exact: true }).selectOption(savedId);
  assert.match(
    await page
      .getByLabel("Voice reference playback", { exact: true })
      .getAttribute("src"),
    /^blob:/,
  );
  assert.equal(
    await page.getByLabel("Reference transcript", { exact: true }).inputValue(),
    "語音測試",
  );
  assert.equal(
    await page.getByLabel("Clone TTS test", { exact: true }).inputValue(),
    "這裡是複製聲音TTS的測試",
  );
  await page
    .getByRole("region", { name: "TTS settings", exact: true })
    .getByRole("button", { name: "Send", exact: true })
    .click();
  await page
    .getByLabel("Cloned voice test playback", { exact: true })
    .waitFor();
  assert.ok(
    requests.some(
      (r) =>
        r.path === "/v1/audio/speech" &&
        r.body.input === "這裡是複製聲音TTS的測試" &&
        r.body.voice_ref &&
        r.body.reference_text === "語音測試",
    ),
  );
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByText("Voice deleted from the server.", { exact: true })
    .waitFor();
  assert.equal(sharedVoices.size, 2);
  assert.equal(
    await page.getByLabel("Built-in voice", { exact: true }).count(),
    0,
  );
  await page
    .getByLabel("Saved voices", { exact: true })
    .selectOption("preset-wangSG9s");
  assert.equal(
    await page.getByLabel("Reference transcript", { exact: true }).inputValue(),
    "Wang reference transcript",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByLabel("Clone Custom Voice", { exact: true })
      .getAttribute("readonly"),
    "",
  );
  assert.equal(
    await page
      .getByLabel("Voice reference playback", { exact: true })
      .getAttribute("src"),
    "/v1/ui/voice-preview?voice=wangSG9s",
  );
  await page
    .getByLabel("Saved voices", { exact: true })
    .selectOption("preset-lingCLvocals");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "reference.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await page
    .getByText("Transcript ready · review before calling", { exact: true })
    .waitFor();
  assert.match(
    await page.getByLabel("Clone Custom Voice", { exact: true }).inputValue(),
    /-reference\.wav$/,
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
  assert.ok(
    (
      await page
        .getByLabel("LLM", { exact: true })
        .locator("option")
        .allTextContents()
    ).some(
      (label) =>
        label.includes("LiquidAI_LFM2.5-1.2B-Instruct-Q4_K_M.gguf") &&
        label.includes("download required"),
    ),
  );
  await page
    .getByRole("button", { name: "Resume LFM2.5 Q4_K_M", exact: true })
    .click();
  await page
    .getByText("LFM2.5 Q4_K_M downloaded and ready", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("LLM", { exact: true }).inputValue(),
    llmId,
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
  llmReportsRtf = true;
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
  assert.equal(
    await page
      .locator(".events tbody tr")
      .filter({ hasText: "LLM_COMPLETED" })
      .first()
      .locator("td.rtf")
      .textContent(),
    "0.7500",
  );
  await page.getByRole("button", { name: "Hang up" }).click();
  assert.deepEqual(errors, []);
  assert.equal(await page.locator("details.scenario-panel").count(), 0);
  await page
    .locator(".scenario-title")
    .getByText("Scenarios", { exact: true })
    .waitFor();
  const eventBox = await page.locator(".events").boundingBox(),
    scenarioBox = await page.locator(".scenario-dock").boundingBox();
  assert.ok(scenarioBox.x >= eventBox.x + eventBox.width - 1);
  assert.ok(Math.abs(scenarioBox.y - eventBox.y) < 2);
  assert.ok(Math.abs(scenarioBox.width - eventBox.width) < 2);
  await page
    .getByLabel("Scenario", { exact: true })
    .selectOption("maintenance");
  await page.getByRole("switch", { name: "Enable TTS", exact: true }).check();
  let scenarioOffset = requests.length;
  await page
    .getByRole("button", { name: "Run Scenario 1", exact: true })
    .click();
  await page.getByText("Scenario 1 complete", { exact: true }).waitFor();
  let scenarioRequests = requests.slice(scenarioOffset);
  const scenarioChats = scenarioRequests.filter(
    (r) => r.path === "/llm/v1/chat/completions",
  );
  assert.equal(
    scenarioChats.length,
    3,
    "Every maintenance turn calls the LLM with transcript grounding",
  );
  const maintenanceReplies = await page
    .locator(".transcript article:not(.user) p")
    .allTextContents();
  assert.ok(
    maintenanceReplies.some((text) =>
      text.includes(
        "F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。",
      ),
    ),
  );
  assert.ok(
    maintenanceReplies.some((text) =>
      text.includes("SN：14865412 製造日期：2010年12月15日 電容值：6780MF"),
    ),
  );
  assert.equal(
    maintenanceReplies.at(-1),
    "好的，工單：F15P1/2_ME VFD備品與維修，已輸入完成，謝謝。",
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
        r.body.input.includes("五年一維"),
    ),
  );
  assert.equal(await page.locator("article.user").count(), 3);
  await page.getByRole("button", { name: "Hang up" }).click();

  // Changing the assistant voice reverses the technician voice automatically.
  await page
    .getByLabel("Saved voices", { exact: true })
    .selectOption("preset-wangSG9s");
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
  await page.getByText("Scenario 0 complete", { exact: true }).waitFor();
  assert.ok(
    requests
      .slice(scenarioOffset)
      .some((r) => r.path === "/v1/audio/transcriptions/details"),
  );
  await page.getByRole("button", { name: "Hang up" }).click();
  assert.deepEqual(errors, []);
  // Selecting an example only previews it; sending requires the Send button.
  scenarioOffset = requests.length;
  const chatPlayersBefore = await page.locator(".transcript audio").count();
  await page
    .getByRole("button", { name: "中央監控站2.mp3", exact: true })
    .click();
  const preview = page.getByLabel("Selected audio preview", { exact: true });
  await preview.waitFor();
  assert.equal(await preview.evaluate((audio) => audio.paused), true);
  await page.locator('.example-chips button[aria-pressed="true"]').filter({ hasText: "中央監控站2.mp3" }).waitFor();
  assert.ok(
    (
      await page
        .getByRole("button", { name: "中央監控站2.mp3", exact: true })
        .getAttribute("class")
    ).includes("selected"),
  );
  assert.ok(
    (await page.locator(".scenario-upload").boundingBox()).height <= 60,
    "Audio chooser should be one compact row",
  );
  await preview.evaluate((audio) => audio.play());
  await page.waitForFunction(
    () => document.querySelector(".scenario-preview")?.ended,
  );
  assert.equal(
    await page.locator(".transcript audio").count(),
    chatPlayersBefore,
  );
  assert.equal(
    requests
      .slice(scenarioOffset)
      .some((r) =>
        /transcriptions|chat\/completions|audio\/speech/.test(r.path),
      ),
    false,
    "Previewing a clip must not send it",
  );
  await page.getByRole("button", { name: "Send audio", exact: true }).click();
  await page.getByText("Scenario 0 complete", { exact: true }).waitFor();
  await page
    .getByLabel("Audio message: 中央監控站2.mp3", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByLabel("Audio message: 中央監控站2.mp3", { exact: true })
      .evaluate((audio) => audio.ended),
    true,
  );
  assert.ok(
    requests
      .slice(scenarioOffset)
      .some((r) => r.path === "/v1/audio/transcriptions/details"),
  );
  assert.ok(
    requests
      .slice(scenarioOffset)
      .some((r) => r.path === "/llm/v1/chat/completions"),
  );
  assert.ok(
    requests
      .slice(scenarioOffset)
      .filter((r) => r.path === "/llm/v1/chat/completions")
      .every((r) =>
        r.body.messages.every(
          (message) => !("audioUrl" in message) && !("audioId" in message),
        ),
      ),
  );
  await page.getByRole("button", { name: "Hang up" }).click();

  scenarioOffset = requests.length;
  checkingAudioHighlights = true;
  await page
    .getByRole("button", { name: "Play all 5 examples", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hide scenarios", exact: true })
    .click();
  await page.getByRole("button", { name: "Hide events", exact: true }).click();
  assert.equal(
    await page.locator("#demo-scenarios-content").isVisible(),
    false,
  );
  await page
    .getByRole("button", { name: "Show scenarios", exact: true })
    .click();
  await page.getByRole("button", { name: "Show events", exact: true }).click();
  await page
    .getByText("All 5 examples complete", { exact: true })
    .waitFor({ timeout: 90000 });
  checkingAudioHighlights = false;
  const names = [
    "中央監控站2.mp3",
    "中控室.mp3",
    "員工檢查哨.mp3",
    "大廳.mp3",
    "車輛檢查哨.mp3",
  ];
  assert.deepEqual(
    await page.locator(".transcript .audio-message-name").allTextContents(),
    names,
  );
  assert.deepEqual(
    highlightedTurns.map((name) => name.trim()),
    names,
  );
  assert.equal(await page.locator(".transcript audio").count(), 5);
  assert.equal(
    await page
      .locator(".transcript audio")
      .evaluateAll((elements) => elements.every((audio) => audio.ended)),
    true,
  );
  const audioQueueRequests = requests.slice(scenarioOffset);
  assert.equal(
    audioQueueRequests.filter(
      (r) => r.path === "/v1/audio/transcriptions/details",
    ).length,
    5,
  );
  assert.equal(
    audioQueueRequests.filter((r) => r.path === "/llm/v1/chat/completions")
      .length,
    5,
  );
  assert.equal(
    audioQueueRequests.filter(
      (r) =>
        r.path === "/v1/audio/speech" &&
        r.body.input === "您好，請問需要什麼協助？",
    ).length,
    5,
  );
  const queueEvents = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("geovision.demo.events.v1"))
      .filter((event) =>
        ["INPUT_AUDIO_PLAYED", "TURN_COMPLETED"].includes(event.type),
      )
      .slice(0, 10)
      .reverse(),
  );
  assert.deepEqual(
    queueEvents.map((event) => event.type),
    Array.from({ length: 5 }, () => [
      "INPUT_AUDIO_PLAYED",
      "TURN_COMPLETED",
    ]).flat(),
  );
  assert.deepEqual(
    queueEvents
      .filter((event) => event.type === "INPUT_AUDIO_PLAYED")
      .map((event) => event.summary),
    names,
  );
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  await page.getByRole("button", { name: "Hang up" }).click();
  if (process.env.UI_SCREENSHOT_PATH)
    await page.screenshot({ path: process.env.UI_SCREENSHOT_PATH });
  scenarioOffset = requests.length;
  await page
    .getByRole("button", { name: "Play all 5 examples", exact: true })
    .click();
  await page
    .getByLabel("Audio message: 中央監控站2.mp3", { exact: true })
    .waitFor();
  await page
    .getByLabel("Audio message: 中央監控站2.mp3", { exact: true })
    .evaluate((audio) => (audio.playbackRate = 1));
  await page
    .getByRole("button", { name: "Stop scenario", exact: true })
    .click();
  await page.getByText("Scenario stopped", { exact: true }).waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.locator(".transcript audio").count(), 1);
  assert.equal(
    await page.locator(".transcript audio").evaluate((audio) => audio.paused),
    true,
  );
  assert.equal(
    requests
      .slice(scenarioOffset)
      .filter((r) => r.path === "/v1/audio/transcriptions/details").length,
    0,
    "Stopping input playback must cancel remaining transcription and examples",
  );
  await page.getByRole("button", { name: "Hang up" }).click();
  assert.deepEqual(
    await page
      .getByLabel("Scenario", { exact: true })
      .locator("option")
      .allTextContents(),
    [
      "Scenario 0 · audio examples",
      "Scenario 1 · 現場維修保養後的語音回報",
      "Scenario 2 · maintenance audio",
    ],
  );
  await page
    .getByLabel("Scenario", { exact: true })
    .selectOption("maintenance-audio");
  const maintenanceAudioNames = [
    "scenario2-1.wav",
    "scenario2-2.wav",
    "scenario2-3.wav",
  ];
  assert.deepEqual(
    await page.locator(".example-chips button").allTextContents(),
    maintenanceAudioNames,
  );
  await page.getByText("No audio selected", { exact: true }).waitFor();
  const selectionOffset = requests.length;
  await page
    .getByRole("button", { name: "scenario2-1.wav", exact: true })
    .click();
  await page.getByLabel("Selected audio preview", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "scenario2-1.wav", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    requests
      .slice(selectionOffset)
      .filter((r) => r.path === "/v1/audio/transcriptions/details").length,
    0,
    "Selecting a WAV only opens its preview",
  );
  await page
    .getByLabel("Selected audio preview", { exact: true })
    .evaluate((audio) => audio.play());
  await page.waitForFunction(
    () => document.querySelector(".scenario-preview")?.ended,
  );
  await page.getByRole("button", { name: "Send audio", exact: true }).click();
  await page
    .getByText("Scenario 2 complete", { exact: true })
    .waitFor({ timeout: 90000 });
  assert.deepEqual(
    await page.locator(".transcript .audio-message-name").allTextContents(),
    ["scenario2-1.wav"],
  );
  await page.getByRole("button", { name: "Hang up", exact: true }).click();
  const maintenanceQueueOffset = requests.length;
  highlightedTurns.length = 0;
  checkingAudioHighlights = true;
  await page
    .getByRole("button", { name: "Play all 3 examples", exact: true })
    .click();
  await page
    .getByText("All 3 examples complete", { exact: true })
    .waitFor({ timeout: 90000 });
  checkingAudioHighlights = false;
  assert.deepEqual(
    await page.locator(".transcript .audio-message-name").allTextContents(),
    maintenanceAudioNames,
  );
  assert.deepEqual(
    highlightedTurns.map((name) => name.trim()),
    maintenanceAudioNames,
  );
  assert.equal(
    requests
      .slice(maintenanceQueueOffset)
      .filter((r) => r.path === "/v1/audio/transcriptions/details").length,
    3,
  );
  assert.equal(
    requests
      .slice(maintenanceQueueOffset)
      .filter((r) => r.path === "/llm/v1/chat/completions").length,
    3,
  );
  assert.equal(
    requests
      .slice(maintenanceQueueOffset)
      .filter(
        (r) =>
          r.path === "/v1/audio/speech" &&
          r.body.input === "您好，請問需要什麼協助？",
      ).length,
    3,
  );
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  await page.getByRole("button", { name: "Hang up", exact: true }).click();
  // The mock LLM uses request grounding instead of unrelated sample fields.
  // Verify all three normalized turns still call completions.
  replyText = "SN：99999999，制造日期2015年1月1日，电容值9999MF。";
  await page.getByLabel("ASR hotwords / context").fill("");
  await page
    .getByRole("button", { name: "scenario2-3.wav", exact: true })
    .click();
  const normalizationOffset = requests.length;
  const rawTurns = [
    "我要回報工單，二零二六年六月二日下午十四點，臺積電F一五P一二ME VFD備品與維修，F一五P一H四K GEX-EF零三五年一維更換強排，FAN二個界面FAN六個，F一五P一H四K GEX-EF零四五年一維更換強排FAN二個界面FAN四個。",
    "正確，請幫我備註：二零BD一五六AOAANNCU，SN一四七七八七二五製造日期，二零一零年十二月三日電容值六四六零MF，二零BD一五六AOAANNCU，SN一四八六五四一二製造日期，二零一零年十二月十五日電容值六七八零MF。",
    "正確起機測試正常。",
  ];
  const expectedReplies = [
    "F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。\n\nF15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。\n\n以上是否正確。",
    "20BD156AOAANNCU有2個，分別為\n\nSN：14778725 製造日期：2010年12月3日 電容值：6460MF\n\nSN：14865412 製造日期：2010年12月15日 電容值：6780MF\n\n以上是否正確。",
    "好的，工單：F15P1/2_ME VFD備品與維修，已輸入完成，謝謝。",
  ];
  for (let turn = 0; turn < rawTurns.length; turn++) {
    transcriptionText = rawTurns[turn];
    await page.getByRole("button", { name: "Send audio", exact: true }).click();
    await page
      .getByText("Scenario 2 complete", { exact: true })
      .waitFor({ timeout: 90000 });
    assert.equal(
      await page
        .locator(".transcript article:not(.user) p")
        .last()
        .textContent(),
      expectedReplies[turn],
    );
    if (turn === 0) {
      assert.equal(
        await page.locator(".transcript article.user p").last().textContent(),
        "我要回報工單，2026年6月2日下午14:00台積電F15P1/2_ME VFD備品與維修。\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。\nF15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。",
      );
    }
    if (turn === 1)
      assert.ok(
        (
          await page.locator(".transcript article.user p").last().textContent()
        ).includes("SN：14865412製造日期：2010年12月15日電容值：6780MF"),
      );
  }
  assert.equal(
    requests
      .slice(normalizationOffset)
      .filter((r) => r.path === "/llm/v1/chat/completions").length,
    3,
  );
  assert.ok(
    requests
      .slice(normalizationOffset)
      .some(
        (r) =>
          r.path === "/v1/audio/speech" &&
          r.body.input.includes("SN：一四七七八七二伍"),
      ),
    "TTS receives the confirmed maintenance readout",
  );
  assert.ok(
    !requests
      .slice(normalizationOffset)
      .some(
        (r) =>
          r.path === "/v1/audio/speech" && r.body.input.includes("99999999"),
      ),
  );
  transcriptionText = "語音測試";
  replyText = "您好，請問需要什麼協助？";
  await page.getByRole("button", { name: "Hang up", exact: true }).click();
  // The local LLM calls n8n MCP tools, then generates the final voice reply.
  const workflowReply = "n8n 工作流程回覆：以上是否正確。";
  const mcpFixture = await installMcpFixture(page, workflowReply);
  await page.getByLabel('Dialogue source', {exact:true}).selectOption('n8n');
  transcriptionText = rawTurns[0];
  const n8nOffset = requests.length;
  await page.getByRole('button', {name:'Send audio',exact:true}).click();
  await page.getByText('Scenario 2 complete',{exact:true}).waitFor({timeout:90000});
  assert.equal(await page.locator('.transcript article:not(.user) p').last().textContent(), workflowReply);
  const boundContext = mcpFixture.calls.at(-1).arguments.context;
  assert.ok(boundContext.current.includes('F15P1H4K-GEX-EF-03'));
  assert.equal(boundContext.user_transcripts.at(-1), boundContext.current);
  assert.ok(boundContext.sessionId);
  assert.ok(mcpFixture.completions.length >= 3);
  await page.getByRole('button',{name:'Hang up',exact:true}).click();
  await page.getByLabel('Dialogue source',{exact:true}).selectOption('prompt.csv');
  transcriptionText = "語音測試";
  await page.getByLabel("ASR hotwords / context").fill("X光機");
  await page.getByLabel("Scenario", { exact: true }).selectOption("audio");
  await page.getByText("No audio selected", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".scenario-preview").count(),
    0,
    "Switching scenarios clears the previous audio selection",
  );
  assert.equal(
    requests.filter((r) => r.path === "/v1/audio/speech" && r.body.stream)
      .length,
    0,
    "Streaming off keeps the existing offline path",
  );
  await page
    .getByRole("switch", { name: "TTS streaming", exact: true })
    .check();
  await page.reload();
  await page.getByRole("button", { name: "Start call", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("switch", { name: "TTS streaming", exact: true })
      .isChecked(),
    true,
  );
  assert.equal(
    await page.getByLabel("ASR hotwords / context").inputValue(),
    "X光機",
  );
  await page.getByRole("switch", { name: "Enable ASR", exact: true }).uncheck();
  const streamOffset = requests.length;
  await page.getByRole("button", { name: "Start call", exact: true }).click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Streaming reply test");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Ready for text", { exact: true }).waitFor();
  const streamed = requests
    .slice(streamOffset)
    .filter((r) => r.path === "/v1/audio/speech" && r.body.stream);
  assert.equal(
    streamed.length,
    2,
    "Uncached greeting and assistant reply stream",
  );
  assert.equal(streamed[1].body.options.text_chunk_size, "80");
  assert.equal(
    await page
      .getByRole("switch", { name: "TTS streaming", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Hang up", exact: true }).click();
  await page
    .getByRole("region", { name: "TTS settings", exact: true })
    .getByLabel("Custom reference voice", { exact: true })
    .setInputFiles({
      name: "stream-ref.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await page
    .getByLabel("Reference transcript", { exact: true })
    .fill("測試參考");
  await page
    .getByRole("region", { name: "TTS settings", exact: true })
    .getByRole("button", { name: "Send", exact: true })
    .click();
  await page
    .getByLabel("Cloned voice test playback", { exact: true })
    .waitFor();
  const cloneStream = requests
    .filter((r) => r.path === "/v1/audio/speech" && r.body.stream)
    .at(-1);
  assert.ok(cloneStream.body.voice_ref);
  assert.equal(cloneStream.body.reference_text, "測試參考");
  longStreamAudio = true;
  await page.getByRole("button", { name: "Start call", exact: true }).click();
  await page.getByText("Speaking · streaming", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Hang up", exact: true }).click();
  await page.getByRole("button", { name: "Start call", exact: true }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "Hangup cancels buffered streaming audio cleanly",
  );
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1584, height: 920 });
  await page.getByRole("switch", { name: "Enable ASR", exact: true }).check();
  await page.getByRole("switch", { name: "Enable VAD", exact: true }).check();
  await page.getByLabel("Speech threshold", { exact: true }).fill("0.7");
  await page.getByLabel("Turn window (ms)", { exact: true }).fill("1000");
  await page.getByRole("switch", { name: "Enable VAD", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Enable LLM", exact: true }).check();
  await page
    .getByLabel("System prompt", { exact: true })
    .fill("保存的系統指令");
  await page.getByRole("switch", { name: "Enable LLM", exact: true }).uncheck();
  await page
    .getByLabel("ASR", { exact: true })
    .selectOption("package:qwen3-asr:qwen3_asr_0_6b_q8_0");
  await page
    .getByLabel("Saved voices", { exact: true })
    .selectOption("preset-wangSG9s");
  await page
    .getByLabel("Call greeting", { exact: true })
    .fill("您好，這是儲存的問候。");
  await page
    .getByLabel("ASR hotwords / context", { exact: true })
    .fill("台積電, X光機");
  await page
    .getByLabel("Clone TTS test", { exact: true })
    .fill("保存的聲音測試");
  await page
    .getByRole("button", { name: "Save model settings", exact: true })
    .click();
  await page
    .getByText("Model settings saved on server", { exact: true })
    .waitFor();
  assert.equal(sharedSettings.vad_enabled, false);
  assert.equal(sharedSettings.llm_enabled, false);
  assert.equal(sharedSettings.vad_threshold, 0.7);
  assert.equal(sharedSettings.vad_window_ms, 1000);
  assert.equal(sharedSettings.tts_voice_id, "preset-wangSG9s");
  assert.equal(sharedSettings.tts_streaming, true);
  assert.equal(sharedSettings.tts_playback_rate, 0.9);
  // A separate browser context has no prior localStorage/session state.
  const freshContext = await browser.newContext({
    viewport: { width: 1584, height: 920 },
  });
  const freshPage = await freshContext.newPage();
  await freshPage.route(/\/(v1|llm)\//, apiRoute);
  await freshPage.goto(
    (process.env.UI_BASE_URL || "http://127.0.0.1:4173/").replace(/\/$/, "") +
      "/#/demo",
  );
  await freshPage
    .getByText("Loaded server model settings", { exact: true })
    .waitFor();
  assert.equal(
    await freshPage
      .getByRole("switch", { name: "Enable VAD", exact: true })
      .isChecked(),
    false,
  );
  assert.equal(
    await freshPage
      .getByRole("switch", { name: "Enable LLM", exact: true })
      .isChecked(),
    false,
  );
  assert.equal(
    await freshPage
      .getByRole("switch", { name: "TTS streaming", exact: true })
      .isChecked(),
    true,
  );
  assert.equal(
    await freshPage.getByLabel("ASR", { exact: true }).inputValue(),
    sharedSettings.asr_model_key,
  );
  assert.equal(
    await freshPage.getByLabel("Saved voices", { exact: true }).inputValue(),
    "preset-wangSG9s",
  );
  assert.equal(
    await freshPage
      .getByLabel("Speech threshold", { exact: true })
      .inputValue(),
    "0.7",
  );
  assert.equal(
    await freshPage
      .getByLabel("Turn window (ms)", { exact: true })
      .inputValue(),
    "1000",
  );
  assert.equal(
    await freshPage.getByLabel("Call greeting", { exact: true }).inputValue(),
    "您好，這是儲存的問候。",
  );
  assert.equal(
    await freshPage
      .getByLabel("ASR hotwords / context", { exact: true })
      .inputValue(),
    "台積電, X光機",
  );
  assert.equal(
    await freshPage.getByLabel("System prompt", { exact: true }).inputValue(),
    "保存的系統指令",
  );
  assert.equal(
    await freshPage.getByLabel("Clone TTS test", { exact: true }).inputValue(),
    "保存的聲音測試",
  );
  longStreamAudio = false;
  await freshPage
    .getByRole("region", { name: "TTS settings", exact: true })
    .getByLabel("Custom reference voice", { exact: true })
    .setInputFiles({
      name: "persisted-reference.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await freshPage
    .getByText("Transcript ready · review before calling", { exact: true })
    .waitFor();
  await freshPage
    .getByRole("button", { name: "Save model settings", exact: true })
    .click();
  await freshPage
    .getByText("Model settings saved on server", { exact: true })
    .waitFor();
  assert.ok(
    sharedVoices.has(sharedSettings.tts_voice_id),
    "settings save persists a new reference voice",
  );
  await freshPage.reload();
  await freshPage
    .getByText("Loaded server model settings", { exact: true })
    .waitFor();
  assert.equal(
    await freshPage.getByLabel("Saved voices", { exact: true }).inputValue(),
    sharedSettings.tts_voice_id,
  );
  assert.equal(
    await freshPage
      .getByLabel("Reference transcript", { exact: true })
      .inputValue(),
    "語音測試",
  );
  const validSettings = sharedSettings;
  sharedSettings = {
    ...validSettings,
    asr_model_key: "registered:restored-asr",
    asr_model_id: "restored-asr",
    asr_model_family: "audio8_asr",
    asr_model_task: "asr",
    asr_model_path: "/app/models/custom-saved-model.gguf",
    asr_load_options: {},
    asr_session_options: {},
  };
  await freshPage.reload();
  await freshPage
    .getByText("Loaded server model settings", { exact: true })
    .waitFor();
  assert.equal(
    await freshPage.getByLabel("ASR", { exact: true }).inputValue(),
    "registered:restored-asr",
    "installed files restore models whose dynamic server registration was lost",
  );

  sharedSettings = {
    ...validSettings,
    asr_model_key: "removed-model",
    asr_model_path: "/missing/model.gguf",
  };
  await freshPage.reload();
  await freshPage.getByText(/ASR model unavailable/).waitFor();
  assert.equal(
    await freshPage.getByLabel("ASR", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await freshPage
      .getByRole("button", { name: "Start call", exact: true })
      .isDisabled(),
    true,
  );
  sharedSettings = { ...validSettings, tts_voice_id: "deleted-voice" };
  await freshPage.reload();
  await freshPage
    .getByText(/Loaded model settings: Saved voice unavailable/)
    .waitFor();
  assert.equal(
    await freshPage
      .getByRole("button", { name: "Start call", exact: true })
      .isDisabled(),
    true,
  );
  await freshContext.close();
  voxAvailable = true;
  sharedSettings = null;
  longStreamAudio = false;
  await page.reload();
  await page.getByRole("button", { name: "Start call", exact: true }).waitFor();
  await page.getByRole("switch", { name: "Enable ASR", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Enable LLM", exact: true }).check();
  await page.getByRole("switch", { name: "Enable TTS", exact: true }).check();
  await page
    .getByLabel("TTS", { exact: true })
    .selectOption("registered:voxcpm-test");
  await page
    .getByLabel("Saved voices", { exact: true })
    .selectOption("preset-lingCLvocals");
  await page
    .getByRole("switch", { name: "TTS streaming", exact: true })
    .check();
  await page.getByLabel("Playback speed", { exact: true }).fill("0.85");
  await page
    .getByRole("button", { name: "Save model settings", exact: true })
    .click();
  await page
    .getByText("Model settings saved on server", { exact: true })
    .waitFor();
  assert.equal(sharedSettings.tts_playback_rate, 0.85);
  await page.reload();
  await page
    .getByText("Loaded server model settings", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Playback speed", { exact: true }).inputValue(),
    "0.85",
  );
  const voxOffset = requests.length;
  replyText = "第一行\n第二行\n第三行\n第四行\n第五行";
  await page.getByRole("button", { name: "Start call", exact: true }).click();
  await page.getByText("Ready for text", { exact: true }).waitFor();
  await page.getByLabel("Message", { exact: true }).fill("Test native streaming");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Ready for text", { exact: true }).waitFor();
  const voxRequests = requests.slice(voxOffset);
  const voxSpeech = voxRequests.filter((r) => r.path === "/v1/audio/speech");
  assert.ok(
    voxSpeech.every(
      (r) => r.body.stream === true && r.body.response_format === "pcm",
    ),
  );
  assert.deepEqual(
    voxSpeech
      .filter((r) => r.body.input.startsWith("第"))
      .map((r) => r.body.input),
    ["第一行\n第二行", "第三行\n第四行", "第五行"],
  );
  assert.ok(
    voxRequests.some(
      (r) =>
        r.path === "/v1/models/load" &&
        r.body.family === "voxcpm1" &&
        r.body.mode === "streaming",
    ),
  );
  await page.getByRole("button", { name: "Hang up", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS VoxCPM1 native PCM streaming, two-line playback and server-saved playback speed",
  );
  console.log(
    "PASS downloaded-model dropdowns, actual LLM IDs, unlinked branding, CSV saves, cached greeting, ASR hotwords, clone recording/transcript, voice/text calls, history, runtime measurements, stage switches/bypasses/manual turns, deduplicated model aliases, LFM download, greeting text/reference isolation, fixed equal-width scenarios panel, audio scenario, three-turn maintenance simulation, distinct technician/assistant voices, CSP-safe preview then explicit send, chat audio players, ordered five-example autoplay, renumbered scenarios 0/1/2, three WAV previews/explicit send/ordered autoplay/highlighting, queue highlighting/cancellation, RTF reporting/persistence, legacy ASR event migration, compact audio chooser, incomplete LLM detection/resume, explicit model loading/readiness before chat, TTS streaming switch/persistence/greeting/reply/clone/cancellation, hotwords CSV persistence/default load, spoken numeral/date/code normalization before LLM and Traditional assistant display/TTS, global model settings across browser contexts, saved draft voice, unavailable model/voice handling, mobile layout",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
