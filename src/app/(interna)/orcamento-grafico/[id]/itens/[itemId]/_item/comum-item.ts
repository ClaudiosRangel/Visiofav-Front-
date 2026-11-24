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

import { MODELOS, TIRAGEM, validarFaixa, type EspecFaixa } from '../../../_validacao/validar-faixa'
import { erroDoTexto, numeroParaTexto, textoParaNumero } from './formato-item'

export const MAX_DESCRICAO = 200
export const MAX_SIGLA_ACABADO = 60
export const MAX_TRIBUTACAO = 60
export const MODELOS_PADRAO = '1'
/** Máximo de tiragens por item (o mesmo limite do back). */
export const MAX_TIRAGENS = 20

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
  /** Linhas por tiragem do item; mais de uma = item com várias tiragens. */
  tiragens?: Array<{ quantidade: number | string }> | null
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
    tiragem: tiragensParaTexto(item),
    modelos: item.qtdModelos != null && item.qtdModelos !== '' ? numeroParaTexto(item.qtdModelos) : MODELOS_PADRAO,
  }
}

/** Modelos efetivos: campo vazio vale 1. */
export function modelosEfetivo(valor: Pick<ValorComum, 'modelos'>): number | null {
  if (valor.modelos.trim() === '') return Number(MODELOS_PADRAO)
  return textoParaNumero(valor.modelos)
}

export type ResultadoTiragens = { ok: true; valores: number[] } | { ok: false; erro: string }

/**
 * Lê o campo "Tiragens": valores inteiros de 1 a 999.999.999 separados por vírgula (ou ponto e vírgula);
 * o ponto é separador de milhar ("2.000,4.000,6.000"). Devolve em ordem crescente. De 1 a 20 valores,
 * sem repetição. Qualquer valor inválido recusa o campo inteiro, citando o valor, em vez de ignorá-lo.
 */
export function lerTiragens(texto: string): ResultadoTiragens {
  const partes = texto.split(/[,;]/).map((p) => p.trim()).filter((p) => p !== '')
  if (partes.length === 0) return { ok: false, erro: 'Informe a tiragem.' }
  if (partes.length > MAX_TIRAGENS) return { ok: false, erro: `Informe no máximo ${MAX_TIRAGENS} tiragens.` }
  const valores: number[] = []
  for (const bruta of partes) {
    // Ponto de milhar só no formato certo ("2.000", "12.345.678"); "1.5" segue sendo recusado.
    const parte = /^\d{1,3}(\.\d{3})+$/.test(bruta) ? bruta.replace(/\./g, '') : bruta
    const motivo = erroDoTexto(parte, TIRAGEM, true)
    if (motivo) return { ok: false, erro: partes.length > 1 ? `Tiragem "${parte}": ${motivo}` : motivo }
    const r = validarFaixa(parte, TIRAGEM)
    if (!r.ok) return { ok: false, erro: `Tiragem "${parte}" inválida.` }
    if (valores.includes(r.valor)) return { ok: false, erro: `A tiragem ${r.valor} está repetida.` }
    valores.push(r.valor)
  }
  return { ok: true, valores: valores.sort((a, b) => a - b) }
}

/** Lista de tiragens do campo quando válida; `null` quando o texto está vazio ou inválido. */
export function tiragensDoComum(valor: Pick<ValorComum, 'tiragem'>): number[] | null {
  if (valor.tiragem.trim() === '') return null
  const r = lerTiragens(valor.tiragem)
  return r.ok ? r.valores : null
}

/** Texto do campo a partir do item carregado: "2000,4000,6000" com várias tiragens, ou a quantidade. */
function tiragensParaTexto(item: Pick<FonteComum, 'quantidade' | 'tiragens'>): string {
  const lista = Array.isArray(item.tiragens)
    ? item.tiragens.map((t) => Number(t.quantidade)).filter((n) => Number.isFinite(n))
    : []
  if (lista.length > 1) return [...lista].sort((a, b) => a - b).join(',')
  return numeroParaTexto(item.quantidade)
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
  if (valor.tiragem.trim() === '') {
    poe('tiragem', erroDoTexto('', TIRAGEM, exigir))
  } else {
    const t = lerTiragens(valor.tiragem)
    if (!t.ok) poe('tiragem', t.erro)
  }
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
    // Com várias tiragens, `quantidade` é a primeira (a de referência); a lista vai em `tiragensDoComum`.
    quantidade: tiragensDoComum(valor)?.[0] ?? textoParaNumero(valor.tiragem),
    qtdModelos: modelosEfetivo(valor),
  }
}

/**
 * Tipos de Produto permitidos para o item: os tipos ligados aos produtos da mesma Linha de Produto
 * do produto escolhido (no Calcgraf a lista de Produto/Tipo vem da linha). Sem vínculo cadastrado,
 * devolve null (a tela mostra todos). O tipo já escolhido sempre continua na lista. Puro.
 */
export function tiposPermitidosDaLinha(
  produtoAtualId: string | null | undefined,
  produtos: ReadonlyArray<{ id: string; linhaProdutoId: string | null; tipoEmbalagemId?: string | null }>,
  tipoAtualId: string | null | undefined,
): Set<string> | null {
  const atual = produtos.find((p) => p.id === produtoAtualId)
  if (!atual?.linhaProdutoId) return null
  const ids = new Set(
    produtos
      .filter((p) => p.linhaProdutoId === atual.linhaProdutoId && p.tipoEmbalagemId)
      .map((p) => p.tipoEmbalagemId as string),
  )
  if (ids.size === 0) return null
  if (tipoAtualId) ids.add(tipoAtualId)
  return ids
}
