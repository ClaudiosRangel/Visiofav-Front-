'use client'

import { useEffect, useState } from 'react'
import {
  Button, Card, Group, Text, NumberInput, Select, TextInput, Textarea,
  Table, ActionIcon, Tooltip, SimpleGrid, Paper,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useCriarOrcamento } from '@/data/hooks/vendas/useOrcamento'
import { api } from '@/lib/api'

interface ItemForm {
  produtoId: string
  quantidade: number
  precoUnitario: number
  desconto: number
  unidade: string
}

export default function NovoOrcamentoPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Novo Orçamento' }, [])

  const router = useRouter()
  const criarOrcamento = useCriarOrcamento()

  // Form state
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [vendedorId, setVendedorId] = useState<string | null>(null)
  const [validadeAte, setValidadeAte] = useState<Date | null>(null)
  const [observacao, setObservacao] = useState('')
  const [contatoNome, setContatoNome] = useState('')
  const [contatoEmail, setContatoEmail] = useState('')
  const [tipoDesconto, setTipoDesconto] = useState<string | null>(null)
  const [descontoGeral, setDescontoGeral] = useState<number | ''>('')
  const [itens, setItens] = useState<ItemForm[]>([{ produtoId: '', quantidade: 1, precoUnitario: 0, desconto: 0, unidade: 'UN' }])

  // Fetch options
  const { data: clientesData } = useQuery<any>({ queryKey: ['clientes-select'], queryFn: async () => (await api.get('/clientes', { params: { limit: 100, status: 'true' } })).data, staleTime: 300000 })
  const { data: vendedoresData } = useQuery<any>({ queryKey: ['vendedores-select'], queryFn: async () => (await api.get('/vendedores', { params: { limit: 100, status: 'true' } })).data, staleTime: 300000 })
  const { data: produtosData } = useQuery<any>({ queryKey: ['produtos-select'], queryFn: async () => (await api.get('/produtos', { params: { limit: 200, status: 'true' } })).data, staleTime: 300000 })

  const clienteOptions = (clientesData?.data || []).map((c: any) => ({ value: c.id, label: c.razaoSocial }))
  const vendedorOptions = (vendedoresData?.data || []).map((v: any) => ({ value: v.id, label: v.nome }))
  const produtoOptions = (produtosData?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))

  function addItem() {
    setItens([...itens, { produtoId: '', quantidade: 1, precoUnitario: 0, desconto: 0, unidade: 'UN' }])
  }

  function removeItem(idx: number) {
    if (itens.length > 1) setItens(itens.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemForm, value: any) {
    const updated = [...itens]
    updated[idx] = { ...updated[idx], [field]: value }
    setItens(updated)
  }

  // Totalizador
  const subtotal = itens.reduce((acc, item) => {
    const preco = item.precoUnitario * (1 - item.desconto / 100)
    return acc + preco * item.quantidade
  }, 0)

  let valorTotal = subtotal
  if (tipoDesconto === 'PERCENTUAL' && descontoGeral) valorTotal = subtotal * (1 - Number(descontoGeral) / 100)
  else if (tipoDesconto === 'VALOR_FIXO' && descontoGeral) valorTotal = subtotal - Number(descontoGeral)

  async function handleSubmit() {
    if (!clienteId || !validadeAte) {
      notifications.show({ title: 'Erro', message: 'Cliente e data de validade são obrigatórios', color: 'red' })
      return
    }
    if (itens.some(i => !i.produtoId || i.quantidade <= 0)) {
      notifications.show({ title: 'Erro', message: 'Preencha todos os itens corretamente', color: 'red' })
      return
    }

    try {
      await criarOrcamento.mutateAsync({
        clienteId,
        vendedorId: vendedorId || undefined,
        validadeAte: validadeAte.toISOString().split('T')[0],
        observacao: observacao || undefined,
        contatoNome: contatoNome || undefined,
        contatoEmail: contatoEmail || undefined,
        tipoDesconto: tipoDesconto || undefined,
        descontoGeral: descontoGeral ? Number(descontoGeral) : undefined,
        itens: itens.map(i => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          desconto: i.desconto,
          unidade: i.unidade,
        })),
      })
      notifications.show({ title: 'Sucesso', message: 'Orçamento criado', color: 'green' })
      router.push('/vendas/orcamentos')
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar orçamento', color: 'red' })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Orçamentos / Novo</Text>
      <Group justify="space-between" mb="md">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/vendas/orcamentos')}>Voltar</Button>
          <Text size="xl" fw={600}>Novo Orçamento</Text>
        </Group>
        <Group>
          <Button variant="default" onClick={() => router.push('/vendas/orcamentos')}>Cancelar</Button>
          <Button loading={criarOrcamento.isPending} onClick={handleSubmit}>Criar Orçamento</Button>
        </Group>
      </Group>

      {/* Cabeçalho */}
      <Card withBorder mb="md" p="md">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Select label="Cliente *" data={clienteOptions} searchable value={clienteId} onChange={setClienteId} placeholder="Selecione..." />
          <Select label="Vendedor" data={vendedorOptions} searchable clearable value={vendedorId} onChange={setVendedorId} />
          <DateInput label="Validade *" placeholder="DD/MM/AAAA" valueFormat="DD/MM/YYYY" value={validadeAte} onChange={setValidadeAte} clearable />
          <TextInput label="Contato (Nome)" value={contatoNome} onChange={(e) => setContatoNome(e.currentTarget.value)} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="sm">
          <TextInput label="E-mail contato" value={contatoEmail} onChange={(e) => setContatoEmail(e.currentTarget.value)} />
          <Select label="Tipo Desconto" data={[{ value: 'PERCENTUAL', label: 'Percentual' }, { value: 'VALOR_FIXO', label: 'Valor Fixo' }]} clearable value={tipoDesconto} onChange={setTipoDesconto} />
          <NumberInput label="Desconto Geral" value={descontoGeral} onChange={(v) => setDescontoGeral(typeof v === 'number' ? v : '')} disabled={!tipoDesconto} min={0} decimalScale={2} suffix={tipoDesconto === 'PERCENTUAL' ? '%' : undefined} prefix={tipoDesconto === 'VALOR_FIXO' ? 'R$ ' : undefined} />
        </SimpleGrid>
        <Textarea label="Observação" mt="sm" value={observacao} onChange={(e) => setObservacao(e.currentTarget.value)} maxLength={2000} minRows={2} />
      </Card>

      {/* Itens */}
      <Card withBorder mb="md" p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={500}>Itens do Orçamento</Text>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addItem}>Adicionar Item</Button>
        </Group>
        <div style={{ overflowX: 'auto' }}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 200 }}>Produto</Table.Th>
                <Table.Th style={{ width: 90 }}>Qtd</Table.Th>
                <Table.Th style={{ width: 120 }}>Preço Unit.</Table.Th>
                <Table.Th style={{ width: 80 }}>Desc %</Table.Th>
                <Table.Th style={{ width: 110 }}>Total</Table.Th>
                <Table.Th style={{ width: 40 }}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((item, idx) => {
                const totalItem = item.precoUnitario * (1 - item.desconto / 100) * item.quantidade
                return (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Select data={produtoOptions} searchable size="xs" value={item.produtoId || null} onChange={(v) => updateItem(idx, 'produtoId', v || '')} placeholder="Selecione..." />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" min={0.0001} decimalScale={4} value={item.quantidade} onChange={(v) => updateItem(idx, 'quantidade', typeof v === 'number' ? v : 0)} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" min={0} decimalScale={4} prefix="R$ " value={item.precoUnitario} onChange={(v) => updateItem(idx, 'precoUnitario', typeof v === 'number' ? v : 0)} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" min={0} max={100} decimalScale={2} suffix="%" value={item.desconto} onChange={(v) => updateItem(idx, 'desconto', typeof v === 'number' ? v : 0)} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={600}>R$ {totalItem.toFixed(2)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {itens.length > 1 && (
                        <Tooltip label="Remover">
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeItem(idx)}><IconTrash size={14} /></ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </div>
      </Card>

      {/* Totalizador */}
      <Paper withBorder p="md" radius="md" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: 'var(--mantine-color-body)' }}>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <div><Text size="xs" c="dimmed">Itens</Text><Text fw={600}>{itens.length}</Text></div>
          <div><Text size="xs" c="dimmed">Subtotal</Text><Text fw={600}>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text></div>
          <div><Text size="xs" c="dimmed">Desconto</Text><Text fw={600} c="red">{tipoDesconto && descontoGeral ? (tipoDesconto === 'PERCENTUAL' ? `${descontoGeral}%` : `R$ ${Number(descontoGeral).toFixed(2)}`) : '—'}</Text></div>
          <div><Text size="xs" c="dimmed">Total</Text><Text fw={700} size="xl" c="blue">{Math.max(valorTotal, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text></div>
        </SimpleGrid>
      </Paper>
    </div>
  )
}
