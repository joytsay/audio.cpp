import { a9 as ensure_array_like, a6 as attr_class, e as escape_html, a7 as attr, ad as head } from "../../../chunks/index.js";
import { o as onDestroy, c as catalog, t as tick } from "../../../chunks/asr-context.js";
import * as ToTraditional from "opencc-js/cn2t";
import { M as MediaPreview } from "../../../chunks/MediaPreview.js";
import { h as html, l as logoCloud } from "../../../chunks/app.js";
const systemPromt = "你是現場維修工單語音助理。全程使用繁體中文。每輪只輸出要對維修人員說的內容，不輸出角色標籤（AI：、助理：、維修人員：）、開場白、內部思考或操作說明。\n\n數字與代碼：\n回覆使用阿拉伯數字，禁止把數字轉成中文讀音。設備編號、工單名稱、料號、SN、日期、時間、電容值及數量都依此規則。例如「二零二六年六月二日」整理為「2026年6月2日」，「SN一四七七八七二五」整理為「SN：14778725」，「六四六零MF」整理為「6460MF」。保留代碼的大小寫、前導零、連字號、斜線與底線，字母O不是數字0。術語「五年一維」保持原文。\n辨識中的「臺積電」整理為「台積電」，風扇名稱「FN」整理為「FAN」，「界面FAN」整理為「間面FAN」。只在語意明確時整理，不猜測不清楚的代碼，不用範例補上缺失資料，不把MF換成其他單位。\n\n對話流程：\n1. 回報維修：記住工單名稱與回報時間，逐台複誦設備編號、保養項目、更換品項及數量，不合併不同設備的數量。最後固定說「以上是否正確。」。不能只說已更新或要求使用者自己再確認一遍。\n2. 確認並新增備註：確認上一輪內容，只複誦本輪新增備註。相同料號合併說明筆數，每個SN各自保留對應的製造日期和電容值，不交換、不省略。最後固定說「以上是否正確。」。未指定設備的備註記在工單下，不自行配對。\n3. 確認備註並起機測試正常：回覆「好的，工單：{原工單名稱}，已輸入完成，謝謝。」；使用實際工單名稱，不輸出大括號，不再詢問。\n更正時只更新指定欄位，再複誦更正內容並確認。關鍵欄位不清楚或矛盾才詢問。這是對話模擬，「已輸入完成」是模擬結束話術。\n\n以下是輸入與目標輸出範例；實際資料以當前對話為準。只輸出目標輸出的內容，不輸出範例標題，不繼續編寫下一輪。\n\n【第1輪輸入】\n我要回報工單，2026年6月2日下午14:00台積電F15P1/2_ME VFD備品與維修。\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。\nF15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。\n【第1輪目標輸出】\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。\n\nF15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。\n\n以上是否正確。\n\n【第2輪輸入】\n正確，請幫我備註\n20BD156AOANNANCU\nSN：14778725 製造日期：2010年12月3日 電容值：6460MF\n20BD156AOANNANCU\nSN：14865412 製造日期：2010年12月15日 電容值：6780MF\n【第2輪目標輸出】\n20BD156AOANNANCU有兩個，分別為\n\nSN：14778725 製造日期：2010年12月3日 電容值：6460MF\n\nSN：14865412 製造日期：2010年12月15日 電容值：6780MF\n\n以上是否正確。\n\n【第3輪輸入】\n正確，起機測試正常。\n【第3輪目標輸出】\n好的，工單：F15P1/2_ME VFD備品與維修，已輸入完成，謝謝。\n";
ToTraditional.Converter({ from: "cn", to: "tw" });
const maintenanceScenarioSteps = [
  {
    title: "維修內容回報",
    message: `我要回報工單，2026年6月2日下午14:00台積電F15P1/2_ME VFD備品與維修。
F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。
F15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。`,
    expected: `F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。

F15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。

以上是否正確。`
  },
  {
    title: "確認內容並新增備註",
    message: `正確，請幫我備註
20BD156AOANNANCU
SN：14778725 製造日期：2010年12月3日 電容值：6460MF
20BD156AOANNANCU
SN：14865412 製造日期：2010年12月15日 電容值：6780MF`,
    expected: `20BD156AOANNANCU有兩個，分別為

SN：14778725 製造日期：2010年12月3日 電容值：6460MF

SN：14865412 製造日期：2010年12月15日 電容值：6780MF

以上是否正確。`
  },
  {
    title: "確認備註及起機測試",
    message: "正確，起機測試正常。",
    expected: "好的，工單：F15P1/2_ME VFD備品與維修，已輸入完成，謝謝。"
  }
];
`你是現場維修保養工單的語音回報助理。這是工單回報的對話模擬，不會實際儲存或送出工單；最後的「已輸入完成」僅是模擬話術。
全程用繁體中文，只輸出本輪助理的回覆，不加角色名稱、內部思考、JSON、表格或操作說明。
記住完整對話中的工單、日期時間、設備編號、維修項目、數量與備註。畫面回覆保留原始阿拉伯數字、字母大小寫、前導零、連字號、斜線與底線；朗讀格式由語音流程處理。字母 O 不得變成數字 0，不把 MF 改成其他單位。
第一輪逐台複誦維修項目與各自數量，最後詢問「以上是否正確。」。
使用者確認並新增備註時，只複誦新增備註。相同料號合併說明有兩個，但每個 SN 的製造日期與電容值必須保持原配對。未指定所屬設備時不自行配對。
使用者確認備註並說起機測試正常後，記錄起機結果，依原工單名稱回覆完成話術，不再詢問是否正確。
更正時只更新指定欄位，保留其他內容並重新確認。資訊缺漏或矛盾才詢問，不猜測、不捏造。
範例僅示範格式，實際回覆以使用者當輪提供的資料和對話歷史為準。

${maintenanceScenarioSteps.map((step) => `維修人員：
${step.message}

