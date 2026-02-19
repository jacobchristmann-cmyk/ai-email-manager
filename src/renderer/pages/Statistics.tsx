import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmailStore } from '../stores/emailStore'
import { useCategoryStore } from '../stores/categoryStore'

interface CategoryStat {
  id: string | null
  name: string
  color: string
  count: number
  topSenders: { name: string; count: number }[]
}

interface DayStat {
  label: string
  count: number
}

export default function Statistics(): React.JSX.Element {
  const { emails, loadEmails, setSelectedCategoryId } = useEmailStore()
  const { categories, loadCategories } = useCategoryStore()
  const navigate = useNavigate()

  useEffect(() => {
    loadEmails()
    loadCategories()
  }, [loadEmails, loadCategories])

  const stats = useMemo<CategoryStat[]>(() => {
    const catMap = new Map<string | null, typeof emails>()
    for (const email of emails) {
      const key = email.categoryId
      if (!catMap.has(key)) catMap.set(key, [])
      catMap.get(key)!.push(email)
    }

    const result: CategoryStat[] = []
    for (const cat of categories) {
      const catEmails = catMap.get(cat.id) ?? []
      result.push({ id: cat.id, name: cat.name, color: cat.color, count: catEmails.length, topSenders: getTopSenders(catEmails) })
    }
    const uncategorized = catMap.get(null) ?? []
    if (uncategorized.length > 0) {
      result.push({ id: null, name: 'Unkategorisiert', color: '#9ca3af', count: uncategorized.length, topSenders: getTopSenders(uncategorized) })
    }
    return result.sort((a, b) => b.count - a.count)
  }, [emails, categories])

  // Last 30 days time-series
  const dailyStats = useMemo<DayStat[]>(() => {
    const days: DayStat[] = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = i === 0 ? 'Heute' : i === 1 ? 'Gestern' : `${d.getDate()}.${d.getMonth() + 1}.`
      days.push({ label, count: 0 })
      ;(days[days.length - 1] as DayStat & { key: string }).key = key
    }
    for (const email of emails) {
      const key = email.date?.slice(0, 10)
      const day = days.find((d) => (d as DayStat & { key: string }).key === key)
      if (day) day.count++
    }
    return days
  }, [emails])

  const maxDay = Math.max(...dailyStats.map((d) => d.count), 1)
  const totalUnread = emails.filter((e) => !e.isRead).length
  const totalStarred = emails.filter((e) => e.isStarred).length
  const totalWithAttachments = emails.filter((e) => e.hasAttachments).length

  function getTopSenders(emailList: typeof emails) {
    const senderCounts = new Map<string, number>()
    for (const e of emailList) senderCounts.set(e.from, (senderCounts.get(e.from) ?? 0) + 1)
    return [...senderCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
  }

  function handleCategoryClick(catId: string | null): void {
    setSelectedCategoryId(catId)
    navigate('/')
  }

  // Chart dimensions
  const chartW = 600
  const chartH = 120
  const barW = Math.floor(chartW / dailyStats.length) - 2
  const showLabel = (i: number): boolean => i === 0 || i === dailyStats.length - 1 || i % 5 === 0

  return (
    <div className="h-full overflow-y-auto">
      <h1 className="mb-6 text-2xl font-bold">Statistik</h1>

      {emails.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          Keine Emails vorhanden. Synchronisiere zuerst deine Konten.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Gesamt', value: emails.length, color: 'text-gray-900 dark:text-gray-100' },
              { label: 'Ungelesen', value: totalUnread, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Markiert', value: totalStarred, color: 'text-yellow-500' },
              { label: 'Mit Anhang', value: totalWithAttachments, color: 'text-purple-600 dark:text-purple-400' }
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{c.label}</p>
                <p className={`mt-1 text-3xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Time-series bar chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              E-Mails der letzten 30 Tage
            </h2>
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${chartW} ${chartH + 28}`} className="w-full" style={{ minWidth: 300 }}>
                {dailyStats.map((day, i) => {
                  const barHeight = maxDay > 0 ? Math.round((day.count / maxDay) * chartH) : 0
                  const x = i * (chartW / dailyStats.length)
                  const y = chartH - barHeight
                  return (
                    <g key={i}>
                      <rect
                        x={x + 1}
                        y={y}
                        width={barW}
                        height={barHeight}
                        rx={2}
                        className="fill-blue-500 dark:fill-blue-400"
                        opacity={0.85}
                      />
                      {day.count > 0 && barHeight > 14 && (
                        <text x={x + barW / 2 + 1} y={y + 12} textAnchor="middle" fontSize={9} className="fill-white">
                          {day.count}
                        </text>
                      )}
                      {showLabel(i) && (
                        <text x={x + barW / 2 + 1} y={chartH + 18} textAnchor="middle" fontSize={9} className="fill-gray-400">
                          {day.label}
                        </text>
                      )}
                    </g>
                  )
                })}
                {/* baseline */}
                <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="currentColor" strokeOpacity={0.1} />
              </svg>
            </div>
          </div>

          {/* Category breakdown */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Nach Kategorie
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((stat) => (
                <button
                  key={stat.id ?? '__uncategorized'}
                  onClick={() => handleCategoryClick(stat.id)}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: stat.color }} />
                    <span className="text-base font-semibold">{stat.name}</span>
                    <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {stat.count}
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        backgroundColor: stat.color,
                        width: `${Math.round((stat.count / emails.length) * 100)}%`
                      }}
                    />
                  </div>
                  {stat.topSenders.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Top-Absender</p>
                      {stat.topSenders.map((sender) => (
                        <div key={sender.name} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span className="truncate pr-2">{sender.name.replace(/<[^>]+>/, '').trim()}</span>
                          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{sender.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
