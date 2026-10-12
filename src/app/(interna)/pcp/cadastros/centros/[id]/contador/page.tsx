'use client'

/**
 * Histórico de Contagem por Contador — por Centro de Produção (PCP).
 * Spec checkout-contagem-por-contador, tasks 7.1 e 7.2.
 *
 * 7.1 — Lista cronológica das LeituraContador do centro (inicial / final /
 *       quantidade / operador / data) e permite EDITAR uma leitura via
 *       PATCH /pcp/contador/leituras/:id. Quando o backend bloqueia por
 *       inconsistência da cadeia (HTTP 409), o corpo traz
 *       { campo, valorAtual, valorEsperado, motivo } — exibido ao usuário de
 *       forma clara (notification + alerta no modal com o VALOR ESPERADO).
 *
 * 7.2 — Logs de correção. O backend GRAVA LogLeituraContador na correção
 *       (contador-pcp.service.ts), mas NÃO há endpoint que exponha esses logs
 *       (confirmado: GET /pcp/centros/:id/contador/historico só retorna as
 *       leituras, sem o log de auditoria). Para não inventar endpoint, esta
 *       tela mostra o que ESTÁ disponível:
 *         (a) marca visualmente as leituras cuja data de atualização difere da
 *             criação (indício de que foram corrigidas — dado derivado do
 *             próprio registro de leitura);
 *         (b) um painel "Correções feitas nesta sessão" que registra, em
 *             memória, cada correção aplicada aqui (antes → depois + delta),
 *             deixando claro de onde o dado vem.
 *       A trilha de auditoria PERSISTIDA (quem/quando de correções anteriores)
 *       depende de um endpoint de logs que ainda não existe no backend — ver
 *       aviso na tela. Padrão do PCP: `api` direto + useState (sem hooks).
 *
 * Cliente Axios: baseURL já é `/api`, então chamamos `/pcp/...`.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal,
  NumberInput, ActionIcon, Alert, Card, Divider, Tooltip, Breadcrumbs, Anchor,
} from '@mantine/core'
import { IconEdit, IconArrowLeft, IconAlertTriangle, IconInfoCircle, IconHistory } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface LeituraHistorico {
  id: string
  etapaOrdemProducaoId: string
  apontamentoEtapaId: string | null
  leituraInicial: number
  leituraFinal: number
  quantidade: number
  resetDoDia: boolean
  funcionarioId: string | null
  funcionarioNome: string | null
  dataHora: string
  criadoEm?: string
  atualizadoEm?: string
}

/** Correção aplicada nesta sessão (trilha em memória — ver cabeçalho, 7.2). */
interface CorrecaoSessao {
  leituraId: string
  quando: Date
  inicialAntes: number
  inicialDepois: number
  finalAntes: number
  finalDepois: number
  deltaQuantidade: number
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export default function HistoricoContadorPage() {
  const params = useParams()
  const router = useRouter()
  const centroId = String(params?.id || '')

  const [centro, setCentro] = useState<any>(null)
  const [leituras, setLeituras] = useState<LeituraHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)

  // Modal de edição
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<LeituraHistorico | null>(null)
  const [formInicial, setFormInicial] = useState<number>(0)
  const [formFinal, setFormFinal] = useState<number>(0)
  const [salvando, setSalvando] = useState(false)
  // Inconsistência retornada pelo backend (409) — valor esperado
  const [inconsistencia, setInconsistencia] = useState<
    { campo: string; valorAtual: number; valorEsperado: number; motivo: string } | null
  >(null)

  // 7.2 — trilha de correções desta sessão (memória)
  const [correcoesSessao, setCorrecoesSessao] = useState<CorrecaoSessao[]>([])

  useEffect(() => {
    document.title = 'PCP - Histórico de Contagem'
  }, [])

  async function carregar() {
    setLoading(true)
    setErroCarregar(null)
    try {
      // Dados do centro (para cabeçalho / confirmar modo CONTADOR).
      const resCentro = await api.get(`/centros-producao/${centroId}`)
      setCentro(resCentro.data)
    } catch {
      // Se o detalhe não existir, seguimos só com o histórico (não é fatal).
    }
    try {
      const res = await api.get(`/pcp/centros/${centroId}/contador/historico`)
      setLeituras(res.data || [])
    } catch (err: any) {
      setErroCarregar(err?.response?.data?.message || 'Falha ao carregar o histórico')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (centroId) carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centroId])

  function abrirEdicao(item: LeituraHistorico) {
    setEditando(item)
    setFormInicial(item.leituraInicial)
    setFormFinal(item.leituraFinal)
    setInconsistencia(null)
    setModalAberto(true)
  }

  const quantidadePreview = Number(formFinal) - Number(formInicial)
  const quantidadeInvalida = quantidadePreview < 0

