import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Inbox from './pages/Inbox'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import { useSettingsStore } from './stores/settingsStore'

export default function App(): React.JSX.Element {
  const { settings, loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const theme = settings.theme || 'light'
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [settings.theme])

  const topLinkClass = (isActive: boolean): string =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
      isActive
        ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
        : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
    }`

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-2 border-b border-gray-200 px-6 py-2 dark:border-gray-700">
          <NavLink to="/accounts" className={({ isActive }) => topLinkClass(isActive)}>
            <span className="text-sm">{'\u{1F464}'}</span>
            <span>Accounts</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => topLinkClass(isActive)}>
            <span className="text-sm">{'\u2699\uFE0F'}</span>
            <span>Settings</span>
          </NavLink>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Inbox />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
