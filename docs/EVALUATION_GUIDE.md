# First Evaluation Guide

A structured path for your first LLMFrame pilot. Fill in the blanks, follow the steps, form your own opinion.

---

## Before you start: scope your pilot

Answer these five questions for yourself. You don't need to share them — they calibrate what "good enough" looks like for your specific run.

1. **What are you building?** (e.g., "CLI tool", "REST API", "data pipeline", "library with public interface")
2. **How many modules or components do you expect?** Aim for 2–5. Fewer than 2 won't exercise the interface contracts. More than 5 is too much for a first run.
3. **What language?** The pipeline is language-agnostic, but your model needs to be competent in it.
4. **Is there at least one boundary between components?** An API call, a shared config, a function interface, a file format contract — something where two pieces need to agree. This is where the pipeline earns its keep. If your pilot has no boundaries, pick a different pilot.
5. **Which models will you use?** One model works. Two is better — use a stronger model (Claude, GPT-4) for Stages 01–03 and 05, and a faster model for Stage 04. If you only have one model, note whether reviews feel substantive — a model reviewing its own output tends to be generous.

---

## Docs to read first

In this order. Budget 20 minutes total.

1. [QUICKSTART.md](QUICKSTART.md) — follow the "I want to build a software project" path. Gets you from zero to a running Console in 10 minutes.
2. [Console Guide](docs/CONSOLE_GUIDE.md) — read the workflow loop (Build → Copy → Save) and the package switching section. Skip domain pack and craft review sections.
3. [Operating Guide](docs/07_End_User_Operating_Guide.md) — Section 7 (how to run packages) and Section 8 (how to handle failed reviews). You will need Section 8. First runs almost always produce at least one REWORK.

Don't read the Architecture doc, Protocol Reference, or Auditability doc before your first run. Those are for after you've formed your own opinion.

---

## What "good enough" looks like

After one full cycle (all 6 stages, all packages through implementation and review, one merge), check these:

**Stage 01 — Master Briefing:** Would a colleague who's never seen this project understand what to build from reading it? If it reads like vague fluff, the Stage 01 interview went too fast. Re-run it and answer with more specifics.

**Stage 02 — Architecture Spec:** Does it name the components you actually want? Does it define the interfaces between them with contract IDs (IF-xx, TYPE-xx)? Does it include error handling expectations? If it invented scope you didn't ask for — a plugin system, an abstraction layer, a database you don't need — push back before freezing. Clear Stage 02 and re-run with a firmer constraint.

**Stage 03 — Work Packages:** You should get roughly as many packages as you have components. Each package should reference the interface contracts it depends on and the ones it exposes. If the packages don't reference each other's contracts, the decomposition is too loose and Stage 05 won't have anything meaningful to check.

**Stage 05 — Review:** This is the real test. A good review catches at least one real issue: a missing error path, an interface mismatch, a contract the implementation ignores, an edge case the Delivery Report doesn't mention. If the review says "looks good, ACCEPT" with zero findings, it rubber-stamped. That's usually a model quality issue on the review side, not a pipeline problem.

**Workspace folder:** After the run, your workspace should contain saved artifacts for all stages, an `artifact_manifest.json` that traces every artifact's lineage via fingerprints, and an `audit_log.ndjson` recording every operator action in sequence. If you have that, the evaluation succeeded mechanically.

Whether the output quality justified the workflow overhead is your judgment call. That's the question the pilot is designed to answer.

---

## Failure modes to watch for

**Reviews are too generous.** If the same model runs Stage 04 and Stage 05, it tends to approve its own work. Every review comes back ACCEPT, zero findings. Try a different model for Stage 05, or at minimum note whether the findings feel substantive.

**Architecture is over-engineered.** The Architect stage optimizes for robustness and extensibility. For a small pilot, this can produce specs that are twice the complexity you need. If "Progression Status: CLOSED" but the spec describes a system you wouldn't actually build, that's the signal to re-run Stage 02 with a note like "this is a 3-module utility, keep the architecture minimal."

**Too many packages.** If you expected 3 components and got 7 packages, the Orchestrator over-decomposed. Re-run Stage 03 with an operator note: "this is a small project, keep packages coarse." This is recoverable without restarting earlier stages.

**Fingerprint mismatch.** If you edit a file outside the Console and then try to review it, the Console will reject the review binding. This is working as intended. Save through the Console, not around it.

**PAUSE instead of CLOSED.** Stage 03 may return a PAUSE artifact instead of work packages. This means it found unresolved decisions that need upstream clarification. Follow the Console's guidance — answer the questionnaire, route the answers to the indicated stage, then resume. This is the pipeline working correctly, not a failure.

---

## What would not count as a fair evaluation

**Running without the Console.** The prompts alone are half the system. The Console enforces contracts, tracks lineage, binds reviews to specific implementation versions, and prevents silent drift. Evaluating just the prompts in a chat window is evaluating a different product.

**Skipping Stage 05.** The review is where the pipeline either catches real problems or exposes that it doesn't. Without it, you're testing whether LLMs can generate code from specs, which you already know.

**A project with no interface boundaries.** If your pilot is a single-file script with no internal contracts, the pipeline has nothing to enforce. Pick a pilot where at least two components need to agree on an interface.

**Blaming the pipeline for model limitations.** If your model can't produce the Stage 03 output format (package contracts, dependency declarations, delivery report structure), try one run with Claude or GPT-4 for the structural stages (01–03, 05) and your model for implementation (04) only. That isolates whether the problem is the pipeline or the model.

---

## After your run

You now have an opinion. We'd like to hear it — especially if the conclusion is "not worth it for this size." Open an issue on the repo, or just keep your notes. Either way, the workspace folder is yours and tells the full story.
