'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Textarea,
  NumberInput,
  Select,
  MultiSelect,
  Button,
  Stack,
  Group,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { usePortalRepClientes, useConsultarCnpj, useCriarCliente } from '@/data/hooks/portal-rep-app/usePortalRepClientes'
import { useCriarSolicitacao } from '@/data/hooks/portal-rep-app/usePortalRepOrcamentos'
import { portalRepApi } from '@/data/hooks/portal-rep-app/portal-rep-api'
import { Collapse, TextInput, Divider } from '@mantine/core'

// Hooks para buscar catálogo
function useTiposEmbalagem() {
  return useQuery<Array<{ id: string; codigo: string; descricao: string }>>({
    queryKey: ['portal-rep-catalogo-tipos-embalagem'],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/catalogo/tipos-embalagem')
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  })
}

function useAcabamentos() {
  return useQuery<Array<{ codigo: string; descricao: string }>>({
    queryKey: ['portal-rep-catalogo-acabamentos'],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/catalogo/acabamentos')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export default function NovaSolicitacaoPage() {
  const router = useRouter()
  const { data: clientes, isLoading: carregandoClientes } = usePortalRepClientes()
  const { data: tiposEmbalagem, isLoading: carregandoTipos } = useTiposEmbalagem()
  const { data: acabamentosDisponiveis, isLoading: carregandoAcabamentos } = useAcabamentos()
  const criarSolicitacao = useCriarSolicitacao()
  const consultarCnpj = useConsultarCnpj()
  const criarCliente = useCriarCliente()

  // ─── Cliente novo (B2): cadastro com consulta de CNPJ ───────────────────────
  const [mostrarNovoCliente, setMostrarNovoCliente] = useState(false)
  const [novoCliente, setNovoCliente] = useState({
    cpfCnpj: '', razaoSocial: '', nomeFantasia: '', telefone: '', email: '',
    logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '',
  })

  async function buscarCnpj() {
    try {
      const d = await consultarCnpj.mutateAsync(novoCliente.cpfCnpj)
      setNovoCliente((c) => ({
        ...c,
        cpfCnpj: d.cpfCnpj || c.cpfCnpj,
        razaoSocial: d.razaoSocial || '',
        nomeFantasia: d.nomeFantasia || '',
        telefone: d.telefone || '',
        email: d.email || '',
        logradouro: d.logradouro || '',
        numero: d.numero || '',
        bairro: d.bairro || '',
        cidade: d.cidade || '',
        uf: d.uf || '',
        cep: d.cep || '',
      }))
      notifications.show({ message: 'Dados do CNPJ preenchidos. Confira e salve.', color: 'green' })
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || 'Não foi possível consultar o CNPJ. Preencha manualmente.',
        color: 'orange',
      })
    }
  }

  async function salvarNovoCliente() {
    if (!novoCliente.razaoSocial.trim() || novoCliente.cpfCnpj.replace(/\D/g, '').length < 11) {
      notifications.show({ message: 'Informe ao menos CNPJ/CPF e razão social.', color: 'red' })
      return
    }
    try {
      const criado = await criarCliente.mutateAsync({
        razaoSocial: novoCliente.razaoSocial,
        nomeFantasia: novoCliente.nomeFantasia || undefined,
        cpfCnpj: novoCliente.cpfCnpj,
        telefone: novoCliente.telefone || undefined,
        email: novoCliente.email || undefined,
        logradouro: novoCliente.logradouro || undefined,
        numero: novoCliente.numero || undefined,
        bairro: novoCliente.bairro || undefined,
        cidade: novoCliente.cidade || undefined,
        uf: novoCliente.uf || undefined,
        cep: novoCliente.cep || undefined,
      })
      notifications.show({ message: 'Cliente cadastrado e selecionado.', color: 'green' })
      setClienteId(criado.id)
      setMostrarNovoCliente(false)
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || 'Falha ao cadastrar cliente.',
        color: 'red',
      })
    }
  }

  const [clienteId, setClienteId] = useState<string | null>(null)
  const [tipoEmbalagem, setTipoEmbalagem] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState<number | ''>('')
  const [medidaLargura, setMedidaLargura] = useState<number | ''>('')
  const [medidaAltura, setMedidaAltura] = useState<number | ''>('')
  const [medidaComprimento, setMedidaComprimento] = useState<number | ''>('')
  const [acabamentosSelecionados, setAcabamentosSelecionados] = useState<string[]>([])
  const [observacoes, setObservacoes] = useState('')

  const clienteOptions = (clientes ?? []).map((c) => ({
    value: c.id,
    label: c.razaoSocial + (c.nomeFantasia ? ` (${c.nomeFantasia})` : ''),
  }))

  const tipoEmbalagemOptions = (tiposEmbalagem ?? []).map((t) => ({
    value: t.descricao,
    label: t.descricao,
  }))

  const acabamentosOptions = (acabamentosDisponiveis ?? []).map((a) => ({
    value: a.descricao,
    label: a.descricao,
  }))

  const formValido =
    !!clienteId &&
    !!tipoEmbalagem &&
    typeof quantidade === 'number' &&
    quantidade > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formValido || !clienteId || !tipoEmbalagem) return

    criarSolicitacao.mutate(
      {
        clienteId,
        tipoEmbalagem,
        quantidade: quantidade as number,
        ...(typeof medidaLargura === 'number' && medidaLargura > 0
          ? { medidaLargura }
          : {}),
        ...(typeof medidaAltura === 'number' && medidaAltura > 0
          ? { medidaAltura }
          : {}),
        ...(typeof medidaComprimento === 'number' && medidaComprimento > 0
          ? { medidaComprimento }
          : {}),
        ...(acabamentosSelecionados.length > 0
          ? { acabamentos: acabamentosSelecionados.join(', ') }
          : {}),
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      },
      {
        onSuccess: () => {
          notifications.show({
            message: 'Solicitação de orçamento enviada com sucesso!',
            color: 'green',
          })
          router.push('/portal-rep/orcamentos')
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          const msg =
            (error as unknown as { response?: { data?: { message?: string } } })
              .response?.data?.message || 'Erro ao enviar solicitação. Tente novamente.'
          notifications.show({
            message: msg,
            color: 'red',
          })
        },
      },
    )
  }

  return (
    <Stack gap="md" p="md">
      <Title order={3}>Nova Solicitação de Orçamento</Title>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Card>
            <Select
              label="Cliente"
              placeholder="Selecione o cliente"
              data={clienteOptions}
              value={clienteId}
              onChange={setClienteId}
              searchable
              nothingFoundMessage="Nenhum cliente encontrado"
              disabled={carregandoClientes}
              required
            />
            <Button
              variant="subtle"
              size="compact-sm"
              mt="xs"
              onClick={() => setMostrarNovoCliente((v) => !v)}
            >
              {mostrarNovoCliente ? 'Cancelar cadastro' : 'Não achou? Cadastrar cliente novo'}
            </Button>
            <Collapse in={mostrarNovoCliente}>
              <Divider my="sm" label="Novo cliente" labelPosition="left" />
              <Stack gap="xs">
                <Group align="flex-end" gap="xs">
                  <TextInput
                    label="CNPJ"
                    placeholder="Somente números"
                    value={novoCliente.cpfCnpj}
                    onChange={(e) => setNovoCliente((c) => ({ ...c, cpfCnpj: e.currentTarget.value }))}
                    style={{ flex: 1 }}
                  />
                  <Button variant="light" loading={consultarCnpj.isPending} onClick={buscarCnpj}>
                    Buscar na Receita
                  </Button>
                </Group>
                <TextInput label="Razão social" value={novoCliente.razaoSocial}
                  onChange={(e) => setNovoCliente((c) => ({ ...c, razaoSocial: e.currentTarget.value }))} required />
                <TextInput label="Nome fantasia" value={novoCliente.nomeFantasia}
                  onChange={(e) => setNovoCliente((c) => ({ ...c, nomeFantasia: e.currentTarget.value }))} />
                <Group grow>
                  <TextInput label="Cidade" value={novoCliente.cidade}
                    onChange={(e) => setNovoCliente((c) => ({ ...c, cidade: e.currentTarget.value }))} />
                  <TextInput label="UF" maxLength={2} value={novoCliente.uf}
                    onChange={(e) => setNovoCliente((c) => ({ ...c, uf: e.currentTarget.value.toUpperCase() }))} />
                </Group>
                <Group grow>
                  <TextInput label="Telefone" value={novoCliente.telefone}
                    onChange={(e) => setNovoCliente((c) => ({ ...c, telefone: e.currentTarget.value }))} />
                  <TextInput label="E-mail" value={novoCliente.email}
                    onChange={(e) => setNovoCliente((c) => ({ ...c, email: e.currentTarget.value }))} />
                </Group>
                <Button onClick={salvarNovoCliente} loading={criarCliente.isPending}>
                  Salvar e selecionar cliente
                </Button>
              </Stack>
            </Collapse>
          </Card>

          <Card>
            <Stack gap="sm">
              <Select
                label="Tipo de embalagem"
                placeholder="Selecione o tipo de embalagem"
                data={tipoEmbalagemOptions}
                value={tipoEmbalagem}
                onChange={setTipoEmbalagem}
                searchable
                nothingFoundMessage="Nenhum tipo encontrado"
                disabled={carregandoTipos}
                required
              />

              <NumberInput
                label="Quantidade"
                placeholder="Quantidade desejada"
                min={1}
                value={quantidade}
                onChange={(val) => setQuantidade(val === '' ? '' : Number(val))}
                required
              />

              <Group grow>
                <NumberInput
                  label="Largura (mm)"
                  placeholder="mm"
                  min={0}
                  value={medidaLargura}
                  onChange={(val) => setMedidaLargura(val === '' ? '' : Number(val))}
                />
                <NumberInput
                  label="Altura (mm)"
                  placeholder="mm"
                  min={0}
                  value={medidaAltura}
                  onChange={(val) => setMedidaAltura(val === '' ? '' : Number(val))}
                />
                <NumberInput
                  label="Comprimento (mm)"
                  placeholder="mm"
                  min={0}
                  value={medidaComprimento}
                  onChange={(val) => setMedidaComprimento(val === '' ? '' : Number(val))}
                />
              </Group>

              <MultiSelect
                label="Acabamentos"
                placeholder="Selecione os acabamentos desejados"
                data={acabamentosOptions}
                value={acabamentosSelecionados}
                onChange={setAcabamentosSelecionados}
                searchable
                nothingFoundMessage="Nenhum acabamento encontrado"
                disabled={carregandoAcabamentos}
              />

              <Textarea
                label="Observações"
                placeholder="Informações adicionais sobre a solicitação"
                value={observacoes}
                onChange={(e) => setObservacoes(e.currentTarget.value)}
                minRows={3}
                autosize
              />
            </Stack>
          </Card>

          <Button
            type="submit"
            fullWidth
            loading={criarSolicitacao.isPending}
            disabled={!formValido || criarSolicitacao.isPending}
          >
            Enviar Solicitação
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}
