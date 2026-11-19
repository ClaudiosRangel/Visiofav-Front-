'use client'

import { Button, Group, Modal, ScrollArea, Text } from '@mantine/core'

// Modal "Observações da Empresa" (Req 2.6, 2.8, 2.9, 2.10).
// Bloqueia a tela enquanto aberto: sem botão de fechar, sem fechar por clique fora nem por Esc.
// Só o botão "OK" fecha. O texto é exibido por completo, com rolagem quando exceder a área visível.

interface Props {
  opened: boolean
  observacao: string
  onClose: () => void
}

/** Verdadeiro quando o texto tem pelo menos 1 caractere não branco (Req 2.6, 2.7). */
export function temObservacaoVisivel(observacao: string | null | undefined): boolean {
  return typeof observacao === 'string' && /\S/.test(observacao)
}

export default function ObservacoesEmpresaModal({ opened, observacao, onClose }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Observações da Empresa"
      centered
      size="lg"
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      trapFocus
    >
      <ScrollArea.Autosize mah="60vh" type="auto" offsetScrollbars>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {observacao}
        </Text>
      </ScrollArea.Autosize>
      <Group justify="flex-end" mt="md">
        <Button onClick={onClose} data-autofocus>
          OK
        </Button>
      </Group>
    </Modal>
  )
}
