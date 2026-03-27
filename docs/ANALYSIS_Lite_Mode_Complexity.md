# Why Lite Mode Is Harder Than Clustered Merge

**Project:** LLMFrame  
**Author:** Dennis Kühn + Claude  
**Date:** 2026-03-26  
**Context:** Feature request analysis for a simplified pipeline mode with optional escalation to full pipeline.

---

## The Intuition (and Why It's Wrong)

Lite Mode sounds like the simpler feature. "Just skip some stages." Clustered Merge sounds complex — it restructures how the final merge stage operates across multiple iterations. Surely adding stages is harder than removing them?

The opposite is true. Clustered Merge is architecturally trivial compared to Lite Mode with escalation. Here's why.

---

## Clustered Merge: A Loop Around Something That Works

The full LLMFrame pipeline is a six-stage contract chain:

```
RE → Architect → Orchestrator → Implementer → Reviewer → Merger
```

Clustered Merge modifies exactly one stage: Stage 06 (Merge Coordinator). Instead of receiving all reviewed packages at once, it receives them in clusters of 3-4 and merges iteratively.

**What changes:**
- The Console runs Stage 06 in a loop.
- A counter tracks which cluster is being merged.
- Intermediate merge artifacts are stored in the manifest.

**What stays the same:**
- The Merge Coordinator prompt is unchanged. It doesn't know or care whether it's merging 3 packages or 12. It receives packages, it merges them.
- The input format is identical. The output format is identical.
- The contract surface — what each role produces and what it expects — is untouched.
- All upstream stages (01–05) are completely unaffected.

Architecturally, Clustered Merge is a `for` loop around an existing stage. The Console tracks a counter and a partial manifest. That's it.

---

## Lite Mode: Subtraction From a Dependency Chain

The six pipeline stages are not independent. They form a **contract chain** where each stage's prompt contains mandatory references to artifacts from upstream stages:

| Stage | Expects From Upstream |
|-------|-----------------------|
| 02 — Architect | Requirements document from Stage 01 |
| 03 — Orchestrator | Architecture contracts from Stage 02 |
| 04 — Implementer | Work packages from Stage 03, architecture contracts from Stage 02 |
| 05 — Reviewer | Implementation fingerprints from Stage 04, architecture contracts from Stage 02 |
| 06 — Merger | Reviewed packages with FINAL_DISPOSITION from Stage 05 |

Remove any stage, and the stages downstream don't just degrade — they **break**. Their prompts contain mandatory input sections that reference artifacts that no longer exist. The Reviewer can't review without fingerprints. The Merger can't merge without review dispositions.

Lite Mode is therefore not "run fewer stages." It is "produce a parallel set of prompts that function without the artifacts those stages would have created." That is a **second contract surface** — a parallel pipeline with its own assumptions, its own input/output definitions, and its own validation rules.

---

## Escalation: The Third Contract Surface

Now add the escalation requirement: mid-project, the user (or the system) decides the project is too complex for Lite Mode and needs to switch to full pipeline.

This creates a **state gap problem.**

### Scenario: Escalation at Stage 04

The user has been running Lite Mode. They've gone through a simplified requirements/architecture step and are now at implementation. Something goes wrong — the module is more complex than expected. They escalate to full pipeline.

The full pipeline's Reviewer (Stage 05) now needs:

- Architecture contracts from Stage 02 — **never created.**
- An orchestration plan from Stage 03 — **never created.**
- Implementation fingerprints in the Stage 02 contract format — **the Lite implementation used a different format.**

Two options exist, and both are bad:

**Option A — Retroactive generation.** Run Stages 01–03 against code that already exists. This inverts the pipeline's entire design premise. The architecture is supposed to inform the implementation, not be reverse-engineered from it. The generated artifacts will be post-hoc rationalizations, not actual design decisions. The Reviewer will be validating implementation against an architecture that was written to match the implementation — a circular validation that proves nothing.

**Option B — Escalation adapter.** Create "synthetic" bridge artifacts that translate Lite Mode output into the format the full pipeline expects. This is a **third contract surface** — neither the Lite contracts nor the Full contracts, but a translation layer between them. It must understand both formats, map between them, and fill in gaps with reasonable defaults. Every time either the Lite or Full prompts change, the adapter must be updated. It's a maintenance multiplication problem.

