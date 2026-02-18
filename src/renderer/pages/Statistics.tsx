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
      result.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        count: catEmails.length,
        topSenders: getTopSenders(catEmails)
      })
    }

    // Uncategorized
    const uncategorized = catMap.get(null) ?? []
    if (uncategorized.length > 0) {
      result.push({
        id: null,
        name: 'Unkategorisiert',
        color: '#9ca3af',
        count: uncategorized.length,
        topSenders: getTopSenders(uncategorized)
      })
    }

    return result.sort((a, b) => b.count - a.count)
  }, [emails, categories])

  function getTopSenders(emailList: typeof emails) {
    const senderCounts = new Map<string, number>()
    for (const e of emailList) {
      const sender = e.from
      senderCounts.set(sender, (senderCounts.get(sender) ?? 0) + 1)
    }
    return [...senderCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }

  function handleCategoryClick(catId: string | null): void {
    setSelectedCategoryId(catId)
    navigate('/')
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Statistik</h1>

      {emails.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          Keine Emails vorhanden. Synchronisiere zuerst deine Konten.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {emails.length} Emails in {stats.length} Kategorien
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <button
                key={stat.id ?? '__uncategorized'}
                onClick={() => handleCategoryClick(stat.id)}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="inline-block h-4 w-4 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                  <span className="text-lg font-semibold">{stat.name}</span>
                  <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    {stat.count}
                  </span>
                </div>

                {stat.topSenders.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Top-Absender
                    </p>
                    {stat.topSenders.map((sender) => (
                      <div
                        key={sender.name}
                        className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
                      >
                        <span className="truncate pr-2">{sender.name}</span>
                        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                          {sender.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
