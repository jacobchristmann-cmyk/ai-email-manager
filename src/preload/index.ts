import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/types'

const electronAPI: ElectronAPI = {
  ping: () => ipcRenderer.invoke('ping')
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
} else {
  // @ts-ignore - fallback for non-isolated context
  window.electronAPI = electronAPI
}
