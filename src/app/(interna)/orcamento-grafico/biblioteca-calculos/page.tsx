'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  TextInput, Paper, ScrollArea, Pagination, NumberInput, Modal, Alert,
  SimpleGrid, Divider, Select,
} from '@mantine/core'
import { IconSearch, IconAlertTriangle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos — espelham GET /calculo-grafico
// ============================================================================

interface ResumoCalculo {
  id: string
  numero: number | null
  numeroCalcgraf: number | null
  clienteNome: string | null
  produto: string | null
  descricao: string | null
  linhaProduto: string | null
  siglaAcabado: string | null
  dataCalculo: string | null
  origem: string | null
}

interface RespostaBusca {
  itens: ResumoCalculo[]
  total: number
  pagina: number
  tamanho: number
}

// Cor de um cálculo (foto da engenharia). Todos os campos são tolerantes.
interface CorCalculo {
  nome?: string | null
  tipo?: string | null
  coberturaPercent?: number | string | null
  precoKg?: number | string | null
  rendimentoM2Kg?: number | string | null
}

// Acabamento (foto). Pelo menos `nome`.
interface AcabamentoCalculo {
  nome?: string | null
  [key: string]: unknown
}

// ----------------------------------------------------------------------------
// Foto rica (versaoFoto === 2) — espelha o pré-cálculo do Calcgraf.
// Todos os campos são tolerantes (opcionais / null) para resiliência.
// ----------------------------------------------------------------------------
type Numerico = number | string | null | undefined

interface FotoCabecalho {
  numeroCalcgraf?: Numerico
  cliente?: string | null
  linhaProduto?: string | null
  produto?: string | null
  descricao?: string | null
  siglaAcabado?: string | null
  formatoFinal?: string | null
  tiragem?: Numerico
  tributacao?: string | null
  dataCalculo?: string | null
}

interface FotoPlano {
  nome?: string | null
  suporte?: string | null
  gramatura?: Numerico
  coresFV?: string | null
  formatoAberto?: string | null
  formatoCorte?: string | null
  aproveitamento?: Numerico
  ocorrencias?: Numerico
  tiragem?: Numerico
  micro?: boolean | null
}

interface FotoSuporte {
  nome?: string | null
  formato?: string | null
  folhas?: Numerico
  quantidade?: Numerico
  unidade?: string | null
  precoUnitario?: Numerico
  subtotal?: Numerico
}

interface FotoMatriz {
  descricao?: string | null
  quantidade?: Numerico
  precoUnitario?: Numerico
  subtotal?: Numerico
}

interface FotoTinta {
  nome?: string | null
  coberturaPercent?: Numerico
  quantidadeKg?: Numerico
  precoUnitario?: Numerico
  subtotal?: Numerico
}

interface FotoMatAcabamento {
  nome?: string | null
  quantidade?: Numerico
  unidade?: string | null
  precoUnitario?: Numerico
  subtotal?: Numerico
}

interface FotoImpressao {
  descricao?: string | null
  cores?: Numerico
  horas?: Numerico
  producaoHora?: Numerico
  precoUnitario?: Numerico
  subtotal?: Numerico
}

interface FotoAcabamentoLinha {
  descricao?: string | null
  centro?: string | null
  horas?: Numerico
  producaoHora?: Numerico
  precoUnitario?: Numerico
  subtotal?: Numerico
}

interface FotoItemDiverso {
  descricao?: string | null
  valor?: Numerico
}

interface FotoCustos {
  materialDireto?: Numerico
  custoTransformacao?: Numerico
  servicoExterno?: Numerico
  custoProducao?: Numerico
  creditoIcms?: Numerico
  creditoIpi?: Numerico
  custoFinanceiro?: Numerico
  total?: Numerico
}

interface FotoCev {
  icms?: Numerico
  juros?: Numerico
  pisCofins?: Numerico
  comissoes?: Numerico
  totalPercent?: Numerico
}

interface FotoMargem {
  margemPercent?: Numerico
  cmPercent?: Numerico
  valorUnitario?: Numerico
  valorTotal?: Numerico
  selecionada?: boolean | null
}

interface FotoRica {
  versaoFoto: number
  origem?: string | null
  cabecalho?: FotoCabecalho | null
  planos?: FotoPlano[] | null
  suportes?: FotoSuporte[] | null
  matriz?: FotoMatriz | null
  tintas?: FotoTinta[] | null
  matAcabamento?: FotoMatAcabamento[] | null
  impressao?: FotoImpressao[] | null
  acabamentos?: FotoAcabamentoLinha[] | null
  itensDiversos?: FotoItemDiverso[] | null
  custos?: FotoCustos | null
  cev?: FotoCev | null
  margens?: FotoMargem[] | null
}

// Detalhe (foto) do cálculo — campos usados no modal "Abrir".
// Espelha o registro completo retornado por GET /calculo-grafico/:id.
interface CalculoDetalhe {
  id: string
  numero?: number | null
  numeroCalcgraf?: number | null
  clienteNome?: string | null
  produto?: string | null
  descricao?: string | null
  linhaProduto?: string | null
  siglaAcabado?: string | null
  origem?: string | null
  quantidade?: number | string | null
  gramatura?: number | string | null
  numCores?: number | string | null
  cores?: CorCalculo[] | null
  acabamentosRicos?: AcabamentoCalculo[] | null
  matrizQuantidade?: number | string | null
  aproveitamentoManual?: number | string | null
  montagemLinhas?: number | string | null
  montagemColunas?: number | string | null
  formatoCorteLarguraMm?: number | string | null
  formatoCorteAlturaMm?: number | string | null
  custoProducao?: number | string | null
  valorTotal?: number | string | null
  dataCalculo?: string | null
  tipoEmbalagemId?: string | null
  // Foto rica (versaoFoto === 2) ou foto antiga/ausente.
  resultadoCalculo?: FotoRica | null | any
}

// Orçamento em rascunho (destino para "Usar em orçamento").
interface OrcamentoRascunho {
  id: string
  numero: number | null
  versao?: number | null
  clienteNome?: string | null
}

const TAMANHO = 20

// ============================================================================
// Formatadores
// ============================================================================

function formatarData(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function formatCurrency(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function rotuloCalcgraf(n: number | null | undefined): string {
  return n != null ? `Calcgraf ${n}` : '—'
}

// Converte valor (número ou string) para número finito, ou null.
function toNum(val: number | string | null | undefined): number | null {
  if (val == null) return null
  const num = typeof val === 'string' ? parseFloat(val) : val
  return Number.isFinite(num) ? num : null
}

// Formata número com separador pt-BR; "—" quando ausente.
function formatNum(val: number | string | null | undefined, maxDecimals = 0): string {
  const num = toNum(val)
  if (num == null) return '—'
  return num.toLocaleString('pt-BR', { maximumFractionDigits: maxDecimals })
}

// Rótulo de uma cor: "Escala — CMYK — 80%".
function rotuloCor(cor: CorCalculo): string {
  const partes: string[] = []
  if (cor.nome && String(cor.nome).trim()) partes.push(String(cor.nome).trim())
  if (cor.tipo && String(cor.tipo).trim()) partes.push(String(cor.tipo).trim())
  const cob = toNum(cor.coberturaPercent)
  if (cob != null) partes.push(`${cob.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
  return partes.length ? partes.join(' — ') : '—'
}

function BadgeOrigem({ origem }: { origem: string | null | undefined }) {
  if (origem === 'MIGRADO_CALCGRAF') return <Badge color="gray">Calcgraf</Badge>
  if (origem === 'VIZOR') return <Badge color="blue">Vizor</Badge>
  return <Badge color="gray" variant="light">—</Badge>
}

// Texto simples com fallback "—".
function texto(val: string | null | undefined): string {
  return val && String(val).trim() ? String(val).trim() : '—'
}

// ============================================================================
// Foto rica (versaoFoto === 2) — renderização completa, espelho do Calcgraf
// ============================================================================

function FotoRicaView({ foto }: { foto: FotoRica }) {
  const cab = foto.cabecalho || {}
  const planos = Array.isArray(foto.planos) ? foto.planos : []
  const suportes = Array.isArray(foto.suportes) ? foto.suportes : []
  const matriz = foto.matriz || null
  const tintas = Array.isArray(foto.tintas) ? foto.tintas : []
  const matAcabamento = Array.isArray(foto.matAcabamento) ? foto.matAcabamento : []
  const impressao = Array.isArray(foto.impressao) ? foto.impressao : []
  const acabamentos = Array.isArray(foto.acabamentos) ? foto.acabamentos : []
  const itensDiversos = Array.isArray(foto.itensDiversos) ? foto.itensDiversos : []
  const custos = foto.custos || {}
  const cev = foto.cev || null
  const margens = Array.isArray(foto.margens) ? foto.margens : []

  return (
    <Stack gap="md">
      {/* Cabeçalho da foto */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Text size="sm"><strong>Nº Calcgraf:</strong> {formatNum(cab.numeroCalcgraf)}</Text>
        <Text size="sm"><strong>Tiragem:</strong> {formatNum(cab.tiragem)}</Text>
        <Text size="sm"><strong>Cliente:</strong> {texto(cab.cliente)}</Text>
        <Text size="sm"><strong>Linha de Produto:</strong> {texto(cab.linhaProduto)}</Text>
        <Text size="sm"><strong>Produto:</strong> {texto(cab.produto)}</Text>
        <Text size="sm"><strong>Sigla do Acabado:</strong> {texto(cab.siglaAcabado)}</Text>
        {cab.formatoFinal != null && (
          <Text size="sm"><strong>Formato Final:</strong> {texto(cab.formatoFinal)}</Text>
        )}
        {cab.tributacao != null && (
          <Text size="sm"><strong>Tributação:</strong> {texto(cab.tributacao)}</Text>
        )}
        {cab.dataCalculo != null && (
          <Text size="sm"><strong>Data do Cálculo:</strong> {formatarData(cab.dataCalculo)}</Text>
        )}
        <Text size="sm" style={{ gridColumn: '1 / -1' }}>
          <strong>Descrição:</strong> {texto(cab.descricao)}
        </Text>
      </SimpleGrid>

      {/* Planos */}
      {planos.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Planos</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Suporte</Table.Th>
                  <Table.Th ta="right">Gramatura</Table.Th>
                  <Table.Th>Formato Aberto</Table.Th>
                  <Table.Th>Formato Corte</Table.Th>
                  <Table.Th ta="right">Aprov.</Table.Th>
                  <Table.Th ta="right">Tiragem</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {planos.map((p, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <span>{texto(p.nome)}</span>
                        {p.micro === true && <Badge size="xs" color="orange" variant="light">Micro</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{texto(p.suporte)}</Table.Td>
                    <Table.Td ta="right">{formatNum(p.gramatura, 1)}</Table.Td>
                    <Table.Td>{texto(p.formatoAberto)}</Table.Td>
                    <Table.Td>{texto(p.formatoCorte)}</Table.Td>
                    <Table.Td ta="right">{formatNum(p.aproveitamento)}</Table.Td>
                    <Table.Td ta="right">{formatNum(p.tiragem)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Suportes */}
      {suportes.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Suportes</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Formato</Table.Th>
                  <Table.Th ta="right">Qtd</Table.Th>
                  <Table.Th>Unid</Table.Th>
                  <Table.Th ta="right">Preço Unit</Table.Th>
                  <Table.Th ta="right">Subtotal</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {suportes.map((s, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{texto(s.nome)}</Table.Td>
                    <Table.Td>{texto(s.formato)}</Table.Td>
                    <Table.Td ta="right">{formatNum(s.quantidade ?? s.folhas, 2)}</Table.Td>
                    <Table.Td>{texto(s.unidade)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(s.precoUnitario)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(s.subtotal)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Matriz */}
      {matriz && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Matriz</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th ta="right">Qtd</Table.Th>
                  <Table.Th ta="right">Preço Unit</Table.Th>
                  <Table.Th ta="right">Subtotal</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>{texto(matriz.descricao)}</Table.Td>
                  <Table.Td ta="right">{formatNum(matriz.quantidade, 2)}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(matriz.precoUnitario)}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(matriz.subtotal)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Tintas */}
      {tintas.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Tintas</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th ta="right">Cobertura %</Table.Th>
                  <Table.Th ta="right">Qtd (kg)</Table.Th>
                  <Table.Th ta="right">Preço</Table.Th>
                  <Table.Th ta="right">Subtotal</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tintas.map((t, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{texto(t.nome)}</Table.Td>
                    <Table.Td ta="right">{formatNum(t.coberturaPercent, 1)}</Table.Td>
                    <Table.Td ta="right">{formatNum(t.quantidadeKg, 3)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(t.precoUnitario)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(t.subtotal)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Materiais de Acabamento */}
      {matAcabamento.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Materiais de Acabamento</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th ta="right">Qtd</Table.Th>
                  <Table.Th>Unid</Table.Th>
                  <Table.Th ta="right">Preço</Table.Th>
                  <Table.Th ta="right">Subtotal</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {matAcabamento.map((m, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{texto(m.nome)}</Table.Td>
                    <Table.Td ta="right">{formatNum(m.quantidade, 2)}</Table.Td>
                    <Table.Td>{texto(m.unidade)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(m.precoUnitario)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(m.subtotal)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Impressão */}
      {impressao.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Impressão</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th ta="right">Cores</Table.Th>
                  <Table.Th ta="right">Horas</Table.Th>
                  <Table.Th ta="right">Prod/h</Table.Th>
                  <Table.Th ta="right">Custo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {impressao.map((im, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{texto(im.descricao)}</Table.Td>
                    <Table.Td ta="right">{formatNum(im.cores)}</Table.Td>
                    <Table.Td ta="right">{formatNum(im.horas, 2)}</Table.Td>
                    <Table.Td ta="right">{formatNum(im.producaoHora, 2)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(im.subtotal ?? im.precoUnitario)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Acabamentos */}
      {acabamentos.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Acabamentos</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th>Centro</Table.Th>
                  <Table.Th ta="right">Horas</Table.Th>
                  <Table.Th ta="right">Prod/h</Table.Th>
                  <Table.Th ta="right">Custo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {acabamentos.map((ac, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{texto(ac.descricao)}</Table.Td>
                    <Table.Td>{texto(ac.centro)}</Table.Td>
                    <Table.Td ta="right">{formatNum(ac.horas, 2)}</Table.Td>
                    <Table.Td ta="right">{formatNum(ac.producaoHora, 2)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(ac.subtotal ?? ac.precoUnitario)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Itens Diversos */}
      {itensDiversos.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Itens Diversos</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th ta="right">Valor</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {itensDiversos.map((it, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{texto(it.descricao)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(it.valor)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Custo de Produção */}
      <Paper p="sm" withBorder bg="var(--mantine-color-blue-light)">
        <Text size="sm" fw={700} mb="xs">Custo de Produção</Text>
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="sm">Material Direto</Text>
            <Text size="sm">{formatCurrency(custos.materialDireto)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Custo de Transformação</Text>
            <Text size="sm">{formatCurrency(custos.custoTransformacao)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Serviço Externo</Text>
            <Text size="sm">{formatCurrency(custos.servicoExterno)}</Text>
          </Group>
          <Divider my={4} />
          <Group justify="space-between">
            <Text size="sm" fw={700}>Custo de Produção</Text>
            <Text size="sm" fw={700} c="red">{formatCurrency(custos.custoProducao)}</Text>
          </Group>
          {custos.creditoIpi != null && (
            <Group justify="space-between">
              <Text size="sm">Crédito IPI</Text>
              <Text size="sm">{formatCurrency(custos.creditoIpi)}</Text>
            </Group>
          )}
          {custos.creditoIcms != null && (
            <Group justify="space-between">
              <Text size="sm">Crédito ICMS</Text>
              <Text size="sm">{formatCurrency(custos.creditoIcms)}</Text>
            </Group>
          )}
          {custos.custoFinanceiro != null && (
            <Group justify="space-between">
              <Text size="sm">Custo Financeiro</Text>
              <Text size="sm">{formatCurrency(custos.custoFinanceiro)}</Text>
            </Group>
          )}
          {custos.total != null && (
            <Group justify="space-between">
              <Text size="sm" fw={700}>Total</Text>
              <Text size="sm" fw={700} c="green">{formatCurrency(custos.total)}</Text>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* CEV */}
      {cev && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">CEV</Text>
          <Group gap="xs" wrap="wrap">
            {cev.icms != null && (
              <Badge color="indigo" variant="light">ICMS {formatNum(cev.icms, 2)}%</Badge>
            )}
            {cev.juros != null && (
              <Badge color="indigo" variant="light">Juros {formatNum(cev.juros, 2)}%</Badge>
            )}
            {cev.pisCofins != null && (
              <Badge color="indigo" variant="light">PIS/Cofins {formatNum(cev.pisCofins, 2)}%</Badge>
            )}
            {cev.comissoes != null && (
              <Badge color="indigo" variant="light">Comissões {formatNum(cev.comissoes, 2)}%</Badge>
            )}
            {cev.totalPercent != null && (
              <Badge color="indigo">Total {formatNum(cev.totalPercent, 2)}%</Badge>
            )}
          </Group>
        </Paper>
      )}

      {/* Margens por Tiragem */}
      {margens.length > 0 && (
        <Paper p="sm" withBorder>
          <Text size="sm" fw={700} mb="xs">Margens por Tiragem</Text>
          <ScrollArea>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th ta="right">Margem %</Table.Th>
                  <Table.Th ta="right">CM %</Table.Th>
                  <Table.Th ta="right">Valor Unitário</Table.Th>
                  <Table.Th ta="right">Valor Total</Table.Th>
                  <Table.Th ta="center">—</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {margens.map((mg, i) => (
                  <Table.Tr
                    key={i}
                    bg={mg.selecionada === true ? 'var(--mantine-color-green-light)' : undefined}
                  >
                    <Table.Td ta="right" fw={mg.selecionada === true ? 700 : undefined}>
                      {formatNum(mg.margemPercent, 2)}
                    </Table.Td>
                    <Table.Td ta="right">{formatNum(mg.cmPercent, 2)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(mg.valorUnitario)}</Table.Td>
                    <Table.Td ta="right" fw={700}>{formatCurrency(mg.valorTotal)}</Table.Td>
                    <Table.Td ta="center">
                      {mg.selecionada === true && (
                        <Badge size="xs" color="green">selecionada</Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}
    </Stack>
  )
}

// ============================================================================
// Página — Biblioteca de Cálculos ("Localiza o Cálculo Padrão")
// ============================================================================

export default function BibliotecaCalculosPage() {
  const router = useRouter()

  useEffect(() => { document.title = 'Biblioteca de Cálculos' }, [])

  // Filtros
  const [cliente, setCliente] = useState('')
  const [linhaProduto, setLinhaProduto] = useState('')
  const [produto, setProduto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [siglaAcabado, setSiglaAcabado] = useState('')
  const [numeroCalcgraf, setNumeroCalcgraf] = useState<number | ''>('')
  const [numero, setNumero] = useState<number | ''>('')

  // Resultado
  const [itens, setItens] = useState<ResumoCalculo[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)

  // Modal "Abrir" (detalhe do cálculo)
  const [detalhe, setDetalhe] = useState<CalculoDetalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)

  // Modal "Usar em orçamento"
  const [usarAlvo, setUsarAlvo] = useState<ResumoCalculo | null>(null)
  const [rascunhos, setRascunhos] = useState<OrcamentoRascunho[]>([])
  const [rascunhosLoading, setRascunhosLoading] = useState(false)
  const [orcamentoDestinoId, setOrcamentoDestinoId] = useState<string | null>(null)
  const [novaQuantidade, setNovaQuantidade] = useState<number | ''>('')
  const [criandoItem, setCriandoItem] = useState(false)

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO))

  const buscar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { pagina, tamanho: TAMANHO }
      if (cliente.trim()) params.cliente = cliente.trim()
      if (linhaProduto.trim()) params.linhaProduto = linhaProduto.trim()
      if (produto.trim()) params.produto = produto.trim()
      if (descricao.trim()) params.descricao = descricao.trim()
      if (siglaAcabado.trim()) params.siglaAcabado = siglaAcabado.trim()
      if (typeof numeroCalcgraf === 'number') params.numeroCalcgraf = numeroCalcgraf
      if (typeof numero === 'number') params.numero = numero

      const res = await api.get('/calculo-grafico', { params })
      const data: RespostaBusca = res.data
      setItens(data.itens || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao buscar',
        message: err?.response?.data?.message || 'Falha ao buscar cálculos.',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [pagina, cliente, linhaProduto, produto, descricao, siglaAcabado, numeroCalcgraf, numero])

  // Reset de página ao mudar filtros
  useEffect(() => { setPagina(1) }, [cliente, linhaProduto, produto, descricao, siglaAcabado, numeroCalcgraf, numero])

  // Debounce simples (recarrega no change)
  useEffect(() => {
    const t = setTimeout(() => { buscar() }, 400)
    return () => clearTimeout(t)
  }, [buscar])

  const abrirDetalhe = async (calculoId: string) => {
    setDetalheLoading(true)
    setDetalhe({ id: calculoId }) // abre o modal já em loading
    try {
      const res = await api.get(`/calculo-grafico/${calculoId}`)
      setDetalhe(res.data)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao abrir o cálculo.',
        color: 'red',
      })
      setDetalhe(null)
    } finally {
      setDetalheLoading(false)
    }
  }

  // Abre o modal "Usar em orçamento" para o cálculo da linha e carrega os rascunhos.
  const abrirUsarEmOrcamento = async (calc: ResumoCalculo) => {
    setUsarAlvo(calc)
    setOrcamentoDestinoId(null)
    setNovaQuantidade('')
    setRascunhosLoading(true)
    try {
      const res = await api.get('/orcamento-grafico', { params: { status: 'RASCUNHO', limit: 50 } })
      const lista: OrcamentoRascunho[] = res.data?.data || []
      setRascunhos(lista)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao carregar orçamentos em rascunho.',
        color: 'red',
      })
      setRascunhos([])
    } finally {
      setRascunhosLoading(false)
    }
  }

  const fecharUsarEmOrcamento = () => {
    setUsarAlvo(null)
    setRascunhos([])
    setOrcamentoDestinoId(null)
    setNovaQuantidade('')
  }

  // Cria um item no orçamento de destino a partir do cálculo selecionado.
  const criarItemDeCalculo = async () => {
    if (!usarAlvo || !orcamentoDestinoId) return
    setCriandoItem(true)
    try {
      const body: Record<string, unknown> = { calculoId: usarAlvo.id }
      if (typeof novaQuantidade === 'number' && novaQuantidade > 0) {
        body.novaQuantidade = novaQuantidade
      }
      await api.post(`/orcamento-grafico/${orcamentoDestinoId}/itens/de-calculo`, body)

      const destino = rascunhos.find((o) => o.id === orcamentoDestinoId)
      const numDestino = destino?.numero ?? '?'
      notifications.show({
        title: 'Item criado',
        message: `Item criado no orçamento #${numDestino} a partir do cálculo.`,
        color: 'green',
      })
      const idDestino = orcamentoDestinoId
      fecharUsarEmOrcamento()
      router.push(`/orcamento-grafico/${idDestino}`)
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao criar item',
        message: err?.response?.data?.message || 'Falha ao criar o item no orçamento.',
        color: 'red',
      })
    } finally {
      setCriandoItem(false)
    }
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <div>
        <Title order={3}>Biblioteca de Cálculos</Title>
        <Text size="sm" c="dimmed">
          Localiza o Cálculo Padrão — {total} cálculo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </Text>
      </div>

      {/* Filtros */}
      <Paper p="sm" withBorder>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            label="Cliente"
            placeholder="Nome do cliente"
            leftSection={<IconSearch size={14} />}
            value={cliente}
            onChange={(e) => setCliente(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <TextInput
            label="Linha de Produto"
            value={linhaProduto}
            onChange={(e) => setLinhaProduto(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            label="Produto"
            value={produto}
            onChange={(e) => setProduto(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            label="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            label="Sigla do Acabado"
            value={siglaAcabado}
            onChange={(e) => setSiglaAcabado(e.currentTarget.value)}
            w={140}
          />
          <NumberInput
            label="Nº Calcgraf"
            value={numeroCalcgraf}
            onChange={(v) => setNumeroCalcgraf(typeof v === 'number' ? v : '')}
            allowDecimal={false}
            min={0}
            w={130}
          />
          <NumberInput
            label="Nº Vizor"
            value={numero}
            onChange={(v) => setNumero(typeof v === 'number' ? v : '')}
            allowDecimal={false}
            min={0}
            w={130}
          />
        </Group>
      </Paper>

      {/* Tabela */}
      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº Vizor</Table.Th>
                <Table.Th>Nº Calcgraf</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Produto/Descrição</Table.Th>
                <Table.Th>Linha</Table.Th>
                <Table.Th>Data</Table.Th>
                <Table.Th>Origem</Table.Th>
                <Table.Th ta="center">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td fw={600}>{c.numero ?? '—'}</Table.Td>
                  <Table.Td>{rotuloCalcgraf(c.numeroCalcgraf)}</Table.Td>
                  <Table.Td>{c.clienteNome || '—'}</Table.Td>
                  <Table.Td>{c.produto || c.descricao || '—'}</Table.Td>
                  <Table.Td>{c.linhaProduto || '—'}</Table.Td>
                  <Table.Td>{formatarData(c.dataCalculo)}</Table.Td>
                  <Table.Td><BadgeOrigem origem={c.origem} /></Table.Td>
                  <Table.Td ta="center">
                    <Group gap="xs" justify="center" wrap="nowrap">
                      <Button size="xs" variant="light" onClick={() => abrirDetalhe(c.id)}>
                        Abrir
                      </Button>
                      <Button size="xs" variant="subtle" onClick={() => abrirUsarEmOrcamento(c)}>
                        Usar em orçamento
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {itens.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text ta="center" c="dimmed" py="md">
                      Nenhum cálculo encontrado
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <Group justify="center">
          <Pagination total={totalPaginas} value={pagina} onChange={setPagina} />
        </Group>
      )}

      {/* Modal "Abrir" — detalhe básico do cálculo */}
      <Modal
        opened={!!detalhe}
        onClose={() => setDetalhe(null)}
        title="Detalhes do Cálculo"
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {detalheLoading || !detalhe ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          (() => {
            // Foto rica (versaoFoto === 2): caminho ADICIONAL, espelhando o Calcgraf.
            const foto: FotoRica | null =
              detalhe.resultadoCalculo && detalhe.resultadoCalculo.versaoFoto === 2
                ? (detalhe.resultadoCalculo as FotoRica)
                : null

            if (foto) {
              const migrado = foto.origem === 'MIGRADO_CALCGRAF' || detalhe.origem === 'MIGRADO_CALCGRAF'
              return (
                <Stack gap="md">
                  <Alert
                    icon={<IconAlertTriangle size={16} />}
                    color="yellow"
                    title={migrado ? 'Foto do Calcgraf — valores originais' : 'Foto arquivada'}
                  >
                    {migrado
                      ? 'Foto do Calcgraf — valores originais. Não recalcular.'
                      : 'Foto arquivada — não recalcular.'}
                  </Alert>

                  <FotoRicaView foto={foto} />

                  <Group justify="flex-end">
                    <Button variant="default" onClick={() => setDetalhe(null)}>Fechar</Button>
                  </Group>
                </Stack>
              )
            }

            // Fallback (comportamento atual) — quando NÃO há foto rica.
            const cores = Array.isArray(detalhe.cores) ? detalhe.cores : []
            const acabamentos = Array.isArray(detalhe.acabamentosRicos) ? detalhe.acabamentosRicos : []
            const temGramatura = toNum(detalhe.gramatura) != null
            const larg = toNum(detalhe.formatoCorteLarguraMm)
            const alt = toNum(detalhe.formatoCorteAlturaMm)
            const temFormato = larg != null || alt != null
            const linhas = toNum(detalhe.montagemLinhas)
            const colunas = toNum(detalhe.montagemColunas)
            const temMontagem = linhas != null || colunas != null
            const temAproveitamento = toNum(detalhe.aproveitamentoManual) != null

            return (
              <Stack gap="md">
                {detalhe.origem === 'MIGRADO_CALCGRAF' && (
                  <Alert icon={<IconAlertTriangle size={16} />} color="yellow" title="Foto arquivada">
                    Foto arquivada — não recalcular.
                  </Alert>
                )}

                {/* Cabeçalho */}
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Text size="sm"><strong>Nº Vizor:</strong> {detalhe.numero ?? '—'}</Text>
                  <Text size="sm"><strong>Nº Calcgraf:</strong> {rotuloCalcgraf(detalhe.numeroCalcgraf)}</Text>
                  <Text size="sm"><strong>Cliente:</strong> {detalhe.clienteNome || '—'}</Text>
                  <Text size="sm"><strong>Linha de Produto:</strong> {detalhe.linhaProduto || '—'}</Text>
                  <Text size="sm"><strong>Produto:</strong> {detalhe.produto || '—'}</Text>
                  <Text size="sm"><strong>Data:</strong> {formatarData(detalhe.dataCalculo)}</Text>
                  <Text size="sm" style={{ gridColumn: '1 / -1' }}>
                    <strong>Descrição:</strong> {detalhe.descricao || '—'}
                  </Text>
                  <Text size="sm"><strong>Origem:</strong> <BadgeOrigem origem={detalhe.origem} /></Text>
                </SimpleGrid>

                <Divider />

                {/* Engenharia */}
                <Paper p="sm" withBorder>
                  <Text size="sm" fw={700} mb="xs">Engenharia</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <Text size="sm"><strong>Tiragem:</strong> {formatNum(detalhe.quantidade)}</Text>
                    <Text size="sm"><strong>Nº de Cores:</strong> {formatNum(detalhe.numCores)}</Text>
                    {temGramatura && (
                      <Text size="sm"><strong>Gramatura:</strong> {formatNum(detalhe.gramatura, 1)} g/m²</Text>
                    )}
                    {temFormato && (
                      <Text size="sm">
                        <strong>Formato de Corte:</strong>{' '}
                        {formatNum(detalhe.formatoCorteLarguraMm, 1)} x {formatNum(detalhe.formatoCorteAlturaMm, 1)} mm
                      </Text>
                    )}
                    {temMontagem && (
                      <Text size="sm">
                        <strong>Montagem:</strong> {formatNum(detalhe.montagemLinhas)} x {formatNum(detalhe.montagemColunas)}
                      </Text>
                    )}
                    {temAproveitamento && (
                      <Text size="sm"><strong>Aproveitamento:</strong> {formatNum(detalhe.aproveitamentoManual)}</Text>
                    )}
                    <Text size="sm"><strong>Sigla do Acabado:</strong> {detalhe.siglaAcabado || '—'}</Text>
                  </SimpleGrid>
                </Paper>

                {/* Cores */}
                {cores.length > 0 && (
                  <Paper p="sm" withBorder>
                    <Text size="sm" fw={700} mb="xs">Cores</Text>
                    <Group gap="xs" wrap="wrap">
                      {cores.map((cor, i) => (
                        <Badge key={i} color="grape" variant="light">{rotuloCor(cor)}</Badge>
                      ))}
                    </Group>
                  </Paper>
                )}

                {/* Acabamentos */}
                {acabamentos.length > 0 && (
                  <Paper p="sm" withBorder>
                    <Text size="sm" fw={700} mb="xs">Acabamentos</Text>
                    <Group gap="xs" wrap="wrap">
                      {acabamentos.map((ac, i) => (
                        <Badge key={i} color="teal" variant="light">
                          {(ac.nome && String(ac.nome).trim()) || '—'}
                        </Badge>
                      ))}
                    </Group>
                  </Paper>
                )}

                {/* Totais */}
                {(detalhe.custoProducao != null || detalhe.valorTotal != null) && (
                  <Paper p="sm" withBorder>
                    <Group justify="space-between">
                      <Text size="sm">Custo de Produção</Text>
                      <Text size="sm" fw={600} c="red">{formatCurrency(detalhe.custoProducao)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Valor Total</Text>
                      <Text size="sm" fw={700} c="green">{formatCurrency(detalhe.valorTotal)}</Text>
                    </Group>
                  </Paper>
                )}

                <Group justify="flex-end">
                  <Button variant="default" onClick={() => setDetalhe(null)}>Fechar</Button>
                </Group>
              </Stack>
            )
          })()
        )}
      </Modal>

      {/* Modal "Usar em orçamento" — escolher orçamento rascunho de destino */}
      <Modal
        opened={!!usarAlvo}
        onClose={fecharUsarEmOrcamento}
        title="Usar em orçamento"
        size="md"
      >
        {rascunhosLoading ? (
          <Center py="xl"><Loader /></Center>
        ) : rascunhos.length === 0 ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Nenhum orçamento em rascunho. Crie um orçamento primeiro.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={fecharUsarEmOrcamento}>Cancelar</Button>
              <Button onClick={() => router.push('/orcamento-grafico/novo')}>Novo Orçamento</Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Selecione um orçamento em rascunho para criar um item a partir do cálculo
              {usarAlvo?.numero != null ? ` #${usarAlvo.numero}` : ''}.
            </Text>
            <Select
              label="Orçamento de destino"
              placeholder="Selecione o orçamento"
              data={rascunhos.map((o) => ({
                value: o.id,
                label: `#${o.numero ?? '?'} — ${o.clienteNome || 'sem cliente'}`,
              }))}
              value={orcamentoDestinoId}
              onChange={setOrcamentoDestinoId}
              searchable
            />
            <NumberInput
              label="Nova quantidade (tiragem)"
              description="Opcional — vazio usa a tiragem do cálculo"
              placeholder="Usar a do cálculo"
              value={novaQuantidade}
              onChange={(v) => setNovaQuantidade(typeof v === 'number' ? v : '')}
              allowDecimal={false}
              min={0}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={fecharUsarEmOrcamento}>Cancelar</Button>
              <Button
                onClick={criarItemDeCalculo}
                loading={criandoItem}
                disabled={!orcamentoDestinoId}
              >
                Criar item
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
