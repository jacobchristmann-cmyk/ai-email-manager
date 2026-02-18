import { create } from 'zustand'
import type { Email, EmailSearchParams, EmailSend, SyncStatus } from '../../shared/types'

interface EmailState {
  emails: Email[]
  selectedEmailId: string | null
  isLoading: boolean
  isSyncing: boolean
  syncMessage: string | null
  syncProgress: { current: number; total: number; mailbox: string } | null
  unreadCount: number
  // Filter & search
  selectedAccountId: string | null
  selectedMailbox: string | null
  searchQuery: string
  selectedCategoryId: string | null
  // Advanced search
  isAdvancedSearchOpen: boolean
  advancedSearchFilters: EmailSearchParams
  isAdvancedSearchActive: boolean
  searchResultCount: number | null
  // AI search
  aiSearchMode: boolean
  aiSearchResults: string[] | null
  isAiSearching: boolean
  aiSearchError: string | null
  // Compose
  composeOpen: boolean
  composeData: Partial<EmailSend> | null
  isSending: boolean

  loadEmails: (accountId?: string, mailbox?: string) => Promise<void>
  selectEmail: (id: string | null) => Promise<void>
  markRead: (id: string) => void
  markUnread: (id: string) => void
  markAllReadInMailbox: (accountId: string, mailbox: string) => Promise<void>
  deleteEmail: (id: string) => Promise<void>
  setEmailCategory: (emailId: string, categoryId: string | null) => Promise<void>
  syncAccount: (accountId: string) => Promise<void>
  syncAll: () => Promise<void>
  fullResync: (accountId: string) => Promise<void>
  handleSyncStatus: (status: SyncStatus) => void
  // Filter & search
  setSelectedAccountId: (id: string | null) => void
  setSelectedMailbox: (mailbox: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedCategoryId: (id: string | null) => void
  filteredEmails: () => Email[]
  // Advanced search
  toggleAdvancedSearch: () => void
  setAdvancedSearchFilters: (filters: Partial<EmailSearchParams>) => void
  executeAdvancedSearch: () => Promise<void>
  clearAdvancedSearch: () => void
  // AI search
  setAiSearchMode: (enabled: boolean) => void
  aiSearch: (query: string) => Promise<void>
  clearAiSearch: () => void
  // Compose
  moveEmail: (emailId: string, targetMailbox: string) => Promise<boolean>
  openCompose: (prefill?: Partial<EmailSend>) => void
  closeCompose: () => void
  sendEmail: (data: EmailSend) => Promise<boolean>
}

export const useEmailStore = create<EmailState>((set, get) => ({
  emails: [],
  selectedEmailId: null,
  isLoading: false,
  isSyncing: false,
  syncMessage: null,
  syncProgress: null,
  unreadCount: 0,
  selectedAccountId: null,
  selectedMailbox: null,
  searchQuery: '',
  selectedCategoryId: null,
  isAdvancedSearchOpen: false,
  advancedSearchFilters: {},
  isAdvancedSearchActive: false,
  searchResultCount: null,
  aiSearchMode: false,
  aiSearchResults: null,
  isAiSearching: false,
  aiSearchError: null,
  composeOpen: false,
  composeData: null,
  isSending: false,

  loadEmails: async (accountId?, mailbox?) => {
    set({ isLoading: true })
    const id = accountId ?? get().selectedAccountId ?? undefined
    const mb = mailbox ?? get().selectedMailbox ?? undefined
    const result = await window.electronAPI.emailList(id, mb)
    if (result.success) {
      const emails = result.data!
      const unreadCount = emails.filter((e) => !e.isRead).length
      set({ emails, unreadCount, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },

  selectEmail: async (id) => {
    set({ selectedEmailId: id })
    if (id) {
      const email = get().emails.find((e) => e.id === id)
      if (email && !email.isRead) {
        window.electronAPI.emailMarkRead(id)
        set((state) => ({
          emails: state.emails.map((e) => (e.id === id ? { ...e, isRead: true } : e)),
          unreadCount: Math.max(0, state.unreadCount - 1)
        }))
      }
      // Lazy-load body if not yet fetched
      if (email && !email.body) {
        const result = await window.electronAPI.emailGet(id)
        if (result.success && result.data && get().selectedEmailId === id) {
          set((state) => ({
            emails: state.emails.map((e) => (e.id === id ? { ...e, ...result.data! } : e))
          }))
        }
      }
    }
  },

  markRead: (id) => {
    window.electronAPI.emailMarkRead(id)
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, isRead: true } : e)),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }))
  },

