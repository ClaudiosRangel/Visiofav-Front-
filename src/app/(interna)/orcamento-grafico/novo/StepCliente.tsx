'use client'

import { useState, useEffect, useCallback } from 'react'
import { Stack, Autocomplete, Text, Group, Badge, Loader, Button, Collapse, Divider, TextInput, SimpleGrid } from '@mantine/core'
import { IconUser, IconSearch, IconUserPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useDebouncedValue } from '@mantine/hooks'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  // Só exibe o campo "Repetição de produto" no fluxo de repetição. No orçamento
  // novo (default) o campo fica oculto — a repetição real é feita por "Puxar
  // Cálculo", não pelo wizard.
  mostrarRepeticaoProduto?: boolean
}

interface ClienteOption {
  value: string
  label: string
  id: string
}

export default function StepCliente({ formData, updateForm, mostrarRepeticaoProduto = false }: Props) {
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
        const items = (data.data || data || []).map((c: any) => {
          const razao = c.razaoSocial || c.nome || ''
          const fantasia = (c.nomeFantasia || '').trim()
          // Nome base = razão social; acrescenta o nome fantasia entre parênteses
          // quando existir e for diferente da razão (ajuda a localizar pelo nome
          // comercial, ex.: "MARBRAN... (SOL & NEVE)").
          const base = fantasia && fantasia.toLowerCase() !== razao.toLowerCase()
            ? `${razao} (${fantasia})`
            : razao
          // Mostra o código do Calcgraf junto do nome quando existir, para o
          // usuário conferir/localizar pelo código (de-para por CNPJ já importado).
          const label = c.codigoCalcgraf ? `${c.codigoCalcgraf} - ${base}` : base
          return { value: label, label, id: c.id }
        }).filter((c: ClienteOption) => c.label)
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

  // Produtos cadastrados (modo Repetição — opcional)
  const [buscaProduto, setBuscaProduto] = useState(formData.produtoNome || '')
  const [debouncedProduto] = useDebouncedValue(buscaProduto, 300)
  const [produtos, setProdutos] = useState<{ id: string; label: string }[]>([])

  useEffect(() => {
    const termo = debouncedProduto?.trim() || ''
    api.get('/produtos', { params: termo ? { busca: termo, limit: 20 } : { limit: 20 } })
      .then(({ data }) => {
        const items = (data.data || data || []).map((p: any) => ({
          id: p.id,
          label: `${p.codigo} - ${p.nome}`,
        }))
        setProdutos(items)
      })
      .catch(() => setProdutos([]))
  }, [debouncedProduto])

  // ─── Cadastro de cliente novo com consulta de CNPJ (fluxo interno) ──────────
  const [mostrarNovo, setMostrarNovo] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [novo, setNovo] = useState({
    cpfCnpj: '', razaoSocial: '', nomeFantasia: '', telefone: '', email: '',
    cidade: '', uf: '', logradouro: '', numero: '', bairro: '', cep: '',
  })
  const setN = (k: keyof typeof novo, v: string) => setNovo((s) => ({ ...s, [k]: v }))

  async function buscarCnpjNovo() {
    const dig = novo.cpfCnpj.replace(/\D/g, '')
    if (dig.length !== 14) {
      notifications.show({ message: 'Informe um CNPJ com 14 dígitos.', color: 'red' })
      return
    }
    setBuscandoCnpj(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/consulta-cnpj/${dig}`)
      setNovo((s) => ({
        ...s,
        cpfCnpj: data.cpfCnpj || s.cpfCnpj,
        razaoSocial: data.razaoSocial || '',
        nomeFantasia: data.nomeFantasia || '',
        telefone: data.telefone || '',
        email: data.email || '',
        cidade: data.cidade || '',
        uf: data.uf || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        cep: data.cep || '',
      }))
      notifications.show({ message: 'Dados do CNPJ preenchidos. Confira e salve.', color: 'green' })
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Não foi possível consultar o CNPJ.', color: 'orange' })
    } finally {
      setBuscandoCnpj(false)
    }
  }

  async function salvarClienteNovo() {
    if (!novo.razaoSocial.trim() || novo.cpfCnpj.replace(/\D/g, '').length < 11) {
      notifications.show({ message: 'Informe ao menos CNPJ/CPF e razão social.', color: 'red' })
      return
    }
    setSalvandoCliente(true)
    try {
      const { data } = await api.post('/clientes', {
        razaoSocial: novo.razaoSocial,
        nomeFantasia: novo.nomeFantasia || undefined,
        cpfCnpj: novo.cpfCnpj,
        telefone: novo.telefone || undefined,
        email: novo.email || undefined,
        logradouro: novo.logradouro || undefined,
        numero: novo.numero || undefined,
        bairro: novo.bairro || undefined,
        cidade: novo.cidade || undefined,
        uf: novo.uf || undefined,
        cep: novo.cep || undefined,
      })
      const criado = data?.data ?? data
      const nomeLabel = novo.nomeFantasia && novo.nomeFantasia.toLowerCase() !== novo.razaoSocial.toLowerCase()
        ? `${novo.razaoSocial} (${novo.nomeFantasia})`
        : novo.razaoSocial
      updateForm({ clienteId: criado.id, clienteNome: nomeLabel })
      setBusca(nomeLabel)
      setMostrarNovo(false)
      notifications.show({ message: 'Cliente cadastrado e selecionado.', color: 'green' })
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Falha ao cadastrar cliente.', color: 'red' })
    } finally {
      setSalvandoCliente(false)
    }
  }

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
        placeholder="Busque por nome, razão social, CNPJ ou código..."
        leftSection={<IconSearch size={16} />}
        data={Array.from(new Set(clientes.map(c => c.label)))}
        value={busca}
        onChange={handleClienteChange}
        onOptionSubmit={handleClienteSelect}
        rightSection={loading ? <Loader size="xs" /> : undefined}
        limit={20}
      />

      <Button
        variant="subtle"
        size="compact-sm"
        leftSection={<IconUserPlus size={14} />}
        onClick={() => setMostrarNovo((v) => !v)}
        style={{ alignSelf: 'flex-start' }}
      >
        {mostrarNovo ? 'Cancelar cadastro' : 'Não achou? Cadastrar cliente novo'}
      </Button>
      <Collapse in={mostrarNovo}>
        <Divider my="xs" label="Novo cliente" labelPosition="left" />
        <Stack gap="xs">
          <Group align="flex-end" gap="xs">
            <TextInput
              label="CNPJ"
              placeholder="Somente números"
              value={novo.cpfCnpj}
              onChange={(e) => setN('cpfCnpj', e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button variant="light" loading={buscandoCnpj} onClick={buscarCnpjNovo}>Buscar na Receita</Button>
          </Group>
          <TextInput label="Razão social" value={novo.razaoSocial} onChange={(e) => setN('razaoSocial', e.currentTarget.value)} required />
          <TextInput label="Nome fantasia" value={novo.nomeFantasia} onChange={(e) => setN('nomeFantasia', e.currentTarget.value)} />
          <SimpleGrid cols={2}>
            <TextInput label="Cidade" value={novo.cidade} onChange={(e) => setN('cidade', e.currentTarget.value)} />
            <TextInput label="UF" maxLength={2} value={novo.uf} onChange={(e) => setN('uf', e.currentTarget.value.toUpperCase())} />
          </SimpleGrid>
          <SimpleGrid cols={2}>
            <TextInput label="Telefone" value={novo.telefone} onChange={(e) => setN('telefone', e.currentTarget.value)} />
            <TextInput label="E-mail" value={novo.email} onChange={(e) => setN('email', e.currentTarget.value)} />
          </SimpleGrid>
          <Button onClick={salvarClienteNovo} loading={salvandoCliente}>Salvar e selecionar cliente</Button>
        </Stack>
      </Collapse>

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

      {mostrarRepeticaoProduto && (
        <>
          <Autocomplete
            label="Repetição de produto (opcional)"
            description="Se for reimpressão de um produto já cadastrado, selecione-o para a OP usar a estrutura (BOM) e o roteiro dele."
            placeholder="Buscar produto cadastrado..."
            data={Array.from(new Set(produtos.map(p => p.label)))}
            value={buscaProduto}
            onChange={(val) => {
              setBuscaProduto(val)
              if (!val) updateForm({ produtoId: null, produtoNome: '' })
            }}
            onOptionSubmit={(label) => {
              const found = produtos.find(p => p.label === label)
              setBuscaProduto(label)
              updateForm({ produtoId: found ? found.id : null, produtoNome: label })
            }}
            limit={20}
          />

          {formData.produtoId && (
            <Group gap="xs">
              <Badge color="blue" variant="light">Repetição</Badge>
              <Text size="sm">{formData.produtoNome}</Text>
            </Group>
          )}
        </>
      )}
    </Stack>
  )
}
