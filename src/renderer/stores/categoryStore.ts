import { create } from 'zustand'
import type { Category, CategoryCreate } from '../../shared/types'

interface CategoryState {
  categories: Category[]
  isLoading: boolean
  isClassifying: boolean
  error: string | null
  loadCategories: () => Promise<void>
  addCategory: (data: CategoryCreate) => Promise<boolean>
  updateCategory: (id: string, data: Partial<CategoryCreate>) => Promise<boolean>
  deleteCategory: (id: string) => Promise<void>
  classifyAll: () => Promise<Record<string, string>>
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  isLoading: false,
  isClassifying: false,
  error: null,

  loadCategories: async () => {
    set({ isLoading: true, error: null })
    const result = await window.electronAPI.categoryList()
    if (result.success) {
      set({ categories: result.data!, isLoading: false })
    } else {
      set({ error: result.error || 'Fehler beim Laden', isLoading: false })
    }
  },

  addCategory: async (data) => {
    const result = await window.electronAPI.categoryAdd(data)
    if (result.success) {
      set((state) => ({
        categories: [...state.categories, result.data!].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      }))
      return true
    }
    return false
  },

  updateCategory: async (id, data) => {
    const result = await window.electronAPI.categoryUpdate(id, data)
    if (result.success) {
      set((state) => ({
        categories: state.categories
          .map((c) => (c.id === id ? result.data! : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      }))
      return true
    }
    return false
  },

  deleteCategory: async (id) => {
    const result = await window.electronAPI.categoryDelete(id)
    if (result.success) {
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id)
      }))
    }
  },

  classifyAll: async () => {
    set({ isClassifying: true, error: null })
    const result = await window.electronAPI.emailClassifyAll()
    if (result.success) {
      set({ isClassifying: false })
      return result.data!
    } else {
      set({ error: result.error || 'Fehler bei der Klassifizierung', isClassifying: false })
      return {}
    }
  }
}))
