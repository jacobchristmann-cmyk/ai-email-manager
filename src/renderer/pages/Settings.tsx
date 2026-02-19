import { useEffect, useState, useRef, useCallback } from 'react'
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
  const [fontSize, setFontSize] = useState('medium')
  const [fontFamily, setFontFamily] = useState('system')
  const [sidebarColor, setSidebarColor] = useState('#111827')
  const [emailDensity, setEmailDensity] = useState('comfortable')
  const [signature, setSignature] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [showOllamaGuide, setShowOllamaGuide] = useState(false)
  const [detectedSignature, setDetectedSignature] = useState<string | null>(null)
  const [detectingSignature, setDetectingSignature] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'signature' | 'categories'>('general')

  // Model list state
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Google OAuth state
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

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
    setFontSize(settings.fontSize || 'medium')
    setFontFamily(settings.fontFamily || 'system')
    setSidebarColor(settings.sidebarColor || '#111827')
    setEmailDensity(settings.emailDensity || 'comfortable')
    const loadedSignature = settings.signature || ''
    setSignature(loadedSignature)
    setOllamaUrl(settings.ollamaUrl || 'http://localhost:11434')
    setGoogleClientId(settings.googleClientId || '')
    setGoogleClientSecret(settings.googleClientSecret || '')

    // Auto-detect signature from sent emails if none is configured yet
    if (!loadedSignature && !detectingSignature) {
      setDetectingSignature(true)
      window.electronAPI.accountDetectSignature().then((res) => {
        if (res.success && res.data) {
          setDetectedSignature(res.data)
        }
        setDetectingSignature(false)
      })
    }
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check Google connection status when provider is google
  useEffect(() => {
    if (aiProvider === 'google') {
      window.electronAPI.googleStatus().then((res) => {
        if (res.success && res.data) {
          setGoogleConnected(res.data.isConnected)
        }
      })
    }
    if (aiProvider === 'ollama') {
      setOllamaStatus('idle')
      checkOllamaConnection(ollamaUrl)
    } else {
      setShowOllamaGuide(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProvider])

  // Load hardcoded defaults immediately, then try API in background
  const loadDefaultModels = useCallback(async (provider: string) => {
    const res = await window.electronAPI.aiDefaultModels(provider)
    if (res.success && res.data) {
      setAvailableModels(res.data)
    }
  }, [])

  const refreshModelsFromApi = useCallback(async (provider: string, apiKey: string) => {
    setModelsLoading(true)
    const result = await window.electronAPI.aiListModels({
      provider,
      apiKey: provider !== 'google' ? apiKey : undefined
    })
    setModelsLoading(false)
    if (result.success && result.data && result.data.length > 0) {
      setAvailableModels(result.data)
    }
  }, [])

  // When provider changes: immediately show defaults, then try API
  useEffect(() => {
    loadDefaultModels(aiProvider)

    const key = settings.aiApiKey || ''
    const hasKey = aiProvider !== 'google' && aiProvider !== 'ollama' && key.trim()
    const hasGoogle = aiProvider === 'google' && !!(settings.googleAccessToken && settings.googleRefreshToken)
    const hasOllama = aiProvider === 'ollama'
    if (hasKey || hasGoogle || hasOllama) {
      refreshModelsFromApi(aiProvider, key)
    }

    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    refreshIntervalRef.current = setInterval(() => {
      const s = useSettingsStore.getState().settings
      const k = s.aiApiKey || ''
      const hasK = aiProvider !== 'google' && aiProvider !== 'ollama' && k.trim()
      const hasG = aiProvider === 'google' && !!(s.googleAccessToken && s.googleRefreshToken)
      const hasO = aiProvider === 'ollama'
      if (hasK || hasG || hasO) {
        refreshModelsFromApi(aiProvider, k)
      }
    }, 5 * 60 * 1000)

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProvider, settings.aiApiKey, settings.googleAccessToken])

  const handleSave = async (): Promise<void> => {
    await saveSettings({
      aiProvider,
      aiApiKey,
      aiModel,
      syncInterval,
      theme,
      fontSize,
      fontFamily,
      sidebarColor,
      emailDensity,
      signature,
      ollamaUrl,
      googleClientId,
      googleClientSecret
    })
  }

  const handleGoogleLogin = async (): Promise<void> => {
    setGoogleLoading(true)
    setGoogleError('')
    await saveSettings({ googleClientId, googleClientSecret })
    const result = await window.electronAPI.googleLogin()
    setGoogleLoading(false)
    if (result.success) {
      setGoogleConnected(true)
    } else {
      setGoogleError(result.error || 'Anmeldung fehlgeschlagen')
    }
  }

  const handleGoogleLogout = async (): Promise<void> => {
    await window.electronAPI.googleLogout()
    setGoogleConnected(false)
  }

  const checkOllamaConnection = async (url?: string): Promise<void> => {
    const targetUrl = url ?? ollamaUrl
    setOllamaStatus('checking')
    const result = await window.electronAPI.aiOllamaPing(targetUrl)
    if (result.success && result.data === true) {
      setOllamaStatus('ok')
      setShowOllamaGuide(false)
      refreshModelsFromApi('ollama', '')
    } else {
      setOllamaStatus('error')
      setShowOllamaGuide(true)
    }
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

  const TABS = [
    { id: 'general' as const, label: 'Allgemein' },
    { id: 'ai' as const, label: 'KI' },
    { id: 'signature' as const, label: 'Signatur' },
    { id: 'categories' as const, label: 'Kategorien' },
  ]

  return (
    <>
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-1 pb-3">
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        {activeTab !== 'categories' && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Speichere...' : 'Speichern'}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Notifications */}
      {(error || success) && (
        <div className="shrink-0 pt-3">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">{success}</div>
          )}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pt-4">
        <div className="space-y-6">

          {/* ── Tab: Allgemein ── */}
          {activeTab === 'general' && (<>

            {/* Sync interval */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Synchronisation</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Sync-Intervall</label>
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

            {/* Appearance */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Darstellung</h2>
              <div className="space-y-5">

                {/* Theme */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'light', label: 'Hell', icon: '\u2600\uFE0F' },
                      { value: 'dark', label: 'Dunkel', icon: '\uD83C\uDF19' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                          theme === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font size */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Schriftgröße</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'small', label: 'Klein', preview: 'A', size: 'text-xs' },
                      { value: 'medium', label: 'Mittel', preview: 'A', size: 'text-sm' },
                      { value: 'large', label: 'Groß', preview: 'A', size: 'text-base' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFontSize(opt.value)}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-4 py-2 transition-colors ${
                          fontSize === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className={`font-bold ${opt.size}`}>{opt.preview}</span>
                        <span className="text-xs">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font family */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Schriftart</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'system', label: 'System', style: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" } },
                      { value: 'sans-serif', label: 'Sans-serif', style: { fontFamily: "'Helvetica Neue', Arial, sans-serif" } },
                      { value: 'serif', label: 'Serif', style: { fontFamily: "Georgia, 'Times New Roman', serif" } },
                      { value: 'monospace', label: 'Monospace', style: { fontFamily: "'SF Mono', Consolas, 'Courier New', monospace" } }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFontFamily(opt.value)}
                        style={opt.style}
                        className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                          fontFamily === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sidebar color */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Sidebar-Farbe</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: '#111827', label: 'Dunkelgrau' },
                      { value: '#1e2d3d', label: 'Schieferblau' },
                      { value: '#1a2e1a', label: 'Waldgrün' },
                      { value: '#2d1e3d', label: 'Dunkelviolett' },
                      { value: '#2d1e1e', label: 'Dunkelrot' },
                      { value: '#1c1c1e', label: 'Schwarz' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSidebarColor(opt.value)}
                        title={opt.label}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${
                          sidebarColor === opt.value
                            ? 'border-blue-500 scale-110 shadow-md'
                            : 'border-transparent hover:border-gray-400'
                        }`}
                        style={{ background: opt.value }}
                      >
                        {sidebarColor === opt.value && (
                          <span className="text-xs font-bold text-white">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Wird sofort nach dem Speichern angewendet</p>
                </div>

                {/* Email density */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">E-Mail-Dichte</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'compact', label: 'Kompakt' },
                      { value: 'comfortable', label: 'Komfortabel' },
                      { value: 'spacious', label: 'Geräumig' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEmailDensity(opt.value)}
                        className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                          emailDensity === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </>)}

          {/* ── Tab: KI ── */}
          {activeTab === 'ai' && (<>

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
                    <option value="google">Google Gemini (OAuth)</option>
                    <option value="ollama">Ollama (Lokal)</option>
                  </select>
                </div>

                {aiProvider === 'ollama' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Ollama URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ollamaUrl}
                          onChange={(e) => setOllamaUrl(e.target.value)}
                          placeholder="http://localhost:11434"
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        />
                        <button
                          onClick={() => checkOllamaConnection()}
                          disabled={ollamaStatus === 'checking'}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          {ollamaStatus === 'checking' ? 'Prüfe...' : 'Testen'}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">Standard: http://localhost:11434 – kein API-Schlüssel erforderlich</p>
                    </div>
                    {ollamaStatus === 'ok' && (
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Ollama läuft und ist erreichbar
                      </div>
                    )}
                    {ollamaStatus === 'error' && (
                      <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Ollama nicht erreichbar
                        </span>
                        <button onClick={() => setShowOllamaGuide(true)} className="text-xs underline">
                          Installationsanleitung
                        </button>
                      </div>
                    )}
                  </div>
                ) : aiProvider === 'google' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Google Client-ID</label>
                      <input
                        type="text"
                        value={googleClientId}
                        onChange={(e) => setGoogleClientId(e.target.value)}
                        placeholder="xxx.apps.googleusercontent.com"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Google Client-Secret</label>
                      <input
                        type="password"
                        value={googleClientSecret}
                        onChange={(e) => setGoogleClientSecret(e.target.value)}
                        placeholder="GOCSPX-..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      {googleConnected ? (
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Verbunden
                          </span>
                          <button
                            onClick={handleGoogleLogout}
                            className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Abmelden
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={handleGoogleLogin}
                            disabled={googleLoading || !googleClientId.trim() || !googleClientSecret.trim()}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {googleLoading ? 'Anmeldung...' : 'Mit Google anmelden'}
                          </button>
                          {googleError && (
                            <p className="text-sm text-red-600 dark:text-red-400">{googleError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
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
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Modell</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="">
                      Standard ({aiProvider === 'google' ? 'gemini-2.0-flash' : aiProvider === 'openai' ? 'gpt-4o-mini' : aiProvider === 'ollama' ? 'gpt-oss:20b' : 'claude-sonnet-4-5-20250929'})
                    </option>
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name !== m.id ? `${m.name} (${m.id})` : m.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    {modelsLoading ? 'Aktualisiere Modellliste...' : 'Wird automatisch aktualisiert'}
                  </p>
                </div>
              </div>
            </div>

          </>)}

          {/* ── Tab: Signatur ── */}
          {activeTab === 'signature' && (<>

            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">E-Mail-Signatur</h2>

              {detectedSignature && !signature && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                  <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                    Signatur aus gesendeten E-Mails erkannt
                  </p>
                  <pre className="mb-3 whitespace-pre-wrap break-words font-mono text-xs text-amber-900 dark:text-amber-200">
                    {detectedSignature}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSignature(detectedSignature); setDetectedSignature(null) }}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                    >
                      Übernehmen
                    </button>
                    <button
                      onClick={() => setDetectedSignature(null)}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/40"
                    >
                      Verwerfen
                    </button>
                  </div>
                </div>
              )}

              {detectingSignature && !signature && (
                <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">Signatur wird aus gesendeten E-Mails erkannt...</p>
              )}

              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={6}
                placeholder={"Mit freundlichen Grüßen,\nMax Mustermann"}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">Wird automatisch in neue E-Mails eingefügt (nach 2 Leerzeilen).</p>
            </div>

          </>)}

          {/* ── Tab: Kategorien ── */}
          {activeTab === 'categories' && (<>

            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Kategorien verwalten</h2>

              <div className="mb-4 space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                    {editingCat?.id === cat.id ? (
                      <>
                        <input
                          type="color"
                          value={editingCat.color}
                          onChange={(e) => setEditingCat({ ...editingCat, color: e.target.value })}
                          className="h-8 w-8 shrink-0 cursor-pointer rounded border-0"
                        />
                        <input
                          type="text"
                          value={editingCat.name}
                          onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        />
                        <input
                          type="text"
                          value={editingCat.description}
                          onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })}
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
                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
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

          </>)}

        </div>
      </div>
    </div>

    {/* Ollama Installation Guide Modal */}
    {showOllamaGuide && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <span className="text-lg">🦙</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Ollama installieren</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Lokales KI-Modell einrichten</p>
              </div>
            </div>
            <button
              onClick={() => setShowOllamaGuide(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-5">
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ollama herunterladen</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Besuche ollama.ai und lade die macOS-Version herunter.</p>
                  <button
                    onClick={() => window.electronAPI.shellOpenExternal('https://ollama.ai')}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                  >
                    ollama.ai öffnen ↗
                  </button>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Installieren & starten</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Die App in den Programme-Ordner ziehen und öffnen. Ollama läuft dann im Hintergrund (Menüleiste).</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Modell herunterladen</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Terminal öffnen und folgendes Kommando ausführen:</p>
                  <div className="mt-1.5 flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 dark:bg-gray-700">
                    <code className="flex-1 text-xs font-mono text-gray-800 dark:text-gray-200">ollama pull gpt-oss:20b</code>
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">✓</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Verbindung testen</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Sobald Ollama läuft, auf "Verbindung erneut prüfen" klicken.</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="flex gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button
              onClick={() => checkOllamaConnection()}
              disabled={ollamaStatus === 'checking'}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {ollamaStatus === 'checking' ? 'Prüfe Verbindung...' : 'Verbindung erneut prüfen'}
            </button>
            <button
              onClick={() => setShowOllamaGuide(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
