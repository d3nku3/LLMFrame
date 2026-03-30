# LLMFrame

**Don't blame it, frame it.**

A framework that makes LLM output structured and easily reworkable by forcing every step through contract-bound stages instead of letting models improvise. Works with any model — Claude, ChatGPT, Gemini, local 7B, whatever you have.

MIT License · Zero dependencies · Fully offline · No backend, no accounts, no telemetry · Runs in any Chromium browser

---

## Proof first: what this actually catches

In a real project (a Windows multi-monitor screensaver, 11 packages), the Architecture Spec defined an interface `assess_media()` returning a simple pass/fail. During implementation, Package T10 needed full media probe data — codec, HDR status, duration — that the interface didn't provide.

**Without the framework:** The model silently invents the missing fields. You discover the inconsistency days later during integration.

**With LLMFrame:** The implementer reported `Status: Blocked` because the Work Package Contract explicitly listed which interfaces it was allowed to consume. The Console flagged T10 as blocked, froze downstream packages, and the fix was a targeted spec revision — one interface change, two re-implementations, everything else untouched.

The framework didn't prevent the spec gap. It made the gap **visible at the exact moment it mattered**, with a clear repair path.

| Console — guided workflow with rework routing | Lineage graph — T10 blocked, downstream pending |
|---|---|
| ![Console](docs/screenshot_console.png) | ![Lineage](docs/screenshot_lineage.png) |

---

## Understand this in 2 minutes

**What it is:** A 6-stage pipeline where a human operator routes work between LLMs. Each stage has frozen contracts, mandatory review gates, and traceable artifacts. No stage runs automatically.

**What it sells:** Three things — *auditability* (you can reconstruct exactly what happened and why), *constrained repair* (when something breaks, exactly one package gets reworked, not the whole project), and *inspectability* (every decision is a named, versioned, fingerprinted artifact on disk). Across multiple parallel projects, the Console externalizes the mental overhead of "where was I?" into persistent workspace state — every stage, artifact, and decision is tracked so your working memory stays free for actual engineering decisions.

**What it isn't:** Not an autonomous agent. Not a code generator. Not a chat wrapper. It's the opposite — a system built on the observation that LLMs produce dramatically better results inside clear boundaries, explicit contracts, and external verification.

```
Stage 01          Stage 02            Stage 03             Stage 04          Stage 05          Stage 06
Requirements  →   Architecture    →   Orchestration    →   Implementation →  Review        →   Integration
Engineer          Architect           Orchestrator         Author             Reviewer          Coordinator

   ↓                 ↓                   ↓                    ↓                 ↓                 ↓
Master            Architecture       Work Packages        Deliverables      Review Report     Integration
Briefing          Spec               + Execution          + Delivery        + ACCEPT/REWORK   Report
                  + Frozen           Checklist            Report                              + Merge Verdict
                  Contracts
```

Each arrow is a human checkpoint. The operator reads, verifies, and decides whether to proceed or escalate.

**→ See [QUICKSTART.md](QUICKSTART.md) for a full walkthrough with a real 3-package project.**

---

## What a workspace looks like on disk

After a pipeline run, the workspace folder *is* the project record — no hidden browser state, no database:

```
my-project/
├── stage01/
│   └── master_briefing_r1.txt
├── stage02/
│   └── architecture_spec_r1.txt
├── stage03/
│   ├── master_orchestration_r1.txt
│   ├── WP01_core_module_Work_Package.txt
│   ├── WP02_parser_Work_Package.txt
│   └── WP03_cli_Work_Package.txt
├── stage04/
│   ├── WP01_implementation.txt
│   ├── WP02_implementation.txt
│   └── WP03_implementation.txt
├── stage05/
│   ├── WP01_review_report.txt
│   ├── WP02_review_report.txt
│   └── WP03_review_report.txt
├── stage06/
│   └── integration_report_r1.txt
├── artifact_manifest.json        ← every artifact, its fingerprint, revision, status, lineage
├── audit_log.ndjson              ← append-only log of every operator action
├── workspace_state.json          ← current pipeline state, stage positions, review bindings
└── prompts/
    └── coding/
        ├── 01_Requirements_Engineer.txt
        └── ...
```

The manifest and audit log are machine-readable. Lose the Console — the folder is the complete record.

---

## What's enforced vs. what depends on the operator

