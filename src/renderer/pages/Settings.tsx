import { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useCategoryStore } from '../stores/categoryStore'
import type { Category } from '../../shared/types'

export default function Settings(): React.JSX.Element {
  const { settings, isLoading, isSaving, error, success, loadSettings, saveSettings } =
    useSettingsStore()
  const {
    categories,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory
  } = useCategoryStore()

  // Local form state
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [syncInterval, setSyncInterval] = useState('0')
  const [theme, setTheme] = useState('light')

  // Category management
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6B7280')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [editingCat, setEditingCat] = useState<Category | null>(null)

  useEffect(() => {
    loadSettings()
    loadCategories()
  }, [loadSettings, loadCategories])

  useEffect(() => {
    setAiProvider(settings.aiProvider || 'openai')
    setAiApiKey(settings.aiApiKey || '')
    setAiModel(settings.aiModel || '')
    setSyncInterval(settings.syncInterval || '0')
    setTheme(settings.theme || 'light')
  }, [settings])

  const handleSave = async (): Promise<void> => {
    await saveSettings({
      aiProvider,
      aiApiKey,
      aiModel,
      syncInterval,
      theme
    })
  }

  const handleAddCategory = async (): Promise<void> => {
    if (!newCatName.trim()) return
    const success = await addCategory({
      name: newCatName.trim(),
      color: newCatColor,
      description: newCatDesc.trim()
    })
    if (success) {
      setNewCatName('')
      setNewCatColor('#6B7280')
      setNewCatDesc('')
    }
  }

  const handleUpdateCategory = async (): Promise<void> => {
    if (!editingCat) return
    await updateCategory(editingCat.id, {
      name: editingCat.name,
      color: editingCat.color,
      description: editingCat.description
    })
    setEditingCat(null)
  }

  const handleDeleteCategory = async (id: string): Promise<void> => {
    await deleteCategory(id)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Lade Einstellungen...
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Speichere...' : 'Speichern'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">{success}</div>
      )}

      <div className="space-y-6">
        {/* Section 1: AI Config */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">KI-Konfiguration</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">API-Schlüssel</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Modell</label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder={aiProvider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-5-20250929'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">
                Leer lassen für Standardmodell
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Sync */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Synchronisation</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sync-Intervall
            </label>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="0">Manuell</option>
              <option value="5">Alle 5 Minuten</option>
              <option value="15">Alle 15 Minuten</option>
              <option value="30">Alle 30 Minuten</option>
              <option value="60">Jede Stunde</option>
            </select>
          </div>
        </div>

        {/* Section 3: Appearance */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Darstellung</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="light">Hell</option>
              <option value="dark">Dunkel</option>
            </select>
          </div>
        </div>

        {/* Section 4: Categories */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Kategorien verwalten</h2>

          {/* Existing categories */}
          <div className="mb-4 space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                {editingCat?.id === cat.id ? (
                  <>
                    <input
                      type="color"
                      value={editingCat.color}
                      onChange={(e) =>
                        setEditingCat({ ...editingCat, color: e.target.value })
                      }
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border-0"
                    />
                    <input
                      type="text"
                      value={editingCat.name}
                      onChange={(e) =>
                        setEditingCat({ ...editingCat, name: e.target.value })
                      }
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                    <input
                      type="text"
                      value={editingCat.description}
                      onChange={(e) =>
                        setEditingCat({ ...editingCat, description: e.target.value })
                      }
                      placeholder="Beschreibung"
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                    <button
                      onClick={handleUpdateCategory}
                      className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setEditingCat(null)}
                      className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                    >
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</span>
                    <span className="flex-1 text-sm text-gray-500 dark:text-gray-400">{cat.description}</span>
                    <button
                      onClick={() => setEditingCat({ ...cat })}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new category */}
          <div className="flex items-end gap-3 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Farbe</label>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border-0"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Neue Kategorie"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Beschreibung</label>
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Optionale Beschreibung"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <button
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Hinzufügen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
