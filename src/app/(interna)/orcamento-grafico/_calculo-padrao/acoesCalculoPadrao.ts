/**
 * Regra de ações do Menu Cálculo Padrão (função pura).
 * Espelha `acoesPermitidas` do back (calculo-grafico/calculo-status.service.ts):
 * não cancelado → Incluir, Editar, Copiar, Cancelar; cancelado → Reativar, Copiar.
 */
export type AcaoCalculoPadrao = 'INCLUIR' | 'EDITAR' | 'COPIAR' | 'CANCELAR' | 'REATIVAR'

export function acoesPermitidas(calc: { cancelado?: boolean | null }): AcaoCalculoPadrao[] {
  return calc.cancelado ? ['REATIVAR', 'COPIAR'] : ['INCLUIR', 'EDITAR', 'COPIAR', 'CANCELAR']
}

/**
 * "Incluir" usa um cálculo de referência: habilitado só com um cálculo selecionado e não cancelado.
 * Sem seleção, a tela mostra a dica `DICA_INCLUIR_SEM_REFERENCIA`.
 */
export function podeIncluir(calc: { cancelado?: boolean | null } | null | undefined): boolean {
  return calc != null && acoesPermitidas(calc).includes('INCLUIR')
}

export const DICA_INCLUIR_SEM_REFERENCIA =
  'Selecione um cálculo na grade para usar como referência antes de incluir um novo.'

/** Mensagem de erro de uma ação, distinguindo cálculo não encontrado de falha de gravação. */
export function mensagemErroAcao(status: number | undefined, mensagemApi?: string): string {
  if (status === 404) return 'Cálculo não encontrado. Atualize a lista e tente novamente.'
  if (status === 409 && mensagemApi) return mensagemApi
  return 'Não foi possível gravar a alteração. Nenhum dado foi modificado.'
}
