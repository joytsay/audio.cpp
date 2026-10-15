# Local SIP test PBX on Jetson

This Asterisk container provides three SIP accounts and an echo extension for
testing `exampleSIP`. The community image publishes ARM64 builds:
<https://github.com/andrius/asterisk>.
No GPU, public SIP provider, TURN server, or company router forwarding is needed
when the clients can reach the Jetson locally. This does not make the PBX
reachable from outside the company network.

## Start the PBX

From the repository root on the Jetson:

```sh
docker compose -f examples/docker/asterisk/compose.yml up -d
docker compose -f examples/docker/asterisk/compose.yml logs -f
```

The container uses Linux host networking. It listens on UDP 9900 for SIP and
UDP 20000–20099 for RTP. These ports must be unused on the Jetson. A softphone
on another computer needs LAN access to those ports; a host firewall or company
LAN isolation can still block it. No `ports:` mappings are needed with host
networking. This setup binds SIP to all IPv4 interfaces and uses plaintext local
test credentials: change the passwords in `pjsip.conf` before using a shared LAN.

## Test the softphone first

Use a SIP softphone on a computer on the same reachable LAN. Replace
`JETSON_LAN_IP` with the Jetson's actual LAN IPv4 address.

| Setting | Value |
| --- | --- |
| SIP server/domain | `JETSON_LAN_IP` |
| SIP port/transport | `9900`, UDP |
| Username/authentication user | `1002` |
| Password | `phone-test-1002` |
| Codec | G.711 mu-law / PCMU |
| STUN / ICE / TURN | Disabled for this LAN test |

Register and dial `600`. Speak and check that your voice echoes back. This
checks registration, call routing, and bidirectional audio without AI services.
Use the Jetson LAN address rather than `127.0.0.1` for clients on other computers.

## Test from the IVR WebUI

Open `https://192.168.5.151:8083/#/sip`, or select **SIP call test** on
`/#/pipeline`. Use your Jetson's actual address if different.
The browser uses SIP.js directly with Asterisk; no Janus service is needed.

| Setting | Value |
| --- | --- |
| SIP WebSocket URL | `wss://192.168.5.151:8083/sip-ws` |
| SIP domain | `192.168.5.151` |
| Browser username | `520` |
| Browser password | `123456` |
| IVR destination | `521` |

Trust the HTTPS deployment's Caddy CA on your computer, then allow microphone
access. Click **Connect**, then **Echo test · 600**. After echo works, start the
pipeline as described below and click **Call IVR · 521**. You can hang up, mute,
receive calls to 520, and send DTMF keypad tones. Connection and call events
appear on the page. Credentials are held only in page memory; the page does not
read the server's private `.env.sip` or save passwords in browser storage.

Account 521 remains the baresip pipeline; 1002 remains a desktop softphone.
The browser gets its own WebRTC account 520 to avoid replacing either contact.
Browser media is DTLS-SRTP; Asterisk bridges it to the pipeline's ordinary RTP.
The browser and Asterisk use LAN ICE candidates without public STUN/TURN.

After **Call IVR · 521** connects, press **#**, then **1** for the `lingCL`
greeting, or **#**, then **2** for `WangSG`. Both versions use the configured
`SIP_GREETING` text and are generated before registration. The page never sends
these digits automatically. A bare `#` only starts voice selection; it does not
play audio. Repeat either sequence to replay that voice from the beginning,
including during playback. Other digits cancel a pending selection and are
logged normally.

Keep `SIP_WAIT_FOR_MEDIA=1` (the default) to wait for manual selection without a
timeout. `0` starts the lingCL greeting automatically on answer; manual voice
selection remains available. If autoplay is blocked, click **Enable call audio**
first. Echo test 600 does not require a greeting trigger. Conversation replies
continue to use `TTS_VOICE`; greeting voice selection does not change it.

After updating this checkout, recreate Asterisk to mount the new `http.conf`:

```sh
docker compose -f examples/docker/asterisk/compose.yml up -d --force-recreate
```

