import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/types'

const electronAPI: ElectronAPI = {
  ping: () => ipcRenderer.invoke('ping'),

  // Account methods
  accountAdd: (account) => ipcRenderer.invoke('account:add', account),
  accountList: () => ipcRenderer.invoke('account:list'),
  accountGet: (id) => ipcRenderer.invoke('account:get', id),
  accountUpdate: (id, data) => ipcRenderer.invoke('account:update', id, data),
  accountDelete: (id) => ipcRenderer.invoke('account:delete', id),
  accountTestConnection: (config) => ipcRenderer.invoke('account:test-connection', config),

  // Mailbox methods
  mailboxList: (accountId) => ipcRenderer.invoke('mailbox:list', accountId),

  mailboxCreate: (accountId, path) => ipcRenderer.invoke('mailbox:create', accountId, path),
  mailboxUnreadCounts: (accountId) => ipcRenderer.invoke('mailbox:unread-counts', accountId),

  // Email methods
  emailList: (accountId?, mailbox?) => ipcRenderer.invoke('email:list', accountId, mailbox),
  emailSearch: (params) => ipcRenderer.invoke('email:search', params),
  emailGet: (id) => ipcRenderer.invoke('email:get', id),
  emailMarkAllRead: (accountId, mailbox) => ipcRenderer.invoke('email:mark-all-read', accountId, mailbox),
  emailMarkRead: (id) => ipcRenderer.invoke('email:mark-read', id),
  emailMarkUnread: (id) => ipcRenderer.invoke('email:mark-unread', id),
  emailSend: (data) => ipcRenderer.invoke('email:send', data),
  emailDelete: (id) => ipcRenderer.invoke('email:delete', id),
  emailUnsubscribe: (emailId) => ipcRenderer.invoke('email:unsubscribe', emailId),
  emailMove: (emailId, targetMailbox) => ipcRenderer.invoke('email:move', emailId, targetMailbox),

  // Sync methods
  syncAccount: (accountId) => ipcRenderer.invoke('sync:account', accountId),
  syncAll: () => ipcRenderer.invoke('sync:all'),
  syncFullResync: (accountId) => ipcRenderer.invoke('sync:full-resync', accountId),
  onSyncStatus: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown): void => {
      callback(status as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('sync:status', handler)
    return () => {
      ipcRenderer.removeListener('sync:status', handler)
    }
  },

  onEmailBodyReady: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, updates: unknown): void => {
      callback(updates as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('email:body-ready', handler)
    return () => {
      ipcRenderer.removeListener('email:body-ready', handler)
    }
  },

  // Settings methods
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (settings) => ipcRenderer.invoke('settings:set', settings),

  // Category methods
  categoryList: () => ipcRenderer.invoke('category:list'),
  categoryGet: (id) => ipcRenderer.invoke('category:get', id),
  categoryAdd: (data) => ipcRenderer.invoke('category:add', data),
  categoryUpdate: (id, data) => ipcRenderer.invoke('category:update', id, data),
  categoryDelete: (id) => ipcRenderer.invoke('category:delete', id),

  // AI classification
  emailClassify: (emailIds) => ipcRenderer.invoke('email:classify', emailIds),
  emailClassifyAll: () => ipcRenderer.invoke('email:classify-all'),
  emailSetCategory: (emailId, categoryId) => ipcRenderer.invoke('email:set-category', emailId, categoryId),

  // Unsubscribe tracking
  unsubscribeConfirm: (logId) => ipcRenderer.invoke('unsubscribe:confirm', logId),
  unsubscribeList: () => ipcRenderer.invoke('unsubscribe:list'),

  // AI search
  emailAiSearch: (params) => ipcRenderer.invoke('email:ai-search', params),

  // AI smart reply
  emailSmartReply: (emailId, language) => ipcRenderer.invoke('email:smart-reply', emailId, language),

  // Google OAuth
  googleLogin: () => ipcRenderer.invoke('auth:google-login'),
  googleLogout: () => ipcRenderer.invoke('auth:google-logout'),
  googleStatus: () => ipcRenderer.invoke('auth:google-status'),

  // AI models
  aiDefaultModels: (provider) => ipcRenderer.invoke('ai:default-models', provider),
  aiListModels: (params) => ipcRenderer.invoke('ai:list-models', params),

  // AI assistant
  aiAssistantAnalyze: (accountId?, mailbox?) => ipcRenderer.invoke('ai:assistant-analyze', accountId, mailbox),
  aiAssistantAnalyzeEmail: (emailId) => ipcRenderer.invoke('ai:assistant-analyze-email', emailId),
  aiAssistantChat: (params) => ipcRenderer.invoke('ai:assistant-chat', params),
  aiAssistantBriefing: () => ipcRenderer.invoke('ai:assistant-briefing'),

  // Sync prefetch
  syncPrefetchBodies: (accountId) => ipcRenderer.invoke('sync:prefetch-bodies', accountId),

  // Lifecycle
  notifyReady: () => ipcRenderer.send('renderer:ready')
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
} else {
  // @ts-ignore - fallback for non-isolated context
  window.electronAPI = electronAPI
}
