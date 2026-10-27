/**
 * gantt-layout.ts — Helpers PUROS de layout do Gantt de Produção (PCP).
 *
 * Spec: pcp-gantt-melhorias (Requirement 4 subseção 4a; Requirement 5 setas;
 * Requirement 7 ocupação). Correctness Properties 5 e 6.
 *
 * Este módulo NÃO importa React, Mantine nem toca o DOM. É TypeScript puro e
 * determinístico, para ser testável isoladamente (vitest + fast-check) e
 * reusado pela página `/pcp/gantt` nas tasks de UI (7/8/10).
 *
 * Funções exportadas:
 *  - empilharBarras      → lane assignment / interval partitioning (Req 4a).
 *  - minutosUteisDoDia   → minutos trabalháveis de um dia civil (turno/exceções).
 *  - ocupacaoPorDia      → ocupação (%) por dia visível (Req 7).
 *  - xInicio / xFim      → coordenadas X de uma barra para as setas (Req 5).
 *
 * A lógica de janela útil (turno + exceções de calendário) reusa EXATAMENTE as
 * mesmas regras já existentes no front (`intervalosForaDoTurno`/`chaveDiaLocalFront`
 * da página do Gantt): exceção da data vence o turno-base; NAO_TRABALHO = 0;
 * HORA_EXTRA/DIA_EXTRA = janela da exceção; senão turno-base quando o dia da
 * semana está em `diasSemana`, senão 0. A casagem de exceção usa o MESMO formato
 * de chave local "YYYY-MM-DD".
 */

// ============================================================================
// TIPOS
// ============================================================================

/** Turno de trabalho de um centro (mesmo shape usado no payload do Gantt). */
export type TurnoFront = {
  horaInicio: string // "HH:MM"
  horaFim: string // "HH:MM"
  diasSemana: number[] // 1=segunda ... 7=domingo
}

/**
 * Exceção de calendário de um centro (mesmo shape vindo do backend).
 * Duplicado aqui propositalmente para a página reusar deste módulo puro sem
 * depender da definição dentro do componente React.
 */
export type ExcecaoCalendarioFront = {
  data: string // "YYYY-MM-DD"
  tipo: string // HORA_EXTRA | DIA_EXTRA | NAO_TRABALHO
  horaInicio: string | null
  horaFim: string | null
}

/** Item mínimo que uma barra precisa expor para o empilhamento. */
export type ItemComIntervalo = { inicioMs: number; fimMs: number }

/** Resultado do empilhamento: cada barra ganha a sua sub-linha. */
export type BarraEmpilhada<T> = { barra: T; subLinha: number }

export type ResultadoEmpilhamento<T> = {
  itens: Array<BarraEmpilhada<T>>
  /** Quantidade de sub-linhas usadas. >= 1 quando há itens; 0 quando vazio. */
  maxSubLinhas: number
}

