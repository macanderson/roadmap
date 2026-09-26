#!/usr/bin/env node
// mockups/v3/fixtures/sessions.json holds every September session in Core platform except the four
// with a full transcript (fixtures/transcripts.json). This script writes it. A seeded PRNG makes
// the output the same on every run, so the committed file is exactly what this script produces.
//
// Each row carries its token flows by source, worked out by the same ledger the page uses
// (src/ledger.js). The page prices the flows at load, so every Spend figure is a sum of session
// rows and nothing on the page is typed in twice.
//
//   node mockups/v3/gen-sessions.mjs            # write the fixture
//   node mockups/v3/gen-sessions.mjs --check    # exit 1 if the committed fixture is stale
//
// The numbers are illustrative. Nothing here was measured.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(DIR, "fixtures");
export const OUT = path.join(FIX, "sessions.json");
const read = (f) => JSON.parse(readFileSync(path.join(FIX, f), "utf8"));
const Ledger = vm.runInNewContext(readFileSync(path.join(DIR, "src/ledger.js"), "utf8") + "\n;Ledger");

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per agent: how many sessions, how long they run, how often they call an MCP server, which tools
// they reach for, which skills they load, which memories recall finds for them, and the work they
// do. hashSkills and recall are drawn from a hash of the session, not from the PRNG, so adding one
// leaves every other session as it was.
const PROFILE = {
  "release-manager": { n: 13, req: [18, 55], out: [80, 900], mcp: 0.4, big: 0.1,
    tools: { "github.list_pull_requests": 4, "github.compare_commits": 2, "github.get_file_contents": 3, "github.get_pull_request": 2, "github.create_release": 1, "github.add_issue_comment": 1, "oxagen.report_status": 1 },
    skills: { "release-notes-from-prs": 0.8, "rollback-a-bad-release": 0.15 },
    work: [
      ["a-intel/platform#446", "github", "Cut 4.10.3 release notes"], ["a-intel/platform#431", "github", "Cut 4.10.2 release notes"],
      ["PLAT-201", "linear", "Draft the 4.10.2 hotfix advisory"], ["a-intel/billing-service#88", "github", "Changelog for billing 2.3.0"],
      ["a-intel/platform#438", "github", "Tag v4.10.3 and draft the release"], ["PLAT-205", "linear", "Close the 4.10 milestone"],
      ["a-intel/cli#57", "github", "Release notes for the CLI 1.8.0"], ["PLAT-226", "linear", "Check the 4.11.0 range against the milestone"],
    ] },
  triage: { n: 64, req: [14, 60], out: [60, 700], mcp: 0.3, big: 0.04,
    tools: { "github.get_issue": 5, "github.search_code": 3, "github.get_file_contents": 3, "github.create_pull_request": 3, "github.add_issue_comment": 2, "github.update_issue": 1, "linear.get_issue": 4, "linear.update_issue": 2, "linear.create_comment": 1, "linear.search_issues": 1, "sentry.search_issues": 2, "sentry.get_issue_details": 2, "sentry.get_event": 1, "oxagen.report_status": 1 },
    skills: { "e2e-flake-triage": 0.08 }, recall: { "mem-vitest": 0.5, "mem-refill": 0.35, "mem-utc": 0.3 },
    work: [
      ["a-intel/platform#447", "github", "Invite emails link to the wrong workspace"], ["a-intel/platform#448", "github", "Tooltip clips at the screen edge"],
      ["PLAT-207", "linear", "Upload retries restart from the first chunk"], ["PLAT-210", "linear", "Session list ignores last activity when sorting"],
      ["PLAT-212", "linear", "Webhook signature check rejects rotated secrets"], ["PLAT-214", "linear", "Pagination drops filters on page two"],
      ["PLAT-216", "linear", "The usage chart ignores the browser time zone"], ["PLAT-218", "linear", "Rate limiter counts retries twice"],
      ["PLAT-219", "linear", "Ledger export drops the currency code on refunds"], ["PLAT-221", "linear", "Approval timeout does not reset after a worker restart"],
      ["PLAT-223", "linear", "create_release accepts an empty tag"], ["a-intel/platform#566", "github", "Typo in the invite email subject"],
      ["a-intel/platform#571", "github", "Dark mode contrast on the settings toggle"], ["a-intel/platform#574", "github", "API returns 404 for archived workspaces"],
      ["PLAT-227", "linear", "Slack notification fires twice"], ["a-intel/platform#588", "github", "Retry banner never clears"],
      ["a-intel/platform#593", "github", "Stale cache after a plan change"], ["PLAT-230", "linear", "CSV export uses a semicolon in en-US"],
      ["a-intel/platform#597", "github", "Broken link in the webhook docs"], ["a-intel/platform#602", "github", "Queue depth metric is off by one"],
    ] },
  reviewer: { n: 52, req: [8, 28], out: [120, 800], mcp: 0.65, big: 0,
    tools: { "github.get_pull_request": 3, "github.get_pull_request_diff": 5, "github.get_pull_request_files": 3, "github.get_file_contents": 2, "github.create_pull_request_review": 4, "github.add_issue_comment": 1 },
    skills: {}, hashSkills: { "code-reviewer": 0.9 }, recall: { "mem-vitest": 0.2 },
    review: true },
  "docs-writer": { n: 15, req: [10, 38], out: [120, 1400], mcp: 0.25, big: 0.2,
    tools: { "linear.get_issue": 3, "linear.update_issue": 1, "github.get_file_contents": 2, "github.create_pull_request": 2 },
    skills: {}, recall: { "mem-prose": 0.7 },
    work: [
      ["PLAT-202", "linear", "Docs: the budgets page"], ["PLAT-204", "linear", "Docs: API key scopes"], ["PLAT-208", "linear", "Docs: audit export format"],
      ["PLAT-211", "linear", "Docs: the SSO login hint"], ["PLAT-213", "linear", "Docs: webhook retries"], ["PLAT-215", "linear", "Docs: platform runs tail"],
      ["PLAT-217", "linear", "Docs: queue depth on the health endpoint"], ["PLAT-220", "linear", "Docs: search filters"], ["PLAT-222", "linear", "Docs: 4.10.3 upgrade notes"],
    ] },
  "stella-ci": { n: 44, req: [10, 46], out: [60, 600], mcp: 0.35, big: 0.02, nightly: true,
    tools: { "github.list_workflow_runs": 4, "github.get_workflow_run": 2, "github.get_job_logs": 4, "github.rerun_failed_jobs": 1, "github.create_pull_request": 2, "github.add_issue_comment": 1, "oxagen.report_status": 2 },
    skills: { "e2e-flake-triage": 0.5 }, recall: { "mem-vitest": 0.4 },
    work: [
      ["PLAT-203", "linear", "CI: lint fails on a stale lockfile"], ["PLAT-206", "linear", "Flaky webhook retry test"], ["PLAT-209", "linear", "Quarantine the upload resume test on Firefox"],
      ["PLAT-224", "linear", "CI: e2e shard 3 times out"], ["PLAT-225", "linear", "Flaky ledger export snapshot"], ["PLAT-228", "linear", "CI: pnpm store cache misses"],
      ["PLAT-232", "linear", "Nightly build fails on Node 22.9"], ["PLAT-234", "linear", "Flaky time zone test in the usage chart"],
    ] },
  "amara-claude": { n: 44, req: [30, 190], out: [60, 900], mcp: 0.16, big: 0.06, interactive: true,
    tools: { "github.get_file_contents": 2, "github.search_code": 2, "github.get_issue": 1, "github.get_pull_request": 1, "sentry.search_issues": 2, "sentry.get_issue_details": 2, "sentry.get_trace": 1, "sentry.search_events": 1, "postgres.query": 4, "postgres.describe_table": 2, "postgres.list_tables": 1 },
    skills: {}, recall: { "mem-utc": 0.4, "mem-vitest": 0.3 },
    work: [
      ["a-intel/platform#454", "github", "Add queue depth to the health endpoint"], ["a-intel/platform#460", "github", "Per-workspace API key scopes"],
      ["a-intel/platform#458", "github", "SSO login hint on the sign-in page"], ["SUP-81", "jira", "Export job times out for one customer"],
    ],
    adhoc: ["Profile the ledger export query", "Why the runs table scans on every page load", "Refactor the webhook signer", "Explore the audit export format",
      "Read the rate limiter before #612", "Draft the retry helper", "Move the sessions table to bigint ids", "Clean up unused feature flags",
      "Write the read-only role for the replica", "Trace the slow login on staging", "Sketch the queue depth metric", "Tidy the migration folder",
      "Find who calls the old billing client", "Pair on the invite flow"] },
};

