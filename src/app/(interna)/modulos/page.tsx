'use client'

import { useEffect, useState } from 'react'
import { Text, Title, Button, Modal, Checkbox, Group, Stack, Center } from '@mantine/core'
import {
  IconShoppingCart,
  IconReceipt,
  IconWallet,
  IconBuildingWarehouse,
  IconSettingsAutomation,
  IconFileText,
  IconSettings,
  IconMenu2,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/providers/EmpresaProvider'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { getUserPerfil } from '@/hooks/usePerfilGuard'

import ModulesHeader from '@/components/modules/ModulesHeader'
import ModulesSidebar from '@/components/modules/ModulesSidebar'
import ModuleCard from '@/components/modules/ModuleCard'
import StatusCard from '@/components/modules/StatusCard'
import QuickActions from '@/components/modules/QuickActions'
import IntegrationCard from '@/components/modules/IntegrationCard'

const MODULOS_CONFIG = [
  {
    modulo: 'COMPRAS',
    label: 'Compras',
    description: 'Gerencie cotações, pedidos e fornecedores.',
    icon: IconShoppingCart,
    href: '/compras/pedidos',
    color: '#2563EB',
  },
  {
    modulo: 'VENDAS',
    label: 'Vendas',
    description: 'Controle pedidos, clientes, NF-e e faturamento.',
    icon: IconReceipt,
    href: '/vendas/pedidos',
    color: '#16A34A',
  },
  {
    modulo: 'FINANCEIRO',
    label: 'Financeiro',
    description: 'Contas a pagar, receber, fluxo de caixa e conciliações.',
    icon: IconWallet,
    href: '/financeiro/contas-pagar',
    color: '#F59E0B',
  },
  {
    modulo: 'WMS',
    label: 'WMS',
    description: 'Gestão de estoque, endereços, recebimentos e expedições.',
    icon: IconBuildingWarehouse,
    href: '/recebimento',
    color: '#4F46E5',
  },
  {
    modulo: 'PCP',
    label: 'PCP',
    description: 'Planejamento e controle da produção.',
    icon: IconSettingsAutomation,
    href: '/pcp/dashboard',
    color: '#7C3AED',
  },
  {
    modulo: 'CTE',
    label: 'Fiscal',
    description: 'Notas fiscais, impostos e obrigações fiscais.',
    icon: IconFileText,
    href: '/fiscal/nfe',
    color: '#EF4444',
  },
  {
    modulo: 'CONFIGURADOR',
    label: 'Configurador',
    description: 'Parâmetros do sistema, integrações e preferências.',
    icon: IconSettings,
    href: '/configurador',
    color: '#EC4899',
  },
] as const

const MODULOS_LIMPEZA = [
  { value: 'pcp', label: 'PCP (ordens, apontamentos, roteiros, estruturas)' },
  { value: 'wms', label: 'WMS (ondas, separações, conferências, inventários, notas)' },
  { value: 'vendas', label: 'Vendas (pedidos, vendas efetivadas)' },
  { value: 'compras', label: 'Compras (pedidos, compras efetivadas, devoluções)' },
  { value: 'financeiro', label: 'Financeiro (contas a pagar e receber)' },
  { value: 'fiscal', label: 'Fiscal (NF-e, CT-e)' },
]

export default function ModulosPage() {
  useEffect(() => {
    document.title = 'Vizor - Módulos'
  }, [])

  const router = useRouter()
  const { modulos, empresa } = useEmpresa()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([])
  const [confirmStep, setConfirmStep] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const modulosVisiveis = MODULOS_CONFIG.filter(
    (m) => m.modulo === 'CONFIGURADOR' || modulos.includes(m.modulo)
  )

  useEffect(() => {
    const perfil = getUserPerfil()
    setIsAdmin(perfil === 'SUPER_ADMIN')
  }, [])

  // Responsive: collapse sidebar on mobile
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function handleOpenCleanup() {
    setModulosSelecionados([])
    setConfirmStep(false)
    setCleanupOpen(true)
  }

  function handleToggleModulo(modulo: string) {
    setModulosSelecionados((prev) =>
      prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo]
    )
  }

  async function handleCleanup() {
    if (modulosSelecionados.length === 0) return
    setLoading(true)
    try {
      const { data } = await api.delete('/admin/limpar-dados', {
        data: { modulos: modulosSelecionados },
      })
      notifications.show({
        title: 'Limpeza concluída',
        message: data.message || `Módulos limpos: ${modulosSelecionados.join(', ')}`,
        color: 'green',
        position: 'top-right',
        autoClose: 5000,
      })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao executar limpeza'
      notifications.show({
        title: 'Erro',
        message: msg,
        color: 'red',
        position: 'top-right',
        autoClose: 5000,
      })
    } finally {
      setLoading(false)
      setCleanupOpen(false)
      setConfirmStep(false)
      setModulosSelecionados([])
    }
  }

  // === BACKUP ===
  async function handleBackup() {
    try {
      const response = await api.get('/admin/backup', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-visiofab-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      notifications.show({ title: 'Backup realizado', message: 'Arquivo salvo na sua máquina', color: 'green', position: 'top-right' })
    } catch (err: any) {
      // responseType 'blob' faz com que o corpo de erro do backend também venha
      // como Blob, então err.response.data.message fica undefined. Precisamos
      // ler o Blob como texto para extrair a mensagem real do backend.
      let msg = 'Falha ao gerar backup'
      const errorBlob = err?.response?.data
      if (errorBlob instanceof Blob) {
        try {
          const text = await errorBlob.text()
          const parsed = JSON.parse(text)
          msg = parsed?.message || msg
        } catch {
          // corpo não era JSON válido — mantém mensagem genérica
        }
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message
      }
      notifications.show({ title: 'Erro no backup', message: msg, color: 'red', position: 'top-right' })
    }
  }

  // === RESTAURAR ===
  async function handleRestaurar(file: File) {
    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      if (!backup?._meta?.versao) {
        notifications.show({ title: 'Arquivo inválido', message: 'Este não é um arquivo de backup válido do VisioFab', color: 'red', position: 'top-right' })
        return
      }
      const { data } = await api.post('/admin/restaurar', backup)
      notifications.show({ title: 'Restauração concluída', message: data.message || 'Dados restaurados com sucesso', color: 'green', position: 'top-right' })
    } catch (err: any) {
      notifications.show({ title: 'Erro na restauração', message: err?.response?.data?.message || 'Falha ao restaurar', color: 'red', position: 'top-right' })
    }
  }

  if (modulosVisiveis.length === 0) {
    return (
      <Center h="60vh">
        <Text size="lg" c="dimmed">
          Nenhum módulo disponível para esta empresa.
        </Text>
      </Center>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-default)' }}>
      {/* Header */}
      <ModulesHeader />

      <div className="flex">
        {/* Sidebar */}
        <ModulesSidebar
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isAdmin={isAdmin}
          onCleanup={handleOpenCleanup}
          onBackup={handleBackup}
          onRestore={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) handleRestaurar(file)
            }
            input.click()
          }}
        />

        {/* Toggle sidebar button (mobile) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed bottom-4 left-4 z-50 md:hidden bg-white border border-gray-200 rounded-full p-3 shadow-lg"
          aria-label="Alternar menu lateral"
        >
          <IconMenu2 size={20} />
        </button>

        {/* Main content */}
        <main
          className={`flex-1 min-h-[calc(100vh-72px)] transition-all duration-300 ${
            sidebarOpen ? 'md:ml-[250px]' : ''
          }`}
        >
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
              <div>
                <Title
                  order={2}
                  fw={700}
                  style={{ color: '#111827', fontSize: '1.75rem' }}
                >
                  Módulos{empresa ? ` — ${empresa.nomeFantasia || empresa.razaoSocial}` : ''}
                </Title>
                <Text size="md" c="#6B7280" mt={4}>
                  Acesse os módulos do sistema de forma rápida e eficiente.
                </Text>
              </div>
              <StatusCard />
            </div>

            {/* Module cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
              {modulosVisiveis.map((m) => (
                <ModuleCard
                  key={m.modulo}
                  label={m.label}
                  description={m.description}
                  icon={m.icon}
                  color={m.color}
                  onClick={() => window.open(m.href, '_blank')}
                />
              ))}
              {/* Card promocional */}
              <IntegrationCard />
            </div>

            {/* Quick actions */}
            <QuickActions />
          </div>

          {/* Footer */}
          <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1b1e] px-6 lg:px-10 py-4">
            <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <Text size="xs" c="#9CA3AF">
                © {new Date().getFullYear()} VIZOR ERP — Todos os direitos reservados.
              </Text>
            </div>
          </footer>
        </main>
      </div>

      {/* Cleanup Modal */}
      {isAdmin && (
        <Modal
          opened={cleanupOpen}
          onClose={() => {
            setCleanupOpen(false)
            setConfirmStep(false)
            setModulosSelecionados([])
          }}
          title="Limpar Dados"
          centered
          size="md"
          radius="lg"
        >
          {!confirmStep ? (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Selecione os módulos cujos dados deseja apagar. Os cadastros base (produtos,
                clientes, fornecedores, empresa) serão mantidos.
              </Text>

              <Stack gap="xs">
                {MODULOS_LIMPEZA.map((m) => (
                  <Checkbox
                    key={m.value}
                    label={m.label}
                    checked={modulosSelecionados.includes(m.value)}
                    onChange={() => handleToggleModulo(m.value)}
                  />
                ))}
              </Stack>

              <Button
                color="red"
                variant="light"
                onClick={() => setConfirmStep(true)}
                disabled={modulosSelecionados.length === 0}
                fullWidth
                mt="sm"
                radius="md"
              >
                Continuar ({modulosSelecionados.length} módulo
                {modulosSelecionados.length !== 1 ? 's' : ''})
              </Button>
            </Stack>
          ) : (
            <Stack gap="md">
              <Text size="sm" fw={600} c="red">
                ⚠️ Ação irreversível!
              </Text>
              <Text size="sm">Confirma a exclusão de todos os dados dos módulos:</Text>
              <Stack gap={4}>
                {modulosSelecionados.map((m) => (
                  <Text key={m} size="sm" fw={500}>
                    • {MODULOS_LIMPEZA.find((x) => x.value === m)?.label}
                  </Text>
                ))}
              </Stack>

              <Group grow mt="sm">
                <Button variant="default" onClick={() => setConfirmStep(false)} radius="md">
                  Voltar
                </Button>
                <Button color="red" onClick={handleCleanup} loading={loading} radius="md">
                  Confirmar Limpeza
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      )}
    </div>
  )
}
