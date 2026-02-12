import { ipcMain } from 'electron'

export function registerIpcHandlers(): void {
  ipcMain.handle('ping', () => {
    return 'pong'
  })
}
