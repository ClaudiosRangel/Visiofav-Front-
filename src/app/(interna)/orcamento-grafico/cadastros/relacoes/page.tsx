'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Text, Loader, Center, Select, TextInput, Checkbox, Alert,
  Modal, Badge, ScrollArea, Paper, SimpleGrid,
} from '@mantine/core'
import {
  IconAlertCircle, IconDeviceFloppy, IconSearch, IconShieldCheck, IconCircleCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { relacoesApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type { VerificacaoRelacoes } from '../_shared/cadastros-graficos.types'
import {
  PARES_PERMITIDOS, listarItensDoTipo, rotuloTipo, type OpcaoCadastro,
} from './listas-tipos'

interface Marca { marcado: boolean; padrao: boolean }

const OPCOES_PAR = PARES_PERMITIDOS.map((p) => ({
  value: `${p.origem}>${p.destino}`,
  label: `${rotuloTipo(p.origem)} → ${rotuloTipo(p.destino)}`,
}))

function mensagemComDetalhe(err: unknown): string {
  const base = mensagemErroApi(err, 'Falha ao salvar relações')
  const inv = (err as { response?: { data?: { idsInvalidos?: string[] } } })?.response?.data?.idsInvalidos
  return inv && inv.length > 0 ? `${base} (${inv.length} item(ns) inválido(s))` : base
}

export default function RelacoesPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Relações' }, [])

  const [par, setPar] = useState<string | null>(OPCOES_PAR[0]?.value ?? null)
  const [origemId, setOrigemId] = useState<string | null>(null)
  const [origens, setOrigens] = useState<OpcaoCadastro[]>([])
  const [destinos, setDestinos] = useState<OpcaoCadastro[]>([])
  const [marcas, setMarcas] = useState<Record<string, Marca>>({})
  const [inicial, setInicial] = useState<string>('')
  const [busca, setBusca] = useState('')

  const [carregandoListas, setCarregandoListas] = useState(false)
  const [carregandoRel, setCarregandoRel] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroListas, setErroListas] = useState<string | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const [verificando, setVerificando] = useState(false)
  const [verificacao, setVerificacao] = useState<VerificacaoRelacoes | null>(null)

  const [tipoOrigem, tipoDestino] = useMemo(() => (par ? par.split('>') : ['', '']), [par])

  // Carrega as listas de origem e destino ao trocar o par.
  const carregarListas = useCallback(async () => {
    if (!tipoOrigem || !tipoDestino) return
    setCarregandoListas(true)
    setErroListas(null)
    setOrigemId(null)
    setMarcas({})
    setInicial('')
    try {
      const [o, d] = await Promise.all([listarItensDoTipo(tipoOrigem), listarItensDoTipo(tipoDestino)])
      setOrigens(o)
      setDestinos(d)
    } catch (err) {
      setOrigens([])
      setDestinos([])
      setErroListas(mensagemErroApi(err, 'Falha ao carregar os cadastros do par selecionado'))
    } finally {
      setCarregandoListas(false)
    }
  }, [tipoOrigem, tipoDestino])

  useEffect(() => { carregarListas() }, [carregarListas])

  // Carrega as relações atuais da origem escolhida.
  useEffect(() => {
    if (!origemId) { setMarcas({}); setInicial(''); return }
    let ativo = true
    setCarregandoRel(true)
    setErroSalvar(null)
    relacoesApi
      .listar({ tipoOrigem, idOrigem: origemId, tipoDestino })
      .then((rels) => {
        if (!ativo) return
        const m: Record<string, Marca> = {}
        for (const r of rels) m[r.idDestino] = { marcado: true, padrao: !!r.padrao }
        setMarcas(m)
        setInicial(assinatura(m))
      })
      .catch((err) => {
        if (!ativo) return
        setMarcas({})
        setInicial('')
        setErroSalvar(mensagemErroApi(err, 'Falha ao carregar as relações da origem'))
      })
      .finally(() => { if (ativo) setCarregandoRel(false) })
    return () => { ativo = false }
  }, [origemId, tipoOrigem, tipoDestino])

  const nomePorId = useMemo(() => new Map(destinos.map((d) => [d.id, d.nome])), [destinos])

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t ? destinos.filter((d) => d.nome.toLowerCase().includes(t)) : destinos
  }, [destinos, busca])

  const totalMarcados = useMemo(() => Object.values(marcas).filter((m) => m.marcado).length, [marcas])
  const alterado = origemId != null && assinatura(marcas) !== inicial

  function alternar(id: string, marcado: boolean) {
    setMarcas((prev) => ({ ...prev, [id]: { marcado, padrao: marcado ? (prev[id]?.padrao ?? false) : false } }))
  }

  function alternarPadrao(id: string, padrao: boolean) {
    setMarcas((prev) => ({ ...prev, [id]: { marcado: true, padrao } }))
  }

  function marcarVisiveis(marcado: boolean) {
    setMarcas((prev) => {
      const prox = { ...prev }
      for (const d of visiveis) prox[d.id] = { marcado, padrao: marcado ? (prev[d.id]?.padrao ?? false) : false }
      return prox
    })
  }

  async function salvar() {
    if (!origemId) return
    const ids = Object.entries(marcas).filter(([, m]) => m.marcado).map(([id]) => id)
    const padroes = ids.filter((id) => marcas[id].padrao)
    setSalvando(true)
    setErroSalvar(null)
    try {
      await relacoesApi.salvar({ tipoOrigem, idOrigem: origemId, tipoDestino, ids, padroes })
      setInicial(assinatura(marcas))
      notifications.show({ title: 'Salvo', message: 'Relações atualizadas.', color: 'green' })
    } catch (err) {
      const msg = mensagemComDetalhe(err)
      setErroSalvar(msg)
      notifications.show({ title: 'Não foi possível salvar', message: msg, color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function verificar() {
    setVerificando(true)
    try {
      setVerificacao(await relacoesApi.verificar())
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErroApi(err, 'Falha ao verificar relações'), color: 'red' })
    } finally {
      setVerificando(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Relações entre Cadastros</Title>
          <Text size="sm" c="dimmed">
            Escolha o par de cadastros e o item de origem; marque os destinos relacionados e, quando houver, o padrão.
          </Text>
        </div>
        <Group>
          <Button variant="default" leftSection={<IconShieldCheck size={16} />} onClick={verificar} loading={verificando}>
            Verificar relações órfãs
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={salvar}
            loading={salvando}
            disabled={!origemId || !alterado || carregandoRel}
          >
            Salvar
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Select
          label="Par de relação (origem → destino)"
          data={OPCOES_PAR}
          value={par}
          onChange={(v) => { setPar(v); setBusca('') }}
          allowDeselect={false}
          searchable
        />
        <Select
          label={`Item de origem — ${rotuloTipo(tipoOrigem)}`}
          placeholder={carregandoListas ? 'Carregando…' : 'Selecione'}
          data={origens.map((o) => ({ value: o.id, label: o.nome }))}
          value={origemId}
          onChange={setOrigemId}
          searchable
          clearable
          nothingFoundMessage="Nenhum item encontrado"
          disabled={carregandoListas || origens.length === 0}
        />
      </SimpleGrid>

      {erroListas && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Erro ao carregar">
          <Group justify="space-between">
            <Text size="sm">{erroListas}</Text>
            <Button size="xs" variant="light" onClick={carregarListas}>Tentar novamente</Button>
          </Group>
        </Alert>
      )}

      {erroSalvar && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Erro" withCloseButton onClose={() => setErroSalvar(null)}>
          {erroSalvar}
        </Alert>
      )}

      {carregandoListas ? (
        <Center py="xl"><Loader /></Center>
      ) : !origemId ? (
        !erroListas && (
          <Center py="xl">
            <Text c="dimmed">
              {origens.length === 0 ? `Nenhum cadastro de ${rotuloTipo(tipoOrigem).toLowerCase()} disponível.` : 'Selecione o item de origem para ver os destinos.'}
            </Text>
          </Center>
        )
      ) : carregandoRel ? (
        <Center py="xl"><Loader /></Center>
      ) : destinos.length === 0 ? (
        <Center py="xl"><Text c="dimmed">Nenhum cadastro de {rotuloTipo(tipoDestino).toLowerCase()} disponível.</Text></Center>
      ) : (
        <Paper withBorder p="sm">
          <Group justify="space-between" mb="xs">
            <TextInput
              style={{ flex: 1, maxWidth: 360 }}
              placeholder={`Buscar ${rotuloTipo(tipoDestino).toLowerCase()}…`}
              leftSection={<IconSearch size={16} />}
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
            />
            <Group gap="xs">
              <Badge variant="light">{totalMarcados} de {destinos.length} marcado(s)</Badge>
              <Button size="xs" variant="subtle" onClick={() => marcarVisiveis(true)}>Marcar visíveis</Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => marcarVisiveis(false)}>Desmarcar visíveis</Button>
            </Group>
          </Group>
          <ScrollArea h={460}>
            <Table highlightOnHover stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={60}>Relacionar</Table.Th>
                  <Table.Th>{rotuloTipo(tipoDestino)}</Table.Th>
                  <Table.Th w={100}>Padrão</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visiveis.length === 0 ? (
                  <Table.Tr><Table.Td colSpan={3}><Text c="dimmed" ta="center">Nenhum resultado para a busca.</Text></Table.Td></Table.Tr>
                ) : visiveis.map((d) => {
                  const m = marcas[d.id]
                  return (
                    <Table.Tr key={d.id}>
                      <Table.Td>
                        <Checkbox
                          checked={!!m?.marcado}
                          onChange={(e) => alternar(d.id, e.currentTarget.checked)}
                          aria-label={`Relacionar ${d.nome}`}
                        />
                      </Table.Td>
                      <Table.Td>{d.nome}</Table.Td>
                      <Table.Td>
                        <Checkbox
                          checked={!!m?.padrao}
                          disabled={!m?.marcado}
                          onChange={(e) => alternarPadrao(d.id, e.currentTarget.checked)}
                          aria-label={`Padrão: ${d.nome}`}
                        />
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      <Modal opened={verificacao != null} onClose={() => setVerificacao(null)} title="Verificação de relações órfãs" size="lg">
        {verificacao && (
          verificacao.totalOrfas === 0 ? (
            <Alert color="green" variant="light" icon={<IconCircleCheck size={16} />}>
              Nenhuma relação órfã. {verificacao.total} relação(ões) verificada(s).
            </Alert>
          ) : (
            <Stack gap="sm">
              <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
                {verificacao.totalOrfas} órfã(s) em {verificacao.total} relação(ões). Origem ou destino não existe mais.
              </Alert>
              <ScrollArea h={320}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr><Table.Th>Origem</Table.Th><Table.Th>Destino</Table.Th></Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {verificacao.orfas.map((o) => (
                      <Table.Tr key={o.id}>
                        <Table.Td>
                          <Text size="sm">{rotuloTipo(o.tipoOrigem)}</Text>
                          <Text size="xs" c="dimmed">{nomePorId.get(o.idOrigem) ?? o.idOrigem}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{rotuloTipo(o.tipoDestino)}</Text>
                          <Text size="xs" c="dimmed">{nomePorId.get(o.idDestino) ?? o.idDestino}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          )
        )}
      </Modal>
    </Stack>
  )
}

/** Assinatura estável do estado marcado/padrão, para detectar alterações. */
function assinatura(m: Record<string, Marca>): string {
  return Object.entries(m)
    .filter(([, v]) => v.marcado)
    .map(([id, v]) => `${id}:${v.padrao ? 1 : 0}`)
    .sort()
    .join('|')
}
