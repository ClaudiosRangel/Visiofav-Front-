/**
 * Testes do helper `rotuloPlano` (Spec pcp-visualizacao-planos-gantt, Req 1).
 * Cobre as Correctness Properties P1–P5 do design.
 */

import { describe, it, expect } from 'vitest'
import { rotuloPlano, rotuloComFace } from './plano-rotulo'

describe('rotuloPlano', () => {
  it('troca o token COSTA por VERSO em várias caixas', () => {
    expect(rotuloPlano('COSTA')).toBe('VERSO')
    expect(rotuloPlano('Costa')).toBe('VERSO')
    expect(rotuloPlano('costa')).toBe('VERSO')
  })

  it('Property 2: preserva o restante do texto (só troca o token)', () => {
    expect(rotuloPlano('Impressão — COSTA')).toBe('Impressão — VERSO')
    expect(rotuloPlano('OP 3176 · COSTA (2ª passada)')).toBe('OP 3176 · VERSO (2ª passada)')
    expect(rotuloPlano('TAMPA')).toBe('TAMPA') // sem o token, inalterado
    expect(rotuloPlano('FRENTE')).toBe('FRENTE')
  })

  it('Property 3: não vaza em substring (só o token isolado)', () => {
    // "Acostamento" contém "costa" como substring, NÃO como token isolado.
    expect(rotuloPlano('Acostamento')).toBe('Acostamento')
    expect(rotuloPlano('costal')).toBe('costal')
    expect(rotuloPlano('encosta')).toBe('encosta')
  })

  it('Property 4: a saída não contém mais o token COSTA isolado', () => {
    const entradas = ['COSTA', 'Costa frente', 'frente / COSTA', 'x costa y', 'nada aqui']
    for (const e of entradas) {
      expect(/\bcosta\b/i.test(rotuloPlano(e))).toBe(false)
    }
  })

  it('Property 1: idempotência (aplicar 2x não muda)', () => {
    const casos = ['COSTA', 'Impressão — Costa', 'TAMPA', 'Acostamento']
    for (const c of casos) {
      const uma = rotuloPlano(c)
      expect(rotuloPlano(uma)).toBe(uma)
    }
  })

  it('Property 5: null/undefined/"" → ""', () => {
    expect(rotuloPlano(null)).toBe('')
    expect(rotuloPlano(undefined)).toBe('')
    expect(rotuloPlano('')).toBe('')
  })

  it('troca múltiplas ocorrências do token na mesma string', () => {
    expect(rotuloPlano('COSTA e COSTA')).toBe('VERSO e VERSO')
  })
})

describe('rotuloComFace', () => {
  it('aplica a mesma regra do rotuloPlano', () => {
    expect(rotuloComFace('Verniz — COSTA')).toBe('Verniz — VERSO')
    expect(rotuloComFace(null)).toBe('')
  })
})
