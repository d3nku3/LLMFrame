# Architecture — Multi-LLM Pipeline Operator Console

**Scope:** Hardened Console only. The non-hardened console is deprecated.

This document describes the three-part system structure, the data flow between parts, and which rules are enforced at which level.

---

## Three-Part System Overview

The pipeline is built from three independently versioned layers. Each layer has clear boundaries: the Console never modifies prompt files, the prompts never assume a specific runtime, and the Protocol never contains executable logic.

### 1. Console (Runtime)

The Operator Console is a single HTML entry point (`hardened_console.html`) backed by ten JavaScript modules. It manages workspace state, builds request packets, tracks artifacts, and enforces the workflow state machine. All durable storage goes through the File System Access API — there is no server.

| File | Responsibility |
|---|---|
| `hardened_console.html` | Entry point, HTML shell, module loader |
| `00_constants.js` | Configuration constants, feature flags, workflow state enum, transition table, LLM slot definitions, security limits |
| `01_init.js` | Application bootstrap, workspace recovery, IndexedDB handle store |
| `02_state.js` | State schema, default state factory, state access helpers |
| `03_manifest.js` | Artifact manifest CRUD, artifact ID generation, status lifecycle (current → superseded) |
| `04_parsing.js` | Artifact text parsers (Stage 03 splitter, review disposition extractor, merge verdict parser, fingerprint computation) |
| `05_workflow.js` | Workflow snapshot resolution, package priority scoring, state derivation, cluster merge helpers, persistence layer |
| `06_builders.js` | Request packet builders for all six stages (including cluster merge), pause-response builder, binding block generator |
| `07_render.js` | DOM rendering, workspace indicator, stage panels, protocol version label |
| `08_events.js` | Operator action handlers, import/export, plausibility checks, dynamic event binding, domain pack management, cluster merge event handlers |
| `09_cleanup.js` | Workspace reset, stage clearing, archive operations |

### 2. Agnostic Templates (Prompt Layer)

Six stage prompt files define the LLM's role, input contract, output contract, and behavioral rules for each pipeline stage. These templates are domain-neutral — they use generic terms like "Deliverable Author" instead of "Module Implementer".

| File pattern | Stage |
|---|---|
| `01_Requirements_Engineer_Agnostic.txt` | Requirements elicitation → Master Briefing |
| `02_Technical_Architect_Agnostic.txt` | Architecture design → Architecture Spec |
| `03_Project_Orchestrator_Agnostic.txt` | Work decomposition → Master Orchestration + Work Packages |
| `04_Deliverable_Author_Agnostic.txt` | Implementation → Delivery Report |
| `05_Deliverable_Reviewer_Agnostic.txt` | Review → Review Report with FINAL_DISPOSITION |
| `06_Integration_Coordinator_Agnostic.txt` | Merge → Integration Report |

Domain packs (e.g., a coding pack) are compiled from agnostic templates plus domain overlay files using `Pipeline_Prompt_Compiler_v2.txt`. The compiled prompts replace generic vocabulary with domain-specific terms (e.g., "Module Implementer", "Code Reviewer") and inject domain-specific frozen tokens.

### 3. Protocol (Contract Layer)

`pipeline_protocol_v1.json` (currently v1.2.0) is the single source of truth for structural validation. It defines what each prompt must contain, which tokens are frozen, how stages hand off to each other, and the cluster merge configuration.

| Protocol section | Purpose |
|---|---|
| `stages[].frozen_tokens` | Tokens that must appear in a compiled prompt and must not be renamed |
| `stages[].required_sections` | Section headings that must be present in the prompt |
| `stages[].contract_id_prefixes` | Contract ID patterns each stage is allowed to define |
| `universal_checks` | Cross-stage rules: OUTPUT_CONTRACT tag, minimum length, residual domain markers |
| `escalation_patterns` | Regex patterns for detecting escalation/blocked-state routing |
| `cross_prompt_checks` | Inter-stage handoff validation (e.g., S04 produces Delivery Report → S05 must reference it) |
| `cluster_merge` | Threshold, cluster size, naming pattern, substates, audit event types |
| `agnostic_notes` | Documents which frozen tokens are intentionally absent from agnostic templates and why |

The Protocol is consumed by the Prompt Validator (`pipeline_prompt_validator.html`) and the Prompt Analyzer (`Pipeline_Prompt_Analyzer.txt`). The Console does not yet consume it at runtime — this is tracked as issue C1.

