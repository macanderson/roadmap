/* ============================== core.js ==============================
   State, routes, formatting, the render loop, dialogs and toasts. Every view is a function of S and
   the fixtures; an action changes S and calls render(). The replay keeps its own clock (replay.js)
   and redraws only the transcript while it plays. */
var F = FIXTURES;
var ORG = F.ORG.org, WS = F.ORG.ws, PEOPLE = F.ORG.people, ME = F.ORG.me;
var NOW = new Date(F.ORG.now);
var BASE = "#/" + ORG.slug + "/" + WS.slug;

var BOOT = (function () {
  var q = {};
  try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; }); } catch (e) { /* a host that strips the query */ }
  return { theme: q.theme || null, empty: q.state === "empty", phone: q.phone === "1" || q.mobile === "1", island: q.island !== "0", q: q };
})();

var S = {
  area: "work", id: null,
  empty: BOOT.empty, phone: BOOT.phone, theme: null, island: BOOT.island,
  workTab: "inbox", sessFilter: "all", spendBy: "work", spendOpen: null,
  dialog: null, drawer: null,
  sent: {}, answered: {}, accepted: {}, dismissed: {},
  imported: { steering: false, servers: false }, connected: false,
  // An import opens a steering PR and applies nothing until it merges. importPr holds its number.
  importPr: { steering: null, servers: null }, firstRunVersion: 1,
  // The steering repo and MCP Studio. health and viewer are mockup states: the review pill and the
  // URL (?health=drifted, ?as=amara) switch them.
  health: "healthy", viewer: null, steerTab: "records", srvTab: "tools",
  staged: {}, toolOff: {}, srvOff: {}, cls: {}, descs: {}, drafts: {}, dropped: {}, approved: {}, queue: [62],
  newPrs: [], noReview: {}, toolFilter: "all", toolQ: "", toolShow: 40, tryRun: {}, tryTool: {}, tryEnv: {},
};
var HEALTH = ["healthy", "drifted", "disconnected", "diverged"];

