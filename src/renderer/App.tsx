import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Inbox from './pages/Inbox'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'

export default function App(): React.JSX.Element {
  return (
    <div className="flex h-screen bg-gray-100 text-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Inbox />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
