
import root from '../root.js';
import { set_building, set_prerendering } from '$app/env/internal';
import { set_assets } from '$app/paths/internal/server';
import { set_manifest, set_read_implementation } from '__sveltekit/server';
import { set_private_env, set_public_env } from '../../../node_modules/@sveltejs/kit/src/runtime/shared-server.js';
import error from '../shared/error-template.js';

export const options = {
	app_template_contains_nonce: false,
	async: false,
	csp: {"mode":"auto","directives":{"upgrade-insecure-requests":false,"block-all-mixed-content":false},"reportOnly":{"upgrade-insecure-requests":false,"block-all-mixed-content":false}},
	csrf_check_origin: true,
	csrf_trusted_origins: [],
	embedded: false,
	env_public_prefix: 'PUBLIC_',
	env_private_prefix: '',
	hash_routing: true,
	hooks: null, // added lazily, via `get_hooks`
	preload_strategy: "modulepreload",
	root,
	service_worker: false,
	service_worker_options: undefined,
	server_error_boundaries: false,
	templates: {
		app: ({ head, body, assets, nonce, env }) => "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <!-- Inline static/logo_cloud.svg so the embedded UI has a tab icon before JavaScript loads. -->\n    <link rel=\"icon\" type=\"image/svg+xml\" sizes=\"any\" href=\"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggb3BhY2l0eT0iMC43OTciIGQ9Ik0xNyAwQzIwLjM2MjMgMCAyMy42NDkgMC45OTcwMzIgMjYuNDQ0NyAyLjg2NTAyQzI5LjI0MDcgNC43MzMgMzEuNDE5MyA3LjM4ODAzIDMyLjcwNTkgMTAuNDk0NEMzMy45OTI2IDEzLjYwMDcgMzQuMzI5MyAxNy4wMTg5IDMzLjY3MzMgMjAuMzE2NUMzMy4wMTc0IDIzLjYxNDIgMzEuMzk4MyAyNi42NDMzIDI5LjAyMDggMjkuMDIwOEMyNi42NDMzIDMxLjM5ODMgMjMuNjE0MiAzMy4wMTc0IDIwLjMxNjUgMzMuNjczM0MxNy4wMTg5IDM0LjMyOTMgMTMuNjAwNyAzMy45OTI2IDEwLjQ5NDQgMzIuNzA1OUM3LjM4ODAzIDMxLjQxOTMgNC43MzMgMjkuMjQwNyAyLjg2NTAyIDI2LjQ0NDdDMC45OTcwMzIgMjMuNjQ5MSAwIDIwLjM2MjMgMCAxN0MwIDEyLjQ5MTMgMS43OTEwNyA4LjE2NzIzIDQuOTc5MTggNC45NzkxOEM4LjE2NzIzIDEuNzkxMDcgMTIuNDkxMyAwIDE3IDBaIiBmaWxsPSIjNTlBOUVGIi8+CjxwYXRoIGQ9Ik0xNy4wMzk2IDI1LjA2NTlDMTMuNTcxNiAyMy44OTggMTAuNzc3OCAyMS4yMjA1IDEwLjc2NjYgMTcuMzcwNkMxMC43NDU0IDExLjA4ODUgMTUuNDIzNSA4LjU3NDIzIDE5LjQwMzcgOC41QzE5LjQwMzcgOC41IDE0LjY2MzkgOC43MjY2NiAxMy4wMjg3IDEzLjUyMTJDMTEuNzM1OCAxNy4zMDg1IDE0LjU0MzggMjAuMTU3IDE1LjMyMTYgMjAuNzQxN0MxNy42MDAxIDIyLjQ2NjEgMjAuNjA1OSAyMi40OTg0IDIyLjAzNSAyMi4yMDk0QzIyLjk0NSAyMi4wMjYzIDIyLjkxMjYgMjEuNjIxNyAyMi45MTI2IDIxLjYyMTdWMjUuMTI2QzIyLjkxMjYgMjUuMTI2IDE5LjgzMDMgMjYuMDA3NyAxNy4wMzk2IDI1LjA2NTlaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjMuNTE2NyAxNS41MDIzQzIzLjUwNjQgMTYuMDk3OCAyMy4zMzE1IDE2LjY3NjggMjMuMDEzOSAxNy4xNjY2QzIyLjY5NjUgMTcuNjU2NCAyMi4yNTAxIDE4LjAzNSAyMS43MzEzIDE4LjI1NTVDMjEuMjEyMiAxOC40NzU4IDIwLjY0NDYgMTguNTI3OCAyMC4wOTgxIDE4LjQwNDlDMTkuNTUxNiAxOC4yODIgMTkuMDUxNiAxNy45ODk3IDE4LjY2MDUgMTcuNTY0OEMxOC4yNjk0IDE3LjEzOTcgMTguMDA0MSAxNi42MDEgMTcuODk5NCAxNi4wMTZDMTcuNzk0NSAxNS40MzEyIDE3Ljg1MzggMTQuODI2MiAxOC4wNjk1IDE0LjI3N0MxOC4yODU1IDEzLjcyNzkgMTguNjQ4OCAxMy4yNTkgMTkuMTEzOCAxMi45MjkzQzE5LjU3ODggMTIuNTk5NiAyMC4xMjQ0IDEyLjQyMzYgMjAuNjgzIDEyLjQyMzZDMjEuNDQxNSAxMi40MzExIDIyLjE2NjEgMTIuNzU5NyAyMi42OTc1IDEzLjMzN0MyMy4yMjg5IDEzLjkxNDQgMjMuNTIzNiAxNC42OTMzIDIzLjUxNjcgMTUuNTAyM1oiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <meta name=\"theme-color\" content=\"#07101f\" />\n    <meta name=\"description\" content=\"Python-free local audio model studio for audio.cpp\" />\n    <script>\n      (() => {\n        try {\n          const savedTheme = localStorage.getItem('audiocpp.ui.theme') || 'system';\n          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;\n          const theme = savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'mocha' || savedTheme === 'paper'\n            ? savedTheme\n            : systemDark ? 'dark' : 'light';\n          document.documentElement.dataset.theme = theme;\n          document.querySelector('meta[name=\"theme-color\"]')?.setAttribute(\n            'content',\n            theme === 'dark' ? '#07101f' : theme === 'mocha' ? '#1e1e2e' : theme === 'paper' ? '#f7f7f8' : '#f6f8fb'\n          );\n        } catch {\n          document.documentElement.dataset.theme = 'dark';\n        }\n      })();\n    </script>\n    " + head + "\n  </head>\n  <body data-sveltekit-preload-data=\"hover\">\n    <div style=\"display: contents\">" + body + "</div>\n  </body>\n</html>\n",
		error
	},
	version_hash: "1xyyov"
};

export async function get_hooks() {
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

export { set_assets, set_building, set_manifest, set_prerendering, set_private_env, set_public_env, set_read_implementation };
