'use client'

/**
 * Cadastro de Prazos / Condições de Pagamento (Comercial, ligado ao Financeiro).
 * Spec comercial-pedido-proposta (revisão 3). Usado como Select no Pedido/Proposta.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Group, Table, Button, Text, Loader, Center, Paper, Modal,
  TextInput, NumberInput, Textarea, Switch, Badge, ScrollArea,
} from '@mantine/core'
import { IconPlus, IconEdit, IconRefresh, IconDeviceFloppy } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface Prazo {
  id: string
  descricao: string
  dias: number
  parcelas: number
  observacao?: string | null
  status: boolean
}

export default function PrazosPagamentoPage() {
  useEffect(() => { document.title = 'Prazos de Pagamento' }, [])

  const [data, setData] = useState<Prazo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Prazo | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [dias, setDias] = useState<number | ''>(0)
  const [parcelas, setParcelas] = useState<number | ''>(1)
  const [observacao, setObservacao] = useState('')
  const [ativo, setAtivo] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/orcamento-grafico/pedidos-proposta/prazos-pagamento', { params: { incluirInativos: true } })
      setData(Array.isArray(data) ? data : [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setDescricao(''); setDias(0); setParcelas(1); setObservacao(''); setAtivo(true)
    setModalAberto(true)
  }
  function abrirEdicao(p: Prazo) {
    setEditando(p)
    setDescricao(p.descricao); setDias(p.dias); setParcelas(p.parcelas); setObservacao(p.observacao || ''); setAtivo(p.status)
    setModalAberto(true)
  }

  async function salvar() {
    if (!descricao.trim()) { notifications.show({ message: 'Informe a descrição.', color: 'red' }); return }
    setSalvando(true)
    try {
      const payload = {
        descricao: descricao.trim(),
        dias: dias === '' ? 0 : Number(dias),
        parcelas: parcelas === '' ? 1 : Number(parcelas),
        observacao: observacao.trim() || null,
      }
      if (editando) {
        await api.put(`/orcamento-grafico/pedidos-proposta/prazos-pagamento/${editando.id}`, { ...payload, status: ativo })
      } else {
        await api.post('/orcamento-grafico/pedidos-proposta/prazos-pagamento', payload)
      }
      notifications.show({ title: 'Salvo', message: 'Prazo salvo.', color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      const msg = err?.response?.data?.code === 'DUPLICADO' ? 'Já existe um prazo com essa descrição.' : (err?.response?.data?.message || 'Falha ao salvar')
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Prazos de Pagamento</Title>
          <Text size="sm" c="dimmed">Condições de pagamento usadas nos pedidos/propostas (ligado ao Financeiro).</Text>
        </div>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo prazo</Button>
        </Group>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th ta="right">Dias</Table.Th>
                <Table.Th ta="right">Parcelas</Table.Th>
                <Table.Th>Observação</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={600}>{p.descricao}</Table.Td>
                  <Table.Td ta="right">{p.dias}</Table.Td>
                  <Table.Td ta="right">{p.parcelas}</Table.Td>
                  <Table.Td>{p.observacao || '—'}</Table.Td>
                  <Table.Td>{p.status ? <Badge color="green" variant="light">Ativo</Badge> : <Badge color="gray" variant="light">Inativo</Badge>}</Table.Td>
                  <Table.Td>
                    <Button size="compact-sm" variant="subtle" leftSection={<IconEdit size={15} />} onClick={() => abrirEdicao(p)}>Editar</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="md">Nenhum prazo cadastrado</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar prazo' : 'Novo prazo'} centered>
        <Stack gap="md">
          <TextInput label="Descrição" placeholder="Ex.: 28/35/42, 30 dias, À vista" required value={descricao} onChange={(e) => setDescricao(e.currentTarget.value)} />
          <Group grow>
            <NumberInput label="Prazo médio (dias)" min={0} value={dias} onChange={(v) => setDias(v === '' ? '' : Number(v))} />
            <NumberInput label="Parcelas" min={1} value={parcelas} onChange={(v) => setParcelas(v === '' ? '' : Number(v))} />
          </Group>
          <Textarea label="Observação" minRows={2} value={observacao} onChange={(e) => setObservacao(e.currentTarget.value)} />
          {editando && <Switch label="Ativo" checked={ativo} onChange={(e) => setAtivo(e.currentTarget.checked)} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button leftSection={<IconDeviceFloppy size={16} />} loading={salvando} onClick={salvar}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
