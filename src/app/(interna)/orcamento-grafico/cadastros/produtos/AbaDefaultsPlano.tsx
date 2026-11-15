'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Stack, Group, Button, Loader, Center, Alert, Text, Select, Switch, NumberInput, TextInput,
  MultiSelect, SimpleGrid, Badge,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { mensagemErroApi, produtosApi, relacoesApi, tiposPlanoApi } from '../_shared/cadastros-graficos.api'
import type { DefaultProdutoPlano } from '../_shared/cadastros-graficos.types'

interface Opcao { value: string; label: string }

interface FormDefault {
  semImpressao: boolean
  processoImpressaoId: string | null
  coberturaTintaId: string | null
  coresFrente: number | ''
  coresVerso: number | ''
  areaTintaPerc: number | ''
  fabricanteSuporte: string
  atividadesPreMarcadas: string[]
}

const FORM_VAZIO: FormDefault = {
  semImpressao: false,
  processoImpressaoId: null,
  coberturaTintaId: null,
  coresFrente: 0,
  coresVerso: 0,
  areaTintaPerc: 0,
  fabricanteSuporte: '',
  atividadesPreMarcadas: [],
}

function formDoDefault(d: DefaultProdutoPlano | undefined): FormDefault {
  if (!d) return FORM_VAZIO
  return {
    semImpressao: d.semImpressao,
    processoImpressaoId: d.processoImpressaoId,
    coberturaTintaId: d.coberturaTintaId,
    coresFrente: d.coresFrente ?? 0,
    coresVerso: d.coresVerso ?? 0,
    areaTintaPerc: Number(d.areaTintaPerc ?? 0),
    fabricanteSuporte: d.fabricanteSuporte ?? '',
    atividadesPreMarcadas: d.atividadesPreMarcadas ?? [],
  }
}

async function listarSimples(url: string): Promise<Opcao[]> {
  const res = await api.get(url, { params: { situacao: 'ativa' } })
  const lista: Array<{ id: string; codigo?: string; nome: string }> =
    res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
  return lista.map((i) => ({ value: i.id, label: i.codigo ? `${i.codigo} — ${i.nome}` : i.nome }))
}

interface Props {
  produtoId: string
  /** Incrementa quando as relações de PLANO do produto mudam. */
  versaoRelacoes: number
}

