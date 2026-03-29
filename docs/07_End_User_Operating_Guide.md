# LLMFrame Operating Guide

**For Normal Users**
Version 5

---

## 1. What this system is for

This system helps you run a larger project through several specialized AI roles instead of asking one model to do everything at once.

Instead of saying "Please build the whole project", you split the work into stages:

1. Requirements Engineer
2. Technical Architect
3. Project Orchestrator
4. Module Implementer
5. Code Reviewer
6. Merge Coordinator

Each role has a different job. That makes the output more structured, easier to check, and safer to integrate.

This workflow is especially useful when the project has multiple files, interfaces matter, wrong assumptions would be expensive, you want cleaner reviews, or one-shot generation tends to fail.

**Operator note:** You do not need to be a programmer to run this pipeline. The Console handles artifact organization, versioning, and persistence automatically. Your job is to provide good inputs, evaluate outputs honestly, and route failures to the correct upstream stage.

---

## 1b. How 07, 08, and the Console work together

This file (07) explains the pipeline rules. Use it to understand the six roles, the correct stage order, go/no-go rules, contract closure gate behavior, evidence classes, rework routing, and troubleshooting.

The separate file [08 — Operator Run Layer](08_Operator_Run_Layer.md) is the operator decision companion. Use it during actual execution when you need help deciding whether output is good enough to proceed, whether a failure is local or upstream, whether to escalate, and whether a review result allows merge or requires rework.

The Operator Console (`hardened_console.html` plus its `js/` modules) handles the operational mechanics. It is the authoritative operational state manager. It requires a project workspace folder and a separate prompt folder, saves artifacts automatically, maintains the manifest, writes workspace state and audit trail, tracks artifact status, enforces stage progression through the state machine, reconnects after browser reload, supports multiple workspaces in parallel across browser tabs, offers per-workspace accent colors, shows post-action impact summaries, shows consequence previews before destructive actions, and shows a resume summary on workspace reconnect.

**Simple split:**
- Use **07** to understand the rules.
- Use **08** to make execution decisions the Console cannot automate.
- Use the **Console** to run the workflow, persist artifacts, and move through the allowed steps.

The Console is not a new stage and not a new role. It is the authoritative operational state manager for the same six-stage pipeline. 07 defines the rules the Console implements. 08 helps the operator make judgment decisions the Console cannot automate.

If you are ever unsure which document or tool to rely on: open 07 when you need the big picture or need to know whether a transition is allowed; open 08 when you need help deciding whether an output is acceptable, whether to escalate, or where a failure should be routed; trust the Console for saving, tracking, file management, manifest maintenance, state resume, and stage progression.

**Console pre-flight:** Complete workspace folder selection, prompt folder selection, and LLM Availability setup before preparing the first Stage 01 request. This does not create a new pipeline stage — it creates the Available LLMs input that Stage 03 can consume for model routing.

---

## 2. The six roles in simple terms

### 1. Requirements Engineer

**What it does:** Turns your rough idea into a formal project brief.

**What you give it:** Your rough project description, goals, constraints, existing context.

**What you get back:** A Master Briefing.

**Why it matters:** Makes sure the project is clearly defined before technical design starts. Think of it as: "Make sure we are solving the right problem."

**Practical limit:** If the briefing defers more than 3 contract-critical decisions to the Technical Architect, the briefing is likely too weak. Go back and clarify before proceeding.

### 2. Technical Architect

**What it does:** Turns the Master Briefing into a technical blueprint.

**What you give it:** The Master Briefing, any relevant existing code context.

**What you get back:** An Architecture Spec.

**Why it matters:** Defines modules, interfaces, shared data structures, dependencies, and rules. Think of it as: "Decide how the system must be shaped so different parts can fit together."

### 3. Project Orchestrator

**What it does:** Breaks the project into work packages and decides which model should do which package.

**What you give it:** The Master Briefing, the Architecture Spec.

**What you get back:**
- If the Architecture Spec is CLOSED: one Master Orchestration File, one separate Work Package File per implementation work package, optional Execution Checklist.
- If the Architecture Spec is PAUSE_FOR_DECISIONS: one pause artifact containing Gate Result, Blocking Contract-Critical Decisions, Minimal Decision Questionnaire, and Resume Instruction.

**Why it matters:** Turns architecture into an actual execution plan and emits the authoritative Stage 03 artifacts used downstream. Think of it as: "Turn the blueprint into a build schedule and hand over the build packets."

