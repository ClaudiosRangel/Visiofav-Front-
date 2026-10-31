'use client'

/**
 * CanvasA4 — canvas WYSIWYG com arrastar/redimensionar (react-moveable).
 * Spec comercial-editor-visual-templates (Req 1.1/1.2/1.3/1.6/4.4).
 *
 * Renderiza o preview (DOM absoluto, escala pt→px) e sobrepõe o Moveable ao
 * elemento selecionado para arrastar (atualiza x/y) e redimensionar (atualiza
 * largura/altura), com clamp à área útil da página.
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import Moveable from 'react-moveable'
import type { ContextoGeracao } from '@/lib/comercial/template-visual/binding-resolver'
import type { Elemento, LayoutDocumento } from '@/lib/comercial/template-visual/layout-tipos'
import { clampElemento, escalaDoCanvas, ptParaPx, pxParaPt } from '@/lib/comercial/template-visual/layout-escala'
import RenderizadorPreview from './RenderizadorPreview'

interface Props {
  layout: LayoutDocumento
  contexto: ContextoGeracao
  logoSrc?: string | null
  selecionadoId: string | null
  onSelecionar: (id: string | null) => void
  onAlterarElemento: (el: Elemento) => void
  /** Largura desejada do canvas em px (escala derivada daí). */
  larguraPx?: number
}

export default function CanvasA4({
  layout, contexto, logoSrc, selecionadoId, onSelecionar, onAlterarElemento, larguraPx = 595,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [targets, setTargets] = useState<Record<string, HTMLElement | null>>({})
  const escala = escalaDoCanvas(larguraPx)

  const el = layout.elementos.find((e) => e.id === selecionadoId) ?? null

  // Registra os nós DOM de cada elemento (para o Moveable mirar o selecionado).
  const registrarRef = useCallback((id: string, node: HTMLElement | null) => {
    setTargets((prev) => (prev[id] === node ? prev : { ...prev, [id]: node }))
  }, [])

  const [, force] = useState(0)
  useEffect(() => { force((n) => n + 1) }, [selecionadoId, larguraPx]) // reposiciona o Moveable

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: ptParaPx(layout.pagina.larguraPt, escala), margin: '0 auto' }}
      onMouseDown={(e) => { if (e.target === containerRef.current) onSelecionar(null) }}
    >
      {/* Preview base */}
      <RenderizadorPreview layout={layout} contexto={contexto} escala={escala} logoSrc={logoSrc} />

      {/* Camada de alvos clicáveis sobre cada elemento (para seleção + Moveable) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {layout.elementos.map((e) => (
          <div
            key={e.id}
            ref={(node) => registrarRef(e.id, node)}
            onMouseDown={(ev) => { ev.stopPropagation(); onSelecionar(e.id) }}
            style={{
              position: 'absolute',
              left: ptParaPx(e.xPt, escala),
              top: ptParaPx(e.yPt, escala),
              width: ptParaPx(e.larguraPt, escala),
              height: ptParaPx(Math.max(e.alturaPt, 8), escala),
              cursor: 'move',
              outline: e.id === selecionadoId ? '1px solid #4C6EF5' : '1px solid transparent',
            }}
          />
        ))}
      </div>

      {el && targets[el.id] && (
        <Moveable
          target={targets[el.id]!}
          container={containerRef.current}
          draggable
          resizable
          throttleDrag={0}
          throttleResize={0}
          onDrag={({ target, left, top }) => {
            target.style.left = `${left}px`
            target.style.top = `${top}px`
          }}
          onDragEnd={({ lastEvent }) => {
            if (!lastEvent) return
            const novo = clampElemento(
              { ...el, xPt: pxParaPt(lastEvent.left, escala), yPt: pxParaPt(lastEvent.top, escala) },
              layout.pagina,
            )
            onAlterarElemento(novo)
          }}
          onResize={({ target, width, height, drag }) => {
            target.style.width = `${width}px`
            target.style.height = `${height}px`
            target.style.left = `${drag.left}px`
            target.style.top = `${drag.top}px`
          }}
          onResizeEnd={({ lastEvent }) => {
            if (!lastEvent) return
            const novo = clampElemento(
              {
                ...el,
                larguraPt: pxParaPt(lastEvent.width, escala),
                alturaPt: pxParaPt(lastEvent.height, escala),
                xPt: pxParaPt(lastEvent.drag.left, escala),
                yPt: pxParaPt(lastEvent.drag.top, escala),
              },
              layout.pagina,
            )
            onAlterarElemento(novo)
          }}
          snappable
          snapThreshold={5}
          verticalGuidelines={[
            ptParaPx(layout.pagina.margemEsquerdaPt, escala),
            ptParaPx(layout.pagina.larguraPt - layout.pagina.margemDireitaPt, escala),
          ]}
          horizontalGuidelines={[
            ptParaPx(layout.pagina.margemTopoPt, escala),
            ptParaPx(layout.pagina.alturaPt - layout.pagina.margemBaixoPt, escala),
          ]}
        />
      )}
    </div>
  )
}
