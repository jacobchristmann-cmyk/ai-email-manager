import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useEmailStore } from '../stores/emailStore'
import { useAccountStore } from '../stores/accountStore'
import { useCategoryStore } from '../stores/categoryStore'
import { useChatStore } from '../stores/chatStore'
import EmailList from '../components/EmailList'
import EmailDetail from '../components/EmailDetail'
import SyncButton from '../components/SyncButton'
import InboxToolbar from '../components/InboxToolbar'
import ComposeModal from '../components/ComposeModal'
import AiAssistant from '../components/AiAssistant'
import InboxBriefing from '../components/InboxBriefing'

export default function Inbox(): React.JSX.Element {
  const { loadEmails, handleSyncStatus, openCompose } = useEmailStore()
  const { loadAccounts } = useAccountStore()
  const { loadCategories } = useCategoryStore()
  const isAssistantOpen = useChatStore((s) => s.isOpen)

  useEffect(() => {
    loadEmails()
    loadAccounts()
    loadCategories()
    const cleanup = window.electronAPI.onSyncStatus(handleSyncStatus)
    return cleanup
  }, [loadEmails, handleSyncStatus, loadAccounts, loadCategories])

  return (
    <div className="flex h-full flex-col">
      {/* Briefing (above header) */}
      <InboxBriefing />

      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openCompose()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Neue E-Mail
          </button>
          <SyncButton />
        </div>
      </div>

      {/* Toolbar */}
      <InboxToolbar />

      {/* Split view */}
      <PanelGroup
        direction="horizontal"
        autoSaveId="inbox-panels"
        className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      >
        <Panel defaultSize={35} minSize={20} maxSize={60}>
          <EmailList />
        </Panel>

        <PanelResizeHandle className="w-1.5 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400 dark:bg-gray-700 dark:hover:bg-blue-500" />

        <Panel defaultSize={65} minSize={25}>
          <EmailDetail />
        </Panel>

        {isAssistantOpen && (
          <>
            <PanelResizeHandle className="w-1.5 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400 dark:bg-gray-700 dark:hover:bg-blue-500" />
            <Panel defaultSize={25} minSize={15} maxSize={45}>
              <AiAssistant />
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Compose modal */}
      <ComposeModal />
    </div>
  )
}
