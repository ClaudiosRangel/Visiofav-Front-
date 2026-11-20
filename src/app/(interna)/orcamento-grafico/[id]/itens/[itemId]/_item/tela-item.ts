/**
 * tela-item — lógica PURA da Tela_Item (sem React, sem rede).
 *
 * Fonte única do formulário do item: `form` (o mesmo `WizardFormData` que o `EditorItem` usa,
 * hidratado por `itemParaForm`). Os blocos da tela editam "visões" em texto (comum, formato,
 * plano único, acondicionamento, complementos). Ao calcular ou salvar, `formEfetivo` aplica sobre
 * o `form` SOMENTE os campos que o usuário alterou e que estão visíveis no layout. Campo não
 * alterado vai exatamente como o `EditorItem` enviaria; campo oculto pelo layout nunca é gravado
 * (fica com o valor que veio do item).
 *
 * O payload de engenharia é sempre o de `montarPayloadItem` (itemFormShared, sem alteração). Por
 * fora dele entram só campos informativos que o motor não lê:
 *  - os 9 campos D3 (formato fechado/aberto/final, altura da tampa, nº de sanfonas, nº de páginas),
 *    apenas os visíveis e alterados;
 *  - `descricao` do item (o `EditorItem` não enviava, e o back gravava `null`);
 *  - `numCores` = N + M das Cores `NxM` no plano único (o item guarda só a quantidade de cores;
 *    sem o campo, o back gravava o padrão 4).
 */

import type { WizardFormData } from '../../../../novo/page'
import { INITIAL_ITEM, itemParaForm, montarPayloadCalculo, montarPayloadItem } from '../../../itemFormShared'
import type { LayoutItem } from '../../../_layout/resolver-layout-item'
import { camposParaGravar } from '../../../_layout/reaplicar-layout'
import type { ItemParaEditarHierarquia } from '../itemParaEditar'
import { comumDoItem, comumParaPayload, lerTiragens, validarComum, type ValorComum } from './comum-item'
import { formatoDoItem, formatoParaPayload, validarFormato, type PayloadFormato, type ValorFormato } from './formato-item'
import {
  coresDoValor,
  planoUnicoDoItem,
  planoUnicoParaForm,
  validarPlanoUnico,
  type ValorPlanoUnico,
} from './plano-unico-item'
import {
  acondicionamentoDoItem,
  acondicionamentoParaPayload,
  complementosDoItem,
  validarAcondicionamento,
  validarComplementos,
  type ValorAcondicionamento,
  type ValorComplementos,
} from './produto-final-item'

export interface EstadoTelaItem {
  form: WizardFormData
  comum: ValorComum
  formato: ValorFormato
  planoUnico: ValorPlanoUnico
  acondicionamento: ValorAcondicionamento
  complementos: ValorComplementos
}

export interface ContextoHidratacao {
  orcamentoId: string
  observacoesOrcamento?: string | null
  imagemFacaOrcamento?: string | null
  imagemProdutoOrcamento?: string | null
}

/** Estado inicial a partir do item carregado (`GET /:id` → `itemParaEditar`) ou de um item novo. */
export function estadoInicialTelaItem(
  item: ItemParaEditarHierarquia | null,
  ctx: ContextoHidratacao,
): EstadoTelaItem {
  const form: WizardFormData = item
    ? itemParaForm(item, ctx.orcamentoId, ctx.observacoesOrcamento, ctx.imagemFacaOrcamento, ctx.imagemProdutoOrcamento)
    : { ...INITIAL_ITEM, _imagemFaca: ctx.imagemFacaOrcamento ?? null, _imagemProdutoUrl: ctx.imagemProdutoOrcamento ?? null }

  const fonteComum = item
    ? item
    : { tipoEmbalagemId: form.tipoEmbalagemId, quantidade: form.quantidade, qtdModelos: null, siglaAcabado: '', tributacao: '' }

  return {
    form,
    comum: comumDoItem(fonteComum),
    formato: formatoDoItem(item),
    planoUnico: planoUnicoDoItem(item),
    acondicionamento: acondicionamentoDoItem(item),
    complementos: complementosDoItem(item),
  }
}

// ============================================================================
// Aplicação das visões sobre o formulário (só o que mudou e está visível)
// ============================================================================

