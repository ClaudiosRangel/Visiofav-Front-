'use client'

/**
 * SecaoPlanos — seção "Tipos de Plano" do Editor de Item do Orçamento Gráfico
 * (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.4)
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1_
 *
 * Responsabilidade: exibir os PLANOS (tipos de plano) de um item do orçamento em
 * modo APRESENTAÇÃO/leitura, com as colunas em terminologia Calcgraf —
 * Nome, Suporte, Cores, Formato e Acabamento. NÃO recalcula nada implicitamente
 * (Req 5.4): apenas renderiza os planos recebidos por prop.
 *
 * Investigação (task): o componente existente `PlanosDoItem` é um EDITOR
 * completo (modais, chamadas de API, troca de suporte de produção, histórico) e
 * usa um shape próprio (`PlanoCalculo`: formatoLarguraMm/custoSuporte/…). Não
 * cabe aqui — esta seção é só leitura e recebe um shape TOLERANTE por prop.
 * Logo, montamos uma tabela Mantine simples a partir dos planos.
 *
 * Visibilidade (Req 5.2): a ocultação da seção + âncora "Planos" em item de
 * plano único é decidida por `montarAncoras` no EditorItem (a âncora só existe
 * quando há ≥ 1 plano). Aqui, de forma DEFENSIVA, retornamos `null` quando não
 * há planos — assim a seção nunca aparece vazia mesmo que seja renderizada por
 * engano.
 */

import { Paper, Stack, Table, Text, ScrollArea } from '@mantine/core'

import type { CatalogoDoItem } from './catalogo/catalogo.types'
import type { UseCatalogoItemResultado } from './catalogo/useCatalogoItem'

/**
 * Shape tolerante de um plano recebido por prop. Todos os campos são opcionais
 * (dados vêm do `GET /:id` do orçamento, que pode variar), e aceitamos campos
 * extras (`any`) para não quebrar com variações da origem.
 */
export interface PlanoApresentacao {
  nome?: string | null
  suporte?: string | null
  cores?: string | null
  formato?: string | null
  acabamento?: string | null
  /** Fase 2 — tipo de plano do catálogo (ausente/null = plano sem tipo). */
  tipoPlanoId?: string | null
  [extra: string]: unknown
}

interface Props {
  /** Planos do item a exibir (modo leitura). Vazio/ausente → seção não renderiza. */
  planos?: Array<PlanoApresentacao | unknown> | null
  /** Catálogo do produto do item (null = sem produto). Usado na tarefa 4.10 (coluna "Tipo de plano"). */
  catalogo?: CatalogoDoItem | null
  /**
   * Fase 3 (14.6) — instância ÚNICA de `useCatalogoItem` do editor. É a que o `PlanosDoItem`
   * recebe em `catalogoCompartilhado`, para o modal de plano não criar uma segunda consulta.
   * Hoje esta seção é só leitura e usa a instância para resolver o nome do tipo de plano.
   */
  catalogoCompartilhado?: UseCatalogoItemResultado
}

/** Texto de célula tolerante: normaliza vazio/nulo para "—". */
function celula(valor: unknown): string {
  if (valor == null) return '—'
  const texto = String(valor).trim()
  return texto.length > 0 ? texto : '—'
}

export default function SecaoPlanos({ planos, catalogo: catalogoProp, catalogoCompartilhado }: Props) {
  const catalogo = catalogoProp ?? catalogoCompartilhado?.catalogo ?? null

  // Defensivo (Req 5.2): sem planos, não renderiza nada. A ocultação da
  // seção+âncora já é decidida por `montarAncoras` no EditorItem.
  if (!planos || planos.length === 0) return null

  const linhas = planos as PlanoApresentacao[]

  // Coluna "Tipo de plano" (Req 4.6): só quando algum plano tem tipo. O nome vem do catálogo.
  const temTipo = linhas.some((p) => typeof p?.tipoPlanoId === 'string' && p.tipoPlanoId.length > 0)
  const nomeDoTipo = (id: unknown): string => {
    if (typeof id !== 'string' || !id) return '—'
    const doProduto = catalogo?.produto.planos.find((t) => t.id === id)?.nome
    return celula(doProduto ?? catalogo?.porTipoPlano[id]?.plano.nome)
  }

  return (
    <Paper withBorder p="md" radius="sm">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Tipos de plano deste item (apresentação). O custo é consolidado a partir
          dos planos; esta visão não recalcula.
        </Text>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                {temTipo && <Table.Th>Tipo de plano</Table.Th>}
                <Table.Th>Suporte</Table.Th>
                <Table.Th>Cores</Table.Th>
                <Table.Th>Formato</Table.Th>
                <Table.Th>Acabamento</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {linhas.map((plano, i) => (
                <Table.Tr key={(plano?.nome as string) ?? i}>
                  <Table.Td fw={600}>{celula(plano?.nome)}</Table.Td>
                  {temTipo && <Table.Td>{nomeDoTipo(plano?.tipoPlanoId)}</Table.Td>}
                  <Table.Td>{celula(plano?.suporte)}</Table.Td>
                  <Table.Td>{celula(plano?.cores)}</Table.Td>
                  <Table.Td>{celula(plano?.formato)}</Table.Td>
                  <Table.Td>{celula(plano?.acabamento)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Paper>
  )
}
