'use client'

/**
 * SeletorSuportePlano — campo Suporte da Tela_Plano. Lista os PAPÉIS com preço (preço de matéria-prima
 * do tipo PAPEL: nome, gramatura e R$/kg), como no sistema de referência ("Stora Enzo Bobina 276"). O id
 * gravado é o do papel: é ele que dá o preço e a gramatura ao cálculo do plano e das camadas.
 *
 * Quando o tipo de plano restringe os suportes no catálogo (`permitidos`, ids da família de suporte),
 * lista só os papéis dessas famílias. Busca server-side com 2+ letras. Valor fora das opções mostra
 * `nomeAtual` (plano gravado antes, inclusive com id antigo de suporte).
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
  /** Famílias de suporte permitidas pelo tipo de plano (vazio = sem restrição). */
  permitidos?: ReadonlyArray<OpcaoSuporte>
  error?: string
  disabled?: boolean
  required?: boolean
  /** `papel` (padrão): papéis com preço. `suporte`: famílias de suporte (ex.: referência de consumo de tinta no NC). */
  modo?: 'papel' | 'suporte'
}

interface PapelApi {
  id: string
  descricao?: string
  gramatura?: unknown
  precoUnitario?: unknown
  suporteId?: string | null
}

/** "Stora Enzo Bobina" + 276 → "Stora Enzo Bobina 276" (não repete a gramatura já no nome). Puro. */
export function rotuloPapel(p: Pick<PapelApi, 'descricao' | 'gramatura' | 'precoUnitario'>): string {
  const nome = (p.descricao ?? '').trim()
  const g = Number(p.gramatura ?? 0)
  const comGramatura = g > 0 && !new RegExp(`\\b${g}\\b`).test(nome) ? `${nome} ${g}` : nome
  const preco = Number(p.precoUnitario ?? 0)
  return preco > 0 ? `${comGramatura} · R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/kg` : comGramatura
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
  modo = 'papel',
}: SeletorSuportePlanoProps) {
  const [termo, setTermo] = useState('')
  const [debounced] = useDebouncedValue(termo, 300)
  const [opcoes, setOpcoes] = useState<OpcaoSuporte[]>([])
  const [carregando, setCarregando] = useState(false)
  const familias = useMemo(() => (permitidos ?? []).map((p) => p.value), [permitidos])
  const restringe = familias.length > 0

  // Famílias de suporte (modo `suporte`): lista do cadastro de suportes, como antes.
  useEffect(() => {
    if (modo !== 'suporte') return
    let cancelado = false
    const t = debounced.trim()
    setCarregando(true)
    api
      .get('/orcamento-grafico/suportes', { params: { limit: 50, ...(t.length >= 2 ? { busca: t } : {}) } })
      .then(({ data }) => {
        if (cancelado) return
        const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        setOpcoes(
          (restringe ? (permitidos ?? []) : lista
            .filter((s: { id?: unknown }) => typeof s?.id === 'string')
            .map((s: { id: string; descricao?: string; codigo?: string }) => ({ value: s.id, label: s.descricao || s.codigo || s.id }))) as OpcaoSuporte[],
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
  }, [debounced, restringe, permitidos, modo])

  useEffect(() => {
    if (modo !== 'papel') return
    let cancelado = false
    const t = debounced.trim()
    setCarregando(true)
    const base = { tipo: 'PAPEL', comPreco: 'true', limit: 100, ...(t.length >= 2 ? { busca: t } : {}) }
    const pedidos = restringe
      ? familias.slice(0, 20).map((suporteId) => api.get('/orcamento-grafico/precos-mp', { params: { ...base, suporteId } }))
      : [api.get('/orcamento-grafico/precos-mp', { params: base })]
    Promise.all(pedidos)
      .then((respostas) => {
        if (cancelado) return
        const vistos = new Set<string>()
        const lista: OpcaoSuporte[] = []
        for (const { data } of respostas) {
          const itens: PapelApi[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
          for (const p of itens) {
            if (typeof p?.id !== 'string' || vistos.has(p.id)) continue
            vistos.add(p.id)
            lista.push({ value: p.id, label: rotuloPapel(p) })
          }
        }
        lista.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
        setOpcoes(lista)
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
  }, [debounced, restringe, familias, modo])

  const dados = useMemo(() => {
    if (value && !opcoes.some((o) => o.value === value)) {
      return [{ value, label: nomeAtual || 'Suporte selecionado' }, ...opcoes]
    }
    return opcoes
  }, [opcoes, value, nomeAtual])

  return (
    <Select
      label={label}
      placeholder={carregando ? 'Carregando…' : 'Buscar papel (nome ou gramatura)'}
      searchable
      clearable
      data={dados}
      value={value}
      onChange={(id) => onChange(id, id ? (dados.find((o) => o.value === id)?.label.split(' · ')[0] ?? null) : null)}
      onSearchChange={setTermo}
      nothingFoundMessage={carregando ? 'Carregando…' : 'Nenhum papel com preço encontrado'}
      filter={({ options, search }) => {
        const s = search.trim().toLowerCase()
        if (!s) return options
        return options.filter((o) => ('label' in o ? o.label.toLowerCase().includes(s) : true))
      }}
      error={error}
      disabled={disabled}
      required={required}
    />
  )
}