### 4. Module Implementer

**What it does:** Performs exactly one work package.

**What you give it:** One full Work Package File, the Architecture Spec, relevant files/code/outputs from earlier packages.

**What you get back:** The actual code or artifact for that package, plus a delivery report.

**Why it matters:** This is the execution stage, but under strict boundaries. The implementer prompt lives inside the Work Package File, but the full Work Package File is the authoritative package artifact. Think of it as: "Build only this one assigned piece, and touch nothing else."

### 5. Code Reviewer

**What it does:** Checks whether one package result is actually correct and compliant.

**What you give it:** Master Briefing, Architecture Spec, the full Work Package File, code/artifacts from the Module Implementer, optional test or validator output.

**What you get back:** A Review Report with pass/fail judgment, exact findings, repair notes, and merge notes.

**Why it matters:** A result can look fine and still be wrong for the pipeline. This stage catches that. The reviewer should use the full Work Package File, not only an extracted prompt body. Think of it as: "Check whether this piece really matches the plan."

**Craft review (optional):** For domains with subjective quality dimensions (creative writing, game narrative), the pipeline supports an additional non-gating craft review pass focused on tone, pacing, and style. This requires `review_mode: "structural+craft"` in the protocol. See the [Console Guide](CONSOLE_GUIDE.md) for details.

### 6. Merge Coordinator

**What it does:** Integrates reviewed pieces into a larger whole.

**What you give it:** Architecture Spec, Review Reports, modules/artifacts to integrate, optional work package contracts.

**What you get back:** Integration Report, changed files, integration manifest, conflict report, boundary validation, remaining boundary checks, or a blocked merge result.

**Why it matters:** Checks whether individually good pieces also work together. Think of it as: "Now make the approved parts fit together safely."

---

## 3. The correct order

Use the stages in this order: Requirements Engineer → Technical Architect → Project Orchestrator → Module Implementer → Code Reviewer → Merge Coordinator.

You do not usually run the Implementer once for the whole project. You run it once per work package. The real middle of the workflow often looks like this:

```
Requirements Engineer
→ Technical Architect
→ Project Orchestrator
→ Implement Package 1 → Review Package 1
→ Implement Package 2 → Review Package 2
→ Implement Package 3 → Review Package 3
→ Merge Coordinator
```

This diagram shows the logical order, not a strict sequence. You don't have to finish Package 1's review before starting Package 2's implementation. The Console tracks each package independently — you can start an implementation, copy the request to an LLM, switch to another package while waiting, then switch back to save the result. Use the package chooser to move between them. What matters is that each individual package completes implementation → review before entering merge.

If a review fails, you do not continue to merge. You repair first.

---

## 3b. Go / no-go checklists between stages

### Requirements Engineer → Technical Architect

**GO only if:** You have the latest authoritative Master Briefing with a clear project summary, scope and definition of done are present, open questions are listed, readiness/complexity/safety sections are present, and stable requirement IDs appear where expected.

**NO-GO if:** The briefing is obviously incomplete, major decisions are still missing but not listed as open, or the output is older than a later corrected version.

### Technical Architect → Project Orchestrator

**GO only if:** You have the latest authoritative Architecture Spec, the readiness status allows orchestration, the spec ends with `Progression Status: CLOSED`, modules/interfaces/shared types/artifact rules are defined clearly enough to split work, architecture contract IDs appear where expected, and traceability to briefing IDs exists.

**NO-GO if:** The architect says the spec is not safe to freeze, the spec ends with `Progression Status: PAUSE_FOR_DECISIONS`, major public contracts are missing, interface-sensitive areas are still vague, or you are about to orchestrate from an older spec revision.

### Module Implementer → Code Reviewer

**GO only if:** You have the latest authoritative Work Package File, the Implementer stayed within the allowed file boundaries, changed/created/untouched files are clearly declared, requirement IDs and contract IDs are carried forward, the validation section is not empty, and boundary verification status is stated.

**NO-GO if:** The delivery report is missing, changed files are unclear, the Implementer invented new contracts, or required validation/boundary-check reporting is missing.

### Code Reviewer → Merge Coordinator

**GO only if:** The review verdict is acceptable for merge, all merge-blocking findings are resolved, required review reports exist for modules being merged, interface-sensitive or safety-relevant items have review coverage, no unresolved spec gap is blocking integration, and the review is based on the latest implementation and latest Architecture Spec.

