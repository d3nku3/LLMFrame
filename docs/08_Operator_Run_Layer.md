# Operator Run Layer

**Decision Companion for Console-Assisted Execution**
Version 5

---

## 0. What this file is

This file is the decision companion for the six-stage pipeline. It exists to answer one operator question fast: *"What judgment call do I need to make right now?"*

**This file is:** a decision guide for ambiguous situations, a routing guide when something fails, a stop/go guide for gate decisions, and a quality judgment aid.

**This file is not:** a file management guide (the Console handles that), a save/naming guide (the Console handles that), a ledger/tracking guide (the Console handles that), a new stage, a new role, a replacement for the stage prompts or the [Operating Guide](07_End_User_Operating_Guide.md), a place to make new technical decisions, or a place to reinterpret contracts.

**Authority rule:** The Console is the authoritative operational state manager. It enforces stage progression and artifact tracking based on the rules defined in 07. This file helps the operator make judgment decisions the Console cannot automate. If the Console blocks a transition, check 07 for the rule and this file for guidance on resolving the situation.

---

## 1. Fatigue-resistant operating rules

When tired, do not improvise. Run every step through the same short loop:

1. **NOW** — the Console shows the current stage and action
2. **DECIDE** — evaluate whether the input quality is good enough to proceed
3. **ACT** — paste into the LLM, or click the Console action button
4. **EVALUATE** — when the result comes back, judge its quality before saving
5. **PREVIEW** — if the Console shows a consequence preview, read it before clicking Save
6. **SAVE** — click Save in the Console (it handles disk write, manifest, audit)
7. **CONFIRM** — read the post-action summary the Console shows after saving
8. **STOP** — if any stop condition is true, do not push forward

**One-active-card rule:** Only work from one stage card at a time. Do not keep multiple future steps mentally active unless the current step is already complete.

**No-guess rule:** If you are unsure whether the LLM output is correct, complete, or contract-aligned — stop, go back to the input, re-read the contract and required artifacts, verify before accepting. Do not turn uncertainty into assumed correctness.

**Version rule:** If the Console shows a conflict or warning about artifact freshness, stop and investigate before proceeding. The Console tracks versions automatically, but you must still judge whether a revision invalidates downstream work.

**Resume rule:** After a browser reload or reconnect, the Console shows a resume summary. Read it before continuing. Do not assume you remember the exact state from before the interruption.

---

## 2. Global defaults

**Default paste order:** (1) authoritative stage prompt, (2) full Work Package File if applicable, (3) required authoritative artifacts, (4) optional references only after that.

**Default downstream rule:** Use full authoritative artifacts, not extracted inner snippets, unless the authoritative artifact explicitly instructs otherwise.

**Default routing rule:** Implementation problem → Stage 04 rework. Unclear reviewability or contract clarity → route upstream. Package-boundary conflict at merge → Stage 05/06 evidence first, then upstream if contract-level. Unresolved contract-critical decisions → pause and route per resume instruction.

**Parallel work:** Use the Switch Package button to queue requests for multiple packages before collecting results. For multiple projects, use separate browser tabs with different workspace folders and distinct accent colors.

---

## 3. 10-second pre-flight

If any answer is NO, stop first.

- [ ] Do I know exactly which stage or package I am running?
- [ ] Do I know exactly what output should come back?
- [ ] Do I know the next step if this succeeds?
- [ ] Do I know the stop condition if this fails?
- [ ] Have I read the output carefully enough to judge its quality?
- [ ] If this is a review result, does the disposition match my own assessment?

---

## 4. Stage navigation at a glance

| Step | Action |
|---|---|
| 0.5 LLM Availability | Confirm operator-available models before Stage 01 |
| Stage 01 | Produce Master Briefing |
| Stage 02 | Produce Architecture Spec |
| Stage 03 | Produce Stage 03 execution artifacts or single PAUSE artifact |
| Stage 04 | Produce package implementation + Delivery Report |
| Stage 05 | Produce review result for one exact package version |
| Stage 06 | Produce full merge artifact set or blocked-state report |

