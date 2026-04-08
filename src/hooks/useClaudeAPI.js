import { useState } from 'react'
import { buildSystemPrompt } from '../utils/buildSystemPrompt'
import { apiChat } from './useAPI'

export function useClaudeAPI(apiKey) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function sendMessage(messages, documents, expenses) {
    setIsLoading(true)
    setError(null)

    try {
      const systemPrompt = buildSystemPrompt(expenses, documents)
      const docIds = documents.map((d) => d.id)
      const { answer } = await apiChat(messages, systemPrompt, docIds, apiKey)
      return answer
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { sendMessage, isLoading, error }
}