**NO-GO if:** Required reviews are missing, merge-blocking findings remain open, the reviewer says the package is not safe for merge, or the implementation/review was produced against an outdated Architecture Spec.

Use 07 to decide whether the handoff is GO or NO-GO. Use 08 if the gate is unclear in practice and you need help judging whether the output is good enough to proceed or should be routed back.

---

## 4. What to copy into each role

This section tells you what to paste into each role. When you are actively running a step and need help deciding whether the current output is good enough, whether a failure is local or upstream, or whether to escalate — open 08 alongside this section. Use 07 for the rule, 08 for the judgment call, the Console for the operational mechanics.

### Stage 1 — Requirements Engineer

**Paste:** Your rough project idea, what you want built, what matters most, any known restrictions, whether there is existing code, any deadline/quality/format expectations.

**Good example:** "I need a Python tool that reads STL files, converts them into a simplified grid representation, and exports build instructions as PDF. It must work on Windows, avoid very heavy dependencies, and preserve deterministic output for the same input."

Do not worry if your description is incomplete — this stage is supposed to ask follow-up questions.

**Expected output:** Master Briefing. The Console saves the artifact automatically.

### Stage 2 — Technical Architect

**Paste:** The full Master Briefing, any existing code context if relevant.

**Expected output:** Architecture Spec. The Console saves the artifact automatically.

**How to read Architecture Readiness:**
- "Ready for Orchestration" → proceed normally.
- "Partially Ready - Restricted Areas" → proceed only for unaffected packages.
- "Not Safe to Freeze" → stop and go back upstream.

**How to read the Contract Closure Gate:**
- `Progression Status: CLOSED` → run the Project Orchestrator normally.
- `Progression Status: PAUSE_FOR_DECISIONS` → do not run the Project Orchestrator for package generation yet. Preserve the full artifact and answer only the Minimal Decision Questionnaire.

### Stage 3 — Project Orchestrator

**Paste:** The full Master Briefing, the full Architecture Spec, Available LLMs if using operator model selection.

**Expected output (CLOSED):** Master Orchestration File, one separate Work Package File per implementation work package, optional Execution Checklist.

**Expected output (PAUSE_FOR_DECISIONS):** One PAUSE artifact containing Gate Result, Blocking Contract-Critical Decisions, Minimal Decision Questionnaire, Resume Instruction. No Work Package Files yet.

The Console saves each Stage 03 artifact separately. The Work Package File is the main per-package downstream artifact. The implementer prompt is a component inside it, but the full Work Package File is what downstream stages should use.

### Stage 4 — Module Implementer

**Paste:** One full Work Package File, the Architecture Spec, the exact files that package is allowed to work on, any prior outputs this package depends on. Do not paste the entire project unless the package really needs it.

**Expected output:** Implementation result and delivery report. The Console saves each package result automatically. If the output contains actual files, use the Console's file import feature.

### Stage 5 — Code Reviewer

**Paste:** Master Briefing, Architecture Spec, the full Work Package File, the package output from the Implementer, optional test results.

**Expected output:** Review Report with verdict and one exact final routing block: `FINAL_DISPOSITION: ACCEPT` or `FINAL_DISPOSITION: REWORK`.

Use the full Work Package File for review, not only an extracted implementer prompt body.

### Stage 6 — Merge Coordinator

**Paste:** Architecture Spec, Review Reports for the modules to be merged, the reviewed module outputs. Only exact output/review pairs where the review ends with `FINAL_DISPOSITION: ACCEPT`. Optional work package contracts.

**Expected output:** Integration Report, changed files, integration manifest, conflict report, Compatibility Scan Summary, boundary validation performed, remaining boundary checks, or blocked merge result.

**Optional final review:** After merge, you may run the final review prompt produced by the Project Orchestrator for one additional whole-system quality pass. This is not a replacement for package-level reviews.

---

## 5. What output to expect from each stage

- **Requirements Engineer:** Master Briefing
- **Technical Architect:** Architecture Spec
- **Project Orchestrator (CLOSED):** Master Orchestration File, one Work Package File per package, optional Execution Checklist
- **Project Orchestrator (PAUSE):** One pause artifact with Gate Result, Decisions, Questionnaire, Resume Instruction
- **Module Implementer:** Package implementation, delivery report
- **Code Reviewer:** Review report with findings, severity, verdict, final disposition (ACCEPT/REWORK)
- **Merge Coordinator:** Integration report, changed files, integration manifest, conflict report, Compatibility Scan Summary, boundary validation, remaining boundary checks

