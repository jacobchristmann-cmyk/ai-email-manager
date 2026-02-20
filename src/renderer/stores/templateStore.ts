import { create } from 'zustand'
import type { ReplyTemplate } from '../../shared/types'

interface TemplateStore {
  templates: ReplyTemplate[]
  loadTemplates: () => Promise<void>
  createTemplate: (name: string, body: string) => Promise<boolean>
  updateTemplate: (id: string, data: { name?: string; body?: string }) => Promise<boolean>
  deleteTemplate: (id: string) => Promise<void>
}

export const useTemplateStore = create<TemplateStore>((set) => ({
  templates: [],

  loadTemplates: async () => {
    const result = await window.electronAPI.templateList()
    if (result.success && result.data) set({ templates: result.data })
  },

  createTemplate: async (name, body) => {
    const result = await window.electronAPI.templateCreate(name, body)
    if (result.success && result.data) {
      set((state) => ({ templates: [...state.templates, result.data!] }))
      return true
    }
    return false
  },

  updateTemplate: async (id, data) => {
    const result = await window.electronAPI.templateUpdate(id, data)
    if (result.success && result.data) {
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? result.data! : t))
      }))
      return true
    }
    return false
  },

  deleteTemplate: async (id) => {
    await window.electronAPI.templateDelete(id)
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }))
  }
}))
