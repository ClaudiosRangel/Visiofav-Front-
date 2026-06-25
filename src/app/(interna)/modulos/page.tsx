'use client'

import { useEffect, useState } from 'react'
import { Card, SimpleGrid, Text, Title, ThemeIcon, UnstyledButton, Center, Stack, Button, Modal, Checkbox, Group, Loader } from '@mantine/core'
import {
  IconShoppingCart,
  IconReceipt,
  IconCash,
  IconBuildingWarehouse,
  IconTruck,
  IconSettings,
  IconTrash,
  IconAssembly,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/providers/EmpresaProvider'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { getUserPerfil } from '@/hooks/usePerfilGuard'

const MODULOS_CONFIG = [
  { modulo: 'COMPRAS', label: 'Compras', icon: IconShoppingCart, href: '/compras/pedidos', color: 'blue' },
  { modulo: 'VENDAS', label: 'Vendas', icon: IconReceipt, href: '/vendas/pedidos', color: 'green' },
  { modulo: 'FINANCEIRO', label: 'Financeiro', icon: IconCash, href: '/financeiro/contas-pagar', color: 'yellow' },
  { modulo: 'WMS', label: 'WMS', icon: IconBuildingWarehouse, href: '/recebimento', color: 'primary' },
  { modulo: 'PCP', label: 'PCP', icon: IconAssembly, href: '/pcp/dashboard', color: 'violet' },
  { modulo: 'CTE', label: 'Fiscal', icon: IconTruck, href: '/fiscal/nfe', color: 'orange' },
  { modulo: 'CONFIGURADOR', label: 'Configurador', icon: IconSettings, href: '/configurador', color: 'grape' },
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
  useEffect(() => { document.title = 'Vizor - Módulos' }, [])
  const router = useRouter()
  const { modulos, empresa } = useEmpresa()

  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([])
  const [confirmStep, setConfirmStep] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const modulosVisiveis = MODULOS_CONFIG.filter((m) => m.modulo === 'CONFIGURADOR' || modulos.includes(m.modulo))

  useEffect(() => {
    const perfil = getUserPerfil()
    setIsAdmin(perfil === 'SUPER_ADMIN')
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
      const { data } = await api.delete('/admin/limpar-dados', { data: { modulos: modulosSelecionados } })
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
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)', gap: 0 }}>
      {/* Lado esquerdo — Logo grande (hidden mobile) */}
      <div className="hidden md:flex" style={{
        flex: '0 0 320px',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderRight: '1px solid #e2e8f0',
        borderRadius: '0 24px 24px 0',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpeg"
          alt="Vizor"
          style={{ width: 200, height: 200, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}
        />
      </div>

      {/* Lado direito — Módulos */}
      <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }} className="md:!px-10">
        <Stack gap="lg">
          <Title order={2}>
            Módulos{empresa ? ` — ${empresa.nomeFantasia || empresa.razaoSocial}` : ''}
          </Title>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {modulosVisiveis.map((m) => (
          <UnstyledButton key={m.label} onClick={() => window.open(m.href, '_blank')}>
            <Card withBorder style={{ cursor: 'pointer' }} className="hover:shadow-md transition-shadow">
              <Stack align="center" gap="sm" py="md">
                <ThemeIcon color={m.color} variant="light" size={56} radius="md">
                  <m.icon size={28} />
                </ThemeIcon>
                <Text fw={600} size="lg">
                  {m.label}
                </Text>
              </Stack>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>

      {/* Botão de Limpeza de Dados - apenas para SUPER_ADMIN */}
      {isAdmin && (
        <Button
          variant="light"
          color="red"
          leftSection={<IconTrash size={18} />}
          onClick={handleOpenCleanup}
          mt="xl"
          w="fit-content"
        >
          Limpar Dados
        </Button>
      )}

      {/* Modal de seleção de módulos para limpeza */}
      {isAdmin && (
        <Modal
          opened={cleanupOpen}
          onClose={() => { setCleanupOpen(false); setConfirmStep(false); setModulosSelecionados([]) }}
          title="Limpar Dados"
          centered
          size="md"
        >
          {!confirmStep ? (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Selecione os módulos cujos dados deseja apagar. Os cadastros base (produtos, clientes, fornecedores, empresa) serão mantidos.
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
              >
                Continuar ({modulosSelecionados.length} módulo{modulosSelecionados.length !== 1 ? 's' : ''})
              </Button>
            </Stack>
          ) : (
            <Stack gap="md">
              <Text size="sm" fw={600} c="red">
                ⚠️ Ação irreversível!
              </Text>
              <Text size="sm">
                Confirma a exclusão de todos os dados dos módulos:
              </Text>
              <Stack gap={4}>
                {modulosSelecionados.map((m) => (
                  <Text key={m} size="sm" fw={500}>• {MODULOS_LIMPEZA.find((x) => x.value === m)?.label}</Text>
                ))}
              </Stack>

              <Group grow mt="sm">
                <Button
                  variant="default"
                  onClick={() => setConfirmStep(false)}
                >
                  Voltar
                </Button>
                <Button
                  color="red"
                  onClick={handleCleanup}
                  loading={loading}
                >
                  Confirmar Limpeza
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      )}
        </Stack>
      </div>
    </div>
  )
}
