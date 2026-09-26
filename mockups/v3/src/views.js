/* ============================== views.js ==============================
   The shell and the six areas: Work, Sessions (and one session), Agents, Steering (and one steering
   PR), MCP servers (and one server) and Spend. Each view returns {crumb, html, after}. Dialogs and
   drawers register by name. */

/* ---- the shell ---- */
function navItems() {
  var inbox = workItems().filter(function (w) { return w.state === "inbox"; }).length;
  var sugg = S.empty ? 0 : STEERING.suggestions.filter(function (s) { return !S.accepted[s.id] && !S.dismissed[s.id]; }).length;
  return [
    ["work", "Work", inbox ? { n: inbox } : null],
    ["sessions", "Sessions", needsYou().length ? { n: needsYou().length, hot: true } : null],
    ["agents", "Agents", null],
    ["steering", "Steering", sugg ? { n: sugg } : null],
    ["servers", "MCP servers", null],
    ["spend", "Spend", null],
  ];
}
function shell(view) {
  var nav = navItems().map(function (n) {
    return '<a class="navitem" href="' + href(n[0]) + '" data-go="' + n[0] + '"' + (S.area === n[0] ? ' aria-current="page"' : "") + '><span class="ic">' + g(n[0]) + "</span>" + n[1] +
      (n[2] ? '<span class="ct' + (n[2].hot ? " hot" : "") + '">' + n[2].n + "</span>" : "") + "</a>";
  }).join("");
  var tabs = navItems().map(function (n) {
    return '<a class="tb" href="' + href(n[0]) + '" data-go="' + n[0] + '"' + (S.area === n[0] ? ' aria-current="page"' : "") + '><span class="ic">' + g(n[0], 20) + "</span><span>" + (n[0] === "servers" ? "Servers" : n[1]) + "</span>" +
      (n[2] ? '<span class="ct' + (n[2].hot ? " hot" : "") + '">' + n[2].n + "</span>" : "") + "</a>";
  }).join("");
  var me = PEOPLE[ME], ny = needsYou();
  var crumbs = '<span>' + h(ORG.name) + '</span><span class="sep">/</span><span>' + h(WS.name) + "</span>" + (view.crumb || []).map(function (c, i, a) {
    return '<span class="sep">/</span>' + (i === a.length - 1 ? "<b>" + h(c[0]) + "</b>" : '<a href="' + href(c[1]) + '" data-go="' + c[1] + '">' + h(c[0]) + "</a>");
  }).join("");
  return '<div class="app">' +
    '<aside class="side"><div class="side-top"><div class="brandmark">' + LOGO + "</div>" +
      '<button class="switcher" data-act="stub" data-what="Switching organizations"><span class="av">' + h(ORG.initial) + '</span><span class="tx"><b>' + h(ORG.name) + "</b><span>" + h(ORG.slug) + "</span></span></button>" +
      '<button class="switcher" data-act="workspaces"><span class="av ws">CP</span><span class="tx"><b>' + h(WS.name) + "</b><span>" + h(REPO.name.split("/")[1]) + "</span></span></button></div>" +
      '<nav aria-label="Workspace">' + nav + "</nav>" +
      '<div class="side-foot"><button class="userbtn" data-act="account">' + personAv(ME, 26) + '<span class="tx"><b>' + h(me.name) + "</b><span>" + h(me.role) + "</span></span></button></div></aside>" +
    '<div class="main"><header class="top"><div class="crumbs">' + crumbs + '</div><span class="sp"></span>' +
      (ny.length ? '<a class="needs" href="' + href("sessions", ny[0].id) + '" data-go="sessions|' + ny[0].id + '"><span class="d"></span>' + ny.length + " waiting on you</a>" : "") +
    '</header><main class="page">' + healthBanner() + view.html + "</main></div>" +
    '<nav class="tabbar" aria-label="Workspace">' + tabs + "</nav></div>";
}
function phead(title, sub, acts) {
  return '<div class="phead"><div class="t"><p class="eyebrow">' + h(WS.name) + "</p><h1>" + h(title) + "</h1>" + (sub ? "<p>" + sub + "</p>" : "") + "</div>" + (acts ? '<div class="acts">' + acts + "</div>" : "") + "</div>";
}
function stat(k, v, s) { return '<div class="stat"><span class="k">' + h(k) + '</span><span class="v">' + v + "</span>" + (s ? '<span class="s">' + s + "</span>" : "") + "</div>"; }
function empty(icon, title, text, acts) {
  return '<div class="panel"><div class="state-wrap"><div class="ico">' + g(icon, 20) + "</div><h2>" + h(title) + "</h2><p>" + text + '</p><div class="acts">' + (acts || "") + "</div></div></div>";
}
function badge(cls, text, dot) { return '<span class="b ' + cls + '">' + (dot ? '<span class="d"></span>' : "") + h(text) + "</span>"; }
function statusBadge(s) {
  if (s.status === "needs-you") return badge("b-approval", "Needs you", true);
  if (s.status === "running" || s.status === "starting") return '<span class="live"><span class="p"></span>Running</span>';
  if (s.status === "stopped") return badge("b-q", "Stopped");
  if (s.status === "failed") return badge("b-failed", "Failed");
  return badge("b-q", "Done");
}
function agentCell(a, sub) {
  return '<span class="agc">' + agentAv(a, 26) + '<span class="agid"><b>' + h(a.name) + '</b><span class="sub">' + hxIcon(a.harness, 12) + " " + h(sub || hxLabel(a.harness)) + "</span></span></span>";
}
function wiCell(w) {
  return '<span class="wic"><span class="wik">' + ipLogo(w.src, 13) + '<span class="mono">' + h(w.key) + "</span></span><span class=\"wit\">" + h(w.title) + "</span></span>";
}
function labelChips(ls) { return (ls || []).map(function (l) { return '<span class="lab lab-' + h(l.toLowerCase()) + '">' + h(l) + "</span>"; }).join(""); }

ACTS.stub = function (el) { toast((el.getAttribute("data-what") || "That") + " is not in this mockup."); };
ACTS.account = function () { openDialog("account"); };

/* ============================== Work ============================== */
VIEWS.work = function () {
  var items = workItems();
  var tabs = [["inbox", "Inbox"], ["running", "Running"], ["review", "Review"], ["done", "Done"]];
  var by = { inbox: [], running: [], review: [], done: doneWork() };
  items.forEach(function (w) { if (by[w.state]) by[w.state].push(w); });
  if (S.empty) {
    return { crumb: [["Work"]], html: phead("Work", "Work arrives from your trackers. You send an item to an agent.") + onboarding() };
  }
  var ny = needsYou();
  var head = phead("Work", "Work arrives from GitHub, Linear and Jira. Send an item to an agent.",
    '<button class="btn" data-act="newwork">' + g("plus", 14) + ' New work item</button><button class="btn primary" data-act="send" data-key="">' + g("send", 14) + " Send to an agent</button>");
  var banner = ny.map(function (s) {
    var a = agentBy(s.agent);
    return '<div class="banner needs-b"><span class="d"></span><div class="grow"><b>' + h(a.name) + " is waiting on you</b>" + h(s.title) + ": oxagen asks a person before github create_release.</div>" +
      '<button class="btn sm primary-soft" data-go="sessions|' + s.id + '">Open the session</button></div>';
  }).join("");
  var monthWork = sessions().filter(function (s) { return s.wi; });
  var tiles = '<div class="grid g3 tiles">' +
    stat("Inbox", num(by.inbox.length), plural(by.inbox.filter(function (w) { return dayLabel(w.opened) === "Today"; }).length, "item") + " arrived today") +
    stat("Running", num(by.running.length), ny.length ? plural(ny.length, "session") + " waiting on you" : "Nothing waiting on you") +
    stat("Spent on work this month", money(monthWork.reduce(function (t, s) { return t + s.cost.total; }, 0)), "Across " + plural(new Set(monthWork.map(function (s) { return s.wi.key; })).size, "work item")) + "</div>";
  var tabbar = '<div class="tabs" role="tablist">' + tabs.map(function (t) {
    return '<button class="tab" role="tab" data-act="worktab" data-tab="' + t[0] + '" aria-selected="' + (S.workTab === t[0]) + '">' + t[1] + '<span class="n">' + by[t[0]].length + "</span></button>";
  }).join("") + "</div>";
  var list = by[S.workTab] || [], rows;
  if (S.workTab === "inbox") {
    rows = list.map(function (w) {
      return '<tr class="click" data-act="wi" data-key="' + h(w.key) + '"><td>' + wiCell(w) + "</td><td class=\"mh\">" + labelChips(w.labels) + '</td><td class="muted nowrap mh">' + ago(w.opened) + '</td><td class="num"><button class="btn sm" data-act="send" data-key="' + h(w.key) + '">' + g("send", 13) + " Send</button></td></tr>";
    });
    rows = '<table><thead><tr><th>Work item</th><th class="mh">Labels</th><th class="mh">Opened</th><th></th></tr></thead><tbody>' + rows.join("") + "</tbody></table>";
  } else if (S.workTab === "running" || S.workTab === "review") {
    rows = list.map(function (w) {
      var s = sessionBy(w.session), a = agentBy(w.agent);
      var third = S.workTab === "running" ? statusBadge(s) : (w.release ? badge("b-allowed", "Draft release " + w.release, true) : w.held ? badge("b-approval", "Release " + w.held + " held", true) : '<span class="prc">' + g("pr", 13) + '<span class="mono">' + h(w.pr) + "</span> " + badge(w.checks === "passing" ? "b-allowed" : "b-approval", w.checks === "passing" ? "Checks passing" : "Checks running", true) + "</span>");
      return '<tr class="click" data-go="sessions|' + h(w.session) + '"><td>' + wiCell(w) + "</td><td class=\"mh\">" + agentCell(a) + "</td><td>" + third + '</td><td class="num">' + money(s.cost.total) + '</td><td class="muted nowrap mh">' + when(s.started) + "</td></tr>";
    });
    rows = '<table><thead><tr><th>Work item</th><th class="mh">Agent</th><th>' + (S.workTab === "running" ? "Status" : "Result") + '</th><th class="num">Cost</th><th class="mh">Started</th></tr></thead><tbody>' + rows.join("") + "</tbody></table>";
  } else {
    rows = list.slice(0, 40).map(function (w) {
      return '<tr class="click" data-go="sessions|' + h(w.sessions[0].id) + '"><td>' + wiCell(w) + "</td><td class=\"mh\">" + agentCell(agentBy(w.agent)) + '</td><td class="num mh">' + w.sessions.length + '</td><td class="num">' + money(w.cost) + '</td><td class="muted nowrap mh">' + when(w.last) + "</td></tr>";
    });
    rows = '<table><thead><tr><th>Work item</th><th class="mh">Agent</th><th class="num mh">Sessions</th><th class="num">Cost</th><th class="mh">Last session</th></tr></thead><tbody>' + rows.join("") + "</tbody></table>";
  }
  if (!list.length) rows = '<div class="state-wrap small"><p>Nothing here.</p></div>';
  return { crumb: [["Work"]], html: head + banner + tiles + tabbar + '<div class="panel"><div class="tw">' + rows + "</div></div>" };
};
ACTS.worktab = function (el) { S.workTab = el.getAttribute("data-tab"); render(); };
ACTS.wi = function (el, ev) { if (ev.target.closest("button")) return; openDrawer("workitem", el.getAttribute("data-key")); };
ACTS.send = function (el, ev) {
  if (ev) ev.stopPropagation();
  var first = workItems().filter(function (w) { return w.state === "inbox"; })[0];
  var key = el.getAttribute("data-key") || (first && first.key);
  if (!key) { toast("The inbox is empty. New work arrives from your trackers."); return; }
  openDialog("send", key);
};
ACTS.newwork = function () { openDialog("newwork"); };

/* An import step waits on its steering PR: the step links it until it merges. */
function importStep(what, btn) { var n = S.importPr[what]; return n ? '<button class="btn" data-go="steering|pr-' + n + '">Steering PR #' + n + "</button>" : btn; }
function importPending(what) {
  var n = S.importPr[what];
  return empty(what, "Import in review", "Steering PR #" + n + (what === "steering" ? " imports your records. No agent gets them" : " adds your servers. No agent reaches them") + " until it merges.", '<button class="btn primary" data-go="steering|pr-' + n + '">View steering PR #' + n + "</button>");
}
function onboarding() {
  var steps = [
    ["Connect an agent", "Run one command where the agent runs. Claude Code, Codex, Cursor and stella all connect the same way.", '<button class="btn primary" data-act="connect">Connect an agent</button>', S.connected],
    ["Import your steering", "oxagen reads CLAUDE.md, AGENTS.md and Cursor rules from your repositories and merges them into one list.", importStep("steering", '<button class="btn" data-act="steerimport">Import steering</button>'), S.imported.steering],
    ["Import your MCP servers", "oxagen finds the servers in each harness's config, takes their keys, and points every harness at one gateway.", importStep("servers", '<button class="btn" data-act="serverimport">Import MCP servers</button>'), S.imported.servers],
    ["Connect a tracker", "Issues from GitHub, Linear or Jira arrive in the inbox.", '<button class="btn" data-act="stub" data-what="Connecting a tracker">Connect GitHub</button>', false],
  ];
  return '<div class="panel onb"><div class="panel-h"><h3>Set up Core platform</h3><span class="sp muted">' + steps.filter(function (s) { return s[3]; }).length + " of 4 done</span></div>" +
    steps.map(function (s, i) {
      return '<div class="onb-step' + (s[3] ? " done" : "") + '"><span class="onb-n">' + (s[3] ? g("check", 14) : i + 1) + '</span><div class="grow"><b>' + h(s[0]) + "</b><p>" + h(s[1]) + "</p></div>" + (s[3] ? badge("b-allowed", "Done", true) : s[2]) + "</div>";
    }).join("") + "</div>";
}

/* ---- Send to an agent ---- */
function suggestAgent(w) {
  var l = (w.labels || []).join(" ");
  if (/release/.test(l)) return "release-manager";
  if (/docs/.test(l)) return "docs-writer";
  if (/ci|flaky/.test(l)) return "stella-ci";
  return "triage";
}
DIALOGS.send = function (key, d) {
  var inbox = workItems().filter(function (w) { return w.state === "inbox"; });
  var w = workBy(key) || inbox[0];
  d.agent = d.agent || suggestAgent(w);
  var a = agentBy(d.agent);
  var picker = '<div class="field"><label for="send-item">Work item</label><select id="send-item" data-change="send-item">' + inbox.map(function (x) { return '<option value="' + h(x.key) + '"' + (x.key === w.key ? " selected" : "") + ">" + h(x.key + "  " + x.title) + "</option>"; }).join("") + "</select></div>";
  var agents = '<div class="field"><label>Agent</label><div class="pick">' + AGENTS.filter(function (x) { return x.key !== "amara-claude"; }).map(function (x) {
    var sp = sessions().filter(function (s) { return s.agent === x.key; }).reduce(function (t, s) { return t + s.cost.total; }, 0);
    return '<button class="pick-i' + (x.key === d.agent ? " on" : "") + '" data-act="send-agent" data-agent="' + x.key + '" aria-pressed="' + (x.key === d.agent) + '">' + agentAv(x, 30) +
      '<span class="pick-t"><b>' + h(x.name) + '</b>' + pts([hxIcon(x.harness, 12) + " " + h(hxLabel(x.harness)), h(modelLabel(x.model))]) + pts([h(x.where), money(sp) + " this month"]) + "</span></button>";
  }).join("") + "</div></div>";
  // Day one, every run gets the steering block for its code repository and every imported tool.
  var st = steeringNext(repoOfWork(w.key)), stTok = Ledger.sum(st), sv = Ledger.toolServers(LEDGER_F, F.ORG.now);
  var gets = '<div class="gets"><div><span class="k">Steering</span><b>' + plural(st.length, "steering record") + "</b> <span class=\"muted\">" + num(stTok) + ' tokens</span> <a href="' + href("steering") + '" data-go="steering">Change</a></div>' +
    '<div><span class="k">MCP servers</span><b>' + sv.map(function (x) { return serverBy(x.id).name; }).join(", ") + '</b> <a href="' + href("servers") + '" data-go="servers">Change</a></div>' +
    '<div><span class="k">Runs on</span><b>' + h(a.where) + '</b> <span class="muted mono">' + h(a.host) + "</span></div></div>";
  return {
    title: "Send to an agent", wide: true,
    sub: "The agent gets the work item as its first prompt, with the repository's steering and the workspace's imported tools.",
    body: picker + '<div class="wi-prev">' + wiCell(w) + '<p class="muted">' + h(w.body) + "</p></div>" + agents +
      '<div class="field"><label for="send-note">Note for the agent</label><textarea id="send-note" rows="2" data-input="send-keep" placeholder="Anything to add to the brief">' + h(d.note || "") + "</textarea></div>" +
      '<div class="fields"><div class="field"><label for="send-cap">Stop the session at</label><input id="send-cap" data-input="send-keep" value="' + h(d.cap != null ? d.cap : money(a.cap)) + '"><div class="hint">The session stops when its cost reaches this.</div></div><div class="field"><label>What it gets</label>' + gets + "</div></div>",
    foot: '<span class="grow">' + h(a.name) + " starts on " + h(a.host) + ".</span><button class=\"btn\" data-act=\"close\">Cancel</button><button class=\"btn primary\" data-act=\"send-go\" data-key=\"" + h(w.key) + '">' + g("send", 14) + " Send</button>",
  };
};
/* What a person typed survives picking another agent or work item. A cap they did not touch
   follows the agent. */
ACTS["send-keep"] = function (el) { if (el.id === "send-note") S.dialog.note = el.value; else S.dialog.cap = el.value; };
ACTS["send-agent"] = function (el) { S.dialog.agent = el.getAttribute("data-agent"); renderLayer(); };
ACTS["send-item"] = function (el) { S.dialog.arg = el.value; S.dialog.agent = null; renderLayer(); };
ACTS["send-go"] = function (el) {
  var w = workBy(el.getAttribute("data-key")), a = agentBy(S.dialog.agent || suggestAgent(w));
  var note = (document.getElementById("send-note") || {}).value || "";
  var capIn = parseFloat(((document.getElementById("send-cap") || {}).value || "").replace(/[^0-9.]/g, ""));
  var id = "ses_01K5S" + Math.random().toString(36).slice(2, 12).toUpperCase().padEnd(10, "0");
  var h0 = HARNESSES[a.harness];
  var T = { id: id, title: w.title, harness: a.harness, harnessV: a.harnessV, model: a.model, modelLabel: modelLabel(a.model), agent: a.key, person: ME, wi: w.key,
    host: a.host, cwd: "~/src/platform", started: F.ORG.now, status: "running", basis: a.harness === "cursor" ? "harness" : "gateway", cap: capIn > 0 ? capIn : a.cap,
    events: [
      { t: 0, k: "prompt", by: ME, via: "work", tok: 60 + Math.round(w.body.length / 4), text: w.key + ": " + w.title + "\n\n" + w.body + (note ? "\n\n" + note : "") },
      { t: 5.8, k: "req", n: 1, out: 140 },
      { t: 6.1, k: "say", text: "I'll read the work item and the code it points at first." },
      { t: 6.3, k: "call", id: "n1", tool: { kind: "mcp", server: w.src === "linear" ? "linear" : "github", name: "get_issue", args: { id: w.key } } },
    ] };
  // The steering block this session starts with, fixed at send time: the published records plus
  // any record a steering PR merged here.
  var repo = repoOfWork(w.key), next = steeringNext(repo);
  T.repo = repo;
  T.steeringCount = next.length;
  T.steer = next.map(function (x) { return { id: x.id, tok: x.tok }; });
  T.extraSteering = Ledger.sum(next) - Ledger.sum(Ledger.steeringFor(repo, LEDGER_F));
  S.sentTranscripts = S.sentTranscripts || {};
  S.sentTranscripts[id] = T;
  S.sent[w.key] = { agent: a.key, session: null };
  _sessions = null;
  S.sent[w.key].session = sessionFromTranscript(T);
  _sessions = null;
  closeDialog();
  toast("Sent to " + a.name + ". It starts on " + a.host + ".");
  go("sessions", id);
  setTimeout(function () { if (S.id === id) { RP.vt = 0; rpPlay(); } }, 50);
};
DIALOGS.newwork = function () {
  return { title: "New work item", sub: "Write it here when it does not come from a tracker.",
    body: '<div class="field"><label for="nw-title">Title</label><input id="nw-title" autofocus placeholder="Write the 4.11.0 upgrade guide"></div><div class="field"><label for="nw-body">Description</label><textarea id="nw-body" rows="4"></textarea></div>',
    foot: '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="stub" data-what="Saving a new work item">Add to the inbox</button>' };
};
DRAWERS.workitem = function (key) {
  var w = workBy(key), ss = sessions().filter(function (s) { return s.wi && s.wi.key === key; });
  return { title: w.title,
    head: '<div class="grow">' + wiCell(w) + "</div>",
    body: '<div class="row">' + labelChips(w.labels) + '<span class="muted">Opened ' + ago(w.opened) + " by " + h(PEOPLE[w.by] ? PEOPLE[w.by].name : w.by) + "</span></div><p>" + h(w.body) + "</p>" +
      (w.state === "inbox" ? '<button class="btn primary" data-act="send" data-key="' + h(w.key) + '">' + g("send", 14) + " Send to an agent</button>" : "") +
      '<h3 class="sec">Sessions</h3>' + (ss.length ? '<div class="lst">' + ss.map(sessRowCompact).join("") + "</div>" : '<p class="muted">No session has worked on this yet.</p>') };
};
function sessRowCompact(s) {
  var a = agentBy(s.agent);
  return '<a class="li" href="' + href("sessions", s.id) + '" data-go="sessions|' + s.id + '">' + agentAv(a, 24) + '<span class="bd2"><span class="t1">' + h(s.title) + " " + statusBadge(s) + '</span><span class="t2">' + pts([h(a.name), when(s.started), dur(s.dur)]) + '</span></span><b class="num">' + money(s.cost.total) + "</b></a>";
}

/* ============================== Sessions ============================== */
VIEWS.sessions = function () {
  if (S.id) return sessionView(S.id);
  if (S.empty) return { crumb: [["Sessions"]], html: phead("Sessions", "Every session your agents run, with its transcript and its cost.") + empty("sessions", "No sessions yet", "Connect an agent. Every session it runs shows up here, with a replay of its transcript and what each request cost.", '<button class="btn primary" data-act="connect">Connect an agent</button>') };
  var all = sessions(), live = all.filter(isLive), ny = needsYou();
  var list = S.sessFilter === "live" ? live : S.sessFilter === "needs" ? ny : S.sessAgent ? all.filter(function (s) { return s.agent === S.sessAgent; }) : all;
  S.sessLimit = S.sessLimit || 60;
  var seg = '<div class="seg">' + [["all", "All", all.length], ["live", "Live", live.length], ["needs", "Needs you", ny.length]].map(function (f) {
    return '<button class="btn sm" data-act="sessfilter" data-f="' + f[0] + '" aria-pressed="' + (S.sessFilter === f[0]) + '">' + f[1] + ' <span class="n">' + f[2] + "</span></button>";
  }).join("") + "</div>";
  var agentSel = '<select class="sel" data-change="sessagent" aria-label="Agent"><option value="">Every agent</option>' + AGENTS.map(function (a) { return '<option value="' + a.key + '"' + (S.sessAgent === a.key ? " selected" : "") + ">" + h(a.name) + "</option>"; }).join("") + "</select>";
  var rows = "", day = "";
  list.slice(0, S.sessLimit).forEach(function (s) {
    var a = agentBy(s.agent), dk = dayKey(s.started);
    if (dk !== day) { day = dk; rows += '<tr class="dayrow"><td colspan="7">' + dayLabel(s.started) + "</td></tr>"; }
    rows += '<tr class="click' + (s.transcript ? " has-tx" : "") + '" data-go="sessions|' + s.id + '"><td><span class="sesc"><b>' + h(s.title) + "</b>" + '<span class="sub">' + (s.wi ? ipLogo(s.wi.src, 11) + '<span class="mono">' + h(s.wi.key) + "</span>" : "Started in a terminal") + "</span></span></td>" +
      '<td class="mh">' + agentCell(a) + '</td><td class="nowrap mh">' + personAv(s.person, 20) + " " + h(personName(s.person)) + "</td><td>" + statusBadge(s) + '</td><td class="num nowrap muted mh">' + hhmm(s.started) + '</td><td class="num nowrap muted mh">' + dur(s.dur) + '</td><td class="num"><b>' + money(s.cost.total) + "</b></td></tr>";
  });
  var more = list.length > S.sessLimit ? '<div class="more"><button class="btn" data-act="sessmore">Show ' + Math.min(60, list.length - S.sessLimit) + " more</button><span class=\"muted\">" + num(S.sessLimit) + " of " + num(list.length) + "</span></div>" : "";
  return { crumb: [["Sessions"]], html: phead("Sessions", "Every session your agents ran, with its transcript and its cost.") +
    '<div class="toolbar">' + seg + agentSel + '<span class="sp muted">' + plural(list.length, "session") + ", " + money(list.reduce(function (t, s) { return t + s.cost.total; }, 0)) + "</span></div>" +
    '<div class="panel"><div class="tw"><table class="sess"><thead><tr><th>Session</th><th class="mh">Agent</th><th class="mh">Person</th><th>Status</th><th class="num mh">Started</th><th class="num mh">Length</th><th class="num">Cost</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="muted">No sessions match.</td></tr>') + "</tbody></table></div>" + more + "</div>" };
};
ACTS.sessfilter = function (el) { S.sessFilter = el.getAttribute("data-f"); S.sessAgent = null; render(); };
ACTS.sessagent = function (el) { S.sessAgent = el.value || null; S.sessFilter = "all"; render(); };
ACTS.sessmore = function () { S.sessLimit += 60; render(); };

