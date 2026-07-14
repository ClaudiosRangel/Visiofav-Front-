'use client'

import { useState } from 'react'
import { Modal, Select, Textarea, Button, Alert, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { MOTIVOS_DIVERGENCIA, type MotivoDivergencia } from '@/hooks/useHoldConferencia'

interface ModalMotivoHoldProps {
  opened: boolean
  onClose: () => void
  onConfirm: (dados: { motivo: MotivoDivergencia; motivoDetalhe?: string }) => Promise<void>
}

/**
 * Modal de seleção de motivo padronizado (reason code) ao colocar um item
 * com divergência confirmada em espera (Hold). Exige um texto complementar
 * quando o motivo selecionado é "OUTRO".
 */
export default function ModalMotivoHold({ opened, onClose, onConfirm }: ModalMotivoHoldProps) {
  const [motivo, setMotivo] = useState<MotivoDivergencia | null>(null)
  const [detalhe, setDetalhe] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!motivo) {
      setErro('Selecione um motivo')
      return
    }
    if (motivo === 'OUTRO' && !detalhe.trim()) {
      setErro('Detalhe o motivo "Outro"')
      return
    }

    setLoading(true)
    try {
      await onConfirm({ motivo, motivoDetalhe: detalhe.trim() || undefined })
      handleClose()
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao colocar item em espera')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setMotivo(null)
    setDetalhe('')
    setErro(null)
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Colocar item em espera (Hold)" centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          {erro && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {erro}
            </Alert>
          )}

          <Select
            label="Motivo"
            placeholder="Selecione o motivo"
            data={MOTIVOS_DIVERGENCIA.map((m) => ({ value: m.value, label: m.label }))}
            value={motivo}
            onChange={(v) => setMotivo(v as MotivoDivergencia)}
            required
            disabled={loading}
          />

          {motivo === 'OUTRO' && (
            <Textarea
              label="Detalhe"
              placeholder="Descreva o motivo"
              value={detalhe}
              onChange={(e) => setDetalhe(e.currentTarget.value)}
              required
              disabled={loading}
            />
          )}

          <Button type="submit" loading={loading} fullWidth color="orange">
            Colocar em espera
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
