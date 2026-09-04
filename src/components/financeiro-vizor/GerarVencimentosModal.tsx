'use client'

import { useEffect, useState } from 'react'
import { Button, Group, Modal, NumberInput, Stack, Text } from '@mantine/core'

import { validarMeses } from '@/lib/financeiro-vizor/validacao'
import { MESES_MAX, MESES_MIN } from '@/lib/financeiro-vizor/types'

interface GerarVencimentosModalProps {
  /** Controla a visibilidade do modal. */
  opened: boolean
  /** Fecha o modal (cancelar/backdrop/ESC). */
  onClose: () => void
  /** Dispara a geração com o número de meses validado. */
  onConfirmar: (meses: number) => void
  /** Desabilita o campo e mostra loading no botão enquanto a geração roda. */
  isPending?: boolean
}

/**
 * Modal de geração de vencimentos em lote (Req 4.10–4.12).
 *
 * Coleta o número de meses num `NumberInput` e valida com `validarMeses`
 * (inteiro entre 1 e 60). Enquanto o valor for inválido, o botão de confirmar
 * fica desabilitado e a mensagem de erro é exibida no próprio campo, bloqueando
 * o envio (Req 4.12). Ao confirmar com valor válido, chama `onConfirmar(meses)`;
 * a notificação com o resultado é responsabilidade da mutation que dispara a
 * ação (Req 4.11).
 *
 * O estado é reinicializado toda vez que o modal abre, para não carregar um
 * valor/erro de uma abertura anterior.
 */
export function GerarVencimentosModal({
  opened,
  onClose,
  onConfirmar,
  isPending = false,
}: GerarVencimentosModalProps) {
  const [meses, setMeses] = useState<number | ''>(MESES_MIN)

  // Reinicia o campo a cada abertura.
  useEffect(() => {
    if (opened) setMeses(MESES_MIN)
  }, [opened])

  const valor = typeof meses === 'number' ? meses : NaN
  const erro = validarMeses(valor)

  function handleConfirmar() {
    if (erro) return
    onConfirmar(valor)
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Gerar vencimentos" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Informe quantos meses de faturas deseja gerar em lote. Competências que
          já possuem fatura são ignoradas.
        </Text>
        <NumberInput
          label="Número de meses"
          description={`Um inteiro entre ${MESES_MIN} e ${MESES_MAX}.`}
          placeholder="Ex.: 12"
          min={MESES_MIN}
          max={MESES_MAX}
          allowDecimal={false}
          allowNegative={false}
          value={meses}
          onChange={(v) => setMeses(typeof v === 'number' ? v : '')}
          error={meses !== '' ? erro : null}
          disabled={isPending}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            color="green"
            onClick={handleConfirmar}
            disabled={!!erro}
            loading={isPending}
          >
            Gerar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
