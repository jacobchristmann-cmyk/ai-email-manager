import { BrowserWindow, Notification } from 'electron'
import { getAccount, getLastUidForMailbox, updateLastSyncForMailbox, listAccounts, resetMailboxSyncState } from '../db/accountDao'
import { insertEmails, getUnreadUidsForMailbox, markReadByIds } from '../db/emailDao'
import { syncMailboxes, listMailboxes, testImapConnection } from './imapClient'
import { prefetchBodiesForAccount } from './prefetchService'
import { testSmtpConnection } from './smtpClient'
import type { AccountCreate, SyncStatus } from '../../shared/types'

const activeSyncs = new Set<string>()

function broadcastSyncStatus(status: SyncStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('sync:status', status)
  }
}

export async function syncAccount(accountId: string): Promise<void> {
  if (activeSyncs.has(accountId)) return

  activeSyncs.add(accountId)
  broadcastSyncStatus({ accountId, status: 'syncing', message: 'Synchronisiere...' })

  try {
    const account = getAccount(accountId)
    if (!account) throw new Error('Account nicht gefunden')

    const imapConfig = {
      host: account.imapHost,
      port: account.imapPort,
      username: account.username,
      password: account.password
    }

    const mailboxes = await listMailboxes(imapConfig)
    const totalMailboxes = mailboxes.length
    console.log(`[sync] ${account.name}: ${totalMailboxes} Mailboxen gefunden`)

    // Build sync inputs — collect lastUid and localUnreadUids for each mailbox
    const inputs = mailboxes.map((mb) => ({
      path: mb.path,
      sinceUid: getLastUidForMailbox(accountId, mb.path),
      localUnreadUids: getUnreadUidsForMailbox(accountId, mb.path).map((e) => e.uid)
    }))

    // Single IMAP connection for all mailboxes (replaces N×2 individual connections)
    const results = await syncMailboxes(imapConfig, inputs)

    let totalInserted = 0
    // Collect important new emails for smart notification (unread, inbox, no newsletter)
    const importantEmails: { from: string; subject: string }[] = []
    const nonInboxPattern = /sent|gesendet|drafts|entwürfe|trash|papierkorb|junk|spam|archive|archiv/i

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      broadcastSyncStatus({
        accountId,
        status: 'syncing',
        message: `${result.path} (${i + 1}/${totalMailboxes})`,
        progress: { current: i + 1, total: totalMailboxes, mailbox: result.path }
      })
      console.log(`[sync] ${result.path}: ${result.newEmails.length} neu, ${result.uidsToMarkRead.length} als gelesen markieren`)

      if (result.newEmails.length > 0) {
        const emails = result.newEmails.map((e) => ({
          accountId,
          messageId: e.messageId,
          uid: e.uid,
          mailbox: result.path,
          subject: e.subject,
          from: e.from,
          to: e.to,
          date: e.date,
          body: e.body,
          bodyHtml: e.bodyHtml,
          listUnsubscribe: e.listUnsubscribe,
          listUnsubscribePost: e.listUnsubscribePost,
          isRead: e.isSeen
        }))
        const inserted = insertEmails(emails)
        totalInserted += inserted

        // Collect important emails: unread, inbox mailbox, no List-Unsubscribe header
        if (!nonInboxPattern.test(result.path)) {
          for (const e of result.newEmails) {
            if (!e.isSeen && !e.listUnsubscribe) {
              importantEmails.push({ from: e.from, subject: e.subject })
            }
          }
        }
      }

      updateLastSyncForMailbox(accountId, result.path, result.maxUid)

      // Mark emails read whose \Seen flag appeared on server
      if (result.uidsToMarkRead.length > 0) {
        const unreadLocal = getUnreadUidsForMailbox(accountId, result.path)
        const uidToId = new Map(unreadLocal.map((e) => [e.uid, e.id]))
        const idsToMark = result.uidsToMarkRead
          .map((uid) => uidToId.get(uid))
          .filter((id): id is string => !!id)
        if (idsToMark.length > 0) markReadByIds(idsToMark)
      }
    }

    // Smart notification: only for important emails (no newsletters, no already-read)
    if (importantEmails.length > 0 && Notification.isSupported()) {
      let title: string
      let body: string
      if (importantEmails.length === 1) {
        const senderName = importantEmails[0].from.match(/^([^<]+)</)?.[ 1]?.trim() || importantEmails[0].from
        title = senderName
        body = importantEmails[0].subject
      } else {
        title = `${importantEmails.length} neue E-Mails`
        body = account.name
      }
      const notification = new Notification({ title, body })
      notification.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) { win.show(); win.focus() }
      })
      notification.show()
    }

    broadcastSyncStatus({
      accountId,
      status: 'done',
      message: totalInserted > 0 ? `${totalInserted} neue E-Mail(s) synchronisiert` : 'Keine neuen E-Mails'
    })

    // Background-prefetch bodies for the most recent emails (fire-and-forget, non-blocking)
    prefetchBodiesForAccount(accountId).catch((err) => {
      console.error('[sync] Prefetch failed:', err instanceof Error ? err.message : err)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    broadcastSyncStatus({ accountId, status: 'error', message })
    throw err
  } finally {
    activeSyncs.delete(accountId)
  }
}

export async function syncAllAccounts(): Promise<void> {
  const accounts = listAccounts()
  await Promise.allSettled(accounts.map((account) => syncAccount(account.id)))
}

export async function fullResyncAccount(accountId: string): Promise<void> {
  resetMailboxSyncState(accountId)
  console.log(`[sync] Full resync triggered for ${accountId} — all lastUid reset to 0`)
  await syncAccount(accountId)
}

export async function testConnection(config: AccountCreate): Promise<void> {
  await testImapConnection({
    host: config.imapHost,
    port: config.imapPort,
    username: config.username,
    password: config.password
  })
  await testSmtpConnection({
    host: config.smtpHost,
    port: config.smtpPort,
    username: config.username,
    password: config.password
  })
}
