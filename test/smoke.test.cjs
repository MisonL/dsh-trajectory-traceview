// Smoke test for dsh-trajectory-traceview (v5): extract the pure helpers
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
;(globalThis.__test = { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown, promptDiffOf, subDetailOf });
`;

const sandbox = { console, JSON, Set, Map, Math, String, Object, Array, Number };
vm.runInNewContext(extracted, sandbox, { filename: "traceview-helpers.js", timeout: 10000 });
const { deriveTraceTree, reconstructMessages, matchStations, buildTraceMarkdown } = sandbox.__test;

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

console.log("TV PLUGIN SMOKE TEST (v5) OK — turns=" + tree.stats.turns + " steps=" + tree.totalSteps + " stations=" + tree.stations.length + " tokensIn=" + tree.stats.tokensIn + " model=" + tree.stats.lastModel);
