# Repo Governance

Rules for maintaining LLMFrame. These apply to the sole maintainer and to any future contributors. They exist because a protocol-driven system dies from exceptions, not from missing features.

## Hard constraints

**Do not let every valid niche use case become a first-class core mode.** That is how a protocol-driven system turns into a pile of exceptions. Most ideas belong in domain pack guidance or documentation, not in new protocol fields or Console behavior.

**Do not let docs lag silently behind behavior.** Temporary mismatch during active development is normal. Silent mismatch — where behavior changed but docs still describe the old version — destroys trust. Every commit that changes behavior must update the affected docs in the same commit. Not soon after. In the same commit.

**Do not confuse "people can imagine a use case" with "the repo should support it now."** Keep the support bar evidence-based. A simulated review is not evidence. A real user hitting a real limitation is.

**Do not merge structural changes without a working test path.** A feature that reads well but breaks the render loop is worse than no feature. Before any protocol-level or Console-level change ships, verify that the Console still loads and the affected workflow path still completes.

**Do not let a single session's momentum override the evidence bar.** If a hypothesis and an implementation land in the same session without external validation, that's a signal to pause before publishing — not proof that the feature is ready.

## Decision framework

Every proposed change falls into one of four categories. The category determines the evidence bar.

| Category | What it means | Evidence required | Example |
|---|---|---|---|
| **Core protocol change** | New field or behavior that the Console reads at runtime and that affects workflow | Real user feedback or a confirmed gap in production use | `review_mode` field |
| **Optional mode** | Behavior gated behind a flag, default path unchanged | A plausible use case with at least one concrete scenario. Can ship provisionally but must be demoted if unused after 6 months | Craft review |
| **Domain-pack-only guidance** | Advice or conventions documented in domain pack guides, no code change | A reasonable argument. Low bar — this is documentation | "For legal packs, use CR- prefix for cross-references" |
| **Not supported yet** | Acknowledged need, no implementation | Just the acknowledgment | Multi-user concurrent access |

When in doubt, default to the lower category. A domain-pack-only recommendation that turns out to need code support can be promoted. A core protocol change that turns out to be unnecessary is expensive to remove.

## New feature requirements

Every new feature must answer three questions in writing before it ships:

1. **What evidence triggered this?** A real user report, a production gap, a confirmed workflow failure. "It seemed like a good idea" is not evidence.
2. **What existing guarantee must remain unchanged?** Name the specific default-path behavior that must not break. If you can't name one, the feature is too vaguely scoped.
3. **What would count as proof that this feature was a mistake?** Define a concrete signal — a timeframe with no adoption, a pattern of confusion, a maintenance cost that exceeds the value. If the feature can't fail, it's not well-defined enough.

## Protecting the default path

The Coding domain pack is the reference implementation. Every workflow path, every doc example, every test scenario assumes it first. New options branch outward from this path — they do not blur it.

Concretely:
- New protocol fields must have a default value that preserves current behavior.
- New Console UI elements must be invisible when the default applies.
- New Compiler behavior must produce the same output for coding domains as before.
- Docs must describe the default path first, then the variant.

## Runtime configuration discipline

Cap the number of protocol fields that affect Console behavior at runtime. Each new runtime field increases the configuration surface and the number of paths to test. Before adding a runtime-read protocol field, ask: can this be a domain pack recommendation instead of a protocol switch?

`review_mode` is the first runtime behavioral field beyond version metadata. If five more follow — `merge_strategy`, `escalation_style`, `package_granularity` — the Console becomes a configuration monster. Each proposed field must justify why a domain pack recommendation is insufficient.

## The "not doing" list

Maintain an explicit list of features that have been considered and rejected, with reasons. This prevents re-evaluation of the same ideas and gives contributors a clear answer when they ask "why doesn't LLMFrame support X?"

Current not-doing list:
- **Multi-user concurrent access** — would require DAG-based manifest with branching fingerprint chains. Destroys simplicity. Use Git for human-to-human coordination.
- **Build tooling / bundler** — HTML + JS modules with no build step is an intentional architectural choice, not a limitation.
- **Agent mode / autonomous execution** — the operator-in-the-loop design is foundational, not a temporary constraint.
- **GUI prompt editor** — prompts are text files. Edit them in any text editor. A GUI adds a maintenance surface with no structural benefit.

## Repo evolution as discipline

The quality of the feedback → evidence → change pipeline matters as much as any individual feature. Fast iteration feels productive but compounds maintenance debt if the evidence bar is soft. A feature that ships without evidence and without a failure condition is permanently irremovable — no one will ever have enough confidence to take it out.

Treat every protocol version bump as a publication event, not a save point.
