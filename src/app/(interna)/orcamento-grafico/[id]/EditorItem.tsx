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

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Box, Button, Grid, Group, LoadingOverlay, Paper, Stack, Title,
} from '@mantine/core'
import { IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import type { WizardFormData } from '../novo/page'
import {
  INITIAL_ITEM,
  type ItemParaEditar,
  itemParaForm,
  salvarItem,
} from './itemFormShared'
import { ANCORA_LABEL, montarAncoras, type AncoraId } from './editor/ancoras'
import { useScrollSpy } from './editor/useScrollSpy'
import IndiceAncoras from './editor/IndiceAncoras'
import SecaoProduto from './editor/SecaoProduto'
import SecaoPlanos from './editor/SecaoPlanos'
import SecaoDadosTecnicos from './editor/SecaoDadosTecnicos'
import SecaoAcabamentos from './editor/SecaoAcabamentos'
import SecaoEstruturaCusto from './editor/SecaoEstruturaCusto'
import SecaoFechamento from './editor/SecaoFechamento'

interface Props {
  /** Orçamento ao qual o item pertence. */
  orcamentoId: string
  /** Item a editar (do GET /:id → itens[]). Se ausente, edita um item novo. */
  item?: ItemParaEditar | null
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
function SecaoContainer({ id, children }: { id: AncoraId; children: React.ReactNode }) {
  return (
    <Paper id={id} withBorder p="md" style={{ scrollMarginTop: 16 }}>
      <Title order={4} mb="md">
        {ANCORA_LABEL[id]}
      </Title>
      {children}
    </Paper>
  )
}

export default function EditorItem({
  orcamentoId,
  item,
  observacoesOrcamento,
  imagemFacaOrcamento,
  imagemProdutoOrcamento,
  onSaved,
  onCancel,
}: Props) {
  const isEditing = !!item

  // Estado do form — MESMO shape/hidratação do wizard (itemFormShared).
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_ITEM)
  const [saving, setSaving] = useState(false)

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
  }, [item, orcamentoId, observacoesOrcamento, imagemFacaOrcamento, imagemProdutoOrcamento])

  // `updateForm` disponível para as seções reais (tarefas 5.x) atualizarem o form.
  const updateForm = useCallback((partial: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }))
  }, [])

  // Âncoras/seções presentes — a seção "Planos" só aparece se o item tem planos.
  const ancoras = useMemo(() => montarAncoras({ planos: item?.planos ?? null }), [item?.planos])

  const { ativa, irPara } = useScrollSpy(ancoras)

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

  // Mapeia cada âncora presente ao seu componente de seção real.
  const renderSecao = useCallback(
    (id: AncoraId) => {
      switch (id) {
        case 'produto':
          return <SecaoProduto formData={formData} updateForm={updateForm} />
        case 'planos':
          return <SecaoPlanos planos={item?.planos ?? null} />
        case 'dados-tecnicos':
          return <SecaoDadosTecnicos formData={formData} updateForm={updateForm} />
        case 'acabamentos':
          return <SecaoAcabamentos formData={formData} updateForm={updateForm} />
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
    [formData, updateForm, item?.planos, item?.resultadoCalculo, baseCusto, cevPct, margemAtualPct],
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

      <Grid gutter="md">
        {/* Índice lateral (desktop) / reempilha abaixo do conteúdo (telas menores). */}
        <Grid.Col span={{ base: 12, md: 3 }} order={{ base: 2, md: 1 }}>
          <Box style={{ position: 'sticky', top: 16 }}>
            <IndiceAncoras ancoras={ancoras} ativa={ativa} onIrPara={irPara} />
          </Box>
        </Grid.Col>

        {/* Coluna de conteúdo: seções ancoradas na ordem de `montarAncoras`. */}
        <Grid.Col span={{ base: 12, md: 9 }} order={{ base: 1, md: 2 }}>
          <Stack gap="md">
            {ancoras.map((id) => (
              <SecaoContainer key={id} id={id}>
                {renderSecao(id)}
              </SecaoContainer>
            ))}
          </Stack>
        </Grid.Col>
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
  )
}
