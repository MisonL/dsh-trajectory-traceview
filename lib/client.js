window.__ModuleLoader__.load({
	id: "dsh-trajectory-traceview-plus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		const jsx = react_jsx_runtime.jsx;
		const jsxs = react_jsx_runtime.jsxs;
		const fragment = react.Fragment;

		//#region locale dictionaries
		/** `trajectoryTraceView` namespace dictionaries (tab label + panel strings). */
		const NS = "trajectoryTraceView";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"note.wrapL": "『", "note.wrapM": "（", "note.wrapR": "）』",
			"block.image": "[图片]",
			"block.other": "[其他内容]",
			"block.file": "[文件]",
			"note.compaction": "上下文压缩：",
			"note.compacted": "历史已压缩",
			"note.replace": "替换",
			"note.items": "项",
			"note.about": "约",
			"view.label": "轨迹视图",
			"view.root": "会话轨迹",
			"view.incompatible": "无法识别当前会话的轨迹数据格式（可能是 DSH 版本不兼容）",
			"view.incompatibleHint": "本插件读取的是官方轨迹快照。如果 DSH 升级后字段结构发生变化，你会看到这条提示而不是崩溃或一片空白。请检查插件是否有对应 DSH 版本的更新。",
			"view.drift": "{n} 条记录无法识别",
			"view.malformed": "{n} 条记录结构异常",
			"view.malformedTip": "这些记录的字段形状不符合预期（不影响其余记录的显示）。通常意味着 DSH 版本与本插件不匹配，或日志被截断。",
			"view.driftTip": "这些记录的类型不在本插件已知范围内，已在时间轴上跳过；其余记录正常显示。若数量较大，通常意味着 DSH 版本与本插件不匹配。",
			"view.invalid": "{n} 条记录结构异常",
			"view.invalidTip": "这些记录缺少 kind 或 seq 等必要字段，已跳过。",
			"view.loading": "正在读取会话轨迹…",
			"view.empty": "暂无轨迹数据\n发送消息后，这里会以横向时间轴展示 AI 的执行流程：每一步的思考、工具调用与结果，以及每次发给大模型的原始请求，便于学习提示词。",
			"node.turn": "轮次",
			"node.systemTurn": "系统事件",
			"node.step": "步骤",
			"node.user": "用户",
			"node.assistant": "助手",
			"node.tool": "工具",
			"node.subtool": "子调用",
			"node.context": "上下文",
			"node.compaction": "上下文压缩",
			"node.error": "轮次失败",
			"node.retry": "模型重试",
			"node.maxTokens": "输出超限",
			"node.command": "命令",
			"node.unknown": "未知事件",
			"error.render": "这一块渲染失败",
			"anchor.jumpLabel": "锚点输入框：粘贴站点锚点后回车定位",
			"search.label": "搜索站点",
			"error.retry": "重试",
			"error.renderHint": "其余部分不受影响：换个站点或重试即可继续。",
			"detail.eventType": "事件类型",
			"detail.rawPayload": "原始数据",
			"meta.steps": "步",
			"meta.tools": "次工具",
			"meta.stepDur": "步骤耗时",
			"meta.toolDur": "工具耗时",
			"meta.turns": "个轮次",
			"meta.error": "出错",
			"meta.tokens": "tokens",
			"stat.current": "当前",
			"kpi.toolTime": "工具总耗时",
			"kpi.tokensIn": "请求 tokens",
			"kpi.tokensOut": "生成 tokens",
			"kpi.errors": "错误",
			"status.done": "已完成",
			"status.retry": "重试",
			"detail.args": "调用参数",
			"detail.noArgs": "（无参数）",
			"detail.subCalls": "子调用",
			"detail.position": "站点",
			"detail.result": "工具结果",
			"detail.noResult": "（无结果内容）",
			"detail.time": "时间",
			"detail.requestApprox": "以下消息列表为按会话日志近似重建的请求载荷（与真正发出的大致一致，便于学习提示词）。",
			"evidence.exact": "原始记录",
			"evidence.exactTip": "直接来自会话日志的字段，未经推断。",
			"evidence.reconstructed": "近似重建",
			"evidence.reconstructedTip": "按会话日志重新拼出，供学习参考；它不是服务端实际收到的原始字节，不要把它当成唯一证据。",
			"evidence.partial": "可能不全",
			"evidence.partialTip": "窗口外的部分不在本地，当前结果可能缺少早期上下文。",
			"detail.items": "项",
			"detail.request": "请求配置",
			"detail.systemPrompt": "系统提示",
			"detail.toolsCatalog": "工具目录",
			"detail.messages": "消息列表",
			"detail.copy": "复制",
			"detail.copied": "已复制",
			"anchor.copy": "复制锚点",
			"anchor.copied": "已复制",
			"anchor.notPersisted": "未持久化，不可深链",
			"anchor.notLoaded": "该记录不在当前窗口，需先拉取更早历史",
			"anchor.capped": "已向前翻页 {n} 页仍未找到；可先手动点「加载更早历史」再重试",
			"anchor.bad": "锚点格式无法识别",
			"anchor.jump": "跳转到锚点",
			"anchor.clear": "清除锚点",
			"anchor.jumpPlaceholder": "粘贴锚点，如 tvp1:e3019，回车定位",
			"anchor.jumpTip": "粘贴任意站点详情里「复制锚点」得到的串，回车即可精确定位；目标在未加载的历史里时会自动向前翻页加载（有页数上限，超出会明确提示）。",
			"anchor.searching": "正在向前加载更早历史以定位…",
			"anchor.searchingPages": "正在向前加载更早历史以定位…（第 {n}/{max} 页，已载入 {stations} 站）",
			"anchor.upgraded": "该记录已落定，请改用 {ref}",
			"anchor.copiedLink": "已复制到你名下",
			"anchor.badInput": "无法识别的锚点",

			"detail.start": "开始",
			"detail.end": "结束",
			"gap.idle": "空闲",
			"node.orphanTool": "孤立工具结果",
			"orphan.badge": "调用不在窗口内",
			"orphan.noText": "（无结果文本）",
			"timing.notRecorded": "未记录耗时",
			"timing.notRecordedHint": "该步骤没有 timing 记录，无法得到耗时",
			"timing.partial": "耗时不全",
			"timing.edgeOutsideHint": "有 timing 记录，但开始或结束时刻在加载窗口之外",
			"action.clockAxis": "等距",
			"action.clockAxisOn": "按时钟",
			"action.clockAxisHint": "切换：站点等距排布 ↔ 空闲间隔按真实耗时缩放",
			"detail.chars": "字符",
			"detail.msgCount": "条消息",
			"detail.toolCount": "个工具",
			"detail.usage": "Token 用量",
			"detail.promptChanged": "系统提示/工具在此步骤前有变更",
			"chip.running": "运行中",
			"chip.error": "出错",
			"chip.retry": "重试",
			"chip.compacted": "已压缩",
			"chip.thinking": "思考",
			"action.toStart": "回到起点",
			"action.prev": "上一步",
			"action.play": "开始回放",
			"action.pause": "暂停",
			"action.toEnd": "显示全部",
			"action.speed": "回放速度",
			"action.locate": "定位当前",
			"action.search": "搜索站点（工具名 / 参数 / 文本）",
			"action.searchPrev": "上一个命中",
			"action.searchNext": "下一个命中",
			"action.searchClear": "清空搜索",
			"action.follow": "跟随最新：新事件自动滚入视野",
			"action.loadOlder": "加载更早历史",
			"action.loadingOlder": "正在加载更早历史…",
			"action.exportMd": "导出 Markdown：整段轨迹复制为学习笔记",
			"action.exported": "已复制",
			"action.expandPanel": "展开详情面板",
			"action.collapsePanel": "收起详情面板",
			"action.prevTurn": "上一个轮次",
			"action.nextTurn": "下一个轮次",
			"search.matches": "命中",
			"search.none": "无命中",
			"search.scopePartial": "仅已加载范围",
			"search.scopeLoading": "仅已加载 · 正在加载更早…",
			"search.scopeTip": "检索只覆盖当前已加载的轨迹；更早的历史还没加载进来，点这里可以加载更早历史。未加载的部分不会被判定为“无命中”。",
			"chip.interrupted": "已停止",
			"chip.ttft": "首 token",
			"diff.initial": "初始系统提示",
			"diff.system": "系统提示有变更",
			"diff.tools": "工具目录有变更",
			"diff.systemAndTools": "系统提示与工具均有变更",
			"diff.toolsAdded": "新增工具",
			"diff.toolsRemoved": "移除工具",
			"diff.systemDelta": "系统提示字符",
			"detail.promptDiff": "提示词变更",
			"export.stepTitle": "单步复盘",
			"action.exportStep": "复制本步复盘",
			"diff.toolsChanged": "工具定义变了",
			"diff.textDiff": "变更内容",
			"diff.startLine": "从第 {n} 行起",
			"diff.removed": "改前",
			"diff.added": "改后",
			"diff.truncated": "仅显示前 {n} 行",
			"diff.noText": "纯空白/换行差异",
			"detail.compactionOutput": "压缩产出全文",
			"export.title": "会话轨迹导出",
			"export.appendix": "附录：首个请求的系统提示与工具目录",
			"tab.detail": "步骤详情",
			"tab.request": "原始请求",
			"hint.text": "点击站点或 ▶ 回放 · ← → 逐站 / 空格播放 / ⇤⇥ 跳轮次 / “/” 搜索 · 底部面板展示每步详情与发给大模型的原始请求"
		};
		/** English dictionary. */
		const en = {
			"note.wrapL": "", "note.wrapM": " (", "note.wrapR": ")",
			"block.image": "[image]",
			"block.other": "[other content]",
			"block.file": "[file]",
			"note.compaction": "Context compacted: ",
			"note.compacted": "history compacted",
			"note.replace": "replaced",
			"note.items": "item(s)",
			"note.about": "about",
			"view.label": "Trace View",
			"view.root": "Session Trace",
			"view.incompatible": "Cannot recognize this session's trajectory data (DSH version may be incompatible)",
			"view.incompatibleHint": "This plugin reads the official trajectory snapshot. If DSH changed its field shape, you get this notice instead of a crash or a blank view. Check whether a plugin update matches your DSH version.",
			"view.drift": "{n} record(s) not recognized",
			"view.malformed": "{n} malformed record(s)",
			"view.malformedTip": "These records have unexpected field shapes (the rest still renders). Usually a DSH version mismatch or a truncated log.",
			"view.driftTip": "These record kinds are outside what this plugin knows, so they were skipped; everything else renders normally. A large number usually means a DSH version mismatch.",
			"view.invalid": "{n} record(s) malformed",
			"view.invalidTip": "These records lack required fields such as kind or seq, so they were skipped.",
			"view.loading": "Reading this session's trajectory…",
			"view.empty": "No trajectory data yet\nSend a message and the AI execution flow will appear here as a horizontal timeline: per-step thinking, tool calls and results, plus the raw requests sent to the model for prompt study.",
			"node.turn": "Turn",
			"node.systemTurn": "System events",
			"node.step": "Step",
			"node.user": "User",
			"node.assistant": "Assistant",
			"node.tool": "Tool",
			"node.subtool": "Sub-call",
			"node.context": "Context",
			"node.compaction": "Compaction",
			"node.error": "Turn error",
			"node.retry": "Model retry",
			"node.maxTokens": "Max tokens",
			"node.command": "Command",
			"node.unknown": "Unknown event",
			"error.render": "This block failed to render",
			"anchor.jumpLabel": "Anchor field: paste a station anchor and press Enter to locate it",
			"search.label": "Search stations",
			"error.retry": "Retry",
			"error.renderHint": "The rest of the view is unaffected: pick another station or retry.",
			"detail.eventType": "Event type",
			"detail.rawPayload": "Raw payload",
			"meta.steps": " steps",
			"meta.tools": " tool calls",
			"meta.stepDur": "step",
			"meta.toolDur": "tool",
			"meta.turns": " turns",
			"meta.error": "error",
			"meta.tokens": " tokens",
			"stat.current": "current",
			"kpi.toolTime": "Tool time",
			"kpi.tokensIn": "Prompt tokens",
			"kpi.tokensOut": "Output tokens",
			"kpi.errors": "Errors",
			"status.done": "Done",
			"status.retry": "Retry",
			"detail.args": "Call arguments",
			"detail.noArgs": "(no arguments)",
			"detail.subCalls": "Sub-calls",
			"detail.position": "Station",
			"detail.result": "Tool result",
			"detail.noResult": "(no result content)",
			"detail.time": "Time",
			"detail.requestApprox": "The message list below is a close reconstruction of the request payload from the session log (for prompt study).",
			"evidence.exact": "as recorded",
			"evidence.exactTip": "Taken verbatim from the session log; nothing inferred.",
			"evidence.reconstructed": "reconstructed",
			"evidence.reconstructedTip": "Reassembled from the session log for study. It is not the exact byte payload the server received; do not treat it as sole evidence.",
			"evidence.partial": "possibly incomplete",
			"evidence.partialTip": "History outside the loaded window is not local, so earlier context may be missing.",
			"detail.items": "items",
			"detail.request": "Request config",
			"detail.systemPrompt": "System prompt",
			"detail.toolsCatalog": "Tool catalog",
			"detail.messages": "Messages",
			"detail.copy": "Copy",
			"detail.copied": "Copied",
			"anchor.copy": "Copy anchor",
			"anchor.copied": "Copied",
			"anchor.notPersisted": "Not persisted; cannot deep-link",
			"anchor.notLoaded": "Not in the loaded window; load older history first",
			"anchor.capped": "Paged back {n} pages without finding it; load older history manually and retry",
			"anchor.bad": "Unrecognized anchor format",
			"anchor.jump": "Jump to anchor",
			"anchor.clear": "Clear anchor",
			"anchor.jumpPlaceholder": "Paste an anchor (e.g. tvp1:e3019) and press Enter",
			"anchor.jumpTip": "Paste the string produced by \"Copy anchor\" in any station detail, then press Enter. If the target sits in unloaded history, older pages are loaded automatically (page-bounded; you are told when the bound is hit).",
			"anchor.searching": "Loading older history to locate it…",
			"anchor.searchingPages": "Loading older history to locate it… (page {n}/{max}, {stations} stations loaded)",
			"anchor.upgraded": "This record is now durable; use {ref}",
			"anchor.copiedLink": "Link copied",
			"anchor.badInput": "Unrecognized anchor",

			"detail.start": "Start",
			"detail.end": "End",
			"gap.idle": "Idle",
			"node.orphanTool": "Orphan tool result",
			"orphan.badge": "call outside window",
			"orphan.noText": "(no result text)",
			"timing.notRecorded": "no duration",
			"timing.notRecordedHint": "This step has no timing record at all",
			"timing.partial": "partial timing",
			"timing.edgeOutsideHint": "Timing exists, but one edge lies outside the loaded window",
			"action.clockAxis": "Even",
			"action.clockAxisOn": "By clock",
			"action.clockAxisHint": "Toggle: even station spacing vs idle gaps scaled by real elapsed time",
			"detail.chars": "chars",
			"detail.msgCount": " messages",
			"detail.toolCount": " tools",
			"detail.usage": "Token usage",
			"detail.promptChanged": "System prompt / tools changed before this step",
			"chip.running": "running",
			"chip.error": "error",
			"chip.retry": "retry",
			"chip.compacted": "compacted",
			"chip.thinking": "thinking",
			"action.toStart": "Jump to start",
			"action.prev": "Previous step",
			"action.play": "Play replay",
			"action.pause": "Pause",
			"action.toEnd": "Show all",
			"action.speed": "Replay speed",
			"action.locate": "Locate current",
			"action.search": "Search stations (tool / args / text)",
			"action.searchPrev": "Previous match",
			"action.searchNext": "Next match",
			"action.searchClear": "Clear search",
			"action.follow": "Follow latest: auto-scroll new events into view",
			"action.loadOlder": "Load older history",
			"action.loadingOlder": "Loading older history…",
			"action.exportMd": "Export Markdown: copy the whole trace as study notes",
			"action.exported": "Copied",
			"action.expandPanel": "Expand detail panel",
			"action.collapsePanel": "Collapse detail panel",
			"action.prevTurn": "Previous turn",
			"action.nextTurn": "Next turn",
			"search.matches": "matches",
			"search.none": "No matches",
			"search.scopePartial": "loaded range only",
			"search.scopeLoading": "loaded range · loading older…",
			"search.scopeTip": "Search covers only the loaded part of the trace. Older history is not loaded yet; click to load it. Unloaded history is never reported as \"no match\".",
			"chip.interrupted": "stopped",
			"chip.ttft": "TTFT",
			"diff.initial": "Initial system prompt",
			"diff.system": "System prompt changed",
			"diff.tools": "Tool catalog changed",
			"diff.systemAndTools": "System prompt and tools changed",
			"diff.toolsAdded": "Tools added",
			"diff.toolsRemoved": "Tools removed",
			"diff.systemDelta": "System prompt chars",
			"detail.promptDiff": "Prompt changes",
			"export.stepTitle": "Single-step review",
			"action.exportStep": "Copy this step",
			"diff.toolsChanged": "Tool definition changed",
			"diff.textDiff": "What changed",
			"diff.startLine": "from line {n}",
			"diff.removed": "before",
			"diff.added": "after",
			"diff.truncated": "showing first {n} lines only",
			"diff.noText": "whitespace-only change",
			"detail.compactionOutput": "Full compaction output",
			"export.title": "Session trace export",
			"export.appendix": "Appendix: system prompt and tool catalog of the first request",
			"tab.detail": "Step detail",
			"tab.request": "Raw request",
			"hint.text": "Click a station or ▶ to replay · ← → step / Space play / ⇤⇥ jump turns / “/” to search · The bottom panel shows each step and the raw request sent to the model"
		};
		//#endregion

		//#region styles (injected once per page)
				const css = [
			// Status palette. Dark is the default (the values this view shipped with);
			// the light block below exists because those saturated hues measure 1.6–3.3:1
			// on white — below WCAG AA for text. The host exposes no theme-independent
			// status tokens (its `--dsw-static-*` scale carries the same hex in both
			// themes), so light needs its own set. Darkened variants measured 4.6–6.4:1.
			".dstv_root{--dstv-ok:#3aa76d;--dstv-info:#5ea2ff;--dstv-err:#ff7a6e;--dstv-warn:#e0c341;",
			"--dstv-partial:#ffa34d;--dstv-accent:#37d3c8;--dstv-unknown:#b06cff;--dstv-muted:#8a8f98;",
			// Ink variants: same hue family, tuned to clear 4.5:1 on their own 14% wash
			// (the base colours measured 3.98–4.92 there). Verified numerically, not by eye.
			"--dstv-ok-ink:#7fe0a8;--dstv-err-ink:#ffb3ab;--dstv-warn-ink:#ffd97a;--dstv-unknown-ink:#dfb6ff;--dstv-info-ink:#a8ccff;",
			// Gradient stops for filled badges. White text on the bright dark-theme
			// accents measured 1.86–2.60:1; these darker stops keep white at 6.3–7.7:1.
			"--dstv-grad-a:#1a4fa8;--dstv-grad-b:#0d6b66}",
			"body:not([data-ds-dark-theme]) .dstv_root{--dstv-ok:#1a7f45;--dstv-info:#1f5fd0;--dstv-err:#c42525;",
			"--dstv-warn:#8a5a00;--dstv-partial:#9a4a12;--dstv-accent:#0d7c8a;--dstv-unknown:#6c3fd1;--dstv-muted:#5c6773;",
			"--dstv-ok-ink:#0d5c30;--dstv-err-ink:#8f1717;--dstv-warn-ink:#5c3c00;--dstv-unknown-ink:#4a2a96;--dstv-info-ink:#17409a;",
			// Light theme already clears 4.5:1 with white on info/accent (5.82 / 4.92).
			"--dstv-grad-a:#1f5fd0;--dstv-grad-b:#0d7c8a}",
			"body:not([data-ds-dark-theme]) .dstv_root{color-scheme:light}",
			"@media (prefers-reduced-motion: reduce){.dstv_root *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}",
			".dstv_root{box-sizing:border-box;width:100%;min-width:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;min-height:calc(100vh - 235px);outline:none;font-variant-numeric:tabular-nums}",
			".dstv_head{position:sticky;top:0;z-index:6;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 88%,transparent);backdrop-filter:blur(8px);display:flex;flex-wrap:wrap}",
			".dstv_title{font-size:13px;font-weight:700;padding-left:4px;margin-right:10px;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(90deg,var(--dstv-info),var(--dstv-accent));-webkit-background-clip:text;background-clip:text;color:transparent}",
			".dstv_stat{margin-right:8px;font-size:12px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:5px}",
			".dstv_dot{width:7px;height:7px;border-radius:50%;background:var(--dstv-muted);display:inline-block;flex:none}",
			".dstv_dot[data-live=true]{background:var(--dstv-ok);animation:dstv-pulse 1.2s ease-in-out infinite;box-shadow:0 0 6px color-mix(in srgb,var(--dstv-ok) 80%,transparent)}",
			"@keyframes dstv-pulse{0%,100%{opacity:.35}50%{opacity:1}}",
			".dstv_legend{display:inline-flex;align-items:center;gap:8px;margin-right:6px;font-size:11px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}",
			".dstv_legend span{display:inline-flex;align-items:center;gap:3px}",
			".dstv_legend i{width:9px;height:9px;border-radius:3px;display:inline-block}",
			".dstv_btn{height:24px;padding:0 10px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:5px;flex:none;display:inline-flex;align-items:center;margin-left:2px}",
			".dstv_btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".dstv_btn:disabled{opacity:.55;cursor:default}",
			".dstv_transport{display:inline-flex;gap:2px;align-items:center;margin-left:6px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}",
			".dstv_tbtn{height:22px;min-width:28px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;transition:background .12s,color .12s,transform .1s}",
			".dstv_tbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".dstv_tbtn:active{transform:scale(.92)}",
			".dstv_playBtn{background:linear-gradient(135deg,var(--dstv-grad-a),var(--dstv-grad-b));color:#fff!important;font-weight:700;min-width:34px}",
			".dstv_playBtn:hover{filter:brightness(1.12)}",
			".dstv_progress{height:3px;background:var(--dsw-alias-border-l2);position:relative;overflow:hidden}",
			".dstv_progress i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--dstv-info),var(--dstv-accent),var(--dstv-ok));transition:width .3s ease;box-shadow:0 0 8px color-mix(in srgb,var(--dstv-info) 60%,transparent)}",
			".dstv_kpis{display:flex;gap:8px;padding:8px 12px 6px;flex-wrap:wrap}",
			".dstv_kpi{display:inline-flex;align-items:baseline;gap:5px;padding:5px 11px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}",
			".dstv_kpi b{font-size:14px;font-weight:700;background:linear-gradient(135deg,var(--dstv-info),var(--dstv-accent));-webkit-background-clip:text;background-clip:text;color:transparent}",
			".dstv_kpi.err b{background:linear-gradient(135deg,var(--dstv-err),var(--dstv-warn));-webkit-background-clip:text;background-clip:text;color:transparent}",
			".dstv_kpi.liveKpi{border-color:color-mix(in srgb,var(--dstv-ok) 50%,transparent);background:color-mix(in srgb,var(--dstv-ok) 8%,transparent)}",
			".dstv_kpi.liveKpi b{background:none;-webkit-background-clip:unset;background-clip:unset;color:var(--dstv-ok);font-size:12.5px}",
			".dstv_minimap{display:flex;gap:2px;padding:2px 12px 6px;align-items:stretch}",
			".dstv_miniTick{flex:1;min-width:3px;height:10px;border-radius:3px;border:0;padding:0;cursor:pointer;background:var(--dsw-alias-border-l2);transition:height .12s,box-shadow .12s;position:relative}",
			".dstv_miniTick[data-k=user]{background:var(--dstv-info)}",
			".dstv_miniTick[data-k=step]{background:var(--dsw-alias-border-l2)}",
			".dstv_miniTick[data-k=step][data-done=true]{background:var(--dstv-muted)}",
			".dstv_miniTick[data-k=tool]{background:var(--dstv-warn)}",
			".dstv_miniTick[data-k=error]{background:var(--dstv-err)}",
			".dstv_miniTick[data-k=compaction]{background:var(--dstv-unknown)}",
			".dstv_miniTick[data-k=retry]{background:var(--dstv-warn)}",
			".dstv_miniTick[data-k=command]{background:var(--dstv-ok)}",
			".dstv_miniTick[data-dim=true]{opacity:.25}",
			".dstv_miniTick[data-active=true]{height:14px;box-shadow:0 0 0 1.5px var(--dsw-alias-label-primary)}",
			".dstv_miniTick[data-live=true]{animation:dstv-pulse 1.2s ease-in-out infinite;background:var(--dstv-ok)!important}",
			".dstv_scroller{overflow-x:auto;overflow-y:hidden;padding:10px 8px 8px;position:relative;scrollbar-width:thin}",
			".dstv_hflow{position:relative;display:flex;gap:0;min-height:172px}",
			// The playhead marks "this is the station you are looking at". A full-height
			// bar cutting between the cards reads as a divider (users asked what it was),
			// and the part hanging below the cards carried no meaning at all. It is now a
			// short marker seated in the gap between stations, with a caret pointing down
			// at the active card: same information, no ambiguity.
			".dstv_playhead{position:absolute;top:34px;height:14px;width:2.5px;border-radius:2px;background:linear-gradient(180deg,var(--dstv-info),var(--dstv-accent));box-shadow:0 0 8px color-mix(in srgb,var(--dstv-info) 80%,transparent);z-index:3;transition:left .25s ease;pointer-events:none}",
			".dstv_playhead i{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid var(--dstv-accent);filter:drop-shadow(0 0 3px color-mix(in srgb,var(--dstv-accent) 80%,transparent))}",
			// `auto` makes the browser remember each card's last rendered size instead of
			// trusting the fallback. The old fallback was 120px against a measured 214px, so
			// every card that scrolled into view changed the scroller's extent — the thumb
			// visibly jumped. The fallback now matches the measurement.
			".dstv_station{content-visibility:auto;contain-intrinsic-size:264px 214px;contain-intrinsic-size:auto 264px 214px;width:264px;flex:none;cursor:pointer;padding:0 2px;transition:transform .15s}",
			".dstv_station:hover{transform:translateY(-3px)}",
			".dstv_axisZone{position:relative;height:46px;display:flex;align-items:center;padding:0 2px}",
			".dstv_tag{position:absolute;top:2px;left:4px;font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);padding:1px 6px;border-radius:8px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;z-index:1}",
			".dstv_axSeg{height:3px;flex:1;background:var(--dsw-alias-border-l2);border-radius:2px;margin:0 8px;transition:background .3s}",
			".dstv_axSeg.on{background:linear-gradient(90deg,var(--dstv-info),var(--dstv-accent))}",
			".dstv_hDot{width:13px;height:13px;border-radius:50%;background:var(--dstv-muted);border:2.5px solid var(--dsw-alias-bg-layer-2);flex:none;z-index:1;transition:box-shadow .2s,background .2s}",
			".dstv_hDot.user{background:var(--dstv-info);box-shadow:0 0 6px color-mix(in srgb,var(--dstv-info) 70%,transparent)}",
			".dstv_hDot.tool{background:var(--dstv-warn);box-shadow:0 0 6px color-mix(in srgb,var(--dstv-warn) 70%,transparent)}",
			".dstv_hDot.error{background:var(--dstv-err);box-shadow:0 0 6px color-mix(in srgb,var(--dstv-err) 70%,transparent)}",
			".dstv_hDot.compaction{background:var(--dstv-unknown);box-shadow:0 0 6px color-mix(in srgb,var(--dstv-unknown) 70%,transparent)}",
			".dstv_hDot.retry{background:var(--dstv-warn);box-shadow:0 0 6px color-mix(in srgb,var(--dstv-warn) 70%,transparent)}",
			".dstv_hDot.command{background:var(--dstv-ok);box-shadow:0 0 6px color-mix(in srgb,var(--dstv-ok) 70%,transparent)}",
			".dstv_hDot.live{background:var(--dstv-ok);animation:dstv-pulse 1.2s ease-in-out infinite}",
			".dstv_hDot[data-active=true]{outline:2.5px solid var(--dsw-alias-label-primary);outline-offset:2px}",
			".dstv_axLabel{position:absolute;right:6px;top:2px;font-size:9.5px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
			".dstv_hcard{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:8px 9px;font-size:12px;transition:border-color .2s,box-shadow .2s;display:flex;flex-direction:column;gap:5px;max-height:150px;overflow:hidden}",
			".dstv_station[data-active=true] .dstv_hcard{border-color:transparent;background:linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1)) padding-box,linear-gradient(135deg,var(--dstv-info),var(--dstv-accent)) border-box;box-shadow:0 0 14px color-mix(in srgb,var(--dstv-info) 35%,transparent)}",
			".dstv_station[data-dim=true] .dstv_hcard{opacity:.5;filter:saturate(.4)}",
			".dstv_station[data-dim=true] .dstv_axSeg.on{opacity:.2}",
			".dstv_hcard.userCard{border-left:3px solid var(--dstv-info)}",
			".dstv_hcard.stepCardOk{border-left:3px solid var(--dstv-ok)}",
			".dstv_hcard.stepCardErr{border-left:3px solid var(--dstv-err)}",
			".dstv_hcard.compactionCard{border-left:3px solid var(--dstv-unknown)}",
			".dstv_hcard.errorCard{border-left:3px solid var(--dstv-err);background:color-mix(in srgb,var(--dstv-err) 6%,transparent)}",
			".dstv_hcard.retryCard{border-left:3px solid var(--dstv-warn);background:color-mix(in srgb,var(--dstv-warn) 5%,transparent)}",
			".dstv_hcard.maxTokensCard{border-left:3px solid var(--dstv-warn)}",
			".dstv_hcard.commandCard{border-left:3px solid var(--dstv-ok)}",
			".dstv_hcard.unknownCard{border-left:3px dashed var(--dstv-muted)}",
			".dstv_boundary{display:flex;flex-direction:column;gap:5px;padding:8px;border:1px dashed color-mix(in srgb,var(--dstv-err) 60%,transparent);border-radius:8px;background:color-mix(in srgb,var(--dstv-err) 7%,transparent);max-width:248px}",
			".dstv_boundary.detail{max-width:none}",
			".dstv_name{display:flex;align-items:center;gap:5px;font-weight:600;font-size:11.5px;min-width:0;flex-wrap:wrap;row-gap:3px}",
			".dstv_nameText{flex:0 0 auto;white-space:nowrap}",
			".dstv_ok{width:9px;height:9px;border-radius:50%;background:var(--dstv-ok);display:inline-block;flex:none}",
			".dstv_bad{width:9px;height:9px;border-radius:50%;background:var(--dstv-err);display:inline-block;flex:none}",
			".dstv_chips{display:inline-flex;gap:3px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;min-width:0}",
			".dstv_chip{font-size:9.5px;font-weight:600;padding:1px 5px;border-radius:7px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);white-space:nowrap;display:inline-flex;align-items:center;gap:3px}",
			// Text on a 14% tint of its OWN hue measured 3.9–4.3:1 (worst case dark violet).
			// The tint stays for the semantic wash; the TEXT uses the -ink variant, which is
			// chosen per theme to clear 4.5:1 against that wash.
			".dstv_chip.run{background:color-mix(in srgb,var(--dstv-ok) 14%,transparent);color:var(--dstv-ok-ink)}",
			".dstv_chip.err{background:color-mix(in srgb,var(--dstv-err) 14%,transparent);color:var(--dstv-err-ink)}",
			".dstv_chip.retry{background:color-mix(in srgb,var(--dstv-warn) 14%,transparent);color:var(--dstv-warn-ink)}",
			".dstv_chip.info{background:color-mix(in srgb,var(--dstv-info) 12%,transparent);color:var(--dstv-info)}",
			".dstv_chip.violet{background:color-mix(in srgb,var(--dstv-unknown) 14%,transparent);color:var(--dstv-unknown-ink)}",
			// `.warn` was used by seven call sites but never defined, so every warning chip
			// fell back to the neutral base style and lost its amber meaning.
			".dstv_chip.warn{background:color-mix(in srgb,var(--dstv-warn) 14%,transparent);color:var(--dstv-warn-ink)}",
			// Text for assistive tech only: kept in the a11y tree, out of the visual layout.
			".dstv_visuallyHidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}",
			".dstv_spanRow{display:flex;align-items:center;gap:4px;margin-top:3px;font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}",
			".dstv_spanEdge{font-weight:600;background:var(--dsw-alias-interactive-bg-hover);border-radius:5px;padding:0 4px}",
			".dstv_spanArrow{opacity:.55}",
			".dstv_spanLive{color:var(--dstv-ok);font-weight:700}",
			".dstv_hDot.orphan{background:var(--dstv-unknown);box-shadow:0 0 6px color-mix(in srgb,var(--dstv-unknown) 50%,transparent)}",
			".dstv_hDot.unknown{background:var(--dstv-muted);box-shadow:0 0 0 2px color-mix(in srgb,var(--dstv-muted) 35%,transparent)}",
			".dstv_text.dstv_clamp4{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}",
			".dstv_gapBand.scaled{background:linear-gradient(90deg,color-mix(in srgb,var(--dstv-warn) 16%,transparent),color-mix(in srgb,var(--dstv-warn) 4%,transparent));border-radius:6px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-warn) 22%,transparent)}",
			".dstv_gapBand{flex:none;align-self:stretch;display:flex;align-items:flex-start;justify-content:center;padding-top:26px;font-size:9.5px;font-weight:600;color:var(--dstv-warn);opacity:.85;white-space:nowrap}",
			".dstv_cellRow{display:flex;flex-direction:column;gap:2px;min-width:0}",
			".dstv_cellName{display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:11px;min-width:0}",
			".dstv_text{font-size:11.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary)}",
			".dstv_text.sec{color:var(--dsw-alias-label-secondary)}",
			".dstv_clamp4{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}",
			".dstv_clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
			".dstv_clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
			".dstv_argsPrev{font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--dsw-alias-bg-layer-2);border-radius:5px;padding:2px 5px}",
			".dstv_durBar{height:3px;border-radius:2px;background:var(--dsw-alias-border-l2);overflow:hidden;margin-top:1px}",
			".dstv_durBar i{display:block;height:100%;background:linear-gradient(90deg,var(--dstv-warn),var(--dstv-err));border-radius:2px}",
			".dstv_durBar.run i{background:linear-gradient(90deg,var(--dstv-ok),var(--dstv-accent));animation:dstv-pulse 1s ease-in-out infinite}",
			".dstv_hint{font-size:11px;color:var(--dsw-alias-label-secondary);padding:2px 14px 8px;line-height:1.5}",
			// Loading state. The pulse is driven by `animation`, so the global
			// prefers-reduced-motion block already turns it off; nothing extra needed here.
			".dstv_loading{gap:10px}",
			".dstv_spinner{width:16px;height:16px;border-radius:50%;border:2px solid color-mix(in srgb,var(--dstv-info) 25%,transparent);border-top-color:var(--dstv-info);animation:dstv-spin .9s linear infinite;display:inline-block}",
			"@keyframes dstv-spin{to{transform:rotate(360deg)}}",
			".dstv_loadingText{font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".dstv_skeletonRow{display:flex;gap:8px;margin-top:2px}",
			".dstv_skeleton{width:132px;height:56px;border-radius:10px;background:linear-gradient(90deg,color-mix(in srgb,var(--dstv-muted) 12%,transparent),color-mix(in srgb,var(--dstv-muted) 22%,transparent),color-mix(in srgb,var(--dstv-muted) 12%,transparent));animation:dstv-shimmer 1.4s ease-in-out infinite}",
			"@keyframes dstv-shimmer{0%,100%{opacity:.45}50%{opacity:.9}}",
			".dstv_empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;flex:1;text-align:center;padding:60px 20px;color:var(--dsw-alias-label-secondary);white-space:pre-line;font-size:13px;line-height:1.7}",
			".dstv_emptyGlyph{font-size:42px;background:linear-gradient(135deg,var(--dstv-info),var(--dstv-accent));-webkit-background-clip:text;background-clip:text;color:transparent;animation:dstv-float 2.6s ease-in-out infinite}",
			"@keyframes dstv-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}",
			".dstv_detail{flex:none;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;max-height:46vh;box-shadow:0 -8px 24px rgba(0,0,0,.12)}",
			".dstv_tabs{display:flex;gap:2px;padding:6px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".dstv_tab{font-size:12px;font-weight:600;padding:5px 12px 7px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-bottom:2px solid transparent;border-radius:6px 6px 0 0}",
			".dstv_tab:hover{color:var(--dsw-alias-label-primary)}",
			".dstv_tab[data-on=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dstv-info)}",
			".dstv_dHead{display:flex;align-items:center;gap:8px;padding:7px 14px;font-size:12px;flex-wrap:wrap}",
			".dstv_dBadge{font-weight:700;font-size:11.5px;padding:2px 8px;border-radius:7px;background:linear-gradient(135deg,var(--dstv-grad-a),var(--dstv-grad-b));color:#fff}",
			".dstv_dBadge.user{background:linear-gradient(135deg,var(--dstv-info),var(--dstv-info))}",
			".dstv_dBadge.error{background:linear-gradient(135deg,var(--dstv-err),var(--dstv-warn))}",
			".dstv_dBadge.violet{background:linear-gradient(135deg,var(--dstv-unknown),var(--dstv-unknown))}",
			".dstv_dBadge.gray{background:var(--dsw-alias-label-secondary)}",
			".dstv_dPos{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
			".dstv_dBody{overflow-y:auto;padding:8px 14px 12px;display:flex;flex-direction:column;gap:8px}",
			".dstv_dLabel{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:5px;margin-bottom:3px}",
			".dstv_dText{font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}",
			// Assistant bodies are Markdown. The old rule kept `white-space:pre-wrap` and
			// printed the source, so users read "**0.9.13**" and "# heading" literally.
			// Blocks below restore the visual hierarchy the transcript actually has.
			".dstv_dMarkdown{white-space:normal}",
			// A caption + body card reads as a document section; without it the label and
			// the prose collapse into one paragraph line.
			".dstv_dSectionBody{gap:4px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-2)}",
			".dstv_dSectionBody>.dstv_dLabel{margin-bottom:0}",
			".dstv_md{font-size:12.5px;line-height:1.65;display:flex;flex-direction:column;gap:6px;min-width:0}",
			".dstv_mdP{margin:0;white-space:pre-wrap;word-break:break-word}",
			".dstv_mdH{margin:2px 0 0;font-weight:700;line-height:1.35}",
			".dstv_mdH1{font-size:17px}.dstv_mdH2{font-size:15px}.dstv_mdH3{font-size:13.5px}.dstv_mdH4,.dstv_mdH5,.dstv_mdH6{font-size:12.5px}",
			".dstv_mdCode{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-2))}",
			".dstv_mdBold{font-weight:700}",
			".dstv_mdLink{color:var(--dstv-info);text-decoration:underline;text-underline-offset:2px}",
			".dstv_mdLinkBlocked{color:var(--dsw-alias-label-secondary);text-decoration:line-through dotted;cursor:help}",
			".dstv_mdFence{position:relative;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-2));overflow:hidden}",
			".dstv_mdLang{position:absolute;top:3px;right:6px;font-size:9.5px;color:var(--dstv-muted);font-family:ui-monospace,monospace}",
			".dstv_mdPre{margin:0;padding:8px 9px;overflow:auto;max-height:280px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55}",
			".dstv_mdList{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:2px}",
			".dstv_mdQuote{margin:0;padding:2px 0 2px 9px;border-left:3px solid color-mix(in srgb,var(--dstv-info) 40%,transparent);color:var(--dsw-alias-label-secondary)}",
			".dstv_mdTable{border-collapse:collapse;font-size:11.5px;display:block;overflow:auto}",
			".dstv_mdTable th,.dstv_mdTable td{border:1px solid var(--dsw-alias-border-l2);padding:3px 7px;text-align:left}",
			".dstv_mdTable th{background:var(--dsw-alias-bg-layer-2);font-weight:600}",
			".dstv_mdHr{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:2px 0}",
			".dstv_dTool{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:7px 9px;gap:4px;background:var(--dsw-alias-bg-layer-1)}",
			".dstv_code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 9px;color:var(--dsw-alias-label-primary);max-height:180px;overflow:auto}",
			".dstv_dSection{display:flex;flex-direction:column;gap:5px}",
			".dstv_dSecHead{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}",
			".dstv_dSecHead .grow{flex:1}",
			".dstv_copyBtn{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:4px}",
			".dstv_copyBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-secondary)}",
			".dstv_copyBtn[data-ok=true]{border-color:var(--dstv-ok);color:var(--dstv-ok)}",
			"details.dstv_det{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}",
			"details.dstv_det>summary{cursor:pointer;padding:5px 9px;font-size:11.5px;font-weight:600;list-style:none;display:flex;align-items:center;gap:6px}",
			"details.dstv_det>summary::-webkit-details-marker{display:none}",
			"details.dstv_det>summary::before{content:'▸';color:var(--dsw-alias-label-secondary);transition:transform .15s}",
			"details.dstv_det[open]>summary::before{transform:rotate(90deg)}",
			"details.dstv_det>summary .sub{font-weight:400;color:var(--dsw-alias-label-secondary);font-size:10.5px}",
			"details.dstv_det .inner{padding:2px 9px 8px}",
			".dstv_msgRow{display:flex;flex-direction:column;gap:3px}",
			".dstv_msgRole{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:6px}",
			".dstv_msgRole.user{background:color-mix(in srgb,var(--dstv-info) 15%,transparent);color:var(--dstv-info)}",
			".dstv_msgRole.assistant{background:color-mix(in srgb,var(--dstv-info) 15%,transparent);color:var(--dstv-info)}",
			".dstv_msgRole.tool{background:color-mix(in srgb,var(--dstv-warn) 15%,transparent);color:var(--dstv-warn)}",
			".dstv_msgRole.note{background:color-mix(in srgb,var(--dstv-unknown) 15%,transparent);color:var(--dstv-unknown)}",
			".dstv_msgPrev{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;max-height:60px;overflow:hidden}",
			".dstv_toolItem{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:2px 0}",
			".dstv_toolItem .tname{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:600}",
			".dstv_cfgChips{display:flex;gap:5px;flex-wrap:wrap}",
			".dstv_cfgChip{font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:2px 7px;border-radius:7px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:4px}",
			".dstv_cfgChip b{color:var(--dsw-alias-label-primary);font-weight:600}",
			".dstv_dHead .dstv_chip{margin-left:2px}",
			".dstv_search{display:inline-flex;align-items:center;gap:4px;margin-left:auto;padding:1px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);transition:border-color .15s,box-shadow .15s}",
			// Keyboard users move through stations with the roving tabindex; without a
			// visible ring they cannot tell where they are. Mouse clicks stay unaffected.
			".dstv_station:focus-visible{outline:2px solid var(--dstv-info);outline-offset:2px;border-radius:10px}",
			// Every control in the view is a borderless <button>/<summary>, so the browser's
			// default ring was the only cue — and the root suppressed it. Give the whole
			// surface one consistent, high-contrast focus indicator (WCAG 2.4.7/2.4.11).
			".dstv_root button:focus-visible,.dstv_root summary:focus-visible,.dstv_root a:focus-visible,.dstv_root input:focus-visible{outline:2px solid var(--dstv-info);outline-offset:2px;border-radius:6px}",
			// Suppress the ring only for pointer users, never for keyboard users.
			".dstv_root:focus:not(:focus-visible){outline:none}",
			".dstv_station:focus:not(:focus-visible){outline:none}",
			".dstv_search:focus-within{border-color:var(--dstv-info);box-shadow:0 0 0 2px color-mix(in srgb,var(--dstv-info) 18%,transparent)}",
			".dstv_search[data-active=true]{border-color:color-mix(in srgb,var(--dstv-info) 55%,transparent)}",
			".dstv_searchInput{width:150px;border:0;outline:0;background:0 0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:22px;padding:0}",
			".dstv_searchInput::placeholder{color:var(--dsw-alias-label-secondary);opacity:1}",
			".dstv_searchCount{font-size:10.5px;font-weight:700;color:var(--dstv-info);white-space:nowrap;font-variant-numeric:tabular-nums}",
			".dstv_searchCount.none{color:var(--dstv-err)}",
			".dstv_anchorBar{max-width:260px}",
			".dstv_anchorInput{width:190px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}",
			".dstv_emptyGlyph.warn{color:var(--dstv-warn)}",
			".dstv_incompat{display:flex;flex-direction:column;gap:6px;max-width:640px;text-align:left}",
			".dstv_incompatHint{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}",
			".dstv_incompatCodes{font-size:11px;padding:3px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dstv-warn);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
			".dstv_evRow{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}",
			".dstv_ev{font-size:10px;line-height:1;padding:2px 5px;border-radius:5px;white-space:nowrap;cursor:help}",
			".dstv_ev-exact{color:var(--dstv-ok-ink);background:color-mix(in srgb,var(--dstv-ok) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-ok) 35%,transparent)}",
			".dstv_ev-reconstructed{color:var(--dstv-warn);background:color-mix(in srgb,var(--dstv-warn) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-warn) 38%,transparent)}",
			".dstv_ev-partial{color:var(--dstv-partial);background:color-mix(in srgb,var(--dstv-partial) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-partial) 38%,transparent)}",
			".dstv_diffChip.mod{color:var(--dstv-warn)}",
			".dstv_diffText{margin-top:4px;font-size:11.5px}",
			".dstv_diffText>summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11px;user-select:none}",
			".dstv_diffBody{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}",
			".dstv_diffSide{flex:1 1 240px;min-width:0;border-radius:6px;padding:4px 6px;background:var(--dsw-alias-bg-layer-1)}",
			".dstv_diffSide.del{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-err) 35%,transparent)}",
			".dstv_diffSide.add{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-ok) 35%,transparent)}",
			".dstv_diffLbl{font-size:10px;font-weight:700;color:var(--dsw-alias-label-secondary);margin-bottom:2px}",
			".dstv_diffSide pre{margin:0;max-height:180px;overflow:auto;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
			".dstv_scope{height:18px;padding:0 5px;font-size:10.5px;line-height:1;border:1px solid color-mix(in srgb,var(--dstv-warn) 50%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dstv-warn) 10%,transparent);color:var(--dstv-warn);white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:2px}",
			".dstv_scope:hover{background:color-mix(in srgb,var(--dstv-warn) 20%,transparent)}",
			".dstv_scope:disabled{cursor:default;opacity:.6}",
			".dstv_sbtn{height:18px;min-width:20px;padding:0 3px;font-size:11px;line-height:1;border:0;border-radius:5px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}",
			".dstv_sbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".dstv_btn[data-on=true]{color:var(--dstv-info);background:color-mix(in srgb,var(--dstv-info) 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-info) 40%,transparent)}",
			".dstv_tbtn[data-on=true]{color:var(--dstv-info);background:color-mix(in srgb,var(--dstv-info) 14%,transparent);font-weight:700}",
			".dstv_station[data-match=true] .dstv_hcard{border-color:transparent;background:linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1)) padding-box,linear-gradient(135deg,var(--dstv-warn),var(--dstv-warn)) border-box;box-shadow:0 0 12px color-mix(in srgb,var(--dstv-warn) 35%,transparent)}",
			".dstv_station[data-seek-dim=true] .dstv_hcard{opacity:.5;filter:saturate(.3)}",
			".dstv_station[data-seek-dim=true] .dstv_hDot{opacity:.35}",
			".dstv_miniTick[data-match=true]{box-shadow:0 0 0 1.5px var(--dstv-warn);height:14px}",
			".dstv_detail.full{max-height:82vh}",
			".dstv_panelToggle{margin-left:4px}",
			".dstv_subCard{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:3px;margin-top:3px}",
			".dstv_subHead{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;min-width:0}",
			".dstv_diffBox{border:1px dashed color-mix(in srgb,var(--dstv-warn) 55%,transparent);border-radius:10px;padding:7px 9px;background:color-mix(in srgb,var(--dstv-warn) 6%,transparent);display:flex;flex-direction:column;gap:6px}",
			".dstv_diffChip{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:7px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:nowrap}",
			".dstv_diffChip.add{background:color-mix(in srgb,var(--dstv-ok) 14%,transparent);color:var(--dstv-ok-ink)}",
			".dstv_diffChip.del{background:color-mix(in srgb,var(--dstv-err) 14%,transparent);color:var(--dstv-err);text-decoration:line-through}",
			".dstv_diffChip.delta{background:color-mix(in srgb,var(--dstv-info) 12%,transparent);color:var(--dstv-info)}",
			".dstv_emptyLegend{display:inline-flex;gap:10px;flex-wrap:wrap;justify-content:center;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".dstv_emptyLegend span{display:inline-flex;align-items:center;gap:4px}",
			".dstv_emptyLegend i{width:9px;height:9px;border-radius:3px;display:inline-block}",
			".dstv_axLabel .clock{opacity:.7}",
			".dstv_modelChip{font-size:10.5px;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-secondary);padding:2px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			// Narrow viewports must come LAST: at equal specificity the later rule wins, so
			// this block has to follow every base rule it overrides. Measured with styles
			// applied (2026-11-16): header 45px at 1872, 77 at 1100/900, 109 at 700, 102 at
			// 600 and 134px at 480 — five wrapped rows, a sixth of a 900px-tall viewport.
			// Reclaim rows instead of hiding controls: the legend repeats colours every dot
			// already carries, the hint line is advisory, and the two inputs can share a row
			// once they are allowed to shrink.
			"@media (max-width: 720px){.dstv_head{gap:4px;padding:6px 8px}",
			".dstv_title{font-size:12px;margin-right:6px}",
			".dstv_legend{display:none}.dstv_hint{display:none}",
			".dstv_searchInput{width:104px}.dstv_searchInput.dstv_anchorInput{width:124px}}",
		].join("");
		const tagId = "dsh-trajectory-traceview-plus/traceview.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-trajectory-traceview-plus";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region host form-field ids (runs at plugin load, not on view mount)
		// DevTools audits form fields while the page boots and keeps whatever it found
		// in the Issues panel, so annotating from the view's effect is too late: the
		// panel already recorded the host's nameless sidebar search. This block runs as
		// soon as the bundle is evaluated, then retries briefly because the host builds
		// that input lazily. The function itself lives in the helpers region below; this
		// only drives it, so tests can call the function without arming a timer.
		if (typeof document !== "undefined") {
			const annotatePass = () => {
				try { annotateNamelessFormFields(); } catch { /* never break the host over an id */ }
			};
			let annotateTicks = 0;
			const annotateTick = () => {
				annotatePass();
				annotateTicks += 1;
				if (annotateTicks < 40) window.setTimeout(annotateTick, 250);
			};
			if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", annotateTick, { once: true });
			else annotateTick();
		}
		//#endregion

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
		function safeJsonPreview(value, limit) {
			let text = "";
			if (typeof value === "string") text = value;
			else {
				try {
					const seen = new WeakSet();
					text = JSON.stringify(value, (k, v) => {
						if (typeof v === "bigint") return `${String(v)}n`;
						if (v !== null && typeof v === "object") {
							if (seen.has(v)) return "[Circular]";
							seen.add(v);
						}
						return v;
					});
					if (typeof text !== "string") text = String(text);
				} catch (e) {
					try { text = String(value); } catch (e2) { text = ""; }
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
			for (const n of nodes) {
				if (beforeSeq != null && n.seq >= beforeSeq) break;
				if (n.kind === "user" || n.kind === "steering" || n.kind === "context") {
					out.push({ role: "user", content: n.content ?? [], text: blocksText(n.content, tr) });
				} else if (n.kind === "assistant") {
					const content = (n.blocks ?? []).map((b) => {
						if (b.kind === "tool-call") return { type: "tool-call", id: b.callId, name: b.name, arguments: b.argsRaw };
						if (b.kind === "reasoning") return { type: "reasoning", text: b.text };
						if (b.kind === "text") return { type: "text", text: b.text };
						if (b.kind === "image") return { type: "image", attachment: b.attachment };
						return { type: "other", data: b.block };
					});
					const text = (n.blocks ?? []).map((b) => (b.kind === "text" ? b.text : b.kind === "reasoning" ? b.text : "")).join("\n").trim();
					out.push({ role: "assistant", content, text });
				} else if (n.kind === "tool-result") {
					out.push({ role: "tool", content: n.content ?? [], toolCallId: n.callId, isError: n.isError === true, text: blocksText(n.content, tr) });
				} else if (n.kind === "compaction") {
					const head = firstLine(n.summary ?? "");
					const cpt = typeof tr === "function" ? tr : (k) => k;
					// The decorative CJK brackets were hardcoded too; move them into the locale so
					// the English UI gets parentheses instead.
					out.push({ role: "note", content: [], text: `${cpt("note.wrapL")}${cpt("note.compaction")}${head !== "" ? head : cpt("note.compacted")}${cpt("note.wrapM")}${cpt("note.replace")} ${n.shadowedItemCount ?? "?"} ${cpt("note.items")} / ${cpt("note.about")} ${fmtTokens(n.shadowedTokenCount)} tokens${cpt("note.wrapR")}` });
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
				return `${ANCHOR_PREFIX}p${turn}s${station.stepNo}`;
			}
			return null;
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
			// p<turn>s<step>[c<callId>]
			const p = /^p(\d+)s(\d+)(?:c(.+))?$/.exec(tail);
			if (p !== null) {
				return {
					ok: true, form: "p",
					turn: Number(p[1]), step: Number(p[2]),
					callId: p[3] === void 0 ? null : p[3],
					hint
				};
			}
			// t<turn>s<step>
			const tt = /^t(\d+)s(\d+)$/.exec(tail);
			if (tt !== null) return { ok: true, form: "t", turn: Number(tt[1]), step: Number(tt[2]), hint };
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
		function nextHashFor(hash, anchor) {
			const body = typeof anchor === "string" ? anchor : "";
			if (body === "") return { hash: hash, changed: false };
			const want = `#${body}`;
			
			if (hash === want) return { hash: hash, changed: false };
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
		function deriveTraceTree(snap, t) {
			const nodes = safeList(snap?.eventNodes).sort((a, b) => a.seq - b.seq);
			// Drift diagnostics: computed once, surfaced by the view (never silently dropped).
			const contract = snapshotContract(snap);
			const nodeStats = unknownNodeStats(Array.isArray(snap?.eventNodes) ? snap.eventNodes : []);
			const resultsById = new Map();
			for (const n of nodes) if (n.kind === "tool-result") resultsById.set(n.callId, n);
			const runningById = new Map();
			for (const c of safeList(snap?.runningCalls)) if (typeof c.callId === "string") runningById.set(c.callId, c);
			const schemasById = snap?.callSchemas instanceof Map ? snap.callSchemas : new Map();
			const attachedCallIds = new Set();

			// Requests keyed by `${turn}:${step}`, with prompt inheritance across
			// requests (a header in force covers steps until a newer one replaces it).
			const requestsByStep = new Map();
			const compactionReqs = [];
			{
				const reqs = safeList(snap?.requests).sort((a, b) => a.startSeq - b.startSeq);
				let lastPrompt = null;
				for (const r of reqs) {
					if (r?.purpose === "compaction") { compactionReqs.push(r); continue; }
					if (r?.purpose !== "assistant" || typeof r.turn !== "number") continue;
					const prompt = r.prompt ?? lastPrompt;
					if (r.prompt != null) lastPrompt = r.prompt;
					requestsByStep.set(`${r.turn}:${r.step}`, { req: r, prompt });
				}
			}

			const turns = [];
			const turnMap = new Map();
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
					const entry = { id: entryId, who, text: textOfContent(n.content, t), time: n.time, seq: n.seq };
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
					const step = Math.max(1, Number(n.step) || 1);
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
							const res = resultsById.get(b.callId);
							if (attachedCallIds.has(b.callId)) continue;
							attachedCallIds.add(b.callId);
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
								id: `t${b.callId}`,
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
				const lastTurnNo = turns.length > 0 ? Math.max(...turns.map((x) => x.turn)) : 0;
				const ownTurn = typeof snap?.partial?.turn === "number" ? snap.partial.turn
					: lastTurnEntry === null ? 1 : lastTurnNo + 1;
				const e = ensureTurn(ownTurn, pendingUser[0].seq);
				for (const u of pendingUser) { e.user.push(u); e.stations.push({ id: u.id, kind: "user", who: u.who, text: u.text, time: u.time, seq: u.seq }); }
				pendingUser = [];
			}

			// In-flight tool calls not already attached via an assistant block.
			for (const c of safeList(snap?.runningCalls)) {
				if (typeof c.turn !== "number" || attachedCallIds.has(c.callId)) continue;
				// Claim the call id here as well: the streaming partial can describe the very
				// same in-flight call, and without claiming it the tool is counted twice
				// (once from runningCalls, once from the partial block).
				attachedCallIds.add(c.callId);
				const e = ensureTurn(c.turn, c.time);
				const step = Math.max(1, Number(c.step) || 1);
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
					id: `t${c.callId}`, kind: "tool", callId: c.callId,
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
				const step = Math.max(1, Number(p.step) || 1);
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
						if (attachedCallIds.has(b.callId)) continue;
						attachedCallIds.add(b.callId);
						const res = resultsById.get(b.callId);
						st.toolCount += 1;
						if (res?.isError === true) st.hasError = true;
						const schema = schemasById.get(b.callId);
						st.cells.push({
							id: `t${b.callId}`, kind: "tool", callId: b.callId,
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
			for (const n of nodes) {
				if (n.kind === "compaction") {
					const e = turnForSeq(n.seq);
					// Pair with the compaction provider request: exact replacementSeq
					// match first, else the nearest unconsumed compaction request that
					// completed within a minute before this marker landed.
					let matched = compactionReqs.find((r) => !consumedCompactionReqs.has(r) && r.replacementSeq === n.seq);
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
						summary: n.summary ?? "", count: n.shadowedItemCount ?? null, tokens: n.shadowedTokenCount ?? null,
						crequest,
						label: t("node.compaction")
					});
				} else if (n.kind === "turn-error") {
					const e = ensureTurn(typeof n.turn === "number" ? n.turn : 0, n.seq);
					e.stations.push({
						id: `e${n.seq}`, kind: "error", time: n.time, seq: n.seq,
						message: n.message ?? "", code: n.code, label: t("node.error")
					});
				} else if (n.kind === "model-retry") {
					const e = ensureTurn(typeof n.turn === "number" ? n.turn : 0, n.seq);
					e.stations.push({
						id: `y${n.seq}`, kind: "retry", time: n.time, seq: n.seq,
						message: n.failure?.message ?? "", code: n.failure?.code,
						retry: n.retry, maxRetries: n.maxRetries, provider: n.provider,
						retryState: n.retryState, label: t("node.retry")
					});
				} else if (n.kind === "turn-max-tokens") {
					const e = ensureTurn(typeof n.turn === "number" ? n.turn : 0, n.seq);
					e.stations.push({ id: `x${n.seq}`, kind: "maxTokens", time: n.time, seq: n.seq, label: t("node.maxTokens") });
				} else if (n.kind === "command") {
					const e = turnForSeq(n.seq);
					e.stations.push({
						id: `c${n.seq}`, kind: "command", time: n.time, seq: n.seq,
						name: n.name ?? `/${n.commandId}`, args: n.args ?? "",
						outcomeKind: n.outcome?.kind ?? null, outcomeText: n.outcome?.text ?? "",
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
					.filter((n) => n.kind === "tool-result" && typeof n.callId === "string" && !attachedCallIds.has(n.callId))
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
						if (st.live === true && currentStepNo === null) currentStepNo = stepCounter;
						// attach request info (messages are reconstructed lazily in the component)
						const key = `${e.turn}:${piece.stepNum}`;
						const found = requestsByStep.get(key);
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
							id: anchorSeq !== null ? `s${anchorSeq}` : `sx${String(e.turn)}-${String(piece.stepNum)}-${String(stepCounter)}`,
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
							label: `${t("node.step")} ${stepCounter}`,
							detail: `${t("node.turn")} ${String(e.turn)} · ${t("node.step")} ${piece.stepNum}`,
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
						if (d.count != null) meta.push(`${d.count}${t("meta.steps")}`);
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
				return { id: `t${e.turn}`, kind: "turn", label: e.turn === 0 ? t("node.systemTurn") : `${t("node.turn")} ${String(e.turn)}`, meta: m, children };
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
				nodeStats
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
		function stationAriaLabel(station, position, total, t) {
			const kind = station.kind === "step" ? `${t("node.step")} ${String(station.stepNo)}`
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
			const head = station.kind === "step" ? `${t("node.step")} ${station.turn ?? "?"}.${station.stepNo ?? "?"}` : station.kind;
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
						L.push(String(cell.text).replace(/`{3,}/g, (run) => "\\`".repeat(run.length)));
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
				extras.push(`**${t("node.retry")}** · ${station.retry ?? "?"}/${station.maxRetries ?? "?"}${station.provider ? ` · ${station.provider}` : ""}${station.retryState ? ` · ${station.retryState}` : ""}`);
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
				if (station.summary) { extras.push(""); extras.push(String(station.summary)); }
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
					const close = atBracket[i + 1];
					if (close > i && s[close + 1] === "(") {
						const end = atParen[close + 2];
						if (end > close) {
							flush(i);
							out.push({ t: "link", text: s.slice(i + 1, close), href: s.slice(close + 2, end) });
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
					const cells = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
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
					L.push(st.text !== "" ? st.text : "…");
				} else if (st.kind === "step") {
					L.push(`### 🤖 ${st.label} _(${st.detail})_`);
					if (st.meta.length > 0) { L.push(""); L.push(`_${st.meta.join(" · ")}_`); }
					const rl = reqLine(st);
					if (rl !== null) { L.push(""); L.push(`> 📨 ${rl}`); }
					if (st.request?.prompt != null && firstPrompt === null) firstPrompt = st.request.prompt;
					for (const cell of st.cells) {
						if (cell.kind === "assistant") {
							if (cell.thinking !== "") { L.push(""); L.push(`<details><summary>💭 ${t("chip.thinking")} (${cell.thinking.length})</summary>`); L.push(""); L.push(cell.thinking); L.push("</details>"); }
							if (cell.text !== "") { L.push(""); L.push(cell.text); }
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
					L.push(`### ♺ ${st.label}${st.count != null ? ` _(${st.count} ${t("meta.steps")} / ${fmtTokens(st.tokens)} ${t("meta.tokens")})_` : ""}`);
					if (st.summary !== "") { L.push(""); L.push(st.summary); }
					if (st.crequest?.outputText) { L.push(""); L.push(`<details><summary>${t("detail.compactionOutput")}</summary>`); L.push(""); L.push(st.crequest.outputText); L.push("</details>"); }
				} else if (st.kind === "error") {
					L.push(`### ✗ ${st.label}`);
					L.push(""); L.push(st.message || "…");
				} else if (st.kind === "retry") {
					L.push(`### ↻ ${st.label}${Number.isFinite(st.retry) ? ` #${st.retry}` : ""}`);
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
				if (firstPrompt.tools.length > 0) {
					L.push("");
					L.push(`**${t("detail.toolsCatalog")} (${firstPrompt.tools.length})**: ${firstPrompt.tools.map((tool) => `\`${tool.name}\``).join(" ")}`);
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
			// Legacy fallback
			try {
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				const ok = document.execCommand("copy");
				document.body.removeChild(ta);
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
		function CopyBtn({ text, label, okLabel }) {
			const [copied, setCopied] = (0, react.useState)(false);
			const doCopy = () => {
				copyText(text, (ok) => {
					if (!ok) return;
					setCopied(true);
					setTimeout(() => setCopied(false), 1400);
				});
			};
			return jsx("button", {
				type: "button",
				className: "dstv_copyBtn",
				"data-ok": copied ? "true" : undefined,
				onClick: (ev) => { ev.stopPropagation(); doCopy(); },
				children: copied ? `✓ ${okLabel}` : label
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
		function TraceMapView({ useSession, useTrajectory, t, viewRequest, completeViewRequest, loadOlder }) {
			const scrollerRef = (0, react.useRef)(null);
			const searchRef = (0, react.useRef)(null);
			const initDone = (0, react.useRef)(false);
			// useState order matters (render-repro forces slot 4 = tab): keep these four first.
			const [revealed, setRevealed] = (0, react.useState)(null); // null = overview (everything shown)
			const [playing, setPlaying] = (0, react.useState)(false);
			const [speedIdx, setSpeedIdx] = (0, react.useState)(0);
			const [tab, setTab] = (0, react.useState)("detail");
			const [queryRaw, setQueryRaw] = (0, react.useState)("");
			const [matchPtr, setMatchPtr] = (0, react.useState)(0);
			const [follow, setFollow] = (0, react.useState)(true);
			const [panelFull, setPanelFull] = (0, react.useState)(false);
			const [anchorNote, setAnchorNote] = (0, react.useState)(null);
			const [clockAxis, setClockAxis] = (0, react.useState)(false);
			const [olderBusy, setOlderBusy] = (0, react.useState)(false);
			const [mdCopied, setMdCopied] = (0, react.useState)(false);
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
				const id = setInterval(() => setStreamTick((v) => v + 1), STREAM_REBUILD_MS);
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
				const id = setInterval(() => setRevealed((r) => (r === null ? N : Math.min(r, N) + 1)), speedMs);
				return () => clearInterval(id);
			}, [playing, speedMs, N]);

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
			const stepPrev = () => {
				setPlaying(false);
				setFollow(false);
				if (R > 1) setRevealed(R - 1);
			};
			const stepNext = () => {
				setPlaying(false);
				setFollow(false);
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
			const anchorToken = (0, react.useMemo)(() => [anchorToApply, anchorInput, hash].map((v) => (typeof v === "string" ? v : "")).join("\u0000"), [anchorToApply, anchorInput, hash]);
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
						const before = stationsRef.current.length;
						let moved = false;
						try { moved = await loadOlder(); } catch { moved = false; }
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
						for (let i = 0; i < ANCHOR_REVEAL_TRIES; i += 1) {
							await new Promise((r) => setTimeout(r, Math.min(ANCHOR_REVEAL_MS, 20 * 2 ** i)));
							resolved = resolveAnchorInStations(parsed, stationsRef.current);
							if (resolved.ok === true) break;
							if (stationsRef.current.length !== before) break;
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
			(0, react.useEffect)(() => {
				if (N === 0) return;
				const wanted = (anchorToApply !== null && anchorToApply !== "") ? anchorToApply : anchorInput.trim();
				if (wanted === "") return;
				let cancelled = false;
				void anchorApply(wanted).then((ok) => {
					if (cancelled) return;
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
			(0, react.useEffect)(() => { setMatchPtr(0); }, [query]);
			const gotoMatch = (dir) => {
				if (matches.length === 0) return;
				// Clamp before stepping: when the match set shrinks (a shorter query), a stale
				// pointer past the end showed "2/2" but stepping stayed on the last item.
				const base = Math.min(matchPtr, matches.length - 1);
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
			const doLoadOlder = () => {
				if (typeof loadOlder !== "function" || olderBusy === true || loadingOlder) return;
				setOlderBusy(true);
				Promise.resolve()
					.then(() => loadOlder())
					.catch(() => undefined)
					.finally(() => setOlderBusy(false));
			};

			// ── export the whole trace as Markdown study notes ────────────────────
			const doExport = (ev) => {
				if (ev != null && typeof ev.stopPropagation === "function") ev.stopPropagation();
				const md = buildTraceMarkdown(tree, t);
				copyText(md, (ok) => {
					if (!ok) return;
					setMdCopied(true);
					setTimeout(() => setMdCopied(false), 1600);
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
						disabled: olderBusy === true || loadingOlder,
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
						children: mdCopied === true ? `✓ ${t("action.exported")}` : "📋 Markdown"
					}, "hExport") : null,
					stats.lastModel != null ? jsx("span", { className: "dstv_modelChip", title: stats.lastModel, children: `🤖 ${stats.lastModel}` }, "hModel") : null,
					// Announce anchor progress: paging can take many seconds with no other
					// feedback for screen-reader users (the chip changing is silent).
					jsx("span", { className: "dstv_visuallyHidden", "aria-live": "polite", "aria-atomic": "true", children: anchorNote ?? "" }, "hAnchorLive"),
					anchorNote !== null ? jsx("span", { className: "dstv_chip warn", title: anchorNote, children: anchorNote }, "hAnchorNote") : null,
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
										void anchorApply(wanted).then((ok) => {
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
							searching ? jsx("span", { className: `dstv_searchCount${matches.length === 0 ? " none" : ""}`, children: matches.length === 0 ? t("search.none") : `${Math.min(matchPtr + 1, matches.length)}/${matches.length} ${t("search.matches")}` }, "sCnt") : null,
							searching && scopeNote !== null ? jsx("button", {
								type: "button",
								className: "dstv_scope",
								title: t("search.scopeTip"),
								disabled: olderBusy === true || loadingOlder,
								onClick: doLoadOlder,
								children: `⬆ ${scopeNote}`
							}, "sScope") : null,
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
						"data-k": k,
						"data-done": done ? "true" : undefined,
						"data-dim": reached ? (searching && !matched ? "true" : undefined) : "true",
						"data-active": revealed !== null && i === R - 1 ? "true" : undefined,
						"data-live": s.kind === "step" && s.live === true ? "true" : undefined,
						"data-match": matched ? "true" : undefined,
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
									const gapPrefix = showGap ? [jsx("span", {
										className: `dstv_gapBand${clockAxis ? " scaled" : ""}`,
										style: gapWidth !== null ? { width: gapWidth, minWidth: gapWidth } : undefined,
										title: `${t("gap.idle")} ${fmtMs(gapMs)}`,
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
															s.kind === "step" ? String(s.stepNo) : String(i + 1),
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
											jsx(CopyBtn, { text: cell.args, label: t("detail.copy"), okLabel: t("detail.copied") }, "tArgCopy")
										] }, "tArgHead"),
										jsx("div", { className: "dstv_code", children: pretty !== "" ? pretty : t("detail.noArgs") }, "tArgCode")
									] }, "tArgInner")
								] }, `da${cell.id}`),
								hasResult ? jsxs("details", { className: "dstv_det", open: true, children: [
									jsx("summary", { children: [cell.isError ? `✗ ${t("detail.result")}` : `✓ ${t("detail.result")}`, jsx("span", { className: "sub", children: String(cell.resultText.length) }, "rLen")] }, "tResSum"),
									jsx("div", { className: "inner", children: [
										jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }, children: [
											jsx("span", { className: `dstv_dLabel${cell.isError ? " err" : ""}`, style: { margin: 0 }, children: cell.isError && cell.errorName != null ? `✗ ${cell.errorName}` : t("detail.result") }, "tResLbl"),
											jsx(CopyBtn, { text: cell.resultText, label: t("detail.copy"), okLabel: t("detail.copied") }, "tResCopy")
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
															jsx(CopyBtn, { text: sub.resultText, label: t("detail.copy"), okLabel: t("detail.copied") }, "sResCopy"),
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
							jsx(CopyBtn, { text: cr.outputText, label: t("detail.copy"), okLabel: t("detail.copied") }, "oCopy")
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
				const tools = req.prompt?.tools ?? [];
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
				const payloadJson = JSON.stringify(payload, null, 2);

				const sysJson = JSON.stringify({ system: req.prompt?.system ?? "", tools: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }, null, 2);

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
							jsx(CopyBtn, { text: sysJson, label: t("detail.copy"), okLabel: t("detail.copied") }, "spCopy")
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
							jsx(CopyBtn, { text: JSON.stringify(tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })), null, 2), label: t("detail.copy"), okLabel: t("detail.copied") }, "tcCopy")
						] }, "tcSecHead"),
						jsxs("details", { className: "dstv_det", open: false, children: [
							jsx("summary", { children: [`${t("detail.toolsCatalog")} (${tools.length})`] }, "tcSum"),
							jsx("div", { className: "inner", children: tools.map((tool) => jsxs("details", { className: "dstv_det", open: false, children: [
								jsx("summary", { children: [jsx("span", { className: "tname", children: tool.name }, "tn"), jsx("span", { className: "sub", children: firstLine(tool.description ?? "") }, "td")] }, `ts${tool.name}`),
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
							jsx(CopyBtn, { text: payloadJson, label: t("detail.copy"), okLabel: t("detail.copied") }, "mCopy")
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
							return jsxs("details", { className: "dstv_det", open: i === messages.length - 1, children: [
								jsx("summary", { children: [jsx("span", { className: `dstv_msgRole ${m.role}`, children: m.role === "note" ? "压缩" : m.role }, "mr"), jsx("span", { className: "dstv_msgPrev", children: firstLine(preview) }, "mp"), jsx("span", { className: "sub", children: String(m.text.length) }, "ml")] }, `ms${i}`),
								jsx("div", { className: "inner", children: jsx("div", { className: "dstv_code", style: { maxHeight: 200 }, children: m.text !== "" ? m.text : JSON.stringify(m.content, null, 2) }, "mc") }, `mi${i}`)
							] }, `m${i}`);
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
						jsx("button", { type: "button", className: "dstv_tab", "data-on": showTab === "detail" ? "true" : undefined, onClick: () => setTab("detail"), children: `🧭 ${t("tab.detail")}` }, "tabDetail"),
						jsx("button", { type: "button", className: "dstv_tab", "data-on": showTab === "request" ? "true" : undefined, onClick: () => setTab("request"), children: `📨 ${t("tab.request")}` }, "tabRequest")
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
								return jsx("span", { className: "dstv_anchorWrap", title: av, children: jsx(CopyBtn, { text: av, label: `🔗 ${t("anchor.copy")}`, okLabel: t("anchor.copied") }, "dAnchor") }, "dAnchorWrap");
							})(),
							activeStation.synthetic === true ? jsx("span", { className: "dstv_chip warn", children: t("anchor.notPersisted") }, "dSynth") : null,
								// Shown once, in the header: the same note used to render here as well, so
							// every anchor result appeared twice on screen.
							jsx("span", { className: "dstv_dPos", children: `${t("detail.position")} ${String(activeIdx + 1)} / ${N}` }, "dPos"),
							jsx(CopyBtn, {
								text: stepMarkdown,
								label: `📋 ${t("action.exportStep")}`,
								okLabel: t("anchor.copied")
							}, "dExportStep"),
							jsx("button", { type: "button", className: "dstv_btn dstv_panelToggle", title: panelFull ? t("action.collapsePanel") : t("action.expandPanel"), onClick: () => setPanelFull((v) => !v), children: panelFull ? "⤡" : "⤢" }, "dToggle")
						]
					}, "dHead"),
					jsx(RenderBoundary, {
						label: t("error.render"),
						retryLabel: t("error.retry"),
						hint: t("error.renderHint"),
						wide: true,
						render: () => (showTab === "request" && canRequest
							? activeStation.kind === "compaction" ? renderCompactionRequestBody(activeStation) : renderRequestBody(activeStation, activeMessages)
							: renderDetailBody(activeStation))
					}, "dBodySafe")
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

		// Test hook: lets the smoke test render the real component. Guarded so it is
		// inert unless a harness asks for it; it exposes nothing to the host runtime.
		if (typeof globalThis === "object" && globalThis !== null && globalThis.__DTSV_TEST__ === true) {
			globalThis.__testComponent = { TraceMapView };
		}

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
						loadOlder: async () => {
							const before = session.getSnapshot();
							await session.loadOlder();
							return session.getSnapshot() !== before;
						}
					};
				}
			}, SafeTraceMapView));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
