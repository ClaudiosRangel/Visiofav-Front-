'use client'

/**
 * Orçamento em branco (rascunho em memória).
 *
 * "Novo Orçamento" abre esta tela sem gravar nada. O registro só é criado em
 * `POST /orcamento-grafico/cabecalho` quando o usuário aciona "Salvar" ou "Incluir item".
 * Sair da tela antes disso descarta o rascunho (estado local, nenhuma chamada de API).
 *
 * Fluxo de "Incluir item": cria o cabeçalho (se ainda não existir) → DialogoLinhaProduto →
 * Confirmar abre a tela do item em branco do orçamento criado (`itens/novo?linha=<linhaProdutoId>`);
 * Cancelar só fecha o diálogo.
 *
 * "Localizar Cálculo" é a ação separada: cria o cabeçalho (se preciso) e abre o
 * SeletorCalculoPadrao sem filtro de linha; "Usar" abre o orçamento.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert, Anchor, Breadcrumbs, Button, Center, Group, Loader, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Title,
} from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy, IconExternalLink, IconPlus, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import { api } from '@/lib/api'
import { useEmpresa } from '@/providers/EmpresaProvider'
import ClientePrincipalBusca, { type ClientePrincipal } from '../[id]/_orcamento/ClientePrincipalBusca'
import DialogoLinhaProduto, { type LinhaProdutoSelecionada } from '../DialogoLinhaProduto'
import SeletorCalculoPadrao from '../_calculo-padrao/SeletorCalculoPadrao'
import { SERIES_ENDPOINT, nomeSerieExibicao, type SerieDocumento } from '../cadastros/_shared/series'

/** Data corrente no fuso America/Sao_Paulo, no formato AAAA-MM-DD. */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatarDataBr(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

interface OrcamentoCriado {
  id: string
  numero: number
}

/**
 * Troca de empresa (Req 16.4–16.8): o rascunho em memória vive só no estado do conteúdo, que é
 * remontado (`key`) quando a empresa ativa muda. Token e empresa vêm só do `api`/`useEmpresa`.
 */
export default function NovoOrcamentoEmBrancoPage() {
  const { empresa, loading } = useEmpresa()
  if (loading) return <Center py="xl"><Loader size="lg" /></Center>
  return <NovoOrcamentoConteudo key={empresa?.id ?? 'sem-empresa'} />
}

function NovoOrcamentoConteudo() {
  const router = useRouter()
  useEffect(() => { document.title = 'Novo Orçamento' }, [])

  // Série: só as ATIVAS do cadastro, pré-selecionando a padrão. O Nº sai da série.
  const [series, setSeries] = useState<SerieDocumento[]>([])
  const [carregandoSeries, setCarregandoSeries] = useState(true)
  const [serieId, setSerieId] = useState<string | null>(null)
  const [cliente, setCliente] = useState<ClientePrincipal | null>(null)
  const dataHoje = useMemo(() => hojeSaoPaulo(), [])

  const [criado, setCriado] = useState<OrcamentoCriado | null>(null)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [dialogoLinhaAberto, setDialogoLinhaAberto] = useState(false)
  const [seletorAberto, setSeletorAberto] = useState(false)

  useEffect(() => {
    let ativo = true
    api
      .get(SERIES_ENDPOINT, { params: { origem: 'ORCAMENTO', situacao: 'ativa' } })
      .then(({ data }) => {
        if (!ativo) return
        const lista: SerieDocumento[] = Array.isArray(data) ? data : []
        setSeries(lista)
        setSerieId((atual) => atual ?? lista.find((s) => s.padrao)?.id ?? lista[0]?.id ?? null)
      })
      .catch(() => {
        // Sem a lista, o cabeçalho usa a série padrão da empresa no servidor.
        if (ativo) setSeries([])
      })
      .finally(() => { if (ativo) setCarregandoSeries(false) })
    return () => { ativo = false }
  }, [])

  const opcoesSerie = useMemo(
    () => series.map((s) => ({ value: s.id, label: `${nomeSerieExibicao(s.nome)}${s.padrao ? ' — padrão' : ''}` })),
    [series],
  )

  /** Cria o cabeçalho. Devolve o orçamento criado, ou null em falha (cabeçalho digitado é mantido). */
  const criarOrcamento = async (): Promise<OrcamentoCriado | null> => {
    if (criado) return criado
    setCriando(true)
    setErro(null)
    try {
      const payload: Record<string, unknown> = { dataOrcamento: dataHoje }
      if (serieId) payload.serieId = serieId
      if (cliente) {
        payload.clienteId = cliente.id
        payload.clienteNome = cliente.nome
      }
      const { data } = await api.post('/orcamento-grafico/cabecalho', payload)
      const novo: OrcamentoCriado = { id: String(data.id), numero: Number(data.numero) }
      setCriado(novo)
      return novo
    } catch (err: any) {
      const motivo = err?.response?.data?.message
      setErro(`O orçamento não foi criado${motivo ? `: ${motivo}` : '. Tente novamente.'}`)
      return null
    } finally {
      setCriando(false)
    }
  }

  const salvar = async () => {
    const novo = await criarOrcamento()
    if (novo) {
      notifications.show({ title: 'Orçamento salvo', message: `Orçamento ${novo.numero} criado.`, color: 'green' })
    }
  }

  const incluirItem = async () => {
    const novo = await criarOrcamento()
    if (novo) setDialogoLinhaAberto(true)
  }

  /** Linha escolhida → tela do item em branco do orçamento criado. */
  const abrirItemNovo = (linha: LinhaProdutoSelecionada) => {
    setDialogoLinhaAberto(false)
    if (criado) router.push(`/orcamento-grafico/${criado.id}/itens/novo?linha=${encodeURIComponent(linha.id)}`)
  }

  const localizarCalculo = async () => {
    const novo = await criarOrcamento()
    if (novo) setSeletorAberto(true)
  }

  const irParaOrcamento = () => {
    if (criado) router.replace(`/orcamento-grafico/${criado.id}`)
  }

  return (
    <Stack gap="md">
      <Breadcrumbs>
        <Anchor component={Link} href="/orcamento-grafico" size="sm">Orçamentos</Anchor>
        <Text size="sm">Novo orçamento</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={2}>{criado ? `Orçamento ${criado.numero}` : 'Novo orçamento'}</Title>
        <Group gap="xs">
          {criado && (
            <Button variant="light" leftSection={<IconExternalLink size={16} />} onClick={irParaOrcamento}>
              Abrir orçamento
            </Button>
          )}
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={() => void salvar()}
            loading={criando}
            disabled={!!criado}
          >
            Salvar
          </Button>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => void incluirItem()}
            disabled={criando}
          >
            Incluir item
          </Button>
          <Button
            variant="light"
            leftSection={<IconSearch size={16} />}
            onClick={() => void localizarCalculo()}
            disabled={criando}
          >
            Localizar Cálculo
          </Button>
        </Group>
      </Group>

      {erro && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Orçamento não criado">
          {erro}
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Select
            label="Série"
            data={opcoesSerie}
            value={serieId}
            onChange={setSerieId}
            allowDeselect={false}
            disabled={!!criado || carregandoSeries}
            placeholder={carregandoSeries ? 'Carregando…' : 'Série padrão'}
            nothingFoundMessage="Nenhuma série ativa"
          />
          <TextInput label="Nº" value={criado ? String(criado.numero) : 'auto'} readOnly />
          <TextInput label="Data" value={formatarDataBr(dataHoje)} readOnly />
        </SimpleGrid>

        <Stack mt="md" gap="xs">
          <ClientePrincipalBusca value={cliente} onChange={setCliente} disabled={!!criado} />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={70}>Item</Table.Th>
              <Table.Th>Cálculo</Table.Th>
              <Table.Th>Linha de Produto</Table.Th>
              <Table.Th>Tipo de Produto</Table.Th>
              <Table.Th>Tiragens</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text size="sm" c="dimmed" ta="center">Nenhum item. Use "Incluir item" para adicionar.</Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      <DialogoLinhaProduto
        opened={dialogoLinhaAberto}
        onConfirmar={abrirItemNovo}
        onCancelar={() => setDialogoLinhaAberto(false)}
      />

      {criado && (
        <SeletorCalculoPadrao
          opened={seletorAberto}
          onClose={() => setSeletorAberto(false)}
          orcamentoId={criado.id}
          linhaInicial={null}
          onUsado={irParaOrcamento}
        />
      )}
    </Stack>
  )
}
