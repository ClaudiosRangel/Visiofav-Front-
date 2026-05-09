'use client'

import { useEffect, useState } from 'react'
import { Card, SimpleGrid, Text, Title, ThemeIcon, UnstyledButton, Center, Stack, Button, Modal, PasswordInput, Loader } from '@mantine/core'
import {
  IconShoppingCart,
  IconReceipt,
  IconCash,
  IconBuildingWarehouse,
  IconTruck,
  IconSettings,
  IconTrash,
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
  { modulo: 'CTE', label: 'Fiscal', icon: IconTruck, href: '/fiscal/nfe', color: 'orange' },
  { modulo: 'PCP', label: 'Configurador', icon: IconSettings, href: '/configurador', color: 'grape' },
] as const

export default function ModulosPage() {
  useEffect(() => { document.title = 'VisioFab - Módulos' }, [])
  const router = useRouter()
  const { modulos, empresa } = useEmpresa()

  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)

  const modulosVisiveis = MODULOS_CONFIG.filter((m) => modulos.includes(m.modulo))
  const perfil = getUserPerfil()
  const isAdmin = perfil === 'SUPER_ADMIN'

  async function handleCleanup() {
    if (!senha) return
    setLoading(true)
    try {
      const { data } = await api.post('/admin/cleanup', { senha })
      if (data.done) {
        notifications.show({
          title: 'Limpeza concluída',
          message: 'Todos os dados operacionais foram removidos com sucesso.',
          color: 'green',
          position: 'top-right',
          autoClose: 5000,
        })
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao executar limpeza'
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
      setSenha('')
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
    <Stack gap="lg">
      <Title order={2}>
        Módulos{empresa ? ` — ${empresa.nomeFantasia || empresa.razaoSocial}` : ''}
      </Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {modulosVisiveis.map((m) => (
          <UnstyledButton key={m.modulo} onClick={() => window.open(m.href, '_blank')}>
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
          onClick={() => setCleanupOpen(true)}
          mt="xl"
          w="fit-content"
        >
          Limpar Dados
        </Button>
      )}

      {/* Modal de confirmação com senha */}
      {isAdmin && (
        <Modal
          opened={cleanupOpen}
          onClose={() => { setCleanupOpen(false); setSenha('') }}
          title="Limpeza de Dados"
          centered
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Esta ação irá remover todos os dados operacionais (pedidos, estoque, notas, funcionários, etc.).
              Serão mantidos: empresa, CD, depósitos, zonas, estruturas, docas, produtos, SKUs, parâmetros e o usuário admin.
            </Text>
            <Text size="sm" c="red" fw={600}>
              Esta ação é irreversível!
            </Text>
            <PasswordInput
              label="Senha de confirmação"
              placeholder="Digite a senha para confirmar"
              value={senha}
              onChange={(e) => setSenha(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCleanup() }}
            />
            <Button
              color="red"
              onClick={handleCleanup}
              loading={loading}
              disabled={!senha}
              fullWidth
            >
              Confirmar Limpeza
            </Button>
          </Stack>
        </Modal>
      )}
    </Stack>
  )
}
