# Coturn with Docker Compose

This runs the official [coturn image](https://github.com/coturn/coturn/tree/master/docker/coturn)
on Linux, including Jetson ARM64. The container uses host networking so RTP relay
addresses and port numbers remain unchanged.

For the AGX audio.cpp deployment, use the
[integrated SIP and coturn setup](../agx-one-container/README.md#sip-telephone-pipeline-and-coturn).
It builds the SIP dependencies and setup tool inside Docker, and starts all
services with one Compose command. The instructions below are for standalone
coturn deployments.

Run the setup tool on the machine that will run the coturn container. It needs
CMake, a C++17 compiler and libcurl development files. On Ubuntu, the libcurl
package is `libcurl4-openssl-dev`; on Arch Linux, it is `curl`.

Build the C++ setup tool from the repository root:

```sh
cmake -S examples/docker/cotrun -B examples/docker/cotrun/build
cmake --build examples/docker/cotrun/build --parallel
```

Detect the local IPv4 address and update the shared `.env` automatically:

```sh
./examples/docker/cotrun/build/coturn_setup
```

The tool selects the source address for the default Internet route. It creates
`examples/docker/agx-one-container/.env` from `.env.example` if necessary. It
fills missing coturn defaults and generates a random password when the password
is empty or still a placeholder. It preserves existing credentials and unrelated
settings. Files are replaced atomically with permissions `0600`. Passwords are
not displayed. Exported shell variables can override the file when Compose runs.

For a machine with multiple network interfaces, select the required interface:

```sh
./examples/docker/cotrun/build/coturn_setup --interface enp130s0
```

Use `--local-ip 192.168.5.151` to supply an address explicitly. Use `--dry-run`
to see the address changes without writing files. The tool does not start Docker
or configure a firewall.

For Internet callers, detect the public IPv4 address too:

```sh
./examples/docker/cotrun/build/coturn_setup --public
```

This sends an HTTPS request to `https://api.ipify.org`. Alternatively, use
`--public-ip YOUR_PUBLIC_IP` to supply it. The tool sets the public/private
mapping and the TURN URL. It preserves an existing public address when no public
option is supplied, and updates the local part of its mapping. The discovered
address is the outbound Internet address; inbound reachability and router port
forwarding must be configured separately.

To update an existing SIP client settings file with the same TURN URL and
credentials, add `--sip-env`:

```sh
./examples/docker/cotrun/build/coturn_setup --public \
  --sip-env examples/ivrTTS/.env.sip
```

Use `--env PATH` for another server settings file and `--template PATH` for
another template. See `coturn_setup --help` for all options.

Edit the coturn settings in that `.env`:

- `COTURN_LISTEN_IP`: address assigned to the Docker host.
- `COTURN_RELAY_IP`: relay socket address on that host; empty uses the listen IP.
- `COTURN_USERNAME` and `COTURN_PASSWORD`: long-term credentials. Replace the password placeholder.
- `COTURN_EXTERNAL_IP`: leave empty for a directly reachable host; behind NAT use `public_ip/private_ip`.
- `COTURN_PORT`: UDP/TCP listener, default `3478`.
- `COTURN_MIN_PORT` and `COTURN_MAX_PORT`: UDP relay range, default `49160-49200`.
- `COTURN_REALM`: authentication realm, default `ivrtts`.
- `COTURN_IMAGE`: pinned image version; supports amd64 and ARM64.
- `COTURN_URL`: client URI to copy into `.env.sip`; it is not a server bind setting.

The example LAN address is `192.168.5.151`. For an Internet SIP peer, use a
publicly reachable relay address. If the host is behind NAT, forward UDP/TCP 3478
and UDP 49160–49200 to that host with identical external/internal port numbers.
Allow these ports in the host firewall too. A relay limited to a private LAN
cannot relay audio to an Internet peer without routing or NAT forwarding.

Start the server:

```sh
docker compose --env-file examples/docker/agx-one-container/.env \
  -f examples/docker/cotrun/compose.yml up -d
```

Inspect or stop it:

```sh
docker compose --env-file examples/docker/agx-one-container/.env \
  -f examples/docker/cotrun/compose.yml logs -f coturn

docker compose --env-file examples/docker/agx-one-container/.env \
  -f examples/docker/cotrun/compose.yml down
```

The startup script writes a mode `0600` config in container tmpfs and starts
coturn with long-term authentication. Passwords are not put in process arguments.
UDP and TCP TURN are enabled; TLS/DTLS listeners and the administrative CLI are
disabled. The server settings are read when the container is created; run
`up -d --force-recreate` after editing `.env`.

Copy the same credentials and a reachable URI into `examples/ivrTTS/.env.sip`:

```dotenv
COTURN_URL=turn:192.168.5.151:3478?transport=udp
COTURN_USERNAME=ivrtts
COTURN_PASSWORD='your TURN password'
```

Then start `exampleSIP` normally. Its baresip installation needs the `turn` module.
TURN relays media; SIP signaling still connects directly to the SIP proxy, so it
does not resolve missing SIP ACKs.
