/**
 * Parseia data no formato DD/MM/AAAA (brasileiro) ou ISO (AAAA-MM-DD).
 */
function parseDateInput(value: string | Date): Date {
  if (value instanceof Date) return value
  // Formato DD/MM/AAAA
  const brMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (brMatch) {
    const [, dia, mes, ano] = brMatch
    return new Date(Number(ano), Number(mes) - 1, Number(dia))
  }
  // Formato ISO ou outro
  return new Date(value)
}

/**
 * Calcula os dias restantes entre uma data de vencimento e a data de referência.
 * Retorna número inteiro de dias (Math.floor).
 */
export function calcularDiasRestantes(
  dataVencimento: string | Date,
  dataReferencia: Date = new Date()
): number {
  const vencimento = parseDateInput(dataVencimento)
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
