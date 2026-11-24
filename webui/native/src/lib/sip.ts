export type SipSettings = {
  schema_version: number;
  enabled: boolean;
  echo: boolean;
  proxy: string;
  account: string;
  auth_user: string;
  display_name: string;
  has_secret: boolean;
  worker_running: boolean;
  mode: 'pipeline' | 'tts';
  interface: string;
  listen: string;
  contact_host: string;
  rtp_ports: string;
  codec: string;
  dtmf_mode: string;
  tts_model: string;
  greeting1: string;
  greeting2: string;
  greeting3: string;
};

const sipUri = /^(sip:(?:[^@;?\s]+@)?)(\[[^\]]+\]|[^:;?\s]+)(.*)$/i;

export function isSipServerIp(value: string): boolean {
  return /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value) &&
    value.split('.').every(octet => Number(octet) <= 255);
}

export function sipServerIp(proxy: string): string {
  const host = sipUri.exec(proxy)?.[2] ?? '';
  return isSipServerIp(host) ? host : '';
}

export function withSipServerIp(settings: SipSettings, ip: string): SipSettings {
  const proxy = sipUri.exec(settings.proxy);
  const account = sipUri.exec(settings.account);
  const previousHost = proxy?.[2];
  let contactHost = settings.contact_host;
  if (contactHost === previousHost) contactHost = ip;
  else if (!contactHost || contactHost === `${previousHost}.nip.io`) contactHost = `${ip}.nip.io`;
  return {
    ...settings,
    proxy: proxy ? proxy[1] + ip + proxy[3] : `sip:${ip}:9900`,
    account: account?.[1].endsWith('@') ? account[1] + ip + account[3] : `sip:${settings.auth_user}@${ip}`,
    contact_host: contactHost,
  };
}

export type SipLive = {
  live: boolean;
  status: null | {
    instance: string;
    call_id: string;
    peer: string;
    stage: string;
    dialogue_source?: "prompt.csv" | "n8n";
    registered: boolean;
    active: boolean;
    updated_at: number;
    models?: { vad: string; asr: string; llm: string; tts: string };
    input: number[];
    output: number[];
    events: { id: number; time: number; type: string; summary: string; run: string }[];
    messages: { role: 'user' | 'assistant'; content: string }[];
  };
};
