# Operator Console — Guide

The Operator Console is the browser-based control center for LLMFrame. It runs as a local HTML file — no backend, no server, no account. Open it, pick a folder, start building.

## Requirements

- A **Chromium-based browser** (Chrome, Edge, Brave, Arc). Firefox does not support the File System Access API.
- The `console.html` file and the `js/` folder in the same directory.
- A set of 6 stage prompt files (see Prompt Setup below).

## First Launch

1. Open `console.html` in your browser.
2. Click **Select prompt folder** — pick the folder containing your stage prompt `.txt` files. This folder is read-only; the Console never writes into it.
3. Click **Select workspace folder** — pick or create an empty folder for your project. The Console creates the internal structure (`stage01/`–`stage06/`, manifest, audit log) automatically.
4. Set at least one Tier 1 and one Tier 2 LLM in the availability section.
5. The Console shows your first action. You're ready.

Both folder selections are cached in the browser. On reload, the Console reconnects automatically (you may need to re-grant permission via the **Reconnect** button).

## Prompt File Naming

The Console detects stage prompts by filename prefix:

| Prefix | Stage | Role |
|--------|-------|------|
| `01_`  | Requirements | Requirements Engineer |
| `02_`  | Architecture | Technical Architect |
| `03_`  | Orchestration | Project Orchestrator |
| `04_`  | Implementation | Implementation Author |
| `05_`  | Review | Technical Reviewer |
| `06_`  | Integration | Integration Coordinator |

Filenames must start with the two-digit prefix. Everything after is flexible — `01_Requirements_Engineer.txt` or `01_RE.txt` both work.

## The Workflow Loop

The Console shows exactly one current action at a time:

1. **Build request** — The Console assembles an LLM prompt from your saved artifacts, the stage prompt, and the current project context.
2. **Copy request** — Copy the assembled prompt to clipboard (or download as `.txt`) and paste it into an LLM chat of your choice.
3. **Save result** — When the LLM returns, paste the response back into the Console. It saves the artifact to disk, updates the manifest, and advances the workflow.

For Stages 04–05, the Console focuses on one package at a time — one package, one action, one screen. This is deliberate: it prevents context-switching across five packages simultaneously, which is how work quality degrades.

But this does not mean strictly sequential processing. You can switch between packages at any point: start an implementation for Package A, copy the request to an LLM, then switch to Package B while waiting for the response. When Package A's result comes back, switch back and save it. Each package keeps its own state — implementation text, review output, fingerprint, disposition — independently. Nothing is lost when you switch away.

The workflow: **Build → Copy → Switch → Work on something else → Switch back → Save.** The Console tracks where each package stands. Use **Open package list** or **Choose the next package** to move between them.

## What the Console Tracks

Every save triggers a chain of updates:

- **Artifact manifest** (`artifact_manifest.json`) — ID, content fingerprint (SHA-256), revision number, status, and lineage for every artifact.
- **Audit log** (`audit_log.ndjson`) — Append-only event journal. Records every operator action in sequence.
- **Workspace state** (`workspace_state.json`) — Current stage positions, review bindings, package statuses.

These files are machine-readable and human-inspectable. The workspace folder is the complete project record — lose the Console and the folder still tells the full story.

## Key Features

### Stage Enforcement
The Console enforces stage progression via a state machine. You cannot skip stages, accept an implementation without a review, or merge without all reviews passing. The gates are not suggestions — they are hard constraints in the code.

### Review-to-Implementation Binding
Each review is cryptographically bound to the exact fingerprint of the implementation it evaluated. If the implementation changes after review, the binding breaks and the Console flags it. Post-review edits cannot pass silently.

### Plausibility Checks
Before every save, the Console runs structural checks on the LLM output: expected sections present, contract IDs parseable, status fields valid. Failed checks produce warnings, not blocks — the operator decides whether to proceed.

### Consequence Previews
Before destructive actions (clearing a package, saving a new implementation over an accepted review), the Console shows what will be affected before you confirm.

### Post-Action Summaries
After every significant save, a summary shows what happened: which artifacts were created or updated, which reviews became stale, and what the next step is.

### Dependency Graph
Interactive lineage visualization showing how artifacts connect across stages. When a package is blocked or in rework, the graph highlights the affected chain.

### Clustered Merge
For Stage 06, the Console supports iterative merge cycles. If the integration coordinator identifies conflicts, individual packages can be sent back to rework without re-running the entire review stage.

### Multi-Project / Multi-Tab
Each browser tab remembers its own workspace. Open two tabs, select different project folders, and work on both in parallel. **Do not open the same workspace in two tabs** — both would write to the same state file.

### Accent Colors
Assign a color theme per project to visually distinguish workspaces when working in multiple tabs. Click the color swatch in the top bar. The choice is saved per project and restored on reload.

### Domain Pack Switching
The Console auto-detects the domain pack (Coding, Technical Report, or custom) from the loaded prompts. Switch packs by loading a different prompt folder — the Console adapts its terminology and validation rules.

### Protocol Drift Detection
The Console loads `pipeline_protocol_v1.json` at runtime from the prompt folder or workspace root. It derives stage labels, plausibility rules, and review mode from the protocol. If the protocol file is absent, the Console falls back to hardcoded defaults. A version label in the workspace footer shows which protocol version is active.

### Craft Review (structural+craft mode)
When the protocol sets `review_mode` to `"structural+craft"`, the Console shows two additional sections on the package-accepted screen: an optional LLM-based craft review pass and a manual craft notes text field. Both are non-gating — they produce audit-logged artifacts but never block merge eligibility. The structural review (ACCEPT/REWORK) remains the only gate. This mode is intended for domains where quality has subjective dimensions (tone, voice, pacing, style) that resist binary pass/fail checks. The Prompt Compiler sets this field automatically when it detects a soft domain.

## Workspace Folder Structure

After a pipeline run, your workspace folder contains:

```
my-project/
├── stage01/
│   └── master_briefing_r1.txt
├── stage02/
│   └── architecture_spec_r1.txt
├── stage03/
│   ├── master_orchestration_r1.txt
│   ├── WP01_core_module_Work_Package.txt
│   └── ...
├── stage04/
│   ├── WP01_implementation.txt
│   └── ...
├── stage05/
│   ├── WP01_review_report.txt
│   └── ...
├── stage06/
│   └── integration_report_r1.txt
├── archive/                      ← superseded revisions
├── artifact_manifest.json
├── audit_log.ndjson
└── workspace_state.json
```

## Recovery

### Browser closed mid-session
Reopen the Console, click **Reconnect**. The workspace state is on disk, not in browser memory.

### Manifest out of sync
The Console reconciles manifest and disk state on every load. Orphaned manifest entries (artifact deleted from disk) are flagged as `missing_on_disk`. Files on disk not in the manifest are offered for import.

### Git companion (optional)
For automatic undo, initialize a git repo in your workspace folder and run the included watch script (`workspace_watch.ps1` for Windows, `workspace_watch.sh` for Linux/Mac). It auto-commits on every state change. Use `git log` and `git checkout` to recover any previous state.

## Limitations

- **Chromium only.** Firefox and Safari do not support the File System Access API. This is a platform limitation, not a design choice.
- **Single operator per workspace.** Concurrent access to the same workspace from two tabs or machines will cause state corruption.
- **No cloud sync.** The workspace is a local folder. Use Git, Syncthing, or any file sync tool externally if needed.
- **Plausibility checks are structural, not semantic.** The Console verifies that expected sections and IDs exist. It cannot judge whether the *content* is correct — that's the operator's job.
