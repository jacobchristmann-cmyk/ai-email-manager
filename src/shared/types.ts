// === IPC Result Wrapper ===

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}

// === Sync Status ===

export interface SyncStatus {
  accountId: string
  status: 'syncing' | 'done' | 'error'
  message: string
  progress?: {
    current: number
    total: number
    mailbox: string
  }
}

// === Account ===

export interface Account {
  id: string
  name: string
  email: string
  provider: 'gmail' | 'outlook' | 'imap'
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  username: string
  password: string
  createdAt: string
  lastSyncAt: string | null
}

export interface AccountCreate {
  name: string
  email: string
  provider: 'gmail' | 'outlook' | 'imap'
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  username: string
  password: string
}

// === Mailbox ===

export interface Mailbox {
  name: string
  path: string
  specialUse?: string
}

// === Attachment ===

export interface Attachment {
  filename: string
  contentType: string
  size: number
  tempPath?: string  // local temp file path after body fetch
}

// === Email ===

export interface Email {
  id: string
  accountId: string
  messageId: string
  uid: number
  mailbox: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  bodyHtml: string | null
  listUnsubscribe: string | null
  listUnsubscribePost: string | null
  isRead: boolean
  isStarred: boolean
  categoryId: string | null
  hasBody: boolean
  hasAttachments: boolean
  attachments: Attachment[]
  inReplyTo: string | null
  threadId: string | null
}

export interface EmailBodyUpdate {
  id: string
  body: string
  bodyHtml: string | null
}

export interface EmailSearchParams {
  query?: string
  from?: string
  to?: string
  subject?: string
  dateFrom?: string
  dateTo?: string
  isRead?: boolean
  categoryId?: string
  accountId?: string
  mailbox?: string
  limit?: number
}

export interface EmailSend {
  accountId: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  attachments?: { filename: string; path: string }[]
}

// === Category ===

export interface Category {
  id: string
  name: string
  color: string
  description: string
}

export interface CategoryCreate {
  name: string
  color: string
  description: string
}

// === Unsubscribe Log ===

export interface UnsubscribeLog {
  id: string
  emailId: string
  sender: string
  method: 'post' | 'browser'
  status: 'confirmed' | 'pending' | 'failed'
  url?: string
  createdAt: string
  confirmedAt?: string
}

// === Chat Message ===

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// === Briefing ===

export interface BriefingItem {
  emailId: string
  subject: string
  from: string
  mailbox: string
  category: 'important' | 'deadline' | 'newsletter' | 'other'
  summary: string
  deadline?: string
}

export interface Briefing {
  totalUnread: number
  items: BriefingItem[]
  overview: string
}

// === Smart Reply ===

export interface SmartReplyResult {
  shortReplies: string[]
  fullReply: string
}

// === Settings ===

export interface AppSettings {
  aiProvider: string
  aiApiKey: string
  aiModel: string
  syncInterval: string
  theme: string
}

// === Electron API (exposed via preload) ===

