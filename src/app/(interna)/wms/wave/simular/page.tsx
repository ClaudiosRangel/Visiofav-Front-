'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, Badge, Button, LoadingOverlay,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconPlayerPlay, IconCheck, IconWaveSine, IconTruck, IconMapPin } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function WaveSimularPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Wave Simulação' }, [])
  const queryClient = useQueryClient()

  const [data, setData] = useState<Date | null>(new Date())
  const [resultado, setResultado] = useState<any>(null)

  const simular = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('Selecione uma data')
      const { data: resp } = await api.post('/wave/simular', {
        data: data.toISOString().split('T')[0],
      })
      return resp
    },
    onSuccess: (resp) => {
      setResultado(resp)
      notifications.show({ title: 'Simulação concluída', message: `${resp.ondas?.length || 0} onda(s) simulada(s)`, color: 'blue' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha na simulação', color: 'red' })
    },
  })

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!resultado?.simulacaoId) throw new Error('Nenhuma simulação')
      const { data: resp } = await api.post(`/wave/simular/${resultado.simulacaoId}/confirmar`)
      return resp
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wave-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['wave-planejamentos'] })
      setResultado(null)
      notifications.show({ title: 'Confirmado', message: 'Ondas geradas com sucesso!', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar', color: 'red' })
    },
  })

  const ondas = resultado?.ondas || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Wave Planning / Simulação</Text>
      <Text size="xl" fw={600} mb="lg">Simulação de Ondas</Text>

      <Card mb="xl">
        <Group>
          <DatePickerInput
            label="Data para simulação"
            value={data}
            onChange={setData}
            className="w-48"
            valueFormat="DD/MM/YYYY"
          />
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            onClick={() => simular.mutate()}
            loading={simular.isPending}
            disabled={!data}
            mt={24}
          >
            Simular
          </Button>
          {resultado && ondas.length > 0 && (
            <Button
              leftSection={<IconCheck size={16} />}
              color="green"
              onClick={() => {
                if (confirm('Confirmar e gerar ondas reais?')) confirmar.mutate()
              }}
              loading={confirmar.isPending}
              mt={24}
            >
              Confirmar e Gerar Ondas
            </Button>
          )}
        </Group>
      </Card>

      {/* Resultado da Simulação */}
      {simular.isPending && <LoadingOverlay visible />}

      {resultado && (
        <>
          <Group justify="space-between" mb="md">
            <Text fw={600}>Resultado da Simulação</Text>
            <Badge variant="light" size="lg">
              {ondas.length} onda(s) • {resultado.totalPedidos || 0} pedidos • {resultado.totalItens || 0} itens
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {ondas.map((onda: any, index: number) => (
              <Card key={index} withBorder>
                <Group justify="space-between" mb="sm">
                  <Text fw={600} size="lg">Onda #{onda.numero || index + 1}</Text>
                  <Badge color="blue" variant="light" size="sm">Simulada</Badge>
                </Group>

                <div className="space-y-2">
                  <Group gap="xs">
                    <IconTruck size={14} className="text-gray-400" />
                    <Text size="sm"><Text span fw={500}>Doca:</Text> {onda.doca || '—'}</Text>
                  </Group>
                  <Group gap="xs">
                    <IconMapPin size={14} className="text-gray-400" />
                    <Text size="sm"><Text span fw={500}>Rota:</Text> {onda.rota || '—'}</Text>
                  </Group>
                  <Group gap="xs">
                    <IconWaveSine size={14} className="text-gray-400" />
                    <Text size="sm"><Text span fw={500}>Pedidos:</Text> {onda.pedidos || 0}</Text>
                  </Group>
                  <Group gap="xs">
                    <Text size="sm"><Text span fw={500}>Itens:</Text> {onda.itens || 0}</Text>
                  </Group>
                  <Group gap="xs">
                    <Text size="sm"><Text span fw={500}>Hora estimada:</Text> {onda.horaEstimada || '—'}</Text>
                  </Group>
                </div>
              </Card>
            ))}
          </SimpleGrid>

          {ondas.length === 0 && (
            <Card withBorder>
              <Text c="dimmed" ta="center" py="lg">
                Nenhuma onda gerada para a data selecionada. Verifique se há pedidos pendentes.
              </Text>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
