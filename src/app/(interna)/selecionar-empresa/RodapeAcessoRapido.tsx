'use client'

import { Group, UnstyledButton, Text } from '@mantine/core'
import { IconUser, IconPlus, IconLifebuoy, IconBell } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

interface RodapeAcessoRapidoProps {
  isAdmin: boolean
  onMeusDados: () => void
  onNovaEmpresa: () => void
  onCentralDeAjuda: () => void
}

export default function RodapeAcessoRapido({
  isAdmin,
  onMeusDados,
  onNovaEmpresa,
  onCentralDeAjuda,
}: RodapeAcessoRapidoProps) {
  const router = useRouter()

  return (
    <Group
      justify="center"
      gap="xl"
      py="sm"
      px="md"
      className="bg-white dark:bg-[#1a1b1e] border-t border-gray-200 dark:border-gray-800"
      style={{ position: 'sticky', bottom: 0, zIndex: 100 }}
    >
      <UnstyledButton onClick={onMeusDados}>
        <Group gap={6}>
          <IconUser size={18} className="text-gray-500" />
          <Text size="sm" c="dimmed">Meus Dados</Text>
        </Group>
      </UnstyledButton>

      {isAdmin && (
        <UnstyledButton onClick={onNovaEmpresa}>
          <Group gap={6}>
            <IconPlus size={18} className="text-gray-500" />
            <Text size="sm" c="dimmed">Nova Empresa</Text>
          </Group>
        </UnstyledButton>
      )}

      {isAdmin && (
        <UnstyledButton onClick={() => router.push('/configurador/notificacoes')}>
          <Group gap={6}>
            <IconBell size={18} className="text-gray-500" />
            <Text size="sm" c="dimmed">Enviar Notificação</Text>
          </Group>
        </UnstyledButton>
      )}

      <UnstyledButton onClick={onCentralDeAjuda}>
        <Group gap={6}>
          <IconLifebuoy size={18} className="text-gray-500" />
          <Text size="sm" c="dimmed">Central de Ajuda</Text>
        </Group>
      </UnstyledButton>
    </Group>
  )
}
