# Domain Pack Guide

LLMFrame ships with two domain packs — **Coding** (the reference implementation) and **Technical Report** (a working non-coding example). This guide explains how to create your own domain pack for any field: legal, engineering, research, book publishing, hardware design, or anything else that benefits from structured multi-stage work.

## What a domain pack is

A domain pack is a set of 6 prompt files — one per pipeline stage — that speak the LLMFrame protocol while using terminology specific to your field. The Console doesn't care whether your deliverables are source code, legal briefs, or engineering calculations. It cares that the prompts produce artifacts with typed IDs, status fields, and contract references in the expected format.

The key insight: **the prompts are interchangeable, the protocol is not.** Every domain pack must speak the same protocol — frozen tokens, contract ID prefixes, artifact names, section headers — so the Console can track, fingerprint, and enforce transitions regardless of domain.

## Two ways to create a domain pack

### Option A: Use the Prompt Compiler (recommended)

The fastest path. The domain-agnostic templates contain `[DOMAIN:]` markers where domain-specific content needs to go. The Prompt Compiler fills them in.

**Steps:**

1. Open the Prompt Compiler (`Pipeline_Prompt_Compiler_v2.txt`) in an LLM chat.
2. Paste all 6 agnostic template files.
3. Describe your target domain. Be specific — not just "engineering" but "structural steel connection design for commercial buildings per Eurocode 3."
4. The Compiler replaces every `[DOMAIN:]` marker with domain-appropriate content and returns 6 complete prompt files.
5. Run the Prompt Validator on the compiled output to verify structural completeness.
6. Save the 6 files with the standard naming convention (`01_` through `06_` prefixes) into a prompt folder.

**What `[DOMAIN:]` markers look like:**

```
[DOMAIN: primary deliverable type — e.g., "chapter manuscript", "calculation sheet"]
[DOMAIN: verification method — e.g., "peer review", "proof check", "code review"]
[DOMAIN: how deliverables connect — e.g., "cross-references", "interface contracts"]
```

Each marker includes a hint explaining what kind of content is expected. The Compiler uses these hints plus your domain description to generate appropriate replacements.

### Option B: Modify the Coding prompts directly

If you prefer hands-on control, start from the Coding prompts and replace domain-specific terminology manually. This gives you more control but requires understanding which parts are frozen (protocol-level, must not change) and which are domain-variable.

**What you can change:**
- Role names ("Implementation Author" → "Drafting Author", "Technical Reviewer" → "Peer Reviewer")
- Deliverable descriptions (what a "package" contains in your domain)
- Quality criteria (what counts as a defect)
- Verification methods (tests → peer review, calculations → spot checks)
- Domain examples and heuristics
- Initial greeting text (the `[DOMAIN:]` role name only — keep the sentence structure)

**What you must NOT change:**
- Frozen tokens (`FINAL_DISPOSITION: ACCEPT`, `REVIEW_BINDING_TOKEN:`, `Merge-Blocking: YES/NO`, etc.)
- Artifact names (`Master Briefing`, `Architecture Spec`, `Work Package File`, `Delivery Report`, etc.)
- Contract ID prefix format (`MOD-xx`, `TYPE-xx`, `IF-xx`, `ARTIFACT-xx`)
- Requirement ID prefix format (`FACT-xx`, `DEC-xx`, `DONE-xx`, `SCOPE-IN-xx`)
- `<OUTPUT_CONTRACT>`, `<CRITICAL_RULE>`, `<HARD_CONSTRAINT>`, `<DO_NOT_BREAK>` tags and their content
- Stage numbers (01–06)
- The Delivery Report section structure
- The Review Report finding format and severity classifications (`CRITICAL`, `MAJOR`, `MINOR`, `NOTE`)
- The Escalation and Repair Prompt Template structures

## Validating your domain pack

After creating your prompts, run them through the **Prompt Validator** (`pipeline_prompt_validator.html`). It checks:

- All frozen tokens present and correctly spelled
- Required sections exist in each prompt
- Contract ID prefixes are used correctly
- Initial greetings have the `<DO_NOT_BREAK>` tag
- `<OUTPUT_CONTRACT>` blocks are present
- Cross-prompt handoff references are consistent

The Validator supports two modes: **Compiled** (expects zero `[DOMAIN:]` markers) and **Agnostic** (expects markers, skips certain token checks). Make sure you're validating in the right mode.

## Testing your domain pack

Before using a new domain pack on a real project:

1. Load the prompts in the Console and verify the domain is auto-detected.
2. Run a small test project (2–3 packages) through the full pipeline.
3. Pay attention to Stage 05 (Review) — this is where domain-specific quality criteria matter most. If the reviewer doesn't know what to look for in your domain, the prompts need more specific guidance.
4. Check that the Analyzer's cross-prompt consistency checks pass. Run the Analyzer against your compiled pack.

## Example: What changed between Coding and Technical Report

To illustrate the scope of changes, here's what the Technical Report pack modified:

| Aspect | Coding | Technical Report |
|--------|--------|-----------------|
| Primary deliverable | Source code files | Report sections/chapters |
| Verification method | Tests, linting | Peer review, fact-checking |
| Interface contracts | Function signatures, types | Cross-references, shared terminology |
| Quality criteria | Compiles, passes tests, handles errors | Accurate, well-sourced, internally consistent |
| Package = | One module/component | One chapter/section |
| Integration = | Merge code, resolve conflicts | Assemble document, verify cross-references |

The pipeline structure — requirements → architecture → decomposition → execution → review → integration — remained identical. Only the domain-specific content inside that structure changed.

## Contributing a domain pack

If you've built a domain pack that works well, consider contributing it back to the repository. See [CONTRIBUTING.md](CONTRIBUTING.md) for the process. Include a brief description of the domain, any domain-specific considerations, and ideally a small example project that demonstrates the pack in action.
