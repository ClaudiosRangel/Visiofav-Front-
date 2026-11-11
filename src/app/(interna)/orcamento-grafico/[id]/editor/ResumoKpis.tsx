'use client'

/**
 * ResumoKpis — barra fixa (sticky) de KPIs do item do orçamento: Custo Total,
 * Preço de Venda, Margem e Preço Unitário, atualizados em tempo real pelo
 * `useCalculoAoVivo`.
 *
 * Feature: orcamento-editor-ux-redesign (Req 3)
 */

import { Box, SimpleGrid, Paper, Text, Group, Loader } from '@mantine/core'

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

function Card({
  titulo,
  valor,
  destaque,
}: {
  titulo: string
  valor: string
  destaque?: 'preco' | 'margem' | null
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
    <Paper withBorder p="sm" style={{ borderColor, borderWidth: destaque ? 2 : 1 }}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {titulo}
      </Text>
      <Text size="xl" fw={700} c={corValor}>
        {valor}
      </Text>
    </Paper>
  )
}

export default function ResumoKpis({ kpis, loading }: Props) {
  return (
    <Box
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--mantine-color-body)',
        paddingBottom: 8,
        paddingTop: 4,
      }}
    >
      <Group justify="space-between" mb={6}>
        <Text size="sm" fw={600} c="dimmed">
          Resumo do item
        </Text>
        {loading && (
          <Group gap={6}>
            <Loader size="xs" />
            <Text size="xs" c="dimmed">
              Recalculando…
            </Text>
          </Group>
        )}
      </Group>
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Card titulo="Custo Total" valor={fmtMoeda(kpis.custoTotal)} />
        <Card titulo="Preço de Venda" valor={fmtMoeda(kpis.precoVenda)} destaque="preco" />
        <Card titulo="Margem" valor={fmtPct(kpis.margem)} destaque="margem" />
        <Card titulo="Preço Unitário" valor={fmtMoeda4(kpis.precoUnitario)} />
      </SimpleGrid>
    </Box>
  )
}