export default function AbaDefaultsPlano({ produtoId, versaoRelacoes }: Props) {
  const [planos, setPlanos] = useState<Opcao[]>([])
  const [defaults, setDefaults] = useState<DefaultProdutoPlano[]>([])
  const [processos, setProcessos] = useState<Opcao[]>([])
  const [coberturas, setCoberturas] = useState<Opcao[]>([])
  const [atividades, setAtividades] = useState<Opcao[]>([])
  const [planoId, setPlanoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormDefault>(FORM_VAZIO)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [relPlanos, todosPlanos, listaDefaults, procs, cobs, resAtiv] = await Promise.all([
        relacoesApi.listar({ tipoOrigem: 'PRODUTO', idOrigem: produtoId, tipoDestino: 'PLANO' }),
        tiposPlanoApi.listar({ situacao: 'todos' }),
        produtosApi.listarDefaults(produtoId),
        listarSimples('/orcamento-grafico/processos-impressao'),
        listarSimples('/orcamento-grafico/coberturas-tinta'),
        api.get('/orcamento-grafico/acabamentos', { params: { page: 1, limit: 500 } }),
      ])
      const nomes = new Map(todosPlanos.map((p) => [p.id, `${p.codigo} — ${p.nome}`]))
      // Só planos relacionados ao produto.
      setPlanos(relPlanos.map((r) => ({ value: r.idDestino, label: nomes.get(r.idDestino) ?? r.idDestino })))
      setDefaults(listaDefaults)
      setProcessos(procs)
      setCoberturas(cobs)
      const ativ: Array<{ id: string; nome: string }> =
        resAtiv.data?.data ?? (Array.isArray(resAtiv.data) ? resAtiv.data : [])
      setAtividades(ativ.map((a) => ({ value: a.id, label: a.nome })))
      // Se o plano escolhido deixou de estar relacionado, limpa a escolha.
      setPlanoId((atual) => (atual && relPlanos.some((r) => r.idDestino === atual) ? atual : null))
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao carregar os padrões por plano'))
    } finally {
      setLoading(false)
    }
  }, [produtoId])

  useEffect(() => { carregar() }, [carregar, versaoRelacoes])

  function escolherPlano(id: string | null) {
    setPlanoId(id)
    setErroSalvar(null)
    setForm(formDoDefault(defaults.find((d) => d.tipoPlanoId === id)))
  }

  // Mantém o formulário em sincronia quando a lista de defaults é recarregada.
  useEffect(() => {
    if (planoId) setForm(formDoDefault(defaults.find((d) => d.tipoPlanoId === planoId)))
  }, [defaults, planoId])

  const existente = planoId ? defaults.some((d) => d.tipoPlanoId === planoId) : false

  async function salvar() {
    if (!planoId) return
    setSalvando(true)
    setErroSalvar(null)
    try {
      const salvo = await produtosApi.salvarDefault(produtoId, planoId, {
        semImpressao: form.semImpressao,
        processoImpressaoId: form.processoImpressaoId,
        coberturaTintaId: form.coberturaTintaId,
        coresFrente: form.coresFrente === '' ? 0 : form.coresFrente,
        coresVerso: form.coresVerso === '' ? 0 : form.coresVerso,
        areaTintaPerc: form.areaTintaPerc === '' ? 0 : form.areaTintaPerc,
        fabricanteSuporte: form.fabricanteSuporte.trim() || null,
        atividadesPreMarcadas: form.atividadesPreMarcadas,
      })
      setDefaults((lista) => [...lista.filter((d) => d.tipoPlanoId !== planoId), salvo])
      notifications.show({ title: 'Salvo', message: 'Padrão do plano salvo', color: 'green' })
    } catch (err) {
      // Inclui a mensagem 422 do back (ex.: plano não relacionado ao produto).
      const msg = mensagemErroApi(err, 'Falha ao salvar o padrão do plano')
      setErroSalvar(msg)
      notifications.show({ title: 'Erro ao salvar', message: msg, color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function remover() {
    if (!planoId || !confirm('Remover o padrão deste plano?')) return
    setRemovendo(true)
    setErroSalvar(null)
    try {
      await produtosApi.removerDefault(produtoId, planoId)
      setDefaults((lista) => lista.filter((d) => d.tipoPlanoId !== planoId))
      setForm(FORM_VAZIO)
      notifications.show({ title: 'Removido', message: 'Padrão do plano removido', color: 'yellow' })
    } catch (err) {
      const msg = mensagemErroApi(err, 'Falha ao remover o padrão')
      setErroSalvar(msg)
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    } finally {
      setRemovendo(false)
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>

  if (erro) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />} title="Erro ao carregar">
        <Group justify="space-between">
          <Text size="sm">{erro}</Text>
          <Button size="xs" variant="light" onClick={carregar}>Tentar novamente</Button>
        </Group>
      </Alert>
    )
  }

  if (planos.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
        Este produto ainda não tem tipos de plano relacionados. Relacione os planos na aba Relações
        para definir os padrões por plano.
      </Alert>
    )
  }

  return (
    <Stack gap="md">
      <Select
        label="Tipo de plano"
        description="Apenas planos relacionados ao produto"
        placeholder="Selecione o plano"
        data={planos.map((p) => ({
          ...p,
          label: defaults.some((d) => d.tipoPlanoId === p.value) ? `${p.label} (com padrão)` : p.label,
        }))}
        value={planoId}
        onChange={escolherPlano}
        searchable
      />

      {planoId && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge variant="light" color={existente ? 'green' : 'gray'}>
              {existente ? 'Padrão definido' : 'Sem padrão definido'}
            </Badge>
          </Group>

          <Switch
            label="Sem impressão"
            checked={form.semImpressao}
            onChange={(e) => setForm({ ...form, semImpressao: e.currentTarget.checked })}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Processo de impressão"
              clearable
              searchable
              data={processos}
              value={form.processoImpressaoId}
              onChange={(v) => setForm({ ...form, processoImpressaoId: v })}
              disabled={form.semImpressao}
            />
            <Select
              label="Cobertura de tinta"
              clearable
              searchable
              data={coberturas}
              value={form.coberturaTintaId}
              onChange={(v) => setForm({ ...form, coberturaTintaId: v })}
              disabled={form.semImpressao}
            />
            <NumberInput
              label="Cores frente"
              min={0}
              allowDecimal={false}
              value={form.coresFrente}
              onChange={(v) => setForm({ ...form, coresFrente: v === '' ? '' : Number(v) })}
              disabled={form.semImpressao}
            />
            <NumberInput
              label="Cores verso"
              min={0}
              allowDecimal={false}
              value={form.coresVerso}
              onChange={(v) => setForm({ ...form, coresVerso: v === '' ? '' : Number(v) })}
              disabled={form.semImpressao}
            />
            <NumberInput
              label="Área de tinta (%)"
              min={0}
              max={100}
              decimalScale={2}
              value={form.areaTintaPerc}
              onChange={(v) => setForm({ ...form, areaTintaPerc: v === '' ? '' : Number(v) })}
              disabled={form.semImpressao}
            />
            <TextInput
              label="Fabricante do suporte"
              maxLength={120}
              value={form.fabricanteSuporte}
              onChange={(e) => setForm({ ...form, fabricanteSuporte: e.currentTarget.value })}
            />
          </SimpleGrid>

          <MultiSelect
            label="Atividades pré-marcadas"
            description="Atividades que já vêm marcadas ao usar este plano no produto"
            placeholder="Pesquisar atividade"
            searchable
            clearable
            nothingFoundMessage="Nenhuma atividade encontrada"
            data={atividades}
            value={form.atividadesPreMarcadas}
            onChange={(v) => setForm({ ...form, atividadesPreMarcadas: v })}
            maxDropdownHeight={240}
          />

          {erroSalvar && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} title="Não foi possível salvar">
              {erroSalvar}
            </Alert>
          )}

          <Group justify="space-between">
            <Button
              variant="light"
              color="red"
              onClick={remover}
              loading={removendo}
              disabled={!existente}
            >
              Remover padrão
            </Button>
            <Button onClick={salvar} loading={salvando}>Salvar padrão</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