// Tool result sizes, in tokens.
const RESULT = {
  "github.get_pull_request_diff": [3000, 16000], "github.get_job_logs": [3000, 16000], "github.list_pull_requests": [900, 3200],
  "github.get_file_contents": [300, 4200], "github.search_code": [400, 2400], "postgres.query": [200, 2600],
  write: [120, 420], mcp: [250, 1800], "local.read": [800, 9000], "local.bash": [100, 4000], "local.edit": [120, 900],
};
const REVIEWED = [
  [480, "Runs export: a signed bundle and a verifier"], [478, "Run tokens: a delegation ceiling"], [477, "Cache attribution under mid-conversation steering"],
  [475, "create_release rejects an empty tag"], [474, "Recall budget per provider"], [473, "Approval timeout resets after a worker restart"],
  [472, "Webhook deliveries show their retry count"], [471, "Ledger export keeps the currency code on refunds"], [470, "Budgets alert at 80 percent of the cap"],
  [469, "Rate limiter counts retries once"], [468, "CLI: platform runs tail follows a live run"], [467, "The usage chart follows the browser time zone"],
  [465, "Search filters by label and owner"], [464, "Pagination keeps filters on page two"], [462, "Audit export as NDJSON"], [461, "Webhook signature check accepts rotated secrets"],
  [460, "Per-workspace API key scopes"], [458, "SSO login hint on the sign-in page"], [457, "Dark mode for the settings pages"], [456, "Session list sorts by last activity"],
  [455, "Bulk archive for stale branches"], [454, "Health endpoint reports queue depth"], [453, "Upload retries resume from the last chunk"], [451, "Invite emails link to the right workspace"],
  [450, "Tooltip no longer clips at the screen edge"], [481, "policy.decide approves unmatched untainted calls by default"], [479, "Exports rename tool_call to tool.call"],
  [604, "Webhook retries count once per delivery"], [607, "Workspace switcher remembers the last page"], [611, "Bump vite to 8.3"],
  [615, "Seed data for the demo workspace"], [619, "docs: explain cost centers"], [621, "Queue depth metric counts in-flight jobs"],
];