export interface ElectronAPI {
  ping: () => Promise<string>
  // Account methods
  accountAdd: (account: AccountCreate) => Promise<IpcResult<Account>>
  accountList: () => Promise<IpcResult<Account[]>>
  accountGet: (id: string) => Promise<IpcResult<Account>>
  accountUpdate: (id: string, data: Partial<AccountCreate>) => Promise<IpcResult<Account>>
  accountDelete: (id: string) => Promise<IpcResult<void>>
  accountTestConnection: (config: AccountCreate) => Promise<IpcResult<void>>
  // Mailbox methods
  mailboxList: (accountId: string) => Promise<IpcResult<Mailbox[]>>
  mailboxCreate: (accountId: string, path: string) => Promise<IpcResult<void>>
  mailboxUnreadCounts: (accountId: string) => Promise<IpcResult<Record<string, number>>>
  // Email methods
  emailList: (accountId?: string, mailbox?: string) => Promise<IpcResult<Email[]>>
  emailGet: (id: string) => Promise<IpcResult<Email>>
  emailMarkRead: (id: string) => Promise<IpcResult<void>>
  emailMarkUnread: (id: string) => Promise<IpcResult<void>>
  emailSend: (data: EmailSend) => Promise<IpcResult<void>>
  emailDelete: (id: string) => Promise<IpcResult<void>>
  emailUnsubscribe: (emailId: string) => Promise<IpcResult<{ method: 'post' | 'browser'; logId: string; status: 'confirmed' | 'pending' }>>
  emailSearch: (params: EmailSearchParams) => Promise<IpcResult<Email[]>>
  emailMarkAllRead: (accountId: string, mailbox: string) => Promise<IpcResult<number>>
  emailMove: (emailId: string, targetMailbox: string) => Promise<IpcResult<void>>
  emailStar: (id: string) => Promise<IpcResult<void>>
  emailUnstar: (id: string) => Promise<IpcResult<void>>
  emailOpenAttachment: (emailId: string, filename: string) => Promise<IpcResult<void>>
  emailContactSuggest: (query: string) => Promise<IpcResult<string[]>>
  emailBulkMarkRead: (ids: string[]) => Promise<IpcResult<void>>
  emailBulkMarkUnread: (ids: string[]) => Promise<IpcResult<void>>
  emailBulkDelete: (ids: string[]) => Promise<IpcResult<void>>
  dialogOpenFile: () => Promise<IpcResult<{ filename: string; path: string }[]>>
  // Sync methods
  syncAccount: (accountId: string) => Promise<IpcResult<void>>
  syncAll: () => Promise<IpcResult<void>>
  syncFullResync: (accountId: string) => Promise<IpcResult<void>>
  onSyncStatus: (callback: (status: SyncStatus) => void) => () => void
  onEmailBodyReady: (callback: (updates: EmailBodyUpdate[]) => void) => () => void
  // Settings methods
  settingsGet: () => Promise<IpcResult<Record<string, string>>>
  settingsSet: (settings: Record<string, string>) => Promise<IpcResult<void>>
  // Category methods
  categoryList: () => Promise<IpcResult<Category[]>>
  categoryGet: (id: string) => Promise<IpcResult<Category>>
  categoryAdd: (data: CategoryCreate) => Promise<IpcResult<Category>>
  categoryUpdate: (id: string, data: Partial<CategoryCreate>) => Promise<IpcResult<Category>>
  categoryDelete: (id: string) => Promise<IpcResult<void>>
  // AI classification
  emailClassify: (emailIds: string[]) => Promise<IpcResult<Record<string, string>>>
  emailClassifyAll: () => Promise<IpcResult<Record<string, string>>>
  emailSetCategory: (emailId: string, categoryId: string | null) => Promise<IpcResult<void>>
  // AI search
  emailAiSearch: (params: { query: string; accountId?: string; mailbox?: string }) => Promise<IpcResult<string[]>>
  // AI smart reply
  emailSmartReply: (emailId: string, language: string) => Promise<IpcResult<SmartReplyResult>>
  // Unsubscribe tracking
  unsubscribeConfirm: (logId: string) => Promise<IpcResult<void>>
  unsubscribeList: () => Promise<IpcResult<UnsubscribeLog[]>>
  // Google OAuth
  googleLogin: () => Promise<IpcResult<void>>
  googleLogout: () => Promise<IpcResult<void>>
  googleStatus: () => Promise<IpcResult<{ isConnected: boolean }>>
  // AI models
  aiDefaultModels: (provider: string) => Promise<IpcResult<{ id: string; name: string }[]>>
  aiListModels: (params: { provider: string; apiKey?: string }) => Promise<IpcResult<{ id: string; name: string }[]>>
  // AI assistant
  aiAssistantAnalyze: (accountId?: string, mailbox?: string) => Promise<IpcResult<string>>
  aiAssistantAnalyzeEmail: (emailId: string) => Promise<IpcResult<string>>
  aiAssistantChat: (params: { messages: ChatMessage[]; accountId?: string; mailbox?: string; focusedEmailId?: string }) => Promise<IpcResult<string>>
  aiAssistantBriefing: () => Promise<IpcResult<Briefing>>
  // Sync prefetch
  syncPrefetchBodies: (accountId: string) => Promise<IpcResult<void>>
  // Shell
  shellOpenExternal: (url: string) => Promise<void>
  aiOllamaPing: (url: string) => Promise<IpcResult<boolean>>
  // Lifecycle
  notifyReady: () => void
}

// === IPC Channel Types ===

export type IpcChannels =
  | 'ping'
  | 'account:add'
  | 'account:list'
  | 'account:get'
  | 'account:update'
  | 'account:delete'
  | 'account:test-connection'
  | 'mailbox:list'
  | 'mailbox:unread-counts'
  | 'email:list'
  | 'email:get'
  | 'email:mark-read'
  | 'email:mark-unread'
  | 'email:send'
  | 'email:delete'
  | 'email:unsubscribe'
  | 'email:search'
  | 'email:mark-all-read'
  | 'email:move'
  | 'mailbox:create'
  | 'unsubscribe:confirm'
  | 'unsubscribe:list'
  | 'sync:account'
  | 'sync:all'
  | 'sync:full-resync'
  | 'sync:prefetch-bodies'
  | 'sync:status'
  | 'email:body-ready'
  | 'settings:get'
  | 'settings:set'
  | 'category:list'
  | 'category:get'
  | 'category:add'
  | 'category:update'
  | 'category:delete'
  | 'email:classify'
  | 'email:classify-all'
  | 'email:set-category'
  | 'email:ai-search'
  | 'email:smart-reply'
  | 'auth:google-login'
  | 'auth:google-logout'
  | 'auth:google-status'
  | 'ai:default-models'
  | 'ai:list-models'
  | 'ai:assistant-analyze'
  | 'ai:assistant-analyze-email'
  | 'ai:assistant-chat'
  | 'ai:assistant-briefing'

// === Window augmentation ===

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
