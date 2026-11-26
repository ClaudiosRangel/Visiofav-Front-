/**
 * tela-plano — lógica PURA da Tela_Plano (R10): estado do formulário (valores como texto), carga a
 * partir do plano gravado, padrões do tipo de plano para plano novo, validação por campo e corpo
 * do POST/PUT. Sem React e sem rede.
 *
 * Mapeamento para o back (D1):
 *  - colunas do plano: `nome`, `tipoPlanoId`, `suporteId` (suporte do primeiro bloco exibido, na
 *    ordem capa externa → microondulado → capa interna → suporte principal), `gramatura` (mantida do
 *    plano ou do padrão do tipo; a tela não tem campo), `formatoLarguraMm`/`formatoAlturaMm`
 *    (= Formato Aberto, porque o plano não tem formato de corte próprio; sem Formato Aberto, o plano
 *    existente mantém as colunas gravadas), `numCores` (N + M das Cores), `cores`, `maquinaId` e
 *    `suporteProducaoId` (mantidos como estavam) e `acabamentosRicos` (bloco Acabamento);
 *  - o restante vai em `especificacao` `{ versao: 1, ... }`. Blocos ocultos pelo tipo vão `null`
 *    (grava só o que está exibido).
 */

import type { AcabamentoRicoSelecionado } from '../../../../novo/page'
import type { DefaultProdutoPlano, TipoPlanoGrafico } from '../../../../cadastros/_shared/cadastros-graficos.types'
import {
  aplicarPadroesNoPlano,
  resolverBlocosPlano,
  resolverPadroesIniciais,
  type BlocosPlano,
  type TipoPlanoComPrevisao,
} from '../../../_layout/resolver-layout-item'
import {
  AJUSTE_MICRO_PLANO,
  COBERTURA_PERC,
  DIMENSAO_MM_PLANO,
  LIMITE_CORES,
  OCORRENCIAS,
  TIRAGEM,
  parseCores,
  validarFaixa,
  type EspecFaixa,
} from '../../../_validacao/validar-faixa'
import { numeroParaTexto } from '../_item/formato-item'
import { lerPreImpressao, type PreImpressao } from '../_item/pre-impressao'
import type { BlocoSuporteEspec, CorPlano, EspecificacaoPlanoV1, PlanoLeitura } from './plano.types'

export const MAX_NOME_PLANO = 60
export const MAX_TEXTO_CURTO = 60
export const MAX_PROCESSO_PLANO = 120

// ============================================================================
// Estado
// ============================================================================

export interface BlocoSuporteForm {
  fabricante: string
  suporteId: string | null
  suporteNome: string | null
  fornecido: boolean
}

export interface EstadoTelaPlano {
  tipoPlanoId: string | null
  nome: string
  ocorrencias: string
  tiragem: string
  /** O usuário informou tiragem própria (senão grava `null` = usa a do item). */
  tiragemPropria: boolean
  montagem: string
  corte: string
  formatoAberto: { largura: string; altura: string }
  formatoFinal: { comprimento: string; largura: string; altura: string; alturaTampa: string }
  cores: string
  processoImpressao: string
  coberturaTinta: string
  principal: BlocoSuporteForm
  capaExterna: BlocoSuporteForm & { fibra: string }
  microondulado: BlocoSuporteForm & { sentidoOnda: string; ajusteCorteMicro: string }
  capaInterna: BlocoSuporteForm & { cores: string; processoImpressao: string; coberturaTinta: string }
  acabamentosRicos: AcabamentoRicoSelecionado[]
  /** Tintas do plano (janela Tintas): viram as `cores` do cálculo. */
  tintas: CorPlano[]
  /** Janela Pré-Impressão do plano (só gravada; não altera o preço). */
  preImpressao: PreImpressao | null
  /** Mantidos do plano gravado (sem campo na tela). */
  gramatura: number | null
}

/** Dados do item usados pela Tela_Plano (somente leitura; nenhum campo do item é editado). */
export interface ContextoItemPlano {
  tiragemItem: number | null
}

const SUPORTE_VAZIO: BlocoSuporteForm = { fabricante: '', suporteId: null, suporteNome: null, fornecido: false }

function texto(v: unknown): string {
  return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)
}

function suporteDe(b: BlocoSuporteEspec | null | undefined): BlocoSuporteForm {
  if (!b) return { ...SUPORTE_VAZIO }
  return {
    fabricante: texto(b.fabricante),
    suporteId: b.suporteId ?? null,
    suporteNome: b.suporteNome ?? null,
    fornecido: b.fornecido === true,
  }
}

function numOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Estado de um plano novo (tiragem = a do item). */
export function estadoPlanoNovo(ctx: ContextoItemPlano): EstadoTelaPlano {
  return {
    tipoPlanoId: null,
    nome: '',
    ocorrencias: '1',
    tiragem: numeroParaTexto(ctx.tiragemItem),
    tiragemPropria: false,
    montagem: '',
    corte: '',
    formatoAberto: { largura: '', altura: '' },
    formatoFinal: { comprimento: '', largura: '', altura: '', alturaTampa: '' },
    cores: '',
    processoImpressao: '',
    coberturaTinta: '',
    principal: { ...SUPORTE_VAZIO },
    capaExterna: { ...SUPORTE_VAZIO, fibra: '' },
    microondulado: { ...SUPORTE_VAZIO, sentidoOnda: '', ajusteCorteMicro: '' },
    capaInterna: { ...SUPORTE_VAZIO, cores: '', processoImpressao: '', coberturaTinta: '' },
    acabamentosRicos: [],
    tintas: [],
    preImpressao: null,
    gramatura: null,
  }
}

/** Estado de um plano gravado: todos os valores gravados, sem padrões (R10.14). */
export function estadoDoPlano(
  plano: PlanoLeitura,
  ctx: ContextoItemPlano,
  blocos: BlocosTelaPlano = blocosDaTela(null),
): EstadoTelaPlano {
  const e: EspecificacaoPlanoV1 | null = plano.especificacao ?? null
  const base = estadoPlanoNovo(ctx)
  const tiragemPropria = numOuNull(e?.tiragem) !== null
  const abertoL = e?.formatoAberto?.largura ?? numOuNull(plano.formatoLarguraMm)
  const abertoA = e?.formatoAberto?.altura ?? numOuNull(plano.formatoAlturaMm)
  // Sem `especificacao` (plano antigo): as cores NxM vêm do total de cores (N x 0).
  const cores = typeof e?.cores === 'string' ? e.cores : plano.numCores !== null && plano.numCores !== undefined ? `${plano.numCores}x0` : ''

  const estado: EstadoTelaPlano = {
    ...base,
    tipoPlanoId: plano.tipoPlanoId ?? null,
    nome: plano.nome ?? '',
    ocorrencias: e?.ocorrencias != null ? String(e.ocorrencias) : base.ocorrencias,
    tiragem: tiragemPropria ? numeroParaTexto(numOuNull(e?.tiragem)) : base.tiragem,
    tiragemPropria,
    montagem: texto(e?.montagem),
    corte: texto(e?.corte),
    formatoAberto: { largura: numeroParaTexto(abertoL), altura: numeroParaTexto(abertoA) },
    formatoFinal: {
      comprimento: numeroParaTexto(e?.formatoFinal?.comprimento ?? null),
      largura: numeroParaTexto(e?.formatoFinal?.largura ?? null),
      altura: numeroParaTexto(e?.formatoFinal?.altura ?? null),
      alturaTampa: numeroParaTexto(e?.formatoFinal?.alturaTampa ?? null),
    },
    cores,
    tintas: Array.isArray(plano.cores) ? plano.cores.map((c) => ({ ...c })) : [],
    preImpressao: lerPreImpressao((plano as { preImpressao?: unknown }).preImpressao),
    processoImpressao: texto(e?.processoImpressao),
    coberturaTinta: numeroParaTexto(e?.coberturaTinta ?? null),
    principal: suporteDe(e?.suportePrincipal),
    capaExterna: {
      ...suporteDe(e?.capaExterna),
      fibra: texto(e?.capaExterna?.fibra),
    },
    microondulado: {
      ...suporteDe(e?.microondulado),
      sentidoOnda: texto(e?.microondulado?.sentidoOnda),
      ajusteCorteMicro: numeroParaTexto(e?.microondulado?.ajusteCorteMicro ?? null),
    },
    capaInterna: {
      ...suporteDe(e?.capaInterna),
      cores: texto(e?.capaInterna?.cores),
      processoImpressao: texto(e?.capaInterna?.processoImpressao),
      coberturaTinta: numeroParaTexto(e?.capaInterna?.coberturaTinta ?? null),
    },
    acabamentosRicos: Array.isArray(plano.acabamentosRicos)
      ? (plano.acabamentosRicos as unknown as AcabamentoRicoSelecionado[])
      : [],
    gramatura: numOuNull(plano.gramatura),
  }
  // A coluna `suporteId` é a fonte da verdade do suporte que entra no cálculo: o bloco que a
  // representa (o primeiro exibido) mostra esse suporte, mesmo em plano gravado antes da tela.
  const chave = blocoDoSuporteColuna(blocos)
  if (plano.suporteId && estado[chave].suporteId !== plano.suporteId) {
    estado[chave] = { ...estado[chave], suporteId: plano.suporteId, suporteNome: null } as never
  }
  return estado
}

