# Repository Instructions

## Git And Branch Workflow

- Always integrate relevant dirty changes in the working tree before finalizing work, rather than ignoring or leaving compatible pending changes behind.
- Always create a tagged version snapshot before completing a commit/push workflow.
- Always commit completed work and push it to the experimental branch by default.
- Only merge experimental into main when explicitly asked to do so.
- After merging to main when requested, switch back to experimental, update it from the latest merged point, and continue future work from experimental.

## Repo Working Style

- The user is vibe coding. Explain all codebase-related work in plain, everyday language first, as if speaking to a smart non-programmer.
- Prioritize clarity, reliability, maintainability, and accuracy over sounding technical.
- You have broad autonomy to reorganize, modularize, refactor, rename, restructure, simplify, split, combine, or otherwise manipulate the codebase whenever doing so improves understandability, efficiency, reliability, maintainability, or correctness.
- Do not preserve confusing structure, weak naming, duplication, or oversized files just because they already exist.
- Always optimize both the codebase and the explanation for a non-coder's understanding.

## Required Explanation Style For Codebase Work

- Start with the big picture before technical details.
- Always begin with a plain-English summary.
- Focus on what this is, why it matters, what changed or needs to happen, what could break, recommended next step, and bottom line.
- Avoid jargon unless necessary; define it immediately when used.
- Translate technical ideas into simple language consistently.
- Use professional, non-childish visuals when visuals would improve understanding.
- Prefer clean diagrams, labeled flows, comparison tables, architecture maps, and step-by-step breakdowns.

## Default Validation And Execution Model

- Prefer Codex Browser use as the default tool for UI validation, rendered-state checks, interaction testing, screenshots, visual regression inspection, and local dev server verification.
- Prefer Codex Computer use when the task requires desktop-level interaction, multi-app workflows, OS dialogs, file pickers, browser-external steps, or workflows that Browser use cannot complete cleanly.
- Do not default to Playwright or Playwright-specific workflows unless the task explicitly requires maintaining or editing existing Playwright tests for legacy reasons.
- When validating UI changes:
  1. Run the local app or preview.
  2. Use Browser use to reproduce, inspect, and verify.
  3. Use Computer use only if the flow leaves the browser or needs broader system interaction.
  4. Use repo test scripts when they are the smallest reliable proof.
- Prefer direct product-behavior verification over framework-specific browser automation unless automation itself is the task.

## Parallel And Multi-Agent Workflow

- For complex, risky, or multi-part tasks, explicitly decompose work into parallel or semi-independent streams when that improves accuracy, coverage, or quality.
- Typical workstreams: understanding current behavior, identifying bugs/regressions/risks, designing the cleanest structural change, implementing the change, validating behavior and edge cases, and translating findings into plain-English explanation.
- Keep workstreams clearly scoped and non-overlapping.
- Synthesize outputs into one coherent conclusion.
- Resolve disagreements explicitly.
- Cross-check important findings before finalizing.
- Prefer multi-pass review for user-facing, risky, or architecture-affecting changes.

## Highest Leverage Tools And Skills

- Superpowers plugin: default process layer for most non-trivial work in this repo.
- Codex Browser use: default UI interaction and validation tool for local dev servers, file-backed previews, screenshots, and rendered-state verification.
- Codex Computer use: use for workflows that require broader desktop or app interaction beyond the browser.
- CodeRabbit plugin via coderabbit:code-review: strongest review pass after local verification.
- GitHub plugin: use for PR follow-up, CI failures, and review-comment resolution once changes are ready.
- security-best-practices skill: high-value for explicit security reviews or secure-by-default JavaScript and Node changes.
- security-threat-model skill: high-value before larger backend, auth, sync, persistence, or local-library-access design changes.
- doc skill: use when creating or editing .docx project documents where formatting or layout fidelity matters.

## Default Skill By Task

- UI change or feature work: use superpowers:brainstorming first, then superpowers:writing-plans for multi-step work, validate with Codex Browser use, use Codex Computer use only if the flow requires broader system interaction, and before finalizing use superpowers:verification-before-completion.
- Bugfix or regression: use superpowers:systematic-debugging first. If behavior changes, prefer superpowers:test-driven-development. Reproduce and verify with Browser use, Computer use if necessary, or the repo qa:* scripts if they are already the smallest reliable proof.
- Backend sync, persistence, or server behavior: use superpowers:brainstorming for approach selection, use superpowers:test-driven-development when changing behavior covered by Node tests, and use superpowers:verification-before-completion before claiming success.
- Explicit security review or secure-hardening work: use security-best-practices when the task is specifically about security best practices, security review, secure coding guidance, or a security report.
- Threat modeling or abuse-path analysis: use security-threat-model when the user explicitly asks for threat modeling, attacker goals, trust boundaries, abuse paths, or AppSec-focused architecture review.
- Documentation deliverable in Word format: use doc for .docx creation or editing, especially if layout matters.
- Large or risky change: use superpowers:using-git-worktrees for isolation, use superpowers:writing-plans for execution order, use parallel workstreams where useful, and use superpowers:requesting-code-review or coderabbit:code-review before merge.
- Review or audit request: if the user asks for code review, default to coderabbit:code-review. If the user asks for UI or UX review, use build-web-apps web design guidance when available.
- Security-sensitive change request: if the user is changing auth, persistence, sync, file-system access, or other trust-boundary code, consider whether an explicit security-best-practices review or security-threat-model pass is warranted before finalizing.
- CI or PR feedback: use github:gh-fix-ci for failing checks and github:gh-address-comments for review threads.

## Repo-Specific Workflow

- Read docs/agent-map.md before touching code.
- Edit source shards in src/js/auralis-core/ or src/styles/, not generated auralis-core.js, unless the task explicitly requires otherwise.
- Rebuild with npm run build after JavaScript shard changes.
- Run the smallest proving command first:
  - npm test for server behavior.
  - Targeted npm run qa:* flow for repo-defined UI behavior checks.
  - Browser use for interactive reproduction, rendered validation, screenshots, and manual verification.
  - Computer use only when broader system interaction is required.
- For explicit security work, run the relevant security skill before finalizing recommendations or fixes.
- For requested Word-format deliverables, use doc rather than hand-rolling document output.
- Apply superpowers:verification-before-completion before any completion claim, commit, or push.
- Run coderabbit:code-review when the change is non-trivial or user-facing.

## Definition Of Done

- The relevant source files were changed instead of generated outputs, unless the task explicitly required generated-file editing.
- The build step was run when required.
- The smallest reliable proof was run.
- Browser use or Computer use was used for UI validation when the change affects user-visible behavior.
- Important findings were cross-checked when the task was risky, ambiguous, or multi-step.
- Explanations were provided in plain English for a non-coder.
- Relevant dirty working-tree changes were integrated.
- A tag snapshot was created before finishing commit/push workflow.
- Completed work was committed and pushed to experimental by default unless explicitly instructed otherwise.

## Lower-Relevance Skills For This Repo

- build-web-apps:react-best-practices, build-web-apps:shadcn, build-web-apps:stripe-best-practices, and build-web-apps:supabase-postgres-best-practices are not primary fits unless the repo stack changes.
- Figma skills are useful only when implementing or syncing against actual Figma designs.
- doc is not a default workflow tool for this repo's code changes; use it only when the requested output is an actual .docx document.
- Legacy Playwright-specific guidance is no longer the default workflow for this repo unless maintaining existing Playwright artifacts is explicitly the task.
