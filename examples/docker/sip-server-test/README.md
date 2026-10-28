# Minimal working 520 → external SIP server → 521 greeting worker

Your phone remains **520 on OpenSIPS at 175.180.90.33:9900**. This single CPU
container registers **521 on that same external server**, answers calls and
automatically repeats the bundled **#1 lingCL → #2 WangSG** greetings until you hang up. It does not run a
local registrar, TURN, STT, LLM, TTS, or a WebUI.

The two greetings are prerecorded, so calls and re-registration do not load
models. After hangup the worker accepts another call and reuses the same audio.

## Start on Ubuntu

First stop the old 521 worker and its TURN relay. Leave phone 520 unchanged.

```bash
cd /ssd/rd/joy/audio.cpp/examples/docker/agx-one-container
docker compose --profile sip stop sip coturn

cd ../sip-server-test
cp -n .env.example .env
docker compose up -d --build --force-recreate
docker compose logs --since 1m -f sip-test
```

This builds only the existing **CPU sip-runtime target**, never the CUDA/AI
image. The previous SIP build stages can be reused from Docker's cache. The
first build still needs the compiler and SIP libraries if those stages are not
cached; subsequent source-only changes rebuild just the SIP application.

Wait for:

```text
Prerecorded greetings ready. #1=lingCL, #2=WangSG. No AI requests during calls.
Dialog Contact: sip:521@175.180.90.33.nip.io:... (learned registrar rport)
SIP registered.
Waiting for one incoming call...
```

From PortSIP UC on your iPhone, keep your existing **520** account registered
on **175.180.90.33:9900 (UDP)** and dial **521**. On connection you should hear
**#1 lingCL, then #2 WangSG**, repeating with a three-second pause between greetings until you hang up. No keypad input is
needed. The worker stays available for the next call.

Set `SIP_GREETING_LOOP=0` in `.env` and recreate the container to return to
keypad selection only. In either mode, `#1` and `#2` can select a greeting;
with looping enabled the alternating sequence continues afterward.

## Settings

Use `.env` in this directory. It is separate from `agx-one-container/.env` and
from the saved SIP Gateway page. Defaults match the current Ubuntu device:

| Setting | Default |
| --- | --- |
| Account / authentication username | 521 |
| Proxy | sip:175.180.90.33:9900 |
| Password | 123456 |
| Wi-Fi interface | wlP1p1s0 |
| Wi-Fi bind | 192.168.2.117:15061 |
| RTP ports | 49160–49200 UDP |
| Dialog Contact hostname | 175.180.90.33.nip.io |

`SIP_CONTACT_HOST` must resolve to your current public IP. The default hostname
uses nip.io for this specific network; a DNS hostname you control is preferable.
The native worker learns its public signaling port from the matching successful
REGISTER response's Via `rport`. It does not assume the NAT preserves local port
15061. The dialog Contact uses that learned port.

In live tests, advertising the registrar's literal IP in the dialog Contact
caused ACK/BYE routing to fail when both caller and callee shared that public IP.
Using the hostname plus the learned port allowed complete calls, RTP DTMF and
both greetings through the external server. This is a tested workaround for
this gateway, not a replacement for fixing its NAT/dialog routing configuration.

Phone 520 should use PCMU/G.711 mu-law and RTP telephone-event (RFC 4733 / RFC
2833) DTMF. `SIP_INTERFACE` restricts SIP's local addresses to Wi-Fi; the host
route to the gateway must also use Wi-Fi for the wildcard RTP sockets. Check:

```bash
ip route get 175.180.90.33
```

It should show `dev wlP1p1s0`. Ethernet SSH remains at 192.168.5.151. Keep the
router's existing UDP 49160–49200 forwarding directed at 192.168.2.117 and allow
that range in Ubuntu's firewall. Coturn must stay stopped because it uses that
same range. If the Wi-Fi IP changes, update `.env`.

## Check a call

Successful logs include all of the following:

```text
SIP RX ... ACK ...
SIP call established.
Incoming RTP established.
DTMF: #
DTMF: 1
Caller pressed #1; starting greeting (lingCL).
DTMF: #
DTMF: 2
Caller pressed #2; starting greeting (WangSG).
```

A registration `200 OK` alone is not a passed call test. Incoming ACK, DTMF and
nonzero receive/transmit RTP are checked separately. SIP trace output shows only
start lines, not authentication headers or passwords.

## Native executable without Docker