---

## Data Flow

```
Operator
  │
  ▼
Console ──reads──► Prompt files (agnostic or compiled domain pack)
  │                     │
  │                     └── compiled by Prompt Compiler from agnostic + domain overlay
  │
  ├──builds──► Request packets (prompt + injected context per stage)
  │                     │
  │                     └──► copied to external LLM chat by operator
  │
  ├──imports──► LLM return artifacts (Master Briefing, Arch Spec, Work Packages, etc.)
  │                     │
  │                     ├── plausibility checked (08_events.js)
  │                     ├── parsed (04_parsing.js)
  │                     ├── fingerprinted (04_parsing.js)
  │                     └── registered in manifest (03_manifest.js)
  │
  ├──persists──► Workspace folder via File System Access API
  │               ├── workspace_state.json
  │               ├── artifact_manifest.json
  │               ├── audit_log.ndjson
  │               └── stage01/ ... stage06/ (artifact files)
  │
  └──resolves──► Workflow snapshot (05_workflow.js)
                  ├── current state from WORKFLOW_STATES enum (37 states)
                  ├── allowed transitions from WORKFLOW_TRANSITIONS table
                  └── drives render (07_render.js) → operator sees next action
```

The Console never sends data to a server. The operator is the transport layer: they copy a request packet from the Console, paste it into an LLM chat, and paste the return artifact back.

---

## Enforcement Levels

Rules in this pipeline exist at three distinct levels. Knowing which level enforces a rule tells you what happens when it breaks: a hard-enforced rule blocks the UI or corrupts state if violated; a Validator-enforced rule fails a validation report; a guidance-only rule relies on the LLM following its prompt.

### Hard-Enforced in Console Code

These rules are checked at runtime. Violating them blocks the operator or produces visible warnings in the Console UI.

| Rule | Mechanism | Where |
|---|---|---|
| Workflow state machine | Only transitions listed in `WORKFLOW_TRANSITIONS` are reachable; `resolveWorkflowSnapshot()` derives state from data, not from arbitrary user choice | `00_constants.js` (enum + table), `05_workflow.js` (resolver) |
| Fingerprint-bound reviews | `reviewUsable` is `true` only when `reviewBoundFingerprint === implementationOutputFingerprint`; a stale review blocks merge eligibility | `08_events.js` (save handler, line ~890–905), `05_workflow.js` (STAGE5_REVIEW_STALE state) |
| Plausibility checks on import | `PLAUSIBILITY_RULES` per stage check expected keywords at start/end, wrong-stage markers, and truncation signals; violations produce warnings | `08_events.js` (lines 645–745) |
| Manifest artifact lifecycle | Every artifact gets a unique ID, a status (`current` / `superseded`), and a supersedable type; clearing a stage supersedes all owned artifacts | `03_manifest.js`, `08_events.js` (clearStage, clearPackageData) |
| Stage prerequisite gates | Stage 02 blocks until Master Briefing exists; Stage 03 blocks until Architecture Spec exists; Stage 04 blocks until Stage 03 outcome is `closed`; Stage 06 blocks until at least one package is merge-ready | `05_workflow.js` (resolveWorkflowSnapshot) |
| Architecture retry gate | If the Architecture Spec has `Progression Status ≠ CLOSED` or `readiness = "Not Safe to Freeze"`, Stage 03 is blocked and a retry loop is required | `05_workflow.js` (architectureNeedsRetry), `06_builders.js` (describeArchitectureBlock) |
| Package priority scoring | When multiple packages exist, `choosePriorityPackageKey()` selects the next package by priority (REWORK > unimplemented > stale review > no review > accepted) | `05_workflow.js` (packagePriorityScore) |
| Cluster merge plan validation | `validateClusterPlan()` checks JSON shape, round logic, binary tree termination, and package assignment completeness before cluster merge can start | `08_events.js` (validateAndStartClusterBtn handler, line ~1295) |
| Cluster failure tracking | `recordClusterFailure()` counts consecutive failures per cluster; recluster is unlocked only after the threshold (default: 2) | `05_workflow.js` (recordClusterFailure, isReclusterUnlocked) |
| Security limits | Max import size, max rendered preview chars, max batch import bytes are enforced via `SECURITY_LIMITS` | `00_constants.js` |
| Dangerous key rejection | `__proto__`, `prototype`, `constructor` are rejected on any imported JSON key | `00_constants.js` (DANGEROUS_IMPORT_KEYS) |
| Domain pack validation | `scanDomainPacks()` only recognizes directories containing files matching `^0[1-6][_\s\-].*\.txt$` | `08_events.js` (scanDomainPacks) |