  async function salvar() {
    if (!editando) return
    if (quantidadeInvalida) {
      notifications.show({
        title: 'Leitura inválida',
        message: 'A leitura final não pode ser menor que a inicial.',
        color: 'red',
      })
      return
    }
    setSalvando(true)
    setInconsistencia(null)
    try {
      const body: { leituraInicial?: number; leituraFinal?: number } = {}
      if (formInicial !== editando.leituraInicial) body.leituraInicial = formInicial
      if (formFinal !== editando.leituraFinal) body.leituraFinal = formFinal
      if (body.leituraInicial === undefined && body.leituraFinal === undefined) {
        notifications.show({ title: 'Nada a corrigir', message: 'Nenhum valor foi alterado.', color: 'yellow' })
        setSalvando(false)
        return
      }

      const res = await api.patch(`/pcp/contador/leituras/${editando.id}`, body)
      const deltaQuantidade = Number(res.data?.deltaQuantidade ?? 0)

      // Registra a correção na trilha desta sessão (7.2).
      setCorrecoesSessao((prev) => [
        {
          leituraId: editando.id,
          quando: new Date(),
          inicialAntes: editando.leituraInicial,
          inicialDepois: formInicial,
          finalAntes: editando.leituraFinal,
          finalDepois: formFinal,
          deltaQuantidade,
        },
        ...prev,
      ])

      notifications.show({
        title: 'Leitura corrigida',
        message: deltaQuantidade !== 0
          ? `Quantidade da etapa ajustada em ${deltaQuantidade > 0 ? '+' : ''}${fmtNum(deltaQuantidade)}.`
          : 'Correção aplicada.',
        color: 'green',
      })
      setModalAberto(false)
      setEditando(null)
      carregar()
    } catch (err: any) {
      const status = err?.response?.status
      const data = err?.response?.data
      if (status === 409 && data && typeof data === 'object' && data.valorEsperado !== undefined) {
        // Inconsistência da cadeia — mostra o valor esperado de forma clara.
        const info = {
          campo: String(data.campo ?? ''),
          valorAtual: Number(data.valorAtual ?? 0),
          valorEsperado: Number(data.valorEsperado ?? 0),
          motivo: String(data.motivo ?? data.message ?? 'Inconsistência na cadeia de contadores'),
        }
        setInconsistencia(info)
        notifications.show({
          title: 'Correção bloqueada',
          message: `${rotuloCampo(info.campo)} deveria ser ${fmtNum(info.valorEsperado)} (informado: ${fmtNum(info.valorAtual)}).`,
          color: 'red',
          autoClose: 7000,
        })
      } else {
        notifications.show({
          title: 'Erro',
          message: data?.message || 'Falha ao corrigir a leitura.',
          color: 'red',
        })
      }
    } finally {
      setSalvando(false)
    }
  }

  function rotuloCampo(campo: string) {
    if (campo === 'leituraInicial') return 'Leitura inicial'
    if (campo === 'leituraFinal') return 'Leitura final'
    return campo || 'Valor'
  }

  /**
   * Uma leitura é marcada "corrigida" quando:
   *  - foi corrigida NESTA sessão (dado real que temos em memória), ou
   *  - o backend expõe criadoEm/atualizadoEm e eles divergem (defensivo —
   *    hoje o endpoint de histórico não retorna esses campos, então o marcador
   *    simplesmente não aparece para correções de sessões anteriores).
   */
  function foiCorrigida(l: LeituraHistorico) {
    if (correcoesSessao.some((c) => c.leituraId === l.id)) return true
    if (!l.criadoEm || !l.atualizadoEm) return false
    return new Date(l.atualizadoEm).getTime() - new Date(l.criadoEm).getTime() > 1000
  }

  const modoContador = !centro || centro.modoContagem === 'CONTADOR'

