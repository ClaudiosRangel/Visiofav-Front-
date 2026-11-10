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
  [extra: string]: unknown
}

interface Props {
  /** Planos do item a exibir (modo leitura). Vazio/ausente → seção não renderiza. */
  planos?: Array<PlanoApresentacao | unknown> | null
}

/** Texto de célula tolerante: normaliza vazio/nulo para "—". */
function celula(valor: unknown): string {
  if (valor == null) return '—'
  const texto = String(valor).trim()
  return texto.length > 0 ? texto : '—'
}

export default function SecaoPlanos({ planos }: Props) {
  // Defensivo (Req 5.2): sem planos, não renderiza nada. A ocultação da
  // seção+âncora já é decidida por `montarAncoras` no EditorItem.
  if (!planos || planos.length === 0) return null

  const linhas = planos as PlanoApresentacao[]

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