```bash
SIP_SECRET=123456 SIP_AUTHUSER=521 \
SIP_INTERFACE=wlP1p1s0 SIP_LISTEN=192.168.2.117:15061 \
SIP_CONTACT_HOST=175.180.90.33.nip.io \
SIP_WAIT_FOR_MEDIA=1 SIP_CONTINUOUS=1 \
./exampleSIP --greetings ./greetings \
  sip:521@175.180.90.33 sip:175.180.90.33:9900 listen
```

For an explicitly authorized automated caller, `SIP_TEST_DTMF='#1,,,,,#2'` on an
outgoing invocation sends both selections, with commas adding one-second pauses,
then hangs up after playback. The receive-audio counter and RTP statistics allow
automated verification. It is inactive for incoming/listening calls.

The earlier Asterisk diagnostic is retained as `compose.asterisk.yml`; it is no
longer the default. Do not run it alongside this worker on account 521.

## Restore the full AI pipeline

```bash
docker compose down
cd ../agx-one-container
docker compose --profile sip up -d --no-deps coturn sip
```

## Automated external-server verification

After the worker is registered, you can explicitly run a temporary 520 caller:

```bash
./verify.sh
```

The script tries up to three complete calls through the real server and records
the decoded audio delivered to the 520 player. Each call
sends `#1`, waits for the greeting, sends `#2`, receives audio, hangs up and
unregisters its own caller Contact. Passing requires both greeting-selection
messages at 521 and at least 50 audible received 20 ms frames for each greeting at 520. Logs are
saved under ignored `evidence/`. `SIP_VERIFY_ATTEMPTS` can be set from 1 to 10.

This registers an additional client for account 520; keep your phone idle during
the check, and re-register it afterward if your registrar permits only one
Contact per account. Set `SIP_CALLER_SECRET` in `.env` if account 520's password
differs from 123456. `SIP_CALLER_LISTEN` selects the caller's Wi-Fi address and
port. The test caller's media range is separate from the worker's.

## Listen to exactly what the test caller received

After rebuilding the CPU image and running `./verify.sh`, open:

```text
evidence/received-520.wav
```

This is the latest successful call's **520-side decoded playout**, captured after
RTP reception, decoding, and the jitter buffer. It includes the silence or packet
loss concealment returned by that receive path, along with any audible gaps.
It is not copied from `greetings/greeting1.wav` or `greeting2.wav`. Both selections
and the surrounding call silence are in one WAV. The negotiated PCM sample rate
and channels are retained (normally 8 kHz mono PCM16 for this PCMU test).

Each attempt is also saved as `evidence/received-520-attempt-N.wav`, including
failed attempts when a recording is available. The verifier copies the recording
from the stopped caller container before deleting it. The latest successful
`received-520.wav` is replaced on each successful verification run.

For direct native execution, `SIP_TEST_RECORD=/path/received.wav` enables this
WAV capture. A non-`.wav` path retains the older raw 8 kHz mono recording format.
The recording represents the automated 520 test client's digital playout, not a
separate physical phone's speaker, mixer, or microphone acoustics.

## Live validation performed

On 2026-10-28 (Asia/Taipei), three consecutive calls from an automated account
520 to the native 521 worker through the real `175.180.90.33:9900` server passed.
Both endpoints ran on the development workstation's Wi-Fi address 192.168.2.112;
SIP ACK/BYE and media used the external server, with no direct ACK bypass.
Each call received 190 audible frames for greeting 1 and 227 for greeting 2.
The caller received 706, 707 and 708 RTP packets across the three calls.
Recorded RTP energy-envelope correlation against the source greetings was
0.9672 and 0.9978, respectively. The native SIP env/signaling/audio regressions
and both container lifecycle checks also passed.

This validates the external call flow and the shipped native executable mode.
Ubuntu deployment was not performed because SSH key access to geoadmin was
denied. Native binaries were exercised directly here; Docker Compose rendering
was validated, but the Docker daemon is unavailable to this workstation user.

## iPhone microphone echo test

`SIP_ECHO_TEST=1` (default) echoes caller microphone audio back over RTP.
Audio above an RMS level of 600 (PCM16) pauses the greeting at its current
position. After one second below that level, playback resumes. The three-second
pause between greetings remains. This is a simple level detector, not a speech
recognition model. Use headphones or the iPhone earpiece for this test: speakerphone
can feed greetings and echoed audio back into the microphone and keep it paused.
Set `SIP_ECHO_TEST=0` and recreate the worker to disable echo.
