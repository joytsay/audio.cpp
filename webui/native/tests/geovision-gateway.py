"""Regression: HTTP demo uploads must reach n8n rather than the audio server.
Runs an existing Caddy image on temporary ports with mock backends. No live
services, workflows, deployment images, or application data are changed.
"""
import base64
import http.server
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[3]
CADDY = ROOT / 'examples/docker/agx-one-container/Caddyfile'
requests = []

class Backend(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def handle_request(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        requests.append((self.server.backend, self.command, self.path, body))
        response = json.dumps({'backend': self.server.backend, 'path': self.path}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    do_GET = do_POST = handle_request

servers = []
container = 'codex-gateway-check-' + uuid.uuid4().hex[:12]
process = None
try:
    for backend in ['audio', 'llm', 'n8n']:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Backend)
        server.backend = backend
        servers.append(server)
        threading.Thread(target=server.serve_forever, daemon=True).start()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    source = CADDY.read_text()
    # Use the production HTTP site and shared route block on an isolated port.
    shared = source[source.index('(geovision) {'):source.index('# Host 8082')]
    site = source[source.index('http://:8081, http://:8083 {'):]
    site = site.replace('http://:8081, http://:8083', f'http://127.0.0.1:{port}')
    config = '{\n admin off\n}\n' + shared + site
    for upstream, server in zip(['voice-ai:8081', 'voice-ai:8082', 'n8n:5678'], servers):
        config = config.replace(upstream, f'127.0.0.1:{server.server_port}')
    with tempfile.TemporaryDirectory(prefix='geovision-gateway-') as directory:
        fixture = Path(directory) / 'Caddyfile'
        fixture.write_text(config)
        process = subprocess.Popen([
            'docker', 'run', '--pull=never', '--rm', '--name', container,
            '--network', 'host', '-v', f'{fixture}:/etc/caddy/Caddyfile:ro',
            'caddy:2.11.4-alpine',
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        base = f'http://127.0.0.1:{port}'
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError('Isolated Caddy failed to start')
            try:
                urllib.request.urlopen(base + '/', timeout=.3).close()
                break
            except OSError:
                time.sleep(.1)
        for path, backend, upstream in [
            ('/', 'audio', '/'),
            ('/v1/models', 'audio', '/v1/models'),
            ('/llm/models', 'llm', '/models'),
            ('/n8n/webhook/ivr-scenarios', 'n8n', '/webhook/ivr-scenarios'),
        ]:
            with urllib.request.urlopen(base + path, timeout=5) as response:
                assert json.load(response) == {'backend': backend, 'path': upstream}
        upload = {'name': 'CSV scenario', 'files': [{'name': 'service.csv', 'data': base64.b64encode(b'Question,Answer\nWhen?,Today\n').decode()}]}
        for path, payload in [('ivr-add-scenario', upload), ('ivr-agent', {'sessionId': 'test-call', 'text': 'query', 'model': 'test'})]:
            raw = json.dumps(payload).encode()
            request = urllib.request.Request(base + '/n8n/webhook/' + path, data=raw, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=5) as response:
                assert json.load(response) == {'backend': 'n8n', 'path': '/webhook/' + path}
            assert requests[-1] == ('n8n', 'POST', '/webhook/' + path, raw), 'gateway must preserve upload/agent body and method'
        print('PASS HTTP demo gateway: scenario upload/list and IVR agent reach n8n; audio/LLM routes and CSV payload remain intact')
finally:
    if process is not None:
        subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        process.wait(timeout=10)
    for server in servers:
        server.shutdown()
