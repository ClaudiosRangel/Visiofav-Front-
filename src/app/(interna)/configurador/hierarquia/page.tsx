'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Button, ActionIcon, Tooltip, Modal, TextInput,
  Select, Switch, LoadingOverlay, Badge, Tabs,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconSitemap } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

// Ordem e rótulos dos 5 níveis fixos.
const NIVEIS = [
  { tipo: 'DEPARTAMENTO', label: 'Departamento', pai: null },
  { tipo: 'SECAO', label: 'Seção', pai: 'DEPARTAMENTO' },
  { tipo: 'CATEGORIA', label: 'Categoria', pai: 'SECAO' },
  { tipo: 'SUBCATEGORIA', label: 'Subcategoria', pai: 'CATEGORIA' },
  { tipo: 'FAMILIA', label: 'Família', pai: 'SUBCATEGORIA' },
] as const

type TipoNivel = (typeof NIVEIS)[number]['tipo']

export default function HierarquiaMercadologicaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - Hierarquia Mercadológica' }, [])
  const queryClient = useQueryClient()

  const [tipoAtivo, setTipoAtivo] = useState<TipoNivel>('DEPARTAMENTO')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [paiId, setPaiId] = useState<string | null>(null)

  const nivelDef = NIVEIS.find((n) => n.tipo === tipoAtivo)!
  const tipoPai = nivelDef.pai

  // Lista do tipo ativo
  const { data: listaResp, isLoading } = useQuery<any>({
    queryKey: ['hierarquia', tipoAtivo],
    queryFn: async () => { const { data } = await api.get('/hierarquia-mercadologica', { params: { tipo: tipoAtivo, limit: 500 } }); return data },
  })

  // Opções de pai (do tipo imediatamente superior)
  const { data: paisResp } = useQuery<any>({
    queryKey: ['hierarquia-pais', tipoPai],
    queryFn: async () => {
      if (!tipoPai) return { data: [] }
      const { data } = await api.get('/hierarquia-mercadologica', { params: { tipo: tipoPai, status: true, limit: 500 } })
      return data
    },
    enabled: !!tipoPai && modalOpen,
  })
  const paiOptions = (paisResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigoHierarquico} — ${p.descricao}` }))

  const salvar = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { data } = await api.put(`/hierarquia-mercadologica/${editId}`, { descricao })
        return data
      }
      const { data } = await api.post('/hierarquia-mercadologica', {
        tipo: tipoAtivo, codigo, descricao, paiId: tipoPai ? paiId : undefined,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarquia'] })
      setModalOpen(false)
      notifications.show({ title: 'Sucesso', message: editId ? 'Nível atualizado' : 'Nível criado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    },
  })

  const alterarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      await api.patch(`/hierarquia-mercadologica/${id}/status`, { status })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hierarquia'] }),
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/hierarquia-mercadologica/${id}`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarquia'] })
      notifications.show({ title: 'Sucesso', message: 'Nível excluído', color: 'green' })
    },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' }),
  })

  function abrirNovo() {
    setEditId(null); setCodigo(''); setDescricao(''); setPaiId(null); setModalOpen(true)
  }
  function abrirEdicao(item: any) {
    setEditId(item.id); setCodigo(item.codigo); setDescricao(item.descricao); setPaiId(item.paiId ?? null); setModalOpen(true)
  }

  const itens = listaResp?.data || []

  return (
    <div className="p-4">
      <Text size="xs" c="dimmed" mb={4}>Configurador / Hierarquia Mercadológica</Text>
      <Group justify="space-between" mb="md">
        <Group gap={8}>
          <IconSitemap size={22} />
          <Text size="xl" fw={600}>Hierarquia Mercadológica</Text>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo {nivelDef.label}</Button>
      </Group>

      <Tabs value={tipoAtivo} onChange={(v) => setTipoAtivo((v as TipoNivel) || 'DEPARTAMENTO')} mb="md">
        <Tabs.List>
          {NIVEIS.map((n) => <Tabs.Tab key={n.tipo} value={n.tipo}>{n.label}</Tabs.Tab>)}
        </Tabs.List>
      </Tabs>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 120 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td><Text ff="monospace" fw={500}>{item.codigoHierarquico}</Text></Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td>
                  <Switch
                    checked={item.status}
                    onChange={(e) => alterarStatus.mutate({ id: item.id, status: e.currentTarget.checked })}
                    label={item.status ? 'Ativo' : 'Inativo'}
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => abrirEdicao(item)}><IconEdit size={18} /></ActionIcon></Tooltip>
                    <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Excluir este nível?')) excluir.mutate(item.id) }}><IconTrash size={18} /></ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {itens.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Nenhum {nivelDef.label.toLowerCase()} cadastrado</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={`${editId ? 'Editar' : 'Novo'} ${nivelDef.label}`} centered>
        {tipoPai && !editId && (
          <Select
            label={`${NIVEIS.find((n) => n.tipo === tipoPai)!.label} (pai)`}
            placeholder="Selecione o nível pai"
            data={paiOptions}
            value={paiId}
            onChange={setPaiId}
            searchable
            required
            mb="sm"
          />
        )}
        {!editId && (
          <TextInput
            label="Código do segmento"
            placeholder={tipoAtivo === 'FAMILIA' ? 'Ex.: 001 (3 dígitos)' : 'Ex.: 01 (2 dígitos)'}
            value={codigo}
            onChange={(e) => setCodigo(e.currentTarget.value)}
            mb="sm"
            required
          />
        )}
        <TextInput
          label="Descrição"
          placeholder="Descrição do nível"
          value={descricao}
          onChange={(e) => setDescricao(e.currentTarget.value)}
          mb="md"
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => salvar.mutate()}
            loading={salvar.isPending}
            disabled={!descricao.trim() || (!editId && (!codigo.trim() || (!!tipoPai && !paiId)))}
          >
            Salvar
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
