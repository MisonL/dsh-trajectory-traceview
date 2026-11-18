#!/usr/bin/env node
/**
 * Assemble lib/client.js from src/*.js.
 *
 * The browser artifact must be ONE classic script that calls
 * `window.__ModuleLoader__.load({ id, factory })` — the DSH client module system
 * fetches that file directly and does not resolve nested imports for it. Shipping
 * several files would therefore break the served plugin, so the maintainable
 * sources live in src/ and this script concatenates them into the single file the
 * host actually serves.
 *
 * The sections share one closure scope on purpose: they reference each other's
 * bindings directly (e.g. the view uses helpers, the entry point uses both). That
 * is what makes a naive split into real ES modules unsafe here.
 *
 * Usage:
 *   node scripts/build-client.mjs           # write lib/client.js
 *   node scripts/build-client.mjs --check   # fail if lib/client.js is stale
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib", "client.js");

/** Order matters: every section may use bindings declared above it. */
const SECTIONS = [
	"src/00-locale.js",
	"src/10-styles.js",
	"src/20-fields.js",
	"src/30-helpers.js",
	"src/40-view.js",
	"src/50-entry.js",
];

const HEADER = `window.__ModuleLoader__.load({
\tid: "dsh-trajectory-traceview-plus",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tlet react_jsx_runtime = require("react/jsx-runtime");
\t\tlet react = require("react");
\t\tconst jsx = react_jsx_runtime.jsx;
\t\tconst jsxs = react_jsx_runtime.jsxs;
\t\tconst fragment = react.Fragment;
`;

/**
 * The component-level test hook sits between the view and the entry point. It must
 * stay inside the closure (it needs `TraceMapView`) but outside every region so the
 * smoke test can slice regions without dragging the global write along.
 */
const TEST_HOOK = `
\t\t// Test hook: lets the smoke test render the real component. Guarded so it is
\t\t// inert unless a harness asks for it; it exposes nothing to the host runtime.
\t\tif (typeof globalThis === "object" && globalThis !== null && globalThis.__DTSV_TEST__ === true) {
\t\t\tglobalThis.__testComponent = { TraceMapView };
\t\t}
`;

const FOOTER = `\t\treturn module.exports;
\t}
});
`;

function build() {
	const pieces = [HEADER];
	for (let i = 0; i < SECTIONS.length; i += 1) {
		const rel = SECTIONS[i];
		const file = path.join(ROOT, rel);
		if (!fs.existsSync(file)) throw new Error(`missing source section: ${rel}`);
		let body = fs.readFileSync(file, "utf8");
		// Normalise the trailing newline so the assembly is deterministic.
		body = body.replace(/\n+$/, "");
		pieces.push(`\n${body}\n`);
		if (rel === "src/40-view.js") pieces.push(TEST_HOOK);
	}
	pieces.push(FOOTER);
	return pieces.join("");
}

const built = build();

if (process.argv.includes("--check")) {
	const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
	if (current !== built) {
		console.error("build-client: lib/client.js is stale — run `node scripts/build-client.mjs`");
		process.exit(1);
	}
	console.log("build-client: lib/client.js matches src/");
} else {
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, built);
	console.log(`build-client: wrote ${path.relative(ROOT, OUT)} (${built.split("\n").length} lines)`);
}
