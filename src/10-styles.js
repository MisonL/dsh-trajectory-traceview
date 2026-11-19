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
			// A tick is `flex:1;min-width:3px`, so the strip needs 5px per station and cannot
			// compress below that. A long session carries thousands of stations (3,600 was
			// measured), i.e. ~18,000px of ticks inside a ~1,200px panel — and without an
			// overflow rule that pushed the WHOLE conversation sideways. Scroll the strip
			// itself instead: the overview stays complete and the page layout stays put.
			".dstv_minimap{display:flex;gap:2px;padding:2px 12px 6px;align-items:stretch;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}",
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
			".dstv_chip.info{background:color-mix(in srgb,var(--dstv-info) 12%,transparent);color:var(--dstv-info-ink)}",
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
			// Failure is a real outcome (non-secure context, refused permission) and the
			// button now says so; without a colour the "✗" reads as another label.
			".dstv_copyBtn[data-fail=true]{border-color:var(--dstv-err);color:var(--dstv-err)}",
			"details.dstv_det{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}",
			"details.dstv_det>summary{cursor:pointer;padding:5px 9px;font-size:11.5px;font-weight:600;list-style:none;display:flex;align-items:center;gap:6px}",
			"details.dstv_det>summary::-webkit-details-marker{display:none}",
			"details.dstv_det>summary::before{content:'▸';color:var(--dsw-alias-label-secondary);transition:transform .15s}",
			"details.dstv_det[open]>summary::before{transform:rotate(90deg)}",
			"details.dstv_det>summary .sub{font-weight:400;color:var(--dsw-alias-label-secondary);font-size:10.5px}",
			"details.dstv_det .inner{padding:2px 9px 8px}",
			".dstv_msgRow{display:flex;flex-direction:column;gap:3px}",
			".dstv_msgRole{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:6px}",
			".dstv_msgRole.user{background:color-mix(in srgb,var(--dstv-info) 15%,transparent);color:var(--dstv-info-ink)}",
			".dstv_msgRole.assistant{background:color-mix(in srgb,var(--dstv-info) 15%,transparent);color:var(--dstv-info-ink)}",
			".dstv_msgRole.tool{background:color-mix(in srgb,var(--dstv-warn) 15%,transparent);color:var(--dstv-warn-ink)}",
			".dstv_msgRole.note{background:color-mix(in srgb,var(--dstv-unknown) 15%,transparent);color:var(--dstv-unknown-ink)}",
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
			".dstv_ev-reconstructed{color:var(--dstv-warn-ink);background:color-mix(in srgb,var(--dstv-warn) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-warn) 38%,transparent)}",
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
			".dstv_scope{height:18px;padding:0 5px;font-size:10.5px;line-height:1;border:1px solid color-mix(in srgb,var(--dstv-warn) 50%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dstv-warn) 10%,transparent);color:var(--dstv-warn-ink);white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:2px}",
			".dstv_scope:hover{background:color-mix(in srgb,var(--dstv-warn) 20%,transparent)}",
			".dstv_scope:disabled{cursor:default;opacity:.6}",
			".dstv_sbtn{height:18px;min-width:20px;padding:0 3px;font-size:11px;line-height:1;border:0;border-radius:5px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}",
			".dstv_sbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".dstv_btn[data-on=true]{color:var(--dstv-info-ink);background:color-mix(in srgb,var(--dstv-info) 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dstv-info) 40%,transparent)}",
			".dstv_tbtn[data-on=true]{color:var(--dstv-info-ink);background:color-mix(in srgb,var(--dstv-info) 14%,transparent);font-weight:700}",
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
			".dstv_diffChip.del{background:color-mix(in srgb,var(--dstv-err) 14%,transparent);color:var(--dstv-err-ink);text-decoration:line-through}",
			".dstv_diffChip.delta{background:color-mix(in srgb,var(--dstv-info) 12%,transparent);color:var(--dstv-info-ink)}",
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
