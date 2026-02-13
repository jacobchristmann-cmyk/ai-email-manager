import { NavLink } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useEmailStore } from '../stores/emailStore'

export default function Sidebar(): React.JSX.Element {
  const appName = useAppStore((s) => s.appName)
  const unreadCount = useEmailStore((s) => s.unreadCount)

  return (
    <aside className="flex w-56 flex-col bg-gray-900 text-white">
      <div className="p-4 text-lg font-bold tracking-tight">{appName}</div>
      <nav className="flex-1 space-y-1 px-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <span>📥</span>
          <span>Inbox</span>
          {unreadCount > 0 && (
            <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium">
              {unreadCount}
            </span>
          )}
        </NavLink>
        <NavLink
          to="/accounts"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <span>👤</span>
          <span>Accounts</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <span>⚙️</span>
          <span>Settings</span>
        </NavLink>
      </nav>
      <div className="p-4 text-xs text-gray-500">v1.0.0</div>
    </aside>
  )
}
