'use client'

/**
 * EditorCalculo — Editor do cálculo do item (spec orcamento-editor-calculo, wireframe design §6).
 * Cabeçalho do cálculo, grade do Produto, grade dos Planos do Cálculo (incluir/copiar/excluir/reordenar),
 * Atividades de Acabamento com "Aplicado sobre" e "Detalhes...", e a janela "Planos" de cada plano.
 * Todo cálculo é do servidor; a tela só envia as alterações e mostra o que voltou.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ActionIcon, Alert, Anchor, Badge, Breadcrumbs, Button, Checkbox, Group, Loader, Paper, ScrollArea, SimpleGrid, Stack,
  Table, Text, TextInput, Title, Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowDown, IconArrowUp, IconCalculator, IconCopy, IconPlus, IconRefresh, IconTrash, IconX,
} from '@tabler/icons-react'
import { api } from '@/lib/api'

import { useTodosAcabamentos } from '../../../editor/useTodosAcabamentos'
import JanelaPlanoFolha from './JanelaPlanoFolha'
import JanelaDetalhesAtividade from './JanelaDetalhesAtividade'
import {
  aplicadoSobre,
  corpoAtividades,
  moeda,
  textoFormato,
  textoImpressao,
  ROTULO_PAPEL,
  type AtividadeApi,
  type DetalhesAtividade,
  type MaterialAtividade,
  type VisaoEditor,
} from './editor-calculo'

function mensagem(err: unknown, padrao: string): string {
  const e = err as { response?: { data?: { message?: string } } }
  return e?.response?.data?.message ?? padrao
}

export default function EditorCalculo({ orcamentoId, itemId }: { orcamentoId: string; itemId: string }) {
  const base = `/orcamento-grafico/${orcamentoId}/itens/${itemId}`
  const [visao, setVisao] = useState<VisaoEditor | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [atividadeFoco, setAtividadeFoco] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<AtividadeApi | null>(null)
  const [filtro, setFiltro] = useState('')
  const { acabamentos, carregando: carregandoAcab } = useTodosAcabamentos()

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get<VisaoEditor>(`${base}/editor`)
      setVisao(data)
      setErro(null)
    } catch (err) {
      setErro(mensagem(err, 'Não foi possível abrir o Editor do cálculo.'))
    }
  }, [base])

  useEffect(() => { void carregar() }, [carregar])

  const executar = async (acao: () => Promise<{ data?: unknown } | void>, ok?: string) => {
    setOcupado(true)
    try {
      const r = await acao()
      const data = (r as { data?: unknown } | undefined)?.data
      if (data && typeof data === 'object' && 'folhas' in (data as object)) setVisao(data as VisaoEditor)
      else await carregar()
      if (ok) notifications.show({ message: ok, color: 'green' })
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagem(err, 'Não foi possível concluir.'), color: 'red' })
    } finally {
      setOcupado(false)
    }
  }

  const mapa = useMemo(() => aplicadoSobre(visao?.atividades ?? []), [visao])
  const folhas = visao?.folhas ?? []
  const editavel = !!visao?.item.editavel
  const folhaAberta = folhas.find((f) => f.id === aberta) ?? null

  const gravarAtividades = (novo: Map<string, { folhaIds: string[] }>) =>
    executar(() => api.put(`${base}/editor/atividades`, corpoAtividades(novo)))

  const alternarAtividade = (acabamentoId: string, marcada: boolean) => {
    const novo = new Map([...mapa.entries()].map(([k, v]) => [k, { folhaIds: [...v.folhaIds] }]))
    if (marcada) {
      const alvo = selecionada ?? folhas[0]?.id
      novo.set(acabamentoId, { folhaIds: alvo ? [alvo] : [] })
      setAtividadeFoco(acabamentoId)
    } else {
      novo.delete(acabamentoId)
      if (atividadeFoco === acabamentoId) setAtividadeFoco(null)
    }
    void gravarAtividades(novo)
  }

  const alternarAplicado = (acabamentoId: string, folhaId: string, marcada: boolean) => {
    const novo = new Map([...mapa.entries()].map(([k, v]) => [k, { folhaIds: [...v.folhaIds] }]))
    const atual = novo.get(acabamentoId) ?? { folhaIds: [] }
    atual.folhaIds = marcada ? [...new Set([...atual.folhaIds, folhaId])] : atual.folhaIds.filter((x) => x !== folhaId)
    novo.set(acabamentoId, atual)
    void gravarAtividades(novo)
  }

  const mover = (idx: number, dir: -1 | 1) => {
    const ids = folhas.map((f) => f.id)
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    void executar(() => api.patch(`${base}/folhas/ordem`, { ids }))
  }

  const listaAtividades = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    return [...acabamentos]
      .filter((a) => a.status !== false)
      .filter((a) => !termo || String(a.nome ?? '').toLowerCase().includes(termo))
      .sort((a, b) => Number(mapa.has(b.id)) - Number(mapa.has(a.id)) || String(a.nome).localeCompare(String(b.nome)))
  }, [acabamentos, filtro, mapa])

  if (erro) {
    return (
      <Stack p="md">
        <Alert color="red" title="Editor do cálculo">{erro}</Alert>
        <Anchor component={Link} href={base}>Voltar ao item</Anchor>
      </Stack>
    )
  }
  if (!visao) return <Group p="md"><Loader size="sm" /><Text size="sm">Carregando o Editor do cálculo…</Text></Group>

  const foco = atividadeFoco ? mapa.get(atividadeFoco) : null
  const atividadeDoDetalhe = (acabamentoId: string, folhaId: string | null) =>
    visao.atividades.find((a) => a.acabamentoId === acabamentoId && a.folhaId === folhaId) ?? null

  return (
    <Stack gap="md" p="md" data-testid="editor-calculo">
      <Paper withBorder radius="md" px="md" py="sm" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <Group justify="space-between" wrap="wrap">
          <Stack gap={2}>
            <Breadcrumbs separator="›">
              <Anchor component={Link} href={`/orcamento-grafico/${orcamentoId}`} size="xs">Orçamento nº {visao.item.numeroOrcamento ?? '—'}</Anchor>
              <Anchor component={Link} href={base} size="xs">{visao.item.descricao || 'Item'}</Anchor>
              <Text size="xs" fw={600} c="blue">Editor do cálculo</Text>
            </Breadcrumbs>
            <Title order={4}>Editor do cálculo</Title>
            <Text size="xs" c="dimmed">
              Linha: {visao.linhaProduto ?? '—'} · Tiragem: {visao.item.tiragem.toLocaleString('pt-BR')} · Sigla acabado: {visao.item.siglaAcabado || '—'}
              {visao.calculoOrigem ? ` · Gerado a partir do cálculo ${visao.calculoOrigem}` : ''}
            </Text>
          </Stack>
          <Group gap="xs">
            {editavel && (
              <Tooltip label={visao.gerado ? 'Refaz os planos a partir dos Tipos de Plano do item, mantendo o que foi digitado' : 'Cria os planos do cálculo a partir dos Tipos de Plano do item'}>
                <Button variant="light" leftSection={<IconRefresh size={16} />} loading={ocupado} onClick={() => void executar(() => api.post(`${base}/editor/gerar`), 'Planos do cálculo gerados.')}>
                  {visao.gerado ? 'Gerar planos de novo' : 'Gerar planos'}
                </Button>
              </Tooltip>
            )}
            <Button variant="default" leftSection={<IconCalculator size={16} />} disabled={!visao.gerado || ocupado} onClick={() => void carregar()}>
              Atualizar
            </Button>
            <Button variant="default" leftSection={<IconX size={16} />} component={Link} href={base}>Fechar</Button>
          </Group>
        </Group>
      </Paper>

      {!editavel && <Alert color="gray">O orçamento não está em rascunho: o Editor do cálculo está só para consulta.</Alert>}

      <Paper withBorder radius="md" p="sm">
        <Table withTableBorder verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr><Table.Th>Produto</Table.Th><Table.Th ta="right">Tiragem</Table.Th><Table.Th>Formato</Table.Th><Table.Th>Acabamento</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>{visao.item.descricao || '—'}</Table.Td>
              <Table.Td ta="right">{visao.item.tiragem.toLocaleString('pt-BR')}</Table.Td>
              <Table.Td>{Object.values(visao.item.medidas ?? {}).filter((v) => Number(v) > 0).join(' x ') || '—'}</Table.Td>
              <Table.Td>{visao.atividades.filter((a) => a.folhaId === null).map((a) => a.nome).join(', ') || '—'}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder radius="md" p="sm">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Planos do Cálculo</Text>
          <Text size="sm">Custo dos planos: <b>{moeda(visao.custoFolhas)}</b></Text>
        </Group>
        {!visao.gerado ? (
          <Alert variant="light">
            Este item ainda não tem planos do cálculo: o custo segue o cálculo atual do item. Clique em "Gerar planos" para criá-los a partir
            dos Tipos de Plano e passar a refiná-los aqui.
          </Alert>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder verticalSpacing={4} miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Plano</Table.Th>
                  <Table.Th ta="right">Tiragem</Table.Th>
                  <Table.Th>Suporte</Table.Th>
                  <Table.Th>Formato</Table.Th>
                  <Table.Th>Impressão</Table.Th>
                  <Table.Th>Acabamento</Table.Th>
                  <Table.Th ta="right">Custo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {folhas.map((f) => (
                  <Table.Tr
                    key={f.id}
                    onClick={() => setSelecionada(f.id)}
                    onDoubleClick={() => setAberta(f.id)}
                    style={{ cursor: 'pointer' }}
                    bg={selecionada === f.id ? 'var(--mantine-color-blue-light)' : undefined}
                    data-testid={`folha-${f.sequencia}`}
                  >
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm" fw={500}>{f.nomeExibido}</Text>
                        {f.papel !== 'CAPA' && <Badge size="xs" variant="light">{ROTULO_PAPEL[f.papel]}</Badge>}
                        {f.alteradaNoEditor && <Badge size="xs" color="orange" variant="light">alterado</Badge>}
                        {f.opcoes?.naoCalcular && <Badge size="xs" color="gray">não calcula</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">{(f.tiragem ?? visao.item.tiragem).toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>{f.suporteNc?.nome ? `${f.suporteNc.nome} (NC)` : f.suporteNome ?? '—'}</Table.Td>
                    <Table.Td>{textoFormato(f.formatoFolhaLarguraMm, f.formatoFolhaAlturaMm)}</Table.Td>
                    <Table.Td>{textoImpressao(f)}</Table.Td>
                    <Table.Td><Text size="sm" lineClamp={1}>{visao.atividades.filter((a) => a.folhaId === f.id).map((a) => a.nome).join(', ') || '—'}</Text></Table.Td>
                    <Table.Td ta="right">{f.opcoes?.naoCalcular ? '—' : moeda(f.custoTotal)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
        {visao.gerado && (
          <Group justify="space-between" mt="xs">
            <Text size="xs" c="dimmed">Duplo clique no plano abre a janela Planos.</Text>
            <Group gap={4}>
              <Button size="xs" variant="default" disabled={!selecionada} onClick={() => setAberta(selecionada)}>Abrir</Button>
              {editavel && (
                <>
                  <Tooltip label="Incluir plano"><ActionIcon variant="default" size="lg" aria-label="Incluir plano" disabled={ocupado} onClick={() => void executar(() => api.post(`${base}/folhas`, { nome: 'Plano' }), 'Plano incluído.')}><IconPlus size={16} /></ActionIcon></Tooltip>
                  <Tooltip label="Copiar plano"><ActionIcon variant="default" size="lg" aria-label="Copiar plano" disabled={!selecionada || ocupado} onClick={() => void executar(() => api.post(`${base}/folhas/${selecionada}/copiar`), 'Plano copiado.')}><IconCopy size={16} /></ActionIcon></Tooltip>
                  <Tooltip label="Excluir plano"><ActionIcon variant="default" size="lg" color="red" aria-label="Excluir plano" disabled={!selecionada || ocupado} onClick={() => { if (window.confirm('Excluir este plano do cálculo?')) { const id = selecionada; setSelecionada(null); void executar(() => api.delete(`${base}/folhas/${id}`), 'Plano excluído.') } }}><IconTrash size={16} /></ActionIcon></Tooltip>
                  <Tooltip label="Subir"><ActionIcon variant="default" size="lg" aria-label="Subir plano" disabled={!selecionada || ocupado} onClick={() => mover(folhas.findIndex((f) => f.id === selecionada), -1)}><IconArrowUp size={16} /></ActionIcon></Tooltip>
                  <Tooltip label="Descer"><ActionIcon variant="default" size="lg" aria-label="Descer plano" disabled={!selecionada || ocupado} onClick={() => mover(folhas.findIndex((f) => f.id === selecionada), 1)}><IconArrowDown size={16} /></ActionIcon></Tooltip>
                </>
              )}
            </Group>
          </Group>
        )}
      </Paper>

      {visao.gerado && (
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <Paper withBorder radius="md" p="sm" style={{ gridColumn: 'span 2' }}>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Atividades de Acabamento</Text>
              <TextInput size="xs" placeholder="Filtrar atividades" value={filtro} onChange={(e) => setFiltro(e.currentTarget.value)} w={220} />
            </Group>
            {carregandoAcab && <Group gap="xs"><Loader size="xs" /><Text size="xs" c="dimmed">Carregando atividades…</Text></Group>}
            <ScrollArea h={320}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
                {listaAtividades.map((a) => (
                  <Group key={a.id} gap={4} wrap="nowrap">
                    <Checkbox
                      size="xs"
                      checked={mapa.has(a.id)}
                      disabled={!editavel || ocupado}
                      onChange={(e) => alternarAtividade(a.id, e.currentTarget.checked)}
                      aria-label={String(a.nome)}
                    />
                    <Text
                      size="sm"
                      fw={atividadeFoco === a.id ? 700 : 400}
                      c={mapa.has(a.id) ? undefined : 'dimmed'}
                      style={{ cursor: mapa.has(a.id) ? 'pointer' : 'default' }}
                      onClick={() => mapa.has(a.id) && setAtividadeFoco(a.id)}
                    >
                      {a.nome}
                    </Text>
                  </Group>
                ))}
              </SimpleGrid>
            </ScrollArea>
          </Paper>

          <Paper withBorder radius="md" p="sm">
            <Text fw={600} mb="xs">Aplicado sobre</Text>
            {!foco || !atividadeFoco ? (
              <Text size="sm" c="dimmed">Clique no nome de uma atividade marcada para escolher em quais planos ela roda.</Text>
            ) : (
              <Stack gap={6}>
                <Text size="sm" fw={500}>{foco.nome}</Text>
                {folhas.map((f) => (
                  <Group key={f.id} justify="space-between" wrap="nowrap">
                    <Checkbox
                      size="xs"
                      label={f.nomeExibido}
                      checked={foco.folhaIds.includes(f.id)}
                      disabled={!editavel || ocupado}
                      onChange={(e) => alternarAplicado(atividadeFoco, f.id, e.currentTarget.checked)}
                    />
                    {foco.folhaIds.includes(f.id) && (
                      <Button size="compact-xs" variant="subtle" onClick={() => setDetalhe(atividadeDoDetalhe(atividadeFoco, f.id))}>Detalhes…</Button>
                    )}
                  </Group>
                ))}
                {foco.folhaIds.length === 0 && <Text size="xs" c="dimmed">Nenhum plano marcado: a atividade vale para o produto.</Text>}
              </Stack>
            )}
          </Paper>
        </SimpleGrid>
      )}

      {folhaAberta && (
        <JanelaPlanoFolha
          folha={folhaAberta}
          atividades={visao.atividades}
          editavel={editavel}
          salvando={ocupado}
          onFechar={() => setAberta(null)}
          onSalvar={(dados) => void executar(() => api.put(`${base}/folhas/${folhaAberta.id}`, dados), 'Plano salvo.').then(() => setAberta(null))}
          onVoltarCalculado={(campo) => void executar(() => api.post(`${base}/folhas/${folhaAberta.id}/limpar-manual`, { campo }))}
          onDetalhes={(a) => setDetalhe(a)}
        />
      )}

      {detalhe && (
        <JanelaDetalhesAtividade
          atividade={detalhe}
          nomePlano={folhas.find((f) => f.id === detalhe.folhaId)?.nomeExibido ?? 'Produto'}
          editavel={editavel}
          salvando={ocupado}
          onFechar={() => setDetalhe(null)}
          onSalvar={(dados: { detalhes: DetalhesAtividade; materiais: MaterialAtividade[]; infoComplementar: string | null }) =>
            void executar(() => api.put(`${base}/editor/atividades/${detalhe.id}`, dados), 'Detalhes salvos.').then(() => setDetalhe(null))
          }
        />
      )}
    </Stack>
  )
}
