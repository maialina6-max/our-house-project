---
# API.md — OpenAI API Integration
---

## Purpose
Describes how the app calls the OpenAI API, how context (expenses, documents) is structured, and what decisions were made around message formatting and token efficiency.

---

## Provider & Model

| Setting | Value |
|---------|-------|
| Provider | OpenAI |
| Model | `gpt-4o-mini` |
| API key source | User enters in Settings modal → stored in `localStorage['bayit_api_key']` → passed in request body to the server |
| Server env var | `OPENAI_API_KEY` in `.env` (loaded via `node --env-file=.env server.js`) |

---

## Architecture: All AI calls go through the Express server

Unlike the previous Claude setup (which called the API directly from the browser), **all OpenAI calls happen server-side**. The browser never talks to OpenAI directly.

Reasons:
- OpenAI does not have a `dangerous-allow-browser` header equivalent
- Server already has access to files on disk, so PDF extraction and image reading happen naturally before the API call
- The API key is passed from browser → local Express server only (localhost traffic, not public)

---

## Entry Points

| File | Role |
|------|------|
| `src/hooks/useClaudeAPI.js` | Builds system prompt, calls `POST /api/chat`, manages loading/error state |
| `src/hooks/useAPI.js` | `apiChat()`, `apiAnalyzeDocument()`, `apiAskDocument()` |
| `src/utils/buildSystemPrompt.js` | Constructs Hebrew system prompt with expense + document metadata |
| `src/components/Chat.jsx` | Calls `sendMessage`, manages conversation state |
| `server.js` | `callOpenAI()` helper + `/api/chat`, `/api/documents/:id/analyze`, `/api/documents/:id/ask` routes |

---

## Server-side OpenAI helper

```js
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function callOpenAI(apiKey, messages, maxTokens = 1024) {
  const client = apiKey ? new OpenAI({ apiKey }) : openai
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: maxTokens,
    messages,
  })
  return completion.choices[0].message.content ?? ''
}
```

The per-request `apiKey` (from browser localStorage) overrides the server env default. This lets the user supply their own key via the Settings modal.

---

## Chat: POST /api/chat

```
Body: { messages, systemPrompt, documents: [id, ...], apiKey }

Server builds OpenAI messages array:
  [
    { role: 'system', content: systemPrompt },
    ...prior turns as { role, content: string }...,
    {
      role: 'user',
      content: [
        { type: 'text', text: '=== filename.pdf ===\n<extracted text>' },   // PDF
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }, // image
        { type: 'text', text: 'user question' }
      ]
    }
  ]

Response: { answer: string }
```

PDFs are text-extracted server-side with `pdf-parse` (PDFParse class, v2 API).
Images are sent as `image_url` base64 data URIs.

---

## System Prompt (`buildSystemPrompt.js`)

Built dynamically on each call with:
1. Role description in Hebrew
2. Full expense log as a formatted table
3. Category breakdown summary
4. Grand total
5. "=== מסמכים שהועלו ===" section with per-document: name, category, summary, parties, dates, obligations
6. Instructions: answer in Hebrew, recommend professionals, cite documents

---

## Document Analysis: POST /api/documents/:id/analyze

```
Header: x-api-key: <user's OpenAI key>

PDF  → extract text → single text message with ANALYSIS_PROMPT + text
Image → read as base64 → [text prompt] + [image_url block]

Response: { document, payment_request }
```

Returns rich JSON with: category, summary, parties, important_dates, obligations, lawyer_questions, has_payment_request, payment_request.

---

## Document Q&A: POST /api/documents/:id/ask

```
Body: { question, apiKey }

PDF  → extract text → [system] + [user: text + question]
Image → base64 → [system] + [user: image_url + question]

Response: { answer: string }
```

System prompt instructs Claude to answer only from this document, in Hebrew, citing the relevant section.

---

## Document Injection Strategy

Documents are injected **only into the current user turn**. Prior turns use plain text content. This keeps token usage at O(N documents) rather than O(N × M turns).

---

## Settings UI

- Label: "מפתח API של OpenAI"
- Placeholder: `sk-proj-...`
- Stored in `localStorage['bayit_api_key']`
- Passed as `apiKey` in the JSON body of all server API calls

---

## How to Extend

- **Model upgrade**: Change `'gpt-4o-mini'` to `'gpt-4o'` in `callOpenAI` for higher quality at higher cost.
- **Streaming**: Use `openai.chat.completions.stream()` on the server and pipe SSE chunks to the browser.
- **Rate limit handling**: Check for OpenAI error code `429` and show a Hebrew retry message.
- **Token usage**: `completion.usage.prompt_tokens` / `completion.usage.completion_tokens` are available in the server response.
