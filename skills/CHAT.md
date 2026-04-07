---
# CHAT.md — AI Chat Component
---

## Purpose
Enables the user to ask natural language questions about the project. The Claude API answers using:
1. A Hebrew system prompt containing all expense data and a project description.
2. Documents (PDFs and images) attached to the current user message as multimodal content blocks.

---

## Key Decisions

### Documents injected per-message, not in history
Documents are attached only to the **current user turn** (`messages[messages.length - 1]`), not in every prior turn. This prevents token explosion: if a user has 5 PDFs and asks 20 questions, injecting documents into all 20 turns would multiply token usage 100x.

Prior conversation turns are sent as plain text `{ role, content }` objects.

### Direct browser fetch with `anthropic-dangerous-allow-browser: true`
No backend proxy. The API key is in `localStorage` and sent in the `x-api-key` header directly from the browser. This is acceptable for a personal household tool. For a public-facing app, move API calls server-side.

### System prompt built dynamically
`buildSystemPrompt(expenses)` is called fresh on each request, so it always reflects the latest expense data without requiring a page reload.

### Session-only messages
Chat history is `useState` (not `useLocalStorage`). Conversations are not persisted across page loads. This is intentional: conversations are exploratory, not archival.

---

## How to Extend

- **Persist chat history**: Move `messages` to `useLocalStorage('bayit_chat', [])`.
- **Stream responses**: Replace `fetch` with a streaming-capable wrapper and update message content progressively.
- **Add document context summaries**: Pre-summarize documents server-side and include summaries in the system prompt instead of full base64 content.
- **Add new quick question chips**: Add strings to the `QUICK_QUESTIONS` array in `Chat.jsx`.

---

## Gotchas

- The Claude `document` content block type only supports `application/pdf`. Non-PDF files use the `image` content block — only common image MIME types are supported (`image/jpeg`, `image/png`, `image/gif`, `image/webp`).
- Very large documents (>5MB base64) may cause slow API responses or hit Claude's context window limit.
- If `apiKey` is empty, the chat input and send button are disabled and a warning banner is shown.
- The `anthropic-dangerous-allow-browser: true` header suppresses Anthropic's client-side check. Never use this in a public app.