function sessionView(id) {
  var s = sessionBy(id);
  if (!s) return { crumb: [["Sessions", "sessions"], ["Not found"]], html: empty("sessions", "No session with that id", "It may be from another workspace.", '<button class="btn" data-go="sessions">All sessions</button>') };
  var a = agentBy(s.agent), T = transcriptBy(id);
  if (T) rpOpen(T);
  var meta = '<div class="smeta">' + '<span class="hxn">' + hxIcon(a.harness, 14) + " " + h(hxLabel(a.harness)) + (T ? " " + h(T.harnessV) : "") + "</span>" +
    '<span class="agc-mini">' + agentAv(a, 18) + " " + h(a.name) + "</span>" +
    '<span>' + personAv(s.person, 18) + " " + h(personName(s.person)) + "</span>" +
    "<span>" + h(modelLabel(s.model)) + "</span>" +
    (s.wi ? '<span class="wik">' + ipLogo(s.wi.src, 12) + '<span class="mono">' + h(s.wi.key) + "</span></span>" : "<span>Started in a terminal</span>") +
    "<span>" + when(s.started) + "</span></div>";
  var head = '<div class="shead"><div class="t"><p class="eyebrow">Session</p><h1>' + h(s.title) + "</h1>" + meta + '</div><div class="acts">' + statusBadge(s) +
    (isLive(s) ? '<button class="btn" data-act="steer">' + g("send", 14) + ' <span class="lbl">Steer</span></button><button class="btn danger" data-act="stub" data-what="Stopping a session" aria-label="Stop">' + g("stop", 13) + ' <span class="lbl">Stop</span></button>' : "") + "</div></div>";
  var rail = sessionRail(s, T);
  if (!T) {
    return { crumb: [["Sessions", "sessions"], [s.title]], html: head + '<div class="sgrid"><div class="panel stub"><div class="state-wrap"><div class="ico">' + g("sessions", 20) + "</div><h2>Not in this mockup</h2><p>Four sessions carry a full transcript, one on each harness. Every other session shows its record and its cost.</p><div class=\"acts\">" +
      Object.keys(F.TRANSCRIPTS).slice(0, 4).map(function (tid) { var TT = F.TRANSCRIPTS[tid]; return '<button class="btn" data-go="sessions|' + tid + '">' + hxIcon(TT.harness, 14) + " " + h(hxLabel(TT.harness)) + "</button>"; }).join("") +
      "</div></div><div class=\"kv stub-kv\"><dt>Model requests</dt><dd>" + num(s.req) + "</dd><dt>Tokens</dt><dd>" + num(s.tokens) + "</dd><dt>Length</dt><dd>" + dur(s.dur) + "</dd><dt>Prompts</dt><dd>" + num(s.prompts || 1) + "</dd></div></div>" + rail + "</div>" };
  }
  var skin = SKINS[T.harness];
  var markers = RP.ev.map(function (e, i) {
    var cls = e.k === "prompt" || e.k === "steer" ? "m-user" : e.k === "ask" ? "m-ask" : e.k === "res" && e.ok === false ? "m-err" : e.k === "call" ? "m-tool" : "";
    return cls ? '<i class="' + cls + '" style="left:' + (RP.vts[i] / RP.total * 100).toFixed(2) + '%" data-act="rp-jump" data-vt="' + RP.vts[i] + '" title="' + h(e.k === "call" ? (e.tool.name || e.tool.kind) : e.k) + '"></i>' : "";
  }).join("");
  var bar = '<div class="rpbar" role="group" aria-label="Replay">' +
    '<button class="iconbtn" data-act="rp-restart" aria-label="Replay from the start">' + g("restart", 15) + "</button>" +
    '<button class="iconbtn" data-act="rp-prev" aria-label="Previous step">' + g("prev", 14) + "</button>" +
    '<button class="iconbtn play" id="rp-play" data-act="rp-play" aria-label="Play">' + g("play", 16) + "</button>" +
    '<button class="iconbtn" data-act="rp-next" aria-label="Next step">' + g("next", 14) + "</button>" +
    '<div class="rp-track"><div class="rp-rail"><div class="rp-fill" id="rp-fill"></div>' + markers + '</div><input type="range" id="rp-scrub" min="0" max="' + RP.total.toFixed(2) + '" step="any" value="' + RP.vt + '" data-input="rp-scrub" aria-label="Replay position"></div>' +
    '<span class="rp-time"><b id="rp-time" class="num"></b><span class="muted" id="rp-el"></span></span>' +
    '<select class="sel sm" data-change="rp-speed" aria-label="Replay speed">' + [1, 2, 4, 8, 16].map(function (x) { return '<option value="' + x + '"' + (RP.speed === x ? " selected" : "") + ">" + x + "×</option>"; }).join("") + "</select>" +
    (T.harness === "claude-code" || T.harness === "cursor" ? '<button class="btn sm" id="rp-thinking" data-act="rp-think" aria-pressed="' + RP.thinking + '">Thinking</button>' : "") + "</div>";
  var term = '<div class="term ' + skin.cls + '"><div class="term-top"><div></div><div class="term-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="term-t">' + h(skin.title(T)) + '</span><span class="term-h">' + h(T.host) + "</span></div><div></div></div>" +
    '<div class="rp-body" id="rp-body" tabindex="0" aria-label="Transcript"></div></div>';
  return { crumb: [["Sessions", "sessions"], [s.title]], html: head + bar + '<div class="sgrid"><div class="sterm">' + term + "</div>" + rail + "</div>",
    after: function () {
      var b = document.getElementById("rp-body");
      if (b) b.addEventListener("scroll", function () { RP.follow = b.scrollHeight - b.scrollTop - b.clientHeight < 60; }, { passive: true });
      rpDraw(true);
    } };
}
function sessionRail(s, T) {
  var a = agentBy(s.agent), chart = "", cap = T ? T.cap : a.cap;
  if (T) {
    var max = RP.led.reqs.reduce(function (m, q) { return Math.max(m, q.cost.total); }, 0) || 1;
    chart = '<div class="panel pad"><div class="rl-h"><h3>Cost by request</h3><span class="muted">' + plural(RP.led.reqs.length, "request") + '</span></div><div class="reqchart" id="rp-chart">' + RP.led.reqs.map(function (q) {
      return '<button data-n="' + q.n + '" data-act="rp-seek-req" style="height:' + Math.max(6, q.cost.total / max * 100).toFixed(1) + '%" title="Request ' + q.n + ": " + money3(q.cost.total) + '"><span class="sr">Request ' + q.n + " " + money3(q.cost.total) + "</span></button>";
    }).join("") + "</div></div>";
  }
  var basis = s.basis === "harness" ? "Reported by " + hxLabel(a.harness) + ". Its model calls do not pass through the oxagen gateway." : "Metered by the oxagen gateway, at list price.";
  var changes = T ? '<div class="panel pad"><div class="rl-h"><h3>Changes</h3></div><div id="rp-changes">' + changesFor(T, null) + "</div></div>" : "";
  return '<aside class="srail">' +
    '<div class="panel pad costcard"><div class="rl-h"><h3>Cost</h3><span class="muted" id="rp-so">' + (isLive(s) ? "So far, live" : "Whole session") + '</span></div><div class="big num" id="rp-cost">' + money(s.cost.total) + "</div>" +
      '<div class="capbar"><i id="rp-cap" style="width:' + Math.min(100, s.cost.total / (cap || 1) * 100) + '%"></i></div><div class="muted small">' + (cap ? "The session stops at " + money(cap) + "." : "") + '</div><div class="muted small"><span id="rp-reqs">' + plural(s.req, "model request") + ", " + tok(s.tokens) + " tokens</span></div>" +
      '<div class="basis">' + h(basis) + "</div></div>" + chart +
    '<div class="panel pad"><div class="rl-h"><h3>Where it went</h3></div><div id="rp-where">' + whereRows(s.cost.by, a.harness, s.cost.total) + "</div></div>" +
    changes + "</aside>";
}
/* What the session changed, as of replay time vt (null for the whole session). */
function changesFor(T, vt) {
  // The replay's own event list when it is on screen, so each event has its clock time by index.
  // transcriptEvents() builds fresh copies of an answer's events on every call.
  var live = RP.sid === T.id && RP.ev.length, ev = live ? RP.ev : transcriptEvents(T), files = {}, order = [], out = [], res = {};
  var seen = function (i) { return vt == null || !live || RP.vts[i] <= vt + 1e-6; };
  ev.forEach(function (e, i) { if (e.k === "res" && seen(i)) res[e.id] = e; });
  ev.forEach(function (e, i) {
    if (e.k !== "call" || !seen(i)) return;
    var t = e.tool;
    if (t.kind === "write" || t.kind === "edit") {
      if (!files[t.path]) { files[t.path] = { add: 0, del: 0, isNew: t.kind === "write" }; order.push(t.path); }
      files[t.path].add += t.kind === "write" ? t.content.length : t.add; files[t.path].del += t.kind === "write" ? 0 : t.del;
    }
    if (t.kind === "bash" && /git push/.test(t.cmd) && res[e.id]) out.push('<div class="chg">' + g("branch", 14) + ' <span class="mono">' + h(t.cmd.match(/origin (\S+)/)[1]) + '</span><span class="muted">pushed</span></div>');
    if (t.kind === "mcp" && t.name === "create_pull_request" && res[e.id]) out.push('<div class="chg">' + g("pr", 14) + " <span>" + h((res[e.id].lines || [""])[0].replace(/^Opened /, "")) + "</span></div>");
    if (t.kind === "mcp" && t.name === "create_release") out.push('<div class="chg">' + g("tag", 14) + ' <span class="mono">' + h(t.args.tag_name) + '</span><span class="muted">' + (res[e.id] ? (res[e.id].ok ? "draft created" : "not created") : "waiting on you") + "</span></div>");
  });
  var fl = order.map(function (p) { var f = files[p]; return '<div class="chg">' + g("file", 14) + ' <span class="mono">' + h(p) + '</span><span class="add">+' + f.add + "</span>" + (f.del ? '<span class="del">-' + f.del + "</span>" : "") + "</div>"; }).join("");
  return fl + out.join("") || '<p class="muted small">Nothing changed yet.</p>';
}
ACTS.steer = function () { openDialog("steer", S.id); };
DIALOGS.steer = function (id) {
  var s = sessionBy(id), a = agentBy(s.agent);
  return { title: "Steer this session", sub: h(a.name) + " gets your message at its next turn, the same as if you typed it in " + h(hxLabel(a.harness)) + ".",
    body: '<div class="field"><label for="steer-m">Message</label><textarea id="steer-m" rows="3" autofocus placeholder="Skip the mobile repo this cycle"></textarea></div>',
    foot: '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="steer-go">' + g("send", 14) + " Send</button>" };
};
ACTS["steer-go"] = function () { closeDialog(); toast("Queued. The agent gets it at its next turn."); };

/* ============================== Agents ==============================
   An agent is an operator, a runtime, and a harness, recorded in its file in agents/ (steering repo
   spec, Agents). Day one, every agent gets the workspace's imported tools, and a run's steering
   follows its code repository, so neither is listed per agent. Budgets per agent wait. */
function agentFile(a) { return "agents/a-intel.core." + a.key + ".toml"; }
function agentToml(a) {
  return "#:schema https://oxagen.sh/schemas/agent/v1.json\nschema = \"agent/v1\"\nname = \"a-intel.core." + a.key + "\"\nlabel = \"" + a.name + "\"\noperator = \"" + a.operator + "\"\nruntime = \"" + a.host + "\"\nharness = \"" + a.harness + "\"";
}
VIEWS.agents = function () {
  var head = phead("Agents", "Each agent is an operator, a runtime, and a harness, recorded in its file in the steering repo.", '<button class="btn primary" data-act="connect">' + g("plus", 14) + " Connect an agent</button>");
  if (S.empty) return { crumb: [["Agents"]], html: head + empty("agents", "No agents yet", "Connect Claude Code, Codex, Cursor or stella with one command. The agent keeps running where it runs today.", '<button class="btn primary" data-act="connect">Connect an agent</button>') };
  var all = sessions();
  var cards = AGENTS.map(function (a) {
    var ss = all.filter(function (s) { return s.agent === a.key; }), spent = ss.reduce(function (t, s) { return t + s.cost.total; }, 0), last = ss[0];
    var live = ss.filter(isLive)[0];
    return '<button class="panel acard" data-act="agent" data-key="' + a.key + '"><div class="acard-h">' + agentAv(a, 36) + '<div class="grow"><b>' + h(a.name) + '</b><span class="sub">' + pts([hxIcon(a.harness, 12) + " " + h(hxLabel(a.harness)), h(modelLabel(a.model))]) + "</span></div>" + (live ? statusBadge(live) : "") + "</div>" +
      '<p class="muted">' + h(a.desc) + "</p>" +
      '<div class="acard-m"><div><span class="k">This month</span><b class="num">' + money(spent) + "</b></div></div>" +
      '<dl class="kv"><dt>Runs on</dt><dd>' + h(a.where) + '</dd><dt>Operator</dt><dd>' + h(personName(a.operator)) + "</dd><dt>Sessions</dt><dd>" + num(ss.length) + (last ? ", last " + when(last.started) : "") + '</dd><dt>File</dt><dd class="mono">' + h(agentFile(a)) + "</dd></dl></button>";
  }).join("");
  return { crumb: [["Agents"]], html: head + '<div class="grid acards">' + cards + "</div>" };
};
ACTS.agent = function (el) { openDrawer("agent", el.getAttribute("data-key")); };
DRAWERS.agent = function (key) {
  var a = agentBy(key), ss = sessions().filter(function (s) { return s.agent === key; }), sv = Ledger.toolServers(LEDGER_F, F.ORG.now);
  var spent = ss.reduce(function (t, s) { return t + s.cost.total; }, 0);
  return { title: a.name,
    head: '<div class="grow row">' + agentAv(a, 34) + '<div><h2>' + h(a.name) + '</h2><span class="muted">' + pts([hxIcon(a.harness, 12) + " " + h(hxLabel(a.harness)) + " " + h(a.harnessV), h(modelLabel(a.model))]) + "</span></div></div>",
    body: '<p>' + h(a.desc) + '</p><div class="grid g3 tiles">' + stat("This month", money(spent), "") + stat("Sessions", num(ss.length), "in September") + stat("Last session", ss[0] ? when(ss[0].started) : "None yet", "") + "</div>" +
      '<h3 class="sec">File</h3><div class="readout"><div class="rh"><span class="mono">' + h(agentFile(a)) + '</span></div><pre>' + h(agentToml(a)) + "</pre></div>" +
      '<p class="muted small">Cedar reads this file as the principal <code>Agent::"a-intel.core.' + h(a.key) + '"</code>. A run\'s steering comes from its code repository.</p>' +
      '<h3 class="sec">MCP servers</h3><p class="muted small">Every agent in the workspace gets the imported tools of these servers, and policies narrow what it may call.</p><div class="lst">' + sv.map(function (x) { var one = serverBy(x.id); return '<button class="li linkish" data-act="server" data-id="' + x.id + '">' + serverMark(one, 22) + '<span class="bd2"><span class="t1">' + h(one.name) + '</span><span class="t2">' + h(one.auth) + "</span></span>" + g("right", 14) + "</button>"; }).join("") + "</div>" +
      '<h3 class="sec">Recent sessions</h3><div class="lst">' + ss.slice(0, 6).map(sessRowCompact).join("") + "</div>" +
      '<h3 class="sec">Where it runs</h3><dl class="kv"><dt>Runtime</dt><dd class="mono">' + h(a.host) + "</dd><dt>Operator</dt><dd>" + h(personName(a.operator)) + "</dd><dt>Connected</dt><dd>" + h(a.enrolled) + "</dd></dl>" };
};
ACTS.connect = function () { openDialog("connect"); };
DIALOGS.connect = function (arg, d) {
  d.h = d.h || "claude-code";
  var cmd = "oxagen agent enroll --token otk_7Q2M4XJ9 --harness " + (d.h === "codex-cli" ? "codex" : d.h);
  return { title: "Connect an agent", sub: "Run this where the agent runs: a laptop, a CI runner or a server. The agent keeps running there.",
    body: '<div class="field"><label>Harness</label><div class="seg wide">' + ["claude-code", "codex-cli", "cursor", "stella"].map(function (k) {
      return '<button class="btn sm" data-act="connect-h" data-h="' + k + '" aria-pressed="' + (d.h === k) + '">' + hxIcon(k, 14) + " " + h(hxLabel(k)) + "</button>";
    }).join("") + '</div></div><div class="field"><label>Command</label><div class="cmdline"><code>' + h(cmd) + "</code>" + copyBtn(cmd) + '</div><div class="hint">The token works once and expires in 24 hours.</div></div>' +
      '<div class="note">Enrolling opens a steering PR that adds the agent\'s file to <code>agents/</code>. Until it merges, the agent runs under the workspace\'s policies alone. oxagen records every session from then on.</div>',
    foot: '<span class="grow muted">Waiting for the first session…</span><button class="btn" data-act="close">Close</button><button class="btn primary" data-act="connect-done">I ran it</button>' };
};
ACTS["connect-h"] = function (el) { S.dialog.h = el.getAttribute("data-h"); renderLayer(); };
ACTS["connect-done"] = function () { S.connected = true; closeDialog(); toast("Connected. The first session will show up in Sessions."); render(); };

/* ============================== Steering ==============================
   Records, steering PRs and the steering repo (steering-repo-spec.html). The Steering list is one
   row of tabs. A steering PR opens as its own page, steering/pr-<n>, with no tabs of its own. */
var KINDS = { "business-rule": "Business rule", "code-rule": "Code rule", constraint: "Constraint", procedure: "Procedure", skill: "Skill", fact: "Fact", preference: "Preference", memory: "Memory" };
function kindLabel(k) { return KINDS[k] || k; }
function kindBadge(k, pre) { return '<span class="kind k-' + h(k) + '">' + h((pre || "") + (pre ? kindLabel(k).toLowerCase() : kindLabel(k))) + "</span>"; }
function recLabel(it) { return it.label || it.title || it.text; }
function tabRow(act, cur, tabs) {
  return '<div class="tabs" role="tablist">' + tabs.map(function (t) {
    return '<button class="tab" role="tab" data-act="' + act + '" data-tab="' + t[0] + '" aria-selected="' + (cur === t[0]) + '">' + h(t[1]) + (t[2] != null ? '<span class="n">' + t[2] + "</span>" : "") + "</button>";
  }).join("") + "</div>";
}
var HEALTH_BADGE = { healthy: ["b-allowed", "Healthy"], drifted: ["b-denied", "Drifted"], disconnected: ["b-failed", "Disconnected"], diverged: ["b-failed", "Diverged"] };
function healthBadge() { var b = HEALTH_BADGE[S.health]; return badge(b[0], b[1], true); }
function repoLink(name, url) { return '<a class="mono" href="' + h(url || "https://github.com/" + name) + '" target="_blank" rel="noopener">' + h(name) + "</a>"; }

/* The banner on every page while the steering repo is not healthy (steering-repo-spec.html, Settings
   drift). Repair settings is for admins. Reconnecting the app is for an organization admin. */
function healthBanner() {
  if (S.health === "healthy" || S.empty) return "";
  var st = REPO.health[S.health], me = viewer(), act = "";
  var title = { drifted: "The steering repo's settings changed", disconnected: "oxagen lost access to the steering repo", diverged: "The steering repo has a commit oxagen did not merge" }[S.health];
  if (S.health === "drifted") act = isWsAdmin(me) ? '<button class="btn sm primary" data-act="repair">Repair settings</button>' : '<span class="muted small">' + h(st.notAdmin) + "</span>";
  if (S.health === "disconnected") act = isOrgAdmin(me) ? '<button class="btn sm primary" data-act="reconnect">Reconnect</button>' : '<span class="muted small">' + h(personName(st.admin)) + ", an organization admin, reconnects it.</span>";
  if (S.health === "diverged") act = '<button class="btn sm primary" data-go="steering|pr-' + st.revertPr + '">Open revert PR #' + st.revertPr + "</button>";
  return '<div class="banner health-b hb-' + S.health + '" role="alert"><span class="d"></span><div class="grow"><b>' + h(title) + "</b>" +
    '<ul class="hb-list">' + st.diffs.map(function (x) { return "<li>" + mdi(x) + "</li>"; }).join("") + "</ul>" +
    '<p class="small">' + mdi(st.effect) + " " + mdi(st.fix) + "</p></div>" + act + "</div>";
}
ACTS.repair = function () { S.health = "healthy"; toast("Settings repaired. oxagen read them back, and they match."); render(); };
ACTS.reconnect = function () { S.health = "healthy"; toast("Reconnected. oxagen can read, merge, and publish again."); render(); };

VIEWS.steering = function () {
  if (S.id) return steeringPrView(S.id);
  var head = phead("Steering", "What every agent is told, from the workspace's steering repo.",
    '<button class="btn" data-act="steerimport">' + g("import", 14) + ' Import</button><button class="btn primary" data-act="newsteer">' + g("plus", 14) + " New record</button>");
  if (S.empty && !S.imported.steering && S.importPr.steering) return { crumb: [["Steering"]], html: head + importPending("steering") };
  if (S.empty && !S.imported.steering) return { crumb: [["Steering"]], html: head + empty("steering", "Nothing here yet", "Import CLAUDE.md, AGENTS.md and Cursor rules from your repositories. oxagen merges them into one list, drops the duplicates and asks you about the conflicts.", '<button class="btn primary" data-act="steerimport">Import steering</button>') };
  var open = allPrs().filter(function (p) { return p.state !== "merged"; }).length;
  var tabs = tabRow("steertab", S.steerTab, [["records", "Records", steeringItems().length], ["prs", "Steering PRs", open], ["repo", "Repository"]]);
  var body = S.steerTab === "prs" ? steeringPrList() : S.steerTab === "repo" ? steeringRepoTab() : steeringRecords();
  return { crumb: [["Steering"]], html: head + tabs + '<div class="stack">' + body + "</div>" };
};
ACTS.steertab = function (el) { S.steerTab = el.getAttribute("data-tab"); render(); };

