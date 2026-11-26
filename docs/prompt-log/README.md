# Prompt log

The Hub's Quest rules say a project built with AI coding agents must include the full prompt chain and the agent's response to each prompt. This folder is that record.

- **Agent:** Claude Code (Anthropic)
- **How it's made:** `node scripts/export-prompt-log.mjs` reads the Claude Code session transcripts and writes one file per session. Each prompt appears exactly as typed, followed by the agent's written reply and a list of the actions it took (files written, commands run).
- **Redactions:** email addresses and the local user folder are replaced. Nothing else is changed.

| Session | Prompts |
|---|---|
| [session-2026-11-26-e00934c4](session-2026-11-26-e00934c4.md) | 5 |
