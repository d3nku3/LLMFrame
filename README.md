# Multi-LLM Pipeline v5

A structured, auditable pipeline for orchestrating software projects across multiple LLMs. Single HTML file. Zero dependencies. Fully offline. Works air-gapped.

## What This Is

The Multi-LLM Pipeline treats language models as unreliable workers who produce dramatically better results when given rigid structure, explicit contracts, and external verification.

Instead of dumping an entire project into one long chat session and hoping for the best, the pipeline splits work into six specialized stages — each run in a separate LLM conversation, each with a different role, each producing artifacts that are versioned, fingerprinted, and validated by the Operator Console.

A human operator sits between every stage. Nothing runs automatically. You read every output and decide whether to proceed.

## Why This Exists

Long LLM sessions drift. The model starts strong, then gradually mutates the task, fills gaps with fabricated details, and produces outputs that look correct but silently diverge from what you asked for. When something breaks at step 40, you cannot tell whether the error was introduced at step 3 or step 37.

The pipeline forces three things:

- **Contract closure before execution.** The architecture is frozen before anyone writes anything. You cannot silently change an interface mid-project.
- **Separation of concerns.** The model that specifies is not the model that implements is not the model that reviews. Role drift is structurally impossible.
- **Traceable failure.** Every artifact has a version, a fingerprint, and a parent lineage. Every review is cryptographically bound to the exact implementation it evaluated. When something fails, you know exactly where.

## Requirements

- A **Chromium-based browser** (Chrome, Edge, Brave, Arc)
- Access to at least one LLM (ChatGPT, Claude, Gemini, local models — anything that accepts text)

No server. No npm. No Python. No Docker. No accounts.

## The Six Stages

| Stage | Role | Artifact Produced |
|---|---|---|
| 01 | **Requirements Engineer** | Master Briefing — frozen requirements with stable IDs |
| 02 | **Technical Architect** | Architecture Spec — components, interfaces, invariants, dependency map |
| 03 | **Project Orchestrator** | Work Packages — bounded tasks with explicit contracts, routed to models |
| 04 | **Module Implementer** | Deliverables + Delivery Report — one package at a time |
| 05 | **Code Reviewer** | Review Report — ACCEPT or REWORK with evidence-classified findings |
| 06 | **Merge Coordinator** | Integration Report — merged output with consistency verification |

Each stage is a separate LLM conversation. A fresh context window for every stage prevents accumulated drift.

## Repository Structure

```
├── 01_Requirements_Engineer_v5.txt      # Stage 01 prompt
├── 02_Technical_Architect_v5.txt        # Stage 02 prompt
├── 03_Project_Orchestrator_v5.txt       # Stage 03 prompt
├── 04_Module_Implementer_v5.txt         # Stage 04 prompt
├── 05_Code_Reviewer_v5.txt              # Stage 05 prompt
├── 06_Merge_Coordinator_v5.txt          # Stage 06 prompt
├── 07_End_User_Operating_Guide_v5.txt   # Full pipeline rules and procedures
├── 08_Operator_Run_Layer_v5.txt         # Decision companion for operators
├── 09_Operator_Console_v5.html          # Console entry point
├── js/                                  # Console JavaScript modules (10 files)
│   ├── 00_constants.js
│   ├── 01_utilities.js
│   ├── 02_state.js
│   ├── 03_persistence.js
│   ├── 04_manifest.js
│   ├── 05_workflow.js
│   ├── 06_builders.js
│   ├── 07_render.js
│   ├── 08_events.js
│   └── 09_init.js
├── console_hardened/                    # CSP-hardened build (air-gap certified)
│   ├── hardened_console.html
│   ├── 00_constants.js – 09_init.js
│   └── 10_chartjs_inline.js            # Chart.js bundled (no CDN)
├── pipeline_agnostic_templates/         # Domain-agnostic prompt set
│   ├── 01–06 agnostic role prompts
│   ├── Pipeline_Prompt_Analyzer.txt
│   └── Pipeline_Prompt_Compiler_v2.txt
├── domain_mapping.md                    # Coding → Agnostic term mapping
├── pipeline_analytics.html              # Interactive project analytics dashboard
├── pipeline_prompt_validator.html       # Deterministic prompt audit tool
├── Pipeline_Prompt_Analyzer.txt         # LLM-based prompt analysis tool
├── Pipeline_Prompt_Compiler.txt         # Domain compiler (v1)
├── Pipeline_Prompt_Compiler_v2.txt      # Domain compiler (v2)
├── QUICKSTART.md                        # 15-minute walkthrough
├── LICENSE                              # MIT
└── README.md                            # This file
```

## The Operator Console

The Console (`09_Operator_Console_v5.html` + `js/` folder) is the operational backbone. Double-click the HTML to open it.

### What It Does

- **Artifact management.** Every artifact gets a unique ID, revision number, and SHA-256 content fingerprint. All stored as human-readable JSON in your workspace folder.
- **Stage enforcement.** A state machine prevents skipping stages or submitting artifacts to the wrong gate.
- **Review binding.** A cryptographic fingerprint ties each review to the exact implementation it evaluated. If the implementation changes after review, the review is automatically stale.
- **Plausibility checks.** Content validation before every save — wrong-stage markers, missing keywords, truncation detection, suspiciously short outputs.
- **Interactive lineage graph.** SVG visualization of all artifacts, their relationships, blocked packages (pulsing red), and rework cycle counts.
- **Append-only audit log.** Every action logged with timestamp. Immutable project history.
- **Analytics dashboard.** One-click generates an interactive dashboard from project data — artifact timelines, package status grids, event distribution.

