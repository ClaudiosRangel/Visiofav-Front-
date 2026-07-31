'use client'

import { useEffect, useMemo, useState } from 'react'
import { Title, Stack, Group, Card, Badge, Text, ScrollArea, Loader, Center, SegmentedControl, Progress, Box } from '@mantine/core'
import { IconClockPause } from '@tabler/icons-react'
import { api } from '@/lib/api'

const PRIORIDADE_COLORS: Record<string, string> = { BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red' }

/**
 * Intervalo de atualização automática do quadro (ms). Tela pensada para
 * ficar aberta num monitor/TV do chão de fábrica, sem interação do
 * usuário — por isso o polling silencioso, sem loading global a cada
 * atualização (só na primeira carga).
 */
const INTERVALO_ATUALIZACAO_MS = 20000

function getCategoriaCentro(tipoProcessoCodigo: string | null | undefined): string {
  return tipoProcessoCodigo?.toLowerCase() || 'outros'
}

/** Mesma lógica de cor de fundo usada no painel de Programação (Grid), para
 * manter consistência visual entre as duas telas — sem as ações de clique. */
function getCardBorderColor(etapa: any): string | undefined {
  if (etapa.isAvulsa) return 'var(--mantine-color-pink-6)'
  if (etapa.status === 'EM_ANDAMENTO') return 'var(--mantine-color-yellow-6)'
  if (etapa.status === 'PAUSADA') return 'var(--mantine-color-orange-6)'
  if (etapa.dataEntrega && new Date(etapa.dataEntrega) < new Date()) return 'var(--mantine-color-red-6)'
  return 'var(--mantine-color-gray-4)'
}

export default function QuadroProducaoPage() {
  useEffect(() => { document.title = 'PCP - Quadro de Produção' }, [])

  const [painel, setPainel] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Agrupamento: por Tipo de Processo (poucas colunas, uma por categoria) ou
  // por Máquina/Centro (uma coluna por centro de produção cadastrado).
  const [agrupamento, setAgrupamento] = useState<'tipoProcesso' | 'maquina'>('tipoProcesso')

  async function carregar(mostrarLoading: boolean) {
    if (mostrarLoading) setLoading(true)
    try {
      const res = await api.get('/pcp/programacao/painel')
      setPainel(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      if (mostrarLoading) setLoading(false)
    }
  }

  useEffect(() => {
    carregar(true)
    const intervalo = setInterval(() => carregar(false), INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  // Colunas por Máquina: uma por centro cadastrado, na ordem já definida em
  // PCP → Cadastros → Centros de Produção (painel.centros já vem ordenado).
  const colunasPorMaquina = useMemo(() => {
    return (painel?.centros || []).map((c: any) => ({
      key: c.centro.id,
      titulo: c.centro.descricao,
      subtitulo: c.centro.tipoProcesso?.descricao,
      etapas: c.etapas,
    }))
  }, [painel])

  // Colunas por Tipo de Processo: agrega todas as etapas de todos os centros
  // que compartilham o mesmo Tipo de Processo cadastrado numa única coluna.
  const colunasPorTipoProcesso = useMemo(() => {
    const mapa = new Map<string, { key: string; titulo: string; etapas: any[] }>()
    for (const c of painel?.centros || []) {
      const key = getCategoriaCentro(c.centro.tipoProcesso?.codigo)
      if (!mapa.has(key)) mapa.set(key, { key, titulo: c.centro.tipoProcesso?.descricao || 'Outros', etapas: [] })
      mapa.get(key)!.etapas.push(...c.etapas)
    }
    // Reordena cada coluna combinada por posicaoFila (etapas de centros
    // diferentes ficavam intercaladas por centro, não por fila real).
    for (const col of mapa.values()) {
      col.etapas.sort((a, b) => (a.posicaoFila ?? Infinity) - (b.posicaoFila ?? Infinity))
    }
    return Array.from(mapa.values())
  }, [painel])

  const colunas = agrupamento === 'maquina' ? colunasPorMaquina : colunasPorTipoProcesso

  if (loading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Title order={3}>Quadro de Produção</Title>
        <SegmentedControl
          value={agrupamento}
          onChange={(v) => setAgrupamento(v as 'tipoProcesso' | 'maquina')}
          data={[
            { label: 'Por Tipo de Processo', value: 'tipoProcesso' },
            { label: 'Por Máquina', value: 'maquina' },
          ]}
        />
      </Group>

      <ScrollArea>
        <Group align="flex-start" wrap="nowrap" gap="md" style={{ minWidth: '100%' }}>
          {colunas.map((coluna: any) => (
            <Stack key={coluna.key} w={300} style={{ flexShrink: 0 }}>
              <Group justify="space-between">
                <Box>
                  <Text fw={700} size="sm">{coluna.titulo}</Text>
                  {coluna.subtitulo && <Text size="xs" c="dimmed">{coluna.subtitulo}</Text>}
                </Box>
                <Badge variant="light" size="lg">{coluna.etapas.length}</Badge>
              </Group>

              <Stack gap="xs" style={{ minHeight: 200, background: 'var(--mantine-color-gray-0)', borderRadius: 8, padding: 8 }}>
                {coluna.etapas.length === 0 ? (
                  <Text size="xs" c="dimmed" ta="center" py="lg">Nenhuma OS na fila</Text>
                ) : (
                  coluna.etapas.map((etapa: any) => (
                    <Card
                      key={etapa.id}
                      withBorder
                      padding="xs"
                      radius="sm"
                      style={{ borderLeft: `4px solid ${getCardBorderColor(etapa)}` }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" fw={600}>OP #{etapa.opNumero}</Text>
                        <Group gap={4} wrap="nowrap">
                          {etapa.status === 'PAUSADA' && <IconClockPause size={14} color="var(--mantine-color-orange-6)" />}
                          <Badge size="xs" color={PRIORIDADE_COLORS[etapa.prioridade]} variant="dot">
                            {etapa.prioridade}
                          </Badge>
                        </Group>
                      </Group>

                      {etapa.clienteNome && (
                        <Text size="xs" c="dimmed" mt={2} lineClamp={1}>{etapa.clienteNome}</Text>
                      )}
                      {etapa.produtoNome && (
                        <Text size="xs" lineClamp={1}>{etapa.produtoNome}</Text>
                      )}
                      <Text size="xs" c="dimmed" mt={2}>{etapa.descricao}</Text>

                      <Group justify="space-between" mt={4}>
                        <Text size="xs" c="dimmed">
                          {Number(etapa.quantidadeProduzida).toLocaleString('pt-BR')} / {Number(etapa.quantidade).toLocaleString('pt-BR')} {etapa.unidade}
                        </Text>
                        <Text size="xs" c="dimmed">{etapa.percentual}%</Text>
                      </Group>
                      <Progress value={etapa.percentual} size="sm" mt={2} color={etapa.percentual >= 100 ? 'green' : 'blue'} />

                      {etapa.dataEntrega && (
                        <Text size="xs" c={new Date(etapa.dataEntrega) < new Date() ? 'red' : 'dimmed'} mt={4}>
                          Entrega: {new Date(etapa.dataEntrega).toLocaleDateString('pt-BR')}
                        </Text>
                      )}
                    </Card>
                  ))
                )}
              </Stack>
            </Stack>
          ))}
        </Group>
      </ScrollArea>
    </Stack>
  )
}
