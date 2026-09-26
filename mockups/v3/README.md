# v3 mockup

A person running coding agents today keeps their instructions in a CLAUDE.md here, an AGENTS.md there and Cursor rules somewhere else. Their MCP servers sit in three config files on three laptops, some with keys in plaintext. Their work lives in GitHub, Linear and Jira. Nobody can say what an agent did last night or what it cost, because the transcript is a file on one machine and the bill is one number.

v3 is the product cut down to that problem. It is a target for finding the wedge, built beside the rev1 master (`mockups/missioncontrol.html`), which it does not change. It clones the master's design system and its demo record: Anderson Intelligence Corp. (`a-intel`), workspace Core platform, operator Marcus Bell.

Open `mockups/v3/index.html` from disk. Issue #133 tracks it.

## The wedge

Five jobs, in the brief's words:

1. **Steering in one place.** One list of steering records, rules, skills and memories, kept in the workspace's steering repo and changed only by steering PR. The cloud gateway delivers them to every harness.
2. **MCP servers in one place.** One list of servers, each a folder in the steering repo. oxagen holds the keys, every harness points at one gateway, and MCP Studio imports and classifies each tool.
3. **Work comes in, and you give it to an agent.** Items arrive from trackers. Send one to an agent in two clicks.
4. **Full spend attribution.** Every dollar traces to a model request, and every request to a session, a work item, an agent, a person, a model and the MCP server whose tokens it carried.
5. **Transcript replay.** A session replays the way its harness showed it. A Claude Code session looks like Claude Code.

## Areas

Six navigation items, and no area has more than one row of tabs.

| Area | What it answers | Route |
|---|---|---|
| Work | What is waiting, what is running, what is ready to review | `#/a-intel/core-platform/work` |
| Sessions | What each agent did, replayed, and what it cost | `#/a-intel/core-platform/sessions`, `.../sessions/<id>` |
| Agents | Who operates each agent, where it runs, and on which harness and model | `#/a-intel/core-platform/agents` |
| Steering | What every agent is told, what it costs, the steering PRs that change it, and the steering repo | `#/a-intel/core-platform/steering`, `.../steering/pr-<n>` |
| MCP servers | Which servers every agent gets, which tools each imports, how each tool is classified, and where an approval comes from | `#/a-intel/core-platform/servers`, `.../servers/<name>` |
| Spend | The month, grouped by work item, agent, person, model or MCP server | `#/a-intel/core-platform/spend` |

Steering has one row of tabs (Records, Steering PRs, Repository). A steering PR opens as its own page with no tabs. A server page has one row of tabs (Tools, Connection, Try it, Changes), and the servers list has none.

A bare word also works as the hash (`#work`, `#sessions`, `#replay`, `#agents`, `#steering`, `#servers`, `#spend`), for a host that passes only a plain anchor.

## The session page

The transcript starts in the first viewport. Above it sit one heading, one line of facts (harness, agent, person, model, work item, start) and the replay bar. The terminal is the harness's own screen, and nothing oxagen adds is drawn inside it:

- **Claude Code** draws its banner with the mascot, `>` prompts, `⏺` replies and tool calls, `⎿` results, `Update Todos`, `Read`, `Write` with numbered lines, `Update` with the red and green diff, `∴ Thinking…`, the orange spinner, and its own permission prompt.
- **Codex CLI** draws its boxed banner, `›` prompts, `• Explored`, `• Ran`, `• Edited (+a -b)`, `• Called server.tool(...)` and the `Worked for` rule.
- **Cursor** draws its agent panel: the message box, `Thought for`, file and terminal cards, and the composer.
- **stella** draws its black-and-gold TUI: the turn rule, the rails, `▸ read`, `● edit`, `● run`, `✦ skill` and the status bar.

oxagen's additions sit in a gutter and a margin beside the terminal: the time of each row, the cost of each model request, the MCP server a call went to, whether policy allowed it, who sent a message from oxagen, and how long the session waited. The rail on the right holds the cost, the cost of each request, where the money went, and what changed.

