/**
 * gantt-layout.test.ts — Testes dos helpers PUROS de layout do Gantt (PCP).
 *
 * Cobre as Correctness Properties do design `pcp-gantt-melhorias`:
 *  - Property 5 (empilhamento) — Requirement 4.1
 *  - Property 6 (ocupação) — Requirement 7.1
 *
 * Stack: vitest + fast-check. Geradores com domínios pequenos e seed fixa para
 * determinismo; numRuns moderado. Timestamps de dia civil local via
 * `new Date(ano, mes, dia).getTime()` (meia-noite local), consistente com
 * `chaveDiaLocalFront`.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  chaveDiaLocalFront,
  empilharBarras,
  minutosUteisDoDia,
  ocupacaoPorDia,
  type ExcecaoCalendarioFront,
  type ItemComIntervalo,
  type TurnoFront,
} from './gantt-layout'

// Seed fixa + numRuns moderado para runs determinísticas e rápidas.
const RUNS = { numRuns: 200, seed: 20260101 } as const

// ============================================================================
// Geradores
// ============================================================================

/** Barra com duração >= 0 (fim pode ser igual ao início). */
const arbBarra: fc.Arbitrary<ItemComIntervalo> = fc
  .record({
    inicioMs: fc.integer({ min: 0, max: 5_000 }),
    duracao: fc.integer({ min: 0, max: 2_000 }),
  })
  .map(({ inicioMs, duracao }) => ({ inicioMs, fimMs: inicioMs + duracao }))

/** Barra com duração estritamente > 0 (para a checagem de minimalidade). */
const arbBarraPositiva: fc.Arbitrary<ItemComIntervalo> = fc
  .record({
    inicioMs: fc.integer({ min: 0, max: 5_000 }),
    duracao: fc.integer({ min: 1, max: 2_000 }),
  })
  .map(({ inicioMs, duracao }) => ({ inicioMs, fimMs: inicioMs + duracao }))

const arbBarras = fc.array(arbBarra, { minLength: 0, maxLength: 8 })
const arbBarrasPositivas = fc.array(arbBarraPositiva, { minLength: 0, maxLength: 8 })

// ============================================================================
// Helpers de verificação
// ============================================================================

/** Sobreposição temporal ESTRITA no intervalo semiaberto [inicio, fim). */
function sobrepoeEstrito(a: ItemComIntervalo, b: ItemComIntervalo): boolean {
  return a.inicioMs < b.fimMs && b.inicioMs < a.fimMs
}

/**
 * Máximo de intervalos (duração > 0) que se sobrepõem num mesmo instante,
 * calculado por sweep line clássico. Eventos de fim são processados ANTES dos
 * de início no mesmo timestamp (semiaberto [inicio, fim): tocar não conta).
 */
function overlapMaximo(barras: readonly ItemComIntervalo[]): number {
  const eventos: Array<{ t: number; delta: number }> = []
  for (const b of barras) {
    if (b.fimMs <= b.inicioMs) continue // duração 0 não ocupa sobreposição
    eventos.push({ t: b.inicioMs, delta: +1 })
    eventos.push({ t: b.fimMs, delta: -1 })
  }
  // Mesmo timestamp: fim (-1) antes de início (+1) para respeitar [inicio, fim).
  eventos.sort((x, y) => (x.t !== y.t ? x.t - y.t : x.delta - y.delta))
  let atual = 0
  let max = 0
  for (const e of eventos) {
    atual += e.delta
    if (atual > max) max = e.delta > 0 ? atual : max
  }
  return max
}

// ============================================================================
// Property 5 — Empilhamento (Req 4.1)
// ============================================================================

