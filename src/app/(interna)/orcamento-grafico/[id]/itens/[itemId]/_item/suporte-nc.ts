/**
 * suporte-nc — módulo PURO do "Suporte Não Cadastrado" (botão NC, R12).
 *
 * Estado do formulário em TEXTO (como digitado), validação por campo com os presets de
 * `validar-faixa`, montagem do body de `POST /orcamento-grafico/suportes-nao-cadastrados`,
 * leitura da resposta (CRIADO / DUPLICADO) e tradução do erro do servidor.
 * Sem React, sem rede.
 */

import {
  DIMENSAO_MM,
  NC_CREDITO_PERC,
  NC_CUSTO_KG,
  NC_ESPESSURA_GM,
  NC_ESPESSURA_MICRAS,
  NC_FRETE_KG,
  NC_GRAMATURA,
  NC_PACOTES_COM,
  validarFaixa,
  type EspecFaixa,
  type MotivoFaixa,
} from '../../../_validacao/validar-faixa'

export const MAX_NOME_NC = 120
export const MAX_FIBRA_NC = 40
export const MENSAGEM_NAO_CRIADO = 'O suporte não foi criado.'

export interface EstadoSuporteNc {
  nome: string
  gramatura: string
  espessuraGm: string
  espessuraMicras: string
  formatoLarguraMm: string
  formatoAlturaMm: string
  fibra: string
  tiraRetira: boolean
  /** Id de um suporte existente que define o Consumo de Tinta ('' = nenhum). */
  tipoSuporteConsumoTintaId: string
  unidadeCustoKg: boolean
  unidadeCalculoFl: boolean
  custoKg: string
  freteKg: string
  pacotesCom: string
  creditoIcmsPerc: string
  creditoIpiPerc: string
}

export type CampoSuporteNc = keyof EstadoSuporteNc
export type ErrosSuporteNc = Partial<Record<CampoSuporteNc, string>>

export function estadoSuporteNcVazio(): EstadoSuporteNc {
  return {
    nome: '',
    gramatura: '',
    espessuraGm: '',
    espessuraMicras: '',
    formatoLarguraMm: '',
    formatoAlturaMm: '',
    fibra: '',
    tiraRetira: false,
    tipoSuporteConsumoTintaId: '',
    unidadeCustoKg: true,
    unidadeCalculoFl: true,
    custoKg: '',
    freteKg: '',
    pacotesCom: '',
    creditoIcmsPerc: '',
    creditoIpiPerc: '',
  }
}

// ─── Validação ──────────────────────────────────────────────────────────────

