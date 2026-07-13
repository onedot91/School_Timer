# F1 Plan Compliance Audit

Status: **REJECT**

Audited inputs:

- `.omo/plans/apple-ui-refresh-plan.md`
- final product diff under `DESIGN.md` and `src/`
- Todo 1–8 done claims, canonical runtime/oracle manifests, motion matrix, and final reviewer reports

## Blocking finding

### F1-1 — Required Apple material arrival/exit motion is disabled

The approved plan requires all of the following:

- Must have: “Translucent modal/sheet material arrives and leaves as one layer using synchronized compositor-only opacity/scale/filter changes.”
- Todo 2 acceptance: “material arrival synchronizes opacity/scale/filter on one layer.”
- Todo 8/F3: changed animations must be checked at rest, mid-transition, settled, interrupted/repeated, and reversed states.

The final source instead unconditionally disables the shared material animation:

- `src/index.css:11679` defines `.apple-material-layer` with `animation: none`.
- `src/index.css:13857` ends the Apple theme with `.apple-material-layer { animation: none !important; }`, overriding all preference variants.

The final evidence confirms this is intentional rather than an evidence gap:

- `task-8-apple-ui-refresh-plan/reviewer-design-functional.json` states that the final `animation:none!important` rule makes material mount/unmount “static-immediate in all supported preferences.”
- `task-8-apple-ui-refresh-plan/motion-actionability-matrix.json` classifies every material-arrival phase, including `mid`, `interrupted`, and `reversed`, as `not-applicable-static-immediate` because no transition exists.
- `task-2-apple-ui-refresh-plan/done-claim.json` acknowledges that conditional unmount remains immediate and no exit transition was implemented.

Static immediate mount/unmount can be safe and actionable, but it does not satisfy the approved, unconditional arrival-and-exit material contract. Marking missing transition phases “not applicable” cannot substitute for implementing and verifying a Must-have requirement.

Required resolution: either implement synchronized one-layer opacity/scale/filter arrival and symmetric exit with the required interruptibility/reduced-preference behavior, then regenerate Todo 2/8/F3 evidence; or explicitly revise and reapprove the plan to permit static material mount/unmount.

## Contract mapping summary

The remaining reviewed contracts have source/evidence mappings with no additional F1 blocker found:

- Maintained surfaces, including standalone `RandomDrawPage`: Todo 3–7 source diff; 456 core plus 9 supplemental current-revision captures; both final visual reviewers PASS.
- Visible-copy preservation: 357/357 canonical current oracle records and exact baseline comparisons reported; zero mismatches.
- Entry behavior: five-click reveal, entries 1–23, invalid storage, platform shortcuts, and runtime fallback covered by Todo 3 evidence.
- Auction behavior/data: 3-second polling, validation, confirmation/submission/status states, local-only REST host assertions, and no live writes covered by Todo 4 evidence.
- Modal lifecycle: `useModalFocus.ts` integration plus Todo 2/4/6/7 focus receipts cover initial focus, containment, safe Escape, inert background, nested restoration, and trigger return.
- Timer interaction classes: inline copy confirmation remains inline; settings children, award-presentation paths, full-screen tasks, utility panes, and transient layers are represented in Todo 6 ledger/evidence.
- Standalone draw contracts: storage shape, draw/history/queue behavior guardrails, responsive/preference states, and focus lifecycle covered by Todo 7 evidence.
- Responsive/accessibility: current manifest reports zero small targets, page overflow, active-surface clipping, console errors, live Supabase requests, and external question-service requests; preference and 200% states are included.
- Scope/data guardrails: no dependency addition, no `src/lib/randomDraw.ts` diff, no storage/payload algorithm change identified in the scoped product diff; isolated fixture evidence reports zero classroom mutation.
- Static gates: Todo 8 records `npm run lint`, `npm run build`, and `git diff --check` PASS, with only the pre-existing chunk-size advisory.

Because F1 requires every Must have/Must NOT have and behavior contract to be mapped and satisfied with no exception, **F1 does not approve this revision**.
