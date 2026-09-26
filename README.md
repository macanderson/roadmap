# Oxagen product roadmap

One place to see what Oxagen is building next, exactly how it will look, and what is still undecided.

- **The roadmap app** (`index.html`, built from `roadmap/`): what rev 1 must have and the gaps between the Oxagen mockups and the build, the witness and definition-of-done features (rev 2), the open decisions, and the GitHub issues, live. Published as a claude.ai artifact where Claude is bound to the page, and served by GitHub Pages at https://macanderson.github.io/roadmap/ as a read-only fallback.
- **The mockups** (`mockups/`): the master mockup, the authoritative design of rev1, every page in every state, desktop and mobile, and the guided scenarios. The roadmap frames them, so a card leads to its wireframe in one click. The first version, with the witness runner and the definition of done, is kept as `mockups/future_state_mockups/` and is not a target.
- **The documents** (`docs/`): the Mission Control spec, the DoD spec, the witness spec, the desktop spec, the in-app agent capability expansion roadmap, the plan, the scope review, and the reviews.

```
index.html                    the roadmap app, ONE file: built from roadmap/app.html + roadmap/data.json (edit those, never this)
stella-in-app-agent-roadmap.html  the in-app stella build spec: parity with stella in the terminal, contained sessions, 38 specs with workflow prompts
stella-backlog-batches.html   the stella backlog on 2026-09-25: 486 open issues by type and area, and workflow prompts that fix them in parallel batches
oxagen-backlog-report.html    the oxagen backlog on 2026-09-26: 365 open issues in 32 workflow batches, what merged since 2026-09-25, and a prompt per batch
steering-repo-spec.html       the steering repo Oxagen creates for each workspace: layout, formats, settings, drift, memory
mcp-studio-spec.html          MCP Studio: storage for every MCP server agents use, and an Oxagen and Kong comparison
mcp-steering-repo-plan.html   one build plan for both specs: build order, 32 lane prompts, and a progress tracker; the target UI is mockups/v3
supported-harnesses.html      the 20 most used agent harnesses and frameworks, plus stella: what Oxagen supports in each and the highest tier each can reach
roadmap/app.html              the app: the pages, the Claude drawer, the GitHub wiring, the shared store
roadmap/data.json             the roadmap content: surfaces, witness, dod, decisions, milestones, the catalog, the issue triage snapshot
mockups/missioncontrol.html   the master: every page, dialog, auth screen and guided scenario, self-contained, open from disk
mockups/src/                  its sources: engine.js (the app), engine.css, shell.html
mockups/fixtures/*.json       the demo record, one file per collection (README.md there says what each is)
mockups/pages/<page>.md       the spec of every page, and beside each an audit prompt for a build of it
mockups/stories/              the Storybook catalog: every page × state × shell, every scenario
mockups/future_state_mockups/ the first mockup (witness runner, proof, definition of done, scores): kept, not a target
mockups/v3/                   a smaller design for finding the wedge: six areas and a transcript replay per harness (its README says what it cuts)
docs/missioncontrol-docs.html the documents page: every docs/*.md, one file
docs/*.md                     the spec, the DoD spec, the witness spec, the desktop spec, the plan, the scope review, the mockup records
badges/                       the verification badge for pull requests and branches, one SVG per state and theme
tools/                        the builds and the guards
```

The demo record is the same everywhere: Anderson Intelligence Corp. (`a-intel`), workspace
`core-platform`, operator Marcus Bell.

## The roadmap app

`index.html` is built by `node tools/build-roadmap.mjs` from `roadmap/app.html` and `roadmap/data.json`;
`--check` says whether the three agree, and `npm run check` runs it with the other guards.

What the app does, and where each part lives:

