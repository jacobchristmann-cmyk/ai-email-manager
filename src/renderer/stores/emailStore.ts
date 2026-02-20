import { create } from 'zustand'
import type { ActionItem, Email, EmailBodyUpdate, EmailSearchParams, EmailSend, FollowUp, SyncStatus } from '../../shared/types'

const URGENT_RE = /urgent|wichtig|frist|dringend|asap|sofort|deadline|heute|today|action required|handlungsbedarf/i

function computePriorityScore(email: Email): number {
  let score = 50

  // Category signals
  if (email.categoryId === 'cat-wichtig') score += 30
  if (email.categoryId === 'cat-newsletter') score -= 40
  if (email.categoryId === 'cat-spam') score -= 50
  if (email.categoryId === 'cat-social') score -= 20

  // Newsletter header = bulk mail
  if (email.listUnsubscribe) score -= 30

  // Engagement signals
  if (!email.isRead) score += 10
  if (email.isStarred) score += 20
  if (email.actionItems.length > 0) score += 15

  // Urgency keywords in subject
  if (URGENT_RE.test(email.subject)) score += 20

  // Recency bonus/penalty
  const ageHours = (Date.now() - new Date(email.date).getTime()) / 3_600_000
  if (ageHours < 24) score += 10
  else if (ageHours > 168) score -= 10 // older than 1 week

  return Math.max(0, Math.min(100, score))
}

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
  composeEmailId: string | null
  isSending: boolean
  isBodyLoading: boolean

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
  openCompose: (prefill?: Partial<EmailSend>, emailId?: string) => void
  closeCompose: () => void
  sendEmail: (data: EmailSend) => Promise<boolean>
  // Star
  toggleStar: (id: string) => void
  // Bulk
  selectedIds: Set<string>
  toggleSelectEmail: (id: string) => void
  selectAllVisible: (ids: string[]) => void
  clearSelection: () => void
  bulkMarkRead: () => Promise<void>
  bulkMarkUnread: () => Promise<void>
  bulkDelete: () => Promise<void>
  // Body push updates
  refreshEmailBodies: (updates: EmailBodyUpdate[]) => void
  // Snooze
  snoozedEmails: Email[]
  isDetectingActions: boolean
  snoozeEmail: (id: string, until: string) => Promise<void>
  unsnoozeEmail: (id: string) => Promise<void>
  loadSnoozedEmails: () => Promise<void>
  detectActions: (id: string) => Promise<ActionItem[]>
  handleSnoozeWakeup: (ids: string[]) => void
  // Follow-up
  followUps: FollowUp[]
  loadFollowUps: () => Promise<void>
  setFollowUp: (emailId: string, accountId: string, messageId: string, subject: string, remindAt: string) => Promise<void>
  dismissFollowUp: (id: string) => Promise<void>
  handleFollowupDue: (ids: string[]) => void
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
  composeEmailId: null,
  isSending: false,
  isBodyLoading: false,
  selectedIds: new Set<string>(),
  snoozedEmails: [],
  isDetectingActions: false,
  followUps: [],

  loadEmails: async (accountId?, mailbox?) => {
    set({ isLoading: true })
    const id = accountId ?? get().selectedAccountId ?? undefined
    const mb = mailbox ?? get().selectedMailbox ?? undefined
    const result = await window.electronAPI.emailList(id, mb)
    if (result.success) {
      const emails = result.data!
      const unreadCount = emails.filter((e) => !e.isRead).length
      set({ emails, unreadCount, isLoading: false })
      // Trigger background prefetch for accounts that have emails without cached bodies
      const accountsNeedingPrefetch = [...new Set(emails.filter((e) => !e.hasBody).map((e) => e.accountId))]
      for (const aid of accountsNeedingPrefetch) {
        window.electronAPI.syncPrefetchBodies(aid).catch(() => {})
      }
    } else {
      set({ isLoading: false })
    }
  },

  selectEmail: async (id) => {
    set({ selectedEmailId: id, isBodyLoading: false })
    if (id) {
      const email = get().emails.find((e) => e.id === id)
      if (email && !email.isRead) {
        window.electronAPI.emailMarkRead(id)
        set((state) => ({
          emails: state.emails.map((e) => (e.id === id ? { ...e, isRead: true } : e)),
          unreadCount: Math.max(0, state.unreadCount - 1)
        }))
      }
      // Always fetch full email: ~5ms from DB if body is cached, IMAP fetch if not.
      // Pool connection is reused so subsequent clicks are near-instant.
      set({ isBodyLoading: true })
      try {
        const result = await window.electronAPI.emailGet(id)
        if (result.success && result.data && get().selectedEmailId === id) {
          set((state) => ({
            emails: state.emails.map((e) => (e.id === id ? { ...e, ...result.data!, hasBody: true } : e)),
            snoozedEmails: state.snoozedEmails.map((e) => (e.id === id ? { ...e, ...result.data!, hasBody: true } : e))
          }))
          // Auto-detect actions if body is available and not yet cached
          const updated = get().emails.find((e) => e.id === id)
          if (updated?.hasBody && updated.actionItems.length === 0) {
            get().detectActions(id)
          }
        }
      } finally {
        if (get().selectedEmailId === id) set({ isBodyLoading: false })
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
    set((state) => {
      const unreadInMailbox = state.emails.filter(
        (e) => e.accountId === accountId && e.mailbox === mailbox && !e.isRead
      ).length
      return {
        emails: state.emails.map((e) =>
          e.accountId === accountId && e.mailbox === mailbox ? { ...e, isRead: true } : e
        ),
        unreadCount: Math.max(0, state.unreadCount - unreadInMailbox)
      }
    })
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
    if (mailbox === '__snoozed__') {
      get().loadSnoozedEmails()
    } else if (mailbox === '__followup__') {
      get().loadFollowUps()
    } else if (mailbox === '__priority__') {
      // Priority view uses already-loaded emails — just reload all
      const accountId = get().selectedAccountId ?? undefined
      get().loadEmails(accountId, undefined)
    } else {
      const accountId = get().selectedAccountId ?? undefined
      get().loadEmails(accountId, mailbox ?? undefined)
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  setSelectedCategoryId: (id) => {
    set({ selectedCategoryId: id })
  },

  filteredEmails: () => {
    const { emails, searchQuery, selectedCategoryId, aiSearchResults, selectedMailbox, snoozedEmails, followUps } = get()
    if (selectedMailbox === '__snoozed__') return snoozedEmails
    if (selectedMailbox === '__followup__') {
      const followupEmailIds = new Set(followUps.filter((f) => f.status === 'pending').map((f) => f.emailId))
      return emails.filter((e) => followupEmailIds.has(e.id))
    }
    if (selectedMailbox === '__priority__') {
      return [...emails]
        .map((e) => ({ email: e, score: computePriorityScore(e) }))
        .filter(({ score }) => score >= 40) // cut off obvious junk
        .sort((a, b) => b.score - a.score)
        .slice(0, 100)
        .map(({ email }) => email)
    }
    let filtered = emails

    if (selectedCategoryId) {
      filtered = filtered.filter((e) => e.categoryId === selectedCategoryId)
    }

    // If AI search results are active, filter and sort by AI relevance
    if (aiSearchResults) {
      const idSet = new Set(aiSearchResults)
      filtered = filtered.filter((e) => idSet.has(e.id))
      // Sort by AI relevance order — O(n log n) with Map lookup instead of O(n² log n)
      const rankMap = new Map(aiSearchResults.map((id, i) => [id, i]))
      filtered.sort((a, b) => (rankMap.get(a.id) ?? 0) - (rankMap.get(b.id) ?? 0))
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
  openCompose: (prefill, emailId) => {
    set({ composeOpen: true, composeData: prefill || null, composeEmailId: emailId || null })
  },

  closeCompose: () => {
    set({ composeOpen: false, composeData: null, composeEmailId: null })
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
  },

  toggleStar: (id) => {
    const email = get().emails.find((e) => e.id === id)
    if (!email) return
    const newVal = !email.isStarred
    set((state) => ({ emails: state.emails.map((e) => e.id === id ? { ...e, isStarred: newVal } : e) }))
    if (newVal) window.electronAPI.emailStar(id).catch(() => {})
    else window.electronAPI.emailUnstar(id).catch(() => {})
  },

  toggleSelectEmail: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    })
  },

  selectAllVisible: (ids) => {
    set({ selectedIds: new Set(ids) })
  },

  clearSelection: () => {
    set({ selectedIds: new Set() })
  },

  bulkMarkRead: async () => {
    const ids = [...get().selectedIds]
    if (ids.length === 0) return
    await window.electronAPI.emailBulkMarkRead(ids)
    const idSet = new Set(ids)
    set((state) => {
      const newlyRead = state.emails.filter((e) => idSet.has(e.id) && !e.isRead).length
      return {
        emails: state.emails.map((e) => idSet.has(e.id) ? { ...e, isRead: true } : e),
        unreadCount: Math.max(0, state.unreadCount - newlyRead),
        selectedIds: new Set()
      }
    })
  },

  bulkMarkUnread: async () => {
    const ids = [...get().selectedIds]
    if (ids.length === 0) return
    await window.electronAPI.emailBulkMarkUnread(ids)
    const idSet = new Set(ids)
    const wasReadCount = get().emails.filter((e) => idSet.has(e.id) && e.isRead).length
    set((state) => ({
      emails: state.emails.map((e) => idSet.has(e.id) ? { ...e, isRead: false } : e),
      unreadCount: state.unreadCount + wasReadCount,
      selectedIds: new Set()
    }))
  },

  bulkDelete: async () => {
    const ids = [...get().selectedIds]
    if (ids.length === 0) return
    await window.electronAPI.emailBulkDelete(ids)
    const idSet = new Set(ids)
    set((state) => {
      const deletedUnread = state.emails.filter((e) => idSet.has(e.id) && !e.isRead).length
      return {
        emails: state.emails.filter((e) => !idSet.has(e.id)),
        selectedEmailId: idSet.has(state.selectedEmailId ?? '') ? null : state.selectedEmailId,
        unreadCount: Math.max(0, state.unreadCount - deletedUnread),
        selectedIds: new Set()
      }
    })
  },

  refreshEmailBodies: (updates) => {
    const updateMap = new Map(updates.map((u) => [u.id, u]))
    set((state) => ({
      emails: state.emails.map((e) => {
        const update = updateMap.get(e.id)
        if (!update) return e
        return { ...e, body: update.body, bodyHtml: update.bodyHtml, hasBody: true }
      })
    }))
  },

  snoozeEmail: async (id, until) => {
    await window.electronAPI.emailSnooze(id, until)
    set((state) => ({
      emails: state.emails.filter((e) => e.id !== id),
      selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId
    }))
  },

  unsnoozeEmail: async (id) => {
    await window.electronAPI.emailUnsnooze(id)
    set((state) => ({ snoozedEmails: state.snoozedEmails.filter((e) => e.id !== id) }))
    get().loadEmails(get().selectedAccountId ?? undefined, get().selectedMailbox ?? undefined)
  },

  loadSnoozedEmails: async () => {
    const result = await window.electronAPI.emailListSnoozed()
    if (result.success) set({ snoozedEmails: result.data! })
  },

  detectActions: async (id) => {
    set({ isDetectingActions: true })
    const result = await window.electronAPI.emailDetectActions(id)
    if (result.success && result.data) {
      const items = result.data
      set((state) => ({
        emails: state.emails.map((e) => (e.id === id ? { ...e, actionItems: items } : e))
      }))
      set({ isDetectingActions: false })
      return items
    }
    set({ isDetectingActions: false })
    return []
  },

  handleSnoozeWakeup: (ids) => {
    set((state) => ({ snoozedEmails: state.snoozedEmails.filter((e) => !ids.includes(e.id)) }))
    get().loadEmails(get().selectedAccountId ?? undefined, get().selectedMailbox ?? undefined)
  },

  // Follow-up
  loadFollowUps: async () => {
    const result = await window.electronAPI.followupList()
    if (result.success) set({ followUps: result.data! })
  },

  setFollowUp: async (emailId, accountId, messageId, subject, remindAt) => {
    const result = await window.electronAPI.followupSet(emailId, accountId, messageId, subject, remindAt)
    if (result.success) {
      set((state) => {
        const without = state.followUps.filter((f) => f.emailId !== emailId)
        return { followUps: [...without, result.data!] }
      })
    }
  },

  dismissFollowUp: async (id) => {
    await window.electronAPI.followupDismiss(id)
    set((state) => ({ followUps: state.followUps.filter((f) => f.id !== id) }))
  },

  handleFollowupDue: (ids) => {
    // fired follow-ups are removed from the pending list
    set((state) => ({ followUps: state.followUps.filter((f) => !ids.includes(f.id)) }))
  }
}))
