export default function Inbox(): React.JSX.Element {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Inbox</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        <p className="text-lg">Keine E-Mails vorhanden</p>
        <p className="mt-2 text-sm">
          Verbinde ein E-Mail-Konto unter &quot;Accounts&quot;, um loszulegen.
        </p>
      </div>
    </div>
  )
}
