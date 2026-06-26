'use client'

export default function StatusCard() {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
      <div>
        <p className="text-sm font-semibold text-gray-900 leading-tight">ONLINE</p>
        <p className="text-xs text-gray-500">Sistema operacional</p>
      </div>
    </div>
  )
}
