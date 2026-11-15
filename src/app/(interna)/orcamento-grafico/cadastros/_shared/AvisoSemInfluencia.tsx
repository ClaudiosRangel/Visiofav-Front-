'use client'

import { Alert } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'

interface AvisoSemInfluenciaProps {
  /** Texto alternativo; por padrão usa a mensagem-padrão dos cadastros informativos. */
  children?: React.ReactNode
}

/** Aviso discreto para cadastros que ainda não afetam o cálculo do orçamento nem o PCP. */
export function AvisoSemInfluencia({ children }: AvisoSemInfluenciaProps) {
  return (
    <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />} py="xs">
      {children ?? 'Este cadastro ainda não influencia o cálculo do orçamento nem o PCP.'}
    </Alert>
  )
}

export default AvisoSemInfluencia
