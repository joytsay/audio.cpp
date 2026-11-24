import { ac as spread_props, a4 as fallback, a5 as bind_props, a7 as attr, ae as attr_style, e as escape_html, a9 as ensure_array_like } from "./index.js";
import { o as onDestroy, a as modelCapabilities } from "./asr-context.js";
import "./app.js";
import "../entries/pages/_page.svelte.js";
import { I as Icon, T as Trash } from "./_page.js";
function Chevron_down($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "chevron-down",
    "size": 24,
    "node": [["path", { "d": "m6 9 6 6 6-6" }]]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Folder_open($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "folder-open",
    "size": 24,
    "node": [
      [
        "path",
        {
          "d": "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"
        }
      ]
    ]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function Plus($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconData = {
    "name": "plus",
    "size": 24,
    "node": [["path", { "d": "M5 12h14" }], ["path", { "d": "M12 5v14" }]]
  };
  Icon($$renderer, spread_props([props, { icon: iconData }]));
}
function selectedTake(chunk) {
  return chunk.takes.find((take) => take.id === chunk.takeId);
}
function TtsApp($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let selectedChunk, visible, navigatorPages, assemblyMatches, assemblyPages;
    let busy = fallback($$props["busy"], false);
    let active = fallback($$props["active"], true);
    let project = null;
    let projects = [];
    let selectedId = "";
    let navigatorPage = 0;
    const navigatorPageSize = 40;
    let assemblyPage = 0;
    let comparedTakeId = "";
    let workspaceTop = 120;
    let loading = true;
    let saveTimer;
    let urls = /* @__PURE__ */ new Map();
    function clearUrls() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    }
    async function saveBeforeClose() {
      await flush();
    }
    async function flush() {
      clearTimeout(saveTimer);
      return;
    }
    onDestroy(() => {
      clearTimeout(saveTimer);
      clearUrls();
    });
    selectedChunk = project?.chunks.find((c) => c.id === selectedId);
    selectedChunk && selectedTake(selectedChunk);
    selectedChunk?.takes.find((take) => take.id === comparedTakeId) || selectedChunk?.takes.at(-1);
    if (!active) {
      if (typeof document !== "undefined") document.querySelectorAll(".tts-app audio").forEach((a) => a.pause());
    }
    visible = [];
    navigatorPages = Math.max(1, Math.ceil(visible.length / navigatorPageSize));
    if (navigatorPage >= navigatorPages) navigatorPage = navigatorPages - 1;
    visible.slice(navigatorPage * navigatorPageSize, (navigatorPage + 1) * navigatorPageSize);
    assemblyMatches = [];
    assemblyPages = Math.max(1, Math.ceil(assemblyMatches.length / navigatorPageSize));
    if (assemblyPage >= assemblyPages) assemblyPage = assemblyPages - 1;
    assemblyMatches.slice(assemblyPage * navigatorPageSize, (assemblyPage + 1) * navigatorPageSize);
    Object.keys(modelCapabilities).filter((family) => modelCapabilities[family].includes("audio_enhancement"));
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<section class="tts-app svelte-1szouna"${attr("data-active", active)} aria-label="Narration workspace"${attr_style("", { "--tts-top": `${workspaceTop}px` })}><header class="project-bar svelte-1szouna"><div class="project-heading svelte-1szouna"><span class="eyebrow svelte-1szouna">TEXT TO SPEECH</span>`);
      {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<h2 class="svelte-1szouna">Narration</h2>`);
      }
      $$renderer3.push(`<!--]--></div> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <span class="save-status svelte-1szouna">${escape_html("Opening…")}</span> <details class="project-menu svelte-1szouna"><summary aria-label="Projects" class="svelte-1szouna">`);
      Folder_open($$renderer3, { size: 16 });
      $$renderer3.push(`<!---->`);
      Chevron_down($$renderer3, { size: 12 });
      $$renderer3.push(`<!----></summary> <div class="project-menu-content svelte-1szouna"><label class="svelte-1szouna">Open project`);
      $$renderer3.select(
        {
          "aria-label": "Open project",
          value: "",
          disabled: busy || loading,
          class: ""
        },
        ($$renderer4) => {
          {
            $$renderer4.push("<!--[-1-->");
          }
          $$renderer4.push(`<!--]--><!--[-->`);
          const each_array_1 = ensure_array_like(projects);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let p = each_array_1[$$index_1];
            $$renderer4.option({ value: p.id }, ($$renderer5) => {
              $$renderer5.push(`${escape_html(p.title)}`);
            });
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-1szouna"
      );
      $$renderer3.push(`</label><button${attr("disabled", busy || loading, true)} class="svelte-1szouna">`);
      Plus($$renderer3, { size: 14 });
      $$renderer3.push(`<!---->New project</button><button class="danger svelte-1szouna"${attr("disabled", busy || loading, true)}>`);
      Trash($$renderer3, { size: 14 });
      $$renderer3.push(`<!---->Delete this project</button><small class="svelte-1szouna">Projects save automatically in this browser.</small></div></details></header> `);
      {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="notice svelte-1szouna" role="status">Opening your projects…</p>`);
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></section>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { busy, active, saveBeforeClose });
  });
}
export {
  TtsApp as default
};
