#!/usr/bin/env node
// Walks the v3 mockup in headless Chromium and fails on anything that reads or works wrong.
//
//   node tools/check-mockup-v3.mjs              # every check
//   node tools/check-mockup-v3.mjs --shots DIR  # also save a screenshot of every view, theme and shell
//
// It builds the page from mockups/v3/src and mockups/v3/fixtures first, so it never reads a stale
// build. What it holds the mockup to:
//   - every view renders in both themes, desktop and phone, with a heading, no script error and no
//     sideways scroll; a session's transcript starts in the first viewport
//   - each of the four transcripts replays from the start to the end in its own harness's look
//   - the Claude Code session's question can be approved and denied from the page, and the
//     transcript and the work item follow
//   - sending a work item to an agent opens its session
//   - every drawer and dialog opens, and the first run renders every view's empty state
//   - money reconciles: a transcript's cost is the sum of its requests, and every Spend grouping
//     sums to the month total, to the cent
//   - the copy outside the terminal follows the house rules (no em dash, no mid-dot label, no
//     "undefined", no capitalized brand name, no "1 sessions")
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMockupV3 } from "./build-mockup-v3.mjs";
import { launchChromium } from "./lib/playwright.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const shots = args.includes("--shots") ? path.resolve(args[args.indexOf("--shots") + 1]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const FILE = path.join(os.tmpdir(), `check-mockup-v3-${process.pid}.html`);
writeFileSync(FILE, buildMockupV3());
const URL0 = "file://" + FILE;
const BASE = "/a-intel/core-platform";
const FLAGSHIP = "ses_01K5RS7M2E8FJ3QW";
const TRANSCRIPTS = { [FLAGSHIP]: "claude-code", ses_01K5QX4B9C7XTN2P: "codex-cli", ses_01K5RP2D6H4KLM8V: "cursor", ses_01K5RN8F3J2GHY6T: "stella" };
const VIEWS = {
  work: BASE + "/work", sessions: BASE + "/sessions", agents: BASE + "/agents", steering: BASE + "/steering", servers: BASE + "/servers", spend: BASE + "/spend",
  ...Object.fromEntries(Object.keys(TRANSCRIPTS).map((id) => ["session-" + TRANSCRIPTS[id], BASE + "/sessions/" + id])),
};
const SHELLS = { desktop: { width: 1440, height: 1000 }, phone: { width: 400, height: 860 } };

let passes = 0, failures = 0;
const ok = (cond, what) => { if (cond) passes++; else { failures++; console.error("FAIL " + what); } };

