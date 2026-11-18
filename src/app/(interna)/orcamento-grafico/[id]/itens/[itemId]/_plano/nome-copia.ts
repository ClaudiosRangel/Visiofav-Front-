/**
 * gerarNomeCopia — nome do plano copiado (R9.5), função PURA.
 *
 * "<nome> (Cópia)"; se já existir no item, "(Cópia 2)", "(Cópia 3)"… A comparação ignora caixa,
 * acento e espaços nas pontas. O resultado tem no máximo `limite` caracteres (60): o nome base é
 * truncado, o sufixo nunca. Copiar "Tampa (Cópia)" parte de "Tampa" (não empilha sufixos).
 */

export const LIMITE_NOME_COPIA = 60

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Remove um sufixo " (Cópia)" ou " (Cópia N)" do fim do nome. */
function semSufixoCopia(nome: string): string {
  return nome
    .normalize('NFC')
    .replace(/\s*\(c[oóÓòÒ]pia(?:\s+\d+)?\)\s*$/i, '')
    .trim()
}

function sufixo(n: number): string {
  return n === 1 ? ' (Cópia)' : ` (Cópia ${n})`
}

function montar(base: string, n: number, limite: number): string {
  const s = sufixo(n)
  const espaco = Math.max(0, limite - s.length)
  const corpo = Array.from(base).slice(0, espaco).join('').trimEnd()
  return `${corpo}${s}`.trim()
}

export function gerarNomeCopia(
  nomeOriginal: string,
  nomesExistentes: ReadonlyArray<string>,
  limite: number = LIMITE_NOME_COPIA,
): string {
  const base = semSufixoCopia(nomeOriginal ?? '') || 'Plano'
  const usados = new Set(nomesExistentes.map(normalizar))
  for (let n = 1; n < 10_000; n++) {
    const candidato = montar(base, n, limite)
    if (!usados.has(normalizar(candidato))) return candidato
  }
  return montar(base, 10_000, limite)
}
