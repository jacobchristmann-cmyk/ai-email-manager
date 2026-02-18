import { BrowserWindow, Notification } from 'electron'
import { getAccount, getLastUidForMailbox, updateLastSyncForMailbox, listAccounts, resetMailboxSyncState } from '../db/accountDao'
import { insertEmails, getUnreadUidsForMailbox, markReadByIds } from '../db/emailDao'
import { fetchEmails, fetchSeenUids, listMailboxes, testImapConnection } from './imapClient'
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
    let totalInserted = 0

    const totalMailboxes = mailboxes.length
    console.log(`[sync] ${account.name}: ${totalMailboxes} Mailboxen gefunden`)

    for (let i = 0; i < mailboxes.length; i++) {
      const mb = mailboxes[i]
      const lastUid = getLastUidForMailbox(accountId, mb.path)
      console.log(`[sync] ${mb.path}: lastUid=${lastUid}`)

      broadcastSyncStatus({
        accountId,
        status: 'syncing',
        message: `${mb.path} (${i + 1}/${totalMailboxes})`,
        progress: { current: i + 1, total: totalMailboxes, mailbox: mb.path }
      })

      try {
        const fetched = await fetchEmails(imapConfig, lastUid, mb.path)
        console.log(`[sync] ${mb.path}: ${fetched.length} neue Emails abgerufen`)

        if (fetched.length > 0) {
          const emails = fetched.map((e) => ({
            accountId,
            messageId: e.messageId,
            uid: e.uid,
            mailbox: mb.path,
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

          const maxUid = Math.max(...fetched.map((e) => e.uid))
          updateLastSyncForMailbox(accountId, mb.path, maxUid)
        } else {
          updateLastSyncForMailbox(accountId, mb.path, lastUid)
        }

        // Sync read/seen flags: mark locally unread emails as read if seen on server
        const unreadLocal = getUnreadUidsForMailbox(accountId, mb.path)
        if (unreadLocal.length > 0) {
          const seenOnServer = await fetchSeenUids(imapConfig, mb.path)
          const toMarkRead = unreadLocal
            .filter((e) => seenOnServer.has(e.uid))
            .map((e) => e.id)
          console.log(`[sync] ${mb.path}: ${unreadLocal.length} lokal ungelesen, ${seenOnServer.size} auf Server gelesen, ${toMarkRead.length} zu aktualisieren`)
          if (toMarkRead.length > 0) {
            markReadByIds(toMarkRead)
          }
        }
      } catch (err) {
        console.error(`[sync] Fehler bei Mailbox ${mb.path}:`, err)
      }
    }

    if (totalInserted > 0 && Notification.isSupported()) {
      const notification = new Notification({
        title: 'Neue E-Mails',
        body: `${totalInserted} neue E-Mail(s) in ${account.name}`
      })
      notification.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.show()
          win.focus()
        }
      })
      notification.show()
    }

    broadcastSyncStatus({
      accountId,
      status: 'done',
      message: totalInserted > 0 ? `${totalInserted} neue E-Mail(s) synchronisiert` : 'Keine neuen E-Mails'
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
  for (const account of accounts) {
    try {
      await syncAccount(account.id)
    } catch {
      // Error already broadcast via syncAccount
    }
  }
}

export async function fullResyncAccount(accountId: string): Promise<void> {
  // Reset all mailbox sync states so the next sync fetches everything
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
