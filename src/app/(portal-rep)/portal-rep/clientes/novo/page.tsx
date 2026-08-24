'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft } from '@tabler/icons-react'
import { useCriarCliente } from '@/data/hooks/portal-rep-app/usePortalRepClientes'
import { validarCpf, validarCnpj } from '@/components/portal-rep/formatters'
import type { CriarClientePayload } from '@/data/hooks/portal-rep-app/types'

const UF_OPTIONS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

function validarDocumento(doc: string): { valido: boolean; erro: string | null } {
  const digits = doc.replace(/\D/g, '')
  if (digits.length === 0) return { valido: true, erro: null }
  if (digits.length < 11) return { valido: true, erro: null } // ainda digitando
  if (digits.length === 11) {
    return validarCpf(digits)
      ? { valido: true, erro: null }
      : { valido: false, erro: 'CPF inválido' }
  }
  if (digits.length > 11 && digits.length < 14) return { valido: true, erro: null } // ainda digitando
  if (digits.length === 14) {
    return validarCnpj(digits)
      ? { valido: true, erro: null }
      : { valido: false, erro: 'CNPJ inválido' }
  }
  return { valido: false, erro: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' }
}

export default function NovoClientePage() {
  const router = useRouter()
  const criarCliente = useCriarCliente()

  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState<string | null>(null)

  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroDocumento, setErroDocumento] = useState<string | null>(null)
  const [mostrarVinculacao, setMostrarVinculacao] = useState(false)

  const docDigits = cpfCnpj.replace(/\D/g, '')
  const documentoValido =
    docDigits.length === 11 ? validarCpf(docDigits) :
    docDigits.length === 14 ? validarCnpj(docDigits) :
    false

  const formValido =
    razaoSocial.trim().length > 0 &&
    docDigits.length >= 11 &&
    documentoValido

  const handleDocumentoChange = (value: string) => {
    // Permitir apenas dígitos e formatação
    const digits = value.replace(/\D/g, '').slice(0, 14)
    setCpfCnpj(digits)
    const resultado = validarDocumento(digits)
    setErroDocumento(resultado.erro)
    setMostrarVinculacao(false)
  }

  const buscarCep = useCallback(async (cepValue: string) => {
    const cepDigits = cepValue.replace(/\D/g, '')
    if (cepDigits.length !== 8) return

    setBuscandoCep(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      const data = await response.json()

      if (!data.erro) {
        setLogradouro(data.logradouro || '')
        setBairro(data.bairro || '')
        setCidade(data.localidade || '')
        setUf(data.uf || null)
      }
    } catch {
      // Falha silenciosa — o representante pode preencher manualmente
    } finally {
      setBuscandoCep(false)
    }
  }, [])

  const handleCepChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    setCep(digits)
    if (digits.length === 8) {
      buscarCep(digits)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formValido) return

    const payload: CriarClientePayload = {
      razaoSocial: razaoSocial.trim(),
      cpfCnpj: docDigits,
      ...(nomeFantasia.trim() && { nomeFantasia: nomeFantasia.trim() }),
      ...(inscricaoEstadual.trim() && { inscricaoEstadual: inscricaoEstadual.trim() }),
      ...(telefone.trim() && { telefone: telefone.replace(/\D/g, '') }),
      ...(email.trim() && { email: email.trim() }),
      ...(logradouro.trim() && { logradouro: logradouro.trim() }),
      ...(numero.trim() && { numero: numero.trim() }),
      ...(complemento.trim() && { complemento: complemento.trim() }),
      ...(bairro.trim() && { bairro: bairro.trim() }),
      ...(cidade.trim() && { cidade: cidade.trim() }),
      ...(uf && { uf }),
      ...(cep.trim() && { cep: cep.replace(/\D/g, '') }),
    }

    criarCliente.mutate(payload, {
      onSuccess: () => {
        notifications.show({
          message: 'Cliente cadastrado com sucesso!',
          color: 'green',
        })
        router.push('/portal-rep/clientes')
      },
      onError: (error: Error & { response?: { data?: { code?: string; message?: string } } }) => {
        const axiosError = error as unknown as {
          response?: { status?: number; data?: { code?: string; message?: string } }
        }

        if (
          axiosError.response?.status === 409 &&
          axiosError.response?.data?.code === 'DOCUMENTO_EXISTENTE'
        ) {
          setMostrarVinculacao(true)
          return
        }

        notifications.show({
          message:
            axiosError.response?.data?.message || 'Erro ao cadastrar cliente. Tente novamente.',
          color: 'red',
        })
      },
    })
  }

  return (
    <Stack gap="md" p="md">
      <Group gap="xs">
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.back()}
        >
          Voltar
        </Button>
      </Group>

      <Title order={3}>Novo Cliente</Title>

      <Card shadow="xs" withBorder radius="md" p="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Dados da empresa */}
            <TextInput
              label="Razão Social"
              placeholder="Nome da empresa / pessoa física"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.currentTarget.value)}
              required
            />

            <TextInput
              label="Nome Fantasia"
              placeholder="Nome fantasia (opcional)"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.currentTarget.value)}
            />

            <TextInput
              label="CPF/CNPJ"
              placeholder="Somente números"
              value={cpfCnpj}
              onChange={(e) => handleDocumentoChange(e.currentTarget.value)}
              error={erroDocumento}
              required
            />

            <TextInput
              label="Inscrição Estadual"
              placeholder="IE (opcional)"
              value={inscricaoEstadual}
              onChange={(e) => setInscricaoEstadual(e.currentTarget.value)}
            />

            {/* Contato */}
            <TextInput
              label="Telefone"
              placeholder="(XX) XXXXX-XXXX"
              value={telefone}
              onChange={(e) => setTelefone(e.currentTarget.value)}
            />

            <TextInput
              label="E-mail"
              placeholder="email@exemplo.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />

            {/* Endereço */}
            <Title order={5} mt="sm">
              Endereço
            </Title>

            <TextInput
              label="CEP"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => handleCepChange(e.currentTarget.value)}
              disabled={buscandoCep}
              description={buscandoCep ? 'Buscando endereço...' : undefined}
            />

            <TextInput
              label="Logradouro"
              placeholder="Rua, Av, etc."
              value={logradouro}
              onChange={(e) => setLogradouro(e.currentTarget.value)}
            />

            <Group grow>
              <TextInput
                label="Número"
                placeholder="Nº"
                value={numero}
                onChange={(e) => setNumero(e.currentTarget.value)}
              />
              <TextInput
                label="Complemento"
                placeholder="Apto, Sala, etc."
                value={complemento}
                onChange={(e) => setComplemento(e.currentTarget.value)}
              />
            </Group>

            <TextInput
              label="Bairro"
              placeholder="Bairro"
              value={bairro}
              onChange={(e) => setBairro(e.currentTarget.value)}
            />

            <Group grow>
              <TextInput
                label="Cidade"
                placeholder="Cidade"
                value={cidade}
                onChange={(e) => setCidade(e.currentTarget.value)}
              />
              <Select
                label="UF"
                placeholder="Selecione"
                data={UF_OPTIONS}
                value={uf}
                onChange={setUf}
                searchable
                clearable
              />
            </Group>

            {/* Mensagem de documento existente */}
            {mostrarVinculacao && (
              <Card withBorder radius="md" bg="yellow.0" p="sm">
                <Stack gap="xs">
                  <Text size="sm" fw={500} c="yellow.9">
                    Este CPF/CNPJ já está cadastrado no sistema.
                  </Text>
                  <Text size="sm" c="dimmed">
                    Deseja solicitar a vinculação deste cliente à sua carteira?
                  </Text>
                  <Button
                    variant="light"
                    color="yellow"
                    size="xs"
                    onClick={() => {
                      notifications.show({
                        message: 'Solicitação de vinculação enviada. Aguarde aprovação.',
                        color: 'blue',
                      })
                      router.push('/portal-rep/clientes')
                    }}
                  >
                    Solicitar Vinculação
                  </Button>
                </Stack>
              </Card>
            )}

            {/* Botão de submit */}
            <Button
              type="submit"
              fullWidth
              loading={criarCliente.isPending}
              disabled={!formValido || criarCliente.isPending}
              mt="sm"
            >
              Cadastrar Cliente
            </Button>
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}