const fmt = (n: number, casas: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

function mensagemFaixa(motivo: MotivoFaixa, spec: EspecFaixa, unidade = ''): string {
  const u = unidade ? ` ${unidade}` : ''
  switch (motivo) {
    case 'VAZIO':
      return 'Campo obrigatório.'
    case 'NAO_NUMERICO':
      return 'Informe um número válido.'
    case 'CASAS':
      return spec.casas === 0 ? 'Informe um número inteiro.' : `Use no máximo ${spec.casas} casas decimais.`
    case 'ABAIXO':
      return `Valor mínimo: ${fmt(spec.min, spec.casas)}${u}.`
    case 'ACIMA':
      return `Valor máximo: ${fmt(spec.max, spec.casas)}${u}.`
  }
}

interface EspecCampo {
  campo: CampoSuporteNc
  spec: EspecFaixa
  obrigatorio: boolean
  unidade?: string
}

const CAMPOS_NUMERICOS: EspecCampo[] = [
  { campo: 'gramatura', spec: NC_GRAMATURA, obrigatorio: true, unidade: 'g/m²' },
  { campo: 'custoKg', spec: NC_CUSTO_KG, obrigatorio: true, unidade: 'R$/kg' },
  { campo: 'espessuraGm', spec: NC_ESPESSURA_GM, obrigatorio: false },
  { campo: 'espessuraMicras', spec: NC_ESPESSURA_MICRAS, obrigatorio: false, unidade: 'micras' },
  { campo: 'formatoLarguraMm', spec: DIMENSAO_MM, obrigatorio: false, unidade: 'mm' },
  { campo: 'formatoAlturaMm', spec: DIMENSAO_MM, obrigatorio: false, unidade: 'mm' },
  { campo: 'freteKg', spec: NC_FRETE_KG, obrigatorio: false, unidade: 'R$/kg' },
  { campo: 'pacotesCom', spec: NC_PACOTES_COM, obrigatorio: false },
  { campo: 'creditoIcmsPerc', spec: NC_CREDITO_PERC, obrigatorio: false, unidade: '%' },
  { campo: 'creditoIpiPerc', spec: NC_CREDITO_PERC, obrigatorio: false, unidade: '%' },
]

/** Valida o estado inteiro; devolve o motivo de cada campo inválido (vazio = tudo certo). */
export function validarSuporteNc(estado: EstadoSuporteNc): ErrosSuporteNc {
  const erros: ErrosSuporteNc = {}

  const nome = estado.nome.trim()
  if (nome === '') erros.nome = 'Campo obrigatório.'
  else if (nome.length > MAX_NOME_NC) erros.nome = `Use no máximo ${MAX_NOME_NC} caracteres.`

  if (estado.fibra.trim().length > MAX_FIBRA_NC) erros.fibra = `Use no máximo ${MAX_FIBRA_NC} caracteres.`

  for (const { campo, spec, obrigatorio, unidade } of CAMPOS_NUMERICOS) {
    const texto = String(estado[campo] ?? '')
    if (!obrigatorio && texto.trim() === '') continue
    const r = validarFaixa(texto, spec)
    if (!r.ok) erros[campo] = mensagemFaixa(r.motivo, spec, unidade)
  }
  return erros
}

// ─── Body ───────────────────────────────────────────────────────────────────

export interface BodySuporteNc {
  nome: string
  gramatura: number
  custoKg: number
  tiraRetira: boolean
  unidadeCustoKg: boolean
  unidadeCalculoFl: boolean
  espessuraGm?: number
  espessuraMicras?: number
  formatoLarguraMm?: number
  formatoAlturaMm?: number
  fibra?: string
  tipoSuporteConsumoTintaId?: string
  freteKg?: number
  pacotesCom?: number
  creditoIcmsPerc?: number
  creditoIpiPerc?: number
  confirmarExistente?: boolean
}

function numeroDe(texto: string, spec: EspecFaixa): number | undefined {
  if (texto.trim() === '') return undefined
  const r = validarFaixa(texto, spec)
  return r.ok ? r.valor : undefined
}

/**
 * Monta o body a partir de um estado já validado. Campos opcionais vazios são omitidos; os
 * números vêm de `validarFaixa` (parse por dígitos, sem float errado).
 */
export function montarBodySuporteNc(estado: EstadoSuporteNc, confirmarExistente = false): BodySuporteNc {
  const gramatura = validarFaixa(estado.gramatura, NC_GRAMATURA)
  const custo = validarFaixa(estado.custoKg, NC_CUSTO_KG)
  const body: BodySuporteNc = {
    nome: estado.nome.trim(),
    gramatura: gramatura.ok ? gramatura.valor : 0,
    custoKg: custo.ok ? custo.valor : 0,
    tiraRetira: estado.tiraRetira,
    unidadeCustoKg: estado.unidadeCustoKg,
    unidadeCalculoFl: estado.unidadeCalculoFl,
  }
  const opcionais: Array<[keyof BodySuporteNc, number | undefined]> = [
    ['espessuraGm', numeroDe(estado.espessuraGm, NC_ESPESSURA_GM)],
    ['espessuraMicras', numeroDe(estado.espessuraMicras, NC_ESPESSURA_MICRAS)],
    ['formatoLarguraMm', numeroDe(estado.formatoLarguraMm, DIMENSAO_MM)],
    ['formatoAlturaMm', numeroDe(estado.formatoAlturaMm, DIMENSAO_MM)],
    ['freteKg', numeroDe(estado.freteKg, NC_FRETE_KG)],
    ['pacotesCom', numeroDe(estado.pacotesCom, NC_PACOTES_COM)],
    ['creditoIcmsPerc', numeroDe(estado.creditoIcmsPerc, NC_CREDITO_PERC)],
    ['creditoIpiPerc', numeroDe(estado.creditoIpiPerc, NC_CREDITO_PERC)],
  ]
  for (const [chave, valor] of opcionais) {
    if (valor !== undefined) (body as unknown as Record<string, unknown>)[chave] = valor
  }
  if (estado.fibra.trim() !== '') body.fibra = estado.fibra.trim()
  if (estado.tipoSuporteConsumoTintaId) body.tipoSuporteConsumoTintaId = estado.tipoSuporteConsumoTintaId
  if (confirmarExistente) body.confirmarExistente = true
  return body
}

// ─── Resposta ───────────────────────────────────────────────────────────────

export interface SuporteNcCriado {
  suporteId: string
  precoId: string
  nome: string
  gramatura: number
  custoKg: number
}

export interface SuporteNcDuplicado {
  suporteId: string
  nome: string
  gramatura: number
}

export type RespostaSuporteNc =
  | { tipo: 'CRIADO'; criado: SuporteNcCriado; provisorio: boolean }
  | { tipo: 'DUPLICADO'; duplicado: SuporteNcDuplicado }
  | { tipo: 'INVALIDA' }

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Lê o corpo de um 200/201. O estado é a fonte de nome, gramatura e custo quando a resposta não os traz. */
export function interpretarRespostaSuporteNc(data: unknown, estado: EstadoSuporteNc): RespostaSuporteNc {
  const d = (data ?? {}) as Record<string, unknown>
  if (d.resultado === 'DUPLICADO' && typeof d.suporteId === 'string') {
    return {
      tipo: 'DUPLICADO',
      duplicado: {
        suporteId: d.suporteId,
        nome: typeof d.nome === 'string' && d.nome ? d.nome : estado.nome.trim(),
        gramatura: num(d.gramatura) ?? 0,
      },
    }
  }
  if (d.resultado === 'CRIADO' && typeof d.suporteId === 'string' && typeof d.precoId === 'string') {
    const gram = validarFaixa(estado.gramatura, NC_GRAMATURA)
    const custo = validarFaixa(estado.custoKg, NC_CUSTO_KG)
    return {
      tipo: 'CRIADO',
      provisorio: d.provisorio !== false,
      criado: {
        suporteId: d.suporteId,
        precoId: d.precoId,
        nome: typeof d.nome === 'string' && d.nome ? d.nome : estado.nome.trim(),
        gramatura: num(d.gramatura) ?? (gram.ok ? gram.valor : 0),
        custoKg: num(d.custoKg) ?? (custo.ok ? custo.valor : 0),
      },
    }
  }
  return { tipo: 'INVALIDA' }
}

// ─── Erros ──────────────────────────────────────────────────────────────────

export interface ErroServidorSuporteNc {
  /** Presente só no 400 com campo conhecido do formulário. */
  campoErro?: { campo: CampoSuporteNc; motivo: string }
  /** Texto para exibir no Alert / junto do campo. */
  mensagem: string
}

const CAMPOS_CONHECIDOS: ReadonlySet<string> = new Set<CampoSuporteNc>(
  Object.keys(estadoSuporteNcVazio()) as CampoSuporteNc[],
)

const capitalizar = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

function motivoLimpo(motivo: unknown, mensagem: string | null, campo: string): string {
  const bruto =
    typeof motivo === 'string' && motivo.trim() !== ''
      ? motivo.trim()
      : (mensagem ?? '').replace(new RegExp(`^${campo}:\\s*`), '').trim()
  return capitalizar(bruto || 'valor inválido')
}

/**
 * Traduz o erro de rede/HTTP. 400 com `issues`/`campo` conhecido vira `campoErro` (chave do
 * estado + motivo); 500, rede e 400 sem campo conhecido viram "O suporte não foi criado." + detalhe.
 */
export function erroDoServidor(err: unknown): ErroServidorSuporteNc {
  const e = err as { response?: { status?: unknown; data?: unknown }; message?: unknown } | null
  const status = typeof e?.response?.status === 'number' ? e.response.status : null
  const dados = e?.response?.data && typeof e.response.data === 'object' ? (e.response.data as Record<string, unknown>) : null
  const mensagemBack = typeof dados?.message === 'string' && dados.message.trim() !== '' ? dados.message.trim() : null
  const detalhe = mensagemBack ?? (typeof e?.message === 'string' && e.message.trim() !== '' ? e.message.trim() : null)
  const geral = `${MENSAGEM_NAO_CRIADO}${detalhe ? ` ${detalhe}` : ''}`

  if (status === 400 && dados) {
    const issues = Array.isArray(dados.issues) ? (dados.issues as Array<{ campo?: unknown; motivo?: unknown }>) : []
    for (const i of issues) {
      if (typeof i?.campo === 'string' && CAMPOS_CONHECIDOS.has(i.campo)) {
        const motivo = motivoLimpo(i.motivo, mensagemBack, i.campo)
        return { campoErro: { campo: i.campo as CampoSuporteNc, motivo }, mensagem: motivo }
      }
    }
    if (typeof dados.campo === 'string' && CAMPOS_CONHECIDOS.has(dados.campo)) {
      const motivo = motivoLimpo(null, mensagemBack, dados.campo)
      return { campoErro: { campo: dados.campo as CampoSuporteNc, motivo }, mensagem: motivo }
    }
  }
  return { mensagem: geral }
}
