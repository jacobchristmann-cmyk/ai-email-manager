import { ipcMain, shell, dialog } from 'electron'
import {
  createAccount, listAccounts, getAccount, updateAccount, deleteAccount
} from './db/accountDao'
import {
  listEmails, getEmail, markRead, markUnread, deleteEmail, getUnreadCounts,
  updateEmailMailbox, insertUnsubscribeLog, updateUnsubscribeStatus, listUnsubscribeLogs,
  searchEmails, updateEmailBody, markAllReadInMailbox,
  starEmail, unstarEmail, bulkMarkRead, bulkMarkUnread, bulkDelete,
  getContactSuggestions, updateEmailAttachments, getSentEmailBodies,
  snoozeEmail, unsnoozeEmail, listSnoozedEmails
} from './db/emailDao'
import { detectEmailActions } from './ai/actionsService'
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from './db/templateDao'
import { listMailboxes, createMailbox, moveEmail, fetchEmailBody, markEmailSeen, markEmailUnseen, appendToMailbox } from './email/imapClient'
import {
  getAllSettings, setMultipleSettings
} from './db/settingsDao'
import {
  listCategories, getCategory, createCategory, updateCategory, deleteCategory,
  updateEmailCategory, addCategoryCorrection
} from './db/categoryDao'
import { syncAccount, syncAllAccounts, fullResyncAccount, testConnection } from './email/syncService'
import { prefetchBodiesForAccount } from './email/prefetchService'
import { sendEmail } from './email/smtpClient'
import { classifyEmails, classifyAllEmails } from './ai/classifyService'
import { aiSearchEmails } from './ai/searchService'
import { generateSmartReplies } from './ai/replyService'
import { getDefaultModels, listModelsFromApi } from './ai/modelService'
import { unsubscribe } from './ai/unsubscribeService'
import { startGoogleOAuth } from './ai/googleOAuth'
import { updateSchedulerInterval } from './email/syncScheduler'
import { analyzeUnreadEmails, analyzeEmail, chatWithContext, generateBriefing } from './ai/assistantService'
import type { AccountCreate, CategoryCreate, ChatMessage, EmailSearchParams, EmailSend, IpcResult } from '../shared/types'

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

  ipcMain.handle('email:search', async (_e, params: EmailSearchParams) => {
    try {
      return ok(searchEmails(params))
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der Suche')
    }
  })

  ipcMain.handle('email:get', async (_e, id: string) => {
    try {
      const email = getEmail(id)
      if (!email) return fail('E-Mail nicht gefunden')

      // Lazy-load body from IMAP if not yet fetched (uses pool — no reconnect if warm)
      if (!email.body && email.uid > 0) {
        const account = getAccount(email.accountId)
        if (account) {
          const imapConfig = {
            host: account.imapHost,
            port: account.imapPort,
            username: account.username,
            password: account.password
          }
          const bodyData = await fetchEmailBody(imapConfig, email.uid, email.mailbox, account.id, id)
          if (bodyData) {
            updateEmailBody(id, bodyData.body, bodyData.bodyHtml, bodyData.listUnsubscribe, bodyData.listUnsubscribePost)
            email.body = bodyData.body
            email.bodyHtml = bodyData.bodyHtml
            email.listUnsubscribe = bodyData.listUnsubscribe
            email.listUnsubscribePost = bodyData.listUnsubscribePost
            email.hasBody = true
            // Save attachment metadata to DB
            if (bodyData.attachments.length > 0) {
              updateEmailAttachments(id, true, bodyData.attachments)
              email.hasAttachments = true
              email.attachments = bodyData.attachments
            }
          }
        }
      }

      return ok(email)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Laden')
    }
  })

  ipcMain.handle('email:mark-read', async (_e, id: string) => {
    try {
      markRead(id)
      // Fire-and-forget: sync \Seen flag to IMAP server
      const email = getEmail(id)
      if (email && email.uid > 0) {
        const account = getAccount(email.accountId)
        if (account) {
          markEmailSeen(
            { host: account.imapHost, port: account.imapPort, username: account.username, password: account.password },
            email.uid, email.mailbox, account.id
          ).catch((err) => console.error('[ipc] Failed to set \\Seen on IMAP:', err))
        }
      }
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  ipcMain.handle('email:mark-all-read', async (_e, accountId: string, mailbox: string) => {
    try {
      const count = markAllReadInMailbox(accountId, mailbox)
      return ok(count)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  ipcMain.handle('email:mark-unread', async (_e, id: string) => {
    try {
      markUnread(id)
      // Fire-and-forget: remove \Seen flag from IMAP server
      const email = getEmail(id)
      if (email && email.uid > 0) {
        const account = getAccount(email.accountId)
        if (account) {
          markEmailUnseen(
            { host: account.imapHost, port: account.imapPort, username: account.username, password: account.password },
            email.uid, email.mailbox, account.id
          ).catch((err) => console.error('[ipc] Failed to remove \\Seen from IMAP:', err))
        }
      }
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  ipcMain.handle('email:send', async (_e, data: EmailSend) => {
    try {
      const account = getAccount(data.accountId)
      if (!account) return fail('Account nicht gefunden')
      const imapConfig = {
        host: account.imapHost, port: account.imapPort,
        username: account.username, password: account.password
      }
      const rawMessage = await sendEmail(account, data.to, data.subject, data.body, data.cc, data.bcc, data.attachments)

      // Append to Sent folder (fire-and-forget, don't fail send on IMAP error)
      if (rawMessage.length > 0) {
        // Try common Sent folder names
        const sentCandidates = ['Sent', 'Sent Messages', 'INBOX.Sent', 'Gesendete Elemente']
        for (const folder of sentCandidates) {
          try {
            await appendToMailbox(imapConfig, folder, rawMessage, account.id)
            break
          } catch { /* try next */ }
        }
      }

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
      await moveEmail(imapConfig, email.uid, email.mailbox, targetMailbox, account.id)
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
          await moveEmail(imapConfig, email.uid, email.mailbox, targetMailbox, account.id)
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

  // === Star Handlers ===

  ipcMain.handle('email:star', async (_e, id: string) => {
    try {
      starEmail(id)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  ipcMain.handle('email:unstar', async (_e, id: string) => {
    try {
      unstarEmail(id)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  // === Attachment Handler ===

  ipcMain.handle('email:open-attachment', async (_e, _emailId: string, tempPath: string) => {
    try {
      await shell.openPath(tempPath)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Öffnen des Anhangs')
    }
  })

  ipcMain.handle('shell:open-external', async (_e, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('ai:ollama-ping', async (_e, url: string) => {
    try {
      const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(4000) })
      return ok(response.ok)
    } catch {
      return ok(false)
    }
  })

  // === Contact Suggestions ===

  ipcMain.handle('email:contact-suggest', async (_e, query: string) => {
    try {
      return ok(getContactSuggestions(query))
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei Kontaktvorschlägen')
    }
  })

  // === Bulk Operations ===

  ipcMain.handle('email:bulk-mark-read', async (_e, ids: string[]) => {
    try {
      bulkMarkRead(ids)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  ipcMain.handle('email:bulk-mark-unread', async (_e, ids: string[]) => {
    try {
      bulkMarkUnread(ids)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Markieren')
    }
  })

  ipcMain.handle('email:bulk-delete', async (_e, ids: string[]) => {
    try {
      bulkDelete(ids)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Löschen')
    }
  })

  // === File Dialog ===

  ipcMain.handle('dialog:open-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        title: 'Anhang auswählen'
      })
      if (result.canceled) return ok([])
      const files = result.filePaths.map((p) => {
        const parts = p.split('/')
        return { filename: parts[parts.length - 1] || p, path: p }
      })
      return ok(files)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Öffnen des Dialogs')
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

  ipcMain.handle('sync:full-resync', async (_e, accountId: string) => {
    try {
      await fullResyncAccount(accountId)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Vollständiger Sync fehlgeschlagen')
    }
  })

  ipcMain.handle('sync:prefetch-bodies', async (_e, accountId: string) => {
    // Fire-and-forget — start prefetch in background, return immediately
    prefetchBodiesForAccount(accountId).catch((err) => {
      console.error('[ipc] Prefetch failed:', err instanceof Error ? err.message : err)
    })
    return ok(undefined)
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

  ipcMain.handle('ai:assistant-briefing', async () => {
    try {
      const result = await generateBriefing()
      return ok(result)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler beim Erstellen des Briefings')
    }
  })

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

  // === Signature Detection ===

  ipcMain.handle('account:detect-signature', async (_e, accountId?: string) => {
    try {
      const bodies = getSentEmailBodies(accountId, 30)
      const signature = detectSignatureFromBodies(bodies)
      return ok(signature)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Fehler bei der Signaturer kennung')
    }
  })

  // === Snooze & Action Detection ===

  ipcMain.handle('email:snooze', async (_e, id: string, until: string) => {
    try { snoozeEmail(id, until); return ok(undefined) } catch (err) { return fail(String(err)) }
  })

  ipcMain.handle('email:unsnooze', async (_e, id: string) => {
    try { unsnoozeEmail(id); return ok(undefined) } catch (err) { return fail(String(err)) }
  })

  ipcMain.handle('email:list-snoozed', async () => {
    try { return ok(listSnoozedEmails()) } catch (err) { return fail(String(err)) }
  })

  ipcMain.handle('email:detect-actions', async (_e, id: string) => {
    try { return ok(await detectEmailActions(id)) } catch (err) { return fail(String(err)) }
  })

  // === Reply Templates ===

  ipcMain.handle('template:list', async () => {
    try { return ok(listTemplates()) } catch (err) { return fail(String(err)) }
  })

  ipcMain.handle('template:create', async (_e, name: string, body: string) => {
    try { return ok(createTemplate(name, body)) } catch (err) { return fail(String(err)) }
  })

  ipcMain.handle('template:update', async (_e, id: string, data: { name?: string; body?: string }) => {
    try { return ok(updateTemplate(id, data)) } catch (err) { return fail(String(err)) }
  })

  ipcMain.handle('template:delete', async (_e, id: string) => {
    try { deleteTemplate(id); return ok(undefined) } catch (err) { return fail(String(err)) }
  })
}

/**
 * Analyzes sent email bodies to detect a recurring signature.
 * Strategy 1: RFC 5322 "-- \n" delimiter (standard across most email clients).
 * Strategy 2: Common trailing lines across multiple emails.
 */
function detectSignatureFromBodies(bodies: string[]): string | null {
  if (bodies.length === 0) return null

  // Strategy 1: Look for RFC 5322 "-- " or "--" delimiter
  const rfcSep = /\n--[ \t]*\n/
  const rfcSigs: string[] = []
  for (const body of bodies) {
    const match = rfcSep.exec(body)
    if (match) {
      const sig = body.slice(match.index + match[0].length).trim()
      if (sig.length >= 3 && sig.length <= 1000) rfcSigs.push(sig)
    }
  }
  if (rfcSigs.length >= Math.min(2, bodies.length)) {
    return mostCommonString(rfcSigs)
  }

  // Strategy 2: Find lines that appear at the end of most emails
  if (bodies.length < 2) return null

  const threshold = Math.ceil(bodies.length * 0.5)
  const tailLines = bodies.map((b) =>
    b.split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)
      .slice(-8)
  )

  // Count how often each non-empty line appears across email tails
  const lineFreq = new Map<string, number>()
  for (const tail of tailLines) {
    for (const line of new Set(tail)) {
      lineFreq.set(line, (lineFreq.get(line) ?? 0) + 1)
    }
  }

  const commonLineSet = new Set(
    [...lineFreq.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([line]) => line)
  )

  if (commonLineSet.size === 0) return null

  // Reconstruct in natural order using the first email's tail as template
  const sigLines = (tailLines[0] ?? []).filter((l) => commonLineSet.has(l))
  if (sigLines.length === 0) return null

  const sig = sigLines.join('\n').trim()
  return sig.length >= 3 && sig.length <= 1000 ? sig : null
}

function mostCommonString(arr: string[]): string {
  const freq = new Map<string, number>()
  for (const s of arr) freq.set(s, (freq.get(s) ?? 0) + 1)
  let best = arr[0]
  let bestCount = 0
  for (const [s, count] of freq) {
    if (count > bestCount) { best = s; bestCount = count }
  }
  return best
}
