import { useState } from 'react'

interface Props {
  onSnooze: (until: string) => void
  onClose: () => void
}

function todayAt(hour: number): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function tomorrowAt(hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function inDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

function nextMonday(hour: number): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const OPTIONS = [
  { label: 'Heute Abend (20:00)', getValue: () => todayAt(20) },
  { label: 'Morgen früh (09:00)', getValue: () => tomorrowAt(9) },
  { label: 'In 3 Tagen', getValue: () => inDays(3) },
  { label: 'Nächste Woche (Mo, 09:00)', getValue: () => nextMonday(9) },
]

export default function SnoozeDialog({ onSnooze, onClose }: Props) {
  const [custom, setCustom] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-72 rounded-xl bg-white p-4 shadow-xl dark:bg-gray-800">
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Zurückstellen bis...</h3>
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            onClick={() => { onSnooze(o.getValue()); onClose() }}
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {o.label}
          </button>
        ))}
        <input
          type="datetime-local"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        {custom && (
          <button
            onClick={() => { onSnooze(new Date(custom).toISOString()); onClose() }}
            className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
          >
            Bestätigen
          </button>
        )}
        <button
          onClick={onClose}
          className="mt-1 w-full py-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
