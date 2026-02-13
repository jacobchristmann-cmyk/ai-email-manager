import { create } from 'zustand'

interface SettingsState {
  settings: Record<string, string>
  isLoading: boolean
  isSaving: boolean
  error: string | null
  success: string | null
  loadSettings: () => Promise<void>
  saveSettings: (settings: Record<string, string>) => Promise<boolean>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {},
  isLoading: false,
  isSaving: false,
  error: null,
  success: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null })
    const result = await window.electronAPI.settingsGet()
    if (result.success) {
      set({ settings: result.data!, isLoading: false })
    } else {
      set({ error: result.error || 'Fehler beim Laden', isLoading: false })
    }
  },

  saveSettings: async (settings) => {
    set({ isSaving: true, error: null, success: null })
    const result = await window.electronAPI.settingsSet(settings)
    if (result.success) {
      set((state) => ({
        settings: { ...state.settings, ...settings },
        isSaving: false,
        success: 'Einstellungen gespeichert'
      }))
      setTimeout(() => set({ success: null }), 3000)
      return true
    } else {
      set({ error: result.error || 'Fehler beim Speichern', isSaving: false })
      return false
    }
  }
}))
