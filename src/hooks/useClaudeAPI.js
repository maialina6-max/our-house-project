import { useState } from 'react'
import { buildSystemPrompt } from '../utils/buildSystemPrompt'
import { apiGetDocumentContent } from './useAPI'

export function useClaudeAPI(apiKey) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function sendMessage(messages, documents, expenses) {
    setIsLoading(true)
    setError(null)

    try {
      const lastUserText = messages[messages.length - 1].content
      const content = []

      // Fetch each document's file content from the local server and forward to Claude
      for (const doc of documents) {
        try {
          const { base64, type } = await apiGetDocumentContent(doc.id)
          if (type === 'application/pdf') {
            content.push({
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              title: doc.file_name,
              citations: { enabled: false },
            })
          } else if (type.startsWith('image/')) {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: type, data: base64 },
            })
          }
        } catch {
          // Skip documents that can't be fetched rather than aborting the whole request
        }
      }

      content.push({ type: 'text', text: lastUserText })

      // Prior turns as plain text; current turn includes document content
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
          system: buildSystemPrompt(expenses, documents),
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
