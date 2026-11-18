'use client'

/**
 * useGuardaSaida — confirmação ao sair da Tela_Item com alterações não salvas.
 *
 * - `beforeunload`: fechar/recarregar a aba pede a confirmação do navegador.
 * - Navegação interna: clique em link interno (`<a href>` da mesma origem, inclusive os do menu e
 *   das migalhas) é interceptado e vira um pedido de confirmação (`destinoPendente`).
 * - `navegar(destino)`: para os botões da própria tela; com alterações, pede confirmação.
 *
 * Sem alterações (`sujo = false`) nada é interceptado.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface GuardaSaida {
  /** Destino aguardando confirmação (null = nenhum pedido aberto). */
  destinoPendente: string | null
  /** Navega (com confirmação se houver alterações). */
  navegar: (destino: string) => void
  /** Confirma a saída: descarta as alterações e segue para o destino. */
  confirmar: () => void
  /** Fica na tela. */
  cancelar: () => void
}

export function useGuardaSaida(sujo: boolean, irPara: (destino: string) => void): GuardaSaida {
  const [destinoPendente, setDestinoPendente] = useState<string | null>(null)
  const sujoRef = useRef(sujo)
  sujoRef.current = sujo
  const irParaRef = useRef(irPara)
  irParaRef.current = irPara

  useEffect(() => {
    if (!sujo) return

    const antesDeSair = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    const aoClicar = (e: MouseEvent) => {
      if (!sujoRef.current || e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const alvo = e.target as Element | null
      const link = alvo?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
      let url: URL
      try {
        url = new URL(link.getAttribute('href') ?? '', window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      const destino = `${url.pathname}${url.search}${url.hash}`
      const atual = `${window.location.pathname}${window.location.search}`
      if (`${url.pathname}${url.search}` === atual) return
      e.preventDefault()
      e.stopPropagation()
      setDestinoPendente(destino)
    }

    window.addEventListener('beforeunload', antesDeSair)
    document.addEventListener('click', aoClicar, true)
    return () => {
      window.removeEventListener('beforeunload', antesDeSair)
      document.removeEventListener('click', aoClicar, true)
    }
  }, [sujo])

  const navegar = useCallback((destino: string) => {
    if (sujoRef.current) setDestinoPendente(destino)
    else irParaRef.current(destino)
  }, [])

  const destinoRef = useRef<string | null>(null)
  destinoRef.current = destinoPendente

  const confirmar = useCallback(() => {
    const destino = destinoRef.current
    setDestinoPendente(null)
    if (destino) irParaRef.current(destino)
  }, [])

  const cancelar = useCallback(() => setDestinoPendente(null), [])

  return { destinoPendente, navegar, confirmar, cancelar }
}
