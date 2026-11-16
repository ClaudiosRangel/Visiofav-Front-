/**
 * Testes de `passe-selecao-puro.ts` (spec orcamento-grafico-fase3-produto-embalagem,
 * tarefa 8.4): resumo do passe de seleções de material.
 */

import { describe, expect, it } from 'vitest'

import { resumirPasse, type ResultadoPasse } from './passe-selecao-puro'

const falha = (chave: string, atividadeNome = 'Laminação', mensagem = 'erro') => ({ chave, atividadeNome, mensagem })

describe('resumirPasse (unidade)', () => {
  it('entrada vazia: nada gravado nem falho permite recalcular', () => {
    const r = resumirPasse({ gravadas: [], falhas: [] })
    expect(r.podeRecalcular).toBe(true)
    expect(r.falhas).toEqual([])
    expect(r.reenviar).toEqual([])
    expect(r.totalGravadas).toBe(0)
    expect(r.totalNaoGravadas).toBe(0)
    expect(r.estados).toEqual({})
  })

  it('lista vazia de resultados também permite recalcular', () => {
    expect(resumirPasse([]).podeRecalcular).toBe(true)
  })

  it('todas gravadas: permite recalcular e fechar', () => {
    const r = resumirPasse({ gravadas: [{ chave: 'a|p1' }, { chave: 'b|p1' }], falhas: [] })
    expect(r.podeRecalcular).toBe(true)
    expect(r.totalGravadas).toBe(2)
    expect(r.estados).toEqual({ 'a|p1': 'GRAVADA', 'b|p1': 'GRAVADA' })
  })

  it('falha parcial: bloqueia o recálculo e lista atividade e mensagem', () => {
    const r = resumirPasse({
      gravadas: [{ chave: 'a|' }],
      falhas: [falha('b|', 'Verniz', 'tempo esgotado')],
    })
    expect(r.podeRecalcular).toBe(false)
    expect(r.falhas).toEqual([{ chave: 'b|', atividadeNome: 'Verniz', mensagem: 'tempo esgotado' }])
    expect(r.reenviar).toEqual(['b|'])
    expect(r.totalGravadas).toBe(1)
    expect(r.totalNaoGravadas).toBe(1)
    expect(r.estados).toEqual({ 'a|': 'GRAVADA', 'b|': 'NAO_GRAVADA' })
  })

  it('retentativa: a gravação posterior resolve a falha anterior', () => {
    const inicial: ResultadoPasse = { gravadas: [{ chave: 'a|' }], falhas: [falha('b|')] }
    const retentativa: ResultadoPasse = { gravadas: [{ chave: 'b|' }], falhas: [] }
    const r = resumirPasse([inicial, retentativa])
    expect(r.podeRecalcular).toBe(true)
    expect(r.reenviar).toEqual([])
    expect(r.estados).toEqual({ 'a|': 'GRAVADA', 'b|': 'GRAVADA' })
  })

  it('retentativa que falha de novo mantém só a falha mais recente da chave', () => {
    const r = resumirPasse([
      { gravadas: [], falhas: [falha('b|', 'Verniz', 'primeira')] },
      { gravadas: [], falhas: [falha('b|', 'Verniz', 'segunda')] },
    ])
    expect(r.falhas).toHaveLength(1)
    expect(r.falhas[0].mensagem).toBe('segunda')
    expect(r.podeRecalcular).toBe(false)
  })

  it('no mesmo resultado, a falha prevalece sobre a gravação da mesma chave', () => {
    const r = resumirPasse({ gravadas: [{ chave: 'a|' }], falhas: [falha('a|')] })
    expect(r.estados['a|']).toBe('NAO_GRAVADA')
    expect(r.podeRecalcular).toBe(false)
  })

  it('reenviar mantém a ordem das falhas', () => {
    const r = resumirPasse({ gravadas: [], falhas: [falha('c|'), falha('a|'), falha('b|')] })
    expect(r.reenviar).toEqual(['c|', 'a|', 'b|'])
  })
})
