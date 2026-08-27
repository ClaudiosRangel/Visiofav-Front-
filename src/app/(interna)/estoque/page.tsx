'use client'

import { Card, Group, Text, SimpleGrid, ThemeIcon, Table, TextInput, Button, LoadingOverlay, Tabs, Badge, Collapse, ActionIcon } from '@mantine/core'
import { IconPackage, IconMapPin, IconAlertTriangle, IconSearch, IconRefresh, IconLock, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function EstoquePage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Estoque' }, [])
  const [search, setSearch] = useState('')
  const [aba, setAba] = useState<string>('endereco')
  const [expandido, setExpandido] = useState<Set<string>>(new Set())

  const { data: prodResp } = useQuery<any>({
    queryKey: ['estoque-produtos-count'],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 1 } }); return data },
    staleTime: 1000 * 60 * 5,
  })

  const { data: saldosResp, isLoading, refetch } = useQuery<any>({
    queryKey: ['saldos', search],
    queryFn: async () => { const { data } = await api.get('/saldos', { params: { search: search || undefined } }); return data },
    staleTime: 1000 * 60,
  })

  const { data: estoqueResp } = useQuery<any>({
    queryKey: ['estoque-consolidado'],
    queryFn: async () => { const { data } = await api.get('/saldos', { params: { limit: 1 } }); return data },
    staleTime: 1000 * 60 * 5,
  })

  // Visão consolidada por produto (origem WMS/ERP, reservado, disponível)
  const { data: consolidadoResp, isLoading: loadingConsolidado, refetch: refetchConsolidado } = useQuery<any>({
    queryKey: ['saldos-consolidado', search],
    queryFn: async () => { const { data } = await api.get('/saldos/consolidado', { params: { busca: search || undefined } }); return data },
    staleTime: 1000 * 60,
    enabled: aba === 'produto',
  })

  const saldos = saldosResp?.data || []
  const consolidado = consolidadoResp?.data || []

  function toggleExpandir(produtoId: string) {
    setExpandido((prev) => {
      const next = new Set(prev)
      if (next.has(produtoId)) next.delete(produtoId)
      else next.add(produtoId)
      return next
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Estoque</Text>
      <Text size="xl" fw={600} mb="lg">Consulta de Estoque</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Produtos Cadastrados</Text>
              <Text size="xl" fw={700} mt={4}>{prodResp?.total || 0}</Text>
            </div>
            <ThemeIcon color="teal" variant="light" size={48} radius="md"><IconPackage size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Posições com Saldo</Text>
              <Text size="xl" fw={700} mt={4}>{estoqueResp?.total || 0}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconMapPin size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Registros de Saldo</Text>
              <Text size="xl" fw={700} mt={4}>{saldosResp?.total || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconAlertTriangle size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading || loadingConsolidado} />
        <Group justify="space-between" mb="md" wrap="wrap">
          <TextInput placeholder="Pesquisar por produto ou endereço..." leftSection={<IconSearch size={16} />}
            value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-full md:w-96" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => { refetch(); refetchConsolidado() }}>Atualizar</Button>
        </Group>

        <Tabs value={aba} onChange={(v) => setAba(v || 'endereco')} mb="md">
          <Tabs.List>
            <Tabs.Tab value="endereco" leftSection={<IconMapPin size={14} />}>Por Endereço</Tabs.Tab>
            <Tabs.Tab value="produto" leftSection={<IconPackage size={14} />}>Por Produto (Disponível)</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* ─── Visão Por Endereço (WMS, linha por saldo) ─── */}
        {aba === 'endereco' && (
        <div className="overflow-x-auto">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Endereço</Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Lote</Table.Th>
              <Table.Th>Validade</Table.Th>
              <Table.Th>Quantidade</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {saldos.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td><Text fw={500} ff="monospace" size="sm">{item.endereco?.enderecoCompleto || '—'}</Text></Table.Td>
                <Table.Td>{item.produto?.nome || item.produto?.descricao || '—'}</Table.Td>
                <Table.Td className="text-sm text-zinc-500">{item.lote || '—'}</Table.Td>
                <Table.Td>{item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                <Table.Td><Text fw={600}>{Number(item.quantidade)}</Text></Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && saldos.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} className="text-center py-8 text-zinc-500">
                  Nenhum saldo registrado. Os saldos serão gerados após o endereçamento das mercadorias conferidas.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
        </div>
        )}

        {/* ─── Visão Por Produto (Origem + Reservado + Disponível) ─── */}
        {aba === 'produto' && (
        <div className="overflow-x-auto">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 30 }}></Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th>Físico</Table.Th>
              <Table.Th>Reservado</Table.Th>
              <Table.Th>Disponível</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {consolidado.map((p: any) => (
              <>
                <Table.Tr key={p.produtoId}>
                  <Table.Td>
                    {p.origem === 'WMS' && p.enderecos?.length > 0 && (
                      <ActionIcon variant="subtle" size="sm" onClick={() => toggleExpandir(p.produtoId)} title="Ver endereços">
                        {expandido.has(p.produtoId) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                      </ActionIcon>
                    )}
                  </Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{p.codigo ? `${p.codigo} — ` : ''}{p.nome || '—'}</Text></Table.Td>
                  <Table.Td>
                    <Badge color={p.origem === 'WMS' ? 'blue' : 'gray'} variant="light">{p.origem}</Badge>
                  </Table.Td>
                  <Table.Td>{Number(p.fisico).toLocaleString('pt-BR')} {p.unidade}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <IconLock size={13} color="var(--mantine-color-orange-6)" />
                      <Text size="sm" c={p.reservado > 0 ? 'orange' : 'dimmed'} fw={p.reservado > 0 ? 600 : undefined}
                        title={`Venda: ${p.reservadoVenda} | Produção: ${p.reservadoProducao}`}>
                        {Number(p.reservado).toLocaleString('pt-BR')}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text fw={700} c="green">{Number(p.disponivel).toLocaleString('pt-BR')} {p.unidade}</Text></Table.Td>
                </Table.Tr>
                {p.origem === 'WMS' && expandido.has(p.produtoId) && (
                  <Table.Tr key={`${p.produtoId}-end`}>
                    <Table.Td></Table.Td>
                    <Table.Td colSpan={5} style={{ background: 'var(--mantine-color-gray-light)' }}>
                      <Text size="xs" fw={600} c="dimmed" mb={4}>Onde está (endereços):</Text>
                      {p.enderecos.map((e: any, i: number) => (
                        <Text key={i} size="xs" ff="monospace">
                          {e.enderecoCompleto || '—'} · {Number(e.quantidade).toLocaleString('pt-BR')} {p.unidade}
                          {e.lote ? ` · lote ${e.lote}` : ''}
                          {e.validade ? ` · val ${new Date(e.validade).toLocaleDateString('pt-BR')}` : ''}
                        </Text>
                      ))}
                    </Table.Td>
                  </Table.Tr>
                )}
              </>
            ))}
            {!loadingConsolidado && consolidado.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum produto com saldo. O disponível considera reservas de venda e de produção.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
        </div>
        )}
      </Card>
    </div>
  )
}
