'use client'

import { useEffect, useRef, useState } from 'react'
import { Autocomplete } from '@mantine/core'
import { portalRepApi } from '@/data/hooks/portal-rep-app/portal-rep-api'

interface Municipio { codigo: string; nome: string; uf: string }

interface Props {
  label?: string
  uf: string
  value: string
  onChange: (nome: string) => void
  withAsterisk?: boolean
}

const semAcento = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Cidade com busca nos municípios do IBGE (filtrada pela UF). Aceita digitação livre. */
export function CidadeAutocomplete({ label = 'Cidade', uf, value, onChange, withAsterisk }: Props) {
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const cache = useRef<Record<string, Municipio[]>>({})

  useEffect(() => {
    if (!uf || uf.length !== 2) { setMunicipios([]); return }
    if (cache.current[uf]) { setMunicipios(cache.current[uf]); return }
    portalRepApi.get('/catalogo/municipios', { params: { uf } })
      .then(({ data }) => { cache.current[uf] = data ?? []; setMunicipios(data ?? []) })
      .catch(() => setMunicipios([]))
  }, [uf])

  const busca = semAcento(value || '')
  const opcoes = municipios
    .filter((m) => busca.length < 2 || semAcento(m.nome).includes(busca))
    .slice(0, 50)
    .map((m) => m.nome)

  return (
    <Autocomplete
      label={label}
      withAsterisk={withAsterisk}
      placeholder={uf ? 'Digite o nome da cidade' : 'Selecione a UF primeiro'}
      value={value}
      onChange={onChange}
      data={opcoes}
    />
  )
}
