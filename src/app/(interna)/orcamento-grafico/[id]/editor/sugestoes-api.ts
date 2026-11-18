/**
 * sugestoes-api — consulta reutilizável dos papéis com preço (Fase 3, Req 4).
 *
 * Usada pelo editor do item (`useSugestoesProduto`); era usada também pelo modal de plano antigo (removido).
 * Filtra por suporte e gramatura no servidor (quando a gramatura é conhecida) e pagina
 * até o fim (100 por página), para nunca truncar o resultado quando o suporte tem mais
 * de 100 papéis.
 */

import { api } from '@/lib/api'
import type { PapelComPreco } from './sugestoes'

export const LIMITE_POR_PAGINA = 100
/** Trava de segurança contra loop infinito (50 mil papéis). */
const MAX_PAGINAS = 500

export interface ParamsBuscaPapeis {
  suporteId: string
  /** Gramatura em g/m². Quando maior que 0, o filtro é aplicado no servidor. */
  gramatura?: number | null
}

/** Parâmetros da consulta de uma página de `GET /orcamento-grafico/precos-mp`. */
export function montarParamsPapeis(
  { suporteId, gramatura }: ParamsBuscaPapeis,
  page: number,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    tipo: 'PAPEL',
    suporteId,
    comPreco: 'true',
    limit: LIMITE_POR_PAGINA,
    page,
  }
  if (typeof gramatura === 'number' && Number.isFinite(gramatura) && gramatura > 0) {
    params.gramatura = gramatura
  }
  return params
}

/** Busca todos os papéis com preço do suporte (e gramatura, se informada), página a página. */
export async function buscarPapeisComPreco(params: ParamsBuscaPapeis): Promise<PapelComPreco[]> {
  const todos: PapelComPreco[] = []
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const { data } = await api.get('/orcamento-grafico/precos-mp', {
      params: montarParamsPapeis(params, page),
    })
    const lote: PapelComPreco[] = Array.isArray(data) ? data : data?.data ?? []
    todos.push(...lote)
    // Resposta em array puro não tem paginação conhecida: para quando a página vier incompleta.
    const totalPages = Array.isArray(data) ? null : Number(data?.totalPages)
    if (totalPages !== null && Number.isFinite(totalPages)) {
      if (page >= totalPages) break
    } else if (lote.length < LIMITE_POR_PAGINA) {
      break
    }
    if (lote.length === 0) break
  }
  return todos
}
