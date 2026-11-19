'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconSearch } from '@tabler/icons-react'
import { api } from '@/lib/api'
import ObservacoesEmpresaModal, { temObservacaoVisivel } from './ObservacoesEmpresaModal'

// Campo "Cliente Principal" do orçamento (Req 2.1 a 2.10).
// Busca em GET /orcamento-grafico/clientes/busca (máx. 50, ordenada por nome, empresa da sessão).
// Ao selecionar, preenche código e nome e abre "Observações da Empresa" só se houver texto não branco.

export interface ClienteBusca {
  id: string
  codigo: string | null
  nome: string
  nomeFantasia?: string | null
  observacao?: string | null
}

export interface ClientePrincipal {
  id: string
  codigo: string
  nome: string
}

interface Props {
  /** Cliente Principal atual (mantido quando a busca não encontra ou falha). */
  value: ClientePrincipal | null
  onChange: (cliente: ClientePrincipal) => void
  disabled?: boolean
}

const MAX_CODIGO = 20
const MAX_NOME = 200

export default function ClientePrincipalBusca({ value, onChange, disabled }: Props) {
  const [codigo, setCodigo] = useState(value?.codigo ?? '')
  const [nome, setNome] = useState(value?.nome ?? '')
  const [resultados, setResultados] = useState<ClienteBusca[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'aviso' | 'erro'; texto: string } | null>(null)
  const [observacao, setObservacao] = useState<string | null>(null)
  const requisicao = useRef(0)

  const pesquisar = async () => {
    const c = codigo.trim()
    const n = nome.trim()
    if (!c && !n) {
      setResultados(null)
      setMensagem({ tipo: 'aviso', texto: 'Informe o código ou o nome do cliente para pesquisar.' })
      return
    }
    const id = ++requisicao.current
    setBuscando(true)
    setMensagem(null)
    try {
      const params: Record<string, string> = {}
      if (c) params.codigo = c
      if (n) params.nome = n
      const { data } = await api.get('/orcamento-grafico/clientes/busca', { params })
      if (id !== requisicao.current) return
      const lista: ClienteBusca[] = Array.isArray(data) ? data : (data?.data ?? [])
      if (lista.length === 0) {
        setResultados(null)
        setMensagem({ tipo: 'aviso', texto: 'Nenhum cliente encontrado.' })
      } else {
        setResultados(lista.slice(0, 50))
      }
    } catch {
      if (id !== requisicao.current) return
      setResultados(null)
      setMensagem({ tipo: 'erro', texto: 'Falha na pesquisa de clientes. Tente novamente.' })
    } finally {
      if (id === requisicao.current) setBuscando(false)
    }
  }

  const selecionar = (cli: ClienteBusca) => {
    const cod = cli.codigo ?? ''
    setCodigo(cod)
    setNome(cli.nome)
    setResultados(null)
    setMensagem(null)
    onChange({ id: cli.id, codigo: cod, nome: cli.nome })
    if (temObservacaoVisivel(cli.observacao)) setObservacao(cli.observacao as string)
  }

  const aoTeclar = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void pesquisar()
    }
  }

  return (
    <Stack gap="xs">
      <Group align="flex-end" gap="sm" wrap="nowrap">
        <TextInput
          label="Cliente Principal — Código"
          w={160}
          maxLength={MAX_CODIGO}
          value={codigo}
          onChange={(e) => setCodigo(e.currentTarget.value)}
          onKeyDown={aoTeclar}
          disabled={disabled}
        />
        <TextInput
          label="Nome"
          style={{ flex: 1 }}
          maxLength={MAX_NOME}
          value={nome}
          onChange={(e) => setNome(e.currentTarget.value)}
          onKeyDown={aoTeclar}
          disabled={disabled}
        />
        <Button
          leftSection={<IconSearch size={16} />}
          onClick={() => void pesquisar()}
          loading={buscando}
          disabled={disabled}
        >
          Pesquisar
        </Button>
      </Group>

      {value && (
        <Text size="sm" c="dimmed">
          Cliente selecionado: {value.codigo ? `${value.codigo} - ` : ''}
          {value.nome}
        </Text>
      )}

      {mensagem && (
        <Alert
          color={mensagem.tipo === 'erro' ? 'red' : 'yellow'}
          variant="light"
          icon={<IconAlertCircle size={16} />}
          py="xs"
        >
          {mensagem.texto}
        </Alert>
      )}

      {resultados && (
        <Table.ScrollContainer minWidth={420} mah={260}>
          <Table highlightOnHover withTableBorder stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={140}>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resultados.map((cli) => (
                <Table.Tr
                  key={cli.id}
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                  onClick={() => selecionar(cli)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selecionar(cli)
                    }
                  }}
                >
                  <Table.Td>{cli.codigo ?? ''}</Table.Td>
                  <Table.Td>
                    {cli.nome}
                    {cli.nomeFantasia && cli.nomeFantasia !== cli.nome ? (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        ({cli.nomeFantasia})
                      </Text>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <ObservacoesEmpresaModal
        opened={observacao !== null}
        observacao={observacao ?? ''}
        onClose={() => setObservacao(null)}
      />
    </Stack>
  )
}
