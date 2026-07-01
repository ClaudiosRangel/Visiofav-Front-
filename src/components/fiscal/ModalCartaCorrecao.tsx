'use client'

import { useState } from 'react'
import { Modal, Textarea, Button, Group, Stack } from '@mantine/core'

interface ModalCartaCorrecaoProps {
  opened: boolean
  onClose: () => void
  onConfirm: (textoCorrecao: string) => void
  loading?: boolean
}

export function ModalCartaCorrecao({ opened, onClose, onConfirm, loading }: ModalCartaCorrecaoProps) {
  const [textoCorrecao, setTextoCorrecao] = useState('')

  function handleClose() {
    setTextoCorrecao('')
    onClose()
  }

  function handleConfirm() {
    onConfirm(textoCorrecao)
    setTextoCorrecao('')
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Carta de Correção (CC-e)" centered>
      <Stack>
        <Textarea
          label="Texto de Correção"
          placeholder="Descreva a correção a ser realizada (mínimo 15 caracteres)"
          minRows={3}
          value={textoCorrecao}
          onChange={(e) => setTextoCorrecao(e.currentTarget.value)}
          disabled={loading}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            color="teal"
            onClick={handleConfirm}
            loading={loading}
            disabled={textoCorrecao.length < 15 || loading}
          >
            Enviar Carta de Correção
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
