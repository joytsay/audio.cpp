import { ac as spread_props, a4 as fallback, e as escape_html, a9 as ensure_array_like, a7 as attr, a5 as bind_props } from "./index.js";
import { c as catalog, p as parameterCatalog, o as onDestroy, a as modelCapabilities } from "./asr-context.js";
import "./app.js";
import "../entries/pages/_page.svelte.js";
import { M as MediaPreview } from "./MediaPreview.js";
import { I as Icon } from "./_page.js";
function Audio_lines($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "audio-lines",
    "size": 24,
    "node": [
      ["path", { "d": "M2 10v3" }],
      ["path", { "d": "M6 6v11" }],
      ["path", { "d": "M10 3v18" }],
      ["path", { "d": "M14 8v7" }],
      ["path", { "d": "M18 5v13" }],
      ["path", { "d": "M22 10v3" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function File_text($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "file-text",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
        }
      ],
      ["path", { "d": "M14 2v5a1 1 0 0 0 1 1h5" }],
      ["path", { "d": "M10 9H8" }],
      ["path", { "d": "M16 13H8" }],
      ["path", { "d": "M16 17H8" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Languages($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "languages",
    "size": 24,
    "node": [
      ["path", { "d": "m5 8 6 6" }],
      ["path", { "d": "m4 14 6-6 2-3" }],
      ["path", { "d": "M2 5h12" }],
      ["path", { "d": "M7 2h1" }],
      ["path", { "d": "m22 22-5-10-5 10" }],
      ["path", { "d": "M14 18h6" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Play($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "play",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
        }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Refresh_cw($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "refresh-cw",
    "size": 24,
    "node": [
      [
        "path",
        { "d": "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }
      ],
      ["path", { "d": "M21 3v5h-5" }],
      [
        "path",
        { "d": "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }
      ],
      ["path", { "d": "M8 16H3v5" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Square($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "square",
    "size": 24,
    "node": [
      [
        "rect",
        { "width": "18", "height": "18", "x": "3", "y": "3", "rx": "2" }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Upload($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "upload",
    "size": 24,
    "node": [
      ["path", { "d": "M12 3v12" }],
      ["path", { "d": "m17 8-5-5-5 5" }],
      ["path", { "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function ModelChoice($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let compatible, models, effective, entry;
    let label = $$props["label"];
    let emptyLabel = fallback($$props["emptyLabel"], "Choose an installed model");
    let inherit = fallback($$props["inherit"], null);
    let choices = $$props["choices"];
    let tasks = $$props["tasks"];
    let families = fallback($$props["families"], void 0);
    let value = $$props["value"];
    let disabled = fallback($$props["disabled"], false);
    let settingsLabel = fallback($$props["settingsLabel"], "More generation options");
    let onchange = $$props["onchange"];
    let expanded = false;
    compatible = choices.filter((p) => tasks.includes(p.model.task) && p.model.mode === "offline" && (!families || families.includes(p.model.family)));
    models = compatible;
    effective = value || inherit;
    entry = effective && (catalog.find((e) => e.id === effective.model.id) || catalog.find((e) => e.family === effective.model.family && e.task === effective.model.task));
    effective ? (parameterCatalog[effective.model.id] || parameterCatalog[effective.model.family] || []).filter((p) => p.scope !== "session" && ["number", "slider", "bool", "choice"].includes(p.type) && (entry?.request_options === void 0 || entry.request_options.includes(p.name))) : [];
    $$renderer2.push(`<div class="model-choice svelte-99kkwg"><label class="svelte-99kkwg">${escape_html(label)}`);
    $$renderer2.select(
      {
        "aria-label": label,
        value: value?.id || "",
        disabled,
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`${escape_html(emptyLabel)}`);
        });
        if (value && !compatible.some((p) => p.id === value.id)) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.option({ value: value.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(value.model.display_name)} · saved settings`);
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
        if (models.length) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<optgroup label="Installed models"><!--[-->`);
          const each_array = ensure_array_like(models);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let model = each_array[$$index];
            $$renderer3.option({ value: model.id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(model.name)}`);
            });
          }
          $$renderer3.push(`<!--]--></optgroup>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-99kkwg"
    );
    $$renderer2.push(`</label> `);
    if (effective) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="choice-meta svelte-99kkwg"><span>${escape_html(value ? effective.model.display_name : "Uses the project default")}</span><button type="button"${attr("disabled", disabled, true)}${attr("aria-expanded", expanded)} class="svelte-99kkwg">${escape_html(settingsLabel)}</button></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else if (!compatible.length) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<p class="empty-choice svelte-99kkwg">Install a compatible model from Models.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, {
      label,
      emptyLabel,
      inherit,
      choices,
      tasks,
      families,
      value,
      disabled,
      settingsLabel,
      onchange
    });
  });
}
function DubbingApp($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let speechEntry, builtinVoices, acceptsReference;
    let busy = fallback($$props["busy"], false);
    let active = fallback($$props["active"], true);
    let choices = [];
    let translator = null;
    let tts = null;
    let loading = true;
    let source = null;
    let sourceLanguage = "";
    let targetLanguage = "en";
    let reference = null;
    let referenceText = "";
    const translatorFamilies = [
      ...new Set(catalog.filter((entry) => entry.task === "asr" && entry.request_options?.includes("target_language")).map((entry) => entry.family))
    ];
    function changeSpeechModel(kind) {
      if (kind === "model") {
        reference = null;
        referenceText = "";
      }
    }
    onDestroy(() => {
    });
    speechEntry = tts && (catalog.find((entry) => entry.id === tts.model.id) || catalog.find((entry) => entry.family === tts.model.family && entry.task === "tts"));
    builtinVoices = speechEntry?.builtin_voices || [];
    acceptsReference = Boolean(tts && modelCapabilities[tts.model.family]?.includes("speaker_reference"));
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<section class="dubbing svelte-16se0y2"><header class="svelte-16se0y2"><h1 class="svelte-16se0y2">`);
      Languages($$renderer3, { size: 24 });
      $$renderer3.push(`<!---->Cross-language dubbing</h1> <button type="button"${attr("disabled", busy || loading, true)} title="Refresh installed models" aria-label="Refresh installed models" class="svelte-16se0y2">`);
      Refresh_cw($$renderer3, { size: 17 });
      $$renderer3.push(`<!----></button></header> <div class="workspace svelte-16se0y2"><div class="inputs svelte-16se0y2"><section class="source svelte-16se0y2"><h2 class="svelte-16se0y2">`);
      Upload($$renderer3, { size: 17 });
      $$renderer3.push(`<!---->Source recording</h2> <label class="svelte-16se0y2">Audio file<input type="file" accept="audio/*"${attr("disabled", busy, true)} class="svelte-16se0y2"/></label> `);
      MediaPreview($$renderer3, { file: source, label: "Original audio" });
      $$renderer3.push(`<!----></section> <section class="svelte-16se0y2"><h2 class="svelte-16se0y2">`);
      Languages($$renderer3, { size: 17 });
      $$renderer3.push(`<!---->Translation</h2> `);
      ModelChoice($$renderer3, {
        label: "Translation model",
        choices,
        tasks: ["asr"],
        families: translatorFamilies,
        disabled: busy || loading,
        onchange: () => {
        },
        get value() {
          return translator;
        },
        set value($$value) {
          translator = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> <div class="language-fields svelte-16se0y2"><label class="svelte-16se0y2">Source language<input aria-label="Source language"${attr("value", sourceLanguage)}${attr("disabled", busy, true)} placeholder="Model default" class="svelte-16se0y2"/></label> <label class="svelte-16se0y2">Target language<input aria-label="Target language"${attr("value", targetLanguage)}${attr("disabled", busy, true)} placeholder="en" required="" class="svelte-16se0y2"/></label></div></section> <section class="svelte-16se0y2"><h2 class="svelte-16se0y2">`);
      Audio_lines($$renderer3, { size: 17 });
      $$renderer3.push(`<!---->Speech</h2> `);
      ModelChoice($$renderer3, {
        label: "Speech model",
        choices,
        tasks: ["tts"],
        disabled: busy || loading,
        onchange: changeSpeechModel,
        get value() {
          return tts;
        },
        set value($$value) {
          tts = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      if (tts && builtinVoices.length) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<label class="voice svelte-16se0y2">Voice`);
        $$renderer3.select(
          {
            "aria-label": "Dub voice",
            value: tts.request.voice,
            disabled: busy,
            class: ""
          },
          ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array = ensure_array_like(builtinVoices);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let voice = each_array[$$index];
              $$renderer4.option({ value: voice }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(voice)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-16se0y2"
        );
        $$renderer3.push(`</label>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (acceptsReference) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<details class="svelte-16se0y2"><summary class="svelte-16se0y2">Reference voice</summary> <label class="svelte-16se0y2">Reference audio<input type="file" accept="audio/*"${attr("disabled", busy, true)} class="svelte-16se0y2"/></label> `);
        MediaPreview($$renderer3, { file: reference, label: "Reference voice" });
        $$renderer3.push(`<!----> <label class="svelte-16se0y2">Reference transcript<textarea rows="2"${attr("disabled", busy, true)} class="svelte-16se0y2">`);
        const $$body = escape_html(referenceText);
        if ($$body) {
          $$renderer3.push(`${$$body}`);
        }
        $$renderer3.push(`</textarea></label> `);
        if (reference) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<button type="button"${attr("disabled", busy, true)}>Clear reference</button>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></details>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></section> <div class="actions svelte-16se0y2"><button class="run" type="button"${attr("disabled", busy || loading, true)}>`);
      Play($$renderer3, { size: 16 });
      $$renderer3.push(`<!---->Generate dub</button> `);
      if (busy) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<button type="button">`);
        Square($$renderer3, { size: 15 });
        $$renderer3.push(`<!---->Cancel</button>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <span role="status" class="svelte-16se0y2">${escape_html("Loading installed models...")}</span></div> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div> <section class="result svelte-16se0y2" aria-label="Dub result"><h2 class="svelte-16se0y2">`);
      File_text($$renderer3, { size: 17 });
      $$renderer3.push(`<!---->Translation and audio</h2> `);
      {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<p class="empty svelte-16se0y2">No dub generated</p>`);
      }
      $$renderer3.push(`<!--]--></section></div></section>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { busy, active });
  });
}
export {
  DubbingApp as default
};
