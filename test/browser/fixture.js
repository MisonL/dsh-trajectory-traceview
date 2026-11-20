/* Harness fixture: mount the plugin's real slot component with stub host services.
   Everything below is a stand-in for the host: the component itself is the shipped code. */
(function () {
	var React = require("react");
	var ReactDOM = require("react-dom/client");
	var runtimeErrors = [];
	window.__errors = runtimeErrors;
	window.addEventListener("error", function (e) { runtimeErrors.push(String(e.message)); });
	window.addEventListener("unhandledrejection", function (e) { runtimeErrors.push("unhandled: " + String(e.reason)); });

	/* ---- external store so the component re-renders like it does in the host ---- */
	function makeStore(initial) {
		var s = { value: initial, subs: new Set() };
		s.set = function (next) { s.value = next; s.subs.forEach(function (f) { f(); }); };
		s.hook = function (selector) {
			var st = React.useState(0);
			var force = st[1];
			React.useEffect(function () {
				var fn = function () { force(function (n) { return n + 1; }); };
				s.subs.add(fn);
				return function () { s.subs.delete(fn); };
			}, []);
			return selector === void 0 ? s.value : selector(s.value);
		};
		return s;
	}

	/* ---- session fixture: multi-turn, tools, an error, a compaction, a retry ---- */
	function buildNodes(opts) {
		var o = opts || {};
		var nodes = [];
		var seq = 0;
		var base = Date.UTC(2026, 10, 20, 2, 0, 0);
		nodes.push({ kind: "user", seq: ++seq, time: base, turn: 1, content: [{ type: "text", text: "帮我看看这个报错：TypeError: x is undefined" }] });
		nodes.push({
			kind: "assistant", seq: ++seq, time: base + 800, turn: 1, step: 1, messageId: "m1",
			blocks: [
				{ kind: "reasoning", text: "先复现，再看堆栈。" },
				{ kind: "text", text: "我先列一下目录，确认项目结构。" },
				{ kind: "tool-call", callId: "c1", name: "pwsh", argsRaw: "{\"cmd\":\"Get-ChildItem\"}" }
			]
		});
		nodes.push({ kind: "tool-result", seq: ++seq, time: base + 2600, turn: 1, step: 1, callId: "c1", callTime: base + 900, name: "pwsh", content: [{ type: "text", text: "src/ test/ package.json" }], isError: false });
		nodes.push({
			kind: "assistant", seq: ++seq, time: base + 3200, turn: 1, step: 2, messageId: "m2",
			blocks: [
				{ kind: "text", text: "目录里没有 config.js，所以那条报错来自旧的缓存。" },
				{ kind: "tool-call", callId: "c2", name: "read", argsRaw: "{\"path\":\"src/index.js\"}" }
			]
		});
		nodes.push({ kind: "tool-result", seq: ++seq, time: base + 3400, turn: 1, step: 2, callId: "c2", callTime: base + 3250, name: "read", content: [{ type: "text", text: "export const x = 1;" }], isError: true, error: { name: "ENOENT", message: "no such file" } });
		nodes.push({ kind: "user", seq: ++seq, time: base + 120000, turn: 2, content: [{ type: "text", text: "那就直接改吧" }] });
		nodes.push({
			kind: "assistant", seq: ++seq, time: base + 121000, turn: 2, step: 1, messageId: "m3",
			blocks: [
				{ kind: "reasoning", text: "改之前先备份。" },
				{ kind: "text", text: "好的，我改一下并跑测试。" },
				{ kind: "tool-call", callId: "c3", name: "bash", argsRaw: "{\"cmd\":\"npm test\"}" }
			]
		});
		nodes.push({ kind: "tool-result", seq: ++seq, time: base + 330000, turn: 2, step: 1, callId: "c3", callTime: base + 122000, name: "bash", content: [{ type: "text", text: "128 passing" }], isError: false, subCalls: [{ callId: "s1", name: "jest", argsRaw: "{}" }] });
		nodes.push({ kind: "compaction", seq: ++seq, time: base + 400000, turn: 3, summary: "早期 12 轮对话压缩成摘要：修了 undefined 报错，补了 3 个测试。", shadowedItemCount: 12, shadowedTokenCount: 34000 });
		nodes.push({ kind: "turn-error", seq: ++seq, time: base + 500000, turn: 4, message: "上游返回 429 限流，重试 3 次后放弃", code: "RATE_LIMIT" });
		nodes.push({ kind: "model-retry", seq: ++seq, time: base + 501000, turn: 5, retry: 2, maxRetries: 5, provider: "deepseek", retryState: "waiting", failure: { message: "429 from upstream", code: "429" } });
		nodes.push({ kind: "unknown", seq: ++seq, time: base + 502000, turn: 6, type: "future-event-kind", data: { note: "本版本不认识的事件" } });
		if (o.extraTurns) {
			for (var t = 7; t < 7 + o.extraTurns; t += 1) {
				nodes.push({ kind: "user", seq: ++seq, time: base + 600000 + t * 1000, turn: t, content: [{ type: "text", text: "第 " + t + " 轮问题" }] });
				nodes.push({ kind: "assistant", seq: ++seq, time: base + 600000 + t * 1000 + 500, turn: t, step: 1, messageId: "m" + t, blocks: [{ kind: "text", text: "第 " + t + " 轮回答" }] });
			}
		}
		if (o.streaming) {
			nodes.push({ kind: "user", seq: ++seq, time: base + 900000, turn: 20, content: [{ type: "text", text: "流式输出测试" }] });
		}
		return nodes;
	}

	function buildRequests() {
		return [
			{ purpose: "assistant", turn: 1, step: 1, status: "ok", startSeq: 2, startedAt: 1, completedAt: 901, requestConfig: { model: "deepseek-chat", provider: "deepseek", temperature: 0.3 }, usage: { input: 120, output: 40 }, prompt: { system: "你是助手。\n请遵守规则。", tools: [{ name: "pwsh", description: "run" }] } },
			{ purpose: "assistant", turn: 1, step: 2, status: "error", startSeq: 4, startedAt: 1, completedAt: 400, requestConfig: { model: "deepseek-chat", provider: "deepseek" }, usage: { input: 140, output: 10 }, error: { name: "ENOENT", message: "no such file" }, prompt: { system: "你是助手。\n请遵守规则。\n新增一条。", tools: [{ name: "pwsh", description: "run" }, { name: "read", description: "read" }] } },
			{ purpose: "assistant", turn: 2, step: 1, status: "ok", startSeq: 7, startedAt: 1, completedAt: 500, requestConfig: { model: "deepseek-chat", provider: "deepseek", reasoningEffort: "high" }, usage: { input: 300, output: 90 }, prompt: { system: "你是助手。", tools: [] } }
		];
	}

	var store = makeStore({ eventNodes: buildNodes({ extraTurns: 3 }), requests: buildRequests(), callSchemas: {}, runningCalls: [], partial: null });
	var sessionStore = makeStore({ openState: "open", hasMore: true, historyLoadStatus: "idle", loadingOlder: false });
	window.__store = store;
	window.__sessionStore = sessionStore;

	var host = {
		localeDicts: {},
		register: function (ns, dicts) { host.localeDicts[ns] = dicts; },
		bind: function (ns) {
			return function (key, vars) {
				var d = host.localeDicts[ns] || {};
				var s = (d.zh && d.zh[key] !== void 0) ? d.zh[key] : key;
				if (vars) { for (var k in vars) s = s.split("{" + k + "}").join(String(vars[k])); }
				return s;
			};
		}
	};
	var captured = null;
	var ctx = {
		effect: function (fn) { fn(); },
		locale: host,
		sessions: { binding: function () { return { session: { getSnapshot: function () { return sessionStore.value; }, loadOlder: function () { return Promise.resolve(); } } }; } },
		slots: {
			inject: function (name, fn) { if (fn) fn(); },
			register: function (spec, Component) { captured = { spec: spec, Component: Component }; return {}; }
		}
	};
	window.__plugin.apply(ctx);
	if (captured === null) throw new Error("fixture: the plugin did not register a view");

	var extra = captured.spec.inject("session-1");
	var seat = document.getElementById("seat");
	var root = ReactDOM.createRoot(seat);
	var viewProps = {
		useSession: sessionStore.hook,
		useTrajectory: store.hook,
		t: host.bind("trajectoryTraceView"),
		viewRequest: null,
		completeViewRequest: function () {},
		loadOlder: extra.loadOlder,
		sessionKey: extra.sessionKey
	};
	if (new URLSearchParams(location.search).get("layout") === "free") document.documentElement.setAttribute("data-layout", "free");
	window.__render = function (overrides) {
		var p = Object.assign({}, viewProps, overrides || {});
		root.render(React.createElement(captured.Component, p));
	};
	window.__render();

	/* ---- helpers the tests drive from outside ---- */
	/** Host theme switch, on the SAME element the host uses (<body>). */
	window.__setTheme = function (dark) {
		if (dark === true) document.body.setAttribute("data-ds-dark-theme", "true");
		else document.body.removeAttribute("data-ds-dark-theme");
		return document.body.hasAttribute("data-ds-dark-theme");
	};
	window.__h = {
		setNodes: function (nodes) { store.set(Object.assign({}, store.value, { eventNodes: nodes })); },
		setSnap: function (patch) { store.set(Object.assign({}, store.value, patch)); },
		setPartial: function (partial) { store.set(Object.assign({}, store.value, { partial: partial })); },
		setSession: function (patch) { sessionStore.set(Object.assign({}, sessionStore.value, patch)); },
		nodes: function () { return store.value.eventNodes; },
		errors: function () { return runtimeErrors.slice(); },
		ready: true
	};
})();
