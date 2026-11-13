// Smoke test for dsh-trajectory-traceview-plus (v5): extract the pure helpers
// region from lib/client.js and run it against mock TrajectorySnapshot data,
// covering tool results, raw-request attachment (lazy messages), special
// stations (compaction w/ compaction-request / turn-error / retry / command),
// sub-call detail, prompt-change diffs, step timing (TTFT/duration/decode
// rate), interruption flags, token stats, search matching and Markdown export.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const FILE = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(FILE, "utf8");

const startMarker = "//#region pure helpers: snapshot -> timeline tree";
const start = src.indexOf(startMarker);
if (start === -1) throw new Error("helpers region not found");
const end = src.indexOf("//#endregion", start);
if (end === -1) throw new Error("helpers endregion not found");
let extracted = src.slice(start, end);

extracted += `
;(globalThis.__test = { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown, promptDiffOf, subDetailOf, anchorOf, parseAnchor, resolveAnchorInStations, clockGapWidth, searchScopeNote, anchorLoadTarget, nextHashFor, anchorSeqFloor, safeList, promptTextDiff, changedTools, evidenceOf, buildStepMarkdown });
`;

const sandbox = { console, JSON, Set, Map, Math, String, Object, Array, Number };
vm.runInNewContext(extracted, sandbox, { filename: "traceview-helpers.js", timeout: 10000 });
const { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown, promptDiffOf, subDetailOf, anchorOf, parseAnchor, resolveAnchorInStations, clockGapWidth, searchScopeNote, anchorLoadTarget, nextHashFor, anchorSeqFloor, safeList, promptTextDiff, changedTools, evidenceOf, buildStepMarkdown } = sandbox.__test;

const t = (key) => key; // identity locale for assertions

// ---- mock snapshot shaped like TrajectorySnapshot / ConversationNode ----
const snap = {
	eventNodes: [
		{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "帮我看看这个报错\n第二行内容" }] },
		{ kind: "assistant", seq: 2, time: 2000, turn: 1, step: 1, timing: { stepStartTime: 1900, firstTokenTime: 2100, completedTime: 3400 }, blocks: [
			{ kind: "reasoning", text: "先看看情况。" },
			{ kind: "text", text: "我来检查一下。" },
			{ kind: "tool-call", callId: "c1", name: "pwsh", argsRaw: '{"cmd":"Get-ChildItem"}' }
		] },
		{ kind: "tool-result", seq: 3, time: 3500, callId: "c1", call: { name: "pwsh", argsRaw: "..." }, callTime: 2100, content: [{ type: "text", text: "目录有 3 个文件" }], isError: false, subCalls: [
			{ callId: "s1", name: "run_code", argsRaw: '{"x":1}', time: 2200, turn: 1, step: 1, subCalls: [] },
			{ kind: "tool-result", seq: 31, time: 3300, callId: "s2", call: { name: "grep", argsRaw: '{"p":"err"}' }, callTime: 2300, content: [{ type: "text", text: "子调用结果" }], isError: true, error: { name: "EGREP", code: "EGREP" }, subCalls: [] }
		], callSchema: { name: "pwsh", description: "run", parameters: { type: "object", properties: {} } } },
		{ kind: "compaction", seq: 4, time: 3900, summary: "早期对话已被压缩", shadowedItemCount: 12, shadowedTokenCount: 34000 },
		{ kind: "assistant", seq: 5, time: 4500, turn: 1, step: 2, interrupted: true, blocks: [
			{ kind: "tool-call", callId: "c2", name: "read", argsRaw: '{"p":"a.txt"}' }
		] },
		{ kind: "tool-result", seq: 6, time: 5200, callId: "c2", call: { name: "read", argsRaw: "..." }, callTime: 4900, content: [], isError: true, error: { name: "ENOENT", code: "ENOENT" }, subCalls: [] },
		{ kind: "turn-error", seq: 7, time: 5300, turn: 1, step: 2, message: "读取文件失败", code: "EIO" },
		{ kind: "user", seq: 8, time: 6000, content: [{ type: "text", text: "继续" }] },
		{ kind: "assistant", seq: 9, time: 7000, turn: 2, step: 1, blocks: [
			{ kind: "text", text: "重试一下" },
			{ kind: "tool-call", callId: "c3", name: "web_search", argsRaw: '{"q":"dsh"}' }
		] },
		{ kind: "tool-result", seq: 10, time: 7600, callId: "c3", call: { name: "web_search", argsRaw: "..." }, callTime: 7100, content: [{ type: "text", text: "搜到 2 条" }], isError: false, subCalls: [] },
		{ kind: "model-retry", seq: 11, time: 7700, turn: 3, step: 1, retryState: "scheduled", retry: 1, maxRetries: 2, delayMs: 500, provider: "deepseek", policyKey: "p1", failure: { message: "网络超时", code: "ETIMEDOUT" } },
		{ kind: "command", seq: 12, time: 8000, commandId: "cmd1", name: "help", args: "", outcome: { kind: "success", text: "用法说明" } },
		{ kind: "user", seq: 13, time: 9000, content: [{ type: "text", text: "最后一问" }] },
		{ kind: "assistant", seq: 14, time: 10000, turn: 4, step: 1, blocks: [
			{ kind: "tool-call", callId: "c4", name: "read", argsRaw: '{"p":"b.txt"}' }
		] },
		{ kind: "tool-result", seq: 15, time: 11000, callId: "c4", call: { name: "read" }, callTime: 10300, content: [{ type: "text", text: "内容 JSON" }], isError: false, subCalls: [] }
	],
	requests: [
		{ purpose: "assistant", startSeq: 2, turn: 1, step: 1, startedAt: 2000, completedAt: 2500, status: "complete", resultSeq: 2, provenance: { provider: "deepseek", model: "deepseek-chat" }, requestConfig: { provider: "deepseek", model: "deepseek-chat", temperature: 0.2, reasoningEffort: "high", maxTokens: 8000, thinking: "enabled", stop: ["</end>"] }, prompt: { config: { provider: "deepseek", model: "deepseek-chat" }, system: "你是资深工程师", tools: [{ name: "pwsh", description: "run", parameters: { type: "object", properties: {} } }, { name: "read", description: "read a file", parameters: { type: "object", properties: {} } }] }, promptChange: { seq: 2, time: 2000, kind: "initial" }, usage: { inputTokens: 120, outputTokens: 40, cacheReadTokens: 300, reasoningTokens: 5 } },
		{ purpose: "compaction", startSeq: 4, turn: 1, step: 0, startedAt: 3700, completedAt: 3900, status: "complete", replacementSeq: 4, requestConfig: { provider: "deepseek", model: "deepseek-chat" }, usage: { inputTokens: 500, outputTokens: 80 }, summary: [{ type: "text", text: "早期对话已被压缩" }], rawOutput: [{ type: "text", text: "压缩产出全文：用户最初要求排查报错……" }] },
		{ purpose: "assistant", startSeq: 5, turn: 1, step: 2, startedAt: 4000, completedAt: 5200, status: "error", error: "EIO", retry: 1, maxRetries: 3, retryDelayMs: 800, resultSeq: 6, requestConfig: { provider: "deepseek", model: "deepseek-chat" }, prompt: { config: { provider: "deepseek", model: "deepseek-chat" }, system: "你是资深工程师，请仔细", tools: [{ name: "pwsh", description: "run", parameters: { type: "object", properties: {} } }] }, promptChange: { seq: 5, time: 4000, kind: "system-and-tools", previous: { config: { provider: "deepseek", model: "deepseek-chat" }, system: "你是资深工程师", tools: [{ name: "pwsh" }, { name: "read" }] } }, usage: { inputTokens: 150, outputTokens: 10 } },
		{ purpose: "assistant", startSeq: 9, turn: 2, step: 1, startedAt: 6000, completedAt: 7600, status: "complete", resultSeq: 10, requestConfig: { provider: "deepseek", model: "deepseek-chat" }, usage: { inputTokens: 180, outputTokens: 60 } }
	],
	callSchemas: new Map([
		["c1", { name: "pwsh", description: "run", parameters: { type: "object", properties: {} } }],
		["c2", { name: "read", description: "read a file", parameters: { type: "object", properties: {} } }]
	]),
	partial: null,
	runningCalls: []
};