AI：
${step.expected}`).join("\n\n")}`;
const bundledHotwords = 'context\n"Technical terms: 台積電, 回報工單, VFD備品與維修, F15P1/2_ME VFD備品與維修, F15P1H4K-GEX-EF-03, F15P1H4K-GEX-EF-04, 五年一維, 更換強排FAN 2個, 間面FAN 6個, 間面FAN 4個, FAN, 備註, 料號, 20BD156AOANNANCU, SN 14778725, SN 14865412, 製造日期, 2010年12月3日, 2010年12月15日, 電容值6460MF, 電容值6780MF, 2026年6月2日, 14:00, 正確, 起機測試正常"\n';
function Pipeline($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let referenceTranscriptPlaceholder, cloneRecordingBusy, selectedVadModel, selectedVadIsSilero, selectedTtsModel, selectedTtsIsQwen, selectedTtsSupportsReference, supportsVoiceClone, pipelineSteps, canGenerateReply, canSendAudio, canSendText, canPreviewCloneTts;
    let models = [];
    let vadModel = "silero-vad";
    const sileroVadFields = [
      {
        key: "threshold",
        label: "Speech threshold",
        value: 0.5,
        min: 0.01,
        max: 1,
        step: 0.01,
        help: "Lower values detect quieter speech; higher values reject more noise."
      },
      {
        key: "min_speech_duration_ms",
        label: "Minimum speech (ms)",
        value: 250,
        min: 0,
        max: 1e4,
        step: 1,
        help: "Discard speech segments shorter than this."
      },
      {
        key: "min_silence_duration_ms",
        label: "Minimum silence (ms)",
        value: 100,
        min: 0,
        max: 1e4,
        step: 1,
        help: "Silence required to separate speech segments."
      },
      {
        key: "speech_pad_ms",
        label: "Speech padding (ms)",
        value: 30,
        min: 0,
        max: 5e3,
        step: 1,
        help: "Keep extra audio before and after each speech segment."
      },
      {
        key: "max_speech_duration_s",
        label: "Maximum segment (s)",
        value: 0,
        min: 0,
        max: 3600,
        step: 0.1,
        help: "Split longer segments. Use 0 for unlimited. Microphone turns still stop at 15 seconds."
      },
      {
        key: "neg_threshold",
        label: "Silence threshold",
        value: -1,
        min: -1,
        max: 1,
        step: 0.01,
        help: "End speech below this probability. Use -1 for automatic: speech threshold minus 0.15, at least 0.01."
      },
      {
        key: "min_silence_at_max_speech_ms",
        label: "Silence at maximum segment (ms)",
        value: 98,
        min: 0,
        max: 1e4,
        step: 1,
        help: "Minimum pause used to split a segment at its maximum duration."
      }
    ];
    let sileroVadSettings = Object.fromEntries(sileroVadFields.map((field) => [field.key, field.value]));
    let vadUseLongestSilence = true;
    let llmModel = "";
    let ttsModel = "zipvoice";
    function asrContextFromCsv(csv) {
      const match = csv.replace(/^\uFEFF/, "").match(/^context\r?\n"([\s\S]*)"\r?\n?$/);
      return match ? match[1].replace(/""/g, '"') : null;
    }
    const defaultAsrContext = asrContextFromCsv(bundledHotwords) || "Technical terms: X光機 T5";
    let asrContext = defaultAsrContext;
    let useHotwords = true;
    let turns = [];
    let conversationLog;
    function clearConversation() {
      for (const turn of turns) {
        if (turn.inputAudio) URL.revokeObjectURL(turn.inputAudio);
        if (turn.audio) URL.revokeObjectURL(turn.audio);
      }
      replyPlaying = false;
      turns = [];
      maintenanceScenarioActive = false;
      maintenanceScenarioStep = 0;
      stage = "idle";
      stageRuntimes = {};
      status = "Type a message, choose an example, or record audio to start a new conversation.";
    }
    let systemPrompt = systemPromt.trim();
    let promptMode = "system";
    let maintenanceScenarioActive = false;
    let maintenanceScenarioStep = 0;
    let maintenancePreviewStep = 0;
    let useTts = true;
    let sourceFile = null;
    let textInput = "";
    let cloneVoiceFile = null;
    let cloneReferenceText = "";
    let cloneTtsText = "請問您是希望人工總機協助?轉接中請稍後";
    let cloneTtsPreviewUrl = "";
    let cloneTtsPreviewStatus = "";
    let cloneTtsPreviewBusy = false;
    let cloneTtsPreviewAborter = null;
    let cloneTranscriptStatus = "";
    let cloneTranscribing = false;
    let cloneTranscriptAborter = null;
    let cloneVoiceName = "";
    let savedCloneVoices = [];
    let savedCloneVoiceId = "";
    let cloneRecorder = null;
    let cloneRecordingStream = null;
    let cloneRecording = false;
    let cloneRecordingStarting = false;
    let cloneRecordingSaving = false;
    let cloneRecordingStatus = "";
    let recordingStream = null;
    let microphoneListening = false;
    let microphoneStarting = false;
    let microphoneContext = null;
    let microphoneProcessor = null;
    let microphoneSource = null;
    let microphoneMute = null;
    let microphoneAborter = null;
    let microphoneStatus = "Microphone off";
    let microphoneWaveform = Array(48).fill(2);
    let replyPlaying = false;
    let running = false;
    let stage = "idle";
    let status = "Type a message or choose audio.";
    let stageRuntimes = {};
    let stageStartedAt = 0;
    let runtimeTick = 0;
    function clearCloneTtsPreview() {
      cloneTtsPreviewAborter?.abort();
      cloneTtsPreviewAborter = null;
      if (cloneTtsPreviewUrl) URL.revokeObjectURL(cloneTtsPreviewUrl);
      cloneTtsPreviewUrl = "";
      cloneTtsPreviewStatus = "";
      cloneTtsPreviewBusy = false;
    }
    function invalidateCloneTtsPreview(_file, _text, _ttsText, _model, _base) {
      clearCloneTtsPreview();
    }
    function cancelCloneTranscription() {
      cloneTranscriptAborter?.abort();
      cloneTranscriptAborter = null;
      cloneTranscribing = false;
      cloneTranscriptStatus = "";
    }
    function cancelCloneRecording() {
      if (cloneRecorder) {
        cloneRecorder.ondataavailable = null;
        cloneRecorder.onstop = null;
        cloneRecorder.onerror = null;
        if (cloneRecorder.state !== "inactive") cloneRecorder.stop();
      }
      cloneRecordingStream?.getTracks().forEach((track) => track.stop());
      cloneRecorder = null;
      cloneRecordingStream = null;
      cloneRecording = false;
      cloneRecordingStarting = false;
      cloneRecordingSaving = false;
      cloneRecordingStatus = "";
    }
    function stopMicrophone() {
      microphoneListening = false;
      microphoneStarting = false;
      microphoneAborter?.abort();
      microphoneAborter = null;
      if (microphoneProcessor) microphoneProcessor.onaudioprocess = null;
      microphoneProcessor?.disconnect();
      microphoneSource?.disconnect();
      microphoneMute?.disconnect();
      recordingStream?.getTracks().forEach((track) => track.stop());
      recordingStream = null;
      if (microphoneContext) void microphoneContext.close();
      microphoneContext = null;
      microphoneProcessor = null;
      microphoneSource = null;
      microphoneMute = null;
      microphoneWaveform = Array(48).fill(2);
      microphoneStatus = "Microphone off";
    }
    function stageRuntime(stageName, tick2) {
      const completed = stageRuntimes[stageName];
      if (completed !== void 0) return completed;
      return stage === stageName && stageStartedAt ? tick2 - stageStartedAt : void 0;
    }
    function formatStageRuntime(milliseconds) {
      const seconds = Math.max(0, milliseconds) / 1e3;
      if (seconds < 60) return `${seconds.toFixed(1)}s`;
      return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
    }
    onDestroy(() => {
      clearCloneTtsPreview();
      cancelCloneTranscription();
      cancelCloneRecording();
      stopMicrophone();
      clearConversation();
    });
    if (turns.length && conversationLog) {
      tick().then(() => {
      });
    }
    referenceTranscriptPlaceholder = systemPrompt.split(/\r?\n/)[0]?.trim() || systemPromt.split(/\r?\n/)[0].trim();
    cloneRecordingBusy = cloneRecording || cloneRecordingStarting || cloneRecordingSaving;
    selectedVadModel = models.find((entry) => entry.selectionId === vadModel);
    selectedVadIsSilero = selectedVadModel?.family === "silero_vad" || /^silero[-_]vad(?:[-_]|$)/i.test(selectedVadModel?.modelId || vadModel);
    (catalog.find((entry) => entry.id === selectedVadModel?.modelId)?.display_name || selectedVadModel?.label || "Selected VAD").replace(/\s*\([^)]*\)$/, "");
    models.filter((entry) => ["asr", "stt"].includes(entry.task || ""));
    models.filter((entry) => ["tts", "clon"].includes(entry.task || ""));
    selectedTtsModel = models.find((entry) => entry.selectionId === ttsModel);
    selectedTtsIsQwen = selectedTtsModel?.family === "qwen3_tts" || /^qwen3[-_]tts(?:[-_]|$)/i.test(selectedTtsModel?.modelId || "");
    selectedTtsSupportsReference = ["voxcpm1", "audio8_tts"].includes(selectedTtsModel?.family || "");
    supportsVoiceClone = selectedTtsModel?.task === "clon" || selectedTtsSupportsReference || selectedTtsIsQwen && !/custom/i.test(selectedTtsModel?.modelId || "");
    pipelineSteps = [
      ...[],
      ...[["stt", "Speech to text"]],
      ...[],
      ...[["llm", "Language model"]],
      ...[["tts", "Text to speech"]]
    ];
    canGenerateReply = Boolean(!cloneTranscribing && !cloneTtsPreviewBusy && llmModel);
    canSendAudio = Boolean(!cloneRecordingBusy && sourceFile);
    canSendText = Boolean(!cloneRecordingBusy && textInput.trim() && canGenerateReply);
    canPreviewCloneTts = Boolean(cloneVoiceFile);
    invalidateCloneTtsPreview();
    $$renderer2.push(`<section class="page-head pipeline-head"><p class="eyebrow">CASCADED PIPELINE</p> <h1>Voice Assistant</h1> <p>A complete system built from separate models: VAD → ASR → LLM + RAG → TTS.</p></section> <section class="pipeline-steps" aria-label="Pipeline progress"><!--[-->`);
    const each_array = ensure_array_like(
      // `/v1/models` from an already-running server can be an older, minimal
      // response with just an ID.  Fill in the known catalog metadata so
      // controls such as Qwen3-TTS voice cloning render on the first load.
      /* configured-only servers do not expose package management */
      // Prefer the bundled Silero entry over the same model already loaded by
      // the server, whose path may be absent or absolute in /v1/models.
      // Prefer the operator's standard reference voice on a fresh Pipeline
      // session, while preserving any voice file or saved voice already chosen.
      // A silent VAD window ends the turn; cap uninterrupted speech at 15 seconds.
      // Activate audio during the button gesture, before the permission prompt.
      // Draw measured microphone energy, rather than a decorative animation.
      // Check actual playback so a missed media event cannot leave VAD paused.
      // VAD runs on the 16 kHz upload. AudioContext may decode that WAV at
      // the device rate (often 48 kHz), while /tasks/run can omit sample_rate.
      // Join speech spans rather than leaving long silent holes between them.
      // Some ASR models stop early after a sufficiently long silent region.
      // Typed text is unchanged; ASR uses Traditional Chinese for display, retrieval and history.
      // Jetson uses unified memory. Release the LLM worker before the TTS
      // worker creates its CUDA/cuBLAS context for this sequential pipeline.
      /* TTS can still proceed if this llama.cpp version cannot unload */
      // Preserve the user message when the LLM is bypassed.
      /* use defaults */
      pipelineSteps
    );
    for (let index = 0, $$length = each_array.length; index < $$length; index++) {
      let item = each_array[index];
      const elapsed = stageRuntime(item[0], runtimeTick);
      $$renderer2.push(`<div${attr_class("", void 0, {
        "active": stage === item[0],
        "complete": stage === "done" || pipelineSteps.findIndex((entry) => entry[0] === stage) > index
      })}><span>${escape_html(index + 1)}</span> <div><strong>${escape_html(item[1])}</strong> `);
      if (elapsed !== void 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<small>${escape_html(formatStageRuntime(elapsed))}</small>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--></section> <div class="pipeline-grid conversation-grid"><section class="panel page-panel pipeline-config"><div class="section-title"><div><span>SETTINGS</span><h2>Pipeline</h2></div></div> <fieldset class="pipeline-settings-fields"${attr("disabled", running, true)}><p class="field-help">VAD</p> `);
    if (selectedVadIsSilero) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<details><summary>VAD settings</summary> <p class="field-help">Used for continuous microphone detection and speech cropping before ASR. Microphone detection checks roughly one second of audio at a time; these durations control segments within each check.</p> <div class="field-grid compact-fields"><!--[-->`);
      const each_array_1 = ensure_array_like(sileroVadFields);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let field = each_array_1[$$index_1];
        $$renderer2.push(`<label>${escape_html(field.label)} <input type="number"${attr("min", field.min)}${attr("max", field.max)}${attr("step", field.step)}${attr("value", sileroVadSettings[field.key])}/> <small class="field-help">${escape_html(field.help)}</small></label>`);
      }
      $$renderer2.push(`<!--]--></div> <label><input type="checkbox"${attr("checked", vadUseLongestSilence, true)}/>Split at the longest pause when maximum segment duration is reached</label> <button type="button">Reset VAD defaults</button></details>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <label class="toggle pipeline-toggle"><input type="checkbox" role="switch"${attr("checked", useHotwords, true)}/><span aria-hidden="true"></span>ASR hotwords</label> <label>Context prompt (hotwords)<textarea rows="2" placeholder="Terminology or names to recognize">`);
    const $$body = escape_html(asrContext);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></label> <div class="prompt-actions"><button>Save CSV</button></div> `);
    if (supportsVoiceClone) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="pipeline-clone-voice"><div class="section-title"><div><span>VOICE CLONE</span><h2>Reference voice</h2></div></div> <input hidden="" class="hidden-file" type="file" accept="audio/*"/> <div class="audio-drop"><div class="pipeline-audio-choice"><div><strong>${escape_html("No reference audio selected")}</strong><small>WAV, MP3, or FLAC</small></div> <button type="button"${attr("disabled", cloneRecordingBusy, true)}>Choose audio</button></div></div> <div class="media-actions reference-recording-actions svelte-8wg1k"><button type="button"${attr_class("microphone-toggle svelte-8wg1k", void 0, { "danger": cloneRecording || cloneRecordingStarting })}${attr("aria-label", cloneRecording ? "Stop recording reference voice" : "Record reference voice")}${attr("title", cloneRecording ? "Stop recording reference voice" : "Record reference voice")}${attr("aria-pressed", cloneRecording || cloneRecordingStarting)}${attr("disabled", !cloneRecording && cloneRecordingBusy, true)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"></path></svg></button> `);
      if (cloneRecordingBusy) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button type="button">Cancel recording</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button type="button"${attr("disabled", !cloneVoiceFile, true)}>Clear</button> <span>${escape_html(cloneRecording ? "Recording reference voice…" : "Record reference voice")}</span></div> `);
      if (cloneRecordingStatus) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="field-help" role="status">${escape_html(cloneRecordingStatus)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <label>Reference transcript<textarea rows="2"${attr("placeholder", referenceTranscriptPlaceholder)}>`);
      const $$body_1 = escape_html(cloneReferenceText);
      if ($$body_1) {
        $$renderer2.push(`${$$body_1}`);
      }
      $$renderer2.push(`</textarea></label> `);
      if (cloneTranscriptStatus) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="field-help" role="status">${escape_html(cloneTranscriptStatus)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="voice-library pipeline-voice-library"><label>Saved voices <span>Shared on server</span>`);
      $$renderer2.select({ value: savedCloneVoiceId, disabled: cloneRecordingBusy }, ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Choose saved voice…`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_2 = ensure_array_like(savedCloneVoices);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let item = each_array_2[$$index_2];
          $$renderer3.option({ value: item.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(item.name)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      });
      $$renderer2.push(`</label> <label>Voice name<input${attr("value", cloneVoiceName)} placeholder="Reference voice name"/></label> <div class="library-actions"><button type="button"${attr("disabled", !cloneVoiceFile, true)}>${escape_html("Save voice")}</button> <button class="danger" type="button"${attr("disabled", !savedCloneVoiceId, true)}>Delete</button></div></div> <div class="reference-playback svelte-8wg1k">`);
      MediaPreview($$renderer2, {
        file: cloneVoiceFile,
        kind: "audio",
        label: "Reference audio"
      });
      $$renderer2.push(`<!----> <label>TTS transcript<textarea rows="3">`);
      const $$body_2 = escape_html(cloneTtsText);
      if ($$body_2) {
        $$renderer2.push(`${$$body_2}`);
      }
      $$renderer2.push(`</textarea></label> <div class="library-actions reference-tts-actions svelte-8wg1k"><button class="primary" type="button"${attr("disabled", !canPreviewCloneTts || cloneTtsPreviewBusy, true)}>${escape_html(cloneTtsPreviewBusy ? "Generating TTS…" : "Play TTS")}</button> `);
      if (cloneTtsPreviewBusy) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button type="button">Cancel</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (cloneTtsPreviewStatus) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="field-help" role="status">${escape_html(cloneTtsPreviewStatus)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (cloneTtsPreviewUrl) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<label for="clone-tts-preview">TTS result</label> <audio id="clone-tts-preview" controls=""${attr("src", cloneTtsPreviewUrl)} class="svelte-8wg1k"></audio>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="pipeline-input"><div class="section-title"><div><span>INPUT</span><h2>Instructions</h2></div></div> <label>LLM Knowledge Base`);
    $$renderer2.select({ value: promptMode, disabled: maintenanceScenarioActive }, ($$renderer3) => {
      $$renderer3.option({ value: "system" }, ($$renderer4) => {
        $$renderer4.push(`System prompt (prompt.csv)`);
      });
      $$renderer3.option({ value: "rag" }, ($$renderer4) => {
        $$renderer4.push(`Regular RAG (hybrid retrieval)`);
      });
      $$renderer3.option({ value: "graphrag" }, ($$renderer4) => {
        $$renderer4.push(`GraphRAG (knowledge graph)`);
      });
    });
    $$renderer2.push(`</label> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<label>System prompt (prompt.csv)<textarea rows="6">`);
      const $$body_3 = escape_html(systemPrompt);
      if ($$body_3) {
        $$renderer2.push(`${$$body_3}`);
      }
      $$renderer2.push(`</textarea></label> <div class="prompt-actions"><button>Save CSV</button></div>`);
    }
    $$renderer2.push(`<!--]--></div></fieldset></section> <section class="panel page-panel pipeline-results conversation-panel"><div class="section-title"><div><span>CHATBOT</span><h2>Conversation</h2></div><button${attr("disabled", !turns.length, true)}>New conversation</button></div> <details class="maintenance-scenario svelte-8wg1k"${attr("open", maintenanceScenarioActive, true)}><summary class="svelte-8wg1k">情境 2：現場維修保養後的語音回報</summary> <p class="field-help">三輪對話模擬：維修回報 → 備註確認 → 起機測試。使用實際 LLM 回覆，不會寫入工單系統。</p> <button${attr("disabled", microphoneListening || microphoneStarting || cloneRecordingBusy, true)} class="svelte-8wg1k">${escape_html(maintenanceScenarioActive ? "重新開始文字模擬" : "開始文字模擬")}</button> `);
    if (maintenanceScenarioActive) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<label class="scenario-voice-toggle svelte-8wg1k"><input type="checkbox"${attr("checked", useTts, true)}${attr("disabled", running, true)} class="svelte-8wg1k"/>播放 AI 語音</label> <button${attr("disabled", microphoneListening || microphoneStarting, true)} class="svelte-8wg1k">離開情境</button> <p role="status">${escape_html(maintenanceScenarioStep >= maintenanceScenarioSteps.length ? "三輪測試訊息已送出，請核對 AI 回覆。" : `第 ${maintenanceScenarioStep + 1} / 3 輪：${maintenanceScenarioSteps[maintenanceScenarioStep].title}`)}</p> <p class="field-help">按 Send text 測試本輪，完成後填入下一輪。也可以依腳本錄音或上傳音檔測試 ASR，並手動選擇下一輪腳本。文字模擬預設不播放語音；勾選「播放 AI 語音」即可聆聽 AI 回覆。</p> <label for="maintenance-script">對話腳本</label> `);
      $$renderer2.select(
        {
          id: "maintenance-script",
          value: maintenancePreviewStep,
          disabled: running
        },
        ($$renderer3) => {
          $$renderer3.push(`<!--[-->`);
          const each_array_3 = ensure_array_like(maintenanceScenarioSteps);
          for (let index = 0, $$length = each_array_3.length; index < $$length; index++) {
            let step = each_array_3[index];
            $$renderer3.option({ value: index }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(index + 1)}. ${escape_html(step.title)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(` <pre class="svelte-8wg1k">${escape_html(maintenanceScenarioSteps[maintenancePreviewStep].message)}</pre> <details><summary>預期確認內容</summary><pre class="svelte-8wg1k">${escape_html(maintenanceScenarioSteps[maintenancePreviewStep].expected)}</pre></details> <button${attr("disabled", maintenanceScenarioStep >= maintenanceScenarioSteps.length, true)} class="svelte-8wg1k">填入本輪測試文字</button> <button${attr("disabled", running, true)} class="svelte-8wg1k">填入所選腳本</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></details> <div class="conversation-turns" role="log" aria-label="Voice conversation">`);
    const each_array_4 = ensure_array_like(turns);
    if (each_array_4.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let index = 0, $$length = each_array_4.length; index < $$length; index++) {
        let turn = each_array_4[index];
        $$renderer2.push(`<div class="conversation-turn"><article class="pipeline-message user"><span>YOU · TURN ${escape_html(index + 1)}</span><p>${escape_html(turn.name)}</p> `);
        if (turn.inputAudio) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<audio controls=""${attr("src", turn.inputAudio)}></audio>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (turn.transcript) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p>${escape_html(turn.transcript)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></article> `);
        if (turn.reply || turn.audio) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<article class="pipeline-message assistant"><span>ASSISTANT</span><p>${escape_html(turn.reply)}</p> `);
          if (turn.audio) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="pipeline-audio"><audio controls=""${attr("src", turn.audio)}></audio><a${attr("href", turn.audio)}${attr("download", `voice-response-${index + 1}.wav`)}>Save WAV</a></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></article>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <p${attr_class("field-help", void 0, { "turn-error": turn.state === "failed" })}>${escape_html(turn.status)}</p> <details class="turn-details"><summary>Pipeline details</summary> `);
        if (turn.vad) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<article class="pipeline-message diarization"><span>VAD</span><p>${escape_html(turn.vad)}</p></article>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (turn.rag) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<article class="pipeline-message diarization"><span>RAG</span><p>${escape_html(turn.rag)}</p></article>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (turn.sources.length) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="rag-citations"><strong>Sources</strong><!--[-->`);
          const each_array_5 = ensure_array_like(turn.sources);
          for (let $$index_4 = 0, $$length2 = each_array_5.length; $$index_4 < $$length2; $$index_4++) {
            let citation = each_array_5[$$index_4];
            $$renderer2.push(`<code>${escape_html(citation)}</code>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (turn.llmInput) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<label class="llm-input-preview">LLM input<textarea readonly="" rows="8">`);
          const $$body_4 = escape_html(turn.llmInput);
          if ($$body_4) {
            $$renderer2.push(`${$$body_4}`);
          }
          $$renderer2.push(`</textarea></label>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <!--[-->`);
        const each_array_6 = ensure_array_like(Object.entries(turn.runtimes));
        for (let $$index_5 = 0, $$length2 = each_array_6.length; $$index_5 < $$length2; $$index_5++) {
          let [name, elapsed] = each_array_6[$$index_5];
          $$renderer2.push(`<p class="field-help">${escape_html(name.toUpperCase())}: ${escape_html(formatStageRuntime(elapsed))}</p>`);
        }
        $$renderer2.push(`<!--]--></details></div>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div class="empty-output"><div class="wave">∿</div><p>Type a message, choose an example, upload audio, or record a message to start a conversation.</p></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="conversation-composer"><label for="pipeline-message">Message</label> <div${attr_class("message-box", void 0, { "listening": microphoneListening })}><div class="message-box-input"><textarea id="pipeline-message" class="chat-text-input" rows="3"${attr("disabled", cloneRecordingBusy, true)} placeholder="Type a message… (Ctrl+Enter to send)">`);
    const $$body_5 = escape_html(textInput);
    if ($$body_5) {
      $$renderer2.push(`${$$body_5}`);
    }
    $$renderer2.push(`</textarea> <div class="composer-actions"><button${attr_class("microphone-toggle", void 0, { "danger": microphoneListening || microphoneStarting })}${attr("aria-label", microphoneListening || microphoneStarting ? "Stop listening" : "Start listening")}${attr("title", microphoneListening || microphoneStarting ? "Stop continuous microphone" : "Start continuous microphone")}${attr("aria-pressed", microphoneListening || microphoneStarting)}${attr("disabled", !(microphoneListening || microphoneStarting) && (cloneRecordingBusy || cloneTtsPreviewBusy || running || false || !vadModel), true)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"></path></svg></button> <button class="primary send-text"${attr("disabled", !canSendText, true)}>Send text</button></div></div> <div class="composer-feedback"><span role="status">${escape_html(microphoneStatus)}</span> `);
    if (microphoneListening || microphoneStarting) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<svg${attr_class("microphone-waveform", void 0, { "paused": replyPlaying })} viewBox="0 0 192 40" role="img"${attr("aria-label", replyPlaying ? "Microphone listening paused" : "Live microphone waveform")}><!--[-->`);
      const each_array_7 = ensure_array_like(microphoneWaveform);
      for (let index = 0, $$length = each_array_7.length; index < $$length; index++) {
        let height = each_array_7[index];
        $$renderer2.push(`<rect${attr("x", index * 4)}${attr("y", (40 - height) / 2)} width="2"${attr("height", height)} rx="1"></rect>`);
      }
      $$renderer2.push(`<!--]--></svg>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<small>Ctrl+Enter to send · Enter for a new line</small>`);
    }
    $$renderer2.push(`<!--]--></div></div> <input hidden="" type="file" accept="audio/*"/> <div class="audio-drop"><div class="pipeline-audio-choice"><div><strong>${escape_html("No audio selected")}</strong><small>WAV, MP3, or FLAC</small></div> <button${attr("disabled", running, true)}>Choose audio</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="page-runbar pipeline-audio-runbar"><span${attr_class("", void 0, { "busy": running })}>${escape_html(status)}</span> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="primary"${attr("disabled", !canSendAudio, true)}>${escape_html("Send audio")}</button></div></div> `);
    if (selectedTtsModel?.family === "zipvoice" && !cloneVoiceFile) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="field-help">Choose reference audio and enter its matching transcript to enable ZipVoice cloning.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("wwq1hr", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Voice Assistant · GeoVision IVR</title>`);
      });
    });
    $$renderer2.push(`<header class="topbar"><div class="brand"><div class="brand-logo">${html(logoCloud)}</div><div><strong>GeoVision IVR</strong><span>Interactive Voice Response</span></div></div></header> <main>`);
    Pipeline($$renderer2);
    $$renderer2.push(`<!----></main>`);
  });
}
export {
  _page as default
};
