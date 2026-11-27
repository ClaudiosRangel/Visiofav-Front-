import { describe, expect, it } from 'vitest'
import { aplicadoSobre, corpoAtividades, lerFormato, textoFormato, textoImpressao, type AtividadeApi } from './editor-calculo'

const at = (p: Partial<AtividadeApi>): AtividadeApi => ({
  id: 'x', folhaId: null, acabamentoId: 'a', nome: 'A', sequencia: 1, detalhes: null, materiais: null, infoComplementar: null, camposManuais: [], ...p,
})

describe('editor-calculo (puro)', () => {
  it('aplicadoSobre agrupa por atividade com os planos e marca as do produto', () => {
    const m = aplicadoSobre([
      at({ id: '1', acabamentoId: 'bimac', nome: 'Bimac', folhaId: 'f2', sequencia: 2 }),
      at({ id: '2', acabamentoId: 'bimac', nome: 'Bimac', folhaId: 'f4', sequencia: 3 }),
      at({ id: '3', acabamentoId: 'selad', nome: 'Seladora', folhaId: null, sequencia: 1 }),
    ])
    expect(m.get('bimac')).toEqual({ nome: 'Bimac', folhaIds: ['f2', 'f4'], produto: false })
    expect(m.get('selad')?.produto).toBe(true)
    expect(corpoAtividades(m)).toEqual({
      atividades: [{ acabamentoId: 'selad', folhaIds: [] }, { acabamentoId: 'bimac', folhaIds: ['f2', 'f4'] }],
    })
  })
  it('formatos e impressão', () => {
    expect(lerFormato('815 x 520')).toEqual([815, 520])
    expect(lerFormato('81,5x52')).toEqual([81.5, 52])
    expect(lerFormato('abc')).toBeNull()
    expect(textoFormato(490, 790)).toBe('490 x 790')
    expect(textoFormato(null, 790)).toBe('—')
    expect(textoImpressao({ papel: 'CAPA', impressao: [{ cores: '6x0', processoImpressao: 'Offset Plana' }] })).toBe('6x0 · Offset Plana')
    expect(textoImpressao({ papel: 'MICRO', impressao: [{ cores: '6x0' }] })).toBe('—')
  })
})