**Most important transitions:** 02 → 03 only after closure/readiness is checked. 03 → 04 only with current Work Package File(s). 04 → 05 only with current implementation output including Delivery Report. 05 → 06 only with accepted package outputs and matching pass reviews. Any PAUSE/FAIL/BLOCKED → stop normal downstream progression.

---

## 5. Quick decision strip

| If you see this... | Do this... |
|---|---|
| `PAUSE_FOR_DECISIONS` | Save the full pause artifact and stop |
| `FAIL — REVISION REQUIRED` | Save the fail review and route to Stage 04 rework |
| `BLOCKED — REQUIRES REWORK` | Save the blocked result and route by blocker type |
| `PASS WITH NOTES` | Hold for merge only if no merge-blocking issue remains |
| Missing Delivery Report | Stop — do not send downstream as complete |
| Missing pass review for merged package | Stop merge immediately |
| Architecture Spec CLOSED but restricted | Run only allowed areas/packages |
| Missing `FINAL_DISPOSITION` block | Stop Stage 05 routing — review is not operationally complete |
| Output/review revision mismatch | Stop merge — exact output/review pair is required |
| Missing T1/T2 LLM baseline | Stop Stage 01 prep until LLM Availability is set |
| "Reconnect workspace" shown after reload | Click Reconnect to restore the previous workspace session |
| Consequence preview shows stale review | Proceed only if you intend to re-review after saving |
| Post-action summary shows "stale" | Check whether downstream work needs re-validation |

---

## 6. Stage cards

### Stage 01 — Requirements Engineer

**Status:** GO when the user source material is present.

**Now:** Turn raw idea/notes/Q&A into the authoritative Master Briefing.

**Needs:** Current Stage 01 prompt, user idea/notes/Q&A log. Optional: Operating Guide, this file.

**Expect:** Master Briefing with confirmed requirements, assumptions, open questions, risks, and blockers if applicable.

**Save:** Click Save in the Console.

**Next:** Run Stage 02 using the saved Master Briefing.

**Stop if:** Required information is missing, output is incomplete, or output was not saved.

**Never do:** Do not proceed to Stage 02 using chat history only. Do not treat a draft you have not checked carefully as the Master Briefing.

---

### Stage 02 — Technical Architect

**Status:** GO only after the Master Briefing is saved.

**Now:** Turn the Master Briefing into the authoritative Architecture Spec.

**Needs:** Current Stage 02 prompt, current Master Briefing.

**Expect:** Architecture Spec that freezes the externally visible technical contracts needed downstream.

**Save:** Click Save in the Console.

**Next:** Check closure and readiness before doing anything else.

**Stop if:** Contract-critical decisions remain open, closure gate says PAUSE_FOR_DECISIONS, output is incomplete, or spec was not saved.

**Hard stop:** PAUSE_FOR_DECISIONS pauses normal downstream progression. Do not proceed into package generation or Stage 04 implementation. If the pipeline requires a Stage 03 PAUSE artifact, run Stage 03 only to obtain that artifact, save it, resolve the decisions explicitly, then continue only after the gate is cleared.

**Never do:** Do not treat "almost closed" as closed. Do not ignore restricted-area notes.

---

### Stage 03 — Project Orchestrator

**Status:** GO only after Stage 02 closure/readiness has been checked.

**Now:** Turn the Master Briefing and Architecture Spec into operator-usable Stage 03 execution artifacts.

**Needs:** Current Stage 03 prompt, current Master Briefing, current Architecture Spec, Available LLMs if using operator model selection.

**Expect (CLOSED):** Master Orchestration File, one separate Work Package File per package, optional Execution Checklist.

**Expect (PAUSE_FOR_DECISIONS):** Only one PAUSE artifact containing Gate Result, Blocking Contract-Critical Decisions, Minimal Decision Questionnaire, Resume Instruction.

**Save:** Click Save in the Console. If PAUSE, keep the full artifact visible for resume — do not accept only the questionnaire portion.

**Next (CLOSED):** Run Stage 04 one package at a time in dependency order using the full Work Package File.

