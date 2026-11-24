import { r as root } from "./root.js";
import "./server.js";
let read_implementation = null;
function set_read_implementation(fn) {
  read_implementation = fn;
}
function set_manifest(_) {
}
let public_env = {};
function set_private_env(environment) {
}
function set_public_env(environment) {
  public_env = environment;
}
const error = ({ status, message }) => '<!doctype html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<title>' + message + `</title>

		<style>
			body {
				--bg: white;
				--fg: #222;
				--divider: #ccc;
				background: var(--bg);
				color: var(--fg);
				font-family:
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					Roboto,
					Oxygen,
					Ubuntu,
					Cantarell,
					'Open Sans',
					'Helvetica Neue',
					sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100vh;
				margin: 0;
			}

			.error {
				display: flex;
				align-items: center;
				max-width: 32rem;
				margin: 0 1rem;
			}

			.status {
				font-weight: 200;
				font-size: 3rem;
				line-height: 1;
				position: relative;
				top: -0.05rem;
			}

			.message {
				border-left: 1px solid var(--divider);
				padding: 0 0 0 1rem;
				margin: 0 0 0 1rem;
				min-height: 2.5rem;
				display: flex;
				align-items: center;
			}

			.message h1 {
				font-weight: 400;
				font-size: 1em;
				margin: 0;
			}

			@media (prefers-color-scheme: dark) {
				body {
					--bg: #222;
					--fg: #ddd;
					--divider: #666;
				}
			}
		</style>
	</head>
	<body>
		<div class="error">
			<span class="status">` + status + '</span>\n			<div class="message">\n				<h1>' + message + "</h1>\n			</div>\n		</div>\n	</body>\n</html>\n";
