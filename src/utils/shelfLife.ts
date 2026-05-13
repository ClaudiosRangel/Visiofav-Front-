/**
 * Calcula os dias restantes entre uma data de vencimento e a data de referência.
 * Retorna número inteiro de dias (Math.floor).
 */
export function calcularDiasRestantes(
  dataVencimento: string | Date,
  dataReferencia: Date = new Date()
): number {
  const vencimento = new Date(dataVencimento)
  const diffMs = vencimento.getTime() - dataReferencia.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Determina se deve exibir alerta de shelf life.
 * Retorna null se não deve alertar, ou objeto com dados do alerta.
 */
export function verificarShelfLife(
  dataVencimento: string | Date | null | undefined,
  shelfLifeMinimo: number | null | undefined,
  dataReferencia: Date = new Date()
): { diasRestantes: number; minimoExigido: number } | null {
  if (!dataVencimento || !shelfLifeMinimo || shelfLifeMinimo <= 0) return null

  const diasRestantes = calcularDiasRestantes(dataVencimento, dataReferencia)
  if (diasRestantes < shelfLifeMinimo) {
    return { diasRestantes, minimoExigido: shelfLifeMinimo }
  }
  return null
}
