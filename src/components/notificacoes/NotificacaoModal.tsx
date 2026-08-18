'use client'

import { Modal, Text, Badge, Group, Stack, Divider } from '@mantine/core'
import { IconAlertCircle, IconInfoCircle, IconSparkles, IconMessage, IconQuestionMark } from '@tabler/icons-react'
import type { Notificacao } from '@/data/hooks/useNotificacoes'

interface NotificacaoModalProps {
  notificacao: Notificacao | null
  opened: boolean
  onClose: () => void
}

function getBadgeTipo(tipo: string) {
  switch (tipo) {
    case 'ALERTA': return <Badge color="red" variant="light" leftSection={<IconAlertCircle size={12} />}>Alerta</Badge>
    case 'INFORMACAO': return <Badge color="blue" variant="light" leftSection={<IconInfoCircle size={12} />}>Informação</Badge>
    case 'NOVIDADE': return <Badge color="green" variant="light" leftSection={<IconSparkles size={12} />}>Novidade</Badge>
    case 'RECADO': return <Badge color="orange" variant="light" leftSection={<IconMessage size={12} />}>Recado</Badge>
    case 'DUVIDA': return <Badge color="violet" variant="light" leftSection={<IconQuestionMark size={12} />}>Dúvida</Badge>
    default: return <Badge variant="light">{tipo}</Badge>
  }
}

export function NotificacaoModal({ notificacao, opened, onClose }: NotificacaoModalProps) {
  if (!notificacao) return null

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={notificacao.titulo}
      size="md"
    >
      <Stack gap="sm">
        <Group gap="sm">
          {getBadgeTipo(notificacao.tipo)}
          <Text size="xs" c="dimmed">
            De: {notificacao.remetente}
          </Text>
          <Text size="xs" c="dimmed">
            {new Date(notificacao.criadoEm).toLocaleString('pt-BR')}
          </Text>
        </Group>
        <Divider />
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {notificacao.mensagem}
        </Text>
        {notificacao.lidaEm && (
          <>
            <Divider />
            <Text size="xs" c="dimmed">
              Lida em: {new Date(notificacao.lidaEm).toLocaleString('pt-BR')}
            </Text>
          </>
        )}
      </Stack>
    </Modal>
  )
}
