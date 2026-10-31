'use client'

/**
 * Pedidos / Propostas — gestão central do Comercial (RFQ).
 * Spec comercial-pedido-proposta. Consome GET /orcamento-grafico/pedidos-proposta
 * (entidade PedidoProposta, separada do orçamento). Lista TODAS as origens
 * (representante/vendedor/interna) e tipos (repetição/mostruário/novo), com o
 * estágio no funil + ações: abrir/editar, encaminhar ao orçamento, liberar à
 * produção. "Novo pedido/proposta" abre o FORMULÁRIO RFQ (não o Novo Orçamento).
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Table, Badge, Text, Loader, Center, Button, Paper,
  TextInput, Select, Tooltip, Modal, Textarea, ScrollArea,
} from '@mantine/core'
import {
  IconSearch, IconFilter, IconRefresh, IconPlus, IconExternalLink,
  IconArrowRight, IconRocket, IconPrinter, IconPlayerPlay, IconCalculator,
  IconX, IconThumbDown, IconDotsVertical,
} from '@tabler/icons-react'
import { Menu } from '@mantine/core'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'
import { notifications } from '@mantine/notifications'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

interface PedidoProposta {
  id: string
  numero: number
  origem: 'REPRESENTANTE' | 'VENDEDOR' | 'INTERNA'
  tipoPedido: 'REPETICAO' | 'MOSTRUARIO' | 'NOVO'
  clienteNome?: string | null
  produtoNome?: string | null
  tipoEmbalagem?: string | null
  quantidade?: number | null
  estado: string
  exigeAmostra: boolean
  orcamentoGraficoId?: string | null
  criadoEm: string
}

const ESTADO_CONFIG: Record<string, { color: string; label: string }> = {
  NOVO: { color: 'gray', label: 'Novo' },
  EM_ANALISE: { color: 'blue', label: 'Em análise' },
  ENVIADO_ORCAMENTO: { color: 'indigo', label: 'Enviado p/ orçamento' },
  ORCADO: { color: 'cyan', label: 'Orçado' },
  PROPOSTA_ENVIADA: { color: 'grape', label: 'Proposta enviada' },
  ACEITO: { color: 'green', label: 'Aceito' },
  PERDIDO: { color: 'red', label: 'Perdido' },
  CANCELADO: { color: 'dark', label: 'Cancelado' },
}

const ORIGEM_CONFIG: Record<string, { color: string; label: string }> = {
  REPRESENTANTE: { color: 'teal', label: 'Representante' },
  VENDEDOR: { color: 'blue', label: 'Vendedor' },
  INTERNA: { color: 'gray', label: 'Venda interna' },
}

const TIPO_LABEL: Record<string, string> = {
  REPETICAO: 'Repetição', MOSTRUARIO: 'Mostruário', NOVO: 'Novo',
}

function EstadoBadge({ estado }: { estado: string }) {
  const c = ESTADO_CONFIG[estado] || { color: 'gray', label: estado }
  return <Badge color={c.color}>{c.label}</Badge>
}

function formatDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function PedidosPropostasPage() {
  const router = useRouter()
  useEffect(() => { document.title = 'Pedidos / Propostas' }, [])

  const [data, setData] = useState<PedidoProposta[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null)
  const [origemFiltro, setOrigemFiltro] = useState<string | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null)
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null)

  // Modal liberar (senha opcional de assinatura)
  const [liberarAlvo, setLiberarAlvo] = useState<PedidoProposta | null>(null)
  const [senhaLiberar, setSenhaLiberar] = useState('')

  // Modal de motivo (cancelar / marcar como perdido)
  const [motivoAlvo, setMotivoAlvo] = useState<{ p: PedidoProposta; estado: 'CANCELADO' | 'PERDIDO' } | null>(null)
  const [motivo, setMotivo] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (busca.trim()) params.busca = busca.trim()
      if (estadoFiltro) params.estado = estadoFiltro
      if (origemFiltro) params.origem = origemFiltro
      if (tipoFiltro) params.tipoPedido = tipoFiltro
      const { data } = await api.get('/orcamento-grafico/pedidos-proposta', { params })
      setData(Array.isArray(data) ? data : [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar', color: 'red' })
      setData([])
    } finally {
      setLoading(false)
    }
  }, [busca, estadoFiltro, origemFiltro, tipoFiltro])

  useEffect(() => { carregar() }, [carregar])

  // Imprime o RFQ (PDF) em nova aba, com token na query (abre sem header).
  function imprimir(p: PedidoProposta) {
    const token = getAuthToken()
    const url = `${API_BASE}/orcamento-grafico/pedidos-proposta/${p.id}/pdf?token=${token ?? ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Transição genérica de estado (ex.: NOVO→EM_ANALISE "iniciar análise").
  async function transicionar(p: PedidoProposta, estado: string, motivoTxt?: string) {
    setAcaoLoading(p.id)
    try {
      await api.patch(`/orcamento-grafico/pedidos-proposta/${p.id}/estado`, { estado, motivo: motivoTxt })
      notifications.show({ title: 'Status atualizado', message: `Nº ${p.numero}: ${ESTADO_CONFIG[estado]?.label ?? estado}.`, color: 'green' })
      carregar()
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msg = code === 'MOTIVO_OBRIGATORIO' ? 'Informe um motivo com no mínimo 5 caracteres.'
        : err?.response?.data?.message || 'Falha ao atualizar o status.'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  async function confirmarMotivo() {
    if (!motivoAlvo) return
    await transicionar(motivoAlvo.p, motivoAlvo.estado, motivo)
    setMotivoAlvo(null)
    setMotivo('')
  }

  async function encaminhar(p: PedidoProposta) {
    setAcaoLoading(p.id)
    try {
      const { data } = await api.post(`/orcamento-grafico/pedidos-proposta/${p.id}/encaminhar`, {})
      notifications.show({ title: 'Encaminhado', message: `Orçamento nº ${data?.numero ?? ''} criado.`, color: 'green' })
      carregar()
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msg =
        code === 'RFQ_NAO_APTO_ENCAMINHAR' ? 'O pedido precisa estar "Em análise" para encaminhar.'
        : code === 'TIPO_EMBALAGEM_NAO_RESOLVIDO' ? 'Tipo de embalagem não reconhecido — ajuste o cadastro ou edite o pedido.'
        : err?.response?.data?.message || 'Falha ao encaminhar'
      notifications.show({ title: 'Não foi possível encaminhar', message: msg, color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  async function liberar() {
    if (!liberarAlvo) return
    setAcaoLoading(liberarAlvo.id)
    try {
      const { data } = await api.post(`/orcamento-grafico/pedidos-proposta/${liberarAlvo.id}/liberar`, {
        senha: senhaLiberar || undefined,
      })
      notifications.show({ title: 'Liberado para produção', message: `Pedido ${data?.numeroPedido ?? ''} gerado.`, color: 'green' })
      setLiberarAlvo(null)
      setSenhaLiberar('')
      carregar()
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'FASES_PENDENTES') {
        const fases = (err?.response?.data?.fasesPendentes || []).map((f: any) => `• ${f.motivo}`).join('\n')
        notifications.show({ title: 'Fases pendentes', message: fases || 'Há etapas não concluídas.', color: 'orange', autoClose: 9000 })
        return
      }
      const msg =
        code === 'AMOSTRA_PENDENTE' ? 'Amostra exigida e ainda não aprovada.'
        : code === 'SEM_PERMISSAO_LIBERACAO' ? 'Seu perfil não pode liberar à produção.'
        : err?.response?.data?.message || 'Falha ao liberar'
      notifications.show({ title: 'Não foi possível liberar', message: msg, color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Pedidos / Propostas</Title>
          <Text size="sm" c="dimmed">
            Gestão central de todas as origens (representante, vendedor e venda interna). {data.length} registro{data.length !== 1 ? 's' : ''}.
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/orcamento-grafico/pedidos/novo')}>
            Novo pedido / proposta
          </Button>
        </Group>
      </Group>

      <Paper p="sm" withBorder>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            placeholder="Buscar por cliente ou produto..."
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') carregar() }}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select
            placeholder="Estado" leftSection={<IconFilter size={16} />} clearable w={190}
            data={Object.entries(ESTADO_CONFIG).map(([value, c]) => ({ value, label: c.label }))}
            value={estadoFiltro} onChange={setEstadoFiltro}
          />
          <Select
            placeholder="Origem" clearable w={160}
            data={Object.entries(ORIGEM_CONFIG).map(([value, c]) => ({ value, label: c.label }))}
            value={origemFiltro} onChange={setOrigemFiltro}
          />
          <Select
            placeholder="Tipo" clearable w={150}
            data={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))}
            value={tipoFiltro} onChange={setTipoFiltro}
          />
        </Group>
      </Paper>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Origem</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Amostra</Table.Th>
                <Table.Th>Criado</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={600}>{p.numero}</Table.Td>
                  <Table.Td>{p.clienteNome || '—'}</Table.Td>
                  <Table.Td>{p.produtoNome || p.tipoEmbalagem || '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={ORIGEM_CONFIG[p.origem]?.color || 'gray'}>
                      {ORIGEM_CONFIG[p.origem]?.label || p.origem}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{TIPO_LABEL[p.tipoPedido] || p.tipoPedido}</Table.Td>
                  <Table.Td><EstadoBadge estado={p.estado} /></Table.Td>
                  <Table.Td>
                    {p.exigeAmostra ? <Badge variant="light" color="orange">Exige</Badge> : <Badge variant="light" color="gray">Não</Badge>}
                  </Table.Td>
                  <Table.Td>{formatDate(p.criadoEm)}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      {/* Ação principal do workflow conforme o estado atual */}
                      {p.estado === 'NOVO' && (
                        <Tooltip label="Iniciar análise do pedido">
                          <Button size="compact-sm" color="blue" leftSection={<IconPlayerPlay size={15} />}
                            loading={acaoLoading === p.id} onClick={() => transicionar(p, 'EM_ANALISE')}>
                            Iniciar análise
                          </Button>
                        </Tooltip>
                      )}
                      {p.estado === 'EM_ANALISE' && (
                        <Tooltip label="Enviar para o orçamento (gera o cálculo)">
                          <Button size="compact-sm" color="indigo" leftSection={<IconArrowRight size={15} />}
                            loading={acaoLoading === p.id} onClick={() => encaminhar(p)}>
                            Enviar p/ orçamento
                          </Button>
                        </Tooltip>
                      )}
                      {(p.estado === 'ENVIADO_ORCAMENTO' || p.estado === 'ORCADO') && p.orcamentoGraficoId && (
                        <Tooltip label="Abrir o orçamento para conferir o cálculo">
                          <Button size="compact-sm" color="cyan" leftSection={<IconCalculator size={15} />}
                            onClick={() => router.push(`/orcamento-grafico/${p.orcamentoGraficoId}`)}>
                            Conferir cálculo
                          </Button>
                        </Tooltip>
                      )}
                      {p.estado === 'ACEITO' && (
                        <Tooltip label="Liberar para produção/faturamento">
                          <Button size="compact-sm" color="teal" leftSection={<IconRocket size={15} />}
                            onClick={() => { setLiberarAlvo(p); setSenhaLiberar('') }}>
                            Liberar
                          </Button>
                        </Tooltip>
                      )}

                      {/* Menu de ações secundárias — sempre presente */}
                      <Menu shadow="md" width={210} position="bottom-end" withinPortal>
                        <Menu.Target>
                          <Button size="compact-sm" variant="light" color="gray" rightSection={<IconDotsVertical size={14} />}>
                            Ações
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconExternalLink size={15} />}
                            onClick={() => router.push(`/orcamento-grafico/pedidos/${p.id}`)}>
                            Abrir / editar
                          </Menu.Item>
                          <Menu.Item leftSection={<IconPrinter size={15} />} onClick={() => imprimir(p)}>
                            Imprimir (PDF)
                          </Menu.Item>
                          {p.orcamentoGraficoId && (
                            <Menu.Item leftSection={<IconCalculator size={15} />}
                              onClick={() => router.push(`/orcamento-grafico/${p.orcamentoGraficoId}`)}>
                              Abrir orçamento vinculado
                            </Menu.Item>
                          )}
                          {/* Atalho de workflow quando a ação principal não é a do estado */}
                          {p.estado === 'NOVO' && (
                            <Menu.Item leftSection={<IconPlayerPlay size={15} />}
                              onClick={() => transicionar(p, 'EM_ANALISE')}>
                              Iniciar análise
                            </Menu.Item>
                          )}
                          {p.estado === 'EM_ANALISE' && (
                            <Menu.Item leftSection={<IconArrowRight size={15} />} onClick={() => encaminhar(p)}>
                              Enviar p/ orçamento
                            </Menu.Item>
                          )}
                          {(p.estado === 'ENVIADO_ORCAMENTO' || p.estado === 'ORCADO') && (
                            <Menu.Item leftSection={<IconArrowRight size={15} />}
                              onClick={() => transicionar(p, 'PROPOSTA_ENVIADA')}>
                              Marcar proposta enviada
                            </Menu.Item>
                          )}
                          {p.estado === 'PROPOSTA_ENVIADA' && (
                            <Menu.Item color="green" leftSection={<IconRocket size={15} />}
                              onClick={() => transicionar(p, 'ACEITO')}>
                              Registrar aceite do cliente
                            </Menu.Item>
                          )}
                          {!['ACEITO', 'PERDIDO', 'CANCELADO'].includes(p.estado) && (
                            <>
                              <Menu.Divider />
                              <Menu.Item color="orange" leftSection={<IconThumbDown size={15} />}
                                onClick={() => { setMotivoAlvo({ p, estado: 'PERDIDO' }); setMotivo('') }}>
                                Marcar como perdido
                              </Menu.Item>
                              <Menu.Item color="red" leftSection={<IconX size={15} />}
                                onClick={() => { setMotivoAlvo({ p, estado: 'CANCELADO' }); setMotivo('') }}>
                                Cancelar pedido
                              </Menu.Item>
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text ta="center" c="dimmed" py="md">Nenhum pedido/proposta encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal opened={!!liberarAlvo} onClose={() => { setLiberarAlvo(null); setSenhaLiberar('') }}
        title={`Liberar pedido ${liberarAlvo?.numero ?? ''} para produção`} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Confere orçado + aceite do cliente + cálculo validado{liberarAlvo?.exigeAmostra ? ' + amostra aprovada' : ''}. Se a empresa exigir assinatura, informe sua senha.
          </Text>
          <TextInput
            type="password"
            label="Senha (se exigida)"
            placeholder="••••••••"
            value={senhaLiberar}
            onChange={(e) => setSenhaLiberar(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setLiberarAlvo(null); setSenhaLiberar('') }}>Cancelar</Button>
            <Button color="teal" leftSection={<IconRocket size={16} />} loading={acaoLoading === liberarAlvo?.id} onClick={liberar}>
              Liberar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de motivo (cancelar / perdido) */}
      <Modal opened={!!motivoAlvo} onClose={() => { setMotivoAlvo(null); setMotivo('') }}
        title={motivoAlvo?.estado === 'CANCELADO' ? `Cancelar pedido ${motivoAlvo?.p.numero ?? ''}` : `Marcar pedido ${motivoAlvo?.p.numero ?? ''} como perdido`}
        centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Informe o motivo (mínimo 5 caracteres). Fica registrado no histórico.</Text>
          <Textarea
            placeholder="Ex.: cliente desistiu / preço acima do concorrente / prazo inviável"
            minRows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setMotivoAlvo(null); setMotivo('') }}>Voltar</Button>
            <Button color={motivoAlvo?.estado === 'CANCELADO' ? 'red' : 'orange'}
              loading={acaoLoading === motivoAlvo?.p.id}
              disabled={motivo.trim().length < 5}
              onClick={confirmarMotivo}>
              {motivoAlvo?.estado === 'CANCELADO' ? 'Cancelar pedido' : 'Marcar como perdido'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