// ============================================================================
// Blocos exibidos
// ============================================================================

export interface BlocosTelaPlano extends BlocosPlano {
  /** Suporte principal: só quando o tipo não prevê capa externa, microondulado nem capa interna. */
  principal: boolean
}

export function blocosDaTela(tipo: TipoPlanoComPrevisao | null | undefined): BlocosTelaPlano {
  const b = resolverBlocosPlano(tipo)
  return { ...b, principal: !b.capaExterna && !b.microondulado && !b.capaInterna }
}

type ChaveBloco = 'capaExterna' | 'microondulado' | 'capaInterna' | 'principal'
const ORDEM_BLOCOS: readonly ChaveBloco[] = ['capaExterna', 'microondulado', 'capaInterna', 'principal']

/** Bloco cujo suporte vai para a coluna `suporteId` (o primeiro exibido). */
export function blocoDoSuporteColuna(blocos: BlocosTelaPlano): ChaveBloco {
  return ORDEM_BLOCOS.find((k) => blocos[k]) ?? 'principal'
}

// ============================================================================
// Padrões do tipo (plano novo)
// ============================================================================

export interface PadroesTipoPlano {
  tipo: Pick<TipoPlanoGrafico, 'nome' | 'suportePadraoId' | 'gramaturaPadrao' | 'fibraDefault'> & TipoPlanoComPrevisao
  defaultProduto: DefaultProdutoPlano | null
  /** Nome do processo de impressão do default (o default só traz o id). */
  nomeProcesso: string | null
  /** Ids das atividades pré-marcadas (catálogo do tipo + default). */
  atividadesPreMarcadas: AcabamentoRicoSelecionado[]
}

/**
 * Aplica os padrões do tipo em plano NOVO (R10.11). Campos tocados pelo usuário nunca mudam;
 * os demais seguem o tipo escolhido (sem default do produto ficam em branco). Nome, suporte e
 * gramatura passam por `aplicarPadroesNoPlano` (mesma regra do modal antigo).
 */
export function aplicarPadroesDoTipo(
  estado: EstadoTelaPlano,
  padroes: PadroesTipoPlano,
  tocados: ReadonlySet<string>,
): EstadoTelaPlano {
  const d = padroes.defaultProduto
  const p = resolverPadroesIniciais({ default: d })
  const blocos = blocosDaTela(padroes.tipo)
  const chaveSuporte = blocoDoSuporteColuna(blocos)
  const livre = (campo: string) => !tocados.has(campo)

  const atual = estado[chaveSuporte]
  const aplicado = aplicarPadroesNoPlano(
    {
      nome: livre('nome') ? '' : estado.nome,
      suporteId: livre(`${chaveSuporte}.suporteId`) ? null : atual.suporteId,
      // Plano novo não tem campo de gramatura: ela segue sempre o tipo escolhido.
      gramatura: null,
    },
    padroes.tipo,
    p,
    new Set(Array.from(tocados).filter((t) => t === 'nome')),
  )

  const proximo: EstadoTelaPlano = { ...estado }
  if (livre('nome')) proximo.nome = (aplicado.nome ?? '').slice(0, MAX_NOME_PLANO)
  proximo.gramatura = aplicado.gramatura == null || aplicado.gramatura === '' ? null : Number(aplicado.gramatura)
  if (livre('cores')) proximo.cores = d && !d.semImpressao ? `${p.coresFrente}x${p.coresVerso}` : ''
  if (livre('processoImpressao')) proximo.processoImpressao = padroes.nomeProcesso ?? ''
  if (livre('coberturaTinta')) {
    const area = d ? Number(d.areaTintaPerc) : NaN
    proximo.coberturaTinta = Number.isFinite(area) && area > 0 ? numeroParaTexto(area) : ''
  }
  if (livre(`${chaveSuporte}.suporteId`)) {
    proximo[chaveSuporte] = {
      ...proximo[chaveSuporte],
      suporteId: aplicado.suporteId ?? null,
      suporteNome: aplicado.suporteId ? proximo[chaveSuporte].suporteNome : null,
    } as never
  }
  if (livre(`${chaveSuporte}.fabricante`)) {
    proximo[chaveSuporte] = { ...proximo[chaveSuporte], fabricante: p.fabricanteSuporte ?? '' } as never
  }
  if (livre('capaExterna.fibra')) {
    proximo.capaExterna = { ...proximo.capaExterna, fibra: blocos.fibra ? (padroes.tipo.fibraDefault ?? '') : '' }
  }
  if (livre('acabamentosRicos')) proximo.acabamentosRicos = padroes.atividadesPreMarcadas
  return proximo
}

