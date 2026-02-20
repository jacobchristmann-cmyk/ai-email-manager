import { BrowserWindow, Notification, ipcMain } from 'electron'
import { getSetting } from '../db/settingsDao'
import { syncAllAccounts } from './syncService'
import { getEmailsDueToWakeUp, unsnoozeEmail } from '../db/emailDao'
import { getDueFollowUps, markFollowUpsFired, autoDismissReplied } from '../db/followUpDao'

let timer: NodeJS.Timeout | null = null
let wakeupTimer: NodeJS.Timeout | null = null

function checkFollowUps(): void {
  autoDismissReplied()
  const due = getDueFollowUps()
  if (due.length === 0) return
  markFollowUpsFired(due.map((f) => f.id))
  for (const followup of due) {
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Nachfassen?', body: followup.subject })
      n.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) { win.show(); win.focus() }
      })
      n.show()
    }
  }
  const ids = due.map((f) => f.id)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('followup:due', ids)
  }
}

function checkSnoozeWakeups(): void {
  const wakeups = getEmailsDueToWakeUp()
  for (const email of wakeups) {
    unsnoozeEmail(email.id)
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Wiedervorlage', body: email.subject })
      n.on('click', () => { BrowserWindow.getAllWindows()[0]?.show() })
      n.show()
    }
  }
  if (wakeups.length > 0) {
    const ids = wakeups.map((e) => e.id)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('email:snoozed-wakeup', ids)
    }
  }
}

export function startScheduler(): void {
  const raw = getSetting('syncInterval')
  const minutes = raw ? parseInt(raw, 10) : 0
  setTimer(minutes)

  // Snooze wakeup + follow-up check every 60 seconds
  wakeupTimer = setInterval(() => {
    checkSnoozeWakeups()
    checkFollowUps()
  }, 60_000)

  // Trigger initial sync only after the renderer signals it is fully mounted
  // and has registered its sync:status listener — avoids the fragile 2s timeout.
  ipcMain.once('renderer:ready', () => {
    console.log('[scheduler] Renderer ready — starting initial sync...')
    syncAllAccounts().catch((err) => {
      console.error('[scheduler] Auto-sync failed:', err)
    })
  })
}

export function updateSchedulerInterval(minutes: number): void {
  setTimer(minutes)
}

function setTimer(minutes: number): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (minutes > 0) {
    timer = setInterval(() => {
      syncAllAccounts().catch(() => {
        // sync errors are already broadcast via syncAccount
      })
    }, minutes * 60 * 1000)
  }
}
