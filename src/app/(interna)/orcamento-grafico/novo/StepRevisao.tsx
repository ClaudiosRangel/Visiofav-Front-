'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Stack, Text, NumberInput, Group, Paper, SimpleGrid, Table, Loader,
  Center, Alert, Badge, Divider, Progress,
} from '@mantine/core'
import { IconCalculator, IconAlertCircle, IconChartPie } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface Resultado {
  papel?: { pesoKg: number; custo: number }
  tinta?: { custoTotal: number; detalhePorCor?: Array<{ cor: string; consumoKg: number; custo: number }> }
  maquinas?: { custoTotal: number; detalhePorEtapa?: Array<{ etapa: string; tempoMin: number; custo: number }> }
  acabamentos?: { custoTotal: number; detalhePorAcabamento?: Array<{ tipo: string; custo: number }> }
  custoTotal?: number
  precoVenda?: number
  precoUnitario?: number
  margemReal?: number
  breakdown?: { papel: number; tinta: number; maquina: number; acabamento: number; overhead: number }
}

interface Simulacao {
  quantidade: number
  precoUnitario: number
  precoTotal: number
  custoTotal: number
}

export default function StepRevisao({ formData, updateForm }: Props) {
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const calcular = useCallback(async () => {
    if (formData.quantidade <= 0) return

    setLoading(true)
    setErro(null)
    try {
      const acabamentosAtivos = formData.acabamentos
        .filter(a => a.ativo)
        .map(a => ({ tipo: a.tipo, custoHora: a.custoHora, velocidade: a.velocidade, custoMaterialM2: a.custoMaterialM2 }))

      const payload = {
        tipoEmbalagemId: formData.tipoEmbalagemId,
        medidas: formData.medidas,
        papelId: formData.papelId || undefined,
        gramatura: formData.gramatura,
        precoKg: formData.precoKg,
        cores: formData.cores.map(c => ({
          nome: c.nome,
          tipo: c.tipo,
          coberturaPercent: c.coberturaPercent,
          precoKg: c.precoKg,
          rendimentoM2Kg: c.rendimentoM2Kg,
        })),
        acabamentos: acabamentosAtivos,
        quantidade: formData.quantidade,
        tabelaMargemId: formData.tabelaMargemId || undefined,
      }

      const { data } = await api.post('/orcamento-grafico/calcular', payload)
      setResultado(data)
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao calcular orçamento.')
      setResultado(null)
    } finally {
      setLoading(false)
    }
  }, [formData])

  const simularTiragens = useCallback(async () => {
    try {
      const acabamentosAtivos = formData.acabamentos
        .filter(a => a.ativo)
        .map(a => ({ tipo: a.tipo, custoHora: a.custoHora, velocidade: a.velocidade, custoMaterialM2: a.custoMaterialM2 }))

      const quantidades = [
        Math.max(1000, Math.round(formData.quantidade * 0.5)),
        formData.quantidade,
        Math.round(formData.quantidade * 2),
        Math.round(formData.quantidade * 5),
        Math.round(formData.quantidade * 10),
      ]

      const payload = {
        tipoEmbalagemId: formData.tipoEmbalagemId,
        medidas: formData.medidas,
        papelId: formData.papelId || undefined,
        gramatura: formData.gramatura,
        precoKg: formData.precoKg,
        cores: formData.cores.map(c => ({
          nome: c.nome,
          tipo: c.tipo,
          coberturaPercent: c.coberturaPercent,
          precoKg: c.precoKg,
          rendimentoM2Kg: c.rendimentoM2Kg,
        })),
        acabamentos: acabamentosAtivos,
        quantidades,
        tabelaMargemId: formData.tabelaMargemId || undefined,
      }

      const { data } = await api.post('/orcamento-grafico/simular-tiragens', payload)
      setSimulacoes(Array.isArray(data) ? data : data.simulacoes || [])
    } catch {
      setSimulacoes([])
    }
  }, [formData])

  // Calcular ao carregar e quando quantidade muda
  useEffect(() => {
    calcular()
    simularTiragens()
  }, [formData.quantidade]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (val: number | undefined) =>
    val != null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

  const formatPercent = (val: number | undefined) =>
    val != null ? `${val.toFixed(1)}%` : '—'

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600} size="lg">Revisão e Preço</Text>
          <Text size="sm" c="dimmed">
            Confira o breakdown de custos e ajuste a tiragem.
          </Text>
        </div>
        <NumberInput
          label="Tiragem"
          value={formData.quantidade}
          onChange={(val) => updateForm({ quantidade: typeof val === 'number' ? val : 0 })}
          min={1}
          w={180}
          thousandSeparator="."
          decimalSeparator=","
        />
      </Group>

      {loading && (
        <Center py="xl"><Loader size="lg" /></Center>
      )}

      {erro && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erro no cálculo">
          {erro}
        </Alert>
      )}

      {resultado && !loading && (
        <>
          {/* Resumo principal */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Custo Total</Text>
              <Text fw={700} size="lg" c="red">{formatCurrency(resultado.custoTotal)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Venda</Text>
              <Text fw={700} size="lg" c="green">{formatCurrency(resultado.precoVenda)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Preço Unitário</Text>
              <Text fw={700} size="lg">{formatCurrency(resultado.precoUnitario)}</Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" c="dimmed" tt="uppercase">Margem</Text>
              <Text fw={700} size="lg" c="blue">{formatPercent(resultado.margemReal)}</Text>
            </Paper>
          </SimpleGrid>

          {/* Breakdown visual */}
          {resultado.breakdown && (
            <Paper p="md" withBorder>
              <Group gap="xs" mb="sm">
                <IconChartPie size={18} />
                <Text fw={500} size="sm">Composição do Custo</Text>
              </Group>
              <BreakdownBar breakdown={resultado.breakdown} />
            </Paper>
          )}

          {/* Detalhamento */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Papel</Text>
              <Text size="sm">Peso: {resultado.papel?.pesoKg?.toFixed(2) || '—'} kg</Text>
              <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.papel?.custo)}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Tinta</Text>
              <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.tinta?.custoTotal)}</Text>
              {resultado.tinta?.detalhePorCor?.map((c, i) => (
                <Text key={i} size="xs" c="dimmed">{c.cor}: {c.consumoKg?.toFixed(3)} kg = {formatCurrency(c.custo)}</Text>
              ))}
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Máquinas</Text>
              <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.maquinas?.custoTotal)}</Text>
              {resultado.maquinas?.detalhePorEtapa?.map((e, i) => (
                <Text key={i} size="xs" c="dimmed">{e.etapa}: {e.tempoMin?.toFixed(0)} min = {formatCurrency(e.custo)}</Text>
              ))}
            </Paper>
            <Paper p="md" withBorder>
              <Text fw={500} size="sm" mb="xs">Acabamentos</Text>
              <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.acabamentos?.custoTotal)}</Text>
              {resultado.acabamentos?.detalhePorAcabamento?.map((a, i) => (
                <Text key={i} size="xs" c="dimmed">{a.tipo}: {formatCurrency(a.custo)}</Text>
              ))}
            </Paper>
          </SimpleGrid>

          {/* Simulação de tiragens */}
          {simulacoes.length > 0 && (
            <>
              <Divider my="sm" />
              <Text fw={500} size="sm">Comparativo por Tiragem</Text>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Quantidade</Table.Th>
                    <Table.Th>Custo Total</Table.Th>
                    <Table.Th>Preço Unitário</Table.Th>
                    <Table.Th>Preço Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {simulacoes.map((sim, i) => (
                    <Table.Tr
                      key={i}
                      bg={sim.quantidade === formData.quantidade ? 'var(--mantine-color-blue-light)' : undefined}
                    >
                      <Table.Td>
                        <Group gap={4}>
                          {sim.quantidade.toLocaleString('pt-BR')}
                          {sim.quantidade === formData.quantidade && (
                            <Badge size="xs" color="blue">atual</Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{formatCurrency(sim.custoTotal)}</Table.Td>
                      <Table.Td>{formatCurrency(sim.precoUnitario)}</Table.Td>
                      <Table.Td fw={500}>{formatCurrency(sim.precoTotal)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </>
      )}
    </Stack>
  )
}

// ============================================================================
// Breakdown visual (barra de proporção)
// ============================================================================

function BreakdownBar({ breakdown }: { breakdown: { papel: number; tinta: number; maquina: number; acabamento: number; overhead: number } }) {
  const total = breakdown.papel + breakdown.tinta + breakdown.maquina + breakdown.acabamento + breakdown.overhead
  if (total === 0) return null

  const items = [
    { label: 'Papel', value: breakdown.papel, color: 'blue' },
    { label: 'Tinta', value: breakdown.tinta, color: 'grape' },
    { label: 'Máquina', value: breakdown.maquina, color: 'orange' },
    { label: 'Acabamento', value: breakdown.acabamento, color: 'teal' },
    { label: 'Overhead', value: breakdown.overhead, color: 'gray' },
  ]

  const sections = items
    .filter(i => i.value > 0)
    .map(i => ({
      value: (i.value / total) * 100,
      color: i.color,
      tooltip: `${i.label}: ${((i.value / total) * 100).toFixed(1)}%`,
    }))

  return (
    <Stack gap="xs">
      <Progress.Root size={24}>
        {sections.map((s, i) => (
          <Progress.Section key={i} value={s.value} color={s.color}>
            <Progress.Label>{s.tooltip}</Progress.Label>
          </Progress.Section>
        ))}
      </Progress.Root>
      <Group gap="md">
        {items.filter(i => i.value > 0).map((item) => (
          <Group key={item.label} gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: `var(--mantine-color-${item.color}-5)` }} />
            <Text size="xs">{item.label}: {((item.value / total) * 100).toFixed(1)}%</Text>
          </Group>
        ))}
      </Group>
    </Stack>
  )
}