**Enforced by tooling:** Artifact fingerprinting and version tracking, stage transition rules (can't skip gates), review-to-implementation binding (auto-invalidates if the code changes), manifest and audit log integrity, plausibility checks on every save, protocol alignment checks.

**Depends on the operator:** Actually reading review reports before accepting, choosing the right model for each stage, catching spec gaps that pass plausibility checks, deciding when to escalate vs. proceed.

The framework makes rubber-stamping *harder*, but can't make it impossible. The human is still the weakest and most important link.

**→ See [Auditability & Traceability](docs/LLMFrame_Auditability_Traceability.md) for a detailed overview of fingerprinting, contract lineage, review binding, and compliance relevance.**

---

## What's included

| Component | What it does |
|---|---|
| **Operator Console** | Browser-based control center. Tracks artifacts, enforces stage transitions, renders dependency graphs, maintains the audit trail. Single HTML + JS modules — double-click and go. |
| **6 Coding Prompts** | Battle-tested prompt set for software projects. The reference implementation. |
| **6 Domain-Agnostic Templates** | Generic versions with `[DOMAIN:]` markers for any field — books, legal, engineering, research. |
| **Prompt Compiler** | Adapts the templates to a new domain. |
| **Prompt Validator** | Audits compiled prompts for structural completeness. Auto-repair, conformance fixtures. |
| **Pipeline Protocol** | Single-source-of-truth JSON defining all frozen tokens, required sections, and stage metadata. Drives the Validator, Analyzer, and Console. |
| **Prompt Analyzer** | Cross-prompt consistency checking — frozen token coverage, contract alignment, escalation patterns. |
| **Analytics Dashboard** | Artifact sequence, package status, audit events. One HTML file, offline, exportable. |

Not just for code — a Technical Report domain pack is included as a working non-coding reference. [How well does it transfer to other domains? →](docs/DOMAIN_TRANSFER.md)

**→ See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the three-layer system design (Prompt Layer, Protocol Layer, Operator Layer) and the full [failure vocabulary](docs/ARCHITECTURE.md#failure-vocabulary).**

**→ More docs: [Console Guide](docs/CONSOLE_GUIDE.md) · [Domain Pack Guide](docs/DOMAIN_PACK_GUIDE.md) · [Protocol Reference](docs/PROTOCOL_REFERENCE.md) · [FAQ & Comparisons](docs/FAQ.md) · [Auditability & Traceability](docs/LLMFrame_Auditability_Traceability.md)**

---

## Where this still fails

**A wrong early artifact poisons everything downstream.** Rigidity preserves decisions — including bad ones. Review gates catch *internal* inconsistencies, not *externally* wrong requirements.

**Overhead doesn't scale down.** 11 packages means 11 implementations, 11 reviews, and a merge pass. For small tasks, the built-in Complexity Assessment recommends "SINGLE PASS SUFFICIENT" — use it.

**The operator can defeat the system.** Rubber-stamping, ignoring blocked states, copy-pasting without reading — the tooling adds friction, but can't stop a determined human.

**Model quality still matters.** But structure lets smaller models punch above their weight class — a local 7B inside rigid contracts produces more reliable output than a frontier model freestyling without guardrails.

**No cross-project learning.** Each run is isolated. The framework doesn't aggregate patterns or suggest improvements from past failures.

---

## What LLMFrame is not

**It's not a simplified "just run one prompt" tool.** A Lite Mode sounds easy — just skip some stages. In reality, removing stages from a contract chain where every role depends on upstream artifacts doesn't simplify anything. It creates a parallel pipeline with its own contract surface, and adding escalation back to full mode creates a third. Clustered Merge adds iteration to one stage. Lite Mode adds conditionality to every stage. It's not a feature — it's a fork. [Full analysis →](docs/ANALYSIS_Lite_Mode_Complexity.md)

**It's not a team collaboration platform.** Multiple operators editing the same project simultaneously would require rewriting the manifest into a DAG, branching the fingerprint chain, and adding a server component — destroying the zero-infrastructure simplicity that makes LLMFrame unique. LLMFrame manages the conversation between humans and LLMs. Git manages the conversation between humans and humans. Combining both into one tool serves neither purpose well. [Full analysis →](docs/ANALYSIS_Multi_User_Concurrent_Access.md)

---

## Who this is for

Solo developers doing long sessions where one wrong assumption cascades into hours of rework. Users of smaller local models that benefit from rigid structure. Air-gapped or privacy-sensitive environments. Teams that want inspectable handoffs instead of autonomous agent chaos. Non-programmers who orchestrate LLM work and need discipline without writing code.

**→ Coming from Cursor, Copilot, or CrewAI? See [FAQ & Comparisons](docs/FAQ.md) for how LLMFrame differs.**

---

## What the Console actually does

The Console isn't a clipboard manager — it's the operational backbone. It handles artifact tracking (IDs, revisions, fingerprints, lineage), stage enforcement (state machine, can't skip gates), manifest and audit log maintenance, review binding (cryptographic fingerprint ties each review to the exact implementation version), interactive dependency graphs, plausibility checks before every save, protocol drift detection, and domain pack switching with auto-detection.

| Analytics Dashboard — package status, audit events, artifact sequence |
|---|
| ![Analytics](docs/screenshot_analytics.png) |

**Why zero dependencies:** No npm, no build step, no server. No hidden fetch calls — your data stays on your machine. Nothing to audit except files you can read. Fully offline, air-gap tested. Copy the folder — that's deployment.

**→ See [Console Guide](docs/CONSOLE_GUIDE.md) for setup, workflow, and feature reference.**

---

## Built with this pipeline

| Project | Packages | Models Used | Notes |
|---|---|---|---|
| **BrickGen** — STL to LEGO-compatible brick models with PDF instructions | 7 | Claude, ChatGPT | Full lifecycle including rework cycles |
| **Windows Multi-Monitor Video Screensaver** | 11 | Claude, ChatGPT, Gemini | Surfaced the interface spec gap described above |
| **Pipeline Operator Console** | Self-hosted | Claude, ChatGPT | The framework rebuilt its own tooling |

---

## Status and roadmap

All components are **stable and in daily use**. This is a personal toolkit shared publicly — community contributions welcome (see [CONTRIBUTING.md](docs/CONTRIBUTING.md)), response times may vary.

**Next:** Normalized uncertainty reporting (per-stage assumptions and unknowns), community-contributed domain packs, rework-counter metrics in the Analytics Dashboard.

**Not in scope (yet):** Autonomous agent mode (the human-in-the-loop is the point), cloud sync, model API integration (model-agnostic by design).

---

## License

MIT License. See [LICENSE](LICENSE) for full text. Use it, fork it, adapt it, sell products built with it. Attribution appreciated but not required.