const browser = await launchChromium(root);
const errors = [];
async function open(page, hash, q = "") {
  await page.goto("about:blank");
  await page.goto(`${URL0}?island=0${q}#${hash}`);
  await page.waitForFunction(() => document.querySelector("#app h1, #app h2"), null, { timeout: 15000 });
}
function watch(page, label) {
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${label}: console ${m.text()}`); });
  page.on("dialog", (d) => { errors.push(`${label}: a browser dialog opened (${d.message()})`); d.dismiss(); });
}

// The copy rules, over the page text outside the terminal (the terminal is the harness's own output).
const COPY = [
  ["empty value", /\bundefined\b|\bNaN\b|\bnull\b/],
  ["em or en dash", /[—–]/],
  ["mid-dot", /·/],
  ["brand case", /Oxagen|Stella|Mission Control/],
  ["plural", /\b1 (sessions|requests|items|agents|servers|tools|loads|suggestions|conflicts|keys|entries|work items)\b/],
  ["thousands separator", /\$\d{4,}\.\d{2}/],
  ["US spelling", /colour|behaviour|labelling|cancelled|licence/i],
];
async function copyCheck(page, label) {
  const text = await page.evaluate(() => {
    const off = document.createElement("style");
    off.textContent = ".tc, pre, code, .pill, textarea { display: none !important; }";
    document.head.appendChild(off);
    const t = document.body.innerText;
    off.remove();
    return t;
  });
  for (const [name, re] of COPY) { const m = text.match(re); ok(!m, `${label}: copy rule "${name}" matched ${JSON.stringify(m && text.slice(Math.max(0, m.index - 40), m.index + 40))}`); }
}

// 1. Every view, both themes, both shells.
for (const [shell, vp] of Object.entries(SHELLS)) {
  for (const theme of ["dark", "light"]) {
    const page = await browser.newPage({ viewport: vp });
    watch(page, `${shell}/${theme}`);
    for (const [name, hash] of Object.entries(VIEWS)) {
      const label = `${name} ${shell} ${theme}`;
      await open(page, hash, `&theme=${theme}${shell === "phone" ? "" : ""}`);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const b = document.getElementById("rp-body");
        return {
          h1: !!document.querySelector("#app h1"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          body: b ? b.getBoundingClientRect().top : null, rows: document.querySelectorAll("#rp-body .tr").length,
          phone: document.getElementById("viewport").classList.contains("phone"), theme: document.documentElement.getAttribute("data-theme"),
        };
      });
      ok(m.h1, `${label}: no heading`);
      ok(m.sw <= m.cw + 1, `${label}: the page scrolls sideways (${m.sw} > ${m.cw})`);
      ok(m.phone === (shell === "phone"), `${label}: the ${shell} shell did not apply`);
      ok(m.theme === theme, `${label}: the ${theme} theme did not apply`);
      if (name.startsWith("session-")) {
        ok(m.body !== null && m.body < vp.height * (shell === "phone" ? 0.62 : 0.4), `${label}: the transcript starts at ${m.body}px, below the first viewport`);
        ok(m.rows > 5, `${label}: the transcript shows ${m.rows} rows`);
      }
      if (shell === "desktop") await copyCheck(page, label);
      if (shots) await page.screenshot({ path: path.join(shots, `${name}-${shell}-${theme}.png`) });
    }
    await page.close();
  }
}

// 2. Replays, the question, sending work, drawers, dialogs, money.
const page = await browser.newPage({ viewport: SHELLS.desktop });
watch(page, "flows");

for (const [id, harness] of Object.entries(TRANSCRIPTS)) {
  await open(page, `${BASE}/sessions/${id}`, "&theme=dark");
  const skin = { "claude-code": ".cc", "codex-cli": ".cx", cursor: ".cu", stella: ".st" }[harness];
  ok(await page.$(`.term${skin}`), `${harness}: the terminal is not in its own skin`);
  await page.selectOption('select[data-change="rp-speed"]', "16");
  await page.click('[data-act="rp-restart"]');
  await page.waitForTimeout(400);
  const early = await page.evaluate(() => ({ vt: RP.vt, total: RP.total, rows: document.querySelectorAll("#rp-body .tr").length, playing: RP.playing }));
  ok(early.playing && early.vt < early.total, `${harness}: the replay did not start from the beginning`);
  await page.waitForFunction(() => !RP.playing, null, { timeout: 60000 });
  const end = await page.evaluate(() => ({ vt: RP.vt, total: RP.total, rows: document.querySelectorAll("#rp-body .tr").length, cost: document.getElementById("rp-cost").textContent }));
  ok(Math.abs(end.vt - end.total) < 1e-6, `${harness}: the replay stopped before the end`);
  ok(end.rows > early.rows, `${harness}: the replay added no rows (${early.rows} to ${end.rows})`);
  const recon = await page.evaluate((sid) => {
    const s = sessionBy(sid), led = transcriptLedger(transcriptBy(sid));
    return { sum: led.reqs.reduce((t, q) => t + q.cost.total, 0), cost: s.cost.total, shown: money(s.cost.total) };
  }, id);
  ok(Math.abs(recon.sum - recon.cost) < 1e-9, `${harness}: the session cost ${recon.cost} is not the sum of its requests ${recon.sum}`);
  ok(end.cost === recon.shown, `${harness}: the rail shows ${end.cost} at the end, not ${recon.shown}`);
  // Partway through, the rail shows the requests made so far, summed here from the events and their
  // clock times rather than read back from the rail's own helper.
  const mid = await page.evaluate(() => {
    rpStop(); rpSeek(RP.total * 0.5);
    let sum = 0;
    RP.ev.forEach((e, i) => { if (e.k === "req" && RP.vts[i] <= RP.vt + 1e-6) sum += RP.led.reqs.find((q) => q.n === e.n).cost.total; });
    return { shown: document.getElementById("rp-cost").textContent, want: money(sum) };
  });
  ok(mid.shown === mid.want, `${harness}: halfway, the rail shows ${mid.shown}, not ${mid.want}`);
  // Stepping back from the end lands on a reply shown in full, never a blank one.
  const stepped = await page.evaluate(() => {
    rpSeek(RP.total); rpStep(-1);
    const norm = (x) => x.replace(/[\s\-•⏺]+/g, "");
    let last = null;
    RP.ev.forEach((e, i) => { if (e.k === "say" && RP.vts[i] <= RP.vt + 1e-6) last = e; });
    return !last || norm(document.getElementById("rp-body").innerText).includes(norm(last.text).slice(-30));
  });
  ok(stepped, `${harness}: stepping back from the end shows a reply cut short`);
  // The scrubber dragged to its far end shows the whole session on the rail.
  const scrub = await page.evaluate(() => {
    const el = document.getElementById("rp-scrub");
    el.value = el.max; el.dispatchEvent(new Event("input", { bubbles: true }));
    return { vt: RP.vt, total: RP.total, so: document.getElementById("rp-so").textContent };
  });
  ok(scrub.vt === scrub.total && /Whole session|So far, live/.test(scrub.so), `${harness}: the scrubber's end stops at ${scrub.vt} of ${scrub.total} (${scrub.so})`);
}
// A wait that ends on a tool result is marked on its call: stella's webkit run took 1m 54s.
await open(page, `${BASE}/sessions/ses_01K5RN8F3J2GHY6T`, "&theme=dark");
ok(/Took 1m 54s/.test(await page.innerText("#rp-body")), "stella: the 1m 54s test run carries no Took mark");

