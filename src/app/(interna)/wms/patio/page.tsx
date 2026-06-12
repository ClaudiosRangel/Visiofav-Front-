'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Card, Group, Text, Badge, SimpleGrid, ThemeIcon, LoadingOverlay,
} from '@mantine/core'
import {
  IconTruck, IconClock, IconParking, IconBuildingWarehouse,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

function calcTempoNoPatio(entradaEm: string): { label: string; color: string } {
  const diffMs = Date.now() - new Date(entradaEm).getTime()
  const horas = diffMs / (1000 * 60 * 60)
  const h = Math.floor(horas)
  const m = Math.floor((horas - h) * 60)
  const label = `${h}h${m.toString().padStart(2, '0')}m`

  if (horas < 2) return { label, color: 'green' }
  if (horas < 4) return { label, color: 'yellow' }
  return { label, color: 'red' }
}

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  NA_DOCA: 'Na Doca',
}

const TIPO_LABELS: Record<string, string> = {
  CARGA: 'Carga',
  DESCARGA: 'Descarga',
}

export default function PatioPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Pátio' }, [])

  const eventSourceRef = useRef<EventSource | null>(null)

  const { data: veiculos, isLoading } = useQuery<any[]>({
    queryKey: ['patio-veiculos'],
    queryFn: async () => {
      const { data } = await api.get('/patio/veiculos')
      return data?.data || data || []
    },
    refetchInterval: 15000,
  })

  // SSE connection for real-time dock call notifications (Task 10.7)
  useEffect(() => {
    const es = new EventSource('/api/patio/sse')
    eventSourceRef.current = es

    es.addEventListener('chamada-doca', (event) => {
      const payload = JSON.parse(event.data)
      try {
        new Audio('/notification.mp3').play()
      } catch (_) { /* audio may not be available */ }
      notifications.show({
        title: 'Chamada de Doca',
        message: `Veículo ${payload.placa || ''} chamado para doca ${payload.doca || ''}`,
        color: 'blue',
        autoClose: 10000,
      })
    })

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [])

  const lista = veiculos || []
  const aguardando = lista.filter((v: any) => v.status === 'AGUARDANDO')
  const naDoca = lista.filter((v: any) => v.status === 'NA_DOCA')

  const totalAguardando = aguardando.length
  const totalNaDoca = naDoca.length

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Pátio</Text>
      <Text size="xl" fw={600} mb="lg">Painel do Pátio — Tempo Real</Text>

      {/* Summary */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconTruck size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Total no Pátio</Text>
              <Text size="xl" fw={700}>{lista.length}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconParking size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Aguardando</Text>
              <Text size="xl" fw={700}>{totalAguardando}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconBuildingWarehouse size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Na Doca</Text>
              <Text size="xl" fw={700}>{totalNaDoca}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="gray">
              <IconClock size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Atualização</Text>
              <Text size="sm" fw={500}>A cada 15s</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Aguardando */}
      <Text size="lg" fw={600} mb="sm">Aguardando ({totalAguardando})</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="lg" pos="relative">
        <LoadingOverlay visible={isLoading} />
        {aguardando.map((v: any) => {
          const tempo = calcTempoNoPatio(v.entradaEm)
          return (
            <Card key={v.id} withBorder padding="md">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="lg" className="font-mono">{v.placa}</Text>
                <Badge color={tempo.color} variant="filled">{tempo.label}</Badge>
              </Group>
              <Text size="sm" c="dimmed">Motorista: {v.motoristaNome || '—'}</Text>
              <Text size="sm" c="dimmed">
                Operação: <Badge size="sm" variant="light" color="violet">
                  {TIPO_LABELS[v.tipoOperacao] || v.tipoOperacao}
                </Badge>
              </Text>
            </Card>
          )
        })}
        {aguardando.length === 0 && !isLoading && (
          <Text c="dimmed" size="sm">Nenhum veículo aguardando</Text>
        )}
      </SimpleGrid>

      {/* Na Doca */}
      <Text size="lg" fw={600} mb="sm">Na Doca ({totalNaDoca})</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} pos="relative">
        <LoadingOverlay visible={isLoading} />
        {naDoca.map((v: any) => {
          const tempo = calcTempoNoPatio(v.entradaEm)
          return (
            <Card key={v.id} withBorder padding="md">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="lg" className="font-mono">{v.placa}</Text>
                <Badge color={tempo.color} variant="filled">{tempo.label}</Badge>
              </Group>
              <Text size="sm" c="dimmed">Motorista: {v.motoristaNome || '—'}</Text>
              <Text size="sm" c="dimmed">
                Operação: <Badge size="sm" variant="light" color="violet">
                  {TIPO_LABELS[v.tipoOperacao] || v.tipoOperacao}
                </Badge>
              </Text>
              {v.docaNome && (
                <Text size="sm" c="dimmed">Doca: {v.docaNome}</Text>
              )}
            </Card>
          )
        })}
        {naDoca.length === 0 && !isLoading && (
          <Text c="dimmed" size="sm">Nenhum veículo na doca</Text>
        )}
      </SimpleGrid>
    </div>
  )
}
