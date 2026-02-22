# Agentic Development Protocol — whichFly

This document defines how agentic AI tools (Codex, Copilot, etc.) are used
to develop **whichFly** safely, incrementally, and in alignment with product intent.

whichFly is an **LLM-first product with strict guardrails**.
User trust is a non-negotiable requirement.

---

## Goals

- Keep changes small, reviewable, and reversible.
- Preserve product intent and MVP scope.
- Ensure all AI-generated behaviour is **machine-validated**.
- Prevent hallucinations, silent scope creep, and fragile logic.
- Make failures safe and recoverable.

---

## Sources of truth (mandatory)

Before implementing any non-trivial change, agents MUST read and respect:

### Product & architecture
- `PRODUCT.md`
- `MVP.md`
- `ARCHITECTURE.md`
- `AI_AGENT.md`
- `DATA.md`

### LLM contracts & guardrails
- `contracts/right_now.schema.json`
- `docs/FLY_ALLOWLIST.md`
- `docs/LLM_GUARDRAILS_TESTS.md`
- `docs/LLM_AGENT_PROMPT.md`

If a proposed change conflicts with any of these, the agent must stop and flag it.

---

## Core principles for agentic development

1. **Product intent beats clever code**
2. **Contracts over conventions**
3. **Guardrails before intelligence**
4. **One change at a time**
5. **Failure must be safe**

---

## Change discipline

- Prefer **small diffs with focused scope**
- Do NOT mix refactors with new features
- Avoid drive-by improvements
- Update documentation alongside code when behaviour changes
- Never introduce new product features implicitly

---

## Task workflow (per change)

For each task or change, the agent MUST:

1. **Restate scope and acceptance criteria**
2. **Implement the smallest viable change**
3. **Add or update tests if behaviour changes**
4. **Validate LLM behaviour against schema and guardrails**
5. **Record test commands and results**
6. **Summarise behaviour changes and risks**

No step may be skipped.

---

## Evidence requirements

Every change must explicitly report:

- Test commands executed
- Test results
- Any skipped tests and why
- Any assumptions or mocked data used

A change without evidence is considered incomplete.

---

## LLM-specific guardrails (non-negotiable)

### Output validation
- All LLM outputs MUST:
  - be JSON-only
  - validate against `contracts/right_now.schema.json`
- Invalid output triggers:
  - one retry with correction message
  - fallback on second failure

### Pattern safety
- All fly patterns MUST come from `docs/FLY_ALLOWLIST.md`
- Allowlist enforcement is controlled by `ALLOWLIST_ENFORCEMENT` (default off)
- When enforcement is enabled, any violation triggers retry → fallback
- When enforcement is disabled, the allowlist still applies to fallback/bias logic; the model is instructed to comply but is not guaranteed
- The allowlist is enforced in the backend, not passed as model input data

### Anti-hallucination rules
LLM outputs MUST NOT:
- Claim specific hatches are occurring
- Invent local facts, beats, or river sections
- Reference permits, access rights, or regulations
- Use brand names or commercial language

### Confidence handling
- The LLM MUST return a confidence level
- Low confidence must result in:
  - conservative recommendations
  - or explicit uncertainty in the UX

---

## Deterministic logic policy

- Deterministic logic is **NOT the primary engine**
- It is allowed ONLY as:
  - a fallback mechanism
  - a safety net
  - a test oracle
- Deterministic code must be simple, conservative, and well-tested

---

## High-risk change categories

The following changes require extra care, tests, and rollback clarity:

- LLM prompt changes
- Schema changes
- Allowlist changes
- Recommendation logic
- External API integration
- Anything affecting the “Right now” user flow

For these changes, agents MUST:
- Explain reasoning explicitly
- Add validation and logging where appropriate
- Keep the scope minimal

---

## Rollback notes (required for prod-affecting changes)

For any change that affects production behaviour, the agent MUST document:

- What files or commits to revert
- Any configuration to restore
- Any data cleanup steps required

If rollback is unclear, the change is not ready.

---

## Data and configuration hygiene

- No secrets in the repository
- Required configuration documented separately
- Prefer mocks or emulators for local development
- Avoid environment-specific logic in core code

---

## Change summary template (mandatory)

Every agent-generated change MUST include:

- **Scope:** what changed and why
- **Tests:** commands run and results
- **Risk / Rollback:** potential issues and how to revert

---

## Definition of success

Agentic development is successful when:

- Behaviour is predictable and testable
- LLM failures do not break user trust
- Changes remain understandable months later
- The product evolves without losing its core intent