// ============================================================================
// Validação
// ============================================================================

export type ErrosTelaPlano = Record<string, string>

const OBRIGATORIO = 'Campo obrigatório'

function mensagemFaixa(spec: EspecFaixa, motivo: string): string {
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: spec.casas, maximumFractionDigits: spec.casas })
  if (motivo === 'CASAS') return spec.casas === 0 ? 'Informe um número inteiro' : `Use até ${spec.casas} casas decimais`
  if (motivo === 'NAO_NUMERICO') return 'Informe um número'
  return `Informe um valor de ${fmt(spec.min)} a ${fmt(spec.max)}`
}

function checarFaixa(erros: ErrosTelaPlano, campo: string, valor: string, spec: EspecFaixa, obrigatorio = false) {
  const r = validarFaixa(valor, spec)
  if (r.ok) return
  if (r.motivo === 'VAZIO') {
    if (obrigatorio) erros[campo] = OBRIGATORIO
    return
  }
  erros[campo] = mensagemFaixa(spec, r.motivo)
}

function checarCores(erros: ErrosTelaPlano, campo: string, valor: string) {
  const r = parseCores(valor)
  if (r.ok) return
  erros[campo] =
    r.motivo === 'VAZIO' ? OBRIGATORIO : r.motivo === 'ACIMA' ? `Use de 0 a ${LIMITE_CORES} cores por lado` : 'Use o formato NxM, ex.: 4x0'
}

/** Erros por campo (chave = caminho do campo no estado). Vazio = válido. */
export function validarTelaPlano(estado: EstadoTelaPlano, blocos: BlocosTelaPlano, plano: PlanoLeitura | null): ErrosTelaPlano {
  const erros: ErrosTelaPlano = {}
  if (!estado.tipoPlanoId) erros.tipoPlanoId = OBRIGATORIO
  const nome = estado.nome.trim()
  if (!nome) erros.nome = OBRIGATORIO
  else if (nome.length > MAX_NOME_PLANO) erros.nome = `Use até ${MAX_NOME_PLANO} caracteres`
  checarFaixa(erros, 'ocorrencias', estado.ocorrencias, OCORRENCIAS)
  checarFaixa(erros, 'tiragem', estado.tiragem, TIRAGEM, true)

  checarFaixa(erros, 'formatoAberto.largura', estado.formatoAberto.largura, DIMENSAO_MM_PLANO)
  checarFaixa(erros, 'formatoAberto.altura', estado.formatoAberto.altura, DIMENSAO_MM_PLANO)
  for (const k of ['comprimento', 'largura', 'altura', 'alturaTampa'] as const) {
    checarFaixa(erros, `formatoFinal.${k}`, estado.formatoFinal[k], DIMENSAO_MM_PLANO)
  }
  // O back exige formato > 0. Plano novo precisa do Formato Aberto; o gravado mantém as colunas.
  if (!erros['formatoAberto.largura'] && !erros['formatoAberto.altura']) {
    const l = validarFaixa(estado.formatoAberto.largura, DIMENSAO_MM_PLANO)
    const a = validarFaixa(estado.formatoAberto.altura, DIMENSAO_MM_PLANO)
    const positivo = l.ok && a.ok && l.valor > 0 && a.valor > 0
    const temColunas = !!plano && Number(plano.formatoLarguraMm) > 0 && Number(plano.formatoAlturaMm) > 0
    const algumInformado = estado.formatoAberto.largura.trim() !== '' || estado.formatoAberto.altura.trim() !== ''
    if (!positivo && (!temColunas || algumInformado)) {
      const msg = 'Informe largura e altura maiores que 0'
      if (!(l.ok && l.valor > 0)) erros['formatoAberto.largura'] = msg
      if (!(a.ok && a.valor > 0)) erros['formatoAberto.altura'] = msg
    }
  }

  checarCores(erros, 'cores', estado.cores)
  if (!estado.processoImpressao.trim()) erros.processoImpressao = OBRIGATORIO
  checarFaixa(erros, 'coberturaTinta', estado.coberturaTinta, COBERTURA_PERC)

  if (blocos.capaExterna && !estado.capaExterna.suporteId) erros['capaExterna.suporteId'] = OBRIGATORIO
  if (blocos.microondulado) {
    checarFaixa(erros, 'microondulado.ajusteCorteMicro', estado.microondulado.ajusteCorteMicro, AJUSTE_MICRO_PLANO)
  }
  // Microondulado e capa interna sao opcionais: so valida a capa interna quando ha suporte informado.
  if (blocos.capaInterna && estado.capaInterna.suporteId) {
    checarCores(erros, 'capaInterna.cores', estado.capaInterna.cores)
    if (!estado.capaInterna.processoImpressao.trim()) erros['capaInterna.processoImpressao'] = OBRIGATORIO
    checarFaixa(erros, 'capaInterna.coberturaTinta', estado.capaInterna.coberturaTinta, COBERTURA_PERC)
  }
  if (blocos.principal && !estado.principal.suporteId) erros['principal.suporteId'] = OBRIGATORIO
  return erros
}