The replay bar plays, pauses, steps and scrubs at 1× to 16×. Space plays and pauses, the arrow keys step, and `o` shows thinking, the way `ctrl+o` does in Claude Code. The cost, the request count, the token count, where it went and the changes all follow the replay clock. A gap over 12 seconds plays as three, and a gap over a minute is marked in the margin with how long the session waited.

The Claude Code session is waiting on a question: oxagen's policy asks a person before `github create_release`. The terminal shows Claude Code's own permission prompt, and the margin carries Approve and Deny. Either answer reaches the transcript and finishes the session. Approve moves the work item to Review with its draft release, and Deny moves it to Review with the release held.

Sending a work item to an agent opens its new session, which starts replaying at once. The four sessions with a full transcript carry a Replay badge in the Sessions list. Every other session shows its record and cost and says the transcript is not in this mockup.

## The steering repo

`steering-repo-spec.html` is the source. Every workspace has one steering repo, `a-intel/oxagen-core-platform` here, and nothing steers until a steering PR merges.

- **Creating a workspace.** The workspace switcher in the sidebar lists the workspaces and opens New workspace. It asks for a name only, then shows provisioning by step. The first attempt fails at Create the repository, the way it does when the organization owner whose token adds repositories to the installation has left. A workspace owner is told to ask an organization owner. An organization owner re-authorizes once, and Retry finishes.
- **The steering repo card.** The top of Records shows the repository, the published version, and health. The Repository tab adds the settings oxagen holds, the linked code repositories, the organization records from `a-intel/oxagen`, governance, and the published versions. Governance shows the fields of `steering/governance.toml`: the mode, the reviewer groups, the always-on budget, memory, and the ledger.
- **Records.** Applies to shows each record's targets from its frontmatter: repositories, tools, skills, and path globs. A record with none reaches every run. New record offers the same four, and a skill lands as `skills: [<lineage>]`. A record that targets a skill loads with it and stays out of the always-on block. No record targets an agent.
- **Suggestions.** Open steering PR on a suggestion opens a record PR with `origin: inferred`. Steering changes only when it merges.
- **Memories.** A session recalls up to five memories and 800 tokens. Memories are not in the always-on block.
- **Health.** healthy, drifted, disconnected, or diverged. While it is not healthy, a banner on every page lists the differences. Repair settings shows for a workspace or organization admin, and Reconnect for an organization admin only. Every open steering PR fails its check.
- **Steering PRs.** Each page shows the checks inside `Oxagen steering`, review by governance mode, the merge queue, and Revert on a merged one. #58 carries the budget check with per-record token counts, over oxagen's default of 4,000 tokens, which only warns.
- **The memory PR.** #59 lists each memory with the sessions it came from. Drop takes one out.
- **Linking a repository** opens a steering PR on `workspace.toml`.
- **Import.** Import steering and Import MCP servers each open one steering PR and apply nothing until it merges. In the first run the new workspace is in solo mode, as its first commit writes it, so Merge merges the import PR with no approval step.

## MCP Studio

`mcp-studio-spec.html` is the source. Every server is one folder, `tools/servers/<name>/`, whatever its source. The app routes stay `.../servers/<name>`.

- **Every agent** gets the workspace's imported tools, and policy narrows what it may call. No server is assigned to one agent.
- **Add server** offers Connect by URL, From the registry, Local command, and From a definition (OpenAPI, GraphQL, or gRPC). Each ends in a discovery result that lists what the source offers, with a suggested classification in grey.
- **Tools** lists available and imported tools with risk, side effect, egress, impacts, approval, and definition tokens, and a running total against the definition budget. A suggestion stays grey until a person confirms it. The tool panel shows the classification, the description with Draft, inputs, what the result returns, what the server says, and agent feedback.
- **Approvals** come from policy. Each rule in `policy/*.cedar` reads the tool's classification, and the Approval column names the rule. The off switch acts at once, with no steering PR, and shows who turned it off and when. It replaces v3's Allow, Ask, and Off.
- **Connection** shows the source, environments, network route, authentication, and operator accounts. **Try it** shows what went upstream, the raw result, and what the model receives. **Changes** shows the tool surface diff and the checks, and opens the steering PR.
- **States.** `crm` runs in search mode. `warehouse` is a local command with its machine groups and three machine errors. `billing` sits behind relay `a-intel-east`, and `ledger` behind `a-intel-west`, which is down. `notion` is off, and so is `github__merge_pull_request`. Marcus has not connected his Billing API account. Search ranking uses oxagen's embedding provider.
- **Sync PRs.** #62 serves Stripe's locked description while the upstream one changed. #61 withholds two billing tools after a breaking change.

