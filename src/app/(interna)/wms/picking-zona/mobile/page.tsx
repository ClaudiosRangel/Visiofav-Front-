'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, Stack, Checkbox, Badge, Progress,
  LoadingOverlay, ColorSwatch,
} from '@mantine/core'
import { IconPackage } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

interface ItemPicking {
  id: string
  produtoNome: string
  produtoCodigo: string
  quantidade: number
  endereco: string
  concluido: boolean
}

interface MinhaZona {
  zonaId: string
  zonaNome: string
  zonaCor: string
}

export default function MobilePickingZonaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - Picking Mobile' }, [])

  const queryClient = useQueryClient()

  const { data: minhaZona } = useQuery<MinhaZona>({
    queryKey: ['picking-zona', 'minha-zona'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/minha-zona')
      return data
    },
  })

  const { data: itens = [], isLoading } = useQuery<ItemPicking[]>({
    queryKey: ['picking-zona', 'meus-itens'],
    queryFn: async () => {
      const { data } = await api.get('/picking-zona/meus-itens')
      return data
    },
  })

  const marcarMutation = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      await api.patch(`/picking-zona/itens/${id}/concluir`, { concluido })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-zona', 'meus-itens'] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao atualizar item', color: 'red' })
    },
  })

  const totalItens = itens.length
  const concluidos = itens.filter((i) => i.concluido).length
  const percentual = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      {minhaZona && (
        <Card withBorder mb="md" padding="sm">
          <Group gap="sm">
            <ColorSwatch color={minhaZona.zonaCor} size={24} />
            <div>
              <Text size="xs" c="dimmed">Minha Zona</Text>
              <Text fw={600}>{minhaZona.zonaNome}</Text>
            </div>
          </Group>
        </Card>
      )}

      {/* Progress */}
      <Card withBorder mb="md" padding="sm">
        <Group justify="space-between" mb={4}>
          <Text size="sm" fw={500}>Progresso</Text>
          <Badge variant="light" color={percentual >= 100 ? 'green' : 'blue'}>
            {concluidos}/{totalItens}
          </Badge>
        </Group>
        <Progress
          value={percentual}
          color={percentual >= 100 ? 'green' : 'blue'}
          size="md"
          radius="md"
          animated={percentual < 100}
        />
      </Card>

      {/* Itens */}
      <LoadingOverlay visible={isLoading} />
      <Stack gap="sm">
        {itens.map((item) => (
          <Card
            key={item.id}
            withBorder
            padding="sm"
            style={{
              opacity: item.concluido ? 0.6 : 1,
              borderLeftWidth: 4,
              borderLeftColor: item.concluido ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-blue-5)',
            }}
          >
            <Group wrap="nowrap" gap="sm">
              <Checkbox
                checked={item.concluido}
                onChange={(e) => marcarMutation.mutate({
                  id: item.id,
                  concluido: e.currentTarget.checked,
                })}
                size="md"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {item.produtoNome}
                </Text>
                <Group gap="xs">
                  <Text size="xs" c="dimmed" className="font-mono">
                    {item.produtoCodigo}
                  </Text>
                  <Text size="xs" c="dimmed">•</Text>
                  <Text size="xs" c="dimmed">
                    Qtd: {item.quantidade}
                  </Text>
                </Group>
                <Group gap={4} mt={2}>
                  <IconPackage size={12} className="text-zinc-400" />
                  <Text size="xs" c="dimmed">{item.endereco}</Text>
                </Group>
              </div>
            </Group>
          </Card>
        ))}

        {itens.length === 0 && !isLoading && (
          <Card withBorder>
            <Text c="dimmed" ta="center" py="xl">
              Nenhum item pendente na sua zona
            </Text>
          </Card>
        )}
      </Stack>
    </div>
  )
}
