import { a4 as fallback, e as escape_html, a7 as attr, a5 as bind_props } from "./index.js";
import { o as onDestroy } from "./asr-context.js";
/* empty css                                           */
function MediaPreview($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let previewUrl, failed, previewName;
    let file = fallback($$props["file"], null);
    let src = fallback($$props["src"], "");
    let name = fallback($$props["name"], "");
    let kind = fallback($$props["kind"], "audio");
    let label = fallback($$props["label"], "Preview");
    let objectUrl = "";
    let lastFile = null;
    let failedUrl = "";
    function clearObjectUrl() {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
      }
    }
    onDestroy(clearObjectUrl);
    if (file !== lastFile) {
      clearObjectUrl();
      lastFile = file;
      if (file) objectUrl = URL.createObjectURL(file);
    }
    previewUrl = objectUrl || src;
    failed = Boolean(previewUrl) && failedUrl === previewUrl;
    previewName = file?.name || name;
    if (previewUrl && !failed) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="media-preview svelte-i4ds1n"><div class="media-preview-header svelte-i4ds1n"><strong class="svelte-i4ds1n">${escape_html(label)}</strong> `);
      if (previewName) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="svelte-i4ds1n">${escape_html(previewName)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (kind === "video") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<video controls="" preload="metadata"${attr("src", previewUrl)} class="svelte-i4ds1n"></video>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<audio controls=""${attr("src", previewUrl)} class="svelte-i4ds1n"></audio>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { file, src, name, kind, label });
  });
}
export {
  MediaPreview as M
};
