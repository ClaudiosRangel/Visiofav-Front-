'use client'

/**
 * ResumoKpis — barra fixa (sticky) de KPIs do item do orçamento: Custo Total,
 * Preço de Venda, Margem e Preço Unitário, atualizados em tempo real pelo
 * `useCalculoAoVivo`.
 *
 * Feature: orcamento-editor-ux-redesign (Req 3)
 *
 * Barra COMPACTA de altura previsível: cada KPI é uma célula (rótulo pequeno +
 * valor) numa única faixa. Não há header separado que "suma" ao rolar — o que
 * causava o corte dos cards quando a barra ficava colada no topo.
 */

import { SimpleGrid, Paper, Text, Group, Loader } from '@mantine/core'

import type { KpisCalculo } from './useCalculoAoVivo'

interface Props {
  kpis: KpisCalculo
  loading: boolean
}

function fmtMoeda(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtMoeda4(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function Celula({
  titulo,
  valor,
  destaque,
  loading,
}: {
  titulo: string
  valor: string
  destaque?: 'preco' | 'margem' | null
  loading?: boolean
}) {
  const borderColor =
    destaque === 'preco'
      ? 'var(--mantine-color-teal-6)'
      : destaque === 'margem'
        ? 'var(--mantine-color-green-6)'
        : 'var(--mantine-color-default-border)'
  const corValor =
    destaque === 'preco'
      ? 'var(--mantine-color-teal-7)'
      : destaque === 'margem'
        ? 'var(--mantine-color-green-7)'
        : undefined
  return (
    <Paper
      withBorder
      px="sm"
      py={6}
      style={{ borderColor, borderWidth: destaque ? 2 : 1, minWidth: 0 }}
    >
      <Group gap={6} justify="space-between" wrap="nowrap">
        <Text size={10} c="dimmed" tt="uppercase" fw={700} lineClamp={1}>
          {titulo}
        </Text>
        {loading && <Loader size={10} />}
      </Group>
      <Text size="lg" fw={700} c={corValor} lineClamp={1}>
        {valor}
      </Text>
    </Paper>
  )
}

export default function ResumoKpis({ kpis, loading }: Props) {
  return (
    <SimpleGrid
      cols={{ base: 2, md: 4 }}
      spacing="xs"
      style={{
        position: 'sticky',
        // Cola no topo do corpo do modal (padding 0), logo abaixo do header.
        top: 0,
        zIndex: 20,
        background: 'var(--mantine-color-body)',
        // Padding próprio (o corpo do modal não tem padding). Cobre 100% da
        // largura, então o conteúdo que rola não aparece pelas laterais.
        paddingInline: 'var(--mantine-spacing-md)',
        paddingTop: 10,
        paddingBottom: 10,
        borderBottom: '1px solid var(--mantine-color-default-border)',
        boxShadow: 'var(--mantine-shadow-sm)',
      }}
    >
      <Celula titulo="Custo Total" valor={fmtMoeda(kpis.custoTotal)} loading={loading} />
      <Celula titulo="Preço de Venda" valor={fmtMoeda(kpis.precoVenda)} destaque="preco" loading={loading} />
      <Celula titulo="Margem" valor={fmtPct(kpis.margem)} destaque="margem" loading={loading} />
      <Celula titulo="Preço Unitário" valor={fmtMoeda4(kpis.precoUnitario)} loading={loading} />
    </SimpleGrid>
  )
}
