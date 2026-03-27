# Multi-User Concurrent Access: Architectural Analysis

**Project:** LLMFrame  
**Author:** Dennis Kühn + Claude  
**Date:** 2026-03-26  
**Status:** ANALYSIS — not a feature commitment  
**Context:** Evaluating what it would take to support multiple operators working on the same LLMFrame project simultaneously.

---

## 1. Current Architecture: Single-Operator by Design

LLMFrame's core design premise is **one operator, multiple LLMs.** The operator is the human in the loop — the person who routes tasks, validates output, and makes decisions. The LLMs are the workforce. Every architectural decision flows from this:

- **One manifest file.** Single source of truth for artifact versions. No branching, no merge.
- **Linear state machine.** The project is at exactly one stage at any point in time. `resolveWorkflowSnapshot()` returns a single position.
- **Sequential fingerprint chain.** Each artifact references a specific version of its upstream dependency via fingerprint. The chain is append-only and assumes nobody modifies upstream while downstream is in progress.
- **File System Access API.** Direct read/write to local disk. No locking, no transaction boundaries, no network layer.
- **Single audit log.** One append-only log file. No attribution beyond timestamps.

This is not an oversight. It's a deliberate trade-off: maximum simplicity for the single-operator case, which is the only case that existed when the architecture was designed.

---

## 2. What Breaks With Two Operators

### 2.1 Manifest Corruption (Certainty: 100%)

The manifest is a JSON file that tracks every artifact's name, version, fingerprint, and stage. Both operators' Console instances hold the manifest in memory and write it back to disk on any state change.

```
Operator A: reads manifest (v7) → adds artifact → writes manifest (v8)
Operator B: reads manifest (v7) → adds artifact → writes manifest (v8')

Result: Operator A's artifact is lost. Manifest is v8' which only contains B's change.
```

This is the textbook lost-update problem. It will happen on the first concurrent operation, guaranteed.

### 2.2 State Machine Bifurcation (Certainty: 100%)

The state machine tracks a single cursor: "the project is at Stage X, awaiting action Y." Two operators acting on different packages create a state that doesn't exist in the current model.

```
Operator A: working on Package 3 implementation (Stage 04)
Operator B: reviewing Package 1 (Stage 05)

resolveWorkflowSnapshot() returns: ???
```

The state machine will return whichever stage was written last. The other operator's work becomes invisible to the Console. There is no concept of per-package state — only project-level state.

### 2.3 Fingerprint Chain Corruption (Certainty: High)

The fingerprint chain ensures traceability: Implementation X was built against Architecture Contract Y (fingerprint abc123). If Operator A modifies the architecture contract while Operator B implements against the original version, the chain silently breaks.

```
Operator A: revises architecture contract → new fingerprint def456
Operator B: implements against old fingerprint abc123
Reviewer: validates B's implementation against def456 → mismatch → rejection

Or worse: nobody notices. The implementation passes review against a contract version
it wasn't built against. Traceability is an illusion.
```

This is particularly insidious because the failure is silent. The system doesn't crash — it produces results that look valid but aren't.

### 2.4 Prompt Snapshot Collision (Certainty: High)

The Console saves prompt snapshots (the exact prompt sent to the LLM) for audit purposes. Snapshots are keyed by stage and timestamp. Two operators triggering the same stage within the same second would overwrite each other's snapshots.

Even without exact collisions, the snapshot sequence becomes incoherent — snapshots from interleaved sessions that can't be reconstructed into a linear narrative.

### 2.5 Audit Log Interleaving (Certainty: 100%)

The audit log is append-only, which means concurrent writes won't lose data (in most file systems, appends are atomic up to a buffer size). But the log will interleave entries from both operators with no clear separation. Reconstructing "what did Operator A do?" requires parsing timestamps and guessing attribution.

### 2.6 Workspace File Conflicts (Certainty: Moderate)

Both operators work in the same workspace directory structure. If both modify the same file in `stage04/` — even different sections — the file system has no merge capability. Last write wins.

---

## 3. What Would Multi-User Require

### 3.1 Level 1 — Minimum Viable: File Locking

**Goal:** Prevent concurrent writes from corrupting shared files.

**Implementation:** Advisory file locks on the manifest, audit log, and workspace files. Before writing, acquire a `.lock` file (atomic create via `O_CREAT | O_EXCL`). Release after write.

```javascript
async function acquireLock(filepath) {
    const lockPath = filepath + '.lock';
    // Attempt atomic file creation — fails if lock exists
    try {
        await fs.open(lockPath, 'wx');
        return true;
    } catch {
        return false; // Already locked
    }
}
```

**What this solves:** Manifest corruption, audit log interleaving.  
**What this doesn't solve:** State machine bifurcation, fingerprint chain integrity, semantic conflicts.  
**Effort:** Low (~2 days).  
**Value:** Prevents data loss but doesn't enable real concurrent work. Operators still block each other.