const GEOMETRIA: readonly (keyof PayloadFormato)[] = ['comprimentoMm', 'larguraMm', 'alturaMm', 'abaColaMm', 'abaFechamentoMm']

/** Colunas informativas D3 (fora do motor). */
export const CAMPOS_D3 = [
  'formatoFechadoLarguraMm',
  'formatoFechadoAlturaMm',
  'formatoAbertoLarguraMm',
  'formatoAbertoAlturaMm',
  'formatoFinalLarguraMm',
  'formatoFinalAlturaMm',
  'alturaTampaMm',
  'numeroSanfonas',
  'numeroPaginas',
] as const

/** Visão de formato + plano único no vocabulário do layout (para `camposParaGravar`). */
function vocabulario(formato: ValorFormato, plano: ValorPlanoUnico): Record<string, unknown> {
  return {
    ...formato,
    cores: plano.cores,
    processoImpressao: plano.processoImpressao,
    coberturaTinta: plano.coberturaTintaTexto,
    fabricante: plano.fabricante,
    fornecido: plano.fornecido,
    microondulado: plano.microondulado,
    fibra: plano.fibra,
    ajusteCorteMicro: plano.ajusteCorteMicro,
  }
}

/** Remove da visão os campos que o layout oculta (reaplica os valores iniciais neles). */
function visaoGravavel(estado: EstadoTelaItem, inicial: EstadoTelaItem, layout: LayoutItem): {
  formato: ValorFormato
  planoUnico: ValorPlanoUnico
} {
  const atual = vocabulario(estado.formato, estado.planoUnico)
  const gravavel = camposParaGravar(atual, layout)
  const formato = { ...inicial.formato } as Record<string, unknown>
  for (const chave of Object.keys(inicial.formato)) {
    if (chave in gravavel) formato[chave] = gravavel[chave]
  }
  const plano: ValorPlanoUnico = { ...inicial.planoUnico }
  if ('cores' in gravavel) plano.cores = estado.planoUnico.cores
  if ('processoImpressao' in gravavel) plano.processoImpressao = estado.planoUnico.processoImpressao
  if ('coberturaTinta' in gravavel) plano.coberturaTintaTexto = estado.planoUnico.coberturaTintaTexto
  if ('fabricante' in gravavel) plano.fabricante = estado.planoUnico.fabricante
  if ('fornecido' in gravavel) plano.fornecido = estado.planoUnico.fornecido
  if ('microondulado' in gravavel) plano.microondulado = estado.planoUnico.microondulado
  if ('fibra' in gravavel) plano.fibra = estado.planoUnico.fibra
  if ('ajusteCorteMicro' in gravavel) plano.ajusteCorteMicro = estado.planoUnico.ajusteCorteMicro
  return { formato: formato as ValorFormato, planoUnico: plano }
}

function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Formulário que vai para o cálculo e para o salvar: o `form` com as edições das visões
 * aplicadas campo a campo (só os alterados; ocultos pelo layout nunca entram).
 */
