'use client'

import { useState, useEffect, useCallback } from 'react'
import { Stack, Autocomplete, Text, Group, Badge, Loader } from '@mantine/core'
import { IconUser, IconSearch } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { useDebouncedValue } from '@mantine/hooks'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface ClienteOption {
  value: string
  label: string
  id: string
}

export default function StepCliente({ formData, updateForm }: Props) {
  const [busca, setBusca] = useState(formData.clienteNome || '')
  const [debounced] = useDebouncedValue(busca, 300)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [vendedores, setVendedores] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)

  // Buscar clientes. Sem termo (ou 1 char), traz uma lista inicial para o
  // dropdown já mostrar opções ao focar — antes exigia 2+ chars e ficava vazio.
  useEffect(() => {
    const termo = debounced?.trim() || ''
    setLoading(true)
    api.get('/clientes', { params: termo ? { busca: termo, limit: 20 } : { limit: 20 } })
      .then(({ data }) => {
        const items = (data.data || data || []).map((c: any) => ({
          value: c.nome || c.razaoSocial || c.nomeFantasia || '',
          label: c.nome || c.razaoSocial || c.nomeFantasia || '',
          id: c.id,
        })).filter((c: ClienteOption) => c.label)
        setClientes(items)
      })
      .catch(() => setClientes([]))
      .finally(() => setLoading(false))
  }, [debounced])

  // Buscar vendedores
  useEffect(() => {
    api.get('/vendedores', { params: { status: true } })
      .then(({ data }) => {
        const items = (data.data || data || []).map((v: any) => ({
          value: v.id,
          label: v.nome || v.nomeCompleto || v.usuario?.nome || 'Vendedor',
        }))
        setVendedores(items)
      })
      .catch(() => {})
  }, [])

  const handleClienteSelect = useCallback((value: string) => {
    setBusca(value)
    const selected = clientes.find(c => c.label === value)
    if (selected) {
      updateForm({ clienteId: selected.id, clienteNome: selected.label })
    } else {
      updateForm({ clienteId: null, clienteNome: value })
    }
  }, [clientes, updateForm])

  const handleClienteChange = useCallback((value: string) => {
    setBusca(value)
    if (!value.trim()) {
      updateForm({ clienteId: null, clienteNome: '' })
    } else {
      // While typing, treat as prospect
      updateForm({ clienteId: null, clienteNome: value })
    }
  }, [updateForm])

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Selecione o Cliente</Text>
      <Text size="sm" c="dimmed">
        Busque um cliente cadastrado ou digite o nome de um prospect.
      </Text>

      <Autocomplete
        label="Cliente"
        placeholder="Busque por nome, razão social..."
        leftSection={<IconSearch size={16} />}
        data={Array.from(new Set(clientes.map(c => c.label)))}
        value={busca}
        onChange={handleClienteChange}
        onOptionSubmit={handleClienteSelect}
        rightSection={loading ? <Loader size="xs" /> : undefined}
        limit={20}
      />

      {formData.clienteId && (
        <Group gap="xs">
          <Badge color="green" variant="light" leftSection={<IconUser size={12} />}>
            Cliente cadastrado
          </Badge>
          <Text size="sm">{formData.clienteNome}</Text>
        </Group>
      )}

      {!formData.clienteId && formData.clienteNome.trim() && (
        <Group gap="xs">
          <Badge color="orange" variant="light">Prospect</Badge>
          <Text size="sm">{formData.clienteNome}</Text>
        </Group>
      )}

      <Autocomplete
        label="Vendedor"
        placeholder="Selecione o vendedor"
        data={vendedores.map(v => v.label)}
        value={vendedores.find(v => v.value === formData.vendedorId)?.label || ''}
        onOptionSubmit={(label) => {
          const found = vendedores.find(v => v.label === label)
          if (found) updateForm({ vendedorId: found.value })
        }}
        onChange={(val) => {
          if (!val) updateForm({ vendedorId: null })
        }}
      />
    </Stack>
  )
}
