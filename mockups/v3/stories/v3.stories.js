// The v3 mockup (mockups/v3/README.md), one story per view and state, each a framed URL of
// mockups/v3/index.html. A route's query pins a tab, a dialog, a drawer or a mockup state.
// Storybook's dev server builds that page fresh from mockups/v3/src and mockups/v3/fixtures on every
// request (.storybook/mockup-plugin.mjs); `npm run build-storybook` writes it into the static build.
const FILE = "./v3/index.html";
const BASE = "/a-intel/core-platform/";

// Not exported: every named export of a stories file is indexed as a story.
const argTypes = {
  shell: { control: "inline-radio", options: ["desktop", "mobile"], description: "mobile draws a 390×844 phone, which gets the phone layout" },
  theme: { control: "inline-radio", options: ["system", "dark", "light"] },
  first: { control: "boolean", description: "?state=empty: the first run, before anything is connected" },
  route: { control: "text", description: "the view the frame opens on" },
};

function render({ shell, theme, first, route }) {
  const q = ["island=0", theme && theme !== "system" ? "theme=" + theme : "", first ? "state=empty" : ""].filter(Boolean).join("&");
  const mobile = shell === "mobile";
  const wrap = document.createElement("div");
  wrap.style.cssText = mobile ? "min-height:100vh;display:grid;place-items:center;background:#F4F4F5;padding:24px 16px" : "height:100vh;background:#000000";
  const frame = document.createElement("iframe");
  frame.src = `${FILE}?${q}#${BASE}${route}`;
  frame.title = "Oxagen v3: " + route;
  frame.style.cssText = mobile
    ? "width:390px;height:844px;max-width:100%;border:10px solid #09090B;border-radius:38px;background:#000000;box-shadow:0 20px 60px rgba(0,0,0,.35)"
    : "width:100%;height:100%;border:0;display:block";
  wrap.appendChild(frame);
  return wrap;
}

export default { title: "Oxagen v3", argTypes, args: { shell: "desktop", theme: "system", first: false, route: "work" }, render };

export const Work = { args: { route: "work" } };
export const Sessions = { args: { route: "sessions" } };
export const ReplayClaudeCode = { name: "Replay in Claude Code", args: { route: "sessions/ses_01K5RS7M2E8FJ3QW" } };
export const ReplayCodex = { name: "Replay in Codex CLI", args: { route: "sessions/ses_01K5QX4B9C7XTN2P" } };
export const ReplayCursor = { name: "Replay in Cursor", args: { route: "sessions/ses_01K5RP2D6H4KLM8V" } };
export const ReplayStella = { name: "Replay in stella", args: { route: "sessions/ses_01K5RN8F3J2GHY6T" } };
export const Agents = { args: { route: "agents" } };
export const Steering = { args: { route: "steering" } };
export const McpServers = { name: "MCP servers", args: { route: "servers" } };
export const Spend = { args: { route: "spend" } };
export const FirstRun = { name: "First run", args: { route: "work", first: true } };

// The steering repo (steering-repo-spec.html).
export const SteeringPrs = { name: "Steering PRs", args: { route: "steering?tab=prs" } };
export const SteeringRepository = { name: "Steering repo", args: { route: "steering?tab=repo" } };
export const SteeringPrBudget = { name: "Budget warning", args: { route: "steering/pr-58" } };
export const SteeringPrMerged = { name: "Merged steering PR", args: { route: "steering/pr-57" } };
export const MemoryPr = { name: "Memory PR", args: { route: "steering/pr-59" } };
export const LinkRepository = { name: "Link a repository", args: { route: "steering?tab=repo&dialog=linkrepo" } };
export const RepoDrifted = { name: "Repo drifted", args: { route: "steering?health=drifted" } };
export const RepoDriftedMember = { name: "Drifted repo for a member", args: { route: "work?health=drifted&as=amara" } };
export const RepoDisconnected = { name: "Repo disconnected", args: { route: "work?health=disconnected" } };
export const RepoDiverged = { name: "Repo diverged", args: { route: "steering/pr-60?health=diverged" } };
export const NewWorkspace = { name: "New workspace", args: { route: "work?dialog=newworkspace" } };
export const ProvisioningFailed = { name: "Failed provisioning step", args: { route: "work?dialog=newworkspace&prov=failed" } };
export const ProvisioningReauth = { name: "Provisioning re-authorization", args: { route: "work?dialog=newworkspace&prov=failed&as=priya" } };
export const ProvisioningDone = { name: "Finished provisioning", args: { route: "work?dialog=newworkspace&prov=done" } };

// MCP Studio (mcp-studio-spec.html).
export const AddServer = { name: "Add server", args: { route: "servers?dialog=addserver" } };
export const AddServerUrl = { name: "Add server by URL", args: { route: "servers?dialog=addserver&src=url" } };
export const AddServerRegistry = { name: "Registry discovery result", args: { route: "servers?dialog=addserver&src=registry&pick=slack&phase=result" } };
export const AddServerLocal = { name: "Add a local command", args: { route: "servers?dialog=addserver&src=local" } };
export const AddServerOpenApi = { name: "OpenAPI discovery result", args: { route: "servers?dialog=addserver&src=definition&fmt=openapi&phase=result" } };
export const AddServerGraphQl = { name: "GraphQL discovery result", args: { route: "servers?dialog=addserver&src=definition&fmt=graphql&phase=result" } };
export const AddServerGrpc = { name: "gRPC discovery result", args: { route: "servers?dialog=addserver&src=definition&fmt=grpc&phase=result" } };
export const ServerTools = { name: "Server tools", args: { route: "servers/stripe" } };
export const ToolPanel = { name: "Tool panel", args: { route: "servers/stripe?tool=create_refund" } };
export const ToolPanelSuggested = { name: "Suggested classification", args: { route: "servers/stripe?tool=delete_customer" } };
export const ServerConnection = { name: "Server connection", args: { route: "servers/billing?tab=connection" } };
export const ServerTryIt = { name: "Try it", args: { route: "servers/stripe?tab=try&run=1" } };
export const ServerChanges = { name: "Server changes", args: { route: "servers/stripe?tab=changes" } };
export const SyncPrDescription = { name: "Sync PR description change", args: { route: "steering/pr-62" } };
export const SyncPrBreaking = { name: "Sync PR breaking change", args: { route: "steering/pr-61" } };
export const SearchMode = { name: "Search mode", args: { route: "servers/crm" } };
export const LocalServer = { name: "Local server", args: { route: "servers/warehouse?tab=connection" } };
export const RelayDown = { name: "Relay down", args: { route: "servers/ledger?tab=connection" } };
export const ServerOff = { name: "Server off", args: { route: "servers/notion" } };
export const ToolOff = { name: "Tool off", args: { route: "servers/github?tool=merge_pull_request" } };
export const OperatorNotConnected = { name: "Operator not connected", args: { route: "servers/billing" } };
export const SearchRanking = { name: "Search ranking", args: { route: "servers?dialog=embeddings" } };
export const Mobile = { args: { route: "sessions/ses_01K5RS7M2E8FJ3QW", shell: "mobile" } };
