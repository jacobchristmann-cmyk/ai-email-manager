import { useState } from 'react'

interface Props {
  onConfirm: (remindAt: string) => void
  onClose: () => void
}

function todayAt(hour: number): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function inDays(n: number, hour = 9): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function nextMonday(hour = 9): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const PRESETS = [
  { label: 'In 2 Tagen (09:00)', getValue: () => inDays(2) },
  { label: 'In 3 Tagen (09:00)', getValue: () => inDays(3) },
  { label: 'In 1 Woche (09:00)', getValue: () => inDays(7) },
  { label: 'Nächste Woche Mo (09:00)', getValue: nextMonday },
]

export default function FollowUpDialog({ onConfirm, onClose }: Props): React.JSX.Element {
  const [custom, setCustom] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-72 rounded-xl bg-white p-4 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold text-gray-800 dark:text-gray-100">Nachfassen wenn keine Antwort</h3>
        <p className="mb-3 text-xs text-gray-400">
          Du wirst erinnert, falls bis dahin keine Antwort eingetroffen ist.
        </p>

        {PRESETS.map((o) => (
          <button
            key={o.label}
            onClick={() => { onConfirm(o.getValue()); onClose() }}
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {o.label}
          </button>
        ))}

        <div className="mt-1">
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />
          {custom && (
            <button
              onClick={() => { onConfirm(new Date(custom).toISOString()); onClose() }}
              className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
            >
              Bestätigen
            </button>
          )}
        </div>

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
