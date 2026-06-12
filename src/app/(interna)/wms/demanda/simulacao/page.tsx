'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, LoadingOverlay, Stack,
  Badge, SimpleGrid, ThemeIcon,
} from '@mantine/core'
import { IconArrowRight, IconTestPipe } from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

export default function SimulacaoWhatIfPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Simulação What-If' }, [])

  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [enderecoDestino, setEnderecoDestino] = useState<string | null>(null)

  const { data: produtosResp } = useQuery<any>({
    queryKey: ['demanda-simulacao-produtos'],
    queryFn: async () => { const { data } = await api.get('/demanda/produtos'); return data },
  })

  const { data: enderecosResp } = useQuery<any>({
    queryKey: ['demanda-simulacao-enderecos'],
    queryFn: async () => { const { data } = await api.get('/enderecos', { params: { status: 'LIVRE' } }); return data },
  })

  const simular = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/demanda/slotting/simular', {
        produtoId,
        enderecoDestino,
      })
      return data
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha na simulação', color: 'red' })
    },
  })

  const produtos = (produtosResp?.data || produtosResp || []).map((p: any) => ({
    value: String(p.id || p.produtoId),
    label: p.nome || p.sku || `Produto ${p.id}`,
  }))

  const enderecos = (enderecosResp?.data || enderecosResp || []).map((e: any) => ({
    value: e.codigo || e.endereco || String(e.id),
    label: e.codigo || e.endereco || `Endereço ${e.id}`,
  }))

  const resultado = simular.data?.data || simular.data

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Demanda / Simulação What-If</Text>
      <Text size="xl" fw={600} mb="lg">Simulação What-If</Text>

      <Card withBorder mb="md">
        <Text fw={500} mb="md">Parâmetros da Simulação</Text>
        <Group align="end">
          <Select
            label="Produto"
            placeholder="Selecione o produto"
            data={produtos}
            value={produtoId}
            onChange={setProdutoId}
            searchable
            w={300}
          />
          <Select
            label="Endereço Destino"
            placeholder="Selecione o endereço"
            data={enderecos}
            value={enderecoDestino}
            onChange={setEnderecoDestino}
            searchable
            w={300}
          />
          <Button
            leftSection={<IconTestPipe size={16} />}
            loading={simular.isPending}
            disabled={!produtoId || !enderecoDestino}
            onClick={() => simular.mutate()}
          >
            Simular
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mt="xs">
          A simulação não aplica alterações. É apenas uma previsão de impacto.
        </Text>
      </Card>

      {simular.isPending && (
        <Card withBorder pos="relative" h={200}>
          <LoadingOverlay visible />
        </Card>
      )}

      {resultado && (
        <Card withBorder>
          <Text fw={500} mb="md">Resultado da Simulação</Text>

          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder>
              <Stack gap={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Endereço Atual</Text>
                <Text size="lg" fw={700}>{resultado.enderecoAtual || '—'}</Text>
                <Badge variant="light" size="sm">{resultado.tipoAtual || 'N/A'}</Badge>
              </Stack>
            </Card>

            <Card withBorder>
              <Stack gap={4} align="center" justify="center">
                <ThemeIcon size={40} radius="xl" color="blue" variant="light">
                  <IconArrowRight size={24} />
                </ThemeIcon>
                <Text size="xs" c="dimmed">Movimentação</Text>
              </Stack>
            </Card>

            <Card withBorder>
              <Stack gap={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Endereço Destino</Text>
                <Text size="lg" fw={700}>{resultado.enderecoDestino || enderecoDestino}</Text>
                <Badge variant="light" size="sm">{resultado.tipoDestino || 'N/A'}</Badge>
              </Stack>
            </Card>
          </SimpleGrid>

          <Card withBorder bg="gray.0">
            <Text fw={500} mb="sm">Impacto Estimado</Text>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <div>
                <Text size="xs" c="dimmed">Redução Percurso</Text>
                <Text fw={600}>{resultado.reducaoPercurso || '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Ganho Produtividade</Text>
                <Text fw={600} c="green">{resultado.ganhoProdutividade || '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Conflitos</Text>
                <Text fw={600} c={resultado.conflitos > 0 ? 'red' : 'green'}>
                  {resultado.conflitos ?? 0}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Score</Text>
                <Text fw={600}>{resultado.score?.toFixed(2) || '—'}</Text>
              </div>
            </SimpleGrid>
          </Card>
        </Card>
      )}
    </div>
  )
}