/** Rótulos para a mensagem resumida "campo: motivo". */
export const ROTULOS_CAMPOS: Record<string, string> = {
  tipoPlanoId: 'Tipo de Plano',
  nome: 'Nome',
  ocorrencias: 'Ocorrências',
  tiragem: 'Tiragem',
  'formatoAberto.largura': 'Formato Aberto (largura)',
  'formatoAberto.altura': 'Formato Aberto (altura)',
  'formatoFinal.comprimento': 'Formato Final (comprimento)',
  'formatoFinal.largura': 'Formato Final (largura)',
  'formatoFinal.altura': 'Formato Final (altura)',
  'formatoFinal.alturaTampa': 'Formato Final (altura da tampa)',
  cores: 'Cores',
  processoImpressao: 'Processo de Impressão',
  coberturaTinta: 'Cobertura de Tinta',
  'capaExterna.suporteId': 'Suporte da capa externa',
  'microondulado.suporteId': 'Suporte do microondulado',
  'microondulado.ajusteCorteMicro': 'Ajuste Corte Micro',
  'capaInterna.suporteId': 'Suporte da capa interna',
  'capaInterna.cores': 'Cores da capa interna',
  'capaInterna.processoImpressao': 'Processo da capa interna',
  'capaInterna.coberturaTinta': 'Cobertura da capa interna',
  'principal.suporteId': 'Suporte',
}

export function textoErrosPlano(erros: ErrosTelaPlano): string {
  return Object.entries(erros)
    .map(([campo, motivo]) => `${ROTULOS_CAMPOS[campo] ?? campo}: ${motivo}`)
    .join('; ')
}

// ============================================================================
// Corpo do POST/PUT
// ============================================================================

function valorFaixa(valor: string, spec: EspecFaixa): number | null {
  const r = validarFaixa(valor, spec)
  return r.ok ? r.valor : null
}

function textoOuNull(v: string, max = MAX_TEXTO_CURTO): string | null {
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

function suporteParaEspec(b: BlocoSuporteForm): BlocoSuporteEspec {
  return {
    fabricante: textoOuNull(b.fabricante),
    suporteId: b.suporteId,
    suporteNome: b.suporteNome,
    fornecido: b.fornecido,
  }
}

function semNulos(obj: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) saida[k] = v
  return saida
}

