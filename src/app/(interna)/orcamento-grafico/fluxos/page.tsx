'use client'
/**
 * Fluxo por operação (Comercial). Define, para cada operação (Novo, Repetição,
 * Mostruário, Alteração), a ordem das etapas, quais são puladas e quais setores
 * ficam bloqueados enquanto cada etapa não for concluída.
 * Consome /orcamento-grafico/comercial/fluxos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge, Button, Card, Center, Checkbox, Group, Loader, Stack, Switch, Tabs, Text, Title, ActionIcon, Alert,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowDown, IconArrowUp, IconLock } from '@tabler/icons-react'
import { api } from '@/lib/api'

type Operacao = 'NOVO' | 'REPETICAO' | 'MOSTRUARIO' | 'ALTERACAO'
type Etapa = 'COMERCIAL' | 'ORCAMENTO' | 'PRE_IMPRESSAO' | 'OP_PCP' | 'FATURAMENTO'
type Setor = 'COMERCIAL' | 'ORCAMENTO' | 'PRE_IMPRESSAO'

interface EtapaConfig { etapa: Etapa; ativa: boolean; bloqueia: Setor[]; automatica?: boolean }
interface Fluxo { operacao: Operacao; etapas: EtapaConfig[]; personalizado: boolean }

const OPERACOES: Array<{ valor: Operacao; rotulo: string }> = [
  { valor: 'NOVO', rotulo: 'Novo' },
  { valor: 'REPETICAO', rotulo: 'Repetição' },
  { valor: 'MOSTRUARIO', rotulo: 'Mostruário' },
  { valor: 'ALTERACAO', rotulo: 'Alteração' },
]
const ROTULO: Record<Etapa, string> = {
  COMERCIAL: 'Comercial',
  ORCAMENTO: 'Orçamento',
  PRE_IMPRESSAO: 'Pré-Impressão',
  OP_PCP: 'OP / PCP',
  FATURAMENTO: 'Faturamento',
}
const SETORES: Setor[] = ['COMERCIAL', 'ORCAMENTO', 'PRE_IMPRESSAO']
const REORDENAVEIS: Etapa[] = ['COMERCIAL', 'ORCAMENTO', 'PRE_IMPRESSAO']
const ORDEM_CANONICA: Etapa[] = ['COMERCIAL', 'ORCAMENTO', 'PRE_IMPRESSAO', 'OP_PCP', 'FATURAMENTO']

/** Espelha as regras do servidor para dar retorno imediato. */
function validar(etapas: EtapaConfig[]): string[] {
  const erros: string[] = []
  const ativas = etapas.filter((e) => e.ativa)
  const com = etapas.find((e) => e.etapa === 'COMERCIAL')
  if (!com?.ativa) erros.push('A etapa Comercial não pode ser pulada.')
  const primeira = ativas[0]?.etapa
  if (primeira && primeira !== 'COMERCIAL' && primeira !== 'ORCAMENTO') {
    erros.push('O fluxo deve começar por Comercial ou Orçamento.')
  }
  for (const e of etapas) {
    if (!e.ativa) continue
    if (e.bloqueia.includes(e.etapa as Setor)) erros.push(`${ROTULO[e.etapa]} não pode bloquear o próprio setor.`)
    for (const s of e.bloqueia) {
      const alvo = etapas.find((x) => x.etapa === s)
      if (alvo && !alvo.ativa) erros.push(`${ROTULO[e.etapa]} bloqueia ${ROTULO[s]}, que está pulado.`)
    }
  }
  return erros
}

/**
 * Setores que aguardam a vez enquanto `etapa` estiver em andamento: os de etapa ATIVA que vêm depois
 * na sequência (espelha `aguardaPelaSequencia` do servidor). Eles continuam vendo o pedido.
 */
function aguardamPelaSequencia(etapas: EtapaConfig[], etapa: Etapa): Setor[] {
  const i = etapas.findIndex((e) => e.etapa === etapa)
  if (i < 0 || !etapas[i].ativa) return []
  return SETORES.filter((s) => {
    const j = etapas.findIndex((e) => e.etapa === s)
    return s !== etapa && j > i && etapas[j].ativa
  })
}