If a stage gives you much less than this, something probably went wrong. If the output is present but you do not know whether it is good enough to proceed, open 08.

---

## 6. When to stop and go back

**Go back to Requirements Engineer when:** The project goal is still unclear, important constraints were never defined, success criteria are vague, a user or business decision is missing, or the Technical Architect says the briefing is too weak.

**Go back to Technical Architect when:** A package cannot be implemented without inventing a new interface, two modules need a shared type that was never defined, the merge step would require changing contracts, the reviewer finds architecture-level ambiguity, the orchestrator says the spec is incomplete, or the Architecture Spec ends with PAUSE_FOR_DECISIONS.

**Go back to Project Orchestrator when:** The package boundaries were wrong, too much was packed into one task, a package needs a different sequence, or downstream roles keep failing because the work package contract is weak.

**Go back to Module Implementer when:** The reviewer found implementation mistakes, the package output is incomplete, wrong files were modified, or required artifacts are missing.

Do not go straight to merge when review has failed. Do not ask the merger to "just fix it" if the package is wrong.

---

## 6b. Rework routing decision map

| Problem Type | What it Usually Means | Where to Send It | Typical Action |
|---|---|---|---|
| Implementation bug | The package contract was clear, but the code is wrong | Module Implementer | Repair the same package and review again |
| Bad package contract | The Work Package File omitted needed boundaries or checks | Project Orchestrator | Regenerate only the affected Work Package File |
| Spec gap | The Architecture Spec is missing a shared type, interface rule, or binding contract | Technical Architect | Revise the spec, then re-orchestrate affected packages |
| Stale artifact usage | Someone used an old briefing, spec, or Work Package File | Correct upstream stage first | Replace stale inputs with newest versions and re-run |
| Changed frozen contract | A revised spec changed a public contract or locked decision | Technical Architect, then Orchestrator | Regenerate Stage 03 artifacts, re-run affected implementation and review |
| Missing product decision | Technical stages cannot continue because the user never chose an option | Requirements Engineer | Clarify the decision, then refresh downstream |

**Simple routing rule:** If the code is wrong → repair the same package. If the Work Package File is wrong → go to the Orchestrator. If the technical rules are missing → go to the Architect. If the project decision is missing → go to the Requirements Engineer.

---

## 7. How to run packages through the pipeline

This is the recommended workflow.

1. Run the Requirements Engineer. The Console persists the Master Briefing.
2. Run the Technical Architect. The Console persists the Architecture Spec.
3. Run the Project Orchestrator. If CLOSED, the Console records the Master Orchestration File and each Work Package File. If PAUSE, the Console records the full pause artifact — do not start implementation yet.
4. Pick one work package, usually starting with packages that have no dependencies or that define shared foundations.
5. Send the full Work Package File, the current Architecture Spec, and any dependency artifacts to the Module Implementer.
6. Send the result to the Code Reviewer.
7. If the review passes, move to the next package.
8. After all required packages are reviewed successfully, run the Merge Coordinator.

You don't have to wait for each package to complete before starting the next. After copying a request to an LLM, you can switch to another package and work on it while waiting. The Console tracks each package's state independently. The constraint is per-package: implementation before review, review before merge. The order between packages is flexible.

---

## 8. How to handle failed reviews

A failed review is normal. It does not mean the workflow failed — it means the quality gate worked.

When a review fails: read the verdict, read the findings from top to bottom, focus first on CRITICAL then MAJOR findings, ignore MINOR issues until blocking issues are fixed, then send the package back for repair.

**Typical repair cycle:** Implementer produces package → Reviewer fails package → Implementer repairs package → Reviewer reviews again.

If the reviewer says the problem is architectural, do not keep repairing locally — go back to the Technical Architect. If the reviewer says the package contract itself is weak, go back to the Project Orchestrator.

### How to use the Repair Prompt Template

The Master Orchestration File should contain Stage 03 repair/escalation guidance. If your saved Stage 03 artifacts include a ready-to-use Repair Prompt Template, fill it in directly:

- `{{PREVIOUS_OUTPUT}}`: Paste the full implementation output that failed review.
- `{{FAILED_CHECKS}}`: Copy findings with severity CRITICAL or MAJOR from the Review Report.
- `{{ISSUE_LIST}}`: List only the specific fixes needed from the reviewer's repair notes.

