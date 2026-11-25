/**
 * Janela "Tintas" (Tinta | Complem. | Perc %), como no sistema de referência. Cada linha vira uma cor do
 * cálculo (`cores` do item ou do plano): o motor calcula o consumo de tinta pela % de cada linha e o custo
 * pelo preço/kg da tinta no cadastro. Puro: sem React nem rede.
 */

/** Cor no formato gravado (`cores` do item/plano). Campos de identificação ficam fora do cálculo. */
export interface CorGravada {
  nome: string
  tipo: 'CMYK' | 'PANTONE'
  coberturaPercent: number
  precoKg: number
  rendimentoM2Kg?: number
  tintaId?: string | null
  tinta?: string | null
  complemento?: string | null
}

/** Tinta do cadastro (preço de matéria-prima do tipo TINTA). */
export interface TintaCadastro {
  id: string
  nome: string
  precoKg: number
}

/** Linha editável da janela (texto, como digitado). */
export interface LinhaTinta {
  chave: string
  tintaId: string | null
  tinta: string
  complemento: string
  perc: string
  precoKg: string
}

export const MAX_TINTAS = 12
export const RENDIMENTO_PADRAO = 25
const RE_ESCALA = /\b(escala|cmyk|cm-?k|quadricromia|process)\b/i

let seq = 0
const novaChave = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`

function numero(texto: string): number | null {
  const t = texto.trim()
  if (!t) return null
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : null
}

function texto(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '' : String(n).replace('.', ',')
}

/** Escala (policromia) conta como CMYK no cálculo; as demais são cores especiais. */
export function tipoDaTinta(tinta: string, complemento: string): 'CMYK' | 'PANTONE' {
  return RE_ESCALA.test(tinta) || RE_ESCALA.test(complemento) ? 'CMYK' : 'PANTONE'
}

export function linhaVazia(): LinhaTinta {
  return { chave: novaChave(), tintaId: null, tinta: '', complemento: '', perc: '', precoKg: '' }
}

/**
 * Cores gravadas → linhas da janela. Cor antiga (sem `tinta`): o nome vira a tinta e casa com o
 * cadastro pelo nome, quando houver.
 */
export function linhasDasCores(
  cores: ReadonlyArray<Partial<CorGravada>> | null | undefined,
  cadastro: ReadonlyArray<TintaCadastro> = [],
): LinhaTinta[] {
  return (cores ?? []).map((c) => {
    const nomeTinta = (c.tinta ?? c.nome ?? '').trim()
    const doCadastro =
      (c.tintaId ? cadastro.find((t) => t.id === c.tintaId) : undefined) ??
      cadastro.find((t) => t.nome.trim().toLowerCase() === nomeTinta.toLowerCase())
    return {
      chave: novaChave(),
      tintaId: c.tintaId ?? doCadastro?.id ?? null,
      tinta: nomeTinta,
      complemento: (c.complemento ?? '').trim(),
      perc: texto(c.coberturaPercent ?? null),
      precoKg: texto(c.precoKg ?? null),
    }
  })
}

export interface ErroLinhaTinta {
  chave: string
  campo: 'tinta' | 'perc' | 'precoKg'
  motivo: string
}

/** Valida as linhas preenchidas (linha totalmente vazia é ignorada). */
export function validarLinhasTinta(linhas: ReadonlyArray<LinhaTinta>): ErroLinhaTinta[] {
  const erros: ErroLinhaTinta[] = []
  for (const l of linhas) {
    if (!l.tinta.trim() && !l.complemento.trim() && !l.perc.trim()) continue
    if (!l.tinta.trim()) erros.push({ chave: l.chave, campo: 'tinta', motivo: 'Escolha a tinta.' })
    const p = numero(l.perc)
    if (p === null || p <= 0 || p > 100) erros.push({ chave: l.chave, campo: 'perc', motivo: 'Informe de 0,01 a 100%.' })
    const k = numero(l.precoKg)
    if (k === null || k < 0) erros.push({ chave: l.chave, campo: 'precoKg', motivo: 'Informe o preço por kg.' })
  }
  if (linhas.filter((l) => l.tinta.trim()).length > MAX_TINTAS) {
    erros.push({ chave: linhas[MAX_TINTAS]?.chave ?? '', campo: 'tinta', motivo: `No máximo ${MAX_TINTAS} tintas.` })
  }
  return erros
}

/** Linhas válidas → cores do cálculo. Linhas vazias são descartadas. */
export function coresDasLinhas(linhas: ReadonlyArray<LinhaTinta>): CorGravada[] {
  return linhas
    .filter((l) => l.tinta.trim())
    .map((l) => {
      const tinta = l.tinta.trim()
      const complemento = l.complemento.trim()
      return {
        nome: complemento ? `${tinta} ${complemento}` : tinta,
        tipo: tipoDaTinta(tinta, complemento),
        coberturaPercent: Math.round((numero(l.perc) ?? 0) * 100) / 100,
        precoKg: Math.round((numero(l.precoKg) ?? 0) * 10000) / 10000,
        rendimentoM2Kg: RENDIMENTO_PADRAO,
        tintaId: l.tintaId,
        tinta,
        complemento: complemento || null,
      }
    })
}

/** Composição padrão de uma Cobertura de Tinta (cadastro). */
export interface TintaPadrao {
  tinta: string
  perc: number
}
export interface TintasPadrao {
  umaCor?: TintaPadrao | null
  cores?: TintaPadrao[] | null
}

/** Total de cores de "NxM" (frente + verso). Texto inválido → 0. */
export function totalDeCores(cores: string | null | undefined): number {
  const m = /^\s*(\d{1,2})\s*[xX×]\s*(\d{1,2})\s*$/.exec(cores ?? '')
  if (!m) return 0
  return Number(m[1]) + Number(m[2])
}

const normal = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

/**
 * Tintas da cobertura para as cores do plano, como no sistema de referência: 1 cor usa a tinta de
 * "uma cor"; N cores, as N primeiras da sequência (se a sequência for menor, repete a última). O preço/kg
 * vem do cadastro de tintas (casando pelo nome sem acento); tinta sem cadastro fica com preço 0.
 */
export function tintasDaCobertura(
  padrao: TintasPadrao | null | undefined,
  cores: string | null | undefined,
  cadastro: ReadonlyArray<TintaCadastro> = [],
): CorGravada[] {
  const total = Math.min(totalDeCores(cores), MAX_TINTAS)
  if (!padrao || total === 0) return []
  const seq = (padrao.cores ?? []).filter((t) => t?.tinta?.trim())
  let escolhidas: TintaPadrao[]
  if (total === 1 && padrao.umaCor?.tinta?.trim()) escolhidas = [padrao.umaCor]
  else if (seq.length === 0) escolhidas = padrao.umaCor?.tinta?.trim() ? Array(total).fill(padrao.umaCor) : []
  else escolhidas = Array.from({ length: total }, (_, i) => seq[Math.min(i, seq.length - 1)])
  return escolhidas.map((t) => {
    const nome = t.tinta.trim()
    const doCadastro = cadastro.find((c) => normal(c.nome) === normal(nome))
    return {
      nome: doCadastro?.nome ?? nome,
      tipo: tipoDaTinta(nome, ''),
      coberturaPercent: Math.round((Number(t.perc) || 0) * 100) / 100,
      precoKg: doCadastro?.precoKg ?? 0,
      rendimentoM2Kg: RENDIMENTO_PADRAO,
      tintaId: doCadastro?.id ?? null,
      tinta: doCadastro?.nome ?? nome,
      complemento: null,
    }
  })
}

/** Resumo para o botão: "2 tintas · 100%". */
export function resumoTintas(cores: ReadonlyArray<Partial<Pick<CorGravada, 'coberturaPercent'>>> | null | undefined): string {
  const lista = cores ?? []
  if (lista.length === 0) return 'Nenhuma tinta'
  const soma = lista.reduce((s, c) => s + (Number(c.coberturaPercent) || 0), 0)
  const pct = Math.round(soma * 100) / 100
  return `${lista.length} ${lista.length === 1 ? 'tinta' : 'tintas'} · ${String(pct).replace('.', ',')}%`
}
