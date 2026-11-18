'use client'

/**
 * TelaPlano — nível 3 da hierarquia Orçamento → Item → Plano (R10, tarefa 7.14).
 *
 * Rota `/orcamento-grafico/:id/itens/:itemId/planos/:planoId` (`planoId = novo` cria; `?apos=<id>`
 * vira `posicaoApos` do POST). Título "Plano — {nome}" ("Novo plano" no novo), migalhas
 * Orçamento nº → Item → Plano. Só campos do PLANO; nenhum campo do item é exibido ou gravado
 * (a tiragem do item só serve de padrão da tiragem do plano).
 *
 * Campos: Tipo de Plano (tipos permitidos ao produto do item, pelo catálogo), Nome, Ocorrências,
 * Tiragem; Montagem, Corte, Formato Aberto, Formato Final; Cores, Processo (Pré e cadeado),
 * Cobertura; blocos de suporte pelo tipo (`BlocosPorTipoPlano`); Acabamento (`BlocoAcabamento`).
 *
 * Regras:
 *  - plano novo: ao escolher o tipo aplica o `DefaultProdutoPlano` (`aplicarPadroesNoPlano` +
 *    cores, processo, cobertura, fabricante e atividades pré-marcadas) só em campo não tocado;
 *    plano gravado nunca reaplica (trocar o tipo só muda os blocos exibidos);
 *  - OK valida (erro junto ao campo), grava só os blocos exibidos e volta ao item; plano gravado
 *    aberto e OK sem mudança volta sem chamar a API; erro de gravação mantém o formulário e mostra
 *    "campo: motivo" do back;
 *  - Cancelar volta ao item sem chamada à API;
 *  - item com `calculoGraficoOrigemId` (custo ancorado): aviso "O custo deste item vem de um cálculo
 *    anterior e pode mudar" na tela e confirmação com o mesmo texto antes de gravar uma alteração;
 *  - plano criado: `registrarPlanoIncluido` (o Desfazer do Grid apaga o plano criado).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert, Anchor, Breadcrumbs, Button, Center, Group, Loader, Modal, Paper, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title,
} from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconCheck, IconLayoutList, IconX } from '@tabler/icons-react'

import { api } from '@/lib/api'
import type { CatalogoPlano } from '../../../../cadastros/_shared/cadastros-graficos.types'
import { notificarAlteracaoItem } from '../../../_hooks/sinal-alteracao-item'
import { useProcessosImpressao } from '../../../_hooks/useOpcoesPlanoUnico'
import { resolverPadroesIniciais } from '../../../_layout/resolver-layout-item'
import { useCatalogoItem } from '../../../editor/catalogo/useCatalogoItem'
import { useTodosAcabamentos } from '../../../editor/useTodosAcabamentos'
import BlocoAcabamento from '../_item/BlocoAcabamento'
import { aplicarPreMarcadas, type AtividadeCadastro } from '../_item/acabamento-item'
import { mensagemErroServidor } from '../_item/tela-item'
import BlocosPorTipoPlano, { CamposImpressao, type ChaveBlocoSuporte } from './BlocosPorTipoPlano'
import { ID_PLANO_NOVO, type PlanoLeitura } from './plano.types'
import {
  MAX_NOME_PLANO,
  MAX_TEXTO_CURTO,
  aplicarPadroesDoTipo,
  blocosDaTela,
  estadoDoPlano,
  estadoPlanoNovo,
  houveMudanca,
  montarBodyTelaPlano,
  textoErrosPlano,
  validarTelaPlano,
  type ContextoItemPlano,
  type EstadoTelaPlano,
} from './tela-plano'
import { registrarPlanoIncluido } from './usePlanosDoItem'

export const AVISO_CUSTO_ANCORADO = 'O custo deste item vem de um cálculo anterior e pode mudar'
export const MSG_PLANO_NAO_GRAVADO = 'O plano não foi gravado.'

export interface TelaPlanoProps {
  orcamentoId: string
  itemId: string
  planoId: string
  /** `?apos=` da URL: o plano novo entra logo abaixo deste. */
  posicaoApos?: string | null
}

interface OrcamentoParaPlano {
  id: string
  numero: number
  status: string
  itens?: Array<Record<string, any>> | null
}

interface ItemParaPlano {
  id: string
  quantidade: number | null
  produtoGraficoId: string | null
  calculoGraficoOrigemId: string | null
}

