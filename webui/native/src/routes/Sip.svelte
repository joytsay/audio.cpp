<script lang="ts">
  import { onMount } from 'svelte';
  import { jsonRequest } from '$lib/api';

  type Gateway = {
    proxy: string; account: string; auth_user: string; display_name: string;
    has_secret: boolean; worker_running: boolean;
  };
  let proxy = 'sip:175.180.90.33:9900';
  let account = 'sip:521@175.180.90.33';
  let authUser = '521';
  let secret = '123456';
  let displayName = '521';
  let hasSecret = false;
  let workerRunning = false;
  let loading = true;
  let saving = false;
  let dirty = false;
  let error = '';
  let message = '';
  let mounted = true;

  async function refresh(initial = false) {
    try {
      const data = await jsonRequest<Gateway>('/v1/ui/sip', { cache: 'no-store' });
      if (!mounted) return;
      workerRunning = data.worker_running;
      if (initial && !dirty) {
        proxy = data.proxy;
        account = data.account;
        authUser = data.auth_user;
        displayName = data.display_name;
        hasSecret = data.has_secret;
        if (hasSecret) secret = '';
      }
      if (initial) error = '';
    } catch (cause) {
      if (mounted) {
        workerRunning = false;
        error = cause instanceof Error ? cause.message : String(cause);
      }
    } finally {
      if (mounted) loading = false;
    }
  }

  async function save() {
    saving = true;
    error = '';
    message = '';
    try {
      const result = await jsonRequest<{ message: string }>('/v1/ui/sip', {
        method: 'POST', body: JSON.stringify({
          proxy: proxy.trim(), account: account.trim(), auth_user: authUser.trim(),
          display_name: displayName.trim(), secret
        })
      });
      hasSecret = true;
      secret = '';
      dirty = false;
      message = result.message;
      await refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void refresh(true);
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => { mounted = false; clearInterval(timer); };
  });
</script>

<section class="hero">
  <div><p class="eyebrow">SIP / IVR</p><h1>SIP Gateway</h1>
    <p>Register the server’s IVR worker with your SIP gateway and receive incoming calls.</p></div>
  <div class="hero-stat"><span>SIP worker</span>
    <strong aria-live="polite">{loading ? 'Checking…' : workerRunning ? 'Running' : 'Not running'}</strong>
    <small>Native SIP signaling · RTP audio</small></div>
</section>

{#if error}<p class="notice" role="alert">{error}</p>{/if}
{#if message}<p class="notice" role="status">{message}</p>{/if}

<div class="sip-grid">
  <section class="panel">
    <h2>Gateway registration</h2>
    <form on:submit|preventDefault={save} on:input={() => dirty = true}>
      <fieldset disabled={loading || saving}>
        <label for="sip-gateway">SIP gateway / outbound proxy</label>
        <input id="sip-gateway" bind:value={proxy} spellcheck="false" required />
        <label for="sip-account">SIP account URI</label>
        <input id="sip-account" bind:value={account} spellcheck="false" required />
        <label for="sip-auth-user">Authentication username</label>
        <input id="sip-auth-user" bind:value={authUser} autocomplete="off" required />
        <label for="sip-secret">Secret</label>
        <input id="sip-secret" type="password" bind:value={secret} autocomplete="new-password"
          placeholder={hasSecret ? 'Leave blank to keep the saved secret' : 'SIP account password'} required={!hasSecret} />
        <label for="sip-display-name">Display name</label>
        <input id="sip-display-name" bind:value={displayName} />
        <label for="sip-auth-mode">Registration authentication</label>
        <select id="sip-auth-mode" disabled><option>Register using plain secret</option></select>
      </fieldset>
      <p class="muted">The worker uses your secret for SIP digest authentication. It listens for incoming calls; this page does not use WebRTC or your microphone.</p>
      <p class="muted">Saving restarts SIP registration and ends any active call.</p>
      <div class="actions"><button class="primary" type="submit" disabled={loading || saving}>
        {saving ? 'Saving…' : 'Save and register'}
      </button></div>
    </form>
  </section>
  <section class="panel">
    <h2>Server worker</h2>
    <p>The worker answers incoming calls with the configured speech recognition, LLM, and TTS pipeline.</p>
    <p>“Running” means the worker process is active. Check its logs for confirmation that the SIP gateway accepted registration.</p>
    {#if !loading && !workerRunning}
      <p>Start the SIP service from <code>examples/docker/agx-one-container</code>:</p>
      <pre><code>docker compose --profile sip up -d --build sip</code></pre>
    {/if}
    <p>Check registration and call events:</p>
    <pre><code>docker compose --profile sip logs -f sip</code></pre>
    <a class="nav-link" href="#/pipeline">Open IVR pipeline →</a>
  </section>
</div>
