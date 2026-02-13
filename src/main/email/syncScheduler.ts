import { getSetting } from '../db/settingsDao'
import { syncAllAccounts } from './syncService'

let timer: NodeJS.Timeout | null = null

export function startScheduler(): void {
  const raw = getSetting('syncInterval')
  const minutes = raw ? parseInt(raw, 10) : 0
  setTimer(minutes)
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
