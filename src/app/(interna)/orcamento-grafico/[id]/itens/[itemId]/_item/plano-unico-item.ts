/**
 * plano-unico-item — lógica PURA do bloco "Impressão e suporte" do Item de PLANO ÚNICO (sem React,
 * sem rede). O plano implícito vive nas colunas achatadas do item; nunca se cria `PlanoCalculoGrafico`.
 *
 * Os valores ficam como TEXTO digitado (Cores `NxM`, Ajuste Corte Micro com vírgula ou ponto) e só
 * viram número ao montar o que vai para o formulário do item. Os nomes `processoImpressao`,
 * `coberturaTintaTexto` e `fabricante` coincidem com os de `CamposDefaultItem`, então os padrões do
 * `DefaultProdutoPlano` entram por `aplicarPadroesNoItem` sem duplicar regra.
 *
 * Suporte NÃO faz parte do valor: ele depende de papel, gramatura e preço por kg (custo), e é
 * editado pelo seletor de papel já existente, que a tela passa ao bloco como encaixe. Montagem e
 * Formato de Corte são somente leitura; vêm do formulário/cálculo atual (`leituraCalculada`).
 */

import type { WizardFormData } from '../../../../novo/page'
import type { CampoPlanoUnico, LayoutItem } from '../../../_layout/resolver-layout-item'
import { aplicarPadroesNoItem, type PadroesIniciais } from '../../../_layout/resolver-layout-item'
import type { NomesDefault } from '../../../editor/catalogo/catalogo-puro'
import { AJUSTE_MICRO_ITEM, parseCores, validarFaixa, type MotivoFaixa } from '../../../_validacao/validar-faixa'
import { numeroParaTexto, textoParaNumero } from './formato-item'

export const MAX_PROCESSO = 60
export const MAX_COBERTURA = 60
export const MAX_FABRICANTE = 120

export type ValorPlanoUnico = {
  /** `NxM` (frente x verso), N e M de 0 a 12. */
  cores: string
  processoImpressao: string
  coberturaTintaTexto: string
  fabricante: string
  fornecido: boolean
  microondulado: boolean
  fibra: boolean
  /** Ajuste Corte Micro (mm): 0 a 100,00 com até 2 casas (texto digitado). */
  ajusteCorteMicro: string
}

export type ChavePlanoUnico = keyof ValorPlanoUnico
export type ErrosPlanoUnico = Partial<Record<ChavePlanoUnico, string>>

export function planoUnicoVazio(): ValorPlanoUnico {
  return {
    cores: '',
    processoImpressao: '',
    coberturaTintaTexto: '',
    fabricante: '',
    fornecido: false,
    microondulado: false,
    fibra: false,
    ajusteCorteMicro: '',
  }
}

type FontePlanoUnico = {
  numCores?: number | string | null
  processoImpressao?: string | null
  coberturaTintaTexto?: string | null
  fabricante?: string | null
  fornecido?: boolean | null
  microondulado?: boolean | null
  fibra?: boolean | null
  ajusteCorteMicroMm?: number | string | null
}

/**
 * Cores do item como `NxM`. O item guarda só a quantidade de cores (`numCores`), sem a divisão
 * frente/verso; sem outra informação, mostra `N x 0`. Sem cores = vazio.
 */
export function coresTextoDoItem(numCores: number | string | null | undefined): string {
  const n = Number(numCores)
  return Number.isFinite(n) && n > 0 ? `${Math.trunc(n)}x0` : ''
}

/** Valor do bloco a partir do item carregado (`GET /:id`). */
export function planoUnicoDoItem(item: FontePlanoUnico | null | undefined): ValorPlanoUnico {
  if (!item) return planoUnicoVazio()
  return {
    cores: coresTextoDoItem(item.numCores),
    processoImpressao: item.processoImpressao ?? '',
    coberturaTintaTexto: item.coberturaTintaTexto ?? '',
    fabricante: item.fabricante ?? '',
    fornecido: item.fornecido === true,
    microondulado: item.microondulado === true,
    fibra: item.fibra === true,
    ajusteCorteMicro: numeroParaTexto(item.ajusteCorteMicroMm),
  }
}

// ============================================================================
// Visibilidade (dirigida por `layout.planoUnico.campos`)
// ============================================================================

export type LayoutPlanoUnico = Pick<LayoutItem, 'estrutura' | 'planoUnico'>

export function campoVisivel(layout: LayoutPlanoUnico, campo: CampoPlanoUnico): boolean {
  return layout.estrutura === 'PLANO_UNICO' && layout.planoUnico.campos.includes(campo)
}

