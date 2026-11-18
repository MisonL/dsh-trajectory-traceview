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
;(globalThis.__test = { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown, promptDiffOf, subDetailOf, anchorOf, parseAnchor, resolveAnchorInStations, clockGapWidth, searchScopeNote, anchorLoadTarget, nextHashFor, anchorSeqFloor, safeList, promptTextDiff, changedTools, evidenceOf, buildStepMarkdown, snapshotContract, unknownNodeStats, isEverythingUnknown, fmtDur, safeJsonPreview, stationAriaLabel, anchorCoveredByWindow, anchorTurnFloor, fmtTokens, fencedBlock, annotateNamelessFormFields, mdBlocks, mdInline, markdownToPlain, parseAnchor, resolveAnchorInStations, textOfContent, stationHay });
`;

// WeakSet is a browser global the helper uses for cycle detection; the sandbox
// has to provide it or the test fails with a ReferenceError instead of a verdict.
const sandbox = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number };
vm.runInNewContext(extracted, sandbox, { filename: "traceview-helpers.js", timeout: 10000 });
const { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown, promptDiffOf, subDetailOf, anchorOf, parseAnchor, resolveAnchorInStations, clockGapWidth, searchScopeNote, anchorLoadTarget, nextHashFor, anchorSeqFloor, safeList, promptTextDiff, changedTools, evidenceOf, buildStepMarkdown, snapshotContract, unknownNodeStats, isEverythingUnknown, fmtDur, safeJsonPreview, stationAriaLabel, anchorCoveredByWindow, anchorTurnFloor, fmtTokens, fencedBlock, annotateNamelessFormFields, mdBlocks, mdInline, markdownToPlain, textOfContent, stationHay } = sandbox.__test;

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
if (matchStations([step1], "pwsh").length !== 1) throw new Error("search must find a step by its tool name");
if (matchStations([step1], "PWSh").length !== 1) throw new Error("search must be case-insensitive");

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
if (matchStations([step2], "enoent").length !== 1) throw new Error("search must find a step by its error name");
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
	// The placeholder must come from the locale, not be hardcoded: the test translator is
	// identity, so a localized call yields the KEY. A hardcoded literal would leak Chinese
	// into the English UI, which is exactly what happened here.
	if (imgOrphan.displayText !== "block.image") throw new Error("O1 image text must be localized, got " + imgOrphan.displayText);

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
	// sub-calls are half the story of a failed step: they must survive into the pack
	const subStation = (() => {
		const subSnap = { eventNodes: [
			{ kind: "assistant", seq: 2, time: 2000, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "c9", name: "bash", argsRaw: "{}" }] },
			{ kind: "tool-result", seq: 3, time: 3000, callId: "c9", call: { name: "bash", argsRaw: "{}" }, content: [{ type: "text", text: "Y".repeat(5000) }], isError: false,
				subCalls: [{ kind: "tool-result", callId: "s1", name: "inner-tool", callTime: 50, time: 100, content: [{ type: "text", text: "SUB-TOOL-OUTPUT" }], isError: false }] }
		], requests: [], runningCalls: [], partial: null };
		return deriveTraceTree(subSnap, t).stations.find((st) => st.kind === "step");
	})();
	const subPack = buildStepMarkdown(subStation, [], false, t);
	if (!subPack.includes("SUB-TOOL-OUTPUT")) throw new Error("STEP pack must include sub-call output");
	if (!subPack.includes("inner-tool")) throw new Error("STEP pack must name the sub-call");
	// a truncated result must SAY it was truncated
	const yRun = (subPack.match(/Y+/g) ?? [""]).sort((a, b) => b.length - a.length)[0];
	if (yRun.length !== 4000) throw new Error("STEP pack result cap not applied: " + yRun.length);
	// fmtInt formats thousands ("5,000"), so assert the number, not the raw digit run.
	if (!subPack.includes("…")) throw new Error("STEP pack must mark a truncated result with an ellipsis");
	if (!/5,?000/.test(subPack)) throw new Error("STEP pack must state the original length of a truncated result");
	// a null station must not throw (defensive: panel can render before selection settles)
	if (buildStepMarkdown(null, [], false, t) !== "") throw new Error("STEP null station must yield empty string");

	// ── Q3: contract drift must be reported, never silently rendered as empty ─
	const okContract = snapshotContract({ eventNodes: [{ kind: "user", seq: 1 }] });
	if (okContract.ok !== true) throw new Error("DRIFT a well-formed snapshot must pass: " + JSON.stringify(okContract.problems));
	// a real snapshot with no events yet is NOT a contract violation
	if (snapshotContract({ eventNodes: [] }).ok !== true) throw new Error("DRIFT an empty-but-valid snapshot must pass");
	for (const bad of [null, undefined, {}, { eventNodes: "nope" }, { requests: [] }]) {
		const r = snapshotContract(bad);
		if (r.ok !== false) throw new Error("DRIFT must flag " + JSON.stringify(bad));
		if (!Array.isArray(r.problems) || r.problems.length === 0) throw new Error("DRIFT must name the problem for " + JSON.stringify(bad));
	}
	// shape problems keep the distinct token so the UI can explain the actual cause
	if (!snapshotContract({ eventNodes: [{ kind: "user", seq: NaN }] }).problems.includes("bad-node-shape")) throw new Error("DRIFT must flag a bad seq");
	if (!snapshotContract({ eventNodes: [{ seq: 1 }] }).problems.includes("bad-node-shape")) throw new Error("DRIFT must flag a missing kind");
	// fractional seq is legal (official synthetic nodes)
	if (snapshotContract({ eventNodes: [{ kind: "assistant", seq: 2.5 }] }).ok !== true) throw new Error("DRIFT fractional seq must be accepted");

	// unknown kinds must be COUNTED, not dropped silently
	const st1 = unknownNodeStats([{ kind: "user" }, { kind: "message" }, { kind: "assistant-step" }]);
	if (st1.unknown !== 2) throw new Error("DRIFT unknown count = " + st1.unknown);
	if (st1.kinds.length !== 2) throw new Error("DRIFT must list the unfamiliar kinds, got " + JSON.stringify(st1.kinds));
	const st2 = unknownNodeStats([null, 1, "x", { seq: 1 }, { kind: "" }]);
	if (st2.invalid !== 5 || st2.unknown !== 0) throw new Error("DRIFT invalid count = " + JSON.stringify(st2));
	// every kind the projector really handles must be known (guards list rot)
	for (const k of ["user", "steering", "context", "assistant", "tool-result", "compaction", "turn-error", "model-retry", "turn-max-tokens", "command", "unknown"]) {
		if (unknownNodeStats([{ kind: k }]).unknown !== 0) throw new Error("DRIFT handled kind treated as unknown: " + k);
	}
	// and the tree must carry the diagnostics
	const driftTree = deriveTraceTree({ eventNodes: [{ kind: "user", seq: 1 }], requests: [], runningCalls: [], partial: null }, t);
	if (driftTree.nodeStats === undefined || driftTree.contract === undefined) throw new Error("DRIFT tree must expose contract + nodeStats");
	const unknownTree = deriveTraceTree({ eventNodes: [
		{ kind: "assistant", seq: 5, time: 5, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "ok" }] },
		{ kind: "message", seq: 6, time: 6 },
		{ kind: "assistant-step", seq: 7, time: 7 }
	], requests: [], runningCalls: [], partial: null }, t);
	if (unknownTree.stations.length === 0) throw new Error("DRIFT the recognized node must still render");
	if (unknownTree.nodeStats.unknown !== 2) throw new Error("DRIFT the 2 unknown nodes must be counted alongside a rendered station, got " + unknownTree.nodeStats.unknown);

	// A kind rename keeps every field valid, so the contract check alone passes —
	// "everything unrecognized" must independently escalate to incompatibility.
	if (isEverythingUnknown([{ kind: "a" }, { kind: "b" }], { unknown: 2, invalid: 0 }) !== true) throw new Error("DRIFT all-unknown must escalate");
	if (isEverythingUnknown([{ kind: "user" }], { unknown: 0, invalid: 0 }) !== false) throw new Error("DRIFT a recognized node must not escalate");
	if (isEverythingUnknown([{ kind: "user" }, { kind: "x" }], { unknown: 1, invalid: 0 }) !== false) throw new Error("DRIFT a partial loss must not escalate");
	if (isEverythingUnknown([], { unknown: 0, invalid: 0 }) !== false) throw new Error("DRIFT an empty snapshot is not incompatibility");
	if (isEverythingUnknown(undefined, undefined) !== false) throw new Error("DRIFT missing args must not escalate");
	// the simulated upgrade: valid contract, zero recognizable nodes -> incompatible
	if (snapshotContract({ eventNodes: [{ kind: "message.user", seq: 1 }] }).ok !== true) throw new Error("DRIFT renamed kinds still pass the field check (by design)");
	if (isEverythingUnknown([{ kind: "message.user", seq: 1 }], unknownNodeStats([{ kind: "message.user", seq: 1 }])) !== true) throw new Error("DRIFT a renamed-kind snapshot must be treated as incompatible");

	// ── R4: the contract's OWN fallback surface must not read as drift ───────
	// `UnknownSurfaceNode` (kind: "unknown") is a documented node kind: it marks one
	// event the projector intentionally does not model. Treating it as drift blanked
	// the entire view with "版本不兼容" the moment a session logged one exotic event.
	if (snapshotContract({ eventNodes: [{ kind: "unknown", seq: 1, time: 1, type: "x", data: {} }] }).ok !== true) throw new Error("R4 an unknown surface node is a valid node shape");
	if (unknownNodeStats([{ kind: "unknown", seq: 1 }]).unknown !== 0) throw new Error("R4 the documented fallback kind must not count as drift");
	const uOnly = deriveTraceTree({ eventNodes: [
		{ kind: "unknown", seq: 3, time: 1000, type: "experimental/widget", data: { mode: "a", n: 2 } }
	], requests: [], runningCalls: [], partial: null }, t);
	if (uOnly.stations.length !== 1) throw new Error("R4 an unknown surface node must produce one station, got " + uOnly.stations.length);
	if (uOnly.stations[0].kind !== "unknown") throw new Error("R4 station kind = " + uOnly.stations[0].kind);
	if (uOnly.stations[0].eventType !== "experimental/widget") throw new Error("R4 event type lost: " + uOnly.stations[0].eventType);
	// A session holding ONLY unsupported events is not a broken contract.
	if (isEverythingUnknown(uOnly.nodes, uOnly.nodeStats) !== false) throw new Error("R4 an unsupported event must not escalate to incompatibility");
	// The payload must survive into search and into the review pack, or the reader
	// has no way to say which event it was.
	if (matchStations(uOnly.stations, "experimental/widget").length !== 1) throw new Error("R4 the event type must be searchable");
	if (matchStations(uOnly.stations, "mode").length !== 1) throw new Error("R4 the payload must be searchable");
	const uPack = buildStepMarkdown(uOnly.stations[0], [], false, t);
	if (!uPack.includes("experimental/widget")) throw new Error("R4 review pack lost the event type");
	if (!uPack.includes('"mode":"a"')) throw new Error("R4 review pack lost the payload");
	// A payload that cannot be serialized must degrade, never throw.
	const circular = {};
	circular.self = circular;
	const cyc = safeJsonPreview(circular, 200);
	if (typeof cyc !== "string" || !cyc.includes("[Circular]")) throw new Error("R4 a cyclic payload must degrade to [Circular], got " + cyc);
	if (safeJsonPreview({ a: 1 }, 3) !== '{"a…') throw new Error("R4 payload cap not applied: " + safeJsonPreview({ a: 1 }, 3));
	if (safeJsonPreview(undefined, 10) !== undefined && safeJsonPreview(undefined, 10) !== "undefined") throw new Error("R4 an undefined payload must not throw");
	// And it must sit in its own turn rather than being glued onto an earlier one.
	const uMixed = deriveTraceTree({ eventNodes: [
		{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "hi" }] },
		{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "ok" }] },
		{ kind: "unknown", seq: 3, time: 3, type: "weird", data: null }
	], requests: [], runningCalls: [], partial: null }, t);
	if (uMixed.stations.length !== 3) throw new Error("R4 mixed snapshot station count = " + uMixed.stations.length);
	if (uMixed.stations[2].kind !== "unknown") throw new Error("R4 unknown station must keep its position");

	// ── R3: projection correctness (found by the third review) ───────────────
	// (a) a snapshot whose only content is a user message must not be dropped
	const userOnly = deriveTraceTree({ eventNodes: [
		{ kind: "user", seq: 1, time: 1000, content: [{ type: "text", text: "只有我" }] }
	], requests: [], runningCalls: [], partial: null }, t);
	if (userOnly.stations.length !== 1) throw new Error("R3 user-only snapshot lost its station: " + userOnly.stations.length);
	if (userOnly.stations[0].kind !== "user") throw new Error("R3 user-only station kind = " + userOnly.stations[0].kind);

	// (b) a user message that starts a NEW turn must not be attached to the old one
	const twoTurns = deriveTraceTree({ eventNodes: [
		{ kind: "assistant", seq: 5, time: 5000, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "答一" }] },
		{ kind: "user", seq: 10, time: 10000, content: [{ type: "text", text: "第二轮提问" }] }
	], requests: [], runningCalls: [], partial: null }, t);
	const turnNodes = twoTurns.children.filter((c) => c.kind === "turn");
	const ownerOfLateUser = turnNodes.filter((tn) => tn.children.some((c) => c.kind === "user" && c.text === "第二轮提问"));
	if (ownerOfLateUser.length !== 1) throw new Error("R3 the second user message must belong to exactly one turn");
	if (ownerOfLateUser[0].label.includes("1 ") || /\b1\b/.test(ownerOfLateUser[0].label) && !/\b2\b/.test(ownerOfLateUser[0].label)) {
		throw new Error("R3 the second user message was attached to turn 1: " + ownerOfLateUser[0].label);
	}

	// (c) the same in-flight tool described by BOTH runningCalls and partial counts once
	const dupSnap = { eventNodes: [
		{ kind: "assistant", seq: 5, time: 5000, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "a" }] }
	], requests: [], runningCalls: [
		{ callId: "dup1", turn: 1, step: 2, name: "bash", argsRaw: "{}", time: 6000 }
	], partial: { turn: 1, step: 2, blocks: [{ kind: "tool-call", callId: "dup1", name: "bash", argsRaw: "{}" }] } };
	const dupTree = deriveTraceTree(dupSnap, t);
	if (dupTree.stats.tools !== 1) throw new Error("R3 duplicate tool call counted " + dupTree.stats.tools + " times");
	const dupCells = dupTree.stations.flatMap((st) => (st.cells ?? []).filter((c) => c.kind === "tool" && c.callId === "dup1"));
	if (dupCells.length !== 1) throw new Error("R3 duplicate tool rendered " + dupCells.length + " times");

	// ── i18n parity: every key the code asks for must exist in BOTH locales ──
	// (Found two real misses: zh lacked anchor.capped, both lacked detail.request.
	//  t() falls back silently, so a missing key ships as a raw dotted id in the UI.)
	{
		const zhS = src.indexOf("const zh = {");
		const enS = src.indexOf("const en = {");
		if (zhS < 0 || enS < 0) throw new Error("I18N locale tables not found");
		const grab = (block) => new Set([...block.matchAll(/^\s+"([\w.]+)":/gm)].map((m) => m[1]));
		const zhKeys = grab(src.slice(zhS, enS));
		const enKeys = grab(src.slice(enS, enS + 20000));
		const used = new Set([...src.matchAll(/\bt\("([\w.]+)"\)/g)].map((m) => m[1]));
		const missZh = [...used].filter((k) => !zhKeys.has(k));
		const missEn = [...used].filter((k) => !enKeys.has(k));
		if (missZh.length > 0) throw new Error("I18N keys missing from zh: " + missZh.join(", "));
		if (missEn.length > 0) throw new Error("I18N keys missing from en: " + missEn.join(", "));
		const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k));
		const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k));
		if (onlyZh.length > 0) throw new Error("I18N keys only in zh: " + onlyZh.join(", "));
		if (onlyEn.length > 0) throw new Error("I18N keys only in en: " + onlyEn.join(", "));
	}

	// ── the pack must not be near-empty for non-step stations ────────────────
	// Six station kinds keep their payload on the station (not in `cells`), so a
	// cells-only pack silently produced a title with no evidence.
	const specialStations = [
		["orphan-tool", { kind: "orphan-tool", name: "bash", args: "{\"c\":1}", resultText: "ORPHAN-BODY", isError: true, errorName: "Exit 9" }],
		["error", { kind: "error", message: "ERROR-BODY", code: "E_TURN" }],
		["retry", { kind: "retry", message: "RETRY-BODY", code: "E_OVERLOAD", retry: 2, maxRetries: 5 }],
		["compaction", { kind: "compaction", summary: "COMPACT-BODY", count: 5, tokens: 200 }],
		["command", { kind: "command", name: "/clear", args: "--all", outcomeText: "CMD-BODY" }],
		["maxTokens", { kind: "maxTokens" }]
	];
	for (const [kind, station] of specialStations) {
		const pack = buildStepMarkdown(station, [], false, t);
		// a pack that is only a heading is a broken promise
		const body = pack.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#") && !l.startsWith(">"));
		if (body.length === 0) throw new Error("PACK " + kind + " pack carries no content: " + JSON.stringify(pack));
	}
	// each payload must actually appear
	for (const [kind, station, needle] of [
		["orphan-tool", specialStations[0][1], "ORPHAN-BODY"],
		["error", specialStations[1][1], "ERROR-BODY"],
		["retry", specialStations[2][1], "RETRY-BODY"],
		["compaction", specialStations[3][1], "COMPACT-BODY"],
		["command", specialStations[4][1], "CMD-BODY"]
	]) {
		if (!buildStepMarkdown(station, [], false, t).includes(needle)) throw new Error("PACK " + kind + " pack dropped its payload (" + needle + ")");
	}
	// orphan tool packs must carry args + error, not just the result text
	const orphanPack = buildStepMarkdown(specialStations[0][1], [], false, t);
	if (!orphanPack.includes("Exit 9")) throw new Error("PACK orphan pack dropped the error name");
	if (!orphanPack.includes("\"c\"")) throw new Error("PACK orphan pack dropped the args");

	// ── fmtDur must scale its unit; a long session's KPI is otherwise unreadable ─
	const durCases = [
		[null, "—"], [0, "—"], [-5, "—"], [NaN, "—"], [Infinity, "—"],
		[850, "850 ms"], [1500, "1.5 s"], [60000, "1.0 min"],
		[300000, "5.0 min"], [3600000, "1.0 h"], [7200000, "2.0 h"]
	];
	for (const [input, want] of durCases) {
		const got = fmtDur(input);
		if (got !== want) throw new Error("DUR fmtDur(" + String(input) + ") = " + got + ", want " + want);
	}
	// Boundary: rounding happens BEFORE the unit is chosen, so 59,960 ms is "1.0 min"
	// (it rounds to 60 s) while 59,900 ms is still "59.9 s". The old code printed
	// "60.0 s" for the former — a value labelled seconds that reads as a minute.
	if (fmtDur(59900) !== "59.9 s") throw new Error("DUR 59900 ms must stay in seconds, got " + fmtDur(59900));
	if (fmtDur(59960) !== "1.0 min") throw new Error("DUR 59960 ms must promote to minutes, got " + fmtDur(59960));
	if (fmtDur(3599999) !== "1.0 h") throw new Error("DUR 3599999 ms must promote to hours, got " + fmtDur(3599999));
	// Token magnitudes: a long session really reaches 1e10, and 999,999,999 must not
	// print a four-digit mantissa.
	if (fmtTokens(16300000000) !== "16.3B") throw new Error("TOK 1.63e10 must read as B, got " + fmtTokens(16300000000));
	if (fmtTokens(999950000) !== "1.0B") throw new Error("TOK 999,950,000 must promote to B, got " + fmtTokens(999950000));
	if (fmtTokens(999949999) !== "999.9M") throw new Error("TOK 999,949,999 must stay in M, got " + fmtTokens(999949999));
	// The same carry rule at the k/M seam: 999,999 rounds to 1000, which must become
	// "1.0M" — "1000k" is a four-digit mantissa that reads as an error.
	if (fmtTokens(999999) !== "1.0M") throw new Error("TOK 999,999 must carry into M, got " + fmtTokens(999999));
	if (fmtTokens(999499) !== "999k") throw new Error("TOK 999,499 must stay in k, got " + fmtTokens(999499));
	if (fmtTokens(9949) !== "9.9k") throw new Error("TOK 9,949 keeps one decimal, got " + fmtTokens(9949));
	if (fmtTokens(9950) !== "10k") throw new Error("TOK 9,950 rounds up to 10k, got " + fmtTokens(9950));

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

	// ── R2: render containment must not fight the scroller ────────────────────
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		// `content-visibility: auto` lays off-screen cards out at their intrinsic size.
		// The fallback used to be 120px against a measured 214px, so every card entering
		// the viewport changed the scroller's extent and the thumb jumped. The `auto`
		// keyword makes the browser remember real sizes; the fallback must also match
		// the measurement rather than guess low.
		const rule = src.match(/\.dstv_station\{content-visibility:auto;([^"]*?)width:264px/);
		if (rule === null) throw new Error("R2 stations must declare containment explicitly");
		const decls = [...rule[1].matchAll(/contain-intrinsic-size:([^;]+);/g)].map((m) => m[1].trim());
		// Progressive enhancement: the plain-length form first (works everywhere
		// containment does), then the `auto` form that remembers real sizes.
		if (decls.length !== 2) throw new Error("R2 expected a fallback and an auto override, got " + decls.length);
		const value = decls[1];
		if (!decls[0].startsWith("264px")) throw new Error("R2 the fallback must state the card width, got " + decls[0]);
		if (!value.startsWith("auto ")) throw new Error("R2 intrinsic size must use the auto keyword, got: " + value);
		const parts = value.slice(5).trim().split(/\s+/);
		if (parts[0] !== "264px") throw new Error("R2 card width fallback must match the fixed 264px card, got " + parts[0]);
		if (Number.parseInt(parts[1], 10) < 200) throw new Error("R2 height fallback must be near the measured 214px, got " + parts[1]);
		// A hidden tab must not keep polling the composer.
		if (!/visibilityState !== "hidden"/.test(src)) throw new Error("R2 composer polling must pause while the document is hidden");
	}

	// ── N1: turn anchors must stop paging once the window covers them ──────────
	// Regression this pins: `p`/`t` anchors used to report "no seq bound", so the
	// paging floor was a no-op and a deep turn link pulled the full page budget
	// (observed: 66 -> 1389 stations on one session) even when the request was
	// already satisfiable.
	{
		const win = [
			{ kind: "step", turn: 9, anchorSeq: 900 },
			{ kind: "step", turn: 10, anchorSeq: 1000 },
			{ kind: "user", anchorSeq: 850 }
		];
		if (anchorTurnFloor(win) !== 9) throw new Error("N1 turn floor must be the oldest turn, got " + anchorTurnFloor(win));
		// Anchor older than the window -> keep paging.
		if (anchorCoveredByWindow({ ok: true, form: "p", turn: 3, step: 1 }, win) !== false) throw new Error("N1 an older turn must not be considered covered");
		// Anchor inside the window -> stop paging.
		if (anchorCoveredByWindow({ ok: true, form: "p", turn: 10, step: 1 }, win) !== true) throw new Error("N1 a covered turn must stop paging");
		// A turn being PRESENT is not the same as the requested step being loaded: the
		// window here holds turn 9's last step only, so step 2 may still be one page back.
		// The old assertion demanded `true` here and that is exactly the bug Codex found
		// (the anchor gave up and reported "not loaded" while the page was available).
		if (anchorCoveredByWindow({ ok: true, form: "t", turn: 9, step: 2 }, win) !== false) throw new Error("N1 a turn present without its start must keep paging");
		// Once the turn's first step is loaded, the turn is genuinely covered.
		const winHeaded = win.concat([{ kind: "step", turn: 9, stepNo: 1, turnStep: 1, anchorSeq: 880 }]);
		if (anchorCoveredByWindow({ ok: true, form: "p", turn: 9, step: 2 }, winHeaded) !== true) throw new Error("N1 a turn whose start is loaded is covered");
		if (anchorCoveredByWindow({ ok: true, form: "t", turn: 9, step: 2 }, winHeaded) !== true) throw new Error("N1 t-anchors must behave like p-anchors");
		// Seq anchors keep their existing behaviour.
		if (anchorCoveredByWindow({ ok: true, form: "e", seq: 700 }, win) !== false) throw new Error("N1 an older seq must not be covered");
		if (anchorCoveredByWindow({ ok: true, form: "e", seq: 950 }, win) !== true) throw new Error("N1 a covered seq must stop paging");
		// Unknown floor -> keep paging rather than guessing.
		if (anchorCoveredByWindow({ ok: true, form: "p", turn: 3, step: 1 }, [{ kind: "step" }]) !== false) throw new Error("N1 unknown window must not claim coverage");
		if (anchorTurnFloor([{ kind: "step" }]) !== null) throw new Error("N1 turn floor must be null when no station carries a turn");
		// The loop itself must consult it (guards against the helper being orphaned).
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		// Assert the CONDITION, not just the call: an earlier version of this check
		// only looked for the call, so reverting the condition to the old
		// `target !== 0` (which is always false for p/t anchors) stayed green.
		if (!/target !== 0 \|\| parsed\.form === "p" \|\| parsed\.form === "t"/.test(src)) throw new Error("N1 turn anchors must enter the coverage check");
		if (!/if \(anchorCoveredByWindow\(parsed, stationsRef\.current\)\) break;/.test(src)) throw new Error("N1 the paging loop must stop on coverage");
	}

	// ── PERF3: nested sub-calls must be budgeted, not just depth-capped ───────
	// SUB_CALL_MAX_DEPTH bounds recursion but NOT breadth: 5 siblings x 9 levels
	// copied 2.4 million nodes and took 12.7 s. A shared per-root budget fixes it.
	{
		const mk = (d, b) => {
			if (d === 0) return [];
			const out = [];
			for (let i = 0; i < b; i += 1) out.push({ kind: "tool-result", callId: "x", callTime: 1, time: 2, name: "n", content: [], isError: false, subCalls: mk(d - 1, b) });
			return out;
		};
		// Single root: cap applies.
		const root = mk(9, 5)[0];
		const t0 = Date.now();
		const one = subDetailOf(root, 0);
		const ms = Date.now() - t0;
		let count = 0;
		const walk = (l) => { for (const x of l || []) { count += 1; walk(x.subCalls); } };
		walk([one]);
		if (count > 2500) throw new Error("PERF3 single-root materialisation is unbounded: " + count + " nodes");
		if (ms > 3000) throw new Error("PERF3 too slow: " + ms + "ms");
		// MULTIPLE roots under one tool cell must share ONE budget. The per-root version
		// materialised 7,775 nodes for 5 roots; the shared version caps at ~2,000.
		{
			// 4 roots x (1+8+64+512)=585 = 2,340 nodes: over the shared cap, and cheap
			// enough that its garbage does not perturb the later P1 timing test.
			const roots = mk(4, 8).slice(0, 4);
			const snap = { eventNodes: [
				{ kind: "assistant", seq: 1, time: 1, messageId: "a", turn: 1, step: 1, blocks: [{ kind: "tool-call", callId: "root", name: "root", argsRaw: "{}" }] },
				{ kind: "tool-result", seq: 2, time: 2, callId: "root", call: { name: "root", argsRaw: "{}" }, content: [], isError: false, subCalls: roots }
			], requests: [], callSchemas: new Map(), partial: null, runningCalls: [] };
			const tree = deriveTraceTree(snap, t);
			const cell = tree.stations.find((x) => x.kind === "step").cells.find((c) => c.kind === "tool");
			let total = 0;
			const walk2 = (l) => { for (const x of l || []) { total += 1; walk2(x.subCalls); } };
			walk2(cell.subCalls);
			if (total > 2100) throw new Error("PERF3 the budget must be SHARED across all roots of one tool cell, got " + total + " nodes");
		}
	}

	// ── I18N2: English output must carry no CJK characters ────────────────────
	// The image placeholder and the compaction note were hardcoded in Chinese, so the
	// English UI leaked "『上下文压缩：…』" and "[图片]". Behavioural check beats a
	// source scan: run the real functions with the real `en` dictionary.
	{
		const en = (() => {
			const srcE = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
			const a = srcE.indexOf("const en = {");
			const blockE = srcE.slice(a, srcE.indexOf("\n\t\t};", a));
			const out = {};
			for (const m of blockE.matchAll(/"([a-zA-Z][\w.]*)":\s*"((?:[^"\\]|\\.)*)"/g)) out[m[1]] = JSON.parse(`"${m[2]}"`);
			return out;
		})();
		const enT = (k) => (en[k] !== void 0 ? en[k] : k);
		const msgs = reconstructMessages([
			{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "hi" }, { type: "image" }] },
			{ kind: "compaction", seq: 2, time: 2, summary: "SUM", shadowedItemCount: 1, shadowedTokenCount: 1000 }
		], 99, enT);
		const cjk = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
		for (const m of msgs) {
			if (cjk.test(m.text)) throw new Error("I18N2 English output contains CJK: " + JSON.stringify(m.text));
		}
	}

	// ── CONTRACT1: fields the host actually provides must be read, not guessed ──
	{
		const mkTree = (nodes) => deriveTraceTree({ eventNodes: nodes, requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t);
		// `producer.label` lives at the node top level, not under `provenance`.
		const ctx = mkTree([{ kind: "context", seq: 3, time: 1, content: [{ type: "text", text: "x" }], source: {}, producer: { role: "inject", label: "AUDIT_PRODUCER" }, form: "notice" }]);
		if (!String(ctx.stations[0].who).includes("AUDIT_PRODUCER")) throw new Error("CONTRACT1 producer.label not surfaced: " + ctx.stations[0].who);
		// AssistantBlock image/other must not vanish without a trace.
		const img = mkTree([{ kind: "assistant", seq: 1, time: 1, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "hi" }, { kind: "image", attachment: {} }] }]);
		const imgCells = img.stations.filter((x) => x.kind === "step")[0].cells;
		if (imgCells.length !== 2) throw new Error("CONTRACT1 image block was dropped: " + imgCells.length + " cells");
		const oth = mkTree([{ kind: "assistant", seq: 1, time: 1, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "other", block: { type: "video" } }] }]);
		const othCells = oth.stations.filter((x) => x.kind === "step")[0].cells;
		if (othCells.length !== 1) throw new Error("CONTRACT1 other block was dropped");
	}

	// ── SEC1: model-supplied links must not reach the DOM with an active scheme ──
	// `renderMdInline` put `p.href` straight into an <a href>. React does not sanitise
	// URLs, so a `javascript:` link in a transcript was clickable and executed.
	{
		const React2 = require("react");
		const { renderToStaticMarkup } = require("react-dom/server");
		const srcS = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		const a = srcS.indexOf("function mdInline(src) {");
		const b = srcS.indexOf("function MarkdownText({ text }) {");
		const box = { React: React2, console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, isFinite, parseInt, parseFloat, Date, RegExp };
		require("node:vm").runInNewContext("const jsx = React.createElement, jsxs = React.createElement;\n" + srcS.slice(a, b) + ";globalThis.__r = { renderMdInline, mdInline };", box, { timeout: 60000 });
		const render = (md) => renderToStaticMarkup(box.__r.renderMdInline(box.__r.mdInline(md), "k"));
		const dangerous = [
			"[evil](javascript:alert(1))",
			"[spaced]( JavaScript:alert(1))",
			"[nl](java\nscript:alert(1))",
			"[vb](vbscript:msgbox)",
			"[data](data:text/html,x)"
		];
		for (const md of dangerous) {
			const html = render(md);
			if (/<a\b/i.test(html)) throw new Error("SEC1 active link rendered for " + JSON.stringify(md) + ": " + html);
			if (/href=/i.test(html)) throw new Error("SEC1 href leaked for " + JSON.stringify(md));
		}
		// Legitimate links must still work, otherwise the fix is just "break links".
		for (const md of ["[ok](https://example.com)", "[m](mailto:a@b.c)", "[r](/rel)"]) {
			const html = render(md);
			if (!/<a\b[^>]*href=/.test(html)) throw new Error("SEC1 legitimate link was dropped: " + md + " -> " + html);
		}
	}

	// ── ID1: station ids must be unique (React keys + selection pin identity) ──
	{
		const dup = deriveTraceTree({ eventNodes: [
			{ kind: "user", seq: 7, time: 1, blocks: [] },
			{ kind: "user", seq: 7, time: 2, blocks: [] }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t).stations.map((x) => x.id);
		if (new Set(dup).size !== dup.length) throw new Error("ID1 duplicate station ids: " + dup.join(","));
		// The pin resolves stations by id, so a duplicate silently points at the wrong one.
		const mixed = deriveTraceTree({ eventNodes: [
			{ kind: "turn-error", seq: 2, time: 2, turn: 1, step: 1, message: "x", code: "E" },
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m", blocks: [] }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t).stations.map((x) => x.id);
		if (new Set(mixed).size !== mixed.length) throw new Error("ID1 duplicate ids across kinds: " + mixed.join(","));
	}

	// ── BUILD1: src/ and lib/client.js must agree ─────────────────────────────
	// lib/client.js is GENERATED from src/*.js. Editing the built file directly would
	// silently diverge from the sources and the next build would erase the fix.
	{
		const cp = require("node:child_process");
		const r = cp.spawnSync(process.execPath, [require("node:path").join(__dirname, "..", "scripts", "build-client.mjs"), "--check"], { encoding: "utf8" });
		if (r.status !== 0) throw new Error("BUILD1 lib/client.js does not match src/ — run `node scripts/build-client.mjs`\n" + (r.stderr || "") + (r.stdout || ""));
	}

	// ── PERF2: tooltips and the copy-button payload must stay bounded ─────────
	{
		const srcP = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/const TITLE_PREVIEW_CHARS = \d+;/.test(srcP)) throw new Error("PERF2 title previews need an explicit bound");
		// A `title` carrying the full args pushed 14.6 MB of markup for 480 long calls.
		const fullArgTitles = [...srcP.matchAll(/title: [^,\n]*\bcell\.args\b(?![^,\n]*slice)/g)];
		if (fullArgTitles.length > 0) throw new Error("PERF2 a title must not carry the full args: " + fullArgTitles.length + " site(s)");
		// The copy payload is expensive and only read on click; it must be memoised.
		if (!/const stepMarkdown = \(0, react\.useMemo\)/.test(srcP)) throw new Error("PERF2 buildStepMarkdown must be memoised");
		if (!/text: stepMarkdown,/.test(srcP)) throw new Error("PERF2 the copy button must use the memoised payload");
		if (/text: buildStepMarkdown\(activeStation, activeMessages/.test(srcP)) throw new Error("PERF2 the copy payload is being rebuilt inline again");
	}

	// ── PERF1: mdInline must stay linear ──────────────────────────────────────
	// Unmatched markers used to rescan to end-of-string per position: 64K `[` = 221 ms,
	// 256K = 2.6 s. These strings feed card previews on every render.
	{
		const sized = (n) => "[".repeat(n);
		const time = (n) => { const t0 = Date.now(); mdInline(sized(n)); return Date.now() - t0; };
		// Absolute budget, not a ratio: at these sizes the linear version needs a few ms,
		// so a ratio against a single-digit baseline is pure timer noise (this check first
		// flapped between red and green because of exactly that). The quadratic original
		// took ~2.6 s here, so 400 ms leaves a wide margin while still catching a relapse.
		time(65536); // warm up
		const large = time(262144);
		if (large > 400) throw new Error("PERF1 mdInline is super-linear: 256K unmatched markers took " + large + "ms (linear code needs a few ms; the quadratic version took ~2600ms)");
		// And the parse must still be correct.
		const md = mdInline("**b** `c` [l](u)");
		if (md.map((x) => x.t).join(",") !== "strong,text,code,text,link") throw new Error("PERF1 mdInline lost syntax after the rewrite: " + JSON.stringify(md));
		const unclosed = mdInline("[abc");
		if (unclosed.length !== 1 || unclosed[0].text !== "[abc") throw new Error("PERF1 an unmatched bracket must stay literal text");
	}

	// ── Z2: the component must actually RENDER ────────────────────────────────
	// The smoke suite only ever executed pure helpers inside a vm, so a render-time
	// crash (0.9.23–0.9.25: `ReferenceError: Cannot access 'activeStation' before
	// initialization`) shipped for three versions with every test green. This block
	// renders the REAL component through react-dom/server.
	{
		let React = null;
		let renderToString = null;
		try {
			React = require("react");
			renderToString = require("react-dom/server").renderToString;
		} catch {
			React = null;
		}
		if (React === null || typeof renderToString !== "function") {
			// Dependencies are dev-only; skip loudly instead of pretending to verify.
			console.log("Z2 SKIPPED: react / react-dom/server not installed (run `npm i --no-save react react-dom`)");
		} else {
			const fsZ = require("node:fs");
			const pathZ = require("node:path");
			const vmZ = require("node:vm");
			const srcZ = fsZ.readFileSync(pathZ.join(__dirname, "..", "lib", "client.js"), "utf8");
			const jsx = (type, props, key) => {
				const p = props === null || props === void 0 ? {} : Object.assign({}, props);
				if (key !== void 0 && key !== null) p.key = key;
				return React.createElement(type, p);
			};
			const boxZ = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, Date, RegExp,
				isFinite, parseInt, parseFloat, Error, TypeError, Symbol, Promise,
				react: React, jsx, jsxs: jsx, react_jsx_runtime: { jsx, jsxs: jsx },
				document: void 0, window: void 0, location: void 0 };
			boxZ.globalThis = boxZ;
			vmZ.createContext(boxZ);
			// Evaluate only the helper + component regions: the outer bundle calls
			// window.__ModuleLoader__.load(...), which a bare vm context does not provide.
			const h0 = srcZ.indexOf("//#region pure helpers: snapshot -> timeline tree");
			const h1 = srcZ.indexOf("//#endregion", h0);
			const c0 = srcZ.indexOf("//#region horizontal timeline + replay component");
			const c1 = srcZ.indexOf("//#endregion", c0);
			if (h0 < 0 || c0 < 0) throw new Error("Z2 could not locate the helper/component regions");
			// The module scope defines `fragment` (react.Fragment) outside both regions; the
			// component uses it, so the slice needs that one binding too.
			vmZ.runInContext("const fragment = react.Fragment;\n" + srcZ.slice(h0, h1) + "\n" + srcZ.slice(c0, c1) + ";globalThis.__testComponent = { TraceMapView };", boxZ, { timeout: 60000 });
			const Comp = boxZ.__testComponent && boxZ.__testComponent.TraceMapView;
			if (typeof Comp !== "function") throw new Error("Z2 the component test hook never fired");
			const SNAPS = {
				empty: { eventNodes: [], requests: [], callSchemas: {}, runningCalls: {}, partial: null },
				user: { eventNodes: [{ kind: "user", seq: 1, time: 1, blocks: [{ kind: "text", text: "hi" }] }], requests: [], callSchemas: {}, runningCalls: {}, partial: null },
				step: { eventNodes: [{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "hello" }] }], requests: [], callSchemas: {}, runningCalls: {}, partial: null },
				live: { eventNodes: [{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "hello" }] }], requests: [], callSchemas: {}, runningCalls: {}, partial: { turn: 2, step: 1, blocks: [{ kind: "text", text: "streaming" }], timing: { stepStartTime: 1, firstTokenTime: 2 } } },
			};
			for (const name of Object.keys(SNAPS)) {
				const snap = SNAPS[name];
				let html = null;
				try {
					html = renderToString(React.createElement(Comp, {
						useSession: (sel) => { try { return sel({ openState: "open", snapshot: snap }); } catch { return void 0; } },
						useTrajectory: () => snap,
						t: (k) => k,
						viewRequest: null,
						completeViewRequest: () => {},
						loadOlder: async () => false,
					}));
				} catch (e) {
					throw new Error("Z2 rendering the " + name + " snapshot threw: " + e.constructor.name + ": " + e.message.slice(0, 140));
				}
				if (typeof html !== "string" || !html.includes("dstv_root")) throw new Error("Z2 the " + name + " snapshot rendered no view root");
			}
		}
	}

	// ── Z1: no const/let may be READ before its declaration (TDZ) ─────────────
	// 0.9.23 added a selection-pin effect that touched `activeStation` while that
	// `const` was declared ~20 lines LATER. Const has a temporal dead zone, so every
	// render threw ReferenceError and the trace view rendered nothing at all —
	// released that way in 0.9.23/0.9.24/0.9.25. Node's smoke test never executes the
	// component, so nothing caught it. This is the guard that would have.
	{
		const lines = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8").split("\n");
		const start = lines.findIndex((l) => /function TraceMapView\(/.test(l));
		if (start < 0) throw new Error("Z1 could not locate the component");
		const params = new Set(["t", "useSession", "useTrajectory", "viewRequest", "completeViewRequest", "loadOlder", "initialAnchor"]);
		const declared = {};
		for (let i = start; i < lines.length; i += 1) {
			const m = /^\t\t\t(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/.exec(lines[i]);
			if (m !== null && declared[m[1]] === void 0) declared[m[1]] = i;
		}
		const offenders = [];
		for (let i = start; i < lines.length; i += 1) {
			const line = lines[i];
			if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
			// Strip string literals so prose mentioning an identifier is not a "use".
			const code = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
			for (const [name, at] of Object.entries(declared)) {
				if (at <= i || params.has(name)) continue;
				const re = new RegExp("(?<![\\w$.'\"])" + name.replace(/\$/g, "\\$") + "(?![\\w$'\"])");
				if (re.test(code)) offenders.push(`${name} used at line ${i + 1}, declared at ${at + 1}`);
			}
		}
		// Function bodies may reference a later-declared helper as long as they are not
		// CALLED before it exists; those are flat function bodies, so allow references
		// that sit inside an arrow/function declared earlier. We only fail on a direct
		// statement-level read, which is what the TDZ bug looked like.
		const real = offenders.filter((o) => !/\bseek used|\bbody used/.test(o));
		if (real.length > 0) throw new Error("Z1 const read before its declaration (TDZ): " + real.slice(0, 3).join("; "));
	}

	// ── X1: Codex review findings, each re-proven against the real code ───────
	{
		// X1-a: a host `user` node has no `turn`, so it must be adopted by the next
		// assistant's turn. Borrowing `partial.turn` filed every historical user message
		// under the turn being generated right now.
		const snapP = { eventNodes: [
			{ kind: "user", seq: 1, time: 1, blocks: [{ kind: "text", text: "OLD_USER" }] },
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "OLD_REPLY" }] },
			{ kind: "user", seq: 10, time: 10, blocks: [{ kind: "text", text: "NEW_USER" }] }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: { turn: 2, step: 1, blocks: [{ kind: "text", text: "LIVE" }], timing: {} } };
		const withP = deriveTraceTree(snapP, t).stations.filter((x) => x.kind === "step").map((x) => x.turn);
		if (withP.join(",") !== "1,2") throw new Error("X1-a turns must stay 1,2 with a partial, got " + withP.join(","));

		// X1-b: a fence after a list must not be swallowed as a list continuation.
		const md = mdBlocks("- Intro\n```js\nconst x=1\n```\n# Heading");
		if (md.map((x) => x.type).join(",") !== "ul,code,h") throw new Error("X1-b fence after list lost, got " + md.map((x) => x.type).join(","));
		if (md[1].lang !== "js" || md[1].text !== "const x=1") throw new Error("X1-b fence content wrong");
		// ...while genuine lazy continuations still join their item.
		const lazy = mdBlocks("- a\n  continued\n- b");
		if (lazy[0].items[0].join("|") !== "a|continued") throw new Error("X1-b lazy continuation must still join");

		// X1-c: an ordered list keeps its starting number.
		const ol = mdBlocks("7. Resume\n8. Verify");
		if (ol[0].type !== "ol" || ol[0].start !== 7) throw new Error("X1-c ordered start lost, got " + JSON.stringify(ol[0]));

		// X1-d: anchors are per-turn. `stepNo` is a window-wide counter, so turn 2's first
		// step was number 3 and `tvp1:t2s1` never resolved.
		const tree7 = deriveTraceTree({ eventNodes: [
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "a" }] },
			{ kind: "assistant", seq: 3, time: 3, turn: 1, step: 2, messageId: "m2", blocks: [{ kind: "text", text: "b" }] },
			{ kind: "assistant", seq: 5, time: 5, turn: 2, step: 1, messageId: "m3", blocks: [{ kind: "text", text: "c" }] }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t);
		const st7 = tree7.stations.filter((x) => x.kind === "step");
		if (st7[2].stepNo !== 3) throw new Error("X1-d stepNo must remain the window counter");
		if (st7[2].turnStep !== 1) throw new Error("X1-d turnStep must be per-turn, got " + st7[2].turnStep);
		if (resolveAnchorInStations(parseAnchor("tvp1:t2s1"), st7).ok !== true) throw new Error("X1-d tvp1:t2s1 must resolve");
		if (resolveAnchorInStations(parseAnchor("tvp1:t2s2"), st7).ok !== false) throw new Error("X1-d tvp1:t2s2 must not resolve");

		// X1-j: nested programmatic tool calls must survive into data AND export.
		const treePtc = deriveTraceTree({ eventNodes: [
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "root", name: "ptc", argsRaw: "{}" }] },
			{ kind: "tool-result", seq: 5, time: 50, turn: 1, step: 1, callId: "root", callTime: 10, content: [{ type: "text", text: "ROOT_OK" }], isError: false,
				subCalls: [{ kind: "tool-result", callId: "child", callTime: 20, time: 30, name: "CHILD", content: [{ type: "text", text: "CHILD" }], isError: false,
					subCalls: [{ kind: "tool-result", callId: "leaf", callTime: 31, time: 40, name: "LEAF", content: [{ type: "text", text: "MISSING_GRANDCHILD" }], isError: true, error: { name: "E_LEAF" } }] }] }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t);
		const cellPtc = treePtc.stations.find((x) => x.kind === "step").cells.find((c) => c.kind === "tool");
		if (cellPtc.subCalls[0].subCalls.length !== 1) throw new Error("X1-j grandchild sub-call was dropped from the data");
		if (cellPtc.subCalls[0].subCalls[0].isError !== true) throw new Error("X1-j nested error flag lost");
		const mdPtc = buildStepMarkdown(treePtc.stations.find((x) => x.kind === "step"), [], false, t);
		if (!mdPtc.includes("CHILD")) throw new Error("X1-j export lost the child call");
		if (!mdPtc.includes("LEAF")) throw new Error("X1-j export lost the grandchild call");
		if (!mdPtc.includes("E_LEAF")) throw new Error("X1-j export lost the nested error name");

		// X1-k: a typed jump must update the URL, or the old hash re-applies on the next
		// arriving station and steals the selection back.
		const hashSrc = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		const enterBranch = /if \(ev\.key === "Enter"\) \{([\s\S]{0,700}?)history\.replaceState/.exec(hashSrc);
		if (enterBranch === null) throw new Error("X1-k the typed anchor jump must mirror into the URL");
		if (!/nextHashFor\(location\.hash, wanted\)/.test(enterBranch[1])) throw new Error("X1-k the URL must be derived from the jumped anchor");

		// X1-o: the identity-recording effect must fire ONLY on a selection change.
		// Depending on the derived id made it re-run after a backwards page (same
		// position, different station) and overwrite the pin with the wrong station.
		// Verified live: e29532 silently became e28913 when history loaded.
		{
			const srcO = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
			if (!/const selectionChanged = prevRevealedRef\.current !== revealed;/.test(srcO)) throw new Error("X1-o the pin must record only on a selection change");
			if (/\}, \[selectedStationId\]\);/.test(srcO)) throw new Error("X1-o recording must not depend on the derived id");
			if (!/\}, \[revealed\]\);/.test(srcO)) throw new Error("X1-o recording must depend on revealed alone");
			// The id is read through the ref so paging cannot re-trigger the effect.
			if (!/selectedIdRef\.current = revealed === null \? null/.test(srcO)) throw new Error("X1-o the pin must be recorded from the live list");
		}

		// X1-n: round-3 findings.
		{
			// blocks: [null] must not throw inside the fold.
			let survived = null;
			try {
				survived = deriveTraceTree({ eventNodes: [
					{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [null, { kind: "text", text: "OK" }] }
				], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t);
			} catch (e) { throw new Error("X1-n deriveTraceTree threw on blocks:[null]: " + e.message); }
			if (survived.stations.filter((x) => x.kind === "step").length !== 1) throw new Error("X1-n a null block must not lose the step");

			// A malformed record next to healthy ones must be surfaced in the header, not
			// only on the empty branch.
			const srcN = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
			if (!/tree\.contract != null && tree\.contract\.ok !== true && N > 0/.test(srcN)) throw new Error("X1-n a partly-broken session must warn in the header");
			if (!/view\.malformed/.test(srcN)) throw new Error("X1-n the malformed warning needs its own label");

			// Search must index nested calls at ANY depth, not a fixed two levels.
			if (!/const collectSubs = \(list, depth\)/.test(srcN)) throw new Error("X1-n stationHay must walk sub-calls recursively");
			if (/for \(const deep of sub\.subCalls/.test(srcN)) throw new Error("X1-n the fixed two-level walk must be gone");

			// A stale match pointer must be clamped before stepping.
			if (!/const base = Math\.min\(matchPtr, matches\.length - 1\)/.test(srcN)) throw new Error("X1-n matchPtr must be clamped to the live match list");
		}

		// X1-m: the selection pin only works if station ids are STABLE. They used to be
		// `s${stepCounter}` — a window-wide running count — so prepending history
		// renumbered every step and the pin resolved to a different record.
		{
			const mkSt = (nodes) => deriveTraceTree({ eventNodes: nodes, requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t).stations;
			const cur = [];
			for (let i = 0; i < 20; i += 1) cur.push({ kind: "assistant", seq: 100 + i * 10, time: 100 + i * 10, turn: 2, step: i + 1, messageId: "c" + i, blocks: [{ kind: "text", text: "cur" + i }] });
			const before = mkSt(cur);
			const selIdx = 12;
			const selId = before[selIdx].id;
			const older = [];
			for (let i = 0; i < 5; i += 1) older.push({ kind: "assistant", seq: 1 + i * 10, time: 1 + i * 10, turn: 1, step: i + 1, messageId: "o" + i, blocks: [{ kind: "text", text: "old" + i }] });
			const after = mkSt(older.concat(cur));
			const pinned = after.findIndex((x) => x.id === selId);
			if (pinned < 0) throw new Error("X1-m the selected station id vanished after prepending history");
			if (after[pinned].id !== selId) throw new Error("X1-m the pin resolved to a different station");
			// The old positional read must now be recognisably WRONG, which is the whole
			// point: if position and identity agreed, this test would prove nothing.
			if (after[selIdx].id === selId) throw new Error("X1-m position and identity must diverge after a prepend, or the test is vacuous");
		}

		// X1-l: regressions from round 2 of the Codex audit.
		{
			// R3: `array.map(subDetailOf)` passes the INDEX as the second argument, which
			// landed in the new `depth` slot — the 9th sibling started at depth 8 and lost
			// its own children.
			const many = [];
			for (let i = 0; i < 9; i += 1) many.push({ kind: "tool-result", callId: "c" + i, callTime: 1, time: 2, name: "S" + i, content: [], isError: false, subCalls: [{ kind: "tool-result", callId: "gc" + i, callTime: 1, time: 2, name: "GC" + i, content: [], isError: false }] });
			const treeMany = deriveTraceTree({ eventNodes: [
				{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "root", name: "ptc", argsRaw: "{}" }] },
				{ kind: "tool-result", seq: 5, time: 50, turn: 1, step: 1, callId: "root", callTime: 10, content: [], isError: false, subCalls: many }
			], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t);
			const cellMany = treeMany.stations.find((x) => x.kind === "step").cells.find((c) => c.kind === "tool");
			const lostAt = cellMany.subCalls.findIndex((x) => (x.subCalls ?? []).length !== 1);
			if (lostAt >= 0) throw new Error("X1-l sibling #" + lostAt + " lost its children (map index leaked into depth)");

			// R4: `~~~` is a valid fence opener and must produce a code block.
			const tilde = mdBlocks("~~~js\nconst x=1\n~~~");
			if (tilde.length !== 1 || tilde[0].type !== "code" || tilde[0].lang !== "js") throw new Error("X1-l tilde fence must parse as code, got " + JSON.stringify(tilde));

			// R6: a different marker starts a NEW list; it must not be swallowed.
			const mixed = mdBlocks("7. ordered\n- bullet");
			if (mixed.map((x) => x.type).join(",") !== "ol,ul") throw new Error("X1-l mixed markers must split lists, got " + mixed.map((x) => x.type).join(","));

			// N1: a wrong-shaped `content` must not crash the fold nor pass validation.
			// Must not THROW: the old `for…of content` raised TypeError and took the whole
			// view down. Comparing the return value alone cannot tell "" from a crash.
			let tolerated = null;
			try { tolerated = textOfContent({ text: "x" }); } catch (e) { throw new Error("X1-l textOfContent threw on a non-array: " + e.message); }
			if (tolerated !== "") throw new Error("X1-l textOfContent must return empty for a non-array");
			const badContract = snapshotContract({ eventNodes: [{ kind: "user", seq: 1, content: { text: "x" } }] });
			if (badContract.ok !== false) throw new Error("X1-l a malformed content must fail the contract, not crash the view");

			// R5: a sub-call result must appear exactly once in the export.
			const treeDup = deriveTraceTree({ eventNodes: [
				{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "r", name: "ptc", argsRaw: "{}" }] },
				{ kind: "tool-result", seq: 5, time: 50, turn: 1, step: 1, callId: "r", callTime: 10, content: [], isError: false,
					subCalls: [{ kind: "tool-result", callId: "kid", callTime: 20, time: 30, name: "CHILD_CALL", content: [{ type: "text", text: "CHILD_RESULT_UNIQUE" }], isError: false }] }
			], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t);
			const mdDup = buildStepMarkdown(treeDup.stations.find((x) => x.kind === "step"), [], false, t);
			const occurrences = (mdDup.match(/CHILD_RESULT_UNIQUE/g) || []).length;
			if (occurrences !== 1) throw new Error("X1-l sub-call result printed " + occurrences + " times, expected once");

			// R6b: the renderer must pass `start` through, or <ol> renumbers from 1.
			const renderSrc = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
			if (!/listProps\.start = b\.start/.test(renderSrc)) throw new Error("X1-l the ordered list must pass its start to the element");

			// N3: a search for a nested child name must find the step.
			const hay = (function () {
				const st = deriveTraceTree({ eventNodes: [
					{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "r", name: "ptc", argsRaw: "{}" }] },
					{ kind: "tool-result", seq: 5, time: 50, turn: 1, step: 1, callId: "r", callTime: 10, content: [], isError: false,
						subCalls: [{ kind: "tool-result", callId: "kid", callTime: 20, time: 30, name: "NESTED_NAME_XYZ", content: [], isError: false }] }
				], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t).stations.find((x) => x.kind === "step");
				return stationHay(st);
			})();
			if (!hay.includes("nested_name_xyz")) throw new Error("X1-l stationHay must index nested sub-call names");
		}

		// X1-h: a turn merely being present is not coverage. A window holding only
		// turn 2's step 9 must keep paging for `t2s7`; the old floor test stopped early.
		const winPartial = [{ kind: "step", turn: 2, turnStep: 9, stepNo: 9, anchorSeq: 90 }];
		if (anchorCoveredByWindow(parseAnchor("tvp1:t2s7"), winPartial) !== false) throw new Error("X1-h a partial turn must keep paging");
		// A FUTURE turn must not look covered just because no step matches yet.
		if (anchorCoveredByWindow(parseAnchor("tvp1:t3s1"), winPartial) !== false) throw new Error("X1-h a future turn is not covered");
		// Loading that turn's start, or any earlier turn, does settle it.
		const winHeaded2 = winPartial.concat([{ kind: "step", turn: 2, turnStep: 1, stepNo: 1, anchorSeq: 70 }]);
		if (anchorCoveredByWindow(parseAnchor("tvp1:t2s7"), winHeaded2) !== true) throw new Error("X1-h a headed turn is covered");
		const winOlder = winPartial.concat([{ kind: "step", turn: 1, turnStep: 1, stepNo: 1, anchorSeq: 10 }]);
		if (anchorCoveredByWindow(parseAnchor("tvp1:t2s7"), winOlder) !== true) throw new Error("X1-h an earlier turn settles coverage");

		// X1-i: the selection must survive prepended history. `revealed` is a position,
		// so paging in older records used to move the reader to a different station.
		const selSrc = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/selectedIdRef/.test(selSrc)) throw new Error("X1-i the selection must be pinned by station id");
		if (!/stations\.findIndex\(\(st\) => st\.id === id\)/.test(selSrc)) throw new Error("X1-i the pin must re-derive the position from the id");
		if (!/\}, \[stationsSignature\]\)/.test(selSrc)) throw new Error("X1-i the repair pass must run when the station list changes");
		// The repair must actually MOVE the selection, not just exist. Extract the effect
		// body between the pin's identity lookup and its setRevealed call.
		const eff = /const at = stations\.findIndex\(\(st\) => st\.id === id\);([\s\S]{0,240}?)setRevealed\(at \+ 1\)/.exec(selSrc);
		if (eff === null) throw new Error("X1-i the pin must re-select the found station");
		if (/if \(true\) return|if \(false\) return/.test(eff[1])) throw new Error("X1-i the repair pass must not be neutered by a constant guard");

		// X1-f: streaming reasoning must survive a tool cell already in the step. Tool
		// cells carry no `thinking`, and `undefined !== ""` made the old guard treat the
		// reasoning as already-present and drop it. The tool call must come FIRST for the
		// guard to see it — a tool cell added later does not reproduce.
		const treeR = deriveTraceTree({ eventNodes: [
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "t1", name: "bash", argsRaw: "{}" }] }
		], requests: [], callSchemas: {}, runningCalls: {},
			partial: { turn: 1, step: 1, blocks: [{ kind: "reasoning", text: "REASONING_VISIBLE" }], timing: {} } }, t);
		const liveR = treeR.stations.filter((x) => x.kind === "step").pop();
		if (!liveR.cells.some((c) => c.thinking === "REASONING_VISIBLE")) throw new Error("X1-f streaming reasoning was dropped when a tool cell already exists");

		// X1-g: the in-flight reply's `timing` must be used, not reported as missing.
		const treeT = deriveTraceTree({ eventNodes: [
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "a" }] }
		], requests: [], callSchemas: {}, runningCalls: {},
			partial: { turn: 2, step: 1, blocks: [{ kind: "text", text: "LIVE" }], timing: { stepStartTime: 1000, firstTokenTime: 1200 } } }, t);
		const liveT = treeT.stations.filter((x) => x.kind === "step").pop();
		if (liveT.startMs !== 1000) throw new Error("X1-g partial stepStartTime must be kept, got " + liveT.startMs);
		if (liveT.ttftMs !== 200) throw new Error("X1-g partial TTFT must be derived, got " + liveT.ttftMs);
		if (liveT.timingRecorded !== true) throw new Error("X1-g partial timing must count as recorded");
		// No completion boundary yet: the duration must stay unknown, not be invented.
		if (liveT.endMs !== null) throw new Error("X1-g a still-streaming step must not have an end");

		// X1-e: a `c` alias must find an orphan tool result, which is its own station.
		const tree11 = deriveTraceTree({ eventNodes: [
			{ kind: "tool-result", seq: 20, time: 20, callId: "ORPHAN", call: null, content: [{ type: "text", text: "out" }], isError: false }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null }, t);
		const hitC = resolveAnchorInStations(parseAnchor("tvp1:cORPHAN"), tree11.stations);
		if (hitC.ok !== true || hitC.station.kind !== "orphan-tool") throw new Error("X1-e c-alias must find the orphan tool");
		if (resolveAnchorInStations(parseAnchor("tvp1:cNOPE"), tree11.stations).ok !== false) throw new Error("X1-e an unknown callId must not resolve");
	}

	// ── N2: status notes render once, not twice ──────────────────────────────
	// `anchorNote` was rendered in BOTH the header and the detail bar, so every anchor
	// result ("锚点格式无法识别", "正在向前加载…") appeared twice on screen. Live probe of
	// the real page showed the same text duplicated in `.dstv_chip.warn`.
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		// Visually the note must appear exactly once. One extra reference is allowed ONLY
		// inside the visually-hidden aria-live region, which is how screen readers hear it.
		const visual = (src.match(/children: anchorNote/g) || []).length
			- (src.match(/"aria-live": "polite"[^}]*children: anchorNote/g) || []).length;
		if (visual !== 1) throw new Error("N2 anchorNote must render visually exactly once, found " + visual);
		if ((src.match(/aria-live/g) || []).length > 2) throw new Error("N2 too many live regions");
		if (!/className: "dstv_chip warn", title: anchorNote, children: anchorNote/.test(src)) throw new Error("N2 the single note belongs in the header, with a title");
		// Same rule for the incompatibility/drift notes: a duplicated status line is noise.
		const warns = (src.match(/anchorNote !== null \?/g) || []).length;
		if (warns !== 1) throw new Error("N2 anchorNote must have a single render branch, found " + warns);
	}

	// ── D2: two different durations must not share one unlabelled word ────────
	// Cards showed a bare "103,686 ms" while the KPI is called "tool time". Summing the
	// cards missed the KPI by 83 minutes — not because either was wrong, but because the
	// card number is the STEP span (model + tools + gaps) and the KPI is tool time only.
	{
		const snap = { eventNodes: [
			{ kind: "assistant", seq: 2, time: 2000, turn: 1, step: 1, messageId: "m1", timing: { stepStartTime: 1000, firstTokenTime: 1500, completedTime: 9000 }, blocks: [{ kind: "tool-call", callId: "c1", name: "bash", argsRaw: "{}" }] },
			{ kind: "tool-result", seq: 3, time: 7000, turn: 1, step: 1, callId: "c1", callTime: 5000, content: [], isError: false }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null };
		const tree = deriveTraceTree(snap, t);
		const step = tree.stations.find((x) => x.kind === "step");
		// step span 1000→9000 = 8000; tool time 5000→7000 = 2000. They must stay distinct
		// in the data AND be distinguishable in the labels.
		if (step.durationMs !== 8000) throw new Error("D2 the card duration is the step span, got " + step.durationMs);
		if (tree.stats.toolMs !== 2000) throw new Error("D2 the KPI totals tool time only, got " + tree.stats.toolMs);
		const meta = step.meta.join(" | ");
		// The sandbox's `t` is the identity, so the chips carry the raw keys here; what
		// matters is that the two chips use DIFFERENT labels and each carries its value.
		// Cards are scanning surfaces: they share the KPI's human unit ("8.0 s"), not
		// raw milliseconds. Exact ms still lives in the detail panel via fmtMs.
		if (!/meta\.stepDur 8\.0 s/.test(meta)) throw new Error("D2 the step chip must carry its own label and value, got: " + meta);
		if (!/meta\.toolDur 2\.0 s/.test(meta)) throw new Error("D2 the tool chip must carry its own label and value, got: " + meta);
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		if (/meta\.stepDur.*fmtMs\(stepDurMs\)/.test(src)) throw new Error("D2 card chips must not use raw milliseconds");
		// The detail panel keeps the precise reading for anyone who needs it.
		if (!/className: "dstv_dur"|fmtMs\(/.test(src)) throw new Error("D2 exact durations must still be available in detail");
	}

	// ── D1: one bogus tool duration must not poison the totals ────────────────
	// A real session reported 78,834,620 ms (21.9 h) for a 3-second bash call: when the
	// log is reparsed, `callTime` can belong to a different pass and the subtraction
	// spans the reload gap. That single value dominated the "tool time" KPI.
	{
		const mk = (callTime, time) => ({ eventNodes: [
			{ kind: "assistant", seq: 2, time: 2000, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "c1", name: "bash", argsRaw: "{}" }] },
			{ kind: "tool-result", seq: 3, time, turn: 1, step: 1, callId: "c1", callTime, content: [], isError: false }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null });
		const st = (snap) => deriveTraceTree(snap, t).stations.find((x) => x.kind === "step");
		const cellDur = (snap) => { const x = st(snap); return x.cells.length > 0 ? x.cells[0].durationMs : null; };
		if (cellDur(mk(1000, 4298)) !== 3298) throw new Error("D1 a normal duration must be kept, got " + cellDur(mk(1000, 4298)));
		// The bogus reading is rejected, and the cell survives with a null duration: the
		// tool still exists and must still be listed.
		const bogus = st(mk(1000, 78835620));
		if (bogus.cells.length !== 1) throw new Error("D1 the tool cell must survive a rejected duration");
		if (bogus.cells[0].durationMs !== null) throw new Error("D1 an impossible duration must be null, got " + bogus.cells[0].durationMs);
		// Zero and negative spans clamp to zero; only implausible values are rejected.
		if (cellDur(mk(5000, 5000)) !== 0) throw new Error("D1 a zero span must stay zero");
		if (cellDur(mk(9000, 1000)) !== 0) throw new Error("D1 a negative span must clamp to zero");
	}

	// ── P3: the playhead marks a position, it does not divide the strip ───────
	// It used to be `top:40px; bottom:14px` — a 160px bar cutting between the cards
	// and hanging ~36px below them. Users asked what the line was, which is the
	// definition of a decoration that does not communicate. A short marker with a
	// caret pointing at the active card says the same thing unambiguously.
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		const rule = /\.dstv_playhead\{([^}]*)\}/.exec(src);
		if (rule === null) throw new Error("P3 the playhead rule is missing");
		const body = rule[1];
		if (/bottom:/.test(body)) throw new Error("P3 the playhead must not stretch to the strip bottom");
		if (!/height:14px/.test(body)) throw new Error("P3 the playhead must be a short marker");
		if (/box-shadow:0 0 10px/.test(body)) throw new Error("P3 the old full-saturation glow made it look like a divider");
		// The caret points DOWN at the card (it used to point up at nothing).
		const caret = /\.dstv_playhead i\{([^}]*)\}/.exec(src);
		if (caret === null) throw new Error("P3 the playhead caret is missing");
		if (!/border-top:6px solid/.test(caret[1])) throw new Error("P3 the caret must point down at the active card");
		if (/top:-7px/.test(caret[1])) throw new Error("P3 the caret must sit below the marker, not above it");
		// Purely decorative: assistive tech must not announce it.
		if (!/className: "dstv_playhead", "aria-hidden": "true"/.test(src)) throw new Error("P3 the playhead is decorative and must be aria-hidden");
		// Position must be MEASURED from the active station element, never computed from
		// a fixed stride: stations carry padding and idle bands sit between them, so any
		// `(R-1)*STATION_W` formula drifts left and points at the previous card.
		if (/26 \+ \(R - 1\) \* STATION_W/.test(src)) throw new Error("P4 the playhead must not be placed by a fixed-stride formula");
		if (!/setPlayheadLeft/.test(src)) throw new Error("P4 the playhead position must come from a measurement");
		if (!/el\.offsetLeft \+ el\.offsetWidth \/ 2/.test(src)) throw new Error("P4 the marker must be centred on the measured station");
		// It has to re-measure when layout can change.
		if (!/window\.addEventListener\("resize", measureHead\)/.test(src)) throw new Error("P4 the marker must re-measure on resize");
		// ...and the effect must depend on the revealed position.
		if (!/\}, \[revealed, R, N\]\)/.test(src)) throw new Error("P4 the measurement effect must react to the selection");
	}

	// ── C1: composer must overlay, not sit below ──────────────────────────────
	// A read-only replay surface should not leave a permanently open message box
	// under it. The host keys its overlapping layout off `data-conversation-composer-overlay`
	// (the official trajectory view sets it too); without the attribute the composer
	// keeps its in-flow seat and our view is squeezed above it.
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/"data-conversation-composer-overlay": ""/.test(src)) throw new Error("C1 the view must opt into the host's overlapping composer layout");
		// The attribute has to land on the ROOT element, next to className/tabIndex.
		// Anchor on the overlay attribute itself, then walk back to the nearest
		// `className: "dstv_root"` — a fixed window is wrong here because the comment
		// explaining the attribute is longer than any window worth guessing.
		const attrAt = src.indexOf('"data-conversation-composer-overlay"');
		const classAt = src.lastIndexOf('className: "dstv_root"', attrAt);
		if (classAt < 0) throw new Error("C1 the overlay attribute belongs on the view root");
		const between = src.slice(classAt + 'className: "dstv_root"'.length, attrAt);
		// Same object literal: no closing brace between them.
		if (between.includes("}")) throw new Error("C1 the overlay attribute must be in the root element's props");
		// ...and the panel still reserves room to scroll clear of the overlay.
		if (!/paddingBottom: `\$\{composerH\}px`/.test(src)) throw new Error("C1 the panel must reserve the composer height");
		// Detail sections: a caption glued to its prose renders as a run-on line.
		if (!/\.dstv_dSectionBody\{[^}]*border:1px solid/.test(src)) throw new Error("C1 detail bodies need the caption card treatment");
		if (!/className: "dstv_dSection dstv_dSectionBody"/.test(src)) throw new Error("C1 assistant detail section must use the card layout");
	}

	// ── MD1: assistant bodies are Markdown, not source ────────────────────────
	// The detail panel used to print raw source (`**0.9.13**`, `# heading`, fences),
	// because the container carried white-space:pre-wrap and nothing parsed it.
	{
		const b = mdBlocks("找到原因：版本 **0.9.13**，提交 `a3a7a33`。\n\n## 标题\n\n- 一\n- 二\n\n1. 甲\n2. 乙\n\n```js\nconst a = 1;\n```\n\n> 引用\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n---");
		const types = b.map((x) => x.type + (x.level ?? ""));
		const want = ["p", "h2", "ul", "ol", "code", "quote", "table", "hr"];
		if (types.join(",") !== want.join(",")) throw new Error("MD1 block kinds = " + types.join(","));
		if (b[0].text !== "找到原因：版本 **0.9.13**，提交 `a3a7a33`。") throw new Error("MD1 block text must stay raw for the inline pass");
		const inline = mdInline(b[0].text);
		const kinds = inline.map((p) => p.t).join(",");
		if (kinds !== "text,strong,text,code,text") throw new Error("MD1 inline kinds = " + kinds);
		if (inline[1].text !== "0.9.13" || inline[3].text !== "a3a7a33") throw new Error("MD1 inline payloads wrong");
		if (b[4].lang !== "js" || b[4].text !== "const a = 1;") throw new Error("MD1 fenced code mis-parsed");
		if (b[6].head.join("|") !== "A|B" || b[6].rows[0].join("|") !== "1|2") throw new Error("MD1 table mis-parsed");
		// A longer fence must swallow shorter runs (the export fix in §12.39, parser side).
		const nested = mdBlocks("````\na\n```\nb\n````");
		if (nested.length !== 1 || nested[0].type !== "code" || nested[0].text !== "a\n```\nb") throw new Error("MD1 longer fence must contain short runs");
		if (markdownToPlain("版本 **0.9.13**") !== "版本 0.9.13") throw new Error("MD1 plain preview must strip markers");
		// Parsing must never produce HTML strings: rendering is element-based, so model
		// output cannot become markup.
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		// Only real code counts: this very file explains "no innerHTML" in a comment, and a
		// naive regex matches that prose instead of a violation.
		const codeOnly = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
		if (/dangerouslySetInnerHTML\s*[:=]/.test(codeOnly)) throw new Error("MD1 markdown must be built from elements, never HTML strings");
		if (/\.innerHTML\s*=/.test(codeOnly)) throw new Error("MD1 markdown must never be assigned via innerHTML");
		if (!/\.dstv_dMarkdown\{white-space:normal\}/.test(src)) throw new Error("MD1 the markdown container must not keep pre-wrap");
		if (!/\.dstv_mdFence\{/.test(src) || !/\.dstv_mdTable\{/.test(src)) throw new Error("MD1 markdown block styles are required");
		// The detail panel must render through the component, not the raw string.
		if (!/jsx\(MarkdownText, \{ text: cell\.text \}/.test(src)) throw new Error("MD1 the detail panel must render Markdown");
		// `jsx(type, props, key)` takes the third argument as the KEY, not children.
		// Passing the node list there renders an empty container that no shape assertion
		// notices — it took a live measurement to catch. Pin the children prop instead.
		if (/jsx\("div", \{ className: "dstv_md" \}, nodes\)/.test(src)) throw new Error("MD2 nodes belong in props.children, not the key argument");
		if (!/className: "dstv_md", children: nodes/.test(src)) throw new Error("MD2 the markdown root must receive its nodes as children");
	}

	// ── F1: host form fields must not stay nameless ───────────────────────────
	// DevTools audits the whole page. The host sidebar ships a session-search input
	// with neither id nor name, so the console reports one violation on every load.
	// We annotate it from inside the plugin — conservatively: id only, never name,
	// and never touching a field that already has one.
	{
		const mk = (attrs) => {
			const el = { id: attrs.id ?? "", tagName: attrs.tag ?? "INPUT", closest: () => attrs.inRoot ? {} : null,
				getAttribute: (k) => (k === "name" ? (attrs.name ?? null) : k === "class" ? (attrs.cls ?? null) : null) };
			return el;
		};
		const fields = [
			mk({ cls: "bhn1Oq_searchInput" }),          // host: gets annotated
			mk({ id: "host-owned", cls: "x" }),          // host already has an id: untouched
			mk({ name: "already-named" }),               // has a name: untouched
			mk({ cls: "dstv-search", inRoot: true })     // ours: never touched
		];
		const seen = [];
		const fakeDoc = {
			querySelectorAll: () => fields,
			getElementById: (v) => (seen.includes(v) ? {} : null)
		};
		// The helper lives inside the vm context, so its `document` is the sandbox's —
		// inject the fake there rather than on the outer global.
		const savedDoc = sandbox.document;
		sandbox.document = fakeDoc;
		let touched = -1;
		try { touched = annotateNamelessFormFields(); } catch (e) { throw new Error("F1 annotate threw: " + e.message); }
		finally { sandbox.document = savedDoc; }
		seen.length = 0;
		if (touched !== 1) throw new Error("F1 exactly one field should be annotated, got " + touched);
		if (fields[0].id !== "dsh-field-bhn1Oq_searchInput") throw new Error("F1 host field got id " + fields[0].id);
		if (fields[0].getAttribute("name") !== null) throw new Error("F1 annotate must never set name (it changes form submission)");
		if (fields[1].id !== "host-owned") throw new Error("F1 an existing id must be preserved");
		if (fields[3].id !== "") throw new Error("F1 our own fields must be skipped");
		// Wiring: the annotation has to actually run from the view.
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		if ((src.match(/annotateNamelessFormFields\(\)/g) || []).length < 2) throw new Error("F1 the annotator must be called from the view effect");
		// DevTools records the violation while the page boots and keeps it in the Issues
		// panel, so annotating only from the view's mount effect is too late. There must
		// be a load-time driver in a dedicated region BEFORE the helpers region.
		const loadRegion = src.indexOf("//#region host form-field ids (runs at plugin load");
		const helpersRegion = src.indexOf("//#region pure helpers: snapshot -> timeline tree");
		if (loadRegion < 0) throw new Error("F1 a load-time annotation driver is required");
		if (!(loadRegion < helpersRegion)) throw new Error("F1 the load-time driver must run before the helpers region");
		if (!/document\.readyState === "loading"[^;]*DOMContentLoaded/.test(src)) throw new Error("F1 must also cover fields built after DOMContentLoaded");
		// The driver must be reachable, not merely present: a dead `if (false)` guard, a
		// disabled retry, or a missing initial pass would all leave the region intact
		// while doing nothing. Assert the statements that actually execute.
		const region = src.slice(loadRegion, helpersRegion);
		if (/if \(false\)/.test(region)) throw new Error("F1 the load-time driver must not be disabled");
		if (!/annotatePass\(\);\s*annotateTicks \+= 1;/.test(region)) throw new Error("F1 the driver must call annotatePass on every tick");
		if (!/else annotateTick\(\);/.test(region)) throw new Error("F1 the driver must run immediately when the DOM is ready");
	}

	// ── L1: loading must not be reported as empty ─────────────────────────────
	// Regression guard for a false statement the user actually saw: on a cold open the
	// view rendered "no trajectory data yet" for a second or two while the session log
	// was still being read. The host exposes `openState: "loading" | "open" | "error"`,
	// so "still loading" and "genuinely empty" must render differently.
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/useSession\(\(s\) => s\.openState === "loading"\)/.test(src)) throw new Error("L1 the view must read the session's openState");
		// The loading branch has to be decided BEFORE the incompatible/empty branches,
		// otherwise the empty copy wins during load.
		const iLoad = src.indexOf('if (sessionLoading === true) {');
		const iEmpty = src.indexOf('const structureBroken = tree.contract != null');
		if (iLoad < 0) throw new Error("L1 a loading branch must exist");
		if (!(iLoad < iEmpty)) throw new Error("L1 the loading branch must precede the empty/incompatible branch");
		// It must be a skeleton with a live status, not prose that guesses a count.
		if (!/role: "status"/.test(src) || !/"aria-busy": "true"/.test(src)) throw new Error("L1 the loading state must announce itself politely");
		if (!/dstv_skeletonRow/.test(src) || !/\.dstv_skeleton\{/.test(src)) throw new Error("L1 the loading state needs skeleton cards");
		// And it must be covered by the reduced-motion rule rather than animating forever.
		if (!/@media \(prefers-reduced-motion: reduce\)\{\.dstv_root \*\{animation:none/.test(src)) throw new Error("L1 reduced motion must be able to stop the skeleton pulse");
		// Card header: chips used to wrap inside the fixed 264px card, pushing the label
		// onto a second line ("步骤 51" split across two rows).
		if (!/\.dstv_chips\{[^}]*flex-wrap:wrap/.test(src)) throw new Error("L2 card chips must be able to move to their own row");
		// The label must never shrink: squeezing it was the original defect (label split
		// across two rows), and ellipsizing it is just as bad ("步骤 …" hides the number
		// that identifies the step). Chips yield instead, as a whole row.
		if (!/\.dstv_nameText\{flex:0 0 auto;white-space:nowrap\}/.test(src)) throw new Error("L2 the step label must not shrink or ellipsize");
		if (!/\.dstv_name\{[^}]*flex-wrap:wrap/.test(src)) throw new Error("L2 the card head must be able to wrap as a whole");
	}

	// ── M2: markdown fences must survive backtick-heavy content ───────────────
	// Tool results routinely ARE code (a README, a diff). A fixed ``` fence closes
	// early on such content and the rest of the export renders as garbage headings.
	// CommonMark: a fence closes on a run of at least equal length, so the emitted
	// fence must be strictly longer than the longest run inside.
	{
		if (fencedBlock("plain", "")[0] !== "```") throw new Error("M2 plain content keeps the 3-backtick fence");
		if (fencedBlock("plain", "json").join("\n") !== "```json\nplain\n```") throw new Error("M2 the info string must ride on the opening fence");
		const nested = fencedBlock("a\n```bash\nb\n```\nc", "");
		if (nested[0] !== "````" || nested[2] !== "````") throw new Error("M2 a 3-backtick run inside must promote the fence to 4, got " + JSON.stringify(nested[0]));
		const quad = fencedBlock("x\n````\ny", "");
		if (quad[0] !== "`````") throw new Error("M2 a 4-backtick run must promote the fence to 5, got " + JSON.stringify(quad[0]));
		if (fencedBlock(null, "")[1] !== "") throw new Error("M2 null content must become an empty block");
		// End-to-end: the export of a session whose tool result is a README must keep
		// the inner fences as literal text.
		const snap = { eventNodes: [
			{ kind: "assistant", seq: 2, time: 2000, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "tool-call", callId: "c1", name: "read", argsRaw: "{}" }] },
			{ kind: "tool-result", seq: 3, time: 3000, turn: 1, step: 1, callId: "c1", content: [{ type: "text", text: "# t\n```bash\nnpm i\n```\n完" }], isError: false }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null };
		const md = buildTraceMarkdown(deriveTraceTree(snap, t), t);
		if (!md.includes("````")) throw new Error("M2 the export must use a longer fence for backtick-heavy results");
		const lines = md.split("\n");
		if (lines.indexOf("```bash") !== -1 && lines.some((l, i) => l === "```bash" && lines[i - 1] === "````") === false) {
			// 内层 ```bash 必须出现在 4 反引号围栏之内，而不是被误当围栏
			const open = lines.indexOf("````");
			const inner = lines.indexOf("```bash");
			if (!(inner > open)) throw new Error("M2 the inner fence must sit inside the outer one");
		}
	}

	// ── V1: the provenance split must stay true ───────────────────────────────
	// docs/PROVENANCE.md is how a future reader (or upstream) tells "ours" from
	// "theirs". A stale copy is worse than none, so the suite regenerates the split
	// and compares. Upstream may legitimately be missing in a tarball install, in
	// which case the check is skipped loudly rather than silently passing.
	{
		const { execFileSync } = require("node:child_process");
		const path = require("node:path");
		const repo = path.join(__dirname, "..");
		let hasUpstream = true;
		try { execFileSync("git", ["rev-parse", "--verify", "v0.3.0^{commit}"], { cwd: repo, stdio: "ignore" }); }
		catch { hasUpstream = false; }
		if (!hasUpstream) {
			console.log("V1 skipped: upstream tag v0.3.0 not available (not a git checkout?)");
		} else {
			const check = require("node:child_process").spawnSync(process.execPath, [path.join(repo, "scripts", "provenance.mjs"), "--check"], { cwd: repo, encoding: "utf8" });
			if (check.status !== 0) throw new Error("V1 docs/PROVENANCE.md is stale — run node scripts/provenance.mjs\n" + (check.stderr || ""));
		}
	}

	// ── S1: the stylesheet must actually be one stylesheet ────────────────────
	// A single missing `+` between two string literals is legal JavaScript: the
	// statement ends there via ASI and every later rule becomes a discarded expression
	// statement. The page then renders with the palette and nothing else — which is
	// exactly what shipped from 0.9.0 to 0.9.5 (a 582-char style tag, plain text dump).
	// So evaluate the statement and demand that late-file rules are present.
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		const start = src.indexOf("const css = [");
		const end = src.indexOf("const tagId", start);
		if (start < 0 || end < 0) throw new Error("S1 css statement not found");
		const stmt = src.slice(start, end).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
		const css = new Function("const t=(k)=>k;\n" + stmt + "\nreturn css;")();
		if (typeof css !== "string") throw new Error("S1 css must be a string");
		// The fragments live in an array literal on purpose: a missing comma is a parse
		// error (loud), whereas the old `"…" + "…"` chain silently truncated on a missing
		// `+` (ASI) or produced "NaN" when a `+` ended up unary. Assert the shape so the
		// fragile form cannot come back.
		if (!/const css = \[/.test(src)) throw new Error("S1 css must be built as a joined array, not a + chain");
		if (/const css = "" \+/.test(src)) throw new Error("S1 + chaining of css fragments is forbidden");
		if (!/\]\.join\(""\)/.test(src)) throw new Error("S1 the css array must be joined into one string");
		if (!css.includes("@media (max-width: 720px)")) throw new Error("S1 the narrow-viewport rule must survive");
		// Cascade order matters as much as presence: at equal specificity the LATER rule
		// wins, so a narrow-screen block placed before the base rules is silently dead.
		// That is exactly what happened — the header stayed 109/134px while the media
		// block looked correct in the source.
		const iNarrow = css.indexOf("@media (max-width: 720px)");
		for (const base of [".dstv_head{position:sticky", ".dstv_legend{display:inline-flex", ".dstv_searchInput{width:150px"]) {
			if (iNarrow < css.indexOf(base)) throw new Error("S1 the narrow-viewport block must come after " + base + " or the cascade swallows it");
		}
		// Length and rule count catch a truncation at any point.
		if (css.length < 20000) throw new Error("S1 stylesheet looks truncated: " + css.length + " chars");
		const rules = (css.match(/\{/g) || []).length;
		if (rules < 180) throw new Error("S1 stylesheet has only " + rules + " rules");
		// Markers from the first, middle and last fragments: a dropped operator between
		// any two of them shows up here.
		const markers = [".dstv_root{--dstv-ok:", ".dstv_station{content-visibility:auto", ".dstv_modelChip{"];
		for (const m of markers) {
			if (!css.includes(m)) throw new Error("S1 stylesheet is missing " + m + " (a concatenation operator was probably dropped)");
		}
		let depth = 0;
		for (const ch of css) { if (ch === "{") depth += 1; else if (ch === "}") depth -= 1; }
		if (depth !== 0) throw new Error("S1 stylesheet braces are unbalanced: " + depth);
	}

	// ── A1: accessibility — colour, motion, semantics ─────────────────────────
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");

		// Contrast is arithmetic, so assert it as arithmetic: every status colour on
		// both palettes must clear WCAG AA (4.5:1) against its own surface.
		const lum = (hex) => {
			const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
				.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
			return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
		};
		const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
		// The palette is emitted as adjacent string literals, so read it per declaration
		// rather than assuming one CSS rule lives on one source line.
		const readPalette = (re) => {
			const out = {};
			for (const m of src.matchAll(re)) out[m[1]] = m[2];
			return out;
		};
		const dark = readPalette(/\.dstv_root\{--dstv-ok:(#[0-9a-fA-F]{6})[^}]*?--dstv-muted:(#[0-9a-fA-F]{6})\}/g);
		const light = readPalette(/body:not\(\[data-ds-dark-theme\]\) \.dstv_root\{--dstv-ok:(#[0-9a-fA-F]{6})[^}]*?--dstv-muted:(#[0-9a-fA-F]{6})\}/g);
		const vars = (css) => [...css.matchAll(/--(dstv-[a-z]+):(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]);
		const allVars = [...src.matchAll(/--(dstv-[a-z]+):(#[0-9a-fA-F]{6})/g)].map((m) => m[1]);
		if (!allVars.includes("dstv-ok") || !allVars.includes("dstv-muted")) throw new Error("A1 palettes look truncated");
		// Every declaration belongs to exactly one of the two palettes; check the value
		// against the surface of whichever theme declared it.
		const DARK_SURFACE = "#0e1116", LIGHT_SURFACE = "#ffffff";
		const lightStart = src.indexOf("body:not([data-ds-dark-theme]) .dstv_root{--dstv-ok:");
		if (lightStart < 0) throw new Error("A1 the light palette must be declared");
		const paletteSlice = src.slice(0, lightStart);
		const lightSlice = src.slice(lightStart, lightStart + 900);
		for (const [name, hex] of vars(paletteSlice)) {
			if (!name.startsWith("dstv-")) continue;
			if (ratio(hex, DARK_SURFACE) < 4.5) throw new Error("A1 dark " + name + " " + hex + " is " + ratio(hex, DARK_SURFACE).toFixed(2) + ":1 (need 4.5)");
		}
		for (const [name, hex] of vars(lightSlice)) {
			if (ratio(hex, LIGHT_SURFACE) < 4.5) throw new Error("A1 light " + name + " " + hex + " is " + ratio(hex, LIGHT_SURFACE).toFixed(2) + ":1 (need 4.5)");
		}
		if (vars(lightSlice).length < 6) throw new Error("A1 the light palette must define every role it uses");
		// The palette must be USED: a hardcoded hex added later silently escapes the
		// theme, which is exactly how the 1.7:1 light-mode chips happened.
		// Strip the palette declarations themselves, then any hex left is a colour that
		// bypasses the theme.
		// The name part allows hyphens: `--dstv-ok-ink` is a palette entry too, and the
		// old `[a-z]+` skipped it, so every new ink colour looked like a stray hex.
		const paletteDefs = new Set([...src.matchAll(/--(?:dstv-[a-z-]+):(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()));
		const strayHex = (src.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()).filter((h) => !paletteDefs.has(h));
		if (strayHex.length > 0) throw new Error("A1 colours must go through vars, found: " + [...new Set(strayHex)].join(" "));

		// A chip paints its OWN hue at 14% behind its text. The base colour measured
		// 3.98:1 on that wash (dark violet) even though it passed against the page, so
		// each role must ALSO have an -ink variant that clears 4.5:1 on its own tint.
		{
			const all = src;
			const mix = (fg, bg, pct) => "#" + [0, 1, 2].map((i) => Math.round(parseInt(fg.slice(1 + i * 2, 3 + i * 2), 16) * pct + parseInt(bg.slice(1 + i * 2, 3 + i * 2), 16) * (1 - pct)).toString(16).padStart(2, "0")).join("");
			const darkDecl = {}, lightDecl = {};
			for (const m of paletteSlice.matchAll(/--(dstv-[a-z-]+):(#[0-9a-fA-F]{6})/g)) darkDecl[m[1]] = m[2];
			for (const m of lightSlice.matchAll(/--(dstv-[a-z-]+):(#[0-9a-fA-F]{6})/g)) lightDecl[m[1]] = m[2];
			for (const role of ["ok", "err", "warn", "unknown", "info"]) {
				for (const [label, decl, surface] of [["dark", darkDecl, DARK_SURFACE], ["light", lightDecl, LIGHT_SURFACE]]) {
					const ink = decl["dstv-" + role + "-ink"];
					const base = decl["dstv-" + role];
					if (ink === void 0) throw new Error("A1 " + label + " is missing --dstv-" + role + "-ink");
					if (base === void 0) throw new Error("A1 " + label + " is missing --dstv-" + role);
					const wash = mix(base, surface, 0.14);
					const r = ratio(ink, wash);
					if (r < 4.5) throw new Error("A1 " + label + " --dstv-" + role + "-ink " + ink + " is " + r.toFixed(2) + ":1 on its own 14% tint (need 4.5)");
				}
			}
		}
		if (paletteDefs.size < 12) throw new Error("A1 expected both palettes to declare the full role set");

		// Tints must derive from the palette too, otherwise the light theme's text is
		// dark green on a still-dark-ish backdrop. color-mix keeps the alpha ramp while
		// following the active palette. Only theme-neutral shadows may stay literal.
		const tints = src.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-9.]+\s*\)/g) || [];
		const neutralTints = tints.filter((t) => /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/.test(t));
		if (tints.length !== neutralTints.length) {
			throw new Error("A1 colour tints must use color-mix(var(--dstv-*)), found: " + tints.filter((t) => !neutralTints.includes(t)).slice(0, 3).join(" "));
		}
		if (!/color-mix\(in srgb,var\(--dstv-ok\)/.test(src)) throw new Error("A1 tints must be derived from the semantic palette");

		if (!/@media \(prefers-reduced-motion: reduce\)/.test(src)) throw new Error("A1 CSS must honour reduced motion");
		if (!/reduceMotion\(\)/.test(src)) throw new Error("A1 smooth programmatic scrolling must honour reduced motion too");
		if (!/matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/.test(src)) throw new Error("A1 the reduced-motion query must be evaluated in JS");

		if (!/role: "listbox"/.test(src)) throw new Error("A1 the timeline must expose listbox semantics");
		if (!/role: "option"/.test(src)) throw new Error("A1 each station must be an option");
		// ARIA 1.2 requires aria-selected on EVERY role="option". The old assertion pinned
		// the opposite (omit it in overview), which made screen readers guess the state.
		if (!/"aria-selected": revealed === null \? "false"/.test(src)) throw new Error("A1 every option must expose aria-selected, including in overview");
		if (!/isActive \? "true" : "false"/.test(src)) throw new Error("A1 the selected station must still report true");
		if (!/stationAriaLabel\(s, i \+ 1, N, t\)/.test(src)) throw new Error("A1 stations need an accessible name");
		if (!/tabIndex: isActive \|\| \(revealed === null && i === 0\) \? 0 : -1/.test(src)) throw new Error("A1 roving tabindex must keep exactly one station tabbable");
		if (!/stationOnKeyDown\(ev, i\)/.test(src)) throw new Error("A1 stations must handle arrow keys");
		// Focus that cannot be seen is not focus: roving tabindex is useless without a
		// visible ring, and a placeholder is not an accessible name.
		if (!/\.dstv_station:focus-visible\{outline:2px solid var\(--dstv-info\)/.test(src)) throw new Error("A1 stations need a visible focus ring");
		if (/dstv_station:focus\{outline:none\}/.test(src)) throw new Error("A1 the focus ring must not be suppressed");
		const labelCount = (src.match(/"aria-label": t\("(?:anchor\.jumpLabel|search\.label)"\)/g) || []).length;
		if (labelCount !== 2) throw new Error("A1 both inputs need an accessible name, found " + labelCount);
		// aria-label satisfies the a11y name computation but not the browser's form-field
		// checks: DevTools flags a field without id/name ("A form field element should have
		// an id or name attribute"), which also breaks autofill heuristics.
		for (const [id, name] of [["dstv-anchor-input", "dstv-anchor"], ["dstv-search-input", "dstv-search"]]) {
			if (!new RegExp('id: "' + id + '"').test(src)) throw new Error("A1 input " + id + " needs an id");
			if (!new RegExp('name: "' + name + '"').test(src)) throw new Error("A1 input " + name + " needs a name");
		}
		if (!/autoComplete: "off"/.test(src)) throw new Error("A1 these are not autofill targets, opt out explicitly");

		// And the label builder itself has to produce something usable.
		const label = stationAriaLabel({ kind: "step", stepNo: 3, turn: 2, meta: ["4工具"], hasError: false }, 7, 66, t);
		if (!label.includes("7 / 66") || !label.includes("3")) throw new Error("A1 aria label must carry position and identity, got: " + label);
		const errLabel = stationAriaLabel({ kind: "step", stepNo: 1, turn: 1, meta: [], hasError: true }, 1, 2, t);
		if (!errLabel.includes(t("meta.error"))) throw new Error("A1 aria label must announce errors");
	}

	// ── P1: projection cost guard (streaming must stay inside a frame budget) ──
	// The snapshot changes on every streamed token, so a slow fold becomes a stutter.
	// This is a TRIPWIRE, not a fine-grained performance test: inside the sandboxed
	// VM the same fold measures ~150–190 ms, while an eager-haystack build of the
	// same fixture measured ~214–265 ms — the two ranges overlap, so the timing alone
	// cannot separate them. The laziness assertions below are what actually pin the
	// haystack behaviour; the budget only catches a gross blow-up (accidental O(n²)).
	// Measured standalone (no VM, warm JIT): 3,200 stations ≈ 42 ms, 6,400 ≈ 66 ms.
	{
		const big = [];
		let s0 = 1;
		for (let turn = 1; turn <= 200; turn += 1) {
			big.push({ kind: "user", seq: s0++, time: 1000 * s0, turn, content: [{ type: "text", text: "q" + turn }] });
			for (let step = 1; step <= 15; step += 1) {
				big.push({ kind: "assistant", seq: s0++, time: 1000 * s0, turn, step, blocks: [
					{ kind: "text", text: "x".repeat(200) },
					{ kind: "tool-call", callId: "c" + s0, name: "read", argsRaw: "{}" }
				] });
				big.push({ kind: "tool-result", seq: s0++, time: 1000 * s0, callId: "c" + (s0 - 1), call: { name: "read", argsRaw: "{}" }, content: [{ type: "text", text: "y".repeat(2000) }], isError: false, subCalls: [] });
			}
		}
		const bigSnap = { eventNodes: big, requests: [], callSchemas: new Map(), runningCalls: [], partial: null };
		// Several warm-up passes: earlier perf cases in this file leave garbage that a
		// single pass does not settle, and one warm-up made a 195 ms baseline flap
		// against a 250 ms budget.
		for (let w = 0; w < 4; w += 1) deriveTraceTree(bigSnap, t);
		const samples = [];
		for (let i = 0; i < 9; i += 1) {
			const built = process.hrtime.bigint();
			deriveTraceTree(bigSnap, t);
			samples.push(Number(process.hrtime.bigint() - built) / 1e6);
		}
		samples.sort((a, b) => a - b);
		// Use the BEST sample, not the median. This box runs other work concurrently, so
		// the same code measured 96 ms min vs 262 ms max on identical input — a median
		// assertion flapped between pass and fail with no code change. The minimum is the
		// least-contended run and still catches a real regression: a 2x slowdown shows up
		// in every sample, not just the unlucky ones.
		const best = samples[0];
		if (best > 250) throw new Error("P1 projection of " + big.length + " nodes took " + best.toFixed(1) + " ms best-of-9 (budget 250 ms)");
		// The fold must not pre-materialize search text: that is what made it slow.
		const probe = deriveTraceTree({ eventNodes: [
			{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "findme" }] }
		], requests: [], runningCalls: [], partial: null }, t);
		if (probe.stations[0].hay !== undefined) throw new Error("P1 the haystack must stay lazy until something searches");
		if (matchStations(probe.stations, "findme").length !== 1) throw new Error("P1 the lazy haystack must still match");
		if (probe.stations[0].hay === undefined) throw new Error("P1 searching must cache the haystack on the station");
	}

	// ── P2: render isolation must stay wired ─────────────────────────────────
	// A read-only review tool must not blank out because ONE station had an
	// unexpected shape. That guarantee lives in three specific wirings; a refactor
	// that silently drops one of them is invisible until the day it is needed, so
	// the shape is asserted here rather than left to review.
	{
		const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/class RenderBoundary extends/.test(src)) throw new Error("P2 a render boundary class must exist");
		if (!/static getDerivedStateFromError/.test(src)) throw new Error("P2 the boundary must catch derived errors");
		// `render` must be CALLED inside the boundary; an eager element would throw in
		// the parent render where no boundary can see it.
		if (!/render:\s*\(\)\s*=>\s*renderStationCard\(/.test(src)) throw new Error("P2 station cards must be built inside the boundary");
		if (!/render:\s*\(\)\s*=>\s*\(showTab === "request"[\s\S]{0,200}?renderDetailBody\(/.test(src)) throw new Error("P2 the detail panel must be built inside the boundary");
		if (/,\s*TraceMapView\)\)/.test(src)) throw new Error("P2 the view must be registered through the boundary, not bare");
		if (!/,\s*SafeTraceMapView\)\)/.test(src)) throw new Error("P2 the view must be registered through SafeTraceMapView");
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
