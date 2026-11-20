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

/** CJS sources, keyed by the id our loader will resolve. */
const MODULES = {
	react: "node_modules/react/cjs/react.development.js",
	"react/jsx-runtime": "node_modules/react/cjs/react-jsx-runtime.development.js",
	"react-dom": "node_modules/react-dom/cjs/react-dom.development.js",
	"react-dom/client": "node_modules/react-dom/cjs/react-dom-client.development.js",
	scheduler: "node_modules/scheduler/cjs/scheduler.development.js"
};

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
	body { font: 13px/1.5 -apple-system, "PingFang SC", system-ui, sans-serif; background: #f5f6f8; }
	#hostHead { height: 120px; background: #1b1f24; color: #fff; padding: 10px 16px; box-sizing: border-box; }
	#hostSidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 0; }
	#hostMain { padding: 12px 16px; box-sizing: border-box; }
	#seat { border: 1px dashed #b3bac4; border-radius: 8px; background: #fff; margin-bottom: 12px; }
	#hostComposer { position: fixed; left: 0; right: 0; bottom: 0; height: 96px; background: #eef1f5; border-top: 1px solid #cfd6df; padding: 10px 16px; box-sizing: border-box; }
	/* The host's real token names (design-platform.css). Light values; the dark set is
	   flipped by renderTheme(). */
	:root {
		--dsw-alias-bg-layer-1: #ffffff; --dsw-alias-bg-layer-2: #f2f4f7;
		--dsw-alias-border-l2: #d8dee6; --dsw-alias-interactive-bg-hover: #edeff3;
		--dsw-alias-label-primary: #1b1f24; --dsw-alias-label-secondary: #5b6472;
		--dsw-alias-markdown-code-block: #f6f8fa;
	}
</style>
</head>
<body>
<div id="hostHead"><strong>host chrome</strong> (120px, stands in for the real header)</div>
<div id="hostMain"><div id="seat"></div><div style="height: 2200px">（长页面，用于检验插件不会把整页无限撑高）</div></div>
<div id="hostComposer"><div class="composerSeat" style="height:100%;display:flex;align-items:center"><strong>host composer</strong> (96px, fixed; class="composerSeat" is what the plugin measures)</div></div>

<script>
/* ---- minimal CommonJS loader: React 19 has no UMD build ---- */
var process = { env: { NODE_ENV: "development" } };
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
fs.writeFileSync(out, html);
console.log("browser-harness: wrote " + path.relative(root, out) + " (" + (html.length / 1024).toFixed(0) + " KB)");
