'use client'

import { useState, useRef, useEffect } from 'react'
import { Autocomplete, Loader } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { api } from '@/lib/api'

export interface ParticipanteResult {
  tipo: 'cliente' | 'fornecedor'
  id: string
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  ie: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  codigoMunicipio: string
  municipio: string
  uf: string
  cep: string
  email: string
  telefone: string
}

interface Props {
  label?: string
  placeholder?: string
  onSelect: (participante: ParticipanteResult) => void
}

export function ParticipanteAutocomplete({ label = 'Buscar por nome', placeholder = 'Digite razão social, nome fantasia ou CNPJ...', onSelect }: Props) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const resultadosRef = useRef<ParticipanteResult[]>([])

  const [debounced] = useDebouncedValue(value, 300)

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setOptions([])
      resultadosRef.current = []
      return
    }

    setLoading(true)
    api.get('/fiscal/cte/buscar-participantes', { params: { q: debounced } })
      .then(({ data }) => {
        const lista = (data as ParticipanteResult[]) || []
        resultadosRef.current = lista
        setOptions(lista.map(r => {
          const tipo = r.tipo === 'cliente' ? '🟢' : '🔵'
          const doc = r.cnpj ? ` (${r.cnpj})` : ''
          return `${tipo} ${r.razaoSocial}${doc}`
        }))
      })
      .catch(() => { setOptions([]); resultadosRef.current = [] })
      .finally(() => setLoading(false))
  }, [debounced])

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(val) => {
        setValue(val)
        if (!val) { setOptions([]); resultadosRef.current = [] }
      }}
      onOptionSubmit={(val) => {
        const idx = options.indexOf(val)
        if (idx >= 0 && resultadosRef.current[idx]) {
          onSelect(resultadosRef.current[idx])
          setValue('')
          setOptions([])
        }
      }}
      data={options}
      rightSection={loading ? <Loader size={16} /> : undefined}
      limit={15}
    />
  )
}
