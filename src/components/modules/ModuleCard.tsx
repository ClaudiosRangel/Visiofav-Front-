'use client'

import { Text } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'

interface ModuleCardProps {
  label: string
  description: string
  icon: React.ElementType
  color: string
  onClick: () => void
}

export default function ModuleCard({ label, description, icon: Icon, color, onClick }: ModuleCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start bg-white rounded-[20px] p-8 h-[260px] border border-gray-200 cursor-pointer text-left transition-all duration-250 ease-out hover:-translate-y-1.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
      }}
      aria-label={`Acessar módulo ${label}`}
    >
      {/* Top color bar */}
      <div
        className="absolute top-0 left-6 right-6 h-1 rounded-b-full transition-all duration-250 group-hover:left-4 group-hover:right-4"
        style={{ backgroundColor: color }}
      />

      {/* Icon */}
      <div
        className="flex items-center justify-center w-14 h-14 rounded-2xl mb-5 transition-transform duration-250 group-hover:scale-105"
        style={{ backgroundColor: `${color}14` }}
      >
        <Icon size={28} stroke={1.5} style={{ color }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <Text fw={700} size="lg" c="#111827" className="mb-2">
          {label}
        </Text>
        <Text size="sm" c="#6B7280" className="leading-relaxed">
          {description}
        </Text>
      </div>

      {/* Action link */}
      <div className="flex items-center gap-1.5 mt-4 transition-colors duration-250" style={{ color }}>
        <Text size="sm" fw={600}>
          Acessar módulo
        </Text>
        <IconArrowRight size={16} className="transition-transform duration-250 group-hover:translate-x-1" />
      </div>
    </button>
  )
}