| Page | What it shows | Source of truth |
|---|---|---|
| Now | build progress by surface, the milestones, what to build next, the decisions blocking work, shared activity | `data.json` + the shared store |
| Gaps | every mockup page and wizard with its build status, the concrete gaps, the backend gaps, the spec, the wireframe, the linked issues | `data.json` `surfaces[]`, the mockup pages' specs |
| Witness, Done | the proof and definition-of-done features, now rev 2 (removed from the rev1 design on 2026-09-21, moved to rev 2 on the roadmap on 2026-09-24) | `docs/witness-spec.md`, `docs/dod-spec.md` |
| Decisions | each open question with its recommendation; decide it in place, argue it with Claude, or open it as an issue | `docs/implementation-plan.md` §6, the scope review, the feedback |
| Issues | open issues in `macanderson/oxagen`, `macanderson/stella` and this repo, live through the viewer's GitHub connector, with the triage snapshot (theme, kind, spec backing) beside each | GitHub, `data.json` `issue_annotations` |
| Wireframes | the master mockup framed: any page, any state, desktop or phone, any scenario | `mockups/missioncontrol.html` |
| Specs | the documents, on GitHub and framed | `docs/missioncontrol-docs.html` |

In the claude.ai artifact the page gains what a static file cannot have:

- **Claude, bound to the page.** The drawer asks on the viewer's own account, Opus-class by default. It reads the roadmap through page tools (`get_roadmap_overview`, `get_item`, `list_open_issues`) and, when asked, changes it (`update_item`, `record_decision`, `link_issue`). `create_issue` only opens the confirmation dialog: nothing reaches GitHub until the viewer clicks.
- **A shared store.** Status, priority, owner, notes, linked issues and decisions are kept per item in the artifact's database, so an edit by one person is what everyone sees, and Claude sessions can read and write the same rows.
- **GitHub, live.** Issue lists refresh every two minutes; creating an issue from a gap or a decision uses the viewer's own GitHub credentials. Without the connector (GitHub Pages, a saved file) the page falls back to the triage snapshot and pre-filled "new issue" links.
- **Comments.** Every card and detail has a Comment button that opens the claude.ai composer, so a thread can be sent to Claude from the page itself.

### Hosted on Vercel

The public home is **https://oxagen-roadmap.vercel.app** (Vercel project `oxagen-roadmap`). The same `index.html` runs there in hosted mode: it asks `/api/config` what the deployment can do and uses that instead of the claude.ai capabilities.

| Piece | Hosted mode | Who can use it |
|---|---|---|
| Roadmap, wireframes, specs | static files from this repo | everyone |
| GitHub issues | GitHub's public REST API, read in the browser every ten minutes; creating an issue opens GitHub's pre-filled form | everyone |
| Shared state (status, priority, owner, notes, links, decisions, activity) | `api/state.js`, one private Vercel Blob (`roadmap/state.json`) | everyone reads; the **password** writes |
| The assistant | `api/ask.js`: one streamed round per call against OpenRouter (Kimi K3 by default, `~moonshotai/kimi-latest` behind it); the page runs the tool loop because the tools are page functions | the **password**, so a public link cannot spend the model budget |
| Recording a decision | `api/record-decision.js`: the model drafts the record, the function comments on the GitHub issue that asked, drops the `needs:decision` label, and closes the issue when you tick the box | the **password** |

#### Signing in

`ROADMAP_PASSWORD` is the one credential a person types. `POST /api/session` checks it and returns it as an httpOnly cookie, so the page holds nothing: a script on the page cannot read the cookie back, and the browser attaches it to `/api/state`, `/api/ask` and `/api/record-decision` by itself. Scripts and smoke tests that have no cookie jar send the `x-roadmap-password` header instead.

The OpenRouter key is not the password. It lives on the server as `OPENROUTER_API_KEY` and never reaches the browser. Typing an `sk-or-v1-...` value into the sign-in box gets you told so.

#### Environment variables

