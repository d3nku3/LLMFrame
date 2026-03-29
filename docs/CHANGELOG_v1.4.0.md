# v1.4.0 — Craft Review Mode

## What's new

LLMFrame can now handle domains where quality isn't purely binary. Until now, Stage 05 was a hard gate: ACCEPT or REWORK, no middle ground. For software, that's exactly right — code compiles or it doesn't. For creative writing, game narrative, or editorial work, it's too narrow. Tone, pacing, and voice can't be judged with yes/no.

## What changed

Domain packs can now set `review_mode: "structural+craft"` in the protocol. When active, the Console shows two additional options after a package is accepted:

- **Craft Review** — an optional LLM-based review pass focused on subjective quality (tone, voice, pacing, style). Produces annotative feedback. Blocks nothing.
- **Craft Notes** — a free text field for the operator's own observations. Saved and audit-logged.

The structural review (continuity, logic, contract compliance) remains the gate for merge. Craft review and craft notes are additions — skip them if you don't need them.

## What changes for existing users

Nothing. The default remains `"gated"`. If you're using the Console with the Coding pack today, you'll see no difference.

## Who is this for

Anyone who wants to use LLMFrame in domains where quality isn't only structurally measurable — novelists, narrative designers, editors, UX writers. The Prompt Compiler detects these domains automatically and produces an additional `05b_Craft_Reviewer` prompt alongside the standard six.

## Files changed

- `pipeline_protocol_v1.json` — new `review_mode` field
- `00_constants.js` — version bump, `reviewMode` variable
- `06_builders.js` — `buildCraftReviewRequest()`, `getCraftReviewPromptText()`
- `07_render.js` — craft review and craft notes UI on the package-accepted card
- `08_events.js` — protocol loader reads `review_mode`, four new non-gating handlers
- `Pipeline_Prompt_Compiler_v2.txt` — Step 2b (review mode assessment), 05b_ prompt generation
- All docs updated: Architecture, Protocol Reference, Console Guide, Domain Pack Guide, Domain Transfer, FAQ, Operating Guide, Operator Run Layer
