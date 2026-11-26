'use client'
/**
 * Histórico de apontamentos de TODAS as etapas da OP (inclusive as já finalizadas).
 * Consome GET /pcp/ordens-producao/:opId/apontamentos.
 */
import { useEffect, useMemo, useState } from 'react'
import { Badge, Center, Group, Loader, Paper, Select, SimpleGrid, Table, Text } from '@mantine/core'
import { api } from '@/lib/api'

interface Apontamento {
  id: string
  tipo: 'PRODUCAO' | 'PERDA' | 'PARADA' | 'RETOMADA' | string
  dataHora: string
  quantidadeProduzida: number
  quantidadePerda: number
  quantidadeRetrabalho: number
  motivoPerda: string | null
  motivoParada: string | null
  tempoParadaMinutos: number | null
  observacao: string | null
  cancelado: boolean
  operador: string | null
  etapa: { id: string; sequencia: number; descricao: string; status: string; centro: string | null }
}
interface Resposta {
  apontamentos: Apontamento[]
  totais: { totalProduzido: number; totalPerda: number; totalParadas: number; tempoParadaTotal: number }
}

const COR_TIPO: Record<string, string> = { PRODUCAO: 'green', PERDA: 'red', PARADA: 'orange', RETOMADA: 'blue' }
const ROTULO_TIPO: Record<string, string> = { PRODUCAO: 'Produção', PERDA: 'Perda', PARADA: 'Parada', RETOMADA: 'Retomada' }
const num = (n: number) => n.toLocaleString('pt-BR')

function detalhe(a: Apontamento): string {
  if (a.tipo === 'PRODUCAO') return `${num(a.quantidadeProduzida)}${a.quantidadeRetrabalho ? ` (retrabalho ${num(a.quantidadeRetrabalho)})` : ''}`
  if (a.tipo === 'PERDA') return `${num(a.quantidadePerda)}${a.motivoPerda ? ` · ${a.motivoPerda}` : ''}`
  if (a.tipo === 'PARADA' || a.tipo === 'RETOMADA') {
    const partes = [a.motivoParada, a.tempoParadaMinutos != null ? `${a.tempoParadaMinutos} min` : null].filter(Boolean)
    return partes.join(' · ') || '—'
  }
  return '—'
}

export default function ApontamentosDaOp({ opId }: { opId: string }) {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtroEtapa, setFiltroEtapa] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    api.get<Resposta>(`/pcp/ordens-producao/${opId}/apontamentos`)
      .then(({ data }) => { if (ativo) { setDados(data); setErro(null) } })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.message || 'Não foi possível carregar os apontamentos.') })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [opId])

  const etapas = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of dados?.apontamentos ?? []) {
      m.set(a.etapa.id, `${a.etapa.sequencia}. ${a.etapa.descricao}${a.etapa.centro ? ` (${a.etapa.centro})` : ''}`)
    }
    return Array.from(m, ([value, label]) => ({ value, label }))
  }, [dados])

  const lista = (dados?.apontamentos ?? []).filter((a) => !filtroEtapa || a.etapa.id === filtroEtapa)

  if (carregando) return <Center py="lg"><Loader size="sm" /></Center>
  if (erro) return <Text c="red" ta="center">{erro}</Text>
  if (!dados || dados.apontamentos.length === 0) return <Text c="dimmed" ta="center">Nenhum apontamento registrado nesta OP</Text>

  return (
    <>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <Paper withBorder p="sm"><Text size="xs" c="dimmed">Produzido</Text><Text fw={700}>{num(dados.totais.totalProduzido)}</Text></Paper>
        <Paper withBorder p="sm"><Text size="xs" c="dimmed">Perda</Text><Text fw={700}>{num(dados.totais.totalPerda)}</Text></Paper>
        <Paper withBorder p="sm"><Text size="xs" c="dimmed">Paradas</Text><Text fw={700}>{dados.totais.totalParadas}</Text></Paper>
        <Paper withBorder p="sm"><Text size="xs" c="dimmed">Tempo parado</Text><Text fw={700}>{dados.totais.tempoParadaTotal} min</Text></Paper>
      </SimpleGrid>

      <Group mb="sm">
        <Select
          placeholder="Todas as etapas" clearable data={etapas} value={filtroEtapa} onChange={setFiltroEtapa}
          w={420} comboboxProps={{ withinPortal: true }}
        />
        <Text size="xs" c="dimmed">{lista.length} apontamento(s)</Text>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data/hora</Table.Th>
            <Table.Th>Etapa / máquina</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th>Quantidade / motivo</Table.Th>
            <Table.Th>Operador</Table.Th>
            <Table.Th>Observação</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lista.map((a) => (
            <Table.Tr key={a.id} style={a.cancelado ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
              <Table.Td><Text size="xs">{new Date(a.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</Text></Table.Td>
              <Table.Td>
                <Text size="xs" fw={500}>{a.etapa.sequencia}. {a.etapa.descricao}</Text>
                {a.etapa.centro && <Text size="xs" c="dimmed">{a.etapa.centro}</Text>}
              </Table.Td>
              <Table.Td>
                <Badge size="xs" variant="light" color={COR_TIPO[a.tipo] || 'gray'}>{ROTULO_TIPO[a.tipo] || a.tipo}</Badge>
                {a.cancelado && <Badge size="xs" variant="light" color="gray" ml={4}>Cancelado</Badge>}
              </Table.Td>
              <Table.Td><Text size="xs">{detalhe(a)}</Text></Table.Td>
              <Table.Td><Text size="xs">{a.operador || '—'}</Text></Table.Td>
              <Table.Td><Text size="xs">{a.observacao || ''}</Text></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  )
}
