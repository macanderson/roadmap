/* ============================== data.js ==============================
   Every figure on the page is derived here from the fixtures, at load. A session's cost is its
   ledger flows priced at its model's list price (fixtures/prices.json). The four sessions with a
   transcript get their flows from their own events, request by request, through the same ledger
   as the generated ones (gen-sessions.mjs). Spend sums session rows, so every grouping adds up to
   the month total by construction. */
var PRICES = F.PRICES, AGENTS = F.AGENTS, HARNESSES = F.HARNESSES, SERVERS = F.SERVERS.servers, STEERING = F.STEERING;
var LEDGER_F = { HARNESSES: HARNESSES, SERVERS: F.SERVERS, STEERING: STEERING };
var FLAGSHIP = "ses_01K5RS7M2E8FJ3QW";

function agentBy(key) { for (var i = 0; i < AGENTS.length; i++) if (AGENTS[i].key === key) return AGENTS[i]; return null; }
function serverBy(id) { for (var i = 0; i < SERVERS.length; i++) if (SERVERS[i].id === id) return SERVERS[i]; return null; }
function priceOf(model) { return PRICES[model]; }
function modelLabel(model) { return (PRICES[model] || { label: model }).label; }


/* ---- transcripts: events → ledger steps → requests ---- */
/* The code repository a session works in: the one its work item names, else platform. */
function repoOfWork(key) { var m = key && /^a-intel\/([\w-]+)#/.exec(key); return "github.com/a-intel/" + (m ? m[1] : "platform"); }
function transcriptRepo(T) { return T.repo || repoOfWork(T.wi); }
function skillById(id) { for (var i = 0; i < STEERING.items.length; i++) if (STEERING.items[i].kind === "skill" && STEERING.items[i].id === id) return STEERING.items[i]; return null; }
function transcriptSteps(T, events) {
  var agent = agentBy(T.agent), repo = transcriptRepo(T);
  var steps = Ledger.context0(agent, LEDGER_F, { at: T.started, repo: repo, recall: T.recall || [] }).map(function (c) { return { add: c }; });
  // A session sent from this page also carries the records that steering PRs merged here before it started.
  if (T.extraSteering) steps.push({ add: ["steering", T.extraSteering] });
  var calls = {};
  events.forEach(function (e) {
    if (e.k === "call") calls[e.id] = e;
    if (e.k === "prompt" || e.k === "steer") steps.push({ add: ["prompt", e.tok] });
    else if (e.k === "req") steps.push({ req: e.out, n: e.n, t: e.t });
    else if (e.k === "res") {
      var c = calls[e.id], key = e.src;
      if (c && c.tool.kind === "skill") key = "skill:" + c.tool.name;
      else if (/^mcp:/.test(key)) key = key + "#res";
      steps.push({ add: [key, e.tok] });
      // The records that target a skill load with it.
      var sk = c && c.tool.kind === "skill" ? skillById(c.tool.name) : null, rec = sk ? Ledger.sum(Ledger.skillRecords(LEDGER_F, sk.lineage, repo)) : 0;
      if (rec) steps.push({ add: ["steering#skill", rec] });
    }
  });
  return steps;
}
/* The events a transcript holds right now: its fixture, plus the answer to its question when a
   person answered it on this page. */
function transcriptEvents(T) {
  var ans = S.answered[T.id];
  if (!ans) return T.events;
  var ask = T.events.filter(function (e) { return e.k === "ask"; })[0];
  var tail = (ans.verdict === "approve" ? T.onApprove : T.onDeny).map(function (e) {
    var c = {}; for (var k in e) if (k !== "dt") c[k] = e[k];
    c.t = ans.t + e.dt; return c;
  });
  return T.events.concat([{ t: ans.t, k: "answer", id: ask.id, verdict: ans.verdict, by: ME, via: "oxagen" }]).concat(tail);
}
function transcriptLedger(T) {
  var ev = transcriptEvents(T), led = Ledger.run(transcriptSteps(T, ev)), p = priceOf(T.model);
  led.reqs.forEach(function (q) { q.cost = Ledger.reqCost(q, p); });
  return led;
}
function transcriptStatus(T) {
  var ans = S.answered[T.id];
  if (T.status === "needs-you" && ans) return "done";
  return T.status;
}

/* ---- sessions: the generated month, the four transcripts, and any sent from this page ---- */
function sessionFromTranscript(T) {
  var led = transcriptLedger(T), ev = transcriptEvents(T), last = ev[ev.length - 1];
  var calls = {}, byId = {}, skills = {};
  ev.forEach(function (e) {
    if (e.k === "call") byId[e.id] = e;
    if (e.k === "call" && e.tool.kind === "mcp") { var k = e.tool.server + "." + e.tool.name; calls[k] = (calls[k] || 0) + 1; }
    if (e.k === "call" && e.tool.kind === "skill") skills[e.tool.name] = 1;
  });
  var status = transcriptStatus(T), live = status === "running" || status === "needs-you";
  var elapsed = live ? (NOW - dt(T.started)) / 1000 : last.t;
  return {
    id: T.id, title: T.title, agent: T.agent, person: T.person, started: T.started, dur: elapsed, status: status,
    wi: T.wi ? { key: T.wi, src: workBy(T.wi) ? workBy(T.wi).src : "github", title: workBy(T.wi) ? workBy(T.wi).title : T.title } : null,
    req: led.reqs.length, out: led.out, flows: led.flows, calls: calls, transcript: true, basis: T.basis,
    repo: transcriptRepo(T), skills: skills, recall: T.recall || [], steer: T.steer || null,
  };
}
function workBy(key) { for (var i = 0; i < F.WORK.length; i++) if (F.WORK[i].key === key) return F.WORK[i]; return null; }
function transcriptBy(id) { return F.TRANSCRIPTS[id] || S.sentTranscripts && S.sentTranscripts[id] || null; }

var _sessions = null, _sessionsKey = "";
function sessions() {
  var key = JSON.stringify(S.answered) + "|" + Object.keys(S.sent).join(",") + "|" + S.empty;
  if (_sessions && key === _sessionsKey) return _sessions;
  if (S.empty) { _sessions = []; _sessionsKey = key; return _sessions; }
  var rows = F.SESSIONS.map(function (s) { var c = {}; for (var k in s) c[k] = s[k]; c.basis = agentBy(s.agent).harness === "cursor" ? "harness" : "gateway"; return c; });
  Object.keys(F.TRANSCRIPTS).forEach(function (id) { rows.push(sessionFromTranscript(F.TRANSCRIPTS[id])); });
  Object.keys(S.sent).forEach(function (k) { rows.push(S.sent[k].session); });
  rows.forEach(function (s) {
    var a = agentBy(s.agent);
    s.model = a.model; s.harness = a.harness;
    s.cost = Ledger.cost(s.flows, s.out, priceOf(a.model));
    s.tokens = Object.keys(s.flows).reduce(function (t, k) { return t + s.flows[k][0] + s.flows[k][1]; }, 0) + s.out;
  });
  rows.sort(function (a, b) { return a.started < b.started ? 1 : -1; });
  _sessions = rows; _sessionsKey = key;
  return rows;
}
function sessionBy(id) { var all = sessions(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
function isLive(s) { return s.status === "running" || s.status === "needs-you" || s.status === "starting"; }

/* ---- where a session's money went: sources folded into the rows a person reads ---- */
function sourceGroup(src, harness) {
  if (src === "output") return { key: "output", label: "Model output" };
  if (src === "system" || src === "tools") return { key: "harness", label: hxLabel(harness) + " prompt and tools" };
  if (src === "steering" || src === "memory" || /^skill:/.test(src)) return { key: "steering", label: "Steering" };
  if (/^mcp:/.test(src)) { var sv = serverBy(src.slice(4)); return { key: src, label: (sv ? sv.name : src.slice(4)) + " server", server: src.slice(4) }; }
  if (src === "local") return { key: "local", label: "Files and commands" };
  return { key: "conversation", label: "Conversation" };
}
function whereItWent(by, harness) {
  var rows = {}, order = [];
  Object.keys(by).forEach(function (src) {
    var gr = sourceGroup(src, harness);
    if (!rows[gr.key]) { rows[gr.key] = { key: gr.key, label: gr.label, cost: 0, server: gr.server }; order.push(gr.key); }
    rows[gr.key].cost += by[src];
  });
  return order.map(function (k) { return rows[k]; }).sort(function (a, b) { return b.cost - a.cost; });
}

/* ---- Spend: one month, five groupings ---- */
function monthTotal() { return sessions().reduce(function (t, s) { return t + s.cost.total; }, 0); }
var SPEND_BY = [
  { key: "work", label: "Work item" }, { key: "agent", label: "Agent" }, { key: "person", label: "Person" },
  { key: "model", label: "Model" }, { key: "server", label: "MCP server" },
];
function spendRows(by) {
  var map = {}, order = [], all = sessions();
  function row(key, label, extra) {
    if (!map[key]) { map[key] = { key: key, label: label, cost: 0, sessions: [], tokens: 0 }; for (var k in extra || {}) map[key][k] = extra[k]; order.push(key); }
    return map[key];
  }
  if (by === "server") {
    var total = 0;
    all.forEach(function (s) {
      Object.keys(s.cost.by).forEach(function (src) {
        if (!/^mcp:/.test(src)) return;
        var id = src.slice(4), sv = serverBy(id), r = row(id, sv ? sv.name : id, { server: id });
        r.cost += s.cost.by[src]; total += s.cost.by[src];
        if (r.sessions[r.sessions.length - 1] !== s) r.sessions.push(s);
        r.tokens += s.flows[src][0] + s.flows[src][1];
      });
    });
    var rest = row("_rest", "Everything else", { rest: true });
    rest.cost = monthTotal() - total;
    rest.note = "Model output, prompts, steering, files and commands";
  } else {
    all.forEach(function (s) {
      var r;
      if (by === "agent") { var a = agentBy(s.agent); r = row(a.key, a.name, { agent: a }); }
      else if (by === "person") r = row(s.person, personName(s.person), { person: s.person });
      else if (by === "model") r = row(s.model, modelLabel(s.model), { model: s.model });
      else r = s.wi ? row(s.wi.key, s.wi.title, { wi: s.wi }) : row("_none", "No work item", { none: true, note: "Sessions started in a terminal" });
      r.cost += s.cost.total; r.sessions.push(s); r.tokens += s.tokens;
    });
  }
  return order.map(function (k) { return map[k]; }).sort(function (a, b) {
    if (a.rest) return 1; if (b.rest) return -1;
    return b.cost - a.cost;
  });
}
function dailySpend() {
  var days = [], from = new Date(F.ORG.month.from + "T00:00:00"), to = new Date(F.ORG.month.to + "T00:00:00");
  for (var d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) days.push({ date: new Date(d), cost: 0 });
  sessions().forEach(function (s) {
    var sd = dt(s.started), i = Math.round((new Date(sd.getFullYear(), sd.getMonth(), sd.getDate()) - from) / 864e5);
    if (days[i]) days[i].cost += s.cost.total;
  });
  return days;
}

/* ---- MCP servers ---- */
function serverStats(id) {
  var sv = serverBy(id), all = sessions(), cost = 0, calls = 0, perTool = {}, reqs = 0, save = 0;
  // Unused: imported, on, not already leaving in a staged change, and never called this month.
  var unused = sv.tools.filter(function (t) { return t.state !== "available" && !toolOffBy(id, t) && !stagedOp(id, "remove", t.n); });
  all.forEach(function (s) {
    if (s.cost.by["mcp:" + id]) cost += s.cost.by["mcp:" + id];
    Object.keys(s.calls || {}).forEach(function (k) {
      if (k.indexOf(id + ".") === 0) { calls += s.calls[k]; perTool[k.slice(id.length + 1)] = (perTool[k.slice(id.length + 1)] || 0) + s.calls[k]; }
    });
  });
  unused = unused.filter(function (t) { return !perTool[t.n]; });
  var unusedTok = unused.reduce(function (a, t) { return a + t.tok; }, 0);
  // Turning an unused tool off takes its definition out of every request of every session that
  // carries this server. The ledger writes it once, on the first request, at the cache-write price,
  // and every later request re-reads it at the cache-read price.
  all.forEach(function (s) {
    if (!s.flows["mcp:" + id]) return;
    var p = priceOf(s.model);
    reqs += s.req;
    save += unusedTok * (p.cw + (s.req - 1) * p.cr) / 1e6;
  });
  var defTok = sv.tools.reduce(function (a, t) { return a + (t.state !== "available" && !toolOffBy(id, t) ? t.tok : 0); }, 0);
  return { cost: cost, calls: calls, perTool: perTool, unused: unused, unusedTok: unusedTok, save: save, defTok: defTok, reqs: reqs };
}

/* ---- Steering ---- */
/* The records on this page: the steering repo's, plus the record each steering PR opened here adds
   once that PR merges. Nothing else changes steering. */
function steeringItems() {
  var items = STEERING.items.slice();
  S.newPrs.forEach(function (pr) {
    var r = pr.record;
    if (pr.kind !== "record" || pr.state !== "merged" || !r) return;
    items.push({ id: "new-" + pr.n, lineage: r.lineage, label: r.label, kind: r.kind, force: r.force, scope: r.scope, repos: r.repos || [], tools: r.tools || [], applies_to: r.applies_to || [], skills: r.skills || [],
      text: r.text, tok: r.tok, path: r.path, body: r.body, by: pr.by, edited: String(pr.merged || F.ORG.now).slice(0, 10), version: 1, fresh: true, pr: pr.n });
  });
  return items;
}
/* What each record, memory, and skill cost this month. A session's steering cost splits across the
   records it carried, by token share: the block for its code repository (the always-on records in
   full, and an index line for each of the rest), then the records that target a skill it loaded.
   Its memory cost splits across the memories recall found for it. A skill's cost is its index line
   plus its loads. A record a steering PR merged here reaches only the sessions sent after the merge. */
var _alloc = null, _allocFor = null;
function steeringAlloc() {
  var all = sessions();
  if (_alloc && _allocFor === all) return _alloc;
  var out = {};
  function give(id, c, load) { var o = out[id] || (out[id] = { cost: 0, sessions: 0, loads: 0 }); o.cost += c; if (load) o.loads++; else o.sessions++; }
  function split(list, c) { var t = Ledger.sum(list); list.forEach(function (x) { give(x.id, t ? c * x.tok / t : 0); }); }
  all.forEach(function (s) {
    var by = s.cost.by, carried = (s.steer || Ledger.steeringFor(s.repo, LEDGER_F)).map(function (x) { return { id: x.id, tok: x.tok }; });
    Object.keys(by).forEach(function (k) {
      if (!/^skill:/.test(k)) return;
      var id = k.slice(6), sk = skillById(id);
      give(id, by[k], true);
      if (sk) Ledger.skillRecords(LEDGER_F, sk.lineage, s.repo).forEach(function (r) { carried.push({ id: r.id, tok: r.tok }); });
    });
    if (by.steering) split(carried, by.steering);
    if (by.memory) split(Ledger.recall(LEDGER_F, s.recall), by.memory);
  });
  _alloc = out; _allocFor = all;
  return out;
}
function steeringStats(item) { return steeringAlloc()[item.id] || { cost: 0, sessions: 0, loads: 0 }; }
/* The steering block a session in a code repository starts with next: the steering repo's records,
   plus any a steering PR merged here. */
function steeringNext(repo) { return Ledger.steeringFor(repo, LEDGER_F, steeringItems()); }
function suggestionFixup(sug) {
  // What the lint fix-up cost in the session that prompted the suggestion: the requests it names.
  var T = F.TRANSCRIPTS[sug.from.session], led = transcriptLedger(T);
  return led.reqs.filter(function (q) { return (sug.from.fixup || []).indexOf(q.n) >= 0; }).reduce(function (t, q) { return t + q.cost.total; }, 0);
}

/* ---- Work ---- */
function workItems() {
  if (S.empty) return [];
  return F.WORK.map(function (w) {
    var c = {}; for (var k in w) c[k] = w[k];
    if (S.sent[w.key]) { c.state = "running"; c.agent = S.sent[w.key].agent; c.session = S.sent[w.key].session.id; }
    if (w.session && S.answered[w.session]) { c.state = "review"; if (S.answered[w.session].verdict === "approve") c.release = "v4.11.0"; else c.held = "v4.11.0"; }
    return c;
  });
}
/* Done work: the work items of this month's finished sessions that are no longer open. */
function doneWork() {
  var open = {}, map = {}, out = [];
  F.WORK.forEach(function (w) { open[w.key] = 1; });
  sessions().forEach(function (s) {
    if (!s.wi || open[s.wi.key] || s.status !== "done" || /^Review: /.test(s.wi.title)) return;
    if (!map[s.wi.key]) { map[s.wi.key] = { key: s.wi.key, src: s.wi.src, title: s.wi.title, sessions: [], cost: 0, agent: s.agent, last: s.started }; out.push(map[s.wi.key]); }
    map[s.wi.key].sessions.push(s); map[s.wi.key].cost += s.cost.total;
  });
  return out.sort(function (a, b) { return a.last < b.last ? 1 : -1; });
}
function workCost(key) { return sessions().filter(function (s) { return s.wi && s.wi.key === key; }).reduce(function (t, s) { return t + s.cost.total; }, 0); }

/* What a person needs to act on: a session waiting on a question. */
function needsYou() { return sessions().filter(function (s) { return s.status === "needs-you"; }); }

/* ============================== the steering repo and MCP Studio ==============================
   steering-repo-spec.html and mcp-studio-spec.html. The steering repo decides which records steer,
   which servers exist, which of their tools are imported, and how each tool is classified. A change
   reaches it only through a steering PR. The off switch is the one change that skips review. */
var REPO = STEERING.repo, POLICY = REPO.policy;

/* A server large enough for search mode carries a recipe instead of 612 rows: every root field of
   its schema is an entity and an operation. The recipe is fixed, so the list is the same each load. */
function seeded(str) { var x = 2166136261; for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; }
SERVERS.forEach(function (sv) {
  if (!sv.generate) return;
  var G = sv.generate, out = [];
  G.entities.forEach(function (e) {
    G.ops.forEach(function (op) {
      var n = op + "_" + e + (op === "list" || op === "search" || op === "count" || op === "export" ? "s" : "");
      var read = ["list", "get", "search", "count", "history", "export"].indexOf(op) >= 0;
      var del = op === "delete";
      var imported = G.imported.indexOf(op) >= 0 || (G.importedWrite.indexOf(e) >= 0 && G.importedWriteOps.indexOf(op) >= 0);
      var t = { n: n, d: (read ? "Query." : "Mutation.") + n.replace(/_([a-z])/g, function (m, b) { return b.toUpperCase(); }), state: imported ? "imported" : "available",
        tok: 180 + Math.round(seeded(n) * 140), risk: del ? "high" : read ? "low" : "medium", side_effect: del ? "irreversible" : read ? "read" : "write", egress: "org_tenant", confirmed: imported };
      if (del) t.impacts = ["destroys_data"];
      if (imported) t.version = 1;
      out.push(t);
    });
  });
  sv.tools = out;
});

/* ---- servers and tools ---- */
var SOURCE_LABEL = { remote: "Connected by URL", registry: "From the registry", local: "Local command", openapi: "OpenAPI definition", graphql: "GraphQL schema", grpc: "gRPC protos", builtin: "Built in" };
function sourceLabel(sv) { return SOURCE_LABEL[sv.source.type] || sv.source.type; }
function folderOf(sv) { return sv.source.type === "builtin" ? null : "tools/servers/" + sv.id + "/"; }
function toolName(sid, n) { return sid + "__" + n; }
function toolBy(sid, n) { var sv = serverBy(sid); if (!sv) return null; for (var i = 0; i < sv.tools.length; i++) if (sv.tools[i].n === n) return sv.tools[i]; return null; }
function isSearch(sv) { return !!(sv.exposure && sv.exposure.mode === "search"); }
var SEARCH_TOK = Ledger.SEARCH_TOK;
/* The off switch: a record of who turned it off and when, or null. A change made on this page wins
   over the fixture. */
function serverOffBy(sv) { return S.srvOff[sv.id] !== undefined ? S.srvOff[sv.id] : sv.off || null; }
function toolOffBy(sid, t) { var k = sid + "." + t.n; return S.toolOff[k] !== undefined ? S.toolOff[k] : t.off || null; }
/* A tool a sync PR marks breaking is withheld: the gateway refuses it until the PR merges. */
function withheld(t) { return !!(t.sync && t.sync.breaking); }

/* Staged changes: what Review turns into one steering PR on tools/servers/<name>/. A server can arrive
   with changes already staged (fixtures pending). */
function staged(sid) {
  if (!S.staged[sid]) {
    var sv = serverBy(sid);
    S.staged[sid] = ((sv && sv.pending) || []).map(function (o) { var c = {}; for (var k in o) c[k] = o[k]; return c; });
    // A staged classify carries what the person confirmed.
    S.staged[sid].forEach(function (o) { if (o.op === "classify" && !S.cls[sid + "." + o.tool]) S.cls[sid + "." + o.tool] = { confirmed: !!o.confirmed }; });
  }
  return S.staged[sid];
}
function stagedOp(sid, op, n) { var l = staged(sid); for (var i = 0; i < l.length; i++) if (l[i].op === op && l[i].tool === n) return l[i]; return null; }
function stage(sid, o) {
  var l = staged(sid);
  for (var i = l.length - 1; i >= 0; i--) if (l[i].tool === o.tool && l[i].op === o.op) l.splice(i, 1);
  l.push(o);
}
function unstage(sid, op, n) { S.staged[sid] = staged(sid).filter(function (o) { return !(o.op === op && o.tool === n); }); }
/* A tool counts as imported with the staged changes applied. */
function importedNow(sid, t) {
  if (stagedOp(sid, "remove", t.n)) return false;
  return t.state !== "available" || !!stagedOp(sid, "import", t.n);
}
/* The classification a person sees: the fixture's, then any change made here. confirmed is false
   while every value is still Studio's suggestion. */
function classOf(sid, t) {
  var c = { risk: t.risk, side_effect: t.side_effect, egress: t.egress, impacts: (t.impacts || []).slice(), confirmed: !!t.confirmed }, o = S.cls[sid + "." + t.n];
  if (o) for (var k in o) c[k] = o[k];
  return c;
}
function descOf(sid, t) { var d = stagedOp(sid, "describe", t.n); return d ? d.text : t.desc || t.d; }

/* Where an approval comes from: policy reading the classification, never a setting on the tool.
   Each rule in policy/*.cedar names the impact it reads. A rule with a condition asks only when the
   call meets it. */
function approvalFor(sid, t) {
  var c = classOf(sid, t);
  return POLICY.filter(function (p) { return c.impacts.indexOf(p.impact) >= 0; });
}
function approvalLabel(rules) {
  if (!rules.length) return "None";
  var always = rules.filter(function (r) { return !r.cond; });
  return always.length ? "Asks a person" : "Asks a person " + rules[0].cond;
}

/* Definition tokens per request: the imported tools that are on, or the three search tools. */
function defsOf(sv, withStaged) {
  if (isSearch(sv)) return SEARCH_TOK;
  return sv.tools.reduce(function (a, t) {
    var on = withStaged ? importedNow(sv.id, t) : t.state !== "available";
    return a + (on && !toolOffBy(sv.id, t) && !withheld(t) ? t.tok : 0);
  }, 0);
}
function importedDefs(sv) { return sv.tools.reduce(function (a, t) { return a + (importedNow(sv.id, t) ? t.tok : 0); }, 0); }
function relayOf(name) { return name && /^relay:/.test(name) ? { name: name.slice(6), r: F.SERVERS.relays[name.slice(6)] } : null; }
function relaysOf(sv) {
  var out = [], seen = {};
  (sv.environments || []).concat([{ network: sv.source.network }]).forEach(function (e) {
    var r = relayOf(e.network);
    if (r && !seen[r.name]) { seen[r.name] = 1; out.push(r); }
  });
  return out;
}
function viewer() { return S.viewer || ME; }
function operatorLinked(sv, who) { return !sv.operators || sv.operators[who] !== null; }

/* ---- steering PRs ---- */
function allPrs() {
  var out = STEERING.prs.concat(S.newPrs);
  if (S.health === "diverged" && !out.some(function (p) { return p.n === REPO.health.diverged.revertPr; })) {
    out = out.concat([{ n: REPO.health.diverged.revertPr, kind: "revert", state: "open", title: "Revert main to published version " + REPO.version, branch: "steering/revert-" + REPO.health.diverged.commit,
      by: "oxagen", via: "drift", opened: REPO.health.diverged.since, approvals: [],
      summary: "`main` holds commit `" + REPO.health.diverged.commit + "`, which oxagen did not merge. This PR puts `main` back at the last published commit.",
      files: [{ path: "steering/billing/a-intel.billing.refunds-over-100.md", diff: "-Refunds over $250 need a person's approval before you call\n+Refunds over $100 need a person's approval before you call\n `billing__create_refund`. Ask in the run and wait." }],
      checks: [{ id: "schema", r: "pass" }, { id: "hash", r: "pass" }, { id: "settings", r: "pass" }] }]);
  }
  return out.sort(function (a, b) { return b.n - a.n; });
}
function prBy(n) { var l = allPrs(); for (var i = 0; i < l.length; i++) if (l[i].n === n) return l[i]; return null; }
function nextPrNumber() { return allPrs().reduce(function (m, p) { return Math.max(m, p.n); }, 60) + 1; }
function prState(pr) {
  if (pr.state === "merged") return "merged";
  if (S.queue.indexOf(pr.n) >= 0) return "queued";
  return "open";
}
function prApprovals(pr) { return (pr.approvals || []).concat(S.approved[pr.n] ? [S.approved[pr.n]] : []); }
/* Review by governance mode: team mode needs one approval from a member other than the author. A
   reviewer group named for a path in governance.toml reviews what touches it. */
function prReviewers(pr) {
  var paths = pr.kind === "server" ? ["tools/servers/" + pr.server + "/"] : pr.record ? [pr.record.path] : (pr.files || []).map(function (f) { return f.path || f; });
  var groups = REPO.governance.reviewers.filter(function (g) {
    return g.paths.some(function (glob) { var pre = glob.replace(/\*\*$/, ""); return paths.some(function (p) { return p.indexOf(pre) === 0; }); });
  });
  return groups;
}
function canApprove(pr) {
  var me = viewer(), groups = prReviewers(pr);
  if (pr.by === me) return false;
  if (groups.length) return groups.some(function (g) { return g.members.indexOf(me) >= 0; });
  return true;
}
function authorLabel(pr) {
  if (pr.by === "oxagen") return pr.via === "sync" ? "oxagen sync" : "oxagen";
  if (pr.by === "curator") return "The curator";
  var a = agentBy(pr.by);
  if (a) return a.name + " with steering_propose";
  return personName(pr.by);
}
var PR_KIND = { record: "Record", memory: "Memory", server: "Server", workspace: "Workspace", agent: "Agent", revert: "Revert", import: "Import" };
/* The first run is a new workspace. Its steering repo starts in solo mode (steering-repo-spec.html,
   Write the first commit), so a steering PR needs no approval and merges when Merge is pressed.
   The demo workspace's own PRs stay out of it until the steering import merges. */
function firstRun() { return S.empty && !S.imported.steering; }
function govMode() { return firstRun() ? "solo" : REPO.governance.mode; }
function prVisible(n) { return !firstRun() || S.newPrs.some(function (p) { return p.n === n; }); }

/* The budget check (steering-repo-spec.html, Tokens): per code repository, the always-on steering
   before and after the change, against the workspace's budget or oxagen's default. The ledger's rule
   decides what is always on: must or should with load: always, and no applies_to or skills target.
   A tools target counts only when the workspace imports a matching tool. The check warns and never
   blocks, because a steering PR is how a budget changes. */
function isAlwaysOn(i) { return Ledger.isAlwaysOn(i, LEDGER_F); }
function alwaysOnIn(repo) { return steeringNext(repo).filter(function (x) { return x.full; }).map(function (x) { return x.item; }); }
function budgetRows(rec) {
  var set = REPO.governance.always_on_tokens, budget = set || REPO.governance.defaultBudget, adds = isAlwaysOn(rec);
  var repos = rec.repos && rec.repos.length ? rec.repos : REPO.linked.map(function (r) { return r.url; });
  return repos.map(function (repo) {
    var list = alwaysOnIn(repo), before = list.reduce(function (t, i) { return t + i.tok; }, 0);
    var old = list.filter(function (i) { return i.lineage === rec.lineage; })[0], after = before - (old ? old.tok : 0) + (adds ? rec.tok : 0);
    return { repo: repo, before: before, after: after, budget: budget, set: !!set, over: after > budget, adds: adds,
      largest: list.filter(function (i) { return i.lineage !== rec.lineage; }).map(function (i) { return { lineage: i.lineage, label: i.label || i.title, kind: i.kind, force: i.force, tok: i.tok }; })
        .concat(adds ? [{ lineage: rec.lineage, label: rec.label, kind: rec.kind, force: rec.force, tok: rec.tok, fresh: true }] : [])
        .sort(function (x, y) { return y.tok - x.tok; }).slice(0, 4) };
  });
}

/* ---- the steering repo ---- */
function isWsAdmin(who) { var r = (PEOPLE[who] || {}).role; return r === "Workspace owner" || r === "Organization owner"; }
function isOrgAdmin(who) { return (PEOPLE[who] || {}).role === "Organization owner"; }
/* The workspace owner may merge a steering PR without an approval in any mode (steering-repo-spec.html,
   Review). A custom role can grant the same merge_without_review permission. The demo has none. */
function canMergeWithoutReview(who) { return (PEOPLE[who] || {}).role === "Workspace owner"; }
function orgAdmin() { for (var k in PEOPLE) if (isOrgAdmin(k)) return k; return null; }
function slugify(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace"; }
/* A new workspace's steering repo: oxagen-<slug>, then -2, -3 on a clash. */
function steeringRepoFor(name) {
  var slug = slugify(name), taken = STEERING.provision.workspaces.map(function (w) { return w.slug; }), n = 1, s = slug;
  while (taken.indexOf(s) >= 0) { n++; s = slug + "-" + n; }
  return ORG.slug + "/oxagen-" + s;
}
