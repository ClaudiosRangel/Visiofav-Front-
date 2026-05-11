'use client'

import { useState } from 'react'
import {
  Modal, Card, Group, Text, Badge, Button, TextInput, NumberInput,
  Select, Divider, Progress, Alert, SimpleGrid, Accordion, Stack,
} from '@mantine/core'
import { IconLink, IconPlus, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDeparaCreate, useCriarProdutoDepara } from '@/data/hooks/useDepara'

export interface PendingXmlItem {
  xmlItem: {
    codigoProdutoFornecedor: string
    descricao: string
    unidade: string
    quantidade: number
    valorUnitario: number
    valorTotal: number
    ncm: string
    cEAN: string | null
    cEANTrib: string | null
    uTrib: string | null
    qTrib: number | null
  }
  sugestoes: Array<{ produtoId: string; nome: string; cEAN: string | null }>
}

export interface ResolvedXmlItem {
  xmlItem: PendingXmlItem['xmlItem']
  produtoId: string
  produtoNome: string
  skuId: string | null
  fatorConversao: number
  quantidadeOriginal: number
  quantidadeConvertida: number
  unidadeInterna: string
  resolvidoPor: 'DEPARA' | 'EAN_TRIB' | 'EAN'
}

interface Props {
  opened: boolean
  onClose: () => void
  pendingItems: PendingXmlItem[]
  fornecedorId: string
  onItemResolved: (index: number, resolved: ResolvedXmlItem) => void
  onAllResolved: () => void
}

interface ItemFormState {
  produtoId: string
  fatorConversao: number
  mode: 'vincular' | 'criar'
  // Campos para criar novo produto
  novoProdutoCodigo: string
  novoProdutoNome: string
  novoProdutoUnidade: string
}