## Spend attribution

One rule prices every session (`src/ledger.js`). A model request re-reads everything already in the context at the cache-read price, writes what was added since the last request at the cache-write price, and generates its output at the output price. Every token has a source:

| Source | What it is |
|---|---|
| Model output | What the model wrote |
| The harness's prompt and tools | Claude Code's, Codex's, Cursor's or stella's own system prompt and tool list |
| Steering | The steering block for the session's code repository, the memories it recalled, and each skill it loaded with the records that target that skill |
| An MCP server | The definitions of the tools it leaves on, and every result it returned |
| Files and commands | Reads, edits and command output |
| Conversation | The person's messages and the model's earlier replies |

Because every figure is a sum of those, the numbers agree everywhere. A transcript's cost is the sum of its requests. Every Spend grouping sums to the month total to the cent, and the check fails if one does not. A record's cost is its share of each session's steering tokens, so the Steering list sums to the steering cost its header states. A server's cost is what its definitions and results added, which is why its drawer can price the tools that are on and never called.

Cursor's model calls do not pass through the oxagen gateway, so a Cursor session says its cost is reported by Cursor. The gateway meters the rest.

## Vocabulary

v3 uses the brief's words where rev1's glossary (`docs/fleet-operations-ia.md`, Vocabulary) chose others:

| v3 says | rev1 says | Why |
|---|---|---|
| session | run | Claude Code, Codex, Cursor and stella all call it a session, and so does the brief |
| MCP server | provider | The brief asks for "your mcp servers in one place", and every harness config calls them MCP servers |
| steering record, steering PR | steering item, proposal | The steering repo spec and #4325 |

Everything else follows rev1: oxagen and stella in lowercase, work item, no "task" in product copy, and no person scored or ranked.

## Cuts

Nothing below is deleted. Every rev1 view is still in the master, specified in `mockups/pages/`, and built. v3 asks which of it a buyer meets first.

| rev1 | Where it went in v3 |
|---|---|
| Work orders, workflows, stages, the Intake dialog, definitions of done | Work is one inbox. Send to an agent carries the brief, the note and the cost cap |
| Findings | Left out. Spend shows where the money went, and a steering suggestion carries the cost of the fix-up it would save |
| A run's five tabs: Decision trace, Transcript, Cost, Memories, Evidence | One session page: the replay, the cost in its margin, and the rail |
| Steering Sources and SteeringFrames, the envelope, injection points, the Compiler, Assignments, Proposals | One list of records, suggestions drawn from sessions, and steering PRs in the steering repo |
| Tools, toolbelts, providers, policy versions, kill switches | MCP servers and MCP Studio: imported tools with their classification, approvals from policy, and the off switch |
| The approvals drawer | The question in the transcript, answered from the margin, and a count in the top bar |
| An agent's tabs: identity, toolbelt, runtime, permissions, activity, source | One agent card and drawer |
| Runtimes | The agent's host |
| Repositories | The Changes panel of a session, and the work item |
| Organization, roles, API keys, billing, audit | The account menu, not in this mockup |
| The tier ladder | One line under each session's cost: metered by the gateway, or reported by the harness |
| Budgets, optimization and operator habits | The cost cap on Send, the unused-tool saving on each server, and suggestions with their cost |
| The stella drawer and notifications | Left out. rev1 keeps the in-app agent by the maintainer's decision of 2026-09-14 |

