<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { SimpleUser } from 'sip.js/lib/platform/web';

  let socketUrl = '';
  let domain = '';
  let username = '520';
  let password = '123456';
  let destination = '521';
  let remoteAudio: HTMLAudioElement;
  let user: SimpleUser | undefined;
  let registered = false;
  let connecting = false;
  let actionPending = false;
  let callState: 'idle' | 'dialing' | 'incoming' | 'active' = 'idle';
  let muted = false;
  let error = '';
  let audioBlocked = false;
  let secure = true;
  let status = 'Disconnected';
  let events: string[] = [];
  let registrationTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function log(message: string) {
    if (!disposed) events = [...events.slice(-79), `${new Date().toLocaleTimeString()}  ${message}`];
  }

  function clearRegistrationTimer() {
    clearTimeout(registrationTimer);
    registrationTimer = undefined;
  }

  function stopMedia(client?: SimpleUser) {
    client?.localMediaStream?.getTracks().forEach((track) => track.stop());
    if (remoteAudio) { remoteAudio.pause(); remoteAudio.srcObject = null; }
    muted = false;
    audioBlocked = false;
  }

  async function disconnect() {
    const client = user;
    user = undefined; // Ignore callbacks from this connection while stopping it.
    clearRegistrationTimer();
    connecting = false;
    registered = false;
    callState = 'idle';
    status = 'Disconnected';
    stopMedia(client);
    try { await client?.disconnect(); }
    catch { log('Connection closed.'); }
  }

  async function fail(message: string) {
    error = message;
    log(message);
    await disconnect();
  }

  async function playAudio() {
    try { await remoteAudio.play(); audioBlocked = false; }
    catch { audioBlocked = true; }
  }

  async function connect() {
    error = '';
    let candidate: SimpleUser | undefined;
    if (!secure || !navigator.mediaDevices?.getUserMedia) {
      error = 'Microphone access needs HTTPS or localhost. See Local setup below.';
      return;
    }
    try {
      const url = new URL(socketUrl.trim());
      if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter a ws:// or wss:// SIP WebSocket URL.');
      if (location.protocol === 'https:' && url.protocol !== 'wss:') throw new Error('An HTTPS page requires a wss:// connection.');
      if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim()) || !/^[a-zA-Z0-9.:[\]-]+$/.test(domain.trim())) throw new Error('Enter a valid SIP username and domain (host or host:port).');
      if (!password) throw new Error('Enter the browser account password.');
      connecting = true;
      status = 'Connecting…';
      const client = new SimpleUser(url.href, {
        aor: `sip:${username.trim()}@${domain.trim()}`,
        reconnectionAttempts: 0,
        sendDTMFUsingSessionDescriptionHandler: true,
        media: { constraints: { audio: true, video: false }, remote: { audio: remoteAudio } },
        userAgentOptions: {
          authorizationUsername: username.trim(), authorizationPassword: password,
          logLevel: 'error', logConfiguration: false,
          transportOptions: { server: url.href, connectionTimeout: 10, traceSip: false },
          sessionDescriptionHandlerFactoryOptions: {
            peerConnectionConfiguration: { iceServers: [] }
          }
        },
        delegate: {
          onRegistered: () => {
            if (user !== client) return;
            clearRegistrationTimer();
            registered = true; connecting = false; status = 'Registered';
            log(`Registered as ${username}. Ready to call.`);
          },
          onUnregistered: () => {
            if (user !== client) return;
            registered = false;
            status = 'Not registered';
          },
          onServerDisconnect: () => {
            if (user === client) void fail('SIP connection closed. Check the WebSocket address and reconnect.');
          },
          onCallCreated: () => { if (user === client) log('Call created.'); },
          onCallReceived: () => {
            if (user !== client) return;
            callState = 'incoming'; status = 'Incoming call'; log('Incoming call. Answer or decline.');
          },
          onCallAnswered: () => {
            if (user !== client) return;
            callState = 'active'; status = 'In call'; log('Call answered.'); void playAudio();
          },
          onCallHangup: () => {
            if (user !== client) return;
            stopMedia(client); callState = 'idle'; status = registered ? 'Registered' : 'Not registered'; log('Call ended.');
          }
        }
      });
      candidate = client;
      user = client;
      registrationTimer = setTimeout(() => {
        if (user === client) void fail('Registration timed out. Check Asterisk, username, and password.');
      }, 15000);
      await client.connect();
      if (user !== client) return;
      status = 'Registering…';
      await client.register({ requestDelegate: {
        onReject: (response) => {
          if (user === client) void fail(`Registration rejected (${response.message.statusCode}). Check the browser account credentials.`);
        }
      } });
    } catch (cause) {
      if (disposed || (candidate && user !== candidate)) return;
      await fail(cause instanceof Error ? cause.message : 'Could not connect to SIP.');
    }
  }

  async function dial(target: string) {
    if (!user || !registered || callState !== 'idle' || actionPending) return;
    const client = user;
    error = '';
    if (!/^[0-9*#]+$/.test(target.trim())) { error = 'Enter an extension using digits, * or #.'; return; }
    callState = 'dialing'; status = `Calling ${target}…`; actionPending = true;
    log(`Calling ${target}.`);
    try {
      await client.call(`sip:${encodeURIComponent(target.trim())}@${domain.trim()}`, {}, { requestDelegate: {
        onReject: (response) => {
          if (user !== client) return;
          error = `Call rejected (${response.message.statusCode}). Check that the destination is registered.`;
          log(error);
        }
      } });
    } catch (cause) {
      if (user !== client) return;
      error = cause instanceof Error ? cause.message : 'Call failed. Check microphone permission.';
      log(error);
      try { await client.hangup(); } catch { /* No session if microphone acquisition failed. */ }
      stopMedia(client); callState = 'idle'; status = 'Registered';
    } finally { actionPending = false; }
  }

  async function callAction(action: 'answer' | 'hangup' | 'decline', tone?: string) {
    if (!user || actionPending) return;
    actionPending = true; error = '';
    try {
      if (tone) { await user.sendDTMF(tone); log(`Keypad: ${tone}`); }
      else await user[action]();
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Call action failed.'; log(error); }
    finally { actionPending = false; }
  }

  function toggleMute() {
    if (!user) return;
    if (muted) user.unmute(); else user.mute();
    muted = !muted;
  }

  onMount(() => {
    secure = window.isSecureContext;
    socketUrl = location.protocol === 'https:' ? `wss://${location.host}/sip-ws` : `ws://${location.hostname}:8088/ws`;
    domain = location.hostname;
  });
  onDestroy(() => { disposed = true; void disconnect(); });
</script>

<section class="hero">
  <div><p class="eyebrow">SIP TEST PHONE</p><h1>Call your IVR</h1><p>Register, test your audio, then talk to the baresip pipeline.</p></div>
  <div class="hero-stat"><span>Phone status</span><strong aria-live="polite">{status}</strong><small>Browser account 520 → IVR 521</small></div>
</section>

{#if !secure}<p class="notice" role="alert">This HTTP address cannot use your microphone. Open the WebUI through HTTPS or use the localhost SSH setup below.</p>{/if}
{#if error}<p class="notice" role="alert">{error}</p>{/if}

<div class="sip-grid">
  <section class="panel">
    <h2>1. Connect to Asterisk</h2>
    <p class="muted">Use the browser account. Account 521 belongs to the IVR pipeline.</p>
    <fieldset disabled={Boolean(user) || connecting}>
      <label for="sip-socket">SIP WebSocket URL</label><input id="sip-socket" type="url" bind:value={socketUrl} spellcheck="false" placeholder="wss://jetson:8083/sip-ws" />
      <label for="sip-domain">SIP domain / server</label><input id="sip-domain" bind:value={domain} spellcheck="false" placeholder="Jetson IP or hostname" />
      <label for="sip-user">Username</label><input id="sip-user" bind:value={username} autocomplete="off" />
      <label for="sip-password">Password</label><input id="sip-password" type="password" bind:value={password} autocomplete="off" placeholder="123456" />
    </fieldset>
    <p class="muted">Local test password: <code>123456</code>. Credentials stay in this page's memory.</p>
    <div class="actions">
      <button class="primary" disabled={Boolean(user) || connecting || !secure} on:click={connect}>{connecting ? 'Connecting…' : 'Connect'}</button>
      <button disabled={!user} on:click={disconnect}>Disconnect</button>
    </div>
  </section>

  <section class="panel">
    <h2>2. Make a test call</h2>
    <p class="muted">Allow microphone access when prompted. Use headphones to avoid feedback.</p>
    <div class="actions presets">
      <button disabled={!registered || callState !== 'idle' || actionPending} on:click={() => dial('600')}>Echo test · 600</button>
      <button class="primary" disabled={!registered || callState !== 'idle' || actionPending} on:click={() => dial('521')}>Call IVR · 521</button>
    </div>
    <label for="sip-destination">Extension</label>
    <div class="dial-row"><input id="sip-destination" bind:value={destination} disabled={callState !== 'idle'} on:keydown={(event) => { if (event.key === 'Enter') void dial(destination); }} /><button disabled={!registered || callState !== 'idle' || actionPending} on:click={() => dial(destination)}>Call</button></div>
    <div class="actions">
      {#if callState === 'incoming'}
        <button class="primary" disabled={actionPending} on:click={() => callAction('answer')}>Answer</button>
        <button disabled={actionPending} on:click={() => callAction('decline')}>Decline</button>
      {:else}
        <button class="hangup" disabled={callState === 'idle' || actionPending} on:click={() => callAction('hangup')}>Hang up</button>
      {/if}
      <button disabled={callState !== 'active'} aria-pressed={muted} on:click={toggleMute}>{muted ? 'Unmute microphone' : 'Mute microphone'}</button>
    </div>
    <div class="keypad" aria-label="DTMF keypad">
      {#each ['1','2','3','4','5','6','7','8','9','*','0','#'] as tone}
        <button aria-label={`Send DTMF ${tone}`} disabled={callState !== 'active' || actionPending} on:click={() => callAction('hangup', tone)}>{tone}</button>
      {/each}
    </div>
    <label for="sip-audio">Call audio</label>
    <audio id="sip-audio" bind:this={remoteAudio} autoplay controls></audio>
    {#if audioBlocked}<button on:click={playAudio}>Enable call audio</button>{/if}
    <p class="muted">600 echoes your voice. 521 needs a running, registered exampleSIP process. Keypad digits are logged by the pipeline.</p>
  </section>
</div>

<section class="panel activity">
  <h2>Call activity</h2>
  <pre role="log" aria-live="polite">{events.join('\n') || 'Connect to begin. No call is placed automatically.'}</pre>
</section>
<details class="panel setup">
  <summary>Local setup and troubleshooting</summary>
  <p>Start the Asterisk Compose service and use its browser account 520. UDP port 9900 is for baresip and desktop phones; browsers use the WebSocket URL above.</p>
  <p>With the Jetson HTTPS Compose deployment, trust its local CA and open <code>https://JETSON_IP:8083/#/sip</code>. The included proxy forwards <code>/sip-ws</code> to Asterisk.</p>
  <p>For an HTTP-only server, run this on your computer and keep it open (replace the SSH username and Jetson address):</p>
  <pre>ssh -N -L 8081:127.0.0.1:8081 -L 8088:127.0.0.1:8088 USER@JETSON_IP</pre>
  <p>Open <code>http://localhost:8081/#/sip</code> and use <code>ws://localhost:8088/ws</code>. SSH forwards signaling; your computer still needs LAN access to the Jetson's UDP media ports 20000–20099.</p>
  <p>If registration fails, check the account and WebSocket endpoint. If a call connects without audio, check microphone permission and LAN media connectivity. Restart exampleSIP after each completed call.</p>
</details>

<style>
  .sip-grid { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.3fr); gap: 20px; }
  .panel { padding: 24px; }
  h2 { margin: 0 0 12px; font-size: 18px; }
  .muted { color: var(--muted); font-size: 13px; line-height: 1.6; }
  fieldset { border: 0; padding: 0; margin: 18px 0; min-width: 0; }
  label { display: block; margin: 14px 0 7px; }
  input { width: 100%; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
  .dial-row { display: flex; gap: 10px; }
  .dial-row input { min-width: 0; flex: 1; }
  .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 300px; margin: 20px 0; }
  .keypad button { font-size: 20px; min-height: 44px; }
  .hangup { color: var(--danger); }
  audio { display: block; width: 100%; margin: 12px 0; }
  .notice { padding: 16px; border: 1px solid var(--danger); border-radius: 12px; color: var(--danger); }
  .activity, .setup { margin-top: 20px; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow-y: auto; font-size: 12px; line-height: 1.7; }
  summary { cursor: pointer; font-weight: 600; }
  .setup p { line-height: 1.7; }
  @media (max-width: 760px) { .sip-grid { grid-template-columns: 1fr; } .panel { padding: 18px; } }
</style>