export default function TelaPlano({ orcamentoId, itemId, planoId, posicaoApos }: TelaPlanoProps) {
  const routerInstavel = useRouter()
  const routerRef = useRef(routerInstavel)
  routerRef.current = routerInstavel
  const novo = planoId === ID_PLANO_NOVO
  const urlItem = `/orcamento-grafico/${orcamentoId}/itens/${itemId}`

  const [orcamento, setOrcamento] = useState<OrcamentoParaPlano | null>(null)
  const [item, setItem] = useState<ItemParaPlano | null>(null)
  const [plano, setPlano] = useState<PlanoLeitura | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [carregandoDados, setCarregandoDados] = useState(true)

  const [inicial, setInicial] = useState<EstadoTelaPlano | null>(null)
  const [estado, setEstado] = useState<EstadoTelaPlano | null>(null)
  const tocados = useRef<Set<string>>(new Set())
  const [tentouOk, setTentouOk] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [confirmarAncorado, setConfirmarAncorado] = useState(false)

  const [catalogoPlano, setCatalogoPlano] = useState<CatalogoPlano | null>(null)
  const [processoPre, setProcessoPre] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Carga: orçamento (item) e, no plano gravado, o plano.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelado = false
    setCarregandoDados(true)
    ;(async () => {
      try {
        const { data } = await api.get(`/orcamento-grafico/${orcamentoId}`)
        const orc = data as OrcamentoParaPlano
        const bruto = (orc.itens ?? []).find((i) => i.id === itemId) ?? null
        if (!bruto) throw Object.assign(new Error('Item não encontrado.'), { naoEncontrado: true })
        let lido: PlanoLeitura | null = null
        if (!novo) {
          const resp = await api.get(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${planoId}`)
          lido = resp.data as PlanoLeitura
        }
        if (cancelado) return
        setOrcamento(orc)
        setItem({
          id: bruto.id,
          quantidade: Number.isFinite(Number(bruto.quantidade)) ? Number(bruto.quantidade) : null,
          produtoGraficoId: bruto.produtoGraficoId ?? null,
          calculoGraficoOrigemId: bruto.calculoGraficoOrigemId ?? null,
        })
        setPlano(lido)
        setErroCarga(null)
      } catch (err) {
        if (cancelado) return
        const e = err as { naoEncontrado?: boolean; response?: { status?: number } }
        setErroCarga(
          e?.naoEncontrado || e?.response?.status === 404
            ? 'Registro não encontrado.'
            : mensagemErroServidor(err, 'Não foi possível carregar o plano.'),
        )
      } finally {
        if (!cancelado) setCarregandoDados(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [orcamentoId, itemId, planoId, novo])

  // ---------------------------------------------------------------------------
  // Catálogo do produto do item: tipos de plano permitidos e o catálogo do tipo escolhido.
  // ---------------------------------------------------------------------------

  const catalogoItem = useCatalogoItem(item?.produtoGraficoId ?? null)
  const catalogo = catalogoItem.catalogo
  const tiposPermitidos = useMemo(() => catalogo?.produto.planos ?? [], [catalogo])
  const catalogoPronto = !!item && (!item.produtoGraficoId || !!catalogo || !!catalogoItem.erro)

  const ctx: ContextoItemPlano = useMemo(() => ({ tiragemItem: item?.quantidade ?? null }), [item?.quantidade])

  // Estado inicial: só depois do catálogo, para saber os blocos do tipo gravado.
  useEffect(() => {
    if (carregandoDados || erroCarga || !item || !catalogoPronto || inicial) return
    const tipo = plano ? tiposPermitidos.find((t) => t.id === plano.tipoPlanoId) ?? null : null
    const e = plano ? estadoDoPlano(plano, ctx, blocosDaTela(tipo)) : estadoPlanoNovo(ctx)
    setInicial(e)
    setEstado(e)
  }, [carregandoDados, erroCarga, item, catalogoPronto, inicial, plano, tiposPermitidos, ctx])

  const tipoAtual = useMemo(
    () => tiposPermitidos.find((t) => t.id === estado?.tipoPlanoId) ?? null,
    [tiposPermitidos, estado?.tipoPlanoId],
  )
  const blocos = useMemo(() => blocosDaTela(catalogoPlano?.plano ?? tipoAtual), [catalogoPlano, tipoAtual])

  /** Nome do processo padrão do default (o default só traz o id). */
  const nomeDoProcesso = useCallback(async (processoId: string | null | undefined): Promise<string | null> => {
    if (!processoId) return null
    try {
      const { data } = await api.get('/orcamento-grafico/processos-impressao', { params: { situacao: 'todas' } })
      const lista: Array<{ id: string; nome: string }> = Array.isArray(data) ? data : data?.data ?? []
      return lista.find((p) => p.id === processoId)?.nome ?? null
    } catch {
      return null
    }
  }, [])

  // Catálogo do tipo (atividades, suportes, default) a cada troca de tipo. Plano novo aplica os
  // padrões; plano gravado só usa o catálogo para a lista de atividades e o botão Pré.
  const tipoPlanoId = estado?.tipoPlanoId ?? null
  const tokenTipo = useRef(0)
  useEffect(() => {
    const token = ++tokenTipo.current
    setCatalogoPlano(null)
    setProcessoPre(null)
    if (!tipoPlanoId || !item?.produtoGraficoId) return
    ;(async () => {
      const cp = await catalogoItem.carregarPlano(tipoPlanoId)
      if (token !== tokenTipo.current) return
      setCatalogoPlano(cp)
      const nome = await nomeDoProcesso(cp?.defaultProduto?.processoImpressaoId)
      if (token !== tokenTipo.current) return
      setProcessoPre(nome)
      if (!novo || !cp) return
      const padroes = resolverPadroesIniciais({ default: cp.defaultProduto, atividadesDoCatalogo: cp.atividades })
      const cadastro = cp.atividades as unknown as AtividadeCadastro[]
      const pre = aplicarPreMarcadas([], padroes.atividadesPreMarcadas, cadastro).acabamentosRicos
      setEstado((atual) =>
        atual && atual.tipoPlanoId === tipoPlanoId
          ? aplicarPadroesDoTipo(atual, { tipo: cp.plano, defaultProduto: cp.defaultProduto, nomeProcesso: nome, atividadesPreMarcadas: pre }, tocados.current)
          : atual,
      )
    })()
    // `catalogoItem.carregarPlano` é estável (useCallback sem dependências).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPlanoId, item?.produtoGraficoId, novo, nomeDoProcesso])

  // Atividades do tipo, com os dados completos do cadastro de acabamentos.
  const idsAtividades = useMemo(() => (catalogoPlano?.atividades ?? []).map((a) => a.id), [catalogoPlano])
  const todosAcabamentos = useTodosAcabamentos(idsAtividades)
  const atividades = useMemo<AtividadeCadastro[]>(() => {
    const porId = new Map(todosAcabamentos.acabamentos.map((a) => [a.id, a]))
    const doTipo = catalogoPlano?.atividades ?? []
    if (doTipo.length > 0) {
      return doTipo.map((a) => ({ ...(a as object), ...(porId.get(a.id) ?? {}) }) as unknown as AtividadeCadastro)
    }
    return todosAcabamentos.acabamentos as unknown as AtividadeCadastro[]
  }, [catalogoPlano, todosAcabamentos.acabamentos])

  const processos = useProcessosImpressao(true)

  // ---------------------------------------------------------------------------
  // Alterações
  // ---------------------------------------------------------------------------

  const alterar = useCallback((parcial: Partial<EstadoTelaPlano>, campos: string[]) => {
    for (const c of campos) tocados.current.add(c)
    setEstado((e) => (e ? { ...e, ...parcial } : e))
  }, [])

  const mudarBloco = useCallback((bloco: ChaveBlocoSuporte, parcial: object, campos: string[]) => {
    for (const c of campos) tocados.current.add(`${bloco}.${c}`)
    setEstado((e) => (e ? { ...e, [bloco]: { ...e[bloco], ...parcial } } : e))
  }, [])

  // ---------------------------------------------------------------------------
  // OK / Cancelar
  // ---------------------------------------------------------------------------

  const erros = useMemo(
    () => (tentouOk && estado ? validarTelaPlano(estado, blocos, plano) : {}),
    [tentouOk, estado, blocos, plano],
  )
  const ancorado = !!item?.calculoGraficoOrigemId

  const voltar = useCallback(() => routerRef.current.push(urlItem), [urlItem])

  const gravar = async () => {
    if (!estado) return
    setGravando(true)
    try {
      const base = `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos`
      if (novo) {
        const { data } = await api.post(base, montarBodyTelaPlano(estado, blocos, null, posicaoApos))
        const criado = data as { id?: string }
        if (criado?.id) registrarPlanoIncluido(itemId, criado.id)
      } else {
        await api.put(`${base}/${planoId}`, montarBodyTelaPlano(estado, blocos, plano))
      }
      notificarAlteracaoItem(orcamentoId)
      voltar()
    } catch (err) {
      // Nada muda na tela: os valores digitados continuam como estão.
      setErroAcao(`${MSG_PLANO_NAO_GRAVADO} ${mensagemErroServidor(err, 'Falha ao gravar o plano.')}`)
    } finally {
      setGravando(false)
    }
  }

  const ok = async () => {
    if (!estado || !inicial || gravando) return
    setTentouOk(true)
    const errosAgora = validarTelaPlano(estado, blocos, plano)
    if (Object.keys(errosAgora).length > 0) {
      setErroAcao(textoErrosPlano(errosAgora))
      return
    }
    setErroAcao(null)
    const mudou = novo || houveMudanca(inicial, estado)
    if (!mudou) {
      voltar()
      return
    }
    if (ancorado) {
      setConfirmarAncorado(true)
      return
    }
    await gravar()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tituloPlano = novo ? 'Novo plano' : `Plano — ${plano?.nome ?? '—'}`
  useEffect(() => {
    document.title = tituloPlano
  }, [tituloPlano])

  if (carregandoDados || (!erroCarga && !estado)) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    )
  }

  if (erroCarga || !orcamento || !estado) {
    return (
      <Center py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Plano não encontrado" data-testid="tela-plano-erro-carga">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">{erroCarga ?? 'Não foi possível carregar o plano.'}</Text>
            <Button size="xs" variant="default" onClick={voltar}>
              Voltar ao item
            </Button>
          </Stack>
        </Alert>
      </Center>
    )
  }

  const podeEditar = orcamento.status === 'RASCUNHO'
  const travado = !podeEditar || gravando
  const opcoesTipo = tiposPermitidos.map((t) => ({ value: t.id, label: t.nome }))
  if (estado.tipoPlanoId && !opcoesTipo.some((o) => o.value === estado.tipoPlanoId)) {
    opcoesTipo.unshift({ value: estado.tipoPlanoId, label: 'Tipo gravado (fora do catálogo do produto)' })
  }
  const suportesPermitidos = (catalogoPlano?.suportes ?? []).map((s) => ({ value: s.id, label: s.descricao }))

  return (
    <Stack gap="md" data-testid="tela-plano">
      <Stack gap="xs">
        <Breadcrumbs>
          <Anchor component={Link} href={`/orcamento-grafico/${orcamentoId}`} size="sm">
            Orçamento nº {orcamento.numero}
          </Anchor>
          <Anchor component={Link} href={urlItem} size="sm">
            Item
          </Anchor>
          <Text size="sm">Plano</Text>
        </Breadcrumbs>
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="indigo" size={32} radius="md">
              <IconLayoutList size={18} stroke={1.5} />
            </ThemeIcon>
            <Title order={3} data-testid="tela-plano-titulo">
              {tituloPlano}
            </Title>
          </Group>
          <Group gap="xs">
            <Button variant="default" size="sm" leftSection={<IconX size={16} />} onClick={voltar} disabled={gravando}>
              Cancelar
            </Button>
            <Button size="sm" leftSection={<IconCheck size={16} />} onClick={ok} loading={gravando} disabled={!podeEditar}>
              OK
            </Button>
          </Group>
        </Group>
      </Stack>

      {ancorado && (
        <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />} data-testid="aviso-custo-ancorado">
          {AVISO_CUSTO_ANCORADO}
        </Alert>
      )}

      {!podeEditar && (
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />} title="Edição indisponível">
          A edição de planos só é possível com o orçamento em rascunho.
        </Alert>
      )}

      {catalogoItem.erro && (
        <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="sm">{catalogoItem.erro}</Text>
            <Button size="xs" variant="default" onClick={catalogoItem.recarregar}>
              Tentar novamente
            </Button>
          </Group>
        </Alert>
      )}

      {erroAcao && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Não foi possível concluir" data-testid="tela-plano-erro">
          {erroAcao}
        </Alert>
      )}

      <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="bloco-plano">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Select
              label="Tipo de Plano"
              placeholder={opcoesTipo.length === 0 ? 'Nenhum tipo no catálogo do produto' : 'Selecione'}
              data={opcoesTipo}
              value={estado.tipoPlanoId}
              onChange={(v) => alterar({ tipoPlanoId: v }, ['tipoPlanoId'])}
              error={erros.tipoPlanoId}
              disabled={travado}
              allowDeselect={false}
              required
            />
            <TextInput
              label="Nome"
              maxLength={MAX_NOME_PLANO}
              value={estado.nome}
              onChange={(e) => alterar({ nome: e.currentTarget.value }, ['nome'])}
              error={erros.nome}
              disabled={travado}
              required
            />
            <TextInput
              label="Ocorrências"
              description="De 1 a 99"
              inputMode="numeric"
              value={estado.ocorrencias}
              onChange={(e) => alterar({ ocorrencias: e.currentTarget.value }, ['ocorrencias'])}
              error={erros.ocorrencias}
              disabled={travado}
            />
            <TextInput
              label="Tiragem"
              description={estado.tiragemPropria ? 'Tiragem própria do plano' : 'Padrão: a tiragem do item'}
              inputMode="numeric"
              value={estado.tiragem}
              onChange={(e) => alterar({ tiragem: e.currentTarget.value, tiragemPropria: true }, ['tiragem'])}
              error={erros.tiragem}
              disabled={travado}
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <TextInput
              label="Montagem"
              placeholder="Ex.: 2x2"
              maxLength={MAX_TEXTO_CURTO}
              value={estado.montagem}
              onChange={(e) => alterar({ montagem: e.currentTarget.value }, ['montagem'])}
              disabled={travado}
            />
            <TextInput
              label="Corte"
              placeholder="Ex.: 650 x 1225"
              maxLength={MAX_TEXTO_CURTO}
              value={estado.corte}
              onChange={(e) => alterar({ corte: e.currentTarget.value }, ['corte'])}
              disabled={travado}
            />
            <TextInput
              label="Formato Aberto — largura (mm)"
              inputMode="decimal"
              placeholder="0,00"
              value={estado.formatoAberto.largura}
              onChange={(e) => alterar({ formatoAberto: { ...estado.formatoAberto, largura: e.currentTarget.value } }, ['formatoAberto'])}
              error={erros['formatoAberto.largura']}
              disabled={travado}
            />
            <TextInput
              label="Formato Aberto — altura (mm)"
              inputMode="decimal"
              placeholder="0,00"
              value={estado.formatoAberto.altura}
              onChange={(e) => alterar({ formatoAberto: { ...estado.formatoAberto, altura: e.currentTarget.value } }, ['formatoAberto'])}
              error={erros['formatoAberto.altura']}
              disabled={travado}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {(
              [
                ['comprimento', 'Formato Final — comprimento (mm)'],
                ['largura', 'Formato Final — largura (mm)'],
                ['altura', 'Formato Final — altura (mm)'],
                ['alturaTampa', 'Formato Final — altura da tampa (mm)'],
              ] as const
            ).map(([chave, rotulo]) => (
              <TextInput
                key={chave}
                label={rotulo}
                inputMode="decimal"
                placeholder="0,00"
                value={estado.formatoFinal[chave]}
                onChange={(e) => alterar({ formatoFinal: { ...estado.formatoFinal, [chave]: e.currentTarget.value } }, ['formatoFinal'])}
                error={erros[`formatoFinal.${chave}`]}
                disabled={travado}
              />
            ))}
          </SimpleGrid>

          <CamposImpressao
            value={estado}
            onChange={(p) => alterar(p, Object.keys(p))}
            processos={processos.nomes}
            processoPre={processoPre}
            erros={{ cores: erros.cores, processoImpressao: erros.processoImpressao, coberturaTinta: erros.coberturaTinta }}
            disabled={travado}
          />
        </Stack>
      </Paper>

      <BlocosPorTipoPlano
        blocos={blocos}
        value={estado}
        onChange={mudarBloco}
        erros={erros}
        processos={processos.nomes}
        processoPre={processoPre}
        suportesPermitidos={suportesPermitidos}
        orcamentoId={orcamentoId}
        disabled={travado}
      />

      <BlocoAcabamento
        atividades={atividades}
        value={{ acabamentosRicos: estado.acabamentosRicos }}
        onChange={(p) => alterar({ acabamentosRicos: p.acabamentosRicos ?? [] }, ['acabamentosRicos'])}
        layout={{ restricoes: catalogo?.produto.produto.exibeRestricoes === false ? 'RECOLHIDA' : 'EXPANDIDA' }}
        catalogoDoPlano={catalogoPlano}
        carregandoLista={todosAcabamentos.carregando}
        avisoLista={todosAcabamentos.erro}
        onTentarNovamente={todosAcabamentos.tentarNovamente}
        disabled={travado}
      />

      <Modal
        opened={confirmarAncorado}
        onClose={() => setConfirmarAncorado(false)}
        title="Confirmar alteração do plano"
        centered
      >
        <Stack gap="md">
          <Text size="sm" data-testid="confirmar-custo-ancorado">
            {AVISO_CUSTO_ANCORADO}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setConfirmarAncorado(false)}>
              Voltar
            </Button>
            <Button
              onClick={async () => {
                setConfirmarAncorado(false)
                await gravar()
              }}
            >
              Gravar mesmo assim
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
