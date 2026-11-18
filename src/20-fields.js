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
