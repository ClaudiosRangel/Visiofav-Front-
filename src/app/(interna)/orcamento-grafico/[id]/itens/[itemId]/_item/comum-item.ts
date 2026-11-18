/**
 * comum-item — lógica PURA dos dados comuns do Item (sem React, sem rede).
 *
 * Campos: Tipo de Produto, Descrição (até 200), Sigla Acabado (até 60), Tributação,
 * Tiragem e Modelos (1 a 999, padrão 1). Valores numéricos ficam como TEXTO digitado e só
 * viram número no payload.
 *
 * Observações de contrato:
 * - Tiragem: hoje o item persiste UMA tiragem (`quantidade`); várias tiragens ficam para fase própria.
 * - Descrição: o item ainda não tem coluna própria; o campo é do bloco e quem monta a tela decide
 *   onde gravar (`comumParaPayload` não a inclui).
 */

import { MODELOS, TIRAGEM, type EspecFaixa } from '../../../_validacao/validar-faixa'
import { erroDoTexto, numeroParaTexto, textoParaNumero } from './formato-item'

export const MAX_DESCRICAO = 200
export const MAX_SIGLA_ACABADO = 60
export const MAX_TRIBUTACAO = 60
export const MODELOS_PADRAO = '1'

export type ValorComum = {
  tipoEmbalagemId: string | null
  descricao: string
  siglaAcabado: string
  tributacao: string
  /** Tiragem (texto digitado, inteiro de 1 a 999.999.999). */
  tiragem: string
  /** Modelos (texto digitado, inteiro de 1 a 999). Vazio = padrão 1. */
  modelos: string
}

export type ChaveComum = keyof ValorComum
export type ErrosComum = Partial<Record<ChaveComum, string>>

export function comumVazio(): ValorComum {
  return { tipoEmbalagemId: null, descricao: '', siglaAcabado: '', tributacao: '', tiragem: '', modelos: '' }
}

type FonteComum = {
  tipoEmbalagemId?: string | null
  siglaAcabado?: string | null
  tributacao?: string | null
  quantidade?: number | string | null
  qtdModelos?: number | string | null
  descricao?: string | null
}

/** Valor do bloco a partir do item carregado (`GET /:id`). Modelos ausente assume o padrão 1. */
export function comumDoItem(item: FonteComum | null | undefined): ValorComum {
  if (!item) return { ...comumVazio(), modelos: MODELOS_PADRAO }
  return {
    tipoEmbalagemId: item.tipoEmbalagemId ?? null,
    descricao: item.descricao ?? '',
    siglaAcabado: item.siglaAcabado ?? '',
    tributacao: item.tributacao ?? '',
    tiragem: numeroParaTexto(item.quantidade),
    modelos: item.qtdModelos != null && item.qtdModelos !== '' ? numeroParaTexto(item.qtdModelos) : MODELOS_PADRAO,
  }
}

/** Modelos efetivos: campo vazio vale 1. */
export function modelosEfetivo(valor: Pick<ValorComum, 'modelos'>): number | null {
  if (valor.modelos.trim() === '') return Number(MODELOS_PADRAO)
  return textoParaNumero(valor.modelos)
}

function erroLimite(texto: string, max: number, rotulo: string): string | null {
  return texto.length > max ? `${rotulo}: no máximo ${max} caracteres.` : null
}

export interface OpcoesValidacaoComum {
  /** Exige os obrigatórios (use ao tentar salvar). */
  validarVazios?: boolean
}

export function validarComum(valor: ValorComum, opcoes: OpcoesValidacaoComum = {}): { erros: ErrosComum; valido: boolean } {
  const exigir = opcoes.validarVazios === true
  const erros: ErrosComum = {}
  const poe = (chave: ChaveComum, msg: string | null) => {
    if (msg) erros[chave] = msg
  }

  if (exigir && !valor.tipoEmbalagemId) poe('tipoEmbalagemId', 'Escolha o tipo de produto.')
  poe('descricao', erroLimite(valor.descricao, MAX_DESCRICAO, 'Descrição'))
  poe('siglaAcabado', erroLimite(valor.siglaAcabado, MAX_SIGLA_ACABADO, 'Sigla Acabado'))
  poe('tributacao', erroLimite(valor.tributacao, MAX_TRIBUTACAO, 'Tributação'))
  poe('tiragem', erroDoTexto(valor.tiragem, TIRAGEM, exigir))
  // Modelos vazio = padrão 1 (nunca exige).
  poe('modelos', erroDoTexto(valor.modelos, MODELOS as EspecFaixa, false))

  return { erros, valido: Object.keys(erros).length === 0 }
}

/** Colunas do item gravadas por este bloco (descrição fica a cargo de quem monta a tela). */
export function comumParaPayload(valor: ValorComum): {
  tipoEmbalagemId: string | null
  siglaAcabado: string
  tributacao: string
  quantidade: number | null
  qtdModelos: number | null
} {
  return {
    tipoEmbalagemId: valor.tipoEmbalagemId,
    siglaAcabado: valor.siglaAcabado.trim(),
    tributacao: valor.tributacao.trim(),
    quantidade: textoParaNumero(valor.tiragem),
    qtdModelos: modelosEfetivo(valor),
  }
}