export function campoSomenteLeitura(layout: LayoutPlanoUnico, campo: CampoPlanoUnico): boolean {
  return layout.planoUnico.somenteLeitura.includes(campo)
}

// ============================================================================
// Validação
// ============================================================================

function mensagemCores(motivo: 'VAZIO' | 'FORMATO' | 'ACIMA'): string {
  if (motivo === 'ACIMA') return 'Use de 0 a 12 cores em cada lado.'
  return 'Use o formato NxM, por exemplo 5x0.'
}

function mensagemAjuste(motivo: MotivoFaixa): string {
  switch (motivo) {
    case 'ABAIXO':
      return 'Não use valor negativo.'
    case 'ACIMA':
      return 'Valor máximo: 100,00 mm.'
    case 'CASAS':
      return 'Use no máximo 2 casas decimais.'
    default:
      return 'Informe um número.'
  }
}

function erroLimite(texto: string, max: number, rotulo: string): string | null {
  return texto.length > max ? `${rotulo}: no máximo ${max} caracteres.` : null
}

/**
 * Valida só os campos visíveis. Campo vazio é aceito (todos são opcionais, como no editor atual);
 * o que foi digitado precisa estar no formato e na faixa.
 */
export function validarPlanoUnico(
  valor: ValorPlanoUnico,
  layout: LayoutPlanoUnico,
): { erros: ErrosPlanoUnico; valido: boolean } {
  const erros: ErrosPlanoUnico = {}

  if (campoVisivel(layout, 'cores') && valor.cores.trim() !== '') {
    const r = parseCores(valor.cores)
    if (!r.ok) erros.cores = mensagemCores(r.motivo)
  }
  if (campoVisivel(layout, 'processoImpressao')) {
    const e = erroLimite(valor.processoImpressao, MAX_PROCESSO, 'Processo de Impressão')
    if (e) erros.processoImpressao = e
  }
  if (campoVisivel(layout, 'coberturaTinta')) {
    const e = erroLimite(valor.coberturaTintaTexto, MAX_COBERTURA, 'Cobertura de Tinta')
    if (e) erros.coberturaTintaTexto = e
  }
  if (campoVisivel(layout, 'fabricante')) {
    const e = erroLimite(valor.fabricante, MAX_FABRICANTE, 'Fabricante')
    if (e) erros.fabricante = e
  }
  if (campoVisivel(layout, 'ajusteCorteMicro') && valor.ajusteCorteMicro.trim() !== '') {
    const r = validarFaixa(valor.ajusteCorteMicro, AJUSTE_MICRO_ITEM)
    if (!r.ok) erros.ajusteCorteMicro = mensagemAjuste(r.motivo)
  }

  return { erros, valido: Object.keys(erros).length === 0 }
}

// ============================================================================
// Saída para o formulário do item
// ============================================================================

/** Divisão frente/verso do texto `NxM`; null quando vazio ou inválido. */
export function coresDoValor(valor: Pick<ValorPlanoUnico, 'cores'>): { frente: number; verso: number } | null {
  const r = parseCores(valor.cores)
  return r.ok ? { frente: r.frente, verso: r.verso } : null
}

/** Colunas do item que o bloco grava (só campos visíveis; os ocultos nunca são enviados). */
export type CamposFormPlanoUnico = Partial<
  Pick<
    WizardFormData,
    'processoImpressao' | 'coberturaTintaTexto' | 'fabricante' | 'fornecido' | 'microondulado' | 'fibra' | 'ajusteCorteMicroMm'
  >
>

/**
 * Valor do bloco → campos do `WizardFormData` do item (colunas achatadas). Não inclui Cores nem
 * Suporte (ver `coresDoValor` e o seletor de papel) nem Montagem/Formato de Corte (somente leitura).
 * Ajuste Corte Micro vazio ou inválido vira `null` (nunca grava valor inválido).
 */
export function planoUnicoParaForm(valor: ValorPlanoUnico, layout: LayoutPlanoUnico): CamposFormPlanoUnico {
  const saida: CamposFormPlanoUnico = {}
  if (campoVisivel(layout, 'processoImpressao')) saida.processoImpressao = valor.processoImpressao.trim()
  if (campoVisivel(layout, 'coberturaTinta')) saida.coberturaTintaTexto = valor.coberturaTintaTexto.trim()
  if (campoVisivel(layout, 'fabricante')) saida.fabricante = valor.fabricante.trim()
  if (campoVisivel(layout, 'fornecido')) saida.fornecido = valor.fornecido
  if (campoVisivel(layout, 'microondulado')) saida.microondulado = valor.microondulado
  if (campoVisivel(layout, 'fibra')) saida.fibra = valor.fibra
  if (campoVisivel(layout, 'ajusteCorteMicro')) {
    const r = validarFaixa(valor.ajusteCorteMicro, AJUSTE_MICRO_ITEM)
    saida.ajusteCorteMicroMm = r.ok ? r.valor : null
  }
  return saida
}

