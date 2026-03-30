# Auditability & Traceability in LLMFrame

## The problem with AI-generated output in professional environments

When a team uses LLMs to produce deliverables — specifications, code, analyses, reports — a fundamental governance question arises: *who accepted what, and on what basis?* Most LLM tools treat this as someone else's problem. The chat happened, the output was copy-pasted somewhere, and six weeks later nobody can reconstruct whether the architecture decision in paragraph three was reviewed by a senior engineer or rubber-stamped without reading.

LLMFrame treats auditability as a first-class architectural concern, not an afterthought.

## What gets tracked

Every artifact produced during a pipeline run — from the initial requirements document through architecture specs, work packages, implementations, review reports, and the final integration verdict — is fingerprinted and versioned at the moment it is saved to disk. The system maintains three complementary records:

The **artifact manifest** stores the identity of every artifact: its unique ID, content fingerprint (SHA-256), revision number, current status, and lineage — which upstream artifacts it depends on. The **audit log** is an append-only, machine-readable event journal that records every operator action: who created, accepted, rejected, or escalated each artifact. Event order is preserved by file position. The **workspace folder** itself is the complete project record. No database, no cloud service, no proprietary format. Hand the folder to an auditor, a new team member, or an external reviewer, and they can reconstruct every decision without needing the tool that created it.

## Contract lineage across all stages

LLMFrame uses typed contract IDs to create traceable chains across the entire pipeline. A requirement (e.g. `MB-REQ-003`) maps to a specific interface in the Architecture Spec (`ARCH-IF-007`), which maps to a Work Package, an implementation deliverable, a review verdict, and a merge decision. When a defect surfaces in production, the response is not a search — it is a chain traversal. The audit trail shows exactly which requirement produced which interface, which implementation satisfied it, and which reviewer accepted it.

Review-to-implementation binding adds a cryptographic layer: each review report is tied to the exact fingerprint of the code version it evaluated. If the implementation is modified after review — even a single character — the binding breaks and the Console flags the artifact as requiring re-review. Post-review edits cannot pass silently.

## Making rubber-stamping harder

The most expensive failure mode in any review process is not rejection — it is false acceptance. A reviewer who clicks "Accept" without reading the output introduces undetected risk that compounds downstream.

LLMFrame addresses this structurally, not behaviorally. Plausibility checks verify that LLM output contains expected sections, contract IDs, and status fields before it can be saved. Review-to-implementation binding ensures each review is tied to the exact fingerprint of the code it evaluated — accept an old version and the Console flags the mismatch. Review findings are classified by severity (CRITICAL, MAJOR, MINOR), and merge-blocking findings prevent Stage 06 handoff regardless of the review disposition.

The system does not monitor how long the operator spends reading. Human authority over the process is a core design principle. The structural gates make careless acceptance more difficult, but they cannot make it impossible. The human remains the weakest and most important link.

## Why no timestamps

LLMFrame does not record timestamps in the audit log or artifact manifest. This is a deliberate decision, not an oversight.

Timestamps reveal work patterns: when someone works, how fast they work, when they take breaks, whether they reviewed something at 2 AM or during office hours. This is behavioral data about the operator, not structural data about the project. A tool that promises "no telemetry, no data collection" should not produce files that let a third party reconstruct someone's work schedule.

Pipeline traceability does not require timestamps. What matters is: which artifact exists, what it contains (fingerprint), which version it is (revision), what it depends on (lineage), and in what order events happened (file position in the append-only audit log). All of these work without knowing *when* they happened.

Compliance environments that require temporal evidence typically have external infrastructure — Git commits, SIEM systems, file system journals — that timestamps at the system level. LLMFrame does not need to duplicate this, and doing so would create a privacy liability that contradicts the project's core values.

## What this means for enterprise environments

For organizations operating under regulatory, compliance, or quality management requirements — ISO 27001, SOC 2, FDA 21 CFR Part 11, or internal governance frameworks — LLMFrame provides a native audit trail for AI-assisted work that most LLM tooling simply does not offer. The workspace folder is portable, archivable, and machine-parseable. No vendor lock-in, no SaaS dependency, no data leaving the premises.

The framework does not replace existing governance processes. It makes AI-generated work subject to the same accountability standards as human-generated work — with better records than most human processes produce.
