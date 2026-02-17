import { create } from 'zustand'
import type { ChatMessage } from '../../shared/types'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isAnalyzing: boolean
  analysis: string | null
  analysisError: string | null
  isOpen: boolean
  focusedEmailId: string | null
  focusedEmailSubject: string | null

  toggle: () => void
  open: () => void
  close: () => void
  analyzeUnread: (accountId?: string, mailbox?: string) => Promise<void>
  analyzeEmail: (emailId: string, subject: string) => Promise<void>
  sendMessage: (text: string, accountId?: string, mailbox?: string) => Promise<void>
  clearChat: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isAnalyzing: false,
  analysis: null,
  analysisError: null,
  isOpen: false,
  focusedEmailId: null,
  focusedEmailSubject: null,

  toggle: () => {
    const wasOpen = get().isOpen
    set({ isOpen: !wasOpen })
    if (!wasOpen) {
      get().analyzeUnread()
    }
  },

  open: () => {
    set({ isOpen: true })
    get().analyzeUnread()
  },

  close: () => set({ isOpen: false }),

  analyzeUnread: async (accountId?: string, mailbox?: string) => {
    set({ isAnalyzing: true, analysisError: null, focusedEmailId: null, focusedEmailSubject: null })
    try {
      const result = await window.electronAPI.aiAssistantAnalyze(accountId, mailbox)
      if (result.success && result.data) {
        set({ analysis: result.data })
      } else {
        set({ analysisError: result.error || 'Analyse fehlgeschlagen' })
      }
    } catch (err) {
      set({ analysisError: err instanceof Error ? err.message : 'Analyse fehlgeschlagen' })
    } finally {
      set({ isAnalyzing: false })
    }
  },

  analyzeEmail: async (emailId: string, subject: string) => {
    set({
      isOpen: true,
      isAnalyzing: true,
      analysisError: null,
      analysis: null,
      messages: [],
      focusedEmailId: emailId,
      focusedEmailSubject: subject
    })
    try {
      const result = await window.electronAPI.aiAssistantAnalyzeEmail(emailId)
      if (result.success && result.data) {
        set({ analysis: result.data })
      } else {
        set({ analysisError: result.error || 'Analyse fehlgeschlagen' })
      }
    } catch (err) {
      set({ analysisError: err instanceof Error ? err.message : 'Analyse fehlgeschlagen' })
    } finally {
      set({ isAnalyzing: false })
    }
  },

  sendMessage: async (text: string, accountId?: string, mailbox?: string) => {
    const userMessage: ChatMessage = { role: 'user', content: text }
    const currentMessages = [...get().messages, userMessage]
    set({ messages: currentMessages, isLoading: true })

    try {
      const result = await window.electronAPI.aiAssistantChat({
        messages: currentMessages,
        accountId,
        mailbox,
        focusedEmailId: get().focusedEmailId || undefined
      })
      if (result.success && result.data) {
        set({
          messages: [...currentMessages, { role: 'assistant', content: result.data }]
        })
      } else {
        set({
          messages: [
            ...currentMessages,
            { role: 'assistant', content: `Fehler: ${result.error || 'Unbekannter Fehler'}` }
          ]
        })
      }
    } catch (err) {
      set({
        messages: [
          ...currentMessages,
          {
            role: 'assistant',
            content: `Fehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
          }
        ]
      })
    } finally {
      set({ isLoading: false })
    }
  },

  clearChat: () => set({
    messages: [],
    analysis: null,
    analysisError: null,
    focusedEmailId: null,
    focusedEmailSubject: null
  })
}))