  return (
    <Stack gap="md">
      <Breadcrumbs>
        <Anchor size="sm" onClick={() => router.push('/pcp/cadastros/centros')}>Centros de Produção</Anchor>
        <Text size="sm">Histórico de Contagem</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>
            Histórico de Contagem
            {centro && (
              <Text component="span" c="dimmed" fw={400} ml={8}>
                — {centro.codigo} {centro.descricao}
              </Text>
            )}
          </Title>
          <Group gap={6} mt={4}>
            {centro && (
              <Badge variant="light" color={centro.modoContagem === 'CONTADOR' ? 'teal' : 'gray'}>
                Modo: {centro.modoContagem === 'CONTADOR' ? 'Contador de máquina' : 'Quantidade'}
              </Badge>
            )}
            {centro?.modoContagem === 'CONTADOR' && centro?.contadorZeraDiariamente && (
              <Badge variant="light" color="orange">Zera diariamente</Badge>
            )}
          </Group>
        </div>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/pcp/cadastros/centros')}>
          Voltar
        </Button>
      </Group>

      {!modoContador && (
        <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light">
          Este centro está em modo <b>Quantidade</b>. O histórico de contador fica
          vazio até que o centro seja configurado como <b>Contador de máquina</b>.
        </Alert>
      )}

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : erroCarregar ? (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">{erroCarregar}</Alert>
      ) : (
        <Card withBorder padding="sm">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Data/Hora</Table.Th>
                <Table.Th ta="right">Leitura inicial</Table.Th>
                <Table.Th ta="right">Leitura final</Table.Th>
                <Table.Th ta="right">Quantidade</Table.Th>
                <Table.Th>Operador</Table.Th>
                <Table.Th></Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {leituras.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td><Text size="sm">{fmtData(l.dataHora)}</Text></Table.Td>
                  <Table.Td ta="right">{fmtNum(l.leituraInicial)}</Table.Td>
                  <Table.Td ta="right">{fmtNum(l.leituraFinal)}</Table.Td>
                  <Table.Td ta="right" fw={600}>{fmtNum(l.quantidade)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{l.funcionarioNome || <Text component="span" c="dimmed" size="sm">—</Text>}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {l.resetDoDia && (
                        <Tooltip label="1ª leitura do dia (display resetou — inicial 0)">
                          <Badge size="xs" variant="light" color="orange">reset</Badge>
                        </Tooltip>
                      )}
                      {foiCorrigida(l) && (
                        <Tooltip label="Esta leitura foi corrigida (data de atualização difere da criação)">
                          <Badge size="xs" variant="light" color="blue">corrigida</Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Corrigir leitura">
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(l)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
              {leituras.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="md">Nenhuma leitura de contador registrada para este centro.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* 7.2 — Logs de correção */}
      <Card withBorder padding="sm">
        <Group gap={6} mb="xs">
          <IconHistory size={18} />
          <Text fw={600}>Correções</Text>
        </Group>
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="sm">
          O sistema registra uma auditoria (valor anterior/novo, quem e quando) a
          cada correção de leitura. A trilha persistida ainda não é exposta por um
          endpoint de leitura no backend; abaixo listamos as correções aplicadas{' '}
          <b>nesta sessão</b> e marcamos na tabela acima as leituras já corrigidas.
        </Alert>
        {correcoesSessao.length === 0 ? (
          <Text size="sm" c="dimmed">Nenhuma correção feita nesta sessão.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Quando</Table.Th>
                <Table.Th>Leitura inicial</Table.Th>
                <Table.Th>Leitura final</Table.Th>
                <Table.Th ta="right">Δ Quantidade</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {correcoesSessao.map((c, idx) => (
                <Table.Tr key={`${c.leituraId}-${idx}`}>
                  <Table.Td><Text size="sm">{c.quando.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</Text></Table.Td>
                  <Table.Td>
                    {c.inicialAntes !== c.inicialDepois
                      ? <Text size="sm">{fmtNum(c.inicialAntes)} → <b>{fmtNum(c.inicialDepois)}</b></Text>
                      : <Text size="sm" c="dimmed">{fmtNum(c.inicialDepois)}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {c.finalAntes !== c.finalDepois
                      ? <Text size="sm">{fmtNum(c.finalAntes)} → <b>{fmtNum(c.finalDepois)}</b></Text>
                      : <Text size="sm" c="dimmed">{fmtNum(c.finalDepois)}</Text>}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c={c.deltaQuantidade === 0 ? 'dimmed' : c.deltaQuantidade > 0 ? 'teal' : 'red'}>
                      {c.deltaQuantidade > 0 ? '+' : ''}{fmtNum(c.deltaQuantidade)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Modal de correção */}
      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title="Corrigir leitura de contador"
        centered
      >
        <Stack gap="md">
          {editando && (
            <Text size="sm" c="dimmed">
              Leitura de {fmtData(editando.dataHora)}
              {editando.funcionarioNome ? ` · ${editando.funcionarioNome}` : ''}
            </Text>
          )}

          <NumberInput
            label="Leitura inicial"
            value={formInicial}
            onChange={(v) => { setFormInicial(typeof v === 'number' ? v : 0); setInconsistencia(null) }}
            min={0}
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
          />
          <NumberInput
            label="Leitura final"
            value={formFinal}
            onChange={(v) => { setFormFinal(typeof v === 'number' ? v : 0); setInconsistencia(null) }}
            min={0}
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
          />

          <Divider />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Quantidade (final − inicial):</Text>
            <Text fw={600} c={quantidadeInvalida ? 'red' : undefined}>{fmtNum(quantidadePreview)}</Text>
          </Group>
          {quantidadeInvalida && (
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              A leitura final não pode ser menor que a inicial.
            </Alert>
          )}

          {inconsistencia && (
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} title="Correção bloqueada">
              {inconsistencia.motivo}
              <Divider my="xs" />
              <Text size="sm">
                {rotuloCampo(inconsistencia.campo)}: informado <b>{fmtNum(inconsistencia.valorAtual)}</b>,
                valor esperado <b>{fmtNum(inconsistencia.valorEsperado)}</b>.
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Ajuste o valor para o esperado (ou corrija a leitura vizinha) para manter a cadeia consistente.
              </Text>
            </Alert>
          )}

          <Button onClick={salvar} loading={salvando} disabled={quantidadeInvalida} fullWidth>
            Salvar correção
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
