import { e as escape_html, a7 as attr, ad as head } from "../../../chunks/index.js";
import { h as html, l as logoCloud } from "../../../chunks/app.js";
function Sip($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let proxy = "sip:175.180.90.33:9900";
    let account = "sip:521@175.180.90.33";
    let authUser = "521";
    let secret = "123456";
    let displayName = "521";
    let loading = true;
    $$renderer2.push(`<section class="hero"><div><p class="eyebrow">SIP / IVR</p><h1>SIP Gateway</h1> <p>Register the server’s IVR worker with your SIP gateway and receive incoming calls.</p></div> <div class="hero-stat"><span>SIP worker</span> <strong aria-live="polite">${escape_html(
      "Checking…"
    )}</strong> <small>Native SIP signaling · RTP audio</small></div></section> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="sip-grid"><section class="panel"><h2>Gateway registration</h2> <form><fieldset${attr("disabled", loading, true)}><label for="sip-gateway">SIP gateway / outbound proxy</label> <input id="sip-gateway"${attr("value", proxy)} spellcheck="false" required=""/> <label for="sip-account">SIP account URI</label> <input id="sip-account"${attr("value", account)} spellcheck="false" required=""/> <label for="sip-auth-user">Authentication username</label> <input id="sip-auth-user"${attr("value", authUser)} autocomplete="off" required=""/> <label for="sip-secret">Secret</label> <input id="sip-secret" type="password"${attr("value", secret)} autocomplete="new-password"${attr("placeholder", "SIP account password")}${attr("required", true, true)}/> <label for="sip-display-name">Display name</label> <input id="sip-display-name"${attr("value", displayName)}/> <label for="sip-auth-mode">Registration authentication</label> <select id="sip-auth-mode" disabled="">`);
    $$renderer2.option({}, ($$renderer3) => {
      $$renderer3.push(`Register using plain secret`);
    });
    $$renderer2.push(`</select></fieldset> <p class="muted">The worker uses your secret for SIP digest authentication. It listens for incoming calls; this page does not use WebRTC or your microphone.</p> <p class="muted">Saving restarts SIP registration and ends any active call.</p> <div class="actions"><button class="primary" type="submit"${attr("disabled", loading, true)}>${escape_html("Save and register")}</button></div></form></section> <section class="panel"><h2>Server worker</h2> <p>The worker answers incoming calls with the configured speech recognition, LLM, and TTS pipeline.</p> <p>“Running” means the worker process is active. Check its logs for confirmation that the SIP gateway accepted registration.</p> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <p>Check registration and call events:</p> <pre><code>docker compose --profile sip logs -f sip</code></pre> <a class="nav-link" href="#/pipeline">Open IVR pipeline →</a></section></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("10nsez", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>SIP · GeoVision IVR</title>`);
      });
    });
    $$renderer2.push(`<header class="topbar"><div class="brand"><div class="brand-logo">${html(logoCloud)}</div><div><strong>GeoVision IVR</strong><span>Interactive Voice Response</span></div></div></header> <main>`);
    Sip($$renderer2);
    $$renderer2.push(`<!----></main>`);
  });
}
export {
  _page as default
};
