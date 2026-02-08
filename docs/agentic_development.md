# Agentic Development Protocol – whichFly

This document defines how agentic AI tools (Codex, Copilot, etc.) are used
to develop whichFly safely, incrementally, and in alignment with product intent.

---

## Goals

- Keep changes small, reviewable, and reversible.
- Preserve product intent and MVP scope.
- Provide clear evidence for behavior and test changes.
- Prevent silent scope creep or speculative features.

---

## Sources of truth (mandatory)

Before implementing any non-trivial change, agents MUST read:

- PRODUCT.md
- MVP.md
- AI_AGENT.md

If a change conflicts with these documents, the agent must stop and flag it.

---

## Change discipline

- Prefer small diffs with focused scope
- Do not mix refactors with new features
- Update documentation alongside code changes when relevant
- Avoid drive-by improvements

---

## Task workflow (per change)

1. Restate scope and acceptance criteria
2. Implement the smallest viable change
3. Add or update tests if behavior changes
4. Record test commands and results
5. Summarize behavior changes and risks

---

## Evidence requirements

- Always report test commands and results
- Explicitly note skipped tests and assumptions
- No change is complete without evidence

---

## Product safety checks

High-risk areas include:
- User-facing recommendation logic
- AI prompts or reasoning
- External API usage
- External datasets or licensing changes
- Anything affecting “Right now” UX

Risky changes require:
- Explicit reasoning
- Validation or logging where appropriate
- Narrow, reviewable scope

---

## AI-specific guardrails

Agents MUST NOT:
- Invent domain knowledge
- Add new product features without request
- Assume future modes or users
- Optimise prematurely

Agents SHOULD:
- Make reasoning explicit in comments
- Prefer deterministic logic
- Ask for clarification when intent is unclear

---

## Rollback notes

For any prod-affecting change, document:
- What to revert
- Configuration to restore
- Any data cleanup required

---

## Data and configuration hygiene

- No secrets in the repo
- Config documented separately
- Prefer mocks/emulators for local dev
- Data sources must be documented with attribution and update cadence

---

## Change summary template

- Scope:
- Tests:
- Risk / Rollback:
