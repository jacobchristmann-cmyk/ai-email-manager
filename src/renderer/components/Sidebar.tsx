import { NavLink } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'

const navItems = [
  { to: '/', label: 'Inbox', icon: '📥' },
  { to: '/accounts', label: 'Accounts', icon: '👤' },
  { to: '/settings', label: 'Settings', icon: '⚙️' }
]

export default function Sidebar(): React.JSX.Element {
  const appName = useAppStore((s) => s.appName)

  return (
    <aside className="flex w-56 flex-col bg-gray-900 text-white">
      <div className="p-4 text-lg font-bold tracking-tight">{appName}</div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 text-xs text-gray-500">v1.0.0</div>
    </aside>
  )
}
