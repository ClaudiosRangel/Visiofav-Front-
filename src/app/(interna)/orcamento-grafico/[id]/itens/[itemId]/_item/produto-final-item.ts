/**
 * produto-final-item — lógica PURA de Acondicionamento e Complementos do Item
 * (sem React, sem rede).
 *
 * Acondicionamento: lista de escolhidos (`{ descricao }`) + Conteúdo por volume (1 a 999.999).
 * Complementos: Observação e Obs. Áreas de Op (até 2.000), Informações Complementares (até 1.000,
 * só quando o layout a exibe). O item ainda não tem coluna para Informações Complementares; quem
 * monta a tela decide onde gravar (`complementosParaPayload` não a inclui).
 */

import { CONTEUDO_POR_VOLUME } from '../../../_validacao/validar-faixa'
import { erroDoTexto, numeroParaTexto, textoParaNumero } from './formato-item'

export const MAX_OBSERVACAO = 2000
export const MAX_OBS_AREAS_OP = 2000
export const MAX_INFO_COMPLEMENTARES = 1000

// ----------------------------------------------------------------------------
// Acondicionamento
// ----------------------------------------------------------------------------

export type EscolhaAcondicionamento = { descricao: string }

export type ValorAcondicionamento = {
  /** Acondicionamentos escolhidos (lista da direita). */
  escolhidos: EscolhaAcondicionamento[]
  /** Conteúdo por volume (texto digitado, inteiro de 1 a 999.999). */
  conteudoVolume: string
}

export function acondicionamentoVazio(): ValorAcondicionamento {
  return { escolhidos: [], conteudoVolume: '' }
}

export function acondicionamentoDoItem(item: {
  acondicionamento?: ReadonlyArray<{ descricao?: string | null }> | null
  conteudoVolume?: number | string | null
} | null | undefined): ValorAcondicionamento {
  if (!item) return acondicionamentoVazio()
  return {
    escolhidos: Array.isArray(item.acondicionamento)
      ? item.acondicionamento.map((a) => ({ descricao: a?.descricao ?? '' })).filter((a) => a.descricao !== '')
      : [],
    conteudoVolume: numeroParaTexto(item.conteudoVolume),
  }
}

/** Compara descrições sem diferenciar maiúsculas, acento nem espaços nas pontas. */
export function normalizarDescricao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function estaEscolhido(escolhidos: ReadonlyArray<EscolhaAcondicionamento>, descricao: string): boolean {
  const alvo = normalizarDescricao(descricao)
  return escolhidos.some((e) => normalizarDescricao(e.descricao) === alvo)
}

/** Adiciona a opção ao fim da lista de escolhidos (sem duplicar). */
export function escolher(
  escolhidos: ReadonlyArray<EscolhaAcondicionamento>,
  descricao: string,
): EscolhaAcondicionamento[] {
  const limpa = descricao.trim()
  if (limpa === '' || estaEscolhido(escolhidos, limpa)) return [...escolhidos]
  return [...escolhidos, { descricao: limpa }]
}

/** Remove a opção da lista de escolhidos. */
export function descartar(
  escolhidos: ReadonlyArray<EscolhaAcondicionamento>,
  descricao: string,
): EscolhaAcondicionamento[] {
  const alvo = normalizarDescricao(descricao)
  return escolhidos.filter((e) => normalizarDescricao(e.descricao) !== alvo)
}

export function validarAcondicionamento(
  valor: ValorAcondicionamento,
): { erros: { conteudoVolume?: string }; valido: boolean } {
  const erro = erroDoTexto(valor.conteudoVolume, CONTEUDO_POR_VOLUME, false)
  return { erros: erro ? { conteudoVolume: erro } : {}, valido: erro === null }
}

export function acondicionamentoParaPayload(valor: ValorAcondicionamento): {
  acondicionamento: EscolhaAcondicionamento[]
  conteudoVolume: number | null
} {
  return {
    acondicionamento: valor.escolhidos.map((e) => ({ descricao: e.descricao })),
    conteudoVolume: textoParaNumero(valor.conteudoVolume),
  }
}

// ----------------------------------------------------------------------------
// Complementos (textos)
// ----------------------------------------------------------------------------

export type ValorComplementos = {
  observacao: string
  observacaoAreasOp: string
  informacoesComplementares: string
}

export type ErrosComplementos = Partial<Record<keyof ValorComplementos, string>>

export function complementosVazio(): ValorComplementos {
  return { observacao: '', observacaoAreasOp: '', informacoesComplementares: '' }
}

export function complementosDoItem(item: {
  observacao?: string | null
  observacaoAreasOp?: string | null
  informacoesComplementares?: string | null
} | null | undefined): ValorComplementos {
  return {
    observacao: item?.observacao ?? '',
    observacaoAreasOp: item?.observacaoAreasOp ?? '',
    informacoesComplementares: item?.informacoesComplementares ?? '',
  }
}

function erroTamanho(texto: string, max: number, rotulo: string): string | null {
  return texto.length > max ? `${rotulo}: no máximo ${max.toLocaleString('pt-BR')} caracteres.` : null
}

/**
 * Valida os textos. Informações Complementares só é avaliada quando o layout a exibe
 * (campo oculto nunca bloqueia a gravação).
 */
export function validarComplementos(
  valor: ValorComplementos,
  opcoes: { informacoesComplementaresVisiveis: boolean },
): { erros: ErrosComplementos; valido: boolean } {
  const erros: ErrosComplementos = {}
  const obs = erroTamanho(valor.observacao, MAX_OBSERVACAO, 'Observação')
  const areas = erroTamanho(valor.observacaoAreasOp, MAX_OBS_AREAS_OP, 'Obs. Áreas de Op')
  if (obs) erros.observacao = obs
  if (areas) erros.observacaoAreasOp = areas
  if (opcoes.informacoesComplementaresVisiveis) {
    const info = erroTamanho(valor.informacoesComplementares, MAX_INFO_COMPLEMENTARES, 'Informações Complementares')
    if (info) erros.informacoesComplementares = info
  }
  return { erros, valido: Object.keys(erros).length === 0 }
}

/** Colunas gravadas pelos textos (Informações Complementares fica a cargo de quem monta a tela). */
export function complementosParaPayload(valor: ValorComplementos): { observacao: string; observacaoAreasOp: string } {
  return { observacao: valor.observacao, observacaoAreasOp: valor.observacaoAreasOp }
}
