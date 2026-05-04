'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Select, Tabs, Table, Button, NumberInput, TextInput,
  LoadingOverlay, Badge, ActionIcon, Tooltip, Modal, SimpleGrid, Switch, Alert,
} from '@mantine/core'
import {
  IconSearch, IconPlus, IconEdit, IconTrash, IconCheck, IconPackage,
  IconBuildingWarehouse, IconTruck, IconMapPin,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function DadosLogisticosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Dados Logísticos' }, [])
  const queryClient = useQueryClient()

  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [searchProd, setSearchProd] = useState('')
  const [modalArmz, setModalArmz] = useState(false)
  const [modalPick, setModalPick] = useState(false)
  const [modalExp, setModalExp] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form states
  const [formArmz, setFormArmz] = useState({ sequencia: 1, enderecoFixoId: '', tipoNorma: 'FEFO', pulmaoRegulador: 0, nivelMinPP: 0, nivelMaxPP: 0, nivelMaxBlocado: 0, fixo: false })
  const [formPick, setFormPick] = useState({ sequencia: 1, enderecoPickingId: '', tipoPicking: 'NORMAL', capacidade: 0, pontoReposicao: 0, pontoReposicaoPercent: 0, pontoReposicaoDias: 0 })
  const [formExp, setFormExp] = useState({ fracionado: false, absorbePaleteFechado: false, absorbePaleteFechadoCx: false, tipoProduto: '', tipoCargaId: '' })

  // Produtos
  const { data: produtosResp } = useQuery<any>({
    queryKey: ['dl-produtos', searchProd],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProd || undefined } }); return data },
  })

  // Dados logísticos
  const { data: armzResp, isLoading: loadArmz } = useQuery<any>({
    queryKey: ['dl-armazenagem', produtoId],
    queryFn: async () => { const { data } = await api.get('/dados-logisticos/armazenagem', { params: { produtoId } }); return data },
    enabled: !!produtoId,
  })
  const { data: pickResp, isLoading: loadPick } = useQuery<any>({
    queryKey: ['dl-picking', produtoId],
    queryFn: async () => { const { data } = await api.get('/dados-logisticos/picking', { params: { produtoId } }); return data },
    enabled: !!produtoId,
  })
  const { data: expResp, isLoading: loadExp } = useQuery<any>({
    queryKey: ['dl-expedicao', produtoId],
    queryFn: async () => { const { data } = await api.get('/dados-logisticos/expedicao', { params: { produtoId } }); return data },
    enabled: !!produtoId,
  })

  // Endereços para selects
  const { data: enderecosResp } = useQuery<any>({
    queryKey: ['dl-enderecos'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/enderecos-livres'); return data },
    enabled: modalArmz || modalPick,
  })

  const produtos = (produtosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))
  const enderecoOptions = (enderecosResp || []).map((e: any) => ({ value: e.id, label: e.enderecoCompleto }))
  const armzData = armzResp?.data || []
  const pickData = pickResp?.data || []
  const expData = expResp?.data || []

  // Mutations
  const salvarArmz = useMutation({
    mutationFn: async () => {
      const payload = { ...formArmz, produtoId, skuSeq: 1, enderecoFixoId: formArmz.enderecoFixoId || undefined }
      if (editId) { await api.put(`/dados-logisticos/armazenagem/${editId}`, payload) }
      else { await api.post('/dados-logisticos/armazenagem', payload) }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dl-armazenagem'] }); setModalArmz(false); setEditId(null); notifications.show({ title: 'Sucesso', message: 'Dados de armazenagem salvos', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const salvarPick = useMutation({
    mutationFn: async () => {
      const payload = { ...formPick, produtoId, skuSeq: 1, enderecoPickingId: formPick.enderecoPickingId || undefined }
      if (editId) { await api.put(`/dados-logisticos/picking/${editId}`, payload) }
      else { await api.post('/dados-logisticos/picking', payload) }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dl-picking'] }); setModalPick(false); setEditId(null); notifications.show({ title: 'Sucesso', message: 'Dados de picking salvos', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const salvarExp = useMutation({
    mutationFn: async () => {
      const payload = { ...formExp, produtoId, skuSeq: 1, tipoProduto: formExp.tipoProduto || undefined, tipoCargaId: formExp.tipoCargaId || undefined }
      if (editId) { await api.put(`/dados-logisticos/expedicao/${editId}`, payload) }
      else { await api.post('/dados-logisticos/expedicao', payload) }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dl-expedicao'] }); setModalExp(false); setEditId(null); notifications.show({ title: 'Sucesso', message: 'Dados de expedição salvos', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const excluirArmz = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/dados-logisticos/armazenagem/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dl-armazenagem'] }); notifications.show({ title: 'Excluído', message: '', color: 'green' }) },
  })
  const excluirPick = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/dados-logisticos/picking/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dl-picking'] }); notifications.show({ title: 'Excluído', message: '', color: 'green' }) },
  })
  const excluirExp = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/dados-logisticos/expedicao/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dl-expedicao'] }); notifications.show({ title: 'Excluído', message: '', color: 'green' }) },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Dados Logísticos</Text>
      <Text size="xl" fw={600} mb="lg">Dados Logísticos do Produto</Text>

      <Card mb="md">
        <Select label="Selecione o Produto" placeholder="Buscar por código ou nome..." data={produtos}
          value={produtoId} onChange={setProdutoId} searchable onSearchChange={setSearchProd}
          leftSection={<IconSearch size={16} />} className="w-full max-w-lg" size="md" />
      </Card>

      {!produtoId && (
        <Alert icon={<IconPackage size={16} />} color="blue" variant="light">
          Selecione um produto para configurar seus dados logísticos de armazenagem, picking e expedição.
        </Alert>
      )}

      {produtoId && (
        <Card>
          <Tabs defaultValue="armazenagem">
            <Tabs.List mb="md">
              <Tabs.Tab value="armazenagem" leftSection={<IconBuildingWarehouse size={16} />}>Armazenagem ({armzData.length})</Tabs.Tab>
              <Tabs.Tab value="picking" leftSection={<IconMapPin size={16} />}>Picking ({pickData.length})</Tabs.Tab>
              <Tabs.Tab value="expedicao" leftSection={<IconTruck size={16} />}>Expedição ({expData.length})</Tabs.Tab>
            </Tabs.List>

            {/* ARMAZENAGEM */}
            <Tabs.Panel value="armazenagem">
              <LoadingOverlay visible={loadArmz} />
              <Group justify="flex-end" mb="sm">
                <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditId(null); setFormArmz({ sequencia: armzData.length + 1, enderecoFixoId: '', tipoNorma: 'FEFO', pulmaoRegulador: 0, nivelMinPP: 0, nivelMaxPP: 0, nivelMaxBlocado: 0, fixo: false }); setModalArmz(true) }}>Novo</Button>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr>
                  <Table.Th>Seq</Table.Th><Table.Th>Norma</Table.Th><Table.Th>End. Fixo</Table.Th>
                  <Table.Th>Pulmão Reg.</Table.Th><Table.Th>Nível Mín PP</Table.Th><Table.Th>Nível Máx PP</Table.Th>
                  <Table.Th>Fixo</Table.Th><Table.Th className="w-20">Ações</Table.Th>
                </Table.Tr></Table.Thead>
                <Table.Tbody>
                  {armzData.map((item: any) => (
                    <Table.Tr key={item.id}>
                      <Table.Td fw={600}>{item.sequencia}</Table.Td>
                      <Table.Td><Badge variant="light">{item.tipoNorma}</Badge></Table.Td>
                      <Table.Td className="font-mono text-sm">{item.enderecoFixoId ? item.enderecoFixoId.substring(0, 8) + '...' : '—'}</Table.Td>
                      <Table.Td>{item.pulmaoRegulador}</Table.Td>
                      <Table.Td>{item.nivelMinPP}</Table.Td>
                      <Table.Td>{item.nivelMaxPP}</Table.Td>
                      <Table.Td>{item.fixo ? <Badge color="green">Sim</Badge> : '—'}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => { setEditId(item.id); setFormArmz(item); setModalArmz(true) }}><IconEdit size={16} /></ActionIcon></Tooltip>
                          <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Excluir?')) excluirArmz.mutate(item.id) }}><IconTrash size={16} /></ActionIcon></Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {armzData.length === 0 && <Table.Tr><Table.Td colSpan={8} className="text-center py-6 text-zinc-500">Nenhum dado de armazenagem</Table.Td></Table.Tr>}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            {/* PICKING */}
            <Tabs.Panel value="picking">
              <LoadingOverlay visible={loadPick} />
              <Group justify="flex-end" mb="sm">
                <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditId(null); setFormPick({ sequencia: pickData.length + 1, enderecoPickingId: '', tipoPicking: 'NORMAL', capacidade: 0, pontoReposicao: 0, pontoReposicaoPercent: 0, pontoReposicaoDias: 0 }); setModalPick(true) }}>Novo</Button>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr>
                  <Table.Th>Seq</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>End. Picking</Table.Th>
                  <Table.Th>Capacidade</Table.Th><Table.Th>Ponto Rep.</Table.Th><Table.Th>Rep. %</Table.Th>
                  <Table.Th>Dias</Table.Th><Table.Th className="w-20">Ações</Table.Th>
                </Table.Tr></Table.Thead>
                <Table.Tbody>
                  {pickData.map((item: any) => (
                    <Table.Tr key={item.id}>
                      <Table.Td fw={600}>{item.sequencia}</Table.Td>
                      <Table.Td><Badge variant="light">{item.tipoPicking}</Badge></Table.Td>
                      <Table.Td className="font-mono text-sm">{item.enderecoPickingId ? item.enderecoPickingId.substring(0, 8) + '...' : '—'}</Table.Td>
                      <Table.Td>{Number(item.capacidade)}</Table.Td>
                      <Table.Td fw={500}>{Number(item.pontoReposicao)}</Table.Td>
                      <Table.Td>{Number(item.pontoReposicaoPercent)}%</Table.Td>
                      <Table.Td>{item.pontoReposicaoDias}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => { setEditId(item.id); setFormPick(item); setModalPick(true) }}><IconEdit size={16} /></ActionIcon></Tooltip>
                          <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Excluir?')) excluirPick.mutate(item.id) }}><IconTrash size={16} /></ActionIcon></Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {pickData.length === 0 && <Table.Tr><Table.Td colSpan={8} className="text-center py-6 text-zinc-500">Nenhum dado de picking</Table.Td></Table.Tr>}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            {/* EXPEDIÇÃO */}
            <Tabs.Panel value="expedicao">
              <LoadingOverlay visible={loadExp} />
              <Group justify="flex-end" mb="sm">
                <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditId(null); setFormExp({ fracionado: false, absorbePaleteFechado: false, absorbePaleteFechadoCx: false, tipoProduto: '', tipoCargaId: '' }); setModalExp(true) }}>Novo</Button>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr>
                  <Table.Th>Fracionado</Table.Th><Table.Th>Absorve Palete</Table.Th><Table.Th>Absorve Cx</Table.Th>
                  <Table.Th>Tipo Produto</Table.Th><Table.Th className="w-20">Ações</Table.Th>
                </Table.Tr></Table.Thead>
                <Table.Tbody>
                  {expData.map((item: any) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>{item.fracionado ? <Badge color="green">Sim</Badge> : 'Não'}</Table.Td>
                      <Table.Td>{item.absorbePaleteFechado ? <Badge color="blue">Sim</Badge> : 'Não'}</Table.Td>
                      <Table.Td>{item.absorbePaleteFechadoCx ? <Badge color="blue">Sim</Badge> : 'Não'}</Table.Td>
                      <Table.Td>{item.tipoProduto || '—'}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => { setEditId(item.id); setFormExp(item); setModalExp(true) }}><IconEdit size={16} /></ActionIcon></Tooltip>
                          <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Excluir?')) excluirExp.mutate(item.id) }}><IconTrash size={16} /></ActionIcon></Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {expData.length === 0 && <Table.Tr><Table.Td colSpan={5} className="text-center py-6 text-zinc-500">Nenhum dado de expedição</Table.Td></Table.Tr>}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
          </Tabs>
        </Card>
      )}

      {/* Modal Armazenagem */}
      <Modal opened={modalArmz} onClose={() => setModalArmz(false)} title={editId ? 'Editar Armazenagem' : 'Nova Armazenagem'} centered>
        <SimpleGrid cols={2} mb="md">
          <NumberInput label="Sequência" min={1} value={formArmz.sequencia} onChange={(v) => setFormArmz({ ...formArmz, sequencia: typeof v === 'number' ? v : 1 })} />
          <Select label="Tipo Norma" data={[{ value: 'FEFO', label: 'FEFO (Validade)' }, { value: 'FIFO', label: 'FIFO (Entrada)' }, { value: 'LIFO', label: 'LIFO (Último)' }]} value={formArmz.tipoNorma} onChange={(v) => setFormArmz({ ...formArmz, tipoNorma: v || 'FEFO' })} />
        </SimpleGrid>
        <Select label="Endereço Fixo" data={enderecoOptions} value={formArmz.enderecoFixoId || null} onChange={(v) => setFormArmz({ ...formArmz, enderecoFixoId: v || '' })} searchable clearable mb="md" />
        <SimpleGrid cols={3} mb="md">
          <NumberInput label="Pulmão Reg." min={0} value={formArmz.pulmaoRegulador} onChange={(v) => setFormArmz({ ...formArmz, pulmaoRegulador: typeof v === 'number' ? v : 0 })} />
          <NumberInput label="Nível Mín PP" min={0} value={formArmz.nivelMinPP} onChange={(v) => setFormArmz({ ...formArmz, nivelMinPP: typeof v === 'number' ? v : 0 })} />
          <NumberInput label="Nível Máx PP" min={0} value={formArmz.nivelMaxPP} onChange={(v) => setFormArmz({ ...formArmz, nivelMaxPP: typeof v === 'number' ? v : 0 })} />
        </SimpleGrid>
        <Switch label="Endereço Fixo" checked={formArmz.fixo} onChange={(e) => setFormArmz({ ...formArmz, fixo: e.currentTarget.checked })} mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalArmz(false)}>Cancelar</Button>
          <Button onClick={() => salvarArmz.mutate()} loading={salvarArmz.isPending} leftSection={<IconCheck size={16} />}>Salvar</Button>
        </Group>
      </Modal>

      {/* Modal Picking */}
      <Modal opened={modalPick} onClose={() => setModalPick(false)} title={editId ? 'Editar Picking' : 'Novo Picking'} centered>
        <SimpleGrid cols={2} mb="md">
          <NumberInput label="Sequência" min={1} value={formPick.sequencia} onChange={(v) => setFormPick({ ...formPick, sequencia: typeof v === 'number' ? v : 1 })} />
          <Select label="Tipo Picking" data={[{ value: 'NORMAL', label: 'Normal' }, { value: 'FLOW_RACK', label: 'Flow Rack' }]} value={formPick.tipoPicking} onChange={(v) => setFormPick({ ...formPick, tipoPicking: v || 'NORMAL' })} />
        </SimpleGrid>
        <Select label="Endereço Picking" data={enderecoOptions} value={formPick.enderecoPickingId || null} onChange={(v) => setFormPick({ ...formPick, enderecoPickingId: v || '' })} searchable clearable mb="md" />
        <SimpleGrid cols={2} mb="md">
          <NumberInput label="Capacidade" min={0} decimalScale={2} value={formPick.capacidade} onChange={(v) => setFormPick({ ...formPick, capacidade: typeof v === 'number' ? v : 0 })} />
          <NumberInput label="Ponto Reposição (qtd)" min={0} decimalScale={2} value={formPick.pontoReposicao} onChange={(v) => setFormPick({ ...formPick, pontoReposicao: typeof v === 'number' ? v : 0 })} />
        </SimpleGrid>
        <SimpleGrid cols={2} mb="md">
          <NumberInput label="Ponto Rep. (%)" min={0} max={100} decimalScale={1} value={formPick.pontoReposicaoPercent} onChange={(v) => setFormPick({ ...formPick, pontoReposicaoPercent: typeof v === 'number' ? v : 0 })} />
          <NumberInput label="Dias Reposição" min={0} value={formPick.pontoReposicaoDias} onChange={(v) => setFormPick({ ...formPick, pontoReposicaoDias: typeof v === 'number' ? v : 0 })} />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalPick(false)}>Cancelar</Button>
          <Button onClick={() => salvarPick.mutate()} loading={salvarPick.isPending} leftSection={<IconCheck size={16} />}>Salvar</Button>
        </Group>
      </Modal>

      {/* Modal Expedição */}
      <Modal opened={modalExp} onClose={() => setModalExp(false)} title={editId ? 'Editar Expedição' : 'Nova Expedição'} centered>
        <Switch label="Fracionado" checked={formExp.fracionado} onChange={(e) => setFormExp({ ...formExp, fracionado: e.currentTarget.checked })} mb="md" />
        <Switch label="Absorve Palete Fechado" checked={formExp.absorbePaleteFechado} onChange={(e) => setFormExp({ ...formExp, absorbePaleteFechado: e.currentTarget.checked })} mb="md" />
        <Switch label="Absorve Palete Fechado (Cx)" checked={formExp.absorbePaleteFechadoCx} onChange={(e) => setFormExp({ ...formExp, absorbePaleteFechadoCx: e.currentTarget.checked })} mb="md" />
        <TextInput label="Tipo Produto" value={formExp.tipoProduto} onChange={(e) => setFormExp({ ...formExp, tipoProduto: e.currentTarget.value })} mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalExp(false)}>Cancelar</Button>
          <Button onClick={() => salvarExp.mutate()} loading={salvarExp.isPending} leftSection={<IconCheck size={16} />}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