// The question: Claude Code's own permission prompt, answered from the page.
await open(page, `${BASE}/sessions/${FLAGSHIP}`, "&theme=dark");
ok(await page.$(".cc-perm"), "claude-code: the permission prompt is not on screen at rest");
ok(await page.$('[data-act="rp-approve"]'), "claude-code: there is no Approve beside the question");
await page.click('[data-act="rp-approve"]');
await page.waitForFunction(() => !RP.playing, null, { timeout: 30000 });
let t = await page.evaluate(() => ({ perm: !!document.querySelector(".cc-perm"), text: document.getElementById("rp-body").innerText, status: sessionBy("ses_01K5RS7M2E8FJ3QW").status, ny: needsYou().length }));
ok(!t.perm && /draft release is up/.test(t.text), "claude-code: approving did not finish the session in the transcript");
ok(t.status === "done" && t.ny === 0, "claude-code: approving left the session waiting");
const replayed = await page.evaluate(() => {
  const ask = RP.ev.findIndex((e) => e.k === "ask");
  rpStop(); rpSeek(RP.vts[ask] + 0.05);
  const buttons = !!document.querySelector('[data-act="rp-approve"], [data-act="rp-deny"]');
  const note = document.getElementById("rp-body").innerText;
  rpAnswer("deny");
  const res = RP.ev.findIndex((e) => e.k === "res" && e.id === "c15");
  rpStop(); rpSeek(RP.vts[res] + 0.05);
  return { buttons, note: /Approved by Marcus Bell in oxagen/.test(note), verdict: S.answered["ses_01K5RS7M2E8FJ3QW"].verdict, changes: document.getElementById("rp-changes").innerText, atEnd: RP.vt >= RP.total - 0.01 };
});
ok(!replayed.buttons && replayed.note, "claude-code: replaying the answered question offers Approve and Deny again");
ok(replayed.verdict === "approve", `claude-code: a second answer overwrote the first (${replayed.verdict})`);
ok(!replayed.atEnd && /draft created/.test(replayed.changes), `claude-code: before the last frame, Changes reads "${replayed.changes.replace(/\s+/g, " ")}"`);
await page.evaluate(() => go("work", null));
await page.click('[data-act="worktab"][data-tab="review"]');
ok(/Draft release v4\.11\.0/.test(await page.innerText("#app")), "work: the approved release did not move its work item to Review");

await open(page, `${BASE}/sessions/${FLAGSHIP}`, "&theme=dark");
await page.click('[data-act="rp-deny"]');
await page.waitForFunction(() => !RP.playing, null, { timeout: 30000 });
t = await page.evaluate(() => document.getElementById("rp-body").innerText);
ok(/No \(tell Claude what to do differently\)/.test(t) && /left the release uncreated/.test(t), "claude-code: denying did not reach the transcript");

// Sending a work item opens a session for it.
await open(page, `${BASE}/work`, "&theme=dark");
const before = await page.evaluate(() => sessions().length);
await page.click('tr [data-act="send"]');
await page.waitForSelector(".dlg");
await page.fill("#send-note", "Pin undici in apps/api only.");
await page.fill("#send-cap", "$3.50");
await page.click('[data-act="send-agent"][data-agent="release-manager"]');
await page.click('[data-act="send-agent"][data-agent="triage"]');
const kept = await page.evaluate(() => ({ note: document.getElementById("send-note").value, cap: document.getElementById("send-cap").value }));
ok(kept.note === "Pin undici in apps/api only." && kept.cap === "$3.50", `send: picking another agent cleared the note or the cap (${JSON.stringify(kept)})`);
await page.click('[data-act="send-go"]');
await page.waitForFunction(() => S.area === "sessions" && S.id && S.id.indexOf("ses_01K5S") === 0, null, { timeout: 10000 });
t = await page.evaluate(() => ({ n: sessions().length, h1: document.querySelector("#app h1").innerText, running: workItems().filter((w) => w.state === "running").length }));
ok(t.n === before + 1, "send: no session was created");
ok(/Bump undici/.test(t.h1), `send: the session page shows "${t.h1}"`);
ok(t.running === 3, "send: the work item did not move to Running");
ok(await page.evaluate(() => RP.T && RP.T.cap === 3.5 && /Pin undici/.test(RP.T.events[0].text)), "send: the new session lost the note or the cap");

