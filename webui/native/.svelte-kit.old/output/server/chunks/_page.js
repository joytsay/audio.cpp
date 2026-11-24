import { a4 as fallback, a5 as bind_props, a6 as attr_class, a7 as attr, g as getContext, a8 as attributes, a9 as ensure_array_like, aa as element, a3 as derived, ab as to_array, ac as spread_props, ad as head, ae as attr_style, e as escape_html } from "./index.js";
import { o as onDestroy, m as modelModes, a as modelCapabilities } from "./asr-context.js";
import { h as html, l as logoCloud } from "./app.js";
import "clsx";
function SipSidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let onsettings = fallback($$props["onsettings"], () => {
    });
    let onstatus = fallback($$props["onstatus"], () => {
    });
    let browserBusy = fallback($$props["browserBusy"], false);
    $$renderer2.push(`<div class="sip-content svelte-1vouyy3">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="muted svelte-1vouyy3">Loading SIP settings…</p>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { onsettings, onstatus, browserBusy });
  });
}
function PanelDivider($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let label = $$props["label"];
    let value = $$props["value"];
    let min = $$props["min"];
    let max = $$props["max"];
    let orientation = fallback($$props["orientation"], "vertical");
    let reverse = fallback($$props["reverse"], false);
    let percent = fallback($$props["percent"], false);
    let oncommit = fallback($$props["oncommit"], () => {
    });
    let dragging = false;
    $$renderer2.push(`<div${attr_class("divider svelte-dks4gg", void 0, {
      "horizontal": orientation === "horizontal",
      "dragging": dragging
    })} role="separator"${attr("aria-label", label)}${attr("aria-orientation", orientation)}${attr("aria-valuemin", min)}${attr("aria-valuemax", max)}${attr("aria-valuenow", value)} tabindex="0"></div>`);
    bind_props($$props, {
      label,
      value,
      min,
      max,
      orientation,
      reverse,
      percent,
      oncommit
    });
  });
}
function rtfLabel(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value.toFixed(4) : "—";
}
const defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};
const mergeClasses = (...classes) => classes.filter((className, index, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();
function isDefined(value) {
  return value !== null && value !== void 0;
}
function buildLucideIconNode(icon, params = {}) {
  const attributeNames = params.attributeNames ?? {};
  const getAttributeName = (attributeName) => attributeNames[attributeName] ?? attributeName;
  const viewBoxWidth = icon.size ?? icon.width ?? defaultAttributes["width"];
  const viewBoxHeight = icon.size ?? icon.height ?? defaultAttributes["height"];
  const aliasClassNames = icon.aliases?.filter((alias) => typeof alias === "string" && alias.trim() !== "").map((alias) => `lucide-${alias}`) ?? [];
  const iconClassNames = [...icon.name ? [`lucide-${icon.name}`] : [], ...aliasClassNames];
  const classNamesFromClassName = params.className?.split(" ").filter(Boolean) ?? [];
  const className = params.includeDefaultClasses === false ? mergeClasses(...classNamesFromClassName) : mergeClasses("lucide", ...iconClassNames, ...classNamesFromClassName);
  const calculatedStrokeWidth = params.absoluteStrokeWidth ? Number(params.strokeWidth ?? defaultAttributes["stroke-width"]) * Number(icon.size ?? icon.width ?? defaultAttributes["width"]) / Number(params.size ?? params.width ?? defaultAttributes["width"]) : params.strokeWidth ?? defaultAttributes["stroke-width"];
  const attributes2 = {
    ...Object.entries(defaultAttributes).reduce((attrs, [attrName, value]) => {
      attrs[getAttributeName(attrName)] = value;
      return attrs;
    }, {}),
    ..."color" in params && params.color && {
      [getAttributeName("stroke")]: params.color
    },
    ..."size" in params && isDefined(params.size) && {
      [getAttributeName("width")]: params.size,
      [getAttributeName("height")]: params.size
    },
    ..."width" in params && isDefined(params.width) && {
      [getAttributeName("width")]: params.width
    },
    ..."height" in params && isDefined(params.height) && {
      [getAttributeName("height")]: params.height
    },
    [getAttributeName("stroke-width")]: calculatedStrokeWidth,
    ...className && {
      [getAttributeName("class")]: className
    },
    [getAttributeName("viewBox")]: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
    ...params.hasA11yProp === false ? {
      [getAttributeName("aria-hidden")]: "true"
    } : {},
    ..."attributes" in params && params.attributes
  };
  return [
    "svg",
    attributes2,
    icon.node.map((child) => {
      const [name, attrs, children] = child;
      const nextAttrs = params.nonScalingStroke ? { [getAttributeName("vector-effect")]: "non-scaling-stroke", ...attrs } : attrs;
      return children ? [name, nextAttrs, children] : [name, nextAttrs];
    })
  ];
}
const hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
  return false;
};
const LucideContext = /* @__PURE__ */ Symbol("lucide-context");
const getLucideContext = () => getContext(LucideContext);
function Icon($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const globalProps = getLucideContext() ?? {};
    const {
      color = globalProps.color ?? "currentColor",
      size = globalProps.size ?? 24,
      width = size,
      height = size,
      strokeWidth = globalProps.strokeWidth ?? 2,
      absoluteStrokeWidth = globalProps.absoluteStrokeWidth ?? false,
      nonScalingStroke = globalProps.nonScalingStroke ?? false,
      iconNode = [],
      icon = { node: iconNode, aliases: [], size: 24 },
      class: propsClass,
      children,
      $$slots,
      $$events,
      ...props
    } = $$props;
    const hasAccessibleProp = derived(() => Boolean(children) || hasA11yProp(props));
    const $$d = derived(() => buildLucideIconNode(icon, {
      color,
      width,
      height,
      strokeWidth,
      absoluteStrokeWidth,
      nonScalingStroke,
      // @TODO: maybe drop the extra `lucide-icon` class altogether.
      className: mergeClasses("lucide-icon", globalProps.class),
      hasA11yProp: hasAccessibleProp(),
      attributes: props
    })), $$derived_array = derived(() => to_array($$d(), 3)), svgAttributes = derived(() => $$derived_array()[1]), builtIconNode = derived(() => fallback($$derived_array()[2], () => [], true));
    const iconAttributes = derived(() => ({
      ...svgAttributes(),
      class: [...svgAttributes().class.split(" "), propsClass]
    }));
    $$renderer2.push(`<svg${attributes({ ...iconAttributes() }, void 0, void 0, void 0, 3)}><!--[-->`);
    const each_array = ensure_array_like(builtIconNode());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [tag, attrs] = each_array[$$index];
      element($$renderer2, tag, () => {
        $$renderer2.push(`${attributes({ ...attrs }, void 0, void 0, void 0, 3)}`);
      });
    }
    $$renderer2.push(`<!--]-->`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></svg>`);
  });
}
function Activity($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "activity",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
        }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function List_music($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "list-music",
    "size": 24,
    "node": [
      ["path", { "d": "M16 5H3" }],
      ["path", { "d": "M11 12H3" }],
      ["path", { "d": "M11 19H3" }],
      ["path", { "d": "M21 16V5" }],
      ["circle", { "cx": "18", "cy": "16", "r": "3" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Mic($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "mic",
    "size": 24,
    "node": [
      ["path", { "d": "M12 19v3" }],
      ["path", { "d": "M19 10v2a7 7 0 0 1-14 0v-2" }],
      [
        "rect",
        { "x": "9", "y": "2", "width": "6", "height": "13", "rx": "3" }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Panel_left_close($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "panel-left-close",
    "size": 24,
    "node": [
      [
        "rect",
        { "width": "18", "height": "18", "x": "3", "y": "3", "rx": "2" }
      ],
      ["path", { "d": "M9 3v18" }],
      ["path", { "d": "m16 15-3-3 3-3" }]
    ],
    "aliases": ["sidebar-close"]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Phone_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "phone-off",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272"
        }
      ],
      ["path", { "d": "M22 2 2 22" }],
      [
        "path",
        {
          "d": "M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473"
        }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Phone($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "phone",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"
        }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Radio($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "radio",
    "size": 24,
    "node": [
      ["path", { "d": "M16.247 7.761a6 6 0 0 1 0 8.478" }],
      ["path", { "d": "M19.075 4.933a10 10 0 0 1 0 14.134" }],
      ["path", { "d": "M4.925 19.067a10 10 0 0 1 0-14.134" }],
      ["path", { "d": "M7.753 16.239a6 6 0 0 1 0-8.478" }],
      ["circle", { "cx": "12", "cy": "12", "r": "2" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Satellite($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "satellite",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5"
        }
      ],
      ["path", { "d": "M16.5 7.5 19 5" }],
      [
        "path",
        {
          "d": "m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5"
        }
      ],
      ["path", { "d": "M9 21a6 6 0 0 0-6-6" }],
      [
        "path",
        {
          "d": "M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z"
        }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Send($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "send",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
        }
      ],
      ["path", { "d": "m21.854 2.147-10.94 10.939" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Trash($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "trash",
    "size": 24,
    "node": [
      ["path", { "d": "M10 11v6" }],
      ["path", { "d": "M14 11v6" }],
      ["path", { "d": "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
      ["path", { "d": "M3 6h18" }],
      ["path", { "d": "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
    ],
    "aliases": ["trash-2"]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let displayMessages, sipOnline, sipConnected, sipCanSend, selectedAsr, selectedVad, selectedLlm, llmNeedsDownload, selectedTts, protectedVoice, canCall, sipStatus, vadModels, asrModels, ttsModels, ttsSupportsStreaming, streamingTts, customSavedVoices, voiceChoices, builtinReference, supportsReference, requiresReferenceText;
    let settingsLoading = true;
    let visiblePanels = {
      settings: true,
      events: true,
      scenarios: true
    };
    let sipWidth = 280;
    let detailsWidth = 225;
    let bottomHeight = 320;
    let eventsShare = 50;
    let waveHeight = 124;
    let composerHeight = 136;
    let viewportHeight = 900;
    function savePanelLayout() {
      try {
        localStorage.setItem("geovision.demo.panel-layout", JSON.stringify({
          detailsWidth,
          sipWidth,
          bottomHeight,
          eventsShare,
          waveHeight,
          composerHeight
        }));
      } catch {
      }
    }
    let sidebarWidth = 290;
    let resizingSidebar = false;
    let chatAudioElements = {};
    const audioUrls = /* @__PURE__ */ new Set();
    function releaseChatAudio() {
      Object.values(chatAudioElements).forEach((element2) => element2?.pause());
      for (const url of audioUrls) URL.revokeObjectURL(url);
      audioUrls.clear();
      chatAudioElements = {};
    }
    let scenarioMode = "add-scenario";
    let knowledgeScenarios = [];
    let newScenarioFiles = [];
    let knowledgeUploading = false;
    let knowledgeDeleting = false;
    let knowledgeStatus = "";
    let scenarioStatus = "";
    let scenarioRunning = false;
    let events = [];
    let messages = [];
    let useSip = false;
    let sipSettings = null;
    let sipLive = { live: false, status: null };
    let sipInstance = "";
    let sipEventId = 0;
    function receiveSipSettings(value) {
      sipSettings = value;
      if (value.enabled && !useSip && (connected || starting)) hangup(false);
      useSip = value.enabled;
    }
    function receiveSipStatus(value) {
      sipLive = value;
      const snapshot = value.status;
      if (!snapshot || !useSip) return;
      if (sipInstance !== snapshot.instance) {
        sipInstance = snapshot.instance;
        sipEventId = 0;
      }
      const fresh = snapshot.events.filter((event) => event.id > sipEventId);
      if (fresh.length) {
        sipEventId = Math.max(...fresh.map((event) => event.id));
        events = [
          ...fresh.map((event) => ({
            time: new Date(event.time).toISOString(),
            run: event.run,
            type: event.type,
            summary: event.summary
          })).reverse(),
          ...events
        ].slice(0, 300);
        try {
          localStorage.setItem(historyKey, JSON.stringify(events));
        } catch {
        }
      }
    }
    function sipBars(values) {
      const samples = values || [];
      return [
        ...Array(Math.max(0, 36 - samples.length)).fill(2),
        ...samples.slice(-36).map((value) => Math.max(2, Math.min(70, Math.sqrt(Math.max(0, value)) * 70)))
      ];
    }
    let connected = false;
    let starting = false;
    let muted = false;
    let busy = false;
    let status = "Ready to connect";
    let input = "";
    let run = "";
    let audioModels = [];
    let llmModels = [];
    let vadKey = "";
    let asrKey = "";
    let ttsKey = "";
    let llm = "";
    let useVad = true;
    let useAsr = true;
    let useLlm = true;
    let useTts = true;
    let llmDownloading = false;
    let llmDownloadTimer;
    let llmDownloadEvents = null;
    let discovering = false;
    function stopLlmDownloadWatch() {
      clearTimeout(llmDownloadTimer);
      llmDownloadEvents?.close();
      llmDownloadEvents = null;
    }
    let dialogueSource = "prompt.csv";
    let savingDialogueSource = false;
    let prompt = "你是現場維修保養的語音助理。請用繁體中文簡短回答，準確保留工單、設備代碼及數字。";
    let threshold = 0.5;
    let windowMs = 650;
    let endSilenceMs = 2e3;
    let voiceFile = null;
    let hotwords = "";
    let savingHotwords = false;
    let lookupNoticeDelaySeconds = 3;
    let ttsStreaming = false;
    let ttsPlaybackRate = 0.9;
    let greeting = "您好，這裡是 GeoVision IVR，請問需要什麼協助？";
    let savingPrompt = false;
    let fileStatus = "";
    let greetingStatus = "";
    let greetingTimer;
    let cloneRecording = false;
    let cloneBusy = false;
    let savedVoices = [];
    let savedVoiceId = "preset-lingCLvocals";
    let voiceName = "";
    const protectedVoices = ["lingCLvocals", "wangSG9s"];
    let referencePreviewUrl = "";
    function updateReferencePreview(file, builtin) {
      if (referencePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(referencePreviewUrl);
      referencePreviewUrl = `/v1/ui/voice-preview?voice=${encodeURIComponent(builtin)}`;
    }
    let cloneTestText = "這裡是複製聲音TTS的測試";
    let cloneTestUrl = "";
    function clearCloneTest() {
      if (cloneTestUrl) URL.revokeObjectURL(cloneTestUrl);
      cloneTestUrl = "";
    }
    let voice = "lingCLvocals";
    let inputBars = Array(36).fill(2);
    let outputBars = Array(36).fill(2);
    let stream = null;
    let context = null;
    let processor = null;
    let source = null;
    let gain = null;
    let controller = null;
    let animation = 0;
    let detecting = false;
    const historyKey = "geovision.demo.events.v1";
    function record(type, summary, runtimeMs = null, rtf = null) {
      events = [
        {
          time: (/* @__PURE__ */ new Date()).toISOString(),
          run,
          type,
          summary,
          runtimeMs,
          rtf
        },
        ...events
      ].slice(0, 300);
      try {
        localStorage.setItem(historyKey, JSON.stringify(events));
      } catch {
      }
    }
    function runtimeLabel(value) {
      return typeof value === "number" && Number.isFinite(value) && value >= 0 ? `${value.toFixed(2)} ms` : "—";
    }
    function scheduleGreeting(ready, inCall, _tts, _voice, _file, _text, _greeting, cloning, streaming) {
      clearTimeout(greetingTimer);
      {
        return;
      }
    }
    function hangup(log = true) {
      scenarioRunning = false;
      Object.values(chatAudioElements).forEach((element2) => element2?.pause());
      controller?.abort();
      controller = null;
      processor?.disconnect();
      if (processor) processor.onaudioprocess = null;
      source?.disconnect();
      gain?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (context) void context.close();
      context = null;
      cancelAnimationFrame(animation);
      processor = null;
      source = null;
      gain = null;
      connected = false;
      if (!llmModels.some((m) => m.id === llm)) llm = llmModels.find((m) => !m.requiresDownload)?.id || llmModels[0]?.id || "";
      starting = false;
      busy = false;
      detecting = false;
      inputBars = Array(36).fill(2);
      outputBars = Array(36).fill(2);
      if (log) {
        status = "Call ended";
        record("SESSION_ENDED", "Call ended");
      }
    }
    onDestroy(() => {
      if (document.documentElement.dataset.theme === "dark") {
        delete document.documentElement.dataset.theme;
      }
      clearCloneTest();
      if (referencePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(referencePreviewUrl);
      llmDownloading = false;
      stopLlmDownloadWatch();
      clearTimeout(greetingTimer);
      hangup(false);
      releaseChatAudio();
    });
    knowledgeScenarios.find((scenario) => scenarioMode === `scenario:${scenario.id}`);
    displayMessages = useSip ? sipLive.status?.messages || [] : messages;
    sipOnline = useSip && sipLive.live && !!sipLive.status?.registered;
    sipConnected = useSip && sipLive.live && !!sipLive.status?.active;
    sipCanSend = sipConnected && sipSettings?.mode !== "tts" && sipLive.status?.stage === "Listening";
    selectedAsr = audioModels.find((m) => m.key === asrKey);
    selectedVad = audioModels.find((m) => m.key === vadKey);
    selectedLlm = llmModels.find((m) => m.id === llm);
    llmNeedsDownload = !!selectedLlm?.requiresDownload;
    selectedTts = audioModels.find((m) => m.key === ttsKey);
    protectedVoice = protectedVoices.some((id) => savedVoiceId === `preset-${id}`);
    canCall = false;
    sipStatus = !sipLive.live ? useSip ? "Waiting for SIP worker" : "SIP disabled" : sipLive.status?.stage || "Waiting for incoming call";
    vadModels = audioModels.filter((m) => m.task === "vad");
    asrModels = audioModels.filter((m) => ["asr", "stt"].includes(m.task));
    ttsModels = audioModels.filter((m) => ["tts", "clon"].includes(m.task));
    ttsSupportsStreaming = (modelModes[selectedTts?.family || ""] || []).includes("streaming");
    streamingTts = ttsStreaming;
    customSavedVoices = savedVoices.filter((v) => !protectedVoices.some((id) => v.id === `preset-${id}`));
    voiceChoices = selectedTts?.builtin_voices?.length ? selectedTts.builtin_voices : ["lingCLvocals", "wangSG9s"];
    if (!voiceChoices.includes(voice)) voice = selectedTts?.default_voice || voiceChoices[0];
    builtinReference = savedVoices.find((v) => v.id === `preset-${voice}`);
    updateReferencePreview(voiceFile, voice);
    supportsReference = selectedTts?.task === "clon" || (modelCapabilities[selectedTts?.family || ""] || []).includes("speaker_reference") || ["audio8_tts", "voxcpm1", "qwen3_tts"].includes(selectedTts?.family || "");
    requiresReferenceText = supportsReference && selectedTts?.family !== "bluemagpie";
    scheduleGreeting();
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("1du1zi4", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>GeoVision · IVR</title>`);
        });
      });
      $$renderer3.push(`<div${attr_class("demo svelte-1du1zi4", void 0, {
        "resizing-sidebar": resizingSidebar,
        "no-settings": false
      })}${attr_style("", { "--sidebar-width": `${sidebarWidth}px` })}><header class="top-bar svelte-1du1zi4"><div class="brand svelte-1du1zi4"><span class="gv svelte-1du1zi4">${html(logoCloud)}</span><span class="svelte-1du1zi4">GeoVision IVR</span></div> <div class="console-title svelte-1du1zi4"><button class="panel-toggle svelte-1du1zi4"${attr("aria-label", "Hide settings")}${attr("title", "Hide settings")} aria-controls="demo-settings"${attr("aria-expanded", visiblePanels.settings)} data-panel-toggle="settings">`);
      {
        $$renderer3.push("<!--[0-->");
        Panel_left_close($$renderer3, { size: 17 });
      }
      $$renderer3.push(`<!--]--></button> <strong class="svelte-1du1zi4">Conversation</strong><span class="badge svelte-1du1zi4"${attr("title", void 0)}>LOCAL IVR DEMO${escape_html("")}</span></div> <div class="header-actions svelte-1du1zi4"><div class="panel-restores svelte-1du1zi4" aria-label="Hidden panels">`);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div> <div class="connection svelte-1du1zi4"><i${attr_class("svelte-1du1zi4", void 0, { "online": useSip ? sipOnline : connected })}></i>${escape_html((useSip ? sipOnline : connected) ? "CONNECTED" : starting ? "CONNECTING" : "DISCONNECTED")}</div></div></header> <aside id="demo-settings"${attr("hidden", false)} class="svelte-1du1zi4"><section class="stage-settings greeting-settings svelte-1du1zi4" aria-label="Call greeting settings"><div class="stage-heading svelte-1du1zi4"><h2 class="svelte-1du1zi4">Call greeting</h2></div> <fieldset${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"><label class="svelte-1du1zi4">Call greeting<textarea rows="3" class="svelte-1du1zi4">`);
      const $$body = escape_html(greeting);
      if ($$body) {
        $$renderer3.push(`${$$body}`);
      }
      $$renderer3.push(`</textarea></label> <button${attr("disabled", !greeting.trim() || !ttsKey, true)} class="svelte-1du1zi4">${escape_html("Update greetings.csv")}</button> <small class="svelte-1du1zi4">${escape_html(greetingStatus)}</small> <label class="svelte-1du1zi4">Wait notice delay (seconds)<input aria-label="Wait notice delay (seconds)" type="number" min="1" max="60" step="1" required=""${attr("value", lookupNoticeDelaySeconds)} class="svelte-1du1zi4"/></label> <small class="svelte-1du1zi4">Say “查詢中，請稍後。” if a lookup is still pending. Changes save automatically.</small></fieldset></section> <div class="section-label svelte-1du1zi4">MODEL SETTINGS</div> <div class="model-settings-actions svelte-1du1zi4"><button${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4">${escape_html("Save model settings")}</button> <button${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4">${escape_html("Refresh models")}</button></div> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (!llmModels.some((m) => !m.requiresDownload) && true) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="error svelte-1du1zi4">No downloaded LLM models found. Download a model in the LLM page, then
        refresh models.</p>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <section class="stage-settings svelte-1du1zi4" aria-label="VAD settings"><div class="stage-heading svelte-1du1zi4"><h2 class="svelte-1du1zi4">VAD</h2> <label class="stage-switch svelte-1du1zi4"><input type="checkbox" role="switch" aria-label="Enable VAD"${attr("checked", useVad, true)}${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"/><span class="svelte-1du1zi4">${escape_html("On")}</span></label></div> <fieldset${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"><label class="svelte-1du1zi4">VAD`);
      $$renderer3.select(
        { "aria-label": "VAD", value: vadKey, class: "" },
        ($$renderer4) => {
          $$renderer4.option(
            { value: "", disabled: true, class: "" },
            ($$renderer5) => {
              $$renderer5.push(`No installed VAD models`);
            },
            "svelte-1du1zi4"
          );
          $$renderer4.push(`<!--[-->`);
          const each_array = ensure_array_like(vadModels);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let model = each_array[$$index];
            $$renderer4.option(
              { value: model.key, class: "" },
              ($$renderer5) => {
                $$renderer5.push(`${escape_html(model.label)}`);
              },
              "svelte-1du1zi4"
            );
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-1du1zi4"
      );
      $$renderer3.push(`</label> <label class="svelte-1du1zi4">Speech threshold<input type="number" min="0.01" max="0.99" step="0.05"${attr("value", threshold)} class="svelte-1du1zi4"/></label> <label class="svelte-1du1zi4">Turn window (ms)<input type="number" min="300" max="2000" step="50"${attr("value", windowMs)} class="svelte-1du1zi4"/></label> <label class="svelte-1du1zi4">End-of-speech silence (ms)<input aria-label="End-of-speech silence (ms)" type="number" min="500" max="5000" step="100"${attr("value", endSilenceMs)} class="svelte-1du1zi4"/></label> <small class="svelte-1du1zi4">Wait through pauses before starting ASR. Default: 2 seconds.</small></fieldset> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></section> <section class="stage-settings svelte-1du1zi4" aria-label="ASR settings"><div class="stage-heading svelte-1du1zi4"><h2 class="svelte-1du1zi4">ASR</h2> <label class="stage-switch svelte-1du1zi4"><input type="checkbox" role="switch" aria-label="Enable ASR"${attr("checked", useAsr, true)}${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"/><span class="svelte-1du1zi4">${escape_html("On")}</span></label></div> <fieldset${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"><label class="svelte-1du1zi4">ASR`);
      $$renderer3.select(
        { "aria-label": "ASR", value: asrKey, class: "" },
        ($$renderer4) => {
          $$renderer4.option(
            { value: "", disabled: true, class: "" },
            ($$renderer5) => {
              $$renderer5.push(`No installed ASR models`);
            },
            "svelte-1du1zi4"
          );
          $$renderer4.push(`<!--[-->`);
          const each_array_1 = ensure_array_like(asrModels);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let model = each_array_1[$$index_1];
            $$renderer4.option(
              { value: model.key, class: "" },
              ($$renderer5) => {
                $$renderer5.push(`${escape_html(model.label)}`);
              },
              "svelte-1du1zi4"
            );
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-1du1zi4"
      );
      $$renderer3.push(`</label> <label class="svelte-1du1zi4">ASR hotwords / context<textarea rows="3" placeholder="X光機、設備代碼、人名…" class="svelte-1du1zi4">`);
      const $$body_1 = escape_html(hotwords);
      if ($$body_1) {
        $$renderer3.push(`${$$body_1}`);
      }
      $$renderer3.push(`</textarea></label> <button${attr("disabled", savingHotwords, true)} class="svelte-1du1zi4">${escape_html("Save hotwords.csv")}</button> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (selectedAsr?.family === "audio8_asr") {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<small class="svelte-1du1zi4">Audio8 ASR currently uses a fixed transcription prompt; context
            biasing requires a model that supports it.</small>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></fieldset> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></section> <section class="stage-settings svelte-1du1zi4" aria-label="LLM settings"><div class="stage-heading svelte-1du1zi4"><h2 class="svelte-1du1zi4">LLM</h2> <label class="stage-switch svelte-1du1zi4"><input type="checkbox" role="switch" aria-label="Enable LLM"${attr("checked", useLlm, true)}${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"/><span class="svelte-1du1zi4">${escape_html("On")}</span></label></div> <fieldset${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"><label class="svelte-1du1zi4">LLM`);
      $$renderer3.select(
        { "aria-label": "LLM", value: llm, class: "" },
        ($$renderer4) => {
          $$renderer4.option(
            { value: "", disabled: true, class: "" },
            ($$renderer5) => {
              $$renderer5.push(`No downloaded LLM models`);
            },
            "svelte-1du1zi4"
          );
          $$renderer4.push(`<!--[-->`);
          const each_array_2 = ensure_array_like(llmModels);
          for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
            let model = each_array_2[$$index_2];
            $$renderer4.option(
              { value: model.id, class: "" },
              ($$renderer5) => {
                $$renderer5.push(`${escape_html(model.label || model.id)}${escape_html(model.requiresDownload ? " · download required" : "")}`);
              },
              "svelte-1du1zi4"
            );
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-1du1zi4"
      );
      $$renderer3.push(`</label> <label class="svelte-1du1zi4">Dialogue source`);
      $$renderer3.select(
        {
          "aria-label": "Dialogue source",
          value: dialogueSource,
          disabled: savingDialogueSource,
          class: ""
        },
        ($$renderer4) => {
          $$renderer4.option(
            { value: "prompt.csv", class: "" },
            ($$renderer5) => {
              $$renderer5.push(`prompt.csv`);
            },
            "svelte-1du1zi4"
          );
          $$renderer4.option(
            { value: "n8n", class: "" },
            ($$renderer5) => {
              $$renderer5.push(`n8n`);
            },
            "svelte-1du1zi4"
          );
        },
        "svelte-1du1zi4"
      );
      $$renderer3.push(`</label> `);
      if (useSip) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<small class="svelte-1du1zi4">Source changes apply to the next SIP turn. Save model settings to change its LLM.</small>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<label class="svelte-1du1zi4">System prompt<textarea rows="4" class="svelte-1du1zi4">`);
        const $$body_2 = escape_html(prompt);
        if ($$body_2) {
          $$renderer3.push(`${$$body_2}`);
        }
        $$renderer3.push(`</textarea></label> <button${attr("disabled", savingPrompt, true)} class="svelte-1du1zi4">${escape_html("Save prompt.csv")}</button>`);
      }
      $$renderer3.push(`<!--]--> `);
      if (llmNeedsDownload) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<button${attr("disabled", llmDownloading, true)} class="svelte-1du1zi4">${escape_html(llmDownloading ? "Downloading…" : selectedLlm?.status?.value === "incomplete" ? "Resume LFM2.5 Q4_K_M" : "Download LFM2.5 Q4_K_M")}</button>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></fieldset> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></section> <section class="stage-settings svelte-1du1zi4" aria-label="TTS settings"><div class="stage-heading svelte-1du1zi4"><h2 class="svelte-1du1zi4">TTS</h2> <label class="stage-switch svelte-1du1zi4"><input type="checkbox" role="switch" aria-label="Enable TTS"${attr("checked", useTts, true)}${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4"/><span class="svelte-1du1zi4">${escape_html("On")}</span></label></div> <fieldset class="tts-controls svelte-1du1zi4"${attr("disabled", settingsLoading, true)}><label class="svelte-1du1zi4">TTS`);
      $$renderer3.select(
        { "aria-label": "TTS", value: ttsKey, class: "" },
        ($$renderer4) => {
          $$renderer4.option(
            { value: "", disabled: true, class: "" },
            ($$renderer5) => {
              $$renderer5.push(`No installed TTS models`);
            },
            "svelte-1du1zi4"
          );
          $$renderer4.push(`<!--[-->`);
          const each_array_3 = ensure_array_like(ttsModels);
          for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
            let model = each_array_3[$$index_3];
            $$renderer4.option(
              { value: model.key, class: "" },
              ($$renderer5) => {
                $$renderer5.push(`${escape_html(model.label)}`);
              },
              "svelte-1du1zi4"
            );
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-1du1zi4"
      );
      $$renderer3.push(`</label> <div class="tts-playback-options svelte-1du1zi4"><label class="stage-switch tts-streaming-switch svelte-1du1zi4"><span class="svelte-1du1zi4">Streaming</span><input type="checkbox" role="switch" aria-label="TTS streaming"${attr("checked", streamingTts, true)}${attr("disabled", !ttsSupportsStreaming, true)} class="svelte-1du1zi4"/> <span class="svelte-1du1zi4">${escape_html(streamingTts ? "On" : "Off")}</span></label> <label class="tts-speed svelte-1du1zi4">Playback speed<input aria-label="Playback speed" type="number" min="0.7" max="1.25" step="0.05"${attr("value", ttsPlaybackRate)} class="svelte-1du1zi4"/></label></div> <small class="svelte-1du1zi4">${escape_html(ttsSupportsStreaming ? "Play two-line speech groups as they are generated." : "This model supports offline speech only.")}</small> `);
      if (supportsReference) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="voice-picker-row svelte-1du1zi4"><label class="svelte-1du1zi4">Saved voices`);
        $$renderer3.select(
          { "aria-label": "Saved voices", value: savedVoiceId, class: "" },
          ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array_4 = ensure_array_like(protectedVoices);
            for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
              let id = each_array_4[$$index_4];
              $$renderer4.option(
                { value: `preset-${id}`, class: "" },
                ($$renderer5) => {
                  $$renderer5.push(`${escape_html(id)}`);
                },
                "svelte-1du1zi4"
              );
            }
            $$renderer4.push(`<!--]-->`);
            if (!protectedVoice && !savedVoices.some((v) => v.id === savedVoiceId)) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.option(
                { value: savedVoiceId, disabled: true, class: "" },
                ($$renderer5) => {
                  $$renderer5.push(`Saved voice unavailable`);
                },
                "svelte-1du1zi4"
              );
            } else {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]-->`);
            $$renderer4.option(
              { value: "", class: "" },
              ($$renderer5) => {
                $$renderer5.push(`New recording / file`);
              },
              "svelte-1du1zi4"
            );
            $$renderer4.push(`<!--[-->`);
            const each_array_5 = ensure_array_like(customSavedVoices);
            for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
              let saved = each_array_5[$$index_5];
              $$renderer4.option(
                { value: saved.id, class: "" },
                ($$renderer5) => {
                  $$renderer5.push(`${escape_html(saved.name)}`);
                },
                "svelte-1du1zi4"
              );
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-1du1zi4"
        );
        $$renderer3.push(`</label> <button aria-label="Refresh voices" title="Refresh voices" class="svelte-1du1zi4">↻</button></div> <div class="voice-capture-row svelte-1du1zi4"><button aria-label="Record clone voice" title="Record clone voice"${attr("disabled", settingsLoading, true)} class="svelte-1du1zi4">`);
        Mic($$renderer3, { size: 16 });
        $$renderer3.push(`<!----></button> <input aria-label="Custom reference voice" title="Choose reference audio" type="file" accept="audio/*" class="svelte-1du1zi4"/></div> <div class="reference-recording svelte-1du1zi4"><small class="svelte-1du1zi4">Reference recording</small> <audio class="reference-preview svelte-1du1zi4"${attr("src", referencePreviewUrl)} controls="" preload="metadata" aria-label="Voice reference playback"></audio></div> `);
        if (requiresReferenceText) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<label class="svelte-1du1zi4">Reference transcript<textarea rows="2"${attr("readonly", !voiceFile, true)}${attr("placeholder", "Bundled voice transcript unavailable")} class="svelte-1du1zi4">`);
          const $$body_3 = escape_html(builtinReference?.transcript || "");
          if ($$body_3) {
            $$renderer3.push(`${$$body_3}`);
          }
          $$renderer3.push(`</textarea></label>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (!requiresReferenceText) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<small class="svelte-1du1zi4">Use 3–30 seconds of reference speech. No transcript needed.</small>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <div class="voice-name-actions svelte-1du1zi4"><label class="svelte-1du1zi4">Clone Custom Voice<input aria-label="Clone Custom Voice"${attr("value", protectedVoice ? voice : voiceName)}${attr("readonly", protectedVoice, true)} placeholder="Record or choose a reference file" class="svelte-1du1zi4"/></label> <button${attr("disabled", protectedVoice || !voiceFile, true)} class="svelte-1du1zi4">Add</button> <button${attr("disabled", protectedVoice, true)} class="svelte-1du1zi4">Delete</button></div> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <div class="voice-test-row svelte-1du1zi4"><label class="svelte-1du1zi4">Clone TTS test<textarea rows="1" class="svelte-1du1zi4">`);
        const $$body_4 = escape_html(cloneTestText);
        if ($$body_4) {
          $$renderer3.push(`${$$body_4}`);
        }
        $$renderer3.push(`</textarea></label> <button${attr("disabled", !protectedVoice || voiceFile || !cloneTestText.trim() || !ttsKey, true)} class="svelte-1du1zi4">Send</button></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></fieldset> `);
      if (cloneTestUrl) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<audio${attr("src", cloneTestUrl)} controls="" aria-label="Cloned voice test playback" class="svelte-1du1zi4"></audio>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></section> <p role="status" class="svelte-1du1zi4">${escape_html(fileStatus)}</p> <div class="sidebar-foot svelte-1du1zi4">HTTPS microphone<br class="svelte-1du1zi4"/>Echo cancellation enabled<br class="svelte-1du1zi4"/>Listening pauses
      during replies</div></aside>  <div class="sidebar-divider svelte-1du1zi4"${attr("hidden", false)} role="separator" aria-label="Resize sidebar" aria-controls="demo-settings" aria-orientation="vertical"${attr("aria-valuemin", 240)}${attr("aria-valuemax", 640)}${attr("aria-valuenow", sidebarWidth)} tabindex="0"></div> <main class="svelte-1du1zi4"${attr_style("", {
        "--sip-width": `${sipWidth}px`,
        "--details-width": `${detailsWidth}px`,
        "--bottom-height": `${bottomHeight}px`,
        "--events-share": `${eventsShare}fr`,
        "--scenarios-share": `${100 - eventsShare}fr`,
        "--wave-height": `${waveHeight}px`,
        "--composer-height": `${composerHeight}px`
      })}><section${attr_class("session svelte-1du1zi4", void 0, {
        "no-session": false,
        "no-sip": false
      })}><div class="conversation svelte-1du1zi4"><div class="wave-area svelte-1du1zi4"><div class="wave-label svelte-1du1zi4">ASSISTANT</div> <div class="wave wave-out svelte-1du1zi4" aria-label="Live assistant waveform"><!--[-->`);
      const each_array_6 = ensure_array_like(useSip ? sipBars(sipConnected ? sipLive.status?.output : void 0) : outputBars);
      for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
        let height = each_array_6[$$index_6];
        $$renderer3.push(`<span class="svelte-1du1zi4"${attr_style("", { height: `${height}px` })}></span>`);
      }
      $$renderer3.push(`<!--]--></div> <div class="wave-label svelte-1du1zi4">${escape_html(useSip ? "MICROPHONE · SIP CALLER" : "MICROPHONE")}</div> <div class="wave wave-in svelte-1du1zi4" aria-label="Live microphone waveform"><!--[-->`);
      const each_array_7 = ensure_array_like(useSip ? sipBars(sipConnected ? sipLive.status?.input : void 0) : inputBars);
      for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
        let height = each_array_7[$$index_7];
        $$renderer3.push(`<span class="svelte-1du1zi4"${attr_style("", { height: `${height}px` })}></span>`);
      }
      $$renderer3.push(`<!--]--></div></div> <div class="wave-resize panel-resize svelte-1du1zi4">`);
      PanelDivider($$renderer3, {
        label: "Resize waveform",
        orientation: "horizontal",
        min: 70,
        max: 260,
        oncommit: savePanelLayout,
        get value() {
          return waveHeight;
        },
        set value($$value) {
          waveHeight = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <div class="transcript svelte-1du1zi4" aria-live="polite">`);
      if (!displayMessages.length) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="empty svelte-1du1zi4"><h1 class="svelte-1du1zi4">Your local voice assistant</h1> <p class="svelte-1du1zi4">${escape_html(useSip ? "Call 521 from your phone. SIP activity appears here." : "Start a call, then speak or type a message.")}</p> `);
        if (useSip && sipSettings?.mode === "tts") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<small class="svelte-1du1zi4">Echo + keypad TTS · press #1 or #2. Caller transcription requires IVR conversation mode.</small>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <small class="svelte-1du1zi4">VAD → ASR → LLM → TTS</small></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--><!--[-->`);
      const each_array_8 = ensure_array_like(displayMessages);
      for (let $$index_8 = 0, $$length = each_array_8.length; $$index_8 < $$length; $$index_8++) {
        let message = each_array_8[$$index_8];
        $$renderer3.push(`<article${attr_class("svelte-1du1zi4", void 0, { "user": message.role === "user" })}><small class="svelte-1du1zi4">${escape_html(message.role === "user" ? "YOU" : "GEOVISION")}</small> `);
        if (message.audioId && message.audioUrl) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<strong class="audio-message-name svelte-1du1zi4">${escape_html(message.audioName)}</strong> <audio controls="" preload="metadata"${attr("src", message.audioUrl)}${attr("aria-label", `Audio message: ${message.audioName}`)} class="svelte-1du1zi4"></audio>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (message.content) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<p class="svelte-1du1zi4">${escape_html(message.content)}</p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></article>`);
      }
      $$renderer3.push(`<!--]--></div> <div class="composer-resize panel-resize svelte-1du1zi4">`);
      PanelDivider($$renderer3, {
        label: "Resize message input",
        orientation: "horizontal",
        min: 120,
        max: 300,
        reverse: true,
        oncommit: savePanelLayout,
        get value() {
          return composerHeight;
        },
        set value($$value) {
          composerHeight = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <div class="composer svelte-1du1zi4"><form class="svelte-1du1zi4"><textarea rows="2" aria-label="Message" placeholder="Type something…"${attr("disabled", (useSip ? !sipCanSend : !connected) || scenarioRunning, true)} class="svelte-1du1zi4">`);
      const $$body_5 = escape_html(input);
      if ($$body_5) {
        $$renderer3.push(`${$$body_5}`);
      }
      $$renderer3.push(`</textarea><button aria-label="Send message"${attr("disabled", (useSip ? !sipCanSend : !connected) || busy || detecting || scenarioRunning || !input.trim(), true)} class="svelte-1du1zi4">`);
      Send($$renderer3, { size: 18 });
      $$renderer3.push(`<!----></button></form> <div class="controls svelte-1du1zi4"><button${attr("disabled", useSip || !connected || !useAsr, true)}${attr("aria-label", "Mute microphone")}${attr_class("svelte-1du1zi4", void 0, { "muted": muted })}>`);
      {
        $$renderer3.push("<!--[-1-->");
        Mic($$renderer3, { size: 18 });
      }
      $$renderer3.push(`<!--]--></button>`);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--><span class="call-status svelte-1du1zi4" role="status">${escape_html(useSip ? sipStatus : status)}</span>`);
      if (useSip) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<span class="sip-call-hint svelte-1du1zi4">${escape_html(sipConnected ? "Hang up on your phone" : "Dial 521 from 520")}</span>`);
      } else if (connected || starting) {
        $$renderer3.push("<!--[1-->");
        $$renderer3.push(`<button class="hangup svelte-1du1zi4">`);
        Phone_off($$renderer3, { size: 16 });
        $$renderer3.push(`<!----> Hang up</button>`);
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<button class="call svelte-1du1zi4"${attr("disabled", !canCall || discovering || cloneRecording || cloneBusy, true)}>`);
        Phone($$renderer3, { size: 16 });
        $$renderer3.push(`<!----> Start call</button>`);
      }
      $$renderer3.push(`<!--]--></div> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div></div> <div class="details-resize panel-resize svelte-1du1zi4"${attr("hidden", false)}>`);
      PanelDivider($$renderer3, {
        label: "Resize session details",
        min: 150,
        max: 500,
        reverse: true,
        oncommit: savePanelLayout,
        get value() {
          return detailsWidth;
        },
        set value($$value) {
          detailsWidth = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <div class="details svelte-1du1zi4" id="demo-session-details" role="region" aria-label="Session details"${attr("hidden", false)}><div class="panel-heading svelte-1du1zi4"><button class="panel-toggle svelte-1du1zi4" aria-label="Hide session" title="Hide session" aria-controls="demo-session-details" aria-expanded="true" data-hide-panel="session">`);
      Radio($$renderer3, { size: 15 });
      $$renderer3.push(`<!----></button> <div class="section-label svelte-1du1zi4">SESSION</div></div> <dl class="svelte-1du1zi4"><dt class="svelte-1du1zi4">Transport</dt> <dd class="svelte-1du1zi4">${escape_html(useSip ? "SIP / RTP" : "HTTPS")}</dd> <dt class="svelte-1du1zi4">Audio</dt> <dd class="svelte-1du1zi4">${escape_html(useSip ? "Phone microphone + earpiece" : "Microphone + speaker")}</dd> <dt class="svelte-1du1zi4">Turn detection</dt> <dd class="svelte-1du1zi4">${escape_html(useSip ? sipSettings?.mode === "tts" ? "Echo test" : sipLive.status?.models?.vad || "Server VAD" : selectedVad?.label || "—")}</dd> <dt class="svelte-1du1zi4">ASR</dt> <dd class="svelte-1du1zi4">${escape_html(useSip ? sipSettings?.mode === "tts" ? "Skipped · echo test" : sipLive.status?.models?.asr || "Server ASR" : selectedAsr?.label || "—")}</dd> <dt class="svelte-1du1zi4">LLM</dt> <dd class="svelte-1du1zi4">${escape_html(
        useSip ? sipSettings?.mode === "tts" ? "Skipped · echo test" : `${(sipLive.status?.dialogue_source || dialogueSource) === "n8n" ? "n8n · " : ""}${(sipLive.status?.dialogue_source ? sipLive.status?.models?.llm : llm) || "Server LLM"}` : llm || "—"
      )}</dd> <dt class="svelte-1du1zi4">TTS</dt> <dd class="svelte-1du1zi4">${escape_html(useSip ? sipLive.status?.models?.tts || selectedTts?.label || sipSettings?.tts_model || "Server TTS" : selectedTts?.label || "—")}</dd> <dt class="svelte-1du1zi4">Session</dt> <dd class="svelte-1du1zi4">${escape_html(useSip ? sipLive.status?.call_id || "—" : "—")}</dd></dl> <p class="svelte-1du1zi4">${escape_html(useSip ? "Live SIP call. Audio stays on the phone; waveforms show received and transmitted RTP audio." : "Sequential voice pipeline. Listening pauses while the assistant processes and speaks.")}</p></div> <div class="sip-resize panel-resize svelte-1du1zi4"${attr("hidden", false)}>`);
      PanelDivider($$renderer3, {
        label: "Resize SIP sidebar",
        min: 240,
        max: 420,
        reverse: true,
        oncommit: savePanelLayout,
        get value() {
          return sipWidth;
        },
        set value($$value) {
          sipWidth = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <section class="sip-sidebar svelte-1du1zi4" id="demo-sip" aria-label="SIP connection"${attr("hidden", false)}><div class="panel-heading svelte-1du1zi4"><button class="panel-toggle svelte-1du1zi4" aria-label="Hide SIP" title="Hide SIP" aria-controls="demo-sip" aria-expanded="true" data-hide-panel="sip">`);
      Satellite($$renderer3, { size: 15 });
      $$renderer3.push(`<!----></button> <div class="section-label svelte-1du1zi4">SIP CONNECTION</div></div> `);
      SipSidebar($$renderer3, {
        onsettings: receiveSipSettings,
        onstatus: receiveSipStatus,
        browserBusy: connected || starting
      });
      $$renderer3.push(`<!----></section></section> <div class="bottom-resize panel-resize svelte-1du1zi4"${attr("hidden", false)}>`);
      PanelDivider($$renderer3, {
        label: "Resize bottom panels",
        orientation: "horizontal",
        min: 160,
        max: Math.max(260, viewportHeight - 400),
        reverse: true,
        oncommit: savePanelLayout,
        get value() {
          return bottomHeight;
        },
        set value($$value) {
          bottomHeight = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <div${attr_class("bottom-panels svelte-1du1zi4", void 0, {
        "collapsed": false
      })} data-resize-container=""><section class="events svelte-1du1zi4" id="demo-events"><div class="events-title svelte-1du1zi4"><button class="panel-heading title-toggle svelte-1du1zi4"${attr("aria-label", "Hide events")} aria-controls="demo-events-content"${attr("aria-expanded", visiblePanels.events)} data-panel-toggle="events" data-hide-panel="events">`);
      Activity($$renderer3, { size: 15 });
      $$renderer3.push(`<!----> <strong class="svelte-1du1zi4">Events <span class="svelte-1du1zi4">${escape_html(events.length)}</span></strong></button> <button${attr("hidden", false)} class="svelte-1du1zi4">`);
      Trash($$renderer3, { size: 14 });
      $$renderer3.push(`<!----> Clear events</button></div> <div class="event-scroll svelte-1du1zi4" id="demo-events-content"${attr("hidden", false)}><table class="svelte-1du1zi4"><thead class="svelte-1du1zi4"><tr class="svelte-1du1zi4"><th class="svelte-1du1zi4">TIMESTAMP</th><th title="Elapsed wall time for this operation" class="svelte-1du1zi4">RUNTIME</th><th title="Real-time factor reported by the model response" class="svelte-1du1zi4">RTF</th><th class="svelte-1du1zi4">EVENT TYPE</th><th class="svelte-1du1zi4">SUMMARY</th></tr></thead><tbody class="svelte-1du1zi4"><!--[-->`);
      const each_array_9 = ensure_array_like(events);
      for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
        let event = each_array_9[$$index_9];
        $$renderer3.push(`<tr class="svelte-1du1zi4"><td class="svelte-1du1zi4">${escape_html(new Date(event.time).toLocaleTimeString())}</td><td class="runtime svelte-1du1zi4">${escape_html(runtimeLabel(event.runtimeMs))}</td><td class="rtf svelte-1du1zi4">${escape_html(rtfLabel(event.rtf))}</td><td class="svelte-1du1zi4"><span${attr_class("event-tag svelte-1du1zi4", void 0, { "error-tag": event.type === "ERROR" })}>${escape_html(event.type)}</span></td><td class="svelte-1du1zi4">${escape_html(event.summary)}</td></tr>`);
      }
      $$renderer3.push(`<!--]--></tbody></table> `);
      if (!events.length) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="no-events svelte-1du1zi4">Events from this and previous calls appear here.</p>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div></section> <div class="events-resize panel-resize svelte-1du1zi4"${attr("hidden", false)}>`);
      PanelDivider($$renderer3, {
        label: "Resize events and scenarios",
        min: 20,
        max: 80,
        percent: true,
        oncommit: savePanelLayout,
        get value() {
          return eventsShare;
        },
        set value($$value) {
          eventsShare = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <section class="scenario-dock svelte-1du1zi4" id="demo-scenarios" aria-label="Demo scenarios"><button class="scenario-title panel-heading title-toggle svelte-1du1zi4"${attr("aria-label", "Hide scenarios")} aria-controls="demo-scenarios-content"${attr("aria-expanded", visiblePanels.scenarios)} data-panel-toggle="scenarios" data-hide-panel="scenarios">`);
      List_music($$renderer3, { size: 15 });
      $$renderer3.push(`<!----> <strong class="svelte-1du1zi4">Scenarios</strong></button> <div class="scenario-panel svelte-1du1zi4" id="demo-scenarios-content"${attr("hidden", false)}><label class="svelte-1du1zi4">`);
      $$renderer3.select(
        {
          "aria-label": "Scenario",
          value: scenarioMode,
          disabled: scenarioRunning || knowledgeUploading || knowledgeDeleting,
          class: ""
        },
        ($$renderer4) => {
          $$renderer4.option(
            { value: "audio", class: "" },
            ($$renderer5) => {
              $$renderer5.push(`Audio input`);
            },
            "svelte-1du1zi4"
          );
          $$renderer4.push(`<!--[-->`);
          const each_array_10 = ensure_array_like(knowledgeScenarios);
          for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
            let scenario = each_array_10[$$index_10];
            $$renderer4.option(
              { value: `scenario:${scenario.id}`, class: "" },
              ($$renderer5) => {
                $$renderer5.push(`${escape_html(scenario.name)}${escape_html(scenario.kind === "workflow" ? " · Workflow" : "")}`);
              },
              "svelte-1du1zi4"
            );
          }
          $$renderer4.push(`<!--]-->`);
          $$renderer4.option(
            { value: "add-scenario", class: "" },
            ($$renderer5) => {
              $$renderer5.push(`Add New Scenario`);
            },
            "svelte-1du1zi4"
          );
        },
        "svelte-1du1zi4"
      );
      $$renderer3.push(`</label> `);
      {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<label class="audio-choice svelte-1du1zi4">Choose documents<input class="audio-file-input svelte-1du1zi4" aria-label="Scenario documents" type="file" multiple="" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json"${attr("disabled", knowledgeUploading, true)}/></label> <small class="svelte-1du1zi4">PDF, DOCX, XLSX, XLS, CSV, TXT, Markdown, JSON · up to 8 files, 10 MiB total</small> <small class="svelte-1du1zi4">Each filename becomes a Scenario MCP tool, an n8n workflow and a data table. Dialogue examples become voice templates. The selected LLM translates table headers while preserving the originals.</small> <!--[-->`);
        const each_array_11 = ensure_array_like(newScenarioFiles);
        for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
          let file = each_array_11[$$index_11];
          $$renderer3.push(`<p class="svelte-1du1zi4">${escape_html(file.name)} · ${escape_html(Math.ceil(file.size / 1024))} KB</p>`);
        }
        $$renderer3.push(`<!--]--> <button${attr("disabled", !newScenarioFiles.length, true)} class="svelte-1du1zi4">${escape_html("Add scenario")}</button> <p role="status" class="svelte-1du1zi4">${escape_html(knowledgeStatus)}</p>`);
      }
      $$renderer3.push(`<!--]--> `);
      if (scenarioRunning) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<button class="hangup svelte-1du1zi4">Stop scenario</button>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <small role="status" class="svelte-1du1zi4">${escape_html(scenarioStatus)}</small></div></section></div></main></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  Icon as I,
  Trash as T,
  _page as _
};
