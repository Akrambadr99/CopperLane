# BuildLedger task calibration report

The strongest surfaces combine construction record ownership, revision lineage, guarded commands, and visible recovery. The new drawing comparison panel supplies deterministic two-record state and field-level outcomes. Existing seeded data, repository revisions, and audit events keep browser tests stable.

| Workflow group | Why it is medium | React/state concepts | Hidden-test determinism | Likely future patch |
|---|---|---|---|---|
| Drawing and submittal control | Selection, filters, revisions, and dependent review state interact | derived state, keyed selection, immutable comparison | High with seeded drawings | 1–3 existing source files |
| Inspection and evidence | Attachment lifecycle must preserve the inspection on validation failure | async ownership, pending state, rollback | High with fixed fixtures | 2–4 files |
| Changes and payments | Approval, contingency, delegation, and stale revisions meet in one command | optimistic state, conflict recovery, permissions | High with fixed clocks | 2–4 files |
| Audit, import, and export | Preview/filter state must never mutate source records | parsing, pagination, derived views | High | 1–3 files |

## Calibration

- **Medium majority:** drawing comparison; selected submittals across filters; entity-scoped inspection drafts; pending evidence ownership; partial bulk-review preview; payment delegation dates; contingency conflict retry; activity filters plus cursor; import mapping conflicts; safe CSV export; saved views per actor; permission changes during an open dialog; recurring inspection schedules; comment mention lifecycle; cross-tab refresh preserving a draft; webhook retry status; undo/redo for drawing annotations; stale search results; notification snooze transitions; archived-contract visibility.
- **Reject as Too Easy:** rename a status label; hide one button for one role; add a required marker; change empty-state copy.
- **Reject as Too Hard:** replace the repository architecture; introduce a project-wide event-sourcing migration; build a document-rendering subsystem; coordinate external BIM and payment services.

Strongest 20 directions are the Medium list above. Each has one browser-observable outcome, stable fixtures, and an expected 1–4 existing-file patch. Promote one only after exact-base failure proof and source-only patch preflight.
