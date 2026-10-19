'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Group, Select, NumberInput, Button, Tabs, Card, SimpleGrid,
  Text, Table, Loader, Center, Badge, Progress,
} from '@mantine/core'
import { IconChartBar, IconCalendar, IconAlertTriangle, IconPrinter } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const hoje = new Date()

function num(n: number) { return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }
function brl(n: number) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

interface ResumoProc { tipoProcessoCodigo: string | null; base: string; produzido: number; valorRs: number; metaQuantidade: number | null; percentualAtingido: number | null }
interface SerieDia { data: string; produzido: number; valorRs: number }
interface Diaria { serie: SerieDia[]; pico: SerieDia | null; segundoMaior: SerieDia | null; terceiroMaior: SerieDia | null; mediaDiaria: number; menorDia: SerieDia | null }
interface ParetoItem { codigo: string; descricao: string; ocorrencias: number }

export default function RelatorioProducaoMensalPage() {
  useEffect(() => { document.title = 'PCP - Relatório Mensal de Produção' }, [])
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<ResumoProc[]>([])
  const [diaria, setDiaria] = useState<Diaria | null>(null)
  const [pareto, setPareto] = useState<ParetoItem[]>([])

  const carregar = useCallback(() => {
    setLoading(true)
    api.get('/pcp/gerencial/producao-mensal', { params: { ano, mes } })
      .then(({ data }) => { setResumo(data.resumo || []); setDiaria(data.diaria || null); setPareto(data.pareto || []) })
      .catch(() => { setResumo([]); setDiaria(null); setPareto([]) })
      .finally(() => setLoading(false))
  }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])

  function abrirPdf() {
    const token = getAuthToken() || ''
    const qs = new URLSearchParams({ ano: String(ano), mes: String(mes), token })
    window.open(`${API_BASE}/pcp/gerencial/producao-mensal.pdf?${qs.toString()}`, '_blank')
  }

  const totalProd = resumo.reduce((s, r) => s + r.produzido, 0)
  const totalRs = resumo.reduce((s, r) => s + r.valorRs, 0)

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Relatório Mensal de Produção</Title>
        <Button leftSection={<IconPrinter size={16} />} onClick={abrirPdf}>Imprimir (PDF)</Button>
      </Group>

      <Group>
        <Select label="Mês" w={160} value={String(mes)} onChange={(v) => setMes(Number(v))}
          data={MESES.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <NumberInput label="Ano" w={120} value={ano} onChange={(v) => setAno(Number(v) || hoje.getFullYear())} min={2000} max={2100} />
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <Tabs defaultValue="resumo">
          <Tabs.List>
            <Tabs.Tab value="resumo" leftSection={<IconChartBar size={16} />}>Resumo por Processo</Tabs.Tab>
            <Tabs.Tab value="diaria" leftSection={<IconCalendar size={16} />}>Produção Diária</Tabs.Tab>
            <Tabs.Tab value="pareto" leftSection={<IconAlertTriangle size={16} />}>Pareto de Paradas</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="resumo" pt="md">
            <Stack>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Card withBorder><Text size="sm" c="dimmed">Produção total ({MESES[mes - 1]}/{ano})</Text><Text fw={700} size="xl">{num(totalProd)}</Text></Card>
                <Card withBorder><Text size="sm" c="dimmed">Valor total (custo)</Text><Text fw={700} size="xl">{brl(totalRs)}</Text></Card>
              </SimpleGrid>
              {resumo.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem produção no mês.</Text> : (
                <Table striped withTableBorder>
                  <Table.Thead><Table.Tr>
                    <Table.Th>Processo</Table.Th><Table.Th>Base</Table.Th>
                    <Table.Th ta="right">Produzido</Table.Th><Table.Th ta="right">Valor R$</Table.Th><Table.Th>Meta</Table.Th>
                  </Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {resumo.map((r) => (
                      <Table.Tr key={r.tipoProcessoCodigo}>
                        <Table.Td fw={600}>{r.tipoProcessoCodigo ?? '—'}</Table.Td>
                        <Table.Td><Badge variant="light" color={r.base === 'UNIDADE' ? 'grape' : 'blue'}>{r.base === 'UNIDADE' ? 'Peças' : 'Folhas'}</Badge></Table.Td>
                        <Table.Td ta="right">{num(r.produzido)}</Table.Td>
                        <Table.Td ta="right">{brl(r.valorRs)}</Table.Td>
                        <Table.Td>{r.percentualAtingido != null ? (
                          <Group gap={6} wrap="nowrap"><Progress value={Math.min(r.percentualAtingido, 100)} w={70} color={r.percentualAtingido >= 100 ? 'green' : 'orange'} /><Text size="xs">{num(r.percentualAtingido)}%</Text></Group>
                        ) : <Text size="xs" c="dimmed">—</Text>}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="diaria" pt="md">
            {!diaria || diaria.serie.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem produção no mês.</Text> : (
              <Stack>
                <SimpleGrid cols={{ base: 1, sm: 4 }}>
                  <Card withBorder><Text size="xs" c="dimmed">Pico</Text><Text fw={700}>{num(diaria.pico?.produzido || 0)}</Text><Text size="xs">{diaria.pico?.data}</Text></Card>
                  <Card withBorder><Text size="xs" c="dimmed">2º maior</Text><Text fw={700}>{num(diaria.segundoMaior?.produzido || 0)}</Text><Text size="xs">{diaria.segundoMaior?.data}</Text></Card>
                  <Card withBorder><Text size="xs" c="dimmed">Média diária</Text><Text fw={700}>{num(diaria.mediaDiaria)}</Text></Card>
                  <Card withBorder><Text size="xs" c="dimmed">Menor dia</Text><Text fw={700}>{num(diaria.menorDia?.produzido || 0)}</Text><Text size="xs">{diaria.menorDia?.data}</Text></Card>
                </SimpleGrid>
                <Table striped withTableBorder>
                  <Table.Thead><Table.Tr><Table.Th>Dia</Table.Th><Table.Th ta="right">Produzido</Table.Th><Table.Th ta="right">Valor R$</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {diaria.serie.map((d) => (
                      <Table.Tr key={d.data}><Table.Td>{d.data}</Table.Td><Table.Td ta="right">{num(d.produzido)}</Table.Td><Table.Td ta="right">{brl(d.valorRs)}</Table.Td></Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="pareto" pt="md">
            {pareto.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem paradas no mês.</Text> : (
              <Table striped withTableBorder>
                <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th ta="right">Ocorrências</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {pareto.map((p) => (
                    <Table.Tr key={`${p.codigo}-${p.descricao}`}><Table.Td fw={600}>{p.codigo}</Table.Td><Table.Td>{p.descricao}</Table.Td><Table.Td ta="right">{p.ocorrencias}</Table.Td></Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}