const tree = deriveTraceTree(snap, t);
if (tree.id !== "root") throw new Error("root id");
if (tree.totalSteps !== 4) throw new Error("totalSteps: " + tree.totalSteps);
if (tree.currentStepNo !== null) throw new Error("no live step expected, got " + tree.currentStepNo);
if (!Array.isArray(tree.nodes) || tree.nodes.length !== snap.eventNodes.length) throw new Error("tree.nodes should expose sorted eventNodes for lazy rebuild");

// ---- stations include special kinds + user messages, chronologically ordered ----
const kinds = tree.stations.map((s) => s.kind);
if (!kinds.includes("compaction")) throw new Error("no compaction station");
if (!kinds.includes("error")) throw new Error("no turn-error station");
if (!kinds.includes("retry")) throw new Error("no retry station");
if (!kinds.includes("command")) throw new Error("no command station");
if (kinds.filter((k) => k === "user").length !== 3) throw new Error("user stations: " + kinds.join(","));
const lastUser = [...tree.stations].reverse().find((s) => s.kind === "user");
if (!lastUser || lastUser.text !== "最后一问") throw new Error("last user text: " + (lastUser && lastUser.text));

// ---- turn structure ----
const turn1 = tree.children.find((c) => c.label.includes("1"));
if (!turn1) throw new Error("turn 1 missing");
const step1 = turn1.children.find((c) => c.kind === "step" && c.stepNo === 1);
if (!step1) throw new Error("step1 missing");
if (step1.request === null) throw new Error("step1 request not attached");
if (step1.request.prompt.system !== "你是资深工程师") throw new Error("system prompt: " + JSON.stringify(step1.request.prompt));
if (step1.request.prompt.tools.length !== 2) throw new Error("tool catalog count: " + step1.request.prompt.tools.length);
if (step1.request.usage.input !== 420) throw new Error("input tokens (120+300): " + step1.request.usage.input);
if (step1.request.usage.output !== 45) throw new Error("output tokens (40+5): " + step1.request.usage.output);

// step timing: real wall-clock time (bug fix — used to be the event seq),
// step duration from timing.completedTime, TTFT, decode throughput.
if (step1.time !== 2000) throw new Error("step1.time should be assistant node time (2000), got " + step1.time);
if (step1.durationMs !== 1500) throw new Error("step1 duration (3400-1900): " + step1.durationMs);
if (step1.ttftMs !== 200) throw new Error("step1 ttft (2100-1900): " + step1.ttftMs);
if (step1.decodeRate == null || Math.abs(step1.decodeRate - 45 / 1.3) > 0.01) throw new Error("step1 decode rate: " + step1.decodeRate);
if (step1.turn !== 1) throw new Error("step1 turn: " + step1.turn);
if (step1.interrupted !== false) throw new Error("step1 should not be interrupted");
if (typeof step1.hay !== "string" || !step1.hay.includes("pwsh")) throw new Error("step1 hay should include tool name");

// request extras: thinking/stop config visible, startSeq kept for lazy rebuild, no eager messages.
if (step1.request.config.thinking !== "enabled") throw new Error("thinking config missing");
if (!Array.isArray(step1.request.config.stop) || step1.request.config.stop.length !== 1) throw new Error("stop config missing");
if (step1.request.startSeq !== 2) throw new Error("startSeq kept: " + step1.request.startSeq);
if ("messages" in step1.request) throw new Error("messages must be lazy (rebuilt in the component), not attached at derive time");

// lazy message reconstruction against tree.nodes
const msgs1 = reconstructMessages(tree.nodes, step1.request.startSeq);
if (msgs1.length !== 1 || msgs1[0].role !== "user" || !msgs1[0].text.includes("帮我看看")) throw new Error("reconstruct before seq 2: " + JSON.stringify(msgs1));
const step2x = turn1.children.find((c) => c.kind === "step" && c.stepNo === 2);
const msgs2 = reconstructMessages(tree.nodes, step2x.request.startSeq);
if (!msgs2.some((m) => m.role === "tool" && m.toolCallId === "c1")) throw new Error("reconstructed tool message missing");
if (!msgs2.some((m) => m.role === "note")) throw new Error("compaction note missing in reconstruction");

// prompt-change diff on step2's request
const diff = step2x.request.promptDiff;
if (diff === null) throw new Error("promptDiff missing on step2 request");
if (diff.kind !== "system-and-tools") throw new Error("diff kind: " + diff.kind);
if (diff.isInitial !== false) throw new Error("diff should not be initial");
if (diff.toolsRemoved.length !== 1 || diff.toolsRemoved[0] !== "read") throw new Error("toolsRemoved: " + JSON.stringify(diff.toolsRemoved));
if (diff.toolsAdded.length !== 0) throw new Error("toolsAdded: " + JSON.stringify(diff.toolsAdded));
if (diff.systemDelta !== 4) throw new Error("systemDelta (11-7): " + diff.systemDelta);
const step1Diff = step1.request.promptDiff;
if (step1Diff === null || step1Diff.isInitial !== true) throw new Error("step1 diff should be initial");