  markUnread: (id) => {
    window.electronAPI.emailMarkUnread(id)
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, isRead: false } : e)),
      unreadCount: state.unreadCount + 1
    }))
  },

  markAllReadInMailbox: async (accountId, mailbox) => {
    await window.electronAPI.emailMarkAllRead(accountId, mailbox)
    set((state) => ({
      emails: state.emails.map((e) =>
        e.accountId === accountId && e.mailbox === mailbox ? { ...e, isRead: true } : e
      ),
      unreadCount: state.emails.filter(
        (e) => e.accountId === accountId && e.mailbox === mailbox && !e.isRead
      ).length > 0
        ? Math.max(0, state.unreadCount - state.emails.filter(
            (e) => e.accountId === accountId && e.mailbox === mailbox && !e.isRead
          ).length)
        : state.unreadCount
    }))
  },

  deleteEmail: async (id) => {
    await window.electronAPI.emailDelete(id)
    set((state) => {
      const email = state.emails.find((e) => e.id === id)
      const wasUnread = email && !email.isRead
      return {
        emails: state.emails.filter((e) => e.id !== id),
        selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId,
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      }
    })
  },

  setEmailCategory: async (emailId, categoryId) => {
    // Optimistic update — change UI immediately
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === emailId ? { ...e, categoryId } : e
      )
    }))
    // Persist to backend (fire-and-forget)
    window.electronAPI.emailSetCategory(emailId, categoryId).catch(() => {
      // If backend fails, revert
      set((state) => ({
        emails: state.emails.map((e) =>
          e.id === emailId ? { ...e, categoryId: null } : e
        )
      }))
    })
  },

  syncAccount: async (accountId) => {
    set({ isSyncing: true, syncMessage: 'Synchronisiere...' })
    await window.electronAPI.syncAccount(accountId)
  },

  syncAll: async () => {
    set({ isSyncing: true, syncMessage: 'Synchronisiere alle Konten...' })
    await window.electronAPI.syncAll()
  },

  fullResync: async (accountId) => {
    set({ isSyncing: true, syncMessage: 'Vollständiger Sync läuft...' })
    await window.electronAPI.syncFullResync(accountId)
  },

  handleSyncStatus: (status) => {
    if (status.status === 'syncing') {
      set({ isSyncing: true, syncMessage: status.message, syncProgress: status.progress ?? null })
    } else {
      set({ isSyncing: false, syncMessage: status.message, syncProgress: null })
      // Reload emails after sync completes, respecting account + mailbox filter
      const accountId = get().selectedAccountId ?? undefined
      const mailbox = get().selectedMailbox ?? undefined
      get().loadEmails(accountId, mailbox)
    }
  },

  // Filter & search
  setSelectedAccountId: (id) => {
    set({ selectedAccountId: id, selectedMailbox: null, selectedEmailId: null })
    get().loadEmails(id ?? undefined)
  },

  setSelectedMailbox: (mailbox) => {
    set({ selectedMailbox: mailbox, selectedEmailId: null })
    const accountId = get().selectedAccountId ?? undefined
    get().loadEmails(accountId, mailbox ?? undefined)
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  setSelectedCategoryId: (id) => {
    set({ selectedCategoryId: id })
  },

  filteredEmails: () => {
    const { emails, searchQuery, selectedCategoryId, aiSearchResults } = get()
    let filtered = emails

    if (selectedCategoryId) {
      filtered = filtered.filter((e) => e.categoryId === selectedCategoryId)
    }

    // If AI search results are active, filter and sort by AI relevance
    if (aiSearchResults) {
      const idSet = new Set(aiSearchResults)
      filtered = filtered.filter((e) => idSet.has(e.id))
      // Sort by AI relevance order
      filtered.sort((a, b) => aiSearchResults.indexOf(a.id) - aiSearchResults.indexOf(b.id))
      return filtered
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q)
      )
    }

    return filtered
  },

  // Advanced search
  toggleAdvancedSearch: () => {
    set((state) => ({ isAdvancedSearchOpen: !state.isAdvancedSearchOpen }))
  },

  setAdvancedSearchFilters: (filters) => {
    set((state) => ({
      advancedSearchFilters: { ...state.advancedSearchFilters, ...filters }
    }))
  },

  executeAdvancedSearch: async () => {
    const { advancedSearchFilters, selectedAccountId, selectedMailbox } = get()
    const params: EmailSearchParams = {
      ...advancedSearchFilters,
      accountId: advancedSearchFilters.accountId ?? selectedAccountId ?? undefined,
      mailbox: advancedSearchFilters.mailbox ?? selectedMailbox ?? undefined
    }
    set({ isLoading: true })
    const result = await window.electronAPI.emailSearch(params)
    if (result.success) {
      const emails = result.data!
      set({
        emails,
        unreadCount: emails.filter((e) => !e.isRead).length,
        isLoading: false,
        isAdvancedSearchActive: true,
        searchResultCount: emails.length,
        selectedEmailId: null
      })
    } else {
      set({ isLoading: false })
    }
  },

  clearAdvancedSearch: () => {
    set({
      advancedSearchFilters: {},
      isAdvancedSearchActive: false,
      searchResultCount: null,
      selectedEmailId: null
    })
    const accountId = get().selectedAccountId ?? undefined
    const mailbox = get().selectedMailbox ?? undefined
    get().loadEmails(accountId, mailbox)
  },

  // AI search
  setAiSearchMode: (enabled) => {
    set({ aiSearchMode: enabled, aiSearchResults: null, aiSearchError: null })
  },

  aiSearch: async (query) => {
    if (!query.trim()) return
    set({ isAiSearching: true, aiSearchError: null, aiSearchResults: null })
    const { selectedAccountId, selectedMailbox } = get()
    const result = await window.electronAPI.emailAiSearch({
      query,
      accountId: selectedAccountId ?? undefined,
      mailbox: selectedMailbox ?? undefined
    })
    if (result.success) {
      set({ aiSearchResults: result.data!, isAiSearching: false })
    } else {
      set({ aiSearchError: result.error ?? 'KI-Suche fehlgeschlagen', isAiSearching: false })
    }
  },

  clearAiSearch: () => {
    set({ aiSearchResults: null, aiSearchError: null })
  },

  moveEmail: async (emailId, targetMailbox) => {
    const result = await window.electronAPI.emailMove(emailId, targetMailbox)
    if (result.success) {
      set((state) => {
        const email = state.emails.find((e) => e.id === emailId)
        const wasUnread = email && !email.isRead
        return {
          emails: state.emails.filter((e) => e.id !== emailId),
          selectedEmailId: state.selectedEmailId === emailId ? null : state.selectedEmailId,
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        }
      })
      return true
    }
    return false
  },

  // Compose
  openCompose: (prefill) => {
    set({ composeOpen: true, composeData: prefill || null })
  },

  closeCompose: () => {
    set({ composeOpen: false, composeData: null })
  },

  sendEmail: async (data) => {
    set({ isSending: true })
    const result = await window.electronAPI.emailSend(data)
    set({ isSending: false })
    if (result.success) {
      set({ composeOpen: false, composeData: null })
      return true
    }
    return false
  }
}))
