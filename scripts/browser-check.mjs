#!/usr/bin/env node
/**
 * Drive the real component in a real browser and assert the things a server render
 * cannot see: focus, scroll containment, keyboard auto-scroll, clipboard, intervals,
 * responsive width.
 *
 *   node scripts/browser-check.mjs          # build + run, exit 1 on any failure
 *   node scripts/browser-check.mjs --shots  # also save screenshots under test/browser/shots
 *
 * Requires `agent-browser` on PATH (Chrome via CDP). Deliberately NOT part of the smoke
 * suite: the smoke suite must stay runnable without a browser.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const shots = process.argv.includes("--shots");
const run = (cmd, args, input) => spawnSync(cmd, args, { cwd: root, input, encoding: "utf8", timeout: 180000 });

const build = run("node", ["scripts/browser-harness.mjs"]);
if (build.status !== 0) { console.log(build.stdout + build.stderr); process.exit(1); }

const url = "file://" + path.join(root, "test/browser/harness.html");
const open = run("agent-browser", ["open", url]);
if (open.status !== 0) { console.log("agent-browser open failed:\n" + open.stdout + open.stderr); process.exit(1); }
run("agent-browser", ["wait", "1200"]);

const probe = fs.readFileSync(path.join(root, "test/browser/probe.js"), "utf8");
const out = run("agent-browser", ["eval", "--stdin"], probe);
const raw = (out.stdout || "").trim();
let parsed = null;
try {
	// agent-browser prints the evaluated value as a JSON-quoted string.
	const outer = JSON.parse(raw);
	parsed = JSON.parse(outer);
} catch (e) {
	console.log("could not parse the probe result:\n" + raw.slice(0, 800) + "\n" + (out.stderr || ""));
	run("agent-browser", ["close"]);
	process.exit(1);
}

if (shots) {
	fs.mkdirSync(path.join(root, "test/browser/shots"), { recursive: true });
	run("agent-browser", ["screenshot", "--screenshot-dir", "./test/browser/shots"]);
	run("agent-browser", ["set", "viewport", "375", "812"]);
	run("agent-browser", ["wait", "400"]);
	const narrow = run("agent-browser", ["eval", "JSON.stringify({overflow: document.documentElement.scrollWidth > window.innerWidth + 1, w: window.innerWidth})"]);
	run("agent-browser", ["screenshot", "--screenshot-dir", "./test/browser/shots"]);
	try {
		const n = JSON.parse(JSON.parse((narrow.stdout || "").trim()));
		if (n.overflow) parsed.failures.push("at 375px the page scrolls horizontally");
		parsed.info.narrow = n;
	} catch { parsed.failures.push("the 375px probe did not return"); }
	run("agent-browser", ["set", "viewport", "1280", "720"]);
}
run("agent-browser", ["close"]);

console.log("browser-check: stations=" + parsed.info.stations +
	" clickScroll=" + parsed.info.clickScrollLeft +
	" search=" + parsed.info.search +
	" copied=" + parsed.info.copied +
	" replay=" + parsed.info.replay);
if (parsed.failures.length === 0) {
	console.log("browser-check: PASS (" + Object.keys(parsed.info).length + " checks recorded)");
	process.exit(0);
}
console.log("browser-check: FAIL");
for (const f of parsed.failures) console.log("  ✗ " + f);
process.exit(1);