function Diagrama({ etapas }: { etapas: EtapaConfig[] }) {
  return (
    <Group gap="xs" wrap="wrap" align="stretch">
      {etapas.map((e, i) => {
        const aguardam = aguardamPelaSequencia(etapas, e.etapa).filter((s) => !e.bloqueia.includes(s))
        return (
        <Group key={e.etapa} gap="xs" wrap="nowrap">
          <Card withBorder padding="sm" radius="md" style={{ opacity: e.ativa ? 1 : 0.4, minWidth: 130 }}>
            <Text fw={700} size="sm">{i + 1}. {ROTULO[e.etapa]}</Text>
            {!e.ativa ? (
              <Badge color="gray" size="xs" mt={4}>Pulada</Badge>
            ) : e.bloqueia.length > 0 || aguardam.length > 0 ? (
              <Stack gap={2} mt={4}>
                {e.bloqueia.map((s) => (
                  <Badge key={s} color="red" size="xs" variant="light" leftSection={<IconLock size={10} />}>
                    Bloqueia {ROTULO[s]}
                  </Badge>
                ))}
                {aguardam.map((s) => (
                  <Badge key={`a-${s}`} color="yellow" size="xs" variant="light">
                    {ROTULO[s]} aguarda a vez
                  </Badge>
                ))}
              </Stack>
            ) : (
              <Text size="xs" c="dimmed" mt={4}>Sem bloqueios</Text>
            )}
            {e.ativa && e.automatica && (
              <Badge color="teal" size="xs" variant="light" mt={4}>Avança sozinho</Badge>
            )}
          </Card>
          {i < etapas.length - 1 && <Text c="dimmed">→</Text>}
        </Group>
        )
      })}
    </Group>
  )
}

