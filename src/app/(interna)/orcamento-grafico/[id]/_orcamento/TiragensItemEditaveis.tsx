'use client'

/**
 * Tiragens do item no Fechamento: uma linha por tiragem, com Margem e Valor Total editáveis.
 * Digitar o valor grava o valor e o back calcula a margem de volta; digitar a margem refaz o valor.
 * "Voltar ao cálculo" descarta o valor digitado. Nada é recalculado aqui: o back grava e devolve.
 */

import { useCallback, useEffect, useState } from 'react'
import { ActionIcon, Alert, Badge, Group, Loader, NumberInput, Select, Stack, Table, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowBackUp, IconInfoCircle } from '@tabler/icons-react'

import { api } from '@/lib/api'

import { formatarInteiro, formatarMoeda, formatarPercentual2 } from './formatadores'
import { formatarValorUnitario } from './formatacao'
import { corpoDaEdicao, linhasDaTela, type EdicaoTiragem, type LinhaTiragemApi, type LinhaTiragemTela } from './tiragens-editaveis'

export interface ItemParaTiragens {
  id: string
  sequencia: number
  descricao?: string | null
}

export interface TiragensItemEditaveisProps {
  orcamentoId: string
  itens: readonly ItemParaTiragens[]
  /** Item selecionado na tela do orçamento (vem selecionado por padrão). */
  itemInicialId: string | null
  podeEditar: boolean
  /** Chamado depois que uma tiragem foi gravada (recarregar totais e cabeçalho). */
  onAlterado?: () => void
}

function mensagemErro(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } } }
  return e?.response?.data?.message ?? 'Não foi possível gravar a tiragem.'
}

export default function TiragensItemEditaveis({ orcamentoId, itens, itemInicialId, podeEditar, onAlterado }: TiragensItemEditaveisProps) {
  const [itemId, setItemId] = useState<string | null>(itemInicialId)
  const [linhas, setLinhas] = useState<LinhaTiragemTela[]>([])
  const [carregando, setCarregando] = useState(false)
  const [gravando, setGravando] = useState<number | null>(null)

  useEffect(() => { if (itemInicialId) setItemId(itemInicialId) }, [itemInicialId])

  const carregar = useCallback(async (id: string) => {
    setCarregando(true)
    try {
      const { data } = await api.get<LinhaTiragemApi[]>(`/orcamento-grafico/${orcamentoId}/itens/${id}/tiragens`)
      setLinhas(linhasDaTela(data))
    } catch {
      setLinhas([])
    } finally {
      setCarregando(false)
    }
  }, [orcamentoId])

  useEffect(() => { if (itemId) void carregar(itemId) }, [itemId, carregar])

  async function gravar(linha: LinhaTiragemTela, edicao: EdicaoTiragem) {
    if (!itemId) return
    const corpo = corpoDaEdicao(edicao, linha)
    if (!corpo) return
    setGravando(linha.quantidade)
    try {
      await api.put(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/tiragens/${linha.quantidade}`, corpo)
      await carregar(itemId)
      onAlterado?.()
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErro(err), color: 'red' })
    } finally {
      setGravando(null)
    }
  }

  const opcoes = itens.map((i) => ({ value: i.id, label: `Item ${i.sequencia} — ${i.descricao ?? 'Sem descrição'}` }))

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end">
        <Text fw={600} size="sm">Tiragens do item</Text>
        <Select size="xs" w={360} data={opcoes} value={itemId} onChange={setItemId} allowDeselect={false} aria-label="Item" />
      </Group>

      {carregando ? (
        <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Carregando tiragens…</Text></Group>
      ) : linhas.length === 0 ? (
        <Alert variant="light" icon={<IconInfoCircle size={16} />}>
          Este item ainda não tem tiragens calculadas. Salve o item com a lista de tiragens.
        </Alert>
      ) : (
        <Table striped withTableBorder verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th ta="right">Tiragem</Table.Th>
              <Table.Th ta="right">Custo</Table.Th>
              <Table.Th ta="right">Margem %</Table.Th>
              <Table.Th ta="right">C.Marg.</Table.Th>
              <Table.Th ta="right">Valor Unitário</Table.Th>
              <Table.Th ta="right">Valor Total</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {linhas.map((l) => (
              <Table.Tr key={l.quantidade}>
                <Table.Td ta="right">
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    {l.referencia && <Badge size="xs" variant="light">referência</Badge>}
                    <Text size="sm">{formatarInteiro(l.quantidade)}</Text>
                  </Group>
                </Table.Td>
                <Table.Td ta="right"><Text size="sm">{formatarMoeda(l.custoProducao)}</Text></Table.Td>
                <Table.Td ta="right">
                  {podeEditar ? (
                    <NumberInput
                      key={`m-${l.quantidade}-${l.margemPerc}`}
                      size="xs" w={100} ml="auto" decimalScale={2} decimalSeparator="," thousandSeparator="."
                      defaultValue={l.margemPerc ?? undefined}
                      disabled={gravando === l.quantidade}
                      aria-label={`Margem da tiragem ${l.quantidade}`}
                      onBlur={(e) => void gravar(l, { tipo: 'margem', margem: Number(e.currentTarget.value.replace(/\./g, '').replace(',', '.')) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  ) : (
                    <Text size="sm">{formatarPercentual2(l.margemPerc)}</Text>
                  )}
                </Table.Td>
                <Table.Td ta="right"><Text size="sm">{formatarPercentual2(l.cmPerc)}</Text></Table.Td>
                <Table.Td ta="right"><Text size="sm">{formatarValorUnitario(l.valorUnitario)}</Text></Table.Td>
                <Table.Td ta="right">
                  {podeEditar ? (
                    <NumberInput
                      key={`v-${l.quantidade}-${l.valorTotal}`}
                      size="xs" w={140} ml="auto" decimalScale={2} fixedDecimalScale decimalSeparator="," thousandSeparator="."
                      prefix="R$ " min={0}
                      defaultValue={l.valorTotal ?? undefined}
                      disabled={gravando === l.quantidade}
                      aria-label={`Valor total da tiragem ${l.quantidade}`}
                      onBlur={(e) => void gravar(l, { tipo: 'valor', valor: Number(e.currentTarget.value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  ) : (
                    <Text size="sm" fw={600}>{formatarMoeda(l.valorTotal)}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    {l.digitado && <Badge size="xs" color="orange" variant="light">digitado</Badge>}
                    {l.digitado && podeEditar && (
                      <Tooltip label="Voltar ao cálculo">
                        <ActionIcon size="sm" variant="subtle" aria-label="Voltar ao cálculo" loading={gravando === l.quantidade} onClick={() => void gravar(l, { tipo: 'limpar' })}>
                          <IconArrowBackUp size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
