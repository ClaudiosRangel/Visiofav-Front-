/**
 * Editor do Cálculo — tipos da API e funções puras da tela (spec orcamento-editor-calculo).
 * O cálculo é sempre do servidor; aqui só montagem de dados para exibir e enviar.
 */

export type PapelFolha = 'CAPA' | 'MICRO' | 'CAPA_INTERNA' | 'AVULSO'

export interface ImpressaoFolha {
  cores?: string | null
  processoImpressao?: string | null
  coberturaTinta?: number | string | null
  maquinaId?: string | null
  numCores?: number
  tintas?: Array<Record<string, unknown>>
}

export interface OpcoesFolha {
  naoCalcular?: boolean
  naoCobrarImpressao?: boolean
  naoExibirProposta?: boolean
  tiraRetira?: boolean
  pinca?: boolean
  refileFolha?: number | null
  refileFinal?: number | null
  contraPinca?: number | null
  corteDuplo?: number | null
}

export interface SuporteNc {
  nome?: string
  gramatura?: number | null
  espessura?: number | null
  formato?: string | null
  custoKg?: number | null
  freteKg?: number | null
  creditoIcms?: number | null
  creditoIpi?: number | null
}

export interface FolhaApi {
  id: string
  planoId: string | null
  papel: PapelFolha
  sequencia: number
  nome: string
  nomeExibido: string
  tiragem: number | null
  ocorrencias: number
  fibra: string | null
  formatoLarguraMm: number | null
  formatoAlturaMm: number | null
  formatoFolhaLarguraMm: number | null
  formatoFolhaAlturaMm: number | null
  suporteId: string | null
  suporteNome: string | null
  gramatura: number | null
  suporteNc: SuporteNc | null
  aproveitamento: number | null
  quebraFixa: number | null
  quebraVariavel: number | null
  apara: number | null
  impressao: ImpressaoFolha[] | null
  opcoes: OpcoesFolha | null
  camposManuais: string[]
  alteradaNoEditor: boolean
  custoTotal: number | null
  resultadoCalculo?: { encaixe?: { aproveitamento?: number; folhasNecessarias?: number } } | null
}

export interface DetalhesAtividade {
  tiragem?: number | null
  producaoHora?: number | null
  entradas?: number | null
  repeticoes?: string | null
  tempoPrimeiroAcertoMin?: number | null
  quantAcertos?: number | null
  tempoPorAcertoMin?: number | null
  quebraFixa?: number | null
  quebraVariavel?: number | null
  formatoCorte?: string | null
}

export interface MaterialAtividade {
  materialAcabamentoId: string
  medida?: string | null
  coberturaFrente?: number | null
  coberturaVerso?: number | null
}

export interface AtividadeApi {
  id: string
  folhaId: string | null
  acabamentoId: string
  nome: string
  sequencia: number
  detalhes: DetalhesAtividade | null
  materiais: MaterialAtividade[] | null
  infoComplementar: string | null
  camposManuais: string[]
}

export interface VisaoEditor {
  item: {
    id: string
    descricao: string | null
    tiragem: number
    siglaAcabado: string | null
    medidas: Record<string, number> | null
    custoProducao: number | null
    valorTotal: number | null
    numeroOrcamento: number | null
    editavel: boolean
  }
  linhaProduto: string | null
  modelo: string
  calculoOrigem: number | null
  gerado: boolean
  folhas: FolhaApi[]
  atividades: AtividadeApi[]
  custoFolhas: number
}

export const ROTULO_PAPEL: Record<PapelFolha, string> = {
  CAPA: 'Capa',
  MICRO: 'Microondulado',
  CAPA_INTERNA: 'Capa interna',
  AVULSO: 'Incluído no Editor',
}

/** Atividades agrupadas: uma linha por atividade, com os planos em que ela roda ("Aplicado sobre"). Puro. */
export function aplicadoSobre(atividades: readonly AtividadeApi[]): Map<string, { nome: string; folhaIds: string[]; produto: boolean }> {
  const m = new Map<string, { nome: string; folhaIds: string[]; produto: boolean }>()
  for (const a of [...atividades].sort((x, y) => x.sequencia - y.sequencia)) {
    const atual = m.get(a.acabamentoId) ?? { nome: a.nome, folhaIds: [], produto: false }
    if (a.folhaId === null) atual.produto = true
    else if (!atual.folhaIds.includes(a.folhaId)) atual.folhaIds.push(a.folhaId)
    m.set(a.acabamentoId, atual)
  }
  return m
}

/** Corpo do PUT de atividades a partir do mapa da tela. Puro. */
export function corpoAtividades(mapa: ReadonlyMap<string, { folhaIds: string[] }>) {
  return { atividades: [...mapa.entries()].map(([acabamentoId, v]) => ({ acabamentoId, folhaIds: [...v.folhaIds] })) }
}

const fmt = (n: number | null | undefined) => (n == null ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }))

export function textoFormato(l: number | null | undefined, a: number | null | undefined): string {
  return l && a ? `${fmt(l)} x ${fmt(a)}` : '—'
}

/** "6x0 · Offset Plana" da 1ª impressão da folha; "—" sem impressão. Puro. */
export function textoImpressao(f: Pick<FolhaApi, 'impressao' | 'papel'>): string {
  const i = f.impressao?.[0]
  if (!i || f.papel === 'MICRO') return '—'
  const partes = [i.cores || (i.numCores ? `${i.numCores} cor(es)` : ''), i.processoImpressao || ''].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : '—'
}

/** Texto "x,yy x z" → [x, z] em mm; inválido → null. Puro. */
export function lerFormato(texto: string): [number, number] | null {
  const m = texto.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.').match(/^(\d+(?:\.\d+)?)[xX×](\d+(?:\.\d+)?)$/)
  if (!m) return null
  const l = Number(m[1])
  const a = Number(m[2])
  return l > 0 && a > 0 ? [l, a] : null
}

export const moeda = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
