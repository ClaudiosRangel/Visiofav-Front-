'use client'

/**
 * Tiragens do item no Fechamento: uma linha por tiragem, com Margem, Valor Unitário e Valor Total.
 * Digitar o valor (unitário ou total) grava o valor e o back calcula a margem de volta; digitar a margem
 * refaz o valor. "Voltar ao cálculo" descarta o valor digitado. Nada é recalculado aqui: o back grava e
 * devolve. Digitar valor e voltar ao cálculo exigem a permissão "Alterar valor unitário" (ficam no log);
 * cada tiragem mostra se a margem entre custo e preço está dentro ou abaixo da mínima configurada.
 */

import { useCallback, useEffect, useState } from 'react'
import { ActionIcon, Alert, Badge, Button, Group, Loader, Modal, NumberInput, Select, Stack, Table, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowBackUp, IconHistory, IconInfoCircle } from '@tabler/icons-react'

import { api } from '@/lib/api'

import { formatarInteiro, formatarMoeda, formatarPercentual2 } from './formatadores'
import { formatarValorUnitario } from './formatacao'
import {
  corpoDaEdicao,
  linhasDaTela,
  rotuloSituacaoMargem,
  type EdicaoTiragem,
  type LinhaTiragemApi,
  type LinhaTiragemTela,
} from './tiragens-editaveis'

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

interface LogValor {
  id: string
  itemId: string
  quantidade: number
  valorAnterior: number | null
  valorNovo: number | null
  margemAnterior: number | null
  margemNova: number | null
  margemMinima: number | null
  abaixoMargem: boolean
  acao: 'VALOR' | 'LIMPAR'
  usuarioNome: string | null
  criadoEm: string
}

function mensagemErro(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } } }
  return e?.response?.data?.message ?? 'Não foi possível gravar a tiragem.'
}

const numeroDigitado = (s: string) => Number(s.replace('R$', '').trim().replace(/\./g, '').replace(',', '.'))

/** Permissão do usuário para digitar o valor (Orçamento → Permissões). */
function usePodeAlterarValor(): boolean {
  const [pode, setPode] = useState(false)
  useEffect(() => {
    let ativo = true
    api
      .get('/orcamento-grafico/comercial/permissoes/minha')
      .then(({ data }) => { if (ativo) setPode(Boolean(data?.isAdmin || data?.podeAlterarValorUnitario)) })
      .catch(() => { if (ativo) setPode(false) })
    return () => { ativo = false }
  }, [])
  return pode
}

