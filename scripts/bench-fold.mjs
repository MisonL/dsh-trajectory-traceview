/**
 * Benchmark the pure fold that the streaming path repeats: `deriveTraceTree(snapshot)`.
 *
 * Why this exists: DESIGN §13.07 says React-build mode decides whether a component
 * optimisation wins, so the only honest way to size the streaming path is to measure the
 * part that is NOT React at all. The view rebuilds the whole tree every STREAM_REBUILD_MS
 * (120ms) while a reply is streaming (`src/40-view.js` streamTick), and each rebuild
 * allocates a fresh object per station — which is also why memoisation never helps there.
 *
 * This measures that fold alone, in plain Node, with a snapshot the same shape the host
 * hands the view. No React, no browser, no dev-vs-prod variance.
 *
 *   node scripts/bench-fold.mjs [--stations 135] [--iters 40]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "lib", "client.js"), "utf8");

const startMarker = "//#region pure helpers: snapshot -> timeline tree";
const start = src.indexOf(startMarker);
if (start === -1) throw new Error("helpers region not found");
const end = src.indexOf("//#endregion", start);
if (end === -1) throw new Error("helpers endregion not found");

const sandbox = {
	console,
	JSON,
	Set,
	Map,
	WeakSet,
	Math,
	String,
	Object,
	Array,
	Number,
	Date,
	RegExp,
};
vm.runInNewContext(
	src.slice(start, end) + "\n;(globalThis.__test = { deriveTraceTree });",
	sandbox,
	{ filename: "traceview-helpers.js", timeout: 10_000 },
);
const { deriveTraceTree } = sandbox.__test;

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const at = args.indexOf(`--${name}`);
	return at >= 0 && args[at + 1] !== void 0 ? Number(args[at + 1]) : fallback;
};
const wantStations = opt("stations", 135);
const iters = opt("iters", 40);

/** A snapshot shaped like the host's: alternating user turn + assistant step with a tool. */
function buildSnapshot(turns) {
	const nodes = [];
	const requests = [];
	const base = Date.UTC(2026, 10, 20, 2, 0, 0);
	let seq = 0;
	for (let turnNo = 1; turnNo <= turns; turnNo += 1) {
		nodes.push({ kind: "user", seq: ++seq, time: base + turnNo * 10_000, turn: turnNo, content: [{ type: "text", text: `第 ${turnNo} 轮的问题` }] });
		nodes.push({
			kind: "assistant",
			seq: ++seq,
			time: base + turnNo * 10_000 + 800,
			turn: turnNo,
			step: 1,
			messageId: `m${turnNo}`,
			blocks: [
				{ kind: "reasoning", text: `第 ${turnNo} 轮先想一想。` },
				{ kind: "text", text: `第 ${turnNo} 轮的回答正文。` },
				{ kind: "tool-call", callId: `c${turnNo}`, name: "pwsh", argsRaw: `{"cmd":"step-${turnNo}"}` },
			],
		});
		nodes.push({
			kind: "tool-result",
			seq: ++seq,
			time: base + turnNo * 10_000 + 2600,
			turn: turnNo,
			step: 1,
			callId: `c${turnNo}`,
			callTime: base + turnNo * 10_000 + 900,
			name: "pwsh",
			content: [{ type: "text", text: `第 ${turnNo} 轮的工具输出` }],
			isError: false,
		});
		requests.push({
			purpose: "assistant",
			turn: turnNo,
			step: 1,
			status: "ok",
			startSeq: seq - 2,
			startedAt: base + turnNo * 10_000,
			completedAt: base + turnNo * 10_000 + 2900,
			requestConfig: { model: "deepseek-chat", provider: "deepseek" },
			usage: { input: 120 + turnNo, output: 40 + turnNo },
			prompt: { system: "你是助手。", tools: [{ name: "pwsh", description: "run" }] },
		});
	}
	return {
		eventNodes: nodes,
		requests,
		callSchemas: {},
		runningCalls: [],
		partial: null,
	};
}

const t = (key) => key;

// Grow the snapshot until it reaches roughly the station count we want (3 nodes per turn).
let turns = Math.max(4, Math.round(wantStations / 3));
let snap = buildSnapshot(turns);
let stations = deriveTraceTree(snap, t).stations.length;
while (stations < wantStations && turns < 400) {
	turns += 4;
	snap = buildSnapshot(turns);
	stations = deriveTraceTree(snap, t).stations.length;
}

const samples = [];
for (let i = 0; i < iters; i += 1) {
	const t0 = performance.now();
	deriveTraceTree(snap, t);
	samples.push(performance.now() - t0);
}
samples.sort((a, b) => a - b);
const at = (q) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))];
const ms = (x) => Math.round(x * 100) / 100;

const median = at(0.5);
const perSec = Math.round(1000 / median);
console.log(
	`bench-fold: stations=${stations} nodes=${snap.eventNodes.length} iters=${iters} ` +
		`median=${ms(median)}ms p90=${ms(at(0.9))}ms max=${ms(samples[samples.length - 1])}ms ` +
		`(≈${perSec}/s; the stream rebuilds at ${120}ms intervals, so this fold uses ≈${Math.round((median / 120) * 100)}% of one core while streaming)`,
);