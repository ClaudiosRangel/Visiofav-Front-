'use client'

/**
 * AvisoAVerificar — selo discreto de parâmetro a verificar na escolha de material
 * (Fase 2, tarefa 4.5). Não bloqueia nada e não altera o preço.
 */

import { Badge, Tooltip } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'

interface Props {
  /** `situacaoParametro` devolvida pela seleção (A_VERIFICAR aciona o selo). */
  situacao?: string | null
  /** Item puxado: mostra o selo "informativo" no lugar do aviso. */
  informativo?: boolean
}

export default function AvisoAVerificar({ situacao, informativo }: Props) {
  if (informativo) {
    return (
      <Badge size="xs" variant="light" color="gray">
        Informativo, não altera o preço
      </Badge>
    )
  }
  if (situacao !== 'A_VERIFICAR') return null
  return (
    <Tooltip label="Parâmetro a verificar; não altera o preço" withinPortal>
      <Badge
        size="xs"
        variant="light"
        color="yellow"
        leftSection={<IconInfoCircle size={11} />}
        style={{ cursor: 'help' }}
      >
        A verificar
      </Badge>
    </Tooltip>
  )
}
