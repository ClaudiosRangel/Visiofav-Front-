'use client'

import { useEffect, useState } from 'react'
import { Stack, Title, Text, Group, Button, Card, Badge, Loader, Center, Timeline, ThemeIcon } from '@mantine/core'
import { IconArrowLeft, IconPlus, IconArrowRight, IconCheck, IconX, IconHammer, IconAlertTriangle, IconPlayerPause, IconPlayerPlay, IconPackage, IconNote } from '@tabler/icons-react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray', PLANEJADA: 'blue', PROGRAMADA: 'indigo', LIBERADA: 'cyan',
  EM_PRODUCAO: 'orange', CONCLUIDA: 'green', CANCELADA: 'red',
}

const ICONE_MAP: Record<string, any> = {
  plus: IconPlus,
  'arrow-right': IconArrowRight,
  check: IconCheck,
  x: IconX,
  hammer: IconHammer,
  alert: IconAlertTriangle,
  pause: IconPlayerPause,
  play: IconPlayerPlay,
  package: IconPackage,
  note: IconNote,
}

type EventoTimeline = {
  tipo: string
  data: string
  titulo: string
  descricao: string | null
  usuario: string | null
  cor: string
  icone: string
}

export default function HistoricoOpPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [opInfo, setOpInfo] = useState<any>(null)
  const [eventos, setEventos] = useState<EventoTimeline[]>([])

  useEffect(() => { document.title = 'PCP - Histórico da OP' }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/ordens-producao/${id}/historico`)
      .then((res) => {
        setOpInfo(res.data.op)
        setEventos(res.data.eventos)
      })
      .catch(() => setEventos([]))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push(`/pcp/ordens-producao/${id}`)}>
          Voltar
        </Button>
        <Title order={3}>Histórico — OP #{opInfo?.numero || '?'}</Title>
        {opInfo?.status && <Badge color={STATUS_COLORS[opInfo.status] || 'gray'} size="lg">{opInfo.status}</Badge>}
      </Group>

      <Text size="sm" c="dimmed">
        Timeline completa de tudo que aconteceu com esta Ordem de Produção — desde a criação/importação até o estado atual.
      </Text>

      {eventos.length === 0 ? (
        <Card withBorder>
          <Text ta="center" c="dimmed" py="xl">Nenhum evento registrado para esta OP.</Text>
        </Card>
      ) : (
        <Card withBorder p="lg">
          <Timeline active={eventos.length - 1} bulletSize={28} lineWidth={2}>
            {eventos.map((evento, idx) => {
              const Icone = ICONE_MAP[evento.icone] || IconNote
              return (
                <Timeline.Item
                  key={idx}
                  bullet={
                    <ThemeIcon size={28} variant="filled" color={evento.cor} radius="xl">
                      <Icone size={14} />
                    </ThemeIcon>
                  }
                  title={
                    <Text size="sm" fw={600}>{evento.titulo}</Text>
                  }
                >
                  <Group gap="xs" mt={2}>
                    <Text size="xs" c="dimmed">
                      {new Date(evento.data).toLocaleDateString('pt-BR')} às {new Date(evento.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {evento.usuario && (
                      <Badge size="xs" variant="light" color="gray">{evento.usuario}</Badge>
                    )}
                    <Badge size="xs" variant="dot" color={evento.cor}>{evento.tipo}</Badge>
                  </Group>
                  {evento.descricao && (
                    <Text size="xs" c="dimmed" mt={4} style={{ maxWidth: 600 }}>{evento.descricao}</Text>
                  )}
                </Timeline.Item>
              )
            })}
          </Timeline>
        </Card>
      )}

      <Text size="xs" c="dimmed" ta="right">{eventos.length} evento(s) registrado(s)</Text>
    </Stack>
  )
}
