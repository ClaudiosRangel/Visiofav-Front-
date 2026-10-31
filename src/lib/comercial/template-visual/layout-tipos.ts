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
