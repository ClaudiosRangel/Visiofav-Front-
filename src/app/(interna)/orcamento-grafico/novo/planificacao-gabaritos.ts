/**
 * Gerador de planificação ESQUEMÁTICA (contorno da caixa aberta) por família.
 * Puramente visual — reproduz a "cara" do plano de corte a partir de L×A×P +
 * aba padrão. NÃO é a faca técnica real (ver spec
 * orcamento-grafico-planificacao-visual, opção (a)).
 *
 * Saída em coordenadas mm com origem no canto superior-esquerdo. O consumidor
 * (EncaixeVisual) escala para o tamanho da célula. Corte = contorno externo
 * sólido; Vinco = dobras tracejadas.
 */

export type GabaritoId = 'CARTUCHO' | 'CAIXA_FUNDO_AUTO' | 'CARTELA' | 'RETANGULO'

export interface PlanParams {
  gabarito: GabaritoId
  L: number // largura (mm)
  A: number // altura (mm)
  P: number // profundidade (mm)
  abaMm?: number // aba de colagem/fecho (mm)
  sangriaMm?: number
}

export interface PlanPath {
  d: string // path SVG (em mm)
  tipo: 'CORTE' | 'VINCO'
}

export interface Planificacao {
  larguraMm: number
  alturaMm: number
  paths: PlanPath[]
}

const rect = (x: number, y: number, w: number, h: number): string =>
  `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`

const vLine = (x: number, y1: number, y2: number): string => `M ${x} ${y1} V ${y2}`
const hLine = (y: number, x1: number, x2: number): string => `M ${x1} ${y} H ${x2}`

/** Retângulo simples (fallback / cartela plana). */
function gabRetangulo(w: number, h: number): Planificacao {
  return { larguraMm: w, alturaMm: h, paths: [{ d: rect(0, 0, w, h), tipo: 'CORTE' }] }
}

/**
 * CARTUCHO (caixa reta tipo medicamento, como o Cerumin):
 * 4 painéis em linha [L, P, L, P] + aba de colagem lateral; abas de topo e
 * fundo em cada painel. Vincos verticais entre painéis e horizontais nas abas.
 */
function gabCartucho(L: number, A: number, P: number, aba: number): Planificacao {
  const paineis = [L, P, L, P]
  const corpoLargura = paineis.reduce((s, v) => s + v, 0)
  const larguraTotal = corpoLargura + aba // aba de colagem à direita
  const abaTopo = Math.max(8, Math.min(P, A * 0.35)) // altura das abas de topo/fundo
  const alturaTotal = A + 2 * abaTopo

  const paths: PlanPath[] = []

  // Corpo (os 4 painéis) — contorno do bloco central
  paths.push({ d: rect(0, abaTopo, corpoLargura, A), tipo: 'CORTE' })

  // Aba de colagem lateral (à direita, altura do corpo)
  const abaColW = aba
  if (abaColW > 0) {
    paths.push({ d: rect(corpoLargura, abaTopo + 2, abaColW, A - 4), tipo: 'CORTE' })
    paths.push({ d: vLine(corpoLargura, abaTopo, abaTopo + A), tipo: 'VINCO' })
  }

  // Vincos verticais entre os painéis
  let x = 0
  for (let i = 0; i < paineis.length - 1; i++) {
    x += paineis[i]
    paths.push({ d: vLine(x, abaTopo, abaTopo + A), tipo: 'VINCO' })
  }

  // Abas de topo e fundo (uma por painel) + vincos horizontais
  x = 0
  for (const w of paineis) {
    // aba de topo (ligeiramente recuada para dar o aspecto de língua)
    paths.push({ d: rect(x + 2, 0, w - 4, abaTopo), tipo: 'CORTE' })
    // aba de fundo
    paths.push({ d: rect(x + 2, abaTopo + A, w - 4, abaTopo), tipo: 'CORTE' })
    x += w
  }
  paths.push({ d: hLine(abaTopo, 0, corpoLargura), tipo: 'VINCO' })
  paths.push({ d: hLine(abaTopo + A, 0, corpoLargura), tipo: 'VINCO' })

  return { larguraMm: larguraTotal, alturaMm: alturaTotal, paths }
}

/** CAIXA_FUNDO_AUTO: corpo do cartucho com abas de fundo maiores (trapézios). */
function gabCaixaFundoAuto(L: number, A: number, P: number, aba: number): Planificacao {
  const base = gabCartucho(L, A, P, aba)
  // Reaproveita o cartucho; o fundo "automático" é representado por abas de
  // fundo mais altas — aqui mantemos o esquema do cartucho (suficiente p/ visual).
  return base
}

/** CARTELA: plano com cantos arredondados (aproxima com retângulo + furo opcional). */
function gabCartela(L: number, A: number): Planificacao {
  const paths: PlanPath[] = [{ d: rect(0, 0, L, A), tipo: 'CORTE' }]
  // Furo de pendurar (euro-hole) no topo, se couber
  if (L > 20 && A > 20) {
    const cx = L / 2
    const r = Math.min(6, L * 0.08)
    const cy = Math.max(6, A * 0.08)
    paths.push({ d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`, tipo: 'CORTE' })
  }
  return { larguraMm: L, alturaMm: A, paths }
}

export function gerarPlanificacao(p: PlanParams): Planificacao {
  const L = Number(p.L) || 0
  const A = Number(p.A) || 0
  const P = Number(p.P) || 0
  const aba = p.abaMm != null && p.abaMm > 0 ? p.abaMm : Math.max(8, L * 0.15)

  // Degradação graciosa: medidas inválidas → retângulo do que houver.
  if (L <= 0 || A <= 0) {
    return gabRetangulo(Math.max(L, 1), Math.max(A, 1))
  }

  switch (p.gabarito) {
    case 'CARTUCHO':
      return P > 0 ? gabCartucho(L, A, P, aba) : gabRetangulo(L, A)
    case 'CAIXA_FUNDO_AUTO':
      return P > 0 ? gabCaixaFundoAuto(L, A, P, aba) : gabRetangulo(L, A)
    case 'CARTELA':
      return gabCartela(L, A)
    case 'RETANGULO':
    default:
      return gabRetangulo(L, A)
  }
}
