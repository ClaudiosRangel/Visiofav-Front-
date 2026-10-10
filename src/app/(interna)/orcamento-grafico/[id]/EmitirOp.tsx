'use client'

/**
 * EmitirOp — emissão de Ordem de Produção (OP) a partir de itens de um
 * orçamento gráfico (Task 24 da spec orcamento-grafico-op-relatorio-paridade).
 *
 * Entrega três coisas, todas reutilizando o mesmo modal de opções:
 *   1. `OpModalOpcoes` — modal de checkboxes (não gerar pedido, OP reserva,
 *      imprimir traçado, série automática, gerar em arquivo) + TagsInput de
 *      e-mails. Serve tanto para emissão por item quanto em lote.
 *   2. `BadgeOp` — badge verde "OP: {numero}" quando o item já tem OP vinculada.
 *      O status é carregado via GET /:id/itens/:itemId/op.
 *   3. Hooks de emissão (`useEmissaoOp`) que fazem os POSTs e tratam avisos[]
 *      / resultados[] com notificações.
 *
 * Rotas (prefixo /orcamento-grafico, via @/lib/api):
 *   POST /:id/itens/:itemId/emitir-op  → { op:{id,numero,via,revisao}, avisos:[] }
 *   POST /emitir-op-lote               → { resultados:[{itemId,status,numero?,via?,revisao?,motivo?}] }
 *   GET  /:id/itens/:itemId/op         → { op:{...}|null, label:string|null }
 */

import { useCallback, useState } from 'react'
import {
  Stack, Group, Button, Text, Modal, Checkbox, TagsInput, Badge, Tooltip,
  Divider,
} from '@mantine/core'
import { IconFileInvoice } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos
// ============================================================================

export interface OpcoesEmissaoOp {
  naoGerarPedido: boolean
  opReserva: boolean
  imprimirTracado: boolean
  serieAutomatica: boolean
  gerarEmArquivo: boolean
}

export interface OpVinculada {
  id: string
  numero: number | string
  status?: string | null
  via?: number | string | null
  revisao?: number | string | null
  opReserva?: boolean | null
}

export interface StatusOpItem {
  op: OpVinculada | null
  label: string | null
}

interface ResultadoLoteItem {
  itemId: string
  status: 'ok' | 'erro'
  numero?: number | string
  via?: number | string
  revisao?: number | string
  motivo?: string
}

const OPCOES_PADRAO: OpcoesEmissaoOp = {
  naoGerarPedido: false,
  opReserva: false,
  imprimirTracado: false,
  serieAutomatica: false,
  gerarEmArquivo: false,
}

// ============================================================================
// Badge "OP: {numero}"
// ============================================================================

export function BadgeOp({ label }: { label: string | null | undefined }) {
  if (!label) return null
  return (
    <Badge color="green" variant="filled" size="sm">
      {label}
    </Badge>
  )
}

// ============================================================================
// Modal de opções de emissão (reutilizado por item e lote)
// ============================================================================

