'use client'

import { useState, useEffect } from 'react'
import { Paper, Title, Table, Button, Group, TextInput, NumberInput, Select, Modal, ActionIcon, Text, Badge, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
  .map(uf => ({ value: uf, label: uf }))

interface TabelaFrete {
  id: string
  nome: string
  descricao: string | null
  ufOrigem: string | null
  ufDestino: string | null
  valorFixo: number | null
  valorFretePeso: number | null
  valorAdValorem: number | null
  valorGris: number | null
  valorPedagio: number | null
  valorDespacho: number | null
  freteMinimo: number | null
  status: boolean
}

export default function TabelaServicoPage() {
  useModuloGuard('FISCAL')
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<TabelaFrete | null>(null)

  // Form state
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ufOrigem, setUfOrigem] = useState<string | null>(null)
  const [ufDestino, setUfDestino] = useState<string | null>(null)
  const [valorFixo, setValorFixo] = useState<number>(0)
  const [valorFretePeso, setValorFretePeso] = useState<number>(0)
  const [valorAdValorem, setValorAdValorem] = useState<number>(0)
  const [valorGris, setValorGris] = useState<number>(0)
  const [valorPedagio, setValorPedagio] = useState<number>(0)
  const [valorDespacho, setValorDespacho] = useState<number>(0)
  const [freteMinimo, setFreteMinimo] = useState<number>(0)

  const { data: tabelas = [], isLoading } = useQuery<TabelaFrete[]>({
    queryKey: ['fiscal', 'cte', 'tabelas-frete'],
    queryFn: async () => { const { data } = await api.get('/fiscal/cte/tabelas-frete'); return data },
  })

  const criarMutation = useMutation({
    mutationFn: async (payload: any) => { const { data } = await api.post('/fiscal/cte/tabelas-frete', payload); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'tabelas-frete'] }); notifications.show({ title: 'Sucesso', message: 'Tabela criada', color: 'green' }); fecharModal() },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }),
  })

  const atualizarMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => { const { data } = await api.put(`/fiscal/cte/tabelas-frete/${id}`, payload); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'tabelas-frete'] }); notifications.show({ title: 'Sucesso', message: 'Tabela atualizada', color: 'green' }); fecharModal() },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }),
  })

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/fiscal/cte/tabelas-frete/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'tabelas-frete'] }); notifications.show({ title: 'Excluída', message: '', color: 'green' }) },
  })

  function abrirCriacao() {
    setEditando(null); setNome(''); setDescricao(''); setUfOrigem(null); setUfDestino(null)
    setValorFixo(0); setValorFretePeso(0); setValorAdValorem(0); setValorGris(0)
    setValorPedagio(0); setValorDespacho(0); setFreteMinimo(0)
    setModalOpen(true)
  }

  function abrirEdicao(t: TabelaFrete) {
    setEditando(t); setNome(t.nome); setDescricao(t.descricao || '')
    setUfOrigem(t.ufOrigem); setUfDestino(t.ufDestino)
    setValorFixo(Number(t.valorFixo) || 0); setValorFretePeso(Number(t.valorFretePeso) || 0)
    setValorAdValorem(Number(t.valorAdValorem) || 0); setValorGris(Number(t.valorGris) || 0)
    setValorPedagio(Number(t.valorPedagio) || 0); setValorDespacho(Number(t.valorDespacho) || 0)
    setFreteMinimo(Number(t.freteMinimo) || 0)
    setModalOpen(true)
  }

  function fecharModal() { setModalOpen(false); setEditando(null) }

  function salvar() {
    if (!nome.trim()) { notifications.show({ title: 'Atenção', message: 'Informe o nome', color: 'yellow' }); return }
    const payload: any = {
      nome: nome.trim(), descricao: descricao || undefined,
      ufOrigem: ufOrigem || undefined, ufDestino: ufDestino || undefined,
      valorFixo: valorFixo || undefined, valorFretePeso: valorFretePeso || undefined,
      valorAdValorem: valorAdValorem || undefined, valorGris: valorGris || undefined,
      valorPedagio: valorPedagio || undefined, valorDespacho: valorDespacho || undefined,
      freteMinimo: freteMinimo || undefined,
    }
    if (editando) atualizarMutation.mutate({ id: editando.id, ...payload })
    else criarMutation.mutate(payload)
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Tabela de Serviço (Frete CT-e)</Title>
          <Text size="sm" c="dimmed">Cadastre valores de frete por rota para preencher automaticamente na emissão de CT-e.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCriacao}>Nova Tabela</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Rota</Table.Th>
            <Table.Th>Valor Fixo</Table.Th>
            <Table.Th>Frete/Kg</Table.Th>
            <Table.Th>Frete Mín.</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={80}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && <Table.Tr><Table.Td colSpan={7}><Text c="dimmed">Carregando...</Text></Table.Td></Table.Tr>}
          {tabelas.map((t) => (
            <Table.Tr key={t.id}>
              <Table.Td><Text fw={500}>{t.nome}</Text></Table.Td>
              <Table.Td>{t.ufOrigem && t.ufDestino ? `${t.ufOrigem} → ${t.ufDestino}` : '—'}</Table.Td>
              <Table.Td>{t.valorFixo ? `R$ ${Number(t.valorFixo).toFixed(2)}` : '—'}</Table.Td>
              <Table.Td>{t.valorFretePeso ? `R$ ${Number(t.valorFretePeso).toFixed(4)}/kg` : '—'}</Table.Td>
              <Table.Td>{t.freteMinimo ? `R$ ${Number(t.freteMinimo).toFixed(2)}` : '—'}</Table.Td>
              <Table.Td><Badge color={t.status ? 'green' : 'gray'}>{t.status ? 'Ativa' : 'Inativa'}</Badge></Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon variant="subtle" onClick={() => abrirEdicao(t)}><IconEdit size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Excluir?')) excluirMutation.mutate(t.id) }}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!isLoading && tabelas.length === 0 && (
            <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">Nenhuma tabela cadastrada</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={modalOpen} onClose={fecharModal} title={editando ? 'Editar Tabela' : 'Nova Tabela de Serviço'} size="lg">
        <Stack gap="sm">
          <TextInput label="Nome" placeholder="Ex: Frete Niterói-Petrópolis" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <TextInput label="Descrição" placeholder="Opcional" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <Group grow>
            <Select label="UF Origem" data={UFS} value={ufOrigem} onChange={setUfOrigem} clearable searchable />
            <Select label="UF Destino" data={UFS} value={ufDestino} onChange={setUfDestino} clearable searchable />
          </Group>
          <NumberInput label="Valor Fixo do Serviço (R$)" description="Se preenchido, usado como valor padrão da prestação" value={valorFixo} onChange={(v) => setValorFixo(Number(v) || 0)} min={0} decimalScale={2} />
          <Group grow>
            <NumberInput label="Frete/Kg (R$)" value={valorFretePeso} onChange={(v) => setValorFretePeso(Number(v) || 0)} min={0} decimalScale={4} />
            <NumberInput label="Ad Valorem (%)" value={valorAdValorem} onChange={(v) => setValorAdValorem(Number(v) || 0)} min={0} max={1} decimalScale={4} step={0.001} />
            <NumberInput label="GRIS (%)" value={valorGris} onChange={(v) => setValorGris(Number(v) || 0)} min={0} max={1} decimalScale={4} step={0.001} />
          </Group>
          <Group grow>
            <NumberInput label="Pedágio (R$)" value={valorPedagio} onChange={(v) => setValorPedagio(Number(v) || 0)} min={0} decimalScale={2} />
            <NumberInput label="Despacho (R$)" value={valorDespacho} onChange={(v) => setValorDespacho(Number(v) || 0)} min={0} decimalScale={2} />
            <NumberInput label="Frete Mínimo (R$)" value={freteMinimo} onChange={(v) => setFreteMinimo(Number(v) || 0)} min={0} decimalScale={2} />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={salvar} loading={criarMutation.isPending || atualizarMutation.isPending}>
              {editando ? 'Atualizar' : 'Criar'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}
