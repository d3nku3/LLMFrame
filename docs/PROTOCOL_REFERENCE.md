# Protocol Reference

`pipeline_protocol_v1.json` (currently v1.4.0) is the single source of truth for structural validation across LLMFrame. It defines what every prompt must contain, which tokens are frozen, how stages hand off to each other, and the rules for clustered merge. All three consumers read this file: the Prompt Validator, the Prompt Analyzer, and the Operator Console (which loads it at runtime from the prompt folder or workspace root).

This document explains what each section of the protocol does, why it exists, and what happens when you change it.

## Protocol Structure Overview

```
pipeline_protocol_v1.json
├── version                    — semver string (e.g., "1.4.0")
├── stages                     — per-stage validation rules
│   ├── stage_01 ... stage_06
│   │   ├── label              — human-readable stage name
│   │   ├── number             — stage number (1–6)
│   │   ├── frozen_tokens      — strings that must appear verbatim
│   │   ├── required_sections  — section headings that must exist
│   │   └── contract_id_prefixes — ID patterns this stage may define
├── universal_checks           — rules that apply to all stages
├── escalation_patterns        — regex patterns for blocked/escalation routing
├── cross_prompt_checks        — inter-stage handoff validation
├── cluster_merge              — clustered merge configuration
├── review_mode                — "gated" (default) or "structural+craft"
└── agnostic_notes             — documents intentional absences in templates
```

## Stages

Each stage entry (`stage_01` through `stage_06`) contains the validation rules for that stage's prompt.

### `frozen_tokens`

An array of strings that must appear **verbatim** in a compiled prompt for that stage. These are machine-parsed by the Console and Validator — renaming, reformatting, or removing them breaks downstream tooling.

Examples: `"FINAL_DISPOSITION: ACCEPT"`, `"REVIEW_BINDING_TOKEN:"`, `"Delivery Report"`, `"Master Briefing"`

The Validator checks for exact string matches. A token that appears with different casing, extra whitespace, or embedded in a longer word will fail validation.

### `required_sections`

Section headings that must be present in the prompt. These define the structural skeleton that the Console and Analyzer expect. A prompt missing a required section may still work with an LLM, but the Console's plausibility checks will flag the output as structurally incomplete.

### `contract_id_prefixes`

The ID patterns each stage is allowed to define. Stage 01 defines requirement IDs (`FACT-xx`, `DEC-xx`, `DONE-xx`, `SCOPE-IN-xx`), Stage 02 defines architectural IDs (`MOD-xx`, `TYPE-xx`, `IF-xx`), and so on. These prefixes create the traceable lineage chain across stages — a requirement in Stage 01 maps to an interface in Stage 02, a package in Stage 03, an implementation in Stage 04, and a review finding in Stage 05.

## Universal Checks

Rules that apply across all stages, not tied to any single prompt:

- **OUTPUT_CONTRACT tag** — every prompt must contain an `<OUTPUT_CONTRACT>` block.
- **Minimum length** — prompts below a character threshold are flagged (catches truncated pastes).
- **Residual domain markers** — compiled prompts must not contain `[DOMAIN:]` markers. Agnostic templates are expected to have them.

## Escalation Patterns

Regex patterns that detect when an LLM output signals a blocked state or requires escalation to an earlier stage. The Analyzer validates these patterns against the prompts. The Console uses equivalent hardcoded patterns for runtime detection.

The patterns match phrases like "Status: Blocked", "requires Architecture Spec revision", or "escalate to Stage 02". They are intentionally broad to catch varied LLM phrasing, but precise enough to avoid false positives on normal discussion of blocking concepts.

## Cross-Prompt Checks

Inter-stage handoff validation. These rules verify that what one stage promises to produce, the next stage expects to receive. For example:

- Stage 04 produces a `Delivery Report` → Stage 05 must reference `Delivery Report` as input.
- Stage 03 produces `Work Package File` → Stage 04 must expect it.
- Stage 05 produces `FINAL_DISPOSITION` → Stage 06 must consume it.

The Analyzer runs these checks across all 6 prompts simultaneously. A failure here means the handoff between two stages is broken — one side was changed without updating the other.

## Cluster Merge

Configuration for the iterative merge system in Stage 06:

- **threshold** — how many packages trigger clustered merge (vs. sequential merge).
- **cluster_size** — maximum packages per merge cluster.
- **naming_pattern** — how merge clusters are labeled.
- **substates** — the internal state machine for merge iteration (e.g., `MERGE_IN_PROGRESS`, `REWORK_REQUESTED`, `MERGE_ACCEPTED`).
- **audit_event_types** — event types written to the audit log during merge operations.

## Review Mode

A top-level field that controls whether the Console offers craft review capabilities alongside the standard structural review gate.

- **`"gated"`** (default): Stage 05 is binary ACCEPT/REWORK. No craft review UI. This is the standard behavior for software and other domains with fully verifiable quality criteria.
- **`"structural+craft"`**: Stage 05 remains binary ACCEPT/REWORK for structural checks (continuity, contract compliance, internal logic). After a package is accepted, the Console additionally offers an optional craft review pass (annotative, non-gating) and a craft notes text field. Craft artifacts are tracked and audit-logged but never block merge.

The Prompt Compiler sets this field based on whether the domain has subjective quality dimensions. Domain packs for creative writing, game narrative, editorial content, and similar fields should use `"structural+craft"`. The Console reads this field at protocol load time.

When `review_mode` is `"structural+craft"`, the Prompt Compiler also produces a `05b_Craft_Reviewer.txt` prompt alongside the standard six. The Console's craft review builder looks for this file by the `05b_` prefix and falls back to the standard Stage 05 prompt with a craft-mode operator note if no dedicated prompt is available.

## Agnostic Notes

Documents which frozen tokens are intentionally absent from the domain-agnostic templates and why. This prevents the Validator from raising false positives when validating templates instead of compiled prompts.

For example, `IMPLEMENTATION_FINGERPRINT:` is absent from the agnostic Stage 05 template because it is injected by the Console's request builder at runtime, not hardcoded in the prompt. The `agnostic_notes` section records this so the Validator knows to skip the check in agnostic mode.

## How Each Consumer Uses the Protocol

### Prompt Validator

Loads the protocol (embedded or external JSON file) and checks each prompt file against its stage definition. Reports pass/fail per check with detailed findings. Supports both compiled mode (strict, no markers allowed) and agnostic mode (markers expected, some token checks skipped per `agnostic_notes`).

### Prompt Analyzer

Runs cross-prompt consistency checks using the `cross_prompt_checks` and `escalation_patterns` sections. Verifies frozen token coverage across the full 6-prompt set and checks contract ID prefix alignment. Detects drift between prompts that should reference each other.

### Operator Console

Loads `pipeline_protocol_v1.json` at runtime from the prompt folder or workspace root. On successful load, the Console derives stage labels, plausibility rules, and `review_mode` from the protocol. If the file is absent, the Console falls back to hardcoded constants aligned at v1.4.0. The protocol version and calibration date are displayed in the workspace footer.

## Versioning

The protocol follows semantic versioning:

- **Patch** (1.3.0 → 1.3.1): Documentation, `agnostic_notes` updates, no behavioral change.
- **Minor** (1.3.1 → 1.4.0): New `review_mode` field, craft review support. No breaking changes — default remains `"gated"`.
- **Minor** (1.2.0 → 1.3.0): New fields, new checks, new patterns. Existing consumers still work but may not leverage new features.
- **Major** (1.x → 2.0): Breaking changes to field names, removed sections, changed semantics. All consumers must be updated.

All three consumers load and display the protocol version. The Console reads the version from the loaded protocol file at runtime; if the file is absent, it falls back to the version compiled into `00_constants.js`. A version mismatch between the loaded protocol and a consumer's expected version triggers a warning, not a block — allowing forward compatibility during incremental updates.

## Modifying the Protocol

If you need to add a frozen token, a new required section, or a new escalation pattern:

1. Edit `pipeline_protocol_v1.json` directly.
2. Run the Prompt Validator against your prompt set to verify nothing broke.
3. Run the Analyzer for cross-prompt consistency.
4. The Console loads the protocol at runtime, but maintains hardcoded fallback values in `00_constants.js` for when the protocol file is absent. If your change affects stage labels, plausibility rules, or version metadata, update the fallbacks as well.
5. Bump the version number according to the severity of the change.

**Do not** rename or remove frozen tokens without updating all prompts and all consumers simultaneously. A renamed token will silently break plausibility checks, review binding, or lineage parsing.