// FNV-1a over a string, as a number in [0, 1).
function h01(str) {
  let x = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x / 4294967296;
}
// The code repository a session works in: the repository its work item names, else platform.
function repoOf(wi) {
  const m = wi && /^a-intel\/([\w-]+)#/.exec(wi.key);
  return "github.com/a-intel/" + (m ? m[1] : "platform");
}

export function generate() {
  const rnd = mulberry32(20260925);
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const chance = (p) => rnd() < p;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const weighted = (w) => { const ks = Object.keys(w); let t = ks.reduce((a, k) => a + w[k], 0) * rnd(); for (const k of ks) { t -= w[k]; if (t <= 0) return k; } return ks[ks.length - 1]; };
  const F = { HARNESSES: read("harnesses.json"), SERVERS: read("servers.json"), STEERING: read("steering.json") };
  const AGENTS = read("agents.json");
  const skillOf = Object.fromEntries(F.STEERING.items.filter((i) => i.kind === "skill").map((i) => [i.id, i]));
  const b32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const ulid = () => "ses_01K5" + Array.from({ length: 12 }, () => b32[int(0, 31)]).join("");
  const rows = [];
  let reviewIdx = 0;

  for (const agent of AGENTS) {
    const P = PROFILE[agent.key];
    for (let s = 0; s < P.n; s++) {
      // When: a weekday between Sept 1 and 25 for people; stella CI also runs nightly.
      let day, hour, min;
      do { day = int(1, 25); } while (!P.nightly && [5, 6, 12, 13, 19, 20].includes(day));
      if (P.nightly && chance(0.45)) { hour = 2; min = int(0, 50); } else { hour = int(8, 18); min = int(0, 59); }
      if (day === 25 && hour >= 12) hour = int(8, 11);
      const started = `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}`;

      // What: a work item, a pull request to review, or an ad hoc session.
      let wi = null, title;
      if (P.review) {
        const [num, t] = REVIEWED[reviewIdx++ % REVIEWED.length];
        wi = { key: `a-intel/platform#${num}`, src: "github", title: `Review: ${t}` };
        title = wi.title;
      } else if (P.interactive && !chance(0.3)) {
        title = pick(P.adhoc);
      } else {
        const [key, src, t] = pick(P.work);
        wi = { key, src, title: t };
        title = t;
      }

      // The session, step by step. Its context starts with what the workspace held that day, the
      // steering block for its code repository, and the memories recall found for it.
      const repo = repoOf(wi), seed = `${agent.key}:${s}`;
      const recall = Object.entries(P.recall || {})
        .filter(([id, p]) => { const m = F.STEERING.items.find((i) => i.id === id); return m.edited <= started.slice(0, 10) && Ledger.reachesRepo(m, repo) && h01(`${seed}:recall:${id}`) < p; })
        .map(([id]) => id);
      const ctx0 = Ledger.context0(agent, F, { at: started, repo, recall });
      const n = int(P.req[0], P.req[1]);
      const steps = ctx0.map(([k, tok]) => ({ add: [k, tok] }));
      const calls = {}, skills = {};
      let dur = 0, prompts = 1;
      steps.push({ add: ["prompt", int(40, 220)] });
      const loads = Object.entries(P.skills).filter(([, p]) => chance(p)).map(([id]) => id);
      const hashed = Object.entries(P.hashSkills || {}).filter(([id, p]) => h01(`${seed}:skill:${id}`) < p).map(([id]) => id);
      let prefixTok = ctx0.reduce((a, [, t]) => a + t, 0);
      // A skill loads its body, and the records that target it load with it.
      const loadSkill = (id) => {
        const k = skillOf[id], rec = Ledger.sum(Ledger.skillRecords(F, k.lineage, repo));
        steps.push({ add: ["skill:" + id, k.tok] }); skills[id] = 1; prefixTok += k.tok;
        if (rec) { steps.push({ add: ["steering#skill", rec] }); prefixTok += rec; }
      };
      for (let i = 1; i <= n; i++) {
        const out = chance(P.big) ? int(1200, 2600) : int(P.out[0], P.out[1]);
        steps.push({ req: out, n: i });
        dur += 2 + out / 55 + rnd() * 6;
        prefixTok += out;
        if (i === n) break;
        if (i === 1) hashed.forEach(loadSkill);
        if (i === 1 && loads.length) { loads.forEach(loadSkill); continue; }
        if (P.interactive && i % int(9, 22) === 0) {
          steps.push({ add: ["prompt", int(30, 260)] }); prompts++; dur += int(25, 420);
        }
        let tok;
        if (chance(P.mcp)) {
          const tool = weighted(P.tools);
          const server = tool.split(".")[0];
          const def = F.SERVERS.servers.find((x) => x.id === server).tools.find((t) => t.n === tool.split(".")[1]);
          const range = RESULT[tool] || (def.write ? RESULT.write : RESULT.mcp);
          tok = int(range[0], range[1]);
          steps.push({ add: [`mcp:${server}#res`, tok] });
          calls[tool] = (calls[tool] || 0) + 1;
          dur += 0.4 + rnd() * 1.6;
        } else {
          const kind = pick(["read", "read", "bash", "edit"]);
          tok = int(RESULT["local." + kind][0], RESULT["local." + kind][1]);
          steps.push({ add: ["local", tok] });
          dur += kind === "bash" ? 0.5 + rnd() * 20 : 0.05;
        }
        prefixTok += tok;
        // Long sessions compact near 150k tokens, the way Claude Code does. The summary's size comes
        // from the hash, so a change to the context's size moves a compaction without reshuffling
        // every session after it.
        if (prefixTok > 150000) {
          steps.push({ compact: 2400 + Math.floor(h01(`${seed}:compact:${i}`) * 1801) });
          prefixTok = ctx0.reduce((a, [, t]) => a + t, 0) + 3000;
        }
      }
      const led = Ledger.run(steps);
      const status = chance(0.06) ? "stopped" : chance(0.02) ? "failed" : "done";
      const row = { id: ulid(), title, agent: agent.key, person: agent.operator, wi, repo, started, dur: Math.round(dur), status,
        req: led.reqs.length, prompts, out: led.out, flows: led.flows, calls, skills };
      if (recall.length) row.recall = recall;
      rows.push(row);
    }
  }
  rows.sort((a, b) => (a.started < b.started ? 1 : -1));
  return rows;
}

function main() {
  const text = JSON.stringify(generate(), null, 0).replace(/\},\{"id"/g, '},\n{"id"') + "\n";
  if (process.argv.includes("--check")) {
    if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
      console.error(`DIFF ${path.relative(process.cwd(), OUT)} is not what gen-sessions.mjs writes. Run: node mockups/v3/gen-sessions.mjs`);
      process.exit(1);
    }
    console.log(`ok   ${path.relative(process.cwd(), OUT)} matches gen-sessions.mjs`);
    return;
  }
  writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${Math.round(text.length / 1024)} KB)`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
