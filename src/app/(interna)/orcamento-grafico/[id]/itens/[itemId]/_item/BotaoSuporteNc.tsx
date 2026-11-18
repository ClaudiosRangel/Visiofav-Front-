'use client'

/**
 * BotaoSuporteNc — botão "NC" (Suporte não cadastrado) ao lado de um campo de Suporte. Abre o
 * SuporteNcModal; ao criar, repassa o suporte novo em `onCriado` para o campo de origem selecioná-lo.
 */

import { useState } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'

import SuporteNcModal, { type SuporteNcCriadoInfo } from './SuporteNcModal'

export const ROTULO_SUPORTE_NC = 'Suporte não cadastrado'

export interface BotaoSuporteNcProps {
  onCriado: (r: SuporteNcCriadoInfo) => void
  disabled?: boolean
}

export default function BotaoSuporteNc({ onCriado, disabled }: BotaoSuporteNcProps) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Tooltip label={ROTULO_SUPORTE_NC}>
        <ActionIcon
          variant="default"
          size={36}
          aria-label={ROTULO_SUPORTE_NC}
          disabled={disabled}
          onClick={() => setAberto(true)}
          style={{ fontSize: 12, fontWeight: 600, width: 'auto', minWidth: 36, paddingInline: 8 }}
        >
          NC
        </ActionIcon>
      </Tooltip>
      <SuporteNcModal opened={aberto} onClose={() => setAberto(false)} onCriado={onCriado} />
    </>
  )
}