---

## The Console State Machine Problem

The Pipeline Operator Console manages workflow state via `resolveWorkflowSnapshot()`, which walks a linear state graph:

```
STAGE1 → STAGE2 → STAGE3 → STAGE4 → STAGE5 → STAGE6 → COMPLETE
```

Clustered Merge adds a loop at one point:

```
... → STAGE5 → STAGE6_CLUSTER_1 → STAGE6_CLUSTER_2 → ... → STAGE6_FINAL → COMPLETE
```

Still linear. One new concept (iteration counter). Easy to implement, easy to reason about, easy to debug.

Lite Mode adds conditional skip logic at **every** stage:

```
STAGE1 → (skip 2?) → STAGE3_LITE|STAGE2 → (skip 3?) → ...
```

Add escalation and the state machine becomes a directed graph with conditional edges and mid-run topology changes:

```
LITE_START → LITE_IMPL → (escalate?) → BRIDGE → STAGE3_FULL → STAGE4_FULL → ...
                ↓
           LITE_REVIEW → LITE_DONE
```

The number of valid state transitions roughly triples. Every Console function that checks "what stage are we at?" must now also check "which mode are we in?" and "have we escalated?" This isn't additive complexity — it's multiplicative. Every existing code path branches.

---

## The Paradox

LLMFrame already includes a complexity assessment in Stage 01. Projects are classified as:

- **VIBE-CODABLE** — simple enough that the pipeline adds more overhead than value.
- **PIPELINE RECOMMENDED** — benefits from structure but could survive without it.
- **PIPELINE REQUIRED** — too complex for unstructured development.

Lite Mode is essentially the VIBE-CODABLE tier formalized as a pipeline stage. But the entire point of that classification is: "you don't need the pipeline for this." Building a structured process for projects that don't need structured process is a contradiction. The overhead of entering Lite Mode, tracking Lite state, and potentially escalating is likely to exceed the overhead of just running the full pipeline on a small project.

---

## The Clean Path

If Lite Mode is worth building at all, the architecturally honest implementation is:

### One Prompt, Hard Cut

1. **Lite Mode is a single combined prompt.** Not a reduced pipeline — a standalone prompt that rolls RE + Architect + Implementer into one document. It produces code with minimal ceremony. No contract chain. No fingerprints. No review gate. One in, one out.

2. **Escalation is a restart, not a resume.** If the project outgrows Lite Mode, you start the full pipeline from Stage 01. The Lite Mode output (code + whatever notes exist) becomes a **reference input** for the Requirements Engineer — similar to how BrickGen's MVP codebase informed the V2 design without being directly upgraded. You lose some work. You preserve architectural sanity.

3. **No bridge layer. No synthetic artifacts. No dual-mode Console state.** The Console either runs Lite (one prompt, one response, done) or Full (six stages, linear state machine). Never both in the same run.

This is less powerful than a smooth Lite-to-Full escalation. It's also the only version that doesn't create a maintenance burden that grows with every pipeline version.

---

## Summary

| Dimension | Clustered Merge | Lite Mode | Lite + Escalation |
|-----------|----------------|-----------|-------------------|
| Contract surfaces | 1 (unchanged) | 2 (Full + Lite) | 3 (Full + Lite + Bridge) |
| Stages affected | 1 (Stage 06) | All 6 | All 6 + adapter |
| Console state changes | Loop at one point | Conditional at every point | Conditional + branch + restart |
| Prompt changes | 0 | 6 new Lite prompts | 6 Lite + bridge templates |
| Maintenance multiplier | 1× | 2× | 3× |
| Risk of contract drift | None | High | Very high |

Clustered Merge adds iteration to one stage. Lite Mode adds conditionality to every stage, requires a parallel prompt set, and escalation requires a third bridge layer that translates between two incompatible contract surfaces mid-run.

**It's not a feature — it's a fork.**

---

*This analysis was produced during the BrickGen V2 design session as a reference for LLMFrame feature planning.*
