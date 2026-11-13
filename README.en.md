# 轨迹视图 · Trace View

<div align="center">
  <a href="README.md">中文</a> · <b>English</b>
</div>

> **Render the AI execution flow of a DeepSeek Harness Web GUI session as a replayable, horizontal timeline — every step's actions and every raw request sent to the model, laid out in front of you.**
> Built for learning and tuning prompts: wondering why the AI answered that way? Open Trace View to see what it reasoned about, which tools it called, what results it got, and the actual message payload it saw at the time.

> **This is the Plus edition, not upstream.** Built on [AFAP/dsh-trajectory-traceview](https://github.com/AFAP/dsh-trajectory-traceview) (MIT): every upstream capability is kept, plus stable anchors, orphan tool-result stations, inline durations, a clock axis, and an explicit search-scope badge. **Do not install both** (you would get two "Trace View" tabs) — run `dsh plugin --profile web remove dsh-trajectory-traceview` first.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/MisonL/dsh-trajectory-traceview)](https://github.com/MisonL/dsh-trajectory-traceview/releases)

---

## 1. The problem it solves

Reconstructing "how did the AI actually execute this session?" with the built-in trajectory tab means flipping through a bare event list; and "what exactly was sent to the model for that request?" (system prompt, tool catalog, rebuilt messages) is invisible — the data lives in the session's internal state with no picture to look at.

This plugin adds a "**Trace View**" tab right next to the "轨迹" tab, rendering the same session state as an **interactive, searchable, exportable horizontal timeline**:

```
session trajectory (views.get("trajectory") snapshot — reuses official data as-is)
  │
  ├─ top minimap: time-ordered station blocks, click to jump
  ├─ horizontal timeline: real wall-clock labels, ◀ ▶ step-by-step replay
  ├─ bottom [Step Detail]: reasoning / tool args / full results / sub-calls / timings
  ├─ bottom [Raw Request]: the full context sent to the model for that step (prompt study)
  └─ header KPIs: turns / steps / tools / errors / duration / tokens + 📋 one-click Markdown
```

**Read-only**: it only re-renders the `TrajectorySnapshot` the session view has already produced; no file is modified, no network is touched, and the host half is a no-op stub.

## 2. Features

### Flow overview

- ✅ Horizontal timeline + top **minimap**: one color block per station (user=blue / step=green / tool=orange / compaction=purple / error=red / retry=yellow / command=cyan); click a block to jump instantly; the current station is highlighted during replay.
- ✅ Full event stream: user messages, assistant steps, tool calls, **context compaction**, **turn failures**, **model retries**, **max-output cutoffs** and **commands** all land on the timeline in time order; compaction / command events are pinned to their owning turn by `seq`.
- ✅ KPI bar: turns / steps / tool count / errors / total tool time / request & generation tokens, a live "current step" indicator, and the active model name.
- ✅ Stations are labeled with **real wall-clock time** (not event indexes).

### Finding what you want

- ✅ 🔍 **Search**: filter stations by tool name / args / body text / error name; hits get a gold outline plus a minimap highlight; `Enter` / `Shift+Enter` or `↑` `↓` step through hits; `/` or `f` focuses the search box, `Esc` clears.
- ✅ **⇤ / ⇥ turn jumps** (PageUp / PageDown): hop between turn start points.
- ✅ **⇣ follow mode**: while the AI is working, new stations auto-scroll into view; any manual navigation pauses following, ⏭ "show all" resumes it.
- ✅ **Inspect deep-link contract**: implements the session view's `inspect` protocol — if a tool-inspection request arrives while this tab is active, it locates the station containing that call.
- ✅ **⬆ load older history**: one-click paging for events outside the long-session window (reuses the session's `hasMore` / `loadOlder`).
- ✅ **Explicit search scope** (Plus): search only covers the **currently loaded** trace, so the hit counter carries a `⬆ loaded range only` badge — click it to page in one more chunk, and the newly loaded stations join the search immediately. Unloaded history is **never** reported as "no match".

### Locatable, copyable stations (Plus)

- ✅ 🔗 **Stable anchors**: every station has a copyable reference (🔗 in the detail header) such as `tvp1:e3019`. Paste it into the 🔗 box in the toolbar and press Enter; **the address bar mirrors it as `#tvp1:e3019`**, so the link survives a reload and can be shared.
- ✅ **Cross-page locating**: when the target sits in unloaded history, older pages are pulled automatically until it appears (page-bounded; on hitting the cap it says "not in the loaded window" instead of pretending to succeed).
- ✅ **Honest about synthetic records**: records that are not yet durable (an interrupted assistant message, a tool call cut off mid-flight) get a `tvp1:p3s7`-style anchor and are explicitly marked "not persisted, not deep-linkable" instead of handing out a link that dies on reload.
- ✅ **Orphan tool results still appear**: a `ToolResultNode` whose assistant header fell outside the window (`call === null`) is no longer lost — it becomes its own `orphan-tool` station, searchable and locatable like any other.

### Time you can actually see (Plus)

- ✅ **Inline start/end times**: each step card shows `14:24:21 → 14:24:53` directly — no hover, no detail panel.
- ✅ **Honest duration provenance**: "has timing" / "no timing recorded" / "partial timing" are three distinct states — a missing record is never rendered as 0.
- ✅ **Idle bands**: gaps longer than 30 s between two actions are labeled on the rail (`⏸ 47,628 ms`), answering "what were those 4 hours spent on".
- ✅ **⏱ even / clock toggle**: even spacing for reading, clock mode scales idle bands logarithmically so long waits are visible at a glance.

### What each step did (bottom "Step Detail")

- ✅ Assistant output text and 💭 reasoning content (collapsible).
- ✅ Every tool call: args (formatted JSON), **full tool result**, a **complete sub-call card** (each sub-call's own args / result / duration / error), a duration bar, and the error code.
- ✅ Step-level metadata: ⏱ total step duration, time-to-first-token (TTFT), ⚡ decode throughput tok/s, token usage, and a "stopped" interruption flag.
- ✅ The detail panel can be ⤢ expanded to full height / ⤡ collapsed.

### Raw request (bottom "Raw Request" tab, shortcut `r`)

- ✅ **Model config**: provider / model / temperature / reasoningEffort / thinking / maxTokens / stop / status / duration / retry info.
- ✅ **⚡ Prompt diff**: what changed versus the previous request — system-prompt character delta and `+ added` / `- removed` tool names (`initial` = the first system prompt).
- ✅ **Full system prompt**: character count + one-click copy (includes the tool-catalog JSON).
- ✅ **Tool catalog**: every tool schema carried by that request, expanded one by one; copyable.
- ✅ **Message list**: the model-visible messages **approximately rebuilt** from the session log (user / assistant / tool results, with compaction markers), each expandable in full; the whole request payload JSON is copyable. It is rebuilt **only while this tab is open** (lazy — long sessions stay snappy).
- ✅ **Token usage**: inbound (incl. cache reads / writes) and outbound (incl. thinking) breakdown.
- ✅ **Context-compaction stations** have their own "Raw Request" too: the compaction request's model / duration / usage plus the **full compaction output**.

### Export study notes

- ✅ Header **📋 Markdown**: one click copies the whole trace as Markdown — each step's reasoning / text / tool args / results and a per-step request-config summary, plus an appendix with the first request's system prompt and tool catalog.

## 3. Preview

| Trace View overview (timeline + minimap + bottom detail / raw-request panels) |
|:---:|
| ![Trace View preview](screenshot/overview.jpg) |

## 4. Directory layout

```
dsh-trajectory-traceview/   # repo root (npm package name is dsh-trajectory-traceview-plus)
├── package.json            # dsh.bundle.patch + dsh.client (browser declaration) + exports["./client"]
├── cordis.patch.yml        # composition row: a single plugin record (no route, no config)
├── LICENSE                 # MIT
├── screenshot/             # screenshots for the README "Preview" section
├── test/
│   └── smoke.test.cjs      # zero-dependency helper unit tests (plain node)
└── lib/
    ├── index.js            # host half: no-op stub (browser-only plugin)
    └── client.js           # browser bundle: the trace view (timeline / minimap / detail / raw request)
```

## 5. Quick start

One-line install (GitHub):

```powershell
dsh plugin --profile web add github:MisonL/dsh-trajectory-traceview
```

Then **restart `dsh web`** to take effect.

> After installation the plugin lives at `$DSH_HOME\profiles\web\node_modules\dsh-trajectory-traceview-plus` (cloned by pnpm from GitHub), independent of the source checkout location.

Upgrade:

```powershell
dsh plugin --profile web update dsh-trajectory-traceview-plus
```

Uninstall:

```powershell
dsh plugin --profile web remove dsh-trajectory-traceview-plus
```

### Manual install from a source directory (for equivalent verification)

```powershell
dsh plugin --profile web add "G:\path\to\dsh-trajectory-traceview"
```

### Verify it loaded

Open any session with an AI execution trace → a "Trace View" tab appears next to the built-in trajectory tab → clicking it shows the horizontal timeline and minimap.

## 6. Usage

1. Open any session that has an AI execution trace.
2. Click the "Trace View" tab: the minimap at the top thumbnails every station; the timeline below is ordered by real wall-clock time.
3. **Browse / replay**: ◀ ▶ or the arrow keys step through stations; ▶ auto-replays (×1 / ×2 / ×4 speeds); Space toggles play / pause.
4. **Search**: press `/` to focus the search box, type a tool name / arg / body text / error name, and press Enter to hop between hits.
5. **Select any assistant step**: the bottom "Step Detail" shows its reasoning, text and every tool call's args / results / sub-calls / timing; switch to the "Raw Request" tab (`r`) to study the full context that request sent to the model.
6. **Export notes**: click the 📋 header button to copy the whole trace as Markdown.
7. **Long sessions**: click ⬆ to load older history; switch on ⇣ follow mode while the AI is working.

## 7. Shortcuts

| Key | Action |
|---|---|
| `←` / `→` | previous / next station |
| `Home` / `End` | jump to the start / end |
| `Space` | play / pause replay |
| `PageUp` / `PageDown` | previous / next turn start |
| `/` or `f` | focus the search box |
| `↑` / `↓` (searching) | previous / next search hit |
| `Enter` / `Shift+Enter` (searching) | next / previous hit |
| `Esc` | clear search / dismiss |
| `r` | toggle the "Raw Request" panel |

## 8. Implementation notes (data sources)

| Concern | Approach |
|---|---|
| Data source | Reuses ONLY the `views.get("trajectory")` snapshot (`TrajectorySnapshot`) of the DSH Web session state: `eventNodes` (with `timing` / `usage` / `provenance` / `interrupted`), `requests` (assistant + compaction requests), `callSchemas` (tool schemas at call time), `partial` / `runningCalls` (live streaming state), plus the session-level `hasMore` / `loadOlder` paging. |
| Raw request | The "message list" is an **approximately rebuilt** payload from the session log (the original messages array is not snapshotted); the panel marks it "approximate" — precise enough for prompt study. |
| Laziness | The message list is rebuilt only when the "Raw Request" tab is opened — long sessions stay responsive. |
| Mounting | Registers the new tab beside the session view's built-in trajectory tab via `dsh.client.inject` (`dsh-client-runtime` / `dsh-client-locale` / `dsh-client-ui-conversation`). |
| Deep link | Implements the session view's `inspect` protocol: when a tool-inspection request arrives, it locates the station containing that call. |

## 9. Troubleshooting

| Symptom | Where to look |
|---|---|
| "Trace View" tab missing | Confirm `dsh web` was restarted; search F12 Console for `dsh-trajectory-traceview-plus`. |
| Timeline empty / no stations | The session needs an AI execution trace (user message → assistant steps); brand-new sessions show the empty-state hint. |
| Search finds nothing | The search term must match a tool name / arg / body text / error name. |
| Message list differs from the real request | The list is an approximate rebuild (the original messages array is not snapshotted) — the panel marks this; treat the system prompt and tool catalog as authoritative. |
| Old sessions feel slow | Only opening the "Raw Request" tab rebuilds the message list; plain timeline browsing is unaffected. |

## 10. Security & compliance

- **Read-only**: only renders the `TrajectorySnapshot` the session view already produced; no business-DOM mutation, no file modification or deletion, no host route, no network access.
- **Local data**: everything is processed inside the browser; the raw request is rebuilt only when you open its panel, and nothing is written to storage.
- **No persistence**: nothing written to localStorage / cookies; uninstalling leaves no trace.

## 11. Development & build

Plain JS, no build step. `lib/index.js` (host half) is a no-op stub; `lib/client.js` is a classic script (`window.__ModuleLoader__.load`) served directly by the client module system.

```powershell
node test/smoke.test.cjs
```

The tests run the helper region against mock snapshots covering: tree building / request attachment / compaction-request pairing / sub-call detail / prompt diff / step timing / search matching / Markdown export / token stats.

## 12. Compatibility and data contract

This plugin reads the official trajectory snapshot (`eventNodes` / `requests` / `callSchemas` / `partial` / `runningCalls`). Because that snapshot comes from another plugin and the contract is not ours, there are two explicit promises:

- **Malformed data never crashes the page**: `null`, wrong types and missing fields are skipped with an explicit `⚠ N record(s) malformed` notice.
- **Version drift is stated loudly**: if a DSH upgrade renames fields or node kinds, the header shows `⚠ N record(s) not recognized [kinds]`; if *nothing* is recognizable you get "Cannot recognize this session's trajectory data" with reason codes — **never a silent "no data yet" or a plausible-looking partial trace**.
- **The host is never accused wrongly**: `kind: "unknown"` is a *named* node kind in the contract (the host saying "I do not model this event"), so it renders as a first-class station carrying the event type and its raw payload, and it is **not** counted as drift. Only genuinely unseen kinds raise the alarm — one exotic event must not make the whole tree claim the format is unrecognized.

`engines.dsh` is pinned to `=0.2.2-rc.2` (verified live on 2026-11-14). The earlier `=0.2.1-rc.5` conclusions are kept in `docs/DESIGN.md` §12.25–§12.27.

**Why a hard pin instead of a range**: DSH validates `engines.dsh` at boot and *skips* an unmatched plugin outright (`skipping profile bundle … requirements {"engines.dsh":…}`) instead of degrading. Getting the pin wrong therefore makes the whole tab vanish — louder and easier to explain than a build that looks fine and misbehaves inside.

## 13. License

MIT. Upstream © [AFAP](https://github.com/AFAP/dsh-trajectory-traceview); this Plus edition is a derivative of v0.3.0, released under the same MIT terms with the original copyright notice kept.

Substantive changes versus upstream: stable anchors and deep-link parsing, orphan tool-result stations, inline step start/end with three-state duration provenance, idle bands and the clock axis, search-scope badge, and package/view ids renamed to `-plus` / `traceview-plus` (order 21) so the two never collide.

---

> **Disclaimer**: This plugin is a local learning / debugging tool. The authors are not responsible for any decision made based on trace data (including approximately rebuilt message payloads); please don't share session traces containing sensitive content on shared / multi-user screens.