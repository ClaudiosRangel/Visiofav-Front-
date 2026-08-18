'use client'

import { useState, useEffect, useRef } from 'react'
import { Autocomplete } from '@mantine/core'
import { api } from '@/lib/api'

interface Municipio {
  codigo: string
  nome: string
  uf: string
}

interface Props {
  label?: string
  uf: string
  value: string
  onChange: (nome: string) => void
  onSelect: (municipio: Municipio) => void
  required?: boolean
  placeholder?: string
}

export function MunicipioAutocomplete({ label = 'Município', uf, value, onChange, onSelect, required, placeholder }: Props) {
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Record<string, Municipio[]>>({})

  useEffect(() => {
    if (!uf || uf.length !== 2) {
      setMunicipios([])
      return
    }

    if (cacheRef.current[uf]) {
      setMunicipios(cacheRef.current[uf])
      return
    }

    setLoading(true)
    api.get('/fiscal/cte/municipios', { params: { uf } })
      .then(({ data }) => {
        const lista = (data as Municipio[]) || []
        cacheRef.current[uf] = lista
        setMunicipios(lista)
      })
      .catch(() => setMunicipios([]))
      .finally(() => setLoading(false))
  }, [uf])

  const options = municipios
    .filter(m => {
      if (!value || value.length < 2) return true
      const busca = value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const nome = m.nome.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return nome.includes(busca)
    })
    .slice(0, 50)
    .map(m => ({ value: `${m.nome} (${m.codigo})`, label: m.nome }))

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder || (uf ? 'Digite o nome...' : 'Selecione a UF primeiro')}
      value={value}
      onChange={(val) => {
        // Se o usuário selecionou um item da lista (contém parêntese com código)
        const match = val.match(/^(.+?)\s*\((\d{7})\)$/)
        if (match) {
          const nome = match[1].trim()
          const codigo = match[2]
          const mun = municipios.find(m => m.codigo === codigo)
          onChange(nome)
          if (mun) onSelect(mun)
        } else {
          onChange(val)
        }
      }}
      onOptionSubmit={(val) => {
        const match = val.match(/^(.+?)\s*\((\d{7})\)$/)
        if (match) {
          const nome = match[1].trim()
          const codigo = match[2]
          const mun = municipios.find(m => m.codigo === codigo)
          onChange(nome)
          if (mun) onSelect(mun)
        }
      }}
      data={options.map(o => o.value)}
      required={required}
      disabled={!uf || uf.length !== 2}
      limit={30}
    />
  )
}
