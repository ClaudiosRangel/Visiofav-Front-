'use client'

import { useEffect, useState } from 'react'
import {
  Button, Card, Group, Text, Table, Title, Stack, LoadingOverlay, Tabs, Badge,
  SimpleGrid,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconDownload, IconSearch, IconTrendingUp, IconTrendingDown, IconWallet, IconAlertTriangle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, paraCsv, type ResumoExecutivo, type LinhaDre } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

function baixarCsv(nome: string, conteudo: string) {
  const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

function inicioMes() { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)) }
function fimMes() { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)) }

// Cartão de KPI do Resumo Executivo
function Kpi({ label, valor, cor, icon }: { label: string; valor: number; cor?: string; icon?: React.ReactNode }) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb={4}>
        <Text size="xs" c="dimmed">{label}</Text>
        {icon}
      </Group>
      <Text size="xl" fw={700} c={cor}>{formatarBRL(valor)}</Text>
    </Card>
  )
}

export default function RelatoriosPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Relatórios' }, [])

  const [de, setDe] = useState<Date | null>(inicioMes())
  const [ate, setAte] = useState<Date | null>(fimMes())
  const [periodo, setPeriodo] = useState<{ de: string; ate: string }>({ de: inicioMes().toISOString(), ate: fimMes().toISOString() })

  function aplicarPeriodo() {
    setPeriodo({ de: (de ?? inicioMes()).toISOString(), ate: (ate ?? fimMes()).toISOString() })
  }

  const { data: resumo, isLoading: loadingResumo } = useQuery<ResumoExecutivo>({
    queryKey: ['fin-resumo-exec', periodo],
    queryFn: () => financeiroApi.resumoExecutivo(periodo),
  })

  const { data: dre = [], isLoading: loadingDre } = useQuery<LinhaDre[]>({
    queryKey: ['fin-dre', periodo],
    queryFn: () => financeiroApi.dre(periodo),
  })

  // Nomes das categorias para o DRE (a linha traz só categoriaId)
  const { data: categorias = [] } = useQuery<any[]>({
    queryKey: ['fin-categorias'],
    queryFn: financeiroApi.listarCategorias,
  })
  const nomeCategoria = (id: string | null | undefined) => {
    if (!id) return 'Sem categoria'
    const c = categorias.find((x) => x.id === id)
    return c ? `${c.codigo} — ${c.nome}` : 'Sem categoria'
  }

  const { data: inadimplentes = [], isLoading: loadingInad } = useQuery<any[]>({
    queryKey: ['fin-inadimplencia'],
    queryFn: financeiroApi.inadimplencia,
  })

  function exportarInadimplencia() {
    const rows = inadimplentes.flatMap((c) => c.titulos.map((t: any) => ({ cliente: c.nome, descricao: t.descricao, valor: t.valor, vencimento: formatarData(t.dataVencimento), diasAtraso: t.diasAtraso })))
    baixarCsv('inadimplencia.csv', paraCsv(rows, [
      { key: 'cliente', label: 'Cliente' }, { key: 'descricao', label: 'Descrição' },
      { key: 'valor', label: 'Valor' }, { key: 'vencimento', label: 'Vencimento' }, { key: 'diasAtraso', label: 'Dias em atraso' },
    ]))
  }

  function exportarResumo() {
    if (!resumo) return
    const rows = [
      { item: 'Entrou (recebido)', valor: resumo.entrou },
      { item: 'Saiu (pago)', valor: resumo.saiu },
      { item: 'Resultado', valor: resumo.resultado },
      { item: 'Saldo em bancos', valor: resumo.saldoBancos },
      { item: 'A receber (aberto)', valor: resumo.totalReceberAberto },
      { item: 'A pagar (aberto)', valor: resumo.totalPagarAberto },
      { item: 'Inadimplência', valor: resumo.inadimplencia },
      { item: 'A vencer 30d (receber)', valor: resumo.aVencer30.receber },
      { item: 'A vencer 30d (pagar)', valor: resumo.aVencer30.pagar },
    ]
    baixarCsv('resumo-executivo.csv', paraCsv(rows, [{ key: 'item', label: 'Item' }, { key: 'valor', label: 'Valor' }]))
  }

  return (
    <Stack>
      <Title order={3}>Relatórios Financeiros</Title>

      {/* Seletor de período (aplica ao Resumo e DRE) */}
      <Card withBorder padding="sm">
        <Group align="flex-end">
          <DateInput label="De" value={de} onChange={setDe} valueFormat="DD/MM/YYYY" className="w-40" />
          <DateInput label="Até" value={ate} onChange={setAte} valueFormat="DD/MM/YYYY" className="w-40" />
          <Button leftSection={<IconSearch size={16} />} onClick={aplicarPeriodo}>Aplicar período</Button>
        </Group>
      </Card>

      <Tabs defaultValue="resumo">
        <Tabs.List>
          <Tabs.Tab value="resumo">Resumo Executivo</Tabs.Tab>
          <Tabs.Tab value="dre">DRE Gerencial</Tabs.Tab>
          <Tabs.Tab value="inadimplencia">Inadimplência</Tabs.Tab>
        </Tabs.List>

        {/* RESUMO EXECUTIVO */}
        <Tabs.Panel value="resumo" pt="md">
          <div style={{ position: 'relative' }}>
            <LoadingOverlay visible={loadingResumo} />
            <Group justify="flex-end" mb="sm">
              <Button variant="light" leftSection={<IconDownload size={16} />} onClick={exportarResumo} disabled={!resumo}>Exportar CSV</Button>
            </Group>
            {resumo && (
              <Stack>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                  <Kpi label="Entrou (recebido)" valor={resumo.entrou} cor="green" icon={<IconTrendingUp size={18} color="green" />} />
                  <Kpi label="Saiu (pago)" valor={resumo.saiu} cor="red" icon={<IconTrendingDown size={18} color="red" />} />
                  <Kpi label="Resultado do período" valor={resumo.resultado} cor={resumo.resultado >= 0 ? 'green' : 'red'} />
                  <Kpi label="Saldo em bancos" valor={resumo.saldoBancos} icon={<IconWallet size={18} />} />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                  <Kpi label="A receber (em aberto)" valor={resumo.totalReceberAberto} cor="teal" />
                  <Kpi label="A pagar (em aberto)" valor={resumo.totalPagarAberto} cor="orange" />
                  <Kpi label="Inadimplência" valor={resumo.inadimplencia} cor="red" icon={<IconAlertTriangle size={18} color="red" />} />
                  <Card withBorder padding="md">
                    <Text size="xs" c="dimmed" mb={4}>A vencer nos próximos 30 dias</Text>
                    <Text size="sm">Receber: <b style={{ color: 'var(--mantine-color-teal-7)' }}>{formatarBRL(resumo.aVencer30.receber)}</b></Text>
                    <Text size="sm">Pagar: <b style={{ color: 'var(--mantine-color-orange-7)' }}>{formatarBRL(resumo.aVencer30.pagar)}</b></Text>
                  </Card>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <Card withBorder padding="sm">
                    <Text fw={600} size="sm" mb="xs">Maiores despesas por categoria</Text>
                    <Table>
                      <Table.Tbody>
                        {resumo.topDespesasCategoria.map((d, i) => (
                          <Table.Tr key={i}>
                            <Table.Td>{d.categoria}</Table.Td>
                            <Table.Td ta="right" fw={600} c="red">{formatarBRL(d.valor)}</Table.Td>
                          </Table.Tr>
                        ))}
                        {resumo.topDespesasCategoria.length === 0 && <Table.Tr><Table.Td><Text c="dimmed" size="sm">Sem despesas pagas no período</Text></Table.Td></Table.Tr>}
                      </Table.Tbody>
                    </Table>
                  </Card>
                  <Card withBorder padding="sm">
                    <Text fw={600} size="sm" mb="xs">Saldo por conta bancária</Text>
                    <Table>
                      <Table.Tbody>
                        {resumo.contasBancarias.map((c, i) => (
                          <Table.Tr key={i}>
                            <Table.Td>{c.nome}</Table.Td>
                            <Table.Td ta="right" fw={600}>{formatarBRL(c.saldo)}</Table.Td>
                          </Table.Tr>
                        ))}
                        {resumo.contasBancarias.length === 0 && <Table.Tr><Table.Td><Text c="dimmed" size="sm">Nenhuma conta bancária cadastrada</Text></Table.Td></Table.Tr>}
                      </Table.Tbody>
                    </Table>
                  </Card>
                </SimpleGrid>
              </Stack>
            )}
          </div>
        </Tabs.Panel>

        {/* DRE GERENCIAL */}
        <Tabs.Panel value="dre" pt="md">
          <div style={{ position: 'relative' }}>
            <LoadingOverlay visible={loadingDre} />
            <Card withBorder padding="sm">
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Categoria</Table.Th><Table.Th>Tipo</Table.Th><Table.Th ta="right">Valor</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {dre.map((l: any, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{nomeCategoria(l.categoriaId)}</Table.Td>
                      <Table.Td><Badge variant="light" color={l.tipo === 'RECEITA' ? 'green' : 'red'}>{l.tipo}</Badge></Table.Td>
                      <Table.Td ta="right" fw={600} c={l.tipo === 'RECEITA' ? 'green' : 'red'}>{formatarBRL(Number(l.total ?? 0))}</Table.Td>
                    </Table.Tr>
                  ))}
                  {dre.length === 0 && !loadingDre && <Table.Tr><Table.Td colSpan={3}><Text c="dimmed" ta="center" py="md">Sem movimento no período</Text></Table.Td></Table.Tr>}
                  {dre.length > 0 && (() => {
                    const receitas = dre.filter((l: any) => l.tipo === 'RECEITA').reduce((s, l: any) => s + Number(l.total ?? 0), 0)
                    const despesas = dre.filter((l: any) => l.tipo === 'DESPESA').reduce((s, l: any) => s + Number(l.total ?? 0), 0)
                    const resultado = receitas - despesas
                    return (
                      <>
                        <Table.Tr style={{ borderTop: '2px solid var(--mantine-color-gray-4)' }}>
                          <Table.Td fw={700}>Total Receitas</Table.Td><Table.Td /><Table.Td ta="right" fw={700} c="green">{formatarBRL(receitas)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td fw={700}>Total Despesas</Table.Td><Table.Td /><Table.Td ta="right" fw={700} c="red">{formatarBRL(despesas)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td fw={700}>Resultado</Table.Td><Table.Td /><Table.Td ta="right" fw={700} c={resultado >= 0 ? 'green' : 'red'}>{formatarBRL(resultado)}</Table.Td>
                        </Table.Tr>
                      </>
                    )
                  })()}
                </Table.Tbody>
              </Table>
            </Card>
          </div>
        </Tabs.Panel>

        {/* INADIMPLÊNCIA */}
        <Tabs.Panel value="inadimplencia" pt="md">
          <div style={{ position: 'relative' }}>
            <LoadingOverlay visible={loadingInad} />
            <Group justify="flex-end" mb="sm">
              <Button variant="light" leftSection={<IconDownload size={16} />} onClick={exportarInadimplencia} disabled={inadimplentes.length === 0}>Exportar CSV</Button>
            </Group>
            <Card withBorder padding="sm">
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Cliente</Table.Th><Table.Th ta="center">Títulos</Table.Th><Table.Th ta="right">Total vencido</Table.Th><Table.Th ta="center">Máx. atraso</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {inadimplentes.map((c, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{c.nome}</Table.Td>
                      <Table.Td ta="center">{c.titulos.length}</Table.Td>
                      <Table.Td ta="right" c="red" fw={600}>{formatarBRL(c.totalVencido)}</Table.Td>
                      <Table.Td ta="center"><Badge color="red" variant="light">{c.diasAtrasoMax} dias</Badge></Table.Td>
                    </Table.Tr>
                  ))}
                  {inadimplentes.length === 0 && !loadingInad && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Sem inadimplência 🎉</Text></Table.Td></Table.Tr>}
                </Table.Tbody>
              </Table>
            </Card>
          </div>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