/* The steering repo card: the repository, the published version, and health. */
function repoCard() {
  var open = allPrs().filter(function (p) { return p.state !== "merged"; }).length, org = steeringItems().filter(function (i) { return i.scope === "organization"; }).length;
  return '<div class="panel repocard"><div class="rc-main">' + ipLogo("github", 20) + '<div class="grow"><span class="k">Steering repo</span>' + repoLink(REPO.name, REPO.url) +
      '<span class="sub">' + pts(["Published version " + REPO.version, '<a href="' + href("steering", "pr-" + REPO.publishedPr) + '" data-go="steering|pr-' + REPO.publishedPr + '">Steering PR #' + REPO.publishedPr + "</a>", when(REPO.published)]) + "</span></div>" + healthBadge() + "</div>" +
    '<dl class="rc-facts"><div><dt>Required check</dt><dd><code>Oxagen steering</code></dd></div><div><dt>Review</dt><dd>' + h(REPO.governance.mode === "team" ? "Team mode" : REPO.governance.mode) + "</dd></div>" +
      '<div><dt>Open steering PRs</dt><dd><button class="linkbtn" data-act="steertab" data-tab="prs">' + num(open) + "</button></dd></div>" +
      '<div><dt>Linked repositories</dt><dd><button class="linkbtn" data-act="steertab" data-tab="repo">' + num(REPO.linked.length) + "</button></dd></div>" +
      '<div><dt>From ' + h(REPO.org.name) + "</dt><dd>" + plural(org, "record") + "</dd></div></dl></div>";
}
function scopeCell(it) {
  if (it.scope === "organization") return '<span class="chip org">' + h(REPO.org.name) + '</span><span class="sub">Every workspace inherits it</span>';
  if (it.scope === "repository") return (it.repos || []).map(function (r) { return '<span class="chip mono">' + h(r.replace(/^github\.com\//, "")) + "</span>"; }).join(" ");
  return "";
}
/* A record's Applies to: its steering-record/v1 targets (repos, tools, skills, and applies_to path
   globs). A record with none reaches every run in the workspace. */
function skillByLineage(l) { return STEERING.items.filter(function (i) { return i.kind === "skill" && i.lineage === l; })[0]; }
function targetCell(it) {
  if (it.scope === "organization") return scopeCell(it);
  if (it.kind === "memory") return '<span class="muted">Recalled when relevant</span>';
  var chip = function (k, v) { return '<span class="chip"><span class="ck">' + k + '</span><span class="mono">' + h(v) + "</span></span>"; };
  var out = [].concat(
    (it.repos || []).map(function (r) { return chip("Repo", r.replace(/^github\.com\//, "")); }),
    (it.tools || []).map(function (t) { return chip("Tool", t); }),
    (it.skills || []).map(function (l) { var sk = skillByLineage(l); return chip("Skill", sk ? recLabel(sk) : l); }),
    (it.applies_to || []).map(function (g) { return chip("Path", g); }));
  return out.length ? '<span class="tgts">' + out.join("") + "</span>" : '<span class="muted">Every run</span>';
}
/* A suggestion changes steering only through a steering PR. Accepting one opens that PR, and the
   record reaches sessions once it merges. */
function suggestionOpen(sg) { var n = S.accepted[sg.id], pr = n && prBy(n); return !S.dismissed[sg.id] && !(pr && pr.state === "merged"); }
function acceptSuggestion(id) {
  var sg = STEERING.suggestions.filter(function (x) { return x.id === id; })[0], n = nextPrNumber();
  var body = ["---", "schema: steering-record/v1", "lineage: " + sg.lineage, "label: " + sg.label, "kind: " + sg.kind, "force: " + sg.force, "scope: workspace", "status: active", "origin: inferred", "---", "", sg.text].join("\n");
  var rec = { lineage: sg.lineage, label: sg.label, kind: sg.kind, force: sg.force, scope: "workspace", repos: null, tools: [], applies_to: [], skills: [], text: sg.text, tok: sg.tok, path: "steering/platform/" + sg.lineage + ".md", body: body };
  var over = budgetRows(rec).some(function (r) { return r.over; });
  S.newPrs.push({ n: n, kind: "record", state: "open", title: "Add " + sg.label, branch: "steering/" + sg.lineage.split(".").slice(2).join("-"), by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Adds one record from a suggestion. Sessions get it once this merges and oxagen publishes the next version. oxagen writes its id and hash when it merges.",
    record: rec,
    checks: [{ id: "schema", r: "pass" }, { id: "lineage", r: "pass" }, { id: "secrets", r: "pass" }, { id: "conflicts", r: "pass" }, { id: "authority", r: "pass" }, { id: "budget", r: over ? "warn" : "pass" }, { id: "owned", r: "pass" }] });
  S.accepted[id] = n;
  return n;
}
function steeringRecords() {
  var items = steeringItems(), sugg = STEERING.suggestions.filter(suggestionOpen);
  var sugHtml = sugg.map(function (sg) {
    var from = sg.from, T = F.TRANSCRIPTS[from.session], why;
    if (from.said) why = h(personName(from.by)) + " told " + h(agentBy(T.agent).name) + " “" + h(from.said) + "” in " + '<a href="' + href("sessions", from.session) + '" data-go="sessions|' + from.session + '">' + h(T.title) + "</a>.";
    else why = h(agentBy(T.agent).name) + " failed the release notes lint in " + from.sessions + " of its last 5 sessions. The fix-up in " + '<a href="' + href("sessions", from.session) + '" data-go="sessions|' + from.session + '">' + h(T.title) + "</a> cost " + money(suggestionFixup(sg)) + ".";
    var acts = S.accepted[sg.id] ? '<a class="btn sm" href="' + href("steering", "pr-" + S.accepted[sg.id]) + '" data-go="steering|pr-' + S.accepted[sg.id] + '">View steering PR #' + S.accepted[sg.id] + "</a>" :
      '<button class="btn sm primary-soft" data-act="sug-add" data-id="' + sg.id + '">Open steering PR</button><button class="btn sm ghost" data-act="sug-dismiss" data-id="' + sg.id + '">Dismiss</button>';
    return '<div class="sug"><div class="grow">' + kindBadge(sg.kind, "Suggested ") + '<p class="sug-t">' + h(sg.text) + '</p><p class="muted small">' + why + '</p></div><div class="row">' + acts + "</div></div>";
  }).join("");
  // The steering block depends on the run's code repository, so the range runs over the linked ones.
  var totals = REPO.linked.map(function (r) { return Ledger.sum(steeringNext(r.url)); });
  var lo = Math.min.apply(null, totals), hi = Math.max.apply(null, totals);
  var monthCost = sessions().reduce(function (t, s) { var c = 0; for (var k in s.cost.by) if (k === "steering" || k === "memory" || /^skill:/.test(k)) c += s.cost.by[k]; return t + c; }, 0);
  var rows = items.map(function (it) {
    var st = steeringStats(it);
    return '<tr class="click" data-act="steeritem" data-id="' + it.id + '"><td>' + kindBadge(it.kind) + '<span class="sub">' + h(it.force || "") + '</span></td><td><span class="stx">' + h(recLabel(it)) + "</span>" + (it.label || it.title ? '<span class="sub">' + h(it.text) + "</span>" : "") + (it.fresh ? ' <span class="b b-allowed">New</span>' : "") + "</td>" +
      '<td class="mh">' + targetCell(it) + "</td>" +
      '<td class="num">' + num(it.tok) + '</td><td class="num mh">' + (it.kind === "skill" ? plural(st.loads, "load") : plural(st.sessions, "session")) + '</td><td class="num">' + money(st.cost) + "</td></tr>";
  }).join("");
  return repoCard() + (sugHtml ? '<div class="panel sugs"><div class="panel-h"><h3>Suggestions from sessions</h3><span class="sp muted">' + plural(sugg.length, "suggestion") + "</span></div>" + sugHtml + "</div>" : "") +
    '<div class="panel"><div class="panel-h"><h3>Records</h3><span class="sp muted">Each session starts with ' + (lo === hi ? num(lo) : num(lo) + " to " + num(hi)) + " tokens of steering, by code repository. Steering cost " + money(monthCost) + ' this month.</span></div><div class="tw"><table><thead><tr><th>Kind</th><th>Record</th><th class="mh">Applies to</th><th class="num">Tokens</th><th class="num mh">This month</th><th class="num">Cost</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
}
ACTS["sug-add"] = function (el) { var n = acceptSuggestion(el.getAttribute("data-id")); go("steering", "pr-" + n); toast("Opened steering PR #" + n + ". Sessions get the record once it merges."); };
ACTS["sug-dismiss"] = function (el) { S.dismissed[el.getAttribute("data-id")] = true; render(); };

/* ---- the Steering PRs tab ---- */
var CHECK_BADGE = { pass: ["b-allowed", "Passed"], warn: ["b-approval", "Warning"], fail: ["b-failed", "Failed"], skip: ["b-q", "Skipped"] };
function prCheckRollup(pr) {
  var rs = (pr.checks || []).map(function (c) { return c.r; });
  if (rs.indexOf("fail") >= 0) return "fail";
  if (S.health !== "healthy" && pr.state !== "merged") return "fail";
  return rs.indexOf("warn") >= 0 ? "warn" : "pass";
}
function prStateBadge(pr) {
  var st = prState(pr);
  if (st === "merged") return badge("b-proven", "Merged", true);
  if (st === "queued") return badge("b-approval", "Queued " + (S.queue.indexOf(pr.n) + 1), true);
  return badge("b-q", "Open");
}
function steeringPrList() {
  var rows = allPrs().map(function (pr) {
    var ck = CHECK_BADGE[prCheckRollup(pr)], apv = prApprovals(pr);
    return '<tr class="click" data-go="steering|pr-' + pr.n + '"><td class="num mono">#' + pr.n + '</td><td><span class="stx">' + h(pr.title) + '</span><span class="sub mono">' + h(pr.branch) + "</span></td>" +
      '<td class="mh">' + h(PR_KIND[pr.kind] || pr.kind) + '</td><td class="mh">' + h(authorLabel(pr)) + "</td><td>" + badge(ck[0], ck[1]) + '</td><td class="mh">' + (apv.length ? plural(apv.length, "approval") : '<span class="muted">Waiting</span>') + "</td><td>" + prStateBadge(pr) + "</td></tr>";
  }).join("");
  return '<div class="panel"><div class="panel-h"><h3>Steering PRs</h3><span class="sp muted">A change takes effect only when its steering PR merges.</span></div><div class="tw"><table><thead><tr><th class="num">PR</th><th>Steering PR</th><th class="mh">Kind</th><th class="mh">Opened by</th><th>Checks</th><th class="mh">Review</th><th>State</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
}

/* ---- the Repository tab ---- */
function steeringRepoTab() {
  var dr = S.health === "drifted" ? REPO.health.drifted.settings : [], gov = REPO.governance, me = viewer();
  var settings = REPO.settings.map(function (x, i) {
    var bad = dr.indexOf(i) >= 0 || (S.health === "disconnected");
    return "<tr><td>" + mdi(x.name) + '</td><td class="mh">' + mdi(x.want) + "</td><td>" + (bad ? badge("b-denied", S.health === "disconnected" ? "Unreadable" : "Differs", true) : badge("b-allowed", "Matches", true)) + "</td></tr>";
  }).join("");
  var repair = S.health === "drifted" && isWsAdmin(me) ? '<button class="btn sm primary" data-act="repair">Repair settings</button>' : "";
  var linked = REPO.linked.map(function (r) {
    return '<tr><td class="mono">' + h(r.url) + '</td><td class="mh">' + h(r.since) + "</td><td>" + (r.also.length ? "Also in " + h(r.also.join(", ")) : '<span class="muted">Only this workspace</span>') + "</td></tr>";
  }).join("");
  var orgRecs = steeringItems().filter(function (i) { return i.scope === "organization"; }).map(function (i) {
    return '<button class="li linkish" data-act="steeritem" data-id="' + i.id + '">' + kindBadge(i.kind) + '<span class="bd2"><span class="t1">' + h(recLabel(i)) + '</span><span class="t2 mono">' + h(i.lineage) + '</span></span><span class="muted num">' + num(i.tok) + " tok</span></button>";
  }).join("");
  var versions = REPO.versions.map(function (v) {
    var inner = '<span class="mono muted">v' + v.v + '</span><span class="bd2"><span class="t1">' + h(v.what) + '</span><span class="t2">' + pts(["Steering PR #" + v.pr, when(v.at)]) + "</span></span>";
    return prBy(v.pr) ? '<a class="li" href="' + href("steering", "pr-" + v.pr) + '" data-go="steering|pr-' + v.pr + '">' + inner + "</a>" : '<div class="li">' + inner + "</div>";
  }).join("");
  return '<div class="grid g2">' +
    '<div class="panel"><div class="panel-h"><h3>Steering repo</h3><span class="sp">' + healthBadge() + '</span></div><div class="panel-b"><dl class="kv">' +
      "<dt>Repository</dt><dd>" + repoLink(REPO.name, REPO.url) + "</dd><dt>Created</dt><dd>" + h(REPO.created) + ", with the workspace</dd>" +
      "<dt>Published version</dt><dd>" + REPO.version + "</dd><dt>Required check</dt><dd><code>Oxagen steering</code>, posted by the oxagen app only</dd>" +
      "<dt>Merges</dt><dd>Only oxagen updates <code>main</code>, one steering PR at a time</dd><dt>Environment</dt><dd><code>steering</code></dd></dl></div></div>" +
    '<div class="panel"><div class="panel-h"><h3>Governance</h3></div><div class="panel-b"><dl class="kv">' +
      "<dt>Mode</dt><dd>" + h(gov.mode === "team" ? "Team: one approval from a member other than the author" : gov.mode) + "</dd>" +
      "<dt>Reviewer groups</dt><dd>" + gov.reviewers.map(function (r) { return "<code>" + h(r.group) + "</code> reviews " + r.paths.map(function (p) { return "<code>" + h(p) + "</code>"; }).join(" and "); }).join("<br>") + "</dd>" +
      "<dt>Always-on budget</dt><dd>" + (gov.always_on_tokens === "off" ? "Off. The budget check does not run." : gov.always_on_tokens ? num(gov.always_on_tokens) + " tokens per code repository. The budget check warns past it and never blocks." : "Not set. The workspace inherits oxagen's default of " + num(gov.defaultBudget) + " tokens per code repository, which only warns.") + "</dd>" +
      "<dt>Memory</dt><dd>A memory PR once a day, or when " + num(gov.memory.batch_size) + " memories wait. A memory no run recalled in " + num(gov.memory.retire_after_days) + " days is proposed for archiving. " + (gov.memory.recall_unreviewed === "off" ? "An unreviewed memory steers nothing." : "An unreviewed memory steers only the agent that wrote it, at force <code>info</code>.") + " " + (gov.memory.auto_merge ? "Memory PRs merge on their own." : "A person merges each memory PR.") + "</dd>" +
      "<dt>Ledger</dt><dd>A new file each " + h(gov.ledger.rotate) + ", or at " + num(gov.ledger.max_lines) + " lines</dd></dl></div></div></div>" +
    '<div class="panel"><div class="panel-h"><h3>Settings oxagen holds</h3><span class="sp">' + repair + '</span></div><div class="tw"><table><thead><tr><th>Setting</th><th class="mh">Prescribed</th><th>Now</th></tr></thead><tbody>' + settings + "</tbody></table></div></div>" +
    '<div class="panel"><div class="panel-h"><h3>Linked code repositories</h3><span class="sp"><button class="btn sm" data-act="linkrepo">' + g("plus", 13) + ' Link a repository</button></span></div><div class="tw"><table><thead><tr><th>Repository</th><th class="mh">Linked</th><th>Workspaces</th></tr></thead><tbody>' + linked + '</tbody></table></div><p class="muted small pad-s">Linking opens a steering PR that adds the repository to <code>workspace.toml</code>. A repository can belong to many workspaces.</p></div>' +
    '<div class="grid g2"><div class="panel"><div class="panel-h"><h3>Organization records</h3><span class="sp muted">' + repoLink(REPO.org.name, REPO.org.url) + '</span></div><div class="panel-b"><p class="muted small">Every workspace in ' + h(ORG.slug) + " inherits these. A narrower record may narrow one and never widens it.</p>" + (orgRecs ? '<div class="lst">' + orgRecs + "</div>" : "") + "</div></div>" +
    '<div class="panel"><div class="panel-h"><h3>Published versions</h3></div><div class="panel-b"><div class="lst">' + versions + "</div></div></div></div>";
}

/* ---- one steering PR ---- */
function steeringPrView(id) {
  var n = parseInt(String(id).replace(/^pr-/, ""), 10), pr = prBy(n);
  if (!prVisible(n)) return { crumb: [["Steering", "steering"], ["Steering PR"]], html: empty("steering", "No steering PRs yet", "Import steering first. Every change after that arrives as a steering PR.", '<button class="btn" data-go="steering">Steering</button>') };
  if (!pr) return { crumb: [["Steering", "steering"], ["Not found"]], html: empty("steering", "No steering PR with that number", "It may be in another workspace's steering repo.", '<button class="btn" data-go="steering">Steering</button>') };
  var st = prState(pr), me = viewer(), apv = prApprovals(pr);
  var meta = '<div class="smeta"><span class="mono">' + h(pr.branch) + "</span><span>" + h(authorLabel(pr)) + "</span><span>Opened " + when(pr.opened) + "</span>" + (pr.session ? '<a href="' + href("sessions", pr.session) + '" data-go="sessions|' + pr.session + '">From a session</a>' : "") + "</div>";
  var acts = prStateBadge(pr);
  if (st === "merged") acts += '<button class="btn" data-act="pr-revert" data-n="' + pr.n + '">Revert</button>';
  else {
    if (govMode() !== "solo" && canApprove(pr) && apv.indexOf(me) < 0) acts += '<button class="btn" data-act="pr-approve" data-n="' + pr.n + '">Approve</button>';
    if (st !== "queued") acts += '<button class="btn primary" data-act="pr-merge" data-n="' + pr.n + '"' + (apv.length || govMode() === "solo" || canMergeWithoutReview(me) ? "" : " disabled") + ">" + (pr.kind === "memory" ? "Merge " + plural(pr.memories.filter(function (m) { return !S.dropped[pr.n + "." + m.id]; }).length, "memory", "memories") : "Merge") + "</button>";
  }
  var head = '<div class="shead"><div class="t"><p class="eyebrow">Steering PR #' + pr.n + "</p><h1>" + h(pr.title) + "</h1>" + meta + '</div><div class="acts">' + acts + "</div></div>";
  var main = (pr.summary ? '<p class="pr-sum">' + mdi(pr.summary) + "</p>" : "");
  if (pr.state === "merged") main += '<div class="banner"><div class="grow"><b>Published as version ' + pr.version + "</b>oxagen squash-merged it at the checked commit " + when(pr.merged) + '. Revert opens a steering PR that undoes it, with the same checks and review.</div></div><pre class="trailers">' + h((pr.trailers || []).join("\n")) + "</pre>";
  if (pr.kind === "memory") main += memoryCards(pr);
  if (pr.server && pr.diff) main += surfaceDiff(pr, true);
  if (pr.record) main += '<div class="panel"><div class="panel-h"><h3>Record</h3><span class="sp">' + kindBadge(pr.record.kind) + ' <span class="muted mono">' + h(pr.record.force) + '</span> <span class="muted">' + num(pr.record.tok) + ' tokens</span></span></div><div class="panel-b"><div class="readout"><div class="rh"><span class="mono">' + h(pr.record.path) + '</span></div><pre>' + h(pr.record.body) + "</pre></div></div></div>";
  (pr.files || []).forEach(function (f) { if (f.diff) main += '<div class="readout"><div class="rh"><span class="mono">' + h(f.path) + '</span></div><pre class="diff">' + diffHtml(f.diff) + "</pre></div>"; });
  if (pr.note) main += '<p class="note">' + mdi(pr.note) + "</p>";
  main += checksPanel(pr);
  var side = reviewPanel(pr) + queuePanel(pr) + filesPanel(pr);
  return { crumb: [["Steering", "steering"], ["Steering PR #" + pr.n]], html: head + '<div class="split prgrid"><div class="prmain">' + main + '</div><aside class="prside">' + side + "</aside></div>" };
}
function diffHtml(text) {
  return String(text).split("\n").map(function (l) { var c = l[0] === "+" ? "add" : l[0] === "-" ? "del" : ""; return c ? '<span class="' + c + '">' + h(l) + "</span>" : h(l); }).join("\n");
}
function checksPanel(pr) {
  var roll = prCheckRollup(pr), rb = CHECK_BADGE[roll];
  var rows = (pr.checks || []).map(function (c) {
    var b = CHECK_BADGE[c.r], extra = "";
    if (c.id === "budget" && pr.record && pr.state !== "merged") extra = budgetDetail(pr.record);
    return '<div class="ck"><span class="ck-n mono">' + h(c.id) + "</span>" + badge(b[0], b[1]) + '<div class="grow"><span class="muted small">' + mdi(c.note || STEERING.checkNames[c.id] || "") + "</span>" + extra + "</div></div>";
  }).join("");
  if (S.health !== "healthy" && pr.state !== "merged") rows = '<div class="ck"><span class="ck-n mono">settings</span>' + badge("b-failed", "Failed") + '<div class="grow"><span class="muted small">The repository settings differ from the prescribed ones. oxagen will not merge or publish until they match.</span></div></div>' + rows;
  var findings = (pr.findings || []).map(function (f) {
    return '<div class="ck"><span class="ck-n">' + badge(f.level === "error" ? "b-failed" : f.level === "warning" ? "b-approval" : "b-q", f.level === "error" ? "Error" : f.level === "warning" ? "Warning" : "Info") + '</span><div class="grow small">' + mdi(f.text) + "</div></div>";
  }).join("");
  return '<div class="panel"><div class="panel-h"><h3>Checks</h3><span class="sp"><code>Oxagen steering</code> ' + badge(rb[0], roll === "warn" ? "Passed with warnings" : rb[1], true) + "</span></div>" + rows +
    (findings ? '<div class="panel-h sub-h"><h3>Tool checks</h3></div>' + findings : "") + "</div>";
}
/* The budget check: per code repository, the always-on steering before and after, the budget and
   where it comes from, and the largest always-on records with their token counts. It only warns. */
function budgetDetail(rec) {
  return budgetRows(rec).map(function (r) {
    var line = !r.adds ? "The record loads with a skill, on a matching path, or when it fits, so it adds nothing to the always-on total." : r.over ? (r.set ? "Over the workspace budget. The check warns and passes." : "Over oxagen's default of " + num(r.budget) + " tokens. The default only warns, so the check passes.") : "Under the budget.";
    return '<div class="budget"><div class="bd-h"><b>Always-on steering</b> <span class="mono muted">' + h(r.repo) + '</span></div><div class="bd-n"><span>Before <b class="num">' + num(r.before) + '</b></span><span>After <b class="num">' + num(r.after) + '</b></span><span>Budget <b class="num">' + num(r.budget) + "</b> " + (r.set ? "<code>steering/governance.toml</code>" : "oxagen's default") + "</span></div>" +
      '<div class="capbar' + (r.over ? " over" : "") + '"><i style="width:' + Math.min(100, r.after / r.budget * 100).toFixed(1) + '%"></i></div><p class="small">' + h(line) + "</p>" +
      '<table class="narrow mini"><thead><tr><th class="num">Tokens</th><th>Largest always-on records</th><th class="mh">Kind</th></tr></thead><tbody>' + r.largest.map(function (x) {
        return '<tr><td class="num">' + num(x.tok) + '</td><td class="mono">' + h(x.lineage) + (x.fresh ? ' <span class="b b-approval">This PR</span>' : "") + '</td><td class="mh">' + h(kindLabel(x.kind)) + ", " + h(x.force) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      (r.over ? '<p class="small muted">To keep this cost, merge as is, or raise <code>always_on_tokens</code> in this PR. To cut it, shorten a record, set <code>force: may</code> so it loads when it fits, or narrow it with <code>repos</code>, <code>tools</code>, <code>skills</code>, or <code>applies_to</code>.</p>' : "") + "</div>";
  }).join("");
}
function reviewPanel(pr) {
  var gov = REPO.governance, groups = prReviewers(pr), apv = prApprovals(pr);
  if (govMode() === "solo" || pr.solo) return '<div class="panel pad"><div class="rl-h"><h3>Review</h3><span class="muted">Solo mode</span></div><p class="small">' + (pr.state === "merged" ? "Merged without an approval step, as solo mode allows." : "No approval step. A merged steering PR counts as approved.") + "</p></div>";
  var need = groups.length ? "One approval from " + groups.map(function (gr) { return "<code>" + h(gr.group) + "</code> (" + h(gr.members.map(personName).join(" or ")) + ")"; }).join(" and ") + "." : "One approval from a workspace member other than the author.";
  return '<div class="panel pad"><div class="rl-h"><h3>Review</h3><span class="muted">' + h(gov.mode === "team" ? "Team mode" : gov.mode) + '</span></div><p class="small">' + need + "</p>" +
    (apv.length ? '<div class="lst">' + apv.map(function (p) { return '<div class="li">' + personAv(p, 22) + '<span class="bd2"><span class="t1">' + h(personName(p)) + '</span><span class="t2">Approved in oxagen</span></span></div>'; }).join("") + "</div>" : '<p class="muted small">No approval yet.</p>') +
    (pr.state !== "merged" && !canApprove(pr) && pr.by !== viewer() ? '<p class="muted small">You are not in the group that reviews this path.</p>' : "") +
    (S.noReview[pr.n] ? '<p class="small">' + h(personName(S.noReview[pr.n])) + " merges it without review. The merge commit records it.</p>" :
      pr.state !== "merged" && !apv.length && canMergeWithoutReview(viewer()) ? '<p class="small muted">As the workspace owner, you can merge without review. The required check still has to pass, and the merge commit records you.</p>' : "") + "</div>";
}
function queuePanel(pr) {
  if (pr.state === "merged") return "";
  var pos = S.queue.filter(prVisible).indexOf(pr.n);
  var list = S.queue.filter(prVisible).map(function (k, i) { var p = prBy(k); return '<div class="li"><span class="mono muted">' + (i + 1) + '</span><span class="bd2"><span class="t1">#' + k + " " + h(p ? p.title : "") + "</span></span></div>"; }).join("");
  return '<div class="panel pad"><div class="rl-h"><h3>Merge queue</h3><span class="muted">' + (pos >= 0 ? "Position " + (pos + 1) : "Not queued") + '</span></div><p class="small muted">oxagen merges one steering PR at a time. When <code>main</code> moves, it brings the next one up to date and checks it again, so the budget and conflicts checks judge the <code>main</code> it lands on.</p>' +
    (list ? '<div class="lst">' + list + "</div>" : "") + "</div>";
}
function filesPanel(pr) {
  var files = pr.record ? [pr.record.path] : pr.kind === "memory" ? pr.memories.filter(function (m) { return !S.dropped[pr.n + "." + m.id]; }).map(function (m) { return "steering/memory/" + m.lineage.split(".")[1] + "/" + m.lineage + ".md"; }) : (pr.files || []).map(function (f) { return f.path || f; });
  return '<div class="panel pad"><div class="rl-h"><h3>Files</h3><span class="muted">' + plural(files.length, "file") + '</span></div><div class="flist">' + files.map(function (f) { return '<span class="mono">' + h(f) + "</span>"; }).join("") + "</div></div>";
}
/* The memory PR: each memory with the sessions it came from, and Drop. */
function memoryCards(pr) {
  return '<div class="panel"><div class="panel-h"><h3>Memories</h3><span class="hnote">Each kept item lands as a memory, or as a rule or a fact when that fits better.</span></div>' + pr.memories.map(function (m) {
    var k = pr.n + "." + m.id, dropped = !!S.dropped[k], a = agentBy(m.agent), c = m.contradicts ? steeringItems().filter(function (i) { return i.id === m.contradicts; })[0] : null;
    var ev = m.evidence.map(function (e) {
      var s = sessionBy(e.s);
      return '<a class="li" href="' + href("sessions", e.s) + '" data-go="sessions|' + e.s + '">' + agentAv(a, 20) + '<span class="bd2"><span class="t1">' + h(s ? s.title : e.s) + '</span><span class="t2">' + pts([s ? when(s.started) : "", "Frame " + e.frame]) + "</span></span></a>";
    }).join("");
    return '<div class="mem' + (dropped ? " dropped" : "") + '"><div class="mem-h">' + kindBadge("memory") + '<span class="mono muted small">' + h(m.lineage) + '</span><span class="sp">' +
        (pr.state === "merged" ? "" : dropped ? '<button class="btn sm" data-act="mem-keep" data-k="' + k + '">Keep it</button>' : '<button class="btn sm danger" data-act="mem-drop" data-k="' + k + '">Drop</button>') + "</span></div>" +
      '<p class="mem-t">' + h(m.text) + '</p><div class="mem-meta">' + pts([h(a.name), m.repos.map(function (r) { return h(r); }).join(", "), num(m.tok) + " tokens", "Lands as " + kindLabel(m.lands || "memory").toLowerCase(), plural(m.evidence.length, "evidence session")]) + "</div>" +
      (c ? '<div class="warn small"><b>Contradicts an active record.</b> ' + h(recLabel(c)) + ' (<code>' + h(c.lineage) + "</code>) says: " + h(c.text) + "</div>" : "") +
      (dropped ? '<p class="small muted">Dropped. oxagen pushes a commit that removes the file and records the rejection, so the lesson returns only with new evidence.</p>' : '<h4 class="ev-h">Evidence</h4><div class="lst">' + ev + "</div>") + "</div>";
  }).join("") + "</div>";
}
ACTS["mem-drop"] = function (el) { S.dropped[el.getAttribute("data-k")] = true; render(); };
ACTS["mem-keep"] = function (el) { delete S.dropped[el.getAttribute("data-k")]; render(); };
ACTS["pr-approve"] = function (el) { S.approved[+el.getAttribute("data-n")] = viewer(); toast("Approved."); render(); };
ACTS["pr-merge"] = function (el) {
  var n = +el.getAttribute("data-n");
  if (govMode() === "solo") { mergeFirstRun(prBy(n)); return; }
  var bare = !prApprovals(prBy(n)).length;
  if (bare) S.noReview[n] = viewer();
  if (S.queue.indexOf(n) < 0) S.queue.push(n);
  toast("In the merge queue at position " + (S.queue.indexOf(n) + 1) + ". oxagen merges it when it reaches the front and its checks pass on the new main." + (bare ? " It merges without review, and the merge commit records you." : ""));
  render();
};
/* The first run: a new workspace in solo mode with an empty queue. The steering PR merges at once,
   oxagen publishes the next version, and an import applies only now. */
function mergeFirstRun(pr) {
  if (!pr) return;
  S.firstRunVersion++;
  pr.state = "merged"; pr.merged = F.ORG.now; pr.version = S.firstRunVersion; pr.solo = true;
  pr.trailers = ["Oxagen-Merged-By: " + viewer(), "Oxagen-Checks: " + num((pr.checks || []).length) + " passed", "Oxagen-Version: " + pr.version];
  if (pr.kind === "import") { S.imported[pr.target] = true; S.importPr[pr.target] = null; }
  toast("Merged and published as version " + pr.version + "." + (pr.kind === "import" ? " Every agent gets the import at its next session." : ""));
  render();
}
/* Revert builds the inverse of what the PR merged. A diff inverts line by line: + and - swap, and
   context stays. A record the PR added is archived in place, because record files are never
   deleted. A file the PR lists without a diff goes back to its version before the merge. */
function invertDiff(diff) {
  var out = [], run = [];
  function flush() { out = out.concat(run.filter(function (l) { return l[0] === "-"; }), run.filter(function (l) { return l[0] === "+"; })); run = []; }
  String(diff).split("\n").forEach(function (l) {
    if (l[0] === "+" || l[0] === "-") run.push((l[0] === "+" ? "-" : "+") + l.slice(1));
    else { flush(); out.push(l); }
  });
  flush();
  return out.join("\n");
}
function frontmatter(body) { var l = String(body).split("\n"), end = l.indexOf("---", 1); return end > 0 ? l.slice(0, end + 1) : l; }
function archiveDiff(lines) { return lines.map(function (l) { return l === "status: active" ? "-status: active\n+status: archived" : " " + l; }).join("\n"); }
function revertFiles(src) {
  if (src.kind === "memory") return src.memories.filter(function (m) { return !S.dropped[src.n + "." + m.id]; }).map(function (m) {
    return { path: "steering/memory/" + m.lineage.split(".")[1] + "/" + m.lineage + ".md", diff: archiveDiff(["lineage: " + m.lineage, "status: active"]), archived: true };
  });
  if (src.record && !(src.files || []).length) return [{ path: src.record.path, diff: archiveDiff(frontmatter(src.record.body || "")), archived: true }];
  return (src.files || []).map(function (f) {
    var path = f.path || f;
    if (!f.diff) return { path: path };
    var lines = f.diff.split("\n");
    if (/^steering\/.*\.md$/.test(path) && lines.every(function (l) { return l[0] === "+"; })) return { path: path, diff: archiveDiff(frontmatter(lines.map(function (l) { return l.slice(1); }).join("\n"))), archived: true };
    return { path: path, diff: invertDiff(f.diff) };
  });
}
function invertSurface(diff) {
  return diff.map(function (b) {
    return { head: b.head, lines: b.lines.map(function (l) {
      return { op: l.op === "+" ? "-" : l.op === "-" ? "+" : l.op, tool: l.tool, what: l.what, detail: l.detail ? l.detail.map(function (x) { return x[0] === "+" ? "-" + x.slice(1) : x[0] === "-" ? "+" + x.slice(1) : x; }) : null };
    }) };
  });
}
ACTS["pr-revert"] = function (el) {
  var src = prBy(+el.getAttribute("data-n")), n = nextPrNumber(), files = revertFiles(src);
  var top = files.length ? files[0].path.split("/")[0].replace(/\.toml$/, "") : "steering";
  var archived = files.filter(function (f) { return f.archived; }).length, restored = files.filter(function (f) { return !f.diff; }).length;
  S.newPrs.push({ n: n, kind: "revert", state: "open", title: "Revert #" + src.n + ": " + src.title, branch: top + "/revert-" + src.n, by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Undoes steering PR #" + src.n + ". It takes the same checks and review as any steering PR." +
      (archived ? " " + (archived === 1 ? "The record it added is archived in place, because record files are never deleted." : "The " + plural(archived, "record") + " it added are archived in place, because record files are never deleted.") : "") +
      (restored ? " " + plural(restored, "file") + (restored === 1 ? " goes back to its version" : " go back to their versions") + " before #" + src.n + "." : ""),
    server: src.server, diff: src.diff ? invertSurface(src.diff) : undefined, defs: src.defs ? [src.defs[1], src.defs[0]] : undefined,
    files: files,
    checks: (src.checks || []).map(function (c) { return c.r === "skip" ? c : { id: c.id, r: "pass" }; }) });
  go("steering", "pr-" + n);
  toast("Opened steering PR #" + n + ".");
};

/* One diff line per tool: + new, ~ changed, - removed. The same shape in a sync PR, a steering PR a
   review opens, and the Changes tab. */
function surfaceDiff(pr, withDefs) {
  var sv = serverBy(pr.server);
  var blocks = pr.diff.map(function (b) {
    return '<div class="tsd-h mono">' + h(b.head) + "</div>" + b.lines.map(function (l) {
      return '<div class="tsd-l op-' + (l.op === "+" ? "add" : l.op === "-" ? "del" : "chg") + (l.breaking ? " breaking" : "") + '"><span class="tsd-op mono">' + h(l.op) + '</span><span class="tsd-t mono">' + h(l.tool) + '</span><span class="tsd-w">' + mdi(l.what) + "</span>" +
        (l.detail ? '<div class="tsd-d mono">' + l.detail.map(function (x) { return '<span class="' + (x[0] === "+" ? "add" : x[0] === "-" ? "del" : "") + '">' + h(x) + "</span>"; }).join("") + "</div>" : "") + "</div>";
    }).join("");
  }).join("");
  var defs = withDefs && pr.defs ? '<p class="small">Definitions ' + num(pr.defs[0]) + " → " + num(pr.defs[1]) + " tokens per request (budget " + num(sv.exposure.definition_budget) + ")</p>" : "";
  return '<div class="panel"><div class="panel-h"><h3>Tool surface diff</h3><span class="sp"><a href="' + href("servers", sv.id) + '" data-go="servers|' + sv.id + '">' + h(sv.name) + '</a></span></div><div class="tsd">' + blocks + "</div>" + (defs ? '<div class="panel-b">' + defs + "</div>" : "") + "</div>";
}

function words(t) { return String(t || "").split(/\s+/).filter(Boolean).length; }
/* ---- the record drawer: what the model receives, and the file in the steering repo ---- */
ACTS.steeritem = function (el) { openDrawer("steeritem", el.getAttribute("data-id")); };
DRAWERS.steeritem = function (id) {
  var it = steeringItems().filter(function (i) { return i.id === id; })[0], st = steeringStats(it);
  var text = it.body || it.text, onSkill = !!(it.skills && it.skills.length), always = isAlwaysOn(it);
  var bodyWords = it.words || words(it.body || it.text);
  var skillNames = (it.skills || []).map(function (l) { var sk = skillByLineage(l); return sk ? recLabel(sk) : l; });
  var receives = onSkill ? "## Skill rules: " + skillNames.join(", ") + "\n\n### " + recLabel(it) + "\n" + text + "\n\n(sent once the session loads the skill)" :
    it.kind === "skill" ? "## More steering\n\nRead any of these with steering_read when it fits the task.\n- " + recLabel(it) + ": " + it.text + " (" + it.lineage + ")" :
    it.kind === "memory" ? "## Memories\n\n- " + it.text + "\n\n(recalled when relevant: at most 5 memories and 800 tokens a request)" :
    "## Workspace rules\n\n### " + recLabel(it) + "\n" + text;
  var fm = "---\nschema: steering-record/v1\nlineage: " + it.lineage + "\nlabel: " + recLabel(it) + "\nkind: " + it.kind + "\nforce: " + it.force + (it.effect ? "\neffect: " + it.effect : "") + "\nscope: " + it.scope +
    [].concat(yamlList("repos", it.repos), yamlList("tools", it.tools), yamlList("skills", it.skills), yamlList("applies_to", it.applies_to)).map(function (l) { return "\n" + l; }).join("") + "\nstatus: active\n---";
  var org = it.scope === "organization";
  return { title: recLabel(it),
    head: '<div class="grow">' + kindBadge(it.kind) + " <span class=\"muted mono small\">" + h(it.force) + "</span><h2>" + h(recLabel(it)) + "</h2></div>",
    body: (org ? '<div class="banner"><div class="grow"><b>From ' + h(REPO.org.name) + "</b>Every workspace in " + h(ORG.slug) + " inherits it. Change it by steering PR in " + repoLink(REPO.org.name, REPO.org.url) + ".</div></div>" : "") +
      '<div class="field"><label for="st-text">' + (it.kind === "skill" ? "Description" : "Body") + '</label><textarea id="st-text" rows="' + (it.kind === "procedure" ? 16 : 3) + '" class="mono"' + (org ? " readonly" : "") + ">" + h(it.kind === "skill" ? it.text : text) + "</textarea></div>" +
      '<div class="grid g3 tiles">' + stat("Tokens", num(it.tok), it.kind === "skill" ? "when loaded" : onSkill ? "with the skill" : always ? "on every request" : "when recalled") + stat(it.kind === "skill" ? "Loads" : "Sessions", num(it.kind === "skill" ? st.loads : st.sessions), "this month") + stat("Cost", money(st.cost), "this month") + "</div>" +
      (always && bodyWords > 120 ? '<div class="banner"><div class="grow"><b>Body over 120 words</b>It runs ' + num(bodyWords) + ' words. The schema check warns when an always-on body passes 120 words. One record per rule clears the warning.</div></div>' : "") +
      '<h3 class="sec">What the model receives</h3><div class="readout"><div class="rh"><span>Through the cloud gateway</span><span class="sp">' + (always ? "every request" : onSkill ? "with the skill" : it.kind === "skill" ? "the index line, then the body on demand" : "when relevant") + "</span></div><pre>" + h(receives) + "</pre></div>" +
      '<h3 class="sec">File</h3><div class="readout"><div class="rh"><span class="mono">' + h((org ? REPO.org.name + "/" : "") + it.path) + '</span></div><pre>' + h(fm) + "</pre></div>" +
      '<p class="muted small">Code repositories hold no oxagen files. A skill reaches the harness at session start from outside the repository.</p>' +
      (it.from ? '<p class="muted small">' + h(it.from) + ". Accepted by " + h(personName(it.by)) + ".</p>" : "") +
      (it.history ? '<h3 class="sec">History</h3><div class="lst">' + it.history.map(function (v) { return '<div class="li"><span class="mono muted">v' + v.v + '</span><span class="bd2"><span class="t1">' + h(v.what) + '</span><span class="t2">' + pts([h(personName(v.by)), h(v.at)]) + "</span></span></div>"; }).join("") + "</div>" : "") +
      '<div class="dfoot"><button class="btn" data-act="close">Close</button>' + (org ? "" : '<button class="btn primary" data-act="rec-pr" data-id="' + h(it.id) + '">Open steering PR</button>') + "</div>" };
};
ACTS["rec-pr"] = function (el) {
  var it = steeringItems().filter(function (i) { return i.id === el.getAttribute("data-id"); })[0], n = nextPrNumber();
  var now = (document.getElementById("st-text") || {}).value || it.text;
  S.newPrs.push({ n: n, kind: "record", state: "open", title: "Edit " + recLabel(it), branch: "steering/" + it.lineage.split(".").slice(1).join("-"), by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Changes one record. It reaches sessions when this merges and oxagen publishes the next version.",
    files: [{ path: it.path, diff: (it.kind === "skill" ? it.text : it.body || it.text).split("\n").map(function (l) { return "-" + l; }).join("\n") + "\n" + now.split("\n").map(function (l) { return "+" + l; }).join("\n") }],
    checks: [{ id: "schema", r: "pass" }, { id: "lineage", r: "pass" }, { id: "secrets", r: "pass" }, { id: "conflicts", r: "pass" }, { id: "authority", r: "pass" }, { id: "budget", r: "pass" }, { id: "owned", r: "pass" }] });
  go("steering", "pr-" + n);
  toast("Opened steering PR #" + n + ".");
};
ACTS.newsteer = function () { openDialog("newsteer"); };
DIALOGS.newsteer = function () {
  return { title: "New steering record", sub: "It reaches the runs it targets once its steering PR merges.",
    body: '<div class="fields"><div class="field"><label for="ns-kind">Kind</label><select id="ns-kind">' + Object.keys(KINDS).filter(function (k) { return k !== "skill"; }).map(function (k) { return "<option>" + h(KINDS[k]) + "</option>"; }).join("") + '</select></div>' +
      '<div class="field"><label for="ns-force">Force</label><select id="ns-force"><option>must</option><option>should</option><option>may</option><option>info</option></select><div class="hint">must and should reach every request. may and info load when they fit.</div></div></div>' +
      '<div class="field"><label for="ns-text">Body</label><textarea id="ns-text" rows="3" autofocus placeholder="Run pnpm release:lint before you commit release notes."></textarea></div>' +
      '<h3 class="sec">Applies to</h3><p class="muted small">It reaches every run unless a target below narrows it.</p>' +
      '<div class="field"><label>Repositories</label><div class="agpick">' + REPO.linked.map(function (r) { return '<label class="check"><input type="checkbox" name="ns-repo" value="' + h(r.url) + '"><span class="grow"><span class="n mono">' + h(r.url) + "</span></span></label>"; }).join("") + '</div><div class="hint">None ticked reaches every linked repository.</div></div>' +
      '<div class="field"><label>Skills</label><div class="agpick">' + STEERING.items.filter(function (i) { return i.kind === "skill"; }).map(function (sk) { return '<label class="check"><input type="checkbox" name="ns-skill" value="' + h(sk.lineage) + '"><span class="grow"><span class="n mono">' + h(recLabel(sk)) + '</span><span class="muted small"> ' + h(sk.text) + "</span></span></label>"; }).join("") + '</div><div class="hint">A record that targets a skill loads with it and stays out of the always-on block.</div></div>' +
      '<div class="fields"><div class="field"><label for="ns-tools">Tools</label><input id="ns-tools" class="mono" placeholder="billing__create_refund, stripe__*"><div class="hint">It reaches a request only when the run holds a match.</div></div>' +
      '<div class="field"><label for="ns-paths">Paths</label><input id="ns-paths" class="mono" placeholder="packages/api/**"><div class="hint">It reaches a turn that touches a match.</div></div></div>',
    foot: '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="newsteer-go">Open steering PR</button>' };
};
/* A label is 1 to 36 characters: the body's first words. */
function labelFrom(text) {
  var out = "";
  String(text).replace(/\.$/, "").split(/\s+/).some(function (w) { if ((out ? out.length + 1 : 0) + w.length > 36) return true; out += (out ? " " : "") + w; return false; });
  return out || String(text).slice(0, 36);
}
/* A record's targets are the steering-record/v1 fields repos, tools, and applies_to (path globs).
   A glob or a wildcard is quoted, as the spec's examples write it. */
function yamlList(name, arr) {
  if (!arr || !arr.length) return [];
  return [name + ":"].concat(arr.map(function (x) { return "  - " + (/[*?{}\[\]]/.test(x) || name === "applies_to" ? '"' + x + '"' : x); }));
}
function orList(a) { return a.length < 3 ? a.join(" or ") : a.slice(0, -1).join(", ") + ", or " + a[a.length - 1]; }
function listField(id) { return ((document.getElementById(id) || {}).value || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
ACTS["newsteer-go"] = function () {
  var n = nextPrNumber(), text = (document.getElementById("ns-text") || {}).value || "Run pnpm release:lint before you commit release notes.";
  var kindName = (document.getElementById("ns-kind") || {}).value || "Business rule", force = (document.getElementById("ns-force") || {}).value || "must";
  var repos = Array.prototype.slice.call(document.querySelectorAll('input[name="ns-repo"]:checked')).map(function (el) { return el.value; });
  var skills = Array.prototype.slice.call(document.querySelectorAll('input[name="ns-skill"]:checked')).map(function (el) { return el.value; });
  var tools = listField("ns-tools"), paths = listField("ns-paths"), scope = repos.length ? "repository" : "workspace";
  var skillName = function (l) { var sk = skillByLineage(l); return sk ? recLabel(sk) : l; };
  var code = function (x) { return "`" + x + "`"; };
  var reach = [repos.length ? "its repository is " + orList(repos.map(code)) : "", tools.length ? "it holds " + orList(tools.map(code)) : "", skills.length ? "it loads " + orList(skills.map(skillName).map(code)) : "", paths.length ? "it touches " + orList(paths.map(code)) : ""].filter(Boolean);
  var kind = Object.keys(KINDS).filter(function (k) { return KINDS[k] === kindName; })[0] || "business-rule";
  var lineage = "a-intel.platform." + slugify(text).split("-").slice(0, 4).join("-"), label = labelFrom(text);
  var body = ["---", "schema: steering-record/v1", "lineage: " + lineage, "label: " + label, "kind: " + kind, "force: " + force, "scope: " + scope].concat(yamlList("repos", repos), yamlList("tools", tools), yamlList("skills", skills), yamlList("applies_to", paths), ["status: active", "origin: user", "---", "", text]).join("\n");
  var rec = { lineage: lineage, label: label, kind: kind, force: force, scope: scope, repos: repos.length ? repos : null, tools: tools, applies_to: paths, skills: skills, text: text, tok: Math.round((label.length + text.length) / 4) + 8, path: "steering/platform/" + lineage + ".md", body: body };
  var over = budgetRows(rec).some(function (r) { return r.over; });
  S.newPrs.push({ n: n, kind: "record", state: "open", title: text.length > 60 ? text.slice(0, 57) + "..." : text, branch: "steering/" + lineage.split(".").slice(2).join("-"), by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Adds one record. It reaches " + (reach.length ? "a run only when " + reach.join(" and ") : "every run in the workspace") + ". oxagen writes its id and hash when it merges.",
    record: rec,
    checks: [{ id: "schema", r: "pass" }, { id: "lineage", r: "pass" }, { id: "secrets", r: "pass" }, { id: "conflicts", r: "pass" }, { id: "authority", r: "pass" }, { id: "budget", r: over ? "warn" : "pass" }, { id: "owned", r: "pass" }] });
  closeDialog(); go("steering", "pr-" + n); toast("Opened steering PR #" + n + ".");
};
ACTS.steerimport = function () { openDialog("steerimport"); };
function andList(a) { return a.length < 3 ? a.join(" and ") : a.slice(0, -1).join(", ") + ", and " + a[a.length - 1]; }
function importCounts(im) {
  var lines = im.found.reduce(function (t, f) { return t + f.lines; }, 0), dupes = im.found.reduce(function (t, f) { return t + f.dupes; }, 0);
  var personal = im.found.filter(function (f) { return f.personal; }).reduce(function (t, f) { return t + f.lines; }, 0);
  return { lines: lines, dupes: dupes, personal: personal, result: lines - dupes - personal - im.conflicts.length };
}
DIALOGS.steerimport = function (arg, d) {
  var im = STEERING.import, c = importCounts(im), open = S.importPr.steering;
  d.pick = d.pick || {};
  return { title: "Import steering", wide: true, sub: "Import opens one steering PR in " + h(REPO.name) + ", and nothing changes until it merges.",
    body: '<div class="tw"><table class="narrow"><thead><tr><th>File</th><th>Where</th><th class="num">Lines</th><th class="num">Duplicates</th></tr></thead><tbody>' + im.found.map(function (f) {
      return '<tr><td class="mono">' + h(f.file) + "</td><td>" + h(f.where) + (f.personal ? ' <span class="b b-q">Stays on the laptop</span>' : "") + '</td><td class="num">' + f.lines + '</td><td class="num">' + (f.dupes || "") + "</td></tr>";
    }).join("") + "</tbody></table></div>" +
      '<h3 class="sec">' + plural(im.conflicts.length, "conflict") + " to settle</h3>" + im.conflicts.map(function (cf, i) {
        return '<div class="conf"><label class="check"><input type="radio" name="cf' + i + '" ' + (d.pick[i] !== "b" ? "checked" : "") + ' data-change="cf" data-i="' + i + '" value="a"><span class="grow"><span class="n">' + h(cf.a.text) + '</span><span class="d">' + h(cf.a.file) + '</span></span></label><label class="check"><input type="radio" name="cf' + i + '" ' + (d.pick[i] === "b" ? "checked" : "") + ' data-change="cf" data-i="' + i + '" value="b"><span class="grow"><span class="n">' + h(cf.b.text) + '</span><span class="d">' + h(cf.b.file) + "</span></span></label></div>";
      }).join(""),
    foot: '<span class="grow">' + num(c.lines) + " lines, " + num(c.dupes) + " duplicates merged, " + num(c.personal) + " personal left out. " + plural(c.result, "record") + " to import.</span>" +
      (open ? '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-go="steering|pr-' + open + '">View steering PR #' + open + "</button>" : '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="steerimport-go">Open steering PR</button>') };
};
ACTS.cf = function (el) { S.dialog.pick[el.getAttribute("data-i")] = el.value; };
/* One file per record. The PR shows the records the conflicts settled, and the summary counts the
   rest, which take the same shape. */
function importedRecord(im, choice, kind) {
  var src = im.found.filter(function (f) { return f.file === choice.file; })[0] || im.found[0];
  var area = src.where.split("/").pop(), lineage = "a-intel." + area + "." + slugify(choice.text).split("-").slice(0, 4).join("-");
  var body = ["---", "schema: steering-record/v1", "lineage: " + lineage, "label: " + labelFrom(choice.text), "kind: " + kind, "force: should", "scope: repository", "repos:", "  - github.com/" + src.where, "status: active", "origin: user", "provenance:", "  source: import", "  uri: oxagen:import/" + slugify(src.file) + "/" + area, "---", "", choice.text];
  return { path: "steering/" + area + "/" + lineage + ".md", diff: body.map(function (l) { return "+" + l; }).join("\n") };
}
ACTS["steerimport-go"] = function () {
  var im = STEERING.import, c = importCounts(im), pick = (S.dialog && S.dialog.pick) || {}, n = nextPrNumber();
  var from = im.found.filter(function (f) { return !f.personal; });
  var files = im.conflicts.map(function (cf, i) { return importedRecord(im, pick[i] === "b" ? cf.b : cf.a, cf.kind || "procedure"); });
  S.newPrs.push({ n: n, kind: "import", target: "steering", state: "open", title: "Import " + plural(c.result, "record") + " from " + plural(from.length, "file"), branch: "steering/import", by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Imports " + plural(c.result, "record") + " from " + plural(from.length, "file") + " in " + andList(from.map(function (f) { return f.where; }).filter(function (w, i, all) { return all.indexOf(w) === i; }).map(function (w) { return "`" + w + "`"; })) + ". No agent gets them until this merges.",
    note: "The PR shows the " + plural(files.length, "record") + " your conflict choices settled. The other " + plural(c.result - files.length, "record") + " take the same shape, one file each.",
    files: files,
    checks: [{ id: "schema", r: "pass" }, { id: "lineage", r: "pass" }, { id: "secrets", r: "pass", note: num(c.personal) + " personal lines stayed on the laptop." }, { id: "conflicts", r: "pass", note: "You settled " + plural(im.conflicts.length, "conflict") + " in the import." }, { id: "authority", r: "pass" }, { id: "budget", r: "pass" }, { id: "owned", r: "pass" }] });
  S.importPr.steering = n;
  closeDialog(); go("steering", "pr-" + n); toast("Opened steering PR #" + n + ". Nothing changes until it merges.");
};

/* ---- linking a code repository: a steering PR on workspace.toml ---- */
ACTS.linkrepo = function () { openDialog("linkrepo"); };
DIALOGS.linkrepo = function (arg, d) {
  d.pick = d.pick || REPO.linkable[0].url;
  return { title: "Link a repository", sub: "Linking opens a steering PR that adds the repository to <code>workspace.toml</code>.",
    body: '<div class="field"><label>Repositories the oxagen app can read</label>' + REPO.linkable.map(function (r) {
      return '<label class="check"><input type="radio" name="lr" value="' + h(r.url) + '" data-change="lr-pick"' + (d.pick === r.url ? " checked" : "") + '><span class="grow"><span class="n">' + h(r.url) + '</span><span class="d">' + (r.also.length ? "Also linked to " + h(r.also.join(", ")) + ". A repository can belong to many workspaces." : "In no workspace yet") + "</span></span></label>";
    }).join("") + "</div>",
    foot: '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="linkrepo-go">Open steering PR</button>' };
};
ACTS["lr-pick"] = function (el) { S.dialog.pick = el.value; };
ACTS["linkrepo-go"] = function () {
  var url = S.dialog.pick, r = REPO.linkable.filter(function (x) { return x.url === url; })[0], n = nextPrNumber(), short = url.split("/").pop();
  S.newPrs.push({ n: n, kind: "workspace", state: "open", title: "Link " + url, branch: "workspace/link-" + short, by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Adds `" + url + "` to `workspace.toml`. Sessions in this workspace get its repository records once this merges.",
    note: r.also.length ? "`" + url + "` stays linked to " + r.also.join(", ") + " too. A code repository can belong to many workspaces." : "",
    files: [{ path: "workspace.toml", diff: ' [[repositories]]\n url = "github.com/a-intel/billing-service"\n+\n+[[repositories]]\n+url = "' + url + '"' }],
    checks: [{ id: "schema", r: "pass" }, { id: "references", r: "pass", note: "`" + url + "` exists, and the oxagen app can read it." }, { id: "settings", r: "pass" }, { id: "owned", r: "pass" }] });
  closeDialog(); go("steering", "pr-" + n); toast("Opened steering PR #" + n + ".");
};

/* ---- workspaces: creating one creates its steering repo ---- */
ACTS.workspaces = function () { openDialog("workspaces"); };
DIALOGS.workspaces = function () {
  return { title: "Workspaces", sub: "Each workspace has its own steering repo.",
    body: '<div class="lst">' + STEERING.provision.workspaces.map(function (w) {
      return '<div class="li"><span class="avx provider" style="width:26px;height:26px;font-size:11px">' + h(w.name.slice(0, 2).toUpperCase()) + '</span><span class="bd2"><span class="t1">' + h(w.name) + (w.current ? ' <span class="b b-q">Current</span>' : "") + '</span><span class="t2 mono">' + h(w.repo) + "</span></span></div>";
    }).join("") + "</div>",
    foot: '<button class="btn" data-act="close">Close</button><button class="btn primary" data-act="newws">' + g("plus", 14) + " New workspace</button>" };
};
ACTS.newws = function () { openDialog("newworkspace"); };
/* Provisioning, by step (steering repo spec, Provisioning). The first attempt stops at Create the
   repository, the way it does when the organization owner whose token adds new repositories to the
   installation has left: GitHub refuses, and the step fails. Any other organization owner
   re-authorizes once, and Retry then finishes. Every step is safe to repeat. ?prov=failed and
   ?prov=done pin a state for a story. */
function provOwner() { var k = Object.keys(PEOPLE).filter(isOrgAdmin)[0]; return k ? personName(k) : "an organization owner"; }
DIALOGS.newworkspace = function (arg, d) {
  var steps = STEERING.provision.steps;
  if (d.q && !d.init) {
    d.init = true;
    if (d.q.name) d.ws = decodeURIComponent(d.q.name);
    if (d.q.prov === "failed") { d.ws = d.ws || "Payments ops"; d.phase = "run"; d.at = 1; d.failed = true; }
    if (d.q.prov === "done") { d.ws = d.ws || "Payments ops"; d.phase = "run"; d.at = steps.length; d.reauth = true; }
  }
  if (!d.phase) {
    return { title: "New workspace", sub: "oxagen creates the workspace and its steering repo from the name.",
      body: '<div class="field"><label for="nws-name">Name</label><input id="nws-name" autofocus data-input="nws-name" value="' + h(d.ws || "") + '" placeholder="Payments ops"><div class="hint">Its steering repo is <code>' + h(steeringRepoFor(d.ws || "Payments ops")) + "</code>, a private repository in " + h(ORG.slug) + ".</div></div>",
      foot: '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="nws-go">Create workspace</button>' };
  }
  var repo = steeringRepoFor(d.ws), done = d.at >= steps.length;
  var list = steps.map(function (s, i) {
    var st = i < d.at ? "done" : i === d.at ? (d.failed ? "failed" : "running") : "wait";
    var ic = st === "done" ? g("check", 13) : st === "failed" ? g("x", 13) : st === "running" ? '<span class="spin"></span>' : String(i + 1);
    return '<div class="prov-step st-' + st + '"><span class="prov-i">' + ic + '</span><div class="grow"><b>' + h(s.t) + '</b><span class="sub">' + (s.k === "create" ? "<code>" + h(repo) + "</code>, private" : mdi(s.d)) + "</span>" +
      (st === "failed" ? '<div class="warn small">' + mdi(s.error) + " " + h(s.fix) + "</div>" : "") +
      (s.k === "create" && d.reauth && i >= d.at ? '<div class="small muted">' + h(personName(d.reauth === true ? viewer() : d.reauth)) + " re-authorized. Retry finishes the step.</div>" : "") + "</div></div>";
  }).join("");
  var owner = isOrgAdmin(viewer());
  var failFoot = (d.reauth ? "" : owner ? "" : '<span class="grow muted small">Ask an organization owner, such as ' + h(provOwner()) + ", to re-authorize.</span>") +
    '<button class="btn" data-act="close">Cancel</button>' + (owner && !d.reauth ? '<button class="btn" data-act="nws-retry">Retry</button><button class="btn primary" data-act="nws-reauth">Re-authorize</button>' : '<button class="btn' + (d.reauth ? " primary" : "") + '" data-act="nws-retry">Retry</button>');
  return { title: done ? d.ws + " is ready" : d.failed ? "Setting up " + d.ws + " stopped" : "Setting up " + d.ws, sub: done ? "Its steering repo is published at version 1." : "The target is 15 seconds from Create to an open workspace.",
    body: '<div class="prov">' + list + "</div>",
    foot: d.failed ? failFoot :
      done ? '<button class="btn primary" data-act="nws-open">Open the workspace</button>' : '<span class="grow">Step ' + (d.at + 1) + " of " + steps.length + '</span><button class="btn" data-act="close">Run in the background</button>' };
};
ACTS["nws-name"] = function (el) { S.dialog.ws = el.value; var hint = el.parentNode.querySelector(".hint code"); if (hint) hint.textContent = steeringRepoFor(el.value || "Payments ops"); };
function provTick(d) {
  setTimeout(function () {
    if (S.dialog !== d || d.failed) return;
    // Until an owner re-authorizes, Create the repository fails again on every retry.
    if (d.at === 1 && !d.reauth) d.failed = true;
    else { d.at++; if (d.at === 1 && !d.reauth) d.failed = true; }
    renderLayer();
    if (!d.failed && d.at < STEERING.provision.steps.length) provTick(d);
  }, 650);
}
ACTS["nws-go"] = function () { var d = S.dialog; d.ws = (d.ws || "").trim() || "Payments ops"; d.phase = "run"; d.at = 0; renderLayer(); provTick(d); };
ACTS["nws-retry"] = function () { var d = S.dialog; d.failed = false; renderLayer(); provTick(d); };
ACTS["nws-reauth"] = function () { S.dialog.reauth = viewer(); toast("Re-authorized. oxagen can add new steering repos to the installation again."); renderLayer(); };
ACTS["nws-open"] = function () { var name = S.dialog.ws; closeDialog(); toast(name + " is ready. Workspaces other than Core platform are not in this mockup."); };

/* ============================== MCP servers ==============================
   MCP Studio (mcp-studio-spec.html). The list, Add server with four sources, and one page per server
   with one row of tabs: Tools, Connection, Try it, and Changes. Every server is one folder,
   tools/servers/<name>/, in the steering repo. The app's own routes stay #/.../servers/<name>. */
function deliveryStrip(targets, note) {
  return '<div class="deliv"><span class="deliv-n">' + h(note) + '</span><div class="deliv-t">' + targets.map(function (t) {
    return '<span class="dt">' + hxIcon(t.harness, 14) + '<span>' + h(hxLabel(t.harness)) + '</span><code>' + h(t.file) + "</code></span>";
  }).join("") + "</div></div>";
}
function embedLabel() {
  var e = F.SERVERS.embeddings;
  if (e.provider === "custom") return e.custom.model + " at your endpoint";
  if (e.provider === "keyword") return "Keyword matching";
  return e.vendor + " " + e.model + " on oxagen's key";
}
function srvState(sv) {
  var out = [];
  if (serverOffBy(sv)) out.push(badge("b-q", "Off", true));
  if (relaysOf(sv).some(function (r) { return r.r.state === "down"; })) out.push(badge("b-failed", "Relay down", true));
  if (sv.syncPr && prBy(sv.syncPr) && prBy(sv.syncPr).state !== "merged") out.push(badge("b-approval", "Sync PR #" + sv.syncPr));
  if (sv.errors && sv.errors.length) out.push(badge("b-denied", plural(sv.errors.length, "machine error"), true));
  if (sv.authcfg.mode === "operator-oauth" && !operatorLinked(sv, viewer()) && !(S.opLinked || {})[sv.id]) out.push(badge("b-approval", "Not connected"));
  return out.length ? out.join(" ") : badge("b-allowed", "On", true);
}
VIEWS.servers = function () {
  if (S.id) return serverPage(S.id);
  var head = phead("MCP servers", "One list of servers for every agent. oxagen holds the keys, and the gateway serves each imported tool.",
    '<button class="btn" data-act="serverimport">' + g("import", 14) + ' Import</button><button class="btn primary" data-act="addserver">' + g("plus", 14) + " Add server</button>");
  if (S.empty && !S.imported.servers && S.importPr.servers) return { crumb: [["MCP servers"]], html: head + importPending("servers") };
  if (S.empty && !S.imported.servers) return { crumb: [["MCP servers"]], html: head + empty("servers", "No servers yet", "Import the servers already set up in Claude Code, Codex and Cursor on your machines. oxagen takes their keys and points every harness at one gateway.", '<button class="btn primary" data-act="serverimport">Import MCP servers</button>') };
  var rows = SERVERS.map(function (sv) {
    var st = serverStats(sv.id), imp = sv.tools.filter(function (t) { return t.state !== "available"; }).length;
    return '<tr class="click" data-go="servers|' + sv.id + '"><td><span class="srvc">' + serverMark(sv, 28) + '<span><b>' + h(sv.name) + '</b><span class="sub mono">' + h(folderOf(sv) || "Built in") + "</span></span></span></td>" +
      '<td class="mh">' + h(sourceLabel(sv)) + '</td><td class="num">' + (sv.source.type === "builtin" ? num(sv.tools.length) : num(imp) + " of " + num(sv.tools.length)) + (isSearch(sv) ? '<span class="sub">Search mode</span>' : "") + "</td>" +
      '<td class="num mh">' + num(st.calls) + '</td><td class="num mh">' + money(st.cost) + '</td><td class="srvst">' + srvState(sv) + "</td></tr>";
  }).join("");
  var syncs = SERVERS.filter(function (sv) { return sv.syncPr && prBy(sv.syncPr) && prBy(sv.syncPr).state !== "merged"; });
  var syncB = syncs.length ? '<div class="banner"><div class="grow"><b>' + plural(syncs.length, "sync PR") + " waiting on review</b>" + syncs.map(function (sv) { return '<a href="' + href("steering", "pr-" + sv.syncPr) + '" data-go="steering|pr-' + sv.syncPr + '">#' + sv.syncPr + " " + h(sv.name) + "</a>"; }).join(", ") + ". The gateway serves the locked definitions until they merge.</div></div>" : "";
  return { crumb: [["MCP servers"]], html: head + deliveryStrip(F.SERVERS.targets, "Every harness points at " + F.SERVERS.gateway + ", which holds the keys and applies your policies.") + syncB +
    '<div class="panel"><div class="tw"><table><thead><tr><th>Server</th><th class="mh">Source</th><th class="num">Tools imported</th><th class="num mh">Calls this month</th><th class="num mh">Cost</th><th>State</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>" +
    '<div class="panel pad rank"><div class="grow"><span class="k">Search ranking</span><b>' + h(embedLabel()) + '</b><span class="muted small">Ranks the tools of a server in search mode, from <code>workspace.toml</code>.</span></div><button class="btn sm" data-act="embeddings">Change</button></div>' +
    '<p class="muted small foot">A server\'s cost is what its tool definitions and results added to each model request.</p>' };
};

/* ---- one server ---- */
function changeCount(sid) { var seen = {}; staged(sid).forEach(function (o) { seen[o.op === "test" ? "test" + o.at : o.tool] = 1; }); return Object.keys(seen).length; }
function serverPage(id) {
  var sv = serverBy(id);
  if (S.empty && !S.imported.servers && S.importPr.servers) return { crumb: [["MCP servers", "servers"], ["Server"]], html: importPending("servers") };
  if (S.empty && !S.imported.servers) return { crumb: [["MCP servers", "servers"], ["Server"]], html: empty("servers", "No servers yet", "Import your MCP servers or add one first.", '<button class="btn" data-go="servers">MCP servers</button>') };
  if (!sv) return { crumb: [["MCP servers", "servers"], ["Not found"]], html: empty("servers", "No server with that name", "It may be in another workspace.", '<button class="btn" data-go="servers">MCP servers</button>') };
  var off = serverOffBy(sv), n = sv.source.type === "builtin" ? 0 : changeCount(id);
  var meta = '<div class="smeta"><span>' + h(sourceLabel(sv)) + "</span>" + (folderOf(sv) ? '<span class="mono">' + h(folderOf(sv)) + "</span>" : "") + (sv.exposure ? "<span>" + (isSearch(sv) ? "Search mode" : "Direct mode") + "</span>" : "") + (sv.sync ? "<span>Sync " + h(sv.sync.schedule) + "</span>" : "") + "</div>";
  var acts = sv.source.type === "builtin" ? "" : (n ? '<button class="btn primary-soft" data-act="srvtab" data-tab="changes">Review ' + plural(n, "change") + "</button>" : "") +
    (off ? '<button class="btn" data-act="srv-on" data-id="' + id + '">Turn on</button>' : '<button class="btn danger" data-act="srv-off" data-id="' + id + '">' + g("stop", 13) + " Turn off</button>");
  var head = '<div class="shead"><div class="t"><p class="eyebrow">MCP server</p><h1>' + h(sv.name) + "</h1>" + meta + '</div><div class="acts">' + acts + "</div></div>";
  var banners = "";
  if (off) banners += '<div class="banner offb"><div class="grow"><b>Turned off by ' + h(personName(off.by)) + " " + when(off.at) + "</b>" + (off.why ? h(off.why) + " " : "") + "Every call to its tools is refused. Turning it back on is instant too, and neither needs a steering PR.</div></div>";
  relaysOf(sv).filter(function (r) { return r.r.state === "down"; }).forEach(function (r) {
    var envs = (sv.environments || []).filter(function (e) { return e.network === "relay:" + r.name; }).map(function (e) { return e.name; });
    banners += '<div class="banner failb"><div class="grow"><b>Relay <code>' + h(r.name) + "</code> is down since " + when(r.r.since) + "</b>Calls to " + h(sv.name) + " in " + h(envs.join(" and ")) + " fail closed until it reconnects. The relay sends nothing while its connection to oxagen is down.</div></div>";
  });
  if (sv.authcfg.mode === "operator-oauth" && !operatorLinked(sv, viewer()) && !(S.opLinked || {})[id]) banners += opBanner(sv);
  if (sv.errors && sv.errors.length && S.srvTab !== "connection") banners += '<div class="banner"><div class="grow"><b>' + plural(sv.errors.length, "machine") + " reported an error in the last day</b>" + sv.errors.map(function (e) { return "<code>" + h(e.machine) + "</code>"; }).join(", ") + '. The Connection tab lists each error and its fix.</div><button class="btn sm" data-act="srvtab" data-tab="connection">Open Connection</button></div>';
  if (sv.syncPr && prBy(sv.syncPr) && prBy(sv.syncPr).state !== "merged") {
    var sp = prBy(sv.syncPr), wh = sv.tools.filter(withheld);
    banners += '<div class="banner"><div class="grow"><b>Sync PR #' + sp.n + " is open</b>" + (wh.length ? plural(wh.length, "tool") + " withheld until it merges: " + wh.map(function (t) { return "<code>" + h(toolName(id, t.n)) + "</code>"; }).join(", ") + "." : "The upstream definition changed. The gateway serves the locked one until it merges.") +
      '</div><button class="btn sm" data-go="steering|pr-' + sp.n + '">View steering PR #' + sp.n + "</button></div>";
  }
  if (sv.source.type === "builtin") {
    return { crumb: [["MCP servers", "servers"], [sv.name]], html: head + '<div class="panel pad"><p>' + h(sv.keyNote) + " It is part of oxagen, so it has no folder in the steering repo.</p></div>" + toolsTab(sv) };
  }
  var tabs = tabRow("srvtab", S.srvTab, [["tools", "Tools", sv.tools.filter(function (t) { return importedNow(id, t); }).length], ["connection", "Connection"], ["try", "Try it"], ["changes", "Changes", n || null]]);
  var body = S.srvTab === "connection" ? connectionTab(sv) : S.srvTab === "try" ? tryTab(sv) : S.srvTab === "changes" ? changesTab(sv) : toolsTab(sv);
  return { crumb: [["MCP servers", "servers"], [sv.name]], html: head + banners + tabs + '<div class="stack">' + body + "</div>" };
}
function opBanner(sv) {
  return '<div class="banner"><div class="grow"><b>You have not connected your ' + h(sv.name) + " account</b>" + h(sv.name) + " uses operator OAuth, so a call uses the token of the person who operates the session. Sessions you operate get this result on every call: <code>Connect your " + h(sv.name) + ' account in oxagen, then retry.</code></div><button class="btn sm primary" data-act="op-link" data-id="' + sv.id + '">Connect your account</button></div>';
}
ACTS["op-link"] = function (el) { S.opLinked = S.opLinked || {}; S.opLinked[el.getAttribute("data-id")] = true; toast("Connected. oxagen keeps the token and refreshes it."); render(); };
ACTS.srvtab = function (el) { S.srvTab = el.getAttribute("data-tab"); render(); };
ACTS["srv-off"] = function (el) { var id = el.getAttribute("data-id"); S.srvOff[id] = { by: viewer(), at: F.ORG.now }; toast(serverBy(id).name + " is off. The next call to any of its tools is refused."); render(); };
ACTS["srv-on"] = function (el) { var id = el.getAttribute("data-id"); S.srvOff[id] = false; toast(serverBy(id).name + " is on. The next call goes through."); render(); };

/* ---- Tools ---- */
function cval(v, ok) { return ok ? h(v) : '<span class="sugg" title="A suggestion. Confirm it in the tool panel.">' + h(v) + "</span>"; }
var TOOL_FILTERS = [["all", "All"], ["imported", "Imported"], ["available", "Available"]];
function toolsTab(sv) {
  var id = sv.id, tools = sv.tools, imp = tools.filter(function (t) { return importedNow(id, t); });
  var builtin = sv.source.type === "builtin";
  var summary = "";
  if (!builtin) {
    var budget = sv.exposure.definition_budget, now = defsOf(sv, false), next = defsOf(sv, true), all = importedDefs(sv);
    if (isSearch(sv)) {
      summary = '<div class="panel pad tsum"><div class="grow"><b>Search mode</b><p class="small">Agents see three tools: <code>' + id + "__search</code>, <code>" + id + "__describe</code>, and <code>" + id + "__call</code>, about " + num(SEARCH_TOK) + " tokens a request. As direct tools, the " + plural(imp.length, "imported tool") + " would cost " + num(all) + " tokens, over the " + num(budget) + "-token budget.</p>" +
        '<p class="small muted">A search returns up to 10 imported tools as one line each, and only tools the run may call. Policy decides <code>' + id + "__call</code> as the real tool. Ranking: " + h(embedLabel()) + ".</p></div></div>";
    } else {
      summary = '<div class="panel pad tsum"><div class="grow"><b>' + num(imp.length) + " of " + plural(tools.length, "tool") + ' imported</b><div class="meter"><div class="lab">Definitions per request<b>' + num(next) + " of " + num(budget) + ' tokens</b></div><div class="capbar' + (next > budget ? " over" : "") + '"><i style="width:' + Math.min(100, next / budget * 100).toFixed(1) + '%"></i></div></div>' +
        '<p class="small muted">' + (next !== now ? num(now) + " tokens now. The rest comes with your changes. " : "") + "Grey values are suggestions until a person confirms them." + (all > budget ? " The imported definitions pass the budget, so Studio suggests search mode." : "") + "</p></div></div>";
    }
  }
  var counts = { all: tools.length, imported: imp.length, available: tools.length - imp.length };
  var q = (S.toolQ || "").toLowerCase();
  var list = tools.filter(function (t) {
    if (S.toolFilter === "imported" && !importedNow(id, t)) return false;
    if (S.toolFilter === "available" && importedNow(id, t)) return false;
    return !q || t.n.indexOf(q) >= 0 || (t.d || "").toLowerCase().indexOf(q) >= 0;
  });
  var shown = list.slice(0, S.toolShow);
  var bar = builtin ? "" : '<div class="toolbar"><div class="seg">' + TOOL_FILTERS.map(function (f) { return '<button class="btn sm" data-act="toolfilter" data-f="' + f[0] + '" aria-pressed="' + (S.toolFilter === f[0]) + '">' + f[1] + ' <span class="n">' + num(counts[f[0]]) + "</span></button>"; }).join("") + "</div>" +
    (tools.length > 30 ? '<input class="sel tq" type="search" placeholder="Find a tool" aria-label="Find a tool" value="' + h(S.toolQ) + '" data-change="toolq">' : "") + '<span class="sp muted">' + plural(list.length, "tool") + "</span></div>";
  var rows = shown.map(function (t) {
    var k = id + "." + t.n, c = classOf(id, t), on = importedNow(id, t), off = toolOffBy(id, t), rules = approvalFor(id, t);
    var flags = (off ? " " + badge("b-q", "Off", true) : "") + (withheld(t) ? " " + badge("b-denied", "Withheld", true) : "") + (t.fresh ? " " + badge("b-approval", "New") : "") + ((t.upstreamNew || (t.sync && !t.sync.breaking)) && sv.syncPr ? " " + badge("b-approval", "Upstream changed") : "") + (t.deprecated ? " " + badge("b-q", "Deprecated") : "") +
      (stagedOp(id, "import", t.n) ? " " + badge("b-approval", "Importing") : "") + (stagedOp(id, "remove", t.n) ? " " + badge("b-denied", "Removing") : "");
    return '<tr class="click' + (on ? "" : " avail") + '" data-act="tool" data-k="' + h(k) + '">' +
      (builtin ? "" : '<td class="ckc"><input type="checkbox" data-change="tool-import" data-k="' + h(k) + '"' + (on ? " checked" : "") + ' aria-label="Import ' + h(t.n) + '"></td>') +
      '<td><span class="mono tn">' + h(t.n) + "</span>" + flags + '<span class="sub">' + h(off ? "Turned off by " + personName(off.by) + " " + when(off.at) : t.d) + "</span></td>" +
      "<td>" + cval(c.risk, c.confirmed) + '</td><td class="mh">' + cval(c.side_effect, c.confirmed) + '</td><td class="mh">' + cval(c.egress, c.confirmed) + "</td>" +
      '<td class="mh">' + (c.impacts.length ? c.impacts.map(function (x) { return c.confirmed ? '<span class="chip mono">' + h(x) + "</span>" : '<span class="chip mono sugg">' + h(x) + "</span>"; }).join(" ") : '<span class="muted">None</span>') + "</td>" +
      '<td class="mh">' + (rules.length ? '<span class="apv">' + h(approvalLabel(rules)) + '</span><span class="sub mono">' + h(rules.map(function (r) { return r.id; }).join(", ")) + "</span>" : '<span class="muted">None</span>') + "</td>" +
      '<td class="num">' + num(t.tok) + "</td></tr>";
  }).join("");
  var more = list.length > shown.length ? '<div class="more"><button class="btn" data-act="toolmore">Show ' + Math.min(40, list.length - shown.length) + ' more</button><span class="muted">' + num(shown.length) + " of " + num(list.length) + "</span></div>" : "";
  return summary + bar + '<div class="panel"><div class="tw"><table class="tools"><thead><tr>' + (builtin ? "" : '<th class="ckc"><span class="sr">Import</span></th>') + '<th>Tool</th><th>Risk</th><th class="mh">Side effect</th><th class="mh">Egress</th><th class="mh">Impacts</th><th class="mh">Approval</th><th class="num">Tokens</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="8" class="muted">No tool matches.</td></tr>') + "</tbody></table></div>" + more + "</div>" +
    '<p class="muted small foot">An approval comes from a policy in <code>policy/</code> reading the tool\'s classification. Off stops a tool at once, with no steering PR.</p>';
}
ACTS.toolfilter = function (el) { S.toolFilter = el.getAttribute("data-f"); S.toolShow = 40; render(); };
ACTS.toolq = function (el) { S.toolQ = el.value; S.toolShow = 40; render(); };
ACTS.toolmore = function () { S.toolShow += 40; render(); };
ACTS.tool = function (el, ev) { if (ev && ev.target.closest("input, label")) return; openDrawer("tool", el.getAttribute("data-k")); };
function splitKey(k) { var i = k.indexOf("."); return { sid: k.slice(0, i), n: k.slice(i + 1) }; }
ACTS["tool-import"] = function (el) {
  var p = splitKey(el.getAttribute("data-k")), t = toolBy(p.sid, p.n);
  if (el.checked) { if (t.state === "available") stage(p.sid, { op: "import", tool: p.n }); else unstage(p.sid, "remove", p.n); }
  else { if (t.state === "available") unstage(p.sid, "import", p.n); else stage(p.sid, { op: "remove", tool: p.n }); }
  render();
};

/* ---- the tool panel ---- */
var RISKS = ["low", "medium", "high", "critical"], EFFECTS = ["read", "write", "irreversible"], EGRESS = ["local", "org_tenant", "third_party"];
function selectOf(id, k, field, vals, cur) {
  return '<select id="' + id + '" data-change="cls-set" data-k="' + h(k) + '" data-f="' + field + '">' + vals.map(function (v) { return "<option" + (v === cur ? " selected" : "") + ">" + h(v) + "</option>"; }).join("") + "</select>";
}
/* Where a suggested classification came from: the server's annotations, the HTTP method, the
   GraphQL root type, or the gRPC idempotency level. Nothing to go on gets the fail-safe. */
function suggestBasis(sv, t) {
  if (t.hint) return "the server's annotations, " + hintText(t);
  if (sv.source.type === "openapi" && t.method) return "the method, " + t.method.split(" ")[0] + ".";
  if (sv.source.type === "graphql") return "the root type, " + t.d.split(".")[0] + ".";
  if (sv.source.type === "grpc" && t.idempotency) return "the idempotency level, " + t.idempotency + ".";
  return "nothing. The server sent no annotations, so Studio used the fail-safe: write and high.";
}
function hintText(t) {
  if (!t.hint) return "No annotations.";
  return Object.keys(t.hint).map(function (x) { return x + " " + t.hint[x]; }).join(", ") + ".";
}
function draftFor(sid, t) {
  if (t.feedback && /cents/.test(JSON.stringify(t.feedback))) return "Refund part or all of a captured charge. amount is an integer in cents: send 4000 for $40.00. Leave amount out to refund the whole charge.";
  return descOf(sid, t).replace(/\.$/, "") + ". Returns " + (t.returns || t.select || ["the result"]).join(", ").replace(/data\[\]\./g, "") + ".";
}
DRAWERS.tool = function (k) {
  var p = splitKey(k), sv = serverBy(p.sid), t = sv && toolBy(p.sid, p.n);
  if (!t) return { title: "Tool", head: '<div class="grow"><h2>Not found</h2></div>', body: '<p class="muted">No tool with that name on this server.</p>' };
  var id = sv.id, c = classOf(id, t), off = toolOffBy(id, t), on = importedNow(id, t), rules = approvalFor(id, t), draft = S.drafts[k];
  var name = toolName(id, t.n), desc = draft || descOf(id, t);
  var stateLine = t.state === "available" ? (on ? "Importing in your changes" : "Nobody imported it, so no agent sees it.") : "Version " + t.version + (withheld(t) ? " withheld until sync PR #" + sv.syncPr + " merges" : "");
  var sw = t.state === "available" ? "" : '<div class="offrow"><div class="grow"><b>' + (off ? "Off" : "On") + "</b>" + (off ? '<span class="muted small">Turned off by ' + h(personName(off.by)) + " " + when(off.at) + (off.why ? ". " + h(off.why) : "") + "</span>" : '<span class="muted small">Turning it off acts on the next call, with no steering PR.</span>') + "</div>" +
    (off ? '<button class="btn sm" data-act="tool-on" data-k="' + h(k) + '">Turn on</button>' : '<button class="btn sm danger" data-act="tool-off" data-k="' + h(k) + '">Turn off</button>') + "</div>";
  var inputs = t.inputs ? '<table class="narrow mini"><thead><tr><th>Input</th><th>Type</th><th>Shaping</th></tr></thead><tbody>' + t.inputs.map(function (x) {
    return '<tr><td class="mono">' + h(x.name) + "</td><td>" + h(x.type) + (x.enum ? '<span class="sub mono">' + h(x.enum.join(", ")) + "</span>" : "") + "</td><td>" + (x.hidden ? badge("b-q", "Hidden") + " " : "") + (x.fixed ? "Fixed to <code>" + h(x.fixed) + "</code>" : x.required ? "Required" : x.note ? h(x.note) : '<span class="muted">As sent</span>') + "</td></tr>";
  }).join("") + "</tbody></table>" : '<p class="muted small">No hidden, fixed, or default inputs. The model sees the upstream input schema.</p>';
  if (t.idempotency_header) inputs += '<p class="small muted">The gateway sets <code>' + h(t.idempotency_header) + "</code> on every call, so a retried POST is not sent twice.</p>";
  var ret = t.select ? '<p class="small">Returns only <code>' + t.select.map(h).join("</code>, <code>") + "</code>. Everything else in the result is cut before the model reads it.</p>" : t.returns ? '<p class="small">Returns <code>' + t.returns.map(h).join("</code>, <code>") + "</code>, as the output schema says.</p>" : '<p class="small muted">The whole result, capped at 16,384 bytes.</p>';
  if (sv.featured && sv.featured.tool === t.n) ret += '<h4 class="ev-h">Selection set</h4><pre>' + h(sv.featured.selection) + "</pre>";
  if (t.streaming) ret += '<p class="small">A server stream, read until it ends, reaches ' + num(t.max_items) + " items, or passes " + num(t.deadline_ms) + " ms. The result says whether it was cut short.</p>";
  var says = '<p class="small"><code>' + h(hintText(t)) + "</code> “" + h(t.d) + "”</p>" + (t.method ? '<p class="small muted mono">' + h(t.method) + "</p>" : "") +
    (t.upstreamNew ? '<div class="warn small"><b>Upstream now says</b> “' + h(t.upstreamNew) + "” The gateway serves the locked definition until sync PR #" + sv.syncPr + " merges.</div>" : "") +
    (t.sync ? '<div class="warn small"><b>' + (t.sync.breaking ? "Breaking change" : "Upstream changed") + "</b> " + h(t.sync.note) + "</div>" : "");
  var fb = t.feedback ? '<div class="lst">' + t.feedback.reflections.map(function (r) { return '<div class="li"><span class="bd2"><span class="t1">' + h(r.text) + '</span><span class="t2">From reflections, ' + h(r.at) + "</span></span></div>"; }).join("") + "</div>" +
      '<p class="small">In the last 30 days the gateway counted ' + plural(t.feedback.rejections, "schema rejection") + ", " + plural(t.feedback.errors, "error result") + ", and " + plural(t.feedback.retries, "retry", "retries") + '.</p><button class="btn sm" data-act="desc-fix" data-k="' + h(k) + '">Draft a fix</button>' :
    '<p class="muted small">No reflection names this tool, and the gateway counted no schema rejections, error results, or retries in the last 30 days.</p>';
  return { title: name,
    head: '<div class="grow"><p class="eyebrow">Tool</p><h2 class="mono">' + h(name) + '</h2><span class="muted small">' + h(stateLine) + "</span></div>",
    body: sw +
      '<h3 class="sec">Classification</h3>' + (c.confirmed ? "" : '<p class="small"><span class="sugg">Suggested</span> from ' + h(suggestBasis(sv, t)) + " A person confirms or changes it before the steering PR opens.</p>") +
      '<div class="fields f3"><div class="field"><label for="tc-risk">Risk</label>' + selectOf("tc-risk", k, "risk", RISKS, c.risk) + '</div><div class="field"><label for="tc-se">Side effect</label>' + selectOf("tc-se", k, "side_effect", EFFECTS, c.side_effect) + '</div><div class="field"><label for="tc-eg">Egress</label>' + selectOf("tc-eg", k, "egress", EGRESS, c.egress) + "</div></div>" +
      '<div class="row">' + (c.impacts.length ? c.impacts.map(function (x) { return '<span class="chip mono">' + h(x) + "</span>"; }).join(" ") : '<span class="muted small">No impacts</span>') + (c.confirmed ? "" : '<span class="sp"></span><button class="btn sm primary" data-act="cls-confirm" data-k="' + h(k) + '">Confirm</button>') + "</div>" +
      '<h3 class="sec">Approval</h3>' + (rules.length ? '<div class="lst">' + rules.map(function (r) { return '<div class="li"><span class="bd2"><span class="t1">' + (r.cond ? "Asks a person " + h(r.cond) : "Asks a person on every call") + '</span><span class="t2"><code>' + h(r.id) + "</code> in <code>" + h(r.file) + "</code> reads it because " + mdi(r.when) + ".</span></span></div>"; }).join("") + "</div>" : '<p class="small muted">No policy in <code>policy/</code> asks a person for this classification. The agent\'s toolbelt decides who may call it.</p>') +
      '<h3 class="sec">Description</h3><div class="field"><textarea id="td-desc" rows="3" data-input="desc-edit" data-k="' + h(k) + '">' + h(desc) + '</textarea><div class="hint">' + num(desc.length) + " of 1,024 characters. It replaces the server's description in <code>tools.toml</code>.</div></div>" +
      (draft ? '<p class="small muted">Drafted by the in-app agent. It bills as in-app agent spend on the Billing page.</p>' : "") +
      '<div class="row"><button class="btn sm" data-act="desc-draft" data-k="' + h(k) + '">' + g("spark", 13) + ' Draft</button><button class="btn sm" data-act="desc-save" data-k="' + h(k) + '">Add to changes</button></div>' +
      '<h3 class="sec">Inputs</h3>' + inputs +
      '<h3 class="sec">Returns</h3>' + ret +
      '<h3 class="sec">What the server says</h3>' + says +
      '<h3 class="sec">Agent feedback</h3>' + fb +
      '<div class="dfoot"><button class="btn" data-act="close">Close</button>' + (on && t.state !== "available" ? '<button class="btn primary" data-act="tool-try" data-k="' + h(k) + '">Try it</button>' : "") + "</div>" };
};
ACTS["tool-off"] = function (el) { var k = el.getAttribute("data-k"); S.toolOff[k] = { by: viewer(), at: F.ORG.now }; toast(toolName(splitKey(k).sid, splitKey(k).n) + " is off. The next call is refused."); renderLayer(); render(); };
ACTS["tool-on"] = function (el) { var k = el.getAttribute("data-k"); S.toolOff[k] = false; toast(toolName(splitKey(k).sid, splitKey(k).n) + " is on."); renderLayer(); render(); };
ACTS["cls-set"] = function (el) {
  var k = el.getAttribute("data-k"), p = splitKey(k), t = toolBy(p.sid, p.n), c = classOf(p.sid, t);
  S.cls[k] = { risk: c.risk, side_effect: c.side_effect, egress: c.egress, impacts: c.impacts, confirmed: true };
  S.cls[k][el.getAttribute("data-f")] = el.value;
  stage(p.sid, { op: "classify", tool: p.n });
  renderLayer(); render();
};
ACTS["cls-confirm"] = function (el) {
  var k = el.getAttribute("data-k"), p = splitKey(k), c = classOf(p.sid, toolBy(p.sid, p.n));
  S.cls[k] = { risk: c.risk, side_effect: c.side_effect, egress: c.egress, impacts: c.impacts, confirmed: true };
  stage(p.sid, { op: "classify", tool: p.n });
  renderLayer(); render();
};
ACTS["desc-edit"] = function (el) { S.drafts[el.getAttribute("data-k")] = el.value; };
ACTS["desc-draft"] = function (el) { var k = el.getAttribute("data-k"), p = splitKey(k); S.drafts[k] = draftFor(p.sid, toolBy(p.sid, p.n)); renderLayer(); };
ACTS["desc-save"] = function (el) {
  var k = el.getAttribute("data-k"), p = splitKey(k), text = (document.getElementById("td-desc") || {}).value;
  stage(p.sid, { op: "describe", tool: p.n, text: text }); delete S.drafts[k];
  toast("Added to the changes for " + serverBy(p.sid).name + ". Review opens the steering PR."); renderLayer(); render();
};
ACTS["desc-fix"] = function (el) {
  var k = el.getAttribute("data-k"), p = splitKey(k);
  stage(p.sid, { op: "describe", tool: p.n, text: draftFor(p.sid, toolBy(p.sid, p.n)) });
  toast("Drafted a new description and added it to the changes. A person reviews it in the steering PR."); renderLayer(); render();
};
ACTS["tool-try"] = function (el) { var p = splitKey(el.getAttribute("data-k")); S.tryTool[p.sid] = p.n; S.tryRun[p.sid] = false; closeDialog(); S.srvTab = "try"; render(); };

/* ---- Connection ---- */
function connectionTab(sv) {
  var src = sv.source, a = sv.authcfg, kv = [];
  kv.push(["Source", h(sourceLabel(sv))]);
  if (src.type === "remote") kv.push(["URL", '<code>' + h(src.url) + "</code>"], ["Transport", h(src.transport === "sse" ? "SSE" : "Streamable HTTP")]);
  if (src.type === "registry") kv.push(["Registry entry", "<code>" + h(src.server) + "</code> version " + h(src.version)], ["Endpoint", "<code>" + h(src.url) + "</code>"]);
  if (src.type === "local") kv.push(["Command", "<code>" + h(src.command + " " + src.args.join(" ")) + "</code>"], ["Environment", src.env.map(function (e) { return "<code>" + h(e) + "</code>"; }).join(" ") + ' <span class="muted">passed from the machine. Values never enter the repository.</span>'],
    ["Package", "<code>" + h(src.package.name) + "</code> " + h(src.package.version) + ' <span class="mono muted small">' + h(src.package.digest.slice(0, 19)) + "…</span>"]);
  if (/openapi|graphql|grpc/.test(src.type)) kv.push(["Definition", "<code>" + h(src.repo + "/" + src.path) + "</code> at <code>" + h(src.ref) + "</code>" + (src.commit ? ", commit <code>" + h(src.commit) + "</code>" : "")], ["Folder", "<code>" + h(folderOf(sv) + (src.type === "openapi" ? "openapi.yaml" : src.type === "graphql" ? "schema.graphql" : "proto/")) + "</code>, as fetched"]);
  if (src.network) kv.push(["Network", "<code>" + h(src.network) + "</code>"]);
  kv.push(["Sync", h(sv.sync.schedule) + ", last " + when(sv.sync.last) + (sv.sync.reporter ? ", reported by <code>" + h(sv.sync.reporter) + "</code>" : "")]);
  var out = '<div class="grid g2"><div class="panel"><div class="panel-h"><h3>Source</h3></div><div class="panel-b"><dl class="kv">' + kv.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl></div></div>";
  out += '<div class="panel"><div class="panel-h"><h3>Authentication</h3></div><div class="panel-b">' + (src.type === "local" ? '<p class="small">A local server gets no credential from oxagen. It reads what the machine already has, named in its environment.</p>' :
    '<dl class="kv"><dt>Mode</dt><dd>' + h({ none: "None", service: "Service: one credential for every session", "operator-oauth": "Operator OAuth: the token of the person who operates the session" }[a.mode]) + "</dd>" + (a.scheme ? "<dt>Scheme</dt><dd>" + h(a.scheme) + "</dd>" : "") +
    (a.credential ? "<dt>Credential</dt><dd><code>" + h(a.credential) + "</code></dd>" : "") + "</dl>" +
    (a.mode !== "none" ? '<div class="field cred"><label for="cr-new">Replace the credential</label><input id="cr-new" type="password" placeholder="Paste a new secret"><div class="hint">It goes to oxagen\'s vault. A credential never reaches a steering PR or an agent\'s machine.</div></div><button class="btn sm" data-act="stub" data-what="Saving a credential">Save</button>' : "")) + "</div></div></div>";
  if (sv.environments) {
    out += '<div class="panel"><div class="panel-h"><h3>Environments</h3><span class="sp muted">An agent uses the sandbox unless its settings name another environment.</span></div><div class="tw"><table><thead><tr><th>Environment</th><th>URL</th><th>Network</th><th class="mh">Credential</th></tr></thead><tbody>' + sv.environments.map(function (e) {
      var r = relayOf(e.network);
      return "<tr><td><b>" + h(e.name) + "</b>" + (e.sandbox ? " " + badge("b-q", "Sandbox") : "") + '</td><td class="mono small">' + h(e.url || src.url || "") + "</td><td>" + (r ? "<code>" + h(e.network) + "</code> " + (r.r.state === "down" ? badge("b-failed", "Down", true) : badge("b-allowed", "Connected", true)) : "<code>cloud</code>") + '</td><td class="mh mono small">' + h(e.credential || a.credential || "") + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";
  }
  relaysOf(sv).forEach(function (r) {
    out += '<div class="panel pad relay"><div class="rl-h"><h3>Relay <code>' + h(r.name) + "</code></h3>" + (r.r.state === "down" ? badge("b-failed", "Down since " + hhmm(r.r.since), true) : badge("b-allowed", "Connected", true)) + '</div><dl class="kv"><dt>Runs in</dt><dd>' + h(r.r.where) + "</dd><dt>Version</dt><dd>" + h(r.r.version) + "</dd><dt>Allowed hosts</dt><dd>" + r.r.hosts.map(function (x) { return "<code>" + h(x) + "</code>"; }).join(" ") + "</dd>" +
      (r.r.state === "down" ? "<dt>Last seen</dt><dd>" + when(r.r.since) + "</dd>" : "<dt>Last seen</dt><dd>" + when(r.r.seen) + "</dd>") + '</dl><p class="small muted">The relay opens one outbound connection to oxagen and acts only on envelopes the cloud gateway signed. When that connection drops, it sends nothing until it reconnects.</p></div>';
  });
  if (a.mode === "operator-oauth" && sv.operators) {
    var linked = S.opLinked || {};
    out += '<div class="panel"><div class="panel-h"><h3>Operator accounts</h3><span class="sp muted">A call uses the token of the person who operates the session.</span></div><div class="tw"><table class="narrow"><thead><tr><th>Operator</th><th>Account</th></tr></thead><tbody>' + Object.keys(sv.operators).map(function (p) {
      var at = sv.operators[p] || (p === viewer() && linked[sv.id] ? F.ORG.now.slice(0, 10) : null);
      return "<tr><td>" + personAv(p, 20) + " " + h(personName(p)) + "</td><td>" + (at ? badge("b-allowed", "Connected " + at, true) : badge("b-approval", "Not connected", true) + (p === viewer() ? ' <button class="btn sm" data-act="op-link" data-id="' + sv.id + '">Connect your account</button>' : "")) + "</td></tr>";
    }).join("") + '</tbody></table></div><p class="muted small pad-s">Until an operator connects, every call in their sessions returns <code>Connect your ' + h(sv.name) + " account in oxagen, then retry.</code> with a link.</p></div>";
  }
  if (src.type === "local") {
    var groups = F.SERVERS.machineGroups;
    out += '<div class="grid g2"><div class="panel"><div class="panel-h"><h3>Machine groups</h3></div><div class="panel-b"><p class="small">It runs only on machines in a group that <code>source.machines</code> names, and only from the package the lock pins.</p><div class="lst">' + Object.keys(groups).map(function (gname) {
      var on = src.machines.indexOf(gname) >= 0;
      return '<div class="li"><span class="bd2"><span class="t1"><code>' + h(gname) + "</code> " + (on ? badge("b-allowed", "Named", true) : badge("b-q", "Not named")) + '</span><span class="t2 mono">' + h(groups[gname].join(", ")) + "</span></span></div>";
    }).join("") + '</div></div></div><div class="panel"><div class="panel-h"><h3>Errors from machines</h3><span class="sp muted">Last 24 hours</span></div><div class="panel-b"><div class="lst">' + sv.errors.map(function (e) {
      return '<div class="li"><span class="bd2"><span class="t1">' + h(e.text) + '</span><span class="t2"><code>' + h(e.machine) + "</code>, " + when(e.at) + ". " + h(e.fix) + "</span></span></div>";
    }).join("") + '</div><p class="small muted">The local gateway runs a call only on an envelope the cloud gateway signed. It keeps no decisions of its own and fails closed.</p></div></div></div>';
  }
  if (sv.exposure) {
    out += '<div class="panel"><div class="panel-h"><h3>Exposure</h3></div><div class="panel-b"><dl class="kv"><dt>Mode</dt><dd>' + (isSearch(sv) ? "Search: <code>" + sv.id + "__search</code>, <code>" + sv.id + "__describe</code>, and <code>" + sv.id + "__call</code>" : "Direct: one tool per imported tool") + "</dd><dt>Definition budget</dt><dd>" + num(sv.exposure.definition_budget) + " tokens for every definition together</dd>" +
      (isSearch(sv) ? '<dt>Ranking</dt><dd>' + h(embedLabel()) + ' <button class="linkbtn" data-act="embeddings">Change</button></dd>' : "") + "</dl></div></div>";
  }
  return out;
}

/* ---- Try it ---- */
function tryTab(sv) {
  var id = sv.id, ex = sv.tryit || {}, imp = sv.tools.filter(function (t) { return t.state !== "available"; });
  var tn = S.tryTool[id] || ex.tool || (imp[0] && imp[0].n), t = toolBy(id, tn);
  var envs = sv.environments ? sv.environments.map(function (e) { return e.name; }) : ["default"];
  var env = S.tryEnv[id] || ex.env || (sv.environments ? (sv.environments.filter(function (e) { return e.sandbox; })[0] || sv.environments[0]).name : "default");
  var form = '<div class="panel pad"><div class="fields f3"><div class="field"><label for="try-env">Environment</label><select id="try-env" data-change="try-env" data-id="' + id + '">' + envs.map(function (e) { return "<option" + (e === env ? " selected" : "") + ">" + h(e) + "</option>"; }).join("") + '</select></div>' +
    '<div class="field"><label for="try-tool">Tool</label><select id="try-tool" data-change="try-tool" data-id="' + id + '">' + imp.slice(0, 60).map(function (x) { return "<option" + (x.n === tn ? " selected" : "") + ">" + h(x.n) + "</option>"; }).join("") + "</select></div></div>" +
    '<div class="field"><label for="try-args">Arguments</label><textarea id="try-args" class="mono" rows="4">' + h(ex.tool === tn && ex.args ? ex.args : "{}") + '</textarea><div class="hint">Runs with your own credential, under the same policy an agent meets. Each Try it call is metered as one governed action.</div></div>' +
    '<button class="btn primary" data-act="try-run" data-id="' + id + '">' + g("play", 12) + " Run</button></div>";
  var res = "";
  if (S.tryRun[id]) {
    var envObj = (sv.environments || []).filter(function (e) { return e.name === env; })[0] || {}, r = relayOf(envObj.network || sv.source.network);
    var err = null;
    if (serverOffBy(sv) || (t && toolOffBy(id, t))) err = "The tool is off. The gateway refused the call and sent nothing upstream.";
    else if (t && withheld(t)) err = "<code>" + h(toolName(id, tn)) + "</code> is withheld until sync PR #" + sv.syncPr + " merges. The gateway refused the call.";
    else if (r && r.r.state === "down") err = "Relay <code>" + h(r.name) + "</code> is down. The call failed closed, and nothing was sent.";
    else if (sv.authcfg.mode === "operator-oauth" && !operatorLinked(sv, viewer()) && !(S.opLinked || {})[id]) err = "<code>Connect your " + h(sv.name) + " account in oxagen, then retry.</code>";
    if (err) res = '<div class="panel pad"><div class="rl-h"><h3>Result</h3>' + badge("b-failed", "isError", true) + '</div><p class="small">' + err + "</p></div>";
    else if (ex.tool === tn && ex.raw) {
      res = '<div class="panel pad"><div class="rl-h"><h3>Decision</h3></div><p class="small">' + h(ex.decision) + " Metered as one governed action.</p></div>" +
        '<div class="grid g3 tryg"><div class="readout"><div class="rh"><span>What went upstream</span></div><pre>' + h(ex.upstream) + '</pre></div><div class="readout"><div class="rh"><span>Raw result</span><span class="sp">' + num(ex.bytes[0]) + ' bytes</span></div><pre>' + h(ex.raw) + '</pre></div><div class="readout"><div class="rh"><span>What the model receives</span><span class="sp">' + num(ex.bytes[1]) + " bytes</span></div><pre>" + h(ex.shaped) + "</pre></div></div>" +
        '<div class="row"><button class="btn" data-act="try-save" data-id="' + id + '" data-t="' + h(tn) + '">Save as test</button><span class="muted small">It adds the call to <code>tests/calls.jsonl</code>. The compile check replays it with no network on every steering PR.</span></div>';
    } else res = '<div class="panel pad"><p class="muted small">No recorded result for <code>' + h(toolName(id, tn)) + "</code> in " + h(env) + " in this mockup.</p></div>";
  }
  return form + res;
}
ACTS["try-env"] = function (el) { S.tryEnv[el.getAttribute("data-id")] = el.value; S.tryRun[el.getAttribute("data-id")] = false; render(); };
ACTS["try-tool"] = function (el) { S.tryTool[el.getAttribute("data-id")] = el.value; S.tryRun[el.getAttribute("data-id")] = false; render(); };
ACTS["try-run"] = function (el) { S.tryRun[el.getAttribute("data-id")] = true; render(); };
ACTS["try-save"] = function (el) { var id = el.getAttribute("data-id"); stage(id, { op: "test", tool: el.getAttribute("data-t"), at: Date.now() }); toast("Saved as a test. It is in the changes for " + serverBy(id).name + "."); render(); };

/* ---- Changes: the steering PR a review opens ---- */
function stagedDiff(sv) {
  var id = sv.id, lines = [], files = {}, findings = [];
  staged(id).forEach(function (o) {
    var t = toolBy(id, o.tool), c = t ? classOf(id, t) : null, name = toolName(id, o.tool);
    if (o.op === "import") {
      lines.push({ op: "+", tool: name, what: "import: risk " + c.risk + ", side effect " + c.side_effect + ", egress " + c.egress + ", " + num(t.tok) + " tokens" });
      files["tools.toml"] = 1; files["tools.lock.json"] = 1;
      if (!c.confirmed) findings.push({ level: "error", text: "`" + name + "`: the classification is still a suggestion. Confirm it in the tool panel. A tool without risk, side_effect, and egress fails the schema check." });
      else if (c.side_effect === "irreversible" && !stagedOp(id, "classify", o.tool)) findings.push({ level: "info", text: "`" + name + "`: a suggestion accepted without a change on an irreversible tool. A reviewer should look at it." });
    }
    if (o.op === "remove") { lines.push({ op: "-", tool: name, what: "leaves the imports. Its rows stay for replay." }); files["tools.toml"] = 1; files["tools.lock.json"] = 1; }
    if (o.op === "classify" && !stagedOp(id, "import", o.tool)) { lines.push({ op: "~", tool: name, what: "classification: risk " + c.risk + ", side effect " + c.side_effect + ", egress " + c.egress }); files["tools.toml"] = 1; }
    if (o.op === "describe") { lines.push({ op: "~", tool: name, what: "description", detail: ["- " + (t.desc || t.d), "+ " + o.text] }); files["tools.toml"] = 1; if (o.text.length > 1024) findings.push({ level: "warning", text: "`" + name + "`: the description is over 1,024 characters." }); }
    if (o.op === "test") { lines.push({ op: "+", tool: "tests/calls.jsonl", what: "a recorded call to `" + name + "`" }); files["tests/calls.jsonl"] = 1; }
  });
  return { lines: lines, files: Object.keys(files).map(function (f) { return folderOf(sv) + f; }), findings: findings };
}
function changesTab(sv) {
  var id = sv.id, dfx = stagedDiff(sv), before = defsOf(sv, false), after = defsOf(sv, true), budget = sv.exposure.definition_budget;
  var errs = dfx.findings.filter(function (f) { return f.level === "error"; }).length;
  var mine;
  if (!dfx.lines.length) mine = '<div class="panel"><div class="state-wrap small"><p>No changes yet. Import a tool, confirm a classification, edit a description, or save a test, and it shows here.</p></div></div>';
  else {
    var pr = { server: id, diff: [{ head: folderOf(sv).replace(/\/$/, "") + "  your changes", lines: dfx.lines }], defs: [before, after] };
    mine = surfaceDiff(pr, true) +
      '<div class="panel"><div class="panel-h"><h3>Checks</h3><span class="sp"><code>Oxagen steering</code> ' + (errs ? badge("b-failed", "Would fail", true) : badge("b-allowed", "Would pass", true)) + "</span></div>" +
      [["schema", errs ? "fail" : "pass", errs ? "A classification is still a suggestion." : ""], ["compile", "pass", folderOf(sv) + " compiles. The lock is written by oxagen when the steering PR opens."], ["owned", "pass", "`tools.lock.json` is written by oxagen, never by hand."], ["references", "pass", ""]].map(function (c) {
        var b = CHECK_BADGE[c[1]]; return '<div class="ck"><span class="ck-n mono">' + c[0] + "</span>" + badge(b[0], b[1]) + '<div class="grow"><span class="muted small">' + mdi(c[2] || STEERING.checkNames[c[0]]) + "</span></div></div>";
      }).join("") +
      (dfx.findings.length ? '<div class="panel-h sub-h"><h3>Tool checks</h3></div>' + dfx.findings.map(function (f) { return '<div class="ck"><span class="ck-n">' + badge(f.level === "error" ? "b-failed" : f.level === "warning" ? "b-approval" : "b-q", f.level === "error" ? "Error" : f.level === "warning" ? "Warning" : "Info") + '</span><div class="grow small">' + mdi(f.text) + "</div></div>"; }).join("") : "") + "</div>" +
      '<div class="panel pad"><div class="rl-h"><h3>Files</h3><span class="muted">' + plural(dfx.files.length, "file") + '</span></div><div class="flist">' + dfx.files.map(function (f) { return '<span class="mono">' + h(f) + "</span>"; }).join("") + "</div></div>" +
      '<div class="row"><button class="btn primary" data-act="changes-pr" data-id="' + id + '"' + (errs ? " disabled" : "") + '>Open steering PR</button><button class="btn ghost" data-act="changes-discard" data-id="' + id + '">Discard</button><span class="muted small">Definitions ' + num(before) + " → " + num(after) + " tokens per request, budget " + num(budget) + ".</span></div>";
  }
  var open = allPrs().filter(function (p) { return p.server === id && p.state !== "merged"; });
  var theirs = open.map(function (p) {
    return '<div class="panel pad"><div class="rl-h"><h3>Steering PR #' + p.n + "</h3>" + prStateBadge(p) + '</div><p class="small">' + h(p.title) + ". " + mdi(p.summary || "") + '</p><button class="btn sm" data-go="steering|pr-' + p.n + '">View steering PR #' + p.n + "</button></div>" + (p.diff ? surfaceDiff(p, true) : "");
  }).join("");
  return '<h3 class="sec">Your changes</h3>' + mine + (theirs ? '<h3 class="sec">Open steering PRs</h3>' + theirs : "");
}
ACTS["changes-discard"] = function (el) { var id = el.getAttribute("data-id"); S.staged[id] = []; Object.keys(S.cls).forEach(function (k) { if (k.indexOf(id + ".") === 0) delete S.cls[k]; }); render(); };
ACTS["changes-pr"] = function (el) {
  var id = el.getAttribute("data-id"), sv = serverBy(id), dfx = stagedDiff(sv), n = nextPrNumber();
  var imports = staged(id).filter(function (o) { return o.op === "import"; }).length;
  S.newPrs.push({ n: n, kind: "server", server: id, state: "open", title: imports ? "Import " + plural(imports, "tool") + " into " + id : "Change " + id + " in MCP Studio", branch: "tools/" + id + "-studio-" + n, by: ME, via: "studio", opened: F.ORG.now, approvals: [],
    summary: "Opened from MCP Studio. The tools and their classification reach agents when it merges.",
    diff: [{ head: "tools/servers/" + id, lines: dfx.lines }], defs: [defsOf(sv, false), defsOf(sv, true)], files: dfx.files,
    checks: [{ id: "schema", r: "pass" }, { id: "compile", r: "pass", note: "tools/servers/" + id + " compiles. The lock matches the reviewed definitions." }, { id: "owned", r: "pass" }, { id: "references", r: "pass" }, { id: "settings", r: "pass" }],
    findings: dfx.findings });
  S.staged[id] = [];
  go("steering", "pr-" + n);
  toast("Opened steering PR #" + n + ". The tools reach agents when it merges.");
};

/* ---- the server drawer: a summary, opened from an agent ---- */
ACTS.server = function (el) { openDrawer("server", el.getAttribute("data-id")); };
DRAWERS.server = function (id) {
  var sv = serverBy(id), st = serverStats(id);
  var unused = st.unused.length && sv.source.type !== "builtin" ? '<div class="banner"><div class="grow"><b>' + plural(st.unused.length, "imported tool") + " not called this month</b>" + st.unused.map(function (t) { return "<code>" + h(t.n) + "</code>"; }).join(" ") + "<br>Their definitions add " + num(st.unusedTok) + " tokens to every request. Removing them would have saved about " + money(st.save) + " this month.</div><button class=\"btn sm\" data-act=\"tools-off\" data-id=\"" + id + '">Remove them</button></div>' : "";
  var tools = sv.tools.filter(function (t) { return t.state !== "available"; }).map(function (t) {
    var off = toolOffBy(id, t), rules = approvalFor(id, t);
    return "<tr><td><span class=\"mono\">" + h(t.n) + '</span><span class="sub">' + h(t.d) + '</span></td><td class="num">' + (st.perTool[t.n] ? num(st.perTool[t.n]) : '<span class="muted">0</span>') + "</td><td>" + (rules.length ? '<span class="apv">' + h(approvalLabel(rules)) + '</span><span class="sub mono">' + h(rules.map(function (r) { return r.id; }).join(", ")) + "</span>" : '<span class="muted">None</span>') + "</td><td>" + (off ? badge("b-q", "Off", true) : badge("b-allowed", "On", true)) + "</td></tr>";
  }).join("");
  return { title: sv.name,
    head: '<div class="grow row">' + serverMark(sv, 34) + "<div><h2>" + h(sv.name) + '</h2><span class="muted mono">' + h(folderOf(sv) || "Built in") + "</span></div></div>",
    body: '<div class="grid g3 tiles">' + stat("Calls", num(st.calls), "this month") + stat("Cost", money(st.cost), "definitions and results") + stat("Definitions", num(st.defTok), "tokens in every request") + "</div>" + unused +
      '<h3 class="sec">Credential</h3><div class="keyc">' + g(sv.authKind === "key" ? "key" : "lock", 15) + "<div><b>" + h(sv.auth) + '</b><span class="muted">' + h(sv.keyNote) + "</span></div></div>" +
      '<h3 class="sec">Imported tools</h3><p class="muted small">Every agent in the workspace gets these, narrowed by policy. An approval comes from a policy reading the tool\'s classification.</p><div class="tw"><table class="narrow tools"><thead><tr><th>Tool</th><th class="num">Calls</th><th>Approval</th><th>State</th></tr></thead><tbody>' + tools + "</tbody></table></div>" +
      '<div class="dfoot"><button class="btn" data-act="close">Close</button>' + (sv.source.type === "builtin" ? "" : '<button class="btn primary" data-go="servers|' + id + '">Open the server</button>') + "</div>" };
};
ACTS["tools-off"] = function (el) {
  var id = el.getAttribute("data-id"), st = serverStats(id);
  st.unused.forEach(function (t) { stage(id, { op: "remove", tool: t.n }); });
  toast(plural(st.unused.length, "tool") + " staged to leave tools/servers/" + id + "/tools.toml. Review opens the steering PR.");
  renderLayer(); render();
};
/* ---- Search ranking: a workspace setting, changed by steering PR ---- */
ACTS.embeddings = function () { openDialog("embeddings"); };
DIALOGS.embeddings = function (arg, d) {
  var e = F.SERVERS.embeddings; d.pick = d.pick || e.provider;
  var opts = [["oxagen", "oxagen", "The default. " + e.vendor + " " + e.model + " on oxagen's key. oxagen absorbs the cost."], ["custom", "Your endpoint", "Your own URL, model, and key. You pay for your embeddings."], ["keyword", "Keyword", "Keyword matching. Nothing is sent to any embedding provider."]];
  return { title: "Search ranking", sub: "How a server in search mode ranks its tools, set in <code>workspace.toml</code> by steering PR.",
    body: opts.map(function (o) { return '<label class="check"><input type="radio" name="emb" value="' + o[0] + '" data-change="emb-pick"' + (d.pick === o[0] ? " checked" : "") + '><span class="grow"><span class="n">' + h(o[1]) + (o[0] === e.provider ? ' <span class="b b-q">Current</span>' : "") + '</span><span class="d">' + h(o[2]) + "</span></span></label>"; }).join("") +
      (d.pick === "custom" ? '<div class="fields"><div class="field"><label for="emb-url">URL</label><input id="emb-url" data-input="emb-url" value="' + h(d.url != null ? d.url : e.custom.url) + '"></div><div class="field"><label for="emb-model">Model</label><input id="emb-model" data-input="emb-model" value="' + h(d.model != null ? d.model : e.custom.model) + '"></div></div><div class="field"><label for="emb-key">Key</label><input id="emb-key" type="password" placeholder="Paste the key"><div class="hint">It goes to oxagen\'s vault as <code>' + h(e.custom.credential) + "</code>, never into the repository.</div></div>" : "") +
      '<p class="muted small">Changing the model or the endpoint re-embeds every search entry in the workspace.</p>',
    foot: '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="emb-go"' + (d.pick === e.provider ? " disabled" : "") + ">Open steering PR</button>" };
};
ACTS["emb-pick"] = function (el) { S.dialog.pick = el.value; renderLayer(); };
/* What the person types survives a redraw of the dialog, and the steering PR carries it. */
ACTS["emb-url"] = function (el) { S.dialog.url = el.value; };
ACTS["emb-model"] = function (el) { S.dialog.model = el.value; };
ACTS["emb-go"] = function () {
  var d = S.dialog, pick = d.pick, e = F.SERVERS.embeddings, n = nextPrNumber();
  var field = function (id, typed, dflt) { var el = document.getElementById(id); return String(el ? el.value : typed != null ? typed : dflt).trim(); };
  var url = pick === "custom" ? field("emb-url", d.url, e.custom.url) : "", model = pick === "custom" ? field("emb-model", d.model, e.custom.model) : "";
  if (pick === "custom" && (!url || !model)) { toast("Enter the URL and the model of your endpoint."); return; }
  var diff = pick === "custom" ? "+[embeddings]\n+provider = \"custom\"\n+url = \"" + url + "\"\n+model = \"" + model + "\"\n+credential = \"" + e.custom.credential + "\"" : "+[embeddings]\n+provider = \"" + pick + "\"";
  S.newPrs.push({ n: n, kind: "workspace", state: "open", title: "Rank search mode with " + (pick === "custom" ? model : pick), branch: "workspace/embeddings-" + pick, by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Changes how search mode ranks tools. oxagen re-embeds every search entry when it merges.",
    files: [{ path: "workspace.toml", diff: diff }],
    checks: [{ id: "schema", r: "pass" }, { id: "references", r: "pass" }, { id: "owned", r: "pass" }] });
  closeDialog(); go("steering", "pr-" + n); toast("Opened steering PR #" + n + ".");
};

/* ---- Import from each harness's config ---- */
ACTS.serverimport = function () { openDialog("serverimport"); };
function serverImport() {
  var im = F.SERVERS.import, entries = [], keys = 0, srv = [];
  im.found.forEach(function (m) { m.entries.forEach(function (e) { entries.push(e); if (e.key === "plaintext") keys++; if (srv.indexOf(e.server) < 0) srv.push(e.server); }); });
  return { im: im, entries: entries, keys: keys, servers: srv };
}
DIALOGS.serverimport = function () {
  var x = serverImport(), im = x.im, open = S.importPr.servers;
  return { title: "Import MCP servers", wide: true, sub: "Import opens one steering PR with a folder per server, and nothing changes until it merges.",
    body: im.found.map(function (m) {
      return '<div class="imp"><div class="imp-h">' + g("dir", 14) + ' <b class="mono">' + h(m.machine) + '</b><span class="mono muted">' + h(m.file) + "</span><span class=\"muted\">" + h(personName(m.person)) + "</span></div>" + m.entries.map(function (e) {
        return '<div class="imp-e"><span class="mono">' + h(e.name) + "</span><span class=\"muted\">" + h(e.note) + "</span>" + (e.key === "plaintext" ? badge("b-denied", "Key in plaintext", true) : "") + (e.dupe ? badge("b-q", "Duplicate") : "") + "</div>";
      }).join("") + "</div>";
    }).join("") + '<div class="note">When the steering PR merges, oxagen moves the ' + plural(x.keys, "key") + " into its vault and rewrites each config to point at " + h(F.SERVERS.gateway) + ". No key stays on a laptop.</div>",
    foot: '<span class="grow">' + plural(x.entries.length, "entry", "entries") + ", " + plural(x.servers.length, "server") + ", " + plural(x.keys, "key") + " in plaintext.</span>" +
      (open ? '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-go="steering|pr-' + open + '">View steering PR #' + open + "</button>" : '<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="serverimport-go">Open steering PR</button>') };
};
/* server.toml for an imported server: its source as the harness config named it, and a credential
   reference. The key itself goes to the vault, never into the file. */
function importedServerToml(id) {
  var sv = serverBy(id), c = F.SERVERS.catalog.filter(function (x) { return x.id === id; })[0];
  var l = ["#:schema https://oxagen.sh/schemas/mcp-server/v1.json", 'schema = "mcp-server/v1"', 'name = "' + id + '"', "", "[source]"];
  if (sv && sv.source.type === "registry") l.push('type = "registry"', 'server = "' + sv.source.server + '"', 'version = "' + sv.source.version + '"');
  else if (sv) { l.push('type = "remote"', 'url = "' + sv.source.url + '"', 'transport = "' + sv.source.transport + '"'); if (sv.source.network) l.push('network = "' + sv.source.network + '"'); }
  else if (c) l.push('type = "registry"', 'server = "' + c.reg + '"');
  l.push("", "[auth]", 'mode = "service"', 'credential = "' + (sv && sv.authcfg.credential || "oxagen:credential/" + id) + '"');
  return { path: "tools/servers/" + id + "/server.toml", diff: l.map(function (x) { return "+" + x; }).join("\n") };
}
ACTS["serverimport-go"] = function () {
  var x = serverImport(), n = nextPrNumber();
  S.newPrs.push({ n: n, kind: "import", target: "servers", state: "open", title: "Import " + plural(x.servers.length, "MCP server"), branch: "tools/import", by: ME, via: "web", opened: F.ORG.now, approvals: [],
    summary: "Adds a folder for each server the harness configs on " + plural(x.im.machines, "machine") + " name. No agent reaches them through the gateway until this merges.",
    note: "When this merges, oxagen moves the " + plural(x.keys, "key") + " into its vault and points each config at `" + F.SERVERS.gateway + "`.",
    files: x.servers.map(importedServerToml),
    checks: [{ id: "schema", r: "pass" }, { id: "compile", r: "pass" }, { id: "references", r: "pass" }, { id: "secrets", r: "pass", note: "No key is in a file. Each server names a credential reference." }, { id: "owned", r: "pass" }] });
  S.importPr.servers = n;
  closeDialog(); go("steering", "pr-" + n); toast("Opened steering PR #" + n + ". Nothing changes until it merges.");
};

/* ---- Add server: four sources, each ending in what discovery found ---- */
var SOURCES = [
  ["url", "Connect by URL", "An MCP server you already run or use, by its endpoint."],
  ["registry", "From the registry", "A server listed in the MCP registry."],
  ["local", "Local command", "A command the local gateway runs on machines you name."],
  ["definition", "From a definition", "An API with an OpenAPI, GraphQL, or gRPC definition and no MCP server."],
];
var DEF_TARGET = { openapi: "billing", graphql: "crm", grpc: "ledger" };
function addTarget(d) {
  if (d.src === "url") return "stripe";
  if (d.src === "local") return "warehouse";
  if (d.src === "definition") return DEF_TARGET[d.fmt || "openapi"];
  var c = F.SERVERS.catalog.filter(function (x) { return x.id === d.pick; })[0];
  return c && c.server || null;
}
ACTS.addserver = function () { openDialog("addserver"); };
DIALOGS.addserver = function (arg, d) {
  if (d.q && !d.init) { d.init = true; d.src = d.q.src || null; d.fmt = d.q.fmt || "openapi"; d.phase = d.q.phase || null; d.pick = d.q.pick || null; }
  d.fmt = d.fmt || "openapi";
  if (!d.src) {
    return { title: "Add server", wide: true, sub: "Every source then takes the same path: discover, import, review, and publish.",
      body: '<div class="srcpick">' + SOURCES.map(function (s) { return '<button class="srcp" data-act="as-src" data-src="' + s[0] + '"><b>' + h(s[1]) + '</b><span class="muted small">' + h(s[2]) + "</span></button>"; }).join("") + "</div>",
      foot: '<button class="btn" data-act="close">Cancel</button>' };
  }
  var back = '<button class="btn" data-act="as-back">Back</button>';
  if (d.phase === "result") return discoveryResult(d, back);
  var body = "", goLabel = "Discover tools";
  if (d.src === "url") {
    body = '<div class="fields"><div class="field"><label for="as-name">Name</label><input id="as-name" value="stripe"><div class="hint">The folder <code>tools/servers/stripe/</code> and the prefix of every tool name.</div></div><div class="field"><label for="as-url">URL</label><input id="as-url" value="https://mcp.stripe.com"></div></div>' +
      '<div class="fields"><div class="field"><label for="as-tr">Transport</label><select id="as-tr"><option>Streamable HTTP</option><option>SSE</option></select></div><div class="field"><label for="as-auth">Authentication</label><select id="as-auth"><option>Service: one credential for every session</option><option>Operator OAuth</option><option>None</option></select></div></div>' +
      '<div class="fields"><div class="field"><label for="as-key">Credential</label><input id="as-key" type="password" placeholder="Paste the key"><div class="hint">It goes to oxagen\'s vault as <code>oxagen:credential/stripe-live</code>. It never reaches a steering PR.</div></div><div class="field"><label for="as-net">Network</label><select id="as-net"><option>cloud</option>' + Object.keys(F.SERVERS.relays).map(function (r) { return "<option>relay:" + h(r) + "</option>"; }).join("") + '</select><div class="hint">A server inside a private network goes through a relay.</div></div></div>';
  } else if (d.src === "registry") {
    d.pick = d.pick || "slack";
    body = '<div class="catalog">' + F.SERVERS.catalog.map(function (c) {
      var added = c.server && serverBy(c.server);
      return '<button class="cat' + (d.pick === c.id ? " on" : "") + '" data-act="as-pick" data-id="' + c.id + '" aria-pressed="' + (d.pick === c.id) + '">' + serverMark(c, 30) + "<span><b>" + h(c.name) + (added ? ' <span class="b b-q">Added</span>' : "") + '</b><span class="muted mono small">' + h(c.reg) + '</span><span class="muted">' + h(c.d) + "</span></span></button>";
    }).join("") + "</div>";
    var c = F.SERVERS.catalog.filter(function (x) { return x.id === d.pick; })[0];
    body += '<dl class="kv"><dt>Version</dt><dd>' + h(c.version) + "</dd><dt>Runs</dt><dd>" + (c.kind === "package" ? "As a package on your machines, through the local gateway" : "At the endpoint the registry entry names") + "</dd><dt>Authentication</dt><dd>" + (c.auth === "oauth" ? "OAuth" : "A key") + "</dd></dl>";
  } else if (d.src === "local") {
    body = '<div class="fields"><div class="field"><label for="as-cmd">Command</label><input id="as-cmd" class="mono" value="uvx"></div><div class="field"><label for="as-args">Arguments</label><input id="as-args" class="mono" value="warehouse-mcp==1.4.2 --read-only"></div></div>' +
      '<div class="field"><label for="as-env">Environment variables</label><input id="as-env" class="mono" value="WAREHOUSE_DSN"><div class="hint">Names only. The local gateway passes their values from the agent\'s machine, and the values never enter the repository.</div></div>' +
      '<div class="field"><label>Machine groups</label><div class="agpick">' + Object.keys(F.SERVERS.machineGroups).map(function (gname, i) { return '<label class="check"><input type="checkbox"' + (i === 0 ? " checked" : "") + '><span class="grow"><span class="n">' + h(gname) + '</span><span class="d">' + plural(F.SERVERS.machineGroups[gname].length, "machine") + "</span></span></label>"; }).join("") + '</div><div class="hint">A local server runs nowhere until a steering PR names a group. Discovery runs on the first machine in the group.</div></div>';
  } else {
    goLabel = "Compile the definition";
    var FROM = { openapi: [["repository", "A file in a linked repository"], ["url", "A URL"], ["upload", "An upload"]], graphql: [["repository", "A file in a linked repository"], ["url", "A URL"], ["upload", "An upload"], ["introspection", "An introspection query"]], grpc: [["repository", "Proto files in a linked repository"], ["upload", "An upload"], ["reflection", "Server reflection"]] };
    var DEF = { openapi: ["github.com/a-intel/billing-service", "openapi/billing.yaml"], graphql: ["github.com/a-intel/crm-api", "schema/crm.graphql"], grpc: ["github.com/a-intel/ledger", "proto/ledger/v1/ledger.proto"] }[d.fmt];
    body = '<div class="field"><label>Format</label><div class="seg wide">' + [["openapi", "OpenAPI"], ["graphql", "GraphQL"], ["grpc", "gRPC"]].map(function (f) { return '<button class="btn sm" data-act="as-fmt" data-f="' + f[0] + '" aria-pressed="' + (d.fmt === f[0]) + '">' + f[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="fields"><div class="field"><label for="as-from">From</label><select id="as-from">' + FROM[d.fmt].map(function (x) { return "<option>" + h(x[1]) + "</option>"; }).join("") + '</select></div><div class="field"><label for="as-repo">Repository</label><select id="as-repo"><option>' + h(DEF[0]) + "</option>" + REPO.linked.map(function (r) { return r.url === DEF[0] ? "" : "<option>" + h(r.url) + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="fields"><div class="field"><label for="as-path">Path</label><input id="as-path" class="mono" value="' + h(DEF[1]) + '"></div><div class="field"><label for="as-ref">Ref</label><input id="as-ref" class="mono" value="main"><div class="hint">A push that changes the file opens a sync PR.</div></div></div>' +
      '<p class="muted small">No code is generated and nothing is deployed. oxagen compiles the definition to tools and serves them through the gateway.</p>';
  }
  return { title: SOURCES.filter(function (s) { return s[0] === d.src; })[0][1], wide: true, sub: h(SOURCES.filter(function (s) { return s[0] === d.src; })[0][2]),
    body: body, foot: back + '<button class="btn primary" data-act="as-discover">' + h(goLabel) + "</button>" };
};
function discoveryResult(d, back) {
  var id = addTarget(d), sv = id && serverBy(id), c = d.src === "registry" ? F.SERVERS.catalog.filter(function (x) { return x.id === d.pick; })[0] : null;
  var rows, total, head;
  if (sv) {
    total = sv.tools.length;
    rows = sv.tools.slice(0, 12).map(function (t) { return '<tr><td class="mono">' + h(t.n) + '</td><td><span class="sugg">' + h(t.side_effect) + '</span></td><td><span class="sugg">' + h(t.risk) + '</span></td><td class="num mh">' + num(t.tok) + "</td></tr>"; }).join("");
  } else {
    total = c.offers;
    rows = c.sample.map(function (s) { var r = s[1] === "read" ? "low" : s[1] === "write" ? "medium" : "high"; return '<tr><td class="mono">' + h(s[0]) + '</td><td><span class="sugg">' + h(s[1]) + '</span></td><td><span class="sugg">' + r + '</span></td><td class="num mh">' + num(160 + s[0].length * 9) + "</td></tr>"; }).join("");
  }
  var word = d.src === "definition" ? { openapi: "operation", graphql: "root field", grpc: "method" }[d.fmt] : "tool";
  head = d.src === "definition" ? "Compiled <code>" + h(sv.source.path) + "</code> at <code>" + h(sv.source.commit) + "</code>" : d.src === "local" ? "<code>mbell-mbp-16</code> in <code>dev-laptops</code> ran the command and reported <code>tools/list</code>" : "The gateway called <code>tools/list</code>";
  var nots = sv && sv.notTools ? '<h3 class="sec">Unsupported capabilities</h3><div class="lst">' + sv.notTools.map(function (x) { return '<div class="li"><span class="bd2"><span class="t1 mono">' + h(x.n) + '</span><span class="t2">' + h(x.why) + "</span></span></div>"; }).join("") + "</div>" : "";
  var big = sv && sv.generate ? '<div class="note">The imported definitions would pass the ' + num(sv.exposure.definition_budget) + "-token budget, so Studio suggests search mode.</div>" : "";
  return { title: "Discovery result", wide: true, sub: head + ".",
    body: '<p><b>' + plural(total, word) + "</b> offered. Studio suggests a classification for each from the server's annotations or the method. Grey values are suggestions.</p>" +
      '<div class="tw"><table class="narrow"><thead><tr><th>Name</th><th>Side effect</th><th>Risk</th><th class="num mh">Tokens</th></tr></thead><tbody>' + rows + "</tbody></table></div>" + (total > 12 && sv ? '<p class="muted small">And ' + plural(total - 12, "more " + word) + ".</p>" : "") + nots + big +
      '<p class="muted small">Nothing is imported yet. What discovery found stays in oxagen, not in the repository, and no agent sees it until a steering PR imports it.</p>',
    foot: back + (sv ? '<button class="btn primary" data-act="as-open" data-id="' + id + '">Import tools</button>' : '<button class="btn primary" data-act="stub" data-what="Importing from ' + h(c.name) + '">Import tools</button>') };
}
ACTS["as-src"] = function (el) { S.dialog.src = el.getAttribute("data-src"); S.dialog.phase = null; renderLayer(); };
ACTS["as-fmt"] = function (el) { S.dialog.fmt = el.getAttribute("data-f"); renderLayer(); };
ACTS["as-pick"] = function (el) { S.dialog.pick = el.getAttribute("data-id"); renderLayer(); };
ACTS["as-discover"] = function () { S.dialog.phase = "result"; renderLayer(); };
ACTS["as-back"] = function () { if (S.dialog.phase) S.dialog.phase = null; else { S.dialog.src = null; S.dialog.pick = null; } renderLayer(); };
ACTS["as-open"] = function (el) { var id = el.getAttribute("data-id"); closeDialog(); go("servers", id); S.toolFilter = "available"; render(); };

/* ============================== Spend ============================== */
VIEWS.spend = function () {
  var head = phead("Spend", "What every session cost, from its own model requests.");
  if (S.empty) return { crumb: [["Spend"]], html: head + empty("spend", "Nothing spent yet", "Spend fills in from the first session. Every figure is a sum of recorded model requests.", "") };
  var total = monthTotal(), days = dailySpend(), max = days.reduce(function (m, d) { return Math.max(m, d.cost); }, 0) || 1;
  var yMax = Math.ceil(max / 10) * 10;
  var bars = days.map(function (d, i) {
    var hgt = d.cost / yMax * 100;
    return '<div class="dbar' + (dayLabel(d.date) === "Today" ? " today" : "") + '" title="' + MON[d.date.getMonth()] + " " + d.date.getDate() + ": " + money(d.cost) + '"><i style="height:' + hgt.toFixed(1) + '%"></i><span class="dl">' + (i % 3 === 0 || i === days.length - 1 ? d.date.getDate() : "") + "</span></div>";
  }).join("");
  var chart = '<div class="panel pad spendtop"><div class="sp-total"><span class="k">' + h(F.ORG.month.label) + '</span><span class="big num">' + money(total) + '</span><span class="muted">September 1 to 25, ' + plural(sessions().length, "session") + '</span></div><div class="dchart" role="img" aria-label="Spend by day"><div class="dgrid"><span>$' + num(yMax) + "</span><span>$" + num(yMax / 2) + "</span><span>$0</span></div><div class=\"dbars\">" + bars + "</div></div></div>";
  var seg = '<div class="seg">' + SPEND_BY.map(function (b) { return '<button class="btn sm" data-act="spendby" data-by="' + b.key + '" aria-pressed="' + (S.spendBy === b.key) + '">' + b.label + "</button>"; }).join("") + "</div>";
  var rows = spendRows(S.spendBy), rmax = rows.reduce(function (m, r) { return Math.max(m, r.rest ? 0 : r.cost); }, 0) || 1;
  var sum = rows.reduce(function (t, r) { return t + r.cost; }, 0);
  var body = rows.map(function (r) {
    var open = S.spendOpen === r.key, lab;
    if (r.agent) lab = agentCell(r.agent);
    else if (r.person) lab = '<span class="nowrap">' + personAv(r.person, 22) + " " + h(r.label) + "</span>";
    else if (r.wi) lab = wiCell(r.wi);
    else if (r.server) lab = '<span class="srvc">' + serverMark(serverBy(r.server), 22) + "<b>" + h(r.label) + "</b></span>";
    else lab = "<b>" + h(r.label) + "</b>" + (r.note ? '<span class="sub">' + h(r.note) + "</span>" : "");
    var tr = '<tr class="click' + (open ? " open" : "") + '" data-act="spendrow" data-key="' + h(r.key) + '"><td>' + lab + '</td><td class="num mh">' + (r.rest ? "" : num(r.sessions.length)) + '</td><td class="num mh">' + (r.rest ? "" : tok(r.tokens)) + '</td><td class="share"><span class="shb"><i style="width:' + (r.rest ? 0 : r.cost / rmax * 100).toFixed(1) + '%"></i></span><span class="num muted">' + (r.cost / total * 100).toFixed(1) + '%</span></td><td class="num"><b>' + money(r.cost) + "</b></td></tr>";
    if (open && !r.rest) {
      var top = r.sessions.slice().sort(function (a, b) { return (r.server ? b.cost.by["mcp:" + r.server] - a.cost.by["mcp:" + r.server] : b.cost.total - a.cost.total); }).slice(0, 8);
      tr += '<tr class="drill"><td colspan="5"><div class="lst">' + top.map(function (s) {
        var a = agentBy(s.agent), c = r.server ? s.cost.by["mcp:" + r.server] : s.cost.total;
        return '<a class="li" href="' + href("sessions", s.id) + '" data-go="sessions|' + s.id + '">' + agentAv(a, 22) + '<span class="bd2"><span class="t1">' + h(s.title) + (s.transcript ? ' <span class="b b-approval">Replay</span>' : "") + '</span><span class="t2">' + pts([h(a.name), h(personName(s.person)), when(s.started)]) + '</span></span><b class="num">' + money(c) + "</b></a>";
      }).join("") + (r.sessions.length > 8 ? '<div class="li muted">' + plural(r.sessions.length - 8, "more session") + "</div>" : "") + "</div></td></tr>";
    }
    return tr;
  }).join("");
  var table = '<div class="panel"><div class="panel-h"><h3>By ' + h(SPEND_BY.filter(function (b) { return b.key === S.spendBy; })[0].label.toLowerCase()) + '</h3><span class="sp">' + seg + '</span></div><div class="tw"><table class="spend"><thead><tr><th>' + h(SPEND_BY.filter(function (b) { return b.key === S.spendBy; })[0].label) + '</th><th class="num mh">Sessions</th><th class="num mh">Tokens</th><th>Share</th><th class="num">Cost</th></tr></thead><tbody>' + body +
    '</tbody><tfoot><tr><td>Total</td><td class="mh"></td><td class="mh"></td><td></td><td class="num"><b>' + money(sum) + "</b></td></tr></tfoot></table></div></div>";
  var cursorCost = sessions().filter(function (s) { return s.basis === "harness"; }).reduce(function (t, s) { return t + s.cost.total; }, 0);
  return { crumb: [["Spend"]], html: head + chart + table + '<p class="muted small foot">Every figure is recorded model requests at list price. ' + money(cursorCost) + " came from Cursor, which reports its own usage because its model calls do not pass through the oxagen gateway. The gateway metered the rest.</p>" };
};
ACTS.spendby = function (el) { S.spendBy = el.getAttribute("data-by"); S.spendOpen = null; render(); };
ACTS.spendrow = function (el, ev) { if (ev.target.closest("a")) return; var k = el.getAttribute("data-key"); S.spendOpen = S.spendOpen === k ? null : k; render(); };

/* ---- the account dialog: theme and the settings v3 leaves out ---- */
DIALOGS.account = function () {
  var me = PEOPLE[ME];
  return { title: me.name, sub: h(me.email),
    body: '<div class="field"><label>Theme</label><div class="seg wide">' + [["", "System"], ["light", "Light"], ["dark", "Dark"]].map(function (t) { return '<button class="btn sm" data-act="theme" data-t="' + t[0] + '" aria-pressed="' + ((S.theme || "") === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="lst">' + [["Members", "Invite people and set roles"], ["Billing", "Plan, invoices and the model funding"], ["API keys", "Keys for the oxagen API"], ["Audit log", "Every action anyone took"]].map(function (x) {
        return '<button class="li linkish" data-act="stub" data-what="' + x[0] + '"><span class="bd2"><span class="t1">' + x[0] + '</span><span class="t2">' + x[1] + "</span></span>" + g("right", 14) + "</button>";
      }).join("") + "</div>",
    foot: '<button class="btn" data-act="close">Close</button>' };
};
ACTS.theme = function (el) { setTheme(el.getAttribute("data-t") || null); renderLayer(); };

/* ---- the review pill: mockup controls, never product UI ---- */
function renderPill() {
  var el = document.getElementById("pill");
  if (!S.island) { el.innerHTML = ""; return; }
  var th = effectiveTheme();
  el.innerHTML = '<div class="pill" role="toolbar" aria-label="Mockup controls"><span class="pill-l">v3 mockup</span>' +
    '<button data-act="pill-theme" title="Theme" aria-label="Switch to ' + (th === "dark" ? "light" : "dark") + ' theme">' + g(th === "dark" ? "sun" : "moon", 14) + "</button>" +
    '<button data-act="pill-empty" aria-pressed="' + S.empty + '" title="Show the first run">First run</button>' +
    '<button data-act="pill-phone" aria-pressed="' + !!S.preview + '" title="Phone width">' + g("phone", 14) + "</button>" +
    '<select data-change="pill-health" aria-label="Steering repo health" title="Steering repo health">' + HEALTH.map(function (x) { return "<option" + (S.health === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select>" +
    '<select data-change="pill-viewer" aria-label="View as" title="View as">' + Object.keys(PEOPLE).map(function (k) { return '<option value="' + k + '"' + (viewer() === k ? " selected" : "") + ">" + h(PEOPLE[k].name.split(" ")[0]) + "</option>"; }).join("") + "</select>" +
    '<button data-act="pill-hide" aria-label="Hide the mockup controls">' + g("x", 13) + "</button></div>";
}
ACTS["pill-theme"] = function () { setTheme(effectiveTheme() === "dark" ? "light" : "dark"); render(); };
ACTS["pill-empty"] = function () { S.empty = !S.empty; S.imported = { steering: false, servers: false }; S.importPr = { steering: null, servers: null }; S.connected = false; _sessions = null; render(); };
ACTS["pill-phone"] = function () { S.preview = !S.preview; S.phone = S.preview || (function () { try { return matchMedia("(max-width: 760px)").matches; } catch (e) { return false; } })(); render(); };
ACTS["pill-hide"] = function () { S.island = false; renderPill(); };
ACTS["pill-health"] = function (el) { S.health = el.value; render(); };
ACTS["pill-viewer"] = function (el) { S.viewer = el.value === ME ? null : el.value; render(); };
