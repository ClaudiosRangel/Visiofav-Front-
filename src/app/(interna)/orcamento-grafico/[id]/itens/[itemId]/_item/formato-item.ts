/**
 * formato-item — lógica PURA do bloco de formato do Item (sem React, sem rede).
 *
 * O valor do formulário segue a convenção de `_layout/reaplicar-layout.ts`: cada
 * `CampoFormato` é uma chave do objeto; dimensões simples são texto digitado e os
 * formatos compostos (Final, Fechado, Aberto) são `{ largura, altura }`. Os valores ficam
 * como TEXTO digitado (vírgula ou ponto) e só viram número ao montar o payload.
 */

import {
  DIMENSAO_MM,
  MODELOS,
  validarFaixa,
  type EspecFaixa,
  type MotivoFaixa,
} from '../../../_validacao/validar-faixa'
import type { CampoFormato, LayoutItem } from '../../../_layout/resolver-layout-item'
import type { CamposHierarquiaItem } from '../itemParaEditar'

export type ParDimensoes = { largura: string; altura: string }

export type ValorFormato = {
  comprimento: string
  largura: string
  altura: string
  abaCola: string
  abaFechamento: string
  alturaTampa: string
  numeroSanfonas: string
  aba: string
  numeroPaginas: string
  formatoFinal: ParDimensoes
  formatoFechado: ParDimensoes
  formatoAberto: ParDimensoes
}

export type ChaveEscalar = Exclude<CampoFormato, 'formatoFinal' | 'formatoFechado' | 'formatoAberto'>
export type ChaveComposta = 'formatoFinal' | 'formatoFechado' | 'formatoAberto'

/** Quantidade de páginas: inteiro de 1 a 9.999. */
export const NUMERO_PAGINAS: EspecFaixa = { min: 1, max: 9999, casas: 0 }
/** Número de sanfonas: inteiro de 1 a 999. */
export const NUMERO_SANFONAS: EspecFaixa = MODELOS

/** Campos que podem ficar em branco mesmo ao exigir os obrigatórios. */
export const CAMPOS_FORMATO_OPCIONAIS: ReadonlySet<CampoFormato> = new Set<CampoFormato>([
  'abaCola',
  'abaFechamento',
  'alturaTampa',
  'aba',
])

export const ROTULOS_FORMATO: Readonly<Record<CampoFormato, string>> = {
  comprimento: 'Comprimento (mm)',
  largura: 'Largura (mm)',
  altura: 'Altura (mm)',
  abaCola: 'Aba Cola (mm)',
  abaFechamento: 'Aba Fechamento (mm)',
  alturaTampa: 'Alt Tampa (mm)',
  formatoFinal: 'Formato Final',
  formatoFechado: 'Formato Fechado',
  formatoAberto: 'Formato Aberto',
  numeroSanfonas: 'Nº de sanfonas',
  aba: 'Aba (mm)',
  numeroPaginas: 'Nº de páginas',
}

const ESPEC_ESCALAR: Readonly<Record<ChaveEscalar, EspecFaixa>> = {
  comprimento: DIMENSAO_MM,
  largura: DIMENSAO_MM,
  altura: DIMENSAO_MM,
  abaCola: DIMENSAO_MM,
  abaFechamento: DIMENSAO_MM,
  alturaTampa: DIMENSAO_MM,
  aba: DIMENSAO_MM,
  numeroSanfonas: NUMERO_SANFONAS,
  numeroPaginas: NUMERO_PAGINAS,
}

export const CHAVES_COMPOSTAS: readonly ChaveComposta[] = ['formatoFinal', 'formatoFechado', 'formatoAberto']

export function ehComposto(campo: CampoFormato): campo is ChaveComposta {
  return (CHAVES_COMPOSTAS as readonly string[]).includes(campo)
}

export function especDoCampo(campo: CampoFormato): EspecFaixa {
  return ehComposto(campo) ? DIMENSAO_MM : ESPEC_ESCALAR[campo as ChaveEscalar]
}

/** Chave do erro de um campo: `campo` ou `campo.largura` / `campo.altura` nos compostos. */
export type ChaveErroFormato = string
export type ErrosFormato = Record<ChaveErroFormato, string>

export function chaveErro(campo: CampoFormato, lado?: 'largura' | 'altura'): ChaveErroFormato {
  return lado ? `${campo}.${lado}` : campo
}