| Variable | What it turns on |
|---|---|
| `ROADMAP_PASSWORD` | signing in. Without it the deployment is read only. |
| `OPENROUTER_API_KEY` | the assistant, and the model that drafts decision records |
| `OPENROUTER_MODEL` | moves the primary model without a deploy (default `moonshotai/kimi-k3`) |
| `BLOB_READ_WRITE_TOKEN` | the shared store. Set by `vercel blob create-store`. |
| `GITHUB_TOKEN` | writing a decision back to its issue. Needs issue write on the tracked repositories. |
| `GITHUB_OWNER`, `GITHUB_REPOS` | where decisions may be written. Default `macanderson` and `roadmap,oxagen,stella`. |

Deploy with `vercel deploy --prod`; the build step is `node tools/build-roadmap.mjs --check`, so a stale `index.html` fails the deploy.

### Refreshing the content

The roadmap has two layers, and the shared store sits on top of both:

1. **`roadmap/data.json`, written by people.** The page-by-page comparison of `mockups/pages/*.md` against `apps/app`, the gaps, the recommendations, the milestones. Redo that comparison when the plan itself changes (an agent session with both repos checked out does it in minutes), then `node tools/build-roadmap.mjs` and deploy.
2. **`roadmap/refresh.json`, written by GitHub Actions every fifteen minutes.** `.github/workflows/refresh-roadmap.yml` runs `node tools/refresh-roadmap.mjs`, which reads only what changed since its last run (four API calls on a quiet quarter hour) and records:
   - the state, labels and closing references of every issue and pull request in `oxagen`, `stella` and this repo;
   - for each surface, witness and DoD feature, the merged pull requests that touched its evidence or closed its linked issues, and whether the page for its route exists in `apps/app`;
   - a status moved **forward only, and only on proof**: not started → partial when its page appears or a merge closes a linked issue; partial → built when every linked issue and every issue its gaps cite is closed. When the gaps cite no issue it flags the item "ready for review" and a person decides;
   - decisions settled by an ADR that landed after `data.json` was written, or by the close of the issue a decision was opened as; ADRs that match no open decision appear as new decided ones, and every open `needs:decision` issue appears as an open one;
   - each milestone's open linked issues, merges and last merge.

The page reads `refresh.json` from `raw.githubusercontent.com` on load and every five minutes, so a refresh is live without a deploy. The rules live in `tools/lib/refresh-rules.mjs` and `node tools/check-refresh.mjs` proves them. A person's override in the app always wins over both layers. Run `npm run refresh` locally, or the workflow with `full` set, to rebuild the file from scratch; rewriting `data.json` moves the baseline and the refresh starts counting from it.

## The master

`mockups/missioncontrol.html` is built by `node tools/build-mockup.mjs` from `mockups/src` and
`mockups/fixtures`; **edit the sources, not the built file**, and `--check` says whether the two agree.
Everything a URL of it pins is read at runtime, so there is one file where there used to be 254:

| URL | What it shows |
|---|---|
| `missioncontrol.html` | the design with the mockup chrome: the state bar, the phone preview, the theme toggle, the Scenarios nav item, the onboarding demo |
| `?product=1` | the product build: no chrome |
| `?product=1&state=loaded&mobile=0` | the product, pinned to the loaded state and the desktop shell |
| `?product=1&state=loaded&mobile=1` | the same in the mobile shell: a five-slot thumb bar, a More sheet, dialogs as bottom sheets, list tables as cards |
| `?state=empty#/a-intel/core-platform/tools` | one page in one state; the states are `loaded`, `empty`, `loading`, `error`, `denied` |
| `#/a-intel/core-platform/scenarios/money-asked/1` | a guided scenario (the W flows) on step 1 |
| `#/a-intel/core-platform/work` | Work, the workspace root: a tab by hash, `orders`, `workflows`, `findings`; one record is `items/<id>` or `orders/<id>`; `?intake=providers` opens the Intake dialog |
| `#/a-intel/core-platform/runs/run_01K5RQ4B9C7XTN2P/cost` | a run tab by hash: the Decision trace is the bare path, then `transcript`, `cost`, `evidence`; the old `player`, `policy` and `context` land on the Decision trace and `chain` on Evidence |
| `#/a-intel/core-platform/steering/compiler/release-manager` | a Steering area by hash: Sources is the bare path (`?kind=` filters it), then `sources/<kind>/<id>`, `assignments`, `compiler[/<agent>]`, `proposals[/prs]` |
| `#/a-intel/core-platform/skills` | an old route: it lands on Sources filtered to skills; `docs/fleet-operations-routes.md` lists every old route and where it lands |
| `#/a-intel/core-platform/runtimes/mbell-mbp-16` | one enrolled host, with the agents on it and the tier its seam earns |
| `?theme=dark` | pinned theme |
| `?future=1` | outlines every field the platform does not record yet, marked future-only on the page |
| `?drawer=approvals`, `?drawer=stella` | the page with the Approvals or the Stella drawer open |

