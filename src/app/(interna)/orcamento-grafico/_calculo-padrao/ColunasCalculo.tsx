'use client'

import type { ReactNode } from 'react'
import { ScrollArea, Table, Text } from '@mantine/core'

/** Item da resposta de GET /calculo-grafico?modo=SELETOR. */
export interface ResumoCalculo {
  id: string
  numero: number | null
  clienteNome: string | null
  clienteCodigo: string | null
  produto: string | null
  descricao: string | null
  linhaProduto: string | null
  siglaAcabado: string | null
  tiragem: number | null
  formatoFinal: string | null
  cancelado: boolean
}

export interface RespostaBuscaCalculo {
  itens: ResumoCalculo[]
  total: number
  quantidadeCalculos: number
  limitado: boolean
}

export interface ColunaCalculo {
  chave: string
  rotulo: string
  render: (c: ResumoCalculo) => ReactNode
  alinharDireita?: boolean
}

const vazio = (v: string | null | undefined) => (v && v.trim() ? v : '—')

/** Colunas da grade de cálculos (Seletor, Menu e Listagem). */
export const COLUNAS_CALCULO: ColunaCalculo[] = [
  { chave: 'cliente', rotulo: 'Cliente', render: (c) => vazio(c.clienteNome) },
  { chave: 'linha', rotulo: 'Linha', render: (c) => vazio(c.linhaProduto) },
  { chave: 'produto', rotulo: 'Produto', render: (c) => vazio(c.produto) },
  { chave: 'descricao', rotulo: 'Descrição', render: (c) => vazio(c.descricao) },
  { chave: 'formato', rotulo: 'Formato Final', render: (c) => vazio(c.formatoFinal) },
  { chave: 'sigla', rotulo: 'Cód. Cálculo Acabado', render: (c) => vazio(c.siglaAcabado) },
  {
    chave: 'tiragem',
    rotulo: 'Tiragem',
    alinharDireita: true,
    render: (c) => (c.tiragem != null ? c.tiragem.toLocaleString('pt-BR') : '—'),
  },
  {
    chave: 'numero',
    rotulo: 'Nº Cálculo',
    alinharDireita: true,
    render: (c) => (c.numero != null ? String(c.numero) : '—'),
  },
]

interface GradeCalculosProps {
  itens: ResumoCalculo[]
  selecionadoId: string | null
  onSelecionar: (c: ResumoCalculo) => void
  onAbrir?: (c: ResumoCalculo) => void
  mensagemVazia?: string
}

export default function GradeCalculos({
  itens,
  selecionadoId,
  onSelecionar,
  onAbrir,
  mensagemVazia = 'Nenhum cálculo encontrado',
}: GradeCalculosProps) {
  return (
    <ScrollArea h={320}>
      <Table highlightOnHover withTableBorder stickyHeader>
        <Table.Thead>
          <Table.Tr>
            {COLUNAS_CALCULO.map((col) => (
              <Table.Th key={col.chave} ta={col.alinharDireita ? 'right' : undefined}>
                {col.rotulo}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {itens.map((c) => (
            <Table.Tr
              key={c.id}
              onClick={() => onSelecionar(c)}
              onDoubleClick={() => onAbrir?.(c)}
              bg={c.id === selecionadoId ? 'var(--mantine-primary-color-light)' : undefined}
              style={{ cursor: 'pointer' }}
            >
              {COLUNAS_CALCULO.map((col) => (
                <Table.Td key={col.chave} ta={col.alinharDireita ? 'right' : undefined}>
                  {col.render(c)}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
          {itens.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={COLUNAS_CALCULO.length}>
                <Text ta="center" c="dimmed" py="md">
                  {mensagemVazia}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
