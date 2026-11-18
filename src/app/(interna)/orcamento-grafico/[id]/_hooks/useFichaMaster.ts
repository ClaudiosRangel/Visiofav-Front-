'use client'

/**
 * useFichaMaster — leitura da Ficha Master do orçamento (`GET /:id/ficha-master`, rota existente).
 *
 * Só consulta quando `aberto` é verdadeiro (o Drawer de preview está aberto); ao fechar, o estado
 * é limpo e a próxima abertura lê de novo. AbortController e contador descartam respostas antigas.
 * Somente leitura: não grava, não recalcula e não chama o motor.
 */

import { getAuthToken } from '@/lib/authStorage'

import type { FichaMasterDTO } from './hierarquia.types'
import { useLeitura } from './useLeitura'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

export interface UseFichaMasterResultado {
  dados: FichaMasterDTO | null
  carregando: boolean
  erro: string | null
  naoEncontrado: boolean
  recarregar: () => void
}

export function useFichaMaster(orcamentoId: string | null | undefined, aberto: boolean): UseFichaMasterResultado {
  const url = aberto && orcamentoId ? `/orcamento-grafico/${orcamentoId}/ficha-master` : null
  return useLeitura<FichaMasterDTO>(url, {
    mensagemErro: 'Não foi possível carregar a ficha master.',
    limparAoRecarregar: true,
  })
}

/** Origem da imagem da arte: dataURL da ficha ou anexo servido pela API (token da aba via authStorage). */
export function origemDaArte(ficha: Pick<FichaMasterDTO, 'arte' | 'arteUrl'> | null | undefined): string | null {
  if (!ficha) return null
  if (ficha.arte) return ficha.arte
  if (ficha.arteUrl) return `${API_BASE}${ficha.arteUrl}?token=${getAuthToken() || ''}`
  return null
}