// Drawers and dialogs.
await open(page, `${BASE}/work`, "&theme=dark");
const OPENERS = [
  ["drawer workitem", "openDrawer('workitem', 'PLAT-231')", ".drawer"],
  ["drawer agent", "openDrawer('agent', 'triage')", ".drawer"],
  ["drawer steering item", "openDrawer('steeritem', 'instructions')", ".drawer"],
  ["drawer skill", "openDrawer('steeritem', 'release-notes-from-prs')", ".drawer"],
  ["drawer server", "openDrawer('server', 'github')", ".drawer"],
  ...["send", "newwork", "connect", "steerimport", "serverimport", "addserver", "newsteer", "account"].map((d) => [`dialog ${d}`, `openDialog('${d}')`, ".dlg"]),
  ["dialog steer", `openDialog('steer', '${FLAGSHIP}')`, ".dlg"],
];
for (const [name, js, sel] of OPENERS) {
  await page.evaluate(js);
  const has = await page.$(sel);
  ok(has, `${name}: did not open`);
  if (has) await copyCheck(page, name);
  await page.evaluate(() => closeDialog());
}
// A session link inside a drawer opens the session and closes the drawer.
await page.evaluate(() => openDrawer("agent", "release-manager"));
const link = await page.$(".drawer a.li[data-go]");
const target = link && (await link.getAttribute("data-go")).split("|")[1];
if (link) await link.click();
const nav = await page.evaluate(() => ({ drawer: !!S.drawer, layer: document.getElementById("layer").innerHTML.length, area: S.area, id: S.id }));
ok(link && !nav.drawer && nav.layer === 0 && nav.area === "sessions" && nav.id === target, `drawer: a session link left ${JSON.stringify(nav)}`);
// With a transcript loaded, Space on a session that has none leaves the hidden replay alone.
await page.evaluate(() => go("sessions", "ses_01K5RS7M2E8FJ3QW"));
const other = await page.evaluate(() => sessions().find((s) => !s.transcript).id);
await page.evaluate((sid) => go("sessions", sid), other);
const vt0 = await page.evaluate(() => RP.vt);
await page.keyboard.press("Space");
await page.keyboard.press("ArrowLeft");
ok(await page.evaluate((v) => RP.vt === v && !RP.playing, vt0), "keys: Space and the arrows moved a replay that is not on screen");
// A Spend grouping the page does not know falls back to the default instead of throwing.
await open(page, `${BASE}/spend?by=team`, "&theme=dark");
ok(/^Spend$/.test(await page.innerText("#app h1")), "spend: ?by=team did not render the page");

// The unused-tool saving is what the ledger says the definitions cost: rerun the flagship's steps
// with GitHub's unused definitions taken out, and compare.
const saving = await page.evaluate(() => {
  const T = transcriptBy("ses_01K5RS7M2E8FJ3QW"), st = serverStats("github"), p = priceOf(T.model);
  const steps = transcriptSteps(T, transcriptEvents(T));
  let done = false;
  const cut = steps.map((s) => { if (!done && s.add && s.add[0] === "mcp:github") { done = true; return { add: ["mcp:github", s.add[1] - st.unusedTok] }; } return s; });
  const a = Ledger.run(steps), b = Ledger.run(cut);
  const diff = Ledger.cost(a.flows, a.out, p).total - Ledger.cost(b.flows, b.out, p).total;
  const formula = st.unusedTok * (p.cw + (a.reqs.length - 1) * p.cr) / 1e6;
  return { diff, formula };
});
ok(Math.abs(saving.diff - saving.formula) < 1e-9, `server: the unused-tool saving per session is ${saving.formula}, but the ledger says ${saving.diff}`);

// The unused-tool fix-up on a server: turning them off leaves none unused.
await page.evaluate(() => openDrawer("server", "github"));
if (await page.$('[data-act="tools-off"]')) {
  await page.click('[data-act="tools-off"]');
  ok(await page.evaluate(() => serverStats("github").unused.length === 0), "server: Turn them off left tools unused");
} else ok(false, "server: GitHub shows no unused tools to turn off");
await page.evaluate(() => closeDialog());

