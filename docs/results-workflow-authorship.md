# Start/End Screen contribution and AI assistance

Asad directed this contribution: a Start Menu, supplied-score Results Screen,
and restart/back-to-menu workflow for Operation: Equation. The implementation
uses TypeScript, DOM APIs, and Vitest without new dependencies.

## Course policy supplied by the student

On November 2, 2026, Asad stated that CSE 110 permits code generated through
Codex under his direction to count toward the authorship requirement, and
explicitly authorized keeping this feature and committing, pushing, and opening
its PR under that policy. This record reports the policy supplied by the student;
it does not independently certify grading eligibility or a numeric percentage.

## Contribution disclosure

- Codex generated the menu controller, result validation/formatting, DOM view,
  demo, styling, entry-point changes, tests, and documentation under Asad's direction.
- Asad supplied the requirements and integration constraints, selected the scope,
  requested changes and checks, and authorized the final implementation.
- No manually typed student implementation has been recorded in this session.
  Approval is recorded as direction/authorization, not as manual code entry.
- The result interface follows Ping-Shu's score snapshot. No score calculation
  was duplicated and no existing teammate implementation was modified.
- The existing NotificationManager and its 17 tests are teammate work and are
  not claimed as this contribution. The feature adds 58 tests.

Only the working implementation in `src/menu/` is retained. Unused alternative
workflow scaffolding was removed. A local reference archive and assignment drafts
remain in `.learning-reference/`, ignored by Git.

Local checks: `npm test`, `npx tsc --noEmit`, and `npm run build`.
Review, approval, CI, and merge status must be verified on the actual GitHub PR.
