# Smart Waste project instructions

Use the root `PLAN.md` as the implementation baseline. At the start of each batch, identify the earliest unfinished phase in Section 5 from the files and test results in this workspace. Complete and review that phase before starting the next. For each handoff, list the changed files, the relevant Section 7 checks, the commands run and their outcomes. Record blocked or unrun checks explicitly.

## Git handoff between Antigravity and Codex

Antigravity implements and self-reviews each phase. Before the next implementation batch, read this file, compare the current changes to the matching items in `PLAN.md`, and report which checks passed, failed or remain unrun. Fix findings within the current phase before marking it complete.

Both agents use the same local repository. Check the current HEAD, worktree and index before editing or committing. Stage only the files or hunks you own and inspect the staged diff. Leave the other agent's in-progress changes in place. Use focused commits, and hand off the commit hash, phase, test results and open findings. Codex reviews the implementation commit against its parent and makes a separate commit for any review changes it authors. A review with no file changes can reference the reviewed hash directly.

## Phase 0

- Freeze the Section 3 examples in executable contract fixtures. Cover all three login request shapes, the auth envelope, root-level schedule and inbox pagination, and notification methods, bodies and response statuses.
- Record the Node version and pin compatible dependencies in the lockfile. Record Android Studio and SDK availability. A Git setup issue can block a phase commit while fixture, seed and guard work proceeds.
- Define the versioned, deterministic demo data and reset behavior specified in Section 5. Keep reset available only in demo mode.
- Implement the production checks in the build entry point during Phase 0. Test each failure independently with the other inputs valid. Reject mock mode, enabled demo tools, and missing, placeholder or non-HTTPS API URLs. Exercise the valid configuration and demo build separately. The checked-in production URL is intentionally a placeholder.

## Later phases

Preserve Section 3 wire contracts. Keep Section 4 proposals behind demo adapters marked `TODO_BACKEND_SATHEESH` until the backend owner confirms the individual contract. Track browser demo, APK/device and live-backend results separately.

For F-04, two agent sessions must act on the same mutable request. Playwright contexts isolate local storage. Connect both contexts to a shared test fixture that exercises the application's claim transition, and assert one success, one conflict and one persisted owner. Seeding identical copies cannot exercise the conflict.