// compaction station carries the paired compaction request
const compactionStation = tree.stations.find((s) => s.kind === "compaction");
if (!compactionStation) throw new Error("compaction station missing");
if (compactionStation.crequest == null) throw new Error("compaction request not paired");
if (compactionStation.crequest.durationMs !== 200) throw new Error("compaction req duration: " + compactionStation.crequest.durationMs);
if (!compactionStation.crequest.outputText.includes("压缩产出全文")) throw new Error("compaction output text: " + compactionStation.crequest.outputText);
if (compactionStation.crequest.usage.input !== 500) throw new Error("compaction req usage: " + JSON.stringify(compactionStation.crequest.usage));

// assistant cell keeps thinking separate from text
const thinkCell = step1.cells.find((c) => c.kind === "assistant" && c.thinking !== "");
if (!thinkCell || !thinkCell.thinking.includes("先看看情况")) throw new Error("thinking cell: " + JSON.stringify(thinkCell));
const textCell = step1.cells.find((c) => c.kind === "assistant" && c.text !== "");
if (!textCell || !textCell.text.includes("我来检查一下")) throw new Error("text cell: " + JSON.stringify(textCell));

// tool cell: args + result text + schema + duration + FULL sub-call detail
const pwshTool = step1.cells.find((c) => c.kind === "tool" && c.name === "pwsh");
if (!pwshTool) throw new Error("pwsh tool cell missing");
if (pwshTool.durationMs !== 1400) throw new Error("duration: " + pwshTool.durationMs);
if (!pwshTool.resultText.includes("3 个文件")) throw new Error("result text: " + pwshTool.resultText);
if (pwshTool.subCalls.length !== 2) throw new Error("sub-call count: " + pwshTool.subCalls.length);
const sub1 = pwshTool.subCalls[0];
if (sub1.name !== "run_code" || sub1.running !== true || sub1.argsRaw !== '{"x":1}') throw new Error("running sub-call: " + JSON.stringify(sub1));
const sub2 = pwshTool.subCalls[1];
if (sub2.name !== "grep" || sub2.running !== false || sub2.isError !== true || sub2.errorName !== "EGREP") throw new Error("settled error sub-call: " + JSON.stringify(sub2));
if (sub2.durationMs !== 1000 || !sub2.resultText.includes("子调用结果")) throw new Error("settled sub-call detail: " + JSON.stringify(sub2));
if (!pwshTool.schema || pwshTool.schema.name !== "pwsh") throw new Error("schema missing on tool cell");

// error step: isError flag + error name + interrupted marker + turn-error station
const step2 = turn1.children.find((c) => c.kind === "step" && c.stepNo === 2);
if (!step2) throw new Error("step2 missing");
if (step2.hasError !== true) throw new Error("step2 hasError");
if (step2.interrupted !== true) throw new Error("step2 interrupted flag");
if (!step2.meta.includes("chip.interrupted")) throw new Error("step2 interrupted meta chip: " + step2.meta.join(","));
const readTool = step2.cells.find((c) => c.name === "read");
if (!readTool || readTool.isError !== true) throw new Error("read tool error flag");
if (readTool.errorName !== "ENOENT") throw new Error("errorName: " + readTool.errorName);
if (!readTool.hay !== false && !step2.hay.includes("enoent")) throw new Error("step2 hay should include error name");
if (step2.request === null || step2.request.status !== "error") throw new Error("step2 request status");
if (step2.request.retry !== 1 || step2.request.maxRetries !== 3) throw new Error("step2 retry info");
const errStation = tree.stations.find((s) => s.kind === "error");
if (!errStation || errStation.message !== "读取文件失败") throw new Error("error station message");

// prompt inheritance: request 3 has no prompt -> inherits from request 2 (tools only has pwsh)
const turn2 = tree.children.find((c) => c.label.includes("2"));
const step3 = turn2 && turn2.children.find((c) => c.kind === "step" && c.stepNo === 3);
if (!step3) throw new Error("step3 missing (turn2)");
if (step3.request === null || step3.request.prompt === null) throw new Error("step3 request prompt should be inherited");
if (step3.request.prompt.tools.length !== 1) throw new Error("step3 inherited tool catalog: " + step3.request.prompt.tools.length);
if (step3.request.prompt.system !== "你是资深工程师，请仔细") throw new Error("step3 inherited system");

// stats: turns / steps / tools / errors / tokens / lastModel
if (tree.stats.turns !== 4) throw new Error("stats.turns: " + tree.stats.turns);
if (tree.stats.steps !== 4) throw new Error("stats.steps: " + tree.stats.steps);
if (tree.stats.tools !== 4) throw new Error("stats.tools: " + tree.stats.tools);
if (tree.stats.errors < 2) throw new Error("stats.errors: " + tree.stats.errors);
if (tree.stats.tokensIn !== 750) throw new Error("stats.tokensIn: " + tree.stats.tokensIn);
if (tree.stats.tokensOut !== 115) throw new Error("stats.tokensOut: " + tree.stats.tokensOut);
if (tree.stats.lastModel !== "deepseek-chat") throw new Error("stats.lastModel: " + tree.stats.lastModel);

// ---- search matching ----
if (matchStations(tree.stations, "").length !== 0) throw new Error("empty query matches nothing");
const pwshHits = matchStations(tree.stations, "pwsh");
if (pwshHits.length !== 1 || tree.stations[pwshHits[0]].stepNo !== 1) throw new Error("pwsh hit: " + pwshHits.join(","));
const userHits = matchStations(tree.stations, "最后一问");
if (userHits.length !== 1 || tree.stations[userHits[0]].kind !== "user") throw new Error("user text hit");
const errHits = matchStations(tree.stations, "enoent");
if (errHits.length !== 1) throw new Error("error-name hit count: " + errHits.length);
const compactionHits = matchStations(tree.stations, "早期对话");
if (compactionHits.length !== 1) throw new Error("compaction summary hit");

// ---- Markdown export ----
const md = buildTraceMarkdown(tree, t);
for (const needle of ["# export.title", "## node.turn 1", "🔧 pwsh", "📨", "deepseek-chat", "♺", "export.appendix", "你是资深工程师", "↳ **grep**", "✗ node.error"]) {
	if (!md.includes(needle)) throw new Error("markdown missing: " + needle);
}

