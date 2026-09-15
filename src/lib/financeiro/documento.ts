/**
 * Financeiro D1 (frontend) — validação e máscara de CPF/CNPJ. Puro, testável.
 * Espelha o núcleo do backend (documento-validacao.ts).
 */

export type TipoPessoa = 'FISICA' | 'JURIDICA'

export function normalizarDoc(doc: string): string {
  return (doc ?? '').replace(/\D/g, '')
}

export function detectarTipoPessoa(doc: string): TipoPessoa | null {
  const d = normalizarDoc(doc)
  if (d.length === 11) return 'FISICA'
  if (d.length === 14) return 'JURIDICA'
  return null
}

export function validarCpf(cpf: string): boolean {
  const d = normalizarDoc(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (base: string, peso: number) => {
    let s = 0
    for (let i = 0; i < base.length; i++) s += Number(base[i]) * (peso - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(d.substring(0, 9), 10) === Number(d[9]) && calc(d.substring(0, 10), 11) === Number(d[10])
}

export function validarCnpj(cnpj: string): boolean {
  const d = normalizarDoc(cnpj)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]
    let s = 0
    for (let i = 0; i < base.length; i++) s += Number(base[i]) * pesos[i]
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(d.substring(0, 12)) === Number(d[12]) && calc(d.substring(0, 13)) === Number(d[13])
}

/** Valida documento detectando o tipo. Vazio é considerado "válido" (opcional). */
export function validarDocumento(doc: string): { valido: boolean; tipoPessoa: TipoPessoa | null } {
  const d = normalizarDoc(doc)
  if (d.length === 0) return { valido: true, tipoPessoa: null }
  const tipo = detectarTipoPessoa(doc)
  if (tipo === 'FISICA') return { valido: validarCpf(doc), tipoPessoa: tipo }
  if (tipo === 'JURIDICA') return { valido: validarCnpj(doc), tipoPessoa: tipo }
  return { valido: false, tipoPessoa: null }
}

/** Aplica máscara dinâmica: CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00). */
export function mascararDocumento(doc: string): string {
  const d = normalizarDoc(doc).substring(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Rótulo dinâmico conforme o documento. */
export function rotuloDocumento(doc: string): string {
  const tipo = detectarTipoPessoa(doc)
  if (tipo === 'FISICA') return 'CPF'
  if (tipo === 'JURIDICA') return 'CNPJ'
  return 'CPF/CNPJ'
}
