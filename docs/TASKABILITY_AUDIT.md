# BuildLedger taskability audit

## Workflow audit

| Workflow | Interactions and async behavior | Edge/domain rules | Observable result | Reliability / scope |
|---|---|---|---|---|
| Drawing comparison | two selections, changing revisions, derived diff | distinct drawings and missing fields | ordered field changes or explicit empty state | High / 1–3 files / Medium |
| Submittal review | filtering, selection, permission, partial plan | archived and ineligible records | eligible/skipped groups | High / 2–4 files / Medium-Hard |
| Inspection evidence | pending upload, navigation, retry | digest, duplicate, size and custody | owned success or specific failure | High / 2–4 files / Medium-Hard |
| Change/payment approval | delegation, contingency, revision conflict | no self-approval and budget ceiling | effective approver or retained retry draft | High / 2–4 files / Medium-Hard |
| Audit/data tools | filters, cursor, mapping, export | immutable history and safe cells | stable page, row errors, safe download | High / 1–3 files / Medium |

Initial state comes from versioned seed records. Actions and transitions remain local to a workflow, clocks can be fixed, failures have visible text, and unit plus Chromium coverage exists. Weak areas are static dashboard cards and metadata pages; cosmetic work there is rejected rather than counted. A cross-system BIM/payment orchestration would be excessively broad.

## 30 classified directions

1. **Strong candidate · Medium:** drawing revision comparison after either selection changes — deterministic keyed derived state.
2. **Strong candidate · Medium-Hard:** preserve a comparison when refreshed data removes one revision — selection plus stale data.
3. **Strong candidate · Medium:** selected submittals survive filters while deleted records are pruned — bounded identity logic.
4. **Strong candidate · Medium-Hard:** partial bulk-review preview with stable skip reasons — selection, policy, partial result.
5. **Strong candidate · Medium-Hard:** inspection upload result remains with its originating inspection after navigation — async ownership.
6. **Strong candidate · Medium:** attachment validation reports distinct policy failures before mutation — deterministic error mapping.
7. **Strong candidate · Medium-Hard:** optimistic inspection evidence rollback after rejected custody validation — rollback plus visible state.
8. **Strong candidate · Medium:** actor-scoped saved drawing views survive reload — persistence and ownership.
9. **Strong candidate · Medium-Hard:** permission changes close or constrain an active payment action safely — role plus active controls.
10. **Strong candidate · Medium-Hard:** dated approval delegation updates a pending payment without self-delegation — clock plus policy.
11. **Strong candidate · Medium-Hard:** stale change-order retry retains only edited impact fields — revision conflict recovery.
12. **Strong candidate · Medium:** contingency preview recomputes when another approved change arrives — derived totals plus refresh.
13. **Strong candidate · Medium:** structured drawing search preserves selected comparison — parsing plus local selection.
14. **Strong candidate · Medium:** cursor-paged audit filters recover when the current page becomes empty — filters plus pagination.
15. **Strong candidate · Medium-Hard:** cross-tab refresh keeps the active inspection draft while merging records — remote/local state boundary.
16. **Strong candidate · Medium:** import mapping keeps validation errors owned by source row — mapping plus row identity.
17. **Strong candidate · Medium:** safe CSV export neutralizes formulas while preserving quotes/newlines — visible downloaded output.
18. **Strong candidate · Medium:** recurring inspection edits keep completed occurrences immutable — schedule lifecycle.
19. **Medium:** comment mention recipients update after cursor edits.
20. **Medium:** notification snooze expires under a fixed clock.
21. **Medium:** webhook retries stop after terminal delivery.
22. **Medium:** bounded undo/redo for local drawing annotations.
23. **Poor hidden-test candidate:** browser download naming across operating systems.
24. **Poor hidden-test candidate:** exact timing of native file-picker cancellation.
25. **Too Easy:** change drawing status copy.
26. **Too Easy:** recolor an inspection badge.
27. **Too Easy:** add a static tooltip to contingency.
28. **Too Hard:** replace storage with event sourcing.
29. **Too Hard:** add complete BIM document rendering.
30. **Too Hard:** orchestrate external contractor, bank, and owner services.

Strong count: **18** Medium/Medium-Hard directions. They are strong because each has stable fixtures, one visible outcome, real construction rules, and an expected patch of a few existing files.

## Depth expansion directions 31–40

31. **Strong candidate · Medium-Hard:** construction handoff combines issued drawings, inspection status, and executed changes. 32. **Strong candidate · Medium:** contract switch recomputes linked evidence without leaking prior blockers. 33. **Strong candidate · Medium-Hard:** late failed inspection revokes a previously ready handoff. 34. **Strong candidate · Medium:** superseded drawings remain visible evidence without satisfying issue gates. 35. **Strong candidate · Medium-Hard:** approved change execution updates handoff and contingency together. 36. **Strong candidate · Medium:** handoff evidence count remains stable across filtering. 37. **Strong candidate · Medium-Hard:** permission change during handoff approval preserves review state. 38. **Strong candidate · Medium:** empty contract handoff explains missing issued evidence. 39. **Too Easy:** change the handoff heading. 40. **Too Hard:** coordinate handoff with external BIM and payment platforms.

Expanded strong count: **26**.

## Strongest 15 candidates

Directions **1, 3, 4, 5, 7, 9, 10, 11, 12, 13, 15, 16, 31, 33, and 35** are the final shortlist. Their React judgment is respectively: keyed comparison state; filtered identity preservation; partial-result planning; asynchronous result ownership; optimistic rollback; live permission invalidation; time-bound delegation; conflict-safe draft recovery; refreshed derived totals; parsed query plus retained selection; cross-tab local/remote reconciliation; row-owned validation; cross-entity handoff derivation; readiness revocation from late evidence; and coordinated handoff/contingency state. Each has stable fixtures and a browser-observable outcome.
