'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Group, Loader, Stack, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconUserPlus } from '@tabler/icons-react'
import { api } from '@/lib/api'
import ClienteRapidoModal, { type ClienteCriadoRapido } from './ClienteRapidoModal'
import ObservacoesEmpresaModal, { temObservacaoVisivel } from './ObservacoesEmpresaModal'

// Campo "Cliente Principal" do orçamento (Req 2.1 a 2.10).
// Pesquisa enquanto digita (espera 300 ms), por "contém" no código, no nome e no CNPJ/CPF, em
// GET /orcamento-grafico/clientes/busca (máx. 50, ordenada por nome, empresa da sessão).
// Ao selecionar, preenche código e nome e abre "Observações da Empresa" só se houver texto não branco.
// Com `permitirCadastroRapido` (orçamento em rascunho), "Cliente novo" abre o cadastro rápido.

export interface ClienteBusca {
  id: string
  codigo: string | null
  nome: string
  nomeFantasia?: string | null
  cpfCnpj?: string | null
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
  /** Mostra "Cliente novo" (cadastro rápido). Só no orçamento em rascunho. */
  permitirCadastroRapido?: boolean
}

const MAX_CODIGO = 20
const MAX_NOME = 200

/** Pesquisa só com código (1+) ou nome/documento (2+ caracteres). */
export function filtrosDaBusca(codigo: string, nome: string): Record<string, string> | null {
  const c = codigo.trim()
  const n = nome.trim()
  if (!c && n.length < 2) return null
  const p: Record<string, string> = {}
  if (c) p.codigo = c
  if (n.length >= 2) p.q = n
  return p
}

export default function ClientePrincipalBusca({ value, onChange, disabled, permitirCadastroRapido }: Props) {
  const [codigo, setCodigo] = useState(value?.codigo ?? '')
  const [nome, setNome] = useState(value?.nome ?? '')
  const [resultados, setResultados] = useState<ClienteBusca[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'aviso' | 'erro'; texto: string } | null>(null)
  const [observacao, setObservacao] = useState<string | null>(null)
  const [rapidoAberto, setRapidoAberto] = useState(false)
  const requisicao = useRef(0)
  // Texto que veio da seleção: não dispara nova pesquisa.
  const selecionadoTexto = useRef<string | null>(value ? `${value.codigo}|${value.nome}` : null)

  const entrada = useMemo(() => ({ codigo, nome }), [codigo, nome])
  const [atrasada] = useDebouncedValue(entrada, 300)

  useEffect(() => {
    if (disabled) return
    if (selecionadoTexto.current === `${atrasada.codigo}|${atrasada.nome}`) return
    const params = filtrosDaBusca(atrasada.codigo, atrasada.nome)
    if (!params) {
      setResultados(null)
      setMensagem(null)
      return
    }
    const id = ++requisicao.current
    setBuscando(true)
    setMensagem(null)
    api
      .get('/orcamento-grafico/clientes/busca', { params })
      .then(({ data }) => {
        if (id !== requisicao.current) return
        const lista: ClienteBusca[] = Array.isArray(data) ? data : (data?.data ?? [])
        if (lista.length === 0) {
          setResultados(null)
          setMensagem({ tipo: 'aviso', texto: 'Nenhum cliente encontrado.' })
        } else {
          setResultados(lista.slice(0, 50))
        }
      })
      .catch(() => {
        if (id !== requisicao.current) return
        setResultados(null)
        setMensagem({ tipo: 'erro', texto: 'Falha na pesquisa de clientes. Tente novamente.' })
      })
      .finally(() => {
        if (id === requisicao.current) setBuscando(false)
      })
  }, [atrasada, disabled])

  const selecionar = (cli: ClienteBusca) => {
    const cod = cli.codigo ?? ''
    selecionadoTexto.current = `${cod}|${cli.nome}`
    requisicao.current++
    setCodigo(cod)
    setNome(cli.nome)
    setResultados(null)
    setMensagem(null)
    setBuscando(false)
    onChange({ id: cli.id, codigo: cod, nome: cli.nome })
    if (temObservacaoVisivel(cli.observacao)) setObservacao(cli.observacao as string)
  }

  const aoCriar = (c: ClienteCriadoRapido) =>
    selecionar({ id: c.id, codigo: c.codigoCalcgraf != null ? String(c.codigoCalcgraf) : null, nome: c.razaoSocial, nomeFantasia: c.nomeFantasia })

  return (
    <Stack gap="xs">
      <Group align="flex-end" gap="sm" wrap="nowrap">
        <TextInput
          label="Cliente Principal — Código"
          w={160}
          maxLength={MAX_CODIGO}
          value={codigo}
          onChange={(e) => setCodigo(e.currentTarget.value)}
          disabled={disabled}
        />
        <TextInput
          label="Nome ou CNPJ/CPF"
          placeholder="Digite para pesquisar"
          style={{ flex: 1 }}
          maxLength={MAX_NOME}
          value={nome}
          onChange={(e) => setNome(e.currentTarget.value)}
          rightSection={buscando ? <Loader size="xs" aria-label="Pesquisando" /> : null}
          disabled={disabled}
        />
        {permitirCadastroRapido && (
          <Button variant="light" leftSection={<IconUserPlus size={16} />} onClick={() => setRapidoAberto(true)} disabled={disabled}>
            Cliente novo
          </Button>
        )}
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
          <Group justify="space-between" wrap="nowrap">
            <span>{mensagem.texto}</span>
            {permitirCadastroRapido && mensagem.tipo === 'aviso' && (
              <Button size="compact-xs" variant="subtle" onClick={() => setRapidoAberto(true)} disabled={disabled}>
                Cadastrar cliente novo
              </Button>
            )}
          </Group>
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
      {permitirCadastroRapido && (
        <ClienteRapidoModal opened={rapidoAberto} onClose={() => setRapidoAberto(false)} onCriado={aoCriar} textoInicial={nome} />
      )}
    </Stack>
  )
}
