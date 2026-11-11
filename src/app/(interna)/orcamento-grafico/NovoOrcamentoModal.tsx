'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Modal, Stack, Autocomplete, Select, Text, Group, Badge, Loader, Button, Alert,
} from '@mantine/core'
import { IconUser, IconSearch, IconAlertCircle, IconCategory } from '@tabler/icons-react'
import { useDebouncedValue } from '@mantine/hooks'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Modal "Novo Orçamento" (Caminho A / A1).
//
// Captura o CABEÇALHO (Cliente + Vendedor + Linha de Produto) e, ao confirmar,
// cria um orçamento RASCUNHO via POST /orcamento-grafico/cabecalho (gravado
// imediatamente — A1) e chama `onCriado(id)` para a lista navegar ao detalhe,
// onde o Editor de página única abre para montar o produto do 1º item.
//
// Reaproveita o padrão de busca de cliente/vendedor do EditarCabecalhoModal.
// ============================================================================

interface Props {
  opened: boolean
  onClose: () => void
  /** Chamado com o id do orçamento recém-criado. */
  onCriado: (id: string) => void
}

interface ClienteOption {
  value: string
  label: string
  id: string
}

interface LinhaProdutoOption {
  id: string
  nome: string
  ativo: boolean
}

export default function NovoOrcamentoModal({ opened, onClose, onCriado }: Props) {
  const [busca, setBusca] = useState('')
  const [debounced] = useDebouncedValue(busca, 300)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [clienteIdSel, setClienteIdSel] = useState<string | null>(null)
  const [clienteNomeSel, setClienteNomeSel] = useState('')
  const [loadingClientes, setLoadingClientes] = useState(false)

  const [vendedores, setVendedores] = useState<{ value: string; label: string }[]>([])
  const [vendedorIdSel, setVendedorIdSel] = useState<string | null>(null)

  const [linhas, setLinhas] = useState<LinhaProdutoOption[]>([])
  const [linhaIdSel, setLinhaIdSel] = useState<string | null>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Reset ao abrir.
  useEffect(() => {
    if (opened) {
      setBusca('')
      setClienteIdSel(null)
      setClienteNomeSel('')
      setVendedorIdSel(null)
      setLinhaIdSel(null)
      setErro(null)
    }
  }, [opened])

  // Buscar clientes.
  useEffect(() => {
    if (!opened) return
    const termo = debounced?.trim() || ''
    setLoadingClientes(true)
    api
      .get('/clientes', { params: termo ? { busca: termo, limit: 20 } : { limit: 20 } })
      .then(({ data }) => {
        const items = (data.data || data || [])
          .map((c: any) => {
            const razao = c.razaoSocial || c.nome || ''
            const fantasia = (c.nomeFantasia || '').trim()
            const base = fantasia && fantasia.toLowerCase() !== razao.toLowerCase()
              ? `${razao} (${fantasia})`
              : razao
            const label = c.codigoCalcgraf ? `${c.codigoCalcgraf} - ${base}` : base
            return { value: label, label, id: c.id }
          })
          .filter((c: ClienteOption) => c.label)
        setClientes(items)
      })
      .catch(() => setClientes([]))
      .finally(() => setLoadingClientes(false))
  }, [debounced, opened])

  // Buscar vendedores ativos.
  useEffect(() => {
    if (!opened) return
    api
      .get('/vendedores', { params: { status: true } })
      .then(({ data }) => {
        const items = (data.data || data || []).map((v: any) => ({
          value: v.id,
          label: v.nome || v.nomeCompleto || v.usuario?.nome || 'Vendedor',
        }))
        setVendedores(items)
      })
      .catch(() => {})
  }, [opened])

  // Buscar linhas de produto ativas.
  useEffect(() => {
    if (!opened) return
    api
      .get('/orcamento-grafico/linhas-produto', { params: { situacao: 'ativa' } })
      .then(({ data }) => setLinhas(Array.isArray(data) ? data : data?.data ?? []))
      .catch(() => setLinhas([]))
  }, [opened])

  const handleClienteSelect = useCallback(
    (value: string) => {
      setBusca(value)
      const selected = clientes.find((c) => c.label === value)
      if (selected) {
        setClienteIdSel(selected.id)
        setClienteNomeSel(selected.label)
      } else {
        setClienteIdSel(null)
        setClienteNomeSel(value)
      }
    },
    [clientes],
  )

  const handleClienteChange = useCallback((value: string) => {
    setBusca(value)
    setClienteIdSel(null)
    setClienteNomeSel(value)
  }, [])

  const handleCriar = async () => {
    if (!clienteIdSel && !clienteNomeSel.trim()) {
      setErro('Informe o cliente (cadastrado ou nome livre).')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const payload: Record<string, unknown> = {
        vendedorId: vendedorIdSel ?? null,
        linhaProdutoId: linhaIdSel ?? null,
      }
      if (clienteIdSel) {
        payload.clienteId = clienteIdSel
        payload.clienteNome = clienteNomeSel || null
      } else {
        payload.clienteNome = clienteNomeSel.trim()
      }

      const { data } = await api.post('/orcamento-grafico/cabecalho', payload)
      onClose()
      onCriado(data.id)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao criar o orçamento.'
      setErro(msg)
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Novo Orçamento" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Informe o cliente, o representante e a linha de produto. Em seguida você
          monta o produto no editor.
        </Text>

        {erro && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Não foi possível criar">
            {erro}
          </Alert>
        )}

        <Autocomplete
          label="Cliente"
          placeholder="Busque por nome, razão social, CNPJ ou código..."
          leftSection={<IconSearch size={16} />}
          data={Array.from(new Set(clientes.map((c) => c.label)))}
          value={busca}
          onChange={handleClienteChange}
          onOptionSubmit={handleClienteSelect}
          rightSection={loadingClientes ? <Loader size="xs" /> : undefined}
          limit={20}
          withAsterisk
        />

        {clienteIdSel && (
          <Group gap="xs">
            <Badge color="green" variant="light" leftSection={<IconUser size={12} />}>
              Cliente cadastrado
            </Badge>
            <Text size="sm">{clienteNomeSel}</Text>
          </Group>
        )}
        {!clienteIdSel && clienteNomeSel.trim() && (
          <Group gap="xs">
            <Badge color="orange" variant="light">Prospect</Badge>
            <Text size="sm">{clienteNomeSel}</Text>
          </Group>
        )}

        <Autocomplete
          label="Representante/Vendedor"
          placeholder="Selecione o vendedor"
          data={vendedores.map((v) => v.label)}
          value={vendedores.find((v) => v.value === vendedorIdSel)?.label || ''}
          onOptionSubmit={(label) => {
            const found = vendedores.find((v) => v.label === label)
            if (found) setVendedorIdSel(found.value)
          }}
          onChange={(val) => {
            if (!val) setVendedorIdSel(null)
          }}
        />

        <Select
          label="Linha de Produto"
          placeholder="Selecione a linha (opcional)..."
          leftSection={<IconCategory size={16} />}
          searchable
          clearable
          data={linhas.map((l) => ({ value: l.id, label: l.nome }))}
          value={linhaIdSel}
          onChange={setLinhaIdSel}
          comboboxProps={{ withinPortal: true }}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleCriar} loading={salvando}>
            Criar e abrir editor
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
