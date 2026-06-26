'use client'

import { Text, UnstyledButton, Stack, Divider, Collapse } from '@mantine/core'
import {
  IconLayoutDashboard,
  IconApps,
  IconStar,
  IconChartBar,
  IconChartColumn,
  IconSettings,
  IconUsers,
  IconShieldCheck,
  IconFileText,
  IconHeadset,
  IconChevronDown,
  IconChevronRight,
  IconTrash,
} from '@tabler/icons-react'
import { useEmpresa } from '@/providers/EmpresaProvider'
import { useState } from 'react'

interface SidebarItemProps {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
  color?: string
}

function SidebarItem({ icon: Icon, label, active, onClick, color }: SidebarItemProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm ${
        active
          ? 'bg-green-50 text-green-700 font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
      }`}
      style={color ? { color } : undefined}
    >
      <Icon size={20} stroke={1.5} />
      <Text size="sm" fw={active ? 600 : 400} style={color ? { color } : undefined}>
        {label}
      </Text>
    </UnstyledButton>
  )
}

interface ModulesSidebarProps {
  collapsed: boolean
  onToggle: () => void
  isAdmin?: boolean
  onCleanup?: () => void
}

export default function ModulesSidebar({ collapsed, onToggle, isAdmin, onCleanup }: ModulesSidebarProps) {
  const { empresa } = useEmpresa()
  const [configOpen, setConfigOpen] = useState(false)

  if (collapsed) return null

  return (
    <aside className="fixed left-0 top-[72px] bottom-0 w-[250px] bg-white border-r border-gray-100 flex flex-col z-40 overflow-y-auto">
      {/* Empresa info */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <Text size="sm" fw={700} className="truncate text-gray-900">
              {empresa?.nomeFantasia || empresa?.razaoSocial || 'Empresa'}
            </Text>
            <Text size="xs" c="dimmed" className="truncate">
              Unidade Matriz
            </Text>
          </div>
          <IconChevronDown size={14} className="text-gray-400" />
        </div>
      </div>

      {/* Navigation */}
      <Stack gap={2} className="px-3 flex-1">
        <SidebarItem icon={IconApps} label="Módulos" active />
        <SidebarItem icon={IconLayoutDashboard} label="Dashboard" />
        <SidebarItem icon={IconStar} label="Favoritos" />
        <SidebarItem icon={IconChartBar} label="Relatórios" />
        <SidebarItem icon={IconChartColumn} label="Indicadores" />

        <Divider my="sm" label="ADMINISTRAÇÃO" labelPosition="left" styles={{ label: { fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' } }} />

        {/* Configurações com sub-menu */}
        <UnstyledButton
          onClick={() => setConfigOpen(!configOpen)}
          className="flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800"
        >
          <div className="flex items-center gap-3">
            <IconSettings size={20} stroke={1.5} />
            <Text size="sm">Configurações</Text>
          </div>
          {configOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </UnstyledButton>
        <Collapse in={configOpen}>
          <Stack gap={1} className="pl-4">
            {isAdmin && (
              <SidebarItem icon={IconTrash} label="Limpar Dados" onClick={onCleanup} color="#EF4444" />
            )}
          </Stack>
        </Collapse>

        <SidebarItem icon={IconUsers} label="Usuários" />
        <SidebarItem icon={IconShieldCheck} label="Permissões" />
        <SidebarItem icon={IconFileText} label="Logs" />
      </Stack>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <SidebarItem icon={IconHeadset} label="Suporte" />
      </div>
    </aside>
  )
}
