'use client'

/**
 * EditorItem — editor de UM item de orçamento gráfico em PÁGINA ÚNICA com
 * seções ancoradas (experiência Calcgraf), substituindo o wizard linear de
 * steps (`ItemWizardModal`, mantido como fallback).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 4.3)
 * _Requirements: 1.1, 1.5_
 *
 * Esta tarefa monta a CASCA/LAYOUT do editor e integra os helpers já prontos:
 *   - `montarAncoras(item)`  → fonte única das seções/âncoras presentes.
 *   - `useScrollSpy(ancoras)`→ âncora ativa + navegação suave (scroll-spy).
 *   - `IndiceAncoras`        → índice lateral com destaque da seção ativa + legenda.
 *   - estado/hidratação/salvar reaproveitados de `itemFormShared`
 *     (`WizardFormData`, `INITIAL_ITEM`, `itemParaForm`, `salvarItem`), para NÃO
 *     duplicar nem alterar a lógica de salvar/calcular (o cálculo/ancoragem é do
 *     backend; `salvarItem` chama `PUT /:id/itens/:itemId` ou `POST /:id/itens`).
 *
 * As SEÇÕES internas detalhadas (Produto, Planos, Dados Técnicos, Acabamentos,
 * Estrutura, Fechamento) são os componentes `Secao*` (tarefas 5.1–5.6),
 * plugados aqui por `AncoraId`. Cada seção é renderizada num container com
 * `id={ancoraId}` (necessário para o scroll-spy) e na ordem definida por
 * `montarAncoras`.
 *
 * NÃO aciona fluxo de OP (fora de escopo).
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  ActionIcon, Alert, Box, Button, Grid, Group, LoadingOverlay, Paper, Select, Stack, Text, Title, Tooltip,
} from '@mantine/core'
import {
  IconDeviceFloppy, IconX, IconCategory, IconAlertCircle,
  IconLayoutSidebarRightExpand, IconLayoutSidebarRightCollapse,
  IconCircleCheck, IconAlertTriangle,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'
import type { WizardFormData } from '../novo/page'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'
import {
  INITIAL_ITEM,
  type ItemParaEditar,
  itemParaForm,
  salvarItem,
} from './itemFormShared'
import { ANCORA_LABEL, montarAncoras, type AncoraId } from './editor/ancoras'
import { useScrollSpy } from './editor/useScrollSpy'
import { camposDaLinha, type CampoCondicional } from './editor/campos-por-linha'
import { useCalculoAoVivo } from './editor/useCalculoAoVivo'
import ResumoKpis from './editor/ResumoKpis'
import IndiceAncoras, { type StatusAncora } from './editor/IndiceAncoras'
import PainelPreview from './editor/PainelPreview'
import type { EncaixeLayout } from '../novo/EncaixeVisual'
import SecaoProduto from './editor/SecaoProduto'
import SecaoPlanos from './editor/SecaoPlanos'
import SecaoDadosTecnicos from './editor/SecaoDadosTecnicos'
import SecaoAcabamentos from './editor/SecaoAcabamentos'
import SecaoMateriaisAcabamento from './editor/SecaoMateriaisAcabamento'
import SecaoItensComplementares from './editor/SecaoItensComplementares'
import SecaoEstruturaCusto from './editor/SecaoEstruturaCusto'
import SecaoFechamento from './editor/SecaoFechamento'

interface Props {
  /** Orçamento ao qual o item pertence. */
  orcamentoId: string
  /** Item a editar (do GET /:id → itens[]). Se ausente, edita um item novo. */
  item?: ItemParaEditar | null
  /**
   * CÓDIGO da Linha de Produto do orçamento (resolvido na página de detalhe a
   * partir do `linhaProdutoId`). Decide quais campos condicionais são exibidos
   * nas seções (campos-por-linha). Ausente/null ⇒ conjunto PADRÃO (todos os
   * campos) — não-regressão para orçamentos sem linha.
   */
  linhaProdutoCodigo?: string | null
  /**
   * ID da Linha de Produto do orçamento (do cabeçalho). Alimenta o seletor fixo
   * de Linha de Produto no topo do editor (visível no novo e no editar).
   */
  linhaProdutoId?: string | null
  /**
   * Chamado quando o usuário troca a Linha de Produto no topo do editor. A
   * página persiste via PUT /:id e recarrega (atualizando o `linhaProdutoCodigo`
   * que controla os campos condicionais).
   */
  onLinhaProdutoChange?: (linhaProdutoId: string | null) => void
  /** Observações do orçamento (p/ pré-preencher a grade de tiragens na Revisão). */
  observacoesOrcamento?: string | null
  /** Imagem da faca do orçamento (dataURL) — exibida nas seções que a usam. */
  imagemFacaOrcamento?: string | null
  /** Foto do produto cadastrado (URL). */
  imagemProdutoOrcamento?: string | null
  /** Chamado após salvar com sucesso (a página recarrega o GET /:id). */
  onSaved?: () => void
  /** Chamado ao cancelar a edição. */
  onCancel?: () => void
}