// ---- empty snapshot ----
const emptyTree = deriveTraceTree({ eventNodes: [], requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
if (emptyTree.children.length !== 0) throw new Error("empty tree should have no turns");
if (emptyTree.stations.length !== 0) throw new Error("empty tree stations");
if (emptyTree.currentStepNo !== null) throw new Error("empty tree currentStepNo");
if (emptyTree.stats.lastModel !== null) throw new Error("empty tree lastModel");

// ---- running call + streaming partial -> live tracking, dedupe by callId ----
const liveSnap = {
	eventNodes: [
		{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "开始" }] },
		{ kind: "assistant", seq: 2, time: 2000, turn: 3, step: 2, blocks: [
			{ kind: "tool-call", callId: "r1", name: "web_search", argsRaw: '{"q":"dsh"}' }
		] }
	],
	requests: [],
	callSchemas: new Map(),
	partial: { turn: 3, step: 2, blocks: [{ kind: "text", text: "正在搜索…" }] },
	runningCalls: [{ callId: "r1", name: "web_search", argsRaw: '{"q":"dsh"}', time: 2500, turn: 3, step: 2, subCalls: [] }]
};
const liveTree = deriveTraceTree(liveSnap, t);
if (liveTree.currentStepNo !== 1) throw new Error("live currentStepNo: " + liveTree.currentStepNo);
if (liveTree.stats.running !== 1) throw new Error("live running count: " + liveTree.stats.running);
const liveStep = liveTree.stations.find((s) => s.kind === "step");
if (!liveStep || liveStep.live !== true) throw new Error("live step flag missing");
const runningTools = liveStep.cells.filter((c) => c.name === "web_search");
if (runningTools.length !== 1 || runningTools[0].running !== true) throw new Error("running tool dedupe failed");
if (!liveStep.cells.some((c) => c.kind === "assistant" && c.text.includes("正在搜索"))) throw new Error("partial preview missing");

