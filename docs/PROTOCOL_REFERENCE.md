# Protocol Reference

`pipeline_protocol_v1.json` (currently v1.3.1) is the single source of truth for structural validation across LLMFrame. It defines what every prompt must contain, which tokens are frozen, how stages hand off to each other, and the rules for clustered merge. Three consumers read this file: the Prompt Validator, the Prompt Analyzer, and the Operator Console.

This document explains what each section of the protocol does, why it exists, and what happens when you change it.

## Protocol Structure Overview

```
pipeline_protocol_v1.json
├── version                    — semver string (e.g., "1.3.1")
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

Regex patterns that detect when an LLM output signals a blocked state or requires escalation to an earlier stage. The Console uses these to identify when a package cannot proceed and needs operator intervention.

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

## Agnostic Notes

Documents which frozen tokens are intentionally absent from the domain-agnostic templates and why. This prevents the Validator from raising false positives when validating templates instead of compiled prompts.

For example, `IMPLEMENTATION_FINGERPRINT:` is absent from the agnostic Stage 05 template because it is injected by the Console's request builder at runtime, not hardcoded in the prompt. The `agnostic_notes` section records this so the Validator knows to skip the check in agnostic mode.

## How Each Consumer Uses the Protocol

### Prompt Validator

Loads the protocol (embedded or external JSON file) and checks each prompt file against its stage definition. Reports pass/fail per check with detailed findings. Supports both compiled mode (strict, no markers allowed) and agnostic mode (markers expected, some token checks skipped per `agnostic_notes`).

### Prompt Analyzer

Runs cross-prompt consistency checks using the `cross_prompt_checks` and `escalation_patterns` sections. Verifies frozen token coverage across the full 6-prompt set and checks contract ID prefix alignment. Detects drift between prompts that should reference each other.

### Operator Console

Uses frozen tokens and required sections to run plausibility checks on LLM output before saving artifacts. Uses contract ID prefixes to parse lineage. Uses escalation patterns to detect blocked states and route rework. Uses cluster merge configuration for Stage 06 operations.

## Versioning

The protocol follows semantic versioning:

- **Patch** (1.3.0 → 1.3.1): Documentation, `agnostic_notes` updates, no behavioral change.
- **Minor** (1.2.0 → 1.3.0): New fields, new checks, new patterns. Existing consumers still work but may not leverage new features.
- **Major** (1.x → 2.0): Breaking changes to field names, removed sections, changed semantics. All consumers must be updated.

All three consumers display and verify the protocol version they were built against. A version mismatch between the loaded protocol and a consumer's expected version triggers a warning, not a block — allowing forward compatibility during incremental updates.

## Modifying the Protocol

If you need to add a frozen token, a new required section, or a new escalation pattern:

1. Edit `pipeline_protocol_v1.json` directly.
2. Run the Prompt Validator against your prompt set to verify nothing broke.
3. Run the Analyzer for cross-prompt consistency.
4. If the Console has hardcoded rules that duplicate what you changed (see the C1 migration backlog in ARCHITECTURE.md), update those as well until the migration is complete.
5. Bump the version number according to the severity of the change.

**Do not** rename or remove frozen tokens without updating all prompts and all consumers simultaneously. A renamed token will silently break plausibility checks, review binding, or lineage parsing.
