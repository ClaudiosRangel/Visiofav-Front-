/**
 * Conversão Shelf-Life Mínimo (dias) × RLM Recebimento (%) — Ocorrência 8 do
 * "3 - Relatório de Ocorrências e Ajustes".
 *
 * São duas formas de expressar a MESMA trava de recebimento (padrão SAP:
 * "Minimum Remaining Shelf Life" pode ser informado em dias, e o percentual é
 * derivado de `dias ÷ shelf life total`). Regra pedida pelo QA:
 * - Preencher dias → inibe o campo de %.
 * - Preencher % → calcula os dias automaticamente (exige shelf life total).
 */

/**
 * Converte RLM (%) em dias mínimos de validade no recebimento.
 * `dias = round(shelfLifeTotalDias × rlmPercent ÷ 100)`.
 * Retorna null se faltar o shelf life total ou o percentual for inválido.
 */
export function rlmPercentParaDias(
  rlmPercent: number | null | undefined,
  shelfLifeTotalDias: number | null | undefined,
): number | null {
  if (rlmPercent == null || shelfLifeTotalDias == null) return null
  if (!(rlmPercent >= 0) || !(shelfLifeTotalDias > 0)) return null
  return Math.round((shelfLifeTotalDias * rlmPercent) / 100)
}

/**
 * Converte dias mínimos de validade no recebimento em RLM (%).
 * `% = round(dias ÷ shelfLifeTotalDias × 100)`.
 * Retorna null se faltar o shelf life total ou os dias forem inválidos.
 */
export function diasParaRlmPercent(
  dias: number | null | undefined,
  shelfLifeTotalDias: number | null | undefined,
): number | null {
  if (dias == null || shelfLifeTotalDias == null) return null
  if (!(dias >= 0) || !(shelfLifeTotalDias > 0)) return null
  return Math.round((dias / shelfLifeTotalDias) * 100)
}

/**
 * Decide o estado de inibição dos campos no formulário, dado o que já está
 * preenchido. Regra: quem está preenchido "comanda" e inibe o outro; se ambos
 * vazios, os dois ficam livres.
 */
export function estadoCamposShelfLife(
  shelfLifeMinimoDias: number | null | undefined,
  rlmPercent: number | null | undefined,
): { diasDesabilitado: boolean; rlmDesabilitado: boolean } {
  const temDias = shelfLifeMinimoDias != null
  const temRlm = rlmPercent != null
  return {
    // Dias é inibido quando o RLM% está no comando (e dias ainda não preenchido).
    diasDesabilitado: temRlm && !temDias,
    // RLM% é inibido quando os dias estão preenchidos (pedido literal do QA).
    rlmDesabilitado: temDias && !temRlm,
  }
}