// ============================================================================
// Padrões do cadastro (item novo)
// ============================================================================

/**
 * Padrões do `DefaultProdutoPlano` em item NOVO: preenche só campo vazio (nunca sobrescreve).
 * Processo, Cobertura e Fabricante passam por `aplicarPadroesNoItem`; Cores vem de `padroes.cores`.
 * `semImpressao` não preenche Cores (o resolvedor já devolve null nesse caso).
 */
export function aplicarPadroesNoValor(
  valor: ValorPlanoUnico,
  padroes: Pick<PadroesIniciais, 'cores' | 'fabricanteSuporte'> | null | undefined,
  nomes: NomesDefault = {},
): ValorPlanoUnico {
  if (!padroes) return valor
  const comPadroes = aplicarPadroesNoItem(valor, padroes, nomes)
  if (comPadroes.cores.trim() === '' && padroes.cores) return { ...comPadroes, cores: padroes.cores }
  return comPadroes
}

// ============================================================================
// Montagem e Formato de Corte (somente leitura)
// ============================================================================

type Numero = number | string | null | undefined

function positivo(v: Numero): number | null {
  const n = typeof v === 'number' ? v : textoParaNumero(v == null ? null : String(v))
  return n !== null && Number.isFinite(n) && n > 0 ? n : null
}

/** `L x C` (ex.: `2x2`); vazio quando falta algum lado. */
export function textoMontagem(linhas: Numero, colunas: Numero): string {
  const l = positivo(linhas)
  const c = positivo(colunas)
  return l !== null && c !== null ? `${numeroParaTexto(l)}x${numeroParaTexto(c)}` : ''
}

/** `largura x altura` em mm (ex.: `650 x 1225`); vazio quando falta algum lado. */
export function textoFormatoCorte(largura: Numero, altura: Numero): string {
  const l = positivo(largura)
  const a = positivo(altura)
  return l !== null && a !== null ? `${numeroParaTexto(l)} x ${numeroParaTexto(a)}` : ''
}

/** Texto de Montagem e Formato de Corte a partir do formulário do item (que já os traz do cálculo). */
export function leituraCalculada(
  form: Partial<
    Pick<WizardFormData, 'montagemLinhas' | 'montagemColunas' | 'formatoCorteLarguraMm' | 'formatoCorteAlturaMm'>
  > | null | undefined,
): { montagem: string; formatoCorte: string } {
  return {
    montagem: textoMontagem(form?.montagemLinhas, form?.montagemColunas),
    formatoCorte: textoFormatoCorte(form?.formatoCorteLarguraMm, form?.formatoCorteAlturaMm),
  }
}

/**
 * Montagem e Formato de Corte a partir do resultado do cálculo (`resultado.encaixe`), para quando o
 * formulário ainda não os tem (item novo, recém-calculado). Montagem = linhas x colunas do encaixe;
 * se o aproveitamento usado não bate com a grade (aproveitamento informado à mão), mostra o número de
 * peças por folha. Formato de Corte = a folha usada no cálculo.
 */
export function leituraDoResultado(resultado: unknown): { montagem: string; formatoCorte: string } {
  const r = resultado && typeof resultado === 'object' ? (resultado as Record<string, unknown>) : null
  const encaixe = r?.encaixe && typeof r.encaixe === 'object' ? (r.encaixe as Record<string, unknown>) : null
  const layout = encaixe?.layout && typeof encaixe.layout === 'object' ? (encaixe.layout as Record<string, unknown>) : null
  const aproveitamento = positivo(encaixe?.aproveitamento as Numero)
  const linhas = positivo(layout?.linhas as Numero)
  const colunas = positivo(layout?.colunas as Numero)
  let montagem = ''
  if (linhas !== null && colunas !== null && (aproveitamento === null || linhas * colunas === aproveitamento)) {
    montagem = textoMontagem(linhas, colunas)
  } else if (aproveitamento !== null) {
    montagem = `${numeroParaTexto(aproveitamento)} por folha`
  }
  return {
    montagem,
    formatoCorte: textoFormatoCorte(layout?.folhaLarguraMm as Numero, layout?.folhaAlturaMm as Numero),
  }
}