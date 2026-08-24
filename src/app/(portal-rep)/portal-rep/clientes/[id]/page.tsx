'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  LoadingOverlay,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft, IconLock, IconDeviceFloppy, IconSend } from '@tabler/icons-react'
import {
  usePortalRepClientes,
  useEditarCliente,
  useSolicitarAlteracaoFiscal,
} from '@/data/hooks/portal-rep-app/usePortalRepClientes'
import { formatarDocumento } from '@/components/portal-rep/formatters'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import type { EditarClientePayload, SolicitarAlteracaoFiscalPayload } from '@/data/hooks/portal-rep-app/types'

export default function EditarClientePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: clientes, isLoading } = usePortalRepClientes()
  const editarMutation = useEditarCliente()
  const fiscalMutation = useSolicitarAlteracaoFiscal()

  const cliente = clientes?.find((c) => c.id === params.id) ?? null

  // Campos complementares editáveis
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [cep, setCep] = useState('')

  // Formulário de solicitação fiscal
  const [showFiscalForm, setShowFiscalForm] = useState(false)
  const [fiscalRazaoSocial, setFiscalRazaoSocial] = useState('')
  const [fiscalCpfCnpj, setFiscalCpfCnpj] = useState('')
  const [fiscalIe, setFiscalIe] = useState('')

  // Preencher formulário quando cliente carregar
  useEffect(() => {
    if (cliente) {
      setTelefone(cliente.telefone ?? '')
      setEmail(cliente.email ?? '')
      setLogradouro(cliente.logradouro ?? '')
      setNumero(cliente.numero ?? '')
      setComplemento(cliente.complemento ?? '')
      setBairro(cliente.bairro ?? '')
      setCidade(cliente.cidade ?? '')
      setUf(cliente.uf ?? '')
      setCep(cliente.cep ?? '')
    }
  }, [cliente])

  const handleSalvar = useCallback(async () => {
    if (!cliente) return

    const payload: EditarClientePayload & { id: string } = {
      id: cliente.id,
      telefone: telefone || undefined,
      email: email || undefined,
      logradouro: logradouro || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      uf: uf || undefined,
      cep: cep || undefined,
    }

    editarMutation.mutate(payload, {
      onSuccess: () => {
        notifications.show({
          message: 'Dados do cliente atualizados com sucesso!',
          color: 'green',
        })
      },
      onError: (err: any) => {
        notifications.show({
          message: err.response?.data?.message || 'Erro ao salvar dados do cliente',
          color: 'red',
        })
      },
    })
  }, [cliente, telefone, email, logradouro, numero, complemento, bairro, cidade, uf, cep, editarMutation])

  const handleSolicitarFiscal = useCallback(async () => {
    if (!cliente) return

    const payload: SolicitarAlteracaoFiscalPayload & { id: string } = {
      id: cliente.id,
      razaoSocial: fiscalRazaoSocial || undefined,
      cpfCnpj: fiscalCpfCnpj || undefined,
      inscricaoEstadual: fiscalIe || undefined,
    }

    if (!fiscalRazaoSocial && !fiscalCpfCnpj && !fiscalIe) {
      notifications.show({
        message: 'Preencha ao menos um campo fiscal para solicitar alteração',
        color: 'orange',
      })
      return
    }

    fiscalMutation.mutate(payload, {
      onSuccess: () => {
        notifications.show({
          message: 'Solicitação de alteração fiscal enviada para aprovação!',
          color: 'green',
        })
        setShowFiscalForm(false)
        setFiscalRazaoSocial('')
        setFiscalCpfCnpj('')
        setFiscalIe('')
      },
      onError: (err: any) => {
        notifications.show({
          message: err.response?.data?.message || 'Erro ao enviar solicitação fiscal',
          color: 'red',
        })
      },
    })
  }, [cliente, fiscalRazaoSocial, fiscalCpfCnpj, fiscalIe, fiscalMutation])

  // Loading
  if (isLoading) {
    return (
      <Stack gap="md" p="md">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
      </Stack>
    )
  }

  // Cliente não encontrado
  if (!cliente) {
    return (
      <Stack gap="md" p="md" align="center" mt="xl">
        <Text c="dimmed">Cliente não encontrado</Text>
        <Button variant="light" onClick={() => router.push('/portal-rep/clientes')}>
          Voltar para a lista
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="md">
      {/* Header */}
      <Group gap="sm">
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowLeft size={18} />}
          onClick={() => router.push('/portal-rep/clientes')}
        >
          Voltar
        </Button>
      </Group>

      <Title order={3}>{cliente.nomeFantasia || cliente.razaoSocial}</Title>

      {/* Seção: Dados Fiscais (somente leitura) */}
      <Card>
        <Stack gap="sm">
          <Group gap="xs">
            <IconLock size={16} color="gray" />
            <Text fw={600} size="sm" c="dimmed">
              Dados Fiscais (somente leitura)
            </Text>
          </Group>

          <Alert variant="light" color="gray" p="xs">
            <Text size="xs" c="dimmed">
              Alterações em dados fiscais requerem aprovação administrativa.
            </Text>
          </Alert>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Razão Social"
                value={cliente.razaoSocial}
                readOnly
                variant="filled"
                styles={{ input: { cursor: 'not-allowed', opacity: 0.8 } }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                label="CNPJ/CPF"
                value={formatarDocumento(cliente.cpfCnpj)}
                readOnly
                variant="filled"
                styles={{ input: { cursor: 'not-allowed', opacity: 0.8 } }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 2 }}>
              <TextInput
                label="Inscrição Estadual"
                value={cliente.inscricaoEstadual ?? '—'}
                readOnly
                variant="filled"
                styles={{ input: { cursor: 'not-allowed', opacity: 0.8 } }}
              />
            </Grid.Col>
          </Grid>

          <Button
            variant="light"
            color="orange"
            size="sm"
            onClick={() => setShowFiscalForm(!showFiscalForm)}
          >
            {showFiscalForm ? 'Cancelar solicitação' : 'Solicitar alteração fiscal'}
          </Button>

          {/* Formulário de solicitação de alteração fiscal */}
          {showFiscalForm && (
            <Box pos="relative">
              <LoadingOverlay visible={fiscalMutation.isPending} />
              <Card withBorder bg="orange.0">
                <Stack gap="sm">
                  <Text fw={600} size="sm">
                    Novos valores fiscais (preencha o que deseja alterar)
                  </Text>
                  <Grid>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <TextInput
                        label="Nova Razão Social"
                        placeholder="Deixe vazio para manter"
                        value={fiscalRazaoSocial}
                        onChange={(e) => setFiscalRazaoSocial(e.currentTarget.value)}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput
                        label="Novo CNPJ/CPF"
                        placeholder="Deixe vazio para manter"
                        value={fiscalCpfCnpj}
                        onChange={(e) => setFiscalCpfCnpj(e.currentTarget.value)}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 2 }}>
                      <TextInput
                        label="Nova IE"
                        placeholder="Deixe vazio para manter"
                        value={fiscalIe}
                        onChange={(e) => setFiscalIe(e.currentTarget.value)}
                      />
                    </Grid.Col>
                  </Grid>
                  <Group justify="flex-end">
                    <Button
                      leftSection={<IconSend size={16} />}
                      color="orange"
                      onClick={handleSolicitarFiscal}
                      loading={fiscalMutation.isPending}
                    >
                      Enviar solicitação
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </Box>
          )}
        </Stack>
      </Card>

      <Divider />

      {/* Seção: Dados Complementares (editáveis) */}
      <Card pos="relative">
        <LoadingOverlay visible={editarMutation.isPending} />
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Dados Complementares
          </Text>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Telefone"
                placeholder="(XX) XXXXX-XXXX"
                value={telefone}
                onChange={(e) => setTelefone(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="E-mail"
                placeholder="email@exemplo.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>

          <Divider label="Endereço" labelPosition="left" />

          <Grid>
            <Grid.Col span={{ base: 8, md: 4 }}>
              <TextInput
                label="CEP"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Logradouro"
                placeholder="Rua, Av..."
                value={logradouro}
                onChange={(e) => setLogradouro(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 4, md: 2 }}>
              <TextInput
                label="Número"
                placeholder="123"
                value={numero}
                onChange={(e) => setNumero(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                label="Complemento"
                placeholder="Sala, Bloco..."
                value={complemento}
                onChange={(e) => setComplemento(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                label="Bairro"
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 8, md: 3 }}>
              <TextInput
                label="Cidade"
                placeholder="Cidade"
                value={cidade}
                onChange={(e) => setCidade(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 4, md: 1 }}>
              <TextInput
                label="UF"
                placeholder="SP"
                maxLength={2}
                value={uf}
                onChange={(e) => setUf(e.currentTarget.value.toUpperCase())}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="sm">
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              onClick={handleSalvar}
              loading={editarMutation.isPending}
            >
              Salvar alterações
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  )
}