export default function TiragensItemEditaveis({ orcamentoId, itens, itemInicialId, podeEditar, onAlterado }: TiragensItemEditaveisProps) {
  const [itemId, setItemId] = useState<string | null>(itemInicialId)
  const [linhas, setLinhas] = useState<LinhaTiragemTela[]>([])
  const [carregando, setCarregando] = useState(false)
  const [gravando, setGravando] = useState<number | null>(null)
  const [logAberto, setLogAberto] = useState(false)
  const [log, setLog] = useState<LogValor[] | null>(null)
  const podeAlterarValor = usePodeAlterarValor()
  const editaValor = podeEditar && podeAlterarValor

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
      const { data } = await api.put(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/tiragens/${linha.quantidade}`, corpo)
      if (data?.situacaoMargem === 'ABAIXO') {
        notifications.show({
          title: 'Abaixo da margem',
          message: `A tiragem de ${formatarInteiro(linha.quantidade)} ficou abaixo da margem mínima. A alteração foi registrada no histórico.`,
          color: 'orange',
        })
      }
      await carregar(itemId)
      onAlterado?.()
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErro(err), color: 'red' })
      await carregar(itemId)
    } finally {
      setGravando(null)
    }
  }

  const abrirLog = async () => {
    setLogAberto(true)
    setLog(null)
    try {
      const { data } = await api.get<LogValor[]>(`/orcamento-grafico/${orcamentoId}/log-valores`)
      setLog(Array.isArray(data) ? data : [])
    } catch {
      setLog([])
    }
  }

  const opcoes = itens.map((i) => ({ value: i.id, label: `Item ${i.sequencia} — ${i.descricao ?? 'Sem descrição'}` }))
  const sequenciaDoItem = (id: string) => itens.find((i) => i.id === id)?.sequencia

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end">
        <Group gap="xs">
          <Text fw={600} size="sm">Tiragens do item</Text>
          <Button size="compact-xs" variant="subtle" leftSection={<IconHistory size={14} />} onClick={() => void abrirLog()}>
            Histórico de valores
          </Button>
        </Group>
        <Select size="xs" w={360} data={opcoes} value={itemId} onChange={setItemId} allowDeselect={false} aria-label="Item" />
      </Group>

      {podeEditar && !podeAlterarValor && (
        <Text size="xs" c="dimmed">Para digitar o valor unitário é preciso a permissão "Alterar valor unitário" (Orçamento → Permissões).</Text>
      )}

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
              <Table.Th>Situação</Table.Th>
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
                      onBlur={(e) => void gravar(l, { tipo: 'margem', margem: numeroDigitado(e.currentTarget.value) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  ) : (
                    <Text size="sm">{formatarPercentual2(l.margemPerc)}</Text>
                  )}
                </Table.Td>
                <Table.Td ta="right"><Text size="sm">{formatarPercentual2(l.cmPerc)}</Text></Table.Td>
                <Table.Td ta="right">
                  {editaValor ? (
                    <NumberInput
                      key={`u-${l.quantidade}-${l.valorUnitario}`}
                      size="xs" w={130} ml="auto" decimalScale={4} decimalSeparator="," thousandSeparator="."
                      prefix="R$ " min={0}
                      defaultValue={l.valorUnitario != null ? Math.round(l.valorUnitario * 10000) / 10000 : undefined}
                      disabled={gravando === l.quantidade}
                      aria-label={`Valor unitário da tiragem ${l.quantidade}`}
                      onBlur={(e) => void gravar(l, { tipo: 'unitario', valor: numeroDigitado(e.currentTarget.value) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  ) : (
                    <Text size="sm">{formatarValorUnitario(l.valorUnitario)}</Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">
                  {editaValor ? (
                    <NumberInput
                      key={`v-${l.quantidade}-${l.valorTotal}`}
                      size="xs" w={140} ml="auto" decimalScale={2} fixedDecimalScale decimalSeparator="," thousandSeparator="."
                      prefix="R$ " min={0}
                      defaultValue={l.valorTotal ?? undefined}
                      disabled={gravando === l.quantidade}
                      aria-label={`Valor total da tiragem ${l.quantidade}`}
                      onBlur={(e) => void gravar(l, { tipo: 'valor', valor: numeroDigitado(e.currentTarget.value) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  ) : (
                    <Text size="sm" fw={600}>{formatarMoeda(l.valorTotal)}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {l.situacaoMargem !== 'SEM_REFERENCIA' && (
                    <Tooltip label={`Margem entre custo e preço: ${formatarPercentual2(l.margemSobrePreco)}`}>
                      <Badge
                        size="sm"
                        variant="light"
                        color={l.situacaoMargem === 'DENTRO' ? 'green' : 'red'}
                        data-testid={`situacao-margem-${l.quantidade}`}
                      >
                        {rotuloSituacaoMargem(l)}
                      </Badge>
                    </Tooltip>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    {l.digitado && <Badge size="xs" color="orange" variant="light">digitado</Badge>}
                    {l.digitado && editaValor && (
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

      <Modal opened={logAberto} onClose={() => setLogAberto(false)} title={<Text fw={700}>Histórico de alterações de valor</Text>} size="xl" centered>
        {log === null ? (
          <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Carregando…</Text></Group>
        ) : log.length === 0 ? (
          <Text size="sm" c="dimmed">Nenhuma alteração manual de valor neste orçamento.</Text>
        ) : (
          <Table.ScrollContainer minWidth={720} mah={420}>
            <Table striped withTableBorder stickyHeader verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Usuário</Table.Th>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">Tiragem</Table.Th>
                  <Table.Th ta="right">Valor anterior</Table.Th>
                  <Table.Th ta="right">Valor novo</Table.Th>
                  <Table.Th ta="right">Margem</Table.Th>
                  <Table.Th>Situação</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {log.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td><Text size="xs">{new Date(r.criadoEm).toLocaleString('pt-BR')}</Text></Table.Td>
                    <Table.Td><Text size="xs">{r.usuarioNome ?? '—'}</Text></Table.Td>
                    <Table.Td><Text size="xs">{sequenciaDoItem(r.itemId) ?? '—'}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="xs">{formatarInteiro(r.quantidade)}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="xs">{formatarMoeda(r.valorAnterior)}</Text></Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs">{formatarMoeda(r.valorNovo)}{r.acao === 'LIMPAR' ? ' (voltou ao cálculo)' : ''}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs">{formatarPercentual2(r.margemAnterior)} → {formatarPercentual2(r.margemNova)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color={r.abaixoMargem ? 'red' : 'green'}>
                        {r.abaixoMargem ? 'Abaixo da margem' : 'Dentro da margem'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Modal>
    </Stack>
  )
}
