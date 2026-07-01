'use client'

import { useState } from 'react'
import { Modal, Textarea, Button, Group, Stack } from '@mantine/core'

interface ModalCancelamentoProps {
  opened: boolean
  onClose: () => void
  onConfirm: (justificativa: string) => void
  loading?: boolean
}

export function ModalCancelamento({ opened, onClose, onConfirm, loading }: ModalCancelamentoProps) {
  const [justificativa, setJustificativa] = useState('')

  function handleClose() {
    setJustificativa('')
    onClose()
  }

  function handleConfirm() {
    onConfirm(justificativa)
    setJustificativa('')
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Cancelar Documento" centered>
      <Stack>
        <Textarea
          label="Justificativa"
          placeholder="Informe o motivo do cancelamento (mínimo 15 caracteres)"
          minRows={3}
          value={justificativa}
          onChange={(e) => setJustificativa(e.currentTarget.value)}
          disabled={loading}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            color="red"
            onClick={handleConfirm}
            loading={loading}
            disabled={justificativa.length < 15 || loading}
          >
            Confirmar Cancelamento
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
