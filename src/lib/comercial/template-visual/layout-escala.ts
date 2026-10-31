/**
 * Escala pt→px e clamp do canvas (espelho do clamp do backend).
 * Spec comercial-editor-visual-templates. A escala garante a fidelidade
 * preview↔PDF (Req 4.3): px = pt × escala, com escala = larguraCanvasPx / 595.
 */
import { A4_LARGURA_PT, type Elemento, type Pagina } from './layout-tipos'

/** Converte um valor em pt para px, dada a escala do canvas. */
export function ptParaPx(valorPt: number, escala: number): number {
  return valorPt * escala
}

/** Converte px de volta para pt (drag/resize do canvas → layout). */
export function pxParaPt(valorPx: number, escala: number): number {
  return escala > 0 ? valorPx / escala : valorPx
}

/** Escala a partir da largura do canvas em px (A4 = 595pt de largura). */
export function escalaDoCanvas(larguraCanvasPx: number): number {
  return larguraCanvasPx / A4_LARGURA_PT
}

/**
 * Restringe um Elemento à área útil da página (dentro das margens) — mesma
 * regra do backend (clampElemento). Req 1.3.
 */
export function clampElemento(el: Elemento, pagina: Pagina): Elemento {
  const areaX0 = pagina.margemEsquerdaPt
  const areaY0 = pagina.margemTopoPt
  const areaX1 = pagina.larguraPt - pagina.margemDireitaPt
  const areaY1 = pagina.alturaPt - pagina.margemBaixoPt
  const areaLargura = Math.max(0, areaX1 - areaX0)
  const areaAltura = Math.max(0, areaY1 - areaY0)

  const larguraPt = Math.max(0, Math.min(el.larguraPt, areaLargura))
  const alturaPt = Math.max(0, Math.min(el.alturaPt, areaAltura))
  const xPt = Math.min(Math.max(el.xPt, areaX0), areaX1 - larguraPt)
  const yPt = Math.min(Math.max(el.yPt, areaY0), areaY1 - alturaPt)

  return { ...el, xPt, yPt, larguraPt, alturaPt }
}
