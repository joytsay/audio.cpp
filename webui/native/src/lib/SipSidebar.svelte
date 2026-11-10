<script lang="ts">
  import { onMount } from 'svelte';
  import { jsonRequest } from './api';
  import type { SipSettings, SipLive } from './sip';

  export let onsettings: (settings: SipSettings) => void = () => {};
  export let onstatus: (status: SipLive) => void = () => {};
  export let browserBusy = false;
  let settings: SipSettings | null = null;
  let secret = '', error = '', message = '';
  let loading = true, saving = false, dirty = false;
  let form: HTMLFormElement;
  let live: SipLive = { live: false, status: null };
  let alive = true;
  let controller: AbortController;

  async function load() {
    const data = await jsonRequest<SipSettings>('/v1/ui/sip', { cache: 'no-store' }, controller.signal);
    if (data.schema_version !== 2) throw new Error('Update the audio.cpp server to enable the SIP sidebar and live call monitor.');
    if (!alive) return;
    if (!dirty) settings = data;
    else if (settings) settings.worker_running = data.worker_running;
    onsettings(data);
  }
  async function poll() {
    try {
      const data = await jsonRequest<SipLive>('/v1/ui/sip/live', { cache: 'no-store' }, controller.signal);
      if (alive) { live = data; onstatus(data); }
    } catch (cause) {
      if (alive) {
        live = { live: false, status: null }; onstatus(live);
        error = cause instanceof Error ? cause.message : String(cause);
      }
    }
  }
  async function save(enabled = settings?.enabled) {
    if (!settings || saving || enabled === undefined) return false;
    if (enabled && !form.reportValidity()) return false;
    saving = true; error = ''; message = '';
    try {
      const result = await jsonRequest<{ message: string }>('/v1/ui/sip', {
        method: 'POST', body: JSON.stringify({ ...settings, enabled, secret, echo: settings.mode === 'tts' }),
      }, controller.signal);
      if (!alive) return false;
      secret = ''; dirty = false; message = result.message;
      await load();
      return true;
    } catch (cause) {
      if (alive) error = cause instanceof Error ? cause.message : String(cause);
      return false;
    } finally { if (alive) saving = false; }
  }
  async function toggleEnabled(event: Event) {
    const checkbox = event.currentTarget as HTMLInputElement;
    const enabled = checkbox.checked;
    if (!settings) return;
    const previous = settings.enabled;
    settings = { ...settings, enabled };
    if (!(await save(enabled)) && settings) settings = { ...settings, enabled: previous };
  }
  onMount(() => {
    alive = true; controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    async function refresh() {
      try {
        if (count++ % 10 === 0) await load();
        if (alive) await poll();
      } catch (cause) { if (alive) error = cause instanceof Error ? cause.message : String(cause); }
      finally {
        if (alive) { loading = false; timer = setTimeout(refresh, 200); }
      }
    }
    void refresh();
    return () => { alive = false; controller.abort(); clearTimeout(timer); };
  });
</script>

