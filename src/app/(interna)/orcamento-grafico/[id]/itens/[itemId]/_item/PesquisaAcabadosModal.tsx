'use client'

/**
 * PesquisaAcabadosModal — "Pesquisa de Acabados" do campo Sigla Acabado, como no sistema de referência:
 * Código e Descrição (palavras separadas por vírgula), grade Código | Nome | Unidade. Busca no cadastro
 * de produtos do Vizor (`GET /orcamento-grafico/acabados`). Duplo clique ou "Selecionar" devolve o
 * produto escolhido; não grava nada.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Group, Loader, Modal, Pagination, ScrollArea, Stack, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react'

import { api } from '@/lib/api'

export interface AcabadoEscolhido {
  id: string
  codigo: string
  nome: string
  unidade: string
}

export interface PesquisaAcabadosModalProps {
  opened: boolean
  onClose: () => void
  onEscolher: (acabado: AcabadoEscolhido) => void
  /** Texto já digitado na Sigla Acabado (vira o filtro de Código inicial). */
  codigoInicial?: string
}

interface Resposta {
  data: Array<AcabadoEscolhido & { status?: boolean }>
  total: number
  totalPages: number
}

const LIMITE = 50

export default function PesquisaAcabadosModal({ opened, onClose, onEscolher, codigoInicial }: PesquisaAcabadosModalProps) {
  const [codigo, setCodigo] = useState(() => (codigoInicial ?? '').trim())
  const [descricao, setDescricao] = useState('')
  const [incluirInativos, setIncluirInativos] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState<Resposta | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const requisicao = useRef(0)
  const buscar = useCallback(
    async (pg: number, filtros: { codigo: string; descricao: string; incluirInativos: boolean }) => {
      const id = ++requisicao.current
      setCarregando(true)
      setErro(null)
      try {
        const { data } = await api.get<Resposta>('/orcamento-grafico/acabados', {
          params: {
            codigo: filtros.codigo.trim() || undefined,
            descricao: filtros.descricao.trim() || undefined,
            incluirInativos: filtros.incluirInativos ? 'true' : undefined,
            page: pg,
            limit: LIMITE,
          },
        })
        if (id !== requisicao.current) return
        setResultado(data)
        setPagina(pg)
        setSelecionado(null)
      } catch {
        if (id === requisicao.current) setErro('Não foi possível pesquisar os acabados.')
      } finally {
        if (id === requisicao.current) setCarregando(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!opened) return
    setCodigo((codigoInicial ?? '').trim())
    setDescricao('')
    setIncluirInativos(false)
    setResultado(null)
  }, [opened, codigoInicial])

  // Pesquisa enquanto digita (espera 300 ms), sem botão.
  const filtrosAtuais = useMemo(() => ({ codigo, descricao, incluirInativos }), [codigo, descricao, incluirInativos])
  const [filtrosAtrasados] = useDebouncedValue(filtrosAtuais, 300)
  useEffect(() => {
    if (opened) void buscar(1, filtrosAtrasados)
  }, [opened, filtrosAtrasados, buscar])

  const pesquisar = () => void buscar(1, { codigo, descricao, incluirInativos })
  const escolher = (a: AcabadoEscolhido) => {
    onEscolher(a)
    onClose()
  }
  const linhas = resultado?.data ?? []
  const escolhido = linhas.find((l) => l.id === selecionado)

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>Pesquisa de Acabados</Text>} size="xl" centered>
      <Stack gap="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            pesquisar()
          }}
        >
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput label="Código" value={codigo} onChange={(e) => setCodigo(e.currentTarget.value)} w={140} maxLength={60} />
            <TextInput
              label="Descrição (digite as palavras, separando-as por vírgulas)"
              value={descricao}
              onChange={(e) => setDescricao(e.currentTarget.value)}
              maxLength={200}
              style={{ flex: 1 }}
            />
            {carregando && <Loader size="xs" mb={10} aria-label="Pesquisando" />}
          </Group>
          <Checkbox
            mt="xs"
            size="xs"
            label="Incluir inativos"
            checked={incluirInativos}
            onChange={(e) => setIncluirInativos(e.currentTarget.checked)}
          />
        </form>

        {erro && (
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
            {erro}
          </Alert>
        )}

        <ScrollArea h={360} type="auto">
          <Table withTableBorder highlightOnHover stickyHeader verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={120}>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th w={90}>Unidade</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {linhas.map((a) => (
                <Table.Tr
                  key={a.id}
                  data-testid={`acabado-${a.codigo}`}
                  onClick={() => setSelecionado(a.id)}
                  onDoubleClick={() => escolher(a)}
                  aria-selected={selecionado === a.id}
                  bg={selecionado === a.id ? 'var(--mantine-primary-color-light)' : undefined}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td>{a.codigo}</Table.Td>
                  <Table.Td>
                    {a.nome}
                    {a.status === false && (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        (inativo)
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{a.unidade}</Table.Td>
                </Table.Tr>
              ))}
              {!carregando && resultado && linhas.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text size="sm" c="dimmed" ta="center">
                      Nenhum acabado encontrado.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        <Group justify="space-between">
          <Group gap="xs">
            {resultado && resultado.totalPages > 1 && (
              <Pagination
                size="sm"
                total={resultado.totalPages}
                value={pagina}
                onChange={(pg) => void buscar(pg, { codigo, descricao, incluirInativos })}
              />
            )}
            {resultado && (
              <Text size="xs" c="dimmed">
                {resultado.total} {resultado.total === 1 ? 'acabado' : 'acabados'}
              </Text>
            )}
          </Group>
          <Group gap="xs">
            <Button variant="default" leftSection={<IconX size={16} />} onClick={onClose}>
              Cancelar
            </Button>
            <Button leftSection={<IconCheck size={16} />} disabled={!escolhido} onClick={() => escolhido && escolher(escolhido)}>
              Selecionar
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
