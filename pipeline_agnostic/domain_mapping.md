# Domain-Agnostic Mapping: Coding → Generic

## Terms that become domain-variable

| Coding Term | Agnostic Term | DOMAIN Annotation |
|---|---|---|
| source file / code file | deliverable unit | [DOMAIN: primary deliverable type] |
| module | component / deliverable group | [DOMAIN: bounded unit of work] |
| interface / function signature | boundary contract / connection point | [DOMAIN: how deliverables connect] |
| shared type / data model | shared definition / canonical vocabulary | [DOMAIN: shared structures] |
| import / dependency | consumption / upstream dependency | [DOMAIN: consumption relationship] |
| code review | deliverable review / quality review | [DOMAIN: verification method] |
| merge / integration | assembly / integration | universal |
| file | deliverable artifact | [DOMAIN: output unit] |
| compile / build | assemble / validate completeness | [DOMAIN: assembly method] |
| test / pytest / unittest | verification / validation check | [DOMAIN: verification method] |
| lint / format check | standards compliance check | [DOMAIN: format validation] |
| import test | consumption check | [DOMAIN: dependency verification] |
| bug / error | defect / non-conformance | universal |
| refactor | restructure | universal |
| API | external interface | [DOMAIN: external boundary] |
| function | operation / procedure | [DOMAIN: unit of behavior] |
| class | structure / entity | [DOMAIN: structural unit] |
| variable | parameter / attribute | [DOMAIN: data element] |
| code comment | annotation / note | universal |
| repository | project archive | universal |
| branch | variant / version line | universal |
| Python / JavaScript / etc. | [removed — domain chooses tools] | [DOMAIN: implementation technology] |

## Terms that stay FROZEN (Console-parsed)

These NEVER change regardless of domain:
- FINAL_DISPOSITION: ACCEPT / REWORK
- REVIEW_BINDING_TOKEN:
- IMPLEMENTATION_FINGERPRINT:
- Merge-Blocking: YES / NO
- Delivery Report
- Progression Status: CLOSED / PAUSE_FOR_DECISIONS
- Master Briefing
- Architecture Spec
- Work Package File / _Work_Package.txt
- Master Orchestration File / _Master_Orchestration.txt
- Execution Checklist / _Execution_Checklist.txt
- Package ID: / Objective: / Depends On / Filename:
- Boundary Test Minimum
- Definition of Done / Not-Done-If
- Formal Package Contract / Operator Header
- All stage numbers (Stage 01 through Stage 06)
- All evidence classifications (CRITICAL / MAJOR / MINOR / NOTE)

## Sections that need domain annotations

### Requirements Engineer (01)
- Interview questions: generic, mostly universal already
- Output structure: Master Briefing — universal
- Complexity/safety assessment: universal
- DOMAIN: "What is a deliverable in this domain?"

### Technical Architect (02)  
- Module Inventory → Component Inventory [DOMAIN: what are the components?]
- Interface Contracts → Boundary Contracts [DOMAIN: how do components connect?]
- Shared Types → Shared Definitions [DOMAIN: what vocabulary is shared?]
- File/Artifact Contract → Deliverable Contract [DOMAIN: what is produced?]
- Dependency Map → Dependency Map (universal)
- Invariants → Invariants (universal)
- Error Semantics → [DOMAIN: what are the failure modes?]
- Boundary Tests → [DOMAIN: how are boundaries verified?]

### Project Orchestrator (03)
- Module → Component [DOMAIN: bounded unit]
- LLM routing: universal
- Package decomposition: universal
- Validation strategy: [DOMAIN: verification methods]

### Module Implementer (04)
- "Code" → "Deliverable" throughout
- Files Allowed to Change → Deliverables Allowed to Modify
- Files Forbidden → Deliverables Forbidden
- Canonical Interfaces → Canonical Boundary Contracts
- Implementation → Execution / Production
- "import test" → [DOMAIN: basic consumption verification]

### Code Reviewer (05)
- "Code Review" → "Deliverable Review"
- Code-specific checks → [DOMAIN: quality checks]
- "Syntax" → [DOMAIN: format compliance]
- "Runtime" → [DOMAIN: operational correctness]
- "Integration test" → [DOMAIN: integration verification]

### Merge Coordinator (06)
- "Import resolution" → "Dependency resolution"
- "Build verification" → "Assembly verification"
- "Code conflict" → "Deliverable conflict"
- Compatibility scan: universal
