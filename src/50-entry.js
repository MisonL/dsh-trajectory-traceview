		//#region plugin entry point
		/** Services required by apply(): the slot registry, the locale service, and the sessions service (for loadOlder history paging). */
		const inject = ["slots", "locale", "sessions"];
		/**
		 * Client plugin body: register the 轨迹视图 (Trace View) conversation tab,
		 * seated to the right of the trajectory tab (order 20 > trajectory's 10).
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "traceview: dictionaries");
			const t = ctx.locale.bind(NS);
			// Register through a boundary so a failure in the shell (not just in one
			// station) still leaves a readable notice instead of a blank tab.
			const SafeTraceMapView = (props) => jsx(RenderBoundary, {
				label: t("error.render"),
				retryLabel: t("error.retry"),
				hint: t("error.renderHint"),
				wide: true,
				render: () => jsx(TraceMapView, props)
			}, "viewSafe");
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "traceview-plus",
				order: 21,
				locale: NS,
				label: () => t("view.label"),
				inject: (sessionId) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) return {};
					return {
						// The view resets its per-session UI state when this changes. Without it,
						// switching conversations kept the previous one's replay position: the
						// reveal counter survived, `R` was merely clamped to the new station
						// count, so opening a fresh 5-station session while sitting on station
						// 40 of another showed it fully expanded as if already replayed.
						sessionKey: String(sessionId),
						// "Did the window grow?" cannot be answered by comparing snapshots.
						// The host's loadOlder SWALLOWS its own failures: it resolves normally
						// and only flips `historyLoadStatus` to 'error' (verified in
						// dsh-api-session-controller/src/client/sessions/session.ts:432). So a
						// failed page still returns a NEW snapshot object and this comparison
						// reported "progress":
						//   - the view's `.catch()` never fired, so a failed page showed no
						//     message at all — the button spun and came back unchanged;
						//   - the anchor paging loop treats `moved !== true` as "no progress"
						//     and breaks, so a failing page kept it retrying up to 40 times.
						// Read the host status instead, and rethrow so callers can report it.
						loadOlder: async () => {
							const before = session.getSnapshot();
							await session.loadOlder();
							const after = session.getSnapshot();
							const failed = after.historyLoadStatus === "error" && before.historyLoadStatus !== "error";
							if (failed) throw new Error("loadOlder failed");
							return after !== before;
						}
					};
				}
			}, SafeTraceMapView));
		}
		exports.apply = apply;
		exports.inject = inject;
