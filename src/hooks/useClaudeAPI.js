import { useState } from 'react'
import { buildSystemPrompt } from '../utils/buildSystemPrompt'

export function useClaudeAPI(apiKey) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function sendMessage(messages, documents, expenses) {
    setIsLoading(true)
    setError(null)

    try {
      // Build content array for the last user message
      // Documents injected only into the current turn (not history) to avoid token explosion
      const lastUserText = messages[messages.length - 1].content
      const content = []

      for (const doc of documents) {
        if (doc.type === 'application/pdf') {
          content.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: doc.data },
            title: doc.name,
            citations: { enabled: false },
          })
        } else if (doc.type.startsWith('image/')) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: doc.type, data: doc.data },
          })
        }
      }

      content.push({ type: 'text', text: lastUserText })

      // Build message history: all prior turns as plain text, current turn with documents
      const apiMessages = messages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }))
      apiMessages.push({ role: 'user', content })

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: buildSystemPrompt(expenses),
          messages: apiMessages,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: response.statusText } }))
        throw new Error(err?.error?.message || `שגיאה ${response.status}`)
      }

      const data = await response.json()
      return data.content?.[0]?.text ?? ''
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { sendMessage, isLoading, error }
}
