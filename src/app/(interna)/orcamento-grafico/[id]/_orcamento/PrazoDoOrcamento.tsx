'use client'

/**
 * Prazo de pagamento no cabeçalho do orçamento (spec orcamento-prazos-cliente-margem, R1).
 * Em RASCUNHO grava em PUT /orcamento-grafico/:id/prazo. Com o orçamento calculado, a troca avisa que
 * os itens precisam ser recalculados (o prazo muda os juros e o preço).
 */

import { useState } from 'react'
import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

import SeletorPrazoPagamento from './SeletorPrazoPagamento'
import type { PrazoPagamento } from './prazo-cliente'

interface Props {
  orcamentoId: string
  prazoPagamentoId: string | null | undefined
  prazoPagamento: string | null | undefined
  clienteId: string | null | undefined
  /** Só em rascunho. */
  editavel: boolean
  /** O orçamento já tem preço: trocar exige recalcular. */
  calculado: boolean
  onAlterado: () => void
}

export default function PrazoDoOrcamento({
  orcamentoId,
  prazoPagamentoId,
  prazoPagamento,
  clienteId,
  editavel,
  calculado,
  onAlterado,
}: Props) {
  const [pendente, setPendente] = useState<{ id: string | null; prazo: PrazoPagamento | null } | null>(null)
  const [gravando, setGravando] = useState(false)

  const gravar = async (id: string | null) => {
    setGravando(true)
    try {
      const { data } = await api.put(`/orcamento-grafico/${orcamentoId}/prazo`, { prazoPagamentoId: id })
      notifications.show({
        title: 'Prazo alterado',
        message: data?.precisaRecalcular
          ? 'Recalcule os itens: o prazo muda os juros e o preço.'
          : 'Prazo de pagamento gravado.',
        color: data?.precisaRecalcular ? 'yellow' : 'green',
      })
      onAlterado()
    } catch (err: any) {
      notifications.show({ title: 'Prazo não alterado', message: err?.response?.data?.message || 'Falha ao gravar o prazo.', color: 'red' })
    } finally {
      setGravando(false)
      setPendente(null)
    }
  }

  const escolher = (id: string | null, prazo: PrazoPagamento | null) => {
    if ((id ?? null) === (prazoPagamentoId ?? null)) return
    if (calculado) setPendente({ id, prazo })
    else void gravar(id)
  }

  return (
    <>
      <SeletorPrazoPagamento
        value={prazoPagamentoId ?? null}
        textoAtual={prazoPagamento}
        onChange={escolher}
        clienteId={clienteId}
        disabled={!editavel || gravando}
      />
      <Modal opened={pendente !== null} onClose={() => setPendente(null)} title={<Text fw={700}>Trocar o prazo de pagamento</Text>} centered>
        <Stack gap="sm">
          <Text size="sm">
            O orçamento já está calculado. Com o prazo {pendente?.prazo ? <b>{pendente.prazo.descricao}</b> : 'novo'}, os juros e
            o preço mudam: será preciso recalcular os itens antes de validar ou enviar a proposta.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendente(null)}>
              Cancelar
            </Button>
            <Button loading={gravando} onClick={() => pendente && void gravar(pendente.id)}>
              Trocar e recalcular depois
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
