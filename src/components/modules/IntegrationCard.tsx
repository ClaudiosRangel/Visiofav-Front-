'use client'

import { IconCircleCheck } from '@tabler/icons-react'

export default function IntegrationCard() {
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-[20px] h-[260px] p-8 overflow-hidden"
      style={{ backgroundColor: '#ECFDF5' }}
    >
      {/* Decorative illustration */}
      <div className="relative mb-4">
        {/* Monitor shape */}
        <div className="w-32 h-20 rounded-lg bg-white/80 border border-green-200 shadow-sm flex items-center justify-center gap-2">
          {/* Mini chart bars */}
          <div className="flex items-end gap-1 h-10">
            <div className="w-2 h-4 rounded-sm bg-green-300" />
            <div className="w-2 h-7 rounded-sm bg-green-400" />
            <div className="w-2 h-5 rounded-sm bg-green-300" />
            <div className="w-2 h-9 rounded-sm bg-green-500" />
            <div className="w-2 h-6 rounded-sm bg-green-400" />
          </div>
        </div>
        {/* Check badge */}
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-md">
          <IconCircleCheck size={20} color="white" fill="#16A34A" />
        </div>
      </div>

      {/* Text */}
      <p className="text-base font-bold text-gray-900 text-center mt-2">
        Tudo em um só lugar
      </p>
      <p className="text-sm text-gray-600 text-center mt-1 leading-relaxed">
        Integração completa entre os módulos
        <br />
        para uma gestão mais eficiente.
      </p>

      {/* Bottom bar */}
      <div className="w-16 h-1.5 rounded-full bg-gray-700 mt-4" />
    </div>
  )
}
