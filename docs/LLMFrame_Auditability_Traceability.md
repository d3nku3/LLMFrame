# Auditability & Traceability in LLMFrame

## The problem with AI-generated output in professional environments

When a team uses LLMs to produce deliverables — specifications, code, analyses, reports — a fundamental governance question arises: *who accepted what, when, and on what basis?* Most LLM tools treat this as someone else's problem. The chat happened, the output was copy-pasted somewhere, and six weeks later nobody can reconstruct whether the architecture decision in paragraph three was reviewed by a senior engineer or rubber-stamped at 2 AM.

LLMFrame treats auditability as a first-class architectural concern, not an afterthought.

## What gets tracked

Every artifact produced during a pipeline run — from the initial requirements document through architecture specs, work packages, implementations, review reports, and the final integration verdict — is fingerprinted, versioned, and timestamped at the moment it is saved to disk. The system maintains three complementary records:

The **artifact manifest** stores the identity of every artifact: its unique ID, content fingerprint (SHA-256), revision number, current status, and lineage — which upstream artifacts it depends on. The **audit log** is an append-only, machine-readable event journal that records every operator action with a timestamp: who created, accepted, rejected, or escalated each artifact, and critically, the elapsed time between an artifact being presented and the operator's decision. The **workspace folder** itself is the complete project record. No database, no cloud service, no proprietary format. Hand the folder to an auditor, a new team member, or an external reviewer, and they can reconstruct every decision without needing the tool that created it.

## Contract lineage across all stages

LLMFrame uses typed contract IDs to create traceable chains across the entire pipeline. A requirement (e.g. `MB-REQ-003`) maps to a specific interface in the Architecture Spec (`ARCH-IF-007`), which maps to a Work Package, an implementation deliverable, a review verdict, and a merge decision. When a defect surfaces in production, the response is not a search — it is a chain traversal. The audit trail shows exactly which requirement produced which interface, which implementation satisfied it, and which reviewer accepted it.

Review-to-implementation binding adds a cryptographic layer: each review report is tied to the exact fingerprint of the code version it evaluated. If the implementation is modified after review — even a single character — the binding breaks and the Console flags the artifact as requiring re-review. Post-review edits cannot pass silently.

## Detecting rubber-stamping

The most expensive failure mode in any review process is not rejection — it is false acceptance. A reviewer who clicks "Accept" without reading the output introduces undetected risk that compounds downstream.

LLMFrame records the time delta between an artifact being displayed and the operator accepting it. A 200-line review report accepted three seconds after opening tells a different story than one accepted after twelve minutes. The system does not block the operator — human authority over the process is a core design principle. But the timing data is in the audit log, permanently. In a post-incident review, in a compliance audit, or simply in a team retrospective, rubber-stamping becomes visible.

## What this means for enterprise environments

For organizations operating under regulatory, compliance, or quality management requirements — ISO 27001, SOC 2, FDA 21 CFR Part 11, or internal governance frameworks — LLMFrame provides a native audit trail for AI-assisted work that most LLM tooling simply does not offer. The workspace folder is portable, archivable, and machine-parseable. No vendor lock-in, no SaaS dependency, no data leaving the premises.

The framework does not replace existing governance processes. It makes AI-generated work subject to the same accountability standards as human-generated work — with better records than most human processes produce.