Use the same model that produced the original implementation. If the same model already failed twice on the same issue, use the Escalation Prompt Template or send to the escalation model listed in the work package.

The Console saves the repaired implementation as a new revision automatically. Send it to the Code Reviewer again. Do not send to Merge until the review passes.

---

## 9. Spec gap vs implementation bug

This distinction matters a lot.

**Implementation bug:** The plan was clear enough, but the implementation did it wrong. Examples: wrong function signature, required file missing, wrong error handling, forbidden file modified, test failed because the logic is wrong. Send it back to the Module Implementer.

**Spec gap:** The plan itself is missing something important, so the Implementer or Merger would have to invent rules. Examples: shared type not defined, interface not fully specified, output schema unclear, two modules need a dependency rule the spec never stated. Send it back to the Technical Architect, or sometimes back to the Requirements Engineer if it is a product decision.

**Simple rule:** If the code is wrong, fix the implementation. If the rules are missing, fix the spec.

---

## 10. How to keep filenames and artifacts organized

The Console creates and maintains the workspace folder structure automatically: `_console/` for manifest, state, and audit log; `stage01/` through `stage06/` for artifacts per stage; `references/` for imported reference files; `archive/` for superseded and stale artifacts.

Artifact filenames are generated deterministically (e.g., `01_Master_Briefing__artifact_000001__r001.txt`). If actual code or implementation files are produced, import them through the Console so they are tracked in the artifact chain.

### How the artifact manifest works

The Console maintains the manifest automatically. Every save updates it with artifact ID, type, revision, status, content hash, and provenance chain. The manifest file (`_console/artifact_manifest.json`) is written on every save. Manual ledger maintenance is no longer required.

The Console tracks CURRENT, SUPERSEDED, STALE, and MISSING_ON_DISK status automatically and validates workspace integrity on reload.

---

## 11. Merge readiness warnings

Do NOT send artifacts to Merge if: required reviews are missing for interface-sensitive items, required reviews are missing for safety-relevant items, review findings still contain unresolved merge-blocking issues, the latest Architecture Spec invalidated earlier implementation or review artifacts, the modules were reviewed against an older package contract, or a spec gap is still open in an area the merge depends on.

**Clean merge rule:** A clean merge should not depend on "we will probably test that later" if an important boundary check was realistically possible now.

---

## 12. Worked example

**Project idea:** "I want a Python tool that reads a CSV file of products, validates the rows, and exports a cleaned JSON file plus a short summary report."

**Stage 1 — Requirements Engineer:** You paste your rough idea. The Requirements Engineer asks questions (what counts as invalid? what JSON structure? preserve row order? performance limits? Python version?). Output: Master Briefing.

**Stage 2 — Technical Architect:** You paste the Master Briefing. Output: Architecture Spec with modules (csv_loader.py, validator.py, json_exporter.py, summary_report.py, main.py), shared types, interface signatures, artifact rules, error behavior, dependency map.

**Stage 3 — Project Orchestrator:** You paste Master Briefing + Architecture Spec. If CLOSED, the Orchestrator creates: Master Orchestration File, Work Package Files (T1: shared models, T2: CSV loader, T3: row validator, T4: JSON exporter, T5: summary report, T6: main CLI wiring), optional Execution Checklist.

**Stage 4 — Module Implementer:** Start with T1. Paste T1 Work Package File + Architecture Spec. Output: code for shared models + delivery report. Then do the same for T2, T3, T4, and so on.

**Stage 5 — Code Reviewer:** Send T1 to the Reviewer. If PASS/ACCEPT, move on. If T2 fails because it changed a forbidden file → implementation bug → send T2 back for repair. If T4 fails because the JSON schema was never defined → spec gap → go back to Technical Architect, update the spec, then re-run the affected package.

**Stage 6 — Merge Coordinator:** After all packages pass review, send Architecture Spec + Review Reports + reviewed outputs. Possible results: CLEAN MERGE, MERGED WITH FIXES, or BLOCKED — REQUIRES REWORK.

---

## 13. Simple troubleshooting

**The Architect says the briefing is too weak:** Go back to Requirements Engineer and clarify missing constraints.

**The Implementer says it must invent a new interface:** Go back to Technical Architect.

**The Reviewer says the package is technically correct but violates the work package contract:** Go back to the Module Implementer or, if the package contract was bad, back to the Project Orchestrator.

