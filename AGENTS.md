# Repository Instructions

- Always integrate relevant dirty changes in the working tree before finalizing work, rather than ignoring or leaving compatible pending changes behind.
- Always create a tagged version snapshot before completing a commit/push workflow.
- Always commit completed work and push it to the `experimental` branch by default.
- Only merge `experimental` into `main` when explicitly asked to do so.
- After merging to `main` when requested, switch back to `experimental`, update it from the latest merged point, and continue future work from `experimental`.

## Repo Productivity And Quality Cheat Sheet

Use these plugins and skills by default when they fit the task. This repo is a shard-based HTML/CSS/JS player shell with a Node backend, a generated `auralis-core.js` bundle, and existing Playwright QA flows.

### Highest Leverage

- `Superpowers` plugin: default process layer for most non-trivial work in this repo.
- `playwright` skill: highest-value validation tool for UI flows, regressions, screenshots, and real browser debugging.
- `CodeRabbit` plugin via `coderabbit:code-review`: strongest review pass after local verification.
- `GitHub` plugin: use for PR follow-up, CI failures, and review-comment resolution once changes are ready.

### Default Skill By Task

- UI change or feature work: use `superpowers:brainstorming` first, then `superpowers:writing-plans` for multi-step work. Validate with `playwright`. Before finalizing, use `superpowers:verification-before-completion`. For UI audits, use `build-web-apps:web-design-guidelines`.
- Bugfix or regression: use `superpowers:systematic-debugging` first. If behavior changes, prefer `superpowers:test-driven-development`. Reproduce and verify with `playwright` or the repo `qa:*` scripts.
- Backend sync, persistence, or server behavior: use `superpowers:brainstorming` for approach selection, `superpowers:test-driven-development` when changing behavior covered by Node tests, and `superpowers:verification-before-completion` before claiming success.
- Large or risky change: use `superpowers:using-git-worktrees` for isolation, `superpowers:writing-plans` for execution order, and `superpowers:requesting-code-review` or `coderabbit:code-review` before merge.
- Review or audit request: if the user asks for code review, default to `coderabbit:code-review`. If the user asks for UI or UX review, use `build-web-apps:web-design-guidelines`.
- CI or PR feedback: use `github:gh-fix-ci` for failing checks and `github:gh-address-comments` for review threads.

### Repo-Specific Workflow

1. Read `docs/agent-map.md` before touching code.
2. Edit source shards in `src/js/auralis-core/` or `src/styles/`, not generated `auralis-core.js`, unless the task explicitly requires otherwise.
3. Rebuild with `npm run build` after JavaScript shard changes.
4. Run the smallest proving command first:
   - `npm test` for server behavior
   - targeted `npm run qa:*` flow for UI behavior
   - `playwright` skill for interactive reproduction or validation
5. Apply `superpowers:verification-before-completion` before any completion claim, commit, or push.
6. Run `coderabbit:code-review` when the change is non-trivial or user-facing.

### Lower-Relevance Skills For This Repo

- `build-web-apps:react-best-practices`, `build-web-apps:shadcn`, `build-web-apps:stripe-best-practices`, and `build-web-apps:supabase-postgres-best-practices` are not primary fits unless the repo stack changes.
- Figma skills are useful only when implementing or syncing against actual Figma designs.