For the [HTTPS deployment](../agx-one-container/README.md), rebuild the server's
embedded WebUI and recreate its HTTPS proxy from that deployment's directory:

```sh
cd examples/docker/agx-one-container
docker compose up -d --build voice-ai
docker compose up -d --force-recreate https
```

The updated Caddy proxy forwards `/sip-ws` to port 8088 on the Jetson host.
This requires the new `extra_hosts` entry in its Compose service. Asterisk's WS
listener binds TCP 8088 on the host for this local test. Keep it reachable only
on trusted networks; external callers need a separate deployment design.
The browser still needs LAN UDP access to Asterisk's media ports 20000–20099.
The pipeline settings in the browser's Conversation view do not configure the
separate `exampleSIP` process: its `.env.sip` remains authoritative.

For HTTP-only installations, run this on the client computer (replace USER and
JETSON_LAN_IP; adjust 8081 if the audio server uses another port):

```sh
ssh -N -L 8081:127.0.0.1:8081 -L 8088:127.0.0.1:8088 USER@JETSON_LAN_IP
```

Then open `http://localhost:8081/#/sip` and connect to
`ws://localhost:8088/ws`. Localhost allows microphone access without an HTTPS
certificate. SSH forwards signaling only; it does not tunnel UDP media.

For a source build outside Docker, run `npm ci && npm run build` in
`webui/native` and rebuild `audiocpp_server` to embed the updated page.

## Connect the baresip pipeline

Build `exampleSIP` using [installSIP.md](../../ivrTTS/installSIP.md).
In its `.env.sip`, set the following, replacing `JETSON_LAN_IP`:

```dotenv
SIP_ACCOUNT=sip:521@JETSON_LAN_IP:9900
SIP_PROXY=sip:JETSON_LAN_IP:9900
SIP_AUTHUSER=521
SIP_SECRET=123456
SIP_TARGET=listen
SIP_CODEC=PCMU
SIP_DTMF_MODE=rtp
SIP_WAIT_FOR_MEDIA=1
SIP_LISTEN=0.0.0.0:5062
SIP_INTERFACE=JETSON_LAN_IP
SIP_RTP_PORTS=21000-21099
COTURN_URL=
```

The client uses SIP 5062 and RTP 21000–21099 so it does not compete with the PBX.
Keep your actual audio.cpp, LLM, RAG, model, and voice settings in this file.
If a host firewall is active, it must also permit the client's configured media
traffic. Asterisk anchors audio with `direct_media=no`.

Run from `examples/ivrTTS`:

```sh
./build-sip/exampleSIP --env .env.sip
```

Wait for `SIP registered.`, then dial `521` from the softphone. The pipeline
answers automatically. It handles one call and exits on hangup; restart it for
the next call. The full conversation still requires working VAD, STT, RAG, LLM,
and TTS services. To isolate TTS and telephone playback first, use fixed
announcement mode from the SIP guide with account 521 and destination `listen`.

If running the existing `agx-one-container` SIP service, put these same settings
in that deployment's `.env` instead. It already uses host networking. Its
Compose dependency still starts coturn, but an empty `COTURN_URL` disables TURN
in the SIP client.

## Inspect and stop

```sh
docker compose -f examples/docker/asterisk/compose.yml exec asterisk asterisk -rx 'pjsip show endpoints'
docker compose -f examples/docker/asterisk/compose.yml exec asterisk asterisk -rx 'pjsip show contacts'
docker compose -f examples/docker/asterisk/compose.yml exec asterisk asterisk -rx 'http show status'
docker compose -f examples/docker/asterisk/compose.yml exec asterisk asterisk -rx 'dialplan show local-test'
docker compose -f examples/docker/asterisk/compose.yml down
```

After editing configuration, restart the PBX (active calls disconnect):

```sh
docker compose -f examples/docker/asterisk/compose.yml restart asterisk
```

For SIP traces, execute `asterisk -rx 'pjsip set logger on'` in the container and
watch Compose logs. For audio traces use `asterisk -rx 'rtp set debug on'`.
Disable with the corresponding `off` commands after diagnosis.
