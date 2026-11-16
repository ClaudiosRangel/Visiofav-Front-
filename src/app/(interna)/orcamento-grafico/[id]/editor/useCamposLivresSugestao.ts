'use client'

/**
 * useCamposLivresSugestao — carrega os campos livres cadastrados (SOLICITACAO e PEDIDO,
 * ativos, com opções) para sugerir rótulos e opções no item (spec
 * orcamento-grafico-fase3-produto-embalagem, tarefa 15.1, Req 5.1, 5.9, 5.10).
 *
 * - Duas chamadas a `GET /orcamento-grafico/cadastros/campos-livres`, uma por proprietário,
 *   feitas UMA vez por sessão do editor.
 * - Falha: `aviso` legível com a `message` da API; as sugestões ficam só com os rótulos já
 *   usados no item e o salvamento nunca é bloqueado.
 * - A mesclagem usa `mesclarCamposLivres` (pura); o hook não adiciona par nem seleciona opção.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { camposLivresApi, mensagemErroApi } from '../../cadastros/_shared/cadastros-graficos.api'
import type { CampoLivre, ProprietarioCampoLivre } from '../../cadastros/_shared/cadastros-graficos.types'
import {
  mesclarCamposLivres,
  PROPRIETARIOS_SUGERIDOS,
  type ParCampoLivre,
  type SugestoesCamposLivres,
} from './campos-livres-puro'

export interface UseCamposLivresSugestaoResultado extends SugestoesCamposLivres {
  carregando: boolean
  /** Mensagem legível quando alguma consulta falhou; `null` quando tudo carregou. */
  aviso: string | null
}

export function useCamposLivresSugestao(
  paresAtuais: ReadonlyArray<ParCampoLivre> | null | undefined,
): UseCamposLivresSugestaoResultado {
  const [cadastro, setCadastro] = useState<CampoLivre[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const iniciou = useRef(false)

  useEffect(() => {
    // Uma vez por sessão do editor (evita repetir em re-render e no modo estrito).
    if (iniciou.current) return
    iniciou.current = true

    ;(async () => {
      const respostas = await Promise.allSettled(
        PROPRIETARIOS_SUGERIDOS.map((proprietario) =>
          camposLivresApi.listar({ proprietario: proprietario as ProprietarioCampoLivre, status: 'ativo' }),
        ),
      )
      const lista: CampoLivre[] = []
      let mensagem: string | null = null
      for (const r of respostas) {
        if (r.status === 'fulfilled') {
          if (Array.isArray(r.value)) lista.push(...r.value)
        } else if (!mensagem) {
          mensagem = mensagemErroApi(r.reason, 'Não foi possível carregar os campos livres cadastrados.')
        }
      }
      setCadastro(lista)
      setAviso(mensagem)
      setCarregando(false)
    })()
  }, [])

  const sugestoes = useMemo(() => mesclarCamposLivres(cadastro, paresAtuais), [cadastro, paresAtuais])

  return { ...sugestoes, carregando, aviso }
}
