'use client'

/**
 * Cadastro rápido de cliente pelo orçamento em rascunho (spec orcamento-prazos-cliente-margem, R3).
 * CNPJ/CPF e Razão Social obrigatórios; CNPJ completo pode ser preenchido pela Receita.
 * Grava em POST /orcamento-grafico/clientes/rapido. CNPJ/CPF já cadastrado: oferece usar o existente.
 */

import { useEffect, useState } from 'react'
import { Alert, Button, Grid, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconBuildingStore, IconCloudDownload } from '@tabler/icons-react'
import { api } from '@/lib/api'

export interface ClienteCriadoRapido {
  id: string
  razaoSocial: string
  nomeFantasia?: string | null
  cpfCnpj: string
  codigoCalcgraf?: number | null
}

interface Props {
  opened: boolean
  onClose: () => void
  onCriado: (cliente: ClienteCriadoRapido) => void
  /** Texto já digitado na busca (vira o nome ou o documento inicial). */
  textoInicial?: string
}

interface Form {
  cpfCnpj: string
  razaoSocial: string
  nomeFantasia: string
  telefone: string
  email: string
  uf: string
  cidade: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
}

const VAZIO: Form = {
  cpfCnpj: '', razaoSocial: '', nomeFantasia: '', telefone: '', email: '', uf: '', cidade: '', cep: '', logradouro: '', numero: '', bairro: '',
}

const digitos = (s: string) => s.replace(/\D/g, '')

/** Erros do formulário (campo → motivo). Vazio = pode gravar. */
export function validarClienteRapido(f: Pick<Form, 'cpfCnpj' | 'razaoSocial' | 'email' | 'uf'>): Record<string, string> {
  const e: Record<string, string> = {}
  const d = digitos(f.cpfCnpj)
  if (!d) e.cpfCnpj = 'Informe o CNPJ ou CPF.'
  else if ((d.length !== 11 && d.length !== 14) || /^(\d)\1+$/.test(d)) e.cpfCnpj = 'CPF com 11 ou CNPJ com 14 dígitos.'
  if (!f.razaoSocial.trim()) e.razaoSocial = 'Informe a razão social.'
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'E-mail inválido.'
  if (f.uf.trim() && !/^[A-Za-z]{2}$/.test(f.uf.trim())) e.uf = 'UF com 2 letras.'
  return e
}

export default function ClienteRapidoModal({ opened, onClose, onCriado, textoInicial }: Props) {
  const [form, setForm] = useState<Form>(VAZIO)
  const [tentou, setTentou] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [consultando, setConsultando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [existente, setExistente] = useState<ClienteCriadoRapido | null>(null)

  useEffect(() => {
    if (!opened) return
    const t = (textoInicial ?? '').trim()
    const soNumero = digitos(t).length >= 11 && digitos(t).length === t.replace(/[.\-/\s]/g, '').length
    setForm({ ...VAZIO, ...(soNumero ? { cpfCnpj: t } : { razaoSocial: t }) })
    setTentou(false)
    setErro(null)
    setExistente(null)
  }, [opened, textoInicial])

  const erros = tentou ? validarClienteRapido(form) : {}
  const mudar = (campo: keyof Form, v: string) => setForm((f) => ({ ...f, [campo]: v }))

  const consultarReceita = async () => {
    const d = digitos(form.cpfCnpj)
    if (d.length !== 14) {
      setErro('A consulta à Receita é só para CNPJ (14 dígitos).')
      return
    }
    setConsultando(true)
    setErro(null)
    try {
      const { data } = await api.get(`/orcamento-grafico/consulta-cnpj/${d}`)
      setForm((f) => ({
        ...f,
        razaoSocial: data.razaoSocial || f.razaoSocial,
        nomeFantasia: data.nomeFantasia || f.nomeFantasia,
        telefone: data.telefone || f.telefone,
        email: data.email || f.email,
        uf: data.uf || f.uf,
        cidade: data.cidade || f.cidade,
        cep: data.cep || f.cep,
        logradouro: data.logradouro || f.logradouro,
        numero: data.numero || f.numero,
        bairro: data.bairro || f.bairro,
      }))
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível consultar o CNPJ. Preencha os dados à mão.')
    } finally {
      setConsultando(false)
    }
  }

  const gravar = async () => {
    setTentou(true)
    if (Object.keys(validarClienteRapido(form)).length > 0) return
    setGravando(true)
    setErro(null)
    setExistente(null)
    try {
      const { data } = await api.post('/orcamento-grafico/clientes/rapido', {
        ...form,
        uf: form.uf.trim().toUpperCase() || null,
        email: form.email.trim() || null,
      })
      onCriado(data as ClienteCriadoRapido)
      onClose()
    } catch (e: any) {
      if (e?.response?.status === 409 && e.response.data?.cliente) {
        setExistente(e.response.data.cliente as ClienteCriadoRapido)
      } else {
        setErro(e?.response?.data?.message || 'Não foi possível cadastrar o cliente.')
      }
    } finally {
      setGravando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Cliente novo</Text>} size="lg" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Cadastro rápido: o cliente é criado e já fica selecionado no orçamento. Os demais dados podem ser completados
          depois no cadastro de clientes.
        </Text>
        {erro && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {erro}
          </Alert>
        )}
        {existente && (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">
                Já existe um cliente com este CNPJ/CPF: <b>{existente.razaoSocial}</b>.
              </Text>
              <Button
                size="xs"
                onClick={() => {
                  onCriado(existente)
                  onClose()
                }}
              >
                Usar este cliente
              </Button>
            </Group>
          </Alert>
        )}
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Group gap={6} align="flex-end" wrap="nowrap">
              <TextInput
                label="CNPJ / CPF"
                required
                maxLength={20}
                value={form.cpfCnpj}
                onChange={(e) => mudar('cpfCnpj', e.currentTarget.value)}
                error={erros.cpfCnpj}
                style={{ flex: 1 }}
              />
              <Button
                variant="default"
                leftSection={<IconCloudDownload size={16} />}
                loading={consultando}
                onClick={() => void consultarReceita()}
                disabled={digitos(form.cpfCnpj).length !== 14}
              >
                Receita
              </Button>
            </Group>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Telefone" maxLength={20} value={form.telefone} onChange={(e) => mudar('telefone', e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput
              label="Razão Social"
              required
              maxLength={200}
              value={form.razaoSocial}
              onChange={(e) => mudar('razaoSocial', e.currentTarget.value)}
              error={erros.razaoSocial}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Nome Fantasia" maxLength={200} value={form.nomeFantasia} onChange={(e) => mudar('nomeFantasia', e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="E-mail" maxLength={200} value={form.email} onChange={(e) => mudar('email', e.currentTarget.value)} error={erros.email} />
          </Grid.Col>
          <Grid.Col span={{ base: 4, sm: 2 }}>
            <TextInput label="UF" maxLength={2} value={form.uf} onChange={(e) => mudar('uf', e.currentTarget.value.toUpperCase())} error={erros.uf} />
          </Grid.Col>
          <Grid.Col span={{ base: 8, sm: 6 }}>
            <TextInput label="Cidade" maxLength={100} value={form.cidade} onChange={(e) => mudar('cidade', e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput label="CEP" maxLength={10} value={form.cep} onChange={(e) => mudar('cep', e.currentTarget.value)} />
          </Grid.Col>
        </Grid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button leftSection={<IconBuildingStore size={16} />} loading={gravando} onClick={() => void gravar()}>
            Cadastrar e usar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
