# Domain Transfer: Where LLMFrame Works Beyond Code — and Where We Need Your Help

LLMFrame was built for software projects, but the architecture isn't software-specific. The 6-stage pipeline — requirements, architecture, decomposition, execution, review, integration — is a universal pattern for any work that's complex enough to benefit from being split into contracted parts. The Console doesn't know what a "module" is. It tracks artifacts, enforces stage gates, fingerprints revisions, and routes rework. It works the same way whether the artifacts contain Python code or legal briefs.

We ship domain-agnostic templates and a Prompt Compiler that lets you adapt the pipeline to any field. A Technical Report domain pack is included as a working non-coding reference. But honest assessment matters more than marketing, so here's what we actually know — and what we don't.

## What transfers cleanly

The stage structure, the Console mechanics, and the rework loop are fully domain-agnostic. Fingerprinting, audit logs, review-to-implementation binding, stage gates, manifest tracking — none of this depends on the domain. If your work has deliverables that can be versioned, reviewed, and traced back to requirements, the infrastructure works.

The decomposition logic (Stage 03) also transfers well. Breaking a large deliverable into bounded work packages with explicit dependencies and contracts is useful whether you're splitting a codebase into modules or a research paper into sections.

## What probably works but needs real-world validation

**Review criteria.** This is the most sensitive transfer point. In the coding pack, Stage 05 is extremely concrete: does it compile, does it pass tests, does it respect the interfaces. For a legal domain, the criteria would be entirely different — internal consistency, correct citations, regulatory compliance. The templates have `[DOMAIN: verification method]` markers for exactly this reason, but the quality of the compiled review stage depends heavily on how precisely you describe your domain's quality standards. Vague domain description → vague reviews → weak Stage 05.

**Contract ID semantics.** In software, `IF-xx` for interfaces and `TYPE-xx` for shared types are natural and precise. The Compiler maps these to domain equivalents, but the question is whether your domain has formal boundary contracts at all. Law does (statutes, cross-references, precedent citations). Engineering does (standards, load paths, interface specifications). A book manuscript? The "interfaces" are soft — tonal consistency, character continuity, plot threads. The pipeline can track them, but the LLM's ability to enforce them is weaker when the contracts aren't binary pass/fail.

**Delivery Report structure.** "Files created, files modified, boundary verification status" is very software-native. For an engineering report, "calculations performed, standards referenced, assumptions documented" would be more natural. The Compiler translates the structure, but the template gives it a marker, not guidance on *how different* the structure needs to be.

## What we genuinely don't know yet

Whether LLMs follow the compiled prompts as strictly in unfamiliar domains. In the coding pack, the models know the vocabulary — "interface", "module", "test" are high-frequency training terms. For "structural steel connection design per Eurocode 3" or "contract law analysis under German BGB", the model will understand the pipeline structure but may execute domain-specific checks less rigorously because it has less training material to draw on.

Our honest estimate without testing: structured professional domains (law, engineering, research, technical writing) — 70–80% transfer. Creative domains (novels, screenplays, game design) — closer to 50%, because the "contracts" are inherently softer and harder to verify mechanically.

## What we're looking for

We want people to break this. Specifically:

**If you work in a non-coding domain** — law, medicine, engineering, research, education, publishing, policy, or anything else — try compiling a domain pack and running a small project (2–3 packages) through the full pipeline. The Prompt Compiler and domain-agnostic templates are in the repo. The [Domain Pack Guide](docs/DOMAIN_PACK_GUIDE.md) walks through the process.

**What we want to hear:**
- Did the Compiler produce usable prompts for your domain, or did it miss critical domain concepts?
- Did Stage 05 (Review) catch real quality issues, or did it rubber-stamp because the review criteria were too vague?
- Did the contract/interface model make sense in your field, or did it feel forced?
- Where did the pipeline add genuine value, and where did it just add overhead?
- What would you change about the stage structure for your domain?

**If you work in a "soft" domain** — creative writing, game design, UX research, narrative design — we're especially curious. The pipeline assumes deliverables have verifiable contracts and binary pass/fail boundaries. Your work often doesn't. Does the structure help anyway by imposing discipline? Or does it fight the nature of your work? Both answers are useful.

**How to contribute feedback:**
- Open an issue on the repo with the tag `domain-transfer`
- Include your domain, what worked, what didn't, and ideally the compiled prompts you used
- If you produced a working domain pack, consider contributing it back — see [CONTRIBUTING.md](docs/CONTRIBUTING.md)

The framework is only as good as the evidence behind it. Right now, the evidence is strong for software and plausible for structured professional work. For everything else, we need your help finding out.
