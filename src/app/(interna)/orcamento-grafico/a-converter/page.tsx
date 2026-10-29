'use client'

/**
 * Caixa de entrada do Comercial — "Orçamentos a Converter" (R4, hand-off).
 * Lista orçamentos APROVADOS aguardando virar pedido, marcando amostra
 * pendente. Converter em pedido direto da linha. Backend:
 * GET /orcamento-grafico/a-converter + POST /orcamento-grafico/:id/converter.
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Table, Badge, Text, Loader, Center, Button, Paper,
  TextInput, Tooltip, Popover, SegmentedControl, Modal, NumberInput,
} from '@mantine/core'
import { IconSearch, IconShoppingCartPlus, IconExternalLink, IconRefresh, IconSettings } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import NotificacoesComercialBell from './NotificacoesComercialBell'

type ModoAmostra = 'SEMPRE' | 'NUNCA' | 'QUANDO_MARCADO'

interface ItemAConverter {
  orcamentoId: string
  numero: number
  cliente: string | null
  vendedorId: string | null
  valor: number
  criadoEm: string
  exigeAmostra: boolean
  amostraPendente: boolean
}

function brl(n: number) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function OrcamentosAConverterPage() {
  const router = useRouter()
  useEffect(() => { document.title = 'Orçamentos a Converter' }, [])

  const [itens, setItens] = useState<ItemAConverter[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [convertendo, setConvertendo] = useState<string | null>(null)
  const [modoAmostra, setModoAmostra] = useState<ModoAmostra>('QUANDO_MARCADO')
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  // Conversão com desconto (B7 — gate de margem)
  const [conversaoAlvo, setConversaoAlvo] = useState<ItemAConverter | null>(null)
  const [descontoPercent, setDescontoPercent] = useState<number | ''>('')

  const carregarConfig = useCallback(async () => {
    try {
      const { data } = await api.get('/orcamento-grafico/comercial/config-amostra')
      if (data?.modo) setModoAmostra(data.modo as ModoAmostra)
    } catch {
      /* mantém default */
    }
  }, [])

  useEffect(() => { carregarConfig() }, [carregarConfig])

  async function salvarConfigAmostra(modo: ModoAmostra) {
    setSalvandoConfig(true)
    const anterior = modoAmostra
    setModoAmostra(modo)
    try {
      await api.put('/orcamento-grafico/comercial/config-amostra', { modo })
      notifications.show({ title: 'Configuração salva', message: 'Padrão de amostra atualizado.', color: 'green' })
    } catch (err: any) {
      setModoAmostra(anterior)
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally {
      setSalvandoConfig(false)
    }
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/orcamento-grafico/a-converter')
      setItens(Array.isArray(data) ? data : [])
    } catch {
      setItens([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function converter(orcamentoId: string, desconto?: number) {
    setConvertendo(orcamentoId)
    try {
      const { data } = await api.post(
        `/orcamento-grafico/${orcamentoId}/converter`,
        desconto && desconto > 0 ? { descontoPercent: desconto } : {},
      )
      notifications.show({
        title: 'Convertido em pedido',
        message: `Pedido ${data?.numeroPedido ?? ''} gerado com ${data?.itensCriados ?? 0} item(ns).`,
        color: 'green',
      })
      setConversaoAlvo(null)
      setDescontoPercent('')
      await carregar()
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'MARGEM_PENDENTE') {
        notifications.show({
          title: 'Aprovação necessária',
          message: 'O desconto está acima da alçada. Uma solicitação de aprovação foi aberta para o responsável.',
          color: 'orange',
          autoClose: 8000,
        })
        setConversaoAlvo(null)
        setDescontoPercent('')
        return
      }
      const msg =
        code === 'AMOSTRA_PENDENTE' ? 'Amostra exigida e ainda não aprovada.'
        : err?.response?.data?.message || 'Falha ao converter'
      notifications.show({ title: 'Não foi possível converter', message: msg, color: 'red' })
    } finally {
      setConvertendo(null)
    }
  }

  const filtrados = itens.filter((i) => {
    if (!busca.trim()) return true
    const q = busca.trim().toLowerCase()
    return String(i.numero).includes(q) || (i.cliente || '').toLowerCase().includes(q)
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Orçamentos a Converter</Title>
          <Text size="sm" c="dimmed">
            {itens.length} orçamento{itens.length !== 1 ? 's' : ''} aprovado{itens.length !== 1 ? 's' : ''} aguardando virar pedido
          </Text>
        </div>
        <Group gap="xs">
          <NotificacoesComercialBell />
          <Popover width={320} position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <Button variant="default" leftSection={<IconSettings size={16} />}>Amostra</Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <Text fw={600} size="sm">Exigir aprovação de amostra?</Text>
                <Text size="xs" c="dimmed">
                  Define o padrão da empresa ao converter orçamento em pedido. O orçamento pode sobrepor
                  individualmente (campo &quot;exige amostra&quot;).
                </Text>
                <SegmentedControl
                  fullWidth
                  disabled={salvandoConfig}
                  value={modoAmostra}
                  onChange={(v) => salvarConfigAmostra(v as ModoAmostra)}
                  data={[
                    { label: 'Sempre', value: 'SEMPRE' },
                    { label: 'Quando marcado', value: 'QUANDO_MARCADO' },
                    { label: 'Nunca', value: 'NUNCA' },
                  ]}
                />
                <Text size="xs" c="dimmed">
                  {modoAmostra === 'SEMPRE' && 'Todo pedido exige amostra aprovada antes de converter/liberar.'}
                  {modoAmostra === 'QUANDO_MARCADO' && 'Exige amostra só quando o orçamento estiver marcado (ou sugerido por tipo de OP).'}
                  {modoAmostra === 'NUNCA' && 'Nunca bloqueia por amostra (a não ser override manual no orçamento).'}
                </Text>
              </Stack>
            </Popover.Dropdown>
          </Popover>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
        </Group>
      </Group>

      <Paper p="sm" withBorder>
        <TextInput
          placeholder="Buscar por número ou cliente..."
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
        />
      </Paper>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : filtrados.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhum orçamento aprovado aguardando conversão.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nº</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th ta="right">Valor</Table.Th>
              <Table.Th>Amostra</Table.Th>
              <Table.Th>Aprovado em</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtrados.map((i) => (
              <Table.Tr key={i.orcamentoId}>
                <Table.Td fw={600}>{i.numero}</Table.Td>
                <Table.Td>{i.cliente || '—'}</Table.Td>
                <Table.Td ta="right">{brl(i.valor)}</Table.Td>
                <Table.Td>
                  {!i.exigeAmostra ? (
                    <Badge variant="light" color="gray">Não exige</Badge>
                  ) : i.amostraPendente ? (
                    <Badge variant="light" color="orange">Pendente</Badge>
                  ) : (
                    <Badge variant="light" color="green">Aprovada</Badge>
                  )}
                </Table.Td>
                <Table.Td>{new Date(i.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Tooltip label={i.amostraPendente ? 'Amostra pendente — aprove antes de converter' : 'Converter em pedido'}>
                      <Button
                        size="compact-sm"
                        color="teal"
                        leftSection={<IconShoppingCartPlus size={15} />}
                        onClick={() => { setConversaoAlvo(i); setDescontoPercent('') }}
                        loading={convertendo === i.orcamentoId}
                        disabled={i.amostraPendente}
                      >
                        Converter
                      </Button>
                    </Tooltip>
                    <Tooltip label="Abrir orçamento">
                      <Button
                        size="compact-sm"
                        variant="subtle"
                        leftSection={<IconExternalLink size={15} />}
                        onClick={() => router.push(`/orcamento-grafico/${i.orcamentoId}`)}
                      >
                        Abrir
                      </Button>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Modal de conversão com desconto (B7 — gate de margem) */}
      <Modal
        opened={!!conversaoAlvo}
        onClose={() => { setConversaoAlvo(null); setDescontoPercent('') }}
        title={`Converter orçamento ${conversaoAlvo?.numero ?? ''} em pedido`}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Cliente: {conversaoAlvo?.cliente || '—'} · Valor: {brl(conversaoAlvo?.valor ?? 0)}
          </Text>
          <NumberInput
            label="Desconto (%)"
            description="Opcional. Acima da alçada, abre aprovação antes de converter."
            placeholder="0"
            min={0}
            max={100}
            decimalScale={2}
            value={descontoPercent}
            onChange={(v) => setDescontoPercent(v === '' ? '' : Number(v))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setConversaoAlvo(null); setDescontoPercent('') }}>Cancelar</Button>
            <Button
              color="teal"
              leftSection={<IconShoppingCartPlus size={16} />}
              loading={convertendo === conversaoAlvo?.orcamentoId}
              onClick={() => conversaoAlvo && converter(conversaoAlvo.orcamentoId, typeof descontoPercent === 'number' ? descontoPercent : undefined)}
            >
              Converter
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
