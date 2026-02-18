import { getAccount } from '../db/accountDao'
import { getEmailsNeedingBody, updateEmailBody } from '../db/emailDao'
import { fetchEmailBodiesInMailbox } from './imapClient'

const PREFETCH_LIMIT = 20

/**
 * Background-fetches bodies for the most recent emails of an account that
 * don't yet have a body cached in the DB. Groups by mailbox so each mailbox
 * only needs one IMAP connection. Runs silently — errors are logged, not thrown.
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

  for (const [mailbox, items] of byMailbox) {
    try {
      const uids = items.map((e) => e.uid)
      const bodyMap = await fetchEmailBodiesInMailbox(imapConfig, mailbox, uids)

      for (const item of items) {
        const data = bodyMap.get(item.uid)
        if (data) {
          updateEmailBody(item.id, data.body, data.bodyHtml, data.listUnsubscribe, data.listUnsubscribePost)
        }
      }

      console.log(`[prefetch] ${mailbox}: ${bodyMap.size}/${uids.length} Bodies gecacht`)
    } catch (err) {
      console.error(`[prefetch] Fehler bei Mailbox ${mailbox}:`, err instanceof Error ? err.message : err)
    }
  }
}
