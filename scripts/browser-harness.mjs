#!/usr/bin/env node
/**
 * Build a standalone HTML page that mounts the REAL TraceMapView in a real browser.
 *
 * Every other test in this repo renders through `react-dom/server`, which means scroll
 * position, focus, clipboard, intervals and layout were never executed. This harness
 * bundles the plugin's built `lib/client.js` plus a minimal CommonJS loader for React 19
 * (which no longer ships UMD builds), so a real Chrome can drive the component.
 *
 * Deliberately NOT part of the smoke suite: it needs a browser.
 *   node scripts/browser-harness.mjs            # writes test/browser/harness.html
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

/**
 * CJS sources, keyed by the id our loader will resolve.
 *
 * `--prod` swaps in the PRODUCTION React builds. This matters more than it looks: the
 * development build adds prop validation and dev-only bookkeeping to every render, so a
 * component optimisation measured here can look like a big win and then lose in the real
 * host (DESIGN §13.07 — that mistake cost two shipped-then-reverted commits). Behaviour
 * gates should use the default dev build (it surfaces warnings); a PERFORMANCE number is
 * only worth anything with `--prod`, which is what the host actually ships.
 */
const PROD = process.argv.includes("--prod");
const MODULES = {
	react: `node_modules/react/cjs/react.${PROD ? "production" : "development"}.js`,
	"react/jsx-runtime": `node_modules/react/cjs/react-jsx-runtime.${PROD ? "production" : "development"}.js`,
	"react-dom": `node_modules/react-dom/cjs/react-dom.${PROD ? "production" : "development"}.js`,
	"react-dom/client": `node_modules/react-dom/cjs/react-dom-client.${PROD ? "production" : "development"}.js`,
	scheduler: `node_modules/scheduler/cjs/scheduler.${PROD ? "production" : "development"}.js`
};

/**
 * The host's REAL theme stylesheet, when the installed DSH can be found. It defines the
 * `--dsw-static-*` palette plus `body` / `body[data-ds-dark-theme]` alias blocks, so both
 * themes can be exercised faithfully. Without it the harness falls back to a handful of
 * hand-written light values — good enough for layout, not for judging dark contrast.
 */
function findHostThemeCss() {
	const npmRoot = process.env.DSH_THEME_CSS;
	const candidates = [
		npmRoot,
		"/Users/mison/.nvm/versions/node/v24.22.1/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/src/styles/design-platform.css"
	].filter(Boolean);
	for (const c of candidates) {
		try { if (fs.statSync(c).size > 0) return fs.readFileSync(c, "utf8"); } catch { /* next */ }
	}
	return null;
}
const hostThemeCss = findHostThemeCss();

const parts = [];
for (const [id, rel] of Object.entries(MODULES)) {
	const src = read(rel);
	parts.push(`/* ---- ${id} (${rel}) ---- */`);
	parts.push(`__define(${JSON.stringify(id)}, function (module, exports, require) {\n${src}\n});`);
}

const client = read("lib/client.js");
const fixture = read("test/browser/fixture.js");

const html = `<!doctype html>
<html lang="zh-CN" data-ds-dark-theme="false">
<head>
<meta charset="utf-8">
<title>TraceMapView harness</title>
<style>
	/* Stand-in for the host chrome, so the plugin's min-height / scroll containment is
	   measured against a realistic page rather than an empty one. */
	html, body { margin: 0; padding: 0; }
	/* The harness chrome follows the same theme attribute the host uses (on <body>), so a
	   dark run does not measure the plugin's near-white text against a white seat. */
	body { font: 13px/1.5 -apple-system, "PingFang SC", system-ui, sans-serif; background: var(--dsw-alias-bg-base, #f5f6f8); color: var(--dsw-alias-label-primary, #1b1f24); }
	#hostHead { height: 120px; background: #1b1f24; color: #fff; padding: 10px 16px; box-sizing: border-box; }
	#hostSidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 0; }
	#hostMain { padding: 12px 16px; box-sizing: border-box; }
	/* Host-shaped seat: the flex parent pins the box height, so a view taller than it MUST
	   scroll internally. Without this the harness can never reproduce that class of bug. */
	#viewArea { display: flex; overflow-y: hidden; overflow-x: hidden; height: calc(100vh - 235px); }
	#viewArea > #seat { display: contents; }
	html[data-layout="free"] #viewArea { display: block; height: auto; overflow: visible; }
	html[data-layout="free"] #viewArea > #seat { display: block; }
	#seat > * { min-width: 0; }
	#hostComposer { position: fixed; left: 0; right: 0; bottom: 0; height: 96px; background: var(--dsw-alias-bg-layer-2, #eef1f5); border-top: 1px solid var(--dsw-alias-border-l2, #cfd6df); padding: 10px 16px; box-sizing: border-box; }
	/* Host theme tokens: the real stylesheet when the installed DSH is readable,
	   otherwise a minimal light set (layout only, not dark-contrast evidence). */
	${hostThemeCss === null ? `:root {
		--dsw-alias-bg-layer-1: #ffffff; --dsw-alias-bg-layer-2: #f2f4f7;
		--dsw-alias-border-l2: #d8dee6; --dsw-alias-interactive-bg-hover: #edeff3;
		--dsw-alias-label-primary: #1b1f24; --dsw-alias-label-secondary: #5b6472;
		--dsw-alias-markdown-code-block: #f6f8fa;
	}` : hostThemeCss}
</style>
</head>
<body>
<div id="hostHead"><strong>host chrome</strong> (120px, stands in for the real header)</div>
<div id="hostMain">
  <!-- The host seats the view in a FLEX column with overflow:hidden and a fixed height.
       append ?layout=free to the URL for the old grow-with-content seating. -->
  <div id="viewArea"><div id="seat"></div></div>
  <div style="height: 2200px">（长页面，用于检验插件不会把整页无限撑高）</div>
</div>
<div id="hostComposer"><div class="composerSeat" style="height:100%;display:flex;align-items:center"><strong>host composer</strong> (96px, fixed; class="composerSeat" is what the plugin measures)</div></div>

<script>
/* ---- minimal CommonJS loader: React 19 has no UMD build ---- */
var process = { env: { NODE_ENV: "%%NODE_ENV%%" } };
(function () {
	var defs = Object.create(null), cache = Object.create(null);
	window.__define = function (id, fn) { defs[id] = fn; };
	window.require = function (id) {
		if (cache[id] !== void 0) return cache[id].exports;
		if (defs[id] === void 0) throw new Error("harness: unknown module " + id);
		var m = { exports: {} };
		cache[id] = m;
		defs[id](m, m.exports, window.require);
		return m.exports;
	};
})();
${parts.join("\n")}
/* ---- plugin module loader stand-in ---- */
window.__ModuleLoader__ = { load: function (entry) { window.__plugin = entry.factory(window.require); } };
</script>
<script>
${client}
</script>
<script>
${fixture}
</script>
</body>
</html>
`;

const out = path.join(root, "test/browser/harness.html");
// The template is a plain string; substitute the build mode once here so `--prod` cannot
// silently leave `process.env.NODE_ENV` at "development" (which makes React print the
// dev-only warnings and pick extra code paths even with the production bundle loaded).
fs.writeFileSync(out, html.split("%%NODE_ENV%%").join(PROD ? "production" : "development"));
console.log("browser-harness: wrote " + path.relative(root, out) + " (" + (html.length / 1024).toFixed(0) + " KB, host theme " +
	(hostThemeCss === null ? "FALLBACK light only" : "loaded from the installed DSH") +
	", React " + (PROD ? "production — usable for timing" : "development — behaviour only") + ")");