### Enforced by Prompt Validator

These rules are checked by `pipeline_prompt_validator.html` against `pipeline_protocol_v1.json`. They produce a structured validation report (pass/warn/fail per check) but do not block the Console UI.

| Rule | Severity | Protocol source |
|---|---|---|
| All `required_sections` present in prompt | fail | `stages[].required_sections` |
| All `frozen_tokens` present in compiled prompt | fail | `stages[].frozen_tokens` |
| `<OUTPUT_CONTRACT>` tag present | warn | `universal_checks.output_contract_tag` |
| Prompt minimum length (1500 chars) | warn | `universal_checks.minimum_length` |
| No residual `[DOMAIN:]` markers | fail | `universal_checks.residual_domain_markers` |
| Escalation/blocked-state routing present (stages with `has_escalation_check`) | fail | `escalation_patterns` |
| Greeting pattern + `DO_NOT_BREAK` tag | fail | `greeting_patterns` |
| Cross-prompt handoff (e.g., S04 Delivery Report → S05 references delivery) | fail | `cross_prompt_checks[]` |
| Severity label consistency (CRITICAL/MAJOR/MINOR across S05 ↔ S06) | warn | `cross_prompt_checks[severity_labels_05_06]` |
| Agnostic token exceptions | skip | `agnostic_notes.frozen_tokens_absent_in_agnostic` — Validator suppresses these when validating agnostic templates |

### Guidance Only

These rules exist in prompt text, documentation, or conventions. Nothing enforces them mechanically — compliance depends on the LLM following its prompt and the operator following documentation.

| Rule | Where it lives |
|---|---|
| Output Contract blocks at the top of each prompt | Prompt text (per stage) — recommended by readability analysis but not machine-checked at runtime |
| Stage handoff expectations (e.g., "produce a Master Briefing with these sections") | Prompt text — the LLM may deviate |
| Break Test Kit scenarios | `Break_Test_Kit.md` — manual adversarial testing, not automated |
| Prompt-internal conventions (section ordering, heading style, marker casing) | Prompt text + protocol `required_sections` — partially overlapping with Validator checks |
| Operator Run Layer documentation (when to escalate, how to handle pauses) | `08_Operator_Run_Layer.md` — operator must read and follow |
| End User Guide workflow descriptions | `07_End_User_Guide.md` — descriptive, not enforced |
| LLM tier routing recommendations | Console UI shows slot descriptions but does not prevent using any model for any stage |
| Contract ID prefix conventions | `stages[].contract_id_prefixes` in protocol — Validator can check prompts, but the LLM's output is not validated against these |

---

## Failure Vocabulary

The pipeline defines a fixed set of failure and degradation states. Each state has a specific meaning, a specific trigger, and a specific recovery path. When the Console shows one of these states, the operator knows exactly what happened and what to do next.

### Artifact States

| State | Meaning | Triggered by | Recovery |
|---|---|---|---|
| `current` | This is the active version of the artifact. | Initial save or accepted revision. | N/A — this is the normal state. |
| `superseded` | A newer revision replaced this artifact. | Saving a new version of the same artifact. | None needed — the old version is archived. The manifest retains the full history. |
| `missing_on_disk` | The manifest references an artifact that no longer exists as a file. | Manual file deletion outside the Console, or failed disk write. | Manifest cleanup (remove orphaned entries) or restore the file. |

### Package States

| State | Meaning | Triggered by | Recovery |
|---|---|---|---|
| `BLOCKED` | The package cannot proceed because it depends on something that isn't ready — a missing interface, an unresolved spec gap, or a broken upstream dependency. | LLM output contains a blocked-status signal matching the escalation patterns. | Resolve the upstream issue (usually a Stage 02 spec revision), then re-run the blocked package. |
| `REWORK` | The review found issues that require changes to the implementation. | Stage 05 reviewer sets `FINAL_DISPOSITION: REWORK` with specific findings. | Return to Stage 04, re-implement against the review findings, then re-review. The Console routes this automatically. |
| `ACCEPT` | The review confirmed the implementation meets its contract. | Stage 05 reviewer sets `FINAL_DISPOSITION: ACCEPT`. | N/A — package advances to merge eligibility. |

### Review States