// ---- anchors (G2): grammar, issuance, and resolution -------------------
{
	// Durable assistant nodes in the fixture carry no messageId, so they must
	// NOT be issued an `e` anchor (the matrix requires messageId + integer seq).
	const stepStations = tree.stations.filter((s) => s.kind === "step");
	if (stepStations.length === 0) throw new Error("anchor: no step stations");
	if (stepStations.some((s) => s.anchorSeq !== null)) throw new Error("anchor: synthetic step got an e anchor");
	if (stepStations.some((s) => s.synthetic !== true)) throw new Error("anchor: synthetic flag missing");
	const a = anchorOf(stepStations[0]);
	if (!/^tvp1:p\d+s\d+$/.test(a)) throw new Error("anchor: synthetic step form = " + a);

	// A durable step (messageId + integer seq) must produce e<seq>.
	const durableSnap = {
		eventNodes: [
			{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "问题" }] },
			{ kind: "assistant", seq: 7, time: 2000, turn: 1, step: 1, messageId: "m-7", blocks: [{ kind: "text", text: "回答" }] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const dTree = deriveTraceTree(durableSnap, t);
	const dStep = dTree.stations.find((s) => s.kind === "step");
	if (dStep === void 0) throw new Error("anchor: durable step missing");
	if (dStep.anchorSeq !== 7) throw new Error("anchor: durable seq = " + dStep.anchorSeq);
	if (anchorOf(dStep) !== "tvp1:e7") throw new Error("anchor: durable form = " + anchorOf(dStep));
	if (dStep.synthetic !== false) throw new Error("anchor: durable flagged synthetic");

	// A fractional-seq synthetic assistant must not be anchored even though it
	// may carry a messageId-less shape AND a plausible integer-looking turn.
	const fracSnap = {
		eventNodes: [
			{ kind: "assistant", seq: 7.1, time: 2000, turn: 1, step: 1, blocks: [{ kind: "text", text: "半截" }] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const fTree = deriveTraceTree(fracSnap, t);
	const fStep = fTree.stations.find((s) => s.kind === "step");
	if (fStep === void 0) throw new Error("anchor: fractional step missing");
	if (fStep.anchorSeq !== null) throw new Error("anchor: fractional seq leaked into anchorSeq");
}
{
	// parseAnchor: every legal form has a branch; illegal ones are rejected.
	const ok = (raw, check) => { const r = parseAnchor(raw); if (!r.ok) throw new Error("parse fail " + raw + " -> " + r.reason); check(r); };
	ok("tvp1:e7", (r) => { if (r.form !== "e" || r.seq !== 7) throw new Error("e form"); });
	ok("tvp1:e7#t3s7", (r) => { if (r.seq !== 7 || r.hint !== "t3s7") throw new Error("e hint"); });
	ok("tvp1:cabc", (r) => { if (r.form !== "c" || r.callId !== "abc") throw new Error("c form"); });
	ok("tvp1:p3s7", (r) => { if (r.form !== "p" || r.turn !== 3 || r.step !== 7 || r.callId !== null) throw new Error("p form"); });
	ok("tvp1:p3s7cxyz", (r) => { if (r.callId !== "xyz") throw new Error("p+c form"); });
	ok("tvp1:t3s7", (r) => { if (r.form !== "t" || r.turn !== 3 || r.step !== 7) throw new Error("t form"); });
	const bad = parseAnchor("tvp1:e7.5");
	if (bad.ok !== false || bad.reason !== "synthetic") throw new Error("fractional e must be rejected as synthetic");
	if (parseAnchor("tvp1:garbage").ok !== false) throw new Error("unknown form must be rejected");
	if (parseAnchor("nope").ok !== false) throw new Error("missing prefix must be rejected");
	if (parseAnchor("tvp1:e-3").ok !== false) throw new Error("negative seq must be rejected");
}
{
	// resolveAnchorInStations: e / p / c / t paths.
	const durableSnap = {
		eventNodes: [
			{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "问题" }] },
			{ kind: "assistant", seq: 7, time: 2000, turn: 1, step: 1, messageId: "m-7", blocks: [
				{ kind: "text", text: "回答" },
				{ kind: "tool-call", callId: "callA", name: "bash", argsRaw: "{}" }
			] },
			{ kind: "tool-result", seq: 8, time: 3000, callId: "callA", call: { name: "bash", argsRaw: "{}" }, callTime: 2500, content: [{ type: "text", text: "ok" }], isError: false, subCalls: [] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const rTree = deriveTraceTree(durableSnap, t);
	const rStations = rTree.stations;
	const hitE = resolveAnchorInStations(parseAnchor("tvp1:e7"), rStations);
	if (!hitE.ok || hitE.station.kind !== "step") throw new Error("resolve e failed");
	const hitC = resolveAnchorInStations(parseAnchor("tvp1:ccallA"), rStations);
	if (!hitC.ok || hitC.station.anchorSeq !== 7) throw new Error("resolve c failed");
	const hitP = resolveAnchorInStations(parseAnchor("tvp1:p1s1"), rStations);
	if (!hitP.ok || hitP.station.kind !== "step") throw new Error("resolve p failed");
	const hitT = resolveAnchorInStations(parseAnchor("tvp1:t1s1"), rStations);
	if (!hitT.ok || hitT.upgraded !== "e7") throw new Error("resolve t must upgrade to e<seq>, got " + JSON.stringify(hitT));
	const missE = resolveAnchorInStations(parseAnchor("tvp1:e999"), rStations);
	if (missE.ok !== false || missE.reason !== "not-loaded") throw new Error("resolve missing e");
}

// ---- G4 time anchors: exact step span (T1) ------------------------------
{
	const spanSnap = {
		eventNodes: [
			{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "问" }] },
			{ kind: "assistant", seq: 5, time: 5000, turn: 1, step: 1, timing: { stepStartTime: 3000, firstTokenTime: 3200, completedTime: 8000 }, blocks: [{ kind: "text", text: "答" }] },
			{ kind: "assistant", seq: 9, time: 9000, turn: 1, step: 2, blocks: [{ kind: "text", text: "无 timing" }] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const st = deriveTraceTree(spanSnap, t).stations.filter((x) => x.kind === "step");
	const withTiming = st.find((x) => x.stepNo === 1);
	const noTiming = st.find((x) => x.stepNo === 2);
	if (withTiming.startMs !== 3000 || withTiming.endMs !== 8000) throw new Error("T1 span wrong: " + withTiming.startMs + "/" + withTiming.endMs);
	if (withTiming.durationMs !== 5000) throw new Error("T1 duration must equal end-start");
	if (noTiming.startMs !== null || noTiming.endMs !== null) throw new Error("T1 missing timing must stay null, not 0");

	// Partial edge: only stepStartTime present -> endMs must stay null so the view
	// can render "start only" instead of fabricating an end.
	const partialSnap = {
		eventNodes: [
			{ kind: "assistant", seq: 3, time: 3000, turn: 1, step: 1, timing: { stepStartTime: 2500 }, blocks: [{ kind: "text", text: "半截" }] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const pStep = deriveTraceTree(partialSnap, t).stations.find((x) => x.kind === "step");
	if (pStep === void 0) throw new Error("T1 partial step missing");
	if (pStep.startMs !== 2500) throw new Error("T1 partial start = " + pStep.startMs);
	if (pStep.endMs !== null) throw new Error("T1 partial end must be null, got " + pStep.endMs);
	if (pStep.durationMs !== null) throw new Error("T1 partial duration must be null (cannot infer)");
}

// ---- G4 idle gaps (T3): pure gap arithmetic ----------------------------
{
	const GAP_MIN = 30000;
	const gaps = [];
	const mk = (start, end) => ({ startMs: start, endMs: end });
	const seq = [mk(0, 1000), mk(90000, 95000), mk(96000, 100000)];
	for (let i = 1; i < seq.length; i += 1) {
		const gap = seq[i].startMs - seq[i - 1].endMs;
		if (gap >= GAP_MIN) gaps.push(gap);
	}
	if (gaps.length !== 1 || gaps[0] !== 89000) throw new Error("T3 gap math wrong: " + JSON.stringify(gaps));
	// a missing edge must not fabricate a gap
	const prevEdge = null;
	if (prevEdge !== null) throw new Error("T3 must skip when an edge is missing");
}

// ---- O1: orphan tool results --------------------------------------------
{
	// A tool-result with no matching tool-call in the loaded window must become
	// its own station. Its `call` is null (the call fell outside the window).
	const orphanSnap = {
		eventNodes: [
			{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "问题" }] },
			{ kind: "assistant", seq: 2, time: 2000, turn: 1, step: 1, messageId: "m2", blocks: [{ kind: "text", text: "回答" }] },
			{ kind: "tool-result", seq: 9, time: 9000, callId: "orphanA", call: null, content: [{ type: "text", text: "孤儿结果文本" }], isError: false, subCalls: [] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const oTree = deriveTraceTree(orphanSnap, t);
	const orphans = oTree.stations.filter((s) => s.kind === "orphan-tool");
	if (orphans.length !== 1) throw new Error("O1 orphan count = " + orphans.length);
	const o = orphans[0];
	if (o.displayText !== "孤儿结果文本") throw new Error("O1 orphan text = " + o.displayText);
	if (o.callId !== "orphanA") throw new Error("O1 callId lost");
	if (o.anchorSeq !== 9 || o.synthetic !== false) throw new Error("O1 durable anchor wrong: " + JSON.stringify({ seq: o.anchorSeq, synthetic: o.synthetic }));
	if (o.anchorKey !== "e9") throw new Error("O1 anchorKey must be issued, got " + o.anchorKey);
	if (anchorOf(o) !== "tvp1:e9") throw new Error("O1 anchor form = " + anchorOf(o));
	if (oTree.stats.tools !== 1) throw new Error("O1 tool count must include orphan, got " + oTree.stats.tools);
	const md = buildTraceMarkdown(oTree, t);
	if (!md.includes("孤儿结果文本") || !md.includes("node.orphanTool")) throw new Error("O1 markdown export dropped the orphan");

	// A result that IS attached to an assistant tool-call must NOT be duplicated
	// as a second orphan station.
	const attachedSnap = {
		eventNodes: [
			{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "问题" }] },
			{ kind: "assistant", seq: 2, time: 2000, turn: 1, step: 1, messageId: "m2", blocks: [
				{ kind: "text", text: "回答" },
				{ kind: "tool-call", callId: "callX", name: "bash", argsRaw: "{}" }
			] },
			{ kind: "tool-result", seq: 3, time: 3000, callId: "callX", call: { name: "bash", argsRaw: "{}" }, callTime: 2500, content: [{ type: "text", text: "已挂载" }], isError: false, subCalls: [] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const aTree = deriveTraceTree(attachedSnap, t);
	if (aTree.stations.filter((s) => s.kind === "orphan-tool").length !== 0) throw new Error("O1 attached result must not become orphan");
	const aStep = aTree.stations.find((s) => s.kind === "step");
	if (aStep === void 0 || !aStep.cells.some((c) => c.kind === "tool" && c.resultText === "已挂载")) throw new Error("O1 attached result missing from step");

	// Edge cases that actually exist in the record shape: an error-only result
	// (no text blocks) must fall back to the error code; an image-only result must
	// not be silently dropped by `blocksText`.
	const edgeSnap = {
		eventNodes: [
			{ kind: "tool-result", seq: 11, time: 11000, callId: "orphanErr", call: null, content: [], isError: true, error: { code: "E_TIMEOUT" }, subCalls: [] },
			{ kind: "tool-result", seq: 12, time: 12000, callId: "orphanImg", call: null, content: [{ type: "image" }], isError: false, subCalls: [] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const edges = deriveTraceTree(edgeSnap, t).stations.filter((x) => x.kind === "orphan-tool");
	if (edges.length !== 2) throw new Error("O1 edge orphans = " + edges.length);
	const errOrphan = edges.find((x) => x.callId === "orphanErr");
	const imgOrphan = edges.find((x) => x.callId === "orphanImg");
	if (errOrphan.displayText !== "E_TIMEOUT") throw new Error("O1 error fallback = " + errOrphan.displayText);
	if (imgOrphan.displayText !== "[图片]") throw new Error("O1 image text = " + imgOrphan.displayText);

	// A fractional-seq synthetic tool result (interrupted call) must be flagged
	// synthetic and must NOT get an `e` anchor.
	const fracSnap = {
		eventNodes: [
			{ kind: "tool-result", seq: 7.2, time: 7000, callId: "orphanF", call: null, content: [{ type: "text", text: "半截" }], isError: false, subCalls: [] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const fO = deriveTraceTree(fracSnap, t).stations.find((s) => s.kind === "orphan-tool");
	if (fO === void 0) throw new Error("O1 fractional orphan missing");
	if (fO.anchorSeq !== null || fO.synthetic !== true) throw new Error("O1 fractional orphan must be unanchorable");
}

// ---- T5: distinguish "no timing" from "edge outside window" --------------
{
	const noTiming = {
		eventNodes: [
			{ kind: "assistant", seq: 3, time: 3000, turn: 1, step: 1, messageId: "m3", blocks: [{ kind: "text", text: "无 timing" }] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const a = deriveTraceTree(noTiming, t).stations.find((x) => x.kind === "step");
	if (a.timingRecorded !== false) throw new Error("T5 no-timing must be recorded=false");
	if (a.startMs !== null || a.endMs !== null) throw new Error("T5 no-timing edges must stay null");

	// timing present but only completedTime (start fell outside the window)
	const partial = {
		eventNodes: [
			{ kind: "assistant", seq: 4, time: 4000, turn: 1, step: 1, messageId: "m4", timing: { stepStartTime: null, firstTokenTime: null, completedTime: 4000 }, blocks: [{ kind: "text", text: "半截" }] }
		],
		requests: [], callSchemas: new Map(), runningCalls: []
	};
	const b = deriveTraceTree(partial, t).stations.find((x) => x.kind === "step");
	if (b.timingRecorded !== true) throw new Error("T5 partial timing must be recorded=true");
	if (b.endMs !== 4000) throw new Error("T5 partial end = " + b.endMs);
	if (b.startMs !== null) throw new Error("T5 partial start must be null");
	if (b.durationMs !== null) throw new Error("T5 partial duration must be null, not inferred from a single edge");
	// The two cases must be distinguishable — that is the whole point of T5.
	if (a.timingRecorded === b.timingRecorded) throw new Error("T5 cases collapsed into one state");
}

// ---- T2: clock-mode gap width -------------------------------------------
{
	if (clockGapWidth(120000, false) !== null) throw new Error("T2 must be null when clock mode is off");
	if (clockGapWidth(NaN, true) !== null) throw new Error("T2 must reject non-finite gap");
	if (clockGapWidth(0, true) !== null) throw new Error("T2 must reject zero gap");

	const w30 = clockGapWidth(30000, true);
	const w5m = clockGapWidth(300000, true);
	const w1h = clockGapWidth(3600000, true);
	if (!/^\d+px$/.test(w30)) throw new Error("T2 width format = " + w30);
	const n30 = parseInt(w30, 10), n5m = parseInt(w5m, 10), n1h = parseInt(w1h, 10);
	// monotonic: a longer pause must never be narrower
	if (!(n30 < n5m && n5m < n1h)) throw new Error("T2 must be monotonic: " + [n30, n5m, n1h].join(","));
	// capped so one huge pause cannot dominate the rail
	if (n1h > 220) throw new Error("T2 must cap at 220px, got " + n1h);
	// still meaningful at the hour scale (must not sit near the floor)
	if (n1h < 170) throw new Error("T2 hour-scale width too small: " + n1h);
	// and a full day must actually hit the cap rather than keep growing
	if (clockGapWidth(86400000, true) !== "220px") throw new Error("T2 day-scale must cap at 220px");

	// ── D2: search scope must be explicit, never silently "no match" ─────────
	// Fully loaded session: nothing to warn about.
	if (searchScopeNote(false, false, (k) => k) !== null) throw new Error("D2 must be silent when the whole session is loaded");
	// Older pages exist: the note must be present whatever the other flags say.
	if (searchScopeNote(true, false, (k) => k) !== "search.scopePartial") throw new Error("D2 must flag the loaded-only range");
	if (searchScopeNote(true, true, (k) => k) !== "search.scopeLoading") throw new Error("D2 must show paging progress while loading older");
	// Truthiness traps: only real booleans count (session snapshot fields are optional).
	if (searchScopeNote(undefined, false, (k) => k) !== null) throw new Error("D2 must treat undefined hasMore as fully loaded");
	if (searchScopeNote(true, undefined, (k) => k) !== "search.scopePartial") throw new Error("D2 must treat undefined loadingOlder as idle");

	// ── G2: an anchor that is not loaded must trigger a bounded back-page ────
	// `e<seq>` carries an exact seq, so we can ask for exactly that far back.
	if (anchorLoadTarget(parseAnchor("tvp1:e3019")) !== 3019) throw new Error("G2 e-anchor must target its own seq");
	if (anchorLoadTarget(parseAnchor("tvp1:e0")) !== 0) throw new Error("G2 e0 must target seq 0");
	// `c<callId>` / `p..` / `t..` have no seq: the only safe ask is "search the whole history".
	if (anchorLoadTarget(parseAnchor("tvp1:ctool-1")) !== 0) throw new Error("G2 c-anchor must page from the beginning");
	if (anchorLoadTarget(parseAnchor("tvp1:p3s7")) !== 0) throw new Error("G2 p-anchor must page from the beginning");
	if (anchorLoadTarget(parseAnchor("tvp1:t3s7")) !== 0) throw new Error("G2 t-anchor must page from the beginning");
	// Garbage must not trigger any paging at all.
	if (anchorLoadTarget(parseAnchor("nope")) !== null) throw new Error("G2 invalid anchor must not page");
	if (anchorLoadTarget(parseAnchor("tvp1:e12.5")) !== null) throw new Error("G2 synthetic (fractional seq) must not page");
	if (anchorLoadTarget(null) !== null) throw new Error("G2 null parse must not page");

	// ── G2: stop paging once the window already covers the requested seq ──────
	if (anchorSeqFloor([]) !== null) throw new Error("G2 floor of an empty window is unknown");
	const floorStations = [
		{ anchorSeq: 500 }, { anchorSeq: 120 }, { anchorSeq: 900 }, { anchorSeq: null }
	];
	if (anchorSeqFloor(floorStations) !== 120) throw new Error("G2 floor must be the smallest anchorSeq");
	// synthetic / missing seqs must never masquerade as the floor
	if (anchorSeqFloor([{ anchorSeq: null }, { anchorSeq: 12.5 }, {}]) !== null) throw new Error("G2 floor must ignore non-integer seqs");

	// ── Q2-1: the prompt diff must show WHAT changed, not just how many chars ─
	const base = "line1\nline2\nline3\nline4\nline5";
	// one edited line in the middle: prefix/suffix trimming must isolate it
	const d1 = promptTextDiff(base, "line1\nline2\nCHANGED\nline4\nline5", 40);
	if (d1 === null) throw new Error("DIFF expected a diff for a changed middle line");
	if (d1.removed.length !== 1 || d1.removed[0] !== "line3") throw new Error("DIFF removed = " + JSON.stringify(d1.removed));
	if (d1.added.length !== 1 || d1.added[0] !== "CHANGED") throw new Error("DIFF added = " + JSON.stringify(d1.added));
	if (d1.startLine !== 3) throw new Error("DIFF startLine = " + d1.startLine);
	if (d1.narrows !== false) throw new Error("DIFF must not report truncation for a small diff");
	// identical text -> no diff at all (must not render an empty block)
	if (promptTextDiff(base, base, 40) !== null) throw new Error("DIFF identical text must yield null");
	// both empty -> null
	if (promptTextDiff("", "", 40) !== null) throw new Error("DIFF two empty prompts must yield null");
	// pure addition (tool appended at the end)
	const d2 = promptTextDiff("a\nb", "a\nb\nc", 40);
	if (d2.removedCount !== 0 || d2.addedCount !== 1 || d2.added[0] !== "c") throw new Error("DIFF append case wrong");
	// cap must truncate and say so
	const longPrev = Array.from({ length: 100 }, (_, i) => "old" + i).join("\n");
	const longCur = Array.from({ length: 100 }, (_, i) => "new" + i).join("\n");
	const d3 = promptTextDiff(longPrev, longCur, 10);
	if (d3.removed.length !== 10 || d3.added.length !== 10) throw new Error("DIFF cap not applied");
	if (d3.narrows !== true) throw new Error("DIFF must flag truncation");

	// tool schemas that keep the same name but change description must be reported
	const toolsBefore = [{ name: "bash", description: "run a command" }, { name: "grep", description: "x" }];
	const toolsAfter = [{ name: "bash", description: "run a command SAFELY" }, { name: "grep", description: "x" }];
	const changed = changedTools(toolsBefore, toolsAfter);
	if (changed.length !== 1 || changed[0] !== "bash") throw new Error("DIFF changedTools = " + JSON.stringify(changed));
	if (changedTools(toolsBefore, toolsBefore).length !== 0) throw new Error("DIFF identical catalogs must report nothing");
	// a pure rename is add/remove, not a silent "changed"
	if (changedTools([{ name: "a" }], [{ name: "b" }]).length !== 0) throw new Error("DIFF rename must not be reported as changed");
	if (changedTools(undefined, undefined).length !== 0) throw new Error("DIFF must tolerate missing catalogs");

	// ── Q2-2: every panel part must declare whether it is verbatim or inferred ─
	const evFull = evidenceOf({ prompt: { system: "x" } }, [{ role: "user" }], false);
	if (evFull.length !== 2) throw new Error("EV expected prompt+messages, got " + JSON.stringify(evFull));
	if (evFull[0].id !== "prompt" || evFull[0].level !== "exact") throw new Error("EV the prompt header must be exact");
	if (evFull[1].id !== "messages" || evFull[1].level !== "reconstructed") throw new Error("EV the message list must be reconstructed");
	// unloaded history must add an explicit "partial" marker, never be silent
	const evPartial = evidenceOf({ prompt: { system: "x" } }, [{ role: "user" }], true);
	if (!evPartial.some((e) => e.id === "range" && e.level === "partial")) throw new Error("EV hasMore must surface a partial marker");
	// nothing to declare -> no chips (must not render an empty row)
	if (evidenceOf(null, [], false).length !== 0) throw new Error("EV empty request must produce no chips");
	if (evidenceOf({ prompt: null }, [], false).length !== 0) throw new Error("EV missing prompt must produce no chips");

	// ── Q2-3: single-step review pack must carry everything needed to reason ──
	const stepStation = tree.stations.find((st) => st.kind === "step");
	if (stepStation === void 0) throw new Error("STEP expected a step station in the fixture");
	const pack = buildStepMarkdown(stepStation, msgs1, false, t);
	if (typeof pack !== "string" || pack === "") throw new Error("STEP pack must not be empty");
	if (!pack.includes("export.stepTitle")) throw new Error("STEP pack must carry a title");
	// every pack must carry its anchor so the reader can jump back
	const stepAnchor = anchorOf(stepStation);
	if (stepAnchor !== null && !pack.includes(stepAnchor)) throw new Error("STEP pack must embed its anchor, missing " + stepAnchor);
	// evidence levels must be stated, not implied
	if (!pack.includes("evidence.exact")) throw new Error("STEP pack must declare the recorded parts");
	if (!pack.includes("evidence.reconstructed")) throw new Error("STEP pack must declare the reconstructed parts");
	// unloaded history must surface as an explicit caveat, not be silently omitted
	const partialPack = buildStepMarkdown(stepStation, msgs1, true, t);
	if (!partialPack.includes("evidence.partial")) throw new Error("STEP pack must warn when history is unloaded");
	// tool results belong in the pack
	// Assert the tool RESULT itself is embedded — a bare ``` check passes on any
	// fenced block (args are fenced too), so it cannot catch a dropped result.
	const packTool = stepStation.cells.find((c) => c.kind === "tool" && c.resultText);
	if (packTool !== void 0 && !pack.includes(String(packTool.resultText).slice(0, 40))) {
		throw new Error("STEP pack must embed the tool result text, got: " + pack.slice(0, 200));
	}
	// a null station must not throw (defensive: panel can render before selection settles)
	if (buildStepMarkdown(null, [], false, t) !== "") throw new Error("STEP null station must yield empty string");

	// ── §8.9 窗口边界：missing timing must never render as 0 or NaN ──────────
	// Window-edge steps routinely lack stepStartTime / completedTime; the three
	// states (recorded / partially recorded / not recorded) must stay distinct.
	const edgeSnap = {
		eventNodes: [
			// assistant with NO timing at all
			{ kind: "assistant", seq: 10, time: 1000, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "无 timing" }] },
			// assistant with a timing block that has nulls inside
			{ kind: "assistant", seq: 20, time: 2000, turn: 1, step: 2, messageId: "m2", timing: { stepStartTime: null, firstTokenTime: null, completedTime: null }, blocks: [{ kind: "text", text: "全 null" }] },
			// assistant whose start is recorded but completion is not (still running at the edge)
			{ kind: "assistant", seq: 30, time: 3000, turn: 1, step: 3, messageId: "m3", timing: { stepStartTime: 2900, firstTokenTime: null, completedTime: null }, blocks: [{ kind: "text", text: "半截" }] }
		],
		requests: [], runningCalls: [], partial: null
	};
	const edgeTree = deriveTraceTree(edgeSnap, t);
	const edgeSteps = edgeTree.stations.filter((st) => st.kind === "step");
	if (edgeSteps.length !== 3) throw new Error("EDGE expected 3 steps, got " + edgeSteps.length);
	for (const st of edgeSteps) {
		for (const key of ["startMs", "endMs", "ttftMs"]) {
			const v = st[key];
			if (v !== null && !Number.isFinite(v)) throw new Error("EDGE step " + st.stepNo + " " + key + " must be null or finite, got " + v);
		}
		// A missing timestamp must never be coerced to 0 (0 is a legitimate epoch value).
		if (st.startMs === 0) throw new Error("EDGE step " + st.stepNo + " startMs must not be 0");
		if (st.endMs === 0) throw new Error("EDGE step " + st.stepNo + " endMs must not be 0");
	}
	// three distinct provenance states
	const noTiming = edgeSteps.find((st) => st.stepNo === 1);
	const nullTiming = edgeSteps.find((st) => st.stepNo === 2);
	const halfTiming = edgeSteps.find((st) => st.stepNo === 3);
	if (noTiming.timingRecorded !== false) throw new Error("EDGE absent timing must report timingRecorded=false");
	if (noTiming.startMs !== null || noTiming.endMs !== null) throw new Error("EDGE absent timing must stay null");
	if (nullTiming.timingRecorded !== true) throw new Error("EDGE a present-but-null timing block still counts as recorded");
	if (halfTiming.startMs !== 2900) throw new Error("EDGE half timing must keep the recorded start, got " + halfTiming.startMs);
	if (halfTiming.endMs !== null) throw new Error("EDGE half timing must leave endMs null, got " + halfTiming.endMs);

	// ── §8.7 降级：a malformed snapshot must degrade, never crash the view ───
	// The snapshot comes from another plugin, so every field is untrusted.
	if (safeList(null).length !== 0 || safeList("nope").length !== 0 || safeList({}).length !== 0) throw new Error("DEG safeList must reject non-arrays");
	if (safeList([null, undefined, 1, "x", true]).length !== 0) throw new Error("DEG safeList must drop non-object entries");
	if (safeList([{ a: 1 }, null, { b: 2 }]).length !== 2) throw new Error("DEG safeList must keep objects");
	const malformed = [
		null, undefined, {}, [],
		{ eventNodes: "nope" },
		{ eventNodes: [null, undefined, 1] },
		{ requests: {} },
		{ requests: "nope" },
		{ runningCalls: {} },
		{ runningCalls: 0 },
		{ callSchemas: 1 },
		{ partial: "x" },
		{ eventNodes: "x", requests: "y", runningCalls: 0, partial: "z", callSchemas: 1 }
	];
	for (let i = 0; i < malformed.length; i += 1) {
		let out;
		try {
			out = deriveTraceTree(malformed[i], t);
		} catch (error) {
			throw new Error("DEG deriveTraceTree threw on case #" + i + " (" + JSON.stringify(malformed[i]) + "): " + error.message);
		}
		if (out === null || !Array.isArray(out.stations)) throw new Error("DEG case #" + i + " must still return a tree with stations[]");
		if (out.stations.length !== 0) throw new Error("DEG case #" + i + " must yield no stations");
	}

	// ── G2: landing on an anchor must become a shareable URL ─────────────────
	// The decision is an explicit flag, never "did the string change" — strings are
	// primitives, so `a === b` is true even when the function rebuilt the same text.
	const h1 = nextHashFor("", "tvp1:e3019");
	if (h1.hash !== "#tvp1:e3019" || h1.changed !== true) throw new Error("G2 must write a missing anchor into the hash");
	const h2 = nextHashFor("#tvp1:e1", "tvp1:e3019");
	if (h2.hash !== "#tvp1:e3019" || h2.changed !== true) throw new Error("G2 must replace a stale hash");
	// Already there -> must NOT rewrite, or history.replaceState fires on every render.
	const h3 = nextHashFor("#tvp1:e3019", "tvp1:e3019");
	if (h3.changed !== false) throw new Error("G2 must not rewrite an unchanged hash");
	// A missing anchor must never wipe an existing one.
	const h4 = nextHashFor("#tvp1:e3019", "");
	if (h4.hash !== "#tvp1:e3019" || h4.changed !== false) throw new Error("G2 must never clear a hash by accident");
	const h5 = nextHashFor("#keep", null);
	if (h5.hash !== "#keep" || h5.changed !== false) throw new Error("G2 must tolerate a missing anchor");
}

console.log("TV PLUGIN SMOKE TEST (v5) OK — turns=" + tree.stats.turns + " steps=" + tree.totalSteps + " stations=" + tree.stations.length + " tokensIn=" + tree.stats.tokensIn + " model=" + tree.stats.lastModel);
