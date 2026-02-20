import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './components/Sidebar'
import Inbox from './pages/Inbox'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import Statistics from './pages/Statistics'
import { useSettingsStore } from './stores/settingsStore'
import { useEmailStore } from './stores/emailStore'

export default function App(): React.JSX.Element {
  const { settings, loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
    // Signal to main: renderer is mounted and ready to receive sync:status events
    window.electronAPI.notifyReady()
  }, [loadSettings])

  useEffect(() => {
    return window.electronAPI.onEmailBodyReady((updates) => {
      useEmailStore.getState().refreshEmailBodies(updates)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onSnoozeWakeup((ids) => {
      useEmailStore.getState().handleSnoozeWakeup(ids)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onFollowupDue((ids) => {
      useEmailStore.getState().handleFollowupDue(ids)
    })
  }, [])

  useEffect(() => {
    const theme = settings.theme || 'light'
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [settings.theme])

  useEffect(() => {
    const fontSizeMap: Record<string, string> = { small: '14px', medium: '16px', large: '18px' }
    const fontFamilyMap: Record<string, string> = {
      system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      'sans-serif': "'Helvetica Neue', Arial, sans-serif",
      serif: "Georgia, 'Times New Roman', serif",
      monospace: "'SF Mono', Consolas, 'Courier New', monospace"
    }
    const el = document.documentElement
    el.style.fontSize = fontSizeMap[settings.fontSize || 'medium'] ?? '16px'
    el.style.setProperty('--app-font-family', fontFamilyMap[settings.fontFamily || 'system'] ?? fontFamilyMap.system)
    el.style.setProperty('--sidebar-bg', settings.sidebarColor || '#111827')
  }, [settings.fontSize, settings.fontFamily, settings.sidebarColor])

  const topLinkClass = (isActive: boolean): string =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
      isActive
        ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
        : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
    }`

  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="app-layout"
      className="h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
    >
      <Panel defaultSize={17} minSize={10} maxSize={30}>
        <Sidebar />
      </Panel>

      <PanelResizeHandle className="group relative w-1.5 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400 dark:bg-gray-700 dark:hover:bg-blue-500" />

      <Panel>
        <div className="flex h-full flex-col overflow-hidden">
          <header className="flex items-center justify-end gap-2 border-b border-gray-200 px-6 py-2 dark:border-gray-700">
            <NavLink to="/statistics" className={({ isActive }) => topLinkClass(isActive)}>
              <span className="text-sm">{'\u{1F4CA}'}</span>
              <span>Statistik</span>
            </NavLink>
            <NavLink to="/accounts" className={({ isActive }) => topLinkClass(isActive)}>
              <span className="text-sm">{'\u{1F464}'}</span>
              <span>Accounts</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => topLinkClass(isActive)}>
              <span className="text-sm">{'\u2699\uFE0F'}</span>
              <span>Settings</span>
            </NavLink>
          </header>
          <main className="flex-1 min-h-0 overflow-hidden">
            <Routes>
              <Route path="/" element={<Inbox />} />
              <Route path="/statistics" element={<div className="h-full overflow-auto p-6"><Statistics /></div>} />
              <Route path="/accounts" element={<div className="h-full overflow-auto p-6"><Accounts /></div>} />
              <Route path="/settings" element={<div className="h-full overflow-auto p-6"><Settings /></div>} />
            </Routes>
          </main>
        </div>
      </Panel>
    </PanelGroup>
  )
}
