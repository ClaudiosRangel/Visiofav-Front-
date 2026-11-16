/**
 * campos-livres-puro — funções PURAS (sem React, rede ou banco) dos campos livres do
 * item como sugestão de rótulos e opções (spec orcamento-grafico-fase3-produto-embalagem,
 * Req 5). Os campos livres NÃO entram no cálculo: só texto.
 */

import type { CampoLivre } from '../../cadastros/_shared/cadastros-graficos.types'

export const MAX_PARES_CAMPOS_LIVRES = 20
export const MAX_ROTULO_CAMPO_LIVRE = 50
export const MAX_CONTEUDO_CAMPO_LIVRE = 500

/** Proprietários cujos campos livres são sugeridos no item (RECUSA e INSUMO ficam fora). */
export const PROPRIETARIOS_SUGERIDOS: ReadonlyArray<string> = ['SOLICITACAO', 'PEDIDO']

export interface ParCampoLivre {
  rotulo: string
  conteudo: string
}

/** Parte do cadastro de campo livre de que a mesclagem precisa. */
export type CampoLivreCadastro = Pick<
  CampoLivre,
  'proprietario' | 'nome' | 'tipo' | 'obrigatorio' | 'status'
> & { opcoes?: ReadonlyArray<{ valor: string; padrao: boolean; ordem?: number }> | null }

export interface OpcaoSugerida {
  valor: string
  padrao: boolean
}

export interface SugestoesCamposLivres {
  /** Rótulos em ordem alfabética, sem repetir (cadastro ativo + rótulos já usados no item). */
  rotulos: string[]
  /** Opções por rótulo, só para campos do tipo LISTA, na ordem do cadastro. */
  opcoesPorRotulo: Record<string, OpcaoSugerida[]>
  /** Rótulos de campos obrigatórios (apenas indicação; não bloqueia o salvamento). */
  obrigatorios: Set<string>
}

/**
 * Monta as sugestões a partir do cadastro: só campos ATIVOS de proprietário SOLICITACAO
 * ou PEDIDO. Rótulos já presentes nos pares atuais (inclusive os que não existem mais no
 * cadastro) continuam na lista. NUNCA adiciona par nem seleciona opção.
 */
export function mesclarCamposLivres(
  cadastro: ReadonlyArray<CampoLivreCadastro> | null | undefined,
  atuais: ReadonlyArray<ParCampoLivre> | null | undefined,
): SugestoesCamposLivres {
  const rotulos = new Set<string>()
  const opcoesPorRotulo: Record<string, OpcaoSugerida[]> = {}
  const obrigatorios = new Set<string>()

  for (const campo of cadastro ?? []) {
    if (!campo || campo.status !== true) continue
    if (!PROPRIETARIOS_SUGERIDOS.includes(campo.proprietario)) continue
    const rotulo = (campo.nome ?? '').trim()
    if (!rotulo) continue
    rotulos.add(rotulo)
    if (campo.obrigatorio) obrigatorios.add(rotulo)
    if (campo.tipo === 'LISTA') {
      const lista = (opcoesPorRotulo[rotulo] ??= [])
      const ordenadas = (campo.opcoes ?? [])
        .map((o, i) => ({ o, i }))
        .sort((a, b) => (a.o.ordem ?? a.i) - (b.o.ordem ?? b.i) || a.i - b.i)
        .map((x) => x.o)
      for (const o of ordenadas) {
        const valor = (o.valor ?? '').trim()
        if (!valor) continue
        const existente = lista.find((x) => x.valor === valor)
        if (existente) existente.padrao = existente.padrao || o.padrao === true
        else lista.push({ valor, padrao: o.padrao === true })
      }
    }
  }

  for (const par of atuais ?? []) {
    const rotulo = (par?.rotulo ?? '').trim()
    if (rotulo) rotulos.add(rotulo)
  }

  return {
    rotulos: Array.from(rotulos).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    opcoesPorRotulo,
    obrigatorios,
  }
}

export type ResultadoAdicionarPar =
  | { ok: true; pares: ParCampoLivre[] }
  | { ok: false; pares: ParCampoLivre[]; mensagem: string }

/**
 * Adiciona um par ao final da lista respeitando os limites do schema: no máximo 20 pares,
 * rótulo até 50 e conteúdo até 500 caracteres. Em caso de rejeição devolve a MESMA lista.
 */
export function adicionarParCampoLivre(
  pares: ReadonlyArray<ParCampoLivre>,
  par: ParCampoLivre,
): ResultadoAdicionarPar {
  const atuais = pares as ParCampoLivre[]
  if (pares.length >= MAX_PARES_CAMPOS_LIVRES) {
    return {
      ok: false,
      pares: atuais,
      mensagem: `Limite de ${MAX_PARES_CAMPOS_LIVRES} campos livres por item atingido.`,
    }
  }
  if ((par.rotulo ?? '').length > MAX_ROTULO_CAMPO_LIVRE) {
    return {
      ok: false,
      pares: atuais,
      mensagem: `O rótulo aceita no máximo ${MAX_ROTULO_CAMPO_LIVRE} caracteres.`,
    }
  }
  if ((par.conteudo ?? '').length > MAX_CONTEUDO_CAMPO_LIVRE) {
    return {
      ok: false,
      pares: atuais,
      mensagem: `O conteúdo aceita no máximo ${MAX_CONTEUDO_CAMPO_LIVRE} caracteres.`,
    }
  }
  return { ok: true, pares: [...pares, { rotulo: par.rotulo ?? '', conteudo: par.conteudo ?? '' }] }
}
