import { BrowserWindow, Notification } from 'electron'
import { getAccount, getLastUidForMailbox, updateLastSyncForMailbox, listAccounts } from '../db/accountDao'
import { insertEmails } from '../db/emailDao'
import { fetchEmails, listMailboxes, testImapConnection } from './imapClient'
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

    for (const mb of mailboxes) {
      // Skip non-selectable mailboxes (like folder containers)
      const lastUid = getLastUidForMailbox(accountId, mb.path)

      try {
        const fetched = await fetchEmails(imapConfig, lastUid, mb.path)

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
            bodyHtml: e.bodyHtml
          }))

          const inserted = insertEmails(emails)
          totalInserted += inserted

          const maxUid = Math.max(...fetched.map((e) => e.uid))
          updateLastSyncForMailbox(accountId, mb.path, maxUid)
        } else {
          updateLastSyncForMailbox(accountId, mb.path, lastUid)
        }
      } catch {
        // Some mailboxes may not be selectable, skip them
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
