/**
 * restricoes-materiais-puro — lógica PURA de `useRestricoesMateriais` (sem React/rede).
 */

import type {
  CatalogoAtividadeDetalhe,
  CatalogoPlano,
  MaterialAtividade,
  RestricaoAtividade,
} from '../../cadastros/_shared/cadastros-graficos.types'

export interface RestricoesMateriais {
  restricoes: RestricaoAtividade[]
  materiais: MaterialAtividade[]
}

export type OrigemRestricoesMateriais = 'CATALOGO_PLANO' | 'ATIVIDADE'

/** Texto exibido na área quando o carregamento falha (Req 11.3). */
export const MENSAGEM_ERRO_RESTRICOES = 'Não foi possível carregar as restrições e os materiais desta atividade.'

/**
 * Restrições e materiais da atividade quando ela está no catálogo do plano;
 * `null` quando o catálogo não traz a atividade (aí a consulta avulsa é necessária).
 */
export function doCatalogoDoPlano(
  catalogo: Pick<CatalogoPlano, 'atividades'> | null | undefined,
  atividadeId: string | null | undefined,
): RestricoesMateriais | null {
  if (!catalogo || !atividadeId) return null
  const atividade = (catalogo.atividades ?? []).find((a) => a.id === atividadeId)
  if (!atividade) return null
  return {
    restricoes: Array.isArray(atividade.restricoes) ? [...atividade.restricoes] : [],
    materiais: Array.isArray(atividade.materiais) ? [...atividade.materiais] : [],
  }
}

/** Normaliza a resposta de `GET /catalogo/atividade/:id` (listas ausentes viram vazias). */
export function daRespostaDaAtividade(
  resposta: Pick<CatalogoAtividadeDetalhe, 'restricoes' | 'materiais'> | null | undefined,
): RestricoesMateriais {
  return {
    restricoes: Array.isArray(resposta?.restricoes) ? [...resposta.restricoes] : [],
    materiais: Array.isArray(resposta?.materiais) ? [...resposta.materiais] : [],
  }
}
