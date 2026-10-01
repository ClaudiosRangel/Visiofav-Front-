'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Group, Button, Text, Loader, Center, SimpleGrid, Card,
  TextInput, NumberInput, Table, Alert, Badge,
} from '@mantine/core'
import { IconInfoCircle, IconRefresh } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

/**
 * Análise Gerencial RKW (Bloco 4). Cruza o Custo Fixo do Mapa de Custos com a
 * Contribuição Marginal dos orçamentos: CM consolidada, Ponto de Equilíbrio,
 * cobertura do custo fixo, resultado do período e simulação de faturamento.
 * Spec: VisioFab.Wms.Back/.kiro/specs/analise-gerencial-rkw
 */
interface Painel {
  custoFixo: { valor: number; competencia: string | null; aviso: string | null }
  consolidado: {
    totalOrcamentos: number
    fechados: number
    taxaConversao: number
    somaPrecoVendaFechados: number
    somaCMFechados: number
    cmMediaPerc: number
    cmAproximada: boolean
  }
  pontoEquilibrio: number | null
  coberturaPerc: number
  faltanteParaEquilibrio: number
  resultadoPeriodo: number
  confrontoDRE?: {
    resultadoGerencial: number
    resultadoContabil: number | null
    diferenca: number | null
    contabilDisponivel: boolean
    aviso: string | null
  }
}

interface PosCalculoItem {
  referencia: string
  quantidadePrevista: number
  quantidadeProduzida: number
  quantidadeRejeitada: number
  desvioQuantidade: number
  desvioQuantidadePerc: number
  valorPrevisto: number
  valorProporcionalRealizado: number
  semRealizado: boolean
}

interface CenarioResp {
  faturamento: number
  cmPerc: number
  cmProjetada: number
  coberturaPerc: number
  resultado: number
}

