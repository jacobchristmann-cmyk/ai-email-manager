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

  mailboxUnreadCounts: (accountId) => ipcRenderer.invoke('mailbox:unread-counts', accountId),

  // Email methods
  emailList: (accountId?, mailbox?) => ipcRenderer.invoke('email:list', accountId, mailbox),
  emailGet: (id) => ipcRenderer.invoke('email:get', id),
  emailMarkRead: (id) => ipcRenderer.invoke('email:mark-read', id),
  emailSend: (data) => ipcRenderer.invoke('email:send', data),
  emailDelete: (id) => ipcRenderer.invoke('email:delete', id),

  // Sync methods
  syncAccount: (accountId) => ipcRenderer.invoke('sync:account', accountId),
  syncAll: () => ipcRenderer.invoke('sync:all'),
  onSyncStatus: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown): void => {
      callback(status as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('sync:status', handler)
    return () => {
      ipcRenderer.removeListener('sync:status', handler)
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
  aiListModels: (params) => ipcRenderer.invoke('ai:list-models', params)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
} else {
  // @ts-ignore - fallback for non-isolated context
  window.electronAPI = electronAPI
}
