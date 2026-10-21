import {Room, RoomEvent} from 'livekit-client';
import {createClient} from '@supabase/supabase-js';
const $ = id => document.getElementById(id);
let supabase, memoryUser, memoryChannel, memoryTimer, refreshVersion = 0;
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
  const headers = {'Content-Type': 'application/json'};
  if (supabase) { const {data} = await supabase.auth.getSession(); if (data.session) headers.Authorization = 'Bearer ' + data.session.access_token; }
  const response = await fetch(path, body === undefined ? {headers} : {method: 'POST', headers, body: JSON.stringify(body)});
  const result = await response.json();
  if (response.status === 401 && supabase) {
    await clearMemorySession();
    throw new Error('Memory identity expired or was removed. Click Connect memory identity, then reconnect the call.');
  }
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail || result));
  return result;
}
async function clearMemorySession() {
  // Clear this browser only; after a DB reset the old account no longer exists.
  const {error} = await supabase.auth.signOut({scope: 'local'});
  if (error) log('Local memory sign-out: ' + error.message);
  await memoryIdentity(null);
  $('memory-info').textContent = 'Memory identity expired or was removed. Click Connect memory identity to continue.';
}
function controls(connected) {
  $('connect').disabled = busy || connected;
  for (const id of ['disconnect', 'mute', 'enable-audio', 'send']) $(id).disabled = !connected;
  $('settings').disabled = connected || busy;
  $('defaults').disabled = connected || busy;
  $('import-settings').disabled = connected || busy;
  $('memory-login').disabled = !supabase || Boolean(memoryUser) || connected || busy;
  $('memory-logout').disabled = !memoryUser || connected || busy;
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
    if (readSettings().memory_enabled && !memoryUser) throw new Error('Connect a Supabase memory identity before enabling memory.');
    const settings = readSettings();
    $('persistence-status').textContent = settings.memory_enabled
      ? 'Personal memory and conversation history enabled for this call.'
      : 'Memory disabled for this call. Reconnect with Persistent memory enabled to save memories and history.';
    const config = await api('/connect', settings);
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
    current.on(RoomEvent.DataReceived, (bytes, participant, kind, topic) => {
      if (topic !== 'audiocpp.persistence') return;
      try {
        const event = JSON.parse(new TextDecoder().decode(bytes));
        handlePersistenceEvent(event);
      } catch (error) { memoryError(error); }
    });
    current.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      const role = participant?.identity === current.localParticipant.identity ? 'user' : 'assistant';
      segments.forEach(s => message(`${participant?.identity}:${s.id}`, role, s.text, s.final));
    });
    const state = participant => {
      const persistence = participant.attributes?.['audiocpp.persistence'];
      if (persistence) {
        try { handlePersistenceEvent(JSON.parse(persistence)); } catch (error) { memoryError(error); }
      }
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


function memoryError(error) { $('memory-error').textContent = String(error); log('Memory: ' + error); }
function cell(row, text) { const td = document.createElement('td'); td.style.cssText = 'padding:10px;border-bottom:1px solid var(--line);white-space:pre-wrap;overflow-wrap:anywhere;max-width:420px'; td.textContent = text == null ? '' : typeof text === 'object' ? JSON.stringify(text) : String(text); row.appendChild(td); return td; }
async function refreshMemory() {
  const version = ++refreshVersion;
  if (!supabase || !memoryUser) return;
  const kind = $('memory-table').value;
  const columns = {memories:'id,user_id,memory_type,content,updated_at', sessions:'room,user_id,status,started_at,ended_at,report', turns:'id,user_id,room,role,content,created_at'};
  const order = {memories:'updated_at',sessions:'started_at',turns:'created_at'};
  let query = supabase.from('voice_' + kind).select(columns[kind]).order(order[kind], {ascending:false}).limit(50);
  const {data, error} = await query;
  if (version !== refreshVersion) return;
  if (error) throw error;
  $('memory-error').textContent = '';
  const header = $('memory-grid').querySelector('thead'), body = $('memory-grid').querySelector('tbody'); header.replaceChildren(); body.replaceChildren();
  const keys = columns[kind].split(',').filter(key => key !== 'user_id');
  const labels = {reported_at:'回報時間',customer:'客戶',work_order_name:'工單名稱',site_code:'廠區代碼',test_result:'起機結果',equipment_id:'設備編號',maintenance_type:'保養項目',exhaust_fan_quantity:'強排FAN數量',panel_fan_quantity:'間面FAN數量',part_number:'料號',serial_number:'序號',manufactured_on:'製造日期',capacitance_value:'電容值',capacitance_unit:'單位',source_text:'原始回報',readback_text:'語音複誦'};
  const head = document.createElement('tr'); keys.forEach(key => cell(head,labels[key] ? labels[key] + ' (' + key + ')' : key)); cell(head,'Actions'); header.appendChild(head);
  for (const item of data || []) {
    const tr = document.createElement('tr'); keys.forEach(key => cell(tr,item[key])); const actions = cell(tr,'');
    if (kind === 'memories') {
      const edit = document.createElement('button'); edit.textContent = 'Edit'; edit.onclick = () => {
        $('memory-kind').value = kind; $('memory-key').value = item.title || item.memory_type; $('memory-content').value = item.content;
        $('memory-form').closest('details').open = true;
      }; actions.appendChild(edit);
      const remove = document.createElement('button'); remove.textContent = 'Delete'; remove.onclick = async () => {
        if (!confirm('Delete this ' + kind + ' row?')) return;
        try { const {data} = await supabase.auth.getSession(); const response = await fetch('/memory/rows/' + kind + '/' + item.id, {method:'DELETE',headers:{Authorization:'Bearer ' + data.session.access_token}}); if (!response.ok) throw new Error(await response.text()); await refreshMemory(); } catch (error) { memoryError(error); }
      }; actions.appendChild(remove);
    }
    body.appendChild(tr);
  }
  if (!data?.length) { const tr = document.createElement('tr'); cell(tr,'No rows yet.'); body.appendChild(tr); }
}
async function subscribeMemory() {
  if (memoryChannel) await supabase.removeChannel(memoryChannel);
  if (!memoryUser) return;
  memoryChannel = supabase.channel('voice-tables-' + memoryUser.id);
  for (const table of ['voice_memories','voice_sessions','voice_turns']) {
    memoryChannel.on('postgres_changes', {event:'*',schema:'public',table}, () => {
      clearTimeout(memoryTimer); memoryTimer = setTimeout(() => refreshMemory().catch(memoryError), 150);
    });
  }
  memoryChannel.subscribe(status => {
    $('memory-status').textContent = status === 'SUBSCRIBED' ? 'Live updates connected' : 'Realtime: ' + status;
    if (status === 'SUBSCRIBED') refreshMemory().catch(memoryError);
    if (['CHANNEL_ERROR','TIMED_OUT'].includes(status)) memoryError('Realtime unavailable; check publication, RLS and WebSocket connectivity. Use Refresh while reconnecting.');
  });
  await refreshMemory();
}
async function memoryIdentity(session) {
  memoryUser = session?.user;
  $('memory-info').textContent = memoryUser ? 'Shared workspace · connected identity: ' + memoryUser.id : 'Connect an identity to access shared memories and history.';
  for (const id of ['memory-refresh','memory-save']) $(id).disabled = !memoryUser;
  controls(Boolean(room));
  if (memoryUser) await subscribeMemory();
  else { ++refreshVersion; clearTimeout(memoryTimer); if (memoryChannel) await supabase.removeChannel(memoryChannel); memoryChannel = null; $('memory-grid').querySelector('tbody').replaceChildren(); $('memory-grid').querySelector('thead').replaceChildren(); $('memory-status').textContent = 'Signed out'; }
}
$('memory-login').onclick = async () => {
  try { const {data,error} = await supabase.auth.signInAnonymously(); if (error) throw error; await memoryIdentity(data.session); } catch (error) { memoryError(error); }
};
$('memory-logout').onclick = async () => { try { await clearMemorySession(); } catch (error) { memoryError(error); } };
$('memory-refresh').onclick = () => refreshMemory().catch(memoryError);
$('memory-table').onchange = () => refreshMemory().catch(memoryError);
$('memory-form').onsubmit = async event => {
  event.preventDefault(); $('memory-save').disabled = true;
  try { await api('/memory/rows', {kind:'memories',key:$('memory-key').value,content:$('memory-content').value}); $('memory-table').value = 'memories'; await refreshMemory(); log('Personal memory saved'); }
  catch (error) { memoryError(error); } finally { $('memory-save').disabled = !memoryUser; }
};
try {
  const config = await api('/memory/config');
  if (config.enabled) {
    supabase = createClient(config.url, config.publishable_key);
    const {data,error} = await supabase.auth.getSession();
    if (error) {
      if ([400,401,403].includes(error.status)) await clearMemorySession();
      else throw error;
    } else if (data.session) {
      // getSession reads local storage; getUser verifies the account still exists.
      const verified = await supabase.auth.getUser();
      if (verified.error) {
        if ([401,403,404].includes(verified.error.status)) await clearMemorySession();
        else throw verified.error;
      } else await memoryIdentity(data.session);
    } else await memoryIdentity(null);
    // Defer work outside the Supabase auth callback to avoid refresh deadlocks.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setTimeout(() => memoryIdentity(null).catch(memoryError), 0);
      if (event === 'TOKEN_REFRESHED' && session) supabase.realtime.setAuth(session.access_token);
    });
  } else $('memory-info').textContent = 'Set Supabase environment variables and apply supabase/001_voice_memory.sql to enable this panel.';
} catch (error) { memoryError(error); }

export function handlePersistenceEvent(event) {
        if (!['ready','checking','unchanged','pending','saving','saved','error'].includes(event.state)) return;
        const labels = {ready:'記憶處理器已連線',checking:'正在讀取記憶',unchanged:'本輪無需更新記憶',pending:'等待記憶儲存',saving:'正在儲存記憶',saved:'記憶已儲存至 Supabase',error:'記憶未儲存'};
        $('persistence-status').textContent = labels[event.state] + ' — ' + event.detail;
        log('Memory write: ' + event.state + ' / ' + event.detail);
        if (event.state === 'error') $('memory-error').textContent = event.detail;
        if (event.state === 'saved') {
          $('memory-error').textContent = '';
          $('memory-table').value = 'memories';
          refreshMemory().catch(memoryError);
        }
}
