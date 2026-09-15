'use client'

/**
 * Financeiro D1 — seleção de parceiro (fornecedor/cliente) com opção de
 * cadastro OU digitação livre (nome + CPF/CNPJ). Detecção PF/PJ automática,
 * máscara e validação dinâmicas.
 */
import { useState } from 'react'
import { Stack, Autocomplete, TextInput, Switch, Text, Group, Badge } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { mascararDocumento, rotuloDocumento, validarDocumento, normalizarDoc } from '@/lib/financeiro/documento'

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

  const endpoint = tipo === 'fornecedor' ? '/fornecedores' : '/clientes'
  const { data } = useQuery<any>({
    queryKey: [`${tipo}-autocomplete`],
    queryFn: async () => { const { data } = await api.get(endpoint, { params: { limit: 100, status: 'true' } }); return data },
    enabled: !livre,
  })

  const registros = (data?.data ?? []) as any[]
  const options = registros.map((r) => ({ value: r.id, label: r.razaoSocial || r.nomeFantasia || r.nome }))

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
        <Autocomplete
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
    </Stack>
  )
}
