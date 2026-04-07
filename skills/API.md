---
# API.md — Claude API Integration
---

## Purpose
Describes how the app calls the Claude API, how context (expenses, documents) is structured, and what decisions were made around message formatting and token efficiency.

---

## Entry Points

| File | Role |
|------|------|
| `src/hooks/useClaudeAPI.js` | Fetch logic, loading/error state |
| `src/utils/buildSystemPrompt.js` | Constructs Hebrew system prompt with expense data |
| `src/components/Chat.jsx` | Calls `sendMessage`, manages conversation state |

---

## API Call Structure

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: <user's key from localStorage>
  anthropic-version: 2023-06-01
  anthropic-dangerous-allow-browser: true
  content-type: application/json

Body:
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  system: <Hebrew system prompt with expenses>,
  messages: [
    // Prior turns as plain text:
    { role: "user", content: "שאלה קודמת" },
    { role: "assistant", content: "תשובה קודמת" },
    // Current turn with documents:
    {
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: "..." }, title: "filename.pdf", citations: { enabled: false } },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "..." } },
        { type: "text", text: "שאלת המשתמש" }
      ]
    }
  ]
}
```

---

## System Prompt (`buildSystemPrompt.js`)

The system prompt is built dynamically on each API call and contains:
1. Role description in Hebrew ("you are a personal assistant for a house-building project...")
2. Full expense log as a formatted table (date | description | amount | category)
3. Category breakdown summary (category: total)
4. Grand total
5. Instructions: answer in Hebrew, recommend professionals, be clear when you don't know

This ensures Claude always has fresh expense data without requiring any conversation history replay.

---

## Document Injection Strategy

Documents are injected **only into the current user turn**, not into prior turns. This is the critical token-efficiency decision:

- **Without this**: N documents × M conversation turns = O(N×M) tokens per request. A user with 5 PDFs and 20 messages would resend all 5 PDFs 20 times.
- **With this**: N documents × 1 = O(N) tokens per request, regardless of conversation length.

The trade-off: if the user asks a follow-up question ("what did you mean by X?"), Claude can still answer from its response in the conversation history. Only the *raw document content* is not re-sent.

---

## How to Extend

- **Streaming responses**: Replace the `await fetch(...)` call with a streaming fetch and parse SSE chunks. Update message content progressively with `setMessages`.
- **Model selection**: Add a settings UI to let the user pick the model. Store in `localStorage['bayit_model']`. Default remains `claude-sonnet-4-20250514`.
- **Rate limit handling**: Check `response.status === 429` and show a "too many requests, wait a moment" message in Hebrew.
- **Token usage display**: The API response includes `usage.input_tokens` and `usage.output_tokens`. Display these in the chat for transparency.

---

## Gotchas

- `anthropic-dangerous-allow-browser: true` is required because browsers block direct API calls to Anthropic. Remove this header if you move API calls to a backend.
- The Vite dev proxy (`/api/claude` → `https://api.anthropic.com/v1/messages`) is configured but the current code calls `https://api.anthropic.com/v1/messages` directly with the browser header. The proxy is available as an alternative for environments where the dangerous-allow-browser header is not desired.
- Claude's `document` content block only supports `application/pdf`. Other file types (Word, Excel) cannot be injected as documents — only as images if they can be converted, or as extracted text.
- The `citations: { enabled: false }` field on document blocks disables citation markers in the response, keeping answers clean for a chat UI.
