import { describe, expect, it } from 'vitest'

import { linhasParaTintasPadrao, resumoTintasPadrao, tintasPadraoParaLinhas } from './tintas-padrao'

const escala = {
  umaCor: { tinta: 'Escala', perc: 20 },
  cores: [...Array(4).fill({ tinta: 'Escala', perc: 10 }), ...Array(4).fill({ tinta: 'Especiais', perc: 10 })],
}

describe('composição padrão da cobertura', () => {
  it('ida e volta pelo formulário preserva a composição', () => {
    const { umaCor, cores } = tintasPadraoParaLinhas(escala)
    expect(linhasParaTintasPadrao(umaCor, cores)).toEqual({ ok: true, valor: escala })
  })

  it('formulário vazio grava null', () => {
    expect(linhasParaTintasPadrao({ tinta: '', perc: '' }, [{ tinta: '', perc: '' }])).toEqual({ ok: true, valor: null })
  })

  it('linha incompleta ou fora da faixa é erro com o nome do campo', () => {
    expect(linhasParaTintasPadrao({ tinta: 'Escala', perc: '' }, [])).toMatchObject({ ok: false, erro: expect.stringContaining('1 cor') })
    expect(linhasParaTintasPadrao({ tinta: '', perc: '' }, [{ tinta: 'Escala', perc: 150 }])).toMatchObject({ ok: false, erro: expect.stringContaining('1ª cor') })
    expect(linhasParaTintasPadrao({ tinta: '', perc: '' }, [{ tinta: '', perc: 10 }])).toMatchObject({ ok: false })
  })

  it('resumo agrupa as repetições', () => {
    expect(resumoTintasPadrao(escala)).toBe('1 cor: Escala 20% · 4× Escala 10%, 4× Especiais 10%')
    expect(resumoTintasPadrao(null)).toBe('—')
  })
})
