'use client'

/**
 * SecaoMateriaisAcabamento — seção "Materiais de Acabamento" do Editor de Item
 * do Orçamento Gráfico (experiência Calcgraf).
 *
 * Exibe o bloco "Materiais de acabamento (computar no custo)" do `StepAcabamentos`
 * (via `mostrar="materiais"`, lista manual intacta) e, acima dele, as linhas de
 * material escolhidas por atividade (origem `SELECAO`) somente para leitura, com o
 * nome da atividade (Fase 2, tarefa 4.8). Quem altera essas escolhas é a seção
 * Acabamentos.
 *
 * Componente de APRESENTAÇÃO: sem lógica de cálculo/toggle/patch própria. O
 * título da seção fica a cargo do `EditorItem` (não é repetido aqui).
 */

import { useMemo } from 'react'
import { Badge, Group, Paper, Stack, Table, Text } from '@mantine/core'

import type { WizardFormData } from '../../novo/page'
import StepAcabamentos, { type AcabamentoCadastro } from '../../novo/StepAcabamentos'
import type { CatalogoDoItem } from './catalogo/catalogo.types'
import type { ControleSelecao } from './catalogo/useSelecaoMaterial'
import type { AcabamentoCarregado } from './useTodosAcabamentos'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /** Catálogo do produto do item (null = sem produto). Dá o nome da atividade de cada linha. */
  catalogo?: CatalogoDoItem | null
  /** Seleções gravadas do item (ligam a linha à atividade). */
  selecao?: ControleSelecao
  /** Lista de acabamentos já carregada pelo editor (evita uma segunda carga no StepAcabamentos). */
  acabamentosExternos?: ReadonlyArray<AcabamentoCarregado> | null
}

const moeda = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SecaoMateriaisAcabamento({ formData, updateForm, catalogo, selecao, acabamentosExternos }: Props) {
  const linhasSelecao = (formData.materiaisAcabamento ?? []).filter((l) => l.origem === 'SELECAO')

  // atividade (nome) por id de seleção: seleção → acabamentoId → nome no catálogo.
  const nomeAtividadePorSelecao = useMemo(() => {
    const nomesAtividade = new Map<string, string>()
    const fontes = [
      ...(catalogo?.planoFixo?.atividades ?? []),
      ...(catalogo?.produto.atividades ?? []),
      ...(catalogo?.produto.acondicionamento ?? []),
    ]
    for (const a of fontes) if (!nomesAtividade.has(a.id)) nomesAtividade.set(a.id, a.nome)
    const mapa = new Map<string, string>()
    for (const s of selecao?.selecoes ?? []) {
      const nome = nomesAtividade.get(s.acabamentoId)
      if (nome) mapa.set(s.id, nome)
    }
    return mapa
  }, [catalogo, selecao?.selecoes])

  return (
    <Stack gap="md">
      {linhasSelecao.length > 0 && (
        <Paper withBorder p="sm">
          <Group gap="xs" mb={6}>
            <Text fw={600} size="sm">Materiais escolhidos por atividade</Text>
            <Badge size="xs" variant="light" color="gray">Somente leitura</Badge>
          </Group>
          <Text size="xs" c="dimmed" mb="xs">
            Para alterar, use a seção Acabamentos (material da atividade).
          </Text>
          <Table withRowBorders fz="xs" verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Atividade</Table.Th>
                <Table.Th>Material</Table.Th>
                <Table.Th ta="right">Qtd.</Table.Th>
                <Table.Th ta="right">Valor unit.</Table.Th>
                <Table.Th ta="right">Subtotal</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {linhasSelecao.map((l, i) => (
                <Table.Tr key={l.selecaoId ?? i}>
                  <Table.Td>{(l.selecaoId && nomeAtividadePorSelecao.get(l.selecaoId)) || 'Atividade'}</Table.Td>
                  <Table.Td>{l.nome ?? 'Material'}</Table.Td>
                  <Table.Td ta="right">
                    {(Number(l.quantidade) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </Table.Td>
                  <Table.Td ta="right">{moeda(l.valorUnitario)}</Table.Td>
                  <Table.Td ta="right">{moeda((Number(l.valorUnitario) || 0) * (Number(l.quantidade) || 0))}</Table.Td>
                  <Table.Td>
                    {!l.computarCusto && (
                      <Badge size="xs" variant="light" color="gray">Não altera o preço</Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <StepAcabamentos
        formData={formData}
        updateForm={updateForm}
        mostrar="materiais"
        acabamentosExternos={acabamentosExternos as unknown as ReadonlyArray<AcabamentoCadastro> | null | undefined}
      />
    </Stack>
  )
}
