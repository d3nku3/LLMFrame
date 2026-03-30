# Quickstart Guide

Get your first pipeline project running in ~15 minutes.

## Choose your path

Not everyone starts the same way. Find yours, follow the links, skip what doesn't apply.

### "I want to build a software project with this."

You're in the right place. Continue to [Step 1](#step-1-open-the-console) below. The walkthrough uses the Coding domain pack and gets you through a full pipeline cycle. Budget ~1 hour for a meaningful first run with 2–3 packages.

### "I want to try this for a non-coding domain."

Start here, then branch:
1. Skim [Step 1](#step-1-open-the-console) through [Step 3](#step-3-import-the-prompts) below to understand the Console basics (10 min)
2. Read the [Domain Pack Guide](docs/DOMAIN_PACK_GUIDE.md) to understand how prompts are compiled for your field
3. Read [Domain Transfer](docs/DOMAIN_TRANSFER.md) for an honest assessment of what transfers cleanly and what needs testing
4. Use the [Prompt Compiler](Pipeline_Prompt_Compiler_v2.txt) to generate your domain-specific prompts
5. Run a 2–3 package pilot. Pay special attention to Stage 05 — that's where domain-specific review criteria matter most

After one hour you should have: a workspace folder with saved artifacts, a manifest tracking your pilot, and a concrete opinion on whether the review stage works for your domain.

### "I'm evaluating this for compliance, governance, or audit."

You don't need to run the pipeline to evaluate it:
1. Read [Auditability & Traceability](docs/LLMFrame_Auditability_Traceability.md) for the one-page compliance summary (fingerprinting, lineage, review binding, structural safeguards against rubber-stamping)
2. Read [Architecture](docs/ARCHITECTURE.md#failure-vocabulary) for the failure vocabulary and enforcement model
3. Read [Protocol Reference](docs/PROTOCOL_REFERENCE.md) for the complete protocol field documentation
4. Optionally, run the walkthrough below and inspect the generated `audit_log.ndjson` and `artifact_manifest.json` in your workspace folder

### "I just want to understand what this is before I invest time."

Read these three, in order:
1. [README](README.md) — what it is, what it sells, who it's for (5 min)
2. [FAQ](docs/FAQ.md) — common questions, honest answers (5 min)
3. Come back here when you're ready to try it

---

## Prerequisites

- A **Chromium-based browser** (Chrome, Edge, Brave, Arc)
- Access to at least one LLM (ChatGPT, Claude, Gemini, or any local model that accepts text prompts)

That's it. No install, no server, no terminal, no accounts.

## Step 1: Open the Console

Double-click `console.html`. It opens in your browser.

## Step 2: Select a Workspace

Click **Select Workspace Folder** and choose (or create) an empty folder on your machine. This is where all your project data will live — artifacts, audit logs, manifests. You own this folder completely.

Your browser will ask for permission to read/write to this folder. Grant it.

## Step 3: Import the Prompts

Click **Import Prompts** and select all six prompt files:

| File | Role |
|---|---|
| `01_Requirements_Engineer_v5.txt` | Interviews you, produces the Master Briefing |
| `02_Technical_Architect_v5.txt` | Produces the Architecture Spec with frozen contracts |
| `03_Project_Orchestrator_v5.txt` | Decomposes into work packages, routes to models |
| `04_Module_Implementer_v5.txt` | Implements one work package at a time |
| `05_Code_Reviewer_v5.txt` | Reviews against frozen contracts |
| `06_Merge_Coordinator_v5.txt` | Merges accepted packages, verifies consistency |

The Console will confirm the import and show the prompts in the sidebar.

> **Using the pipeline for non-coding work?** Import the six domain-agnostic templates instead (the `_Agnostic.txt` files). These contain `[DOMAIN:]` markers that work for any field — technical reports, legal documents, book manuscripts. Use the **Pipeline Prompt Compiler** to fill in the markers for your domain, then validate the result with the **Pipeline Prompt Validator** before importing.

## Step 4: Run Stage 01 — Requirements

1. Copy the **Requirements Engineer** prompt from the Console
2. Paste it into a **new LLM conversation** (any model)
3. The model will greet you and begin an interview about your project
4. Answer its questions honestly — this is the foundation for everything
5. When it produces the **Master Briefing**, copy the full output
6. Paste it into the Console's Stage 01 input and save

The Console validates the content and assigns it an artifact ID, revision number, and content fingerprint.

## Step 5: Run Stage 02 — Architecture

1. Copy the **Technical Architect** prompt
2. Open a **new LLM conversation** (can be a different model)
3. Paste the prompt, then paste your Master Briefing from Stage 01
4. The Architect produces an **Architecture Spec** with components, interfaces, invariants, and a dependency map
5. When it says **Progression Status: CLOSED**, copy the output into the Console's Stage 02 input

The architecture is now frozen. No silent changes from this point forward.

## Step 6: Run Stage 03 — Orchestration

1. Copy the **Project Orchestrator** prompt → new conversation
2. Provide the Master Briefing and Architecture Spec
3. The Orchestrator decomposes the project into numbered work packages (T01, T02, …) with explicit contracts
4. Save the **Master Orchestration File** and individual **Work Package Files** into the Console

You now have a clear plan: which packages exist, what each one must do, and which model should handle it.

## Step 7: Implement, Review, Merge

For each work package:

1. **Stage 04 — Implement:** Copy the Module Implementer prompt → new conversation → provide the Work Package File and Architecture Spec → save the deliverable + Delivery Report
2. **Stage 05 — Review:** Copy the Code Reviewer prompt → new conversation → provide the deliverable, Delivery Report, and contracts → the reviewer produces ACCEPT or REWORK
3. **Stage 06 — Merge:** Once a package is accepted, the Merge Coordinator integrates it with previously merged packages

The Console enforces the correct order, binds reviews to specific implementation versions via fingerprints, and tracks everything in the audit log.

You don't have to finish one package before starting the next. After copying a request to an LLM, switch to another package while you wait — use **Open package list** to move between them. Each package keeps its own state independently.

## Key Rules

- **One new conversation per stage.** Never continue a previous chat — fresh context prevents drift.
- **Human in the loop.** You read every output before it moves forward. Nothing is automatic.
- **Rework goes backward.** If the reviewer says REWORK, you go back to Stage 04 (or further upstream if the problem is in the spec). The Console tracks rework cycles.
- **The Console is the authority.** It manages artifact versions, fingerprints, and stage transitions. Trust it over your notes.

## What's Next

- Read the [Console Guide](docs/CONSOLE_GUIDE.md) for all Console features — stage enforcement, review binding, consequence previews, package switching, craft review mode.
- Read the [Operating Guide](docs/07_End_User_Operating_Guide.md) for the full pipeline rules, evidence classes, and go/no-go criteria.
- Read the [Operator Run Layer](docs/08_Operator_Run_Layer.md) for decision support during execution (when to rework, when to escalate, when to proceed).
- Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the three-layer system design and which rules are enforced vs. guidance.
- Explore the **Lineage Graph** in the Console to see your project's dependency map evolve in real time.
- Run the **Pipeline Prompt Validator** against your prompts to catch structural issues before they surface mid-project.
- **Domain packs:** Place compiled prompts in `workspace/prompts/<pack-name>/` and the Console will auto-detect them in the workspace indicator dropdown.
- **Large projects (10+ packages):** The pipeline supports clustered merge — splitting Stage 06 into iterative merge rounds. See `DESIGN_Clustered_Merge.md`.

## Tips for Your First Project

- **Start small.** A 3-package project is ideal for learning the flow. Don't start with 15 packages.
- **Use Claude or GPT-4 for architecture and review.** These stages need strong analytical reasoning. Implementation can go to faster/cheaper models.
- **Read the Delivery Reports.** They're not noise — they tell you exactly what the implementer did and didn't do.
- **Don't skip the review.** It feels slow. It catches real problems. That's the trade-off.