**Next (PAUSE):** Resolve the blocking decisions. Resume exactly as instructed. Do not attempt downstream progression first.

**Stop if:** Expected artifacts are missing, dependencies are unclear, output conflicts with the Architecture Spec, or PAUSE_FOR_DECISIONS is returned.

**Operator note:** A Work Package File is the authoritative per-package downstream artifact. The implementer prompt is only one component inside it. Use the full Work Package File downstream, not just an inner prompt block. If the spec is CLOSED but marked Partially Ready - Restricted Areas, do not run blocked packages.

**Never do:** Do not treat manual extraction from one large orchestration blob as the normal workflow. Do not run blocked packages.

---

### Stage 04 — Module Implementer

**Status:** GO only when the specific Work Package File and required supporting artifacts exist.

**Now:** Implement one package.

**Needs:** Current Stage 04 prompt, the specific Work Package File, current Architecture Spec, any additional files explicitly required by that Work Package File. Optional: Master Briefing, Master Orchestration File, Execution Checklist.

**Expect:** Package implementation artifacts defined by the work package contract, structured Delivery Report.

**Save:** Click Save in the Console.

**Next:** Run Stage 05 review for that exact saved package output.

**Stop if:** Implementation is incomplete, required input file was missing, output clearly ignored the work package contract, Delivery Report is missing.

**Never do:** Do not send code alone if the Delivery Report is required.

---

### Stage 05 — Code Reviewer

**Status:** GO only when one exact package version is ready for review.

**Now:** Review one package output against its contract.

**Needs:** Current Stage 05 prompt, current Master Briefing, current Architecture Spec, the specific Work Package File, the specific package implementation output including Delivery Report. Optional: validator/test output.

**Expect:** Review result with clear pass/fail outcome, exactly one final routing block: `FINAL_DISPOSITION: ACCEPT` or `FINAL_DISPOSITION: REWORK`.

**Save:** Click Save in the Console.

**Next:** ACCEPT → hold package for merge. REWORK → route back to Stage 04. If verdict text and FINAL_DISPOSITION disagree → stop and resolve the review artifact first.

**Stop if:** Review result is unclear, FINAL_DISPOSITION block is missing/duplicated/invalid, package failed review, or any required input is missing.

**Never do:** Do not review from validator output alone. Do not treat PASS WITH NOTES as safe if merge-blocking issues remain.

**Craft review (structural+craft mode only):** After ACCEPT, the Console offers an optional non-gating craft review pass for subjective feedback (tone, pacing, voice, style). This produces an annotative artifact that does not affect merge eligibility. Use it or skip it — merge proceeds either way.

---

### Stage 06 — Merge Coordinator

**Status:** GO only for exact output/review pairs whose review ends with `FINAL_DISPOSITION: ACCEPT`.

**Now:** Merge only accepted package outputs.

**Needs:** Current Stage 06 prompt, current Architecture Spec, every accepted package output being merged, the matching review for each exact package version, relevant contract files.

**Expect:** Integration Report, Integration Manifest, Conflict Report, Compatibility Scan Summary, Boundary Validation Performed, Remaining Boundary Checks, changed files in full, explicit unchanged-file list, or a blocked-state report.

**Save:** Click Save in the Console.

**Next:** Continue with post-merge handling only after the full merge artifact set is saved.

**Stop if:** Any merged package lacks an accepted review, review does not match the exact package version, required contract file is missing, any merge artifact is missing, merge reports unresolved conflicts, or merge is blocked.

**Never do:** Do not merge failed or unreviewed package versions as if they were accepted. Do not treat changed files alone as a complete merge result without the Integration Report/Manifest context.

---

## 7. Package loop cards

### Package Implementation Card

**Now:** Implement one package.

**Needs:** Stage 04 prompt, this Work Package File, Architecture Spec, any package-specific dependency artifacts.

**Expect:** Package implementation artifacts, structured Delivery Report.

**Save:** Click Save in the Console.

**Next:** Send that exact saved package output to Stage 05 review.

