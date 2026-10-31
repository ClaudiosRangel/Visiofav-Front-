'use client'

/**
 * Renderizador_Preview — interpreta o Layout_JSON em DOM absoluto, escalando
 * pt→px, espelhando o Renderizador_PDF do backend (mesma spec). Spec
 * comercial-editor-visual-templates (Req 4). Renderiza cada elemento como um
 * div posicionado; textos dinâmicos/tabelas via resolverBinding/resolverTabela.
 */
import { CSSProperties } from 'react'
import type { Elemento, LayoutDocumento } from '@/lib/comercial/template-visual/layout-tipos'
import { ptParaPx } from '@/lib/comercial/template-visual/layout-escala'
import {
  type ContextoGeracao,
  resolverBinding,
  resolverTabela,
} from '@/lib/comercial/template-visual/binding-resolver'

interface Props {
  layout: LayoutDocumento
  contexto: ContextoGeracao
  escala: number
  /** Logo (dataURL/base64/URL) para o elemento LOGO. */
  logoSrc?: string | null
}

function estiloTextoCss(el: Elemento, escala: number): CSSProperties {
  const e = el.estilo
  return {
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: ptParaPx(e?.tamanhoPt ?? 10, escala),
    fontWeight: e?.negrito || e?.fonte === 'Helvetica-Bold' ? 700 : 400,
    textAlign: (e?.alinhamento ?? 'left') as CSSProperties['textAlign'],
    color: e?.cor ?? '#000000',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.2,
    overflow: 'hidden',
  }
}

function caixaCss(el: Elemento, escala: number): CSSProperties {
  return {
    position: 'absolute',
    left: ptParaPx(el.xPt, escala),
    top: ptParaPx(el.yPt, escala),
    width: ptParaPx(el.larguraPt, escala),
    height: ptParaPx(el.alturaPt, escala),
  }
}

function ElementoView({ el, contexto, escala, logoSrc }: { el: Elemento } & Omit<Props, 'layout'>) {
  const caixa = caixaCss(el, escala)

  switch (el.tipo) {
    case 'LOGO':
      return logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="logo" style={{ ...caixa, objectFit: 'contain' }} />
      ) : (
        <div style={{ ...caixa, border: '1px dashed #bbb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999' }}>
          LOGO
        </div>
      )

    case 'TEXTO':
    case 'BLOCO_CONDICOES':
      return <div style={{ ...caixa, ...estiloTextoCss(el, escala) }}>{el.textoEstatico ?? ''}</div>

    case 'CAMPO_DINAMICO': {
      const r = resolverBinding(el.binding ?? '', contexto)
      return (
        <div style={{ ...caixa, ...estiloTextoCss(el, escala), color: r.vazio ? '#c00' : (el.estilo?.cor ?? '#000') }}>
          {r.vazio ? '' : r.texto}
        </div>
      )
    }

    case 'LINHA':
      return <div style={{ ...caixa, borderTop: `1px solid ${el.estilo?.cor ?? '#000'}`, height: 0 }} />

    case 'ASSINATURA':
      return (
        <div style={caixa}>
          <div style={{ borderTop: '1px solid #000', width: '100%' }} />
          <div style={{ ...estiloTextoCss(el, escala), position: 'static' }}>{el.rotuloAssinatura ?? 'Assinatura'}</div>
        </div>
      )

    case 'TABELA': {
      const tab = el.tabela
      if (!tab) return <div style={caixa} />
      const bindings = tab.colunas.map((c) => c.binding)
      const linhas = resolverTabela(tab.fonteDados, bindings, contexto)
      const fs = ptParaPx(el.estilo?.tamanhoPt ?? 10, escala)
      return (
        <div style={{ ...caixa, fontFamily: 'Helvetica, Arial, sans-serif', fontSize: fs, color: el.estilo?.cor ?? '#000', overflow: 'hidden' }}>
          <div style={{ display: 'flex', fontWeight: 700 }}>
            {tab.colunas.map((c, i) => (
              <div key={i} style={{ width: ptParaPx(c.larguraPt, escala), textAlign: c.alinhamento }}>{c.titulo}</div>
            ))}
          </div>
          {linhas.map((linha, ri) => (
            <div key={ri} style={{ display: 'flex' }}>
              {tab.colunas.map((c, ci) => (
                <div key={ci} style={{ width: ptParaPx(c.larguraPt, escala), textAlign: c.alinhamento }}>{linha[ci] ?? ''}</div>
              ))}
            </div>
          ))}
        </div>
      )
    }

    default:
      return null
  }
}

export default function RenderizadorPreview({ layout, contexto, escala, logoSrc }: Props) {
  const p = layout.pagina
  return (
    <div
      style={{
        position: 'relative',
        width: ptParaPx(p.larguraPt, escala),
        height: ptParaPx(p.alturaPt, escala),
        background: '#fff',
        boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
      }}
    >
      {/* guias de margem (visual-only) */}
      <div
        style={{
          position: 'absolute',
          left: ptParaPx(p.margemEsquerdaPt, escala),
          top: ptParaPx(p.margemTopoPt, escala),
          width: ptParaPx(p.larguraPt - p.margemEsquerdaPt - p.margemDireitaPt, escala),
          height: ptParaPx(p.alturaPt - p.margemTopoPt - p.margemBaixoPt, escala),
          border: '1px dashed #e0e0e0',
          pointerEvents: 'none',
        }}
      />
      {layout.elementos.map((el) => (
        <ElementoView key={el.id} el={el} contexto={contexto} escala={escala} logoSrc={logoSrc} />
      ))}
    </div>
  )
}