The onboarding screens live at `#/welcome…` and are reachable from the Account dialog's Onboarding
tab, the user menu, and ⌘K. Nothing on them writes anything.

## What the mockups depict

The fleet operations wedge (`docs/fleet-operations-wedge.md`) on top of every phase of the steering
and gateway plan (0 to 5), shipped. Work is the workspace root: work items, work orders, workflows and
findings, with every run filed under a work order as its child execution record. Every runtime input
an agent receives is a SteeringFrame resolved from a Steering Source (a Steering record, a document, a
skill, an agent definition, an instruction, a glossary term, a memory, a policy, a mandate or a
toolbelt), with its source, version and hash. One resolver builds the Compiler, the agent's Steering
tab and the run's Decision trace. The tier ladder is complete: `observe`, `harness`, `gateway`,
`contained`. Most agents run `gateway` with `gateway_observed` metering and enforced budgets; Stella
CI runs `contained`. Token accounting follows the spec's cost record (§12.6), and Spend groups it by
work order, operator, agent, model, tool and cost center. Operator habits come from the recorded turns
and read as rules to adopt, with no score or rank. Approvals live in a drawer opened from the topbar
on every page. The governance mode is a workspace setting on the Steering header. Not in the design:
the witness runner, proof, the definition of done, agent scores, proven spend, and what the wedge cut
(`docs/fleet-operations-collapse.md`). `mockups/README.md` lists the changes from the first mockup;
`mockups/pages/` is the spec of every page.

## The catalog

```sh
npm install
npm run dev              # Storybook on :6006 and Mission Control on :4400, both live from the sources
npm run storybook        # every page in every state, desktop and mobile; every scenario
npm run build-storybook  # a static site in storybook-static/
```

Storybook frames URLs of the master. Each page's stories are one per state, desktop and mobile, with
controls for the state, the shell (a 390×844 phone frame), the theme and the chrome; the page's
`mockups/pages/<page>.md` spec is on its Docs tab. The dev server assembles the master from the
sources on every request (`.storybook/mockup-plugin.mjs`), so an edit shows on reload. Which pages
and states exist is `mockups/catalog.mjs`, which the stories, the checker and the roadmap app all read.

## The scenarios

| # | Scenario | Story |
|---|---|---|
| W1 | Sixty seconds to governed | `sixty-seconds-to-governed` |
| W2 | Stop it. Steer it. | `stop-it-steer-it` |
| W3 | Money asked, a human answered | `money-asked` |
| W6 | It learned, you approved, it changed | `learned-approved-changed` |
| W8 | Every dollar, every operator | `every-dollar-every-operator` |
| W9 | The toolbelt, governed | `toolbelt-governed` |
| W10 | The CIO's console | `cio-console` |
| W11 | Whose account it is | `the-account` |

W7 (the ontology) and the assistant half of W11 were cut by the scope review of 2026-09-14
(`docs/scope-review.md`); W12 was a coverage audit, now `tools/check-mockup.mjs`. The fleet operations
wedge retired W4 (the flight recorder walked the frame player, fork replay and bisect) and W13 (in the
loop walked the skills console); the interjection W13 ended on stays in the Approvals drawer. W6 walks
Steering: Sources, the pull request, the Compiler, and the Decision trace on the run. W5 and W14
(proof and the definition of done) exist only in the future-state mockup. A scenario is
`SCENARIOS["id"]` in `mockups/src/engine.js` and a row in `mockups/catalog.mjs`.
`docs/videos-mockup-narrated.md` has the narrated walkthroughs.

