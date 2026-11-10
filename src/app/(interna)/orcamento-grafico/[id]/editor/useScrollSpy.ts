'use client'

/**
 * useScrollSpy — hook de navegação por âncoras do Editor de Item do Orçamento
 * Gráfico (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 4.1)
 * _Requirements: 1.3, 1.4_
 *
 * Observa as seções do Editor (cujo `id` do elemento no DOM é o próprio
 * `AncoraId`) via `IntersectionObserver` e expõe:
 *
 *   - `ativa`   → a âncora da seção MAIS visível no viewport (Requisito 1.4),
 *                 destacada pelo índice de navegação (`IndiceAncoras`).
 *   - `irPara`  → rola suavemente até a seção correspondente (Requisito 1.3),
 *                 via `scrollIntoView({ behavior: 'smooth', block: 'start' })`.
 *
 * Fallback gracioso (Design — Error Handling):
 *   - Sem `window`/DOM (SSR) ou sem `IntersectionObserver` no ambiente, o hook
 *     NÃO quebra: a navegação por `irPara` continua funcionando (usa
 *     `scrollIntoView`/`getElementById`) e a âncora `ativa` cai para a primeira
 *     âncora da lista.
 *
 * Re-registra o observer sempre que a lista de âncoras muda (ex.: a seção
 * "Planos" aparece/some conforme o item), e limpa o observer no cleanup.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type { AncoraId } from './ancoras'

export interface UseScrollSpy {
  /** Âncora atualmente ativa (seção mais visível) ou `null` se não há âncoras. */
  ativa: AncoraId | null
  /** Rola suavemente até a seção da âncora informada. */
  irPara: (id: AncoraId) => void
}

/** `true` quando o ambiente suporta `IntersectionObserver` (client-side). */
function suportaObserver(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof IntersectionObserver !== 'undefined' &&
    typeof document !== 'undefined'
  )
}

/**
 * Hook de scroll-spy sobre as seções ancoradas do Editor.
 *
 * @param ancoras lista de âncoras presentes (os `id` das seções no DOM).
 *        Deve ser a MESMA lista produzida por `montarAncoras(item)` — assim o
 *        índice e as seções ficam sempre consistentes.
 */
export function useScrollSpy(ancoras: AncoraId[]): UseScrollSpy {
  // Âncora inicial = primeira da lista (fallback quando o observer não dispara).
  const [ativa, setAtiva] = useState<AncoraId | null>(ancoras[0] ?? null)

  // Guarda a razão de interseção de cada seção para escolher a "mais visível".
  const racioRef = useRef<Map<AncoraId, number>>(new Map())

  // `irPara` é estável e independe do observer: funciona mesmo no fallback.
  const irPara = useCallback((id: AncoraId) => {
    if (typeof document === 'undefined') return
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Chave estável da lista de âncoras para re-registrar o observer quando mudar.
  const chaveAncoras = ancoras.join('|')

  useEffect(() => {
    // Mantém a âncora ativa válida frente à lista atual (ex.: "planos" sumiu).
    setAtiva((atual) => (atual && ancoras.includes(atual) ? atual : ancoras[0] ?? null))

    // Fallback gracioso: sem suporte, só garante a 1ª âncora como ativa.
    if (!suportaObserver() || ancoras.length === 0) {
      return
    }

    const racios = racioRef.current
    racios.clear()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id as AncoraId
          racios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }

        // A âncora ativa é a seção com a MAIOR razão de interseção (> 0).
        let melhorId: AncoraId | null = null
        let melhorRacio = 0
        for (const [id, racio] of racios) {
          if (racio > melhorRacio) {
            melhorRacio = racio
            melhorId = id
          }
        }

        if (melhorId && melhorRacio > 0) {
          setAtiva(melhorId)
        }
      },
      {
        // Vários thresholds para capturar a seção "mais visível" com precisão.
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        // Margem superior negativa para a seção só "ativar" quando subir um pouco.
        rootMargin: '-10% 0px -60% 0px',
      },
    )

    const observados: Element[] = []
    for (const id of ancoras) {
      const el = document.getElementById(id)
      if (el) {
        observer.observe(el)
        observados.push(el)
      }
    }

    return () => {
      for (const el of observados) observer.unobserve(el)
      observer.disconnect()
      racios.clear()
    }
    // `chaveAncoras` reflete mudanças na lista de âncoras (re-registra o observer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveAncoras])

  return { ativa, irPara }
}
