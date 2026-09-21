'use client'

import { useEffect, useState } from 'react'
import { Group, Select, Checkbox } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Filtro em cascata reutilizável da Hierarquia Mercadológica (Fase 2).
 * Departamento → Seção → Categoria → Subcategoria/Família. Selecionar uma
 * camada restringe a inferior aos filhos diretos; trocar/limpar uma camada
 * limpa as inferiores. Emite o `nivelId` do nível mais profundo escolhido, ou
 * `semHierarquia` quando o checkbox está marcado (mutuamente exclusivos).
 */

interface Nivel {
  id: string
  tipo: 'DEPARTAMENTO' | 'SECAO' | 'CATEGORIA' | 'SUBCATEGORIA'
  paiId: string | null
  codigoHierarquico: string
  descricao: string
}

export interface FiltroHierarquiaValor {
  nivelId: string | null
  semHierarquia: boolean
}

interface Props {
  value: FiltroHierarquiaValor
  onChange: (v: FiltroHierarquiaValor) => void
}

export default function FiltroCascataHierarquia({ value, onChange }: Props) {
  const { data } = useQuery<any>({
    queryKey: ['hierarquia-todos-filtro'],
    queryFn: async () => {
      const { data } = await api.get('/hierarquia-mercadologica', { params: { status: true, limit: 2000 } })
      return data
    },
    staleTime: 1000 * 60,
  })
  const niveis: Nivel[] = data?.data || []

  const [depId, setDepId] = useState<string | null>(null)
  const [secId, setSecId] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  const [subId, setSubId] = useState<string | null>(null)

  const opcoes = (tipo: Nivel['tipo'], paiId: string | null) =>
    niveis
      .filter((n) => n.tipo === tipo && (paiId === null ? true : n.paiId === paiId))
      .sort((a, b) => a.codigoHierarquico.localeCompare(b.codigoHierarquico))
      .map((n) => ({ value: n.id, label: `${n.codigoHierarquico} — ${n.descricao}` }))

  // Emite o nível mais profundo escolhido sempre que a cascata muda.
  useEffect(() => {
    if (value.semHierarquia) return
    const nivelId = subId || catId || secId || depId || null
    if (nivelId !== value.nivelId) onChange({ nivelId, semHierarquia: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depId, secId, catId, subId])

  function limparCascata() {
    setDepId(null); setSecId(null); setCatId(null); setSubId(null)
  }

  return (
    <Group align="flex-end" gap="sm" wrap="wrap">
      <Select
        label="Departamento" placeholder="Todos" clearable searchable w={200}
        data={opcoes('DEPARTAMENTO', null)}
        value={depId}
        disabled={value.semHierarquia}
        onChange={(v) => { setDepId(v); setSecId(null); setCatId(null); setSubId(null) }}
      />
      <Select
        label="Seção" placeholder={depId ? 'Todas' : '—'} clearable searchable w={200}
        data={opcoes('SECAO', depId)}
        value={secId}
        disabled={value.semHierarquia || !depId}
        onChange={(v) => { setSecId(v); setCatId(null); setSubId(null) }}
      />
      <Select
        label="Categoria" placeholder={secId ? 'Todas' : '—'} clearable searchable w={200}
        data={opcoes('CATEGORIA', secId)}
        value={catId}
        disabled={value.semHierarquia || !secId}
        onChange={(v) => { setCatId(v); setSubId(null) }}
      />
      <Select
        label="Subcategoria / Família" placeholder={catId ? 'Todas' : '—'} clearable searchable w={220}
        data={opcoes('SUBCATEGORIA', catId)}
        value={subId}
        disabled={value.semHierarquia || !catId}
        onChange={setSubId}
      />
      <Checkbox
        label="Sem hierarquia"
        checked={value.semHierarquia}
        onChange={(e) => {
          const marcado = e.currentTarget.checked
          if (marcado) limparCascata()
          onChange({ nivelId: null, semHierarquia: marcado })
        }}
        mb={8}
      />
    </Group>
  )
}