// ============================================================================
// Conversões texto ↔ número
// ============================================================================

export function numeroParaTexto(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

/** Texto digitado → número (vírgula/ponto, milhar pt-BR com ambos). Vazio ou inválido → null. */
export function textoParaNumero(texto: string | null | undefined): number | null {
  if (texto === null || texto === undefined) return null
  let t = texto.trim()
  if (t === '') return null
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '')
  t = t.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const PAR_VAZIO: ParDimensoes = { largura: '', altura: '' }

export function formatoVazio(): ValorFormato {
  return {
    comprimento: '',
    largura: '',
    altura: '',
    abaCola: '',
    abaFechamento: '',
    alturaTampa: '',
    numeroSanfonas: '',
    aba: '',
    numeroPaginas: '',
    formatoFinal: { ...PAR_VAZIO },
    formatoFechado: { ...PAR_VAZIO },
    formatoAberto: { ...PAR_VAZIO },
  }
}

type FonteFormato = CamposHierarquiaItem & {
  comprimentoMm?: number | string | null
  larguraMm?: number | string | null
  alturaMm?: number | string | null
  abaColaMm?: number | string | null
  abaFechamentoMm?: number | string | null
}

/** Valor do formulário a partir do item carregado (`GET /:id`). */
export function formatoDoItem(item: FonteFormato | null | undefined): ValorFormato {
  if (!item) return formatoVazio()
  return {
    comprimento: numeroParaTexto(item.comprimentoMm),
    largura: numeroParaTexto(item.larguraMm),
    altura: numeroParaTexto(item.alturaMm),
    abaCola: numeroParaTexto(item.abaColaMm),
    abaFechamento: numeroParaTexto(item.abaFechamentoMm),
    alturaTampa: numeroParaTexto(item.alturaTampaMm),
    numeroSanfonas: numeroParaTexto(item.numeroSanfonas),
    // Na sanfona a "Aba" é a aba de cola do item (mesma coluna; os modos são excludentes).
    aba: numeroParaTexto(item.abaColaMm),
    numeroPaginas: numeroParaTexto(item.numeroPaginas),
    formatoFinal: {
      largura: numeroParaTexto(item.formatoFinalLarguraMm),
      altura: numeroParaTexto(item.formatoFinalAlturaMm),
    },
    formatoFechado: {
      largura: numeroParaTexto(item.formatoFechadoLarguraMm),
      altura: numeroParaTexto(item.formatoFechadoAlturaMm),
    },
    formatoAberto: {
      largura: numeroParaTexto(item.formatoAbertoLarguraMm),
      altura: numeroParaTexto(item.formatoAbertoAlturaMm),
    },
  }
}

// ============================================================================
// Validação
// ============================================================================

const TEXTO_MOTIVO = (motivo: MotivoFaixa, spec: EspecFaixa): string => {
  const inteiro = spec.casas === 0
  switch (motivo) {
    case 'VAZIO':
      return 'Informe o valor.'
    case 'NAO_NUMERICO':
      return 'Informe um número.'
    case 'ABAIXO':
      return inteiro ? `Valor mínimo: ${spec.min}.` : 'Informe um valor maior que 0.'
    case 'ACIMA':
      return inteiro
        ? `Valor máximo: ${spec.max.toLocaleString('pt-BR')}.`
        : `Valor máximo: ${spec.max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mm.`
    case 'CASAS':
      return inteiro ? 'Use apenas números inteiros.' : 'Use no máximo 2 casas decimais.'
  }
}

/** Mensagem de erro de um texto para o campo, ou null se válido (vazio só erra quando `exigir`). */
export function erroDoTexto(texto: string, spec: EspecFaixa, exigir: boolean): string | null {
  if (texto.trim() === '') return exigir ? TEXTO_MOTIVO('VAZIO', spec) : null
  const r = validarFaixa(texto, spec)
  return r.ok ? null : TEXTO_MOTIVO(r.motivo, spec)
}

export interface OpcoesValidacaoFormato {
  /** Exige os campos obrigatórios (use ao tentar salvar). Padrão: só valida o que foi digitado. */
  validarVazios?: boolean
}

export interface ResultadoValidacaoFormato {
  erros: ErrosFormato
  /** `true` quando o layout está completo e não há nenhum erro. */
  valido: boolean
  /** Motivo de bloqueio estrutural (cadastro sem modo de formato válido). */
  bloqueio: 'CADASTRO_INCOMPLETO' | null
}

export function validarFormato(
  valor: ValorFormato,
  layout: Pick<LayoutItem, 'cadastroCompleto' | 'formato'>,
  opcoes: OpcoesValidacaoFormato = {},
): ResultadoValidacaoFormato {
  const exigirVazios = opcoes.validarVazios === true
  const erros: ErrosFormato = {}

  if (!layout.cadastroCompleto) return { erros, valido: false, bloqueio: 'CADASTRO_INCOMPLETO' }

  for (const campo of layout.formato.campos) {
    const exigir = exigirVazios && !CAMPOS_FORMATO_OPCIONAIS.has(campo)
    const spec = especDoCampo(campo)
    if (ehComposto(campo)) {
      const par = valor[campo]
      const eL = erroDoTexto(par.largura, spec, exigir)
      const eA = erroDoTexto(par.altura, spec, exigir)
      if (eL) erros[chaveErro(campo, 'largura')] = eL
      if (eA) erros[chaveErro(campo, 'altura')] = eA
    } else {
      const e = erroDoTexto(valor[campo as ChaveEscalar], spec, exigir)
      if (e) erros[chaveErro(campo)] = e
    }
  }
  return { erros, valido: Object.keys(erros).length === 0, bloqueio: null }
}

// ============================================================================
// Formato padrão do cadastro (R7.5)
// ============================================================================

const ALVOS_FORMATO_PADRAO: readonly ChaveComposta[] = ['formatoFinal', 'formatoFechado']

function parVazio(par: ParDimensoes): boolean {
  return par.largura.trim() === '' && par.altura.trim() === ''
}

/**
 * Preenche o formato padrão do produto só quando o campo de formato composto está vazio
 * (Formato Final; na falta dele, Formato Fechado). Nunca sobrescreve valor digitado.
 * Devolve o mesmo objeto quando nada muda.
 */
export function aplicarFormatoPadrao(
  valor: ValorFormato,
  layout: Pick<LayoutItem, 'formato'>,
): ValorFormato {
  const padrao = layout.formato.padrao
  if (!padrao) return valor
  const alvo = ALVOS_FORMATO_PADRAO.find((c) => layout.formato.campos.includes(c))
  if (!alvo || !parVazio(valor[alvo])) return valor
  return {
    ...valor,
    [alvo]: { largura: numeroParaTexto(padrao.largura), altura: numeroParaTexto(padrao.altura) },
  }
}

// ============================================================================
// Payload (só campos visíveis; os ocultos nunca são enviados — R7.8)
// ============================================================================

export type PayloadFormato = Partial<Record<string, number | null>>

export function formatoParaPayload(valor: ValorFormato, layout: Pick<LayoutItem, 'formato'>): PayloadFormato {
  const visiveis = new Set<CampoFormato>(layout.formato.campos)
  const saida: PayloadFormato = {}
  const num = (t: string) => textoParaNumero(t)

  if (visiveis.has('comprimento')) saida.comprimentoMm = num(valor.comprimento)
  if (visiveis.has('largura')) saida.larguraMm = num(valor.largura)
  if (visiveis.has('altura')) saida.alturaMm = num(valor.altura)
  if (visiveis.has('abaCola')) saida.abaColaMm = num(valor.abaCola)
  else if (visiveis.has('aba')) saida.abaColaMm = num(valor.aba)
  if (visiveis.has('abaFechamento')) saida.abaFechamentoMm = num(valor.abaFechamento)
  if (visiveis.has('alturaTampa')) saida.alturaTampaMm = num(valor.alturaTampa)
  if (visiveis.has('numeroSanfonas')) saida.numeroSanfonas = num(valor.numeroSanfonas)
  if (visiveis.has('numeroPaginas')) saida.numeroPaginas = num(valor.numeroPaginas)

  const composto = (campo: ChaveComposta, colunaL: string, colunaA: string) => {
    if (!visiveis.has(campo)) return
    saida[colunaL] = num(valor[campo].largura)
    saida[colunaA] = num(valor[campo].altura)
  }
  composto('formatoFinal', 'formatoFinalLarguraMm', 'formatoFinalAlturaMm')
  composto('formatoFechado', 'formatoFechadoLarguraMm', 'formatoFechadoAlturaMm')
  composto('formatoAberto', 'formatoAbertoLarguraMm', 'formatoAbertoAlturaMm')
  return saida
}
