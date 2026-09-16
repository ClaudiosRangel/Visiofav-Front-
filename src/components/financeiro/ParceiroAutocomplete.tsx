'use client'

/**
 * Financeiro D1 — seleção de parceiro (fornecedor/cliente) com opção de
 * cadastro OU digitação livre (nome + CPF/CNPJ). Detecção PF/PJ automática,
 * máscara e validação dinâmicas.
 */
import { useEffect, useState } from 'react'
import { Stack, Autocomplete, TextInput, Switch, Text, Group, Badge, ActionIcon, Tooltip } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { mascararDocumento, rotuloDocumento, validarDocumento, normalizarDoc } from '@/lib/financeiro/documento'
import FornecedorModal from '@/app/(interna)/configurador/fornecedores/FornecedorModal'
import ClienteModal from '@/app/(interna)/configurador/clientes/ClienteModal'

export interface ParceiroValue {
  parceiroId?: string
  parceiroNomeLivre?: string
  parceiroDocLivre?: string
}

interface Props {
  tipo: 'fornecedor' | 'cliente'
  value: ParceiroValue
  onChange: (v: ParceiroValue) => void
}

export function ParceiroAutocomplete({ tipo, value, onChange }: Props) {
  const [livre, setLivre] = useState(Boolean(value.parceiroNomeLivre) && !value.parceiroId)
  const [busca, setBusca] = useState('')
  const [nome, setNome] = useState(value.parceiroNomeLivre ?? '')
  const [doc, setDoc] = useState(value.parceiroDocLivre ?? '')
  const [cadastroOpen, setCadastroOpen] = useState(false)
  const queryClient = useQueryClient()

  const endpoint = tipo === 'fornecedor' ? '/fornecedores' : '/clientes'
  const { data } = useQuery<any>({
    queryKey: [`${tipo}-autocomplete`],
    queryFn: async () => { const { data } = await api.get(endpoint, { params: { limit: 100, status: 'true' } }); return data },
    enabled: !livre,
  })

  const registros = (data?.data ?? []) as any[]
  const options = registros.map((r) => ({ value: r.id, label: r.razaoSocial || r.nomeFantasia || r.nome }))

  // Sincroniza o texto exibido com o parceiro já vinculado (ex.: ao editar um
  // título que já tem fornecedor). Sem isso o campo aparece vazio na edição.
  useEffect(() => {
    if (!livre && value.parceiroId && registros.length > 0) {
      const achado = options.find((o) => o.value === value.parceiroId)
      if (achado && busca !== achado.label) setBusca(achado.label)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.parceiroId, registros.length, livre])

  // Sincroniza os campos livres quando o value muda (ex.: reabrir edição)
  useEffect(() => {
    if (livre) {
      setNome(value.parceiroNomeLivre ?? '')
      setDoc(value.parceiroDocLivre ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.parceiroNomeLivre, value.parceiroDocLivre, livre])

  const docValidacao = validarDocumento(doc)

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>{tipo === 'fornecedor' ? 'Fornecedor' : 'Cliente'}</Text>
        <Switch
          size="xs"
          label="Sem cadastro (avulso)"
          checked={livre}
          onChange={(e) => {
            const on = e.currentTarget.checked
            setLivre(on)
            onChange(on ? { parceiroNomeLivre: nome, parceiroDocLivre: doc } : {})
          }}
        />
      </Group>

      {!livre ? (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <Autocomplete
            style={{ flex: 1 }}
            placeholder={`Buscar ${tipo}...`}
            data={options.map((o) => o.label)}
            value={busca}
            onChange={(label) => {
              setBusca(label)
              const achado = options.find((o) => o.label === label)
              onChange(achado ? { parceiroId: achado.value } : {})
            }}
            comboboxProps={{ withinPortal: true }}
          />
          <Tooltip label={`Cadastrar novo ${tipo}`}>
            <ActionIcon size="lg" variant="light" onClick={() => setCadastroOpen(true)} aria-label={`Cadastrar ${tipo}`}>
              <IconPlus size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : (
        <>
          <TextInput
            placeholder="Nome do parceiro"
            value={nome}
            onChange={(e) => { setNome(e.currentTarget.value); onChange({ parceiroNomeLivre: e.currentTarget.value, parceiroDocLivre: normalizarDoc(doc) }) }}
          />
          <TextInput
            label={
              <Group gap={6}>
                <span>{rotuloDocumento(doc)}</span>
                {doc && (docValidacao.valido
                  ? <Badge size="xs" color="green" variant="light">{docValidacao.tipoPessoa === 'FISICA' ? 'PF' : docValidacao.tipoPessoa === 'JURIDICA' ? 'PJ' : 'ok'}</Badge>
                  : <Badge size="xs" color="red" variant="light">inválido</Badge>)}
              </Group>
            }
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            value={mascararDocumento(doc)}
            error={doc && !docValidacao.valido ? 'Documento inválido' : undefined}
            onChange={(e) => { const v = normalizarDoc(e.currentTarget.value); setDoc(v); onChange({ parceiroNomeLivre: nome, parceiroDocLivre: v }) }}
          />
        </>
      )}

      {/* Cadastro rápido de fornecedor/cliente sem sair do formulário */}
      {tipo === 'fornecedor' ? (
        <FornecedorModal
          opened={cadastroOpen}
          onClose={() => { setCadastroOpen(false); queryClient.invalidateQueries({ queryKey: [`${tipo}-autocomplete`] }) }}
        />
      ) : (
        <ClienteModal
          opened={cadastroOpen}
          onClose={() => { setCadastroOpen(false); queryClient.invalidateQueries({ queryKey: [`${tipo}-autocomplete`] }) }}
        />
      )}
    </Stack>
  )
}