/* ---- formatting ---- */
var USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
var USD3 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 });
function money(v) { return USD.format(v || 0); }
/* A single model request costs cents, so its chip carries a third decimal. */
function money3(v) { return USD3.format(v || 0); }
function num(n) { return Math.round(n).toLocaleString("en-US"); }
function tok(n) {
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "k";
  return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(/\.?0+$/, "") + "M";
}
function plural(n, one, many) { return num(n) + " " + (Math.round(n) === 1 ? one : (many || one + "s")); }
function dur(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.floor(sec / 60) + "m " + String(sec % 60).padStart(2, "0") + "s";
  return Math.floor(sec / 3600) + "h " + String(Math.floor(sec % 3600 / 60)).padStart(2, "0") + "m";
}
function clock(sec) { sec = Math.max(0, Math.floor(sec)); return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0"); }
function dt(iso) { return iso instanceof Date ? iso : new Date(iso); }
function hhmm(d) { d = dt(d); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function hhmmss(d) { d = dt(d); return hhmm(d) + ":" + String(d.getSeconds()).padStart(2, "0"); }
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayKey(d) { d = dt(d); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function dayLabel(d) {
  d = dt(d);
  var diff = Math.round((new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()] + ", " + MON[d.getMonth()] + " " + d.getDate();
}
function when(d) {
  d = dt(d);
  var mins = Math.round((NOW - d) / 6e4);
  if (mins >= 0 && mins < 60) return mins <= 1 ? "just now" : mins + " min ago";
  var lab = dayLabel(d);
  return (lab === "Today" || lab === "Yesterday" ? lab : MON[d.getMonth()] + " " + d.getDate()) + " " + hhmm(d);
}
function ago(d) {
  var mins = Math.round((NOW - dt(d)) / 6e4);
  if (mins < 60) return mins <= 1 ? "just now" : mins + " min ago";
  if (mins < 1440) return Math.round(mins / 60) + " h ago";
  var days = Math.round(mins / 1440);
  return days === 1 ? "yesterday" : days + " days ago";
}

/* ---- markup ---- */
function h(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
/* Fixture text marks names, paths and ids with backticks. They render as code, which is also how a
   contract name that carries the capital brand (the check Oxagen steering) reaches the page. Inline
   only: replay.js has its own md() for a harness's markdown, which makes blocks. */
function mdi(s) { return h(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
function svg(paths, size, sw) {
  return '<svg width="' + (size || 15) + '" height="' + (size || 15) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
}
var GLYPH = {
  work: NAV_GLYPH.work, agents: NAV_GLYPH.agents, steering: NAV_GLYPH.steering, spend: NAV_GLYPH.spend,
  sessions: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M12.5 15H17"/>',
  servers: '<rect x="3" y="4" width="18" height="6" rx="1.8"/><rect x="3" y="14" width="18" height="6" rx="1.8"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4.5h4.5"/>',
  prev: '<path d="M18 6 9 12l9 6z" fill="currentColor" stroke="none"/><path d="M6 6v12"/>',
  next: '<path d="M6 6l9 6-9 6z" fill="currentColor" stroke="none"/><path d="M18 6v12"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  import: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>', lock: NAV_GLYPH.lock,
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  pr: AV_ICONS["git-pull-request"], branch: NAV_GLYPH.git, file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  edit: AV_ICONS["pencil-line"], ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
function g(name, size) { return svg(GLYPH[name] || "", size); }

/* Marks: the oxagen wordmark, a harness, an issue tracker, an agent avatar, a person, a server. */
function hxIcon(harness, size) {
  var m = HX[harness], s = size || 15;
  if (!m) return "";
  var body = m.f ? '<path fill="' + m.c + '" d="' + m.f + '"/>' : '<g fill="none" stroke="' + m.c + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + m.s + "</g>";
  return '<span class="hx" style="width:' + s + "px;height:" + s + 'px" title="' + h(m.l) + '"><svg viewBox="' + (m.v || "0 0 24 24") + '" aria-hidden="true">' + body + "</svg></span>";
}
function hxLabel(harness) { return (HX[harness] || {}).l || harness; }
function ipLogo(src, size) {
  var s = size || 14;
  if (src === "oxagen") return '<span class="ipl ox" style="width:' + s + "px;height:" + s + 'px" title="oxagen">' + svg('<path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z"/>', s, 2) + "</span>";
  var m = IP_KIND[src];
  if (!m) return "";
  return '<span class="ipl" title="' + h(m.l) + '"><svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true"><path fill="' + m.c + '"' + (m.r ? ' fill-rule="' + m.r + '"' : "") + ' d="' + m.d + '"/></svg></span>';
}
function srcLabel(src) { return src === "oxagen" ? "oxagen" : (IP_KIND[src] || {}).l || src; }
function agentAv(a, size) {
  var s = size || 26;
  return '<span class="avx agent tn-soft" style="width:' + s + "px;height:" + s + 'px" aria-hidden="true">' + svg(AV_ICONS[a.icon] || AV_ICONS.bot, Math.round(s * 0.56), 1.8) + "</span>";
}
function personAv(key, size) {
  var p = PEOPLE[key] || { initials: "?" }, s = size || 22;
  return '<span class="avx person tn-soft f-sans" style="width:' + s + "px;height:" + s + "px;font-size:" + Math.round(s * 0.4) + 'px" aria-hidden="true">' + h(p.initials) + "</span>";
}
function personName(key) { return (PEOPLE[key] || { name: key }).name; }
function serverMark(sv, size) {
  var s = size || 22;
  if (sv.logo === "oxagen") return '<span class="avx provider srv-ox" style="width:' + s + "px;height:" + s + 'px">' + svg('<path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z"/><path d="M12 7.5 16.2 10v4.9L12 17.3 7.8 14.9V10z"/>', Math.round(s * 0.66), 1.8) + "</span>";
  var m = sv.logo && IP_KIND[sv.logo];
  if (m) return '<span class="avx provider srv-logo" style="width:' + s + "px;height:" + s + 'px"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="' + (m.c === "currentColor" ? "#1f2328" : m.c) + '" d="' + m.d + '"/></svg></span>';
  return '<span class="avx provider" style="width:' + s + "px;height:" + s + "px;font-size:" + Math.round(s * 0.46) + 'px">' + h(sv.letter || sv.name[0]) + "</span>";
}

/* ---- routes ---- */
var AREAS = ["work", "sessions", "agents", "steering", "servers", "spend"];
var ANCHORS = { work: "work", sessions: "sessions", replay: "sessions/ses_01K5RS7M2E8FJ3QW", agents: "agents", steering: "steering", servers: "servers", spend: "spend" };
function parseHash() {
  var raw = "";
  try { raw = decodeURIComponent(location.hash || ""); } catch (e) { raw = location.hash || ""; }
  raw = raw.replace(/^#\/?/, "");
  if (ANCHORS[raw]) raw = BASE.slice(2) + "/" + ANCHORS[raw];
  var q = {}, qi = raw.indexOf("?");
  if (qi >= 0) { raw.slice(qi + 1).split("&").forEach(function (kv) { var p = kv.split("="); q[p[0]] = p[1]; }); raw = raw.slice(0, qi); }
  var parts = raw.split("/").filter(Boolean);
  var area = AREAS.indexOf(parts[2]) >= 0 ? parts[2] : "work";
  return { area: area, id: parts[3] || null, q: q };
}
function applyHash() {
  var r = parseHash();
  S.area = r.area; S.id = r.id;
  applyQuery(r.q);
}
/* What a route's query pins: a tab, a mockup state, or a dialog or drawer to open. Storybook frames
   one URL per story, so every screen and state in the steering repo and MCP Studio has one. */
function applyQuery(q) {
  if (q.by && ["work", "agent", "person", "model", "server"].indexOf(q.by) >= 0) S.spendBy = q.by;
  if (S.area === "work" && q.tab && ["inbox", "running", "review", "done"].indexOf(q.tab) >= 0) S.workTab = q.tab;
  if (S.area === "steering") S.steerTab = ["records", "prs", "repo"].indexOf(q.tab) >= 0 ? q.tab : "records";
  if (S.area === "servers") {
    S.srvTab = ["tools", "connection", "try", "changes"].indexOf(q.tab) >= 0 ? q.tab : "tools";
    S.toolFilter = "all"; S.toolQ = ""; S.toolShow = 40;
    if (S.id && q.run) S.tryRun[S.id] = true;
  }
  if (HEALTH.indexOf(q.health) >= 0) S.health = q.health;
  if (q.as && PEOPLE[q.as]) S.viewer = q.as;
  if (q.dialog && DIALOGS[q.dialog]) { S.dialog = { name: q.dialog, arg: q.arg || null, step: 0, q: q }; S.drawer = null; }
  if (q.tool && S.area === "servers" && S.id) { S.drawer = { name: "tool", arg: S.id + "." + q.tool }; S.dialog = null; }
}
function queryOf(str) { var q = {}; (str || "").split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) q[p[0]] = p[1]; }); return q; }
function href(area, id, query) { return BASE + "/" + area + (id ? "/" + encodeURIComponent(id) : "") + (query ? "?" + query : ""); }
function go(area, id, query) {
  var target = href(area, id, query);
  S.area = area; S.id = id || null; S.dialog = null; S.drawer = null;
  applyQuery(queryOf(query));
  try { if (location.hash !== target) history.pushState(null, "", target); } catch (e) { /* a sandbox that refuses history: keep the state in S */ }
  render();
  try { window.scrollTo(0, 0); } catch (e) { /* no window scroll in some hosts */ }
}

/* ---- theme ---- */
function setTheme(t) {
  S.theme = t;
  var root = document.documentElement;
  if (t) root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
  try { if (t) localStorage.setItem("v3-theme", t); else localStorage.removeItem("v3-theme"); } catch (e) { /* storage blocked */ }
}
function effectiveTheme() {
  if (S.theme) return S.theme;
  try { return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; } catch (e) { return "dark"; }
}

/* ---- toasts ---- */
function toast(msg, tone) {
  var el = document.getElementById("toast");
  var t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = '<span class="d" style="background:' + (tone === "warn" ? "var(--st-denied)" : "var(--st-allowed)") + '"></span>' + h(msg);
  el.appendChild(t);
  setTimeout(function () { t.remove(); }, 3600);
}

/* ---- dialogs and drawers: one layer, opened by name ---- */
var DIALOGS = {}, DRAWERS = {}, ACTS = {}, VIEWS = {};
function openDialog(name, arg) { S.dialog = { name: name, arg: arg, step: 0 }; S.drawer = null; renderLayer(); }
function closeDialog() { S.dialog = null; S.drawer = null; renderLayer(); }
function openDrawer(name, arg) { S.drawer = { name: name, arg: arg }; S.dialog = null; renderLayer(); }
function renderLayer() {
  var el = document.getElementById("layer");
  el.className = S.phone ? "phone" : "";
  if (S.dialog && DIALOGS[S.dialog.name]) {
    var d = DIALOGS[S.dialog.name](S.dialog.arg, S.dialog);
    el.innerHTML = '<div class="scrim" data-act="scrim"><div class="dlg ' + (d.wide ? "wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + h(d.title) + '">' +
      '<div class="dlg-h hs"><div class="grow"><h2>' + h(d.title) + "</h2>" + (d.sub ? "<p>" + d.sub + "</p>" : "") + "</div>" +
      '<button class="iconbtn x" data-act="close" aria-label="Close">' + g("x") + "</button></div>" +
      '<div class="dlg-b">' + d.body + "</div>" + (d.foot ? '<div class="dlg-f">' + d.foot + "</div>" : "") + "</div></div>";
    var f = el.querySelector("[autofocus]"); if (f) f.focus();
    return;
  }
  if (S.drawer && DRAWERS[S.drawer.name]) {
    var w = DRAWERS[S.drawer.name](S.drawer.arg);
    el.innerHTML = '<div class="scrim drawer-scrim" data-act="scrim"><aside class="drawer" role="dialog" aria-modal="true" aria-label="' + h(w.title) + '">' +
      '<div class="drawer-h">' + w.head + '<button class="iconbtn x" data-act="close" aria-label="Close">' + g("x") + "</button></div>" +
      '<div class="drawer-b">' + w.body + "</div></aside></div>";
    return;
  }
  el.innerHTML = "";
}

/* ---- the render loop ---- */
function render() {
  var vp = document.getElementById("viewport");
  vp.className = S.phone ? "phone" + (S.preview ? " preview" : "") : "";
  document.documentElement.classList.toggle("v3-phone", !!S.phone);
  var view = (VIEWS[S.area] || VIEWS.work)();
  document.getElementById("app").innerHTML = shell(view);
  renderLayer();
  renderPill();
  if (view.after) view.after();
}

/* ---- events: one delegated listener for every [data-act] and [data-go] ---- */
document.addEventListener("click", function (ev) {
  // A link wins unless the click landed on a control inside it (a Send button in a clickable row).
  // A control around it, such as a drawer's backdrop, does not stop it.
  var goEl = ev.target.closest("[data-go]"), actEl = ev.target.closest("[data-act]");
  var inner = actEl && goEl && actEl !== goEl && goEl.contains(actEl);
  if (goEl && !inner && !ev.metaKey && !ev.ctrlKey) {
    ev.preventDefault();
    var p = goEl.getAttribute("data-go").split("|");
    go(p[0], p[1] || null, p[2] || null);
    return;
  }
  var el = ev.target.closest("[data-act]");
  if (!el) return;
  var act = el.getAttribute("data-act");
  if (act === "scrim") { if (ev.target === el) closeDialog(); return; }
  if (act === "close") { closeDialog(); return; }
  // A form control inside a clickable row keeps its own click, so a checkbox still toggles.
  if (ACTS[act]) { if (!ev.target.closest("input, select, textarea, label")) ev.preventDefault(); ACTS[act](el, ev); }
});
document.addEventListener("change", function (ev) {
  var el = ev.target.closest("[data-change]");
  if (el && ACTS[el.getAttribute("data-change")]) ACTS[el.getAttribute("data-change")](el, ev);
});
document.addEventListener("input", function (ev) {
  var el = ev.target.closest("[data-input]");
  if (el && ACTS[el.getAttribute("data-input")]) ACTS[el.getAttribute("data-input")](el, ev);
});
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape" && (S.dialog || S.drawer)) { closeDialog(); return; }
  if (typeof replayKey === "function") replayKey(ev);
});
function onNavigate() { S.dialog = null; S.drawer = null; applyHash(); render(); }
window.addEventListener("hashchange", onNavigate);
window.addEventListener("popstate", onNavigate);

/* Copy buttons: the clipboard can refuse, so the fallback selects the text. */
ACTS.copy = function (el) {
  var text = el.getAttribute("data-text");
  var done = function () { el.classList.add("copied"); var l = el.querySelector(".lb"); if (l) l.textContent = "Copied"; setTimeout(function () { el.classList.remove("copied"); if (l) l.textContent = "Copy"; }, 1600); };
  try {
    navigator.clipboard.writeText(text).then(done, function () { selectNear(el); });
  } catch (e) { selectNear(el); }
};
function selectNear(el) {
  var code = el.parentNode.querySelector("code, pre");
  if (!code) return;
  var r = document.createRange(); r.selectNodeContents(code);
  var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
/* Facts in a row, set apart by a thin rule rather than a mid-dot. */
function pts(arr) { return '<span class="pts">' + arr.filter(Boolean).map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</span>"; }
function copyBtn(text) { return '<button class="btn sm ghost copyb" data-act="copy" data-text="' + h(text) + '">' + g("copy", 13) + '<span class="lb">Copy</span></button>'; }