describe('empilharBarras — Property 5 (empilhamento)', () => {
  it('(a) atribui TODAS as barras (itens.length === entrada.length)', () => {
    // **Validates: Requirements 4.1**
    fc.assert(
      fc.property(arbBarras, (barras) => {
        const { itens } = empilharBarras(barras)
        expect(itens.length).toBe(barras.length)
      }),
      RUNS,
    )
  })

  it('(b) nunca coloca duas barras com sobreposição ESTRITA na mesma sub-linha', () => {
    // **Validates: Requirements 4.1**
    fc.assert(
      fc.property(arbBarras, (barras) => {
        const { itens } = empilharBarras(barras)
        for (let i = 0; i < itens.length; i++) {
          for (let j = i + 1; j < itens.length; j++) {
            if (itens[i].subLinha === itens[j].subLinha) {
              expect(sobrepoeEstrito(itens[i].barra, itens[j].barra)).toBe(false)
            }
          }
        }
      }),
      RUNS,
    )
  })

  it('(c) maxSubLinhas <= entrada.length (invariante simples)', () => {
    // **Validates: Requirements 4.1**
    fc.assert(
      fc.property(arbBarras, (barras) => {
        const { maxSubLinhas } = empilharBarras(barras)
        expect(maxSubLinhas).toBeLessThanOrEqual(barras.length)
        if (barras.length === 0) expect(maxSubLinhas).toBe(0)
        else expect(maxSubLinhas).toBeGreaterThanOrEqual(1)
      }),
      RUNS,
    )
  })

  it('(c) usa o número MÍNIMO de sub-linhas: maxSubLinhas === overlap máximo (durações > 0)', () => {
    // **Validates: Requirements 4.1**
    fc.assert(
      fc.property(arbBarrasPositivas, (barras) => {
        const { maxSubLinhas } = empilharBarras(barras)
        expect(maxSubLinhas).toBe(overlapMaximo(barras))
      }),
      RUNS,
    )
  })

  it('(d) golden: 3 barras [0,10),[5,15),[12,20) → maxSubLinhas=2 e atribuição coerente', () => {
    const barras: ItemComIntervalo[] = [
      { inicioMs: 0, fimMs: 10 },
      { inicioMs: 5, fimMs: 15 },
      { inicioMs: 12, fimMs: 20 },
    ]
    const { itens, maxSubLinhas } = empilharBarras(barras)
    expect(maxSubLinhas).toBe(2)
    expect(itens.length).toBe(3)

    // [0,10) e [5,15) se sobrepõem → sub-linhas distintas.
    const sub = new Map(itens.map((it) => [it.barra.inicioMs, it.subLinha]))
    expect(sub.get(0)).not.toBe(sub.get(5))
    // [12,20) começa após [0,10) terminar → reaproveita a sub-linha da barra [0,10).
    expect(sub.get(12)).toBe(sub.get(0))
    // Nenhum par sobreposto compartilha sub-linha.
    for (let i = 0; i < itens.length; i++) {
      for (let j = i + 1; j < itens.length; j++) {
        if (itens[i].subLinha === itens[j].subLinha) {
          expect(sobrepoeEstrito(itens[i].barra, itens[j].barra)).toBe(false)
        }
      }
    }
  })

  it('(e) duração 0: barra [10,10) pode dividir sub-linha com [0,10)', () => {
    const barras: ItemComIntervalo[] = [
      { inicioMs: 0, fimMs: 10 },
      { inicioMs: 10, fimMs: 10 }, // duração 0, começa onde a outra termina
    ]
    const { itens, maxSubLinhas } = empilharBarras(barras)
    expect(maxSubLinhas).toBe(1)
    expect(itens.every((it) => it.subLinha === 0)).toBe(true)
  })
})

// ============================================================================
// Property 6 — Ocupação (Req 7.1)
// ============================================================================

const TURNO_PADRAO: TurnoFront = {
  horaInicio: '08:00',
  horaFim: '17:00', // 540 min
  diasSemana: [1, 2, 3, 4, 5], // seg..sex
}

/** Meia-noite local do dia civil (ano, mesIdx 0..11, dia). */
function diaMs(ano: number, mesIdx: number, dia: number): number {
  return new Date(ano, mesIdx, dia).getTime()
}

/** Minutos a partir da meia-noite local de um dia, para montar barras. */
function instante(ano: number, mesIdx: number, dia: number, hora: number, min = 0): number {
  return new Date(ano, mesIdx, dia, hora, min).getTime()
}

describe('minutosUteisDoDia — Property 6 (parte a)', () => {
  // 2026-01-05 é segunda-feira; 2026-01-04 é domingo.
  const segunda = diaMs(2026, 0, 5)
  const domingo = diaMs(2026, 0, 4)

  it('(a) nunca retorna negativo (para turnos/exceções arbitrários)', () => {
    // **Validates: Requirements 7.1**
    const arbHora = fc.integer({ min: 0, max: 23 })
    const arbMin = fc.integer({ min: 0, max: 59 })
    const arbTurno: fc.Arbitrary<TurnoFront> = fc.record({
      horaInicio: fc.tuple(arbHora, arbMin).map(([h, m]) => `${h}:${m}`),
      horaFim: fc.tuple(arbHora, arbMin).map(([h, m]) => `${h}:${m}`),
      diasSemana: fc.subarray([1, 2, 3, 4, 5, 6, 7]),
    })
    fc.assert(
      fc.property(arbTurno, fc.integer({ min: 0, max: 6 }), (turno, offsetDias) => {
        const dia = diaMs(2026, 0, 5 + offsetDias)
        const min = minutosUteisDoDia(dia, turno)
        expect(min).toBeGreaterThanOrEqual(0)
      }),
      RUNS,
    )
  })

  it('(a) sem turno → 0', () => {
    expect(minutosUteisDoDia(segunda, null)).toBe(0)
  })

  it('(a) dia fora de diasSemana → 0 (domingo com turno seg-sex)', () => {
    expect(minutosUteisDoDia(domingo, TURNO_PADRAO)).toBe(0)
  })

  it('(a) turno-base em dia útil → (fim-ini) do turno', () => {
    expect(minutosUteisDoDia(segunda, TURNO_PADRAO)).toBe(540)
  })

  it('(a) NAO_TRABALHO → 0 (mesmo em dia útil)', () => {
    const excecoes: ExcecaoCalendarioFront[] = [
      { data: chaveDiaLocalFront(new Date(segunda)), tipo: 'NAO_TRABALHO', horaInicio: null, horaFim: null },
    ]
    expect(minutosUteisDoDia(segunda, TURNO_PADRAO, excecoes)).toBe(0)
  })

  it('(a) HORA_EXTRA válida → (fim-ini) da exceção', () => {
    // Domingo (fora de diasSemana) com HORA_EXTRA 09:00-13:00 (240 min).
    const excecoes: ExcecaoCalendarioFront[] = [
      { data: chaveDiaLocalFront(new Date(domingo)), tipo: 'HORA_EXTRA', horaInicio: '09:00', horaFim: '13:00' },
    ]
    expect(minutosUteisDoDia(domingo, TURNO_PADRAO, excecoes)).toBe(240)
  })
})