### Zero Trust Architecture

- **Zero external fetch calls.** The Console never contacts any server. Your data stays on your filesystem.
- **Zero build steps.** No Webpack, no Vite, no transpilation. The source code is the runtime code.
- **Zero accounts.** No login, no tokens, no authentication.
- **Zero npm.** No `node_modules`, no supply chain attack surface.
- **Full offline operation.** All state lives in your workspace folder via the File System Access API.

The entire codebase is auditable in an afternoon because there is nothing hidden behind abstractions.

### Hardened Build

The `console_hardened/` directory contains a dedicated build for air-gapped and classified environments:

- Content Security Policy blocks all remote resource loading at the browser level
- Chart.js bundled inline (no CDN dependency)
- System fonts only (no Google Fonts)
- Print-to-PDF export (no html2canvas)
- Full feature parity with the standard build

| Property | Standard Build | Hardened Build |
|---|---|---|
| Network calls | None (by behavior) | None (by CSP enforcement) |
| Font loading | System fonts | System fonts (remote blocked) |
| Chart rendering | Chart.js CDN | Chart.js inlined |
| Dashboard export | html2canvas | Print-to-PDF |
| Air-gap certified | Yes | Yes (policy-enforced) |

## Tooling

| Tool | Purpose | Dependencies |
|---|---|---|
| **Operator Console** | Stage tracking, artifacts, workflow enforcement | None |
| **Hardened Console** | Same + CSP + inline Chart.js | None |
| **Analytics Dashboard** | Interactive project visualization | None |
| **Prompt Validator** | Deterministic audit of compiled prompts | None |
| **Prompt Compiler** | Adapts prompts to new domains (LLM-based) | One LLM conversation |
| **Prompt Analyzer** | Structural analysis of prompt sets (LLM-based) | One LLM conversation |

Everything is a single file or a small folder. Everything works offline.

## Domain-Agnostic Templates

The `pipeline_agnostic_templates/` directory contains a domain-neutral version of all six role prompts. These replace coding-specific terminology (modules, functions, imports) with generic equivalents (components, operations, dependencies) while preserving all Console-parsed tokens and pipeline structure.

Use the Prompt Compiler to adapt the agnostic templates to your domain (legal, book authoring, hardware design, research — anything with decomposable deliverables).

See `domain_mapping.md` for the complete term mapping between the coding and agnostic prompt sets.

## Model Recommendations

The pipeline is model-agnostic. Any LLM that accepts text prompts works. Practical guidance:

| Stage | Recommended Model | Why |
|---|---|---|
| 01 Requirements | Claude, GPT-4 | Needs strong interview and structuring ability |
| 02 Architecture | Claude | Best at identifying invariants and boundary conditions |
| 03 Orchestration | Claude, GPT-4 | Complex decomposition with dependency awareness |
| 04 Implementation | ChatGPT, Gemini, local models | Bulk code generation, speed matters more than analysis |
| 05 Review | Claude | Critical analysis, finding what's wrong, evidence classification |
| 06 Merge | GPT-4, Claude | Cross-package consistency, conflict detection |

You can use a single model for everything. You get better results by routing stages to models that match the cognitive demands.

## Who This Is For

- Solo developers running multi-file LLM-assisted projects
- Users of local models (7B–70B) who benefit most from rigid external structure
- Privacy-sensitive or air-gapped environments where cloud tools are banned
- Teams that want inspectable handoffs instead of autonomous agent chaos
- Non-programmers orchestrating LLM work with the domain-agnostic templates

## What This Is NOT

- **Not an autonomous agent.** The human-in-the-loop is the point, not a limitation.
- **Not a model improvement.** Models still hallucinate. This makes hallucination inspectable, not impossible.
- **Not always worth the overhead.** A 20-line script does not need 6 stages. The Requirements Engineer explicitly recommends "SINGLE PASS SUFFICIENT" for simple tasks.

## Getting Started

See **[QUICKSTART.md](QUICKSTART.md)** for a guided 15-minute walkthrough of your first 3-package project.

For the full pipeline rules, evidence classification system, and go/no-go criteria, read `07_End_User_Operating_Guide_v5.txt`.

For decision support during execution (when to rework, when to escalate, when to proceed), read `08_Operator_Run_Layer_v5.txt`.

## Contributing

Contributions are welcome. Areas where feedback is especially valuable:

- **Stage boundaries** — do the six stages feel right, or should something be split/merged?
- **Contract rigidity** — is the freeze-before-execute model too rigid or not rigid enough?
- **Non-coding domains** — does the agnostic template set work for your field?
- **Console UX** — what's confusing, what's missing, what breaks your workflow?

Please open an issue or submit a pull request. See the issue templates for bug reports, feature requests, and usage questions.

## License

[MIT](LICENSE) — use it, fork it, adapt it.
