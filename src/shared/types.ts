// === Electron API (exposed via preload) ===

export interface ElectronAPI {
  ping: () => Promise<string>
}

// === Email ===

export interface Email {
  id: string
  accountId: string
  messageId: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  isRead: boolean
  categoryId: string | null
}

// === Account ===

export interface Account {
  id: string
  name: string
  email: string
  provider: 'imap' | 'gmail' | 'outlook'
  host?: string
  port?: number
  username: string
  password: string
  createdAt: string
}

// === Category ===

export interface Category {
  id: string
  name: string
  color: string
  description: string
}

// === IPC Channel Types ===

export type IpcChannels = 'ping'

// === Window augmentation ===

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