| State | Meaning | Triggered by | Recovery |
|---|---|---|---|
| `STALE_REVIEW` | A review exists, but the implementation it evaluated has changed since the review was written. The review's bound fingerprint no longer matches the implementation fingerprint. | Saving a new implementation version after a review was already accepted. | Re-run Stage 05 against the updated implementation. The Console blocks merge until the binding is restored. |
| `REVIEW_BINDING_VALID` | The review's fingerprint matches the current implementation. | A review is saved against an implementation that hasn't changed since. | N/A — this is the normal state for a completed review cycle. |

### Workflow States

| State | Meaning | Triggered by | Recovery |
|---|---|---|---|
| `PAUSE_FOR_DECISIONS` | Stage 03 orchestrator identified decisions that require operator input before work packages can be finalized. | LLM output contains `Progression Status: PAUSE_FOR_DECISIONS` with a structured decision list. | Operator answers each decision. The Console builds a follow-up request with the answers included. |
| `ARCHITECTURE_RETRY` | The Architecture Spec is not safe to freeze — the architect flagged open questions or insufficient information. | Stage 02 output contains `Progression Status` ≠ `CLOSED` or `readiness = "Not Safe to Freeze"`. | Provide additional information or clarification, then re-run Stage 02. |
| `MERGE_IN_PROGRESS` | A cluster merge round is active in Stage 06. | Operator starts the clustered merge process. | Complete the current merge round — accept, rework, or escalate. |
| `RECLUSTER_UNLOCKED` | A merge cluster has failed consecutively past the threshold and the operator can restructure the merge plan. | Consecutive merge failures recorded by `recordClusterFailure()` exceeding the configured threshold. | Recluster the affected packages into smaller groups or different combinations. |

### Escalation

| Signal | Meaning | Recovery |
|---|---|---|
| Escalation to Stage 02 | The implementation or merge revealed a problem that cannot be fixed at the current stage — a missing interface, a contract conflict, or a dependency that the Architecture Spec didn't account for. | Return to Stage 02 for a targeted spec revision. The Console does not automate this — the operator must manually re-run the affected stages after the spec is updated. |
| Escalation to Operator | The LLM encountered a situation outside its prompt's authority — an ambiguous requirement, a domain question, or a constraint it cannot resolve. | Operator makes the decision and provides it as input to the next request. |

### Plausibility Warnings

These are not failure states — they are pre-save warnings that something *might* be wrong with the LLM output.

| Warning | Meaning | Action |
|---|---|---|
| Wrong-stage markers | The output contains tokens or section headers that belong to a different stage. | Check whether the LLM was given the wrong prompt or mixed up its role. |
| Truncation detected | The output appears cut off — missing closing sections or abnormally short. | Re-run the request. Context window limits or network issues may have truncated the response. |
| Missing expected keywords | Expected structural elements (section headers, contract IDs, status fields) are absent. | Check whether the LLM followed its output contract. Minor deviations may be acceptable; major ones warrant a re-run. |

---

## Terminology Reference

The protocol and the agnostic templates use different role names for three stages. When reading code or documentation, use this mapping:

| Stage | Protocol name | Agnostic template name |
|---|---|---|
| 04 | Module Implementer | Deliverable Author |
| 05 | Code Reviewer | Deliverable Reviewer |
| 06 | Merge Coordinator | Integration Coordinator |

The protocol's `agnostic_notes.role_name_mapping` is the authoritative source for this table. After compilation with a domain pack, the compiled prompts use the protocol role names (or domain-specific equivalents).

Key terminology to watch:

- **Work Package File** is the filename on disk. **Formal Package Contract** is the structured content inside it. **Work Package Contract** is the section header used in request packets built by `06_builders.js`.
- **Delivery Report** (not "delivery declaration") is the frozen token for the Stage 04 output summary.
- **Artifact Ledger** (capitalized) is the required section in Stage 03.

---

## Protocol Versioning

The protocol version (`pipeline_protocol_v1.json → version` field) is displayed in the Console workspace footer as a 10px monospace label (e.g., `Protocol v1.2.0`) with a tooltip showing the calibration date.

The protocol is versioned independently from the Console and from the prompt templates. A protocol version bump (e.g., 1.1.0 → 1.2.0) means that required_sections, frozen_tokens, or structural definitions have changed. The Console constant `PROTOCOL_VERSION` in `00_constants.js` must be updated to match.

Current version: **1.2.0** (calibrated 2026-03-25 against v5 agnostic templates + clustered merge design).
