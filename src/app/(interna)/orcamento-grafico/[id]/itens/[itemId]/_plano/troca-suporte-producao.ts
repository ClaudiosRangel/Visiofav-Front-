/**
 * Troca do suporte de PRODUÇÃO (plano e item) e histórico de trocas.
 *
 * Chamadas movidas do modal antigo `PlanosDoItem` (removido na tarefa 7.17), com as mesmas
 * rotas, o mesmo corpo e a mesma leitura da resposta:
 *   PATCH /orcamento-grafico/:id/itens/:itemId/planos/:planoId/suporte-producao
 *   PATCH /orcamento-grafico/:id/itens/:itemId/suporte-producao
 *   GET   /orcamento-grafico/:id/itens/:itemId/historico-troca-suporte
 * O orçado é preservado pelo back; aqui só se envia o suporte de produção.
 */

import { api } from '@/lib/api'

/** Registro do histórico de trocas de suporte (GET .../historico-troca-suporte). */
export interface TrocaSuporte {
  id: string
  itemId: string
  planoId?: string | null
  suporteAnteriorId?: string | null
  suporteNovoId?: string | null
  suporteAnteriorNome?: string | null
  suporteNovoNome?: string | null
  usuarioId?: string | null
  trocadoEm: string
}

/** Resultado de uma troca: suporte de produção gravado e rótulo "X → Y" (null = igual ao orçado). */
export interface ResultadoTrocaSuporte {
  suporteProducaoId: string
  rotuloTrocaSuporte: string | null
}

function lerResultado(data: unknown, enviado: string): ResultadoTrocaSuporte {
  const d = data as { suporteNovoId?: string | null; rotuloTrocaSuporte?: string | null } | null | undefined
  return {
    suporteProducaoId: d?.suporteNovoId ?? enviado,
    rotuloTrocaSuporte: d?.rotuloTrocaSuporte ?? null,
  }
}

/** Troca o suporte de produção de um plano. */
export async function trocarSuporteProducaoPlano(
  orcamentoId: string,
  itemId: string,
  planoId: string,
  suporteProducaoId: string,
): Promise<ResultadoTrocaSuporte> {
  const { data } = await api.patch(
    `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${planoId}/suporte-producao`,
    { suporteProducaoId },
  )
  return lerResultado(data, suporteProducaoId)
}

/** Troca o suporte de produção no nível do item (item sem planos). */
export async function trocarSuporteProducaoItem(
  orcamentoId: string,
  itemId: string,
  suporteProducaoId: string,
): Promise<ResultadoTrocaSuporte> {
  const { data } = await api.patch(
    `/orcamento-grafico/${orcamentoId}/itens/${itemId}/suporte-producao`,
    { suporteProducaoId },
  )
  return lerResultado(data, suporteProducaoId)
}

/** Histórico de trocas do item e dos planos do item (mais recente primeiro, ordem do back). */
export async function buscarHistoricoTrocaSuporte(orcamentoId: string, itemId: string): Promise<TrocaSuporte[]> {
  const { data } = await api.get(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/historico-troca-suporte`)
  return Array.isArray(data) ? data : data?.data || []
}

/** Mensagem de sucesso usada pelo modal antigo. */
export function mensagemTrocaSuporte(r: ResultadoTrocaSuporte): string {
  return r.rotuloTrocaSuporte ? `Troca registrada: ${r.rotuloTrocaSuporte}` : 'Suporte de produção igual ao orçado.'
}
