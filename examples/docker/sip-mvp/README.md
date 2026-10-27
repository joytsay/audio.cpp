# Minimal SIP / IVR test on Wi-Fi

This independent, CPU-only Asterisk service tests registration, two-way RTP and
DTMF before adding the native AI worker or TURN. It generates tones internally:
there are no model downloads, GPU builds, sound-file packages, WebRTC, or external
SIP gateway dependencies. The same Asterisk image is used by `../asterisk`.

The server binds SIP and RTP to the Jetson Wi-Fi address **192.168.2.117**.
The phone must be on the same Wi-Fi/LAN and able to reach that address. Disable
Wi-Fi client isolation on the router if it prevents devices from communicating.
Ethernet SSH at 192.168.5.151 is unaffected. If the Wi-Fi address changes, update
both `bind` and `media_address` in `pjsip.conf` (the third occurrence is a comment).
Reserve this Wi-Fi DHCP address for repeatable testing.

## Start without compiling anything

From `examples/docker/agx-one-container`:

```bash
docker compose -p sip-mvp -f ../sip-mvp/compose.yml up -d
docker compose -p sip-mvp -f ../sip-mvp/compose.yml logs -f sip-test
```

From the repository root, use `-f examples/docker/sip-mvp/compose.yml` instead.
Existing IVR containers can remain running: this test uses SIP UDP **9910** and
RTP UDP **20200–20249**, separate from their SIP and TURN ports. The host firewall
must allow these ports from the phone's LAN. No public port forwarding is needed.
No `--build` option is needed. Docker pulls the CPU image only if it is absent.

## Minimal startup

`modules.conf` uses `autoload=no` and explicitly loads only the SIP, RTP, PCMU,
echo, tone, menu and optional 522 bridging modules. The image's database, ALSA,
JACK, ARI, WebSocket, UNISTIM and DUNDi modules are not used. No database or host
sound card is needed: audio travels between Asterisk and the phone over RTP.
`stasis.conf` uses the server defaults instead of the image's obsolete sample
threadpool options. The inherited CLI-based image health check is disabled to avoid repeated
`Remote UNIX connection` messages. Manual `asterisk -rx` commands still produce
one connect/disconnect pair.

After updating these files, recreate the service (no image rebuild):

```bash
docker compose -p sip-mvp -f ../sip-mvp/compose.yml up -d --force-recreate
```

To verify configuration from inside the `sip-mvp` directory:

```bash
docker compose exec sip-test asterisk -rx 'pjsip show endpoints'
docker compose exec sip-test asterisk -rx 'dialplan show 521@sip-mvp'
```

The first command should list endpoints 520 and 522. The second should show the
menu dialplan. `Asterisk Ready` confirms the PBX core started, but registration
and a call to 600 are still needed to check the SIP/audio path.

## Softphone settings

Use a native SIP softphone on another device on the same Wi-Fi:

| Setting | Value |
| --- | --- |
| SIP server/domain | `192.168.2.117` |
| Port / transport | `9910` / UDP |
| SIP account URI | `sip:520@192.168.2.117` |
| Outbound proxy, if required | `sip:192.168.2.117:9910` |
| Username / authentication username | `520` |
| Password | `123456` |
| Codec | PCMU / G.711 mu-law |
| DTMF | RFC 4733 / RFC 2833 / telephone-event |
| STUN / TURN / ICE | Off |

These are local test credentials, not the public OpenSIPS account. Register with
this local PBX, not `175.180.90.33`. The existing browser SIP Gateway page controls
the AI worker; it is not a softphone and is not needed for this baseline.

## Test in this order

1. Dial **600** and speak. You should hear your voice echo back. Press `#` to end
   the echo test. This proves two-way media, without any greeting gate.
2. Dial **521**. Two short tones play automatically after answer, before any key
   press. This tests outbound audio independently of DTMF reception.
3. After the tones, press **2**. You should hear a two-second higher tone; the log
   should show `MVP DTMF choice=2`.
4. Press **1** after the menu tones. Speak to hear an echo. Press `#` to return
   to the menu. Press **9** after the menu tones to hang up.

Use `1` and `2` for this menu, not `#1` / `#2`. Those combinations belong to the
native AI worker, which is not involved in this baseline.

If registration works but 600 has no echo, investigate local RTP/firewall/client
isolation first. If the automatic tones work but digit 2 does nothing, check the
phone's DTMF configuration before introducing TURN or model inference.

## Inspect a live test

```bash
docker compose -p sip-mvp -f ../sip-mvp/compose.yml exec sip-test \
  asterisk -rx 'pjsip show contacts'
docker compose -p sip-mvp -f ../sip-mvp/compose.yml exec sip-test \
  asterisk -rx 'rtp set debug on'
sudo timeout 15 tcpdump -ni wlP1p1s0 -nn 'udp port 9910 or udp portrange 20200-20249'
```

Disable packet logging with `asterisk -rx 'rtp set debug off'` afterward.

## Optional: test the actual native AI worker locally

Only after the baseline passes:

1. In `agx-one-container/.env`, set `COTURN_URL=` to disable TURN, keep
   `SIP_INTERFACE=wlP1p1s0`, and use `SIP_LISTEN=192.168.2.117:5060`.
2. On the SIP Gateway page, set gateway `sip:192.168.2.117:9910`, account
   `sip:522@192.168.2.117`, authentication username `522`, secret `123456`, and
   display name `522`. Save. These saved credentials override the account values
   in `.env`.
3. From `agx-one-container`, recreate just the worker:
   `docker compose --profile sip up -d --no-deps --force-recreate sip`.
4. Keep softphone account 520 on this local PBX and dial **522**. Now `#1` / `#2`
   should select the native worker's greetings. This stage uses your existing
   STT/LLM/TTS services, but still avoids the public gateway and TURN.

## Stop only this test

```bash
docker compose -p sip-mvp -f ../sip-mvp/compose.yml down
```