export function OpModalOpcoes({
  opened,
  onClose,
  titulo,
  descricao,
  loading,
  onConfirmar,
}: {
  opened: boolean
  onClose: () => void
  titulo: string
  descricao?: string
  loading: boolean
  onConfirmar: (opcoes: OpcoesEmissaoOp, emails: string[]) => void
}) {
  const [opcoes, setOpcoes] = useState<OpcoesEmissaoOp>(OPCOES_PADRAO)
  const [emails, setEmails] = useState<string[]>([])

  const setOpcao = (chave: keyof OpcoesEmissaoOp, valor: boolean) =>
    setOpcoes((prev) => ({ ...prev, [chave]: valor }))

  // Reseta o formulário ao fechar para não vazar estado entre aberturas.
  const fechar = () => {
    setOpcoes(OPCOES_PADRAO)
    setEmails([])
    onClose()
  }

  return (
    <Modal opened={opened} onClose={fechar} title={titulo} centered>
      <Stack gap="md">
        {descricao && <Text size="sm" c="dimmed">{descricao}</Text>}

        <Stack gap="xs">
          <Checkbox
            label="Não gerar pedido"
            checked={opcoes.naoGerarPedido}
            onChange={(e) => setOpcao('naoGerarPedido', e.currentTarget.checked)}
          />
          <Checkbox
            label="OP reserva"
            checked={opcoes.opReserva}
            onChange={(e) => setOpcao('opReserva', e.currentTarget.checked)}
          />
          <Checkbox
            label="Imprimir traçado"
            checked={opcoes.imprimirTracado}
            onChange={(e) => setOpcao('imprimirTracado', e.currentTarget.checked)}
          />
          <Checkbox
            label="Série automática"
            checked={opcoes.serieAutomatica}
            onChange={(e) => setOpcao('serieAutomatica', e.currentTarget.checked)}
          />
          <Checkbox
            label="Gerar em arquivo"
            checked={opcoes.gerarEmArquivo}
            onChange={(e) => setOpcao('gerarEmArquivo', e.currentTarget.checked)}
          />
        </Stack>

        <Divider />

        <TagsInput
          label="E-mails (opcional)"
          description="Enviar a OP para estes endereços. Digite e tecle Enter."
          placeholder="email@exemplo.com"
          value={emails}
          onChange={setEmails}
          splitChars={[',', ' ', ';']}
          clearable
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={fechar} disabled={loading}>
            Cancelar
          </Button>
          <Button
            color="green"
            leftSection={<IconFileInvoice size={16} />}
            loading={loading}
            onClick={() => onConfirmar(opcoes, emails)}
          >
            Emitir OP
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ============================================================================
// Hook de emissão (item único + lote)
// ============================================================================

export function useEmissaoOp(orcamentoId: string) {
  const [emitindo, setEmitindo] = useState(false)

  /** Emite a OP de UM item. Retorna true em sucesso. */
  const emitirItem = useCallback(
    async (itemId: string, opcoes: OpcoesEmissaoOp, emails: string[]): Promise<boolean> => {
      setEmitindo(true)
      try {
        const { data } = await api.post(
          `/orcamento-grafico/${orcamentoId}/itens/${itemId}/emitir-op`,
          { ...opcoes, emails: emails.length ? emails : undefined },
        )
        const numero = data?.op?.numero
        notifications.show({
          title: 'OP emitida',
          message: numero != null ? `Ordem de Produção ${numero} gerada com sucesso.` : 'Ordem de Produção gerada.',
          color: 'green',
        })
        const avisos: string[] = Array.isArray(data?.avisos) ? data.avisos : []
        if (avisos.length) {
          notifications.show({
            title: 'Avisos da emissão',
            message: avisos.join('\n'),
            color: 'yellow',
            autoClose: 8000,
          })
        }
        return true
      } catch (err: any) {
        notifications.show({
          title: 'Erro ao emitir OP',
          message: err?.response?.data?.message || 'Falha ao emitir a Ordem de Produção.',
          color: 'red',
        })
        return false
      } finally {
        setEmitindo(false)
      }
    },
    [orcamentoId],
  )

  /** Emite OPs em lote. Retorna os resultados por item (ou null em falha geral). */
  const emitirLote = useCallback(
    async (
      itemIds: string[],
      opcoes: OpcoesEmissaoOp,
      emails: string[],
    ): Promise<ResultadoLoteItem[] | null> => {
      setEmitindo(true)
      try {
        const { data } = await api.post(`/orcamento-grafico/emitir-op-lote`, {
          itemIds,
          opcoes,
          emails: emails.length ? emails : undefined,
        })
        const resultados: ResultadoLoteItem[] = Array.isArray(data?.resultados) ? data.resultados : []
        const ok = resultados.filter((r) => r.status === 'ok')
        const erros = resultados.filter((r) => r.status === 'erro')

        notifications.show({
          title: 'Emissão em lote concluída',
          message: `${ok.length} ${ok.length === 1 ? 'emitida' : 'emitidas'}, ${erros.length} com erro.`,
          color: erros.length ? (ok.length ? 'yellow' : 'red') : 'green',
        })

        if (erros.length) {
          const detalhe = erros
            .map((r) => `• Item ${r.itemId}: ${r.motivo || 'erro desconhecido'}`)
            .join('\n')
          notifications.show({
            title: 'Itens com erro',
            message: detalhe,
            color: 'red',
            autoClose: 10000,
          })
        }
        return resultados
      } catch (err: any) {
        notifications.show({
          title: 'Erro na emissão em lote',
          message: err?.response?.data?.message || 'Falha ao emitir as Ordens de Produção.',
          color: 'red',
        })
        return null
      } finally {
        setEmitindo(false)
      }
    },
    [orcamentoId],
  )

  return { emitindo, emitirItem, emitirLote }
}

// ============================================================================
// Carregamento do status de OP de um item
// ============================================================================

export async function carregarStatusOpItem(
  orcamentoId: string,
  itemId: string,
): Promise<StatusOpItem> {
  try {
    const { data } = await api.get(
      `/orcamento-grafico/${orcamentoId}/itens/${itemId}/op`,
    )
    return {
      op: data?.op ?? null,
      label: data?.label ?? null,
    }
  } catch {
    // Falha silenciosa: a ausência de badge é o estado seguro.
    return { op: null, label: null }
  }
}