One rev1 cut comes back. The wedge of 2026-09-24 removed the transcript playback (`docs/fleet-operations-wedge.md`, D14). v3 restores it because the brief calls it very important.

## Commands

```sh
node tools/build-mockup-v3.mjs          # write mockups/v3/index.html
node tools/build-mockup-v3.mjs --check  # the page is what the sources produce
node mockups/v3/gen-sessions.mjs        # regenerate fixtures/sessions.json
node tools/check-mockup-v3.mjs          # the headless walk, with --shots DIR for screenshots
npm run check:v3                        # all three checks
```

`npm run build` and `npm run check` run them with the rest of the repo's guards, and Storybook shows every view under Oxagen v3.

The URL takes `?theme=dark|light`, `?state=empty` (the first run, before anything is connected) and `?phone=1` (the 400 px phone preview). A floating pill in the corner switches the same three, the steering repo's health, and who is viewing, and `?island=0` hides it. The pill is mockup chrome, not product UI.

A route's own query pins a screen or a state, so each has a Storybook story:

| Query | What it does |
|---|---|
| `tab=` | A tab: `records`, `prs` or `repo` in Steering, and `tools`, `connection`, `try` or `changes` on a server |
| `health=` | The steering repo's health: `healthy`, `drifted`, `disconnected` or `diverged` |
| `as=` | Who is viewing, such as `amara`, a member who cannot repair settings, or `priya`, an organization owner who can re-authorize provisioning |
| `dialog=` | A dialog: `newworkspace` (with `prov=failed` or `prov=done`), `linkrepo`, `addserver` (with `src=`, `fmt=`, `pick=` and `phase=result`), `embeddings` |
| `tool=` | The tool panel on a server page |
| `run=1` | A Try it result |

CI runs all three in `.github/workflows/mockup-v3.yml`, then a second walk over every steering repo and MCP Studio screen and state and its flows. That walk sits in the workflow until it moves into `tools/check-mockup-v3.mjs`. With `SHOTS=<dir>` set, it saves a screenshot of each screen, and the job uploads them as the `v3-screens` artifact.

The headless walk opens every view in both themes, desktop and phone, and fails on a script error, sideways scroll, a transcript below the first viewport, a replay that does not reach its end, a question that cannot be answered, a Send that opens no session, a drawer or dialog that does not open, money that does not reconcile, or copy that breaks the house rules.

## Data boundary

Interactive fixtures, not telemetry. The steering repo, its steering PRs, the memory PR, the servers other than the first five, the relays, and the policies are illustrative too. The prices in `fixtures/prices.json` are illustrative list prices, and nothing here was measured. `fixtures/sessions.json` holds the 232 September sessions other than the four with a transcript, written by `gen-sessions.mjs` from a seeded generator through the same ledger the page uses. No action sends anything to a real agent, tracker or server.

## Sources

| Path | What it is |
|---|---|
| `src/v3.css` | Part 1 is copied from `mockups/src/engine.css`. Part 2 is the replay, the four skins and the six areas |
| `src/marks.js` | The wordmark, harness marks, tracker logos and glyphs, copied from `mockups/src/engine.js` |
| `src/ledger.js` | The accounting rule, shared by the page and the generator |
| `src/core.js`, `src/data.js` | State, routes, formatting, every derived figure, and the steering repo and MCP Studio model: staged changes, classification, approvals from policy, the off switch, and the budget check |
| `src/replay.js` | The event model, the four skins, the margin and the replay clock |
| `src/views.js`, `src/boot.js` | The six areas, the dialogs and drawers, and the first render |
| `fixtures/*.json` | The demo record: org, agents, harnesses, prices, work, steering (with the steering repo, steering PRs and the memory PR), servers (every source type, relays, machine groups and search ranking), transcripts and sessions |
| `stories/v3.stories.js` | The Storybook entries |
