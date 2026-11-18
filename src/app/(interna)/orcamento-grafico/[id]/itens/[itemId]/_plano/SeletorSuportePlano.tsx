'use client'

/**
 * SeletorSuportePlano — campo Suporte da Tela_Plano. É o seletor de suporte do modal antigo
 * `PlanosDoItem` trazido para cá (a remoção do modal é a tarefa 7.17): busca server-side em
 * `GET /orcamento-grafico/suportes` (`busca` com 2+ letras, 50 por página, ids de `suporte_grafico`,
 * os mesmos que a coluna `suporteId` do plano grava) e, quando o tipo de plano define suportes no
 * catálogo, restringe a lista a eles.
 *
 * O botão NC (Suporte Não Cadastrado) fica ao lado do seletor, em BlocosPorTipoPlano. Quando o
 * `value` não está nas opções (lista server-side ou `permitidos`), o campo mostra `nomeAtual`.
 */

import { useEffect, useMemo, useState } from 'react'
import { Select } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'

import { api } from '@/lib/api'

export interface OpcaoSuporte {
  value: string
  label: string
}

export interface SeletorSuportePlanoProps {
  label: string
  value: string | null
  /** Nome gravado junto da escolha, para exibir o valor atual sem consultar. */
  nomeAtual?: string | null
  onChange: (id: string | null, nome: string | null) => void
  /** Suportes permitidos pelo tipo de plano (vazio = sem restrição). */
  permitidos?: ReadonlyArray<OpcaoSuporte>
  error?: string
  disabled?: boolean
  required?: boolean
}

export default function SeletorSuportePlano({
  label,
  value,
  nomeAtual,
  onChange,
  permitidos,
  error,
  disabled,
  required,
}: SeletorSuportePlanoProps) {
  const [termo, setTermo] = useState('')
  const [debounced] = useDebouncedValue(termo, 300)
  const [opcoes, setOpcoes] = useState<OpcaoSuporte[]>([])
  const [carregando, setCarregando] = useState(false)
  const restringe = (permitidos?.length ?? 0) > 0

  useEffect(() => {
    if (restringe) return
    let cancelado = false
    const t = debounced.trim()
    setCarregando(true)
    api
      .get('/orcamento-grafico/suportes', { params: { limit: 50, ...(t.length >= 2 ? { busca: t } : {}) } })
      .then(({ data }) => {
        if (cancelado) return
        const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        setOpcoes(
          lista
            .filter((s: { id?: unknown }) => typeof s?.id === 'string')
            .map((s: { id: string; descricao?: string; codigo?: string }) => ({ value: s.id, label: s.descricao || s.codigo || s.id })),
        )
      })
      .catch(() => {
        if (!cancelado) setOpcoes([])
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [debounced, restringe])

  const dados = useMemo(() => {
    const base = restringe ? [...(permitidos ?? [])] : opcoes
    if (value && !base.some((o) => o.value === value)) {
      return [{ value, label: nomeAtual || 'Suporte selecionado' }, ...base]
    }
    return base
  }, [restringe, permitidos, opcoes, value, nomeAtual])

  return (
    <Select
      label={label}
      placeholder={carregando ? 'Carregando…' : 'Buscar suporte'}
      searchable
      clearable
      data={dados}
      value={value}
      onChange={(id) => onChange(id, id ? (dados.find((o) => o.value === id)?.label ?? null) : null)}
      onSearchChange={setTermo}
      nothingFoundMessage="Nenhum suporte encontrado"
      filter={restringe ? undefined : ({ options }) => options}
      error={error}
      disabled={disabled}
      required={required}
    />
  )
}
