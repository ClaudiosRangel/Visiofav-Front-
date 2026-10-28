'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Modal, Stack, Autocomplete, Text, Group, Badge, Loader, Button, Alert,
} from '@mantine/core'
import { IconUser, IconSearch, IconAlertCircle } from '@tabler/icons-react'
import { useDebouncedValue } from '@mantine/hooks'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Modal enxuto "Editar Cabeçalho" (Ponto 10 / Req 7 dos ajustes de Caio).
//
// Substitui o antigo redirecionamento ao wizard inteiro. Edita SOMENTE o
// cliente e o representante/vendedor, chamando PUT /orcamento-grafico/:id com
// apenas { clienteId?, clienteNome?, vendedorId? }. Como o PUT não recebe
// gramatura/precoKg/resultadoCalculo, o backend NÃO recalcula — preserva tipo
// de embalagem, medidas, itens e resultado (Req 7.3). O PUT filtra por
// empresaId (404 cross-empresa — Req 7.4) e exige status RASCUNHO.
//
// Reaproveita o padrão de Autocomplete do StepCliente (debounce + mapeamento).
// ============================================================================

interface Props {
  opened: boolean
  onClose: () => void
  orcamentoId: string
  // Valores atuais do cabeçalho para semear os campos ao abrir.
  clienteId?: string | null
  clienteNome?: string | null
  vendedorId?: string | null
  // Recarrega o detalhe do orçamento após salvar.
  onSalvo: () => void
}

interface ClienteOption {
  value: string
  label: string
  id: string
}

export default function EditarCabecalhoModal({
  opened,
  onClose,
  orcamentoId,
  clienteId,
  clienteNome,
  vendedorId,
  onSalvo,
}: Props) {
  // Estado do cliente (mesma lógica do StepCliente: ao selecionar grava o id;
  // enquanto digita, trata como prospect — só clienteNome).
  const [busca, setBusca] = useState('')
  const [debounced] = useDebouncedValue(busca, 300)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [clienteIdSel, setClienteIdSel] = useState<string | null>(null)
  const [clienteNomeSel, setClienteNomeSel] = useState('')
  const [loadingClientes, setLoadingClientes] = useState(false)

  // Estado do vendedor.
  const [vendedores, setVendedores] = useState<{ value: string; label: string }[]>([])
  const [vendedorIdSel, setVendedorIdSel] = useState<string | null>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Semear os campos com os valores atuais sempre que o modal abrir.
  useEffect(() => {
    if (opened) {
      setBusca(clienteNome || '')
      setClienteIdSel(clienteId ?? null)
      setClienteNomeSel(clienteNome || '')
      setVendedorIdSel(vendedorId ?? null)
      setErro(null)
    }
  }, [opened, clienteId, clienteNome, vendedorId])

  // Buscar clientes de /clientes (mesmo padrão do StepCliente).
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
            // Razão social + nome fantasia entre parênteses (quando houver e for
            // diferente), para localizar também pelo nome comercial.
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

  // Buscar vendedores ativos de /vendedores.
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
    // Enquanto digita, trata como prospect (sem clienteId).
    setClienteIdSel(null)
    setClienteNomeSel(value)
  }, [])

  const handleSalvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      // Envia SOMENTE cliente + vendedor. Quando um cliente cadastrado é
      // escolhido, manda clienteId; senão manda clienteNome (prospect) e
      // desvincula o clienteId antigo.
      const payload: Record<string, unknown> = {
        vendedorId: vendedorIdSel ?? null,
      }
      if (clienteIdSel) {
        payload.clienteId = clienteIdSel
        payload.clienteNome = clienteNomeSel || null
      } else {
        payload.clienteId = null
        payload.clienteNome = clienteNomeSel?.trim() || null
      }

      await api.put(`/orcamento-grafico/${orcamentoId}`, payload)
      notifications.show({
        title: 'Cabeçalho atualizado',
        message: 'Cliente e vendedor atualizados com sucesso.',
        color: 'green',
      })
      onClose()
      onSalvo()
    } catch (err: any) {
      // Exibe a mensagem retornada pelo PUT (404 cross-empresa / 400 não-rascunho).
      const msg =
        err?.response?.data?.message || 'Falha ao atualizar o cabeçalho do orçamento.'
      setErro(msg)
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Editar Cabeçalho" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Altere apenas o cliente e o representante/vendedor. Tipo de embalagem,
          medidas, itens e resultado do cálculo permanecem inalterados.
        </Text>

        {erro && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Não foi possível salvar">
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

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} loading={salvando}>
            Salvar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