export default function PendingMappingModal({
  opened, onClose, pendingItems, fornecedorId, onItemResolved, onAllResolved,
}: Props) {
  const queryClient = useQueryClient()
  const criarDeparaMut = useDeparaCreate()
  const criarProdutoDeparaMut = useCriarProdutoDepara()

  const [resolvedIndexes, setResolvedIndexes] = useState<Set<number>>(new Set())
  const [itemForms, setItemForms] = useState<Record<number, ItemFormState>>({})
  const [produtoSearches, setProdutoSearches] = useState<Record<number, string>>({})
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null)

  const totalItems = pendingItems.length
  const resolvedCount = resolvedIndexes.size
  const allResolved = resolvedCount === totalItems

  // Buscar produtos para autocomplete (shared across items)
  const [globalProdutoSearch, setGlobalProdutoSearch] = useState('')
  const { data: produtosResp } = useQuery<{ data: Array<{ id: string; codigo: string; nome: string; unidade: string }> }>({
    queryKey: ['produtos', { search: globalProdutoSearch, limit: 30 }],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { search: globalProdutoSearch || undefined, limit: 30 } })
      return data
    },
    staleTime: 1000 * 60 * 2,
  })

  const produtosOptions = (produtosResp?.data || []).map(p => ({
    value: p.id,
    label: `${p.codigo} — ${p.nome}`,
  }))

  function getForm(index: number): ItemFormState {
    return itemForms[index] || {
      produtoId: '',
      fatorConversao: 1,
      mode: 'vincular',
      novoProdutoCodigo: pendingItems[index]?.xmlItem.codigoProdutoFornecedor || '',
      novoProdutoNome: pendingItems[index]?.xmlItem.descricao || '',
      novoProdutoUnidade: pendingItems[index]?.xmlItem.unidade || 'UN',
    }
  }

  function updateForm(index: number, updates: Partial<ItemFormState>) {
    setItemForms(prev => ({
      ...prev,
      [index]: { ...getForm(index), ...updates },
    }))
  }

  async function handleVincular(index: number) {
    const item = pendingItems[index]
    const form = getForm(index)

    if (form.mode === 'vincular') {
      if (!form.produtoId) {
        notifications.show({ title: 'Atenção', message: 'Selecione um produto interno', color: 'orange' })
        return
      }

      setLoadingIndex(index)
      try {
        await criarDeparaMut.mutateAsync({
          fornecedorId,
          codigoProdutoFornecedor: item.xmlItem.codigoProdutoFornecedor,
          descricaoFornecedor: item.xmlItem.descricao,
          produtoId: form.produtoId,
          unidadeFornecedor: item.xmlItem.unidade,
          fatorConversao: form.fatorConversao,
          cEAN: item.xmlItem.cEAN,
          cEANTrib: item.xmlItem.cEANTrib,
        })

        const produto = produtosResp?.data?.find(p => p.id === form.produtoId)
        const resolved: ResolvedXmlItem = {
          xmlItem: item.xmlItem,
          produtoId: form.produtoId,
          produtoNome: produto?.nome || '',
          skuId: null,
          fatorConversao: form.fatorConversao,
          quantidadeOriginal: item.xmlItem.quantidade,
          quantidadeConvertida: item.xmlItem.quantidade * form.fatorConversao,
          unidadeInterna: produto?.unidade || item.xmlItem.unidade,
          resolvidoPor: 'DEPARA',
        }

        setResolvedIndexes(prev => new Set([...prev, index]))
        onItemResolved(index, resolved)
        notifications.show({ title: 'Vinculado', message: `Item "${item.xmlItem.descricao}" vinculado com sucesso`, color: 'green' })

        // Check if all resolved
        if (resolvedCount + 1 === totalItems) {
          onAllResolved()
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Falha ao vincular'
        notifications.show({ title: 'Erro', message: msg, color: 'red' })
      } finally {
        setLoadingIndex(null)
      }
    } else {
      // Criar novo produto + De-Para
      if (!form.novoProdutoCodigo || !form.novoProdutoNome) {
        notifications.show({ title: 'Atenção', message: 'Preencha código e nome do produto', color: 'orange' })
        return
      }

      setLoadingIndex(index)
      try {
        const result = await criarProdutoDeparaMut.mutateAsync({
          codigo: form.novoProdutoCodigo,
          nome: form.novoProdutoNome,
          unidade: form.novoProdutoUnidade || 'UN',
          ncm: item.xmlItem.ncm || undefined,
          cEAN: item.xmlItem.cEAN,
          fornecedorId,
          codigoProdutoFornecedor: item.xmlItem.codigoProdutoFornecedor,
          descricaoFornecedor: item.xmlItem.descricao,
          unidadeFornecedor: item.xmlItem.unidade,
          fatorConversao: form.fatorConversao,
          cEANTrib: item.xmlItem.cEANTrib,
        })

        const resolved: ResolvedXmlItem = {
          xmlItem: item.xmlItem,
          produtoId: result.produto.id,
          produtoNome: result.produto.nome,
          skuId: result.sku?.id || null,
          fatorConversao: form.fatorConversao,
          quantidadeOriginal: item.xmlItem.quantidade,
          quantidadeConvertida: item.xmlItem.quantidade * form.fatorConversao,
          unidadeInterna: form.novoProdutoUnidade || 'UN',
          resolvidoPor: 'DEPARA',
        }

        setResolvedIndexes(prev => new Set([...prev, index]))
        onItemResolved(index, resolved)
        queryClient.invalidateQueries({ queryKey: ['produtos'] })
        notifications.show({ title: 'Produto criado', message: `Produto "${form.novoProdutoNome}" criado e vinculado`, color: 'green' })

        if (resolvedCount + 1 === totalItems) {
          onAllResolved()
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Falha ao criar produto'
        const status = err?.response?.status
        if (status === 409) {
          notifications.show({ title: 'Duplicata', message: msg, color: 'orange' })
        } else {
          notifications.show({ title: 'Erro', message: msg, color: 'red' })
        }
      } finally {
        setLoadingIndex(null)
      }
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Amarração Manual — Itens Pendentes"
      size="xl"
      centered
      closeOnClickOutside={false}
    >
      {/* Progress indicator */}
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>
          Progresso: {resolvedCount} de {totalItems} itens resolvidos
        </Text>
        <Badge color={allResolved ? 'green' : 'blue'} variant="light">
          {allResolved ? 'Todos resolvidos!' : `${totalItems - resolvedCount} pendente(s)`}
        </Badge>
      </Group>
      <Progress value={(resolvedCount / totalItems) * 100} mb="md" color={allResolved ? 'green' : 'blue'} />

      {allResolved && (
        <Alert icon={<IconCheck size={16} />} color="green" variant="light" mb="md">
          Todos os itens foram vinculados. Você pode fechar este modal e prosseguir com a criação da nota de entrada.
        </Alert>
      )}

      {/* Items list */}
      <Accordion variant="separated">
        {pendingItems.map((item, index) => {
          const isResolved = resolvedIndexes.has(index)
          const form = getForm(index)

          return (
            <Accordion.Item key={index} value={String(index)}>
              <Accordion.Control disabled={isResolved}>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm">
                    <Text size="sm" fw={500} className="font-mono">{item.xmlItem.codigoProdutoFornecedor}</Text>
                    <Text size="sm" c="dimmed" lineClamp={1}>{item.xmlItem.descricao}</Text>
                  </Group>
                  <Badge color={isResolved ? 'green' : 'orange'} variant="light" size="sm">
                    {isResolved ? '✓ Vinculado' : 'Pendente'}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                {/* Item details */}
                <Card withBorder mb="sm" p="sm">
                  <SimpleGrid cols={{ base: 2, sm: 4 }}>
                    <div>
                      <Text size="xs" c="dimmed">Código</Text>
                      <Text size="sm" className="font-mono">{item.xmlItem.codigoProdutoFornecedor}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Unidade</Text>
                      <Text size="sm">{item.xmlItem.unidade}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Quantidade</Text>
                      <Text size="sm">{item.xmlItem.quantidade}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Valor Total</Text>
                      <Text size="sm">{item.xmlItem.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
                    </div>
                  </SimpleGrid>
                  {(item.xmlItem.cEAN || item.xmlItem.cEANTrib) && (
                    <Group gap="md" mt="xs">
                      {item.xmlItem.cEAN && <Text size="xs" c="dimmed">cEAN: <span className="font-mono">{item.xmlItem.cEAN}</span></Text>}
                      {item.xmlItem.cEANTrib && <Text size="xs" c="dimmed">cEANTrib: <span className="font-mono">{item.xmlItem.cEANTrib}</span></Text>}
                    </Group>
                  )}
                </Card>

                {/* Mode toggle */}
                <Group mb="sm">
                  <Button
                    size="xs"
                    variant={form.mode === 'vincular' ? 'filled' : 'light'}
                    leftSection={<IconLink size={14} />}
                    onClick={() => updateForm(index, { mode: 'vincular' })}
                  >
                    Vincular a produto existente
                  </Button>
                  <Button
                    size="xs"
                    variant={form.mode === 'criar' ? 'filled' : 'light'}
                    leftSection={<IconPlus size={14} />}
                    onClick={() => updateForm(index, { mode: 'criar' })}
                  >
                    Criar novo produto
                  </Button>
                </Group>

                {form.mode === 'vincular' ? (
                  <SimpleGrid cols={{ base: 1, sm: 2 }} mb="sm">
                    <Select
                      label="Produto Interno"
                      placeholder="Buscar por nome, código ou EAN..."
                      data={produtosOptions}
                      searchable
                      onSearchChange={(v) => {
                        setProdutoSearches(prev => ({ ...prev, [index]: v }))
                        setGlobalProdutoSearch(v)
                      }}
                      value={form.produtoId || null}
                      onChange={(v) => updateForm(index, { produtoId: v || '' })}
                    />
                    <NumberInput
                      label="Fator de Conversão"
                      min={0.0001}
                      decimalScale={4}
                      step={0.1}
                      value={form.fatorConversao}
                      onChange={(v) => updateForm(index, { fatorConversao: typeof v === 'number' ? v : 1 })}
                    />
                  </SimpleGrid>
                ) : (
                  <Stack gap="sm" mb="sm">
                    <SimpleGrid cols={{ base: 1, sm: 3 }}>
                      <TextInput
                        label="Código do Produto"
                        value={form.novoProdutoCodigo}
                        onChange={(e) => updateForm(index, { novoProdutoCodigo: e.currentTarget.value })}
                      />
                      <TextInput
                        label="Nome do Produto"
                        value={form.novoProdutoNome}
                        onChange={(e) => updateForm(index, { novoProdutoNome: e.currentTarget.value })}
                      />
                      <TextInput
                        label="Unidade"
                        value={form.novoProdutoUnidade}
                        onChange={(e) => updateForm(index, { novoProdutoUnidade: e.currentTarget.value })}
                        maxLength={6}
                      />
                    </SimpleGrid>
                    <NumberInput
                      label="Fator de Conversão"
                      min={0.0001}
                      decimalScale={4}
                      step={0.1}
                      value={form.fatorConversao}
                      onChange={(v) => updateForm(index, { fatorConversao: typeof v === 'number' ? v : 1 })}
                      className="max-w-xs"
                    />
                    <Text size="xs" c="dimmed">
                      O produto será criado com os dados do XML (NCM, EAN) pré-preenchidos.
                    </Text>
                  </Stack>
                )}

                <Button
                  leftSection={form.mode === 'vincular' ? <IconLink size={16} /> : <IconPlus size={16} />}
                  onClick={() => handleVincular(index)}
                  loading={loadingIndex === index}
                  disabled={isResolved}
                >
                  {form.mode === 'vincular' ? 'Vincular' : 'Criar Produto e Vincular'}
                </Button>
              </Accordion.Panel>
            </Accordion.Item>
          )
        })}
      </Accordion>

      <Divider my="md" />

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {allResolved ? 'Fechar' : 'Fechar (itens pendentes permanecerão)'}
        </Button>
      </Group>
    </Modal>
  )
}
