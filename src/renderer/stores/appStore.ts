import { create } from 'zustand'

interface AppState {
  appName: string
  currentPage: string
  setCurrentPage: (page: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  appName: 'AI Email Manager',
  currentPage: 'inbox',
  setCurrentPage: (page) => set({ currentPage: page })
}))
