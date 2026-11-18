'use client'

/**
 * useLeitura — leitura GET com `{ dados, carregando, erro, naoEncontrado, recarregar }`.
 *
 * Base comum dos hooks da hierarquia. Cada chamada tem AbortController e um contador de
 * requisições: a resposta de uma chamada antiga (outro item, outra tentativa) é descartada.
 * `url = null` desliga a leitura e limpa o estado (nenhuma chamada de rede).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import { api } from '@/lib/api'

export interface OpcoesLeitura {
  /** Mensagem exibida em erro genérico (rede, 5xx, tempo esgotado). */
  mensagemErro: string
  /** Prazo da requisição em ms (padrão do `api`: sem prazo). */
  timeoutMs?: number
  /** Em erro, mantém os últimos dados bons (padrão: limpa). */
  manterDadosEmErro?: boolean
  /** Limpa os dados ao iniciar qualquer nova leitura (padrão: só ao mudar a URL). */
  limparAoRecarregar?: boolean
}

export interface ResultadoLeitura<T> {
  dados: T | null
  carregando: boolean
  erro: string | null
  /** 404 do back (inexistente ou de outra empresa). */
  naoEncontrado: boolean
  recarregar: () => void
}

export const MENSAGEM_NAO_ENCONTRADO = 'Registro não encontrado.'

function mensagemDoErro(err: unknown, padrao: string): { texto: string; naoEncontrado: boolean } {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 404) return { texto: MENSAGEM_NAO_ENCONTRADO, naoEncontrado: true }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return { texto: `${padrao} Tempo esgotado.`, naoEncontrado: false }
    }
  }
  return { texto: padrao, naoEncontrado: false }
}

export function useLeitura<T>(url: string | null, opcoes: OpcoesLeitura): ResultadoLeitura<T> {
  const { mensagemErro, timeoutMs, manterDadosEmErro = false, limparAoRecarregar = false } = opcoes

  const [dados, setDados] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(url !== null)
  const [erro, setErro] = useState<string | null>(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  const contador = useRef(0)
  const urlAnterior = useRef<string | null>(null)

  useEffect(() => {
    const mudouUrl = urlAnterior.current !== url
    urlAnterior.current = url

    if (url === null) {
      contador.current += 1
      setDados(null)
      setErro(null)
      setNaoEncontrado(false)
      setCarregando(false)
      return
    }

    const meu = ++contador.current
    const controle = new AbortController()
    const obsoleta = () => meu !== contador.current || controle.signal.aborted

    if (mudouUrl || limparAoRecarregar) setDados(null)
    setCarregando(true)
    setErro(null)
    setNaoEncontrado(false)

    api
      .get<T>(url, { signal: controle.signal, timeout: timeoutMs })
      .then(({ data }) => {
        if (obsoleta()) return
        setDados(data)
      })
      .catch((err: unknown) => {
        if (obsoleta() || axios.isCancel(err)) return
        const { texto, naoEncontrado: nf } = mensagemDoErro(err, mensagemErro)
        setErro(texto)
        setNaoEncontrado(nf)
        if (!manterDadosEmErro || nf) setDados(null)
      })
      .finally(() => {
        if (!obsoleta()) setCarregando(false)
      })

    return () => controle.abort()
  }, [url, tentativa, mensagemErro, timeoutMs, manterDadosEmErro, limparAoRecarregar])

  const recarregar = useCallback(() => setTentativa((n) => n + 1), [])

  return { dados, carregando, erro, naoEncontrado, recarregar }
}