describe('ocupacaoPorDia — Property 6 (parte b)', () => {
  it('(b) ocupacaoPct === 0 quando minutosUteis === 0; nunca NaN/Infinity', () => {
    // **Validates: Requirements 7.1**
    // Domingo (sem janela útil) com uma barra qualquer dentro do dia.
    const domingo = diaMs(2026, 0, 4)
    const barras: ItemComIntervalo[] = [
      { inicioMs: instante(2026, 0, 4, 9), fimMs: instante(2026, 0, 4, 12) },
    ]
    const [r] = ocupacaoPorDia(barras, TURNO_PADRAO, [], [domingo])
    expect(r.minutosUteis).toBe(0)
    expect(r.ocupacaoPct).toBe(0)
    expect(Number.isFinite(r.ocupacaoPct)).toBe(true)
  })

  it('(b) nunca NaN/Infinity para entradas arbitrárias', () => {
    // **Validates: Requirements 7.1**
    const arbBarraDoDia: fc.Arbitrary<ItemComIntervalo> = fc
      .record({ h: fc.integer({ min: 0, max: 23 }), dur: fc.integer({ min: 0, max: 12 }) })
      .map(({ h, dur }) => ({
        inicioMs: instante(2026, 0, 5, h),
        fimMs: instante(2026, 0, 5, Math.min(h + dur, 23)),
      }))
    fc.assert(
      fc.property(fc.array(arbBarraDoDia, { maxLength: 6 }), fc.boolean(), (barras, usaTurno) => {
        const dia = diaMs(2026, 0, 5)
        const res = ocupacaoPorDia(barras, usaTurno ? TURNO_PADRAO : null, [], [dia])
        for (const r of res) {
          expect(Number.isFinite(r.ocupacaoPct)).toBe(true)
          expect(r.ocupacaoPct).toBeGreaterThanOrEqual(0)
        }
      }),
      RUNS,
    )
  })

  it('(b) com minutos úteis: ocupacaoPct === (ocupados/uteis)*100', () => {
    // **Validates: Requirements 7.1**
    const segunda = diaMs(2026, 0, 5)
    // Barra 08:00-12:00 = 240 min; turno 540 min → 240/540*100.
    const barras: ItemComIntervalo[] = [
      { inicioMs: instante(2026, 0, 5, 8), fimMs: instante(2026, 0, 5, 12) },
    ]
    const [r] = ocupacaoPorDia(barras, TURNO_PADRAO, [], [segunda])
    expect(r.minutosUteis).toBe(540)
    expect(r.minutosOcupados).toBe(240)
    expect(r.ocupacaoPct).toBeCloseTo((240 / 540) * 100, 6)
  })

  it('(b) sobrecarga: pode passar de 100%', () => {
    // **Validates: Requirements 7.1**
    const segunda = diaMs(2026, 0, 5)
    // Barra cobrindo o dia inteiro (0h-24h = 1440 min) contra turno de 540 min.
    const barras: ItemComIntervalo[] = [{ inicioMs: segunda, fimMs: segunda + 24 * 60 * 60 * 1000 }]
    const [r] = ocupacaoPorDia(barras, TURNO_PADRAO, [], [segunda])
    expect(r.ocupacaoPct).toBeGreaterThan(100)
  })

  it('(c) golden: turno 08:00-17:00 (540 min), barra 08:00-12:00 (240 min) → ~44.4%', () => {
    const segunda = diaMs(2026, 0, 5)
    const barras: ItemComIntervalo[] = [
      { inicioMs: instante(2026, 0, 5, 8), fimMs: instante(2026, 0, 5, 12) },
    ]
    const [r] = ocupacaoPorDia(barras, TURNO_PADRAO, [], [segunda])
    expect(r.minutosUteis).toBe(540)
    expect(r.minutosOcupados).toBe(240)
    expect(r.ocupacaoPct).toBeCloseTo(44.444, 2)
  })
})
