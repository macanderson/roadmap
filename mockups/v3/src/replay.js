/* ============================== replay.js ==============================
   The session transcript, replayed the way the harness showed it. One event model (prompt, steer,
   req, think, say, call, res, ask, answer, end) feeds four skins: Claude Code, Codex CLI, Cursor
   and stella. A skin draws only what its harness drew. What oxagen adds (the cost of each model
   request, who sent a message, what policy decided) sits in the margin beside the terminal and
   never inside it.

   The replay clock runs on recorded time with long idle gaps folded: a gap over 12 seconds plays
   as 3, and a gap over a minute is marked in the margin with how long the session waited. */
var RP = { sid: null, T: null, ev: [], vts: [], gaps: {}, total: 0, vt: 0, playing: false, speed: 4, thinking: false,
  open: {}, follow: true, raf: 0, last: 0, drawn: "", led: null, reqVt: {} };

function rpLoad(T) {
  RP.T = T; RP.sid = T.id;
  RP.ev = transcriptEvents(T);
  RP.vts = []; RP.gaps = {};
  var vt = 0, prev = 0;
  RP.ev.forEach(function (e, i) {
    var gap = e.t - prev;
    if (gap > 12) { vt += 3; if (gap > 60) RP.gaps[i] = gap; } else vt += Math.max(0, gap);
    prev = e.t; RP.vts.push(vt);
  });
  // The clock runs until the last reply has finished typing.
  RP.total = 0;
  RP.ev.forEach(function (e, i) { RP.total = Math.max(RP.total, RP.vts[i] + 0.6, e.k === "say" ? RP.vts[i] + e.text.length / 160 + 0.4 : 0); });
  RP.led = transcriptLedger(T);
  RP.reqVt = {};
  RP.ev.forEach(function (e, i) { if (e.k === "req") RP.reqVt[e.n] = RP.vts[i]; });
}
function rpOpen(T) { if (RP.sid !== T.id) { rpStop(); rpLoad(T); RP.vt = RP.total; RP.open = {}; RP.follow = true; } }

/* ---- blocks: what is on screen at replay time vt ---- */
function rpBlocks(vt) {
  var out = [], calls = {}, req = null, ev = RP.ev, i;
  for (i = 0; i < ev.length; i++) {
    if (RP.vts[i] > vt + 1e-6) break;
    var e = ev[i], b = null;
    if (e.k === "req") { req = e; continue; }
    if (e.k === "prompt" || e.k === "steer") b = { type: "user", e: e };
    else if (e.k === "think") b = { type: "think", e: e };
    else if (e.k === "say") b = { type: "say", e: e };
    else if (e.k === "call") { b = { type: "call", e: e, res: null }; calls[e.id] = b; }
    else if (e.k === "res") { if (calls[e.id]) { calls[e.id].res = e; calls[e.id].resI = i; if (RP.gaps[i]) calls[e.id].took = RP.gaps[i]; } continue; }
    else if (e.k === "ask") { if (calls[e.id]) calls[e.id].asking = e; b = { type: "ask", e: e, call: calls[e.id] }; }
    else if (e.k === "answer") { if (calls[e.id]) { calls[e.id].asking = null; calls[e.id].answer = e; } out = out.filter(function (x) { return !(x.type === "ask" && x.e.id === e.id); }); b = { type: "answered", e: e, call: calls[e.id] }; }
    else if (e.k === "end") b = { type: "end", e: e };
    if (!b) continue;
    b.i = i; b.vt = RP.vts[i];
    if (req && b.type !== "user") { b.req = req; req = null; }
    if (RP.gaps[i]) b.gap = RP.gaps[i];
    out.push(b);
  }
  // A reply types out while the replay plays. Stopped, or at the end, it shows in full, so a step
  // or a seek never lands on a blank reply.
  out.forEach(function (b) { if (b.type === "say") b.shown = !RP.playing || vt >= RP.total - 1e-6 ? b.e.text.length : Math.min(b.e.text.length, Math.floor((vt - b.vt) * 160)); });
  // The final answer of a finished session: Codex prints its "Worked for" rule above it.
  for (i = out.length - 1; i >= 0; i--) { if (out[i].type === "end") { for (var j = i - 1; j >= 0; j--) if (out[j].type === "say") { out[j].final = true; out[j].worked = out[i].e.worked; break; } break; } }
  return out;
}
/* Where the session stands at vt: working, waiting on a question, or finished. */
function rpState(vt, blocks) {
  var last = blocks[blocks.length - 1];
  if (!last) return "working";
  if (last.type === "end") return "done";
  if (blocks.some(function (b) { return b.type === "ask"; })) return "asking";
  return "working";
}
function rpCostAt(vt) {
  var total = 0, by = {}, n = 0, tk = 0;
  RP.led.reqs.forEach(function (q) {
    if (RP.reqVt[q.n] == null || RP.reqVt[q.n] > vt + 1e-6) return;
    n++; total += q.cost.total; tk += q.out;
    for (var r in q.read) tk += q.read[r];
    for (var w in q.write) tk += q.write[w];
    for (var k in q.cost.by) by[k] = (by[k] || 0) + q.cost.by[k];
  });
  return { total: total, by: by, n: n, tokens: tk };
}
/* Recorded seconds since the session started, at replay time vt. */
function rpRecorded(vt) {
  var i = 0;
  while (i < RP.vts.length && RP.vts[i] <= vt) i++;
  if (i === 0) return 0;
  var e = RP.ev[i - 1];
  return e.t + Math.min(vt - RP.vts[i - 1], 12);
}

