'use client'

import { useCallback, useEffect, useState } from 'react'
import { Stack, MultiSelect, Button, Group, Loader, Center, Alert, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import {
  itensDiversosApi, mensagemErroApi, relacoesApi, tiposPlanoApi,
} from '../_shared/cadastros-graficos.api'

interface Opcao { value: string; label: string }

type DestinoRelacao = 'PLANO' | 'ATIVIDADE' | 'ACONDICIONAMENTO' | 'ITEM_DIVERSO'

const DESTINOS: DestinoRelacao[] = ['PLANO', 'ATIVIDADE', 'ACONDICIONAMENTO', 'ITEM_DIVERSO']

type Selecao = Record<DestinoRelacao, string[]>

const VAZIO: Selecao = { PLANO: [], ATIVIDADE: [], ACONDICIONAMENTO: [], ITEM_DIVERSO: [] }

interface Props {
  produtoId: string
  /** Chamado após salvar as relações de PLANO (a aba de defaults depende delas). */
  onPlanosAlterados: () => void
}

export default function AbaRelacoesProduto({ produtoId, onPlanosAlterados }: Props) {
  const [planos, setPlanos] = useState<Opcao[]>([])
  const [atividades, setAtividades] = useState<Opcao[]>([])
  const [itens, setItens] = useState<Opcao[]>([])
  const [sel, setSel] = useState<Selecao>(VAZIO)
  const [original, setOriginal] = useState<Selecao>(VAZIO)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [listaPlanos, resAtiv, listaItens, relacoes] = await Promise.all([
        tiposPlanoApi.listar({ situacao: 'ativo' }),
        api.get('/orcamento-grafico/acabamentos', { params: { page: 1, limit: 500 } }),
        itensDiversosApi.listar({ pagina: 1, limite: 200, status: 'ativo' }),
        relacoesApi.listar({ tipoOrigem: 'PRODUTO', idOrigem: produtoId }),
      ])
      setPlanos(listaPlanos.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` })))
      const ativ: Array<{ id: string; nome: string }> =
        resAtiv.data?.data ?? (Array.isArray(resAtiv.data) ? resAtiv.data : [])
      setAtividades(ativ.map((a) => ({ value: a.id, label: a.nome })))
      setItens((listaItens.itens ?? []).map((i) => ({ value: i.id, label: i.nome })))

      const atual: Selecao = { PLANO: [], ATIVIDADE: [], ACONDICIONAMENTO: [], ITEM_DIVERSO: [] }
      // A listagem já vem ordenada por `ordem`.
      for (const r of relacoes) {
        if ((DESTINOS as string[]).includes(r.tipoDestino)) {
          atual[r.tipoDestino as DestinoRelacao].push(r.idDestino)
        }
      }
      setSel(atual)
      setOriginal(atual)
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao carregar as relações'))
    } finally {
      setLoading(false)
    }
  }, [produtoId])

  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setSalvando(true)
    try {
      let planosMudaram = false
      for (const destino of DESTINOS) {
        const novo = sel[destino]
        const antigo = original[destino]
        if (novo.length === antigo.length && novo.every((v, i) => v === antigo[i])) continue
        // PUT substitui o conjunto de destinos (idempotente).
        await relacoesApi.salvar({
          tipoOrigem: 'PRODUTO',
          idOrigem: produtoId,
          tipoDestino: destino,
          ids: novo,
        })
        if (destino === 'PLANO') planosMudaram = true
      }
      setOriginal(sel)
      if (planosMudaram) onPlanosAlterados()
      notifications.show({ title: 'Salvo', message: 'Relações do produto atualizadas', color: 'green' })
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar as relações'), color: 'red' })
    } finally {
      setSalvando(false)
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

  const campo = (
    destino: DestinoRelacao,
    label: string,
    description: string,
    data: Opcao[],
  ) => (
    <MultiSelect
      label={label}
      description={description}
      placeholder="Pesquisar..."
      searchable
      clearable
      nothingFoundMessage="Nada encontrado"
      data={data}
      value={sel[destino]}
      onChange={(v) => setSel((s) => ({ ...s, [destino]: v }))}
      maxDropdownHeight={240}
    />
  )

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Defina o que este produto oferece no orçamento. Ao salvar, o conjunto de cada lista substitui o anterior.
      </Text>
      {campo('PLANO', 'Tipos de plano', 'Planos disponíveis para o produto (necessário para definir os defaults por plano)', planos)}
      {campo('ATIVIDADE', 'Atividades', 'Acabamentos aplicáveis ao produto', atividades)}
      {campo('ACONDICIONAMENTO', 'Acondicionamento', 'Atividades de acondicionamento do produto', atividades)}
      {campo('ITEM_DIVERSO', 'Itens diversos', 'Itens de custo adicionais do produto', itens)}
      <Group justify="flex-end">
        <Button onClick={salvar} loading={salvando}>Salvar relações</Button>
      </Group>
    </Stack>
  )
}
