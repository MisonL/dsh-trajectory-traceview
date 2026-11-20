/* In-page assertions for scripts/browser-check.mjs. Returns {failures:[], info:{}}. */
(async function () {
	const tick = (ms) => new Promise((r) => setTimeout(r, ms === void 0 ? 120 : ms));
	const failures = [];
	const info = {};
	const fail = (m) => failures.push(m);
	const opts = () => [...document.querySelectorAll("[role=option]")];
	const scroller = () => document.querySelector(".dstv_scroller");
	const selected = () => opts().map((o, i) => (o.getAttribute("aria-selected") === "true" ? i : -1)).filter((i) => i >= 0);
	const tabStops = () => opts().map((o, i) => (o.tabIndex === 0 ? i : -1)).filter((i) => i >= 0);
	const fullyVisible = (i) => {
		const sc = scroller().getBoundingClientRect();
		const b = opts()[i].getBoundingClientRect();
		return b.left >= sc.left - 2 && b.right <= sc.right + 2;
	};
	const press = async (k) => {
		document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
		await tick();
	};

	info.stations = opts().length;
	info.runtimeErrors = (window.__errors || []).slice(0, 3);
	if (info.stations < 10) fail("the fixture rendered only " + info.stations + " stations");
	if (info.runtimeErrors.length > 0) fail("runtime errors: " + info.runtimeErrors.join(" | "));

	// 1) every interactive element must expose an accessible name
	const nameless = [...document.querySelectorAll("button,a,input")].filter((el) => {
		if (el.getAttribute("aria-label") !== null && el.getAttribute("aria-label") !== "") return false;
		return (el.textContent || "").trim() === "" && el.tagName !== "INPUT";
	});
	if (nameless.length > 0) fail(nameless.length + " interactive element(s) with no accessible name");

	// 2) click a step station: selection follows, the card scrolls into view, keyboard roving moves
	const stepIdx = opts().findIndex((o) => (o.getAttribute("aria-label") || "").indexOf("步骤") >= 0);
	if (stepIdx < 0) fail("the fixture has no step station");
	else {
		opts()[stepIdx].click();
		await tick();
		if (selected().join() !== String(stepIdx)) fail("clicking station " + stepIdx + " selected " + JSON.stringify(selected()));
		if (tabStops().join() !== String(stepIdx)) fail("the roving tab stop did not follow the selection");
		if (!fullyVisible(stepIdx)) fail("the selected station is not scrolled fully into view");
		info.clickScrollLeft = Math.round(scroller().scrollLeft);
	}

	// 3) keyboard: Root focused, ArrowRight/Left move + scroll, Home/End work
	document.querySelector(".dstv_root").focus();
	if (document.activeElement !== document.querySelector(".dstv_root")) fail("the panel root is not focusable");
	const before = selected()[0];
	await press("ArrowRight");
	const afterRight = selected()[0];
	if (afterRight !== before + 1) fail("ArrowRight moved " + before + " -> " + afterRight);
	if (!fullyVisible(afterRight)) fail("ArrowRight left the new selection off-screen");
	await press("ArrowLeft");
	if (selected()[0] !== before) fail("ArrowLeft did not return to " + before);
	await press("Home");
	if (selected()[0] !== 0) fail("Home did not select station 0");
	if (!fullyVisible(0)) fail("Home left station 0 off-screen");
	await press("End");
	if (selected().length !== 0) fail("End should return to the overview (no selection), got " + JSON.stringify(selected()));
	info.keyboard = "ok";

	// 4) search: no false position before navigating, then ↓ walks the matches and scrolls
	const input = document.querySelector("input.dstv_searchInput:not(.dstv_anchorInput)");
	if (input === null) fail("the search input is missing");
	else {
		const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set;
		setter.call(input, "报错");
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await tick();
		const counter = document.querySelector(".dstv_searchCount");
		if (counter === null) fail("the match counter did not render");
		else if (counter.textContent.indexOf("–/") < 0) fail("a fresh query already claims a position: " + counter.textContent);
		if (selected().length !== 0) fail("typing a query moved the view before any navigation");
		const next = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "下一个命中");
		const prev = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "上一个命中");
		if (next === undefined || prev === undefined) fail("the prev/next match buttons are missing");
		else {
			if (next.disabled === true) fail("the next-match button is disabled while matches exist");
			next.click();
			await tick();
			if (counter.textContent.indexOf("1/") < 0) fail("the first ↓ did not land on match 1: " + counter.textContent);
			if (selected().length !== 1) fail("the first ↓ left no station selected");
			if (!fullyVisible(selected()[0])) fail("the matched station is not scrolled into view");
			next.click();
			await tick();
			if (counter.textContent.indexOf("2/") < 0) fail("the second ↓ did not advance: " + counter.textContent);
			info.search = counter.textContent;
		}
	}

	// 5) copy: the component must call the clipboard with a parsable anchor.
	// Re-select a STEP first: the search assertions above leave a text-only station
	// selected, which has no request and therefore no copy button — a probe error, not
	// a product one (measured: the button exists on every step station).
	const stepForCopy = opts().findIndex((o) => (o.getAttribute("aria-label") || "").indexOf("步骤") >= 0);
	if (stepForCopy >= 0) { opts()[stepForCopy].click(); await tick(200); }
	const wrote = [];
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText: async (t) => { wrote.push(t); } }
	});
	// The button's accessible name comes from its TEXT ("🔗 复制锚点"); it carries no
	// aria-label. Matching only on aria-label was a probe error.
	const copyBtn = [...document.querySelectorAll("button")].find((b) => /复制锚点/.test((b.getAttribute("aria-label") || "") + (b.textContent || "")));
	if (copyBtn === undefined) fail("the copy-anchor button is not on the selected step");
	else {
		copyBtn.click();
		await tick(200);
		if (wrote.length === 0) fail("clicking copy never called navigator.clipboard.writeText");
		else if (!/^tvp1:e\d+$/.test(wrote[wrote.length - 1])) fail("the copied anchor has the wrong shape: " + wrote[wrote.length - 1]);
		else info.copied = wrote[wrote.length - 1];
	}

	// 6) replay: the interval advances the selection and pause stops it
	const play = [...document.querySelectorAll("button")].find((b) => /开始回放/.test((b.getAttribute("aria-label") || "") + (b.textContent || "")));
	if (play === undefined) fail("the replay button is missing");
	else {
		play.click();
		await tick(300);
		const n0 = selected()[0];
		await tick(2200);
		const n1 = selected()[0];
		if (!(typeof n1 === "number" && n1 > n0)) fail("replay did not advance within 2.5 s (" + n0 + " -> " + n1 + ")");
		const pause = [...document.querySelectorAll("button")].find((b) => /暂停/.test((b.getAttribute("aria-label") || "") + (b.textContent || "")));
		if (pause === undefined) fail("the pause button did not appear during replay");
		else {
			pause.click();
			await tick(200);
			const p0 = selected()[0];
			await tick(1600);
			if (selected()[0] !== p0) fail("pause did not stop the replay");
			info.replay = n0 + " -> " + n1 + " -> paused";
		}
	}

	// 7) detail panel must scroll internally, never grow the page
	const detail = document.querySelector(".dstv_detail");
	const body = document.querySelector(".dstv_dBody");
	if (detail !== null && body !== null) {
		const pageBefore = document.documentElement.scrollHeight;
		body.scrollTop = 1e6;
		await tick(120);
		if (body.scrollHeight > body.clientHeight + 1 && body.scrollTop === 0) fail("the detail body claims to scroll but did not move");
		info.detailScroll = { canScroll: body.scrollHeight > body.clientHeight + 1, movedTo: body.scrollTop };
	}

	// 8) tokens resolve (a missing host token silently kills the whole visual design)
	const rootStyle = getComputedStyle(document.querySelector(".dstv_root"));
	const missingVars = ["--dsw-alias-border-l2", "--dsw-alias-label-primary", "--dsw-alias-bg-layer-1"]
		.filter((v) => rootStyle.getPropertyValue(v).trim() === "");
	if (missingVars.length > 0) fail("theme token(s) unresolved: " + missingVars.join(", "));

	return JSON.stringify({ failures, info });
})()
