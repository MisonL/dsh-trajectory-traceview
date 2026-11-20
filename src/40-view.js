		//#region horizontal timeline + replay component
		const EMPTY_SNAPSHOT = { eventNodes: [], runningCalls: [], partial: null };
		const SPEEDS_MS = [1500, 750, 375];
		const SPEED_LABELS = ["×1", "×2", "×4"];
		const STATION_W = 264;
		/** G4-T3: gaps shorter than this are normal scheduling noise, not an idle pause. */
		const GAP_MIN_MS = 30_000;
		/** G2: bound on back-paging while chasing an anchor, and on waiting for the re-projection. */
		const ANCHOR_MAX_PAGES = 40;
		const ANCHOR_REVEAL_TRIES = 12;
		const ANCHOR_REVEAL_MS = 250;

		/** Tool glyphs by tool name (fallback wrench). */
		function toolGlyph(name) {
			const n = String(name ?? "").toLowerCase();
			if (n.includes("pwsh") || n.includes("bash") || n.includes("shell") || n.includes("terminal") || n.includes("code_runtime") || n.includes("run_code")) return "⌨";
			if (n.includes("read") || n.includes("view") || n.includes("cat")) return "📄";
			if (n.includes("write") || n.includes("edit") || n.includes("str-replace") || n.includes("insert")) return "✎";
			if (n.includes("grep") || n.includes("glob") || n.includes("find") || n.includes("search")) return "🔍";
			if (n.includes("web") || n.includes("http")) return "🌐";
			if (n.includes("todo")) return "☑";
			if (n.includes("subagent") || n.includes("fork")) return "🤖";
			if (n.includes("workflow")) return "⚙";
			if (n.includes("goal")) return "🎯";
			if (n.includes("skill")) return "✨";
			if (n.includes("ask")) return "❓";
			return "🔧";
		}

		/** Copy `text` to the clipboard; finish(ok) reports success. */
		function copyText(text, finish) {
			try {
				if (typeof navigator !== "undefined" && typeof navigator.clipboard !== "undefined" && typeof navigator.clipboard.writeText === "function") {
					navigator.clipboard.writeText(text).then(() => finish(true), () => finish(false));
					return;
				}
			} catch { /* fall through */ }
			// Legacy fallback. This is the ONLY path on plain http:// (where
			// `navigator.clipboard` does not exist), i.e. the common case — so its side
			// effects matter:
			//   - `ta.select()` moves focus into the textarea. When the textarea is removed
			//     the focused element is gone and focus falls back to <body>, so every copy
			//     threw a keyboard or screen-reader user back to the top of the document.
			//   - An editable textarea that takes focus pops the on-screen keyboard on iOS,
			//     so copying raised a keyboard that then had nothing to type into.
			// `readonly` suppresses both; the element is restored and focus returned.
			try {
				const prev = typeof document.activeElement !== "undefined" ? document.activeElement : null;
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.setAttribute("readonly", "");
				ta.setAttribute("aria-hidden", "true");
				ta.setAttribute("tabindex", "-1");
				ta.style.position = "fixed";
				ta.style.top = "0";
				ta.style.left = "0";
				ta.style.opacity = "0";
				ta.style.pointerEvents = "none";
				document.body.appendChild(ta);
				ta.select();
				const ok = document.execCommand("copy");
				document.body.removeChild(ta);
				// Return focus where it was. `preventScroll` keeps the timeline from
				// jumping while we restore it.
				if (prev !== null && typeof prev.focus === "function") {
					try { prev.focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
				}
				finish(ok);
			} catch { finish(false); }
		}

		/**
		 * Render Markdown descriptors as React elements.
		 *
		 * Everything is built from `jsx`/`jsxs` and plain strings: no `innerHTML`, no
		 * `dangerouslySetInnerHTML`, so model output can never become markup. Links get
		 * `rel="noreferrer noopener"` because the target came from the transcript.
		 */
		/**
		 * Allowlist for links taken from the transcript. `http(s)` and `mailto` are inert;
		 * angle-bracket-free relative URLs are allowed too. Everything else — notably
		 * `javascript:` and `vbscript:` — returns null so the caller renders text instead.
		 * The check is done on a whitespace/control-stripped, lowercased copy, because
		 * `java\nscript:` and leading spaces are the usual bypasses.
		 */
		function safeHref(raw) {
			const s = String(raw ?? "").replace(/[\u0000-\u0020\u007f]+/g, "");
			if (s === "") return null;
			// A bare relative reference has no scheme at all.
			if (/^[#/?]/.test(s)) return raw;
			const m = /^([a-z][a-z0-9+.-]*):/i.exec(s);
			if (m === null) return raw;
			const scheme = m[1].toLowerCase();
			return scheme === "http" || scheme === "https" || scheme === "mailto" ? raw : null;
		}
		function renderMdInline(parts, keyBase) {
			return parts.map((p, i) => {
				const k = keyBase + "i" + i;
				if (p.t === "code") return jsx("code", { className: "dstv_mdCode", children: p.text }, k);
				if (p.t === "strong") return jsx("strong", { className: "dstv_mdBold", children: p.text }, k);
				if (p.t === "link") {
					// The href comes from MODEL OUTPUT. React does not sanitise URLs, so a
					// `javascript:` or `vbscript:` link was rendered into the DOM verbatim and
					// ran on click. Allow only inert schemes; anything else degrades to text
					// (never to a guessed "safe" URL).
					const href = safeHref(p.href);
					if (href === null) return jsx("span", { className: "dstv_mdLinkBlocked", children: p.text }, k);
					return jsx("a", { className: "dstv_mdLink", href, target: "_blank", rel: "noreferrer noopener", children: p.text }, k);
				}
				return p.text;
			});
		}
		function MarkdownText({ text }) {
			const blocks = (0, react.useMemo)(() => mdBlocks(text), [text]);
			const nodes = blocks.map((b, i) => {
				const k = "md" + i;
				if (b.type === "h") {
					const tag = "h" + Math.min(6, Math.max(1, b.level));
					return jsx(tag, { className: "dstv_mdH dstv_mdH" + b.level, children: renderMdInline(mdInline(b.text), k) }, k);
				}
				if (b.type === "code") {
					return jsxs("div", { className: "dstv_mdFence", children: [
						b.lang !== "" ? jsx("span", { className: "dstv_mdLang", children: b.lang }, k + "L") : null,
						jsx("pre", { className: "dstv_mdPre", children: jsx("code", { children: b.text }, k + "C") }, k + "P")
					] }, k);
				}
				if (b.type === "ul" || b.type === "ol") {
					const tag = b.type === "ul" ? "ul" : "ol";
					// Carry the start number through to the element; without it an <ol>
					// renumbers from 1 and "7. Resume" silently became "1. Resume".
					const listProps = { className: "dstv_mdList", children: b.items.map((it, j) => jsx("li", { children: renderMdInline(mdInline(it.join(" ")), k + "j" + j) }, k + "j" + j)) };
					if (b.type === "ol" && Number.isFinite(b.start) && b.start > 1) listProps.start = b.start;
					return jsx(tag, listProps, k);
				}
				if (b.type === "quote") {
					return jsx("blockquote", { className: "dstv_mdQuote", children: renderMdInline(mdInline(b.lines.join("\n")), k) }, k);
				}
				if (b.type === "table") {
					return jsxs("table", { className: "dstv_mdTable", children: [
						jsx("thead", { children: jsx("tr", { children: b.head.map((c, j) => jsx("th", { children: renderMdInline(mdInline(c), k + "h" + j) }, k + "h" + j)) }, k + "hr") }, k + "hd"),
						jsx("tbody", { children: b.rows.map((row, r) => jsx("tr", { children: row.map((c, j) => jsx("td", { children: renderMdInline(mdInline(c), k + "r" + r + "c" + j) }, k + "r" + r + "c" + j)) }, k + "r" + r)) }, k + "bd")
					] }, k);
				}
				if (b.type === "hr") return jsx("hr", { className: "dstv_mdHr" }, k);
				return jsx("p", { className: "dstv_mdP", children: renderMdInline(mdInline(b.text), k) }, k);
			});
			if (nodes.length === 0) return null;
			return jsx("div", { className: "dstv_md", children: nodes }, "mdRoot");
		}
		/** Small inline copy button with transient feedback. */
		function CopyBtn({ text, label, okLabel, failLabel }) {
			// Three states, not two. A failed copy used to return silently: the button
			// never changed, so the click looked ignored and the user pasted whatever was
			// in the clipboard from before. `navigator.clipboard` is unavailable on plain
			// http:// (non-secure context) and `execCommand` can refuse too, so failure is
			// a normal outcome that has to be visible.
			const [copyState, setCopyState] = (0, react.useState)("idle");
			// Only one feedback timer may be pending. Clicking twice within the window
			// started a SECOND timer without cancelling the first, so the earlier one
			// fired first and cleared the state the newer click had just set — the button
			// reverted to its idle label and the second copy looked ignored, which is
			// exactly the confusion this three-state feedback exists to prevent.
			const resetRef = (0, react.useRef)(null);
			const doCopy = () => {
				copyText(text, (ok) => {
					setCopyState(ok ? "ok" : "fail");
					if (resetRef.current !== null) clearTimeout(resetRef.current);
					resetRef.current = setTimeout(() => { resetRef.current = null; setCopyState("idle"); }, 1400);
				});
			};
			(0, react.useEffect)(() => () => {
				if (resetRef.current !== null) { clearTimeout(resetRef.current); resetRef.current = null; }
			}, []);
			return jsx("button", {
				type: "button",
				className: "dstv_copyBtn",
				"data-ok": copyState === "ok" ? "true" : undefined,
				"data-fail": copyState === "fail" ? "true" : undefined,
				onClick: (ev) => { ev.stopPropagation(); doCopy(); },
				// `failLabel` arrives as a prop: this is a module-level component and `t`
				// is NOT in its scope — calling it here threw ReferenceError, but only
				// when a copy actually failed, which no test could reach.
				children: copyState === "ok" ? `✓ ${okLabel}` : copyState === "fail" ? `✗ ${failLabel ?? "!"}` : label
			});
		}

		/**
		 * One bad station must not take the whole view down. A read-only review tool
		 * that blanks out because a single field had an unexpected shape is worse than
		 * the crash itself: the session is still there, the reader just cannot see it.
		 *
		 * `render` is CALLED INSIDE the boundary (not passed as an already-built
		 * element) — an eagerly built element throws in the parent render, where no
		 * boundary can catch it.
		 */
		class RenderBoundary extends (react.Component ?? class {}) {
			constructor(props) {
				super(props);
				this.state = { err: null };
				this.retry = () => this.setState({ err: null });
			}
			static getDerivedStateFromError(err) { return { err }; }
			render() {
				if (this.state.err !== null) {
					const msg = String((this.state.err && this.state.err.message) || this.state.err).slice(0, 240);
					return jsxs("div", { className: `dstv_boundary${this.props.wide === true ? " detail" : ""}`, children: [
						jsx("span", { className: "dstv_name", children: `⚠ ${this.props.label}` }, "bName"),
						jsx("div", { className: "dstv_text sec", children: msg }, "bMsg"),
						jsx("div", { className: "dstv_text sec", children: this.props.hint }, "bHint"),
						jsx("button", { type: "button", className: "dstv_btn", onClick: this.retry, children: this.props.retryLabel }, "bRetry")
					] });
				}
				return this.props.render();
			}
		}

		/** Trace view tab: horizontal timeline with replay transport, minimap, search,
		 *  follow mode, and a bottom panel showing step details incl. the raw request
		 *  sent to the model. Honors the conversation `inspect` deep-link (chat tool
		 *  click → locate the station owning that call) and `loadOlder` history. */
		function TraceMapView({ useSession, useTrajectory, t, viewRequest, completeViewRequest, loadOlder, sessionKey }) {
			const scrollerRef = (0, react.useRef)(null);
			const minimapRef = (0, react.useRef)(null);
			const searchRef = (0, react.useRef)(null);
			const initDone = (0, react.useRef)(false);
			// Which session this panel is showing. The host reuses one component instance
			// across conversation switches, so every piece of local UI state below (replay
			// position, search text, selected tab, follow mode) survived the switch and was
			// applied to a completely different transcript. `sessionKey` arrives from the
			// slot's `inject`; when the host does not provide one, behaviour is unchanged.
			const sessionRef = (0, react.useRef)(sessionKey);
			// useState order matters (render-repro forces slot 4 = tab): keep these four first.
			const [revealed, setRevealed] = (0, react.useState)(null); // null = overview (everything shown)
			const [playing, setPlaying] = (0, react.useState)(false);
			const [speedIdx, setSpeedIdx] = (0, react.useState)(0);
			const [tab, setTab] = (0, react.useState)("detail");
			const [queryRaw, setQueryRaw] = (0, react.useState)("");
			// -1 means "no match is current". The old 0 made the counter read "1/3" the
			// moment the reader typed a query — while the timeline had not moved at all —
			// and then the FIRST "next" went to match 2, so match 1 was only reachable by
			// wrapping all the way round.
			const [matchPtr, setMatchPtr] = (0, react.useState)(-1);
			const [follow, setFollow] = (0, react.useState)(true);
			const [panelFull, setPanelFull] = (0, react.useState)(false);
			const [anchorNote, setAnchorNote] = (0, react.useState)(null);
			const [clockAxis, setClockAxis] = (0, react.useState)(false);
			const [olderBusy, setOlderBusy] = (0, react.useState)(false);
			const [olderNote, setOlderNote] = (0, react.useState)(null);
			const [exportState, setExportState] = (0, react.useState)("idle");
			// One pending feedback timer for the export button (see doExport).
			const exportResetRef = (0, react.useRef)(null);
			const [anchorInput, setAnchorInput] = (0, react.useState)("");
			const [hash, setHash] = (0, react.useState)(() => (typeof location !== "undefined" ? location.hash : ""));
			/**
			 * Height of the host's floating composer that covers the bottom of our view.
			 * The composer is a sticky, z-index:7 overlay inside the conversation area, so
			 * our panel scrolls underneath it and the last rows become unreadable. Measure
			 * it at runtime instead of guessing a constant: its height changes with the
			 * input's line count and with the window width.
			 */
			const [composerH, setComposerH] = (0, react.useState)(0);
			/**
			 * Horizontal position of the replay marker, measured from the active station
			 * element rather than computed.
			 *
			 * The old formula `26 + (R-1)*STATION_W + STATION_W/2` assumed stations are
			 * 264px wide with no gaps. They are not: each station carries `padding:0 2px`,
			 * and idle bands of varying width sit between stations, so the marker drifted
			 * left by a growing amount and pointed at the PREVIOUS card (user reported
			 * "I picked step 66, it points at step 65"). Measuring the real element cannot
			 * drift, whatever the layout does later.
			 */
			const [playheadLeft, setPlayheadLeft] = (0, react.useState)(null);

			const snap = useTrajectory === void 0 ? EMPTY_SNAPSHOT : useTrajectory((v) => v ?? EMPTY_SNAPSHOT);
			const hasMore = useSession((s) => s.hasMore === true);
			const loadingOlder = useSession((s) => s.loadingOlder === true);
			// The session reports `openState: "loading"` while its log is still being read
			// (host enum: loading | open | error). Without it, a cold open renders the
			// "no trajectory data yet" copy for a second or two — a false statement the
			// user reads as "this session has nothing".
			const sessionLoading = useSession((s) => s.openState === "loading");
			// Live text still has to arrive, so `partial` is read through a ref and the
			// rebuild is driven by a coarse tick instead of by every token. The memo key
			// is the history slices plus "which step is streaming" — all of which change
			// only when the tree actually has to change.
			const streaming = snap.partial != null;
			const partialSig = streaming ? `${snap.partial.turn ?? 0}:${snap.partial.step ?? 0}` : "";
			const partialRef = (0, react.useRef)(null);
			partialRef.current = snap.partial;
			const [streamTick, setStreamTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				if (!streaming) return void 0;
				// Rebuilding the whole tree while the tab is hidden burns CPU for a
				// document nobody is looking at. The next tick after returning refreshes
				// it anyway, so skipping hidden ticks loses nothing visible.
				const id = setInterval(() => {
					if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
					setStreamTick((v) => v + 1);
				}, STREAM_REBUILD_MS);
				return () => clearInterval(id);
			}, [streaming, partialSig]);
			const tree = (0, react.useMemo)(
				() => deriveTraceTree({
					eventNodes: snap.eventNodes,
					requests: snap.requests,
					callSchemas: snap.callSchemas,
					runningCalls: snap.runningCalls,
					partial: partialRef.current
				}, t),
				[snap.eventNodes, snap.requests, snap.callSchemas, snap.runningCalls, partialSig, streamTick, t]
			);
			const stations = tree.stations;
			const stationsRef = (0, react.useRef)(stations);
			stationsRef.current = stations;
			const hasMoreRef = (0, react.useRef)(hasMore);
			hasMoreRef.current = hasMore;
			const N = stations.length;
			const R = revealed === null ? N : Math.min(Math.max(1, revealed), N);
			const stats = tree.stats;
			const live = tree.currentStepNo !== null;

			const speedMs = SPEEDS_MS[speedIdx] ?? SPEEDS_MS[0];

			// Replay engine: advance the playhead while playing.
			(0, react.useEffect)(() => {
				if (!playing) return undefined;
				// Same reasoning as the streaming tick: replay is a visual animation, so
				// advancing it in a hidden tab only spends CPU. Playback resumes from the
				// same position when the tab becomes visible again.
				const id = setInterval(() => {
					if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
					setRevealed((r) => (r === null ? N : Math.min(r, N) + 1));
				}, speedMs);
				return () => clearInterval(id);
			}, [playing, speedMs, N]);

			// Reset per-session UI state when the conversation changes. Runs only on an
			// actual identity change, so mounting with a key already set is a no-op.
			(0, react.useEffect)(() => {
				const prev = sessionRef.current;
				sessionRef.current = sessionKey;
				if (prev === void 0 || sessionKey === void 0) return;
				if (prev === sessionKey) return;
				setPlaying(false);
				setFollow(true);
				setRevealed(null);      // overview: show the whole new transcript
				setQueryRaw("");
				setMatchPtr(0);
				setOlderNote(null);
				setPanelFull(false);
				setTab("detail");
			}, [sessionKey]);

			// Drop the export feedback timer with the panel, so a pending reset cannot fire
			// against a component that no longer exists.
			(0, react.useEffect)(() => () => {
				if (exportResetRef.current !== null) { clearTimeout(exportResetRef.current); exportResetRef.current = null; }
			}, []);

			// Stop at the end.
			(0, react.useEffect)(() => {
				if (playing && R >= N) {
					setPlaying(false);
					setRevealed(null);
				}
			}, [R, playing, N]);

			// Center the active station — scroll ONLY our own scroller (never outer ancestors).
			/**
			 * "No motion" is a stated preference, not a cosmetic nit: replay auto-scroll
			 * and smooth centering are exactly the kind of movement it exists to stop.
			 * CSS alone cannot reach `scrollTo({behavior:"smooth"})`, so honour it here too.
			 */
			const reduceMotion = () => {
				try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
			};
			// Measure the active station and place the marker over it. Runs after every
			// render that can move it (selection, resize, history paging) and on scroll
			// container resize, because offsets are relative to the flow element.
			(0, react.useEffect)(() => {
				if (revealed === null) { setPlayheadLeft(null); return undefined; }
				const measureHead = () => {
					const sc = scrollerRef.current;
					if (sc === null) return;
					const el = sc.querySelector(`[data-station-idx="${String(R - 1)}"]`);
					if (el === null) return;
					// offsetLeft is relative to the offsetParent (.dstv_hflow), which is the
					// same coordinate space the absolutely positioned marker uses.
					const docLeft = el.offsetLeft + el.offsetWidth / 2;
					if (Number.isFinite(docLeft)) setPlayheadLeft(docLeft);
				};
				measureHead();
				window.addEventListener("resize", measureHead);
				return () => window.removeEventListener("resize", measureHead);
			}, [revealed, R, N]);

			/**
			 * Keep the active minimap tick inside the strip.
			 *
			 * The strip needs ~5px per station, so a long session cannot fit it (3,600
			 * stations = ~18,000px). It scrolls instead of dragging the panel sideways —
			 * but a scrolling strip that never follows the playhead shows only the OLDEST
			 * stations, so the "where am I" marker is permanently off-screen while the
			 * user steps forward. Scroll the strip to the active tick, and only the strip:
			 * `scrollIntoView` on an inner element also moves outer ancestors.
			 */
			const revealTick = (idx) => {
				const mm = minimapRef.current;
				if (mm === null) return;
				const el = mm.querySelector(`[data-tick-idx="${String(idx)}"]`);
				if (el === null) return;
				if (mm.scrollWidth <= mm.clientWidth + 1) return; // strip fits; nothing to do
				const want = el.offsetLeft + el.offsetWidth / 2 - mm.clientWidth / 2;
				const target = Math.max(0, Math.min(mm.scrollWidth - mm.clientWidth, want));
				if (Math.abs(mm.scrollLeft - target) < 2) return;
				mm.scrollLeft = target;
			};
			(0, react.useEffect)(() => {
				if (revealed === null) return;
				revealTick(R - 1);
			}, [revealed, R, N]);

			const centerStation = (idx) => {
				const sc = scrollerRef.current;
				if (sc === null) return;
				const el = sc.querySelector(`[data-station-idx="${String(idx)}"]`);
				if (el === null || typeof el.getBoundingClientRect !== "function") return;
				const rect = el.getBoundingClientRect();
				const srect = sc.getBoundingClientRect();
				const target = Math.max(0, rect.left - srect.left + sc.scrollLeft + el.offsetWidth / 2 - sc.clientWidth / 2);
				if (typeof sc.scrollTo === "function") {
					try { sc.scrollTo({ left: target, behavior: reduceMotion() ? "auto" : "smooth" }); } catch { sc.scrollLeft = target; }
				} else {
					sc.scrollLeft = target;
				}
			};

			(0, react.useEffect)(() => {
				if (revealed === null) return;
				// Under "reduce motion" an auto-scrolling replay is a position jump every
				// tick — the exact movement the preference exists to stop. Keep the selected
				// station in view only when the user is driving (follow), otherwise let
				// replay advance without the viewport chasing it.
				if (playing === true && reduceMotion() && follow !== true) return;
				centerStation(R - 1);
			}, [R, revealed]);

			// First landing: if the AI is mid-flight, land on its current station.
			(0, react.useEffect)(() => {
				if (initDone.current || N === 0) return;
				initDone.current = true;
				const li = stations.findIndex((s) => s.kind === "step" && s.live === true);
				if (li >= 0) setRevealed(li + 1);
			}, [N, stations]);

			/**
			 * Move the roving focus to a station: select it, scroll it into view and put
			 * the DOM focus there so the next ArrowRight continues from it.
			 */
			const focusStation = (i) => {
				seek(i);
				const sc = scrollerRef.current;
				if (sc === null) return;
				const el = sc.querySelector(`[data-station-idx="${String(i)}"]`);
				if (el === null) return;
				if (typeof el.focus === "function") { try { el.focus({ preventScroll: true }); } catch { el.focus(); } }
				centerStation(i);
			};
			const seek = (i) => {
				setPlaying(false);
				setFollow(false);
				setRevealed(Math.min(N, Math.max(1, i + 1)));
			};
			const toStart = () => {
				if (N === 0) return;
				setPlaying(false);
				setFollow(false);
				setRevealed(1);
			};
			// The two directions must treat the OVERVIEW state symmetrically. `revealed`
			// is null there (everything is shown, nothing selected) and `R` reads as N, so
			// the old bodies behaved completely differently on the state the reader is in
			// when the tab first opens:
			//   →  `R < N` is false → `setRevealed(null)` → still null → THE KEY DID NOTHING
			//   ←  `R > 1` is true   → jumped to station N-1, skipping the newest one
			// The hint says "← → 逐站", so the first thing a new reader tries is →, and it
			// was inert on every session. Overview means "past the end": → restarts at the
			// first station (exactly what the play button does), ← starts from the last.
			const stepPrev = () => {
				setPlaying(false);
				setFollow(false);
				if (revealed === null) { if (N > 0) setRevealed(N); return; }
				if (R > 1) setRevealed(R - 1);
			};
			const stepNext = () => {
				setPlaying(false);
				setFollow(false);
				if (revealed === null) { if (N > 0) setRevealed(1); return; }
				if (R < N) setRevealed(R + 1);
				else setRevealed(null);
			};
			const toEnd = () => {
				setPlaying(false);
				setFollow(true);
				setRevealed(null);
			};
			const togglePlay = () => {
				if (N === 0) return;
				if (playing) { setPlaying(false); return; }
				setFollow(false);
				const cur = revealed === null ? N : Math.min(revealed, N);
				if (cur >= N) setRevealed(1);
				setPlaying(true);
			};
			const cycleSpeed = () => setSpeedIdx((i) => (i + 1) % SPEEDS_MS.length);

			const locateCurrent = () => {
				const li = stations.findIndex((s) => s.kind === "step" && s.live === true);
				if (li < 0 || scrollerRef.current === null) return;
				setPlaying(false);
				setRevealed(li + 1);
			};

			// ── chat → trace deep link: reveal the station owning inspect.callId ──
			// ── anchor deep links (§4.4) ─────────────────────────────────────────
			// Two entry points: the official `viewRequest.focus` handed to views by
			// conversation.view, and our own `#tvp1:...` hash. Both funnel into
			// resolveAnchorInStations; synthetic hits are reported, never silently
			// redirected.
			const focusAnchor = viewRequest != null && typeof viewRequest.focus === "string" ? viewRequest.focus : null;
			let decodedHashAnchor = null;
			try { decodedHashAnchor = typeof location !== "undefined" && location.hash !== "" ? decodeURIComponent(location.hash.replace(/^#/, "")) : null; } catch { decodedHashAnchor = null; }
			// `hash` is read through state so a hashchange re-runs this whole block.
			const hashAnchorNow = decodedHashAnchor;
			const anchorToApply = focusAnchor ?? (hashAnchorNow !== null && hashAnchorNow !== "" ? hashAnchorNow : null);
			// Stable identity for "which anchor am I currently trying to land on", so the
			// resolve effect can track the attempt itself instead of the raw props.
			// `anchorInput` must NOT be part of this token. It is the typed value, and the
			// typed value is applied by the Enter handler — putting it here made the effect
			// re-run on EVERY keystroke, so typing `tvp1:t2s1` fired eight failed parses and
			// flashed "unrecognised anchor format" eight times before the ninth succeeded.
			const anchorToken = (0, react.useMemo)(() => [anchorToApply, hash].map((v) => (typeof v === "string" ? v : "")).join("\u0000"), [anchorToApply, hash]);
			// An anchor search can page for tens of seconds. If the panel unmounts (the
			// host re-mounts the view on a conversation switch) or the session changes,
			// the loop kept going: `stationsRef` freezes at its last value, so the
			// "did the projection change?" test never sees progress, the inner back-off
			// runs all 12 tries, and the next page still reports growth — up to 40 pages
			// of history pulled for a session nobody is looking at. Nothing it then calls
			// can be seen, so every await must re-check whether we are still here.
			const aliveRef = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				aliveRef.current = true;
				return () => { aliveRef.current = false; };
			}, [sessionKey]);
			const anchorApply = (0, react.useCallback)(async (raw) => {
				const parsed = parseAnchor(raw);
				if (parsed.ok !== true) {
					setAnchorNote(t("anchor.bad"));
					return false;
				}
				// 1) already loaded? then this is pure navigation
				let resolved = resolveAnchorInStations(parsed, stationsRef.current);
				// Set when back-paging stopped at the page budget while history still exists.
				let capHit = false;
				// 2) not loaded: page backwards until the target appears.
				//    Deliberately NOT `session.loadThrough(seq)`: measured on a real session,
				//    loadThrough only moves `baseSeq` / `hasMore` on the session snapshot and
				//    never rebuilds the trajectory projection, so the stations list stays put
				//    (57 -> 57 even after it reported success). `loadOlder` does re-project
				//    (57 -> 118), so that is the only paging that can actually reveal a node.
				//    Paging is bounded by BOTH the page budget and the seq we were asked for.
				if (resolved.ok !== true && resolved.reason === "not-loaded") {
					const target = anchorLoadTarget(parsed);
					setAnchorNote(t("anchor.searching"));
					let pages = 0;
					// Why paging stopped matters to the user: "hit the page budget but more
					// history exists" is recoverable (pull manually and retry), while "no more
					// history" means the record is simply not in this session.
					let capped = false;
					while (resolved.ok !== true && pages < ANCHOR_MAX_PAGES && hasMoreRef.current === true) {
						// Stop as soon as the window provably covers the anchor: paging
						// further back can only add older records, never the requested one.
						// Applies to `e` (by seq) and `p`/`t` (by turn) — the latter used to
						// fall through to the page budget every time.
						if (target !== 0 || parsed.form === "p" || parsed.form === "t") {
							if (anchorCoveredByWindow(parsed, stationsRef.current)) break;
						}
						if (aliveRef.current !== true) return false;
						const before = stationsRef.current.length;
						const beforeArr = stationsRef.current;
						let moved = false;
						try { moved = await loadOlder(); } catch { moved = false; }
						if (aliveRef.current !== true) return false;
						pages += 1;
						// A deep link can legitimately page 40 times (measured 101 s on a
						// long session). A static "loading…" gave no sign of progress, so
						// the user could not tell a slow search from a hung one.
						setAnchorNote(t("anchor.searchingPages")
							.replace("{n}", String(pages))
							.replace("{max}", String(ANCHOR_MAX_PAGES))
							.replace("{stations}", String(stationsRef.current.length)));
						// Wait for the derived tree to catch up, then re-resolve.
						// Back off instead of always paying a full 250 ms: React normally
						// re-derives within a frame, so the first check is cheap and later
						// ones stretch out. Deep links page up to 40 times, and the fixed
						// delay alone added ~10 s to that path.
						//
						// Do NOT re-scan the same list. Re-running the O(n) anchor scan over
						// an unchanged array returned "not-loaded" every time it already had,
						// for nothing — up to 12 times a page, 40 pages deep, with 3,600
						// stations in the window. Scan only once the projection replaced the
						// array (identity, not length: see below).
						for (let i = 0; i < ANCHOR_REVEAL_TRIES; i += 1) {
							await new Promise((r) => setTimeout(r, Math.min(ANCHOR_REVEAL_MS, 20 * 2 ** i)));
							if (aliveRef.current !== true) return false;
							// Identity, not just length: the derived tree builds a NEW array
							// every projection, so an unchanged reference is the only cheap
							// proof that re-scanning would return exactly what it returned
							// before. A same-length replacement (which paging never does, but
							// a re-projection could) still gets scanned.
							if (stationsRef.current === beforeArr) continue;
							resolved = resolveAnchorInStations(parsed, stationsRef.current);
							break;
						}
						if (resolved.ok === true) break;
						if (stationsRef.current.length === before && moved !== true) break; // no progress
					}
					capped = resolved.ok !== true && pages >= ANCHOR_MAX_PAGES && hasMoreRef.current === true;
					capHit = capped;
				}
				if (resolved.ok !== true) {
					setAnchorNote(
						resolved.reason === "synthetic" || resolved.reason === "synthetic-tool" ? t("anchor.notPersisted")
							: resolved.reason !== "not-loaded" ? t("anchor.bad")
							: capHit ? t("anchor.capped").replace("{n}", String(ANCHOR_MAX_PAGES))
							: t("anchor.notLoaded"));
					return false;
				}
				const idx = stationsRef.current.indexOf(resolved.station);
				if (idx >= 0) {
					setPlaying(false);
					setFollow(false);
					setRevealed(idx + 1);
					setTab("detail");
				}
				if (resolved.synthetic === true) setAnchorNote(t("anchor.notPersisted"));
				else if (typeof resolved.upgraded === "string") setAnchorNote(t("anchor.upgraded").replace("{ref}", `${ANCHOR_PREFIX}${resolved.upgraded}`));
				else setAnchorNote(null);
				return true;
			}, [t, loadOlder]);
			// One search at a time, whichever entry point asked for it (see
			// createFlightGuard: only an identical anchor is deduplicated).
			const anchorFlight = (0, react.useMemo)(() => createFlightGuard(), []);
			const anchorApplyGuarded = (raw) => {
				// Both entry points (the URL/view request effect and the typed jump) go
				// through here, so the liveness check belongs here rather than duplicated in
				// each `.then`: a search that outlives the panel must not report success and
				// then write its anchor into whatever conversation is on screen now.
				if (aliveRef.current !== true) return Promise.resolve(false);
				if (!anchorFlight.tryStart(raw)) return Promise.resolve(false);
				return Promise.resolve(anchorApply(raw)).finally(() => anchorFlight.finish(raw));
			};
			// Tracks which anchor token has already been applied. The effect used to depend
			// on `N` as well, so EVERY new station (a live session) re-ran it: it re-applied
			// the anchor that had just been mirrored into the URL and yanked `revealed` back,
			// so a deep-linked reader could not step away from the anchor at all.
			const appliedAnchorRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (N === 0) return;
				// Only the URL / view-request path runs here; a typed anchor is applied by
				// the Enter handler, which is the moment the user actually asked for it.
				const wanted = anchorToApply !== null && anchorToApply !== "" ? anchorToApply : "";
				if (wanted === "") return;
				// `N` must stay in the dependency list: a deep link can arrive before the
				// projection has any stations, and the retry on growth is what makes it
				// land at all. What must NOT happen is re-applying an anchor that already
				// succeeded — that is what yanked the reader back. So remember only the
				// token that LANDED; a failed attempt stays retryable.
				if (appliedAnchorRef.current === anchorToken) return;
				let cancelled = false;
				void anchorApplyGuarded(wanted).then((ok) => {
					if (cancelled) return;
					if (ok) appliedAnchorRef.current = anchorToken;
					// a successful landing becomes shareable: mirror it into the URL
					if (ok && typeof location !== "undefined") {
						const next = nextHashFor(location.hash, wanted);
						if (next.changed === true) {
							try { history.replaceState(null, "", next.hash); setHash(next.hash); } catch { /* hash is a convenience, never fatal */ }
						}
					}
				});
				if (typeof completeViewRequest === "function") completeViewRequest();
				return () => { cancelled = true; };
			}, [anchorToken, N]);

			// hash navigation: a pasted/retyped #tvp1:... (or browser back) must land too
			(0, react.useEffect)(() => {
				if (typeof window === "undefined") return void 0;
				const onHash = () => setHash(typeof location !== "undefined" ? location.hash : "");
				window.addEventListener("hashchange", onHash);
				return () => window.removeEventListener("hashchange", onHash);
			}, []);

			// ── host composer clearance ───────────────────────────────────────────
			(0, react.useEffect)(() => {
				const measure = () => {
					const seat = document.querySelector('[class*="composerSeat"]');
					if (seat === null) { setComposerH(0); return; }
					const r = seat.getBoundingClientRect();
					// Only reserve space when it really floats over the viewport bottom.
					const covered = r.height > 0 && r.bottom >= window.innerHeight - 24 ? Math.round(r.height) : 0;
					setComposerH((prev) => (prev === covered ? prev : covered));
				};
				// Polling is the only reliable way to notice the composer growing (its
				// height depends on the input's line count), but a hidden tab does not
				// need it: pause while the document is hidden and re-measure on return.
				const onVisible = () => { if (document.visibilityState === "visible") measure(); };
				measure();
				window.addEventListener("resize", measure);
				document.addEventListener("visibilitychange", onVisible);
				const id = window.setInterval(() => {
					if (document.visibilityState !== "hidden") measure();
				}, 1500);
				return () => {
					window.removeEventListener("resize", measure);
					document.removeEventListener("visibilitychange", onVisible);
					window.clearInterval(id);
				};
			}, []);

			// ── keep host form fields auditable (see annotateNamelessFormFields) ──
			// The host sidebar builds its session search lazily, so a single pass on mount
			// can run before it exists. Poll for a bounded window instead of watching the
			// whole document forever; each pass is a cheap attribute check that returns
			// immediately once every field has an id.
			(0, react.useEffect)(() => {
				annotateNamelessFormFields();
				let ticks = 0;
				const id = window.setInterval(() => {
					ticks += 1;
					annotateNamelessFormFields();
					if (ticks >= 40) window.clearInterval(id);
				}, 500);
				return () => window.clearInterval(id);
			}, []);

			// ── follow mode: keep the newest station in view while live ──────────
			(0, react.useEffect)(() => {
				if (!follow || revealed !== null) return;
				const sc = scrollerRef.current;
				if (sc === null) return;
				try { sc.scrollLeft = sc.scrollWidth; } catch { /* noop */ }
			}, [N, follow, revealed]);

			// ── search ────────────────────────────────────────────────────────────
			const query = String(queryRaw ?? "").trim();
			const matches = (0, react.useMemo)(() => matchStations(stations, query), [stations, query]);
			const matchSet = (0, react.useMemo)(() => new Set(matches), [matches]);
			const searching = query !== "";
			const scopeNote = searchScopeNote(hasMore, loadingOlder, t);
			(0, react.useEffect)(() => { setMatchPtr(-1); }, [query]);
			const gotoMatch = (dir) => {
				if (matches.length === 0) return;
				// A fresh query has no current match yet, so the FIRST step has to land on an
				// end of the ring — not on match 2 of 3. Clamp covers the stale-pointer case
				// where the match set shrank between keystrokes.
				const base = matchPtr < 0 || matchPtr >= matches.length ? (dir > 0 ? -1 : 0) : matchPtr;
				const next = ((base + dir) % matches.length + matches.length) % matches.length;
				setMatchPtr(next);
				seek(matches[next]);
			};
			const onSearchKey = (ev) => {
				ev.stopPropagation();
				if (ev.key === "Enter") { gotoMatch(ev.shiftKey ? -1 : 1); ev.preventDefault(); }
				else if (ev.key === "Escape") { setQueryRaw(""); ev.preventDefault(); }
			};
			const clearSearch = () => {
				setQueryRaw("");
				if (searchRef.current !== null && typeof searchRef.current.focus === "function") searchRef.current.focus();
			};

			/**
			 * Keep the SAME station selected when the window grows backwards.
			 *
			 * `revealed` is a position, so paging in earlier history inserted stations
			 * before the current one and silently moved the reader to a different record
			 * (a selected `e30` became `e20`). Station ids are stable across rebuilds, so
			 * remember the selected id and re-derive the position from it.
			 */
			const selectedIdRef = (0, react.useRef)(null);
			const stationsSignature = (0, react.useMemo)(() => stations.map((st) => st.id).join("\u0000"), [stations]);
			// Read the station from the list directly: `activeStation` is declared further
			// down, and touching a `const` before its declaration throws ReferenceError on
			// EVERY render — the whole view failed to mount from 0.9.23 to 0.9.25.
			// Record the identity ONLY when the user's selection changes — never when the
			// station list changes. Depending on the id itself re-ran this effect after a
			// backwards page (same position, different station) and OVERWROTE the pinned
			// id with whatever now sat at that index, so the repair effect then "confirmed"
			// the wrong station. Verified live: e29532 became e28913 after loading history.
			const prevRevealedRef = (0, react.useRef)(revealed);
			(0, react.useEffect)(() => {
				const selectionChanged = prevRevealedRef.current !== revealed;
				prevRevealedRef.current = revealed;
				if (!selectionChanged) return;
				selectedIdRef.current = revealed === null ? null
					: (stationsRef.current[Math.min(stationsRef.current.length - 1, Math.max(0, revealed - 1))]?.id ?? null);
				// stationsRef is intentionally read through the ref: depending on `stations`
				// here would re-fire on paging, which is the bug being fixed.
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [revealed]);
			(0, react.useEffect)(() => {
				const id = selectedIdRef.current;
				if (id === null) return;
				const at = stations.findIndex((st) => st.id === id);
				// Gone from the window (should not happen for a prepend) or already correct.
				if (at < 0 || at + 1 === revealed) return;
				setRevealed(at + 1);
				// Depends on the station list only: this is a repair pass after it changes.
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [stationsSignature]);

			// ── turn hopping ──────────────────────────────────────────────────────
			const turnStarts = (0, react.useMemo)(() => {
				const out = [];
				for (let i = 0; i < stations.length; i += 1) if (stations[i].tag != null) out.push(i);
				return out;
			}, [stations]);
			const chosenIdx = Math.min(N - 1, Math.max(0, revealed !== null ? R - 1 : N - 1));
			const activeIdx = chosenIdx;
			const activeStation = stations[activeIdx]; // undefined while N === 0 (empty view)
			// Lazy: rebuild the model-visible message list only for the selected step.
			// (Hook sits above the empty-state early return so hook order never changes.)
			const activeReqStartSeq = activeStation !== void 0 && activeStation.kind === "step" && activeStation.request !== null ? activeStation.request.startSeq : null;
			const activeMessages = (0, react.useMemo)(() => (activeReqStartSeq != null ? reconstructMessages(tree.nodes ?? [], activeReqStartSeq, t) : []), [activeReqStartSeq, tree.nodes]);
			/**
			 * The "copy this step" Markdown is built from every tool result in the step, so
			 * it is expensive (663 ms for a 256 KB result — 100% of that render). It is only
			 * read when the button is clicked, and was recomputed on every render: replay,
			 * search typing, hover. Memoise it on the inputs it actually depends on.
			 */
			const stepMarkdown = (0, react.useMemo)(() => (activeStation === void 0 ? "" : buildStepMarkdown(activeStation, activeMessages, hasMore, t)), [activeStation, activeMessages, hasMore, t]);
			const jumpTurn = (dir) => {
				if (turnStarts.length === 0) return;
				let target = -1;
				if (dir < 0) {
					for (let i = turnStarts.length - 1; i >= 0; i -= 1) if (turnStarts[i] < activeIdx) { target = turnStarts[i]; break; }
					if (target < 0) target = turnStarts[0];
				} else {
					for (let i = 0; i < turnStarts.length; i += 1) if (turnStarts[i] > activeIdx) { target = turnStarts[i]; break; }
					if (target < 0) target = turnStarts[turnStarts.length - 1];
				}
				seek(target);
			};

			// ── load older history ────────────────────────────────────────────────
			// `hasMore` says the SESSION has older history; it says nothing about whether
			// this view was handed a way to fetch it. The slot's `inject` returns `{}` when
			// the session binding is gone, so `loadOlder` can legitimately be absent while
			// `hasMore` is still true — and the button was rendered ENABLED and did nothing
			// at all when pressed, because `doLoadOlder` bails out silently. A control that
			// looks clickable and provably cannot act is worse than no control.
			const canPage = typeof loadOlder === "function";
			const doLoadOlder = () => {
				if (!canPage || olderBusy === true || loadingOlder) return;
				setOlderBusy(true);
				setOlderNote(null);
				Promise.resolve()
					.then(() => loadOlder())
					// A failed page used to be indistinguishable from a fast one: the button
					// flipped to "loading", flipped back, and the timeline did not grow. The
					// user retries a request that is already being refused (offline, expired
					// session, host error) with no way to know why nothing appears.
					.catch(() => setOlderNote(t("action.loadOlderFailed")))
					.finally(() => setOlderBusy(false));
			};

			// ── export the whole trace as Markdown study notes ────────────────────
			const doExport = (ev) => {
				if (ev != null && typeof ev.stopPropagation === "function") ev.stopPropagation();
				const md = buildTraceMarkdown(tree, t);
				// Same rule as CopyBtn: a failed copy is a real outcome (non-secure context,
				// refused permission), and returning silently made the button look dead —
				// the user believes the whole trace is on the clipboard when it is not.
				copyText(md, (ok) => {
					setExportState(ok ? "ok" : "fail");
					// Same one-timer rule as CopyBtn: without clearing the previous timer a
					// second click's feedback is wiped early by the first click's timeout.
					if (exportResetRef.current !== null) clearTimeout(exportResetRef.current);
					exportResetRef.current = setTimeout(() => { exportResetRef.current = null; setExportState("idle"); }, 1600);
				});
			};

			/**
			 * Keyboard/screen-reader access. The timeline is a horizontal list of items,
			 * so it announces itself as one and lets Tab land on the current station
			 * (roving tabindex) instead of forcing a pass over ~66 tab stops. Arrow keys
			 * keep their playback meaning on the root handler; a FOCUSED station uses
			 * them to move selection, which is what a listbox user expects.
			 */
			const stationOnKeyDown = (ev, i) => {
				// Same rule as the panel-level handler: a station button must not swallow a
				// browser shortcut. It calls stopPropagation, so the guard above cannot help.
				if (ev.ctrlKey === true || ev.metaKey === true || ev.altKey === true) return;
				const k = ev.key;
				if (k === "ArrowRight" || k === "ArrowDown") {
					const next = Math.min(N - 1, i + 1);
					focusStation(next); ev.preventDefault(); ev.stopPropagation();
				} else if (k === "ArrowLeft" || k === "ArrowUp") {
					const prev = Math.max(0, i - 1);
					focusStation(prev); ev.preventDefault(); ev.stopPropagation();
				} else if (k === "Home") {
					focusStation(0); ev.preventDefault(); ev.stopPropagation();
				} else if (k === "End") {
					focusStation(N - 1); ev.preventDefault(); ev.stopPropagation();
				} else if (k === "Enter" || k === " ") {
					seek(i); ev.preventDefault(); ev.stopPropagation();
				}
			};
			const onKeyDown = (ev) => {
				const k = ev.key;
				// Browser and OS shortcuts must win. The panel root is focusable
				// (`tabIndex: 0`), so once the user clicks anywhere inside it these keys
				// arrive here first: Ctrl/Cmd+R stopped reloading the page and toggled the
				// request tab, Ctrl/Cmd+F stopped browser find and focused our search box,
				// Alt+Left stopped going back and stepped the timeline, Ctrl+Home stopped
				// scrolling to the top. Bail out on any modifier combination.
				if (ev.ctrlKey === true || ev.metaKey === true || ev.altKey === true) return;
				const tag = ev.target && ev.target.tagName ? String(ev.target.tagName).toLowerCase() : "";
				if (tag === "input" || tag === "textarea" || tag === "select" || (ev.target && ev.target.isContentEditable === true)) return;
				if (k === "/" || k === "f") {
					if (searchRef.current !== null && typeof searchRef.current.focus === "function") { searchRef.current.focus(); ev.preventDefault(); }
					return;
				}
				// Space activates buttons, summaries (toggle <details>) and links by
				// default. The old guard excluded only `button`, so pressing Space on a
				// `<summary>` both toggled the section and started playback.
				if (k === " " && (tag === "button" || tag === "summary" || tag === "a")) return;
				if (k === "ArrowRight") { stepNext(); ev.preventDefault(); }
				else if (k === "ArrowLeft") { stepPrev(); ev.preventDefault(); }
				else if (k === "Home") { toStart(); ev.preventDefault(); }
				else if (k === "End") { toEnd(); ev.preventDefault(); }
				else if (k === " ") { togglePlay(); ev.preventDefault(); }
				else if (k === "PageUp") { jumpTurn(-1); ev.preventDefault(); }
				else if (k === "PageDown") { jumpTurn(1); ev.preventDefault(); }
				else if (k === "r" || k === "R") {
					const aSt = stations[activeIdx];
					const can = aSt !== void 0 && ((aSt.kind === "step" && aSt.request !== null) || (aSt.kind === "compaction" && aSt.crequest != null));
					if (can) { setTab(tab === "request" ? "detail" : "request"); ev.preventDefault(); }
				}
			};

			const fmtClock = (ms) => {
				// Guard: reject missing/implausible values (seq numbers sneak in as < year 2000).
				if (ms == null || !Number.isFinite(ms) || ms < 946684800000) return "";
				try { return new Date(ms).toLocaleTimeString(); } catch { return ""; }
			};

			const legendItems = [
				{ color: "var(--dstv-info)", label: t("node.user") },
				{ color: "var(--dstv-ok)", label: t("node.step") },
				{ color: "var(--dstv-warn)", label: t("node.tool") },
				{ color: "var(--dstv-unknown)", label: t("node.compaction") },
				{ color: "var(--dstv-err)", label: t("meta.error") }
			];

			const header = jsxs("div", {
				className: "dstv_head",
				children: [
					jsx("span", { className: "dstv_title", children: t("view.label") }, "hTitle"),
					tree.currentStepNo !== null ? jsxs("span", {
						className: "dstv_stat",
						children: [
							jsx("i", { className: "dstv_dot", "data-live": true }, "hDot"),
							`${t("stat.current")} ${t("node.step")} ${String(tree.currentStepNo)}`
						]
					}, "hLive") : null,
					jsx("span", {
						className: "dstv_legend",
						children: legendItems.map((item) => jsxs("span", { children: [jsx("i", { style: { background: item.color } }, "lgDot"), item.label] }, item.label))
					}, "hLegend"),
					N > 0 ? jsxs("span", {
						className: "dstv_transport",
						children: [
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.toStart"), "aria-label": t("action.toStart"), onClick: toStart, children: jsx("span", { "aria-hidden": "true", children: "⏮" }, "toStartIc") }, "toStart"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.prevTurn"), "aria-label": t("action.prevTurn"), onClick: () => jumpTurn(-1), children: jsx("span", { "aria-hidden": "true", children: "⇤" }, "prevTurnIc") }, "prevTurn"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.prev"), "aria-label": t("action.prev"), onClick: stepPrev, children: jsx("span", { "aria-hidden": "true", children: "◀" }, "prevIc") }, "prev"),
							jsx("button", { type: "button", className: "dstv_tbtn dstv_playBtn", title: playing ? t("action.pause") : t("action.play"), "aria-label": playing ? t("action.pause") : t("action.play"), onClick: togglePlay, children: jsx("span", { "aria-hidden": "true", children: playing ? "❚❚" : "▶" }, "playIc") }, "play"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.nextTurn"), "aria-label": t("action.nextTurn"), onClick: () => jumpTurn(1), children: jsx("span", { "aria-hidden": "true", children: "⇥" }, "nextTurnIc") }, "nextTurn"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.toEnd"), "aria-label": t("action.toEnd"), onClick: toEnd, children: jsx("span", { "aria-hidden": "true", children: "⏭" }, "toEndIc") }, "toEnd"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.speed"), "aria-label": `${t("action.speed")} ${SPEED_LABELS[speedIdx] ?? SPEED_LABELS[0]}`, onClick: cycleSpeed, children: SPEED_LABELS[speedIdx] ?? SPEED_LABELS[0] }, "speed"),
							jsx("button", { type: "button", className: "dstv_tbtn", "data-on": follow ? "true" : undefined, title: t("action.follow"), "aria-label": t("action.follow"), "aria-pressed": follow ? "true" : "false", onClick: () => setFollow((f) => !f), children: jsx("span", { "aria-hidden": "true", children: "⇣" }, "followIc") }, "follow")
						]
					}, "hTransport") : null,
					tree.currentStepNo !== null ? jsx("button", { type: "button", className: "dstv_btn", title: t("action.locate"), onClick: locateCurrent, children: `⌖ ${t("action.locate")}` }, "hLocate") : null,
					hasMore ? jsx("button", {
						type: "button",
						className: "dstv_btn",
						title: t("action.loadOlder"),
						disabled: !canPage || olderBusy === true || loadingOlder,
						onClick: doLoadOlder,
						children: olderBusy === true || loadingOlder ? `⏳ ${t("action.loadingOlder")}` : `⬆ ${t("action.loadOlder")}`
					}, "hOlder") : null,
					N > 0 ? jsx("button", {
						type: "button",
						className: "dstv_btn",
						"data-on": clockAxis ? "true" : undefined,
						title: t("action.clockAxisHint"),
						onClick: () => setClockAxis((v) => !v),
						children: clockAxis ? `⏱ ${t("action.clockAxisOn")}` : `⏱ ${t("action.clockAxis")}`
					}, "hClock") : null,
					N > 0 ? jsx("button", {
						type: "button",
						className: "dstv_btn",
						title: t("action.exportMd"),
						onClick: doExport,
						"data-fail": exportState === "fail" ? "true" : undefined,
						children: exportState === "ok" ? `✓ ${t("action.exported")}`
							: exportState === "fail" ? `✗ ${t("anchor.copyFailed")}`
							: "📋 Markdown"
					}, "hExport") : null,
					stats.lastModel != null ? jsx("span", { className: "dstv_modelChip", title: stats.lastModel, children: `🤖 ${stats.lastModel}` }, "hModel") : null,
					// Announce anchor progress: paging can take many seconds with no other
					// feedback for screen-reader users (the chip changing is silent).
					jsx("span", { className: "dstv_visuallyHidden", "aria-live": "polite", "aria-atomic": "true", children: [anchorNote, olderNote].filter((x) => x !== null).join(" · ") }, "hAnchorLive"),
					anchorNote !== null ? jsx("span", { className: "dstv_chip warn", title: anchorNote, children: anchorNote }, "hAnchorNote") : null,
					olderNote !== null ? jsx("span", { className: "dstv_chip warn", title: olderNote, children: olderNote }, "hOlderNote") : null,
					// A malformed record alongside healthy ones used to be reported ONLY on the
					// empty branch, so a partly-broken session looked perfectly fine in the
					// header while silently dropping data.
					tree.contract != null && tree.contract.ok !== true && N > 0 ? jsx("span", {
						className: "dstv_chip warn",
						title: `${t("view.malformedTip")} [${(tree.contract.problems ?? []).join(", ")}]`,
						children: `⚠ ${t("view.malformed").replace("{n}", String(tree.contract.problems.length))}`
					}, "hMalformed") : null,
					tree.nodeStats != null && tree.nodeStats.unknown > 0 ? jsx("span", {
						className: "dstv_chip warn",
						title: `${t("view.driftTip")}${tree.nodeStats.kinds.length > 0 ? ` [${tree.nodeStats.kinds.join(", ")}]` : ""}`,
						children: `⚠ ${t("view.drift").replace("{n}", String(tree.nodeStats.unknown))}`
					}, "hDrift") : null,
					tree.nodeStats != null && tree.nodeStats.invalid > 0 ? jsx("span", {
						className: "dstv_chip warn",
						title: t("view.invalidTip"),
						children: `⚠ ${t("view.invalid").replace("{n}", String(tree.nodeStats.invalid))}`
					}, "hInvalid") : null,
					jsxs("span", {
						className: "dstv_search dstv_anchorBar",
						"data-active": anchorInput.trim() !== "" ? "true" : undefined,
						children: [
							jsx("span", { className: "dstv_sbtn", style: { cursor: "default" }, children: "🔗" }, "aIco"),
							jsx("input", {
								className: "dstv_searchInput dstv_anchorInput",
								// `id` + `name` are not decoration: browsers key autofill and form
								// semantics on them, and DevTools flags the field as nameless without
								// them (aria-label alone does not satisfy that check).
								id: "dstv-anchor-input",
								name: "dstv-anchor",
								type: "text",
								autoComplete: "off",
								value: anchorInput,
								// A placeholder is not an accessible name: screen readers may skip
								// it, and it disappears the moment the field has content.
								"aria-label": t("anchor.jumpLabel"),
								placeholder: t("anchor.jumpPlaceholder"),
								title: t("anchor.jumpTip"),
								onChange: (ev) => setAnchorInput(ev.target != null ? ev.target.value : ""),
								onKeyDown: (ev) => {
									ev.stopPropagation();
									if (ev.key === "Enter") {
										ev.preventDefault();
										const wanted = anchorInput.trim();
										// Mirror a successful typed jump into the URL. Only the
										// URL-driven path used to do this, so pressing Enter left
										// the old hash in place and the next arriving station
										// re-applied it, snatching the selection back.
										void anchorApplyGuarded(wanted).then((ok) => {
											if (!ok || typeof location === "undefined") return;
											const next = nextHashFor(location.hash, wanted);
											if (next.changed !== true) return;
											try { history.replaceState(null, "", next.hash); setHash(next.hash); } catch { /* hash is a convenience */ }
										});
									}
									else if (ev.key === "Escape") { setAnchorInput(""); setAnchorNote(null); ev.preventDefault(); }
								}
							}, "aIn"),
							anchorInput.trim() !== "" ? jsx("button", { type: "button", className: "dstv_sbtn", title: t("anchor.clear"), "aria-label": t("anchor.clear"), onClick: () => { setAnchorInput(""); setAnchorNote(null); }, children: jsx("span", { "aria-hidden": "true", children: "✕" }, "aClrIc") }, "aClr") : null
						]
					}, "hAnchor"),
					jsxs("span", {
						className: "dstv_search",
						"data-active": searching ? "true" : undefined,
						children: [
							jsx("span", { className: "dstv_sbtn", style: { cursor: "default" }, children: "🔍" }, "sIco"),
							jsx("input", {
								ref: searchRef,
								className: "dstv_searchInput",
								id: "dstv-search-input",
								name: "dstv-search",
								type: "search",
								autoComplete: "off",
								"aria-label": t("search.label"),
								value: query,
								placeholder: t("action.search"),
								onChange: (ev) => setQueryRaw(ev.target != null ? ev.target.value : ""),
								onKeyDown: onSearchKey
							}, "sIn"),
							// Announced: this text changes on every keystroke and after every
							// next/prev jump, and it is the ONLY feedback that a search found
							// nothing or moved to the third of five matches. Without a live
							// region a screen reader user typed into the box and heard nothing.
							searching ? jsx("span", {
								className: `dstv_searchCount${matches.length === 0 ? " none" : ""}`,
								role: "status",
								"aria-live": "polite",
								"aria-atomic": "true",
								children: matches.length === 0 ? t("search.none")
								// `-` while nothing is selected: "1/3" claimed a position the
								// timeline did not actually hold.
								: matchPtr < 0 ? `–/${matches.length} ${t("search.matches")}`
									: `${matchPtr + 1}/${matches.length} ${t("search.matches")}`
							}, "sCnt") : null,
							// Without a loader this must be a NOTICE, not a disabled button:
							// the tooltip says "click here to load earlier history", which a
							// disabled control cannot honour. The warning itself still matters
							// (the search really is limited to the loaded range), so keep the
							// text and drop only the affordance.
							searching && scopeNote !== null ? (canPage ? jsx("button", {
								type: "button",
								className: "dstv_scope",
								title: t("search.scopeTip"),
								disabled: olderBusy === true || loadingOlder,
								onClick: doLoadOlder,
								children: `⬆ ${scopeNote}`
							}, "sScope") : jsx("span", {
								// `data-static` drops the pointer cursor and the hover highlight:
								// `.dstv_scope` is styled as a button, so a bare span would still
								// LOOK clickable — the same lie one layer down.
								className: "dstv_scope",
								"data-static": "true",
								title: t("search.scopeTipStatic"),
								children: `⬆ ${scopeNote}`
							}, "sScope")) : null,
							searching && matches.length > 0 ? jsx("button", { type: "button", className: "dstv_sbtn", title: t("action.searchPrev"), onClick: () => gotoMatch(-1), children: "↑" }, "sPrev") : null,
							searching && matches.length > 0 ? jsx("button", { type: "button", className: "dstv_sbtn", title: t("action.searchNext"), onClick: () => gotoMatch(1), children: "↓" }, "sNext") : null,
							searching ? jsx("button", { type: "button", className: "dstv_sbtn", title: t("action.searchClear"), "aria-label": t("action.searchClear"), onClick: clearSearch, children: jsx("span", { "aria-hidden": "true", children: "✕" }, "sClrIc") }, "sClr") : null
						]
					}, "hSearch")
				]
			}, "rootHead");

			if (N === 0) {
				if (sessionLoading === true) {
					// Skeleton, not prose: the count is unknown yet, so any number here would
					// be invented. Three pulsing cards communicate "being read" and keep the
					// layout from jumping when the real cards arrive.
					return jsxs("div", {
						className: "dstv_root",
						tabIndex: 0,
						children: [header, jsxs("div", {
							className: "dstv_empty dstv_loading",
							role: "status",
							"aria-live": "polite",
							"aria-busy": "true",
							children: [
								jsx("span", { className: "dstv_spinner", "aria-hidden": "true" }, "spin"),
								jsx("div", { className: "dstv_loadingText", children: t("view.loading") }, "ldTxt"),
								jsx("div", {
									className: "dstv_skeletonRow",
									"aria-hidden": "true",
									children: [0, 1, 2].map((i) => jsx("span", { className: "dstv_skeleton", style: { animationDelay: `${i * 120}ms` } }, `sk${i}`))
								}, "skRow")
							]
						}, "rootLoading")]
					});
				}
				// A contract violation must NOT look like "you have no data yet": the two
				// states have completely different fixes for the user.
				// Two independent triggers, because a kind rename keeps the field names valid:
				//   (a) the snapshot itself is malformed / missing eventNodes
				//   (b) the snapshot is well-formed but nothing in it is recognizable
				const structureBroken = tree.contract != null && tree.contract.ok !== true;
				const everythingUnknown = isEverythingUnknown(tree.nodes, tree.nodeStats);
				const incompatible = structureBroken || everythingUnknown;
				return jsxs("div", {
					className: "dstv_root",
					tabIndex: 0,
					children: [header, jsxs("div", {
						className: "dstv_empty",
						children: [
							jsx("span", { className: incompatible ? "dstv_emptyGlyph warn" : "dstv_emptyGlyph", children: incompatible ? "⚠" : "◉" }, "emptyGlyph"),
							incompatible
								? jsxs("div", { className: "dstv_incompat", children: [
									jsx("strong", { children: t("view.incompatible") }, "incT"),
									jsx("div", { className: "dstv_incompatHint", children: t("view.incompatibleHint") }, "incH"),
									jsx("code", { className: "dstv_incompatCodes", children: [
										...(tree.contract.problems ?? []),
										...everythingUnknown ? [`unrecognized-kinds: ${(tree.nodeStats.kinds ?? []).join("|")}`] : []
									].join(", ") }, "incP")
								] }, "incompat")
								: t("view.empty"),
							jsx("span", {
								className: "dstv_emptyLegend",
								children: legendItems.map((item) => jsxs("span", { children: [jsx("i", { style: { background: item.color } }, "eDot"), item.label] }, item.label))
							}, "emptyLegend")
						]
					}, "rootEmpty")]
				});
			}

			const renderStationCard = (s, cardKey) => {
				if (s.kind === "user") {
					return jsxs("div", {
						className: "dstv_hcard userCard",
						children: [
							jsx("span", { className: "dstv_name", children: s.who }, "uName"),
							s.time != null ? jsx("span", { className: "dstv_spanRow", children: jsx("span", { className: "dstv_spanEdge", children: fmtClock(s.time) }, "uClk") }, "uSpan") : null,
							jsx("div", { className: "dstv_text dstv_clamp3", title: s.text, children: s.text || "…" }, "uText")
						]
					}, cardKey);
				}
				if (s.kind === "step") {
					return jsxs("div", {
						className: `dstv_hcard ${s.hasError ? "stepCardErr" : "stepCardOk"}`,
						children: [
							jsxs("span", {
								className: "dstv_name",
								children: [
									s.live === true ? jsx("i", { className: "dstv_dot", "data-live": true }, "stIcon") : s.hasError ? jsx("span", { className: "dstv_bad", "aria-hidden": "true", children: "✗" }, "stIcon") : jsx("span", { className: "dstv_ok", "aria-hidden": "true", children: "✓" }, "stIcon"),
									jsx("span", { className: "dstv_nameText", children: s.label }, "stLbl"),
									jsx("span", { className: "dstv_chips", children: s.meta.map((m, i) => jsx("span", { className: "dstv_chip", title: m, children: m }, `sm${i}`)) }, "stChips")
								]
							}, "stName"),
							// G4-T1: exact span. Per spec, a missing edge shows only the edge
							// that exists — never a fabricated 00:00:00, and never a bogus
							// end time for a step that is still running.
							s.startMs != null || s.endMs != null || s.live === true
								? jsx("div", {
									className: "dstv_spanRow",
									title: `${t("detail.start")} → ${t("detail.end")}`,
									children: jsxs(fragment, { children: [
										s.startMs != null ? jsx("span", { className: "dstv_spanEdge", children: fmtClock(s.startMs) }, "sp0") : null,
										s.startMs != null ? jsx("span", { className: "dstv_spanArrow", "aria-hidden": "true", children: "→" }, "spA") : null,
										s.endMs != null
											? jsx("span", { className: "dstv_spanEdge", children: fmtClock(s.endMs) }, "sp1")
											: s.live === true ? jsx("span", { className: "dstv_spanLive", children: t("chip.running") }, "spLive") : null
									] })
								}, "stSpan")
								: null,
							s.cells.map((cell) => {
								if (cell.kind === "assistant") {
									return jsxs("div", {
										className: "dstv_cellRow",
										children: [
											jsx("span", { className: "dstv_cellName", children: t("node.assistant") }, "aName"),
											cell.thinking !== "" ? jsx("div", { className: "dstv_text dstv_clamp2 sec", title: cell.thinking, children: `💭 ${markdownToPlain(cell.thinking)}` }, "aThink") : null,
											cell.text !== "" ? jsx("div", { className: "dstv_text dstv_clamp2", title: cell.text, children: markdownToPlain(cell.text) }, "aText") : null
										]
									}, `a${cell.id}`);
								}
								if (cell.kind === "tool") {
									return jsxs("div", {
										className: "dstv_cellRow",
										children: [
											jsxs("span", {
												className: "dstv_cellName",
												title: cell.args !== "" ? `${cell.name} ${String(cell.args).slice(0, TITLE_PREVIEW_CHARS)}` : undefined,
												children: [
													cell.running === true ? jsx("i", { className: "dstv_dot", "data-live": true }, "tIcon") : cell.isError ? jsx("span", { className: "dstv_bad", "aria-hidden": "true", children: "✗" }, "tIcon") : jsx("span", { className: "dstv_ok", "aria-hidden": "true", children: "✓" }, "tIcon"),
													`${toolGlyph(cell.name)} ${cell.name}`,
													cell.isError ? jsx("span", { className: "dstv_chip err", children: t("chip.error") }, "tErr") : null,
													cell.running ? jsx("span", { className: "dstv_chip run", children: t("chip.running") }, "tRun") : null
												]
											}, "tName"),
											cell.args !== "" ? jsx("div", { className: "dstv_argsPrev", title: String(cell.args).slice(0, TITLE_PREVIEW_CHARS), children: `${cell.args.replace(/\s+/g, " ").slice(0, 64)}…` }, "tArgs") : null,
											(cell.durationMs != null || cell.running === true) ? jsx("div", { className: `dstv_durBar${cell.running === true ? " run" : ""}`, children: jsx("i", { style: { width: cell.running === true ? "100%" : `${Math.max(8, Math.round((cell.durationMs / Math.max(1, stats.maxToolMs || stats.toolMs)) * 100))}%` } }) }, "tDur") : null,
											cell.isError && cell.errorName != null ? jsx("div", { className: "dstv_text sec dstv_clamp2", children: `✗ ${cell.errorName}` }, "tErrName") : null
										]
									}, `t${cell.id}`);
								}
								return jsx("div", { className: "dstv_cellRow", children: `${t("node.subtool")} · ${cell.name}` }, `s${cell.id}`);
							})
						]
					}, cardKey);
				}
				// Special kind cards
				if (s.kind === "orphan-tool") {
					const body = s.displayText !== "" ? s.displayText : t("orphan.noText");
					return jsxs("div", {
						className: `dstv_hcard ${s.isError ? "stepCardErr" : "stepCardOk"}`,
						children: [
							jsxs("span", {
								className: "dstv_name",
								children: [
									jsx("span", { className: s.isError ? "dstv_bad" : "dstv_ok", children: s.isError ? "✗" : "⤷" }, "oIcon"),
									`${t("node.orphanTool")} · ${s.name}`,
									jsx("span", { className: "dstv_chips", children: [jsx("span", { className: "dstv_chip info", children: t("orphan.badge") }, "oBadge")] }, "oChips")
								]
							}, "oName"),
							s.args !== "" ? jsx("div", { className: "dstv_text dstv_clamp2 sec", title: s.args, children: s.args }, "oArgs") : null,
							jsx("div", { className: "dstv_text dstv_clamp4", title: body, children: body }, "oText")
						]
					}, cardKey);
				}
				if (s.kind === "compaction") {
					return jsxs("div", {
						className: "dstv_hcard compactionCard",
						children: [
							jsx("span", { className: "dstv_name", children: `♺ ${t("node.compaction")}` }, "cName"),
							jsx("div", { className: "dstv_text dstv_clamp2", title: s.summary, children: s.summary || "…" }, "cText")
						]
					}, cardKey);
				}
				if (s.kind === "error") {
					return jsxs("div", {
						className: "dstv_hcard errorCard",
						children: [
							jsx("span", { className: "dstv_name", children: `✗ ${t("node.error")}` }, "eName"),
							jsx("div", { className: "dstv_text dstv_clamp2", title: s.message, children: s.message || "…" }, "eText")
						]
					}, cardKey);
				}
				if (s.kind === "retry") {
					return jsxs("div", {
						className: "dstv_hcard retryCard",
						children: [
							jsx("span", { className: "dstv_name", children: `↻ ${t("node.retry")}${Number.isFinite(s.retry) ? ` #${s.retry}` : ""}` }, "rName"),
							jsx("div", { className: "dstv_text sec dstv_clamp2", title: s.message, children: s.message || "…" }, "rText")
						]
					}, cardKey);
				}
				if (s.kind === "maxTokens") {
					return jsxs("div", {
						className: "dstv_hcard maxTokensCard",
						children: [jsx("span", { className: "dstv_name", children: `⛔ ${t("node.maxTokens")}` }, "mName")]
					}, cardKey);
				}
				if (s.kind === "unknown") {
					return jsxs("div", {
						className: "dstv_hcard unknownCard",
						children: [
							jsxs("span", { className: "dstv_name", children: [
								jsx("span", { className: "dstv_bad", style: { background: "var(--dstv-muted)" }, children: "?" }, "ukIcon"),
								`${t("node.unknown")}${s.eventType !== "" ? ` · ${s.eventType}` : ""}`,
								jsx("span", { className: "dstv_chips", children: jsx("span", { className: "dstv_chip", children: `seq ${s.seq}` }, "ukSeq") }, "ukChips")
							] }, "ukName"),
							s.payload !== "" ? jsx("div", { className: "dstv_text sec dstv_clamp3", title: s.payload, children: s.payload }, "ukText") : null
						]
					}, cardKey);
				}
				if (s.kind === "command") {
					return jsxs("div", {
						className: "dstv_hcard commandCard",
						children: [
							jsx("span", { className: "dstv_name", children: `⚡ ${s.name}` }, "cmName"),
							s.args !== "" ? jsx("div", { className: "dstv_argsPrev", children: s.args }, "cmArgs") : null,
							s.outcomeKind === "error" ? jsx("div", { className: "dstv_text sec dstv_clamp2", children: `✗ ${s.outcomeText || t("meta.error")}` }, "cmOut") : null
						]
					}, cardKey);
				}
				return jsx("div", { className: "dstv_hcard", children: s.label }, cardKey);
			};

			// ── minimap: one tick per station, color-coded, click to seek ───────────
			// A tick needs a readable name: user stations carry no `label`, and the old
			// tooltip interpolated it directly, producing "undefined · 6:13:20 AM".
			const minimapTickLabel = (s) => {
				if (typeof s.label === "string" && s.label !== "") return s.label;
				if (s.kind === "user") return s.who ?? t("node.user");
				return t("node.unknown");
			};
			const minimapTicks = jsx("div", {
				className: "dstv_minimap",
				ref: minimapRef,
				children: stations.map((s, i) => {
					const reached = i < R;
					let k = s.kind;
					if (s.kind === "step") k = s.cells.some((c) => c.kind === "tool") ? "tool" : "step";
					if (s.kind === "maxTokens") k = "error";
					const done = reached && (s.kind !== "step" || !s.live);
					const matched = searching && matchSet.has(i);
					return jsx("button", {
						type: "button",
						className: "dstv_miniTick",
						"data-tick-idx": String(i),
						"data-k": k,
						"data-done": done ? "true" : undefined,
						"data-dim": reached ? (searching && !matched ? "true" : undefined) : "true",
						"data-active": revealed !== null && i === R - 1 ? "true" : undefined,
						"data-live": s.kind === "step" && s.live === true ? "true" : undefined,
						"data-match": matched ? "true" : undefined,
						// Roving tabindex, same as the station list. This strip is a SECOND
						// navigation affordance for the SAME stations: leaving every tick
						// tabbable made it N extra Tab stops (measured 200 at 200 stations,
						// so 3,600 on a long session) that a keyboard user had to cross to
						// reach the panel below — for a control that only seeks.
						// ...but exactly one tick must stay reachable, or the whole strip
						// disappears from the keyboard in the overview state. Same rule as
						// the station list: the active one, else the first.
						tabIndex: (revealed !== null && i === R - 1) || (revealed === null && i === 0) ? 0 : -1,
						// `s.label` is undefined for user stations, so the tooltip read
						// "undefined · 6:13:20 AM" and the button had no accessible name at
						// all. Fall back to the kind and always expose aria-label.
						title: `${minimapTickLabel(s)}${fmtClock(s.time) !== "" ? ` · ${fmtClock(s.time)}` : ""}`,
						"aria-label": `${t("detail.position")} ${String(i + 1)} / ${String(stations.length)} · ${minimapTickLabel(s)}${fmtClock(s.time) !== "" ? ` · ${fmtClock(s.time)}` : ""}`,
						onClick: (ev) => { ev.stopPropagation(); seek(i); }
					}, `mini${i}`);
				})
			}, "rootMini");

			const body = jsxs("div", {
				children: [
					jsx("div", {
						className: "dstv_scroller",
						ref: scrollerRef,
						children: jsxs("div", {
							className: "dstv_hflow",
							role: "listbox",
							"aria-label": t("view.label"),
							"aria-orientation": "horizontal",
							children: [
								revealed !== null && playheadLeft !== null ? jsx("span", { className: "dstv_playhead", "aria-hidden": "true", style: { left: `${playheadLeft}px` }, children: jsx("i", {}) }, "ph") : null,
								stations.map((s, i) => {
									const reached = i < R;
									// G4-T3: idle gap vs the previous station's end (falls back to its
									// start / time). Rendered as an inline band so a long pause between
									// two steps is visible without opening either one.
									const prevStation = i > 0 ? stations[i - 1] : void 0;
									const prevEdge = prevStation === void 0 ? null
										: prevStation.endMs != null ? prevStation.endMs
										: prevStation.startMs != null ? prevStation.startMs
										: prevStation.time != null ? prevStation.time : null;
									const curEdge = s.startMs != null ? s.startMs : s.time != null ? s.time : null;
									const gapMs = prevEdge !== null && curEdge !== null ? curEdge - prevEdge : null;
									const showGap = gapMs !== null && gapMs >= GAP_MIN_MS;
									// T2: in clock mode the idle band is widened in proportion to real
									// elapsed time (log-scaled and capped), so a long pause looks long.
									// Station cards keep their fixed width — only the idle spacing scales.
									const gapWidth = showGap ? clockGapWidth(gapMs, clockAxis) : null;
									// A listbox may own only `option` (or `group`) children. The idle band is
									// decoration — the station's own aria-label already carries the timing —
									// so leaving it exposed put a non-option, non-tabbable span inside the
									// list: screen readers reported extra items in the count and read
									// "⏸ idle 5.0 min" as if it were a station. The playhead next to it was
									// already hidden; this one was missed.
									const gapPrefix = showGap ? [jsx("span", {
										className: `dstv_gapBand${clockAxis ? " scaled" : ""}`,
										style: gapWidth !== null ? { width: gapWidth, minWidth: gapWidth } : undefined,
										title: `${t("gap.idle")} ${fmtMs(gapMs)}`,
										"aria-hidden": "true",
										children: `⏸ ${fmtMs(gapMs)}`
									}, `gap${s.id}`)] : [];
									let dotCls = "dstv_hDot";
									if (s.kind === "user") dotCls += " user";
									else if (s.kind === "compaction") dotCls += " compaction";
									else if (s.kind === "error" || s.kind === "maxTokens") dotCls += " error";
									else if (s.kind === "retry") dotCls += " retry";
									else if (s.kind === "command") dotCls += " command";
									else if (s.kind === "orphan-tool") dotCls += " orphan";
									else if (s.kind === "unknown") dotCls += " unknown";
									else if (s.kind === "step" && s.cells.some((c) => c.kind === "tool")) dotCls += " tool";
									if (s.kind === "step" && s.live === true) dotCls += " live";
									const matched = searching && matchSet.has(i);
									const clock = fmtClock(s.time);
									const isActive = revealed !== null && i === R - 1;
									return jsxs("div", {
										className: "dstv_station",
										"data-station-idx": String(i),
										"data-dim": reached ? undefined : "true",
										"data-seek-dim": searching && !matched && reached ? "true" : undefined,
										"data-match": matched ? "true" : undefined,
										"data-active": isActive ? "true" : undefined,
										role: "option",
										// Overview (revealed === null) shows everything, so no station
										// is "selected"; announcing all-false would tell a screen-reader
										// user the list has a selection when it does not.
										// ARIA 1.2 requires every role="option" to expose aria-selected.
										// Omitting it in the overview state made screen readers guess
										// (NVDA says "not selected", VoiceOver sometimes skips it).
										"aria-selected": revealed === null ? "false" : (isActive ? "true" : "false"),
										"aria-label": stationAriaLabel(s, i + 1, N, t),
										tabIndex: isActive || (revealed === null && i === 0) ? 0 : -1,
										onKeyDown: (ev) => stationOnKeyDown(ev, i),
										onClick: () => seek(i),
										children: [
											...gapPrefix,
											jsxs("div", {
												className: "dstv_axisZone",
												children: [
													s.tag !== null && s.tag !== void 0 ? jsx("span", { className: "dstv_tag", title: s.tag, children: s.tag }, "axTag") : null,
													jsx("span", { className: `dstv_axSeg${reached ? " on" : ""}` }, "axSeg"),
													jsx("span", { className: dotCls, "data-active": revealed !== null && i === R - 1 ? "true" : undefined }, "axDot"),
													jsxs("span", {
														className: "dstv_axLabel",
														children: [
															// Show the PER-TURN step number, not the window-wide one:
															// paging older history shifts `stepNo` for every newer station,
															// so this label used to renumber as you scrolled back
															// (turn 5's first step read "1" then "5"). `turnStep` is stable.
															s.kind === "step" ? String(s.turnStep ?? s.stepNo) : String(i + 1),
															clock !== "" ? jsx("span", { className: "clock", children: ` ${clock}` }, "axClk") : null
														]
													}, "axLbl")
												]
											}, "stAxis"),
											jsx(RenderBoundary, {
											label: t("error.render"),
											retryLabel: t("error.retry"),
											hint: t("error.renderHint"),
											render: () => renderStationCard(s, `card${s.id}`)
										}, `card${s.id}`)
										]
									}, s.id);
								})
							]
						})
					}, "bodyScroller"),
					jsx("div", { className: "dstv_hint", children: t("hint.text") }, "bodyHint")
				]
			}, "rootBody");

			// ── Detail panel ────────────────────────────────────────────────────────
			// Status must come from the station's own evidence, for every kind:
			//  - a `command` whose outcome has not arrived yet is still RUNNING, and one
			//    with outcome.kind === "error" failed (rc.2 marks both explicitly);
			//  - an `orphan-tool` carries isError itself.
			// Reading only `kind === "error"` here labelled a failed command and a failed
			// orphan tool as "Done".
			const activeLive = (activeStation.kind === "step" && activeStation.live === true)
				|| (activeStation.kind === "command" && activeStation.outcomeKind == null)
				|| (activeStation.kind === "orphan-tool" && activeStation.live === true);
			const activeError = activeStation.kind === "step" ? activeStation.hasError
				: activeStation.kind === "error" ? true
				: activeStation.kind === "command" ? activeStation.outcomeKind === "error"
				: activeStation.kind === "orphan-tool" ? activeStation.isError === true || activeStation.hasError === true
				: false;
			const canRequest = (activeStation.kind === "step" && activeStation.request !== null) || (activeStation.kind === "compaction" && activeStation.crequest != null);
			const showTab = tab === "request" && canRequest ? "request" : "detail";

			const renderDetailBody = (s) => {
				if (s.kind === "unknown") {
					// Say exactly what the log said. The reader's question about an
					// unsupported event is "which one, and what did it carry".
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: t("node.unknown") }, "uLbl"),
						jsxs("div", { className: "dstv_dSection", children: [
							jsx("span", { className: "dstv_chip warn", children: t("node.unknown") }, "uBadge"),
							s.eventType !== "" ? jsx("span", { className: "dstv_chip", children: s.eventType }, "uType") : null,
							s.seq != null ? jsx("span", { className: "dstv_chip", children: `seq ${s.seq}` }, "uSeq") : null
						] }, "uMeta"),
						s.eventType !== "" ? jsxs("div", { className: "dstv_dSection", children: [
							jsx("span", { className: "dstv_dLabel", children: t("detail.eventType") }, "uTLbl"),
							jsx("pre", { className: "dstv_dText", children: s.eventType }, "uTypeText")
						] }, "uTypeSec") : null,
						jsxs("div", { className: "dstv_dSection", children: [
							jsx("span", { className: "dstv_dLabel", children: t("detail.rawPayload") }, "uPLbl"),
							jsx("pre", { className: "dstv_dText", children: s.payload !== "" ? s.payload : "—" }, "uPayload")
						] }, "uPayloadSec")
					] });
				}
				if (s.kind === "orphan-tool") {
					const body = s.displayText !== "" ? s.displayText : t("orphan.noText");
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: `${t("node.orphanTool")} · ${s.name}` }, "oLbl"),
						jsx("div", { className: "dstv_dSection", children: [
							jsx("span", { className: "dstv_chip info", children: t("orphan.badge") }, "oBadge"),
							jsx("span", { className: "dstv_chip", children: `callId ${s.callId}` }, "oCid")
						] }, "oMeta"),
						s.args !== "" ? jsxs("div", { className: "dstv_dSection", children: [
							jsx("span", { className: "dstv_dLabel", children: t("detail.args") }, "oALbl"),
							jsx("pre", { className: "dstv_dText", children: s.args }, "oArgs")
						] }) : null,
						jsxs("div", { className: "dstv_dSection", children: [
							jsx("span", { className: "dstv_dLabel", children: t("detail.result") }, "oRLbl"),
							jsx("pre", { className: "dstv_dText", children: body }, "oRes")
						] })
					] });
				}
				if (s.kind === "user") {
					// Same caption-over-card shape as the assistant sections, and the text is
					// Markdown too: users paste code blocks and lists just as often.
					return jsxs("div", { className: "dstv_dBody", children: jsxs("div", { className: "dstv_dSection dstv_dSectionBody", children: [
						jsx("span", { className: "dstv_dLabel", children: s.who }, "dLbl"),
						jsx("div", { className: "dstv_dText dstv_dMarkdown", children: s.text !== "" ? jsx(MarkdownText, { text: s.text }, "uMd") : "…" }, "dTxt")
					] }) });
				}
				if (s.kind === "step") {
					const cellsBody = jsxs("div", { className: "dstv_dBody", children: s.cells.map((cell) => {
						if (cell.kind === "assistant") {
							// The label is a caption ABOVE a bordered body, not a prefix of it:
							// an inline label glued model prose to the header and the reply read
							// as one run-on block.
							return jsxs("div", { className: "dstv_dSection dstv_dSectionBody", children: [
								jsx("span", { className: "dstv_dLabel", children: t("node.assistant") }, "aLbl"),
								cell.thinking !== "" ? jsxs("details", { className: "dstv_det", open: false, children: [
									jsx("summary", { children: [`💭 ${t("chip.thinking")}`, jsx("span", { className: "sub", children: String(cell.thinking.length) }, "aThLen")] }, "aThSum"),
									jsx("div", { className: "inner", children: jsx("div", { className: "dstv_dText sec", children: jsx(MarkdownText, { text: cell.thinking }, "aThMd") }, "aThText") }, "aThInner")
								] }, `dth${cell.id}`) : null,
								cell.text !== "" ? jsx("div", { className: "dstv_dText dstv_dMarkdown", children: jsx(MarkdownText, { text: cell.text }, "aMd") }, "aText") : null
							] }, `da${cell.id}`);
						}
						if (cell.kind === "tool") {
							const pretty = prettyArgs(cell.args);
							const hasResult = cell.resultText !== "" || cell.isError;
							return jsxs("div", { className: "dstv_dTool", children: [
								jsxs("span", { className: "dstv_name", title: cell.args !== "" ? `${cell.name} ${String(cell.args).slice(0, TITLE_PREVIEW_CHARS)}` : undefined, children: [
									cell.running === true ? jsx("i", { className: "dstv_dot", "data-live": true }, "tIcon") : cell.isError ? jsx("span", { className: "dstv_bad", "aria-hidden": "true", children: "✗" }, "tIcon") : jsx("span", { className: "dstv_ok", "aria-hidden": "true", children: "✓" }, "tIcon"),
									`${toolGlyph(cell.name)} ${cell.name}`,
									jsx("span", { className: "dstv_chips", children: [
										cell.running ? jsx("span", { className: "dstv_chip run", children: t("chip.running") }, "cRun") : null,
										cell.isError ? jsx("span", { className: "dstv_chip err", children: t("chip.error") }, "cErr") : null,
										cell.durationMs != null ? jsx("span", { className: "dstv_chip", children: fmtMs(cell.durationMs) }, "cDur") : null
									] }, "tChips")
								] }, "tName"),
								jsxs("details", { className: "dstv_det", open: false, children: [
									jsx("summary", { children: [t("detail.args"), jsx("span", { className: "sub", children: `${cell.args.length}${t("detail.chars")}` }, "aLen")] }, "tArgSum"),
									jsx("div", { className: "inner", children: [
										jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }, children: [
											jsx("span", { className: "dstv_dLabel", style: { margin: 0 }, children: t("node.tool") }, "tArgLbl"),
											jsx(CopyBtn, { text: cell.args, label: t("detail.copy"), okLabel: t("detail.copied"), failLabel: t("anchor.copyFailed") }, "tArgCopy")
										] }, "tArgHead"),
										jsx("div", { className: "dstv_code", children: pretty !== "" ? pretty : t("detail.noArgs") }, "tArgCode")
									] }, "tArgInner")
								] }, `da${cell.id}`),
								hasResult ? jsxs("details", { className: "dstv_det", open: true, children: [
									jsx("summary", { children: [cell.isError ? `✗ ${t("detail.result")}` : `✓ ${t("detail.result")}`, jsx("span", { className: "sub", children: String(cell.resultText.length) }, "rLen")] }, "tResSum"),
									jsx("div", { className: "inner", children: [
										jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }, children: [
											jsx("span", { className: `dstv_dLabel${cell.isError ? " err" : ""}`, style: { margin: 0 }, children: cell.isError && cell.errorName != null ? `✗ ${cell.errorName}` : t("detail.result") }, "tResLbl"),
											jsx(CopyBtn, { text: cell.resultText, label: t("detail.copy"), okLabel: t("detail.copied"), failLabel: t("anchor.copyFailed") }, "tResCopy")
										] }, "tResHead"),
										jsx("div", { className: "dstv_code", children: cell.resultText !== "" ? cell.resultText : t("detail.noResult") }, "tResCode")
									] }, "tResInner")
								] }, `dr${cell.id}`) : null,
								cell.resultText === "" && !cell.isError && !cell.running ? jsx("span", { className: "dstv_dLabel sec", children: t("detail.noResult") }, "tNoRes") : null,
								cell.subCalls.length > 0 ? jsxs("details", { className: "dstv_det", open: cell.subCalls.some((sub) => sub.isError), children: [
									jsx("summary", { children: [`${t("detail.subCalls")} (${cell.subCalls.length})`, cell.subCalls.some((sub) => sub.isError) ? jsx("span", { className: "dstv_chip err", children: t("chip.error") }, "tSubErr") : null] }, "tSubSum"),
									jsx("div", {
										className: "inner",
										children: cell.subCalls.map((sub, i) => {
											const subPretty = prettyArgs(sub.argsRaw);
											return jsxs("div", {
												className: "dstv_subCard",
												children: [
													jsxs("span", {
														className: "dstv_subHead",
														children: [
															sub.running ? jsx("i", { className: "dstv_dot", "data-live": true }, "sIcon") : sub.isError ? jsx("span", { className: "dstv_bad", children: "✗" }, "sIcon") : jsx("span", { className: "dstv_ok", children: "✓" }, "sIcon"),
															jsx("span", { className: "tname", children: `↳ ${sub.name}` }, "sName"),
															jsx("span", { className: "dstv_chips", children: [
																sub.running ? jsx("span", { className: "dstv_chip run", children: t("chip.running") }, "sRun") : null,
																sub.isError ? jsx("span", { className: "dstv_chip err", children: sub.errorName != null ? String(sub.errorName) : t("chip.error") }, "sErr") : null,
																sub.durationMs != null ? jsx("span", { className: "dstv_chip", children: fmtMs(sub.durationMs) }, "sDur") : null
															] }, "sChips")
														]
													}, "sHead"),
													sub.argsRaw !== "" ? jsxs("details", { className: "dstv_det", open: false, children: [
														jsx("summary", { children: [t("detail.args"), jsx("span", { className: "sub", children: `${sub.argsRaw.length}${t("detail.chars")}` }, "sALen")] }, "sArgSum"),
														jsx("div", { className: "inner", children: jsx("div", { className: "dstv_code", children: subPretty !== "" ? subPretty : t("detail.noArgs") }, "sArgCode") }, "sArgInner")
													] }, "sArgs") : null,
													sub.resultText !== "" ? jsxs("details", { className: "dstv_det", open: sub.isError, children: [
														jsx("summary", { children: [sub.isError ? `✗ ${t("detail.result")}` : `✓ ${t("detail.result")}`, jsx("span", { className: "sub", children: String(sub.resultText.length) }, "sRLen")] }, "sResSum"),
														jsx("div", { className: "inner", children: jsxs("div", { children: [
															jsx(CopyBtn, { text: sub.resultText, label: t("detail.copy"), okLabel: t("detail.copied"), failLabel: t("anchor.copyFailed") }, "sResCopy"),
															jsx("div", { className: "dstv_code", style: { marginTop: 4 }, children: sub.resultText }, "sResCode")
														] }) }, "sResInner")
													] }, "sRes") : null
												]
											}, `ts${i}`);
										})
									}, "tSubInner")
								] }, `ds${cell.id}`) : null
							] }, `dt${cell.id}`);
						}
						return jsx("div", { className: "dstv_dTool", children: `${t("node.subtool")} · ${cell.name}` }, `ds${cell.id}`);
					}) }, "dCells");
					return cellsBody;
				}
				// special stations
				if (s.kind === "compaction") {
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: s.label }, "cLbl"),
						jsx("div", { className: "dstv_dText", children: s.summary || "…" }, "cTxt"),
						s.count != null || s.tokens != null ? jsx("div", { className: "dstv_cfgChips", children: [
							s.count != null ? jsx("span", { className: "dstv_cfgChip", children: [`${s.count} ${t("meta.steps")}`] }, "cCnt") : null,
							s.tokens != null ? jsx("span", { className: "dstv_cfgChip", children: [`${fmtTokens(s.tokens)} ${t("meta.tokens")}`] }, "cTok") : null
						] }, "cChips") : null
					] });
				}
				if (s.kind === "error") {
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: s.label }, "eLbl"),
						jsx("div", { className: "dstv_dText", children: s.message || "…" }, "eTxt"),
						s.code != null ? jsx("div", { className: "dstv_cfgChips", children: jsx("span", { className: "dstv_cfgChip", children: [`code: ${s.code}`] }, "eCode") }, "eChips") : null
					] });
				}
				if (s.kind === "retry") {
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: s.label }, "rLbl"),
						jsx("div", { className: "dstv_dText", children: s.message || "…" }, "rTxt"),
						jsx("div", { className: "dstv_cfgChips", children: [
							Number.isFinite(s.retry) ? jsx("span", { className: "dstv_cfgChip", children: [`retry #${s.retry}${s.maxRetries != null ? `/${s.maxRetries}` : ""}`] }, "rRet") : null,
							s.provider ? jsx("span", { className: "dstv_cfgChip", children: [s.provider] }, "rProv") : null,
							s.code ? jsx("span", { className: "dstv_cfgChip", children: [`code: ${s.code}`] }, "rCode") : null,
							s.retryState ? jsx("span", { className: "dstv_cfgChip", children: [s.retryState] }, "rState") : null
						] }, "rChips")
					] });
				}
				if (s.kind === "maxTokens") {
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: s.label }, "mLbl"),
						jsx("div", { className: "dstv_dText sec", children: t("node.maxTokens") }, "mTxt")
					] });
				}
				if (s.kind === "command") {
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: s.label }, "cmLbl"),
						jsx("div", { className: "dstv_dText", children: `/${s.name}` }, "cmTxt"),
						s.args !== "" ? jsx("div", { className: "dstv_code", children: s.args }, "cmArgs") : null,
						s.outcomeText !== "" ? jsx("div", { className: "dstv_dText sec", children: s.outcomeText }, "cmOut") : null
					] });
				}
				return jsx("div", { className: "dstv_dBody", children: s.label });
			};

			/** Raw-request tab for a compaction station: config, usage, and the full
			 *  compaction output (what the model produced as the replacement summary). */
			const renderCompactionRequestBody = (s) => {
				const cr = s.crequest;
				if (cr == null) return null;
				const cfg = cr.config ?? {};
				const usage = cr.usage;
				return jsxs("div", { className: "dstv_dBody", children: [
					jsxs("div", { className: "dstv_cfgChips", children: [
						cfg.provider ? jsx("span", { className: "dstv_cfgChip", children: ["provider ", jsx("b", { children: cfg.provider }, "v")] }, "cProv") : null,
						cfg.model ? jsx("span", { className: "dstv_cfgChip", children: ["model ", jsx("b", { children: cfg.model }, "v")] }, "cModel") : null,
						cr.status ? jsx("span", { className: `dstv_chip ${cr.status === "running" ? "run" : cr.status === "error" ? "err" : ""}`, children: cr.status }, "cStatus") : null,
						cr.durationMs != null ? jsx("span", { className: "dstv_cfgChip", children: [fmtMs(cr.durationMs)] }, "cDur") : null
					] }, "crCfg"),
					usage !== null && usage.input + usage.output > 0 ? jsxs("div", { className: "dstv_dSection", children: [
						jsx("span", { className: "dstv_dLabel", children: `📊 ${t("detail.usage")}` }, "uLbl"),
						jsx("div", { className: "dstv_cfgChips", children: [
							usage.input > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["in ", jsx("b", { children: fmtInt(usage.input) }, "v")] }, "uIn") : null,
							usage.cacheRead > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["cache-read ", jsx("b", { children: fmtInt(usage.cacheRead) }, "v")] }, "uCR") : null,
							usage.output > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["out ", jsx("b", { children: fmtInt(usage.output) }, "v")] }, "uOut") : null
						] }, "uChips")
					] }, "crUsage") : null,
					cr.outputText !== "" ? jsxs("div", { className: "dstv_dSection", children: [
						jsxs("div", { className: "dstv_dSecHead", children: [
							jsx("span", { children: `📤 ${t("detail.compactionOutput")}` }, "oHead"),
							jsx("span", { className: "sub", children: `${fmtInt(cr.outputText.length)} ${t("detail.chars")}` }, "oLen"),
							jsx("span", { className: "grow" }, "oGrow"),
							jsx(CopyBtn, { text: cr.outputText, label: t("detail.copy"), okLabel: t("detail.copied"), failLabel: t("anchor.copyFailed") }, "oCopy")
						] }, "oSecHead"),
						jsx("div", { className: "dstv_code", style: { maxHeight: 260 }, children: cr.outputText }, "oCode")
					] }, "crOut") : null
				] }, "crBody");
			};

			/** Raw-request tab: config, prompt diff, system prompt, tool catalog, reconstructed messages, usage. */
			const renderRequestBody = (s, messages) => {
				const req = s.request;
				if (req == null) return null;
				const cfg = req.config ?? {};
				const usage = req.usage;
				// The catalog comes from the host: an entry can be a hole (null) and the
				// fields can be drifted. Normalise ONCE here — every reader below
				// (`tools.map`, the JSON previews, the React keys) then sees a safe shape.
				const tools = safeToolList(req.prompt?.tools);
				const diff = req.promptDiff ?? null;
				const evidenceChips = evidenceOf(req, activeMessages, hasMore);

				const payload = {
					provider: cfg.provider,
					model: cfg.model,
					purpose: cfg.purpose,
					temperature: cfg.temperature,
					reasoningEffort: cfg.reasoningEffort,
					maxTokens: cfg.maxTokens,
					system: req.prompt?.system ?? "",
					tools: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })),
					messages: messages.map((m) => m.role === "note"
						? { role: "user", content: [{ type: "text", text: m.text }] }
						: { role: m.role, content: m.content, ...(m.toolCallId != null ? { toolCallId: m.toolCallId } : {}), ...(m.isError != null ? { isError: m.isError } : {}) })
				};
				// `JSON.stringify` throws on a circular structure and on a BigInt, and what
				// arrives here is the host's own prompt/tool descriptor, not something we built.
				// A tool schema carrying a shared object reference (perfectly legal in a live
				// descriptor) therefore blanked the whole request tab instead of showing one
				// field as unrepresentable. `safeJsonPreview` already solves this everywhere
				// else; the request tab was the only place that called JSON directly.
				const payloadJson = safeJsonPreview(payload, Number.MAX_SAFE_INTEGER, 2);
				const sysToolsJson = safeJsonPreview(tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })), Number.MAX_SAFE_INTEGER, 2);
				const sysJson = safeJsonPreview({ system: req.prompt?.system ?? "", tools: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }, Number.MAX_SAFE_INTEGER, 2);

				return jsxs("div", { className: "dstv_dBody", children: [
					// config + lifecycle chips
					jsxs("div", { className: "dstv_cfgChips", children: [
						cfg.provider ? jsx("span", { className: "dstv_cfgChip", children: ["provider ", jsx("b", { children: cfg.provider }, "v")] }, "cProv") : null,
						cfg.model ? jsx("span", { className: "dstv_cfgChip", children: ["model ", jsx("b", { children: cfg.model }, "v")] }, "cModel") : null,
						cfg.temperature != null ? jsx("span", { className: "dstv_cfgChip", children: ["temp ", jsx("b", { children: String(cfg.temperature) }, "v")] }, "cTemp") : null,
						cfg.reasoningEffort ? jsx("span", { className: "dstv_cfgChip", children: ["effort ", jsx("b", { children: cfg.reasoningEffort }, "v")] }, "cEffort") : null,
						cfg.maxTokens ? jsx("span", { className: "dstv_cfgChip", children: ["max ", jsx("b", { children: fmtInt(cfg.maxTokens) }, "v")] }, "cMax") : null,
						cfg.thinking ? jsx("span", { className: "dstv_cfgChip", children: ["thinking ", jsx("b", { children: String(cfg.thinking) }, "v")] }, "cThink") : null,
						Array.isArray(cfg.stop) && cfg.stop.length > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["stop ×", jsx("b", { children: String(cfg.stop.length) }, "v")] }, "cStop") : null,
						req.status ? jsx("span", { className: `dstv_chip ${req.status === "running" ? "run" : req.status === "error" ? "err" : ""}`, children: req.status }, "cStatus") : null,
						req.durationMs != null ? jsx("span", { className: "dstv_cfgChip", children: [fmtMs(req.durationMs)] }, "cDur") : null,
						req.retry != null ? jsx("span", { className: "dstv_chip retry", children: [`↻ ${t("status.retry")} #${req.retry}${req.maxRetries != null ? `/${req.maxRetries}` : ""}`] }, "cRetry") : null
					] }, "reqCfg"),
					req.error != null ? jsx("div", { className: "dstv_dTool", style: { borderColor: "color-mix(in srgb,var(--dstv-err) 50%,transparent)" }, children: [
						jsx("span", { className: "dstv_dLabel err", children: `✗ ${req.error}` }, "reqErr")
					] }, "reqErrBox") : null,
					req.promptChangeKind != null && req.promptChangeKind !== "initial" && diff === null ? jsx("span", { className: "dstv_chip info", children: t("detail.promptChanged") }, "reqChanged") : null,
					diff !== null ? jsxs("div", { className: "dstv_diffBox", children: [
						jsxs("span", { className: "dstv_dLabel", style: { margin: 0 }, children: [
							"⚡ ",
							diff.isInitial || diff.kind === "initial" ? t("diff.initial") : diff.kind === "system" ? t("diff.system") : diff.kind === "tools" ? t("diff.tools") : t("diff.systemAndTools")
						] }, "pdHead"),
						diff.isInitial || diff.kind === "initial" ? null : jsxs("div", { className: "dstv_cfgChips", children: [
							diff.systemDelta !== 0 || diff.prevSystemChars !== diff.curSystemChars ? jsx("span", { className: "dstv_diffChip delta", children: `${t("diff.systemDelta")} ${fmtInt(diff.prevSystemChars)} → ${fmtInt(diff.curSystemChars)} (${diff.systemDelta > 0 ? "+" : ""}${fmtInt(diff.systemDelta)})` }, "pdSys") : null,
							diff.toolsAdded.map((n) => jsx("span", { className: "dstv_diffChip add", title: t("diff.toolsAdded"), children: `+ ${n}` }, `pdA${n}`)),
							diff.toolsRemoved.map((n) => jsx("span", { className: "dstv_diffChip del", title: t("diff.toolsRemoved"), children: `- ${n}` }, `pdR${n}`)),
							(diff.toolsChanged ?? []).map((n) => jsx("span", { className: "dstv_diffChip mod", title: t("diff.toolsChanged"), children: `~ ${n}` }, `pdM${n}`))
						] }, "pdChips"),
						// Q2-1: the actual changed lines, so a prompt author can see WHAT moved.
						diff.isInitial || diff.kind === "initial" ? null : (diff.textDiff != null ? jsxs("details", {
							className: "dstv_diffText",
							children: [
								jsx("summary", { children: `${t("diff.textDiff")} · ${t("diff.startLine").replace("{n}", String(diff.textDiff.startLine))}${diff.textDiff.narrows ? ` · ${t("diff.truncated").replace("{n}", String(PROMPT_DIFF_LINES))}` : ""}` }, "pdSum"),
								jsxs("div", { className: "dstv_diffBody", children: [
									diff.textDiff.removed.length > 0 ? jsxs("div", { className: "dstv_diffSide del", children: [
										jsx("div", { className: "dstv_diffLbl", children: `− ${t("diff.removed")}` }, "pdRLbl"),
										jsx("pre", { children: diff.textDiff.removed.join("\n") }, "pdPre")
									] }, "pdRemoved") : null,
									diff.textDiff.added.length > 0 ? jsxs("div", { className: "dstv_diffSide add", children: [
										jsx("div", { className: "dstv_diffLbl", children: `+ ${t("diff.added")}` }, "pdALbl"),
										jsx("pre", { children: diff.textDiff.added.join("\n") }, "pdApre")
									] }, "pdAdded") : null
								] }, "pdBody")
							]
						}, "pdText") : (diff.systemDelta !== 0 ? jsx("span", { className: "dstv_diffChip delta", children: t("diff.noText") }, "pdNoText") : null))
					] }, "reqDiff") : null,
					// system prompt
					req.prompt !== null ? jsxs("div", { className: "dstv_dSection", children: [
						jsxs("div", { className: "dstv_dSecHead", children: [
							jsx("span", { children: `🧠 ${t("detail.systemPrompt")}` }, "spHead"),
							jsx("span", { className: "sub", children: `${fmtInt(req.prompt.systemChars)} ${t("detail.chars")}` }, "spLen"),
							jsx("span", { className: "grow" }, "spGrow"),
							jsx(CopyBtn, { text: sysJson, label: t("detail.copy"), okLabel: t("detail.copied"), failLabel: t("anchor.copyFailed") }, "spCopy")
						] }, "spSecHead"),
						jsxs("details", { className: "dstv_det", open: false, children: [
							jsx("summary", { children: [t("detail.systemPrompt")] }, "spSum"),
							jsx("div", { className: "inner", children: jsx("div", { className: "dstv_code", style: { maxHeight: 220 }, children: req.prompt.system || "…" }, "spCode") }, "spInner")
						] }, "spDet")
					] }, "spSec") : null,
					// tool catalog
					tools.length > 0 ? jsxs("div", { className: "dstv_dSection", children: [
						jsxs("div", { className: "dstv_dSecHead", children: [
							jsx("span", { children: `🛠 ${t("detail.toolsCatalog")}` }, "tcHead"),
							jsx("span", { className: "sub", children: `${tools.length} ${t("detail.toolCount")}` }, "tcLen"),
							jsx("span", { className: "grow" }, "tcGrow"),
							// Must match `sysJson` above, which already uses the safe serializer:
							// the copy button would otherwise throw on the same descriptor that
							// renders fine, and the throw happens during render, not on click.
							jsx(CopyBtn, { text: sysToolsJson, label: t("detail.copy"), okLabel: t("detail.copied"), failLabel: t("anchor.copyFailed") }, "tcCopy")
						] }, "tcSecHead"),
						jsxs("details", { className: "dstv_det", open: false, children: [
							jsx("summary", { children: [`${t("detail.toolsCatalog")} (${tools.length})`] }, "tcSum"),
							jsx("div", { className: "inner", children: tools.map((tool) => jsxs("details", { className: "dstv_det", open: false, children: [
								jsx("summary", { children: [jsx("span", { className: "tname", children: tool.name !== "" ? tool.name : t("detail.toolUnnamed") }, "tn"), jsx("span", { className: "sub", children: firstLine(tool.description) }, "td")] }, `ts${tool.name}`),
								jsx("div", { className: "inner", children: jsx("div", { className: "dstv_code", style: { maxHeight: 160 }, children: prettyJson(tool.parameters) }, "tcCode") }, `ti${tool.name}`)
							] }, `tool${tool.name}`)) }, "tcInner")
						] }, "tcDet")
					] }, "tcSec") : null,
					// usage
					usage !== null && usage.input + usage.output > 0 ? jsxs("div", { className: "dstv_dSection", children: [
						jsx("span", { className: "dstv_dLabel", children: `📊 ${t("detail.usage")}` }, "uLbl"),
						jsx("div", { className: "dstv_cfgChips", children: [
							usage.input > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["in ", jsx("b", { children: fmtInt(usage.input) }, "v")] }, "uIn") : null,
							usage.raw > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["fresh ", jsx("b", { children: fmtInt(usage.raw) }, "v")] }, "uFresh") : null,
							usage.cacheRead > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["cache-read ", jsx("b", { children: fmtInt(usage.cacheRead) }, "v")] }, "uCR") : null,
							usage.cacheWrite > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["cache-write ", jsx("b", { children: fmtInt(usage.cacheWrite) }, "v")] }, "uCW") : null,
							usage.output > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["out ", jsx("b", { children: fmtInt(usage.output) }, "v")] }, "uOut") : null,
							usage.think > 0 ? jsx("span", { className: "dstv_cfgChip", children: ["think ", jsx("b", { children: fmtInt(usage.think) }, "v")] }, "uThink") : null
						] }, "uChips")
					] }, "uSec") : null,
					// messages
					messages.length > 0 ? jsxs("div", { className: "dstv_dSection", children: [
						jsxs("div", { className: "dstv_dSecHead", children: [
							jsx("span", { children: `💬 ${t("detail.messages")}` }, "mHead"),
							jsx("span", { className: "sub", children: `${messages.length} ${t("detail.msgCount")}` }, "mLen"),
							jsx("span", { className: "grow" }, "mGrow"),
							jsx(CopyBtn, { text: payloadJson, label: t("detail.copy"), okLabel: t("detail.copied"), failLabel: t("anchor.copyFailed") }, "mCopy")
						] }, "mSecHead"),
						jsxs("span", { className: "dstv_dLabel sec", children: [
							t("detail.requestApprox"),
							evidenceChips.length > 0 ? jsx("span", { className: "dstv_evRow", children: evidenceChips.map((e) => jsx("span", {
								key: e.id,
								className: `dstv_ev dstv_ev-${e.level}`,
								title: t(`evidence.${e.level}Tip`),
								children: t(`evidence.${e.level}`)
							}, e.id)) }, "evRow") : null
						] }, "mNote"),
						jsx("div", { className: "dstv_dBody", style: { padding: 0 }, children: messages.map((m, i) => {
							const preview = m.text !== "" ? m.text : (m.role === "tool" ? `${m.toolCallId ?? ""}${m.isError ? " ✗" : ""}` : "…");
							// Key on the message's OWN identity, not its position. This list is
							// rebuilt whenever the station window grows backwards, and paging
							// PREPENDS messages: index 3 stops being the message it was, so React
							// reused the DOM node and the row that was expanded started showing a
							// different message's body. `seq` is the durable record number; the
							// hash fallback keeps abnormally shaped nodes unique anyway.
							const msgKey = `m${m.seq != null ? `s${String(m.seq)}` : `x${String(i)}`}-${m.role}`;
							return jsxs("details", { className: "dstv_det", open: i === messages.length - 1, children: [
								jsx("summary", { children: [jsx("span", { className: `dstv_msgRole ${m.role}`, children: m.role === "note" ? t("node.compaction") : m.role }, "mr"), jsx("span", { className: "dstv_msgPrev", children: firstLine(preview) }, "mp"), jsx("span", { className: "sub", children: String(m.text.length) }, "ml")] }, `${msgKey}s`),
								jsx("div", { className: "inner", children: jsx("div", { className: "dstv_code", style: { maxHeight: 200 }, children: m.text !== "" ? m.text : safeJsonPreview(m.content, Number.MAX_SAFE_INTEGER, 2) }, "mc") }, `${msgKey}i`)
							] }, msgKey);
						}) }, "mList")
					] }, "mSec") : null
				] }, "reqBody");
			};

			let dStatus = null;
			if (activeLive) {
				dStatus = jsxs("span", { className: "dstv_chip run", children: [jsx("i", { className: "dstv_dot", "data-live": true }, "stDot"), t("chip.running")] }, "dStatus");
			} else if (activeError) {
				dStatus = jsxs("span", { className: "dstv_chip err", children: [jsx("span", { className: "dstv_bad", children: "✗" }, "stIc"), t("meta.error")] }, "dStatus");
			} else if (activeStation.kind === "step" && activeStation.interrupted === true) {
				dStatus = jsxs("span", { className: "dstv_chip retry", children: [jsx("span", { className: "dstv_bad", style: { background: "var(--dstv-warn)" }, children: "⏹" }, "stIc"), t("chip.interrupted")] }, "dStatus");
			} else {
				dStatus = jsxs("span", { className: "dstv_chip", children: [jsx("span", { className: "dstv_ok", children: "✓" }, "stIc"), t("status.done")] }, "dStatus");
			}

			const badgeCls = activeStation.kind === "user" ? "user" : activeStation.kind === "error" ? "error" : (activeStation.kind === "compaction" || activeStation.kind === "retry" || activeStation.kind === "command" || activeStation.kind === "maxTokens" || activeStation.kind === "orphan-tool" || activeStation.kind === "unknown") ? "violet" : "";
			const badgeText = activeStation.label;
			const activeModel = activeStation.kind === "step" ? (activeStation.request?.config?.model ?? activeStation.modelHint ?? null) : (activeStation.kind === "compaction" ? activeStation.crequest?.config?.model ?? null : null);
			const activeClock = fmtClock(activeStation.time);

			const detail = jsxs("div", {
				className: `dstv_detail${panelFull ? " full" : ""}`,
				children: [
					canRequest ? jsxs("div", { className: "dstv_tabs", children: [
						// These are tab-like in appearance but do not follow the tab pattern
						// (no tablist/tab/tabpanel wiring). Exposing the state as
						// `aria-pressed` tells a screen reader which view is active without
						// claiming a role the markup cannot honour.
						jsx("button", { type: "button", className: "dstv_tab", "data-on": showTab === "detail" ? "true" : undefined, "aria-pressed": showTab === "detail" ? "true" : "false", onClick: () => setTab("detail"), children: `🧭 ${t("tab.detail")}` }, "tabDetail"),
						// Only latch the request tab when there IS a request to show. `showTab`
						// already falls back to the detail view, so the button looked inert — but
						// the state stayed "request", and the moment the reader stepped to a
						// station that DOES have a request the panel jumped to it without anyone
						// pressing anything. `r` has this guard; the button did not.
						jsx("button", { type: "button", className: "dstv_tab", "data-on": showTab === "request" ? "true" : undefined, "aria-pressed": showTab === "request" ? "true" : "false", onClick: () => { if (canRequest) setTab("request"); }, children: `📨 ${t("tab.request")}` }, "tabRequest")
					] }, "dTabs") : null,
					jsxs("div", {
						className: "dstv_dHead",
						children: [
							jsx("span", { className: `dstv_dBadge ${badgeCls}`, children: badgeText }, "dBadge"),
							dStatus,
							activeStation.tag !== null && activeStation.tag !== void 0 ? jsx("span", { className: "dstv_chip", children: activeStation.tag }, "dTg") : null,
							activeStation.kind === "step" && activeStation.durationMs != null
								? jsx("span", { className: "dstv_chip info", children: `⏱ ${fmtMs(activeStation.durationMs)}` }, "dDur")
								: activeStation.kind === "step" && activeStation.timingRecorded === false
									? jsx("span", { className: "dstv_chip", title: t("timing.notRecordedHint"), children: `⏱ ${t("timing.notRecorded")}` }, "dDurNo")
									: activeStation.kind === "step" && (activeStation.startMs == null || activeStation.endMs == null)
										? jsx("span", { className: "dstv_chip warn", title: t("timing.edgeOutsideHint"), children: `⏱ ${t("timing.partial")}` }, "dDurPart")
										: null,
							activeStation.kind === "step" && activeStation.ttftMs != null ? jsx("span", { className: "dstv_chip", children: `${t("chip.ttft")} ${fmtMs(activeStation.ttftMs)}` }, "dTtft") : null,
							activeStation.kind === "step" && activeStation.decodeRate != null ? jsx("span", { className: "dstv_chip violet", children: `⚡ ${activeStation.decodeRate.toFixed(1)} tok/s` }, "dRate") : null,
							activeModel != null ? jsx("span", { className: "dstv_modelChip", title: activeModel, children: `🤖 ${activeModel}` }, "dModel") : null,
							activeClock !== "" ? jsx("span", { className: "dstv_chip", children: `${t("detail.time")} ${activeClock}` }, "dTime") : null,
							(() => {
								const av = anchorOf(activeStation);
								if (av === null) return null;
								// Do not offer an anchor that does not come back to THIS card:
								// `e<seq>` names a seq, and one seq can carry several stations
								// (a turn-error shares the assistant's seq). The resolver prefers
								// the step, so this button used to copy an identity that jumped
								// to a different record when pasted.
								if (!anchorResolvesToSelf(activeStation, stations)) return null;
								return jsx("span", { className: "dstv_anchorWrap", title: av, children: jsx(CopyBtn, { text: av, label: `🔗 ${t("anchor.copy")}`, okLabel: t("anchor.copied"), failLabel: t("anchor.copyFailed") }, "dAnchor") }, "dAnchorWrap");
							})(),
							activeStation.synthetic === true ? jsx("span", { className: "dstv_chip warn", children: t("anchor.notPersisted") }, "dSynth") : null,
								// Shown once, in the header: the same note used to render here as well, so
							// every anchor result appeared twice on screen.
							jsx("span", { className: "dstv_dPos", children: `${t("detail.position")} ${String(activeIdx + 1)} / ${N}` }, "dPos"),
							jsx(CopyBtn, {
								text: stepMarkdown,
								label: `📋 ${t("action.exportStep")}`,
								okLabel: t("anchor.copied"),
								failLabel: t("anchor.copyFailed")
							}, "dExportStep"),
							jsx("button", { type: "button", className: "dstv_btn dstv_panelToggle", title: panelFull ? t("action.collapsePanel") : t("action.expandPanel"), onClick: () => setPanelFull((v) => !v), children: panelFull ? "⤡" : "⤢" }, "dToggle")
						]
					}, "dHead"),
					// The key must include WHAT is being rendered, not just where. An error
					// boundary keeps its error state until it is unmounted or the user presses
					// retry, so a fixed key pinned one station's crash onto every later
					// station: selecting a perfectly good record still showed "render failed"
					// and only a manual retry cleared it. Switching tabs had the same problem.
					// Station cards already key on `card${s.id}`; this boundary was the one
					// place that forgot, because there is only one of it.
					jsx(RenderBoundary, {
						label: t("error.render"),
						retryLabel: t("error.retry"),
						hint: t("error.renderHint"),
						wide: true,
						render: () => (showTab === "request" && canRequest
							? activeStation.kind === "compaction" ? renderCompactionRequestBody(activeStation) : renderRequestBody(activeStation, activeMessages)
							: renderDetailBody(activeStation))
					}, `dBodySafe:${String(activeStation.id)}:${showTab}`)
				]
			}, "rootDetail");

			const kpis = jsxs("div", {
				className: "dstv_kpis",
				children: [
					jsxs("span", { className: "dstv_kpi", children: [jsx("b", { children: String(stats.turns) }, "kvNum"), jsx("span", { children: t("node.turn") }, "kvLbl")] }, "kTurns"),
					jsxs("span", { className: "dstv_kpi", children: [jsx("b", { children: String(stats.steps) }, "kvNum"), jsx("span", { children: t("node.step") }, "kvLbl")] }, "kSteps"),
					jsxs("span", { className: "dstv_kpi", children: [jsx("b", { children: String(stats.tools) }, "kvNum"), jsx("span", { children: t("node.tool") }, "kvLbl")] }, "kTools"),
					jsxs("span", { className: `dstv_kpi${stats.errors > 0 ? " err" : ""}`, children: [jsx("b", { children: String(stats.errors) }, "kvNum"), jsx("span", { children: t("kpi.errors") }, "kvLbl")] }, "kErr"),
					jsxs("span", { className: "dstv_kpi", children: [jsx("b", { children: fmtDur(stats.toolMs) }, "kvNum"), jsx("span", { children: t("kpi.toolTime") }, "kvLbl")] }, "kDur"),
					stats.tokensIn > 0 ? jsxs("span", { className: "dstv_kpi", children: [jsx("b", { children: fmtTokens(stats.tokensIn) }, "kvNum"), jsx("span", { children: t("kpi.tokensIn") }, "kvLbl")] }, "kTokIn") : null,
					stats.tokensOut > 0 ? jsxs("span", { className: "dstv_kpi", children: [jsx("b", { children: fmtTokens(stats.tokensOut) }, "kvNum"), jsx("span", { children: t("kpi.tokensOut") }, "kvLbl")] }, "kTokOut") : null,
					live ? jsxs("span", { className: "dstv_kpi liveKpi", children: [jsx("i", { className: "dstv_dot", "data-live": true }, "kvDot"), jsx("b", { children: `${t("stat.current")} ${t("node.step")} ${String(tree.currentStepNo ?? "")}` }, "kvTxt")] }, "kLive") : null
				]
			}, "rootKpi");

			return jsxs("div", {
				className: "dstv_root",
				tabIndex: 0,
				onKeyDown,
				// Opt into the host's overlapping composer layout. The host detects this
				// attribute and flips the composer seat to `position:absolute;bottom:0`
				// over a scroll container that no longer reserves room for it — the same
				// thing the official trajectory view does. Without it the composer takes
				// its default in-flow seat and our view sits *above* a permanently open
				// message box, which is wrong for a read-only replay surface.
				"data-conversation-composer-overlay": "",
				// ...but an overlay covers the last rows, so the panel still reserves room
				// it can scroll clear of.
				style: composerH > 0 ? { paddingBottom: `${composerH}px` } : undefined,
				children: [header, jsx("div", { className: "dstv_progress", children: jsx("i", { style: { width: `${Math.round((R / N) * 100)}%` } }, "progFill") }, "rootProg"), kpis, minimapTicks, body, detail]
			});
		}
		//#endregion