const options = {
  app_template_contains_nonce: false,
  async: false,
  csp: { "mode": "auto", "directives": { "upgrade-insecure-requests": false, "block-all-mixed-content": false }, "reportOnly": { "upgrade-insecure-requests": false, "block-all-mixed-content": false } },
  csrf_check_origin: true,
  csrf_trusted_origins: [],
  embedded: false,
  env_public_prefix: "PUBLIC_",
  env_private_prefix: "",
  hash_routing: true,
  hooks: null,
  // added lazily, via `get_hooks`
  preload_strategy: "modulepreload",
  root,
  service_worker: false,
  service_worker_options: void 0,
  server_error_boundaries: false,
  templates: {
    app: ({ head, body, assets, nonce, env }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <!-- Inline static/logo_cloud.svg so the embedded UI has a tab icon before JavaScript loads. -->
    <link rel="icon" type="image/svg+xml" sizes="any" href="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggb3BhY2l0eT0iMC43OTciIGQ9Ik0xNyAwQzIwLjM2MjMgMCAyMy42NDkgMC45OTcwMzIgMjYuNDQ0NyAyLjg2NTAyQzI5LjI0MDcgNC43MzMgMzEuNDE5MyA3LjM4ODAzIDMyLjcwNTkgMTAuNDk0NEMzMy45OTI2IDEzLjYwMDcgMzQuMzI5MyAxNy4wMTg5IDMzLjY3MzMgMjAuMzE2NUMzMy4wMTc0IDIzLjYxNDIgMzEuMzk4MyAyNi42NDMzIDI5LjAyMDggMjkuMDIwOEMyNi42NDMzIDMxLjM5ODMgMjMuNjE0MiAzMy4wMTc0IDIwLjMxNjUgMzMuNjczM0MxNy4wMTg5IDM0LjMyOTMgMTMuNjAwNyAzMy45OTI2IDEwLjQ5NDQgMzIuNzA1OUM3LjM4ODAzIDMxLjQxOTMgNC43MzMgMjkuMjQwNyAyLjg2NTAyIDI2LjQ0NDdDMC45OTcwMzIgMjMuNjQ5MSAwIDIwLjM2MjMgMCAxN0MwIDEyLjQ5MTMgMS43OTEwNyA4LjE2NzIzIDQuOTc5MTggNC45NzkxOEM4LjE2NzIzIDEuNzkxMDcgMTIuNDkxMyAwIDE3IDBaIiBmaWxsPSIjNTlBOUVGIi8+CjxwYXRoIGQ9Ik0xNy4wMzk2IDI1LjA2NTlDMTMuNTcxNiAyMy44OTggMTAuNzc3OCAyMS4yMjA1IDEwLjc2NjYgMTcuMzcwNkMxMC43NDU0IDExLjA4ODUgMTUuNDIzNSA4LjU3NDIzIDE5LjQwMzcgOC41QzE5LjQwMzcgOC41IDE0LjY2MzkgOC43MjY2NiAxMy4wMjg3IDEzLjUyMTJDMTEuNzM1OCAxNy4zMDg1IDE0LjU0MzggMjAuMTU3IDE1LjMyMTYgMjAuNzQxN0MxNy42MDAxIDIyLjQ2NjEgMjAuNjA1OSAyMi40OTg0IDIyLjAzNSAyMi4yMDk0QzIyLjk0NSAyMi4wMjYzIDIyLjkxMjYgMjEuNjIxNyAyMi45MTI2IDIxLjYyMTdWMjUuMTI2QzIyLjkxMjYgMjUuMTI2IDE5LjgzMDMgMjYuMDA3NyAxNy4wMzk2IDI1LjA2NTlaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjMuNTE2NyAxNS41MDIzQzIzLjUwNjQgMTYuMDk3OCAyMy4zMzE1IDE2LjY3NjggMjMuMDEzOSAxNy4xNjY2QzIyLjY5NjUgMTcuNjU2NCAyMi4yNTAxIDE4LjAzNSAyMS43MzEzIDE4LjI1NTVDMjEuMjEyMiAxOC40NzU4IDIwLjY0NDYgMTguNTI3OCAyMC4wOTgxIDE4LjQwNDlDMTkuNTUxNiAxOC4yODIgMTkuMDUxNiAxNy45ODk3IDE4LjY2MDUgMTcuNTY0OEMxOC4yNjk0IDE3LjEzOTcgMTguMDA0MSAxNi42MDEgMTcuODk5NCAxNi4wMTZDMTcuNzk0NSAxNS40MzEyIDE3Ljg1MzggMTQuODI2MiAxOC4wNjk1IDE0LjI3N0MxOC4yODU1IDEzLjcyNzkgMTguNjQ4OCAxMy4yNTkgMTkuMTEzOCAxMi45MjkzQzE5LjU3ODggMTIuNTk5NiAyMC4xMjQ0IDEyLjQyMzYgMjAuNjgzIDEyLjQyMzZDMjEuNDQxNSAxMi40MzExIDIyLjE2NjEgMTIuNzU5NyAyMi42OTc1IDEzLjMzN0MyMy4yMjg5IDEzLjkxNDQgMjMuNTIzNiAxNC42OTMzIDIzLjUxNjcgMTUuNTAyM1oiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#07101f" />
    <meta name="description" content="Python-free local audio model studio for audio.cpp" />
    <script>
      (() => {
        try {
          const savedTheme = localStorage.getItem('audiocpp.ui.theme') || 'system';
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const theme = savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'mocha' || savedTheme === 'paper'
            ? savedTheme
            : systemDark ? 'dark' : 'light';
          document.documentElement.dataset.theme = theme;
          document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content',
            theme === 'dark' ? '#07101f' : theme === 'mocha' ? '#1e1e2e' : theme === 'paper' ? '#f7f7f8' : '#f6f8fb'
          );
        } catch {
          document.documentElement.dataset.theme = 'dark';
        }
      })();
    <\/script>
    ` + head + '\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">' + body + "</div>\n  </body>\n</html>\n",
    error
  },
  version_hash: "1xyyov"
};
async function get_hooks() {
  let handle;
  let handleFetch;
  let handleError;
  let handleValidationError;
  let init;
  let reroute;
  let transport;
  return {
    handle,
    handleFetch,
    handleError,
    handleValidationError,
    init,
    reroute,
    transport
  };
}
export {
  set_public_env as a,
  set_read_implementation as b,
  set_manifest as c,
  get_hooks as g,
  options as o,
  public_env as p,
  read_implementation as r,
  set_private_env as s
};
