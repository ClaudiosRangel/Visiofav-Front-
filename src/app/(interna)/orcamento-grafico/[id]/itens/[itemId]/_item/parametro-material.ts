/**
 * parametro-material — lógica PURA dos campos de parâmetro de um Material de atividade (R11.4 a R11.6).
 *
 * Os campos exibidos dependem do `tipoParam` do material (`tipoParamDoMaterial`). Os valores ficam
 * como TEXTO digitado e só viram número depois de validados; valor inválido nunca vira escolha
 * (nada é gravado) e a seleção gravada antes permanece.
 *
 * Faixas: `PARAM_MATERIAL` (maior que 0 e até 99.999,99, 2 casas) para medida, quantidade e peças;
 * percentuais de cobertura (`tipoParam` 1) usam 0 a 100 com 2 casas, sendo "% frente" maior que 0
 * (o verso pode ser 0, que é o padrão); gramatura em kg/m² aceita até 4 casas.
 */

import {
  camposParametroMaterial,
  paramsPadraoMaterial,
  tipoParamDoMaterial,
  type MaterialParaTipoParam,
} from '../../../editor/catalogo/catalogo-puro'
import type { SelecaoPendente } from '../../../editor/catalogo/catalogo.types'
import { COBERTURA_PERC, PARAM_MATERIAL, validarFaixa, type EspecFaixa } from '../../../_validacao/validar-faixa'

export type ChaveParametro = 'param1' | 'param2' | 'gramaturaKgM2' | 'pecasPorCaixa'

export interface CampoParametro {
  chave: ChaveParametro
  rotulo: string
  spec: EspecFaixa
}

export type RascunhoParametros = Record<ChaveParametro, string>
export type ErrosParametros = Partial<Record<ChaveParametro, string>>

export const ROTULO_MEDIDA_MM = 'Medida em mm'

/** "% frente" da cobertura: maior que 0 e até 100 %. */
export const PERCENTUAL_FRENTE: EspecFaixa = { min: 0, max: 100, minExclusivo: true, casas: 2 }
/** Gramatura do revestimento em kg/m²: maior que 0 e até 99.999,9999, 4 casas. */
export const GRAMATURA_KG_M2: EspecFaixa = { min: 0, max: 99999.9999, minExclusivo: true, casas: 4 }

export const CHAVES_PARAMETRO: readonly ChaveParametro[] = ['param1', 'param2', 'gramaturaKgM2', 'pecasPorCaixa']

export function rascunhoVazio(): RascunhoParametros {
  return { param1: '', param2: '', gramaturaKgM2: '', pecasPorCaixa: '' }
}

/** Campos de parâmetro do material, com rótulo do `tipoParam` e a faixa de cada um. */
export function camposDoMaterial(material: MaterialParaTipoParam | null | undefined): CampoParametro[] {
  if (!material) return []
  const tipo = tipoParamDoMaterial(material)
  const base = camposParametroMaterial(tipo, material.unidadeCusto)
  const campos: CampoParametro[] = []

  switch (tipo) {
    case 0:
      campos.push({ chave: 'pecasPorCaixa', rotulo: 'Peças por caixa', spec: PARAM_MATERIAL })
      break
    case 1:
      campos.push({ chave: 'param1', rotulo: base.param1 ?? '% frente', spec: PERCENTUAL_FRENTE })
      campos.push({ chave: 'param2', rotulo: base.param2 ?? '% verso', spec: COBERTURA_PERC })
      if (base.gramaturaKgM2) campos.push({ chave: 'gramaturaKgM2', rotulo: 'Gramatura (kg/m²)', spec: GRAMATURA_KG_M2 })
      break
    case 3:
      campos.push({ chave: 'param1', rotulo: ROTULO_MEDIDA_MM, spec: PARAM_MATERIAL })
      break
    case 4:
      campos.push({ chave: 'param1', rotulo: base.param1 ?? 'Quantidade por peça', spec: PARAM_MATERIAL })
      break
    default:
      break // 2 = informativo, sem campo
  }
  return campos
}

// ============================================================================
// Texto ↔ número
// ============================================================================

function numeroParaTexto(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '' : String(v).replace('.', ',')
}