/**
 * Container ancorado de uma seção — renderiza o `id={ancoraId}` (necessário para
 * o scroll-spy) + o título (rótulo Calcgraf) + o conteúdo real da seção.
 */
function SecaoContainer({
  id,
  status,
  children,
}: {
  id: AncoraId
  status?: StatusAncora
  children: React.ReactNode
}) {
  // Destaque visual por status (Req 2/4): borda vermelha sutil quando a seção
  // tem pendência de erro; ícone de status ao lado do título. Tokens adaptativos
  // (seguem o tema claro/escuro).
  const comErro = status === 'erro'
  return (
    <Paper
      id={id}
      withBorder
      p="md"
      style={{
        // Ao navegar via índice, a seção para ABAIXO da barra de KPIs fixa.
        scrollMarginTop: 84,
        borderColor: comErro ? 'var(--mantine-color-red-6)' : undefined,
        background: 'var(--mantine-color-body)',
      }}
    >
      <Group gap={8} mb="md" align="center">
        {status === 'ok' && <IconCircleCheck size={18} color="var(--mantine-color-teal-6)" />}
        {status === 'erro' && <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />}
        <Title order={4}>{ANCORA_LABEL[id]}</Title>
      </Group>
      {children}
    </Paper>
  )
}

interface LinhaProdutoOpt {
  id: string
  nome: string
  ativo: boolean
}

/**
 * Resposta do endpoint `GET /orcamento-grafico/:id/ficha-master`. A Ficha Master
 * consolida dados técnicos de origem (Produto, Rascunho, Orçamento anterior) para
 * (a) pré-preencher campos vazios do item e (b) exibir faca + arte no Preview.
 */
interface FichaMasterResp {
  origem: 'PRODUTO' | 'RASCUNHO' | 'ORCAMENTO' | 'VAZIO'
  imagemFaca: string | null
  arte: string | null
  /** Caminho relativo da API para a arte servida como binário (anexo do pedido). */
  arteUrl?: string | null
  cartao: string | null
  gramatura: string | null
  numCores: number | null
  coresDescricao: string | null
  acabamentos: string | null
  matriz: string | null
}