const moeda = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const perc = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toFixed(1)}%`)

// Competência atual (AAAA-MM)
function competenciaAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AnaliseGerencialPage() {
  useEffect(() => { document.title = 'PCP - Análise Gerencial' }, [])

  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [painel, setPainel] = useState<Painel | null>(null)
  const [loading, setLoading] = useState(false)

  // Simulador
  const [faturamentoBase, setFaturamentoBase] = useState<number>(0)
  const [cenarios, setCenarios] = useState<CenarioResp[]>([])
  const [simulando, setSimulando] = useState(false)

  // Pós-cálculo
  const [posCalculo, setPosCalculo] = useState<PosCalculoItem[]>([])
  const [posCalculoAviso, setPosCalculoAviso] = useState<string | null>(null)
  const [carregandoPos, setCarregandoPos] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (competencia) params.competencia = competencia
      if (inicio) params.inicio = new Date(inicio + 'T00:00:00').toISOString()
      if (fim) params.fim = new Date(fim + 'T23:59:59').toISOString()
      const res = await api.get('/pcp/analise-gerencial/painel', { params })
      setPainel(res.data)
      // sugere faturamento base = ponto de equilíbrio ou faturamento fechado
      const sugestao = res.data?.pontoEquilibrio ?? res.data?.consolidado?.somaPrecoVendaFechados ?? 0
      setFaturamentoBase(Math.round(sugestao))
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar painel', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function carregarPosCalculo() {
    setCarregandoPos(true)
    try {
      const params: Record<string, string> = {}
      if (inicio) params.inicio = new Date(inicio + 'T00:00:00').toISOString()
      if (fim) params.fim = new Date(fim + 'T23:59:59').toISOString()
      const res = await api.get('/pcp/analise-gerencial/pos-calculo', { params })
      setPosCalculo(res.data?.itens ?? [])
      setPosCalculoAviso(res.data?.aviso ?? null)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha no pós-cálculo', color: 'red' })
    } finally {
      setCarregandoPos(false)
    }
  }

  async function simular() {
    if (!faturamentoBase || faturamentoBase <= 0) {
      notifications.show({ title: 'Informe um faturamento', message: 'Digite um faturamento base para os cenários.', color: 'yellow' })
      return
    }
    setSimulando(true)
    try {
      const cmPercPadrao = painel?.consolidado?.cmMediaPerc ?? 0
      const res = await api.post('/pcp/analise-gerencial/simular', {
        competencia,
        cmPercPadrao,
        cenarios: [
          { faturamento: Math.round(faturamentoBase * 0.8) },
          { faturamento: faturamentoBase },
          { faturamento: Math.round(faturamentoBase * 1.2) },
        ],
      })
      setCenarios(res.data?.cenarios ?? [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao simular', color: 'red' })
    } finally {
      setSimulando(false)
    }
  }

  const resultadoPositivo = (painel?.resultadoPeriodo ?? 0) >= 0

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Análise Gerencial (RKW)</Title>
        <Text size="sm" c="dimmed">
          Cruza o Custo Fixo do Mapa de Custos com a Contribuição Marginal dos
          orçamentos: ponto de equilíbrio, cobertura e resultado do período.
        </Text>
      </div>

      <Group align="end">
        <TextInput
          label="Competência do Mapa (AAAA-MM)"
          placeholder="2026-01"
          value={competencia}
          onChange={(e) => setCompetencia(e.currentTarget.value)}
          w={180}
        />
        <TextInput label="De" type="date" value={inicio} onChange={(e) => setInicio(e.currentTarget.value)} />
        <TextInput label="Até" type="date" value={fim} onChange={(e) => setFim(e.currentTarget.value)} />
        <Button leftSection={<IconRefresh size={16} />} onClick={carregar} loading={loading}>Atualizar</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : painel ? (
        <>
          {painel.custoFixo.aviso && (
            <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
              {painel.custoFixo.aviso}
            </Alert>
          )}
          {painel.consolidado.cmAproximada && (
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              Alguns orçamentos não têm Contribuição Marginal calculada — usada a aproximação (preço − custo).
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">CM Total (fechados)</Text>
              <Text size="xl" fw={700}>{moeda(painel.consolidado.somaCMFechados)}</Text>
              <Text size="xs" c="dimmed">CM% média: {perc(painel.consolidado.cmMediaPerc)}</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Custo Fixo {painel.custoFixo.competencia ? `(${painel.custoFixo.competencia})` : ''}</Text>
              <Text size="xl" fw={700}>{moeda(painel.custoFixo.valor)}</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Ponto de Equilíbrio (faturamento)</Text>
              <Text size="xl" fw={700}>{painel.pontoEquilibrio == null ? 'Indefinido' : moeda(painel.pontoEquilibrio)}</Text>
              <Text size="xs" c="dimmed">CM% ≤ 0 torna indefinido</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Cobertura do Custo Fixo</Text>
              <Text size="xl" fw={700}>{perc(painel.coberturaPerc)}</Text>
              <Text size="xs" c="dimmed">Faltam {moeda(painel.faltanteParaEquilibrio)}</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Resultado do Período (CM − CF)</Text>
              <Text size="xl" fw={700} c={resultadoPositivo ? 'teal' : 'red'}>{moeda(painel.resultadoPeriodo)}</Text>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed">Orçamentos</Text>
              <Text size="xl" fw={700}>{painel.consolidado.fechados}/{painel.consolidado.totalOrcamentos}</Text>
              <Text size="xs" c="dimmed">Conversão: {perc(painel.consolidado.taxaConversao * 100)}</Text>
            </Card>
          </SimpleGrid>

          {painel.confrontoDRE && (
            <Card withBorder padding="md">
              <Text fw={600} mb="xs">Confronto Gerencial × Contábil (DRE)</Text>
              {painel.confrontoDRE.contabilDisponivel ? (
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <div>
                    <Text size="xs" c="dimmed">Resultado Gerencial (CM − CF)</Text>
                    <Text fw={700} c={painel.confrontoDRE.resultadoGerencial >= 0 ? 'teal' : 'red'}>{moeda(painel.confrontoDRE.resultadoGerencial)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Resultado Contábil (DRE)</Text>
                    <Text fw={700} c={(painel.confrontoDRE.resultadoContabil ?? 0) >= 0 ? 'teal' : 'red'}>{moeda(painel.confrontoDRE.resultadoContabil)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Diferença (Gerencial − Contábil)</Text>
                    <Text fw={700}>{moeda(painel.confrontoDRE.diferenca)}</Text>
                  </div>
                </SimpleGrid>
              ) : (
                <Text size="sm" c="dimmed">{painel.confrontoDRE.aviso || 'Resultado contábil não disponível.'}</Text>
              )}
            </Card>
          )}

          <Card withBorder padding="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Text fw={600}>Simulador de Faturamento</Text>
                <Text size="xs" c="dimmed">Cenários 80% / 100% / 120% do faturamento base, com a CM% média do período.</Text>
              </div>
              <Group>
                <NumberInput
                  label="Faturamento base"
                  value={faturamentoBase}
                  onChange={(v) => setFaturamentoBase(Number(v) || 0)}
                  thousandSeparator="."
                  decimalSeparator=","
                  prefix="R$ "
                  min={0}
                  w={200}
                />
                <Button onClick={simular} loading={simulando} mt="lg">Simular</Button>
              </Group>
            </Group>
            {cenarios.length > 0 && (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Faturamento</Table.Th>
                    <Table.Th>CM%</Table.Th>
                    <Table.Th>CM Projetada</Table.Th>
                    <Table.Th>Cobertura</Table.Th>
                    <Table.Th>Resultado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {cenarios.map((c, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{moeda(c.faturamento)}</Table.Td>
                      <Table.Td>{perc(c.cmPerc)}</Table.Td>
                      <Table.Td>{moeda(c.cmProjetada)}</Table.Td>
                      <Table.Td>
                        <Badge color={c.coberturaPerc >= 100 ? 'teal' : 'yellow'} variant="light">{perc(c.coberturaPerc)}</Badge>
                      </Table.Td>
                      <Table.Td c={c.resultado >= 0 ? 'teal' : 'red'} fw={600}>{moeda(c.resultado)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          <Card withBorder padding="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Text fw={600}>Pós-Cálculo (previsto × realizado)</Text>
                <Text size="xs" c="dimmed">
                  Compara a quantidade orçada com a produzida (via pedido → OP) no período.
                  O custo realizado não é registrado no PCP; o valor realizado é o previsto proporcional à quantidade produzida.
                </Text>
              </div>
              <Button variant="light" onClick={carregarPosCalculo} loading={carregandoPos}>Carregar</Button>
            </Group>
            {posCalculoAviso && (
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="sm">{posCalculoAviso}</Alert>
            )}
            {posCalculo.length > 0 && (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Referência</Table.Th>
                    <Table.Th>Qtd. Prevista</Table.Th>
                    <Table.Th>Qtd. Produzida</Table.Th>
                    <Table.Th>Desvio</Table.Th>
                    <Table.Th>Valor Previsto</Table.Th>
                    <Table.Th>Valor Proporcional</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {posCalculo.map((p, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{p.referencia}</Table.Td>
                      <Table.Td>{p.quantidadePrevista.toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td>
                        {p.semRealizado
                          ? <Badge color="gray" variant="light">sem realizado</Badge>
                          : p.quantidadeProduzida.toLocaleString('pt-BR')}
                      </Table.Td>
                      <Table.Td c={p.desvioQuantidade >= 0 ? 'teal' : 'red'}>
                        {p.semRealizado ? '—' : `${p.desvioQuantidade.toLocaleString('pt-BR')} (${perc(p.desvioQuantidadePerc)})`}
                      </Table.Td>
                      <Table.Td>{moeda(p.valorPrevisto)}</Table.Td>
                      <Table.Td>{p.semRealizado ? '—' : moeda(p.valorProporcionalRealizado)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </>
      ) : (
        <Text c="dimmed">Sem dados. Ajuste o período e clique em Atualizar.</Text>
      )}
    </Stack>
  )
}