**The Merger says integration would require changing a frozen contract:** Go back to Technical Architect.

**You are overwhelmed by too many packages:** Ask the Project Orchestrator to reduce over-splitting and produce fewer, larger packages.

**You understand the pipeline in principle, but are not sure whether the current output is good enough to proceed:** Open [08 — Operator Run Layer](08_Operator_Run_Layer.md).

**A workspace reload shows missing files or inconsistent state:** The Console automatically reconnects on reload. If files are missing on disk, the Console marks affected artifacts as `missing_on_disk`. Do not continue until you understand which artifacts are still authoritative.

**The Console shows the wrong workspace after a browser reload:** Each tab remembers its own workspace. Use Switch Project to select the correct folder.

**Everything keeps failing because outputs are inconsistent:** Check whether you are always using the latest correct Master Briefing, Architecture Spec, full Work Package File, and review result. Pipeline mistakes are often caused by stale artifacts, not by model failure.

---

## 14. Best practices

- Focus on one package at a time, but don't wait idle — use the package chooser to switch between packages while LLM responses are in flight.
- Do not skip review. Do not ask merge to rescue bad packages.
- Do not let implementers invent architecture. Do not let reviewers redesign architecture.
- Keep 07 and 08 both available during real execution.
- Let the Console handle all file management. Focus on content quality and routing decisions.
- If the Console blocks a transition, understand why before working around it.
- When in doubt, go back upstream instead of forcing a local fix.
- When running multiple projects in parallel, assign a different accent color to each workspace.
- Optionally, run a git watch script alongside the Console for automatic workspace versioning and undo capability.

---

## 15. Minimum safe workflow

If you want the shortest version that is still safe:

1. Run Requirements Engineer
2. Run Technical Architect
3. Run Project Orchestrator only if the Architecture Spec ends with CLOSED
4. Implement one package from its Work Package File
5. Review that package
6. Repeat for all packages
7. Merge only reviewed packages

During execution, use 08 whenever you need help deciding whether to proceed, repair, escalate, or reroute.

---

## 16. Running a second phase on an existing codebase

This applies when you already have a working codebase from a previous pipeline run and want to add features without breaking it.

**What carries forward:**
- **Master Briefing:** Usually needs a new or extended version. The old briefing remains as reference.
- **Architecture Spec:** Usually needs revision, not replacement. Use the Architect's Revision Mode. Existing interfaces are frozen unless the new briefing explicitly authorizes changes.
- **Stage 03 artifacts:** Must be regenerated for the new phase. Old ones are reference only.
- **Implementation, Review, and Merge:** Start fresh for the new phase, but keep the old workspace as reference.

**Critical rule:** The existing codebase is the "existing code context" input for the Technical Architect. Backward compatibility is the default. Breaking changes must be explicitly requested and justified.

**Phase handling:** Create a new workspace folder for Phase 2. The Console manages the new workspace automatically. Keep Phase 1 intact as a read-only reference.

**Simple rule of thumb:** Adding something new → new briefing, revised spec, new orchestration in a new workspace. Fixing something from Phase 1 → use the repair loop from Phase 1, do not start a new phase.

---

## 16b. Running multiple projects in parallel

The Console supports parallel pipelines.

**Using the same browser:** Open two Console tabs. Each tab remembers its own workspace. Select a different workspace folder in each tab. Assign a different accent color to each workspace. Do not open the same workspace folder in two tabs simultaneously — both would write to the same state file.

**Using different browsers:** Open the Console in two separate browsers (e.g., Chrome and Edge). Each browser has completely independent storage. This is the safest approach for full isolation.

To work on multiple packages within the same workspace, use the Switch Package button.

---

## 17. Final reminder

This system works best when each role stays in its lane.

- **Requirements Engineer:** Defines what the project needs.
- **Technical Architect:** Defines the technical rules.
- **Project Orchestrator:** Defines the execution plan.
- **Module Implementer:** Builds one package.
- **Code Reviewer:** Checks one package.
- **Merge Coordinator:** Assembles reviewed pieces safely.
- **07 (this file):** Explains how the pipeline works and defines the rules.
- **08 (Operator Run Layer):** Helps you make execution decisions in the moment.
- **Console:** Handles saving, tracking, state progression, manifest, audit trail, and workspace management.

If one role starts doing another role's job, the workflow becomes blurry and errors become harder to catch.
