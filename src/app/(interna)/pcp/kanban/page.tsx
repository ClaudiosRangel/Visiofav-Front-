'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Group, Card, Badge, Text, ScrollArea, Loader, Center, ThemeIcon } from '@mantine/core'
import { IconGripVertical } from '@tabler/icons-react'
import { api } from '@/lib/api'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RASCUNHO: { label: 'Rascunho', color: 'gray' },
  PLANEJADA: { label: 'Planejada', color: 'blue' },
  PROGRAMADA: { label: 'Programada', color: 'indigo' },
  LIBERADA: { label: 'Liberada', color: 'cyan' },
  EM_PRODUCAO: { label: 'Em Produção', color: 'orange' },
  CONCLUIDA: { label: 'Concluída', color: 'green' },
}

const PRIORIDADE_COLORS: Record<string, string> = {
  BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red',
}

export default function KanbanPage() {
  useEffect(() => { document.title = 'PCP - Kanban' }, [])

  const [colunas, setColunas] = useState<Record<string, any[]>>({})
  const [contadores, setContadores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function carregarKanban() {
    setLoading(true)
    try {
      const res = await api.get('/ordens-producao/kanban')
      setColunas(res.data.colunas)
      setContadores(res.data.contadores)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarKanban() }, [])

  if (loading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Title order={3}>Kanban — Produção</Title>

      <ScrollArea>
        <Group align="flex-start" wrap="nowrap" gap="md" style={{ minWidth: '100%' }}>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const items = colunas[status] || []
            const contador = contadores.find((c) => c.status === status)

            return (
              <Stack key={status} w={280} style={{ flexShrink: 0 }}>
                <Group justify="space-between">
                  <Badge color={config.color} size="lg" variant="light">
                    {config.label}
                  </Badge>
                  <Text size="xs" c="dimmed">{contador?.total || 0} OPs</Text>
                </Group>

                <Stack gap="xs" style={{ minHeight: 200, background: 'var(--mantine-color-gray-0)', borderRadius: 8, padding: 8 }}>
                  {items.length === 0 ? (
                    <Text size="xs" c="dimmed" ta="center" py="lg">Nenhuma OP</Text>
                  ) : (
                    items.map((op) => (
                      <Card key={op.id} withBorder padding="xs" radius="sm" style={{ cursor: 'grab' }}>
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap">
                            <ThemeIcon size="xs" variant="transparent" c="dimmed">
                              <IconGripVertical size={12} />
                            </ThemeIcon>
                            <Text size="sm" fw={600}>OP #{op.numero}</Text>
                          </Group>
                          <Badge size="xs" color={PRIORIDADE_COLORS[op.prioridade]} variant="dot">
                            {op.prioridade}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                          {Number(op.quantidade)} {op.unidadeMedida} • {op.percentualConcluido}%
                        </Text>
                        {op.dataEntregaPrevista && (
                          <Text size="xs" c="dimmed">
                            Entrega: {new Date(op.dataEntregaPrevista).toLocaleDateString('pt-BR')}
                          </Text>
                        )}
                      </Card>
                    ))
                  )}
                </Stack>
              </Stack>
            )
          })}
        </Group>
      </ScrollArea>
    </Stack>
  )
}