/* ---- helpers the skins share ---- */
function argText(v) {
  if (typeof v === "string") return '"' + (v.length > 72 ? v.slice(0, 70) + "…" : v) + '"';
  if (Array.isArray(v)) return "[" + v.map(argText).join(", ") + "]";
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function argsLine(args) { return Object.keys(args).map(function (k) { return k + ": " + argText(args[k]); }).join(", "); }
function jsonLines(v) { return JSON.stringify(v, null, 2).split("\n"); }
function resLines(b) {
  var r = b.res;
  if (!r) return [];
  if (r.lines) return r.lines;
  if (r.json !== undefined) return jsonLines(r.json);
  return [];
}
/* Inline markdown the harness renders: `code`, **bold**, and "- " bullets. */
function md(text) {
  return text.split("\n").map(function (line) {
    var s = h(line).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    if (/^- /.test(line)) return '<div class="md-li"><span class="md-b">-</span><span>' + s.slice(2) + "</span></div>";
    return line === "" ? '<div class="md-gap"></div>' : "<div>" + s + "</div>";
  }).join("");
}
function typed(b) { return b.shown != null && b.shown < b.e.text.length ? b.e.text.slice(0, b.shown) : b.e.text; }
function isOpen(b) { return !!RP.open[b.i]; }
function fileName(p) { return p.split("/").pop(); }
var VERBS = ["Brewing", "Pondering", "Noodling", "Percolating", "Mulling", "Cogitating", "Crafting", "Tinkering", "Simmering", "Musing"];

/* ============ Claude Code ============ */
var CC = {
  cls: "cc",
  title: function (T) { return "✳ " + T.title; },
  banner: function (T) {
    return '<div class="cc-banner"><pre class="cc-clawd" aria-hidden="true"> ▐▛███▜▌\n▝▜█████▛▘\n  ▘▘ ▝▝</pre>' +
      '<div class="cc-bn"><div><b>Claude Code</b> <span class="cc-dim">v' + h(T.harnessV) + "</span></div>" +
      '<div class="cc-dim">' + h(T.modelLabel) + " · API Usage Billing</div>" +
      '<div class="cc-dim">' + h(T.cwd) + "</div></div></div>";
  },
  user: function (b) { return '<div class="cc-user"><span class="cc-pr">&gt;</span><div class="cc-ut">' + h(b.e.text) + "</div></div>"; },
  think: function (b) {
    if (!RP.thinking) return '<div class="cc-think" data-act="rp-think">∴ Thought for ' + b.e.sec + 's <span class="cc-dim">(ctrl+o to show thinking)</span></div>';
    return '<div class="cc-think open" data-act="rp-think">∴ Thinking…</div><div class="cc-thought">' + h(b.e.text) + "</div>";
  },
  say: function (b) { return '<div class="cc-line"><span class="cc-dot">⏺</span><div class="cc-md">' + md(typed(b)) + (b.shown < b.e.text.length ? '<span class="cc-caret"></span>' : "") + "</div></div>"; },
  head: function (t) {
    if (t.kind === "todo") return "<b>Update Todos</b>";
    if (t.kind === "read") return "<b>Read</b>(" + h(t.path) + ")";
    if (t.kind === "search") return "<b>Search</b>(pattern: \"" + h(t.pattern) + "\", path: \"" + h(t.path) + "\")";
    if (t.kind === "bash") return "<b>Bash</b>(" + h(t.cmd) + ")";
    if (t.kind === "write") return "<b>Write</b>(" + h(t.path) + ")";
    if (t.kind === "edit") return "<b>Update</b>(" + h(t.path) + ")";
    if (t.kind === "skill") return "<b>Skill</b>(" + h(t.name) + ")";
    if (t.kind === "mcp") return "<b>" + h(t.server) + " - " + h(t.name) + " (MCP)</b>(" + h(argsLine(t.args)) + ")";
    return h(t.kind);
  },
  body: function (b) {
    var t = b.e.tool, r = b.res, lines, rows = [], more = 0, open = isOpen(b);
    if (!r) return "";
    if (r.denied) return '<div class="cc-res"><span class="cc-el">⎿</span><div class="cc-dim">' + h(r.lines[0]) + "</div></div>";
    if (t.kind === "todo") {
      rows = t.todos.map(function (td) {
        var done = td[1] === "completed", now = td[1] === "in_progress";
        return '<div class="cc-todo ' + (done ? "done" : now ? "now" : "") + '"><span>' + (done ? "☒" : "☐") + "</span> " + h(td[0]) + "</div>";
      });
      return '<div class="cc-res"><span class="cc-el">⎿</span><div>' + rows.join("") + "</div></div>";
    }
    if (t.kind === "read") {
      var rb = '<div>Read <b>' + num(t.lines) + "</b> lines" + (t.head && !open ? ' <span class="cc-dim">(ctrl+o to expand)</span>' : "") + "</div>";
      if (open && t.head) rb += t.head.map(function (l, i) { return '<div class="cc-num"><span class="ln">' + (i + 1) + "</span>" + h(l) + "</div>"; }).join("");
      return '<div class="cc-res"><span class="cc-el">⎿</span><div>' + rb + "</div></div>";
    }
    if (t.kind === "search") return '<div class="cc-res"><span class="cc-el">⎿</span><div>Found <b>' + t.hits + "</b> files</div></div>";
    if (t.kind === "skill") return '<div class="cc-res"><span class="cc-el">⎿</span><div>Successfully loaded skill</div></div>';
    if (t.kind === "write") {
      var wl = t.content, show = open ? wl.length : Math.min(10, wl.length);
      rows.push("<div>Wrote <b>" + wl.length + "</b> lines to <b>" + h(t.path) + "</b></div>");
      for (var i = 0; i < show; i++) rows.push('<div class="cc-num"><span class="ln">' + (i + 1) + "</span>" + h(wl[i]) + "</div>");
      if (show < wl.length) rows.push('<div class="cc-dim">… +' + (wl.length - show) + " lines (ctrl+o to expand)</div>");
      return '<div class="cc-res"><span class="cc-el">⎿</span><div>' + rows.join("") + "</div></div>";
    }
    if (t.kind === "edit") {
      rows.push("<div>Updated <b>" + h(t.path) + "</b> with <b>" + t.add + "</b> " + (t.add === 1 ? "addition" : "additions") + " and <b>" + t.del + "</b> " + (t.del === 1 ? "removal" : "removals") + "</div>");
      t.hunks.forEach(function (d) {
        if (d[0] === "…") { rows.push('<div class="cc-diff gap">…</div>'); return; }
        rows.push('<div class="cc-diff ' + (d[1] === "+" ? "add" : d[1] === "-" ? "del" : "") + '"><span class="ln">' + d[0] + '</span><span class="sg">' + (d[1] === " " ? "" : d[1]) + "</span><span>" + (h(d[2]) || " ") + "</span></div>");
      });
      return '<div class="cc-res"><span class="cc-el">⎿</span><div class="cc-diffs">' + rows.join("") + "</div></div>";
    }
    lines = resLines(b);
    var limit = open ? lines.length : (t.kind === "bash" ? 6 : 4);
    if (lines.length > limit) { more = lines.length - limit; lines = lines.slice(0, limit); }
    rows = lines.map(function (l, i) { return "<div>" + (i === 0 && r.ok === false ? '<span class="cc-err">Error: </span>' : "") + (h(l) || " ") + "</div>"; });
    if (more) rows.push('<div class="cc-dim">… +' + more + " lines (ctrl+o to expand)</div>");
    return '<div class="cc-res ' + (r.ok === false ? "err" : "") + '"><span class="cc-el">⎿</span><div>' + rows.join("") + "</div></div>";
  },
  call: function (b, state) {
    var st = b.res ? (b.res.ok === false ? (b.res.denied ? "den" : "err") : "ok") : (b.asking ? "ask" : "run");
    var click = b.res && (b.e.tool.kind === "write" || b.e.tool.kind === "read" || resLines(b).length > 4) ? ' data-act="rp-open" data-i="' + b.i + '"' : "";
    return '<div class="cc-line cc-call ' + st + '"' + click + '><span class="cc-dot">⏺</span><div class="cc-cb"><div class="cc-head">' + CC.head(b.e.tool) + "</div>" + CC.body(b) + "</div></div>";
  },
  ask: function (b) {
    var t = b.call.e.tool;
    return '<div class="cc-perm"><div class="cc-perm-t">Tool use</div>' +
      '<div class="cc-perm-call">' + h(t.server) + " - " + h(t.name) + "(" + h(argsLine(t.args)) + ") (MCP)</div>" +
      '<div class="cc-perm-why">PreToolUse:mcp__' + h(t.server) + "__" + h(t.name) + " hook: oxagen policy asks a person before " + h(t.server) + " " + h(t.name) + "</div>" +
      '<div class="cc-perm-q">Do you want to proceed?</div>' +
      '<div class="cc-opt on">❯ 1. Yes</div>' +
      '<div class="cc-opt">  2. Yes, and don\'t ask again for ' + h(t.server) + " - " + h(t.name) + " commands in /Users/mbell/src/platform</div>" +
      '<div class="cc-opt">  3. No, and tell Claude what to do differently <span class="cc-dim">(esc)</span></div></div>';
  },
  answered: function () { return ""; },
  end: function () { return ""; },
  footer: function (st, info) {
    var spin = st === "working" ? '<div class="cc-spinner"><span class="cc-sg" aria-hidden="true"></span><span class="cc-verb">' + VERBS[info.req % VERBS.length] + '…</span> <span class="cc-dim">(' + dur(info.elapsed) + " · ↓ " + tok(info.out) + " tokens · esc to interrupt)</span></div>" : "";
    if (st === "asking") return "";
    return spin + '<div class="cc-input"><div class="cc-rule"></div><div class="cc-in"><span class="cc-pr">&gt;</span> <span class="cc-cursor"></span></div><div class="cc-rule"></div><div class="cc-dim cc-hint">  ? for shortcuts</div></div>';
  },
};

/* ============ Codex CLI ============ */
var CX = {
  cls: "cx",
  title: function (T) { return T.cwd; },
  banner: function (T) {
    return '<div class="cx-banner"><div><b>&gt;_ OpenAI Codex</b> <span class="cx-dim">(v' + h(T.harnessV) + ")</span></div><div class=\"cx-gap\"></div>" +
      '<div><span class="cx-dim">model:     </span>' + h(T.model) + ' high   <span class="cx-dim">/model to change</span></div>' +
      '<div><span class="cx-dim">directory: </span>' + h(T.cwd) + "</div></div>";
  },
  user: function (b) { return '<div class="cx-user"><span class="cx-pr">›</span><div>' + h(b.e.text) + "</div></div>"; },
  think: function (b) { return '<div class="cx-line cx-think"><span class="cx-b">•</span><i>' + h(b.e.text) + "</i></div>"; },
  say: function (b) {
    return (b.final ? '<div class="cx-worked">─ Worked for ' + h(b.worked || dur(b.e.t)) + " ─</div>" : "") +
      '<div class="cx-line"><span class="cx-b">•</span><div class="cx-md">' + md(typed(b)) + "</div></div>";
  },
  call: function (b) {
    var t = b.e.tool, r = b.res, st = r ? (r.ok === false ? "err" : "ok") : "run", head, rows = [], lines = [];
    if (t.kind === "read" || t.kind === "search") {
      // Codex folds a run of reads and searches into one Explored entry.
      var items = (b.explored || [b]).map(function (x) {
        var tt = x.e.tool;
        return tt.kind === "search" ? '<span class="cx-k">Search</span> ' + h(tt.pattern) + ' <span class="cx-dim">in</span> ' + h(tt.path) : '<span class="cx-k">Read</span> ' + h(fileName(tt.path));
      });
      return '<div class="cx-line ' + st + '"><span class="cx-b">•</span><div><b>' + (r ? "Explored" : "Exploring") + "</b>" + items.map(function (x, i) { return '<div class="cx-sub"><span class="cx-el">' + (i === 0 ? "└" : " ") + "</span>" + x + "</div>"; }).join("") + "</div></div>";
    }
    if (t.kind === "todo") head = "<b>Updated Plan</b>";
    else if (t.kind === "bash") head = "<b>" + (r ? "Ran" : "Running") + "</b> " + h(t.cmd);
    else if (t.kind === "edit" || t.kind === "write") head = "<b>Edited</b> " + h(t.path) + ' <span class="cx-dim">(</span><span class="cx-add">+' + (t.add != null ? t.add : t.content.length) + '</span> <span class="cx-del">-' + (t.del || 0) + '</span><span class="cx-dim">)</span>';
    else if (t.kind === "mcp") head = "<b>" + (r ? "Called" : "Calling") + "</b> " + h(t.server + "." + t.name) + '<span class="cx-dim">(' + h(JSON.stringify(t.args)) + ")</span>";
    else if (t.kind === "skill") head = "<b>Loaded skill</b> " + h(t.name);
    if (t.kind === "edit") {
      t.hunks.forEach(function (d) {
        if (d[0] === "…") { rows.push('<div class="cx-diff">    ⋮</div>'); return; }
        rows.push('<div class="cx-diff ' + (d[1] === "+" ? "add" : d[1] === "-" ? "del" : "") + '"><span class="ln">' + d[0] + "</span> " + (d[1] === " " ? " " : d[1]) + " " + (h(d[2]) || "") + "</div>");
      });
    } else if (r) {
      lines = resLines(b);
      var limit = isOpen(b) ? lines.length : 5, more = lines.length - limit;
      rows = lines.slice(0, limit).map(function (l, i) { return '<div class="cx-sub"><span class="cx-el">' + (i === 0 ? "└" : " ") + "</span>" + (h(l) || " ") + "</div>"; });
      if (more > 0) rows.push('<div class="cx-sub cx-dim"><span class="cx-el"> </span>… +' + more + " lines</div>");
    }
    return '<div class="cx-line ' + st + '"' + (lines.length > 5 ? ' data-act="rp-open" data-i="' + b.i + '"' : "") + '><span class="cx-b">•</span><div>' + head + rows.join("") + "</div></div>";
  },
  transform: function (blocks) {
    var out = [];
    blocks.forEach(function (b) {
      var prev = out[out.length - 1];
      var ex = b.type === "call" && (b.e.tool.kind === "read" || b.e.tool.kind === "search");
      if (ex && prev && prev.type === "call" && prev.explored && !b.req) { prev.explored.push(b); prev.res = b.res || prev.res; return; }
      if (ex) b.explored = [b];
      out.push(b);
    });
    return out;
  },
  ask: function () { return ""; }, answered: function () { return ""; }, end: function () { return ""; },
  footer: function (st, info) {
    if (st === "working") return '<div class="cx-working"><span class="cx-shim">• Working</span> <span class="cx-dim">(' + dur(info.elapsed) + " • esc to interrupt)</span></div>" + CX.input();
    return CX.input();
  },
  input: function () { return '<div class="cx-input"><div><span class="cx-pr">›</span> <span class="cc-cursor"></span></div></div><div class="cx-dim cx-hint"><span>⏎ send   ⇧⏎ newline   ⌃T transcript   ⌃C quit</span><span>100% context left</span></div>'; },
};

/* ============ Cursor (the agent panel) ============ */
var CU = {
  cls: "cu",
  title: function (T) { return T.title; },
  banner: function () { return ""; },
  user: function (b) { return '<div class="cu-user">' + h(b.e.text) + "</div>"; },
  think: function (b) {
    return '<div class="cu-think" data-act="rp-think"><span class="cu-chev">' + (RP.thinking ? "▾" : "▸") + "</span> Thought for " + b.e.sec + "s</div>" + (RP.thinking ? '<div class="cu-thought">' + h(b.e.text) + "</div>" : "");
  },
  say: function (b) { return '<div class="cu-say">' + md(typed(b)) + "</div>"; },
  call: function (b) {
    var t = b.e.tool, r = b.res, run = !r ? " run" : "";
    if (t.kind === "read") return '<div class="cu-tool' + run + '">' + svg(GLYPH.file, 13) + ' <span>Read</span> <b>' + h(fileName(t.path)) + '</b> <span class="cu-dim">L1-' + t.lines + "</span></div>";
    if (t.kind === "search") return '<div class="cu-tool' + run + '">' + svg(GLYPH.sessions, 13) + ' <span>Searched</span> <b>' + h(t.pattern) + '</b> <span class="cu-dim">in ' + h(t.path) + " · " + t.hits + " results</span></div>";
    if (t.kind === "mcp") {
      var rl = resLines(b);
      return '<div class="cu-card' + run + '"><div class="cu-card-h">' + svg(GLYPH.servers, 13) + " <span>Called MCP tool</span> <b>" + h(t.name) + '</b> <span class="cu-dim">' + h(t.server) + "</span></div>" +
        (r ? '<div class="cu-card-b cu-mono">' + rl.slice(0, 3).map(function (l) { return "<div>" + h(l) + "</div>"; }).join("") + "</div>" : "") + "</div>";
    }
    if (t.kind === "write" || t.kind === "edit") {
      var add = t.kind === "write" ? t.content.length : t.add, del = t.kind === "write" ? 0 : t.del, lines;
      if (t.kind === "write") lines = t.content.slice(0, 8).map(function (l) { return '<div class="cu-dl add">' + (h(l) || " ") + "</div>"; }).join("") + (t.content.length > 8 ? '<div class="cu-dl cu-dim">… ' + (t.content.length - 8) + " more lines</div>" : "");
      else lines = t.hunks.map(function (d) { return d[0] === "…" ? '<div class="cu-dl cu-dim">…</div>' : '<div class="cu-dl ' + (d[1] === "+" ? "add" : d[1] === "-" ? "del" : "") + '">' + (h(d[2]) || " ") + "</div>"; }).join("");
      return '<div class="cu-card' + run + '"><div class="cu-card-h">' + svg(GLYPH.file, 13) + " <b>" + h(fileName(t.path)) + '</b> <span class="cu-add">+' + add + '</span> <span class="cu-del">-' + del + '</span><span class="cu-acc">' + (r ? "Accepted" : "") + "</span></div>" +
        '<div class="cu-card-b cu-mono">' + lines + "</div></div>";
    }
    if (t.kind === "bash") {
      var bl = resLines(b);
      return '<div class="cu-card' + run + '"><div class="cu-card-h">' + svg(GLYPH.sessions, 13) + " <span>" + (r ? "Ran terminal command" : "Running terminal command") + '</span></div><div class="cu-term cu-mono"><div><span class="cu-dim">$</span> ' + h(t.cmd) + "</div>" +
        bl.slice(0, 5).map(function (l) { return "<div>" + (h(l) || " ") + "</div>"; }).join("") + "</div></div>";
    }
    return '<div class="cu-tool' + run + '">' + h(t.kind) + "</div>";
  },
  ask: function () { return ""; }, answered: function () { return ""; }, end: function () { return ""; },
  footer: function (st, info, T) {
    return (st === "working" ? '<div class="cu-gen"><span class="cu-shim">Generating</span><button class="cu-stop" tabindex="-1">Stop</button></div>' : "") +
      '<div class="cu-composer"><div class="cu-ph">Plan, search, build anything</div><div class="cu-cbar"><span class="cu-pill">∞ Agent ▾</span><span class="cu-pill">' + h(T.modelLabel) + ' ▾</span><span class="cu-send">↑</span></div></div>';
  },
};

/* ============ stella ============ */
var ST = {
  cls: "st",
  title: function (T) { return "stella"; },
  banner: function (T) {
    return '<div class="st-top"><span class="st-gold">SESSION</span><span class="st-dim">▸ plan r1 · task 1 ' + h(T.title.toLowerCase()) + '</span><span class="st-mark">stella<span class="st-gold">*</span></span></div>' +
      '<div class="st-turn"><span class="st-gold">— turn 1</span> <span class="st-dim">execute · ' + h(T.model) + " · budget " + money(T.cap) + "</span><i></i></div>";
  },
  user: function (b) { return '<div class="st-user"><span class="st-gold">&gt;&gt;&gt;</span> ' + h(b.e.text) + "</div>"; },
  think: function (b) { return '<div class="st-ev model"><span class="st-rail"></span><div><span class="st-g">◐</span> <span class="st-v">model</span> <span class="st-dim">thinking</span><div class="st-body st-dim">' + h(b.e.text) + "</div></div></div>"; },
  say: function (b) { return '<div class="st-say">' + md(typed(b)) + "</div>"; },
  call: function (b) {
    var t = b.e.tool, r = b.res, ms = r ? '<span class="st-m">⚡' + (r.ms >= 1000 ? (r.ms / 1000).toFixed(1) + "s" : r.ms + "ms") + "</span>" : '<span class="st-m st-run">◐ running</span>';
    if (t.kind === "read") return '<div class="st-ev read"><span class="st-rail"></span><div class="st-h"><span class="st-g">▸</span> <span class="st-v">read</span> ' + h(t.path) + ' <span class="st-dim">' + t.lines + " lines</span>" + ms + "</div></div>";
    if (t.kind === "skill") return '<div class="st-ev skill"><span class="st-rail"></span><div><div class="st-h"><span class="st-g">✦</span> <span class="st-v">skill</span> ' + h(t.name) + ' <span class="st-dim">auto</span><span class="st-m">' + tok(t.tok) + ' tok</span></div><div class="st-body st-dim">injected from steering</div></div></div>';
    if (t.kind === "edit") {
      var rows = t.hunks.map(function (d) { return '<div class="st-diff ' + (d[1] === "+" ? "add" : d[1] === "-" ? "del" : "") + '"><span class="ln">' + d[0] + '</span><span class="sg">' + (d[1] === " " ? " " : d[1]) + "</span>" + (h(d[2]) || " ") + "</div>"; }).join("");
      return '<div class="st-ev edit"><span class="st-rail"></span><div><div class="st-h"><span class="st-g">●</span> <span class="st-v">edit</span> ' + h(t.path) + ' <span class="st-add">+' + t.add + '</span> <span class="st-del">-' + t.del + "</span>" + ms + '</div><div class="st-diffs">' + rows + "</div></div></div>";
    }
    if (t.kind === "bash") {
      var rl = resLines(b);
      return '<div class="st-ev run"><span class="st-rail"></span><div><div class="st-h"><span class="st-g">●</span> <span class="st-v">run</span> ' + h(t.cmd) + ms + "</div>" + (r ? '<div class="st-body ' + (r.ok === false ? "st-bad" : "st-good") + '">' + h(rl[rl.length - 1] || "") + "</div>" : "") + "</div></div>";
    }
    if (t.kind === "mcp") {
      var ml = resLines(b);
      return '<div class="st-ev exec"><span class="st-rail"></span><div><div class="st-h"><span class="st-g">⊙</span> <span class="st-v">' + h(t.server + "." + t.name) + "</span>" + ms + "</div>" + (r ? '<div class="st-body">' + ml.slice(0, 2).map(h).join("<br>") + "</div>" : "") + "</div></div>";
    }
    return "";
  },
  ask: function () { return ""; }, answered: function () { return ""; }, end: function () { return ""; },
  footer: function (st, info, T) {
    var pct = Math.min(95, Math.round(info.ctx / 2000)), full = Math.round(pct / 10);
    return (st === "working" ? '<div class="st-ev model live"><span class="st-rail"></span><div><span class="st-g st-pulse">◐</span> <span class="st-v">model</span> <span class="st-dim">working · ' + dur(info.elapsed) + "</span></div></div>" : "") +
      '<div class="st-prompt"><span class="st-gold">&gt;&gt;&gt;</span> <span class="cc-cursor st-cur"></span></div>' +
      '<div class="st-hint st-dim">⏎ queue · esc steer · ^N failure · ^Z fold turn · / commands</div>' +
      '<div class="st-status"><span>' + h(T.model) + ' · execute · ctx <span class="st-gold">' + "█".repeat(full) + '</span><span class="st-dim">' + "░".repeat(10 - full) + "</span> " + pct + '% · <span class="st-gold">' + money(info.cost) + '</span></span><span class="st-dim">? help</span></div>';
  },
};
var SKINS = { "claude-code": CC, "codex-cli": CX, cursor: CU, stella: ST };

/* ---- the margin: what oxagen adds beside a row ---- */
function marginFor(b) {
  var bits = [];
  if (b.gap) bits.push('<span class="mg-gap">Waited ' + dur(b.gap) + "</span>");
  if (b.took) bits.push('<span class="mg-gap">Took ' + dur(b.took) + "</span>");
  if (b.req) {
    var q = RP.led.reqs.filter(function (x) { return x.n === b.req.n; })[0];
    if (q) {
      var rd = 0, wr = 0; for (var k in q.read) rd += q.read[k]; for (var w in q.write) wr += q.write[w];
      bits.push('<button class="mg-cost" data-act="rp-seek-req" data-n="' + q.n + '" title="Request ' + q.n + ": " + num(rd) + " tokens re-read, " + num(wr) + " new, " + num(q.out) + ' written">' + money3(q.cost.total) + "</button>");
    }
  }
  if (b.type === "user") {
    if (b.e.via === "work") bits.push('<span class="mg-note">From ' + h(RP.T.wi) + "</span>");
    else if (b.e.via === "oxagen") bits.push('<span class="mg-note">Sent from oxagen by ' + h(personName(b.e.by)) + "</span>");
  }
  if (b.type === "call" && b.e.tool.kind === "mcp") {
    var sv = serverBy(b.e.tool.server);
    bits.push('<span class="mg-srv">' + (sv ? serverMark(sv, 14) : "") + h(sv ? sv.name : b.e.tool.server) + "</span>");
    if (b.res && b.res.gov === "allow") bits.push('<span class="mg-note ok">Allowed by policy</span>');
    if (b.answer) bits.push('<span class="mg-note ' + (b.answer.verdict === "approve" ? "ok" : "bad") + '">' + (b.answer.verdict === "approve" ? "Approved" : "Denied") + " by " + h(personName(b.answer.by)) + " in oxagen</span>");
  }
  if (b.type === "call" && b.e.tool.kind === "skill") bits.push('<span class="mg-note">Skill from steering</span>');
  if (b.type === "ask" && S.answered[RP.T.id]) {
    // Replayed after the answer: the question was on screen then, and the margin says how it went.
    var ans = S.answered[RP.T.id];
    bits.push('<span class="mg-note ' + (ans.verdict === "approve" ? "ok" : "bad") + '">' + (ans.verdict === "approve" ? "Approved" : "Denied") + " by " + h(personName(ME)) + " in oxagen, " + dur(ans.t - b.e.t) + " later</span>");
  } else if (b.type === "ask") {
    var who = PEOPLE[ME].name;
    bits.push('<div class="mg-ask"><b>Waiting on you</b><span>oxagen asks a person before ' + h(b.call.e.tool.server) + " " + h(b.call.e.tool.name) + ". Your answer goes to the terminal.</span>" +
      '<div class="row"><button class="btn sm primary" data-act="rp-approve">' + g("check", 13) + ' Approve</button><button class="btn sm" data-act="rp-deny">Deny</button></div><span class="mg-who">Answering as ' + h(who) + "</span></div>");
  }
  return bits.join("");
}

/* What oxagen handed the session before its first prompt: the steering block for its code repository
   and the workspace's imported servers. */
function bannerMargin() {
  var n = RP.T.steeringCount != null ? RP.T.steeringCount : Ledger.steeringFor(transcriptRepo(RP.T), LEDGER_F).length;
  return '<span class="mg-note">oxagen delivered ' + plural(n, "steering record") + " and " + plural(Ledger.toolServers(LEDGER_F, RP.T.started).length, "MCP server") + "</span>";
}

/* ---- drawing ---- */
function rpRows(vt) {
  var skin = SKINS[RP.T.harness], blocks = rpBlocks(vt);
  if (skin.transform) blocks = skin.transform(blocks);
  var html = '<div class="tr tr-banner"><div class="tg">' + hhmmss(RP.T.started) + '</div><div class="tc">' + skin.banner(RP.T) + '</div><div class="tm">' + bannerMargin() + "</div></div>", state = rpState(vt, blocks);
  blocks.forEach(function (b) {
    var body = skin[b.type] ? skin[b.type](b) : "";
    if (!body && !b.req && !b.gap) return;
    html += '<div class="tr' + (b.type === "ask" ? " tr-ask" : "") + '" data-i="' + b.i + '"><div class="tg">' + hhmmss(new Date(dt(RP.T.started).getTime() + b.e.t * 1000)) + '</div><div class="tc">' + body + '</div><div class="tm">' + marginFor(b) + "</div></div>";
  });
  var rec = rpRecorded(vt), lastUser = 0, outTurn = 0, reqN = 0;
  RP.ev.forEach(function (e, i) {
    if (RP.vts[i] > vt) return;
    if (e.k === "prompt" || e.k === "steer") { lastUser = e.t; outTurn = 0; }
    if (e.k === "req") { outTurn += e.out; reqN = e.n; }
  });
  var cost = rpCostAt(vt);
  var ctxTok = RP.led.reqs.filter(function (q) { return RP.reqVt[q.n] <= vt; }).reduce(function (m, q) { var s = q.out; for (var k in q.read) s += q.read[k]; for (var w in q.write) s += q.write[w]; return Math.max(m, s); }, 0);
  var sess = sessionBy(RP.sid);
  var liveEnd = sess && isLive(sess) && vt >= RP.total - 0.01;
  var st = state === "working" && !liveEnd && vt >= RP.total - 0.01 && sess && !isLive(sess) ? "done" : state;
  html += '<div class="tr tr-foot"><div class="tg"></div><div class="tc">' + skin.footer(st, { elapsed: liveEnd ? (NOW - dt(RP.T.started)) / 1000 - lastUser : rec - lastUser, out: outTurn, req: reqN, cost: cost.total, ctx: ctxTok }, RP.T) + '</div><div class="tm"></div></div>';
  return { html: html, state: state, cost: cost, blocks: blocks };
}

function rpDraw(force) {
  var body = document.getElementById("rp-body");
  if (!body) return;
  var r = rpRows(RP.vt);
  var atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  if (force || RP.drawn !== r.html) { body.innerHTML = r.html; RP.drawn = r.html; }
  if (RP.follow && (RP.playing || force || atBottom)) body.scrollTop = body.scrollHeight;
  // The replay bar and the rail follow the clock.
  var scrub = document.getElementById("rp-scrub"); if (scrub && document.activeElement !== scrub) scrub.value = RP.vt;
  var fill = document.getElementById("rp-fill"); if (fill) fill.style.width = (RP.total ? RP.vt / RP.total * 100 : 0) + "%";
  var tm = document.getElementById("rp-time");
  if (tm) tm.textContent = hhmmss(new Date(dt(RP.T.started).getTime() + rpRecorded(RP.vt) * 1000));
  var el = document.getElementById("rp-el"); if (el) el.textContent = dur(rpRecorded(RP.vt));
  var pb = document.getElementById("rp-play"); if (pb) { pb.innerHTML = g(RP.playing ? "pause" : "play", 16); pb.setAttribute("aria-label", RP.playing ? "Pause" : "Play"); }
  rpRail(r.cost);
}
function rpRail(cost) {
  var s = sessionBy(RP.sid), atEnd = RP.vt >= RP.total - 0.01;
  var c = atEnd ? s.cost.total : cost.total;
  var v = document.getElementById("rp-cost"); if (v) v.textContent = money(c);
  var cap = document.getElementById("rp-cap"); if (cap) cap.style.width = Math.min(100, c / RP.T.cap * 100) + "%";
  var so = document.getElementById("rp-so"); if (so) so.textContent = atEnd ? (isLive(s) ? "So far, live" : "Whole session") : "At " + dur(rpRecorded(RP.vt)) + " in the replay";
  var rq = document.getElementById("rp-reqs"); if (rq) rq.textContent = plural(atEnd ? RP.led.reqs.length : cost.n, "model request") + ", " + tok(atEnd ? s.tokens : cost.tokens) + " tokens";
  var ch = document.getElementById("rp-changes"); if (ch) { var html = changesFor(RP.T, atEnd ? null : RP.vt); if (ch.innerHTML !== html) ch.innerHTML = html; }
  document.querySelectorAll("#rp-chart [data-n]").forEach(function (bar) { bar.classList.toggle("on", RP.reqVt[+bar.getAttribute("data-n")] <= RP.vt + 1e-6); });
  var where = document.getElementById("rp-where");
  if (where) where.innerHTML = whereRows(atEnd ? s.cost.by : cost.by, s.harness, atEnd ? s.cost.total : cost.total);
}
function whereRows(by, harness, total) {
  var rows = whereItWent(by, harness), fmt = total < 1 ? money3 : money;
  var max = rows.reduce(function (m, r) { return Math.max(m, r.cost); }, 0) || 1;
  return rows.map(function (r) {
    return '<div class="wh"><div class="wh-l"><span>' + h(r.label) + '</span><b class="num">' + fmt(r.cost) + '</b></div><div class="wh-bar"><i style="width:' + (r.cost / max * 100).toFixed(1) + '%"></i></div></div>';
  }).join("") || '<div class="muted">Nothing yet.</div>';
}

/* ---- the clock ---- */
function rpTick(ts) {
  if (!RP.playing) return;
  var dtm = RP.last ? Math.min(0.1, (ts - RP.last) / 1000) : 0;
  RP.last = ts;
  RP.vt = Math.min(RP.total, RP.vt + dtm * RP.speed);
  rpDraw(false);
  if (RP.vt >= RP.total) { rpStop(); rpDraw(false); return; }
  RP.raf = requestAnimationFrame(rpTick);
}
function rpPlay() {
  if (RP.vt >= RP.total - 0.01) RP.vt = 0;
  RP.playing = true; RP.last = 0; RP.follow = true;
  cancelAnimationFrame(RP.raf); RP.raf = requestAnimationFrame(rpTick);
  rpDraw(true);
}
function rpStop() { RP.playing = false; cancelAnimationFrame(RP.raf); }
function rpSeek(vt) { RP.vt = Math.max(0, Math.min(RP.total, vt)); RP.follow = true; rpDraw(true); }
function rpStep(dir) {
  var stops = RP.vts.filter(function (v, i) { return RP.ev[i].k !== "req" && RP.ev[i].k !== "res"; });
  var next = dir > 0 ? stops.filter(function (v) { return v > RP.vt + 0.01; })[0] : stops.filter(function (v) { return v < RP.vt - 0.01; }).pop();
  rpStop();
  rpSeek(next != null ? next : dir > 0 ? RP.total : 0);
}

ACTS["rp-play"] = function () { if (RP.playing) { rpStop(); rpDraw(false); } else rpPlay(); };
ACTS["rp-restart"] = function () { RP.vt = 0; rpPlay(); };
ACTS["rp-prev"] = function () { rpStep(-1); };
ACTS["rp-next"] = function () { rpStep(1); };
ACTS["rp-speed"] = function (el) { RP.speed = +el.value; };
ACTS["rp-scrub"] = function (el) { var v = +el.value; rpStop(); rpSeek(v >= +el.max - 0.05 ? RP.total : v); };
ACTS["rp-think"] = function () { RP.thinking = !RP.thinking; var t = document.getElementById("rp-thinking"); if (t) t.setAttribute("aria-pressed", RP.thinking); rpDraw(true); };
ACTS["rp-open"] = function (el) { var i = +el.getAttribute("data-i"); RP.open[i] = !RP.open[i]; rpDraw(true); };
ACTS["rp-seek-req"] = function (el) { var n = +el.getAttribute("data-n"); rpStop(); rpSeek(RP.reqVt[n] + 0.8); };
ACTS["rp-jump"] = function (el) { rpStop(); rpSeek(+el.getAttribute("data-vt")); };
ACTS["rp-approve"] = function () { rpAnswer("approve"); };
ACTS["rp-deny"] = function () { rpAnswer("deny"); };
function rpAnswer(verdict) {
  var T = RP.T, ask = T.events.filter(function (e) { return e.k === "ask"; })[0];
  if (!ask || S.answered[T.id]) return;
  S.answered[T.id] = { verdict: verdict, t: Math.max(ask.t + 1, (NOW - dt(T.started)) / 1000) };
  _sessions = null;
  var at = RP.total;
  rpLoad(T);
  RP.vt = at;
  render();
  rpPlay();
  toast(verdict === "approve" ? "Approved. Claude Code is creating the draft release." : "Denied. Claude Code got your answer and stopped.", verdict === "approve" ? null : "warn");
}
function replayKey(ev) {
  if (S.area !== "sessions" || !S.id || S.dialog || S.drawer || !RP.T || RP.sid !== S.id) return;
  var tag = (ev.target && ev.target.tagName) || "";
  if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(tag) && ev.key === " ") return;
  if (/INPUT|TEXTAREA/.test(tag)) return;
  if (ev.key === " ") { ev.preventDefault(); ACTS["rp-play"](); }
  else if (ev.key === "ArrowRight") { ev.preventDefault(); rpStep(1); }
  else if (ev.key === "ArrowLeft") { ev.preventDefault(); rpStep(-1); }
  else if (ev.key === "o" && !ev.metaKey && !ev.ctrlKey) ACTS["rp-think"]();
}