export function formEfetivo(estado: EstadoTelaItem, inicial: EstadoTelaItem, layout: LayoutItem | null): WizardFormData {
  const f: WizardFormData = { ...estado.form }

  // Comum (não depende do layout).
  const c = comumParaPayload(estado.comum)
  const c0 = comumParaPayload(inicial.comum)
  if (c.tipoEmbalagemId !== c0.tipoEmbalagemId) f.tipoEmbalagemId = c.tipoEmbalagemId
  if (c.siglaAcabado !== c0.siglaAcabado) f.siglaAcabado = c.siglaAcabado
  if (c.tributacao !== c0.tributacao) f.tributacao = c.tributacao
  if (estado.comum.tiragem !== inicial.comum.tiragem) {
    const r = lerTiragens(estado.comum.tiragem)
    if (r.ok) {
      // `quantidade` acompanha a primeira (referência). Uma tiragem só envia `[]` para remover
      // linhas antigas de um item que tinha várias; a lista só vai quando o campo foi alterado.
      f.quantidade = r.valores[0]
      f.tiragens = r.valores.length > 1 ? r.valores : []
    }
  }
  if (estado.comum.modelos !== inicial.comum.modelos) f.qtdModelos = c.qtdModelos

  // Acondicionamento e textos.
  if (!igual(estado.acondicionamento, inicial.acondicionamento)) {
    const a = acondicionamentoParaPayload(estado.acondicionamento)
    f.acondicionamento = a.acondicionamento
    f.conteudoVolume = a.conteudoVolume
  }
  if (estado.complementos.observacao !== inicial.complementos.observacao) f.observacao = estado.complementos.observacao
  if (estado.complementos.observacaoAreasOp !== inicial.complementos.observacaoAreasOp) {
    f.observacaoAreasOp = estado.complementos.observacaoAreasOp
  }

  if (!layout) return f

  const visao = visaoGravavel(estado, inicial, layout)

  // Geometria do formato (colunas que já existiam no item).
  const p = formatoParaPayload(visao.formato, layout)
  const p0 = formatoParaPayload(inicial.formato, layout)
  for (const chave of GEOMETRIA) {
    if (chave in p && p[chave] !== p0[chave]) (f as Record<string, unknown>)[chave] = p[chave] ?? null
  }

  // Plano implícito (só plano único).
  if (layout.estrutura === 'PLANO_UNICO') {
    const u = planoUnicoParaForm(visao.planoUnico, layout)
    const u0 = planoUnicoParaForm(inicial.planoUnico, layout)
    for (const [chave, valor] of Object.entries(u)) {
      if (!igual(valor, (u0 as Record<string, unknown>)[chave])) (f as Record<string, unknown>)[chave] = valor
    }
  }
  return f
}

/** Campos D3 visíveis e alterados (para mesclar ao payload). */
export function camposD3Alterados(estado: EstadoTelaItem, inicial: EstadoTelaItem, layout: LayoutItem | null): PayloadFormato {
  if (!layout) return {}
  const visao = visaoGravavel(estado, inicial, layout)
  const p = formatoParaPayload(visao.formato, layout)
  const p0 = formatoParaPayload(inicial.formato, layout)
  const saida: PayloadFormato = {}
  for (const chave of CAMPOS_D3) {
    if (chave in p && p[chave] !== p0[chave]) saida[chave] = p[chave] ?? null
  }
  return saida
}

/** `numCores` = N + M das Cores `NxM` (só plano único, Cores visível e válida). */
export function numCoresDoPlanoUnico(estado: EstadoTelaItem, layout: LayoutItem | null): number | undefined {
  if (!layout || layout.estrutura !== 'PLANO_UNICO' || !layout.planoUnico.campos.includes('cores')) return undefined
  const cores = coresDoValor(estado.planoUnico)
  return cores ? cores.frente + cores.verso : undefined
}

/**
 * Payload de salvar: o de `montarPayloadItem` (sem alteração) + campos informativos por fora.
 * Nunca cria `PlanoCalculoGrafico`: não há chave `planos` no payload.
 */
export function montarPayloadTelaItem(
  estado: EstadoTelaItem,
  inicial: EstadoTelaItem,
  layout: LayoutItem | null,
  form: WizardFormData = formEfetivo(estado, inicial, layout),
): Record<string, unknown> {
  const numCores = numCoresDoPlanoUnico(estado, layout)
  const descricao = estado.comum.descricao.trim()
  return {
    ...montarPayloadItem(form),
    ...camposD3Alterados(estado, inicial, layout),
    descricao: descricao === '' ? null : descricao,
    ...(numCores !== undefined ? { numCores } : {}),
  }
}

/** Payload do botão Calcular (mesmo de `montarPayloadCalculo`, usado pelo editor atual). */
export function montarPayloadCalculoTelaItem(form: WizardFormData): Record<string, unknown> {
  return montarPayloadCalculo(form)
}

// ============================================================================
// Validação antes de enviar
// ============================================================================

export interface ErroValidacaoTela {
  campo: string
  motivo: string
}

const ROTULO_COMUM: Record<string, string> = {
  tipoEmbalagemId: 'Tipo de Produto',
  descricao: 'Descrição',
  siglaAcabado: 'Sigla Acabado',
  tributacao: 'Tributação',
  tiragem: 'Tiragens',
  modelos: 'Modelos',
}

