# FAQ — How LLMFrame Compares

## "How is this different from Cursor / Copilot / Windsurf?"

Those are code-writing accelerators. They take a prompt and produce code, often impressively. LLMFrame doesn't write code — it manages the *process* around code generation. The question isn't "can the LLM write a function?" (it can), it's "can you trace why that function exists, what spec it implements, who reviewed it, and what breaks if you change it?" Cursor takes nice pictures. LLMFrame takes x-rays.

You can use both together. Use Cursor or Copilot to write the code, then paste the output into LLMFrame's Stage 04 as the implementation artifact. The pipeline doesn't care *how* the code was produced — it cares that it gets reviewed, fingerprinted, and tied to the spec that requested it.

## "How is this different from CrewAI / AutoGen / LangGraph?"

Those are agent orchestration frameworks — they let multiple LLMs talk to each other autonomously, often with tool use, memory, and chain-of-thought loops. LLMFrame is the opposite: a *human* orchestration framework where the operator decides every transition. No LLM ever calls another LLM. No tool runs without the operator explicitly triggering it.

This is a design choice, not a limitation. Autonomous agents optimize for speed. LLMFrame optimizes for accountability. When an agent chain produces a wrong answer, debugging means reading logs of LLM-to-LLM conversations you weren't part of. When LLMFrame produces a wrong answer, every decision point is a named artifact that a human explicitly accepted.

## "Can I use this with just one LLM?"

Yes. The "Multi-LLM" in the original name referred to the ability to route different stages to different models — Claude for architecture, ChatGPT for implementation, a local model for simple reviews. But nothing stops you from using the same model for everything. The pipeline structure is valuable regardless of how many models you use.

## "Is this just a prompt chain?"

No. A prompt chain feeds one LLM's output as the next LLM's input, usually automatically. LLMFrame has six stages, but the human reads and verifies at every boundary. More importantly, the value isn't in the prompts — it's in the contract system. Each stage produces artifacts with typed IDs, explicit dependencies, and status tracking. The Console enforces transitions and maintains an append-only audit log. Prompt chains don't have manifests, fingerprints, or rework routing.

## "Why not just use ChatGPT with a long system prompt?"

You can get surprisingly far with a single well-crafted prompt. But past a certain project size — roughly 3+ interconnected components — a single context window can't hold the full state. You lose track of which decisions are finalized, which interfaces are frozen, and which assumptions were validated. LLMFrame externalizes that state into files on disk, so the project memory doesn't depend on any single context window.

The other difference is rework. When something breaks in a long chat, you scroll back, rewrite, and hope the model picks up the change correctly. In LLMFrame, rework is structural: one package gets re-implemented, its review binding is invalidated, downstream packages are flagged — and everything else stays untouched.

## "Why HTML? Why not Electron, or a VS Code extension?"

Zero dependencies. The Console is a single HTML file with JS modules that runs in any Chromium browser. No npm install, no build step, no server, no accounts. Copy the folder to an air-gapped machine and it works. An Electron app or VS Code extension would add build tooling, update mechanisms, and platform dependencies — all of which conflict with the design goal of "nothing to audit except files you can read."

## "Does this work for non-coding projects?"

Yes. The included domain-agnostic templates have `[DOMAIN:]` markers that the Prompt Compiler replaces with domain-specific terminology. A Technical Report domain pack ships as a working reference. The pipeline structure — requirements → architecture → decomposition → execution → review → integration — applies to any complex deliverable: legal documents, research papers, engineering specifications, book manuscripts.

## "Does the review stage work for creative writing?"

Partially — and the pipeline is designed for that. As of v1.4.0, domain packs can set `review_mode: "structural+craft"` in the protocol. This splits review into two passes: a structural review (continuity, timeline logic, character inventory, internal consistency) that uses the standard ACCEPT/REWORK gate, and an optional craft review (tone, pacing, voice, style) that produces annotative feedback without blocking merge. The structural pass catches real errors — a character referenced in chapter 7 who was never introduced, a timeline contradiction, a naming inconsistency. The craft pass gives subjective feedback that the operator can act on or ignore. See [Domain Transfer](docs/DOMAIN_TRANSFER.md) for the full picture.

## "Can a team use this?"

One operator at a time, yes. Multiple operators on the *same* project simultaneously, no — that would require turning the manifest into a DAG with branching fingerprint chains, which destroys the simplicity. For team workflows: one person operates the pipeline, others contribute via Git as they would normally. LLMFrame manages the human-to-LLM conversation. Git manages the human-to-human conversation. See [the full analysis](docs/ANALYSIS_Multi_User_Concurrent_Access.md).

## "What if I disagree with the 6-stage structure?"

The stages aren't arbitrary — they mirror how experienced engineers decompose complex work. But they're also not hardcoded in the Console. The Console reads stage assignments from filename prefixes (`01_` through `06_`). If you wrote a 4-stage prompt set with prefixes `01_` through `04_`, the Console would track four stages. The 6-stage structure is the reference implementation, not a hard constraint.

## "How mature is this?"

Stable and in daily use by the author for real projects (see the "Built with this pipeline" section in the README). The Console, Validator, Analyzer, and Protocol are actively maintained. This is a personal toolkit shared publicly — it works, it's documented, and it handles edge cases because those edge cases were hit in production. Community contributions are welcome; response times may vary.