<div class="sip-content">
  {#if loading}<p class="muted">Loading SIP settings…</p>{/if}
  {#if error}<p class="notice error" role="alert">{error}</p>{/if}
  {#if settings}
    <form bind:this={form} on:submit|preventDefault={() => save()} on:input={() => { dirty = true; message = ''; }}>
      <label class="use-sip" for="demo-use-sip">
        <span><strong>Use SIP</strong><small>Receive calls on {settings.auth_user || '521'}</small></span>
        <input id="demo-use-sip" type="checkbox" role="switch" checked={settings.enabled}
          disabled={saving || browserBusy} on:change={toggleEnabled} />
      </label>
      {#if browserBusy}<p class="muted">End the browser call before enabling SIP.</p>{/if}
      <div class="sip-status" role="status">
        <i class:online={live.live && live.status?.registered}></i>
        {live.live && live.status?.active ? `In call · ${live.status.peer}` : live.live && live.status?.registered ? 'Registered · waiting for a call' : settings.worker_running ? 'Worker running · awaiting registration' : settings.enabled ? 'Waiting for SIP worker' : 'SIP disabled'}
      </div>
      <fieldset disabled={saving}>
        <label for="demo-sip-mode">Call mode</label>
        <select id="demo-sip-mode" bind:value={settings.mode}>
          <option value="pipeline">Use IVR</option>
          <option value="tts">Test echo</option>
        </select>
        <p class="muted">{settings.mode === 'tts' ? 'Dial 521 from 520. Press #1, #2 or #3 for TTS. Echo mode has no caller transcription.' : 'Phone audio runs through VAD → ASR → LLM → TTS. Replies play back into the same SIP call; transcripts and events appear in the demo.'}</p>
        <h3>Connection</h3>
        <label for="demo-sip-proxy">SIP gateway / proxy</label><input id="demo-sip-proxy" bind:value={settings.proxy} required spellcheck="false" />
        <label for="demo-sip-account">Account URI</label><input id="demo-sip-account" bind:value={settings.account} required spellcheck="false" />
        <label for="demo-sip-auth">Authentication username</label><input id="demo-sip-auth" bind:value={settings.auth_user} required autocomplete="off" />
        <label for="demo-sip-secret">Password</label><input id="demo-sip-secret" type="password" bind:value={secret} autocomplete="new-password" required={!settings.has_secret} placeholder={settings.has_secret ? 'Leave blank to keep saved password' : 'SIP account password'} />
        <label for="demo-sip-display">Display name</label><input id="demo-sip-display" bind:value={settings.display_name} />
        <h3>Network & audio</h3>
        <label for="demo-sip-interface">Network interface</label><input id="demo-sip-interface" bind:value={settings.interface} placeholder="Auto, e.g. eno1" spellcheck="false" />
        <label for="demo-sip-listen">Local SIP address</label><input id="demo-sip-listen" bind:value={settings.listen} placeholder="192.168.2.111:15061" spellcheck="false" />
        <label for="demo-sip-contact">Public Contact hostname</label><input id="demo-sip-contact" bind:value={settings.contact_host} placeholder="175.180.90.33.nip.io" spellcheck="false" />
        <label for="demo-sip-rtp">RTP port range</label><input id="demo-sip-rtp" bind:value={settings.rtp_ports} required placeholder="49160-49200" />
        <label for="demo-sip-codec">Codec</label><select id="demo-sip-codec" bind:value={settings.codec}><option value="PCMU">PCMU · G.711 μ-law</option><option value="OPUS">Opus</option></select>
        <label for="demo-sip-dtmf">DTMF</label><select id="demo-sip-dtmf" bind:value={settings.dtmf_mode}><option value="rtp">RTP telephone-event</option><option value="info">SIP INFO</option></select>
        <h3>TTS greetings</h3>
        <label for="demo-sip-tts">TTS model</label><input id="demo-sip-tts" bind:value={settings.tts_model} required />
        <label for="demo-sip-greeting1">#1 · lingCL</label><textarea id="demo-sip-greeting1" bind:value={settings.greeting1} rows="2" required></textarea>
        <label for="demo-sip-greeting2">#2 · WangSG</label><textarea id="demo-sip-greeting2" bind:value={settings.greeting2} rows="2" required></textarea>
        <label for="demo-sip-greeting3">#3 · lingCL</label><textarea id="demo-sip-greeting3" bind:value={settings.greeting3} rows="2" required></textarea>
      </fieldset>
      <button class="save" type="submit" disabled={saving || browserBusy}>{saving ? 'Saving…' : 'Save SIP settings'}</button>
      {#if message}<p class="muted" role="status">{message}</p>{/if}
      <p class="muted">Changes restart registration and end an active phone call. Hiding this panel keeps SIP running.</p>
    </form>
  {/if}
</div>

<style>
  .sip-content { min-width: 0; font-size: 12px; }
  form, fieldset { min-width: 0; }
  fieldset { border: 0; padding: 0; margin: 0; }
  label { display: block; margin: 12px 0 5px; color: var(--muted); font-size: 11px; }
  input:not([type='checkbox']), select, textarea { display: block; width: 100%; min-width: 0; box-sizing: border-box; padding: 8px; background: var(--input-bg, var(--bg)); color: var(--text); border: 1px solid var(--line); border-radius: 5px; font: inherit; }
  textarea { resize: vertical; }
  .use-sip { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; color: var(--text); }
  .use-sip strong { font-size: 14px; }
  small { display: block; margin-top: 5px; color: var(--muted); }
  input[role='switch'] { appearance: none; flex: 0 0 36px; height: 21px; border-radius: 12px; background: var(--line); position: relative; cursor: pointer; }
  input[role='switch']::before { content: ''; position: absolute; width: 15px; height: 15px; border-radius: 50%; background: white; top: 3px; left: 3px; transition: transform .15s; }
  input[role='switch']:checked { background: var(--accent, #38d9d3); }
  input[role='switch']:checked::before { transform: translateX(15px); }
  input:disabled { opacity: .5; cursor: wait; }
  .sip-status { display: flex; gap: 7px; align-items: center; overflow-wrap: anywhere; color: var(--muted); margin: 18px 0; font-size: 11px; }
  .sip-status i { width: 7px; height: 7px; flex-shrink: 0; border-radius: 50%; background: var(--muted); }
  .sip-status i.online { background: #40d5a6; }
  h3 { border-top: 1px solid var(--line); padding-top: 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .muted { color: var(--muted); font-size: 11px; line-height: 1.6; }
  .error { color: #ff9a9a; overflow-wrap: anywhere; }
  .save { margin-top: 18px; width: 100%; padding: 9px; border-radius: 5px; border: 1px solid var(--line); color: var(--text); background: var(--button-bg); cursor: pointer; }
  .save:disabled { opacity: .5; cursor: wait; }
</style>
