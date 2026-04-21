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
- `security-best-practices` skill: high-value for explicit security reviews or secure-by-default JavaScript and Node changes.
- `security-threat-model` skill: high-value before larger backend, auth, sync, persistence, or local-library-access design changes.
- `doc` skill: use when creating or editing `.docx` project documents where formatting or layout fidelity matters.

### Default Skill By Task

- UI change or feature work: use `superpowers:brainstorming` first, then `superpowers:writing-plans` for multi-step work. Validate with `playwright`. Before finalizing, use `superpowers:verification-before-completion`. For UI audits, use `build-web-apps:web-design-guidelines`.
- Bugfix or regression: use `superpowers:systematic-debugging` first. If behavior changes, prefer `superpowers:test-driven-development`. Reproduce and verify with `playwright` or the repo `qa:*` scripts.
- Backend sync, persistence, or server behavior: use `superpowers:brainstorming` for approach selection, `superpowers:test-driven-development` when changing behavior covered by Node tests, and `superpowers:verification-before-completion` before claiming success.
- Explicit security review or secure-hardening work: use `security-best-practices` when the task is specifically about security best practices, security review, secure coding guidance, or a security report. Use repo evidence and keep findings prioritized.
- Threat modeling or abuse-path analysis: use `security-threat-model` when the user explicitly asks for threat modeling, attacker goals, trust boundaries, abuse paths, or AppSec-focused architecture review. Ground all claims in repository evidence and write the resulting model as a concise markdown artifact when requested.
- Documentation deliverable in Word format: use `doc` for `.docx` creation or editing, especially if layout matters. Prefer this over ad hoc plain-text export when the requested deliverable is a formatted Word document.
- Large or risky change: use `superpowers:using-git-worktrees` for isolation, `superpowers:writing-plans` for execution order, and `superpowers:requesting-code-review` or `coderabbit:code-review` before merge.
- Review or audit request: if the user asks for code review, default to `coderabbit:code-review`. If the user asks for UI or UX review, use `build-web-apps:web-design-guidelines`.
- Security-sensitive change request: if the user is changing auth, persistence, sync, file-system access, or other trust-boundary code, consider whether an explicit `security-best-practices` review or `security-threat-model` pass is warranted before finalizing.
- CI or PR feedback: use `github:gh-fix-ci` for failing checks and `github:gh-address-comments` for review threads.

### Repo-Specific Workflow

1. Read `docs/agent-map.md` before touching code.
2. Edit source shards in `src/js/auralis-core/` or `src/styles/`, not generated `auralis-core.js`, unless the task explicitly requires otherwise.
3. Rebuild with `npm run build` after JavaScript shard changes.
4. Run the smallest proving command first:
   - `npm test` for server behavior
   - targeted `npm run qa:*` flow for UI behavior
   - `playwright` skill for interactive reproduction or validation
5. For explicit security work, run the relevant security skill before finalizing recommendations or fixes:
   - `security-best-practices` for secure-coding review or hardening guidance
   - `security-threat-model` for attacker-path and trust-boundary analysis
6. For requested Word-format deliverables, use `doc` rather than hand-rolling document output.
7. Apply `superpowers:verification-before-completion` before any completion claim, commit, or push.
8. Run `coderabbit:code-review` when the change is non-trivial or user-facing.

### Lower-Relevance Skills For This Repo

- `build-web-apps:react-best-practices`, `build-web-apps:shadcn`, `build-web-apps:stripe-best-practices`, and `build-web-apps:supabase-postgres-best-practices` are not primary fits unless the repo stack changes.
- Figma skills are useful only when implementing or syncing against actual Figma designs.
- `doc` is not a default workflow tool for this repo's code changes; use it only when the requested output is an actual `.docx` document.