/** `especificacao` só com os blocos exibidos (os ocultos vão `null`). */
export function montarEspecificacao(estado: EstadoTelaPlano, blocos: BlocosTelaPlano): EspecificacaoPlanoV1 {
  const n = (v: string) => valorFaixa(v, DIMENSAO_MM_PLANO)
  return {
    versao: 1,
    ocorrencias: valorFaixa(estado.ocorrencias, OCORRENCIAS),
    tiragem: estado.tiragemPropria ? valorFaixa(estado.tiragem, TIRAGEM) : null,
    montagem: textoOuNull(estado.montagem),
    corte: textoOuNull(estado.corte),
    formatoAberto: { largura: n(estado.formatoAberto.largura), altura: n(estado.formatoAberto.altura) },
    formatoFinal: {
      comprimento: n(estado.formatoFinal.comprimento),
      largura: n(estado.formatoFinal.largura),
      altura: n(estado.formatoFinal.altura),
      alturaTampa: n(estado.formatoFinal.alturaTampa),
    },
    cores: textoOuNull(estado.cores),
    processoImpressao: textoOuNull(estado.processoImpressao, MAX_PROCESSO_PLANO),
    coberturaTinta: valorFaixa(estado.coberturaTinta, COBERTURA_PERC),
    capaExterna: blocos.capaExterna
      ? { ...suporteParaEspec(estado.capaExterna), fibra: blocos.fibra ? textoOuNull(estado.capaExterna.fibra) : null }
      : null,
    microondulado: blocos.microondulado
      ? {
          ...suporteParaEspec(estado.microondulado),
          sentidoOnda: textoOuNull(estado.microondulado.sentidoOnda),
          ajusteCorteMicro: valorFaixa(estado.microondulado.ajusteCorteMicro, AJUSTE_MICRO_PLANO),
        }
      : null,
    capaInterna: blocos.capaInterna
      ? {
          ...suporteParaEspec(estado.capaInterna),
          cores: textoOuNull(estado.capaInterna.cores),
          processoImpressao: textoOuNull(estado.capaInterna.processoImpressao, MAX_PROCESSO_PLANO),
          coberturaTinta: valorFaixa(estado.capaInterna.coberturaTinta, COBERTURA_PERC),
        }
      : null,
    suportePrincipal: blocos.principal ? suporteParaEspec(estado.principal) : null,
  }
}

/**
 * Corpo do POST/PUT (`planoBodySchema` do back): nome ≤ 60, formato > 0, numCores 0..12, sem
 * `null` dentro de `cores`/`acabamentosRicos`. Chamar só depois de `validarTelaPlano` sem erros.
 */
export function montarBodyTelaPlano(
  estado: EstadoTelaPlano,
  blocos: BlocosTelaPlano,
  plano: PlanoLeitura | null,
  posicaoApos?: string | null,
): Record<string, unknown> {
  const cores = parseCores(estado.cores)
  const numCores = cores.ok ? Math.min(LIMITE_CORES, cores.frente + cores.verso) : Math.trunc(Number(plano?.numCores ?? 0)) || 0
  const l = valorFaixa(estado.formatoAberto.largura, DIMENSAO_MM_PLANO)
  const a = valorFaixa(estado.formatoAberto.altura, DIMENSAO_MM_PLANO)
  const usarAberto = l !== null && a !== null && l > 0 && a > 0
  const suporteColuna = estado[blocoDoSuporteColuna(blocos)].suporteId

  const body: Record<string, unknown> = {
    nome: estado.nome.trim().slice(0, MAX_NOME_PLANO),
    tipoPlanoId: estado.tipoPlanoId,
    suporteId: suporteColuna,
    formatoLarguraMm: usarAberto ? l : Number(plano?.formatoLarguraMm ?? 0),
    formatoAlturaMm: usarAberto ? a : Number(plano?.formatoAlturaMm ?? 0),
    numCores,
    acabamentosRicos: estado.acabamentosRicos.map((ac) => semNulos(ac as unknown as Record<string, unknown>)),
    especificacao: montarEspecificacao(estado, blocos),
  }
  if (estado.gramatura !== null && estado.gramatura > 0) body.gramatura = estado.gramatura
  if (plano) {
    // Campos sem tela: seguem como estavam gravados.
    body.suporteProducaoId = plano.suporteProducaoId ?? null
    body.maquinaId = plano.maquinaId ?? null
  }
  // Tintas da janela (lista vazia = sem tinta no plano).
  body.cores = estado.tintas.map((c) => semNulos(c as unknown as Record<string, unknown>))
  // Janela Pré-Impressão (ausente = não altera o que já está gravado).
  if (estado.preImpressao) body.preImpressao = estado.preImpressao
  if (posicaoApos) body.posicaoApos = posicaoApos
  return body
}

/** Houve mudança desde a abertura? (abrir e OK sem mudança não grava). */
export function houveMudanca(inicial: EstadoTelaPlano, atual: EstadoTelaPlano): boolean {
  return JSON.stringify(inicial) !== JSON.stringify(atual)
}
