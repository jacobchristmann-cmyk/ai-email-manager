import { ipcMain } from 'electron'
import {
  createAccount, listAccounts, getAccount, updateAccount, deleteAccount
} from './db/accountDao'
import {
  listEmails, getEmail, markRead, deleteEmail
} from './db/emailDao'
import {
  getAllSettings, setMultipleSettings
} from './db/settingsDao'
import {
  listCategories, getCategory, createCategory, updateCategory, deleteCategory
} from './db/categoryDao'
import { syncAccount, syncAllAccounts, testConnection } from './email/syncService'
import { sendEmail } from './email/smtpClient'
import { classifyEmails, classifyAllEmails } from './ai/classifyService'
import { updateSchedulerInterval } from './email/syncScheduler'
import type { AccountCreate, CategoryCreate, EmailSend, IpcResult } from '../shared/types'

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function fail(error: string): IpcResult<never> {
  return { success: false, error }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('ping', () => 'pong')

  // === Account Handlers ===

  ipcMain.handle('account:add', async (_e, data: AccountCreate) => {
    try {
      const account = createAccount(data)
      return ok(account)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    }
  })

  ipcMain.handle('account:list', async () => {
    try {
      return ok(listAccounts())
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  })

  ipcMain.handle('account:get', async (_e, id: string) => {
    try {
      const account = getAccount(id)
      if (!account) return fail('Account nicht gefunden')
      return ok(account)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  })

  ipcMain.handle('account:update', async (_e, id: string, data: Partial<AccountCreate>) => {
    try {
      const account = updateAccount(id, data)
      if (!account) return fail('Account nicht gefunden')
      return ok(account)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Aktualisieren')
    }
  })

  ipcMain.handle('account:delete', async (_e, id: string) => {
    try {
      deleteAccount(id)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Löschen')
    }
  })

  ipcMain.handle('account:test-connection', async (_e, config: AccountCreate) => {
    try {
      await testConnection(config)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen')
    }
  })

  // === Email Handlers ===

  ipcMain.handle('email:list', async (_e, accountId?: string) => {
    try {
      return ok(listEmails(accountId))
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  })

  ipcMain.handle('email:get', async (_e, id: string) => {
    try {
      const email = getEmail(id)
      if (!email) return fail('E-Mail nicht gefunden')
      return ok(email)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  })

  ipcMain.handle('email:mark-read', async (_e, id: string) => {
    try {
      markRead(id)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  ipcMain.handle('email:send', async (_e, data: EmailSend) => {
    try {
      const account = getAccount(data.accountId)
      if (!account) return fail('Account nicht gefunden')
      await sendEmail(account, data.to, data.subject, data.body)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Senden')
    }
  })

  ipcMain.handle('email:delete', async (_e, id: string) => {
    try {
      deleteEmail(id)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Löschen')
    }
  })

  // === Sync Handlers ===

  ipcMain.handle('sync:account', async (_e, accountId: string) => {
    try {
      await syncAccount(accountId)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Sync fehlgeschlagen')
    }
  })

  ipcMain.handle('sync:all', async () => {
    try {
      await syncAllAccounts()
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Sync fehlgeschlagen')
    }
  })

  // === Settings Handlers ===

  ipcMain.handle('settings:get', async () => {
    try {
      return ok(getAllSettings())
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden der Einstellungen')
    }
  })

  ipcMain.handle('settings:set', async (_e, settings: Record<string, string>) => {
    try {
      setMultipleSettings(settings)
      if ('syncInterval' in settings) {
        updateSchedulerInterval(parseInt(settings.syncInterval, 10) || 0)
      }
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Speichern der Einstellungen')
    }
  })

  // === Category Handlers ===

  ipcMain.handle('category:list', async () => {
    try {
      return ok(listCategories())
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden der Kategorien')
    }
  })

  ipcMain.handle('category:get', async (_e, id: string) => {
    try {
      const category = getCategory(id)
      if (!category) return fail('Kategorie nicht gefunden')
      return ok(category)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  })

  ipcMain.handle('category:add', async (_e, data: CategoryCreate) => {
    try {
      const category = createCategory(data)
      return ok(category)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    }
  })

  ipcMain.handle('category:update', async (_e, id: string, data: Partial<CategoryCreate>) => {
    try {
      const category = updateCategory(id, data)
      if (!category) return fail('Kategorie nicht gefunden')
      return ok(category)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Aktualisieren')
    }
  })

  ipcMain.handle('category:delete', async (_e, id: string) => {
    try {
      deleteCategory(id)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Löschen')
    }
  })

  // === AI Classification Handlers ===

  ipcMain.handle('email:classify', async (_e, emailIds: string[]) => {
    try {
      const results = await classifyEmails(emailIds)
      return ok(results)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der Klassifizierung')
    }
  })

  ipcMain.handle('email:classify-all', async () => {
    try {
      const results = await classifyAllEmails()
      return ok(results)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der Klassifizierung')
    }
  })
}
