window.__ModuleLoader__.load({
	id: "dsh-trajectory-traceview",
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
			"view.label": "轨迹视图",
			"view.root": "会话轨迹",
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
			"meta.steps": "步",
			"meta.tools": "次工具",
			"meta.turns": "个轮次",
			"meta.error": "出错",
			"meta.tokens": "tokens",
			"stat.current": "当前",
			"stat.thinking": "思考中",
			"kpi.toolTime": "工具总耗时",
			"kpi.tokensIn": "请求 tokens",
			"kpi.tokensOut": "生成 tokens",
			"kpi.errors": "错误",
			"status.done": "已完成",
			"status.running": "运行中",
			"status.failed": "失败",
			"status.retry": "重试",
			"detail.userMsg": "用户消息",
			"detail.args": "调用参数",
			"detail.noArgs": "（无参数）",
			"detail.subCalls": "子调用",
			"detail.position": "站点",
			"detail.result": "工具结果",
			"detail.noResult": "（无结果内容）",
			"detail.time": "时间",
			"detail.request": "原始请求",
			"detail.requestApprox": "以下消息列表为按会话日志近似重建的请求载荷（与真正发出的大致一致，便于学习提示词）。",
			"detail.systemPrompt": "系统提示",
			"detail.toolsCatalog": "工具目录",
			"detail.messages": "消息列表",
			"detail.copy": "复制",
			"detail.copied": "已复制",
			"anchor.copy": "复制锚点",
			"anchor.copied": "已复制",
			"anchor.notPersisted": "未持久化，不可深链",
			"anchor.notLoaded": "该记录不在当前窗口，需先拉取更早历史",
			"anchor.bad": "锚点格式无法识别",
			"detail.start": "开始",
			"detail.end": "结束",
			"gap.idle": "空闲",
			"node.orphanTool": "孤立工具结果",
			"orphan.badge": "调用不在窗口内",
			"orphan.noText": "（无结果文本）",
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
			"chip.interrupted": "已停止",
			"chip.ttft": "首 token",
			"chip.decode": "解码",
			"detail.promptDiff": "提示词变更",
			"diff.initial": "初始系统提示",
			"diff.system": "系统提示有变更",
			"diff.tools": "工具目录有变更",
			"diff.systemAndTools": "系统提示与工具均有变更",
			"diff.toolsAdded": "新增工具",
			"diff.toolsRemoved": "移除工具",
			"diff.systemDelta": "系统提示字符",
			"detail.compactionRequest": "压缩请求",
			"detail.compactionOutput": "压缩产出全文",
			"detail.noRequest": "此站点没有对应的大模型请求记录",
			"detail.turnTime": "轮次耗时",
			"export.title": "会话轨迹导出",
			"export.appendix": "附录：首个请求的系统提示与工具目录",
			"tab.detail": "步骤详情",
			"tab.request": "原始请求",
			"hint.text": "点击站点或 ▶ 回放 · ← → 逐站 / 空格播放 / ⇤⇥ 跳轮次 / “/” 搜索 · 底部面板展示每步详情与发给大模型的原始请求"
		};
		/** English dictionary. */
		const en = {
			"view.label": "Trace View",
			"view.root": "Session Trace",
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
			"meta.steps": " steps",
			"meta.tools": " tool calls",
			"meta.turns": " turns",
			"meta.error": "error",
			"meta.tokens": " tokens",
			"stat.current": "current",
			"stat.thinking": "thinking",
			"kpi.toolTime": "Tool time",
			"kpi.tokensIn": "Prompt tokens",
			"kpi.tokensOut": "Output tokens",
			"kpi.errors": "Errors",
			"status.done": "Done",
			"status.running": "Running",
			"status.failed": "Failed",
			"status.retry": "Retry",
			"detail.userMsg": "User message",
			"detail.args": "Call arguments",
			"detail.noArgs": "(no arguments)",
			"detail.subCalls": "Sub-calls",
			"detail.position": "Station",
			"detail.result": "Tool result",
			"detail.noResult": "(no result content)",
			"detail.time": "Time",
			"detail.request": "Raw request",
			"detail.requestApprox": "The message list below is a close reconstruction of the request payload from the session log (for prompt study).",
			"detail.systemPrompt": "System prompt",
			"detail.toolsCatalog": "Tool catalog",
			"detail.messages": "Messages",
			"detail.copy": "Copy",
			"detail.copied": "Copied",
			"anchor.copy": "Copy anchor",
			"anchor.copied": "Copied",
			"anchor.notPersisted": "Not persisted; cannot deep-link",
			"anchor.notLoaded": "Not in the loaded window; load older history first",
			"anchor.bad": "Unrecognized anchor format",
			"detail.start": "Start",
			"detail.end": "End",
			"gap.idle": "Idle",
			"node.orphanTool": "Orphan tool result",
			"orphan.badge": "call outside window",
			"orphan.noText": "(no result text)",
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
			"chip.interrupted": "stopped",
			"chip.ttft": "TTFT",
			"chip.decode": "decode",
			"detail.promptDiff": "Prompt changes",
			"diff.initial": "Initial system prompt",
			"diff.system": "System prompt changed",
			"diff.tools": "Tool catalog changed",
			"diff.systemAndTools": "System prompt and tools changed",
			"diff.toolsAdded": "Tools added",
			"diff.toolsRemoved": "Tools removed",
			"diff.systemDelta": "System prompt chars",
			"detail.compactionRequest": "Compaction request",
			"detail.compactionOutput": "Full compaction output",
			"detail.noRequest": "No model request record for this station",
			"detail.turnTime": "Turn time",
			"export.title": "Session trace export",
			"export.appendix": "Appendix: system prompt and tool catalog of the first request",
			"tab.detail": "Step detail",
			"tab.request": "Raw request",
			"hint.text": "Click a station or ▶ to replay · ← → step / Space play / ⇤⇥ jump turns / “/” to search · The bottom panel shows each step and the raw request sent to the model"
		};
		//#endregion

		//#region styles (injected once per page)
		const css = "" +
			".dstv_root{box-sizing:border-box;width:100%;min-width:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;min-height:calc(100vh - 235px);outline:none;font-variant-numeric:tabular-nums}" +
			".dstv_head{position:sticky;top:0;z-index:6;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 88%,transparent);backdrop-filter:blur(8px);display:flex;flex-wrap:wrap}" +
			".dstv_title{font-size:13px;font-weight:700;padding-left:4px;margin-right:10px;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(90deg,#5ea2ff,#37d3c8);-webkit-background-clip:text;background-clip:text;color:transparent}" +
			".dstv_stat{margin-right:8px;font-size:12px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:5px}" +
			".dstv_dot{width:7px;height:7px;border-radius:50%;background:#8a8f98;display:inline-block;flex:none}" +
			".dstv_dot[data-live=true]{background:#3aa76d;animation:dstv-pulse 1.2s ease-in-out infinite;box-shadow:0 0 6px rgba(58,167,109,.8)}" +
			"@keyframes dstv-pulse{0%,100%{opacity:.35}50%{opacity:1}}" +
			".dstv_legend{display:inline-flex;align-items:center;gap:8px;margin-right:6px;font-size:11px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}" +
			".dstv_legend span{display:inline-flex;align-items:center;gap:3px}" +
			".dstv_legend i{width:9px;height:9px;border-radius:3px;display:inline-block}" +
			".dstv_btn{height:24px;padding:0 10px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:5px;flex:none;display:inline-flex;align-items:center;margin-left:2px}" +
			".dstv_btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}" +
			".dstv_btn:disabled{opacity:.55;cursor:default}" +
			".dstv_transport{display:inline-flex;gap:2px;align-items:center;margin-left:6px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}" +
			".dstv_tbtn{height:22px;min-width:28px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;transition:background .12s,color .12s,transform .1s}" +
			".dstv_tbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}" +
			".dstv_tbtn:active{transform:scale(.92)}" +
			".dstv_playBtn{background:linear-gradient(135deg,#2f6fe0,#19b7c8);color:#fff!important;font-weight:700;min-width:34px}" +
			".dstv_playBtn:hover{filter:brightness(1.12)}" +
			".dstv_progress{height:3px;background:var(--dsw-alias-border-l2);position:relative;overflow:hidden}" +
			".dstv_progress i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#2f6fe0,#19b7c8,#3aa76d);transition:width .3s ease;box-shadow:0 0 8px rgba(47,111,224,.6)}" +
			".dstv_kpis{display:flex;gap:8px;padding:8px 12px 6px;flex-wrap:wrap}" +
			".dstv_kpi{display:inline-flex;align-items:baseline;gap:5px;padding:5px 11px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}" +
			".dstv_kpi b{font-size:14px;font-weight:700;background:linear-gradient(135deg,#5ea2ff,#37d3c8);-webkit-background-clip:text;background-clip:text;color:transparent}" +
			".dstv_kpi.err b{background:linear-gradient(135deg,#ff7a6e,#ff9a4d);-webkit-background-clip:text;background-clip:text;color:transparent}" +
			".dstv_kpi.liveKpi{border-color:rgba(58,167,109,.5);background:rgba(58,167,109,.08)}" +
			".dstv_kpi.liveKpi b{background:none;-webkit-background-clip:unset;background-clip:unset;color:#3aa76d;font-size:12.5px}" +
			".dstv_minimap{display:flex;gap:2px;padding:2px 12px 6px;align-items:stretch}" +
			".dstv_miniTick{flex:1;min-width:3px;height:10px;border-radius:3px;border:0;padding:0;cursor:pointer;background:var(--dsw-alias-border-l2);transition:height .12s,box-shadow .12s;position:relative}" +
			".dstv_miniTick[data-k=user]{background:#3898ff}" +
			".dstv_miniTick[data-k=step]{background:var(--dsw-alias-border-l2)}" +
			".dstv_miniTick[data-k=step][data-done=true]{background:#5c6773}" +
			".dstv_miniTick[data-k=tool]{background:#ffa34d}" +
			".dstv_miniTick[data-k=error]{background:#ff5c5c}" +
			".dstv_miniTick[data-k=compaction]{background:#b06cff}" +
			".dstv_miniTick[data-k=retry]{background:#e0c341}" +
			".dstv_miniTick[data-k=command]{background:#2ec4a1}" +
			".dstv_miniTick[data-dim=true]{opacity:.25}" +
			".dstv_miniTick[data-active=true]{height:14px;box-shadow:0 0 0 1.5px var(--dsw-alias-label-primary)}" +
			".dstv_miniTick[data-live=true]{animation:dstv-pulse 1.2s ease-in-out infinite;background:#3aa76d!important}" +
			".dstv_scroller{overflow-x:auto;overflow-y:hidden;padding:10px 8px 8px;position:relative;scrollbar-width:thin}" +
			".dstv_hflow{position:relative;display:flex;gap:0;min-height:172px}" +
			".dstv_playhead{position:absolute;top:40px;bottom:14px;width:2.5px;border-radius:2px;background:linear-gradient(180deg,#2f6fe0,#19b7c8);box-shadow:0 0 10px rgba(47,111,224,.9);z-index:2;transition:left .25s ease;pointer-events:none}" +
			".dstv_playhead i{position:absolute;top:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #2f6fe0;filter:drop-shadow(0 0 3px rgba(47,111,224,.9))}" +
			".dstv_station{width:264px;flex:none;cursor:pointer;padding:0 2px;transition:transform .15s}" +
			".dstv_station:hover{transform:translateY(-3px)}" +
			".dstv_axisZone{position:relative;height:46px;display:flex;align-items:center;padding:0 2px}" +
			".dstv_tag{position:absolute;top:2px;left:4px;font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);padding:1px 6px;border-radius:8px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;z-index:1}" +
			".dstv_axSeg{height:3px;flex:1;background:var(--dsw-alias-border-l2);border-radius:2px;margin:0 8px;transition:background .3s}" +
			".dstv_axSeg.on{background:linear-gradient(90deg,#2f6fe0,#19b7c8)}" +
			".dstv_hDot{width:13px;height:13px;border-radius:50%;background:#5c6773;border:2.5px solid var(--dsw-alias-bg-layer-2);flex:none;z-index:1;transition:box-shadow .2s,background .2s}" +
			".dstv_hDot.user{background:#3898ff;box-shadow:0 0 6px rgba(56,152,255,.7)}" +
			".dstv_hDot.tool{background:#ffa34d;box-shadow:0 0 6px rgba(255,163,77,.7)}" +
			".dstv_hDot.error{background:#ff5c5c;box-shadow:0 0 6px rgba(255,92,92,.7)}" +
			".dstv_hDot.compaction{background:#b06cff;box-shadow:0 0 6px rgba(176,108,255,.7)}" +
			".dstv_hDot.retry{background:#e0c341;box-shadow:0 0 6px rgba(224,195,65,.7)}" +
			".dstv_hDot.command{background:#2ec4a1;box-shadow:0 0 6px rgba(46,196,161,.7)}" +
			".dstv_hDot.live{background:#3aa76d;animation:dstv-pulse 1.2s ease-in-out infinite}" +
			".dstv_hDot[data-active=true]{outline:2.5px solid var(--dsw-alias-label-primary);outline-offset:2px}" +
			".dstv_axLabel{position:absolute;right:6px;top:2px;font-size:9.5px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}" +
			".dstv_hcard{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:8px 9px;font-size:12px;transition:border-color .2s,box-shadow .2s;display:flex;flex-direction:column;gap:5px;max-height:150px;overflow:hidden}" +
			".dstv_station[data-active=true] .dstv_hcard{border-color:transparent;background:linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1)) padding-box,linear-gradient(135deg,#2f6fe0,#19b7c8) border-box;box-shadow:0 0 14px rgba(47,111,224,.35)}" +
			".dstv_station[data-dim=true] .dstv_hcard{opacity:.35;filter:saturate(.4)}" +
			".dstv_station[data-dim=true] .dstv_axSeg.on{opacity:.2}" +
			".dstv_hcard.userCard{border-left:3px solid #3898ff}" +
			".dstv_hcard.stepCardOk{border-left:3px solid #3aa76d}" +
			".dstv_hcard.stepCardErr{border-left:3px solid #ff5c5c}" +
			".dstv_hcard.compactionCard{border-left:3px solid #b06cff}" +
			".dstv_hcard.errorCard{border-left:3px solid #ff5c5c;background:rgba(255,92,92,.06)}" +
			".dstv_hcard.retryCard{border-left:3px solid #e0c341;background:rgba(224,195,65,.05)}" +
			".dstv_hcard.maxTokensCard{border-left:3px solid #ff9a4d}" +
			".dstv_hcard.commandCard{border-left:3px solid #2ec4a1}" +
			".dstv_name{display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:11.5px;min-width:0}" +
			".dstv_ok{width:9px;height:9px;border-radius:50%;background:#3aa76d;display:inline-block;flex:none}" +
			".dstv_bad{width:9px;height:9px;border-radius:50%;background:#ff5c5c;display:inline-block;flex:none}" +
			".dstv_chips{display:inline-flex;gap:3px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}" +
			".dstv_chip{font-size:9.5px;font-weight:600;padding:1px 5px;border-radius:7px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);white-space:nowrap;display:inline-flex;align-items:center;gap:3px}" +
			".dstv_chip.run{background:rgba(58,167,109,.14);color:#3aa76d}" +
			".dstv_chip.err{background:rgba(255,92,92,.14);color:#ff7a6e}" +
			".dstv_chip.retry{background:rgba(224,195,65,.14);color:#e0c341}" +
			".dstv_chip.info{background:rgba(56,152,255,.12);color:#6ab0ff}" +
			".dstv_chip.violet{background:rgba(176,108,255,.14);color:#c39aff}" +
			".dstv_spanRow{display:flex;align-items:center;gap:4px;margin-top:3px;font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}" +
			".dstv_spanEdge{font-weight:600;background:var(--dsw-alias-interactive-bg-hover);border-radius:5px;padding:0 4px}" +
			".dstv_spanArrow{opacity:.55}" +
			".dstv_spanLive{color:#3aa76d;font-weight:700}" +
			".dstv_hDot.orphan{background:#c39aff;box-shadow:0 0 6px rgba(176,108,255,.5)}" +
			".dstv_text.dstv_clamp4{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}" +
			".dstv_gapBand{flex:none;align-self:stretch;display:flex;align-items:flex-start;justify-content:center;padding-top:26px;font-size:9.5px;font-weight:600;color:#e0a341;opacity:.85;white-space:nowrap}" +
			".dstv_cellRow{display:flex;flex-direction:column;gap:2px;min-width:0}" +
			".dstv_cellName{display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:11px;min-width:0}" +
			".dstv_text{font-size:11.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary)}" +
			".dstv_text.sec{color:var(--dsw-alias-label-secondary)}" +
			".dstv_clamp4{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}" +
			".dstv_clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}" +
			".dstv_clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
			".dstv_argsPrev{font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--dsw-alias-bg-layer-2);border-radius:5px;padding:2px 5px}" +
			".dstv_durBar{height:3px;border-radius:2px;background:var(--dsw-alias-border-l2);overflow:hidden;margin-top:1px}" +
			".dstv_durBar i{display:block;height:100%;background:linear-gradient(90deg,#ffa34d,#ff7a6e);border-radius:2px}" +
			".dstv_durBar.run i{background:linear-gradient(90deg,#3aa76d,#19b7c8);animation:dstv-pulse 1s ease-in-out infinite}" +
			".dstv_hint{font-size:11px;color:var(--dsw-alias-label-secondary);padding:2px 14px 8px;line-height:1.5}" +
			".dstv_empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;flex:1;text-align:center;padding:60px 20px;color:var(--dsw-alias-label-secondary);white-space:pre-line;font-size:13px;line-height:1.7}" +
			".dstv_emptyGlyph{font-size:42px;background:linear-gradient(135deg,#5ea2ff,#37d3c8);-webkit-background-clip:text;background-clip:text;color:transparent;animation:dstv-float 2.6s ease-in-out infinite}" +
			"@keyframes dstv-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}" +
			".dstv_detail{flex:none;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;max-height:46vh;box-shadow:0 -8px 24px rgba(0,0,0,.12)}" +
			".dstv_tabs{display:flex;gap:2px;padding:6px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}" +
			".dstv_tab{font-size:12px;font-weight:600;padding:5px 12px 7px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-bottom:2px solid transparent;border-radius:6px 6px 0 0}" +
			".dstv_tab:hover{color:var(--dsw-alias-label-primary)}" +
			".dstv_tab[data-on=true]{color:var(--dsw-alias-label-primary);border-bottom-color:#2f6fe0}" +
			".dstv_dHead{display:flex;align-items:center;gap:8px;padding:7px 14px;font-size:12px;flex-wrap:wrap}" +
			".dstv_dBadge{font-weight:700;font-size:11.5px;padding:2px 8px;border-radius:7px;background:linear-gradient(135deg,#2f6fe0,#19b7c8);color:#fff}" +
			".dstv_dBadge.user{background:linear-gradient(135deg,#3898ff,#2f6fe0)}" +
			".dstv_dBadge.error{background:linear-gradient(135deg,#ff5c5c,#ff9a4d)}" +
			".dstv_dBadge.violet{background:linear-gradient(135deg,#b06cff,#7a5cff)}" +
			".dstv_dBadge.gray{background:var(--dsw-alias-label-secondary)}" +
			".dstv_dPos{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}" +
			".dstv_dBody{overflow-y:auto;padding:8px 14px 12px;display:flex;flex-direction:column;gap:8px}" +
			".dstv_dLabel{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:5px;margin-bottom:3px}" +
			".dstv_dText{font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}" +
			".dstv_dTool{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:7px 9px;gap:4px;background:var(--dsw-alias-bg-layer-1)}" +
			".dstv_code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 9px;color:var(--dsw-alias-label-primary);max-height:180px;overflow:auto}" +
			".dstv_dSection{display:flex;flex-direction:column;gap:5px}" +
			".dstv_dSecHead{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}" +
			".dstv_dSecHead .grow{flex:1}" +
			".dstv_copyBtn{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:4px}" +
			".dstv_copyBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-secondary)}" +
			".dstv_copyBtn[data-ok=true]{border-color:#3aa76d;color:#3aa76d}" +
			"details.dstv_det{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}" +
			"details.dstv_det>summary{cursor:pointer;padding:5px 9px;font-size:11.5px;font-weight:600;list-style:none;display:flex;align-items:center;gap:6px}" +
			"details.dstv_det>summary::-webkit-details-marker{display:none}" +
			"details.dstv_det>summary::before{content:'▸';color:var(--dsw-alias-label-secondary);transition:transform .15s}" +
			"details.dstv_det[open]>summary::before{transform:rotate(90deg)}" +
			"details.dstv_det>summary .sub{font-weight:400;color:var(--dsw-alias-label-secondary);font-size:10.5px}" +
			"details.dstv_det .inner{padding:2px 9px 8px}" +
			".dstv_msgRow{display:flex;flex-direction:column;gap:3px}" +
			".dstv_msgRole{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:6px}" +
			".dstv_msgRole.user{background:rgba(56,152,255,.15);color:#6ab0ff}" +
			".dstv_msgRole.assistant{background:rgba(47,111,224,.15);color:#7db6ff}" +
			".dstv_msgRole.tool{background:rgba(255,163,77,.15);color:#ffb877}" +
			".dstv_msgRole.note{background:rgba(176,108,255,.15);color:#c39aff}" +
			".dstv_msgPrev{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;max-height:60px;overflow:hidden}" +
			".dstv_toolItem{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:2px 0}" +
			".dstv_toolItem .tname{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:600}" +
			".dstv_cfgChips{display:flex;gap:5px;flex-wrap:wrap}" +
			".dstv_cfgChip{font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:2px 7px;border-radius:7px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:4px}" +
			".dstv_cfgChip b{color:var(--dsw-alias-label-primary);font-weight:600}" +
			".dstv_dHead .dstv_chip{margin-left:2px}" +
			".dstv_search{display:inline-flex;align-items:center;gap:4px;margin-left:auto;padding:1px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);transition:border-color .15s,box-shadow .15s}" +
			".dstv_search:focus-within{border-color:#2f6fe0;box-shadow:0 0 0 2px rgba(47,111,224,.18)}" +
			".dstv_search[data-active=true]{border-color:rgba(47,111,224,.55)}" +
			".dstv_searchInput{width:150px;border:0;outline:0;background:0 0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:22px;padding:0}" +
			".dstv_searchInput::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}" +
			".dstv_searchCount{font-size:10.5px;font-weight:700;color:#2f6fe0;white-space:nowrap;font-variant-numeric:tabular-nums}" +
			".dstv_searchCount.none{color:#ff7a6e}" +
			".dstv_sbtn{height:18px;min-width:20px;padding:0 3px;font-size:11px;line-height:1;border:0;border-radius:5px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}" +
			".dstv_sbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}" +
			".dstv_btn[data-on=true]{color:#2f6fe0;background:rgba(47,111,224,.12);box-shadow:inset 0 0 0 1px rgba(47,111,224,.4)}" +
			".dstv_tbtn[data-on=true]{color:#2f6fe0;background:rgba(47,111,224,.14);font-weight:700}" +
			".dstv_station[data-match=true] .dstv_hcard{border-color:transparent;background:linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1)) padding-box,linear-gradient(135deg,#e0c341,#ff9a4d) border-box;box-shadow:0 0 12px rgba(224,195,65,.35)}" +
			".dstv_station[data-seek-dim=true] .dstv_hcard{opacity:.3;filter:saturate(.3)}" +
			".dstv_station[data-seek-dim=true] .dstv_hDot{opacity:.35}" +
			".dstv_miniTick[data-match=true]{box-shadow:0 0 0 1.5px #e0c341;height:14px}" +
			".dstv_detail.full{max-height:82vh}" +
			".dstv_panelToggle{margin-left:4px}" +
			".dstv_subCard{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:3px;margin-top:3px}" +
			".dstv_subHead{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;min-width:0}" +
			".dstv_diffBox{border:1px dashed rgba(224,195,65,.55);border-radius:10px;padding:7px 9px;background:rgba(224,195,65,.06);display:flex;flex-direction:column;gap:6px}" +
			".dstv_diffChip{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:7px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:nowrap}" +
			".dstv_diffChip.add{background:rgba(58,167,109,.14);color:#3aa76d}" +
			".dstv_diffChip.del{background:rgba(255,92,92,.14);color:#ff7a6e;text-decoration:line-through}" +
			".dstv_diffChip.delta{background:rgba(56,152,255,.12);color:#6ab0ff}" +
			".dstv_emptyLegend{display:inline-flex;gap:10px;flex-wrap:wrap;justify-content:center;font-size:11px;color:var(--dsw-alias-label-secondary)}" +
			".dstv_emptyLegend span{display:inline-flex;align-items:center;gap:4px}" +
			".dstv_emptyLegend i{width:9px;height:9px;border-radius:3px;display:inline-block}" +
			".dstv_axLabel .clock{opacity:.7}" +
			".dstv_modelChip{font-size:10.5px;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--dsw-alias-label-secondary);padding:2px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
		const tagId = "dsh-trajectory-traceview/traceview.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-trajectory-traceview";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region pure helpers: snapshot -> timeline tree
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
		function textOfContent(content) {
			for (const b of content ?? []) if (b && b.type === "text" && typeof b.text === "string" && b.text !== "") return b.text;
			return "";
		}
		/** Join every text block; images become a visible placeholder. */
		function blocksText(content) {
			if (!Array.isArray(content)) return "";
			const parts = [];
			for (const b of content) {
				if (b == null) continue;
				if (b.type === "text" && typeof b.text === "string") { if (b.text !== "") parts.push(b.text); }
				else if (b.type === "image") parts.push("[图片]");
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
		/** Human duration for KPI tiles: `850 ms` / `12.4 s`. */
		function fmtDur(ms) {
			if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
			if (ms < 1000) return `${String(Math.round(ms))} ms`;
			return `${(ms / 1000).toFixed(1)} s`;
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
			if (n < 1e6) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
			return `${(n / 1e6).toFixed(1)}M`;
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
				// Anchor identity, written ONLY at the durable patch site below.
				// Never derived from `seq` (which is min-reduced and also carries
				// epoch-ms / +0.5 synthetic values). null => not deep-linkable.
				anchorSeq: null,
				ttftMs: null, startMs: null, endMs: null, firstTokMs: null, toolMs: 0, toolCount: 0,
				hasError: false, interrupted: false, usage: null, modelHint: null
			};
		}
		/** Map one sub-call entry (settled ToolResultNode or running shape) to full detail. */
		function subDetailOf(sub) {
			if (sub == null) return { name: "?", callId: null, argsRaw: "", resultText: "", isError: false, errorName: undefined, running: false, durationMs: null };
			const settled = sub.kind === "tool-result";
			const argsRaw = typeof sub.argsRaw === "string" ? sub.argsRaw : (typeof sub.call?.argsRaw === "string" ? sub.call.argsRaw : "");
			const durationMs = settled && Number.isFinite(sub.callTime) && Number.isFinite(sub.time) ? Math.max(0, sub.time - sub.callTime) : null;
			return {
				name: subName(sub),
				callId: typeof sub.callId === "string" ? sub.callId : null,
				argsRaw,
				resultText: settled ? blocksText(sub.content) : "",
				isError: settled && sub.isError === true,
				errorName: settled ? sub.error?.name : undefined,
				running: !settled,
				durationMs
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
			return { kind, toolsAdded, toolsRemoved, prevSystemChars, curSystemChars, systemDelta: curSystemChars - prevSystemChars, isInitial: prev === null };
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
		function reconstructMessages(nodes, beforeSeq) {
			const out = [];
			for (const n of nodes) {
				if (beforeSeq != null && n.seq >= beforeSeq) break;
				if (n.kind === "user" || n.kind === "steering" || n.kind === "context") {
					out.push({ role: "user", content: n.content ?? [], text: blocksText(n.content) });
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
					out.push({ role: "tool", content: n.content ?? [], toolCallId: n.callId, isError: n.isError === true, text: blocksText(n.content) });
				} else if (n.kind === "compaction") {
					const head = firstLine(n.summary ?? "");
					out.push({ role: "note", content: [], text: `『上下文压缩：${head !== "" ? head : "历史已压缩"}（替换 ${n.shadowedItemCount ?? "?"} 项 / 约 ${fmtTokens(n.shadowedTokenCount)} tokens）』` });
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
				const hit = stations.find((st) => st.anchorSeq === parsed.seq);
				return hit === void 0 ? { ok: false, reason: "not-loaded", seq: parsed.seq } : { ok: true, station: hit };
			}
			if (parsed.form === "c") {
				for (const st of stations) {
					if (st.kind !== "step") continue;
					for (const c of st.cells ?? []) {
						if (c.kind !== "tool" || c.callId !== parsed.callId) continue;
						if (Number.isSafeInteger(st.anchorSeq)) return { ok: true, station: st };
						return { ok: false, reason: "synthetic-tool" };
					}
				}
				return { ok: false, reason: "not-loaded" };
			}
			if (parsed.form === "p" || parsed.form === "t") {
				const hit = stations.find((st) => st.kind === "step"
					&& Number.isFinite(st.turn) && st.turn === parsed.turn
					&& st.stepNo === parsed.step
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
		 * Fold a TrajectorySnapshot into the timeline tree:
		 * root -> turns -> chronological stations (user messages / steps / special events)
		 * plus a flattened station list, aggregate stats, and per-step raw request info.
		 * @param snap - the `views.get("trajectory")` snapshot (or an empty stand-in).
		 * @param t - bound translate function for this plugin's namespace.
		 */
		function deriveTraceTree(snap, t) {
			const nodes = [...(snap?.eventNodes ?? [])].sort((a, b) => a.seq - b.seq);
			const resultsById = new Map();
			for (const n of nodes) if (n.kind === "tool-result") resultsById.set(n.callId, n);
			const runningById = new Map();
			for (const c of snap?.runningCalls ?? []) if (c != null && typeof c.callId === "string") runningById.set(c.callId, c);
			const schemasById = snap?.callSchemas instanceof Map ? snap.callSchemas : new Map();
			const attachedCallIds = new Set();

			// Requests keyed by `${turn}:${step}`, with prompt inheritance across
			// requests (a header in force covers steps until a newer one replaces it).
			const requestsByStep = new Map();
			const compactionReqs = [];
			{
				const reqs = [...(snap?.requests ?? [])].sort((a, b) => a.startSeq - b.startSeq);
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
					const who = n.kind === "context"
						? `${t("node.context")}${typeof n.provenance?.producer === "string" && n.provenance.producer !== "" ? ` · ${n.provenance.producer}` : ""}`
						: t("node.user");
					pendingUser.push({ id: `u${n.seq}`, who, text: textOfContent(n.content), time: n.time, seq: n.seq });
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
					for (const b of n.blocks ?? []) {
						if (b.kind === "text" && typeof b.text === "string" && b.text !== "") {
							st.cells.push({ id: `a${n.seq}${st.cells.length}`, kind: "assistant", text: b.text, thinking: "" });
						} else if (b.kind === "reasoning" && typeof b.text === "string" && b.text !== "") {
							st.cells.push({ id: `r${n.seq}${st.cells.length}`, kind: "assistant", text: "", thinking: b.text });
						} else if (b.kind === "tool-call") {
							const res = resultsById.get(b.callId);
							if (attachedCallIds.has(b.callId)) continue;
							attachedCallIds.add(b.callId);
							const isRunning = res === undefined && runningById.has(b.callId);
							if (isRunning) st.live = true;
							const schema = schemasById.get(b.callId);
							const dur = res != null && Number.isFinite(res.callTime) && Number.isFinite(res.time) ? Math.max(0, res.time - res.callTime) : null;
							st.toolMs += dur ?? 0;
							st.toolCount += 1;
							if (res?.isError === true) st.hasError = true;
							st.cells.push({
								id: `t${b.callId}`,
								kind: "tool",
								callId: b.callId,
								name: typeof b.name === "string" && b.name !== "" ? b.name : t("node.tool"),
								args: typeof b.argsRaw === "string" ? b.argsRaw : "",
								resultText: res !== undefined ? blocksText(res.content) : "",
								isError: res?.isError === true,
								errorName: res?.error?.name,
								durationMs: dur,
								running: isRunning,
								subCalls: Array.isArray(res?.subCalls) ? res.subCalls.map(subDetailOf) : [],
								schema: schema != null ? { name: schema.name, description: schema.description, parameters: schema.parameters } : null
							});
						}
					}
					if (n.timing != null) {
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
			if (pendingUser.length > 0 && lastTurnEntry !== null) {
				const e = lastTurnEntry;
				for (const u of pendingUser) { e.user.push(u); e.stations.push({ id: u.id, kind: "user", who: u.who, text: u.text, time: u.time, seq: u.seq }); }
				pendingUser = [];
			}

			// In-flight tool calls not already attached via an assistant block.
			for (const c of snap?.runningCalls ?? []) {
				if (c == null || typeof c.turn !== "number" || attachedCallIds.has(c.callId)) continue;
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
					subCalls: Array.isArray(c.subCalls) ? c.subCalls.map(subDetailOf) : [],
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
				const existingKinds = new Set(st.cells.map((c) => c.kind));
				for (const b of p.blocks) {
					if (b.kind === "text" && typeof b.text === "string" && b.text !== "" && !existingKinds.has("assistant")) {
						st.cells.push({ id: `pa${b.text.length}`, kind: "assistant", text: b.text, thinking: "" });
						existingKinds.add("assistant");
					} else if (b.kind === "reasoning" && typeof b.text === "string" && b.text !== "" && !st.cells.some((c) => c.thinking !== "")) {
						st.cells.push({ id: `pr${b.text.length}`, kind: "assistant", text: "", thinking: b.text });
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
							resultText: res !== undefined ? blocksText(res.content) : "",
							isError: res?.isError === true,
							errorName: res?.error?.name,
							durationMs: null, running: res === undefined,
							subCalls: Array.isArray(res?.subCalls) ? res.subCalls.map(subDetailOf) : [],
							schema: schema != null ? { name: schema.name, description: schema.description, parameters: schema.parameters } : null
						});
					}
				}
			}

			// Special events: compaction / turn-error / retry / max-tokens / command.
			// Compaction/command nodes carry no turn number: seat them by seq range —
			// the turn whose first event seq is the greatest one not after the event.
			const turnsBySeq = [...turns].sort((a, b) => a.seq - b.seq);
			const turnForSeq = (s) => {
				let best = null;
				for (const e of turnsBySeq) {
					if (e.seq <= s) best = e;
					else break;
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
							outputText: blocksText(matched.rawOutput) || blocksText(matched.summary) || ""
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
					const text = blocksText(n.content);
					const subCalls = Array.isArray(n.subCalls) ? n.subCalls.map(subDetailOf) : [];
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
							hay: `${piece.data.who}\n${piece.data.text}`.toLowerCase()
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
						if (stepDurMs !== null) meta.push(fmtMs(stepDurMs));
						else if (st.ttftMs != null && Number.isFinite(st.ttftMs)) meta.push(`${t("chip.ttft")} ${fmtMs(st.ttftMs)}`);
						if (st.usage !== null && st.usage.input + st.usage.output > 0) meta.push(`${fmtTokens(st.usage.input + st.usage.output)}${t("meta.tokens")}`);
						if (st.live === true) meta.push(t("chip.running"));
						if (st.interrupted) meta.push(t("chip.interrupted"));
						if (st.hasError) meta.push(t("meta.error"));
						const hayParts = [`${t("node.step")} ${stepCounter}`, `${t("node.turn")} ${String(e.turn)}`];
						for (const c of st.cells) {
							if (c.kind === "assistant") { hayParts.push(c.text ?? "", c.thinking ?? ""); }
							else { hayParts.push(c.name ?? "", c.args ?? "", c.resultText ?? "", c.errorName ?? ""); }
						}
						const anchorSeq = st.anchorSeq;
						const station = {
							id: piece.data.id ?? `s${stepCounter}`,
							kind: "step",
							stepNo: stepCounter,
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
							ttftMs: st.ttftMs,
							decodeRate,
							modelHint: st.modelHint,
							request,
							time: st.time,
							hay: hayParts.join("\n").toLowerCase()
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
						else if (d.outcomeKind === "error") meta.push(t("meta.error"));
					}
					const specialAnchor = Number.isSafeInteger(d.seq) && d.seq >= 0 ? d.seq : null;
					const station = {
						id: d.id, kind: d.kind, label: d.label, meta, time: d.time, ...d,
						anchorSeq: specialAnchor,
						anchorKey: specialAnchor !== null ? `e${specialAnchor}` : null,
						synthetic: specialAnchor === null,
						hay: [d.label, d.summary, d.message, d.name, d.args, d.outcomeText, d.displayText].filter((v) => typeof v === "string").join("\n").toLowerCase()
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
				stats
			};
		}
		/** Station indices whose haystack contains the (lower-cased) query. */
		function matchStations(stations, query) {
			const q = String(query ?? "").trim().toLowerCase();
			if (q === "") return [];
			const out = [];
			for (let i = 0; i < stations.length; i += 1) {
				const hay = stations[i].hay;
				if (typeof hay === "string" && hay.includes(q)) out.push(i);
			}
			return out;
		}
		/** Render the whole trace as a Markdown study note (per-step flow + request configs). */
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
							if (cell.args !== "") { L.push(""); L.push("```json"); L.push(prettyArgs(cell.args) || cell.args); L.push("```"); }
							if (cell.resultText !== "") { L.push(""); L.push(`**${t("detail.result")}**`); L.push(""); L.push("```"); L.push(cell.resultText.length > 4000 ? `${cell.resultText.slice(0, 4000)}\n…(${fmtInt(cell.resultText.length)} ${t("detail.chars")})` : cell.resultText); L.push("```"); }
							for (const sub of cell.subCalls) {
								L.push("");
								L.push(`- ↳ **${sub.name}**${sub.durationMs != null ? ` (${fmtMs(sub.durationMs)})` : ""}${sub.isError ? " ✗" : ""}${sub.argsRaw !== "" ? ` \`${sub.argsRaw.replace(/\s+/g, " ").slice(0, 120)}\`` : ""}`);
							}
						}
					}
				} else if (st.kind === "orphan-tool") {
					L.push(`### ⤷ ${t("node.orphanTool")} · ${st.name}`);
					L.push("");
					L.push(`_${t("orphan.badge")} · ${anchorOf(st) ?? "—"}_`);
					if (st.args !== "") { L.push(""); L.push("```json"); L.push(prettyArgs(st.args) || st.args); L.push("```"); }
					if (st.displayText !== "") { L.push(""); L.push("```"); L.push(st.displayText.length > 4000 ? `${st.displayText.slice(0, 4000)}\n…(${fmtInt(st.displayText.length)} ${t("detail.chars")})` : st.displayText); L.push("```"); }
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
				L.push("```");
				L.push(firstPrompt.system);
				L.push("```");
				L.push("</details>");
				if (firstPrompt.tools.length > 0) {
					L.push("");
					L.push(`**${t("detail.toolsCatalog")} (${firstPrompt.tools.length})**: ${firstPrompt.tools.map((tool) => `\`${tool.name}\``).join(" ")}`);
				}
			}
			L.push("");
			return L.join("\n");
		}
		//#endregion

		//#region horizontal timeline + replay component
		const EMPTY_SNAPSHOT = { eventNodes: [], runningCalls: [], partial: null };
		const SPEEDS_MS = [1500, 750, 375];
		const SPEED_LABELS = ["×1", "×2", "×4"];
		const STATION_W = 264;
		/** G4-T3: gaps shorter than this are normal scheduling noise, not an idle pause. */
		const GAP_MIN_MS = 30_000;

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
			const [olderBusy, setOlderBusy] = (0, react.useState)(false);
			const [mdCopied, setMdCopied] = (0, react.useState)(false);

			const snap = useTrajectory === void 0 ? EMPTY_SNAPSHOT : useTrajectory((v) => v ?? EMPTY_SNAPSHOT);
			const hasMore = useSession((s) => s.hasMore === true);
			const loadingOlder = useSession((s) => s.loadingOlder === true);
			const tree = (0, react.useMemo)(() => deriveTraceTree(snap, t), [snap, t]);
			const stations = tree.stations;
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
			const centerStation = (idx) => {
				const sc = scrollerRef.current;
				if (sc === null) return;
				const el = sc.querySelector(`[data-station-idx="${String(idx)}"]`);
				if (el === null || typeof el.getBoundingClientRect !== "function") return;
				const rect = el.getBoundingClientRect();
				const srect = sc.getBoundingClientRect();
				const target = Math.max(0, rect.left - srect.left + sc.scrollLeft + el.offsetWidth / 2 - sc.clientWidth / 2);
				if (typeof sc.scrollTo === "function") {
					try { sc.scrollTo({ left: target, behavior: "smooth" }); } catch { sc.scrollLeft = target; }
				} else {
					sc.scrollLeft = target;
				}
			};

			(0, react.useEffect)(() => {
				if (revealed === null) return;
				centerStation(R - 1);
			}, [R, revealed]);

			// First landing: if the AI is mid-flight, land on its current station.
			(0, react.useEffect)(() => {
				if (initDone.current || N === 0) return;
				initDone.current = true;
				const li = stations.findIndex((s) => s.kind === "step" && s.live === true);
				if (li >= 0) setRevealed(li + 1);
			}, [N, stations]);

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
			const hashAnchor = (0, react.useState)(() => {
				try { return typeof location !== "undefined" ? decodeURIComponent(location.hash.replace(/^#/, "")) : null; } catch { return null; }
			})[0];
			const anchorToApply = focusAnchor ?? (hashAnchor !== null && hashAnchor !== "" ? hashAnchor : null);
			(0, react.useEffect)(() => {
				if (anchorToApply === null || stations.length === 0) return;
				const parsed = parseAnchor(anchorToApply);
				const resolved = resolveAnchorInStations(parsed, stations);
				if (resolved.ok === true) {
					const idx = stations.indexOf(resolved.station);
					if (idx >= 0) {
						setPlaying(false);
						setFollow(false);
						setRevealed(idx + 1);
						setTab("detail");
					}
					if (resolved.synthetic === true) setAnchorNote(t("anchor.notPersisted"));
					else if (typeof resolved.upgraded === "string") setAnchorNote(`use ${resolved.upgraded}`);
				} else {
					setAnchorNote(resolved.reason === "synthetic" ? t("anchor.notPersisted")
						: resolved.reason === "synthetic-tool" ? t("anchor.notPersisted")
						: resolved.reason === "not-loaded" ? t("anchor.notLoaded")
						: t("anchor.bad"));
				}
				if (typeof completeViewRequest === "function") completeViewRequest();
			}, [anchorToApply, N]);

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
			(0, react.useEffect)(() => { setMatchPtr(0); }, [query]);
			const gotoMatch = (dir) => {
				if (matches.length === 0) return;
				const next = ((matchPtr % matches.length) + dir + matches.length) % matches.length;
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

			// ── turn hopping ──────────────────────────────────────────────────────
			const turnStarts = (0, react.useMemo)(() => {
				const out = [];
				for (let i = 0; i < stations.length; i += 1) if (stations[i].tag != null) out.push(i);
				return out;
			}, [stations]);
			const activeIdx = Math.min(N - 1, Math.max(0, revealed !== null ? R - 1 : N - 1));
			const activeStation = stations[activeIdx]; // undefined while N === 0 (empty view)
			// Lazy: rebuild the model-visible message list only for the selected step.
			// (Hook sits above the empty-state early return so hook order never changes.)
			const activeReqStartSeq = activeStation !== void 0 && activeStation.kind === "step" && activeStation.request !== null ? activeStation.request.startSeq : null;
			const activeMessages = (0, react.useMemo)(() => (activeReqStartSeq != null ? reconstructMessages(tree.nodes ?? [], activeReqStartSeq) : []), [activeReqStartSeq, tree.nodes]);
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

			const onKeyDown = (ev) => {
				const k = ev.key;
				const tag = ev.target && ev.target.tagName ? String(ev.target.tagName).toLowerCase() : "";
				if (tag === "input" || tag === "textarea" || tag === "select" || (ev.target && ev.target.isContentEditable === true)) return;
				if (k === "/" || k === "f") {
					if (searchRef.current !== null && typeof searchRef.current.focus === "function") { searchRef.current.focus(); ev.preventDefault(); }
					return;
				}
				if (k === " " && tag === "button") return;
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
				{ color: "#3898ff", label: t("node.user") },
				{ color: "#3aa76d", label: t("node.step") },
				{ color: "#ffa34d", label: t("node.tool") },
				{ color: "#b06cff", label: t("node.compaction") },
				{ color: "#ff5c5c", label: t("meta.error") }
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
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.toStart"), onClick: toStart, children: "⏮" }, "toStart"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.prevTurn"), onClick: () => jumpTurn(-1), children: "⇤" }, "prevTurn"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.prev"), onClick: stepPrev, children: "◀" }, "prev"),
							jsx("button", { type: "button", className: "dstv_tbtn dstv_playBtn", title: playing ? t("action.pause") : t("action.play"), onClick: togglePlay, children: playing ? "❚❚" : "▶" }, "play"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.nextTurn"), onClick: () => jumpTurn(1), children: "⇥" }, "nextTurn"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.toEnd"), onClick: toEnd, children: "⏭" }, "toEnd"),
							jsx("button", { type: "button", className: "dstv_tbtn", title: t("action.speed"), onClick: cycleSpeed, children: SPEED_LABELS[speedIdx] ?? SPEED_LABELS[0] }, "speed"),
							jsx("button", { type: "button", className: "dstv_tbtn", "data-on": follow ? "true" : undefined, title: t("action.follow"), onClick: () => setFollow((f) => !f), children: "⇣" }, "follow")
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
						title: t("action.exportMd"),
						onClick: doExport,
						children: mdCopied === true ? `✓ ${t("action.exported")}` : "📋 Markdown"
					}, "hExport") : null,
					stats.lastModel != null ? jsx("span", { className: "dstv_modelChip", title: stats.lastModel, children: `🤖 ${stats.lastModel}` }, "hModel") : null,
					jsxs("span", {
						className: "dstv_search",
						"data-active": searching ? "true" : undefined,
						children: [
							jsx("span", { className: "dstv_sbtn", style: { cursor: "default" }, children: "🔍" }, "sIco"),
							jsx("input", {
								ref: searchRef,
								className: "dstv_searchInput",
								value: query,
								placeholder: t("action.search"),
								onChange: (ev) => setQueryRaw(ev.target != null ? ev.target.value : ""),
								onKeyDown: onSearchKey
							}, "sIn"),
							searching ? jsx("span", { className: `dstv_searchCount${matches.length === 0 ? " none" : ""}`, children: matches.length === 0 ? t("search.none") : `${Math.min(matchPtr + 1, matches.length)}/${matches.length} ${t("search.matches")}` }, "sCnt") : null,
							searching && matches.length > 0 ? jsx("button", { type: "button", className: "dstv_sbtn", title: t("action.searchPrev"), onClick: () => gotoMatch(-1), children: "↑" }, "sPrev") : null,
							searching && matches.length > 0 ? jsx("button", { type: "button", className: "dstv_sbtn", title: t("action.searchNext"), onClick: () => gotoMatch(1), children: "↓" }, "sNext") : null,
							searching ? jsx("button", { type: "button", className: "dstv_sbtn", title: t("action.searchClear"), onClick: clearSearch, children: "✕" }, "sClr") : null
						]
					}, "hSearch")
				]
			}, "rootHead");

			if (N === 0) {
				return jsxs("div", {
					className: "dstv_root",
					tabIndex: 0,
					children: [header, jsxs("div", {
						className: "dstv_empty",
						children: [
							jsx("span", { className: "dstv_emptyGlyph", children: "◉" }, "emptyGlyph"),
							t("view.empty"),
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
									s.live === true ? jsx("i", { className: "dstv_dot", "data-live": true }, "stIcon") : s.hasError ? jsx("span", { className: "dstv_bad", children: "✗" }, "stIcon") : jsx("span", { className: "dstv_ok", children: "✓" }, "stIcon"),
									s.label,
									jsx("span", { className: "dstv_chips", children: s.meta.map((m, i) => jsx("span", { className: "dstv_chip", children: m }, `sm${i}`)) }, "stChips")
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
										s.startMs != null ? jsx("span", { className: "dstv_spanArrow", children: "→" }, "spA") : null,
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
											cell.thinking !== "" ? jsx("div", { className: "dstv_text dstv_clamp2 sec", title: cell.thinking, children: `💭 ${cell.thinking}` }, "aThink") : null,
											cell.text !== "" ? jsx("div", { className: "dstv_text dstv_clamp2", title: cell.text, children: cell.text }, "aText") : null
										]
									}, `a${cell.id}`);
								}
								if (cell.kind === "tool") {
									return jsxs("div", {
										className: "dstv_cellRow",
										children: [
											jsxs("span", {
												className: "dstv_cellName",
												title: cell.args !== "" ? `${cell.name} ${cell.args}` : undefined,
												children: [
													cell.running === true ? jsx("i", { className: "dstv_dot", "data-live": true }, "tIcon") : cell.isError ? jsx("span", { className: "dstv_bad", children: "✗" }, "tIcon") : jsx("span", { className: "dstv_ok", children: "✓" }, "tIcon"),
													`${toolGlyph(cell.name)} ${cell.name}`,
													cell.isError ? jsx("span", { className: "dstv_chip err", children: t("chip.error") }, "tErr") : null,
													cell.running ? jsx("span", { className: "dstv_chip run", children: t("chip.running") }, "tRun") : null
												]
											}, "tName"),
											cell.args !== "" ? jsx("div", { className: "dstv_argsPrev", title: cell.args, children: `${cell.args.replace(/\s+/g, " ").slice(0, 64)}…` }, "tArgs") : null,
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
						title: `${s.label}${fmtClock(s.time) !== "" ? ` · ${fmtClock(s.time)}` : ""}`,
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
							children: [
								revealed !== null ? jsx("span", { className: "dstv_playhead", style: { left: `${26 + (R - 1) * STATION_W + STATION_W / 2}px` }, children: jsx("i", {}) }, "ph") : null,
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
									const gapPrefix = showGap ? [jsx("span", { className: "dstv_gapBand", title: `${t("gap.idle")} ${fmtMs(gapMs)}`, children: `⏸ ${fmtMs(gapMs)}` }, `gap${s.id}`)] : [];
									let dotCls = "dstv_hDot";
									if (s.kind === "user") dotCls += " user";
									else if (s.kind === "compaction") dotCls += " compaction";
									else if (s.kind === "error" || s.kind === "maxTokens") dotCls += " error";
									else if (s.kind === "retry") dotCls += " retry";
									else if (s.kind === "command") dotCls += " command";
									else if (s.kind === "orphan-tool") dotCls += " orphan";
									else if (s.kind === "step" && s.cells.some((c) => c.kind === "tool")) dotCls += " tool";
									if (s.kind === "step" && s.live === true) dotCls += " live";
									const matched = searching && matchSet.has(i);
									const clock = fmtClock(s.time);
									return jsxs("div", {
										className: "dstv_station",
										"data-station-idx": String(i),
										"data-dim": reached ? undefined : "true",
										"data-seek-dim": searching && !matched && reached ? "true" : undefined,
										"data-match": matched ? "true" : undefined,
										"data-active": revealed !== null && i === R - 1 ? "true" : undefined,
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
											renderStationCard(s, `card${s.id}`)
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
			const activeLive = activeStation.kind === "step" && activeStation.live === true;
			const activeError = activeStation.kind === "step" ? activeStation.hasError : activeStation.kind === "error";
			const canRequest = (activeStation.kind === "step" && activeStation.request !== null) || (activeStation.kind === "compaction" && activeStation.crequest != null);
			const showTab = tab === "request" && canRequest ? "request" : "detail";

			const renderDetailBody = (s) => {
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
					return jsxs("div", { className: "dstv_dBody", children: [
						jsx("span", { className: "dstv_dLabel", children: s.who }, "dLbl"),
						jsx("div", { className: "dstv_dText", children: s.text !== "" ? s.text : "…" }, "dTxt")
					] });
				}
				if (s.kind === "step") {
					const cellsBody = jsxs("div", { className: "dstv_dBody", children: s.cells.map((cell) => {
						if (cell.kind === "assistant") {
							return jsxs("div", { className: "dstv_dSection", children: [
								jsx("span", { className: "dstv_dLabel", children: t("node.assistant") }, "aLbl"),
								cell.thinking !== "" ? jsxs("details", { className: "dstv_det", open: false, children: [
									jsx("summary", { children: [`💭 ${t("chip.thinking")}`, jsx("span", { className: "sub", children: String(cell.thinking.length) }, "aThLen")] }, "aThSum"),
									jsx("div", { className: "inner", children: jsx("div", { className: "dstv_dText sec", children: cell.thinking }, "aThText") }, "aThInner")
								] }, `dth${cell.id}`) : null,
								cell.text !== "" ? jsx("div", { className: "dstv_dText", children: cell.text }, "aText") : null
							] }, `da${cell.id}`);
						}
						if (cell.kind === "tool") {
							const pretty = prettyArgs(cell.args);
							const hasResult = cell.resultText !== "" || cell.isError;
							return jsxs("div", { className: "dstv_dTool", children: [
								jsxs("span", { className: "dstv_name", title: cell.args !== "" ? `${cell.name} ${cell.args}` : undefined, children: [
									cell.running === true ? jsx("i", { className: "dstv_dot", "data-live": true }, "tIcon") : cell.isError ? jsx("span", { className: "dstv_bad", children: "✗" }, "tIcon") : jsx("span", { className: "dstv_ok", children: "✓" }, "tIcon"),
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
					req.error != null ? jsx("div", { className: "dstv_dTool", style: { borderColor: "rgba(255,92,92,.5)" }, children: [
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
							diff.toolsRemoved.map((n) => jsx("span", { className: "dstv_diffChip del", title: t("diff.toolsRemoved"), children: `- ${n}` }, `pdR${n}`))
						] }, "pdChips")
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
						jsx("span", { className: "dstv_dLabel sec", children: t("detail.requestApprox") }, "mNote"),
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
				dStatus = jsxs("span", { className: "dstv_chip retry", children: [jsx("span", { className: "dstv_bad", style: { background: "#e0c341" }, children: "⏹" }, "stIc"), t("chip.interrupted")] }, "dStatus");
			} else {
				dStatus = jsxs("span", { className: "dstv_chip", children: [jsx("span", { className: "dstv_ok", children: "✓" }, "stIc"), t("status.done")] }, "dStatus");
			}

			const badgeCls = activeStation.kind === "user" ? "user" : activeStation.kind === "error" ? "error" : (activeStation.kind === "compaction" || activeStation.kind === "retry" || activeStation.kind === "command" || activeStation.kind === "maxTokens" || activeStation.kind === "orphan-tool") ? "violet" : "";
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
							activeStation.kind === "step" && activeStation.durationMs != null ? jsx("span", { className: "dstv_chip info", children: `⏱ ${fmtMs(activeStation.durationMs)}` }, "dDur") : null,
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
							anchorNote !== null ? jsx("span", { className: "dstv_chip warn", children: anchorNote }, "dAnchorNote") : null,
							jsx("span", { className: "dstv_dPos", children: `${t("detail.position")} ${String(activeIdx + 1)} / ${N}` }, "dPos"),
							jsx("button", { type: "button", className: "dstv_btn dstv_panelToggle", title: panelFull ? t("action.collapsePanel") : t("action.expandPanel"), onClick: () => setPanelFull((v) => !v), children: panelFull ? "⤡" : "⤢" }, "dToggle")
						]
					}, "dHead"),
					showTab === "request" && canRequest
						? activeStation.kind === "compaction" ? renderCompactionRequestBody(activeStation) : renderRequestBody(activeStation, activeMessages)
						: renderDetailBody(activeStation)
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
				children: [header, jsx("div", { className: "dstv_progress", children: jsx("i", { style: { width: `${Math.round((R / N) * 100)}%` } }, "progFill") }, "rootProg"), kpis, minimapTicks, body, detail]
			});
		}
		//#endregion

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
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "traceview",
				order: 20,
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
			}, TraceMapView));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