/** Ocupação calculada de um dia civil. */
export type OcupacaoDia = {
  diaMs: number
  ocupacaoPct: number
  minutosUteis: number
  minutosOcupados: number
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

// ============================================================================
// 1) EMPILHAMENTO / LANE ASSIGNMENT (interval partitioning) — Req 4a
// ============================================================================

/**
 * Atribui cada barra à PRIMEIRA sub-linha cuja última barra termina em
 * `<= inicioMs` da barra corrente (sem sobreposição no intervalo semiaberto
 * `[inicio, fim)`); cria uma nova sub-linha quando nenhuma couber.
 *
 * Algoritmo clássico de *interval partitioning* (lane assignment), que usa o
 * número MÍNIMO de sub-linhas (Property 5). A ordenação é por `inicioMs`, com
 * desempate estável por `fimMs` — o que torna o resultado DETERMINÍSTICO.
 *
 * Barras de duração 0 (`fimMs <= inicioMs`) NÃO ocupam sobreposição: uma barra
 * que começa exatamente no instante em que outra termina pode compartilhar a
 * mesma sub-linha (a comparação usa `ultimoFim <= inicio`).
 *
 * @returns `{ itens, maxSubLinhas }`. Quando a entrada é vazia, `maxSubLinhas`
 *          é 0 (não há sub-linha); com 1+ itens é sempre `>= 1`.
 */
export function empilharBarras<T extends ItemComIntervalo>(
  barras: readonly T[],
): ResultadoEmpilhamento<T> {
  // Preserva o índice original para um desempate 100% estável/determinístico.
  const indexados = barras.map((barra, idx) => ({ barra, idx }))
  indexados.sort((a, b) => {
    if (a.barra.inicioMs !== b.barra.inicioMs) return a.barra.inicioMs - b.barra.inicioMs
    if (a.barra.fimMs !== b.barra.fimMs) return a.barra.fimMs - b.barra.fimMs
    return a.idx - b.idx
  })

  // Fim efetivo da última barra alocada em cada sub-linha.
  const fimDaSubLinha: number[] = []
  const itens: Array<BarraEmpilhada<T>> = []

  for (const { barra } of indexados) {
    const inicio = barra.inicioMs
    // Duração 0 não "ocupa" espaço de sobreposição: trata fim efetivo como o
    // próprio início para não bloquear a sub-linha além do instante pontual.
    const fimEfetivo = Math.max(barra.fimMs, barra.inicioMs)

    let alvo = -1
    for (let i = 0; i < fimDaSubLinha.length; i++) {
      // Cabe se a última barra desta sub-linha termina em <= início da atual.
      if (fimDaSubLinha[i] <= inicio) {
        alvo = i
        break
      }
    }

    if (alvo === -1) {
      alvo = fimDaSubLinha.length
      fimDaSubLinha.push(fimEfetivo)
    } else {
      fimDaSubLinha[alvo] = fimEfetivo
    }

    itens.push({ barra, subLinha: alvo })
  }

  return { itens, maxSubLinhas: fimDaSubLinha.length }
}

// ============================================================================
// 2) OCUPAÇÃO POR DIA — Req 7 / Property 6
// ============================================================================

/** Converte "HH:MM" em minutos do dia (0..1440). Robusto a valores inválidos. */
function minutosDoHorario(hhmm: string): number | null {
  const partes = hhmm.split(':')
  if (partes.length < 2) return null
  const h = Number(partes[0])
  const m = Number(partes[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** Chave "YYYY-MM-DD" (dia civil local) — igual ao backend/página do Gantt. */
export function chaveDiaLocalFront(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Minutos trabalháveis de UM dia civil, resolvendo a janela efetiva com a
 * MESMA regra do resto do front:
 *  - exceção da data vence o turno-base;
 *  - NAO_TRABALHO ⇒ 0 minutos;
 *  - HORA_EXTRA/DIA_EXTRA (com horaInicio/horaFim válidos) ⇒ janela da exceção;
 *  - exceção sem janela válida ⇒ cai no turno-base;
 *  - sem exceção ⇒ turno-base quando o dia da semana ∈ diasSemana, senão 0.
 *
 * @param diaInicioMs timestamp à meia-noite local do dia civil.
 * @returns minutos úteis (>= 0). Sem turno ⇒ 0.
 */
export function minutosUteisDoDia(
  diaInicioMs: number,
  turno: TurnoFront | null,
  excecoes: ExcecaoCalendarioFront[] = [],
): number {
  if (!turno) return 0

  const dia = new Date(diaInicioMs)
  const diaConv = dia.getDay() === 0 ? 7 : dia.getDay()
  const chave = chaveDiaLocalFront(dia)

  const tIniBase = minutosDoHorario(turno.horaInicio)
  const tFimBase = minutosDoHorario(turno.horaFim)

  const exc = excecoes.find((e) => e.data === chave)
  let tIni: number | null = tIniBase
  let tFim: number | null = tFimBase
  let trabalha: boolean

  if (exc) {
    if (exc.tipo === 'NAO_TRABALHO') {
      return 0
    }
    if (exc.horaInicio && exc.horaFim) {
      const ei = minutosDoHorario(exc.horaInicio)
      const ef = minutosDoHorario(exc.horaFim)
      if (ei != null && ef != null && ef > ei) {
        tIni = ei
        tFim = ef
        trabalha = true
      } else {
        // Janela inválida → turno-base.
        trabalha = (turno.diasSemana || []).includes(diaConv)
      }
    } else {
      // Exceção sem janela (ex.: DIA_EXTRA sem horário) → turno-base.
      trabalha = (turno.diasSemana || []).includes(diaConv)
    }
  } else {
    trabalha = (turno.diasSemana || []).includes(diaConv)
  }

  if (!trabalha) return 0
  if (tIni == null || tFim == null || tFim <= tIni) return 0
  return tFim - tIni
}

/**
 * Minutos de operação de uma barra que caem DENTRO de um dia civil, via
 * interseção do intervalo semiaberto `[inicioMs, fimMs)` da barra com
 * `[diaInicio, diaInicio + 24h)`.
 */
function minutosNoDia(barra: ItemComIntervalo, diaInicioMs: number): number {
  const diaFimMs = diaInicioMs + MS_POR_DIA
  const ini = Math.max(barra.inicioMs, diaInicioMs)
  const fim = Math.min(barra.fimMs, diaFimMs)
  if (fim <= ini) return 0
  return (fim - ini) / 60000
}

/**
 * Ocupação (%) por dia visível de uma raia (máquina).
 *
 * Para cada `diaMs` (meia-noite local de cada dia visível), soma os minutos de
 * operação das barras que caem naquele dia (interseção de intervalos) e divide
 * pelos minutos úteis do dia (`minutosUteisDoDia`).
 *
 * `ocupacaoPct = minutosUteis > 0 ? (ocupados / uteis) * 100 : 0` — NUNCA divide
 * por zero (Property 6). O valor pode ultrapassar 100 (sobrecarga da máquina).
 *
 * @param diasMs lista de timestamps à meia-noite local de cada dia visível.
 */
export function ocupacaoPorDia(
  barras: readonly ItemComIntervalo[],
  turno: TurnoFront | null,
  excecoes: ExcecaoCalendarioFront[] = [],
  diasMs: readonly number[] = [],
): OcupacaoDia[] {
  return diasMs.map((diaMs) => {
    const minutosUteis = minutosUteisDoDia(diaMs, turno, excecoes)
    let minutosOcupados = 0
    for (const barra of barras) {
      minutosOcupados += minutosNoDia(barra, diaMs)
    }
    const ocupacaoPct = minutosUteis > 0 ? (minutosOcupados / minutosUteis) * 100 : 0
    return { diaMs, ocupacaoPct, minutosUteis, minutosOcupados }
  })
}

// ============================================================================
// 3) PONTOS DAS SETAS DE DEPENDÊNCIA — Req 5 (usado na Task 8.3)
// ============================================================================

/**
 * Coordenada X (em pixels) do INÍCIO de uma barra no eixo do Gantt.
 * `x = ((inicioMs - minTime) / 60000) * pixelsPorMinuto`.
 */
export function xInicio(inicioMs: number, minTime: number, pixelsPorMinuto: number): number {
  return ((inicioMs - minTime) / 60000) * pixelsPorMinuto
}

/**
 * Coordenada X (em pixels) do FIM de uma barra no eixo do Gantt.
 * `x = ((fimMs - minTime) / 60000) * pixelsPorMinuto`.
 */
export function xFim(fimMs: number, minTime: number, pixelsPorMinuto: number): number {
  return ((fimMs - minTime) / 60000) * pixelsPorMinuto
}
