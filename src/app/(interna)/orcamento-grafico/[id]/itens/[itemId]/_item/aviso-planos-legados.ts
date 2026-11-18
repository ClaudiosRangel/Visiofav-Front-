/**
 * aviso-planos-legados — texto PURO do aviso de planos legados do Item de plano único (R-LEG).
 *
 * Um item de plano único pode ter `PlanoCalculoGrafico` gravados antes da reforma. Eles continuam
 * guardados (e continuam valendo no cálculo), mas a tela não os usa nem edita; o aviso só informa.
 */

export type EstruturaItem = 'PLANO_UNICO' | 'MULTI_PLANO'

/** `null` quando não há o que avisar (multi-plano, ou plano único sem planos persistidos). */
export function textoAvisoPlanosLegados(
  estrutura: EstruturaItem,
  planosPersistidos: number | null | undefined,
): string | null {
  if (estrutura !== 'PLANO_UNICO') return null
  const n = Number(planosPersistidos)
  if (!Number.isFinite(n) || n < 1) return null
  return `${Math.trunc(n)} plano(s) legado(s) mantido(s) sem uso na tela`
}
