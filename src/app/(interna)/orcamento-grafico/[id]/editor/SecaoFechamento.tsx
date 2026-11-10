'use client'

/**
 * SecaoFechamento — seção "Fechamento" do Editor de Item do Orçamento Gráfico
 * (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.6)
 * _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1_
 *
 * Reaproveita integralmente o sub-form `StepRevisao` (do wizard `/novo`), que já
 * mostra, a partir do consolidado existente: Tiragem, Margem, Contribuição
 * Marginal (CM), CEV, Valor Unitário e Valor Total, além da grade de faixas de
 * tiragem e da conferência foto × recálculo. O cálculo/ancoragem é do backend —
 * esta seção NÃO recalcula por conta própria nem persiste nada.
 *
 * O que esta seção ADICIONA ao sub-form (Req 7.4 / 7.5):
 *  - Um painel de PRÉ-VISUALIZAÇÃO de faixas de margem (gross-up), puramente
 *    client-side via `previewFaixaMargem` de `previa-margem.ts`, para o operador
 *    SIMULAR como ficaria o fechamento ao escolher uma margem alternativa SEM
 *    alterar o valor consolidado já gravado. A faixa "atual" é destacada; a
 *    pré-visualização é reversível (não grava) — ao fechar/alternar faixa, nada
 *    é persistido até a confirmação explícita (salvar o item pelo EditorItem).
 *
 * O título da seção fica a cargo do EditorItem (não é repetido aqui).
 */

import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Group,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { IconChartBar } from '@tabler/icons-react'

import StepRevisao from '../../novo/StepRevisao'
import type { WizardFormData } from '../../novo/page'
import { previewFaixaMargem } from './previa-margem'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /**
   * Base de custo (custo de produção/total) do consolidado já calculado, usada
   * só para a PRÉ-VISUALIZAÇÃO de margem. Opcional: quando ausente, o painel de
   * pré-visualização não aparece (o fechamento real continua via StepRevisao).
   */
  baseCusto?: number | null
  /** CEV (%) do consolidado — usado na pré-visualização de margem. */
  cevPct?: number | null
  /** Margem (%) selecionada no consolidado — destaca a faixa "atual". */
  margemAtualPct?: number | null
}

/** Faixas de margem padrão para a pré-visualização (pontos percentuais). */
const FAIXAS_MARGEM_PADRAO = [10, 15, 20, 25, 30]

function formatarMoeda(valor: number | undefined): string {
  const n = typeof valor === 'number' && Number.isFinite(valor) ? valor : 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function SecaoFechamento({
  formData,
  updateForm,
  baseCusto,
  cevPct,
  margemAtualPct,
}: Props) {
  // CEV e margem atual editáveis apenas para a PRÉ-VISUALIZAÇÃO (não persistem).
  const [cevPreview, setCevPreview] = useState<number>(
    typeof cevPct === 'number' && Number.isFinite(cevPct) ? cevPct : 0,
  )

  const base = typeof baseCusto === 'number' && Number.isFinite(baseCusto) ? baseCusto : 0
  const quantidade = formData.quantidade ?? 0

  // Faixas incluindo a margem atual (se houver), deduplicadas e ordenadas.
  const faixas = useMemo(() => {
    const todas = [...FAIXAS_MARGEM_PADRAO]
    if (typeof margemAtualPct === 'number' && Number.isFinite(margemAtualPct) && margemAtualPct > 0) {
      todas.push(Math.round(margemAtualPct * 100) / 100)
    }
    return Array.from(new Set(todas)).sort((a, b) => a - b)
  }, [margemAtualPct])

  const previas = useMemo(() => {
    if (base <= 0) return []
    return faixas.map((margemPct) => ({
      margemPct,
      atual:
        typeof margemAtualPct === 'number' &&
        Math.abs(margemPct - margemAtualPct) < 0.01,
      ...previewFaixaMargem({ base, margemPct, cevPct: cevPreview, quantidade }),
    }))
  }, [faixas, base, cevPreview, quantidade, margemAtualPct])

  return (
    <Stack gap="lg">
      {/* Fechamento real (consolidado) — reaproveita o StepRevisao existente. */}
      <StepRevisao formData={formData} updateForm={updateForm} />

      {/* Pré-visualização de faixas de margem (Req 7.4 / 7.5) — não persiste. */}
      {base > 0 && (
        <Paper withBorder p="md" radius="sm">
          <Group justify="space-between" mb="sm">
            <Group gap={8}>
              <IconChartBar size={18} />
              <Text fw={600} size="sm">
                Pré-visualização de faixas de margem
              </Text>
            </Group>
            <NumberInput
              label="CEV (%)"
              description="Simulação"
              value={cevPreview}
              onChange={(v) => setCevPreview(typeof v === 'number' ? v : 0)}
              min={0}
              max={99}
              decimalScale={2}
              w={140}
              size="xs"
            />
          </Group>

          <Alert variant="light" color="gray" mb="sm">
            <Text size="xs">
              Simulação client-side (gross-up) sobre o custo de produção
              consolidado ({formatarMoeda(base)}). Não altera o valor salvo — serve
              para comparar margens antes de confirmar.
            </Text>
          </Alert>

          <Table striped highlightOnHover withTableBorder fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Margem</Table.Th>
                <Table.Th ta="right">Valor Total</Table.Th>
                <Table.Th ta="right">Valor Unitário</Table.Th>
                <Table.Th ta="right">CM (R$)</Table.Th>
                <Table.Th ta="right">CM (%)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {previas.map((p) => (
                <Table.Tr
                  key={p.margemPct}
                  bg={p.atual ? 'var(--mantine-color-blue-light)' : undefined}
                >
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      {p.margemPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                      {p.atual && (
                        <Badge size="xs" color="blue" variant="filled">
                          atual
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {formatarMoeda(p.valorTotal)}
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {p.valorUnitario.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {p.contribuicaoMarginalValor != null
                      ? formatarMoeda(p.contribuicaoMarginalValor)
                      : '—'}
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {p.contribuicaoMarginalPerc != null
                      ? `${p.contribuicaoMarginalPerc.toLocaleString('pt-BR', {
                          maximumFractionDigits: 2,
                        })}%`
                      : '—'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  )
}
