import { ipcMain, shell } from 'electron'
import {
  createAccount, listAccounts, getAccount, updateAccount, deleteAccount
} from './db/accountDao'
import {
  listEmails, getEmail, markRead, deleteEmail, getUnreadCounts,
  updateEmailMailbox, insertUnsubscribeLog, updateUnsubscribeStatus, listUnsubscribeLogs
} from './db/emailDao'
import { listMailboxes, createMailbox, moveEmail } from './email/imapClient'
import {
  getAllSettings, setMultipleSettings
} from './db/settingsDao'
import {
  listCategories, getCategory, createCategory, updateCategory, deleteCategory,
  updateEmailCategory, addCategoryCorrection
} from './db/categoryDao'
import { syncAccount, syncAllAccounts, testConnection } from './email/syncService'
import { sendEmail } from './email/smtpClient'
import { classifyEmails, classifyAllEmails } from './ai/classifyService'
import { aiSearchEmails } from './ai/searchService'
import { generateSmartReplies } from './ai/replyService'
import { getDefaultModels, listModelsFromApi } from './ai/modelService'
import { unsubscribe } from './ai/unsubscribeService'
import { startGoogleOAuth } from './ai/googleOAuth'
import { updateSchedulerInterval } from './email/syncScheduler'
import { analyzeUnreadEmails, analyzeEmail, chatWithContext } from './ai/assistantService'
import type { AccountCreate, CategoryCreate, ChatMessage, EmailSend, IpcResult } from '../shared/types'

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

  // === Mailbox Handlers ===

  ipcMain.handle('mailbox:list', async (_e, accountId: string) => {
    try {
      const account = getAccount(accountId)
      if (!account) return fail('Account nicht gefunden')
      const mailboxes = await listMailboxes({
        host: account.imapHost,
        port: account.imapPort,
        username: account.username,
        password: account.password
      })
      return ok(mailboxes)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden der Ordner')
    }
  })

  ipcMain.handle('mailbox:create', async (_e, accountId: string, path: string) => {
    try {
      const account = getAccount(accountId)
      if (!account) return fail('Account nicht gefunden')
      await createMailbox({
        host: account.imapHost,
        port: account.imapPort,
        username: account.username,
        password: account.password
      }, path)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Erstellen des Ordners')
    }
  })

  ipcMain.handle('mailbox:unread-counts', async (_e, accountId: string) => {
    try {
      return ok(getUnreadCounts(accountId))
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden der ungelesenen Zähler')
    }
  })

  // === Email Handlers ===

  ipcMain.handle('email:list', async (_e, accountId?: string, mailbox?: string) => {
    try {
      return ok(listEmails(accountId, mailbox))
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

  ipcMain.handle('email:move', async (_e, emailId: string, targetMailbox: string) => {
    try {
      const email = getEmail(emailId)
      if (!email) return fail('E-Mail nicht gefunden')
      const account = getAccount(email.accountId)
      if (!account) return fail('Account nicht gefunden')
      const imapConfig = {
        host: account.imapHost,
        port: account.imapPort,
        username: account.username,
        password: account.password
      }
      await moveEmail(imapConfig, email.uid, email.mailbox, targetMailbox)
      updateEmailMailbox(emailId, targetMailbox)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Verschieben')
    }
  })

  ipcMain.handle('email:unsubscribe', async (_e, emailId: string) => {
    try {
      const email = getEmail(emailId)
      if (!email) return fail('E-Mail nicht gefunden')

      const result = await unsubscribe(emailId)
      if (!result) return fail('Kein Abmelde-Link gefunden')
      if (result.method === 'browser') {
        await shell.openExternal(result.url)
      }

      // Move email to "Abgemeldete Newsletter" folder
      const account = getAccount(email.accountId)
      if (account) {
        const imapConfig = {
          host: account.imapHost,
          port: account.imapPort,
          username: account.username,
          password: account.password
        }
        const targetMailbox = 'Abgemeldete Newsletter'
        try {
          await createMailbox(imapConfig, targetMailbox)
          console.log('[Unsubscribe] Mailbox ready:', targetMailbox)
        } catch (err) {
          console.error('[Unsubscribe] Failed to create mailbox:', err)
        }
        try {
          await moveEmail(imapConfig, email.uid, email.mailbox, targetMailbox)
          updateEmailMailbox(emailId, targetMailbox)
          console.log('[Unsubscribe] Email moved to:', targetMailbox)
        } catch (err) {
          console.error('[Unsubscribe] Failed to move email:', err)
        }
      }

      // Log the unsubscribe action
      const status = result.method === 'post' ? 'confirmed' : 'pending'
      const log = insertUnsubscribeLog({
        emailId,
        sender: email.from,
        method: result.method,
        status: status as 'confirmed' | 'pending',
        url: result.url
      })

      return ok({ method: result.method, logId: log.id, status: status as 'confirmed' | 'pending' })
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Abmelden')
    }
  })

  // === Unsubscribe Tracking Handlers ===

  ipcMain.handle('unsubscribe:confirm', async (_e, logId: string) => {
    try {
      updateUnsubscribeStatus(logId, 'confirmed')
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Bestätigen')
    }
  })

  ipcMain.handle('unsubscribe:list', async () => {
    try {
      return ok(listUnsubscribeLogs())
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden der Abmelde-Logs')
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

  // === Email Category Assignment ===

  ipcMain.handle('email:set-category', async (_e, emailId: string, categoryId: string | null) => {
    try {
      updateEmailCategory(emailId, categoryId)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Setzen der Kategorie')
    }

    // Save as training data (non-critical — don't let this block the category update)
    if (categoryId) {
      try {
        const email = getEmail(emailId)
        if (email) {
          const snippet = email.body.replace(/\s+/g, ' ').slice(0, 300)
          addCategoryCorrection(email.subject, email.from, snippet, categoryId)
        }
      } catch {
        // Training data save failed — not critical, ignore
      }
    }

    return ok(undefined)
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

  // === AI Search Handler ===

  ipcMain.handle('email:ai-search', async (_e, params: { query: string; accountId?: string; mailbox?: string }) => {
    try {
      const results = await aiSearchEmails(params.query, params.accountId, params.mailbox)
      return ok(results)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der KI-Suche')
    }
  })

  // === AI Smart Reply Handler ===

  ipcMain.handle('email:smart-reply', async (_e, emailId: string, language: string) => {
    try {
      const result = await generateSmartReplies(emailId, language)
      return ok(result)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der KI-Antwortgenerierung')
    }
  })

  // === Google OAuth Handlers ===

  ipcMain.handle('auth:google-login', async () => {
    try {
      const settings = getAllSettings()
      const clientId = settings.googleClientId
      const clientSecret = settings.googleClientSecret

      if (!clientId?.trim() || !clientSecret?.trim()) {
        return fail('Bitte zuerst Google Client-ID und Client-Secret eingeben und speichern.')
      }

      const tokens = await startGoogleOAuth(clientId, clientSecret)
      setMultipleSettings({
        googleAccessToken: tokens.accessToken,
        googleRefreshToken: tokens.refreshToken,
        googleTokenExpiry: String(tokens.expiresAt)
      })
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Google-Anmeldung fehlgeschlagen')
    }
  })

  ipcMain.handle('auth:google-logout', async () => {
    try {
      setMultipleSettings({
        googleAccessToken: '',
        googleRefreshToken: '',
        googleTokenExpiry: ''
      })
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Abmelden')
    }
  })

  ipcMain.handle('auth:google-status', async () => {
    try {
      const settings = getAllSettings()
      const isConnected = !!(settings.googleAccessToken && settings.googleRefreshToken)
      return ok({ isConnected })
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Prüfen des Status')
    }
  })

  // === AI Model Listing ===

  ipcMain.handle('ai:default-models', async (_e, provider: string) => {
    try {
      return ok(getDefaultModels(provider))
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden der Modelle')
    }
  })

  ipcMain.handle('ai:list-models', async (_e, params: { provider: string; apiKey?: string }) => {
    try {
      const models = await listModelsFromApi(params)
      return ok(models)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden der Modelle')
    }
  })

  // === AI Assistant Handlers ===

  ipcMain.handle('ai:assistant-analyze', async (_e, accountId?: string, mailbox?: string) => {
    try {
      const result = await analyzeUnreadEmails(accountId, mailbox)
      return ok(result)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der Postfach-Analyse')
    }
  })

  ipcMain.handle('ai:assistant-analyze-email', async (_e, emailId: string) => {
    try {
      const result = await analyzeEmail(emailId)
      return ok(result)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der E-Mail-Analyse')
    }
  })

  ipcMain.handle('ai:assistant-chat', async (_e, params: { messages: ChatMessage[]; accountId?: string; mailbox?: string; focusedEmailId?: string }) => {
    try {
      const result = await chatWithContext(params.messages, params.accountId, params.mailbox, params.focusedEmailId)
      return ok(result)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim KI-Chat')
    }
  })
}