### 3.2 Level 2 — Per-Package State Tracking

**Goal:** Allow different packages to be at different stages simultaneously.

**Implementation:** Replace the single project-level state cursor with a per-package state map:

```json
{
    "packages": {
        "PKG-001": {"stage": "STAGE_05", "operator": "A", "locked_at": "2026-03-26T14:00:00Z"},
        "PKG-002": {"stage": "STAGE_04", "operator": "B", "locked_at": "2026-03-26T14:05:00Z"},
        "PKG-003": {"stage": "STAGE_04", "operator": null, "locked_at": null}
    }
}
```

`resolveWorkflowSnapshot()` becomes `resolvePackageState(packageId)`. The Console UI shows a kanban-like view of all packages and their current stages.

**What this solves:** State machine bifurcation. Operators can work on different packages without blocking each other.  
**What this doesn't solve:** Fingerprint chain integrity for shared artifacts (architecture contracts), merge conflicts when packages touch the same files.  
**Effort:** High (~2 weeks). Requires rewriting the state machine, the Console UI, and every function that assumes a single project state.  
**Breaking change:** Yes. Every Console module that calls `resolveWorkflowSnapshot()` must be updated. The Operating Guide and Run Layer must be rewritten.

### 3.3 Level 3 — Fingerprint Chain Branching

**Goal:** Allow multiple operators to work against different versions of shared artifacts without corrupting traceability.

**Implementation:** The manifest becomes a DAG (directed acyclic graph) instead of a linear list. Each artifact version is a node. References between artifacts are edges. Multiple versions of the same artifact can coexist.

```json
{
    "artifacts": {
        "arch_contract_v1": {"fingerprint": "abc123", "stage": "02", "version": 1},
        "arch_contract_v2": {"fingerprint": "def456", "stage": "02", "version": 2},
        "impl_pkg1": {"fingerprint": "ghi789", "built_against": "arch_contract_v1"},
        "impl_pkg2": {"fingerprint": "jkl012", "built_against": "arch_contract_v2"}
    }
}
```

When the architecture contract changes, implementations built against the old version are flagged for re-validation, not silently invalidated.

**What this solves:** Fingerprint chain integrity. Operators can work against different artifact versions with full traceability.  
**What this doesn't solve:** Merge conflicts in the final codebase.  
**Effort:** Very high (~4-6 weeks). The manifest format changes fundamentally. The Reviewer prompt must understand version graphs. The Console must visualize dependency trees.  
**Breaking change:** Yes. Catastrophically. Every pipeline prompt that references artifacts must understand versioned references. The contract surface of every role changes.

### 3.4 Level 4 — Conflict Resolution at Merge

**Goal:** When two operators' implementations touch the same code, detect and resolve conflicts.

**Implementation:** The Merge Coordinator (Stage 06) already merges multiple packages. But it assumes packages are non-overlapping (each package owns a set of files). With concurrent work, packages may modify the same files.

Options:
- **Pessimistic:** Packages declare file ownership up front (in the orchestration plan). Two packages cannot claim the same file. This is already partially enforced by the Orchestrator's dependency graph.
- **Optimistic:** Allow overlap. At merge time, detect conflicts (diff-based). Present conflicts to the operator for resolution. This is essentially building `git merge` into the Console.
- **LLM-assisted resolution:** Feed both versions to the Merge Coordinator and let the LLM resolve. Dangerous — the LLM may silently break one version's intent.

**Effort:** Very high to extreme (~6-10 weeks for optimistic merge, including UI).  
**Breaking change:** The Merge Coordinator prompt changes significantly.

### 3.5 Level 5 — Real-Time Collaboration

**Goal:** Google Docs-style concurrent editing of pipeline artifacts.

**Implementation:** Replace file system storage with a CRDT-based or OT-based collaboration layer. WebSocket server for real-time sync. Presence indicators showing who's working where.

**Effort:** This is a different product. Multiple months. Requires a server component, eliminating the "runs in a browser with zero setup" advantage that is LLMFrame's core architectural strength.

---

## 4. The Network Problem

All levels above 1 implicitly require operators to share state in real time. The Console currently runs on local files. There are two paths to shared state:

### 4.1 Shared File System (Low Tech)

Both operators access the same directory (network drive, Dropbox, Syncthing, etc.). File locking works across network file systems (with caveats — NFS locks are notoriously unreliable). 

**Pros:** No server component. No code changes beyond locking.  
**Cons:** Network file system lag causes phantom conflicts. Dropbox sync delays can be seconds to minutes. Unreliable locking.

### 4.2 Server Component (Proper Solution)

