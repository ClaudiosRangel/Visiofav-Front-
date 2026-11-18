'use client'

/**
 * AvisoPlanosLegados — aviso informativo "N plano(s) legado(s) mantido(s) sem uso na tela" para o
 * Item de plano único que ainda tem planos persistidos. Não apaga nem edita planos: não há nenhuma
 * ação, só o texto. Não aparece em multi-plano nem quando não há planos.
 */

import { Alert } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'

import { textoAvisoPlanosLegados, type EstruturaItem } from './aviso-planos-legados'

export interface AvisoPlanosLegadosProps {
  estrutura: EstruturaItem
  /** `DadosItemDTO.planosPersistidos`. */
  planosPersistidos: number | null | undefined
}

export default function AvisoPlanosLegados({ estrutura, planosPersistidos }: AvisoPlanosLegadosProps) {
  const texto = textoAvisoPlanosLegados(estrutura, planosPersistidos)
  if (!texto) return null
  return (
    <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />} data-testid="aviso-planos-legados">
      {texto}
    </Alert>
  )
}
