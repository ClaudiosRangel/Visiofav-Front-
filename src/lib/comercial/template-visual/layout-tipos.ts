/**
 * Tipos do Layout_JSON (espelho do backend). Coordenadas em pt (A4 = 595×842).
 * Spec comercial-editor-visual-templates.
 */
export type TipoTemplate = 'ORCAMENTO' | 'PROPOSTA'

export const A4_LARGURA_PT = 595
export const A4_ALTURA_PT = 842

export type TipoElemento =
  | 'LOGO' | 'TEXTO' | 'CAMPO_DINAMICO' | 'TABELA'
  | 'LINHA' | 'BLOCO_CONDICOES' | 'ASSINATURA'

export const TIPOS_ELEMENTO: readonly TipoElemento[] = [
  'LOGO', 'TEXTO', 'CAMPO_DINAMICO', 'TABELA', 'LINHA', 'BLOCO_CONDICOES', 'ASSINATURA',
] as const

export type Alinhamento = 'left' | 'center' | 'right'

export interface EstiloTexto {
  fonte: 'Helvetica' | 'Helvetica-Bold'
  tamanhoPt: number
  alinhamento: Alinhamento
  negrito: boolean
  cor: string
}

export interface ColunaTabela {
  titulo: string
  binding: string
  larguraPt: number
  alinhamento: Alinhamento
}

export interface Elemento {
  id: string
  tipo: TipoElemento
  xPt: number
  yPt: number
  larguraPt: number
  alturaPt: number
  estilo?: EstiloTexto
  textoEstatico?: string
  binding?: string
  tabela?: { fonteDados: 'itens' | 'variacoes'; colunas: ColunaTabela[] }
  rotuloAssinatura?: string
}

export interface Pagina {
  larguraPt: number
  alturaPt: number
  margemTopoPt: number
  margemBaixoPt: number
  margemEsquerdaPt: number
  margemDireitaPt: number
}

export interface LayoutDocumento {
  versao: 1
  pagina: Pagina
  elementos: Elemento[]
}

export function paginaA4Padrao(): Pagina {
  return {
    larguraPt: A4_LARGURA_PT,
    alturaPt: A4_ALTURA_PT,
    margemTopoPt: 40,
    margemBaixoPt: 40,
    margemEsquerdaPt: 40,
    margemDireitaPt: 40,
  }
}

/**
 * Normaliza um Layout_JSON possivelmente parcial/inválido vindo do backend,
 * SEM lançar — garante `pagina` completa e `elementos` como array de elementos
 * válidos. Evita que o canvas/preview acessem campos undefined (causa de loop
 * de render/crash).
 */
export function normalizarLayout(raw: unknown): LayoutDocumento {
  const obj = (raw ?? {}) as Record<string, unknown>
  const padrao = paginaA4Padrao()
  const pr = (obj.pagina ?? {}) as Record<string, unknown>
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def)
  const pagina: Pagina = {
    larguraPt: num(pr.larguraPt, padrao.larguraPt),
    alturaPt: num(pr.alturaPt, padrao.alturaPt),
    margemTopoPt: num(pr.margemTopoPt, padrao.margemTopoPt),
    margemBaixoPt: num(pr.margemBaixoPt, padrao.margemBaixoPt),
    margemEsquerdaPt: num(pr.margemEsquerdaPt, padrao.margemEsquerdaPt),
    margemDireitaPt: num(pr.margemDireitaPt, padrao.margemDireitaPt),
  }
  const elsRaw = Array.isArray(obj.elementos) ? obj.elementos : []
  const elementos: Elemento[] = elsRaw
    .map((e, i) => {
      const o = (e ?? {}) as Record<string, unknown>
      if (!TIPOS_ELEMENTO.includes(o.tipo as TipoElemento)) return null
      return {
        id: typeof o.id === 'string' && o.id ? o.id : `el-${i}`,
        tipo: o.tipo as TipoElemento,
        xPt: num(o.xPt, 0),
        yPt: num(o.yPt, 0),
        larguraPt: num(o.larguraPt, 100),
        alturaPt: num(o.alturaPt, 20),
        estilo: (o.estilo as EstiloTexto | undefined) ?? undefined,
        textoEstatico: typeof o.textoEstatico === 'string' ? o.textoEstatico : undefined,
        binding: typeof o.binding === 'string' ? o.binding : undefined,
        tabela: (o.tabela as Elemento['tabela']) ?? undefined,
        rotuloAssinatura: typeof o.rotuloAssinatura === 'string' ? o.rotuloAssinatura : undefined,
      } as Elemento
    })
    .filter((e): e is Elemento => e !== null)
  return { versao: 1, pagina, elementos }
}

export function estiloPadrao(over: Partial<EstiloTexto> = {}): EstiloTexto {
  return {
    fonte: over.fonte ?? 'Helvetica',
    tamanhoPt: over.tamanhoPt ?? 10,
    alinhamento: over.alinhamento ?? 'left',
    negrito: over.negrito ?? false,
    cor: over.cor ?? '#000000',
  }
}

/** Valores iniciais de um elemento recém-inserido da paleta (Req 2.2). */
export function elementoInicial(tipo: TipoElemento, id: string): Elemento {
  const base: Elemento = { id, tipo, xPt: 60, yPt: 60, larguraPt: 200, alturaPt: 24 }
  switch (tipo) {
    case 'LOGO':
      return { ...base, larguraPt: 120, alturaPt: 48 }
    case 'TEXTO':
      return { ...base, textoEstatico: 'Texto', estilo: estiloPadrao() }
    case 'CAMPO_DINAMICO':
      return { ...base, binding: '{{cliente.nome}}', estilo: estiloPadrao() }
    case 'BLOCO_CONDICOES':
      return { ...base, alturaPt: 80, textoEstatico: 'Condições comerciais...', estilo: estiloPadrao({ tamanhoPt: 9 }) }
    case 'LINHA':
      return { ...base, alturaPt: 0, estilo: estiloPadrao({ cor: '#cccccc' }) }
    case 'ASSINATURA':
      return { ...base, larguraPt: 260, alturaPt: 20, rotuloAssinatura: 'Assinatura do Cliente', estilo: estiloPadrao({ tamanhoPt: 9 }) }
    case 'TABELA':
      return {
        ...base, larguraPt: 420, alturaPt: 100, estilo: estiloPadrao(),
        tabela: {
          fonteDados: 'variacoes',
          colunas: [
            { titulo: 'Quantidade', binding: 'quantidade', larguraPt: 140, alinhamento: 'left' },
            { titulo: 'Unitário', binding: 'precoUnitario', larguraPt: 140, alinhamento: 'left' },
            { titulo: 'Total', binding: 'precoTotal', larguraPt: 140, alinhamento: 'left' },
          ],
        },
      }
    default:
      return base
  }
}
