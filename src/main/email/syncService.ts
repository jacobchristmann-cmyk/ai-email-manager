import { BrowserWindow, Notification } from 'electron'
import { getAccount, getLastUid, updateLastSync, listAccounts } from '../db/accountDao'
import { insertEmails } from '../db/emailDao'
import { fetchEmails, testImapConnection } from './imapClient'
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

    const lastUid = getLastUid(accountId)

    const fetched = await fetchEmails(
      {
        host: account.imapHost,
        port: account.imapPort,
        username: account.username,
        password: account.password
      },
      lastUid
    )

    if (fetched.length > 0) {
      const emails = fetched.map((e) => ({
        accountId,
        messageId: e.messageId,
        uid: e.uid,
        subject: e.subject,
        from: e.from,
        to: e.to,
        date: e.date,
        body: e.body,
        bodyHtml: e.bodyHtml
      }))

      const inserted = insertEmails(emails)

      const maxUid = Math.max(...fetched.map((e) => e.uid))
      updateLastSync(accountId, maxUid)

      if (inserted > 0 && Notification.isSupported()) {
        const notification = new Notification({
          title: 'Neue E-Mails',
          body: `${inserted} neue E-Mail(s) in ${account.name}`
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
        message: `${inserted} neue E-Mail(s) synchronisiert`
      })
    } else {
      updateLastSync(accountId, lastUid)
      broadcastSyncStatus({ accountId, status: 'done', message: 'Keine neuen E-Mails' })
    }
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