export default function EditorItem({
  orcamentoId,
  item,
  linhaProdutoCodigo,
  linhaProdutoId,
  onLinhaProdutoChange,
  observacoesOrcamento,
  imagemFacaOrcamento,
  imagemProdutoOrcamento,
  onSaved,
  onCancel,
}: Props) {
  const isEditing = !!item

  // Painel lateral de preview 2D — retrátil (Req 5). Começa aberto; recolher
  // mantém o estado do form intacto (só esconde a coluna de preview).
  const [previewAberto, setPreviewAberto] = useState(true)

  // Linhas de Produto ATIVAS para o seletor fixo no topo do editor.
  const [linhasProduto, setLinhasProduto] = useState<LinhaProdutoOpt[]>([])
  useEffect(() => {
    api
      .get('/orcamento-grafico/linhas-produto', { params: { situacao: 'ativa' } })
      .then(({ data }) => setLinhasProduto(Array.isArray(data) ? data : data?.data ?? []))
      .catch(() => setLinhasProduto([]))
  }, [])

  // Campos condicionais exibidos conforme a Linha de Produto do orçamento.
  // `mostrar(campo)` = true quando o campo deve ser renderizado. Ocultar NÃO
  // apaga valores do formData (só esconde o input) — trocar de linha preserva
  // os valores comuns (R2.6).
  const camposLinha = useMemo(() => camposDaLinha(linhaProdutoCodigo), [linhaProdutoCodigo])
  const mostrarCampo = useCallback(
    (campo: CampoCondicional) => camposLinha.includes(campo),
    [camposLinha],
  )

  // Estado do form — MESMO shape/hidratação do wizard (itemFormShared).
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_ITEM)
  const [saving, setSaving] = useState(false)

  // Ficha Master do orçamento (dados técnicos de origem). Carregada ao montar e
  // quando o `orcamentoId` muda. Erro tratado em silêncio (null) — o editor
  // funciona normalmente sem a ficha (ela é um bônus de pré-preenchimento/preview).
  const [fichaMaster, setFichaMaster] = useState<FichaMasterResp | null>(null)
  // Flag p/ aplicar o pré-preenchimento UMA vez por carga (não brigar com a
  // digitação do usuário nem repreencher a cada render).
  const fichaAplicadaRef = useRef(false)

  useEffect(() => {
    let cancelado = false
    fichaAplicadaRef.current = false // nova carga de ficha ⇒ permite reaplicar uma vez
    api
      .get(`/orcamento-grafico/${orcamentoId}/ficha-master`)
      .then(({ data }) => {
        if (!cancelado) setFichaMaster(data as FichaMasterResp)
      })
      .catch(() => {
        if (!cancelado) setFichaMaster(null)
      })
    return () => {
      cancelado = true
    }
  }, [orcamentoId])

  useEffect(() => {
    if (item) {
      setFormData(
        itemParaForm(item, orcamentoId, observacoesOrcamento, imagemFacaOrcamento, imagemProdutoOrcamento),
      )
    } else {
      setFormData({
        ...INITIAL_ITEM,
        _imagemFaca: imagemFacaOrcamento ?? null,
        _imagemProdutoUrl: imagemProdutoOrcamento ?? null,
      })
    }
    // O form foi re-hidratado ⇒ libera o pré-preenchimento da ficha para rodar
    // de novo sobre os novos valores.
    fichaAplicadaRef.current = false
  }, [item, orcamentoId, observacoesOrcamento, imagemFacaOrcamento, imagemProdutoOrcamento])

  // `updateForm` disponível para as seções reais (tarefas 5.x) atualizarem o form.
  const updateForm = useCallback((partial: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }))
  }, [])

  // Pré-preenchimento CONSERVADOR dos campos técnicos a partir da Ficha Master
  // (Req 3.3). Regras:
  //  - roda UMA vez por carga (fichaAplicadaRef), após a ficha carregar e o
  //    formData já ter sido hidratado (os dois efeitos acima zeram a flag);
  //  - só preenche campos que (1) EXISTEM no WizardFormData e (2) estão
  //    vazios/ausentes — NUNCA sobrescreve o que o usuário/engenharia já tem;
  //  - campos sem equivalente no form do item (coresDescricao, cartao, numCores,
  //    acabamentos, matriz) são IGNORADOS no preenchimento (podem ser usados só
  //    na exibição/preview). O objetivo central é faca/arte no preview.
  useEffect(() => {
    if (!fichaMaster || fichaAplicadaRef.current) return
    fichaAplicadaRef.current = true

    const patch: Partial<WizardFormData> = {}

    // gramatura (number): só quando atual <= 0 e a ficha traz valor numérico.
    // Aceita vírgula decimal (padrão BR) convertendo para ponto.
    if ((formData.gramatura ?? 0) <= 0 && fichaMaster.gramatura) {
      const g = parseFloat(String(fichaMaster.gramatura).replace(',', '.'))
      if (Number.isFinite(g) && g > 0) patch.gramatura = g
    }

    if (Object.keys(patch).length > 0) updateForm(patch)
  }, [fichaMaster, formData.gramatura, updateForm])

  // Recálculo ao vivo (KPIs em tempo real) — Req 3. Consome as rotas de cálculo
  // existentes (sem persistir). Semeado com o resultado persistido do item para
  // os cards não começarem vazios na edição.
  const { kpis, loading: recalculando, erros } = useCalculoAoVivo(formData, {
    orcamentoId,
    itemId: isEditing ? item!.id : null,
  })
  // Fallback inicial dos KPIs a partir do resultado já persistido (edição).
  const resultadoPersistido = (item?.resultadoCalculo ?? null) as Record<string, unknown> | null
  const kpisExibidos = {
    custoTotal: kpis.custoTotal ?? (resultadoPersistido ? Number(resultadoPersistido.custoProducao ?? resultadoPersistido.custoTotal) || null : null),
    precoVenda: kpis.precoVenda ?? (resultadoPersistido ? Number(resultadoPersistido.precoVenda) || null : null),
    margem: kpis.margem ?? (resultadoPersistido ? Number(resultadoPersistido.margemReal) || null : null),
    precoUnitario: kpis.precoUnitario ?? (resultadoPersistido ? Number(resultadoPersistido.precoUnitario) || null : null),
  }

  // Âncoras/seções presentes — a seção "Planos" só aparece se o item tem planos.
  const ancoras = useMemo(() => montarAncoras({ planos: item?.planos ?? null }), [item?.planos])

  const { ativa, irPara } = useScrollSpy(ancoras)

  // Status por seção (Req 4): mapa seção → campos essenciais ao cálculo.
  // Regra por seção: 'erro' se algum essencial está em `erros.porCampo`; senão
  // 'ok' se TODOS os essenciais estão preenchidos no formData; senão 'pendente'.
  // Seções sem campos essenciais ⇒ sempre 'ok' (leitura/informativas).
  const statusPorAncora = useMemo<Partial<Record<AncoraId, StatusAncora>>>(() => {
    const essenciaisPorSecao: Record<AncoraId, (keyof WizardFormData)[]> = {
      produto: ['tipoEmbalagemId', 'gramatura', 'precoKg'],
      planos: [],
      'dados-tecnicos': [],
      acabamentos: [],
      'materiais-acabamento': [],
      'itens-complementares': [],
      estrutura: [],
      fechamento: ['quantidade'],
    }

    // Um campo essencial está "preenchido" quando é truthy; para campos
    // numéricos (gramatura/precoKg/quantidade) exige valor > 0.
    const preenchido = (campo: keyof WizardFormData): boolean => {
      const valor = formData[campo]
      if (typeof valor === 'number') return valor > 0
      return !!valor
    }

    const resultado: Partial<Record<AncoraId, StatusAncora>> = {}
    for (const ancora of ancoras) {
      const essenciais = essenciaisPorSecao[ancora]
      if (essenciais.some((c) => erros.porCampo[c])) {
        resultado[ancora] = 'erro'
      } else if (essenciais.every((c) => preenchido(c))) {
        resultado[ancora] = 'ok'
      } else {
        resultado[ancora] = 'pendente'
      }
    }
    return resultado
  }, [ancoras, formData, erros.porCampo])

  // Base de custo / CEV / margem do consolidado já calculado (apenas leitura),
  // usados pela PRÉ-VISUALIZAÇÃO de margem da seção Fechamento (não persiste).
  const resultado = (item?.resultadoCalculo ?? null) as Record<string, unknown> | null
  const baseCusto = useMemo(() => {
    if (!resultado) return null
    const cp = Number(resultado.custoProducao)
    if (Number.isFinite(cp) && cp > 0) return cp
    const ct = Number(resultado.custoTotal)
    return Number.isFinite(ct) && ct > 0 ? ct : null
  }, [resultado])
  const cevPct = resultado && Number.isFinite(Number(resultado.cevPerc)) ? Number(resultado.cevPerc) : null
  const margemAtualPct =
    resultado && Number.isFinite(Number(resultado.margemReal)) ? Number(resultado.margemReal) : null

  // Arte para o Preview: dataURL direta (produto definitivo) OU URL do anexo do
  // pedido (rascunho da Pré-Impressão), montada com base da API + token.
  const artePreview = useMemo<string | null>(() => {
    if (fichaMaster?.arte) return fichaMaster.arte
    if (fichaMaster?.arteUrl) {
      const token = getAuthToken() || ''
      return `${API_BASE}${fichaMaster.arteUrl}?token=${token}`
    }
    return null
  }, [fichaMaster?.arte, fichaMaster?.arteUrl])

  // Layout do encaixe para o painel de preview 2D — vem de
  // `resultadoCalculo.encaixe.layout` do item (tolerante a undefined).
  const encaixeLayout = useMemo<EncaixeLayout | null>(() => {
    const encaixe = (resultado?.encaixe ?? null) as Record<string, unknown> | null
    const layout = (encaixe?.layout ?? null) as EncaixeLayout | null
    return layout && Number(layout.folhaLarguraMm) > 0 && Number(layout.folhaAlturaMm) > 0 ? layout : null
  }, [resultado])

  // Mapeia cada âncora presente ao seu componente de seção real.
  const renderSecao = useCallback(
    (id: AncoraId) => {
      switch (id) {
        case 'produto':
          return <SecaoProduto formData={formData} updateForm={updateForm} mostrarCampo={mostrarCampo} />
        case 'planos':
          return <SecaoPlanos planos={item?.planos ?? null} />
        case 'dados-tecnicos':
          return <SecaoDadosTecnicos formData={formData} updateForm={updateForm} mostrarCampo={mostrarCampo} />
        case 'acabamentos':
          return <SecaoAcabamentos formData={formData} updateForm={updateForm} />
        case 'materiais-acabamento':
          return <SecaoMateriaisAcabamento formData={formData} updateForm={updateForm} />
        case 'itens-complementares':
          return <SecaoItensComplementares formData={formData} updateForm={updateForm} />
        case 'estrutura':
          return <SecaoEstruturaCusto resultadoCalculo={item?.resultadoCalculo ?? null} />
        case 'fechamento':
          return (
            <SecaoFechamento
              formData={formData}
              updateForm={updateForm}
              baseCusto={baseCusto}
              cevPct={cevPct}
              margemAtualPct={margemAtualPct}
            />
          )
        default:
          return null
      }
    },
    [formData, updateForm, item?.planos, item?.resultadoCalculo, baseCusto, cevPct, margemAtualPct, mostrarCampo],
  )

  const salvar = async () => {
    setSaving(true)
    try {
      await salvarItem(orcamentoId, formData, isEditing ? item!.id : null)
      notifications.show(
        isEditing
          ? { title: 'Item atualizado', message: 'Item recalculado e salvo.', color: 'green' }
          : { title: 'Item adicionado', message: 'Novo item calculado e salvo.', color: 'green' },
      )
      onSaved?.()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao salvar item',
        message: err?.response?.data?.message || 'Falha ao salvar o item do orçamento.',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box pos="relative">
      <LoadingOverlay visible={saving} />

      {/* Sticky Summary Bar — KPIs em tempo real (Req 3). Fica colada no topo do
          corpo do modal (que tem padding 0), logo abaixo do header do modal — sem
          padding acima que cortasse os cards ao rolar. */}
      <ResumoKpis kpis={kpisExibidos} loading={recalculando} />

      {/* Conteúdo com padding próprio (o body do modal está com padding 0). */}
      <Box p="md">

      {/* Resumo amigável de pendências (Req 1) — sem texto técnico de validação. */}
      {(erros.geral || Object.keys(erros.porCampo).length > 0) && (
        <Alert
          variant="light"
          color="orange"
          icon={<IconAlertCircle size={18} />}
          title="Complete os dados do item"
          mb="md"
        >
          {erros.geral && <Text size="sm" mb={Object.keys(erros.porCampo).length ? 'xs' : 0}>{erros.geral}</Text>}
          {Object.keys(erros.porCampo).length > 0 && (
            <Stack gap={2}>
              {Object.entries(erros.porCampo).map(([campo, msg]) => (
                <Text key={campo} size="sm">• {msg}</Text>
              ))}
            </Stack>
          )}
        </Alert>
      )}

      {/* Linha de Produto — sempre visível no topo (novo e editar). Trocar
          persiste no cabeçalho do orçamento (via onLinhaProdutoChange → PUT /:id)
          e atualiza os campos condicionais exibidos nas seções. */}
      <Paper withBorder p="md" mb="md">
        <Group gap="sm" mb="xs">
          <IconCategory size={18} />
          <Text fw={600}>Linha de Produto</Text>
        </Group>
        <Select
          placeholder="Selecione a linha de produto (opcional)..."
          searchable
          clearable
          data={linhasProduto.map((l) => ({ value: l.id, label: l.nome }))}
          value={linhaProdutoId ?? null}
          onChange={(v) => onLinhaProdutoChange?.(v)}
          comboboxProps={{ withinPortal: true }}
          maw={420}
        />
        <Text size="xs" c="dimmed" mt={6}>
          Define quais campos técnicos aparecem abaixo. Pode ser alterada a
          qualquer momento sem perder o que já foi preenchido.
        </Text>
      </Paper>

      <Grid gutter="md">
        {/* Índice lateral (desktop) / reempilha abaixo do conteúdo (telas menores).
            `top` maior que 16 para o índice fixar ABAIXO da barra de KPIs (que é
            sticky no topo), sem ficar escondido atrás dela ao rolar. */}
        <Grid.Col span={{ base: 12, md: 3 }} order={{ base: 2, md: 1 }}>
          <Box style={{ position: 'sticky', top: 76 }}>
            <IndiceAncoras
              ancoras={ancoras}
              ativa={ativa}
              onIrPara={irPara}
              statusPorAncora={statusPorAncora}
            />
          </Box>
        </Grid.Col>

        {/* Coluna de conteúdo: seções ancoradas na ordem de `montarAncoras`.
            Estreita (md=6) quando o painel de preview está aberto; larga (md=9)
            quando recolhido, para o form não perder espaço. */}
        <Grid.Col
          span={{ base: 12, md: previewAberto ? 6 : 9 }}
          order={{ base: 1, md: 2 }}
        >
          <Stack gap="md">
            {/* Barra com o toggle do painel de preview (Req 5.2). Recolhido,
                mostra só o botão de expandir; aberto, o de recolher. */}
            <Group justify="flex-end">
              <Tooltip label={previewAberto ? 'Recolher preview' : 'Mostrar preview'}>
                <ActionIcon
                  variant="light"
                  aria-label={previewAberto ? 'Recolher preview' : 'Mostrar preview'}
                  onClick={() => setPreviewAberto((v) => !v)}
                >
                  {previewAberto ? (
                    <IconLayoutSidebarRightCollapse size={18} />
                  ) : (
                    <IconLayoutSidebarRightExpand size={18} />
                  )}
                </ActionIcon>
              </Tooltip>
            </Group>
            {ancoras.map((id) => (
              <SecaoContainer key={id} id={id} status={statusPorAncora[id]}>
                {renderSecao(id)}
              </SecaoContainer>
            ))}
          </Stack>
        </Grid.Col>

        {/* Painel lateral RETRÁTIL de preview 2D (Req 5). Só ocupa coluna no
            desktop quando aberto; recolher preserva o estado do form. */}
        {previewAberto && (
          <Grid.Col span={{ base: 12, md: 3 }} order={{ base: 3, md: 3 }}>
            <Box style={{ position: 'sticky', top: 76 }}>
              <PainelPreview
                imagemFaca={fichaMaster?.imagemFaca ?? formData._imagemFaca}
                imagemProduto={formData._imagemProdutoUrl}
                arte={artePreview}
                encaixeLayout={encaixeLayout}
              />
            </Box>
          </Grid.Col>
        )}
      </Grid>

      {/* Rodapé de ações — Cancelar / Salvar Item (reaproveita `salvar()`). */}
      <Group justify="flex-end" mt="lg" pb="md">
        <Button variant="subtle" leftSection={<IconX size={16} />} onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={salvar} loading={saving}>
          {isEditing ? 'Salvar Item' : 'Adicionar Item'}
        </Button>
      </Group>

      </Box>
    </Box>
  )
}
