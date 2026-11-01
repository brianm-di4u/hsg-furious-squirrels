# Visual review loop: protocol

A streamlined version of `games/Cart Racing/reviews/PROTOCOL.md` (itself after football's). Kept: two blind critics
(Claude and Codex), a fixed rubric with gates, A/B pairs against the previous loop and the A/B rule, a backlog
chosen by expected gain, and the stop rule. Dropped to save cost, as agreed with the owner: the separate prosecutor,
advocate and judge agents (the developer judges, bound by the rules below).

## Loop N
1. Build; the full test suite passes (`node shared/test-harness/run.mjs . --milestone mN`).
2. Capture: `node shared/test-harness/run.mjs . --milestone review-loop-N --file review` (fixed shot list in
   `tests/review.test.mjs`, frozen clock), then `node shared/test-harness/sheets.mjs . --milestone review-loop-N`
   and, from loop 2, `--compare review-loop-<N-1>` for the A/B pairs. The A/B side of the new build is a seeded coin
   flip recorded only in `loop-N/ab-key.json`.
3. Critics A (Claude subagent) and B (Codex via `codex:codex-rescue`, `--effort medium`) run in parallel with
   `briefs/critic.md` and `loop-N/brief.md`. Neither sees the other, any prior score or `HISTORY.md`.
4. Tally (`node tools/review-tally.mjs N`): each category's score is the mean of the two critics; the **A/B rule**
   holds a category at its previous score unless both critics' A/B verdicts agree on the direction of change.
   Writes `loop-N/scores.json` and updates `HISTORY.md`.
5. The developer fixes the backlog (high-severity issues raised by both critics first, then by expected gain per
   effort), records it in `loop-N/CHANGES.md`, and starts loop N+1.

## Stop rule
- **Pass:** every category meets its gate (≥ 7; authenticity ≥ 6).
- **Plateau:** 3 loops in a row without a new best total (at least 1.0 above the previous best).
- **Cap:** loop 8.
On stop: a campaign section in `REPORT.md`.