A lightweight server (Node.js, Python, or even a static file server with a REST API) that:
- Holds the canonical manifest
- Enforces locking
- Broadcasts state changes to connected Consoles via WebSocket

**Pros:** Correct. Reliable. Real-time.  
**Cons:** Destroys the zero-infrastructure promise. "Open an HTML file in your browser" becomes "install Node.js, run the server, configure the port, connect both Consoles." The simplicity that makes LLMFrame unique evaporates.

---

## 5. Honest Assessment

### What Multi-User Actually Means

| Level | Capability | Effort | Breaks Architecture |
|-------|-----------|--------|-------------------|
| 0 (current) | Single operator | — | — |
| 1 | File locking (prevent corruption) | 2 days | No |
| 2 | Per-package state | 2 weeks | Yes (state machine) |
| 3 | Fingerprint branching | 4-6 weeks | Yes (manifest + all prompts) |
| 4 | Merge conflict resolution | 6-10 weeks | Yes (Merge Coordinator) |
| 5 | Real-time collaboration | Months | Yes (everything) |

Each level requires all previous levels. You can't do Level 3 without Level 2. You can't do Level 2 without Level 1.

### The Real Question

LLMFrame's competitive position is: "Regulated-software-development controls applied to LLM-assisted coding, running in a single HTML file with zero infrastructure."

Multi-user support at Level 2+ trades that identity for a different product — a collaborative pipeline management platform. That product exists (it's called Jira + Git + CI/CD). LLMFrame's value is that it is *not* that product.

### Who Actually Needs This?

The scenarios where multiple operators work the same LLMFrame project simultaneously:

1. **Two developers on the same codebase.** They should use Git for code collaboration and separate LLMFrame instances per task/branch. The pipeline manages LLM orchestration, not human collaboration. Git manages human collaboration.

2. **One developer, multiple machines.** Already works — copy the workspace directory. Cloud sync (Dropbox, Google Drive) provides eventual consistency. File locking (Level 1) would eliminate the corruption risk.

3. **Team with a pipeline architect and multiple implementers.** The architect designs stages 01-03. Implementers work on separate packages in stage 04. The architect reviews in stage 05. This is the closest to a real multi-user case — but it's sequential by nature. The architect finishes before implementers start. The natural serialization of the pipeline stages already prevents most conflicts.

4. **Enterprise team, parallel workstreams.** This is a real need, but the answer is: run separate pipeline instances per workstream. The Orchestrator already supports splitting a project into independent packages. Each implementer runs their own Console on their own packages. The merge happens once, at Stage 06, by one operator.

---

## 6. Recommendation

### Do Now: Level 1 (File Locking)

Add advisory file locks to the manifest, audit log, and stage directories. Two days of work. Prevents data corruption from accidental concurrent access (e.g., two browser tabs, cloud sync race conditions). No architectural changes.

### Do Never: Levels 3-5

Fingerprint branching, conflict resolution, and real-time collaboration are architectural rewrites that destroy LLMFrame's core value proposition. If a team needs these capabilities, they should use Git + CI/CD alongside LLMFrame, not instead of it.

### Do Maybe, Later: Level 2 (Per-Package State)

Per-package state tracking has standalone value even for single-operator use. Currently, the operator finishes one package through stages 04-05 before starting the next. Per-package state would allow starting Package 3's implementation while Package 1 is in review — a natural efficiency gain even without a second operator.

If implemented, it should be framed as "parallel package processing" (a single-operator productivity feature), not "multi-user collaboration" (a product pivot). The fact that it incidentally enables a second operator to work on a different package is a side effect, not the design goal.

### The Git Parallel

LLMFrame and Git serve complementary purposes:

| Concern | Tool |
|---------|------|
| LLM orchestration | LLMFrame |
| Code versioning | Git |
| Human collaboration | Git + PR workflow |
| Artifact traceability | LLMFrame manifest |
| Merge conflict resolution | Git |
| Code review (human) | Git PR / code review tools |
| Code review (LLM) | LLMFrame Stage 05 |

Trying to replicate Git's collaboration model inside LLMFrame is solving a solved problem with a worse solution.

---

## 7. Summary

Multi-user concurrent access is not a feature — it's an architectural transformation. The minimum viable version (file locking) is trivial and worth doing. Everything beyond that trades LLMFrame's core strength (simplicity, zero infrastructure, single-file deployment) for capabilities that Git already provides better.

The pipeline's natural serialization (stages run in order, packages are independent work units) already enables a pragmatic form of team collaboration: one architect, multiple implementers working on separate packages, one integrator at merge. This workflow doesn't require any Console changes — it requires a section in the Operating Guide.

**LLMFrame manages the conversation between humans and LLMs. Git manages the conversation between humans and humans. Combining both into one tool serves neither purpose well.**

---

*This analysis is intended for the LLMFrame repository as architectural decision documentation.*