## The documents

`docs/missioncontrol-docs.html` is every document in `docs/` on one page, with a rail of documents and
a contents rail per document; a section has a link (`#spec/8-6-definition-of-done`). It is built by
`python3 tools/build-docs.py` (needs `markdown-it-py`); the markdown is the source.

- `mission-control-spec.md`: the product and technical specification the mockups render
- `dod-spec.md`: the definition of done for agent runs (future state, not in rev1)
- `witness-spec.md`: Witness, outcome verification (future state, not in rev1)
- `desktop-spec.md`: the Oxagen Desktop installer
- `in-app-agent-capability-expansion-spec.md`: the proposed roadmap for app parity, Workspace Context, visual analysis, artifacts, governed actions and distribution
- `implementation-plan.md`: how the pages become the Next.js `apps/app` in the oxagen monorepo
- `fleet-operations-wedge.md`: the design authority for Work, SteeringFrames, the Decision trace and what was cut, with `fleet-operations-ia.md` (navigation and the unique views), `fleet-operations-routes.md` (every old route and where it lands) and `fleet-operations-collapse.md` (the deletion list)
- `scope-review.md`: the review of 2026-09-14, what it cut and where each cut landed
- `demo-mockup-prompts.md`, `consolidation.md`, `feedback-mockups.md`, `videos-mockup-narrated.md`, `w13-in-the-loop-scenario.md`: how the mockups were made and reviewed
- `agent-portability-atlas.md`: an inventory of how Claude Code, Cursor and Codex store agents, skills and memory on disk: where the schemas match, where they don't, and the gap in Oxagen's own agent/skill/memory capabilities against delivering any of the three in another harness's native format. [Interactive version.](https://claude.ai/artifact/YYawKKCKLASpWHcegLyXpC)

The desktop spec is also carried in the oxagen monorepo at `docs/specs/oxagen-desktop/spec.md`, and
that copy is canonical and newer. No build step joins them, so a change is made in both by hand, in
the same change set. The oxagen copies of the spec and the plan were retired on 2026-09-23: this
repository's copies are the only live ones.