**Stop if:** Output is partial, wrong format, missing sections, Delivery Report missing, or clearly off-contract.

### Package Rework Card (After Review Fail)

**Now:** Repair one failed package.

**Needs:** Repair/escalation guidance from saved Stage 03 artifacts (including Repair Prompt Template if emitted), same Work Package File, failed implementation output including Delivery Report, failed review output, Architecture Spec.

**Paste:** If a Repair Prompt Template is available, fill it in: failed implementation → `{{PREVIOUS_OUTPUT}}`, critical/major findings → `{{FAILED_CHECKS}}`, specific requested fixes → `{{ISSUE_LIST}}`. If no template was emitted, assemble the same information in that order with the full Work Package File.

**Expect:** Revised package implementation, revised Delivery Report.

**Save:** Click Save in the Console.

**Next:** Run Stage 05 review again on the revised package.

**Stop if:** Work Package File is unclear, Architecture Spec is ambiguous, or required upstream artifact is missing.

### Accepted Package Holding Card

**Now:** Hold an accepted package for merge.

**Needs:** Accepted package output including Delivery Report, pass review for that exact package version. The Console tracks accepted packages automatically.

**Next:** Send only accepted packages into Stage 06 merge.

**Stop if:** Pass review does not clearly match the exact saved package version.

---

## 8. Failure routing

**If a package output is incomplete:** Save it if needed for traceability. Do not send it downstream as valid. Rerun or repair through Stage 04. If incompleteness comes from unclear contract inputs, route upstream.

**If a reviewer fails a package:** Fail is a stop signal for that package. Save the fail review. Do not mark the package accepted. Route back to Stage 04 rework. Route further upstream only if the failure reveals a contract problem.

**If a merge is blocked:** Blocked merge is a stop signal for integration. Save the full merge artifact set. Identify whether the blocker is package-level or contract-level. Route to Stage 04/05 for package-level issues. Route to Stage 02/03 for architecture or work-package issues. Do not declare success until the block is cleared.

**If the contract closure gate says PAUSE_FOR_DECISIONS:** Treat it as a hard stop, not a warning. Save the full PAUSE artifact. Keep Gate Result, Blocking Contract-Critical Decisions, Minimal Decision Questionnaire, and Resume Instruction visible. Resolve the blocking decisions explicitly. Continue only after the gate is cleared.

**If a required file is missing:** Stop immediately. Do not guess. Do not substitute an optional file. Recover or recreate through the correct upstream stage.

---

## 9. Upstream routing test

Route upstream when the problem is not just bad execution, but bad contract basis.

**Typical upstream signs:** Work Package File and Architecture Spec disagree, Architecture Spec is ambiguous, Stage 03 boundaries are missing or contradictory, reviewer says the package cannot be judged because the contract is unclear, merge reveals incompatible contracts, required decisions were never closed.

**Typical local package signs:** Contract was clear, implementation simply missed requirements, output format was incomplete, reviewer gave concrete fixable findings.

---

## 10. File management

The Console manages all file organization, naming, and versioning automatically. The operator's responsibility is limited to: verifying the prompt folder contains the correct files, not manually modifying workspace files outside the Console, and using the Console's file import feature for LLM-generated files.

**Workspace resume:** After a browser reload, the Console reconnects automatically. If the browser requires permission, click the Reconnect button.

**Multi-workspace:** Each browser tab remembers its own workspace. Assign a different accent color per workspace. Do not open the same workspace folder in two tabs.

**Optional git companion:** Run `git init` in the workspace folder, then start the watch script for automatic versioning. Recovery: use `git log` and `git checkout` to restore any previous state.

**Archive:** Superseded and stale artifacts are moved to `archive/` automatically. The manual "Archive old files" button is available in the Recovery section.

---

## 11. Final reminder

This file is not here to make the workflow fancy. It is here to reduce operator mistakes when attention is low.

When uncertain: slow down, return to the current stage card, re-check the contract and required artifacts, read the output again, obey the stop condition.

**Clear execution beats fast improvisation.**