export default function FluxosPage() {
  const [fluxos, setFluxos] = useState<Record<string, Fluxo>>({})
  const [rascunho, setRascunho] = useState<Record<string, EtapaConfig[]>>({})
  const [aba, setAba] = useState<Operacao>('NOVO')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await api.get<{ fluxos: Fluxo[] }>('/orcamento-grafico/comercial/fluxos')
      const f: Record<string, Fluxo> = {}
      const r: Record<string, EtapaConfig[]> = {}
      for (const x of data.fluxos) {
        f[x.operacao] = x
        r[x.operacao] = x.etapas.map((e) => ({ ...e, bloqueia: [...e.bloqueia] }))
      }
      setFluxos(f)
      setRascunho(r)
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível carregar os fluxos.' })
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const etapas = rascunho[aba] ?? []
  const erros = useMemo(() => validar(etapas), [etapas])
  const alterado = useMemo(
    () => JSON.stringify(etapas) !== JSON.stringify(fluxos[aba]?.etapas ?? []),
    [etapas, fluxos, aba],
  )

  const atualizar = (fn: (e: EtapaConfig[]) => EtapaConfig[]) =>
    setRascunho((r) => ({ ...r, [aba]: fn(r[aba] ?? []) }))

  const mover = (idx: number, delta: number) =>
    atualizar((lista) => {
      const alvo = idx + delta
      if (alvo < 0 || alvo > 2) return lista
      const nova = [...lista]
      ;[nova[idx], nova[alvo]] = [nova[alvo], nova[idx]]
      return nova
    })

  const alterarEtapa = (etapa: Etapa, patch: Partial<EtapaConfig>) =>
    atualizar((lista) =>
      lista.map((e) => {
        if (e.etapa !== etapa) return e
        const novo = { ...e, ...patch }
        if (!novo.ativa) { novo.bloqueia = []; novo.automatica = false }
        return novo
      }),
    )

  const alternarBloqueio = (etapa: Etapa, setor: Setor, marcado: boolean) =>
    atualizar((lista) =>
      lista.map((e) => {
        if (e.etapa !== etapa) return e
        const set = new Set(e.bloqueia)
        if (marcado) set.add(setor)
        else set.delete(setor)
        return { ...e, bloqueia: SETORES.filter((s) => set.has(s)) }
      }),
    )

  const salvar = async () => {
    setSalvando(true)
    try {
      const { data } = await api.put<Fluxo>(`/orcamento-grafico/comercial/fluxos/${aba}`, { etapas })
      setFluxos((f) => ({ ...f, [aba]: data }))
      setRascunho((r) => ({ ...r, [aba]: data.etapas.map((e) => ({ ...e, bloqueia: [...e.bloqueia] })) }))
      notifications.show({ color: 'green', message: 'Fluxo salvo.' })
    } catch (e) {
      const msg = (e as { response?: { data?: { erros?: string[]; error?: string } } }).response?.data
      notifications.show({ color: 'red', message: msg?.erros?.join(' ') || msg?.error || 'Erro ao salvar o fluxo.' })
    } finally {
      setSalvando(false)
    }
  }

  const restaurar = async () => {
    setSalvando(true)
    try {
      const { data } = await api.post<Fluxo>(`/orcamento-grafico/comercial/fluxos/${aba}/restaurar`)
      setFluxos((f) => ({ ...f, [aba]: data }))
      setRascunho((r) => ({ ...r, [aba]: data.etapas.map((e) => ({ ...e, bloqueia: [...e.bloqueia] })) }))
      notifications.show({ color: 'green', message: 'Fluxo restaurado ao padrão.' })
    } catch {
      notifications.show({ color: 'red', message: 'Erro ao restaurar o fluxo.' })
    } finally {
      setSalvando(false)
    }
  }

  const descartar = () =>
    setRascunho((r) => ({
      ...r,
      [aba]: (fluxos[aba]?.etapas ?? []).map((e) => ({ ...e, bloqueia: [...e.bloqueia] })),
    }))

  if (carregando) return <Center h={300}><Loader /></Center>

  return (
    <Stack p="md" gap="md">
      <div>
        <Title order={3}>Fluxos por Operação</Title>
        <Text size="sm" c="dimmed">
          Defina a ordem das etapas, quais são puladas e quais setores ficam bloqueados enquanto cada etapa não for
          concluída. O desbloqueio só acontece alterando o fluxo.
        </Text>
      </div>

      <Tabs value={aba} onChange={(v) => v && setAba(v as Operacao)}>
        <Tabs.List>
          {OPERACOES.map((o) => (
            <Tabs.Tab key={o.valor} value={o.valor}>
              {o.rotulo} {fluxos[o.valor]?.personalizado && <Badge size="xs" ml={4}>Personalizado</Badge>}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Card withBorder padding="md">
        <Text fw={600} mb="xs">Visão do fluxo</Text>
        <Diagrama etapas={etapas} />
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          {etapas.map((e, idx) => {
            const reordenavel = REORDENAVEIS.includes(e.etapa)
            return (
              <Group key={e.etapa} justify="space-between" align="flex-start" wrap="wrap">
                <Group gap="xs">
                  <Stack gap={0}>
                    <ActionIcon variant="subtle" size="sm" disabled={!reordenavel || idx === 0} onClick={() => mover(idx, -1)} aria-label="Subir">
                      <IconArrowUp size={14} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" size="sm" disabled={!reordenavel || idx >= 2} onClick={() => mover(idx, 1)} aria-label="Descer">
                      <IconArrowDown size={14} />
                    </ActionIcon>
                  </Stack>
                  <Text fw={600} w={120}>{idx + 1}. {ROTULO[e.etapa]}</Text>
                  <Switch
                    label="Ativa"
                    checked={e.ativa}
                    disabled={e.etapa === 'COMERCIAL'}
                    onChange={(ev) => alterarEtapa(e.etapa, { ativa: ev.currentTarget.checked })}
                  />
                </Group>
                <Group gap="md">
                  {e.etapa === 'OP_PCP' && (
                    <Switch
                      label="Avançar sozinho para o Faturamento ao concluir as OPs"
                      checked={!!e.automatica}
                      disabled={!e.ativa}
                      onChange={(ev) => alterarEtapa(e.etapa, { automatica: ev.currentTarget.checked })}
                    />
                  )}
                  <Text size="sm" c="dimmed">Enquanto não concluída, bloqueia:</Text>
                  {SETORES.map((s) => (
                    <Checkbox
                      key={s}
                      label={ROTULO[s]}
                      checked={e.bloqueia.includes(s)}
                      disabled={!e.ativa || s === e.etapa || !etapas.find((x) => x.etapa === s)?.ativa}
                      onChange={(ev) => alternarBloqueio(e.etapa, s, ev.currentTarget.checked)}
                    />
                  ))}
                </Group>
              </Group>
            )
          })}
        </Stack>
        <Text size="xs" c="dimmed" mt="sm">
          A ordem define quem espera quem: o setor de uma etapa posterior vê o pedido, mas só age quando chegar a vez dele.
          Os bloqueios marcados somam a isso. Só Comercial, Orçamento e Pré-Impressão podem trocar de ordem entre si; OP/PCP e
          Faturamento ficam sempre por último.
          O fluxo deve começar por Comercial ou Orçamento.
        </Text>
      </Card>

      {erros.length > 0 && (
        <Alert color="red" title="Ajuste o fluxo antes de salvar">
          {erros.map((e) => <Text key={e} size="sm">{e}</Text>)}
        </Alert>
      )}

      <Group>
        <Button onClick={salvar} loading={salvando} disabled={!alterado || erros.length > 0}>Salvar</Button>
        <Button variant="default" onClick={descartar} disabled={!alterado || salvando}>Descartar alterações</Button>
        <Button variant="subtle" color="red" onClick={restaurar} disabled={salvando || !fluxos[aba]?.personalizado}>
          Restaurar padrão
        </Button>
      </Group>
    </Stack>
  )
}

void ORDEM_CANONICA