`docs/oxagen/` holds the roadmap and planning material that moved out of the oxagen monorepo's
`docs/` on 2026-09-23 (oxagen issue #3895), at the same path it had under `docs/` there. Its
[README](docs/oxagen/README.md) lists what moved and why. It is not on the documents page.
`docs/reviews/` holds dated reviews as records; they are not on the documents page.

## The verification badge

`badges/` holds the badge a pull request or branch carries once Oxagen has looked at it, one SVG
per state and theme, generated by `node tools/build-badges.mjs` (`--check` guards drift). The words are
the spec's closed vocabularies (§8.5 verdicts, §8.3 attestation), never a stronger one. Open
`badges/index.html` for the sheet and the embed snippet.

## The guards

```sh
npm run build   # build-mockup, build-stories, build-docs, build-badges
npm run check   # the four --check runs, then check-mockup.mjs and check-creation.mjs in Chromium
```

`npm run check` builds nothing and fails if any built file is stale or any page fails to render:
the roadmap app, the master, the stories, the documents page, the badges, then the mockup, creation,
assistant and record checks. `tools/README.md` says what each checks and what to watch for.

## Creating things

Four things an operator creates (an agent, a tool, a skill and a Steering record) and one shape
for all four, because all four are a file in a repository: describe it, Oxagen drafts the file, you
read the file, a pull request publishes it. Nothing in it writes a row. `docs/creation-spec.md` is
the spec; the wizards are `DLG_EXT.wz` in `mockups/src/engine.js` and reached from `Create` in ⌘K
and from each page's own action. The tool wizard matches a description against the providers
Oxagen can already reach (`mockups/fixtures/mcp-catalog.json`) and offers to import before it offers
to generate a handler in TypeScript, Python, Go or Rust. The skill wizard searches the registry
(`mockups/fixtures/skill-registry.json`), drafts from prose, or takes a `.skill` bundle that
replaces a pinned version. Two pages carry the editing half: `steering-source` (a published Steering
record, presented by its kind, with its statement in a real editor) and `steering-source-skill` (a
skill's bundle and its `SKILL.md`).

## Work

Work arrives from GitHub, Linear and Jira and leaves for an agent only in a work order.
`docs/tasks-spec.md` is the spec, written when Work was called Tasks. The Intake dialog on Work
connects a provider in six steps and maps its accounts to members, leaving any not mapped.
`oxagen.assistant` drafts a definition of done for every work item and a person certifies it, which
makes the item ready. A work order sends ready items to an agent the sender operates: the merged
definition of done, an editable prompt with `@` mentions, and confirmed repositories. A run started
outside Work is filed under a direct work order. Workflows chain agents and end with a person. The
pages are `work-backlog`, `work-intake`, `work-item`, `work-orders`, `work-order`, `work-workflows` and
`work-findings` in `mockups/pages/`, each with its audit prompt, and `node tools/check-tasks.mjs`
walks every flow.


## Docs site

`site/` is the internal documentation site: a Next.js and Fumadocs app that renders the repo's
markdown where it lives and links every section to its mocked page, audit prompt, spec section and
plan section. Nothing in `site/` holds prose of its own.

```sh
pnpm -C site install   # dependencies, then the prepare step and the Fumadocs source index
pnpm -C site dev       # http://localhost:3310, with the prepare step run first
pnpm -C site build     # static export to site/out, Storybook catalog included, hostable on any static file server
```

| Source (committed) | What the site makes of it |
|---|---|
| `docs/walkthrough.md` | The home page and first sidebar entry. |
| `mockups/pages/<page>.md` | One page per spec, grouped Workspace, Organization, Auth & onboarding in `mockups/pages/README.md` order, each with a Mocked page panel (state tabs, Desktop and Mobile, each a URL of `mockups/missioncontrol.html`) and links to its audit prompt, the walkthrough sections that cover it, their spec and plan links, and the scenarios that visit it. |
| `mockups/pages/*.audit-prompt.md`, `mockups/pages/audit-prompt.md` | Audit prompts. |
| `docs/*.md` | Specs & plans: the spec, the implementation plan, the definition of done, the scope review, the witness spec, the desktop spec, the demo prompts, the scale-back prompt, the W13 scenario doc. |
| `mockups/catalog.mjs` | Every page's route and states, and the scenarios in W order. |
| `SCENARIOS` in `mockups/src/engine.js` (with `mockups/fixtures`) | One outline per scenario: its steps, the page each step routes to, and a link to each step inside the mockup. |
| `mockups/missioncontrol.html`, `docs/*.html`, `docs/_house`, `badges` | Served unchanged under `/mock/`. The Mocked page panel and its Open full page link are `/mock/mockups/missioncontrol.html?product=1&state=<state>&mobile=<0\|1>&theme=<light\|dark>#<route>`, with the theme following the site's. |
| `storybook-static/` (from `npm run build-storybook`) | Copied to `site/out/storybook/` by `site/scripts/catalog.mjs`, the last step of `pnpm -C site build`, which runs `npm ci` at the repo root first when the root dependencies are absent. Specs & plans ends with a Catalog link to `/storybook/`. |

Generated and gitignored: `site/public/mock/` (the HTML copied by `site/scripts/prepare.mjs`),
`site/.generated/` (scenario outlines from `site/scripts/gen-scenarios.mjs`, the scenarios and
rendered-HTML indexes, `manifest.json`, and a walkthrough stub while `docs/walkthrough.md` is
absent), `site/.source/` (the Fumadocs index), `site/.next/` and `site/out/`. The markdown carries
no frontmatter: a page's title is its first heading and its description its first paragraph.
