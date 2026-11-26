# Prompt log

The Hub's Quest rules say that any project built with an AI coding agent must include the full prompt chain and the agent's response to each prompt. This folder is that record.

- **Agent:** Claude Code (Anthropic), model Claude Opus 5.5
- **Format:** one file per prompt, numbered in the order it was sent. Each file has the prompt exactly as typed and the agent's response.
- **Redactions:** personal details (email addresses, local usernames in paths) are replaced with `[redacted]`. Nothing else is edited.

| # | Prompt | File |
|---|---|---|
| 001 | Read the rules, write an implementation plan, set up .gitignore | [001-implementation-plan.md](001-implementation-plan.md) |
