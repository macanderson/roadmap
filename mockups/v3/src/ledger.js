/* ============================== ledger.js ==============================
   The one accounting rule for every session in v3, shared by the page and by gen-sessions.mjs.

   A session is a list of steps. Each step adds tokens to the context from one source, or makes a
   model request. A request re-reads everything already in the context (billed at the cache-read
   price), writes everything added since the last request (billed at the cache-write price, or the
   input price for a model with no write surcharge), and generates its output. What the model wrote
   joins the context as "conv" for the next request. A compaction keeps the fixed prefix, drops
   the conversation and the tool results, and adds a summary.

   Sources: system and tools (the harness's own prompt and tool list), steering (the always-on
   block and the index lines), memory (the memories recalled for the session), skill:<id>,
   mcp:<server> (a server's tool definitions and its results), local (file reads, edits and
   commands), prompt (the person's messages), and conv (the model's earlier output). Inside the
   ledger a key with a # suffix is something loaded or returned partway through: mcp:<server>#res
   is a server's results, and steering#skill is the records that target a skill the session
   loaded. A compaction drops those and keeps the definitions. Every figure it returns folds the
   suffix back into the key before the #. */
var Ledger = (function () {
  var FIXED = { system: 1, tools: 1, steering: 1, memory: 1 };
  function keep(key) { return !/#/.test(key) && (FIXED[key] === 1 || /^mcp:/.test(key)); }
  function base(key) { return key.replace(/#.*$/, ""); }
  function add(map, key, tok) { map[key] = (map[key] || 0) + tok; }
  function sum(list) { return list.reduce(function (a, i) { return a + i.tok; }, 0); }

  /* The steering repo spec's numbers. A server in search mode sends three tools (search, describe,
     and call) in place of its definitions. An index line is about 25 tokens. Recall adds up to five
     memories, 800 tokens at most. */
  var SEARCH_TOK = 900, INDEX_TOK = 25, RECALL_MAX = 5, RECALL_TOK = 800;

  /* steps: [{add:[key, tok]}, {req:outTok, t, n}, {compact:summaryTok}]. Returns every request's
     reads and writes by source, the session's flows ({src:[written, read]}), and its output. */
  function run(steps) {
    var prefix = {}, pending = {}, reqs = [], flows = {}, out = 0;
    steps.forEach(function (s) {
      var k;
      if (s.add) { add(pending, s.add[0], s.add[1]); return; }
      if (s.compact != null) {
        var kept = {};
        for (k in prefix) if (keep(k)) kept[k] = prefix[k];
        prefix = kept; pending = {}; add(pending, "conv", s.compact);
        return;
      }
      if (s.req == null) return;
      var read = {}, write = {};
      for (k in prefix) { add(read, base(k), prefix[k]); }
      for (k in pending) { add(write, base(k), pending[k]); add(prefix, k, pending[k]); }
      for (k in read) { flows[k] = flows[k] || [0, 0]; flows[k][1] += read[k]; }
      for (k in write) { flows[k] = flows[k] || [0, 0]; flows[k][0] += write[k]; }
      pending = {}; add(pending, "conv", s.req); out += s.req;
      reqs.push({ n: s.n || reqs.length + 1, t: s.t, read: read, write: write, out: s.req });
    });
    return { reqs: reqs, flows: flows, out: out };
  }

  /* Price a session's flows at a model's list price, in USD per million tokens: {out, cw, cr}. */
  function cost(flows, out, p) {
    var by = { output: out * p.out / 1e6 }, total = by.output;
    for (var src in flows) {
      var c = (flows[src][0] * p.cw + flows[src][1] * p.cr) / 1e6;
      by[src] = (by[src] || 0) + c; total += c;
    }
    return { total: total, by: by };
  }

  /* One request's cost, split the same way. */
  function reqCost(q, p) {
    var by = { output: q.out * p.out / 1e6 }, total = by.output, k, c;
    for (k in q.read) { c = q.read[k] * p.cr / 1e6; by[k] = (by[k] || 0) + c; total += c; }
    for (k in q.write) { c = q.write[k] * p.cw / 1e6; by[k] = (by[k] || 0) + c; total += c; }
    return { total: total, by: by };
  }

  /* The tool definitions every run gets at a moment (MCP Studio: day one, every agent gets the
     workspace's imported tools). A server counts from the day it was added. A server whose off
     switch was on by then sends nothing, and a tool switched off by then is left out. A server in
     search mode sends its three search tools. */
  function toolServers(F, at) {
    var day = at.slice(0, 10);
    return F.SERVERS.servers.filter(function (s) {
      return s.added <= day && !(s.off && s.off.at <= at);
    }).map(function (s) {
      var mode = (s.exposure && s.exposure.mode) || "direct";
      var tok = mode === "search" ? SEARCH_TOK : (s.tools || []).reduce(function (a, t) {
        return a + (t.state === "imported" && !(t.off && t.off.at <= at) ? t.tok : 0);
      }, 0);
      return { id: s.id, tok: tok, mode: mode };
    });
  }
  /* A tools target such as github__merge_pull_request or billing__*. Day one, it matches whenever
     the workspace imports the tool. */
  function toolImported(name, F) {
    var cut = name.indexOf("__"), sid = name.slice(0, cut), tn = name.slice(cut + 2);
    var s = F.SERVERS.servers.filter(function (x) { return x.id === sid; })[0];
    return !!s && (s.tools || []).some(function (t) { return t.state === "imported" && (tn === "*" || t.n === tn); });
  }
  function toolsMatch(i, F) { return !(i.tools && i.tools.length) || i.tools.some(function (n) { return toolImported(n, F); }); }
  /* A record reaches a run only when its working repository is on the record's repos list. */
  function reachesRepo(i, repo) { return !(i.repos && i.repos.length) || i.repos.indexOf(repo) >= 0; }

  /* Always on: must and should with load: always, sent in full on every request. A record with
     applies_to loads when the run touches a matching file, and one that targets a skill loads with
     the skill, so neither is always on. */
  function isAlwaysOn(i, F) {
    return i.kind !== "skill" && i.kind !== "memory" && (i.force === "must" || i.force === "should")
      && (!i.load || i.load === "always") && !(i.applies_to && i.applies_to.length)
      && !(i.skills && i.skills.length) && toolsMatch(i, F);
  }
  /* Index lines: may and info records, records with load: relevant, and skills, one line each.
     Memories are recalled instead. */
  function isIndexed(i, F) {
    if (i.kind === "memory" || (i.skills && i.skills.length) || !toolsMatch(i, F)) return false;
    if (i.kind === "skill") return true;
    if (i.load === "match" || (i.applies_to && i.applies_to.length)) return false;
    return i.force === "may" || i.force === "info" || i.load === "relevant";
  }
  /* The steering block on every request of a run in one code repository, sorted by lineage: the
     always-on records in full, then an index line for each record that loads when it fits. */
  function steeringFor(repo, F, items) {
    var full = [], index = [];
    (items || F.STEERING.items).forEach(function (i) {
      if (!reachesRepo(i, repo)) return;
      if (isAlwaysOn(i, F)) full.push({ id: i.id, lineage: i.lineage, tok: i.tok, full: true, item: i });
      else if (isIndexed(i, F)) index.push({ id: i.id, lineage: i.lineage, tok: INDEX_TOK, full: false, item: i });
    });
    var by = function (a, b) { return a.lineage < b.lineage ? -1 : a.lineage > b.lineage ? 1 : 0; };
    return full.sort(by).concat(index.sort(by));
  }
  /* The records that reach a request once the session loads a skill: the ones whose skills list
     holds its lineage. */
  function skillRecords(F, lineage, repo, items) {
    return (items || F.STEERING.items).filter(function (i) {
      return i.kind !== "skill" && i.kind !== "memory" && i.skills && i.skills.indexOf(lineage) >= 0 && reachesRepo(i, repo) && toolsMatch(i, F);
    });
  }
  /* The memories recalled for a session, in the order given, capped at five and 800 tokens. */
  function recall(F, ids) {
    var out = [], tok = 0;
    (ids || []).forEach(function (id) {
      var m = F.STEERING.items.filter(function (i) { return i.id === id && i.kind === "memory"; })[0];
      if (!m || out.length >= RECALL_MAX || tok + m.tok > RECALL_TOK) return;
      out.push(m); tok += m.tok;
    });
    return out;
  }

  /* What a run's context holds before its first prompt: the harness's prompt and tools, the
     workspace's imported tool definitions at that moment, the steering block for the run's code
     repository, and the memories recalled for it. ctx: {at, repo, recall}. A skill loads only when
     the session uses it. */
  function context0(agent, F, ctx) {
    var h = F.HARNESSES[agent.harness], out = [["system", h.system], ["tools", h.tools]];
    toolServers(F, ctx.at).forEach(function (s) { out.push(["mcp:" + s.id, s.tok]); });
    out.push(["steering", sum(steeringFor(ctx.repo, F))]);
    var mem = sum(recall(F, ctx.recall));
    if (mem) out.push(["memory", mem]);
    return out;
  }

  return {
    run: run, cost: cost, reqCost: reqCost, context0: context0, steeringFor: steeringFor, skillRecords: skillRecords,
    recall: recall, toolServers: toolServers, toolImported: toolImported, toolsMatch: toolsMatch, reachesRepo: reachesRepo,
    isAlwaysOn: isAlwaysOn, isIndexed: isIndexed, sum: sum,
    SEARCH_TOK: SEARCH_TOK, INDEX_TOK: INDEX_TOK, RECALL_MAX: RECALL_MAX, RECALL_TOK: RECALL_TOK,
  };
})();