export interface ParametrosSelecionados {
  param1?: number | null
  param2?: number | null
  gramaturaKgM2?: number | null
  pecasPorCaixa?: number | null
}

/** Rascunho (texto) a partir da seleção gravada ou pendente. */
export function rascunhoDaSelecao(sel: ParametrosSelecionados | null | undefined): RascunhoParametros {
  return {
    param1: numeroParaTexto(sel?.param1),
    param2: numeroParaTexto(sel?.param2),
    gramaturaKgM2: numeroParaTexto(sel?.gramaturaKgM2),
    pecasPorCaixa: numeroParaTexto(sel?.pecasPorCaixa),
  }
}

// ============================================================================
// Validação
// ============================================================================

function formatarLimite(n: number, casas: number): string {
  const [inteiro, fracao] = n.toFixed(casas).split('.')
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return fracao ? `${milhar},${fracao}` : milhar
}

/** Texto do intervalo permitido de uma faixa (R11.6). */
export function textoIntervalo(spec: EspecFaixa): string {
  const piso = spec.minExclusivo ? `maior que ${formatarLimite(spec.min, 0)}` : `de ${formatarLimite(spec.min, 0)}`
  const casas = spec.casas > 0 ? `, com até ${spec.casas} casas decimais` : ''
  return `Informe um valor ${piso} e até ${formatarLimite(spec.max, spec.casas)}${casas}.`
}

/** Valida um campo: vazio, não numérico, fora da faixa ou com casas demais → mensagem com o intervalo. */
export function erroDoParametro(texto: string, spec: EspecFaixa): string | null {
  return validarFaixa(texto, spec).ok ? null : textoIntervalo(spec)
}

export function validarRascunho(
  campos: ReadonlyArray<CampoParametro>,
  rascunho: RascunhoParametros,
): { erros: ErrosParametros; valido: boolean } {
  const erros: ErrosParametros = {}
  for (const c of campos) {
    const e = erroDoParametro(rascunho[c.chave], c.spec)
    if (e) erros[c.chave] = e
  }
  return { erros, valido: Object.keys(erros).length === 0 }
}

// ============================================================================
// Escolha (o que vai para a seleção de material)
// ============================================================================

export type EscolhaMaterial = Omit<SelecaoPendente, 'acabamentoId'>

/** Escolha ao marcar um material: padrões do `tipoParam` e campos ainda por preencher. */
export function escolhaInicial(
  material: MaterialParaTipoParam & { id: string },
  restricaoId?: string | null,
): EscolhaMaterial {
  const tipoParam = tipoParamDoMaterial(material)
  const padroes = paramsPadraoMaterial(tipoParam)
  return {
    materialId: material.id,
    tipoParam,
    param1: padroes.param1,
    param2: padroes.param2,
    gramaturaKgM2: null,
    pecasPorCaixa: null,
    restricaoId: restricaoId ?? null,
  }
}

/** A escolha digitada é igual à seleção atual (nada novo para gravar). */
export function mesmaEscolha(
  escolha: EscolhaMaterial,
  atual:
    | (ParametrosSelecionados & { materialId: string; restricaoId?: string | null })
    | null
    | undefined,
): boolean {
  if (!atual || atual.materialId !== escolha.materialId) return false
  if ((atual.restricaoId ?? null) !== (escolha.restricaoId ?? null)) return false
  return CHAVES_PARAMETRO.every((c) => (atual[c] ?? null) === (escolha[c] ?? null))
}

/**
 * Escolha a partir dos parâmetros digitados. Qualquer campo inválido devolve `escolha: null` com
 * os erros por campo: nada é gravado e a seleção anterior permanece (R11.6).
 */
export function escolhaDosParametros(
  material: MaterialParaTipoParam & { id: string },
  rascunho: RascunhoParametros,
  restricaoId?: string | null,
): { escolha: EscolhaMaterial | null; erros: ErrosParametros } {
  const campos = camposDoMaterial(material)
  const { erros, valido } = validarRascunho(campos, rascunho)
  if (!valido) return { escolha: null, erros }

  const escolha = escolhaInicial(material, restricaoId)
  for (const c of campos) {
    const r = validarFaixa(rascunho[c.chave], c.spec)
    if (r.ok) escolha[c.chave] = r.valor
  }
  return { escolha, erros }
}
