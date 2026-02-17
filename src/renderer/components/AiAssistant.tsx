import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useEmailStore } from '../stores/emailStore'

function MarkdownText({ text }: { text: string }): React.JSX.Element {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-sm mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-200 dark:bg-gray-600 px-1 rounded text-sm">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n/g, '<br/>')

  return <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function AiAssistant(): React.JSX.Element {
  const {
    messages,
    isLoading,
    isAnalyzing,
    analysis,
    analysisError,
    close,
    sendMessage,
    clearChat,
    focusedEmailSubject
  } = useChatStore()
  const { selectedAccountId, selectedMailbox } = useEmailStore()

  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (): void => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage(text, selectedAccountId || undefined, selectedMailbox || undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasContent = focusedEmailSubject || analysis || messages.length > 0

  return (
    <div className="flex h-full w-96 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold">KI-Assistent</h2>
        <div className="flex items-center gap-2">
          {hasContent && (
            <button
              onClick={clearChat}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              Chat leeren
            </button>
          )}
          <button
            onClick={close}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Email analysis (from right-click) */}
        {(isAnalyzing || analysis || analysisError) && (
          <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-400">
              E-Mail-Analyse
            </h3>
            {focusedEmailSubject && (
              <p className="mb-2 truncate text-xs text-purple-600 dark:text-purple-400" title={focusedEmailSubject}>
                {focusedEmailSubject}
              </p>
            )}
            {isAnalyzing ? (
              <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                Analysiere E-Mail...
              </div>
            ) : analysisError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{analysisError}</p>
            ) : analysis ? (
              <MarkdownText text={analysis} />
            ) : null}
          </div>
        )}

        {/* Empty state */}
        {!hasContent && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400 dark:text-gray-500">
            <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm">Stelle eine Frage zu deinen E-Mails</p>
            <p className="mt-1 text-xs">oder Rechtsklick auf eine E-Mail &rarr; KI-Analyse</p>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
              }`}
            >
              {msg.role === 'assistant' ? (
                <MarkdownText text={msg.content} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-700">
              <div className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage zu deinen E-Mails..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
