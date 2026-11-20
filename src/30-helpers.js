		//#region pure helpers: snapshot -> timeline tree
		/** Nested programmatic tool calls deeper than this are dropped (cycle guard). */
		const SUB_CALL_MAX_DEPTH = 8;
		/**
		 * Total materialised sub-call budget per tool cell. The depth cap alone does not
		 * bound work: a wide tree hits breadth^depth, and 5 siblings x 9 levels produced
		 * 2.4 million copied nodes (12.7 s) from a payload that was already in memory.
		 * Once the budget is spent the remaining children are dropped rather than paying
		 * an unbounded copy cost.
		 */
		const SUB_CALL_MAX_TOTAL = 2000;
		/**
		 * `title` tooltips must not carry a whole argument payload. The visible text was
		 * already clipped to 64 chars, but the title held the FULL string, so a session
		 * with 480 long-payload calls pushed 14.6 MB of markup (207 KB of it title text).
		 */
		const TITLE_PREVIEW_CHARS = 200;
		/**
		 * Upper bound for a believable single tool duration. Long-running commands exist,
		 * but once a reading crosses a day it is a timestamp artefact (reload gap, missing
		 * `callTime`), not a real measurement, and it must not enter any total.
		 */
		const TOOL_DUR_CEILING_MS = 6 * 60 * 60 * 1000;
		/** First non-empty line of a possibly-Markdown string. */
		function firstLine(value) {
			if (typeof value !== "string") return "";
			for (const raw of value.split(/\r?\n/)) {
				const line = raw.trim();
				if (line !== "") return line;
			}
			return "";
		}

		/**
		 * Coerce a projected field to a string at the SOURCE, not at every render site.
		 *
		 * The host contracts type these fields as `string` (`TurnErrorNode.message`,
		 * `CommandNode.args`, compaction summary), so a non-string is already a contract
		 * violation — but "already a violation" is not the same as "cannot happen", and
		 * this plugin's rule is that one bad field degrades ITS OWN record, never the
		 * panel. React throws `Objects are not valid as a React child` for an object, so a
		 * single drifted field blanked the whole card (and, outside the boundary, the
		 * whole view) instead of printing something.
		 *
		 * Objects fall back to their JSON so the reader can still see what arrived; that
		 * is strictly more useful than "[object Object]" and it never throws.
		 */
		function asText(value) {
			if (typeof value === "string") return value;
			if (value === null || value === void 0) return "";
			// A non-finite number is not a value the log provided; `String(NaN)` would put
			// the literal token "NaN" into the panel and the export.
			if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
			if (typeof value === "boolean") return String(value);
			try { return safeJsonPreview(value, 2000); } catch (e) { return ""; }
		}
		/**
		 * Normalise a prompt's tool catalog for rendering.
		 *
		 * `prompt.tools` reaches the request tab straight from the host and is only
		 * checked for being an array (the fold replaces a non-array with `[]`); the
		 * ENTRIES were trusted. One `null` entry threw
		 * `Cannot read properties of null (reading 'name')` during render and blanked
		 * the whole request tab — every other tool in the catalog disappeared because
		 * of one hole in the list. Drop holes, coerce the three fields we print, and
		 * keep the order so the catalog still reads like the real one.
		 */
		function safeToolList(tools) {
			if (!Array.isArray(tools)) return [];
			const out = [];
			for (const raw of tools) {
				if (raw === null || typeof raw !== "object") continue;
				out.push({
					name: asText(raw.name),
					description: asText(raw.description),
					parameters: raw.parameters
				});
			}
			return out;
		}
		/** First text block of a ContentBlock list (full text). */
		function textOfContent(content, t) {
			// `for…of` on a non-array throws, and a host payload with a wrong-shaped
			// `content` (e.g. an object) crashed the whole view. `blocksText` already
			// guards this way; the two helpers must agree on tolerating bad input.
			if (!Array.isArray(content)) return "";
			// ContentBlock is merge-extensible and the host ships seven types. Returning
			// only the first text block dropped every other kind, so a user message that
			// was a file or an image rendered as empty. Join all readable parts and label
			// the ones that have no text, mirroring blocksText.
			const parts = [];
			for (const b of content) {
				if (b == null || typeof b !== "object") continue;
				if (b.type === "text" && typeof b.text === "string" && b.text !== "") { parts.push(b.text); continue; }
				if (b.type === "image") { parts.push(typeof t === "function" ? t("block.image") : "image"); continue; }
				if (b.type === "file") {
					const name = typeof b.attachment?.name === "string" && b.attachment.name !== "" ? b.attachment.name : null;
					const label = typeof t === "function" ? t("block.file") : "file";
					parts.push(name !== null ? `${label}: ${name}` : label);
					continue;
				}
				// Tool-set changes are a defined ContentBlock type, not unknown payload:
				// rendering them as "other content · tool-addition" threw away the tool
				// NAME, which is the only thing the notice is about. The official layout
				// spells it out the same way.
				if (b.type === "tool-addition" || b.type === "tool-removal") {
					const name = typeof b.toolName === "string" && b.toolName !== "" ? b.toolName : null;
					// A nameless entry still has to say SOMETHING: dropping it made a
					// tool-set change render as an empty row. Degrade to the generic tag.
					if (name !== null) {
						const key = b.type === "tool-addition" ? "block.toolAdded" : "block.toolRemoved";
						const fallback = b.type === "tool-addition" ? "[tool added] " : "[tool removed] ";
						parts.push(typeof t === "function" ? t(key).replace("{name}", name) : fallback + name);
					} else {
						const label = typeof t === "function" ? t("block.other") : "other";
						parts.push(`${label} · ${b.type}`);
					}
					continue;
				}
				// Unknown/plugin-added blocks degrade to their type tag instead of vanishing.
				if (typeof b.type === "string" && b.type !== "") {
					const label = typeof t === "function" ? t("block.other") : "other";
					parts.push(`${label} · ${b.type}`);
				}
			}
			return parts.join("\n");
		}
		/** Join every text block; images become a visible placeholder. */
		function blocksText(content, t) {
			if (!Array.isArray(content)) return "";
			const parts = [];
			for (const b of content) {
				if (b == null) continue;
				if (b.type === "text" && typeof b.text === "string") { if (b.text !== "") parts.push(b.text); }
				// The image placeholder is user-visible: hardcoding Chinese leaked it into
				// the English UI. Fall back to English only when no translator is passed, so
				// pure-function callers stay valid.
				else if (b.type === "image") parts.push(typeof t === "function" ? t("block.image") : "image");
				else if (b.type === "reasoning" && typeof b.text === "string" && b.text !== "") parts.push(b.text);
				// A tool that attaches a file (a reader, an exporter) produced an EMPTY
				// result cell: `file` was not handled here at all, so the card showed
				// nothing for a result that plainly existed. The attachment name is the
				// only usable identifier, so show it when present.
				else if (b.type === "file") {
					const fname = typeof b.attachment?.name === "string" && b.attachment.name !== "" ? b.attachment.name : null;
					const flabel = typeof t === "function" ? t("block.file") : "file";
					parts.push(fname !== null ? `${flabel}: ${fname}` : flabel);
				}
			}
			return parts.join("\n");
		}
		/** Display name for one sub-call entry (settled or running shape). */
		function subName(sub) {
			if (sub == null) return "?";
			const fromCall = sub.call?.name;
			if (typeof fromCall === "string" && fromCall !== "") return fromCall;
			if (typeof sub.name === "string" && sub.name !== "") return sub.name;
			return typeof sub.callId === "string" ? sub.callId : "?";
		}
		/** Millisecond duration label, e.g. `1,500 ms`. */
		function fmtMs(ms) {
			if (ms == null || !Number.isFinite(ms)) return "";
			return `${String(Math.round(ms)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ms`;
		}
		/**
		 * Human duration for KPI tiles. A long session's total tool time runs into
		 * minutes/hours, and "3600.0 s" is unreadable, so scale the unit with the value.
		 */
		function fmtDur(ms) {
			if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
			if (ms < 1000) return `${String(Math.round(ms))} ms`;
			// Round first, then choose the unit: otherwise 59,960 ms formats as "60.0 s"
			// (a value that reads as one minute but carries a seconds label), and 3,599,999
			// ms as "60 min" instead of "1.0 h".
			const s = Math.round(ms / 100) / 10;
			if (s < 60) return `${s.toFixed(1)} s`;
			const m = Math.round(ms / 6000) / 10;
			if (m < 60) return `${m.toFixed(m < 10 ? 1 : 0)} min`;
			return `${(Math.round(ms / 36000) / 100).toFixed(1)} h`;
		}
		/** Compact integer with thousands separators. */
		function fmtInt(n) {
			if (n == null || !Number.isFinite(n)) return "0";
			return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}
		/** Compact token count: `1.2k` / `34.5k` / `1.2M`. */
		function fmtTokens(n) {
			if (n == null || !Number.isFinite(n) || n <= 0) return "—";
			if (n < 1000) return String(Math.round(n));
			// Same rule as the M tier below: round to the target precision FIRST, then pick
			// the unit. `999,999` rounds to 1000, and printing "1000k" is a four-digit
			// mantissa that should have carried into "1.0M".
			if (n < 999.5e3) {
				const k = n / 1000;
				return `${n < 9950 ? k.toFixed(1) : String(Math.round(k))}k`;
			}
			if (n < 1e6) return `${(n / 1e6).toFixed(1)}M`;
			// Round to one decimal BEFORE choosing the unit, so 999,999,999 becomes
			// "1.0B" rather than "1000.0M" (a four-digit mantissa that reads as an error).
			if (n < 999.95e6) return `${(n / 1e6).toFixed(1)}M`;
			// Long sessions really do cross a billion cumulative input tokens (a 4-turn
			// run here measured 16.3e9). Without the B step that printed "16300.0M",
			// which is both wrong-looking and 5 characters wider than the KPI allows.
			return `${(n / 1e9).toFixed(1)}B`;
		}
		/** Pretty-print raw tool arguments: JSON when parseable, else trimmed source. */
		function prettyArgs(raw) {
			if (typeof raw !== "string" || raw.trim() === "") return "";
			try {
				const obj = JSON.parse(raw);
				if (obj && typeof obj === "object") return JSON.stringify(obj, null, 2);
			} catch { /* not JSON — fall through */ }
			return raw.length > 1200 ? `${raw.slice(0, 1200)}…` : raw;
		}
		/** Pretty-print an arbitrary object as JSON. */
		function prettyJson(obj) {
			try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
		}
		/** Normalize a TokenUsage payload to a flat record (null-safe). */
		function normalizeUsage(u) {
			if (u == null || typeof u !== "object") return null;
			const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
			return {
				input: num(u.inputTokens) + num(u.cacheReadTokens) + num(u.cacheWriteTokens),
				output: num(u.outputTokens) + num(u.reasoningTokens),
				raw: num(u.inputTokens),
				cacheRead: num(u.cacheReadTokens),
				cacheWrite: num(u.cacheWriteTokens),
				think: num(u.reasoningTokens)
			};
		}
		/**
		 * Highest turn number among the folded turns (0 when nothing has been folded).
		 *
		 * A loop, never `Math.max(...turns.map(...))`: spreading one argument per turn
		 * throws "Maximum call stack size exceeded" once a session is large enough
		 * (measured at ~125k turns — and the fold dies with it, taking the whole view
		 * down). A malformed or merged log can reach that size even though no real
		 * interactive session does.
		 */
		function maxTurnOf(turns) {
			let max = 0;
			if (!Array.isArray(turns)) return max;
			for (const e of turns) {
				if (e == null) continue;
				const n = e.turn;
				if (typeof n === "number" && Number.isFinite(n) && n > max) max = n;
			}
			return max;
		}
		/** Fresh mutable per-step accumulator used while folding assistant nodes. */
		function newStepState(seq) {
			return {
				seq, time: null, cells: [], live: false, request: null,
				// T5: distinguishes "no timing object at all" from "timing recorded, but
				// the edge fell outside the loaded window". Collapsing both into a bare
				// null makes "no duration" ambiguous; official keeps `timingRecorded`
				// for exactly this reason (trajectory-record.d.ts:10).
				timingRecorded: false,
				// Anchor identity, written ONLY at the durable patch site below.
				// Never derived from `seq` (which is min-reduced and also carries
				// epoch-ms / +0.5 synthetic values). null => not deep-linkable.
				anchorSeq: null,
				ttftMs: null, startMs: null, endMs: null, firstTokMs: null, toolMs: 0, toolCount: 0,
				hasError: false, interrupted: false, usage: null, modelHint: null
			};
		}
		/**
		 * Map a LIST of sub-calls with ONE shared budget. Calling `subDetailOf(x, 0)` per
		 * root created a fresh budget for each, so five roots copied 7,775 nodes even
		 * though the cap was 2,000. The cap is per tool cell, not per root.
		 */
		function mapSubCalls(list, tr) {
			if (!Array.isArray(list)) return [];
			const budget = { used: 0 };
			const out = [];
			for (const sub of list) {
				if (budget.used >= SUB_CALL_MAX_TOTAL) break;
				out.push(subDetailOf(sub, 0, budget, tr));
			}
			return out;
		}
		/** Map one sub-call entry (settled ToolResultNode or running shape) to full detail. */
		function subDetailOf(sub, depth, budget, tr) {
			const level = Number.isSafeInteger(depth) ? depth : 0;
			// Shared budget across the whole tree, not per level. `budget` is threaded
			// explicitly so a call can never reset the counter by recursing.
			const spent = budget ?? { used: 0 };
			spent.used += 1;
			if (sub == null) return { name: "?", callId: null, argsRaw: "", resultText: "", isError: false, errorName: undefined, running: false, durationMs: null, subCalls: [] };
			const settled = sub.kind === "tool-result";
			const argsRaw = typeof sub.argsRaw === "string" ? sub.argsRaw : (typeof sub.call?.argsRaw === "string" ? sub.call.argsRaw : "");
			const durationMs = settled && Number.isFinite(sub.callTime) && Number.isFinite(sub.time) ? Math.max(0, sub.time - sub.callTime) : null;
			return {
				name: subName(sub),
				callId: typeof sub.callId === "string" ? sub.callId : null,
				argsRaw,
				resultText: settled ? blocksText(sub.content, tr) : "",
				isError: settled && sub.isError === true,
				errorName: settled ? sub.error?.name : undefined,
				running: !settled,
				durationMs,
				// Programmatic tool calling nests: a sub call can itself make sub calls.
				// Flattening only one level dropped every deeper call, so the detail panel
				// and the Markdown export lost evidence that exists in the log. The depth
				// cap keeps a malformed/cyclic payload from recursing forever.
				subCalls: (level < SUB_CALL_MAX_DEPTH && spent.used < SUB_CALL_MAX_TOTAL && Array.isArray(sub.subCalls))
					? sub.subCalls.map((x) => (spent.used < SUB_CALL_MAX_TOTAL ? subDetailOf(x, level + 1, spent, tr) : null)).filter((x) => x !== null)
					: []
			};
		}
		/** Compact prompt-change summary: tool names added/removed + system char delta. */
		function promptDiffOf(change, curPrompt) {
			if (change == null) return null;
			const kind = typeof change.kind === "string" ? change.kind : "system-and-tools";
			const prev = change.previous ?? null;
			const curTools = Array.isArray(curPrompt?.tools) ? curPrompt.tools : [];
			const curNames = new Set(curTools.map((tool) => tool?.name).filter((n) => typeof n === "string"));
			const prevNames = new Set((Array.isArray(prev?.tools) ? prev.tools : []).map((tool) => tool?.name).filter((n) => typeof n === "string"));
			const toolsAdded = [...curNames].filter((n) => !prevNames.has(n));
			const toolsRemoved = [...prevNames].filter((n) => !curNames.has(n));
			const curSystemChars = typeof curPrompt?.system === "string" ? curPrompt.system.length : 0;
			const prevSystemChars = typeof prev?.system === "string" ? prev.system.length : 0;
			// Q2-1: name-level add/remove is not enough — a rewritten tool description or
			// schema changes model behaviour without changing the catalog names.
			const toolsChanged = prev === null ? [] : changedTools(prev?.tools, curPrompt?.tools);
			const textDiff = prev === null ? null : promptTextDiff(prev?.system, curPrompt?.system, PROMPT_DIFF_LINES);
			return {
				kind, toolsAdded, toolsRemoved, toolsChanged,
				prevSystemChars, curSystemChars, systemDelta: curSystemChars - prevSystemChars,
				textDiff, isInitial: prev === null
			};
		}
		/** Cap for one tool result inside a single-step review pack. */
		const STEP_RESULT_LIMIT = 4000;
		/** Cap for the recorded payload of one `unknown` surface node. */
		const UNKNOWN_PAYLOAD_LIMIT = 2000;
		/**
		 * Minimum gap between projection rebuilds while a step is streaming.
		 * The trajectory snapshot changes on every streamed token, and folding the
		 * whole session costs ~40 ms at 3,200 stations (~90 ms at 6,400). Rebuilding
		 * per token therefore stalls the main thread continuously for no visible
		 * gain: 120 ms of staleness is imperceptible, while 8 rebuilds/second instead
		 * of ~30 leaves the frame budget intact. Idle sessions never rebuild at all.
		 */
		const STREAM_REBUILD_MS = 120;
		/**
		 * Best-effort JSON preview of an opaque payload. Values reaching here are
		 * documented as `session.data` (plain JSON), but a truncated or exotic event
		 * could still carry a cycle or a BigInt, and a review view must not throw on
		 * the one node whose whole purpose is "the reader should see this".
		 * @param value - whatever the event carried.
		 * @param limit - maximum characters to keep.
		 * @returns a printable string, never throwing.
		 */
		/**
		 * Render a log-supplied integer for display.
		 *
		 * `String(n.turn)` on a NaN/Infinity/object field printed "轮次 NaN" and
		 * "[object Object]" straight into the panel and the export. A number the log does
		 * not actually provide must read as unknown, not as a bogus value.
		 */
		function numOr(v, fallback) {
			return Number.isSafeInteger(v) ? String(v) : (fallback === void 0 ? "?" : fallback);
		}
		/** A readable stand-in for a value JSON refuses to serialise. */
		function describeUnrepresentable(value) {
			if (value === void 0) return "";
			if (typeof value === "symbol") { try { return String(value); } catch { return "[symbol]"; } }
			if (typeof value === "function") return "[function]";
			return `[${typeof value}]`;
		}
		function safeJsonPreview(value, limit, indent) {
			let text = "";
			// "Nothing recorded" must render as nothing. `JSON.stringify(null)` is the string
			// "null", so an unknown event with no payload showed the literal word "null" in
			// the panel — the same confusion the "undefined" case had. Callers already test
			// for `""`, so returning "" keeps the empty branch working.
			if (value === null || value === void 0) return "";
			// `JSON.stringify(NaN)` and of `Infinity` are both the string "null", so a
			// non-finite number payload rendered the literal word "null" too.
			if (typeof value === "number" && !Number.isFinite(value)) return "";
			if (typeof value === "string") text = value;
			else {
				// `indent` is only for the request tab, which shows the payload pretty-printed.
				const pad = Number.isSafeInteger(indent) && indent > 0 ? indent : void 0;
				// Fast path FIRST. The guarded replacer below keeps a global `seen` set, so it
				// labels any object that appears twice — including a perfectly ordinary alias
				// (`[x, x]`, or one schema object reused by two tools) — as "[Circular]".
				// Plain stringify handles aliases correctly and only fails on a real cycle or
				// a BigInt, so trying it first means the marked-up output is reserved for the
				// cases that actually need it.
				try {
					text = JSON.stringify(value, null, pad);
					// JSON.stringify returns `undefined` (not a string) for a value it cannot
					// represent — a bare Symbol, a function, or `undefined` itself. The old
					// `String(text)` then made the panel print the literal word "undefined",
					// which reads like a bug in the viewer rather than "this payload is not
					// representable". Say what it actually is.
					if (typeof text !== "string") text = describeUnrepresentable(value);
				} catch (plain) {
					try {
						// ANCESTRY, not "seen anywhere". A WeakSet that is never cleared marks
						// any value met twice, so one BigInt or one real cycle anywhere in the
						// payload turned every ordinary alias (`{a: shared, b: shared}`, two
						// tools sharing one schema object) into "[Circular]" — silently hiding
						// content that is perfectly representable. `[Circular]` must mean "this
						// object is its own ANCESTOR", so the check walks the holder chain that
						// the replacer's `this` already gives us: record which object contains
						// which, then ask whether the current container descends from the value.
						// (A push/pop stack cannot work here: the replacer is never told when it
						// leaves a value, so nothing would ever pop.)
						const parents = new WeakMap();
						text = JSON.stringify(value, function (k, v) {
							if (typeof v === "bigint") return `${String(v)}n`;
							if (v !== null && typeof v === "object") {
								for (let h = this; h !== null && typeof h === "object"; h = parents.get(h)) {
									if (h === v) return "[Circular]";
								}
								parents.set(v, this);
							}
							return v;
						}, pad);
						if (typeof text !== "string") text = describeUnrepresentable(value);
					} catch (e) {
						try { text = String(value); } catch (e2) { text = ""; }
					}
				}
			}
			const cap = Number.isFinite(limit) ? limit : UNKNOWN_PAYLOAD_LIMIT;
			return text.length > cap ? `${text.slice(0, cap)}…` : text;
		}
		/** How many changed prompt lines to keep per side in the diff view. */
		const PROMPT_DIFF_LINES = 40;
		/**
		 * Q2-2: which parts of this panel are verbatim and which are inferred.
		 * The message list is rebuilt from the log, the prompt header is recorded, and
		 * anything touching unloaded history is partial. Users must not confuse the
		 * reconstruction for the exact payload the server saw.
		 */
		function evidenceOf(request, messages, hasMore) {
			const out = [];
			if (request != null && request.prompt != null) out.push({ id: "prompt", level: "exact" });
			if (Array.isArray(messages) && messages.length > 0) out.push({ id: "messages", level: "reconstructed" });
			if (hasMore === true) out.push({ id: "range", level: "partial" });
			return out;
		}
		/**
		 * Q2-1: the summary above only says "system prompt changed by N chars". A prompt
		 * author needs the actual changed lines. Pure: no DOM, no I/O.
		 * Returns the first `limit` changed lines per side, as {removed, added, narrows}.
		 */
		function promptTextDiff(prevText, curText, limit) {
			const cap = Number.isSafeInteger(limit) && limit > 0 ? limit : 40;
			const split = (v) => (typeof v === "string" && v !== "" ? v.split(/\r?\n/) : []);
			const a = split(prevText);
			const b = split(curText);
			if (a.length === 0 && b.length === 0) return null;
			// Trim the common prefix and suffix so a one-line edit in a 3k-line prompt
			// does not show up as "everything changed".
			let head = 0;
			while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
			let tail = 0;
			while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
			const removedAll = a.slice(head, a.length - tail);
			const addedAll = b.slice(head, b.length - tail);
			if (removedAll.length === 0 && addedAll.length === 0) return null;
			return {
				removed: removedAll.slice(0, cap),
				added: addedAll.slice(0, cap),
				// true when the diff was truncated (more lines exist than we show)
				narrows: removedAll.length > cap || addedAll.length > cap,
				removedCount: removedAll.length,
				addedCount: addedAll.length,
				startLine: head + 1
			};
		}
		/** Serialize one tool schema so a changed schema compares by content, not only by name. */
		function toolSchemaKey(tool) {
			if (tool == null || typeof tool !== "object") return "";
			const name = typeof tool.name === "string" ? tool.name : "";
			let body = "";
			try { body = JSON.stringify(tool.inputSchema ?? tool.schema ?? tool.parameters ?? null); } catch { body = ""; }
			return `${name}\u0000${typeof tool.description === "string" ? tool.description : ""}\u0000${body}`;
		}
		/** Tool catalogs that share a name but differ in description/schema. */
		function changedTools(prevTools, curTools) {
			const prev = Array.isArray(prevTools) ? prevTools : [];
			const cur = Array.isArray(curTools) ? curTools : [];
			const prevBy = new Map();
			for (const tool of prev) { const k = toolSchemaKey(tool); const name = k.split("\u0000")[0]; if (name !== "") prevBy.set(name, k); }
			const out = [];
			for (const tool of cur) {
				const k = toolSchemaKey(tool);
				const name = k.split("\u0000")[0];
				if (name === "") continue;
				const was = prevBy.get(name);
				if (was !== void 0 && was !== k) out.push(name);
			}
			return out;
		}
		/** Decode throughput (tokens/sec) from usage + timing; null when unknown. */
		function decodeRateOf(usage, firstTokenTime, completedTime) {
			if (usage == null || !(usage.output > 0)) return null;
			if (!Number.isFinite(firstTokenTime) || !Number.isFinite(completedTime)) return null;
			const ms = completedTime - firstTokenTime;
			if (!(ms > 300)) return null; // too short to be meaningful
			return usage.output / (ms / 1000);
		}
		/** Reconstruct the model-visible message list sent before seq `beforeSeq`. */
		function reconstructMessages(nodes, beforeSeq, tr) {
			const out = [];
			// `seq` rides along as the message's IDENTITY. The request tab keys its rows on
			// the array index, and this list is rebuilt whenever the station window grows
			// backwards — paging in older history PREPENDS messages, so index 3 stops being
			// the message it was. With index keys React reuses the DOM node and an expanded
			// `<details>` ends up showing a different message's body, while the collapsed one
			// below it silently expands.
			for (const n of nodes) {
				// `continue`, not `break`. This used to stop at the FIRST node whose seq was
				// past the step, which silently depended on `nodes` being sorted ascending.
				// The only caller passes the already-sorted `tree.nodes`, so it worked — but
				// any caller handing in a raw or re-ordered log got an EMPTY list with no
				// error (measured: [seq5, seq1, seq3] with beforeSeq=4 returned nothing).
				// Filtering costs one extra number comparison per node and removes the
				// hidden precondition.
				if (beforeSeq != null && n.seq != null && n.seq >= beforeSeq) continue;
				if (n.kind === "user" || n.kind === "steering" || n.kind === "context") {
					out.push({ role: "user", seq: n.seq ?? null, content: n.content ?? [], text: blocksText(n.content, tr) });
				} else if (n.kind === "assistant") {
					// `deriveTraceTree` hardens `blocks` on its own, but the request tab rebuilds
					// from the RAW node. A single `null` block made this map read `.kind` off
					// null and took the whole panel down (measured: TypeError inside the render
					// boundary's sibling `useMemo`, so the boundary never caught it).
					const rawBlocks = Array.isArray(n.blocks) ? n.blocks : [];
					const blocks = rawBlocks.filter((b) => b != null && typeof b === "object");
					const content = blocks.map((b) => {
						if (b.kind === "tool-call") return { type: "tool-call", id: b.callId, name: b.name, arguments: b.argsRaw };
						if (b.kind === "reasoning") return { type: "reasoning", text: b.text };
						if (b.kind === "text") return { type: "text", text: b.text };
						if (b.kind === "image") return { type: "image", attachment: b.attachment };
						return { type: "other", data: b.block };
					});
					const text = blocks.map((b) => (b.kind === "text" ? b.text : b.kind === "reasoning" ? b.text : "")).join("\n").trim();
					out.push({ role: "assistant", seq: n.seq ?? null, content, text });
				} else if (n.kind === "tool-result") {
					out.push({ role: "tool", seq: n.seq ?? null, content: n.content ?? [], toolCallId: n.callId, isError: n.isError === true, text: blocksText(n.content, tr) });
				} else if (n.kind === "compaction") {
					const head = firstLine(n.summary ?? "");
					const cpt = typeof tr === "function" ? tr : (k) => k;
					// The decorative CJK brackets were hardcoded too; move them into the locale so
					// the English UI gets parentheses instead.
					out.push({ role: "note", seq: n.seq ?? null, content: [], text: `${cpt("note.wrapL")}${cpt("note.compaction")}${head !== "" ? head : cpt("note.compacted")}${cpt("note.wrapM")}${cpt("note.replace")} ${n.shadowedItemCount ?? "?"} ${cpt("note.items")} / ${cpt("note.about")} ${fmtTokens(n.shadowedTokenCount)} tokens${cpt("note.wrapR")}` });
				}
			}
			return out;
		}
		// ── Stable anchors (G2) ──────────────────────────────────────────────
		// Grammar (see docs/DESIGN.md §4.1):
		//   tvp1:e<seq>                  durable record, seq must be an integer
		//   tvp1:e<seq>#t3s7             same + human hint (parsing uses `e`)
		//   tvp1:c<callId>               tool result alias, resolves to its seq
		//   tvp1:p<turn>s<step>          synthetic step (not deep-linkable)
		//   tvp1:p<turn>s<step>c<callId> synthetic tool result (disambiguates)
		//   tvp1:t<turn>s<step>          readable alias, resolved via the index
		const ANCHOR_PREFIX = "tvp1:";
		/** Build the canonical anchor string for a station (or null when it has none). */
		function anchorOf(station) {
			if (station == null) return null;
			if (typeof station.anchorKey === "string" && station.anchorKey !== "") return `${ANCHOR_PREFIX}${station.anchorKey}`;
			if (station.kind === "step") {
				const turn = Number.isFinite(station.turn) ? station.turn : 0;
				// Must match how `p<turn>s<step>` is RESOLVED, which uses `turnStep`
				// (per-turn) and only falls back to the window-wide `stepNo`. Writing
				// `stepNo` here made every synthetic step — the live/streaming one has no
				// anchorSeq at all — hand out an anchor that could not be pasted back:
				// copy on turn 2's live step produced `tvp1:p2s3`, which resolved to
				// "not loaded" because turn 2's first step is `turnStep` 1, not 3.
				const step = Number.isFinite(station.turnStep) ? station.turnStep : station.stepNo;
				return `${ANCHOR_PREFIX}p${turn}s${step}`;
			}
			return null;
		}
		/**
		 * Does this station's own anchor resolve back to THIS station?
		 *
		 * `e<seq>` identifies a SEQ, and one seq can carry several stations: a `turn-error`
		 * is stamped with the turn's end seq, which can equal the assistant message's seq,
		 * and a malformed log can repeat a seq outright. The resolver deliberately prefers
		 * a step (that is what anchors are normally copied from), so an error card offered
		 * a "copy anchor" button that, pasted back, jumped to the STEP instead — the user
		 * copied identity A and landed on record B.
		 *
		 * Callers use this to avoid handing out an anchor that does not come back.
		 */
		function anchorResolvesToSelf(station, stations) {
			if (station == null || !Array.isArray(stations)) return false;
			const a = anchorOf(station);
			if (a === null) return false;
			const back = resolveAnchorInStations(parseAnchor(a), stations);
			return back.ok === true && back.station != null && back.station.id === station.id;
		}
		/**
		 * Parse an anchor string. Pure: returns a discriminated result, never throws.
		 * Forms follow the grammar above; every legal form has a branch.
		 */
		function parseAnchor(raw) {
			if (typeof raw !== "string") return { ok: false, reason: "invalid" };
			let body = raw.trim();
			if (body.startsWith("#")) body = body.slice(1);
			const hash = body.indexOf("#");
			const hint = hash >= 0 ? body.slice(hash + 1) : null;
			if (hash >= 0) body = body.slice(0, hash);
			if (!body.startsWith(ANCHOR_PREFIX)) return { ok: false, reason: "invalid", hint };
			const tail = body.slice(ANCHOR_PREFIX.length);
			// e<seq>
			const e = /^e(\d+(?:\.\d+)?)$/.exec(tail);
			if (e !== null) {
				const n = Number(e[1]);
				if (!Number.isSafeInteger(n) || n < 0) return { ok: false, reason: "synthetic", hint };
				return { ok: true, form: "e", seq: n, hint };
			}
			// Turns and steps are 1-based everywhere in the projection, so `t0` / `s0`
			// cannot name any record. Accepting them looked harmless — resolution said
			// "not-loaded" — but that answer makes the view PAGE FOR OLDER HISTORY
			// (up to 40 round trips) chasing a record that can never arrive, and then
			// reports "只有前 40 页" instead of "this anchor is malformed". Long digit
			// runs overflowed to Infinity with the same effect. `e<seq>` already guarded
			// with `Number.isSafeInteger`; these two branches did not.
			const posInt = (v) => {
				const n = Number(v);
				return Number.isSafeInteger(n) && n >= 1 ? n : null;
			};
			// p<turn>s<step>[c<callId>]
			const p = /^p(\d+)s(\d+)(?:c(.+))?$/.exec(tail);
			if (p !== null) {
				const turn = posInt(p[1]);
				const step = posInt(p[2]);
				if (turn === null || step === null) return { ok: false, reason: "invalid", hint };
				return {
					ok: true, form: "p",
					turn, step,
					callId: p[3] === void 0 ? null : p[3],
					hint
				};
			}
			// t<turn>s<step>
			const tt = /^t(\d+)s(\d+)$/.exec(tail);
			if (tt !== null) {
				const turn = posInt(tt[1]);
				const step = posInt(tt[2]);
				if (turn === null || step === null) return { ok: false, reason: "invalid", hint };
				return { ok: true, form: "t", turn, step, hint };
			}
			// c<callId>
			if (tail.startsWith("c") && tail.length > 1) return { ok: true, form: "c", callId: tail.slice(1), hint };
			return { ok: false, reason: "invalid", hint };
		}
		/** Map a parsed anchor onto a station, or explain why it cannot be resolved. */
		function resolveAnchorInStations(parsed, stations) {
			if (parsed == null || parsed.ok !== true) {
				return { ok: false, reason: parsed?.reason ?? "invalid" };
			}
			if (parsed.form === "e") {
				// A seq is shared by DIFFERENT node kinds: a turn-error is stamped with the
				// turn's end seq, which can equal the assistant message's seq. A plain
				// `find` then returned the error node for `tvp1:e2` while the user meant the
				// step. Prefer a step (the thing anchors are normally copied from); otherwise
				// take the first match as before.
				const hits = stations.filter((st) => st.anchorSeq === parsed.seq);
				if (hits.length === 0) return { ok: false, reason: "not-loaded", seq: parsed.seq };
				const preferred = hits.find((st) => st.kind === "step") ?? hits[0];
				return { ok: true, station: preferred };
			}
			if (parsed.form === "c") {
				for (const st of stations) {
					if (st.kind === "step") {
						for (const c of st.cells ?? []) {
							if (c.kind !== "tool" || c.callId !== parsed.callId) continue;
							if (Number.isSafeInteger(st.anchorSeq)) return { ok: true, station: st };
							return { ok: false, reason: "synthetic-tool" };
						}
						continue;
					}
					// A tool result with no matching call becomes its own `orphan-tool`
					// station, which carries the callId itself. Skipping it here made
					// `tvp1:c<id>` fail on a result that was plainly loaded and visible.
					if (st.kind === "orphan-tool" && st.callId === parsed.callId) {
						if (Number.isSafeInteger(st.anchorSeq)) return { ok: true, station: st };
						return { ok: false, reason: "synthetic-tool" };
					}
				}
				return { ok: false, reason: "not-loaded" };
			}
			if (parsed.form === "p" || parsed.form === "t") {
				const hit = stations.find((st) => st.kind === "step"
					&& Number.isFinite(st.turn) && st.turn === parsed.turn
					&& (st.turnStep ?? st.stepNo) === parsed.step
					&& (parsed.callId == null || (st.cells ?? []).some((c) => c.kind === "tool" && c.callId === parsed.callId)));
				if (hit === void 0) return { ok: false, reason: "not-loaded" };
				if (parsed.form === "t" && hit.anchorSeq !== null) {
					return { ok: true, station: hit, upgraded: `e${hit.anchorSeq}` };
				}
				return { ok: true, station: hit, synthetic: hit.synthetic === true };
			}
			return { ok: false, reason: "invalid" };
		}
		/**
		 * G2: how far back must we page before this anchor can resolve?
		 * Returns the smallest seq that must be covered, or null when paging cannot help
		 * (synthetic / unparseable anchors never become durable by loading more history).
		 * `e<seq>` and `c<callId>` carry an exact seq; `p`/`t` only carry a turn/step
		 * coordinate, so they ask for the whole history (0) and rely on re-resolve.
		 */
		/**
		 * How far back paging must go for this anchor, expressed as a seq floor.
		 *
		 * `0` means "no bound known, keep paging" — which is what `p` / `t` anchors
		 * used to return unconditionally. That turned the floor check in the paging
		 * loop into a no-op for turn/step anchors: a deep `p3s1` link on a long session
		 * pulled the maximum number of pages even when the oldest loaded station was
		 * already older than the requested turn. Turn anchors carry a turn number, and
		 * turns only ever grow with seq, so "have we loaded turn N" is decidable
		 * without knowing seqs: see `anchorTurnFloor`.
		 */
		function anchorLoadTarget(parsed) {
			if (parsed == null || parsed.ok !== true) return null;
			if (parsed.form === "e") return Number.isSafeInteger(parsed.seq) && parsed.seq >= 0 ? parsed.seq : null;
			if (parsed.form === "c") return 0;
			if (parsed.form === "p" || parsed.form === "t") return 0;
			return null;
		}
		/**
		 * Oldest TURN currently loaded, or null when no station carries one.
		 *
		 * Used to stop back-paging for `p` / `t` anchors: seql is monotonic with turns,
		 * so once the window reaches at or below the requested turn, further pages
		 * cannot reveal anything newer.
		 */
		function anchorTurnFloor(stations) {
			let floor = null;
			for (const st of stations) {
				if (typeof st.turn !== "number" || !Number.isFinite(st.turn)) continue;
				if (floor === null || st.turn < floor) floor = st.turn;
			}
			return floor;
		}
		/**
		 * True when the loaded window provably extends back past the anchor's turn, so
		 * paging further back cannot help. Conservative: unknown → false (keep paging).
		 */
		function anchorCoveredByWindow(parsed, stations) {
			if (parsed == null || parsed.ok !== true) return false;
			if (parsed.form === "p" || parsed.form === "t") {
				if (!Number.isFinite(parsed.turn)) return false;
				// Seeing ANY station of the target turn proves nothing: a window can hold
				// only turn 2's last step, and stopping there reported "not loaded" even
				// though turn 2's earlier steps were one page away.
				// The turn is covered when either
				//  (a) a strictly EARLIER turn is loaded — paging back cannot add steps to
				//      turn N any more, or
				//  (b) this turn's first step is already present.
				const floor = anchorTurnFloor(stations);
				const hasTargetTurn = stations.some((st) => Number.isFinite(st.turn) && st.turn === parsed.turn);
				// The target turn must actually be in the window before its first step can
				// prove anything; otherwise a future turn would look "covered".
				if (!hasTargetTurn) return false;
				if (floor !== null && floor < parsed.turn) return true;
				// Nothing here: "the target turn is the oldest turn loaded" is NOT proof
				// that no earlier page holds more of it (N1 covers exactly that: turn 9's
				// earlier steps can still be one page back). Paging stops on `hasMore`
				// instead — see the caller, which already refuses to page past history.
				// The 101 s / 3,360-station deep link was the CALLER searching all history
				// for a step that never existed, which shows up as an honest "not loaded".
				return stations.some((st) => st.kind === "step"
					&& Number.isFinite(st.turn) && st.turn === parsed.turn
					&& (st.turnStep ?? st.stepNo) === 1);
			}
			if (parsed.form === "e") {
				if (!Number.isSafeInteger(parsed.seq)) return false;
				const floor = anchorSeqFloor(stations);
				return floor !== null && floor <= parsed.seq;
			}
			return false;
		}
		/**
		 * Smallest anchorSeq currently loaded — i.e. the lower edge of the window.
		 * Used to stop back-paging as soon as the requested seq is covered, instead of
		 * blindly pulling pages until the session start. Returns null when unknown.
		 */
		function anchorSeqFloor(stations) {
			let floor = null;
			for (const st of stations) {
				const n = st.anchorSeq;
				if (!Number.isSafeInteger(n) || n < 0) continue;
				if (floor === null || n < floor) floor = n;
			}
			return floor;
		}
		/**
		 * Run one hash-navigation step for an incoming anchor.
		 * Returns `changed: false` when the URL already carries this anchor — the caller
		 * must then skip history.replaceState, otherwise every render pushes a new entry.
		 * (Strings are primitives: `a === b` cannot tell "rebuilt" from "identity", so the
		 * decision is returned as an explicit flag instead of being inferred by the caller.)
		 */
		/**
		 * Deduplicate concurrent work keyed by a string.
		 *
		 * The anchor search is started from two places (the URL/focus effect and the
		 * typed-Enter handler) and its driving effect also depends on `N`, which grows
		 * with every page it loads — so one request could spawn several concurrent
		 * 40-page searches. Each keeps its own page counter, which is why the progress
		 * text was seen moving backwards (25 -> 23 -> 11 -> 20) while one `t2s1` lookup
		 * ran for 133 s; the host's own network time for that run was only 8.7 s.
		 *
		 * Only an IDENTICAL key is blocked: a different anchor must be allowed to
		 * supersede an in-flight one, otherwise typing a new target would be silently
		 * ignored while the old search kept paging.
		 */
		function createFlightGuard() {
			let current = "";
			return {
				tryStart(key) {
					const k = String(key ?? "");
					if (k !== "" && current === k) return false;
					current = k;
					return true;
				},
				finish(key) {
					// Keyed: a request that was superseded must not clear the newer one.
					if (current === String(key ?? "")) current = "";
				},
				current() { return current; }
			};
		}
		function nextHashFor(hash, anchor) {
			// Normalize exactly the way `parseAnchor` does, or the URL written here is
			// not the one that will be read back. `parseAnchor` trims and strips ONE
			// leading `#`, so pasting `#tvp1:e2` (a form it accepts) was mirrored as
			// `##tvp1:e2` — a link that resolved fine in this tab and reported "锚点格式
			// 无法识别" for whoever opened it.
			let body = typeof anchor === "string" ? anchor.trim() : "";
			if (body.startsWith("#")) body = body.slice(1);
			if (body === "") return { hash, changed: false };
			const want = `#${body}`;
			if (hash === want) return { hash, changed: false };
			return { hash: want, changed: true };
		}
		/**
		 * Fold a TrajectorySnapshot into the timeline tree:
		 * root -> turns -> chronological stations (user messages / steps / special events)
		 * plus a flattened station list, aggregate stats, and per-step raw request info.
		 * @param snap - the `views.get("trajectory")` snapshot (or an empty stand-in).
		 * @param t - bound translate function for this plugin's namespace.
		 */
		/**
		 * Coerce an untrusted collection into an array of non-null objects.
		 * The snapshot is produced by another plugin: a single malformed entry must
		 * degrade into "that entry is skipped", never into a crashed view.
		 */
		function safeList(value) {
			if (!Array.isArray(value)) return [];
			const out = [];
			for (const item of value) if (item != null && typeof item === "object") out.push(item);
			return out;
		}
		/**
		 * Node kinds this projector consumes. Kept next to the projector, not in the
		 * component, so the "what is unknown" answer can never drift from "what is drawn".
		 * Order matters only for readability.
		 */
		/**
		 * Node kinds this plugin can place on the timeline. `unknown` is here on
		 * purpose: it is the contract's own documented fallback surface
		 * (`UnknownSurfaceNode`, "known unsupported developer events throw before
		 * fallback selection"), so a session that contains one is a session with an
		 * unsupported EVENT, not a drifted CONTRACT. Counting it as drift made a
		 * single exotic event blank the whole view with "版本不兼容".
		 */
		const KNOWN_NODE_KINDS = new Set([
			"user", "steering", "context", "assistant", "tool-result",
			"compaction", "turn-error", "model-retry", "turn-max-tokens", "command",
			"unknown"
		]);
		/**
		 * Drift guard. The snapshot comes from another plugin whose contract we do not own:
		 * a renamed field or kind must degrade LOUDLY, not into a plausible-looking trace.
		 * Returns { ok, problems[] } where `problems` are machine-readable tokens.
		 */
		function snapshotContract(snap) {
			const problems = [];
			if (snap == null || typeof snap !== "object") return { ok: false, problems: ["no-snapshot"] };
			if (!("eventNodes" in snap)) problems.push("missing-eventNodes");
			else if (!Array.isArray(snap.eventNodes)) problems.push("eventNodes-not-array");
			else {
				let badShape = 0;
				for (const n of snap.eventNodes) {
					if (n == null || typeof n !== "object" || typeof n.kind !== "string" || n.kind === ""
						|| typeof n.seq !== "number" || !Number.isFinite(n.seq)) badShape += 1;
					// A node whose `content` is present but not an array is malformed enough to
					// matter: the trajectory helpers iterate it. Catching it here lets the view
					// show its incompatibility notice instead of throwing mid-render.
					else if (n.content !== void 0 && n.content !== null && !Array.isArray(n.content)) badShape += 1;
				}
				if (badShape > 0) problems.push("bad-node-shape");
			}
			return { ok: problems.length === 0, problems };
		}
		/**
		 * True when a NON-EMPTY snapshot produced no usable node at all. That is the
		 * signature of a contract rename (field names stay valid, kinds change), which
		 * must be reported as incompatibility rather than "no data yet".
		 */
		function isEverythingUnknown(nodes, stats) {
			const total = Array.isArray(nodes) ? nodes.length : 0;
			if (total === 0 || stats == null) return false;
			const dropped = (Number(stats.unknown) || 0) + (Number(stats.invalid) || 0);
			return dropped >= total;
		}
		/** Count nodes we received but cannot place: unknown kind, or structurally unusable. */
		function unknownNodeStats(nodes) {
			let unknown = 0;
			let invalid = 0;
			const kinds = [];
			for (const n of Array.isArray(nodes) ? nodes : []) {
				if (n == null || typeof n !== "object") { invalid += 1; continue; }
				const kind = n.kind;
				if (typeof kind !== "string" || kind === "") { invalid += 1; continue; }
				if (!KNOWN_NODE_KINDS.has(kind)) { unknown += 1; if (kinds.length < 5 && !kinds.includes(kind)) kinds.push(kind); }
			}
			return { unknown, invalid, kinds };
		}
		/**
		 * `seq` is the ONE field the whole projection orders by, compares and pastes
		 * into ids, and it arrives from a persisted log. Normally a number — but a
		 * truncated or hand-edited record can carry a BigInt or a Symbol, and JS THROWS
		 * on those: `Symbol - number`, `Symbol > number` and even a template literal all
		 * raise TypeError. A review tool whose entire promise is "show me what the log
		 * recorded" must not refuse to render a log *because* it is damaged, so pin the
		 * field to a number once, at the entry, and let everything downstream stay simple.
		 */
		/**
		 * `Number(x)` THROWS on a Symbol, and `step` arrives from the same untrusted log
		 * `seq` does. Three call sites coerced it directly, so one damaged record took
		 * down the whole projection. Same contract as before (`|| 1`, clamped to >= 1),
		 * but total for every input.
		 */
		function stepOf(v) {
			const n = typeof v === "symbol" ? NaN : Number(v);
			return Math.max(1, Number.isFinite(n) ? Math.trunc(n) : 1);
		}
		function seqOf(v) {
			if (Number.isSafeInteger(v)) return v;
			// BigInt is comparable and printable, so keep it when it still fits a double.
			if (typeof v === "bigint") { const n = Number(v); return Number.isSafeInteger(n) ? n : null; }
			return null;
		}
		function deriveTraceTree(snap, t) {
			const rawNodes = safeList(snap?.eventNodes);
			// Only pay for the copy when a node actually needs repairing: a well-formed
			// snapshot (the normal case) proceeds with the objects the host handed us.
			let nodes = rawNodes;
			for (const n of rawNodes) {
				if (n !== null && typeof n === "object" && !Number.isSafeInteger(n.seq)) {
					nodes = rawNodes.map((m) => (m !== null && typeof m === "object" && !Number.isSafeInteger(m.seq)
						? { ...m, seq: seqOf(m.seq) } : m));
					break;
				}
			}
			nodes = nodes.slice().sort((a, b) => (Number.isFinite(a.seq) ? a.seq : -Infinity) - (Number.isFinite(b.seq) ? b.seq : -Infinity));
			// Drift diagnostics: computed once, surfaced by the view (never silently dropped).
			const contract = snapshotContract(snap);
			const nodeStats = unknownNodeStats(Array.isArray(snap?.eventNodes) ? snap.eventNodes : []);
			// A callId is NOT globally unique in a log that was merged, replayed or written
			// by a buggy client: the same id can appear in two different turns. A plain
			// `Map<callId, result>` kept only the LAST one, so turn 1's call displayed
			// turn 2's output (wrong data) while turn 2's call was dropped by the
			// claim-based dedupe below (lost data) — silently, which is the one outcome
			// this view promises never to produce. Keep every result per id, ordered by
			// seq, and let each call claim the next unconsumed one.
			const resultsById = new Map();
			for (const n of nodes) {
				if (n.kind !== "tool-result" || typeof n.callId !== "string") continue;
				const list = resultsById.get(n.callId);
				if (list === void 0) resultsById.set(n.callId, [n]);
				else list.push(n);
			}
			for (const list of resultsById.values()) list.sort((a, b) => a.seq - b.seq);
			// Results already paired with a call. The orphan pass must skip these, and a
			// second call with the same id must take a DIFFERENT result.
			const consumedResults = new Set();
			const runningById = new Map();
			for (const c of safeList(snap?.runningCalls)) if (typeof c.callId === "string") runningById.set(c.callId, c);
			const schemasById = snap?.callSchemas instanceof Map ? snap.callSchemas : new Map();
			// Keyed by `${turn}:${callId}`, NOT by callId alone.
			//
			// A callId can repeat across turns in a merged/replayed log. Deduping on the
			// bare id dropped the SECOND call entirely: its cell was never created and its
			// result surfaced as an unrelated "orphan" in whatever turn the seq happened to
			// fall in. The cell ids below (`t${callId}`) stay call-keyed, so a per-turn
			// scope produces distinct React keys too.
			// Claims per `${turn}:${callId}`. A plain Set gave the durable loop "first wins":
			// two DISTINCT tool-call blocks sharing an id in one turn made the second vanish.
			// The same guard is still needed across the three sources (durable / running /
			// partial) so one call is not attached twice, hence a claim COUNT.
			const attachedCalls = new Map();
			const claimCall = (ck) => { const n = attachedCalls.get(ck) ?? 0; attachedCalls.set(ck, n + 1); return n; };
			const claimedCall = (ck) => (attachedCalls.get(ck) ?? 0) > 0;
			const callKey = (turn, callId) => `${String(turn)}:${String(callId)}`;
			/**
			 * Cell ids double as React keys, and `callId` comes straight from the log. A
			 * template literal calls ToString, which THROWS on a Symbol — one damaged
			 * tool-call id took the entire projection down (`Cannot convert a Symbol value
			 * to a string`). String ids are kept VERBATIM because anchors are built from
			 * them (tvp1:c<callId>); anything else gets an ordinal that is unique within the
			 * station, which is all a React key needs.
			 */
			const cellId = (prefix, callId, ordinal) => `${prefix}${typeof callId === "string" ? callId : `?${String(ordinal)}`}`;
			/** Next unclaimed result for this call id, or undefined when none is left. */
			const takeResult = (callId) => {
				const list = resultsById.get(callId);
				if (list === void 0) return void 0;
				for (const r of list) {
					if (consumedResults.has(r)) continue;
					consumedResults.add(r);
					return r;
				}
				return void 0;
			};

			// Requests keyed by `${turn}:${step}`, with prompt inheritance across
			// requests (a header in force covers steps until a newer one replaces it).
			// A merged/retried log can carry MORE THAN ONE request for the same turn:step.
			// A plain `Map.set` kept only the last, silently losing status/usage/prompt from
			// the earlier one. Keep every request per key in log order; a station consumes the
			// earliest unclaimed one, and leftovers are counted as unplaced, never discarded.
			const requestsByStep = new Map();
			const compactionReqs = [];
			let unplaceableRequests = 0;
			// Keys that actually found a step. Anything left over is a request the log
			// recorded but this view could not place; it must be reported, not discarded.
			{
				// `startSeq` comes from the host record. Subtracting a Symbol throws
				// (`Cannot convert a Symbol value to a number`) and a BigInt throws too, so one
				// malformed request used to take the entire projection down before any station
				// existed. Sort only on finite numbers; anything else keeps its relative order
				// at the end instead of entering the comparator arithmetic.
				const seqOrder = (v) => (typeof v === "bigint" ? Number(v) : v);
				const reqs = safeList(snap?.requests).sort((a, b) => {
					const x = seqOrder(a?.startSeq);
					const y = seqOrder(b?.startSeq);
					const xf = Number.isFinite(x);
					const yf = Number.isFinite(y);
					if (xf && yf) return x - y;
					if (xf) return -1;
					if (yf) return 1;
					return 0;
				});
				let lastPrompt = null;
				for (const r of reqs) {
					if (r?.purpose === "compaction") { compactionReqs.push(r); continue; }
					// A request we cannot even key (no `turn`, or a purpose this build does
					// not know) used to be dropped on the floor. The view promises that what
					// the log recorded is shown, including the parts it cannot interpret —
					// unknown NODE kinds already become visible "unknown" stations, so
					// requests get the same treatment (a counted, explained notice).
					if (r?.purpose !== "assistant" || typeof r.turn !== "number") { unplaceableRequests += 1; continue; }
					const prompt = r.prompt ?? lastPrompt;
					if (r.prompt != null) lastPrompt = r.prompt;
					const rk = `${r.turn}:${r.step}`;
					const bucket = requestsByStep.get(rk);
					const entry = { req: r, prompt };
					if (bucket === void 0) requestsByStep.set(rk, [entry]);
					else bucket.push(entry);
				}
			}

			const turns = [];
			const turnMap = new Map();
			// Ids double as React keys and as the selection pin's identity, so they must be
			// unique AND stable across rebuilds. Shared by the user/context stations and the
			// synthetic steps: both are numbered from data that a malformed log can repeat.
			const usedStationIds = new Set();
			let pendingUser = [];
			let lastTurnEntry = null;
			const ensureTurn = (turn, seq) => {
				let e = turnMap.get(turn);
				if (e === void 0) {
					e = { turn, user: [], stations: [], seq: seq ?? Number.MAX_SAFE_INTEGER };
					turnMap.set(turn, e);
					turns.push(e);
					lastTurnEntry = e;
				}
				if (e.seq > seq) e.seq = seq;
				return e;
			};
			const flushUser = (turn, seq) => {
				if (pendingUser.length === 0) return;
				const e = ensureTurn(turn, seq);
				for (const u of pendingUser) {
					e.user.push(u);
					e.stations.push({ id: u.id, kind: "user", who: u.who, text: u.text, time: u.time, seq: u.seq });
				}
				pendingUser = [];
			};

			for (const n of nodes) {
				if (n.kind === "user" || n.kind === "steering" || n.kind === "context") {
					// The contract puts the label at `producer.label` (ContextProducerView),
					// NOT under `provenance`. Reading the wrong path meant every context row
					// rendered a bare "上下文注入" and the producer name was never shown.
					const producerLabel = typeof n.producer?.label === "string" && n.producer.label !== "" ? n.producer.label : null;
					const who = n.kind === "context"
						? `${t("node.context")}${producerLabel !== null ? ` · ${producerLabel}` : ""}`
						: t("node.user");
					// Ids double as React keys and as the selection pin's identity, so they must
					// be unique. Two user nodes sharing a seq (a malformed/duplicated log)
					// produced two `u7` stations; suffix the duplicate instead of colliding.
					const baseId = `u${n.seq}`;
					let entryId = baseId;
					for (let dupe = 2; usedStationIds.has(entryId); dupe += 1) entryId = `${baseId}-${String(dupe)}`;
					usedStationIds.add(entryId);
					const entry = { id: entryId, who, text: textOfContent(n.content, t), time: n.time, seq: n.seq, steering: n.kind === "steering" };
					// A user turn that has no assistant/special event yet must still be shown.
					// Start its turn here when the node declares one; otherwise park it in
					// `pendingUser` and let the next assistant message's turn adopt it.
					//
					// Do NOT fall back to `partial.turn`: a streaming partial describes the
					// turn being GENERATED right now, so borrowing its number filed every
					// historical user message under the newest turn. rc.2 UserMessageNode has
					// no `turn` field at all, so that fallback applied to almost every user
					// message — one session's turns came out as [user(t2), step(t2),
					// user(t2), step(t1)] with the old turn ordered last.
					const declared = typeof n.turn === "number" ? n.turn : null;
					if (declared !== null) {
						const e = ensureTurn(declared, n.seq);
						e.user.push(entry);
						e.stations.push({ id: entry.id, kind: "user", who: entry.who, text: entry.text, time: entry.time, seq: entry.seq });
						continue;
					}
					pendingUser.push(entry);
					continue;
				}
				if (n.kind === "assistant") {
					const turn = typeof n.turn === "number" ? n.turn : 0;
					flushUser(turn, n.seq);
					const e = ensureTurn(turn, n.seq);
					const step = stepOf(n.step);
					let st = e.steps?.get(step);
					if (st === void 0) {
						if (e.steps === void 0) e.steps = new Map();
						st = newStepState(n.seq);
						e.steps.set(step, st);
					}
					if (st.seq > n.seq) st.seq = n.seq;
					// Durable anchor: only when this node is a real persisted assistant
					// message (messageId present) AND its seq is a non-negative safe
					// integer. Synthetic interruption fallbacks carry a fractional seq
					// and no messageId, so they never qualify.
					if (typeof n.messageId === "string" && n.messageId !== "" && Number.isSafeInteger(n.seq) && n.seq >= 0) {
						if (st.anchorSeq === null || st.anchorSeq > n.seq) st.anchorSeq = n.seq;
					}
					if (Number.isFinite(n.time) && (st.time === null || st.time > n.time)) st.time = n.time;
					if (n.interrupted === true) st.interrupted = true;
					if (st.modelHint === null) {
						const mh = n.requestConfig?.model ?? n.provenance?.model;
						if (typeof mh === "string" && mh !== "") st.modelHint = mh;
					}
					// `blocks` can contain nulls in a malformed payload; reading `.kind` off
					// null threw TypeError inside the fold and took the whole view down.
					for (const b of Array.isArray(n.blocks) ? n.blocks : []) {
						if (b == null || typeof b !== "object") continue;
						if (b.kind === "text" && typeof b.text === "string" && b.text !== "") {
							st.cells.push({ id: `a${n.seq}${st.cells.length}`, kind: "assistant", text: b.text, thinking: "" });
						} else if (b.kind === "reasoning" && typeof b.text === "string" && b.text !== "") {
							st.cells.push({ id: `r${n.seq}${st.cells.length}`, kind: "assistant", text: "", thinking: b.text });
						} else if (b.kind === "image" || b.kind === "other") {
							// AssistantBlock also has `image` and `other`. The adapters are
							// text-only today, but dropping these silently made a future image
							// reply look like the model produced nothing. Surface a placeholder
							// instead; it is honest and costs one cell.
							const label = b.kind === "image" ? t("block.image")
								: `${t("block.other")}${typeof b.block === "object" && b.block !== null && typeof b.block.type === "string" ? ` · ${b.block.type}` : ""}`;
							st.cells.push({ id: `o${n.seq}${st.cells.length}`, kind: "assistant", text: label, thinking: "" });
						} else if (b.kind === "tool-call") {
							const ck1 = callKey(turn, b.callId);
							claimCall(ck1); // every durable block is a real call, even with a repeated id
							const res = takeResult(b.callId);
							const isRunning = res === undefined && runningById.has(b.callId);
							if (isRunning) st.live = true;
							const schema = schemasById.get(b.callId);
							// A tool cannot plausibly run for a day. When the log is reloaded or
							// reparsed, `callTime` can be missing or belong to a different pass, and
							// `res.time - res.callTime` then spans the reload gap: one step in a real
							// session reported 78,834,620 ms (21.9 h) for a 3-second bash call, and
							// that single value dominated the "tool time" KPI. Treat anything past
							// the ceiling as "unknown" rather than "enormous" — the card shows the
							// step span either way, and a wrong number is worse than no number.
							const rawDur = res != null && Number.isFinite(res.callTime) && Number.isFinite(res.time) ? Math.max(0, res.time - res.callTime) : null;
							const dur = rawDur !== null && rawDur <= TOOL_DUR_CEILING_MS ? rawDur : null;
							st.toolMs += dur ?? 0;
							st.toolCount += 1;
							if (res?.isError === true) st.hasError = true;
							st.cells.push({
								id: cellId("t", b.callId, st.cells.length),
								kind: "tool",
								callId: b.callId,
								name: typeof b.name === "string" && b.name !== "" ? b.name : t("node.tool"),
								args: typeof b.argsRaw === "string" ? b.argsRaw : "",
								resultText: res !== undefined ? blocksText(res.content, t) : "",
								isError: res?.isError === true,
								errorName: res?.error?.name,
								durationMs: dur,
								running: isRunning,
								subCalls: mapSubCalls(res?.subCalls, t),
								schema: schema != null ? { name: schema.name, description: schema.description, parameters: schema.parameters } : null
							});
						}
					}
					if (n.timing != null) {
						st.timingRecorded = true;
						if (Number.isFinite(n.timing.stepStartTime) && Number.isFinite(n.timing.firstTokenTime)) {
							st.ttftMs = Math.max(0, n.timing.firstTokenTime - n.timing.stepStartTime);
						}
						if (Number.isFinite(n.timing.stepStartTime) && (st.startMs === null || st.startMs > n.timing.stepStartTime)) st.startMs = n.timing.stepStartTime;
						if (Number.isFinite(n.timing.completedTime) && (st.endMs === null || st.endMs < n.timing.completedTime)) st.endMs = n.timing.completedTime;
						if (Number.isFinite(n.timing.firstTokenTime) && st.firstTokMs === null) st.firstTokMs = n.timing.firstTokenTime;
					}
					const u = normalizeUsage(n.usage);
					if (u !== null) st.usage = u;
				}
			}
			// Any user message still pending has no owning turn yet (e.g. a snapshot whose
			// only content is a user message). Give it its own turn rather than dropping it
			// or attaching it to an unrelated earlier turn.
			if (pendingUser.length > 0) {
				// A user message still pending at EOF belongs to the turn being generated
				// when there is one — that IS its owning turn. Only without a partial do we
				// have to invent the next number, otherwise a window holding just the
				// current input filed it under turn 1 while the live step sat in turn 5.
				const lastTurnNo = maxTurnOf(turns);
				const partialTurn = typeof snap?.partial?.turn === "number" ? snap.partial.turn : null;
				const ownTurn = partialTurn !== null ? partialTurn
					: lastTurnEntry === null ? 1 : lastTurnNo + 1;
				// A steering message is not new input: it interjects into the turn that is
				// already running. The official layout keeps it in `lastAssistantTurn` when
				// no assistant follows it (`node.kind === 'steering' ? lastAssistantTurn : …`),
				// so filing it under `ownTurn` invented a whole extra turn at the tail of
				// the window. Only differs when nothing follows: with a following assistant
				// both implementations agree on that assistant's turn.
				const steeringTurn = partialTurn !== null ? partialTurn
					: lastTurnNo >= 1 ? lastTurnNo : 1;
				const steeringItems = pendingUser.filter((u) => u.steering === true);
				const inputItems = pendingUser.filter((u) => u.steering !== true);
				if (inputItems.length > 0) {
					const e = ensureTurn(ownTurn, inputItems[0].seq);
					for (const u of inputItems) { e.user.push(u); e.stations.push({ id: u.id, kind: "user", who: u.who, text: u.text, time: u.time, seq: u.seq }); }
				}
				if (steeringItems.length > 0) {
					const e = ensureTurn(steeringTurn, steeringItems[0].seq);
					for (const u of steeringItems) { e.user.push(u); e.stations.push({ id: u.id, kind: "user", who: u.who, text: u.text, time: u.time, seq: u.seq }); }
				}
				pendingUser = [];
			}

			// In-flight tool calls not already attached via an assistant block.
			for (const c of safeList(snap?.runningCalls)) {
				if (typeof c.turn !== "number" || claimedCall(callKey(c.turn, c.callId))) continue;
				// Claim the call id here as well: the streaming partial can describe the very
				// same in-flight call, and without claiming it the tool is counted twice
				// (once from runningCalls, once from the partial block).
				claimCall(callKey(c.turn, c.callId));
				const e = ensureTurn(c.turn, c.time);
				const step = stepOf(c.step);
				if (e.steps === void 0) e.steps = new Map();
				let st = e.steps.get(step);
				if (st === void 0) {
					st = newStepState(c.time);
					st.time = Number.isFinite(c.time) ? c.time : null;
					e.steps.set(step, st);
				}
				st.live = true;
				st.toolCount += 1;
				const schema = schemasById.get(c.callId);
				st.cells.push({
					id: cellId("t", c.callId, st.cells.length), kind: "tool", callId: c.callId,
					name: typeof c.name === "string" && c.name !== "" ? c.name : t("node.tool"),
					args: typeof c.argsRaw === "string" ? c.argsRaw : "",
					resultText: "", isError: false, errorName: void 0, durationMs: null,
					running: true,
					subCalls: mapSubCalls(c.subCalls, t),
					schema: schema != null ? { name: schema.name, description: schema.description, parameters: schema.parameters } : null
				});
			}

			// Streaming partial assistant (in-flight reply of the current step).
			const p = snap?.partial;
			if (p != null && Array.isArray(p.blocks) && p.blocks.length > 0) {
				const turn = typeof p.turn === "number" ? p.turn : 0;
				const seq = lastTurnEntry != null ? lastTurnEntry.seq + 0.5 : 0.5;
				flushUser(turn, seq);
				const e = ensureTurn(turn, seq);
				const step = stepOf(p.step);
				if (e.steps === void 0) e.steps = new Map();
				let st = e.steps.get(step);
				if (st === void 0) {
					st = newStepState(seq);
					e.steps.set(step, st);
				}
				st.live = true;
				// The in-flight reply carries `timing` too (rc.2 TrajectoryPartialAssistant
				// exposes it and the real builder fills it). Ignoring it made the header
				// claim "timing not recorded" for a step whose start and first token were
				// already known. There is no completedTime yet, so endMs stays null — the
				// duration is simply not known until the step finishes.
				if (p.timing != null) {
					const pt = p.timing;
					if (Number.isFinite(pt.stepStartTime)) {
						st.timingRecorded = true;
						if (st.startMs === null || st.startMs > pt.stepStartTime) st.startMs = pt.stepStartTime;
					}
					if (Number.isFinite(pt.stepStartTime) && Number.isFinite(pt.firstTokenTime)) {
						st.ttftMs = Math.max(0, pt.firstTokenTime - pt.stepStartTime);
						st.timingRecorded = true;
					}
					if (Number.isFinite(pt.firstTokenTime) && st.firstTokMs === null) st.firstTokMs = pt.firstTokenTime;
					if (Number.isFinite(pt.completedTime) && (st.endMs === null || st.endMs < pt.completedTime)) st.endMs = pt.completedTime;
				}
				const existingKinds = new Set(st.cells.map((c) => c.kind));
				// Same guard as the durable loop: a null/primitive block must be skipped, not
				// throw. The 0.9.26 fix hardened `blocks` in the durable path only, so a
				// malformed PARTIAL still crashed the entire view (found by fuzzing).
				for (const b of Array.isArray(p.blocks) ? p.blocks : []) {
					if (b == null || typeof b !== "object") continue;
					if (b.kind === "text" && typeof b.text === "string" && b.text !== "" && !existingKinds.has("assistant")) {
						st.cells.push({ id: `pa${b.text.length}`, kind: "assistant", text: b.text, thinking: "" });
						existingKinds.add("assistant");
					} else if (b.kind === "reasoning" && typeof b.text === "string" && b.text !== ""
						// Tool cells carry no `thinking` at all, and `undefined !== ""` is true —
						// so any tool call in this step made the reasoning look already-taken
						// and it was dropped. Only cells that actually hold prose count.
						&& !st.cells.some((c) => typeof c.thinking === "string" && c.thinking !== "")) {
						st.cells.push({ id: `pr${b.text.length}`, kind: "assistant", text: "", thinking: b.text });
					} else if (b.kind === "image" || b.kind === "other") {
						// The durable loop got this placeholder in the same change; the STREAMING
						// branch was missed, so a live image reply showed an empty step until the
						// turn finalized. Both loops must agree.
						const plabel = b.kind === "image" ? t("block.image")
							: `${t("block.other")}${typeof b.block === "object" && b.block !== null && typeof b.block.type === "string" ? ` · ${b.block.type}` : ""}`;
						st.cells.push({ id: `po${st.cells.length}`, kind: "assistant", text: plabel, thinking: "" });
					} else if (b.kind === "tool-call") {
						const ck3 = callKey(turn, b.callId);
						if (claimedCall(ck3)) continue;
						claimCall(ck3);
						const res = takeResult(b.callId);
						st.toolCount += 1;
						if (res?.isError === true) st.hasError = true;
						const schema = schemasById.get(b.callId);
						st.cells.push({
							id: cellId("t", b.callId, st.cells.length), kind: "tool", callId: b.callId,
							name: typeof b.name === "string" && b.name !== "" ? b.name : t("node.tool"),
							args: typeof b.argsRaw === "string" ? b.argsRaw : "",
							resultText: res !== undefined ? blocksText(res.content, t) : "",
							isError: res?.isError === true,
							errorName: res?.error?.name,
							durationMs: null, running: res === undefined,
							subCalls: mapSubCalls(res?.subCalls, t),
							schema: schema != null ? { name: schema.name, description: schema.description, parameters: schema.parameters } : null
						});
					}
				}
			}

			// Special events: compaction / turn-error / retry / max-tokens / command.
			// Compaction/command nodes carry no turn number: seat them by seq range —
			// the turn whose first event seq is the greatest one not after the event.
			const turnsBySeq = [...turns].sort((a, b) => a.seq - b.seq);
			// Binary search: `turnsBySeq` is already sorted. The previous linear scan ran
			// once per compaction/special event, so a log with many of both cost
			// O(events x turns) — measured 105 ms at 1000 turns, and it grows from there.
			const turnForSeq = (s) => {
				let lo = 0;
				let hi = turnsBySeq.length - 1;
				let best = null;
				while (lo <= hi) {
					const mid = (lo + hi) >> 1;
					if (turnsBySeq[mid].seq <= s) { best = turnsBySeq[mid]; lo = mid + 1; }
					else hi = mid - 1;
				}
				return best ?? lastTurnEntry ?? ensureTurn(0, s);
			};
			const consumedCompactionReqs = new Set();
			// Index the exact-replacementSeq match instead of scanning every request per
			// compaction. Both the exact lookup and the timed fallback iterated the whole
			// request list, so N compactions x M requests was quadratic: a synthetic
			// 2000-compaction log cost 315 ms and the visit count grew from 5,050 to
			// 2,001,000. The map makes the exact hit O(1); the timed fallback still scans,
			// but only when there is no exact match.
			const compactionByReplacement = new Map();
			for (const r of compactionReqs) {
				if (Number.isSafeInteger(r.replacementSeq) && !compactionByReplacement.has(r.replacementSeq)) {
					compactionByReplacement.set(r.replacementSeq, r);
				}
			}
			for (const n of nodes) {
				if (n.kind === "compaction") {
					const e = turnForSeq(n.seq);
					// Pair with the compaction provider request: exact replacementSeq
					// match first, else the nearest unconsumed compaction request that
					// completed within a minute before this marker landed.
					let matched = compactionByReplacement.get(n.seq);
					if (matched !== void 0 && consumedCompactionReqs.has(matched)) matched = void 0;
					if (matched === void 0) {
						// A duplicate request may hold the same replacementSeq; fall back to a
						// scan only in that (rare) case.
						matched = compactionReqs.find((r) => !consumedCompactionReqs.has(r) && r.replacementSeq === n.seq);
					}
					if (matched === void 0 && Number.isFinite(n.time)) {
						let best = null;
						for (const r of compactionReqs) {
							if (consumedCompactionReqs.has(r)) continue;
							const doneAt = Number.isFinite(r.completedAt) ? r.completedAt : r.startedAt;
							if (!Number.isFinite(doneAt)) continue;
							const gap = n.time - doneAt;
							if (gap < -5000 || gap > 60000) continue;
							if (best === null || Math.abs(gap) < Math.abs(best.gap)) best = { r, gap };
						}
						if (best !== null) matched = best.r;
					}
					let crequest = null;
					if (matched !== void 0) {
						consumedCompactionReqs.add(matched);
						crequest = {
							status: matched.status,
							startedAt: Number.isFinite(matched.startedAt) ? matched.startedAt : null,
							durationMs: Number.isFinite(matched.startedAt) && Number.isFinite(matched.completedAt) ? Math.max(0, matched.completedAt - matched.startedAt) : null,
							config: matched.requestConfig ?? null,
							usage: normalizeUsage(matched.usage),
							outputText: blocksText(matched.rawOutput, t) || blocksText(matched.summary, t) || ""
						};
					}
					e.stations.push({
						id: `m${n.seq}`, kind: "compaction", time: n.time, seq: n.seq,
						summary: asText(n.summary),
						// Raw values here reached a template literal (`${station.count}`), which
						// calls ToString and THROWS on a Symbol — the step-copy Markdown took the
						// whole render down. Non-integers become null, which the callers already
						// treat as "not recorded".
						count: Number.isSafeInteger(n.shadowedItemCount) ? n.shadowedItemCount : null,
						tokens: Number.isSafeInteger(n.shadowedTokenCount) ? n.shadowedTokenCount : null,
						crequest,
						label: t("node.compaction")
					});
				} else if (n.kind === "turn-error") {
					const e = ensureTurn(typeof n.turn === "number" ? n.turn : 0, n.seq);
					e.stations.push({
						id: `e${n.seq}`, kind: "error", time: n.time, seq: n.seq,
						message: asText(n.message), code: typeof n.code === "string" ? n.code : void 0, label: t("node.error")
					});
				} else if (n.kind === "model-retry") {
					const e = ensureTurn(typeof n.turn === "number" ? n.turn : 0, n.seq);
					e.stations.push({
						id: `y${n.seq}`, kind: "retry", time: n.time, seq: n.seq,
						message: asText(n.failure?.message), code: typeof n.failure?.code === "string" ? n.failure.code : void 0,
						retry: n.retry, maxRetries: n.maxRetries, provider: asText(n.provider),
						retryState: asText(n.retryState), label: t("node.retry")
					});
				} else if (n.kind === "turn-max-tokens") {
					const e = ensureTurn(typeof n.turn === "number" ? n.turn : 0, n.seq);
					e.stations.push({ id: `x${n.seq}`, kind: "maxTokens", time: n.time, seq: n.seq, label: t("node.maxTokens") });
				} else if (n.kind === "command") {
					const e = turnForSeq(n.seq);
					e.stations.push({
						id: `c${n.seq}`, kind: "command", time: n.time, seq: n.seq,
						name: asText(n.name) !== "" ? asText(n.name) : `/${asText(n.commandId) || "?"}`, args: asText(n.args),
						outcomeKind: n.outcome?.kind ?? null, outcomeText: asText(n.outcome?.text),
						label: t("node.command")
					});
				} else if (n.kind === "unknown") {
					// The contract's own fallback surface. Rendering nothing would hide a
					// real event that exists in the session log, and the review tool's whole
					// promise is that what the log recorded is what the reader sees.
					const e = turnForSeq(n.seq);
					e.stations.push({
						id: `k${n.seq}`, kind: "unknown", time: n.time, seq: n.seq,
						eventType: typeof n.type === "string" ? n.type : "",
						payload: safeJsonPreview(n.data, UNKNOWN_PAYLOAD_LIMIT),
						label: t("node.unknown")
					});
				}
			}

			// O1: orphan tool results. A `tool-result` whose matching `tool-call` is not in
			// the loaded window (or whose `call` is null after truncation) is never attached
			// above, so it would otherwise vanish from the timeline entirely. The official
			// view renders these too (via `resultAsText(resultPreview)`), so dropping them
			// silently would under-report work actually done.
			{
				const orphans = nodes
					// Use the RESULT objects, not the call ids: with a duplicated id the id
					// is "attached" while the second result was never shown anywhere.
					.filter((n) => n.kind === "tool-result" && typeof n.callId === "string" && !consumedResults.has(n))
					.sort((a, b) => a.seq - b.seq);
				for (const n of orphans) {
					const e = turnForSeq(n.seq);
					const text = blocksText(n.content, t);
					const subCalls = mapSubCalls(n.subCalls, t);
					// Anchor issuance is centralized in the "special stations" branch below
					// (it re-checks `seq` for integer-ness and stamps anchorKey/synthetic).
					e.stations.push({
						id: `ot${n.callId}`,
						kind: "orphan-tool",
						seq: n.seq,
						time: n.time,
						callId: n.callId,
						name: typeof n.call?.name === "string" && n.call.name !== "" ? n.call.name : t("node.tool"),
						args: typeof n.call?.argsRaw === "string" ? n.call.argsRaw : "",
						resultText: text,
						// `blocksText` already covers text / image / reasoning blocks.
						// Official view computes its preview from `node.content` too
						// (summarizeResult); there is no `resultPreview` field on the node.
						displayText: text !== "" ? text : (n.error?.code ?? n.error?.name ?? ""),
						isError: n.isError === true,
						subCalls,
						hasError: n.isError === true
					});
				}
			}

			// Assemble turns into ordered station lists + attach requests.
			// Sort turns by their earliest known seq first (turn 0 "system events" may
			// be created late by a stray compaction/command and would otherwise land last).
			for (const e of turns) {
				let mseq = e.seq;
				for (const st of e.stations) if (st.seq < mseq) mseq = st.seq;
				for (const st of e.steps?.values() ?? []) if (st.seq < mseq) mseq = st.seq;
				e.minSeq = mseq;
			}
			turns.sort((a, b) => a.minSeq - b.minSeq);
			let seq = 0;
			const nid = () => `n${seq++}`;
			let stepCounter = 0;
			let currentStepNo = null;
			const stations = [];
			let stats = { turns: 0, steps: 0, tools: 0, errors: 0, toolMs: 0, tokensIn: 0, tokensOut: 0, running: 0, maxToolMs: 0, lastModel: null };

			const turnNodes = turns.map((e) => {
				const pieceList = [];
				for (const s of e.stations) {
					pieceList.push({ at: s.seq, kind: s.kind, data: s });
					if (s.kind === "orphan-tool") {
						stats.tools += 1;
						if (s.isError === true) stats.errors += 1;
					}
				}
				const stepNums = e.steps === void 0 ? [] : [...e.steps.keys()].sort((a, b) => a - b);
				for (const s of stepNums) {
					const st = e.steps.get(s);
					pieceList.push({ at: st.seq, kind: "step", data: st, stepNum: s });
				}
				pieceList.sort((a, b) => a.at - b.at);

				let toolCount = 0;
				let stepMs = 0;
				let errCount = 0;
				for (const st of e.steps?.values() ?? []) {
					toolCount += st.toolCount;
					stepMs += st.toolMs;
					if (st.hasError) errCount += 1;
					for (const c of st.cells) if (c.kind === "tool" && c.running === true) stats.running += 1;
					if (st.toolMs > stats.maxToolMs) stats.maxToolMs = st.toolMs;
				}
				const children = [];
				for (const piece of pieceList) {
					if (piece.kind === "user") {
						const uSeq = Number.isSafeInteger(piece.data.seq) && piece.data.seq >= 0 ? piece.data.seq : null;
						const station = {
							id: piece.data.id, kind: "user", who: piece.data.who, text: piece.data.text, time: piece.data.time,
							anchorSeq: uSeq,
							anchorKey: uSeq !== null ? `e${uSeq}` : null,
							synthetic: uSeq === null,
						};
						children.push(station);
						stations.push(station);
						continue;
					}
					if (piece.kind === "step") {
						const st = piece.data;
						stepCounter += 1;
						// The LABEL must be the per-turn number, for exactly the reason the
						// station label was: `stepCounter` is a window-wide counter, so the
						// header read "current step 3" and then "current step 11" for the SAME
						// streaming reply once older history was paged in. `stepCounter` stays
						// as the internal ordinal (and `totalSteps`), the user-visible number
						// comes from `turnStep`.
						// Use `piece.stepNum`: the station object is built further below, so
						// `st` (the raw accumulator) has no `turnStep` yet — reading it here
						// silently fell through to the window-wide counter.
						if (st.live === true && currentStepNo === null) {
							currentStepNo = Number.isFinite(piece.stepNum) ? piece.stepNum : stepCounter;
						}
						// attach request info (messages are reconstructed lazily in the component)
						const key = `${e.turn}:${piece.stepNum}`;
						const bucket = requestsByStep.get(key);
						// Every request in the bucket is a real record. Consume the LATEST one:
						// the original `Map.set` kept the last attempt, so a step retried after a
						// failure showed the final (successful) status. Taking the earliest here
						// silently flipped such a step back to "error". Leftovers still get counted.
						const found = bucket === void 0 ? void 0 : bucket.pop();
						let request = null;
						if (found !== void 0) {
							const r = found.req;
							request = {
								status: r.status,
								error: r.error,
								retry: r.retry,
								maxRetries: r.maxRetries,
								retryDelayMs: r.retryDelayMs,
								startedAt: r.startedAt,
								completedAt: r.completedAt,
								durationMs: r.startedAt != null && r.completedAt != null && Number.isFinite(r.completedAt) ? Math.max(0, r.completedAt - r.startedAt) : null,
								config: r.requestConfig ?? found.prompt?.config ?? null,
								usage: normalizeUsage(r.usage) ?? st.usage,
								prompt: found.prompt != null ? {
									system: found.prompt.system ?? "",
									tools: Array.isArray(found.prompt.tools) ? found.prompt.tools : [],
									systemChars: typeof found.prompt.system === "string" ? found.prompt.system.length : 0
								} : null,
								promptChangeKind: r.promptChange?.kind ?? null,
								promptDiff: promptDiffOf(r.promptChange, found.prompt),
								startSeq: r.startSeq ?? null
							};
							const u2 = normalizeUsage(r.usage);
							if (u2 !== null) { stats.tokensIn += u2.input; stats.tokensOut += u2.output; }
						}
						const cfgModel = request?.config?.model;
						if (typeof cfgModel === "string" && cfgModel !== "") stats.lastModel = cfgModel;
						else if (st.modelHint !== null) stats.lastModel = st.modelHint;
						const stepDurMs = st.startMs !== null && st.endMs !== null ? Math.max(0, st.endMs - st.startMs) : null;
						const decodeRate = decodeRateOf(st.usage ?? request?.usage ?? null, st.firstTokMs, st.endMs);
						const meta = [];
						if (st.toolCount > 0) meta.push(`${st.toolCount}${t("meta.tools")}`);
						// Same unit as the KPI tile: on one screen "9.2 min" and "114,774 ms" force
						// the reader to convert in their head. Exact ms belongs in the detail panel.
						if (st.toolCount > 0 && st.toolMs > 0) meta.push(`${t("meta.toolDur")} ${fmtDur(st.toolMs)}`);
						// Label the measure. A bare "103,686 ms" next to a KPI called "tool time"
						// reads as if it should add up to that KPI, but this chip is the STEP
						// span (model time + tool time + gaps). Two different quantities sharing
						// one word is what made the totals look inconsistent.
						if (stepDurMs !== null) meta.push(`${t("meta.stepDur")} ${fmtDur(stepDurMs)}`);
						else if (st.ttftMs != null && Number.isFinite(st.ttftMs)) meta.push(`${t("chip.ttft")} ${fmtDur(st.ttftMs)}`);
						if (st.usage !== null && st.usage.input + st.usage.output > 0) meta.push(`${fmtTokens(st.usage.input + st.usage.output)}${t("meta.tokens")}`);
						if (st.live === true) meta.push(t("chip.running"));
						if (st.interrupted) meta.push(t("chip.interrupted"));
						if (st.hasError) meta.push(t("meta.error"));
						const anchorSeq = st.anchorSeq;
						const station = {
							// Identity must survive the window growing backwards. `stepCounter`
							// is a running count, so prepending history renumbered every step
							// and the selection pin (which keys on id) silently pointed at a
							// different record. anchorSeq is the stable, persisted identity;
							// fall back to the counter only for synthetic steps without one.
							// A synthetic step has no persisted seq, so its id used to embed
							// `stepCounter` — a WINDOW-wide running count. Prepending older
							// history then changed the id of the very step the reader had
							// selected, the pin's `findIndex` returned -1, and the panel
							// silently showed a DIFFERENT record at the same position. Turn +
							// per-turn step is stable across paging; duplicates (a malformed
							// log repeating a step number) get a suffix instead.
							id: anchorSeq !== null ? `s${anchorSeq}` : (() => {
								const base = `sx${String(e.turn)}-${String(piece.stepNum)}`;
								let cand = base;
								for (let dupe = 2; usedStationIds.has(cand); dupe += 1) cand = `${base}-${String(dupe)}`;
								usedStationIds.add(cand);
								return cand;
							})(),
							kind: "step",
							stepNo: stepCounter,
							// Per-turn step number. `stepNo` above is a WINDOW-wide running
							// counter, so turn 2's first step is 3 in a window that already
							// showed two turn-1 steps. Anchors are written per turn
							// (`tvp1:t2s1`), so they must resolve against this, not stepNo.
							turnStep: piece.stepNum,
							anchorSeq,
							anchorKey: anchorSeq !== null ? `e${anchorSeq}` : null,
							synthetic: anchorSeq === null,
							turn: e.turn,
							// Per-turn number: a window-wide counter renumbers every step
							// whenever older history is prepended.
							label: `${t("node.step")} ${piece.stepNum}`,
							detail: `${t("node.turn")} ${numOr(e.turn)} · ${t("node.step")} ${numOr(piece.stepNum)}`,
							meta,
							cells: st.cells,
							live: st.live === true,
							hasError: st.hasError,
							interrupted: st.interrupted,
							durationMs: stepDurMs,
							// G4-T1: exact step span from `timing.stepStartTime` / `completedTime`.
							// null when either side is absent (window edge, live step, no timing).
							startMs: st.startMs,
							endMs: st.endMs,
							timingRecorded: st.timingRecorded,
							ttftMs: st.ttftMs,
							decodeRate,
							modelHint: st.modelHint,
							request,
							time: st.time,
						};
						children.push(station);
						stats.steps += 1;
						stats.tools += st.toolCount;
						stats.toolMs += st.toolMs;
						if (st.hasError) stats.errors += 1;
						stations.push(station);
						continue;
					}
					// special stations
					const d = piece.data;
					let meta = [];
					if (d.kind === "compaction") {
						meta.push(t("chip.compacted"));
						if (Number.isSafeInteger(d.count)) meta.push(`${numOr(d.count)}${t("meta.steps")}`);
						if (d.tokens != null) meta.push(`${fmtTokens(d.tokens)}${t("meta.tokens")}`);
					} else if (d.kind === "error") {
						meta.push(t("meta.error"));
						stats.errors += 1;
					} else if (d.kind === "retry") {
						meta.push(t("chip.retry"));
						if (Number.isFinite(d.retry)) meta.push(`#${d.retry}`);
					} else if (d.kind === "command") {
						if (d.outcomeKind === "success") meta.push(t("status.done"));
						else if (d.outcomeKind === "error") {
							// A failed command is a failure in the session, so it belongs in the
							// error KPI — the label alone left the counter at zero.
							meta.push(t("meta.error"));
							stats.errors += 1;
						}
					}
					const specialAnchor = Number.isSafeInteger(d.seq) && d.seq >= 0 ? d.seq : null;
					const station = {
						id: d.id, kind: d.kind, label: d.label, meta, time: d.time, ...d,
						anchorSeq: specialAnchor,
						anchorKey: specialAnchor !== null ? `e${specialAnchor}` : null,
						synthetic: specialAnchor === null,
					};
					children.push(station);
					stations.push(station);
				}
				const m = [];
				if (stepNums.length > 0) m.push(`${stepNums.length}${t("meta.steps")}`);
				if (toolCount > 0) m.push(`${toolCount}${t("meta.tools")}`);
				return { id: `t${e.turn}`, kind: "turn", label: e.turn === 0 ? t("node.systemTurn") : `${t("node.turn")} ${numOr(e.turn)}`, meta: m, children };
			});
			// Attach the turn tag to the first station of each turn.
			{
				let turnIdx = 0;
				for (const turn of turnNodes) {
					const first = turn.children[0];
					if (first !== void 0 && first.tag === void 0) first.tag = turn.label;
					turnIdx += 1;
				}
			}
			const rootMeta = turns.length > 0 ? [`${turns.length}${t("meta.turns")}`] : [];
			stats.turns = turns.length;
			return {
				id: "root",
				kind: "root",
				label: t("view.root"),
				meta: rootMeta,
				children: turnNodes,
				stations,
				nodes,
				totalSteps: stepCounter,
				currentStepNo,
				stats,
				// drift diagnostics (see snapshotContract / unknownNodeStats)
				contract,
				nodeStats,
				// Requests the log carries that could not be attached to a step. Counted
				// rather than dropped, and shown in the header next to the node-drift chips.
				unplacedRequests: (() => {
					let n = unplaceableRequests;
					for (const bucket of requestsByStep.values()) n += bucket.length;
					// `shift()` already removed every request that found a step, so whatever
					// remains is exactly the set of unplaced requests — counting both the
					// bucket and the "key not consumed" flag would double-count them.

					return n;
				})()
			};
		}
		/**
		 * Station indices whose haystack contains the (lower-cased) query.
		 *
		 * The haystack is materialized here, on first search, instead of during the
		 * fold. Lower-casing and joining every station's text was the single most
		 * expensive part of building the tree (~109 ms of ~200 ms at 3,400 stations),
		 * and it was paid on EVERY projection rebuild — including one per streaming
		 * token — even though most sessions are never searched.
		 */
		function matchStations(stations, query) {
			const q = String(query ?? "").trim().toLowerCase();
			if (q === "") return [];
			const out = [];
			for (let i = 0; i < stations.length; i += 1) {
				const hay = stationHay(stations[i]);
				if (hay !== "" && hay.includes(q)) out.push(i);
			}
			return out;
		}
		/**
		 * One-line description for assistive tech: what this station IS, where it sits,
		 * and what happened — the same three facts the visual layout conveys by shape,
		 * position and colour.
		 */
		/**
		 * The station's own words, flattened to one line and capped.
		 *
		 * A station is a `role="option"`, and `aria-label` REPLACES the name that would
		 * otherwise be computed from its descendants. So a label built only from the kind
		 * ("用户", "错误") told a screen-reader user nothing about WHICH message it was —
		 * every user turn announced identically, and an error turn never said what failed.
		 * The whole point of an error station is its message.
		 */
		function stationExcerpt(station) {
			if (station == null) return "";
			let raw = "";
			switch (station.kind) {
				case "user": raw = station.text; break;
				case "error":
				case "retry": raw = station.message; break;
				case "compaction": raw = station.summary; break;
				case "command": raw = [station.name, station.args].filter((x) => typeof x === "string" && x !== "").join(" "); break;
				case "unknown": raw = station.eventType; break;
				case "step": {
					// First thing the assistant actually said. `thinking` is skipped: it is
					// deliberately hidden behind a disclosure and should not be announced as
					// the name of the station.
					for (const c of Array.isArray(station.cells) ? station.cells : []) {
						if (c != null && c.kind === "assistant" && typeof c.text === "string" && c.text.trim() !== "") { raw = c.text; break; }
					}
					break;
				}
				default: break;
			}
			const flat = String(raw ?? "").replace(/\s+/g, " ").trim();
			return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
		}
		function stationAriaLabel(station, position, total, t) {
			// Per-turn number: `stepNo` is a window-wide counter, so this label used to
			// read "步骤 1" and then "步骤 5" for the same station once older history was
			// loaded — a screen reader user would hear the record renumbered under them.
			const kind = station.kind === "step" ? `${t("node.step")} ${String(station.turnStep ?? station.stepNo)}`
				: station.kind === "user" ? t("node.user")
					: station.kind === "error" ? t("node.error")
						: station.kind === "compaction" ? t("node.compaction")
							: station.kind === "orphan-tool" ? t("node.orphanTool")
								: station.kind === "unknown" ? t("node.unknown")
									: String(station.kind);
			const parts = [`${position} / ${total}`, kind];
			if (station.kind === "step" && typeof station.turn === "number") parts.push(`${t("node.turn")} ${String(station.turn)}`);
			const meta = Array.isArray(station.meta) && station.meta.length > 0 ? station.meta.join(" · ") : "";
			if (meta !== "") parts.push(meta);
			if (station.hasError === true) parts.push(t("meta.error"));
			const excerpt = stationExcerpt(station);
			if (excerpt !== "") parts.push(excerpt);
			return parts.join("，");
		}
		/**
		 * Cached lower-cased haystack for one station. Built at most once per station
		 * object, and only when someone actually searches.
		 * @param station - one station from the folded tree.
		 * @returns the searchable text, or "" when the station carries none.
		 */
		function stationHay(station) {
			if (station == null) return "";
			if (typeof station.hay === "string") return station.hay;
			// Derive from what the station already carries instead of materializing a
			// parallel array during the fold: the cells ARE the text, so copying them
			// into a second list was pure overhead paid on every projection rebuild.
			const parts = [station.label, station.who, station.text];
			if (Array.isArray(station.cells)) {
				for (const c of station.cells) {
					if (c.kind === "assistant") { parts.push(c.text, c.thinking); }
					else {
						parts.push(c.name, c.args, c.resultText, c.errorName);
						// Programmatic tool calls nest, and a search for a child's name must
						// find the step that made it. Only the top-level call was indexed.
						// Walk the whole chain: nesting is arbitrary depth, and a fixed two
						// levels left deeper calls findable in the panel but not by search.
						const collectSubs = (list, depth) => {
							if (depth > SUB_CALL_MAX_DEPTH) return;
							for (const sub of list ?? []) {
								parts.push(sub.name, sub.argsRaw, sub.resultText, sub.errorName);
								collectSubs(sub.subCalls, depth + 1);
							}
						};
						collectSubs(c.subCalls, 0);
					}
				}
			}
			parts.push(station.summary, station.message, station.name, station.args, station.outcomeText, station.displayText, station.eventType, station.payload);
			const hay = parts.filter((v) => typeof v === "string" && v !== "").join("\n").toLowerCase();
			station.hay = hay;
			return hay;
		}
		/**
		 * D2: search only ever sees the loaded window, so the boundary must be visible.
		 * Returns null when the whole session is already loaded (nothing to warn about).
		 */
		function searchScopeNote(hasMore, loading, t) {
			if (hasMore !== true) return null;
			return loading === true ? t("search.scopeLoading") : t("search.scopePartial");
		}
		/**
		 * Q2-3: build a single-step review pack. Copying the whole trace is too much when
		 * a prompt author only wants "why did THIS step go wrong": merge the request config,
		 * the prompt/tool diff, the tool results and the evidence levels into one block.
		 */
		/**
		 * One bullet per nested sub-call, recursively. Programmatic tool calling can nest
		 * arbitrarily deep; printing only the first level silently dropped the rest, so
		 * the export showed a call whose children — including failures — were invisible.
		 */
		function pushSubLines(L, sub, level) {
			const indent = "  ".repeat(Math.max(0, level));
			L.push(`${indent}- ↳ **${sub.name}**${sub.durationMs != null ? ` (${fmtMs(sub.durationMs)})` : ""}${sub.isError ? " ✗" : ""}${sub.argsRaw !== "" ? ` \`${String(sub.argsRaw).replace(/\s+/g, " ").slice(0, 120)}\`` : ""}`);
			if (sub.errorName != null && sub.errorName !== "") L.push(`${indent}  - ✗ ${sub.errorName}`);
			if (sub.resultText !== "" ) L.push(`${indent}  - ${String(sub.resultText).split("\n")[0].slice(0, 160)}`);
			for (const deeper of sub.subCalls ?? []) pushSubLines(L, deeper, level + 1);
		}
		function buildStepMarkdown(station, messages, hasMore, t) {
			const L = [];
			if (station == null) return "";
			// Same per-turn rule as everywhere else the step number is shown. `stepNo` is
			// the window-wide ordinal: exporting single steps produced "步骤 1.7" for a
			// reply that its own card calls "步骤 1", and the number changed depending on
			// how much history happened to be loaded when the export ran.
			const stepNum = Number.isFinite(station.turnStep) ? station.turnStep : station.stepNo;
			const head = station.kind === "step" ? `${t("node.step")} ${station.turn ?? "?"}.${stepNum ?? "?"}` : station.kind;
			L.push(`# ${t("export.stepTitle")} · ${head}`);
			L.push("");
			const anchor = anchorOf(station);
			if (anchor !== null) { L.push(`> ${t("anchor.copy")}: \`${anchor}\``); L.push(""); }
			const evidence = evidenceOf(station.request ?? null, messages, hasMore);
			if (evidence.length > 0) {
				L.push(`> ${evidence.map((e) => `${t(`evidence.${e.level}`)}`).join(" · ")}`);
				L.push("");
			}
			const req = station.request ?? null;
			if (req != null) {
				const cfg = req.config ?? {};
				const bits = [];
				if (cfg.provider) bits.push(cfg.provider);
				if (cfg.model) bits.push(cfg.model);
				if (cfg.temperature != null) bits.push(`temp=${cfg.temperature}`);
				if (cfg.reasoningEffort) bits.push(`effort=${cfg.reasoningEffort}`);
				if (req.usage != null && req.usage.input + req.usage.output > 0) bits.push(`in=${req.usage.input} out=${req.usage.output}`);
				if (req.durationMs != null) bits.push(fmtMs(req.durationMs));
				if (bits.length > 0) { L.push(`**${t("detail.request")}**: ${bits.join(" · ")}`); L.push(""); }
				const diff = req.promptDiff ?? null;
				if (diff != null && !diff.isInitial) {
					L.push(`**${t("detail.promptDiff")}**: ${diff.kind} · ${diff.prevSystemChars} → ${diff.curSystemChars}`);
					if (diff.toolsAdded.length > 0) L.push(`- + ${diff.toolsAdded.join(", ")}`);
					if (diff.toolsRemoved.length > 0) L.push(`- - ${diff.toolsRemoved.join(", ")}`);
					if (Array.isArray(diff.toolsChanged) && diff.toolsChanged.length > 0) L.push(`- ~ ${diff.toolsChanged.join(", ")}`);
					L.push("");
					if (diff.textDiff != null) {
						const diffLines = [];
						for (const line of diff.textDiff.removed) diffLines.push(`- ${line}`);
						for (const line of diff.textDiff.added) diffLines.push(`+ ${line}`);
						L.push(...fencedBlock(diffLines.join("\n"), "diff"));
						L.push("");
					}
				}
			}
			for (const cell of station.cells ?? []) {
				if (cell.kind === "assistant") {
					if (cell.thinking) { L.push(`**💭**`); L.push(""); L.push(...fencedBlock(cell.thinking)); L.push(""); }
					if (cell.text) {
						L.push("**✍**");
						L.push("");
						// Prose is emitted raw so emphasis/lists survive, but a run of 3+
						// backticks would open a fence and swallow every following block —
						// model output that explains code does this routinely. Escaping the
						// backticks keeps the text readable and the document well-formed.
						L.push(proseSafe(cell.text));
						L.push("");
					}
				} else if (cell.kind === "tool") {
					L.push(`**🔧 ${cell.name ?? "?"}**${cell.durationMs != null ? ` _(${fmtMs(cell.durationMs)})_` : ""}`);
					if (cell.args) { L.push(""); L.push(...fencedBlock(prettyArgs(String(cell.args)) || String(cell.args), "json")); }
					if (cell.errorName) L.push(`\n> ✗ ${cell.errorName}`);
					if (cell.resultText) {
						const full = String(cell.resultText);
						// Truncate only with an explicit marker: a silently shortened result
						// would make the pack look authoritative while hiding the tail.
						L.push("");
						L.push(...fencedBlock(full.length > STEP_RESULT_LIMIT ? `${full.slice(0, STEP_RESULT_LIMIT)}\n…(${fmtInt(full.length)} ${t("detail.chars")})` : full));
					}
					// Sub-calls are part of "why did this step go wrong": keep them.
					for (const sub of cell.subCalls ?? []) {
						L.push("");
						// pushSubLines already prints the child's result line; printing it
						// again here duplicated every sub-call result in the export.
						pushSubLines(L, sub, 1);
					}
					L.push("");
				}
			}
			// Special stations (orphan tool / error / retry / max-tokens / command /
			// compaction) keep their payload on the STATION, not in `cells`. Without this
			// the "copy this step" button produced a near-empty file for six station types.
			const extras = [];
			if (station.kind === "orphan-tool") {
				if (station.name) extras.push(`**🔧 ${station.name}**`);
				if (station.args) { extras.push(""); extras.push(...fencedBlock(prettyArgs(String(station.args)) || String(station.args), "json")); }
				if (station.isError) extras.push(`\n> ✗ ${station.errorName ?? t("kpi.errors")}`);
				if (station.resultText) { extras.push(""); extras.push(...fencedBlock(station.resultText)); }
			} else if (station.kind === "error") {
				extras.push(`**${t("node.error")}**${station.code != null ? ` \`${station.code}\`` : ""}`);
				if (station.message) { extras.push(""); extras.push(...fencedBlock(station.message)); }
			} else if (station.kind === "retry") {
				extras.push(`**${t("node.retry")}** · ${numOr(station.retry)}/${numOr(station.maxRetries)}${station.provider ? ` · ${station.provider}` : ""}${station.retryState ? ` · ${station.retryState}` : ""}`);
				if (station.message) { extras.push(""); extras.push(...fencedBlock(station.message)); }
				if (station.code != null) extras.push(`> \`${station.code}\``);
			} else if (station.kind === "maxTokens") {
				extras.push(`**${t("node.maxTokens")}**`);
			} else if (station.kind === "unknown") {
				extras.push(`**${t("node.unknown")}**${station.eventType ? ` \`${station.eventType}\`` : ""}`);
				if (station.payload) { extras.push(""); extras.push(...fencedBlock(station.payload, "json")); }
			} else if (station.kind === "command") {
				extras.push(`**${t("node.command")}** \`${station.name ?? ""}${station.args ? ` ${station.args}` : ""}\``);
				if (station.outcomeText) { extras.push(""); extras.push(...fencedBlock(station.outcomeText)); }
			} else if (station.kind === "compaction") {
				extras.push(`**${t("node.compaction")}**${station.count != null ? ` · ${station.count} ${t("detail.items")}` : ""}${station.tokens != null ? ` · ${fmtTokens(station.tokens)}` : ""}`);
				if (station.summary) { extras.push(""); extras.push(proseSafe(station.summary)); }
			}
			if (extras.length > 0) { L.push(...extras); L.push(""); }
			if (Array.isArray(messages) && messages.length > 0) {
				L.push(`---`);
				L.push("");
				L.push(`## ${t("detail.requestApprox")}`);
				L.push("");
				// Full bodies, not one-line previews: the pack is meant to be read offline.
				for (const m of messages) {
					const body = String(m.text ?? "");
					L.push(`### ${m.role} (${body.length})`);
					L.push("");
					L.push(body === "" ? `_\`${JSON.stringify(m.content ?? null)}\`_` : body);
					L.push("");
				}
			}
			return L.join("\n");
		}
		/** Render the whole trace as a Markdown study note (per-step flow + request configs). */
		/**
		 * Markdown fenced block whose fence is longer than any backtick run inside.
		 *
		 * A fixed ``` fence breaks the moment the content contains one — a tool result
		 * that is literally a README (```bash … ```) closes the block early, and every
		 * heading after it ends up inside a code block or garbled. CommonMark allows
		 * fence lengths ≥3, and a fence only closes on a run of at least equal length,
		 * so choosing max(3, longestRun + 1) is both correct and minimal.
		 */
		/**
		 * Make untrusted prose safe to emit raw into the export.
		 *
		 * Prose is emitted raw so emphasis and lists survive, but two constructs in it
		 * can restructure the whole document:
		 *
		 *   - a run of 3+ backticks opens a fence and swallows every following block
		 *     (a model explaining code produces these constantly, and a stream that was
		 *     cut off mid-answer leaves an UNCLOSED one that eats the rest of the file);
		 *   - `</details>` closes the collapsible block we opened around reasoning, so
		 *     the remainder of the step renders outside its own section.
		 *
		 * Escaping only the dangerous characters keeps the text readable.
		 */
		function proseSafe(content) {
			// `String(Symbol)` throws. Prose normally IS a string, but this is the choke point
			// every text block passes through, so it must not be the one place that can take
			// the render down; `asText` also turns an object into its JSON instead of
			// "[object Object]".
			return asText(content)
				.replace(/`{3,}/g, (run) => "\\`".repeat(run.length))
				.replace(/<(\/?)(details)\b/gi, "&lt;$1$2");
		}
		function fencedBlock(content, lang) {
			const text = String(content ?? "");
			let longest = 0;
			for (const run of text.match(/`+/g) ?? []) if (run.length > longest) longest = run.length;
			const fence = "`".repeat(Math.max(3, longest + 1));
			const info = typeof lang === "string" && lang !== "" ? lang : "";
			return [fence + info, text, fence];
		}
		/**
		 * Give ids to form fields the host ships without one.
		 *
		 * DevTools audits form fields *page-wide*: the host's sidebar session search
		 * (`input.bhn1Oq_searchInput`) has neither `id` nor `name`, so every page load
		 * reports "A form field element should have an id or name attribute". We cannot
		 * edit host code, but the element is in the same document, so we can annotate it.
		 *
		 * Deliberately conservative:
		 *   - only fields with NEITHER attribute are touched (an id the host sets always wins);
		 *   - only `id` is set, never `name` — a `name` changes what the surrounding form
		 *     would submit, and the audit is satisfied by either one;
		 *   - our own inputs are skipped (they carry ids already);
		 *   - the id is namespaced and de-duplicated, so we never collide with the host.
		 * Returns the number of fields annotated, which makes it testable.
		 */
		function annotateNamelessFormFields() {
			if (typeof document === "undefined") return 0;
			let touched = 0;
			for (const el of document.querySelectorAll("input,textarea,select")) {
				if (el.closest(".dstv_root") != null) continue;
				if (el.id !== "" || el.getAttribute("name") !== null) continue;
				const slug = String(el.getAttribute("class") ?? "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
				const base = "dsh-field-" + (slug !== "" ? slug : String(el.tagName || "field").toLowerCase());
				let candidate = base;
				for (let n = 2; document.getElementById(candidate) !== null; n += 1) candidate = base + "-" + n;
				el.id = candidate;
				touched += 1;
			}
			return touched;
		}
		/**
		 * Minimal Markdown parsing for assistant bodies.
		 *
		 * The host's own `AssistantMarkdown` needs a dozen internal services
		 * (loadImage/usePresentation/renderSlot/…), so it cannot be reused here. This is
		 * the subset that actually appears in model output: headings, fences, lists,
		 * quotes, tables, rules, paragraphs, and inline code/strong/links.
		 *
		 * Produces plain descriptors only — no HTML strings anywhere, so rendering later
		 * cannot inject markup. Deliberately shallow: no nested emphasis, no HTML blocks,
		 * no reference links. Unknown syntax degrades to literal text, which is honest.
		 */
		function mdInline(src) {
			const s = String(src ?? "");
			const out = [];
			// Text is accumulated as a SLICE RANGE: `buf += c` copies the whole buffer per
			// character, which is quadratic by itself.
			let runStart = 0;
			const flush = (end) => { if (end > runStart) out.push({ t: "text", text: s.slice(runStart, end) }); };

			// Resolving each marker with a fresh indexOf rescanning to end-of-string made
			// this quadratic: 64K unclosed `[` took 221 ms and 256K took 2.6 s, and the
			// output feeds card previews on every render. Build next-occurrence tables in
			// ONE backwards pass instead; lookups are then O(1) and the whole parse is O(n).
			// A newline resets a table, because no construct here spans lines.
			const buildNext = (code) => {
				const a = new Int32Array(s.length + 1);
				a[s.length] = -1;
				let next = -1;
				for (let i = s.length - 1; i >= 0; i -= 1) {
					if (s.charCodeAt(i) === 10) { a[i] = -1; next = -1; continue; }
					a[i] = next;
					if (s.charCodeAt(i) === code) next = i;
				}
				return a;
			};
			const atBacktick = buildNext(96);   // `
			const atStar = buildNext(42);       // *
			const atBracket = buildNext(93);    // ]
			const atParen = buildNext(41);      // )

			for (let i = 0; i < s.length; ) {
				const c = s[i];
				if (c === "`") {
					const end = atBacktick[i + 1];
					if (end > i) { flush(i); out.push({ t: "code", text: s.slice(i + 1, end) }); i = end + 1; runStart = i; continue; }
				}
				if (c === "*" && s[i + 1] === "*") {
					let end = -1;
					for (let k = atStar[i + 2]; k >= 0 && k + 1 < s.length; k = atStar[k + 1]) {
						if (s[k + 1] === "*") { end = k; break; }
					}
					if (end > i + 1) { flush(i); out.push({ t: "strong", text: s.slice(i + 2, end) }); i = end + 2; runStart = i; continue; }
					i += 2;
					continue;
				}
				if (c === "[") {
					// `atBracket` yields the next `]` STRICTLY AFTER a position, so asking for
					// position i+1 skipped a `]` sitting exactly there. An empty label —
					// `[](https://x)` — is legal Markdown, and missing it did not merely lose
					// that link: the scanner carried on and the NEXT `[label](href)` paired with
					// the earlier bracket, so the rendered link read
					// "](https://x) and [说明" with someone else's href, silently swallowing the
					// text in between. Check the immediate position first.
					const close = s[i + 1] === "]" ? i + 1 : atBracket[i + 1];
					if (close > i && s[close + 1] === "(") {
						const end = atParen[close + 2];
						if (end > close) {
							flush(i);
							const label = s.slice(i + 1, close);
							const href = s.slice(close + 2, end);
							// An empty label would render `<a></a>`: an invisible, unclickable
							// element that still occupies the link styling. Show the target
							// instead, so the reader can see where it goes.
							out.push({ t: "link", text: label !== "" ? label : href, href });
							i = end + 1; runStart = i; continue;
						}
					}
					// Unmatched bracket: advance by one so the scan never restarts.
					i += 1;
					continue;
				}
				i += 1;
			}
			flush(s.length);
			return out;
		}
		/** Block-level split. Returns descriptors; see mdInline for the inline level. */
		function mdBlocks(src) {
			const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
			const blocks = [];
			let i = 0;
			while (i < lines.length) {
				const line = lines[i];
				const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
				if (fence !== null) {
					const marker = fence[1][0] === "~" ? "~" : "`";
					const need = fence[1].length;
					const lang = fence[2].trim();
					const body = [];
					i += 1;
					while (i < lines.length) {
						// The closing run must use the SAME character and be at least as long.
						const close = new RegExp("^\\s*" + (marker === "~" ? "~" : "`") + "{" + need + ",}\\s*$");
						if (close.test(lines[i])) { i += 1; break; }
						body.push(lines[i]);
						i += 1;
					}
					blocks.push({ type: "code", lang, text: body.join("\n") });
					continue;
				}
				const head = /^(#{1,6})\s+(.*)$/.exec(line);
				if (head !== null) { blocks.push({ type: "h", level: head[1].length, text: head[2].trim() }); i += 1; continue; }
				if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ type: "hr" }); i += 1; continue; }
				if (/^\s*>\s?/.test(line)) {
					const quoted = [];
					while (i < lines.length && /^\s*>\s?/.test(lines[i])) { quoted.push(lines[i].replace(/^\s*>\s?/, "")); i += 1; }
					blocks.push({ type: "quote", lines: quoted });
					continue;
				}
				// Table: a header row followed by a |---|---| separator.
				if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
					// `\|` is the escape for a literal pipe inside a cell — the only way to
					// put one in a table at all. Splitting on every `|` cut such a cell in
					// two, so `| a \| b | c |` became THREE columns ("a \", "b", "c") and
					// every cell after the escape shifted one column left under the header.
					const cells = (l) => {
						const body = l.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
						const out = [];
						let cur = "";
						for (let k = 0; k < body.length; k += 1) {
							const ch = body[k];
							if (ch === "\\" && body[k + 1] === "|") { cur += "|"; k += 1; continue; }
							if (ch === "|") { out.push(cur.trim()); cur = ""; continue; }
							cur += ch;
						}
						out.push(cur.trim());
						return out;
					};
					const header = cells(line);
					i += 2;
					const rows = [];
					while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i += 1; }
					blocks.push({ type: "table", head: header, rows });
					continue;
				}
				const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
				if (li !== null) {
					const ordered = /\d/.test(li[2]);
					// Keep the starting number: "7. Resume / 8. Verify" must render as 7,8 —
					// an <ol> defaults to 1, which silently renumbered the list.
					const startAt = ordered ? parseInt(li[2], 10) : 1;
					const items = [];
					while (i < lines.length) {
						const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
						// A different list marker starts a NEW list: "7. a / - b" was parsed as
						// one ordered list with two items, renumbering the bullet to 8.
						if (m !== null && (/\d/.test(m[2])) !== ordered) break;
						if (m === null) {
							// A lazy continuation line belongs to the previous item — but a fence
							// opener or closer ends the list. Swallowing it turned a code block
							// after a list into list prose ("const x=1" became an <li>).
							const isFence = /^\s*(`{3,}|~{3,})/.test(lines[i]);
							if (!isFence && items.length > 0 && !/^\s*$/.test(lines[i]) && !/^\s*#{1,6}\s/.test(lines[i])) { items[items.length - 1].push(lines[i].trim()); i += 1; continue; }
							break;
						}
						items.push([m[3]]);
						i += 1;
					}
					blocks.push(ordered ? { type: "ol", items, start: Number.isFinite(startAt) && startAt > 1 ? startAt : 1 } : { type: "ul", items });
					continue;
				}
				if (/^\s*$/.test(line)) { i += 1; continue; }
				const para = [];
				while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(`{3,}|#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/.test(lines[i])) {
					para.push(lines[i]);
					i += 1;
				}
				if (para.length === 0) { para.push(lines[i]); i += 1; }
				blocks.push({ type: "p", text: para.join("\n") });
			}
			return blocks;
		}
		/** Markdown with markers stripped, for one-line previews. */
		function markdownToPlain(src) {
			let out = "";
			for (const part of mdInline(src)) out += part.text;
			return out;
		}
		function buildTraceMarkdown(tree, t) {
			const L = [];
			L.push(`# ${t("export.title")}`);
			L.push("");
			const s = tree.stats;
			L.push(`> ${t("node.turn")} ${s.turns} · ${t("node.step")} ${s.steps} · ${t("node.tool")} ${s.tools} · ${t("kpi.errors")} ${s.errors} · ${t("kpi.tokensIn")} ${fmtTokens(s.tokensIn)} · ${t("kpi.tokensOut")} ${fmtTokens(s.tokensOut)}${s.lastModel ? ` · ${s.lastModel}` : ""}`);
			// The panel warns about a damaged or drifting log in its header; the export used
			// to state only the totals, so a saved "study notes" file silently claimed a
			// clean read of a log the screen was actively flagging. Same rule as the error
			// code / retry metadata: the file must carry what the panel shows.
			{
				const warns = [];
				if (tree.contract != null && tree.contract.ok !== true) warns.push(t("view.malformed").replace("{n}", String((tree.contract.problems ?? []).length)));
				if (tree.nodeStats != null && tree.nodeStats.unknown > 0) warns.push(t("view.drift").replace("{n}", String(tree.nodeStats.unknown)));
				if (tree.nodeStats != null && tree.nodeStats.invalid > 0) warns.push(t("view.invalid").replace("{n}", String(tree.nodeStats.invalid)));
				if (tree.unplacedRequests > 0) warns.push(t("view.unplacedReq").replace("{n}", String(tree.unplacedRequests)));
				if (warns.length > 0) { L.push(""); L.push(`> ⚠ ${warns.join(" · ")}`); }
			}
			let firstPrompt = null;
			const reqLine = (st) => {
				const r = st.request;
				if (r == null) return null;
				const cfg = r.config ?? {};
				const bits = [];
				if (cfg.provider) bits.push(cfg.provider);
				if (cfg.model) bits.push(cfg.model);
				if (cfg.temperature != null) bits.push(`temp=${cfg.temperature}`);
				if (cfg.reasoningEffort) bits.push(`effort=${cfg.reasoningEffort}`);
				if (r.usage !== null && r.usage.input + r.usage.output > 0) bits.push(`in=${r.usage.input} out=${r.usage.output}`);
				if (r.durationMs != null) bits.push(fmtMs(r.durationMs));
				return bits.length > 0 ? bits.join(" · ") : null;
			};
			for (const st of tree.stations) {
				if (st.tag !== void 0 && st.tag !== null) { L.push(""); L.push(`## ${st.tag}`); }
				L.push("");
				if (st.kind === "user") {
					L.push(`### 👤 ${st.who}`);
					L.push("");
					L.push(st.text !== "" ? proseSafe(st.text) : "…");
				} else if (st.kind === "step") {
					L.push(`### 🤖 ${st.label} _(${st.detail})_`);
					if (st.meta.length > 0) { L.push(""); L.push(`_${st.meta.join(" · ")}_`); }
					const rl = reqLine(st);
					if (rl !== null) { L.push(""); L.push(`> 📨 ${rl}`); }
					if (st.request?.prompt != null && firstPrompt === null) firstPrompt = st.request.prompt;
					for (const cell of st.cells) {
						if (cell.kind === "assistant") {
							if (cell.thinking !== "") { L.push(""); L.push(`<details><summary>💭 ${t("chip.thinking")} (${cell.thinking.length})</summary>`); L.push(""); L.push(proseSafe(cell.thinking)); L.push("</details>"); }
							if (cell.text !== "") { L.push(""); L.push(proseSafe(cell.text)); }
						} else if (cell.kind === "tool") {
							L.push("");
							L.push(`#### ${cell.isError ? "✗" : "✓"} 🔧 ${cell.name}${cell.durationMs != null ? ` _(${fmtMs(cell.durationMs)})_` : ""}`);
							if (cell.args !== "") { L.push(""); L.push(...fencedBlock(prettyArgs(cell.args) || cell.args, "json")); }
							if (cell.resultText !== "") { L.push(""); L.push(`**${t("detail.result")}**`); L.push(""); L.push(...fencedBlock(cell.resultText.length > 4000 ? `${cell.resultText.slice(0, 4000)}\n…(${fmtInt(cell.resultText.length)} ${t("detail.chars")})` : cell.resultText)); }
							for (const sub of cell.subCalls) {
								L.push("");
								pushSubLines(L, sub, 1);
							}
						}
					}
				} else if (st.kind === "orphan-tool") {
					L.push(`### ⤷ ${t("node.orphanTool")} · ${st.name}`);
					L.push("");
					L.push(`_${t("orphan.badge")} · ${anchorOf(st) ?? "—"}_`);
					if (st.args !== "") { L.push(""); L.push(...fencedBlock(prettyArgs(st.args) || st.args, "json")); }
					if (st.displayText !== "") { L.push(""); L.push(...fencedBlock(st.displayText.length > 4000 ? `${st.displayText.slice(0, 4000)}\n…(${fmtInt(st.displayText.length)} ${t("detail.chars")})` : st.displayText)); }
				} else if (st.kind === "compaction") {
					L.push(`### ♺ ${st.label}${Number.isSafeInteger(st.count) ? ` _(${numOr(st.count)} ${t("meta.steps")} / ${fmtTokens(st.tokens)} ${t("meta.tokens")})_` : ""}`);
					if (st.summary !== "") { L.push(""); L.push(st.summary); }
					if (st.crequest?.outputText) { L.push(""); L.push(`<details><summary>${t("detail.compactionOutput")}</summary>`); L.push(""); L.push(st.crequest.outputText); L.push("</details>"); }
				} else if (st.kind === "error") {
					L.push(`### ✗ ${st.label}${st.code != null ? ` \`${st.code}\`` : ""}`);
					L.push(""); L.push(st.message || "…");
				} else if (st.kind === "retry") {
					// The detail panel shows the retry counter, the provider and the error
					// code; the export showed none of them, so the Markdown copy of a failed
					// step was strictly less useful than the screen it was copied from —
					// "which retry failed, and with what code" is exactly what a reader
					// pastes into a bug report.
					const retryBits = [];
					if (Number.isFinite(st.retry)) retryBits.push(`#${numOr(st.retry)}${Number.isSafeInteger(st.maxRetries) ? `/${numOr(st.maxRetries)}` : ""}`);
					if (st.provider) retryBits.push(String(st.provider));
					if (st.code != null) retryBits.push(`code: ${st.code}`);
					if (st.retryState) retryBits.push(String(st.retryState));
					L.push(`### ↻ ${st.label}${retryBits.length > 0 ? ` (${retryBits.join(" · ")})` : ""}`);
					if (st.message) { L.push(""); L.push(st.message); }
				} else if (st.kind === "maxTokens") {
					L.push(`### ⛔ ${st.label}`);
				} else if (st.kind === "command") {
					L.push(`### ⚡ /${st.name}${st.args !== "" ? ` ${st.args}` : ""}`);
					if (st.outcomeText) { L.push(""); L.push(st.outcomeText); }
				} else if (st.kind === "unknown") {
					L.push(`### ? ${t("node.unknown")}${st.eventType ? ` \`${st.eventType}\`` : ""}`);
					if (st.payload) { L.push(""); L.push(...fencedBlock(st.payload, "json")); }
				}
			}
			if (firstPrompt !== null) {
				L.push("");
				L.push("---");
				L.push("");
				L.push(`## ${t("export.appendix")}`);
				L.push("");
				L.push(`<details><summary>🧠 ${t("detail.systemPrompt")} (${fmtInt(firstPrompt.systemChars)} ${t("detail.chars")})</summary>`);
				L.push("");
				L.push(...fencedBlock(firstPrompt.system));
				L.push("</details>");
				// The request tab renders this catalog through `safeToolList`; the export path
				// read the RAW array and crashed on a `null` hole (`Cannot read properties of
				// null (reading 'name')`), so clicking "copy whole trace" produced nothing at
				// all. Use the same normalizer here.
				const exportTools = safeToolList(firstPrompt.tools);
				if (exportTools.length > 0) {
					L.push("");
					L.push(`**${t("detail.toolsCatalog")} (${exportTools.length})**: ${exportTools.map((tool) => `\`${tool.name}\``).join(" ")}`);
				}
			}
			L.push("");
			return L.join("\n");
		}
		/** T2: upper bound for a clock-scaled idle band, so one huge pause cannot dominate the rail. */
		const GAP_MAX_PX = 220;
		/**
		 * T2: width in px for one idle band under clock mode. Log-scaled so a 10x longer
		 * pause does not take 10x the room, and capped so one huge pause cannot dominate
		 * the rail. Returns null when clock mode is off (band keeps its natural width).
		 */
		function clockGapWidth(gapMs, clockAxisOn) {
			if (clockAxisOn !== true) return null;
			if (!Number.isFinite(gapMs) || gapMs <= 0) return null;
			// base 10 / coeff 15 over log2(seconds): 30s≈84px, 5m≈134px, 1h≈187px,
			// reaching the 220px cap only past ~4h. A steeper curve saturates by 5m
			// and loses all discrimination inside the range that actually occurs.
			const px = 10 + Math.log2(1 + gapMs / 1000) * 15;
			return `${Math.min(GAP_MAX_PX, Math.round(px))}px`;
		}
		//#endregion