// Money: every Spend grouping sums to the month, to the cent.
const money = await page.evaluate(() => {
  const total = monthTotal(), all = sessions().reduce((t, s) => t + s.cost.total, 0);
  return { total, all, groups: SPEND_BY.map((b) => [b.key, spendRows(b.key).reduce((t, r) => t + r.cost, 0)]) };
});
ok(Math.abs(money.total - money.all) < 1e-9, "spend: the month total is not the sum of its sessions");
for (const [k, sum] of money.groups) ok(Math.round(sum * 100) === Math.round(money.total * 100), `spend: grouping ${k} sums to ${sum}, not ${money.total}`);

// Steering: a suggestion changes steering only through a steering PR (steering-repo-spec.html,
// Memory). Opening the PR adds nothing. Once it merges, the record joins the list and has reached no
// recorded session. The records' costs, memories included, sum to the cost the header states.
// The check merges each PR by setting its state, since team mode only queues a merge.
async function acceptAndMerge() {
  await open(page, `${BASE}/steering`, "&theme=dark");
  const prs = await page.evaluate(() => STEERING.suggestions.map((sg) => acceptSuggestion(sg.id)));
  const early = await page.evaluate((ns) => ({
    open: ns.every((n) => { const pr = prBy(n); return pr && pr.kind === "record" && pr.state === "open" && /origin: inferred/.test(pr.record.body); }),
    fresh: steeringItems().filter((i) => i.fresh).length,
  }), prs);
  await page.evaluate((ns) => ns.forEach((n) => { prBy(n).state = "merged"; }), prs);
  return early;
}
const early = await acceptAndMerge();
ok(early.open && early.fresh === 0, `steering: a suggestion changed steering before its steering PR merged ${JSON.stringify(early)}`);
const fresh = await page.evaluate(() => steeringItems().filter((i) => i.fresh).map((i) => steeringStats(i)));
ok(fresh.length === 2 && fresh.every((f) => f.cost === 0 && f.sessions === 0), `steering: an added item claims recorded sessions ${JSON.stringify(fresh)}`);
const steer = await page.evaluate(() => {
  const items = steeringItems().reduce((t, i) => t + steeringStats(i).cost, 0);
  const total = sessions().reduce((t, s) => { let c = 0; for (const k in s.cost.by) if (k === "steering" || k === "memory" || /^skill:/.test(k)) c += s.cost.by[k]; return t + c; }, 0);
  return { items, total };
});
ok(Math.abs(steer.items - steer.total) < 1e-9, `steering: the items sum to ${steer.items}, not the header's ${steer.total}`);

// A session sent after the suggestions' steering PRs merge starts with the steering the Send dialog
// promised: the block for the work item's code repository.
await acceptAndMerge();
await page.evaluate(() => go("work", null));
await page.click('tr [data-act="send"]');
await page.waitForSelector(".dlg");
await page.click('[data-act="send-agent"][data-agent="triage"]');
await page.click('[data-act="send-go"]');
await page.waitForFunction(() => S.area === "sessions" && S.id && S.id.indexOf("ses_01K5S") === 0, null, { timeout: 10000 });
const sent = await page.evaluate(() => {
  const T = transcriptBy(S.id);
  const got = transcriptSteps(T, transcriptEvents(T)).filter((s) => s.add && s.add[0] === "steering").reduce((t, s) => t + s.add[1], 0);
  const want = steeringNext(transcriptRepo(T)).reduce((t, i) => t + i.tok, 0);
  return { got, want, banner: /delivered 13 steering records/.test(document.getElementById("rp-body").innerText) };
});
ok(sent.got === sent.want && sent.banner, `send: the session starts with ${sent.got} steering tokens, the dialog promised ${sent.want} (banner ${sent.banner})`);

// The first run: every view renders its empty state.
for (const [name, hash] of Object.entries(VIEWS)) {
  if (name.startsWith("session-")) continue;
  await open(page, hash, "&state=empty&theme=dark");
  const e = await page.evaluate(() => ({ state: !!document.querySelector(".state-wrap, .onb"), rows: document.querySelectorAll("tbody tr").length }));
  ok(e.state, `first run ${name}: no empty state`);
  await copyCheck(page, `first run ${name}`);
}

await browser.close();
for (const e of errors) { failures++; console.error("FAIL " + e); }
console.log(`${failures ? "FAIL" : "ok  "} v3: ${passes} checks passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
