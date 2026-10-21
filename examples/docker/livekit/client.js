import {Room, RoomEvent} from 'livekit-client';
const $ = id => document.getElementById(id);
let room, busy = false, audioContext, analyser, meterSource, frame;
const messages = new Map();
const log = text => { $('logs').textContent = (new Date().toLocaleTimeString() + ' ' + text + '\n' + $('logs').textContent).slice(0, 18000); };
const fail = error => { $('error').textContent = String(error); log(String(error)); };
function readSettings() {
  return Object.fromEntries([...document.querySelectorAll('[data-key]')].map(el => [el.dataset.key,
    el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value]));
}
function fillSettings(data) {
  for (const el of document.querySelectorAll('[data-key]')) {
    if (!(el.dataset.key in data)) continue;
    if (el.type === 'checkbox') el.checked = Boolean(data[el.dataset.key]);
    else el.value = data[el.dataset.key];
  }
}
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail || result));
  return result;
}
function controls(connected) {
  $('connect').disabled = busy || connected;
  for (const id of ['disconnect', 'mute', 'enable-audio', 'send']) $(id).disabled = !connected;
  $('settings').disabled = connected || busy;
  $('defaults').disabled = connected || busy;
  $('import-settings').disabled = connected || busy;
}
function message(id, role, text, final = true) {
  if (!text) return;
  if (!messages.size) $('conversation').replaceChildren();
  let item = messages.get(id);
  if (!item) {
    const el = document.createElement('div'); el.className = 'message ' + role;
    const label = document.createElement('small'); label.textContent = role === 'assistant' ? 'ASSISTANT' : 'YOU';
    const content = document.createElement('div'); el.append(label, content); $('conversation').appendChild(el);
    item = {el, content, role, time: new Date().toISOString()}; messages.set(id, item);
  }
  item.text = text; item.final = final; item.content.textContent = text;
  item.el.style.opacity = final ? '1' : '.65';
  $('conversation').scrollTop = $('conversation').scrollHeight;
}
function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function devices() {
  const list = await navigator.mediaDevices.enumerateDevices();
  for (const [id, kind] of [['microphone', 'audioinput'], ['speaker', 'audiooutput']]) {
    const selected = $(id).value; $(id).replaceChildren(new Option('System default', 'default'));
    list.filter(d => d.kind === kind && d.deviceId !== 'default').forEach((d, i) => $(id).add(new Option(d.label || `${kind} ${i + 1}`, d.deviceId)));
    if ([...$(id).options].some(o => o.value === selected)) $(id).value = selected;
  }
}
function stopMeter() {
  cancelAnimationFrame(frame); meterSource?.disconnect(); meterSource = null;
  if (audioContext) audioContext.close(); audioContext = null;
  $('level').style.width = '0%';
}
async function startMeter() {
  stopMeter();
  const track = room?.localParticipant.getTrackPublication('microphone')?.track?.mediaStreamTrack;
  if (!track) return;
  audioContext = new AudioContext(); await audioContext.resume();
  analyser = audioContext.createAnalyser(); analyser.fftSize = 256;
  meterSource = audioContext.createMediaStreamSource(new MediaStream([track])); meterSource.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const tick = () => { analyser.getByteTimeDomainData(data); const rms = Math.sqrt(data.reduce((s, x) => s + ((x - 128) / 128) ** 2, 0) / data.length); $('level').style.width = `${Math.min(100, rms * 350)}%`; frame = requestAnimationFrame(tick); }; tick();
}
function disconnected() {
  stopMeter(); $('status').textContent = 'Disconnected'; $('agent-state').textContent = 'Agent offline'; $('quality').textContent = ''; $('mute').textContent = 'Mute mic'; $('audio').replaceChildren(); controls(false);
}
$('connect').onclick = async () => {
  busy = true; controls(false); $('error').textContent = ''; $('status').textContent = 'Connecting…';
  let current;
  try {
    const config = await api('/connect', readSettings());
    current = room = new Room();
    current.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === 'audio') {
        const el = track.attach(); el.volume = Number($('volume').value); $('audio').appendChild(el);
        if ($('speaker').value !== 'default') current.switchActiveDevice('audiooutput', $('speaker').value).catch(fail);
      }
    });
    current.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(el => el.remove()));
    current.on(RoomEvent.Disconnected, reason => { if (room === current) { room = null; disconnected(); log('Disconnected: ' + reason); } });
    current.on(RoomEvent.Reconnecting, () => { $('status').textContent = 'Reconnecting…'; log('Reconnecting'); });
    current.on(RoomEvent.Reconnected, () => { $('status').textContent = 'Connected'; });
    current.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      const role = participant?.identity === current.localParticipant.identity ? 'user' : 'assistant';
      segments.forEach(s => message(`${participant?.identity}:${s.id}`, role, s.text, s.final));
    });
    const state = participant => {
      const value = participant.attributes?.['lk.agent.state'];
      if (value) { $('agent-state').textContent = 'Agent: ' + value; log('Agent: ' + value); }
    };
    current.on(RoomEvent.ParticipantAttributesChanged, (_, participant) => state(participant));
    current.on(RoomEvent.ParticipantConnected, participant => { state(participant); log('Joined: ' + participant.identity); });
    current.on(RoomEvent.ParticipantDisconnected, participant => { if (participant.attributes?.['lk.agent.state']) $('agent-state').textContent = 'Agent offline'; log('Left: ' + participant.identity); });
    current.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => { if (participant.isLocal) $('quality').textContent = 'Link: ' + quality; });
    current.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!current.canPlaybackAudio) log('Playback blocked — click Enable audio'); });
    await current.connect(config.url, config.token); await current.startAudio();
    if ($('microphone').value !== 'default') await current.switchActiveDevice('audioinput', $('microphone').value);
    await current.localParticipant.setMicrophoneEnabled(true);
    await devices(); await startMeter();
    $('status').textContent = 'Connected'; $('room').textContent = config.room; $('mute').textContent = 'Mute mic';
    $('agent-state').textContent = 'Waiting for agent'; current.remoteParticipants.forEach(state);
    log('Connected to ' + config.url + ' / ' + config.room);
  } catch (error) { fail(error); if (current) await current.disconnect(); if (room === current) room = null; disconnected(); }
  finally { busy = false; controls(Boolean(room)); }
};
$('disconnect').onclick = async () => { if (room) await room.disconnect(); };
$('mute').onclick = async () => {
  try { const enabled = !room.localParticipant.isMicrophoneEnabled; await room.localParticipant.setMicrophoneEnabled(enabled); $('mute').textContent = enabled ? 'Mute mic' : 'Unmute mic'; if (enabled) await startMeter(); else stopMeter(); } catch (error) { fail(error); }
};
$('enable-audio').onclick = () => room?.startAudio().catch(fail);
$('microphone').onchange = async () => { try { if (room) { await room.switchActiveDevice('audioinput', $('microphone').value); if (room.localParticipant.isMicrophoneEnabled) await startMeter(); } } catch (error) { fail(error); } };
$('speaker').onchange = () => room?.switchActiveDevice('audiooutput', $('speaker').value).catch(fail);
$('volume').oninput = () => document.querySelectorAll('#audio audio').forEach(el => { el.volume = Number($('volume').value); });
$('text-form').onsubmit = async event => {
  event.preventDefault(); const text = $('text').value.trim(); if (!room || !text) return;
  try { await room.localParticipant.sendText(text, {topic: 'lk.chat'}); message('text-' + crypto.randomUUID(), 'user', text); $('text').value = ''; } catch (error) { fail(error); }
};
$('clear').onclick = () => { messages.clear(); $('conversation').replaceChildren(); };
$('download').onclick = () => download('conversation.json', [...messages.values()].map(({role, text, time, final}) => ({role, text, time, final})));
$('export-settings').onclick = () => download('livekit-settings.json', readSettings());
$('import-settings').onclick = () => $('import-file').click();
$('import-file').onchange = async () => { try { const file = $('import-file').files[0]; if (file) fillSettings(JSON.parse(await file.text())); } catch (error) { fail(error); } $('import-file').value = ''; };
$('defaults').onclick = async () => { try { fillSettings(await api('/settings')); log('Loaded mounted prompt and environment defaults'); } catch (error) { fail(error); } };
for (const button of document.querySelectorAll('[data-models]')) button.onclick = async () => {
  button.disabled = true;
  try { const kind = button.dataset.models; const data = await api('/models/' + kind, readSettings()); const list = $(kind + '-models'); list.replaceChildren(); for (const item of data.data || []) { if (item.id) list.appendChild(new Option(item.id, item.id)); } log(`${kind.toUpperCase()} API reachable: ${list.children.length} models`); }
  catch (error) { fail(error); } finally { button.disabled = false; }
};
try { fillSettings(await api('/settings')); controls(false); await devices(); } catch (error) { fail(error); }
if (!navigator.mediaDevices) fail('Microphone requires trusted HTTPS or localhost.');
else navigator.mediaDevices.addEventListener('devicechange', () => devices().catch(fail));