const ROTULO_PLANO: Record<string, string> = {
  cores: 'Cores',
  processoImpressao: 'Processo de Impressão',
  coberturaTintaTexto: 'Cobertura de Tinta',
  fabricante: 'Fabricante',
  ajusteCorteMicro: 'Ajuste Corte Micro (mm)',
}

const ROTULO_COMPLEMENTOS: Record<string, string> = {
  observacao: 'Observação',
  observacaoAreasOp: 'Obs. Áreas de Op',
  informacoesComplementares: 'Informações Complementares',
}

function rotuloFormato(chave: string): string {
  const [campo, lado] = chave.split('.')
  const base: Record<string, string> = {
    comprimento: 'Comprimento',
    largura: 'Largura',
    altura: 'Altura',
    abaCola: 'Aba Cola',
    abaFechamento: 'Aba Fechamento',
    alturaTampa: 'Alt Tampa',
    numeroSanfonas: 'Nº de sanfonas',
    aba: 'Aba',
    numeroPaginas: 'Nº de páginas',
    formatoFinal: 'Formato Final',
    formatoFechado: 'Formato Fechado',
    formatoAberto: 'Formato Aberto',
  }
  const nome = base[campo] ?? campo
  return lado ? `${nome} (${lado === 'largura' ? 'Largura' : 'Altura'})` : nome
}

/**
 * Valida os blocos com `validarComum`, `validarFormato` e `validarComplementos` (mais plano único e
 * acondicionamento). Devolve a lista de erros `{ campo, motivo }`; vazia = pode enviar.
 */
export function validarTelaItem(
  estado: EstadoTelaItem,
  layout: LayoutItem | null,
  opcoes: { exigirFormato?: boolean } = {},
): ErroValidacaoTela[] {
  const erros: ErroValidacaoTela[] = []
  const comum = validarComum(estado.comum, { validarVazios: true })
  for (const [k, m] of Object.entries(comum.erros)) erros.push({ campo: ROTULO_COMUM[k] ?? k, motivo: m as string })

  if (layout) {
    // Formato vazio só bloqueia item novo: os itens já gravados nasceram antes das colunas de
    // formato (todas nulas) e precisam continuar salvando sem alteração. O que foi digitado é
    // sempre validado.
    const formato = validarFormato(estado.formato, layout, { validarVazios: opcoes.exigirFormato !== false })
    if (formato.bloqueio === 'CADASTRO_INCOMPLETO') {
      erros.push({ campo: 'Formato', motivo: 'Cadastro do produto incompleto (modo de formato).' })
    }
    for (const [k, m] of Object.entries(formato.erros)) erros.push({ campo: rotuloFormato(k), motivo: m })

    const plano = validarPlanoUnico(estado.planoUnico, layout)
    for (const [k, m] of Object.entries(plano.erros)) erros.push({ campo: ROTULO_PLANO[k] ?? k, motivo: m as string })
  }

  const acond = validarAcondicionamento(estado.acondicionamento)
  if (acond.erros.conteudoVolume) erros.push({ campo: 'Conteúdo por volume', motivo: acond.erros.conteudoVolume })

  const complementos = validarComplementos(estado.complementos, {
    informacoesComplementaresVisiveis: layout?.informacoesComplementaresVisiveis === true,
  })
  for (const [k, m] of Object.entries(complementos.erros)) {
    erros.push({ campo: ROTULO_COMPLEMENTOS[k] ?? k, motivo: m as string })
  }
  return erros
}

/** Texto único da validação: "Campo: motivo; Campo: motivo". */
export function textoErrosValidacao(erros: ReadonlyArray<ErroValidacaoTela>): string {
  return erros.map((e) => `${e.campo}: ${e.motivo}`).join('; ')
}

/**
 * Mensagem do servidor para exibir. O back devolve "Dados inválidos — campo: motivo" no
 * `message`; quando não há texto, cai em uma mensagem genérica com o status.
 */
export function mensagemErroServidor(err: unknown, padrao: string): string {
  const resp = (err as { response?: { status?: number; data?: { message?: unknown; issues?: unknown } } })?.response
  const msg = resp?.data?.message
  if (typeof msg === 'string' && msg.trim()) return msg.trim()
  return padrao
}
