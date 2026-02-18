import { BrowserWindow } from 'electron'
import { getAccount } from '../db/accountDao'
import { getEmailsNeedingBody, updateEmailBody } from '../db/emailDao'
import { fetchEmailBodiesInMailbox } from './imapClient'
import type { EmailBodyUpdate } from '../../shared/types'

const PREFETCH_LIMIT = 20

/**
 * Background-fetches bodies for the most recent emails of an account that
 * don't yet have a body cached in the DB. Groups by mailbox so each mailbox
 * only needs one IMAP connection (via the pool). After saving, broadcasts
 * an 'email:body-ready' event to all renderer windows so the store updates
 * immediately — no manual refresh needed.
 */
export async function prefetchBodiesForAccount(accountId: string): Promise<void> {
  const account = getAccount(accountId)
  if (!account) return

  const emailsNeedingBody = getEmailsNeedingBody(accountId, PREFETCH_LIMIT)
  if (emailsNeedingBody.length === 0) return

  // Group by mailbox to minimise IMAP connections
  const byMailbox = new Map<string, { id: string; uid: number }[]>()
  for (const e of emailsNeedingBody) {
    const list = byMailbox.get(e.mailbox) ?? []
    list.push({ id: e.id, uid: e.uid })
    byMailbox.set(e.mailbox, list)
  }

  const imapConfig = {
    host: account.imapHost,
    port: account.imapPort,
    username: account.username,
    password: account.password
  }

  const allUpdates: EmailBodyUpdate[] = []

  for (const [mailbox, items] of byMailbox) {
    try {
      const uids = items.map((e) => e.uid)
      // Pass accountId so the persistent pool connection is reused
      const bodyMap = await fetchEmailBodiesInMailbox(imapConfig, mailbox, uids, accountId)

      for (const item of items) {
        const data = bodyMap.get(item.uid)
        if (data) {
          updateEmailBody(item.id, data.body, data.bodyHtml, data.listUnsubscribe, data.listUnsubscribePost)
          allUpdates.push({ id: item.id, body: data.body, bodyHtml: data.bodyHtml })
        }
      }

      console.log(`[prefetch] ${mailbox}: ${bodyMap.size}/${uids.length} Bodies gecacht`)
    } catch (err) {
      console.error(`[prefetch] Fehler bei Mailbox ${mailbox}:`, err instanceof Error ? err.message : err)
    }
  }

  // Push all newly cached bodies to renderer windows in one batch
  if (allUpdates.length > 0) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('email:body-ready', allUpdates)
    }
    console.log(`[prefetch] ${allUpdates.length} body-ready Updates an Renderer gesendet`)
  }
}
