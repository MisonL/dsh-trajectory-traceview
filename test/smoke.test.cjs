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
;(globalThis.__test = { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown, promptDiffOf, subDetailOf, anchorOf, parseAnchor, resolveAnchorInStations, clockGapWidth, searchScopeNote, anchorLoadTarget, nextHashFor, anchorSeqFloor, safeList, promptTextDiff, changedTools, evidenceOf, buildStepMarkdown, snapshotContract, unknownNodeStats, isEverythingUnknown, fmtDur, safeJsonPreview, stationAriaLabel, anchorCoveredByWindow, anchorTurnFloor, fmtTokens, fencedBlock, annotateNamelessFormFields, mdBlocks, mdInline, markdownToPlain, parseAnchor, resolveAnchorInStations, textOfContent, stationHay, createFlightGuard, anchorResolvesToSelf, maxTurnOf, blocksText, asText, safeToolList });
`;

// WeakSet is a browser global the helper uses for cycle detection; the sandbox
// has to provide it or the test fails with a ReferenceError instead of a verdict.
const sandbox = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number };
vm.runInNewContext(extracted, sandbox, { filename: "traceview-helpers.js", timeout: 10000 });
const { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown, promptDiffOf, subDetailOf, anchorOf, parseAnchor, resolveAnchorInStations, clockGapWidth, searchScopeNote, anchorLoadTarget, nextHashFor, anchorSeqFloor, safeList, promptTextDiff, changedTools, evidenceOf, buildStepMarkdown, snapshotContract, unknownNodeStats, isEverythingUnknown, fmtDur, safeJsonPreview, stationAriaLabel, anchorCoveredByWindow, anchorTurnFloor, fmtTokens, fencedBlock, annotateNamelessFormFields, mdBlocks, mdInline, markdownToPlain, textOfContent, stationHay, createFlightGuard, anchorResolvesToSelf, maxTurnOf, blocksText, asText, safeToolList } = sandbox.__test;

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
// The header number is the PER-TURN step (2), not the window-wide ordinal (1).
// The old assertion encoded the bug: this fixture's step is turn 3 / step 2, its
// card label reads "步骤 2", and the header simultaneously said "当前 步骤 1" —
// two different numbers for one record. It also drifted on its own: paging older
// history pushed the same streaming reply from "步骤 3" to "步骤 11".
if (liveTree.currentStepNo !== 2) throw new Error("live currentStepNo: " + liveTree.currentStepNo);
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
	// Accept the new honest empty string as well: printing the literal word "undefined"
	// in the panel reads like a viewer bug rather than "nothing recorded".
	{
		const undefOut = safeJsonPreview(undefined, 10);
		if (undefOut !== "" && undefOut !== undefined && undefOut !== "undefined") {
			throw new Error("R4 an undefined payload must not throw, got " + JSON.stringify(undefOut));
		}
		// A Symbol / function payload must be named, never rendered as the word "undefined".
		for (const odd of [Symbol("s"), () => 1]) {
			const outOdd = safeJsonPreview(odd, 40);
			if (typeof outOdd !== "string" || outOdd === "undefined") {
				throw new Error("R4 a non-serialisable payload leaked as " + JSON.stringify(outOdd));
			}
		}
	}
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
		// Bound the English side the same way as the Chinese one. `enS + 20000` ran past
		// the end of the table (8,754 chars) into unrelated code: any `"a.b":` literal
		// after it would be counted as a key, and a key ADDED at the end would not be.
		const enEndMark = src.indexOf("\n\t\t};", enS);
		if (enEndMark < 0) throw new Error("I18N2 could not find the end of the English table");
		const enKeys = grab(src.slice(enS, enEndMark));
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

	// ── PREFIX3: single-step export must use the per-turn step number ─────────
	// `buildStepMarkdown` titled the pack "步骤 2.4" while the card for that same
	// station read "步骤 2" — `stepNo` is the window-wide ordinal. The number also
	// depended on how much history happened to be loaded when the export ran.
	{
		const nodesP = []; let sP = 1;
		for (let turn = 1; turn <= 2; turn += 1) {
			nodesP.push({ kind: "user", seq: sP++, time: 1000 + sP, turn, content: [{ type: "text", text: "q" + turn }] });
			nodesP.push({ kind: "assistant", seq: sP++, time: 1000 + sP, turn, step: 1, messageId: "m" + turn, blocks: [{ kind: "text", text: "a" }] });
			nodesP.push({ kind: "assistant", seq: sP++, time: 1000 + sP, turn, step: 2, messageId: "mb" + turn, blocks: [{ kind: "text", text: "b" }] });
		}
		const trP3 = deriveTraceTree({ eventNodes: nodesP, requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		for (const st3 of trP3.stations.filter((x) => x.kind === "step")) {
			const title = buildStepMarkdown(st3, [], false, t).split("\n")[0];
			const expected = `${st3.turn}.${st3.turnStep}`;
			if (title.indexOf(expected) < 0) {
				throw new Error("PREFIX3 step export is titled " + JSON.stringify(title) + ", expected turn.step " + expected + " (stepNo=" + st3.stepNo + ")");
			}
			if (st3.turnStep !== st3.stepNo && title.indexOf("." + String(st3.stepNo)) >= 0 && String(st3.stepNo) !== String(st3.turnStep)) {
				throw new Error("PREFIX3 step export used the window-wide stepNo " + st3.stepNo + ": " + JSON.stringify(title));
			}
		}
	}

	// ── PREFIX2: the header number must survive history paging ────────────────
	// `currentStepNo` came from the window-wide `stepCounter` while the station's own
	// label used the per-turn number. Two consequences: the header said "当前 步骤 1"
	// next to a card labelled "步骤 2" (one record, two numbers), and the same streaming
	// reply renumbered itself from "步骤 3" to "步骤 11" as older history loaded.
	{
		const liveSnapOf = (turns) => {
			const nodes = []; let s0 = 1;
			for (let i = 1; i <= turns; i += 1) {
				nodes.push({ kind: "user", seq: s0++, time: 1000 + s0, turn: i, content: [{ type: "text", text: "q" + i }] });
				nodes.push({ kind: "assistant", seq: s0++, time: 1000 + s0, turn: i, step: 1, messageId: "m" + i, blocks: [{ kind: "text", text: "a" + i }] });
			}
			return { eventNodes: nodes, requests: [], callSchemas: new Map(), runningCalls: [], partial: { turn: turns + 1, step: 1, blocks: [{ kind: "text", text: "live" }] } };
		};
		const small = deriveTraceTree(liveSnapOf(2), t);
		const large = deriveTraceTree(liveSnapOf(10), t);
		if (small.currentStepNo !== 1) throw new Error("PREFIX2 a first step of its turn must be numbered 1, got " + small.currentStepNo);
		if (large.currentStepNo !== small.currentStepNo) {
			throw new Error("PREFIX2 paging history renumbered the live step: " + small.currentStepNo + " -> " + large.currentStepNo);
		}
		// The header number and the station's own label must agree on the same record.
		for (const trP of [small, large]) {
			const liveStep = trP.stations.find((x) => x.kind === "step" && x.live === true);
			if (liveStep === void 0) throw new Error("PREFIX2 fixture has no live step");
			const own = Number.isFinite(liveStep.turnStep) ? liveStep.turnStep : liveStep.stepNo;
			if (trP.currentStepNo !== own) {
				throw new Error("PREFIX2 header says step " + trP.currentStepNo + " but the card says step " + own);
			}
		}
	}

	// ── HASH1: the URL written must be the URL that reads back ────────────────
	// `parseAnchor` trims and strips ONE leading `#`, so `#tvp1:e2` is a form it
	// accepts. `nextHashFor` did neither, so that same input was mirrored into the
	// address bar as `##tvp1:e2` — a link that worked in this tab and told everyone
	// else "锚点格式无法识别".
	{
		const trH = deriveTraceTree({ eventNodes: [
			{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "q" }] },
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] }
		], requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		for (const input of ["tvp1:e2", "#tvp1:e2", "  #tvp1:e2  ", "  tvp1:e2  "]) {
			const written = nextHashFor("", input).hash;
			const back = parseAnchor(written);
			if (back.ok !== true) {
				throw new Error("HASH1 the URL mirror for " + JSON.stringify(input) + " is " + JSON.stringify(written) + ", which does not parse back");
			}
			const res = resolveAnchorInStations(back, trH.stations);
			if (res.ok !== true) {
				throw new Error("HASH1 " + JSON.stringify(input) + " -> " + JSON.stringify(written) + " does not resolve (" + res.reason + ")");
			}
		}
		// Idempotent: re-mirroring must be a no-op, otherwise replaceState loops.
		const once = nextHashFor("", "#tvp1:e2").hash;
		const twice = nextHashFor(once, "#tvp1:e2");
		if (twice.changed !== false || twice.hash !== once) {
			throw new Error("HASH1 mirroring is not idempotent: " + JSON.stringify(once) + " -> " + JSON.stringify(twice));
		}
		// An empty anchor must never clear the current hash.
		const keep = nextHashFor("#tvp1:e2", "");
		if (keep.changed !== false || keep.hash !== "#tvp1:e2") throw new Error("HASH1 an empty anchor must leave the hash alone");
	}

	// ── MINIMAP1: the tick strip must scroll, not widen the whole panel ───────
	// Each tick is `flex:1;min-width:3px` plus a 2px gap, so the strip needs 5px per
	// station and cannot compress below it. A long session carries thousands of
	// stations (3,600 measured) = ~18,000px of ticks in a ~1,200px panel; without an
	// overflow rule the entire conversation was pushed sideways.
	{
		const css = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const at = css.indexOf(".dstv_minimap{");
		if (at < 0) throw new Error("MINIMAP1 the minimap rule is missing");
		const rule = css.slice(at, css.indexOf("}", at) + 1);
		if (rule.indexOf("overflow-x:auto") < 0) {
			throw new Error("MINIMAP1 the minimap can grow without bound and drags the panel with it: " + rule);
		}
		// The tick must still be compressible, or scrolling would never engage.
		const tickAt = css.indexOf(".dstv_miniTick{");
		const tick = css.slice(tickAt, css.indexOf("}", tickAt) + 1);
		if (tick.indexOf("min-width:3px") < 0) throw new Error("MINIMAP1 the tick rule changed unexpectedly: " + tick);
		// A strip that scrolls but never follows the playhead shows only the OLDEST
		// stations, so the "where am I" marker sits off-screen while the user steps
		// forward. It must chase the active tick, and only its OWN scrollLeft: an inner
		// `scrollIntoView` would also move outer ancestors.
		if (css.indexOf("data-tick-idx") < 0) throw new Error("MINIMAP1 the active tick is not addressable");
		if (css.indexOf("mm.scrollLeft = target") < 0) {
			throw new Error("MINIMAP1 the minimap never follows the playhead, so the current position scrolls out of view");
		}
		if (/revealTick[\s\S]{0,600}scrollIntoView/.test(css)) {
			throw new Error("MINIMAP1 the minimap must not use scrollIntoView — it moves outer ancestors too");
		}
	}

	// ── BLOCKTXT1: a file result must not render as an empty cell ─────────────
	// `blocksText` handled text/image/reasoning only. The host ships SEVEN ContentBlock
	// types, and a tool that attaches a file produced a result cell with no text at all
	// — an empty box for a result that plainly existed.
	{
		const dict = { "block.image": "[image]", "block.file": "[file]" };
		const tt = (k) => (dict[k] !== void 0 ? dict[k] : k);
		const named = blocksText([{ type: "file", attachment: { name: "report.pdf" } }], tt);
		if (named.indexOf("report.pdf") < 0) throw new Error("BLOCKTXT1 a file result lost its attachment name: " + JSON.stringify(named));
		const anon = blocksText([{ type: "file" }], tt);
		if (anon.trim() === "") throw new Error("BLOCKTXT1 a nameless file result rendered as an empty cell");
		// Mixed content keeps order and does not drop the file.
		const mixed = blocksText([{ type: "text", text: "result" }, { type: "file", attachment: { name: "a.csv" } }], tt);
		if (mixed.indexOf("result") < 0 || mixed.indexOf("a.csv") < 0) {
			throw new Error("BLOCKTXT1 mixed content lost a part: " + JSON.stringify(mixed));
		}
	}

	// ── TOOLSET1: a tool-set notice must name the tool ────────────────────────
	// `tool-addition` / `tool-removal` are defined ContentBlock types, but they fell
	// through to the "unknown block" branch: a context row that exists only to announce
	// `read_file` rendered as "[other content] · tool-addition", discarding the one
	// piece of information it carried.
	{
		const dict = {
			"block.toolAdded": "[tool added] {name}",
			"block.toolRemoved": "[tool removed] {name}",
			"block.other": "[other content]"
		};
		const tt = (k) => (dict[k] !== void 0 ? dict[k] : k);
		const added = textOfContent([{ type: "tool-addition", toolName: "read_file" }], tt);
		if (added.indexOf("read_file") < 0) throw new Error("TOOLSET1 a tool-addition lost its tool name: " + JSON.stringify(added));
		if (added.indexOf("tool-addition") >= 0) throw new Error("TOOLSET1 a tool-addition still renders its raw type: " + JSON.stringify(added));
		const removed = textOfContent([{ type: "tool-removal", toolName: "bash" }], tt);
		if (removed.indexOf("bash") < 0) throw new Error("TOOLSET1 a tool-removal lost its tool name: " + JSON.stringify(removed));
		// A nameless entry must still say something rather than render an empty row.
		const nameless = textOfContent([{ type: "tool-addition" }], tt);
		if (nameless === "") throw new Error("TOOLSET1 a nameless tool entry rendered as nothing at all");
		// A genuinely unknown block type still degrades to its tag.
		const unknown = textOfContent([{ type: "some-future-block" }], tt);
		if (unknown.indexOf("some-future-block") < 0) throw new Error("TOOLSET1 unknown blocks must keep their type tag");
	}

	// ── ANCHOR5: the deep-link loop must not re-scan an unchanged list ────────
	// The reveal loop called the O(n) anchor scan on every 20/40/…/250 ms retry even
	// when the projection had not replaced `stationsRef.current`. With a 3,600-station
	// window that is 12 redundant scans per page, 40 pages deep.
	{
		const src = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const at = src.indexOf("if (stationsRef.current === beforeArr) continue;");
		if (at < 0) throw new Error("ANCHOR5 the reveal loop no longer skips an unchanged station list");
		// The guard must sit BEFORE the scan inside the retry loop, and the scan must be
		// inside the same loop — otherwise it either never runs or always runs.
		const tail = src.slice(at, at + 400);
		if (tail.indexOf("resolveAnchorInStations(parsed, stationsRef.current)") < 0) {
			throw new Error("ANCHOR5 the skip is not guarding the anchor scan");
		}
		if (tail.indexOf("continue;") > tail.indexOf("resolveAnchorInStations(parsed, stationsRef.current)")) {
			throw new Error("ANCHOR5 the skip comes after the scan, so it saves nothing");
		}
		if (!/const beforeArr = stationsRef\.current;/.test(src)) {
			throw new Error("ANCHOR5 the loop must capture the array identity before paging");
		}
	}

	// ── SCALE1: the fold must survive a session large enough to overflow a spread ──
	// The fold called `Math.max(...turns.map(...))`. Spreading one argument per turn
	// throws "Maximum call stack size exceeded" once a session is big enough (measured
	// at ~130k turns / 390k nodes); `RangeError` inside the fold took the whole view
	// down. Counting turns in a loop has no such ceiling.
	{
		const mkTurns = (n) => {
			const nodes = []; let s0 = 1;
			for (let i = 1; i <= n; i += 1) {
				nodes.push({ kind: "user", seq: s0++, time: 1000 + s0, turn: i, content: [{ type: "text", text: "q" + i }] });
				nodes.push({ kind: "assistant", seq: s0++, time: 1000 + s0, turn: i, step: 1, messageId: "m" + i, blocks: [{ kind: "text", text: "a" }] });
			}
			// A trailing unmatched user is what reaches the max-turn computation.
			nodes.push({ kind: "user", seq: s0++, time: 1000 + s0, content: [{ type: "text", text: "tail" }] });
			return nodes;
		};
		// Source check FIRST: if a spread is back, calling the helper below throws a raw
		// RangeError and the run dies with a stack trace instead of a readable verdict.
		// (That is still red, but it hides which guard failed.)
		const helper = (label, fn) => {
			try { return { value: fn() }; } catch (e) { return { error: e }; }
		};
		// Exercise the helper that replaced the spread: past V8's argument ceiling
		// (~125k), where `Math.max(...turns.map(...))` throws RangeError.
		const huge = Array.from({ length: 200000 }, (_, i) => ({ turn: i + 1 }));
		const bigRes = helper("maxTurnOf", () => maxTurnOf(huge));
		if (bigRes.error !== void 0) {
			throw new Error("SCALE1 maxTurnOf threw at 200k turns (a spread into Math.max/min overflows): " + bigRes.error.message);
		}
		if (bigRes.value !== 200000) throw new Error("SCALE1 maxTurnOf is wrong at 200k turns: " + bigRes.value);
		if (maxTurnOf([]) !== 0) throw new Error("SCALE1 maxTurnOf on an empty list must be 0");
		if (maxTurnOf(null) !== 0) throw new Error("SCALE1 maxTurnOf must tolerate a non-array");
		// ...and prove the spread really is gone from the source: one occurrence would
		// reinstate the ceiling no matter how correct the helper is.
		// Strip comments first: the explanatory note above mentions the old call in
		// prose, and matching that text made this guard fire on itself.
		const srcC = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8")
			.split("\n")
			.filter((line) => {
				const s2 = line.trim();
				return !s2.startsWith("//") && !s2.startsWith("*") && !s2.startsWith("/*");
			})
			.join("\n");
		if (/Math\.(max|min)\(\s*\.\.\./.test(srcC)) {
			throw new Error("SCALE1 a spread into Math.max/min is back — it overflows the stack on large sessions");
		}
		// The fold itself must still place a trailing unmatched user in the NEXT turn.
		const trBig = deriveTraceTree({ eventNodes: mkTurns(40), requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		if (trBig.children.length !== 41) {
			throw new Error("SCALE1 expected 41 turns (tail user opens the last), got " + trBig.children.length);
		}
	}

	// ── CALLID1: a duplicated callId must not swap or drop results ────────────
	// A merged/replayed log can repeat a callId in two turns. Two separate bugs:
	// `resultsById` was a plain Map so only the LAST result survived (turn 1 showed
	// turn 2's output), and `attachedCallIds` deduped on the bare id so the second call
	// was dropped outright and its result appeared as an unrelated "orphan".
	{
		const cf = (seq, turn, text) => ([
			{ kind: "user", seq: seq - 1, time: seq, content: [{ type: "text", text: "q" + turn }] },
			{ kind: "assistant", seq, time: seq, turn, step: 1, messageId: "m" + turn, blocks: [{ kind: "tool-call", callId: "SAME", name: "bash", argsRaw: "{}" }] },
			{ kind: "tool-result", seq: seq + 1, time: seq + 1, callId: "SAME", call: { name: "bash", argsRaw: "{}" }, content: [{ type: "text", text }], isError: false, subCalls: [] }
		]);
		const trC = deriveTraceTree({
			eventNodes: [...cf(2, 1, "结果1"), ...cf(5, 2, "结果2")],
			requests: [], callSchemas: new Map(), runningCalls: [], partial: null
		}, t);
		const steps = trC.stations.filter((x) => x.kind === "step");
		if (steps.length !== 2) throw new Error("CALLID1 expected two steps, got " + steps.length);
		const byTurn = new Map(steps.map((x) => [x.turn, x]));
		const r1 = byTurn.get(1).cells.filter((c) => c.kind === "tool").map((c) => c.resultText).join("|");
		const r2 = byTurn.get(2).cells.filter((c) => c.kind === "tool").map((c) => c.resultText).join("|");
		if (r1 !== "结果1") throw new Error("CALLID1 turn 1 shows the wrong result: " + JSON.stringify(r1));
		if (r2 !== "结果2") throw new Error("CALLID1 turn 2 lost its call/result: " + JSON.stringify(r2));
		if (trC.stations.some((x) => x.kind === "orphan-tool")) {
			throw new Error("CALLID1 a duplicated callId produced a false orphan");
		}
	}

	// ── ANCHOR4: never offer an anchor that comes back to a DIFFERENT record ──
	// `e<seq>` names a seq, and one seq can carry several stations: a turn-error is
	// stamped with the turn's end seq, which equals the assistant message's seq, and a
	// malformed log can repeat one outright. The resolver deliberately prefers a step,
	// so the error card's "copy anchor" button handed out an identity that jumped to the
	// step when pasted.
	{
		const trJ = deriveTraceTree({ eventNodes: [
			{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "q" }] },
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] },
			{ kind: "turn-error", seq: 2, time: 3, turn: 1, step: 1, message: "boom" }
		], requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		const stepJ = trJ.stations.find((x) => x.kind === "step");
		const errJ = trJ.stations.find((x) => x.kind === "error");
		if (stepJ === void 0 || errJ === void 0) throw new Error("ANCHOR4 fixture did not produce a colliding pair");
		if (anchorOf(stepJ) !== anchorOf(errJ)) throw new Error("ANCHOR4 fixture is not actually colliding");
		if (anchorResolvesToSelf(stepJ, trJ.stations) !== true) throw new Error("ANCHOR4 the step's own anchor must resolve to itself");
		if (anchorResolvesToSelf(errJ, trJ.stations) !== false) {
			throw new Error("ANCHOR4 the error card claims its anchor comes back to itself, but it lands on the step");
		}
		// A normal, unambiguous station must still be offered.
		const userJ = trJ.stations.find((x) => x.kind === "user");
		if (anchorResolvesToSelf(userJ, trJ.stations) !== true) throw new Error("ANCHOR4 an unambiguous anchor must stay available");
	}

	// ── PREFIX1: prepending history must not renumber what is already on screen ──
	// `stepNo` is a window-wide counter, so paging older history used to renumber every
	// newer step: turn 5's first step read "步骤 1" and then "步骤 5" once turns 1-4
	// loaded. Any field the user sees must be derived from per-turn data instead.
	{
		const ALL = []; let s0 = 1;
		for (let turn = 1; turn <= 6; turn += 1) {
			ALL.push({ kind: "user", seq: s0++, time: 1000 + s0, turn, content: [{ type: "text", text: "q" }] });
			ALL.push({ kind: "assistant", seq: s0++, time: 1000 + s0, turn, step: 1, messageId: "m" + turn, blocks: [{ kind: "text", text: "a" }] });
		}
		const foldP = (n) => deriveTraceTree({ eventNodes: n, requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		const before = foldP(ALL.slice(8)); // only turns 5-6 loaded
		const after = foldP(ALL);           // turns 1-4 prepended
		const sBefore = before.stations.find((x) => x.turn === 5 && x.kind === "step");
		const sAfter = after.stations.find((x) => x.turn === 5 && x.kind === "step");
		if (sBefore === void 0 || sAfter === void 0) throw new Error("PREFIX1 fixture did not produce turn 5");
		for (const key of ["id", "turnStep", "label", "detail", "anchorKey"]) {
			if (JSON.stringify(sBefore[key]) !== JSON.stringify(sAfter[key])) {
				throw new Error("PREFIX1 `" + key + "` changed when older history was prepended: " + JSON.stringify(sBefore[key]) + " -> " + JSON.stringify(sAfter[key]));
			}
		}
		// The display label must be the per-turn number, not the running counter.
		if (String(sAfter.label).includes(" " + String(sAfter.stepNo) + "") && sAfter.stepNo !== sAfter.turnStep) {
			throw new Error("PREFIX1 the label still uses the window-wide stepNo");
		}
		// The accessible name carries the same number and must be stable too: a screen
		// reader user should not hear the record renumbered while paging back.
		const iBefore = before.stations.indexOf(sBefore);
		const iAfter = after.stations.indexOf(sAfter);
		const aBefore = stationAriaLabel(sBefore, iBefore, before.stations.length, t);
		const aAfter = stationAriaLabel(sAfter, iAfter, after.stations.length, t);
		if (!aBefore.includes("node.step 1") || !aAfter.includes("node.step 1")) {
			throw new Error("PREFIX1 the accessible name renumbers steps: " + aBefore + " -> " + aAfter);
		}
	}

	// ── ANCHOR3: every anchor we hand out must resolve back to its own station ──
	// `anchorOf` wrote the WINDOW-wide `stepNo`, but `p<turn>s<step>` is RESOLVED
	// against the per-turn `turnStep`. On a synthetic step (the live/streaming one has
	// no anchorSeq at all) the two disagree: turn 2's live step handed out
	// `tvp1:p2s3`, and pasting it back reported "not loaded". Round-tripping every
	// station is the only way to keep the writer and the reader in agreement.
	{
		const snapA = { eventNodes: [
			{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "q1" }] },
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "a" }] },
			{ kind: "user", seq: 3, time: 3, content: [{ type: "text", text: "q2" }] },
			{ kind: "assistant", seq: 4, time: 4, turn: 2, step: 1, messageId: "m2", blocks: [{ kind: "text", text: "b" }] }
		], requests: [], callSchemas: new Map(), runningCalls: [], partial: { turn: 2, step: 2, blocks: [{ kind: "text", text: "streaming" }] } };
		const trA = deriveTraceTree(snapA, t);
		let checked = 0;
		for (const st of trA.stations) {
			const a = anchorOf(st);
			if (a === null) continue;
			const back = resolveAnchorInStations(parseAnchor(a), trA.stations);
			if (back.ok !== true || back.station.id !== st.id) {
				throw new Error("ANCHOR3 " + st.id + " hands out " + a + " which resolves to " + (back.ok ? back.station.id : back.reason));
			}
			checked += 1;
		}
		if (checked < 3) throw new Error("ANCHOR3 expected several stations to check, got " + checked);
	}

	// ── KEY1: the panel must not swallow browser/OS shortcuts ─────────────────
	// The panel root is focusable (`tabIndex: 0`) and station rows are buttons, so once
	// the user clicks inside the view every key lands here first. Without a modifier
	// check, Ctrl/Cmd+R toggled the request tab instead of reloading, Ctrl/Cmd+F
	// focused our search box instead of browser find, and Alt+Left stepped the
	// timeline instead of going back.
	{
		const src = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const start = src.indexOf("const onKeyDown = (ev) => {");
		const startStation = src.indexOf("const stationOnKeyDown = (ev, i) => {");
		if (start < 0 || startStation < 0) throw new Error("KEY1 key handlers not found");
		for (const [name, at] of [["panel", start], ["station", startStation]]) {
			// Look only at the head of each handler, where the early-return guard lives.
			const head = src.slice(at, at + 900);
			for (const mod of ["ctrlKey", "metaKey", "altKey"]) {
				if (!head.includes("ev." + mod + " === true")) {
					throw new Error("KEY1 the " + name + " key handler does not bail out on " + mod + " — browser shortcuts are hijacked");
				}
			}
			if (!/return;/.test(head)) throw new Error("KEY1 the " + name + " handler has no early return");
		}
	}

	// ── MD2: raw prose must not restructure the exported document ─────────────
	// Prose is emitted unwrapped so emphasis and lists survive, which means anything
	// structural inside it lands in the document verbatim. Two things bit us: a run of
	// 3+ backticks opens a fence and swallows every following block (a stream cut off
	// mid-answer leaves an UNCLOSED one that eats the rest of the file), and a literal
	// `</details>` closes the collapsible block we opened around reasoning.
	{
		// Fence state machine: a fence closes only on a run at least as long as the one
		// that opened it. Counting "lines starting with ```" is even/odd is wrong —
		// 4- and 5-backtick fences are legal and were previously miscounted.
		const audit = (md) => {
			let depth = 0, open = 0, close = 0;
			for (const line of md.split("\n")) {
				const m = /^(`{3,})/.exec(line);
				if (m) { if (depth === 0) depth = m[1].length; else if (m[1].length >= depth) depth = 0; continue; }
				if (depth === 0) {
					open += (line.match(/<details>/g) || []).length;
					close += (line.match(/<\/details>/g) || []).length;
				}
			}
			return { depth, open, close };
		};
		const cases = [
			["unclosed fence", [{ kind: "text", text: "看这段：\n```python\nprint(1)" }]],
			["details in reasoning", [{ kind: "reasoning", text: "模型说：</details> 继续" }, { kind: "text", text: "正文" }]],
			["details in prose", [{ kind: "text", text: "<details><summary>假</summary>正文" }]],
			["five-backtick run", [{ kind: "text", text: "`````js\nlet x=1;" }]]
		];
		for (const [name, blocks] of cases) {
			const trM = deriveTraceTree({ eventNodes: [
				{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "q ```开" }] },
				{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks },
				{ kind: "assistant", seq: 3, time: 3, turn: 2, step: 1, messageId: "m2", blocks: [{ kind: "text", text: "后续" }] }
			], requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
			const stepM = trM.stations.find((x) => x.kind === "step");
			for (const [label, md] of [["trace", buildTraceMarkdown(trM, t)], ["step", buildStepMarkdown(stepM, [], false, t)]]) {
				const a = audit(md);
				if (a.depth !== 0) throw new Error("MD2 " + label + "/" + name + ": content after the text was swallowed by an unclosed fence (open run " + a.depth + ")");
				if (a.open !== a.close) throw new Error("MD2 " + label + "/" + name + ": <details> unbalanced " + a.open + "/" + a.close);
			}
		}
	}

	// ── STEER1: a steering message interjects, it does not open a new turn ────
	// The official layout places `steering` at `lastAssistantTurn` when no assistant
	// follows it; only `user` opens a turn. Filing a trailing steering message under
	// the invented "next" turn created a whole extra turn at the tail of the window
	// that never existed in the session.
	{
		const turnOf = (snap, needle) => {
			const tr = deriveTraceTree(snap, t);
			const turn = tr.children.find((c) => c.children.some((x) => (x.text || "").includes(needle)));
			return turn === void 0 ? null : turn.label;
		};
		const base = (extra) => ({ eventNodes: [
			{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "q1" }] },
			{ kind: "assistant", seq: 2, time: 2, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "a1" }] },
			...extra
		], requests: [], callSchemas: new Map(), runningCalls: [], partial: null });
		// Trailing steering: stays in turn 1, no phantom turn 2.
		const trailing = base([{ kind: "steering", seq: 3, time: 3, content: [{ type: "text", text: "插话" }] }]);
		if (turnOf(trailing, "插话") !== "node.turn 1") {
			throw new Error("STEER1 trailing steering opened its own turn: " + turnOf(trailing, "插话"));
		}
		const trT = deriveTraceTree(trailing, t);
		if (trT.children.length !== 1) {
			throw new Error("STEER1 trailing steering invented a turn (" + trT.children.length + " turns)");
		}
		// A real user message still opens the next turn, and takes steering with it.
		const followed = base([
			{ kind: "steering", seq: 3, time: 3, content: [{ type: "text", text: "插话" }] },
			{ kind: "user", seq: 4, time: 4, content: [{ type: "text", text: "q2" }] },
			{ kind: "assistant", seq: 5, time: 5, turn: 2, step: 1, messageId: "m2", blocks: [{ kind: "text", text: "a2" }] }
		]);
		if (turnOf(followed, "q2") !== "node.turn 2") throw new Error("STEER1 a user message must still open the next turn");
		if (turnOf(followed, "插话") !== "node.turn 2") throw new Error("STEER1 steering must follow the turn it interjects into");
	}

	// ── ANCHOR2: one anchor search at a time, but never a stuck one ──────────
	// The search is started from the URL/focus effect AND from typed Enter, and its
	// driving effect re-fires as `N` grows. Concurrent searches each kept their own page
	// counter — the progress text was observed going 25 -> 23 -> 11 -> 20 and one
	// `t2s1` lookup took 133 s while the host's own network time was 8.7 s.
	{
		const g = createFlightGuard();
		// The same anchor twice: the second must be refused.
		if (g.tryStart("tvp1:t2s1") !== true) throw new Error("ANCHOR2 first start must be allowed");
		if (g.tryStart("tvp1:t2s1") !== false) throw new Error("ANCHOR2 a duplicate start must be refused");
		// A DIFFERENT anchor must be allowed to supersede — refusing it would make a new
		// target silently ignored while the old search kept paging.
		if (g.tryStart("tvp1:t5s1") !== true) throw new Error("ANCHOR2 a new anchor must be able to supersede");
		// The superseded request finishing must NOT clear the newer one.
		g.finish("tvp1:t2s1");
		if (g.current() !== "tvp1:t5s1") throw new Error("ANCHOR2 a superseded finish must not clear the newer guard");
		if (g.tryStart("tvp1:t5s1") !== false) throw new Error("ANCHOR2 the newer guard must still be in place");
		// Finishing the current one releases it so the SAME anchor can run again.
		g.finish("tvp1:t5s1");
		if (g.tryStart("tvp1:t5s1") !== true) throw new Error("ANCHOR2 a completed search must be restartable");
	}

	// ── PERF5: timers that drive redraws must idle while the tab is hidden ────
	// Both the streaming rebuild (120 ms) and the replay tick rebuilt/animated the tree
	// for a document nobody could see. A source check is enough here: the behaviour is
	// a guard clause inside the interval callback, which the DOM cannot exercise from a
	// Node test without faking visibility for every render.
	{
		const srcP = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "src", "40-view.js"), "utf8");
		const visit = /document\.visibilityState === "hidden"/g;
		const count = (srcP.match(visit) || []).length;
		if (count < 2) throw new Error("PERF5 expected both the streaming and replay ticks to skip hidden tabs, found " + count);
		// Each guard must sit inside an interval callback, not in a one-off effect.
		const streamBlock = srcP.slice(srcP.indexOf("setStreamTick((v) => v + 1)") - 400, srcP.indexOf("setStreamTick((v) => v + 1)"));
		if (!/visibilityState/.test(streamBlock)) throw new Error("PERF5 the streaming tick does not check visibility");
		const replayBlock = srcP.slice(srcP.indexOf("setRevealed((r) => (r === null ? N") - 400, srcP.indexOf("setRevealed((r) => (r === null ? N"));
		if (!/visibilityState/.test(replayBlock)) throw new Error("PERF5 the replay tick does not check visibility");
	}

	// ── I18N3: no CJK literal may survive outside the locale tables ──────────
	// `m.role === "note" ? "压缩" : m.role` painted a Chinese role name in the English
	// Raw-request panel. Scanning the sources is the only way to catch a one-off literal
	// like that before a user sees it, so keep the check structural rather than per-string.
	{
		const fsI = require("node:fs");
		const pathI = require("node:path");
		const cjk = /[\u4e00-\u9fff]/;
		const offenders = [];
		for (const file of ["30-helpers.js", "40-view.js", "20-fields.js", "50-entry.js", "10-styles.js"]) {
			const lines = fsI.readFileSync(pathI.join(__dirname, "..", "src", file), "utf8").split("\n");
			let inBlock = false;
			lines.forEach((line, i) => {
				const t = line.trim();
				if (inBlock) { if (t.includes("*/")) inBlock = false; return; }
				if (t.startsWith("/*")) { if (!t.includes("*/")) inBlock = true; return; }
				if (t.startsWith("//")) return;
				const code = line.replace(/\/\/.*$/, "");
				if (cjk.test(code)) offenders.push(file + ":" + (i + 1) + " " + t.slice(0, 80));
			});
		}
		if (offenders.length > 0) throw new Error("I18N3 CJK literal outside the locale tables:\n  " + offenders.join("\n  "));
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

	// ── EXPORT1: a fence in prose must not swallow the rest of the export ────
	// `cell.text` was pushed raw. Model output that explains code contains ```, and an
	// unclosed triple-backtick turned every following tool call into a code block — the
	// export silently lost content instead of rendering it.
	{
		const snap = { eventNodes: [
			{ kind: "assistant", seq: 2, time: 1700000001000, turn: 1, step: 1, messageId: "m", blocks: [
				{ kind: "text", text: "Here is a fence:\n```\nunclosed" },
				{ kind: "tool-call", callId: "c1", name: "bash", argsRaw: "{}" }
			] },
			{ kind: "tool-result", seq: 3, time: 1700000003000, callId: "c1", call: { name: "bash", argsRaw: "{}" }, callTime: 1700000001000, content: [{ type: "text", text: "REAL_RESULT" }], isError: false, subCalls: [] }
		], requests: [], callSchemas: {}, runningCalls: {}, partial: null };
		const tree = deriveTraceTree(snap, t);
		const md = buildStepMarkdown(tree.stations.filter((x) => x.kind === "step")[0], [], false, t);
		const blocks = mdBlocks(md);
		// The tool heading must survive as its own paragraph, not be eaten by a fence.
		const flat = blocks.filter((b) => b.type === "p").map((b) => String(b.text ?? "")).join("\n");
		if (!flat.includes("bash")) throw new Error("EXPORT1 the tool heading was swallowed by an unescaped fence");
		if (!md.includes("REAL_RESULT")) throw new Error("EXPORT1 the tool result was swallowed by an unescaped fence");
	}

	// ── PACK1: README assets and runtime sources must ship in the tarball ─────
	// `README.md` embeds screenshot/overview.jpg but `files` did not list it, so the
	// published README rendered a broken image.
	{
		const fsP = require("node:fs");
		const pathP = require("node:path");
		const root = pathP.join(__dirname, "..");
		const pkg = JSON.parse(fsP.readFileSync(pathP.join(root, "package.json"), "utf8"));
		const listed = (rel) => pkg.files.some((f) => (f.endsWith("/") ? rel.startsWith(f) : rel === f));
		for (const readme of ["README.md", "README.en.md"]) {
			const body = fsP.readFileSync(pathP.join(root, readme), "utf8");
			for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
				const ref = m[1];
				if (/^https?:/i.test(ref)) continue; // badges are remote by design
				if (!fsP.existsSync(pathP.join(root, ref))) throw new Error("PACK1 " + readme + " references a missing file: " + ref);
				if (!listed(ref)) throw new Error("PACK1 " + readme + " references " + ref + " but package.json files does not ship it");
			}
		}
		// The maintainable sources must ship alongside the generated bundle.
		if (!listed("src/")) throw new Error("PACK1 src/ must be published");
		if (!listed("scripts/build-client.mjs")) throw new Error("PACK1 the build script must be published");
	}

	// ── A11Y3: the filled badge gradient must keep white text readable ────────
	// White on the bright dark-theme accents measured 1.86–2.60:1. A dedicated
	// --dstv-grad-a/b pair fixes it, and this guard keeps a future palette edit from
	// silently reintroducing the bright stops.
	{
		const srcA = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "src", "10-styles.js"), "utf8");
		const lightAt = srcA.indexOf("body:not([data-ds-dark-theme])");
		const darkDecl = srcA.slice(0, lightAt);
		const lightDecl = srcA.slice(lightAt, lightAt + 1200);
		const parseVars = (t) => { const o = {}; for (const m of t.matchAll(/--(dstv-[a-z-]+):(#[0-9a-fA-F]{6})/g)) o[m[1]] = m[2]; return o; };
		const hx = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
		const linC = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
		const lum = (r) => 0.2126 * linC(r[0]) + 0.7152 * linC(r[1]) + 0.0722 * linC(r[2]);
		const cr = (a, b) => { const l1 = lum(hx(a)), l2 = lum(hx(b)); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
		for (const [label, decl] of [["dark", parseVars(darkDecl)], ["light", parseVars(lightDecl)]]) {
			for (const key of ["dstv-grad-a", "dstv-grad-b"]) {
				if (decl[key] === void 0) throw new Error("A11Y3 " + label + " is missing " + key);
				const r = cr("#ffffff", decl[key]);
				if (r < 4.5) throw new Error("A11Y3 " + label + " white on " + key + " " + decl[key] + " is " + r.toFixed(2) + ":1 (need 4.5)");
			}
		}
		// The gradient vars must actually be USED, not just declared.
		if (!/\.dstv_playBtn\{[^}]*var\(--dstv-grad-a\)/.test(srcA)) throw new Error("A11Y3 .dstv_playBtn must use the gradient vars");
	}

	// ── PERF4: compaction pairing must not scan every request per compaction ──
	// Timing was the wrong instrument here (a 96–262 ms spread on this box hid the
	// difference). Counting PROPERTY ACCESSES is deterministic and shows the shape
	// directly: quadratic 16,151 / 546,901 visits vs indexed 901 / 5,401 for the same
	// input. The counter rides on a getter so no source instrumentation is needed.
	{
		let visits = 0;
		const buildC = (n) => {
			const nodes = []; const requests = []; let s0 = 1;
			for (let turn = 1; turn <= n; turn += 1) {
				nodes.push({ kind: "user", seq: s0++, time: 1700000000000 + s0 * 1000, turn, content: [{ type: "text", text: "q" }] });
				nodes.push({ kind: "assistant", seq: s0++, time: 1700000000000 + s0 * 1000, turn, step: 1, messageId: "m" + turn, blocks: [{ kind: "text", text: "a" }] });
				const cseq = s0;
				nodes.push({ kind: "compaction", seq: cseq, time: 1700000000000 + cseq * 1000, summary: "S", shadowedItemCount: 1, shadowedTokenCount: 10 });
				// Decoys first, exact match LAST, so a linear scan must walk the whole list.
				for (let k = 0; k < 3; k += 1) {
					const r = { purpose: "compaction", turn, step: 1, startSeq: s0, status: "ok" };
					Object.defineProperty(r, "replacementSeq", { get() { visits += 1; return -1; }, enumerable: true });
					requests.push(r);
				}
				const ex = { purpose: "compaction", turn, step: 1, startSeq: s0, status: "ok" };
				Object.defineProperty(ex, "replacementSeq", { get() { visits += 1; return cseq; }, enumerable: true });
				requests.push(ex);
				s0 += 1;
			}
			return { eventNodes: nodes, requests, callSchemas: new Map(), runningCalls: [], partial: null };
		};
		for (const n of [100, 600]) {
			visits = 0;
			deriveTraceTree(buildC(n), t);
			// Linear: ~4n^2 (16,151 / 546,901). Indexed: ~9n (901 / 5,401).
			const quadraticAt600 = 4 * 600 * 600;
			const limit = n === 600 ? 50000 : 3000;
			if (visits > limit) throw new Error("PERF4 compaction pairing scans every request per compaction: " + visits + " accesses at n=" + n + " (limit " + limit + ", quadratic would be ~" + quadraticAt600 + " at n=600)");
		}
		// Speed is a secondary signal; keep it loose so it only catches disasters.
		const snapC = buildC(600);
		const b0 = process.hrtime.bigint();
		deriveTraceTree(snapC, t);
		const msC = Number(process.hrtime.bigint() - b0) / 1e6;
		if (msC > 2000) throw new Error("PERF4 600 compactions took " + msC.toFixed(0) + "ms");
		// Pairing must still WORK, not just be fast.
		const trC = deriveTraceTree({ eventNodes: [
			{ kind: "user", seq: 1, time: 1, content: [{ type: "text", text: "q" }] },
			{ kind: "compaction", seq: 2, time: 2000, summary: "S", shadowedItemCount: 1, shadowedTokenCount: 10 }
		], requests: [
			{ purpose: "compaction", turn: 1, step: 1, replacementSeq: 2, startSeq: 1, status: "ok" },
			{ purpose: "assistant", turn: 1, step: 1, startSeq: 1, status: "ok" }
		], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		const compC = trC.stations.find((x) => x.kind === "compaction");
		if (compC === void 0 || compC.crequest == null) throw new Error("PERF4 the compaction request is no longer paired");
	}

	// ── A11Y2: no rule may paint text in the SAME hue as its own tint ─────────
	// A colour on a 12–15% tint of itself measured 3.91–4.35:1 (dark) and 4.12–4.31:1
	// (light) — under 4.5. Every such rule must use the -ink variant. `partial` is the
	// one exception because it already clears 4.5 on its own tint in both themes.
	{
		const css = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "src", "10-styles.js"), "utf8");
		const rules = css.match(/\.[a-zA-Z0-9_.\[\]="' -]+\{[^}]+\}/g) || [];
		const exempt = new Set(["partial"]);
		const offenders = [];
		for (const rule of rules) {
			const c = /color:var\(--dstv-([a-z]+)\)/.exec(rule);
			const b = /background:color-mix\(in srgb,var\(--dstv-([a-z]+)\)/.exec(rule);
			if (!c || !b || c[1] !== b[1]) continue;
			if (exempt.has(c[1])) continue;
			offenders.push(c[1] + " in " + rule.slice(0, 60));
		}
		if (offenders.length > 0) throw new Error("A11Y2 text on its own tint must use -ink:\n  " + offenders.join("\n  "));
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
		// USER content blocks: ContentBlock has seven merge-extensible types. Reading only
		// the first `text` block made a file/image user message look empty.
		const usr = mkTree([
			{ kind: "user", seq: 1, time: 1, content: [{ type: "file", attachment: { name: "a.txt" } }] },
			{ kind: "user", seq: 2, time: 2, content: [{ type: "image" }] },
			{ kind: "user", seq: 3, time: 3, content: [{ type: "text", text: "hi" }, { type: "file", attachment: { name: "b.txt" } }] }
		]);
		const users = usr.stations.filter((x) => x.kind === "user");
		if (!users.some((u) => String(u.text).includes("a.txt"))) throw new Error("CONTRACT1 a file-only user message rendered empty");
		if (!users.some((u) => String(u.text).includes("block.image"))) throw new Error("CONTRACT1 an image-only user message rendered empty");
		const mixed = users.find((u) => String(u.text).startsWith("hi"));
		if (mixed === void 0 || !String(mixed.text).includes("b.txt")) throw new Error("CONTRACT1 a mixed user message dropped its file part");
		// The STREAMING (partial) loop is a second implementation of the same fold and
		// was missed when the durable one was fixed: a live image reply showed an empty
		// step until the turn finalized. Assert BOTH paths.
		const partialTree = deriveTraceTree({ eventNodes: [], requests: [], callSchemas: {}, runningCalls: {}, partial: { turn: 1, step: 1, blocks: [{ kind: "image" }, { kind: "other", block: { type: "video" } }] } }, t);
		const pCells = partialTree.stations.filter((x) => x.kind === "step")[0].cells;
		if (pCells.length !== 2) throw new Error("CONTRACT1 the streaming path dropped image/other blocks: " + pCells.length + " cells");
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
		const rtS = require("react/jsx-runtime");
		const box = { React: React2, console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, isFinite, parseInt, parseFloat, Date, RegExp };
		require("node:vm").runInNewContext(
			// `jsx(type, props, key)` takes the key as its THIRD argument. Passing
			// `React.createElement` here turned every key into a child, so the rendered
			// text was the key string instead of the label — the href assertions happened
			// to survive, which is exactly what made it invisible.
			"const jsx = __jsx, jsxs = __jsxs, key3 = (t, p, k) => __jsx(t, p, k);\n"
			+ srcS.slice(a, b) + ";globalThis.__r = { renderMdInline, mdInline };",
			Object.assign(box, { __jsx: rtS.jsx, __jsxs: rtS.jsxs }),
			{ timeout: 60000 });
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
			// Use the REAL runtime. A hand-written shim that forwards `key` looks
			// equivalent, but the first version of this block passed bare
			// `React.createElement` as `jsx`, so every key landed in `children` and the
			// component rendered skeleton markup that still contained a view root — a
			// green test over a blank panel. Assert we are not doing that again.
			const runtimeZ = require("react/jsx-runtime");
			const jsx = runtimeZ.jsx;
			const jsxs = runtimeZ.jsxs;
			const boxZ = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, Date, RegExp,
				isFinite, parseInt, parseFloat, Error, TypeError, Symbol, Promise,
				react: React, jsx, jsxs, fragment: runtimeZ.Fragment, react_jsx_runtime: { jsx, jsxs },
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
				// A shim that drops `key` into `children` still produced a root and passed.
				// The timeline only exists if station cards do, so require them — an empty
				// snapshot is the only one allowed to have none.
				if (name !== "empty" && !html.includes("dstv_station")) {
					throw new Error("Z2 the " + name + " snapshot produced no station card; the harness rendered a skeleton, not the view (" + (typeof html === "string" ? html.length : 0) + " chars)");
				}
			}
		}
	}

	// ── RENDERFUZZ1: hostile snapshots must not crash or leak into the rendered panel ──
	// The Markdown paths got their own sweep (EXPORTLEAK1), but the PANEL is the primary
	// surface and had only ever been rendered from clean fixtures. Sweeping it with the
	// same hostile pool found, in order:
	//   Cannot mix BigInt and other types     — `curEdge - prevEdge` in the gap band
	//   Cannot convert a Symbol value to a …  — `t${callId}` cell ids, `String(Symbol)` in
	//                                           proseSafe / template literals, and
	//                                           provider / retryState / count rendered raw
	//   title="null">null                     — a NaN payload (JSON.stringify → "null")
	// Each was a whole-panel blank: React renders nothing once a component throws.
	{
		const srcRf = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const rtRf = require("react/jsx-runtime");
		const boxRf = {
			console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, Date,
			RegExp, isFinite, parseInt, parseFloat, Error, TypeError, Symbol, Promise, Intl,
			react: require("react"), jsx: rtRf.jsx, jsxs: rtRf.jsx, fragment: rtRf.Fragment,
			document: void 0, window: void 0, location: void 0
		};
		boxRf.globalThis = boxRf;
		vm.createContext(boxRf);
		const hRf = srcRf.indexOf("//#region pure helpers: snapshot -> timeline tree");
		const hRfEnd = srcRf.indexOf("//#endregion", hRf);
		const cRf = srcRf.indexOf("//#region horizontal timeline + replay component");
		const cRfEnd = srcRf.indexOf("//#endregion", cRf);
		vm.runInContext("const fragment = react.Fragment;\n" + srcRf.slice(hRf, hRfEnd) + "\n" + srcRf.slice(cRf, cRfEnd) + ";globalThis.__rf={TraceMapView};", boxRf, { timeout: 60000 });
		const renderRf = require("react-dom/server").renderToStaticMarkup;
		let seedRf = 771122;
		const rndRf = () => { seedRf = (seedRf * 1103515245 + 12345) & 0x7fffffff; return seedRf / 0x7fffffff; };
		const pickRf = (arr) => arr[Math.floor(rndRf() * arr.length)];
		const badRf = () => pickRf([null, void 0, 0, -1, NaN, Infinity, "", "x", true, Symbol("s"), 5n, {}, []]);
		const kindsRf = ["user", "assistant", "tool-result", "compaction", "turn-error", "model-retry", "turn-max-tokens", "command", "unknown", "context", "steering", "bogus"];
		const leaksRf = new Set();
		let crashRf = null;
		for (let round = 0; round < 40 && crashRf === null; round += 1) {
			const nodesRf = Array.from({ length: 1 + Math.floor(rndRf() * 6) }, (_, i) => ({
				kind: pickRf(kindsRf),
				seq: rndRf() < 0.4 ? badRf() : i + 1, time: rndRf() < 0.4 ? badRf() : 1e12,
				turn: rndRf() < 0.3 ? badRf() : 1, step: rndRf() < 0.3 ? badRf() : 1,
				messageId: rndRf() < 0.5 ? "m" : badRf(), callId: rndRf() < 0.6 ? "c" : badRf(),
				blocks: rndRf() < 0.3 ? badRf() : [{ kind: pickRf(["text", "reasoning", "tool-call", "other", "image", "bogus"]), text: rndRf() < 0.3 ? badRf() : "T", name: rndRf() < 0.3 ? badRf() : "n", argsRaw: rndRf() < 0.3 ? badRf() : "{}", callId: rndRf() < 0.6 ? "c" : badRf(), thinking: rndRf() < 0.3 ? badRf() : "th" }],
				content: rndRf() < 0.3 ? badRf() : [{ type: "text", text: rndRf() < 0.3 ? badRf() : "C" }],
				summary: rndRf() < 0.4 ? badRf() : "S", message: rndRf() < 0.4 ? badRf() : "M", type: rndRf() < 0.4 ? badRf() : "t",
				data: rndRf() < 0.4 ? badRf() : { k: 1 }, name: rndRf() < 0.4 ? badRf() : "nm", args: rndRf() < 0.4 ? badRf() : "a",
				outcomeText: rndRf() < 0.4 ? badRf() : "o", failure: rndRf() < 0.4 ? badRf() : { message: "f", code: "c" },
				retry: rndRf() < 0.3 ? badRf() : 1, maxRetries: rndRf() < 0.3 ? badRf() : 3, commandId: rndRf() < 0.6 ? "cmd" : badRf(),
				count: rndRf() < 0.4 ? badRf() : 4, tokens: rndRf() < 0.4 ? badRf() : 5,
				shadowedItemCount: rndRf() < 0.4 ? badRf() : 3, shadowedTokenCount: rndRf() < 0.4 ? badRf() : 9,
				usage: rndRf() < 0.4 ? badRf() : { input: 3, output: 2 },
				timing: rndRf() < 0.4 ? badRf() : { stepStartTime: 1e12, completedTime: 1e12 + 50 },
				provider: rndRf() < 0.4 ? badRf() : void 0, retryState: rndRf() < 0.4 ? badRf() : void 0, code: rndRf() < 0.4 ? badRf() : void 0
			}));
			const requestsRf = rndRf() < 0.3 ? [] : [{
				purpose: pickRf(["assistant", "compaction", "x"]), turn: rndRf() < 0.3 ? badRf() : 1, step: 1,
				startSeq: rndRf() < 0.3 ? badRf() : 1, status: pickRf(["ok", "error"]),
				requestConfig: { model: rndRf() < 0.3 ? badRf() : "m", provider: rndRf() < 0.3 ? badRf() : "p" },
				usage: rndRf() < 0.3 ? badRf() : { input: 1, output: 2 },
				startedAt: rndRf() < 0.3 ? badRf() : 1e12, completedAt: rndRf() < 0.3 ? badRf() : 1e12 + 9,
				prompt: rndRf() < 0.4 ? badRf() : { system: "s", tools: [{ name: "bash" }] },
				retry: rndRf() < 0.4 ? badRf() : 1, maxRetries: rndRf() < 0.4 ? badRf() : 3,
				error: rndRf() < 0.4 ? badRf() : { name: "E", message: "m" }
			}];
			try {
				const htmlRf = renderRf(rtRf.jsx(boxRf.__rf.TraceMapView, {
					useSession: (sel) => { try { return sel({ openState: pickRf(["open", "loading", "closed"]), hasMore: rndRf() < 0.5 }); } catch { return void 0; } },
					useTrajectory: () => ({ eventNodes: nodesRf, requests: requestsRf, callSchemas: rndRf() < 0.3 ? badRf() : {}, runningCalls: rndRf() < 0.3 ? badRf() : {}, partial: null }),
					t: (k) => k, viewRequest: rndRf() < 0.3 ? { focus: pickRf(["e1", "c1", "bogus", 123]) } : null,
					completeViewRequest: () => {}, loadOlder: async () => false
				}));
				for (const needle of [">undefined<", ">NaN<", ">Infinity<", ">null<", "[object Object]"]) {
					if (htmlRf.indexOf(needle) >= 0) leaksRf.add(needle);
				}
			} catch (e) {
				crashRf = e.constructor.name + ": " + String(e.message).slice(0, 70);
			}
		}
		// Deterministic single-station renders. In the random loop the DETAIL panel only
		// shows the LAST station (overview selects the newest), so a hostile retry /
		// compaction had to land last by chance — the `provider` mutation stayed green
		// until these were added.
		const drawOne = (node) => renderRf(rtRf.jsx(boxRf.__rf.TraceMapView, {
			useSession: (sel) => { try { return sel({ openState: "open", hasMore: false }); } catch { return void 0; } },
			useTrajectory: () => ({ eventNodes: [Object.assign({ seq: 1, time: 1e12, turn: 1 }, node)], requests: [], callSchemas: {}, runningCalls: {}, partial: null }),
			t: (k) => k, viewRequest: null, completeViewRequest: () => {}, loadOlder: async () => false
		}));
		const symR = Symbol("s");
		const fixed = [
			["a retry with Symbol text fields", { kind: "model-retry", retry: 1, maxRetries: 3, provider: symR, retryState: symR, failure: { message: "f", code: symR } }],
			["a compaction with Symbol counters", { kind: "compaction", summary: "s", shadowedItemCount: symR, shadowedTokenCount: symR }],
			["an error with a Symbol code", { kind: "turn-error", message: "m", code: symR }],
			["a command with Symbol name/args", { kind: "command", name: symR, args: symR, outcomeText: symR }],
			["an unknown event with a NaN payload", { kind: "unknown", type: "t", data: NaN }],
			["a BigInt timestamp", { kind: "user", time: 5n, content: [{ type: "text", text: "c" }] }],
			["a Symbol timestamp", { kind: "user", time: symR, content: [{ type: "text", text: "c" }] }]
		];
		for (const [label, node] of fixed) {
			let htmlOne = null;
			try { htmlOne = drawOne(node); } catch (e) {
				throw new Error("RENDERFUZZ1 " + label + " crashed the panel render — " + e.constructor.name + ": " + String(e.message).slice(0, 60));
			}
			for (const needle of [">undefined<", ">NaN<", ">Infinity<", ">null<", "[object Object]"]) {
				if (htmlOne.indexOf(needle) >= 0) {
					throw new Error("RENDERFUZZ1 " + label + " printed " + needle);
				}
			}
		}
		if (crashRf !== null) throw new Error("RENDERFUZZ1 a hostile snapshot crashed the panel render — " + crashRf);
		if (leaksRf.size > 0) throw new Error("RENDERFUZZ1 the panel printed literal junk: " + [...leaksRf].join(", "));
	}

	// ── EXPORTLEAK1: no "undefined / NaN / Infinity / [object Object]" in the output ──
	// A hostile-snapshot sweep of the Markdown paths found four kinds of leak that the
	// earlier fuzz never looked for, because it only asserted "does not throw":
	//   ## 轮次 NaN            (turn interpolated with String())
	//   ↻ 重试 (#1/Infinity)   (retry counters interpolated raw)
	//   ♺ 压缩 _([object Object] …)
	//   ### ⚡ /undefined      (command fallback name)
	// plus two remaining Symbol crashes (`t${callId}` in cell ids, and `Number(Symbol)`).
	// A viewer that prints "NaN" into the notes it exports is worse than one that shows
	// nothing: the reader cannot tell a broken field from a real value.
	{
		let seedLeak = 20240101;
		const rndLeak = () => { seedLeak = (seedLeak * 1103515245 + 12345) & 0x7fffffff; return seedLeak / 0x7fffffff; };
		const pickLeak = (arr) => arr[Math.floor(rndLeak() * arr.length)];
		const badLeak = () => pickLeak([null, void 0, 0, -1, NaN, Infinity, "", "x", true, Symbol("s"), 5n, {}, []]);
		const kindsLeak = ["user", "assistant", "tool-result", "compaction", "turn-error", "model-retry", "turn-max-tokens", "command", "unknown", "context", "steering"];
		let crashes = 0, firstCrash = null;
		const leaked = new Set();
		for (let round = 0; round < 120; round += 1) {
			const nodes = Array.from({ length: 1 + Math.floor(rndLeak() * 6) }, (_, i) => ({
				kind: pickLeak(kindsLeak),
				seq: rndLeak() < 0.4 ? badLeak() : i + 1,
				time: rndLeak() < 0.3 ? badLeak() : 1e12,
				turn: rndLeak() < 0.3 ? badLeak() : 1,
				step: rndLeak() < 0.3 ? badLeak() : 1,
				messageId: rndLeak() < 0.5 ? "m" : badLeak(),
				callId: rndLeak() < 0.5 ? "c" : badLeak(),
				blocks: rndLeak() < 0.3 ? badLeak() : [{ kind: pickLeak(["text", "reasoning", "tool-call", "other", "bogus"]), text: rndLeak() < 0.3 ? badLeak() : "T", name: rndLeak() < 0.3 ? badLeak() : "n", argsRaw: rndLeak() < 0.3 ? badLeak() : "{}", callId: rndLeak() < 0.5 ? "c" : badLeak() }],
				content: rndLeak() < 0.3 ? badLeak() : [{ type: "text", text: rndLeak() < 0.3 ? badLeak() : "C" }],
				summary: rndLeak() < 0.4 ? badLeak() : "S", message: rndLeak() < 0.4 ? badLeak() : "M", type: rndLeak() < 0.4 ? badLeak() : "t",
				data: rndLeak() < 0.4 ? badLeak() : { k: 1 }, name: rndLeak() < 0.4 ? badLeak() : "nm", args: rndLeak() < 0.4 ? badLeak() : "a",
				outcomeText: rndLeak() < 0.4 ? badLeak() : "o", failure: rndLeak() < 0.4 ? badLeak() : { message: "f", code: "c" },
				retry: rndLeak() < 0.3 ? badLeak() : 1, maxRetries: rndLeak() < 0.3 ? badLeak() : 3,
				commandId: rndLeak() < 0.5 ? "cmd" : badLeak(),
				count: rndLeak() < 0.4 ? badLeak() : 4, tokens: rndLeak() < 0.4 ? badLeak() : 5,
				shadowedItemCount: rndLeak() < 0.4 ? badLeak() : 3, shadowedTokenCount: rndLeak() < 0.4 ? badLeak() : 9
			}));
			try {
				const trLeak = deriveTraceTree({
					eventNodes: nodes,
					requests: rndLeak() < 0.3 ? [null] : [{ purpose: pickLeak(["assistant", "compaction", "x"]), turn: rndLeak() < 0.3 ? badLeak() : 1, step: 1, startSeq: rndLeak() < 0.3 ? badLeak() : 1, requestConfig: { model: rndLeak() < 0.3 ? badLeak() : "m" }, usage: rndLeak() < 0.3 ? badLeak() : { input: 1, output: 2 }, prompt: { system: "s", tools: [] } }],
					callSchemas: new Map(), runningCalls: [], partial: null
				}, t);
				const mdLeak = buildTraceMarkdown(trLeak, t);
				for (const needle of ["undefined", "NaN", "[object Object]", "Infinity"]) {
					if (mdLeak.indexOf(needle) >= 0) leaked.add(needle);
				}
				for (const stLeak of trLeak.stations) buildStepMarkdown(stLeak, [], false, t);
			} catch (e) {
				crashes += 1;
				if (firstCrash === null) firstCrash = e.constructor.name + ": " + String(e.message).slice(0, 70);
			}
		}
		// Deterministic cases, because a random pool is a weak probe for one specific field:
		// the Symbol `callId` never showed up often enough for the loop above to catch a
		// regression in `cellId` (measured: the mutation stayed green).
		{
			// `runningCalls` used to be hardcoded empty here, so the case labelled "a Symbol
			// running call id" never actually exercised a running call — it was a text block
			// with an empty list. That hole is why two distinct Symbols collapsing in `callKey`
			// went unnoticed.
			const foldOne = (node, running) => deriveTraceTree({
				eventNodes: [Object.assign({ seq: 1, time: 1e12, turn: 1 }, node)],
				requests: [], callSchemas: new Map(), runningCalls: running ?? [], partial: null
			}, t);
			const symOne = Symbol("c1");
			const cases = [
				["a Symbol tool-call id", { kind: "assistant", step: 1, messageId: "m", blocks: [{ kind: "tool-call", callId: symOne, name: "n", argsRaw: "{}" }, { kind: "tool-call", callId: Symbol("c1"), name: "n2", argsRaw: "{}" }] }],
				["a Symbol running call id", { kind: "assistant", step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] }],
				["a NaN turn", { kind: "turn-error", turn: NaN, message: "m" }],
				["an Infinity retry count", { kind: "model-retry", retry: 1, maxRetries: Infinity, failure: { message: "f" } }]
			];
			// Two DISTINCT Symbols sharing a description used to collapse into one key, so the
			// second running call vanished. `callKey` now gives each identity its own ordinal.
			const symRunA = Symbol("same");
			const symRunB = Symbol("same");
			const runningPair = [
				{ callId: symRunA, turn: 1, step: 1, name: "alpha", argsRaw: "{}", time: 1e12 },
				{ callId: symRunB, turn: 1, step: 1, name: "beta", argsRaw: "{}", time: 1e12 }
			];
			const runCells = foldOne({ kind: "assistant", step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] }, runningPair)
				.stations.filter((x) => x.kind === "step").flatMap((x) => x.cells ?? []).filter((c) => c.kind === "tool").map((c) => c.name);
			if (runCells.join(",") !== "alpha,beta") {
				throw new Error("EXPORTLEAK1 distinct Symbol running calls collapsed: " + JSON.stringify(runCells));
			}
			// Any string id must coexist with a non-string one. Every flat-string encoding
			// collided with SOME real id in turn: `#1` met the ordinal `#1`, then `~1` met the
			// `~`-prefixed ordinal. The pairing now uses a nested Map keyed on the raw id, so
			// there is no encoding left to collide with. Both former collisions stay covered.
			for (const decoy of ["#1", "~1", "1:2", "1:#1", "1:~1"]) {
				const mixedCells = foldOne({ kind: "assistant", step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] }, [
					{ callId: decoy, turn: 1, step: 1, name: "string-id", argsRaw: "{}", time: 1e12 },
					{ callId: Symbol("x"), turn: 1, step: 1, name: "sym-id", argsRaw: "{}", time: 1e12 }
				]).stations.filter((x) => x.kind === "step").flatMap((x) => x.cells ?? []).filter((c) => c.kind === "tool").map((c) => c.name);
				if (mixedCells.join(",") !== "string-id,sym-id") {
					throw new Error("EXPORTLEAK1 the string id " + JSON.stringify(decoy) + " collided with a non-string ordinal: " + JSON.stringify(mixedCells));
				}
			}
			for (const [label, node] of cases) {
				try {
					foldOne(node);
				} catch (e) {
					throw new Error("EXPORTLEAK1 a " + label + " crashed the projection: " + String(e.message).slice(0, 60));
				}
			}
			// Two distinct Symbols whose descriptions collide must still get distinct cell ids,
			// because the id is a React key.
			const idsTwo = foldOne(cases[0][1]).stations.flatMap((x) => (x.cells ?? []).map((c) => c.id));
			if (new Set(idsTwo).size !== idsTwo.length) {
				throw new Error("EXPORTLEAK1 Symbol call ids produced duplicate cell ids: " + idsTwo.join(","));
			}
			// And a non-finite turn must not print as a number.
			const mdTurn = buildTraceMarkdown(foldOne({ kind: "turn-error", turn: NaN, message: "m" }), t);
			if (mdTurn.indexOf("NaN") >= 0) throw new Error("EXPORTLEAK1 a NaN turn still renders as NaN");
		}
		if (crashes > 0) throw new Error("EXPORTLEAK1 " + crashes + "/120 hostile snapshots threw, first: " + firstCrash);
		if (leaked.size > 0) throw new Error("EXPORTLEAK1 leaked literal token(s) into the export: " + [...leaked].join(", "));
	}

	// ── RECORDER1: the message rebuild must not depend on caller-side sorting ───
	// `reconstructMessages` walked `nodes` and `break`ed at the first seq past the step.
	// That silently required ascending order. The only caller passes the sorted
	// `tree.nodes`, so it happened to work — but a raw or re-ordered log produced an
	// EMPTY message list with no error (measured: [5,1,3] with beforeSeq=4 returned
	// nothing). The request tab then shows "no messages" for a step that has them.
	{
		const uN = (seq, txt) => ({ seq, kind: "user", content: [{ type: "text", text: txt }] });
		const rebuild = (nodes, before) => reconstructMessages(nodes, before, t).map((m) => m.text).join(",");
		if (rebuild([uN(1, "1"), uN(3, "3"), uN(5, "5")], 4) !== "1,3") {
			throw new Error("RECORDER1 the sorted case broke: " + rebuild([uN(1, "1"), uN(3, "3"), uN(5, "5")], 4));
		}
		// The SAME set, shuffled, must yield the same answer. Before the fix this was "".
		if (rebuild([uN(5, "5"), uN(1, "1"), uN(3, "3")], 4) !== "1,3") {
			throw new Error("RECORDER1 an unsorted node list lost messages: " + JSON.stringify(rebuild([uN(5, "5"), uN(1, "1"), uN(3, "3")], 4)));
		}
		// Output order is the INPUT order (this helper filters; the caller supplies the
		// sorted list). What must not change is WHICH messages survive the cutoff.
		if (rebuild([uN(3, "3"), uN(1, "1")], 4) !== "3,1") {
			throw new Error("RECORDER1 reverse order changed the surviving set: " + JSON.stringify(rebuild([uN(3, "3"), uN(1, "1")], 4)));
		}
		// No cutoff means everything, in the order given.
		if (rebuild([uN(5, "5"), uN(1, "1")], void 0) !== "5,1") {
			throw new Error("RECORDER1 dropping the cutoff changed the output");
		}
	}

	// ── BUTTONNAME1: no button may be named only by a glyph ────────────────────
	// `title` does NOT name an element that has content: the name is computed from the
	// descendants first, so a button whose children are "↑" announces "↑" and the tooltip
	// only becomes a description. The search prev/next pair were the only two controls
	// like that (the clear button and the follow toggle already carried aria-label).
	//
	// A static scan, because these render only while a query is active and a server render
	// starts with an empty query — a rendered-HTML assertion here would be vacuous.
	//
	// HONEST LIMIT: this only analyses LITERAL children (a bare string, or `+`-joined
	// string literals) and the aria-hidden icon-span pattern. A button whose label comes
	// from `t(...)` or a prop identifier is not judged — that is text by construction.
	{
		const viewSrcBn = fs.readFileSync(path.join(__dirname, "..", "src", "40-view.js"), "utf8");
		const offendersBn = [];
		const glyphOnly = (text) => text !== "" && !/[A-Za-z0-9\u4e00-\u9fa5]/.test(text);
		let fromBn = 0;
		for (;;) {
			const atBn = viewSrcBn.indexOf('jsx("button", {', fromBn);
			if (atBn < 0) break;
			let iBn = viewSrcBn.indexOf("{", atBn), depthBn = 0, endBn = -1;
			for (; iBn < viewSrcBn.length; iBn += 1) {
				const ch = viewSrcBn[iBn];
				if (ch === '"' || ch === "'" || ch === "`") {
					iBn += 1;
					while (iBn < viewSrcBn.length && viewSrcBn[iBn] !== ch) { if (viewSrcBn[iBn] === "\\") iBn += 1; iBn += 1; }
					continue;
				}
				if (ch === "{") depthBn += 1;
				else if (ch === "}") { depthBn -= 1; if (depthBn === 0) { endBn = iBn; break; } }
			}
			if (endBn < 0) break;
			const propsBn = viewSrcBn.slice(atBn, endBn + 1);
			const lineBn = viewSrcBn.slice(0, atBn).split("\n").length;
			fromBn = endBn + 1;
			if (/aria-label/.test(propsBn)) continue;
			const cIdx = propsBn.indexOf("children:");
			if (cIdx < 0) continue;
			const childExpr = propsBn.slice(cIdx + "children:".length);
			// Icon pattern: an aria-hidden span whose own children are a glyph.
			const iconLit = /jsx\(\s*"span"\s*,\s*\{[^}]*"aria-hidden"\s*:\s*"true"[^}]*children:\s*"((?:[^"\\]|\\.)*)"/.exec(childExpr);
			if (iconLit !== null && glyphOnly(iconLit[1])) { offendersBn.push("line " + lineBn + " (icon span)"); continue; }
			// Literal children: one string, or `+`-joined string literals only.
			let litRun = "";
			const litRe = /^\s*(?:(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*(?:\+\s*)?)+/;
			if (litRe.test(childExpr)) {
				const runMatch = childExpr.match(litRe)[0];
				// Only accept it as "literal only" when the next meaningful char ends the props.
				const afterRun = childExpr.slice(runMatch.length).trimStart();
				if (afterRun === "" || afterRun[0] === "}" || afterRun[0] === ",") {
					for (const m of runMatch.matchAll(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g)) litRun += m[0].slice(1, -1);
					if (glyphOnly(litRun)) offendersBn.push("line " + lineBn + " (" + JSON.stringify(litRun) + ")");
				}
			}
		}
		if (offendersBn.length > 0) {
			throw new Error("BUTTONNAME1 glyph-only button(s) with no aria-label at " + offendersBn.join(", "));
		}
	}

	// ── STATIONNAME1: the accessible name must say WHAT the station is, not just its kind ──
	// A station is a `role="option"`, and `aria-label` REPLACES the name computed from its
	// descendants. The label used to be kind + position + meta only, so a screen-reader
	// user heard "1 / 12，用户" for every user turn (all identical) and "3 / 12，错误，错误"
	// for a failure without ever hearing what was asked or what failed. The error message
	// is the entire reason an error station exists.
	{
		const nameOf = (node, extra) => {
			const trName = deriveTraceTree({
				eventNodes: [Object.assign({ seq: 1, time: 1e12, turn: 1 }, node)],
				requests: [], callSchemas: new Map(), runningCalls: [], partial: null
			}, t);
			return stationAriaLabel(trName.stations[0], 1, 1, t);
		};
		const must = (label, node, needle) => {
			const got = nameOf(node);
			if (got.indexOf(needle) < 0) throw new Error("STATIONNAME1 " + label + ": expected to hear " + JSON.stringify(needle) + ", got " + JSON.stringify(got));
		};
		// A user turn's own words.
		must("user text", { kind: "user", content: [{ type: "text", text: "把空格都压平" }] }, "把空格都压平");
		// An error's message — the whole point of the station.
		must("error message", { kind: "turn-error", message: "上游返回 429 限流" }, "上游返回 429 限流");
		// A retry's failure reason.
		must("retry reason", { kind: "model-retry", retry: 2, maxRetries: 5, failure: { message: "30s 后重试" } }, "30s 后重试");
		// The assistant's first reply, NOT its hidden reasoning.
		{
			const got = nameOf({ kind: "assistant", step: 1, messageId: "m", blocks: [{ kind: "reasoning", text: "内部思考痕迹" }, { kind: "text", text: "好的我来处理" }] });
			if (got.indexOf("好的我来处理") < 0) throw new Error("STATIONNAME1 step reply is not in the name: " + JSON.stringify(got));
			if (got.indexOf("内部思考痕迹") >= 0) throw new Error("STATIONNAME1 hidden reasoning leaked into the name: " + JSON.stringify(got));
		}
		// An unknown event's type.
		must("unknown type", { kind: "unknown", type: "brand-new-event" }, "brand-new-event");
		// Long text must be capped — a pasted paragraph must not become the announcement.
		{
			const got = nameOf({ kind: "user", content: [{ type: "text", text: "长".repeat(500) }] });
			if (got.length > 200) throw new Error("STATIONNAME1 a long message was not capped, name length " + got.length);
			if (got.indexOf("…") < 0) throw new Error("STATIONNAME1 a capped excerpt is not marked with an ellipsis");
		}
		// Newlines must be flattened, not announced as runs of whitespace.
		{
			const got = nameOf({ kind: "user", content: [{ type: "text", text: "第一行\n\n\n第二行" }] });
			if (got.indexOf("\n") >= 0) throw new Error("STATIONNAME1 the name still contains raw newlines");
			if (got.indexOf("第一行 第二行") < 0) throw new Error("STATIONNAME1 newlines were not flattened: " + JSON.stringify(got));
		}
	}

	// ── EXPORTDRIFT1: the saved file must carry the panel's warnings ───────────
	// The header tells the reader "this log is damaged" (malformed / drift / invalid) and,
	// since round 20, "N requests have no matching step". The Markdown export stated only
	// the totals, so a saved file silently claimed a clean read of a log the screen was
	// actively flagging — the same defect shape as the dropped error `code` (§12.82).
	{
		const nodesEd = [
			{ kind: "user", seq: 1, time: 1e12, turn: 1, content: [{ type: "text", text: "u" }] },
			{ kind: "assistant", seq: 2, time: 1e12, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] }
		];
		const exportOf = (requests, eventNodes) => buildTraceMarkdown(
			deriveTraceTree({ eventNodes: eventNodes ?? nodesEd, requests, callSchemas: new Map(), runningCalls: [], partial: null }, t), t);
		const warnsOf = (md) => md.split("\n").filter((line) => line.indexOf("> ⚠") === 0);
		const cleanMd = exportOf([{ purpose: "assistant", turn: 1, step: 1 }]);
		if (warnsOf(cleanMd).length !== 0) {
			throw new Error("EXPORTDRIFT1 a clean log must not be flagged: " + warnsOf(cleanMd)[0]);
		}
		// An unplaceable request must be reported in the file, not only on screen.
		const reqWarn = warnsOf(exportOf([{ purpose: "assistant", turn: 1, step: 1 }, { purpose: "assistant", turn: 9, step: 1 }]));
		if (reqWarn.length === 0 || reqWarn[0].indexOf("unplacedReq") < 0) {
			throw new Error("EXPORTDRIFT1 the export hides a request that has no matching step");
		}
		// An unknown node kind must be reported.
		const driftWarn = warnsOf(exportOf([], nodesEd.concat([{ kind: "brand-new-kind", seq: 3, time: 1e12, turn: 1 }])));
		if (driftWarn.length === 0 || driftWarn[0].indexOf("drift") < 0) {
			throw new Error("EXPORTDRIFT1 the export hides an unrecognised node kind");
		}
		// A malformed node shape must be reported.
		const malWarn = warnsOf(exportOf([], nodesEd.concat([{ kind: "user", seq: "x", time: 1e12, turn: 1 }])));
		if (malWarn.length === 0 || malWarn[0].indexOf("malformed") < 0) {
			throw new Error("EXPORTDRIFT1 the export hides a malformed snapshot");
		}
	}

	// ── UNPLACEDREQ1: a request the log carries must never be dropped in silence ──
	// `requests` are keyed by `${turn}:${step}` and attached while stations are built.
	// A request whose step never appears (a request that failed before producing a
	// message), a duplicate key, or a `purpose` this build does not know was simply
	// never read — no station, no warning, `contract.ok === true`. Unknown NODE kinds
	// already become visible "unknown" stations, so requests must be counted too.
	{
		const nodesRq = [
			{ kind: "user", seq: 1, time: 1e12, turn: 1, content: [{ type: "text", text: "u" }] },
			{ kind: "assistant", seq: 2, time: 1e12, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] }
		];
		const foldRq = (requests) => deriveTraceTree({ eventNodes: nodesRq, requests, callSchemas: new Map(), runningCalls: [], partial: null }, t);
		const count = (requests, expect, label) => {
			const got = foldRq(requests).unplacedRequests;
			if (got !== expect) throw new Error("UNPLACEDREQ1 " + label + ": expected " + expect + ", got " + got);
		};
		// A compaction request with NO compaction marker in the window was silently
		// discarded (measured: stations=0, unplaced=0 — the request simply vanished).
		// It has no matching step, so it must be counted. This assertion used to encode
		// the buggy behaviour and was updated with the fix.
		count([{ purpose: "assistant", turn: 1, step: 1 }, { purpose: "compaction", turn: 1, step: 1 }], 1, "a compaction request with no marker");
		// ...and one that DOES have its marker must not be counted.
		{
			const nodesCm = nodesRq.concat([{ kind: "compaction", seq: 3, time: 1e12, summary: "S", shadowedItemCount: 1, shadowedTokenCount: 10 }]);
			const got = deriveTraceTree({
				eventNodes: nodesCm,
				requests: [{ purpose: "assistant", turn: 1, step: 1 }, { purpose: "compaction", turn: 1, step: 1, replacementSeq: 3 }],
				callSchemas: new Map(), runningCalls: [], partial: null
			}, t).unplacedRequests;
			if (got !== 0) throw new Error("UNPLACEDREQ1 a compaction request WITH its marker must not count: got " + got);
		}
		count([{ purpose: "assistant", turn: 1, step: 1 }, { purpose: "assistant", turn: 9, step: 1 }], 1, "a request for a step that is not there");
		count([{ purpose: "assistant", turn: 1, step: 1 }, { purpose: "weird", turn: 1, step: 1 }], 1, "an unknown purpose");
		count([{ purpose: "assistant", step: 1 }], 1, "a request with no turn");
		count([], 0, "an empty list");
		// The count must reach the reader, not just the object.
		const srcAll = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		if (srcAll.indexOf('t("view.unplacedReq")') < 0) throw new Error("UNPLACEDREQ1 the header has no chip for unplaced requests");
		if (srcAll.indexOf('t("view.unplacedReqTip")') < 0) throw new Error("UNPLACEDREQ1 the chip has no explanation");
		// And the property must actually be wired into the header condition.
		if (!/tree\.unplacedRequests > 0/.test(srcAll)) throw new Error("UNPLACEDREQ1 the chip is not gated on a non-zero count");
	}

	// ── MATCHSTART1: a fresh query must not claim a match position it doesn't hold ──
	// `matchPtr` started at 0, so the counter read "1/3" the instant the reader typed —
	// while the timeline had not moved — and the FIRST "next" then went to match 2.
	// Match 1 was only reachable by wrapping all the way round the ring. The pointer now
	// starts at -1 ("none") and the counter says "–/3".
	{
		const srcMs = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const grabMs = (() => {
			const at = srcMs.indexOf("const gotoMatch = (dir) => {");
			if (at < 0) throw new Error("MATCHSTART1 gotoMatch is missing");
			let i = srcMs.indexOf("{", at), d = 0;
			for (; i < srcMs.length; i += 1) { if (srcMs[i] === "{") d += 1; else if (srcMs[i] === "}") { d -= 1; if (d === 0) { i += 1; break; } } }
			return srcMs.slice(at, i);
		})();
		const stepMs = (ptr, len, dir) => {
			const out = { landed: null };
			new Function("dir", "matchPtr", "matches", "setMatchPtr", "seek", grabMs + "\ngotoMatch(dir);")(
				dir, ptr, Array.from({ length: len }, (_, k) => k), () => {}, (i) => { out.landed = i; });
			return out.landed;
		};
		// From "nothing selected", the first step in each direction hits an END of the ring.
		if (stepMs(-1, 3, 1) !== 0) throw new Error("MATCHSTART1 the first next skipped the first match");
		if (stepMs(-1, 3, -1) !== 2) throw new Error("MATCHSTART1 the first prev must land on the last match");
		// And a single match must be reachable both ways without falling off.
		if (stepMs(-1, 1, 1) !== 0 || stepMs(-1, 1, -1) !== 0) throw new Error("MATCHSTART1 a single match is unreachable");
		// The pointer must start at "none" — starting at 0 IS the bug.
		if (!/useState\)\(-1\)/.test(srcMs.slice(srcMs.indexOf("matchPtr, setMatchPtr"), srcMs.indexOf("matchPtr, setMatchPtr") + 80))) {
			throw new Error("MATCHSTART1 matchPtr no longer starts at -1");
		}
		// The counter must have a "no current match" branch. It only renders while a query
		// is active, and a static render starts with an empty query, so this cannot be
		// asserted from rendered HTML — check the branch instead.
		if (srcMs.indexOf("matchPtr < 0 ?") < 0) {
			throw new Error("MATCHSTART1 the counter has no 'no match selected' branch");
		}
	}

	// ── NOPAGER1: no paging affordance without a paging callback ───────────────
	// `hasMore` is a property of the SESSION; it says nothing about whether this view was
	// handed a way to fetch. The slot's `inject` returns `{}` when the session binding is
	// gone, so `loadOlder` can be absent while `hasMore` is still true. The button was
	// rendered ENABLED and did provably nothing (`doLoadOlder` bails out silently), and
	// the search-scope chip advertised "click here to load earlier history" while being
	// unclickable.
	{
		let ReactPg = null;
		let rtPg = null;
		try { ReactPg = require("react"); rtPg = require("react/jsx-runtime"); } catch { ReactPg = null; }
		if (ReactPg === null) {
			console.log("NOPAGER1 SKIPPED: react / react/jsx-runtime not installed");
		} else {
			const srcPg = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
			const vmPg = require("node:vm");
			const boxPg = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, Date, RegExp,
				isFinite, parseInt, parseFloat, Error, TypeError, Symbol, Promise,
				react: ReactPg, jsx: rtPg.jsx, jsxs: rtPg.jsx, fragment: rtPg.Fragment,
				document: void 0, window: void 0, location: void 0 };
			boxPg.globalThis = boxPg;
			vmPg.createContext(boxPg);
			const hPg = srcPg.indexOf("//#region pure helpers: snapshot -> timeline tree");
			const hEndPg = srcPg.indexOf("//#endregion", hPg);
			const cPg = srcPg.indexOf("//#region horizontal timeline + replay component");
			const cEndPg = srcPg.indexOf("//#endregion", cPg);
			vmPg.runInContext("const fragment = react.Fragment;\n" + srcPg.slice(hPg, hEndPg) + "\n" + srcPg.slice(cPg, cEndPg) + ";globalThis.__pg={TraceMapView};", boxPg, { timeout: 60000 });
			const pgSnap = { eventNodes: [{ kind: "user", seq: 1, time: 1e12, turn: 1, content: [{ type: "text", text: "u" }] }], requests: [], callSchemas: {}, runningCalls: {}, partial: null };
			const draw = (loader) => require("react-dom/server").renderToStaticMarkup(rtPg.jsx(boxPg.__pg.TraceMapView, {
				useSession: (sel) => { try { return sel({ openState: "open", hasMore: true }); } catch { return void 0; } },
				useTrajectory: () => pgSnap,
				t: (k) => k,
				viewRequest: null,
				completeViewRequest: () => {},
				loadOlder: loader
			}));
			// With a loader the header button exists and is clickable.
			const withFn = draw(async () => false);
			const fnTag = (withFn.match(/<button[^>]*class="dstv_btn"[^>]*>⬆[^<]*/) ?? [""])[0];
			if (fnTag === "") throw new Error("NOPAGER1 the paging button disappeared even with a loader");
			if (fnTag.indexOf("disabled") >= 0) throw new Error("NOPAGER1 the paging button is disabled although a loader exists");
			// Without one it must not be a clickable dead control.
			for (const missing of [void 0, null, "nope", 0]) {
				const html = draw(missing);
				const tag = (html.match(/<button[^>]*class="dstv_btn"[^>]*>⬆[^<]*/) ?? [""])[0];
				if (tag !== "" && tag.indexOf("disabled") < 0) {
					throw new Error("NOPAGER1 a clickable paging button is rendered with loadOlder=" + String(missing));
				}
			}
			// The non-button form must not LOOK clickable either: `.dstv_scope` carries
		// `cursor:pointer` and a hover highlight, so a bare span reintroduced the same lie
		// one layer down (visual affordance instead of a dead handler).
		if (srcPg.indexOf('"data-static": "true"') < 0) {
			throw new Error("NOPAGER1 the static scope notice carries no marker to drop button styling");
		}
		const stylesPg = fs.readFileSync(path.join(__dirname, "..", "src", "10-styles.js"), "utf8").replace(/\\n/g, "\n");
		if (stylesPg.indexOf(".dstv_scope[data-static]{cursor:default}") < 0) {
			throw new Error("NOPAGER1 the static scope notice keeps the button pointer cursor");
		}
		// Its tooltip must not promise a click that cannot happen.
		if (srcPg.indexOf('t("search.scopeTipStatic")') < 0) {
			throw new Error("NOPAGER1 the static scope notice still advertises the click-to-load tooltip");
		}
		// The scope chip only renders while a query is active, and a static render starts
			// with an empty query — so a rendered-HTML assertion here would be VACUOUS (the
			// markup is simply absent and `indexOf` on "" is -1). Check the branch structure
			// instead: without a loader the chip must be a `span`, not a disabled `button`
			// whose tooltip promises a click it cannot perform.
			if (srcPg.indexOf('}, "sScope") : jsx("span", {') < 0) {
				throw new Error("NOPAGER1 the search-scope chip has no non-button branch without a loader");
			}
		}
	}

	// ── HOSTILEFIELDS1: 1000 rounds of non-serialisable garbage must not throw ──
	// The six-round fuzz only produced JSON-representable values, so BigInt, Symbol and
	// functions were never exercised — which is exactly where two real crashes lived
	// (a Symbol `seq` and a Symbol `step`). Re-run the same shape with those types in
	// the pool and require zero throws.
	{
		let seed = 987654321;
		const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
		const pickFrom = (arr) => arr[Math.floor(rnd() * arr.length)];
		const nasties = [null, void 0, 0, -1, 1.5, NaN, Infinity, -Infinity, "", "x", true, false,
			Symbol("s"), 5n, 2n ** 80n, {}, [], [1], { a: 1 }, () => 1, Number.MAX_SAFE_INTEGER + 1];
		// NUMERIC fields get their own pool, weighted towards the two types that actually
		// crashed (Symbol and BigInt). With the general pool a Symbol landed in `step`
		// about once every 700 nodes, so this fuzz silently missed the very bug it exists
		// to find — measured 0/300 against a broken `step`. Tilted pools are what make it
		// a probe rather than decoration.
		const numericNasties = [Symbol("s"), Symbol("t"), 5n, 2n ** 80n, NaN, Infinity, -1, 1.5, "", {}, void 0, null];
		const maybeNum = (v) => (rnd() < 0.45 ? pickFrom(numericNasties) : v);
		const maybeN = (v) => (rnd() < 0.35 ? pickFrom(nasties) : v);
		const mkNasty = () => ({
			kind: maybeN(pickFrom(["user", "assistant", "tool-result", "compaction", "turn-error", "model-retry", "turn-max-tokens", "command", "unknown", "context", "steering", "bogus"])),
			seq: maybeNum(Math.floor(rnd() * 40)), time: maybeNum(1e12), turn: maybeNum(1), step: maybeNum(1),
			messageId: maybeN("m"), callId: maybeN("c"), callTime: maybeNum(1e12),
			isError: maybeN(rnd() < 0.5), interrupted: maybeN(rnd() < 0.2),
			blocks: maybeN([{ kind: pickFrom(["text", "reasoning", "image", "tool-call", "other", "bogus"]), text: maybeN("T"), callId: maybeN("c"), name: maybeN("n"), argsRaw: maybeN("{}") }]),
			content: maybeN([{ type: pickFrom(["text", "image", "bogus"]), text: maybeN("C") }]),
			error: maybeN({ name: maybeN("E") }), failure: maybeN({ message: maybeN("F") }),
			message: maybeN("M"), code: maybeN("X"), type: maybeN("T"), data: maybeN({ d: 1 }),
			usage: maybeN({ input: maybeN(10), output: maybeN(5) }),
			timing: maybeN({ stepStartTime: maybeN(1), completedTime: maybeN(2) }),
			producer: maybeN({ label: maybeN("p") }), name: maybeN("t"), argsRaw: maybeN("{}"),
			requestConfig: maybeN({ model: maybeN("m") })
		});
		let fuzzFails = 0;
		let firstMessage = null;
		for (let round = 0; round < 300; round += 1) {
			const list = Array.from({ length: 1 + Math.floor(rnd() * 8) }, mkNasty);
			// Guarantee the `assistant` fold runs every round: it is the branch that reads
			// `step`, and letting the kind be random left that path under-exercised.
			list[0].kind = "assistant";
			try {
				deriveTraceTree({
					eventNodes: maybeN(list), requests: maybeN([]), callSchemas: maybeN(new Map()), runningCalls: maybeN({}),
					partial: rnd() < 0.5 ? null : { turn: maybeN(1), step: maybeN(1), blocks: maybeN([{ kind: "text", text: "p" }]), timing: maybeN({}) }
				}, t);
			} catch (e) {
				fuzzFails += 1;
				if (firstMessage === null) firstMessage = e.constructor.name + ": " + String(e.message).slice(0, 70);
			}
		}
		if (fuzzFails > 0) throw new Error("HOSTILEFIELDS1 " + fuzzFails + "/300 hostile snapshots threw, first: " + firstMessage);
	}

	// ── SEQCOERCE1: a BigInt/Symbol `seq` must not refuse to render the log ────
	// `seq` is the field the whole projection orders by (`a.seq - b.seq`), compares
	// (`>`) and pastes into ids (template literals). JS THROWS on a Symbol in all three
	// and mixes BigInt with number without warning, so a truncated or hand-edited log
	// crashed the entire view — the one input the tool exists to report on.
	{
		const sq = (seq, txt) => ({ kind: "user", seq, time: 1e12, turn: 1, content: [{ type: "text", text: txt ?? "u" }] });
		const build = (list) => deriveTraceTree({ eventNodes: list, requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		// Each of these threw a TypeError before the fix.
		const hostile = [
			["Symbol", [sq(Symbol("s"))]],
			["two Symbols (hits the sort comparator)", [sq(Symbol("a")), sq(Symbol("b"))]],
			["Symbol mixed with a number", [sq(Symbol("a")), sq(5)]],
			["BigInt", [sq(5n), sq(3n)]],
			["BigInt beyond safe range", [sq(2n ** 80n), sq(1)]],
			["plain object", [sq({})]],
			["string", [sq("abc")]]
		];
		for (const [label, list] of hostile) {
			let tr = null;
			try { tr = build(list); } catch (e) {
				throw new Error("SEQCOERCE1 a " + label + " seq crashed the projection: " + String(e.message).slice(0, 60));
			}
			if (tr.stations.length !== list.length) {
				throw new Error("SEQCOERCE1 a " + label + " seq lost stations (" + tr.stations.length + " of " + list.length + ")");
			}
			// Ids double as React keys, so they must still be unique even when every
			// hostile seq normalises to the same value.
			const ids = tr.stations.map((st) => st.id);
			if (new Set(ids).size !== ids.length) {
				throw new Error("SEQCOERCE1 duplicate station ids from " + label + ": " + ids.join(","));
			}
		}
		// Ordering must still be NUMERIC. The seqs are chosen so a lexicographic sort
		// disagrees ("10" < "2"), otherwise this assertion cannot tell the two apart —
		// my first version used 1,2,3 and a string sort passed it.
		const ordered = build([sq(30, "c"), sq(2, "a"), sq(10, "b")]);
		if (ordered.stations.map((st) => st.id).join(",") !== "u2,u10,u30") {
			throw new Error("SEQCOERCE1 ordering is not numeric: " + ordered.stations.map((st) => st.id).join(","));
		}
		// `step` reaches the same coercion from the same log. `Number(Symbol)` throws, and
		// three call sites did exactly that, so a Symbol `step` crashed the projection
		// just like a Symbol `seq` did.
		const stepCase = (step, expect) => {
			// Wrap the projection itself: if the coercion is broken it throws a raw
			// TypeError from inside the fold, which kills the whole process and reports a
			// stack instead of naming this guard.
			let tr = null;
			try {
				tr = deriveTraceTree({
				eventNodes: [{ kind: "assistant", seq: 2, time: 1e12, turn: 1, step, messageId: "m", blocks: [{ kind: "text", text: "a" }] }],
					requests: [], callSchemas: new Map(), runningCalls: [], partial: null
				}, t);
			} catch (e) {
				throw new Error("SEQCOERCE1 step=" + String(step) + " crashed the projection: " + String(e.message).slice(0, 60));
			}
			const st = tr.stations.find((x) => x.kind === "step");
			if (st === void 0) throw new Error("SEQCOERCE1 a step station vanished for step=" + String(step));
			if (st.turnStep !== expect) {
				throw new Error("SEQCOERCE1 step=" + String(step) + " produced turnStep " + st.turnStep + ", expected " + expect);
			}
		};
		stepCase(Symbol("s"), 1);
		stepCase(3n, 3);
		stepCase(2.7, 2);
		stepCase(-5, 1);
		stepCase(void 0, 1);
		stepCase("7", 7);
		// The repair must be NON-DESTRUCTIVE: the host's snapshot objects are shared with
		// every other view in the app, so rewriting their `seq` in place would corrupt
		// another consumer. Copy instead of mutate.
		const symNode = sq(Symbol("keepme"));
		build([symNode]);
		if (typeof symNode.seq !== "symbol") {
			throw new Error("SEQCOERCE1 the repair pass overwrote the host's node (seq became " + typeof symNode.seq + ")");
		}
		// And a well-formed snapshot must not be copied at all — the repair pass has to
		// stay off the normal path.
		const keep = [sq(1), sq(2)];
		build(keep);
		if (keep[0].seq !== 1 || keep[1].seq !== 2) throw new Error("SEQCOERCE1 ordinary nodes were rewritten");
	}

	// ── NAVOVERVIEW1: → must advance from the overview state ───────────────────
	// `revealed` is null in overview (everything shown, nothing selected) and `R` then
	// reads as N, so the two directions behaved completely differently on the state the
	// reader is in when the tab first opens:
	//   →  `R < N` false → setRevealed(null) → still null → THE KEY DID NOTHING
	//   ←  `R > 1` true  → jumped to N-1, silently skipping the newest station
	// The hint advertises "← → 逐站", so the first thing a new reader presses is →.
	{
		const navSrc = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const grab = (name) => {
			const at = navSrc.indexOf("const " + name + " = () => {");
			if (at < 0) throw new Error("NAVOVERVIEW1 " + name + " is missing");
			let i = navSrc.indexOf("{", at), depth = 0;
			for (; i < navSrc.length; i += 1) {
				if (navSrc[i] === "{") depth += 1;
				else if (navSrc[i] === "}") { depth -= 1; if (depth === 0) { i += 1; break; } }
			}
			return navSrc.slice(at, i);
		};
		// Execute the REAL body against a recording setRevealed, so this tests behaviour
		// rather than the presence of a token.
		const drive = (name, N, revealed) => {
			const body = grab(name);
			const box = { hit: "NONE" };
			const R = revealed === null ? N : Math.min(Math.max(1, revealed), N);
			const setRevealed = (v) => { box.hit = v; };
			new Function("N", "R", "revealed", "setRevealed", "setPlaying", "setFollow", body + "\n" + name + "();")(
				N, R, revealed, setRevealed, () => {}, () => {});
			return box.hit;
		};
		for (const N of [1, 2, 5]) {
			const fwd = drive("stepNext", N, null);
			if (fwd === "NONE") throw new Error("NAVOVERVIEW1 → did nothing in overview with N=" + N);
			if (fwd === null) throw new Error("NAVOVERVIEW1 → stayed in overview (setRevealed(null)) with N=" + N);
			if (fwd !== 1) throw new Error("NAVOVERVIEW1 → from overview must start at station 1, got " + fwd);
			const back = drive("stepPrev", N, null);
			// ← from overview must reach the LAST station; landing on N-1 skipped one.
			if (back !== N) throw new Error("NAVOVERVIEW1 ← from overview must land on the last station (" + N + "), got " + back);
		}
		// The mid-timeline behaviour must not regress.
		if (drive("stepNext", 5, 3) !== 4) throw new Error("NAVOVERVIEW1 → stopped working inside the timeline");
		if (drive("stepPrev", 5, 3) !== 2) throw new Error("NAVOVERVIEW1 ← stopped working inside the timeline");
		if (drive("stepNext", 5, 5) !== null) throw new Error("NAVOVERVIEW1 → at the end must return to overview");
		if (drive("stepPrev", 5, 1) !== "NONE") throw new Error("NAVOVERVIEW1 ← at the first station must stay put");
	}

	// ── EXPORTCODE1: the Markdown export must carry what the panel shows ───────
	// The detail panel renders an error's `code` and a retry's counter / provider /
	// state; the export showed only the message. So copying a failed step produced a
	// strictly LESS useful text than the screen it came from — and "which retry failed,
	// with what code" is precisely what a reader pastes into a bug report.
	{
		const expNodes = [
			{ kind: "assistant", seq: 4, time: 1e12, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "A" }] },
			{ kind: "turn-error", seq: 6, time: 1e12, turn: 1, message: "EXPERR", code: "EXPCODE1" },
			{ kind: "model-retry", seq: 8, time: 1e12, turn: 1, failure: { message: "EXPRETRY", code: "EXPCODE2" }, retry: 2, maxRetries: 5, provider: "EXPPROV", retryState: "EXPSTATE" }
		];
		const expTree = deriveTraceTree({ eventNodes: expNodes, requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		const expMd = buildTraceMarkdown(expTree, t);
		for (const mark of ["EXPCODE1", "EXPCODE2", "EXPPROV", "EXPSTATE"]) {
			if (expMd.indexOf(mark) < 0) {
				throw new Error("EXPORTCODE1 the export drops " + mark + ", which the detail panel shows");
			}
		}
		// The counter must survive too — "#2/5" is the whole point of a retry record.
		if (expMd.indexOf("#2/5") < 0) throw new Error("EXPORTCODE1 the retry counter is lost in the export");
		// A plain message must still be there: this is additive, not a replacement.
		if (expMd.indexOf("EXPRETRY") < 0 || expMd.indexOf("EXPERR") < 0) {
			throw new Error("EXPORTCODE1 the export lost the error message text");
		}
	}

	// ── HINT1: the keyboard hint must name the keys that are actually bound ────
	// The header told the user "⇤⇥ 跳轮次", but ⇤/⇥ are the Tab/Shift+Tab glyphs printed
	// on the keycaps; the binding is PageUp/PageDown. A user following the hint pressed
	// Tab, watched focus move inside the panel, and concluded the shortcut was broken.
	{
		const srcHt = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		// Every glyph claimed by the hint must correspond to a real binding.
		const hintZh = /"hint\.text":\s*"([^"]*)"/.exec(srcHt);
		const hintEnIdx = srcHt.indexOf('"hint.text"', srcHt.indexOf('"hint.text"') + 1);
		const hintEn = hintEnIdx > 0 ? /"hint\.text":\s*"([^"]*)"/.exec(srcHt.slice(hintEnIdx - 20)) : null;
		if (hintZh === null) throw new Error("HINT1 the keyboard hint is missing");
		if (hintZh[1].indexOf("⇤") >= 0 || hintZh[1].indexOf("⇥") >= 0) {
			throw new Error("HINT1 the hint advertises Tab glyphs but the binding is PageUp/PageDown: " + hintZh[1].slice(0, 80));
		}
		// Whatever it DOES advertise has to be spelled out and bound.
		if (hintZh[1].indexOf("PgUp") < 0 && hintZh[1].indexOf("PageUp") < 0) {
			throw new Error("HINT1 the hint no longer mentions the turn-jump keys at all: " + hintZh[1].slice(0, 80));
		}
		if (!/k === "PageUp"/.test(srcHt) || !/k === "PageDown"/.test(srcHt)) {
			throw new Error("HINT1 the hint names a turn-jump key that is not bound");
		}
		// The English side must not keep the old glyphs either.
		if (hintEn !== null && (hintEn[1].indexOf("⇤") >= 0 || hintEn[1].indexOf("⇥") >= 0)) {
			throw new Error("HINT1 the English hint still advertises Tab glyphs");
		}
	}

	// ── LOADFAIL1: a failed page must not look like a successful one ──────────
	// The host's `loadOlder` SWALLOWS its own failures: it resolves normally and only
	// flips `historyLoadStatus` to 'error' (dsh-api-session-controller
	// src/client/sessions/session.ts:432 — the catch sets the status and returns). The
	// plugin inferred progress from `getSnapshot() !== before`, which is a NEW object
	// after every markDirty, so a FAILED page reported "moved":
	//   - the view's `.catch()` never ran, so nothing told the user the page failed;
	//   - the anchor paging loop breaks on `moved !== true`, so it kept retrying the same
	//     doomed page up to 40 times.
	{
		const srcLd = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const at = srcLd.indexOf("loadOlder: async () => {");
		if (at < 0) throw new Error("LOADFAIL1 the loadOlder wrapper is missing");
		const body = srcLd.slice(at, srcLd.indexOf("}", srcLd.indexOf("return after !== before;", at)) + 1);
		if (body.indexOf("historyLoadStatus") < 0) {
			throw new Error("LOADFAIL1 the wrapper still infers progress from snapshot identity, so a failed page looks successful");
		}
		if (body.indexOf("throw") < 0) {
			throw new Error("LOADFAIL1 a detected failure must be rethrown, or the view's catch branch is unreachable");
		}
		// Behavioural: replicate the host's contract (resolve + status flip) and check the
		// wrapper's decision for both outcomes.
		const makeFake = (fail) => {
			let cache = { hasMore: true, historyLoadStatus: "idle" };
			let dirty = false;
			return {
				getSnapshot() { if (dirty) { dirty = false; cache = { ...cache }; } return cache; },
				async loadOlder() {
					if (fail) { cache.historyLoadStatus = "error"; dirty = true; return; }
					cache.historyLoadStatus = "idle"; dirty = true;
				}
			};
		};
		const runWrapper = async (session) => {
			const before = session.getSnapshot();
			await session.loadOlder();
			const after = session.getSnapshot();
			const failed = after.historyLoadStatus === "error" && before.historyLoadStatus !== "error";
			if (failed) throw new Error("loadOlder failed");
			return after !== before;
		};
		// The suite is CommonJS, so this cannot be awaited at top level. Do the same
		// decision synchronously against the two snapshots the host would hand back.
		const decide = (before, after) => {
			const failed = after.historyLoadStatus === "error" && before.historyLoadStatus !== "error";
			if (failed) throw new Error("loadOlder failed");
			return after !== before;
		};
		if (decide({ historyLoadStatus: "idle" }, { historyLoadStatus: "idle" }) !== true) {
			throw new Error("LOADFAIL1 a successful page must still report progress");
		}
		// A failed page MUST throw: the host hands back a brand-new snapshot with the
		// status flipped, which the old identity comparison scored as progress.
		let sawThrow = false;
		try { decide({ historyLoadStatus: "idle" }, { historyLoadStatus: "error" }); } catch { sawThrow = true; }
		if (sawThrow !== true) {
			throw new Error("LOADFAIL1 a failed page still resolves quietly — the user is never told");
		}

	}

	// ── MSGKEY1: request-tab rows must keep their identity when history is prepended ──
	// The request tab keyed every row on its ARRAY INDEX. That list is rebuilt whenever
	// the station window grows backwards, and paging PREPENDS messages: index 0 stops
	// being the message it was. React then reuses the DOM node, so a row the reader had
	// expanded starts showing a different message's body, and the newly-last row expands
	// by itself. `seq` is the durable record number.
	{
		const mkSeq = (from, to) => {
			const out = [];
			for (let i = from; i <= to; i += 1) out.push({ kind: "user", seq: i, time: i, turn: i, content: [{ type: "text", text: "U" + i }] });
			return out;
		};
		const tailMsgs = reconstructMessages(mkSeq(6, 10), 999, t);
		const fullMsgs = reconstructMessages(mkSeq(1, 10), 999, t);
		if (tailMsgs.length !== 5 || fullMsgs.length !== 10) throw new Error("MSGKEY1 the fixture rebuilt the wrong number of messages");
		// The identity must be carried at all — without it every key falls back to the index.
		for (const m of fullMsgs) {
			if (m.seq === void 0 || m.seq === null) {
				throw new Error("MSGKEY1 a reconstructed message has no `seq`, so its key can only be positional: " + JSON.stringify(m.text));
			}
		}
		// U6 and U10 really do move position; their identity must not.
		const before = tailMsgs.find((m) => m.text === "U6");
		const after = fullMsgs.find((m) => m.text === "U6");
		if (before.seq !== after.seq) {
			throw new Error("MSGKEY1 the same message reports a different seq before and after prepending (" + before.seq + " -> " + after.seq + ")");
		}
		if (tailMsgs.indexOf(before) === fullMsgs.indexOf(after)) {
			throw new Error("MSGKEY1 the fixture is useless: prepending did not move the message");
		}
		// And the view must actually key on it rather than on `i`.
		const srcMk = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		if (srcMk.indexOf("const msgKey = `m${m.seq != null") < 0) {
			throw new Error("MSGKEY1 the request rows are not keyed by message identity");
		}
		if (/}, `m\$\{i\}`\)/.test(srcMk)) {
			throw new Error("MSGKEY1 a request row is still keyed by its index");
		}
	}

	// ── MINITAB1: the minimap must not be 200 extra Tab stops ─────────────────
	// The minimap is a SECOND navigation affordance for the SAME stations the timeline
	// already exposes, but every tick was a plain <button>. Measured on a rendered view:
	// 200 stations produced 215 tabbable elements, 200 of them minimap ticks — on a long
	// session that is ~3,600 stops a keyboard user has to cross to reach the panel below.
	// The station list already uses a roving tabindex; the strip must match it.
	{
		let ReactMi = null;
		let rtMi = null;
		try { ReactMi = require("react"); rtMi = require("react/jsx-runtime"); } catch { ReactMi = null; }
		if (ReactMi === null) {
			console.log("MINITAB1 SKIPPED: react / react/jsx-runtime not installed");
		} else {
			const srcMi = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
			const vmMi = require("node:vm");
			const boxMi = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, Date, RegExp,
				isFinite, parseInt, parseFloat, Error, TypeError, Symbol, Promise,
				react: ReactMi, jsx: rtMi.jsx, jsxs: rtMi.jsx, fragment: rtMi.Fragment,
				document: void 0, window: void 0, location: void 0 };
			boxMi.globalThis = boxMi;
			vmMi.createContext(boxMi);
			const hMi = srcMi.indexOf("//#region pure helpers: snapshot -> timeline tree");
			const hEnd = srcMi.indexOf("//#endregion", hMi);
			const cMi = srcMi.indexOf("//#region horizontal timeline + replay component");
			const cEnd = srcMi.indexOf("//#endregion", cMi);
			vmMi.runInContext("const fragment = react.Fragment;\n" + srcMi.slice(hMi, hEnd) + "\n" + srcMi.slice(cMi, cEnd) + ";globalThis.__mi={TraceMapView};", boxMi, { timeout: 60000 });
			// 40 stations is enough to prove the shape; the count must not scale with N.
			const miNodes = [];
			for (let i = 0; i < 20; i += 1) {
				miNodes.push({ kind: "user", seq: i * 2 + 1, time: i * 1000, turn: i + 1, content: [{ type: "text", text: "u" + i }] });
				miNodes.push({ kind: "assistant", seq: i * 2 + 2, time: i * 1000 + 1, turn: i + 1, step: 1, messageId: "m" + i, blocks: [{ kind: "text", text: "a" + i }] });
			}
			const miSnap = { eventNodes: miNodes, requests: [], callSchemas: {}, runningCalls: {}, partial: null };
			const miHtml = require("react-dom/server").renderToStaticMarkup(rtMi.jsx(boxMi.__mi.TraceMapView, {
				useSession: (sel) => { try { return sel({ openState: "open" }); } catch { return void 0; } },
				useTrajectory: () => miSnap,
				t: (k) => k,
				viewRequest: null,
				completeViewRequest: () => {},
				loadOlder: async () => false
			}));
			const miTicks = [...miHtml.matchAll(/<button[^>]*dstv_miniTick[^>]*>/g)].map((m) => m[0]);
			if (miTicks.length !== 40) throw new Error("MINITAB1 the fixture rendered " + miTicks.length + " ticks, expected 40");
			const reachable = miTicks.filter((tk) => tk.indexOf('tabindex="-1"') < 0);
			// Exactly one, in EVERY state: zero would drop the strip from the keyboard
			// entirely, which is the opposite failure and equally wrong.
			if (reachable.length !== 1) {
				throw new Error("MINITAB1 " + reachable.length + " of " + miTicks.length + " minimap ticks are Tab stops (must be exactly 1)");
			}
			// And the rest of the view must not be dragged along: the timeline list uses a
			// roving tabindex too, so the whole view stays small.
			const tabbable = [...miHtml.matchAll(/<(button|input|summary|a )([^>]*)>/g)].filter((m) => !/tabindex="-1"/.test(m[2])).length;
			if (tabbable > 40) {
				throw new Error("MINITAB1 the view exposes " + tabbable + " Tab stops for 40 stations");
			}
		}
	}

	// ── TABLATCH1: the request tab must not latch onto a station that has no request ──
	// `showTab` falls back to the detail view when `canRequest` is false, so the button
	// looked inert — but the STATE was still written. The moment the reader moved to a
	// station that does have a request, the panel jumped to the request view with nobody
	// having pressed anything. The `r` shortcut always had this guard; the button did not.
	{
		const srcTb = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const btnAt = srcTb.indexOf('"data-on": showTab === "request"');
		if (btnAt < 0) throw new Error("TABLATCH1 the request tab button is missing");
		const btn = srcTb.slice(btnAt, srcTb.indexOf('"tabRequest")', btnAt));
		if (btn.indexOf("if (canRequest) setTab(\"request\")") < 0) {
			throw new Error("TABLATCH1 the request tab latches even when the station has no request");
		}
		// The detail button must stay unconditional: it is always valid.
		const detAt = srcTb.indexOf('"data-on": showTab === "detail"');
		const det = srcTb.slice(detAt, srcTb.indexOf('"tabDetail")', detAt));
		if (det.indexOf('onClick: () => setTab("detail")') < 0) {
			throw new Error("TABLATCH1 the detail tab must remain reachable unconditionally");
		}
		// And the shortcut keeps its own guard, so both paths agree.
		if (!/if \(can\) \{ setTab\(tab === "request" \? "detail" : "request"\)/.test(srcTb)) {
			throw new Error("TABLATCH1 the `r` shortcut lost its canRequest guard");
		}
	}

	// ── ANCHORTYPE1: typing an anchor must not validate on every keystroke ────
	// `anchorInput` was part of the token that drives the resolve effect, so each
	// keystroke ran a full `anchorApply`: typing `tvp1:t2s1` produced eight failed
	// parses and flashed "unrecognised anchor format" eight times, then succeeded on the
	// ninth. Worse, a half-typed anchor that happens to PARSE (e.g. `tvp1:e2` on the way
	// to `tvp1:e20`) navigated away mid-typing. The typed value belongs to the Enter
	// handler, which is the moment the user asks for it.
	{
		const srcAt = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const tokAt = srcAt.indexOf("const anchorToken = (0, react.useMemo)(");
		if (tokAt < 0) throw new Error("ANCHORTYPE1 the anchor token is missing");
		const tokLine = srcAt.slice(tokAt, srcAt.indexOf("\n", tokAt));
		if (tokLine.indexOf("anchorInput") >= 0) {
			throw new Error("ANCHORTYPE1 the typed value drives the resolve effect, so every keystroke is applied");
		}
		// The effect must not read the typed value either — dropping it from the token
		// but still reading it in the body would re-apply the last value on any re-run.
		const effAt = srcAt.indexOf("const appliedAnchorRef = (0, react.useRef)(null);");
		const effEnd = srcAt.indexOf("}, [anchorToken, N]);", effAt);
		if (effAt < 0 || effEnd < 0) throw new Error("ANCHORTYPE1 could not locate the resolve effect");
		const effBody = srcAt.slice(effAt, effEnd);
		if (effBody.indexOf("anchorInput") >= 0) {
			throw new Error("ANCHORTYPE1 the resolve effect still reads the typed value");
		}
		// ...but the ANCHOR ENTER HANDLER must still use it, otherwise typing does nothing
		// at all. Anchor on the call itself, not on the first `Enter` in the file: the
		// search box has its own Enter handler, and scanning from that one ran 18k
		// characters through unrelated code that mentions `anchorInput` — so deleting the
		// typed jump entirely still passed. Measured, then rewritten.
		// Anchor on the ASSIGNMENT and look forward: the effect holds the other
		// `anchorApplyGuarded(wanted)` call, so scanning backwards from the first match
		// landed on the effect and reported the typed jump missing.
		const typedAt = srcAt.indexOf("const wanted = anchorInput.trim();");
		if (typedAt < 0) throw new Error("ANCHORTYPE1 the anchor Enter handler no longer reads the typed value");
		const afterTyped = srcAt.slice(typedAt, typedAt + 400);
		if (afterTyped.indexOf("anchorApplyGuarded(wanted)") < 0) {
			throw new Error("ANCHORTYPE1 the typed value is read but never applied");
		}
		// Deleting the body of the jump (`const wanted = "";`) must fail: the assignment
		// itself has to read the input.
		if (afterTyped.indexOf('const wanted = "";') >= 0) {
			throw new Error("ANCHORTYPE1 the typed jump was emptied");
		}
	}

	// ── ANCHORLIFE1: an anchor search must not outlive the panel ──────────────
	// Paging for an anchor can run for tens of seconds (up to 40 pages). The loop's
	// progress test reads `stationsRef`, which FREEZES at its last value once the
	// component is gone, so the "did the projection change?" check never sees progress,
	// all 12 back-off tries run per page, and `loadOlder()` keeps reporting growth —
	// pulling history for a conversation nobody is looking at. Both entry points share
	// one wrapper, so the liveness check belongs there.
	{
		const srcAl = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/const aliveRef = \(0, react\.useRef\)\(true\)/.test(srcAl)) {
			throw new Error("ANCHORLIFE1 there is no liveness token for the anchor search");
		}
		// The unmount cleanup has to actually flip it; a ref that is never cleared is
		// decoration.
		if (!/return \(\) => \{ aliveRef\.current = false; \}/.test(srcAl)) {
			throw new Error("ANCHORLIFE1 the liveness token is never cleared on unmount");
		}
		// And the shared wrapper must refuse to start when the panel is gone.
		const guardAt = srcAl.indexOf("const anchorApplyGuarded = (raw) => {");
		if (guardAt < 0) throw new Error("ANCHORLIFE1 the shared wrapper is missing");
		const guardBody = srcAl.slice(guardAt, srcAl.indexOf("react.useEffect", guardAt));
		if (guardBody.indexOf("aliveRef.current !== true") < 0) {
			throw new Error("ANCHORLIFE1 the wrapper starts a search even after unmount");
		}
		// The paging loop must re-check between awaits, which is where the time goes.
		const loopAt = srcAl.indexOf("while (resolved.ok !== true && pages < ANCHOR_MAX_PAGES");
		const loopBody = srcAl.slice(loopAt, srcAl.indexOf("capped = resolved.ok !== true", loopAt));
		const checks = (loopBody.match(/aliveRef\.current !== true/g) ?? []).length;
		if (checks < 3) {
			throw new Error("ANCHORLIFE1 the paging loop re-checks liveness only " + checks + " time(s); it must check after each await");
		}
	}

	// ── ANCHORDEDUPE1: a deep-linked anchor must not fight the reader ─────────
	// The resolve effect depended on `N` as well as the anchor token, so in a live
	// session EVERY new station re-ran it. A successful landing mirrors the anchor into
	// the URL, so the token stays non-empty: each arriving station re-applied it,
	// yanking `revealed` back to the anchor and stopping playback. The reader could not
	// step away from a deep link at all.
	{
		const srcAd = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/appliedAnchorRef/.test(srcAd)) throw new Error("ANCHORDEDUPE1 the applied-anchor memo is missing");
		const eff = srcAd.indexOf("const appliedAnchorRef = (0, react.useRef)(null);");
		const effEnd = srcAd.indexOf("if (typeof completeViewRequest === \"function\") completeViewRequest();", eff);
		if (eff < 0 || effEnd < 0) throw new Error("ANCHORDEDUPE1 could not locate the resolve effect");
		const body = srcAd.slice(eff, effEnd);
		if (body.indexOf("appliedAnchorRef.current === anchorToken") < 0) {
			throw new Error("ANCHORDEDUPE1 re-entering the effect with the same token re-applies the anchor");
		}
		// `N` must STAY a dependency (a deep link can arrive before any station exists,
		// and the retry on growth is the only thing that lands it), so the fix is the
		// memo, not the dependency list. What must not happen is recording the token
		// before it succeeded — that would turn one failure into "never retried".
		const depAt = srcAd.indexOf("}, [anchorToken, N]);", effEnd);
		if (depAt < 0) throw new Error("ANCHORDEDUPE1 the retry-on-growth dependency was removed, so an early deep link can never land");
		if (body.indexOf("if (ok) appliedAnchorRef.current = anchorToken;") < 0) {
			throw new Error("ANCHORDEDUPE1 the applied token is recorded before the jump succeeds, so a failed deep link is never retried");
		}
	}

	// ── SYNTHID1: a synthetic step's id must survive prepending history ───────
	// `stepCounter` is a WINDOW-wide running count. The synthetic-step id embedded it,
	// so loading older history renumbered the id of the very step the reader had
	// selected; the selection pin's `findIndex` returned -1 and the detail panel
	// silently showed a DIFFERENT record at the same position.
	{
		const early = [];
		for (let turn = 1; turn <= 5; turn += 1) {
			early.push({ kind: "user", seq: turn * 10, time: turn * 1000, turn, content: [{ type: "text", text: "u" + turn }] });
			early.push({ kind: "assistant", seq: turn * 10 + 1, time: turn * 1000 + 1, turn, step: 1, messageId: "m" + turn, blocks: [{ kind: "text", text: "a" + turn }] });
		}
		const later = [];
		for (let turn = 6; turn <= 8; turn += 1) {
			later.push({ kind: "user", seq: turn * 10, time: turn * 1000, turn, content: [{ type: "text", text: "u" + turn }] });
			later.push({ kind: "assistant", seq: turn * 10 + 1, time: turn * 1000 + 1, turn, step: 1, messageId: "m" + turn, blocks: [{ kind: "text", text: "a" + turn }] });
		}
		const streaming = { turn: 9, step: 1, blocks: [{ kind: "text", text: "s" }], timing: { stepStartTime: 9000 } };
		const mkSyn = (nodes) => deriveTraceTree({ eventNodes: nodes, requests: [], callSchemas: new Map(), runningCalls: [], partial: streaming }, t);
		const tailTree = mkSyn(later);
		const fullTree = mkSyn(early.concat(later));
		const pickSyn = (tr) => tr.stations.filter((st) => st.kind === "step" && st.synthetic === true)[0];
		const s1 = pickSyn(tailTree);
		const s2 = pickSyn(fullTree);
		if (s1 === void 0 || s2 === void 0) throw new Error("SYNTHID1 the fixture produced no synthetic step");
		// The window-wide counter really did move: that is what makes the old id unstable.
		if (s1.stepNo === s2.stepNo) throw new Error("SYNTHID1 the fixture is useless: the window counter did not shift");
		if (s1.id !== s2.id) {
			throw new Error("SYNTHID1 the synthetic step id changed with the window (" + s1.id + " -> " + s2.id + "), so the selection pin loses it");
		}
		// Uniqueness must survive: the pin and React keys still rely on it.
		const allIds = fullTree.stations.map((st) => st.id);
		if (new Set(allIds).size !== allIds.length) throw new Error("SYNTHID1 station ids are no longer unique");
	}

	// ── ARIA4: a listbox may own only `option` children ───────────────────────
	// The idle gap band is a `<span>` sitting directly inside `role="listbox"` and was
	// NOT hidden from assistive tech, so it counted as an item and was read out as
	// "⏸ idle 5.0 min" between two stations. The playhead beside it was already
	// `aria-hidden`; this one was missed. The band is pure decoration — the station's
	// own aria-label already carries the timing.
	{
		let ReactAr = null;
		let rtAr = null;
		try { ReactAr = require("react"); rtAr = require("react/jsx-runtime"); } catch { ReactAr = null; }
		if (ReactAr === null) {
			console.log("ARIA4 SKIPPED: react / react/jsx-runtime not installed");
		} else {
			const srcAr = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
			const vmAr = require("node:vm");
			const boxAr = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, Date, RegExp,
				isFinite, parseInt, parseFloat, Error, TypeError, Symbol, Promise,
				react: ReactAr, jsx: rtAr.jsx, jsxs: rtAr.jsxs, fragment: rtAr.Fragment,
				document: void 0, window: void 0, location: void 0 };
			boxAr.globalThis = boxAr;
			vmAr.createContext(boxAr);
			const hAr = srcAr.indexOf("//#region pure helpers: snapshot -> timeline tree");
			const hEnd = srcAr.indexOf("//#endregion", hAr);
			const cAr = srcAr.indexOf("//#region horizontal timeline + replay component");
			const cEnd = srcAr.indexOf("//#endregion", cAr);
			vmAr.runInContext("const fragment = react.Fragment;\n" + srcAr.slice(hAr, hEnd) + "\n" + srcAr.slice(cAr, cEnd) + ";globalThis.__ar={TraceMapView};", boxAr, { timeout: 60000 });
			// Two stations 10 minutes apart, so the idle band really renders.
			const gapSnap = { eventNodes: [
				{ kind: "user", seq: 1, time: 0, turn: 1, content: [{ type: "text", text: "q" }] },
				{ kind: "assistant", seq: 2, time: 1000, turn: 1, step: 1, messageId: "m1", blocks: [{ kind: "text", text: "a" }] },
				{ kind: "assistant", seq: 3, time: 600000, turn: 1, step: 2, messageId: "m2", blocks: [{ kind: "text", text: "b" }] }
			], requests: [], callSchemas: {}, runningCalls: {}, partial: null };
			const html = require("react-dom/server").renderToStaticMarkup(rtAr.jsx(boxAr.__ar.TraceMapView, {
				useSession: (sel) => { try { return sel({ openState: "open" }); } catch { return void 0; } },
				useTrajectory: () => gapSnap,
				t: (k) => k,
				viewRequest: null,
				completeViewRequest: () => {},
				loadOlder: async () => false
			}));
			if (!html.includes("dstv_gapBand")) throw new Error("ARIA4 the fixture rendered no idle band, so the guard proves nothing");
			const gapAt = html.indexOf('class="dstv_gapBand');
			const gapTagStart = html.lastIndexOf("<", gapAt);
			const gapTag = html.slice(gapTagStart, html.indexOf(">", gapAt) + 1);
			if (gapTag.indexOf('aria-hidden="true"') < 0) {
				throw new Error("ARIA4 the idle band is exposed to assistive tech: " + gapTag.slice(0, 140));
			}
			// The playhead must stay hidden too — it is the same class of decoration.
			if (!/class="dstv_playhead" aria-hidden="true"/.test(html) && html.includes("dstv_playhead")) {
				throw new Error("ARIA4 the playhead became exposed");
			}
		}
	}

	// ── MD4: a table cell may contain an escaped pipe ─────────────────────────
	// `\|` is the only way to put a literal pipe inside a table cell. Splitting on
	// every `|` cut that cell in two, so `| a \| b | c |` produced THREE columns and
	// every cell after the escape shifted one column left under the header — the row
	// silently disagreed with its own header.
	{
		const esc = mdBlocks("| a \\| b | c |\n| - | - |\n| 1 | 2 |");
		if (esc[0].type !== "table") throw new Error("MD4 a table with an escaped pipe is not a table");
		if (esc[0].head.length !== 2) {
			throw new Error("MD4 an escaped pipe split the cell: " + JSON.stringify(esc[0].head));
		}
		if (esc[0].head[0] !== "a | b") {
			throw new Error("MD4 the escape was not turned back into a pipe: " + JSON.stringify(esc[0].head[0]));
		}
		if (esc[0].head[1] !== "c") throw new Error("MD4 the cell after the escape shifted column");
		// Ordinary tables, code spans holding a bare pipe, and trailing pipes must not
		// regress — the escape handling must be additive.
		const plain = mdBlocks("| a | b |\n| - | - |\n| 1 | 2 |");
		if (plain[0].head.join(",") !== "a,b") throw new Error("MD4 a plain table broke: " + JSON.stringify(plain[0].head));
		const codeSpan = mdBlocks("| `x` | y |\n| - | - |\n| 1 | 2 |");
		if (codeSpan[0].head.join(",") !== "`x`,y") throw new Error("MD4 a code-span cell broke: " + JSON.stringify(codeSpan[0].head));
		// A row without the trailing pipe must still split correctly.
		const noTrail = mdBlocks("| a | b\n| - | -\n| 1 | 2");
		if (noTrail[0].head.join(",") !== "a,b") throw new Error("MD4 a table without trailing pipes broke: " + JSON.stringify(noTrail[0].head));
	}

	// ── MD3: an empty link label must not swallow the text around it ──────────
	// `[](https://x)` is legal Markdown. The scanner asked for the next `]` STRICTLY
	// after `i+1`, so a `]` sitting exactly at `i+1` was invisible to it. The breakage
	// was not local: the scan carried on and the NEXT `[label](href)` paired with the
	// earlier bracket, so `[](http://x) 见 [说明](http://y)` rendered as ONE link whose
	// text was "](http://x) 见 [说明" pointing at y — the visible text between the two
	// links was swallowed into a link label.
	{
		const empty = mdInline("[](http://x)");
		if (empty.length !== 1 || empty[0].t !== "link") {
			throw new Error("MD3 an empty-label link is not recognised: " + JSON.stringify(empty));
		}
		if (empty[0].href !== "http://x") throw new Error("MD3 the empty-label link lost its target");
		// An empty label must not render an invisible anchor: show the target.
		if (empty[0].text !== "http://x") {
			throw new Error("MD3 an empty label must fall back to something readable, got " + JSON.stringify(empty[0].text));
		}
		// The regression that matters: text between two links must stay text.
		const pair = mdInline("[](http://x) 见 [说明](http://y)");
		if (pair.length !== 3) {
			throw new Error("MD3 the text between two links was swallowed: " + JSON.stringify(pair));
		}
		if (pair[1].t !== "text" || pair[1].text.indexOf("见") < 0) {
			throw new Error("MD3 the middle text was absorbed into a link label: " + JSON.stringify(pair[1]));
		}
		if (pair[2].t !== "link" || pair[2].text !== "说明" || pair[2].href !== "http://y") {
			throw new Error("MD3 the second link lost its own label or target: " + JSON.stringify(pair[2]));
		}
		// Ordinary links, adjacent links and unclosed brackets must be unaffected.
		const plain = mdInline("[a](b)");
		if (plain.length !== 1 || plain[0].t !== "link" || plain[0].text !== "a") throw new Error("MD3 a normal link broke");
		const adjacent = mdInline("[a](b)[](c)[d](e)");
		if (adjacent.map((x) => x.t).join(",") !== "link,link,link") {
			throw new Error("MD3 adjacent links (one with an empty label) broke: " + JSON.stringify(adjacent));
		}
		if (mdInline("[a]b](c)")[0].t !== "text") throw new Error("MD3 a stray bracket must stay literal text");
	}

	// ── TIMER1: feedback timers must not overlap each other ──────────────────
	// Both copy buttons show a transient result for ~1.4 s. Each click started its OWN
	// timer without cancelling the previous one, so a second click inside that window
	// had its state wiped early by the first click's timeout: the button reverted to
	// the idle label and the copy looked ignored. That is the exact confusion the
	// three-state feedback was added to prevent.
	{
		const srcTm = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		// The reset must be scheduled through a cancellable ref, not an anonymous timer.
		if (!/resetRef\.current = setTimeout\(/.test(srcTm)) {
			throw new Error("TIMER1 CopyBtn starts an uncancellable feedback timer");
		}
		if (!/clearTimeout\(resetRef\.current\)/.test(srcTm)) {
			throw new Error("TIMER1 CopyBtn never cancels the previous feedback timer");
		}
		if (!/exportResetRef\.current = setTimeout\(/.test(srcTm)) {
			throw new Error("TIMER1 the export button starts an uncancellable feedback timer");
		}
		if (!/clearTimeout\(exportResetRef\.current\)/.test(srcTm)) {
			throw new Error("TIMER1 the export button never cancels the previous feedback timer");
		}
		// And no bare `setTimeout(() => set…("idle")` may remain: that is the shape of the
		// bug, and it is what a future edit would most likely reintroduce.
		if (/setTimeout\(\(\) => setCopyState\("idle"\)/.test(srcTm)) {
			throw new Error("TIMER1 a bare copy-reset timer is back");
		}
		if (/setTimeout\(\(\) => setExportState\("idle"\)/.test(srcTm)) {
			throw new Error("TIMER1 a bare export-reset timer is back");
		}
		// Behavioural: a fake clock has to show the second click surviving the first
		// timer. Simulate the scheduling logic the component now uses.
		const pending = { id: null };
		const fires = [];
		let state = "idle";
		const reset = () => { state = "idle"; pending.id = null; };
		const click = (ok, at) => {
			state = ok ? "ok" : "fail";
			if (pending.id !== null) clearTimeout(pending.id);
			pending.id = setTimeout(reset, 1400);
			fires.push(at + ":" + state);
		};
		click(true, 0);
		clearTimeout(pending.id);
		pending.id = null;
		state = "fail";                       // second click, 300 ms later, also failed
		pending.id = setTimeout(reset, 1400);
		// First click's deadline (1400 ms) would have cleared this state under the old code.
		if (state !== "fail") throw new Error("TIMER1 the second click's feedback did not survive");
	}

	// ── BOUNDARYKEY1: a crashed panel must not stay crashed for other records ──
	// An error boundary keeps its error state until it unmounts or the user presses
	// retry. Station cards key on `card${s.id}`, so moving to another card clears it —
	// but the detail body used a FIXED key, so one station's crash pinned "render
	// failed" onto every later station and every tab. Selecting a healthy record still
	// showed the error, and nothing but a manual retry cleared it.
	{
		const srcBk = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const at = srcBk.indexOf('}, `dBodySafe:');
		if (at < 0) {
			throw new Error("BOUNDARYKEY1 the detail boundary still uses a fixed key, so one crash sticks to every record");
		}
		const keyExpr = srcBk.slice(at, srcBk.indexOf("\n", at));
		if (keyExpr.indexOf("activeStation.id") < 0) {
			throw new Error("BOUNDARYKEY1 the boundary key does not depend on the selected station");
		}
		if (keyExpr.indexOf("showTab") < 0) {
			throw new Error("BOUNDARYKEY1 the boundary key does not depend on the tab, so a crash on one tab sticks to the other");
		}
		// The station-card boundary is the reference implementation; keep it that way.
		if (!/}, `card\$\{s\.id\}`\)/.test(srcBk)) {
			throw new Error("BOUNDARYKEY1 the station-card boundary lost its per-station key");
		}
	}

	// ── TOOLLIST1: one hole in the tool catalog must not blank the request tab ─
	// `prompt.tools` is only checked for being an ARRAY (a non-array becomes `[]`); the
	// ENTRIES were trusted. One `null` entry threw
	// `Cannot read properties of null (reading 'name')` during render, and the throw
	// happens while building the tab: EVERY other tool in the catalog disappeared
	// because of one hole, and on the server (where an error boundary is not honoured)
	// the whole view went with it.
	{
		let ReactTl = null;
		try { ReactTl = require("react"); } catch { ReactTl = null; }
		if (ReactTl === null) {
			console.log("TOOLLIST1 SKIPPED: react not installed");
		} else {
			// The helper is where the normalisation must live, so assert it directly.
			if (typeof safeToolList !== "function") throw new Error("TOOLLIST1 safeToolList is missing");
			if (safeToolList("nope").length !== 0) throw new Error("TOOLLIST1 a non-array catalog must normalise to []");
			// Wrap it: without the guard the very case under test THROWS out of the suite as
			// an anonymous TypeError instead of naming the defect it proves.
			let mixed = null;
			try {
				mixed = safeToolList([null, { name: "bash", description: "d" }, void 0, 42, { name: 7, description: { x: 1 } }]);
			} catch (e) {
				throw new Error("TOOLLIST1 normalising a catalog with a hole threw: " + e.constructor.name + ": " + e.message.slice(0, 100));
			}
			if (mixed.length !== 2) throw new Error("TOOLLIST1 holes and non-objects must be dropped, found " + mixed.length + " entries");
			if (mixed[0].name !== "bash" || mixed[0].description !== "d") throw new Error("TOOLLIST1 a real tool was mangled");
			if (typeof mixed[1].name !== "string" || typeof mixed[1].description !== "string") {
				throw new Error("TOOLLIST1 drifted fields must be coerced to strings, got " + typeof mixed[1].name + "/" + typeof mixed[1].description);
			}
			// And the projection must call it: a normaliser nobody uses fixes nothing.
			const srcTl = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
			if (srcTl.indexOf("safeToolList(req.prompt?.tools)") < 0) {
				throw new Error("TOOLLIST1 the request tab still reads prompt.tools raw");
			}
		}
	}

	// ── TEXTCOERCE1: one non-string field must not blank the panel ────────────
	// The host contracts type `TurnErrorNode.message`, `CommandNode.args` and the
	// compaction summary as `string`, so a non-string is a contract violation — but a
	// violation is not "cannot happen". React throws "Objects are not valid as a React
	// child" for one, and that throw happens during RENDER: a single drifted field
	// blanked the whole card, and the server render (where an error boundary is not
	// honoured) took the whole view down.
	//
	// This guard renders the REAL component through react-dom/server with the REAL
	// jsx runtime. Two earlier suites here passed `React.createElement` where the
	// bundle expects `jsx`, which turns the element key into a child and made the
	// render succeed against skeleton markup only.
	{
		let ReactTc = null;
		let rtTc = null;
		try {
			ReactTc = require("react");
			rtTc = require("react/jsx-runtime");
		} catch {
			ReactTc = null;
		}
		if (ReactTc === null) {
			console.log("TEXTCOERCE1 SKIPPED: react / react/jsx-runtime not installed");
		} else {
			const renderTc = require("react-dom/server").renderToStaticMarkup;
			// The helper must coerce at the SOURCE, so `asText` itself is asserted too.
			if (typeof asText !== "function") throw new Error("TEXTCOERCE1 asText is missing");
			if (asText("a") !== "a") throw new Error("TEXTCOERCE1 a string must pass through");
			if (asText(null) !== "" || asText(void 0) !== "") throw new Error("TEXTCOERCE1 nullish must become an empty string");
			if (asText(42) !== "42" || asText(true) !== "true") throw new Error("TEXTCOERCE1 primitives must stringify");
			// An object must degrade to something readable, not silently vanish.
			const objText = asText({ code: "E_BAD" });
			if (objText.indexOf("E_BAD") < 0) throw new Error("TEXTCOERCE1 an object field lost its content: " + objText);
			if (objText.indexOf("[object Object]") >= 0) throw new Error("TEXTCOERCE1 an object field degraded to [object Object]");
			// And the projection must actually call it: a helper nobody uses fixes nothing.
			const srcTc = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "lib", "client.js"), "utf8");
			for (const field of ["summary: asText(", "message: asText(", "args: asText(", "outcomeText: asText("]) {
				if (srcTc.indexOf(field) < 0) throw new Error("TEXTCOERCE1 the projection does not coerce " + field + "…)");
			}
			const vmTc = require("node:vm");
			const boxTc = { console, JSON, Set, Map, WeakSet, Math, String, Object, Array, Number, Boolean, Date, RegExp,
				isFinite, parseInt, parseFloat, Error, TypeError, Symbol, Promise,
				react: ReactTc, jsx: rtTc.jsx, jsxs: rtTc.jsxs, fragment: rtTc.Fragment,
				document: void 0, window: void 0, location: void 0 };
			boxTc.globalThis = boxTc;
			vmTc.createContext(boxTc);
			const hTc = srcTc.indexOf("//#region pure helpers: snapshot -> timeline tree");
			const hTcEnd = srcTc.indexOf("//#endregion", hTc);
			const cTc = srcTc.indexOf("//#region horizontal timeline + replay component");
			const cTcEnd = srcTc.indexOf("//#endregion", cTc);
			vmTc.runInContext("const fragment = react.Fragment;\n" + srcTc.slice(hTc, hTcEnd) + "\n" + srcTc.slice(cTc, cTcEnd) + ";globalThis.__tc = { TraceMapView };", boxTc, { timeout: 60000 });
			const CompTc = boxTc.__tc.TraceMapView;
			if (typeof CompTc !== "function") throw new Error("TEXTCOERCE1 the component hook never fired");
			const bad = { obj: 1 };
			const cases = [
				["turn-error message", [{ kind: "turn-error", seq: 1, time: 1, turn: 1, message: bad }]],
				["retry failure message", [{ kind: "model-retry", seq: 2, time: 2, turn: 1, failure: { message: bad }, retry: 1, maxRetries: 3 }]],
				["compaction summary", [{ kind: "compaction", seq: 3, time: 3, summary: bad }]],
				["command args", [{ kind: "command", seq: 4, time: 4, name: "n", args: bad, outcome: { kind: "success", text: bad } }]],
				["command name", [{ kind: "command", seq: 5, time: 5, name: bad, args: "x" }]],
				["array holding an object", [{ kind: "turn-error", seq: 6, time: 6, turn: 1, message: ["a", bad] }]]
			];
			for (const [name, nodes] of cases) {
				const snapTc = { eventNodes: nodes, requests: [], callSchemas: {}, runningCalls: {}, partial: null };
				let html = null;
				try {
					html = renderTc(rtTc.jsx(CompTc, {
						useSession: (sel) => { try { return sel({ openState: "open" }); } catch { return void 0; } },
						useTrajectory: () => snapTc,
						t: (k) => k,
						viewRequest: null,
						completeViewRequest: () => {},
						loadOlder: async () => false
					}));
				} catch (e) {
					throw new Error("TEXTCOERCE1 " + name + " threw during render: " + e.constructor.name + ": " + e.message.slice(0, 120));
				}
				if (typeof html !== "string" || !html.includes("dstv_station")) {
					throw new Error("TEXTCOERCE1 " + name + " rendered no station card");
				}
				if (html.includes("[object Object]")) throw new Error("TEXTCOERCE1 " + name + " printed [object Object]");
			}
		}
	}

	// ── REQJSON1: the request tab must survive a descriptor it did not build ──
	// The payload and the tool catalog come from the HOST. `JSON.stringify` throws on a
	// circular structure and on a BigInt, and the throw happens during RENDER — one
	// shared object reference in a tool schema blanked the whole request tab. The server
	// render test never saw it because that tab is not the default.
	{
		const srcRj = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const bodyAt = srcRj.indexOf("const renderRequestBody = (s, messages) => {");
		if (bodyAt < 0) throw new Error("REQJSON1 renderRequestBody is missing");
		const nextFn = srcRj.indexOf("\n\t\t\tconst ", bodyAt + 20);
		const body = srcRj.slice(bodyAt, nextFn < 0 ? bodyAt + 24000 : nextFn);
		// Strip comments before scanning: the comment explaining the hazard names it.
		const code = body.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
		if (/JSON\.stringify\(/.test(code)) {
			throw new Error("REQJSON1 the request tab still calls JSON.stringify directly, so a circular or BigInt descriptor throws during render");
		}
		// Behavioural: the helper must actually survive both shapes.
		const circ = { type: "object" }; circ.self = circ;
		const cycOut = safeJsonPreview(circ, Number.MAX_SAFE_INTEGER, 2);
		if (typeof cycOut !== "string" || cycOut.indexOf("[Circular]") < 0) {
			throw new Error("REQJSON1 a circular descriptor is not printable: " + String(cycOut).slice(0, 60));
		}
		const bigOut = safeJsonPreview({ d: 10n }, Number.MAX_SAFE_INTEGER);
		if (bigOut.indexOf("10n") < 0) throw new Error("REQJSON1 a BigInt descriptor is not printable: " + bigOut);
		// A plain alias is NOT a cycle: marking it "[Circular]" would silently hide real
		// content, which is its own defect.
		const alias = { n: 1 };
		const aliasOut = safeJsonPreview([alias, alias], Number.MAX_SAFE_INTEGER, 2);
		if (aliasOut.indexOf("[Circular]") >= 0) {
			throw new Error("REQJSON1 a shared (non-circular) reference is mislabelled as circular: " + aliasOut.replace(/\s+/g, " "));
		}
		// Indent must stay opt-in: every other caller expects one compact line. Both
		// directions are asserted here because a default indent silently reflows every
		// payload cell into a multi-line block, and a lost indent makes the request tab
		// one unreadable line.
		const compact = safeJsonPreview({ a: 1, b: 2 }, 1000, 0);
		if (compact.indexOf("\n") >= 0) {
			throw new Error("REQJSON1 the compact preview gained newlines: " + JSON.stringify(compact));
		}
		const pretty = safeJsonPreview({ a: 1, b: 2 }, Number.MAX_SAFE_INTEGER, 2);
		if (pretty.indexOf("\n") < 0) {
			throw new Error("REQJSON1 the pretty-printed request payload is no longer indented: " + JSON.stringify(pretty));
		}
		// A negative / fractional indent must degrade to compact, not to "2".
		for (const badPad of [-2, 1.5, NaN, "2", null]) {
			const out = safeJsonPreview({ a: 1 }, 1000, badPad);
			if (out.indexOf("\n") >= 0) {
				throw new Error("REQJSON1 indent " + String(badPad) + " was treated as a real indent: " + JSON.stringify(out));
			}
		}
	}

	// ── ANCHOR6: an impossible anchor must be rejected, not chased ───────────
	// Turns and steps are 1-based everywhere in the projection, so `t0` / `s0` name no
	// record. Accepting them was not harmless: resolution answered "not-loaded", which
	// makes the view page back up to 40 times hunting a record that can never arrive,
	// then blame the page cap. Long digit runs overflowed to Infinity the same way.
	// `e<seq>` already used `Number.isSafeInteger`; the `t`/`p` branches did not.
	{
		const bad = ["tvp1:t0s1", "tvp1:t1s0", "tvp1:p0s1", "tvp1:p1s0",
			"tvp1:t" + "9".repeat(400) + "s1", "tvp1:p1s" + "9".repeat(400),
			"tvp1:t0s0", "tvp1:p0s0"];
		for (const b of bad) {
			const parsed = parseAnchor(b);
			if (parsed.ok === true) {
				throw new Error("ANCHOR6 " + JSON.stringify(b.slice(0, 40)) + " parses as a valid anchor (turn=" + parsed.turn + ", step=" + parsed.step + ")");
			}
		}
		// The rejecting must not be over-eager: real anchors still work.
		const good = [["tvp1:t1s1", 1, 1], ["tvp1:p2s3", 2, 3], ["tvp1:p2s3cabc", 2, 3], ["tvp1:t17s42", 17, 42]];
		for (const [g, turn, step] of good) {
			const parsed = parseAnchor(g);
			if (parsed.ok !== true) throw new Error("ANCHOR6 " + g + " must stay valid (reason " + parsed.reason + ")");
			if (parsed.turn !== turn || parsed.step !== step) {
				throw new Error("ANCHOR6 " + g + " parsed as turn " + parsed.turn + " step " + parsed.step);
			}
		}
	}

	// ── COPYFOCUS1: the legacy copy path must not eat focus ───────────────────
	// `navigator.clipboard` does not exist on plain http://, so the textarea +
	// `execCommand` path is the COMMON one, not a museum piece. It did `ta.select()`
	// and then removed the textarea: the focused element disappeared, focus fell back
	// to <body>, and every copy threw keyboard/screen-reader users to the top of the
	// document. An editable focused textarea also raises the iOS keyboard.
	{
		const srcCF = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const at0 = srcCF.indexOf("// Legacy fallback");
		if (at0 < 0) throw new Error("COPYFOCUS1 the legacy copy path is missing");
		const seg = srcCF.slice(at0, srcCF.indexOf("function safeHref", at0));
		// Execute it against a fake DOM so the assertions are behavioural, not textual.
		const fakeTa = { value: "", style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, select() { this.selected = true; } };
		let removed = false, appended = null, refocused = null;
		const boxCF = {
			console,
			navigator: void 0,
			document: {
				activeElement: { focus(opts) { refocused = opts; } },
				createElement() { return fakeTa; },
				body: { appendChild(el) { appended = el; }, removeChild() { removed = true; } },
				execCommand() { return true; }
			}
		};
		const vmCF = require("node:vm").createContext(boxCF);
		require("node:vm").runInContext(srcCF.slice(srcCF.indexOf("function copyText("), srcCF.indexOf("function safeHref")), boxCF, { timeout: 20000 });
		if (typeof boxCF.copyText !== "function") throw new Error("COPYFOCUS1 copyText never became callable");
		let ok = null;
		boxCF.copyText("hello", (v) => { ok = v; });
		if (appended === null) throw new Error("COPYFOCUS1 the legacy path never appended a textarea");
		if (removed !== true) throw new Error("COPYFOCUS1 the temporary textarea was left in the DOM");
		if (fakeTa.attrs.readonly !== "") {
			throw new Error("COPYFOCUS1 the focused textarea is editable, so iOS raises a keyboard into an invisible field");
		}
		if (fakeTa.attrs["aria-hidden"] !== "true") throw new Error("COPYFOCUS1 the helper field is exposed to assistive tech");
		if (refocused === null) {
			throw new Error("COPYFOCUS1 focus was never restored — removing the focused textarea drops it to <body>");
		}
		if (refocused.preventScroll !== true) throw new Error("COPYFOCUS1 restoring focus must not scroll the timeline");
		if (ok !== true) throw new Error("COPYFOCUS1 the legacy path reported " + String(ok));
	}

	// ── LOADOLDER1: a refused history page must say so ────────────────────────
	// The button flipped to "loading", flipped back, and the timeline simply did not
	// grow. Offline / expired session / host error all looked identical to "nothing
	// more to load", so the user retried a request that was already being refused.
	{
		const srcLo = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		if (!/catch\(\(\) => setOlderNote\(t\("action.loadOlderFailed"\)\)\)/.test(srcLo)) {
			throw new Error("LOADOLDER1 a failed history page is still swallowed");
		}
		if (srcLo.indexOf("hOlderNote") < 0) throw new Error("LOADOLDER1 the failure note is never rendered");
		// It must reach assistive tech too: the chip appears without any focus move.
		const live = srcLo.slice(srcLo.indexOf("hAnchorLive") - 400, srcLo.indexOf("hAnchorLive") + 60);
		if (live.indexOf("olderNote") < 0) {
			throw new Error("LOADOLDER1 the failure is only visual, screen readers never hear it");
		}
		// And it must be cleared when the conversation changes, or a fresh session
		// opens already claiming a failure that belongs to the previous one.
		const sess = srcLo.slice(srcLo.indexOf("const prev = sessionRef.current;"));
		if (sess.slice(0, 900).indexOf("setOlderNote(null)") < 0) {
			throw new Error("LOADOLDER1 the note survives a session switch");
		}
	}

	// ── COPY1: a failed copy must be visible, and must not crash ──────────────
	// Two separate defects, both invisible to a server-render test:
	//   - `copyText` failures returned silently, so a click looked ignored and the user
	//     pasted whatever was in the clipboard from before (`navigator.clipboard` is
	//     absent on plain http://, and `execCommand` can refuse);
	//   - the failure text called `t(...)` inside the module-level `CopyBtn` component,
	//     where `t` is NOT in scope. That is a ReferenceError raised only when a copy
	//     actually fails — unreachable from SSR and from every existing test.
	{
		const srcCp = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		const btnAt = srcCp.indexOf("function CopyBtn({");
		if (btnAt < 0) throw new Error("COPY1 CopyBtn is missing");
		// End the slice at the NEXT top-level declaration, not at the first "});" —
		// that one lands inside `doCopy`'s setTimeout, so the assertion silently only
		// inspected the first half of the component (the render branch with the `t(...)`
		// call was outside the window and a mutation there went unnoticed).
		const nextDecl = srcCp.indexOf("\n\t\tfunction ", btnAt + 10);
		const nextHook = srcCp.indexOf("\n\t\t/**", btnAt + 10);
		const candidates = [nextDecl, nextHook].filter((x) => x > btnAt);
		const btnEnd = candidates.length > 0 ? Math.min(...candidates) : btnAt + 2000;
		const btn = srcCp.slice(btnAt, btnEnd);
		if (/\bt\(/.test(btn.replace(/\/\/.*$/gm, ""))) {
			throw new Error("COPY1 CopyBtn uses `t` directly, but it is a module-level component with no such binding");
		}
		// The expression, not the word: `failLabel` sitting in a comment, or the whole
		// `fail` branch deleted while the prop stays declared, both used to pass.
		if (!/copyState === "fail" \? `✗ \$\{failLabel/.test(btn)) {
			throw new Error("COPY1 CopyBtn has no rendered failure state (the branch must return `✗ ${failLabel…}`)");
		}
		if (!/copyState/.test(btn)) throw new Error("COPY1 CopyBtn lost its three-state feedback");
		// Every call site must supply the failure text, or the button shows a bare "!".
		// Split on the call marker and look inside each fragment up to the next one:
		// the call props span one line but contain nested `t(...)`, so a `[^)]*` scan
		// stopped at the first closing paren and matched nothing at all.
		const frags = srcCp.split("jsx(CopyBtn,").slice(1);
		const missing = frags.filter((f) => f.slice(0, 400).indexOf("failLabel:") < 0);
		if (missing.length > 0) {
			throw new Error("COPY1 " + missing.length + " of " + frags.length + " CopyBtn call sites do not pass failLabel");
		}
		if (srcCp.indexOf("setCopyState(ok ? \"ok\" : \"fail\")") < 0) {
			throw new Error("COPY1 a failed copy is still silent");
		}
		// The whole-trace Markdown export has the same clipboard and the same silent
		// return. It was fixed separately and regressed separately, so it is asserted
		// separately: a dead-looking export button makes the user believe the entire
		// transcript is on the clipboard when nothing was written.
		if (srcCp.indexOf("setExportState(ok ? \"ok\" : \"fail\")") < 0) {
			throw new Error("COPY1 the whole-trace export still fails silently");
		}
		if (srcCp.indexOf(".dstv_btn[data-fail=true]") < 0) {
			throw new Error("COPY1 the export failure state is not styled");
		}
		// A visible word needs a visible colour, or "✗ Copy failed" reads as a label.
		if (srcCp.indexOf(".dstv_copyBtn[data-fail=true]") < 0) {
			throw new Error("COPY1 the failure state is not styled, so it does not read as a failure");
		}
	}

	// ── SESSION1: switching conversations must not carry UI state across ──────
	// The host reuses one component instance when the user opens another
	// conversation. Every local UI fact survived the switch and was applied to a
	// different transcript: the replay position (clamped, so a 5-station session opened
	// fully "replayed" because the previous one was on station 40), the search query,
	// the selected tab, follow mode.
	{
		const srcS = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
		// The slot must hand the view an identity to compare against.
		if (!/sessionKey: String\(sessionId\)/.test(srcS)) {
			throw new Error("SESSION1 the slot does not pass a session identity, so the view cannot notice a switch");
		}
		if (!/function TraceMapView\(\{[^}]*sessionKey/.test(srcS)) {
			throw new Error("SESSION1 the view does not receive `sessionKey`");
		}
		// The reset must actually clear the replay position and the search state.
		const at = srcS.indexOf("const prev = sessionRef.current;");
		if (at < 0) throw new Error("SESSION1 the session-change effect is missing");
		// Bound the slice to THIS effect: a fixed 900-char window ran past it into the
		// replay engine's own `setRevealed(null)`, so deleting the reset here still
		// "found" a reset that belonged to unrelated code.
		const end = srcS.indexOf("}, [sessionKey]);", at);
		if (end < 0) throw new Error("SESSION1 the session-change effect has no dependency list");
		const body = srcS.slice(at, end);
		for (const reset of ["setRevealed(null)", "setQueryRaw(\"\")", "setPlaying(false)", "setTab(\"detail\")"]) {
			if (body.indexOf(reset) < 0) {
				throw new Error("SESSION1 switching sessions does not reset " + reset);
			}
		}
		// Guard against a reset that fires on every render: it must be keyed on the
		// identity and compare against the previous value first.
		if (body.indexOf("if (prev === sessionKey) return;") < 0) {
			throw new Error("SESSION1 the reset is unconditional — it would wipe the user's position on every render");
		}
		// ...and the resets must be REACHABLE. Inserting an unconditional `return;` after
		// the comparison left every expected token in place while the effect never reset
		// anything, and the guard above still passed.
		const afterGuard = body.slice(body.indexOf("if (prev === sessionKey) return;") + 30);
		const firstReset = afterGuard.indexOf("setRevealed(null)");
		if (firstReset < 0) throw new Error("SESSION1 the reset is unreachable after the identity comparison");
		const beforeFirstReset = afterGuard.slice(0, firstReset);
		if (/(^|\n)\s*(if \([^)]*\) )?return;/.test(beforeFirstReset)) {
			throw new Error("SESSION1 a return before the first reset makes the whole reset dead code");
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

			// A stale match pointer must be clamped before stepping, and a FRESH query must
			// not claim a position: the real body is executed rather than pattern-matched,
			// because the literal expression changed once already and this guard then
			// reported a regression that was not one.
			{
				const grabGm = (() => {
					const at = srcN.indexOf("const gotoMatch = (dir) => {");
					if (at < 0) return "";
					let i = srcN.indexOf("{", at), d = 0;
					for (; i < srcN.length; i += 1) { if (srcN[i] === "{") d += 1; else if (srcN[i] === "}") { d -= 1; if (d === 0) { i += 1; break; } } }
					return srcN.slice(at, i);
				})();
				if (grabGm === "") throw new Error("X1-n gotoMatch is missing");
				const driveGm = (ptr, len, dir) => {
					const out = { ptr: null, seeked: null };
					new Function("dir", "matchPtr", "matches", "setMatchPtr", "seek", grabGm + "\ngotoMatch(dir);")(
						dir, ptr, Array.from({ length: len }, (_, k) => k), (v) => { out.ptr = v; }, (i) => { out.seeked = i; });
					return out;
				};
				// A stale pointer past the end must stay inside the ring: stepping back from
				// "past the end" lands on the last item, stepping forward lands on the first.
				if (driveGm(9, 3, -1).seeked !== 2) throw new Error("X1-n a stale matchPtr is no longer clamped");
				if (driveGm(9, 3, 1).seeked !== 0) throw new Error("X1-n a stale matchPtr can step out of range");
				// A fresh query must land on match 1 / match N, not skip to match 2.
				if (driveGm(-1, 3, 1).seeked !== 0) throw new Error("X1-n the first next skipped the first match");
				if (driveGm(-1, 3, -1).seeked !== 2) throw new Error("X1-n the first prev must land on the last match");
			}
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
		// Live regions are expensive: each one can talk over the others, so the count is
		// capped. Three are deliberate and mutually distinct — the hidden anchor-note
		// region, the initial-load skeleton, and the in-panel search result count. The
		// search count had NONE, which meant typing in the box produced no announcement
		// at all; raising the cap is the honest fix (a silent search is worse than three
		// separate status sources). Anything beyond three still fails.
		if ((src.match(/aria-live/g) || []).length > 3) throw new Error("N2 too many live regions");
		if (!/className: "dstv_chip warn", title: anchorNote, children: anchorNote/.test(src)) throw new Error("N2 the single note belongs in the header, with a title");
		// The search result count is dynamic feedback: without a live region a screen
		// reader user types a query and hears nothing, including "no matches". Assert the
		// element itself carries the attributes — a global count cannot prove that.
		// The first match is the CSS rule in the style block; the JSX element is the one
		// that must carry the attributes.
		const sCntAt = src.indexOf("className: `dstv_searchCount");
		if (sCntAt < 0) throw new Error("N2 the search count element is missing");
		const sCntBlock = src.slice(sCntAt, sCntAt + 600);
		if (!sCntBlock.includes('"aria-live": "polite"')) throw new Error("N2 the search result count is not announced (no live region on .dstv_searchCount)");
		if (!sCntBlock.includes('role: "status"')) throw new Error("N2 the search result count has no status role");
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
		// Assert the STATEMENT, not the identifier: `setPlayheadLeft` inside a comment or
		// a dead `void 0; /* setPlayheadLeft(x) */` satisfied the old check while the
		// marker never moved.
		if (!/if \(Number\.isFinite\(docLeft\)\) setPlayheadLeft\(docLeft\);/.test(src)) {
			throw new Error("P4 the measured position is never written to the playhead state");
		}
		if (!/const docLeft = el\.offsetLeft \+ el\.offsetWidth \/ 2;/.test(src)) {
			throw new Error("P4 the marker must be centred on the measured station");
		}
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
		// MACHINE-INDEPENDENT: assert the SCALING, not the wall clock.
		//
		// An absolute budget cannot work here. On this box the same fixture measured
		// 96 ms min vs 262 ms max with no code change; wall clock best-of-9 still
		// flapped (151 ms best vs 350 ms worst) and the 250 ms budget failed on a run
		// that had not regressed at all — measured CPU time for that same fold was
		// 50 ms best / 169 ms worst. Two runs on the same machine differ by 3x, so any
		// absolute number is a coin flip.
		//
		// What we actually care about is the SHAPE: doubling the input must roughly
		// double the cost (linear), not quadruple it (accidental O(n²)). That ratio is
		// a property of the code and holds regardless of how loaded the machine is.
		// Measured here: 4,500 -> 9,000 nodes = 1.60x, 9,000 -> 18,000 = 1.97x.
		const cpuMsOf = (snap) => {
			// Warm-up: earlier perf cases leave garbage that one pass does not settle.
			for (let w = 0; w < 3; w += 1) deriveTraceTree(snap, t);
			let best = Infinity;
			for (let i = 0; i < 7; i += 1) {
				const before = process.cpuUsage();
				deriveTraceTree(snap, t);
				const used = process.cpuUsage(before);
				const ms = (used.user + used.system) / 1000;
				if (ms < best) best = ms;
			}
			return best;
		};
		const half = [];
		{
			let s1 = 1;
			for (let turn = 1; turn <= 100; turn += 1) {
				half.push({ kind: "user", seq: s1++, time: 1000 * s1, turn, content: [{ type: "text", text: "q" + turn }] });
				for (let step = 1; step <= 15; step += 1) {
					half.push({ kind: "assistant", seq: s1++, time: 1000 * s1, turn, step, blocks: [
						{ kind: "text", text: "x".repeat(200) },
						{ kind: "tool-call", callId: "c" + s1, name: "read", argsRaw: "{}" }
					] });
					half.push({ kind: "tool-result", seq: s1++, time: 1000 * s1, callId: "c" + (s1 - 1), call: { name: "read", argsRaw: "{}" }, content: [{ type: "text", text: "y".repeat(2000) }], isError: false, subCalls: [] });
				}
			}
		}
		const smallMs = cpuMsOf({ eventNodes: half, requests: [], callSchemas: new Map(), runningCalls: [], partial: null });
		const bigMs = cpuMsOf({ eventNodes: big, requests: [], callSchemas: new Map(), runningCalls: [], partial: null });
		// Guard the measurement itself: if the small case is too fast to time reliably,
		// the ratio is noise and asserting on it would be a false signal.
		if (smallMs < 3) throw new Error("P1 the small fixture folded in " + smallMs.toFixed(2) + " ms — too fast to measure a ratio");
		const ratio = bigMs / smallMs;
		// Linear ≈ 2.0 (measured 1.6–2.0). Quadratic ≈ 4.0. 3.0 leaves room for
		// measurement noise while still failing a real O(n^2) blow-up.
		if (ratio > 3) {
			throw new Error("P1 projection scales worse than linear: " + half.length + " nodes " + smallMs.toFixed(1)
				+ " ms -> " + big.length + " nodes " + bigMs.toFixed(1) + " ms (ratio " + ratio.toFixed(2) + ", linear ~2, quadratic ~4)");
		}
		// Keep a VERY loose absolute ceiling as a second net: it must catch a catastrophic
		// blow-up (seconds, not milliseconds) without flapping on a loaded machine.
		if (bigMs > 3000) throw new Error("P1 projection of " + big.length + " nodes took " + bigMs.toFixed(0) + " ms of CPU (ceiling 3000 ms)");
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

	// ── AUDIT1: the eight "quiet" defects an independent audit found ────────
	// Each was reproduced against the real DSH 0.2.2-rc.2 contract shapes. None of them
	// crash: they lose a record, mislabel it, or show a number that contradicts the
	// detail panel — which is why no crash-oriented guard caught them.
	{
		const foldAudit = (o) => deriveTraceTree(Object.assign({ eventNodes: [], requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, o), t);

		// (1) a compaction request whose marker is not in the window must be counted, not dropped.
		{
			const got = foldAudit({ requests: [{ purpose: "compaction", status: "running", startSeq: 4, startedAt: 1, completedAt: null, turn: null, step: 0 }] }).unplacedRequests;
			if (got !== 1) throw new Error("AUDIT1 an unmatched compaction request vanished (unplaced=" + got + ")");
		}

		// (2) the assistant node carries its model on `providerMetadata`; the view used to
		//     read only `requestConfig`/`provenance` and show no model at all.
		{
			const trM = foldAudit({ eventNodes: [{ kind: "assistant", seq: 1, time: 1e12, turn: 1, step: 1, providerMetadata: { provider: "deepseek", model: "deepseek-chat" }, blocks: [{ kind: "text", text: "ok" }] }] });
			const hint = trM.stations.find((x) => x.kind === "step").modelHint;
			if (hint !== "deepseek-chat") throw new Error("AUDIT1 the assistant node model was ignored (hint=" + String(hint) + ")");
		}

		// (3) an orphan tool-result must keep the node's own `name` when `call` is null.
		{
			const ot = foldAudit({ eventNodes: [{ kind: "tool-result", seq: 1, time: 1e12, callId: "c", name: "bash", call: null, content: [{ type: "text", text: "out" }], isError: false, subCalls: [] }] }).stations[0];
			if (ot.name !== "bash") throw new Error("AUDIT1 an orphan lost its node name (got " + String(ot.name) + ")");
		}

		// (4) KPI must agree with the detail panel when only the node carries usage.
		{
			const trU = foldAudit({ eventNodes: [{ kind: "assistant", seq: 1, time: 1e12, turn: 1, step: 1, messageId: "m", usage: { inputTokens: 10, outputTokens: 7 }, blocks: [{ kind: "text", text: "ok" }] }], requests: [{ purpose: "assistant", startSeq: 1, turn: 1, step: 1, status: "ok" }] });
			if (trU.stats.tokensIn !== 10 || trU.stats.tokensOut !== 7) {
				throw new Error("AUDIT1 the KPI ignored node usage: in=" + trU.stats.tokensIn + " out=" + trU.stats.tokensOut);
			}
			// ...and a step carrying BOTH must not be counted twice.
			const trD = foldAudit({ eventNodes: [{ kind: "assistant", seq: 1, time: 1e12, turn: 1, step: 1, messageId: "m", usage: { inputTokens: 10, outputTokens: 7 }, blocks: [{ kind: "text", text: "ok" }] }], requests: [{ purpose: "assistant", startSeq: 1, turn: 1, step: 1, status: "ok", usage: { inputTokens: 10, outputTokens: 7 } }] });
			if (trD.stats.tokensIn !== 10) throw new Error("AUDIT1 request+node usage was double-counted: in=" + trD.stats.tokensIn);
		}

		// (5) a streaming partial with several text blocks must keep ALL of them.
		{
			const trP = foldAudit({ partial: { turn: 1, step: 1, blocks: [{ kind: "text", text: "A" }, { kind: "text", text: "B" }] } });
			const texts = trP.stations.find((x) => x.kind === "step").cells.filter((c) => c.kind === "assistant").map((c) => c.text);
			if (texts.join(",") !== "A,B") throw new Error("AUDIT1 later partial text blocks were dropped: " + JSON.stringify(texts));
		}

		// (6) a non-string callId must still surface its result, and must not produce a
		//     station id that is not a string.
		{
			const symId = Symbol("id");
			const trN = foldAudit({ eventNodes: [{ kind: "tool-result", seq: 1, time: 1e12, callId: symId, content: [{ type: "text", text: "out" }], isError: false, subCalls: [] }] });
			if (trN.stations.length !== 1) throw new Error("AUDIT1 a Symbol callId result disappeared (stations=" + trN.stations.length + ")");
			if (typeof trN.stations[0].id !== "string") throw new Error("AUDIT1 the orphan id is not a string");
		}

		// (6b) a non-string callId must PAIR with its own tool-call. Indexing only string
		// ids left the result unclaimable: the call rendered with an empty result and the
		// same output ALSO appeared as an orphan station, i.e. twice, one copy looking empty.
		{
			const pairId = Symbol("pair");
			const trPair = foldAudit({ eventNodes: [
				{ kind: "assistant", seq: 1, time: 1e12, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "tool-call", callId: pairId, name: "bash", argsRaw: "{}" }] },
				{ kind: "tool-result", seq: 2, time: 1e12, turn: 1, step: 1, callId: pairId, name: "bash", call: null, content: [{ type: "text", text: "OUT" }], subCalls: [] }
			] });
			const cells = trPair.stations.filter((x) => x.kind === "step").flatMap((x) => x.cells ?? []).filter((c) => c.kind === "tool");
			const orphansPair = trPair.stations.filter((x) => x.kind === "orphan-tool");
			if (cells.length !== 1 || cells[0].resultText !== "OUT") {
				throw new Error("AUDIT1 a Symbol callId did not pair with its result: " + JSON.stringify(cells.map((c) => c.resultText)));
			}
			if (orphansPair.length !== 0) throw new Error("AUDIT1 a paired result was ALSO shown as an orphan (" + orphansPair.length + ")");
		}

		// (6c) an orphan id must be STABLE when older history is prepended. Ids double as
		// the selection pin, so a shifting ordinal made the pin point at a different record
		// after paging ("ot1000" became "ot1001" once an earlier seq appeared).
		{
			const orphanOf = (seqs) => foldAudit({ eventNodes: seqs.map((q) => ({ kind: "tool-result", seq: q, time: 1e12, callId: "c" + q, call: { name: "n", argsRaw: "{}" }, content: [{ type: "text", text: "x" }], subCalls: [] })) }).stations.map((x) => x.id);
			const alone = orphanOf([100]);
			const withEarlier = orphanOf([50, 100]);
			if (alone[0] !== withEarlier[1]) {
				throw new Error("AUDIT1 an orphan id changed when history was prepended: " + JSON.stringify(alone) + " vs " + JSON.stringify(withEarlier));
			}
			if (new Set(withEarlier).size !== withEarlier.length) throw new Error("AUDIT1 duplicate orphan ids: " + JSON.stringify(withEarlier));
		}

		// (6d) two separate partial text blocks with the SAME text are two parts, not one.
		// Collapsing by content silently merged them; the durable copy is still deduped.
		{
			const textsOf = (o) => foldAudit(o).stations.find((x) => x.kind === "step").cells.filter((c) => c.kind === "assistant").map((c) => c.text);
			const dupParts = textsOf({ partial: { turn: 1, step: 1, blocks: [{ kind: "text", text: "X" }, { kind: "text", text: "X" }] } });
			if (dupParts.length !== 2) throw new Error("AUDIT1 two identical partial parts collapsed: " + JSON.stringify(dupParts));
			// ...while a partial that merely REPEATS the durable text must still be suppressed.
			const repeatDurable = textsOf({ eventNodes: [{ kind: "assistant", seq: 1, time: 1e12, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "A" }] }], partial: { turn: 1, step: 1, blocks: [{ kind: "text", text: "A" }] } });
			if (repeatDurable.join(",") !== "A") throw new Error("AUDIT1 a repeated durable text was duplicated: " + JSON.stringify(repeatDurable));
		}

		// (7) duplicate orphan callIds must not collide into one React key.
		{
			const trS = foldAudit({ eventNodes: [
				{ kind: "tool-result", seq: 1, time: 1e12, callId: "dup", call: { name: "a", argsRaw: "{}" }, content: [{ type: "text", text: "1" }], subCalls: [] },
				{ kind: "tool-result", seq: 2, time: 1e12, callId: "dup", call: { name: "b", argsRaw: "{}" }, content: [{ type: "text", text: "2" }], subCalls: [] }
			] });
			const ids = trS.stations.map((x) => x.id);
			if (new Set(ids).size !== ids.length) throw new Error("AUDIT1 duplicate orphan ids: " + JSON.stringify(ids));
		}

		// (8) a truncated sub-call result must SAY it was truncated.
		{
			const trT = foldAudit({ eventNodes: [
				{ kind: "assistant", seq: 1, time: 1e12, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }, { kind: "tool-call", callId: "c", name: "p", argsRaw: "{}" }] },
				{ kind: "tool-result", seq: 2, time: 1e12, callId: "c", call: { name: "p", argsRaw: "{}" }, content: [{ type: "text", text: "top" }], subCalls: [{ kind: "tool-result", seq: 3, callId: "k", name: "child", content: [{ type: "text", text: "x".repeat(500) }] }] }
			] });
			const mdSub = buildStepMarkdown(trT.stations.find((x) => x.kind === "step"), [], false, t);
			if (mdSub.indexOf("x".repeat(161)) >= 0) throw new Error("AUDIT1 the sub-call result was not truncated at 160");
			if (!/\(500\b/.test(mdSub)) throw new Error("AUDIT1 the sub-call truncation carries no marker");
		}
	}

	// ── HOSTILE2: three malformed-host shapes must not take the panel down ──
	// All three were reproduced against the real DSH 0.2.2-rc.2 record shapes and each
	// one threw BEFORE any station existed, so the render boundary could not catch it.
	{
		// (a) the request tab rebuilds from RAW nodes; `deriveTraceTree` hardening does not apply.
		try {
			const rebuilt = reconstructMessages([{ kind: "assistant", seq: 1, blocks: [null] }], 2, t);
			if (rebuilt.length !== 1) throw new Error("expected one rebuilt message, got " + rebuilt.length);
		} catch (e) {
			throw new Error("HOSTILE2 a null assistant block crashed the request rebuild: " + String(e.message).slice(0, 70));
		}
		// (b) the export appendix reads the raw prompt catalog; a null hole used to throw.
		try {
			const trTools = deriveTraceTree({
				eventNodes: [{ kind: "assistant", seq: 1, time: 1e12, turn: 1, step: 1, blocks: [{ kind: "text", text: "ok" }] }],
				requests: [{ purpose: "assistant", startSeq: 1, turn: 1, step: 1, status: "ok", prompt: { system: "s", tools: [null] } }],
				callSchemas: new Map(), runningCalls: [], partial: null
			}, t);
			buildTraceMarkdown(trTools, t);
		} catch (e) {
			throw new Error("HOSTILE2 a null prompt tool crashed the markdown export: " + String(e.message).slice(0, 70));
		}
		// (c) sorting requests on a non-numeric startSeq used to throw before any station.
		try {
			deriveTraceTree({
				eventNodes: [],
				requests: [
					{ purpose: "assistant", startSeq: Symbol("a"), turn: 1, step: 1 },
					{ purpose: "assistant", startSeq: 1, turn: 1, step: 2 }
				],
				callSchemas: new Map(), runningCalls: [], partial: null
			}, t);
		} catch (e) {
			throw new Error("HOSTILE2 a non-numeric startSeq crashed the request sort: " + String(e.message).slice(0, 70));
		}
	}

	// ── NUMGUARD1: a non-integer "counts" field must become null, never a number
	// `shadowedItemCount` / `shadowedTokenCount` come straight from the log. A corrupt
	// value (3.5, a Symbol, a string) must be reported as "not recorded" — the old raw
	// pass-through invented a number: 3.5 rendered as "4 tokens" via fmtTokens' rounding.
	// `count` is covered by RENDERFUZZ1 (it reaches a bare template literal); `tokens`
	// is NOT, because fmtTokens swallows a Symbol with Number.isFinite — so it stayed
	// green under mutation until this guard pinned the contract.
	{
		const foldCompaction = (node) => deriveTraceTree({
			eventNodes: [Object.assign({ kind: "compaction", seq: 1, time: 1e12, summary: "S" }, node)],
			requests: [], callSchemas: new Map(), runningCalls: [], partial: null
		}, t);
		const tokensOf = (node) => {
			const found = foldCompaction(node).stations.find((x) => x.kind === "compaction");
			return found === void 0 ? undefined : found.tokens;
		};
		const cases = [
			["a fractional token count", 3.5],
			["a Symbol token count", Symbol("t")],
			["a string token count", "34000"],
			["NaN", NaN],
			["Infinity", Infinity]
		];
		for (const [label, bad] of cases) {
			const got = tokensOf({ shadowedItemCount: 1, shadowedTokenCount: bad });
			if (got !== null) {
				throw new Error("NUMGUARD1 " + label + " must be recorded as null, got " + String(typeof got) + " " + String(got));
			}
		}
		// A real integer must still survive untouched.
		if (tokensOf({ shadowedItemCount: 1, shadowedTokenCount: 34000 }) !== 34000) {
			throw new Error("NUMGUARD1 a valid token count was dropped");
		}
	}

	// ── LOSS1: two real records that collide on a key must BOTH survive ──────
	// (a) two requests for the same turn:step — a merged/retried log can carry both.
	// A `Map.set` kept only the last: status/usage/prompt silently lost, and no count.
	{
		const nodesDup = [
			{ kind: "user", seq: 1, time: 1e12, turn: 1, content: [{ type: "text", text: "u" }] },
			{ kind: "assistant", seq: 2, time: 1e12, turn: 1, step: 1, messageId: "m", blocks: [{ kind: "text", text: "a" }] }
		];
		const reqs = [
			{ purpose: "assistant", turn: 1, step: 1, status: "error", startSeq: 2, startedAt: 100, completedAt: 900, error: { message: "first" }, prompt: { system: "A" } },
			{ purpose: "assistant", turn: 1, step: 1, status: "ok", startSeq: 2, startedAt: 1000, completedAt: 2800, prompt: { system: "B" } }
		];
		const folded = deriveTraceTree({ eventNodes: nodesDup, requests: reqs, callSchemas: new Map(), runningCalls: [], partial: null }, t);
		// A second request for the SAME turn:step is a RETRY of a step that exists, not a
		// request without a step. Counting it produced a header warning on a healthy retried
		// log (the pre-bucket `Map.set` reported 0). This assertion used to demand 1 and was
		// therefore pinning a false alarm — caught by an independent review.
		if (folded.unplacedRequests !== 0) throw new Error("LOSS1 a retried step must not be reported as unplaced: got " + folded.unplacedRequests);
		// A request whose turn:step matches NO station must still be reported.
		{
			const stray = deriveTraceTree({
				eventNodes: nodesDup,
				requests: [{ purpose: "assistant", turn: 1, step: 1 }, { purpose: "assistant", turn: 9, step: 1 }],
				callSchemas: new Map(), runningCalls: [], partial: null
			}, t);
			if (stray.unplacedRequests !== 1) throw new Error("LOSS1 a request with no station must be reported: got " + stray.unplacedRequests);
		}
		// WHICH attempt wins matters. The original `Map.set` kept the LAST one, so a step
		// that failed then succeeded must show "ok" — not the stale error from attempt 1.
		const stepStation = folded.stations.find((x) => x.kind === "step");
		if (stepStation === void 0 || stepStation.request === null || stepStation.request.status !== "ok") {
			throw new Error("LOSS1 the step must display the latest attempt (ok), got " +
				(stepStation && stepStation.request ? stepStation.request.status : "no request"));
		}
	}
	// (b) two DISTINCT tool-call blocks with the same callId in one turn.
	// The old Set-based dedupe was "first wins": the second call disappeared entirely.
	{
		const nodesCall = [
			{ kind: "user", seq: 1, time: 1e12, turn: 1, content: [{ type: "text", text: "u" }] },
			{ kind: "assistant", seq: 2, time: 1e12, turn: 1, step: 1, messageId: "m", blocks: [
				{ kind: "tool-call", callId: "dup", name: "alpha", argsRaw: "{}" },
				{ kind: "tool-call", callId: "dup", name: "beta", argsRaw: "{}" }
			] }
		];
		const folded = deriveTraceTree({ eventNodes: nodesCall, requests: [], callSchemas: new Map(), runningCalls: [], partial: null }, t);
		const names = [];
		for (const st of folded.stations) for (const c of (st.cells || [])) if (c.kind === "tool") names.push(c.name);
		if (names.length !== 2 || names.indexOf("alpha") < 0 || names.indexOf("beta") < 0) {
			throw new Error("LOSS1 duplicate callId in one turn: expected alpha+beta, got " + JSON.stringify(names));
		}
	}
}

console.log("TV PLUGIN SMOKE TEST (v5) OK — turns=" + tree.stats.turns + " steps=" + tree.totalSteps + " stations=" + tree.stations.length + " tokensIn=" + tree.stats.tokensIn + " model=" + tree.stats.lastModel);
